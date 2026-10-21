// @google/genai の代わりに、環境変数 MOCK_OUT の文字列を生成結果として返す。
// MOCK_ERROR があればその文言で失敗し、MOCK_CALLS のファイルに呼び出し回数を追記する。
// MOCK_PROMPT があれば、そのファイルに渡されたプロンプト（システム指示を含む）を書き出す
import fs from "fs";
export class GoogleGenAI {
  constructor() {
    this.models = {
      generateContent: async ({ contents, config } = {}) => {
        if (process.env.MOCK_CALLS) fs.appendFileSync(process.env.MOCK_CALLS, "x");
        if (process.env.MOCK_PROMPT) fs.writeFileSync(process.env.MOCK_PROMPT, `${config?.systemInstruction || ""}\n${contents || ""}`);
        if (process.env.MOCK_ERROR) throw new Error(process.env.MOCK_ERROR);
        return { text: process.env.MOCK_OUT };
      },
    };
  }
}
