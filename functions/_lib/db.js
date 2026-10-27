// 상담 문의 저장소 — Cloudflare D1 (바인딩 이름: DB)
// 표는 처음 요청 때 자동으로 만들어집니다. 따로 SQL을 실행할 필요가 없습니다.

export const STATUS = ["new", "contacted", "meeting", "quoted", "won", "hold", "closed"];
export const STATUS_KO = { new: "새 문의", contacted: "연락 완료", meeting: "미팅·실측", quoted: "견적 발송", won: "계약", hold: "보류", closed: "종료" };

export const FIELDS = {
  type: 20, channel: 30, name: 40, phone: 40, email: 120, biz: 60, region: 80, area: 30, grade: 30, open: 60,
  budget: 40, stage: 60, note: 4000, page: 300, ref: 300, landing: 300, utm: 300
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT, status TEXT NOT NULL DEFAULT 'new',
    type TEXT, channel TEXT, name TEXT, phone TEXT, email TEXT, biz TEXT, region TEXT, area TEXT, grade TEXT,
    open TEXT, budget TEXT, stage TEXT, svc TEXT, note TEXT, page TEXT, ref TEXT, landing TEXT, utm TEXT,
    follow_up TEXT, quote TEXT, memo TEXT, ip_hash TEXT, ua TEXT, updated_by TEXT)`,
  "CREATE INDEX IF NOT EXISTS idx_inq_created ON inquiries(created_at)",
  "CREATE INDEX IF NOT EXISTS idx_inq_status ON inquiries(status)",
  "CREATE INDEX IF NOT EXISTS idx_inq_ip ON inquiries(ip_hash, created_at)",
  `CREATE TABLE IF NOT EXISTS inquiry_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, inquiry_id TEXT NOT NULL, at TEXT NOT NULL, by TEXT, kind TEXT, text TEXT)`,
  "CREATE INDEX IF NOT EXISTS idx_notes_inq ON inquiry_notes(inquiry_id)"
];

let ready = false;
export async function ensureSchema(db) {
  if (ready) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  ready = true;
}

export function newId() {
  const d = new Date();
  return d.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + Math.random().toString(36).slice(2, 7);
}

export function toItem(r) {
  if (!r) return null;
  let svc = [];
  try { svc = r.svc ? JSON.parse(r.svc) : []; } catch (e) { svc = []; }
  return {
    id: r.id, createdAt: r.created_at, updatedAt: r.updated_at, status: r.status, type: r.type || "", channel: r.channel || "",
    name: r.name || "", phone: r.phone || "", email: r.email || "", biz: r.biz || "", region: r.region || "", area: r.area || "",
    grade: r.grade || "", open: r.open || "", budget: r.budget || "", stage: r.stage || "", svc, note: r.note || "",
    page: r.page || "", ref: r.ref || "", landing: r.landing || "", utm: r.utm || "", followUp: r.follow_up || "",
    quote: r.quote || "", memo: r.memo || "", updatedBy: r.updated_by || ""
  };
}

export async function insertInquiry(db, item) {
  await db.prepare(
    `INSERT INTO inquiries (id, created_at, updated_at, status, type, channel, name, phone, email, biz, region, area, grade, open,
      budget, stage, svc, note, page, ref, landing, utm, follow_up, quote, memo, ip_hash, ua, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    item.id, item.createdAt, item.createdAt, item.status || "new", item.type || "", item.channel || "", item.name, item.phone,
    item.email || "", item.biz || "", item.region || "", item.area || "", item.grade || "", item.open || "", item.budget || "",
    item.stage || "", JSON.stringify(item.svc || []), item.note || "", item.page || "", item.ref || "", item.landing || "",
    item.utm || "", item.followUp || "", item.quote || "", item.memo || "", item.ipHash || "", item.ua || "", item.updatedBy || ""
  ).run();
}

export async function addNote(db, id, by, kind, text) {
  await db.prepare("INSERT INTO inquiry_notes (inquiry_id, at, by, kind, text) VALUES (?, ?, ?, ?, ?)")
    .bind(id, new Date().toISOString(), by || "", kind || "note", String(text || "").slice(0, 2000)).run();
}
