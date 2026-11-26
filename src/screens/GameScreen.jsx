import { useState } from 'react';
import PixelCanvas from '../components/PixelCanvas.jsx';
import HudBar from '../components/HudBar.jsx';
import ResultOverlay from '../components/ResultOverlay.jsx';
import { useGame } from '../hooks/useGame.js';
import { isTouchFirst } from './screenUtils.js';

export default function GameScreen({ charIdx, mapIdx, settings, onChangeMap, onChangeChar }) {
  const { canvasRef, hud, result, restart } = useGame({ charIdx, mapIdx, settings });
  const [touchFirst] = useState(() => isTouchFirst(window));

  return (
    <div className="screen-center game-screen">
      <div className="game-column">
        <HudBar hud={hud} charIdx={charIdx} />

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <div className="game-frame">
            <PixelCanvas ref={canvasRef} className="game-canvas" role="img" aria-label="게임 판 — 방향키로 움직이고 스페이스로 물풍선을 놓아요" />
            {result && (
              <ResultOverlay result={result} botSkill={settings.botSkill} onRestart={restart} onChangeMap={onChangeMap} onChangeChar={onChangeChar} />
            )}
          </div>
        </div>

        <p className="game-help">
          {touchFirst ? '키보드가 있는 컴퓨터에서 해요 · ' : ''}방향키 이동 · 스페이스 물풍선 · X 내 풍선 터뜨리기
        </p>
      </div>
    </div>
  );
}
