// GET /api/admin/status — 관리자 화면에서 서버 기능 연결 상태 확인
import { json, requireAdmin } from "../../_lib/util.js";
import { ensureSchema } from "../../_lib/db.js";
import { channels } from "../../_lib/notify.js";

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.res;
  const env = context.env;
  let db = false, dbError = "", total = null;
  if (env.DB) {
    try {
      await ensureSchema(env.DB);
      const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM cm_inquiries").first();
      db = true; total = r ? r.n : 0;
    } catch (e) { dbError = String(e).slice(0, 200); }
  }
  return json({
    ok: true, login: auth.login, db, dbError, total,
    notify: channels(env),
    notifyEmail: env.RESEND_API_KEY ? String(env.NOTIFY_EMAIL || "spaceblank0100@gmail.com") : "",
    turnstile: !!env.TURNSTILE_SECRET,
    indexnow: true
  });
}
