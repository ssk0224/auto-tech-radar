// @google/genai の代わりに、環境変数 MOCK_OUT の文字列を生成結果として返す。
// MOCK_ERROR があればその文言で失敗し、MOCK_CALLS のファイルに呼び出し回数を追記する。
// MOCK_MODEL_ERRORS（{"モデル名": "エラー文言"} の JSON）があれば、そのモデルの呼び出しだけ失敗させる。
// MOCK_MODELS_LOG のファイルには呼び出されたモデル名を 1 行ずつ追記する。
// MOCK_MODELS（カンマ区切り）があれば models.list() がその一覧を返す。無ければ一覧の取得は失敗する（静的リストで動く）
// MOCK_PROMPT があれば、そのファイルに渡されたプロンプト（システム指示を含む）を書き出す
// MOCK_HANG があれば generateContent は応答を返さない
import fs from "fs";
export class GoogleGenAI {
  constructor() {
    this.models = {
      generateContent: async ({ model, contents, config } = {}) => {
        if (process.env.MOCK_CALLS) fs.appendFileSync(process.env.MOCK_CALLS, "x");
        if (process.env.MOCK_MODELS_LOG) fs.appendFileSync(process.env.MOCK_MODELS_LOG, `${model}\n`);
        if (process.env.MOCK_PROMPT) fs.writeFileSync(process.env.MOCK_PROMPT, `${config?.systemInstruction || ""}\n${contents || ""}`);
        if (process.env.MOCK_ERROR) throw new Error(process.env.MOCK_ERROR);
        // MOCK_HANG があれば応答を返さない（通信が止まったまま戻らない状態の再現）
        if (process.env.MOCK_HANG) return new Promise(() => {});
        const perModel = process.env.MOCK_MODEL_ERRORS ? JSON.parse(process.env.MOCK_MODEL_ERRORS) : {};
        if (perModel[model]) throw new Error(perModel[model]);
        return { text: process.env.MOCK_OUT };
      },
      list: async () => {
        if (!process.env.MOCK_MODELS) throw new Error("models.list is not available in this mock");
        const names = process.env.MOCK_MODELS.split(",").map((s) => s.trim()).filter(Boolean);
        return (async function* () {
          for (const n of names) yield { name: `models/${n}`, supportedActions: ["generateContent"] };
        })();
      },
    };
  }
}
