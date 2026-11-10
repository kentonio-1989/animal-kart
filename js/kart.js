'use strict';
// ===== ドライバーとカート =====
const DRIVERS = [
  { name: 'ポチ', animal: 'dog', kind: 'イヌ', color: hex(0x2f7bff), speed: 3, accel: 3, handling: 3, weight: 3, desc: 'バランス型' },
  { name: 'ミケ', animal: 'cat', kind: 'ネコ', color: hex(0xe8333a), speed: 4, accel: 2, handling: 3, weight: 3, desc: 'スピード型' },
  { name: 'ケロスケ', animal: 'frog', kind: 'カエル', color: hex(0x2fbf4f), speed: 3, accel: 3, handling: 4, weight: 2, desc: '曲がりやすい' },
  { name: 'ピヨ', animal: 'chick', kind: 'ヒヨコ', color: hex(0xffc928), speed: 2, accel: 5, handling: 3, weight: 2, desc: '加速が速い' },
  { name: 'ゴンタ', animal: 'bear', kind: 'クマ', color: hex(0x5b4b8a), speed: 5, accel: 1, handling: 2, weight: 5, desc: '重くて速い' },
  { name: 'ミミ', animal: 'rabbit', kind: 'ウサギ', color: hex(0xff79b8), speed: 2, accel: 4, handling: 5, weight: 1, desc: '軽くてキビキビ' },
  { name: 'タンタン', animal: 'panda', kind: 'パンダ', color: hex(0xeeeeee), speed: 3, accel: 4, handling: 4, weight: 2, desc: '扱いやすい' },
  { name: 'トラキチ', animal: 'tiger', kind: 'トラ', color: hex(0xff8a2a), speed: 4, accel: 3, handling: 2, weight: 4, desc: 'パワー型' },
];

function buildKartMesh(c) {
  const b = new MeshBuilder(), dark = hex(0x24262c), metal = hex(0xa0a6b0), seat = hex(0x30323a);
  b.box(0, 0.42, 0, 1.7, 0.2, 2.6, dark);
  b.box(0, 0.62, 0.55, 1.35, 0.38, 1.5, c);
  b.box(0, 0.5, 1.38, 1.7, 0.24, 0.32, shade(c, 0.75));
  b.box(0, 0.83, 0.95, 0.9, 0.16, 0.7, shade(c, 1.15));
  b.box(-0.82, 0.6, -0.2, 0.26, 0.34, 1.5, c); b.box(0.82, 0.6, -0.2, 0.26, 0.34, 1.5, c);
  b.box(0, 0.8, -0.45, 0.95, 0.2, 0.8, seat); b.box(0, 1.0, -0.9, 0.95, 0.42, 0.18, seat);
  b.box(0, 0.85, -1.1, 1.0, 0.5, 0.55, metal);
  b.box(-0.32, 0.8, -1.45, 0.2, 0.2, 0.5, hex(0x77777f)); b.box(0.32, 0.8, -1.45, 0.2, 0.2, 0.5, hex(0x77777f));
  b.box(-0.6, 1.0, -1.3, 0.1, 0.4, 0.1, dark); b.box(0.6, 1.0, -1.3, 0.1, 0.4, 0.1, dark);
  b.box(0, 1.22, -1.35, 1.8, 0.1, 0.5, c);
  b.box(0, 1.0, 0.35, 0.08, 0.08, 0.6, dark);
  b.m = M4.chain(M4.trans(0, 1.12, 0.12), M4.rotX(1.1)); b.cyl(0, -0.04, 0, 0.28, 0.08, 10, dark); b.m = null;
  return b;
}
function buildWheelMesh() {
  const b = new MeshBuilder();
  b.m = M4.rotZ(Math.PI / 2); b.cyl(0, -0.5, 0, 1, 1, 14, hex(0x1a1a1e)); b.cyl(0, -0.53, 0, 0.55, 1.06, 10, hex(0xb8bcc4)); b.m = null;
  b.box(0, 0, 0, 1.08, 0.22, 1.25, hex(0x6a6e78));
  return b;
}
const WHEELS = [[0.92, 0.36, 0.95, 0.36, 1], [-0.92, 0.36, 0.95, 0.36, 1], [0.95, 0.44, -0.9, 0.44, 0], [-0.95, 0.44, -0.9, 0.44, 0]];
const SPARK = [[0.7, 0.7, 0.7], [0.35, 0.85, 1], [1, 0.78, 0.15], [1, 0.3, 0.85]];

class Kart {
  constructor(game, drv, idx, isPlayer) {
    this.g = game; this.drv = drv; this.idx = idx; this.isPlayer = isPlayer; this.name = drv.name;
    this.maxSpeed = 30 + drv.speed * 1.25; this.accel = 0.5 + drv.accel * 0.13; this.turn = 1.5 + drv.handling * 0.13; this.weight = 1 + drv.weight * 0.25;
    this.x = 0; this.z = 0; this.y = 0; this.vy = 0; this.h = 0; this.vx = 0; this.vz = 0; this.groundY = 0;
    this.ti = 0; this.raceDist = 0; this.lastS = 0; this.lat = 0; this.finished = false; this.finishTime = 0; this.lapShown = 1;
    this.item = null; this.itemCount = 0; this.roulette = 0;
    this.boost = 0; this.spin = 0; this.spinAng = 0; this.shield = 0; this.rocket = 0; this.invul = 0; this.padCool = 0;
    this.drifting = false; this.driftDir = 0; this.driftCharge = 0; this.driftLv = 0; this.hopping = false; this.onRamp = false;
    this.wheelRot = 0; this.steerVis = 0; this.lean = 0; this.visYaw = 0; this.airTime = 0; this.offroad = false; this.wrong = 0; this.speed = 0;
    this.input = { steer: 0, throttle: 0, brake: false, drift: false, driftPressed: false };
    this.ai = { lane: rand(-0.4, 0.4), laneTarget: 0, laneT: 0, skill: 0.5, speedMul: 1, itemDelay: 2, itemHold: 0, boostCool: 0 };
    this.stall = 0; this.rocketStart = 0;
  }
  get fx() { return Math.sin(this.h); }
  get fz() { return Math.cos(this.h); }
  wp(lx, ly, lz) {
    const a = this.h + this.visYaw + this.spinAng, c = Math.cos(a), s = Math.sin(a);
    return [this.x + lx * c + lz * s, this.y + ly, this.z - lx * s + lz * c];
  }
  hit(kind) {
    if (this.rocket > 0 || this.invul > 0) return false;
    if (this.shield > 0) { this.shield = 0; this.invul = 0.5; if (this.isPlayer) SND.sfx('pop'); this.g.fx.burst(this.x, this.y + 1.2, this.z, 24, 10, 0.5, 0.6, [0.4, 0.9, 1]); return false; }
    this.spin = kind === 'missile' ? 1.5 : 1.1; this.invul = this.spin + 0.6;
    if (kind === 'missile') this.vy = 9;
    this.drifting = false; this.driftLv = 0; this.boost = 0; this.hopping = false;
    if (this.isPlayer) { SND.sfx('hit'); SND.voice(this.drv.animal); }
    else if (this.g.near(this)) SND.voice(this.drv.animal);
    return true;
  }
  update(dt) {
    const g = this.g, T = g.track, inp = this.input;
    this.ti = T.locate(this.x, this.z, this.ti);
    const lat = T.lat(this.x, this.z, this.ti), s = T.sAt(this.x, this.z, this.ti);
    this.raceDist += T.sDiff(s, this.lastS); this.lastS = s; this.lat = lat;
    for (const k of ['boost', 'spin', 'shield', 'rocket', 'invul', 'padCool', 'stall']) if (this[k] > 0) this[k] = Math.max(0, this[k] - dt);
    if (this.roulette > 0) { this.roulette -= dt; if (this.roulette <= 0) g.items.finishRoulette(this); }

    const grounded = this.y <= this.groundY + 0.02 && this.vy <= 0.01;
    let speed = this.vx * Math.sin(this.h) + this.vz * Math.cos(this.h);

    this.offroad = Math.abs(lat) > T.W + T.curbW * 0.6;
    let maxV = this.maxSpeed * g.speedScale * (this.isPlayer ? 1 : this.ai.speedMul);
    let surf = this.offroad && grounded ? T.def.offroad : 1;
    if (this.boost > 0) surf = Math.max(surf, 0.95);
    if (this.rocket > 0) { maxV *= 1.55; surf = 1; } else if (this.boost > 0) maxV *= 1.32;
    maxV *= surf;

    const canDrive = g.canDrive && this.spin <= 0 && this.stall <= 0;
    let thr = canDrive ? inp.throttle : 0, steer = canDrive ? inp.steer : 0;
    if (this.rocket > 0) thr = 1;
    if (this.boost > 0 || this.rocket > 0) speed += (maxV - speed) * 3.5 * dt;
    else if (thr > 0 && speed < maxV) speed += ((maxV - speed) * this.accel + 3) * thr * dt;
    else if (speed > maxV) speed += (maxV - speed) * 1.8 * dt;
    if (inp.brake && canDrive && this.rocket <= 0) { if (speed > 0.5) speed -= 36 * dt; else speed = Math.max(speed - 14 * dt, -11); }
    if (!thr && !(inp.brake && canDrive)) speed *= 1 - 0.75 * dt;
    if (this.spin > 0) speed *= 1 - 2.4 * dt;

    // ドリフト
    if (inp.driftPressed && canDrive && grounded && speed > 8 && !this.drifting && !this.hopping && this.rocket <= 0) {
      this.vy = 5.5; this.hopping = true; if (this.isPlayer) SND.sfx('hop');
    }
    inp.driftPressed = false;
    if (this.hopping && grounded) {
      this.hopping = false;
      if (inp.drift && Math.abs(steer) > 0.25 && speed > 10) { this.drifting = true; this.driftDir = Math.sign(steer); this.driftCharge = 0; this.driftLv = 0; }
    }
    if (this.drifting) {
      if (!inp.drift || speed < 8 || !canDrive) {
        const bt = [0, 0.6, 1.05, 1.6][this.driftLv];
        if (bt > 0 && canDrive) { this.boost = Math.max(this.boost, bt); if (this.isPlayer) SND.sfx('boost'); }
        this.drifting = false; this.driftLv = 0; this.driftCharge = 0;
      } else {
        this.driftCharge += dt * (0.55 + 0.95 * Math.max(0, steer * this.driftDir));
        const lv = this.driftCharge > 3.3 ? 3 : this.driftCharge > 2.0 ? 2 : this.driftCharge > 0.95 ? 1 : 0;
        if (lv > this.driftLv) { this.driftLv = lv; if (this.isPlayer) SND.sfx('mini'); }
      }
    }

    // ハンドル
    const af = Math.abs(speed), sf = Math.max(clamp(af / 9, 0, 1), thr > 0 || (inp.brake && canDrive) ? 0.45 : 0) * (1 - 0.15 * clamp(af / 40, 0, 1));
    let st = steer;
    if (this.drifting) st = this.driftDir * (0.5 + 0.55 * steer * this.driftDir);
    const turnRate = this.turn * (this.drifting ? 1.32 : 1) * (grounded ? 1 : 0.55);
    this.h -= st * turnRate * sf * (speed < -0.5 ? -1 : 1) * dt;
    const nfx = Math.sin(this.h), nfz = Math.cos(this.h);
    const grip = this.spin > 0 ? 1.2 : !grounded ? 0.7 : this.drifting ? 2.4 : 10;
    const k = Math.exp(-grip * dt), vf = this.vx * nfx + this.vz * nfz;
    const lx = (this.vx - nfx * vf) * k, lz = (this.vz - nfz * vf) * k;
    this.vx = nfx * speed + lx; this.vz = nfz * speed + lz;
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.speed = speed;

    // 高さ(ジャンプ台・ホップ)
    const ramp = T.rampAt(s, lat), gy = ramp ? ramp.h : 0, vAlong = this.vx * T.tx[this.ti] + this.vz * T.tz[this.ti];
    const wasAir = this.y > this.groundY + 0.05;
    if (ramp && this.y <= gy + 0.3 && this.vy <= ramp.slope * vAlong + 0.5 && !this.hopping) {
      this.y = gy; this.vy = Math.max(0, ramp.slope * vAlong); this.onRamp = true;
    } else {
      if (this.onRamp && !ramp) { this.vy *= 1.45; this.boost = Math.max(this.boost, 0.7); if (this.isPlayer) SND.sfx('boost'); }
      this.onRamp = false;
      this.vy -= 32 * dt; this.y += this.vy * dt;
      if (this.y <= gy) {
        if (wasAir && this.airTime > 0.25 && this.g.near(this)) this.g.fx.burst(this.x, 0.3, this.z, 8, 5, 0.5, 1.2, T.def.shoulder, false);
        this.y = gy; this.vy = this.vy < -10 ? -this.vy * 0.2 : 0;
      }
    }
    this.groundY = gy;
    this.airTime = this.y > gy + 0.05 ? this.airTime + dt : 0;

    // ダッシュパネル
    if (this.y < 0.5 && this.padCool <= 0 && T.padAt(s, lat)) { this.boost = Math.max(this.boost, 1.2); this.padCool = 0.4; if (this.isPlayer) SND.sfx('boost'); }

    // 壁
    const ti2 = T.locate(this.x, this.z, this.ti), lat2 = T.lat(this.x, this.z, ti2), lim = T.wallD - 1.0;
    if (Math.abs(lat2) > lim) {
      const sg = Math.sign(lat2), over = Math.abs(lat2) - lim, rx = -T.tz[ti2], rz = T.tx[ti2];
      this.x -= rx * over * sg; this.z -= rz * over * sg;
      const vl = this.vx * rx + this.vz * rz;
      if (vl * sg > 0) {
        this.vx -= rx * vl * 1.35; this.vz -= rz * vl * 1.35;
        if (Math.abs(vl) > 7) { this.vx *= 0.75; this.vz *= 0.75; if (this.isPlayer) SND.sfx('wall'); if (this.g.near(this)) this.g.fx.burst(this.x + rx * sg, this.y + 0.6, this.z + rz * sg, 10, 8, 0.3, 0.35, [1, 0.85, 0.4]); }
        else { this.vx *= 1 - 1.5 * dt; this.vz *= 1 - 1.5 * dt; }
      }
    }

    // 見た目
    this.wheelRot += (speed / 0.42) * dt;
    this.steerVis += ((this.drifting ? this.driftDir * 0.6 : steer) - this.steerVis) * Math.min(1, dt * 10);
    this.visYaw += ((this.drifting ? -this.driftDir * 0.38 : 0) - this.visYaw) * Math.min(1, dt * 6);
    this.lean += (-this.steerVis * 0.07 * clamp(af / 30, 0, 1) - this.lean) * Math.min(1, dt * 8);
    if (this.spin > 0) this.spinAng += dt * TAU * 1.7;
    else if (this.spinAng !== 0) { this.spinAng = 0; }
    this._particles(dt, af);
  }
  _particles(dt, af) {
    const g = this.g; if (!g.near(this)) return; const P = g.fx;
    if (this.drifting && this.y < this.groundY + 0.3) {
      const c = SPARK[this.driftLv];
      for (const sx of [0.95, -0.95]) {
        const p = this.wp(sx, 0.15, -1.1), n = this.driftLv ? 2 : 1;
        for (let i = 0; i < n; i++) P.add(p[0], p[1], p[2], rand(-3, 3) - this.vx * 0.1, rand(1, 4), rand(-3, 3) - this.vz * 0.1, 0.25, this.driftLv ? 0.35 : 0.6, c, this.driftLv ? 1 : 0.35, this.driftLv > 0, 10, 2);
      }
    }
    if (this.boost > 0 || this.rocket > 0) {
      for (const sx of [0.32, -0.32]) {
        if (Math.random() < 0.45) continue;
        const p = this.wp(sx, 0.8, -1.75), bk = this.wp(0, 0, -1);
        const vx = this.vx * 0.8 + (bk[0] - this.x) * 7, vz = this.vz * 0.8 + (bk[2] - this.z) * 7;
        P.add(p[0], p[1], p[2], vx + rand(-1, 1), rand(0, 1.2), vz + rand(-1, 1), 0.14, this.rocket > 0 ? 0.8 : 0.5, Math.random() < 0.5 ? [1, 0.5, 0.1] : [1, 0.85, 0.3], 0.9, true, 0, 0, -2);
      }
    }
    if (this.offroad && af > 10 && this.y < 0.3 && Math.random() < 0.6) {
      const p = this.wp(rand(-0.9, 0.9), 0.3, -1.1);
      P.add(p[0], p[1], p[2], rand(-1, 1), rand(1, 3), rand(-1, 1), 0.6, 0.9, this.g.track.def.shoulder, 0.6, false, 2, 1, 1.5);
    }
    if (this.spin > 0 && Math.random() < 0.5) P.add(this.x, this.y + 1.5, this.z, rand(-1, 1), 2, rand(-1, 1), 0.5, 0.7, [1, 1, 0.4], 1, true);
  }
  // CPUの運転
  think(dt) {
    const g = this.g, T = g.track, N = T.N, inp = this.input, ai = this.ai, sp = Math.hypot(this.vx, this.vz);
    ai.laneT -= dt; if (ai.laneT <= 0) { ai.laneTarget = rand(-0.55, 0.55); ai.laneT = rand(2, 5); }
    ai.lane += (ai.laneTarget - ai.lane) * dt * 0.6;
    let cA = 0; for (let q = 4; q < 30; q += 2) cA += T.curv[(this.ti + q) % N] * 4;
    const look = Math.round(6 + sp * 0.3), j = (this.ti + look) % N;
    let laneOff = this.rocket > 0 ? 0 : clamp(ai.lane * T.W - cA * T.W * 0.45, -T.W * 0.8, T.W * 0.8);
    // 前の障害物を軽くよける
    for (const o of g.items.hazards) {
      const dx = o.x - this.x, dz = o.z - this.z, ahead = dx * this.fx + dz * this.fz;
      if (ahead > 0 && ahead < 25 && Math.abs(dx * -this.fz + dz * this.fx) < 3 && ai.skill > 0.3) { laneOff += (T.lat(o.x, o.z, T.locate(o.x, o.z, this.ti)) > laneOff ? -1 : 1) * 4; }
    }
    const tp = T.P(j, laneOff), want = Math.atan2(tp[0] - this.x, tp[2] - this.z), diff = wrapAngle(want - this.h);
    inp.steer = clamp(-diff * 3, -1, 1);
    inp.throttle = 1; inp.brake = false; inp.drift = false;
    if (Math.abs(cA) > 1.25 && sp > this.maxSpeed * 0.85 && this.boost <= 0) inp.throttle = 0.4 + ai.skill * 0.4;
    if (Math.abs(diff) > 1.6 && sp > 5) { inp.brake = true; inp.throttle = 0; }
    // カーブ後のミニターボ(ドリフトの代わり)
    ai.boostCool -= dt;
    if (Math.abs(cA) > 0.9) ai.inCurve = (ai.inCurve || 0) + dt;
    else { if (ai.inCurve > 1.0 && ai.boostCool <= 0 && Math.random() < ai.skill) { this.boost = Math.max(this.boost, 0.6 + ai.skill * 0.4); ai.boostCool = 2; } ai.inCurve = 0; }
    // アイテム
    if (this.item && this.roulette <= 0 && !this.isPlayer) {
      ai.itemHold += dt;
      if (ai.itemHold > ai.itemDelay && g.items.aiWants(this, cA)) { g.items.use(this, false); ai.itemHold = 0; ai.itemDelay = rand(0.8, 3.5); }
    }
  }
  // 座席に動物のドット絵を立てる。カメラとの向きで 後ろ/横/前 を切り替える
  drawSprite(S) {
    const a = this.h + this.visYaw + this.spinAng, fx = Math.sin(a), fz = Math.cos(a);
    const e = this.g.cam.eye, dx = e[0] - this.x, dz = e[2] - this.z, l = Math.hypot(dx, dz) || 1;
    const dot = (fx * dx + fz * dz) / l;
    const view = dot > 0.5 ? 'front' : dot < -0.5 ? 'back' : 'side';
    const flip = view === 'side' && fx * S.right[0] + fz * S.right[2] < 0;
    let bright = 1;
    if (this.rocket > 0) bright = 1.3 + 0.3 * Math.sin(this.g.time * 30);
    else if (this.invul > 0 && this.spin <= 0 && Math.sin(this.g.time * 40) > 0) bright = 1.7;
    const bob = this.boost > 0 ? Math.abs(Math.sin(this.g.time * 25)) * 0.06 : Math.abs(Math.sin(this.g.time * 4 + this.idx)) * 0.03;
    const p = this.wp(0, 0.62 + bob, -0.5);
    S.add(`drv_${this.drv.animal}_${view}`, p[0], p[1], p[2], 1.9, { flip, bright });
  }
  draw(R) {
    let tint = null;
    if (this.rocket > 0) tint = [1, 0.85, 0.6, 0.25 + 0.15 * Math.sin(this.g.time * 30)];
    else if (this.invul > 0 && this.spin <= 0 && Math.sin(this.g.time * 40) > 0) tint = [1, 1, 1, 0.5];
    else if (this.boost > 0) tint = [1, 1, 1, 0.08];
    const yaw = this.h + this.visYaw + this.spinAng;
    const base = M4.chain(M4.trans(this.x, this.y + (this.boost > 0 ? Math.sin(this.g.time * 50) * 0.03 : 0), this.z), M4.rotY(yaw), M4.rotZ(this.lean), M4.rotX(this.onRamp ? -0.22 : clamp(-this.vy * 0.02, -0.25, 0.25)));
    R.draw(this.g.kartMeshes[this.idx], base, tint);
    for (const w of WHEELS) {
      const m = M4.chain(base, M4.trans(w[0], w[1], w[2]), M4.rotY(w[4] ? -this.steerVis * 0.45 : 0), M4.rotX(this.wheelRot), M4.scale(w[3], w[3], w[3]));
      R.draw(this.g.wheelMesh, m, tint);
    }
  }
}
