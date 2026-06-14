// ============================================================
// 语绘 (Voice Canvas) — 语音控制栏
// PR #12: 芝士番薯 — UI 打磨
// ============================================================

import type { AppStatus } from '../App';

interface VoiceBarProps {
  status: AppStatus;
  subtitle: string;
  objectCount: number;
  onMicClick: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
}

const STATUS_CONFIG: Record<AppStatus, { emoji: string; label: string }> = {
  idle:         { emoji: '🎤', label: '等待语音指令' },
  recording:    { emoji: '🔴', label: '正在聆听...' },
  transcribing: { emoji: '🟠', label: '识别中...' },
  generating:   { emoji: '🟣', label: 'AI 理解中...' },
  drawing:      { emoji: '✨', label: '绘制中...' },
  error:        { emoji: '⚠️', label: '出错了' },
};

export function VoiceBar({
  status,
  subtitle,
  objectCount,
  onMicClick,
  onUndo,
  onRedo,
  onClear,
}: VoiceBarProps) {
  const isProcessing = status === 'transcribing' || status === 'generating' || status === 'drawing';
  const isRecording = status === 'recording';

  return (
    <footer className="voice-bar">
      {/* ---- 状态指示 ---- */}
      <div className="vb-status">
        <span
          className={`vb-dot ${isRecording ? 'vb-dot--pulse' : ''} ${isProcessing ? 'vb-dot--spin' : ''}`}
          data-status={status}
        />
        <span className="vb-label">
          {STATUS_CONFIG[status].emoji} {STATUS_CONFIG[status].label}
        </span>
        <span className="vb-subtitle">{subtitle}</span>
        <span className="vb-count">对象: {objectCount}</span>
      </div>

      {/* ---- 操作按钮 ---- */}
      <div className="vb-actions">
        <button
          onClick={onMicClick}
          className={`vb-mic ${isRecording ? 'vb-mic--active' : ''} ${isProcessing ? 'vb-mic--disabled' : ''}`}
          disabled={isProcessing}
          aria-label={isRecording ? '停止录音' : '开始录音'}
        >
          {isRecording ? (
            <>
              <span className="vb-mic-ring" />
              🔴 停止
            </>
          ) : isProcessing ? (
            '⏳ 处理中'
          ) : (
            '🎤 开始'
          )}
        </button>

        <div className="vb-tools">
          <button onClick={onUndo} className="vb-tool" title="撤销">
            ↩
          </button>
          <button onClick={onRedo} className="vb-tool" title="重做">
            ↪
          </button>
          <button onClick={onClear} className="vb-tool vb-tool--danger" title="清空画布">
            🗑
          </button>
        </div>
      </div>
    </footer>
  );
}
