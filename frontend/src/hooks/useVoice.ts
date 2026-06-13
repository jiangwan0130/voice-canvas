/** useVoice — MediaRecorder + AnalyserNode VAD */
import { useRef, useCallback, useEffect } from 'react';

export type VoiceStatus = 'idle' | 'recording' | 'transcribing' | 'error';

interface VoiceResult { blob: Blob; webSpeechText: string }

export function useVoice(onResult: (r: VoiceResult) => void, onStatusChange: (s: VoiceStatus) => void) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const webTextRef = useRef('');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafIdRef = useRef<number | null>(null);
  // 用 ref 保存回调，避免闭包捕获过时引用
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onStatusRef = useRef(onStatusChange);
  onStatusRef.current = onStatusChange;

  const cleanup = useCallback(() => {
    if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
  }, []);

  const start = useCallback(async (silenceMs = 2000, maxDuration = 60000) => {
    try {
      cleanup();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // VAD
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        onResultRef.current({ blob: new Blob(chunksRef.current, { type: 'audio/webm' }), webSpeechText: webTextRef.current });
        webTextRef.current = '';
      };
      recorder.onerror = () => onStatusRef.current('error');

      // Web Speech API 备用
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const recog = new SR() as SpeechRecognition;
        recog.continuous = true;
        recog.interimResults = true;
        recog.lang = 'zh-CN';
        recog.onresult = (e: any) => {
          let final = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) final += e.results[i][0].transcript;
          }
          if (final) webTextRef.current = final;
        };
        recog.start();
        recognitionRef.current = recog;
      }

      recorder.start();
      onStatusRef.current('recording');

      const bufferLen = analyser.frequencyBinCount;
      const dataArr = new Uint8Array(bufferLen);
      let silenceStart = 0;
      let hasSound = false;

      const check = () => {
        if (!analyserRef.current || mediaRecorderRef.current?.state !== 'recording') return;
        analyserRef.current.getByteTimeDomainData(dataArr);
        let sum = 0;
        for (let i = 0; i < bufferLen; i++) { const v = (dataArr[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / bufferLen);

        if (rms > 0.02) { hasSound = true; silenceStart = 0; }
        else if (hasSound && Date.now() - (silenceStart || Date.now()) >= silenceMs) { stop(); return; }
        else if (hasSound && !silenceStart) silenceStart = Date.now();

        rafIdRef.current = requestAnimationFrame(check);
      };
      rafIdRef.current = requestAnimationFrame(check);

      maxTimerRef.current = window.setTimeout(() => { if (mediaRecorderRef.current?.state === 'recording') stop(); }, maxDuration);
    } catch { onStatusRef.current('error'); }
  }, [cleanup]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    analyserRef.current = null;
    onStatusRef.current('transcribing');
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return { start, stop };
}
