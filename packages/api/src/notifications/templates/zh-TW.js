/**
 * Traditional Chinese (Taiwan usage) SMS copy (Task F2, fix round 1 applied
 * the reviewer's replacement table). Same keys as templates/en.js. "Oh"
 * stays as the brand name; everything else is Taiwan-usage Chinese, no
 * Latin words, no emoji, no em dashes. The site calls a pod 包廂 and a
 * credit 點數 (member.tiers/loyalty.tiers copy) - these SMS now match.
 */

const TIER_NAMES = {
  CHOPSTICK: "筷子會員",
  NOODLE_MASTER: "麵條大師",
  BEEF_BOSS: "牛肉達人",
};

export default {
  orderConfirmed: ({ orderNumber, total, link }) =>
    `Oh! 訂單 #${orderNumber} 已確認，金額 ${total}。即時查看：${link}`,
  orderConfirmedNoLink: ({ orderNumber, total }) =>
    `Oh! 訂單 #${orderNumber} 已確認。金額：${total}。報到時請出示此簡訊。`,

  podReady: ({ podNumber, link }) => `Oh! 您的 ${podNumber} 號包廂已準備好。即時查看：${link}`,
  podReadyNoLink: ({ podNumber, orderNumber }) =>
    `Oh! 您的 ${podNumber} 號包廂已準備好。訂單 #${orderNumber}，請前往包廂用餐。`,

  queueUpdate: ({ orderNumber, position, minutes }) =>
    `Oh! 訂單 #${orderNumber}：目前排第 ${position} 位，預估等候 ${minutes} 分鐘。包廂準備好會再通知您。`,

  orderReady: ({ orderNumber }) => `Oh! 您的訂單 #${orderNumber} 已完成，請前往取餐，用餐愉快！`,

  tierUp: ({ tierKey, link }) =>
    `Oh! 恭喜升級為${TIER_NAMES[tierKey] || tierKey}。升級免費送一碗，已存入您的帳戶：${link}`,

  creditExpiring: ({ amount, date, link }) =>
    `Oh! 您有 ${amount} 點數將於 ${date} 到期，請盡快使用：${link}`,
};
