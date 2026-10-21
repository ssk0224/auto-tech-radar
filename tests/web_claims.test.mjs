// Web 記事（src/pages/radar/*.md）に、導入の勧め・引用の無い比較/最上級・禁止の記載が無いことを根拠にしたライセンスの推測が無いことを確かめる。
// 生成スクリプトは新しい記事を同じ検査（claims_check.mjs の findWebArticleClaims）で不採用にするので、ここが落ちるのは既存ページへの手作業の変更か、検査の後退
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { findWebArticleClaims, WEB_CLAIMS_PROMPT_RULE } from "../scripts/utils/claims_check.mjs";

test("既存のすべての Web 記事に、導入の勧め・引用の無い比較・ライセンスの推測が無い", () => {
  const dir = "src/pages/radar";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  assert.ok(files.length > 30);
  const hits = [];
  for (const f of files) for (const h of findWebArticleClaims(fs.readFileSync(path.join(dir, f), "utf8"))) hits.push(`${f}: ${h}`);
  assert.deepEqual(hits, []);
});

const NG = [
  "本番環境への導入、社内標準ツールとしての採用を推奨します。",
  "企業にとって、即座に導入を検討すべきソリューションです。",
  "今すぐ導入しましょう。",
  "この分野では導入は必須です。",
  "**判定: ADOPT**",
  "**判定：TRIAL（試験的導入を強く推奨）**",
  "### 推奨活用フェーズ",
  "本番環境への導入、社内標準ツールとしての採用。",
  "TensorRT-LLMレベル（エージェント特化でさらに優位）",
  "Blackwell 向けの最速の実装です。",
  "他の汎用エンジンを上回る性能です。",
  "圧倒的な低遅延を実現しています。",
  "## 商用利用可否 & ライセンス考察\nOSSの慣例として、明示的な禁止がない限り、利用は許容されることが多いです。",
  "## ライセンス\n商用利用を明確に制限する記述は見当たりません。",
];
const OK = [
  "本番環境への導入には、認証基盤の追加が必要です。",
  "Python 3.10 以上が必須です。",
  "### 1. エージェントへの自動インストール（推奨）",
  "- **RAM**: 32GB以上（64GB推奨）",
  "通常はSparse Protocolの利用が推奨されます。",
  "Android TV の広告を減らしたい場合の検証候補になります。",
  // 同じ段落に README をリンク付きで引用していれば、比較の表現を認める
  "README では次のように説明されています。\n> one of the fastest MLA implementations（最速クラスの MLA 実装） — [README](https://github.com/o/r#readme)",
  // ライセンスの話ではない「禁止」の記述は対象外
  "API キーをコードに直書きすることは明示的に禁止されていないが、避けてください。",
  // コードブロックの中は対象外
  "```bash\necho 推奨します\n```",
];

test("導入の勧め・引用の無い比較・ライセンスの推測を検出する", () => {
  for (const s of NG) assert.ok(findWebArticleClaims(s).length > 0, s);
});

test("要件・README に基づく推奨環境・引用付きの比較・ライセンス以外の話題は検出しない", () => {
  for (const s of OK) assert.deepEqual(findWebArticleClaims(s), [], s);
});

test("生成プロンプトに同じ語の禁止指示があり、生成スクリプトが Web 記事を同じ検査で不採用にする", () => {
  for (const term of ["推奨します", "即座に導入", "本番環境への導入", "導入すべき", "今すぐ導入", "ADOPT", "優位", "最速", "上回る", "圧倒的", "検証候補"]) {
    assert.ok(WEB_CLAIMS_PROMPT_RULE.includes(term), term);
  }
  const src = fs.readFileSync("scripts/crawl_and_generate.mjs", "utf8");
  assert.match(src, /\$\{WEB_CLAIMS_PROMPT_RULE\}/);
  assert.match(src, /findWebArticleClaims\(result\.web\)/);
});
