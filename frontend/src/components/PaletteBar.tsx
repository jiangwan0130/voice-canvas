// ============================================================
// 语绘 (Voice Canvas) — 画笔 & 颜色面板
// PR #12: 芝士番薯 — UI 打磨
// ============================================================

const BRUSHES = [
  { type: 'pencil', label: '✏️ 彩铅', desc: '排线填充' },
  { type: 'paint',  label: '🖌️ 颜料笔', desc: '笔触纹理' },
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
    <div className="palette-bar">
      {/* 画笔 */}
      <div className="palette-section">
        <span className="palette-label">画笔</span>
        <div className="palette-items">
          {BRUSHES.map(b => (
            <span key={b.type} className="palette-brush" title={b.desc}>
              <span className="palette-brush-icon">{b.label.split(' ')[0]}</span>
              <span className="palette-brush-name">{b.label.split(' ')[1]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* 分隔 */}
      <span className="palette-divider" />

      {/* 颜色 */}
      <div className="palette-section">
        <span className="palette-label">颜色</span>
        <div className="palette-items">
          {COLORS.map(c => (
            <span key={c.name} className="palette-color" title={c.name}>
              <span className="palette-color-dot" style={{ background: c.hex }} />
              <span className="palette-color-name">{c.name}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
