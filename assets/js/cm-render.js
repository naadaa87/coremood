/* ==========================================================================
   CORE MOOD — content renderer
   브라우저(관리자 페이지)와 Node(빌드 스크립트)에서 같은 코드로 페이지를 만듭니다.
   ========================================================================== */
(function (root) {
  "use strict";

  /* ---------- site constants ---------- */
  var ASSET_V = "20261026"; // CSS·JS 를 고치면 이 값을 바꿔 브라우저 캐시를 갱신합니다
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
    var out = [], toc = [], faq = [], h2n = 0, i = 0;

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
        qs.forEach(function (x) {
          var ans = md(x.a.join("\n"));
          faq.push({ q: x.q, a: plain(x.a.join(" ")) });
          h += '<div class="acc__i"><button class="acc__q" type="button" aria-expanded="false">' + inline(x.q) +
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
        out.push('<figure class="jfig"><img src="' + attr(m[2]) + '" alt="' + attr(m[1]) + '" loading="lazy" decoding="async">' +
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
    return { html: out.join("\n"), toc: toc, faq: faq };
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
      (o.noindex ? '<meta name="robots" content="noindex,follow">\n' : '<meta name="robots" content="index,follow,max-image-preview:large">\n') +
      '<meta name="theme-color" content="#F6F3EE">\n' +
      '<link rel="canonical" href="' + url + '">\n' +
      '<meta property="og:type" content="' + (o.type || "website") + '">\n' +
      '<meta property="og:site_name" content="' + SITE.full + '">\n' +
      '<meta property="og:locale" content="ko_KR">\n' +
      '<meta property="og:title" content="' + attr(o.ogTitle || o.title) + '">\n' +
      '<meta property="og:description" content="' + attr(o.description) + '">\n' +
      '<meta property="og:url" content="' + url + '">\n' +
      '<meta property="og:image" content="' + img + '">\n' +
      (o.published ? '<meta property="article:published_time" content="' + attr(o.published) + '">\n' : "") +
      (o.modified ? '<meta property="article:modified_time" content="' + attr(o.modified) + '">\n' : "") +
      '<meta name="twitter:card" content="summary_large_image">\n' +
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
    var mnav = [["index", "/", "홈", "Home"]].concat(NAV, [["faq", "/faq", "자주 묻는 질문", "FAQ"], ["contact", "/contact", "상담 신청", "Contact"]]).map(function (n) {
      return '<a href="' + n[1] + '"' + (cur === n[0] ? ' aria-current="page"' : "") + ">" + n[2] + '<span class="en">' + n[3] + "</span></a>";
    }).join("");
    return '<a href="#main" class="skip">본문 바로가기</a>\n' +
      '<div class="notice" data-notice hidden></div>\n' +
      '<header class="hdr">\n  <div class="wrap hdr__in">\n' +
      '    <a href="/" class="logo" aria-label="코어무드 홈으로"><span class="logo__mark">코어무드<span class="dot">.</span></span><span class="logo__en">Core Mood</span></a>\n' +
      '    <nav class="nav" aria-label="주요 메뉴">' + nav + "</nav>\n" +
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
      '      <div>\n        <span class="ftr__t">Studio</span>\n        <ul class="ftr__list"><li><a href="/about">브랜드 소개</a></li><li><a href="/services">서비스</a></li><li><a href="/portfolio">프로젝트</a></li><li><a href="/process">진행 절차</a></li><li><a href="/estimate">견적 안내</a></li><li><a href="/faq">자주 묻는 질문</a></li><li><a href="/contact">상담 신청</a></li></ul>\n      </div>\n' +
      '      <div>\n        <span class="ftr__t">Industries</span>\n        <ul class="ftr__list">' + inds + "</ul>\n      </div>\n" +
      '      <div>\n        <span class="ftr__t">Journal</span>\n        <ul class="ftr__list"><li><a href="/journal/">전체 글</a></li>' + cats + '<li><a href="/feed.xml">RSS</a></li></ul>\n      </div>\n    </div>\n' +
      '    <div class="ftr__biz">상호 ' + SITE.corp + " <i>|</i> 브랜드 " + SITE.full + " <i>|</i> 대표 " + SITE.ceo + " <i>|</i> " + SITE.address + " <i>|</i> 전화 " + SITE.tel + " <i>|</i> " + SITE.email + "</div>\n" +
      '    <div class="ftr__bot">\n      <span class="ftr__cp">© <span data-year>2026</span> ' + SITE.full + '. All rights reserved.</span>\n' +
      '      <span class="ftr__cp en" style="letter-spacing:.16em;text-transform:uppercase">' + SITE.sloganEn + "</span>\n    </div>\n  </div>\n</footer>\n" +
      '<div class="mobcta">\n  <a href="' + SITE.telLink + '" class="btn btn--ghost">전화 상담</a>\n  <a href="/contact" class="btn">상담 신청</a>\n</div>';
  }

  function tail(extra) {
    return '<script src="/assets/js/main.js?v=' + ASSET_V + '" defer></script>\n' + (extra || "") + "</body>\n</html>\n";
  }

  function orgLd() {
    return {
      "@context": "https://schema.org", "@type": "ProfessionalService", "@id": SITE.url + "/#org",
      name: SITE.full, alternateName: ["코어무드", "CoreMood", "CORE MOOD"], legalName: SITE.corp,
      description: "공간 컨셉 기획, 브랜드 개발, 상업공간 인테리어 설계·시공, 콘텐츠·마케팅을 하나로 연결하는 공간 비즈니스 스튜디오",
      url: SITE.url, logo: SITE.url + "/favicon.svg", image: abs(SITE.ogDefault),
      telephone: SITE.telIntl, email: SITE.email, founder: { "@type": "Person", name: SITE.ceo },
      address: { "@type": "PostalAddress", streetAddress: SITE.addrStreet, addressLocality: SITE.addrLocality, addressRegion: "서울특별시", addressCountry: "KR" },
      areaServed: "KR", priceRange: "₩₩₩",
      openingHoursSpecification: [{ "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "19:00" }],
      knowsAbout: ["상업공간 인테리어", "공간 브랜딩", "매장 인테리어", "카페 인테리어", "미용실 인테리어", "파티룸 인테리어", "스터디카페 인테리어", "모텔 리모델링", "사무실 인테리어", "네이버 플레이스 마케팅"]
    };
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
      '<figure class="jcard__fig"><img src="' + attr(p.cover) + '" alt="' + attr(p.coverAlt) + '" loading="lazy" decoding="async"></figure>' +
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
        author: { "@type": "Organization", name: SITE.full, url: SITE.url }, publisher: { "@id": SITE.url + "/#org", "@type": "Organization", name: SITE.full, logo: { "@type": "ImageObject", url: SITE.url + "/favicon.svg" } },
        mainEntityOfPage: abs(path), articleSection: c.name, keywords: [post.keyword].concat(post.tags || []).filter(Boolean).join(", "), inLanguage: "ko-KR"
      },
      crumbLd([["홈", "/"], ["저널", "/journal/"], [c.name, "/journal/category/" + post.category], [post.title, path]])
    ];
    if (r.faq.length) ld.push(faqLd(r.faq));
    var tocHtml = r.toc.length > 2 ? '<nav class="jtoc" aria-label="목차"><span class="jtoc__t">Contents</span><ol>' + r.toc.map(function (t) { return '<li><a href="#' + t.id + '">' + esc(t.text) + "</a></li>"; }).join("") + "</ol></nav>" : "";
    var h = headTag({
      title: post.title + " | 코어무드 저널", ogTitle: post.title, description: post.description, path: path, image: image, type: "article",
      keywords: [post.keyword].concat(post.tags || []).filter(Boolean).join(", "), published: post.date, modified: post.updated || post.date, ld: ld
    }) +
      '<body data-page="journal" class="has-mobcta">\n<!--@header-->\n' + header("journal") + "\n<!--/@header-->\n<main id=\"main\">\n" +
      '<article class="jpost">\n<header class="jhead">\n  <div class="wrap">\n' + crumbs([["홈", "/"], ["저널", "/journal/"], [c.name, "/journal/category/" + post.category]]) +
      '\n    <a class="jhead__cat" href="/journal/category/' + post.category + '">' + c.name + '<span class="en">' + c.en + "</span></a>\n" +
      '    <h1 class="h1 jhead__t">' + dot(post.title) + "</h1>\n" +
      '    <p class="lead jhead__d">' + esc(post.description) + "</p>\n" +
      '    <dl class="tblock jhead__meta"><div><dt>발행</dt><dd><time datetime="' + attr(post.date) + '">' + fmtDate(post.date) + "</time></dd></div>" +
      "<div><dt>분류</dt><dd>" + c.name + "</dd></div><div><dt>읽는 시간</dt><dd>약 " + post.minutes + "분</dd></div><div><dt>작성</dt><dd>코어무드 스튜디오</dd></div></dl>\n" +
      '  </div>\n</header>\n<figure class="jcover wrap"><img src="' + attr(post.cover) + '" alt="' + attr(post.coverAlt) + '" decoding="async" fetchpriority="high"></figure>\n' +
      '<div class="wrap jbody">\n  <aside class="jside">' + tocHtml + "</aside>\n  <div class=\"prose\">\n" + r.html + "\n" +
      ((post.tags || []).length ? '<div class="jtags">' + post.tags.map(function (t) { return '<span class="tag">#' + esc(t) + "</span>"; }).join("") + "</div>\n" : "") +
      '<div class="jauthor"><span class="jauthor__mark">코어무드<span class="dot">.</span></span><div><strong>코어무드 스튜디오</strong><p>컨셉과 무드에서 출발해 브랜드, 공간 기획, 인테리어, 콘텐츠와 마케팅까지 하나의 흐름으로 연결하는 공간 비즈니스 스튜디오입니다. ' + SITE.record + '를 다뤄 왔습니다. <a href="/about">스튜디오 소개</a> · <a href="/portfolio">프로젝트</a></p></div></div>\n' +
      '<div class="jshare"><button type="button" class="tlink" data-copy>링크 복사<span aria-hidden="true">↗</span></button><a class="tlink" href="/journal/">저널 목록<span aria-hidden="true">→</span></a></div>\n' +
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
      { "@context": "https://schema.org", "@type": "Blog", name: "코어무드 저널", url: SITE.url + "/journal/", description: "상업공간 브랜딩, 인테리어, 마케팅, 창업에 대한 코어무드의 실무 노트", publisher: { "@id": SITE.url + "/#org" } },
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
      (first ? '    <div class="jfeature">' + card(first, { big: true }) + "</div>\n" : '    <p class="lead">곧 첫 글이 올라옵니다.</p>\n') +
      '    <div class="jgrid" data-jgrid>' + rest.map(function (p) { return card(p); }).join("") + "</div>\n" +
      '    <p class="jempty" data-jempty hidden>찾으시는 주제의 글이 아직 없습니다. 궁금한 점은 <a href="/contact">상담 신청</a>으로 남겨 주시면 글로도 다뤄 보겠습니다.</p>\n' +
      (posts.length > 24 ? '    <div class="jmore"><button type="button" class="btn btn--ghost" data-jmore data-offset="24">이전 글 더 보기</button></div>\n' : "") +
      "  </div>\n</section>\n" +
      '<section class="sec sec--sand sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">주제별로 읽기<span class="dot">.</span></h2></div>\n    <div class="jcats">' +
      CAT_ORDER.map(function (k) {
        var n = posts.filter(function (p) { return p.category === k; }).length;
        return '<a class="jcat" href="/journal/category/' + k + '"><span class="jcat__en en">' + CATS[k].en + '</span><strong class="jcat__t">' + CATS[k].name + '</strong><span class="jcat__d">' + CATS[k].desc + '</span><span class="jcat__n">' + n + "편</span></a>";
      }).join("") + "</div>\n  </div>\n</section>\n" +
      ctaBlock() + "\n</main>\n<!--@footer-->\n" + footer() + "\n<!--/@footer-->\n" + tail();
  }
  function renderCategory(cat, ctx) {
    var c = CATS[cat];
    var posts = sortPosts((ctx.posts || []).filter(function (p) { return p.category === cat; }));
    var path = "/journal/category/" + cat;
    var ld = [
      { "@context": "https://schema.org", "@type": "CollectionPage", name: "코어무드 저널 · " + c.name, url: abs(path), description: c.desc },
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

  /* ---------- industry pages ---------- */
  function industryOf(slug) { for (var i = 0; i < INDUSTRIES.length; i++) if (INDUSTRIES[i].slug === slug) return INDUSTRIES[i]; return null; }
  function baBlock(key) {
    var b = BA[key];
    if (!b) return "";
    return '<section class="sec sec--sand sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">실제 시공 현장<span class="dot">.</span></h2><a class="tlink" href="/portfolio#before-after">시공 사례 더 보기<span aria-hidden="true">→</span></a></div>\n' +
      '    <div class="ba ba--single" data-ba><div>\n      <div class="ba__stage" tabindex="0" role="slider" aria-label="시공 전후 비교 슬라이더" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50">\n' +
      '        <div class="ba__before"><img src="/assets/img/ba-' + b[1] + '-before.webp" alt="' + b[0] + ' 시공 전" width="798" height="532" loading="lazy"></div>\n' +
      '        <div class="ba__after"><img src="/assets/img/ba-' + b[1] + '-after.webp" alt="' + b[0] + ' 시공 후" width="798" height="532" loading="lazy"></div>\n' +
      '        <span class="ba__tag ba__tag--b">Before</span><span class="ba__tag ba__tag--a">After</span>\n        <div class="ba__handle"><span class="ba__knob" aria-hidden="true">◀ ▶</span></div>\n      </div>\n' +
      '      <p class="tiny ba__note">' + b[0] + " · 공정 범위 · " + b[2] + "</p>\n    </div></div>\n  </div>\n</section>\n";
  }
  function renderIndustry(ind, body, ctx) {
    var r = md(body);
    var path = "/industries/" + ind.slug;
    var meta = industryOf(ind.slug) || { name: ind.title, tags: [] };
    var tags = (ind.tags || []).concat(meta.tags || []);
    var rel = postsForTags(tags, ctx.posts || [], 3);
    var others = INDUSTRIES.filter(function (x) { return x.slug !== ind.slug; });
    var ld = [
      { "@context": "https://schema.org", "@type": "Service", name: ind.title, serviceType: ind.keyword || ind.title, description: ind.description, url: abs(path), image: abs(ind.hero || meta.img), provider: { "@id": SITE.url + "/#org", "@type": "ProfessionalService", name: SITE.full }, areaServed: { "@type": "Country", name: "대한민국" } },
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
      '      <figure class="ihero__fig"><img src="' + attr(ind.hero || meta.img) + '" alt="' + attr(ind.heroAlt || ind.title) + '" decoding="async" fetchpriority="high"></figure>\n' +
      "    </div>\n  </div>\n</section>\n" +
      '<section class="sec sec--tight">\n<div class="wrap jbody">\n  <aside class="jside">' + tocHtml + "</aside>\n  <div class=\"prose\">\n" + r.html + "\n  </div>\n</div>\n</section>\n" +
      baBlock(ind.ba) +
      (rel.length ? '<section class="sec sec--tight">\n  <div class="wrap">\n    <div class="jsec-h"><h2 class="h2">' + esc(meta.short || ind.title) + ' 준비에 도움이 되는 글<span class="dot">.</span></h2><a class="tlink" href="/journal/">저널 전체 보기<span aria-hidden="true">→</span></a></div>\n    <div class="jgrid">' + rel.map(function (p) { return card(p); }).join("") + "</div>\n  </div>\n</section>\n" : "") +
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
      ctaBlock("답을 찾지 못하셨다면", "공간 사진이나 후보 자리 주소와 함께 질문을 남겨 주세요. 담당자가 직접 확인하고 답을 드립니다. 상담과 방향 제안까지는 비용이 들지 않습니다.") +
      "\n</main>\n<!--@footer-->\n" + footer() + "\n<!--/@footer-->\n" + tail();
  }

  /* ---------- sitemap / feed / json ---------- */
  var STATIC_PAGES = [
    ["/", "1.0", "weekly"], ["/about", "0.8", "monthly"], ["/services", "0.9", "monthly"], ["/industries/", "0.9", "weekly"],
    ["/portfolio", "0.9", "monthly"], ["/process", "0.8", "monthly"], ["/estimate", "0.8", "monthly"], ["/faq", "0.7", "monthly"],
    ["/contact", "0.8", "monthly"], ["/journal/", "0.9", "daily"]
  ];
  function renderSitemap(ctx) {
    var today = isoDate(new Date(ctx.now || Date.now()));
    var posts = sortPosts(ctx.posts || []);
    var lastPost = posts[0] ? isoDate(posts[0].updated || posts[0].date) : today;
    var u = function (loc, lastmod, freq, pri) { return "  <url><loc>" + abs(loc) + "</loc><lastmod>" + lastmod + "</lastmod><changefreq>" + freq + "</changefreq><priority>" + pri + "</priority></url>"; };
    var rows = STATIC_PAGES.map(function (s) { return u(s[0], s[0] === "/journal/" || s[0] === "/" ? lastPost : (ctx.staticLastmod || today), s[2], s[1]); });
    INDUSTRIES.forEach(function (x) { rows.push(u("/industries/" + x.slug, ctx.industryLastmod || today, "monthly", "0.8")); });
    CAT_ORDER.forEach(function (k) { rows.push(u("/journal/category/" + k, lastPost, "weekly", "0.6")); });
    posts.forEach(function (p) { rows.push(u(postUrl(p), isoDate(p.updated || p.date), "monthly", "0.7")); });
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + rows.join("\n") + "\n</urlset>\n";
  }
  function xmlEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function renderFeed(ctx) {
    var posts = sortPosts(ctx.posts || []).slice(0, 50);
    var items = posts.map(function (p) {
      return "    <item>\n      <title>" + xmlEsc(p.title) + "</title>\n      <link>" + abs(postUrl(p)) + "</link>\n      <guid isPermaLink=\"true\">" + abs(postUrl(p)) + "</guid>\n" +
        "      <description>" + xmlEsc(p.description) + "</description>\n      <category>" + xmlEsc((CATS[p.category] || {}).name || "") + "</category>\n" +
        "      <pubDate>" + new Date(p.date).toUTCString() + "</pubDate>\n    </item>";
    }).join("\n");
    return '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n' +
      "    <title>코어무드 저널</title>\n    <link>" + SITE.url + "/journal/</link>\n" +
      "    <description>상업공간 브랜딩, 인테리어, 마케팅, 창업에 대한 코어무드의 실무 노트</description>\n    <language>ko</language>\n" +
      '    <atom:link href="' + SITE.url + '/feed.xml" rel="self" type="application/rss+xml"/>\n' +
      "    <lastBuildDate>" + new Date(ctx.now || Date.now()).toUTCString() + "</lastBuildDate>\n" + items + "\n  </channel>\n</rss>\n";
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
  function staticHead(key, meta, html) {
    var ld;
    if (key === "index") {
      ld = [orgLd(), { "@context": "https://schema.org", "@type": "WebSite", "@id": SITE.url + "/#site", name: SITE.full, url: SITE.url + "/", inLanguage: "ko-KR", publisher: { "@id": SITE.url + "/#org" } }];
    } else {
      ld = meta.noindex ? [] : [crumbLd([["홈", "/"], [meta.name, meta.path]])];
      var faq = extractFaq(html || "");
      if (faq.length && !meta.noindex) ld.push(faqLd(faq));
    }
    return headTag({ title: meta.title, description: meta.description, path: meta.path, image: meta.image, noindex: meta.noindex, ld: ld });
  }
  function latestBlock(posts) {
    var list = sortPosts(posts || []).slice(0, 3);
    if (!list.length) return "";
    return '<section class="sec sec--sand">\n  <div class="wrap">\n    <div class="shead rv">\n  <span class="shead__idx">08</span>\n  <div class="shead__body">\n    <span class="shead__en">Journal</span>\n' +
      '    <h2 class="h2 shead__t">매일 아침, 현장의 기준을<br>한 편씩 정리합니다<span class="dot">.</span></h2>\n' +
      '    <p class="lead shead__d">브랜딩, 인테리어, 마케팅, 창업. 견적서를 받기 전과 계약서에 도장을 찍기 전에 읽어 두시면 좋은 글들입니다.</p>\n  </div>\n</div>\n' +
      '    <div class="jgrid">' + list.map(function (p) { return card(p); }).join("") + "</div>\n" +
      '    <div style="margin-top:2.6em"><a href="/journal/" class="tlink">저널 전체 보기<span aria-hidden="true">→</span></a></div>\n  </div>\n</section>';
  }
  function industriesBlock() {
    return '<section class="sec">\n  <div class="wrap">\n    <div class="shead rv">\n  <span class="shead__idx">07</span>\n  <div class="shead__body">\n    <span class="shead__en">Industries</span>\n' +
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
    if (ctx.pageMeta) html = html.replace(/^[\s\S]*?<\/head>\n?/, staticHead(cur, ctx.pageMeta, html));
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
    staticHead: staticHead, latestBlock: latestBlock, industriesBlock: industriesBlock, extractFaq: extractFaq, orgLd: orgLd
  };
  if (typeof module !== "undefined" && module.exports) module.exports = CM;
  else root.CMRender = CM;
})(typeof window !== "undefined" ? window : this);
