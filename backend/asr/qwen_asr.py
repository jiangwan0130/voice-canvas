"""Qwen-ASR 扩展占位 — 后续增强"""
from .base import ASRProvider


class QwenASR(ASRProvider):
    async def transcribe(self, audio_data: bytes) -> str:
        return ""
