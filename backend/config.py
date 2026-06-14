"""环境变量配置 — 所有敏感值从 .env 读取，不写入代码"""
import os
from dotenv import load_dotenv

load_dotenv()

# 阿里云百炼 ASR（Paraformer）
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")

# Qwen 多模态模型（阿里云百炼 DashScope）
# 文本+图像理解，用于绘图指令生成和视觉自验证
# 模型列表: qwen3-vl-plus / qwen3-vl-max / qwen3.7-plus
LLM_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")  # 与 ASR 共用同一个 Key
LLM_API_BASE = os.getenv("LLM_API_BASE", "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen3-vl-plus")

# CORS
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")

# Canvas
CANVAS_WIDTH = 750
CANVAS_HEIGHT = 500
GRID_COLS = 3
GRID_ROWS = 2

# 网格中文标签（与前端 ObjectStore 保持一致）
GRID_LABELS: dict[str, str] = {
    "0,0": "左上", "0,1": "中上", "0,2": "右上",
    "1,0": "左下", "1,1": "中下", "1,2": "右下",
}
