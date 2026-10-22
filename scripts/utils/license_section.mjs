// Web 記事のライセンスの節（leakhunt C3、2026-10-22）。生成モデルには書かせず、LICENSE ファイルの判定結果
// （scripts/utils/license_resolver.mjs の resolveLicense: GitHub の license API と本文の判定）から決まった形で作る。
// 書くのは名称（SPDX）・確認先のリンク・追加の表示と、法的な助言ではない旨の定型文だけ（商用利用の可否などの結論は書かない）
import { licenseLabel } from "./license_resolver.mjs";

export const LICENSE_HEADING = "## ライセンス";
export const NOT_LEGAL_ADVICE = "この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。";

// usage: README の利用条件の記載（学習用途のみ・非商用など。anchored.mjs の usageLines）。原文のまま示す（leakhunt #57）
export function licenseSection(info, usage = []) {
  const i = info || { status: "unresolved" };
  const out = [LICENSE_HEADING, "", `- ライセンス: ${licenseLabel(i.status === "unresolved" ? null : i)}`];
  if (i.url) out.push(i.status === "none" ? `- 確認先: [リポジトリ](${i.url})（LICENSE ファイルが見つかりません）` : `- 確認先: [LICENSE ファイル](${i.url})`);
  if (i.extraNotices?.length) out.push(`- 追加の表示: ${i.extraNotices.join(" / ")}`);
  if (i.status === "none") out.push("- 補足: ライセンス未指定（利用許諾なし）のため、著作権者の許諾なしに利用・改変・再配布できない可能性があります。");
  else if (i.status !== "resolved") out.push("- 補足: ライセンスの種類を自動で判定できませんでした（要確認）。LICENSE ファイルの本文を確認してください。");
  else if (i.sourceAvailable) out.push("- 補足: ソース公開型のライセンスで、利用には条件があります。条件は LICENSE ファイルで確認してください。");
  if (usage.length) out.push("", "README には、利用について次の記載があります（原文のまま）。", "", ...usage.map((u) => `- 原文（README）: ${u}`));
  out.push("", NOT_LEGAL_ADVICE, "");
  return out.join("\n");
}
