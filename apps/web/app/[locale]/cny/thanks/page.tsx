"use client";

export default function CNYThanks() {
  return (
    <div className="cny-page cny-page-2">
      {/* Thank you content */}
      <div
        className="cny-content"
        style={{
          position: "absolute",
          top: "15%",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
          padding: "0 24px",
        }}
      >
        <h1
          className="cny-heading cny-heading-red cny-thankyou"
          style={{
            fontSize: "clamp(2.5rem, 12vw, 4rem)",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          THANK YOU!!
        </h1>

        <p
          className="cny-subheading"
          style={{
            fontSize: "clamp(1.1rem, 5vw, 1.5rem)",
            color: "#910C1E",
            maxWidth: "300px",
            animationDelay: "0.3s",
          }}
        >
          We'll see you on
          <br />
          <strong>Friday, February 20th!</strong>
        </p>

        <div
          style={{
            marginTop: "20px",
            fontSize: "3rem",
            animation: "bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.6s forwards",
            opacity: 0,
          }}
        >
          🐎
        </div>
      </div>
    </div>
  );
}
