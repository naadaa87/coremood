// POST /api/indexnow — 새 글·수정한 글 주소를 검색엔진(네이버·빙 등 IndexNow 참여 엔진)에 바로 알립니다.
// 관리자 인증 필요. 본문: { urls: ["https://coremood.kr/journal/..."] }
import { json, requireAdmin } from "../_lib/util.js";

const KEY = "9db53dff0a94dd43baf9cdc87a7e4fa6";

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.res;
  let b;
  try { b = await context.request.json(); } catch (e) { return json({ ok: false, reason: "bad-json" }, 400); }
  const host = new URL(context.request.url).host;
  const origin = "https://" + host;
  const urls = (Array.isArray(b.urls) ? b.urls : []).filter((u) => typeof u === "string" && u.startsWith(origin)).slice(0, 1000);
  if (!urls.length) return json({ ok: false, reason: "no-urls" }, 400);
  const payload = { host, key: KEY, keyLocation: origin + "/" + KEY + ".txt", urlList: urls };
  const targets = ["https://api.indexnow.org/indexnow", "https://searchadvisor.naver.com/indexnow"];
  const results = await Promise.all(targets.map((t) =>
    fetch(t, { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(payload) })
      .then((r) => ({ target: t, status: r.status }))
      .catch((e) => ({ target: t, status: 0, error: String(e) }))
  ));
  return json({ ok: results.some((r) => r.status >= 200 && r.status < 300), results, count: urls.length });
}
