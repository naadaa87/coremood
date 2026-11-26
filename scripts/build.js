#!/usr/bin/env node
/* 코어무드 사이트 빌드
   content/ 의 마크다운을 HTML 페이지로 만들고, 공통 헤더·푸터, 사이트맵, RSS, 목록 데이터를 갱신합니다.
   검색·AI 대응 파일(주제 허브, 용어 사전, 검색 색인, robots.txt, llms.txt)도 여기서 함께 만듭니다.
   사용법: node scripts/build.js            (기본)
           node scripts/build.js --no-og    (공유 이미지 생성 생략)
           node scripts/build.js --now=2026-10-27T10:00:00+09:00  (예약 글 공개 시각 기준 지정) */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const CM = require("../assets/js/cm-render.js");

const ROOT = path.join(__dirname, "..");
const P = (...a) => path.join(ROOT, ...a);
const args = process.argv.slice(2);
const nowArg = (args.find((a) => a.startsWith("--now=")) || "").slice(6);
const NOW = nowArg ? new Date(nowArg).getTime() : Date.now();
const NO_OG = args.includes("--no-og");

const read = (p) => fs.readFileSync(p, "utf8");
let written = 0, removed = 0;

// 검색엔진 소유확인 태그, 채널 주소 (data/site.json → 홈 <head>, 구조화 데이터 sameAs, 푸터)
let site = {};
try { site = JSON.parse(read(P("data/site.json"))); CM.setVerify(site.verify); } catch (e) { /* 기본값 사용 */ }
const readJson = (rel, fallback) => { try { return JSON.parse(read(P(rel))); } catch (e) { console.warn("  " + rel + " 을 읽지 못했습니다:", e.message); return fallback; } };

// 이미지 크기 (width·height 속성과 og:image 크기용). 외부 도구 없이 파일 머리말만 읽습니다.
function imgSize(file) {
  const b = fs.readFileSync(file);
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const k = b.toString("ascii", 12, 16);
    if (k === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (k === "VP8L") { const n = b.readUInt32LE(21); return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1]; }
    if (k === "VP8X") return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
  }
  if (b.length > 24 && b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}
function collectDims() {
  const out = {};
  const walk = (dir) => fs.readdirSync(P(dir)).sort().forEach((f) => {
    const rel = dir + "/" + f;
    if (fs.statSync(P(rel)).isDirectory()) { if (f !== "archive") walk(rel); return; } // 아카이브 사진은 archive.json 에 크기가 있습니다
    if (!/\.(webp|jpe?g|png)$/i.test(f)) return;
    try { const d = imgSize(P(rel)); if (d && d[0] && d[1]) out["/" + rel] = d; } catch (e) { /* 크기를 못 읽은 이미지는 건너뜀 */ }
  });
  walk("assets/img");
  return out;
}
const hash = (str) => crypto.createHash("sha1").update(str).digest("hex").slice(0, 10);
function write(rel, content) {
  const f = P(rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  if (fs.existsSync(f) && read(f) === content) return;
  fs.writeFileSync(f, content);
  written++;
}
function listMd(dir) {
  const d = P(dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith(".md")).sort().map((f) => path.join(d, f));
}

/* ---------- posts ---------- */
const allPosts = listMd("content/posts").map((file) => {
  const slug = path.basename(file, ".md");
  const { data, body } = CM.parseFront(read(file));
  const meta = CM.postMeta(slug, data, body);
  meta.slug = slug;
  return { meta, body, file: path.relative(ROOT, file) };
});

// 공유 이미지(OG 카드)
let pyOk = !NO_OG;
if (pyOk) {
  try { execFileSync("python3", ["-c", "import PIL"], { stdio: "ignore" }); } catch (e) { pyOk = false; }
}
const ogKeysFile = P("content/og-keys.json");
const ogKeys = fs.existsSync(ogKeysFile) ? JSON.parse(read(ogKeysFile)) : {};
allPosts.forEach((p) => {
  const ogRel = "assets/img/og/" + p.meta.slug + ".jpg";
  const key = p.meta.title + "|" + p.meta.category + "|" + p.meta.cover;
  if (pyOk && (!fs.existsSync(P(ogRel)) || ogKeys[p.meta.slug] !== key)) {
    try {
      execFileSync("python3", [P("scripts/og.py"), p.meta.slug, p.meta.title, CM.CATS[p.meta.category].name, p.meta.cover], { stdio: "ignore" });
      ogKeys[p.meta.slug] = key;
      written++;
    } catch (e) { console.warn("  OG 이미지 생성 실패:", p.meta.slug); }
  }
  if (!p.meta.og && fs.existsSync(P(ogRel))) p.meta.og = "/" + ogRel;
});
if (pyOk) write("content/og-keys.json", JSON.stringify(ogKeys, null, 1) + "\n");

const live = allPosts.filter((p) => CM.isLive(p.meta, NOW));
let cases = [];
try { cases = JSON.parse(read(P("data/cases.json"))).cases || []; } catch (e) { console.warn("  data/cases.json 을 읽지 못했습니다:", e.message); }
let archive = null;
try { archive = JSON.parse(read(P("data/archive.json"))); } catch (e) { console.warn("  data/archive.json 을 읽지 못했습니다:", e.message); }
const ctx = { posts: live.map((p) => p.meta), cases, archive, now: NOW };

/* ---------- 원본 읽기: 업종 · 일반 페이지 · 직접 만든 페이지 ---------- */
const inds = listMd("content/industries").map((file) => {
  const { data, body } = CM.parseFront(read(file));
  data.slug = data.slug || path.basename(file, ".md");
  return { data, body, file: path.relative(ROOT, file) };
}).sort((a, b) => (a.data.order || 99) - (b.data.order || 99));
const pages = listMd("content/pages").map((file) => {
  const { data, body } = CM.parseFront(read(file));
  data.slug = data.slug || path.basename(file, ".md");
  return { data, body, file: path.relative(ROOT, file) };
});
const pageMeta = JSON.parse(read(P("data/pages.json"))).pages;
const statics = Object.entries(pageMeta).filter(([, meta]) => fs.existsSync(P(meta.file))).map(([key, meta]) => ({ key, meta, html: read(P(meta.file)) }));

/* ---------- 검색·AI 대응에 쓰는 공용 데이터 ---------- */
const topicsDoc = readJson("data/topics.json", { topics: [] });
const glossary = readJson("data/glossary.json", { groups: [] });
const digest = {}, bodies = {};
live.forEach((p) => { digest[p.meta.slug] = CM.digest(p.body); bodies[p.meta.slug] = p.body; });
const faqPage = pages.find((x) => x.data.slug === "faq");
const processPage = statics.find((x) => x.key === "process");
const dims = collectDims();

// 페이지별 수정일: 내용이 실제로 바뀐 날만 기록합니다 (사이트맵 lastmod 가 매일 바뀌지 않도록)
const lastmodFile = "data/lastmod.json";
const lastmodPrev = fs.existsSync(P(lastmodFile)) ? readJson(lastmodFile, {}) : {};
const lastmod = { _note: "사이트맵 lastmod 용 기록입니다. 빌드가 페이지 내용의 변화를 감지해 자동으로 갱신하므로 직접 고치지 않습니다." };
const today = CM.isoDate(new Date(NOW));
const touch = (urlPath, source) => {
  const h = hash(source), prev = lastmodPrev[urlPath];
  lastmod[urlPath] = prev && prev.h === h ? prev : { h, d: today };
};
const stripPartials = (html) => html.replace(/^[\s\S]*?<\/head>/, "").replace(/<!--@(\w[\w-]*)-->[\s\S]*?<!--\/@\1-->/g, "").replace(/\?v=\d+/g, "");
statics.forEach((x) => { if (!x.meta.noindex) touch(x.meta.path, stripPartials(x.html) + JSON.stringify([x.meta.title, x.meta.description])); });
inds.forEach((x) => touch("/industries/" + x.data.slug, read(P(x.file))));
pages.forEach((x) => touch("/" + x.data.slug, read(P(x.file))));
touch("/industries/", inds.map((x) => [x.data.slug, x.data.title, x.data.lead, x.data.description].join("|")).join("\n"));
touch("/glossary", JSON.stringify(glossary.groups));
if (archive) touch("/portfolio", stripPartials((statics.find((x) => x.key === "portfolio") || { html: "" }).html) + JSON.stringify([archive.items, cases.map((c) => [c.slug, c.title, c.summary, c.draft])]));
CM.liveCases(ctx).forEach((c) => touch(CM.caseUrl(c), JSON.stringify(c)));

CM.setData({
  topics: topicsDoc, glossary, channels: site.channels || {}, dims, lastmod, digest, bodies, archive, cases,
  industries: inds.map((x) => ({ slug: x.data.slug, title: x.data.title, keyword: x.data.keyword, lead: x.data.lead || "", description: x.data.description || "", hero: x.data.hero || "" })),
  pages: pageMeta,
  gpages: pages.map((x) => ({ slug: x.data.slug, title: x.data.title, description: x.data.description || "" })),
  faq: faqPage ? CM.md(faqPage.body).faq : [],
  process: processPage ? CM.processSteps(processPage.html) : []
});

/* ---------- cases (시공 사례) ---------- */
const liveCaseSet = new Set(CM.liveCases(ctx).map((c) => c.slug));
CM.liveCases(ctx).forEach((c) => write("projects/" + c.slug + ".html", CM.renderCase(c, ctx)));
if (fs.existsSync(P("projects"))) {
  fs.readdirSync(P("projects")).filter((f) => f.endsWith(".html")).forEach((f) => {
    if (!liveCaseSet.has(f.replace(/\.html$/, ""))) { fs.unlinkSync(P("projects", f)); removed++; }
  });
}

// 개별 글
const liveSet = new Set(live.map((p) => p.meta.slug));
live.forEach((p) => write("journal/" + p.meta.slug + ".html", CM.renderPost(p.meta, p.body, ctx)));
// 공개 대상이 아닌 글(임시저장·예약·삭제)의 페이지 정리
if (fs.existsSync(P("journal"))) {
  fs.readdirSync(P("journal")).filter((f) => f.endsWith(".html") && f !== "index.html").forEach((f) => {
    if (!liveSet.has(f.replace(/\.html$/, ""))) { fs.unlinkSync(P("journal", f)); removed++; }
  });
}
write("journal/index.html", CM.renderJournalIndex(ctx));
CM.CAT_ORDER.forEach((k) => write("journal/category/" + k + ".html", CM.renderCategory(k, ctx)));

/* ---------- 주제 허브 (/journal/topic/<slug>) ---------- */
const topics = CM.liveTopics(ctx);
const topicSet = new Set(topics.map((o) => o.t.slug));
topics.forEach((o) => write("journal/topic/" + o.t.slug + ".html", CM.renderTopic(o.t, ctx)));
if (fs.existsSync(P("journal/topic"))) {
  fs.readdirSync(P("journal/topic")).filter((f) => f.endsWith(".html")).forEach((f) => {
    if (!topicSet.has(f.replace(/\.html$/, ""))) { fs.unlinkSync(P("journal/topic", f)); removed++; }
  });
}

/* ---------- industries ---------- */
inds.forEach((x) => write("industries/" + x.data.slug + ".html", CM.renderIndustry(x.data, x.body, ctx)));
write("industries/index.html", CM.renderIndustriesIndex(inds.map((x) => x.data), ctx));

/* ---------- generic pages (faq 등) · 용어 사전 · 검색 ---------- */
pages.forEach((x) => write(x.data.slug + ".html", CM.renderPage(x.data, x.body, ctx)));
if (glossary.groups.length) write("glossary.html", CM.renderGlossary(ctx));
write("search.html", CM.renderSearchPage(ctx));

/* ---------- hand-written pages: head + header/footer ---------- */
statics.forEach((x) => {
  write(x.meta.file, CM.injectPartials(x.html, x.key, { posts: ctx.posts, cases: ctx.cases, archive: ctx.archive, pageMeta: x.meta }));
});

/* ---------- sitemap / rss / json / 검색 색인 / robots / llms ---------- */
write("sitemap.xml", CM.renderSitemap(ctx));
write("feed.xml", CM.renderFeed(ctx));
write("data/posts.json", CM.postsJson(ctx));
write("data/search.json", CM.searchIndex(ctx));
write("data/dims.json", JSON.stringify(dims) + "\n");
write(lastmodFile, JSON.stringify(lastmod, null, 1) + "\n");
write("robots.txt", CM.renderRobots());
write("llms.txt", CM.renderLlms(ctx));
write("llms-full.txt", CM.renderLlmsFull(ctx));

const status = (m) => (m.draft ? "draft" : CM.isLive(m, NOW) ? "live" : "scheduled");
const index = {
  updated: new Date(NOW).toISOString(),
  posts: CM.sortPosts(allPosts.map((p) => Object.assign({}, p.meta, { status: status(p.meta), file: p.file, fq: CM.digest(p.body).faq.map((f) => f.q), sum: CM.digest(p.body).summary.length }))),
  industries: inds.map((x) => ({ slug: x.data.slug, title: x.data.title, keyword: x.data.keyword, lead: x.data.lead || "", description: x.data.description || "", hero: x.data.hero || "", heroAlt: x.data.heroAlt || "", order: x.data.order || 99, file: x.file })),
  pages: pages.map((x) => ({ slug: x.data.slug, title: x.data.title, file: x.file }))
};
write("content/index.json", JSON.stringify(index, null, 1) + "\n");

const sched = allPosts.filter((p) => status(p.meta) === "scheduled").length;
const drafts = allPosts.filter((p) => p.meta.draft).length;
console.log(`빌드 완료 · 시공 사례 ${liveCaseSet.size} · 레퍼런스 ${archive ? CM.archiveStats(ctx).refs : 0} · 공개 글 ${live.length} · 예약 ${sched} · 임시저장 ${drafts} · 업종 ${inds.length} · 페이지 ${pages.length} · 주제 허브 ${topics.length} · 용어 ${glossary.groups.reduce((n, g) => n + g.terms.length, 0)} · 변경 파일 ${written} · 삭제 ${removed}`);
