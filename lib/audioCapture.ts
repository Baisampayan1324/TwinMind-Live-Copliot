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
let currentIntervalMs = 30000;
let stopTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

export async function startCapture(
  onChunk: OnChunkCallback,
  intervalMs: number = 30000
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

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';

  mediaRecorder = new MediaRecorder(stream, { mimeType });
  activeMimeType = mediaRecorder.mimeType;
  chunkBuffer = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunkBuffer.push(e.data);
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

  mediaRecorder.start();

  // Schedule the next stop
  stopTimeoutHandle = setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }, currentIntervalMs);
}

export function stopCapture(): Blob | null {
  captureActive = false;
  if (stopTimeoutHandle) {
    clearTimeout(stopTimeoutHandle);
    stopTimeoutHandle = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  const remaining = chunkBuffer.length > 0 ? new Blob(chunkBuffer, { type: activeMimeType }) : null;
  chunkBuffer = [];
  mediaRecorder = null;
  return remaining;
}

export function flushBuffer(): Blob | null {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop(); // Triggers onstop -> onChunkCb
  }
  return null;
}

export function isCapturing(): boolean {
  return captureActive;
}
