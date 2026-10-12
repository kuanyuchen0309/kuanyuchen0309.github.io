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
│   ├── why-learn-web.html
│   ├── week1-first-page.html
│   ├── silent-css-failures.html
│   ├── week2-responsive.html
│   └── meta-charset-1024.html
├── css/
│   ├── style.css         全站：配色变量、顶栏、底栏、列表、「我」页
│   └── post.css          只有文章页加载：正文的阅读排版
├── js/
│   ├── theme.js          深色模式的"防闪烁"脚本（必须在 <head> 里）
│   └── app.js            深色开关、搜索、顶栏淡化
└── img/                  放头像图片（现在是空的，见下面「换成自己的头像」）
```

**所有路径都是相对路径**（`../css/style.css` 这种），没有以 `/` 开头的绝对路径。
原因：GitHub Pages 的项目站点是挂在 `/仓库名/` 下面的，绝对路径会指错地方。

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

## 关于桌面端

现在手机和电脑用的是**同一套布局**：手机上铺满，电脑上是一个最大 640px、水平居中的单列。

这样做的好处是简单、不容易出错；代价是电脑上少了一些空间利用。如果以后想做电脑端两栏（左边固定侧栏放导航、右边内容），用 `@media (min-width: 768px)` 加一段 Flexbox 就行——现在这套"浏览器自己滚动"的结构不会有阻碍。

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
| 加文章要改 3 个地方 | 手工同步 | 换来的是"没有构建步骤、内容在 HTML 里、关掉 JS 也能用"。等你以后上 Astro，这个重复会自动消失 |
| 标签不能点击筛选 | 只展示 | 筛选需要 `?tag=xxx` 这样的网址状态，属于下一阶段的活 |
| 深色配色写了两遍 | `style.css` 第 2、3 节 | 见上面「怎么改配色」 |
| 文章页没有底栏导航 | 只有左上角「文章」返回 | 读长文时给她尽量干净的一屏 |
