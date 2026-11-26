// POST /api/track — 홈페이지 방문 통계 수집 (코어무드 자체 수집)
// pv: 페이지 조회 · end: 체류 시간과 스크롤 깊이 갱신 · click: 버튼·링크 클릭 · lead: 상담 접수 · join: 회원 가입 · search: 사이트 내 검색어
// IP 주소, 이름, 연락처 같은 개인 정보는 받지도 저장하지도 않습니다.
import { clip } from "../_lib/util.js";
import { ensureSchema, kst } from "../_lib/db.js";
import { classifySource, hostOf, isBot } from "../_lib/source.js";
import { autoSubmit } from "../_lib/indexnow.js";

const TYPES = ["pv", "end", "click", "lead", "join", "search"];
const KINDS = ["tel", "kakao", "mail", "quick", "contact", "archive", "case", "out", "menu", "footer", "link", "button", "form"];
const ok = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return ok();
  // 사이트맵이 바뀌었으면(새 글 발행 등) 바뀐 주소를 검색엔진에 알립니다. 20분에 한 번만 확인합니다.
  context.waitUntil(autoSubmit(context).catch(() => {}));
  const ua = request.headers.get("user-agent") || "";
  if (isBot(ua)) return ok();
  const origin = request.headers.get("origin");
  const self = new URL(request.url);
  if (origin && origin !== self.origin) return new Response(null, { status: 403 });

  let raw = "";
  try { raw = await request.text(); } catch (e) { return ok(); }
  if (!raw || raw.length > 4000) return ok();
  let b;
  try { b = JSON.parse(raw); } catch (e) { return ok(); }
  const type = String(b.t || "");
  if (!TYPES.includes(type)) return ok();
  const id = (v) => clip(v, 24).replace(/[^a-z0-9]/gi, "");
  const vid = id(b.v), sid = id(b.s), pid = id(b.p);
  if (!vid || !sid || !pid) return ok();
  let path = clip(b.path, 200);
  if (!path.startsWith("/") || path.startsWith("/admin") || path.startsWith("/api")) return ok();
  path = path.replace(/\.html$/, "").replace(/\/index$/, "/") || "/";

  await ensureSchema(db);

  if (type === "end") {
    const dur = Math.max(0, Math.min(1800, parseInt(b.dur, 10) || 0));
    const depth = Math.max(0, Math.min(100, parseInt(b.depth, 10) || 0));
    await db.prepare("UPDATE cm_events SET dur = MAX(COALESCE(dur, 0), ?), depth = MAX(COALESCE(depth, 0), ?) WHERE pid = ? AND type = 'pv'")
      .bind(dur, depth, pid).run();
    return ok();
  }

  const now = new Date();
  const k = kst(now);
  const cf = request.cf || {};
  const dev = ["mobile", "tablet", "desktop"].includes(b.dev) ? b.dev : "desktop";
  const base = [now.toISOString(), k.day, k.hour, k.wd, type, vid, sid, pid, path];

  if (type === "pv") {
    const ref = clip(b.ref, 300);
    const utm = clip(b.utm, 200);
    const entry = b.entry ? 1 : 0;
    const src = entry ? classifySource(ref, utm, ua) : "";
    await db.prepare(
      `INSERT INTO cm_events (at, day, hour, wd, type, vid, sid, pid, path, title, entry, fresh, src, ref, utm, dev, country, region)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(...base, clip(b.title, 120), entry, b.fresh ? 1 : 0, src, entry && ref ? (hostOf(ref) + clip(ref.replace(/^https?:\/\/[^/]+/, ""), 120)).slice(0, 200) : "",
      entry ? utm : "", dev, clip(cf.country || "", 4), clip(cf.region || "", 60)).run();
    // 1년이 넘은 기록은 가끔 정리합니다
    if (Math.random() < 0.004) {
      const old = kst(Date.now() - 400 * 86400000).day;
      context.waitUntil(db.prepare("DELETE FROM cm_events WHERE day < ?").bind(old).run().catch(() => {}));
    }
    return ok();
  }

  const kind = type === "click" ? (KINDS.includes(b.kind) ? b.kind : "link") : clip(b.kind, 30);
  // 검색어: 짧은 낱말만 받고, 전화번호나 메일 주소처럼 보이는 입력은 저장하지 않습니다
  if (type === "search") {
    const term = clip(b.label, 40);
    if (term.length < 2 || /\d{7,}|@/.test(term)) return ok();
  }
  await db.prepare(
    `INSERT INTO cm_events (at, day, hour, wd, type, vid, sid, pid, path, kind, label, dev, country, region)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(...base, kind, clip(b.label, 80), dev, clip(cf.country || "", 4), clip(cf.region || "", 60)).run();
  return ok();
}

export async function onRequestGet() {
  return new Response(null, { status: 405 });
}
