// POST /api/inquiry — 홈페이지 상담 신청·빠른 문의 접수
// D1 바인딩(DB)이 없으면 503을 돌려주고, 화면에서는 방문자의 메일 앱으로 대신 보냅니다.
import { json, clip, sha256 } from "../_lib/util.js";
import { ensureSchema, insertInquiry, newId, FIELDS } from "../_lib/db.js";
import { notify } from "../_lib/notify.js";

const TYPES = ["상담 신청", "빠른 문의", "견적 문의"];

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ ok: false, reason: "not-configured" }, 503);

  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, reason: "bad-json" }, 400); }
  if (body.hp) return json({ ok: true }); // 숨김 칸을 채운 스팸 봇

  const ip = request.headers.get("cf-connecting-ip") || "0";

  // 자동 입력 방지 (Turnstile) — 비밀 키를 설정한 경우에만 검사합니다
  if (env.TURNSTILE_SECRET) {
    const token = clip(body.cf_token, 2048);
    if (!token) return json({ ok: false, reason: "captcha" }, 400);
    const fd = new FormData();
    fd.append("secret", env.TURNSTILE_SECRET); fd.append("response", token); fd.append("remoteip", ip);
    const v = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: fd }).then((r) => r.json()).catch(() => ({ success: false }));
    if (!v.success) return json({ ok: false, reason: "captcha" }, 400);
  }

  const item = {};
  Object.keys(FIELDS).forEach((k) => { item[k] = clip(body[k], FIELDS[k]).trim(); });
  item.svc = Array.isArray(body.svc) ? body.svc.slice(0, 10).map((x) => clip(x, 40)) : [];
  if (!TYPES.includes(item.type)) item.type = "상담 신청";
  item.channel = "홈페이지";
  if (!item.name || !item.phone) return json({ ok: false, reason: "required" }, 400);
  if (item.phone.replace(/[^0-9]/g, "").length < 8) return json({ ok: false, reason: "required" }, 400);

  await ensureSchema(db);

  // 같은 곳에서 10분 안에 5건 이상은 막습니다
  item.ipHash = (await sha256(ip + "|coremood")).slice(0, 24);
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM cm_inquiries WHERE ip_hash = ? AND created_at > ?").bind(item.ipHash, since).first();
  if (recent && recent.n >= 5) return json({ ok: false, reason: "too-many" }, 429);

  item.id = newId();
  item.createdAt = new Date().toISOString();
  item.status = "new";
  item.ua = clip(request.headers.get("user-agent"), 200);
  await insertInquiry(db, item);

  const site = new URL(request.url).origin;
  context.waitUntil(notify(env, item, site).catch(() => {}));
  return json({ ok: true, id: item.id });
}

export async function onRequestGet() {
  return json({ ok: false, reason: "method" }, 405);
}
