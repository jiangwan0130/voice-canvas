import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// PR #5: 最小入口 — 仅验证类型系统可用
// 完整 App 在 PR #10 前端串联中接入

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div>语绘 Voice Canvas — 启动中...</div>
  </StrictMode>,
);
