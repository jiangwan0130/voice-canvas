// ============================================================
// 语绘 (Voice Canvas) — 对象管理 + 空间网格索引
// PR #8: 月栖白
// ============================================================

import type { DrawObject, GridCell, GridState } from '../types/commands';

const GRID_COLS = 3;
const GRID_ROWS = 2;
const GRID_LABELS: Record<string, string> = {
  '0,0': '左上', '0,1': '中上', '0,2': '右上',
  '1,0': '左下', '1,1': '中下', '1,2': '右下',
};

export class ObjectStore {
  private objects: Map<string, DrawObject> = new Map();
  private idCounter = 0;
  public width = 1200;
  public height = 800;

  /** 添加对象 — 自动分配 id + cellId */
  add(obj: Omit<DrawObject, 'id' | 'cellId'>): DrawObject {
    const id = `obj_${++this.idCounter}`;
    const cellId = this.computeCell(obj as Partial<DrawObject>);
    const full: DrawObject = { ...obj, id, cellId } as DrawObject;
    this.objects.set(id, full);
    return full;
  }

  get(id: string): DrawObject | undefined { return this.objects.get(id); }

  /** 更新对象 — 自动重算 cellId */
  update(id: string, params: Partial<DrawObject>): DrawObject | null {
    const obj = this.objects.get(id);
    if (!obj) return null;
    const merged = { ...obj, ...params };
    merged.cellId = this.computeCell(merged);
    this.objects.set(id, merged);
    return merged;
  }

  delete(id: string): boolean { return this.objects.delete(id); }

  // ============ 批量操作 ============

  getByGroup(groupId: string): DrawObject[] {
    return this.getAll().filter(o => o.groupId === groupId);
  }

  getBodyByGroup(groupId: string): DrawObject | undefined {
    return this.getAll().find(o => o.groupId === groupId && o.role === 'body');
  }

  // ============ 搜索 ============

  findByLabel(keyword: string): DrawObject[] {
    return this.getAll().filter(o => o.label?.includes(keyword));
  }

  findByColor(hexPrefix: string): DrawObject[] {
    return this.getAll().filter(o => (o.fill ?? '').startsWith(hexPrefix));
  }

  findByCell(cellId: string): DrawObject[] {
    return this.getAll().filter(o => o.cellId === cellId);
  }

  findByPosition(pos: string): DrawObject[] {
    const map: Record<string, string[]> = {
      '左': ['0,0','1,0'], '右': ['0,2','1,2'],
      '上': ['0,0','0,1','0,2'], '下': ['1,0','1,1','1,2'],
      '中间': ['0,1','1,1'], '中': ['0,1','1,1'],
    };
    return (map[pos] ?? []).flatMap(cid => this.findByCell(cid));
  }

  getLast(): DrawObject | undefined {
    const all = this.getAll();
    return all.length > 0 ? all[all.length - 1] : undefined;
  }

  // ============ 状态管理 ============

  getAll(): DrawObject[] { return Array.from(this.objects.values()); }
  get count(): number { return this.objects.size; }

  clear(): void { this.objects.clear(); this.idCounter = 0; }

  restore(objects: DrawObject[]): void {
    this.objects.clear();
    this.idCounter = objects.reduce((max, o) => {
      const num = parseInt(o.id.replace('obj_', ''), 10);
      return Math.max(max, isNaN(num) ? 0 : num);
    }, 0);
    objects.forEach(o => this.objects.set(o.id, deepCopyObject(o)));
  }

  snapshot(): DrawObject[] {
    return this.getAll().map(o => deepCopyObject(o));
  }

  toGridState(): GridState {
    const cells: GridCell[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cellId = `${r},${c}`;
        cells.push({ id: cellId, label: GRID_LABELS[cellId] ?? cellId, objects: this.findByCell(cellId) });
      }
    }
    return { cells };
  }

  // ============ 空间计算 ============

  private computeCell(obj: Partial<DrawObject>): string {
    let cx = 600, cy = 400;
    switch (obj.type) {
      case 'circle': case 'ellipse': case 'arc':
        cx = obj.cx ?? 0; cy = obj.cy ?? 0; break;
      case 'rect':
        cx = (obj.x ?? 0) + (obj.w ?? 100) / 2;
        cy = (obj.y ?? 0) + (obj.h ?? 100) / 2;
        break;
      case 'line':
        cx = ((obj.x1 ?? 0) + (obj.x2 ?? 0)) / 2;
        cy = ((obj.y1 ?? 0) + (obj.y2 ?? 0)) / 2;
        break;
      case 'polygon': case 'curve': {
        const pts = obj.points as Array<[number, number]> | undefined;
        if (pts && pts.length > 0) {
          cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
          cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        }
        break;
      }
      case 'text':
        cx = obj.x ?? 0;
        cy = obj.y ?? 0;  // baseline 坐标本身已足够精准，无需偏移
        break;
    }
    const c = Math.min(Math.floor(cx / (this.width / GRID_COLS)), GRID_COLS - 1);
    const r = Math.min(Math.floor(cy / (this.height / GRID_ROWS)), GRID_ROWS - 1);
    return `${r},${c}`;
  }
}

/** 深拷贝对象（处理 points 等嵌套数组） */
function deepCopyObject(o: DrawObject): DrawObject {
  return {
    ...o,
    points: o.points ? o.points.map((p: [number, number]) => [p[0], p[1]] as [number, number]) : undefined,
  };
}
