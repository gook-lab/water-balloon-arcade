import { useEffect, useRef, useState } from 'react';
import { formatDuration, shareText, shareUrl } from '../records.js';
import { popIn, prefersReducedMotion } from './motion.js';

const COPY = {
  win: { title: '승리!', color: '#ffd23f', desc: '모든 상대를 물풍선에 가뒀어요.' },
  lose: { title: '아쉬워요', color: '#ff6f91', desc: '물에 맞아 탈락했어요. 한 판 더 해 볼까요?' },
  draw: { title: '무승부', color: '#7fd8ff', desc: '시간이 다 됐어요. 끝까지 버텼어요!' }
};

function Stat({ label, value, isNew }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 104, padding: '8px 12px', background: 'rgba(0,0,0,.32)', border: '2px solid var(--outline)', borderRadius: 4 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: '#fff' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#cdd6f7' }}>{label}</div>
      {isNew && <div style={{ fontSize: 12, color: '#ffd23f', fontWeight: 700 }}>새 기록이에요!</div>}
    </div>
  );
}

export default function ResultOverlay({ result, report, botSkill, onRestart, onChangeMap, onChangeChar }) {
  const c = COPY[result] || COPY.draw;
  const difficulty = report?.difficulty || botSkill;
  const skillLabel = difficulty ? `이번 판은 ${difficulty} 봇이랑 했어요` : null;
  const firstRef = useRef(null);
  const copyRef = useRef(null);
  const [copy, setCopy] = useState(null); // null | { ok: true } | { ok: false, text }

  // 결과 화면이 뜨면 첫 버튼으로 포커스(QA S5) — Space · Enter 로 바로 「다시 하기」
  useEffect(() => { firstRef.current?.focus(); }, []);
  useEffect(() => { if (copy && !copy.ok) copyRef.current?.select(); }, [copy]);

  const nb = report?.newBest || {};
  const summary = report
    ? [`${formatDuration(report.survivalMs)} 버텼어요`, report.trapped > 0 ? `봇 ${report.trapped}명을 가뒀어요` : null].filter(Boolean).join(' · ')
    : null;
  const streak = result === 'win' && report?.record?.streak >= 2 ? `${difficulty}에서 ${report.record.streak}연승 중이에요` : null;
  const f = report?.final;

  const onCopy = async () => {
    const text = shareText({ difficulty, result, survivalMs: report?.survivalMs, trapped: report?.trapped }, shareUrl());
    try {
      await navigator.clipboard.writeText(text);
      setCopy({ ok: true });
    } catch {
      setCopy({ ok: false, text }); // 클립보드가 막힘(권한 · http) — 글을 골라 두고 직접 복사하게
    }
  };

  return (
    <div className="result-overlay" role="dialog" aria-modal="true" aria-labelledby="result-title" style={{ position: 'absolute', inset: 10, background: 'rgba(14,18,38,.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'safe center', gap: 12, padding: 12, overflowY: 'auto', animation: popIn(prefersReducedMotion()) }}>
      <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
        <div id="result-title" style={{ fontFamily: 'var(--font-display)', fontSize: 62, color: c.color, textShadow: '0 5px 0 rgba(0,0,0,.35)' }}>{c.title}</div>
        <div style={{ fontSize: 15, color: '#cdd6f7' }}>{c.desc}</div>
        {summary && <div style={{ fontSize: 15, color: '#fff' }}>{summary}</div>}
      </div>
      {report && (
        <div className="result-stats" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Stat label="버틴 시간" value={formatDuration(report.survivalMs)} isNew={nb.survival} />
          <Stat label="가둔 상대" value={`${report.trapped}명`} isNew={nb.trapped} />
          <Stat label="터뜨린 상대" value={`${report.popped}명`} />
          <Stat label="먹은 아이템" value={`${report.items}개`} />
        </div>
      )}
      {streak && <div style={{ fontSize: 14, color: '#ffd23f' }}>{streak}{nb.streak ? ' · 새 기록이에요!' : ''}</div>}
      {f && <div className="result-final" style={{ fontSize: 12, color: '#a9b3d0' }}>끝날 때 풍선 {f.maxBalloons} · 물줄기 {f.power} · 속도 {f.speed} · 바늘 {f.pins}</div>}
      {skillLabel && <div className="result-skill" style={{ fontSize: 13, color: '#a9b3d0' }}>{skillLabel}</div>}
      <div className="result-actions" style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button ref={firstRef} type="button" className="btn-cta" style={{ fontSize: 21, padding: '12px 34px', boxShadow: '0 7px 0 #c47c00' }} onClick={onRestart}>다시 하기</button>
        <button type="button" className="btn-ghost" style={{ fontSize: 21, padding: '12px 24px' }} onClick={onChangeMap}>맵 바꾸기</button>
        <button type="button" className="btn-ghost" style={{ fontSize: 21, padding: '12px 24px' }} onClick={onChangeChar}>캐릭터 바꾸기</button>
      </div>
      {report && (
        <div className="result-share" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <button type="button" className="btn-ghost" style={{ fontSize: 16, padding: '8px 20px' }} onClick={onCopy}>결과 복사</button>
          <div aria-live="polite" style={{ fontSize: 13, color: '#cdd6f7', minHeight: 16 }}>
            {copy?.ok && '복사했어요. 친구에게 붙여 넣어 보세요'}
            {copy && !copy.ok && '복사가 막혀 있어요. 글을 골라 두었으니 직접 복사해 주세요'}
          </div>
          {copy && !copy.ok && (
            <textarea
              ref={copyRef}
              readOnly
              aria-label="공유할 결과 글"
              value={copy.text}
              rows={2}
              style={{ width: 'min(520px, 90%)', fontSize: 13, background: '#0e1226', color: '#fff', border: '2px solid var(--outline)', borderRadius: 4, padding: 6, resize: 'none' }}
            />
          )}
        </div>
      )}
    </div>
  );
}
