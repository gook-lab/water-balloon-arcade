// 축소 모션 선호 — 새 연출(튀어나오는 애니메이션)은 이 값이 true 면 끈다.
export function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export const popIn = (reduced, dur = '.3s') => (reduced ? undefined : `popIn ${dur} ease both`);
