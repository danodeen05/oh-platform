"use client";

export default function CNYThanks() {
  return (
    <div className="cny-page cny-page-2">
      {/* Thank you content */}
      <div
        className="cny-content"
        style={{
          position: "absolute",
          top: "14%",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          padding: "0 24px",
        }}
      >
        <h1
          className="cny-heading cny-heading-red cny-thankyou"
          style={{
            fontSize: "clamp(1.5rem, 7vw, 2.4rem)",
            lineHeight: 1.1,
            margin: 0,
            background: "rgba(215, 182, 110, 0.5)",
            padding: "10px 20px",
            borderRadius: "12px",
            whiteSpace: "nowrap",
          }}
        >
          THANK YOU!!
        </h1>

        <div
          className="cny-subheading"
          style={{
            fontSize: "clamp(1.1rem, 4.5vw, 1.5rem)",
            fontWeight: 700,
            color: "#D7B66E",
            maxWidth: "300px",
            animationDelay: "0.3s",
            background: "rgba(145, 12, 30, 0.85)",
            padding: "12px 20px",
            borderRadius: "12px",
            textAlign: "center",
            lineHeight: 1.3,
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          }}
        >
          We'll see you on
          <br />
          <strong>Friday, February 20th!</strong>
        </div>

        <img
          src="/cny/horse.svg"
          alt="Year of the Horse"
          className="cny-horse-red"
          style={{
            marginTop: "8px",
            width: "clamp(275px, 81vw, 500px)",
            maxWidth: "85vw",
            height: "auto",
            animation: "bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.6s forwards",
            opacity: 0,
          }}
        />

        <a
          href="/en/cny"
          className="cny-button cny-button-red"
          style={{
            marginTop: "8px",
            textDecoration: "none",
            fontSize: "0.9rem",
            padding: "12px 24px",
          }}
        >
          RSVP for Someone Else
        </a>
      </div>
    </div>
  );
}
