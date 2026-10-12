#!/usr/bin/env node
/* ============================================================================
   worker.test.mjs —— OAuth 代理 Worker 的测试
   ----------------------------------------------------------------------------
   不需要 Cloudflare 账号，全在本地跑。用假的 KV、假的 fetch 把整条链路走一遍：

     /login    → 跳 GitHub，种下 state Cookie
     /callback → 换令牌（假 GitHub），把令牌存进 KV，只把会话 id 放进 Cookie
     /session  → 报告登录身份
     /api      → 用 KV 里的令牌去调 GitHub（假 GitHub 检查 Authorization 头）

   跑：node admin/worker/worker.test.mjs
   ============================================================================ */

import worker from "./index.js";

/* ------------------------------------------------------------ 假设施 --- */

/** 内存版 KV，接口只实现 Worker 用到的那几个方法 */
function mockKV() {
  const store = new Map();
  return {
    store,
    async get(k) {
      const v = store.get(k);
      return v === undefined ? null : v;
    },
    async put(k, v) {
      store.set(k, v);
    },
    async delete(k) {
      store.delete(k);
    },
  };
}

const ENV = {
  GITHUB_REPO: "kuanyuchen0309/kuanyuchen0309.github.io",
  GITHUB_BRANCH: "main",
  GITHUB_API_VERSION: "2022-11-28",
  GITHUB_CLIENT_ID: "Iv1.fakeclientid",
  GITHUB_CLIENT_SECRET: "fake-secret-should-never-be-sent-to-browser",
  STATE_SECRET: "fake-state-secret-for-tests",
  ADMIN_URL: "https://kuanyuchen0309.github.io/admin/",
  ALLOWED_ORIGINS: "https://kuanyuchen0309.github.io,https://xudc.org",
  COOKIE_SAMESITE: "None",
  SESSION_TTL_SECONDS: "604800",
  SESSIONS: mockKV(),
};

let passed = 0;
let failed = 0;

function ok(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
  }
}

function section(t) {
  console.log(`\n${t}`);
}

/* --------------------------------------------------- 假的 GitHub --- */

let lastUpstream = null;

globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  lastUpstream = { url: u, init };

  if (u === "https://github.com/login/oauth/access_token") {
    const body = JSON.parse(init.body);
    if (body.code !== "good-code") {
      return new Response(JSON.stringify({ error: "bad_verification_code" }), { status: 200 });
    }
    return new Response(JSON.stringify({ access_token: "gho_FAKE_TOKEN", token_type: "bearer" }), {
      status: 200,
    });
  }

  if (u === "https://api.github.com/user") {
    if ((init.headers.Authorization || "") !== "Bearer gho_FAKE_TOKEN") {
      return new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 });
    }
    return new Response(JSON.stringify({ login: "kuanyuchen0309" }), { status: 200 });
  }

  if (u.startsWith("https://api.github.com/repos/")) {
    if ((init.headers.Authorization || "") !== "Bearer gho_FAKE_TOKEN") {
      return new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 });
    }
    return new Response(JSON.stringify({ ok: true, path: u }), { status: 200 });
  }

  throw new Error(`测试没有为这个地址准备假响应：${u}`);
};

/* ------------------------------------------------------ 跑起来 --- */

const req = (path, opts = {}) =>
  new Request(`https://xudc-editor-oauth.example.workers.dev${path}`, opts);

section("① /login：跳去 GitHub，并种下防 CSRF 的 state Cookie");

let res = await worker.fetch(req("/login", { headers: { Origin: "https://xudc.org" } }), ENV);

ok("状态码是 302", res.status === 302, `实际 ${res.status}`);
const loc = res.headers.get("Location") || "";
ok("跳到 github.com/login/oauth/authorize", loc.startsWith("https://github.com/login/oauth/authorize"), loc);
ok("带上了 client_id", loc.includes("client_id=Iv1.fakeclientid"));
ok("带上了 state", /[?&]state=/.test(loc));
ok("scope 只是 repo", loc.includes("scope=repo"), loc);
ok("redirect_uri 指回 /callback", loc.includes(encodeURIComponent("/callback")), loc);

const setCookie1 = res.headers.get("Set-Cookie") || "";
ok("种下了 xudc_state", setCookie1.includes("xudc_state="), setCookie1);
ok("Cookie 是 HttpOnly", /HttpOnly/i.test(setCookie1));
ok("Cookie 带 Secure", /Secure/i.test(setCookie1));
ok("Cookie 带 SameSite", /SameSite=/i.test(setCookie1));

section("② /login：来源不在名单里必须拒绝");

res = await worker.fetch(req("/login", { headers: { Origin: "https://evil.example" } }), ENV);
ok("返回 403", res.status === 403, `实际 ${res.status}`);
const body403 = await res.json();
ok("错误是 origin_not_allowed", body403.error === "origin_not_allowed", JSON.stringify(body403));

res = await worker.fetch(req("/login"), ENV);
ok("完全不带来 Origin 也拒绝", res.status === 403, `实际 ${res.status}`);

section("③ /callback：state 不对时必须失败（防 CSRF）");

const stateCookie = decodeURIComponent(setCookie1.split("xudc_state=")[1].split(";")[0]);

res = await worker.fetch(
  req(`/callback?code=good-code&state=WRONG-STATE`, { headers: { Cookie: `xudc_state=${encodeURIComponent(stateCookie)}` } }),
  ENV
);
ok("跳回 ADMIN_URL 并带 error", (res.headers.get("Location") || "").includes("error="), res.headers.get("Location"));

res = await worker.fetch(req(`/callback?code=good-code&state=${stateCookie.split(".")[0]}`), ENV);
ok("没有 state Cookie 也失败", (res.headers.get("Location") || "").includes("error=missing_state_cookie"));

section("④ /callback：正常换令牌");

const realState = stateCookie.split(".")[0];
res = await worker.fetch(
  req(`/callback?code=good-code&state=${realState}`, {
    headers: { Cookie: `xudc_state=${encodeURIComponent(stateCookie)}` },
  }),
  ENV
);

ok("状态码 302", res.status === 302, `实际 ${res.status}`);
ok("跳回 ADMIN_URL 且带 ok=1", (res.headers.get("Location") || "").includes("ok=1"), res.headers.get("Location"));

/* 回调会设两个 Cookie：会话 + 清掉 state */
const allCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("Set-Cookie") || ""];
const joined = allCookies.join(" || ");
ok("种下了 xudc_session", joined.includes("xudc_session="), joined);
ok("清掉了 xudc_state", /xudc_state=;/.test(joined), joined);

const sessionId = decodeURIComponent(joined.split("xudc_session=")[1].split(";")[0]);

/* ===== 最关键的一条：令牌绝不能出现在给浏览器的响应里 ===== */
const callbackBody = await res.text();
ok(
  "【安全】回调响应里没有 GitHub 令牌",
  !joined.includes("gho_FAKE_TOKEN") && !callbackBody.includes("gho_FAKE_TOKEN"),
  "令牌泄露到浏览器了"
);
ok(
  "【安全】回调响应里没有 client_secret",
  !joined.includes(ENV.GITHUB_CLIENT_SECRET) && !callbackBody.includes(ENV.GITHUB_CLIENT_SECRET),
  "client_secret 泄露到浏览器了"
);
ok(
  "【安全】会话 Cookie 里放的是随机 id，不是令牌",
  sessionId.length >= 32 && !sessionId.startsWith("gho_"),
  `session=${sessionId.slice(0, 12)}…`
);
ok("令牌确实存进了 KV", [...ENV.SESSIONS.store.values()].some((v) => v.includes("gho_FAKE_TOKEN")));

section("⑤ /session：报告登录身份");

res = await worker.fetch(
  req("/session", { headers: { Cookie: `xudc_session=${encodeURIComponent(sessionId)}`, Origin: "https://xudc.org" } }),
  ENV
);
const sess = await res.json();
ok("loggedIn = true", sess.loggedIn === true, JSON.stringify(sess));
ok("带上用户名", sess.login === "kuanyuchen0309", JSON.stringify(sess));
ok("响应对允许的来源回了 CORS 头", res.headers.get("Access-Control-Allow-Origin") === "https://xudc.org");
ok("允许携带凭证", res.headers.get("Access-Control-Allow-Credentials") === "true");

res = await worker.fetch(req("/session", { headers: { Origin: "https://xudc.org" } }), ENV);
ok("没有 Cookie 时 loggedIn = false", (await res.json()).loggedIn === false);

section("⑥ /api：代理到 GitHub，并且只允许自己的仓库");

let apiRes = await worker.fetch(
  req("/api?p=repos/kuanyuchen0309/kuanyuchen0309.github.io/contents/data/feed.json", {
    headers: { Cookie: `xudc_session=${encodeURIComponent(sessionId)}`, Origin: "https://xudc.org" },
  }),
  ENV
);
ok("代理成功（200）", apiRes.status === 200, `实际 ${apiRes.status}`);
ok("上游用的是 Bearer 令牌", (lastUpstream.init.headers.Authorization || "") === "Bearer gho_FAKE_TOKEN");
ok("默认补上了 branch 参数", lastUpstream.url.includes("branch=main"), lastUpstream.url);

/* ===== 第二条关键安全线：不能拿我的令牌去动别人的仓库 ===== */
apiRes = await worker.fetch(
  req("/api?p=repos/someone-else/their-repo/contents/README.md", {
    headers: { Cookie: `xudc_session=${encodeURIComponent(sessionId)}` },
  }),
  ENV
);
ok("【安全】访问别的仓库被拒绝", apiRes.status === 403, `实际 ${apiRes.status}`);
const denied = await apiRes.json();
ok("错误是 path_not_allowed", denied.error === "path_not_allowed", JSON.stringify(denied));

apiRes = await worker.fetch(
  req("/api?p=user/keys", { headers: { Cookie: `xudc_session=${encodeURIComponent(sessionId)}` } }),
  ENV
);
ok("【安全】/user/keys 这类敏感路径被拒绝", apiRes.status === 403, `实际 ${apiRes.status}`);

apiRes = await worker.fetch(req("/api?p=user", { headers: { Cookie: "xudc_session=bogus" } }), ENV);
ok("伪造的会话 id 拿到 401", apiRes.status === 401, `实际 ${apiRes.status}`);

section("⑦ CORS：不允许的来源不能拿到放行头");

res = await worker.fetch(
  req("/session", { headers: { Cookie: `xudc_session=${encodeURIComponent(sessionId)}`, Origin: "https://evil.example" } }),
  ENV
);
ok("不认识的来源没有 Allow-Origin 头", res.headers.get("Access-Control-Allow-Origin") === null);
ok("但依然是 Vary: Origin（避免缓存串味）", res.headers.get("Vary") === "Origin");

section("⑧ /logout：要真的把 KV 里的令牌删掉");

res = await worker.fetch(
  req("/logout", { headers: { Cookie: `xudc_session=${encodeURIComponent(sessionId)}`, Origin: "https://xudc.org" } }),
  ENV
);
ok("返回 200", res.status === 200);
ok("KV 里的令牌已删除", ![...ENV.SESSIONS.store.values()].some((v) => v.includes("gho_FAKE_TOKEN")));
ok("清掉了会话 Cookie", /xudc_session=;/.test(res.headers.get("Set-Cookie") || ""));

res = await worker.fetch(
  req("/session", { headers: { Cookie: `xudc_session=${encodeURIComponent(sessionId)}` } }),
  ENV
);
ok("登出后再问 session 就是未登录", (await res.json()).loggedIn === false);

section("⑨ 配置缺失时要报清楚，不要静默失败");

const bare = { ...ENV, GITHUB_CLIENT_ID: "" };
res = await worker.fetch(req("/login", { headers: { Origin: "https://xudc.org" } }), bare);
ok("缺 GITHUB_CLIENT_ID 时返回 500", res.status === 500, `实际 ${res.status}`);
ok("错误信息点明了缺哪个变量", (await res.text()).includes("GITHUB_CLIENT_ID"), "错误信息没说清缺什么");

/* ------------------------------------------------------------ 汇总 --- */

console.log(`\n${"─".repeat(60)}`);
console.log(`通过 ${passed} 项，失败 ${failed} 项`);
if (failed > 0) {
  console.log("有测试没通过。");
  process.exit(1);
}
console.log("全部通过。");
