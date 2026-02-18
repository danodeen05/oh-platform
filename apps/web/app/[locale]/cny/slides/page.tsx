import { SlideshowClient } from "./slideshow-client";
import { groupAttendeesByZodiac, Attendee } from "@/lib/cny/slides-data";
import { getChineseZodiac, ZodiacAnimal, ZODIAC_ANIMALS } from "@/lib/cny/zodiac";

const CNY_APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyUdlLe3sVsJcs5XSh4LvZcmBJA3IyUi0qNHkZVc4GdY7n6nFXcoQhFpZIK2_dOFLU2dg/exec";

// Disable caching - client will poll for real-time updates
export const dynamic = "force-dynamic";

interface RSVPResponse {
  name: string;
  phone?: string;
  birthdate?: string;
  birthday?: string;
  zodiac?: string;
}

async function fetchRSVPs(): Promise<Attendee[]> {
  try {
    const response = await fetch(`${CNY_APPS_SCRIPT_URL}?action=getRSVPs`, {
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Failed to fetch RSVPs:", response.status);
      return [];
    }

    const text = await response.text();
    const data: RSVPResponse[] = JSON.parse(text);

    // Process each RSVP and ensure zodiac is set
    return data.map((rsvp) => {
      const birthdate = rsvp.birthdate || rsvp.birthday;
      let zodiac: ZodiacAnimal | undefined = rsvp.zodiac as ZodiacAnimal;

      // Calculate zodiac if not provided but birthdate is available
      if (!zodiac && birthdate) {
        try {
          const zodiacInfo = getChineseZodiac(birthdate);
          zodiac = zodiacInfo.animal;
        } catch {
          // Ignore calculation errors
        }
      }

      return {
        name: rsvp.name,
        phone: rsvp.phone,
        birthdate,
        zodiac,
      };
    });
  } catch (error) {
    console.error("Error fetching RSVPs:", error);
    return [];
  }
}

export default async function SlidesPage() {
  const attendees = await fetchRSVPs();
  const attendeesByZodiac = groupAttendeesByZodiac(attendees);

  // Pass initial data - client will poll for real-time updates
  return <SlideshowClient initialAttendeesByZodiac={attendeesByZodiac} />;
}
