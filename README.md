# xudc.org

一个纯静态的个人博客。**没有框架、没有构建步骤、没有依赖**——双击 `index.html` 就能看。

关掉 JavaScript 也照样能用（文章列表、归档、正文、返回链接都是 HTML 里写好的），只是少了深色开关和搜索。

---

## 目录结构

```
blog/
├── index.html            文章列表（按月份分组、搜索、标签筛选、置顶、定位卡）
├── archive.html          归档（只有日期和标题，用来一眼看完全部文章）
├── me.html               我（自我介绍 + 一条条内容，动态可以配图）
├── posts/                每一篇文章一个独立的 HTML 文件
│   ├── tidy-the-drawer.html          十月一日，我扔掉了三箱东西
│   ├── an-autumn-walk.html           我走了一条平常不会走的路
│   ├── rereading-an-old-book.html    重读一本书，其实是读另一个自己
│   ├── cooking-for-one.html          一个人吃饭，最难的是给自己一个理由
│   └── things-i-cant-say.html        有些话我永远说不出口
├── css/
│   ├── style.css         全站：配色变量、顶栏、底栏、列表、「我」页
│   └── post.css          只有文章页加载：正文的阅读排版
├── js/
│   ├── theme.js          深色模式的"防闪烁"脚本（必须在 <head> 里）
│   └── app.js            深色开关、搜索、标签筛选、顶栏文案、置顶排序、顶栏淡化
├── img/
│   ├── touxiang.jpg      头像原图（645×645）
│   ├── touxiang-180.png  主屏幕图标，从上面那张缩来的
│   ├── touxiang-512.png  同上，给 Android 用
│   └── feed/             「我」页动态里的配图
└── manifest.webmanifest  让手机把它装成 App（见下面「装到手机主屏幕上」）
```

**所有路径都是相对路径**（`../css/style.css` 这种），没有以 `/` 开头的绝对路径。
原因：GitHub Pages 的项目站点是挂在 `/仓库名/` 下面的，绝对路径会指错地方。

两张 PNG 是从 `img/touxiang.jpg` 缩出来的，换头像时用这段重新生成一次：

```powershell
Add-Type -AssemblyName System.Drawing
$s = [System.Drawing.Image]::FromFile((Resolve-Path 'img\touxiang.jpg').Path)
foreach ($n in 180, 512) {
  $b = New-Object System.Drawing.Bitmap($n, $n)
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($s, (New-Object System.Drawing.Rectangle(0, 0, $n, $n)))
  $g.Dispose(); $b.Save("$PWD\img\touxiang-$n.png"); $b.Dispose()
}
$s.Dispose()
```

---

## 本地预览

最简单：双击 `index.html`，浏览器直接打开。

用 VS Code：装 **Live Server** 扩展，右键 `index.html` → **Open with Live Server**。
（注意要打开 **`blog` 这个文件夹本身**，不要只打开 `posts` 子文件夹，否则相对路径会指错。）

---

## 怎么加一篇新文章

一共改 **3 个地方**，不涉及任何命令行。

**第 1 步：建文章文件。**
把 `posts/` 里任意一篇复制一份，改名成你的新文件名（小写 + 连字符），比如 `posts/my-first-css-grid.html`。
然后改这几处：

- `<title>` —— 文章标题，格式是 `标题 — xudc.org`
- `<meta name="description">` —— 一句话摘要，搜索引擎和分享时用
- `<h1>` —— 页面上的大标题
- `<time datetime="2026-10-15">` —— `datetime` 写机器格式（`年-月-日`），标签之间的文字写给人看
- `<span class="tag">#标签</span>` —— 增删标签
- `<article class="prose">` 里面 —— 正文

**第 2 步：在 `index.html` 的列表里加一条。**
找到 `<ul class="post-list">`，把最新的一篇放在**最前面**（同一月份内按时间倒序）。
复制一条 `<li class="post">...</li>` 改内容。这一条上有三个属性要写对：

| 属性 | 作用 | 写错会怎样 |
| --- | --- | --- |
| `data-tags="随笔 生活"` | 让标签筛选能工作。**用空格分隔，不要写 `#`** | 点那个标签筛不出这篇 |
| `data-newest data-date="2026-10-15"` | 标记"最新的一篇"，顶栏就靠它算出「最后更新」 | 顶栏显示的日期不对 |
| `data-pin="1"` | 只加在置顶那一条上，见下面 | —— |

⚠️ **`data-newest` 是"唯一标记"**：加新文章时，要把 `data-newest` 和 `data-date` 从旧的那一条上**删掉**，搬到新的一条上。同时检查三处（`index.html` / `archive.html` / `me.html`）顶栏里的「最后更新：X 月 X 日」要不要跟着改 —— 只有首页那个会被 JavaScript 自动算出来，另外两个页面是静态文字。

**第 3 步：在 `archive.html` 的归档里加一条。**

**别忘了两件小事：**
- 如果新的月份开始了，要在两个列表里各加一个月份标题：

```html
<section class="month">
  <h2 class="month-title"><span>2026 年 11 月</span></h2>
  <ul class="post-list"> ... </ul>
</section>
```

- 首页定位卡（`.intro`）不改也行，除非你的自我介绍变了。

**关于「置顶」**：给 `<li>` 加上 `is-pinned` 这个 class，它就会变成浅灰底、并且标题前面出现一枚「置顶」角标：

```html
<li class="post is-pinned" data-pin="1" data-tags="随笔 生活">
```

`data-pin` 里的数字**只决定置顶之间的先后**：数字小的排前面，没写数字当作 0（也就是最前）。只有一条置顶时它什么也不做 —— 顺序本来就对。**想换置顶顺序，改数字就行，不用搬动整段 HTML。**

建议**最多置顶一篇**——两条浅灰底挨在一起，视觉上会乱。

**注意：置顶那一条会显示在最新一篇的上面**（排序是"置顶优先"，不是按日期）。所以如果置顶的是旧文章，列表里最上面那条的日期会比第二条旧，这是正常的。

---

## 标签筛选

首页上的标签现在是**可以点的**：点 `#读书` 就只剩读书那几篇，再点一次取消。筛选时列表上方会出现一行「筛选：#读书 · 2 篇」和一个「清除」按钮。

- 筛选是**在页面里做的**，不会改网址。所以筛完的结果没法分享给别人 —— 这是有意的取舍：做成 `?tag=读书` 需要改动导航和链接的写法，等以后再说。
- 标签和搜索**可以叠加**：选了 `#随笔` 又在搜索框里打字，两个条件同时生效。
- **按 Esc 只清空搜索，不清除标签** —— Esc 的意思是"清掉我刚打的字"。要取消标签就点「清除」或再点一次那枚标签。
- **不用 JavaScript 的时候**，标签就是一枚普通标签，点不动。页面上不会出现"看着能点、点了没反应"的东西：`app.js` 只有在能接管的情况下才会把标签换成按钮。

---

## 「我」页的动态怎么配图

动态（`me.html` 里的 `<li class="feed-item">`）可以配图。把图片放进 `img/feed/`，然后这样写：

```html
<li class="feed-item" id="d-2026-10-14">
  <time class="feed-date" datetime="2026-10-14">2026 年 10 月 14 日</time>
  <p class="feed-text">文字。</p>

  <figure class="feed-figure">
    <img src="img/feed/2026-10-14-1.jpg" width="1200" height="900" alt="图片说明" loading="lazy">
    <figcaption>图说，可以整段删掉</figcaption>
  </figure>
</li>
```

**四条规矩：**

1. **`width` / `height` 必须写，而且要填图片的真实像素尺寸。** 这不是摆设 —— 浏览器靠它提前按比例占好位置。不写的话图片下载完会把下面所有内容顶下去，页面"跳"一下。
2. **图片先压过再放进来。** 手机原图动辄 3～8 MB，一页五条动态能到 40 MB，手机上直接劝退。规矩定死：**长边 ≤ 1600px，JPEG，单张 ≤ 200 KB**。（参考：`img/touxiang-512.png` 是 452 KB，比整个站所有 HTML 加起来还大 —— PNG 不适合存照片。）
3. **文件命名**：`img/feed/年-月-日-序号.jpg`，比如 `2026-10-14-1.jpg`。按名字排序就是时间顺序。
4. **排版不用管宽度**：一张图铺满整行；两张并排两列；三张以上自动折行成网格，并且统一裁成正方形（取中间那块）。最多放九张还算顺眼。全部在 `style.css` 第 18 节。

**关于「点进去」**：动态故意**不做单独的详情页**。它本来就短，为每条动态建一个文件会让内容重复一份（和首页、归档那种重复还不一样，那是纯粹的重复）。`id="d-2026-10-14"` 那个锚点是给外部链接用的 —— 你可以在文章里写 `<a href="../me.html#d-2026-10-14">` 引到某一条动态。**如果以后某条动态写得很长**，再考虑给它加到正文里展开。

**生成示例图的那段命令**（把 `img/touxiang.jpg` 裁成正方形、按 JPEG 质量 82 存到 `img/feed/`）：

```powershell
Add-Type -AssemblyName System.Drawing
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
         Where-Object { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality, [int64]82)

$img = [System.Drawing.Image]::FromFile((Resolve-Path 'img\touxiang.jpg').Path)
$bmp = New-Object System.Drawing.Bitmap(1200, 1200, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, 1200, 1200)))
$g.Dispose()
$bmp.Save("$PWD\img\feed\新图.jpg", $codec, $ep)
$bmp.Dispose(); $ep.Dispose(); $img.Dispose()
```

---

## 首页和归档有什么区别

两个页面用的是同一批文章，但**回答的问题不一样**，所以不算重复：

| | 首页（`index.html`） | 归档（`archive.html`） |
| --- | --- | --- |
| 每条显示 | 标题 + 摘要两行 + 标签 | 日期 + 标题 |
| 单条高度 | 约 96px | 约 41px |
| 回答的问题 | 「我该读哪一篇」 | 「我到底写过什么」 |
| 额外功能 | 搜索、标签筛选、置顶 | 一屏扫完全部 |

**现在文章少（5 篇），两个页面看起来像**；等到三五十篇，首页会拉得很长、归档仍然一屏能扫完，差别就自然出来了。

**以后想缓解这种重复**，可以：首页只留「置顶 + 最近 8 篇」+ 一条「查看全部 →」指向归档。⚠️ 真要这么做有**一个坑**：搜索只筛页面上已有的文章，如果只是把旧文章藏起来、不给办法展开，搜索就搜不到它们了。所以要么配一个「加载更多」按钮，要么让搜索时自动展开全部。

---

## 怎么改配色

**所有颜色都在 `css/style.css` 最上面的两组变量里**，改那里就行，不用去改具体规则。

⚠️ **唯一的坑**：深色那一组写了**两遍**（"第 2 节 跟随系统"和"第 3 节 用户手动选择"）。
原因是 CSS 没办法把一组变量定义一次、被两个条件共用。**改深色配色时，两处必须一起改**，否则会出现"跟随系统时是一个颜色、手动切过去是另一个颜色"。

几种改法：

- **换个强调色**：改 `--accent`（浅色和深色各一个）。
  注意深色的那个要用更亮的版本——同一个蓝色放在黑底上会发闷。
- **让置顶更明显 / 更淡**：只改 `--bg-pin`。现在是 `#f4f5f7`（浅色）/ `#1b2027`（深色）。
- **对比度**：`--text-sub` 和 `--text-meta` 是次要文字的颜色，**它们必须满足 4.5:1 的最小对比度**（白底）。现在分别是 6.00:1 和 4.83:1，已经很宽松了，不要往更浅的方向调。

---

## 换成自己的头像

**顶栏里没有头像** —— 站名左边那块只放文字。头像只出现在两个地方：

| 位置 | 元素 | 尺寸 |
| --- | --- | --- |
| 首页的定位卡 | `.intro-avatar` | 44px（手机上 56px） |
| 「我」页的自我介绍 | `.hero-avatar` | 84px |

两处都写在各自页面的行内样式里，指向同一张图 `img/touxiang.jpg`：

```html
<!-- 首页定位卡里 -->
<div class="intro-avatar" style="background-image: url('img/touxiang.jpg')" aria-hidden="true">K</div>

<!-- 「我」页自我介绍里 -->
<div class="hero-avatar" style="background-image: url('img/touxiang.jpg')" aria-hidden="true">K</div>
```

换头像的做法：

1. 把新图片放进 `img/`，**保持文件名 `touxiang.jpg`**（或者改这两处的 `url(...)`）
2. 顺手重新生成两个主屏幕图标尺寸 —— 见上面目录结构里那段 PowerShell
3. **图片尺寸最好是正方形**：这两个元素是圆形裁切（`border-radius: 50%`），长方形的图会被切掉两边

元素里那个 `K` 字不用删，也不用改：图片会盖住它，万一图片没加载出来它就是兜底。

⚠️ 想给顶栏加回头像的话，**不要直接复用 `.intro-avatar`**（它是 44px、配卡片的）。
原来那个 36px 的 `.avatar` 样式已经删掉了，需要重新写一个。

---

## 深色模式是怎么做的

三层，从优先到兜底：

1. **用户手动选过** → `<html>` 上有 `data-theme="dark"` 或 `"light"`，CSS 按这个上色
2. **没选过** → 看系统的 `prefers-color-scheme`，系统深色就深色
3. **连 JavaScript 都没有** → 第 2 层照样生效，因为它是纯 CSS 的媒体查询

选择存在浏览器的 `localStorage` 里，键名是 `xudc-theme`。想恢复"跟随系统"，清掉这个网站的存储即可。

**`js/theme.js` 为什么单独一个文件、放在 `<head>`、而且不能加 `defer`：**
页面是边下载边渲染的。如果等 `<body>` 末尾的脚本跑完再决定主题，页面会先亮一下再变黑（每次打开、每次跳页都闪）。这段代码必须在浏览器画第一帧之前执行完。

---

## 装到手机主屏幕上（PWA）

`manifest.webmanifest` 让这个站可以被"装"成手机上的一个 App：点主屏幕图标打开后**没有浏览器地址栏和工具栏**，点「归档」「我」、点进任何一篇文章，都还在这个无边框的窗口里。

**关键在于 `scope` 这一行：**

```json
"start_url": "./",
"scope": "./",
"display": "standalone",
```

`scope` 划定了"哪些页面算这个 App 的地盘"。地盘内的跳转留在 App 窗口里；跑到地盘外（比如文章里那个 GitHub 外链）才会交给浏览器打开。

**没有 manifest 会怎样**（这就是加它之前的状态）：iOS 只把它存成一条"书签"，认识你保存的那**一个**网址。点图标打开它，确实没有浏览器组件；但一点「归档」跳到另一个网址，iOS 就当是新开了一个网页，Safari 的地址栏全回来了。

**8 个页面都要挂上这几行**，不是只挂在 `index.html`——iOS 打开哪一页，就读哪一页的 manifest 链接：

```html
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="img/touxiang-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
```

⚠️ **文章页（`posts/` 里）的路径要加 `../`**：`../manifest.webmanifest`、`../img/touxiang-180.png`。**加新文章时这是第 4 个要改的地方。**

**改完之后必须重新装一次**：已经加到主屏幕的图标**不会自动更新**。长按图标 → 删除 → Safari 打开站点 → 分享 → 添加到主屏幕。之后进任何页面都不会再出现 Safari 的组件。

**图标**：`img/touxiang-180.png`（180×180，Apple 的规定尺寸）和 `img/touxiang-512.png`（512×512，给 Android/Chrome 用），都是从 `img/touxiang.jpg` 缩小来的。换头像时记得重新生成这两个尺寸；`apple-touch-icon` 的优先级高于 manifest 里 `icons` 那一段。

**`theme-color` 为什么写两个**：独立窗口顶部那条状态栏要跟站点同色。浅色和深色各一个，用 `media="(prefers-color-scheme: light/dark)"` 区分——和深色配色一样，是"同一件事写两遍"，但这次是没法避免的（媒体查询没法合并）。

---

## 关于桌面端

手机和电脑现在是**两套布局，但共用同一份 HTML**。切换点在 `768px`，全部写在 `style.css` 第 14、15 节。

| | 手机（<768px） | 电脑（≥768px） |
| --- | --- | --- |
| 导航位置 | 底部固定栏（`.tabbar`），图标 + 文字 | **顶栏右侧**（`.nav-desktop`），纯文字 |
| 内容列宽 | 铺满屏幕，最大 640px | 最大 720px |
| 正文行宽 | `34em`（约 34 个汉字） | `38em`（约 38 个汉字） |
| 底栏 | 固定在底部 | `display: none` |
| 首页定位卡 | 竖排、居中 | 横排、左对齐（头像在左） |

**为什么手机不受影响**：手机样式全部是默认规则（"手机优先"），桌面端只在 `@media (min-width: 768px)` 里做覆盖。手机屏幕是 375～430px，永远进不了这个媒体查询，所以电脑端的改动在手机上不可能生效。反过来如果写成 `max-width`，就得把现有手机样式搬进媒体查询，搬漏一条就出事。

**唯一的例外是首页定位卡**（`style.css` 第 16 节写桌面横排、第 19 节用 `max-width: 767px` 改成手机竖排）。这是有意反过来写的：这张卡在手机上才是少数派形态，写成默认桌面更短。⚠️ **第 19 节里只放"新加元素"的覆盖，不要往里搬任何原本就有的手机样式** —— 那条警告防的就是这件事。

**`.nav-desktop` 为什么是独立的 `<nav>`**：底栏那三个链接是"图标在上、文字在下"的竖排结构，塞进顶栏要写一堆反向覆盖。所以另外写了一个干净的 `<nav>`，默认 `display: none`，只在桌面端出现。**它写在主题开关按钮之前**，因为有 `margin-left: auto` 把它推到右边；顺序反了就会跑到按钮后面。

**文章页（`posts/` 里）的导航链接要加 `../`**，而且**不加 `.is-active`**——文章页不属于「文章 / 归档 / 我」这三个入口中的任何一个。

**以后想改成电脑端两栏**（左边固定侧栏放导航、右边内容）：现在这套"浏览器自己滚动"的结构不会有阻碍，但因为 `.wrap` 现在是 `margin: 0 auto` 居中，改成两栏要让它脱离居中、改用 `grid` 重排外层结构，属于一次独立的重构，不是加几行覆盖能了事。

---

## 部署到 GitHub Pages

```bash
git init
git add .
git commit -m "首次提交：博客"
git branch -M main
git remote add origin https://github.com/kuanyuchen0309/<仓库名>.git
git push -u origin main
```

然后在 GitHub 仓库里：**Settings → Pages → Source 选 `Deploy from a branch` → 分支选 `main`、目录选 `/ (root)` → Save**。

一两分钟后访问 `https://kuanyuchen0309.github.io/<仓库名>/`。

**注意**：如果仓库名就叫 `kuanyuchen0309.github.io`（用户名同名），那访问地址是 `https://kuanyuchen0309.github.io/`，不用带仓库名。两种都不影响，因为站内全是相对路径。

以后要绑自己的域名（`xudc.org`），在 Pages 设置里填 Custom domain，再去域名商（你用的是 Cloudflare）加一条 CNAME 记录指过去。

---

## 已知的取舍

| 事情 | 现状 | 为什么这样选 |
| --- | --- | --- |
| 加文章要改 3 个地方（另有 4 处属性要对） | 手工同步 | 换来的是"没有构建步骤、内容在 HTML 里、关掉 JS 也能用"。那 4 处是 `<li>` 上的 `data-tags`、`data-newest`、`data-date`，以及文章页 `<head>` 里那几行 manifest/图标（见「装到手机主屏幕上」）。等你以后上 Astro，这些重复会自动消失 |
| 文章文件名就是网址 | 英文 slug + `.html` | 用英文是因为中文文件名在分享时会长成一串 `%E6%9C%89...`；留 `.html` 是因为没有服务器时，这是唯一能表达"这是一个页面"的方式。**改文件名等于改网址，旧链接会断** —— 所以没事别改 |
| 标签筛选不改网址 | 只在本页筛 | 做成 `?tag=读书` 需要改导航和所有链接的写法。代价是筛完的结果不能分享 |
| 上一篇/下一篇导航 | 没有 | 需要知道文章之间的先后关系，属于"内容有元数据"之后的事 |
| 深色配色写了两遍 | `style.css` 第 2、3 节 | 见上面「怎么改配色」 |
| 文章页没有底栏导航 | 只有左上角「文章」返回 | 读长文时给她尽量干净的一屏 |
| 电脑端是单列，不是两栏 | 内容列居中 720px | 两边留白是**刻意的**：一行几十个汉字最舒服，撑满屏反而累。加侧栏要改掉 `.wrap` 的居中结构，属于一次独立重构，收益也不明显（导航已经在顶栏了） |
| 动态不做单独的详情页 | 只有 `#锚点` | 动态本来就短，为每条建文件会让内容重复一份。写长了再考虑 |
