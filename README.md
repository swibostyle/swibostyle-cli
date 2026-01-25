# swibostyle

CSS組版によるEPUB生成CLIツール。

**EPUB優先**の設計思想で、CSS差分による印刷対応を行います。

## 特徴

| 項目 | Vivliostyle CLI | swibostyle |
|------|-----------------|------------|
| 主出力 | PDF | **EPUB** |
| 印刷対応 | 直接生成 | CSS差分で派生 |
| ライセンス | AGPL | **MIT** (コア) + AGPL (PDFサーバー分離) |
| PDF生成 | 内蔵 | Playwright経由（AGPL隔離） |
| 実行環境 | Node.js | **Node.js / Bun** |

## インストール

```bash
bun install
```

## 使い方

```bash
# EPUB生成
bun run swibo build

# 印刷用ファイル生成（PDF変換用）
bun run swibo build --target print

# プレビューサーバー起動
bun run swibo preview

# PDF生成（pdf-serverが必要）
bun run swibo pdf
```

## 開発コマンド

```bash
# 全パッケージビルド
bun run build

# 型チェック
bun run typecheck

# Lint
bun run lint
bun run lint:fix

# フォーマット
bun run format
bun run format:check

# 全チェック (typecheck + lint + format:check)
bun run check

# テスト
bun test                    # 全テスト
bun test packages/core/src  # ユニットテスト
bun test tests/integration  # 結合テスト
```

## パッケージ構成

```
swibostyle-cli/
├── packages/
│   ├── core/                        # MIT - コアロジック (環境非依存)
│   ├── cli/                         # MIT - CLIインターフェース
│   ├── create-swibostyle/           # MIT - プロジェクトテンプレート生成
│   ├── epub-validator/              # MIT - EPUB検証 (EPubCheck)
│   ├── epub-validator-linux-x64/    # MIT - Linux x64用JREバンドル版
│   └── pdf-server/                  # AGPL - PDF生成サーバー (Vivliostyle)
├── tests/
│   ├── fixtures/                    # テスト用サンプルプロジェクト
│   └── integration/                 # 結合テスト
└── docs/
    ├── ARCHITECTURE.md              # 詳細設計書
    └── SSG.md                       # SSG設計書
```

### 各パッケージの役割

| パッケージ | ライセンス | 説明 |
|-----------|-----------|------|
| `@swibostyle/core` | MIT | ビルドパイプライン、アダプター層 |
| `@swibostyle/cli` | MIT | コマンドラインインターフェース |
| `create-swibostyle` | MIT | プロジェクトスキャフォールド |
| `@swibostyle/epub-validator` | MIT | W3C EPubCheckによるEPUB検証 |
| `@swibostyle/epub-validator-linux-x64` | MIT | Linux x64用JREバンドル版（Java不要） |
| `@swibostyle/pdf-server` | AGPL-3.0 | Vivliostyle + Playwright PDF生成 |

## アーキテクチャ

### アダプターパターン

環境に応じて実装を切り替え可能：

| アダプター | 実装 | 用途 |
|-----------|------|------|
| StorageAdapter | NodeStorageAdapter | Node.js/Bunファイルシステム |
|  | MemoryStorageAdapter | テスト/ブラウザ |
| ImageAdapter | SharpImageAdapter | 本番画像処理 |
|  | NoopImageAdapter | テスト/サイズ取得のみ |
| CSSAdapter | SassAdapter | Sass処理 |
|  | PassthroughCSSAdapter | 素のCSS |

### ビルドフロー

```
Clean → Copy → CSS → Image → Markdown → OPF → Navigation → Archive
```

詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照してください。

## book.json

プロジェクトのメタデータは `book.json` (JSON5形式) で設定：

```json5
{
  "title": "書籍タイトル",
  "authors": [
    { "name": "著者名", "role": "aut" }
  ],
  "publisher": "出版社",
  "lang": "ja",
  "bookId": {
    "epub": "urn:uuid:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  },
  "layout": "pre-paginated",
  "pageDirection": "rtl",
  "primaryWritingMode": "vertical-rl",
  "targets": {
    "epub": { "css": "epub.scss" },
    "print": { "css": "print.scss" }
  }
}
```

## ライセンス

- `core`, `cli`, `create-swibostyle`, `epub-validator`: MIT
- `pdf-server`: AGPL-3.0 (Vivliostyle依存のため分離)

## クレジット

- **コアロジック（オリジナルgulp版）**: [@butameron](https://github.com/butameron)
- **CLI実装**: 主に [Claude Code](https://claude.ai/code) により作成

---

*本プロジェクトは[Vivliostyle](https://vivliostyle.org/)のCSS組版技術を活用しています。*
