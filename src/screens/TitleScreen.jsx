import { useEffect, useId, useRef, useState } from 'react';
import PixelCanvas from '../components/PixelCanvas.jsx';
import { CHARS } from '../game/characters.js';
import { MAPS } from '../game/maps.js';
import { charSprite, itemSprite } from '../game/sprites.js';
import { getAudioSettings, setMuted, setVolume } from '../audio/audio.js';
import { isTouchFirst, koCount, formatMatchLength } from './screenUtils.js';

const TILE_OPTIONS = [64, 128, 256];
const TILE_LABELS = { 64: '낮음', 128: '보통', 256: '높음' };
const SKILL_OPTIONS = ['쉬움', '보통', '어려움'];
const KEY_ART = '/key-art.webp';
// 로딩 화면(index.html #boot)은 글꼴이 준비되면 걷는다. 대표 그림은 글꼴 뒤로 이만큼만 더 기다리고,
// 늦으면 판 위에서 서서히 나타난다(느린 망에서 설정 · 시작 버튼을 그림 때문에 막지 않는다)
const BOOT_ART_GRACE_MS = 250;
const BOOT_MAX_WAIT_MS = 2500;

// 아이템 범례 — 이름 · 한 줄 설명은 실제 효과(engine.pickUp)와 맞춘다
const ITEM_LEGEND = [
  { type: 'balloon', name: '물풍선', line: '풍선을 하나 더 놓아요' },
  { type: 'power', name: '물줄기', line: '물줄기가 한 칸 길어져요' },
  { type: 'speed', name: '롤러', line: '더 빨리 달려요' },
  { type: 'needle', name: '바늘', line: 'X로 내 풍선을 바로 터뜨려요' },
  { type: 'passBalloon', name: '풍선 통과', line: '물풍선을 지나가요' },
  { type: 'passBlock', name: '블록 통과', line: '상자를 지나가요' },
  { type: 'turtle', name: '거북이', line: '7초 동안 느려져요' }
];

function OptionRow({ label, options, value, format, onPick }) {
  const labelId = useId();
  return (
    <div className="option-row" role="group" aria-labelledby={labelId}>
      <div id={labelId} className="option-label">{label}</div>
      <div className="option-buttons">
        {options.map((op) => {
          const active = op === value;
          return (
            <button
              key={op}
              type="button"
              aria-pressed={active}
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

function ItemIcon({ type }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(itemSprite(type, 0), 0, 0);
  }, [type]);
  return <PixelCanvas ref={ref} width={32} height={32} className="item-icon" aria-hidden="true" />;
}

function pageLink() {
  return window.location.origin + window.location.pathname;
}

/** 손가락 기기 안내 — 막지 않고, 컴퓨터로 옮길 링크만 건넨다. */
function TouchNotice() {
  const [copied, setCopied] = useState(null); // null | 'ok' | 'fail'
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pageLink());
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };
  return (
    <section className="touch-notice" aria-labelledby="touch-notice-title">
      <p id="touch-notice-title" className="touch-notice-title">키보드가 있는 컴퓨터에서 해요</p>
      <p className="touch-notice-desc">방향키와 스페이스로 움직여요. 링크를 컴퓨터로 보내 두세요.</p>
      <button type="button" className="btn-cta touch-notice-btn" onClick={copy}>링크 복사</button>
      <p className="touch-notice-status" role="status">
        {copied === 'ok' && '링크를 복사했어요'}
        {copied === 'fail' && <>이 주소를 길게 눌러 복사해요: <span className="touch-notice-url">{pageLink()}</span></>}
      </p>
    </section>
  );
}

export default function TitleScreen({ settings, onSettingsChange, onStart, recordLine }) {
  const heroRef = useRef(null);
  const artRef = useRef(null);
  const [artReady, setArtReady] = useState(false);
  const [touchFirst] = useState(() => isTouchFirst(window));
  const mapCount = MAPS.filter((m) => m.layout !== 'random').length;
  const matchLen = formatMatchLength(settings.matchSeconds);
  const factLine = `캐릭터 ${koCount(CHARS.length)} · 맵 ${koCount(mapCount)} · 봇 ${koCount(settings.botCount)} · 한 판 ${matchLen}`;

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

  useEffect(() => {
    const img = artRef.current;
    const art = img && !img.complete ? img.decode().catch(() => {}) : Promise.resolve();
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const grace = fonts.then(() => wait(BOOT_ART_GRACE_MS));
    Promise.race([Promise.all([fonts, art]), grace, wait(BOOT_MAX_WAIT_MS)]).then(() => window.__wbaBoot?.done());
  }, []);

  return (
    <div className="screen-center title-screen">
      <div className="title-backdrop" aria-hidden="true" />
      <div className="title-stack" style={{ animation: 'popIn .35s ease both' }}>
        <div className="title-left">
          <div className="title-poster">
            <div className={artReady ? 'title-art-frame is-ready' : 'title-art-frame'}>
              <img
                ref={artRef}
                className="title-art"
                src={KEY_ART}
                alt=""
                width={1536}
                height={1024}
                decoding="async"
                onLoad={() => setArtReady(true)}
              />
            </div>
            <header className="title-head">
              <div className="title-kicker" aria-hidden="true">WATER BALLOON ARCADE</div>
              <h1 className="title-logo">물풍선 대작전</h1>
              <p className="title-hook">물줄기로 가두고, 마지막까지 살아남아요</p>
              <p className="title-facts">{factLine}</p>
              {recordLine && <p className="title-record">{recordLine}</p>}
            </header>
          </div>

          <PixelCanvas ref={heroRef} width={480} height={96} className="title-hero" aria-hidden="true" />

          {touchFirst && <TouchNotice />}
        </div>

        <div className="title-right">
          <div className="title-cards">
            <section className="info-card" aria-labelledby="card-controls">
              <h2 id="card-controls" className="info-title">조작</h2>
              <div className="info-line">방향키 · WASD 이동</div>
              <div className="info-line">스페이스 물풍선 놓기</div>
              <div className="info-line">X 내 풍선 바로 터뜨리기</div>
            </section>
            <section className="info-card" aria-labelledby="card-rules">
              <h2 id="card-rules" className="info-title">규칙</h2>
              <div className="info-line">물에 맞으면 풍선에 갇혀요</div>
              <div className="info-line">갇히고 4초가 지나면 탈락해요</div>
              <div className="info-line">갇힌 상대를 건드리면 바로 터져요</div>
              <div className="info-line">한 판은 {matchLen}이에요</div>
            </section>
            <section className="info-card info-card-items" aria-labelledby="card-items">
              <h2 id="card-items" className="info-title">아이템</h2>
              <ul className="item-legend">
                {ITEM_LEGEND.map((it) => (
                  <li key={it.type} className="item-legend-row">
                    <ItemIcon type={it.type} />
                    <span className="item-legend-name">{it.name}</span>
                    <span className="item-legend-line">{it.line}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="title-options">
            <OptionRow
              label="화질"
              options={TILE_OPTIONS}
              value={settings.tileSize}
              format={(v) => TILE_LABELS[v]}
              onPick={(tileSize) => onSettingsChange({ ...settings, tileSize })}
            />
            <OptionRow
              label="봇 실력"
              options={SKILL_OPTIONS}
              value={settings.botSkill}
              onPick={(botSkill) => onSettingsChange({ ...settings, botSkill })}
            />
            <OptionRow
              label="물줄기 범위 보기"
              options={['켬', '끔']}
              value={settings.showRange ? '켬' : '끔'}
              onPick={(v) => onSettingsChange({ ...settings, showRange: v === '켬' })}
            />
            <SoundRows />
          </div>

          <button type="button" className="btn-cta title-start" onClick={onStart}>한 판 하기</button>
        </div>
      </div>
    </div>
  );
}
