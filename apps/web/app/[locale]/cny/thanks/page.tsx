"use client";

export default function CNYThanks() {
  return (
    <div className="cny-page cny-page-2">
      {/* Thank you content */}
      <div
        className="cny-content"
        style={{
          position: "absolute",
          top: "22%",
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
            background: "rgba(215, 182, 110, 0.5)",
            padding: "16px 32px",
            borderRadius: "16px",
          }}
        >
          THANK YOU!!
        </h1>

        <div
          className="cny-subheading"
          style={{
            fontSize: "clamp(1.8rem, 7vw, 2.5rem)",
            fontWeight: 700,
            color: "#D7B66E",
            maxWidth: "350px",
            animationDelay: "0.3s",
            background: "rgba(145, 12, 30, 0.85)",
            padding: "20px 32px",
            borderRadius: "16px",
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
            marginTop: "20px",
            width: "clamp(345px, 92vw, 575px)",
            maxWidth: "95vw",
            height: "auto",
            animation: "bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.6s forwards",
            opacity: 0,
          }}
        />

        <a
          href="/en/cny"
          className="cny-button cny-button-red"
          style={{
            marginTop: "16px",
            textDecoration: "none",
          }}
        >
          RSVP for Someone Else
        </a>
      </div>
    </div>
  );
}
