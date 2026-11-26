import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// .worktrees/ 는 팀원 작업 트리 — 레포 본체의 시험 · 감시가 그 안의 파일을 집어 가지 않게 뺍니다
export default defineConfig({
  plugins: [react()],
  server: { watch: { ignored: ['**/.worktrees/**'] } },
  test: { exclude: [...configDefaults.exclude, '**/.worktrees/**'] },
});
