// 화면(React) 쪽 순수 도우미 — DOM · 저장소는 인자로 받아 시험할 수 있게 둔다.

/** 첫 판 말풍선을 이미 봤는지 기록하는 키. 엔진의 판 기록과 따로 둔다. */
export const TIP_KEY = 'wba-seen-tip';

export function shouldShowFirstTip(storage) {
  try {
    return !storage || storage.getItem(TIP_KEY) !== '1';
  } catch {
    return true; // 저장소가 막혔으면 보여 주되, 다시 띄우지 않는 건 화면 상태가 맡는다
  }
}

export function markFirstTipSeen(storage) {
  try {
    if (storage) storage.setItem(TIP_KEY, '1');
  } catch {
    // 저장 실패: 이번 방문에서만 한 번
  }
}

/**
 * 라디오 그룹 키보드 이동. 바뀔 칸 번호를 돌려주고, 처리하지 않는 키면 null.
 * 좌 · 위 = 이전, 우 · 아래 = 다음(끝에서 돌아감), Home · End = 처음 · 끝.
 */
export function radioKeyIndex(key, index, count) {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count;
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/** 손가락(굵은 포인터)이 주 입력인 기기인지. 마우스가 함께 있으면 false. */
export function isTouchFirst(win) {
  if (!win || !win.matchMedia) return false;
  return win.matchMedia('(pointer: coarse)').matches && !win.matchMedia('(any-pointer: fine)').matches;
}

const NATIVE = ['영', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];
/** 1~10 은 고유어 수(여섯 · 일곱), 그 밖은 숫자. */
export function koCount(n) {
  return Number.isInteger(n) && n >= 0 && n <= 10 ? NATIVE[n] : String(n);
}

/** 180 → '3분', 90 → '1분 30초', 45 → '45초' */
export function formatMatchLength(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  if (!m) return `${s}초`;
  return s ? `${m}분 ${s}초` : `${m}분`;
}
