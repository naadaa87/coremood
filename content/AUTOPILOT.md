# 코어무드 저널 자동 발행 매뉴얼

매일 오전 10시(한국 시간) 무렵 예약 작업이 이 문서를 따라 저널 글 한 편을 발행합니다.
글의 문체와 규칙은 `content/STYLE.md` 가 기준입니다. 두 문서를 모두 읽고 시작합니다.

## 0. 준비

- 저장소 최신 상태에서 시작합니다: `git pull --rebase origin main`
- 오늘 날짜(한국 시간)를 확인합니다: `TZ=Asia/Seoul date +%F`
- 발행 시각은 항상 **오늘 10:00 (+09:00)** 입니다. 예: `2026-10-27T10:00:00+09:00`

## 1. 오늘 발행할지 판단

- `content/queue.json` 의 `paused` 가 `true` 면 아무것도 바꾸지 말고 "자동 발행이 일시중지 상태"라고 보고하고 끝냅니다.
- `content/posts/` 에 오늘 날짜 09:00 이후로 `date` 가 잡힌 글이 이미 있으면 중복 발행하지 않고 끝냅니다.

## 2. 주제 정하기

1. `content/queue.json` 의 `items` 중 `status` 가 `pending` 인 **첫 번째** 항목을 씁니다. `title`(제목안), `category`, `keyword`, `angle`(방향 메모)을 따르되, 제목은 STYLE.md 기준(25~40자, 키워드 앞쪽)에 맞게 다듬어도 됩니다.
2. 대기 항목이 없으면 직접 정합니다.
   - 분류는 `branding → interior → marketing → startup → business` 순서로 돌아갑니다. `data/posts.json` 에서 가장 최근 글의 분류 다음 순서를 고릅니다.
   - `queue.json` 의 `notes`(이번 시기 방향 메모)를 참고합니다.
   - 사람들이 실제로 검색하는 키워드 하나를 정하고, `data/posts.json` 의 기존 제목·키워드와 겹치지 않게 합니다. 같은 키워드라도 다른 판단 지점을 다루면 괜찮습니다.
   - 업종(카페, 음식점, 바, 미용실, 파티룸, 스터디카페, 숙박, 오피스, 리테일, 스튜디오)이 한쪽으로 쏠리지 않게 최근 10편을 보고 고릅니다.

## 3. 쓰기

- 파일: `content/posts/<slug>.md` (slug는 영문 소문자·숫자·하이픈, 내용이 드러나게 3~6단어)
- `date`: 오늘 10:00 (+09:00), `draft: false`
- `cover`: `data/images.json` 의 이미지 중 내용과 맞는 것. 최근 5편에서 쓴 이미지는 피합니다. `coverAlt` 는 이미지에 보이는 것을 씁니다.
- 본문: STYLE.md 의 구조·분량(3,000~5,000자)·문체·브랜드 규칙을 지킵니다.
  - 수치·통계·고객 사례를 지어내지 않습니다. 금액은 견적 안내 기준만, 기간은 조건을 붙인 일반 범위만.
  - 인허가·소방·전기 용량 등은 "별도 확인" 항목으로 안내합니다.
  - 최신 정보가 필요한 주제(플랫폼 기능, 제도 변화 등)는 웹 검색으로 확인하되 문장을 옮겨 쓰지 않고, 확실하지 않으면 일반 원칙으로 씁니다.
- 내부 링크 3~5개. **이미 존재하는** 경로만 씁니다: `/industries/<slug>`, `/journal/<slug>`(data/posts.json 에 있는 글), `/services`, `/estimate`, `/process`, `/portfolio`, `/faq`, `/contact`.

## 4. 점검과 빌드

```
node scripts/check.js content/posts/<slug>.md     # ✗ 오류가 0개가 될 때까지 고칩니다
node scripts/build.js --now=<오늘>T10:00:00+09:00   # 지금이 10시 전이어도 오늘 글이 공개되도록
node scripts/check.js                             # 전체 점검
```

- 빌드는 글 페이지, 저널 목록, 분류 페이지, 홈 최신 글, 업종 페이지의 관련 글, 사이트맵, RSS, 공유 이미지(OG 카드)를 함께 갱신합니다.
- 예약 글(관리자에서 미래 시각으로 저장한 글) 중 시간이 지난 글도 이 빌드에서 함께 공개됩니다.
- 세 번 고쳐도 점검을 통과하지 못하면 발행하지 말고, 커밋하지 않은 채 이유를 보고합니다.

## 5. 대기열 갱신

대기열 항목을 썼다면 그 항목을 고칩니다.

```json
{ "status": "done", "publishedSlug": "<slug>", "publishedAt": "<오늘>T10:00:00+09:00" }
```

## 6. 반영

```
git add -A
git commit -m "journal: <제목> (자동 발행)"
git pull --rebase origin main   # 그사이 관리자 화면에서 바뀐 내용이 있으면 합칩니다
node scripts/build.js --now=<오늘>T10:00:00+09:00 && git add -A && git commit -m "build" || true   # 합친 뒤 다시 빌드(변경 없으면 생략)
git push origin main
```

- 충돌이 나면 `content/` 의 원고와 `content/queue.json` 을 기준으로 정리하고, 나머지 생성 파일은 빌드를 다시 돌려 만듭니다.
- 푸시 후 Cloudflare Pages 가 1~2분 안에 사이트를 다시 배포합니다.

## 7. 보고

발행한 글의 제목, 주소(`https://coremood.kr/journal/<slug>`), 분류, 핵심 키워드, 대기열에서 가져온 주제인지 직접 정한 주제인지를 짧게 남깁니다.
