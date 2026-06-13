"""Command Parser 安全校验 — PR #9 月栖白"""
# action 白名单 / 必填参数 / 可选默认值 / 坐标边界 / 颜色格式 / target 存在性 / 逐条丢弃


def validate_instructions(instructions: list[dict], existing_object_ids: set) -> list[dict]:
    """校验并过滤，返回安全指令列表"""
    # TODO PR #9
    return instructions
