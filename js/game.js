'use strict';
// ===== ゲーム本体(進行・入力・カメラ・描画) =====
const DIFFS = [
  { name: 'かんたん', speed: 0.86, ai: [0.8, 0.9], skill: [0.1, 0.5] },
  { name: 'ふつう', speed: 1.0, ai: [0.88, 0.97], skill: [0.3, 0.8] },
  { name: 'むずかしい', speed: 1.12, ai: [0.95, 1.02], skill: [0.6, 1.0] },
];
const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyX', 'KeyE', 'KeyC'];

class Game {
  constructor() {
    this.R = new Renderer(document.getElementById('gl'));
    this.hud = new HUD(document.getElementById('hud'));
    this.fx = new Particles();
    this.sprites = new Sprites(this.R);
    this.wheelMesh = this.R.mesh(buildWheelMesh());
    this.kartMeshes = DRIVERS.map(d => this.R.mesh(buildKartMesh(d.color)));
    this.keys = {}; this.gpPrev = {}; this.time = 0; this.raceTime = 0; this.laps = 3;
    this.sel = { driver: 0, course: 0, diff: 1 };
    this.cam = { eye: [0, 10, -20], h: 0, y: 5, fov: 68, shake: 0 };
    this.acc = 0; this.last = performance.now() / 1000;
    this._input(); this._menu();
    this.touchPad = new TouchPad(this);
    addEventListener('resize', () => { this.R.resize(); this.hud.resize(); });
    this.load(0, null, 1); this.state = 'menu'; this.canDrive = true;
    requestAnimationFrame(t => this.loop(t));
  }
  // ---- コースとカートの用意 ----
  load(courseIdx, playerDriver, diffIdx) {
    if (this.track) { this.R.freeMesh(this.track.mesh); this.R.freeMesh(this.track.skyMesh); }
    this.courseIdx = courseIdx; this.track = new Track(COURSES[courseIdx], this.R);
    const D = DIFFS[diffIdx]; this.diff = D; this.speedScale = D.speed;
    const order = DRIVERS.map((d, i) => i).filter(i => i !== playerDriver).sort(() => Math.random() - 0.5);
    if (playerDriver !== null) order.push(playerDriver); // プレイヤーは最後尾スタート
    const T = this.track; this.karts = [];
    order.forEach((di, p) => {
      const k = new Kart(this, DRIVERS[di], di, di === playerDriver);
      const row = Math.floor(p / 2), back = 8 + row * 7, lat = (p % 2 ? 4.5 : -4.5);
      const i0 = (T.N - Math.round(back / 2)) % T.N, pos = T.P(i0, lat);
      k.x = pos[0]; k.z = pos[2]; k.h = T.heading(i0); k.ti = i0;
      k.lastS = T.sAt(k.x, k.z, k.ti); k.raceDist = T.sDiff(k.lastS, 0);
      const f = (order.length - 1 - p) / (order.length - 1);
      k.ai.base = lerp(D.ai[0], D.ai[1], f * 0.6 + Math.random() * 0.4); k.ai.speedMul = k.ai.base;
      k.ai.skill = lerp(D.skill[0], D.skill[1], Math.random());
      this.karts.push(k);
    });
    this.player = this.karts.find(k => k.isPlayer) || this.karts[0];
    this.items = new Items(this, this.R);
    // コースの外側で応援する動物たち
    this.crowd = []; const cr = rng(courseIdx * 31 + 7);
    for (let j = 0; j < T.N; j += 7) for (const sd of [-1, 1]) {
      if (cr() < 0.5) continue;
      const p = T.P(j, sd * (T.wallD + 1.9 + cr() * 2.5));
      this.crowd.push({ x: p[0], z: p[2], a: DRIVERS[(cr() * DRIVERS.length) | 0].animal, ph: cr() * TAU, sp: 5 + cr() * 5, flip: cr() < 0.5 });
    }
    this.ranking = [...this.karts]; this.fx.clear(); this.hud.msgs = [];
    this.raceTime = 0; this.cam.h = this.player.h; this.cam.y = 5;
  }
  startRace() {
    SND.init();
    this.load(this.sel.course, this.sel.driver, this.sel.diff);
    this.state = 'countdown'; this.cd = 4.2; this.canDrive = false; this.startPress = null; this.lastBeep = 5;
    this.hide('menu'); this.hide('results'); this.hide('pause');
    SND.stopMusic();
  }
  toMenu() {
    this.hide('results'); this.hide('pause'); this.show('menu');
    this.load(this.sel.course, null, 1); this.state = 'menu'; this.canDrive = true; SND.engine(0, false); SND.startMusic(0);
  }
  rankOf(k) { return this.ranking.indexOf(k) + 1; }
  near(o) { const e = this.cam.eye, dx = o.x - e[0], dz = o.z - e[2]; return dx * dx + dz * dz < 170 * 170; }

  // ---- 入力 ----
  _input() {
    addEventListener('keydown', e => {
      if (GAME_KEYS.includes(e.code) && this.state !== 'menu') e.preventDefault();
      if (e.repeat) return;
      this.keys[e.code] = true;
      const p = this.player;
      if ((e.code === 'Space' || e.code.startsWith('Shift')) && p) p.input.driftPressed = true;
      if (['KeyZ', 'KeyX', 'KeyE'].includes(e.code)) this.useItem();
      if (e.code === 'Escape' || e.code === 'KeyP') this.togglePause();
      if (e.code === 'KeyM') this.toggleMute();
      if (e.code === 'Enter' && this.state === 'menu') this.startRace();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
  }
  useItem() {
    const p = this.player;
    if (p && (this.state === 'race') && !p.finished && p.spin <= 0) this.items.use(p, this.keys.ArrowDown || this.keys.KeyS || this.gpBack || (this.touchPad && this.touchPad.st.brake) ? true : false);
  }
  readInput() {
    const k = this.keys, p = this.player, inp = p.input;
    let steer = (k.ArrowRight || k.KeyD ? 1 : 0) - (k.ArrowLeft || k.KeyA ? 1 : 0);
    let thr = k.ArrowUp || k.KeyW ? 1 : 0, brake = !!(k.ArrowDown || k.KeyS), drift = !!(k.Space || k.ShiftLeft || k.ShiftRight);
    this.lookBack = !!k.KeyC; this.gpBack = false;
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(x => x) : null;
    if (gp) {
      const b = i => gp.buttons[i] && gp.buttons[i].pressed, edge = i => b(i) && !this.gpPrev[i];
      const ax = gp.axes[0] || 0; if (Math.abs(ax) > 0.15) steer = clamp(ax * 1.2, -1, 1);
      if (b(14)) steer = -1; if (b(15)) steer = 1;
      if (b(0) || b(7)) thr = 1; if (b(1) || b(6)) brake = true;
      if (b(5)) drift = true; if (edge(5)) inp.driftPressed = true;
      this.gpBack = (gp.axes[1] || 0) > 0.5 || b(13);
      if (edge(2) || edge(4)) this.useItem();
      if (b(3)) this.lookBack = true;
      if (edge(9)) this.togglePause();
      if (edge(0) && this.state === 'menu' && !this.gpPrev.started) this.startRace();
      for (let i = 0; i < gp.buttons.length; i++) this.gpPrev[i] = b(i);
    }
    inp.steer = steer; inp.throttle = thr; inp.brake = brake; inp.drift = drift;
    if (this.touchPad) this.touchPad.apply(inp, this.state);
  }

  // ---- 進行 ----
  step(dt) {
    this.time += dt;
    const p = this.player, T = this.track;
    if (this.state === 'countdown') {
      this.readInput();
      const before = this.cd; this.cd -= dt;
      if (p.input.throttle) { if (this.startPress === null) this.startPress = this.cd; } else this.startPress = null;
      for (const n of [3, 2, 1]) if (before > n && this.cd <= n) SND.sfx('count');
      if (this.cd <= 0) {
        this.state = 'race'; this.canDrive = true; SND.sfx('go'); SND.startMusic(this.courseIdx + 1); SND.voice(p.drv.animal); this.hud.flash('GO!', '#5aff7a', 1.0, 1.4);
        if (this.startPress !== null) {
          if (this.startPress > 2.0) { p.stall = 1.0; this.hud.flash('エンスト…', '#aaa', 1.2, 0.7); }
          else if (this.startPress <= 1.1) { p.boost = 1.4; SND.sfx('boost'); this.hud.flash('ロケットスタート!', '#ffd23a', 1.4, 0.7); }
        }
        for (const k of this.karts) if (!k.isPlayer && Math.random() < k.ai.skill * 0.6) k.boost = 1.0;
      }
    } else if (this.state === 'race' || this.state === 'finish') {
      this.raceTime += dt;
      if (this.state === 'race' && p.rocket <= 0) this.readInput(); else { p.think(dt); if (this.state === 'race') { const k = this.keys; p.input.brake = false; } }
    } else if (this.state === 'menu') {
      // デモ走行
    }
    for (const k of this.karts) {
      if (!k.isPlayer || this.state === 'menu') k.think(dt);
      if (!k.isPlayer && this.state !== 'menu' && !p.finished) {
        const d = k.raceDist - p.raceDist;
        k.ai.speedMul = k.ai.base * (d > 0 ? lerp(1, 0.9, clamp(d / 160, 0, 1)) : lerp(1, 1.08, clamp(-d / 160, 0, 1)));
      }
      k.update(dt);
    }
    this._collide();
    this.items.update(dt);
    // 順位
    this.ranking.sort((a, b) => (a.finished && b.finished ? a.finishTime - b.finishTime : a.finished ? -1 : b.finished ? 1 : b.raceDist - a.raceDist));
    if (this.state === 'menu') return;
    // 周回とゴール
    for (const k of this.karts) {
      if (k.finished || this.state === 'countdown') continue;
      if (k.raceDist >= this.laps * T.len) { k.finished = true; k.finishTime = this.raceTime; if (k.isPlayer) this._playerGoal(); continue; }
      if (k.isPlayer) {
        const lap = Math.floor(k.raceDist / T.len) + 1;
        if (lap > k.lapShown && lap >= 2) {
          k.lapShown = lap;
          if (lap === this.laps) { this.hud.flash('ファイナルラップ!', '#ff7a3a', 2.2, 0.9); SND.sfx('final'); }
          else { this.hud.flash(`ラップ ${lap}`, '#fff', 1.5, 0.8); SND.sfx('lap'); }
        }
        const fwd = k.fx * T.tx[k.ti] + k.fz * T.tz[k.ti];
        k.wrong = fwd < -0.3 && k.speed > 3 ? k.wrong + dt : 0;
      }
    }
    if (this.state === 'finish') { this.finishT -= dt; if (this.finishT <= 0 && !this.resultsShown) this._results(); }
  }
  _playerGoal() {
    const r = this.rankOf(this.player);
    this.state = 'finish'; this.finishT = 4.5; this.resultsShown = false;
    this.hud.flash('ゴール!', '#ffd23a', 3, 1.3); this.hud.flash(`${r}位`, r <= 3 ? '#ffd23a' : '#fff', 3, 1);
    SND.stopMusic(); SND.sfx(r <= 3 ? 'goal' : 'lose'); setTimeout(() => SND.voice(this.player.drv.animal), 900);
    for (let i = 0; i < 80; i++) this.fx.add(this.player.x + rand(-6, 6), 6 + rand(0, 4), this.player.z + rand(-6, 6), rand(-4, 4), rand(2, 8), rand(-4, 4), 2.5, 0.5, hsl(Math.random(), 0.9, 0.6), 1, false, 6, 0.5);
  }
  _results() {
    this.resultsShown = true;
    const T = this.track, est = k => k.finished ? k.finishTime : this.raceTime + (this.laps * T.len - k.raceDist) / (k.maxSpeed * this.speedScale * 0.8);
    const list = [...this.karts].sort((a, b) => est(a) - est(b));
    const tb = document.getElementById('resultTable'); tb.innerHTML = '';
    list.forEach((k, i) => {
      const tr = document.createElement('tr'); if (k.isPlayer) tr.className = 'me';
      tr.innerHTML = `<td class="rk">${i + 1}</td><td><canvas class="face" data-a="${k.drv.animal}" width="40" height="40"></canvas>${k.name}<small>(${k.drv.kind})</small>${k.isPlayer ? ' ← あなた' : ''}</td><td class="tm">${k.finished ? fmtTime(k.finishTime) : '--:--.--'}</td>`;
      tb.appendChild(tr);
    });
    const r = list.indexOf(this.player) + 1;
    this.paintFaces(tb);
    document.getElementById('resultTitle').textContent = r === 1 ? '🏆 優勝おめでとう!' : r <= 3 ? `🎉 ${r}位 入賞!` : `${r}位 でゴール`;
    this.show('results');
  }
  _collide() {
    const K = this.karts;
    for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) {
      const a = K[i], b = K[j], dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz, R = 2.3;
      if (d2 > R * R || Math.abs(a.y - b.y) > 1.6 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, ov = R - d, wa = b.weight / (a.weight + b.weight), wb = 1 - wa;
      a.x -= nx * ov * wa; a.z -= nz * ov * wa; b.x += nx * ov * wb; b.z += nz * ov * wb;
      const vr = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (vr < 0) {
        const J = (-1.5 * vr) / (1 / a.weight + 1 / b.weight);
        a.vx -= (J / a.weight) * nx; a.vz -= (J / a.weight) * nz; b.vx += (J / b.weight) * nx; b.vz += (J / b.weight) * nz;
        if ((a.isPlayer || b.isPlayer) && vr < -3) SND.sfx('bump');
      }
      if (a.rocket > 0) b.hit('bump'); if (b.rocket > 0) a.hit('bump');
    }
  }

  // ---- カメラと描画 ----
  updateCamera(dt) {
    const c = this.cam, menu = this.state === 'menu';
    const k = menu ? this.ranking[0] : this.player;
    let want = k.h + k.visYaw * 0.3, dist = 7.4, hgt = 3.1;
    if (menu) { want = k.h + Math.sin(this.time * 0.25) * 0.9; dist = 11; hgt = 4.5; }
    if (this.state === 'countdown' && this.cd > 3) { const f = (this.cd - 3) / 1.2; want = k.h + Math.PI * f; dist = 7.4 + f * 6; hgt = 3.1 + f * 2; }
    if (this.state === 'finish') { want = k.h + Math.PI * 0.85 * Math.min(1, (4.5 - this.finishT) / 2); dist = 8.5; }
    if (this.lookBack && !menu && this.state === 'race') { c.h = k.h + Math.PI; }
    else c.h += wrapAngle(want - c.h) * Math.min(1, dt * (this.state === 'countdown' ? 8 : 5));
    c.y += (k.y + hgt - c.y) * Math.min(1, dt * 6);
    const shake = k.spin > 0 && !menu ? 0.25 : 0;
    c.eye = [k.x - Math.sin(c.h) * dist + rand(-shake, shake), Math.max(c.y, 1.2), k.z - Math.cos(c.h) * dist + rand(-shake, shake)];
    c.target = [k.x + Math.sin(c.h) * 4, k.y + 1.4, k.z + Math.cos(c.h) * 4];
    const fovWant = 68 + (k.boost > 0 || k.rocket > 0 ? 12 : 0) + clamp(Math.abs(k.speed) / 40, 0, 1) * 4;
    c.fov += (fovWant - c.fov) * Math.min(1, dt * 4);
  }
  render(dt) {
    const R = this.R, gl = R.gl, c = this.cam, T = this.track;
    this.updateCamera(dt);
    const proj = M4.persp((c.fov * Math.PI) / 180, R.w / R.h, 0.3, 2400), vp = M4.mul(proj, M4.lookAt(c.eye, c.target, [0, 1, 0]));
    R.begin(vp, proj, c.eye, T.def.env);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); R.fog(false);
    R.draw(T.skyMesh, M4.trans(c.eye[0], c.eye[1], c.eye[2]));
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); R.fog(true);
    R.draw(T.mesh, M4.ident());
    this.items.draw(R);
    for (const k of this.karts) k.draw(R);
    const S = this.sprites; S.begin(c.eye, c.target);
    for (const k of this.karts) k.drawSprite(S);
    this.items.drawSprites(S);
    this._drawCrowd(S);
    S.flush(T.def.neon ? 0.85 : 1);
    R.blend('alpha'); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2);
    for (const k of this.karts) {
      const a = 0.38 * (1 - Math.min(1, (k.y - k.groundY) / 6));
      R.draw(Items.meshes.shadow, M4.chain(M4.trans(k.x, k.groundY + 0.13, k.z), M4.rotY(k.h + k.visYaw), M4.scale(1.25, 1, 1.75)), null, a);
    }
    gl.disable(gl.POLYGON_OFFSET_FILL); R.blend(null);
    this.items.drawTrans(R);
    R.particles(this.fx);
    this.hud.draw(this, dt);
  }
  _drawCrowd(S) {
    const t = this.time, e = this.cam.eye;
    for (const a of this.crowd) {
      const dx = a.x - e[0], dz = a.z - e[2]; if (dx * dx + dz * dz > 150 * 150) continue;
      const hop = Math.max(0, Math.sin(t * a.sp + a.ph)) * 0.5;
      S.add(`drv_${a.a}_front`, a.x, 0.15 + hop, a.z, 2.3, { flip: a.flip });
    }
  }
  loop(ts) {
    const now = ts / 1000, dt = Math.min(0.05, now - this.last); this.last = now;
    if (this.state !== 'paused') {
      this.acc += dt; const step = 1 / 120; let n = 0;
      while (this.acc >= step && n < 8) { this.step(step); this.acc -= step; n++; }
      if (n >= 8) this.acc = 0;
      this.fx.update(dt);
      const p = this.player, racing = this.state !== 'menu';
      SND.engine(clamp(Math.abs(p.speed) / 40, 0, 1), racing, p.boost > 0 || p.rocket > 0);
    }
    if (this.touchPad) this.touchPad.update();
    this.render(this.state === 'paused' ? 0 : dt);
    requestAnimationFrame(t => this.loop(t));
  }

  // ---- メニュー(HTML) ----
  show(id) { document.getElementById(id).classList.remove('hidden'); }
  hide(id) { document.getElementById(id).classList.add('hidden'); }
  togglePause() {
    if (this.state === 'paused') { this.state = this.pausedFrom; this.hide('pause'); SND.ctx && SND.ctx.resume(); }
    else if (this.state === 'race' || this.state === 'countdown') { this.pausedFrom = this.state; this.state = 'paused'; this.show('pause'); SND.engine(0, false); SND.ctx && SND.ctx.suspend(); }
  }
  toggleMute() { SND.setMute(!SND.muted); const b = document.getElementById('muteBtn'); if (b) b.textContent = SND.muted ? '🔇 音: オフ' : '🔊 音: オン'; }
  _menu() {
    const dv = document.getElementById('drivers');
    DRIVERS.forEach((d, i) => {
      const el = document.createElement('button'); el.className = 'card driver';
      const bar = (label, v) => `<div class="stat"><span>${label}</span><i><b style="width:${v * 20}%"></b></i></div>`;
      el.innerHTML = `<canvas class="avatar face" data-a="${d.animal}" width="64" height="64" style="background:${rgbCss(d.color, 0.35)}"></canvas><div class="nm">${d.name}<small>${d.kind}</small></div><div class="ds">${d.desc}</div>${bar('スピード', d.speed)}${bar('加速', d.accel)}${bar('ハンドル', d.handling)}${bar('重さ', d.weight)}`;
      el.onclick = () => { this.sel.driver = i; this.refreshSel(); this.menuSound(); SND.voice(d.animal); };
      dv.appendChild(el);
    });
    const cv = document.getElementById('courses');
    COURSES.forEach((c, i) => {
      const el = document.createElement('button'); el.className = 'card course ' + c.theme;
      el.innerHTML = `<div class="nm">${c.name}</div><div class="st">${'★'.repeat(c.stars)}${'☆'.repeat(3 - c.stars)}</div><div class="ds">${c.sub}</div>`;
      el.onclick = () => { if (this.sel.course !== i) { this.sel.course = i; this.load(i, null, 1); } this.refreshSel(); this.menuSound(); SND.sfx('tick'); };
      cv.appendChild(el);
    });
    const df = document.getElementById('diffs');
    DIFFS.forEach((d, i) => {
      const el = document.createElement('button'); el.className = 'pill'; el.textContent = d.name;
      el.onclick = () => { this.sel.diff = i; this.refreshSel(); this.menuSound(); SND.sfx('tick'); };
      df.appendChild(el);
    });
    document.getElementById('start').onclick = () => this.startRace();
    document.getElementById('retry').onclick = () => this.startRace();
    document.getElementById('toMenu').onclick = () => this.toMenu();
    document.getElementById('resume').onclick = () => this.togglePause();
    document.getElementById('pRetry').onclick = () => { this.state = 'race'; SND.ctx && SND.ctx.resume(); this.startRace(); };
    document.getElementById('pMenu').onclick = () => { this.state = 'race'; SND.ctx && SND.ctx.resume(); this.toMenu(); };
    document.getElementById('muteBtn').onclick = () => this.toggleMute();
    this.refreshSel();
    ATLAS_READY.then(() => this.paintFaces(document));
    // 最初のクリック・キーでメニューの BGM を鳴らす(ブラウザの決まりで、操作の前は音を出せない)
    const kick = () => { if (this.state === 'menu') this.menuSound(); removeEventListener('pointerdown', kick); removeEventListener('keydown', kick); };
    addEventListener('pointerdown', kick); addEventListener('keydown', kick);
  }
  menuSound() { SND.init(); if (this.state === 'menu' && SND.song !== 0) SND.startMusic(0); }
  paintFaces(root) {
    root.querySelectorAll('canvas.face').forEach(cv => {
      const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height);
      drawAtlas(x, `drv_${cv.dataset.a}_front`, cv.width / 2, cv.height / 2, cv.height * 0.92);
    });
  }
  refreshSel() {
    [...document.getElementById('drivers').children].forEach((el, i) => el.classList.toggle('on', i === this.sel.driver));
    [...document.getElementById('courses').children].forEach((el, i) => el.classList.toggle('on', i === this.sel.course));
    [...document.getElementById('diffs').children].forEach((el, i) => el.classList.toggle('on', i === this.sel.diff));
  }
}

window.addEventListener('load', () => {
  try { window.game = new Game(); }
  catch (e) { document.getElementById('err').textContent = 'エラー: ' + e.message; document.getElementById('err').style.display = 'block'; console.error(e); }
});
window.addEventListener('error', e => { const el = document.getElementById('err'); if (el) { el.textContent = 'エラー: ' + e.message; el.style.display = 'block'; } });
