// ============================================================
// app/loading.tsx
// Global loading boundary — shows a subtle skeleton while
// the page content is being fetched or rendered.
// ============================================================

export default function Loading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-page)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        transition: "background-color 0.2s ease",
      }}
    >
      <div
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          animation: "fadeIn 0.2s ease forwards",
        }}
      >
        {/* Spinner */}
        <div style={{ position: "relative", width: 48, height: 48 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "4px solid var(--bg-elevated)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "4px solid var(--primary)",
              borderTopColor: "transparent",
              animation: "spin 0.7s linear infinite",
            }}
          />
        </div>

        {/* Label */}
        <p
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--text-secondary)",
            margin: 0,
          }}
        >
          Loading…
        </p>
      </div>

      {/* Inject keyframes — these are already in globals.css but in case they're not loaded yet */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}
