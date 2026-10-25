// 生成スクリプトのテストで使う README（tests/fixtures/mock_setup.mjs が返す本文）。
// 生成モデルの出力の原文つきの文（tests/generator.test.mjs の output()）は、この README の文から選ぶ
export const MOCK_README = [
  "# testtool",
  "",
  "testtool is a command-line tool for checking deployment pipelines.",
  "It runs on Linux, macOS and Windows.",
  "",
  "## Install",
  "",
  "```bash",
  "go install acme/testtool@latest",
  "```",
  "",
  "testtool reads a YAML file and reports each failed step.",
  "",
].join("\n");
