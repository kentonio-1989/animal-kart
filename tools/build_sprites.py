"""Codex で生成したドット絵(マゼンタ背景)を切り出し、ゲーム用のスプライトとアトラスを作る。

使い方:  python tools/build_sprites.py <生の画像フォルダ>
  入力:  drv_<動物>.png(左=後ろ 中=横(右向き) 右=前 の3つ)、items.png(4列×2行)、banner.png
  出力:  assets/sprites/*.png、assets/banner.png、assets/icon.png、js/atlas.js(アトラスを data URI で埋め込み)
"""
import base64, io, json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '_art_raw')
OUT_SP = os.path.join(ROOT, 'assets', 'sprites')
os.makedirs(OUT_SP, exist_ok=True)

ANIMALS = ['dog', 'cat', 'frog', 'chick', 'bear', 'rabbit', 'panda', 'tiger']
VIEWS = ['back', 'side', 'front']
ITEMS = [['carrot', 'carrot3', 'mud', 'yarn'], ['bee', 'bubble', 'star', 'box']]
DRV_H = 64   # 動物の高さ(ドット)
ITEM_H = 48  # アイテムの高さ(ドット)


def key_out(img):
    """背景(画像の縁とつながったマゼンタ)を透明にする。囲まれた穴も透明。戻り値 RGBA の numpy 配列と穴のマスク"""
    a = np.asarray(img.convert('RGB')).astype(np.int32)
    h, w, _ = a.shape
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(-1))
    like = dist < 130
    seen = np.zeros_like(like)
    seen[0, :] = like[0, :]; seen[-1, :] = like[-1, :]; seen[:, 0] = like[:, 0]; seen[:, -1] = like[:, -1]
    while True:  # 縁から広げる(輪郭線で止まる)
        g = seen.copy()
        g[1:] |= seen[:-1]; g[:-1] |= seen[1:]; g[:, 1:] |= seen[:, :-1]; g[:, :-1] |= seen[:, 1:]
        g &= like
        if (g == seen).all():
            break
        seen = g
    holes = like & ~seen & (dist < 70)
    alpha = np.where(seen | holes, 0, 255)
    rgba = np.dstack([a, alpha]).astype(np.uint8)
    return rgba, holes


def crop_cell(rgba, x0, y0, x1, y1):
    cell = rgba[y0:y1, x0:x1]
    ys, xs = np.nonzero(cell[:, :, 3] > 0)
    if len(xs) == 0:
        raise SystemExit(f'空のセル {x0},{y0}')
    # 小さなゴミ(数ピクセル)は無視するため、行・列ごとの画素数でしきい値
    m = cell[:, :, 3] > 0
    cols = np.nonzero(m.sum(0) > 2)[0]; rows = np.nonzero(m.sum(1) > 2)[0]
    cx0, cx1, cy0, cy1 = cols[0], cols[-1] + 1, rows[0], rows[-1] + 1
    edge = cx0 == 0 or cy0 == 0 or cx1 == cell.shape[1] or cy1 == cell.shape[0]
    return cell[cy0:cy1, cx0:cx1], edge


def to_pixel(arr, height, colors=28):
    """縮小してドットをそろえ、色数を落とす"""
    im = Image.fromarray(arr, 'RGBA')
    w = max(1, round(im.width * height / im.height))
    a = np.asarray(im).astype(np.float32) / 255
    pre = a.copy(); pre[:, :, :3] *= pre[:, :, 3:4]
    small = np.asarray(Image.fromarray((pre * 255).astype(np.uint8), 'RGBA').resize((w, height), Image.BOX)).astype(np.float32) / 255
    al = small[:, :, 3:4]
    rgb = np.where(al > 0.01, small[:, :, :3] / np.maximum(al, 1e-3), 0)
    opaque = (al[:, :, 0] >= 0.5)
    rgb8 = (np.clip(rgb, 0, 1) * 255).astype(np.uint8)
    q = Image.fromarray(rgb8, 'RGB').quantize(colors, method=Image.Quantize.MEDIANCUT).convert('RGB')
    out = np.dstack([np.asarray(q), np.where(opaque, 255, 0).astype(np.uint8)])
    return Image.fromarray(out, 'RGBA')


sprites = {}
warn = []
for an in ANIMALS:
    img = Image.open(os.path.join(RAW, f'drv_{an}.png'))
    rgba, _ = key_out(img)
    h, w = rgba.shape[:2]
    for i, v in enumerate(VIEWS):
        part, edge = crop_cell(rgba, w * i // 3, 0, w * (i + 1) // 3, h)
        if edge: warn.append(f'drv_{an}_{v}: セルの端に接している')
        sprites[f'drv_{an}_{v}'] = to_pixel(part, DRV_H)

img = Image.open(os.path.join(RAW, 'items.png'))
rgba, holes = key_out(img)
h, w = rgba.shape[:2]
for r, row in enumerate(ITEMS):
    for c, name in enumerate(row):
        x0, x1, y0, y1 = w * c // 4, w * (c + 1) // 4, h * r // 2, h * (r + 1) // 2
        if name == 'bubble':  # シャボン玉の中を薄い水色で塗る
            sub = rgba[y0:y1, x0:x1]; hm = holes[y0:y1, x0:x1]
            sub[hm] = [190, 235, 255, 255]
        part, edge = crop_cell(rgba, x0, y0, x1, y1)
        if edge: warn.append(f'item_{name}: セルの端に接している')
        sprites[f'item_{name}'] = to_pixel(part, ITEM_H)

for k, im in sprites.items():
    im.save(os.path.join(OUT_SP, k + '.png'))

# アトラスに詰める(棚詰め)
pad = 2
order = sorted(sprites, key=lambda k: -sprites[k].height)
AW = 512; x = y = shelf = 0; rects = {}
for k in order:
    im = sprites[k]
    if x + im.width + pad > AW: x = 0; y += shelf + pad; shelf = 0
    rects[k] = [x, y, im.width, im.height]; x += im.width + pad; shelf = max(shelf, im.height)
AH = 1
while AH < y + shelf: AH *= 2
atlas = Image.new('RGBA', (AW, AH), (0, 0, 0, 0))
for k, (rx, ry, _, _) in rects.items():
    atlas.paste(sprites[k], (rx, ry))
buf = io.BytesIO(); atlas.save(buf, 'PNG', optimize=True)
atlas.save(os.path.join(ROOT, 'assets', 'atlas.png'))
src = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
with open(os.path.join(ROOT, 'js', 'atlas.js'), 'w', encoding='utf-8', newline='\n') as f:
    f.write("'use strict';\n// tools/build_sprites.py が作るファイル(手で直さない)。Codex で描いたドット絵をまとめた画像\n")
    f.write('const ATLAS = ' + json.dumps({'w': AW, 'h': AH, 'rects': rects, 'src': src}, ensure_ascii=False) + ';\n')

# タイトル絵とアイコン
bp = os.path.join(RAW, 'banner.png')
if os.path.exists(bp):
    b = Image.open(bp).convert('RGB')
    b = b.resize((768, round(768 * b.height / b.width)), Image.BOX).quantize(96, method=Image.Quantize.MEDIANCUT).convert('RGB')
    b.save(os.path.join(ROOT, 'assets', 'banner.png'), optimize=True)
ic = sprites['drv_dog_front']
side = max(ic.width, ic.height); canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
canvas.paste(ic, ((side - ic.width) // 2, (side - ic.height) // 2))
canvas.resize((side * 2, side * 2), Image.NEAREST).save(os.path.join(ROOT, 'assets', 'icon.png'))

print('sprites:', len(sprites), 'atlas:', AW, 'x', AH, 'atlas.js bytes:', len(src))
for w_ in warn: print('注意:', w_)
