# 【受託80万〜250万】海外急上昇OSS「wordcraft」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに：なぜ今、世界中で爆発的に注目されているのか？

GitHub上で瞬く間にスター数11,000超えを記録し、世界中のエンジニアとエンタープライズDX担当者の度肝を抜いているOSSがあります。それが **「WordCraft」** です。

一言で言えば、**「Microsoft Word を、依存ゼロの純粋な Rust でゼロから完全再実装した怪物プロジェクト」**。

しかも単なるデスクトップクローンではありません。最初から **「AIエージェント（LLM）によって制御されること」を前提に設計されており、Model Context Protocol（MCP）と422個のコマンドAPIを標準装備** しています。

### なぜ、これが「80万〜250万円の受託案件・DX提案」になるのか？
現在、多くの大企業や自治体、金融機関、士業ファームは以下の「オフィスドキュメントのジレンマ」で頭を抱えています。

1. **セキュリティの壁**: クラウドOffice（Microsoft 365 / Google Workspace）に機密契約書や顧客データを渡したくない。
2. **既存自動化の限界**: Python-docxやLibreOfficeのヘッドレス変換は、フォントやレイアウトの再現性が低く、改ページがズレて使い物にならない。
3. **AI連携の断絶**: ChatGPTなどのAIに文章を書かせても、最終的な「Wordのリボン操作」「スタイルの微調整」「変更履歴（Track Changes）付きの赤入れ」を自動化するプロトコルが存在しなかった。

WordCraftは、この3大ペインを **「完全オンプレミス」「ミリ秒単位の描画速度」「ネイティブMCPサーバー連携」** によって一撃で解決します。

「社内の機密文書作成ワークフローをAI化し、月間数百時間の工数を削減するオンプレミス基盤」として提案すれば、**中小〜中堅企業相手でも80万円〜250万円の受託構築フィーは極めて自然に通ります。**

---

## 主な機能とアーキテクチャ概要

WordCraftのアーキテクチャは、Rustの設計思想を極限まで活かしたレイヤード構造です。

- **GPUネイティブ描画（egui）**: Electron製アプリのようなメモリ肥大化が一切なく、数十MBの超軽量フットプリント。
- **1.4msの爆速レイアウトエンジン**: 188ページに及ぶ大作レポートも1.4ミリ秒で再計算。タイピング時の引っかかりがゼロ。
- **422のコマンドとMCPネイティブ対応**: `select_text`, `format.bold`, `inspect_document`, `track_changes` などの操作がすべてJSON/CLI/MCP経由で実行可能。

```bash
# ヘッドレスで起動し、Claudeなどのエージェントと即時接続
wordcraft-cli mcp
```

### 📊 商用化・受託開発シミュレーション早見表
| 項目 | 分析結果 |
|---|---|
| **想定受託開発単価** | 80万円 〜 250万円 |
| **主な想定クライアント** | 金融・証券 / 法律・特許事務所 / 製造業DX部門 / 医療法人 |
| **商用SaaS化の狙い目** | 機密保持特化型ローカルAI文書校正・自動生成エージェント |
| **実装・導入難易度** | 中級（Rustバイナリビルド / Docker / Python・Node連携） |

### 🔒 有料エリアで完全公開する実践ナレッジ
- クライアントを即決させる受託開発提案シナリオ（想定見積もり内訳・ペイン解決策）
- 自社マイクロSaaSとして月額課金化するための設計仕様書
- コピペで本番投入できる環境構築・設定ファイル（YAML/JSON/ENV）完全版
- クライアント向け「社内稟議・提案書ドラフト」

> 💡 **【投資対効果（ROI）と会社経費精算について】**
> 本記事の価格は **980円（ランチ1回分）** です。しかし、この記事に記載されている『提案書テンプレート』と『本番環境構築手順』を活用すれば、**1件80万円〜250万円の受託案件受注や、社内の高額SaaSコスト削減** に直結します。
> ※noteは購入後、マイページよりインボイス対応領収書が即時発行可能です。会社の「技術調査費」「自己研鑽費」として経費精算いただけます。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
--------------------------------------------------

## 💡 このOSSを活用した具体的なマネタイズ戦略（受託・自社サービス化）

### 1. クライアントへの提案シナリオと受託開発モデル

#### 【案件モデルA】金融・士業向け「閉域網AI契約書レビュー＆自動生成システム」
- **ターゲット**: 地方銀行、信用金庫、弁護士法人、特許事務所、中堅不動産企業
- **クライアントの切実な課題（ペイン）**:
  - 秘密保持義務があるため、契約書ドラフトを外部AI（ChatGPTやClaude Web版）にコピペできない。
  - レビュー後の赤入れ修正（Wordの「変更履歴の記録」機能）を手動で行うため、1通あたり1〜2時間かかる。
  - 既存のAI契約書SaaSは月額数十万円と高額なうえ、クラウド送信が社内規定でNG。
- **提供ソリューション構成**:
  - 社内オンプレミスサーバー（または自社VPC）上に、ローカルLLM（Llama 3 / Qwen等）と `wordcraft-cli mcp` をコンテナ化してデプロイ。
  - 契約書（.docx）をドロップすると、AIエージェントがWordCraftのMCPサーバー経由で内部構造を解析。
  - 修正案を「変更履歴（Track Changes）」および「余白コメントバルーン」としてWordCraftネイティブに書き込み、Word完全互換の.docxを生成して返却。
- **想定見積もり・価格構成案（合計：180万円〜250万円）**:
  - 要件定義・契約書ひな形マッピング設計: 40万円
  - WordCraft CLI/MCPサーバー閉域環境コンテナ構築: 50万円
  - ローカルLLM/API連携オーケストレーター開発（Python / FastAPI）: 60万円
  - UIフロントエンド（社内向けWebダッシュボード）構築: 50万円
  - 納品後保守・プロンプトチューニング（月額顧問）: 10万円〜/月

---

### 2. 自社マイクロSaaS / 有料ツールとしての構築アイデア

#### アイデア①: 『LegalCraft AI』— 完全ローカル完結型・変更履歴付き契約書リライター
- **製品概要**: ElectronではなくWordCraftのWebAssembly/ネイティブビルドをベースにした、買い切り・サブスク型デスクトップアプリ。
- **ターゲット顧客**: フリーランス法務、中小企業総務、コンサルタント。
- **提供価値**: 外部通信を一切遮断した状態で、ローカルPC内のLLM（Ollama等）と連携。契約書をドラッグ＆ドロップすると、「自社有利」「折衷案」「相手方指定」などのトーンに合わせて、Wordの変更履歴付きで修正箇所を一括生成。
- **価格設定**: 月額 4,980円 / 年額 49,800円、または買い切り 29,800円。

#### アイデア②: 『DocuFlow Engine』— CI/CD・開発者向け超高速DOCX/PDF帳票パイプライン
- **製品概要**: バックエンド開発者向けAPIサービス。JSONデータをPOSTすると、WordCraftのレイアウトエンジンを用いて、1ミリ秒台で完全な帳票DOCX・PDFを出力するマイクロSaaS。
- **提供価値**: 従来のHeadless Chromeやwkhtmltopdf、Puppeteerによる「メモリバカ食い・激重PDF生成」を置き換え、CPU負荷を1/100に圧縮。
- **価格設定**: 月間10,000回生成まで無料、以降1リクエストあたり0.1円（月額従量課金）。

---

### 3. 競合ツール（商用SaaS）に対する圧倒的なコスト削減提案の作り方

大手エンタープライズが契約する「Microsoft 365 Copilot」や「DocuSign Gen」「各種AI契約書SaaS」との比較テーブルです。

| 比較項目 | クラウド型AI契約書SaaS | M365 Copilot | WordCraft 構築基盤（提案システム） |
|---|---|---|---|
| **月額ライセンス費 (100名)** | 30万円〜100万円/月 | 約45万円/月 ($30/人) | **0円（OSSベースのため無償）** |
| **初期構築・受託費** | 0円〜数十万 | 導入支援数十万 | **120万〜200万円（一括償却可能）** |
| **年運用コスト (初年度/2年目)** | 360万〜 / 360万〜 | 540万〜 / 540万〜 | **200万円 / 24万円（保守のみ）** |
| **データプライバシー** | クラウド預託（規約リスク有） | クラウド（Azure） | **100% 自社内閉域（漏洩リスクゼロ）** |
| **2年間の削減効果** | — | — | **最大700万円以上のコスト削減** |

#### 意思決定者（CIO/CFO）を落とすキラーフレーズ
> 「御社が年間500万円以上支払い続けているクラウドOfficeやAIサービスのライセンス費用を、**今年度のIT投資枠（一括償却）で自社専用資産にリプレイス** できます。データは社外に1バイトも出ず、セキュリティ審査は最短で通過します。」

---

## 商用カスタマイズ・実装の勘所（コピペで使える設計ガイド）

### 1. DockerコンテナによるWordCraft MCPサーバーのヘッドレス運用
AIエージェントから安全にWordCraftを呼び出すための `Dockerfile` です。

```dockerfile
# syntax=docker/dockerfile:1
FROM rust:1.80-slim as builder

WORKDIR /app
RUN apt-get update && apt-get install -y git build-essential pkg-config libfontconfig1-dev && rm -rf /var/lib/apt/lists/*

# ソースコードの取得
RUN git clone https://github.com/storytold/wordcraft.git .
RUN cargo build --release -p wordcraft-cli

FROM debian:bookworm-slim
WORKDIR /workspace
RUN apt-get update && apt-get install -y libfontconfig1 ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/wordcraft-cli /usr/local/bin/wordcraft-cli

# セキュリティ: ワークスペース以外の読み書きを遮断
VOLUME ["/workspace/docs"]
ENV RUST_LOG=info

ENTRYPOINT ["wordcraft-cli", "mcp", "--automation-read-root", "/workspace/docs", "--automation-write-root", "/workspace/docs"]
```

### 2. PythonからWordCraftのMCPサーバーを呼び出してドキュメントを自動校正するオーケストレーター

以下のスクリプトを、FastAPIなどの社内APIサーバーに組み込んで即日運用可能です。

```python
import subprocess
import json
from pathlib import Path

class WordCraftController:
    def __init__(self, cli_path: str = "wordcraft-cli"):
        self.cli_path = cli_path

    def inspect_document(self, docx_path: str) -> dict:
        """ドキュメントの構造（テキスト、スタイル、段落）をJSONとして抽出"""
        cmd = [self.cli_path, "inspect", docx_path]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return json.loads(result.stdout)

    def apply_agent_edits(self, template_path: str, output_path: str, search_text: str, replace_text: str):
        """WordCraftのコマンドカタログを用いて安全に文書を編集保存"""
        commands = [
            f'select.text={{"text":"{search_text}"}}',
            f'type.text={{"text":"{replace_text}"}}',
            'format.bold'
        ]
        
        cmd = [
            self.cli_path, "run",
            "--template", template_path,
            "--save", output_path
        ]
        for c in commands:
            cmd.extend(["--cmd", c])
            
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError(f"WordCraft execution failed: {res.stderr}")
        return output_path

    def convert_to_pdf(self, docx_path: str, pdf_path: str):
        """GPU/CPUネイティブ高速PDF出力"""
        cmd = [self.cli_path, "convert", docx_path, pdf_path]
        subprocess.run(cmd, check=True)

# 使用例
if __name__ == "__main__":
    controller = WordCraftController()
    # 1. 既存ひな形の検査
    # doc_info = controller.inspect_document("contract.docx")
    
    # 2. 自動修正の適用と保存
    controller.apply_agent_edits(
        template_path="sample_nda.docx",
        output_path="modified_nda.docx",
        search_text="第1条（目的）",
        replace_text="第1条（改定目的：AI生成条項）"
    )
    
    # 3. 検証用PDFの一括書き出し
    controller.convert_to_pdf("modified_nda.docx", "modified_nda.pdf")
    print("Document successfully generated and converted.")
```

### 3. 社内運用時のセキュリティ境界と権限管理
- **ファイルアクセス制限**: `wordcraft-cli mcp` には `--automation-read-root` および `--automation-write-root` フラグが備わっています。エージェントがOSの任意ファイル（`/etc/passwd` や個人ディレクトリ）を読み書きできないよう、必ずコンテナマウントされた特定パスのみに隔離（Jail化）してください。
- **ログの取り扱い**: WordCraftは標準でドキュメント内の機密テキストをログに出力しない設計（`WORDCRAFT_NO_PREFS` オプション）になっています。社内監査ログを残す際は、リバースプロキシ（FastAPI側）でハッシュ値とタイムスタンプのみを記録し、情報漏洩を防ぎます。

---

## まとめと今後の展望

WordCraftの登場は、「Officeドキュメントは重く、自動化しづらい」というエンジニア界隈の常識を覆しました。
現在はAlpha版ながら、Wordの主要機能の約88%がコマンド化されており、Beta版に向けてSmartArtや図形互換性の強化が急ピッチで進んでいます。

### 今すぐ先行者利益を獲得するためのアクションプラン
1. **今週中**: リポジトリをクローンし、ローカルで `cargo run -- -sample` および `wordcraft-cli mcp` を動かして動作速度を体感する。
2. **来週**: 既存の社内契約書や報告書フォーマットを `inspect` コマンドでJSON化し、Pythonスクリプトから自動生成できるかプロトタイプを作成する。
3. **今月中**: 懇意のクライアントや自社DX推進室に対し、「年間ライセンスを削減しつつ閉域網でAI契約書作成を自動化する提案書」を持ち込む。

誰もが気づいていない「Pure Rust × MCP Office」の圧倒的な市場価値を、ぜひあなたのビジネスに組み込んでください。

---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）にご加入いただくと、本日公開のこの記事を含む全アーカイブ（15本以上・総額14,700円相当）が初月即時読み放題になります。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS #エンジニア #プログラミング #副業 #受託開発 #スタートアップ #最新技術 #GitHub