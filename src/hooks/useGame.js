import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine.js';
import { playSfx } from '../audio/audio.js';
import { recordResult } from '../records.js';

/**
 * 게임 루프는 엔진이 소유한다. React는 HUD · 단계(phase) 스냅샷만 구독한다.
 * 엔진은 값이 실제로 바뀔 때만 onHud · onPhase 를 호출해야 한다(프레임마다 호출 금지).
 *
 * 돌려주는 것
 * - result: 'win' | 'lose' | 'draw' | null
 * - report: 결과 화면용 — { survivalMs, trapped, popped, items, final, difficulty, record, newBest }
 * - phase: { phase: 'countdown'|'playing'|'paused'|'finished', count, go }
 * - pause() · resume() · restart()
 */
export function useGame({ charIdx, mapIdx, settings }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [hud, setHud] = useState(null);
  const [result, setResult] = useState(null);
  const [report, setReport] = useState(null);
  const [phase, setPhase] = useState(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const difficulty = settings.botSkill;
    const engine = new GameEngine({
      canvas: canvasRef.current,
      charIdx,
      mapIdx,
      ...settings,
      onHud: setHud,
      onPhase: setPhase,
      onFinish: (kind, stats) => {
        // 기록은 끝난 판만 — 일시정지에서 「처음부터」 · 「나가기」로 그만둔 판은 남기지 않는다
        const rec = recordResult(difficulty, { result: kind, survivalMs: stats.survivalMs, trapped: stats.trapped });
        setReport({ ...stats, difficulty, record: rec.record, newBest: rec.newBest });
        setResult(kind);
      },
      onSound: playSfx
    });
    engineRef.current = engine;
    engine.start();
    return () => engine.stop();
  }, [charIdx, mapIdx, settings, round]);

  const restart = useCallback(() => {
    setResult(null);
    setReport(null);
    setPhase(null);
    setRound((n) => n + 1);
  }, []);
  const pause = useCallback(() => engineRef.current?.pause(), []);
  const resume = useCallback(() => engineRef.current?.resume(), []);

  return { canvasRef, hud, result, report, phase, pause, resume, restart };
}
