"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Check, X } from "lucide-react";

import { Button } from "@maza/ui/button";

/**
 * Modal de câmera selfie. Pede permissão, mostra preview ao vivo, captura
 * em base64 (JPEG, ~80% quality, redimensionado pra 480x480).
 *
 * onCapture(null) é chamado se o user cancelar OU se a câmera não estiver
 * disponível — caller deve seguir o fluxo (registra ponto sem foto).
 */
export function CameraCapture({
  onClose,
  onCapture,
}: {
  onClose: () => void;
  onCapture: (base64: string | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Câmera não suportada");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const size = 480;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Desenha o vídeo cropado em quadrado central
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const min = Math.min(vw, vh);
    const sx = (vw - min) / 2;
    const sy = (vh - min) / 2;
    ctx.drawImage(video, sx, sy, min, min, 0, 0, size, size);
    const base64 = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedBase64(base64);
  };

  const confirm = () => {
    onCapture(capturedBase64);
  };

  const retake = () => setCapturedBase64(null);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.92)",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          width: 40,
          height: 40,
          borderRadius: 99,
          background: "rgba(255,255,255,0.12)",
          color: "white",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label="Fechar"
      >
        <X size={20} />
      </button>

      <div
        style={{
          width: "min(86vw, 380px)",
          aspectRatio: "1 / 1",
          borderRadius: 16,
          overflow: "hidden",
          background: "#000",
          border: "2px solid var(--brand)",
          position: "relative",
        }}
      >
        {error ? (
          <div
            style={{
              height: "100%",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              color: "white",
              textAlign: "center",
              fontSize: 13,
            }}
          >
            <Camera size={28} style={{ opacity: 0.4 }} />
            <strong>Câmera indisponível</strong>
            <span style={{ opacity: 0.7, fontSize: 11 }}>{error}</span>
          </div>
        ) : capturedBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={capturedBase64}
            alt="Foto capturada"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
            }}
          />
        )}
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        {error ? (
          <Button onClick={() => onCapture(null)} variant="outline">
            Continuar sem foto
          </Button>
        ) : capturedBase64 ? (
          <>
            <Button onClick={retake} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Refazer
            </Button>
            <Button onClick={confirm}>
              <Check className="mr-2 h-4 w-4" />
              Confirmar
            </Button>
          </>
        ) : (
          <button
            onClick={capture}
            aria-label="Capturar foto"
            style={{
              width: 70,
              height: 70,
              borderRadius: 99,
              background: "white",
              border: "5px solid var(--brand)",
              cursor: "pointer",
            }}
          />
        )}
      </div>
    </div>
  );
}
