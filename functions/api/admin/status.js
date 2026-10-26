// GET /api/admin/status — 관리자 화면에서 서버 기능 연결 상태 확인
import { json, requireAdmin } from "../../_lib/util.js";

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.res;
  const env = context.env;
  return json({ ok: true, login: auth.login, kv: !!env.INQUIRIES, webhook: !!env.NOTIFY_WEBHOOK, indexnow: true });
}
