# 海外急上昇OSS「DroidDeck」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

Droid-Deck/DroidDeck は 2026-09-25 に GitHub で作成されたリポジトリです。2026-10-15 時点のスター数は 8,333 です。

## 主な機能とアーキテクチャ概要

- DroidDeck は SteamOS の体験を Android で提供します。Adreno 搭載の携帯機で Valve の Steam クライアントを Big Picture で動かし、Windows のゲームを Valve の ARM64 版 Proton で動かします。
  - 原文（README）: DroidDeck brings the SteamOS experience to Android: Valve's Steam client in Big Picture on your Adreno handheld, with Windows games through Valve's ARM64 Proton.
- 対応する Adreno の機器（730 以降、または 8xx）で Android 9 以降を使います。
  - 原文（README）: Use Android 9 or newer on a supported Adreno device (730 or newer, or 8xx).
- root は不要です。
  - 原文（README）: No root is required.
- ランタイムに約 3 GB、デスクトップとエミュレーターにさらに 1.1 GB を見込んでください。
  - 原文（README）: Allow about 3 GB for the runtime and 1.1 GB more for the desktop and emulators.
- Releases から APK をインストールし、Linux のランタイムを入れてから Play を押してサインインします。Steam は初回の起動時にダウンロードされます。
  - 原文（README）: Install the APK from Releases, install the Linux runtime, then press Play and sign in. Steam downloads on first launch.
- Store は Flatpak を使って Flathub から Linux のアプリとゲーム（ARM64 ビルド）をインストールします。
  - 原文（README）: The Store installs Linux apps and games from Flathub (ARM64 builds) with Flatpak; with additional options to install Appimages and set up scripts.
- Stores は GOG、Epic Games、Amazon Games にサインインし、ゲームを Games のストレージにダウンロードします。
  - 原文（README）: Stores (Setup › Stores › "Show Stores in the rail") signs in to GOG, Epic Games and Amazon Games and downloads games into the Games storage.
- Android 14 以降では、Steam の起動前に開発者オプションで Disable child process restrictions を有効にする必要があります。
  - 原文（README）: On Android 14 and newer, before Steam launches, you must turn on Disable child process restrictions in Developer options.

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: droiddeck_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**（出品時にタグ欄へ貼り付けてください）
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub
