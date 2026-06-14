// ============================================================
// 语绘 (Voice Canvas) — 画笔 & 颜色工具栏
// 参考: PaintZ / MS Paint / draw.io 经典布局
// ============================================================

const BRUSHES = [
  { type: 'pencil', icon: '✏️', label: '彩铅', desc: '排线填充' },
  { type: 'paint',  icon: '🖌️', label: '颜料', desc: '笔触纹理' },
];

const COLORS = [
  { name: '红', hex: '#FF4444' },
  { name: '橙', hex: '#FF8800' },
  { name: '黄', hex: '#FFCC00' },
  { name: '绿', hex: '#228B22' },
  { name: '青', hex: '#00CCCC' },
  { name: '蓝', hex: '#4488FF' },
  { name: '紫', hex: '#9944FF' },
  { name: '粉', hex: '#FF88AA' },
  { name: '棕', hex: '#8B4513' },
  { name: '灰', hex: '#888888' },
  { name: '黑', hex: '#000000' },
  { name: '白', hex: '#FFFFFF' },
];

export function PaletteBar() {
  return (
    <>
      {/* 左侧工具栏 */}
      <div className="toolbar-left">
        <div className="tool-group">
          <span className="tool-group-label">画笔</span>
          {BRUSHES.map(b => (
            <button key={b.type} className="tool-btn" title={`${b.label} — ${b.desc}`}>
              <span className="tool-icon">{b.icon}</span>
              <span className="tool-name">{b.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 底部颜色条 */}
      <div className="toolbar-bottom">
        {COLORS.map(c => (
          <button key={c.name} className="color-swatch" title={c.name} style={{ '--swatch-color': c.hex } as React.CSSProperties}>
            <span className="color-swatch-dot" style={{ background: c.hex }} />
          </button>
        ))}
      </div>
    </>
  );
}
