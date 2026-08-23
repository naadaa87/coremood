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

  /* ---------- estimate calculator ---------- */
  var est = $("[data-est]");
  if (est) {
    var state = { biz: "cafe", grade: "standard", area: 40 };
    var BIZ = {
      cafe: ["카페 · 베이커리", 1.0], dining: ["음식점 · 주점", 1.1],
      bar: ["바 · 라운지", 1.28], retail: ["리테일 · 쇼룸", 1.04],
      office: ["오피스 · 사무공간", .86], study: ["스터디카페 · 학원", .82],
      beauty: ["미용 · 뷰티", .96], stay: ["숙박 · 스테이", 1.35],
      party: ["파티룸 · 스튜디오", .9]
    };
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
        link.href = "contact.html?biz=" + encodeURIComponent(b[0]) +
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

  /* ---------- contact form -> mailto ---------- */
  var form = $("[data-form]");
  if (form) {
    var q = new URLSearchParams(location.search);
    ["biz", "grade", "area"].forEach(function (k) {
      var v = q.get(k), el = form.querySelector('[name="' + k + '"]');
      if (v && el) {
        if (el.tagName === "SELECT") {
          var hit = Array.prototype.some.call(el.options, function (o) {
            if (o.value === v) { el.value = v; return true; } return false;
          });
          if (!hit) { var op = new Option(v, v, true, true); el.add(op); }
        } else { el.value = v; }
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = new FormData(form);
      var get = function (k) { return (d.get(k) || "").toString().trim(); };
      var name = get("name"), phone = get("phone");
      var msg = $("[data-form-msg]");
      if (!name || !phone) {
        if (msg) msg.textContent = "성함과 연락처는 꼭 남겨 주세요.";
        (name ? form.querySelector('[name="phone"]') : form.querySelector('[name="name"]')).focus();
        return;
      }
      var L = [
        "■ 상담 신청 내용", "",
        "성함        : " + name,
        "연락처      : " + phone,
        "이메일      : " + (get("email") || "-"),
        "업종        : " + (get("biz") || "-"),
        "희망 지역   : " + (get("region") || "-"),
        "예상 면적   : " + (get("area") ? get("area") + "평" : "-"),
        "희망 사양   : " + (get("grade") || "-"),
        "오픈 예정   : " + (get("open") || "-"),
        "예산 범위   : " + (get("budget") || "-"),
        "진행 상태   : " + (get("stage") || "-"),
        "관심 서비스 : " + (d.getAll("svc").join(", ") || "-"),
        "", "■ 요청 사항", (get("note") || "-"),
        "", "— 코어무드 홈페이지 상담 신청 폼"
      ].join("\n");
      var subject = "[상담 신청] " + name + " · " + (get("biz") || "공간 문의");
      window.location.href = "mailto:spaceblank0100@gmail.com?subject=" +
        encodeURIComponent(subject) + "&body=" + encodeURIComponent(L);
      if (msg) msg.textContent = "메일 앱이 열립니다. 창이 뜨지 않으면 spaceblank0100@gmail.com 으로 보내 주세요.";
    });
  }

  /* ---------- year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
