#!/usr/bin/env node
/* ============================================================================
   data-check.mjs —— 用 data/*.json 还原页面标记，并和现有 HTML 比对
   ----------------------------------------------------------------------------
   为什么要有这个文件：

     "在手机上直接发一条动态"的前提是内容必须是【数据】而不是手写 HTML。
     但把内容抽成数据有个风险：抽完之后生成的 HTML 和现在长得不一样，页面就
     悄悄变样了。

     所以这个脚本做两件事：

       ① 拿 data/*.json 生成标记，和页面上现有的那一块逐行比 ——
          证明数据模型是完整的（页面上有的东西，数据里都有）

       ② 再往前一步：整份重建这三个页面，和磁盘上的文件逐字节比 ——
          证明 replaceRegion 的切片边界没有切错位置。
          这一条比 ① 更强，因为 ① 只比了区域内部，② 比的是整个文件。

   生成逻辑本身在 js/content.js 里，和编辑器页面共用同一份实现。

   用法：
     node tools/data-check.mjs           只校验，不写文件（日常用这个）
     node tools/data-check.mjs --write   把重建结果写回那三个页面
   ============================================================================ */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  extractRegion,
  rebuildPage,
  normalizeMarkup,
  sameText,
  preparePosts,
} from "../js/content.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");

/* ------------------------------------------------------------ 载入数据 --- */

const readJson = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));
const readText = (p) => readFile(join(ROOT, p), "utf8");

const postsData = await readJson("data/posts.json");
const feedData = await readJson("data/feed.json");

const posts = preparePosts(postsData.posts);

/* 三个页面 + 它们各自区域的数据来源 */
const PAGES = [
  { file: "index.html", region: "index", data: posts, label: "首页文章列表" },
  { file: "archive.html", region: "archive", data: posts, label: "归档列表" },
  { file: "me.html", region: "feed", data: feedData.feed, label: "「我」页动态" },
];

/* ------------------------------------------------------------ 比对 --- */

let failures = 0;

/** 打印两份文本的第一处不同，带上前后文，方便直接定位 */
function printDiff(actual, expected) {
  const al = actual.split("\n");
  const el = expected.split("\n");
  const n = Math.max(al.length, el.length);

  for (let i = 0; i < n; i++) {
    if (al[i] !== el[i]) {
      console.log(`\n    第一处不同在第 ${i + 1} 行：`);
      for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 3); k++) {
        const mark = k === i ? ">>" : "  ";
        console.log(`      ${mark} ${String(k + 1).padStart(3)} | 页面 ${al[k] ?? ""}`);
        console.log(`      ${mark} ${String(k + 1).padStart(3)} | 生成 ${el[k] ?? ""}`);
      }
      console.log("");
      return;
    }
  }
  /* 前面都一样，那就是行数不同 */
  console.log(`\n    行数不同：页面 ${al.length} 行，生成 ${el.length} 行\n`);
}

console.log("\n用 data/*.json 还原标记，和现有页面比对：\n");

const rebuilt = new Map();

for (const p of PAGES) {
  const html = await readText(p.file);

  /* ① 先整份重建，再从中取出区域内部内容 —— 这样两边都是"内部内容"，
        语义一致。之所以不直接拿生成函数的返回值来比，是因为生成函数返回的是
        整个区块（含 <section> / <ul>），而 extractRegion 返回的是区块内部，
        两者差着外围标签。 */
  const next = rebuildPage(html, p.region, p.data);
  rebuilt.set(p.file, next);

  const a1 = normalizeMarkup(extractRegion(html, p.region));
  const e1 = normalizeMarkup(extractRegion(next, p.region));

  if (sameText(a1, e1)) {
    console.log(`  ✓ ${p.label}（${p.file}）—— 区域内容一致`);
  } else {
    failures += 1;
    console.log(`  ✗ ${p.label}（${p.file}）—— 生成的标记和页面上现有的不一致`);
    printDiff(a1, e1);
  }

  /* ② 整份文件层面：重建后必须和磁盘上一模一样 */
  if (sameText(next, html)) {
    console.log(`  ✓ ${p.file} —— 整份重建后与原文件逐字节相同`);
  } else {
    failures += 1;
    console.log(`  ✗ ${p.file} —— 重建结果和原文件不同（切片边界可能切错了位置）`);
    printDiff(html, next);
  }
}

/* ------------------------------------------------------------ 写出 --- */

if (WRITE) {
  console.log("");
  for (const [file, content] of rebuilt) {
    await writeFile(join(ROOT, file), content, "utf8");
    console.log(`  写入 ${file}`);
  }
  console.log("\n已写入。请自己核对 git diff 之后再提交。\n");
} else if (failures === 0) {
  console.log("\n全部一致：数据模型是完整的，而且整份重建可以逐字节还原现有页面。");
  console.log("（第一层比对忽略 HTML 注释；第二层是整份文件逐字节比，没有忽略任何东西。）\n");
} else {
  console.log(`\n有 ${failures} 处不一致。要么补数据，要么改 js/content.js 里的生成函数。\n`);
  process.exit(1);
}
