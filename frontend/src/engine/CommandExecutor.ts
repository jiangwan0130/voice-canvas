/** CommandExecutor — PR #10 月栖白: 接收后端指令，交给 Renderer + Store 执行 */
import type { DrawInstruction, DrawObject, ShapeType } from '../types/commands';
import type { CanvasRenderer } from './renderer';
import { ObjectStore } from './ObjectStore';
import { HistoryManager } from './HistoryManager';
import { fuzzyFind } from './FuzzyMatcher';

const SHAPE_ACTIONS = new Set<string>(['circle','rect','line','curve','polygon','ellipse','arc','text']);

/** 将 DrawInstruction 的 action 字段映射为 DrawObject 兼容的 type 字段 */
function instructionToDrawParams(inst: DrawInstruction): Partial<DrawObject> {
  const { action, ...rest } = inst;
  if (SHAPE_ACTIONS.has(action)) {
    return { ...rest, type: action as ShapeType } as Partial<DrawObject>;
  }
  return rest as Partial<DrawObject>;
}

export class CommandExecutor {
  constructor(
    private renderer: CanvasRenderer,
    private store: ObjectStore,
    private history: HistoryManager,
  ) {}

  /** 执行后端返回的 instructions，返回 reply 文本 */
  async execute(instructions: DrawInstruction[], userText: string): Promise<void> {
    for (const inst of instructions) {
      await this.dispatch(inst, userText);
    }
  }

  private async dispatch(inst: DrawInstruction, userText: string): Promise<void> {
    const { action } = inst;

    // 对象管理 — 每次 store 变更前保存快照，保证逐条可撤销
    if (SHAPE_ACTIONS.has(action)) {
      this.history.save(this.store.snapshot(), userText);
      this.store.add(instructionToDrawParams(inst) as Omit<DrawObject, 'id' | 'cellId'>);
    }

    // 对象编辑 — 模糊匹配 target
    if (['update_object','move_object','delete_object'].includes(action)) {
      let target = inst.target as string | undefined;
      if (!target || !this.store.get(target)) {
        const matched = fuzzyFind(userText, this.store);
        if (matched) inst.target = matched;
        else { console.warn(`[Executor] target not found: ${target}`); return; }
      }

      if (action === 'update_object') {
        this.history.save(this.store.snapshot(), userText);
        const params = inst.params as Record<string, unknown> ?? {};
        this.store.update(inst.target as string, params as Partial<DrawObject>);
        this.renderer.drawObjects(this.store.getAll());
        return;
      } else if (action === 'move_object') {
        this.history.save(this.store.snapshot(), userText);
        const obj = this.store.get(inst.target as string);
        if (!obj) return;
        const dx = (inst.dx as number) ?? 0;
        const dy = (inst.dy as number) ?? 0;
        const updates: Record<string, number> = {};
        if (obj.type === 'circle' || obj.type === 'ellipse' || obj.type === 'arc') {
          updates.cx = (obj.cx ?? 0) + dx; updates.cy = (obj.cy ?? 0) + dy;
        } else if (obj.type === 'rect' || obj.type === 'text') {
          updates.x = (obj.x ?? 0) + dx; updates.y = (obj.y ?? 0) + dy;
        } else if (obj.type === 'line') {
          updates.x1 = (obj.x1 ?? 0) + dx; updates.y1 = (obj.y1 ?? 0) + dy;
          updates.x2 = (obj.x2 ?? 0) + dx; updates.y2 = (obj.y2 ?? 0) + dy;
        } else if (obj.type === 'polygon' || obj.type === 'curve') {
          const pts = obj.points ? obj.points.map((p: [number, number]) => [p[0] + dx, p[1] + dy] as [number, number]) : undefined;
          this.store.update(inst.target as string, { points: pts } as Partial<DrawObject>);
          return;
        }
        this.store.update(inst.target as string, updates as Partial<DrawObject>);
        // 对象移动后重绘
        this.renderer.drawObjects(this.store.getAll());
        return;
      } else if (action === 'delete_object') {
        this.history.save(this.store.snapshot(), userText);
        this.store.delete(inst.target as string);
        this.renderer.drawObjects(this.store.getAll());
        return;
      }
    }

    // undo — 通过 HistoryManager 恢复 + 重绘
    if (action === 'undo') {
      const snap = this.history.undo();
      if (snap) { this.store.restore(snap.objects); this.renderer.drawObjects(this.store.getAll()); }
      return;
    }

    // clear
    if (action === 'clear') {
      this.store.clear();
      this.history.clear();
      this.renderer.clear();
      return;
    }

    // speak — TTS 由 App 层处理
    if (action === 'speak') return;

    // 其余绘图/控制指令直接交给 renderer
    await this.renderer.execute([inst]);
  }

  /** undo 操作：恢复快照 + 全量重绘 */
  undo(): boolean {
    const snap = this.history.undo();
    if (!snap) return false;
    this.store.restore(snap.objects);
    this.renderer.drawObjects(this.store.getAll());
    return true;
  }

  /** redo 操作：先保存当前状态 → 恢复 redo 快照 → 全量重绘 */
  redo(): boolean {
    const snap = this.history.redo(this.store.snapshot(), "redo");
    if (!snap) return false;
    this.store.restore(snap.objects);
    this.renderer.drawObjects(this.store.getAll());
    return true;
  }
}
