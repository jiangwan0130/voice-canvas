"""
FastAPI 入口 — 语绘 Voice Canvas 后端
PR #6: 脚手架占位，后续 PR 实现完整逻辑
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any, Dict


app = FastAPI(title="语绘 Voice Canvas API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ 健康检查 ============

@app.get("/health")
def health():
    return {"status": "ok"}


# ============ 占位路由 — 后续 PR 实现 ============

@app.post("/api/asr")
async def transcribe_audio():
    """PR #9 芝士番薯: 七牛云 ASR + WebSpeech 降级"""
    return {"text": "", "source": "placeholder", "note": "PR #9 实现"}


@app.post("/api/generate")
async def generate_instructions():
    """PR #9 协作: 指令路由 → LLM / 规则 → 修复 → 校验 → JSON 指令"""
    return {"reply": "PR #9 待实现", "instructions": [], "source": "placeholder"}


# ============ 启动 ============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
