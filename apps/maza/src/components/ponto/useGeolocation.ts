"use client";

import { useCallback, useEffect, useState } from "react";

export type GeoState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "ok"; lat: number; lng: number; accuracy: number }
  | { status: "error"; message: string };

/**
 * Hook que pede geolocalização sob demanda. Não bloqueia o ponto se falhar
 * — caller continua e registra punch sem coordenadas.
 *
 * Timeout default 10s. Não usa watchPosition (uma leitura por punch basta).
 */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: "idle" });

  const request = useCallback((): Promise<GeoState> => {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        const next: GeoState = {
          status: "error",
          message: "Geolocalização não disponível neste dispositivo",
        };
        setState(next);
        resolve(next);
        return;
      }
      setState({ status: "requesting" });
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next: GeoState = {
            status: "ok",
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          setState(next);
          resolve(next);
        },
        (err) => {
          const msg =
            err.code === err.PERMISSION_DENIED
              ? "Permissão de localização negada"
              : err.code === err.TIMEOUT
                ? "Timeout obtendo localização"
                : err.message;
          const next: GeoState = { status: "error", message: msg };
          setState(next);
          resolve(next);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      );
    });
  }, []);

  return { state, request };
}

/** Lê navigator.userAgent só no client (evita hydration mismatch). */
export function useDeviceInfo(): string | null {
  const [ua, setUa] = useState<string | null>(null);
  useEffect(() => {
    // setState em useEffect é necessário aqui — não dá pra ler navigator
    // durante render no servidor (causaria hydration mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (typeof navigator !== "undefined") setUa(navigator.userAgent);
  }, []);
  return ua;
}
