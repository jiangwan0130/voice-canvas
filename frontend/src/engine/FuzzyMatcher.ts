// ============================================================
// 语绘 (Voice Canvas) — 四级模糊对象匹配
// PR #8: 月栖白
// ============================================================

import type { DrawObject } from '../types/commands';
import type { ObjectStore } from './ObjectStore';

const KNOWN_LABELS = ['太阳','树','树干','树冠','房子','墙体','屋顶','门','窗','花','花心','花瓣','山','海','船','星星','云'];

// NOTE: Keep in sync with backend/local_rules.py COLOR_MAP
const COLORS_MAP: Record<string, string> = {
  '红': '#FF4444', '蓝': '#4488FF', '绿': '#228B22',
  '黄': '#FFCC00', '橙': '#FF8800', '紫': '#9944FF',
  '黑': '#000000', '白': '#FFFFFF', '灰': '#888888',
  '粉': '#FF88AA', '棕': '#8B4513', '青': '#00CCCC',
};

/**
 * 四级模糊匹配：label → 颜色 → 位置 → 最近对象
 * 返回匹配到的第一个对象 ID，或 null
 */
export function fuzzyFind(text: string, store: ObjectStore): string | null {
  const all = fuzzyFindAll(text, store);
  return all.length > 0 ? all[0].id : null;
}

/**
 * 返回所有匹配对象（用于批量编辑场景）
 */
export function fuzzyFindAll(text: string, store: ObjectStore): DrawObject[] {
  // Level 1
  for (const label of KNOWN_LABELS) {
    if (text.includes(label)) {
      const found = store.findByLabel(label);
      if (found.length > 0) return found;
    }
  }
  // Level 2
  for (const [name, prefix] of Object.entries(COLORS_MAP)) {
    if (text.includes(name)) {
      const found = store.findByColor(prefix);
      if (found.length > 0) return found;
    }
  }
  // Level 3
  for (const pos of ['左','右','上','下','中间','中']) {
    if (text.includes(pos)) {
      const found = store.findByPosition(pos);
      if (found.length > 0) return found;
    }
  }
  // Level 4
  const last = store.getLast();
  return last ? [last] : [];
}
