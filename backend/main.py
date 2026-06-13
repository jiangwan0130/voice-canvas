"""
FastAPI 入口 — 语绘 Voice Canvas 后端
PR #9 芝士番薯: ASR + 路由 + 本地规则引擎
PR #9 月栖白: LLM 客户端 + JSON 修复 + 安全校验
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any, Dict

from asr.qiniu_asr import QiniuASR
from router import route

app = FastAPI(title="语绘 Voice Canvas API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ 服务实例 ============

qiniu_asr = QiniuASR()

# ============ 请求/响应模型 ============


class GenerateRequest(BaseModel):
    text: str
    canvas_state: Optional[Dict[str, Any]] = None
    last_action: Optional[Dict[str, Any]] = None


class GenerateResponse(BaseModel):
    reply: str
    instructions: List[Dict[str, Any]]
    source: str  # "local" | "llm"


class AsrResponse(BaseModel):
    text: str
    source: str  # "qiniu" | "webspeech" | "error"


# ============ 健康检查 ============


@app.get("/health")
def health():
    return {"status": "ok"}


# ============ 语音识别 ============


@app.post("/api/asr")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    PR #9 芝士番薯: 七牛云 ASR 语音识别

    前端上传音频文件 → 七牛云短语音听写 → 返回文本。
    七牛云 ASR 失败时返回错误，前端降级 Web Speech API。
    """
    try:
        audio_data = await audio.read()
        if not audio_data:
            raise HTTPException(400, "音频数据为空")

        text = await qiniu_asr.transcribe(audio_data)
        if not text:
            return {"text": "", "source": "qiniu", "note": "识别结果为空"}

        return {"text": text, "source": "qiniu"}

    except Exception as e:
        # 七牛云 ASR 失败 → 返回错误，提示前端降级 Web Speech API
        return {
            "text": "",
            "source": "error",
            "error": str(e),
            "fallback": "webspeech",
        }


# ============ 绘图指令生成 ============


@app.post("/api/generate")
async def generate_instructions(req: GenerateRequest):
    """
    PR #9: 指令路由 → 本地规则 / LLM → JSON 指令

    芝士番薯: 路由 + 本地规则引擎
    月栖白: LLM 客户端 + JSON 修复 + 校验（后续接入）
    """
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "指令文本为空")

    # 路由判断
    result = route(text)

    if result["source"] == "local":
        # 本地规则引擎匹配成功 → 即时返回
        return {
            "reply": result["reply"],
            "instructions": result["instructions"],
            "source": "local",
        }

    # 走 LLM → 月栖白负责实现
    # TODO: PR #9 月栖白 — 接入 llm_client + json_repair + command_parser
    # 当前兜底: 返回提示信息
    return {
        "reply": f"正在理解: {text}（LLM 链路连接中...）",
        "instructions": [],
        "source": "llm",
        "note": "LLM 客户端待月栖白接入",
    }


# ============ 启动 ============

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
