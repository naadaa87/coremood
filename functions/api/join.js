// POST /api/join — 회원 가입 (소식 받기 회원 · 비밀번호 없이 이름과 연락처로 가입)
// 같은 이메일이나 연락처로 다시 가입하면 새로 만들지 않고 기존 정보를 고칩니다.
import { json, clip, sha256 } from "../_lib/util.js";
import { ensureSchema, newId, MEMBER_FIELDS, MEMBER_STAGES as STAGES, MEMBER_INTERESTS as INTERESTS } from "../_lib/db.js";
import { classifySource } from "../_lib/source.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ ok: false, reason: "not-configured" }, 503);

  let b;
  try { b = await request.json(); } catch (e) { return json({ ok: false, reason: "bad-json" }, 400); }
  if (b.hp) return json({ ok: true }); // 숨김 칸을 채운 스팸 봇
  const ip = request.headers.get("cf-connecting-ip") || "0";

  if (env.TURNSTILE_SECRET) {
    const token = clip(b.cf_token, 2048);
    if (!token) return json({ ok: false, reason: "captcha" }, 400);
    const fd = new FormData();
    fd.append("secret", env.TURNSTILE_SECRET); fd.append("response", token); fd.append("remoteip", ip);
    const v = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: fd }).then((r) => r.json()).catch(() => ({ success: false }));
    if (!v.success) return json({ ok: false, reason: "captcha" }, 400);
  }

  const m = {};
  Object.keys(MEMBER_FIELDS).forEach((k) => { m[k] = clip(b[k], MEMBER_FIELDS[k]).trim(); });
  m.email = m.email.toLowerCase();
  if (!b.agree) return json({ ok: false, reason: "agree" }, 400);
  if (!m.name || (!m.email && !m.phone)) return json({ ok: false, reason: "required" }, 400);
  if (m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) return json({ ok: false, reason: "email" }, 400);
  if (m.phone && m.phone.replace(/[^0-9]/g, "").length < 8) return json({ ok: false, reason: "phone" }, 400);
  if (m.stage && !STAGES.includes(m.stage)) m.stage = "기타";
  const interests = Array.isArray(b.interests) ? b.interests.filter((x) => INTERESTS.includes(x)).slice(0, 10) : [];
  const marketing = b.marketing ? 1 : 0;

  await ensureSchema(db);
  const ipHash = (await sha256(ip + "|coremood")).slice(0, 24);
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM cm_members WHERE ip_hash = ? AND updated_at > ?").bind(ipHash, since).first();
  if (recent && recent.n >= 5) return json({ ok: false, reason: "too-many" }, 429);

  const now = new Date().toISOString();
  const digits = m.phone.replace(/[^0-9]/g, "");
  let found = null;
  if (m.email) found = await db.prepare("SELECT id FROM cm_members WHERE email = ? LIMIT 1").bind(m.email).first();
  if (!found && digits) found = await db.prepare("SELECT id FROM cm_members WHERE REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '.', '') = ? LIMIT 1").bind(digits).first();

  if (found) {
    await db.prepare(
      `UPDATE cm_members SET updated_at = ?, status = 'active', name = ?, email = COALESCE(NULLIF(?, ''), email), phone = COALESCE(NULLIF(?, ''), phone),
       biz = COALESCE(NULLIF(?, ''), biz), stage = COALESCE(NULLIF(?, ''), stage), interests = CASE WHEN ? = '[]' THEN interests ELSE ? END, marketing = ?, ip_hash = ?, updated_by = '' WHERE id = ?`
    ).bind(now, m.name, m.email, m.phone, m.biz, m.stage, JSON.stringify(interests), JSON.stringify(interests), marketing, ipHash, found.id).run();
    return json({ ok: true, again: true });
  }

  await db.prepare(
    `INSERT INTO cm_members (id, created_at, updated_at, status, name, email, phone, biz, stage, interests, marketing, channel, src, landing, ref, utm, page, memo, ip_hash, updated_by)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, '홈페이지', ?, ?, ?, ?, ?, '', ?, '')`
  ).bind(newId(), now, now, m.name, m.email, m.phone, m.biz, m.stage, JSON.stringify(interests), marketing,
    classifySource(m.ref, m.utm, request.headers.get("user-agent") || ""), m.landing, m.ref, m.utm, m.page, ipHash).run();
  return json({ ok: true });
}

export async function onRequestGet() {
  return json({ ok: false, reason: "method" }, 405);
}
