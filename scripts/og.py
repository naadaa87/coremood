#!/usr/bin/env python3
"""코어무드 저널 공유 이미지(OG 카드) 생성기
사용법: python3 scripts/og.py <slug> "<제목>" <분류 이름> <대표 이미지 경로>
결과: assets/img/og/<slug>.jpg (1200x630)
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "assets/fonts/Pretendard-sub.woff2")
PAPER = (246, 243, 238)
INK = (35, 30, 25)
OLIVE = (111, 115, 94)
TAUPE = (156, 145, 132)
LINE = (203, 193, 177)
BRONZE = (168, 131, 78)
W, H = 1200, 630
PANEL = 430


def font(size, weight):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f


def wrap(draw, text, fnt, width):
    # 쉼표에서 먼저 끊어 읽기 좋게
    if ", " in text:
        head, rest = text.split(", ", 1)
        if draw.textlength(head + ",", font=fnt) <= width:
            return [head + ","] + wrap(draw, rest, fnt, width)
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=fnt) <= width:
            cur = t
            continue
        if cur:
            lines.append(cur)
        cur = w
        while draw.textlength(cur, font=fnt) > width:
            k = len(cur)
            while k > 1 and draw.textlength(cur[:k], font=fnt) > width:
                k -= 1
            lines.append(cur[:k])
            cur = cur[k:]
    if cur:
        lines.append(cur)
    return lines


def make(slug, title, cat, cover):
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    # 오른쪽 이미지 패널
    src = os.path.join(ROOT, cover.lstrip("/")) if cover else ""
    if src and os.path.exists(src):
        c = Image.open(src).convert("RGB")
        r = max(PANEL / c.width, H / c.height)
        c = c.resize((int(c.width * r + 1), int(c.height * r + 1)), Image.LANCZOS)
        x = (c.width - PANEL) // 2
        y = (c.height - H) // 2
        img.paste(c.crop((x, y, x + PANEL, y + H)), (W - PANEL, 0))
    left = 72
    width = W - PANEL - left - 64
    # 상단 라벨
    d.text((left, 70), "CORE MOOD JOURNAL", font=font(19, 600), fill=OLIVE)
    d.line((left, 112, W - PANEL - 64, 112), fill=LINE, width=1)
    d.text((left, 132), cat, font=font(24, 600), fill=TAUPE)
    # 제목
    size = 58
    while True:
        f = font(size, 700)
        lines = wrap(d, title, f, width)
        if len(lines) <= 3 or size <= 40:
            break
        size -= 4
    lh = int(size * 1.32)
    y = 196 + max(0, (3 - len(lines))) * lh // 3
    for i, ln in enumerate(lines[:4]):
        d.text((left, y), ln, font=f, fill=INK)
        if i == min(len(lines), 4) - 1 and not ln.endswith(("?", ".", "!")):
            tw = d.textlength(ln, font=f)
            d.text((left + tw + 2, y), ".", font=f, fill=BRONZE)
        y += lh
    # 하단 타이틀블록
    d.line((left, 520, W - PANEL - 64, 520), fill=LINE, width=1)
    d.text((left, 542), "코어무드", font=font(26, 700), fill=INK)
    tw = d.textlength("코어무드", font=font(26, 700))
    d.text((left + tw + 1, 542), ".", font=font(26, 700), fill=BRONZE)
    d.text((left + tw + 30, 548), "coremood.kr", font=ImageFont.truetype(FONT, 18, layout_engine=ImageFont.Layout.BASIC), fill=TAUPE)
    out_dir = os.path.join(ROOT, "assets/img/og")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, slug + ".jpg")
    img.save(out, "JPEG", quality=84, optimize=True, progressive=True)
    return out


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)
    print(make(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else ""))
