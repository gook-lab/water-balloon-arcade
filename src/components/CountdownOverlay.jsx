import { popIn, prefersReducedMotion } from './motion.js';

// 시작 카운트다운 「3 · 2 · 1 · 시작!」 — 판 위에 겹쳐 띄우고 클릭은 통과시킨다.
export default function CountdownOverlay({ phase }) {
  if (!phase) return null;
  const counting = phase.phase === 'countdown' && phase.count > 0;
  if (!counting && !phase.go) return null;
  const text = counting ? String(phase.count) : '시작!';
  const reduced = prefersReducedMotion();
  return (
    <div className="countdown-overlay" style={{ position: 'absolute', inset: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div
        key={text}
        role="status"
        aria-live="assertive"
        style={{
          fontFamily: 'var(--font-display)', fontSize: counting ? 140 : 96, lineHeight: 1,
          padding: counting ? '18px 52px' : '18px 40px', borderRadius: 12, background: 'rgba(14,18,38,.55)',
          color: counting ? '#fff' : '#ffd23f', textShadow: '0 6px 0 rgba(0,0,0,.45), 0 0 0 #000',
          WebkitTextStroke: '3px #16203c', animation: popIn(reduced, '.25s')
        }}
      >
        {text}
      </div>
    </div>
  );
}
