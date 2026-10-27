# 코어무드 CORE MOOD — 공식 홈페이지

상업공간 브랜딩 · 인테리어 스튜디오 **코어무드**의 홈페이지입니다. https://coremood.kr

빌드 도구 없이 동작하는 정적 사이트이고, 저장소에 올라간 파일이 그대로 배포됩니다(Cloudflare Pages).
글·업종 페이지·시공 사례는 원고(`content/`, `data/`)에서 만들어지며, 만들어진 HTML도 함께 저장소에 들어 있습니다.
상담 문의만 공개 저장소가 아닌 **Cloudflare D1**(데이터베이스)에 저장됩니다.

---

## 관리자 화면 — https://coremood.kr/admin

GitHub 토큰(이 저장소 Contents 읽기·쓰기 권한)으로 로그인합니다. 저장하면 저장소에 바로 커밋되고 1~2분 뒤 사이트에 반영됩니다.

| 메뉴 | 하는 일 |
|---|---|
| **운영 · 대시보드** | 새 문의·오늘 연락할 문의, 문의 흐름(상태별), 유입 경로 상위, 최근 변경 기록(자동 발행 포함) |
| **운영 · 상담 문의** | 상태 관리(새 문의 → 연락 완료 → 미팅·실측 → 견적 발송 → 계약/보류/종료), 다음 연락일, 견적 메모, 상담 기록 타임라인, 유입 경로, 전화·카카오톡 문의 직접 등록, 검색, CSV |
| **콘텐츠 · 저널 글** | 작성·수정·예약 발행·임시저장, 실제 화면 미리보기, 자동 점검(금지 표현·분량·링크), 공유 이미지 생성 |
| **콘텐츠 · 발행 계획** | 매일 10시 자동 발행 주제 대기열, 순서 변경, 일시중지, 방향 메모 |
| **콘텐츠 · 시공 사례** | 전후 사진·현장 이야기·공정 범위 입력 → `/projects/<주소>` 페이지 생성, 대표 사례는 홈·프로젝트 슬라이더에 표시 |
| **콘텐츠 · 업종 페이지** | 업종별 랜딩 페이지 10종 문구·대표 이미지·연결 사례 수정 |
| **사이트 · 페이지 SEO** | 기본 페이지 검색 제목·설명 |
| **사이트 · 이미지** | 대표 이미지 라이브러리, 사진 설명(alt)·태그, 새 이미지 업로드(WebP 자동 변환) |
| **사이트 · 사이트 설정** | 상단 공지, 빠른 상담 버튼, 카카오톡 채널 버튼, 네이버·구글 애널리틱스, 스팸 방지 키, 소유확인 태그, IndexNow |
| **도움말 · 설정 점검** | D1 연결·알림·스팸 방지 상태를 실제 서버에서 확인, 시험 알림 발송, Cloudflare 설정 순서 |

---

## 상담 문의 접수 구조

```
방문자 ──(상담 신청 폼 / 빠른 상담 / 견적 계산 후 문의)──▶ /api/inquiry  (Pages Functions)
                                                         ├─ 스팸 검사: 숨김 칸, 같은 곳 10분 5건 제한, Turnstile(선택)
                                                         ├─ 저장: Cloudflare D1 공용 DB total-db (바인딩 DB, cm_ 표 자동 생성)
                                                         └─ 알림: 이메일(Resend) · 텔레그램 · 슬랙/디스코드 웹후크 (선택)
관리자 ──▶ /api/admin/inquiries (GitHub 토큰 확인 후 조회·수정·등록·삭제)
```

D1이 연결되기 전에는 문의가 방문자의 메일 앱으로 넘어갑니다(대체 경로).

### Cloudflare에서 한 번 해 둘 설정

| 순서 | 위치 | 값 |
|---|---|---|
| 1. D1 연결 | Compute → Workers & Pages → coremood → Settings → Bindings → Add → D1 database | 변수 `DB` → 공용 DB `total-db` |
| 2. 알림(선택) | Settings → Variables and Secrets → Add (Encrypt) | `RESEND_API_KEY` 또는 `TELEGRAM_BOT_TOKEN`+`TELEGRAM_CHAT_ID` 또는 `NOTIFY_WEBHOOK` |
| 3. 스팸 방지(선택) | Turnstile → Add widget (coremood.kr, Managed) | Secret → 변수 `TURNSTILE_SECRET`, Site Key → 관리자 사이트 설정 |
| 4. 재배포 | Deployments → 최신 배포 → Retry deployment | 바인딩·변수는 재배포 후 적용 |
| 5. 방문 분석(선택) | Workers & Pages → coremood → Metrics → Web Analytics → Enable | |
| 6. 관리자 잠금(선택) | Zero Trust → Access → Applications → Self-hosted | `coremood.kr/admin`, 대표 메일만 허용 |

`total-db`는 여러 홈페이지가 함께 쓰는 공용 D1 데이터베이스입니다(ID 5bcf38aa-f078-4adb-a3d2-1de3e5793722). 코어무드 표는 `cm_inquiries`, `cm_inquiry_notes`, `cm_auth_cache`로 모두 `cm_` 접두어를 쓰며, 다른 사이트는 각자 다른 접두어를 써서 겹치지 않게 합니다.

선택 변수: `NOTIFY_EMAIL`(받는 주소, 기본 spaceblank0100@gmail.com), `NOTIFY_FROM`(보내는 주소, Resend 도메인 인증 후).

---

## 폴더 구조

```
/
├── index.html about.html services.html portfolio.html     기본 페이지(직접 작성한 HTML, 표시 구간만 자동 갱신)
├── process.html estimate.html contact.html 404.html
├── faq.html                     ← content/pages/faq.md
├── journal/                     ← 저널 글·목록·분류 (생성)
├── industries/                  ← 업종별 페이지 (생성)
├── projects/                    ← 시공 사례 페이지 (생성)
├── sitemap.xml  feed.xml        ← 생성
├── content/
│   ├── posts/*.md               저널 원고
│   ├── industries/*.md          업종 페이지 원고
│   ├── pages/faq.md             자주 묻는 질문
│   ├── queue.json               자동 발행 대기열
│   ├── STYLE.md · AUTOPILOT.md  문체 규칙 · 자동 발행 절차
│   └── index.json               전체 글 목록(관리자용, 생성)
├── data/
│   ├── cases.json               시공 사례 원본
│   ├── site.json                공지·버튼·분석·스팸 방지·소유확인 설정
│   ├── pages.json               기본 페이지 검색 제목·설명
│   ├── images.json              이미지 라이브러리
│   └── posts.json               공개 글 목록(생성)
├── admin/                       관리자 화면
├── functions/                   Cloudflare Pages Functions (문의 접수·관리, 알림, IndexNow)
├── scripts/                     build.js · check.js · og.py
└── assets/                      css · js(main.js, cm-render.js 공용 렌더러) · fonts · img
```

`content/` 와 `scripts/` 는 웹에서 열리지 않도록 막아 두었습니다.

---

## 직접 빌드할 때

```
node scripts/check.js     # 원고 점검
node scripts/build.js     # 페이지·사이트맵·RSS·목록 갱신 (Python Pillow가 있으면 공유 이미지도 생성)
```

CSS나 JS를 고쳤다면 `assets/js/cm-render.js` 의 `ASSET_V` 값을 바꿔 브라우저 캐시를 새로 받게 합니다.
관리자 화면이 읽는 `cm-render.js` 의 버전은 `admin/index.html` 에서 따로 올립니다.

---

## 검색엔진 등록

- 네이버 서치어드바이저: 소유확인 태그 적용 완료 → 사이트맵 `https://coremood.kr/sitemap.xml`, RSS `https://coremood.kr/feed.xml` 제출
- 구글 서치 콘솔: HTML 태그 방식으로 받은 값을 관리자 → 사이트 설정에 저장 후 확인, `sitemap.xml` 제출
- 새 글·사례는 저장할 때 IndexNow로 검색엔진에 자동으로 알립니다.

© 코어무드 CORE MOOD · (주)블랭크
