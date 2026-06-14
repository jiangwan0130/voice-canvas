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
  const res = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, canvas_state: canvasState, conversation_history: conversationHistory }),
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
