// note の見出し画像（アイキャッチ）。note の推奨サイズ 1280x670 に揃えた PNG を記事の OGP 画像から作る。
// width/height の指定だけでは画像自体は変わらないため、画像を実寸で作ってから送る
import fs from "fs";
import path from "path";
import sharp from "sharp";

export const EYECATCH_WIDTH = 1280;
export const EYECATCH_HEIGHT = 670;

export function eyecatchSourceFor(slug, root = process.cwd()) {
  const own = path.join(root, "public", "ogp", `${slug}.png`);
  return fs.existsSync(own) ? own : path.join(root, "public", "og-card.png");
}

export async function eyecatchPng(slug, root = process.cwd()) {
  return sharp(eyecatchSourceFor(slug, root))
    .resize(EYECATCH_WIDTH, EYECATCH_HEIGHT, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}
