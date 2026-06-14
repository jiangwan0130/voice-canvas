"""本地规则引擎 — PR #9 芝士番薯"""
import re
from typing import Optional

# ============ 颜色映射（12 色） ============

# NOTE: Keep in sync with frontend/src/engine/FuzzyMatcher.ts COLORS_MAP
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
WIDTH_SPECIFICS: list[tuple[str, int]] = [
    (r"线条粗细(?:设为)?(\d+)", 0),  # 捕获组取值
]


def match_rules(text: str) -> Optional[dict]:
    """
    尝试匹配本地规则 — 累积模式（支持复合指令如"换成红色然后清除画布"）。

    返回: {"reply": str, "instructions": list[dict]} 或 None（未匹配走 LLM）
    """
    text = text.strip()
    is_short = len(text) <= 14  # 放宽至14字，覆盖常见复合指令

    instructions: list[dict] = []
    replies: list[str] = []
    matched_keywords: set[str] = set()  # 防重复匹配

    # ---- 画布操作（长键优先，避免"清除"吃掉"全部清除"） ----
    for keyword in sorted(CANVAS_KEYWORDS.keys(), key=len, reverse=True):
        if keyword in text and is_short and keyword not in matched_keywords:
            instructions.extend(CANVAS_KEYWORDS[keyword])
            replies.append(keyword)
            matched_keywords.add(keyword)
            break  # 画布操作只取最匹配的一个

    # ---- 画笔切换 ----
    for keyword in sorted(BRUSH_KEYWORDS.keys(), key=len, reverse=True):
        if keyword in text and is_short and keyword not in matched_keywords:
            insts = BRUSH_KEYWORDS[keyword]
            instructions.extend(insts)
            brush_name = "彩铅" if (insts and insts[0].get("type") == "pencil") else "颜料笔"
            replies.append(f"已切换为{brush_name}")
            matched_keywords.add(keyword)
            break

    # ---- 系统指令 ----
    for keyword in sorted(SYSTEM_KEYWORDS.keys(), key=len, reverse=True):
        if keyword in text and is_short and keyword not in matched_keywords:
            instructions.extend(SYSTEM_KEYWORDS[keyword])
            replies.append(keyword)
            matched_keywords.add(keyword)
            break

    # ---- 颜色切换（长键优先:"红色">"红"） ----
    for color_key in sorted(COLOR_MAP.keys(), key=len, reverse=True):
        if color_key in text and len(text) <= 14 and color_key not in matched_keywords:
            color_hex = COLOR_MAP[color_key]
            instructions.append({"action": "setColor", "value": color_hex, "duration": 0})
            replies.append(f"颜色切换为{color_key}")
            matched_keywords.add(color_key)
            # 也标记单字键为已匹配（避免"红色"后再匹配"红"）
            if len(color_key) >= 2:
                for short_k in COLOR_MAP:
                    if len(short_k) == 1 and short_k in color_key:
                        matched_keywords.add(short_k)
            break

    # ---- 粗细调整 ----
    for pattern, delta in WIDTH_PATTERNS:
        if re.search(pattern, text) and is_short:
            instructions.append({"action": "setWidth", "delta": delta, "duration": 0})
            replies.append(f"线条{'加粗' if delta > 0 else '变细'}了一点")
            break

    # ---- 线条粗细明确值 ----
    if not instructions:  # 只在无其他匹配时才尝试
        for pattern, _ in WIDTH_SPECIFICS:
            m = re.search(pattern, text)
            if m and is_short:
                value = int(m.group(1))
                instructions.append({"action": "setWidth", "value": value, "duration": 0})
                replies.append(f"线条粗细设为 {value}")
                break

    if instructions:
        return {"reply": "，".join(replies) if replies else "好的", "instructions": instructions}

    # ---- 未匹配 → 走 LLM ----
    return None


def _is_short(text: str, max_len: int = 10) -> bool:
    """长度哨兵：短文本才走本地规则，避免误判包含关键词的绘图指令"""
    return len(text) <= max_len


def _make_response(instructions: list[dict], reply: str) -> dict:
    return {"reply": reply, "instructions": instructions}
