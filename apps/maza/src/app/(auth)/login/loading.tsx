export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #111110)",
      }}
    >
      <div
        className="skeleton"
        style={{ width: 360, height: 420, borderRadius: 16 }}
      />
    </div>
  );
}
