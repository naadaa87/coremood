/* CORE MOOD — site scripts */
(function () {
  "use strict";
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- hero intro ---------- */
  requestAnimationFrame(function () { document.body.classList.add("is-ready"); });

  /* ---------- header stuck ---------- */
  var hdr = $(".hdr");
  if (hdr) {
    var onScroll = function () { hdr.classList.toggle("is-stuck", window.scrollY > 12); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- mobile nav ---------- */
  var burger = $(".burger"), mnav = $(".mnav");
  if (burger && mnav) {
    var setNav = function (open) {
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      mnav.classList.toggle("is-open", open);
      document.documentElement.style.overflow = open ? "hidden" : "";
    };
    burger.addEventListener("click", function () {
      setNav(burger.getAttribute("aria-expanded") !== "true");
    });
    $$(".mnav a").forEach(function (a) { a.addEventListener("click", function () { setNav(false); }); });
    window.addEventListener("keydown", function (e) { if (e.key === "Escape") setNav(false); });
  }

  /* ---------- scroll reveal ---------- */
  var rv = $$(".rv");
  if (rv.length) {
    if (reduce || !("IntersectionObserver" in window)) {
      rv.forEach(function (el) { el.classList.add("is-in"); });
    } else {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
        });
      }, { rootMargin: "0px 0px -12% 0px", threshold: 0.06 });
      rv.forEach(function (el) { io.observe(el); });
    }
  }

  /* ---------- accordion ---------- */
  $$(".acc__q").forEach(function (q) {
    q.addEventListener("click", function () {
      var open = q.getAttribute("aria-expanded") === "true";
      var group = q.closest(".acc");
      if (group) {
        $$(".acc__q", group).forEach(function (o) { o.setAttribute("aria-expanded", "false"); });
        $$(".acc__i", group).forEach(function (o) { o.classList.remove("is-open"); });
      }
      q.setAttribute("aria-expanded", open ? "false" : "true");
      var item = q.closest(".acc__i");
      if (item) item.classList.toggle("is-open", !open);
    });
  });

  /* ---------- before / after ---------- */
  var ba = $("[data-ba]");
  if (ba) {
    var stage = $(".ba__stage", ba);
    var imgB = $(".ba__before img", ba);
    var imgA = $(".ba__after img", ba);
    var meta = $("[data-ba-meta]", ba);
    var setX = function (pct) {
      pct = Math.max(0, Math.min(100, pct));
      stage.style.setProperty("--x", pct + "%");
      stage.setAttribute("aria-valuenow", Math.round(pct));
    };
    var fromEvent = function (e) {
      var r = stage.getBoundingClientRect();
      setX(((e.clientX - r.left) / r.width) * 100);
    };
    var dragging = false;
    stage.addEventListener("pointerdown", function (e) {
      dragging = true; stage.setPointerCapture(e.pointerId); fromEvent(e); e.preventDefault();
    });
    stage.addEventListener("pointermove", function (e) { if (dragging) fromEvent(e); });
    ["pointerup", "pointercancel"].forEach(function (t) {
      stage.addEventListener(t, function () { dragging = false; });
    });
    stage.addEventListener("keydown", function (e) {
      var cur = parseFloat(stage.style.getPropertyValue("--x")) || 50;
      if (e.key === "ArrowLeft") { setX(cur - 4); e.preventDefault(); }
      if (e.key === "ArrowRight") { setX(cur + 4); e.preventDefault(); }
      if (e.key === "Home") { setX(0); e.preventDefault(); }
      if (e.key === "End") { setX(100); e.preventDefault(); }
    });

    $$(".ba__btn", ba).forEach(function (btn) {
      btn.addEventListener("click", function () {
        $$(".ba__btn", ba).forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
        btn.setAttribute("aria-pressed", "true");
        imgB.src = btn.dataset.before;
        imgA.src = btn.dataset.after;
        imgB.alt = btn.dataset.title + " 시공 전";
        imgA.alt = btn.dataset.title + " 시공 후";
        if (meta) meta.textContent = btn.dataset.scope;
        var more = $("[data-ba-link]", ba);
        if (more && btn.dataset.link) more.href = btn.dataset.link;
        setX(50);
      });
    });
  }

  /* ---------- portfolio filter ---------- */
  var pf = $("[data-filter]");
  if (pf) {
    var items = $$(".pitem", $(".pgrid"));
    var count = $("[data-count]");
    $$(".chip", pf).forEach(function (chip) {
      chip.addEventListener("click", function () {
        var cat = chip.dataset.cat;
        $$(".chip", pf).forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        var n = 0;
        items.forEach(function (it) {
          var show = cat === "all" || it.dataset.cat === cat;
          it.hidden = !show;
          if (show) n++;
        });
        if (count) count.textContent = n;
      });
    });
  }

  /* ---------- project modal ---------- */
  var modal = $("#pmodal");
  if (modal) {
    var last = null;
    var box = $(".modal__box", modal);
    var open = function (data) {
      $("[data-m-img]", modal).src = data.img;
      $("[data-m-img]", modal).alt = data.title;
      $("[data-m-kicker]", modal).textContent = data.kicker;
      $("[data-m-title]", modal).textContent = data.title;
      $("[data-m-desc]", modal).textContent = data.desc;
      $("[data-m-type]", modal).textContent = data.type;
      $("[data-m-area]", modal).textContent = data.area;
      $("[data-m-loc]", modal).textContent = data.loc;
      $("[data-m-scope]", modal).textContent = data.scope;
      modal.classList.add("is-open");
      document.documentElement.style.overflow = "hidden";
      box.scrollTop = 0;
      $(".modal__x", modal).focus();
    };
    var close = function () {
      modal.classList.remove("is-open");
      document.documentElement.style.overflow = "";
      if (last) last.focus();
    };
    $$(".pitem").forEach(function (it) {
      it.addEventListener("click", function () {
        last = it;
        open({
          img: it.dataset.wide, kicker: it.dataset.kicker, title: it.dataset.title,
          desc: it.dataset.desc, type: it.dataset.type, area: it.dataset.area,
          loc: it.dataset.loc, scope: it.dataset.scope
        });
      });
    });
    $(".modal__x", modal).addEventListener("click", close);
    $(".modal__bd", modal).addEventListener("click", close);
    window.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal.classList.contains("is-open")) close();
    });
  }

  var BIZ = {
    cafe: ["카페 · 베이커리", 1.0], dining: ["음식점 · 주점", 1.1],
    bar: ["바 · 라운지", 1.28], retail: ["리테일 · 쇼룸", 1.04],
    office: ["오피스 · 사무공간", .86], study: ["스터디카페 · 학원", .82],
    beauty: ["미용 · 뷰티", .96], stay: ["숙박 · 스테이", 1.35],
    party: ["파티룸 · 스튜디오", .9]
  };
  var QS = new URLSearchParams(location.search);

  /* ---------- estimate calculator ---------- */
  var est = $("[data-est]");
  if (est) {
    var state = { biz: "cafe", grade: "standard", area: 40 };
    var pre = QS.get("biz");
    if (pre && BIZ[pre]) {
      state.biz = pre;
      $$('[data-opt="biz"]', est).forEach(function (o) { o.setAttribute("aria-pressed", o.dataset.val === pre ? "true" : "false"); });
    }
    var GRADE = {
      essential: ["에센셜", 70, "부분 개선과 필수 마감 위주. 기존 시설을 최대한 살려 최소 범위로 정리합니다.", false],
      basic: ["베이직", 110, "필수 공정 중심. 구조는 그대로 두고 마감과 조명을 새로 정리합니다.", false],
      standard: ["스탠다드", 170, "설계·조명·가구까지 균형 있게 반영하는 가장 일반적인 사양입니다.", false],
      premium: ["프리미엄", 220, "천연 소재와 조명 설계, 제작 가구 비중이 높은 사양입니다.", false],
      signature: ["시그니처", 280, "전 구간 맞춤 제작과 특수 마감 중심입니다. 범위에 따라 금액은 협의로 정합니다.", true]
    };
    var fmt = function (n) { return n.toLocaleString("ko-KR"); };
    var calc = function () {
      var g = GRADE[state.grade], b = BIZ[state.biz];
      var base = g[1] * b[1] * state.area;     // 만 원 단위
      var lo = base * 0.86, hi = base * 1.14;
      var out;
      if (hi < 10000) {
        out = fmt(Math.round(lo / 100) * 100) + " ~ " + fmt(Math.round(hi / 100) * 100) + "<small>만 원</small>";
      } else {
        out = (Math.round(lo / 1000) / 10).toFixed(1) + " ~ " + (Math.round(hi / 1000) / 10).toFixed(1) + "<small>억 원</small>";
      }
      $("[data-est-num]").innerHTML = out;
      $("[data-est-biz]").textContent = b[0];
      $("[data-est-grade]").textContent = g[0] + (g[3] ? " (협의)" : "");
      $("[data-est-area]").textContent = state.area + "평 (" + Math.round(state.area * 3.3058) + "㎡)";
      $("[data-est-unit]").textContent = fmt(Math.round(g[1] * b[1])) + "만 원 / 평";
      $("[data-est-desc]").textContent = g[2];
      var warn = $("[data-est-warn]");
      if (warn) {
        warn.textContent = g[3]
          ? "시그니처 사양은 마감과 제작 범위에 따라 편차가 큽니다. 위 금액은 협의 기준의 출발점으로만 봐 주세요. 부가가치세 별도이며 가구·집기, 인허가 비용은 포함되지 않습니다."
          : "부가가치세 별도 · 가구와 집기, 인허가 비용은 포함되지 않은 금액입니다. 현장 실측 후 항목별 견적서로 정확한 금액을 드립니다.";
      }
      var pct = Math.min(1, base / (280 * 1.35 * 120));
      $("[data-est-bar]").style.transform = "scaleX(" + pct.toFixed(3) + ")";
      var link = $("[data-est-link]");
      if (link) {
        link.href = "/contact?biz=" + encodeURIComponent(state.biz) +
          "&grade=" + encodeURIComponent(g[0]) + "&area=" + state.area;
      }
    };
    $$("[data-opt]", est).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.dataset.opt;
        $$('[data-opt="' + key + '"]', est).forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
        btn.setAttribute("aria-pressed", "true");
        state[key] = btn.dataset.val;
        calc();
      });
    });
    var range = $("[data-est-range]", est);
    if (range) {
      range.addEventListener("input", function () {
        state.area = parseInt(range.value, 10);
        $("[data-est-rangeval]").innerHTML = state.area + "<small>평</small>";
        calc();
      });
    }
    calc();
  }

  /* ---------- visitor source (첫 방문 페이지·유입 경로) ---------- */
  var SRC = (function () {
    var k = "cm_src", v = null;
    try { v = JSON.parse(sessionStorage.getItem(k) || "null"); } catch (e) {}
    if (!v) {
      var utm = [];
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(function (x) { var y = QS.get(x); if (y) utm.push(x.slice(4) + "=" + y); });
      var ref = document.referrer || "";
      if (ref && ref.indexOf(location.origin) === 0) ref = "";
      v = { landing: location.pathname + location.search, ref: ref, utm: utm.join("&") };
      try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    }
    return v;
  })();

  /* ---------- inquiry (상담 신청 · 빠른 문의 공용) ---------- */
  var CFG = null;           // data/site.json
  var TS = { key: "", ready: null };
  var BIZ_OPTS = ["카페 · 베이커리", "음식점 · 주점", "바 · 라운지", "리테일 · 쇼룸", "오피스", "스터디카페 · 학원", "미용 · 뷰티", "숙박 · 스테이", "파티룸 · 스튜디오", "기타"];
  function loadTurnstile() {
    if (!TS.key) return Promise.resolve(false);
    if (TS.ready) return TS.ready;
    TS.ready = new Promise(function (res) {
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true; s.onload = function () { res(true); }; s.onerror = function () { res(false); };
      document.head.appendChild(s);
    });
    return TS.ready;
  }
  function mountTurnstile(host) {
    if (!TS.key || !host || host.dataset.tsId) return;
    loadTurnstile().then(function (ok) {
      if (!ok || !window.turnstile || host.dataset.tsId) return;
      host.dataset.tsId = window.turnstile.render(host, { sitekey: TS.key, theme: "light", size: "flexible", language: "ko" });
    });
  }
  function tsToken(host) {
    if (!host || !host.dataset.tsId || !window.turnstile) return "";
    try { return window.turnstile.getResponse(host.dataset.tsId) || ""; } catch (e) { return ""; }
  }
  function tsReset(host) { if (host && host.dataset.tsId && window.turnstile) try { window.turnstile.reset(host.dataset.tsId); } catch (e) {} }
  function mailtoInquiry(data) {
    var L = [
      "■ " + (data.type || "상담 신청") + " 내용", "",
      "성함        : " + data.name, "연락처      : " + data.phone, "이메일      : " + (data.email || "-"),
      "업종        : " + (data.biz || "-"), "희망 지역   : " + (data.region || "-"),
      "예상 면적   : " + (data.area ? data.area + "평" : "-"), "희망 사양   : " + (data.grade || "-"),
      "오픈 예정   : " + (data.open || "-"), "예산 범위   : " + (data.budget || "-"),
      "진행 상태   : " + (data.stage || "-"), "관심 서비스 : " + ((data.svc || []).join(", ") || "-"),
      "", "■ 요청 사항", (data.note || "-"), "", "— 코어무드 홈페이지"
    ].join("\n");
    var subject = "[" + (data.type || "상담 신청") + "] " + data.name + " · " + (data.biz || "공간 문의");
    window.location.href = "mailto:spaceblank0100@gmail.com?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(L);
  }
  function sendInquiry(data) {
    data.page = location.pathname + location.search;
    data.landing = SRC.landing; data.ref = SRC.ref; data.utm = SRC.utm;
    return fetch("/api/inquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, reason: "http-" + r.status }; }); })
      .catch(function () { return { ok: false, reason: "network" }; })
      .then(function (res) {
        if (res && res.ok) {
          if (typeof window.gtag === "function") window.gtag("event", "generate_lead", { form: data.type });
          return { ok: true };
        }
        if (res && (res.reason === "captcha" || res.reason === "too-many" || res.reason === "required")) return res;
        mailtoInquiry(data);
        return { ok: false, mailto: true };
      });
  }
  var FAIL_MSG = { captcha: "자동 입력 방지 확인을 마친 뒤 다시 보내 주세요.", "too-many": "짧은 시간에 여러 번 보내셨습니다. 잠시 뒤 다시 시도하거나 010-2384-9580으로 연락 주세요.", required: "성함과 연락처는 꼭 남겨 주세요." };

  /* ---------- contact form ---------- */
  var form = $("[data-form]");
  if (form) {
    ["biz", "grade", "area"].forEach(function (k) {
      var v = QS.get(k), el = form.querySelector('[name="' + k + '"]');
      if (k === "biz" && v && BIZ[v]) v = BIZ[v][0];
      if (v && el) {
        if (el.tagName === "SELECT") {
          var hit = Array.prototype.some.call(el.options, function (o) {
            if (o.value === v || o.text === v) { el.value = o.value; return true; } return false;
          });
          if (!hit) { var op = new Option(v, v, true, true); el.add(op); }
        } else { el.value = v; }
      }
    });
    var tsHost = document.createElement("div");
    tsHost.className = "cf-turnstile"; tsHost.hidden = true;
    var fsub = $(".fsub", form);
    if (fsub) fsub.parentNode.insertBefore(tsHost, fsub);
    var sending = false;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sending) return;
      var d = new FormData(form);
      var get = function (k) { return (d.get(k) || "").toString().trim(); };
      var name = get("name"), phone = get("phone");
      var msg = $("[data-form-msg]");
      var say = function (t) { if (msg) msg.textContent = t; };
      if (!name || !phone) {
        say("성함과 연락처는 꼭 남겨 주세요.");
        (name ? form.querySelector('[name="phone"]') : form.querySelector('[name="name"]')).focus();
        return;
      }
      var agree = form.querySelector('[name="agree"]');
      if (agree && !agree.checked) { say("개인정보 수집·이용에 동의해 주셔야 상담 신청을 보낼 수 있습니다."); agree.focus(); return; }
      var data = {
        type: "상담 신청", name: name, phone: phone, email: get("email"), biz: get("biz"), region: get("region"),
        area: get("area"), grade: get("grade"), open: get("open"), budget: get("budget"),
        stage: get("stage"), svc: d.getAll("svc"), note: get("note"), hp: get("website"), cf_token: tsToken(tsHost)
      };
      if (TS.key && !data.cf_token) { say(FAIL_MSG.captcha); return; }
      var btn = form.querySelector('[type="submit"]');
      sending = true; if (btn) btn.disabled = true;
      say("보내는 중입니다…");
      sendInquiry(data).then(function (r) {
        if (r.ok) { form.reset(); say("상담 신청이 접수되었습니다. 영업일 기준 하루 안에 담당자가 연락드리겠습니다."); }
        else if (r.mailto) say("메일 앱이 열립니다. 창이 뜨지 않으면 spaceblank0100@gmail.com 으로 보내 주세요.");
        else say(FAIL_MSG[r.reason] || "접수하지 못했습니다. 010-2384-9580으로 연락 주세요.");
        tsReset(tsHost);
        sending = false; if (btn) btn.disabled = false;
      });
    });
  }

  /* ---------- quick inquiry (모든 페이지 · 오른쪽 아래 버튼) ---------- */
  var qm = null;
  function openQuick(preset) {
    if (!qm) {
      qm = document.createElement("div");
      qm.className = "qm"; qm.hidden = true;
      qm.setAttribute("role", "dialog"); qm.setAttribute("aria-modal", "true"); qm.setAttribute("aria-labelledby", "qm-t");
      qm.innerHTML = '<div class="qm__bd" data-qx></div><div class="qm__box"><button class="qm__x" type="button" data-qx aria-label="닫기">✕</button>' +
        '<p class="qm__t" id="qm-t">빠른 상담 신청<span class="dot">.</span></p><p class="qm__d">연락처와 간단한 내용만 남겨 주시면 담당자가 확인 후 연락드립니다. 자세한 조건은 통화로 여쭙겠습니다.</p>' +
        '<form class="qm__f" novalidate><div class="qm__row"><input class="inp" name="name" placeholder="성함 *" autocomplete="name" required><input class="inp" name="phone" type="tel" placeholder="연락처 *" autocomplete="tel" required></div>' +
        '<select class="sel" name="biz"><option value="">업종 선택</option>' + BIZ_OPTS.map(function (o) { return "<option>" + o + "</option>"; }).join("") + "</select>" +
        '<textarea class="txt" name="note" placeholder="지역, 면적, 오픈 시기 등 아는 만큼 적어 주세요."></textarea>' +
        '<div class="hp" aria-hidden="true"><input name="website" tabindex="-1" autocomplete="off"></div>' +
        '<label class="fconsent"><input type="checkbox" name="agree" value="yes"><span>상담 회신을 위한 개인정보 수집·이용에 동의합니다. (필수) <a href="/contact#privacy" style="color:var(--olive-deep);border-bottom:1px solid var(--line-2)">자세히</a></span></label>' +
        '<div class="cf-turnstile" data-qts hidden></div><button class="btn" type="submit">상담 신청 보내기<span class="btn__ar" aria-hidden="true">→</span></button><p class="qm__msg" role="status" aria-live="polite"></p></form></div>';
      document.body.appendChild(qm);
      $$("[data-qx]", qm).forEach(function (x) { x.addEventListener("click", closeQuick); });
      var f = $("form", qm), m = $(".qm__msg", qm), ts = $("[data-qts]", qm), busy = false;
      f.addEventListener("submit", function (e) {
        e.preventDefault(); if (busy) return;
        var g = function (n) { var el = f.querySelector('[name="' + n + '"]'); return el ? (el.value || "").trim() : ""; };
        if (!g("name") || !g("phone")) { m.textContent = FAIL_MSG.required; return; }
        if (!f.querySelector('[name="agree"]').checked) { m.textContent = "개인정보 수집·이용에 동의해 주세요."; return; }
        var data = { type: "빠른 문의", name: g("name"), phone: g("phone"), biz: g("biz"), note: g("note"), hp: g("website"), cf_token: tsToken(ts), svc: [] };
        if (TS.key && !data.cf_token) { m.textContent = FAIL_MSG.captcha; return; }
        busy = true; m.textContent = "보내는 중입니다…";
        sendInquiry(data).then(function (r) {
          busy = false; tsReset(ts);
          if (r.ok) {
            f.hidden = true;
            var ok = document.createElement("div"); ok.className = "qm__ok";
            ok.innerHTML = "<strong>접수되었습니다.</strong><p class=\"small\">영업일 기준 하루 안에 연락드리겠습니다.<br>급하시면 <a href=\"tel:01023849580\">010-2384-9580</a>으로 전화 주세요.</p>";
            f.parentNode.appendChild(ok);
          } else if (r.mailto) m.textContent = "메일 앱이 열립니다. 창이 뜨지 않으면 010-2384-9580으로 연락 주세요.";
          else m.textContent = FAIL_MSG[r.reason] || "접수하지 못했습니다. 010-2384-9580으로 연락 주세요.";
        });
      });
      if (TS.key) { ts.hidden = false; mountTurnstile(ts); }
    }
    if (preset && preset.biz) { var sb = $('[name="biz"]', qm); if (sb) sb.value = preset.biz; }
    qm.hidden = false;
    document.documentElement.style.overflow = "hidden";
    setTimeout(function () { var n = $('[name="name"]', qm); if (n) n.focus(); }, 30);
  }
  function closeQuick() { if (qm) { qm.hidden = true; document.documentElement.style.overflow = ""; } }
  window.addEventListener("keydown", function (e) { if (e.key === "Escape") closeQuick(); });

  /* ---------- site config: notice · floating buttons · analytics · spam guard ---------- */
  var nb = $("[data-notice]");
  var page = document.body.getAttribute("data-page") || "";
  if (window.fetch) {
    fetch("/data/site.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (cfg) {
      CFG = cfg || {};
      var n = CFG.notice;
      if (nb && n && n.enabled && n.text) {
        nb.textContent = n.text;
        if (n.link) { var a = document.createElement("a"); a.href = n.link; a.textContent = n.linkText || "자세히 보기"; nb.appendChild(a); }
        nb.hidden = false;
      }
      TS.key = (CFG.turnstile && CFG.turnstile.siteKey) || "";
      if (TS.key && form) { var h = $(".cf-turnstile", form); if (h) { h.hidden = false; mountTurnstile(h); } }
      // 오른쪽 아래 버튼
      var q = CFG.quick || {}, k = CFG.kakao || {};
      var showQ = q.enabled !== false && page !== "contact";
      var showK = !!(k.url && /^https:\/\//.test(k.url));
      if (showQ || showK) {
        var fab = document.createElement("div"); fab.className = "fab";
        if (showK) fab.insertAdjacentHTML("beforeend", '<a class="fab__b fab__b--k" href="' + k.url.replace(/"/g, "") + '" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7l-1 3.6c-.1.4.3.7.6.5l4.3-2.8c.5.1.9.1 1.4.1 5.5 0 10-3.6 10-8S17.5 3 12 3z"/></svg>' + ((k.label || "카카오톡 상담").replace(/[<>]/g, "")) + "</a>");
        if (showQ) fab.insertAdjacentHTML("beforeend", '<button class="fab__b fab__b--q" type="button">빠른 상담 신청</button>');
        document.body.appendChild(fab);
        var qb = $(".fab__b--q", fab);
        if (qb) qb.addEventListener("click", function () { openQuick(); });
      }
      // 방문 분석 (설정한 경우에만)
      var an = CFG.analytics || {};
      if (an.ga4 && /^G-[A-Z0-9]+$/i.test(an.ga4)) {
        var g = document.createElement("script"); g.async = true; g.src = "https://www.googletagmanager.com/gtag/js?id=" + an.ga4; document.head.appendChild(g);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag("js", new Date()); window.gtag("config", an.ga4);
      }
      if (an.naver && /^[a-z0-9]+$/i.test(an.naver)) {
        var w = document.createElement("script"); w.async = true; w.src = "https://wcs.naver.net/wcslog.js";
        w.onload = function () { try { window.wcs_add = window.wcs_add || {}; window.wcs_add.wa = an.naver; if (window.wcs) window.wcs_do(); } catch (e) {} };
        document.head.appendChild(w);
      }
    }).catch(function () {});
  }
  $$("[data-quick]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); openQuick({ biz: b.dataset.quick }); }); });

  /* ---------- lightbox (시공 사례 사진) ---------- */
  var lb = null;
  $$("[data-lightbox]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      if (!lb) {
        lb = document.createElement("div"); lb.className = "lbx"; lb.hidden = true;
        lb.innerHTML = '<button class="lbx__x" type="button" aria-label="닫기">✕</button><img alt=""><p class="lbx__cap"></p>';
        document.body.appendChild(lb);
        lb.addEventListener("click", function (ev) { if (ev.target.tagName !== "IMG") { lb.hidden = true; document.documentElement.style.overflow = ""; } });
        window.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && lb) { lb.hidden = true; document.documentElement.style.overflow = ""; } });
      }
      var im = $("img", a);
      $("img", lb).src = a.getAttribute("href"); $("img", lb).alt = im ? im.alt : "";
      $(".lbx__cap", lb).textContent = im ? im.alt : "";
      lb.hidden = false; document.documentElement.style.overflow = "hidden";
    });
  });

  /* ---------- journal: search + more ---------- */
  var jl = $("[data-journal]");
  if (jl) {
    var grid = $("[data-jgrid]", jl), input = $("[data-jsearch]", jl), empty = $("[data-jempty]", jl), more = $("[data-jmore]", jl);
    var feature = $(".jfeature", jl);
    var all = null;
    var CAT = { branding: "브랜딩", interior: "인테리어", marketing: "마케팅", startup: "창업", business: "공간 비즈니스" };
    var esc = function (t) { return String(t || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
    var fd = function (iso) { var k = new Date(new Date(iso).getTime() + 9 * 3600000); return k.getUTCFullYear() + ". " + (k.getUTCMonth() + 1) + ". " + k.getUTCDate() + "."; };
    var cardHtml = function (p) {
      return '<article class="jcard" data-cat="' + p.category + '"><a href="/journal/' + p.slug + '" class="jcard__a"><figure class="jcard__fig"><img src="' + esc(p.cover) + '" alt="' + esc(p.coverAlt) + '" loading="lazy" decoding="async"></figure><div class="jcard__b"><span class="jcard__k">' + (CAT[p.category] || "") + '</span><h3 class="jcard__t">' + esc(p.title) + '</h3><p class="jcard__d">' + esc(p.description) + '</p><span class="jcard__m"><time datetime="' + esc(p.date) + '">' + fd(p.date) + "</time> · " + p.minutes + "분</span></div></a></article>";
    };
    var load = function () {
      if (all) return Promise.resolve(all);
      return fetch("/data/posts.json").then(function (r) { return r.json(); }).then(function (j) { all = j.posts || []; return all; });
    };
    if (more) more.addEventListener("click", function () {
      load().then(function (list) {
        var off = parseInt(more.dataset.offset, 10) || 24;
        grid.insertAdjacentHTML("beforeend", list.slice(off, off + 24).map(cardHtml).join(""));
        more.dataset.offset = off + 24;
        if (off + 24 >= list.length) more.parentNode.hidden = true;
      });
    });
    var t = null, base = grid.innerHTML;
    if (input) input.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var q = input.value.trim().toLowerCase();
        if (!q) { grid.innerHTML = base; if (feature) feature.hidden = false; if (empty) empty.hidden = true; if (more) more.parentNode.hidden = false; return; }
        load().then(function (list) {
          var words = q.split(/\s+/);
          var hit = list.filter(function (p) {
            var hay = (p.title + " " + p.description + " " + (p.tags || []).join(" ") + " " + (p.keyword || "") + " " + (CAT[p.category] || "")).toLowerCase();
            return words.every(function (w) { return hay.indexOf(w) >= 0; });
          });
          if (feature) feature.hidden = true;
          if (more) more.parentNode.hidden = true;
          grid.innerHTML = hit.map(cardHtml).join("");
          if (empty) empty.hidden = hit.length > 0;
        });
      }, 160);
    });
  }

  /* ---------- article: toc highlight + copy link ---------- */
  var toc = $$(".jtoc a");
  if (toc.length && "IntersectionObserver" in window) {
    var map = {};
    toc.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var tio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { toc.forEach(function (a) { a.classList.remove("is-on"); }); var a = map[e.target.id]; if (a) a.classList.add("is-on"); }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    $$(".prose h2[id]").forEach(function (h) { tio.observe(h); });
  }
  $$("[data-copy]").forEach(function (b) {
    b.addEventListener("click", function () {
      var done = function () { var o = b.firstChild.textContent; b.firstChild.textContent = "복사했습니다"; setTimeout(function () { b.firstChild.textContent = o; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done).catch(function () {});
      else { var i = document.createElement("input"); i.value = location.href; document.body.appendChild(i); i.select(); document.execCommand("copy"); i.remove(); done(); }
    });
  });

  /* ---------- year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
