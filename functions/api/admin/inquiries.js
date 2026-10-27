// /api/admin/inquiries — 관리자 상담 문의 관리 (D1)
// GET    목록(최신순, 최대 2000건)       ?id= 로 한 건 + 상담 기록
// POST   직접 등록 (전화·카카오톡·소개 등)
// PATCH  상태·다음 연락일·견적 메모·메모 변경, 상담 기록 추가   { id, status, followUp, quote, memo, note }
// DELETE 삭제                                                  ?id=
import { json, clip, requireAdmin } from "../../_lib/util.js";
import { ensureSchema, insertInquiry, newId, toItem, addNote, FIELDS, STATUS, STATUS_KO } from "../../_lib/db.js";

export async function onRequest(context) {
  const { request, env } = context;
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.res;
  const db = env.DB;
  if (!db) return json({ ok: false, reason: "not-configured" }, 503);
  await ensureSchema(db);
  const url = new URL(request.url);

  if (request.method === "GET") {
    const id = url.searchParams.get("id");
    if (id) {
      const row = await db.prepare("SELECT * FROM cm_inquiries WHERE id = ?").bind(id).first();
      if (!row) return json({ ok: false, reason: "not-found" }, 404);
      const notes = await db.prepare("SELECT at, by, kind, text FROM cm_inquiry_notes WHERE inquiry_id = ? ORDER BY id DESC").bind(id).all();
      return json({ ok: true, item: toItem(row), notes: notes.results || [] });
    }
    const rows = await db.prepare("SELECT * FROM cm_inquiries ORDER BY created_at DESC LIMIT 2000").all();
    const items = (rows.results || []).map(toItem);
    return json({ ok: true, total: items.length, items });
  }

  let b = {};
  if (request.method === "POST" || request.method === "PATCH") {
    try { b = await request.json(); } catch (e) { return json({ ok: false, reason: "bad-json" }, 400); }
  }

  if (request.method === "POST") {
    const item = {};
    Object.keys(FIELDS).forEach((k) => { item[k] = clip(b[k], FIELDS[k]).trim(); });
    item.svc = Array.isArray(b.svc) ? b.svc.slice(0, 10).map((x) => clip(x, 40)) : [];
    if (!item.name && !item.phone) return json({ ok: false, reason: "required" }, 400);
    item.type = "직접 등록";
    item.channel = item.channel || "전화";
    item.id = newId();
    item.createdAt = b.createdAt && !isNaN(new Date(b.createdAt)) ? new Date(b.createdAt).toISOString() : new Date().toISOString();
    item.status = STATUS.includes(b.status) ? b.status : "contacted";
    item.followUp = clip(b.followUp, 10);
    item.quote = clip(b.quote, 100);
    item.memo = clip(b.memo, 4000);
    item.updatedBy = auth.login;
    await insertInquiry(db, item);
    await addNote(db, item.id, auth.login, "system", "직접 등록 (" + item.channel + ")");
    const row = await db.prepare("SELECT * FROM cm_inquiries WHERE id = ?").bind(item.id).first();
    return json({ ok: true, item: toItem(row) });
  }

  if (request.method === "PATCH") {
    const row = await db.prepare("SELECT * FROM cm_inquiries WHERE id = ?").bind(clip(b.id, 40)).first();
    if (!row) return json({ ok: false, reason: "not-found" }, 404);
    const sets = [], vals = [];
    if (b.status && STATUS.includes(b.status) && b.status !== row.status) {
      sets.push("status = ?"); vals.push(b.status);
      await addNote(db, row.id, auth.login, "status", (STATUS_KO[row.status] || row.status) + " → " + STATUS_KO[b.status]);
    }
    if (typeof b.followUp === "string") { sets.push("follow_up = ?"); vals.push(clip(b.followUp, 10)); }
    if (typeof b.quote === "string") { sets.push("quote = ?"); vals.push(clip(b.quote, 100)); }
    if (typeof b.memo === "string") { sets.push("memo = ?"); vals.push(clip(b.memo, 4000)); }
    ["name", "phone", "email", "biz", "region", "area"].forEach((k) => {
      if (typeof b[k] === "string") { sets.push(k + " = ?"); vals.push(clip(b[k], FIELDS[k])); }
    });
    if (typeof b.note === "string" && b.note.trim()) await addNote(db, row.id, auth.login, "note", b.note.trim());
    sets.push("updated_at = ?", "updated_by = ?"); vals.push(new Date().toISOString(), auth.login);
    await db.prepare("UPDATE cm_inquiries SET " + sets.join(", ") + " WHERE id = ?").bind(...vals, row.id).run();
    const fresh = await db.prepare("SELECT * FROM cm_inquiries WHERE id = ?").bind(row.id).first();
    const notes = await db.prepare("SELECT at, by, kind, text FROM cm_inquiry_notes WHERE inquiry_id = ? ORDER BY id DESC").bind(row.id).all();
    return json({ ok: true, item: toItem(fresh), notes: notes.results || [] });
  }

  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ ok: false, reason: "id" }, 400);
    await db.batch([
      db.prepare("DELETE FROM cm_inquiry_notes WHERE inquiry_id = ?").bind(id),
      db.prepare("DELETE FROM cm_inquiries WHERE id = ?").bind(id)
    ]);
    return json({ ok: true });
  }
  return json({ ok: false, reason: "method" }, 405);
}
