"""LLM 输出修复管道 — PR #9 月栖白"""
# ① 去 markdown 包裹
# ② 括号栈截断修复
# ③ 字段校验 + 退化


def repair_pipeline(raw: str) -> tuple[dict | None, str]:
    """返回 (parsed_dict_or_None, error_message)"""
    # TODO PR #9
    return None, "not implemented"
