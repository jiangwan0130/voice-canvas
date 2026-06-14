"""环境变量配置 — 所有敏感值从 .env 读取，不写入代码"""
import os
from dotenv import load_dotenv

load_dotenv()

# 阿里云百炼 ASR（Paraformer）
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")

# DeepSeek 官方直连（platform.deepseek.com 获取 API Key）
# deepseek-v3 / deepseek-chat 将于 2026/07/24 停用，默认使用 v4-flash
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_API_BASE = os.getenv("LLM_API_BASE", "https://api.deepseek.com/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek-v4-flash")

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
