---
layout: "../../layouts/Layout.astro"
title: "anatomy - 複雑な概念をリアルな動的機械へ変換するアイソメトリック生成エージェントスキル"
description: "Claude CodeなどのAIエージェントと連携し、詳細かつインタラクティブな等角投影図（SVG/WebGL/3D）を自動生成・幾何監査するゼロ依存OSS「anatomy」を徹底解説。"
pubDate: "2026-10-14"
tags: ["JavaScript", "OSS", "GitHub", "AI", "SVG", "WebGL", "Architecture"]
repoUrl: "https://github.com/wheresryan22/anatomy"
repoCreatedAt: "2026-10-08"
stars: 9975
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
---

# anatomy: 概要

wheresryan22/anatomy は 2026-10-08 に GitHub で作成されたリポジトリです。2026-10-14 時点のスター数は 9,975 です。

ソフトウェアアーキテクチャや分散システムの内部動作を説明する際、多くのエンジニアは「四角と矢印」で構成された抽象的なブロック図（C4モデルやフローチャート）に頼りがちです。しかし、キャッシュヒット率の挙動、トークンバケットによるレート制限、データベース接続プーリングといった動的なアルゴリズムは、静止した図形だけでは直感的な理解に限界があります。

**「anatomy」**は、この課題を根本から覆すアプローチを採用したAIエージェント向けスキル（Claude Code、OpenCode、Codex等に対応）です。抽象的な技術コンセプトを入力すると、その概念を模した「実在しそうな精密機械」を物理モデルとしてメタファー化。数十〜数百のソリッドパーツからなる等角投影図（Isometric Illustration）を、ピュアSVG、WebGLシェーダー、3D投影技術を駆使してコードとして自動生成します。

最大の革新性は以下の点にあります：
- **概念の物理機械化**: キャッシュ検証を「ピンタンブラー錠」、複数キャンバスのGPU描画を「ガントリープロッター」のように、動作原理が直感的に伝わる物理ギミックへ自律的に再設計。
- **純粋なゼロ依存（Zero-Dependency）**: 外部npmライブラリを一切使わず、Node.js標準モジュールのみで幾何計算からレンダリングまで完結。
- **自律的幾何学監査（Geometry Audit）**: 生成したパーツ同士の干渉（パイプの衝突、浮遊オブジェクト、描画順序の破綻）をヘッドレスChromeと幾何解析スクリプトで自己テストし、厳密に修正。

---

## 解決する主要な課題とアーキテクチャ

システム設計書の作成において、高品質なインタラクティブ図解を作成するには、3Dモデラー（Blender等）やUIデザイナー（Figma）、フロントエンドエンジニアが数週間かけて共同作業を行う必要がありました。anatomyはこの制作パイプラインをAIエージェントの自律ループへ統合します。

### アーキテクチャと実行フロー

anatomyは、Agent Skills仕様に準拠したプロンプトフレームワークと、自社開発の軽量幾何エンジン（`kit/`）で構成されています。

```mermaid
graph TD
    User(["開発者・アーキテクト"]) -->|プロンプト入力| Agent["AI Agent: Claude Code / Codex"]
    Agent -->|SKILL.md 読み込み| Skill[Anatomy Workflow Engine]
    
    subgraph IterativeDesignLoop ["Iterative Design Loop"]
        Skill --> Step1["1. 数値・制約抽出<br>閾値, レート, 容量"]
        Step1 --> Step2["2. 物理メタファー策定<br>機械構造・パーツリスト化"]
        Step2 --> Step3["3. 幾何モデリング kit/<br>iso-kit, lathe, tube"]
        Step3 --> Step4["4. レンダリング生成<br>SVG階層 + WebGL Canvas"]
        Step4 --> Step5["5. 自動検証 & 監査<br>kit/audit.mjs & Chrome"]
        Step5 -->|干渉・浮遊検知| Step3
    end

    Step5 -->|パス完了| Output[成果物出力]
    Output --> HTML[Standalone HTML]
    Output --> SVG[Standalone SVG]
    Output --> React["React/Next.js Component"]
```

#### コアコンポーネント構成
1. **`SKILL.md`**: エージェントに「まず真の数値を集め、機械を発明し、背面から前面へ描画せよ」という職人的制約を与えるシステムプロンプト。
2. **`kit/iso-kit.ts`**: 等角カメラ変換、4トーンシェーディング、深度ソート（Painter's Algorithm）を司るコア描画基盤。
3. **`kit/tube.mjs` & `lathe.mjs`**: 任意の3次元軸に沿った配管・配線、旋盤加工のような回転体のパラメトリック生成。
4. **`kit/gl.mjs`**: 火炎、排気、液体、波紋などベクターでは表現不可能な流体を表現するため、SVGのレイヤー間にアイソメトリック視点で挟み込むWebGLシェーダー。
5. **`kit/audit.mjs`**: 部品間のクリッピングや貫通バグ、未接合ラインを幾何数学的にチェックする監査システム。

---

## インストール（README からの転記）

以下は [README](https://github.com/wheresryan22/anatomy#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
npx skills add wheresryan22/anatomy -g
```

```text
/anatomy explain how a token bucket rate limiter works, interactive
```

```sh
mkdir -p ~/.claude/skills/anatomy && curl -L https://github.com/wheresryan22/anatomy/archive/refs/heads/main.tar.gz | tar -xz --strip-components=1 -C ~/.claude/skills/anatomy
```

```sh
mkdir -p ~/.gemini/antigravity/skills/anatomy && curl -L https://github.com/wheresryan22/anatomy/archive/refs/heads/main.tar.gz | tar -xz --strip-components=1 -C ~/.gemini/antigravity/skills/anatomy
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/wheresryan22/anatomy/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
