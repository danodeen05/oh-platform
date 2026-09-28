/**
 * Simplified Chinese (mainland usage) SMS copy (Task F2). Same keys as
 * templates/en.js. "Oh" stays as the brand name; everything else is
 * mainland-usage Chinese (e.g. "短信" not "簡訊", "余额" not "購物金"),
 * no Latin words, no emoji, no em dashes.
 */

const TIER_NAMES = {
  CHOPSTICK: "筷子会员",
  NOODLE_MASTER: "面条大师",
  BEEF_BOSS: "牛肉达人",
};

export default {
  orderConfirmed: ({ orderNumber, total, link }) =>
    `Oh! 订单 #${orderNumber} 已确认，金额 ${total}。实时查看：${link}`,
  orderConfirmedNoLink: ({ orderNumber, total }) =>
    `Oh! 订单 #${orderNumber} 已确认。金额：${total}。签到时请出示此短信。`,

  podReady: ({ podNumber, link }) => `Oh! ${podNumber} 号座位已就绪，实时查看：${link}`,
  podReadyNoLink: ({ podNumber, orderNumber }) =>
    `Oh! 您的 ${podNumber} 号座位已就绪。订单 #${orderNumber}。请前往座位享用美食。`,

  queueUpdate: ({ orderNumber, position, minutes }) =>
    `Oh! 订单 #${orderNumber}：目前排在第 ${position} 位，预计等待 ${minutes} 分钟。座位就绪会通知您！`,

  orderReady: ({ orderNumber }) => `Oh! 您的订单 #${orderNumber} 已完成，请前往取餐，用餐愉快！`,

  tierUp: ({ tierKey, link }) => `Oh! 您已升级为${TIER_NAMES[tierKey] || tierKey}，免费一碗正在等您。${link}`,

  creditExpiring: ({ amount, date, link }) =>
    `Oh! 您有 ${amount} 余额将于 ${date} 到期，请尽快使用：${link}`,
};
