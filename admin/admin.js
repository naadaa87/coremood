/* ==========================================================================
   CORE MOOD — admin
   GitHub 저장소에 직접 커밋하는 방식이라 별도 서버 없이 동작합니다.
   커밋되면 Cloudflare Pages 가 1~2분 안에 사이트를 다시 배포합니다.
   ========================================================================== */
(function () {
  "use strict";
  var CM = window.CMRender;
  var REPO = (window.CM_ADMIN && window.CM_ADMIN.repo) || CM.SITE.repo;
  var BRANCH = "main";
  var API = (window.CM_ADMIN && window.CM_ADMIN.api) || "https://api.github.com";
  var SITE = CM.SITE;
  var app = document.getElementById("app");
  var S = { token: "", login: "", index: { posts: [], industries: [], pages: [] }, queue: null, site: null, pages: null, images: [], server: null, uploads: {} };

  /* ---------- small helpers ---------- */
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function h(s) { return CM.esc(s); }
  function toast(t, bad) {
    var el = document.getElementById("toast");
    el.textContent = t; el.className = "toast on" + (bad ? " bad" : "");
    clearTimeout(toast.t); toast.t = setTimeout(function () { el.className = "toast"; }, bad ? 6000 : 3200);
  }
  var busyEl = null;
  function busy(t) {
    if (!t) { if (busyEl) { busyEl.remove(); busyEl = null; } return; }
    if (!busyEl) { busyEl = document.createElement("div"); busyEl.className = "busy"; document.body.appendChild(busyEl); }
    busyEl.innerHTML = "<span>" + h(t) + "</span>";
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function toLocalInput(iso) {
    var d = new Date(iso || Date.now()); if (isNaN(d)) d = new Date();
    var k = new Date(d.getTime() + 9 * 3600000);
    return k.getUTCFullYear() + "-" + pad(k.getUTCMonth() + 1) + "-" + pad(k.getUTCDate()) + "T" + pad(k.getUTCHours()) + ":" + pad(k.getUTCMinutes());
  }
  function fromLocalInput(v) { return v ? v + ":00+09:00" : new Date().toISOString(); }
  function fmtDT(iso) { var v = toLocalInput(iso); return v.slice(0, 10).replace(/-/g, ". ") + ". " + v.slice(11); }
  function statusOf(p) { return p.draft ? "draft" : CM.isLive(p) ? "live" : "scheduled"; }
  var STATUS_TXT = { live: "공개", scheduled: "예약", draft: "임시저장" };
  function catName(k) { return (CM.CATS[k] || {}).name || k; }

  /* ---------- token ---------- */
  function savedToken() {
    try { return localStorage.getItem("cm_admin_token") || sessionStorage.getItem("cm_admin_token") || ""; } catch (e) { return ""; }
  }
  function storeToken(t, keep) {
    try {
      localStorage.removeItem("cm_admin_token"); sessionStorage.removeItem("cm_admin_token");
      if (t) (keep ? localStorage : sessionStorage).setItem("cm_admin_token", t);
    } catch (e) {}
  }

  /* ---------- GitHub API ---------- */
  function gh(path, opt) {
    opt = opt || {};
    var headers = { Authorization: "Bearer " + S.token, Accept: "application/vnd.github+json" };
    if (opt.body) headers["Content-Type"] = "application/json";
    return fetch(API + path, { method: opt.method || "GET", headers: headers, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: "no-store" })
      .then(function (r) {
        if (r.status === 204) return {};
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error((j && j.message) || ("GitHub " + r.status)); e.status = r.status; throw e; }
          return j;
        });
      });
  }
  function b64ToText(b) {
    var bin = atob(String(b).replace(/\n/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }
  function bytesToB64(bytes) {
    var s = "", chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  }
  function textToB64(t) { return bytesToB64(new TextEncoder().encode(t)); }
  function getText(path) {
    return gh("/repos/" + REPO + "/contents/" + encodeURI(path) + "?ref=" + BRANCH).then(function (j) {
      if (j.content === undefined || j.encoding !== "base64" || (j.size > 900000 && !j.content)) {
        return gh("/repos/" + REPO + "/git/blobs/" + j.sha).then(function (b) { return { text: b64ToText(b.content), sha: j.sha }; });
      }
      return { text: b64ToText(j.content), sha: j.sha };
    });
  }
  function getJson(path, fallback) {
    return getText(path).then(function (r) { return JSON.parse(r.text); }).catch(function (e) {
      if (e.status === 404 && fallback !== undefined) return fallback; throw e;
    });
  }
  function listDir(path) { return gh("/repos/" + REPO + "/contents/" + encodeURI(path) + "?ref=" + BRANCH).catch(function () { return []; }); }

  // 여러 파일을 커밋 하나로 반영합니다. files: [{path, content | bytes | delete:true}]
  function commit(files, message, retry) {
    var base;
    return gh("/repos/" + REPO + "/git/ref/heads/" + BRANCH).then(function (ref) {
      base = ref.object.sha;
      return gh("/repos/" + REPO + "/git/commits/" + base);
    }).then(function (c) {
      return Promise.all(files.map(function (f) {
        if (f.delete) return Promise.resolve({ path: f.path, mode: "100644", type: "blob", sha: null });
        var content = f.bytes ? bytesToB64(f.bytes) : textToB64(f.content);
        return gh("/repos/" + REPO + "/git/blobs", { method: "POST", body: { content: content, encoding: "base64" } })
          .then(function (b) { return { path: f.path, mode: "100644", type: "blob", sha: b.sha }; });
      })).then(function (tree) {
        return gh("/repos/" + REPO + "/git/trees", { method: "POST", body: { base_tree: c.tree.sha, tree: tree } });
      });
    }).then(function (t) {
      return gh("/repos/" + REPO + "/git/commits", { method: "POST", body: { message: message + "\n\n(코어무드 관리자 화면에서 저장)", tree: t.sha, parents: [base] } });
    }).then(function (nc) {
      return gh("/repos/" + REPO + "/git/refs/heads/" + BRANCH, { method: "PATCH", body: { sha: nc.sha, force: false } }).then(function () { return nc; });
    }).catch(function (e) {
      if (!retry && (e.status === 422 || e.status === 409)) return commit(files, message, true);
      throw e;
    });
  }
  function exists(path) { return gh("/repos/" + REPO + "/contents/" + encodeURI(path) + "?ref=" + BRANCH).then(function () { return true; }).catch(function () { return false; }); }

  /* ---------- server functions (/api) ---------- */
  function api(path, opt) {
    opt = opt || {};
    return fetch(path, { method: opt.method || "GET", headers: { Authorization: "Bearer " + S.token, "Content-Type": "application/json" }, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: "no-store" })
      .then(function (r) { return r.json().catch(function () { return { ok: false, reason: "http-" + r.status }; }).then(function (j) { j._status = r.status; return j; }); })
      .catch(function () { return { ok: false, reason: "network", _status: 0 }; });
  }

  /* ---------- login ---------- */
  function loginView(msg) {
    app.className = "";
    app.innerHTML = '<div class="login"><div class="login__box">' +
      '<span class="mark">코어무드<i>.</i></span><span class="login__en">Site Admin</span>' +
      "<h1>관리자 로그인</h1><p class=\"d\">GitHub 개인 액세스 토큰으로 로그인합니다. 토큰은 이 브라우저에만 저장되고, 저장소(" + h(REPO) + ")에 글을 올릴 때만 쓰입니다.</p>" +
      (msg ? '<div class="note bad" style="margin-bottom:14px">' + h(msg) + "</div>" : "") +
      '<form id="lf"><div class="f"><label for="tk">GitHub 토큰</label><input class="in" id="tk" type="password" autocomplete="off" placeholder="github_pat_..." required></div>' +
      '<div class="row" style="justify-content:space-between;margin-top:14px"><label class="chk"><input type="checkbox" id="keep" checked> 이 기기에서 로그인 유지</label><button class="btn" type="submit">로그인</button></div></form>' +
      '<div class="login__help"><strong>토큰이 처음이라면</strong><ol>' +
      '<li>GitHub에 로그인한 뒤 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">새 토큰 만들기</a>를 엽니다.</li>' +
      "<li>Repository access에서 <b>Only select repositories</b> → <code>" + h(REPO.split("/")[1]) + "</code> 하나만 고릅니다.</li>" +
      "<li>Permissions → Repository permissions → <b>Contents</b>를 <b>Read and write</b>로 바꿉니다.</li>" +
      "<li>만료 기간을 정하고 토큰을 만든 뒤, 표시된 값을 위 칸에 붙여 넣습니다.</li></ol></div>" +
      "</div></div>";
    $("#lf").addEventListener("submit", function (e) {
      e.preventDefault();
      var t = $("#tk").value.trim();
      if (!t) return;
      S.token = t;
      busy("토큰을 확인하는 중입니다");
      verify().then(function () { storeToken(t, $("#keep").checked); return boot(); })
        .catch(function (err) { busy(); S.token = ""; loginView(err.message); });
    });
  }
  function verify() {
    return gh("/repos/" + REPO).then(function (r) {
      if (!r.permissions || !(r.permissions.push || r.permissions.admin)) throw new Error("이 토큰에는 저장소 쓰기 권한이 없습니다. Contents 권한을 Read and write로 설정해 주세요.");
      return gh("/user").then(function (u) { S.login = u.login || ""; }).catch(function () { S.login = (r.owner && r.owner.login) || ""; });
    }).catch(function (e) {
      if (e.status === 401) throw new Error("토큰이 올바르지 않거나 만료되었습니다.");
      if (e.status === 404) throw new Error("저장소를 찾을 수 없습니다. 토큰의 Repository access에 " + REPO + " 를 포함해 주세요.");
      throw e;
    });
  }
  function logout() { storeToken(""); S.token = ""; loginView(); }

  /* ---------- data ---------- */
  function loadAll() {
    return Promise.all([
      getJson("content/index.json", { posts: [], industries: [], pages: [] }),
      getJson("content/queue.json", { paused: false, notes: "", items: [] }),
      getJson("data/site.json", { notice: { enabled: false, text: "", link: "", linkText: "" } }),
      getJson("data/pages.json", { pages: {} }),
      getJson("data/images.json", { images: [] }),
      getJson("data/cases.json", { cases: [] })
    ]).then(function (r) {
      S.index = r[0]; S.queue = r[1]; S.site = r[2]; S.pages = r[3]; S.imagesDoc = r[4]; S.images = (r[4] && r[4].images) || []; S.casesDoc = r[5];
      CM.setVerify(S.site && S.site.verify); // 홈 <head> 를 다시 만들 때 소유확인 태그를 유지
    });
  }
  function cases() { return (S.casesDoc && S.casesDoc.cases) || []; }

  // 상담 문의는 서버(D1)에서 가져와 잠시 보관합니다
  function loadInquiries(force) {
    if (S.inq && !force && Date.now() - S.inq.at < 30000) return Promise.resolve(S.inq);
    return api("/api/admin/inquiries").then(function (r) {
      if (r.ok) {
        S.inq = { ok: true, at: Date.now(), items: r.items || [] };
        S.server = S.server || {}; S.server.newInq = S.inq.items.filter(function (x) { return x.status === "new"; }).length;
      } else S.inq = { ok: false, at: Date.now(), reason: r.reason || r.error || ("http-" + r._status), status: r._status, items: [] };
      return S.inq;
    });
  }

  /* ---------- shell ---------- */
  var NAV = [
    ["", "운영"], ["dashboard", "대시보드"], ["inquiries", "상담 문의"],
    ["", "콘텐츠"], ["posts", "저널 글"], ["queue", "발행 계획"], ["cases", "시공 사례"], ["industries", "업종 페이지"],
    ["", "사이트"], ["pages", "페이지 SEO"], ["images", "이미지"], ["settings", "사이트 설정"],
    ["", "도움말"], ["setup", "설정 점검"], ["help", "사용 안내"]
  ];
  function shell(key, title, sub, acts, body) {
    var newCount = S.server && S.server.newInq ? '<span class="n">' + S.server.newInq + "</span>" : "";
    app.className = "";
    app.innerHTML = '<div class="mtop"><span class="mark">코어무드<i>.</i></span><button type="button" id="mnav">메뉴</button></div>' +
      '<div class="shell"><aside class="side" id="side"><span class="mark">코어무드<i>.</i></span><span class="side__en">Site Admin</span><nav>' +
      NAV.map(function (n) {
        if (!n[0]) return '<span class="side__g">' + n[1] + "</span>";
        return '<a href="#/' + n[0] + '"' + (n[0] === key ? ' class="on"' : "") + "><span>" + n[1] + "</span>" + (n[0] === "inquiries" ? newCount : "") + "</a>";
      }).join("") +
      '</nav><div class="side__foot"><a href="/" target="_blank" rel="noopener">사이트 열기 ↗</a><a href="https://github.com/' + REPO + '/commits/' + BRANCH + '" target="_blank" rel="noopener">변경 기록 ↗</a><span>' + h(S.login || "") + ' · <button class="link" id="logout">로그아웃</button></span></div></aside>' +
      '<main class="main"><div class="top"><div><h1>' + h(title) + "<i>.</i></h1>" + (sub ? "<p>" + sub + "</p>" : "") + '</div><div class="acts">' + (acts || "") + "</div></div>" + body + "</main></div>";
    $("#logout").addEventListener("click", logout);
    $("#mnav").addEventListener("click", function () { $("#side").classList.toggle("open"); });
    $$(".side nav a").forEach(function (a) { a.addEventListener("click", function () { $("#side").classList.remove("open"); }); });
    window.scrollTo(0, 0);
  }

  /* ---------- router ---------- */
  function route() {
    var hsh = location.hash.replace(/^#\/?/, "") || "dashboard";
    var parts = hsh.split("/");
    var v = parts[0];
    if (v === "post") return postEditor(decodeURIComponent(parts[1] || "new"));
    if (v === "industry") return industryEditor(decodeURIComponent(parts[1] || ""));
    if (v === "case") return caseEditor(decodeURIComponent(parts[1] || "new"));
    if (v === "inquiry") return inquiriesView(decodeURIComponent(parts[1] || ""));
    var fn = { dashboard: dashboard, posts: postsView, queue: queueView, cases: casesView, industries: industriesView, inquiries: function () { inquiriesView(""); }, pages: pagesView, images: imagesView, settings: settingsView, setup: setupView, help: helpView }[v] || dashboard;
    fn();
  }
  window.addEventListener("hashchange", function () { if (S.token) route(); });

  /* ---------- dashboard ---------- */
  function todayKST() { return toLocalInput().slice(0, 10); }
  function dashboard() {
    var posts = (S.index.posts || []).map(function (p) { p.status = statusOf(p); return p; });
    var live = posts.filter(function (p) { return p.status === "live"; });
    var monthKey = todayKST().slice(0, 7);
    var month = live.filter(function (p) { return toLocalInput(p.date).slice(0, 7) === monthKey; }).length;
    var sched = posts.filter(function (p) { return p.status === "scheduled"; }).length;
    var drafts = posts.filter(function (p) { return p.status === "draft"; }).length;
    var pending = ((S.queue && S.queue.items) || []).filter(function (x) { return x.status === "pending"; }).length;
    var body = '<div class="grid g4" id="kpi">' +
      '<div class="stat"><div class="stat__k">새 상담 문의</div><div class="stat__v">–</div><div class="stat__n">불러오는 중…</div></div>' +
      '<div class="stat"><div class="stat__k">오늘 연락할 문의</div><div class="stat__v">–</div><div class="stat__n">다음 연락일 기준</div></div>' +
      stat("이번 달 발행", month, "편", "공개 " + live.length + " · 예약 " + sched + " · 임시저장 " + drafts) +
      stat("발행 계획 대기", pending, "개", S.queue && S.queue.paused ? "자동 발행 일시중지 중" : pending <= 5 ? "주제를 더 추가해 주세요" : "매일 오전 10시 자동 발행") +
      "</div>" +
      '<div class="grid g2" style="margin-top:16px;align-items:start"><div>' +
      '<div class="panel"><h2>오늘 할 일 <small><a href="#/inquiries">상담 문의 전체</a></small></h2><div id="todo"><div class="empty">불러오는 중…</div></div></div>' +
      '<div class="panel"><h2>문의 흐름 <small>최근 30일</small></h2><div id="funnel"><div class="empty">–</div></div></div>' +
      "</div><div>" +
      '<div class="panel"><h2>최근 변경 기록 <small><a href="https://github.com/' + REPO + '/commits/' + BRANCH + '" target="_blank" rel="noopener">GitHub에서 보기</a></small></h2><div id="commits"><div class="empty">불러오는 중…</div></div></div>' +
      '<div class="panel"><h2>바로 하기</h2><div class="row"><a class="btn" href="#/post/new">새 글 쓰기</a><a class="btn btn--ghost" href="#/case/new">시공 사례 추가</a><a class="btn btn--ghost" href="#/queue">발행 주제 추가</a><a class="btn btn--ghost" href="#/inquiries">문의 직접 등록</a></div>' +
      '<h2 style="margin-top:22px">바깥 서비스</h2><div class="row">' +
      '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://searchadvisor.naver.com/console/board">네이버 서치어드바이저 ↗</a>' +
      '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://search.google.com/search-console">구글 서치 콘솔 ↗</a>' +
      '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://dash.cloudflare.com/">Cloudflare ↗</a>' +
      '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://github.com/' + REPO + '">GitHub 저장소 ↗</a></div></div>' +
      "</div></div>";
    shell("dashboard", "대시보드", "오늘 확인할 문의와 홈페이지 운영 현황입니다.", '<button class="btn btn--ghost" id="reload">새로고침</button>', body);
    bindGo();
    $("#reload").addEventListener("click", function () { busy("최신 상태를 불러오는 중"); S.inq = null; loadAll().then(function () { busy(); dashboard(); }); });
    // 최근 변경 기록
    gh("/repos/" + REPO + "/commits?sha=" + BRANCH + "&per_page=8").then(function (list) {
      var el = $("#commits"); if (!el) return;
      el.innerHTML = '<table class="tbl"><tbody>' + list.map(function (c) {
        var msg = (c.commit && c.commit.message || "").split("\n")[0];
        var auto = /자동 발행/.test(msg);
        return "<tr><td class=\"t\">" + h(msg) + "<span>" + fmtDT(c.commit.author.date) + '</span></td><td>' + (auto ? '<span class="badge contacted">자동</span>' : "") + "</td></tr>";
      }).join("") + "</tbody></table>";
    }).catch(function () { var el = $("#commits"); if (el) el.innerHTML = '<div class="empty">변경 기록을 불러오지 못했습니다.</div>'; });
    // 문의
    loadInquiries().then(function (q) {
      var k = $$("#kpi .stat"); if (!k.length) return;
      if (!q.ok) {
        var why = q.reason === "not-configured" ? "문의 저장소 연결 전 · 설정 점검 참고" : q.status === 0 || q.status === 404 ? "배포된 사이트(coremood.kr/admin)에서 확인됩니다" : "불러오지 못했습니다";
        k[0].innerHTML = '<div class="stat__k">새 상담 문의</div><div class="stat__v">–</div><div class="stat__n">' + why + "</div>";
        $("#todo").innerHTML = '<div class="note warn">' + (q.reason === "not-configured" ? '상담 문의 저장소(D1)가 아직 연결되지 않았습니다. 지금은 문의가 방문자의 메일 앱으로 전달됩니다. <a href="#/setup">설정 점검</a>에서 연결 방법을 확인하세요.' : "상담 문의를 불러오지 못했습니다.") + "</div>";
        return;
      }
      var items = q.items, today = todayKST();
      var news = items.filter(function (x) { return x.status === "new"; });
      var due = items.filter(function (x) { return x.followUp && x.followUp <= today && ["won", "closed"].indexOf(x.status) < 0; });
      var d30 = new Date(Date.now() - 30 * 86400000).toISOString();
      var recent = items.filter(function (x) { return x.createdAt >= d30; });
      k[0].innerHTML = '<div class="stat__k">새 상담 문의</div><div class="stat__v">' + news.length + '<small>건</small></div><div class="stat__n">최근 30일 접수 ' + recent.length + "건</div>";
      k[1].innerHTML = '<div class="stat__k">오늘 연락할 문의</div><div class="stat__v">' + due.length + '<small>건</small></div><div class="stat__n">다음 연락일이 오늘이거나 지난 문의</div>';
      var nav = $('.side nav a[href="#/inquiries"]'); if (nav && news.length && !$(".n", nav)) nav.insertAdjacentHTML("beforeend", '<span class="n">' + news.length + "</span>");
      var todo = news.concat(due.filter(function (x) { return x.status !== "new"; })).slice(0, 8);
      $("#todo").innerHTML = todo.length ? '<table class="tbl"><tbody>' + todo.map(function (x) {
        return '<tr class="click" data-go="#/inquiry/' + encodeURIComponent(x.id) + '"><td class="t">' + h(x.name || "(이름 없음)") + "<span>" + h([x.biz, x.region].filter(Boolean).join(" · ") || x.type) + " · " + fmtDT(x.createdAt) + '</span></td><td><span class="badge ' + x.status + '">' + (x.status === "new" ? "새 문의" : "연락 예정 " + h(x.followUp.slice(5).replace("-", "/"))) + "</span></td></tr>";
      }).join("") + "</tbody></table>" : '<div class="empty">지금 처리할 문의가 없습니다.</div>';
      // 흐름(퍼널)과 유입
      var stages = INQ_ST.filter(function (s) { return s[0] !== "hold"; });
      var max = Math.max(1, recent.length);
      var src = {};
      recent.forEach(function (x) { var key = sourceLabel(x); src[key] = (src[key] || 0) + 1; });
      var top = Object.keys(src).sort(function (a, b) { return src[b] - src[a]; }).slice(0, 5);
      $("#funnel").innerHTML = '<div class="bars">' + stages.map(function (s) {
        var n = recent.filter(function (x) { return x.status === s[0]; }).length;
        return '<div class="bar"><span class="bar__k">' + s[1] + '</span><span class="bar__t"><i style="width:' + Math.round(n / max * 100) + '%"></i></span><span class="bar__n">' + n + "</span></div>";
      }).join("") + "</div>" +
        (top.length ? '<h2 style="margin-top:18px">유입 경로 상위</h2><table class="tbl"><tbody>' + top.map(function (t) { return "<tr><td>" + h(t) + '</td><td style="text-align:right">' + src[t] + "건</td></tr>"; }).join("") + "</tbody></table>" : "");
      bindGo();
    });
  }
  function sourceLabel(x) {
    if (x.type === "직접 등록") return "직접 등록 · " + (x.channel || "기타");
    if (x.utm) { var m = /source=([^&]+)/.exec(x.utm); if (m) return "캠페인 · " + decodeURIComponent(m[1]); }
    if (x.ref) {
      var r = x.ref.toLowerCase();
      if (r.indexOf("naver") >= 0) return "네이버";
      if (r.indexOf("google") >= 0) return "구글";
      if (r.indexOf("daum") >= 0 || r.indexOf("kakao") >= 0) return "다음 · 카카오";
      if (r.indexOf("instagram") >= 0) return "인스타그램";
      try { return new URL(x.ref).hostname.replace(/^www\./, ""); } catch (e) { return "다른 사이트"; }
    }
    if (x.landing) {
      if (/^\/journal\//.test(x.landing) && x.landing.length > 9) return "저널 글 첫 방문";
      if (/^\/industries\//.test(x.landing)) return "업종 페이지 첫 방문";
      if (/^\/projects\//.test(x.landing)) return "시공 사례 첫 방문";
    }
    return "직접 방문 · 기타";
  }
  function stat(k, v, unit, n) { return '<div class="stat"><div class="stat__k">' + k + '</div><div class="stat__v">' + v + "<small>" + unit + '</small></div><div class="stat__n">' + h(n) + "</div></div>"; }
  function bindGo() { $$("[data-go]").forEach(function (el) { if (el._go) return; el._go = 1; el.addEventListener("click", function (e) { if (e.target.closest("a,button")) return; location.hash = el.dataset.go; }); }); }

  /* ---------- posts list ---------- */
  function postsView() {
    var posts = CM.sortPosts((S.index.posts || []).map(function (p) { p.status = statusOf(p); return p; }));
    var f = postsView.f || { cat: "", st: "", q: "" };
    var chips = '<div class="filters" id="cf"><button class="chip' + (!f.cat ? " on" : "") + '" data-cat="">전체 분류</button>' + CM.CAT_ORDER.map(function (k) { return '<button class="chip' + (f.cat === k ? " on" : "") + '" data-cat="' + k + '">' + catName(k) + "</button>"; }).join("") + "</div>";
    var st = '<div class="filters" id="sf">' + [["", "전체"], ["live", "공개"], ["scheduled", "예약"], ["draft", "임시저장"]].map(function (x) { return '<button class="chip' + (f.st === x[0] ? " on" : "") + '" data-st="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>";
    var body = '<div class="panel"><div class="bar">' + chips + '<input class="in" id="pq" style="max-width:260px" placeholder="제목·키워드 검색" value="' + h(f.q) + '"></div><div class="bar">' + st + '<span class="tiny" id="pc"></span></div><div class="tblwrap"><table class="tbl"><thead><tr><th>제목</th><th class="hide-m">분류</th><th class="hide-m">키워드</th><th>발행</th><th>상태</th></tr></thead><tbody id="pl"></tbody></table></div></div>';
    shell("posts", "저널 글", "글을 고치거나 새로 쓰면 저장과 동시에 사이트에 반영됩니다(배포 1~2분).", '<a class="btn" href="#/post/new">새 글 쓰기</a>', body);
    function draw() {
      var q = f.q.toLowerCase();
      var list = posts.filter(function (p) {
        return (!f.cat || p.category === f.cat) && (!f.st || p.status === f.st) &&
          (!q || (p.title + " " + p.keyword + " " + (p.tags || []).join(" ") + " " + p.slug).toLowerCase().indexOf(q) >= 0);
      });
      $("#pc").textContent = list.length + "편";
      $("#pl").innerHTML = list.map(function (p) {
        return '<tr class="click" data-go="#/post/' + encodeURIComponent(p.slug) + '"><td class="t">' + h(p.title) + "<span>/journal/" + h(p.slug) + '</span></td><td class="hide-m">' + catName(p.category) + '</td><td class="hide-m">' + h(p.keyword) + "</td><td>" + fmtDT(p.date) + '</td><td><span class="badge ' + p.status + '">' + STATUS_TXT[p.status] + "</span></td></tr>";
      }).join("") || '<tr><td colspan="5"><div class="empty">조건에 맞는 글이 없습니다.</div></td></tr>';
      bindGo();
    }
    $$("#cf .chip").forEach(function (c) { c.addEventListener("click", function () { f.cat = c.dataset.cat; postsView.f = f; postsView(); }); });
    $$("#sf .chip").forEach(function (c) { c.addEventListener("click", function () { f.st = c.dataset.st; postsView.f = f; postsView(); }); });
    $("#pq").addEventListener("input", function () { f.q = this.value; postsView.f = f; draw(); });
    draw();
  }

  /* ---------- content audit (scripts/check.js 의 핵심 규칙) ---------- */
  var BANNED = [
    [/소셜\s*패밀리|SOCIAL\s*FAMILY/i, "이전 법인명은 쓰지 않습니다"],
    [/블랭크/, "본문에는 브랜드명 ‘코어무드’를 씁니다"],
    [/최고의|업계 최고|국내 최고|업계 1위|국내 1위|넘버원|No\.\s?1|최초의|유일한/, "최상급 표현"],
    [/(매출|수익|성공|만족)\s*(을|를)?\s*보장|보장해\s*드립|100\s*%\s*(만족|보장|성공)|무조건/, "보장·단정 표현"],
    [/알아보겠습니다|알아볼까요|살펴보겠습니다|결론적으로|요약하자면|도움이 되셨|여러분/, "상투적 표현"]
  ];
  function audit(kind, d, body) {
    var out = [];
    var add = function (lvl, t) { out.push([lvl, t]); };
    var tl = (d.title || "").length, dl = (d.description || "").length, len = CM.textLength(body);
    var kw = (d.keyword || "").trim();
    if (kind === "post") add(tl >= 20 && tl <= 40 ? "ok" : tl ? "warn" : "bad", "제목 " + tl + "자 (권장 25~40자)");
    add(dl >= 80 && dl <= 150 ? "ok" : dl >= 60 && dl <= 170 ? "warn" : "bad", "설명 " + dl + "자 (권장 80~150자)");
    add(len >= 3000 ? "ok" : len >= 2400 ? "warn" : "bad", "본문 " + len.toLocaleString() + "자 (공백 제외, 최소 2,400자)");
    if (kw) {
      var first = (body.split(/\n\s*\n/).filter(function (x) { return x.trim() && !/^[#:|>!-]/.test(x.trim()); })[0] || "");
      add((d.title || d.h1 || "").indexOf(kw.split(" ")[0]) >= 0 ? "ok" : "warn", "제목에 키워드 ‘" + kw + "’");
      add(first.indexOf(kw.split(" ")[0]) >= 0 ? "ok" : "warn", "첫 문단에 키워드");
    } else add("bad", "핵심 키워드가 비어 있습니다");
    var h2 = (body.match(/^##\s/gm) || []).length;
    add(h2 >= 4 ? "ok" : h2 >= 3 ? "warn" : "bad", "소제목(##) " + h2 + "개");
    var links = (body.match(/\]\(\/(?!assets)[^)]*\)/g) || []).length;
    add(links >= 3 ? "ok" : links >= 2 ? "warn" : "bad", "내부 링크 " + links + "개 (권장 3~5개)");
    if (/^#\s/m.test(body)) add("bad", "본문에 # 제목(H1)은 쓰지 않습니다");
    var txt = (d.title || "") + " " + (d.description || "") + " " + body;
    BANNED.forEach(function (b) { var m = txt.match(b[0]); if (m) add("bad", b[1] + ": “" + m[0] + "”"); });
    if (/340/.test(txt) && !/10여 년간 340개 이상/.test(txt)) add("bad", "실적은 ‘10여 년간 340개 이상 프로젝트’로만 표기");
    if (/인허가|소방|용도\s*변경|영업\s*신고|전기\s*용량|승압|전기\s*증설/.test(txt) && !/별도\s*(의\s*)?확인/.test(txt)) add("bad", "인허가·소방·전기 용량 언급 시 ‘별도 확인’ 안내 필요");
    var b = (body.match(/^:::\s*\w+/gm) || []).length, e = (body.match(/^:::\s*$/gm) || []).length;
    if (b !== e) add("bad", "::: 블록 열고 닫힘이 맞지 않습니다");
    var ex = (txt.match(/!/g) || []).length; if (ex > 1) add("warn", "느낌표 " + ex + "회");
    return out;
  }
  function auditHtml(list) {
    return '<ul class="seo">' + list.map(function (x) { return '<li class="' + x[0] + '"><span class="i">' + (x[0] === "ok" ? "✓" : x[0] === "warn" ? "!" : "✕") + "</span><span>" + h(x[1]) + "</span></li>"; }).join("") + "</ul>";
  }

  /* ---------- editor pieces ---------- */
  var SNIP = {
    h2: ["\n## ", "소제목", "\n"], h3: ["\n### ", "작은 소제목", "\n"], b: ["**", "굵게", "**"], link: ["[", "링크 글자", "](/estimate)"],
    ul: ["\n- ", "항목", "\n"], note: ["\n:::note 메모 제목\n", "내용", "\n:::\n"], check: ["\n:::check 체크리스트 제목\n- ", "확인할 항목", "\n- \n:::\n"],
    table: ["\n| 구분 | 내용 |\n|---|---|\n| ", "항목", " | 설명 |\n"], spec: ["\n:::spec\n", "업종: 카페", "\n면적: \n기간: \n범위: \n:::\n"],
    faq: ["\n:::faq\nQ. ", "질문", "\n답변 문단\n\nQ. 다음 질문\n답변\n:::\n"]
  };
  function toolbar(id) {
    return '<div class="tool" data-for="' + id + '">' + [["h2", "소제목"], ["h3", "작은 소제목"], ["b", "굵게"], ["link", "링크"], ["ul", "목록"], ["check", "체크리스트"], ["note", "메모"], ["table", "표"], ["spec", "요약표"], ["faq", "FAQ"], ["img", "이미지 넣기"]]
      .map(function (x) { return '<button type="button" data-snip="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div>";
  }
  function bindToolbar(onImg) {
    $$(".tool button").forEach(function (b) {
      b.addEventListener("click", function () {
        var ta = document.getElementById(b.parentNode.dataset.for);
        if (b.dataset.snip === "img") return onImg(ta);
        insertAt(ta, SNIP[b.dataset.snip]);
      });
    });
  }
  function insertAt(ta, sn) {
    var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    var sel = v.slice(s, e) || sn[1];
    ta.value = v.slice(0, s) + sn[0] + sel + sn[2] + v.slice(e);
    ta.focus(); ta.selectionStart = s + sn[0].length; ta.selectionEnd = s + sn[0].length + sel.length;
    ta.dispatchEvent(new Event("input"));
  }
  function gallery(cur, name) {
    return '<div class="gal" data-gal="' + name + '">' + S.images.map(function (im) {
      return '<button type="button" title="' + h(im.alt) + '" data-src="' + h(im.src) + '" data-alt="' + h(im.alt) + '"' + (im.src === cur ? ' class="on"' : "") + '><img src="' + h(im.src) + '" alt="" loading="lazy"></button>';
    }).join("") + "</div>";
  }
  function pickImage(cb) {
    var inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      busy("이미지를 웹용(WebP)으로 줄이는 중");
      resizeToWebp(f, 1600).then(function (r) { busy(); cb(r); }).catch(function () { busy(); toast("이미지를 읽지 못했습니다.", true); });
    };
    inp.click();
  }
  function resizeToWebp(file, max) {
    return createImageBitmap(file).then(function (bmp) {
      var r = Math.min(1, max / Math.max(bmp.width, bmp.height));
      var c = document.createElement("canvas"); c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(function (b) { res(b); }, "image/webp", 0.82); }).then(function (blob) {
        return blob.arrayBuffer().then(function (buf) { return { bytes: new Uint8Array(buf), url: URL.createObjectURL(blob), w: c.width, h: c.height }; });
      });
    });
  }

  /* ---------- OG card (scripts/og.py 와 같은 디자인) ---------- */
  var ogFont = null;
  function ensureOgFont() {
    if (ogFont) return ogFont;
    var ff = new FontFace("PretendardOG", "url(/assets/fonts/Pretendard-sub.woff2)", { weight: "300 900" });
    ogFont = ff.load().then(function (f) { document.fonts.add(f); return true; }).catch(function () { return false; });
    return ogFont;
  }
  function loadImg(src) { return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  function ogCard(title, cat, coverSrc) {
    return Promise.all([ensureOgFont(), loadImg(coverSrc)]).then(function (r) {
      var W = 1200, H = 630, P = 430, L = 72, width = W - P - L - 64;
      var c = document.createElement("canvas"); c.width = W; c.height = H;
      var x = c.getContext("2d");
      x.fillStyle = "#F6F3EE"; x.fillRect(0, 0, W, H);
      var im = r[1];
      if (im) { var sc = Math.max(P / im.width, H / im.height), iw = im.width * sc, ih = im.height * sc; x.drawImage(im, W - P - (iw - P) / 2, -(ih - H) / 2, iw, ih); }
      x.fillStyle = "#F6F3EE"; x.fillRect(0, 0, W - P, H);
      var F = function (w, s) { return w + " " + s + "px PretendardOG, sans-serif"; };
      x.textBaseline = "top";
      x.fillStyle = "#6F735E"; x.font = F(600, 19); x.fillText("CORE MOOD JOURNAL", L, 70);
      x.fillStyle = "#CBC1B1"; x.fillRect(L, 112, W - P - 64 - L, 1);
      x.fillStyle = "#9C9184"; x.font = F(600, 24); x.fillText(cat, L, 132);
      var size = 58, lines;
      var wrap = function (t) {
        if (t.indexOf(", ") > 0) { var hd = t.split(", ")[0]; if (x.measureText(hd + ",").width <= width) return [hd + ","].concat(wrap(t.slice(hd.length + 2))); }
        var out = [], cur = "";
        t.split(" ").forEach(function (w) { var tt = (cur + " " + w).trim(); if (x.measureText(tt).width <= width) cur = tt; else { if (cur) out.push(cur); cur = w; } });
        if (cur) out.push(cur); return out;
      };
      do { x.font = F(700, size); lines = wrap(title); size -= 4; } while (lines.length > 3 && size > 40);
      size += 4;
      var lh = Math.round(size * 1.32), y = 196 + Math.max(0, 3 - lines.length) * lh / 3;
      x.fillStyle = "#231E19";
      lines.slice(0, 4).forEach(function (ln, i, arr) {
        x.fillText(ln, L, y);
        if (i === arr.length - 1 && !/[.?!]$/.test(ln)) { x.fillStyle = "#A8834E"; x.fillText(".", L + x.measureText(ln).width + 2, y); x.fillStyle = "#231E19"; }
        y += lh;
      });
      x.fillStyle = "#CBC1B1"; x.fillRect(L, 520, W - P - 64 - L, 1);
      x.fillStyle = "#231E19"; x.font = F(700, 26); x.fillText("코어무드", L, 542);
      var tw = x.measureText("코어무드").width;
      x.fillStyle = "#A8834E"; x.fillText(".", L + tw + 1, 542);
      x.fillStyle = "#9C9184"; x.font = F(500, 18); x.fillText("coremood.kr", L + tw + 30, 548);
      return new Promise(function (res) { c.toBlob(function (b) { b.arrayBuffer().then(function (buf) { res(new Uint8Array(buf)); }); }, "image/jpeg", 0.84); });
    });
  }

  /* ---------- post editor ---------- */
  function postEditor(slug) {
    var isNew = slug === "new";
    var go = function (src) {
      var fm = src ? CM.parseFront(src) : { data: {}, body: "" };
      var d = fm.data, body = fm.body;
      if (isNew) {
        var tomorrow = new Date();
        d = { title: "", slug: "", date: new Date().toISOString(), category: "interior", keyword: "", tags: [], description: "", cover: (S.images[0] || {}).src || "", coverAlt: (S.images[0] || {}).alt || "", draft: true };
        body = "도입 문단을 씁니다. 첫 문단에 핵심 키워드를 자연스럽게 한 번 넣어 주세요.\n\n## 첫 번째 소제목\n\n본문\n\n## 두 번째 소제목\n\n본문\n\n## 다음에 할 일\n\n마무리 문단과 [상담 신청](/contact) 같은 관련 페이지 링크.\n";
      }
      var orig = isNew ? "" : slug;
      var origEntry = (S.index.posts || []).filter(function (p) { return p.slug === orig; })[0];
      var pend = {};
      var bodyHtml = '<div class="ed"><div><div class="panel">' +
        '<div class="f"><label for="e-title">제목 <small id="c-title"></small></label><input class="in" id="e-title" value="' + h(d.title) + '" placeholder="핵심 키워드를 앞쪽에, 25~40자"></div>' +
        '<div class="grid g2" style="margin-top:14px"><div class="f"><label for="e-slug">주소 (영문) <small>/journal/…</small></label><input class="in" id="e-slug" value="' + h(d.slug || orig) + '" placeholder="예: cafe-lighting-tips"></div>' +
        '<div class="f"><label for="e-kw">핵심 키워드</label><input class="in" id="e-kw" value="' + h(d.keyword) + '" placeholder="예: 카페 인테리어 비용"></div></div>' +
        '<div class="f"><label for="e-desc">설명 (검색 결과에 보이는 문장) <small id="c-desc"></small></label><textarea class="ta" id="e-desc" style="min-height:76px">' + h(d.description) + "</textarea></div>" +
        '</div><div class="panel"><div class="tabs"><button type="button" class="on" data-tab="write">본문 쓰기</button><button type="button" data-tab="preview">실제 화면 미리보기</button></div>' +
        '<div id="tab-write">' + toolbar("e-body") + '<textarea class="ta ta--code" id="e-body" spellcheck="false">' + h(body) + '</textarea><p class="tiny" style="margin-top:8px">문법 안내: ## 소제목 · **굵게** · [글자](/주소) · :::check / :::note / :::faq 블록 — 자세한 내용은 사용 안내의 ‘글쓰기 규칙’</p></div>' +
        '<div id="tab-preview" hidden><iframe class="pv" id="pv" title="미리보기"></iframe></div></div></div>' +
        '<div class="ed__side"><div class="panel"><h2>발행</h2>' +
        '<div class="f"><label for="e-cat">분류</label><select class="sel" id="e-cat">' + CM.CAT_ORDER.map(function (k) { return '<option value="' + k + '"' + (d.category === k ? " selected" : "") + ">" + catName(k) + "</option>"; }).join("") + "</select></div>" +
        '<div class="f"><label for="e-tags">태그 <small>쉼표로 구분, 2~5개</small></label><input class="in" id="e-tags" value="' + h((d.tags || []).join(", ")) + '"></div>' +
        '<div class="f"><label for="e-date">발행 일시 <small>미래로 정하면 예약 발행</small></label><input class="in" type="datetime-local" id="e-date" value="' + toLocalInput(d.date) + '"></div>' +
        '<div class="f"><label class="switch"><input type="checkbox" id="e-pub"' + (d.draft ? "" : " checked") + '><i></i><span>공개 (끄면 임시저장)</span></label></div>' +
        '<div class="f"><label class="chk"><input type="checkbox" id="e-og" checked> 공유용 이미지(OG 카드) 새로 만들기</label></div>' +
        '<div class="row" style="margin-top:16px"><button class="btn" id="e-save">저장하고 반영</button>' + (isNew ? "" : '<a class="btn btn--ghost" target="_blank" rel="noopener" href="/journal/' + h(orig) + '">사이트에서 보기</a>') + "</div>" +
        (isNew ? "" : '<div style="margin-top:14px"><button class="btn btn--danger btn--sm" id="e-del">이 글 삭제</button></div>') + "</div>" +
        '<div class="panel"><h2>점검 <small>저장 전 확인</small></h2><div id="e-audit"></div></div>' +
        '<div class="panel"><h2>검색 결과 미리보기</h2><div class="serp"><div class="serp__u">coremood.kr › journal › <span id="s-slug"></span></div><div class="serp__t" id="s-title"></div><div class="serp__d" id="s-desc"></div></div></div>' +
        '<div class="panel"><h2>대표 이미지 <small><button class="link" type="button" id="e-up">새 이미지 올리기</button></small></h2><div class="cover"><img id="e-cover" src="' + h(d.cover) + '" alt=""></div>' +
        '<div class="f" style="margin-top:10px"><label for="e-alt">이미지 설명(alt)</label><input class="in" id="e-alt" value="' + h(d.coverAlt) + '"></div><div style="margin-top:10px">' + gallery(d.cover, "cover") + "</div></div>" +
        "</div></div>";
      shell("posts", isNew ? "새 글 쓰기" : "글 수정", isNew ? "임시저장 상태로 시작합니다. 다 쓰고 ‘공개’를 켠 뒤 저장하세요." : '<a href="#/posts">← 글 목록</a>', "", bodyHtml);
      var cover = d.cover;
      function cur() {
        return {
          title: $("#e-title").value.trim(), slug: $("#e-slug").value.trim().toLowerCase(), date: fromLocalInput($("#e-date").value),
          category: $("#e-cat").value, keyword: $("#e-kw").value.trim(), tags: $("#e-tags").value.split(",").map(function (x) { return x.trim(); }).filter(Boolean),
          description: $("#e-desc").value.replace(/\s+/g, " ").trim(), cover: cover, coverAlt: $("#e-alt").value.trim(), draft: !$("#e-pub").checked
        };
      }
      function refresh() {
        var c = cur(), b = $("#e-body").value;
        var tl = c.title.length, dl = c.description.length;
        $("#c-title").textContent = tl + "자"; $("#c-title").className = "cnt " + (tl >= 20 && tl <= 40 ? "ok" : "warn");
        $("#c-desc").textContent = dl + "자"; $("#c-desc").className = "cnt " + (dl >= 80 && dl <= 150 ? "ok" : "warn");
        $("#s-slug").textContent = c.slug || "…"; $("#s-title").textContent = (c.title || "제목") + " | 코어무드 저널"; $("#s-desc").textContent = c.description || "설명";
        $("#e-audit").innerHTML = auditHtml(audit("post", c, b));
      }
      ["#e-title", "#e-slug", "#e-kw", "#e-desc", "#e-body", "#e-alt"].forEach(function (s) { $(s).addEventListener("input", refresh); });
      refresh();
      $$('[data-gal="cover"] button').forEach(function (b) {
        b.addEventListener("click", function () {
          $$('[data-gal="cover"] button').forEach(function (o) { o.classList.remove("on"); }); b.classList.add("on");
          cover = b.dataset.src; $("#e-cover").src = cover; if (!$("#e-alt").value || confirmAlt) $("#e-alt").value = b.dataset.alt; refresh();
        });
      });
      var confirmAlt = true;
      $("#e-alt").addEventListener("input", function () { confirmAlt = false; });
      $("#e-up").addEventListener("click", function () {
        pickImage(function (r) {
          var s = (cur().slug || "post") + "-" + Date.now().toString(36);
          var path = "/assets/img/journal/" + s + ".webp";
          pend[path] = r; cover = path; $("#e-cover").src = r.url; $("#e-alt").value = ""; $("#e-alt").focus();
          toast("저장할 때 이미지도 함께 올라갑니다. 이미지 설명을 적어 주세요.");
        });
      });
      bindToolbar(function (ta) {
        pickImage(function (r) {
          var s = (cur().slug || "post") + "-" + Date.now().toString(36);
          var path = "/assets/img/journal/" + s + ".webp";
          pend[path] = r;
          insertAt(ta, ["\n![", "이미지 설명", "](" + path + ' "캡션")\n']);
        });
      });
      $$(".tabs button").forEach(function (b) {
        b.addEventListener("click", function () {
          $$(".tabs button").forEach(function (o) { o.classList.remove("on"); }); b.classList.add("on");
          var pvOn = b.dataset.tab === "preview";
          $("#tab-write").hidden = pvOn; $("#tab-preview").hidden = !pvOn;
          if (pvOn) {
            var c = cur(), meta = CM.postMeta(c.slug || "preview", c, $("#e-body").value); meta.slug = c.slug || "preview";
            var html = CM.renderPost(meta, $("#e-body").value, { posts: livePosts() });
            Object.keys(pend).forEach(function (p) { html = html.split(p).join(pend[p].url); });
            $("#pv").srcdoc = html;
          }
        });
      });
      $("#e-save").addEventListener("click", function () {
        var c = cur(), b = $("#e-body").value;
        var bad = audit("post", c, b).filter(function (x) { return x[0] === "bad"; });
        if (!c.title || !/^[a-z0-9-]+$/.test(c.slug)) return toast("제목과 영문 주소(소문자·숫자·하이픈)를 입력해 주세요.", true);
        if (!c.description) return toast("설명을 입력해 주세요.", true);
        if (bad.length && !c.draft && !confirm("점검에서 고칠 항목이 " + bad.length + "개 있습니다.\n- " + bad.map(function (x) { return x[1]; }).join("\n- ") + "\n\n그래도 공개로 저장할까요?")) return;
        if (c.slug !== orig && (S.index.posts || []).some(function (p) { return p.slug === c.slug; })) return toast("같은 주소의 글이 이미 있습니다.", true);
        savePost(c, b, orig, origEntry, pend, $("#e-og").checked);
      });
      var del = $("#e-del");
      if (del) del.addEventListener("click", function () {
        if (!confirm("‘" + d.title + "’ 글을 삭제할까요? 사이트에서도 사라집니다.")) return;
        deletePost(orig, origEntry);
      });
    };
    if (isNew) return go("");
    busy("글을 불러오는 중");
    getText("content/posts/" + slug + ".md").then(function (r) { busy(); go(r.text); }).catch(function (e) { busy(); toast("글을 불러오지 못했습니다: " + e.message, true); location.hash = "#/posts"; });
  }
  function livePosts(list) { return (list || S.index.posts || []).filter(function (p) { return CM.isLive(p); }); }

  function journalFiles(posts, homeHtml) {
    var live = livePosts(posts);
    var ctx = { posts: live, cases: cases(), now: Date.now() };
    var files = [
      { path: "journal/index.html", content: CM.renderJournalIndex(ctx) },
      { path: "sitemap.xml", content: CM.renderSitemap(ctx) },
      { path: "feed.xml", content: CM.renderFeed(ctx) },
      { path: "data/posts.json", content: CM.postsJson(ctx) }
    ];
    CM.CAT_ORDER.forEach(function (k) { files.push({ path: "journal/category/" + k + ".html", content: CM.renderCategory(k, ctx) }); });
    if (homeHtml && S.pages && S.pages.pages && S.pages.pages.index) files.push({ path: "index.html", content: CM.injectPartials(homeHtml, "index", { posts: live, cases: cases(), pageMeta: S.pages.pages.index }) });
    return { files: files, ctx: ctx };
  }

  function savePost(c, body, orig, origEntry, pend, makeOg) {
    busy("저장하는 중입니다 (최신 목록 확인)");
    var fresh, homeHtml, ogKeys;
    Promise.all([getJson("content/index.json", { posts: [], industries: [], pages: [] }), getText("index.html").catch(function () { return { text: "" }; }), getJson("content/og-keys.json", {})])
      .then(function (r) {
        fresh = r[0]; homeHtml = r[1].text; ogKeys = r[2];
        var meta = CM.postMeta(c.slug, c, body); meta.slug = c.slug;
        var files = [];
        Object.keys(pend).forEach(function (p) { if (body.indexOf(p) >= 0 || c.cover === p) files.push({ path: p.slice(1), bytes: pend[p].bytes }); });
        var ogP = Promise.resolve();
        var ogPath = "assets/img/og/" + c.slug + ".jpg";
        var prevOg = (origEntry && origEntry.og) || "";
        if (makeOg) {
          busy("공유 이미지를 만드는 중");
          var coverSrc = pend[c.cover] ? pend[c.cover].url : c.cover;
          ogP = ogCard(c.title, catName(c.category), coverSrc).then(function (bytes) {
            files.push({ path: ogPath, bytes: bytes });
            meta.og = "/" + ogPath;
            ogKeys[c.slug] = c.title + "|" + c.category + "|" + c.cover;
            files.push({ path: "content/og-keys.json", content: JSON.stringify(ogKeys, null, 1) + "\n" });
          });
        } else if (prevOg && orig === c.slug) meta.og = prevOg;
        return ogP.then(function () {
          busy("페이지를 만드는 중");
          var data = { title: c.title, slug: c.slug, date: c.date, category: c.category, keyword: c.keyword, tags: c.tags, description: c.description, cover: c.cover, coverAlt: c.coverAlt, draft: c.draft };
          if (origEntry && origEntry.updated) data.updated = origEntry.updated;
          if (orig && origEntry && CM.isLive(origEntry) && CM.isLive(meta)) data.updated = new Date().toISOString();
          meta.updated = data.updated || "";
          files.push({ path: "content/posts/" + c.slug + ".md", content: CM.stringifyFront(data, body, CM.POST_KEYS) });
          var posts = (fresh.posts || []).filter(function (p) { return p.slug !== c.slug && p.slug !== orig; });
          var prevLive = (fresh.posts || []).some(function (p) { return p.slug === orig && CM.isLive(p); });
          if (orig && orig !== c.slug) {
            files.push({ path: "content/posts/" + orig + ".md", delete: true });
            if (prevLive) files.push({ path: "journal/" + orig + ".html", delete: true });
          }
          var entry = Object.assign({}, meta, { status: statusOf(meta), file: "content/posts/" + c.slug + ".md" });
          posts.push(entry);
          posts = CM.sortPosts(posts);
          var jf = journalFiles(posts, homeHtml);
          if (CM.isLive(meta)) files.push({ path: "journal/" + c.slug + ".html", content: CM.renderPost(meta, body, jf.ctx) });
          else if (prevLive && orig === c.slug) files.push({ path: "journal/" + c.slug + ".html", delete: true });
          files = files.concat(jf.files);
          fresh.posts = posts.map(function (p) { p.status = statusOf(p); return p; });
          fresh.updated = new Date().toISOString();
          files.push({ path: "content/index.json", content: JSON.stringify(fresh, null, 1) + "\n" });
          busy("GitHub에 반영하는 중");
          return commit(files, "journal: " + (orig ? "수정 " : "새 글 ") + c.title).then(function () {
            S.index = fresh; busy();
            var live = CM.isLive(meta);
            toast(live ? "저장했습니다. 1~2분 뒤 사이트에 반영됩니다." : (c.draft ? "임시저장했습니다." : "예약했습니다. 발행 시각 이후 첫 자동 빌드 때 공개됩니다."));
            if (live) pingIndex([SITE.url + "/journal/" + c.slug, SITE.url + "/journal/"], true);
            location.hash = "#/post/" + encodeURIComponent(c.slug);
            if (orig === c.slug) route();
          });
        });
      })
      .catch(function (e) { busy(); toast("저장하지 못했습니다: " + e.message, true); });
  }
  function deletePost(slug, entry) {
    busy("삭제하는 중");
    Promise.all([getJson("content/index.json", { posts: [] }), getText("index.html").catch(function () { return { text: "" }; })]).then(function (r) {
      var fresh = r[0];
      var files = [{ path: "content/posts/" + slug + ".md", delete: true }];
      var was = (fresh.posts || []).filter(function (p) { return p.slug === slug; })[0];
      if (was && CM.isLive(was)) files.push({ path: "journal/" + slug + ".html", delete: true });
      if (was && was.og) files.push({ path: was.og.slice(1), delete: true });
      fresh.posts = (fresh.posts || []).filter(function (p) { return p.slug !== slug; });
      var jf = journalFiles(fresh.posts, r[1].text);
      files = files.concat(jf.files);
      files.push({ path: "content/index.json", content: JSON.stringify(fresh, null, 1) + "\n" });
      return commit(files, "journal: 삭제 " + slug).then(function () { S.index = fresh; busy(); toast("삭제했습니다."); location.hash = "#/posts"; });
    }).catch(function (e) { busy(); toast("삭제하지 못했습니다: " + e.message, true); });
  }
  function pingIndex(urls, quiet) {
    return api("/api/indexnow", { method: "POST", body: { urls: urls } }).then(function (r) {
      if (!quiet) toast(r.ok ? "검색엔진에 " + r.count + "개 주소를 알렸습니다." : "검색엔진 알림이 처리되지 않았습니다 (" + (r.reason || r.error || r._status) + ")", !r.ok);
      return r;
    });
  }

  /* ---------- queue ---------- */
  function queueView() {
    var Q = S.queue || { paused: false, notes: "", items: [] };
    Q.items = Q.items || [];
    var pending = Q.items.filter(function (x) { return x.status === "pending"; });
    var done = Q.items.filter(function (x) { return x.status !== "pending"; }).slice(-12).reverse();
    var body = '<div class="grid g2" style="align-items:start"><div>' +
      '<div class="panel"><h2>대기 중인 주제 <small>위에서부터 하루 한 편씩 발행</small></h2><div class="q" id="ql">' +
      (pending.length ? pending.map(function (x, i) {
        return '<div class="qi" data-id="' + h(x.id) + '"><span class="qi__n">' + (i + 1) + '</span><div><div class="qi__t">' + h(x.title) + '</div><div class="qi__m">' + catName(x.category) + " · 키워드 " + h(x.keyword || "-") + "</div>" + (x.angle ? '<div class="qi__a">' + h(x.angle) + "</div>" : "") + '</div><div class="qi__b"><button class="btn btn--ghost btn--sm" data-a="up">↑</button><button class="btn btn--ghost btn--sm" data-a="down">↓</button><button class="btn btn--ghost btn--sm" data-a="edit">수정</button><button class="btn btn--danger btn--sm" data-a="del">삭제</button></div></div>';
      }).join("") : '<div class="empty">대기 주제가 없습니다. 이 경우 자동 발행이 분류를 돌아가며 새 주제를 직접 정합니다.</div>') +
      "</div></div>" +
      '<div class="panel"><h2>최근 처리된 주제</h2>' + (done.length ? '<div class="q">' + done.map(function (x) {
        return '<div class="qi done"><span class="qi__n">✓</span><div><div class="qi__t">' + h(x.title) + '</div><div class="qi__m">' + (x.status === "done" ? "발행 " + (x.publishedAt ? fmtDT(x.publishedAt) : "") + (x.publishedSlug ? ' · <a href="/journal/' + h(x.publishedSlug) + '" target="_blank">글 보기</a>' : "") : "건너뜀") + "</div></div><div></div></div>";
      }).join("") + "</div>" : '<div class="empty">아직 없습니다.</div>') + "</div></div>" +
      '<div><div class="panel"><h2>자동 발행 설정</h2>' +
      '<label class="switch"><input type="checkbox" id="q-on"' + (Q.paused ? "" : " checked") + '><i></i><span>매일 오전 10시 자동 발행</span></label>' +
      '<div class="f" style="margin-top:16px"><label for="q-notes">이번 시기 방향 메모 <small>자동 발행이 주제를 정할 때 참고</small></label><textarea class="ta" id="q-notes" placeholder="예: 11월에는 연말 파티룸 수요와 리뉴얼 시즌을 다뤄 주세요. 미용실 글을 한 달에 두 번 이상.">' + h(Q.notes || "") + "</textarea></div>" +
      '<div class="row" style="margin-top:14px"><button class="btn" id="q-save">설정 저장</button></div></div>' +
      '<div class="panel"><h2>주제 추가</h2><form id="q-add">' + queueForm({}) + '<div class="row" style="margin-top:14px"><button class="btn btn--olive" type="submit">대기열에 추가</button></div></form></div>' +
      '<div class="panel"><h2>자동 발행은 이렇게 움직입니다</h2><ol class="steps"><li>매일 오전 10시 무렵, 대기열 맨 위 주제를 가져옵니다.</li><li>문체 가이드(content/STYLE.md)에 맞춰 3,000~5,000자 분량으로 쓰고 자동 점검을 통과시킵니다.</li><li>대표 이미지와 공유 이미지를 정하고 사이트맵·RSS·목록을 갱신해 GitHub에 올립니다.</li><li>대기열이 비어 있으면 분류를 돌아가며 기존 글과 겹치지 않는 주제를 직접 정합니다.</li></ol></div></div></div>';
    shell("queue", "발행 계획", "자동 발행이 가져갈 주제와 순서를 관리합니다. 바꾼 내용은 ‘저장’을 눌러야 반영됩니다.", "", body);
    function persist(msg) {
      busy("저장하는 중");
      return getJson("content/queue.json", { items: [] }).then(function (fresh) {
        // 자동 발행이 그사이 처리한 항목은 서버 상태를 따릅니다
        var srv = {}; (fresh.items || []).forEach(function (x) { srv[x.id] = x; });
        Q.items = Q.items.map(function (x) { return srv[x.id] && srv[x.id].status !== "pending" ? srv[x.id] : x; });
        (fresh.items || []).forEach(function (x) { if (!Q.items.some(function (y) { return y.id === x.id; }) && x.status !== "pending" && !Q._deleted[x.id]) Q.items.push(x); });
        delete Q._deleted;
        return commit([{ path: "content/queue.json", content: JSON.stringify(Q, null, 1) + "\n" }], "queue: " + msg);
      }).then(function () { busy(); S.queue = Q; toast("저장했습니다."); queueView(); }).catch(function (e) { busy(); toast("저장하지 못했습니다: " + e.message, true); });
    }
    Q._deleted = Q._deleted || {};
    $$("#ql .qi").forEach(function (el) {
      var id = el.dataset.id;
      $$("[data-a]", el).forEach(function (b) {
        b.addEventListener("click", function () {
          var i = Q.items.findIndex(function (x) { return x.id === id; });
          var a = b.dataset.a;
          if (a === "del") { if (!confirm("이 주제를 삭제할까요?")) return; Q._deleted[id] = 1; Q.items.splice(i, 1); return persist("주제 삭제"); }
          if (a === "up" || a === "down") {
            var pIdx = Q.items.map(function (x, k) { return x.status === "pending" ? k : -1; }).filter(function (k) { return k >= 0; });
            var pos = pIdx.indexOf(i), to = a === "up" ? pos - 1 : pos + 1;
            if (to < 0 || to >= pIdx.length) return;
            var tmp = Q.items[pIdx[to]]; Q.items[pIdx[to]] = Q.items[i]; Q.items[i] = tmp;
            return persist("순서 변경");
          }
          if (a === "edit") {
            var x = Q.items[i];
            el.className = "qi edit";
            el.innerHTML = "<form>" + queueForm(x) + '<div class="row" style="margin-top:10px"><button class="btn btn--sm" type="submit">수정 저장</button><button class="btn btn--ghost btn--sm" type="button" data-x>취소</button></div></form>';
            $("[data-x]", el).addEventListener("click", queueView);
            $("form", el).addEventListener("submit", function (e) { e.preventDefault(); Object.assign(x, readQueueForm(el)); persist("주제 수정"); });
          }
        });
      });
    });
    $("#q-add").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = readQueueForm($("#q-add"));
      if (!v.title) return toast("주제(제목안)를 입력해 주세요.", true);
      v.id = "q" + Date.now().toString(36); v.status = "pending"; v.addedAt = new Date().toISOString();
      Q.items.push(v); persist("주제 추가");
    });
    $("#q-save").addEventListener("click", function () { Q.paused = !$("#q-on").checked; Q.notes = $("#q-notes").value.trim(); persist(Q.paused ? "자동 발행 일시중지" : "자동 발행 설정"); });
  }
  function queueForm(x) {
    return '<div class="f"><label>주제 (제목안)</label><input class="in" name="title" value="' + h(x.title || "") + '" placeholder="예: 카페 테라스 인테리어, 계절을 타지 않게 만드는 법"></div>' +
      '<div class="grid g2" style="margin-top:12px"><div class="f"><label>분류</label><select class="sel" name="category">' + CM.CAT_ORDER.map(function (k) { return '<option value="' + k + '"' + (x.category === k ? " selected" : "") + ">" + catName(k) + "</option>"; }).join("") + '</select></div><div class="f"><label>핵심 키워드</label><input class="in" name="keyword" value="' + h(x.keyword || "") + '" placeholder="예: 카페 테라스 인테리어"></div></div>' +
      '<div class="f" style="margin-top:12px"><label>방향 메모 <small>선택</small></label><textarea class="ta" name="angle" style="min-height:70px" placeholder="꼭 다뤘으면 하는 내용, 대상 독자, 피하고 싶은 내용">' + h(x.angle || "") + "</textarea></div>";
  }
  function readQueueForm(el) { return { title: $('[name="title"]', el).value.trim(), category: $('[name="category"]', el).value, keyword: $('[name="keyword"]', el).value.trim(), angle: $('[name="angle"]', el).value.trim() }; }

  /* ---------- industries ---------- */
  function industriesView() {
    var list = S.index.industries || [];
    var body = '<div class="panel"><table class="tbl"><thead><tr><th>업종 페이지</th><th class="hide-m">키워드</th><th></th></tr></thead><tbody>' +
      CM.INDUSTRIES.map(function (x) {
        var d = list.filter(function (y) { return y.slug === x.slug; })[0];
        return '<tr class="click" data-go="#/industry/' + x.slug + '"><td class="t">' + h((d && d.title) || x.name) + "<span>/industries/" + x.slug + '</span></td><td class="hide-m">' + h((d && d.keyword) || "") + '</td><td><a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="/industries/' + x.slug + '">보기 ↗</a></td></tr>';
      }).join("") + "</tbody></table></div>";
    shell("industries", "업종 페이지", "카페, 미용실, 파티룸 등 업종별 랜딩 페이지의 문구를 고칩니다.", "", body);
    bindGo();
  }
  function industryEditor(slug) {
    busy("페이지를 불러오는 중");
    getText("content/industries/" + slug + ".md").then(function (r) {
      busy();
      var fm = CM.parseFront(r.text), d = fm.data;
      var BIZ = { cafe: "카페 · 베이커리", dining: "음식점 · 주점", bar: "바 · 라운지", retail: "리테일 · 쇼룸", office: "오피스", study: "스터디카페 · 학원", beauty: "미용 · 뷰티", stay: "숙박 · 스테이", party: "파티룸 · 스튜디오" };
      var field = function (id, label, val, ph, small) { return '<div class="f"><label for="' + id + '">' + label + (small ? " <small>" + small + "</small>" : "") + '</label><input class="in" id="' + id + '" value="' + h(val || "") + '" placeholder="' + h(ph || "") + '"></div>'; };
      var hero = d.hero;
      var bodyHtml = '<div class="ed"><div><div class="panel"><div class="grid g2">' + field("i-title", "페이지 이름", d.title) + field("i-kw", "핵심 키워드", d.keyword) + "</div>" +
        '<div style="margin-top:14px">' + field("i-h1", "큰 제목(H1)", d.h1, "", "30자 안팎") + "</div>" +
        '<div style="margin-top:14px">' + field("i-seo", "검색 결과 제목", d.seoTitle, "", "40자 안팎, 끝에 | 코어무드") + "</div>" +
        '<div class="f"><label for="i-desc">검색 결과 설명 <small id="ic-desc"></small></label><textarea class="ta" id="i-desc" style="min-height:70px">' + h(d.description || "") + "</textarea></div>" +
        '<div class="f"><label for="i-lead">제목 아래 소개 문장</label><textarea class="ta" id="i-lead" style="min-height:70px">' + h(d.lead || "") + "</textarea></div></div>" +
        '<div class="panel">' + toolbar("i-body") + '<textarea class="ta ta--code" id="i-body" spellcheck="false">' + h(fm.body) + "</textarea></div></div>" +
        '<div class="ed__side"><div class="panel"><h2>설정</h2>' +
        '<div class="f"><label for="i-biz">견적 계산 업종</label><select class="sel" id="i-biz">' + Object.keys(BIZ).map(function (k) { return '<option value="' + k + '"' + (d.biz === k ? " selected" : "") + ">" + BIZ[k] + "</option>"; }).join("") + "</select></div>" +
        '<div class="f"><label for="i-ba">시공 전후 사례</label><select class="sel" id="i-ba"><option value="">표시 안 함</option>' + cases().filter(function (x) { return !x.draft; }).map(function (x) { var k = x.key || x.slug; return '<option value="' + h(k) + '"' + (d.ba === k || d.ba === x.slug ? " selected" : "") + ">" + h(x.title) + " (" + h(x.region) + ")</option>"; }).join("") + "</select></div>" +
        '<div class="f"><label for="i-tags">태그 <small>관련 저널 글 연결용</small></label><input class="in" id="i-tags" value="' + h((d.tags || []).join(", ")) + '"></div>' +
        '<div class="row" style="margin-top:16px"><button class="btn" id="i-save">저장하고 반영</button><a class="btn btn--ghost" target="_blank" rel="noopener" href="/industries/' + h(slug) + '">사이트에서 보기</a></div></div>' +
        '<div class="panel"><h2>점검</h2><div id="i-audit"></div></div>' +
        '<div class="panel"><h2>대표 이미지</h2><div class="cover"><img id="i-hero" src="' + h(hero) + '" alt=""></div><div class="f" style="margin-top:10px"><label for="i-alt">이미지 설명(alt)</label><input class="in" id="i-alt" value="' + h(d.heroAlt || "") + '"></div><div style="margin-top:10px">' + gallery(hero, "hero") + "</div></div></div></div>";
      shell("industries", (d.title || slug) + " 수정", '<a href="#/industries">← 업종 페이지 목록</a>', "", bodyHtml);
      function cur() {
        return Object.assign({}, d, {
          title: $("#i-title").value.trim(), keyword: $("#i-kw").value.trim(), h1: $("#i-h1").value.trim(), seoTitle: $("#i-seo").value.trim(),
          description: $("#i-desc").value.replace(/\s+/g, " ").trim(), lead: $("#i-lead").value.replace(/\s+/g, " ").trim(), biz: $("#i-biz").value,
          ba: $("#i-ba").value, tags: $("#i-tags").value.split(",").map(function (x) { return x.trim(); }).filter(Boolean), hero: hero, heroAlt: $("#i-alt").value.trim(), slug: slug
        });
      }
      function refresh() {
        var c = cur(); var dl = c.description.length;
        $("#ic-desc").textContent = dl + "자"; $("#ic-desc").className = "cnt " + (dl >= 80 && dl <= 150 ? "ok" : "warn");
        $("#i-audit").innerHTML = auditHtml(audit("industry", c, $("#i-body").value));
      }
      $$(".ed input,.ed textarea").forEach(function (el) { el.addEventListener("input", refresh); });
      refresh();
      $$('[data-gal="hero"] button').forEach(function (b) { b.addEventListener("click", function () { $$('[data-gal="hero"] button').forEach(function (o) { o.classList.remove("on"); }); b.classList.add("on"); hero = b.dataset.src; $("#i-hero").src = hero; $("#i-alt").value = b.dataset.alt; }); });
      bindToolbar(function () { toast("업종 페이지에는 이미지 라이브러리의 이미지를 써 주세요.", true); });
      $("#i-save").addEventListener("click", function () {
        var c = cur(), b = $("#i-body").value;
        if (!c.ba) delete c.ba;
        busy("저장하는 중");
        getJson("content/index.json", { posts: [], industries: [] }).then(function (fresh) {
          var ctx = { posts: livePosts(fresh.posts), cases: cases() };
          c.updated = new Date().toISOString();
          var files = [
            { path: "content/industries/" + slug + ".md", content: CM.stringifyFront(c, b, CM.IND_KEYS) },
            { path: "industries/" + slug + ".html", content: CM.renderIndustry(c, b, ctx) }
          ];
          var inds = (fresh.industries || []).filter(function (x) { return x.slug !== slug; });
          inds.push({ slug: slug, title: c.title, keyword: c.keyword, lead: c.lead, description: c.description, hero: c.hero, heroAlt: c.heroAlt, order: c.order, file: "content/industries/" + slug + ".md" });
          inds.sort(function (a, b2) { return (a.order || 99) - (b2.order || 99); });
          fresh.industries = inds;
          files.push({ path: "industries/index.html", content: CM.renderIndustriesIndex(inds, ctx) });
          files.push({ path: "content/index.json", content: JSON.stringify(fresh, null, 1) + "\n" });
          return commit(files, "industry: 수정 " + c.title).then(function () { S.index = fresh; busy(); toast("저장했습니다. 1~2분 뒤 사이트에 반영됩니다."); pingIndex([SITE.url + "/industries/" + slug], true); });
        }).catch(function (e) { busy(); toast("저장하지 못했습니다: " + e.message, true); });
      });
    }).catch(function (e) { busy(); toast("불러오지 못했습니다: " + e.message, true); location.hash = "#/industries"; });
  }

  /* ---------- inquiries (상담 문의 관리) ---------- */
  var INQ_ST = [["new", "새 문의"], ["contacted", "연락 완료"], ["meeting", "미팅·실측"], ["quoted", "견적 발송"], ["won", "계약"], ["hold", "보류"], ["closed", "종료"]];
  var CHANNELS = ["전화", "카카오톡", "문자", "이메일", "방문", "소개", "블로그·SNS", "기타"];
  var BIZ_OPTS = ["카페 · 베이커리", "음식점 · 주점", "바 · 라운지", "리테일 · 쇼룸", "오피스", "스터디카페 · 학원", "미용 · 뷰티", "숙박 · 스테이", "파티룸 · 스튜디오", "기타"];
  function inqLabel(k) { for (var i = 0; i < INQ_ST.length; i++) if (INQ_ST[i][0] === k) return INQ_ST[i][1]; return k; }
  function telHref(p) { return (p || "").replace(/[^0-9+]/g, ""); }
  function inquiriesView(openId) {
    var f = inquiriesView.f || { st: "", q: "", type: "" };
    shell("inquiries", "상담 문의", "홈페이지 상담 신청·빠른 문의와 직접 등록한 문의를 한곳에서 관리합니다.",
      '<button class="btn btn--ghost" id="i-csv">CSV 내려받기</button><button class="btn" id="i-add">문의 직접 등록</button>',
      '<div id="inqBody"><div class="panel"><div class="empty">불러오는 중…</div></div></div>');
    loadInquiries(true).then(function (q) {
      var box = $("#inqBody"); if (!box) return;
      if (!q.ok) {
        box.innerHTML = '<div class="panel"><div class="note warn">' + (q.reason === "not-configured"
          ? '상담 문의 저장소(D1)가 아직 연결되지 않았습니다. 지금은 상담 신청이 방문자의 메일 앱으로 전달됩니다. <a href="#/setup">설정 점검</a>의 1번을 따라 한 번만 연결하면 이 화면에서 문의를 관리할 수 있습니다.'
          : q.status === 0 || q.status === 404 ? "서버 기능에 연결하지 못했습니다. 배포된 주소(coremood.kr/admin)에서 열어 주세요." : "문의를 불러오지 못했습니다 (" + h(q.reason) + ").") + "</div></div>";
        $("#i-add").disabled = true; $("#i-csv").disabled = true;
        return;
      }
      var items = q.items, sel = openId || null, today = todayKST();
      function match(x) {
        if (f.st === "due") { if (!(x.followUp && x.followUp <= today && ["won", "closed"].indexOf(x.status) < 0)) return false; }
        else if (f.st && x.status !== f.st) return false;
        if (f.type && x.type !== f.type) return false;
        if (f.q) {
          var hay = [x.name, x.phone, x.email, x.biz, x.region, x.note, x.memo, x.quote, x.channel].join(" ").toLowerCase();
          if (f.q.toLowerCase().split(/\s+/).some(function (w) { return hay.indexOf(w) < 0; })) return false;
        }
        return true;
      }
      function draw() {
        var list = items.filter(match);
        var dueN = items.filter(function (x) { return x.followUp && x.followUp <= today && ["won", "closed"].indexOf(x.status) < 0; }).length;
        box.innerHTML = '<div class="inq"><div class="panel"><div class="bar"><div class="filters" id="i-st">' +
          [["", "전체"], ["due", "오늘 연락"]].concat(INQ_ST).map(function (s) {
            var n = s[0] === "due" ? dueN : s[0] ? items.filter(function (x) { return x.status === s[0]; }).length : items.length;
            return '<button class="chip' + (f.st === s[0] ? " on" : "") + '" data-f="' + s[0] + '">' + s[1] + " " + n + "</button>";
          }).join("") + '</div></div><div class="bar"><input class="in" id="i-q" style="max-width:280px" placeholder="이름·연락처·업종·내용 검색" value="' + h(f.q) + '">' +
          '<select class="sel" id="i-type" style="max-width:160px"><option value="">모든 경로</option><option' + (f.type === "상담 신청" ? " selected" : "") + '>상담 신청</option><option' + (f.type === "빠른 문의" ? " selected" : "") + '>빠른 문의</option><option' + (f.type === "직접 등록" ? " selected" : "") + ">직접 등록</option></select></div>" +
          '<div class="tblwrap"><table class="tbl"><thead><tr><th>접수</th><th>고객</th><th class="hide-m">업종 · 지역</th><th class="hide-m">다음 연락</th><th>상태</th></tr></thead><tbody>' +
          (list.map(function (x) {
            var late = x.followUp && x.followUp <= today && ["won", "closed"].indexOf(x.status) < 0;
            return '<tr class="click' + (x.id === sel ? " sel" : "") + '" data-id="' + h(x.id) + '"><td>' + fmtDT(x.createdAt).slice(0, 12) + '<span class="tiny" style="display:block">' + h(x.type || "") + '</span></td><td class="t">' + h(x.name || "(이름 없음)") + "<span>" + h(x.phone) + '</span></td><td class="hide-m">' + h(x.biz || "-") + " · " + h(x.region || "-") + '</td><td class="hide-m' + (late ? " late" : "") + '">' + (x.followUp ? h(x.followUp.slice(5).replace("-", "/")) : '<span class="muted">-</span>') + '</td><td><span class="badge ' + x.status + '">' + inqLabel(x.status) + "</span></td></tr>";
          }).join("") || '<tr><td colspan="5"><div class="empty">조건에 맞는 문의가 없습니다.</div></td></tr>') +
          '</tbody></table></div></div><div class="panel inq__d" id="inqD"><div class="empty">왼쪽에서 문의를 고르세요.</div></div></div>';
        $$("#i-st .chip").forEach(function (c) { c.addEventListener("click", function () { f.st = c.dataset.f; inquiriesView.f = f; draw(); }); });
        var qi = $("#i-q"); qi.addEventListener("input", function () { f.q = qi.value; inquiriesView.f = f; clearTimeout(qi._t); qi._t = setTimeout(function () { draw(); var n = $("#i-q"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); });
        $("#i-type").addEventListener("change", function () { f.type = this.value; inquiriesView.f = f; draw(); });
        $$("tr[data-id]", box).forEach(function (tr) { tr.addEventListener("click", function () { sel = tr.dataset.id; history.replaceState(null, "", "#/inquiry/" + encodeURIComponent(sel)); draw(); }); });
        if (sel) detail();
      }
      function detail() {
        var x = items.filter(function (y) { return y.id === sel; })[0];
        var D = $("#inqD"); if (!x || !D) return;
        var row = function (k, v) { return "<dt>" + k + "</dt><dd>" + (v ? h(v) : '<span class="muted">-</span>') + "</dd>"; };
        D.innerHTML = "<h2>" + h(x.name || "(이름 없음)") + ' <small><span class="badge ' + x.status + '">' + inqLabel(x.status) + "</span></small></h2>" +
          '<div class="row" style="margin-bottom:14px">' + (x.phone ? '<a class="btn btn--sm" href="tel:' + h(telHref(x.phone)) + '">전화</a><a class="btn btn--ghost btn--sm" href="sms:' + h(telHref(x.phone)) + '">문자</a>' : "") + (x.email ? '<a class="btn btn--ghost btn--sm" href="mailto:' + h(x.email) + '?subject=' + encodeURIComponent("[코어무드] 상담 신청 회신드립니다") + '">메일</a>' : "") + '<button class="btn btn--ghost btn--sm" id="d-copy">내용 복사</button></div>' +
          '<dl class="kv">' + row("접수", fmtDT(x.createdAt) + " · " + (x.type || "") + (x.channel && x.type === "직접 등록" ? " (" + x.channel + ")" : "")) + row("연락처", x.phone) + row("이메일", x.email) + row("업종", x.biz) + row("지역", x.region) +
          row("면적", x.area ? x.area + (/평|㎡/.test(x.area) ? "" : "평") : "") + row("희망 사양", x.grade) + row("오픈 시기", x.open) + row("예산", x.budget) + row("진행 상태", x.stage) + row("관심 서비스", (x.svc || []).join(", ")) + row("남긴 말", x.note) + "</dl>" +
          '<details class="src"><summary>유입 경로 · ' + h(sourceLabel(x)) + '</summary><dl class="kv" style="margin-top:8px">' + row("첫 방문", x.landing) + row("이전 사이트", x.ref) + row("캠페인", x.utm) + row("접수 페이지", x.page) + "</dl></details>" +
          '<div class="grid g2" style="margin-top:16px"><div class="f"><label for="d-st">진행 상태</label><select class="sel" id="d-st">' + INQ_ST.map(function (s) { return '<option value="' + s[0] + '"' + (x.status === s[0] ? " selected" : "") + ">" + s[1] + "</option>"; }).join("") + "</select></div>" +
          '<div class="f"><label for="d-fu">다음 연락일</label><input class="in" type="date" id="d-fu" value="' + h(x.followUp || "") + '"></div></div>' +
          '<div class="f"><label for="d-quote">견적·계약 메모 <small>예: 1차 견적 4,800만 원(부가세 별도)</small></label><input class="in" id="d-quote" value="' + h(x.quote || "") + '"></div>' +
          '<div class="f"><label for="d-memo">고객 메모 <small>현장 조건, 특이 사항</small></label><textarea class="ta" id="d-memo" style="min-height:80px">' + h(x.memo || "") + "</textarea></div>" +
          '<div class="f"><label for="d-note">상담 기록 추가 <small>저장하면 아래 기록에 쌓입니다</small></label><textarea class="ta" id="d-note" style="min-height:64px" placeholder="예: 10/28 통화 — 11월 둘째 주 현장 실측 약속"></textarea></div>' +
          '<div class="row" style="margin-top:12px;justify-content:space-between"><button class="btn" id="d-save">저장</button><button class="btn btn--danger btn--sm" id="d-del">삭제</button></div>' +
          '<h2 style="margin-top:22px">상담 기록</h2><div id="d-log"><div class="tiny">불러오는 중…</div></div>';
        api("/api/admin/inquiries?id=" + encodeURIComponent(x.id)).then(function (r) { drawLog(r.ok ? r.notes : []); });
        function drawLog(notes) {
          var el = $("#d-log"); if (!el) return;
          el.innerHTML = notes && notes.length ? '<ul class="log">' + notes.map(function (n) { return '<li class="log__' + h(n.kind) + '"><span class="log__at">' + fmtDT(n.at) + (n.by ? " · " + h(n.by) : "") + "</span>" + h(n.text) + "</li>"; }).join("") + "</ul>" : '<div class="tiny">아직 기록이 없습니다.</div>';
        }
        $("#d-copy").addEventListener("click", function () {
          var t = ["[코어무드 문의] " + x.name + " · " + x.phone, x.biz && "업종: " + x.biz, x.region && "지역: " + x.region, x.area && "면적: " + x.area, x.open && "오픈: " + x.open, x.budget && "예산: " + x.budget, x.note && "내용: " + x.note].filter(Boolean).join("\n");
          (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast("복사했습니다."); }).catch(function () { toast("복사하지 못했습니다.", true); });
        });
        $("#d-save").addEventListener("click", function () {
          busy("저장하는 중");
          api("/api/admin/inquiries", { method: "PATCH", body: { id: x.id, status: $("#d-st").value, followUp: $("#d-fu").value, quote: $("#d-quote").value, memo: $("#d-memo").value, note: $("#d-note").value } }).then(function (res) {
            busy(); if (!res.ok) return toast("저장하지 못했습니다.", true);
            Object.assign(x, res.item); toast("저장했습니다.");
            S.server.newInq = items.filter(function (y) { return y.status === "new"; }).length;
            draw(); drawLog(res.notes);
          });
        });
        $("#d-del").addEventListener("click", function () {
          if (!confirm((x.name || "이") + " 님의 문의를 삭제할까요? 되돌릴 수 없습니다.")) return;
          api("/api/admin/inquiries?id=" + encodeURIComponent(x.id), { method: "DELETE" }).then(function (res) {
            if (!res.ok) return toast("삭제하지 못했습니다.", true);
            items = items.filter(function (y) { return y.id !== x.id; }); S.inq.items = items; sel = null; history.replaceState(null, "", "#/inquiries"); toast("삭제했습니다."); draw();
          });
        });
      }
      draw();
      $("#i-csv").addEventListener("click", function () {
        var cols = [["createdAt", "접수일시"], ["type", "경로"], ["channel", "채널"], ["status", "상태"], ["name", "성함"], ["phone", "연락처"], ["email", "이메일"], ["biz", "업종"], ["region", "지역"], ["area", "면적"], ["grade", "사양"], ["open", "오픈 시기"], ["budget", "예산"], ["stage", "진행 상태"], ["svc", "관심 서비스"], ["note", "남긴 말"], ["followUp", "다음 연락일"], ["quote", "견적 메모"], ["memo", "고객 메모"], ["landing", "첫 방문"], ["ref", "이전 사이트"], ["utm", "캠페인"]];
        var qq = function (v) { return '"' + String(v == null ? "" : Array.isArray(v) ? v.join(", ") : v).replace(/"/g, '""') + '"'; };
        var csv = "﻿" + cols.map(function (c) { return qq(c[1]); }).join(",") + "\n" + items.filter(match).map(function (x) { return cols.map(function (c) { return qq(c[0] === "createdAt" ? fmtDT(x[c[0]]) : c[0] === "status" ? inqLabel(x.status) : x[c[0]]); }).join(","); }).join("\n");
        var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "coremood-inquiries-" + todayKST() + ".csv"; a.click();
      });
      $("#i-add").addEventListener("click", function () { addInquiryModal(function (it) { items.unshift(it); S.inq.items = items; sel = it.id; draw(); }); });
    });
  }
  function addInquiryModal(done) {
    var m = document.createElement("div"); m.className = "modal";
    m.innerHTML = '<div class="modal__box" style="max-width:640px"><div class="modal__h"><h2 style="font-size:1.05rem">문의 직접 등록</h2><button class="btn btn--ghost btn--sm" data-x>닫기</button></div>' +
      '<p class="small muted" style="margin-bottom:12px">전화·카카오톡·소개로 들어온 문의도 여기에 등록해 두면 홈페이지 문의와 같은 목록에서 관리됩니다.</p>' +
      '<div class="grid g2"><div class="f"><label>성함</label><input class="in" name="name"></div><div class="f"><label>연락처</label><input class="in" name="phone"></div>' +
      '<div class="f"><label>들어온 경로</label><select class="sel" name="channel">' + CHANNELS.map(function (c) { return "<option>" + c + "</option>"; }).join("") + '</select></div><div class="f"><label>업종</label><select class="sel" name="biz"><option value="">선택</option>' + BIZ_OPTS.map(function (c) { return "<option>" + c + "</option>"; }).join("") + "</select></div>" +
      '<div class="f"><label>지역</label><input class="in" name="region"></div><div class="f"><label>면적</label><input class="in" name="area" placeholder="예: 30평"></div>' +
      '<div class="f"><label>상태</label><select class="sel" name="status">' + INQ_ST.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === "contacted" ? " selected" : "") + ">" + s[1] + "</option>"; }).join("") + '</select></div><div class="f"><label>다음 연락일</label><input class="in" type="date" name="followUp"></div></div>' +
      '<div class="f"><label>내용</label><textarea class="ta" name="note"></textarea></div>' +
      '<div class="row" style="margin-top:14px"><button class="btn" data-save>등록</button></div></div>';
    document.body.appendChild(m);
    var close = function () { m.remove(); };
    $("[data-x]", m).addEventListener("click", close);
    $("[data-save]", m).addEventListener("click", function () {
      var v = function (n) { return $('[name="' + n + '"]', m).value.trim(); };
      if (!v("name") && !v("phone")) return toast("성함이나 연락처 중 하나는 입력해 주세요.", true);
      busy("등록하는 중");
      api("/api/admin/inquiries", { method: "POST", body: { name: v("name"), phone: v("phone"), channel: v("channel"), biz: v("biz"), region: v("region"), area: v("area"), status: v("status"), followUp: v("followUp"), note: v("note") } }).then(function (r) {
        busy(); if (!r.ok) return toast("등록하지 못했습니다.", true);
        close(); toast("등록했습니다."); done(r.item);
      });
    });
  }

  /* ---------- cases (시공 사례) ---------- */
  var EST_BIZ = { "": "연결 안 함", cafe: "카페 · 베이커리", dining: "음식점 · 주점", bar: "바 · 라운지", retail: "리테일 · 쇼룸", office: "오피스", study: "스터디카페 · 학원", beauty: "미용 · 뷰티", stay: "숙박 · 스테이", party: "파티룸 · 스튜디오" };
  function casesView() {
    var list = cases().slice().sort(function (a, b) { return (a.order || 99) - (b.order || 99); });
    var body = '<div class="panel"><p class="small muted" style="margin-bottom:12px">시공 사례마다 검색에 잡히는 개별 페이지(/projects/…)가 만들어지고, ‘대표 사례’로 고른 사례는 홈과 프로젝트 페이지의 전후 비교 슬라이더에 나옵니다. 숫자가 작을수록 앞에 보입니다.</p>' +
      '<div class="tblwrap"><table class="tbl"><thead><tr><th></th><th>사례</th><th class="hide-m">공정</th><th>순서</th><th>표시</th><th></th></tr></thead><tbody>' +
      (list.map(function (c) {
        return '<tr class="click" data-go="#/case/' + encodeURIComponent(c.slug) + '"><td style="width:84px"><img class="thumb" src="' + h(c.after) + '" alt=""></td><td class="t">' + h(c.title) + "<span>" + h(c.biz) + " · " + h(c.region) + ' · /projects/' + h(c.slug) + '</span></td><td class="hide-m">' + (c.scope || []).length + "개</td><td>" + (c.order || "-") + "</td><td>" +
          (c.draft ? '<span class="badge draft">숨김</span>' : c.featured !== false ? '<span class="badge live">대표 사례</span>' : '<span class="badge">공개</span>') + '</td><td><a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="/projects/' + h(c.slug) + '">보기 ↗</a></td></tr>';
      }).join("") || '<tr><td colspan="6"><div class="empty">등록된 사례가 없습니다.</div></td></tr>') + "</tbody></table></div></div>";
    shell("cases", "시공 사례", "실제 시공한 현장의 전후 사진과 작업 내용을 관리합니다.", '<a class="btn" href="#/case/new">새 사례 추가</a>', body);
    bindGo();
  }
  function cropToWebp(file, W, H) {
    return createImageBitmap(file).then(function (bmp) {
      var r = Math.max(W / bmp.width, H / bmp.height), sw = W / r, sh = H / r;
      var c = document.createElement("canvas"); c.width = W; c.height = H;
      c.getContext("2d").drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, W, H);
      return new Promise(function (res) { c.toBlob(function (b) { res(b); }, "image/webp", 0.82); }).then(function (blob) {
        return blob.arrayBuffer().then(function (buf) { return { bytes: new Uint8Array(buf), url: URL.createObjectURL(blob) }; });
      });
    });
  }
  function pickFiles(multi, cb) {
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = !!multi;
    inp.onchange = function () { if (inp.files && inp.files.length) cb(Array.prototype.slice.call(inp.files)); };
    inp.click();
  }
  function caseEditor(slug) {
    var isNew = slug === "new";
    var src = isNew ? null : cases().filter(function (c) { return c.slug === slug; })[0];
    if (!isNew && !src) { toast("사례를 찾을 수 없습니다.", true); location.hash = "#/cases"; return; }
    var c = JSON.parse(JSON.stringify(src || { title: "", slug: "", biz: "", industry: "", estimateBiz: "", region: "", scope: [], summary: "", story: "## 현장 조건\n\n처음 현장의 상태와 이 공간에서 먼저 풀어야 했던 조건을 씁니다.\n\n## 진행한 작업\n\n실제로 진행한 공정과 그렇게 정한 이유를 씁니다.\n", before: "", after: "", gallery: [], featured: true, order: cases().length + 1, draft: true }));
    var pend = {}; // 경로 → {bytes,url}
    var url = function (p) { return pend[p] ? pend[p].url : p; };
    var token = Date.now().toString(36);
    function galHtml() {
      return (c.gallery || []).map(function (g, i) {
        return '<div class="cg"><img src="' + h(url(g.src)) + '" alt=""><select class="sel" data-gk="' + i + '"><option value="before"' + (g.kind === "before" ? " selected" : "") + '>시공 전</option><option value="after"' + (g.kind !== "before" ? " selected" : "") + '>시공 후</option></select><input class="in" data-ga="' + i + '" value="' + h(g.alt || "") + '" placeholder="사진 설명"><div class="row"><button class="btn btn--ghost btn--sm" data-gu="' + i + '" type="button">↑</button><button class="btn btn--danger btn--sm" data-gd="' + i + '" type="button">빼기</button></div></div>';
      }).join("") || '<div class="empty">추가 사진이 없습니다.</div>';
    }
    var body = '<div class="ed"><div><div class="panel"><div class="grid g2">' +
      '<div class="f"><label for="c-title">사례 이름 <small>예: 신촌 미용실</small></label><input class="in" id="c-title" value="' + h(c.title) + '"></div>' +
      '<div class="f"><label for="c-slug">주소 (영문) <small>/projects/…</small></label><input class="in" id="c-slug" value="' + h(c.slug) + '" placeholder="sinchon-hair-salon"></div>' +
      '<div class="f"><label for="c-biz">업종 표기 <small>예: 미용실</small></label><input class="in" id="c-biz" value="' + h(c.biz) + '"></div>' +
      '<div class="f"><label for="c-region">지역 <small>예: 서울 신촌</small></label><input class="in" id="c-region" value="' + h(c.region) + '"></div></div>' +
      '<div class="f"><label for="c-scope">공정 범위 <small>쉼표로 구분 — 예: 철거, 목공, 전기</small></label><input class="in" id="c-scope" value="' + h((c.scope || []).join(", ")) + '"></div>' +
      '<div class="f"><label for="c-sum">한 줄 소개 (검색 결과·카드에 보임) <small id="cc-sum"></small></label><textarea class="ta" id="c-sum" style="min-height:70px">' + h(c.summary) + "</textarea></div></div>" +
      '<div class="panel"><h2>시공 전후 대표 사진 <small>3:2 비율로 맞춰 올라갑니다</small></h2><div class="grid g2">' +
      '<div><div class="cover"><img id="c-bimg" src="' + h(url(c.before)) + '" alt=""></div><div class="row" style="margin-top:8px"><span class="badge">Before</span><button class="btn btn--ghost btn--sm" id="c-bup" type="button">시공 전 사진 올리기</button></div></div>' +
      '<div><div class="cover"><img id="c-aimg" src="' + h(url(c.after)) + '" alt=""></div><div class="row" style="margin-top:8px"><span class="badge live">After</span><button class="btn btn--ghost btn--sm" id="c-aup" type="button">시공 후 사진 올리기</button></div></div></div></div>' +
      '<div class="panel"><h2>현장 이야기 <small>## 소제목으로 나눠 씁니다</small></h2>' + toolbar("c-story") + '<textarea class="ta ta--code" id="c-story" style="min-height:340px" spellcheck="false">' + h(c.story) + "</textarea></div>" +
      '<div class="panel"><h2>추가 사진 <small><button class="link" type="button" id="c-gup">사진 여러 장 올리기</button></small></h2><div class="cgrid-ed" id="c-gal">' + galHtml() + "</div></div></div>" +
      '<div class="ed__side"><div class="panel"><h2>설정</h2>' +
      '<div class="f"><label for="c-ind">연결할 업종 페이지</label><select class="sel" id="c-ind"><option value="">연결 안 함</option>' + CM.INDUSTRIES.map(function (x) { return '<option value="' + x.slug + '"' + (c.industry === x.slug ? " selected" : "") + ">" + x.name + "</option>"; }).join("") + "</select></div>" +
      '<div class="f"><label for="c-est">견적 계산 업종</label><select class="sel" id="c-est">' + Object.keys(EST_BIZ).map(function (k) { return '<option value="' + k + '"' + ((c.estimateBiz || "") === k ? " selected" : "") + ">" + EST_BIZ[k] + "</option>"; }).join("") + "</select></div>" +
      '<div class="f"><label for="c-order">순서 <small>작을수록 앞</small></label><input class="in" type="number" id="c-order" value="' + h(c.order || 1) + '"></div>' +
      '<div class="f"><label class="switch"><input type="checkbox" id="c-feat"' + (c.featured !== false ? " checked" : "") + '><i></i><span>대표 사례 (전후 슬라이더에 표시)</span></label></div>' +
      '<div class="f"><label class="switch"><input type="checkbox" id="c-pub"' + (c.draft ? "" : " checked") + '><i></i><span>공개 (끄면 숨김)</span></label></div>' +
      '<div class="row" style="margin-top:14px"><button class="btn" id="c-save">저장하고 반영</button>' + (isNew ? "" : '<a class="btn btn--ghost" target="_blank" rel="noopener" href="/projects/' + h(c.slug) + '">사이트에서 보기</a>') + "</div>" +
      (isNew ? "" : '<div style="margin-top:14px"><button class="btn btn--danger btn--sm" id="c-del">이 사례 삭제</button></div>') + "</div>" +
      '<div class="panel"><h2>점검</h2><div id="c-audit"></div></div>' +
      '<div class="panel"><h2>미리보기</h2><button class="btn btn--ghost btn--sm" id="c-pv" type="button">사례 페이지 미리보기</button></div></div></div>';
    shell("cases", isNew ? "새 시공 사례" : c.title + " 수정", '<a href="#/cases">← 시공 사례 목록</a>', "", body);
    function read() {
      c.title = $("#c-title").value.trim(); c.slug = $("#c-slug").value.trim().toLowerCase(); c.biz = $("#c-biz").value.trim(); c.region = $("#c-region").value.trim();
      c.scope = $("#c-scope").value.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      c.summary = $("#c-sum").value.replace(/\s+/g, " ").trim(); c.story = $("#c-story").value;
      c.industry = $("#c-ind").value; c.estimateBiz = $("#c-est").value; c.order = parseInt($("#c-order").value, 10) || 99;
      c.featured = $("#c-feat").checked; c.draft = !$("#c-pub").checked;
      if (!c.key) c.key = c.slug;
      return c;
    }
    function check() {
      read();
      var a = [], add = function (l, t) { a.push([l, t]); };
      add(c.title ? "ok" : "bad", "사례 이름");
      add(/^[a-z0-9-]+$/.test(c.slug) ? "ok" : "bad", "영문 주소 (소문자·숫자·하이픈)");
      add(c.biz && c.region ? "ok" : "bad", "업종 표기와 지역");
      var sl = c.summary.length; add(sl >= 60 && sl <= 160 ? "ok" : sl ? "warn" : "bad", "한 줄 소개 " + sl + "자 (권장 60~160자)");
      add(c.before && c.after ? "ok" : "bad", "시공 전·후 대표 사진");
      add(c.scope.length ? "ok" : "warn", "공정 범위 " + c.scope.length + "개");
      var len = CM.textLength(c.story); add(len >= 300 ? "ok" : "warn", "현장 이야기 " + len + "자 (공백 제외 300자 이상 권장)");
      var bad = audit("case", { title: c.title, description: c.summary, keyword: c.biz }, c.story).filter(function (x) { return x[0] === "bad" && /표현|법인명|브랜드명|실적|별도 확인|블록/.test(x[1]); });
      a = a.concat(bad);
      $("#cc-sum").textContent = sl + "자"; $("#cc-sum").className = "cnt " + (sl >= 60 && sl <= 160 ? "ok" : "warn");
      $("#c-audit").innerHTML = auditHtml(a);
      return a.filter(function (x) { return x[0] === "bad"; });
    }
    $$(".ed input,.ed textarea,.ed select").forEach(function (el) { el.addEventListener("input", check); el.addEventListener("change", check); });
    check();
    function redrawGal() {
      $("#c-gal").innerHTML = galHtml();
      $$("[data-gk]").forEach(function (s) { s.addEventListener("change", function () { c.gallery[+s.dataset.gk].kind = s.value; }); });
      $$("[data-ga]").forEach(function (s) { s.addEventListener("input", function () { c.gallery[+s.dataset.ga].alt = s.value; }); });
      $$("[data-gd]").forEach(function (b) { b.addEventListener("click", function () { c.gallery.splice(+b.dataset.gd, 1); redrawGal(); }); });
      $$("[data-gu]").forEach(function (b) { b.addEventListener("click", function () { var i = +b.dataset.gu; if (i > 0) { var t = c.gallery[i - 1]; c.gallery[i - 1] = c.gallery[i]; c.gallery[i] = t; redrawGal(); } }); });
    }
    redrawGal();
    var keyOf = function () { return (read().slug || "case") + "-" + token; };
    ["b", "a"].forEach(function (k) {
      $("#c-" + k + "up").addEventListener("click", function () {
        pickFiles(false, function (fs) {
          busy("사진을 맞추는 중");
          cropToWebp(fs[0], 1200, 800).then(function (r) {
            busy();
            var p = "/assets/img/cases/" + keyOf() + "-" + (k === "b" ? "before" : "after") + "-main.webp";
            pend[p] = r; c[k === "b" ? "before" : "after"] = p; $("#c-" + k + "img").src = r.url; check();
          }).catch(function () { busy(); toast("사진을 읽지 못했습니다.", true); });
        });
      });
    });
    $("#c-gup").addEventListener("click", function () {
      pickFiles(true, function (fs) {
        busy("사진 " + fs.length + "장을 줄이는 중");
        var n = 0;
        fs.reduce(function (pr, f) {
          return pr.then(function () {
            return resizeToWebp(f, 1200).then(function (r) {
              n++;
              var p = "/assets/img/cases/" + keyOf() + "-g" + Date.now().toString(36) + n + ".webp";
              pend[p] = r; c.gallery.push({ src: p, kind: "after", alt: (read().title || "시공") + " 사진" });
            });
          });
        }, Promise.resolve()).then(function () { busy(); redrawGal(); toast("시공 전/후 구분과 사진 설명을 확인해 주세요."); }).catch(function () { busy(); toast("일부 사진을 읽지 못했습니다.", true); redrawGal(); });
      });
    });
    bindToolbar(function () { toast("사진은 ‘추가 사진’에서 올려 주세요.", true); });
    $("#c-pv").addEventListener("click", function () {
      read();
      var html = CM.renderCase(c, { posts: livePosts(), cases: cases() });
      Object.keys(pend).forEach(function (p) { html = html.split(p).join(pend[p].url); });
      var m = document.createElement("div"); m.className = "modal";
      m.innerHTML = '<div class="modal__box"><div class="modal__h"><strong>미리보기</strong><button class="btn btn--ghost btn--sm" data-x>닫기</button></div><iframe class="pv" title="미리보기"></iframe></div>';
      document.body.appendChild(m); $("iframe", m).srcdoc = html; $("[data-x]", m).addEventListener("click", function () { m.remove(); });
    });
    $("#c-save").addEventListener("click", function () {
      var bad = check();
      if (bad.length) return toast("고칠 항목이 있습니다: " + bad.map(function (x) { return x[1]; }).join(", "), true);
      var all = cases();
      if (all.some(function (x) { return x.slug === c.slug && x !== src; })) return toast("같은 주소의 사례가 이미 있습니다.", true);
      saveCase(c, src, pend);
    });
    var del = $("#c-del");
    if (del) del.addEventListener("click", function () {
      if (!confirm("‘" + src.title + "’ 사례를 삭제할까요? 사례 페이지도 사라집니다. (사진 파일은 저장소에 남습니다)")) return;
      saveCase(null, src, {});
    });
  }
  function saveCase(c, src, pend) {
    busy("저장하는 중입니다 (최신 상태 확인)");
    Promise.all([getJson("data/cases.json", { cases: [] }), getJson("content/index.json", { posts: [], industries: [] }), getText("index.html"), getText("portfolio.html")]).then(function (r) {
      var doc = r[0], idx = r[1], home = r[2].text, port = r[3].text;
      var list = (doc.cases || []).filter(function (x) { return !src || x.slug !== src.slug; });
      if (c) { c.updated = new Date().toISOString(); list.push(c); }
      list.sort(function (a, b) { return (a.order || 99) - (b.order || 99); });
      doc.cases = list;
      var ctx = { posts: livePosts(idx.posts), cases: list, now: Date.now() };
      var files = [{ path: "data/cases.json", content: JSON.stringify(doc, null, 1) + "\n" }];
      Object.keys(pend).forEach(function (p) {
        var used = c && (c.before === p || c.after === p || (c.gallery || []).some(function (g) { return g.src === p; }));
        if (used) files.push({ path: p.slice(1), bytes: pend[p].bytes });
      });
      if (c && !c.draft) files.push({ path: "projects/" + c.slug + ".html", content: CM.renderCase(c, ctx) });
      if (src && !src.draft && (!c || c.draft || c.slug !== src.slug)) files.push({ path: "projects/" + src.slug + ".html", delete: true });
      files.push({ path: "index.html", content: CM.injectPartials(home, "index", { cases: list, pageMeta: S.pages.pages.index }) });
      files.push({ path: "portfolio.html", content: CM.injectPartials(port, "portfolio", { cases: list, pageMeta: S.pages.pages.portfolio }) });
      files.push({ path: "sitemap.xml", content: CM.renderSitemap(ctx) });
      // 이 사례를 쓰는 업종 페이지 다시 만들기
      var keys = [c && c.key, c && c.slug, src && src.key, src && src.slug].filter(Boolean);
      var inds = [c && c.industry, src && src.industry].filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
      return Promise.all(inds.map(function (slug) {
        return getText("content/industries/" + slug + ".md").then(function (t) {
          var fm = CM.parseFront(t.text);
          if (keys.indexOf(fm.data.ba) >= 0) { fm.data.slug = slug; files.push({ path: "industries/" + slug + ".html", content: CM.renderIndustry(fm.data, fm.body, ctx) }); }
        }).catch(function () {});
      })).then(function () {
        busy("GitHub에 반영하는 중");
        return commit(files, "cases: " + (c ? (src ? "수정 " : "추가 ") + c.title : "삭제 " + src.title));
      }).then(function () {
        S.casesDoc = doc; busy();
        toast(c ? "저장했습니다. 1~2분 뒤 사이트에 반영됩니다." : "삭제했습니다.");
        if (c && !c.draft) pingIndex([SITE.url + "/projects/" + c.slug, SITE.url + "/portfolio"], true);
        location.hash = c ? "#/case/" + encodeURIComponent(c.slug) : "#/cases";
        if (c && src && c.slug === src.slug) route();
      });
    }).catch(function (e) { busy(); toast("저장하지 못했습니다: " + e.message, true); });
  }

  /* ---------- image library ---------- */
  function imagesView() {
    var list = S.images || [];
    var f = imagesView.q || "";
    var body = '<div class="panel"><div class="bar"><input class="in" id="im-q" style="max-width:280px" placeholder="설명·태그 검색" value="' + h(f) + '"><span class="tiny">' + list.length + '장 · 저널 글과 업종 페이지의 대표 이미지 후보입니다.</span></div><div class="imgrid" id="im-g"></div></div>';
    shell("images", "이미지", "대표 이미지 라이브러리와 사진 설명(alt)을 관리합니다. 사진 설명은 검색엔진 이미지 검색에 쓰입니다.", '<button class="btn" id="im-up">이미지 올리기</button>', body);
    var dirty = false;
    function draw() {
      var q = ($("#im-q").value || "").toLowerCase(); imagesView.q = q;
      $("#im-g").innerHTML = list.map(function (im, i) {
        if (q && (im.alt + " " + (im.tags || []).join(" ") + " " + im.src).toLowerCase().indexOf(q) < 0) return "";
        return '<div class="imc"><img src="' + h(im._url || im.src) + '" alt="" loading="lazy"><div class="imc__b"><input class="in" data-alt="' + i + '" value="' + h(im.alt) + '" placeholder="사진 설명"><input class="in" data-tags="' + i + '" value="' + h((im.tags || []).join(", ")) + '" placeholder="태그 (쉼표)"><div class="row" style="justify-content:space-between"><span class="tiny">' + h(im.type === "photo" ? "실제 시공" : im.type === "direction" ? "스타일 시안" : "분위기") + " · " + h(im.src.split("/").pop()) + '</span><button class="link" data-copy="' + h(im.src) + '">경로 복사</button></div></div></div>';
      }).join("");
      $$("[data-alt]").forEach(function (el) { el.addEventListener("input", function () { list[+el.dataset.alt].alt = el.value; markDirty(); }); });
      $$("[data-tags]").forEach(function (el) { el.addEventListener("input", function () { list[+el.dataset.tags].tags = el.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean); markDirty(); }); });
      $$("[data-copy]").forEach(function (b) { b.addEventListener("click", function () { if (navigator.clipboard) navigator.clipboard.writeText(b.dataset.copy).then(function () { toast("경로를 복사했습니다."); }); }); });
    }
    function markDirty() {
      if (dirty) return; dirty = true;
      var acts = $(".top .acts"); acts.insertAdjacentHTML("afterbegin", '<button class="btn btn--olive" id="im-save">변경 내용 저장</button>');
      $("#im-save").addEventListener("click", save);
    }
    var pendImg = [];
    function save() {
      busy("저장하는 중");
      var doc = S.imagesDoc || { images: [] };
      doc.images = list.map(function (im) { var o = Object.assign({}, im); delete o._url; return o; });
      var files = pendImg.map(function (p) { return { path: p.path, bytes: p.bytes }; });
      files.push({ path: "data/images.json", content: JSON.stringify(doc, null, 2) + "\n" });
      commit(files, "images: 이미지 라이브러리 수정").then(function () { busy(); pendImg = []; dirty = false; S.imagesDoc = doc; toast("저장했습니다."); imagesView(); })
        .catch(function (e) { busy(); toast("저장하지 못했습니다: " + e.message, true); });
    }
    $("#im-q").addEventListener("input", draw);
    $("#im-up").addEventListener("click", function () {
      pickFiles(true, function (fs) {
        busy("이미지를 웹용으로 줄이는 중");
        fs.reduce(function (pr, f) {
          return pr.then(function () {
            return resizeToWebp(f, 1600).then(function (r) {
              var name = "lib-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + ".webp";
              var path = "assets/img/library/" + name;
              pendImg.push({ path: path, bytes: r.bytes });
              list.unshift({ src: "/" + path, w: r.w, h: r.h, type: "mood", alt: "", tags: [], _url: r.url });
            });
          });
        }, Promise.resolve()).then(function () { busy(); draw(); markDirty(); toast("사진 설명을 적은 뒤 ‘변경 내용 저장’을 눌러 주세요."); });
      });
    });
    draw();
  }

  /* ---------- page SEO ---------- */
  function pagesView() {
    var P = (S.pages && S.pages.pages) || {};
    var keys = Object.keys(P).filter(function (k) { return k !== "404"; });
    var body = '<div class="panel"><p class="small muted" style="margin-bottom:14px">홈, 브랜드, 서비스 같은 기본 페이지가 검색 결과에 어떤 제목과 설명으로 보일지 정합니다. 저장하면 해당 페이지의 &lt;head&gt;만 다시 만들어집니다.</p>' +
      keys.map(function (k) {
        var m = P[k];
        return '<div class="panel" style="background:var(--bg)"><h2>' + h(m.name) + ' <small><a href="' + h(m.path) + '" target="_blank" rel="noopener">' + h(m.path) + " ↗</a></small></h2>" +
          '<div class="f"><label>검색 결과 제목 <small class="cnt" data-c="t-' + k + '"></small></label><input class="in" data-k="' + k + '" data-f="title" value="' + h(m.title) + '"></div>' +
          '<div class="f"><label>검색 결과 설명 <small class="cnt" data-c="d-' + k + '"></small></label><textarea class="ta" style="min-height:70px" data-k="' + k + '" data-f="description">' + h(m.description) + "</textarea></div>" +
          '<div class="row" style="margin-top:10px"><button class="btn btn--sm" data-save="' + k + '">이 페이지 저장</button></div></div>';
      }).join("") + "</div>";
    shell("pages", "페이지 SEO", "검색엔진에 보이는 기본 페이지의 제목과 설명", "", body);
    function cnt() {
      $$("[data-k]").forEach(function (el) {
        var n = el.value.length, k = el.dataset.k, t = el.dataset.f === "title";
        var c = $('[data-c="' + (t ? "t-" : "d-") + k + '"]');
        c.textContent = n + "자"; c.className = "cnt " + ((t ? n <= 45 : n >= 80 && n <= 160) ? "ok" : "warn");
      });
    }
    $$("[data-k]").forEach(function (el) { el.addEventListener("input", cnt); }); cnt();
    $$("[data-save]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.dataset.save, m = P[k];
        m.title = $('[data-k="' + k + '"][data-f="title"]').value.trim();
        m.description = $('[data-k="' + k + '"][data-f="description"]').value.replace(/\s+/g, " ").trim();
        busy("저장하는 중");
        getText(m.file).then(function (r) {
          var html = CM.injectPartials(r.text, k, { pageMeta: m });
          return commit([{ path: "data/pages.json", content: JSON.stringify(S.pages, null, 2) + "\n" }, { path: m.file, content: html }], "seo: " + m.name + " 제목·설명 수정");
        }).then(function () { busy(); toast("저장했습니다. 1~2분 뒤 반영됩니다."); pingIndex([SITE.url + (m.path === "/" ? "/" : m.path)], true); })
          .catch(function (e) { busy(); toast("저장하지 못했습니다: " + e.message, true); });
      });
    });
  }

  /* ---------- settings ---------- */
  function settingsView() {
    var n = (S.site && S.site.notice) || {};
    var vf = (S.site && S.site.verify) || {};
    var oq = (S.site && S.site.quick) || {}, ok = (S.site && S.site.kakao) || {}, oa = (S.site && S.site.analytics) || {}, ots = (S.site && S.site.turnstile) || {};
    var recent = livePosts().slice(0, 10).map(function (p) { return SITE.url + "/journal/" + p.slug; });
    var body = '<div class="grid g2" style="align-items:start"><div>' +
      '<div class="panel"><h2>상단 공지 띠</h2><p class="small muted" style="margin-bottom:12px">모든 페이지 맨 위에 한 줄 공지를 띄웁니다. 휴무 안내, 이벤트, 상담 일정 공지에 쓰세요.</p>' +
      '<label class="switch"><input type="checkbox" id="n-on"' + (n.enabled ? " checked" : "") + '><i></i><span>공지 띄우기</span></label>' +
      '<div class="f" style="margin-top:14px"><label for="n-text">공지 문구</label><input class="in" id="n-text" value="' + h(n.text || "") + '" placeholder="예: 12월 24일~26일은 휴무입니다. 상담 신청은 평소처럼 받습니다."></div>' +
      '<div class="grid g2" style="margin-top:12px"><div class="f"><label for="n-link">링크 주소 <small>선택</small></label><input class="in" id="n-link" value="' + h(n.link || "") + '" placeholder="/contact"></div><div class="f"><label for="n-lt">링크 글자</label><input class="in" id="n-lt" value="' + h(n.linkText || "") + '" placeholder="자세히 보기"></div></div>' +
      '<div class="row" style="margin-top:14px"><button class="btn" id="n-save">저장</button></div></div>' +
      '<div class="panel"><h2>상담 버튼 · 방문 분석 · 스팸 방지</h2>' +
      '<label class="switch"><input type="checkbox" id="o-quick"' + (oq.enabled !== false ? " checked" : "") + '><i></i><span>오른쪽 아래 ‘빠른 상담 신청’ 버튼 (PC)</span></label>' +
      '<div class="grid g2" style="margin-top:14px"><div class="f"><label for="o-kurl">카카오톡 채널 채팅 주소 <small>비우면 버튼 숨김</small></label><input class="in" id="o-kurl" value="' + h(ok.url || "") + '" placeholder="https://pf.kakao.com/_xxxx/chat"></div>' +
      '<div class="f"><label for="o-klabel">버튼 글자</label><input class="in" id="o-klabel" value="' + h(ok.label || "") + '" placeholder="카카오톡 상담"></div>' +
      '<div class="f"><label for="o-ga">구글 애널리틱스 측정 ID</label><input class="in" id="o-ga" value="' + h(oa.ga4 || "") + '" placeholder="G-XXXXXXXXXX"></div>' +
      '<div class="f"><label for="o-nv">네이버 애널리틱스 ID</label><input class="in" id="o-nv" value="' + h(oa.naver || "") + '" placeholder="예: 1a2b3c4d5e6f7"></div></div>' +
      '<div class="f"><label for="o-ts">스팸 방지 Turnstile 사이트 키 <small>비밀 키는 Cloudflare 변수 TURNSTILE_SECRET에</small></label><input class="in" id="o-ts" value="' + h(ots.siteKey || "") + '" placeholder="0x4AAAAAAA..."></div>' +
      '<div class="row" style="margin-top:14px"><button class="btn" id="o-save">저장</button><a class="btn btn--ghost" href="#/setup">설정 방법 보기</a></div></div>' +
      '<div class="panel"><h2>검색엔진에 바로 알리기 <small>IndexNow · 네이버 · 빙</small></h2><p class="small muted" style="margin-bottom:10px">새 글이나 고친 페이지 주소를 검색엔진에 즉시 알립니다. 글을 저장할 때 자동으로도 보냅니다. 한 줄에 주소 하나.</p>' +
      '<textarea class="ta" id="ix" style="min-height:150px">' + h(recent.join("\n")) + '</textarea><div class="row" style="margin-top:10px"><button class="btn btn--olive" id="ix-go">보내기</button></div></div></div>' +
      '<div><div class="panel"><h2>검색엔진 소유확인 <small>HTML 태그 방식 · 권장</small></h2><p class="small muted" style="margin-bottom:12px">네이버 서치어드바이저나 구글 서치 콘솔에서 ‘HTML 태그’를 고르면 나오는 메타 태그를 그대로 붙여 넣으세요. 홈페이지 &lt;head&gt;에 들어가고, 1~2분 뒤 소유확인 버튼을 누르면 됩니다.</p>' +
      '<div class="f"><label for="vt-naver">네이버 <small>' + (vf.naver ? "적용 중" : "미적용") + '</small></label><input class="in" id="vt-naver" value="' + h(vf.naver || "") + '" placeholder="&lt;meta name=&quot;naver-site-verification&quot; content=&quot;…&quot; /&gt;"></div>' +
      '<div class="f"><label for="vt-google">구글 <small>' + (vf.google ? "적용 중" : "미적용") + '</small></label><input class="in" id="vt-google" value="' + h(vf.google || "") + '" placeholder="&lt;meta name=&quot;google-site-verification&quot; content=&quot;…&quot; /&gt;"></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn" id="vt-save">소유확인 태그 저장</button><a class="btn btn--ghost" href="/" target="_blank" rel="noopener">홈 열기 ↗</a></div></div>' +
      '<div class="panel"><h2>소유확인 파일 <small>보조 방법</small></h2><p class="small muted" style="margin-bottom:12px">‘HTML 파일 업로드’ 방식용입니다. 호스팅(Cloudflare Pages)이 <code>.html</code> 주소를 확장자 없는 주소로 넘겨 주기 때문에 확인이 실패할 수 있습니다. 가능하면 위의 HTML 태그 방식을 쓰세요.</p>' +
      '<div class="f"><label for="v-name">파일 이름</label><input class="in" id="v-name" placeholder="예: naver1a2b3c....html 또는 google1a2b....html"></div>' +
      '<div class="f"><label for="v-body">파일 내용 <small>받은 파일을 메모장으로 열어 전체 복사</small></label><textarea class="ta" id="v-body" style="min-height:90px"></textarea></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn" id="v-save">사이트에 올리기</button><button class="btn btn--ghost" id="v-file">파일 선택</button></div><div id="v-list" class="tiny" style="margin-top:12px"></div></div>' +
      '<div class="panel"><h2>서버 기능 연결 상태</h2><p class="small">상담 문의 저장, 새 문의 알림, 스팸 방지 연결 상태는 <a href="#/setup">설정 점검</a>에서 확인합니다.</p></div></div></div>';
    shell("settings", "사이트 설정", "공지, 상담 버튼, 방문 분석, 스팸 방지, 검색엔진 등록", "", body);
    $("#n-save").addEventListener("click", function () {
      S.site = S.site || {};
      S.site.notice = { enabled: $("#n-on").checked, text: $("#n-text").value.trim(), link: $("#n-link").value.trim(), linkText: $("#n-lt").value.trim() };
      busy("저장하는 중");
      commit([{ path: "data/site.json", content: JSON.stringify(S.site, null, 2) + "\n" }], "site: 공지 " + (S.site.notice.enabled ? "설정" : "끄기"))
        .then(function () { busy(); toast("저장했습니다. 1~2분 뒤 반영됩니다."); }).catch(function (e) { busy(); toast("저장하지 못했습니다: " + e.message, true); });
    });
    $("#vt-save").addEventListener("click", function () {
      // 메타 태그 전체를 붙여 넣어도, content 값만 넣어도 됩니다
      var pick = function (v) { v = (v || "").trim(); var m = /content\s*=\s*["']([^"']+)["']/i.exec(v); return (m ? m[1] : v).replace(/[^A-Za-z0-9_\-]/g, ""); };
      var next = { naver: pick($("#vt-naver").value), google: pick($("#vt-google").value) };
      var home = S.pages && S.pages.pages && S.pages.pages.index;
      if (!home) return toast("홈 페이지 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.", true);
      busy("저장하는 중");
      getText("index.html").then(function (r) {
        S.site = S.site || {}; S.site.verify = next; CM.setVerify(next);
        var html = CM.injectPartials(r.text, "index", { pageMeta: home });
        return commit([{ path: "data/site.json", content: JSON.stringify(S.site, null, 2) + "\n" }, { path: "index.html", content: html }], "verify: 검색엔진 소유확인 태그 " + (next.naver || next.google ? "적용" : "삭제"));
      }).then(function () { busy(); toast("저장했습니다. 1~2분 뒤 홈에 반영되면 소유확인 버튼을 눌러 주세요."); settingsView(); })
        .catch(function (e) { busy(); toast("저장하지 못했습니다: " + e.message, true); });
    });
    $("#o-save").addEventListener("click", function () {
      var ku = $("#o-kurl").value.trim(), ga = $("#o-ga").value.trim().toUpperCase(), nv = $("#o-nv").value.trim(), tk = $("#o-ts").value.trim();
      if (ku && !/^https:\/\//.test(ku)) return toast("카카오톡 주소는 https:// 로 시작해야 합니다.", true);
      if (ga && !/^G-[A-Z0-9]+$/.test(ga)) return toast("구글 애널리틱스 측정 ID는 G- 로 시작합니다.", true);
      if (nv && !/^[a-z0-9]+$/i.test(nv)) return toast("네이버 애널리틱스 ID 형식을 확인해 주세요.", true);
      S.site = S.site || {};
      S.site.quick = { enabled: $("#o-quick").checked };
      S.site.kakao = { url: ku, label: $("#o-klabel").value.trim() };
      S.site.analytics = { ga4: ga, naver: nv };
      S.site.turnstile = { siteKey: tk };
      busy("저장하는 중");
      commit([{ path: "data/site.json", content: JSON.stringify(S.site, null, 2) + "\n" }], "site: 상담 버튼·방문 분석·스팸 방지 설정")
        .then(function () { busy(); toast(tk ? "저장했습니다. Cloudflare에 TURNSTILE_SECRET도 넣었는지 설정 점검에서 확인하세요." : "저장했습니다. 1~2분 뒤 반영됩니다."); })
        .catch(function (e) { busy(); toast("저장하지 못했습니다: " + e.message, true); });
    });
    $("#ix-go").addEventListener("click", function () {
      var urls = $("#ix").value.split(/\s+/).map(function (x) { return x.trim(); }).filter(function (x) { return x.indexOf(SITE.url) === 0; });
      if (!urls.length) return toast(SITE.url + " 로 시작하는 주소를 넣어 주세요.", true);
      pingIndex(urls);
    });
    $("#v-file").addEventListener("click", function () {
      var inp = document.createElement("input"); inp.type = "file"; inp.accept = ".html,.txt";
      inp.onchange = function () { var f = inp.files[0]; if (!f) return; $("#v-name").value = f.name; f.text().then(function (t) { $("#v-body").value = t; }); };
      inp.click();
    });
    $("#v-save").addEventListener("click", function () {
      var name = $("#v-name").value.trim(), txt = $("#v-body").value;
      if (!/^(naver|google|bing|BingSiteAuth)[A-Za-z0-9_.-]*\.(html|xml|txt)$/.test(name)) return toast("네이버·구글 소유확인 파일 이름 형식이 아닙니다.", true);
      if (!txt.trim()) return toast("파일 내용을 넣어 주세요.", true);
      busy("올리는 중");
      commit([{ path: name, content: txt }], "verify: " + name).then(function () { busy(); toast("올렸습니다. 1~2분 뒤 " + SITE.url + "/" + name + " 에서 확인됩니다."); listVerify(); })
        .catch(function (e) { busy(); toast("올리지 못했습니다: " + e.message, true); });
    });
    function listVerify() {
      listDir("").then(function (arr) {
        var v = (arr || []).filter(function (f) { return /^(naver|google|BingSiteAuth)/.test(f.name); });
        var el = $("#v-list"); if (el) el.innerHTML = v.length ? "올라가 있는 파일: " + v.map(function (f) { return '<a href="/' + h(f.name) + '" target="_blank">' + h(f.name) + "</a>"; }).join(", ") : "올라가 있는 소유확인 파일이 없습니다.";
      });
    }
    listVerify();
  }

  /* ---------- setup check (설정 점검) ---------- */
  function setupView() {
    var cfg = S.site || {};
    var ts = (cfg.turnstile && cfg.turnstile.siteKey) || "";
    var vf = cfg.verify || {};
    var mark = function (st) { return '<span class="ck ck--' + st + '">' + (st === "ok" ? "✓" : st === "warn" ? "!" : st === "off" ? "–" : "…") + "</span>"; };
    var body = '<div class="note" style="margin-bottom:16px">Cloudflare에서 한 번만 해 두면 되는 설정입니다. 각 항목의 상태는 실제 서버에서 확인한 결과이며, 설정을 바꾼 뒤에는 <b>Cloudflare에서 다시 배포</b>(Workers &amp; Pages → coremood → Deployments → 최신 배포 오른쪽 메뉴 → Retry deployment)해야 반영됩니다.</div>' +
      '<div class="setup">' +
      '<section class="panel su" id="su-db"><h2>' + mark("wait") + ' 1. 상담 문의 저장소 (Cloudflare D1) <small>필수</small></h2>' +
      '<p class="small">홈페이지의 상담 신청·빠른 문의를 저장하는 데이터베이스입니다. 연결 전에는 문의가 방문자의 메일 앱으로 넘어가 놓치기 쉽습니다. 무료 범위로 충분합니다.</p>' +
      '<ol class="steps"><li>여러 홈페이지가 함께 쓰는 공용 D1 데이터베이스 <code>total-db</code>를 씁니다. 새로 만들 필요가 없습니다.</li>' +
      "<li><b>Compute → Workers &amp; Pages</b> → <b>coremood</b> 프로젝트 → <b>Settings → Bindings → Add → D1 database</b>.</li>" +
      "<li>Variable name에 <code>DB</code>, D1 database에 <code>total-db</code>를 고르고 저장합니다.</li>" +
      "<li>Deployments에서 최신 배포를 <b>Retry deployment</b> 합니다. 코어무드 표(<code>cm_inquiries</code>, <code>cm_inquiry_notes</code>, <code>cm_auth_cache</code>)는 첫 요청 때 자동으로 만들어집니다.</li></ol>" +
      '<div class="note" style="margin-top:4px">total-db는 다른 홈페이지와 함께 쓰는 데이터베이스입니다. 코어무드 표는 모두 <code>cm_</code>로 시작하므로, 다른 사이트는 각자 다른 접두어를 쓰면 서로 겹치지 않습니다. total-db를 지우면 문의 기록도 함께 사라집니다.</div>' +
      '<div class="su__st" data-st="db"></div></section>' +
      '<section class="panel su" id="su-nt"><h2>' + mark("wait") + ' 2. 새 문의 알림 <small>권장 · 하나 이상</small></h2>' +
      '<p class="small">문의가 들어오면 바로 알 수 있게 합니다. 세 가지 중 편한 것을 하나 이상 고르세요. 모두 Pages 프로젝트의 <b>Settings → Variables and Secrets → Add</b>에서 넣고(비밀 값은 <b>Encrypt</b> 선택), 다시 배포합니다.</p>' +
      '<div class="grid g3"><div class="opt"><strong>이메일 (Resend)</strong><ol><li>resend.com에 <b>spaceblank0100@gmail.com</b>으로 가입</li><li>API Keys → Create API Key</li><li>변수 <code>RESEND_API_KEY</code> (Encrypt)</li></ol><p class="tiny">도메인 인증 전에는 가입한 메일 주소로만 보낼 수 있습니다. 다른 주소로 받으려면 Resend에서 coremood.kr 도메인을 인증한 뒤 <code>NOTIFY_FROM</code>, <code>NOTIFY_EMAIL</code>을 넣습니다.</p></div>' +
      '<div class="opt"><strong>텔레그램</strong><ol><li>텔레그램에서 @BotFather → /newbot → 토큰 받기</li><li>만든 봇에게 아무 메시지나 보내기</li><li><code>api.telegram.org/bot토큰/getUpdates</code>에서 chat id 확인</li><li>변수 <code>TELEGRAM_BOT_TOKEN</code>(Encrypt), <code>TELEGRAM_CHAT_ID</code></li></ol></div>' +
      '<div class="opt"><strong>슬랙 · 디스코드 · 구글챗</strong><ol><li>채널 설정 → 연동 → 웹후크 만들기</li><li>웹후크 주소 복사</li><li>변수 <code>NOTIFY_WEBHOOK</code> (Encrypt)</li></ol></div></div>' +
      '<div class="su__st" data-st="nt"></div><div class="row" style="margin-top:10px"><button class="btn btn--ghost btn--sm" id="su-test" type="button">시험 알림 보내기</button></div></section>' +
      '<section class="panel su" id="su-ts"><h2>' + mark(ts ? "wait" : "off") + ' 3. 스팸 방지 (Cloudflare Turnstile) <small>권장</small></h2>' +
      '<p class="small">문의 폼에 자동 입력 방지 확인을 붙여 광고성 스팸을 막습니다. 방문자는 대부분 아무것도 누르지 않고 지나갑니다.</p>' +
      '<ol class="steps"><li>Cloudflare 대시보드 → <b>Turnstile → Add widget</b>. 이름 <code>coremood</code>, 호스트 이름 <code>coremood.kr</code>, 모드는 <b>Managed</b>.</li>' +
      "<li>나온 <b>Site Key</b>는 관리자 → <a href=\"#/settings\">사이트 설정</a> → 스팸 방지 칸에 저장합니다.</li>" +
      "<li><b>Secret Key</b>는 Pages 변수 <code>TURNSTILE_SECRET</code>(Encrypt)로 넣고 다시 배포합니다.</li>" +
      "<li>두 값은 <b>함께</b> 넣어야 합니다. 비밀 키만 있으면 모든 문의가 막히고, 사이트 키만 있으면 검사가 되지 않습니다.</li></ol>" +
      '<div class="su__st" data-st="ts"></div></section>' +
      '<section class="panel su"><h2>' + mark(vf.naver ? "ok" : "warn") + ' 4. 검색엔진 등록</h2>' +
      '<ul class="seo"><li class="' + (vf.naver ? "ok" : "warn") + '"><span class="i">' + (vf.naver ? "✓" : "!") + "</span><span>네이버 서치어드바이저 소유확인 태그 " + (vf.naver ? "적용됨" : "없음") + " — 사이트맵 <code>/sitemap.xml</code>, RSS <code>/feed.xml</code> 제출</span></li>" +
      '<li class="' + (vf.google ? "ok" : "warn") + '"><span class="i">' + (vf.google ? "✓" : "!") + "</span><span>구글 서치 콘솔 소유확인 태그 " + (vf.google ? "적용됨" : "없음 — HTML 태그 방식으로 받아 사이트 설정에 저장") + "</span></li>" +
      '<li class="ok"><span class="i">✓</span><span>새 글·사례 저장 때 IndexNow로 검색엔진에 자동 알림</span></li></ul></section>' +
      '<section class="panel su"><h2>' + mark((cfg.analytics && (cfg.analytics.ga4 || cfg.analytics.naver)) ? "ok" : "off") + ' 5. 방문 분석 <small>선택</small></h2>' +
      '<ul class="bul2"><li><b>Cloudflare Web Analytics</b> (무료, 쿠키 없음): Workers &amp; Pages → coremood → <b>Metrics → Web Analytics → Enable</b>. 다음 배포부터 자동으로 집계됩니다.</li>' +
      "<li><b>네이버 애널리틱스</b>: analytics.naver.com에서 사이트 등록 후 받은 ID를 <a href=\"#/settings\">사이트 설정 → 방문 분석</a>에 저장합니다.</li>" +
      "<li><b>구글 애널리틱스 4</b>: 측정 ID(G-로 시작)를 같은 곳에 저장합니다.</li></ul></section>" +
      '<section class="panel su"><h2>' + mark("off") + ' 6. 관리자 화면 잠그기 (Cloudflare Access) <small>선택</small></h2>' +
      '<p class="small">관리자 화면은 GitHub 토큰 없이는 아무것도 할 수 없지만, 주소 자체를 대표님 메일 인증 뒤에 두면 더 안전합니다. 무료 범위(50명)에서 쓸 수 있습니다.</p>' +
      '<ol class="steps"><li>Cloudflare 대시보드 → <b>Zero Trust → Access → Applications → Add an application → Self-hosted</b>.</li><li>도메인 <code>coremood.kr</code>, 경로 <code>admin</code>을 입력합니다.</li><li>정책(Policy)은 Allow, Include → Emails에 대표님 메일 주소를 넣습니다.</li><li>저장하면 /admin 에 들어갈 때 메일로 받은 코드를 한 번 더 입력하게 됩니다.</li></ol></section>' +
      "</div>";
    shell("setup", "설정 점검", "상담 문의 접수·알림·스팸 방지가 제대로 연결됐는지 확인합니다.", '<button class="btn btn--ghost" id="su-re">다시 확인</button>', body);
    $("#su-re").addEventListener("click", setupView);
    function setMark(id, st) { var el = $("#" + id + " h2 .ck"); if (el) { el.className = "ck ck--" + st; el.textContent = st === "ok" ? "✓" : st === "warn" ? "!" : st === "bad" ? "✕" : "–"; } }
    api("/api/admin/status").then(function (r) {
      var put = function (k, html) { var el = $('[data-st="' + k + '"]'); if (el) el.innerHTML = html; };
      if (!r.ok) {
        var msg = r._status === 0 || r._status === 404 ? "서버 기능에 연결하지 못했습니다. 배포된 주소(coremood.kr/admin)에서 열어 주세요." : "상태를 확인하지 못했습니다 (" + h(r.error || r.reason || r._status) + ").";
        ["db", "nt", "ts"].forEach(function (k) { put(k, '<div class="note warn">' + msg + "</div>"); });
        return;
      }
      setMark("su-db", r.db ? "ok" : "bad");
      put("db", r.db ? '<div class="note">연결됨 · 저장된 문의 ' + r.total + "건</div>" : '<div class="note bad">아직 연결되지 않았습니다' + (r.dbError ? " (" + h(r.dbError) + ")" : "") + ". 위 순서대로 연결한 뒤 다시 배포해 주세요.</div>");
      var n = r.notify || {}, any = n.email || n.telegram || n.webhook;
      setMark("su-nt", any ? "ok" : "warn");
      put("nt", '<ul class="seo">' + [["email", "이메일" + (r.notifyEmail ? " → " + r.notifyEmail : "")], ["telegram", "텔레그램"], ["webhook", "웹후크"]].map(function (x) {
        return '<li class="' + (n[x[0]] ? "ok" : "warn") + '"><span class="i">' + (n[x[0]] ? "✓" : "–") + "</span><span>" + h(x[1]) + (n[x[0]] ? " 설정됨" : " 미설정") + "</span></li>";
      }).join("") + "</ul>");
      var tsSt = r.turnstile && ts ? "ok" : !r.turnstile && !ts ? "off" : "bad";
      setMark("su-ts", tsSt);
      put("ts", tsSt === "ok" ? '<div class="note">사이트 키와 비밀 키가 모두 설정되어 있습니다.</div>' : tsSt === "off" ? '<div class="tiny">아직 쓰지 않습니다. 숨김 칸 검사와 ‘같은 곳에서 10분에 5건까지’ 제한 같은 기본 스팸 차단은 이미 동작합니다.</div>' :
        '<div class="note bad">' + (r.turnstile ? "비밀 키만 설정되어 있어 지금은 모든 문의가 막힙니다. 사이트 설정에 Site Key를 저장해 주세요." : "사이트 키만 저장되어 있습니다. Pages 변수에 TURNSTILE_SECRET을 넣고 다시 배포해 주세요.") + "</div>");
    });
    $("#su-test").addEventListener("click", function () {
      busy("시험 알림을 보내는 중");
      api("/api/admin/notify-test", { method: "POST", body: {} }).then(function (r) {
        busy();
        if (r.reason === "no-channel") return toast("설정된 알림 채널이 없습니다.", true);
        if (!r.results) return toast("보내지 못했습니다 (" + (r.error || r.reason || r._status) + ")", true);
        toast(r.results.map(function (x) { return ({ email: "이메일", telegram: "텔레그램", webhook: "웹후크" }[x.ch] || x.ch) + (x.ok ? " 성공" : " 실패(" + x.status + ")"); }).join(" · "), !r.ok);
      });
    });
  }

  /* ---------- help ---------- */
  function helpView() {
    var body = '<div class="grid g2" style="align-items:start"><div class="panel help">' +
      "<h3>매일 아침 자동 발행</h3><p>매일 오전 10시 무렵 Claude가 ‘발행 계획’의 맨 위 주제로 글을 써서 올립니다. 대기 주제가 없으면 분류(브랜딩·인테리어·마케팅·창업·공간 비즈니스)를 돌아가며 기존 글과 겹치지 않는 주제를 정합니다.</p>" +
      "<ul><li>쉬어 가고 싶을 때: 발행 계획 → ‘매일 오전 10시 자동 발행’ 끄기 → 설정 저장</li><li>다루고 싶은 주제: 발행 계획 → 주제 추가 (순서는 ↑↓)</li><li>자동 발행된 글도 ‘저널 글’에서 똑같이 고치거나 내릴 수 있습니다.</li></ul>" +
      "<h3>글을 직접 쓰고 고치기</h3><p>저널 글 → 새 글 쓰기. 제목, 영문 주소, 키워드, 설명을 채우고 본문을 씁니다. 오른쪽 ‘점검’이 모두 ✓가 되면 좋습니다. ‘공개’를 끄면 임시저장, 발행 일시를 미래로 정하면 예약 발행입니다(그 시각 이후 첫 자동 발행 때 함께 공개).</p>" +
      "<h3>시공 사례 추가</h3><p>시공 사례 → 새 사례 추가. 시공 전·후 대표 사진 두 장과 현장 이야기를 넣으면 <code>/projects/영문주소</code> 페이지가 만들어지고, ‘대표 사례’를 켜면 홈과 프로젝트 페이지의 전후 비교 슬라이더에도 나옵니다. 지역과 업종이 들어간 사례 페이지는 ‘강남 카페 인테리어’ 같은 지역 검색에 잡히기 좋습니다.</p>" +
      "<h3>상담 문의 관리</h3><ul><li>새 문의는 ‘새 문의’ 상태로 들어옵니다. 연락한 뒤 상태를 바꾸고 <b>다음 연락일</b>을 정해 두면 대시보드 ‘오늘 할 일’에 다시 나타납니다.</li><li>통화 내용은 ‘상담 기록 추가’에 남기면 시간순으로 쌓입니다.</li><li>전화·카카오톡으로 받은 문의도 ‘문의 직접 등록’으로 같은 목록에서 관리하세요.</li><li>각 문의의 ‘유입 경로’에서 어떤 글이나 검색을 보고 들어왔는지 확인할 수 있습니다.</li></ul>" +
      "<h3>글쓰기 규칙</h3><ul><li>실적은 ‘10여 년간 340개 이상 프로젝트’로만 씁니다.</li><li>최고·1위·보장 같은 표현은 쓰지 않습니다.</li><li>인허가·소방·전기 용량은 ‘별도 확인 항목’으로 안내합니다.</li><li>소제목은 <code>## </code>, 체크리스트는 <code>:::check 제목</code> … <code>:::</code>, 자주 묻는 질문은 <code>:::faq</code> 안에 <code>Q. 질문</code> 다음 줄에 답변.</li></ul>" +
      '</div><div class="panel help">' +
      "<h3>반영 시간과 되돌리기</h3><p>저장하면 GitHub에 기록되고 Cloudflare Pages가 1~2분 안에 사이트를 다시 배포합니다. 모든 변경은 왼쪽 아래 ‘변경 기록’에 남고, 잘못 올린 내용도 이전 상태로 되돌릴 수 있습니다. 상담 문의는 GitHub가 아니라 Cloudflare D1에 저장되므로 공개 저장소에 올라가지 않습니다.</p>" +
      "<h3>사이트 설정에서 할 수 있는 것</h3><ul><li>상단 공지 띠 (휴무·이벤트 안내)</li><li>오른쪽 아래 ‘빠른 상담 신청’ 버튼과 카카오톡 채널 버튼</li><li>네이버 애널리틱스·구글 애널리틱스 연결</li><li>스팸 방지(Turnstile) 사이트 키</li><li>네이버·구글 소유확인 태그, 검색엔진 즉시 알림</li></ul>" +
      "<h3>처음 한 번 해 둘 설정</h3><p><a href=\"#/setup\">설정 점검</a> 화면에서 상담 문의 저장소, 새 문의 알림, 스팸 방지의 연결 상태를 확인하고 순서대로 설정하세요.</p>" +
      "<h3>토큰이 만료됐을 때</h3><p>로그인 화면이 다시 나오면 GitHub에서 새 토큰을 만들어 붙여 넣으면 됩니다. 토큰은 이 브라우저에만 저장됩니다. 공용 컴퓨터에서는 ‘로그인 유지’를 끄고 쓰세요.</p>" +
      "</div></div>";
    shell("help", "사용 안내", "자주 쓰는 기능과 운영 방법", "", body);
  }

  /* ---------- boot ---------- */
  function boot() {
    busy("데이터를 불러오는 중");
    return loadAll().then(function () { busy(); route(); }).catch(function (e) { busy(); toast("불러오지 못했습니다: " + e.message, true); route(); });
  }
  S.token = savedToken();
  if (!S.token) loginView();
  else verify().then(boot).catch(function (e) { storeToken(""); S.token = ""; loginView(e.message); });
})();
