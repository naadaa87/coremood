# 코어무드 CORE MOOD — 공식 홈페이지

공간 컨셉 기획 · 브랜드 개발 · 인테리어 설계/시공 · 콘텐츠 · 마케팅을 하나로 연결하는
공간 비즈니스 스튜디오 **코어무드**의 공식 홈페이지입니다.

빌드 도구가 필요 없는 **정적 사이트**입니다. 파일을 그대로 올리면 바로 동작합니다.

---

## 페이지 구성

| 파일 | 페이지 | 주요 내용 |
|---|---|---|
| `index.html` | 홈 | 히어로 · 실적 요약 · 3가지 관점 · CORE/MOOD/BRAND · 6개 서비스 모듈 · 대표 스타일 4선 · Before&After · 고객 유형 |
| `about.html` | 브랜드 | 포지셔닝 · 회사 개요 · 5가지 기준 · Core/Mood/Brand 정의 · 고객군 · 실적 |
| `services.html` | 서비스 | 6개 모듈 상세(내용·산출물·기간) · 3개 패키지 · 시공 범위 12공종 · 별도 확인 항목 |
| `portfolio.html` | 프로젝트 | 스타일 디렉션 18건(업종 필터 + 상세 모달) · 실제 시공 Before&After 9세트 · 시공 기록표 |
| `process.html` | 진행 절차 | 8단계 프로세스 · 대금 지급 기준 · 리스크 대응 · FAQ 8문항 |
| `estimate.html` | 견적 안내 | 개략 공사비 산정기 · 금액을 가르는 조건 · 별도 산정 항목 · 견적 방식 |
| `contact.html` | 상담 신청 | 상담 신청 폼(메일 자동 작성) · 직접 연락처 · 준비물 안내 · 이후 절차 |
| `404.html` | 오류 | Cloudflare Pages 자동 연결 |

---

## 폴더 구조

```
/
├── index.html  about.html  services.html  portfolio.html
├── process.html  estimate.html  contact.html  404.html
├── favicon.svg
├── _headers            # Cloudflare Pages 캐시·보안 헤더
├── robots.txt
├── sitemap.xml
├── README.md
├── .gitignore
└── assets/
    ├── css/main.css
    ├── js/main.js
    ├── fonts/          # Pretendard · Cormorant Garamond (서브셋 woff2, 자체 호스팅)
    └── img/            # WebP 이미지 82장
```

외부 CDN 의존성이 없습니다. 폰트까지 전부 저장소 안에 들어 있어 인터넷 검열·차단 환경에서도 동일하게 표시됩니다.

---

## Cloudflare Pages 배포 설정

GitHub 저장소를 연결한 뒤 아래 값만 넣으면 됩니다.

| 항목 | 값 |
|---|---|
| Framework preset | **None** |
| Build command | **(비워 둠)** |
| Build output directory | **`/`** |
| Root directory | (비워 둠) |

> **주의** — 기존 `coremood.pages.dev` 프로젝트가 *Direct Upload* 방식으로 만들어진 경우
> Git 연동으로 전환할 수 없습니다. 같은 주소를 쓰시려면 기존 프로젝트를 먼저 삭제한 뒤
> 새 프로젝트를 Git 연동으로 생성해야 합니다.

---

## 도메인 연결 후 해야 할 일

`coremood.pages.dev` 대신 자체 도메인을 붙이시면, 아래 두 파일의 주소를 바꿔 주세요.

- `sitemap.xml` — `<loc>` 주소 8곳
- 각 HTML의 `<link rel="canonical">` 및 `og:url`, `og:image`

---

## 수정할 때 자주 찾는 곳

| 바꾸고 싶은 것 | 위치 |
|---|---|
| 색상 · 서체 · 여백 기준값 | `assets/css/main.css` 최상단 `:root` |
| 연락처 · 주소 | 각 HTML의 푸터, `contact.html` |
| 견적 산정 단가와 업종 계수 | `assets/js/main.js` 의 `BIZ`, `GRADE` |

### 견적 산정 기준값

**마감 사양 (평당 · 만 원)**

| 단계 | 단가 | 성격 |
|---|---|---|
| 에센셜 | 70 | 부분 개선 · 최소 범위 |
| 베이직 | 110 | 필수 공정 중심 |
| 스탠다드 | 170 | 가장 일반적인 사양 |
| 프리미엄 | 220 | 천연 소재 · 제작 가구 중심 |
| 시그니처 | 280 | 맞춤 제작 · 특수 마감 (협의) |

**업종 계수 (카페 = 1.00 기준)**

| 업종 | 계수 | 업종 | 계수 |
|---|---|---|---|
| 숙박 · 스테이 | 1.35 | 카페 · 베이커리 | 1.00 |
| 바 · 라운지 | 1.28 | 미용 · 뷰티 | 0.96 |
| 음식점 · 주점 | 1.10 | 파티룸 · 스튜디오 | 0.90 |
| 리테일 · 쇼룸 | 1.04 | 오피스 | 0.86 |
| | | 스터디카페 · 학원 | 0.82 |

계산식 = `평당 단가 × 업종 계수 × 면적`, 표시 범위는 ±14%입니다.
1억 원 미만은 만 원 단위, 이상은 억 원 단위로 자동 전환됩니다.
시그니처를 고르면 "(협의)" 표기와 전용 안내 문구로 바뀝니다.
| 상담 신청 메일 수신 주소 | `assets/js/main.js` 의 `mailto:` |

---

© 코어무드 CORE MOOD · 소셜패밀리 SOCIAL FAMILY
