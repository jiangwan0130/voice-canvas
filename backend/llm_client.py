"""DeepSeek v4 LLM 客户端 — PR #9 月栖白"""
from config import LLM_API_KEY, LLM_API_BASE, LLM_MODEL


async def call_llm(user_text: str, grid_json: str, last_action: str = "") -> dict:
    """调用 DeepSeek via 七牛云 MaaS，返回 {reply, instructions}"""
    # TODO PR #9: httpx 调用 + System Prompt 构造
    return {"reply": "", "instructions": []}
