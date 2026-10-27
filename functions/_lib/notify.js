// 새 문의 알림 — 설정한 채널로만 보냅니다 (모두 선택 사항)
//  · 이메일 : RESEND_API_KEY (+ NOTIFY_EMAIL, NOTIFY_FROM)
//  · 텔레그램: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
//  · 웹훅   : NOTIFY_WEBHOOK (슬랙·디스코드·구글챗)

export function channels(env) {
  return {
    email: !!env.RESEND_API_KEY,
    telegram: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
    webhook: !!env.NOTIFY_WEBHOOK
  };
}

function lines(item, site) {
  const L = [
    `[코어무드 ${item.type || "상담 신청"}] ${item.name} · ${item.phone}`,
    item.biz ? `업종: ${item.biz}` : "",
    item.region ? `지역: ${item.region}` : "",
    item.area ? `면적: ${item.area}평` : "",
    item.open ? `오픈 시기: ${item.open}` : "",
    item.budget ? `예산: ${item.budget}` : "",
    item.email ? `이메일: ${item.email}` : "",
    item.note ? `\n${item.note.slice(0, 600)}` : "",
    `\n관리자에서 보기: ${site}/admin/#/inquiries`
  ];
  return L.filter(Boolean).join("\n");
}

export async function notify(env, item, site) {
  const text = lines(item, site);
  const jobs = [];
  if (env.RESEND_API_KEY) {
    jobs.push(fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        from: env.NOTIFY_FROM || "코어무드 홈페이지 <onboarding@resend.dev>",
        to: String(env.NOTIFY_EMAIL || "spaceblank0100@gmail.com").split(",").map((s) => s.trim()).filter(Boolean),
        subject: `[코어무드 ${item.type || "상담 신청"}] ${item.name} · ${item.biz || "공간 문의"}`,
        text,
        reply_to: item.email || undefined
      })
    }).then(async (r) => ({ ch: "email", ok: r.ok, status: r.status, detail: r.ok ? "" : (await r.text()).slice(0, 200) })));
  }
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    jobs.push(fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true })
    }).then(async (r) => ({ ch: "telegram", ok: r.ok, status: r.status, detail: r.ok ? "" : (await r.text()).slice(0, 200) })));
  }
  if (env.NOTIFY_WEBHOOK) {
    const u = env.NOTIFY_WEBHOOK;
    const body = /discord(app)?\.com/.test(u) ? { content: text } : { text };
    jobs.push(fetch(u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then(async (r) => ({ ch: "webhook", ok: r.ok, status: r.status, detail: r.ok ? "" : (await r.text()).slice(0, 200) })));
  }
  const res = await Promise.all(jobs.map((j) => j.catch((e) => ({ ok: false, status: 0, detail: String(e) }))));
  return res;
}
