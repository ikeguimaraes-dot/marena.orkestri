export type SkeletonVariant = "table" | "cards" | "form";

function Bone({ w, h = 14, radius = 6 }: { w?: string | number; h?: number; radius?: number }) {
  return (
    <div
      className="skeleton"
      style={{ width: w ?? "100%", height: h, borderRadius: radius }}
    />
  );
}

function TableSkeleton() {
  const cols = [28, 18, 14, 14, 18, 8] as const;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid var(--border-soft)",
        }}
      >
        {cols.map((w, i) => (
          <Bone key={i} w={`${w}%`} h={11} />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 12,
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-soft)",
            opacity: 1 - i * 0.09,
          }}
        >
          {cols.map((w, j) => (
            <Bone key={j} w={`${w}%`} h={11} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 12,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: 20,
            borderRadius: 12,
            background: "var(--surface)",
            border: "1px solid var(--border-soft)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <Bone h={14} w="55%" />
          <Bone h={32} w="80%" radius={8} />
          <Bone h={11} w="40%" />
        </div>
      ))}
    </div>
  );
}

function FormSkeleton() {
  return (
    <div
      style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 20 }}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Bone h={11} w="28%" />
          <Bone h={38} radius={8} />
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <Bone h={36} w={120} radius={8} />
        <Bone h={36} w={88} radius={8} />
      </div>
    </div>
  );
}

export function SkeletonPage({ variant = "table" }: { variant?: SkeletonVariant }) {
  return (
    <div
      style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <Bone h={22} w={200} />
        <Bone h={34} w={108} radius={8} />
      </div>
      {variant === "table" && <TableSkeleton />}
      {variant === "cards" && <CardsSkeleton />}
      {variant === "form" && <FormSkeleton />}
    </div>
  );
}
