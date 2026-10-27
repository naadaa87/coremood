// 공통 유틸 — Cloudflare Pages Functions
export const REPO_DEFAULT = "naadaa87/coremood";

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, extra)
  });
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function clip(v, n) {
  return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").slice(0, n);
}

// 관리자 인증: 이 저장소에 쓰기 권한이 있는 GitHub 토큰인지 GitHub에 직접 확인합니다.
// 결과는 D1(cm_auth_cache)에 10분간 보관해 매 요청마다 GitHub를 부르지 않습니다.
export async function requireAdmin(context) {
  const { request, env } = context;
  const h = request.headers.get("authorization") || "";
  const token = h.replace(/^(Bearer|token)\s+/i, "").trim();
  if (!token || token.length < 20) return { ok: false, res: json({ ok: false, error: "unauthorized" }, 401) };
  const repo = env.REPO || REPO_DEFAULT;
  const key = await sha256(token + "|" + repo);
  const db = env.DB;
  const now = Date.now();
  if (db) {
    try {
      await db.prepare("CREATE TABLE IF NOT EXISTS cm_auth_cache (k TEXT PRIMARY KEY, login TEXT, exp INTEGER)").run();
      const hit = await db.prepare("SELECT login FROM cm_auth_cache WHERE k = ? AND exp > ?").bind(key, now).first();
      if (hit) return { ok: true, login: hit.login };
    } catch (e) { /* 캐시 실패는 무시 */ }
  }
  const r = await fetch((env.GITHUB_API || "https://api.github.com") + "/repos/" + repo, {
    headers: { authorization: "Bearer " + token, "user-agent": "coremood-admin", accept: "application/vnd.github+json" }
  });
  if (!r.ok) return { ok: false, res: json({ ok: false, error: "github-" + r.status }, 401) };
  const data = await r.json();
  if (!data.permissions || !(data.permissions.push || data.permissions.admin || data.permissions.maintain)) {
    return { ok: false, res: json({ ok: false, error: "no-push-permission" }, 403) };
  }
  const login = (data.owner && data.owner.login) || "admin";
  if (db) {
    try {
      await db.prepare("INSERT OR REPLACE INTO cm_auth_cache (k, login, exp) VALUES (?, ?, ?)").bind(key, login, now + 600000).run();
      await db.prepare("DELETE FROM cm_auth_cache WHERE exp < ?").bind(now).run();
    } catch (e) { /* 무시 */ }
  }
  return { ok: true, login };
}
