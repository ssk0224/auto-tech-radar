// @google/genai の代わりに、環境変数 MOCK_OUT の文字列を生成結果として返す
export class GoogleGenAI {
  constructor() {
    this.models = { generateContent: async () => ({ text: process.env.MOCK_OUT }) };
  }
}
