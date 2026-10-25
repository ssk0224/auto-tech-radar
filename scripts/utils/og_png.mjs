// SVG から OGP の PNG（1200x630）を作る部品。リポのファイルには書かない（Chrome の出力は一時フォルダに置き、PNG の中身を返す）。
// 書き先は呼び出し側が決める: 記事ごとの public/ogp/<slug>.png は CI（generate_og_cards.mjs）、
// リードマグネットの画像（generate_lead_magnet_note.mjs）とサイト共通のカード（render_site_og_card.mjs）はオーナー端末。
// 書く側の違う出力を 1 つの関数の書き出しにまとめない（tests/state_writers.test.mjs が入口ごとに書き先を台帳と突き合わせる）
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';

// ---- PNG に「どの SVG から作ったか」を記録する（tests/og_text.test.mjs が SVG と PNG の食い違いを止める） ----
export const PNG_SOURCE_KEY = 'atr-source-svg-sha256';
const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function pngChunks(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) return null;
  const chunks = [];
  for (let off = 8; off + 12 <= buf.length; ) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    chunks.push({ type, raw: buf.subarray(off, off + 12 + len), data: buf.subarray(off + 8, off + 8 + len) });
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return chunks;
}
const textKey = (c) => c.data.toString('latin1', 0, Math.max(0, c.data.indexOf(0)));
export function readPngText(buf) {
  const out = {};
  for (const c of pngChunks(buf) || []) {
    if (c.type !== 'tEXt') continue;
    const z = c.data.indexOf(0);
    if (z > 0) out[textKey(c)] = c.data.toString('latin1', z + 1);
  }
  return out;
}
export function stampPng(buf, key, value) {
  const chunks = pngChunks(buf);
  if (!chunks) throw new Error('PNG ではありません');
  const data = Buffer.concat([Buffer.from(key, 'latin1'), Buffer.from([0]), Buffer.from(value, 'latin1')]);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write('tEXt', 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  const kept = chunks.filter((c) => !(c.type === 'tEXt' && textKey(c) === key));
  const body = kept.filter((c) => c.type !== 'IEND').map((c) => c.raw);
  const end = kept.filter((c) => c.type === 'IEND').map((c) => c.raw);
  return Buffer.concat([PNG_SIG, ...body, head, data, crc, ...end]);
}
export const svgSourceHash = (svg) => crypto.createHash('sha256').update(String(svg).replace(/\r\n?/g, '\n')).digest('hex');

// SVG を Chrome で PNG（1200x630）にし、元の SVG のハッシュを記録した PNG の中身を返す。作れなければ null
export function pngFromSvg(svgPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atr-og-'));
  const shot = path.join(tmpDir, 'card.png');
  try {
    const chromeCandidates = [
      process.env.CHROME_BIN,
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'google-chrome',
      'chromium',
      'chromium-browser'
    ];
    const chromeBin = chromeCandidates.find(c => c && fs.existsSync(c)) || 'google-chrome';
    execSync(`"${chromeBin}" --headless --disable-gpu --no-sandbox --hide-scrollbars --screenshot="${shot}" --window-size=1200,630 "${svgPath}"`, { stdio: 'ignore', timeout: 60000 }); // Chrome が固まっても CI を止めない
    return stampPng(fs.readFileSync(shot), PNG_SOURCE_KEY, svgSourceHash(fs.readFileSync(svgPath, 'utf8')));
  } catch (e) {
    // Chrome が使えない環境でも生成を止めない。PNG が SVG と食い違ったまま残れば tests/og_text.test.mjs が止める
    console.warn(`PNG を作れませんでした（${path.basename(svgPath)}）: ${e.message}`);
    return null;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
