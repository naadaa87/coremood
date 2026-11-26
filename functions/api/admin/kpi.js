// GET /api/admin/kpi?from=YYYY-MM-DD&to=YYYY-MM-DD — 관리자 KPI 지표 (한국 시간 기준 날짜)
// 방문 통계(cm_events), 상담 문의(cm_inquiries), 회원(cm_members)을 한 번에 모아 돌려줍니다.
// 비교 기간은 같은 길이의 바로 앞 기간입니다.
import { json, requireAdmin } from "../../_lib/util.js";
import { ensureSchema, kst } from "../../_lib/db.js";
import { SEARCH_SOURCES, AI_SOURCES } from "../../_lib/source.js";

const FIND = SEARCH_SOURCES.concat(AI_SOURCES); // 검색엔진과 AI 검색으로 들어온 방문
const CONTACT = "('tel','kakao','mail','quick','contact')";
const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
const addDays = (day, n) => new Date(Date.parse(day + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const utcStart = (day) => new Date(day + "T00:00:00+09:00").toISOString();
const utcEnd = (day) => new Date(Date.parse(day + "T00:00:00+09:00") + 86400000 - 1).toISOString();

export async function onRequestGet(context) {
  const auth = await requireAdmin(context);
  if (!auth.ok) return auth.res;
  const db = context.env.DB;
  if (!db) return json({ ok: false, reason: "not-configured" }, 503);
  await ensureSchema(db);

  const url = new URL(context.request.url);
  const today = kst().day;
  let to = isDay(url.searchParams.get("to")) ? url.searchParams.get("to") : today;
  let from = isDay(url.searchParams.get("from")) ? url.searchParams.get("from") : addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  let span = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (span > 400) { from = addDays(to, -399); span = 400; }
  const pTo = addDays(from, -1), pFrom = addDays(pTo, -(span - 1));

  const PV = "type = 'pv' AND day BETWEEN ? AND ?";
  const CL = "type = 'click' AND day BETWEEN ? AND ?";
  const q = (sql, ...args) => db.prepare(sql).bind(...args);
  const totals = (a, b) => q(`SELECT COUNT(*) AS pv, COUNT(DISTINCT vid) AS uv, COUNT(DISTINCT sid) AS ses, COUNT(DISTINCT CASE WHEN fresh = 1 THEN vid END) AS nv FROM cm_events WHERE ${PV}`, a, b);
  const sess = (a, b) => q(`SELECT COUNT(*) AS n, SUM(CASE WHEN c = 1 THEN 1 ELSE 0 END) AS bounce, AVG(c) AS ppv, AVG(d) AS dwell
    FROM (SELECT sid, COUNT(*) AS c, SUM(dur) AS d FROM cm_events WHERE ${PV} GROUP BY sid)`, a, b);
  const contact = (a, b) => q(`SELECT COUNT(*) AS n FROM cm_events WHERE ${CL} AND kind IN ${CONTACT}`, a, b);

  const stmts = {
    cur: totals(from, to), prev: totals(pFrom, pTo),
    sCur: sess(from, to), sPrev: sess(pFrom, pTo),
    cCur: contact(from, to), cPrev: contact(pFrom, pTo),
    clickKinds: q(`SELECT kind, COUNT(*) AS n FROM cm_events WHERE ${CL} GROUP BY kind ORDER BY n DESC`, from, to),
    daily: q(`SELECT day, COUNT(*) AS pv, COUNT(DISTINCT vid) AS uv, COUNT(DISTINCT sid) AS ses FROM cm_events WHERE ${PV} GROUP BY day`, from, to),
    dailyContact: q(`SELECT day, COUNT(*) AS n FROM cm_events WHERE ${CL} AND kind IN ${CONTACT} GROUP BY day`, from, to),
    pages: q(`SELECT path, MAX(title) AS title, COUNT(*) AS pv, COUNT(DISTINCT vid) AS uv, AVG(dur) AS dur, AVG(depth) AS depth, SUM(entry) AS ent
      FROM cm_events WHERE ${PV} GROUP BY path ORDER BY pv DESC LIMIT 80`, from, to),
    pageContact: q(`SELECT path, COUNT(*) AS n FROM cm_events WHERE ${CL} AND kind IN ${CONTACT} GROUP BY path`, from, to),
    sources: q(`SELECT src, COUNT(*) AS n, COUNT(DISTINCT vid) AS uv FROM cm_events WHERE ${PV} AND entry = 1 GROUP BY src ORDER BY n DESC LIMIT 15`, from, to),
    landing: q(`SELECT path, MAX(title) AS title, COUNT(*) AS n FROM cm_events WHERE ${PV} AND entry = 1 GROUP BY path ORDER BY n DESC LIMIT 10`, from, to),
    campaigns: q(`SELECT utm, COUNT(*) AS n FROM cm_events WHERE ${PV} AND entry = 1 AND utm <> '' GROUP BY utm ORDER BY n DESC LIMIT 10`, from, to),
    devices: q(`SELECT dev, COUNT(DISTINCT sid) AS n FROM cm_events WHERE ${PV} GROUP BY dev ORDER BY n DESC`, from, to),
    regions: q(`SELECT country, region, COUNT(DISTINCT sid) AS n FROM cm_events WHERE ${PV} GROUP BY country, region ORDER BY n DESC LIMIT 12`, from, to),
    hours: q(`SELECT hour, COUNT(*) AS n FROM cm_events WHERE ${PV} GROUP BY hour`, from, to),
    weekdays: q(`SELECT wd, COUNT(*) AS n FROM cm_events WHERE ${PV} GROUP BY wd`, from, to),
    topClicks: q(`SELECT kind, label, COUNT(*) AS n FROM cm_events WHERE ${CL} GROUP BY kind, label ORDER BY n DESC LIMIT 25`, from, to),
    searches: q("SELECT label, COUNT(*) AS n, SUM(CASE WHEN kind = '0' THEN 1 ELSE 0 END) AS zero FROM cm_events WHERE type = 'search' AND day BETWEEN ? AND ? GROUP BY label ORDER BY n DESC LIMIT 20", from, to),
    findSrc: q(`SELECT src, COUNT(*) AS n FROM cm_events WHERE ${PV} AND entry = 1 AND src IN (${FIND.map(() => "?").join(",")}) GROUP BY src ORDER BY n DESC`, from, to, ...FIND),
    findLanding: q(`SELECT path, MAX(title) AS title, COUNT(*) AS n FROM cm_events WHERE ${PV} AND entry = 1 AND src IN (${FIND.map(() => "?").join(",")}) GROUP BY path ORDER BY n DESC LIMIT 10`, from, to, ...FIND),
    archive: q(`SELECT label, COUNT(*) AS n FROM cm_events WHERE ${CL} AND kind = 'archive' GROUP BY label ORDER BY n DESC LIMIT 10`, from, to),
    live: q("SELECT COUNT(DISTINCT sid) AS n FROM cm_events WHERE at > ?", new Date(Date.now() - 5 * 60000).toISOString()),
    first: q("SELECT MIN(day) AS day FROM cm_events WHERE type = 'pv'"),
    inq: q("SELECT created_at, status, type, biz, channel FROM cm_inquiries WHERE created_at BETWEEN ? AND ?", utcStart(from), utcEnd(to)),
    inqPrev: q("SELECT COUNT(*) AS n, SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won FROM cm_inquiries WHERE created_at BETWEEN ? AND ?", utcStart(pFrom), utcEnd(pTo)),
    memAll: q("SELECT COUNT(*) AS n, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN status = 'active' AND marketing = 1 THEN 1 ELSE 0 END) AS mk FROM cm_members"),
    mem: q("SELECT created_at, biz, stage, interests, src FROM cm_members WHERE created_at BETWEEN ? AND ?", utcStart(from), utcEnd(to)),
    memPrev: q("SELECT COUNT(*) AS n FROM cm_members WHERE created_at BETWEEN ? AND ?", utcStart(pFrom), utcEnd(pTo)),
    memRecent: q("SELECT id, created_at, name, biz, stage, status FROM cm_members ORDER BY created_at DESC LIMIT 6")
  };
  const keys = Object.keys(stmts);
  const res = await db.batch(keys.map((k) => stmts[k]));
  const R = {};
  keys.forEach((k, i) => { R[k] = (res[i] && res[i].results) || []; });
  const one = (k) => R[k][0] || {};

  const dayOf = (iso) => kst(iso).day;
  const inq = R.inq.map((x) => ({ day: dayOf(x.created_at), status: x.status, type: x.type || "", biz: x.biz || "", channel: x.channel || "" }));
  const mem = R.mem.map((x) => {
    let interests = [];
    try { interests = JSON.parse(x.interests || "[]"); } catch (e) { interests = []; }
    return { day: dayOf(x.created_at), biz: x.biz || "", stage: x.stage || "", interests, src: x.src || "" };
  });

  return json({
    ok: true, from, to, prevFrom: pFrom, prevTo: pTo, days: span, today, since: one("first").day || "",
    live: one("live").n || 0,
    visits: { cur: one("cur"), prev: one("prev"), sess: one("sCur"), sessPrev: one("sPrev") },
    contact: { cur: one("cCur").n || 0, prev: one("cPrev").n || 0, kinds: R.clickKinds },
    daily: R.daily, dailyContact: R.dailyContact,
    pages: R.pages, pageContact: R.pageContact,
    sources: R.sources, landing: R.landing, campaigns: R.campaigns,
    devices: R.devices, regions: R.regions, hours: R.hours, weekdays: R.weekdays,
    topClicks: R.topClicks, archive: R.archive,
    searches: R.searches, find: { sources: R.findSrc, landing: R.findLanding, ai: AI_SOURCES },
    inquiries: { items: inq, prev: one("inqPrev").n || 0, prevWon: one("inqPrev").won || 0 },
    members: { total: one("memAll").n || 0, active: one("memAll").active || 0, marketing: one("memAll").mk || 0, items: mem, prev: one("memPrev").n || 0, recent: R.memRecent }
  });
}
