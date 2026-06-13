// ============================================================
// 语绘 (Voice Canvas) — 撤销快照栈
// PR #8: 月栖白
// ============================================================

import type { DrawObject } from '../types/commands';

interface Snapshot {
  objects: DrawObject[];
  action: string;
}

export class HistoryManager {
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private maxSize = 50;

  /** 在执行指令前保存快照（深拷贝，防止 points 等数组被后续操作污染） */
  save(objects: DrawObject[], action: string): void {
    this.undoStack.push({
      objects: objects.map(o => ({ ...o, points: o.points ? o.points.map((p: [number, number]) => [p[0], p[1]] as [number, number]) : undefined })),
      action,
    });
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    // 新操作清空 redo
    this.redoStack = [];
  }

  /** 撤销：返回上一个快照 */
  undo(): { objects: DrawObject[]; action: string } | null {
    const snap = this.undoStack.pop();
    if (!snap) return null;
    this.redoStack.push(snap);
    return snap;
  }

  /** 重做：先保存当前状态 → 再恢复 redo 快照，保证 undo→redo→undo 链完整 */
  redo(currentObjects: DrawObject[], currentAction: string): { objects: DrawObject[]; action: string } | null {
    const snap = this.redoStack.pop();
    if (!snap) return null;
    // 保存 redo 前的当前状态（深拷贝 points），以便后续 undo 可以回到这里
    this.undoStack.push({
      objects: currentObjects.map(o => ({ ...o, points: o.points ? o.points.map((p: [number, number]) => [p[0], p[1]] as [number, number]) : undefined })),
      action: currentAction,
    });
    return snap;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
}
