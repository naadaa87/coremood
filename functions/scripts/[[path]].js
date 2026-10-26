// 빌드 스크립트 폴더(scripts/)는 웹에 공개하지 않습니다.
export function onRequest() {
  return new Response("Not found", { status: 404, headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
