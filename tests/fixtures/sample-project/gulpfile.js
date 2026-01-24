"use strict";
import gulp from 'gulp';

import module from "module";
const require = module.createRequire(import.meta.url);

import fs from 'fs';
const fsp = fs.promises;
import path from 'path';
import dartSass from 'sass';
import gulpSass from 'gulp-sass';
const sass = gulpSass(dartSass);
import concat from 'gulp-concat';
import vfm from '@vivliostyle/vfm';
import ejs from 'ejs';
import archiver from 'archiver';
import xmldom from 'xmldom';
import psd from 'psd';
const imageSizeOf = require('image-size'); //ESM非対応
const merge = require('merge-stream'); //ESM非対応
import sharp from 'sharp';
import util from 'util';
const json = require('comment-json'); //ESM非対応
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
const yaml = require('yaml'); //ESM非対応
import {unified} from 'unified';

//var webserver = require("gulp-webserver");

const SOURCE_DIR = "./src";
const SOURCE_META_DIR = `${SOURCE_DIR}/META-INF`;
const SOURCE_STYLES_DIR = `${SOURCE_DIR}/style`;
const SOURCE_IMAGE_DIR = `${SOURCE_DIR}/image`;
const SOURCE_MARKDOWN_DIR = `${SOURCE_DIR}/markdown`;
const SOURCE_TEMPLATE_DIR = `${SOURCE_DIR}/templates`;

const TEMP_DIR = "./_temp";

const BUILD_DIR = "./_build";
const BUILD_META_DIR = `${BUILD_DIR}/META-INF`;
const BUILD_ITEM_DIR = `${BUILD_DIR}/item`;
const BUILD_STYLES_DIR = `${BUILD_DIR}/item/style`;
const BUILD_IMAGE_DIR = `${BUILD_DIR}/item/image`;
const BUILD_XHTML_DIR = `${BUILD_DIR}/item/xhtml`;

const ZIP_META_DIR = "META-INF"
const ZIP_ITEM_DIR = "item"

const RELEASE_DIR = "./_release";

const bookConfig = json.parse(fs.readFileSync(`${SOURCE_DIR}/book.json`).toString());

gulp.task("clean", async function () {

  // クリーンアップ
  if (fs.existsSync(BUILD_DIR)) {
    var items = await fsp.readdir(BUILD_DIR);
    for(let item of items) {
      var itemPath = path.join(BUILD_DIR, item);
      var stat = await fsp.stat(itemPath);
      if (stat.isDirectory()) {
        await fsp.rm(itemPath, { recursive: true })
      } else {
        await fsp.unlink(itemPath);
      }
    }
  }
  
  // 出力ディレクトリ作成

  await fsp.mkdir(BUILD_STYLES_DIR, { recursive: true });
  await fsp.mkdir(BUILD_IMAGE_DIR, { recursive: true });
  await fsp.mkdir(BUILD_XHTML_DIR, { recursive: true });
  await fsp.mkdir(BUILD_META_DIR, { recursive: true });
  await fsp.mkdir(TEMP_DIR, { recursive: true });

});

gulp.task("copy",  function () {

  // コピー
  var subTasks = [
    gulp.src(`${SOURCE_DIR}/mimetype`)
      .pipe(gulp.dest(`${BUILD_DIR}`)),

    gulp.src(`${SOURCE_META_DIR}/**/*`)
      .pipe(gulp.dest(BUILD_META_DIR)),

    gulp.src(`${SOURCE_IMAGE_DIR}/**/*.png`)
      .pipe(gulp.dest(BUILD_IMAGE_DIR)),

    gulp.src(`${SOURCE_IMAGE_DIR}/**/*.jpg`)
      .pipe(gulp.dest(BUILD_IMAGE_DIR)),

    gulp.src(`${SOURCE_IMAGE_DIR}/**/*.svg`)
      .pipe(gulp.dest(BUILD_IMAGE_DIR))
  ];
  
  return merge(subTasks);
});

gulp.task("css", async function () {
  // CSS生成
  await gulp.src(`${SOURCE_STYLES_DIR}/epub.scss`)
    .pipe(sass({outputStyle: "expanded"}).on("error", sass.logError))
    .pipe(concat("style.css"))
    .pipe(gulp.dest(BUILD_STYLES_DIR));

});

gulp.task("build-epub",  async function () {
  await build("epub", true);
  
  // zip生成
  await makeEpub("epub");
});

gulp.task("epub", gulp.series("clean", "copy", "css", "build-epub"));


gulp.task("css-print", async function () {
  // CSS生成
  await gulp.src(`${SOURCE_STYLES_DIR}/print.scss`)
    .pipe(sass({outputStyle: "expanded"}).on("error", sass.logError))
    .pipe(concat("style.css"))
    .pipe(gulp.dest(BUILD_STYLES_DIR));
});

gulp.task("build-print",  async function () {
  await build("print", false);

});

gulp.task("print", gulp.series("clean", "copy", "css-print", "build-print"));

gulp.task("css-pod", async function () {
  // CSS生成
  await gulp.src(`${SOURCE_STYLES_DIR}/pod.scss`)
    .pipe(sass({outputStyle: "expanded"}).on("error", sass.logError))
    .pipe(concat("style.css"))
    .pipe(gulp.dest(BUILD_STYLES_DIR));
});

gulp.task("build-pod",  async function () {
  await build("pod", false);

});
gulp.task("pod", gulp.series("clean", "copy", "css-pod", "build-pod"));





gulp.task("default", gulp.series("epub"));

async function convertPsdToPng() {
  let psdFiles = (await fsp.readdir(SOURCE_IMAGE_DIR))
    .filter(x=> x.endsWith("psd"))
    .map(x=>path.join(SOURCE_IMAGE_DIR, x));
  
  for(let psdFile of psdFiles){
    var psdData = await psd.open(psdFile);
    var fileName = path.basename(psdFile, ".psd");
    await psdData.image.saveAsPng(path.join(BUILD_IMAGE_DIR, `${fileName}.png`));
  }
}

async function resizeImages(contents) {
  
  let images = contents.filter(x => x.type == "image");
  for(let x of images) {
    // 未対応の画像はスキップ
    if(!x.fileName.endsWith(".jpg") && !x.fileName.endsWith(".png")) {
      continue;
    }
    
    let filePath = path.join(BUILD_IMAGE_DIR, x.fileName);
    let tempFile = path.join(TEMP_DIR, x.fileName);

    fs.copyFileSync(filePath, tempFile);

    
    let image = await sharp(tempFile);
    let width = x.dimensions.width;
    let height = x.dimensions.height;


    // 塗り足し部分をクロップする
    let cropConfig = bookConfig.epubImageCrops
      .find(y=> (new RegExp(y.fileNamePattern)).test(x.fileName));
    
    if(cropConfig) {
      let bleed = cropConfig.bleed;
      width -= bleed.x * 2;
      height -= bleed.y * 2;
      image = image.extract({left: bleed.x, top: bleed.y,  width: width, height: height});
    }

    // 規格一杯に合せてスケールする
    let isPortrait = (width < height);
    let isKindleOk = (isPortrait && width >= 1200 && height >= 1920) ||
                     (!isPortrait && width >= 1920 && height >= 1200);
    let isAppleBooksOk = (width * height <= 4000000);
    let isGoogleOk = (width <= 3200 && height <= 3200);
    
    if(!isKindleOk || !isAppleBooksOk || !isGoogleOk){

      let scale = Math.min(
        Math.sqrt(4000000 / (width * height)),
        3200.0 / width,
        3200.0 / height,
        1.0 
      );

      if(Math.abs(1.0 - scale) > 0.00001) {

        image = image.resize({        
          width: Math.floor(width * scale),
          height: Math.floor(height * scale),
          fit: sharp.fit.inside
        });

        if(x.fileName.endsWith(".jpg")){
          image = image.jpeg({quality: 90});
        }
        await image.toFile(filePath);
      }
    }

    await fsp.unlink(tempFile);
    
    x.dimensions = imageSizeOf(filePath);
    
  }
}

function getContentType(fileName) {
  if(fileName.toLowerCase().endsWith(".png")) {
    return "image/png";
  }else if(fileName.toLowerCase().endsWith(".jpg")) {
    return "image/jpeg";
  }
  return "application/octet-stream"
}

async function makeHtml(sourceFile) {
  const md = await fsp.readFile(sourceFile);
  const template = await fsp.readFile(`${SOURCE_TEMPLATE_DIR}/xhtml.ejs`, "utf-8");


  const processor =
     vfm.VFM({ partial: true, hardLineBreaks: true });

  const result = await processor.process(md);
  const metadata = vfm.readMetadata(md); // vfm 1.2.1ではpartialがtrueだとfrontmatterが読み込まれない
  // 現状VFMは「<hr />が<hr>に変換されてしまいepubcheckでエラーになるので、以下でXHTMLに変換する
  const htmlPartial = convertToXhtml(result.toString());
  const title = metadata.title;

  const frontmatter = await readFrontmatter(md);
  return {
    html: await ejs.render(template, {
      body: htmlPartial,
      frontmatter: frontmatter,
      title: title
    }, { async: true }),
    title: title,
    frontmatter: frontmatter,
    properties: /.*<svg .*/g.test(htmlPartial) ? "svg" : "",
    displayOrder: frontmatter.displayOrder ? frontmatter.displayOrder : 0,
    fileName: frontmatter.outputFileName
  };
}

function convertToXhtml(html) {
  const doc = new xmldom.DOMParser({
    errorHandler: {
      warning: function() {}
    }
  }).parseFromString(html);
  return new xmldom.XMLSerializer().serializeToString(doc);
}

async function readFrontmatter(md) {

  var processor = unified()
    .use(remarkParse)
    .use(function() {
      Object.assign(this, {
        Compiler: (tree, file) => {}
      });
    })
    .use(remarkFrontmatter, ['yaml'])
    .use(() => (tree, file) => {
      if(tree.children.length > 0 && tree.children[0].type == "yaml"){
        file.data = yaml.parse(tree.children[0].value);
      }
    });

    const result = await processor.process(md);
    return result.data;
}

function getTitle(result) {

  let title = result.data.title;
  if (title == null) {
    var m = result.toString().match(/<h1>([^<>]*?)<\/h1>/);
    if (m != null && m.length > 1) {
      title = m[1];
    }
  }
  return title;
}

async function generateHtmlByImage(targetImage, config) {
  const htmlPartial = `<p><svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" height="100%" viewBox="0 0 ${targetImage.dimensions.width} ${targetImage.dimensions.height}"><image width="${targetImage.dimensions.width}" height="${targetImage.dimensions.height}" xlink:href="../image/${targetImage.fileName}"/></svg></p>`;
  const template = await fsp.readFile(`${SOURCE_TEMPLATE_DIR}/xhtml.ejs`, "utf-8");

  const title = config.title ? config.title : bookConfig.title;

  const frontmatter = config.frontmatter || {};
  frontmatter.viewport = frontmatter.viewport ? frontmatter.viewport : `width=${targetImage.dimensions.width}, height=${targetImage.dimensions.height}`;
  frontmatter.htmlClass = frontmatter.htmlClass ? frontmatter.htmlClass :  "horizontal fixed-layout";
  
  const data = {
    html: await ejs.render(template, {
      body: htmlPartial,
      frontmatter: frontmatter,
      title: title
    }, { async: true }),
    title: title,
    frontmatter: frontmatter,
    properties: "svg",
    displayOrder: frontmatter.displayOrder ? frontmatter.displayOrder : 0,
    fileName: `${config.id}.xhtml`,
    id: config.id,
    type: "xhtml",
    fallbackImage: targetImage.id
  };

  await fsp.writeFile(path.join(BUILD_XHTML_DIR, data.fileName), data.html);
  return data;
}

function getPages(contents){
  return contents
    .filter(x => x.type == "xhtml")
    .sort(function(a, b) {
      if(a.displayOrder < b.displayOrder) return -1;
      if(a.displayOrder > b.displayOrder) return 1;
      return 0;        
    });
}

async function makeNavDoc(contents, buildType) {

  const pages = getPages(contents);
  const navItems = pages.filter(x=>x.frontmatter.isNavigationItem);
  const guideItems = pages.filter(x=>x.frontmatter.isGuideItem);  

  var data = {
    bookConfig: bookConfig,
    pages: getPages(contents),
    navigationItems: navItems,
    guideItems: guideItems,
    buildType: buildType,
  };

  const template = await fsp.readFile(`${SOURCE_TEMPLATE_DIR}/navigation-documents.ejs`, "utf-8");
  var html = await ejs.render(template, data, { async: true });

  await fsp.writeFile(`${BUILD_ITEM_DIR}/navigation-documents.xhtml`, html);
}

async function makeOpf(contents, buildType) {

  var images = contents.filter(x => x.type == "image");
  var data = {
    pages: getPages(contents),
    images: images,
    bookConfig: bookConfig,
    buildType: buildType,
    modified: (new Date().toISOString()).replace(/....Z$/g, "Z")
  };

  const template = await fsp.readFile(`${SOURCE_TEMPLATE_DIR}/standard.opf.ejs`, "utf-8");
  var opf = await ejs.render(template, data, { async: true });
  await fsp.writeFile(`${BUILD_ITEM_DIR}/standard.opf`, opf);

}



async function makeEpub(buildType) {

  await fsp.mkdir(RELEASE_DIR, { recursive: true });

  var zip = archiver.create("zip");
  zip.pipe(fs.createWriteStream(`${RELEASE_DIR}/book-${buildType}.epub`));
  zip.file(`${BUILD_DIR}/mimetype`, {
    store: true,
    name: "mimetype"
  });
  zip.directory(BUILD_META_DIR, ZIP_META_DIR);
  zip.directory(BUILD_ITEM_DIR, ZIP_ITEM_DIR);

  await zip.finalize();
}

function isIncluded(buildType, x){
  
  if(!x.frontmatter) {
    return true;
  }    
  else if(x.frontmatter.excludeIf && x.frontmatter.excludeIf === buildType) {
    return false;
  }
  else if(!x.frontmatter.includeIf || x.frontmatter.includeIf === buildType){
    return true;
  }
  return false;

}

async function build(buildType, enableImageResizing) {
  
  // 画像変換
  await convertPsdToPng();

  // イメージファイルのスキャン
  let contents = (await fsp.readdir(BUILD_IMAGE_DIR))
      .map(x => ({ 
        type: "image", 
        fileName: x, 
        id: path.basename(x, path.extname(x)), 
        dimensions: imageSizeOf(path.join(BUILD_IMAGE_DIR, x)),
        contentType: getContentType(x) 
      }))
      ;

  if(enableImageResizing){
    await resizeImages(contents);
  }

  contents = contents
    .filter(x=>x.id != "cover");

  // XHTML生成
  const markdownFiles = (await fsp.readdir(SOURCE_MARKDOWN_DIR))
    .filter(x => x.endsWith(".md"))
    .map(x => `${SOURCE_MARKDOWN_DIR}/${x}`);

  for (let filePath of markdownFiles) {

    let fileName = path.basename(filePath, ".md");
    const htmlData = await makeHtml(filePath);

    if(htmlData.fileName) {
      fileName = htmlData.fileName;
    }
    if(!isIncluded(buildType, htmlData)){
      continue;
    }

    await fsp.writeFile(`${BUILD_XHTML_DIR}/${fileName}.xhtml`, htmlData.html);

    htmlData.type = "xhtml";
    htmlData.fileName = `${fileName}.xhtml`;
    htmlData.id = fileName;
    contents.push(htmlData);
  }
  
  // XHTML生成（画像からの生成）
  for (let pageConfig of bookConfig.pagesToBeGeneratedFromImage) {
    var targetImage = contents.find(x=>x.fileName == pageConfig.fileName);
    if(targetImage) {
      const htmlData = await generateHtmlByImage(targetImage, pageConfig);
      contents.push(htmlData);
    }
  }

  // 除外コンテンツを削除
  contents = contents.filter(x => isIncluded(buildType, x));

  // 除外コンテンツを削除
  let filesToRemove = (await fsp.readdir(BUILD_XHTML_DIR))
    .filter(x => !contents.some(y => x === y.fileName));
  
  for(let x of filesToRemove){
    await fsp.unlink(path.join(BUILD_XHTML_DIR, x));
  }
  
  // page-spreadのデフォルト値の設定
  let pages = contents
    .filter(x=>x.type=="xhtml")
    .sort(function(a, b) {
      if(a.displayOrder < b.displayOrder) return -1;
      if(a.displayOrder > b.displayOrder) return 1;
      return 0;        
    });
  
  for(let i = 0; i < pages.length; i++){
    if(pages[i].frontmatter.epubPageProperty) {
      continue;
    }
    if(bookConfig.pageDirection == "rtl") {
      if(i % 2 == 1) {
        pages[i].frontmatter.epubPageProperty = "page-spread-right";
      }else {
        pages[i].frontmatter.epubPageProperty = "page-spread-left";
      }
    }else {
      if(i % 2 == 1) {
        pages[i].frontmatter.epubPageProperty = "page-spread-left";
      }else {
        pages[i].frontmatter.epubPageProperty = "page-spread-right";
      }
    }
  }

  //navigation-documents生成
  await makeNavDoc(contents, buildType);

  // OPF生成
  await makeOpf(contents, buildType);

}