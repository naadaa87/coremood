#!/usr/bin/env node
/* 코어무드 콘텐츠 점검
   사용법: node scripts/check.js            → content/ 전체 점검
           node scripts/check.js 파일.md ... → 지정 파일만 점검
   오류(✗)가 하나라도 있으면 종료 코드 1 */
"use strict";
const fs = require("fs");
const path = require("path");
const CM = require("../assets/js/cm-render.js");

const ROOT = path.join(__dirname, "..");
const rel = (p) => path.relative(ROOT, p);

function listMd(dir) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith(".md")).map((f) => path.join(d, f));
}

// 유효한 내부 경로
function knownRoutes() {
  const set = new Set(["/", "/about", "/services", "/portfolio", "/process", "/estimate", "/contact", "/faq", "/industries/", "/journal/", "/feed.xml"]);
  CM.INDUSTRIES.forEach((x) => set.add("/industries/" + x.slug));
  CM.CAT_ORDER.forEach((k) => set.add("/journal/category/" + k));
  listMd("content/posts").forEach((f) => set.add("/journal/" + path.basename(f, ".md")));
  try {
    const plan = JSON.parse(fs.readFileSync(path.join(ROOT, "content/plan.json"), "utf8"));
    (plan.posts || []).forEach((p) => set.add("/journal/" + p.slug));
  } catch (e) { /* plan 없음 */ }
  return set;
}

const BANNED = [
  [/소셜\s*패밀리|SOCIAL\s*FAMILY/i, "이전 법인명은 쓰지 않습니다"],
  [/블랭크|BLANK/, "법인명 (주)블랭크는 본문에 쓰지 않습니다(브랜드는 코어무드)"],
  [/최고의|최고 수준|업계 최고|국내 최고|업계 1위|국내 1위|1위 업체|넘버원|No\.\s?1|최초의|유일한|업계 최저/, "최상급 표현 금지"],
  [/(매출|수익|성공|만족)\s*(을|를)?\s*보장|보장해\s*드립|100\s*%\s*(만족|보장|성공)|무조건/, "보장·단정 표현 금지"],
  [/100\s*년|100년\+/, "과장된 연차 표기 금지"],
  [/알아보겠습니다|알아볼까요|살펴보겠습니다|살펴볼까요|결론적으로|요약하자면|도움이 되셨|도움이 되었으면|여러분/, "상투적 표현(AI 번역투)"],
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, "이모지 금지"]
];
const WARN = [
  [/다양한/g, 2, "‘다양한’ 반복"],
  [/효과적/g, 1, "‘효과적’ 반복"],
  [/중요합니다/g, 3, "‘중요합니다’ 반복"],
  [/!/g, 1, "느낌표 사용"],
  [/—/g, 5, "줄표(—) 과다"],
  [/~/g, 12, "물결표 과다"]
];

function checkFile(file, routes) {
  const errs = [], warns = [];
  const src = fs.readFileSync(file, "utf8");
  const { data, body } = CM.parseFront(src);
  const kind = file.includes(path.join("content", "industries")) ? "industry" : file.includes(path.join("content", "pages")) ? "page" : "post";
  const base = path.basename(file, ".md");
  const need = kind === "post" ? ["title", "slug", "date", "category", "keyword", "tags", "description", "cover", "coverAlt"]
    : kind === "industry" ? ["title", "slug", "h1", "description", "keyword", "biz", "hero", "tags"] : ["title", "slug", "description"];
  need.forEach((k) => { if (data[k] === undefined || data[k] === "") errs.push("필수 항목 없음: " + k); });
  if (data.slug && data.slug !== base) errs.push(`slug(${data.slug})와 파일 이름(${base})이 다릅니다`);
  if (data.slug && !/^[a-z0-9-]+$/.test(data.slug)) errs.push("slug는 영문 소문자·숫자·하이픈만");
  if (kind === "post") {
    if (data.category && !CM.CATS[data.category]) errs.push("category 값 오류: " + data.category);
    if (data.date && isNaN(new Date(data.date))) errs.push("date 형식 오류: " + data.date);
    if (data.tags && (!Array.isArray(data.tags) || data.tags.length < 2)) errs.push("tags는 2개 이상 [a, b] 형식");
    if (data.title && (data.title.length < 12 || data.title.length > 48)) warns.push(`제목 길이 ${data.title.length}자 (권장 25~40자)`);
  }
  if (data.description) {
    const n = data.description.length;
    if (n < 60 || n > 170) errs.push(`description ${n}자 (60~170자)`);
  }
  ["cover", "hero"].forEach((k) => {
    if (data[k] && !fs.existsSync(path.join(ROOT, data[k].replace(/^\//, "")))) errs.push(`${k} 이미지 파일 없음: ${data[k]}`);
  });
  const len = CM.textLength(body);
  const min = kind === "page" ? 1500 : 2400;
  if (len < min) errs.push(`본문 ${len}자 (최소 ${min}자, 공백 제외)`);
  if (/^#\s/m.test(body)) errs.push("본문에 # (H1) 사용 금지 — ## 부터");
  const h2 = (body.match(/^##\s/gm) || []).length;
  if (h2 < 3) errs.push(`소제목(##) ${h2}개 (최소 3개)`);
  const text = body + " " + (data.title || "") + " " + (data.description || "");
  BANNED.forEach(([re, msg]) => { const m = text.match(re); if (m) errs.push(`${msg}: “${m[0]}”`); });
  WARN.forEach(([re, max, msg]) => { const n = (text.match(re) || []).length; if (n > max) warns.push(`${msg} ${n}회`); });
  if (/340/.test(text) && !/10여 년간 340개 이상/.test(text)) errs.push("실적 수치는 ‘10여 년간 340개 이상 프로젝트’ 형태로만");
  if (/인허가|소방|용도\s*변경|영업\s*신고|전기\s*용량|승압|전기\s*증설/.test(text) && !/별도\s*(의\s*)?확인/.test(text)) {
    errs.push("인허가·소방·전기 용량 언급 시 ‘별도 확인’ 안내 문구 필요");
  }
  const links = [...body.matchAll(/\]\((\/[^)\s#?]*)/g)].map((m) => m[1]);
  const internal = links.filter((u) => !/^\/assets\//.test(u));
  internal.forEach((u) => { if (!routes.has(u)) errs.push("없는 내부 링크: " + u); });
  links.filter((u) => /^\/assets\//.test(u)).forEach((u) => { if (!fs.existsSync(path.join(ROOT, u.slice(1)))) errs.push("없는 이미지: " + u); });
  if (kind !== "page" && internal.length < 2) errs.push(`내부 링크 ${internal.length}개 (최소 2개)`);
  if (kind === "industry" && !/:::faq/.test(body)) errs.push("업종 페이지에는 :::faq 블록이 필요합니다");
  const blocks = (body.match(/^:::\s*\w+/gm) || []).length, ends = (body.match(/^:::\s*$/gm) || []).length;
  if (blocks !== ends) errs.push(`::: 블록 열고 닫힘 불일치 (${blocks}/${ends})`);
  return { file, kind, len, errs, warns, data };
}

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const files = args.length ? args.map((a) => path.resolve(a)) : [...listMd("content/posts"), ...listMd("content/industries"), ...listMd("content/pages")];
  const routes = knownRoutes();
  let bad = 0;
  const slugs = {};
  files.forEach((f) => {
    const r = checkFile(f, routes);
    if (r.data.title) {
      const key = r.kind + ":" + r.data.title.replace(/\s/g, "");
      if (slugs[key]) r.errs.push("제목 중복: " + rel(slugs[key]));
      slugs[key] = f;
    }
    const mark = r.errs.length ? "✗" : r.warns.length ? "△" : "✓";
    console.log(`${mark} ${rel(f)}  (${r.len}자)`);
    r.errs.forEach((e) => console.log("    ✗ " + e));
    r.warns.forEach((w) => console.log("    △ " + w));
    if (r.errs.length) bad++;
  });
  console.log(`\n${files.length}개 점검 · 오류 ${bad}개 파일`);
  process.exit(bad ? 1 : 0);
}
main();
