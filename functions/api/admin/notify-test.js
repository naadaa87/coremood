// POST /api/admin/notify-test — 설정한 알림 채널로 시험 메시지를 보냅니다
import { json, requireAdmin } from "../../_lib/util.js";
import { notify, channels } from "../../_lib/notify.js";

export async function onRequestPost(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.res;
  const ch = channels(context.env);
  if (!ch.email && !ch.telegram && !ch.webhook) return json({ ok: false, reason: "no-channel" }, 400);
  const site = new URL(context.request.url).origin;
  const results = await notify(context.env, {
    type: "알림 시험", name: "시험 발송", phone: "010-0000-0000", biz: "카페 · 베이커리", region: "서울",
    note: "관리자 화면에서 보낸 시험 알림입니다. 이 메시지가 보이면 새 문의 알림이 정상입니다."
  }, site);
  return json({ ok: results.some((r) => r.ok), results });
}
