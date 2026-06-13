import { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import "./Scanner.css";

interface ScannerProps {
  /** Fired once per accepted decode with the raw symbol payload. */
  onDetected: (raw: string) => void;
  /** Paused while a result is being reviewed so the camera stops re-firing. */
  paused?: boolean;
}

// Formats found on pharmaceutical packaging. DataMatrix is the dominant 2D
// symbology; GS1-128 (Code 128) covers older linear labels.
const FORMATS = [
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.CODE_128,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.EAN_13,
];

function buildReader(): BrowserMultiFormatReader {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
}

type CameraState = "starting" | "live" | "denied" | "error";

export function Scanner({ onDetected, paused }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastHit = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const [state, setState] = useState<CameraState>("starting");
  const [torchOn, setTorchOn] = useState(false);
  const [canTorch, setCanTorch] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const reader = buildReader();

    async function start() {
      try {
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          videoRef.current!,
          (result) => {
            if (!result) return;
            const text = result.getText();
            const now = Date.now();
            // De-duplicate the same symbol within a short window.
            if (text === lastHit.current.text && now - lastHit.current.at < 1500) return;
            lastHit.current = { text, at: now };
            if (navigator.vibrate) navigator.vibrate(35);
            onDetected(text);
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setState("live");
        detectTorch();
      } catch (err) {
        if (cancelled) return;
        const denied =
          err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "SecurityError");
        setState(denied ? "denied" : "error");
      }
    }

    function detectTorch() {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks?.()[0];
      const caps = track?.getCapabilities?.() as MediaTrackCapabilities | undefined;
      setCanTorch(Boolean(caps && "torch" in caps));
    }

    start();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onDetected]);

  // Stop/resume the analyser while a result card is shown.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else void video.play().catch(() => {});
  }, [paused]);

  async function toggleTorch() {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setCanTorch(false);
    }
  }

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner-video" muted playsInline />
      <div className="scanner-overlay">
        <div className={`reticle ${paused ? "reticle-locked" : ""}`}>
          <span className="corner tl" />
          <span className="corner tr" />
          <span className="corner bl" />
          <span className="corner br" />
          {!paused && state === "live" && <span className="scanline" />}
        </div>
        <p className="scanner-hint">
          {state === "live" && !paused && "Point at the GS1 DataMatrix or barcode"}
          {paused && "Captured"}
          {state === "starting" && "Starting camera…"}
        </p>
      </div>

      {canTorch && state === "live" && (
        <button className={`torch ${torchOn ? "torch-on" : ""}`} onClick={toggleTorch}>
          {torchOn ? "Torch on" : "Torch"}
        </button>
      )}

      {(state === "denied" || state === "error") && (
        <div className="scanner-fallback">
          <p className="scanner-fallback-title">
            {state === "denied" ? "Camera access blocked" : "Camera unavailable"}
          </p>
          <p className="muted">
            {state === "denied"
              ? "Allow camera access in your browser, or enter the barcode manually below."
              : "We couldn't start the camera. Enter the barcode manually below."}
          </p>
        </div>
      )}
    </div>
  );
}
