/* ==========================================================================
   CORE MOOD — content renderer
   브라우저(관리자 페이지)와 Node(빌드 스크립트)에서 같은 코드로 페이지를 만듭니다.
   ========================================================================== */
(function (root) {
  "use strict";

  /* ---------- site constants ---------- */
  var ASSET_V = "20261126"; // CSS·JS 를 고치면 이 값을 바꿔 브라우저 캐시를 갱신합니다
  var SITE = {
    url: "https://coremood.kr",
    name: "코어무드",
    nameEn: "CORE MOOD",
    full: "코어무드 CORE MOOD",
    tel: "010-2384-9580",
    telLink: "tel:01023849580",
    telIntl: "+82-10-2384-9580",
    email: "spaceblank0100@gmail.com",
    address: "서울특별시 강남구 영동대로 602, 6층",
    addrLocality: "강남구",
    addrStreet: "영동대로 602, 6층",
    corp: "(주)블랭크",
    ceo: "최시준",
    hours: "평일 09:00 – 19:00 · 주말 예약 상담",
    slogan: "공간에 브랜드를 입히다",
    sloganEn: "Design the Core. Shape the Mood. Build the Brand.",
    record: "10여 년간 340개 이상 프로젝트",
    ogDefault: "/assets/img/og.jpg",
    repo: "naadaa87/coremood"
  };

  var CATS = {
    branding: { name: "브랜딩", en: "Branding", desc: "컨셉, 네이밍, 간판, 브랜드 경험까지. 공간이 무엇으로 기억될지 정하는 일에 대한 글입니다." },
    interior: { name: "인테리어", en: "Interior", desc: "설계와 시공, 비용과 공정, 조명과 자재. 현장에서 실제로 판단이 갈리는 지점을 정리합니다." },
    marketing: { name: "마케팅", en: "Marketing", desc: "네이버 플레이스, SNS, 오픈 프로모션, 리뷰. 공간이 문을 연 뒤 알려지는 방식에 대한 글입니다." },
    startup: { name: "창업", en: "Startup", desc: "상권과 자리, 계약과 일정, 업종별 준비 순서. 첫 매장을 여는 분들이 먼저 알아야 할 것들입니다." },
    business: { name: "공간 비즈니스", en: "Space Business", desc: "리뉴얼, 무인 운영, 공실, 숙박과 오피스. 공간을 사업으로 운영하는 분들을 위한 글입니다." }
  };
  var CAT_ORDER = ["branding", "interior", "marketing", "startup", "business"];

  var INDUSTRIES = [
    { slug: "cafe", name: "카페 · 베이커리", short: "카페", img: "/assets/img/p-bakery.webp", tags: ["카페", "베이커리", "카페 창업", "카페 인테리어"] },
    { slug: "restaurant", name: "음식점 · 주점", short: "음식점", img: "/assets/img/p-roastery.webp", tags: ["음식점", "주점", "음식점 인테리어", "주방"] },
    { slug: "bar", name: "바 · 라운지", short: "바 · 라운지", img: "/assets/img/p-lounge.webp", tags: ["바", "라운지", "바 인테리어"] },
    { slug: "salon", name: "미용실 · 뷰티", short: "미용실", img: "/assets/img/p-dressing.webp", tags: ["미용실", "뷰티", "미용실 인테리어", "헤어샵"] },
    { slug: "partyroom", name: "파티룸 · 공간대여", short: "파티룸", img: "/assets/img/p-rooftop.webp", tags: ["파티룸", "공간대여", "파티룸 창업"] },
    { slug: "studycafe", name: "스터디카페 · 학원", short: "스터디카페", img: "/assets/img/p-workspace.webp", tags: ["스터디카페", "학원", "독서실", "스터디카페 인테리어"] },
    { slug: "stay", name: "숙박 · 모텔 · 스테이", short: "숙박", img: "/assets/img/p-suite.webp", tags: ["숙박", "모텔", "호텔", "스테이", "모텔 리모델링"] },
    { slug: "office", name: "사무실 · 오피스", short: "오피스", img: "/assets/img/p-office.webp", tags: ["오피스", "사무실", "사무실 인테리어"] },
    { slug: "retail", name: "리테일 · 쇼룸", short: "리테일", img: "/assets/img/p-showroom.webp", tags: ["리테일", "쇼룸", "편집숍", "매장"] },
    { slug: "studio", name: "스튜디오 · 연습실", short: "스튜디오", img: "/assets/img/p-gallery.webp", tags: ["스튜디오", "연습실", "촬영", "공방"] }
  ];

  var BA = {
    cafe: ["카페 · 인천", "cafe", "철거 · 목공 · 전기 · 바닥 · 설비 · 도장 · 필름 · 타일 · 간판"],
    salon: ["미용실 · 서울 신촌", "salon", "철거 · 목공 · 전기 · 금속 · 바닥 · 설비 · 도장 · 필름 · 에폭시"],
    "party-hongdae": ["파티룸 · 서울 홍대", "party-hongdae", "철거 · 목공 · 전기 · 바닥 · 설비 · 도장 · 조명 · 금속"],
    "party-gyeongju": ["파티룸 · 경주", "party-gyeongju", "철거 · 목공 · 전기 · 바닥 · 설비 · 도장 · 필름 · 싱크"],
    study: ["스터디카페 · 서울 서대문", "study", "철거 · 목공 · 전기 · 바닥 · 설비 · 도장 · 필름 · 타일"],
    stay: ["숙박업 · 천안", "stay", "철거 · 목공 · ALC · 전기 · 방음 · 바닥 · 설비 · 도장 · 소방 · 샷시 · 화장실"],
    billiard: ["당구장 · 화성", "billiard", "철거 · 목공 · 전기 · 바닥 · 설비 · 도장 · 흡연실 · 제조실"],
    dining: ["음식점 · 서울 충무로", "dining", "철거 · 목공 · 전기 · 바닥 · 설비 · 도장 · 필름 · 타일 · 간판"],
    studio: ["스튜디오 · 서울 강남", "studio", "목공 · 전기 · 바닥 · 설비 · 타일 · 싱크 · 화장실"]
  };

  var NAV = [
    ["about", "/about", "브랜드", "About"],
    ["services", "/services", "서비스", "Services"],
    ["industries", "/industries/", "업종별", "Industries"],
    ["portfolio", "/portfolio", "프로젝트", "Projects"],
    ["process", "/process", "진행 절차", "Process"],
    ["journal", "/journal/", "저널", "Journal"],
    ["estimate", "/estimate", "견적 안내", "Estimate"]
  ];

  // 서비스 모듈 (구조화 데이터 · llms.txt 공용)
  var SERVICES = [
    ["컨셉 · 무드 기획", "누가, 언제, 무엇을 하러 오는 공간인지 한 문장으로 정하고 무드보드와 톤앤매너로 방향을 맞춥니다.", "concept"],
    ["브랜드 개발", "네이밍, 로고, 컬러, 간판과 메뉴판, 공간 그래픽까지 브랜드의 시각 체계를 만듭니다.", "brand"],
    ["공간 기획 · 설계", "실측을 바탕으로 평면과 동선, 조명 계획을 세우고 3D 시안으로 결과를 미리 확인합니다.", "plan"],
    ["인테리어 시공 · 스타일링", "철거부터 마감까지 설계한 팀이 현장을 보고, 가구와 조명 기구, 패브릭, 소품으로 분위기를 완성합니다.", "interior"],
    ["콘텐츠 제작", "오픈 촬영, 네이버 플레이스와 예약 채널용 사진, SNS에 올릴 장면을 준비합니다.", "content"],
    ["마케팅 · 운영 연계", "네이버 플레이스 등록, 오픈 프로모션, 리뷰와 SNS 운영까지 공간이 알려지는 과정을 함께 챙깁니다.", "marketing"]
  ];
  // 견적 안내의 평당 기준(만 원). assets/js/main.js 의 GRADE 와 같은 값이어야 합니다 (scripts/check.js 가 비교합니다)
  var EST_GRADES = [["에센셜", 70], ["베이직", 110], ["스탠다드", 170], ["프리미엄", 220], ["시그니처", 280]];

  /* ---------- 사이트 공용 데이터 (빌드·관리자에서 setData 로 넣어 줍니다) ----------
     topics: 주제 허브 · glossary: 용어 사전 · lastmod: 페이지별 수정일 · dims: 이미지 크기
     channels: 블로그·인스타그램 등 채널 주소 · bodies: 글 본문(슬러그별) · faq: FAQ 문답 · archive: 톤앤매너 아카이브 */
  var DATA = {};
  function setData(d) { Object.keys(d || {}).forEach(function (k) { if (d[k] !== undefined) DATA[k] = d[k]; }); }
  function dat(ctx, k) { return (ctx && ctx[k]) || DATA[k]; }
  var CHANNEL_KEYS = [["naverBlog", "네이버 블로그"], ["naverPlace", "네이버 플레이스"], ["instagram", "인스타그램"], ["youtube", "유튜브"], ["kakao", "카카오톡 채널"]];
  function channelList() {
    var c = DATA.channels || {};
    return CHANNEL_KEYS.filter(function (k) { return /^https?:\/\//.test(c[k[0]] || ""); }).map(function (k) { return { key: k[0], name: k[1], url: c[k[0]] }; });
  }
  function dim(src) {
    var d = DATA.dims && DATA.dims[src];
    return d ? ' width="' + d[0] + '" height="' + d[1] + '"' : "";
  }

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function attr(s) { return esc(s); }
  function abs(p) { return /^https?:/.test(p) ? p : SITE.url + (p.charAt(0) === "/" ? p : "/" + p); }
  function jsonld(obj) {
    return '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g, "\\u003c") + "</script>";
  }
  function kst(d) {
    var t = d instanceof Date ? d : new Date(d);
    if (isNaN(t)) t = new Date();
    return new Date(t.getTime() + 9 * 3600 * 1000);
  }
  function fmtDate(d) {
    var k = kst(d);
    return k.getUTCFullYear() + ". " + (k.getUTCMonth() + 1) + ". " + k.getUTCDate() + ".";
  }
  function isoDate(d) {
    var k = kst(d);
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return k.getUTCFullYear() + "-" + p(k.getUTCMonth() + 1) + "-" + p(k.getUTCDate());
  }
  function dot(title) {
    return /[.?!。]$/.test(title) ? esc(title) : esc(title) + '<span class="dot">.</span>';
  }

  /* ---------- front matter ---------- */
  function parseValue(v) {
    v = v.trim();
    if (v === "true") return true;
    if (v === "false") return false;
    if (/^\[.*\]$/.test(v)) {
      var inner = v.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(",").map(function (x) { return x.trim().replace(/^["']|["']$/g, ""); }).filter(Boolean);
    }
    if (/^".*"$/.test(v) || /^'.*'$/.test(v)) return v.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
  }
  function parseFront(src) {
    src = String(src).replace(/\r\n?/g, "\n").replace(/^﻿/, "");
    var data = {}, body = src;
    var m = /^---\n([\s\S]*?)\n---\n?/.exec(src);
    if (m) {
      body = src.slice(m[0].length);
      m[1].split("\n").forEach(function (line) {
        if (!line.trim() || /^\s*#/.test(line)) return;
        var i = line.indexOf(":");
        if (i < 1) return;
        data[line.slice(0, i).trim()] = parseValue(line.slice(i + 1));
      });
    }
    return { data: data, body: body.replace(/^\n+/, "") };
  }
  function fmVal(v) {
    if (Array.isArray(v)) return "[" + v.join(", ") + "]";
    if (typeof v === "boolean" || typeof v === "number") return String(v);
    v = String(v == null ? "" : v).replace(/\n/g, " ");
    return v;
  }
  function stringifyFront(data, body, order) {
    var keys = order || Object.keys(data);
    var seen = {};
    var lines = ["---"];
    keys.concat(Object.keys(data)).forEach(function (k) {
      if (seen[k] || data[k] === undefined || data[k] === null || data[k] === "") return;
      seen[k] = 1;
      lines.push(k + ": " + fmVal(data[k]));
    });
    lines.push("---", "");
    return lines.join("\n") + String(body || "").replace(/^\n+/, "").replace(/\s*$/, "\n");
  }
  var POST_KEYS = ["title", "slug", "date", "updated", "category", "keyword", "tags", "description", "cover", "coverAlt", "og", "draft"];
  var IND_KEYS = ["title", "slug", "h1", "seoTitle", "description", "lead", "keyword", "biz", "hero", "heroAlt", "ba", "tags", "order", "updated"];

  /* ---------- markdown ---------- */
  function inline(s) {
    var codes = [];
    s = esc(s).replace(/`([^`]+)`/g, function (_, c) { codes.push(c); return "\u0000" + (codes.length - 1) + "\u0000"; });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, function (_, t, u) {
      var ext = /^https?:\/\//.test(u) && u.indexOf(SITE.url) !== 0;
      return '<a href="' + u + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + t + "</a>";
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<em>$2</em>");
    s = s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return "<code>" + codes[+i] + "</code>"; });
    return s;
  }
  function plain(s) {
    return String(s).replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*`>#|]/g, "").replace(/^:::.*$/gm, "").replace(/^\s*[-\d.]+\s+/gm, "").replace(/\s+/g, " ").trim();
  }

  function md(src, opt) {
    opt = opt || {};
    var lines = String(src).replace(/\r\n?/g, "\n").split("\n");
    var out = [], toc = [], faq = [], summary = [], h2n = 0, i = 0;

    function isBlank(l) { return !l || !l.trim(); }
    function startsBlock(l) {
      return /^(#{2,4})\s/.test(l) || /^:::/.test(l) || /^```/.test(l) || /^\s*[-*]\s+/.test(l) ||
        /^\s*\d+\.\s+/.test(l) || /^>\s?/.test(l) || /^\|/.test(l) || /^-{3,}\s*$/.test(l) || /^!\[/.test(l);
    }
    function list(start) {
      var ordered = /^\s*\d+\.\s+/.test(lines[start]);
      var re = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/;
      var items = [], j = start;
      while (j < lines.length && (re.test(lines[j]) || (/^\s{2,}\S/.test(lines[j]) && items.length))) {
        if (re.test(lines[j])) items.push(lines[j].replace(re, ""));
        else items[items.length - 1] += " " + lines[j].trim();
        j++;
      }
      return { j: j, html: (ordered ? "<ol>" : "<ul>") + items.map(function (t) { return "<li>" + inline(t) + "</li>"; }).join("") + (ordered ? "</ol>" : "</ul>"), items: items };
    }
    function table(start) {
      var rows = [], j = start;
      while (j < lines.length && /^\|/.test(lines[j])) { rows.push(lines[j]); j++; }
      var cells = function (r) { return r.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map(function (c) { return c.trim(); }); };
      var head = cells(rows[0]);
      var body = rows.slice(/^\|[\s:|-]+\|?\s*$/.test(rows[1] || "") ? 2 : 1).map(cells);
      var h = '<div class="tblwrap"><table class="tbl jtbl"><thead><tr>' + head.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") +
        "</tr></thead><tbody>" + body.map(function (r) { return "<tr>" + r.map(function (c, k) { return (k === 0 ? "<th>" : "<td>") + inline(c) + (k === 0 ? "</th>" : "</td>"); }).join("") + "</tr>"; }).join("") +
        "</tbody></table></div>";
      return { j: j, html: h };
    }
    function block(type, title, inner) {
      if (type === "note") {
        return '<aside class="jnote">' + (title ? '<strong class="jnote__t">' + inline(title) + "</strong>" : "") + md(inner.join("\n")).html + "</aside>";
      }
      if (type === "check") {
        var items = inner.filter(function (l) { return /^\s*[-*]\s+/.test(l); }).map(function (l) { return l.replace(/^\s*[-*]\s+/, ""); });
        return '<div class="jcheck">' + (title ? '<p class="jcheck__t">' + inline(title) + "</p>" : "") +
          '<ul class="jcheck__l">' + items.map(function (t) { return "<li>" + inline(t) + "</li>"; }).join("") + "</ul></div>";
      }
      if (type === "summary") {
        var pts = inner.filter(function (l) { return /^\s*[-*]\s+/.test(l); }).map(function (l) { return l.replace(/^\s*[-*]\s+/, ""); });
        pts.forEach(function (t) { summary.push(plain(t)); });
        if (opt.feed) return "<p><strong>핵심 요약</strong></p><ul>" + pts.map(function (t) { return "<li>" + inline(t) + "</li>"; }).join("") + "</ul>";
        return '<aside class="jsum" aria-label="핵심 요약"><strong class="jsum__t">' + inline(title || "핵심 요약") + '</strong><ul class="jsum__l">' +
          pts.map(function (t) { return "<li>" + inline(t) + "</li>"; }).join("") + "</ul></aside>";
      }
      if (type === "spec") {
        var rows = inner.filter(function (l) { return l.indexOf(":") > 0; }).map(function (l) { var k = l.indexOf(":"); return [l.slice(0, k).trim(), l.slice(k + 1).trim()]; });
        return '<dl class="tblock jspec' + (rows.length % 4 === 0 ? "" : rows.length === 2 ? " tblock--2" : " tblock--3") + '">' +
          rows.map(function (r) { return "<div><dt>" + esc(r[0]) + "</dt><dd>" + inline(r[1]) + "</dd></div>"; }).join("") + "</dl>";
      }
      if (type === "faq") {
        var qs = [], cur = null;
        inner.forEach(function (l) {
          var m = /^Q[.:]\s*(.+)$/.exec(l.trim());
          if (m) { cur = { q: m[1].trim(), a: [] }; qs.push(cur); }
          else if (cur) cur.a.push(l.replace(/^A[.:]\s*/, ""));
        });
        var h = '<div class="acc jfaq">';
        if (opt.feed) {
          return qs.map(function (x) { faq.push({ q: x.q, a: plain(x.a.join(" ")) }); return "<h3>" + inline(x.q) + "</h3>" + md(x.a.join("\n")).html; }).join("\n");
        }
        qs.forEach(function (x) {
          var ans = md(x.a.join("\n"));
          faq.push({ q: x.q, a: plain(x.a.join(" ")) });
          h += '<div class="acc__i" id="' + (opt.faqPrefix || "faq") + "-" + faq.length + '"><button class="acc__q" type="button" aria-expanded="false">' + inline(x.q) +
            '</button><div class="acc__a"><div>' + ans.html + "</div></div></div>";
        });
        return h + "</div>";
      }
      return md(inner.join("\n")).html;
    }

    while (i < lines.length) {
      var l = lines[i];
      if (isBlank(l)) { i++; continue; }
      var m;
      if ((m = /^:::\s*(\w+)\s*(.*)$/.exec(l))) {
        var inner = [], j = i + 1;
        while (j < lines.length && !/^:::\s*$/.test(lines[j])) { inner.push(lines[j]); j++; }
        out.push(block(m[1], m[2].trim(), inner));
        i = j + 1; continue;
      }
      if (/^```/.test(l)) {
        var code = [], k = i + 1;
        while (k < lines.length && !/^```/.test(lines[k])) { code.push(lines[k]); k++; }
        out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>");
        i = k + 1; continue;
      }
      if ((m = /^(#{2,4})\s+(.+?)\s*#*$/.exec(l))) {
        var lv = m[1].length, txt = m[2];
        if (lv === 2) {
          h2n++;
          var id = "s" + h2n;
          toc.push({ id: id, text: plain(txt) });
          out.push('<h2 id="' + id + '">' + inline(txt) + "</h2>");
        } else out.push("<h" + lv + ">" + inline(txt) + "</h" + lv + ">");
        i++; continue;
      }
      if (/^-{3,}\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
      if ((m = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/.exec(l))) {
        out.push('<figure class="jfig"><img src="' + attr(m[2]) + '" alt="' + attr(m[1]) + '"' + dim(m[2]) + ' loading="lazy" decoding="async">' +
          (m[3] ? "<figcaption>" + inline(m[3]) + "</figcaption>" : "") + "</figure>");
        i++; continue;
      }
      if (/^>\s?/.test(l)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, "")); i++; }
        out.push("<blockquote>" + md(q.join("\n")).html + "</blockquote>");
        continue;
      }
      if (/^\|/.test(l)) { var t = table(i); out.push(t.html); i = t.j; continue; }
      if (/^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l)) { var li = list(i); out.push(li.html); i = li.j; continue; }
      var para = [];
      while (i < lines.length && !isBlank(lines[i]) && (!para.length || !startsBlock(lines[i]))) { para.push(lines[i].trim()); i++; }
      out.push("<p>" + inline(para.join(" ")) + "</p>");
    }
    return { html: out.join("\n"), toc: toc, faq: faq, summary: summary };
  }

  // 글 본문에서 목차·문답·핵심 요약만 뽑습니다 (검색 색인, 주제 허브, llms.txt 용)
  function digest(body) {
    var r = md(body || "");
    return { toc: r.toc.map(function (t) { return t.text; }), faq: r.faq, summary: r.summary };
  }
  function textLength(body) { return plain(body).replace(/\s/g, "").length; }
  function readMinutes(body) { return Math.max(2, Math.round(textLength(body) / 480)); }

  /* ---------- post meta ---------- */
  function postMeta(slug, data, body) {
    var d = data || {};
    return {
      slug: d.slug || slug,
      title: d.title || "",
      date: d.date || new Date().toISOString(),
      updated: d.updated || "",
      category: CATS[d.category] ? d.category : "interior",
      keyword: d.keyword || "",
      tags: Array.isArray(d.tags) ? d.tags : (d.tags ? String(d.tags).split(",").map(function (x) { return x.trim(); }) : []),
      description: d.description || "",
      cover: d.cover || "/assets/img/m-core.webp",
      coverAlt: d.coverAlt || d.title || "",
      og: d.og || "",
      draft: d.draft === true,
      minutes: readMinutes(body || ""),
      chars: textLength(body || "")
    };
  }
  function isLive(p, now) { return !p.draft && new Date(p.date).getTime() <= (now || Date.now()); }
  function sortPosts(list) { return list.slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); }); }
  function postUrl(p) { return "/journal/" + p.slug; }

  function related(p, posts, n) {
    var tags = (p.tags || []).concat(p.keyword ? [p.keyword] : []);
    var scored = posts.filter(function (x) { return x.slug !== p.slug; }).map(function (x) {
      var s = 0;
      (x.tags || []).forEach(function (t) { tags.forEach(function (u) { if (t === u) s += 3; else if (t.indexOf(u) >= 0 || u.indexOf(t) >= 0) s += 1; }); });
      if (x.category === p.category) s += 2;
      return { x: x, s: s, d: new Date(x.date).getTime() };
    });
    scored.sort(function (a, b) { return b.s - a.s || b.d - a.d; });
    return scored.slice(0, n || 3).map(function (o) { return o.x; });
  }
  function postsForTags(tags, posts, n) {
    var scored = posts.map(function (x) {
      var s = 0;
      (x.tags || []).concat([x.keyword || ""]).forEach(function (t) { tags.forEach(function (u) { if (t && (t === u || t.indexOf(u) >= 0 || u.indexOf(t) >= 0)) s += 1; }); });
      return { x: x, s: s, d: new Date(x.date).getTime() };
    }).filter(function (o) { return o.s > 0; });
    scored.sort(function (a, b) { return b.s - a.s || b.d - a.d; });
    return scored.slice(0, n || 3).map(function (o) { return o.x; });
  }

  /* ---------- search engine verification (data/site.json 의 verify 값으로 덮어씀) ---------- */
  var VERIFY = { naver: "4eabdaa4de82e69200936758f6e6eb9386dc9ce4", google: "", bing: "" };
  function setVerify(v) { if (v && typeof v === "object") VERIFY = { naver: v.naver || "", google: v.google || "", bing: v.bing || "" }; }
  function verifyMeta() {
    return (VERIFY.naver ? '<meta name="naver-site-verification" content="' + attr(VERIFY.naver) + '">\n' : "") +
      (VERIFY.google ? '<meta name="google-site-verification" content="' + attr(VERIFY.google) + '">\n' : "") +
      (VERIFY.bing ? '<meta name="msvalidate.01" content="' + attr(VERIFY.bing) + '">\n' : "");
  }

  /* ---------- partials ---------- */
  function headTag(o) {
    var url = abs(o.path);
    var img = abs(o.image || SITE.ogDefault);
    var h = '<!DOCTYPE html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
      "<title>" + esc(o.title) + "</title>\n" +
      '<meta name="description" content="' + attr(o.description) + '">\n' +
      (o.keywords ? '<meta name="keywords" content="' + attr(o.keywords) + '">\n' : "") +
      '<meta name="author" content="' + SITE.full + '">\n' +
      (o.noindex ? '<meta name="robots" content="noindex,follow">\n' : '<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">\n') +
      '<meta name="theme-color" content="#F6F3EE">\n' +
      (o.verify ? verifyMeta() : "") +
      '<link rel="canonical" href="' + url + '">\n' +
      '<meta property="og:type" content="' + (o.type || "website") + '">\n' +
      '<meta property="og:site_name" content="' + SITE.full + '">\n' +
      '<meta property="og:locale" content="ko_KR">\n' +
      '<meta property="og:title" content="' + attr(o.ogTitle || o.title) + '">\n' +
      '<meta property="og:description" content="' + attr(o.description) + '">\n' +
      '<meta property="og:url" content="' + url + '">\n' +
      '<meta property="og:image" content="' + img + '">\n' +
      (function () { var d = DATA.dims && DATA.dims[o.image || SITE.ogDefault]; return d ? '<meta property="og:image:width" content="' + d[0] + '">\n<meta property="og:image:height" content="' + d[1] + '">\n' : ""; })() +
      (o.published ? '<meta property="article:published_time" content="' + attr(o.published) + '">\n' : "") +
      (o.modified ? '<meta property="article:modified_time" content="' + attr(o.modified) + '">\n' : "") +
      (o.section ? '<meta property="article:section" content="' + attr(o.section) + '">\n' : "") +
      (o.tags || []).map(function (t) { return '<meta property="article:tag" content="' + attr(t) + '">\n'; }).join("") +
      '<meta name="twitter:card" content="summary_large_image">\n' +
      '<meta name="twitter:title" content="' + attr(o.ogTitle || o.title) + '">\n' +
      '<meta name="twitter:description" content="' + attr(o.description) + '">\n' +
      '<meta name="twitter:image" content="' + img + '">\n' +
      '<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n' +
      '<link rel="apple-touch-icon" href="/favicon.svg">\n' +
      '<link rel="alternate" type="application/rss+xml" title="코어무드 저널" href="' + SITE.url + '/feed.xml">\n' +
      '<link rel="preload" href="/assets/fonts/Pretendard-sub.woff2" as="font" type="font/woff2" crossorigin>\n' +
      '<link rel="stylesheet" href="/assets/css/main.css?v=' + ASSET_V + '">\n' +
      (o.ld || []).map(jsonld).join("\n") + "\n</head>\n";
    return h;
  }

  function header(cur) {
    var nav = NAV.map(function (n) {
      return '<a href="' + n[1] + '"' + (cur === n[0] ? ' aria-current="page"' : "") + ">" + n[2] + "</a>";
    }).join("");
    var mnav = [["index", "/", "홈", "Home"]].concat(NAV, [["faq", "/faq", "자주 묻는 질문", "FAQ"], ["glossary", "/glossary", "용어 사전", "Glossary"], ["search", "/search", "검색", "Search"], ["contact", "/contact", "상담 신청", "Contact"]]).map(function (n) {
      return '<a href="' + n[1] + '"' + (cur === n[0] ? ' aria-current="page"' : "") + ">" + n[2] + '<span class="en">' + n[3] + "</span></a>";
    }).join("");
    return '<a href="#main" class="skip">본문 바로가기</a>\n' +
      '<div class="notice" data-notice hidden></div>\n' +
      '<header class="hdr">\n  <div class="wrap hdr__in">\n' +
      '    <a href="/" class="logo" aria-label="코어무드 홈으로"><span class="logo__mark">코어무드<span class="dot">.</span></span><span class="logo__en">Core Mood</span></a>\n' +
      '    <nav class="nav" aria-label="주요 메뉴">' + nav + "</nav>\n" +
      '    <a href="/search" class="hdr__s" aria-label="사이트 검색"' + (cur === "search" ? ' aria-current="page"' : "") + '><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg></a>\n' +
      '    <a href="/contact" class="hdr__cta"' + (cur === "contact" ? ' aria-current="page"' : "") + ">상담 신청</a>\n" +
      '    <button class="burger" type="button" aria-expanded="false" aria-controls="mnav" aria-label="메뉴 열기">\n      <span></span><span></span><span></span>\n    </button>\n  </div>\n</header>\n' +
      '<div class="mnav" id="mnav">\n  <nav class="mnav__list" aria-label="모바일 메뉴">' + mnav + "</nav>\n" +
      '  <div class="mnav__foot">\n    <span class="label">Contact</span>\n    <p class="small" style="margin-top:1em">' +
      SITE.tel + "<br>" + SITE.email + "<br>" + SITE.address + "</p>\n  </div>\n</div>";
  }

  function footer() {
    var inds = INDUSTRIES.map(function (x) { return '<li><a href="/industries/' + x.slug + '">' + x.name + "</a></li>"; }).join("");
    var cats = CAT_ORDER.map(function (k) { return '<li><a href="/journal/category/' + k + '">' + CATS[k].name + "</a></li>"; }).join("");
    return '<footer class="ftr">\n  <div class="wrap">\n    <div class="ftr__top">\n' +
      '      <div class="ftr__brand">\n        <a href="/" class="logo" style="font-size:1.3rem"><span class="logo__mark">코어무드<span class="dot">.</span></span></a>\n' +
      '        <p class="small" style="margin-top:1.4em;max-width:34ch">컨셉과 무드에서 출발해 브랜드, 공간, 콘텐츠까지 하나의 결로 연결하는 공간 비즈니스 스튜디오입니다. ' + SITE.record + "를 다뤄 왔습니다.</p>\n" +
      '        <address class="ftr__addr" style="margin-top:1.4em">' + SITE.address + '<br><a href="' + SITE.telLink + '">' + SITE.tel + '</a><br><a href="mailto:' + SITE.email + '">' + SITE.email + "</a></address>\n      </div>\n" +
      '      <div>\n        <span class="ftr__t">Studio</span>\n        <ul class="ftr__list"><li><a href="/about">브랜드 소개</a></li><li><a href="/services">서비스</a></li><li><a href="/portfolio">프로젝트</a></li><li><a href="/process">진행 절차</a></li><li><a href="/estimate">견적 안내</a></li><li><a href="/faq">자주 묻는 질문</a></li><li><a href="/contact">상담 신청</a></li><li><a href="/join">회원 가입 · 소식 받기</a></li></ul>\n      </div>\n' +
      '      <div>\n        <span class="ftr__t">Industries</span>\n        <ul class="ftr__list">' + inds + "</ul>\n      </div>\n" +
      '      <div>\n        <span class="ftr__t">Journal</span>\n        <ul class="ftr__list"><li><a href="/journal/">전체 글</a></li>' + cats + '<li><a href="/journal/#topics">주제별 글 모음</a></li><li><a href="/glossary">용어 사전</a></li><li><a href="/search">검색</a></li><li><a href="/feed.xml">RSS</a></li></ul>\n      </div>\n    </div>\n' +
      (channelList().length ? '    <div class="ftr__ch"><span class="ftr__t">Channels</span>' + channelList().map(function (c) { return '<a href="' + attr(c.url) + '" target="_blank" rel="noopener me">' + c.name + "</a>"; }).join("") + "</div>\n" : "") +
      '    <div class="ftr__biz">상호 ' + SITE.corp + " <i>|</i> 브랜드 " + SITE.full + " <i>|</i> 대표 " + SITE.ceo + " <i>|</i> " + SITE.address + " <i>|</i> 전화 " + SITE.tel + " <i>|</i> " + SITE.email + "</div>\n" +
      '    <div class="ftr__bot">\n      <span class="ftr__cp">© <span data-year>2026</span> ' + SITE.full + '. All rights reserved.</span>\n' +
      '      <span class="ftr__cp en" style="letter-spacing:.16em;text-transform:uppercase">' + SITE.sloganEn + "</span>\n    </div>\n  </div>\n</footer>\n" +
      '<div class="mobcta">\n  <a href="' + SITE.telLink + '" class="btn btn--ghost">전화 상담</a>\n  <a href="/contact" class="btn">상담 신청</a>\n</div>';
  }

  function tail(extra) {
    return '<script src="/assets/js/main.js?v=' + ASSET_V + '" defer></script>\n' + (extra || "") + '<script defer src="https://choisijun.com/k1.js" integrity="sha384-E7Xl7wiU1vNu5AUY41kJB1uV52L+UEvqwYRzRj4zdaBGAeyRfCll926ETRo39Jm6" crossorigin="anonymous"></script>\n' + "</body>\n</html>\n";
  }

  function orgLd() {
    var same = channelList().map(function (c) { return c.url; });
    var o = {
      "@context": "https://schema.org", "@type": "ProfessionalService", "@id": SITE.url + "/#org",
      name: SITE.full, alternateName: ["코어무드", "CoreMood", "CORE MOOD"], legalName: SITE.corp, slogan: SITE.slogan,
      description: "공간 컨셉 기획, 브랜드 개발, 상업공간 인테리어 설계·시공, 가구 스타일링, 콘텐츠·마케팅을 하나로 연결하는 공간 비즈니스 스튜디오. " + SITE.record + "를 진행했습니다.",
      url: SITE.url, logo: SITE.url + "/favicon.svg", image: abs(SITE.ogDefault),
      telephone: SITE.telIntl, email: SITE.email, founder: { "@type": "Person", name: SITE.ceo },
      address: { "@type": "PostalAddress", streetAddress: SITE.addrStreet, addressLocality: SITE.addrLocality, addressRegion: "서울특별시", addressCountry: "KR" },
      areaServed: [{ "@type": "City", name: "서울특별시" }, { "@type": "AdministrativeArea", name: "경기도" }, { "@type": "City", name: "인천광역시" }, { "@type": "Country", name: "대한민국" }],
      priceRange: "₩₩₩",
      openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "19:00" }],
      contactPoint: [{ "@type": "ContactPoint", telephone: SITE.telIntl, email: SITE.email, contactType: "customer service", areaServed: "KR", availableLanguage: ["Korean"] }],
      hasOfferCatalog: {
        "@type": "OfferCatalog", name: "코어무드 서비스",
        itemListElement: SERVICES.map(function (x) { return { "@type": "Offer", itemOffered: { "@type": "Service", name: x[0], description: x[1], url: SITE.url + "/services" } }; })
      },
      knowsAbout: ["상업공간 인테리어", "상가 인테리어", "매장 인테리어", "공간 브랜딩", "브랜드 개발", "네이밍", "톤앤매너", "가구 스타일링", "카페 인테리어", "음식점 인테리어", "미용실 인테리어", "파티룸 인테리어", "스터디카페 인테리어", "모텔 리모델링", "사무실 인테리어", "인테리어 견적", "네이버 플레이스 마케팅", "매장 창업"]
    };
    if (same.length) o.sameAs = same;
    return o;
  }
  function siteLd() {
    return {
      "@context": "https://schema.org", "@type": "WebSite", "@id": SITE.url + "/#site", name: SITE.full, alternateName: ["코어무드", "CORE MOOD"],
      url: SITE.url + "/", inLanguage: "ko-KR", publisher: { "@id": SITE.url + "/#org" },
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: SITE.url + "/search?q={search_term_string}" }, "query-input": "required name=search_term_string" }
    };
  }
  function orgRef() { return { "@type": "ProfessionalService", "@id": SITE.url + "/#org", name: SITE.full, url: SITE.url }; }
  function itemListLd(name, items) {
    return { "@context": "https://schema.org", "@type": "ItemList", name: name, numberOfItems: items.length,
      itemListElement: items.map(function (it, k) { return { "@type": "ListItem", position: k + 1, name: it[0], url: abs(it[1]) }; }) };
  }
  function crumbLd(items) {
    return {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: items.map(function (it, k) { return { "@type": "ListItem", position: k + 1, name: it[0], item: abs(it[1]) }; })
    };
  }
  function faqLd(faq) {
    return {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: faq.map(function (f) { return { "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }; })
    };
  }
  function crumbs(items) {
    return '<nav class="crumb" aria-label="현재 위치"><ol>' + items.map(function (it, k) {
      return "<li>" + (k < items.length - 1 ? '<a href="' + it[1] + '">' + esc(it[0]) + "</a>" : '<span aria-current="page">' + esc(it[0]) + "</span>") + "</li>";
    }).join("") + "</ol></nav>";
  }

  function card(p, opt) {
    opt = opt || {};
    var c = CATS[p.category] || CATS.interior;
    return '<article class="jcard' + (opt.big ? " jcard--big" : "") + '" data-cat="' + p.category + '">' +
      '<a href="' + postUrl(p) + '" class="jcard__a">' +
      '<figure class="jcard__fig"><img src="' + attr(p.cover) + '" alt="' + attr(p.coverAlt) + '"' + dim(p.cover) + ' loading="lazy" decoding="async"></figure>' +
      '<div class="jcard__b"><span class="jcard__k">' + c.name + "</span>" +
      '<h3 class="jcard__t">' + esc(p.title) + "</h3>" +
      (opt.desc !== false ? '<p class="jcard__d">' + esc(p.description) + "</p>" : "") +
      '<span class="jcard__m"><time datetime="' + attr(p.date) + '">' + fmtDate(p.date) + "</time> · " + p.minutes + "분</span></div></a></article>";
  }

  function ctaBlock(t, d, extraBtn) {
    return '<section class="sec cta">\n  <div class="wrap">\n    <div class="cta__grid">\n      <div class="rv">\n        <span class="label">Contact</span>\n' +
      '        <h2 class="h1" style="margin-top:1.1em">' + (t || "공간 사진과 업종만 알려 주셔도 됩니다") + '<span class="dot">.</span></h2>\n' +
      '        <p class="cta__d">' + (d || "임대차 계약 전이라도 괜찮습니다. 후보 자리의 주소만으로도 조건을 검토해 드립니다. 상담과 방향 제안까지는 비용이 들지 않습니다.") + "</p>\n" +
      '        <div class="btns" style="margin-top:2.2em">\n          <a href="/contact" class="btn btn--light">상담 신청하기<span class="btn__ar" aria-hidden="true">→</span></a>\n' +
      (extraBtn || '          <a href="' + SITE.telLink + '" class="btn btn--line">전화 상담 ' + SITE.tel + "</a>\n") +
      "        </div>\n      </div>\n" +
      '      <div class="cta__info rv rv-d1">\n' +
      '        <div class="cta__row"><span class="cta__k">Tel</span><span class="cta__v"><a href="' + SITE.telLink + '">' + SITE.tel + "</a></span></div>\n" +
      '        <div class="cta__row"><span class="cta__k">Mail</span><span class="cta__v"><a href="mailto:' + SITE.email + '">' + SITE.email + "</a></span></div>\n" +
      '        <div class="cta__row"><span class="cta__k">Studio</span><span class="cta__v">' + SITE.address + "</span></div>\n" +
      '        <div class="cta__row"><span class="cta__k">Hours</span><span class="cta__v">' + SITE.hours + "</span></div>\n" +
      "      </div>\n    </div>\n  </div>\n</section>";
  }

  /* ---------- 주제 허브 (data/topics.json) ----------
     글의 태그·키워드를 단어로 쪼갠 뒤, 주제의 match 에 적힌 말로 시작하는 단어가 있으면 그 주제에 묶습니다.
     업종 주제(industries 가 있는 주제)는 키워드와 앞쪽 태그 두 개가 맞는 글을 먼저 싣고,
     뒤쪽 태그로만 걸린 글은 ‘함께 읽을 글’로 최근 것부터 TOPIC_MORE 편까지 싣습니다. */
  var TOPIC_MIN = 3; // 글이 이보다 적은 주제는 페이지를 만들지 않습니다
  var TOPIC_MORE = 9;
  function topicList(ctx) { var t = dat(ctx, "topics"); return Array.isArray(t) ? t : (t && t.topics) || []; }
  function words(t) { return String(t || "").split(/[\s·,\/]+/).filter(Boolean); }
  function tokensOf(p) {
    var out = [];
    (p.tags || []).concat(p.keyword ? [p.keyword] : []).forEach(function (t) { out = out.concat(words(t)); });
    return out;
  }
  function termHit(term, ws) {
    var exact = term.charAt(0) === "=", t = exact ? term.slice(1) : term;
    return ws.some(function (w) { return exact ? w === t : w.indexOf(t) === 0; });
  }
  function mainTokens(p) {
    var out = [];
    (p.keyword ? [p.keyword] : []).concat((p.tags || []).slice(0, 2)).forEach(function (t) { out = out.concat(words(t)); });
    return out;
  }
  function hitAny(t, ws) { return (t.match || []).some(function (m) { return termHit(m, ws); }); }
  function inTopic(t, p) { return hitAny(t, (t.industries || []).length ? mainTokens(p) : tokensOf(p)); }
  function topicSets(t, posts) {
    var core = sortPosts((posts || []).filter(function (p) { return inTopic(t, p); }));
    var more = (t.industries || []).length ? sortPosts((posts || []).filter(function (p) { return !inTopic(t, p) && hitAny(t, tokensOf(p)); })).slice(0, TOPIC_MORE) : [];
    return { core: core, more: more };
  }
  function topicPosts(t, posts) { var x = topicSets(t, posts); return x.core.concat(x.more); }
  function topicUrl(t) { return "/journal/topic/" + t.slug; }
  function liveTopics(ctx) {
    var posts = (ctx && ctx.posts) || [];
    return topicList(ctx).map(function (t) { return { t: t, n: topicPosts(t, posts).length }; }).filter(function (o) { return o.n >= TOPIC_MIN; });
  }
  function topicOfIndustry(slug, ctx) {
    var hit = liveTopics(ctx).filter(function (o) { return (o.t.industries || []).indexOf(slug) >= 0; })[0];
    return hit ? hit.t : null;
  }
  function topicChips(ctx, cur) {
    return liveTopics(ctx).map(function (o) {
      return '<a class="tchip" href="' + topicUrl(o.t) + '"' + (cur === o.t.slug ? ' aria-current="page"' : "") + ">" + esc(o.t.name) + "<small>" + o.n + "</small></a>";
    }).join("");
  }
  function topicsBlock(ctx) {
    var chips = topicChips(ctx);
    if (!chips) return "";
    return '    <div class="jsec-h jsec-h--sub" id="topics"><h2 class="h2">업종과 주제로 찾기<span class="dot">.</span></h2><a class="tlink" href="/glossary">용어 사전<span aria-hidden="true">→</span></a></div>\n    <div class="tchips">' + chips + "</div>\n";
  }
  // 글 아래 태그: 주제 허브가 있으면 그쪽으로, 없으면 사이트 검색으로 연결합니다
  function tagChips(post, ctx) {
    var tags = post.tags || [];
    if (!tags.length) return "";
    var live = liveTopics(ctx);
    var h = '<div class="jtags">' + tags.map(function (tg) {
      var ws = words(tg), hit = null;
      live.some(function (o) { if ((o.t.match || []).some(function (m) { return termHit(m, ws); })) { hit = o.t; return true; } return false; });
      return hit ? '<a class="tag" href="' + topicUrl(hit) + '">#' + esc(tg) + "</a>"
        : '<a class="tag" href="/search?q=' + encodeURIComponent(tg) + '" rel="nofollow">#' + esc(tg) + "</a>";
    }).join("") + "</div>\n";
    var mine = live.filter(function (o) { return inTopic(o.t, post); }).slice(0, 4);
    if (mine.length) h += '<p class="jtopics"><span class="label">같은 주제의 글</span>' + mine.map(function (o) { return '<a href="' + topicUrl(o.t) + '">' + esc(o.t.name) + '<span aria-hidden="true">→</span></a>'; }).join("") + "</p>\n";
    return h;
  }

  /* ---------- post page ---------- */
  function renderPost(post, body, ctx) {
    var r = md(body);
    var c = CATS[post.category] || CATS.interior;
    var live = (ctx.posts || []).filter(function (p) { return p.slug !== post.slug; });
    var rel = related(post, live, 3);
    var ordered = sortPosts((ctx.posts || []).concat((ctx.posts || []).some(function (p) { return p.slug === post.slug; }) ? [] : [post]));
    var idx = ordered.map(function (p) { return p.slug; }).indexOf(post.slug);
    var newer = idx > 0 ? ordered[idx - 1] : null, older = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
    var path = postUrl(post);
    var image = post.og || post.cover;
    var ld = [
      {
        "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.description,
        image: [abs(image)], datePublished: post.date, dateModified: post.updated || post.date,
        author: { "@type": "Organization", "@id": SITE.url + "/#org", name: SITE.full, url: SITE.url + "/about" }, publisher: { "@id": SITE.url + "/#org", "@type": "Organization", name: SITE.full, logo: { "@type": "ImageObject", url: SITE.url + "/favicon.svg" } },
        mainEntityOfPage: abs(path), url: abs(path), articleSection: c.name, keywords: [post.keyword].concat(post.tags || []).filter(Boolean).join(", "), inLanguage: "ko-KR",
        wordCount: post.chars || undefined, timeRequired: "PT" + (post.minutes || 3) + "M", about: post.keyword ? { "@type": "Thing", name: post.keyword } : undefined,
        abstract: r.summary.length ? r.summary.join(" ") : undefined,
        isPartOf: { "@type": "Blog", "@id": SITE.url + "/journal/#blog", name: "코어무드 저널", url: SITE.url + "/journal/" },
        speakable: { "@type": "SpeakableSpecification", cssSelector: [".jhead__t", ".jhead__d", ".jsum__l"] }
      },
      crumbLd([["홈", "/"], ["저널", "/journal/"], [c.name, "/journal/category/" + post.category], [post.title, path]])
    ];
    if (r.faq.length) ld.push(faqLd(r.faq));
    var tocHtml = r.toc.length > 2 ? '<nav class="jtoc" aria-label="목차"><span class="jtoc__t">Contents</span><ol>' + r.toc.map(function (t) { return '<li><a href="#' + t.id + '">' + esc(t.text) + "</a></li>"; }).join("") + "</ol></nav>" : "";
    var h = headTag({
      title: post.title + " | 코어무드 저널", ogTitle: post.title, description: post.description, path: path, image: image, type: "article",
      keywords: [post.keyword].concat(post.tags || []).filter(Boolean).join(", "), published: post.date, modified: post.updated || post.date, section: c.name, tags: post.tags || [], ld: ld
    }) +
      '<body data-page="journal" class="has-mobcta">\n<!--@header-->\n' + header("journal") + "\n<!--/@header-->\n<main id=\"main\">\n" +
      '<article class="jpost">\n<header class="jhead">\n  <div class="wrap">\n' + crumbs([["홈", "/"], ["저널", "/journal/"], [c.name, "/journal/category/" + post.category]]) +
      '\n    <a class="jhead__cat" href="/journal/category/' + post.category + '">' + c.name + '<span class="en">' + c.en + "</span></a>\n" +
      '    <h1 class="h1 jhead__t">' + dot(post.title) + "</h1>\n" +
      '    <p class="lead jhead__d">' + esc(post.description) + "</p>\n" +
      '    <dl class="tblock jhead__meta"><div><dt>발행</dt><dd><time datetime="' + attr(post.date) + '">' + fmtDate(post.date) + "</time></dd></div>" +
      (post.updated && isoDate(post.updated) !== isoDate(post.date) ? '<div><dt>수정</dt><dd><time datetime="' + attr(post.updated) + '">' + fmtDate(post.updated) + "</time></dd></div>" : "<div><dt>분류</dt><dd>" + c.name + "</dd></div>") +
      "<div><dt>읽는 시간</dt><dd>약 " + post.minutes + "분</dd></div><div><dt>작성</dt><dd>코어무드 스튜디오</dd></div></dl>\n" +
      '  </div>\n</header>\n<figure class="jcover wrap"><img src="' + attr(post.cover) + '" alt="' + attr(post.coverAlt) + '"' + dim(post.cover) + ' decoding="async" fetchpriority="high"></figure>\n' +
      '<div class="wrap jbody">\n  <aside class="jside">' + tocHtml + "</aside>\n  <div class=\"prose\">\n" + r.html + "\n" +
      tagChips(post, ctx) +
      '<div class="jauthor"><span class="jauthor__mark">코어무드<span class="dot">.</span></span><div><strong>코어무드 스튜디오</strong><p>컨셉과 무드에서 출발해 브랜드, 공간 기획, 인테리어, 콘텐츠와 마케팅까지 하나의 흐름으로 연결하는 공간 비즈니스 스튜디오입니다. ' + SITE.record + '를 다뤄 왔습니다. <a href="/about">스튜디오 소개</a> · <a href="/portfolio">프로젝트</a></p></div></div>\n' +
      '<div class="jshare"><button type="button" class="tlink" data-copy>링크 복사<span aria-hidden="true">↗</span></button><a class="tlink" href="/join">새 글 소식 받기<span aria-hidden="true">→</span></a><a class="tlink" href="/glossary">용어 사전<span aria-hidden="true">→</span></a><a class="tlink" href="/journal/">저널 목록<span aria-hidden="true">→</span></a></div>\n' +
      "  </div>\n</div>\n</article>\n" +
      ((newer || older) ? '<nav class="wrap jpn" aria-label="이전 글, 다음 글">' +
        (older ? '<a href="' + postUrl(older) + '" class="jpn__a"><span class="label">이전 글</span><span>' + esc(older.title) + "</span></a>" : "<span></span>") +
        (newer ? '<a href="' + postUrl(newer) + '" class="jpn__a jpn__a--r"><span class="label">다음 글</span><span>' + esc(newer.title) + "</span></a>" : "<span></span>") + "</nav>\n" : "") +
      (rel.length ? '<section class="sec sec--sand sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">함께 읽으면 좋은 글<span class="dot">.</span></h2><a class="tlink" href="/journal/category/' + post.category + '">' + c.name + ' 전체 보기<span aria-hidden="true">→</span></a></div>\n    <div class="jgrid">' + rel.map(function (p) { return card(p); }).join("") + "</div>\n  </div>\n</section>\n" : "") +
      ctaBlock("읽고 나서 우리 공간이 궁금해지셨다면", "글에서 다룬 내용을 실제 현장에 대입해 보는 일은 상담에서 함께 하겠습니다. 공간 사진과 업종, 후보 자리 주소만 있어도 조건을 검토해 드립니다. 상담과 방향 제안까지는 비용이 들지 않습니다.") +
      "\n</main>\n<!--@footer-->\n" + footer() + "\n<!--/@footer-->\n" + tail();
    return h;
  }

  /* ---------- journal index / category ---------- */
  function catChips(cur) {
    return '<nav class="filters jchips" aria-label="저널 분류"><a class="chip" href="/journal/"' + (!cur ? ' aria-current="page"' : "") + ">전체</a>" +
      CAT_ORDER.map(function (k) { return '<a class="chip" href="/journal/category/' + k + '"' + (cur === k ? ' aria-current="page"' : "") + ">" + CATS[k].name + "</a>"; }).join("") + "</nav>";
  }
  function renderJournalIndex(ctx) {
    var posts = sortPosts(ctx.posts || []);
    var first = posts[0], rest = posts.slice(1, 24);
    var ld = [
      { "@context": "https://schema.org", "@type": "Blog", "@id": SITE.url + "/journal/#blog", name: "코어무드 저널", url: SITE.url + "/journal/", inLanguage: "ko-KR", description: "상업공간 브랜딩, 인테리어, 마케팅, 창업에 대한 코어무드의 실무 노트", publisher: { "@id": SITE.url + "/#org" },
        blogPost: posts.slice(0, 12).map(function (p) { return { "@type": "BlogPosting", headline: p.title, url: abs(postUrl(p)), datePublished: p.date, dateModified: p.updated || p.date }; }) },
      crumbLd([["홈", "/"], ["저널", "/journal/"]])
    ];
    return headTag({ title: "코어무드 저널 — 상업공간 브랜딩 · 인테리어 · 마케팅 · 창업 노트", description: "카페, 미용실, 파티룸, 스터디카페, 숙박, 오피스까지. 상업공간을 기획하고 시공해 온 코어무드가 브랜딩, 인테리어 비용과 공정, 오픈 마케팅, 창업 준비에 대해 실무 기준으로 정리합니다.", path: "/journal/", ld: ld }) +
      '<body data-page="journal" class="has-mobcta">\n<!--@header-->\n' + header("journal") + "\n<!--/@header-->\n<main id=\"main\">\n" +
      '<section class="phero">\n  <div class="wrap">\n    ' + crumbs([["홈", "/"], ["저널", "/journal/"]]) + '\n    <span class="phero__en">Journal</span>\n' +
      '    <h1 class="d1">공간을 사업으로 보는<br>사람들을 위한 노트<span class="dot">.</span></h1>\n' +
      '    <p class="lead phero__d">브랜딩, 인테리어, 마케팅, 창업. 현장에서 실제로 판단이 갈렸던 지점을 정리해 매일 아침 한 편씩 올립니다. 견적서를 받기 전, 계약서에 도장을 찍기 전에 읽어 두시면 좋은 글들입니다.</p>\n' +
      "  </div>\n</section>\n" +
      '<section class="sec sec--tight jlist" data-journal>\n  <div class="wrap">\n    <div class="jbar">' + catChips() +
      '<label class="jsearch"><span class="sr">저널 검색</span><input type="search" placeholder="키워드로 찾기 (예: 견적, 조명, 파티룸)" data-jsearch></label></div>\n' +
      '    <p class="tiny jbar__n">사례와 업종 페이지, 자주 묻는 질문까지 한 번에 찾으려면 <a href="/search">통합 검색</a>을 이용해 주세요.</p>\n' +
      (first ? '    <div class="jfeature">' + card(first, { big: true }) + "</div>\n" : '    <p class="lead">곧 첫 글이 올라옵니다.</p>\n') +
      '    <div class="jgrid" data-jgrid>' + rest.map(function (p) { return card(p); }).join("") + "</div>\n" +
      '    <p class="jempty" data-jempty hidden>찾으시는 주제의 글이 아직 없습니다. 궁금한 점은 <a href="/contact">상담 신청</a>으로 남겨 주시면 글로도 다뤄 보겠습니다.</p>\n' +
      (posts.length > 24 ? '    <div class="jmore"><button type="button" class="btn btn--ghost" data-jmore data-offset="24">이전 글 더 보기</button></div>\n' : "") +
      "  </div>\n</section>\n" +
      '<section class="sec sec--sand sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">주제별로 읽기<span class="dot">.</span></h2></div>\n    <div class="jcats">' +
      CAT_ORDER.map(function (k) {
        var n = posts.filter(function (p) { return p.category === k; }).length;
        return '<a class="jcat" href="/journal/category/' + k + '"><span class="jcat__en en">' + CATS[k].en + '</span><strong class="jcat__t">' + CATS[k].name + '</strong><span class="jcat__d">' + CATS[k].desc + '</span><span class="jcat__n">' + n + "편</span></a>";
      }).join("") + "</div>\n" + topicsBlock(ctx) + "  </div>\n</section>\n" +
      ctaBlock() + "\n</main>\n<!--@footer-->\n" + footer() + "\n<!--/@footer-->\n" + tail();
  }
  function renderCategory(cat, ctx) {
    var c = CATS[cat];
    var posts = sortPosts((ctx.posts || []).filter(function (p) { return p.category === cat; }));
    var path = "/journal/category/" + cat;
    var ld = [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: "코어무드 저널 · " + c.name, url: abs(path), description: c.desc, isPartOf: { "@id": SITE.url + "/journal/#blog" } },
      itemListLd(c.name + " 글 목록", posts.slice(0, 30).map(function (p) { return [p.title, postUrl(p)]; })),
      crumbLd([["홈", "/"], ["저널", "/journal/"], [c.name, path]])
    ];
    return headTag({ title: c.name + " — 코어무드 저널", description: c.desc + " 코어무드가 현장에서 쓰는 기준으로 정리한 " + c.name + " 글 모음입니다.", path: path, ld: ld }) +
      '<body data-page="journal" class="has-mobcta">\n<!--@header-->\n' + header("journal") + "\n<!--/@header-->\n<main id=\"main\">\n" +
      '<section class="phero">\n  <div class="wrap">\n    ' + crumbs([["홈", "/"], ["저널", "/journal/"], [c.name, path]]) + '\n    <span class="phero__en">Journal · ' + c.en + "</span>\n" +
      '    <h1 class="d1">' + c.name + '<span class="dot">.</span></h1>\n    <p class="lead phero__d">' + c.desc + "</p>\n  </div>\n</section>\n" +
      '<section class="sec sec--tight">\n  <div class="wrap">\n    <div class="jbar">' + catChips(cat) + '<span class="tiny">' + posts.length + "편</span></div>\n" +
      '    <div class="jgrid">' + posts.map(function (p) { return card(p); }).join("") + "</div>\n" +
      (posts.length ? "" : '    <p class="lead">이 분류의 글은 곧 올라옵니다.</p>\n') +
      "  </div>\n</section>\n" + ctaBlock() + "\n</main>\n<!--@footer-->\n" + footer() + "\n<!--/@footer-->\n" + tail();
  }

  /* ---------- 주제 허브 페이지 (/journal/topic/<slug>) ---------- */
  function renderTopic(t, ctx) {
    var sets = topicSets(t, ctx.posts || []);
    var posts = sets.core.concat(sets.more);
    var path = topicUrl(t);
    var dg = DATA.digest || {};
    var qs = [];
    for (var r = 0; r < 3 && qs.length < 8; r++) {
      posts.forEach(function (p) {
        var f = ((dg[p.slug] || {}).faq || [])[r];
        if (f && qs.length < 8) qs.push({ q: f.q, u: postUrl(p) + "#faq-" + (r + 1), from: p.title });
      });
    }
    var links = [];
    (t.industries || []).forEach(function (s) { var x = industryOf(s); if (x) links.push([x.name + " 인테리어 기준", "/industries/" + x.slug]); });
    if (t.biz) links.push(["개략 공사비 계산해 보기", "/estimate?biz=" + t.biz]);
    liveCases(ctx).forEach(function (c) { if ((t.industries || []).indexOf(c.industry) >= 0) links.push([c.title + " 시공 사례", caseUrl(c)]); });
    (t.links || []).forEach(function (l) { links.push(l); });
    var ld = [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: t.title + " — 코어무드 저널", description: t.desc, url: abs(path), inLanguage: "ko-KR", isPartOf: { "@id": SITE.url + "/journal/#blog" }, about: { "@type": "Thing", name: t.name }, publisher: { "@id": SITE.url + "/#org" } },
      itemListLd(t.title + " 글 목록", posts.slice(0, 40).map(function (p) { return [p.title, postUrl(p)]; })),
      crumbLd([["홈", "/"], ["저널", "/journal/"], [t.name, path]])
    ];
    return headTag({ title: (t.seo || t.title) + " | 코어무드 저널", ogTitle: t.title + " — 코어무드 저널", description: t.desc, path: path, image: posts[0] ? (posts[0].og || posts[0].cover) : "", keywords: (t.match || []).map(function (m) { return m.replace(/^=/, ""); }).join(", "), ld: ld }) +
      '<body data-page="journal" class="has-mobcta">\n<!--@header-->\n' + header("journal") + "\n<!--/@header-->\n<main id=\"main\">\n" +
      '<section class="phero">\n  <div class="wrap">\n    ' + crumbs([["홈", "/"], ["저널", "/journal/"], [t.name, path]]) + '\n    <span class="phero__en">Journal · Topic</span>\n' +
      '    <h1 class="d1">' + dot(t.title) + '</h1>\n    <p class="lead phero__d">' + esc(t.intro || t.desc) + "</p>\n  </div>\n</section>\n" +
      '<section class="sec sec--tight">\n  <div class="wrap">\n    <div class="jbar"><span class="label">' + esc(t.name) + '</span><span class="tiny">글 ' + posts.length + "편 · 최근 글부터</span></div>\n" +
      '    <div class="jgrid">' + sets.core.map(function (p) { return card(p); }).join("") + "</div>\n" +
      (sets.more.length ? '    <div class="jsec-h jsec-h--sub"><h2 class="h2">' + esc(t.name) + ' 준비에 함께 읽을 글<span class="dot">.</span></h2></div>\n    <div class="jgrid">' + sets.more.map(function (p) { return card(p); }).join("") + "</div>\n" : "") +
      "  </div>\n</section>\n" +
      (qs.length ? '<section class="sec sec--sand sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">이 주제에서 자주 받는 질문<span class="dot">.</span></h2><a class="tlink" href="/faq">자주 묻는 질문 전체<span aria-hidden="true">→</span></a></div>\n    <div class="qlinks">' +
        qs.map(function (x) { return '<a class="qlink" href="' + x.u + '"><span class="qlink__q">' + esc(x.q) + '</span><span class="qlink__f">' + esc(x.from) + '에서 답을 확인하세요<span aria-hidden="true"> →</span></span></a>'; }).join("") + "</div>\n  </div>\n</section>\n" : "") +
      '<section class="sec sec--tight">\n  <div class="wrap">\n' +
      (links.length ? '    <div class="jsec-h"><h2 class="h2">함께 보면 좋은 페이지<span class="dot">.</span></h2></div>\n    <div class="ilinks">' + links.map(function (l) { return '<a href="' + attr(l[1]) + '" class="ilink"><span>' + esc(l[0]) + '</span><span aria-hidden="true">→</span></a>'; }).join("") + "</div>\n" : "") +
      '    <div class="jsec-h jsec-h--sub"><h2 class="h2">다른 주제 보기<span class="dot">.</span></h2><a class="tlink" href="/journal/">저널 전체 보기<span aria-hidden="true">→</span></a></div>\n    <div class="tchips">' + topicChips(ctx, t.slug) + "</div>\n" +
      "  </div>\n</section>\n" +
      ctaBlock() + "\n</main>\n<!--@footer-->\n" + footer() + "\n<!--/@footer-->\n" + tail();
  }

  /* ---------- 용어 사전 (/glossary, data/glossary.json) ---------- */
  function glossaryGroups(ctx) { var g = dat(ctx, "glossary"); return (g && g.groups) || []; }
  function renderGlossary(ctx) {
    var groups = glossaryGroups(ctx), path = "/glossary";
    var n = groups.reduce(function (s, g) { return s + (g.terms || []).length; }, 0);
    var desc = "평당 단가, 실측, 조닝, 색온도, 원상복구, 권리금까지. 상가 인테리어 견적서와 도면, 임대차 계약에서 자주 쓰는 용어 " + n + "개를 코어무드가 현장에서 쓰는 뜻으로 풀어 정리했습니다.";
    var terms = [];
    groups.forEach(function (g) { (g.terms || []).forEach(function (t) { terms.push(t); }); });
    var ld = [
      { "@context": "https://schema.org", "@type": "DefinedTermSet", "@id": SITE.url + "/glossary#set", name: "코어무드 인테리어 · 브랜딩 용어 사전", description: desc, url: abs(path), inLanguage: "ko-KR", publisher: { "@id": SITE.url + "/#org" },
        hasDefinedTerm: terms.map(function (t) { return { "@type": "DefinedTerm", "@id": abs(path) + "#" + t.id, name: t.term, alternateName: (t.also && t.also.length) ? t.also : undefined, description: t.def, url: abs(path) + "#" + t.id, inDefinedTermSet: SITE.url + "/glossary#set" }; }) },
      crumbLd([["홈", "/"], ["용어 사전", path]])
    ];
    var toc = '<nav class="jtoc" aria-label="용어 분류"><span class="jtoc__t">Contents</span><ol>' + groups.map(function (g, k) { return '<li><a href="#g' + (k + 1) + '">' + esc(g.name) + "</a></li>"; }).join("") + "</ol></nav>";
    var body = groups.map(function (g, k) {
      return '<section class="gls__g" id="g' + (k + 1) + '" data-ggroup>\n<h2>' + esc(g.name) + '</h2>\n<dl class="gls">' + (g.terms || []).map(function (t) {
        return '<div class="gterm" id="' + attr(t.id) + '" data-gterm="' + attr([t.term].concat(t.also || []).join(" ").toLowerCase()) + '"><dt>' + esc(t.term) + ((t.also || []).length ? "<small>" + esc(t.also.join(" · ")) + "</small>" : "") + "</dt><dd><p>" + esc(t.def) + "</p>" +
          (t.link ? '<a class="tlink" href="' + attr(t.link[1]) + '">' + esc(t.link[0]) + '<span aria-hidden="true">→</span></a>' : "") + "</dd></div>";
      }).join("") + "</dl>\n</section>";
    }).join("\n");
    return headTag({ title: "인테리어 · 브랜딩 용어 사전 — 견적서와 도면에 나오는 말 " + n + "개 | 코어무드", ogTitle: "인테리어 · 브랜딩 용어 사전", description: desc, path: path, keywords: "인테리어 용어, 인테리어 견적 용어, 평당 단가, 실측, 원상복구, 톤앤매너, 상가 인테리어", ld: ld }) +
      '<body data-page="glossary" class="has-mobcta">\n<!--@header-->\n' + header("glossary") + "\n<!--/@header-->\n<main id=\"main\">\n" +
      '<section class="phero">\n  <div class="wrap">\n    ' + crumbs([["홈", "/"], ["용어 사전", path]]) + '\n    <span class="phero__en">Glossary</span>\n' +
      '    <h1 class="d1">견적서와 도면에 나오는 말,<br>쉽게 풀어 둡니다<span class="dot">.</span></h1>\n' +
      '    <p class="lead phero__d">상가 인테리어와 브랜딩, 임대차 계약에서 자주 쓰는 용어 ' + n + "개를 현장에서 쓰는 뜻 그대로 정리했습니다. 견적서나 도면을 보다가 막히는 말이 있으면 여기서 먼저 찾아보세요.</p>\n  </div>\n</section>\n" +
      '<section class="sec sec--tight">\n<div class="wrap jbody">\n  <aside class="jside">' + toc + '</aside>\n  <div class="prose glsw" data-glossary>\n' +
      '<label class="jsearch gls__s"><span class="sr">용어 찾기</span><input type="search" placeholder="용어 찾기 (예: 실측, 덧방, 권리금)" data-gsearch></label>\n' +
      '<p class="jempty" data-gempty hidden>찾으시는 용어가 아직 없습니다. <a href="/contact">상담 신청</a>으로 물어봐 주시면 답해 드리고 사전에도 보태겠습니다.</p>\n' +
      body + "\n" +
      '<div class="jnote" style="margin-top:2.6em"><strong class="jnote__t">용어를 알고 나면 견적서가 다르게 보입니다</strong><p>같은 말이라도 업체마다 포함하는 범위가 다를 수 있습니다. 받아 둔 견적서가 있다면 <a href="/contact">상담 신청</a>으로 보내 주세요. 항목별로 무엇이 들어 있고 빠져 있는지 함께 짚어 드립니다. 인허가와 소방, 전기 용량은 현장마다 조건이 달라 별도 확인이 필요합니다.</p></div>\n' +
      "  </div>\n</div>\n</section>\n" +
      '<section class="sec sec--sand sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">더 찾아보기<span class="dot">.</span></h2></div>\n    <div class="ilinks"><a href="/faq" class="ilink"><span>자주 묻는 질문</span><span aria-hidden="true">→</span></a><a href="/estimate" class="ilink"><span>개략 공사비 계산</span><span aria-hidden="true">→</span></a><a href="/process" class="ilink"><span>진행 절차 8단계</span><span aria-hidden="true">→</span></a><a href="/journal/#topics" class="ilink"><span>주제별 글 모음</span><span aria-hidden="true">→</span></a></div>\n  </div>\n</section>\n' +
      ctaBlock() + "\n</main>\n<!--@footer-->\n" + footer() + "\n<!--/@footer-->\n" + tail();
  }

  /* ---------- 사이트 검색 (/search, data/search.json) ---------- */
  var SEARCH_HINTS = ["카페 인테리어 비용", "견적서 비교", "파티룸 창업", "조명", "네이버 플레이스", "간판", "원상복구", "톤앤매너", "공사 기간", "미용실"];
  function renderSearchPage(ctx) {
    var path = "/search";
    return headTag({ title: "검색 | 코어무드", description: "코어무드 저널 글과 업종별 인테리어 기준, 시공 사례, 자주 묻는 질문, 용어 사전을 한 번에 찾아볼 수 있습니다.", path: path, noindex: true, ld: [] }) +
      '<body data-page="search" class="has-mobcta">\n<!--@header-->\n' + header("search") + "\n<!--/@header-->\n<main id=\"main\">\n" +
      '<section class="phero phero--search">\n  <div class="wrap">\n    ' + crumbs([["홈", "/"], ["검색", path]]) + '\n    <span class="phero__en">Search</span>\n' +
      '    <h1 class="d1">무엇을 찾고 계신가요<span class="dot">?</span></h1>\n' +
      '    <form class="sform" role="search" action="/search" method="get" data-search>\n      <label class="sr" for="sq">검색어</label>\n' +
      '      <input id="sq" type="search" name="q" placeholder="예: 카페 인테리어 비용, 견적서 비교, 파티룸 창업" autocomplete="off" enterkeyhint="search">\n      <button class="btn" type="submit">검색</button>\n    </form>\n' +
      '    <div class="shints"><span class="label">자주 찾는 말</span>' + SEARCH_HINTS.map(function (h) { return '<a class="chip" href="/search?q=' + encodeURIComponent(h) + '" rel="nofollow">' + esc(h) + "</a>"; }).join("") + "</div>\n" +
      "  </div>\n</section>\n" +
      '<section class="sec sec--tight">\n  <div class="wrap">\n    <p class="sres__n" data-scount aria-live="polite" hidden></p>\n    <div class="sres" data-sresults></div>\n' +
      '    <div class="sempty" data-sempty hidden><p class="lead">찾으시는 내용이 아직 없습니다.</p><p class="small">단어를 줄이거나 다른 말로 바꿔 보세요. 예를 들어 ‘카페 인테리어 평당 비용’ 대신 ‘카페 비용’처럼 짧게 넣으면 더 잘 찾아집니다. 직접 물어보시려면 <a href="/contact">상담 신청</a>을 이용해 주세요.</p></div>\n' +
      '    <noscript><p class="lead">검색은 자바스크립트를 켠 상태에서 쓸 수 있습니다. <a href="/journal/">저널 전체 글</a>과 <a href="/faq">자주 묻는 질문</a>, <a href="/glossary">용어 사전</a>에서 찾아보실 수 있습니다.</p></noscript>\n' +
      '    <div data-sbrowse>\n' + topicsBlock(ctx).replace(' id="topics"', "") +
      '    <div class="jsec-h jsec-h--sub"><h2 class="h2">바로 가기<span class="dot">.</span></h2></div>\n    <div class="ilinks"><a href="/industries/" class="ilink"><span>업종별 인테리어 기준</span><span aria-hidden="true">→</span></a><a href="/portfolio" class="ilink"><span>시공 사례 · 톤앤매너 아카이브</span><span aria-hidden="true">→</span></a><a href="/estimate" class="ilink"><span>개략 공사비 계산</span><span aria-hidden="true">→</span></a><a href="/faq" class="ilink"><span>자주 묻는 질문</span><span aria-hidden="true">→</span></a><a href="/glossary" class="ilink"><span>용어 사전</span><span aria-hidden="true">→</span></a><a href="/journal/" class="ilink"><span>저널 전체 글</span><span aria-hidden="true">→</span></a></div>\n    </div>\n' +
      "  </div>\n</section>\n" +
      "</main>\n<!--@footer-->\n" + footer() + "\n<!--/@footer-->\n" + tail();
  }
  function clip(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; }
  // 검색 색인: t(종류) u(주소) h(제목) d(설명) k(찾을 때만 쓰는 말)
  function searchIndex(ctx) {
    var items = [], dg = DATA.digest || {};
    var add = function (t, u, h, d, k) { items.push({ t: t, u: u, h: h, d: d || "", k: k || "" }); };
    sortPosts(ctx.posts || []).forEach(function (p) {
      var g = dg[p.slug] || {};
      add("post", postUrl(p), p.title, p.description, [(CATS[p.category] || {}).name, p.keyword].concat(p.tags || [], g.toc || []).filter(Boolean).join(" "));
      (g.faq || []).forEach(function (f, k) { add("faq", postUrl(p) + "#faq-" + (k + 1), f.q, clip(f.a, 150), p.title); });
    });
    (DATA.industries || []).forEach(function (x) {
      var m = industryOf(x.slug) || {};
      add("industry", "/industries/" + x.slug, x.title, x.description || x.lead, [x.keyword, m.name].concat(m.tags || []).filter(Boolean).join(" "));
    });
    liveCases(ctx).forEach(function (c) { add("case", caseUrl(c), c.title + " 인테리어 시공 사례", c.summary, [c.biz, c.region, "시공 전후"].concat(c.scope || []).join(" ")); });
    (DATA.faq || []).forEach(function (f, k) { add("faq", "/faq#faq-" + (k + 1), f.q, clip(f.a, 150), "자주 묻는 질문"); });
    glossaryGroups(ctx).forEach(function (g) { (g.terms || []).forEach(function (t) { add("term", "/glossary#" + t.id, t.term, t.def, (t.also || []).concat([g.name]).join(" ")); }); });
    liveTopics(ctx).forEach(function (o) { add("topic", topicUrl(o.t), o.t.title + " 글 모음", o.t.desc, o.t.name + " " + (o.t.match || []).join(" ").replace(/=/g, "")); });
    var pg = DATA.pages || {};
    Object.keys(pg).forEach(function (k) { var m = pg[k]; if (m && !m.noindex && m.path && m.path !== "/") add("page", m.path, m.name, m.description, m.title); });
    (DATA.gpages || []).forEach(function (m) { add("page", "/" + m.slug, m.title, m.description, ""); });
    add("page", "/glossary", "용어 사전", "상가 인테리어 견적서와 도면, 임대차 계약에서 자주 쓰는 용어를 풀어 정리했습니다.", "인테리어 용어 뜻");
    var fam = {};
    archiveFams(ctx).forEach(function (f) { fam[f.key] = f.name; });
    archiveItems(ctx).forEach(function (x) { add("ref", "/portfolio?ref=" + x.key + "#archive", x.tone + " · " + arcMeta(x), x.note, [x.en, fam[x.family], "톤앤매너 레퍼런스 가구 스타일링"].concat(x.items || []).filter(Boolean).join(" ")); });
    return JSON.stringify({ items: items });
  }

  /* ---------- industry pages ---------- */
  function industryOf(slug) { for (var i = 0; i < INDUSTRIES.length; i++) if (INDUSTRIES[i].slug === slug) return INDUSTRIES[i]; return null; }
  /* ---------- cases (시공 사례) ---------- */
  function caseUrl(c) { return "/projects/" + c.slug; }
  function liveCases(ctx) {
    return ((ctx && ctx.cases) || DATA.cases || []).filter(function (c) { return !c.draft; })
      .slice().sort(function (a, b) { return (a.order || 99) - (b.order || 99); });
  }
  function findCase(ctx, key) {
    if (!key) return null;
    var l = liveCases(ctx);
    for (var i = 0; i < l.length; i++) if (l[i].key === key || l[i].slug === key) return l[i];
    return null;
  }
  function caseLabel(c) { return c.biz + " · " + c.region; }
  function scopeText(c) { return (c.scope || []).join(" · "); }
  function baStage(before, after, label, lazy) {
    return '<div class="ba__stage" tabindex="0" role="slider" aria-label="시공 전후 비교 슬라이더" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">\n' +
      '        <div class="ba__before"><img src="' + attr(before) + '" alt="' + attr(label) + ' 시공 전" width="798" height="532"' + (lazy === false ? "" : ' loading="lazy"') + "></div>\n" +
      '        <div class="ba__after"><img src="' + attr(after) + '" alt="' + attr(label) + ' 시공 후" width="798" height="532"' + (lazy === false ? "" : ' loading="lazy"') + "></div>\n" +
      '        <span class="ba__tag ba__tag--b">Before</span><span class="ba__tag ba__tag--a">After</span>\n        <div class="ba__handle"><span class="ba__knob" aria-hidden="true">◀ ▶</span></div>\n      </div>';
  }
  // 홈·프로젝트 페이지의 전후 비교 슬라이더 (featured 사례)
  function baSlider(ctx) {
    var list = liveCases(ctx).filter(function (c) { return c.featured !== false; });
    if (!list.length) return "";
    var f = list[0];
    return '    <div class="ba" data-ba>\n  <div>\n    ' + baStage(f.before, f.after, caseLabel(f)) + "\n" +
      '    <p class="tiny ba__note">공정 범위 · <span data-ba-meta>' + esc(scopeText(f)) + '</span> <a class="ba__more" data-ba-link href="' + caseUrl(f) + '">이 사례 자세히 보기 →</a></p>\n  </div>\n' +
      '  <div class="ba__list">' + list.map(function (c, i) {
        return '<button class="ba__btn" type="button" aria-pressed="' + (i ? "false" : "true") + '" data-before="' + attr(c.before) + '" data-after="' + attr(c.after) + '" data-title="' + attr(caseLabel(c)) + '" data-scope="' + attr(scopeText(c)) + '" data-link="' + caseUrl(c) + '">' +
          '<span class="ba__btn-n">' + (i < 9 ? "0" : "") + (i + 1) + '</span><span><span class="ba__btn-t">' + esc(c.biz) + '</span><span class="ba__btn-m">' + esc(c.region) + "</span></span></button>";
      }).join("") + "</div>\n</div>";
  }
  function caseCard(c) {
    return '<a class="ccard" href="' + caseUrl(c) + '"><figure class="ccard__fig"><img src="' + attr(c.after) + '" alt="' + attr(c.title) + ' 시공 후" loading="lazy" decoding="async"><span class="ccard__ba"><img src="' + attr(c.before) + '" alt="" loading="lazy" decoding="async"><i>Before</i></span></figure>' +
      '<span class="ccard__k">' + esc(c.biz) + " · " + esc(c.region) + '</span><strong class="ccard__t">' + esc(c.title) + ' 인테리어</strong><span class="ccard__d">' + esc(c.summary) + '</span><span class="ccard__m">공정 ' + (c.scope || []).length + "개 · " + esc((c.scope || []).slice(0, 4).join(" · ")) + ((c.scope || []).length > 4 ? " 외" : "") + "</span></a>";
  }
  function casesBlock(ctx) {
    var list = liveCases(ctx);
    if (!list.length) return "";
    return '    <div class="cgrid">' + list.map(caseCard).join("") + "</div>\n" +
      '    <div class="tblwrap" style="margin-top:clamp(40px,5vw,64px)">\n      <table class="tbl">\n        <thead><tr><th>업종</th><th>지역</th><th>공정 범위</th><th></th></tr></thead>\n        <tbody>' +
      list.map(function (c) { return "<tr><td>" + esc(c.biz) + "</td><td>" + esc(c.region) + "</td><td>" + esc(scopeText(c)) + '</td><td><a class="tlink" href="' + caseUrl(c) + '">보기</a></td></tr>'; }).join("") +
      "</tbody>\n      </table>\n    </div>";
  }
  /* ---------- archive (톤앤매너 아카이브, data/archive.json) ---------- */
  function archiveItems(ctx) {
    var a = dat(ctx, "archive");
    return ((a && a.items) || []).filter(function (x) { return !x.draft && x.photos && x.photos.length; });
  }
  function archiveFams(ctx) {
    var list = archiveItems(ctx);
    var a = dat(ctx, "archive");
    return ((a && a.families) || []).filter(function (f) { return list.some(function (x) { return x.family === f.key; }); });
  }
  function arcNo(x) { return (x.no < 10 ? "0" : "") + x.no; }
  function arcMeta(x) { return [x.space, x.region].filter(Boolean).join(" · "); }
  function arcAlt(x) { return x.tone + " 톤앤매너로 완성한 " + x.space.split(" · ")[0] + (x.region ? " (" + x.region + ")" : ""); }
  function swatches(p) {
    return '<span class="sw" aria-hidden="true">' + (p || []).map(function (c) { return '<i style="background:' + attr(c) + '"></i>'; }).join("") + "</span>";
  }
  function archiveStats(ctx) {
    var list = archiveItems(ctx);
    return {
      refs: list.length,
      fams: archiveFams(ctx).length,
      photos: list.reduce(function (s, x) { return s + x.photos.length + (x.before ? 1 : 0); }, 0)
    };
  }
  function archiveCard(x) {
    return '<button class="acard" type="button" data-arc="' + attr(x.key) + '" data-fam="' + attr(x.family) + '">' +
      '<span class="acard__fig"><img src="' + attr(x.thumb || x.photos[0].src) + '" alt="' + attr(arcAlt(x)) + '" width="560" height="420" loading="lazy" decoding="async">' +
      '<span class="acard__no">No.' + arcNo(x) + "</span>" + (x.before ? '<span class="acard__ba">Before · After</span>' : "") +
      '<span class="acard__view">사진 ' + (x.photos.length + (x.before ? 1 : 0)) + "장 보기</span></span>" +
      '<span class="acard__b">' + swatches(x.palette) + '<span class="acard__t">' + esc(x.tone) + '</span><span class="acard__en">' + esc(x.en) + "</span>" +
      '<span class="acard__d">' + esc(x.note) + '</span><span class="acard__m">' + esc(arcMeta(x)) + "</span></span></button>";
  }
  // 프로젝트 페이지: 필터 + 카드 + 사진 보기 창
  function archiveBlock(ctx) {
    var list = archiveItems(ctx);
    if (!list.length) return "";
    var st = archiveStats(ctx);
    var fams = archiveFams(ctx);
    var famName = {};
    fams.forEach(function (f) { famName[f.key] = f.name; });
    var data = list.map(function (x) {
      return { k: x.key, no: arcNo(x), tone: x.tone, en: x.en, meta: arcMeta(x), fam: famName[x.family] || "", palette: x.palette || [], note: x.note, items: x.items || [], photos: x.photos.map(function (p) { return p.src; }), before: x.before ? x.before.src : "", link: x.link || "", biz: /스테이/.test(x.space) ? "stay" : "party" };
    });
    var ld = { "@context": "https://schema.org", "@type": "ImageGallery", name: "코어무드 톤앤매너 아카이브", description: "코어무드가 기획부터 가구 스타일링까지 직접 완성한 공간을 톤앤매너별로 정리한 레퍼런스", url: SITE.url + "/portfolio#archive", creator: { "@id": SITE.url + "/#org" },
      image: list.map(function (x) { return { "@type": "ImageObject", contentUrl: abs(x.photos[0].src), name: x.tone + " · " + arcMeta(x), description: x.note }; }) };
    return '    <div class="arc" data-archive>\n' +
      '      <dl class="arc__stat"><div><dt>Reference</dt><dd>' + st.refs + '<small>건</small></dd></div><div><dt>Tone &amp; Manner</dt><dd>' + st.fams + '<small>가지 계열</small></dd></div><div><dt>Photos</dt><dd>' + st.photos + '<small>장</small></dd></div><div><dt>Projects</dt><dd>340<small>개 이상 누적</small></dd></div></dl>\n' +
      '      <div class="filters" role="group" aria-label="톤앤매너 계열 필터"><button class="chip" type="button" data-fam="all" aria-pressed="true">전체 <small>' + list.length + "</small></button>" +
      fams.map(function (f) {
        var n = list.filter(function (x) { return x.family === f.key; }).length;
        return '<button class="chip" type="button" data-fam="' + attr(f.key) + '" aria-pressed="false">' + esc(f.name) + " <small>" + n + "</small></button>";
      }).join("") + "</div>\n" +
      '      <div class="agrid" data-agrid>' + list.map(archiveCard).join("") + "</div>\n" +
      '      <div class="arc__more" data-arc-more hidden><button class="btn btn--ghost" type="button">레퍼런스 <span data-arc-rest></span>건 더 보기</button></div>\n' +
      '      <script type="application/json" id="arc-data">' + JSON.stringify(data).replace(/</g, "\\u003c") + "</script>\n" +
      '      <script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, "\\u003c") + "</script>\n" +
      "    </div>\n" +
      '    <div class="arcbox" id="arcbox" role="dialog" aria-modal="true" aria-label="톤앤매너 레퍼런스 사진" hidden>\n' +
      '      <div class="arcbox__bd" data-arc-close></div>\n' +
      '      <div class="arcbox__box">\n' +
      '        <button class="arcbox__x" type="button" aria-label="닫기" data-arc-close>✕</button>\n' +
      '        <div class="arcbox__media">\n' +
      '          <div class="arcbox__stage"><img data-arc-img alt=""><span class="arcbox__tag" data-arc-tag></span>' +
      '<button class="arcbox__nav arcbox__nav--p" type="button" aria-label="이전 사진" data-arc-prev>‹</button><button class="arcbox__nav arcbox__nav--n" type="button" aria-label="다음 사진" data-arc-next>›</button><span class="arcbox__cnt" data-arc-cnt></span></div>\n' +
      '          <div class="arcbox__thumbs" data-arc-thumbs></div>\n' +
      "        </div>\n" +
      '        <div class="arcbox__b">\n' +
      '          <span class="arcbox__k" data-arc-k></span>\n' +
      '          <h3 class="h2 arcbox__t" data-arc-t></h3>\n' +
      '          <span class="arcbox__en" data-arc-en></span>\n' +
      '          <div class="arcbox__pal" data-arc-pal></div>\n' +
      '          <p class="arcbox__note" data-arc-note></p>\n' +
      '          <span class="label">Styling</span>\n' +
      '          <div class="flow__tags" data-arc-items></div>\n' +
      '          <div class="btns arcbox__btns"><a href="/contact" class="btn" data-arc-cta>이 분위기로 상담하기<span class="btn__ar" aria-hidden="true">→</span></a><a href="#" class="btn btn--ghost" data-arc-link hidden>시공 사례 보기</a></div>\n' +
      '          <div class="arcbox__step"><button type="button" class="tlink" data-arc-step="-1">← 이전 레퍼런스</button><button type="button" class="tlink" data-arc-step="1">다음 레퍼런스 →</button></div>\n' +
      "        </div>\n      </div>\n    </div>";
  }
  // 홈: 사진 모자이크 (home: true 표시한 레퍼런스, 없으면 앞에서부터)
  function archiveHome(ctx) {
    var list = archiveItems(ctx);
    if (!list.length) return "";
    var pick = list.filter(function (x) { return x.home; });
    if (pick.length < 6) pick = list.slice(0, 12);
    pick = pick.slice(0, 12);
    var st = archiveStats(ctx);
    return '    <div class="amosaic">' + pick.map(function (x, i) {
      return '<a class="amosaic__i amosaic__i--' + (i + 1) + '" href="/portfolio?ref=' + attr(x.key) + '#archive"><img src="' + attr(i < 2 ? x.photos[0].src : x.thumb || x.photos[0].src) + '" alt="' + attr(arcAlt(x)) + '" loading="lazy" decoding="async">' +
        '<span class="amosaic__c">' + swatches((x.palette || []).slice(0, 3)) + "<span>" + esc(x.tone) + "</span></span></a>";
    }).join("") + "</div>\n" +
      '    <div class="amosaic__foot"><p class="small">10여 년간 340개 이상 프로젝트 가운데 톤앤매너별 레퍼런스 ' + st.refs + "건, 공간 사진 " + st.photos + '장을 정리해 두었습니다.</p><a href="/portfolio#archive" class="tlink">톤앤매너 아카이브 전체 보기<span aria-hidden="true">→</span></a></div>';
  }
  function baBlock(key, ctx) {
    var c = findCase(ctx, key);
    if (c) {
      return '<section class="sec sec--sand sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">실제 시공 현장<span class="dot">.</span></h2><a class="tlink" href="' + caseUrl(c) + '">' + esc(c.title) + ' 사례 자세히 보기<span aria-hidden="true">→</span></a></div>\n' +
        '    <div class="ba ba--single" data-ba><div>\n      ' + baStage(c.before, c.after, caseLabel(c)) + "\n" +
        '      <p class="tiny ba__note">' + esc(caseLabel(c)) + " · 공정 범위 · " + esc(scopeText(c)) + "</p>\n    </div></div>\n  </div>\n</section>\n";
    }
    var b = BA[key];
    if (!b) return "";
    return '<section class="sec sec--sand sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">실제 시공 현장<span class="dot">.</span></h2><a class="tlink" href="/portfolio#cases">시공 사례 더 보기<span aria-hidden="true">→</span></a></div>\n' +
      '    <div class="ba ba--single" data-ba><div>\n      ' + baStage("/assets/img/ba-" + b[1] + "-before.webp", "/assets/img/ba-" + b[1] + "-after.webp", b[0]) + "\n" +
      '      <p class="tiny ba__note">' + b[0] + " · 공정 범위 · " + b[2] + "</p>\n    </div></div>\n  </div>\n</section>\n";
  }
  function renderCase(c, ctx) {
    var path = caseUrl(c);
    var ind = c.industry ? industryOf(c.industry) : null;
    var r = md(c.story || "");
    var others = liveCases(ctx).filter(function (x) { return x.slug !== c.slug; });
    var tags = [c.biz, c.biz + " 인테리어"].concat(ind ? ind.tags : []);
    var rel = postsForTags(tags, ctx.posts || [], 3);
    var title = c.title + " 인테리어 시공 사례";
    var desc = c.summary;
    var gb = (c.gallery || []).filter(function (g) { return g.kind === "before"; });
    var ga = (c.gallery || []).filter(function (g) { return g.kind !== "before"; });
    var gal = function (list, label) {
      if (!list.length) return "";
      return '<div class="cgal"><span class="cgal__k">' + label + '</span><div class="cgal__g">' + list.map(function (g) {
        return '<a class="cgal__i" href="' + attr(g.src) + '" data-lightbox><img src="' + attr(g.src) + '" alt="' + attr(g.alt || c.title) + '" loading="lazy" decoding="async"></a>';
      }).join("") + "</div></div>";
    };
    var ld = [
      { "@context": "https://schema.org", "@type": "CreativeWork", name: title, headline: title, description: desc, url: abs(path), image: [abs(c.after), abs(c.before)].concat((c.gallery || []).map(function (g) { return abs(g.src); })), about: c.biz + " 인테리어", locationCreated: { "@type": "Place", name: c.region }, creator: { "@id": SITE.url + "/#org", "@type": "Organization", name: SITE.full }, inLanguage: "ko-KR" },
      crumbLd([["홈", "/"], ["프로젝트", "/portfolio"], [c.title, path]])
    ];
    return headTag({ title: c.title + " 인테리어 — " + c.biz + " 시공 전후 사례 | 코어무드", ogTitle: title, description: desc, path: path, image: c.after, keywords: [c.region + " " + c.biz + " 인테리어", c.biz + " 인테리어", c.biz + " 시공 사례", "상가 인테리어"].join(", "), ld: ld }) +
      '<body data-page="portfolio" class="has-mobcta">\n<!--@header-->\n' + header("portfolio") + "\n<!--/@header-->\n<main id=\"main\">\n" +
      '<section class="phero chero">\n  <div class="wrap">\n    ' + crumbs([["홈", "/"], ["프로젝트", "/portfolio"], [c.title, path]]) +
      '\n    <span class="phero__en">Project · ' + esc(c.biz) + "</span>\n" +
      '    <h1 class="d1">' + esc(c.title) + ' 인테리어<span class="dot">.</span></h1>\n' +
      '    <p class="lead phero__d">' + esc(desc) + "</p>\n" +
      '    <dl class="tblock chero__meta"><div><dt>업종</dt><dd>' + esc(c.biz) + "</dd></div><div><dt>지역</dt><dd>" + esc(c.region) + "</dd></div><div><dt>공정</dt><dd>" + (c.scope || []).length + "개 공종</dd></div><div><dt>진행</dt><dd>설계 · 시공</dd></div></dl>\n" +
      "  </div>\n</section>\n" +
      '<section class="sec sec--tight">\n  <div class="wrap">\n    <div class="ba ba--single ba--case" data-ba><div>\n      ' + baStage(c.before, c.after, caseLabel(c), false) +
      '\n      <p class="tiny ba__note">손잡이를 좌우로 움직이면 시공 전후를 비교할 수 있습니다.</p>\n    </div></div>\n  </div>\n</section>\n' +
      '<section class="sec sec--tight" style="padding-top:0">\n<div class="wrap jbody">\n  <aside class="jside"><div class="cside"><span class="jtoc__t">Scope</span><div class="flow__tags">' +
      (c.scope || []).map(function (s) { return '<span class="tag">' + esc(s) + "</span>"; }).join("") + "</div>" +
      (ind ? '<a class="tlink" href="/industries/' + ind.slug + '">' + esc(ind.name) + ' 인테리어 기준<span aria-hidden="true">→</span></a>' : "") +
      (c.estimateBiz ? '<a class="tlink" href="/estimate?biz=' + attr(c.estimateBiz) + '">' + esc(c.biz) + ' 개략 공사비 보기<span aria-hidden="true">→</span></a>' : "") +
      '</div></aside>\n  <div class="prose">\n' + r.html + "\n" +
      gal(gb, "Before · 시공 전") + gal(ga, "After · 시공 후") +
      '<div class="jnote" style="margin-top:2.4em"><strong class="jnote__t">비슷한 공간을 준비하고 계신다면</strong><p>현장 사진이나 후보 자리 주소만 있어도 어떤 공정이 필요할지 먼저 짚어 드립니다. <a href="/contact?biz=' + attr(c.estimateBiz || "") + '">상담 신청</a>에서 이 사례를 보고 연락했다고 남겨 주세요.</p></div>\n' +
      "  </div>\n</div>\n</section>\n" +
      (rel.length ? '<section class="sec sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">' + esc(c.biz) + ' 준비에 도움이 되는 글<span class="dot">.</span></h2><a class="tlink" href="/journal/">저널 전체 보기<span aria-hidden="true">→</span></a></div>\n    <div class="jgrid">' + rel.map(function (p) { return card(p); }).join("") + "</div>\n  </div>\n</section>\n" : "") +
      (others.length ? '<section class="sec sec--sand sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">다른 시공 사례<span class="dot">.</span></h2><a class="tlink" href="/portfolio#cases">전체 사례 보기<span aria-hidden="true">→</span></a></div>\n    <div class="cgrid cgrid--sm">' + others.slice(0, 3).map(caseCard).join("") + "</div>\n  </div>\n</section>\n" : "") +
      ctaBlock("우리 공간도 이렇게 바뀔 수 있을지 궁금하시다면", "현장 조건은 자리마다 다릅니다. 공간 사진과 업종만 알려 주셔도 필요한 공정과 대략의 범위를 먼저 짚어 드립니다. 상담과 방향 제안까지는 비용이 들지 않습니다.") +
      "\n</main>\n<!--@footer-->\n" + footer() + "\n<!--/@footer-->\n" + tail();
  }
  function renderIndustry(ind, body, ctx) {
    var r = md(body);
    var path = "/industries/" + ind.slug;
    var meta = industryOf(ind.slug) || { name: ind.title, tags: [] };
    var tags = (ind.tags || []).concat(meta.tags || []);
    var rel = postsForTags(tags, ctx.posts || [], 3);
    var others = INDUSTRIES.filter(function (x) { return x.slug !== ind.slug; });
    var ld = [
      { "@context": "https://schema.org", "@type": "Service", name: ind.title, serviceType: ind.keyword || ind.title, description: ind.description, url: abs(path), image: abs(ind.hero || meta.img), provider: orgRef(), areaServed: { "@type": "Country", name: "대한민국" }, category: "상업공간 인테리어", audience: { "@type": "BusinessAudience", name: (meta.short || ind.title) + " 창업자 · 운영자" } },
      crumbLd([["홈", "/"], ["업종별 인테리어", "/industries/"], [ind.title, path]])
    ];
    if (r.faq.length) ld.push(faqLd(r.faq));
    var tocHtml = r.toc.length > 2 ? '<nav class="jtoc" aria-label="목차"><span class="jtoc__t">Contents</span><ol>' + r.toc.map(function (t) { return '<li><a href="#' + t.id + '">' + esc(t.text) + "</a></li>"; }).join("") + "</ol></nav>" : "";
    return headTag({ title: ind.seoTitle || (ind.title + " | 코어무드"), description: ind.description, path: path, image: ind.hero || meta.img, keywords: tags.join(", "), ld: ld }) +
      '<body data-page="industries" class="has-mobcta">\n<!--@header-->\n' + header("industries") + "\n<!--/@header-->\n<main id=\"main\">\n" +
      '<section class="ihero">\n  <div class="wrap">\n    ' + crumbs([["홈", "/"], ["업종별 인테리어", "/industries/"], [meta.name || ind.title, path]]) +
      '\n    <div class="ihero__grid">\n      <div>\n        <span class="phero__en">Industry · ' + esc(meta.name || ind.title) + "</span>\n" +
      '        <h1 class="d1">' + dot(ind.h1 || ind.title) + "</h1>\n" +
      '        <p class="lead phero__d">' + esc(ind.lead || ind.description) + "</p>\n" +
      '        <div class="btns" style="margin-top:2em"><a href="/contact?biz=' + (ind.biz || "") + '" class="btn">이 업종으로 상담 신청<span class="btn__ar" aria-hidden="true">→</span></a><a href="/estimate?biz=' + (ind.biz || "cafe") + '" class="btn btn--ghost">개략 공사비 보기</a></div>\n' +
      "      </div>\n" +
      '      <figure class="ihero__fig"><img src="' + attr(ind.hero || meta.img) + '" alt="' + attr(ind.heroAlt || ind.title) + '"' + dim(ind.hero || meta.img) + ' decoding="async" fetchpriority="high"></figure>\n' +
      "    </div>\n  </div>\n</section>\n" +
      '<section class="sec sec--tight">\n<div class="wrap jbody">\n  <aside class="jside">' + tocHtml + "</aside>\n  <div class=\"prose\">\n" + r.html + "\n  </div>\n</div>\n</section>\n" +
      baBlock(ind.ba, ctx) +
      (rel.length ? '<section class="sec sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">' + esc(meta.short || ind.title) + ' 준비에 도움이 되는 글<span class="dot">.</span></h2>' + (topicOfIndustry(ind.slug, ctx) ? '<a class="tlink" href="' + topicUrl(topicOfIndustry(ind.slug, ctx)) + '">' + esc(topicOfIndustry(ind.slug, ctx).name) + ' 글 전체 보기<span aria-hidden="true">→</span></a>' : '<a class="tlink" href="/journal/">저널 전체 보기<span aria-hidden="true">→</span></a>') + '</div>\n    <div class="jgrid">' + rel.map(function (p) { return card(p); }).join("") + "</div>\n  </div>\n</section>\n" : "") +
      '<section class="sec sec--sand sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">다른 업종 보기<span class="dot">.</span></h2><a class="tlink" href="/industries/">업종별 인테리어 전체<span aria-hidden="true">→</span></a></div>\n    <div class="ilinks">' +
      others.map(function (x) { return '<a href="/industries/' + x.slug + '" class="ilink"><span>' + x.name + '</span><span aria-hidden="true">→</span></a>'; }).join("") + "</div>\n  </div>\n</section>\n" +
      ctaBlock((meta.short || "공간") + " 자리를 보고 계신다면", "후보 자리의 주소나 현장 사진만 있어도 업종에 맞는 조건인지 먼저 검토해 드립니다. 상담과 방향 제안까지는 비용이 들지 않습니다.") +
      "\n</main>\n<!--@footer-->\n" + footer() + "\n<!--/@footer-->\n" + tail();
  }
  function renderIndustriesIndex(list, ctx) {
    var items = INDUSTRIES.map(function (x) {
      var d = (list || []).filter(function (y) { return y.slug === x.slug; })[0] || {};
      return '<a class="icard rv" href="/industries/' + x.slug + '"><figure class="icard__fig"><img src="' + x.img + '" alt="' + attr(d.heroAlt || x.name) + '" loading="lazy" decoding="async"></figure>' +
        '<span class="icard__k">' + esc(d.keyword || x.short) + '</span><strong class="icard__t">' + x.name + '</strong><span class="icard__d">' + esc(d.lead ? d.lead.split(".")[0] + "." : d.description || "") + "</span></a>";
    }).join("");
    var ld = [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: "업종별 인테리어 — 코어무드", url: SITE.url + "/industries/", hasPart: INDUSTRIES.map(function (x) { return { "@type": "WebPage", name: x.name + " 인테리어", url: SITE.url + "/industries/" + x.slug }; }) },
      crumbLd([["홈", "/"], ["업종별 인테리어", "/industries/"]])
    ];
    return headTag({ title: "업종별 상업공간 인테리어 — 카페 · 음식점 · 미용실 · 파티룸 · 숙박 · 오피스 | 코어무드", description: "카페, 음식점, 바, 미용실, 파티룸, 스터디카페, 숙박, 오피스, 쇼룸, 스튜디오까지. 업종마다 다른 동선과 설비, 브랜딩 포인트를 코어무드가 정리했습니다.", path: "/industries/", ld: ld }) +
      '<body data-page="industries" class="has-mobcta">\n<!--@header-->\n' + header("industries") + "\n<!--/@header-->\n<main id=\"main\">\n" +
      '<section class="phero">\n  <div class="wrap">\n    ' + crumbs([["홈", "/"], ["업종별 인테리어", "/industries/"]]) + '\n    <span class="phero__en">Industries</span>\n' +
      '    <h1 class="d1">업종이 다르면<br>먼저 봐야 할 것도 다릅니다<span class="dot">.</span></h1>\n' +
      '    <p class="lead phero__d">카페는 주문과 픽업의 흐름이, 미용실은 샴푸대 배관이, 숙박은 객실 회전과 방음이 먼저입니다. 코어무드가 10여 년간 340개 이상 프로젝트를 진행하며 업종별로 정리해 온 기준을 공개합니다.</p>\n' +
      "  </div>\n</section>\n" +
      '<section class="sec sec--tight">\n  <div class="wrap">\n    <div class="igrid">' + items + "</div>\n  </div>\n</section>\n" +
      '<section class="sec sec--sand sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">업종과 상관없이 같은 것<span class="dot">.</span></h2></div>\n' +
      '    <div class="pillars"><article class="pillar"><span class="pillar__n">01</span><h3 class="h3">한 문장 컨셉</h3><p>도면보다 먼저, 이 공간을 설명할 한 문장을 정합니다. 업종이 무엇이든 이 문장이 조명과 마감과 간판의 판단 기준이 됩니다.</p></article>' +
      '<article class="pillar"><span class="pillar__n">02</span><h3 class="h3">운영을 전제로 한 평면</h3><p>예쁜 평면보다 직원이 덜 걷는 평면을 먼저 그립니다. 하루 운영을 시간대별로 따라가며 동선이 엉키는 지점을 찾습니다.</p></article>' +
      '<article class="pillar"><span class="pillar__n">03</span><h3 class="h3">오픈 이후까지</h3><p>사진이 잘 나오는 자리, 네이버 플레이스 등록, 오픈 콘텐츠까지 함께 준비합니다. 공간은 알려져야 쓰이기 때문입니다.</p></article></div>\n' +
      "  </div>\n</section>\n" + ctaBlock() + "\n</main>\n<!--@footer-->\n" + footer() + "\n<!--/@footer-->\n" + tail();
  }

  /* ---------- generic page (faq 등) ---------- */
  function renderPage(page, body, ctx) {
    var r = md(body);
    var path = "/" + page.slug;
    var ld = [crumbLd([["홈", "/"], [page.title, path]])];
    if (r.faq.length) ld.push(faqLd(r.faq));
    var tocHtml = r.toc.length > 2 ? '<nav class="jtoc" aria-label="목차"><span class="jtoc__t">Contents</span><ol>' + r.toc.map(function (t) { return '<li><a href="#' + t.id + '">' + esc(t.text) + "</a></li>"; }).join("") + "</ol></nav>" : "";
    return headTag({ title: page.seoTitle || page.title + " | 코어무드", description: page.description, path: path, ld: ld }) +
      '<body data-page="' + page.slug + '" class="has-mobcta">\n<!--@header-->\n' + header(page.slug) + "\n<!--/@header-->\n<main id=\"main\">\n" +
      '<section class="phero">\n  <div class="wrap">\n    ' + crumbs([["홈", "/"], [page.title, path]]) + '\n    <span class="phero__en">' + esc(page.en || "") + "</span>\n" +
      '    <h1 class="d1">' + dot(page.h1 || page.title) + "</h1>\n" +
      '    <p class="lead phero__d">' + esc(page.lead || page.description) + "</p>\n  </div>\n</section>\n" +
      '<section class="sec sec--tight">\n<div class="wrap jbody">\n  <aside class="jside">' + tocHtml + "</aside>\n  <div class=\"prose\">\n" + r.html + "\n  </div>\n</div>\n</section>\n" +
      (page.slug === "faq" ? '<section class="sec sec--sand sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">더 찾아보기<span class="dot">.</span></h2></div>\n    <div class="ilinks"><a href="/glossary" class="ilink"><span>인테리어 · 브랜딩 용어 사전</span><span aria-hidden="true">→</span></a><a href="/search" class="ilink"><span>글 · 사례 통합 검색</span><span aria-hidden="true">→</span></a><a href="/estimate" class="ilink"><span>개략 공사비 계산</span><span aria-hidden="true">→</span></a><a href="/process" class="ilink"><span>진행 절차 8단계</span><span aria-hidden="true">→</span></a></div>\n  </div>\n</section>\n' : "") +
      ctaBlock("답을 찾지 못하셨다면", "공간 사진이나 후보 자리 주소와 함께 질문을 남겨 주세요. 담당자가 직접 확인하고 답을 드립니다. 상담과 방향 제안까지는 비용이 들지 않습니다.") +
      "\n</main>\n<!--@footer-->\n" + footer() + "\n<!--/@footer-->\n" + tail();
  }

  /* ---------- sitemap / feed / json ---------- */
  var STATIC_PAGES = [
    ["/", "1.0", "weekly"], ["/about", "0.8", "monthly"], ["/services", "0.9", "monthly"], ["/industries/", "0.9", "weekly"],
    ["/portfolio", "0.9", "monthly"], ["/process", "0.8", "monthly"], ["/estimate", "0.8", "monthly"], ["/faq", "0.7", "monthly"],
    ["/glossary", "0.6", "monthly"], ["/contact", "0.8", "monthly"], ["/join", "0.4", "monthly"], ["/journal/", "0.9", "daily"]
  ];
  function xmlEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  // 페이지별 수정일: data/lastmod.json (내용이 실제로 바뀐 날만 갱신) → 없으면 fallback
  function lastmodOf(path, fallback) {
    var m = DATA.lastmod && DATA.lastmod[path];
    return (m && (typeof m === "string" ? m : m.d)) || fallback;
  }
  function renderSitemap(ctx) {
    var today = isoDate(new Date(ctx.now || Date.now()));
    var posts = sortPosts(ctx.posts || []);
    var pd = function (p) { return isoDate(p.updated || p.date); };
    var newest = function (list) { return list.reduce(function (m, p) { var d = pd(p); return d > m ? d : m; }, ""); };
    var lastPost = newest(posts) || today;
    var later = function (a, b) { return a > b ? a : b; };
    var u = function (loc, lastmod, freq, pri, imgs) {
      var seen = {};
      var im = (imgs || []).filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; })
        .map(function (x) { return "<image:image><image:loc>" + xmlEsc(abs(x)) + "</image:loc></image:image>"; }).join("");
      return "  <url><loc>" + abs(loc) + "</loc><lastmod>" + lastmod + "</lastmod><changefreq>" + freq + "</changefreq><priority>" + pri + "</priority>" + im + "</url>";
    };
    var inds = DATA.industries || [];
    var rows = STATIC_PAGES.filter(function (s) { return s[0] !== "/glossary" || glossaryGroups(ctx).length; }).map(function (s) {
      var path = s[0], fb = ctx.staticLastmod || today;
      var d = path === "/journal/" ? lastPost : path === "/" ? later(lastPost, lastmodOf(path, "")) : lastmodOf(path, fb);
      var imgs = path === "/portfolio" ? archiveItems(ctx).map(function (x) { return x.photos[0].src; }) : path === "/" ? [SITE.ogDefault] : [];
      return u(path, d, s[2], s[1], imgs);
    });
    INDUSTRIES.forEach(function (x) {
      var d = inds.filter(function (y) { return y.slug === x.slug; })[0] || {};
      rows.push(u("/industries/" + x.slug, lastmodOf("/industries/" + x.slug, ctx.industryLastmod || today), "monthly", "0.8", [d.hero || x.img]));
    });
    CAT_ORDER.forEach(function (k) { rows.push(u("/journal/category/" + k, newest(posts.filter(function (p) { return p.category === k; })) || lastPost, "weekly", "0.6")); });
    liveTopics(ctx).forEach(function (o) { rows.push(u(topicUrl(o.t), newest(topicPosts(o.t, posts)) || lastPost, "weekly", "0.6")); });
    posts.forEach(function (p) { rows.push(u(postUrl(p), pd(p), "monthly", "0.7", [p.cover])); });
    liveCases(ctx).forEach(function (c) {
      rows.push(u(caseUrl(c), c.updated ? isoDate(c.updated) : lastmodOf(caseUrl(c), isoDate(ctx.casesLastmod || (ctx.now || Date.now()))), "monthly", "0.7",
        [c.after, c.before].concat((c.gallery || []).map(function (g) { return g.src; })).slice(0, 20)));
    });
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + rows.join("\n") + "\n</urlset>\n";
  }
  // RSS: 최근 글은 본문 전체를 담습니다 (네이버 서치어드바이저·RSS 리더·AI 수집용)
  var FEED_FULL = 20;
  function feedHtml(p, body) {
    var h = md(body, { feed: true }).html
      .replace(/(href|src)="\/(?!\/)/g, '$1="' + SITE.url + "/")
      .replace(/ (loading|decoding|fetchpriority)="[^"]*"/g, "").replace(/ class="[^"]*"/g, "").replace(/\]\]>/g, "]]&gt;");
    return '<p><img src="' + abs(p.cover) + '" alt="' + attr(p.coverAlt) + '"></p>\n' + h +
      '\n<p>원문: <a href="' + abs(postUrl(p)) + '">' + esc(p.title) + "</a> · 코어무드 저널</p>";
  }
  // 이미 발행된 feed.xml 에서 글별 본문을 꺼내 둡니다 (관리자 화면처럼 본문 전체가 없는 곳에서 재사용)
  function feedCache(xml) {
    var out = {};
    String(xml || "").split("<item>").slice(1).forEach(function (chunk) {
      var l = /<link>([^<]+)<\/link>/.exec(chunk), c = /<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/.exec(chunk);
      if (l && c) out[l[1]] = c[1];
    });
    return out;
  }
  function renderFeed(ctx) {
    var posts = sortPosts(ctx.posts || []).slice(0, 50);
    var bodies = DATA.bodies || {}, cache = DATA.feedCache || {};
    var items = posts.map(function (p, k) {
      var full = k < FEED_FULL ? (bodies[p.slug] ? feedHtml(p, bodies[p.slug]) : cache[abs(postUrl(p))] || "") : "";
      return "    <item>\n      <title>" + xmlEsc(p.title) + "</title>\n      <link>" + abs(postUrl(p)) + "</link>\n      <guid isPermaLink=\"true\">" + abs(postUrl(p)) + "</guid>\n" +
        "      <description>" + xmlEsc(p.description) + "</description>\n" +
        (full ? "      <content:encoded><![CDATA[" + full + "]]></content:encoded>\n" : "") +
        "      <dc:creator>코어무드 스튜디오</dc:creator>\n      <category>" + xmlEsc((CATS[p.category] || {}).name || "") + "</category>\n" +
        (p.tags || []).map(function (t) { return "      <category>" + xmlEsc(t) + "</category>\n"; }).join("") +
        "      <pubDate>" + new Date(p.date).toUTCString() + "</pubDate>\n    </item>";
    }).join("\n");
    var last = posts.reduce(function (m, p) { var t = new Date(p.updated || p.date).getTime(); return t > m ? t : m; }, 0) || (ctx.now || Date.now());
    return '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">\n  <channel>\n' +
      "    <title>코어무드 저널</title>\n    <link>" + SITE.url + "/journal/</link>\n" +
      "    <description>상업공간 브랜딩, 인테리어, 마케팅, 창업에 대한 코어무드의 실무 노트</description>\n    <language>ko</language>\n" +
      "    <copyright>© " + SITE.full + "</copyright>\n" +
      "    <image><url>" + abs(SITE.ogDefault) + "</url><title>코어무드 저널</title><link>" + SITE.url + "/journal/</link></image>\n" +
      '    <atom:link href="' + SITE.url + '/feed.xml" rel="self" type="application/rss+xml"/>\n' +
      "    <lastBuildDate>" + new Date(last).toUTCString() + "</lastBuildDate>\n" + items + "\n  </channel>\n</rss>\n";
  }

  /* ---------- robots.txt / llms.txt (검색 엔진과 AI 검색 서비스 안내) ---------- */
  var CRAWL_BLOCK = ["/admin/", "/api/", "/content/", "/scripts/", "/functions/", "/cdn-cgi/"];
  var CRAWLERS = [
    "Googlebot", "Googlebot-Image", "Google-Extended", "Yeti", "Bingbot", "Daum", "Daumoa", "DuckDuckBot", "Applebot", "Applebot-Extended",
    "GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "Amazonbot", "CCBot"
  ];
  function renderRobots() {
    var rules = "Allow: /\n" + CRAWL_BLOCK.map(function (p) { return "Disallow: " + p; }).join("\n") + "\n";
    return "# 코어무드 CORE MOOD — " + SITE.url + "\n# 이 파일은 scripts/build.js 가 만듭니다. 직접 고치지 말고 assets/js/cm-render.js 의 renderRobots 를 고쳐 주세요.\n" +
      "# 검색 엔진과 AI 검색 서비스의 수집을 모두 허용하고, 관리자 화면과 원본 폴더만 제외합니다.\n\n" +
      "User-agent: *\n" + rules + "\n" +
      "# 네이버, 구글, 빙, 다음과 AI 검색 서비스(ChatGPT, Perplexity, Claude, Gemini 등)\n" +
      CRAWLERS.map(function (c) { return "User-agent: " + c; }).join("\n") + "\n" + rules + "\n" +
      "Sitemap: " + SITE.url + "/sitemap.xml\n";
  }
  function processSteps(html) {
    var out = [], re = /<div class="flow__i[^"]*"[^>]*>[\s\S]*?<h3 class="h3">([\s\S]*?)<\/h3>[\s\S]*?<div class="flow__d">([\s\S]*?)<div class="flow__tags">[\s\S]*?<strong>([\s\S]*?)<\/strong>/g, m;
    while ((m = re.exec(html || ""))) out.push({ name: htmlText(m[1]), text: htmlText(m[2]), time: htmlText(m[3]).replace(/^소요 기간\s*·\s*/, "") });
    return out;
  }
  function llmsHead() {
    return "# " + SITE.full + "\n\n" +
      "> 코어무드는 공간 컨셉과 무드 기획, 브랜드 개발, 상업공간 인테리어 설계·시공, 가구 스타일링, 콘텐츠와 마케팅을 하나의 흐름으로 진행하는 공간 비즈니스 스튜디오입니다. 서울 강남에 스튜디오가 있으며 " + SITE.record + "를 진행했습니다.\n\n" +
      "이 문서는 검색 엔진과 AI 서비스가 코어무드 홈페이지(" + SITE.url + ")의 내용을 정확하게 파악하도록 정리한 안내문입니다. 여기에 적힌 금액과 기간은 홈페이지에 공개한 개략 기준이며, 실제 견적은 현장 실측 후 항목별 견적서로 확정합니다. 인허가와 소방, 전기 용량은 현장마다 조건이 달라 별도 확인이 필요합니다.\n\n" +
      "## 기본 정보\n\n" +
      "- 브랜드: 코어무드 (CORE MOOD) · " + SITE.slogan + "\n" +
      "- 상호: " + SITE.corp + " · 대표 " + SITE.ceo + "\n" +
      "- 하는 일: " + SERVICES.map(function (x) { return x[0]; }).join(", ") + "\n" +
      "- 주요 업종: " + INDUSTRIES.map(function (x) { return x.name; }).join(", ") + "\n" +
      "- 실적: " + SITE.record + "\n" +
      "- 스튜디오: " + SITE.address + "\n" +
      "- 전화: " + SITE.tel + " · 메일: " + SITE.email + "\n" +
      "- 상담 시간: " + SITE.hours + "\n" +
      "- 진행 지역: 서울과 수도권 중심. 그 밖의 지역은 상담 단계에서 진행 조건을 먼저 협의합니다.\n" +
      "- 상담 신청: " + SITE.url + "/contact (상담과 방향 제안까지는 비용이 들지 않습니다)\n\n";
  }
  function llmsCost() {
    return "## 비용 기준\n\n" +
      "- 개략 공사비는 면적(평)에 평당 기준 금액을 곱해 범위로 봅니다. 평당 기준은 마감 사양에 따라 " + EST_GRADES.map(function (g) { return g[0] + " " + g[1] + "만 원"; }).join(", ") + "이며 업종에 따라 가감합니다.\n" +
      "- 부가가치세, 가구와 집기, 인허가 비용은 포함되지 않은 금액입니다. 전기 용량, 배기, 화장실, 천장고, 건물 규정, 기존 시설 상태에 따라 달라집니다.\n" +
      "- 정확한 금액은 현장 실측 뒤 항목별 견적서로 드립니다. 인허가와 소방, 전기 증설은 관할 관청과 전문 업체의 절차가 필요해 별도 확인으로 안내합니다.\n" +
      "- [개략 공사비 계산기](" + SITE.url + "/estimate): 업종과 면적, 마감 사양을 고르면 금액 범위를 바로 볼 수 있습니다.\n\n";
  }
  function llmsProcess(full) {
    var st = DATA.process || [];
    if (!st.length) return "";
    return "## 진행 절차\n\n" + st.map(function (x, k) { return (k + 1) + ". " + x.name + (x.time ? " (" + x.time + ")" : "") + (full ? ": " + x.text : ""); }).join("\n") +
      "\n\n문의부터 오픈까지 전체 기간은 대체로 3~5개월입니다. 자세한 내용은 [진행 절차](" + SITE.url + "/process)에서 볼 수 있습니다.\n\n";
  }
  function llmsLink(name, path, d) { return "- [" + name + "](" + abs(path) + ")" + (d ? ": " + d : ""); }
  function renderLlms(ctx) {
    var posts = sortPosts(ctx.posts || []), pg = DATA.pages || {}, st = archiveStats(ctx);
    var out = llmsHead();
    out += "## 주요 페이지\n\n" + ["about", "services", "portfolio", "process", "estimate", "contact"].filter(function (k) { return pg[k]; }).map(function (k) { return llmsLink(pg[k].name, pg[k].path, pg[k].description); }).join("\n") +
      "\n" + llmsLink("자주 묻는 질문", "/faq", "상담, 견적과 비용, 설계와 브랜딩, 시공과 일정, 계약과 대금, 사후관리에 대한 문답 " + (DATA.faq || []).length + "개") +
      "\n" + llmsLink("용어 사전", "/glossary", "상가 인테리어 견적서와 도면, 임대차 계약에서 자주 쓰는 용어 풀이") + "\n\n";
    out += "## 서비스\n\n" + SERVICES.map(function (x) { return llmsLink(x[0], "/services#" + x[2], x[1]); }).join("\n") +
      "\n" + llmsLink("가구 스타일링과 톤앤매너", "/services#styling", "공사가 끝난 뒤 가구와 조명 기구, 패브릭, 소품으로 공간의 분위기를 완성합니다.") + "\n\n";
    out += "## 업종별 인테리어 기준\n\n" + (DATA.industries || []).map(function (x) { return llmsLink(x.title, "/industries/" + x.slug, x.description); }).join("\n") + "\n\n";
    out += llmsCost() + llmsProcess(false);
    var cs = liveCases(ctx);
    if (cs.length) out += "## 시공 사례\n\n" + cs.map(function (c) { return llmsLink(c.title + " 인테리어 (" + c.biz + " · " + c.region + ")", caseUrl(c), c.summary); }).join("\n") + "\n" +
      (st.refs ? llmsLink("톤앤매너 아카이브", "/portfolio#archive", "기획부터 가구 스타일링까지 직접 완성한 공간을 톤앤매너별로 정리한 레퍼런스 " + st.refs + "건, 사진 " + st.photos + "장") + "\n" : "") + "\n";
    var tp = liveTopics(ctx);
    if (tp.length) out += "## 주제별 글 모음\n\n" + tp.map(function (o) { return llmsLink(o.t.title + " (" + o.n + "편)", topicUrl(o.t), o.t.desc); }).join("\n") + "\n\n";
    out += "## 저널 최근 글\n\n" + posts.slice(0, 30).map(function (p) { return llmsLink(p.title, postUrl(p), p.description); }).join("\n") + "\n\n";
    out += "## Optional\n\n" + llmsLink("전체 내용 (llms-full.txt)", "/llms-full.txt", "자주 묻는 질문 전문, 용어 풀이, 저널 글 전체 목록과 핵심 요약") + "\n" +
      llmsLink("저널 전체 글", "/journal/", "브랜딩, 인테리어, 마케팅, 창업, 공간 비즈니스 글 " + posts.length + "편") + "\n" +
      llmsLink("RSS", "/feed.xml") + "\n" + llmsLink("사이트맵", "/sitemap.xml") + "\n";
    return out;
  }
  function renderLlmsFull(ctx) {
    var posts = sortPosts(ctx.posts || []), dg = DATA.digest || {}, st = archiveStats(ctx);
    var out = llmsHead();
    out += "## 서비스\n\n" + SERVICES.map(function (x) { return "- " + x[0] + ": " + x[1]; }).join("\n") + "\n\n";
    out += llmsCost() + llmsProcess(true);
    out += "## 업종별 인테리어 기준\n\n" + (DATA.industries || []).map(function (x) {
      return "### " + x.title + "\n\n" + abs("/industries/" + x.slug) + "\n\n" + (x.lead || x.description) + "\n";
    }).join("\n") + "\n";
    var cs = liveCases(ctx);
    if (cs.length) out += "## 시공 사례\n\n" + cs.map(function (c) {
      return "### " + c.title + " 인테리어\n\n" + abs(caseUrl(c)) + "\n\n- 업종과 지역: " + c.biz + " · " + c.region + "\n- 공정 범위: " + scopeText(c) + "\n- 요약: " + c.summary + "\n";
    }).join("\n") + "\n";
    if (st.refs) out += "## 톤앤매너 아카이브\n\n" + abs("/portfolio#archive") + "\n\n기획부터 가구 스타일링까지 직접 완성한 공간을 톤앤매너별로 정리한 레퍼런스 " + st.refs + "건입니다. 계열은 " + archiveFams(ctx).map(function (f) { return f.name; }).join(", ") + "로 나눕니다.\n\n";
    var faq = DATA.faq || [];
    if (faq.length) out += "## 자주 묻는 질문\n\n" + abs("/faq") + "\n\n" + faq.map(function (f) { return "### " + f.q + "\n\n" + f.a + "\n"; }).join("\n") + "\n";
    var gg = glossaryGroups(ctx);
    if (gg.length) out += "## 용어 사전\n\n" + abs("/glossary") + "\n\n" + gg.map(function (g) {
      return "### " + g.name + "\n\n" + (g.terms || []).map(function (t) { return "- " + t.term + ((t.also || []).length ? " (" + t.also.join(", ") + ")" : "") + ": " + t.def; }).join("\n") + "\n";
    }).join("\n") + "\n";
    out += "## 저널 글 전체\n\n" + posts.map(function (p) {
      var g = dg[p.slug] || {};
      return "### " + p.title + "\n\n" + abs(postUrl(p)) + "\n\n- 분류: " + ((CATS[p.category] || {}).name || "") + " · 발행 " + isoDate(p.date) + (p.updated && isoDate(p.updated) !== isoDate(p.date) ? " · 수정 " + isoDate(p.updated) : "") + "\n- 소개: " + p.description + "\n" +
        ((g.summary || []).length ? "- 핵심 요약:\n" + g.summary.map(function (x) { return "  - " + x; }).join("\n") + "\n" : "") +
        ((g.toc || []).length ? "- 다루는 내용: " + g.toc.join(" / ") + "\n" : "") +
        ((g.faq || []).length ? g.faq.map(function (f) { return "- Q. " + f.q + "\n  A. " + f.a; }).join("\n") + "\n" : "");
    }).join("\n");
    return out;
  }
  function postsJson(ctx) {
    return JSON.stringify({
      updated: new Date(ctx.now || Date.now()).toISOString(),
      posts: sortPosts(ctx.posts || []).map(function (p) {
        return { slug: p.slug, title: p.title, date: p.date, category: p.category, tags: p.tags, keyword: p.keyword, description: p.description, cover: p.cover, coverAlt: p.coverAlt, minutes: p.minutes };
      })
    });
  }

  /* ---------- hand-written pages: head + partials ---------- */
  function htmlText(s) { return String(s).replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim(); }
  function extractFaq(html) {
    var out = [], re = /<button class="acc__q"[^>]*>([\s\S]*?)<\/button>\s*<div class="acc__a">([\s\S]*?)<\/div>\s*<\/div>/g, m;
    while ((m = re.exec(html))) out.push({ q: htmlText(m[1]), a: htmlText(m[2]) });
    return out;
  }
  function staticHead(key, meta, html, ctx) {
    var ld = [];
    var country = { "@type": "Country", name: "대한민국" };
    var page = function (type) {
      return { "@context": "https://schema.org", "@type": type, "@id": abs(meta.path) + "#page", url: abs(meta.path), name: meta.title, description: meta.description, inLanguage: "ko-KR",
        isPartOf: { "@id": SITE.url + "/#site" }, mainEntity: { "@id": SITE.url + "/#org" } };
    };
    if (key === "index") ld = [orgLd(), siteLd()];
    else if (!meta.noindex) {
      ld = [crumbLd([["홈", "/"], [meta.name, meta.path]])];
      if (key === "about") ld.push(page("AboutPage"), orgLd());
      else if (key === "contact") ld.push(page("ContactPage"), orgLd());
      else if (key === "services") {
        ld.push({ "@context": "https://schema.org", "@type": "ItemList", name: "코어무드 서비스", numberOfItems: SERVICES.length,
          itemListElement: SERVICES.map(function (x, k) { return { "@type": "ListItem", position: k + 1, item: { "@type": "Service", "@id": SITE.url + "/services#" + x[2], name: x[0], description: x[1], url: SITE.url + "/services#" + x[2], provider: orgRef(), areaServed: country } }; }) });
      } else if (key === "process") {
        var st = processSteps(html);
        if (st.length) ld.push({ "@context": "https://schema.org", "@type": "HowTo", name: "상업공간 인테리어 진행 절차 " + st.length + "단계", description: meta.description, inLanguage: "ko-KR",
          step: st.map(function (x, k) { return { "@type": "HowToStep", position: k + 1, name: x.name, text: x.text + (x.time ? " 소요 기간은 " + x.time + "입니다." : ""), url: abs(meta.path) + "#step-" + (k + 1) }; }) });
      } else if (key === "estimate") {
        ld.push({ "@context": "https://schema.org", "@type": "Service", name: "상업공간 인테리어 설계 · 시공", serviceType: "상업공간 인테리어", url: abs(meta.path), provider: orgRef(), areaServed: country,
          offers: { "@type": "Offer", priceCurrency: "KRW", url: abs(meta.path),
            priceSpecification: { "@type": "UnitPriceSpecification", priceCurrency: "KRW", minPrice: EST_GRADES[0][1] * 10000, maxPrice: EST_GRADES[EST_GRADES.length - 1][1] * 10000, unitText: "평", valueAddedTaxIncluded: false },
            description: "마감 사양 " + EST_GRADES.length + "단계의 평당 기준 금액(" + EST_GRADES[0][0] + " " + EST_GRADES[0][1] + "만 원 ~ " + EST_GRADES[EST_GRADES.length - 1][0] + " " + EST_GRADES[EST_GRADES.length - 1][1] + "만 원)이며 업종에 따라 가감합니다. 부가가치세, 가구·집기, 인허가 비용은 별도이고 현장 실측 후 항목별 견적서로 확정합니다." } });
      } else if (key === "portfolio") {
        var cs = liveCases(ctx);
        ld.push({ "@context": "https://schema.org", "@type": "CollectionPage", name: meta.title, description: meta.description, url: abs(meta.path), inLanguage: "ko-KR", isPartOf: { "@id": SITE.url + "/#site" }, about: { "@id": SITE.url + "/#org" } });
        if (cs.length) ld.push(itemListLd("코어무드 시공 사례", cs.map(function (c) { return [c.title + " 인테리어", caseUrl(c)]; })));
      }
      var faq = extractFaq(html || "");
      if (faq.length) ld.push(faqLd(faq));
    }
    return headTag({ title: meta.title, description: meta.description, path: meta.path, image: meta.image, keywords: meta.keywords, noindex: meta.noindex, verify: key === "index", ld: ld });
  }
  function latestBlock(posts) {
    var list = sortPosts(posts || []).slice(0, 3);
    if (!list.length) return "";
    return '<section class="sec sec--sand">\n  <div class="wrap">\n    <div class="shead rv">\n  <span class="shead__idx">09</span>\n  <div class="shead__body">\n    <span class="shead__en">Journal</span>\n' +
      '    <h2 class="h2 shead__t">매일 아침, 현장의 기준을<br>한 편씩 정리합니다<span class="dot">.</span></h2>\n' +
      '    <p class="lead shead__d">브랜딩, 인테리어, 마케팅, 창업. 견적서를 받기 전과 계약서에 도장을 찍기 전에 읽어 두시면 좋은 글들입니다.</p>\n  </div>\n</div>\n' +
      '    <div class="jgrid">' + list.map(function (p) { return card(p); }).join("") + "</div>\n" +
      (topicChips({ posts: posts }) ? '    <div class="tchips tchips--home"><span class="label">주제별 글 모음</span>' + topicChips({ posts: posts }) + "</div>\n" : "") +
      '    <div class="btns" style="margin-top:2.6em;gap:1.8em"><a href="/journal/" class="tlink">저널 전체 보기<span aria-hidden="true">→</span></a><a href="/faq" class="tlink">자주 묻는 질문<span aria-hidden="true">→</span></a><a href="/glossary" class="tlink">용어 사전<span aria-hidden="true">→</span></a></div>\n  </div>\n</section>';
  }
  function industriesBlock() {
    return '<section class="sec">\n  <div class="wrap">\n    <div class="shead rv">\n  <span class="shead__idx">08</span>\n  <div class="shead__body">\n    <span class="shead__en">Industries</span>\n' +
      '    <h2 class="h2 shead__t">업종마다 먼저 봐야 할 것이<br>따로 있습니다<span class="dot">.</span></h2>\n' +
      '    <p class="lead shead__d">카페는 주문과 픽업의 흐름이, 미용실은 샴푸대 배관이, 숙박은 객실 회전과 방음이 먼저입니다. 업종별로 정리한 설계 기준과 비용 구조를 확인해 보세요.</p>\n  </div>\n</div>\n' +
      '    <div class="ilinks ilinks--home">' + INDUSTRIES.map(function (x) {
        return '<a href="/industries/' + x.slug + '" class="ilink"><span>' + x.name + ' 인테리어</span><span aria-hidden="true">→</span></a>';
      }).join("") + "</div>\n" +
      '    <div style="margin-top:2.6em"><a href="/industries/" class="tlink">업종별 인테리어 전체 보기<span aria-hidden="true">→</span></a></div>\n  </div>\n</section>';
  }
  function injectPartials(html, cur, ctx) {
    ctx = ctx || {};
    html = html
      .replace(/<!--@header-->[\s\S]*?<!--\/@header-->/, "<!--@header-->\n" + header(cur) + "\n<!--/@header-->")
      .replace(/<!--@footer-->[\s\S]*?<!--\/@footer-->/, "<!--@footer-->\n" + footer() + "\n<!--/@footer-->")
      .replace(/<!--@industries-->[\s\S]*?<!--\/@industries-->/, "<!--@industries-->\n" + industriesBlock() + "\n<!--/@industries-->");
    if (ctx.posts) html = html.replace(/<!--@latest-->[\s\S]*?<!--\/@latest-->/, "<!--@latest-->\n" + latestBlock(ctx.posts) + "\n<!--/@latest-->");
    if (ctx.cases) {
      html = html.replace(/<!--@ba-->[\s\S]*?<!--\/@ba-->/, "<!--@ba-->\n" + baSlider(ctx) + "\n<!--/@ba-->")
        .replace(/<!--@cases-->[\s\S]*?<!--\/@cases-->/, "<!--@cases-->\n" + casesBlock(ctx) + "\n<!--/@cases-->");
    }
    if (ctx.archive || DATA.archive) {
      html = html.replace(/<!--@archive-->[\s\S]*?<!--\/@archive-->/, function () { return "<!--@archive-->\n" + archiveBlock(ctx) + "\n<!--/@archive-->"; })
        .replace(/<!--@archive-home-->[\s\S]*?<!--\/@archive-home-->/, function () { return "<!--@archive-home-->\n" + archiveHome(ctx) + "\n<!--/@archive-home-->"; });
    }
    if (ctx.pageMeta) html = html.replace(/^[\s\S]*?<\/head>\n?/, function () { return staticHead(cur, ctx.pageMeta, html, ctx); });
    html = html.replace(/src="\/assets\/js\/main\.js(\?v=[^"]*)?"/, 'src="/assets/js/main.js?v=' + ASSET_V + '"');
    return html;
  }

  var CM = {
    SITE: SITE, ASSET_V: ASSET_V, CATS: CATS, CAT_ORDER: CAT_ORDER, INDUSTRIES: INDUSTRIES, BA: BA, NAV: NAV, POST_KEYS: POST_KEYS, IND_KEYS: IND_KEYS, STATIC_PAGES: STATIC_PAGES,
    esc: esc, parseFront: parseFront, stringifyFront: stringifyFront, md: md, plain: plain, textLength: textLength, readMinutes: readMinutes,
    postMeta: postMeta, isLive: isLive, sortPosts: sortPosts, postUrl: postUrl, related: related, fmtDate: fmtDate, isoDate: isoDate,
    header: header, footer: footer, headTag: headTag, card: card,
    renderPost: renderPost, renderJournalIndex: renderJournalIndex, renderCategory: renderCategory,
    renderIndustry: renderIndustry, renderIndustriesIndex: renderIndustriesIndex, renderPage: renderPage,
    renderSitemap: renderSitemap, renderFeed: renderFeed, postsJson: postsJson, injectPartials: injectPartials,
    staticHead: staticHead, setVerify: setVerify, renderCase: renderCase, caseUrl: caseUrl, liveCases: liveCases, baSlider: baSlider, casesBlock: casesBlock, verifyMeta: verifyMeta, latestBlock: latestBlock, archiveBlock: archiveBlock, archiveHome: archiveHome, archiveStats: archiveStats, industriesBlock: industriesBlock, extractFaq: extractFaq, orgLd: orgLd,
    // 검색·AI 대응 (주제 허브, 용어 사전, 사이트 검색, llms.txt, robots.txt)
    SERVICES: SERVICES, EST_GRADES: EST_GRADES, CHANNEL_KEYS: CHANNEL_KEYS, CRAWLERS: CRAWLERS, TOPIC_MIN: TOPIC_MIN, setData: setData, getData: function () { return DATA; }, digest: digest, siteLd: siteLd,
    topicList: topicList, liveTopics: liveTopics, topicPosts: topicPosts, topicUrl: topicUrl, inTopic: inTopic, tokensOf: tokensOf, renderTopic: renderTopic,
    renderGlossary: renderGlossary, renderSearchPage: renderSearchPage, searchIndex: searchIndex, renderRobots: renderRobots, renderLlms: renderLlms, renderLlmsFull: renderLlmsFull,
    processSteps: processSteps, feedCache: feedCache, htmlText: htmlText
  };
  if (typeof module !== "undefined" && module.exports) module.exports = CM;
  else root.CMRender = CM;
})(typeof window !== "undefined" ? window : this);
