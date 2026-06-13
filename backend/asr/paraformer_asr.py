"""阿里云 Paraformer 录音文件识别 ASR 实现

使用阿里云百炼平台的 paraformer-realtime-v2 模型。
接口文档: https://help.aliyun.com/zh/model-studio/paraformer-asr
"""
import base64
import httpx
from .base import ASRProvider
from config import DASHSCOPE_API_KEY

# 阿里云百炼 ASR REST 接口
ASR_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription"


class ParaformerASR(ASRProvider):
    """阿里云 Paraformer 语音识别（paraformer-realtime-v2）"""

    def __init__(self):
        self.api_key = DASHSCOPE_API_KEY

    async def transcribe(self, audio_data: bytes) -> str:
        """提交音频 → 返回转写文本

        采用同步提交 + 轮询结果的方式（百炼平台标准流程）。
        支持 wav / mp3 / webm / ogg 等格式，最长 60 秒。
        """
        # 1. 提交任务（base64 内联方式）
        audio_b64 = base64.b64encode(audio_data).decode("utf-8")

        payload = {
            "model": "paraformer-realtime-v2",
            "input": {
                "audio_data": f"data:audio/wav;base64,{audio_b64}",
            },
            "parameters": {
                "language_hints": ["zh", "yue"],   # 普通话 + 粤语兜底
            },
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-DashScope-Async": "disable",        # 同步模式，直接返回结果
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(ASR_ENDPOINT, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()

        # 2. 提取识别文本
        # 返回格式: {"output": {"results": [{"text": "..."}]}, ...}
        output = data.get("output", {})
        results = output.get("results", [])
        if results:
            return results[0].get("transcription", "")

        # 兜底：尝试 transcription 字段（部分模型版本）
        return output.get("transcription", "")
