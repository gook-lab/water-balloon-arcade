// 스프라이트 팩토리 — v2 디테일 업그레이드 (2026-08-24).
// 원본 16×16 도트맵은 유지하되:
//  · 캐릭터: 16×16 도트맵 → EPX(Scale2x) 업스케일 32×32 + 림라이트/셰이딩/스펙큘러 패스
//  · 물풍선·아이템·버블·물줄기·블록: 32×32 프로시저럴 재작업 (셰이딩·베벨·테마 디테일)
// 게임 규칙 수치와 렌더 계약(캐시 구조, imageSmoothingEnabled=false, pixelated)은 불변.
import { S, ITEM_DEFS } from './constants.js';
import { BODY } from './characters.js';

export const CHAR_SPRITE_SIZE = 32; // 캐릭터 스프라이트 캔버스 크기 (구 16)
const BS = 32;                      // 블록·이펙트 스프라이트 캔버스 크기

const OUTLINE = '#232a44';          // 캐릭터 아웃라인
const BLOCK_OUTLINE = '#1d2338';    // 블록 아웃라인

// 아이템 픽토그램 v5 — 12×12 도트맵, 2배로 패널에 그린다.
// 키: o=아웃라인 x=주색 w=흰/포인트 a=보조색 (pal 로 아이템별 지정)
export const ITEM_ICONS = {
  balloon: { // 물풍선 — 풍선+매듭
    pal: { x: '#ff8fb1', a: '#d95a80' },
    rows: [
      '....oooo....',
      '..ooxxxxoo..',
      '.oxxwwxxxxo.',
      '.oxwwxxxxxo.',
      'oxxwxxxxxxxo',
      'oxxxxxxxxxxo',
      'oxxxxxxxxxxo',
      '.oxxxxxxxxo.',
      '..oxxxxxxo..',
      '...ooxxoo...',
      '.....oo.....',
      '....oaao....'
    ]
  },
  power: { // 물줄기 — 물약병
    pal: { x: '#e9f8ff', a: '#7fd8ff' },
    rows: [
      '....oooo....',
      '....oxxo....',
      '....oxxo....',
      '...oxxxxo...',
      '..oxwxxxxo..',
      '.oxwaaaaxxo.',
      '.oxaaaaaaxo.',
      '.oxaaaaaaxo.',
      '.oxaaaaaaxo.',
      '.oxaaaaaaxo.',
      '..oaaaaaao..',
      '...oooooo...'
    ]
  },
  speed: { // 롤러블레이드 — 부츠+바퀴
    pal: { x: '#ffd23f', a: '#b06a2c' },
    rows: [
      '............',
      '..oooo......',
      '.oxxxxo.....',
      '.oxwxxooooo.',
      '.oxxxxxxxxo.',
      '.oxxxxxxxxo.',
      '.oxxxxxxxxo.',
      '.oaaaaaaaao.',
      '.oooooooooo.',
      '..oo....oo..',
      '.oxxo..oxxo.',
      '..oo....oo..'
    ]
  },
  needle: { // 바늘 — 대각 바늘+귀
    pal: { x: '#ffffff', a: '#ff5d8f' },
    rows: [
      '..........oo',
      '.........oxo',
      '........oxo.',
      '.......oxo..',
      '......oxo...',
      '.....oxo....',
      '....oxo.....',
      '...oxo......',
      '..oxo.......',
      '.oxo........',
      'oxao........',
      'oo..........'
    ]
  },
  passBalloon: { // 풍선 통과 — 유령 풍선
    pal: { x: '#c9a6ff', a: '#8f6fd0' },
    rows: [
      '...oooooo...',
      '..oxxxxxxo..',
      '.oxxxxxxxxo.',
      '.oxoxxxxoxo.',
      '.oxoxxxxoxo.',
      '.oxxxxxxxxo.',
      '.oxxxwwxxxo.',
      '.oxxxxxxxxo.',
      '.oxxxxxxxxo.',
      '.oxxoxxoxxo.',
      '.oxo.oo.oxo.',
      '............'
    ]
  },
  passBlock: { // 블록 통과 — 상자 관통 화살(더블 셰브런)
    pal: { x: '#9ff0b4', a: '#1d5b31' },
    rows: [
      '............',
      '.oooooooooo.',
      '.oxxxxxxxxo.',
      '.oxwxxwxxxo.',
      '.oxxwxxwxxo.',
      '.oxxxwxxwxo.',
      '.oxxwxxwxxo.',
      '.oxwxxwxxxo.',
      '.oxxxxxxxxo.',
      '.oooooooooo.',
      '............',
      '............'
    ]
  },
  turtle: { // 거북이 (나쁜 아이템) — 탑뷰 거북
    pal: { x: '#8fae9c', a: '#3f6b4f' },
    rows: [
      '.....oo.....',
      '....oxxo....',
      '..o.oxxo.o..',
      '.oxooxxooxo.',
      '..oaxxxxao..',
      '.oaxxaaxxao.',
      '.oaxaxxaxao.',
      '.oaxxaaxxao.',
      '..oaxxxxao..',
      '.oxo.oo.oxo.',
      '............',
      '............'
    ]
  }
};

const cache = new Map();

function sprite(id, build) {
  if (!cache.has(id)) cache.set(id, build());
  return cache.get(id);
}

function canvas(n) {
  const cv = document.createElement('canvas');
  cv.width = n;
  cv.height = n;
  return cv;
}

/* ---------------- color helpers ---------------- */
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
// f > 0 → 밝게(흰색 쪽으로), f < 0 → 어둡게
function shade(hex, f) {
  const [r, g, b] = hexRgb(hex);
  const t = f < 0 ? 0 : 255, a = Math.abs(f);
  const m = (c) => Math.round(c + (t - c) * a);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
// 회색 쪽으로 amt 만큼 탈채도 → hex 반환 (하드블록 = "부술 수 없음" 시각 언어)
function mixGray(hex, amt) {
  const [r, g, b] = hexRgb(hex);
  const gr = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
  const m = (c) => Math.round(c + (gr - c) * amt);
  return '#' + [m(r), m(g), m(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
}
// 웜 우드 톤으로 amt 만큼 혼합 (상자 = "부술 수 있는 나무" 시각 언어 — 한색 팔레트 테마에서도 유지)
function mixWarm(hex, amt) {
  const [r, g, b] = hexRgb(hex);
  const [wr, wg, wb] = [201, 138, 74]; // #c98a4a
  const m = (c, t) => Math.round(c + (t - c) * amt);
  return '#' + [m(r, wr), m(g, wg), m(b, wb)].map((c) => c.toString(16).padStart(2, '0')).join('');
}

export function buildSprite(rows, map) {
  const cv = canvas(S);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = map[row[x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return cv;
}

/* ---------------- EPX / Scale2x ---------------- */
// 16×16 도트맵을 계단 현상을 줄이며 2배 확대한다. 색은 보간 없이 보존된다.
function scale2x(src) {
  const w = src.width, h = src.height;
  const data = src.getContext('2d').getImageData(0, 0, w, h).data;
  const px = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    const i = (y * w + x) * 4;
    if (data[i + 3] === 0) return 0;
    return ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0;
  };
  const out = canvas(w * 2);
  const octx = out.getContext('2d', { willReadFrequently: true });
  const img = octx.createImageData(w * 2, h * 2);
  const set = (x, y, v) => {
    const i = (y * w * 2 + x) * 4;
    img.data[i] = (v >>> 24) & 255;
    img.data[i + 1] = (v >>> 16) & 255;
    img.data[i + 2] = (v >>> 8) & 255;
    img.data[i + 3] = v & 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = px(x, y), A = px(x, y - 1), B = px(x + 1, y), C = px(x - 1, y), D = px(x, y + 1);
    let e0 = P, e1 = P, e2 = P, e3 = P;
    if (C === A && C !== D && A !== B) e0 = A;
    if (A === B && A !== C && B !== D) e1 = B;
    if (D === C && D !== B && C !== A) e2 = C;
    if (B === D && B !== A && D !== C) e3 = D;
    set(x * 2, y * 2, e0); set(x * 2 + 1, y * 2, e1);
    set(x * 2, y * 2 + 1, e2); set(x * 2 + 1, y * 2 + 1, e3);
  }
  octx.putImageData(img, 0, 0);
  return out;
}

// 몸통색 픽셀에 상단 림라이트 / 하단(아웃라인 접경) 셰도를 얹는다.
function rimShade(cv, bodyHex) {
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const w = cv.width, h = cv.height;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const src = new Uint8ClampedArray(d);
  const [br, bg, bb] = hexRgb(bodyHex);
  const [lr, lg, lb] = hexRgb(bodyHex).map((c) => Math.round(c + (255 - c) * 0.4));
  const [dr, dg, db] = hexRgb(bodyHex).map((c) => Math.round(c * 0.72));
  const at = (x, y) => (y * w + x) * 4;
  const isBody = (i) => src[i] === br && src[i + 1] === bg && src[i + 2] === bb && src[i + 3] === 255;
  const isEmptyOrOutline = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return true;
    const i = at(x, y);
    if (src[i + 3] === 0) return true;
    return src[i] === 0x23 && src[i + 1] === 0x2a && src[i + 2] === 0x44; // OUTLINE
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y);
    if (!isBody(i)) continue;
    if (isEmptyOrOutline(x, y - 1)) {
      d[i] = lr; d[i + 1] = lg; d[i + 2] = lb;            // top rim light
    } else if (isEmptyOrOutline(x, y + 1) || isEmptyOrOutline(x + 1, y)) {
      d[i] = dr; d[i + 1] = dg; d[i + 2] = db;            // bottom/right shade
    }
  }
  ctx.putImageData(img, 0, 0);
  // 스펙큘러 하이라이트 (머리 좌상단)
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  const spec = [[9, 7, 3, 2], [8, 9, 2, 2]];
  const chk = ctx.getImageData(0, 0, w, h).data;
  spec.forEach(([sx, sy, sw, sh]) => {
    for (let y = sy; y < sy + sh; y++) for (let x = sx; x < sx + sw; x++) {
      const i = at(x, y);
      if (chk[i] === br || (chk[i] === lr && chk[i + 1] === lg)) ctx.fillRect(x, y, 1, 1);
    }
  });
  return cv;
}

/* ---------------- characters (16 도트맵 → EPX 32 + 셰이딩) ---------------- */
export function charSprite(ch, dir) {
  const id = 'ch' + ch.id + (dir === 'up' ? 'U' : 'D');
  return sprite(id, () => {
    const rows = BODY.slice();
    Object.keys(ch.over).forEach((k) => { rows[+k] = ch.over[k]; });
    const back = dir === 'up';
    const map = {
      o: OUTLINE, b: ch.color, d: ch.dark,
      w: back ? ch.color : '#ffffff', e: back ? ch.dark : OUTLINE, a: back ? ch.dark : ch.accent
    };
    const base = buildSprite(rows, map);
    return rimShade(scale2x(base), ch.color);
  });
}

/* ---------------- blocks (32 프로시저럴: 베벨 + 플랭크/리벳 + 테마 디테일) ---------------- */
function roundOutline(ctx) {
  ctx.fillStyle = BLOCK_OUTLINE;
  ctx.fillRect(0, 0, BS, BS);
  ctx.clearRect(0, 0, 2, 1); ctx.clearRect(0, 0, 1, 2);
  ctx.clearRect(BS - 2, 0, 2, 1); ctx.clearRect(BS - 1, 0, 1, 2);
  ctx.clearRect(0, BS - 1, 2, 1); ctx.clearRect(0, BS - 2, 1, 2);
  ctx.clearRect(BS - 2, BS - 1, 2, 1); ctx.clearRect(BS - 1, BS - 2, 1, 2);
}

function nail(ctx, x, y, dark, light) {
  ctx.fillStyle = dark; ctx.fillRect(x, y, 2, 2);
  ctx.fillStyle = light; ctx.fillRect(x, y, 1, 1);
}

// 테마별 소프트 상자 디테일 — 팔레트에서 파생한 색만 사용
function themeDetail(ctx, theme, p) {
  const hi = shade(p[0], 0.45), lo = shade(p[2], -0.35);
  switch (theme.id) {
    case 'grass': // 잎사귀
      ctx.fillStyle = theme.g1 || '#6dc07e';
      ctx.fillRect(22, 5, 3, 2); ctx.fillRect(24, 4, 2, 2); ctx.fillRect(23, 7, 1, 2);
      break;
    case 'beach': // 모래 물결
      ctx.fillStyle = hi;
      ctx.fillRect(6, 16, 4, 1); ctx.fillRect(10, 15, 4, 1); ctx.fillRect(14, 16, 4, 1);
      break;
    case 'snow': // 눈 반짝임
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.fillRect(8, 8, 2, 2); ctx.fillRect(22, 14, 2, 2); ctx.fillRect(12, 22, 2, 2);
      break;
    case 'lava': // 균열
      ctx.fillStyle = lo;
      ctx.fillRect(10, 14, 5, 1); ctx.fillRect(14, 15, 1, 3); ctx.fillRect(15, 17, 4, 1);
      break;
    case 'factory': // 추가 리벳
      nail(ctx, 15, 15, lo, hi);
      break;
    default:
      break;
  }
}

function softCrate(theme, v) {
  const p = theme.soft.map((c) => mixWarm(c, 0.24)); // 테마 색조 위에 우드 틴트 → 전 테마에서 "부술 수 있음"이 읽힘
  const light = p[0], mid = p[1], dark = p[2];
  const hi = shade(light, 0.35), lo = shade(dark, -0.25);
  const cv = canvas(BS), ctx = cv.getContext('2d');
  roundOutline(ctx);
  ctx.fillStyle = mid; ctx.fillRect(1, 1, BS - 2, BS - 2);
  // bevel
  ctx.fillStyle = light; ctx.fillRect(1, 1, BS - 2, 2); ctx.fillRect(1, 1, 2, BS - 2);
  ctx.fillStyle = hi; ctx.fillRect(2, 2, BS - 6, 1);
  ctx.fillStyle = dark; ctx.fillRect(1, BS - 3, BS - 2, 2); ctx.fillRect(BS - 3, 1, 2, BS - 2);
  if (v) {
    // v1: 세로 플랭크 + 가로 브레이스
    ctx.fillStyle = dark; ctx.fillRect(11, 3, 1, BS - 6); ctx.fillRect(21, 3, 1, BS - 6);
    ctx.fillStyle = hi; ctx.fillRect(12, 3, 1, BS - 6); ctx.fillRect(22, 3, 1, BS - 6);
    ctx.fillStyle = dark; ctx.fillRect(3, 15, BS - 6, 2);
    ctx.fillStyle = hi; ctx.fillRect(3, 17, BS - 6, 1);
  } else {
    // v0: 가로 플랭크 2줄
    [11, 21].forEach((y) => {
      ctx.fillStyle = dark; ctx.fillRect(3, y, BS - 6, 1);
      ctx.fillStyle = hi; ctx.fillRect(3, y + 1, BS - 6, 1);
    });
  }
  nail(ctx, 4, 4, lo, hi); nail(ctx, BS - 6, 4, lo, hi);
  nail(ctx, 4, BS - 6, lo, hi); nail(ctx, BS - 6, BS - 6, lo, hi);
  themeDetail(ctx, theme, p);
  return cv;
}

function toughCrate(theme) {
  const p = theme.soft.map((c) => mixWarm(c, 0.24)); // softCrate 와 같은 우드 틴트 (강화상자도 상자)
  const light = p[0], mid = p[1], dark = p[2];
  const hi = shade(light, 0.4), lo = shade(dark, -0.3);
  const cv = canvas(BS), ctx = cv.getContext('2d');
  roundOutline(ctx);
  // 금속 프레임 이중 테두리
  ctx.fillStyle = light; ctx.fillRect(1, 1, BS - 2, BS - 2);
  ctx.fillStyle = lo; ctx.fillRect(4, 4, BS - 8, BS - 8);
  ctx.fillStyle = mid; ctx.fillRect(5, 5, BS - 10, BS - 10);
  // X 브레이스
  ctx.fillStyle = dark;
  for (let i = 0; i < BS - 12; i++) {
    ctx.fillRect(6 + i, 6 + i, 2, 2);
    ctx.fillRect(BS - 8 - i, 6 + i, 2, 2);
  }
  ctx.fillStyle = hi;
  for (let i = 0; i < BS - 12; i += 3) ctx.fillRect(6 + i, 6 + i, 1, 1);
  // 프레임 리벳
  [[2, 2], [BS - 4, 2], [2, BS - 4], [BS - 4, BS - 4], [15, 2], [2, 15], [BS - 4, 15], [15, BS - 4]]
    .forEach(([x, y]) => nail(ctx, x, y, lo, hi));
  // 상단 글린트
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(2, 1, 10, 1);
  return cv;
}

function hardBlock(theme, v) {
  // 파괴 불가 시각 언어: 테마 색조는 유지하되 탈채도+어둡게 → 밝고 따뜻한 나무상자와 즉시 구분
  const light = shade(mixGray(theme.hard[0], 0.55), -0.22);
  const mid = shade(mixGray(theme.hard[1], 0.55), -0.36);
  const dark = shade(mixGray(theme.hard[2], 0.55), -0.52);
  const hi = shade(mixGray(theme.hard[0], 0.4), 0.25), lo = 'rgb(18,22,34)';
  const cv = canvas(BS), ctx = cv.getContext('2d');
  roundOutline(ctx);
  ctx.fillStyle = mid; ctx.fillRect(1, 1, BS - 2, BS - 2);
  // 스톤 베벨
  ctx.fillStyle = light; ctx.fillRect(1, 1, BS - 2, 3);
  ctx.fillStyle = hi; ctx.fillRect(1, 1, BS - 2, 1);
  ctx.fillStyle = dark; ctx.fillRect(1, BS - 5, BS - 2, 4); ctx.fillRect(BS - 3, 1, 2, BS - 2);
  ctx.fillStyle = lo; ctx.fillRect(1, BS - 2, BS - 2, 1); // 바닥 접지 그림자
  ctx.fillStyle = light; ctx.fillRect(1, 4, 2, BS - 9);
  const recess = (x, y, w, h) => {
    ctx.fillStyle = dark; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = lo; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
    ctx.fillStyle = light; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
    ctx.fillStyle = mid; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  };
  if (v) {
    recess(6, 7, 9, 9); recess(17, 7, 9, 9); recess(6, 18, 9, 9); recess(17, 18, 9, 9);
  } else {
    recess(7, 8, 18, 16);
  }
  // 금속 볼트 4개 — 모든 테마 공통 "파괴 불가" 마커
  nail(ctx, 3, 3, lo, hi); nail(ctx, BS - 5, 3, lo, hi);
  nail(ctx, 3, BS - 7, lo, hi); nail(ctx, BS - 5, BS - 7, lo, hi);
  if (theme.id === 'lava') {
    ctx.fillStyle = lo;
    ctx.fillRect(4, 5, 1, 4); ctx.fillRect(26, 20, 1, 5); ctx.fillRect(25, 24, 2, 1);
  }
  return cv;
}

export function blockSprite(theme, kind, v) {
  const id = 'bl' + theme.id + kind + (v || 0);
  return sprite(id, () => {
    if (kind === 'hard') return hardBlock(theme, v);
    if (kind === 'tough') return toughCrate(theme);
    return softCrate(theme, v);
  });
}

export function decoSprite(theme, kind) {
  return sprite('dc' + theme.id + kind, () => {
    const cv = canvas(S);
    const ctx = cv.getContext('2d');
    if (kind === 0) {
      ctx.fillStyle = 'rgba(0,0,0,.16)';
      [[4, 11], [5, 10], [6, 9], [8, 10], [9, 9], [10, 11], [7, 12]].forEach(([x, y]) => ctx.fillRect(x, y, 1, 16 - y - 3));
    } else if (kind === 1) {
      ctx.fillStyle = theme.hard[2];
      ctx.fillRect(4, 9, 2, 2); ctx.fillRect(9, 11, 2, 2); ctx.fillRect(7, 7, 2, 2);
      ctx.fillStyle = theme.hard[0];
      ctx.fillRect(4, 9, 1, 1); ctx.fillRect(9, 11, 1, 1); ctx.fillRect(7, 7, 1, 1);
    } else {
      ctx.fillStyle = theme.soft[0];
      ctx.fillRect(7, 6, 2, 2); ctx.fillRect(6, 8, 1, 1); ctx.fillRect(9, 8, 1, 1);
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(7, 10, 1, 3);
    }
    return cv;
  });
}

/* ---------------- items (v5: 봄버맨식 아이템 패널 + 픽토그램) ---------------- */
// frame 0/1 — 테두리 블링크로 시선 유도. 캐시 키 'it{type}f{frame}'.
export function itemSprite(type, frame = 0) {
  return sprite('it' + type + 'f' + (frame || 0), () => {
    const d = ITEM_DEFS[type];
    const icon = ITEM_ICONS[type];
    const cv = canvas(BS), ctx = cv.getContext('2d');
    // 패널: 굵은 아웃라인 + 밝은 틴트 배경 (복잡한 바닥 텍스처 위에서도 뜨도록 고명도)
    roundOutline(ctx);
    ctx.fillStyle = shade(d.color, d.bad ? 0.42 : 0.62);
    ctx.fillRect(2, 2, BS - 4, BS - 4);
    ctx.fillStyle = shade(d.color, 0.2);
    ctx.fillRect(2, BS - 6, BS - 4, 4); // 하단 셰이드 밴드
    // 흰 내부 테두리 (blink: frame 1 에서 더 밝게)
    ctx.fillStyle = frame ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.6)';
    ctx.fillRect(2, 2, BS - 4, 2); ctx.fillRect(2, BS - 4, BS - 4, 2);
    ctx.fillRect(2, 2, 2, BS - 4); ctx.fillRect(BS - 4, 2, 2, BS - 4);
    if (frame) { // 반짝이 점
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, 5, 2, 2);
    }
    // 픽토그램 12×12 → 2배 (중앙 4px 마진), 드롭 섀도 1px
    const pal = { o: BLOCK_OUTLINE, x: icon.pal.x, w: '#ffffff', a: icon.pal.a };
    icon.rows.forEach((row, y) => {
      for (let x = 0; x < 12; x++) {
        if (row[x] === '.') continue;
        ctx.fillStyle = 'rgba(29,35,56,.35)';
        ctx.fillRect(x * 2 + 5, y * 2 + 5, 2, 2);
      }
    });
    icon.rows.forEach((row, y) => {
      for (let x = 0; x < 12; x++) {
        const c = pal[row[x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * 2 + 4, y * 2 + 4, 2, 2);
      }
    });
    return cv;
  });
}

export function balloonSprite(hot) {
  return sprite('ball' + hot, () => {
    const col = hot
      ? { rim: '#5a2a00', body: '#ff9c4a', light: '#ffd98a', spark: '#ffffff' }
      : { rim: '#123a5e', body: '#2f9fe0', light: '#9fe4ff', spark: '#ffffff' };
    const cv = canvas(BS), ctx = cv.getContext('2d');
    const cx = 15.5, cy = 14.5;
    const put = (r, colr, oy, ox) => {
      ctx.fillStyle = colr;
      for (let y = 0; y < BS; y++) for (let x = 0; x < BS; x++) {
        const dx = x - cx - (ox || 0), dy = y - cy - (oy || 0);
        if (dx * dx + dy * dy <= r * r) ctx.fillRect(x, y, 1, 1);
      }
    };
    put(14.6, col.rim);
    put(13.2, col.body);
    put(9.2, col.light, 2.6);                 // 하단 수광부
    put(4.4, shade(col.body, hot ? 0.15 : -0.18), 6.2); // 바닥 코어
    // 스펙큘러
    ctx.fillStyle = col.spark;
    ctx.fillRect(9, 5, 5, 3); ctx.fillRect(8, 7, 2, 3); ctx.fillRect(14, 5, 2, 2);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.fillRect(22, 9, 2, 4);
    // 매듭
    ctx.fillStyle = col.rim; ctx.fillRect(13, 28, 5, 2);
    ctx.fillStyle = col.body; ctx.fillRect(14, 28, 3, 1);
    ctx.fillStyle = col.rim; ctx.fillRect(15, 30, 2, 1);
    return cv;
  });
}

/* ---------------- water (32 프로시저럴 + 2프레임 셰머) ---------------- */
export function waterSprite(stage, frame = 0) {
  return sprite('wa' + stage + 'f' + (frame || 0), () => {
    const cv = canvas(BS), ctx = cv.getContext('2d');
    const inset = stage === 0 ? 8 : stage === 1 ? 2 : 0;
    const x0 = inset, y0 = inset, w = BS - inset * 2;
    // 코어 (모서리 2px 라운딩)
    ctx.fillStyle = '#2f8fd0';
    ctx.fillRect(x0, y0, w, w);
    [[x0, y0], [x0 + w - 2, y0], [x0, y0 + w - 2], [x0 + w - 2, y0 + w - 2]].forEach(([cx2, cy2]) => {
      ctx.clearRect(cx2, cy2, 2, 1);
      ctx.clearRect(cx2 + (cx2 > x0 ? 1 : 0), cy2 + (cy2 > y0 ? -1 : 1), 1, 1);
    });
    ctx.fillStyle = '#7fd8ff';
    ctx.fillRect(x0 + 2, y0 + 2, w - 4, w - 4);
    // 내부 밝은 물결
    ctx.fillStyle = '#a9e6ff';
    ctx.fillRect(x0 + 3, y0 + 3, w - 6, 3);
    // 스트림 하이라이트 블롭 (frame 에 따라 위치 이동)
    const f = frame ? 2 : 0;
    ctx.fillStyle = '#cdf3ff';
    ctx.fillRect(x0 + 5 + f, y0 + 6, 6, 5);
    ctx.fillRect(x0 + w - 11 - f, y0 + 8, 5, 4);
    ctx.fillRect(x0 + 8, y0 + w - 10 + (frame ? 1 : 0), 5, 4);
    // 흰 반짝임
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.fillRect(x0 + 4, y0 + 12 + f, 2, 8 - f);
    ctx.fillRect(x0 + w - 6, y0 + 10 - (frame ? 1 : 0), 2, 7);
    ctx.fillRect(x0 + 7 + f, y0 + 4, 4, 1);
    // 가장자리 거품 도트
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = x0 + 3 + (frame ? 3 : 0); i < x0 + w - 3; i += 6) {
      ctx.fillRect(i, y0 + 1, 2, 1);
      ctx.fillRect(x0 + w - (i - x0) - 2, y0 + w - 2, 2, 1);
    }
    return cv;
  });
}

export function bubbleSprite() {
  return sprite('bubble', () => {
    const cv = canvas(BS), ctx = cv.getContext('2d');
    const c = (BS - 1) / 2;
    for (let y = 0; y < BS; y++) for (let x = 0; x < BS; x++) {
      const dx = x - c, dy = y - c, d = Math.sqrt(dx * dx + dy * dy);
      if (d <= 15.6 && d > 13.4) { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x, y, 1, 1); }
      else if (d <= 13.4 && d > 12.4) { ctx.fillStyle = 'rgba(205,243,255,.5)'; ctx.fillRect(x, y, 1, 1); }
      else if (d <= 12.4) { ctx.fillStyle = 'rgba(150,225,255,.28)'; ctx.fillRect(x, y, 1, 1); }
    }
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.fillRect(8, 5, 4, 2); ctx.fillRect(6, 7, 2, 4);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillRect(22, 22, 3, 2);
    return cv;
  });
}
