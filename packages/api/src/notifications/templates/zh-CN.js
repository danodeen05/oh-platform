/**
 * Simplified Chinese (mainland usage) SMS copy (Task F2, fix round 1 applied
 * the reviewer's replacement table). Same keys as templates/en.js. "Oh"
 * stays as the brand name; everything else is mainland-usage Chinese (e.g.
 * "短信" not "簡訊"), no Latin words, no emoji, no em dashes. The site calls
 * a pod 包厢 and a credit 积分 (member.tiers/loyalty.tiers copy) - these SMS
 * now match ("余额" reads like a wallet balance, not the loyalty credit).
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

  podReady: ({ podNumber, link }) => `Oh! 您的 ${podNumber} 号包厢已准备好。实时查看：${link}`,
  podReadyNoLink: ({ podNumber, orderNumber }) =>
    `Oh! 您的 ${podNumber} 号包厢已准备好。订单 #${orderNumber}，请前往包厢用餐。`,

  queueUpdate: ({ orderNumber, position, minutes }) =>
    `Oh! 订单 #${orderNumber}：目前排第 ${position} 位，预计等待 ${minutes} 分钟。包厢准备好会再通知您。`,

  orderReady: ({ orderNumber }) => `Oh! 您的订单 #${orderNumber} 已完成，请前往取餐，用餐愉快！`,

  tierUp: ({ tierKey, link }) =>
    `Oh! 恭喜升级为${TIER_NAMES[tierKey] || tierKey}。升级免费送一碗，已存入您的账户：${link}`,

  creditExpiring: ({ amount, date, link }) =>
    `Oh! 您有 ${amount} 积分将于 ${date} 到期，请尽快使用：${link}`,
};
