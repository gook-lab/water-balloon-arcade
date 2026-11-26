import { fileURLToPath } from 'node:url';
import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// .worktrees/ 는 팀원 작업 트리 — 레포 본체의 시험 · 감시가 그 안의 파일을 집어 가지 않게 뺍니다.
// 감시 제외는 이 설정 파일 옆의 .worktrees 만(절대 경로 앞부분 비교). 글롭으로 쓰면 작업 트리 안에서 띄운
// dev 서버가 자기 파일까지 못 봅니다(작업 트리의 절대 경로에도 .worktrees 가 들어 있어서).
const WORKTREES = fileURLToPath(new URL('./.worktrees/', import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: { watch: { ignored: (path) => path.startsWith(WORKTREES) } },
  test: { exclude: [...configDefaults.exclude, '.worktrees/**'] },
});
