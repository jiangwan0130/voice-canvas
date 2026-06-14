// ============================================================
// 语绘 (Voice Canvas) — 登录页
// PR #12: 芝士番薯 — UI 打磨
// ============================================================

import { useState } from 'react';

interface LoginPageProps {
  onEnter: (username: string) => void;
}

export function LoginPage({ onEnter }: LoginPageProps) {
  const [name, setName] = useState('');
  const [animating, setAnimating] = useState(false);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAnimating(true);
    setTimeout(() => onEnter(trimmed), 600);
  };

  return (
    <div className={`login-page ${animating ? 'login-page--out' : ''}`}>
      {/* 背景装饰 */}
      <div className="login-bg">
        <div className="login-orb login-orb--1" />
        <div className="login-orb login-orb--2" />
        <div className="login-orb login-orb--3" />
      </div>

      {/* 主内容 */}
      <div className="login-card">
        <div className="login-logo">
          <span className="login-icon">🎨</span>
          <h1 className="login-title">
            <span className="login-title-cn">语绘</span>
            <span className="login-title-en">Voice Canvas</span>
          </h1>
          <p className="login-desc">
            用声音创作你的第一幅画作
          </p>
        </div>

        <div className="login-form">
          <div className="login-input-group">
            <label className="login-label">你的名字</label>
            <input
              type="text"
              className="login-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="输入你的名字或昵称..."
              maxLength={16}
              autoFocus
            />
            <div className="login-hint">按下 Enter 进入画室</div>
          </div>

          <button
            className="login-btn"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            进入画室 ✨
          </button>
        </div>

        <div className="login-footer">
          <span>七牛云 × XEngineer 暑期实训营</span>
        </div>
      </div>
    </div>
  );
}
