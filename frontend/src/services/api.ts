/** API 通信层 — PR #10 月栖白 */
import type { DrawInstruction, CanvasState, LastAction } from '../types/commands';

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
  lastAction: LastAction | null,
): Promise<{ reply: string; instructions: DrawInstruction[]; source: string }> {
  const res = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, canvas_state: canvasState, last_action: lastAction }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
