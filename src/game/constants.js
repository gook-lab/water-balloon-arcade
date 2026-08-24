// 원본: 물풍선 대작전.dc.html 상단 상수. 수치 변경 금지 (PROMPT.md).
export const NX = 15;
export const NY = 13;
export const S = 16;

export const FUSE = 2600;      // 물풍선 도화선 ms
export const WATER_MS = 480;   // 물줄기 잔류 ms
export const TRAP_MS = 4000;   // 갇힘 유지 ms

export const key = (x, y) => x + ',' + y;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const ITEM_DEFS = {
  balloon: { icon: '풍', color: '#ff8fb1', glyph: '#ffffff', bad: false },
  power: { icon: '줄', color: '#7fd8ff', glyph: '#ffffff', bad: false },
  speed: { icon: '속', color: '#ffd23f', glyph: '#5a3a00', bad: false },
  needle: { icon: '침', color: '#ffffff', glyph: '#ff5d8f', bad: false },
  passBalloon: { icon: '통', color: '#c9a6ff', glyph: '#ffffff', bad: false },
  passBlock: { icon: '블', color: '#9ff0b4', glyph: '#1d5b31', bad: false },
  turtle: { icon: '거', color: '#8fae9c', glyph: '#26402f', bad: true }
};

export const ITEM_POOL = [
  'balloon', 'balloon', 'balloon',
  'power', 'power', 'power',
  'speed', 'speed',
  'needle', 'passBalloon', 'passBlock', 'turtle'
];
