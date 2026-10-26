// POST /api/inquiry — 홈페이지 상담 신청 접수
// KV 바인딩(INQUIRIES)이 없으면 503을 돌려주고, 화면에서는 메일 앱으로 대신 보냅니다.
import { json, clip } from "../_lib/util.js";

const FIELDS = { name: 40, phone: 40, email: 120, biz: 60, region: 80, area: 30, grade: 30, open: 60, budget: 40, stage: 60, note: 4000, page: 300, ref: 300 };
const STATUS = ["new", "contacted", "meeting", "quoted", "won", "hold", "closed"];

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.INQUIRIES;
  if (!kv) return json({ ok: false, reason: "not-configured" }, 503);

  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, reason: "bad-json" }, 400); }
  if (body.hp) return json({ ok: true }); // 스팸 봇(숨김 칸 입력)
  const item = {};
  Object.keys(FIELDS).forEach((k) => { item[k] = clip(body[k], FIELDS[k]).trim(); });
  item.svc = Array.isArray(body.svc) ? body.svc.slice(0, 10).map((x) => clip(x, 40)) : [];
  if (!item.name || !item.phone) return json({ ok: false, reason: "required" }, 400);
  if (!/[0-9]{3,}/.test(item.phone.replace(/[^0-9]/g, ""))) return json({ ok: false, reason: "phone" }, 400);

  // 같은 IP에서 10분에 6건 이상은 막습니다
  const ip = request.headers.get("cf-connecting-ip") || "0";
  const rlKey = "rl:" + ip;
  const n = parseInt((await kv.get(rlKey)) || "0", 10);
  if (n >= 6) return json({ ok: false, reason: "too-many" }, 429);
  await kv.put(rlKey, String(n + 1), { expirationTtl: 600 });

  const now = new Date();
  const id = now.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + Math.random().toString(36).slice(2, 7);
  const record = Object.assign(item, { id, createdAt: now.toISOString(), status: STATUS[0], memo: "", ua: clip(request.headers.get("user-agent"), 200) });
  await kv.put("inq:" + id, JSON.stringify(record), { metadata: { name: item.name, biz: item.biz, status: record.status, createdAt: record.createdAt } });

  // 선택: 알림 웹훅 (슬랙·디스코드 등). Cloudflare 환경 변수 NOTIFY_WEBHOOK 에 주소를 넣으면 동작합니다.
  if (env.NOTIFY_WEBHOOK) {
    const text = `[코어무드 상담 신청] ${item.name} · ${item.phone} · ${item.biz || "업종 미기재"} · ${item.region || "지역 미기재"}\n${item.note.slice(0, 300)}`;
    context.waitUntil(fetch(env.NOTIFY_WEBHOOK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, content: text }) }).catch(() => {}));
  }
  return json({ ok: true, id });
}

export async function onRequestGet() {
  return json({ ok: false, reason: "method" }, 405);
}
