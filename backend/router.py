"""指令路由器 — PR #9 芝士番薯"""
# 路由策略: 文本 → 简单指令? → local_rules / llm_client


def is_local_command(text: str) -> bool:
    """判断是否为本地可处理的简单指令（≤12字 + 关键词匹配）"""
    # TODO PR #9: 完整关键词匹配表
    return False
