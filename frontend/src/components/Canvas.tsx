// ============================================================
// 语绘 (Voice Canvas) — Canvas 组件
// PR #7: React 组件 — 管理 canvas ref + Renderer 生命周期
// ============================================================

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { CanvasRenderer, type RendererConfig } from '../engine/renderer';
import type { DrawInstruction } from '../types/commands';

// ============ 向外暴露的 ref 接口 ============

export interface CanvasHandle {
  renderer: CanvasRenderer | null;
  execute: (instructions: DrawInstruction[]) => Promise<void>;
  pause: () => void;
  resume: () => void;
  abort: () => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  getSnapshot: () => string;
}

// ============ Props ============

interface CanvasProps {
  width?: number;
  height?: number;
  background?: string;
  onStatusChange?: (status: string) => void;
  onComplete?: () => void;
  onReady?: () => void;
}

// ============ 组件 ============

const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  { width = 800, height = 500, background = '#F5F5F5', onStatusChange, onComplete, onReady },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  // 初始化 Renderer
  useEffect(() => {
    if (!canvasRef.current) return;
    const config: RendererConfig = { canvas: canvasRef.current, width, height, background };
    const renderer = new CanvasRenderer(config);
    rendererRef.current = renderer;

    if (onStatusChange) {
      renderer.onStatusChange = (status) => onStatusChange(status);
    }
    if (onComplete) {
      renderer.onComplete = onComplete;
    }

    onReady?.();

    return () => {
      renderer.abort();
    };
  }, [width, height, background]);

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    renderer: rendererRef.current,
    execute: (instructions: DrawInstruction[]) =>
      rendererRef.current?.execute(instructions) ?? Promise.resolve(),
    pause: () => rendererRef.current?.pause(),
    resume: () => rendererRef.current?.resume(),
    abort: () => rendererRef.current?.abort(),
    clear: () => rendererRef.current?.clear(),
    undo: () => rendererRef.current?.undo(),
    redo: () => rendererRef.current?.redo(),
    getSnapshot: () => rendererRef.current?.getSnapshot() ?? '',
  }));

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        display: 'block',
        borderRadius: '8px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        background,
      }}
    />
  );
});

export default Canvas;
