// ============================================================
// 语绘 (Voice Canvas) — Canvas 渲染引擎
// PR #7: 核心渲染器 — 逐笔动画 + 画笔系统 + 渐变填充
// ============================================================

import type {
  DrawInstruction,
  DrawObject,
  DrawMode,
  BrushType,
  FillGradient,
} from '../types/commands';
import { getBrush, createCanvasGradient } from './brush';

// ============ 渲染器配置 ============

export interface RendererConfig {
  canvas: HTMLCanvasElement;
  width?: number;
  height?: number;
  background?: string;
}

// ============ 渲染器状态 ============

type RendererStatus = 'idle' | 'running' | 'paused' | 'error';

// ============ 主类 ============

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private background: string;
  private queue: DrawInstruction[] = [];
  private status: RendererStatus = 'idle';
  private abortController: AbortController | null = null;

  // 当前画笔状态
  private currentColor = '#000000';
  private currentWidth = 2;
  private currentBrush: BrushType = 'pencil';
  private currentFillAngle = 45;
  private currentFillDensity = 5;

  // 回调
  onStatusChange?: (status: RendererStatus) => void;
  onInstructionStart?: (inst: DrawInstruction, index: number) => void;
  onInstructionEnd?: (inst: DrawInstruction, index: number) => void;
  onComplete?: () => void;

  constructor(config: RendererConfig) {
    this.canvas = config.canvas;
    this.canvas.width = config.width ?? 900;
    this.canvas.height = config.height ?? 550;
    this.background = config.background ?? '#F5F5F5';
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.fillStyle = this.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // ============ 公开 API ============

  /** 执行指令序列（主入口） */
  async execute(instructions: DrawInstruction[]): Promise<void> {
    this.abortController = new AbortController();
    this.queue = [...instructions];
    this.setStatus('running');

    try {
      for (let i = 0; i < this.queue.length; i++) {
        if (this.abortController.signal.aborted) break;

        // 暂停轮询
        while (this.status === 'paused') {
          await this.wait(100);
        }

        const inst = this.queue[i];
        this.onInstructionStart?.(inst, i);
        await this.executeOne(inst);
        this.onInstructionEnd?.(inst, i);
      }
    } catch (err) {
      this.setStatus('error');
      console.error('[Renderer] 执行错误:', err);
      throw err;
    }

    if (!this.abortController.signal.aborted) {
      this.setStatus('idle');
      this.onComplete?.();
    }
  }

  /** 暂停 */
  pause(): void {
    if (this.status === 'running') this.setStatus('paused');
  }

  /** 继续 */
  resume(): void {
    if (this.status === 'paused') this.setStatus('running');
  }

  /** 中止 */
  abort(): void {
    this.abortController?.abort();
    this.setStatus('idle');
  }

  /** 清空画布（历史管理由 HistoryManager 负责） */
  clear(): void {
    this.ctx.fillStyle = this.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** 获取当前状态 */
  getStatus(): RendererStatus {
    return this.status;
  }

  /** 获取画布快照 (DataURL) */
  getSnapshot(): string {
    return this.canvas.toDataURL('image/png');
  }

  // ============ 单条指令执行 ============

  private async executeOne(inst: DrawInstruction): Promise<void> {
    switch (inst.action) {
      // 绘图指令
      case 'circle':   return this.drawCircle(inst);
      case 'rect':     return this.drawRect(inst);
      case 'line':     return this.drawLine(inst);
      case 'curve':    return this.drawCurve(inst);
      case 'polygon':  return this.drawPolygon(inst);
      case 'ellipse':  return this.drawEllipse(inst);
      case 'arc':      return this.drawArc(inst);
      case 'text':     return this.drawText(inst);

      // 控制指令（即时执行）
      case 'setColor':
        this.currentColor = (inst.value as string) ?? '#000000';
        break;
      case 'setWidth':
        if (inst.delta !== undefined) {
          this.currentWidth = Math.max(1, this.currentWidth + (inst.delta as number));
        } else {
          this.currentWidth = (inst.value as number) ?? 2;
        }
        break;
      case 'setBrush':
        this.currentBrush = (inst.type as BrushType) ?? 'pencil';
        this.currentFillAngle = (inst.fillAngle as number) ?? 45;
        this.currentFillDensity = (inst.fillDensity as number) ?? 5;
        break;
      case 'clear':
        this.clear();
        break;
      case 'undo':
      case 'redo':
        // undo/redo 由 CommandExecutor + HistoryManager 统一管理，Renderer 不处理
        // 如果走到了这里（如 fallback 路径），记录警告
        console.warn(`[Renderer] ${inst.action} 指令应在 CommandExecutor 层处理，已忽略`);
        break;
      case 'wait':
        await this.wait((inst.duration as number) ?? 300);
        break;

      case 'pause':
        this.pause();
        break;
      case 'resume':
        this.resume();
        break;

      // 对象编辑指令（PR #8 实现，此处理解但暂不执行）
      case 'update_object':
      case 'move_object':
      case 'delete_object':
        console.warn(`[Renderer] 对象编辑指令暂未实现: ${inst.action}`);
        break;

      default:
        console.warn(`[Renderer] 未知指令: ${inst.action}`);
    }
  }

  // ============ 逐笔动画核心 ============

  /**
   * 动画执行器 — 将绘制动作按 duration 分段展示
   * 70% 时间为绘制生长，30% 为静置
   */
  private async animateStroke(
    drawFn: (progress: number) => void,
    duration: number
  ): Promise<void> {
    const drawTime = duration * 0.7;
    const restTime = duration * 0.3;
    const startTime = performance.now();

    return new Promise((resolve) => {
      const frame = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / drawTime, 1.0);

        drawFn(progress);

        if (progress < 1.0) {
          requestAnimationFrame(frame);
        } else {
          setTimeout(resolve, restTime);
        }
      };
      requestAnimationFrame(frame);
    });
  }

  // ============ 具体图形绘制 ============

  private async drawCircle(inst: DrawInstruction): Promise<void> {
    const cx = (inst.cx as number) ?? 0;
    const cy = (inst.cy as number) ?? 0;
    const r = (inst.r as number) ?? 10;
    const mode = (inst.mode as DrawMode) ?? 'both';
    const duration = (inst.duration as number) ?? 500;

    if (mode === 'fill') {
      this.drawFill(inst, () => this.clipCircle(cx, cy, r));
      return;
    }

    // mode='both': 先填充（底层），再描边动画（上层）
    if (mode === 'both') {
      this.drawFill(inst, () => this.clipCircle(cx, cy, r));
    }

    const stroke = (inst.stroke as string) ?? this.currentColor;
    const sw = (inst.strokeWidth as number) ?? this.currentWidth;

    // stroke:"none" 或 strokeWidth:0 → 跳过描边（多圆叠加时内部轮廓不可见）
    if (stroke === 'none' || sw === 0) return;

    await this.animateStroke((progress) => {
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = sw;
      this.ctx.stroke();
    }, duration);
  }

  private async drawRect(inst: DrawInstruction): Promise<void> {
    const x = (inst.x as number) ?? 0;
    const y = (inst.y as number) ?? 0;
    const w = (inst.w as number) ?? 50;
    const h = (inst.h as number) ?? 50;
    const mode = (inst.mode as DrawMode) ?? 'both';
    const duration = (inst.duration as number) ?? 400;

    if (mode === 'fill') {
      this.drawFill(inst, () => this.clipRect(x, y, w, h));
      return;
    }

    // mode='both': 先填充（底层），再描边动画（上层）
    if (mode === 'both') {
      this.drawFill(inst, () => this.clipRect(x, y, w, h));
    }

    const stroke = inst.stroke as string ?? this.currentColor;
    const sw = (inst.strokeWidth as number) ?? this.currentWidth;

    if (stroke === 'none' || sw === 0) return;

    // 矩形逐段生长：周长比例
    const perimeter = 2 * (w + h);
    const segments = [
      { pct: w / perimeter,      draw: (p: number) => { this.ctx.rect(x, y, w * p, 0); } },
      { pct: h / perimeter,      draw: (p: number) => { this.ctx.rect(x + w, y, 0, h * p); } },
      { pct: w / perimeter,      draw: (p: number) => { this.ctx.rect(x + w, y + h, -w * p, 0); } },
      { pct: h / perimeter,      draw: (p: number) => { this.ctx.rect(x, y + h, 0, -h * p); } },
    ];

    await this.animateStroke((progress) => {
      const total = progress;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      let accum = 0;
      for (const seg of segments) {
        const segProgress = Math.max(0, Math.min(1, (total - accum) / seg.pct));
        seg.draw(segProgress);
        accum += seg.pct;
      }
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = sw;
      this.ctx.stroke();
    }, duration);
  }

  private async drawLine(inst: DrawInstruction): Promise<void> {
    const x1 = (inst.x1 as number) ?? 0;
    const y1 = (inst.y1 as number) ?? 0;
    const x2 = (inst.x2 as number) ?? 100;
    const y2 = (inst.y2 as number) ?? 100;
    const mode = (inst.mode as DrawMode) ?? 'stroke';
    const duration = (inst.duration as number) ?? 300;

    // 线段无面积，纯填充无意义，跳过
    if (mode === 'fill') {
      console.warn('[Renderer] drawLine 不支持 mode:"fill"，已忽略');
      return;
    }

    const stroke = inst.stroke as string ?? this.currentColor;
    const sw = (inst.strokeWidth as number) ?? this.currentWidth;

    await this.animateStroke((progress) => {
      const cx = x1 + (x2 - x1) * progress;
      const cy = y1 + (y2 - y1) * progress;
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(cx, cy);
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = sw;
      this.ctx.stroke();
    }, duration);
  }

  private async drawCurve(inst: DrawInstruction): Promise<void> {
    const points = inst.points as Array<[number, number]> ?? [];
    if (points.length < 2) return;
    const mode = (inst.mode as DrawMode) ?? 'stroke';
    const duration = (inst.duration as number) ?? 400;

    // 曲线（折线）无封闭面积定义，纯填充无意义，跳过
    if (mode === 'fill') {
      console.warn('[Renderer] drawCurve 不支持 mode:"fill"，已忽略');
      return;
    }

    const stroke = inst.stroke as string ?? this.currentColor;
    const sw = (inst.strokeWidth as number) ?? this.currentWidth;

    await this.animateStroke((progress) => {
      const maxIdx = Math.floor(1 + (points.length - 1) * progress);
      this.ctx.beginPath();
      this.ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < maxIdx; i++) {
        this.ctx.lineTo(points[i][0], points[i][1]);
      }
      // 最后一个点部分插值
      if (maxIdx < points.length) {
        const frac = (points.length - 1) * progress - (maxIdx - 1);
        const lastX = points[maxIdx - 1][0] + (points[maxIdx][0] - points[maxIdx - 1][0]) * frac;
        const lastY = points[maxIdx - 1][1] + (points[maxIdx][1] - points[maxIdx - 1][1]) * frac;
        this.ctx.lineTo(lastX, lastY);
      }
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = sw;
      this.ctx.stroke();
    }, duration);
  }

  private async drawPolygon(inst: DrawInstruction): Promise<void> {
    const rawPoints = inst.points as Array<[number, number]> | undefined;
    if (!rawPoints || !Array.isArray(rawPoints) || rawPoints.length < 3) return;
    const points = rawPoints.filter(p => Array.isArray(p) && p.length >= 2 && isFinite(p[0]) && isFinite(p[1]));
    if (points.length < 3) return;
    const mode = (inst.mode as DrawMode) ?? 'both';
    const duration = (inst.duration as number) ?? 500;

    if (mode === 'fill') {
      this.drawFill(inst, () => this.clipPolygon(points));
      return;
    }

    // mode='both': 先填充（底层），再描边动画（上层）
    if (mode === 'both') {
      this.drawFill(inst, () => this.clipPolygon(points));
    }

    const stroke = inst.stroke as string ?? this.currentColor;
    const sw = (inst.strokeWidth as number) ?? this.currentWidth;
    if (stroke === 'none' || sw === 0) return;

    await this.animateStroke((progress) => {
      const totalSegments = points.length;
      // 使用连续浮点进度，确保闭合边随动画渐进出现（而非仅在 1.0 跳变）
      const rawIdx = totalSegments * progress;
      const idx = Math.min(totalSegments, Math.ceil(rawIdx));
      this.ctx.beginPath();
      this.ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < idx; i++) {
        this.ctx.lineTo(points[i][0], points[i][1]);
      }
      // 当前边的部分插值
      if (idx < totalSegments) {
        const prev = idx > 0 ? idx - 1 : totalSegments - 1;
        const frac = rawIdx - (idx > 0 ? idx - 1 : -1);
        const px = points[prev][0] + (points[idx][0] - points[prev][0]) * frac;
        const py = points[prev][1] + (points[idx][1] - points[prev][1]) * frac;
        this.ctx.lineTo(px, py);
      } else {
        this.ctx.closePath();
      }
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = sw;
      this.ctx.stroke();
    }, duration);
  }

  private async drawEllipse(inst: DrawInstruction): Promise<void> {
    const cx = (inst.cx as number) ?? 0;
    const cy = (inst.cy as number) ?? 0;
    const rx = (inst.rx as number) ?? 30;
    const ry = (inst.ry as number) ?? 20;
    const mode = (inst.mode as DrawMode) ?? 'both';
    const duration = (inst.duration as number) ?? 450;

    if (mode === 'fill') {
      this.drawFill(inst, () => this.clipEllipse(cx, cy, rx, ry));
      return;
    }

    // mode='both': 先填充（底层），再描边动画（上层）
    if (mode === 'both') {
      this.drawFill(inst, () => this.clipEllipse(cx, cy, rx, ry));
    }

    const stroke = inst.stroke as string ?? this.currentColor;
    const sw = (inst.strokeWidth as number) ?? this.currentWidth;
    if (stroke === 'none' || sw === 0) return;

    await this.animateStroke((progress) => {
      this.ctx.beginPath();
      this.ctx.ellipse(cx, cy, rx, ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = sw;
      this.ctx.stroke();
    }, duration);
  }

  private async drawArc(inst: DrawInstruction): Promise<void> {
    const cx = (inst.cx as number) ?? 0;
    const cy = (inst.cy as number) ?? 0;
    const r = (inst.r as number) ?? 30;
    const startAngle = (inst.startAngle as number) ?? 0;
    const endAngle = (inst.endAngle as number) ?? Math.PI;
    const mode = (inst.mode as DrawMode) ?? 'both';
    const duration = (inst.duration as number) ?? 400;

    if (mode === 'fill') {
      this.drawFill(inst, () => this.clipArc(cx, cy, r, startAngle, endAngle));
      return;
    }

    // mode='both': 先填充（底层），再描边动画（上层）
    if (mode === 'both') {
      this.drawFill(inst, () => this.clipArc(cx, cy, r, startAngle, endAngle));
    }

    const stroke = inst.stroke as string ?? this.currentColor;
    const sw = (inst.strokeWidth as number) ?? this.currentWidth;
    if (stroke === 'none' || sw === 0) return;

    await this.animateStroke((progress) => {
      const currentAngle = startAngle + (endAngle - startAngle) * progress;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, startAngle, currentAngle);
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = sw;
      this.ctx.stroke();
    }, duration);
  }

  private async drawText(inst: DrawInstruction): Promise<void> {
    const x = (inst.x as number) ?? 0;
    const y = (inst.y as number) ?? 0;
    const content = (inst.content as string) ?? '';
    const fontSize = (inst.fontSize as number) ?? 20;
    const fill = inst.fill as string ?? this.currentColor;

    this.ctx.font = `${fontSize}px sans-serif`;
    this.ctx.fillStyle = fill;
    this.ctx.fillText(content, x, y);
  }

  // ============ 填充系统 ============

  /**
   * 使用画笔策略填充形状
   */
  private drawFill(
    inst: DrawInstruction,
    clipShape: () => void
  ): void {
    const brushType = (inst.brush as BrushType) ?? this.currentBrush;
    const fill = (inst.fill as string) ?? this.currentColor;
    const fillGradient = (inst.fillGradient as FillGradient) ?? null;
    const fillAngle = (inst.fillAngle as number) ?? this.currentFillAngle;
    const fillDensity = (inst.fillDensity as number) ?? this.currentFillDensity;

    this.ctx.save();
    try {
      const brush = getBrush(brushType);
      brush.fill(this.ctx, clipShape, fill, fillGradient, {
        fillAngle,
        fillDensity,
        duration: (inst.duration as number) ?? 500,
      });
    } finally {
      this.ctx.restore();
    }
  }

  // ============ 裁剪形状 ============

  private clipCircle(cx: number, cy: number, r: number): void {
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.ctx.closePath();
  }

  private clipRect(x: number, y: number, w: number, h: number): void {
    this.ctx.beginPath();
    this.ctx.rect(x, y, w, h);
    this.ctx.closePath();
  }

  private clipPolygon(points: Array<[number, number]>): void {
    this.ctx.beginPath();
    this.ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i][0], points[i][1]);
    }
    this.ctx.closePath();
  }

  private clipEllipse(cx: number, cy: number, rx: number, ry: number): void {
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    this.ctx.closePath();
  }

  private clipArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): void {
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, startAngle, endAngle);
    this.ctx.closePath();
  }

  // ============ 外部对象重绘 ============

  /**
   * 根据 ObjectStore 的对象列表瞬间重绘全部（无动画）。
   * 用于对象编辑后（update/move/delete/undo/redo）刷新画布。
   *
   * NOTE: 当前为全量重绘。对象数量较大时可优化为脏区域重绘，
   * 但对于当前用例（数十个对象），全量重绘 < 1ms 可接受。
   */
  drawObjects(objects: DrawObject[]): void {
    this.ctx.fillStyle = this.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (const obj of objects) {
      // DrawObject 使用 type 字段，drawInstant 使用 action 字段做分发
      this.drawInstant({ ...obj, action: obj.type } as unknown as DrawInstruction);
    }
  }

  /**
   * 瞬间绘制单条指令（不带动画）。
   * 使用画笔系统填充以保持与动画路径一致的纹理效果。
   */
  private drawInstant(inst: DrawInstruction): void {
    const color = inst.color as string;
    const fill = inst.fill as string;
    const stroke = inst.stroke as string;
    const sw = (inst.strokeWidth as number) ?? 2;
    const mode = (inst.mode as DrawMode) ?? 'both';
    // stroke:"none" 或 strokeWidth:0 表示不描边
    const shouldStroke = !!(stroke && stroke !== 'none' && sw > 0);
    const shouldFill = !!(fill && (mode === 'fill' || mode === 'both'));

    switch (inst.action) {
      case 'circle': {
        const cx = (inst.cx as number) ?? 0;
        const cy = (inst.cy as number) ?? 0;
        const r = (inst.r as number) ?? 10;
        if (shouldFill) {
          this.drawFill(inst, () => this.clipCircle(cx, cy, r));
        }
        if (shouldStroke) {
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
          this.ctx.strokeStyle = stroke;
          this.ctx.lineWidth = sw;
          this.ctx.stroke();
        }
        break;
      }
      case 'line': {
        const x1 = (inst.x1 as number) ?? 0;
        const y1 = (inst.y1 as number) ?? 0;
        const x2 = (inst.x2 as number) ?? 100;
        const y2 = (inst.y2 as number) ?? 100;
        if (shouldStroke) {
          this.ctx.beginPath();
          this.ctx.moveTo(x1, y1);
          this.ctx.lineTo(x2, y2);
          this.ctx.strokeStyle = stroke;
          this.ctx.lineWidth = sw;
          this.ctx.stroke();
        }
        break;
      }
      case 'rect': {
        const x = (inst.x as number) ?? 0;
        const y = (inst.y as number) ?? 0;
        const w = (inst.w as number) ?? 50;
        const h = (inst.h as number) ?? 50;
        if (shouldFill) {
          this.drawFill(inst, () => this.clipRect(x, y, w, h));
        }
        if (shouldStroke) {
          this.ctx.strokeStyle = stroke;
          this.ctx.lineWidth = sw;
          this.ctx.strokeRect(x, y, w, h);
        }
        break;
      }
      case 'ellipse': {
        const cx = (inst.cx as number) ?? 0;
        const cy = (inst.cy as number) ?? 0;
        const rx = (inst.rx as number) ?? 30;
        const ry = (inst.ry as number) ?? 20;
        if (shouldFill) {
          this.drawFill(inst, () => this.clipEllipse(cx, cy, rx, ry));
        }
        if (shouldStroke) {
          this.ctx.beginPath();
          this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          this.ctx.strokeStyle = stroke;
          this.ctx.lineWidth = sw;
          this.ctx.stroke();
        }
        break;
      }
      case 'polygon': {
        const pts = inst.points as Array<[number, number]> ?? [];
        if (pts.length < 3) break;
        if (shouldFill) {
          this.drawFill(inst, () => this.clipPolygon(pts));
        }
        if (shouldStroke) {
          this.ctx.beginPath();
          this.ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) this.ctx.lineTo(pts[i][0], pts[i][1]);
          this.ctx.closePath();
          this.ctx.strokeStyle = stroke;
          this.ctx.lineWidth = sw;
          this.ctx.stroke();
        }
        break;
      }
      case 'curve': {
        const pts = inst.points as Array<[number, number]> ?? [];
        if (pts.length < 2) break;
        if (shouldStroke) {
          this.ctx.beginPath();
          this.ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) this.ctx.lineTo(pts[i][0], pts[i][1]);
          this.ctx.strokeStyle = stroke;
          this.ctx.lineWidth = sw;
          this.ctx.stroke();
        }
        break;
      }
      case 'arc': {
        const acx = (inst.cx as number) ?? 0;
        const acy = (inst.cy as number) ?? 0;
        const ar = (inst.r as number) ?? 30;
        const aStart = (inst.startAngle as number) ?? 0;
        const aEnd = (inst.endAngle as number) ?? Math.PI;
        if (shouldFill) {
          this.drawFill(inst, () => this.clipArc(acx, acy, ar, aStart, aEnd));
        }
        if (shouldStroke) {
          this.ctx.beginPath();
          this.ctx.arc(acx, acy, ar, aStart, aEnd);
          this.ctx.strokeStyle = stroke;
          this.ctx.lineWidth = sw;
          this.ctx.stroke();
        }
        break;
      }
      case 'text': {
        const tx = (inst.x as number) ?? 0;
        const ty = (inst.y as number) ?? 0;
        const content = (inst.content as string) ?? '';
        const fontSize = (inst.fontSize as number) ?? 20;
        const textFill = fill ?? color ?? this.currentColor;
        this.ctx.font = `${fontSize}px sans-serif`;
        this.ctx.fillStyle = textFill;
        this.ctx.fillText(content, tx, ty);
        break;
      }
      // 控制指令 + 编辑指令在 instant 中跳过（不影响画面）
    }
  }

  // ============ 工具 ============

  private setStatus(status: RendererStatus): void {
    this.status = status;
    this.onStatusChange?.(status);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
