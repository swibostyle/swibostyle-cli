/**
 * 動的ルート生成のサンプル
 *
 * このindex.tsでは、画像ファイルから閲覧用XHTMLページを動的に生成する例を示す。
 * book.jsonのpagesToBeGeneratedFromImageに依存せず、
 * ファイルシステムから直接画像を読み取ってルートを登録する。
 */
import { createRouter } from "@swibostyle/core";

const app = createRouter();

// 挿絵画像から閲覧ページを生成
// illustration1.png, illustration2.png → p-illustration-1.xhtml, p-illustration-2.xhtml
const illustrationImages = [
  { file: "illustration1.png", order: 116, title: "挿絵1" },
  { file: "illustration2.png", order: 126, title: "挿絵2" },
];

for (const img of illustrationImages) {
  const pageName = img.file.replace(/\.png$/, "").replace(/(\d+)$/, "-$1");

  app.get(`p-${pageName}.xhtml`, (c) => {
    const info = c.getImage(`image/${img.file}`);
    if (!info) {
      return c.notFound();
    }

    return c.html`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${c.book.lang}" lang="${c.book.lang}"
      class="horizontal fixed-layout page-illustration">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${info.width}, height=${info.height}" />
  <title>${img.title} - ${c.book.title}</title>
  <link rel="stylesheet" type="text/css" href="../style/style.css" />
</head>
<body>
  <p><svg xmlns="http://www.w3.org/2000/svg" version="1.1"
       xmlns:xlink="http://www.w3.org/1999/xlink"
       width="100%" height="100%" viewBox="0 0 ${info.width} ${info.height}"
       role="img" aria-label="${img.title}">
    <image width="${info.width}" height="${info.height}" xlink:href="../image/${img.file}"/>
  </svg></p>
</body>
</html>`;
  }, {
    // メタデータをルート情報として登録（OPF生成時に使用）
    metadata: {
      title: img.title,
      displayOrder: img.order,
      viewport: `width=${800}, height=${1200}`, // 実際はc.getImage()で取得
      htmlClass: "horizontal fixed-layout page-illustration",
      epubPageProperty: "page-spread-left",
    },
  });
}

// 図版画像からページを生成（EPUB専用）
// fig_1-1.png, fig_1-2.png, fig_2-1.png, fig_2-2.png
const figureImages = [
  { file: "fig_1-1.png", order: 117, title: "図1-1", chapter: 1 },
  { file: "fig_1-2.png", order: 118, title: "図1-2", chapter: 1 },
  { file: "fig_2-1.png", order: 127, title: "図2-1", chapter: 2 },
  { file: "fig_2-2.png", order: 128, title: "図2-2", chapter: 2 },
];

for (const fig of figureImages) {
  const pageName = fig.file.replace(/\.png$/, "");

  app.get(`p-${pageName}.xhtml`, (c) => {
    // EPUB専用ページ
    if (c.target !== "epub") {
      return c.notFound();
    }

    const info = c.getImage(`image/${fig.file}`);
    if (!info) {
      return c.notFound();
    }

    return c.html`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${c.book.lang}" lang="${c.book.lang}"
      class="horizontal fixed-layout page-figure">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${info.width}, height=${info.height}" />
  <title>${fig.title} - ${c.book.title}</title>
  <link rel="stylesheet" type="text/css" href="../style/style.css" />
</head>
<body>
  <figure>
    <svg xmlns="http://www.w3.org/2000/svg" version="1.1"
         xmlns:xlink="http://www.w3.org/1999/xlink"
         width="100%" height="100%" viewBox="0 0 ${info.width} ${info.height}"
         role="img" aria-label="${fig.title}">
      <image width="${info.width}" height="${info.height}" xlink:href="../image/${fig.file}"/>
    </svg>
    <figcaption>${fig.title}</figcaption>
  </figure>
</body>
</html>`;
  }, {
    metadata: {
      title: fig.title,
      displayOrder: fig.order,
      htmlClass: "horizontal fixed-layout page-figure",
      includeIf: "epub", // EPUB専用
    },
  });
}

export default app;
