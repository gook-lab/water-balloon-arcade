import { useEffect, useRef } from 'react';
import PixelCanvas from './PixelCanvas.jsx';
import { CHARS } from '../game/characters.js';
import { charSprite, CHAR_SPRITE_SIZE as CS } from '../game/sprites.js';

export default function HudBar({ hud, charIdx, onPause, paused = false }) {
  const ch = CHARS[charIdx] || CHARS[0];
  const iconRef = useRef(null);

  useEffect(() => {
    const cv = iconRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, CS, CS);
    ctx.drawImage(charSprite(ch, 'down'), 0, 0);
  }, [ch]);

  const st = hud || { ...ch.base, botsAlive: 0, clockSec: 0, mapName: '' };
  const mm = Math.floor(st.clockSec / 60), ss = st.clockSec % 60;
  const stats = [
    { icon: '풍', color: '#ff8fb1', value: st.maxBalloons },
    { icon: '줄', color: '#7fd8ff', value: st.power },
    { icon: '속', color: '#ffd23f', value: st.speed },
    { icon: '침', color: '#ffffff', value: st.pins }
  ];

  return (
    <div className="pixel-panel" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PixelCanvas ref={iconRef} width={CS} height={CS} style={{ width: 38, height: 38 }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1.1 }}>{ch.name}</div>
          <div style={{ fontSize: 11, color: '#8e9bd0', whiteSpace: 'nowrap' }}>{st.mapName}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {stats.map((s) => (
          <div key={s.icon} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,.32)', border: '2px solid var(--outline)', borderRadius: 4, padding: '4px 12px 4px 4px' }}>
            <div style={{ width: 24, height: 24, borderRadius: 4, border: '2px solid var(--outline)', background: s.color, color: '#16203c', fontFamily: 'var(--font-display)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ fontSize: 12, color: '#b9c4ee' }}>
          남은 상대 <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#ff8fb1' }}>{st.botsAlive}</span>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: st.clockSec <= 30 ? '#ff6f91' : '#fff', minWidth: 92, textAlign: 'right' }}>
          {mm}:{String(ss).padStart(2, '0')}
        </div>
        {onPause && (
          // 일시정지 — 키보드(Esc · P)와 같은 경로. 다음 라운드 터치 조작도 이 버튼을 쓴다.
          <button
            type="button"
            className="btn-ghost hud-pause"
            aria-label="일시정지"
            title="일시정지 (Esc · P)"
            disabled={paused}
            onClick={(e) => { e.currentTarget.blur(); onPause(); }}
            style={{ width: 44, height: 44, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
          >
            <span aria-hidden="true" style={{ width: 6, height: 18, background: '#fff', borderRadius: 1 }} />
            <span aria-hidden="true" style={{ width: 6, height: 18, background: '#fff', borderRadius: 1 }} />
          </button>
        )}
      </div>
    </div>
  );
}
