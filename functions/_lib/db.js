// 상담 문의 저장소 — Cloudflare D1 (바인딩 이름: DB)
// 표는 처음 요청 때 자동으로 만들어집니다. 따로 SQL을 실행할 필요가 없습니다.
// 표 이름에 cm_ 를 붙여 두어, 다른 사이트가 쓰는 D1 데이터베이스를 함께 연결해도 서로 겹치지 않습니다.
// 표: cm_inquiries(상담 문의) · cm_inquiry_notes(상담 기록) · cm_auth_cache(관리자 확인) · cm_events(방문 통계) · cm_members(회원)

export const STATUS = ["new", "contacted", "meeting", "quoted", "won", "hold", "closed"];
export const STATUS_KO = { new: "새 문의", contacted: "연락 완료", meeting: "미팅·실측", quoted: "견적 발송", won: "계약", hold: "보류", closed: "종료" };

export const FIELDS = {
  type: 20, channel: 30, name: 40, phone: 40, email: 120, biz: 60, region: 80, area: 30, grade: 30, open: 60,
  budget: 40, stage: 60, note: 4000, page: 300, ref: 300, landing: 300, utm: 300
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS cm_inquiries (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT, status TEXT NOT NULL DEFAULT 'new',
    type TEXT, channel TEXT, name TEXT, phone TEXT, email TEXT, biz TEXT, region TEXT, area TEXT, grade TEXT,
    open TEXT, budget TEXT, stage TEXT, svc TEXT, note TEXT, page TEXT, ref TEXT, landing TEXT, utm TEXT,
    follow_up TEXT, quote TEXT, memo TEXT, ip_hash TEXT, ua TEXT, updated_by TEXT)`,
  "CREATE INDEX IF NOT EXISTS cm_idx_inq_created ON cm_inquiries(created_at)",
  "CREATE INDEX IF NOT EXISTS cm_idx_inq_status ON cm_inquiries(status)",
  "CREATE INDEX IF NOT EXISTS cm_idx_inq_ip ON cm_inquiries(ip_hash, created_at)",
  `CREATE TABLE IF NOT EXISTS cm_inquiry_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, inquiry_id TEXT NOT NULL, at TEXT NOT NULL, by TEXT, kind TEXT, text TEXT)`,
  "CREATE INDEX IF NOT EXISTS cm_idx_notes_inq ON cm_inquiry_notes(inquiry_id)",
  // 방문 통계 — 페이지 조회(pv) 한 줄에 체류 시간·스크롤을 덧붙이고, 클릭·문의·가입은 따로 한 줄씩 남깁니다.
  // 방문자 번호(vid)와 방문 번호(sid)는 브라우저가 만든 임의 값이며 IP나 개인 정보는 저장하지 않습니다.
  `CREATE TABLE IF NOT EXISTS cm_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, day TEXT NOT NULL, hour INTEGER, wd INTEGER, type TEXT NOT NULL,
    vid TEXT, sid TEXT, pid TEXT, path TEXT, title TEXT, entry INTEGER DEFAULT 0, fresh INTEGER DEFAULT 0,
    src TEXT, ref TEXT, utm TEXT, dev TEXT, country TEXT, region TEXT, kind TEXT, label TEXT, dur INTEGER, depth INTEGER)`,
  "CREATE INDEX IF NOT EXISTS cm_idx_ev_day ON cm_events(type, day)",
  "CREATE INDEX IF NOT EXISTS cm_idx_ev_pid ON cm_events(pid)",
  "CREATE INDEX IF NOT EXISTS cm_idx_ev_at ON cm_events(at)",
  // 회원 (소식 받기 회원 — 비밀번호 없이 이름과 연락처로 가입)
  `CREATE TABLE IF NOT EXISTS cm_members (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT, status TEXT NOT NULL DEFAULT 'active',
    name TEXT, email TEXT, phone TEXT, biz TEXT, stage TEXT, interests TEXT, marketing INTEGER DEFAULT 0,
    channel TEXT, src TEXT, landing TEXT, ref TEXT, utm TEXT, page TEXT, memo TEXT, ip_hash TEXT, updated_by TEXT)`,
  "CREATE INDEX IF NOT EXISTS cm_idx_mem_created ON cm_members(created_at)",
  "CREATE INDEX IF NOT EXISTS cm_idx_mem_email ON cm_members(email)",
  "CREATE INDEX IF NOT EXISTS cm_idx_mem_phone ON cm_members(phone)"
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
    `INSERT INTO cm_inquiries (id, created_at, updated_at, status, type, channel, name, phone, email, biz, region, area, grade, open,
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
  await db.prepare("INSERT INTO cm_inquiry_notes (inquiry_id, at, by, kind, text) VALUES (?, ?, ?, ?, ?)")
    .bind(id, new Date().toISOString(), by || "", kind || "note", String(text || "").slice(0, 2000)).run();
}

/* ---------- 회원 ---------- */
export const MEMBER_FIELDS = { name: 40, email: 120, phone: 40, biz: 60, stage: 60, channel: 30, landing: 300, ref: 300, utm: 300, page: 300 };
export const MEMBER_STATUS = ["active", "unsub"];
export const MEMBER_STAGES = ["창업 준비 중", "매장 운영 중 · 리뉴얼 검토", "건물주 · 공실 활용", "프랜차이즈 · 다점포", "기타"];
export const MEMBER_INTERESTS = ["브랜딩 · 네이밍", "공간 콘셉트", "인테리어 설계 · 시공", "가구 스타일링 · 톤앤매너", "마케팅 · 콘텐츠", "창업 교육 · 컨설팅"];

export function toMember(r) {
  if (!r) return null;
  let interests = [];
  try { interests = r.interests ? JSON.parse(r.interests) : []; } catch (e) { interests = []; }
  return {
    id: r.id, createdAt: r.created_at, updatedAt: r.updated_at, status: r.status, name: r.name || "", email: r.email || "", phone: r.phone || "",
    biz: r.biz || "", stage: r.stage || "", interests, marketing: !!r.marketing, channel: r.channel || "", src: r.src || "",
    landing: r.landing || "", ref: r.ref || "", utm: r.utm || "", page: r.page || "", memo: r.memo || "", updatedBy: r.updated_by || ""
  };
}

/* ---------- 날짜 (한국 시간 기준) ---------- */
export function kst(d) {
  const t = new Date((d ? new Date(d).getTime() : Date.now()) + 9 * 3600 * 1000);
  return { day: t.toISOString().slice(0, 10), hour: t.getUTCHours(), wd: t.getUTCDay() };
}
