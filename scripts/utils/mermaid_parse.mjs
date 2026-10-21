// Mermaid 図を、サイトが読み込むのと同じ版の Mermaid（package.json で 10.9.8 に固定）で実際に構文解析する。
// 正規表現による検査（mermaid.mjs）だけでは、入れ子の引用符や辺ラベルの記号など実際の描画失敗を見逃したため
import { JSDOM } from "jsdom";

let mermaidPromise = null;
async function loadMermaid() {
  if (!mermaidPromise) {
    const dom = new JSDOM("<!doctype html><body></body>", { pretendToBeVisual: true });
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
    globalThis.Element = dom.window.Element;
    globalThis.HTMLElement = dom.window.HTMLElement;
    mermaidPromise = import("mermaid").then((m) => {
      m.default.initialize({ startOnLoad: false });
      return m.default;
    });
  }
  return mermaidPromise;
}

export function mermaidBlocks(content) {
  return [...content.matchAll(/```mermaid\r?\n([\s\S]*?)```/g)].map((m) => m[1]);
}

// 解析に失敗した図の数とエラーの先頭行（空なら全部描画できる）
export async function mermaidParseErrors(content) {
  const blocks = mermaidBlocks(content);
  if (blocks.length === 0) return [];
  const mermaid = await loadMermaid();
  const errors = [];
  for (const [i, code] of blocks.entries()) {
    try {
      await mermaid.parse(code);
    } catch (e) {
      const lines = String(e.message || e).split("\n");
      errors.push(`図${i + 1}: ${lines.slice(0, 3).join(" ").slice(0, 200)}`);
    }
  }
  return errors;
}
