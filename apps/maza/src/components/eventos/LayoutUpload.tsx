"use client";

import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, Paperclip, X } from "lucide-react";
import type { LayoutAnexo } from "@/lib/eventos/types";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — limite pragmático antes de mover pra Storage

/**
 * Upload múltiplo de PDFs/imagens. Lê cada arquivo como data URL base64
 * e agrega no array `value`. V2: mover pra Supabase Storage e guardar
 * só `storage_path`.
 */
export function LayoutUpload({
  value,
  onChange,
}: {
  value: LayoutAnexo[];
  onChange: (next: LayoutAnexo[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readFile = (file: File): Promise<LayoutAnexo> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () =>
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          data: typeof r.result === "string" ? r.result : "",
        });
      r.onerror = () => reject(new Error("Falha na leitura"));
      r.readAsDataURL(file);
    });

  const handle = async (files: FileList | null) => {
    setError(null);
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    for (const f of list) {
      if (f.size > MAX_FILE_BYTES) {
        setError(`${f.name}: arquivo maior que 5MB`);
        return;
      }
    }
    try {
      const reads = await Promise.all(list.map(readFile));
      onChange([...value, ...reads]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao ler arquivo");
    }
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handle(e.dataTransfer.files);
        }}
        style={{
          width: "100%",
          padding: 32,
          background: "var(--surface-2)",
          border: `2px dashed ${dragging ? "var(--brand)" : "var(--border)"}`,
          borderRadius: 8,
          textAlign: "center",
          cursor: "pointer",
          color: "var(--text-3)",
          transition: "border-color 0.2s",
        }}
      >
        <Paperclip size={28} style={{ marginBottom: 8 }} />
        <div style={{ fontSize: 13, color: "var(--text-2)" }}>
          Clique para anexar ou arraste o arquivo aqui
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
          PDF, JPG ou PNG — até 5MB cada — múltiplos arquivos permitidos
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        onChange={(e) => {
          void handle(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
        style={{ display: "none" }}
      />

      {error && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 12px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 6,
            color: "var(--destructive)",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {value.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text-3)",
              marginBottom: 8,
            }}
          >
            Arquivos anexados
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {value.map((f, i) => {
              const isImg = f.type.startsWith("image/");
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "10px 14px",
                    minWidth: 200,
                    maxWidth: 280,
                  }}
                >
                  {isImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.data}
                      alt={f.name}
                      style={{
                        width: 36,
                        height: 36,
                        objectFit: "cover",
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        color: "var(--text-3)",
                      }}
                    >
                      {f.type === "application/pdf" ? (
                        <FileText size={24} />
                      ) : (
                        <ImageIcon size={24} />
                      )}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {f.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {f.type === "application/pdf" ? "PDF" : "Imagem"} —{" "}
                      {(f.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-3)",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                    aria-label="Remover anexo"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
