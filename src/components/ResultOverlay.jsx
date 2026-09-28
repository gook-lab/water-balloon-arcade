import React from 'react';

const COPY = {
  win: { title: '승리!', color: '#ffd23f', desc: '모든 상대를 물풍선에 가뒀어요.' },
  lose: { title: '패배', color: '#ff6f91', desc: '물에 맞아 탈락했어요.' },
  draw: { title: '무승부', color: '#7fd8ff', desc: '시간이 다 됐어요 — 여러 명이 살아남았어요.' }
};

export default function ResultOverlay({ result, botSkill, onRestart, onChangeMap, onChangeChar }) {
  const c = COPY[result] || COPY.draw;
  const skillLabel = botSkill ? `이번 판은 ${botSkill} 봇이랑 했어요` : null;
  return (
    <div style={{ position: 'absolute', inset: 10, background: 'rgba(14,18,38,.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, animation: 'bnbPop .3s ease both' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 62, color: c.color, textShadow: '0 5px 0 rgba(0,0,0,.35)' }}>{c.title}</div>
      <div style={{ fontSize: 15, color: '#cdd6f7' }}>{c.desc}</div>
      {skillLabel && (
        <div style={{ fontSize: 13, color: '#a9b3d0', marginTop: 8 }}>{skillLabel}</div>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        <button className="btn-cta" style={{ fontSize: 21, padding: '12px 34px', boxShadow: '0 7px 0 #c47c00' }} onClick={onRestart}>다시 하기</button>
        <button className="btn-ghost" style={{ fontSize: 21, padding: '12px 28px' }} onClick={onChangeMap}>맵 변경</button>
        <button className="btn-ghost" style={{ fontSize: 21, padding: '12px 28px' }} onClick={onChangeChar}>캐릭터</button>
      </div>
    </div>
  );
}
