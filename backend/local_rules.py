"""本地规则引擎 — PR #9 芝士番薯"""
import re
from typing import Optional

# ============ 颜色映射（12 色） ============

COLOR_MAP: dict[str, str] = {
    "红": "#FF4444", "红色": "#FF4444", "红的": "#FF4444",
    "蓝": "#4488FF", "蓝色": "#4488FF",
    "绿": "#228B22", "绿色": "#228B22",
    "黄": "#FFCC00", "黄色": "#FFCC00",
    "橙": "#FF8800", "橙色": "#FF8800",
    "紫": "#9944FF", "紫色": "#9944FF",
    "黑": "#000000", "黑色": "#000000",
    "白": "#FFFFFF", "白色": "#FFFFFF",
    "灰": "#888888", "灰色": "#888888",
    "粉": "#FF88AA", "粉色": "#FF88AA",
    "棕": "#8B4513", "棕色": "#8B4513",
    "青": "#00CCCC", "青色": "#00CCCC",
}

# ============ 关键词 → 指令映射 ============

# 画布操作
CANVAS_KEYWORDS: dict[str, list[dict]] = {
    "清除": [{"action": "clear", "duration": 0}],
    "清空": [{"action": "clear", "duration": 0}],
    "清屏": [{"action": "clear", "duration": 0}],
    "全部清除": [{"action": "clear", "duration": 0}],
    "撤销": [{"action": "undo", "duration": 0}],
    "回退": [{"action": "undo", "duration": 0}],
    "上一步": [{"action": "undo", "duration": 0}],
    "返回": [{"action": "undo", "duration": 0}],
    "重做": [{"action": "redo", "duration": 0}],
    "恢复": [{"action": "redo", "duration": 0}],
}

# 画笔切换
BRUSH_KEYWORDS: dict[str, list[dict]] = {
    "彩铅": [{"action": "setBrush", "type": "pencil", "fillAngle": 45, "fillDensity": 6, "duration": 0}],
    "用彩铅": [{"action": "setBrush", "type": "pencil", "fillAngle": 45, "fillDensity": 6, "duration": 0}],
    "换成彩铅": [{"action": "setBrush", "type": "pencil", "fillAngle": 45, "fillDensity": 6, "duration": 0}],
    "颜料笔": [{"action": "setBrush", "type": "paint", "fillAngle": 45, "fillDensity": 6, "duration": 0}],
    "用颜料": [{"action": "setBrush", "type": "paint", "fillAngle": 45, "fillDensity": 6, "duration": 0}],
    "换成颜料笔": [{"action": "setBrush", "type": "paint", "fillAngle": 45, "fillDensity": 6, "duration": 0}],
}

# 系统指令
SYSTEM_KEYWORDS: dict[str, list[dict]] = {
    "暂停": [{"action": "pause", "duration": 0}],
    "停一下": [{"action": "pause", "duration": 0}],
    "继续": [{"action": "resume", "duration": 0}],
    "接着画": [{"action": "resume", "duration": 0}],
}

# 粗细调整
WIDTH_PATTERNS: list[tuple[str, int]] = [
    (r"粗一点", 1),
    (r"再粗一点", 1),
    (r"细一点", -1),
    (r"再细一点", -1),
]

# 线条粗细明确值
WIDTH_SPEICIFICS: list[tuple[str, int]] = [
    (r"线条粗细[设为]?(\d+)", 0),  # 捕获组取值
]


def match_rules(text: str) -> Optional[dict]:
    """
    尝试匹配本地规则。

    返回: {"reply": str, "instructions": list[dict]} 或 None（未匹配走 LLM）
    """
    text = text.strip()

    # ---- 精确匹配：画布操作 ----
    for keyword, instructions in CANVAS_KEYWORDS.items():
        if keyword in text and _is_short(text):
            return _make_response(instructions, f"好的，{keyword}")

    # ---- 精确匹配：画笔切换 ----
    for keyword, instructions in BRUSH_KEYWORDS.items():
        if keyword in text and _is_short(text):
            brush_name = "彩铅" if "pencil" in str(instructions) else "颜料笔"
            return _make_response(instructions, f"已切换为{brush_name}")

    # ---- 精确匹配：系统指令 ----
    for keyword, instructions in SYSTEM_KEYWORDS.items():
        if keyword in text and _is_short(text):
            return _make_response(instructions, f"好的")

    # ---- 颜色切换: "换成红色" / "用蓝色" / "红色" ----
    for color_key, color_hex in COLOR_MAP.items():
        if color_key in text and _is_short(text, max_len=12):
            return _make_response(
                [{"action": "setColor", "value": color_hex, "duration": 0}],
                f"颜色切换为{color_key}"
            )

    # ---- 粗细调整 ----
    for pattern, delta in WIDTH_PATTERNS:
        if re.search(pattern, text) and _is_short(text):
            # 使用 delta 提示前端调整（delta 表示相对变化）
            return _make_response(
                [{"action": "setWidth", "delta": delta, "duration": 0}],
                f"线条{'加粗' if delta > 0 else '变细'}了一点"
            )

    # ---- 线条粗细明确值 ----
    for pattern, _ in WIDTH_SPEICIFICS:
        m = re.search(pattern, text)
        if m and _is_short(text):
            value = int(m.group(1))
            return _make_response(
                [{"action": "setWidth", "value": value, "duration": 0}],
                f"线条粗细设为 {value}"
            )

    # ---- 未匹配 → 走 LLM ----
    return None


def _is_short(text: str, max_len: int = 10) -> bool:
    """长度哨兵：短文本才走本地规则，避免误判包含关键词的绘图指令"""
    return len(text) <= max_len


def _make_response(instructions: list[dict], reply: str) -> dict:
    return {"reply": reply, "instructions": instructions}
