// 禁止表現・誇張表現の統一バリデーター（クローラー生成時とテスト・監査で同一定義を共用）
export const FORBIDDEN = [
  [/想定受託単価|推奨受託単価/, "スター数・カテゴリから機械的に決めた受託単価"],
  [/完全保存版|ドル箱|完全無人化|完全網羅/, "根拠のない誇張"],
  [/Trending直結/, "GitHub Trending ではなく検索 API で収集している"],
  [/社内稟議テンプレ付|社内稟議・提案書ドラフト|見積内訳付き/, "無料部分・画像に含まれない有料特典の表示"],
  [/累計[\d,]+\+? ?Stars/, "集計していないスター数の合計"],
  [/即受注|受注に直結/, "成果や受注を保証する表現"],
  [/100%経費精算可能/, "所属先規定に依存する断定"],
  [/専任エンジニアチーム/, "運営実態と異なる表現"]
];

export function findForbiddenClaims(text) {
  if (!text) return [];
  const hits = [];
  for (const [re, why] of FORBIDDEN) {
    const m = text.match(re);
    if (m) {
      hits.push(`${why} ("${m[0]}")`);
    }
  }
  return hits;
}
