'use strict';
// ===== コース定義 =====
const COURSES = [
  {
    id: 'meadow', name: 'ぽかぽか はらっぱ', sub: '花と森の草原コース。どうぶつたちが応援中。はじめての人に。', stars: 1, theme: 'meadow',
    pts: [[0, -250], [150, -260], [260, -200], [290, -80], [230, 20], [120, 40], [60, 110], [90, 200], [200, 240], [260, 330], [180, 420], [20, 430], [-120, 380], [-200, 260], [-260, 120], [-250, -60], [-180, -200], [-90, -250]],
    scale: 0.6, W: 11, margin: 9, offroad: 0.5,
    env: { fog: hex(0xcfe8ff), fogRange: [160, 820], light: norm3([0.5, 0.85, 0.3]), sun: [1.0, 0.97, 0.88], amb: [0.52, 0.57, 0.68] },
    sky: { top: hex(0x2f7fd8), hor: hex(0xcfe8ff) },
    ground: hex(0x5cab45), ground2: hex(0x4a9638), shoulder: hex(0x7cc45a), road: hex(0x56595f),
    curbA: hex(0xe03a3a), curbB: hex(0xf4f4f4), wallA: hex(0xf2f2f2), wallB: hex(0x2a6fd6), neon: false,
    boxes: [0.1, 0.42, 0.74], pads: [[0.27, 0.45], [0.6, -0.45], [0.88, 0]], ramps: [],
  },
  {
    id: 'desert', name: 'ラクダさばく', sub: '夕焼けの谷。ジャンプ台で大ジャンプ!', stars: 2, theme: 'desert',
    pts: [[0, -300], [200, -300], [330, -240], [360, -100], [280, 0], [300, 120], [380, 220], [320, 340], [160, 360], [60, 280], [-40, 180], [-160, 200], [-280, 280], [-380, 200], [-360, 40], [-260, -60], [-300, -180], [-220, -290], [-100, -310]],
    scale: 0.55, W: 11, margin: 9, offroad: 0.45,
    env: { fog: hex(0xf6c08e), fogRange: [150, 760], light: norm3([-0.6, 0.55, 0.45]), sun: [1.2, 0.92, 0.7], amb: [0.58, 0.47, 0.52] },
    sky: { top: hex(0x5a3f96), hor: hex(0xffb36b) },
    ground: hex(0xdcae72), ground2: hex(0xcf9c5e), shoulder: hex(0xe7bf86), road: hex(0x5e5450),
    curbA: hex(0xf08a24), curbB: hex(0xfff1d6), wallA: hex(0x8a5a3a), wallB: hex(0xc9864f), neon: false,
    boxes: [0.12, 0.45, 0.76], pads: [[0.3, -0.4], [0.66, 0.4]], ramps: [0.22, 0.56, 0.9],
  },
  {
    id: 'city', name: 'よるのネコまち', sub: 'ネオンの街を走るテクニカルコース。', stars: 3, theme: 'city',
    pts: [[0, -200], [200, -200], [260, -160], [260, 0], [220, 40], [100, 40], [60, 80], [60, 200], [100, 240], [260, 240], [300, 280], [300, 400], [260, 440], [-200, 440], [-260, 400], [-260, 240], [-200, 200], [-140, 160], [-140, 0], [-200, -60], [-240, -120], [-200, -200]],
    scale: 0.6, W: 11.5, margin: 6, offroad: 0.55,
    env: { fog: hex(0x1d1846), fogRange: [90, 620], light: norm3([0.3, 0.9, -0.25]), sun: [0.45, 0.48, 0.7], amb: [0.42, 0.4, 0.62] },
    sky: { top: hex(0x04051a), hor: hex(0x3a2366) },
    ground: hex(0x1c1e2c), ground2: hex(0x23263a), shoulder: hex(0x3b3e52), road: hex(0x2c2e3a),
    curbA: hex(0x19e6ff), curbB: hex(0xff2bd6), wallA: hex(0x4a4d60), wallB: hex(0x5a5d72), neon: true,
    boxes: [0.08, 0.37, 0.7], pads: [[0.2, 0], [0.52, 0.45], [0.82, -0.45]], ramps: [0.62],
  },
];

function catmullC(p0, p1, p2, p3, t) {
  const d = (p, q) => Math.pow(Math.hypot(q[0] - p[0], q[1] - p[1]), 0.5) || 1e-4;
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
  const T = t1 + (t2 - t1) * t;
  const L = (a, b, ta, tb) => { const k = (T - ta) / (tb - ta); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
  const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3);
  return L(L(A1, A2, t0, t2), L(A2, A3, t1, t3), t1, t2);
}

class Track {
  constructor(def, R) {
    this.def = def; this.W = def.W; this.curbW = 1.6; this.wallD = def.W + def.margin;
    this.rnd = rng(def.id.length * 7919 + 13);
    this._spline();
    this._features();
    this.mesh = R.mesh(this._geometry());
    this.skyMesh = R.mesh(this._sky());
  }
  _spline() {
    const P = this.def.pts.map(p => [p[0] * this.def.scale, p[1] * this.def.scale]), n = P.length;
    let dense = [];
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      for (let k = 0; k < 60; k++) dense.push(catmullC(p0, p1, p2, p3, k / 60));
    }
    const resample = (pts, step) => {
      const m = pts.length, cum = [0];
      for (let i = 1; i <= m; i++) { const a = pts[i - 1], b = pts[i % m]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
      const L = cum[m], N = Math.round(L / step), out = []; let k = 0;
      for (let j = 0; j < N; j++) {
        const s = (j * L) / N; while (cum[k + 1] < s) k++;
        const a = pts[k], b = pts[(k + 1) % m], f = (s - cum[k]) / (cum[k + 1] - cum[k] || 1);
        out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      }
      return out;
    };
    let pts = resample(dense, 2);
    for (let it = 0; it < 40; it++) { // 角を丸める
      const N = pts.length, q = [];
      for (let j = 0; j < N; j++) { const a = pts[(j - 1 + N) % N], b = pts[j], c = pts[(j + 1) % N]; q.push([b[0] * 0.5 + (a[0] + c[0]) * 0.25, b[1] * 0.5 + (a[1] + c[1]) * 0.25]); }
      pts = q;
    }
    pts = resample(pts, 2);
    const N = pts.length; this.N = N;
    this.px = new Float32Array(N); this.pz = new Float32Array(N); this.tx = new Float32Array(N); this.tz = new Float32Array(N);
    this.cum = new Float32Array(N + 1); this.curv = new Float32Array(N);
    for (let j = 0; j < N; j++) { this.px[j] = pts[j][0]; this.pz[j] = pts[j][1]; }
    for (let j = 0; j < N; j++) {
      const a = (j - 1 + N) % N, b = (j + 1) % N;
      const dx = this.px[b] - this.px[a], dz = this.pz[b] - this.pz[a], l = Math.hypot(dx, dz);
      this.tx[j] = dx / l; this.tz[j] = dz / l;
      this.cum[j + 1] = this.cum[j] + Math.hypot(this.px[b] - this.px[j], this.pz[b] - this.pz[j]);
    }
    this.len = this.cum[N];
    for (let j = 0; j < N; j++) {
      const b = (j + 1) % N;
      this.curv[j] = wrapAngle(Math.atan2(this.tx[b], this.tz[b]) - Math.atan2(this.tx[j], this.tz[j])) / 2;
    }
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let j = 0; j < N; j++) { minX = Math.min(minX, this.px[j]); maxX = Math.max(maxX, this.px[j]); minZ = Math.min(minZ, this.pz[j]); maxZ = Math.max(maxZ, this.pz[j]); }
    this.bounds = { minX, maxX, minZ, maxZ, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2 };
    let minR = 1e9; for (let j = 0; j < N; j++) minR = Math.min(minR, 1 / (Math.abs(this.curv[j]) + 1e-6));
    this.minRadius = minR;
  }
  heading(i) { return Math.atan2(this.tx[i], this.tz[i]); }
  P(i, lat, y = 0, along = 0) {
    i = ((i % this.N) + this.N) % this.N;
    return [this.px[i] + this.tx[i] * along - this.tz[i] * lat, y, this.pz[i] + this.tz[i] * along + this.tx[i] * lat];
  }
  locate(x, z, hint) {
    const N = this.N; let best = hint, bd = Infinity;
    for (let k = -14; k <= 14; k++) { const j = (hint + k + N) % N, dx = x - this.px[j], dz = z - this.pz[j], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = j; } }
    return best;
  }
  locateGlobal(x, z) {
    let best = 0, bd = Infinity;
    for (let j = 0; j < this.N; j++) { const dx = x - this.px[j], dz = z - this.pz[j], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = j; } }
    return best;
  }
  lat(x, z, i) { return (x - this.px[i]) * -this.tz[i] + (z - this.pz[i]) * this.tx[i]; }
  sAt(x, z, i) { return this.cum[i] + (x - this.px[i]) * this.tx[i] + (z - this.pz[i]) * this.tz[i]; }
  // 進行方向の差(wrap考慮)
  sDiff(a, b) { let d = a - b; if (d > this.len / 2) d -= this.len; if (d < -this.len / 2) d += this.len; return d; }
  straightNear(f, span = 10) {
    const N = this.N, c = Math.round(f * N); let best = c, bv = Infinity;
    for (let k = -40; k <= 40; k++) {
      let v = 0; for (let q = -span; q <= span; q++) v += Math.abs(this.curv[(c + k + q + N) % N]);
      v += Math.abs(k) * 0.002; if (v < bv) { bv = v; best = (c + k + N) % N; }
    }
    return best;
  }
  _features() {
    const d = this.def, W = this.W;
    this.pads = d.pads.map(([f, l]) => { const i = this.straightNear(f, 6); return { i, s: this.cum[i], lat: l * W, len: 7, w: 5.5 }; });
    this.ramps = d.ramps.map(f => { const i = this.straightNear(f, 14); return { i, s: this.cum[i], len: 10, h: 2.4 }; });
    this.boxSpots = [];
    for (const f of d.boxes) {
      const i = this.straightNear(f, 4);
      for (const l of [-0.6, -0.2, 0.2, 0.6]) { const p = this.P(i, l * W); this.boxSpots.push({ x: p[0], z: p[2], i }); }
    }
  }
  // ジャンプ台の高さ
  rampAt(s, lat) {
    if (Math.abs(lat) > this.W + this.curbW) return null;
    for (const r of this.ramps) { const ds = this.sDiff(s, r.s); if (ds >= 0 && ds <= r.len) return { h: (r.h * ds) / r.len, slope: r.h / r.len }; }
    return null;
  }
  padAt(s, lat) {
    for (const p of this.pads) { const ds = this.sDiff(s, p.s); if (ds >= -p.len / 2 && ds <= p.len / 2 && Math.abs(lat - p.lat) < p.w / 2) return p; }
    return null;
  }
  clearOf(x, z, r) {
    const lim = this.wallD + 2 + r, lim2 = lim * lim;
    for (let j = 0; j < this.N; j += 2) { const dx = x - this.px[j], dz = z - this.pz[j]; if (dx * dx + dz * dz < lim2) return false; }
    return true;
  }
  _geometry() {
    const b = new MeshBuilder(), d = this.def, N = this.N, W = this.W, cw = this.curbW, wd = this.wallD, r = this.rnd;
    const up = [0, 1, 0];
    // 地面
    const B = this.bounds, ext = 760, cell = 32;
    const x0 = B.minX - ext, z0 = B.minZ - ext, nx = Math.ceil((B.maxX - B.minX + ext * 2) / cell), nz = Math.ceil((B.maxZ - B.minZ + ext * 2) / cell);
    const gc = []; for (let i = 0; i <= nx; i++) { gc.push([]); for (let k = 0; k <= nz; k++) gc[i].push(mixc(d.ground, d.ground2, r())); }
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const a = [x0 + i * cell, 0, z0 + k * cell], bb = [a[0] + cell, 0, a[2]], c = [a[0] + cell, 0, a[2] + cell], e = [a[0], 0, a[2] + cell];
      b.triC(a, bb, c, up, gc[i][k], gc[i + 1][k], gc[i + 1][k + 1]); b.triC(a, c, e, up, gc[i][k], gc[i + 1][k + 1], gc[i][k + 1]);
    }
    for (let j = 0; j < N; j++) {
      const k = j + 1;
      // 路肩
      for (const s of [-1, 1]) b.quad(this.P(j, s * (W + cw), 0.025), this.P(j, s * (wd + 1), 0.025), this.P(k, s * (wd + 1), 0.025), this.P(k, s * (W + cw), 0.025), up, d.shoulder);
      // 路面
      const rc = shade(d.road, (j >> 2) % 2 ? 1.0 : 0.95);
      b.quad(this.P(j, -W, 0.05), this.P(j, W, 0.05), this.P(k, W, 0.05), this.P(k, -W, 0.05), up, rc);
      if ((j >> 2) % 2 === 0) b.quad(this.P(j, -0.2, 0.07), this.P(j, 0.2, 0.07), this.P(k, 0.2, 0.07), this.P(k, -0.2, 0.07), up, d.neon ? hex(0x7f86ff) : hex(0xe8e8e8), d.neon ? 0.8 : 0);
      // 縁石
      for (const s of [-1, 1]) {
        let col, e = 0;
        if (d.neon) { col = s < 0 ? d.curbA : d.curbB; e = (j >> 1) % 2 ? 1 : 0.6; } else col = (j >> 1) % 2 ? d.curbA : d.curbB;
        b.quad(this.P(j, s * W, 0.08), this.P(j, s * (W + cw), 0.08), this.P(k, s * (W + cw), 0.08), this.P(k, s * W, 0.08), up, col, e);
      }
      // 壁
      for (const s of [-1, 1]) {
        const h = d.neon ? 1.1 : 1.0, col = Math.floor(j / 3) % 2 ? d.wallA : d.wallB, L = s * (wd + 0.5), L2 = s * (wd + 1.0);
        const nIn = [-s * -this.tz[j], 0, -s * this.tx[j]];
        b.quad(this.P(j, L, 0), this.P(k, L, 0), this.P(k, L, h), this.P(j, L, h), nIn, col);
        b.quad(this.P(j, L, h), this.P(k, L, h), this.P(k, L2, h), this.P(j, L2, h), up, d.neon ? (s < 0 ? d.curbA : d.curbB) : shade(col, 1.1), d.neon ? 1 : 0);
        b.quad(this.P(j, L2, 0), this.P(k, L2, 0), this.P(k, L2, h), this.P(j, L2, h), [-nIn[0], 0, -nIn[2]], shade(col, 0.8));
      }
    }
    // スタートライン(チェッカー)
    for (let a = 0; a < 2; a++) for (let q = 0; q < 14; q++) {
      const l0 = -W + (q * 2 * W) / 14, l1 = l0 + (2 * W) / 14, col = (a + q) % 2 ? hex(0x111111) : hex(0xffffff);
      b.quad(this.P(0, l0, 0.09, a * 1.4), this.P(0, l1, 0.09, a * 1.4), this.P(0, l1, 0.09, a * 1.4 + 1.4), this.P(0, l0, 0.09, a * 1.4 + 1.4), up, col);
    }
    // スタートゲート
    {
      const p = this.P(0, 0); b.m = M4.chain(M4.trans(p[0], 0, p[2]), M4.rotY(this.heading(0)));
      const gw = W + cw + 1.5, pc = d.neon ? hex(0x2b2d40) : hex(0x3d4a5c);
      b.box(-gw, 4.5, 0, 1.2, 9, 1.2, pc); b.box(gw, 4.5, 0, 1.2, 9, 1.2, pc);
      b.box(0, 9, 0, gw * 2 + 1.2, 1.6, 1.4, pc);
      for (let q = 0; q < 16; q++) for (let a = 0; a < 2; a++) b.box(-gw + 0.6 + ((q + 0.5) * (gw * 2 - 1.2)) / 16, 8.6 + a * 0.8, -0.75, (gw * 2 - 1.2) / 16, 0.8, 0.05, (q + a) % 2 ? hex(0x111111) : hex(0xffffff), 0.7);
      b.m = null;
    }
    // ダッシュパネル
    for (const pd of this.pads) {
      const p = this.P(pd.i, pd.lat); b.m = M4.chain(M4.trans(p[0], 0.1, p[2]), M4.rotY(this.heading(pd.i)));
      b.box(0, 0, 0, pd.w, 0.06, pd.len, hex(0x332211), 0.2);
      for (let q = 0; q < 3; q++) { const z0 = -pd.len / 2 + 0.6 + q * 2.1; b.tri([-pd.w / 2 + 0.5, 0.05, z0], [0, 0.05, z0 + 1.5], [pd.w / 2 - 0.5, 0.05, z0], up, hex(0xffb020), 1); }
      b.m = null;
    }
    // ジャンプ台
    for (const rp of this.ramps) {
      const p = this.P(rp.i, 0); b.m = M4.chain(M4.trans(p[0], 0, p[2]), M4.rotY(this.heading(rp.i)));
      const w = W + cw, L = rp.len, H = rp.h, n = norm3([0, L, -H]), bands = 5;
      for (let q = 0; q < bands; q++) {
        const z0 = (q * L) / bands, z1 = ((q + 1) * L) / bands, y0 = (q * H) / bands, y1 = ((q + 1) * H) / bands;
        b.quad([-w, y0 + 0.02, z0], [w, y0 + 0.02, z0], [w, y1 + 0.02, z1], [-w, y1 + 0.02, z1], n, q % 2 ? hex(0x2a2a2a) : hex(0xffd23a), q % 2 ? 0 : 0.35);
      }
      b.quad([-w, 0, L], [w, 0, L], [w, H, L], [-w, H, L], [0, 0, 1], hex(0x444444));
      for (const sx of [-w, w]) b.tri([sx, 0, 0], [sx, 0, L], [sx, H, L], [Math.sign(sx), 0, 0], hex(0x555555));
      b.m = null;
    }
    this._scenery(b);
    return b;
  }
  _scenery(b) {
    const d = this.def, r = this.rnd, B = this.bounds, t = d.theme;
    const spot = (rad, ext = 220, tries = 30) => {
      for (let k = 0; k < tries; k++) { const x = rand2(r, B.minX - ext, B.maxX + ext), z = rand2(r, B.minZ - ext, B.maxZ + ext); if (this.clearOf(x, z, rad)) return [x, z]; }
      return null;
    };
    if (t === 'meadow') {
      const leaf = [hex(0x3f9a3a), hex(0x2f8a3a), hex(0x58b043), hex(0x6dbb3c)];
      for (let n = 0; n < 340; n++) {
        const p = spot(3); if (!p) continue; const s = 0.8 + r() * 0.8, [x, z] = p;
        b.cyl(x, 0, z, 0.45 * s, 3 * s, 6, hex(0x7a5232));
        if (r() < 0.55) { const g = leaf[(r() * 4) | 0]; b.sphere(x, 4 * s, z, 2.5 * s, 8, g, 0, 0.9); b.sphere(x + 0.9 * s, 5 * s, z + 0.5 * s, 1.7 * s, 8, shade(g, 1.12)); }
        else { const g = hex(0x2c7a45); b.cone(x, 2 * s, z, 2.7 * s, 4.2 * s, 8, g); b.cone(x, 4.4 * s, z, 1.9 * s, 3.4 * s, 8, shade(g, 1.15)); }
      }
      const fl = [hex(0xff5a7a), hex(0xffe14a), hex(0xffffff), hex(0xb07aff), hex(0xff9a3a)];
      for (let n = 0; n < 900; n++) { const p = spot(0.3, 120, 6); if (p) b.box(p[0], 0.25, p[1], 0.5, 0.5, 0.5, fl[(r() * 5) | 0], 0.25); }
      for (let n = 0; n < 60; n++) { const p = spot(2, 200); if (p) b.sphere(p[0], 0.4, p[1], 1 + r() * 1.5, 7, hex(0x9a9a92), 0, 0.6); }
      for (let n = 0; n < 4; n++) { const p = spot(30, 160, 60); if (p) b.disc(p[0], 0.03, p[1], 22 + r() * 14, 24, hex(0x3d9be0), 0.25); }
      for (let n = 0; n < 12; n++) { // 家
        const p = spot(7, 200); if (!p) continue; const [x, z] = p; b.m = M4.chain(M4.trans(x, 0, z), M4.rotY(r() * TAU));
        b.box(0, 2.2, 0, 7, 4.4, 6, hex(0xf3ead8)); b.m = M4.chain(b.m, M4.trans(0, 4.4, 0));
        const rc = [hex(0xd2483f), hex(0x3f6fd2), hex(0xe08a2e)][n % 3];
        b.quad([-4, 0, -3.4], [4, 0, -3.4], [4, 2.6, 0], [-4, 2.6, 0], norm3([0, 1, -1]), rc); b.quad([-4, 0, 3.4], [4, 0, 3.4], [4, 2.6, 0], [-4, 2.6, 0], norm3([0, 1, 1]), rc);
        b.m = null;
      }
    } else if (t === 'desert') {
      for (let n = 0; n < 26; n++) { // メサ(台地)
        const p = spot(40, 420, 40); if (!p) continue; const [x, z] = p, R0 = 22 + r() * 26, H = 18 + r() * 40;
        b.cyl(x, 0, z, R0, H * 0.45, 12, hex(0xb5603a)); b.cyl(x, H * 0.45, z, R0 * 0.92, H * 0.3, 12, hex(0xc8784a)); b.cyl(x, H * 0.75, z, R0 * 0.85, H * 0.25, 12, hex(0xa9553a));
      }
      for (let n = 0; n < 220; n++) { // サボテン
        const p = spot(2, 200); if (!p) continue; const [x, z] = p, s = 0.8 + r() * 0.7, g = hex(0x4f8a3a);
        b.cyl(x, 0, z, 0.6 * s, 6 * s, 7, g); b.sphere(x, 6 * s, z, 0.6 * s, 7, g);
        if (r() < 0.8) { b.box(x + 1 * s, 2.6 * s, z, 1.6 * s, 0.9 * s, 0.9 * s, g); b.cyl(x + 1.6 * s, 2.6 * s, z, 0.45 * s, 2.2 * s, 6, g); }
        if (r() < 0.6) { b.box(x - 0.9 * s, 3.4 * s, z, 1.4 * s, 0.8 * s, 0.8 * s, g); b.cyl(x - 1.4 * s, 3.4 * s, z, 0.4 * s, 1.8 * s, 6, g); }
      }
      for (let n = 0; n < 160; n++) {
        const p = spot(3, 260); if (!p) continue; const [x, z] = p; b.m = M4.chain(M4.trans(x, 0, z), M4.rotY(r() * TAU), M4.rotZ(r() * 0.4 - 0.2));
        b.box(0, 0.8, 0, 2 + r() * 4, 1.6 + r() * 2.5, 2 + r() * 3, [hex(0xa85a3c), hex(0x8f4c33), hex(0xc27650)][n % 3]); b.m = null;
      }
      for (let n = 0; n < 400; n++) { const p = spot(0.5, 150, 6); if (p) b.sphere(p[0], 0.3, p[1], 0.6 + r() * 0.5, 6, hex(0x8a8a4a), 0, 0.7); }
    } else if (t === 'city') {
      const wc = [hex(0xffd36a), hex(0x7fe8ff), hex(0xff8ae0), hex(0xfff3c4)];
      for (let n = 0; n < 900; n++) {
        const x = rand2(r, B.minX - 260, B.maxX + 260), z = rand2(r, B.minZ - 260, B.maxZ + 260), sx = 10 + r() * 14, sz = 10 + r() * 14;
        if (!this.clearOf(x, z, Math.max(sx, sz) * 0.75)) continue;
        const H = 14 + r() * r() * 90, bc = [hex(0x2a2d45), hex(0x33264a), hex(0x1f2c3f), hex(0x3a3550)][(r() * 4) | 0];
        b.box(x, H / 2, z, sx, H, sz, bc);
        const win = wc[(r() * 4) | 0], rows = Math.floor(H / 4);
        for (const [fx, fz, nx, nz, w] of [[0, sz / 2 + 0.05, 0, 1, sx], [0, -sz / 2 - 0.05, 0, -1, sx], [sx / 2 + 0.05, 0, 1, 0, sz], [-sx / 2 - 0.05, 0, -1, 0, sz]]) {
          const cols = Math.floor(w / 3);
          for (let q = 0; q < rows; q++) for (let c = 0; c < cols; c++) {
            if (r() > 0.42) continue; const u = -w / 2 + 1.5 + c * 3, y = 2 + q * 4;
            const px = x + fx + (nz !== 0 ? u : 0), pz = z + fz + (nx !== 0 ? u : 0);
            if (nz !== 0) b.quad([px - 0.8, y, pz], [px + 0.8, y, pz], [px + 0.8, y + 1.8, pz], [px - 0.8, y + 1.8, pz], [0, 0, nz], win, 1);
            else b.quad([px, y, pz - 0.8], [px, y, pz + 0.8], [px, y + 1.8, pz + 0.8], [px, y + 1.8, pz - 0.8], [nx, 0, 0], win, 1);
          }
        }
        if (r() < 0.25) b.box(x, H + 1.5, z, sx * 0.7, 2.4, 0.4, [hex(0xff2bd6), hex(0x19e6ff), hex(0xffe14a)][(r() * 3) | 0], 1);
      }
      for (let j = 0; j < this.N; j += 14) for (const s of [-1, 1]) { // 街灯
        const p = this.P(j, s * (this.wallD + 2)); b.cyl(p[0], 0, p[2], 0.2, 7, 6, hex(0x555a6a)); b.sphere(p[0], 7.2, p[2], 0.7, 8, hex(0xfff0c0), 1);
      }
    }
  }
  _sky() {
    const b = new MeshBuilder(), s = this.def.sky, R = 60, seg = 24, rings = 16, r = rng(99);
    const col = y => (y > 0 ? mixc(s.hor, s.top, Math.pow(y, 0.6)) : s.hor);
    for (let j = 0; j < rings; j++) {
      const t0 = (j / rings) * Math.PI, t1 = ((j + 1) / rings) * Math.PI;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
        const v = (t, a) => [Math.sin(t) * Math.cos(a) * R, Math.cos(t) * R, Math.sin(t) * Math.sin(a) * R];
        const p00 = v(t0, a0), p01 = v(t0, a1), p10 = v(t1, a0), p11 = v(t1, a1), n = [0, 1, 0];
        b.triC(p00, p10, p11, n, col(p00[1] / R), col(p10[1] / R), col(p11[1] / R), 1);
        b.triC(p00, p11, p01, n, col(p00[1] / R), col(p11[1] / R), col(p01[1] / R), 1);
      }
    }
    const t = this.def.theme, L = this.def.env.light;
    if (t === 'city') {
      for (let n = 0; n < 500; n++) { const a = r() * TAU, e = 0.08 + r() * 1.4, d = 50; const x = Math.cos(a) * Math.cos(e) * d, y = Math.sin(e) * d, z = Math.sin(a) * Math.cos(e) * d; const sz = 0.06 + r() * 0.12; b.box(x, y, z, sz, sz, sz, [1, 1, 0.95], 1); }
      b.sphere(L[0] * 45, L[1] * 30 + 6, L[2] * 45, 2.6, 16, hex(0xfff6d8), 1);
    } else {
      const sunP = [L[0] * 48, Math.max(4, L[1] * 48), L[2] * 48];
      b.sphere(sunP[0], sunP[1], sunP[2], t === 'desert' ? 4.5 : 2.4, 16, t === 'desert' ? hex(0xffe0a0) : hex(0xfffbe8), 1);
      for (let n = 0; n < 26; n++) { // 雲
        const a = r() * TAU, d = 42, y = 8 + r() * 16, cx = Math.cos(a) * d, cz = Math.sin(a) * d, k = 1 + r() * 1.5;
        const cc = t === 'desert' ? hex(0xffd6b0) : hex(0xffffff);
        for (let q = 0; q < 5; q++) b.sphere(cx + (r() - 0.5) * 6 * k, y + r() * 1.2, cz + (r() - 0.5) * 6 * k, (1.2 + r() * 1.4) * k, 8, cc, 0.75, 0.55);
      }
    }
    // 遠くの山並み
    const mc = t === 'meadow' ? hex(0x6f9fc0) : t === 'desert' ? hex(0xc07a6a) : hex(0x2a2550);
    for (let n = 0; n < 40; n++) {
      const a = (n / 40) * TAU + r() * 0.1, d = 52, x = Math.cos(a) * d, z = Math.sin(a) * d, h = (t === 'city' ? 3 : 5) + r() * 7, rad = 6 + r() * 8;
      const c = mixc(mc, s.hor, 0.25 + r() * 0.2);
      if (t === 'city') b.box(x, h / 2 - 1, z, rad * 0.5, h, rad * 0.5, c, 1);
      else { b.cone(x, -1, z, rad, h, 10, c, 1); if (t === 'meadow' && h > 9) b.cone(x, -1 + h * 0.7, z, rad * 0.3, h * 0.3, 10, hex(0xf4f8ff), 1); }
    }
    return b;
  }
}
function rand2(r, a, b) { return a + r() * (b - a); }
