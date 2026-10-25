// サイト共通のカード public/og-card.png を、手で編集する public/og-card.svg から作り直す（オーナー端末で手で流す。CI は書かない）。
//   node scripts/render_site_og_card.mjs
// PNG には元の SVG のハッシュを記録する（tests/og_text.test.mjs が SVG と PNG の食い違いを止める）
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pngFromSvg } from './utils/og_png.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const png = pngFromSvg(path.join(rootDir, 'public', 'og-card.svg'));
if (!png) process.exit(1);
fs.writeFileSync(path.join(rootDir, 'public', 'og-card.png'), png);
console.log('✓ public/og-card.png を作り直しました');
