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
        style={{ width: 340, height: 480, borderRadius: 20 }}
      />
    </div>
  );
}
