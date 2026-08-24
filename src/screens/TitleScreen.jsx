import React, { useEffect, useRef, useState } from 'react';
import PixelCanvas from '../components/PixelCanvas.jsx';
import { CHARS } from '../game/characters.js';
import { charSprite } from '../game/sprites.js';
import { getAudioSettings, setMuted, setVolume } from '../audio/audio.js';

const TILE_OPTIONS = [64, 128, 256];
const SKILL_OPTIONS = ['쉬움', '보통', '어려움'];

function OptionRow({ label, options, value, format, onPick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 12, color: '#8e9bd0', minWidth: 52 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map((op) => {
          const active = op === value;
          return (
            <button
              key={op}
              className={active ? 'btn-cta' : 'btn-ghost'}
              style={{ fontSize: 13, padding: '5px 14px', boxShadow: active ? '0 3px 0 #c47c00' : 'none' }}
              onClick={() => onPick(op)}
            >
              {format ? format(op) : op}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const VOLUME_OPTIONS = [
  { label: '낮음', value: 0.3 },
  { label: '중간', value: 0.7 },
  { label: '높음', value: 1 }
];

function SoundRows() {
  const [audio, setAudio] = useState(getAudioSettings);
  const volLabel = (VOLUME_OPTIONS.find((o) => Math.abs(o.value - audio.volume) < 0.15) || VOLUME_OPTIONS[1]).label;
  return (
    <>
      <OptionRow
        label="사운드"
        options={['켬', '끔']}
        value={audio.muted ? '끔' : '켬'}
        onPick={(v) => { setMuted(v === '끔'); setAudio(getAudioSettings()); }}
      />
      {!audio.muted && (
        <OptionRow
          label="볼륨"
          options={VOLUME_OPTIONS.map((o) => o.label)}
          value={volLabel}
          onPick={(label) => {
            setVolume(VOLUME_OPTIONS.find((o) => o.label === label).value);
            setAudio(getAudioSettings());
          }}
        />
      )}
    </>
  );
}

export default function TitleScreen({ settings, onSettingsChange, onStart }) {
  const heroRef = useRef(null);
  const total = settings.matchSeconds;
  const matchLabel = Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');

  useEffect(() => {
    const drawHero = () => {
      const cv = heroRef.current;
      if (!cv) return;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, cv.width, cv.height);
      CHARS.forEach((c, i) => ctx.drawImage(charSprite(c, 'down'), i * 80 + 8, 8, 80, 80));
    };
    drawHero();
    if (document.fonts) document.fonts.ready.then(drawHero);
  }, []);

  return (
    <div className="screen-center">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, animation: 'bnbPop .35s ease both' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 7, color: '#7fd8ff' }}>WATER BALLOON ARCADE</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 76, lineHeight: 1.15, whiteSpace: 'nowrap', color: 'var(--accent)', textShadow: '4px 0 0 var(--outline), -4px 0 0 var(--outline), 0 -4px 0 var(--outline), 0 6px 0 #3a4a8f, 0 12px 0 rgba(0,0,0,.35)' }}>물풍선 대작전</div>
          <div style={{ fontSize: 16, color: '#b9c4ee', marginTop: 8 }}>6명의 캐릭터, 5개의 맵. 15 × 13 타일. 마지막까지 살아남으세요.</div>
        </div>

        <PixelCanvas ref={heroRef} width={480} height={96} style={{ width: 480, height: 96, animation: 'bnbFloat 3s ease-in-out infinite' }} />

        <div style={{ display: 'flex', gap: 12 }}>
          <div className="info-card">
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: '#ffd23f' }}>조작</div>
            <div className="info-line">방향키 / WASD — 이동</div>
            <div className="info-line">스페이스 — 물풍선</div>
            <div className="info-line">X — 바늘</div>
          </div>
          <div className="info-card">
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: '#ffd23f' }}>규칙</div>
            <div className="info-line">물에 맞으면 풍선에 갇힘</div>
            <div className="info-line">갇힌 뒤 4초 → 탈락</div>
            <div className="info-line">제한 시간 {matchLabel}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          <OptionRow
            label="타일"
            options={TILE_OPTIONS}
            value={settings.tileSize}
            format={(v) => v + 'px'}
            onPick={(tileSize) => onSettingsChange({ ...settings, tileSize })}
          />
          <OptionRow
            label="난이도"
            options={SKILL_OPTIONS}
            value={settings.botSkill}
            onPick={(botSkill) => onSettingsChange({ ...settings, botSkill })}
          />
          <SoundRows />
        </div>

        <button className="btn-cta" style={{ fontSize: 27, padding: '15px 52px', boxShadow: '0 8px 0 #c47c00, 0 18px 30px rgba(0,0,0,.45)' }} onClick={onStart}>게임 시작</button>
      </div>
    </div>
  );
}
