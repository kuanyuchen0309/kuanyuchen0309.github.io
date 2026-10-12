# xudc.org

一个纯静态的个人博客。**没有框架、没有构建步骤、没有依赖**——双击 `index.html` 就能看。

关掉 JavaScript 也照样能用（文章列表、归档、正文、返回链接都是 HTML 里写好的），只是少了深色开关和搜索。

---

## 目录结构

```
blog/
├── index.html            文章列表（按月份分组、搜索、标签、置顶）
├── archive.html          归档（只有日期和标题，用来一眼看完全部文章）
├── me.html               我（自我介绍 + 一条条内容）
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
│   └── app.js            深色开关、搜索、顶栏淡化
├── img/
│   ├── touxiang.jpg      头像原图（645×645）
│   ├── touxiang-180.png  主屏幕图标，从上面那张缩来的
│   └── touxiang-512.png  同上，给 Android 用
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
复制一条 `<li class="post">...</li>` 改内容。

**第 3 步：在 `archive.html` 的归档里加一条。**

**别忘了两件小事：**
- 三个页面顶栏里的「共 N 篇文章」，把 `N` 改掉（`index.html`、`archive.html`、`me.html` 各一处）
- 如果新的月份开始了，要在两个列表里各加一个月份标题：

```html
<section class="month">
  <h2 class="month-title"><span>2026 年 11 月</span></h2>
  <ul class="post-list"> ... </ul>
</section>
```

**关于「置顶」**：给 `<li>` 加上 `is-pinned` 这个 class，它就会变成浅灰底的那一条：

```html
<li class="post is-pinned">
```

建议**最多置顶一篇**——两条浅灰底挨在一起，视觉上会乱。

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

现在是纯文字头像（圆圈里一个 `K`）。换成图片：

1. 把图片放进 `img/`，命名成 `avatar.jpg`
2. 在三个页面（`index.html` / `archive.html` / `me.html`）里的头像元素上加一句行内样式：

```html
<span class="avatar" style="background-image: url('img/avatar.jpg')" aria-hidden="true"></span>
```

注意 `me.html` 里那个大头像的 class 是 `hero-avatar`，路径写 `img/avatar.jpg`（它不在子目录里）。
头像元素里的那个 `K` 字不用删——图片会盖住它；万一图片加载失败，那个字就是兜底。

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

**为什么手机不受影响**：手机样式全部是默认规则（"手机优先"），桌面端只在 `@media (min-width: 768px)` 里做覆盖。手机屏幕是 375～430px，永远进不了这个媒体查询，所以电脑端的改动在手机上不可能生效。反过来如果写成 `max-width`，就得把现有手机样式搬进媒体查询，搬漏一条就出事。

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
| 加文章要改 4 个地方 | 手工同步 | 换来的是"没有构建步骤、内容在 HTML 里、关掉 JS 也能用"。第 4 处是文章页 `<head>` 里那几行 manifest/图标（见「装到手机主屏幕上」）。等你以后上 Astro，这些重复会自动消失 |
| 标签不能点击筛选 | 只展示 | 筛选需要 `?tag=xxx` 这样的网址状态，属于下一阶段的活 |
| 深色配色写了两遍 | `style.css` 第 2、3 节 | 见上面「怎么改配色」 |
| 文章页没有底栏导航 | 只有左上角「文章」返回 | 读长文时给她尽量干净的一屏 |
