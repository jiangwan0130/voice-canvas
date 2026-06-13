"""七牛云短语音听写 — PR #9 芝士番薯"""
import base64
import hashlib
import hmac
import json
import time
from .base import ASRProvider
from config import QINIU_ASR_APP_ID, QINIU_ASR_SECRET_KEY

# 短语音听写 API
ASR_ENDPOINT = "http://yitu-audio.qiniuapi.com/v2/asr"


class QiniuASR(ASRProvider):
    """七牛云短语音听写，≤60 秒音频"""

    def __init__(self):
        self.access_key = QINIU_ASR_APP_ID
        self.secret_key = QINIU_ASR_SECRET_KEY

    async def transcribe(self, audio_data: bytes) -> str:
        """上传音频 → 返回转写文本"""
        import httpx

        # 音频 base64 编码
        audio_b64 = base64.b64encode(audio_data).decode("utf-8")

        # 生成管理 token（鉴权签名）
        token = self._gen_token()

        body = {
            "audioBase64": audio_b64,
            "lang": "MANDARIN",
            "scene": "GENERAL",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                ASR_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()

            # 七牛云短语音听写返回格式: {"result": {"text": "..."}, ...}
            if isinstance(data, dict):
                result = data.get("result", {})
                if isinstance(result, dict):
                    return result.get("text", "")
                return data.get("text", "")
            return str(data)

    def _gen_token(self) -> str:
        """生成七牛云管理 token（HMAC-SHA1 签名）"""
        # 签名 URL（不含参数）
        signing_url = ASR_ENDPOINT

        # 签名参数
        access_key = self.access_key
        secret_key = self.secret_key

        # 生成 token
        # 格式: <AccessKey>:<EncodedSign>
        sign = hmac.new(
            secret_key.encode("utf-8"),
            signing_url.encode("utf-8"),
            hashlib.sha1,
        ).digest()
        encoded_sign = base64.urlsafe_b64encode(sign).decode("utf-8").rstrip("=")

        return f"{access_key}:{encoded_sign}"
