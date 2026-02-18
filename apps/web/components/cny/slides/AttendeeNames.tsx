"use client";

import { Attendee } from "@/lib/cny/slides-data";

interface AttendeeNamesProps {
  attendees: Attendee[];
  title: string;
  icon?: string;
}

export function AttendeeNames({ attendees, title, icon }: AttendeeNamesProps) {
  // Get first names only for cleaner display
  const firstNames = attendees.map((a) => {
    const parts = a.name.trim().split(" ");
    return parts[0];
  });

  // Limit to reasonable number for display
  const displayNames = firstNames.slice(0, 8);
  const remaining = firstNames.length - displayNames.length;

  return (
    <div className="slide-section attendees-section">
      <h2 className="section-header">
        {icon && <span className="section-header-icon">{icon}</span>}
        {title}
      </h2>
      {attendees.length > 0 ? (
        <div className="attendee-names">
          {displayNames.map((name, i) => (
            <span key={i} className="attendee-name">
              {name}
              {i < displayNames.length - 1 ? ", " : ""}
            </span>
          ))}
          {remaining > 0 && (
            <span className="attendee-name"> +{remaining} more</span>
          )}
        </div>
      ) : (
        <p className="no-attendees">Be the first to join!</p>
      )}
    </div>
  );
}
