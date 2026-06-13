"""Qwen-ASR placeholder — reserved for future ASR provider expansion"""
from .base import ASRProvider


class QwenASR(ASRProvider):
    """Stub: not yet implemented. Raise to make callers aware."""
    async def transcribe(self, audio_data: bytes) -> str:
        raise NotImplementedError("QwenASR not yet integrated")
