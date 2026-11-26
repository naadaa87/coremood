// 유입 경로 분류 — 이전 사이트 주소와 캠페인(utm), 앱 안 브라우저 정보로 사람이 읽기 쉬운 이름을 붙입니다.
const RULES = [
  [/(^|\.)search\.naver\.com$/, "네이버 검색"],
  [/(^|\.)blog\.naver\.com$/, "네이버 블로그"],
  [/(^|\.)cafe\.naver\.com$/, "네이버 카페"],
  [/(^|\.)(map|place|pcmap\.place|m\.place|m\.map)\.naver\.com$/, "네이버 지도 · 플레이스"],
  [/(^|\.)naver\.(com|me)$/, "네이버 기타"],
  [/(^|\.)google\.[a-z.]+$/, "구글"],
  [/(^|\.)(search\.)?daum\.net$/, "다음"],
  [/(^|\.)(kakao\.com|kakaocdn\.net|kakaotalk)$/, "카카오"],
  [/(^|\.)instagram\.com$/, "인스타그램"],
  [/(^|\.)(facebook\.com|fb\.me|fb\.com)$/, "페이스북"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "유튜브"],
  [/(^|\.)threads\.(net|com)$/, "스레드"],
  [/(^|\.)tistory\.com$/, "티스토리"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)zum\.com$/, "줌"],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, "ChatGPT"],
  [/(^|\.)perplexity\.ai$/, "Perplexity"],
  [/(^|\.)(gemini\.google\.com|bard\.google\.com)$/, "Gemini"],
  [/(^|\.)claude\.ai$/, "Claude"],
  [/(^|\.)copilot\.microsoft\.com$/, "Copilot"],
  [/(^|\.)(wrtn\.ai|clova-x\.naver\.com|cue\.search\.naver\.com)$/, "국내 AI 검색"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"]
];
// 검색 유입으로 묶어 보는 이름 (KPI 의 ‘검색 · AI 유입’)
export const SEARCH_SOURCES = ["네이버 검색", "구글", "다음", "Bing", "줌", "DuckDuckGo"];
export const AI_SOURCES = ["ChatGPT", "Perplexity", "Gemini", "Claude", "Copilot", "국내 AI 검색"];

export function hostOf(ref) {
  try { return new URL(ref).hostname.toLowerCase().replace(/^(www|m)\./, ""); } catch (e) { return ""; }
}

export function classifySource(ref, utm, ua) {
  const m = /(?:^|&)source=([^&]+)/.exec(utm || "");
  if (m) {
    let v = m[1];
    try { v = decodeURIComponent(v); } catch (e) {}
    return "캠페인 · " + v.slice(0, 30);
  }
  const host = ref ? hostOf(ref) : "";
  if (host) {
    if (/^gemini\.google\.com$/.test(host)) return "Gemini";
    if (/^(clova-x|cue\.search)\.naver\.com$/.test(host)) return "국내 AI 검색";
    for (const [re, name] of RULES) if (re.test(host)) return name;
    return host.slice(0, 60);
  }
  const u = ua || "";
  if (/KAKAOTALK/i.test(u)) return "카카오톡";
  if (/NAVER\(inapp|NAVER\/|whale.*naver/i.test(u)) return "네이버 앱";
  if (/Instagram/i.test(u)) return "인스타그램";
  if (/FBAN|FBAV/i.test(u)) return "페이스북";
  if (/Line\//i.test(u)) return "라인";
  return "직접 방문";
}

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pagespeed|ptst|yeti|daumoa|daum\/[0-9]|bingpreview|python|curl|wget|httpclient|axios|node-fetch|go-http/i;
export function isBot(ua) { return !ua || BOT.test(ua); }
