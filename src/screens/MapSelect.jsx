import { useEffect, useRef } from 'react';
import PixelCanvas from '../components/PixelCanvas.jsx';
import { MAPS } from '../game/maps.js';
import { drawMapPreview } from '../game/renderer.js';
import { radioKeyIndex } from './screenUtils.js';

function MapPreview({ theme }) {
  const ref = useRef(null);
  useEffect(() => {
    const draw = () => { if (ref.current) drawMapPreview(ref.current, theme); };
    draw();
    if (theme.layout === 'random' && document.fonts) document.fonts.ready.then(draw);
  }, [theme]);
  return <PixelCanvas ref={ref} width={120} height={104} aria-hidden="true" style={{ width: 190, height: 165, borderRadius: 2, border: '2px solid var(--outline)', background: '#0e1226' }} />;
}

export default function MapSelect({ value, onChange, onBack, onStart }) {
  const cardRefs = useRef([]);
  const onCardKey = (e, i) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(i);
      return;
    }
    const next = radioKeyIndex(e.key, i, MAPS.length);
    if (next === null) return;
    e.preventDefault();
    onChange(next);
    cardRefs.current[next]?.focus();
  };
  return (
    <div className="screen-center">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, animation: 'popIn .3s ease both' }}>
        <h1 className="screen-title">어디서 할까요?</h1>
        <div role="radiogroup" aria-label="맵" className="pick-grid pick-grid-maps" style={{ maxWidth: 1180 }}>
          {MAPS.map((mp, i) => {
            const selected = i === value;
            return (
              <div
                key={mp.id}
                ref={(el) => { cardRefs.current[i] = el; }}
                role="radio"
                aria-checked={selected}
                aria-label={`${mp.name} — ${mp.desc}`}
                tabIndex={selected ? 0 : -1}
                className="pick-card"
                onClick={() => onChange(i)}
                onKeyDown={(e) => onCardKey(e, i)}
                style={{
                  width: 222, padding: 14,
                  borderColor: selected ? '#ffd23f' : 'var(--outline)',
                  boxShadow: selected ? '0 5px 0 rgba(255,210,63,.4)' : '0 5px 0 rgba(0,0,0,.35)'
                }}
              >
                <MapPreview theme={mp} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 21 }}>{mp.name}</div>
                <div style={{ fontSize: 12, color: '#cdd6f7', textAlign: 'center', lineHeight: 1.4, minHeight: 32 }}>{mp.desc}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn-ghost" style={{ fontSize: 17, padding: '11px 26px' }} onClick={onBack}>뒤로</button>
          <button className="btn-cta" style={{ fontSize: 25, padding: '13px 44px', boxShadow: '0 8px 0 #c47c00, 0 18px 30px rgba(0,0,0,.45)' }} onClick={onStart}>시작하기</button>
        </div>
      </div>
    </div>
  );
}
