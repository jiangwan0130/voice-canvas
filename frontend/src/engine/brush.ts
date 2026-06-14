// ============================================================
// 语绘 (Voice Canvas) — 画笔系统
// PR #7: Canvas 渲染引擎
// ============================================================

import type { BrushType, FillGradient } from '../types/commands';

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
    // 密度映射: 1=稀疏 10=极致密集 (spacing 从 8px → 0.6px)
    const spacing = Math.max(0.6, 8.5 - options.fillDensity * 0.8);
    const canvasGradient = gradient ? createCanvasGradient(ctx, gradient) : null;

    const size = Math.max(ctx.canvas.width, ctx.canvas.height);
    const steps = Math.floor(size / spacing);

    const dx = Math.cos(angle) * size;
    const dy = Math.sin(angle) * size;
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpY = Math.sin(angle + Math.PI / 2);

    // 主线排（角度 = fillAngle）
    this._drawHatchLines(ctx, steps, spacing, dx, dy, perpX, perpY, color, canvasGradient, 0.7);

    // 交叉排线（角度偏移 25°, 线更细更稀, 模拟真实彩铅交叉填色）
    const angle2 = (options.fillAngle + 25) * Math.PI / 180;
    const dx2 = Math.cos(angle2) * size;
    const dy2 = Math.sin(angle2) * size;
    const perpX2 = Math.cos(angle2 + Math.PI / 2);
    const perpY2 = Math.sin(angle2 + Math.PI / 2);
    const spacing2 = spacing * 1.8;  // 交叉层间距稍宽
    const steps2 = Math.floor(size / spacing2);
    this._drawHatchLines(ctx, steps2, spacing2, dx2, dy2, perpX2, perpY2, color, canvasGradient, 0.5, 0.35);

    ctx.restore();
  }

  private _drawHatchLines(
    ctx: CanvasRenderingContext2D,
    steps: number,
    spacing: number,
    dx: number, dy: number,
    perpX: number, perpY: number,
    color: string,
    canvasGradient: CanvasGradient | null,
    lineWidth: number,
    alpha: number = 0.8
  ): void {
    ctx.globalAlpha = alpha;
    for (let i = -steps; i <= steps; i++) {
      const startX = ctx.canvas.width / 2 - dx / 2 + i * spacing * perpX;
      const startY = ctx.canvas.height / 2 - dy / 2 + i * spacing * perpY;
      const endX = startX + dx;
      const endY = startY + dy;

      // 手绘微抖（±0.3px, 模拟彩铅线条的自然不规则）
      const jx1 = (Math.random() - 0.5) * 0.6;
      const jy1 = (Math.random() - 0.5) * 0.6;
      const jx2 = (Math.random() - 0.5) * 0.6;
      const jy2 = (Math.random() - 0.5) * 0.6;

      ctx.beginPath();
      ctx.moveTo(startX + jx1, startY + jy1);
      ctx.lineTo(endX + jx2, endY + jy2);

      if (canvasGradient) {
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        ctx.strokeStyle = sampleGradient(ctx, canvasGradient, midX, midY);
      } else {
        ctx.strokeStyle = color;
      }
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
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
      // 笔触随机分布在裁剪区域内（钳位到非负坐标，避免渐变取样越界）
      const baseX = Math.max(0, (Math.random() - 0.3) * ctx.canvas.width);
      const baseY = Math.max(0, (Math.random() - 0.3) * ctx.canvas.height);

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
 * 通过与原 canvas 同尺寸的离屏 canvas 采样，确保渐变坐标系正确映射。
 * 内部缓存离屏 canvas——同一 fill 调用内第一次创建，后续复用。
 */
let _gradientCache: { canvas: HTMLCanvasElement; gradient: CanvasGradient; w: number; h: number } | null = null;

function sampleGradient(
  ctx: CanvasRenderingContext2D,
  gradient: CanvasGradient,
  x: number,
  y: number
): string {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // 缓存命中：同尺寸 + 同渐变引用
  if (!_gradientCache || _gradientCache.gradient !== gradient || _gradientCache.w !== w || _gradientCache.h !== h) {
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const octx = offscreen.getContext('2d')!;
    octx.fillStyle = gradient;
    octx.fillRect(0, 0, w, h);
    _gradientCache = { canvas: offscreen, gradient, w, h };
  }

  const octx = _gradientCache.canvas.getContext('2d')!;
  const pixel = octx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  return `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
}
