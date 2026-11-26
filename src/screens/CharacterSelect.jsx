import { useEffect, useRef } from 'react';
import PixelCanvas from '../components/PixelCanvas.jsx';
import { CHARS } from '../game/characters.js';
import { charSprite, CHAR_SPRITE_SIZE as CS } from '../game/sprites.js';
import { radioKeyIndex } from './screenUtils.js';

function CharCanvas({ ch }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CS, CS);
    ctx.drawImage(charSprite(ch, 'down'), 0, 0);
  }, [ch]);
  return <PixelCanvas ref={ref} width={CS} height={CS} aria-hidden="true" style={{ width: 80, height: 80, animation: 'floatBob 2.6s ease-in-out infinite' }} />;
}

const STAT_COLORS = { 풍: '#ff8fb1', 줄: '#7fd8ff', 속: '#ffd23f' };
const STAT_NAMES = { 풍: '풍선 수', 줄: '물줄기 길이', 속: '속도' };

export default function CharacterSelect({ value, onChange, onBack, onNext }) {
  const cardRefs = useRef([]);
  const onCardKey = (e, i) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onChange(i);
      return;
    }
    const next = radioKeyIndex(e.key, i, CHARS.length);
    if (next === null) return;
    e.preventDefault();
    onChange(next);
    cardRefs.current[next]?.focus();
  };
  return (
    <div className="screen-center">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, animation: 'popIn .3s ease both' }}>
        <h1 className="screen-title">누구로 할까요?</h1>
        <p className="stat-legend">
          {Object.keys(STAT_NAMES).map((k) => (
            <span key={k}><b style={{ color: STAT_COLORS[k] }}>{k}</b> {STAT_NAMES[k]}</span>
          ))}
        </p>
        <div role="radiogroup" aria-label="캐릭터" className="pick-grid" style={{ maxWidth: 740 }}>
          {CHARS.map((ch, i) => {
            const selected = i === value;
            const stats = [
              { label: '풍', value: ch.base.maxBalloons },
              { label: '줄', value: ch.base.power },
              { label: '속', value: ch.base.speed }
            ];
            return (
              <div
                key={ch.id}
                ref={(el) => { cardRefs.current[i] = el; }}
                role="radio"
                aria-checked={selected}
                aria-label={`${ch.name} — ${ch.desc}. 풍선 ${ch.base.maxBalloons}, 물줄기 ${ch.base.power}, 속도 ${ch.base.speed}`}
                tabIndex={selected ? 0 : -1}
                className="pick-card"
                onClick={() => onChange(i)}
                onKeyDown={(e) => onCardKey(e, i)}
                style={{
                  width: 152, padding: '18px 12px 16px',
                  borderColor: selected ? '#ffd23f' : 'var(--outline)',
                  boxShadow: selected ? '0 5px 0 rgba(255,210,63,.4)' : '0 5px 0 rgba(0,0,0,.35)'
                }}
              >
                <CharCanvas ch={ch} />
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>{ch.name}</div>
                <div style={{ fontSize: 12, color: '#cdd6f7', textAlign: 'center', lineHeight: 1.5, minHeight: 36 }}>{ch.desc}</div>
                <div aria-hidden="true" style={{ display: 'flex', gap: 5 }}>
                  {stats.map((s) => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,.3)', borderRadius: 999, padding: '3px 8px', fontFamily: 'var(--font-display)', fontSize: 12, color: STAT_COLORS[s.label] }}>
                      {s.label}{s.value}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn-ghost" style={{ fontSize: 17, padding: '11px 26px' }} onClick={onBack}>뒤로</button>
          <button className="btn-cta" style={{ fontSize: 25, padding: '13px 44px', boxShadow: '0 8px 0 #c47c00, 0 18px 30px rgba(0,0,0,.45)' }} onClick={onNext}>다음</button>
        </div>
      </div>
    </div>
  );
}
