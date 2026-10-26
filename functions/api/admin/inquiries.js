// /api/admin/inquiries — 관리자 상담 문의 관리
// GET    목록(최신순)          ?cursor=
// PATCH  상태·메모 변경         { id, status, memo }
// DELETE 삭제                   ?id=
import { json, clip, requireAdmin } from "../../_lib/util.js";

const STATUS = ["new", "contacted", "meeting", "quoted", "won", "hold", "closed"];

export async function onRequest(context) {
  const { request, env } = context;
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.res;
  const kv = env.INQUIRIES;
  if (!kv) return json({ ok: false, reason: "not-configured" }, 503);
  const url = new URL(request.url);

  if (request.method === "GET") {
    const id = url.searchParams.get("id");
    if (id) {
      const v = await kv.get("inq:" + id);
      return v ? json({ ok: true, item: JSON.parse(v) }) : json({ ok: false, reason: "not-found" }, 404);
    }
    const items = [];
    let cursor;
    do {
      const page = await kv.list({ prefix: "inq:", cursor, limit: 1000 });
      page.keys.forEach((k) => items.push(Object.assign({ id: k.name.slice(4) }, k.metadata || {})));
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor && items.length < 5000);
    items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const full = url.searchParams.get("full") === "1";
    if (full) {
      const top = items.slice(0, 300);
      const vals = await Promise.all(top.map((x) => kv.get("inq:" + x.id)));
      return json({ ok: true, total: items.length, items: vals.filter(Boolean).map((v) => JSON.parse(v)) });
    }
    return json({ ok: true, total: items.length, items });
  }

  if (request.method === "PATCH") {
    let b;
    try { b = await request.json(); } catch (e) { return json({ ok: false, reason: "bad-json" }, 400); }
    const v = await kv.get("inq:" + b.id);
    if (!v) return json({ ok: false, reason: "not-found" }, 404);
    const rec = JSON.parse(v);
    if (b.status && STATUS.includes(b.status)) rec.status = b.status;
    if (typeof b.memo === "string") rec.memo = clip(b.memo, 4000);
    rec.updatedAt = new Date().toISOString();
    rec.updatedBy = auth.login;
    await kv.put("inq:" + rec.id, JSON.stringify(rec), { metadata: { name: rec.name, biz: rec.biz, status: rec.status, createdAt: rec.createdAt } });
    return json({ ok: true, item: rec });
  }

  if (request.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ ok: false, reason: "id" }, 400);
    await kv.delete("inq:" + id);
    return json({ ok: true });
  }
  return json({ ok: false, reason: "method" }, 405);
}
