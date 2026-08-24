// 테스트용 페이크 게임 상태. rows: 15자 문자열 13줄, '.'=empty 'S'=soft 'T'=tough 'H'=hard
import { NX, NY } from '../src/game/constants.js';

export function makeGame({ rows, T = 100, theme } = {}) {
  const grid = [];
  for (let y = 0; y < NY; y++) {
    const row = [];
    for (let x = 0; x < NX; x++) {
      const c = rows && rows[y] ? rows[y][x] : '.';
      row.push(c === 'H' ? 'hard' : c === 'S' ? 'soft' : c === 'T' ? 'tough' : 'empty');
    }
    grid.push(row);
  }
  return {
    T,
    theme: theme || {
      id: 'grass', name: '초록 들판', layout: 'classic', density: 0.62,
      g1: '#7fcf8f', g2: '#6dc07e',
      hard: ['#b9c6d6', '#8b9bb0', '#5f6d80'], soft: ['#f0b562', '#d9832c', '#a35e18']
    },
    grid, vars: new Map(), deco: new Map(),
    items: new Map(), balloons: [], water: new Map(), ents: [], parts: [], pops: [],
    start: performance.now(), last: performance.now(), dirty: false, layer: null
  };
}

export function makeEnt(game, tx, ty, over = {}) {
  const T = game.T;
  return {
    id: 0, isBot: false,
    ch: { id: 'coco', color: '#f00', dark: '#900', accent: '#fcc', base: { maxBalloons: 1, power: 1, speed: 3, pins: 0 } },
    x: tx * T + T / 2, y: ty * T + T / 2, r: T * 0.29,
    dir: 'down', walk: 0,
    maxBalloons: 1, power: 1, speed: 3, pins: 0,
    passBalloon: false, passBlock: false, slowUntil: 0,
    state: 'alive', trappedAt: 0, ignore: new Set(), path: [], nextThink: 0,
    ...over
  };
}
