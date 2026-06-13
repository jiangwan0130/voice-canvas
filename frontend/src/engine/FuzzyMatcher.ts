// ============================================================
// 语绘 (Voice Canvas) — 四级模糊对象匹配
// PR #8: 月栖白
// ============================================================

import type { DrawObject } from '../types/commands';
import type { ObjectStore } from './ObjectStore';

const KNOWN_LABELS = ['太阳','树','树干','树冠','房子','墙体','屋顶','门','窗','花','花心','花瓣','山','海','船','星星','云'];

const COLORS_MAP: Record<string, string> = {
  '红': '#ff', '蓝': '#00', '绿': '#0f', '黄': '#ff',
  '紫': '#80', '橙': '#fa', '黑': '#00', '白': '#ff',
  '灰': '#80', '棕': '#8b', '粉': '#ff', '青': '#00',
};

/**
 * 四级模糊匹配：label → 颜色 → 位置 → 最近对象
 * 返回匹配到的第一个对象 ID，或 null
 */
export function fuzzyFind(text: string, store: ObjectStore): string | null {
  // Level 1: label 关键词
  for (const label of KNOWN_LABELS) {
    if (text.includes(label)) {
      const found = store.findByLabel(label);
      if (found.length > 0) return found[0].id;
    }
  }

  // Level 2: 颜色
  for (const [name, prefix] of Object.entries(COLORS_MAP)) {
    if (text.includes(name)) {
      const found = store.findByColor(prefix);
      if (found.length > 0) return found[0].id;
    }
  }

  // Level 3: 位置
  const positions = ['左', '右', '上', '下', '中间', '中'];
  for (const pos of positions) {
    if (text.includes(pos)) {
      const found = store.findByPosition(pos);
      if (found.length > 0) return found[0].id;
    }
  }

  // Level 4: 最近创建
  const last = store.getLast();
  return last?.id ?? null;
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
