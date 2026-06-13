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

  /** 保存快照（ObjectStore.snapshot() 已深拷贝，直接存储） */
  save(objects: DrawObject[], action: string): void {
    this.undoStack.push({ objects, action });
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
    // currentObjects 已由调用方的 store.snapshot() 深拷贝，直接存储
    this.undoStack.push({ objects: currentObjects, action: currentAction });
    return snap;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
}
