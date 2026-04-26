/**
 * audioCapture.ts
 * MediaRecorder abstraction that ensures every segment is a valid standalone media file.
 */

type OnChunkCallback = (blob: Blob) => void;

let mediaRecorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let chunkBuffer: Blob[] = [];
let onChunkCb: OnChunkCallback | null = null;
let activeMimeType = 'audio/webm';
let captureActive = false;
let currentIntervalMs = 2000;
let stopTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

function getBestMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return 'audio/webm';
}

export async function startCapture(
  onChunk: OnChunkCallback,
  intervalMs: number = 2000
): Promise<void> {
  if (captureActive) return;

  onChunkCb = onChunk;
  currentIntervalMs = intervalMs;
  captureActive = true;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err: unknown) {
    captureActive = false;
    const error = err as DOMException;
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      throw new Error('Microphone access denied. Please allow mic access in settings.');
    }
    throw new Error(`Microphone error: ${error.message}`);
  }

  _initRecorder();
}

function _initRecorder() {
  if (!captureActive || !stream) return;

  const mimeType = getBestMimeType();

  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType });
  } catch {
    mediaRecorder = new MediaRecorder(stream);
  }

  activeMimeType = mediaRecorder.mimeType;
  chunkBuffer = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunkBuffer.push(e.data);
    }
  };

  mediaRecorder.onerror = (e) => {
    console.error(`[audioCapture] MediaRecorder error: ${e.error}`);
    chunkBuffer = [];
    if (captureActive) {
      setTimeout(_initRecorder, 200);
    }
  };

  mediaRecorder.onstop = () => {
    if (chunkBuffer.length > 0) {
      const blob = new Blob(chunkBuffer, { type: activeMimeType });
      onChunkCb?.(blob);
      chunkBuffer = [];
    }
    
    // Clear any existing timeout to prevent double-stops
    if (stopTimeoutHandle) {
      clearTimeout(stopTimeoutHandle);
      stopTimeoutHandle = null;
    }

    // Restart if we are still supposed to be capturing
    if (captureActive) {
      setTimeout(() => _initRecorder(), 50); // slight gap for browser stability
    }
  };

  const timeslice = Math.max(500, Math.floor(currentIntervalMs / 2));
  mediaRecorder.start(timeslice);

  // Schedule the next stop
  stopTimeoutHandle = setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }, currentIntervalMs);
}

export function stopCapture(): void {
  captureActive = false;
  if (stopTimeoutHandle) {
    clearTimeout(stopTimeoutHandle);
    stopTimeoutHandle = null;
  }
  chunkBuffer.splice(0);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  mediaRecorder = null;
}

export function flushBuffer(): void {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.requestData();
    mediaRecorder.stop();
  }
}

export function isCapturing(): boolean {
  return captureActive;
}
