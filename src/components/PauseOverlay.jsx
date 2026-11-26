import { useEffect, useRef } from 'react';
import { popIn, prefersReducedMotion } from './motion.js';

// 일시정지 화면 — Esc · P · HUD 버튼 · 탭 숨김으로 열린다. Esc · P 로 닫는 건 엔진 keydown 이 맡는다.
export default function PauseOverlay({ onResume, onRestart, onExit }) {
  const boxRef = useRef(null);
  const firstRef = useRef(null);
  useEffect(() => { firstRef.current?.focus(); }, []);

  // Tab 이 일시정지 화면 안에서만 돌게
  const onKeyDown = (e) => {
    if (e.key !== 'Tab' || !boxRef.current) return;
    const btns = [...boxRef.current.querySelectorAll('button')];
    if (!btns.length) return;
    const first = btns[0], last = btns[btns.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div
      ref={boxRef}
      className="pause-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      onKeyDown={onKeyDown}
      style={{ position: 'absolute', inset: 10, background: 'rgba(14,18,38,.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, animation: popIn(prefersReducedMotion()) }}
    >
      <div id="pause-title" style={{ fontFamily: 'var(--font-display)', fontSize: 52, color: '#fff', textShadow: '0 5px 0 rgba(0,0,0,.35)' }}>잠깐 멈췄어요</div>
      <div style={{ fontSize: 14, color: '#cdd6f7' }}>Esc · P 를 눌러도 이어서 해요</div>
      <div className="pause-actions" style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button ref={firstRef} type="button" className="btn-cta" style={{ fontSize: 21, padding: '12px 30px', boxShadow: '0 7px 0 #c47c00' }} onClick={onResume}>계속할게요</button>
        <button type="button" className="btn-ghost" style={{ fontSize: 21, padding: '12px 24px' }} onClick={onRestart}>처음부터 할래요</button>
        <button type="button" className="btn-ghost" style={{ fontSize: 21, padding: '12px 24px' }} onClick={onExit}>나갈래요</button>
      </div>
    </div>
  );
}
