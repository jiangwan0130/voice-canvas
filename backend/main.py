"""
FastAPI 入口 — 语绘 Voice Canvas 后端
PR #9 芝士番薯: ASR + 路由 + 本地规则引擎
PR #9 月栖白: LLM 客户端 + JSON 修复 + 安全校验
"""
import json
import logging
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import CANVAS_WIDTH, CANVAS_HEIGHT, GRID_COLS, GRID_ROWS, GRID_LABELS, ALLOWED_ORIGINS
from llm_client import call_llm
from json_repair import repair_pipeline
from command_parser import validate_instructions
from asr.paraformer_asr import ParaformerASR
from router import route

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# 速率限制器
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="语绘 Voice Canvas API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 音频上传大小上限
MAX_AUDIO_SIZE = 10 * 1024 * 1024  # 10 MB

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ 服务实例 ============

paraformer_asr = ParaformerASR()


# ============ Pydantic Models ============

class GridObject(BaseModel):
    id: str
    label: str
    type: str
    role: Optional[str] = None
    groupId: Optional[str] = None
    cellId: Optional[str] = None
    cx: Optional[float] = None
    cy: Optional[float] = None
    r: Optional[float] = None
    x: Optional[float] = None
    y: Optional[float] = None
    w: Optional[float] = None
    h: Optional[float] = None
    x1: Optional[float] = None
    y1: Optional[float] = None
    x2: Optional[float] = None
    y2: Optional[float] = None
    fill: Optional[str] = None
    color: Optional[str] = None
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
    user_text: str = ""
    reply: str = ""
    instructions: List[dict] = []

class GenerateRequest(BaseModel):
    text: str
    canvas_state: CanvasState = CanvasState()
    last_action: Optional[LastAction] = None

class GenerateResponse(BaseModel):
    reply: str
    instructions: List[dict]
    source: str  # "local" | "llm"


# ============ Grid State 摘要化 ============

def summarize_grid(grid_state: GridState) -> str:
    """
    将画布网格状态摘要化为 LLM 友好的 JSON。

    设计意图：
    1. 每个 cell 附上 xRange/yRange 坐标锚点，帮助 LLM 做空间推理
    2. 对象只保留关键字段（id/label/type/位置/尺寸/颜色），
       去掉 points 数组、渐变定义、画笔参数等噪音字段
    3. 相比直接 model_dump()，减少约 60-70% token 消耗
    """
    cell_w = CANVAS_WIDTH / GRID_COLS
    cell_h = CANVAS_HEIGHT / GRID_ROWS

    cells_summary = []
    for cell in grid_state.cells:
        if not cell.id or ',' not in cell.id:
            continue
        r_str, c_str = cell.id.split(',', 1)
        try:
            r, c = int(r_str), int(c_str)
        except ValueError:
            continue

        x_range = [int(c * cell_w), int((c + 1) * cell_w)]
        y_range = [int(r * cell_h), int((r + 1) * cell_h)]

        objects_summary = []
        for obj in cell.objects:
            entry: dict = {
                "id": obj.id,
                "label": obj.label,
                "type": obj.type,
            }
            # 语义角色（仅非空时发送）
            if obj.role:
                entry["role"] = obj.role
            if obj.groupId:
                entry["groupId"] = obj.groupId
            # 位置 — 取最相关的坐标
            if obj.cx is not None:
                entry["cx"] = obj.cx
            if obj.cy is not None:
                entry["cy"] = obj.cy
            if obj.x is not None:
                entry["x"] = obj.x
            if obj.y is not None:
                entry["y"] = obj.y
            # 尺寸 — 帮助 LLM 判断"旁边"的距离
            if obj.r is not None:
                entry["r"] = obj.r
            if obj.w is not None:
                entry["w"] = obj.w
            if obj.h is not None:
                entry["h"] = obj.h
            if obj.rx is not None:
                entry["rx"] = obj.rx
            if obj.ry is not None:
                entry["ry"] = obj.ry
            # 颜色 — 仅发送有意义的填充色（跳过透明/空字符串）
            if obj.fill and obj.fill != "transparent":
                entry["fill"] = obj.fill
            if obj.stroke and obj.stroke != "transparent":
                entry["stroke"] = obj.stroke

            objects_summary.append(entry)

        cells_summary.append({
            "id": cell.id,
            "label": GRID_LABELS.get(cell.id, cell.id),
            "xRange": x_range,
            "yRange": y_range,
            "objects": objects_summary,
        })

    return json.dumps({"cells": cells_summary}, ensure_ascii=False)


# ============ Health ============

@app.get("/health")
def health():
    return {"status": "ok"}


# ============ 语音识别 (芝士番薯) ============

@app.post("/api/asr")
@limiter.limit("20/minute")
async def transcribe_audio(request: Request, audio: UploadFile = File(...)):
    """
    阿里云 Paraformer 语音识别。
    失败时返回 error + fallback: webspeech，前端降级 Web Speech API。
    """
    try:
        audio_data = await audio.read()
        if not audio_data:
            raise HTTPException(400, "音频数据为空")
        if len(audio_data) > MAX_AUDIO_SIZE:
            raise HTTPException(413, f"音频文件过大，最大支持 {MAX_AUDIO_SIZE // (1024*1024)}MB")
        text = await paraformer_asr.transcribe(audio_data)
        if not text:
            return {"text": "", "source": "paraformer", "note": "识别结果为空"}
        return {"text": text, "source": "paraformer"}
    except HTTPException:
        raise
    except Exception as e:
        return {"text": "", "source": "error", "error": str(e), "fallback": "webspeech"}


# ============ 绘图指令生成 (协作) ============

@app.post("/api/generate", response_model=GenerateResponse)
@limiter.limit("10/minute")
async def generate_instructions(request: Request, req: GenerateRequest):
    text = req.text.strip()
    if not text:
        return GenerateResponse(reply="请说点什么吧", instructions=[], source="local")

    # 0. 收集已有对象 ID（用于 target 存在性校验）
    existing_ids: set[str] = set()
    for cell in req.canvas_state.grid.cells:
        for obj in cell.objects:
            existing_ids.add(obj.id)

    # 1. 本地规则引擎 (芝士番薯)
    local_result = route(text)
    if local_result["source"] == "local":
        instructions = local_result.get("instructions", [])
        safe = validate_instructions(instructions, existing_ids)
        return GenerateResponse(
            reply=local_result.get("reply", "好的"),
            instructions=safe,
            source="local",
        )

    # 2. LLM 调用 (月栖白)
    grid_json = summarize_grid(req.canvas_state.grid)
    if req.last_action and (req.last_action.user_text or req.last_action.reply):
        parts = [
            f"用户说: \"{req.last_action.user_text}\"",
            f"助手回复: \"{req.last_action.reply}\"",
        ]
        if req.last_action.instructions:
            # 摘要上一轮指令（只传 action+关键参数, 减少token）
            brief = []
            for inst in req.last_action.instructions[:10]:  # 最多10条
                a = inst.get("action", "")
                if a in ("setColor","setWidth","setBrush","clear","undo","wait"):
                    continue  # 跳过控制指令
                label = inst.get("label", "") or ""
                brief.append(f"{a}" + (f"({label})" if label else ""))
            if brief:
                parts.append(f"上一轮画了: {', '.join(brief)}")
        last_action_str = "\n".join(parts)
    else:
        last_action_str = "无"

    raw_output = None
    try:
        result = await call_llm(text, grid_json, last_action_str)
        raw_output = json.dumps(result, ensure_ascii=False)
        logger.info(f"LLM success: '{text[:60]}' → {len(result.get('instructions', []))} instructions, reply='{result.get('reply', '')[:40]}'")
    except Exception as e:
        logger.error(f"LLM call failed: {e}")

    # 3. 修复管道 (月栖白)
    parsed = None
    if raw_output:
        parsed, repair_err = repair_pipeline(raw_output)
        if repair_err:
            logger.warning(f"JSON repair: {repair_err}")

    # 4. 提取 + 校验 (月栖白)
    instructions_raw = parsed.get("instructions", []) if parsed else []
    reply = parsed.get("reply", "") if parsed else ""
    safe = validate_instructions(instructions_raw, existing_ids)
    logger.info(f"instructions raw={len(instructions_raw)} safe={len(safe)}; dropped={len(instructions_raw) - len(safe)}")

    # 5. LLM 完全失败 → 友好提示
    if not safe:
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
