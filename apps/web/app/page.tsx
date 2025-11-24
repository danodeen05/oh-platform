import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        color: "white",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "3.5rem",
          fontWeight: "bold",
          marginBottom: "16px",
          textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
        }}
      >
        哦 Oh! Beef Noodle Soup
      </h1>

      <p
        style={{
          fontSize: "1.25rem",
          marginBottom: "48px",
          maxWidth: "600px",
          lineHeight: "1.6",
        }}
      >
        Order ahead. Skip the wait. Enjoy premium beef noodles in private dining
        cubicles.
      </p>

      <Link
        href="/order"
        style={{
          padding: "20px 48px",
          fontSize: "1.25rem",
          fontWeight: "bold",
          background: "white",
          color: "#667eea",
          borderRadius: "12px",
          textDecoration: "none",
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          transition: "transform 0.2s",
          display: "inline-block",
        }}
      >
        Order Now →
      </Link>

      <div
        style={{
          marginTop: "64px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "32px",
          maxWidth: "800px",
          width: "100%",
        }}
      >
        <div>
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🍜</div>
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
            30-Year Recipe
          </div>
          <div style={{ fontSize: "0.9rem", opacity: 0.9 }}>
            Perfected beef noodle soup
          </div>
        </div>
        <div>
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🥩</div>
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
            Premium Beef
          </div>
          <div style={{ fontSize: "0.9rem", opacity: 0.9 }}>
            A5 Wagyu available
          </div>
        </div>
        <div>
          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🚀</div>
          <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
            Tech-First
          </div>
          <div style={{ fontSize: "0.9rem", opacity: 0.9 }}>
            Order ahead, earn rewards
          </div>
        </div>
      </div>
    </main>
  );
}
