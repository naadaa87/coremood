// IndexNow — 새로 생기거나 바뀐 주소를 검색엔진(네이버 · 빙 등)에 바로 알립니다.
// submit: 주소 목록 전송 · autoSubmit: 사이트맵이 바뀌었는지 확인해 바뀐 주소만 자동 전송
// 자동 전송은 방문 기록(/api/track)이 들어올 때 20분에 한 번만 확인하며, 매일 아침 자동 발행된 글도 이 경로로 알려집니다.
export const KEY = "9db53dff0a94dd43baf9cdc87a7e4fa6";
const TARGETS = ["https://api.indexnow.org/indexnow", "https://searchadvisor.naver.com/indexnow"];
const LIVE_HOST = /^coremood\.kr$/;
const GAP = 20 * 60000;

export async function submit(host, urls) {
  const origin = "https://" + host;
  const payload = { host, key: KEY, keyLocation: origin + "/" + KEY + ".txt", urlList: urls };
  return Promise.all(TARGETS.map((t) =>
    fetch(t, { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(payload) })
      .then((r) => ({ target: t, status: r.status }))
      .catch((e) => ({ target: t, status: 0, error: String(e).slice(0, 120) }))
  ));
}

const TABLE = "CREATE TABLE IF NOT EXISTS cm_kv (k TEXT PRIMARY KEY, v TEXT, at TEXT)";

export async function autoSubmit(context) {
  const { env, request } = context;
  const db = env.DB;
  if (!db || !env.ASSETS) return;
  const host = new URL(request.url).host;
  if (!LIVE_HOST.test(host)) return; // 미리보기 주소(pages.dev)에서는 보내지 않습니다
  const now = Date.now(), stamp = new Date(now).toISOString();
  let row = null;
  try { row = await db.prepare("SELECT v, at FROM cm_kv WHERE k = 'indexnow'").first(); }
  catch (e) { await db.prepare(TABLE).run(); }
  if (row && now - Date.parse(row.at) < GAP) return;
  // 확인 시각부터 갱신해 같은 순간에 여러 번 보내지 않게 합니다
  const lock = row
    ? await db.prepare("UPDATE cm_kv SET at = ? WHERE k = 'indexnow' AND at = ?").bind(stamp, row.at).run()
    : await db.prepare("INSERT OR IGNORE INTO cm_kv (k, v, at) VALUES ('indexnow', '{}', ?)").bind(stamp).run();
  if (!lock.meta || !lock.meta.changes) return;

  const res = await env.ASSETS.fetch(new Request(new URL("/sitemap.xml", request.url)));
  if (!res.ok) return;
  const xml = await res.text();
  const cur = {};
  const re = /<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g;
  let m;
  while ((m = re.exec(xml))) cur[m[1]] = m[2];
  const all = Object.keys(cur);
  if (!all.length) return;
  let prev = {};
  try { prev = JSON.parse((row && row.v) || "{}"); } catch (e) { prev = {}; }
  const changed = all.filter((u) => prev[u] !== cur[u]);
  if (!changed.length) return;
  const results = await submit(host, changed.slice(0, 1000));
  const ok = results.some((r) => r.status >= 200 && r.status < 300);
  if (ok) await db.prepare("UPDATE cm_kv SET v = ? WHERE k = 'indexnow'").bind(JSON.stringify(cur)).run();
  await db.prepare("INSERT OR REPLACE INTO cm_kv (k, v, at) VALUES ('indexnow_log', ?, ?)")
    .bind(JSON.stringify({ ok, count: changed.length, sample: changed.slice(0, 5), results }), stamp).run();
}

// 관리자 화면 표시용: 마지막 자동 전송 기록
export async function lastLog(db) {
  try {
    const r = await db.prepare("SELECT v, at FROM cm_kv WHERE k = 'indexnow_log'").first();
    if (!r) return null;
    const v = JSON.parse(r.v || "{}");
    return { at: r.at, ok: !!v.ok, count: v.count || 0, sample: v.sample || [], results: v.results || [] };
  } catch (e) { return null; }
}
