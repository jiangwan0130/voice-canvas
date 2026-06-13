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

  /** 在执行指令前保存快照 */
  save(objects: DrawObject[], action: string): void {
    this.undoStack.push({
      objects: objects.map(o => ({ ...o })),
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

  /** 重做 */
  redo(): { objects: DrawObject[]; action: string } | null {
    const snap = this.redoStack.pop();
    if (!snap) return null;
    this.undoStack.push(snap);
    return snap;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
}
