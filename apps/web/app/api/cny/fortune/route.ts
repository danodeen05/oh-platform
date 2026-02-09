import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  getChineseZodiac,
  findLuckyNumbersInPhone,
  type ZodiacInfo,
} from "@/lib/cny/zodiac";

// Initialize Anthropic client
function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

interface FortuneRequest {
  name: string;
  phone?: string;
  birthdate?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FortuneRequest = await request.json();
    const { name, phone, birthdate } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Calculate zodiac info if birthdate provided
    const zodiacInfo: ZodiacInfo | null = birthdate
      ? getChineseZodiac(birthdate)
      : null;

    // Find lucky numbers in phone
    const phoneLuckyNumbers =
      phone && zodiacInfo
        ? findLuckyNumbersInPhone(phone, zodiacInfo.luckyNumbers)
        : [];

    const anthropic = getAnthropic();

    // Build the prompt
    const prompt = buildFortunePrompt(
      name.trim(),
      phone || null,
      birthdate || null,
      zodiacInfo,
      phoneLuckyNumbers
    );

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text from response
    const fortuneText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return NextResponse.json({
      fortune: fortuneText,
      zodiac: zodiacInfo?.animal || null,
      element: zodiacInfo?.element || null,
      luckyNumbers: zodiacInfo?.luckyNumbers || [],
      luckyColors: zodiacInfo?.luckyColors || [],
      compatibleWith: zodiacInfo?.compatibleWith || [],
      luckyNumbersInPhone: phoneLuckyNumbers,
    });
  } catch (error) {
    console.error("Fortune API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate fortune",
      },
      { status: 500 }
    );
  }
}

function buildFortunePrompt(
  name: string,
  phone: string | null,
  birthdate: string | null,
  zodiacInfo: ZodiacInfo | null,
  phoneLuckyNumbers: number[]
): string {
  const firstName = name.split(" ")[0];

  return `You are a wise, warm, and slightly mystical fortune teller at a Chinese New Year celebration for the Year of the Horse (2026). You're greeting guests as they arrive and giving them personalized fortunes.

Guest Information:
- Name: ${name} (use "${firstName}" when addressing them)
${birthdate ? `- Birthdate: ${birthdate}` : "- Birthdate: Not provided"}
${zodiacInfo ? `- Chinese Zodiac: ${zodiacInfo.animal} (${zodiacInfo.element} element)` : ""}
${zodiacInfo ? `- Their zodiac lucky numbers: ${zodiacInfo.luckyNumbers.join(", ")}` : ""}
${zodiacInfo ? `- Their zodiac lucky colors: ${zodiacInfo.luckyColors.join(", ")}` : ""}
${zodiacInfo ? `- Compatible zodiac animals: ${zodiacInfo.compatibleWith.join(", ")}` : ""}
${phone ? `- Phone number: ${phone}` : "- Phone: Not provided"}
${phoneLuckyNumbers.length > 0 ? `- Lucky numbers found in their phone: ${phoneLuckyNumbers.join(", ")}` : ""}

Generate a personalized fortune with EXACTLY these 7 sections. Use the exact headers shown (with **bold**). Be warm, celebratory, and slightly mystical. Use "${firstName}" naturally throughout.

**Welcome, ${firstName}!**
A warm, personalized greeting (2 sentences). Make them feel special. Reference that the Year of the Horse is galloping toward them. Build anticipation for what you're about to reveal.

**The Meaning of Your Name**
Share something poetic, interesting, or auspicious about their name "${name}" in the context of Chinese culture, fortune, or the new year. Be creative - consider the sounds, the energy, or create a poetic interpretation. Keep it positive and intriguing. (2-3 sentences)

**Your Lucky Numbers**
${
  phone && phoneLuckyNumbers.length > 0
    ? `Their phone contains these lucky numbers for their zodiac: ${phoneLuckyNumbers.join(", ")}. Celebrate this! Explain what these numbers mean in Chinese numerology and why having them in their phone is auspicious.`
    : phone
      ? `Analyze their phone number for significant digits. Mention which digits are particularly lucky in Chinese culture (8, 6, 9) or their zodiac's lucky numbers if applicable.`
      : `Share wisdom about lucky numbers for the Year of the Horse and general Chinese numerology.`
} (2-3 sentences)

**Year of the Horse 2026**
${
  zodiacInfo
    ? `As a ${zodiacInfo.animal} (${zodiacInfo.element}), give them a specific fortune for how the Year of the Horse will affect them. Include one exciting opportunity/prediction AND one friendly warning or area to be mindful of.`
    : `Give a general Year of the Horse 2026 fortune with one exciting prediction and one gentle warning.`
} Make it feel personal and actionable. (3-4 sentences)

**Your Party Companions**
${
  zodiacInfo
    ? `Tell them which zodiac animals they'll connect with best at the party: ${zodiacInfo.compatibleWith.join(", ")}. Be specific and fun - "Seek out the Tigers - you'll be instant friends!" Give a playful reason why they'll click.`
    : `Give general advice about connecting with others at the party in the spirit of the Horse year.`
} (2 sentences)

**What to Wear**
${
  zodiacInfo
    ? `Their lucky colors are: ${zodiacInfo.luckyColors.join(", ")}. Give a playful, specific outfit suggestion incorporating these colors for the party. Be creative and fun!`
    : `Suggest wearing red and gold - the traditional lucky colors - with a playful specific suggestion.`
} (2 sentences)

**Your Lucky Phrase**
Create a personalized 4-character Chinese idiom (chengyu/成语) for them. Format it as:
[Chinese characters] ([pinyin]) - [English meaning]
Then explain in 1 sentence why this phrase is perfect for ${firstName} in the coming year.

IMPORTANT GUIDELINES:
- Keep total response under 400 words
- Use vivid, engaging language
- Do NOT use emojis
- Make ${firstName} feel special and excited for both the party and the new year
- Be specific and personal, avoid generic fortunes
- Keep the tone warm and celebratory, with a touch of mystical wisdom`;
}
