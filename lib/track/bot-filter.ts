/**
 * 访客上报的机器人 UA 判定。
 *
 * /api/track（服务端）与 useTracker（客户端）共用，避免两端规则漂移。
 * 注意：不要把 Telegram / Twitter / Discord / WhatsApp 等内嵌浏览器的
 * App 名加入黑名单——带这些后缀的是真实用户（如 "Telegram-Android/11.2.1"）；
 * 平台爬虫用的是另一套 UA（Twitterbot、facebookexternalhit 等），按精确名拦截。
 * 同理不要用裸 "bot" 做子串匹配，会误伤 CUBOT 等以 bot 结尾的品牌词。
 */
const BOT_UA_RE =
  /crawl|spider|scrape|slurp|headless|\bbot\b|googlebot|bingbot|yandexbot|baiduspider|duckduckbot|applebot|petalbot|semrushbot|ahrefsbot|mj12bot|dotbot|bytespider|gptbot|claudebot|ccbot|perplexitybot|facebookexternalhit|facebot|twitterbot|slackbot|discordbot|telegrambot/i;

/** UA 是否更可能是机器人（保守判定，只拦高置信度爬虫特征） */
export function isLikelyBotUa(ua: string): boolean {
  return BOT_UA_RE.test(ua);
}
