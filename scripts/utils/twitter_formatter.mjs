/**
 * Auto Tech Radar - Twitter (X) Text Sanitizer & Character Limiter
 * 
 * Twitter Character Constraints:
 * - Total Allowed Weight: 280 units (equivalent to 140 Japanese full-width characters).
 * - ASCII / Basic Latin (code point <= 0x10FF): 1 unit per character.
 * - Multibyte / CJK / Emojis (code point > 0x10FF): 2 units per character.
 * - URLs (t.co): Exactly 23 half-width units (23 weight) regardless of URL length.
 * - Target Max Weight: 245 units (~122.5 Japanese characters) to guarantee a 35-unit safety margin.
 */

import { normalizeEol } from './eol.mjs';

export function calcTwitterWeight(text) {
  if (!text) return 0;
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex) || [];
  const textWithoutUrls = text.replace(urlRegex, '');

  let weight = 0;
  for (const ch of textWithoutUrls) {
    const code = ch.codePointAt(0);
    if (code <= 0x10FF) {
      weight += 1;
    } else {
      weight += 2;
    }
  }
  weight += urls.length * 23;
  return weight;
}

export function calcJapaneseChars(text) {
  return (calcTwitterWeight(text) / 2).toFixed(1);
}

/**
 * Ensures the tweet has the article link attached and strictly adheres to Twitter's 140-char limit.
 * @param {string} rawTweet - Original tweet 1 text or summary
 * @param {string} slug - Article slug
 * @param {string} customUrl - Optional custom URL
 * @returns {{ tweet: string, intentUrl: string, weight: number, charsJp: string, isSafe: boolean }}
 */
export function sanitizeAndAttachUrlToTweet(rawTweet, slug, customUrl = null) {
  const targetUrl = customUrl || `https://ssk0224.github.io/auto-tech-radar/radar/${slug}/`;

  // Remove existing URLs to avoid duplication
  // x_posts/*.txt は Windows の作業ツリーでは CRLF。\r が残ると文字数が行ごとに増え、投稿文に \r\n と \n が混ざる
  let text = normalizeEol(rawTweet).replace(/https?:\/\/[^\s]+/g, '').trim();

  // Normalize pointer emoji
  if (!text.includes('👇')) {
    text += ' 👇';
  }

  // Candidate with target URL
  const candidate = `${text}\n${targetUrl}`;
  const weight = calcTwitterWeight(candidate);

  // If already within 245 weight, return directly
  if (weight <= 245) {
    return {
      tweet: candidate,
      intentUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(candidate)}`,
      weight,
      charsJp: (weight / 2).toFixed(1),
      isSafe: weight <= 280
    };
  }

  // 先頭（フック）を残し、本文の末尾から weight で削る。行数に関係なく必ず 245 以内に収める。
  // 末尾行が短い 👇 付きの誘導文ならそれを残し、長い行（本文に 👇 が混ざっているだけ）は本文として扱う
  const lines = text.split('\n').filter(l => l.trim() !== '');
  const last = lines[lines.length - 1] || '';
  const keepFooter = lines.length > 1 && last.includes('👇') && calcTwitterWeight(last) <= 60;
  const footerLine = keepFooter ? last : '👇';
  const body = (keepFooter ? lines.slice(0, -1) : lines).join('\n').replace(/\s*👇\s*$/, '');
  const maxBodyWeight = 245 - calcTwitterWeight('\n' + footerLine + '\n' + targetUrl);

  let trimmedBody = body;
  if (calcTwitterWeight(body) > maxBodyWeight) {
    trimmedBody = '';
    for (const ch of body) {
      if (calcTwitterWeight(trimmedBody + ch + '…') > maxBodyWeight) break;
      trimmedBody += ch;
    }
    trimmedBody = trimmedBody.trimEnd() + '…';
  }

  const parts = [];
  if (trimmedBody) parts.push(trimmedBody);
  parts.push(footerLine);
  parts.push(targetUrl);

  const finalTweet = parts.join('\n');
  const finalWeight = calcTwitterWeight(finalTweet);

  return {
    tweet: finalTweet,
    intentUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(finalTweet)}`,
    weight: finalWeight,
    charsJp: (finalWeight / 2).toFixed(1),
    isSafe: finalWeight <= 280
  };
}

/**
 * Robust extractor for Tweet 1 from various formats ([TWEET 1], 【ツイート 1】, ## ツイート 1)
 * @param {string} xText - Content of x_posts/*.txt
 * @param {string} fallbackTitle - Fallback string if no section is found
 * @returns {string} - Extracted Tweet 1 text
 */
export function extractTweet1(rawXText, fallbackTitle = '') {
  if (!rawXText) return fallbackTitle;
  const xText = normalizeEol(rawXText);

  // 1. Match standard Tweet 1 blocks
  const match = xText.match(/(?:【ツイート\s*1】|\[TWEET\s*1\]|##\s*ツイート\s*1)\r?\n([\s\S]*?)(?=\r?\n\r?\n(?:【ツイート\s*2】|\[TWEET\s*2\]|##\s*ツイート\s*2|👉\s*ワンクリック|--------------------------------------------------|$))/i);
  if (match && match[1].trim().length > 10) {
    return match[1].trim();
  }

  // 2. Fallback: If no delimiter, but text exists without header separators
  const clean = xText.replace(/^[=\-\s\n📱]+.*?X \(Twitter\) 投稿用スレッド[=\-\s\n]+/m, '').trim();
  if (clean.length > 20) {
    const firstSection = clean.split(/\n\s*\n/)[0];
    return firstSection.trim();
  }

  return fallbackTitle;
}

