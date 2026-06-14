// ============================================================
// 语绘 (Voice Canvas) — 登录页（海浪调色盘主题）
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

      {/* 海浪背景 */}
      <div className="login-ocean">
        <svg className="login-wave login-wave--far" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path d="M0,224 C180,288 420,96 720,160 C1020,224 1260,288 1440,192 L1440,320 L0,320 Z" />
        </svg>
        <svg className="login-wave login-wave--mid" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path d="M0,256 C240,192 480,96 720,128 C960,160 1200,256 1440,224 L1440,320 L0,320 Z" />
        </svg>
        <svg className="login-wave login-wave--near" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path d="M0,288 C300,224 540,160 720,192 C900,224 1140,288 1440,256 L1440,320 L0,320 Z" />
        </svg>
      </div>

      {/* 装饰圆点 */}
      <div className="login-dots">
        <span className="login-dot login-dot--1" />
        <span className="login-dot login-dot--2" />
        <span className="login-dot login-dot--3" />
        <span className="login-dot login-dot--4" />
        <span className="login-dot login-dot--5" />
      </div>

      {/* 主卡片 */}
      <div className="login-card">
        <div className="login-brand">
          {/* 调色盘 — 彩色圆环 */}
          <div className="login-palette">
            <div className="login-palette-ring" />
            <div className="login-palette-colors">
              <span className="login-pcolor login-pcolor--red" />
              <span className="login-pcolor login-pcolor--orange" />
              <span className="login-pcolor login-pcolor--yellow" />
              <span className="login-pcolor login-pcolor--green" />
              <span className="login-pcolor login-pcolor--blue" />
              <span className="login-pcolor login-pcolor--purple" />
            </div>
            <span className="login-palette-center">🎨</span>
          </div>

          <h1 className="login-title">
            <span className="login-title-cn">语绘</span>
            <span className="login-title-en">Voice Canvas</span>
          </h1>
          <p className="login-desc">
            <span className="login-desc-icon">🎤</span>
            说出你的想法，让 AI 为你落笔
          </p>
        </div>

        {/* 输入区 */}
        <div className="login-form">
          <div className="login-input-group">
            <label className="login-label">你的名字</label>
            <div className="login-input-wrap">
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
              <span className="login-input-line">
                <span className="login-input-line-dot" />
                <span className="login-input-line-dot" />
                <span className="login-input-line-dot" />
                <span className="login-input-line-dot" />
                <span className="login-input-line-dot" />
              </span>
            </div>
            <span className="login-hint">⌨ 按下 Enter 开始创作</span>
          </div>

          <button
            className="login-btn"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            进入画室
            <span className="login-btn-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
