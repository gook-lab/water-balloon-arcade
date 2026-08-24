import React, { useEffect, useState } from 'react';
import { installUnlock, startBgm, playSfx } from './audio/audio.js';
import TitleScreen from './screens/TitleScreen.jsx';
import CharacterSelect from './screens/CharacterSelect.jsx';
import MapSelect from './screens/MapSelect.jsx';
import GameScreen from './screens/GameScreen.jsx';

const DEFAULT_SETTINGS = { tileSize: 128, matchSeconds: 180, botCount: 3, botSkill: '보통' };

// 개발·QA용 URL 파라미터: ?t=초 (제한 시간), ?bots=1..3
function initialSettings() {
  const q = new URLSearchParams(window.location.search);
  const s = { ...DEFAULT_SETTINGS };
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

  if (screen === 'title')
    return <TitleScreen settings={settings} onSettingsChange={setSettings} onStart={() => setScreen('select')} />;
  if (screen === 'select')
    return (
      <CharacterSelect
        value={charIdx}
        onChange={setCharIdx}
        onBack={() => setScreen('title')}
        onNext={() => setScreen('map')}
      />
    );
  if (screen === 'map')
    return (
      <MapSelect
        value={mapIdx}
        onChange={setMapIdx}
        onBack={() => setScreen('select')}
        onStart={() => setScreen('game')}
      />
    );
  return (
    <GameScreen
      charIdx={charIdx}
      mapIdx={mapIdx}
      settings={settings}
      onChangeMap={() => setScreen('map')}
      onChangeChar={() => setScreen('select')}
    />
  );
}
