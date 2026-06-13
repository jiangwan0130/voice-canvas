"""LLM 输出修复管道 — PR #9 月栖白

① 剥离 markdown 包裹
② 括号栈截断修复
③ 字段校验 + 退化
"""
import re
import json


def extract_json(raw: str) -> str:
    """第①层：剥离 ```json ... ``` 包裹，提取首个 JSON 对象"""
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    return match.group(0) if match else raw


def repair_truncated(s: str) -> str:
    """第②层：括号栈匹配，逆向补全截断的 JSON"""
    stack: list[str] = []
    in_string = False
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == '\\' and in_string:
            i += 2
            continue
        if ch == '"':
            in_string = not in_string
        elif not in_string:
            if ch in '{[':
                stack.append(ch)
            elif ch == '}':
                if stack and stack[-1] == '{':
                    stack.pop()
            elif ch == ']':
                if stack and stack[-1] == '[':
                    stack.pop()
        i += 1

    closer = {'{': '}', '[': ']'}
    return s + ''.join(closer[c] for c in reversed(stack) if c in closer)


def validate_and_fix(parsed: dict) -> dict:
    """第③层：字段校验，缺失则退化"""
    if 'reply' not in parsed:
        parsed['reply'] = '好的'
    if 'instructions' not in parsed:
        parsed['instructions'] = [
            {'action': 'speak', 'params': {'text': parsed.get('reply', '好的')}}
        ]
    if not isinstance(parsed['instructions'], list):
        parsed['instructions'] = []
    return parsed


def repair_pipeline(raw: str) -> tuple[dict | None, str]:
    """
    修复管道主入口
    Returns: (parsed_dict_or_None, error_message)
    """
    # ① 去 markdown
    extracted = extract_json(raw)

    # ② 尝试直接 parse
    try:
        parsed = json.loads(extracted)
        return validate_and_fix(parsed), ""
    except json.JSONDecodeError:
        pass

    # ③ 截断修复后重试
    repaired = repair_truncated(extracted)
    try:
        parsed = json.loads(repaired)
        return validate_and_fix(parsed), ""
    except json.JSONDecodeError as e:
        return None, f"JSON parse failed after repair: {e}"
