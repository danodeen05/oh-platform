/**
 * CNY party zodiac insights in the reader's language (Task D11 fix round 1).
 *
 * GET /orders/zodiac-insights?locale= builds its model prompt with
 * `zodiacInsightsPrompt` (which names the target language) and, when the
 * model is unavailable or answers badly, fills each line from
 * `zodiacFallbacks`. Pure functions, no I/O; tested in
 * __tests__/zodiac-insights.test.js.
 */
import { normalizeLocale } from "../locale.js";

const LANGUAGE = {
  en: "English",
  "zh-TW": "Traditional Chinese (Taiwan)",
  "zh-CN": "Simplified Chinese",
  es: "Spanish",
};

/** Zodiac animal names per locale (the API computes them in English). */
export const ZODIAC_NAMES = {
  en: { Rat: "Rat", Ox: "Ox", Tiger: "Tiger", Rabbit: "Rabbit", Dragon: "Dragon", Snake: "Snake", Horse: "Horse", Goat: "Goat", Monkey: "Monkey", Rooster: "Rooster", Dog: "Dog", Pig: "Pig" },
  "zh-TW": { Rat: "鼠", Ox: "牛", Tiger: "虎", Rabbit: "兔", Dragon: "龍", Snake: "蛇", Horse: "馬", Goat: "羊", Monkey: "猴", Rooster: "雞", Dog: "狗", Pig: "豬" },
  "zh-CN": { Rat: "鼠", Ox: "牛", Tiger: "虎", Rabbit: "兔", Dragon: "龙", Snake: "蛇", Horse: "马", Goat: "羊", Monkey: "猴", Rooster: "鸡", Dog: "狗", Pig: "猪" },
  es: { Rat: "Rata", Ox: "Buey", Tiger: "Tigre", Rabbit: "Conejo", Dragon: "Dragón", Snake: "Serpiente", Horse: "Caballo", Goat: "Cabra", Monkey: "Mono", Rooster: "Gallo", Dog: "Perro", Pig: "Cerdo" },
};

export function zodiacName(zodiac, locale = "en") {
  const l = normalizeLocale(locale);
  return ZODIAC_NAMES[l]?.[zodiac] ?? zodiac;
}

/** The three sentences the page shows when the model can't write them. Names are the guests' own. */
export function zodiacFallbacks({ locale = "en", zodiac, compatibleGuests = [], avoidGuests = [] }) {
  const l = normalizeLocale(locale);
  const z = zodiacName(zodiac, l);
  const friend = compatibleGuests[0];
  const foe = avoidGuests[0];
  const fz = friend ? zodiacName(friend.zodiac, l) : "";
  switch (l) {
    case "zh-TW":
      return {
        horseYearAdvice: `屬${z}的你，在馬年大膽擁抱新的冒險吧！`,
        hangOutWith: friend ? `去找 ${friend.name} 聊聊吧，屬${fz}的人是你的好夥伴！` : "和每個人都聊聊吧，你的魅力無人能擋！",
        avoidTonight: foe ? `小心 ${foe.name}，開玩笑的，還是去打聲招呼吧！` : "今晚沒有星象衝突，一切安全！",
      };
    case "zh-CN":
      return {
        horseYearAdvice: `属${z}的你，在马年大胆拥抱新的冒险吧！`,
        hangOutWith: friend ? `去找 ${friend.name} 聊聊吧，属${fz}的人是你的好伙伴！` : "和每个人都聊聊吧，你的魅力无人能挡！",
        avoidTonight: foe ? `小心 ${foe.name}，开玩笑的，还是去打声招呼吧！` : "今晚没有星象冲突，一切安全！",
      };
    case "es":
      return {
        horseYearAdvice: `¡Si eres ${z}, abraza nuevas aventuras en este Año del Caballo!`,
        hangOutWith: friend ? `¡Busca a ${friend.name}! Los de ${fz} son grandes compañeros.` : "¡Conversa con todos, tu encanto no tiene límites!",
        avoidTonight: foe ? `Cuidado con ${foe.name}. ¡Es broma, salúdalo de todos modos!` : "¡Esta noche no hay conflictos cósmicos, todo despejado!",
      };
    default:
      return {
        horseYearAdvice: `${z}s should embrace new adventures this Year of the Horse!`,
        hangOutWith: friend ? `Seek out ${friend.name}. Fellow ${fz}s make great companions!` : "Mingle with everyone. Your charm knows no bounds!",
        avoidTonight: foe ? `Watch out for ${foe.name}. Just kidding, say hi anyway!` : "No cosmic conflicts tonight. You're in the clear!",
      };
  }
}

/** The model prompt, written for the reader's language. */
export function zodiacInsightsPrompt({ locale = "en", firstName, zodiac, birthday, compatibility, compatibleGuests = [], avoidGuests = [] }) {
  const l = normalizeLocale(locale);
  const language = LANGUAGE[l];
  const list = (gs) => gs.map((g) => `${g.name} (${g.zodiac})`).join(", ") || "None tonight";
  return `You are a fun, mystical Chinese zodiac expert at a Chinese New Year 2026 party (Year of the Horse).

Guest: ${firstName}
Their Zodiac: ${zodiac}
Their Birthday: ${birthday}

Compatible guests at the party (${compatibility.best.join(", ")} signs): ${list(compatibleGuests)}

Challenging matches (${compatibility.avoid.join(", ")} signs): ${list(avoidGuests)}

Generate a fun, personalized zodiac insight in this exact JSON format:
{
  "horseYearAdvice": "One playful sentence about what ${zodiac}s should remember during the Year of the Horse (2026). Make it specific and fun.",
  "hangOutWith": "One fun sentence suggesting who they should seek out tonight and why, based on zodiac compatibility. Be specific with names if available.",
  "avoidTonight": "One playful, lighthearted sentence about who to 'watch out for' tonight. Keep it fun and obviously joking - this is for entertainment!"
}

Write every value in ${language}${l === "en" ? "" : ` (the guests' names stay as they are; name zodiac animals in ${language})`}. Do not use emoji. Be playful, mystical, and entertaining. Keep each response to ONE short sentence. Return ONLY valid JSON.`;
}
