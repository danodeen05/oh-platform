/**
 * Traditional Chinese (Taiwan usage) SMS copy (Task F2). Same keys as
 * templates/en.js. "Oh" stays as the brand name; everything else is
 * Taiwan-usage Chinese, no Latin words, no emoji, no em dashes.
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

  podReady: ({ podNumber, link }) => `Oh! ${podNumber} 號座位已就緒，即時查看：${link}`,
  podReadyNoLink: ({ podNumber, orderNumber }) =>
    `Oh! 您的 ${podNumber} 號座位已就緒。訂單 #${orderNumber}。請前往座位享用美食。`,

  queueUpdate: ({ orderNumber, position, minutes }) =>
    `Oh! 訂單 #${orderNumber}：目前排在第 ${position} 位，預估等候 ${minutes} 分鐘。座位就緒將通知您！`,

  orderReady: ({ orderNumber }) => `Oh! 您的訂單 #${orderNumber} 已完成，請前往取餐，用餐愉快！`,

  tierUp: ({ tierKey, link }) => `Oh! 您已升級為${TIER_NAMES[tierKey] || tierKey}，免費一碗正在等您。${link}`,

  creditExpiring: ({ amount, date, link }) =>
    `Oh! 您有 ${amount} 購物金將於 ${date} 到期，請盡快使用：${link}`,
};
