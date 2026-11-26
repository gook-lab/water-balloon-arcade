// 효과음 녹음본 · 합성음 대체 · 음소거 BGM(QA S14) — AudioContext · fetch 를 가짜로 바꿔 확인한다
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function fakeParam(value = 0) {
  return { value, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
}

let made; // 이번 시험에서 만든 노드 기록
class FakeAudioContext {
  constructor() {
    this.state = 'running'; this.currentTime = 0; this.sampleRate = 8000; this.destination = {};
  }
  createGain() { return { gain: fakeParam(1), connect() {} }; }
  createOscillator() {
    const o = { type: '', frequency: fakeParam(), connect() {}, start() {}, stop() {} };
    made.osc.push(o); return o;
  }
  createBufferSource() {
    const s = { buffer: null, loop: false, playbackRate: fakeParam(1), connect() {}, start() { made.started.push(s); }, stop() {} };
    return s;
  }
  createBuffer() { return { getChannelData: () => new Float32Array(16) }; }
  createBiquadFilter() { return { type: '', frequency: fakeParam(), connect() {} }; }
  decodeAudioData(data) { return Promise.resolve({ decodedFrom: data.name }); }
  resume() { this.state = 'running'; }
  suspend() { this.state = 'suspended'; }
}

let listeners;
async function freshAudio(fetchImpl) {
  vi.resetModules();
  made = { osc: [], started: [] };
  listeners = {};
  vi.stubGlobal('window', {
    AudioContext: FakeAudioContext,
    addEventListener: (type, fn) => { listeners[type] = fn; },
    removeEventListener: (type) => { delete listeners[type]; }
  });
  vi.stubGlobal('fetch', fetchImpl);
  const audio = await import('../src/audio/audio.js');
  audio.installUnlock();
  listeners.pointerdown(); // 첫 사용자 제스처
  await audio.preloadSfx();
  return audio;
}

const okFetch = vi.fn(async (url) => ({ ok: true, arrayBuffer: async () => ({ name: String(url).match(/sfx\/(\w+)\.mp3/)[1] }) }));
const deadFetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });

let audio;
beforeEach(() => { okFetch.mockClear(); deadFetch.mockClear(); });
afterEach(() => {
  audio?.stopBgm();
  audio = null;
  vi.unstubAllGlobals();
});

describe('효과음 녹음본', () => {
  it('잠금 해제 뒤 12종을 불러와 AudioBufferSourceNode 로 튼다', async () => {
    audio = await freshAudio(okFetch);
    expect(okFetch).toHaveBeenCalledTimes(12);
    expect(okFetch.mock.calls.map((c) => c[0])).toContain('/sfx/burst.mp3');
    expect(audio.loadedSfx().sort()).toEqual([...audio.SAMPLE_NAMES].sort());
    audio.playSfx('place');
    expect(made.started).toHaveLength(1);
    expect(made.started[0].buffer).toEqual({ decodedFrom: 'place' });
    expect(made.osc).toHaveLength(0); // 합성음은 안 씀
  });

  it('카운트다운 소리는 ui 녹음본을 높낮이만 바꿔 쓴다', async () => {
    audio = await freshAudio(okFetch);
    audio.playSfx('count');
    audio.playSfx('go');
    expect(made.started.map((s) => s.buffer.decodedFrom)).toEqual(['ui', 'ui']);
    expect(made.started[0].playbackRate.value).toBeLessThan(1);
    expect(made.started[1].playbackRate.value).toBeGreaterThan(1);
  });

  it('불러오기에 실패하면 합성음으로 대신 낸다', async () => {
    audio = await freshAudio(deadFetch);
    expect(audio.loadedSfx()).toEqual([]);
    audio.playSfx('place');
    audio.playSfx('count');
    expect(made.osc.length).toBeGreaterThanOrEqual(2);
    expect(made.started.filter((s) => s.buffer && s.buffer.decodedFrom)).toHaveLength(0);
  });

  it('일부만 실패하면 그 소리만 합성음', async () => {
    const partial = vi.fn(async (url) => (String(url).includes('/pin.') ? { ok: false } : okFetch(url)));
    audio = await freshAudio(partial);
    expect(audio.loadedSfx()).not.toContain('pin');
    audio.playSfx('pin');
    expect(made.osc).toHaveLength(1);
    audio.playSfx('burst');
    expect(made.started.at(-1).buffer).toEqual({ decodedFrom: 'burst' });
  });

  it('음소거면 아무것도 틀지 않고, 스로틀도 그대로', async () => {
    audio = await freshAudio(okFetch);
    audio.playSfx('burst');
    audio.playSfx('burst'); // 60ms 안 — 무시
    expect(made.started).toHaveLength(1);
    audio.setMuted(true);
    audio.playSfx('win');
    expect(made.started).toHaveLength(1);
    audio.setMuted(false);
  });
});

describe('BGM 스케줄러 — 음소거(QA S14)', () => {
  it('음소거면 스케줄러를 멈추고, 풀면 같은 곡을 다시 돌린다', async () => {
    audio = await freshAudio(okFetch);
    audio.setMuted(false);
    audio.startBgm('game');
    expect(audio.isBgmRunning()).toBe(true);
    audio.setMuted(true);
    expect(audio.isBgmRunning()).toBe(false);
    audio.startBgm('title'); // 음소거 중 화면이 바뀌어도 돌지 않음
    expect(audio.isBgmRunning()).toBe(false);
    audio.setMuted(false);
    expect(audio.isBgmRunning()).toBe(true);
  });
});
