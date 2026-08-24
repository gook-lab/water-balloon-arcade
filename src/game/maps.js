// 원본: 물풍선 대작전.dc.html MAPS / layoutHard / buildMap. 레이아웃 규칙 변경 금지.
import { NX, NY, key } from './constants.js';

// 밀도 상향(2026-08-24 사용자 피드백) + 신규 2테마(던전/유적).
// floorTex: dragon-game(던전크래프트)의 PixelLab 자체 생성 타일 재사용 — public/tilesets/
export const MAPS = [
  { id: 'grass', name: '초록 들판', desc: '기본 격자. 부술 블록이 많음', layout: 'classic', density: 0.72,
    g1: '#7fcf8f', g2: '#6dc07e', hard: ['#b9c6d6', '#8b9bb0', '#5f6d80'], soft: ['#f0b562', '#d9832c', '#a35e18'],
    floorTex: { url: '/tilesets/meadow.png', sx: 0, sy: 96, sw: 32, sh: 32 } }, // (0,96)=순수 풀 셀
  { id: 'beach', name: '모래 해변', desc: '가로 통로형. 추격전이 잦음', layout: 'lanes', density: 0.62,
    g1: '#f2dfa8', g2: '#e6cf93', hard: ['#ffd6c2', '#e59a7a', '#a86243'], soft: ['#8fd7e0', '#4aa3b8', '#2a6e80'] },
  { id: 'snow', name: '눈 언덕', desc: '고리 구조. 빙판 미로', layout: 'rings', density: 0.66,
    g1: '#e3f0fb', g2: '#cfe3f5', hard: ['#eafaff', '#a9d6ee', '#6d9dbd'], soft: ['#dfe9f2', '#a9b8c9', '#77869a'] },
  // 참고: ice.png 빙판 텍스처는 물줄기(파랑)와 겹쳐 위험 가독성을 해쳐 미적용
  { id: 'lava', name: '용암 동굴', desc: '4구역 분할. 중앙이 격전지', layout: 'quads', density: 0.7,
    g1: '#4a3b52', g2: '#3f3247', hard: ['#7a5a6b', '#4e3a4a', '#2a1f2c'], soft: ['#ff9b57', '#d1602a', '#8c3a14'] },
  { id: 'factory', name: '고철 공장', desc: '대각선 벽. 시야가 좁음', layout: 'diagonal', density: 0.62,
    g1: '#9aa4b8', g2: '#8a94a8', hard: ['#d8dee8', '#98a2b4', '#616b7d'], soft: ['#ffd23f', '#c99b12', '#8a6a08'] },
  { id: 'dungeon', name: '던전 지하실', desc: '방과 통로. 좁은 문이 격전지', layout: 'chambers', density: 0.66,
    g1: '#5c554e', g2: '#544e48', hard: ['#8f8b84', '#6b6660', '#3f3b36'], soft: ['#c9995c', '#a1712f', '#6d4a1c'],
    floorTex: { url: '/tilesets/crypt_a2.png', sx: 0, sy: 0, sw: 32, sh: 32 } },
  { id: 'ruins', name: '고대 유적', desc: '흩어진 돌기둥. 은신처가 많음', layout: 'ruins', density: 0.6,
    g1: '#7da089', g2: '#719580', hard: ['#b7c4b3', '#87968f', '#57645c'], soft: ['#d9b878', '#b08a44', '#7c5c26'] },
  { id: 'random', name: '랜덤', desc: '입장할 때 무작위 선택', layout: 'random', density: 0.66,
    g1: '#5a6bb5', g2: '#4c5da5', hard: ['#cfd8ee', '#8f9bc6', '#5d6894'], soft: ['#ff8fb1', '#d95a80', '#8f2f4d'] }
];

export function layoutHard(kind, x, y) {
  const inner = x > 0 && y > 0 && x < NX - 1 && y < NY - 1;
  switch (kind) {
    case 'classic': return x % 2 === 1 && y % 2 === 1;
    case 'lanes': return (y === 2 || y === 5 || y === 7 || y === 10) && x >= 1 && x <= NX - 2 && x % 4 !== 0;
    case 'rings': {
      const ring = (x0, y0, x1, y1) =>
        ((x === x0 || x === x1) && y >= y0 && y <= y1 && y !== 6) ||
        ((y === y0 || y === y1) && x >= x0 && x <= x1 && x !== 7);
      return ring(2, 2, 12, 10) || ring(5, 4, 9, 8);
    }
    case 'quads': return inner && (x % 4 === 1 || x % 4 === 2) && (y % 4 === 1 || y % 4 === 2);
    case 'diagonal': return inner && (Math.abs(x - y) === 4 || x + y === 8 || x + y === 18 || (x % 2 === 1 && y % 2 === 1 && (x + y) % 4 === 0));
    case 'chambers': {
      // 3×3 방 구조 — 벽 x=4,10 / y=4,8 에 문(gap) 배치
      const doorRow = y === 2 || y === 6 || y === 10;
      const doorCol = x === 2 || x === 7 || x === 12;
      return ((x === 4 || x === 10) && !doorRow) || ((y === 4 || y === 8) && !doorCol);
    }
    case 'ruins': // 흩어진 돌기둥 + 규칙 기둥 혼합 (결정적)
      return inner && ((x * 3 + y * 7) % 6 === 0 || (x % 4 === 2 && y % 4 === 2));
    default: return false;
  }
}

// 스폰 코너 4곳 3칸 확보 → 밀도 기반 상자 배치 → BFS 연결성 보정(고립 구역이 있으면 하드블록을 연다)
export function buildMap(theme) {
  const grid = [];
  for (let y = 0; y < NY; y++) {
    grid.push([]);
    for (let x = 0; x < NX; x++) grid[y].push(layoutHard(theme.layout, x, y) ? 'hard' : 'empty');
  }
  const safe = new Set();
  [[0, 0], [NX - 1, 0], [0, NY - 1], [NX - 1, NY - 1]].forEach(([cx, cy]) => {
    [[0, 0], [1, 0], [0, 1], [2, 0], [0, 2], [1, 1], [2, 1], [1, 2]].forEach(([dx, dy]) => {
      const x = cx === 0 ? cx + dx : cx - dx, y = cy === 0 ? cy + dy : cy - dy;
      safe.add(key(x, y));
      if (grid[y][x] === 'hard') grid[y][x] = 'empty';
    });
  });
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    if (grid[y][x] === 'empty' && !safe.has(key(x, y)) && Math.random() < theme.density) grid[y][x] = 'soft';
  }
  // connectivity: every non-hard tile must be reachable from a corner ignoring soft blocks
  const seen = new Set(['0,0']), q = [[0, 0]];
  let h = 0;
  while (h < q.length) {
    const [x, y] = q[h++];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const nx = x + dx, ny = y + dy, nk = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= NX || ny >= NY || seen.has(nk) || grid[ny][nx] === 'hard') return;
      seen.add(nk); q.push([nx, ny]);
    });
  }
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    if (grid[y][x] !== 'hard' && !seen.has(key(x, y))) {
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < NX && ny < NY && grid[ny][nx] === 'hard') grid[ny][nx] = 'empty';
      });
    }
  }
  const vars = new Map(), deco = new Map();
  for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
    const k = key(x, y), c = grid[y][x];
    if (c === 'soft') {
      if (Math.random() < 0.22) grid[y][x] = 'tough';
      else vars.set(k, Math.random() < 0.35 ? 1 : 0);
    } else if (c === 'hard') {
      vars.set(k, (x * 3 + y * 5) % 4 === 0 ? 1 : 0);
    } else if (Math.random() < 0.14) {
      deco.set(k, Math.floor(Math.random() * 3));
    }
  }
  return { grid, vars, deco };
}
