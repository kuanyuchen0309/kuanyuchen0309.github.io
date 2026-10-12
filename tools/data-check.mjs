#!/usr/bin/env node
/* ============================================================================
   data-check.mjs —— 用 data/*.json 还原页面标记，并和现有 HTML 逐字符比对
   ----------------------------------------------------------------------------
   为什么要有这个文件：

     整个"手机上直接发一条动态"的计划，前提是内容必须是【数据】而不是手写 HTML。
     但把内容抽成数据有一个很大的风险：抽完之后生成的 HTML 和现在长得不一样，
     页面就悄悄变样了。

     所以这个脚本做一件事：拿 data/*.json 生成标记，和 index.html / archive.html /
     me.html 里现有的那一段逐字符比。不一致就打印出第一处不同，并给出退出码 1。

     它的作用是【证明数据模型是完整的】—— 凡是现在页面上有的东西，
     数据里都有；少一个字段，比对就会红。

   用法：
     node tools/data-check.mjs           只校验，不写文件（日常用这个）
     node tools/data-check.mjs --write   把生成结果覆盖回那三个页面

   ⚠️ 比对时会【忽略 HTML 注释】。原因：那几段手写注释是给第一次读代码的人看的，
      它们的信息量比 JSON 里能放的字段大得多（比如"置顶改成 data-pin 了"、
      "日期为什么单独写一份"）。把这些注释逐字塞进 JSON 只会让数据变脏，
      所以比对只看真正的标记（标签、属性、文字），注释不参与。
   ============================================================================ */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WRITE = process.argv.includes("--write");

/* ---------------------------------------------------------------- 小工具 --- */

const load = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));

/** 丢掉所有 HTML 注释，用来做"只比标记"的比对 */
const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, "");

/**
 * 规范化：丢注释、去掉每行首尾空白、丢掉空行。
 * 缩进和空行属于排版，不影响页面长什么样，所以不参与比对 ——
 * 但"有没有这一行内容"必须比，那才是数据模型完不完整的判据。
 */
const norm = (s) =>
  stripComments(s)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .join("\n");

/** 2026-10-12 -> 2026 年 10 月 12 日（页面上给人看的写法） */
function zhDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y} 年 ${m} 月 ${d} 日`;
}

/** 2026-10-12 -> 10/12（归档页那种紧凑写法） */
function shortDate(iso) {
  const [, m, d] = iso.split("-");
  return `${m}/${d}`;
}

/** 2026-10-12 -> 2026 年 10 月（月份分组标题） */
function monthLabel(iso) {
  const [y, m] = iso.split("-").map(Number);
  return `${y} 年 ${m} 月`;
}

/**
 * 按月份分组。分组顺序由排序键决定：先按日期倒序挑出"最新的月份"排最前。
 *
 * 为什么分组用日期、组内顺序用 order：
 *   分组本身是日期的事（哪个月就是哪个月），但"这个月谁排前面"是编辑决定，
 *   首页和归档还不一样（首页倒序、归档升序），所以组内顺序必须来自数据。
 */
function byMonth(posts, key, dir) {
  const cmp = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  const groups = [];
  for (const p of [...posts].sort(cmp)) {
    const label = monthLabel(p.date);
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) {
      g = { label, posts: [] };
      groups.push(g);
    }
    g.posts.push(p);
  }

  /* 组内：有 order 就按 order，没有就退回日期排序 */
  for (const g of groups) {
    g.posts.sort((a, b) => {
      const oa = a.order && a.order[key];
      const ob = b.order && b.order[key];
      if (oa !== undefined && ob !== undefined) return oa - ob;
      if (oa !== undefined) return -1;
      if (ob !== undefined) return 1;
      return dir === "desc" ? cmp(a, b) : -cmp(a, b);
    });
  }

  return groups;
}

/* ---------------------------------------------- 首页：文章列表那一段标记 --- */

function indexList(posts) {
  const out = [];

  for (const g of byMonth(posts, "index", "desc")) {
    out.push(`    <section class="month">`);
    out.push(`      <h2 class="month-title"><span>${g.label}</span></h2>`);
    out.push(``);
    out.push(`      <ul class="post-list">`);
    out.push(``);

    /* 置顶的排到最前（数字小的更前），其余保持上面排好的顺序 */
    const pinned = g.posts.filter((p) => p.pin !== undefined).sort((a, b) => a.pin - b.pin);
    const rest = g.posts.filter((p) => p.pin === undefined);

    for (const p of [...pinned, ...rest]) {
      const attrs = [`class="post${p.pin !== undefined ? " is-pinned" : ""}"`];
      if (p.pin !== undefined) attrs.push(`data-pin="${p.pin}"`);
      attrs.push(`data-tags="${p.tags.join(" ")}"`);
      if (p.isNewest) attrs.push(`data-newest`, `data-date="${p.date}"`);

      const badge = p.pin !== undefined ? `<span class="pin-badge">置顶</span>` : ``;
      const tags = p.tags.map((t) => `<span class="tag">#${t}</span>`).join(``);

      out.push(`        <li ${attrs.join(" ")}>`);
      out.push(`          <a class="post-link" href="${p.file}">`);
      out.push(`            <h3 class="post-title">${badge}${p.title}</h3>`);
      out.push(`            <p class="post-summary">${p.summary}</p>`);
      out.push(`            <p class="post-tags">${tags}</p>`);
      out.push(`          </a>`);
      out.push(`        </li>`);
      out.push(``);
    }

    out.push(`      </ul>`);
    out.push(`    </section>`);
    out.push(``);
  }

  return out.join("\n").replace(/\n+$/, "");
}

/* ---------------------------------------------- 归档页：日期 + 标题那一段 --- */

function archiveList(posts) {
  const out = [];

  for (const g of byMonth(posts, "archive", "asc")) {
    out.push(`  <section class="month">`);
    out.push(`    <h2 class="month-title"><span>${g.label}</span></h2>`);
    out.push(``);
    out.push(`    <ul class="archive-list">`);
    out.push(``);

    for (const p of g.posts) {
      out.push(`      <li>`);
      out.push(`        <a class="archive-item" href="${p.file}">`);
      out.push(`          <span class="archive-date">${shortDate(p.date)}</span>`);
      out.push(`          <span class="archive-title">${p.title}</span>`);
      out.push(`        </a>`);
      out.push(`      </li>`);
      out.push(``);
    }

    out.push(`    </ul>`);
    out.push(`  </section>`);
    out.push(``);
  }

  return out.join("\n").replace(/\n+$/, "");
}

/* ------------------------------------------------- 「我」页：动态那一段 --- */

function feedList(items) {
  const out = [];

  for (const it of [...items].sort((a, b) => (a.date < b.date ? 1 : -1))) {
    const id = it.id || `d-${it.date}`;
    out.push(`      <li class="feed-item" id="${id}">`);
    out.push(`        <time class="feed-date" datetime="${it.date}">${zhDate(it.date)}</time>`);
    out.push(`        <p class="feed-text">${it.text}</p>`);

    if (it.images && it.images.length) {
      out.push(`        <figure class="feed-figure">`);
      for (const im of it.images) {
        /* width / height 必须写真实像素尺寸：浏览器靠它在图片下载完之前
           就把位置占好，不写的话图片一到，下面所有内容会一起往下跳 */
        out.push(
          `          <img src="${im.src}" width="${im.width}" height="${im.height}" alt="${im.alt}" loading="lazy">`
        );
      }
      if (it.caption) out.push(`          <figcaption>${it.caption}</figcaption>`);
      out.push(`        </figure>`);
    }

    out.push(`      </li>`);
    out.push(``);
  }

  return out.join("\n").replace(/\n+$/, "");
}

/* ------------------------------------------------- 从页面里抠出那一段 --- */

/**
 * 取 from 之后、to 之前的全部内容。用【最后一次】出现的位置。
 *
 * ⚠️ 两个坑，都踩过：
 *   ① 边界要选得"只包住要生成的那一块"。index.html 里 `<div id="listWrap">`
 *      里面还嵌着一个 .filter-bar，从它开始切会把 filter-bar 也切进来，
 *      于是必然对不上。
 *   ② 定位之前必须先剥掉注释。首页 `<p class="list-empty">` 上面那句注释里
 *      就写着 `<section class="month">` 这个示例，不剥注释的话
 *      lastIndexOf 会命中注释里的那一份，切出来的东西完全错位。
 */
function slice(html, from, to) {
  const src = stripComments(html);
  const a = src.lastIndexOf(from);
  if (a === -1) throw new Error(`找不到起点：${from}`);
  const b = src.indexOf(to, a + from.length);
  if (b === -1) throw new Error(`找不到终点：${to}`);
  /* 终点标记本身要算进来（比如 </section>），所以是 b + to.length */
  return src.slice(a, b + to.length);
}

/** 「我」页的动态：从 <ul class="feed"> 里挑出所有 <li class="feed-item">…
 *  同样必须先剥注释 —— 文件顶部那段用法示例里就有一个 <li class="feed-item">，
 *  不剥的话第一个匹配到的是示例，不是真内容。 */
function feedItems(html) {
  const src = stripComments(html);
  const a = src.lastIndexOf(`<ul class="feed">`);
  if (a === -1) throw new Error("找不到 <ul class=\"feed\">");
  const b = src.indexOf(`</ul>`, a);
  const inner = src.slice(a, b);

  const out = inner.match(/<li class="feed-item"[\s\S]*?<\/li>/g);
  if (!out || !out.length) throw new Error("feed 里一条 <li> 都没找到");
  return out.join("\n");
}

/* ------------------------------------------------------------ 比对 --- */

let failures = 0;

function compare(label, file, actual, expected) {
  const a = norm(actual);
  const e = norm(expected);

  if (a === e) {
    console.log(`  ✓ ${label}（${file}）`);
    return;
  }

  failures += 1;
  console.log(`  ✗ ${label}（${file}）—— 生成的标记和页面上现有的不一致`);

  const al = a.split("\n");
  const el = e.split("\n");
  const n = Math.max(al.length, el.length);
  for (let i = 0; i < n; i++) {
    if (al[i] !== el[i]) {
      console.log(`\n    第一处不同在第 ${i + 1} 行：`);
      console.log(`      页面上： ${al[i] === undefined ? "(没有这一行)" : JSON.stringify(al[i])}`);
      console.log(`      生成出： ${el[i] === undefined ? "(没有这一行)" : JSON.stringify(el[i])}`);
      for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 3); k++) {
        const mark = k === i ? ">>" : "  ";
        console.log(`      ${mark} ${String(k + 1).padStart(3)} | 页面 ${al[k] ?? ""}`);
        console.log(`      ${mark} ${String(k + 1).padStart(3)} | 生成 ${el[k] ?? ""}`);
      }
      break;
    }
  }
  console.log("");
}

/* ------------------------------------------------------------ 主流程 --- */

const postsData = await load("data/posts.json");
const feedData = await load("data/feed.json");

const posts = postsData.posts.map((p) => ({ ...p, isNewest: false }));
/* 最新的那一篇打上 data-newest：顶栏的「最后更新」就是读它算出来的 */
const newest = posts.reduce((m, p) => (m === null || p.date > m.date ? p : m), null);
if (newest) newest.isNewest = true;

const genIndex = indexList(posts);
const genArchive = archiveList(posts);
const genFeed = feedList(feedData.feed);

if (WRITE) {
  const writeBack = async (file, from, to, generated) => {
    const html = await readFile(join(ROOT, file), "utf8");
    const a = html.lastIndexOf(from) + from.length;
    const b = html.indexOf(to, a);
    const out = html.slice(0, a) + "\n" + generated + "\n\n" + html.slice(b + (to.startsWith("\n") ? to.length : 0));
    await writeFile(join(ROOT, file), out, "utf8");
    console.log(`  写入 ${file}`);
  };

  await writeBack("index.html", `<div id="listWrap">`, `  </div>\n\n  <p class="list-empty"`, genIndex);
  await writeBack("archive.html", `<main class="wrap">`, `</main>`, genArchive);
  await writeBack("me.html", `<ul class="feed">`, `    </ul>\n\n  </main>`, genFeed);
  console.log("\n已写入。请自己核对 git diff 之后再提交。\n");
} else {
  console.log("\n用 data/*.json 还原标记，和现有页面比对：\n");

  const [idx, arc, me] = await Promise.all([
    readFile(join(ROOT, "index.html"), "utf8"),
    readFile(join(ROOT, "archive.html"), "utf8"),
    readFile(join(ROOT, "me.html"), "utf8"),
  ]);

  compare(
    "首页文章列表",
    "index.html",
    slice(idx, `<section class="month">`, `</section>`),
    genIndex
  );

  compare(
    "归档列表",
    "archive.html",
    slice(arc, `<section class="month">`, `</section>`),
    genArchive
  );

  compare("「我」页动态", "me.html", feedItems(me), genFeed);

  if (failures === 0) {
    console.log("\n全部一致：数据模型是完整的，页面上现有的标记都能从 data/*.json 还原出来。");
    console.log("（比对时忽略了 HTML 注释，见本文件顶部说明。）\n");
  } else {
    console.log(`\n有 ${failures} 处不一致。要么补数据，要么改生成函数。\n`);
    process.exit(1);
  }
}
