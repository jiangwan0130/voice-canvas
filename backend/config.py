"""环境变量配置 — 所有敏感值从 .env 读取，不写入代码"""
import os
from dotenv import load_dotenv

load_dotenv()

# 七牛云 ASR
QINIU_ASR_APP_ID = os.getenv("QINIU_ASR_APP_ID", "")
QINIU_ASR_SECRET_KEY = os.getenv("QINIU_ASR_SECRET_KEY", "")

# DeepSeek via 七牛云 MaaS
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_API_BASE = os.getenv("LLM_API_BASE", "https://api.qnaigc.com/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek-v3")

# Canvas
CANVAS_WIDTH = 1200
CANVAS_HEIGHT = 800
