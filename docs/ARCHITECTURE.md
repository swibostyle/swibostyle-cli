# swibostyle アーキテクチャ設計書

## 概要

swibostyleは、CSS組版によるEPUB生成を主目的としたツールチェーンです。
Vivliostyle CLIとは異なり、**EPUB優先**の設計思想を持ち、CSS差分による印刷対応を行います。

### 設計思想

| 項目 | Vivliostyle CLI | swibostyle |
|------|-----------------|------------|
| 主出力 | PDF | **EPUB** |
| 印刷対応 | 直接生成 | CSS差分で派生 |
| ライセンス | AGPL | **MIT** (コア) + AGPL (PDFサーバー分離) |
| PDF生成 | 内蔵 | Playwright経由（AGPL隔離） |
| 実行環境 | Node.js | **Node.js / Bun / Browser** |

---

## モノレポ構成

```
swibostyle/
├── packages/
│   ├── core/                 # MIT - コアロジック (環境非依存)
│   ├── cli/                  # MIT - CLIインターフェース
│   ├── create-swibostyle/    # MIT - プロジェクトテンプレート生成
│   └── pdf-server/           # AGPL - PDF生成サーバー (分離)
│
├── package.json              # bun workspaces
├── tsconfig.base.json
├── bunfig.toml
└── LICENSE                   # MIT
```

---

## @swibostyle/core 設計

### 設計目標

1. **環境非依存**: Node.js / Bun / Browser で動作
2. **ストレージ抽象化**: ローカルFS / Object Storage / In-Memory に対応
3. **プロセッサ分離**: 画像処理等はアダプターで差し替え可能
4. **ストリーミング対応**: 大容量ファイルのメモリ効率的な処理

### レイヤー構成

```
┌─────────────────────────────────────────────────────────────┐
│                      Public API                              │
│  build(), createEpub(), processMarkdown(), etc.             │
├─────────────────────────────────────────────────────────────┤
│                      Builder Layer                           │
│  Pipeline, Clean, Copy, Archive                              │
├─────────────────────────────────────────────────────────────┤
│                    Processor Layer                           │
│  CSS, Markdown, Image, OPF, Navigation                       │
├─────────────────────────────────────────────────────────────┤
│                    Adapter Layer (抽象化)                    │
│  StorageAdapter, ImageAdapter, CSSAdapter                    │
├─────────────────────────────────────────────────────────────┤
│                Platform Implementations                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Node.js │  │   Bun    │  │ Browser  │  │   OPS    │   │
│  │ Adapter  │  │ Adapter  │  │ Adapter  │  │ Adapter  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Adapter インターフェース

### StorageAdapter

ファイルシステム操作を抽象化し、異なるストレージバックエンドに対応。

```typescript
interface StorageAdapter {
  // 読み取り
  readFile(path: string): Promise<Uint8Array>;
  readTextFile(path: string, encoding?: string): Promise<string>;
  readDir(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileStat>;

  // 書き込み
  writeFile(path: string, data: Uint8Array | string): Promise<void>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  rm(path: string, options?: { recursive?: boolean }): Promise<void>;
  copyFile(src: string, dest: string): Promise<void>;

  // ストリーミング (オプショナル)
  createReadStream?(path: string): ReadableStream<Uint8Array>;
  createWriteStream?(path: string): WritableStream<Uint8Array>;
}

interface FileStat {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  mtime?: Date;
}
```

#### 実装例

| 実装 | 用途 | 環境 |
|------|------|------|
| `NodeStorageAdapter` | ローカルファイルシステム | Node.js / Bun |
| `MemoryStorageAdapter` | インメモリ処理 | All |
| `OPSStorageAdapter` | Object Storage (S3, R2, GCS) | All |
| `BrowserStorageAdapter` | File System Access API / IndexedDB | Browser |

---

### ImageAdapter

画像処理を抽象化。環境によって実装を切り替え。

```typescript
interface ImageAdapter {
  // 基本情報
  getSize(data: Uint8Array): Promise<ImageDimensions>;
  getFormat(data: Uint8Array): Promise<ImageFormat>;

  // 変換
  resize(data: Uint8Array, options: ResizeOptions): Promise<Uint8Array>;
  crop(data: Uint8Array, options: CropOptions): Promise<Uint8Array>;
  convert(data: Uint8Array, format: ImageFormat, options?: ConvertOptions): Promise<Uint8Array>;

  // PSD対応 (オプショナル)
  convertPsdToPng?(data: Uint8Array): Promise<Uint8Array>;
}

interface ImageDimensions {
  width: number;
  height: number;
}

type ImageFormat = 'png' | 'jpeg' | 'webp' | 'svg';

interface ResizeOptions {
  width?: number;
  height?: number;
  fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside';
  quality?: number;
}

interface CropOptions {
  left: number;
  top: number;
  width: number;
  height: number;
}
```

#### 実装例

| 実装 | ライブラリ | 環境 |
|------|-----------|------|
| `SharpImageAdapter` | sharp | Node.js / Bun |
| `CanvasImageAdapter` | Canvas API | Browser |
| `WasmImageAdapter` | libvips-wasm / squoosh | All |
| `NoopImageAdapter` | なし (サイズ取得のみ) | All |

---

### CSSAdapter

CSS処理を抽象化。Sass / PostCSS / 素のCSS に対応。

```typescript
interface CSSAdapter {
  process(input: CSSInput): Promise<CSSOutput>;

  // 依存関係解決 (オプショナル)
  resolveDependencies?(entryPath: string): Promise<string[]>;
}

interface CSSInput {
  content: string;
  path?: string;
  sourceMap?: boolean;
}

interface CSSOutput {
  css: string;
  sourceMap?: string;
  dependencies?: string[];
}
```

#### 実装例

| 実装 | ライブラリ | 環境 |
|------|-----------|------|
| `SassAdapter` | sass | Node.js / Bun |
| `PostCSSAdapter` | postcss | All (プラグイン依存) |
| `PassthroughAdapter` | なし | All |
| `LightningCSSAdapter` | lightningcss | All |

---

## ディレクトリ構造

```
packages/core/
├── src/
│   ├── index.ts                    # Public API エクスポート
│   ├── types.ts                    # 共通型定義
│   │
│   ├── adapters/                   # アダプターインターフェース & 実装
│   │   ├── index.ts
│   │   ├── storage/
│   │   │   ├── interface.ts        # StorageAdapter インターフェース
│   │   │   ├── node.ts             # NodeStorageAdapter
│   │   │   ├── memory.ts           # MemoryStorageAdapter
│   │   │   └── ops.ts              # OPSStorageAdapter (S3/R2/GCS)
│   │   │
│   │   ├── image/
│   │   │   ├── interface.ts        # ImageAdapter インターフェース
│   │   │   ├── sharp.ts            # SharpImageAdapter
│   │   │   ├── noop.ts             # NoopImageAdapter
│   │   │   └── wasm.ts             # WasmImageAdapter (将来)
│   │   │
│   │   └── css/
│   │       ├── interface.ts        # CSSAdapter インターフェース
│   │       ├── sass.ts             # SassAdapter
│   │       ├── postcss.ts          # PostCSSAdapter
│   │       └── passthrough.ts      # PassthroughAdapter
│   │
│   ├── builder/                    # ビルドパイプライン
│   │   ├── index.ts
│   │   ├── pipeline.ts             # メインパイプライン
│   │   ├── context.ts              # BuildContext
│   │   ├── clean.ts
│   │   ├── copy.ts
│   │   └── archive.ts              # EPUB ZIP生成
│   │
│   ├── processors/                 # コンテンツプロセッサ
│   │   ├── index.ts
│   │   ├── css.ts                  # CSS処理オーケストレーション
│   │   ├── markdown.ts             # VFM + EJS → XHTML
│   │   ├── image.ts                # 画像処理オーケストレーション
│   │   ├── opf.ts                  # OPF生成
│   │   └── navigation.ts           # Navigation Documents生成
│   │
│   ├── config/                     # 設定管理
│   │   ├── index.ts
│   │   ├── loader.ts               # 設定ファイル読み込み
│   │   ├── schema.ts               # バリデーションスキーマ
│   │   └── defaults.ts             # デフォルト値
│   │
│   └── utils/                      # ユーティリティ
│       ├── index.ts
│       ├── xhtml.ts                # XHTML変換
│       ├── frontmatter.ts          # Frontmatter解析
│       ├── mime.ts                 # MIMEタイプ判定
│       └── path.ts                 # パス操作 (環境非依存)
│
├── package.json
└── tsconfig.json
```

---

## Public API

### 基本的な使用例 (CLI / Node.js)

```typescript
import { build, createNodeContext } from '@swibostyle/core';

// Node.js環境用のコンテキスト作成
const context = createNodeContext({
  srcDir: './src',
  buildDir: './_build',
  releaseDir: './_release',
});

// EPUB生成
await build(context, { target: 'epub' });

// 印刷用生成
await build(context, { target: 'print' });
```

### Web SPA での使用例

```typescript
import {
  build,
  createBuildContext,
  MemoryStorageAdapter,
  NoopImageAdapter,
  PassthroughCSSAdapter,
} from '@swibostyle/core';

// OPSからファイルを取得してMemoryStorageに展開
const storage = new MemoryStorageAdapter();
await loadFromOPS(storage, 'bucket/project-id/');

// ブラウザ用コンテキスト作成
const context = createBuildContext({
  storage,
  imageAdapter: new NoopImageAdapter(),  // または WasmImageAdapter
  cssAdapter: new PassthroughCSSAdapter(),
});

// EPUB生成 (Uint8Array として返却)
const epubData = await build(context, {
  target: 'epub',
  output: 'memory',  // ファイル出力ではなくメモリ返却
});

// ダウンロードまたはOPSにアップロード
downloadBlob(epubData, 'book.epub');
```

### OPS (Object Storage) 直接操作

```typescript
import {
  build,
  createBuildContext,
  OPSStorageAdapter,
  SharpImageAdapter,
  SassAdapter,
} from '@swibostyle/core';

// S3/R2/GCS アダプター
const storage = new OPSStorageAdapter({
  provider: 'r2',  // 's3' | 'r2' | 'gcs'
  bucket: 'my-bucket',
  prefix: 'projects/book-001/',
  credentials: { /* ... */ },
});

const context = createBuildContext({
  storage,
  imageAdapter: new SharpImageAdapter(),
  cssAdapter: new SassAdapter(),
});

// OPS上で直接ビルド
await build(context, { target: 'epub' });
```

---

## BuildContext

ビルド実行時の依存性を注入するコンテキストオブジェクト。

```typescript
interface BuildContext {
  // アダプター
  storage: StorageAdapter;
  imageAdapter: ImageAdapter;
  cssAdapter: CSSAdapter;

  // パス設定
  paths: {
    src: string;
    build: string;
    release: string;
    markdown: string;
    styles: string;
    images: string;
    templates: string;
  };

  // 設定
  config: BookConfig;

  // ロガー (オプショナル)
  logger?: Logger;

  // 進捗コールバック (オプショナル)
  onProgress?: (event: ProgressEvent) => void;
}

interface ProgressEvent {
  phase: 'clean' | 'copy' | 'css' | 'markdown' | 'image' | 'opf' | 'archive';
  current: number;
  total: number;
  message?: string;
}
```

### コンテキストファクトリ

```typescript
// Node.js / Bun 環境用
function createNodeContext(options: NodeContextOptions): BuildContext;

// カスタムアダプター用
function createBuildContext(options: BuildContextOptions): BuildContext;

// デフォルトアダプター自動選択
function createAutoContext(options: AutoContextOptions): BuildContext;
```

---

## 処理フロー

### EPUB生成フロー

```
┌─────────────┐
│   Start     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Clean     │  BuildDir をクリア
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Copy     │  META-INF, mimetype, 画像をコピー
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    CSS      │  SCSS/CSS → style.css
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Image     │  PSD変換, リサイズ, クロップ
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Markdown   │  VFM + EJS → XHTML
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    OPF      │  standard.opf 生成
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Navigation  │  navigation-documents.xhtml 生成
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Archive    │  ZIP → EPUB
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    End      │
└─────────────┘
```

---

## 型定義

### BookConfig

```typescript
interface BookConfig {
  // 基本情報
  title: string;
  authors: Author[];
  publisher: string;
  lang: string;

  // 識別子
  bookId: {
    epub: string;
    print?: string;
  };

  // レイアウト設定
  layout: 'reflowable' | 'pre-paginated';
  pageDirection: 'ltr' | 'rtl';
  primaryWritingMode: 'horizontal-tb' | 'vertical-rl';

  // 画像設定
  originalResolution?: string;
  epubImageCrops?: ImageCropConfig[];

  // ページ生成設定
  pagesToBeGeneratedFromImage?: PageFromImageConfig[];

  // ビルドターゲット設定
  targets?: {
    epub?: TargetConfig;
    print?: TargetConfig;
    pod?: TargetConfig;
  };
}

interface Author {
  name: string;
  role: 'aut' | 'ill' | 'edt' | 'trl';
  fileAs?: string;  // ソート用
}

interface TargetConfig {
  css: string;           // エントリーCSSファイル
  enableImageResizing?: boolean;
  enableImageCrop?: boolean;
}

interface ImageCropConfig {
  fileNamePattern: string;  // 正規表現パターン
  bleed: { x: number; y: number };
}

interface PageFromImageConfig {
  id: string;
  fileName: string;
  title?: string;
  frontmatter?: Partial<Frontmatter>;
}
```

### Frontmatter

```typescript
interface Frontmatter {
  title?: string;
  outputFileName?: string;
  displayOrder?: number;

  // ナビゲーション
  isNavigationItem?: boolean;
  isGuideItem?: boolean;
  guideType?: 'cover' | 'toc' | 'bodymatter' | 'copyright';

  // EPUB属性
  epubPageProperty?: 'page-spread-left' | 'page-spread-right';

  // 条件付きビルド
  includeIf?: 'epub' | 'print' | 'pod';
  excludeIf?: 'epub' | 'print' | 'pod';

  // 固定レイアウト用
  viewport?: string;
  htmlClass?: string;
}
```

### ContentItem

```typescript
type ContentItem = XHTMLContent | ImageContent;

interface XHTMLContent {
  type: 'xhtml';
  id: string;
  fileName: string;
  title: string;
  html: string;
  frontmatter: Frontmatter;
  properties?: string;
  displayOrder: number;
  fallbackImage?: string;
}

interface ImageContent {
  type: 'image';
  id: string;
  fileName: string;
  dimensions: ImageDimensions;
  contentType: string;
}
```

---

## 環境別対応表

| 機能 | Node.js/Bun | Browser | Web Worker |
|------|-------------|---------|------------|
| ファイル読み書き | ✅ fs | ✅ Memory/OPFS | ✅ Memory |
| Sass処理 | ✅ sass | ⚠️ dart-sass-wasm | ⚠️ dart-sass-wasm |
| 画像リサイズ | ✅ sharp | ⚠️ Canvas/Wasm | ⚠️ Wasm |
| PSD変換 | ✅ psd.js | ⚠️ psd.js | ⚠️ psd.js |
| ZIP生成 | ✅ archiver | ✅ fflate/zip.js | ✅ fflate |
| VFM処理 | ✅ | ✅ | ✅ |
| EJS処理 | ✅ | ✅ | ✅ |

⚠️ = 追加実装または代替ライブラリが必要

---

## ブラウザ対応時の考慮事項

### バンドルサイズ最適化

```typescript
// 軽量版インポート (ブラウザ向け)
import { build } from '@swibostyle/core/lite';

// フル版インポート (Node.js向け)
import { build } from '@swibostyle/core';
```

### Web Worker対応

```typescript
// メインスレッド
const worker = new Worker('./swibostyle-worker.js');
worker.postMessage({
  type: 'build',
  files: fileMap,
  config: bookConfig,
  target: 'epub',
});

worker.onmessage = (e) => {
  if (e.data.type === 'progress') {
    updateProgressUI(e.data.event);
  } else if (e.data.type === 'complete') {
    downloadEpub(e.data.epub);
  }
};
```

### Progressive Enhancement

1. **Tier 1** (最小): VFM + EJS + ZIP のみ (全環境)
2. **Tier 2** (標準): + CSS処理 (Sass Wasm or PostCSS)
3. **Tier 3** (フル): + 画像処理 (Canvas or Wasm)

---

## パッケージ依存関係

```
┌─────────────────────┐
│  @swibostyle/cli    │
└──────────┬──────────┘
           │ depends on
           ▼
┌─────────────────────┐     ┌─────────────────────────┐
│  @swibostyle/core   │◄────│  @swibostyle/pdf-server │
└─────────────────────┘     │  (AGPL, optional)       │
                            └─────────────────────────┘

┌─────────────────────┐
│  create-swibostyle  │ (独立、テンプレートのみ)
└─────────────────────┘
```

---

## ライセンス戦略

| パッケージ | ライセンス | 理由 |
|-----------|-----------|------|
| @swibostyle/core | MIT | AGPL依存なし、再利用性重視 |
| @swibostyle/cli | MIT | core依存のみ |
| create-swibostyle | MIT | テンプレートのみ |
| @swibostyle/pdf-server | AGPL-3.0 | Vivliostyle Viewer依存 |

### AGPL隔離の仕組み

- `pdf-server` は独立したHTTPサーバーとして動作
- CLI/Webからは HTTP API 経由で通信
- ソースコード上の依存関係なし
- npm install 時も別パッケージとして扱う

```bash
# 通常インストール (MIT のみ)
npm install @swibostyle/cli

# PDF生成が必要な場合 (AGPL)
npm install @swibostyle/pdf-server
```

---

## 次のステップ

1. **Phase 1**: モノレポ基盤構築
2. **Phase 2**: core パッケージ実装 (Node.js アダプター優先)
3. **Phase 3**: cli パッケージ実装
4. **Phase 4**: create-swibostyle 実装
5. **Phase 5**: pdf-server 実装
6. **Phase 6**: Browser アダプター実装
7. **Phase 7**: OPS アダプター実装
