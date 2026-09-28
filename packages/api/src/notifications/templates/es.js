/**
 * Spanish SMS copy (Task F2). Same keys as templates/en.js. No emoji, no em
 * dashes (U+2014); a plain hyphen or colon is used instead.
 */

const TIER_NAMES = {
  CHOPSTICK: "Palillos",
  NOODLE_MASTER: "Maestro de Fideos",
  BEEF_BOSS: "Jefe de la Carne",
};

export default {
  orderConfirmed: ({ orderNumber, total, link }) =>
    `Oh! Pedido #${orderNumber} confirmado, ${total}. Síguelo en vivo: ${link}`,
  orderConfirmedNoLink: ({ orderNumber, total }) =>
    `Oh! Pedido #${orderNumber} confirmado. Total: ${total}. Muestra este mensaje al llegar.`,

  podReady: ({ podNumber, link }) => `Oh! Tu mesa #${podNumber} está lista. Estado en vivo: ${link}`,
  podReadyNoLink: ({ podNumber, orderNumber }) =>
    `Oh! Tu mesa #${podNumber} está lista. Pedido #${orderNumber}. Dirígete a tu mesa para disfrutar.`,

  queueUpdate: ({ orderNumber, position, minutes }) =>
    `Oh! Pedido #${orderNumber}: eres el número ${position} en la fila. Espera estimada: ~${minutes} min. Te avisaremos cuando tu mesa esté lista.`,

  orderReady: ({ orderNumber }) => `Oh! Tu pedido #${orderNumber} está listo. Pasa a recogerlo. Buen provecho.`,

  tierUp: ({ tierKey, link }) =>
    `Oh! Ahora eres ${TIER_NAMES[tierKey] || tierKey}. Tu tazón gratis te espera. ${link}`,

  creditExpiring: ({ amount, date, link }) =>
    `Oh! ${amount} en créditos vencen el ${date}. Úsalos antes de que se venzan: ${link}`,
};
