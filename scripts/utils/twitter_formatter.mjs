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
  let text = (rawTweet || '').replace(/https?:\/\/[^\s]+/g, '').trim();

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

  // Smart trimming: preserve header (hook & stars) and footer (CTA & pointer)
  const lines = text.split('\n').filter(l => l.trim() !== '');
  const footerLine = lines[lines.length - 1]; // contains 👇
  const headerLines = lines.slice(0, Math.min(2, lines.length - 1));
  let middleLines = lines.slice(headerLines.length, lines.length - 1);
  let middleText = middleLines.join(' ');

  const headerWeight = calcTwitterWeight(headerLines.join('\n') + '\n');
  const footerWeight = calcTwitterWeight('\n' + footerLine + '\n' + targetUrl);
  const maxMiddleWeight = 245 - (headerWeight + footerWeight);

  let trimmedMiddle = '';
  for (const ch of middleText) {
    const nextMiddle = trimmedMiddle + ch;
    if (calcTwitterWeight(nextMiddle + '...') > maxMiddleWeight) {
      trimmedMiddle += '...';
      break;
    }
    trimmedMiddle = nextMiddle;
  }

  const parts = [];
  if (headerLines.length > 0) parts.push(headerLines.join('\n'));
  if (trimmedMiddle) parts.push(trimmedMiddle);
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
