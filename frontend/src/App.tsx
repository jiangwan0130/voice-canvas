// ============================================================
// 语绘 (Voice Canvas) — 主应用
// PR #10: 月栖白 — 前端全链路串联
// ============================================================

import { useState, useRef, useCallback } from 'react';
import Canvas from './components/Canvas';
import type { CanvasHandle } from './components/Canvas';
import { ObjectStore } from './engine/ObjectStore';
import { HistoryManager } from './engine/HistoryManager';
import { CommandExecutor } from './engine/CommandExecutor';
import { useVoice } from './hooks/useVoice';
import { speak } from './hooks/useSpeechFeedback';
import { transcribeAudio, generateInstructions } from './services/api';
import type { CanvasState, LastAction } from './types/commands';
import type { VoiceStatus } from './hooks/useVoice';
import './App.css';

type AppStatus = 'idle' | 'recording' | 'transcribing' | 'generating' | 'drawing' | 'error';

function App() {
  const [status, setStatus] = useState<AppStatus>('idle');
  const [subtitle, setSubtitle] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const canvasRef = useRef<CanvasHandle>(null);
  const storeRef = useRef(new ObjectStore());
  const historyMgrRef = useRef(new HistoryManager());
  const executorRef = useRef<CommandExecutor | null>(null);
  const lastActionRef = useRef<LastAction | null>(null);
  const [debugText, setDebugText] = useState('');
  const [objectCount, setObjectCount] = useState(0);

  // ---- 主流程 ----

  const processText = useCallback(async (text: string) => {
    if (!text.trim() || !canvasRef.current) return;
    setSubtitle(text);
    setStatus('generating');

    try {
      const store = storeRef.current;
      const canvasState: CanvasState = { width: store.width, height: store.height, grid: store.toGridState() };

      // 调用后端 /api/generate
      const resp = await generateInstructions(text, canvasState, lastActionRef.current);

      // 更新 last_action
      lastActionRef.current = { reply: resp.reply, instructions: resp.instructions };

      // 执行指令
      setStatus('drawing');
      if (executorRef.current) {
        await executorRef.current.execute(resp.instructions, text);
      } else {
        // fallback: 直接走 renderer
        await canvasRef.current.execute(resp.instructions);
      }

      // 历史记录
      setHistory(prev => [...prev.slice(-19), `${text} (${resp.source})`]);

      // TTS 反馈
      if (resp.reply) speak(resp.reply);
      setSubtitle(resp.reply || '完成');
      setObjectCount(storeRef.current.count);

    } catch (e) {
      console.error('[App] error:', e);
      setStatus('error');
      setSubtitle('出错了，请重试');
      return;
    }

    setStatus('idle');
  }, []);

  // ---- 语音处理 ----

  const handleVoiceResult = useCallback(async (result: { blob: Blob; webSpeechText: string }) => {
    setStatus('transcribing');

    // 优先走七牛云 ASR
    let text = '';
    try {
      const asrResp = await transcribeAudio(result.blob);
      if (asrResp.text) {
        text = asrResp.text;
      } else if (asrResp.fallback === 'webspeech') {
        // 降级 Web Speech API
        text = result.webSpeechText;
      }
    } catch {
      text = result.webSpeechText;
    }

    if (!text.trim()) {
      setStatus('error');
      setSubtitle('没有听清，请再说一遍');
      setTimeout(() => setStatus('idle'), 2000);
      return;
    }

    processText(text);
  }, [processText]);

  const voice = useVoice(handleVoiceResult, (s: VoiceStatus) => {
    if (s === 'error') setStatus('error');
  });

  // ---- Canvas 初始化 ----

  const handleCanvasReady = useCallback(() => {
    const renderer = canvasRef.current?.renderer;
    if (!renderer) return;
    const store = storeRef.current;
    const history = historyMgrRef.current;
    executorRef.current = new CommandExecutor(renderer, store, history);

    // Redirect renderer undo/clear to our store+history
    const origClear = renderer.clear.bind(renderer);
    renderer.clear = () => { store.clear(); history.clear(); origClear(); };
  }, []);

  // ---- 按钮操作 ----

  const handleMicClick = () => {
    if (status === 'idle' || status === 'error') {
      voice.start();
    } else if (status === 'recording') {
      voice.stop();
    }
  };

  const handleUndo = () => {
    if (executorRef.current?.undo()) {
      setObjectCount(storeRef.current.count);
      setSubtitle('已撤销');
    }
  };

  const handleRedo = () => {
    if (executorRef.current?.redo()) {
      setObjectCount(storeRef.current.count);
      setSubtitle('已重做');
    }
  };

  const handleClear = () => {
    storeRef.current.clear();
    historyMgrRef.current.clear();
    lastActionRef.current = null;
    setHistory([]);
    setObjectCount(0);
    setSubtitle('画布已清空');
  };

  const handleDebugSend = () => {
    if (debugText.trim()) { processText(debugText.trim()); setDebugText(''); }
  };

  // ---- 状态颜色 ----

  const statusColors: Record<AppStatus, string> = {
    idle: '#52c41a', recording: '#1677ff', transcribing: '#fa8c16',
    generating: '#722ed1', drawing: '#eb2f96', error: '#ff4d4f',
  };
  const statusLabels: Record<AppStatus, string> = {
    idle: '🟢 等待语音', recording: '🔵 录音中', transcribing: '🟠 识别中',
    generating: '🟣 AI 理解中', drawing: '🟣 绘制中', error: '🔴 错误',
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>🎨 语绘 Voice Canvas</h1>
      </header>

      <main className="app-main">
        <Canvas
          ref={canvasRef}
          width={1200}
          height={800}
          background="#FFFFFF"
          onStatusChange={() => {}}
          onComplete={() => setStatus('idle')}
          onReady={handleCanvasReady}
        />
      </main>

      <footer className="app-footer">
        <div className="status-row">
          <span className="status-dot" style={{ background: statusColors[status] }} />
          <span>{statusLabels[status]}</span>
          <span className="subtitle">{subtitle}</span>
          <span className="object-count">对象: {objectCount}</span>
        </div>

        <div className="action-row">
          <button onClick={handleMicClick} className={`mic-btn ${status === 'recording' ? 'active' : ''}`}>
            {status === 'recording' ? '🔴 停止' : '🎤 开始'}
          </button>
          <button onClick={handleUndo}>↩ 撤销</button>
          <button onClick={handleRedo}>↪ 重做</button>
          <button onClick={handleClear}>🗑 清空</button>
          <input
            type="text"
            value={debugText}
            onChange={e => setDebugText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleDebugSend()}
            placeholder="调试输入..."
            className="debug-input"
          />
          <button onClick={handleDebugSend}>发送</button>
        </div>

        <div className="history-row">
          {history.slice(-5).map((h, i) => <span key={i} className="history-item">{h}</span>)}
        </div>
      </footer>
    </div>
  );
}

export default App;
