import React from 'react';

const COPY = {
  win: { title: '승리!', color: '#ffd23f', desc: '모든 상대를 물풍선에 가뒀습니다.' },
  lose: { title: '패배', color: '#ff6f91', desc: '물에 맞아 탈락했습니다.' },
  draw: { title: '무승부', color: '#7fd8ff', desc: '시간 초과 — 살아남은 사람이 여럿입니다.' }
};

export default function ResultOverlay({ result, onRestart, onChangeMap, onChangeChar }) {
  const c = COPY[result] || COPY.draw;
  return (
    <div style={{ position: 'absolute', inset: 10, background: 'rgba(14,18,38,.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, animation: 'bnbPop .3s ease both' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 62, color: c.color, textShadow: '0 5px 0 rgba(0,0,0,.35)' }}>{c.title}</div>
      <div style={{ fontSize: 15, color: '#cdd6f7' }}>{c.desc}</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        <button className="btn-cta" style={{ fontSize: 21, padding: '12px 34px', boxShadow: '0 7px 0 #c47c00' }} onClick={onRestart}>다시 하기</button>
        <button className="btn-ghost" style={{ fontSize: 21, padding: '12px 28px' }} onClick={onChangeMap}>맵 변경</button>
        <button className="btn-ghost" style={{ fontSize: 21, padding: '12px 28px' }} onClick={onChangeChar}>캐릭터</button>
      </div>
    </div>
  );
}
