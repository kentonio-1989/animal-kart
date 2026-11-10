'use strict';
// ===== 画面表示(HUD) =====
const FONT = "'DotGothic16', 'Yu Gothic UI', 'Meiryo', 'Hiragino Sans', sans-serif";
const ICON_KEYS = Object.keys(ITEMS);
function fmtTime(t) { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; }
function rgbCss(c, a = 1) { return `rgba(${(c[0] * 255) | 0},${(c[1] * 255) | 0},${(c[2] * 255) | 0},${a})`; }

class HUD {
  constructor(canvas) { this.c = canvas; this.x = canvas.getContext('2d'); this.msgs = []; this.resize(); }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.c.width = Math.floor(innerWidth * dpr); this.c.height = Math.floor(innerHeight * dpr);
    this.w = this.c.width; this.h = this.c.height; this.u = Math.min(this.w, this.h * 1.5) / 1000;
  }
  flash(text, color = '#fff', dur = 1.6, size = 1) { this.msgs = this.msgs.filter(m => m.text !== text); this.msgs.push({ text, color, t: dur, dur, size }); }
  text(s, x, y, size, color, align = 'left', stroke = 0.14) {
    const c = this.x; c.font = `${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle';
    c.lineJoin = 'miter'; c.lineWidth = size * stroke * 1.4; c.strokeStyle = 'rgba(0,0,0,0.9)'; c.strokeText(s, x, y);
    c.fillStyle = color; c.fillText(s, x, y);
  }
  panel(x, y, w, h, r) {
    const c = this.x, u = this.u; c.fillStyle = 'rgba(10,14,30,0.65)'; c.fillRect(x, y, w, h);
    c.lineWidth = 4 * u; c.strokeStyle = '#fff'; c.strokeRect(x + 2 * u, y + 2 * u, w - 4 * u, h - 4 * u);
    c.lineWidth = 2 * u; c.strokeStyle = '#000'; c.strokeRect(x - 1 * u, y - 1 * u, w + 2 * u, h + 2 * u);
  }
  draw(g, dt) {
    const c = this.x, u = this.u, W = this.w, H = this.h;
    c.clearRect(0, 0, W, H);
    for (const m of this.msgs) m.t -= dt;
    this.msgs = this.msgs.filter(m => m.t > 0);
    if (g.state === 'menu') return;
    const p = g.player;
    // アイテム
    const s = 120 * u, ix = 30 * u, iy = 30 * u;
    this.panel(ix, iy, s, s, 18 * u);
    let icon = null;
    if (p.roulette > 0) icon = ITEMS[ICON_KEYS[Math.floor(g.time * 14) % ICON_KEYS.length]].icon;
    else if (p.item) icon = ITEMS[p.item].icon;
    if (icon) {
      if (!drawAtlas(c, icon, ix + s / 2, iy + s / 2, 92 * u)) { c.font = `${50 * u}px ${FONT}`; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('?', ix + s / 2, iy + s / 2); }
      if (p.item && p.itemCount > 1 && p.roulette <= 0) this.text('×' + p.itemCount, ix + s - 8 * u, iy + s - 16 * u, 30 * u, '#ffe14a', 'right');
      if (p.item && p.roulette <= 0) this.text(ITEMS[p.item].name, ix + s / 2, iy + s + 22 * u, 22 * u, '#fff', 'center');
    }
    // ラップ・タイム
    const lap = clamp(Math.floor(p.raceDist / g.track.len) + 1, 1, g.laps);
    this.text(`LAP ${p.finished ? g.laps : lap}/${g.laps}`, W - 30 * u, 52 * u, 50 * u, '#fff', 'right');
    this.text(fmtTime(p.finished ? p.finishTime : g.raceTime), W - 30 * u, 105 * u, 34 * u, '#ffe9a8', 'right');
    // 順位
    const rk = g.rankOf(p), rc = rk === 1 ? '#ffd23a' : rk === 2 ? '#dfe6f0' : rk === 3 ? '#ff9f5a' : '#ffffff';
    if (this.touch) {
      this.text(String(rk), 250 * u, 80 * u, 110 * u, rc, 'right', 0.1);
      this.text('位', 310 * u, 100 * u, 44 * u, rc, 'right', 0.12);
    } else {
      this.text(String(rk), W - 120 * u, H - 95 * u, 150 * u, rc, 'right', 0.1);
      this.text('位', W - 40 * u, H - 70 * u, 60 * u, rc, 'right', 0.12);
    }
    // スピード
    const sy = this.touch ? 130 * u : H - 70 * u;
    this.text(`${Math.round(Math.abs(p.speed) * 3.9)}`, W / 2, sy, 46 * u, '#fff', 'center');
    this.text('km/h', W / 2, sy + 35 * u, 20 * u, '#cfe', 'center');
    if (p.drifting && p.driftLv > 0) this.text(['', 'ミニターボ', 'スーパーターボ', 'ウルトラターボ'][p.driftLv], W / 2, H - 120 * u, 26 * u, rgbCss(SPARK[p.driftLv]), 'center');
    // 順位表
    const rs = this.touch ? 0.78 : 1; // タッチ操作のときは小さく(ボタンと重ならないように)
    let y = (this.touch ? 135 : 150) * u; const lx = W - 205 * rs * u;
    g.ranking.forEach((k, i) => {
      const me = k === p;
      c.fillStyle = me ? 'rgba(255,220,80,0.45)' : 'rgba(10,14,30,0.5)';
      c.fillRect(lx, y - 13 * rs * u, 175 * rs * u, 26 * rs * u);
      c.fillStyle = rgbCss(k.drv.color); c.fillRect(lx + 28 * rs * u, y - 13 * rs * u, 4 * rs * u, 26 * rs * u);
      if (!drawAtlas(c, `drv_${k.drv.animal}_front`, lx + 44 * rs * u, y, 24 * rs * u)) { c.fillStyle = rgbCss(k.drv.color); c.fillRect(lx + 36 * rs * u, y - 8 * rs * u, 16 * rs * u, 16 * rs * u); }
      this.text(String(i + 1), lx + 16 * rs * u, y, 18 * rs * u, '#fff', 'center');
      this.text(k.name + (k.finished ? ' 🏁' : ''), lx + 56 * rs * u, y, 17 * rs * u, me ? '#ffe14a' : '#fff', 'left');
      y += 29 * rs * u;
    });
    if (!this.touch) this.minimap(g);
    // 逆走
    if (p.wrong > 1 && !p.finished) this.text('⚠ 逆走しています!', W / 2, H * 0.3, 48 * u, '#ff5a5a', 'center');
    // カウントダウン
    if (g.state === 'countdown' && g.cd <= 3) {
      const n = Math.ceil(g.cd), f = g.cd - Math.floor(g.cd);
      this.text(String(n), W / 2, H * 0.38, (160 + f * 80) * u, ['#fff', '#ff5a5a', '#ffd23a', '#5aff7a'][n] || '#fff', 'center', 0.08);
    }
    // メッセージ
    let my = H * 0.42;
    for (const m of this.msgs) {
      const a = Math.min(1, m.t / 0.3), k = 1 + Math.max(0, (m.t - m.dur + 0.15) / 0.15) * 0.4;
      c.globalAlpha = a; this.text(m.text, W / 2, my, 72 * u * m.size * k, m.color, 'center', 0.1); c.globalAlpha = 1;
      my += 90 * u * m.size;
    }
  }
  minimap(g) {
    const c = this.x, u = this.u, T = g.track, B = T.bounds, size = 230 * u, ox = 30 * u, oy = this.h - size - 30 * u;
    const sc = size / Math.max(B.maxX - B.minX, B.maxZ - B.minZ) * 0.9;
    const mx = x => ox + size / 2 - (x - B.cx) * sc, my = z => oy + size / 2 - (z - B.cz) * sc;
    c.fillStyle = 'rgba(10,14,30,0.5)'; c.fillRect(ox, oy, size, size);
    c.beginPath();
    for (let j = 0; j <= T.N; j += 3) { const i = j % T.N; j ? c.lineTo(mx(T.px[i]), my(T.pz[i])) : c.moveTo(mx(T.px[i]), my(T.pz[i])); }
    c.closePath(); c.lineJoin = 'miter';
    c.lineWidth = 9 * u; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke();
    c.lineWidth = 5 * u; c.strokeStyle = 'rgba(70,75,90,1)'; c.stroke();
    const sp = T.P(0, -T.W), ep = T.P(0, T.W);
    c.lineWidth = 3 * u; c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(mx(sp[0]), my(sp[2])); c.lineTo(mx(ep[0]), my(ep[2])); c.stroke();
    for (const k of [...g.karts].sort((a, b) => a.isPlayer - b.isPlayer)) {
      const r = (k.isPlayer ? 7 : 5) * u; c.fillStyle = k.isPlayer ? '#fff' : '#000'; c.fillRect(mx(k.x) - r - 2 * u, my(k.z) - r - 2 * u, r * 2 + 4 * u, r * 2 + 4 * u);
      c.fillStyle = rgbCss(k.drv.color); c.fillRect(mx(k.x) - r, my(k.z) - r, r * 2, r * 2);
    }
  }
}
