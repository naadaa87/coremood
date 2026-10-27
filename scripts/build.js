#!/usr/bin/env node
/* 코어무드 사이트 빌드
   content/ 의 마크다운을 HTML 페이지로 만들고, 공통 헤더·푸터, 사이트맵, RSS, 목록 데이터를 갱신합니다.
   사용법: node scripts/build.js            (기본)
           node scripts/build.js --no-og    (공유 이미지 생성 생략)
           node scripts/build.js --now=2026-10-27T10:00:00+09:00  (예약 글 공개 시각 기준 지정) */
"use strict";
const fs = require("fs");
const path = require("path");
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

// 검색엔진 소유확인 태그 (data/site.json → 홈 <head>)
try { CM.setVerify(JSON.parse(read(P("data/site.json"))).verify); } catch (e) { /* 기본값 사용 */ }
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
const ctx = { posts: live.map((p) => p.meta), cases, now: NOW };

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

/* ---------- industries ---------- */
const inds = listMd("content/industries").map((file) => {
  const { data, body } = CM.parseFront(read(file));
  data.slug = data.slug || path.basename(file, ".md");
  return { data, body, file: path.relative(ROOT, file) };
}).sort((a, b) => (a.data.order || 99) - (b.data.order || 99));
inds.forEach((x) => write("industries/" + x.data.slug + ".html", CM.renderIndustry(x.data, x.body, ctx)));
write("industries/index.html", CM.renderIndustriesIndex(inds.map((x) => x.data), ctx));

/* ---------- generic pages (faq 등) ---------- */
const pages = listMd("content/pages").map((file) => {
  const { data, body } = CM.parseFront(read(file));
  data.slug = data.slug || path.basename(file, ".md");
  return { data, body, file: path.relative(ROOT, file) };
});
pages.forEach((x) => write(x.data.slug + ".html", CM.renderPage(x.data, x.body, ctx)));

/* ---------- hand-written pages: head + header/footer ---------- */
const pageMeta = JSON.parse(read(P("data/pages.json"))).pages;
Object.entries(pageMeta).forEach(([key, meta]) => {
  const f = P(meta.file);
  if (!fs.existsSync(f)) return;
  const html = read(f);
  write(meta.file, CM.injectPartials(html, key, { posts: ctx.posts, cases: ctx.cases, pageMeta: meta }));
});

/* ---------- sitemap / rss / json ---------- */
write("sitemap.xml", CM.renderSitemap(ctx));
write("feed.xml", CM.renderFeed(ctx));
write("data/posts.json", CM.postsJson(ctx));

const status = (m) => (m.draft ? "draft" : CM.isLive(m, NOW) ? "live" : "scheduled");
const index = {
  updated: new Date(NOW).toISOString(),
  posts: CM.sortPosts(allPosts.map((p) => Object.assign({}, p.meta, { status: status(p.meta), file: p.file }))),
  industries: inds.map((x) => ({ slug: x.data.slug, title: x.data.title, keyword: x.data.keyword, lead: x.data.lead || "", description: x.data.description || "", hero: x.data.hero || "", heroAlt: x.data.heroAlt || "", order: x.data.order || 99, file: x.file })),
  pages: pages.map((x) => ({ slug: x.data.slug, title: x.data.title, file: x.file }))
};
write("content/index.json", JSON.stringify(index, null, 1) + "\n");

const sched = allPosts.filter((p) => status(p.meta) === "scheduled").length;
const drafts = allPosts.filter((p) => p.meta.draft).length;
console.log(`빌드 완료 · 시공 사례 ${liveCaseSet.size} · 공개 글 ${live.length} · 예약 ${sched} · 임시저장 ${drafts} · 업종 ${inds.length} · 페이지 ${pages.length} · 변경 파일 ${written} · 삭제 ${removed}`);
