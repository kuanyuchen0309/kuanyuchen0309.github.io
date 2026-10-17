/* ============================================================================
   xudc.org —— 内容生成（数据 → 标记）
   ----------------------------------------------------------------------------
   这个文件是【内容生成逻辑的唯一实现】，被两边共用：

     tools/data-check.mjs     在 Node 里跑，校验数据能还原出当前页面
     编辑器页面                在浏览器里跑，发布动态时生成新的标记

   为什么必须共用：如果 Node 和浏览器各写一套生成逻辑，两边迟早会长得不一样 ——
   你在编辑器里发的动态，和脚本校验出来的结果对不上，然后就没人敢相信任何一边了。

   所以这个文件【必须是纯函数】：不碰文件、不碰网络、不依赖 Node。
   用 globalThis 上的标准 API（TextEncoder 之类），这样 Node 和浏览器都能加载。

   它是 ES module：浏览器里用 <script type="module"> 引，Node 里用 import。
   ============================================================================ */

/* ============================================================ 日期格式 === */

/** 2026-10-12 -> 2026 年 10 月 12 日（页面上给人看的写法） */
export function zhDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y} 年 ${m} 月 ${d} 日`;
}

/** 2026-10-12 -> 10/12（归档页那种紧凑写法） */
export function shortDate(iso) {
  const [, m, d] = iso.split("-");
  return `${m}/${d}`;
}

/** 2026-10-12 -> 2026 年 10 月（月份分组标题） */
export function monthLabel(iso) {
  const [y, m] = iso.split("-").map(Number);
  return `${y} 年 ${m} 月`;
}

/* ============================================================ 文章排序 === */

/**
 * 按月份分组。分组顺序按日期倒序（最新的月份排最前）。
 *
 * 分组本身是日期的事（哪个月就是哪个月），但"这个月谁排前面"是编辑决定，
 * 而且首页和归档不一样，所以组内顺序来自数据里的 order 字段：
 *   byMonth(posts, "index", "desc")    首页
 *   byMonth(posts, "archive", "asc")   归档
 *
 * 没写 order 的条目会退回按日期排 —— 这样数据不完整时也不会崩，
 * 只是顺序按日期来。
 */
export function byMonth(posts, key, dir) {
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

/**
 * 把 posts.json 的数组整理成生成用的形状，并标出最新的那一篇。
 *
 * data-newest 是【唯一标记】：顶栏的「最后更新」就是读它算出来的。
 * 它由日期自动算出，不需要在数据里手工维护 —— 少一个会写错的地方。
 */
export function preparePosts(posts) {
  const list = posts.map((p) => ({ ...p, isNewest: false }));
  let newest = null;
  for (const p of list) {
    if (newest === null || p.date > newest.date) newest = p;
  }
  if (newest) newest.isNewest = true;
  return list;
}

/* ==================================================== 各段标记的生成 === */

/** 首页文章列表。缩进 8 空格，外层缩进 4 空格 */
export function indexList(posts) {
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

/** 归档列表。缩进 6 空格，外层缩进 2 空格 */
export function archiveList(posts) {
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

/**
 * 「我」页动态。没有外层容器，生成的就是若干 <li>。
 *
 * ⚠️ 缩进从【第 0 列】开始写，不带基线。基线（这块内容在页面里从第几列开始）
 *   由 replaceRegion 从文件里现读 —— 因为 wrap: false 的区域只替换标签之间的
 *   内容，外围 <ul> 留在页面上，所以基线属于页面的既有格式，不该由生成函数
 *   再猜一遍。之前这里写死了 6 空格，replaceRegion 又补一次基线，结果是 12 空格
 *   （实测踩过）。
 */
export function feedList(items) {
  const out = [];

  /* 按日期倒序：最新的动态在最上面 */
  const sorted = [...items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  for (const it of sorted) {
    const id = it.id || `d-${it.date}`;
    out.push(`<li class="feed-item" id="${id}">`);
    out.push(`  <time class="feed-date" datetime="${it.date}">${zhDate(it.date)}</time>`);
    out.push(`  <p class="feed-text">${it.text}</p>`);

    if (it.images && it.images.length) {
      out.push(`  <figure class="feed-figure">`);
      for (const im of it.images) {
        /* width / height 必须是图片的真实像素尺寸：浏览器靠它在图片下载完之前
           就把位置占好。不写的话图片一到，下面所有内容会一起往下跳。 */
        out.push(
          `    <img src="${im.src}" width="${im.width}" height="${im.height}" alt="${im.alt}" loading="lazy">`
        );
      }
      if (it.caption) out.push(`    <figcaption>${it.caption}</figcaption>`);
      out.push(`  </figure>`);
    }

    out.push(`</li>`);
    out.push(``);
  }

  return out.join("\n").replace(/\n+$/, "");
}

/* ============================================== 区域：定位与替换 === */

/**
 * 每个页面里"由数据决定"的那一块。
 *
 * 为什么不把整个页面做成模板：那样要维护三份完整的 HTML 模板（含 head、
 * manifest、导航…），任何一处手写改动都要同步到模板里，很容易忘。而用"区域"
 * 的话，页面上其余部分（注释、head、导航、页脚）原样不动，只有区域内的内容
 * 会被替换。
 *
 * ⚠️ 语义必须一致，这里踩过一次坑：
 *   indexList / archiveList 生成的字符串【本身就带外围的 <section>】，
 *   而 extractRegion 取出来的只有内部。拿"带外壳的生成结果"去替换
 *   "内部区域"，页面上就会多出一个空的 <section>（实测踩到）。
 *
 *   所以用 wrap 把两种区域区分开：
 *     wrap: true   区域 = 整个区块（含外围标签），生成结果也含外围标签
 *     wrap: false  区域 = 标签之间的内容，生成结果也只是内容
 *
 *   每个区域的 open / close / 生成函数三者必须语义一致。
 */
export const REGIONS = {
  index: {
    open: `<section class="month">`,
    close: `</section>`,
    wrap: true,
    indent: 4,
    endMarker: `</section>`,
    findFrom: "end",
  },
  archive: {
    open: `<section class="month">`,
    close: `</section>`,
    wrap: true,
    indent: 2,
    endMarker: `</section>`,
    findFrom: "end",
  },
  /* 动态那一块：<ul class="feed"> 里放的就是若干 <li>，
     而 feedList 生成的也正是若干 <li>（不带 <ul>），所以 wrap: false。
     这样 open 之后、第一条内容之前的那段手写用法示例注释也会被换掉 ——
     那是预期的，发布时它会被生成出来的动态取代。 */
  feed: {
    open: `<ul class="feed">`,
    close: `</ul>`,
    wrap: false,
  },
};

/** 生成「整个区域」（语义要和上面 REGIONS 里的 wrap 对上） */
export const BUILDERS = {
  index: (posts) => indexList(posts),
  archive: (posts) => archiveList(posts),
  feed: (feed) => feedList(feed),
};

/**
 * 把注释替换成【等长的空格】，而不是删掉。
 *
 * ⚠️ 这一点很关键，踩过一次坑：
 *   这里要同时满足两个互相矛盾的要求 ——
 *     ① 定位标记时不能被注释里的同名标记骗到（首页某段注释里就写着
 *        `<section class="month">`，归档、动态的注释里也有类似的东西）
 *     ② 切片必须回到【原始字符串】上做，因为这些下标要交给 html.slice()
 *
 *   一开始这里真的把注释删掉了，于是字符串变短、下标全部偏移，
 *   切出来的页面是碎的（实测：整页被切错位置）。
 *   换成等长空格之后两边下标一一对应，两个要求同时满足。
 */
const blankComments = (html) => html.replace(/<!--[\s\S]*?-->/g, (m) => " ".repeat(m.length));

const stripComments = (html) => html.replace(/<!--[\s\S]*?-->/g, "");
const trimNewlines = (s) => s.replace(/^\n+/, "").replace(/\n+$/, "");

/** 定位区域，返回它在【原始 HTML】里的起止位置 */
function resolve(html, region) {
  /* 在"注释变空格"的版本上定位：既不会被注释里的标记骗到，下标又能直接用在 html 上 */
  const src = blankComments(html);
  const openAt = src.lastIndexOf(region.open);
  if (openAt === -1) throw new Error(`找不到区域起点：${region.open}`);

  const closeAt =
    region.findFrom === "end"
      ? src.lastIndexOf(region.close)
      : src.indexOf(region.close, openAt + region.open.length);

  if (closeAt === -1 || closeAt < openAt) throw new Error(`找不到区域终点：${region.close}`);

  const innerRaw = html.slice(openAt + region.open.length, closeAt);
  const searchFrom = region.endMarker
    ? closeAt + region.close.length - region.endMarker.length
    : closeAt;

  /* 往前退到"行首"：跳过 open 前面那一段缩进，再吃掉它前面的换行。
     这样替换整块时不会残留一行只含缩进的空行。 */
  let lineStart = openAt;
  while (lineStart > 0 && (html[lineStart - 1] === " " || html[lineStart - 1] === "\t")) lineStart--;
  if (lineStart > 0 && html[lineStart - 1] === "\n") lineStart--;

  return {
    /* 区域内部内容（不含 open / close）。掐掉紧贴分隔标记的那个换行 */
    inner: trimNewlines(innerRaw),
    innerStart: openAt + region.open.length,
    innerEnd: closeAt,
    /* 整个区块的范围（含 open / close），起点已经退到行首 —— wrap 区域用这个 */
    lineStart,
    blockEnd: closeAt + region.close.length,
    searchFrom,
  };
}

/**
 * 取出区域内容。
 *
 * wrap: true 的区域返回【整个区块】（含 `<section>`），
 * wrap: false 的区域返回【标签之间的内容】。
 * 两种情况都和同名的生成函数语义一致，所以可以直接拿来比对。
 */
export function extractRegion(html, name) {
  const region = REGIONS[name];
  if (!region) throw new Error(`未知区域：${name}`);
  const r = resolve(html, region);
  return region.wrap ? html.slice(r.lineStart, r.blockEnd) : r.inner;
}

/**
 * 把区域内容换成新的，返回整份新的 HTML。
 *
 * wrap: true  → 替换整个区块（含外围标签），content 要自带外围标签
 * wrap: false → 只替换标签之间的内容，外围标签原样保留
 *
 * 页面上区域以外的东西（注释、head、导航、页脚）原样保留。
 */
export function replaceRegion(html, name, content) {
  const region = REGIONS[name];
  if (!region) throw new Error(`未知区域：${name}`);
  const r = resolve(html, region);
  const body = trimNewlines(content);

  if (region.wrap) {
    /* 整块替换：起点已退到行首（含那一行的缩进），生成结果每行自带正确缩进。
       末尾不要补换行 —— 紧贴块尾的换行本来就在切片剩余部分的开头。 */
    return html.slice(0, r.lineStart) + "\n" + body + html.slice(r.blockEnd);
  }

  /* 内部替换：外围标签原样保留。
     缩进不靠猜，直接从文件里读：开口标签后面那段空白（lead）里，最后一个换行
     之后的空格就是这块内容的缩进基线；收口标签前面的空白（tail）同理。
     这样生成函数就不必知道自己在文件里从第几列开始，页面排版改了也不会错位。
     lead / tail 都是【原样保留】的，不能自己重新拼 —— `<ul class="feed">` 后面
     手写了一个空行，拼成 `"\n" + 内容` 会把这个空行吃掉（实测踩过）。 */
  const raw = html.slice(r.innerStart, r.innerEnd);
  const lead = raw.match(/^\s*/)[0];
  const tail = raw.match(/\s*$/)[0];
  /* 区域里现在还是空的（新建页面时就是这样）：lead + tail 吃掉了全部，没有基线可读 */
  const isEmpty = lead.length + tail.length >= raw.length;

  /* 收口标签所在那一行的缩进，空区域时靠它推出内容该从第几列开始 */
  const beforeClose = html.slice(0, r.innerEnd);
  const nl = beforeClose.lastIndexOf("\n");
  const closeIndent = nl === -1 ? "" : beforeClose.slice(nl + 1).match(/^[ \t]*/)[0];

  let head;
  let foot;
  let indent;

  if (body === "") {
    /* 没有内容要放：只把区域清空，别留下空行 */
    head = "\n" + closeIndent;
    foot = "";
    indent = "";
  } else if (isEmpty) {
    indent = closeIndent + "  ";
    head = "\n";
    foot = "\n" + closeIndent;
  } else {
    indent = lead.match(/[ \t]*$/)[0];
    /* lead 末尾那几个空格是【第一条内容自己的缩进】，下面 map 里会补，
       这里要先去掉，否则第一行会多出一倍缩进（实测踩过） */
    head = lead.slice(0, lead.length - indent.length);
    foot = tail;
  }

  const indented = body
    .split("\n")
    .map((line) => (line === "" ? "" : indent + line))
    .join("\n");

  return html.slice(0, r.innerStart) + head + indented + foot + html.slice(r.innerEnd);
}

/**
 * 用数据重新生成某个页面区域，返回整份新的 HTML。
 *
 * 这是编辑器发布动态、以及 tools/data-check.mjs --write 共用的入口。
 */
export function rebuildPage(html, name, data) {
  const builder = BUILDERS[name];
  if (!builder) throw new Error(`未知区域：${name}`);
  return replaceRegion(html, name, builder(data));
}

/** 逐字符比较两份文本是否相同 */
export function sameText(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a.charCodeAt(i) !== b.charCodeAt(i)) return false;
  }
  return true;
}

/** 丢掉注释、去掉每行首尾空白、丢掉空行 —— 用于"只比标记"的比对 */
export function normalizeMarkup(s) {
  return stripComments(s)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .join("\n");
}

export { stripComments };
