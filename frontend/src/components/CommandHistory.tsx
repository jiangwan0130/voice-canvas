// ============================================================
// 语绘 (Voice Canvas) — 指令历史
// PR #12: 芝士番薯 — UI 打磨
// ============================================================

interface CommandHistoryProps {
  items: string[];
  maxShow?: number;
}

export function CommandHistory({ items, maxShow = 5 }: CommandHistoryProps) {
  if (items.length === 0) return null;

  const visible = items.slice(-maxShow);

  return (
    <div className="cmd-history" aria-label="指令历史">
      {visible.map((item, i) => (
        <span key={items.length - visible.length + i} className="cmd-chip">
          {item}
        </span>
      ))}
    </div>
  );
}
