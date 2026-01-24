# Swibo Style Generator (SSG) for EPUB

CSS組版によるEPUB/印刷向け静的生成ツール。
Hono風のファイルベースルーティングで柔軟なカスタマイズが可能。

---

## 概要

**SSG = Swibo Style Generator**

「Static Site Generator」とのダブルミーニング。
WebのSSGがHTMLサイトを生成するように、SwiboのSSGはEPUBを生成する。

### 特徴

- **ファイルベースルーティング**: ソースのフォルダ構成がそのまま出力構成に
- **Hono風API**: `createRouter()`, `app.get()`, Context オブジェクト
- **デフォルトハンドラー**: OPF、Navigation、画像リサイズ等は自動処理
- **カスタマイズ可能**: 任意のルートを上書き可能
- **ターゲット別ビルド**: epub / print / pod

---

## フォルダ構成

ソースフォルダはEPUBのフォルダ構成に準拠（電書協フォーマット）。

```
project/
├── book.json                         # メタデータ（全ハンドラーに渡される）
└── src/
    └── item/                         # OEBPS相当
        ├── index.ts                  # ルート定義（オプション）
        ├── style/
        │   ├── epub.scss             # EPUB用スタイル
        │   ├── print.scss            # 印刷用スタイル
        │   └── base.scss             # 共通スタイル
        ├── image/
        │   ├── cover.jpg
        │   └── ...
        └── xhtml/
            ├── index.ts              # 動的ルート定義（オプション）
            ├── p-001-cover.md        # Markdownコンテンツ
            ├── p-002-intro.md
            └── p-003-custom.ts       # カスタムページ（オプション）
```

### 自動生成されるファイル

以下のファイルはデフォルトハンドラーにより自動生成される。
ユーザーがファイルを配置すれば上書き可能。

| ファイル | 内容 |
|---------|------|
| `mimetype` | `application/epub+zip` |
| `META-INF/container.xml` | OPFへの参照 |
| `item/standard.opf` | パッケージメタデータ |
| `item/navigation-documents.xhtml` | 目次・ガイド |

---

## 変換ルール

| ソース拡張子 | 出力 | 処理 |
|-------------|------|------|
| `*.md` | `*.xhtml` | VFM → XHTML |
| `*.ts` / `*.js` | 拡張子除去 | ハンドラー実行 → 出力 |
| `*.scss` | `*.css` | Sass コンパイル |
| `*.jpg` / `*.png` 等 | 同じ | リサイズ/クロップ（ターゲット依存） |
| その他 | 同じ | コピー |

### 例

```
src/item/standard.opf.ts      → _build/item/standard.opf
src/item/xhtml/p-001.md       → _build/item/xhtml/p-001.xhtml
src/item/style/epub.scss      → _build/item/style/style.css
src/item/image/cover.jpg      → _build/item/image/cover.jpg (リサイズ済み)
```

---

## ハンドラーの優先順位

より具体的（子）が優先、親がフォールバック。

```
高 ← 優先度 → 低

子 index.ts  >  親 index.ts  >  ファイルベース  >  内部デフォルト
```

### 例: `item/xhtml/cover.xhtml` の解決

1. `src/item/xhtml/index.ts` で `cover.xhtml` を登録 → **優先**
2. `src/item/index.ts` で `xhtml/cover.xhtml` を登録
3. `src/item/xhtml/cover.md` ファイルが存在
4. `@swibostyle/core` 内部デフォルト（該当なし）

---

## API設計

### ファイルベースのハンドラー

```typescript
// src/item/standard.opf.ts
import { createHandler } from "@swibostyle/core";

export default createHandler((c) => {
  // c.xml() で XML を返す
  return c.xml`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${c.book.title}</dc:title>
    <dc:language>${c.book.lang}</dc:language>
  </metadata>
  ...
</package>`;
});
```

### index.ts でのルート登録（Hono風）

```typescript
// src/item/xhtml/index.ts
import { createRouter } from "@swibostyle/core";
import fs from "fs";

const app = createRouter();

// 画像から動的にページを生成
const images = fs.readdirSync("./src/item/image")
  .filter(f => f.endsWith(".jpg"));

for (const img of images) {
  const name = img.replace(/\.jpg$/, "");

  app.get(`${name}.xhtml`, (c) => {
    const info = c.getImage(`image/${img}`);
    return c.html`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta name="viewport" content="width=${info.width}, height=${info.height}" />
  <title>${c.book.title}</title>
</head>
<body>
  <svg viewBox="0 0 ${info.width} ${info.height}">
    <image href="../image/${img}" width="${info.width}" height="${info.height}" />
  </svg>
</body>
</html>`;
  });
}

export default app;
```

### 生成しないルート

```typescript
// src/item/standard.opf.ts
import { createHandler } from "@swibostyle/core";

export default createHandler((c) => {
  // notFound() を返すとファイルを生成しない
  if (c.target === "print") {
    return c.notFound();
  }
  return c.xml`...`;
});
```

---

## Context オブジェクト

ハンドラーに渡されるコンテキスト。

```typescript
interface Context {
  // メタデータ
  book: BookConfig;              // book.json の内容
  target: BuildTargetType;       // "epub" | "print" | "pod"
  path: string;                  // 現在のルートパス (例: "item/xhtml/cover.xhtml")

  // レスポンスヘルパー
  xml(content: TemplateStringsArray, ...values: unknown[]): Response;
  html(content: TemplateStringsArray, ...values: unknown[]): Response;
  text(content: string): Response;
  binary(data: Uint8Array): Response;
  notFound(): Response;          // ファイル生成しない

  // ルート情報
  routes: RouteInfo[];           // 全ルート情報（OPF生成時に使用）

  // ユーティリティ
  getImage(path: string): ImageInfo | null;

  // ソースファイル（ファイルベースハンドラーの場合）
  file?: Uint8Array;
}

interface RouteInfo {
  path: string;
  type: "xhtml" | "image" | "css" | "opf" | "navigation" | "other";
  metadata?: {
    title?: string;
    displayOrder?: number;
    isNavigationItem?: boolean;
    // ...
  };
}

interface ImageInfo {
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp" | "svg";
}
```

---

## 内部デフォルトハンドラー

`@swibostyle/core` が提供するフォールバックハンドラー。
ユーザーが同じパスにファイルや `index.ts` でルートを定義すれば上書きされる。

```typescript
// @swibostyle/core 内部

const defaultRouter = createRouter();

// ===== EPUB必須ファイル（自動生成） =====

// mimetype（ファイルがなくても自動生成）
defaultRouter.get("mimetype", (c) => {
  return c.text("application/epub+zip");
});

// META-INF/container.xml（ファイルがなくても自動生成）
defaultRouter.get("META-INF/container.xml", (c) => {
  return c.xml`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="item/standard.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`;
});

// OPF（ファイルがなくても自動生成）
defaultRouter.get("item/standard.opf", (c) => {
  return c.xml(renderDefaultOPF(c));
});

// Navigation（ファイルがなくても自動生成）
defaultRouter.get("item/navigation-documents.xhtml", (c) => {
  return c.html(renderDefaultNavigation(c));
});

// ===== ファイル変換ハンドラー =====

// CSS (Sass → CSS)
defaultRouter.get("item/style/*.scss", async (c) => {
  const css = await compileSass(c.file!, c.path);
  return c.text(css);
});

// 画像 (リサイズ)
defaultRouter.get("item/image/*", async (c) => {
  if (c.target === "epub") {
    const resized = await resizeForEpub(c.file!);
    return c.binary(resized);
  }
  return c.binary(c.file!);
});

// Markdown → XHTML
defaultRouter.get("item/xhtml/*.md", async (c) => {
  const xhtml = await renderMarkdown(c.file!, c);
  return c.html(xhtml);
});
```

---

## ビルドフロー

```
1. book.json 読み込み
2. src/ を再帰的にスキャン
3. 各 index.ts を実行（深い順: 子 → 親）
   → registerRoute() でルートが登録される
4. ファイルベースのルートを収集
5. 内部デフォルトハンドラーをマージ（未登録のみ）
6. 全ルートを依存順にソート
   - 画像 → XHTML → Navigation → OPF の順
7. 各ルートのハンドラーを実行
8. 出力をファイルに書き込み
9. ZIP化して EPUB 生成
```

---

## ターゲット別の違い

| 項目 | epub | print | pod |
|------|------|-------|-----|
| CSS | epub.scss | print.scss | pod.scss |
| 画像リサイズ | あり (4MP制限) | なし | なし |
| 出力形式 | .epub (ZIP) | ディレクトリ | ディレクトリ |
| 用途 | 電子書籍ストア | Vivliostyle → PDF | Print on Demand |

### ターゲット別ハンドラー

```typescript
// src/item/xhtml/p-001-ad.ts
import { createHandler } from "@swibostyle/core";

export default createHandler((c) => {
  // EPUB のみ広告ページを挿入
  if (c.target !== "epub") {
    return c.notFound();
  }

  return c.html`...広告コンテンツ...`;
});
```

---

## 将来的な拡張

### ミドルウェア（将来）

```typescript
// src/item/xhtml/index.ts
const app = createRouter();

// 全XHTMLページに共通ヘッダーを追加
app.use("*.xhtml", async (c, next) => {
  const result = await next();
  return addCommonHeader(result);
});

export default app;
```

### JSXサポート（将来）

```typescript
// src/item/xhtml/cover.tsx
import { createHandler, jsx } from "@swibostyle/core";

export default createHandler((c) => {
  return (
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <title>{c.book.title}</title>
      </head>
      <body>
        <h1>{c.book.title}</h1>
      </body>
    </html>
  );
});
```

---

## 移行ガイド（現行 → SSG）

### 現行構成

```
src/
├── markdown/        # 独自構成
├── style/
├── image/
├── templates/       # EJSテンプレート
└── META-INF/
```

### SSG構成

```
src/
└── item/
    ├── style/
    ├── image/
    └── xhtml/       # markdown/ から移動、.md のまま

# 以下は自動生成（オプションで上書き可）
# - mimetype
# - META-INF/container.xml
# - item/standard.opf
# - item/navigation-documents.xhtml
```

### 主な変更点

1. **フォルダ構成**: EPUBフォルダ構成に準拠
2. **テンプレート**: EJS → TypeScript関数
3. **動的ページ**: `book.json` の `pagesToBeGeneratedFromImage` → `index.ts` で動的生成
4. **カスタマイズ**: テンプレート編集 → ハンドラー定義

---

## 実装ステップ

1. **ルーター基盤**: `createRouter()`, `createHandler()`, Context
2. **ファイルスキャナー**: src/ を走査してルート収集
3. **デフォルトハンドラー**: OPF, Navigation, CSS, Image, Markdown
4. **ビルドパイプライン統合**: 既存パイプラインをルーターベースに移行
5. **index.ts実行**: 動的インポートとルート登録
6. **create-swibostyle更新**: 新しいフォルダ構成でスキャフォールド
7. **テスト・ドキュメント更新**

---

## サンプルプロジェクト分析からの課題

`tests/fixtures/sample-project-ssg/` の変換から以下の課題と設計ポイントを特定。

### フロントマター属性

Markdownのフロントマターで以下の属性をサポートする必要がある：

| 属性 | 用途 | 例 |
|-----|------|-----|
| `title` | ページタイトル | `title: 表紙` |
| `displayOrder` | ソート順（OPF spine順） | `displayOrder: 100` |
| `viewport` | 固定レイアウトのビューポート | `viewport: width=1815, height=2580` |
| `htmlClass` | html要素のclass | `htmlClass: horizontal fixed-layout page-cover` |
| `epubPageProperty` | OPFのproperties属性 | `epubPageProperty: "page-spread-left"` |
| `includeIf` | ターゲット限定（このターゲットのみ含める） | `includeIf: "epub"` |
| `excludeIf` | ターゲット除外（このターゲットでは除外） | `excludeIf: "print"` |
| `isGuideItem` | EPUBガイドに含める | `isGuideItem: true` |
| `isNavigationItem` | ナビゲーションに含める | `isNavigationItem: true` |
| `epubType` | EPUB semantic type | `epubType: cover` |
| `outputFileName` | 出力ファイル名を上書き | `outputFileName: p-cover` |

### 課題1: ターゲット別ファイルの命名競合

現在のサンプルでは同じ `outputFileName` を持つターゲット別ファイルが存在：

```
p-000-cover-epub.md   → includeIf: epub  → p-cover.xhtml
p-000-cover-print.md  → includeIf: print → p-cover.xhtml
p-900-colophon-epub.md  → includeIf: epub  → p-colophon.xhtml
p-900-colophon-print.md → includeIf: print → p-colophon.xhtml
```

**設計案**: ファイルベースルーティングでは `includeIf` を評価してルート登録をスキップ。
同じ出力パスに対して異なるターゲット用ハンドラーが登録される形になる。

```typescript
// 内部動作イメージ
if (frontmatter.includeIf && frontmatter.includeIf !== target) {
  return; // このターゲットではルート登録しない
}
```

### 課題2: outputFileName によるルート変換

`outputFileName` 属性があると、ソースファイル名と出力ルートが異なる：

```
p-010-toc.md → p-toc.xhtml (outputFileName: p-toc)
p-020-fmatter-001.md → p-frontmatter-001.xhtml (暗黙の変換?)
```

**設計案**:
1. `outputFileName` があれば `${outputFileName}.xhtml` に変換
2. なければデフォルトで `ソースファイル名.md → ソースファイル名.xhtml`

### 課題3: TOCページ内のリンク

TOCページ内のリンクは変換後のファイル名を参照：

```markdown
* [キャラクター・会社設定](./p-frontmatter-001.xhtml)
* [序章](./p-100-section0.xhtml)
```

**考慮点**: ユーザーは変換後のファイル名を知っている必要がある。
`outputFileName` を使用する場合はそれを参照。

### 課題4: 画像パスの相対参照

Markdownから画像への参照は相対パス：

```html
<image xlink:href="../image/cover.jpg"/>
```

**確認結果**: 新フォルダ構成 `src/item/xhtml/` → `src/item/image/` で
`../image/` の相対パスは正しく機能する。問題なし。

### 課題5: 固定レイアウトページ

固定レイアウトページには以下が必要：
- `viewport` でサイズ指定
- `htmlClass` に `fixed-layout` を含める
- SVG埋め込みで画像表示

```markdown
---
viewport: width=1847, height=2591
htmlClass: horizontal fixed-layout page-section-cover
---
<svg viewBox="0 0 1847 2591">
  <image xlink:href="../image/chapter1.png"/>
</svg>
```

**設計案**: Markdownハンドラーで `viewport` があれば固定レイアウト用XHTMLを生成。

### 課題6: CSS条件分岐

コンテンツ内でCSSクラスによる条件分岐：

```markdown
<div class="epub-only">
* [特典](./p-300-appendix.xhtml)
</div>
```

**現状維持**: CSSで `.epub-only { display: none; }` を印刷用CSSに記述。
SSG側の変更は不要。

### 課題7: CSSエントリーポイント

ターゲット別のCSSエントリーポイント選択：

| ターゲット | CSS |
|-----------|-----|
| epub | `epub.scss` |
| print | `print.scss` |
| pod | `pod.scss` |

**設計案**: `book.json` の `targets` 設定で指定（現行通り）

```json
{
  "targets": {
    "epub": { "css": "epub.scss" },
    "print": { "css": "print.scss" }
  }
}
```

### 課題8: displayOrder のソート

OPFのspine順序は `displayOrder` で決定。
ファイル名のプレフィックス番号に依存しない設計にする。

**設計案**: `displayOrder` がない場合はファイル名のアルファベット順をフォールバック。

### 課題9: epubPageProperty の伝播

`epubPageProperty` はOPFのspine要素の `properties` 属性に反映される：

```xml
<itemref idref="p-cover" properties="page-spread-left" />
```

**設計案**: `RouteInfo.metadata` に `epubPageProperty` を含め、OPFハンドラーで参照。

### RouteInfo の拡張案

```typescript
interface RouteMetadata {
  title?: string;
  displayOrder?: number;
  viewport?: string;
  htmlClass?: string;
  epubPageProperty?: string;
  includeIf?: string;
  excludeIf?: string;
  isGuideItem?: boolean;
  isNavigationItem?: boolean;
  epubType?: string;
  outputFileName?: string;
}

interface RouteInfo {
  path: string;                    // 出力パス (例: "item/xhtml/p-cover.xhtml")
  sourcePath?: string;             // ソースパス (例: "src/item/xhtml/p-000-cover-epub.md")
  type: "xhtml" | "image" | "css" | "opf" | "navigation" | "other";
  metadata: RouteMetadata;
}
```
