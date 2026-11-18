// /api/admin/members — 관리자 회원 관리 (D1)
// GET    목록(최신 가입순, 최대 5000명)
// POST   직접 등록 (전화·현장·행사에서 받은 가입)
// PATCH  상태(active · unsub)·메모·연락처 등 수정     { id, status, memo, name, email, phone, biz, stage, interests, marketing }
// DELETE 삭제(완전 파기)                               ?id=
import { json, clip, requireAdmin } from "../../_lib/util.js";
import { ensureSchema, newId, toMember, MEMBER_FIELDS, MEMBER_STATUS, MEMBER_STAGES, MEMBER_INTERESTS } from "../../_lib/db.js";

export async function onRequest(context) {
  const { request, env } = context;
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.res;
  const db = env.DB;
  if (!db) return json({ ok: false, reason: "not-configured" }, 503);
  await ensureSchema(db);
  const url = new URL(request.url);
  const one = async (id) => toMember(await db.prepare("SELECT * FROM cm_members WHERE id = ?").bind(id).first());

  if (request.method === "GET") {
    const rows = await db.prepare("SELECT * FROM cm_members ORDER BY created_at DESC LIMIT 5000").all();
    const items = (rows.results || []).map(toMember);
    return json({ ok: true, total: items.length, items, stages: MEMBER_STAGES, interests: MEMBER_INTERESTS });
  }

  let b = {};
  if (request.method === "POST" || request.method === "PATCH") {
    try { b = await request.json(); } catch (e) { return json({ ok: false, reason: "bad-json" }, 400); }
  }
  const interestsOf = (v) => (Array.isArray(v) ? v.filter((x) => MEMBER_INTERESTS.includes(x)).slice(0, 10) : []);

  if (request.method === "POST") {
    const m = {};
    Object.keys(MEMBER_FIELDS).forEach((k) => { m[k] = clip(b[k], MEMBER_FIELDS[k]).trim(); });
    m.email = m.email.toLowerCase();
    if (!m.name || (!m.email && !m.phone)) return json({ ok: false, reason: "required" }, 400);
    const id = newId(), now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO cm_members (id, created_at, updated_at, status, name, email, phone, biz, stage, interests, marketing, channel, src, memo, updated_by)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, '직접 등록', ?, ?)`
    ).bind(id, now, now, m.name, m.email, m.phone, m.biz, m.stage, JSON.stringify(interestsOf(b.interests)), b.marketing ? 1 : 0,
      m.channel || "직접 등록", clip(b.memo, 2000), auth.login).run();
    return json({ ok: true, item: await one(id) });
  }

  if (request.method === "PATCH") {
    const id = clip(b.id, 40);
    const cur = await db.prepare("SELECT id FROM cm_members WHERE id = ?").bind(id).first();
    if (!cur) return json({ ok: false, reason: "not-found" }, 404);
    const sets = [], vals = [];
    if (MEMBER_STATUS.includes(b.status)) { sets.push("status = ?"); vals.push(b.status); }
    if (typeof b.memo === "string") { sets.push("memo = ?"); vals.push(clip(b.memo, 2000)); }
    ["name", "email", "phone", "biz", "stage"].forEach((k) => {
      if (typeof b[k] === "string") { sets.push(k + " = ?"); vals.push(k === "email" ? clip(b[k], MEMBER_FIELDS[k]).trim().toLowerCase() : clip(b[k], MEMBER_FIELDS[k]).trim()); }
    });
    if (Array.isArray(b.interests)) { sets.push("interests = ?"); vals.push(JSON.stringify(interestsOf(b.interests))); }
    if (typeof b.marketing === "boolean") { sets.push("marketing = ?"); vals.push(b.marketing ? 1 : 0); }
    sets.push("updated_at = ?", "updated_by = ?"); vals.push(new Date().toISOString(), auth.login);
    await db.prepare("UPDATE cm_members SET " + sets.join(", ") + " WHERE id = ?").bind(...vals, id).run();
    return json({ ok: true, item: await one(id) });
  }

  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ ok: false, reason: "id" }, 400);
    await db.prepare("DELETE FROM cm_members WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }
  return json({ ok: false, reason: "method" }, 405);
}
