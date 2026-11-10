'use strict';
// ===== アイテム =====
const ITEMS = {
  nitro: { name: 'ダッシュにんじん', icon: 'item_carrot' },
  nitro3: { name: 'にんじん×3', icon: 'item_carrot3' },
  oil: { name: 'どろんこ', icon: 'item_mud' },
  ball: { name: 'けいとだま', icon: 'item_yarn' },
  missile: { name: 'おっかけハチ', icon: 'item_bee' },
  shield: { name: 'シャボンだま', icon: 'item_bubble' },
  rocket: { name: 'ながれぼし', icon: 'item_star' },
};
const ITEM_TABLE = [
  { oil: 4, ball: 3, shield: 2, nitro: 1 },
  { oil: 2, ball: 3, nitro: 2, missile: 2, shield: 1 },
  { ball: 2, nitro: 3, missile: 3, nitro3: 2, shield: 1 },
  { nitro3: 4, missile: 3, nitro: 2, rocket: 1 },
  { nitro3: 3, missile: 2, rocket: 3 },
];

class Items {
  constructor(game, R) {
    this.g = game; this.boxes = []; this.hazards = []; this.proj = [];
    for (const s of game.track.boxSpots) this.boxes.push({ x: s.x, z: s.z, alive: true, t: 0, ph: Math.random() * TAU });
    if (!Items.meshes) {
      const M = (Items.meshes = {});
      let b = new MeshBuilder();
      const faces = [[0.95, 0.3, 0.35], [1, 0.75, 0.2], [0.35, 0.9, 0.4], [0.3, 0.6, 1], [0.75, 0.4, 1], [1, 0.5, 0.8]];
      const s = 0.9, F = [[[s, 0, 0], [1, 0, 0]], [[-s, 0, 0], [-1, 0, 0]], [[0, s, 0], [0, 1, 0]], [[0, -s, 0], [0, -1, 0]], [[0, 0, s], [0, 0, 1]], [[0, 0, -s], [0, 0, -1]]];
      F.forEach(([c, n], i) => { const sx = n[0] ? 0.02 : 1.8, sy = n[1] ? 0.02 : 1.8, sz = n[2] ? 0.02 : 1.8; b.box(c[0], c[1], c[2], sx, sy, sz, faces[i], 0.55); });
      M.box = R.mesh(b);
      b = new MeshBuilder(); b.box(0, 0.25, 0, 0.32, 0.9, 0.32, [1, 1, 1], 1); b.box(0, -0.45, 0, 0.32, 0.3, 0.32, [1, 1, 1], 1); M.inner = R.mesh(b);
      b = new MeshBuilder(); b.disc(0, 0, 0, 2.0, 12, hex(0x5a3618), 0.15); b.disc(0.5, 0.01, -0.4, 0.9, 8, hex(0x7a4e26), 0.25); b.disc(-0.6, 0.02, 0.5, 0.45, 6, hex(0x8f6030), 0.3); M.oil = R.mesh(b);
      b = new MeshBuilder(); b.sphere(0, 0, 0, 0.75, 14, hex(0xe83a3a), 0.25); b.box(0, 0, 0, 1.56, 0.25, 0.25, [1, 1, 1], 0.4); M.ball = R.mesh(b);
      b = new MeshBuilder(); b.m = M4.rotX(Math.PI / 2);
      b.cyl(0, -1.0, 0, 0.35, 1.6, 10, hex(0xf2f2f2)); b.cone(0, 0.6, 0, 0.35, 0.7, 10, hex(0xe02a2a), 0.2); b.m = null;
      b.box(0, 0, -0.85, 1.3, 0.08, 0.4, hex(0xe02a2a)); b.box(0, 0, -0.85, 0.08, 1.3, 0.4, hex(0xe02a2a)); M.missile = R.mesh(b);
      b = new MeshBuilder(); b.sphere(0, 0, 0, 2.3, 12, [0.55, 0.85, 1], 1); b.sphere(-1.0, 1.0, -1.2, 0.45, 6, [1, 1, 1], 1); M.shield = R.mesh(b);
      b = new MeshBuilder(); b.disc(0, 0, 0, 1, 16, [0, 0, 0], 1); M.shadow = R.mesh(b);
    }
  }
  pick(k) {
    const rank = this.g.rankOf(k), n = this.g.karts.length;
    const grp = rank === 1 ? 0 : rank <= Math.ceil(n * 0.38) ? 1 : rank <= Math.ceil(n * 0.63) ? 2 : rank < n ? 3 : 4;
    const t = ITEM_TABLE[grp]; let sum = 0; for (const k2 in t) sum += t[k2];
    let r = Math.random() * sum; for (const k2 in t) { r -= t[k2]; if (r <= 0) return k2; }
    return 'nitro';
  }
  finishRoulette(k) {
    k.item = this.pick(k); k.itemCount = k.item === 'nitro3' ? 3 : 1;
    if (k.isPlayer) SND.sfx('get');
  }
  use(k, back) {
    if (!k.item || k.roulette > 0) return;
    const it = k.item, g = this.g;
    k.itemCount--; if (k.itemCount <= 0) k.item = null;
    if (it === 'nitro' || it === 'nitro3') { k.boost = Math.max(k.boost, 1.3); if (k.isPlayer) SND.sfx('carrot'); }
    else if (it === 'shield') { k.shield = 10; if (k.isPlayer) SND.sfx('shield'); }
    else if (it === 'rocket') { k.rocket = 3.6; k.drifting = false; if (k.isPlayer) SND.sfx('rocket'); }
    else if (it === 'oil') {
      const p = back === 'front' ? k.wp(0, 0, 14) : k.wp(0, 0, -2.8);
      this.hazards.push({ type: 'oil', x: p[0], z: p[2], owner: k, t: 0 }); if (k.isPlayer) SND.sfx('mud');
      if (this.hazards.length > 40) this.hazards.shift();
    } else if (it === 'ball' || it === 'missile') {
      const dir = back ? k.h + Math.PI : k.h, sp = (it === 'missile' ? 70 : 64) + Math.max(0, k.speed) * 0.5;
      const p = k.wp(0, 0, back ? -2.5 : 2.6);
      let target = null;
      if (it === 'missile' && !back) { const r = g.rankOf(k); if (r > 1) target = g.ranking[r - 2]; }
      this.proj.push({ type: it, x: p[0], z: p[2], y: it === 'missile' ? 1.4 : 0.8, h: dir, vx: Math.sin(dir) * sp, vz: Math.cos(dir) * sp, sp, life: it === 'missile' ? 9 : 7, owner: k, t: 0, ti: k.ti, target });
      if (k.isPlayer || g.near(k)) SND.sfx(it === 'missile' ? 'bee' : 'yarn');
    }
  }
  aiWants(k, cA) {
    const g = this.g;
    switch (k.item) {
      case 'nitro': case 'nitro3': return Math.abs(cA) < 0.5;
      case 'missile': return g.rankOf(k) > 1;
      case 'ball':
        for (const o of g.karts) { if (o === k) continue; const dx = o.x - k.x, dz = o.z - k.z, a = dx * k.fx + dz * k.fz, l = Math.abs(dx * -k.fz + dz * k.fx); if (a > 5 && a < 55 && l < 4) return true; }
        return k.ai.itemHold > 9;
      case 'oil':
        for (const o of g.karts) { if (o === k) continue; const dx = o.x - k.x, dz = o.z - k.z, a = dx * k.fx + dz * k.fz; if (a < -3 && a > -25 && Math.abs(dx * -k.fz + dz * k.fx) < 5) return true; }
        return k.ai.itemHold > 11;
      default: return true;
    }
  }
  update(dt) {
    const g = this.g, T = g.track, P = g.fx;
    for (const b of this.boxes) {
      b.t += dt; if (!b.alive) { if (b.t > 2.5) { b.alive = true; b.t = 0; } continue; }
      for (const k of g.karts) {
        const dx = k.x - b.x, dz = k.z - b.z;
        if (dx * dx + dz * dz < 2.6 * 2.6 && k.y < 3) {
          b.alive = false; b.t = 0;
          if (g.near(b)) P.burst(b.x, 1.5, b.z, 18, 9, 0.6, 0.5, hsl(Math.random(), 0.9, 0.6));
          if (!k.item && k.roulette <= 0) { k.roulette = k.isPlayer ? 1.1 : 0.6; }
          if (k.isPlayer) SND.sfx('box');
          break;
        }
      }
    }
    for (const o of this.hazards) {
      o.t += dt;
      for (const k of g.karts) {
        if (o.dead || (k === o.owner && o.t < 0.8)) continue;
        const dx = k.x - o.x, dz = k.z - o.z;
        if (dx * dx + dz * dz < 2.3 * 2.3 && k.y < 0.8) { k.hit('oil'); o.dead = true; if (k.isPlayer) SND.sfx('mud'); }
      }
    }
    this.hazards = this.hazards.filter(o => !o.dead);
    for (const p of this.proj) {
      p.t += dt; p.life -= dt; if (p.life <= 0) { p.dead = true; continue; }
      p.ti = T.locate(p.x, p.z, p.ti);
      if (p.type === 'missile') {
        let tx, tz;
        const tg = p.target && !p.target.finished ? p.target : null;
        const d = tg ? Math.hypot(tg.x - p.x, tg.z - p.z) : 1e9;
        if (tg && d < 45) { tx = tg.x; tz = tg.z; }
        else { const q = T.P(p.ti + 10, 0); tx = q[0]; tz = q[2]; }
        const want = Math.atan2(tx - p.x, tz - p.z), turn = d < 45 ? 6 : 4;
        p.h += clamp(wrapAngle(want - p.h), -turn * dt, turn * dt);
        p.vx = Math.sin(p.h) * p.sp; p.vz = Math.cos(p.h) * p.sp;
        if (g.near(p)) P.add(p.x - p.vx * 0.02, p.y, p.z - p.vz * 0.02, rand(-1, 1), rand(-1, 1), rand(-1, 1), 0.35, 0.8, [1, 0.6, 0.2], 1, true, 0, 2, 1);
      }
      p.x += p.vx * dt; p.z += p.vz * dt;
      const lat = T.lat(p.x, p.z, p.ti), lim = T.wallD - 0.8;
      if (Math.abs(lat) > lim) {
        const rx = -T.tz[p.ti], rz = T.tx[p.ti], sg = Math.sign(lat), vl = p.vx * rx + p.vz * rz;
        p.x -= rx * (Math.abs(lat) - lim) * sg; p.z -= rz * (Math.abs(lat) - lim) * sg;
        if (vl * sg > 0) { p.vx -= 2 * vl * rx; p.vz -= 2 * vl * rz; p.h = Math.atan2(p.vx, p.vz); }
      }
      for (const k of g.karts) {
        if (k === p.owner && p.t < 0.5) continue;
        const dx = k.x - p.x, dz = k.z - p.z;
        if (dx * dx + dz * dz < 2.1 * 2.1 && Math.abs(k.y + 0.8 - p.y) < 2.2) {
          p.dead = true; k.hit(p.type);
          if (g.near(p)) { P.burst(p.x, p.y, p.z, 30, 14, 0.6, 1.2, [1, 0.6, 0.15]); P.burst(p.x, p.y, p.z, 14, 6, 0.9, 2, [0.4, 0.4, 0.4], false); }
          if (k.isPlayer || p.owner.isPlayer) SND.sfx('explode');
          break;
        }
      }
    }
    this.proj = this.proj.filter(p => !p.dead);
  }
  draw(R) {
    const M = Items.meshes;
    for (const o of this.hazards) R.draw(M.oil, M4.trans(o.x, 0.12, o.z));
  }
  // ドット絵: ？ボックス・けいとだま・おっかけハチ
  drawSprites(S) {
    const t = this.g.time;
    for (const b of this.boxes) {
      if (!b.alive && b.t < 2.2) continue;
      const sc = b.alive ? 1 : (b.t - 2.2) / 0.3;
      S.add('item_box', b.x, 1.5 + Math.sin(t * 2 + b.ph) * 0.25, b.z, 2.4 * sc, { center: true, flip: Math.sin(t * 1.5 + b.ph) < 0 });
    }
    for (const p of this.proj) {
      if (p.type === 'ball') S.add('item_yarn', p.x, p.y - 0.1 + Math.abs(Math.sin(p.t * 9)) * 0.6, p.z, 1.6, { center: true, flip: Math.sin(p.t * 12) < 0 });
      else {
        const flip = Math.sin(p.h) * S.right[0] + Math.cos(p.h) * S.right[2] < 0;
        S.add('item_bee', p.x, p.y + Math.sin(p.t * 9) * 0.25, p.z, 1.7, { center: true, flip });
      }
    }
  }
  drawTrans(R) {
    const M = Items.meshes, t = this.g.time;
    R.blend('add');
    for (const k of this.g.karts) if (k.shield > 0) R.draw(M.shield, M4.chain(M4.trans(k.x, k.y + 1.1, k.z), M4.scale(1, 0.85, 1.1)), null, 0.22 + 0.06 * Math.sin(t * 8));
    R.blend(null);
  }
}
