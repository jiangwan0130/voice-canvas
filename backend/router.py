"""指令路由器 — PR #9 芝士番薯

路由策略:
  文本 → 本地规则引擎（简单指令）→ 即时返回
       → LLM 客户端（复杂绘图指令）→ 生成 JSON 指令序列
"""
from local_rules import match_rules


def is_local_command(text: str) -> bool:
    """
    判断是否为本地可处理的简单指令。

    规则：
    - 长度 ≤ 10 字（复杂绘图指令通常更长）
    - 包含本地规则引擎可识别的关键词
    - 注意：返回 True 只是"尝试"，match_rules 返回 None 才走 LLM
    """
    result = match_rules(text)
    return result is not None


def route(text: str) -> dict:
    """
    指令路由主函数。

    1. 先尝试本地规则引擎
    2. 匹配失败 → 标记走 LLM
    """
    # 尝试本地规则
    local_result = match_rules(text)
    if local_result is not None:
        local_result["source"] = "local"
        return local_result

    # 未匹配 → 标记走 LLM
    return {
        "reply": "",
        "instructions": [],
        "source": "llm",
        "text": text,  # 原文本传给 LLM
    }
