# swibostyle プロジェクトガイド

CSS組版によるEPUB生成CLIツール。EPUB優先の設計思想で、CSS差分による印刷対応を行う。

## クイックリファレンス

```bash
bun install          # 依存関係インストール
bun test             # 全テスト実行
bun run check        # typecheck + lint + format:check
bun run build        # 全パッケージビルド
```

## フォルダ構成

```
swibostyle-cli/
├── packages/
│   ├── core/                   # MIT - コアロジック (環境非依存)
│   │   └── src/
│   │       ├── adapters/       # アダプター層 (Storage/Image/CSS)
│   │       │   ├── storage/    # NodeStorageAdapter, MemoryStorageAdapter
│   │       │   ├── image/      # SharpImageAdapter, NoopImageAdapter
│   │       │   └── css/        # SassAdapter, PassthroughCSSAdapter
│   │       ├── ssg/            # SSGビルドシステム
│   │       │   ├── build.ts    # メインビルドフロー
│   │       │   ├── context.ts  # BuildContext定義
│   │       │   ├── router.ts   # Hono風ルーター
│   │       │   ├── scanner.ts  # ファイルスキャナー
│   │       │   ├── handlers.ts # デフォルトハンドラー
│   │       │   └── types.ts    # SSG型定義
│   │       ├── templates/      # 組み込みテンプレート関数
│   │       │   └── xhtml.ts    # XHTMLページテンプレート
│   │       ├── config/         # book.json読み込み
│   │       ├── utils/          # ユーティリティ (mime, frontmatter, xhtml)
│   │       ├── types.ts        # 型定義
│   │       └── index.ts        # Public API
│   │
│   ├── cli/                    # MIT - CLIインターフェース
│   │   └── src/
│   │       ├── commands/       # build, preview, pdf コマンド
│   │       ├── ui/             # ロガー、スピナー
│   │       └── index.ts        # Commander.js エントリ
│   │
│   ├── create-swibostyle/      # MIT - プロジェクトテンプレート生成
│   │   └── src/
│   │       ├── scaffold.ts     # プロジェクト生成
│   │       └── index.ts        # @clack/prompts CLI
│   │
│   ├── epub-validator/         # MIT - EPUB検証 (W3C EPubCheck)
│   │
│   ├── epub-validator-linux-x64/ # MIT - Linux x64用JREバンドル版
│   │
│   └── pdf-server/             # AGPL - PDF生成サーバー (Vivliostyle)
│       └── src/
│           ├── server.ts       # Express サーバー
│           └── renderer.ts     # Playwright PDF生成
│
├── tests/
│   ├── fixtures/               # テスト用サンプルプロジェクト
│   │   ├── sample-project/
│   │   └── sample-project-ssg/
│   └── integration/            # 結合テスト
│
├── docs/
│   ├── ARCHITECTURE.md         # 詳細設計書
│   └── SSG.md                  # SSG設計書
│
├── .github/workflows/ci.yml    # GitHub Actions CI
├── oxlint.json                 # Lintルール (type-aware, no style)
├── oxfmt.json                  # フォーマット設定
└── tsconfig.base.json          # TypeScript基本設定
```

## 主要な型

```typescript
// ビルドターゲット
type BuildTargetType = "epub" | "print" | "pod";

// 本の設定 (book.json)
interface BookConfig {
  title: string;
  authors: Author[];
  publisher: string;
  lang: string;
  bookId: { epub: string; print?: string };
  layout: "reflowable" | "pre-paginated";
  pageDirection: "ltr" | "rtl";
  primaryWritingMode: "horizontal-tb" | "vertical-rl";
  targets?: { epub?: TargetConfig; print?: TargetConfig; pod?: TargetConfig };
}

// ビルドコンテキスト
interface BuildContext {
  storage: StorageAdapter;     // ファイル操作
  imageAdapter: ImageAdapter;  // 画像処理
  cssAdapter: CSSAdapter;      // CSS処理
  paths: PathConfig;
  config: BookConfig;
  logger?: Logger;
  onProgress?: ProgressCallback;
}
```

## アダプターパターン

環境に応じて実装を切り替え可能：

| アダプター | 実装 | 用途 |
|-----------|------|------|
| StorageAdapter | NodeStorageAdapter | Node.js/Bunファイルシステム |
|  | MemoryStorageAdapter | テスト/ブラウザ |
| ImageAdapter | SharpImageAdapter | 本番画像処理 |
|  | NoopImageAdapter | テスト/サイズ取得のみ |
| CSSAdapter | SassAdapter | Sass処理 |
|  | PassthroughCSSAdapter | 素のCSS |

## ビルドフロー

```
Clean → Copy → CSS → Image → Markdown → OPF → Navigation → Archive
```

## スクリプト

```bash
# 開発
bun run typecheck     # 型チェック
bun run lint          # oxlint
bun run lint:fix      # oxlint --fix
bun run format        # oxfmt --write
bun run format:check  # oxfmt --check
bun run check         # 全チェック (typecheck + lint + format:check)

# テスト
bun test                    # 全テスト
bun test packages/core/src  # ユニットテスト
bun test tests/integration  # 結合テスト

# ビルド
bun run build         # 全パッケージビルド
bun run clean         # distディレクトリ削除
```

## テスト

- ユニットテスト: `packages/*/src/**/*.test.ts`
- 結合テスト: `tests/integration/*.test.ts`
- テストフレームワーク: bun:test

## ライセンス

- `core`, `cli`, `create-swibostyle`, `epub-validator`, `epub-validator-linux-x64`: MIT
- `pdf-server`: AGPL-3.0 (Vivliostyle依存のため分離)

## 注意事項

- book.jsonはJSON5形式（コメント許可）
- 画像リサイズはEPUBストア要件に準拠 (Apple Books: 4MP以下, Google: 3200px以下)
- oxfmtはJSON非対応のため.oxfmtignoreで除外
