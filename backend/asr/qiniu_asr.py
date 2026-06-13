"""七牛云短语音听写 — PR #9 芝士番薯"""
from .base import ASRProvider


class QiniuASR(ASRProvider):
    async def transcribe(self, audio_data: bytes) -> str:
        """TODO PR #9: 七牛云 ASR API 调用"""
        return ""
