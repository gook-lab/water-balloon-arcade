// 원본: 물풍선 대작전.dc.html dangerSet / bfs / think / driveBot.
// 순수 함수로 이식 — 첫 인자로 game 상태를 받는다.
// 우선순위: ① 위험 탈출 → ② 좋은 아이템 → ③ 탈출 경로 확보 시 설치 → ④ 상자 접근 → ⑤ 플레이어 추적
import { NX, NY, key, ITEM_DEFS } from './constants.js';
import { tileOf, balloonAt, blastTiles, tryPlace, moveEnt } from './rules.js';

export function dangerSet(game) {
  const d = new Set();
  game.balloons.forEach((b) => blastTiles(game, b).forEach((k) => d.add(k)));
  game.water.forEach((at, k) => d.add(k));
  return d;
}

export function bfs(game, e, sx, sy, isGoal, danger) {
  const q = [[sx, sy]], seen = new Set([key(sx, sy)]), prev = new Map();
  let head = 0;
  while (head < q.length) {
    const [x, y] = q[head++], k = key(x, y);
    if (isGoal(x, y, k)) {
      const path = [];
      let cur = k;
      while (prev.has(cur)) { path.unshift(cur.split(',').map(Number)); cur = prev.get(cur); }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, nk = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= NX || ny >= NY || seen.has(nk)) continue;
      const c = game.grid[ny][nx];
      if (c === 'hard' || ((c === 'soft' || c === 'tough') && !e.passBlock)) continue;
      if (balloonAt(game, nx, ny) && !e.passBalloon) continue;
      if (danger && danger.has(nk)) continue;
      seen.add(nk); prev.set(nk, k); q.push([nx, ny]);
    }
  }
  return null;
}

export function think(game, e, skill) {
  const [tx, ty] = tileOf(game, e), danger = dangerSet(game);
  const easy = skill === '쉬움';
  if (danger.has(key(tx, ty))) {
    // 위험 타일을 밟지 않는 탈출로 우선 — 없을 때만 위험 통과 허용 (탈출 중 피폭 방지)
    e.path = bfs(game, e, tx, ty, (x, y, k) => !danger.has(k), danger)
      || bfs(game, e, tx, ty, (x, y, k) => !danger.has(k), null)
      || [];
    return;
  }
  // 갇힌 상대 사냥 — 접촉하면 터뜨릴 수 있으므로 마무리 최우선
  const prey = game.ents.find((o) => o.id !== e.id && o.state === 'trapped');
  if (prey) {
    const [gx, gy] = tileOf(game, prey);
    const hunt = bfs(game, e, tx, ty, (x, y) => x === gx && y === gy, danger);
    if (hunt && hunt.length) { e.path = hunt; return; }
  }
  if (game.items.size) {
    const p = bfs(game, e, tx, ty, (x, y, k) => game.items.has(k) && !ITEM_DEFS[game.items.get(k)].bad, danger);
    if (p && p.length) { e.path = p; return; }
  }
  const player = game.ents[0];
  const nearSoft = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const nx = x + dx, ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < NX && ny < NY && (game.grid[ny][nx] === 'soft' || game.grid[ny][nx] === 'tough');
  });
  const close = player.state === 'alive' && Math.abs(player.x - e.x) + Math.abs(player.y - e.y) < game.T * (easy ? 1.5 : 2.6);
  if ((nearSoft(tx, ty) || close) && game.balloons.filter((b) => b.owner === e.id).length < e.maxBalloons) {
    // 탈출 경로가 확보될 때만 설치 (자기 풍선 자살 방지).
    // 자기 폭발선(도화선 2.6s)은 지나가도 되지만, 이미 존재하는 위험은 경유하지 않는 경로만 인정
    const bd = new Set([...danger, ...blastTiles(game, { tx, ty, power: e.power })]);
    const esc = bfs(game, e, tx, ty, (x, y, k) => !bd.has(k), danger);
    if (esc && esc.length) { tryPlace(game, e); e.path = esc; return; }
  }
  let p = bfs(game, e, tx, ty, (x, y, k) => nearSoft(x, y) && k !== key(tx, ty), danger);
  if (!p || !p.length) {
    const [px, py] = tileOf(game, player);
    p = bfs(game, e, tx, ty, (x, y) => x === px && y === py, danger);
  }
  if (!p || !p.length) p = bfs(game, e, tx, ty, (x, y, k) => k !== key(tx, ty), danger);
  e.path = p || [];
}

// 재계산 주기: 쉬움 420ms / 보통 220ms / 어려움 130ms
export function driveBot(game, e, dt, now, skill) {
  const iv = skill === '어려움' ? 130 : skill === '쉬움' ? 420 : 220;
  if (now > e.nextThink) { e.nextThink = now + iv; think(game, e, skill); }
  // 스테일 경로 방지: 재계산 주기 사이에 다음 타일이 위험해졌으면(새 풍선·물줄기) 즉시 재계획
  if (e.path.length) {
    const danger = dangerSet(game);
    const [px2, py2] = e.path[0];
    const [cx2, cy2] = tileOf(game, e);
    if (danger.has(key(px2, py2)) && !danger.has(key(cx2, cy2))) {
      e.nextThink = now + iv;
      think(game, e, skill);
    }
  }
  const T = game.T;
  while (e.path.length) {
    const [tx, ty] = e.path[0];
    const cx = tx * T + T / 2, cy = ty * T + T / 2;
    if (Math.abs(cx - e.x) < 5 && Math.abs(cy - e.y) < 5) { e.path.shift(); continue; }
    const dx = Math.abs(cx - e.x) > 3 ? Math.sign(cx - e.x) : 0;
    const dy = Math.abs(cy - e.y) > 3 ? Math.sign(cy - e.y) : 0;
    moveEnt(game, e, dx, dx ? 0 : dy, dt);
    return;
  }
}
