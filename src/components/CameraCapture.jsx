import React, { useRef, useState, useEffect } from "react";
import { Camera, ImagePlus, RotateCcw, Check, AlertCircle } from "lucide-react";

export default function CameraCapture({ handLabel, onValidated }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setCameraReady(true);
      }
    } catch (e) {
      setError("Caméra indisponible. Vous pouvez importer une photo depuis votre galerie.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth || 1024;
    c.height = v.videoHeight || 1024;
    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0, c.width, c.height);
    setPreview(c.toDataURL("image/jpeg", 0.92));
    stopCamera();
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(f);
    stopCamera();
  };

  const validate = async () => {
    if (!preview) return;
    const res = await fetch(preview);
    const blob = await res.blob();
    onValidated(blob);
  };

  const retake = () => {
    setPreview(null);
    startCamera();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden bg-black/60 border border-border/60">
        {!preview ? (
          <>
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            {/* Palm guide overlay */}
            <svg viewBox="0 0 100 130" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 w-full h-full pointer-events-none opacity-70">
              <path
                d="M50 12 C40 12 36 22 36 30 C36 34 34 36 32 36 C28 36 26 30 24 30 C20 30 18 38 22 42 C24 44 24 46 22 48 C18 48 16 44 14 46 C12 48 14 54 18 56 L40 78 C42 82 42 88 42 96 C42 108 48 120 56 120 C68 120 76 110 78 98 L82 60 C84 48 80 40 72 38 C66 36 62 30 60 24 C58 18 56 12 50 12 Z"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="1.2"
                strokeDasharray="3 2"
              />
            </svg>
            <div className="absolute top-3 left-3 right-3 text-center text-[11px] text-primary/90 bg-background/50 rounded-full px-3 py-1 backdrop-blur">
              {handLabel}
            </div>
          </>
        ) : (
          <img src={preview} alt="aperçu" className="w-full h-full object-cover" />
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 max-w-sm">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!preview ? (
        <div className="flex flex-col items-center gap-3 w-full max-w-sm">
          <ul className="text-[12px] text-muted-foreground space-y-1 text-center leading-relaxed">
            <li>Placez votre paume face à l'objectif.</li>
            <li>Gardez les doigts légèrement écartés.</li>
            <li>Photographiez sous une lumière suffisante.</li>
            <li>Assurez-vous que toute la paume est visible.</li>
          </ul>
          <div className="flex gap-3 w-full">
            <button
              onClick={capture}
              disabled={!cameraReady}
              className="btn-gold flex-1 flex items-center justify-center gap-2 py-3 disabled:opacity-40"
            >
              <Camera size={18} /> Capturer
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="btn-ghost-gold flex-1 flex items-center justify-center gap-2 py-3"
            >
              <ImagePlus size={18} /> Galerie
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      ) : (
        <div className="flex gap-3 w-full max-w-sm">
          <button onClick={retake} className="btn-ghost-gold flex-1 flex items-center justify-center gap-2 py-3">
            <RotateCcw size={18} /> Recommencer
          </button>
          <button onClick={validate} className="btn-gold flex-1 flex items-center justify-center gap-2 py-3">
            <Check size={18} /> Valider cette photo
          </button>
        </div>
      )}
    </div>
  );
}