// POST /api/indexnow — 새 글·수정한 글 주소를 검색엔진(네이버·빙 등 IndexNow 참여 엔진)에 바로 알립니다.
// 관리자 인증 필요. 본문: { urls: ["https://coremood.kr/journal/..."] }
// (새 글·바뀐 페이지는 functions/_lib/indexnow.js 의 autoSubmit 이 사이트맵을 보고 자동으로도 알립니다)
import { json, requireAdmin } from "../_lib/util.js";
import { submit } from "../_lib/indexnow.js";

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.res;
  let b;
  try { b = await context.request.json(); } catch (e) { return json({ ok: false, reason: "bad-json" }, 400); }
  const host = new URL(context.request.url).host;
  const origin = "https://" + host;
  const urls = (Array.isArray(b.urls) ? b.urls : []).filter((u) => typeof u === "string" && u.startsWith(origin)).slice(0, 1000);
  if (!urls.length) return json({ ok: false, reason: "no-urls" }, 400);
  const results = await submit(host, urls);
  return json({ ok: results.some((r) => r.status >= 200 && r.status < 300), results, count: urls.length });
}
