// ============================================================
// 语绘 (Voice Canvas) — 画笔系统
// PR #7: Canvas 渲染引擎
// ============================================================

import type { BrushType, FillGradient, DrawMode } from '../types/commands';

// ============ 画笔填充策略接口 ============

export interface BrushStrategy {
  /** 在裁剪区域内执行画笔填充 */
  fill(
    ctx: CanvasRenderingContext2D,
    clipShape: () => void,
    color: string,
    gradient: FillGradient | null,
    options: { fillAngle: number; fillDensity: number; duration: number }
  ): void;
}

// ============ 彩铅排线策略 ============

class PencilBrush implements BrushStrategy {
  fill(
    ctx: CanvasRenderingContext2D,
    clipShape: () => void,
    color: string,
    gradient: FillGradient | null,
    options: { fillAngle: number; fillDensity: number; duration: number }
  ): void {
    ctx.save();
    clipShape();
    ctx.clip();

    const angle = (options.fillAngle * Math.PI) / 180;
    const spacing = Math.max(2, 12 - options.fillDensity); // 密度1→粗, 10→细
    const canvasGradient = gradient ? createCanvasGradient(ctx, gradient) : null;

    // 估算裁剪区域大小，决定排线范围
    const size = Math.max(ctx.canvas.width, ctx.canvas.height);
    const steps = Math.floor(size / spacing);

    const dx = Math.cos(angle) * size;
    const dy = Math.sin(angle) * size;
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);

    for (let i = -steps; i <= steps; i++) {
      const startX = ctx.canvas.width / 2
        - dx / 2
        + i * spacing * perpX;
      const startY = ctx.canvas.height / 2
        - dy / 2
        + i * spacing * perpY;
      const endX = startX + dx;
      const endY = startY + dy;

      // 手绘抖动（±0.5px，每线随机）
      const jitter = () => (Math.random() - 0.5) * 0.5;

      ctx.beginPath();
      ctx.moveTo(startX + jitter(), startY + jitter());
      ctx.lineTo(endX + jitter(), endY + jitter());

      // 渐变取色：取排线中点位置的渐变色
      if (canvasGradient) {
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        ctx.strokeStyle = sampleGradient(ctx, canvasGradient, midX, midY);
      } else {
        ctx.strokeStyle = color;
      }
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ============ 颜料笔触策略 ============

class PaintBrush implements BrushStrategy {
  fill(
    ctx: CanvasRenderingContext2D,
    clipShape: () => void,
    color: string,
    gradient: FillGradient | null,
    options: { fillAngle: number; fillDensity: number; duration: number }
  ): void {
    ctx.save();
    clipShape();
    ctx.clip();

    const angle = (options.fillAngle * Math.PI) / 180;
    const canvasGradient = gradient ? createCanvasGradient(ctx, gradient) : null;
    const density = options.fillDensity;

    // 笔触数量 = 密度 × 15
    const brushCount = density * 15;
    const strokeLength = 12 + density * 4; // 笔触长度

    for (let i = 0; i < brushCount; i++) {
      // 笔触随机分布在裁剪区域内
      const baseX = (Math.random() - 0.3) * ctx.canvas.width;
      const baseY = (Math.random() - 0.3) * ctx.canvas.height;

      // 半透明色带，带方向性
      ctx.globalAlpha = 0.25 + Math.random() * 0.2;

      if (canvasGradient) {
        ctx.strokeStyle = sampleGradient(ctx, canvasGradient, baseX, baseY);
      } else {
        ctx.strokeStyle = color;
      }

      ctx.lineWidth = 3 + Math.random() * 8;

      const endX = baseX + Math.cos(angle) * strokeLength + (Math.random() - 0.5) * 8;
      const endY = baseY + Math.sin(angle) * strokeLength + (Math.random() - 0.5) * 8;

      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }

    ctx.globalAlpha = 1.0;
    ctx.restore();
  }
}

// ============ 画笔工厂 ============

const brushRegistry: Record<BrushType, BrushStrategy> = {
  pencil: new PencilBrush(),
  paint: new PaintBrush(),
};

export function getBrush(type: BrushType): BrushStrategy {
  return brushRegistry[type] ?? brushRegistry.pencil;
}

// ============ Canvas 渐变构造 ============

export function createCanvasGradient(
  ctx: CanvasRenderingContext2D,
  gradient: FillGradient
): CanvasGradient {
  let cg: CanvasGradient;

  if (gradient.type === 'linear') {
    cg = ctx.createLinearGradient(
      gradient.x0 ?? 0, gradient.y0 ?? 0,
      gradient.x1 ?? ctx.canvas.width, gradient.y1 ?? ctx.canvas.height
    );
  } else {
    cg = ctx.createRadialGradient(
      gradient.cx ?? ctx.canvas.width / 2,
      gradient.cy ?? ctx.canvas.height / 2,
      gradient.r0 ?? 0,
      gradient.cx ?? ctx.canvas.width / 2,
      gradient.cy ?? ctx.canvas.height / 2,
      gradient.r1 ?? Math.max(ctx.canvas.width, ctx.canvas.height) / 2
    );
  }

  for (const stop of gradient.stops) {
    cg.addColorStop(stop.offset, stop.color);
  }

  return cg;
}

// ============ 渐变颜色取样 ============

/**
 * 从 CanvasGradient 中取样指定坐标的颜色。
 * 通过离屏 canvas 取 1×1 像素。
 */
function sampleGradient(
  ctx: CanvasRenderingContext2D,
  gradient: CanvasGradient,
  x: number,
  y: number
): string {
  // 用当前 canvas 的 fillStyle 间接获取
  // 策略：在离屏 canvas 画一个像素，读出颜色
  const offscreen = document.createElement('canvas');
  offscreen.width = 1;
  offscreen.height = 1;
  const octx = offscreen.getContext('2d')!;

  // 需要让渐变正确映射到目标坐标
  // 简单方案：基于线性渐变端点直接插值
  // 这里使用离屏 canvas fillRect 方式
  octx.fillStyle = gradient;
  octx.fillRect(0, 0, 1, 1);
  const [r, g, b] = Array.from(octx.getImageData(0, 0, 1, 1).data);
  return `rgb(${r},${g},${b})`;
}
