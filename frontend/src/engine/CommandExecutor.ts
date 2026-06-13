/** CommandExecutor — PR #10 月栖白: 接收后端指令，交给 Renderer + Store 执行 */
import type { DrawInstruction } from '../types/commands';
import type { CanvasRenderer } from './renderer';
import { ObjectStore } from './ObjectStore';
import { HistoryManager } from './HistoryManager';
import { fuzzyFind } from './FuzzyMatcher';

export class CommandExecutor {
  constructor(
    private renderer: CanvasRenderer,
    private store: ObjectStore,
    private history: HistoryManager,
  ) {}

  /** 执行后端返回的 instructions，返回 reply 文本 */
  async execute(instructions: DrawInstruction[], userText: string): Promise<void> {
    // 先保存快照
    this.history.save(this.store.snapshot(), userText);

    for (const inst of instructions) {
      await this.dispatch(inst, userText);
    }
  }

  private async dispatch(inst: DrawInstruction, userText: string): Promise<void> {
    const { action } = inst;

    // 对象管理 — 指令执行前自动注册到 ObjectStore
    if (['circle','rect','line','curve','polygon','ellipse','arc','text'].includes(action)) {
      const obj = this.store.add(inst as any);
      // 修改指令携带的对象 ID，renderer 不感知 ID
    }

    // 对象编辑 — 模糊匹配 target
    if (['update_object','move_object','delete_object'].includes(action)) {
      let target = inst.target as string | undefined;
      if (!target || !this.store.get(target)) {
        const matched = fuzzyFind(userText, this.store);
        if (matched) (inst as any).target = matched;
        else { console.warn(`[Executor] target not found: ${target}`); return; }
      }

      if (action === 'update_object') {
        const params = inst.params as Record<string, unknown> ?? {};
        this.store.update(inst.target as string, params as any);
        this.renderer.drawObjects(this.store.getAll());
        return;
      } else if (action === 'move_object') {
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
        } else if (obj.type === 'polygon') {
          const pts = obj.points ? obj.points.map((p: [number, number]) => [p[0] + dx, p[1] + dy] as [number, number]) : undefined;
          this.store.update(inst.target as string, { points: pts } as any);
          return;
        } else if (obj.type === 'curve') {
          const pts = obj.points ? obj.points.map((p: [number, number]) => [p[0] + dx, p[1] + dy] as [number, number]) : undefined;
          this.store.update(inst.target as string, { points: pts } as any);
          return;
        }
        this.store.update(inst.target as string, updates as any);
        // 对象移动后重绘
        this.renderer.drawObjects(this.store.getAll());
        return;
      } else if (action === 'delete_object') {
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
