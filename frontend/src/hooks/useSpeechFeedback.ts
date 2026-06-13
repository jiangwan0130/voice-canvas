/** useSpeechFeedback — PR #10 月栖白: 浏览器 TTS */
export function speak(text: string): void {
  if (!text || typeof window === 'undefined') return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN';
  u.rate = 1.0;
  u.pitch = 1.0;
  synth.speak(u);
}
