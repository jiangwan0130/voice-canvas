// ============================================================
// 语绘 (Voice Canvas) — 主应用
// PR #10: 月栖白 — 前端全链路串联
// ============================================================

import { useState, useRef, useCallback } from 'react';
import Canvas from './components/Canvas';
import type { CanvasHandle } from './components/Canvas';
import { VoiceBar } from './components/VoiceBar';
import { CommandHistory } from './components/CommandHistory';
import { PaletteBar } from './components/PaletteBar';
import { LoginPage } from './components/LoginPage';
import { ObjectStore } from './engine/ObjectStore';
import { HistoryManager } from './engine/HistoryManager';
import { CommandExecutor } from './engine/CommandExecutor';
import { useVoice } from './hooks/useVoice';
import { speak } from './hooks/useSpeechFeedback';
import { transcribeAudio, generateInstructions } from './services/api';
import type { CanvasState, LastAction } from './types/commands';
import type { VoiceStatus } from './hooks/useVoice';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config';
import { ErrorBoundary } from './components/ErrorBoundary';
import './App.css';

export type AppStatus = 'idle' | 'recording' | 'transcribing' | 'generating' | 'drawing' | 'error';

type Page = 'login' | 'draw';

function App() {
  const [page, setPage] = useState<Page>('login');
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<AppStatus>('idle');
  const [subtitle, setSubtitle] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const canvasRef = useRef<CanvasHandle>(null);
  const storeRef = useRef(new ObjectStore(CANVAS_WIDTH, CANVAS_HEIGHT));
  const historyMgrRef = useRef(new HistoryManager());
  const executorRef = useRef<CommandExecutor | null>(null);
  const lastActionRef = useRef<LastAction | null>(null);
  const [debugText, setDebugText] = useState('');
  const [objectCount, setObjectCount] = useState(0);
  const isProcessingRef = useRef(false);

  // ---- 主流程 ----

  const processText = useCallback(async (text: string) => {
    if (!text.trim() || !canvasRef.current) return;
    // 防止并发调用
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setSubtitle(text);
    setStatus('generating');

    try {
      const store = storeRef.current;
      const canvasState: CanvasState = { width: store.width, height: store.height, grid: store.toGridState() };

      // 调用后端 /api/generate
      const resp = await generateInstructions(text, canvasState, lastActionRef.current);

      // 更新 last_action
      lastActionRef.current = { user_text: text, reply: resp.reply, instructions: resp.instructions };

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
    } finally {
      isProcessingRef.current = false;
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
    setStatus(s);
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
    canvasRef.current?.abort();
    if (executorRef.current?.undo()) {
      setObjectCount(storeRef.current.count);
      setSubtitle('已撤销');
      setStatus('idle');
    }
  };

  const handleRedo = () => {
    canvasRef.current?.abort();
    if (executorRef.current?.redo()) {
      setObjectCount(storeRef.current.count);
      setSubtitle('已重做');
      setStatus('idle');
    }
  };

  const handleClear = () => {
    storeRef.current.clear();
    historyMgrRef.current.clear();
    canvasRef.current?.clear();
    lastActionRef.current = null;
    setHistory([]);
    setObjectCount(0);
    setSubtitle('画布已清空');
  };

  const handleExport = () => {
    const dataUrl = canvasRef.current?.getSnapshot();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `语绘_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
    setSubtitle('图片已导出');
  };

  const handleDebugSend = () => {
    if (debugText.trim()) { processText(debugText.trim()); setDebugText(''); }
  };

  // ---- 登录页 ----
  if (page === 'login') {
    return <LoginPage onEnter={(name) => { setUsername(name); setPage('draw'); }} />;
  }

  // ---- 绘画页 ----
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-back" onClick={() => setPage('login')} title="返回登录">←</span>
          <h1>🎨 <span className="app-title-cn">语绘</span> <span className="app-title-en">Voice Canvas</span></h1>
        </div>
        <span className="app-user">{username}</span>
      </header>

      <PaletteBar />

      <VoiceBar
        status={status}
        subtitle={subtitle}
        objectCount={objectCount}
        onMicClick={handleMicClick}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onExport={handleExport}
      />

      <CommandHistory items={history} maxShow={5} />

      {/* 文本输入 — 临时替代语音 */}
      <div className="text-input-bar">
        <input
          type="text"
          value={debugText}
          onChange={e => setDebugText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleDebugSend()}
          placeholder="输入指令，例如：画一只猫、加个太阳..."
          className="text-input"
        />
        <button onClick={handleDebugSend} className="text-send">发送</button>
      </div>

      <main className="app-main">
        <ErrorBoundary>
          <Canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            background="#FFFFFF"
            onComplete={() => setStatus('idle')}
            onReady={handleCanvasReady}
          />
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
