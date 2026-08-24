// Web Audio 칩튠 신디사이저 — 외부 에셋 없음, 전부 코드 생성.
// game/ 모듈과 분리: 엔진은 onSound(name) 콜백으로만 연결된다 (엔진 순수성 유지).
// 브라우저 autoplay 정책: 첫 사용자 제스처(installUnlock)에서 AudioContext 생성/resume.
const LS_KEY = 'wba-audio';

let ctx = null;
let master = null, sfxBus = null, bgmBus = null;
let unlocked = false;
let pendingBgm = null;
let bgmState = null;
let noiseBuf = null;
const lastPlay = new Map();

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY));
    if (s && typeof s === 'object') return { muted: !!s.muted, volume: clamp01(s.volume ?? 0.7) };
  } catch (e) { /* node·프라이빗 모드 등 — 기본값 사용 */ }
  return { muted: false, volume: 0.7 };
}
const settings = load();

function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

function ensureCtx() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.connect(master);
  bgmBus = ctx.createGain();
  bgmBus.gain.value = 0.45;
  bgmBus.connect(master);
  applyVolume();
  return ctx;
}

function applyVolume() {
  if (master) master.gain.value = settings.muted ? 0 : settings.volume;
}

/** 첫 사용자 제스처에서 오디오 잠금 해제. App 마운트 시 1회 호출. */
export function installUnlock() {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    unlocked = true;
    const c = ensureCtx();
    if (c && c.state === 'suspended') c.resume();
    if (pendingBgm) { const n = pendingBgm; pendingBgm = null; startBgm(n); }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

/* ---------------- 신스 프리미티브 ---------------- */
function tone({ type = 'square', from = 440, to, dur = 0.1, vol = 0.4, delay = 0 }) {
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, from), t0);
  if (to != null && to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(sfxBus);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function getNoiseBuf() {
  if (noiseBuf) return noiseBuf;
  const len = ctx.sampleRate; // 1초
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function noise({ dur = 0.2, vol = 0.4, delay = 0, from = 3000, to = 400, bus }) {
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuf();
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(50, to), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(bus || sfxBus);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

/* ---------------- SFX 13종 ---------------- */
const SFX = {
  ui: () => tone({ from: 660, to: 880, dur: 0.06, vol: 0.22 }),
  place: () => tone({ from: 320, to: 170, dur: 0.1, vol: 0.35 }),
  pin: () => tone({ from: 900, to: 1500, dur: 0.07, vol: 0.3 }),
  burst: () => {
    noise({ dur: 0.28, vol: 0.5, from: 2600, to: 300 });
    tone({ type: 'triangle', from: 220, to: 55, dur: 0.3, vol: 0.45 });
  },
  crate: () => noise({ dur: 0.12, vol: 0.28, from: 1800, to: 500 }),
  itemGood: () => [523, 659, 784].forEach((f, i) => tone({ from: f, dur: 0.09, vol: 0.28, delay: i * 0.07 })),
  itemBad: () => tone({ from: 400, to: 120, dur: 0.35, vol: 0.35 }),
  trapped: () => [0, 1, 2].forEach((i) => tone({ type: 'sine', from: 520 + i * 90, to: 300, dur: 0.12, vol: 0.24, delay: i * 0.09 })),
  die: () => {
    tone({ from: 600, to: 70, dur: 0.5, vol: 0.4 });
    noise({ dur: 0.4, vol: 0.28, from: 1200, to: 200, delay: 0.05 });
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ from: f, dur: i === 3 ? 0.35 : 0.12, vol: 0.34, delay: i * 0.12 })),
  lose: () => [392, 330, 262].forEach((f, i) => tone({ from: f, dur: i === 2 ? 0.4 : 0.16, vol: 0.34, delay: i * 0.16 })),
  draw: () => [440, 440].forEach((f, i) => tone({ from: f, dur: 0.15, vol: 0.28, delay: i * 0.18 }))
};
// 연쇄 폭발 등 같은 프레임 다발음 스로틀 (ms)
const THROTTLE = { burst: 60, crate: 50, trapped: 120, place: 40 };

export function playSfx(name) {
  if (!unlocked || settings.muted) return;
  const fn = SFX[name];
  if (!fn || !ensureCtx()) return;
  const th = THROTTLE[name];
  if (th) {
    const now = performance.now();
    if (now - (lastPlay.get(name) || 0) < th) return;
    lastPlay.set(name, now);
  }
  fn();
}

/* ---------------- BGM — 스텝 시퀀서 칩튠 루프 ---------------- */
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const TRACKS = {
  title: {
    bpm: 96, noiseEvery: 8,
    lead: [69, null, 72, null, 76, null, 72, null, 74, null, 71, null, 69, null, null, null,
           67, null, 71, null, 74, null, 71, null, 72, null, 69, null, 64, null, null, null],
    bass: [45, null, null, null, 52, null, null, null, 43, null, null, null, 50, null, null, null,
           41, null, null, null, 48, null, null, null, 43, null, null, null, 47, null, null, null]
  },
  game: {
    bpm: 138, noiseEvery: 4,
    lead: [69, 72, 74, 76, 74, 72, 69, null, 67, 71, 74, 72, 71, 67, 64, null,
           65, 69, 72, 74, 72, 69, 65, null, 67, 71, 74, 76, 74, 71, 67, null],
    bass: [45, 45, null, 45, 45, null, 45, 45, 43, 43, null, 43, 43, null, 43, 43,
           41, 41, null, 41, 41, null, 41, 41, 43, 43, null, 43, 47, null, 50, null]
  }
};

export function startBgm(name) {
  if (!unlocked) { pendingBgm = name; return; }
  if (bgmState && bgmState.name === name) return;
  if (!ensureCtx()) return;
  stopBgm();
  const tr = TRACKS[name];
  if (!tr) return;
  const stepDur = 60 / tr.bpm / 2; // 8분음표
  const st = { name, step: 0, nextTime: ctx.currentTime + 0.06, timer: null };
  const bgmTone = (type, f, t0, dur, vol) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(bgmBus);
    o.start(t0); o.stop(t0 + dur + 0.02);
  };
  const schedule = () => {
    while (st.nextTime < ctx.currentTime + 0.25) {
      const i = st.step % tr.lead.length;
      const L = tr.lead[i], B = tr.bass[i];
      if (L != null) bgmTone('square', hz(L), st.nextTime, stepDur * 0.9, 0.12);
      if (B != null) bgmTone('triangle', hz(B), st.nextTime, stepDur * 1.7, 0.2);
      if (i % tr.noiseEvery === 0) noise({ dur: 0.04, vol: 0.08, from: 6000, to: 4000, delay: st.nextTime - ctx.currentTime, bus: bgmBus });
      st.step++;
      st.nextTime += stepDur;
    }
  };
  st.timer = setInterval(schedule, 90);
  schedule();
  bgmState = st;
}

export function stopBgm() {
  if (bgmState) { clearInterval(bgmState.timer); bgmState = null; }
}

/* ---------------- 설정 ---------------- */
export function setMuted(m) {
  settings.muted = !!m;
  applyVolume();
  save();
}
export function setVolume(v) {
  settings.volume = clamp01(v);
  applyVolume();
  save();
}
export function getAudioSettings() {
  return { ...settings };
}
