'use strict';
// ===== 効果音・BGM・動物の鳴き声(すべてプログラムで合成するチップチューン) =====
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const SCALE = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harm: [0, 2, 3, 5, 7, 8, 11],
};
// メロディは 1 小節 = 8 分音符 8 個。数字 = 音階の度数(0 が主音、7 で 1 オクターブ上)、'_' = のばす、'.' = 休み
// コードは主音からの半音。0:メニュー 1:はらっぱ 2:さばく 3:ネコまち 4:結果
const SONGS = [
  { // メニュー: のんびり
    key: 55, bpm: 112, scale: 'major', swing: 0.12,
    chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2], [0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
    mel: ['4_2_4_7_', '5___4_._', '2_3_4_2_', '1_______', '4_2_4_7_', '9___8_7_', '5_4_3_1_', '0_______'],
    drums: 'soft',
  },
  { // ぽかぽか はらっぱ: 元気
    key: 60, bpm: 150, scale: 'major',
    chords: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0], [0, 4, 7], [-5, -1, 2], [-7, -3, 0], [-5, -1, 2]],
    mel: ['2_234_32', '1_4_6_4_', '0_2_5_43', '3___2_1_', '2_234_7_', '6_4_8_6_', '5_7_5432', '1___4___'],
    drums: 'rock',
  },
  { // ラクダさばく: ふしぎ
    key: 57, bpm: 136, scale: 'harm',
    chords: [[0, 3, 7], [0, 3, 7], [5, 8, 12], [7, 11, 14], [0, 3, 7], [-4, 0, 3], [5, 8, 12], [7, 11, 14]],
    mel: ['0_124_21', '2___0_..', '3_454_32', '6___4_..', '7_679_76', '5_4_2_45', '3_5_4321', '6_______'],
    drums: 'tribal',
  },
  { // よるのネコまち: かっこいい
    key: 50, bpm: 164, scale: 'minor',
    chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2], [0, 3, 7], [-4, 0, 3], [5, 8, 12], [7, 10, 14]],
    mel: ['7_747_87', '5_4_2_4_', '6_646_76', '4___2_1_', '7_79A_97', '8_7_5_4_', '3_457_54', '4___456_'],
    drums: 'disco',
  },
];

// 動物の鳴き声の作り方
const VOICES = {
  dog: s => { s.voiceTone(420, 260, 0.12, 'square', 0.16, 900); s.voiceTone(440, 270, 0.12, 'square', 0.16, 900, 0.17); },
  cat: s => { s.voiceTone(520, 760, 0.18, 'sawtooth', 0.11, 1600); s.voiceTone(760, 520, 0.32, 'sawtooth', 0.11, 2200, 0.18, 7); },
  frog: s => { for (let i = 0; i < 3; i++) s.voiceTone(170 + i * 20, 140, 0.06, 'square', 0.16, 600, i * 0.07); s.voiceTone(260, 210, 0.12, 'square', 0.14, 700, 0.26); },
  chick: s => { s.voiceTone(2100, 2700, 0.07, 'sine', 0.16, 0); s.voiceTone(2300, 2900, 0.07, 'sine', 0.16, 0, 0.11); },
  bear: s => { s.voiceTone(150, 85, 0.5, 'sawtooth', 0.2, 500, 0, 5); s.noise(0.4, 0.12, 400); },
  rabbit: s => { s.voiceTone(600, 1500, 0.12, 'sine', 0.2, 0); s.voiceTone(900, 1900, 0.1, 'sine', 0.14, 0, 0.13); },
  panda: s => { s.voiceTone(330, 460, 0.15, 'triangle', 0.25, 0); s.voiceTone(460, 300, 0.25, 'triangle', 0.25, 0, 0.14); },
  tiger: s => { s.voiceTone(260, 110, 0.6, 'sawtooth', 0.18, 900, 0, 9); s.noise(0.55, 0.16, 900, 'bandpass'); },
};

class Sound {
  constructor() { this.ctx = null; this.muted = false; this.timer = null; this.song = -1; }
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = (this.ctx = new C());
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.55; this.master.connect(ctx.destination);
    this.sfxG = ctx.createGain(); this.sfxG.gain.value = 0.8; this.sfxG.connect(this.master);
    this.musG = ctx.createGain(); this.musG.gain.value = 0.24; this.musG.connect(this.master);
    const len = ctx.sampleRate; this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // エンジン音(ファミコン風の矩形波)
    this.eo1 = ctx.createOscillator(); this.eo1.type = 'square';
    this.eo2 = ctx.createOscillator(); this.eo2.type = 'triangle';
    this.ef = ctx.createBiquadFilter(); this.ef.type = 'lowpass'; this.ef.frequency.value = 500;
    this.eg = ctx.createGain(); this.eg.gain.value = 0;
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    this.eo1.connect(this.ef); this.eo2.connect(g2); g2.connect(this.ef); this.ef.connect(this.eg); this.eg.connect(this.master);
    this.eo1.start(); this.eo2.start();
  }
  setMute(m) { this.muted = m; if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02); }
  engine(frac, on, boost) {
    if (!this.ctx) return; const t = this.ctx.currentTime, f = 55 + 140 * frac + (boost ? 40 : 0);
    this.eo1.frequency.setTargetAtTime(f, t, 0.05); this.eo2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.ef.frequency.setTargetAtTime(300 + 1100 * frac + (boost ? 800 : 0), t, 0.05);
    this.eg.gain.setTargetAtTime(on ? 0.035 + 0.025 * frac : 0, t, 0.08);
  }
  tone(f, dur, type = 'square', vol = 0.2, f2 = null, delay = 0, dest = null) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + Math.max(0, delay);
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.sfxG); o.start(t); o.stop(t + dur + 0.02);
  }
  // 音程の動き＋フィルタ＋ビブラートで鳴き声っぽくする
  voiceTone(f1, f2, dur, type, vol, bp = 0, delay = 0, vib = 0) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    if (vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = vib; lg.gain.value = f1 * 0.04; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = o;
    if (bp) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = bp; f.Q.value = 1.2; o.connect(f); node = f; }
    node.connect(g); g.connect(this.sfxG); o.start(t); o.stop(t + dur + 0.05);
  }
  voice(animal) { if (this.ctx && VOICES[animal]) VOICES[animal](this); }
  noise(dur, vol = 0.3, freq = 1200, type = 'lowpass', delay = 0, dest = null) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime + Math.max(0, delay);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  sfx(n) {
    switch (n) {
      case 'count': this.tone(523, 0.25, 'square', 0.2); break;
      case 'go': this.tone(1046, 0.6, 'square', 0.22); this.tone(1568, 0.6, 'square', 0.08); break;
      case 'box': [1500, 1900, 2400].forEach((f, i) => this.tone(f, 0.08, 'square', 0.08, null, i * 0.04)); break;
      case 'tick': this.tone(1200, 0.04, 'square', 0.07); break;
      case 'get': this.tone(880, 0.1, 'square', 0.15); this.tone(1320, 0.18, 'square', 0.15, null, 0.08); break;
      case 'boost': this.noise(0.5, 0.25, 2500, 'bandpass'); this.tone(200, 0.45, 'square', 0.1, 900); break;
      case 'carrot': this.noise(0.05, 0.4, 3000, 'highpass'); this.noise(0.05, 0.35, 2500, 'highpass', 0.08); this.tone(300, 0.4, 'square', 0.1, 1100, 0.1); break;
      case 'mini': this.tone(900, 0.06, 'square', 0.08); break;
      case 'hop': this.tone(300, 0.08, 'square', 0.06, 520); break;
      case 'hit': this.tone(700, 0.5, 'square', 0.14, 90); this.noise(0.25, 0.25, 900); break;
      case 'bump': this.noise(0.1, 0.22, 400); this.tone(160, 0.08, 'triangle', 0.2); break;
      case 'throw': this.tone(300, 0.18, 'square', 0.12, 900); break;
      case 'yarn': this.tone(220, 0.25, 'triangle', 0.25, 660); this.tone(660, 0.15, 'triangle', 0.15, 330, 0.18); break;
      case 'bee': this.voiceTone(220, 260, 0.6, 'sawtooth', 0.09, 1400, 0, 30); break;
      case 'explode': this.noise(0.7, 0.45, 700); this.tone(140, 0.5, 'square', 0.2, 40); break;
      case 'mud': this.noise(0.3, 0.3, 350); this.tone(120, 0.25, 'triangle', 0.25, 60); break;
      case 'shield': [523, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.14, null, i * 0.06)); break;
      case 'pop': this.tone(1400, 0.06, 'sine', 0.2, 300); this.noise(0.05, 0.2, 4000, 'highpass'); break;
      case 'rocket': [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, 0.3, 'square', 0.09, null, i * 0.05)); this.noise(1.0, 0.25, 2000, 'bandpass'); break;
      case 'lap': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.18, 'square', 0.14, null, i * 0.1)); break;
      case 'final': [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.2, 'square', 0.14, null, i * 0.12)); break;
      case 'goal': [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => { this.tone(f, 0.35, 'square', 0.13, null, i * 0.13); this.tone(f / 2, 0.35, 'triangle', 0.2, null, i * 0.13); }); break;
      case 'lose': [523, 494, 466, 440].forEach((f, i) => this.tone(f, 0.3, 'square', 0.12, null, i * 0.25)); break;
      case 'wall': this.noise(0.12, 0.28, 600); break;
    }
  }
  startMusic(i) {
    this.stopMusic(); if (!this.ctx) return;
    const S = SONGS[i % SONGS.length], sc = SCALE[S.scale], step = 60 / S.bpm / 2; // 8 分音符
    this.song = i;
    const deg = ch => { const n = ch === 'A' ? 10 : +ch; return sc[n % 7] + 12 * Math.floor(n / 7); };
    // メロディを [音, 長さ] の列にする
    const notes = []; // 各 8 分音符位置: {m, len} または null
    const flat = S.mel.join('');
    for (let k = 0; k < flat.length; k++) {
      const ch = flat[k];
      if (ch === '_' || ch === '.') { notes.push(null); continue; }
      let len = 1; while (flat[k + len] === '_') len++;
      notes.push({ m: deg(ch), len });
    }
    const total = notes.length; let n = 0, next = this.ctx.currentTime + 0.12;
    const mg = this.musG;
    const sched = () => {
      while (next < this.ctx.currentTime + 0.3) {
        const bar = Math.floor(n / 8) % S.chords.length, s = n % 8, ch = S.chords[bar];
        const sw = S.swing && n % 2 ? step * S.swing : 0, dl = next - this.ctx.currentTime + sw;
        // ベース(三角波)
        const bassN = S.key - 12 + ch[0] + (s % 4 === 2 ? 7 : 0) + (s === 6 && S.drums !== 'soft' ? 12 : 0);
        if (S.drums === 'soft' ? s % 4 === 0 : s % 2 === 0) this.tone(mtof(bassN), step * (S.drums === 'soft' ? 3.5 : 1.7), 'triangle', 0.55, null, dl, mg);
        // 和音のアルペジオ(細い矩形波)
        this.tone(mtof(S.key + 12 + ch[n % 3]), step * 0.8, 'square', S.drums === 'soft' ? 0.045 : 0.06, null, dl, mg);
        // メロディ
        const no = notes[n % total];
        if (no) {
          const f = mtof(S.key + 12 + no.m), d = step * no.len * 0.95;
          this.tone(f, d, 'square', 0.12, null, dl, mg);
          this.tone(f * 1.005, d, 'square', 0.04, null, dl + 0.012, mg); // 少しずらして厚みを出す
        }
        // ドラム
        const kick = (dl2) => this.tone(160, 0.12, 'sine', 0.8, 45, dl2, mg);
        const snare = (dl2) => this.noise(0.12, 0.35, 2200, 'bandpass', dl2, mg);
        const hat = (dl2, v = 0.1) => this.noise(0.03, v, 8000, 'highpass', dl2, mg);
        if (S.drums === 'soft') { if (s === 0) kick(dl); if (s === 4) this.noise(0.06, 0.12, 3000, 'bandpass', dl, mg); }
        else if (S.drums === 'rock') { if (s === 0 || s === 5) kick(dl); if (s === 2 || s === 6) snare(dl); hat(dl); }
        else if (S.drums === 'tribal') { if (s === 0 || s === 3 || s === 6) this.tone(110, 0.18, 'sine', 0.7, 60, dl, mg); if (s === 4) snare(dl); if (s % 2) this.tone(600, 0.05, 'triangle', 0.15, 300, dl, mg); }
        else if (S.drums === 'disco') { if (s % 2 === 0) kick(dl); if (s === 2 || s === 6) snare(dl); if (s % 2) hat(dl, 0.18); }
        n++; next += step;
      }
    };
    this.timer = setInterval(sched, 50); sched();
  }
  stopMusic() { if (this.timer) clearInterval(this.timer); this.timer = null; this.song = -1; }
}
const SND = new Sound();
