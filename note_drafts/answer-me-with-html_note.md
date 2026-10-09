# 【最新OSS解体新書】answer-me-with-htmlとは？機能解説とビジネス活用・マネタイズ実践法

## はじめに：なぜ今、世界中で注目されているのか？

「AIエージェントに質問したら、ターミナルが文字化けしたような巨大なテキストで埋め尽くされて読む気を失った」
「LLMにHTMLで回答させたら、生成に1分近くかかり、APIトークン代も跳ね上がった」

Claude CodeやCursorなどの自律型AIエージェントを使い倒しているエンジニアなら、誰もが一度はこの壁に直面したことがあるはずです。

今、GitHubで急激にスター数を伸ばしているオープンソースソフトウェアが **`answer-me-with-html`**（スター数2,300超）です。

このツールのコンセプトは極めて明快です。
**「AIエージェントのテキストの壁を、人間が一瞬で理解できる1ページの美麗なHTMLに変える」**

しかし、単なる「HTML出力プロンプト」ではありません。
LLMの出力トークン数を**従来の約1/8に激減させ、生成速度を2.6倍に高速化**する画期的なアーキテクチャが実装されている点こそが、シリコンバレーをはじめとする世界中のテックコミュニティで熱狂されている理由です。

---

## 主な機能とアーキテクチャ

### 1. なぜ「手書きHTML」ではなく「Markdownドラフト」なのか？
LLMがHTMLを直書きする場合、トークンの大半は「CSSスタイル」「SVGのパス座標」「タグの閉じ忘れ防止」に浪費されます。これはAPI費用の増大だけでなく、生成速度の致命的な低下を招きます。

`answer-me-with-html` では、LLMは最小限のMarkdown構造（シーケンス定義、フロー図の接続関係、テキスト）のみを出力します。その出力をローカルの専用CLIが受け取り、わずか50ミリ秒で完全なシングルページHTMLにコンパイルします。

| 項目 | HTMLを直書きさせた場合 | answer-me-with-html |
| :--- | :--- | :--- |
| **出力トークン数** | 平均 4,893 tokens | **平均 612 tokens (約88%削減)** |
| **応答待ち時間** | 約31秒 | **約12秒 (2.6倍高速)** |
| **図の正確性** | 座標ズレ・矢印崩れ多発 | **Dagreエンジンにより完全自動整列** |

### 2. 多彩なコンポーネントと3Blue1Brown風の動画生成
HTML内には以下の要素が美しくレンダリングされます：
- **シーケンス図 / フロー図 / ER図**: エンジニアリング品質の作図
- **実ファイルコード引用**: プロジェクト内の実コードを行番号指定で直接インライン表示
- **インタラクティブ決定機能 (`ask`)**: 画面上で選択肢を選び、ボタン1つでエージェントへの返信プロンプトをクリップボードにコピー
- **解説動画生成機能**: 数式やアルゴリズムを、3Blue1Brown風のアニメーション＋音声ナレーション付き動画（WebM/MP4）として自動出力

### 3. クイックスタート手順
導入は極めてシンプルです。お使いのエージェント（Claude Code等）に以下を指示するだけです。

```text
Install Answer me with HTML: read https://raw.githubusercontent.com/QingYunA/answer-me-with-html/main/INSTALL.md and follow it.
```

インストール後、エージェントに「TCPの3ウェイハンドシェイクを図解して」「このリポジトリの依存関係を可視化して」と頼むだけで、ブラウザ上に美しくレイアウトされた1枚のHTMLが立ち上がります。

--------------------------------------------------
【有料ライン（推奨販売価格: 500円〜980円）ここから先は有料会員限定】
--------------------------------------------------

## 💡 このOSSを活用した具体的なマネタイズ戦略（受託・自社サービス化）

`answer-me-with-html` のコア技術は、単なる個人開発ツールに留まりません。「LLMの低コスト高速要約」×「ローカル完結型高品質レンダリング」の組み合わせは、法人向けビジネスにおいて極めて高い収益性を生み出します。

### 1. クライアントへの提案シナリオと受託開発モデル（想定単価：50万円〜150万円）

#### 【シナリオ：既存レガシーシステムの仕様可視化・リバースエンジニアリング支援】
- **ターゲット**: 数十万行のレガシーコード（Java、COBOL、PHP等）を抱え、仕様書が形骸化している企業。
- **提供ソリューション**:
  リポジトリ全体を走査するスクリプトを構築し、各モジュールの関係性、DBスキーマ（ER図）、APIシーケンス図を `answer-me-with-html` のテンプレートを活用して一括HTMLドキュメント群として生成するパイプラインを納品。
- **提案見積もりの内訳（例：総額120万円）**:
  - LLMコードベース解析プロンプト・チャンク設計: 40万円
  - `answer-me-with-html` カスタムテーマ（顧客ロゴ、コーポレートカラー適用）開発: 25万円
  - CI/CD連携（GitHub Actionsでの自動ドキュメント生成パイプライン）: 35万円
  - 導入レクチャー・マニュアル作成: 20万円
- **競合との差別化ポイント**:
  「外部SaaSにコードを一切送信せず、ローカル環境（GitHub Enterprise / 自社ランナー）の閉域網で単一HTMLとして納品・閲覧できる」というセキュリティ上の絶対的優位性をアピールします。

---

### 2. 自社マイクロSaaS / 有料ツールとしての構築アイデア

#### アイデアA：セキュリティ・アーキテクチャ監査レポート自動生成ツール
- **概要**: AWS/GCPのインフラ構成定義（Terraformコード）をアップロードすると、構成図、アクセス権限マトリクス、セキュリティリスク箇所のコールアウトを1つのHTMLダッシュボードとして出力するサービス。
- **価格モデル**: 月額3万円（月10回生成）〜15万円（無制限＋カスタムテンプレート）。

#### アイデアB：テクニカルブロガー・教材クリエイター向け「3b1b風 解説動画ビルダー」
- **概要**: 技術解説記事のMarkdownを貼り付けるだけで、動画シーン（シーケンス・フロー）と音声合成を同期させた動画（WebM/MP4）をワンクリックでダウンロードできるノーコードWebアプリ。

---

### 3. 競合ツールに対する圧倒的なコスト削減提案の作り方

顧客が既存のGenUI系SaaS（v0、カスタムチャットUI等）や、LLMにHTMLを直書きさせる方式を検討している場合、以下の数式を用いて**ROI（投資対効果）**を提示します。

#### コスト試算ロジック：
- **条件**: 社内開発者50名が、1日あたり1人5回アーキテクチャ解説をLLMにリクエスト（月間5,000回）。
- **直書きHTML方式**:
  - 1回あたり平均4,800出力トークン（Claude 3.5 Sonnet基準: $15 / 1M tokens）
  - 5,000回 × 4,800 tokens = 24M tokens ＝ **約$360 / 月（約5.4万円）**
  - 加えて、生成待ち時間（31秒 × 5,000回 ＝ 約43時間/月のエンジニア待機ロス）
- **answer-me-with-html方式**:
  - 1回あたり平均600出力トークン
  - 5,000回 × 600 tokens = 3M tokens ＝ **約$45 / 月（約6,800円）**
  - 生成待ち時間（12秒 × 5,000回 ＝ 約16時間/月）
- **削減効果**:
  **APIコストを月間約87%削減**し、**年間で300時間以上のエンジニア待機工数をカット**可能。「導入するだけでAPI費用の差額で開発費用が数ヶ月でペイする」という強力なトークを展開できます。

---

## 商用カスタマイズ・実装の勘所（コピペで使える設計ガイド）

自社プロダクトや受託案件に組み込む際の、実践的な設定および自動化スクリプトの例です。

### 1. 常時生成モード（Always-on Mode）のエンタープライズ設定
エージェントが結論を出すたびに、ブラウザをポップアップさせずにバックグラウンドでHTMLを出力させ、チャットの末尾にリンクを添付させるルール設定（`.claude/CLAUDE.md` や `AGENTS.md` に記載）：

```markdown
# Agent Directive: answer-me-with-html Enterprise Workflow
[answer-me-with-html always-on]
Whenever a reply provides an architecture review, database comparison, incident timeline, or technical summary:
1. Generate an internal Markdown draft structured with frontmatter.
2. Render it via shell: `node /path/to/am.mjs render input.md --no-open --theme shadcn --output ./reports/`
3. End your final reply with:
   "📊 Detailed Technical Report generated: file://[ABSOLUTE_PATH_TO_HTML]"
4. Skip this process for simple single-command queries or conversational confirmations.
```

### 2. Node.js バックエンドへの組み込みスクリプト例
自社Webサーバー側でLLMの出力を受け取り、HTMLファイルを生成してクライアントにURLを返すAPIエンドポイントの実装イメージです。

```javascript
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const execAsync = promisify(exec);

/**
 * LLMのMarkdownドラフトからスタンドアロンHTMLを生成するサービス関数
 */
export async function generateVisualReport(draftMarkdown, reportId) {
  const tmpDir = path.join('/tmp', 'reports');
  await fs.mkdir(tmpDir, { recursive: true });

  const inputPath = path.join(tmpDir, `${reportId}.md`);
  const outputPath = path.join(tmpDir, `${reportId}.html`);

  // 1. LLMが生成した最小Markdownを書き出し
  await fs.writeFile(inputPath, draftMarkdown, 'utf-8');

  // 2. answer-me-with-html CLIを実行 (shadcnテーマ、ブラウザ自動起動オフ)
  // am.mjs はバンドル済みファイルを参照
  const cliPath = path.resolve('./skills/answer-me-with-html/scripts/am.mjs');
  const command = `node ${cliPath} render "${inputPath}" -o "${outputPath}" --no-open --theme shadcn`;

  try {
    const { stdout, stderr } = await execAsync(command);
    
    // 3. 生成されたHTMLの確認
    const htmlExists = await fs.stat(outputPath).catch(() => false);
    if (!htmlExists) {
      throw new Error(`Rendering failed: ${stderr || stdout}`);
    }

    return {
      success: true,
      htmlPath: outputPath,
      rawOutput: stdout
    };
  } catch (error) {
    console.error('HTML Generation Error:', error);
    throw error;
  }
}
```

---

## まとめと今後の展望

AIエージェントの普及に伴い、「LLMに何を出力させるか」から「LLMの出力をいかに人間とシステムにとって最適な情報密度に圧縮・変換するか」へと開発トレンドがシフトしています。

`answer-me-with-html` は、**「LLMにはテキスト構造化のみに専念させ、レンダリングはローカルの超軽量コードに任せる」**という、極めてエレガントで実用的な解を提示しました。

MITライセンスであるため、自社サービスのUI改善、社内開発環境のDX、受託開発における高付加価値提案など、ビジネスへの転用余地は無限大です。ぜひ本稿のノウハウを元に、最先端のエージェントUI体験をクライアントや自社プロダクトに実装してみてください。