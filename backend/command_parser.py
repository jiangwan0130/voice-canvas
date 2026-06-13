"""Command Parser 安全校验 — PR #9 月栖白

7 项校验：action 白名单 / 必填参数 / 可选默认值 / 坐标边界 / 颜色格式 / target 存在性 / 逐条丢弃
"""
import re
from config import CANVAS_WIDTH, CANVAS_HEIGHT

# Action 白名单
ALLOWED_ACTIONS = {
    # 绘图指令
    'circle', 'rect', 'line', 'curve', 'polygon', 'ellipse', 'arc', 'text',
    # 对象编辑
    'update_object', 'move_object', 'delete_object',
    # 控制指令
    'setColor', 'setWidth', 'setBrush', 'clear', 'undo', 'redo', 'pause', 'resume', 'wait', 'speak',
}

# 每种 action 的必填参数
REQUIRED_PARAMS: dict[str, list[str]] = {
    'circle': ['cx', 'cy', 'r'],
    'rect': ['x', 'y', 'w', 'h'],
    'line': ['x1', 'y1', 'x2', 'y2'],
    'curve': ['points'],
    'polygon': ['points'],
    'ellipse': ['cx', 'cy', 'rx', 'ry'],
    'arc': ['cx', 'cy', 'r', 'startAngle', 'endAngle'],
    'text': ['x', 'y', 'content'],
    'update_object': ['target'],
    'move_object': ['target', 'dx', 'dy'],
    'delete_object': ['target'],
}

# 可选参数默认值
DEFAULT_PARAMS: dict[str, dict] = {
    'circle':   {'color': '#000000', 'fill': 'transparent', 'strokeWidth': 2, 'duration': 500},
    'rect':     {'color': '#000000', 'fill': 'transparent', 'strokeWidth': 2, 'duration': 400},
    'line':     {'color': '#000000', 'strokeWidth': 2, 'duration': 300},
    'curve':    {'color': '#000000', 'strokeWidth': 2, 'duration': 400},
    'polygon':  {'color': '#000000', 'fill': 'transparent', 'strokeWidth': 2, 'duration': 500},
    'ellipse':  {'color': '#000000', 'fill': 'transparent', 'strokeWidth': 2, 'duration': 450},
    'arc':      {'color': '#000000', 'fill': 'transparent', 'strokeWidth': 2, 'duration': 400},
    'text':     {'fill': '#000000', 'fontSize': 20},
    'setColor': {'duration': 0},
    'setWidth': {'duration': 0},
    'setBrush': {'duration': 0},
    'clear':    {'duration': 0},
    'undo':     {'duration': 0},
    'wait':     {'duration': 300},
    'speak':    {},
}

HEX_RE = re.compile(r'^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$')
CSS_COLORS = {'red','blue','green','yellow','orange','purple','pink','black','white','gray','grey','brown','cyan','magenta','transparent'}


def _is_valid_color(c: str) -> bool:
    return bool(HEX_RE.match(c)) or c.lower() in CSS_COLORS


def validate_instructions(instructions: list[dict], existing_object_ids: set) -> list[dict]:
    """校验并逐条过滤，返回安全指令列表"""

    safe: list[dict] = []

    for cmd in instructions:
        action = cmd.get('action', '')
        params = dict(cmd)  # 浅拷贝
        params.pop('action', None)

        # 1. action 白名单
        if action not in ALLOWED_ACTIONS:
            continue

        # 2. 必填参数检查
        required = REQUIRED_PARAMS.get(action, [])
        if any(p not in params for p in required):
            continue

        # 3. 可选参数默认值补全
        defaults = DEFAULT_PARAMS.get(action, {})
        for k, v in defaults.items():
            if k not in params:
                params[k] = v

        # 4. 坐标边界钳位
        coord_keys = {'x','y','cx','cy','x1','y1','x2','y2','x3','y3','w','h','r','rx','ry','dx','dy'}
        for k in coord_keys:
            if k in params and isinstance(params[k], (int, float)):
                if k in ('w','h','r','rx','ry'):
                    params[k] = max(1, min(params[k], max(CANVAS_WIDTH, CANVAS_HEIGHT)))
                elif k in ('dx','dy'):
                    bound = CANVAS_HEIGHT if k == 'dy' else CANVAS_WIDTH
                    params[k] = max(-bound, min(params[k], bound))
                else:
                    bound = CANVAS_HEIGHT if k.startswith('y') else CANVAS_WIDTH
                    params[k] = max(0, min(params[k], bound))

        # 5. 颜色格式校验
        for ck in ('color', 'fill'):
            if ck in params and params[ck] and not _is_valid_color(str(params[ck])):
                params[ck] = '#000000' if ck == 'color' else 'transparent'

        # 6. target 存在性
        if action in ('update_object', 'move_object', 'delete_object'):
            target = params.get('target', '')
            if target not in existing_object_ids:
                continue

        # 7. 数值类型强制
        for nk in ('strokeWidth', 'fontSize', 'duration', 'width', 'size'):
            if nk in params and not isinstance(params[nk], (int, float)):
                try:
                    params[nk] = float(params[nk])
                except (ValueError, TypeError):
                    params[nk] = 2

        safe.append({'action': action, **params})

    return safe
