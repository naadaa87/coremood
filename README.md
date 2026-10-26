# 코어무드 CORE MOOD — 공식 홈페이지

상업공간 브랜딩 · 인테리어 스튜디오 **코어무드**의 홈페이지입니다. https://coremood.kr

빌드 도구 없이 동작하는 정적 사이트이고, 저장소에 올라간 파일이 그대로 배포됩니다.
글과 업종 페이지는 `content/` 의 마크다운에서 만들어지며, 만들어진 HTML도 함께 저장소에 들어 있습니다.

---

## 운영은 이렇게 합니다

| 하고 싶은 일 | 방법 |
|---|---|
| 글 쓰기 · 고치기 · 예약 발행 | **https://coremood.kr/admin** → 저널 글 |
| 매일 아침 자동 발행 주제 관리 | 관리자 → 발행 계획 (대기열 순서대로 매일 10시 발행) |
| 업종별 페이지 문구 수정 | 관리자 → 업종 페이지 |
| 상담 문의 확인 · 상태 관리 · CSV | 관리자 → 상담 문의 (KV 연결 후) |
| 기본 페이지 검색 제목·설명 | 관리자 → 페이지 SEO |
| 상단 공지, 검색엔진 소유확인, IndexNow | 관리자 → 사이트 설정 |

관리자 화면은 GitHub 토큰(이 저장소 Contents 읽기·쓰기 권한)으로 로그인하며, 저장하면 저장소에 바로 커밋되고 Cloudflare Pages가 1~2분 안에 다시 배포합니다.

---

## 폴더 구조

```
/
├── index.html about.html services.html portfolio.html     기본 페이지(직접 작성한 HTML)
├── process.html estimate.html contact.html 404.html
├── faq.html                     ← content/pages/faq.md 에서 생성
├── journal/                     ← 저널 글·목록·분류 페이지 (생성)
├── industries/                  ← 업종별 인테리어 페이지 (생성)
├── sitemap.xml  feed.xml        ← 생성
├── content/
│   ├── posts/*.md               저널 원고
│   ├── industries/*.md          업종 페이지 원고
│   ├── pages/faq.md             자주 묻는 질문 원고
│   ├── queue.json               자동 발행 대기열
│   ├── STYLE.md                 문체·브랜드 규칙
│   ├── AUTOPILOT.md             매일 자동 발행 절차
│   └── index.json               전체 글 목록(관리자용, 생성)
├── data/
│   ├── pages.json               기본 페이지 검색 제목·설명
│   ├── site.json                상단 공지
│   ├── images.json              대표 이미지 라이브러리
│   └── posts.json               공개 글 목록(생성)
├── admin/                       관리자 화면
├── functions/api/               상담 문의 접수·관리, IndexNow (Cloudflare Pages Functions)
├── scripts/
│   ├── build.js                 원고 → HTML, 사이트맵, RSS, 공유 이미지
│   ├── check.js                 원고 점검(금지 표현, 분량, 링크 등)
│   └── og.py                    공유 이미지(OG 카드) 생성
└── assets/
    ├── css/main.css  js/main.js  js/cm-render.js(공용 렌더러)
    ├── fonts/                   Pretendard · Cormorant (자체 호스팅)
    └── img/                     이미지, img/og/ 공유 이미지
```

`content/` 와 `scripts/` 는 웹에서 열리지 않도록 막아 두었습니다.

---

## 직접 빌드할 때

```
node scripts/check.js     # 원고 점검
node scripts/build.js     # 페이지·사이트맵·RSS·목록 갱신 (Python Pillow가 있으면 공유 이미지도 생성)
```

공통 헤더·푸터, 홈의 업종·최신 글 영역은 `assets/js/cm-render.js` 에서 만들어 `<!--@header-->` 같은 표시 사이에 넣습니다.
CSS나 JS를 고쳤다면 `cm-render.js` 의 `ASSET_V` 값을 바꿔 브라우저 캐시를 새로 받게 합니다.

---

## Cloudflare Pages 설정

| 항목 | 값 |
|---|---|
| Framework preset | None |
| Build command | (비워 둠) |
| Build output directory | `/` |

**상담 문의 저장(선택, 한 번만)** — KV 네임스페이스를 하나 만들고 Pages 프로젝트의 Bindings 에 변수명 `INQUIRIES` 로 연결한 뒤 다시 배포합니다.
연결 전에는 상담 신청이 방문자의 메일 앱으로 전달됩니다. 새 문의 알림을 받으려면 환경 변수 `NOTIFY_WEBHOOK` 에 슬랙·디스코드 웹훅 주소를 넣습니다.

---

## 검색엔진 등록

- 네이버 서치어드바이저: 사이트 등록 → 소유확인 파일은 관리자 > 사이트 설정에서 업로드 → 사이트맵 `https://coremood.kr/sitemap.xml`, RSS `https://coremood.kr/feed.xml` 제출
- 구글 서치 콘솔: 같은 방식으로 소유확인 후 `sitemap.xml` 제출
- 새 글은 저장할 때 IndexNow로 검색엔진에 자동으로 알립니다.

© 코어무드 CORE MOOD · (주)블랭크
