/** API 通信层 — PR #10 月栖白 */
import type { DrawInstruction, CanvasState, ConversationTurn } from '../types/commands';

const BASE = '/api';

export async function transcribeAudio(audioBlob: Blob): Promise<{ text: string; source: string; fallback?: string }> {
  const form = new FormData();
  form.append('audio', audioBlob, 'recording.webm');
  const res = await fetch(`${BASE}/asr`, { method: 'POST', body: form });
  return res.json();
}

export async function generateInstructions(
  text: string,
  canvasState: CanvasState,
  conversationHistory: ConversationTurn[],
): Promise<{ reply: string; instructions: DrawInstruction[]; source: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300_000);
  const body = JSON.stringify({ text, canvas_state: canvasState, conversation_history: conversationHistory });
  console.log('[API] Request body size:', body.length, 'bytes');
  const res = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  if (!res.ok) {
    const errText = await res.text();
    console.error('[API] 422/500 response:', errText.slice(0, 300));
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

/** 视觉自验证：截图发给 Qwen3.7 多模态模型检查绘图质量 */
export async function visualVerify(
  imageBase64: string,
  expectedPrompt: string,
): Promise<{ feedback: string; ok: boolean }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);
  const res = await fetch(`${BASE}/visual-verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64: imageBase64, expected_prompt: expectedPrompt }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  if (!res.ok) {
    console.error('[API] visual-verify failed:', res.status);
    return { feedback: '', ok: false };
  }
  return res.json();
}
