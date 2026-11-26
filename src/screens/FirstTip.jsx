import { useEffect, useState } from 'react';
import { shouldShowFirstTip, markFirstTipSeen, isTouchFirst } from './screenUtils.js';

const SHOW_MS = 8000;
const AFTER_PLACE_MS = 1500;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 첫 판 말풍선 — 처음 한 번만. 스페이스를 누르면 잠시 뒤 닫힌다. 터치 기기는 키 안내가 맞지 않아 띄우지 않는다. */
export default function FirstTip() {
  const [show, setShow] = useState(() => !isTouchFirst(window) && shouldShowFirstTip(storage()));

  useEffect(() => {
    if (!show) return undefined;
    markFirstTipSeen(storage());
    let closeTimer = setTimeout(() => setShow(false), SHOW_MS);
    const onKey = (e) => {
      if (e.code !== 'Space') return;
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => setShow(false), AFTER_PLACE_MS);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(closeTimer);
      window.removeEventListener('keydown', onKey);
    };
  }, [show]);

  if (!show) return null;
  return (
    <div className="first-tip" role="status">스페이스로 물풍선을 놓고 옆으로 피해요</div>
  );
}
