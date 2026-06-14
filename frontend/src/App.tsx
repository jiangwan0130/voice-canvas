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
import { transcribeAudio, generateInstructions, visualVerify } from './services/api';
import type { CanvasState, ConversationTurn } from './types/commands';
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
  const conversationHistoryRef = useRef<ConversationTurn[]>([]);
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

      // 调用后端 /api/generate（传入历史，不含当前轮）
      const resp = await generateInstructions(text, canvasState, conversationHistoryRef.current);

      // 追加当前轮到历史（最多保留20轮）
      conversationHistoryRef.current = [
        ...conversationHistoryRef.current,
        { user_text: text, reply: resp.reply, instructions: resp.instructions, undone: false },
      ].slice(-20);

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

      // 视觉自验证 + 自动修复循环（最多 2 次修复）
      const MAX_FIX_RETRIES = 2;
      try {
        for (let retry = 0; retry <= MAX_FIX_RETRIES; retry++) {
          const snapshot = canvasRef.current?.getSnapshot();
          if (!snapshot) break;
          const base64 = snapshot.replace(/^data:image\/\w+;base64,/, '');
          setSubtitle(retry === 0 ? '🔍 正在检查画布...' : `🔍 第${retry}次复查...`);
          const vrf = await visualVerify(base64, text);

          if (vrf.ok && vrf.feedback === 'OK') {
            setSubtitle(retry === 0 ? '✅ 验证通过' : `✅ 第${retry}次修复后通过`);
            break; // 通过，结束循环
          }

          if (!vrf.feedback) break; // 无反馈，无法修复

          if (retry < MAX_FIX_RETRIES) {
            // 还没到上限，自动修复
            setSubtitle(`⚠️ 第${retry + 1}次修复中...`);
            const fixText = `修复画布上的问题：${vrf.feedback}`;
            setStatus('generating');
            const store2 = storeRef.current;
            const cs2: CanvasState = { width: store2.width, height: store2.height, grid: store2.toGridState() };
            const resp2 = await generateInstructions(fixText, cs2, conversationHistoryRef.current);
            conversationHistoryRef.current = [
              ...conversationHistoryRef.current,
              { user_text: fixText, reply: resp2.reply, instructions: resp2.instructions, undone: false },
            ].slice(-20);
            setStatus('drawing');
            if (executorRef.current) {
              await executorRef.current.execute(resp2.instructions, fixText);
            }
            if (resp2.reply) speak(resp2.reply);
            setObjectCount(storeRef.current.count);
            // 循环继续，下次迭代重新截图验证
          } else {
            // 到达上限，显示剩余问题
            setSubtitle(`⚠️ 修复${MAX_FIX_RETRIES}次后仍有问题: ${vrf.feedback}`);
          }
        }
      } catch {
        // 验证失败不影响主流程
      }

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
      // 标记最近一轮未撤销的轮次为已撤销
      const history = conversationHistoryRef.current;
      for (let i = history.length - 1; i >= 0; i--) {
        if (!history[i].undone && history[i].instructions.length > 0) {
          history[i] = { ...history[i], undone: true };
          break;
        }
      }
      setObjectCount(storeRef.current.count);
      setSubtitle('已撤销');
      setStatus('idle');
    }
  };

  const handleRedo = () => {
    canvasRef.current?.abort();
    if (executorRef.current?.redo()) {
      // 恢复最近一轮已撤销的轮次
      const history = conversationHistoryRef.current;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].undone) {
          history[i] = { ...history[i], undone: false };
          break;
        }
      }
      setObjectCount(storeRef.current.count);
      setSubtitle('已重做');
      setStatus('idle');
    }
  };

  const handleClear = () => {
    storeRef.current.clear();
    historyMgrRef.current.clear();
    canvasRef.current?.clear();
    conversationHistoryRef.current = [];
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
