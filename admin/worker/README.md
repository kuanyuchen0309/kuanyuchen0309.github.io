# 编辑器用的 GitHub OAuth 代理

这是「在手机上直接发一条动态」需要的那块服务端组件。**只有这一个 Worker，没有别的服务器。**

## 它解决什么问题

编辑页面要往 GitHub 写文件，就必须持有能写仓库的凭证。而这个仓库就是**网站在对外服务的源**——把令牌放在公开网站的浏览器里，一旦泄露，拿到它的人可以往 `index.html` 里注入 JavaScript，于是**每一个访问你博客的人都会被投毒**。

所以令牌绝不进浏览器：

```
浏览器  --① 跳转登录--------------->  GitHub
浏览器  <--② 带 code 回调-----------  这个 Worker
Worker  --③ 用 client_secret 换令牌->  GitHub
Worker  --④ 令牌存进 KV，只把随机会话 id 放进 httpOnly Cookie
浏览器  --⑤ 带 Cookie 请求 /api---->  Worker --⑥ 用 KV 里的令牌调 GitHub
```

浏览器全程只拿到一个**随机会话 id**，拿不到 GitHub 令牌。Cookie 是 `httpOnly`，页面脚本读不到。

**两条不能动的安全线**（有测试盯着，见 `worker.test.mjs`）：

1. 令牌和 `client_secret` 绝不出现在任何给浏览器的响应里
2. `/api` 只允许访问 `GITHUB_REPO` 指定的那一个仓库——不限制的话，拿到会话的页面就能用你的令牌读写你账号下**所有**仓库

## 部署步骤

### 0. 先决条件

- 一个 Cloudflare 账号（免费额度足够）
- 本机已装 `wrangler`（已经装了，v4.131.1），没装的话 `npm i -g wrangler`
- 在 `wrangler.jsonc` 里把 `GITHUB_REPO` 改成你的仓库名

### 1. 建 GitHub OAuth App

GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**

| 字段 | 填什么 |
| --- | --- |
| Application name | 随便，比如 `xudc.org 编辑器` |
| Homepage URL | `https://xudc.org/`（还没切域名就先填 `https://kuanyuchen0309.github.io/`） |
| **Authorization callback URL** | **部署完 Worker 之后才知道**，见第 4 步 |

⚠️ **OAuth App 只允许填一个回调地址。** 而且我们的 Worker 会把浏览器重定向回 `ADMIN_URL`（`wrangler.jsonc` 里的那一个），所以如果你想让编辑页同时能在 `xudc.org/admin/` 和 `kuanyuchen0309.github.io/admin/` 打开，**登录只能从 `ALLOWED_ORIGINS` 里的任意一个来源发起，但登录完一定跳回 `ADMIN_URL` 指定的那一个**。这是 GitHub 的限制，不是这个 Worker 的缺陷。

创建完记下 **Client ID**，再点 **Generate a new client secret** 生成密钥。

### 2. 建 KV 命名空间（存会话）

```bash
cd admin/worker
npx wrangler kv namespace create SESSIONS
```

把输出里的 `id` 填进 `wrangler.jsonc` 的 `kv_namespaces[0].id`。

### 3. 设置三个机密变量

```bash
npx wrangler secret put GITHUB_CLIENT_ID      # 第 1 步的 Client ID
npx wrangler secret put GITHUB_CLIENT_SECRET  # 第 1 步的 client secret
npx wrangler secret put STATE_SECRET          # 随便一串长随机字符
```

`STATE_SECRET` 用来给 OAuth 的 `state` 签名（防 CSRF），随便生成一串就行，比如：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### 4. 部署，然后把回调地址填回 GitHub

```bash
npx wrangler deploy
```

部署成功会打印你的 Worker 地址，形如 `https://xudc-editor-oauth.<你的子域>.workers.dev`。

**把这个地址加 `/callback` 填回第 1 步那个 OAuth App 的 Authorization callback URL**，也就是：

```
https://xudc-editor-oauth.<你的子域>.workers.dev/callback
```

⚠️ 第 1 步到这一步之间，回调地址填什么都不对——这是先有鸡还是先有蛋，只能先随便填、部署完再回来改。

### 5. 改 `ALLOWED_ORIGINS`

`wrangler.jsonc` 里的 `ALLOWED_ORIGINS` 必须是**编辑页所在的所有来源**，逗号分隔：

```jsonc
"ALLOWED_ORIGINS": "https://xudc.org,https://kuanyuchen0309.github.io"
```

改完再 `npx wrangler deploy` 一次。

**这一项不能图省事写成 `*`。** 写了通配符，任何一个网页都能拿着你浏览器的 Cookie 调这个代理。

## 跑测试

```bash
node admin/worker/worker.test.mjs
```

43 项断言，不需要 Cloudflare 账号，全在本地跑（用假的 KV 和假的 GitHub）。覆盖：

- 登录跳转的每个参数、Cookie 的每个属性
- 来源不在名单里必须 403
- state 不匹配必须失败（防 CSRF）
- **令牌和 client_secret 不泄露到浏览器**
- **不能用你的令牌访问别人的仓库**
- CORS 只对认识的来源放行
- 登出要真的把 KV 里的令牌删掉
- 配置缺失时报错要指明缺哪个变量

## 文件

| 文件 | 作用 |
| --- | --- |
| `index.js` | Worker 本体。约 330 行，每一段为什么这么写都有注释 |
| `wrangler.jsonc` | 部署配置。**仓库名、来源名单、回调地址都在这里改** |
| `worker.test.mjs` | 本地测试，不需要账号 |

## 环境变量一览

| 变量 | 放哪 | 说明 |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | secret | OAuth App 的 Client ID |
| `GITHUB_CLIENT_SECRET` | secret | ⚠️ 机密，绝不能进前端 |
| `STATE_SECRET` | secret | 给防 CSRF 的 state 签名 |
| `GITHUB_REPO` | vars | `owner/repo`，**只允许写这一个仓库** |
| `GITHUB_BRANCH` | vars | 新文件默认提交到哪个分支 |
| `GITHUB_API_VERSION` | vars | GitHub API 版本，默认 `2022-11-28` |
| `GITHUB_SCOPE` | vars | OAuth 权限范围，默认 `repo`（要读写仓库内容） |
| `ADMIN_URL` | vars | 登录成功后跳回哪个地址 |
| `ALLOWED_ORIGINS` | vars | 允许调用这个 Worker 的来源，逗号分隔 |
| `COOKIE_SAMESITE` | vars | 跨站时必须 `None`（此时浏览器强制要求 `Secure`） |
| `SESSION_TTL_SECONDS` | vars | 会话有效期，默认 7 天 |
| `SESSIONS` | KV 绑定 | 存会话和令牌 |
