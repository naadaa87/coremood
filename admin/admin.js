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
      getJson("data/cases.json", { cases: [] }),
      // 검색·AI 대응 데이터: 주제 허브, 용어 사전, 사이트맵 수정일, 톤앤매너 아카이브, 이미지 크기
      getJson("data/topics.json", { topics: [] }),
      getJson("data/glossary.json", { groups: [] }),
      getJson("data/lastmod.json", {}),
      getJson("data/archive.json", null),
      getJson("data/dims.json", {})
    ]).then(function (r) {
      S.index = r[0]; S.queue = r[1]; S.site = r[2]; S.pages = r[3]; S.imagesDoc = r[4]; S.images = (r[4] && r[4].images) || []; S.casesDoc = r[5];
      S.topics = r[6]; S.glossary = r[7];
      CM.setVerify(S.site && S.site.verify); // 홈 <head> 를 다시 만들 때 소유확인 태그를 유지
      // 관리자에서 다시 만드는 페이지가 자동 빌드(scripts/build.js)와 같은 결과가 되도록 같은 데이터를 넣어 줍니다
      CM.setData({ topics: r[6], glossary: r[7], lastmod: r[8], archive: r[9] || undefined, dims: r[10], cases: cases(), channels: (S.site && S.site.channels) || {}, pages: (S.pages && S.pages.pages) || {}, bodies: {}, feedCache: {} });
      syncSeoData();
    });
  }
  // 글 목록(content/index.json)에서 주제 허브·사이트맵에 쓰는 요약 정보를 다시 맞춥니다
  function syncSeoData() {
    var dg = {};
    ((S.index && S.index.posts) || []).forEach(function (p) { dg[p.slug] = { faq: (p.fq || []).map(function (q) { return { q: q, a: "" }; }), toc: [], summary: [] }; });
    CM.setData({ digest: dg, industries: ((S.index && S.index.industries) || []).map(function (x) { return { slug: x.slug, title: x.title, keyword: x.keyword, lead: x.lead || "", description: x.description || "", hero: x.hero || "" }; }) });
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
    ["", "운영"], ["dashboard", "대시보드"], ["kpi", "KPI 지표"], ["inquiries", "상담 문의"], ["members", "회원"],
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
    if (v === "member") return membersView(decodeURIComponent(parts[1] || ""));
    var fn = { dashboard: dashboard, posts: postsView, queue: queueView, cases: casesView, industries: industriesView, inquiries: function () { inquiriesView(""); }, kpi: kpiView, members: function () { membersView(""); }, pages: pagesView, images: imagesView, settings: settingsView, setup: setupView, help: helpView }[v] || dashboard;
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
      '<div class="panel"><h2>방문 요약 <small>최근 7일 · <a href="#/kpi">KPI 지표 보기</a></small></h2><div id="dvis"><div class="empty">불러오는 중…</div></div></div>' +
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
    // 방문 요약 (최근 7일)
    var t0 = todayKST();
    api("/api/admin/kpi?from=" + addDay(t0, -6) + "&to=" + t0).then(function (d) {
      var el = $("#dvis"); if (!el) return;
      if (!d.ok) { el.innerHTML = '<div class="empty">' + (d._status === 0 || d._status === 404 ? "배포된 사이트(coremood.kr/admin)에서 확인됩니다." : "불러오지 못했습니다.") + "</div>"; return; }
      var V = d.visits.cur || {}, Vp = d.visits.prev || {};
      el.innerHTML = '<div class="dvis">' +
        '<div><span>방문자</span><b>' + nf(V.uv) + "</b>" + deltaHtml(V.uv, Vp.uv, true) + "</div>" +
        '<div><span>페이지뷰</span><b>' + nf(V.pv) + "</b>" + deltaHtml(V.pv, Vp.pv, true) + "</div>" +
        '<div><span>상담 연결 클릭</span><b>' + nf(d.contact.cur) + "</b>" + deltaHtml(d.contact.cur, d.contact.prev, true) + "</div>" +
        '<div><span>신규 회원</span><b>' + nf(d.members.items.length) + "</b>" + deltaHtml(d.members.items.length, d.members.prev, true) + "</div></div>" +
        (d.since ? "" : '<p class="tiny" style="margin-top:10px">방문 기록은 이번 업데이트 배포 뒤부터 쌓입니다.</p>');
    });
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

  /* ---------- KPI 지표 ---------- */
  var KPI_CONTACT = { tel: "전화", kakao: "카카오톡", mail: "메일", quick: "빠른 상담", contact: "상담·견적·가입 버튼" };
  var CLICK_KIND = { tel: "전화", kakao: "카카오톡", mail: "메일", quick: "빠른 상담", contact: "상담 연결", archive: "레퍼런스", "case": "시공 사례", out: "외부 링크", menu: "메뉴", footer: "하단 메뉴", link: "링크", button: "버튼", form: "폼 제출" };
  var DEV_KO = { mobile: "모바일", desktop: "PC", tablet: "태블릿" };
  var REGION_KO = { "Seoul": "서울", "Gyeonggi-do": "경기", "Incheon": "인천", "Busan": "부산", "Daegu": "대구", "Daejeon": "대전", "Gwangju": "광주", "Ulsan": "울산", "Sejong": "세종", "Sejong-si": "세종",
    "Gangwon-do": "강원", "Gangwon": "강원", "Chungcheongbuk-do": "충북", "North Chungcheong": "충북", "Chungcheongnam-do": "충남", "South Chungcheong": "충남", "Jeollabuk-do": "전북", "North Jeolla": "전북", "Jeonbuk": "전북",
    "Jeollanam-do": "전남", "South Jeolla": "전남", "Gyeongsangbuk-do": "경북", "North Gyeongsang": "경북", "Gyeongsangnam-do": "경남", "South Gyeongsang": "경남", "Jeju-do": "제주", "Jeju": "제주" };
  var WD_KO = ["일", "월", "화", "수", "목", "금", "토"];
  function nf(n) { return Math.round(Number(n) || 0).toLocaleString("ko-KR"); }
  function durTxt(sec) {
    sec = Math.round(Number(sec) || 0);
    if (!sec) return "–";
    var m = Math.floor(sec / 60), s = sec % 60;
    return m ? m + "분 " + (s < 10 ? "0" : "") + s + "초" : s + "초";
  }
  function pctTxt(v, digits) { return v == null || isNaN(v) ? "–" : (v * 100).toFixed(digits == null ? 1 : digits).replace(/\.0$/, "") + "%"; }
  function addDay(day, n) { return new Date(Date.parse(day + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10); }
  function dayList(from, to) { var out = [], d = from; while (d <= to && out.length < 400) { out.push(d); d = addDay(d, 1); } return out; }
  function mdTxt(day) { return parseInt(day.slice(5, 7), 10) + "/" + parseInt(day.slice(8), 10); }
  // 이전 기간 대비 — 오름이 좋은 지표인지(goodUp)에 따라 색을 정하고, 화살표와 글자로도 함께 알립니다
  function deltaHtml(cur, prev, goodUp, rate) {
    cur = Number(cur) || 0; prev = Number(prev) || 0;
    if (!cur && !prev) return '<span class="kd">이전 기간과 같음</span>';
    var diff, txt;
    if (rate) { diff = cur - prev; txt = Math.abs(diff * 100).toFixed(1).replace(/\.0$/, "") + "%p"; }
    else if (!prev) return '<span class="kd kd--' + (goodUp ? "good" : "bad") + '">▲ 새로 생김</span>';
    else { diff = cur - prev; txt = Math.abs(Math.round(diff / prev * 100)) + "%"; }
    if (Math.abs(diff) < 1e-9) return '<span class="kd">이전 기간과 같음</span>';
    var up = diff > 0, good = up === goodUp;
    return '<span class="kd kd--' + (good ? "good" : "bad") + '">' + (up ? "▲ " : "▼ ") + txt + '<em>' + (up ? " 늘었습니다" : " 줄었습니다") + "</em></span>";
  }
  function ktile(k, v, unit, delta, note) {
    return '<div class="ktile"><div class="ktile__k">' + k + '</div><div class="ktile__v">' + v + (unit ? "<small>" + unit + "</small>" : "") + "</div>" + (delta || "") + (note ? '<div class="ktile__n">' + note + "</div>" : "") + "</div>";
  }
  // 순위 막대 (한 가지 색, 큰 순서)
  function kbars(rows, opt) {
    opt = opt || {};
    if (!rows.length) return '<div class="empty">' + (opt.empty || "아직 기록이 없습니다.") + "</div>";
    var total = opt.total || rows.reduce(function (s, r) { return s + r.n; }, 0) || 1;
    var max = Math.max.apply(null, rows.map(function (r) { return r.n; })) || 1;
    return '<ol class="kbars">' + rows.map(function (r) {
      return '<li class="kb"' + (r.title ? ' title="' + h(r.title) + '"' : "") + '><span class="kb__k">' + h(r.k) + (r.sub ? "<span>" + h(r.sub) + "</span>" : "") + '</span><span class="kb__t"><i style="width:' + Math.max(1.5, r.n / max * 100).toFixed(1) + '%"></i></span><span class="kb__n">' + nf(r.n) + (opt.share === false ? "" : "<small>" + pctTxt(r.n / total, 0) + "</small>") + "</span></li>";
    }).join("") + "</ol>";
  }
  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
    var f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  // 세로 막대 차트 (한 계열) — rows: [{ key, label, tip }], 값은 rows[i].v
  function colChart(el, rows, opt) {
    if (!el) return;
    opt = opt || {};
    var W = Math.max(280, el.clientWidth || 720), H = opt.height || 220, padL = 38, padR = 6, padT = 18, padB = 26;
    var n = rows.length, max = 0;
    rows.forEach(function (r) { if (r.v > max) max = r.v; });
    var step = max <= 4 ? 1 : niceStep(max / 4), top = Math.max(step, Math.ceil(max / step) * step);
    var iw = W - padL - padR, ih = H - padT - padB, band = iw / Math.max(1, n), bw = Math.max(2, Math.min(24, band * 0.68));
    var y = function (v) { return padT + ih - v / top * ih; };
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + h(opt.title || "") + '">';
    for (var t = 0; t <= top + 1e-9; t += step) {
      var yy = Math.round(y(t)) + 0.5;
      svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '" class="' + (t === 0 ? "kc-base" : "kc-grid") + '"/>' +
        '<text x="' + (padL - 8) + '" y="' + (yy + 4) + '" class="kc-tick" text-anchor="end">' + nf(t) + "</text>";
    }
    var every = Math.max(1, Math.ceil(n / (opt.maxLabels || Math.max(4, Math.floor(iw / 64)))));
    var peak = -1;
    rows.forEach(function (r, i) { if (r.v > 0 && (peak < 0 || r.v > rows[peak].v)) peak = i; });
    rows.forEach(function (r, i) {
      var cx = padL + band * i + band / 2, x = cx - bw / 2, hgt = r.v / top * ih, yb = padT + ih;
      if (r.v > 0) {
        var rr = Math.min(4, bw / 2, hgt), yt = yb - Math.max(hgt, 1.5);
        svg += '<path class="kc-bar" data-i="' + i + '" d="M' + x.toFixed(1) + "," + yb + "V" + (yt + rr).toFixed(1) + "Q" + x.toFixed(1) + "," + yt.toFixed(1) + " " + (x + rr).toFixed(1) + "," + yt.toFixed(1) +
          "H" + (x + bw - rr).toFixed(1) + "Q" + (x + bw).toFixed(1) + "," + yt.toFixed(1) + " " + (x + bw).toFixed(1) + "," + (yt + rr).toFixed(1) + "V" + yb + 'Z"/>';
      }
      if (i % every === 0 || (opt.lastLabel && i === n - 1 && n - 1 - (Math.floor((n - 1) / every) * every) > every / 2)) svg += '<text x="' + cx.toFixed(1) + '" y="' + (H - 8) + '" class="kc-tick" text-anchor="middle">' + h(r.label) + "</text>";
    });
    if (peak >= 0 && opt.peakLabel !== false) {
      var px = padL + band * peak + band / 2, py = y(rows[peak].v) - 6;
      svg += '<text x="' + px.toFixed(1) + '" y="' + Math.max(11, py).toFixed(1) + '" class="kc-val" text-anchor="middle">' + nf(rows[peak].v) + "</text>";
    }
    rows.forEach(function (r, i) { svg += '<rect class="kc-hit" data-i="' + i + '" tabindex="0" x="' + (padL + band * i).toFixed(1) + '" y="' + padT + '" width="' + band.toFixed(1) + '" height="' + ih + '"/>'; });
    svg += "</svg>";
    el.innerHTML = '<div class="kc">' + svg + '<div class="kc-tip" hidden></div></div>';
    var tip = $(".kc-tip", el), box = $(".kc", el);
    var show = function (i) {
      var r = rows[i]; if (!r) return;
      $$(".kc-bar", el).forEach(function (b) { b.classList.toggle("on", +b.dataset.i === i); });
      tip.innerHTML = r.tip;
      tip.hidden = false;
      var cx = padL + band * i + band / 2, tw = tip.offsetWidth, bwid = box.clientWidth;
      tip.style.left = Math.max(0, Math.min(bwid - tw, cx / W * bwid - tw / 2)) + "px";
    };
    var hide = function () { tip.hidden = true; $$(".kc-bar.on", el).forEach(function (b) { b.classList.remove("on"); }); };
    $$(".kc-hit", el).forEach(function (hit) {
      var i = +hit.dataset.i;
      hit.addEventListener("pointerenter", function () { show(i); });
      hit.addEventListener("focus", function () { show(i); });
      hit.addEventListener("blur", hide);
    });
    $("svg", el).addEventListener("pointerleave", hide);
  }
  // 주소를 관리자가 알아보기 쉬운 이름으로 (페이지 이름 · 글 제목 · 업종 · 사례)
  function pageName(path, title) {
    if (path === "/") return "홈";
    var pm = (S.pages && S.pages.pages) || {}, m, k;
    for (k in pm) if (pm[k].path === path) return pm[k].name;
    if (path === "/journal/") return "저널 목록";
    if ((m = /^\/journal\/category\/([^/]+)$/.exec(path))) return "저널 · " + catName(m[1]);
    if ((m = /^\/journal\/([^/]+)$/.exec(path))) { var po = (S.index.posts || []).filter(function (x) { return x.slug === m[1]; })[0]; if (po) return po.title; }
    if (path === "/industries/") return "업종별 인테리어";
    if ((m = /^\/industries\/([^/]+)$/.exec(path))) { var ind = (S.index.industries || []).filter(function (x) { return x.slug === m[1]; })[0]; if (ind) return ind.keyword || ind.title; }
    if ((m = /^\/projects\/([^/]+)$/.exec(path))) { var c = cases().filter(function (x) { return x.slug === m[1]; })[0]; if (c) return "시공 사례 · " + (c.title || c.slug); }
    if (path === "/faq") return "자주 묻는 질문";
    return String(title || path).split(/\s+[—|]\s+/)[0];
  }
  function utmName(u) {
    var o = {};
    String(u || "").split("&").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) { try { o[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } catch (e) { o[kv.slice(0, i)] = kv.slice(i + 1); } } });
    return [o.source, o.medium, o.campaign].filter(Boolean).join(" / ") || u;
  }
  function kpiRange() {
    var r = kpiView.r || { p: "30" };
    var today = todayKST();
    if (r.p === "custom" && r.from && r.to) return r;
    if (r.p === "today") return { p: r.p, from: today, to: today };
    if (r.p === "yesterday") { var y = addDay(today, -1); return { p: r.p, from: y, to: y }; }
    if (r.p === "month") return { p: r.p, from: today.slice(0, 8) + "01", to: today };
    var n = parseInt(r.p, 10) || 30;
    return { p: String(n), from: addDay(today, -(n - 1)), to: today };
  }
  function notrack(v) {
    try { if (v === undefined) return localStorage.getItem("cm_notrack") === "1"; localStorage.setItem("cm_notrack", v ? "1" : "0"); } catch (e) { return false; }
    return v;
  }
  function kpiView() {
    var R = kpiRange();
    kpiView.r = R;
    var presets = [["today", "오늘"], ["yesterday", "어제"], ["7", "최근 7일"], ["30", "최근 30일"], ["90", "최근 90일"], ["month", "이번 달"]];
    var body = '<div class="kfil"><div class="filters" id="k-p">' + presets.map(function (p) { return '<button class="chip' + (R.p === p[0] ? " on" : "") + '" data-p="' + p[0] + '">' + p[1] + "</button>"; }).join("") + "</div>" +
      '<div class="kfil__d"><input class="in" type="date" id="k-from" value="' + R.from + '" max="' + todayKST() + '"><span>~</span><input class="in" type="date" id="k-to" value="' + R.to + '" max="' + todayKST() + '"><button class="btn btn--ghost btn--sm" id="k-go">적용</button></div>' +
      '<span class="klive" id="k-live"></span></div>' +
      '<div id="kbody" class="kbody"><div class="panel"><div class="empty">지표를 불러오는 중…</div></div></div>';
    shell("kpi", "KPI 지표", "방문, 클릭, 상담 문의, 회원 지표를 한 화면에서 봅니다. 모든 증감은 바로 앞 같은 길이의 기간과 비교합니다.",
      '<button class="btn btn--ghost" id="k-csv" disabled>CSV 내려받기</button><button class="btn btn--ghost" id="k-re">새로고침</button>', body);
    $$("#k-p .chip").forEach(function (c) { c.addEventListener("click", function () { kpiView.r = { p: c.dataset.p }; kpiView(); }); });
    $("#k-go").addEventListener("click", function () {
      var f = $("#k-from").value, t = $("#k-to").value;
      if (!f || !t) return toast("시작일과 종료일을 모두 골라 주세요.", true);
      if (f > t) { var x = f; f = t; t = x; }
      kpiView.r = { p: "custom", from: f, to: t }; kpiView();
    });
    $("#k-re").addEventListener("click", function () { kpiView.cache = null; kpiView(); });
    var key = R.from + "_" + R.to;
    var go = function (d) { kpiRender(d, R); };
    if (kpiView.cache && kpiView.cache.key === key && Date.now() - kpiView.cache.at < 60000) return go(kpiView.cache.d);
    api("/api/admin/kpi?from=" + R.from + "&to=" + R.to).then(function (d) {
      if (d.ok) kpiView.cache = { key: key, at: Date.now(), d: d };
      go(d);
    });
  }
  function kpiRender(d, R) {
    var box = $("#kbody"); if (!box) return;
    if (!d.ok) {
      box.innerHTML = '<div class="panel"><div class="note warn">' + (d.reason === "not-configured" ? 'D1 데이터베이스가 연결되지 않아 지표를 모을 수 없습니다. <a href="#/setup">설정 점검</a>을 확인해 주세요.'
        : d._status === 0 || d._status === 404 ? "서버 기능에 연결하지 못했습니다. 배포된 주소(coremood.kr/admin)에서 열어 주세요." : "지표를 불러오지 못했습니다 (" + h(d.reason || d.error || d._status) + ").") + "</div></div>";
      return;
    }
    $("#k-live").innerHTML = '<i></i>지금 보고 있는 방문자 <b>' + nf(d.live) + "</b>명";
    var V = d.visits.cur || {}, Vp = d.visits.prev || {}, Sx = d.visits.sess || {}, Sp = d.visits.sessPrev || {};
    var bounce = Sx.n ? Sx.bounce / Sx.n : 0, bounceP = Sp.n ? Sp.bounce / Sp.n : 0;
    var inq = d.inquiries.items, inqN = inq.length, won = inq.filter(function (x) { return x.status === "won"; }).length;
    var conv = V.uv ? inqN / V.uv : 0, convP = Vp.uv ? d.inquiries.prev / Vp.uv : 0;
    var memN = d.members.items.length;
    var spanTxt = R.from === R.to ? fmtDay(R.from) : fmtDay(R.from) + " ~ " + fmtDay(R.to);
    function fmtDay(x) { return x.slice(0, 4) + ". " + parseInt(x.slice(5, 7), 10) + ". " + parseInt(x.slice(8), 10) + "."; }
    var days = dayList(d.from, d.to), byDay = {};
    days.forEach(function (x) { byDay[x] = { uv: 0, pv: 0, ses: 0, contact: 0, inq: 0, mem: 0 }; });
    d.daily.forEach(function (r) { if (byDay[r.day]) { byDay[r.day].uv = r.uv; byDay[r.day].pv = r.pv; byDay[r.day].ses = r.ses; } });
    d.dailyContact.forEach(function (r) { if (byDay[r.day]) byDay[r.day].contact = r.n; });
    inq.forEach(function (x) { if (byDay[x.day]) byDay[x.day].inq++; });
    d.members.items.forEach(function (x) { if (byDay[x.day]) byDay[x.day].mem++; });
    var pc = {}; d.pageContact.forEach(function (r) { pc[r.path] = r.n; });
    var titleOf = function (p) { return pageName(p.path, p.title); };
    var pathKo = function (p) { return p; };
    var pages = d.pages;
    var group = function (re, exclude) { return pages.filter(function (p) { return re.test(p.path) && !(exclude && exclude.test(p.path)); }).slice(0, 10).map(function (p) { return { k: titleOf(p), sub: p.dur ? "평균 " + durTxt(p.dur) + " 머무름" : "", n: p.pv, title: p.path }; }); };
    var empty = !d.since;
    var html = "";
    if (empty) html += '<div class="note" style="margin-bottom:16px">방문 기록은 이번 업데이트가 배포된 뒤부터 쌓입니다. 하루 이틀 지나면 아래 지표가 채워집니다. 상담 문의와 회원 지표는 지금도 바로 볼 수 있습니다.</div>';
    html += '<p class="kspan">' + spanTxt + " · " + d.days + "일" + (d.since ? ' <span class="muted">· 방문 기록 ' + fmtDay(d.since) + "부터</span>" : "") + "</p>";
    html += '<h2 class="ksec">방문</h2><div class="ktiles">' +
      ktile("방문자", nf(V.uv), "명", deltaHtml(V.uv, Vp.uv, true), "처음 온 방문자 " + nf(V.nv) + " · 다시 온 방문자 " + nf((V.uv || 0) - (V.nv || 0))) +
      ktile("페이지뷰", nf(V.pv), "회", deltaHtml(V.pv, Vp.pv, true), "방문자 1명당 " + (V.uv ? (V.pv / V.uv).toFixed(1) : "0") + "페이지") +
      ktile("방문 수", nf(V.ses), "회", deltaHtml(V.ses, Vp.ses, true), "30분 넘게 쉬면 새 방문으로 셉니다") +
      ktile("평균 체류 시간", durTxt(Sx.dwell), "", deltaHtml(Sx.dwell, Sp.dwell, true), "방문 1회 동안 화면을 본 시간") +
      ktile("이탈률", pctTxt(bounce), "", deltaHtml(bounce, bounceP, false, true), "한 페이지만 보고 나간 방문 비율") +
      ktile("방문당 페이지", Sx.ppv ? Number(Sx.ppv).toFixed(1) : "0", "페이지", deltaHtml(Sx.ppv, Sp.ppv, true), "방문 1회에 둘러본 페이지 수") + "</div>";
    html += '<h2 class="ksec">성과</h2><div class="ktiles">' +
      ktile("상담 연결 클릭", nf(d.contact.cur), "회", deltaHtml(d.contact.cur, d.contact.prev, true), "전화·카카오톡·상담 버튼을 누른 횟수") +
      ktile("상담 문의", nf(inqN), "건", deltaHtml(inqN, d.inquiries.prev, true), '<a href="#/inquiries">상담 문의 관리 →</a>') +
      ktile("문의 전환율", pctTxt(conv, 2), "", deltaHtml(conv, convP, true, true), "상담 문의 ÷ 방문자") +
      ktile("계약", nf(won), "건", deltaHtml(won, d.inquiries.prevWon, true), "이 기간에 들어온 문의 중 계약 상태") +
      ktile("신규 회원", nf(memN), "명", deltaHtml(memN, d.members.prev, true), '<a href="#/members">회원 관리 →</a>') +
      ktile("활동 회원", nf(d.members.active), "명", "", "소식 수신 동의 " + nf(d.members.marketing) + "명" + (d.members.total - d.members.active > 0 ? " · 탈퇴 " + nf(d.members.total - d.members.active) + "명 제외" : "")) + "</div>";
    var tabs = [["uv", "방문자"], ["pv", "페이지뷰"], ["ses", "방문 수"], ["contact", "상담 연결 클릭"], ["inq", "상담 문의"], ["mem", "신규 회원"]];
    var tk = kpiRender.tab || "uv";
    if (d.days > 1) html += '<div class="panel ktrend"><h2><span id="kt-title">일별 ' + h((tabs.filter(function (t) { return t[0] === tk; })[0] || tabs[0])[1]) + "</span><small><button class=\"link\" id=\"kt-table\">표로 보기</button></small></h2>" +
      '<div class="tabs" id="kt-tabs">' + tabs.map(function (t) { return '<button data-k="' + t[0] + '"' + (t[0] === tk ? ' class="on"' : "") + ">" + t[1] + "</button>"; }).join("") + "</div>" +
      '<div id="kt-chart" class="kchart"></div><div id="kt-tbl" hidden></div></div>';
    var pageRows = pages.map(function (p) {
      return "<tr><td class=\"t\">" + h(titleOf(p)) + "<span>" + h(pathKo(p.path)) + '</span></td><td class="num">' + nf(p.pv) + '</td><td class="num">' + nf(p.uv) + '</td><td class="num hide-m">' + durTxt(p.dur) + '</td><td class="num hide-m">' + (p.depth != null ? Math.round(p.depth) + "%" : "–") + '</td><td class="num hide-m">' + nf(pc[p.path] || 0) + '</td><td class="num hide-m">' + nf(p.ent) + "</td></tr>";
    });
    html += '<div class="grid g2 kgrid"><div class="panel"><h2>페이지별 방문 <small>조회수 순</small></h2>' +
      '<div class="tblwrap"><table class="tbl ktbl"><thead><tr><th>페이지</th><th class="num">조회수</th><th class="num">방문자</th><th class="num hide-m">평균 체류</th><th class="num hide-m">스크롤</th><th class="num hide-m">상담 클릭</th><th class="num hide-m">첫 방문</th></tr></thead><tbody id="k-pages">' +
      (pageRows.slice(0, 12).join("") || '<tr><td colspan="7"><div class="empty">아직 기록이 없습니다.</div></td></tr>') + "</tbody></table></div>" +
      (pageRows.length > 12 ? '<div class="row" style="margin-top:10px"><button class="btn btn--ghost btn--sm" id="k-more">' + (pageRows.length - 12) + "개 페이지 더 보기</button></div>" : "") + "</div>";
    var pop = [["journal", "저널 글"], ["cases", "시공 사례 · 레퍼런스"], ["ind", "업종 페이지"], ["clicks", "많이 누른 버튼"]];
    var pk = kpiRender.pop || "journal";
    html += '<div class="panel"><h2>가장 인기 있는 정보</h2><div class="tabs" id="kp-tabs">' + pop.map(function (t) { return '<button data-k="' + t[0] + '"' + (t[0] === pk ? ' class="on"' : "") + ">" + t[1] + "</button>"; }).join("") + '</div><div id="kp-body"></div></div></div>';
    var srcTotal = d.sources.reduce(function (s, r) { return s + r.n; }, 0);
    html += '<div class="grid g3 kgrid">' +
      '<div class="panel"><h2>유입 경로 <small>방문 수 기준</small></h2>' + kbars(d.sources.map(function (r) { return { k: r.src || "직접 방문", n: r.n }; }), { total: srcTotal }) + "</div>" +
      '<div class="panel"><h2>처음 들어온 페이지</h2>' + kbars(d.landing.map(function (r) { return { k: titleOf(r), n: r.n, title: r.path }; }), { total: srcTotal }) + "</div>" +
      '<div class="panel"><h2>캠페인 <small>utm 주소로 들어온 방문</small></h2>' + kbars(d.campaigns.map(function (r) { return { k: utmName(r.utm), n: r.n, title: r.utm }; }), { share: false, empty: "캠페인 주소(utm)로 들어온 방문이 없습니다. 블로그·인스타그램 링크에 ?utm_source=blog 처럼 붙이면 여기서 따로 셀 수 있습니다." }) + "</div></div>";
    // 검색엔진과 AI 검색으로 들어온 방문, 사이트 안에서 찾은 말
    var find = d.find || { sources: [], landing: [], ai: [] };
    var findTotal = find.sources.reduce(function (s, r) { return s + r.n; }, 0);
    var aiTotal = find.sources.filter(function (r) { return (find.ai || []).indexOf(r.src) >= 0; }).reduce(function (s, r) { return s + r.n; }, 0);
    html += '<div class="grid g3 kgrid">' +
      '<div class="panel"><h2>검색 · AI 유입 <small>전체 방문의 ' + (srcTotal ? Math.round(findTotal / srcTotal * 100) : 0) + "%</small></h2>" +
      kbars(find.sources.map(function (r) { return { k: r.src, sub: (find.ai || []).indexOf(r.src) >= 0 ? "AI 검색" : "", n: r.n }; }), { total: findTotal, empty: "검색엔진이나 AI 검색으로 들어온 방문이 아직 없습니다. 네이버 서치어드바이저와 구글 서치 콘솔에 사이트맵을 제출했는지 확인해 보세요." }) +
      '<p class="tiny" style="margin-top:12px">검색 ' + (findTotal - aiTotal) + "회 · AI 검색(ChatGPT, Perplexity 등) " + aiTotal + "회. 네이버·구글 앱 안에서 열린 방문은 ‘직접 방문’이나 ‘네이버 앱’으로 잡히기도 합니다.</p></div>" +
      '<div class="panel"><h2>검색으로 처음 들어온 페이지</h2>' + kbars(find.landing.map(function (r) { return { k: titleOf(r), n: r.n, title: r.path }; }), { total: findTotal, empty: "아직 기록이 없습니다." }) +
      '<p class="tiny" style="margin-top:12px">여기 자주 나오는 글이 검색에서 잘 잡히는 글입니다. 같은 주제의 글을 발행 계획에 더 넣어 보세요.</p></div>' +
      '<div class="panel"><h2>사이트 안에서 찾은 말 <small>검색 페이지</small></h2>' + kbars((d.searches || []).map(function (r) { return { k: r.label, sub: r.zero ? "결과 없음 " + r.zero + "회" : "", n: r.n }; }), { share: false, empty: "아직 사이트 검색 기록이 없습니다. 방문자가 검색 페이지에서 찾은 말이 여기 모입니다." }) +
      '<p class="tiny" style="margin-top:12px">‘결과 없음’이 붙은 말은 방문자가 찾았지만 글이 없는 주제입니다. 발행 계획에 넣을 후보입니다.</p></div></div>';
    var devTotal = d.devices.reduce(function (s, r) { return s + r.n; }, 0);
    var reg = {};
    d.regions.forEach(function (r) { var k = r.country && r.country !== "KR" ? "해외 (" + r.country + ")" : REGION_KO[r.region] || r.region || "알 수 없음"; reg[k] = (reg[k] || 0) + r.n; });
    var regRows = Object.keys(reg).map(function (k) { return { k: k, n: reg[k] }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    html += '<div class="grid g3 kgrid">' +
      '<div class="panel"><h2>기기 <small>방문 수 기준</small></h2>' + kbars(d.devices.map(function (r) { return { k: DEV_KO[r.dev] || r.dev, n: r.n }; }), { total: devTotal }) + "</div>" +
      '<div class="panel"><h2>지역 <small>접속 위치 기준 · 대략</small></h2>' + kbars(regRows, { total: devTotal }) + "</div>" +
      '<div class="panel"><h2>처음 온 방문자와 다시 온 방문자</h2>' + kbars([{ k: "처음 온 방문자", n: V.nv || 0 }, { k: "다시 온 방문자", n: (V.uv || 0) - (V.nv || 0) }].filter(function (r) { return r.n > 0; }), { total: V.uv }) +
      '<p class="tiny" style="margin-top:12px">다시 온 방문자가 늘면 저널 글과 사례가 다시 찾아올 이유가 되고 있다는 뜻입니다.</p></div></div>';
    html += '<div class="grid g2 kgrid"><div class="panel"><h2>시간대별 페이지뷰</h2><div id="k-hours" class="kchart"></div></div>' +
      '<div class="panel"><h2>요일별 페이지뷰</h2><div id="k-wd" class="kchart"></div></div></div>';
    var cnt = function (list, key) { var o = {}; list.forEach(function (x) { var v = key(x); if (Array.isArray(v)) v.forEach(function (y) { if (y) o[y] = (o[y] || 0) + 1; }); else if (v) o[v] = (o[v] || 0) + 1; }); return Object.keys(o).map(function (k) { return { k: k, n: o[k] }; }).sort(function (a, b) { return b.n - a.n; }); };
    html += '<div class="grid g2 kgrid"><div class="panel"><h2>상담 문의 <small><a href="#/inquiries">전체 보기</a></small></h2>' +
      '<div class="ksub">들어온 경로</div>' + kbars(cnt(inq, function (x) { return x.type === "직접 등록" ? "직접 등록 · " + (x.channel || "기타") : x.type || "상담 신청"; }), { empty: "이 기간에 들어온 문의가 없습니다." }) +
      '<div class="ksub">업종</div>' + kbars(cnt(inq, function (x) { return x.biz || "업종 미선택"; }).slice(0, 6), { empty: "–" }) +
      '<div class="ksub">진행 상태</div>' + kbars(INQ_ST.map(function (s) { return { k: s[1], n: inq.filter(function (x) { return x.status === s[0]; }).length }; }).filter(function (r) { return r.n; }), { empty: "–" }) + "</div>" +
      '<div class="panel"><h2>회원 <small><a href="#/members">회원 관리</a></small></h2>' +
      '<div class="ksub">관심 분야 <span class="muted">· 이 기간 가입자</span></div>' + kbars(cnt(d.members.items, function (x) { return x.interests; }), { share: false, empty: "이 기간에 가입한 회원이 없습니다." }) +
      '<div class="ksub">지금 상황</div>' + kbars(cnt(d.members.items, function (x) { return x.stage || "선택 안 함"; }), { empty: "–" }) +
      '<div class="ksub">최근 가입</div>' + (d.members.recent.length ? '<table class="tbl"><tbody>' + d.members.recent.map(function (m) {
        return '<tr class="click" data-go="#/member/' + encodeURIComponent(m.id) + '"><td class="t">' + h(m.name || "(이름 없음)") + "<span>" + h([m.biz, m.stage].filter(Boolean).join(" · ") || "-") + '</span></td><td style="text-align:right" class="tiny">' + fmtDT(m.created_at).slice(0, 12) + (m.status === "unsub" ? ' <span class="badge closed">탈퇴</span>' : "") + "</td></tr>";
      }).join("") + "</tbody></table>" : '<div class="empty">아직 가입한 회원이 없습니다. 홈페이지 하단과 저널 글 끝의 ‘회원 가입’ 링크로 가입할 수 있습니다.</div>') + "</div></div>";
    var off = notrack();
    html += '<div class="panel kfoot"><h2>집계 기준</h2><ul class="bul2">' +
      "<li>방문 기록은 코어무드 데이터베이스(coremood-db)에 직접 모읍니다. IP 주소나 이름 같은 개인 정보는 저장하지 않고, 브라우저마다 만든 임의 번호로 방문자를 셉니다.</li>" +
      "<li>검색엔진 로봇과 관리자 화면 접속은 빠집니다. 체류 시간은 화면을 실제로 보고 있던 시간만 더하고, 한 페이지에 30분 넘게 머문 기록은 30분으로 셉니다.</li>" +
      "<li>문의 전환율은 이 기간 상담 문의 수를 방문자 수로 나눈 값입니다. 전화로 바로 연락한 고객은 ‘상담 연결 클릭’에 잡힙니다.</li>" +
      "<li>1년 넘게 지난 방문 기록은 자동으로 정리됩니다. 상담 문의와 회원 정보는 지우기 전까지 남습니다.</li></ul>" +
      '<label class="chk" style="margin-top:12px"><input type="checkbox" id="k-off"' + (off ? " checked" : "") + "> 이 브라우저에서 보는 홈페이지 방문은 통계에서 빼기 <span class=\"muted\">(관리자 로그인 때 자동으로 켜집니다)</span></label></div>";
    box.innerHTML = html;
    $("#k-csv").disabled = false;
    bindGo();
    // 추이 차트
    var drawTrend = function () {
      var t = (tabs.filter(function (x) { return x[0] === tk; })[0] || tabs[0]);
      $("#kt-title").textContent = "일별 " + t[1];
      colChart($("#kt-chart"), days.map(function (x) {
        var r = byDay[x], wd = WD_KO[new Date(x + "T00:00:00Z").getUTCDay()];
        return { v: r[tk], label: mdTxt(x), tip: '<b>' + nf(r[tk]) + "</b> " + h(t[1]) + '<span class="kc-tip__d">' + mdTxt(x) + " (" + wd + ")</span>" +
          '<span class="kc-tip__r">방문자 ' + nf(r.uv) + " · 페이지뷰 " + nf(r.pv) + "</span>" + '<span class="kc-tip__r">상담 클릭 ' + nf(r.contact) + " · 문의 " + nf(r.inq) + " · 가입 " + nf(r.mem) + "</span>" };
      }), { title: "일별 " + t[1], lastLabel: true });
      $("#kt-tbl").innerHTML = '<div class="tblwrap" style="max-height:340px"><table class="tbl ktbl"><thead><tr><th>날짜</th><th class="num">방문자</th><th class="num">페이지뷰</th><th class="num">방문 수</th><th class="num">상담 클릭</th><th class="num">문의</th><th class="num">가입</th></tr></thead><tbody>' +
        days.slice().reverse().map(function (x) { var r = byDay[x]; return "<tr><td>" + x + '</td><td class="num">' + nf(r.uv) + '</td><td class="num">' + nf(r.pv) + '</td><td class="num">' + nf(r.ses) + '</td><td class="num">' + nf(r.contact) + '</td><td class="num">' + nf(r.inq) + '</td><td class="num">' + nf(r.mem) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    };
    if (d.days > 1) drawTrend();
    else kpiRender.tab = tk;
    if (d.days > 1) $$("#kt-tabs button").forEach(function (b) { b.addEventListener("click", function () { tk = kpiRender.tab = b.dataset.k; $$("#kt-tabs button").forEach(function (o) { o.classList.toggle("on", o === b); }); drawTrend(); }); });
    if ($("#kt-table")) $("#kt-table").addEventListener("click", function () { var t = $("#kt-tbl"), c = $("#kt-chart"); t.hidden = !t.hidden; c.hidden = !t.hidden; this.textContent = t.hidden ? "표로 보기" : "차트로 보기"; });
    var more = $("#k-more");
    if (more) more.addEventListener("click", function () { $("#k-pages").innerHTML = pageRows.join(""); more.remove(); });
    // 인기 정보
    var drawPop = function () {
      var el = $("#kp-body"), list;
      if (pk === "journal") list = kbars(group(/^\/journal\/(?!category\/)[^/]+$/), { share: false, empty: "아직 저널 글 조회 기록이 없습니다." });
      else if (pk === "ind") list = kbars(group(/^\/industries\/[^/]+$/), { share: false, empty: "아직 업종 페이지 조회 기록이 없습니다." });
      else if (pk === "cases") list = '<div class="ksub">시공 사례 · 프로젝트 페이지</div>' + kbars(group(/^\/(projects\/[^/]+|portfolio)$/), { share: false, empty: "아직 조회 기록이 없습니다." }) +
        '<div class="ksub">많이 열어 본 톤앤매너 레퍼런스</div>' + kbars(d.archive.map(function (r) { return { k: r.label, n: r.n }; }), { share: false, empty: "아직 열어 본 레퍼런스가 없습니다." });
      else list = kbars(d.topClicks.filter(function (r) { return r.kind !== "menu"; }).slice(0, 12).map(function (r) { return { k: r.label, sub: CLICK_KIND[r.kind] || r.kind, n: r.n }; }), { share: false, empty: "아직 클릭 기록이 없습니다." }) +
        (d.contact.kinds.length ? '<div class="ksub">상담 연결 클릭 내역</div>' + kbars(d.contact.kinds.filter(function (r) { return KPI_CONTACT[r.kind]; }).map(function (r) { return { k: KPI_CONTACT[r.kind], n: r.n }; }), { empty: "–" }) : "");
      el.innerHTML = list;
    };
    drawPop();
    $$("#kp-tabs button").forEach(function (b) { b.addEventListener("click", function () { pk = kpiRender.pop = b.dataset.k; $$("#kp-tabs button").forEach(function (o) { o.classList.toggle("on", o === b); }); drawPop(); }); });
    // 시간대 · 요일
    var hrs = []; for (var i = 0; i < 24; i++) hrs.push(0);
    d.hours.forEach(function (r) { if (r.hour >= 0 && r.hour < 24) hrs[r.hour] = r.n; });
    colChart($("#k-hours"), hrs.map(function (v, i) { return { v: v, label: i % 3 === 0 ? i + "시" : "", tip: "<b>" + nf(v) + "</b> 페이지뷰<span class=\"kc-tip__d\">" + i + "시 ~ " + (i + 1) + "시</span>" }; }), { height: 190, maxLabels: 24, title: "시간대별 페이지뷰" });
    var wd = [0, 0, 0, 0, 0, 0, 0];
    d.weekdays.forEach(function (r) { if (r.wd >= 0 && r.wd < 7) wd[r.wd] = r.n; });
    colChart($("#k-wd"), [1, 2, 3, 4, 5, 6, 0].map(function (i) { return { v: wd[i], label: WD_KO[i], tip: "<b>" + nf(wd[i]) + "</b> 페이지뷰<span class=\"kc-tip__d\">" + WD_KO[i] + "요일</span>" }; }), { height: 190, maxLabels: 7, title: "요일별 페이지뷰" });
    $("#k-off").addEventListener("change", function () { notrack(this.checked); toast(this.checked ? "이 브라우저의 방문은 이제 통계에서 빠집니다." : "이 브라우저의 방문도 통계에 들어갑니다."); });
    // 창 크기가 바뀌면 차트를 다시 그립니다
    clearTimeout(kpiRender._rz);
    window.onresize = function () { clearTimeout(kpiRender._rz); kpiRender._rz = setTimeout(function () { if ($("#k-hours") && $("#kbody")) kpiRender(d, R); }, 250); };
    $("#k-csv").onclick = function () {
      var qq = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
      var L = [["날짜", "방문자", "페이지뷰", "방문 수", "상담 연결 클릭", "상담 문의", "신규 회원"].map(qq).join(",")];
      days.forEach(function (x) { var r = byDay[x]; L.push([x, r.uv, r.pv, r.ses, r.contact, r.inq, r.mem].map(qq).join(",")); });
      L.push("");
      L.push(["페이지", "주소", "조회수", "방문자", "평균 체류(초)", "스크롤(%)", "상담 클릭", "첫 방문"].map(qq).join(","));
      pages.forEach(function (p) { L.push([titleOf(p), p.path, p.pv, p.uv, Math.round(p.dur || 0), Math.round(p.depth || 0), pc[p.path] || 0, p.ent].map(qq).join(",")); });
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + L.join("\n")], { type: "text/csv" })); a.download = "coremood-kpi-" + d.from + "_" + d.to + ".csv"; a.click();
    };
  }

  /* ---------- 회원 ---------- */
  var MEM_STAGES = ["창업 준비 중", "매장 운영 중 · 리뉴얼 검토", "건물주 · 공실 활용", "프랜차이즈 · 다점포", "기타"];
  var MEM_INTERESTS = ["브랜딩 · 네이밍", "공간 콘셉트", "인테리어 설계 · 시공", "가구 스타일링 · 톤앤매너", "마케팅 · 콘텐츠", "창업 교육 · 컨설팅"];
  function digitsOf(v) { return String(v || "").replace(/[^0-9]/g, ""); }
  function membersView(openId) {
    var f = membersView.f || { st: "", q: "", biz: "" };
    shell("members", "회원", "홈페이지에서 가입한 회원과 직접 등록한 회원을 관리합니다. 비밀번호 없는 소식 받기 회원입니다.",
      '<button class="btn btn--ghost" id="m-csv">CSV 내려받기</button><button class="btn" id="m-add">회원 직접 등록</button>',
      '<div id="memBody"><div class="panel"><div class="empty">불러오는 중…</div></div></div>');
    api("/api/admin/members").then(function (r) {
      var box = $("#memBody"); if (!box) return;
      if (!r.ok) {
        box.innerHTML = '<div class="panel"><div class="note warn">' + (r.reason === "not-configured" ? 'D1 데이터베이스가 연결되지 않았습니다. <a href="#/setup">설정 점검</a>을 확인해 주세요.' : r._status === 0 || r._status === 404 ? "서버 기능에 연결하지 못했습니다. 배포된 주소(coremood.kr/admin)에서 열어 주세요." : "회원 목록을 불러오지 못했습니다 (" + h(r.reason || r.error || r._status) + ").") + "</div></div>";
        $("#m-add").disabled = true; $("#m-csv").disabled = true;
        return;
      }
      var items = r.items || [], sel = openId || null;
      var ST = [["", "전체"], ["active", "활동"], ["mk", "소식 수신 동의"], ["unsub", "탈퇴 · 수신 거부"]];
      function match(x) {
        if (f.st === "active" && x.status !== "active") return false;
        if (f.st === "unsub" && x.status !== "unsub") return false;
        if (f.st === "mk" && !(x.status === "active" && x.marketing)) return false;
        if (f.biz && x.biz !== f.biz) return false;
        if (f.q) {
          var hay = [x.name, x.email, x.phone, x.biz, x.stage, (x.interests || []).join(" "), x.memo, x.src].join(" ").toLowerCase();
          if (f.q.toLowerCase().split(/\s+/).some(function (w) { return hay.indexOf(w) < 0; })) return false;
        }
        return true;
      }
      var bizList = []; items.forEach(function (x) { if (x.biz && bizList.indexOf(x.biz) < 0) bizList.push(x.biz); });
      function draw() {
        var list = items.filter(match);
        var thisMonth = todayKST().slice(0, 7);
        var monthN = items.filter(function (x) { return toLocalInput(x.createdAt).slice(0, 7) === thisMonth; }).length;
        box.innerHTML = '<div class="grid g4" style="margin-bottom:16px">' +
          stat("전체 회원", items.filter(function (x) { return x.status === "active"; }).length, "명", "탈퇴 · 수신 거부 " + items.filter(function (x) { return x.status === "unsub"; }).length + "명 별도") +
          stat("이번 달 가입", monthN, "명", thisMonth.replace("-", "년 ") + "월") +
          stat("소식 수신 동의", items.filter(function (x) { return x.status === "active" && x.marketing; }).length, "명", "이메일·문자 발송 가능") +
          stat("홈페이지 가입", items.filter(function (x) { return x.channel === "홈페이지"; }).length, "명", "직접 등록 " + items.filter(function (x) { return x.channel !== "홈페이지"; }).length + "명") + "</div>" +
          '<div class="inq"><div class="panel"><div class="bar"><div class="filters" id="m-st">' + ST.map(function (s) {
            var n = s[0] === "" ? items.length : s[0] === "mk" ? items.filter(function (x) { return x.status === "active" && x.marketing; }).length : items.filter(function (x) { return x.status === s[0]; }).length;
            return '<button class="chip' + (f.st === s[0] ? " on" : "") + '" data-f="' + s[0] + '">' + s[1] + " " + n + "</button>";
          }).join("") + '</div></div><div class="bar"><input class="in" id="m-q" style="max-width:280px" placeholder="이름·연락처·이메일·관심 분야 검색" value="' + h(f.q) + '">' +
          '<select class="sel" id="m-biz" style="max-width:180px"><option value="">모든 업종</option>' + bizList.map(function (b) { return "<option" + (f.biz === b ? " selected" : "") + ">" + h(b) + "</option>"; }).join("") + "</select></div>" +
          '<div class="tblwrap"><table class="tbl"><thead><tr><th>가입</th><th>회원</th><th class="hide-m">업종 · 상황</th><th class="hide-m">관심 분야</th><th>소식</th></tr></thead><tbody>' +
          (list.map(function (x) {
            return '<tr class="click' + (x.id === sel ? " sel" : "") + '" data-id="' + h(x.id) + '"><td style="white-space:nowrap">' + fmtDT(x.createdAt).slice(0, 12) + '<span class="tiny" style="display:block">' + h(x.channel === "홈페이지" ? "홈페이지" : "직접 등록") + "</span></td>" +
              '<td class="t">' + h(x.name || "(이름 없음)") + "<span>" + h(x.phone || x.email || "-") + '</span></td><td class="hide-m">' + h(x.biz || "-") + '<span class="tiny" style="display:block">' + h(x.stage || "") + '</span></td><td class="hide-m tiny">' + h((x.interests || []).join(", ") || "-") + "</td>" +
              "<td>" + (x.status === "unsub" ? '<span class="badge closed">탈퇴</span>' : x.marketing ? '<span class="badge won">동의</span>' : '<span class="badge">미동의</span>') + "</td></tr>";
          }).join("") || '<tr><td colspan="5"><div class="empty">' + (items.length ? "조건에 맞는 회원이 없습니다." : "아직 가입한 회원이 없습니다. 홈페이지 하단과 저널 글 끝의 ‘회원 가입’ 링크(/join)로 가입할 수 있습니다.") + "</div></td></tr>") +
          '</tbody></table></div></div><div class="panel inq__d" id="memD"><div class="empty">왼쪽에서 회원을 고르세요.</div></div></div>';
        $$("#m-st .chip").forEach(function (c) { c.addEventListener("click", function () { f.st = c.dataset.f; membersView.f = f; draw(); }); });
        var qi = $("#m-q"); qi.addEventListener("input", function () { f.q = qi.value; membersView.f = f; clearTimeout(qi._t); qi._t = setTimeout(function () { draw(); var n = $("#m-q"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); });
        $("#m-biz").addEventListener("change", function () { f.biz = this.value; membersView.f = f; draw(); });
        $$("tr[data-id]", box).forEach(function (tr) { tr.addEventListener("click", function () { sel = tr.dataset.id; history.replaceState(null, "", "#/member/" + encodeURIComponent(sel)); draw(); }); });
        if (sel) detail();
      }
      function detail() {
        var x = items.filter(function (y) { return y.id === sel; })[0];
        var D = $("#memD"); if (!x || !D) return;
        var row = function (k, v) { return "<dt>" + k + "</dt><dd>" + (v ? h(v) : '<span class="muted">-</span>') + "</dd>"; };
        D.innerHTML = "<h2>" + h(x.name || "(이름 없음)") + " <small>" + (x.status === "unsub" ? '<span class="badge closed">탈퇴 · 수신 거부</span>' : '<span class="badge contacted">활동</span>') + "</small></h2>" +
          '<div class="row" style="margin-bottom:14px">' + (x.phone ? '<a class="btn btn--sm" href="tel:' + h(telHref(x.phone)) + '">전화</a><a class="btn btn--ghost btn--sm" href="sms:' + h(telHref(x.phone)) + '">문자</a>' : "") + (x.email ? '<a class="btn btn--ghost btn--sm" href="mailto:' + h(x.email) + '">메일</a>' : "") + "</div>" +
          '<dl class="kv">' + row("가입", fmtDT(x.createdAt) + " · " + (x.channel || "")) + (x.updatedAt && x.updatedAt !== x.createdAt ? row("최근 수정", fmtDT(x.updatedAt) + (x.updatedBy ? " · " + x.updatedBy : "")) : "") +
          row("유입 경로", x.src) + row("첫 방문", x.landing) + "</dl>" +
          '<div class="grid g2" style="margin-top:14px"><div class="f"><label for="md-name">성함</label><input class="in" id="md-name" value="' + h(x.name) + '"></div><div class="f"><label for="md-phone">연락처</label><input class="in" id="md-phone" value="' + h(x.phone) + '"></div>' +
          '<div class="f"><label for="md-email">이메일</label><input class="in" id="md-email" value="' + h(x.email) + '"></div><div class="f"><label for="md-biz">업종</label><input class="in" id="md-biz" value="' + h(x.biz) + '"></div>' +
          '<div class="f"><label for="md-stage">지금 상황</label><select class="sel" id="md-stage"><option value="">선택 안 함</option>' + MEM_STAGES.map(function (s) { return "<option" + (x.stage === s ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></div>" +
          '<div class="f"><label for="md-st">상태</label><select class="sel" id="md-st"><option value="active"' + (x.status === "active" ? " selected" : "") + '>활동</option><option value="unsub"' + (x.status === "unsub" ? " selected" : "") + ">탈퇴 · 수신 거부</option></select></div></div>" +
          '<div class="f" style="margin-top:14px"><label>관심 분야</label><div class="row" id="md-int">' + MEM_INTERESTS.map(function (s) { return '<label class="chk"><input type="checkbox" value="' + h(s) + '"' + ((x.interests || []).indexOf(s) >= 0 ? " checked" : "") + "> " + h(s) + "</label>"; }).join("") + "</div></div>" +
          '<label class="chk" style="margin:4px 0 10px"><input type="checkbox" id="md-mk"' + (x.marketing ? " checked" : "") + "> 소식 수신 동의 (이메일 · 문자)</label>" +
          '<div class="f"><label for="md-memo">메모</label><textarea class="ta" id="md-memo" style="min-height:72px">' + h(x.memo || "") + "</textarea></div>" +
          '<div class="row" style="margin-top:12px;justify-content:space-between"><button class="btn" id="md-save">저장</button><button class="btn btn--danger btn--sm" id="md-del">완전 삭제</button></div>' +
          '<h2 style="margin-top:22px">상담 문의 이력</h2><div id="md-inq"><div class="tiny">찾는 중…</div></div>';
        loadInquiries().then(function (q) {
          var el = $("#md-inq"); if (!el) return;
          var dg = digitsOf(x.phone), em = (x.email || "").toLowerCase();
          var hit = (q.items || []).filter(function (y) { return (dg && digitsOf(y.phone) === dg) || (em && (y.email || "").toLowerCase() === em); });
          el.innerHTML = hit.length ? '<table class="tbl"><tbody>' + hit.map(function (y) { return '<tr class="click" data-go="#/inquiry/' + encodeURIComponent(y.id) + '"><td class="t">' + h(y.type || "") + "<span>" + fmtDT(y.createdAt) + '</span></td><td><span class="badge ' + y.status + '">' + inqLabel(y.status) + "</span></td></tr>"; }).join("") + "</tbody></table>" : '<div class="tiny">같은 연락처나 이메일로 들어온 상담 문의가 없습니다.</div>';
          bindGo();
        });
        $("#md-save").addEventListener("click", function () {
          busy("저장하는 중");
          api("/api/admin/members", { method: "PATCH", body: { id: x.id, name: $("#md-name").value, phone: $("#md-phone").value, email: $("#md-email").value, biz: $("#md-biz").value, stage: $("#md-stage").value, status: $("#md-st").value,
            interests: $$("#md-int input:checked").map(function (c) { return c.value; }), marketing: $("#md-mk").checked, memo: $("#md-memo").value } }).then(function (res) {
            busy(); if (!res.ok) return toast("저장하지 못했습니다.", true);
            Object.assign(x, res.item); toast("저장했습니다."); draw();
          });
        });
        $("#md-del").addEventListener("click", function () {
          if (!confirm((x.name || "이") + " 님의 회원 정보를 완전히 삭제할까요? 되돌릴 수 없습니다.\n소식만 그만 받기를 원하시면 상태를 ‘탈퇴 · 수신 거부’로 바꾸는 방법도 있습니다.")) return;
          api("/api/admin/members?id=" + encodeURIComponent(x.id), { method: "DELETE" }).then(function (res) {
            if (!res.ok) return toast("삭제하지 못했습니다.", true);
            items = items.filter(function (y) { return y.id !== x.id; }); sel = null; history.replaceState(null, "", "#/members"); toast("삭제했습니다."); draw();
          });
        });
      }
      draw();
      $("#m-csv").addEventListener("click", function () {
        var cols = [["createdAt", "가입일시"], ["channel", "가입 경로"], ["status", "상태"], ["name", "성함"], ["phone", "연락처"], ["email", "이메일"], ["biz", "업종"], ["stage", "지금 상황"], ["interests", "관심 분야"], ["marketing", "소식 수신 동의"], ["src", "유입 경로"], ["memo", "메모"]];
        var qq = function (v) { return '"' + String(v == null ? "" : Array.isArray(v) ? v.join(", ") : v).replace(/"/g, '""') + '"'; };
        var csv = "﻿" + cols.map(function (c) { return qq(c[1]); }).join(",") + "\n" + items.filter(match).map(function (x) {
          return cols.map(function (c) { var v = x[c[0]]; return qq(c[0] === "createdAt" ? fmtDT(v) : c[0] === "status" ? (v === "unsub" ? "탈퇴 · 수신 거부" : "활동") : c[0] === "marketing" ? (v ? "동의" : "미동의") : v); }).join(",");
        }).join("\n");
        var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "coremood-members-" + todayKST() + ".csv"; a.click();
      });
      $("#m-add").addEventListener("click", function () {
        var m = document.createElement("div"); m.className = "modal";
        m.innerHTML = '<div class="modal__box" style="max-width:620px"><div class="modal__h"><h2 style="font-size:1.05rem">회원 직접 등록</h2><button class="btn btn--ghost btn--sm" data-x>닫기</button></div>' +
          '<p class="small muted" style="margin-bottom:12px">상담이나 행사에서 소식 받기를 원한 분을 등록합니다. 수신 동의는 본인에게 받은 경우에만 체크해 주세요.</p>' +
          '<div class="grid g2"><div class="f"><label>성함</label><input class="in" name="name"></div><div class="f"><label>연락처</label><input class="in" name="phone"></div>' +
          '<div class="f"><label>이메일</label><input class="in" name="email"></div><div class="f"><label>업종</label><select class="sel" name="biz"><option value="">선택</option>' + BIZ_OPTS.map(function (c) { return "<option>" + c + "</option>"; }).join("") + "</select></div>" +
          '<div class="f"><label>지금 상황</label><select class="sel" name="stage"><option value="">선택</option>' + MEM_STAGES.map(function (c) { return "<option>" + c + "</option>"; }).join("") + '</select></div><div class="f"><label>받은 곳</label><select class="sel" name="channel"><option>상담</option><option>전화</option><option>행사 · 교육</option><option>소개</option><option>기타</option></select></div></div>' +
          '<div class="f"><label>관심 분야</label><div class="row">' + MEM_INTERESTS.map(function (s) { return '<label class="chk"><input type="checkbox" name="int" value="' + h(s) + '"> ' + h(s) + "</label>"; }).join("") + "</div></div>" +
          '<label class="chk"><input type="checkbox" name="mk"> 소식 수신 동의를 받았습니다</label>' +
          '<div class="f" style="margin-top:10px"><label>메모</label><textarea class="ta" name="memo"></textarea></div>' +
          '<div class="row" style="margin-top:14px"><button class="btn" data-save>등록</button></div></div>';
        document.body.appendChild(m);
        var close = function () { m.remove(); };
        $("[data-x]", m).addEventListener("click", close);
        $("[data-save]", m).addEventListener("click", function () {
          var v = function (n) { return $('[name="' + n + '"]', m).value.trim(); };
          if (!v("name") || (!v("phone") && !v("email"))) return toast("성함과, 연락처나 이메일 중 하나는 입력해 주세요.", true);
          busy("등록하는 중");
          api("/api/admin/members", { method: "POST", body: { name: v("name"), phone: v("phone"), email: v("email"), biz: v("biz"), stage: v("stage"), channel: v("channel"), memo: v("memo"),
            interests: $$('[name="int"]:checked', m).map(function (c) { return c.value; }), marketing: $('[name="mk"]', m).checked } }).then(function (res) {
            busy(); if (!res.ok) return toast("등록하지 못했습니다.", true);
            close(); toast("등록했습니다."); items.unshift(res.item); sel = res.item.id; draw();
          });
        });
      });
    });
  }

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
    if (kind === "post") {
      // 검색 결과와 AI 답변에 인용되기 쉬운 구조인지
      var dg = CM.digest(body);
      add(dg.summary.length >= 2 && dg.summary.length <= 4 ? "ok" : "bad", dg.summary.length ? "핵심 요약 " + dg.summary.length + "줄 (2~4줄)" : "핵심 요약(:::summary)이 없습니다 — 본문 맨 위에 2~4줄");
      add(dg.faq.length >= 2 ? "ok" : dg.faq.length ? "warn" : "bad", dg.faq.length ? "자주 묻는 질문 " + dg.faq.length + "개 (권장 2~4개)" : "자주 묻는 질문(:::faq)이 없습니다 — 2~4문항");
      var tm = CM.topicList().filter(function (t) { return CM.inTopic(t, { keyword: d.keyword, tags: d.tags || [] }); });
      add(tm.length ? "ok" : "warn", tm.length ? "주제별 글 모음: " + tm.map(function (t) { return t.name; }).slice(0, 3).join(", ") : "주제별 글 모음에 묶이지 않습니다 — 키워드나 앞쪽 태그 두 개를 확인해 주세요");
    }
    if (/^#\s/m.test(body)) add("bad", "본문에 # 제목(H1)은 쓰지 않습니다");
    var txt = (d.title || "") + " " + (d.description || "") + " " + body;
    BANNED.forEach(function (b) { var m = txt.match(b[0]); if (m) add("bad", b[1] + ": “" + m[0] + "”"); });
    if (/340/.test(txt) && !/10여 년간 340개 이상/.test(txt)) add("bad", "실적은 ‘10여 년간 340개 이상 프로젝트’로만 표기");
    if (/인허가|소방|용도\s*변경|영업\s*신고|전기\s*용량|승압|전기\s*증설/.test(txt) && !/별도\s*(의\s*)?확인/.test(txt)) add("bad", "인허가·소방·전기 용량 언급 시 ‘별도 확인’ 안내 필요");
    var b = (body.match(/^:::[ \t]*\w+/gm) || []).length, e = (body.match(/^:::\s*$/gm) || []).length;
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
    faq: ["\n:::faq\nQ. ", "질문", "\n답변 문단\n\nQ. 다음 질문\n답변\n:::\n"],
    summary: ["\n:::summary\n- ", "제목이 묻는 것에 대한 직접적인 답 한 줄", "\n- 가장 중요한 판단 기준\n- 놓치기 쉬운 조건이나 다음에 할 일\n:::\n"]
  };
  function toolbar(id) {
    return '<div class="tool" data-for="' + id + '">' + [["h2", "소제목"], ["h3", "작은 소제목"], ["b", "굵게"], ["link", "링크"], ["ul", "목록"], ["summary", "핵심 요약"], ["check", "체크리스트"], ["note", "메모"], ["table", "표"], ["spec", "요약표"], ["faq", "FAQ"], ["img", "이미지 넣기"]]
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
        body = ":::summary\n- 제목이 묻는 것에 대한 직접적인 답 한 줄\n- 가장 중요한 판단 기준\n- 놓치기 쉬운 조건이나 다음에 할 일\n:::\n\n도입 문단을 씁니다. 첫 문단에 핵심 키워드를 자연스럽게 한 번 넣어 주세요.\n\n## 첫 번째 소제목\n\n본문\n\n## 두 번째 소제목\n\n본문\n\n## 자주 묻는 질문\n\n:::faq\nQ. 독자가 실제로 물을 질문\n첫 문장에서 바로 답하고, 조건을 덧붙입니다.\n\nQ. 다음 질문\n답변\n:::\n\n## 다음에 할 일\n\n마무리 문단과 [상담 신청](/contact) 같은 관련 페이지 링크.\n";
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
        '<div id="tab-write">' + toolbar("e-body") + '<textarea class="ta ta--code" id="e-body" spellcheck="false">' + h(body) + '</textarea><p class="tiny" style="margin-top:8px">문법 안내: ## 소제목 · **굵게** · [글자](/주소) · :::summary(핵심 요약) / :::check / :::note / :::faq 블록 — 자세한 내용은 사용 안내의 ‘글쓰기 규칙’</p></div>' +
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
    CM.liveTopics(ctx).forEach(function (o) { files.push({ path: "journal/topic/" + o.t.slug + ".html", content: CM.renderTopic(o.t, ctx) }); });
    if (homeHtml && S.pages && S.pages.pages && S.pages.pages.index) files.push({ path: "index.html", content: CM.injectPartials(homeHtml, "index", { posts: live, cases: cases(), pageMeta: S.pages.pages.index }) });
    return { files: files, ctx: ctx };
  }

  function savePost(c, body, orig, origEntry, pend, makeOg) {
    busy("저장하는 중입니다 (최신 목록 확인)");
    var fresh, homeHtml, ogKeys;
    Promise.all([getJson("content/index.json", { posts: [], industries: [], pages: [] }), getText("index.html").catch(function () { return { text: "" }; }), getJson("content/og-keys.json", {}), getText("feed.xml").catch(function () { return { text: "" }; })])
      .then(function (r) {
        fresh = r[0]; homeHtml = r[1].text; ogKeys = r[2];
        var meta = CM.postMeta(c.slug, c, body); meta.slug = c.slug;
        // RSS 본문은 이미 발행된 내용을 그대로 두고 이 글만 새로 만듭니다. 주제 허브의 질문 목록도 이 글 기준으로 맞춥니다
        var dgOne = CM.digest(body), bd = {};
        bd[c.slug] = body;
        meta.fq = dgOne.faq.map(function (f) { return f.q; }); meta.sum = dgOne.summary.length;
        CM.setData({ feedCache: CM.feedCache(r[3].text), bodies: bd });
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
          var keep = S.index; S.index = Object.assign({}, fresh, { posts: posts }); syncSeoData(); S.index = keep;
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
    Promise.all([getJson("content/index.json", { posts: [] }), getText("index.html").catch(function () { return { text: "" }; }), getText("feed.xml").catch(function () { return { text: "" }; })]).then(function (r) {
      var fresh = r[0];
      CM.setData({ feedCache: CM.feedCache(r[2].text), bodies: {} });
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
        S.casesDoc = doc; CM.setData({ cases: cases() }); busy();
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
      '<div class="panel"><h2>검색엔진에 바로 알리기 <small>IndexNow · 네이버 · 빙</small></h2><p class="small muted" style="margin-bottom:10px">새 글이나 고친 페이지 주소를 검색엔진에 즉시 알립니다. 관리자에서 글을 저장할 때, 그리고 매일 아침 자동 발행된 뒤에도 사이트가 바뀐 주소를 찾아 자동으로 보냅니다. 급할 때만 여기서 직접 보내면 됩니다. 한 줄에 주소 하나.</p>' +
      '<textarea class="ta" id="ix" style="min-height:150px">' + h(recent.join("\n")) + '</textarea><div class="row" style="margin-top:10px"><button class="btn btn--olive" id="ix-go">보내기</button></div></div></div>' +
      '<div><div class="panel"><h2>검색엔진 소유확인 <small>HTML 태그 방식 · 권장</small></h2><p class="small muted" style="margin-bottom:12px">네이버 서치어드바이저나 구글 서치 콘솔에서 ‘HTML 태그’를 고르면 나오는 메타 태그를 그대로 붙여 넣으세요. 홈페이지 &lt;head&gt;에 들어가고, 1~2분 뒤 소유확인 버튼을 누르면 됩니다.</p>' +
      '<div class="f"><label for="vt-naver">네이버 <small>' + (vf.naver ? "적용 중" : "미적용") + '</small></label><input class="in" id="vt-naver" value="' + h(vf.naver || "") + '" placeholder="&lt;meta name=&quot;naver-site-verification&quot; content=&quot;…&quot; /&gt;"></div>' +
      '<div class="f"><label for="vt-google">구글 <small>' + (vf.google ? "적용 중" : "미적용") + '</small></label><input class="in" id="vt-google" value="' + h(vf.google || "") + '" placeholder="&lt;meta name=&quot;google-site-verification&quot; content=&quot;…&quot; /&gt;"></div>' +
      '<div class="f"><label for="vt-bing">빙(Bing) <small>' + (vf.bing ? "적용 중" : "미적용") + ' · 구글 서치 콘솔에서 가져오기를 쓰면 비워 둬도 됩니다</small></label><input class="in" id="vt-bing" value="' + h(vf.bing || "") + '" placeholder="&lt;meta name=&quot;msvalidate.01&quot; content=&quot;…&quot; /&gt;"></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn" id="vt-save">소유확인 태그 저장</button><a class="btn btn--ghost" href="/" target="_blank" rel="noopener">홈 열기 ↗</a></div></div>' +
      '<div class="panel"><h2>운영 채널 주소 <small>검색엔진 · AI에 같은 브랜드로 알리기</small></h2><p class="small muted" style="margin-bottom:12px">블로그, 플레이스, 인스타그램 같은 공식 채널 주소를 넣으면 홈페이지 아래쪽에 링크가 생기고, 검색엔진과 AI가 읽는 정보(sameAs)에도 들어가 채널과 홈페이지를 같은 브랜드로 묶어 줍니다. 운영하지 않는 채널은 비워 두세요.</p>' +
      CM.CHANNEL_KEYS.map(function (k) { return '<div class="f"><label for="ch-' + k[0] + '">' + k[1] + '</label><input class="in" id="ch-' + k[0] + '" value="' + h((S.site && S.site.channels && S.site.channels[k[0]]) || "") + '" placeholder="https://"></div>'; }).join("") +
      '<div class="row" style="margin-top:12px"><button class="btn" id="ch-save">채널 주소 저장</button></div><p class="tiny" style="margin-top:10px">홈 화면에는 바로, 나머지 페이지에는 다음 자동 발행(매일 오전 10시) 때 반영됩니다.</p></div>' +
      '<div class="panel"><h2>소유확인 파일 <small>보조 방법</small></h2><p class="small muted" style="margin-bottom:12px">‘HTML 파일 업로드’ 방식용입니다. 호스팅(Cloudflare Pages)이 <code>.html</code> 주소를 확장자 없는 주소로 넘겨 주기 때문에 확인이 실패할 수 있습니다. 가능하면 위의 HTML 태그 방식을 쓰세요.</p>' +
      '<div class="f"><label for="v-name">파일 이름</label><input class="in" id="v-name" placeholder="예: naver1a2b3c....html 또는 google1a2b....html"></div>' +
      '<div class="f"><label for="v-body">파일 내용 <small>받은 파일을 메모장으로 열어 전체 복사</small></label><textarea class="ta" id="v-body" style="min-height:90px"></textarea></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn" id="v-save">사이트에 올리기</button><button class="btn btn--ghost" id="v-file">파일 선택</button></div><div id="v-list" class="tiny" style="margin-top:12px"></div></div>' +
      '<div class="panel"><h2>서버 기능 연결 상태</h2><p class="small">상담 문의 저장, 새 문의 알림, 스팸 방지 연결 상태는 <a href="#/setup">설정 점검</a>에서 확인합니다.</p></div></div></div>';
    shell("settings", "사이트 설정", "공지, 상담 버튼, 방문 분석, 스팸 방지, 검색엔진 등록, 운영 채널", "", body);
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
      var next = { naver: pick($("#vt-naver").value), google: pick($("#vt-google").value), bing: pick($("#vt-bing").value) };
      var home = S.pages && S.pages.pages && S.pages.pages.index;
      if (!home) return toast("홈 페이지 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.", true);
      busy("저장하는 중");
      getText("index.html").then(function (r) {
        S.site = S.site || {}; S.site.verify = next; CM.setVerify(next);
        var html = CM.injectPartials(r.text, "index", { pageMeta: home });
        return commit([{ path: "data/site.json", content: JSON.stringify(S.site, null, 2) + "\n" }, { path: "index.html", content: html }], "verify: 검색엔진 소유확인 태그 " + (next.naver || next.google || next.bing ? "적용" : "삭제"));
      }).then(function () { busy(); toast("저장했습니다. 1~2분 뒤 홈에 반영되면 소유확인 버튼을 눌러 주세요."); settingsView(); })
        .catch(function (e) { busy(); toast("저장하지 못했습니다: " + e.message, true); });
    });
    $("#ch-save").addEventListener("click", function () {
      var next = {}, bad = "";
      CM.CHANNEL_KEYS.forEach(function (k) { var v = $("#ch-" + k[0]).value.trim(); if (v && !/^https:\/\//.test(v)) bad = k[1]; if (v) next[k[0]] = v; });
      if (bad) return toast(bad + " 주소는 https:// 로 시작해야 합니다.", true);
      var home = S.pages && S.pages.pages && S.pages.pages.index;
      if (!home) return toast("홈 페이지 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.", true);
      busy("저장하는 중");
      getText("index.html").then(function (r) {
        S.site = S.site || {}; S.site.channels = next; CM.setData({ channels: next });
        var html = CM.injectPartials(r.text, "index", { posts: livePosts(), cases: cases(), pageMeta: home });
        return commit([{ path: "data/site.json", content: JSON.stringify(S.site, null, 2) + "\n" }, { path: "index.html", content: html }], "site: 운영 채널 주소 " + (Object.keys(next).length ? "설정" : "삭제"));
      }).then(function () { busy(); toast("저장했습니다. 홈 화면에는 1~2분 뒤, 나머지 페이지에는 다음 자동 발행 때 반영됩니다."); })
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
      '<ol class="steps"><li>코어무드 전용 D1 데이터베이스 <code>coremood-db</code>를 씁니다 (위치: Asia Pacific, 2026-11 생성).</li>' +
      "<li><b>Compute → Workers &amp; Pages</b> → <b>coremood</b> → <b>Settings → Bindings</b>에서 Production과 Preview 모두 <code>DB</code> → <code>coremood-db</code>로 연결되어 있는지 확인합니다.</li>" +
      "<li>연결을 바꾼 뒤에는 Deployments에서 최신 배포를 <b>Retry deployment</b> 하거나 새 커밋으로 다시 배포해야 반영됩니다.</li>" +
      "<li>코어무드 표(<code>cm_inquiries</code>, <code>cm_inquiry_notes</code>, <code>cm_auth_cache</code>, 방문 통계 <code>cm_events</code>, 회원 <code>cm_members</code>)는 첫 요청 때 자동으로 만들어집니다. SQL을 따로 실행할 필요가 없습니다.</li></ol>" +
      '<div class="note" style="margin-top:4px">coremood-db를 지우면 상담 문의, 회원, 방문 통계 기록이 모두 사라집니다. 백업이 필요하면 D1의 Time Travel(시점 복구) 기능을 쓸 수 있습니다.</div>' +
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
      '<li class="' + (vf.bing ? "ok" : "warn") + '"><span class="i">' + (vf.bing ? "✓" : "!") + "</span><span>빙(Bing) 웹마스터 도구 " + (vf.bing ? "소유확인 태그 적용됨" : "— bing.com/webmasters 에서 ‘구글 서치 콘솔에서 가져오기’로 등록하면 가장 빠릅니다. 빙에 등록되면 ChatGPT 검색과 코파일럿에도 잡히기 쉬워집니다") + "</span></li>" +
      '<li class="warn"><span class="i">!</span><span>다음(Daum) 검색 등록 — register.search.daum.net 에서 사이트 주소를 한 번 등록합니다</span></li>' +
      '<li class="ok"><span class="i">✓</span><span>새 글·바뀐 페이지를 IndexNow로 네이버·빙에 자동 알림 (관리자 저장 때 + 매일 자동 발행 뒤)</span></li>' +
      '<li class="ok"><span class="i">✓</span><span>AI 검색 대응 파일 — <a href="/robots.txt" target="_blank" rel="noopener">robots.txt</a> · <a href="/llms.txt" target="_blank" rel="noopener">llms.txt</a> · <a href="/llms-full.txt" target="_blank" rel="noopener">llms-full.txt</a> · <a href="/sitemap.xml" target="_blank" rel="noopener">sitemap.xml</a> · <a href="/feed.xml" target="_blank" rel="noopener">feed.xml</a></span></li></ul>' +
      '<div class="su__st" data-st="ix"></div>' +
      '<p class="tiny" style="margin-top:10px">Cloudflare 대시보드의 <b>Security → Bots</b>(또는 AI Audit)에 ‘AI 봇 차단’이 켜져 있으면 ChatGPT·Perplexity 같은 AI 검색이 사이트를 읽지 못합니다. AI 검색 노출을 원하시면 꺼 두세요.</p></section>' +
      '<section class="panel su"><h2>' + mark((cfg.analytics && (cfg.analytics.ga4 || cfg.analytics.naver)) ? "ok" : "off") + ' 5. 방문 분석 <small>선택</small></h2>' +
      '<p class="small" style="margin-bottom:10px">방문자·페이지뷰·체류 시간·클릭은 따로 설정하지 않아도 coremood-db에 모여 <a href="#/kpi">KPI 지표</a>에서 볼 수 있습니다. 아래 서비스는 검색어 분석처럼 더 자세한 정보가 필요할 때 함께 씁니다.</p>' +
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
      put("db", r.db ? '<div class="note">연결됨 · 저장된 문의 ' + r.total + "건 · 회원 " + (r.members || 0) + "명 · 방문 기록 " + nf(r.events || 0) + "건" + (r.eventsSince ? " (" + h(r.eventsSince) + "부터)" : "") + "</div>" : '<div class="note bad">아직 연결되지 않았습니다' + (r.dbError ? " (" + h(r.dbError) + ")" : "") + ". 위 순서대로 연결한 뒤 다시 배포해 주세요.</div>");
      var n = r.notify || {}, any = n.email || n.telegram || n.webhook;
      setMark("su-nt", any ? "ok" : "warn");
      put("nt", '<ul class="seo">' + [["email", "이메일" + (r.notifyEmail ? " → " + r.notifyEmail : "")], ["telegram", "텔레그램"], ["webhook", "웹후크"]].map(function (x) {
        return '<li class="' + (n[x[0]] ? "ok" : "warn") + '"><span class="i">' + (n[x[0]] ? "✓" : "–") + "</span><span>" + h(x[1]) + (n[x[0]] ? " 설정됨" : " 미설정") + "</span></li>";
      }).join("") + "</ul>");
      var ix = r.indexnowAuto;
      put("ix", ix ? '<div class="note' + (ix.ok ? "" : " warn") + '">검색엔진 자동 알림 · 마지막 전송 ' + h(String(ix.at).slice(0, 16).replace("T", " ")) + " (UTC) · 주소 " + ix.count + "개 · " + (ix.ok ? "전송됨" : "응답 오류 — 잠시 뒤 자동으로 다시 시도합니다") + "</div>" : '<div class="tiny">검색엔진 자동 알림 기록이 아직 없습니다. 배포 뒤 첫 방문이 들어오면 사이트맵의 주소를 한 번에 보냅니다.</div>');
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
      "<h3>KPI 지표와 회원</h3><ul><li><b>KPI 지표</b>: 기간을 고르면 방문자, 페이지뷰, 체류 시간, 이탈률, 상담 연결 클릭, 문의 전환율, 회원 가입을 바로 앞 같은 기간과 비교해 보여 줍니다. CSV로 내려받아 보고서에 쓸 수 있습니다.</li><li><b>회원</b>: 홈페이지 /join 에서 가입한 분과 직접 등록한 분을 관리합니다. 소식을 보낼 때는 ‘소식 수신 동의’ 회원만 골라 CSV로 내려받으세요.</li><li>관리자로 로그인한 브라우저의 방문은 통계에서 자동으로 빠집니다.</li></ul>" +
      "<h3>글쓰기 규칙</h3><ul><li>실적은 ‘10여 년간 340개 이상 프로젝트’로만 씁니다.</li><li>최고·1위·보장 같은 표현은 쓰지 않습니다.</li><li>인허가·소방·전기 용량은 ‘별도 확인 항목’으로 안내합니다.</li><li>소제목은 <code>## </code>, 체크리스트는 <code>:::check 제목</code> … <code>:::</code>, 자주 묻는 질문은 <code>:::faq</code> 안에 <code>Q. 질문</code> 다음 줄에 답변.</li><li>글 맨 위에는 <code>:::summary</code> 로 핵심 요약 2~4줄을 넣습니다. 첫 줄은 제목이 묻는 것에 대한 직접적인 답입니다.</li></ul>" +
      "<h3>검색 · AI 검색 노출</h3><ul><li><b>핵심 요약과 FAQ</b>: 글마다 핵심 요약(:::summary)과 자주 묻는 질문(:::faq)을 넣으면 네이버·구글의 요약 답변과 ChatGPT·Perplexity 같은 AI 검색이 가져다 쓰기 쉬워집니다. 편집 화면 오른쪽 점검 목록에서 확인할 수 있습니다.</li>" +
      "<li><b>주제별 글 모음</b>: 글의 키워드와 앞쪽 태그 두 개에 따라 <code>/journal/topic/…</code> 페이지에 자동으로 묶입니다. 주제 목록은 저장소의 <code>data/topics.json</code> 에서 고칩니다.</li>" +
      "<li><b>용어 사전 · 사이트 검색</b>: <code>/glossary</code> 는 <code>data/glossary.json</code> 에서 고치고, <code>/search</code> 의 검색 색인은 매일 자동 발행 때 다시 만들어집니다. 관리자에서 방금 저장한 글은 다음 날 아침부터 검색에 나옵니다.</li>" +
      "<li><b>방문자가 찾은 말</b>: KPI 지표의 ‘사이트 안에서 찾은 말’에서 결과가 없었던 검색어를 보고 발행 계획에 주제를 보태세요.</li>" +
      "<li><b>운영 채널</b>: 사이트 설정에 블로그·인스타그램 주소를 넣으면 검색엔진이 채널과 홈페이지를 같은 브랜드로 묶어 봅니다.</li></ul>" +
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
    // 관리자 브라우저의 홈페이지 방문은 기본으로 통계에서 뺍니다 (KPI 지표 화면 아래에서 바꿀 수 있음)
    try { if (localStorage.getItem("cm_notrack") === null) localStorage.setItem("cm_notrack", "1"); } catch (e) {}
    busy("데이터를 불러오는 중");
    return loadAll().then(function () { busy(); route(); }).catch(function (e) { busy(); toast("불러오지 못했습니다: " + e.message, true); route(); });
  }
  S.token = savedToken();
  if (!S.token) loginView();
  else verify().then(boot).catch(function (e) { storeToken(""); S.token = ""; loginView(e.message); });
})();
