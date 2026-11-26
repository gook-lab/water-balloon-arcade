import { useEffect, useState } from 'react';
import { installUnlock, startBgm, playSfx } from './audio/audio.js';
import TitleScreen from './screens/TitleScreen.jsx';
import CharacterSelect from './screens/CharacterSelect.jsx';
import MapSelect from './screens/MapSelect.jsx';
import GameScreen from './screens/GameScreen.jsx';
import FirstTip from './screens/FirstTip.jsx';
import { setRangeVisible } from './game/renderer.js';
import { loadRecords, summaryLine } from './records.js';

const DEFAULT_SETTINGS = { tileSize: 128, matchSeconds: 180, botCount: 3, botSkill: '보통', showRange: true };

// 개발·QA용 URL 파라미터: ?t=초 (제한 시간), ?bots=1..3
function initialSettings() {
  const q = new URLSearchParams(window.location.search);
  const s = { ...DEFAULT_SETTINGS };

  // localStorage에서 난이도 · 물줄기 범위 보기 로드
  try {
    const saved = JSON.parse(localStorage.getItem('wba-settings') || '{}');
    if (['쉬움', '보통', '어려움'].includes(saved.botSkill)) s.botSkill = saved.botSkill;
    if (typeof saved.showRange === 'boolean') s.showRange = saved.showRange;
  } catch {
    // localStorage 읽기 실패: 기본값 사용
  }

  if (q.get('t')) s.matchSeconds = Math.max(3, parseInt(q.get('t'), 10) || s.matchSeconds);
  if (q.get('bots')) s.botCount = Math.min(3, Math.max(1, parseInt(q.get('bots'), 10) || s.botCount));
  return s;
}

export default function App() {
  const [screen, setScreen] = useState('title');
  const [charIdx, setCharIdx] = useState(0);
  const [mapIdx, setMapIdx] = useState(0);
  const [settings, setSettings] = useState(initialSettings);

  // 오디오: 첫 제스처 잠금 해제 + 버튼 클릭음 (캡처 단계 전역 1곳)
  useEffect(() => {
    installUnlock();
    const onClick = (e) => { if (e.target.closest && e.target.closest('button')) playSfx('ui'); };
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, []);
  // 화면별 BGM: 인게임 트랙 / 그 외 타이틀 트랙
  useEffect(() => { startBgm(screen === 'game' ? 'game' : 'title'); }, [screen]);
  // 화면이 바뀌면 맨 위에서 시작 — 게임 중엔 방향키가 스크롤을 막아 HUD 가 화면 밖에 남는다(QA S1)
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  useEffect(() => { setRangeVisible(settings.showRange); }, [settings.showRange]);

  const handleSettingsChange = (newSettings) => {
    setSettings(newSettings);
    // localStorage에 난이도 · 물줄기 범위 보기 저장
    try {
      localStorage.setItem('wba-settings', JSON.stringify({ botSkill: newSettings.botSkill, showRange: newSettings.showRange }));
    } catch {
      // localStorage 쓰기 실패: 무시
    }
  };

  let view;
  if (screen === 'title')
    view = (
      <TitleScreen
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onStart={() => setScreen('select')}
        recordLine={summaryLine(loadRecords(), settings.botSkill)}
      />
    );
  else if (screen === 'select')
    view = (
      <CharacterSelect
        value={charIdx}
        onChange={setCharIdx}
        onBack={() => setScreen('title')}
        onNext={() => setScreen('map')}
      />
    );
  else if (screen === 'map')
    view = (
      <MapSelect
        value={mapIdx}
        onChange={setMapIdx}
        onBack={() => setScreen('select')}
        onStart={() => setScreen('game')}
      />
    );
  else
    view = (
      <>
        <h1 className="sr-only">물풍선 대작전 — 게임 중</h1>
        <GameScreen
          charIdx={charIdx}
          mapIdx={mapIdx}
          settings={settings}
          onChangeMap={() => setScreen('map')}
          onChangeChar={() => setScreen('select')}
          onExit={() => setScreen('title')}
        />
        <FirstTip />
      </>
    );
  return <main>{view}</main>;
}
