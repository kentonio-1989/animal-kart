'use strict';
// ===== スマホ・タブレットのタッチ操作 =====
// 左手: ◀ ▶ でハンドル / 右手: ジャンプ(押しっぱなしでドリフト)・アイテム・ブレーキ
// アクセルは自動(ブレーキを押している間だけ止まる)
class TouchPad {
  constructor(game) {
    this.g = game; this.on = false;
    this.st = { left: false, right: false, brake: false, drift: false };
    const root = (this.root = document.createElement('div'));
    root.id = 'touch'; root.className = 'hidden';
    root.innerHTML = `
      <button class="tb" data-k="left">◀</button>
      <button class="tb" data-k="right">▶</button>
      <button class="tb lbl" data-k="brake">ブレーキ<small>バック</small></button>
      <button class="tb lbl" data-k="item">アイテム<small>ブレーキ+で後ろ</small></button>
      <button class="tb lbl big" data-k="drift">ジャンプ<small>ながおしドリフト</small></button>
      <button class="tb small" data-k="pause">Ⅱ</button>
      <div class="tip">横向きにすると遊びやすいよ</div>`;
    document.body.appendChild(root);
    for (const b of root.querySelectorAll('.tb')) {
      const k = b.dataset.k;
      const down = e => {
        e.preventDefault(); b.setPointerCapture && b.setPointerCapture(e.pointerId); b.classList.add('on');
        if (k === 'item') { this.g.items && this.g.useItem(); return; }
        if (k === 'pause') { this.g.togglePause(); return; }
        this.st[k] = true;
        if (k === 'drift' && this.g.player) this.g.player.input.driftPressed = true;
      };
      const up = e => { b.classList.remove('on'); if (k in this.st) this.st[k] = false; };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', e => e.preventDefault());
    }
    // タッチできる端末なら最初からタッチ操作を使う。キーボードを押したら隠す
    const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    if (coarse) this.enable(true);
    addEventListener('touchstart', () => this.enable(true), { passive: true });
    addEventListener('keydown', e => { if (!e.repeat && GAME_KEYS.includes(e.code)) this.enable(false); });
  }
  enable(v) { this.on = v; this.g.hud.touch = v; this.update(); }
  // レース中だけボタンを出す
  update() {
    const s = this.g.state, show = this.on && (s === 'race' || s === 'countdown' || s === 'finish');
    this.root.classList.toggle('hidden', !show);
    if (!show) for (const k in this.st) this.st[k] = false;
  }
  // readInput から呼ぶ。タッチの入力をキーボードの入力に重ねる
  apply(inp, state) {
    if (!this.on) return false;
    const t = this.st, steer = (t.right ? 1 : 0) - (t.left ? 1 : 0);
    if (steer) inp.steer = steer;
    if (t.brake) { inp.brake = true; inp.throttle = 0; }
    else if (!inp.brake && state === 'race') inp.throttle = 1; // オートアクセル(スタート前は踏まない)
    if (t.drift) inp.drift = true;
    return t.brake;
  }
}
