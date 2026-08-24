import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine.js';
import { playSfx } from '../audio/audio.js';

/**
 * 게임 루프는 엔진이 소유한다. React는 HUD 스냅샷만 구독한다.
 * 엔진은 값이 실제로 바뀔 때만 onHud를 호출해야 한다(프레임마다 호출 금지).
 */
export function useGame({ charIdx, mapIdx, settings }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [hud, setHud] = useState(null);
  const [result, setResult] = useState(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const engine = new GameEngine({
      canvas: canvasRef.current,
      charIdx,
      mapIdx,
      ...settings,
      onHud: setHud,
      onFinish: setResult,
      onSound: playSfx
    });
    engineRef.current = engine;
    engine.start();
    return () => engine.stop();
  }, [charIdx, mapIdx, settings, round]);

  const restart = () => {
    setResult(null);
    setRound((n) => n + 1);
  };

  return { canvasRef, hud, result, restart };
}
