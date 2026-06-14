// ============================================================
// 语绘 (Voice Canvas) — 登录页（声纹主题）
// PR #12: 芝士番薯 — UI 打磨
// ============================================================

import { useState, useEffect, useRef } from 'react';

interface LoginPageProps {
  onEnter: (username: string) => void;
}

// ---- 声纹波形条数据 ----
const WAVE_BARS = [
  [4, 8, 12, 18, 24, 20, 14, 10, 6, 4, 8, 16, 22, 18, 10, 5, 3, 7, 13, 19, 24, 21, 15, 8],
  [6, 10, 16, 22, 28, 24, 16, 10, 5, 3, 7, 15, 24, 30, 26, 18, 10, 6, 4, 8, 14, 20, 26, 22],
  [3, 6, 10, 15, 22, 25, 20, 12, 5, 2, 5, 12, 20, 27, 28, 22, 14, 7, 3, 6, 11, 17, 24, 25],
];

export function LoginPage({ onEnter }: LoginPageProps) {
  const [name, setName] = useState('');
  const [animating, setAnimating] = useState(false);
  const [wavePhase, setWavePhase] = useState(0);

  // 声波跳动循环
  useEffect(() => {
    const timer = setInterval(() => setWavePhase(p => (p + 1) % WAVE_BARS.length), 200);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAnimating(true);
    setTimeout(() => onEnter(trimmed), 600);
  };

  const bars = WAVE_BARS[wavePhase];

  return (
    <div className={`login-page ${animating ? 'login-page--out' : ''}`}>

      {/* 声纹波形背景 */}
      <div className="login-waves">
        {/* 底部大波形 */}
        <svg className="login-wave-svg login-wave-svg--bottom" viewBox="0 0 1200 200" preserveAspectRatio="none">
          <path className="login-wave-path login-wave-path--1" d={generateWavePath(0.6, 0)} />
          <path className="login-wave-path login-wave-path--2" d={generateWavePath(0.8, 0.3)} />
          <path className="login-wave-path login-wave-path--3" d={generateWavePath(1.0, 0.6)} />
        </svg>
        {/* 顶部波形 */}
        <svg className="login-wave-svg login-wave-svg--top" viewBox="0 0 1200 200" preserveAspectRatio="none">
          <path className="login-wave-path login-wave-path--3" d={generateWavePath(0.4, 0.8)} />
          <path className="login-wave-path login-wave-path--2" d={generateWavePath(0.6, 0.5)} />
        </svg>
      </div>

      {/* 主内容 */}
      <div className="login-card">
        {/* 声纹标识区 */}
        <div className="login-brand">
          <div className="login-voice-icon">
            <div className="login-voice-ring login-voice-ring--1" />
            <div className="login-voice-ring login-voice-ring--2" />
            <div className="login-voice-ring login-voice-ring--3" />
            <span className="login-voice-emoji">🎤</span>
          </div>

          {/* 跳动声波条 */}
          <div className="login-wave-bars">
            {bars.map((h, i) => (
              <span
                key={i}
                className="login-wave-bar"
                style={{ height: `${h}px`, animationDelay: `${i * 0.06}s` }}
              />
            ))}
          </div>

          <h1 className="login-title">
            <span className="login-title-cn">语绘</span>
            <span className="login-title-en">Voice Canvas</span>
          </h1>
          <p className="login-desc">说出你的想法，让 AI 为你落笔</p>
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
              {/* 输入框声纹装饰线 */}
              <span className="login-input-line" />
            </div>
            <span className="login-hint">⌨ 按下 Enter 开始创作</span>
          </div>

          <button
            className="login-btn"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            <span className="login-btn-text">进入画室</span>
            <span className="login-btn-wave">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="login-btn-bar" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- 动态波形路径生成 ----
function generateWavePath(amplitude: number, phase: number): string {
  const points = 24;
  const segments: string[] = [];
  const segW = 1200 / points;

  for (let i = 0; i <= points; i++) {
    const x = i * segW;
    const y = 100 + Math.sin((i / points) * Math.PI * 4 + phase * Math.PI * 2) * 40 * amplitude;
    if (i === 0) segments.push(`M${x},${y}`);
    else segments.push(`L${x},${y}`);
  }

  // 底部闭合
  segments.push(`L1200,200 L0,200 Z`);
  return segments.join(' ');
}
