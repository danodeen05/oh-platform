"use client";

interface ZodiacFortuneProps {
  lookForwardTo: string;
  thingsToAvoid: string;
}

export function ZodiacFortune({
  lookForwardTo,
  thingsToAvoid,
}: ZodiacFortuneProps) {
  return (
    <div className="slide-section fortune-section-combined">
      <div className="fortune-block">
        <h3 className="fortune-subtitle">
          <span className="section-header-icon">🌟</span>
          Look Forward To
        </h3>
        <p className="fortune-text">{lookForwardTo}</p>
      </div>

      <div className="fortune-divider" />

      <div className="fortune-block">
        <h3 className="fortune-subtitle">
          <span className="section-header-icon">🔮</span>
          Things to Avoid
        </h3>
        <p className="fortune-text">{thingsToAvoid}</p>
      </div>
    </div>
  );
}
