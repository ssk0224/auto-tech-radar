---
title: "【徹底解剖】海外急上昇OSS「DiPlay」のアーキテクチャと商用展開"
emoji: "⚡"
type: "tech"
topics: ["kotlin", "oss", "github", "architecture", "programming"]
published: true
---

# DiPlay: 概要と革新性

**DiPlay**は、Androidベースの車載インフォテインメント（IVI）システム（特にBYD製車両のDiLinkシステム向けに最適化）上でネイティブに動作する独立型Apple CarPlayレシーバーアプリケーションです。

従来の車載Android端末におけるCarPlay利用は、Carlinkitなどの「外付けUSBハードウェアドングル（プロトコル変換アダプター）」を物理接続することが事実上の業界標準でした。しかしDiPlayは、追加ハードウェアを一切介さず、Android車載機のAPKレイヤー単体でCarPlayプロトコルのハンドシェイク、Wi-Fi Direct / 車載ホットスポット経由のワイヤレスリンク確立、映像デコード、オーディオバッファリング、HID入力を完結させます。

GitHubスター数は1万を超え、車載組み込み・車載Android（AOSP/AAOS）ハッキングコミュニティを中心に爆発的な注目を集めています。

---

## 解決する主要な課題とアーキテクチャ

### 従来の車載プロジェクションの課題
1. **追加ハードウェアへの依存**: 物理ドングル故障リスク、USBポートの占有、熱暴走による接続瞬断。
2. **車載ハードウェアとの統合不足**: 外部ドングル経由では車両側のHUD（ヘッドアップディスプレイ）やメータクラスタ（メーターパネル）へのルート案内表示（交差点名・矢印）、ステアリングスイッチ連動が困難。
3. **高遅延・オーディオアンダーラン**: 2重の変換レイヤーによる音声遅延、通話時のエコー、Siri入力の脱落。

### システムアーキテクチャと通信フロー
DiPlayは、Kotlinおよび低レイヤーNativeコードを用いてAndroid端末上にCarPlay Accessory Daemonを自律展開します。

```mermaid
graph TD
    subgraph iPhone ["iPhone Client (iOS)"]
        CP_Client[Apple CarPlay Engine]
        BT_WIFI["Bluetooth / Wi-Fi Direct / AP"]
    end

    subgraph AndroidHU ["BYD DiLink / Android Head Unit"]
        DiPlayApp["DiPlay Core Engine (APK)"]
        subgraph DiPlayEngine ["DiPlay Internal Stack"]
            Auth[Local MFi Auth Emulator]
            StreamReceiver["H.264/AAC Video & Audio Pipe"]
            AudioBuffer[Jitter Buffer & Opus Encoder]
            InputHandler["Touch / Steering / HID Bridge"]
        end
        MediaCodec["Android MediaCodec / SurfaceView"]
        VehicleCAN["BYD DiLink CAN-Bus Bridge / HUD"]
    end

    CP_Client <-->|1. Discovery & Pair (BT / Wi-Fi)| BT_WIFI
    BT_WIFI <-->|2. High-speed Stream (Wi-Fi 5GHz / USB)| DiPlayApp
    DiPlayApp --> Auth
    DiPlayApp --> StreamReceiver
    StreamReceiver -->|Decoded Frame| MediaCodec
    DiPlayApp --> InputHandler
    StreamReceiver -.->|Turn-by-Turn Nav Data| VehicleCAN
```

DiPlayは外部認証サーバーや常時インターネット接続を必要とせず、ローカル認証シーケンスを車載機内で完結。受信したH.264ストリームをAndroid標準の`MediaCodec`へダイレクトに流し込むことで、超低遅延描画とBYD DiLink特有の画面回転・HUD連携を実現しています。

---

## 競合ツール/商用SaaSとの徹底比較

| 項目 | DiPlay (本OSS) | Carlinkit / AutoKit (市販ドングル) | 自動車メーカー純正CarPlay |
|---|---|---|---|
| **必要ハードウェア** | 車載Android端末のみ（ドングル不要） | 専用USBハードウェア（約7,000〜15,000円） | メーカー純正ファームウェア |
| **接続方式** | 有線USB / Wi-Fi Direct / 車載AP / 外部LAN | 専用ドングル経由（USB/無線） | 有線USB / 無線 (Wi-Fi) |
| **HUD / メーター連携** | **可能**（BYD向けプロトコル解析済み） | 原則不可（単一画面出力のみ） | 完全ネイティブ対応 |
| **レイテンシ** | 極小（ダイレクトハードウェアデコード） | 中〜大（ドングル変換オーバーヘッド有） | 最小 |
| **導入コスト** | 完全無料（OSS） | ハードウェア購入費 | オプション費用（数万円〜数十万円） |
| **カスタマイズ性** | ソースコード改修・解像度/FPS変更可能 | ブラックボックス（設定変更制限あり） | 不可 |

---

## 📖 続きと実務キットについて
本記事は Auto Tech Radar の無料解説の抜粋です。

- 📖 **無料**: アーキテクチャ・競合比較・ライセンス考察の全文 → [Auto Tech Radar で読む](https://ssk0224.github.io/auto-tech-radar/radar/diplay/)
- 🔒 **有料（note）**: 導入提案書テンプレート・工数見積表・公式READMEに基づく導入手順 → [note の有料記事・メンバーシップ](https://note.com/vast_ixora7005/membership)
