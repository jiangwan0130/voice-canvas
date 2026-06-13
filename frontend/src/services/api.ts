/** API 通信层 — PR #10 月栖白 */
const BASE = '/api';

export async function transcribe(audioBlob: Blob): Promise<{ text: string; source: string }> {
  // TODO PR #10: POST /api/asr
  return { text: '', source: 'placeholder' };
}

export async function generate(text: string): Promise<{ reply: string; instructions: any[]; source: string }> {
  // TODO PR #10: POST /api/generate
  return { reply: '', instructions: [], source: 'placeholder' };
}
