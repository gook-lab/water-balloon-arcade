// 캐릭터 도트맵 v3 — 봄버맨풍 재디자인 (2026-08-24 사용자 피드백).
// 실루엣: 안테나 보블 + 둥근 헬멧 + 흰 페이스플레이트 + 세로 눈 + 작은 몸통 + 발.
// 팔레트 키: o=아웃라인 b=몸통색 d=어두운톤 w=흰색(뒷모습=몸통색) e=눈 a=액센트
// 스탯(base)은 원본 그대로 — 변경 금지.
export const BODY = [
  '.......aa.......',
  '.......oo.......',
  '.....oooooo.....',
  '....obbbbbbo....',
  '...obbbbbbbbo...',
  '...obwwwwwwbo...',
  '..obwwewwewwbo..',
  '..obwwewwewwbo..',
  '..obwwwwwwwwbo..',
  '...obwwwwwwbo...',
  '...obbbbbbbbo...',
  '..obbbbbbbbbbo..',
  '..odbbbaabbbdo..',
  '...oddddddddo...',
  '..owwo....owwo..',
  '..oooo....oooo..'
];

export const CHARS = [
  { id: 'coco', name: '코코', color: '#ff6f91', dark: '#d84c6f', accent: '#ffd0dd',
    desc: '균형형. 무난하게 강함', base: { maxBalloons: 1, power: 1, speed: 3, pins: 0 }, over: {} },
  { id: 'mungchi', name: '뭉치', color: '#7fd8ff', dark: '#48aee0', accent: '#e6f8ff',
    desc: '고양이. 물줄기 +1', base: { maxBalloons: 1, power: 2, speed: 3, pins: 0 },
    over: {
      0: '................',
      1: '...oo......oo...',
      2: '..oboooooooobo..',
      3: '..obbbbbbbbbbo..'
    } },
  { id: 'ppyong', name: '삐용', color: '#ffd23f', dark: '#dda408', accent: '#ff8b3d',
    desc: '병아리. 발이 빠름', base: { maxBalloons: 1, power: 1, speed: 5, pins: 0 },
    over: {
      0: '......aaaa......',
      1: '.....oaaaao.....',
      8: '..obwwwaawwwbo..'
    } },
  { id: 'tori', name: '토리', color: '#c9a06a', dark: '#a17b48', accent: '#f0d9b8',
    desc: '곰. 물풍선 +1', base: { maxBalloons: 2, power: 1, speed: 3, pins: 0 },
    over: {
      0: '................',
      1: '..ooo......ooo..',
      2: '..obbooooooobbo.',
      3: '..obbbbbbbbbbo..'
    } },
  { id: 'penggu', name: '펭구', color: '#4b5bb0', dark: '#33418c', accent: '#ffb02e',
    desc: '펭귄. 느리지만 튼튼', base: { maxBalloons: 2, power: 2, speed: 2, pins: 0 },
    over: {
      8: '..obwwwaawwwbo..',
      11: '..obbwwwwwwbbo..',
      12: '..odbwwwwwwbdo..',
      13: '...odwwwwwwdo...'
    } },
  { id: 'robo', name: '로보', color: '#9ff0b4', dark: '#67c481', accent: '#ff5d8f',
    desc: '로봇. 바늘 1개 소지', base: { maxBalloons: 1, power: 1, speed: 4, pins: 1 },
    over: {
      6: '..obweeeeeewbo..',
      7: '..obweeeeeewbo..',
      12: '..odbaabbaabdo..'
    } }
];
