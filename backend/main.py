"""
FastAPI 入口 — 语绘 Voice Canvas 后端
PR #9: 后端核心链路 — ASR(芝士番薯) + 路由(芝士番薯) + LLM(月栖白) + 修复(月栖白) + 校验(月栖白)
"""
import json
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any

from config import CANVAS_WIDTH, CANVAS_HEIGHT
from llm_client import call_llm
from json_repair import repair_pipeline
from command_parser import validate_instructions

# 芝士番薯负责 — PR #9
try:
    from router import is_local_command
    from local_rules import match_rules
except ImportError:
    is_local_command = lambda _: False
    match_rules = lambda _: None

app = FastAPI(title="语绘 Voice Canvas API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ Pydantic Models ============

class GridObject(BaseModel):
    id: str
    label: str
    type: str
    role: Optional[str] = None
    groupId: Optional[str] = None
    cellId: Optional[str] = None
    cx: Optional[float] = None; cy: Optional[float] = None; r: Optional[float] = None
    x: Optional[float] = None; y: Optional[float] = None; w: Optional[float] = None; h: Optional[float] = None
    x1: Optional[float] = None; y1: Optional[float] = None
    x2: Optional[float] = None; y2: Optional[float] = None
    fill: Optional[str] = None; color: Optional[str] = None
    class Config: extra = "allow"

class GridCell(BaseModel):
    id: str
    label: str
    objects: List[GridObject] = []

class GridState(BaseModel):
    cells: List[GridCell] = []

class CanvasState(BaseModel):
    width: int = CANVAS_WIDTH
    height: int = CANVAS_HEIGHT
    grid: GridState = GridState(cells=[])

class LastAction(BaseModel):
    reply: str = ""
    instructions: List[dict] = []

class GenerateRequest(BaseModel):
    text: str
    canvas_state: CanvasState
    last_action: Optional[LastAction] = None

class GenerateResponse(BaseModel):
    reply: str
    instructions: List[dict]
    source: str  # "local" | "llm"


# ============ Health ============

@app.get("/health")
def health():
    return {"status": "ok"}


# ============ ASR (芝士番薯) ============

@app.post("/api/asr")
async def transcribe_audio(audio: UploadFile = File(None)):
    """PR #9 芝士番薯: 七牛云 ASR + WebSpeech 降级"""
    # TODO: 芝士番薯接入七牛云 ASR
    return {"text": "", "source": "placeholder", "note": "芝士番薯 PR #9"}


# ============ 绘图指令生成 (核心) ============

@app.post("/api/generate", response_model=GenerateResponse)
async def generate_instructions(req: GenerateRequest):
    text = req.text.strip()
    if not text:
        return GenerateResponse(reply="请说点什么吧", instructions=[], source="local")

    # 0. 收集已有对象 ID（用于 target 存在性校验）
    existing_ids: set[str] = set()
    for cell in req.canvas_state.grid.cells:
        for obj in cell.objects:
            existing_ids.add(obj.id)

    # 1. 尝试本地规则（芝士番薯）
    if is_local_command(text):
        result = match_rules(text)
        if result:
            instructions = result.get("instructions", [])
            safe = validate_instructions(instructions, existing_ids)
            return GenerateResponse(
                reply=result.get("reply", "好的"),
                instructions=safe,
                source="local",
            )

    # 2. LLM 调用（月栖白）
    grid_json = json.dumps(req.canvas_state.grid.model_dump(), ensure_ascii=False)
    last_action_str = req.last_action.reply if req.last_action else "无"

    raw_output = None
    llm_error = None
    try:
        result = await call_llm(text, grid_json, last_action_str)
        raw_output = json.dumps(result, ensure_ascii=False)
    except Exception as e:
        llm_error = str(e)
        print(f"[LLM] call failed: {llm_error}")

    # 3. 修复管道（月栖白）
    parsed = None
    if raw_output:
        parsed, repair_err = repair_pipeline(raw_output)
        if repair_err:
            print(f"[Repair] {repair_err}")

    # 4. 提取 + 校验（月栖白）
    instructions_raw = parsed.get("instructions", []) if parsed else []
    reply = parsed.get("reply", "") if parsed else ""
    safe = validate_instructions(instructions_raw, existing_ids)

    # 5. LLM 完全失败 → 规则兜底
    if not safe:
        result = match_rules(text)
        if result:
            return GenerateResponse(
                reply=result.get("reply", "好的"),
                instructions=result.get("instructions", []),
                source="local",
            )
        # 全部失败
        return GenerateResponse(
            reply=reply or "抱歉，我没有理解那个操作，请再说一遍",
            instructions=[],
            source="llm",
        )

    return GenerateResponse(reply=reply, instructions=safe, source="llm")


# ============ 启动 ============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
