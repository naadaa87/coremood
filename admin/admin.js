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
      fetch("/data/images.json", { cache: "no-store" }).then(function (r) { return r.json(); }).catch(function () { return getJson("data/images.json", { images: [] }); })
    ]).then(function (r) {
      S.index = r[0]; S.queue = r[1]; S.site = r[2]; S.pages = r[3]; S.images = (r[4] && r[4].images) || [];
      CM.setVerify(S.site && S.site.verify); // 홈 <head> 를 다시 만들 때 소유확인 태그를 유지
    });
  }

  /* ---------- shell ---------- */
  var NAV = [
    ["dashboard", "대시보드"], ["posts", "저널 글"], ["queue", "발행 계획"], ["industries", "업종 페이지"],
    ["inquiries", "상담 문의"], ["pages", "페이지 SEO"], ["settings", "사이트 설정"], ["help", "사용 안내"]
  ];
  function shell(key, title, sub, acts, body) {
    var newCount = S.server && S.server.newInq ? '<span class="n">' + S.server.newInq + "</span>" : "";
    app.className = "";
    app.innerHTML = '<div class="mtop"><span class="mark">코어무드<i>.</i></span><button type="button" id="mnav">메뉴</button></div>' +
      '<div class="shell"><aside class="side" id="side"><span class="mark">코어무드<i>.</i></span><span class="side__en">Site Admin</span><nav>' +
      NAV.map(function (n) { return '<a href="#/' + n[0] + '"' + (n[0] === key ? ' class="on"' : "") + "><span>" + n[1] + "</span>" + (n[0] === "inquiries" ? newCount : "") + "</a>"; }).join("") +
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
    var fn = { dashboard: dashboard, posts: postsView, queue: queueView, industries: industriesView, inquiries: inquiriesView, pages: pagesView, settings: settingsView, help: helpView }[v] || dashboard;
    fn();
  }
  window.addEventListener("hashchange", function () { if (S.token) route(); });

  /* ---------- dashboard ---------- */
  function dashboard() {
    var posts = (S.index.posts || []).map(function (p) { p.status = statusOf(p); return p; });
    var live = posts.filter(function (p) { return p.status === "live"; });
    var monthKey = toLocalInput().slice(0, 7);
    var month = live.filter(function (p) { return toLocalInput(p.date).slice(0, 7) === monthKey; }).length;
    var sched = posts.filter(function (p) { return p.status === "scheduled"; }).length;
    var drafts = posts.filter(function (p) { return p.status === "draft"; }).length;
    var pending = ((S.queue && S.queue.items) || []).filter(function (x) { return x.status === "pending"; }).length;
    var lastAuto = live[0];
    var issues = [];
    live.forEach(function (p) {
      var dl = (p.description || "").length;
      if (dl < 70 || dl > 160) issues.push([p, "설명 " + dl + "자"]);
      if ((p.title || "").length > 45) issues.push([p, "제목 " + p.title.length + "자"]);
    });
    var body = '<div class="grid g4">' +
      stat("공개된 글", live.length, "편", "이번 달 " + month + "편") +
      stat("예약 · 임시저장", sched + drafts, "편", "예약 " + sched + " · 임시저장 " + drafts) +
      stat("발행 계획 대기", pending, "개", S.queue && S.queue.paused ? "자동 발행 일시중지 중" : "매일 오전 10시 자동 발행") +
      '<div class="stat" id="inqStat"><div class="stat__k">새 상담 문의</div><div class="stat__v">–</div><div class="stat__n">확인 중…</div></div>' +
      "</div>" +
      '<div class="grid g2" style="margin-top:16px"><div class="panel"><h2>최근 글 <small><a href="#/posts">전체 보기</a></small></h2>' +
      (posts.length ? '<table class="tbl"><tbody>' + CM.sortPosts(posts).slice(0, 7).map(function (p) {
        return '<tr class="click" data-go="#/post/' + encodeURIComponent(p.slug) + '"><td class="t">' + h(p.title) + "<span>" + catName(p.category) + " · " + fmtDT(p.date) + '</span></td><td><span class="badge ' + p.status + '">' + STATUS_TXT[p.status] + "</span></td></tr>";
      }).join("") + "</tbody></table>" : '<div class="empty">아직 글이 없습니다.</div>') + "</div>" +
      '<div class="panel"><h2>바로 하기</h2><div class="row"><a class="btn" href="#/post/new">새 글 쓰기</a><a class="btn btn--ghost" href="#/queue">발행 계획에 주제 추가</a><a class="btn btn--ghost" href="#/inquiries">상담 문의 보기</a></div>' +
      '<h2 style="margin-top:22px">자동 발행</h2><p class="small">' + (S.queue && S.queue.paused ? "현재 <b>일시중지</b> 상태입니다. 발행 계획 화면에서 다시 켤 수 있습니다." : "매일 오전 10시에 발행 계획의 다음 주제로 글이 올라갑니다. 대기 주제가 없으면 분류를 돌아가며 새 주제를 정합니다.") +
      (lastAuto ? "<br><span class=\"muted\">가장 최근 글: " + h(lastAuto.title) + " (" + fmtDT(lastAuto.date) + ")</span>" : "") + "</p>" +
      '<h2 style="margin-top:22px">검색 등록 바로가기</h2><div class="row">' +
      '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://searchadvisor.naver.com/console/board">네이버 서치어드바이저 ↗</a>' +
      '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://search.google.com/search-console">구글 서치 콘솔 ↗</a>' +
      '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://dash.cloudflare.com/">Cloudflare ↗</a>' +
      '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://github.com/' + REPO + '">GitHub 저장소 ↗</a></div></div></div>' +
      '<div class="panel" style="margin-top:16px"><h2>점검이 필요한 글 <small>제목 45자 초과 · 설명 70~160자 범위 밖</small></h2>' +
      (issues.length ? '<table class="tbl"><tbody>' + issues.slice(0, 10).map(function (x) { return '<tr class="click" data-go="#/post/' + encodeURIComponent(x[0].slug) + '"><td class="t">' + h(x[0].title) + '</td><td><span class="badge scheduled">' + h(x[1]) + "</span></td></tr>"; }).join("") + "</tbody></table>" : '<div class="empty">지금은 손볼 글이 없습니다.</div>') + "</div>";
    shell("dashboard", "대시보드", "코어무드 홈페이지 운영 현황입니다.", '<button class="btn btn--ghost" id="reload">새로고침</button>', body);
    bindGo();
    $("#reload").addEventListener("click", function () { busy("최신 상태를 불러오는 중"); loadAll().then(function () { busy(); dashboard(); }); });
    api("/api/admin/inquiries").then(function (r) {
      var el = $("#inqStat"); if (!el) return;
      if (r.ok) {
        var n = r.items.filter(function (x) { return x.status === "new"; }).length;
        S.server = S.server || {}; S.server.newInq = n;
        el.innerHTML = '<div class="stat__k">새 상담 문의</div><div class="stat__v">' + n + '<small>건</small></div><div class="stat__n">전체 ' + r.total + "건</div>";
        var nav = $('.side nav a[href="#/inquiries"]'); if (nav && n) nav.insertAdjacentHTML("beforeend", '<span class="n">' + n + "</span>");
      } else {
        el.innerHTML = '<div class="stat__k">새 상담 문의</div><div class="stat__v">–</div><div class="stat__n">' + (r.reason === "not-configured" ? "문의 저장소 연결 전 (사용 안내 참고)" : "사이트 배포 후 확인됩니다") + "</div>";
      }
    });
  }
  function stat(k, v, unit, n) { return '<div class="stat"><div class="stat__k">' + k + '</div><div class="stat__v">' + v + "<small>" + unit + '</small></div><div class="stat__n">' + h(n) + "</div></div>"; }
  function bindGo() { $$("[data-go]").forEach(function (el) { el.addEventListener("click", function (e) { if (e.target.closest("a,button")) return; location.hash = el.dataset.go; }); }); }

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
    var ctx = { posts: live, now: Date.now() };
    var files = [
      { path: "journal/index.html", content: CM.renderJournalIndex(ctx) },
      { path: "sitemap.xml", content: CM.renderSitemap(ctx) },
      { path: "feed.xml", content: CM.renderFeed(ctx) },
      { path: "data/posts.json", content: CM.postsJson(ctx) }
    ];
    CM.CAT_ORDER.forEach(function (k) { files.push({ path: "journal/category/" + k + ".html", content: CM.renderCategory(k, ctx) }); });
    if (homeHtml && S.pages && S.pages.pages && S.pages.pages.index) files.push({ path: "index.html", content: CM.injectPartials(homeHtml, "index", { posts: live, pageMeta: S.pages.pages.index }) });
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
        '<div class="f"><label for="i-ba">시공 전후 사례</label><select class="sel" id="i-ba"><option value="">표시 안 함</option>' + Object.keys(CM.BA).map(function (k) { return '<option value="' + k + '"' + (d.ba === k ? " selected" : "") + ">" + CM.BA[k][0] + "</option>"; }).join("") + "</select></div>" +
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
          var ctx = { posts: livePosts(fresh.posts) };
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

  /* ---------- inquiries ---------- */
  var INQ_ST = [["new", "새 문의"], ["contacted", "연락 완료"], ["meeting", "미팅·실측"], ["quoted", "견적 발송"], ["won", "계약"], ["hold", "보류"], ["closed", "종료"]];
  function inqLabel(k) { for (var i = 0; i < INQ_ST.length; i++) if (INQ_ST[i][0] === k) return INQ_ST[i][1]; return k; }
  function inquiriesView() {
    shell("inquiries", "상담 문의", "홈페이지 상담 신청 폼으로 들어온 문의입니다.", '<button class="btn btn--ghost" id="csv">CSV 내려받기</button>', '<div id="inqBody"><div class="panel"><div class="empty">불러오는 중…</div></div></div>');
    api("/api/admin/inquiries?full=1").then(function (r) {
      var box = $("#inqBody"); if (!box) return;
      if (!r.ok) {
        box.innerHTML = '<div class="panel"><div class="note warn">' + (r.reason === "not-configured"
          ? "문의 저장소가 아직 연결되지 않았습니다. 지금은 상담 신청이 메일 앱으로 전달됩니다. <a href=\"#/help\">사용 안내 → ‘상담 문의 저장 켜기’</a>를 따라 한 번만 설정하면 이 화면에서 문의를 관리할 수 있습니다."
          : r._status === 0 || r._status === 404 ? "서버 기능에 연결하지 못했습니다. 사이트가 배포된 주소(coremood.kr/admin)에서 열어 주세요." : "문의를 불러오지 못했습니다 (" + h(r.error || r.reason || r._status) + ").") + "</div></div>";
        return;
      }
      var items = r.items || [];
      S.server = S.server || {}; S.server.newInq = items.filter(function (x) { return x.status === "new"; }).length;
      var f = inquiriesView.f || "";
      var sel = null;
      function draw() {
        var list = items.filter(function (x) { return !f || x.status === f; });
        box.innerHTML = '<div class="inq"><div class="panel"><div class="bar"><div class="filters">' + [["", "전체"]].concat(INQ_ST).map(function (s) {
          var n = s[0] ? items.filter(function (x) { return x.status === s[0]; }).length : items.length;
          return '<button class="chip' + (f === s[0] ? " on" : "") + '" data-f="' + s[0] + '">' + s[1] + " " + n + "</button>";
        }).join("") + '</div></div><div class="tblwrap"><table class="tbl"><thead><tr><th>접수</th><th>성함</th><th class="hide-m">업종 · 지역</th><th>상태</th></tr></thead><tbody>' +
          (list.map(function (x) { return '<tr class="click" data-id="' + h(x.id) + '"><td>' + fmtDT(x.createdAt) + '</td><td class="t">' + h(x.name) + "<span>" + h(x.phone) + '</span></td><td class="hide-m">' + h(x.biz || "-") + " · " + h(x.region || "-") + '</td><td><span class="badge ' + x.status + '">' + inqLabel(x.status) + "</span></td></tr>"; }).join("") || '<tr><td colspan="4"><div class="empty">문의가 없습니다.</div></td></tr>') +
          '</tbody></table></div></div><div class="panel" id="inqD"><div class="empty">왼쪽에서 문의를 고르세요.</div></div></div>';
        $$("[data-f]", box).forEach(function (c) { c.addEventListener("click", function () { f = c.dataset.f; inquiriesView.f = f; draw(); }); });
        $$("tr[data-id]", box).forEach(function (tr) { tr.addEventListener("click", function () { sel = tr.dataset.id; detail(); }); });
        if (sel) detail();
      }
      function detail() {
        var x = items.filter(function (y) { return y.id === sel; })[0]; if (!x) return;
        var row = function (k, v) { return "<dt>" + k + "</dt><dd>" + (v ? h(v) : '<span class="muted">-</span>') + "</dd>"; };
        $("#inqD").innerHTML = "<h2>" + h(x.name) + " <small>" + fmtDT(x.createdAt) + '</small></h2><dl class="kv">' +
          row("연락처", x.phone) + row("이메일", x.email) + row("업종", x.biz) + row("지역", x.region) + row("면적", x.area ? x.area + "평" : "") + row("희망 사양", x.grade) +
          row("오픈 시기", x.open) + row("예산", x.budget) + row("진행 상태", x.stage) + row("관심 서비스", (x.svc || []).join(", ")) + row("남긴 말", x.note) + row("접수 페이지", x.page) + "</dl>" +
          '<div class="row" style="margin-top:14px"><a class="btn btn--sm" href="tel:' + h((x.phone || "").replace(/[^0-9+]/g, "")) + '">전화 걸기</a>' + (x.email ? '<a class="btn btn--ghost btn--sm" href="mailto:' + h(x.email) + '?subject=' + encodeURIComponent("[코어무드] 상담 신청 회신드립니다") + '">메일 쓰기</a>' : "") + "</div>" +
          '<div class="f" style="margin-top:16px"><label for="d-st">진행 상태</label><select class="sel" id="d-st">' + INQ_ST.map(function (s) { return '<option value="' + s[0] + '"' + (x.status === s[0] ? " selected" : "") + ">" + s[1] + "</option>"; }).join("") + "</select></div>" +
          '<div class="f"><label for="d-memo">메모 <small>내부용</small></label><textarea class="ta" id="d-memo">' + h(x.memo || "") + "</textarea></div>" +
          '<div class="row" style="margin-top:12px;justify-content:space-between"><button class="btn" id="d-save">저장</button><button class="btn btn--danger btn--sm" id="d-del">삭제</button></div>' +
          (x.updatedAt ? '<p class="tiny" style="margin-top:10px">마지막 수정 ' + fmtDT(x.updatedAt) + "</p>" : "");
        $("#d-save").addEventListener("click", function () {
          busy("저장하는 중");
          api("/api/admin/inquiries", { method: "PATCH", body: { id: x.id, status: $("#d-st").value, memo: $("#d-memo").value } }).then(function (res) {
            busy(); if (!res.ok) return toast("저장하지 못했습니다.", true);
            Object.assign(x, res.item); toast("저장했습니다."); draw();
          });
        });
        $("#d-del").addEventListener("click", function () {
          if (!confirm(x.name + " 님의 문의를 삭제할까요? 되돌릴 수 없습니다.")) return;
          api("/api/admin/inquiries?id=" + encodeURIComponent(x.id), { method: "DELETE" }).then(function (res) {
            if (!res.ok) return toast("삭제하지 못했습니다.", true);
            items = items.filter(function (y) { return y.id !== x.id; }); sel = null; toast("삭제했습니다."); draw();
          });
        });
      }
      draw();
      $("#csv").addEventListener("click", function () {
        var cols = [["createdAt", "접수일시"], ["status", "상태"], ["name", "성함"], ["phone", "연락처"], ["email", "이메일"], ["biz", "업종"], ["region", "지역"], ["area", "면적"], ["grade", "사양"], ["open", "오픈 시기"], ["budget", "예산"], ["stage", "진행 상태"], ["svc", "관심 서비스"], ["note", "남긴 말"], ["memo", "메모"]];
        var q = function (v) { return '"' + String(v == null ? "" : Array.isArray(v) ? v.join(", ") : v).replace(/"/g, '""') + '"'; };
        var csv = "﻿" + cols.map(function (c) { return q(c[1]); }).join(",") + "\n" + items.map(function (x) { return cols.map(function (c) { return q(c[0] === "createdAt" ? fmtDT(x[c[0]]) : c[0] === "status" ? inqLabel(x.status) : x[c[0]]); }).join(","); }).join("\n");
        var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "coremood-inquiries-" + toLocalInput().slice(0, 10) + ".csv"; a.click();
      });
    });
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
    var recent = livePosts().slice(0, 10).map(function (p) { return SITE.url + "/journal/" + p.slug; });
    var body = '<div class="grid g2" style="align-items:start"><div>' +
      '<div class="panel"><h2>상단 공지 띠</h2><p class="small muted" style="margin-bottom:12px">모든 페이지 맨 위에 한 줄 공지를 띄웁니다. 휴무 안내, 이벤트, 상담 일정 공지에 쓰세요.</p>' +
      '<label class="switch"><input type="checkbox" id="n-on"' + (n.enabled ? " checked" : "") + '><i></i><span>공지 띄우기</span></label>' +
      '<div class="f" style="margin-top:14px"><label for="n-text">공지 문구</label><input class="in" id="n-text" value="' + h(n.text || "") + '" placeholder="예: 12월 24일~26일은 휴무입니다. 상담 신청은 평소처럼 받습니다."></div>' +
      '<div class="grid g2" style="margin-top:12px"><div class="f"><label for="n-link">링크 주소 <small>선택</small></label><input class="in" id="n-link" value="' + h(n.link || "") + '" placeholder="/contact"></div><div class="f"><label for="n-lt">링크 글자</label><input class="in" id="n-lt" value="' + h(n.linkText || "") + '" placeholder="자세히 보기"></div></div>' +
      '<div class="row" style="margin-top:14px"><button class="btn" id="n-save">저장</button></div></div>' +
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
      '<div class="panel"><h2>서버 기능 연결 상태</h2><div id="srv" class="small">확인 중…</div></div></div></div>';
    shell("settings", "사이트 설정", "공지, 검색엔진 등록, 서버 기능 상태", "", body);
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
    api("/api/admin/status").then(function (r) {
      var el = $("#srv"); if (!el) return;
      if (!r.ok) { el.innerHTML = '<div class="note warn">서버 기능에 연결하지 못했습니다. coremood.kr/admin 에서 열었는지 확인해 주세요.</div>'; return; }
      el.innerHTML = '<ul class="seo"><li class="' + (r.kv ? "ok" : "warn") + '"><span class="i">' + (r.kv ? "✓" : "!") + "</span><span>상담 문의 저장소 " + (r.kv ? "연결됨" : "연결 전 — 사용 안내 참고") + '</span></li><li class="' + (r.webhook ? "ok" : "warn") + '"><span class="i">' + (r.webhook ? "✓" : "–") + "</span><span>새 문의 알림(웹훅) " + (r.webhook ? "켜짐" : "꺼짐 (선택 사항)") + '</span></li><li class="ok"><span class="i">✓</span><span>검색엔진 알림(IndexNow) 사용 가능</span></li></ul>';
    });
  }

  /* ---------- help ---------- */
  function helpView() {
    var body = '<div class="grid g2" style="align-items:start"><div class="panel help">' +
      "<h3>1. 매일 아침 자동 발행</h3><p>매일 오전 10시 무렵 Claude가 ‘발행 계획’의 맨 위 주제로 글을 써서 올립니다. 대기 주제가 없으면 분류(브랜딩·인테리어·마케팅·창업·공간 비즈니스)를 돌아가며 기존 글과 겹치지 않는 주제를 정합니다.</p>" +
      "<ul><li>쉬어 가고 싶을 때: 발행 계획 → ‘매일 오전 10시 자동 발행’ 끄기 → 설정 저장</li><li>다루고 싶은 주제: 발행 계획 → 주제 추가 (순서는 ↑↓로)</li><li>자동 발행된 글도 ‘저널 글’에서 똑같이 고치거나 내릴 수 있습니다.</li></ul>" +
      "<h3>2. 글을 직접 쓰고 고치기</h3><p>저널 글 → 새 글 쓰기. 제목, 영문 주소, 키워드, 설명을 채우고 본문을 씁니다. 오른쪽 ‘점검’이 모두 ✓가 되면 좋습니다. ‘공개’를 끄면 임시저장, 발행 일시를 미래로 정하면 예약 발행입니다(예약 글은 그 시각 이후 첫 자동 발행 때 함께 공개).</p>" +
      "<h3>3. 글쓰기 규칙</h3><ul><li>실적은 ‘10여 년간 340개 이상 프로젝트’로만 씁니다.</li><li>최고·1위·보장 같은 표현은 쓰지 않습니다.</li><li>인허가·소방·전기 용량은 ‘별도 확인 항목’으로 안내합니다.</li><li>소제목은 <code>## </code>, 체크리스트는 <code>:::check 제목</code> … <code>:::</code>, 자주 묻는 질문은 <code>:::faq</code> 안에 <code>Q. 질문</code> 다음 줄에 답변.</li></ul>" +
      "<h3>4. 반영 시간</h3><p>저장하면 GitHub에 기록되고 Cloudflare Pages가 1~2분 안에 사이트를 다시 배포합니다. 변경 기록은 왼쪽 아래 ‘변경 기록’에서 볼 수 있고, 잘못 올린 내용도 되돌릴 수 있습니다.</p>" +
      '</div><div class="panel help">' +
      "<h3>상담 문의 저장 켜기 (한 번만)</h3><ol class=\"steps\"><li>Cloudflare 대시보드 → <b>Storage &amp; Databases → KV</b> → <b>Create a namespace</b>, 이름은 <code>coremood-inquiries</code>.</li>" +
      "<li><b>Workers &amp; Pages</b> → coremood 프로젝트 → <b>Settings → Bindings</b>(또는 Functions → KV namespace bindings) → <b>Add</b> → KV namespace.</li>" +
      "<li>Variable name에 <code>INQUIRIES</code>, Namespace는 방금 만든 것을 고르고 저장합니다. Production과 Preview 모두 추가하면 좋습니다.</li>" +
      "<li>Deployments에서 최신 배포를 <b>Retry deployment</b> 하면 끝입니다. 사이트 설정의 ‘서버 기능 연결 상태’가 ✓로 바뀝니다.</li></ol>" +
      "<p>선택: 새 문의를 슬랙·디스코드로 받고 싶으면 같은 화면의 Variables에 <code>NOTIFY_WEBHOOK</code> 이름으로 웹훅 주소를 넣습니다.</p>" +
      "<h3>네이버 서치어드바이저 등록</h3><ol class=\"steps\"><li>searchadvisor.naver.com → 웹마스터 도구 → 사이트 등록에 <code>https://coremood.kr</code> 입력.</li><li>소유확인에서 ‘HTML 태그’를 고르고 나온 메타 태그를 <b>사이트 설정 → 검색엔진 소유확인</b>의 네이버 칸에 붙여 넣어 저장합니다. 1~2분 뒤 소유확인을 누릅니다. (코어무드는 2026년 10월에 적용 완료)</li><li>요청 → 사이트맵 제출에 <code>https://coremood.kr/sitemap.xml</code>, RSS 제출에 <code>https://coremood.kr/feed.xml</code>을 넣습니다.</li></ol>" +
      "<h3>구글 서치 콘솔 등록</h3><ol class=\"steps\"><li>search.google.com/search-console → URL 접두어 <code>https://coremood.kr</code>.</li><li>다른 확인 방법 중 ‘HTML 태그’를 골라 나온 메타 태그를 <b>사이트 설정 → 검색엔진 소유확인</b>의 구글 칸에 붙여 넣어 저장합니다.</li><li>Sitemaps 메뉴에서 <code>sitemap.xml</code>을 제출합니다.</li></ol>" +
      "<h3>관리자 화면 보호 (선택)</h3><p>관리자 화면은 토큰 없이는 아무것도 할 수 없지만, 주소 자체를 숨기고 싶다면 Cloudflare Zero Trust → Access에서 <code>coremood.kr/admin*</code>에 이메일 인증을 걸 수 있습니다(무료 범위).</p>" +
      "</div></div>";
    shell("help", "사용 안내", "자주 쓰는 기능과 처음 한 번 해 둘 설정", "", body);
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
