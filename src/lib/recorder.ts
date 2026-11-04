export interface Recording {
  stop(): void;
  /** 録音を捨てる。onDone は呼ばれない */
  cancel(): void;
}

export function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

function pickMimeType(): string | undefined {
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((type) => MediaRecorder.isTypeSupported(type));
}

/** マイクが使えないときは例外を投げる */
export async function startRecording(onDone: (blob: Blob) => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks: Blob[] = [];
  const mimeType = pickMimeType();
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  let cancelled = false;
  rec.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  rec.onstop = () => {
    stream.getTracks().forEach((track) => track.stop());
    if (!cancelled) onDone(new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/mp4' }));
  };
  rec.start();
  return {
    stop() {
      if (rec.state === 'recording') rec.stop();
    },
    cancel() {
      cancelled = true;
      if (rec.state === 'recording') rec.stop();
    },
  };
}
