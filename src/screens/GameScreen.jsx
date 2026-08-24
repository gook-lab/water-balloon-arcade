import React from 'react';
import PixelCanvas from '../components/PixelCanvas.jsx';
import HudBar from '../components/HudBar.jsx';
import ResultOverlay from '../components/ResultOverlay.jsx';
import { useGame } from '../hooks/useGame.js';

export default function GameScreen({ charIdx, mapIdx, settings, onChangeMap, onChangeChar }) {
  const { canvasRef, hud, result, restart } = useGame({ charIdx, mapIdx, settings });

  return (
    <div className="screen-center">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', maxWidth: 1500 }}>
        <HudBar hud={hud} charIdx={charIdx} />

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', padding: 10, borderRadius: 6, border: '3px solid var(--outline)', background: 'var(--frame-2)', boxShadow: '0 8px 0 rgba(0,0,0,.4), inset 0 3px 0 var(--frame-1)' }}>
            <PixelCanvas
              ref={canvasRef}
              style={{ display: 'block', height: '72vh', width: 'auto', maxWidth: '92vw', aspectRatio: '15 / 13', background: '#0e1226' }}
            />
            {result && (
              <ResultOverlay result={result} onRestart={restart} onChangeMap={onChangeMap} onChangeChar={onChangeChar} />
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, alignItems: 'center', fontSize: 12, color: '#8e9bd0', whiteSpace: 'nowrap' }}>
          <div>방향키 이동 · 스페이스 물풍선 · X 바늘</div>
          <div>타일 {settings.tileSize}px · 15 × 13</div>
        </div>
      </div>
    </div>
  );
}
