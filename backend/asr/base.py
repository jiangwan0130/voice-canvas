"""ASR 抽象接口 — PR #9 芝士番薯"""
from abc import ABC, abstractmethod


class ASRProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_data: bytes) -> str:
        """返回转写文本"""
        ...
