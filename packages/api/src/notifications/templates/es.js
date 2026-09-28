/**
 * Spanish SMS copy (Task F2, fix round 1 applied the reviewer's replacement
 * table). Same keys as templates/en.js. No emoji, no em dashes (U+2014); a
 * plain hyphen or colon is used instead. The site calls a pod "cabina"
 * (messages/es.json's `yourPod`), so these SMS now match, and tier names
 * follow `loyalty.tiers`' sentence case ("Maestro de fideos", not
 * "Maestro de Fideos").
 */

const TIER_NAMES = {
  CHOPSTICK: "Palillos",
  NOODLE_MASTER: "Maestro de fideos",
  BEEF_BOSS: "Jefe de la carne",
};

export default {
  orderConfirmed: ({ orderNumber, total, link }) =>
    `Oh! Pedido #${orderNumber} confirmado, ${total}. Síguelo en vivo: ${link}`,
  orderConfirmedNoLink: ({ orderNumber, total }) =>
    `Oh! Pedido #${orderNumber} confirmado. Total: ${total}. Muestra este mensaje al llegar.`,

  podReady: ({ podNumber, link }) => `Oh! Tu cabina #${podNumber} está lista. Estado en vivo: ${link}`,
  podReadyNoLink: ({ podNumber, orderNumber }) =>
    `Oh! Tu cabina #${podNumber} está lista. Pedido #${orderNumber}. Dirígete a tu cabina para disfrutar.`,

  queueUpdate: ({ orderNumber, position, minutes }) =>
    `Oh! Pedido #${orderNumber}: eres el número ${position} en la fila. Espera estimada: ~${minutes} min. Te avisaremos cuando tu cabina esté lista.`,

  orderReady: ({ orderNumber }) => `Oh! Tu pedido #${orderNumber} está listo. Pasa a recogerlo. Buen provecho.`,

  tierUp: ({ tierKey, link }) =>
    `Oh! Ahora eres ${TIER_NAMES[tierKey] || tierKey}. Tu tazón gratis te espera: ${link}`,

  creditExpiring: ({ amount, date, link }) =>
    `Oh! Tienes ${amount} de crédito que vence el ${date}. Úsalo antes: ${link}`,
};
