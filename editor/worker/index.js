/**
 * xudc.org —— 编辑器用的 GitHub OAuth 代理（Cloudflare Worker）
 * ============================================================================
 *
 * 【这个文件为什么必须存在】
 *
 * 目标是在手机上直接发一条动态。编辑页面要往 GitHub 写文件，就必须持有能写
 * 仓库的凭证。而这个仓库就是网站在对外服务的源 —— 把长命令牌放在公开网站的
 * 浏览器里，一旦泄露，拿到它的人可以往 index.html 里注入 JavaScript，
 * 于是【每一个访问你博客的人都会被投毒】。那不是"博客被改乱"，那是把站变成
 * 攻击载荷。
 *
 * 所以令牌绝不能进浏览器。做法是：
 *
 *   浏览器  --① 跳转登录-->  GitHub
 *   浏览器  <--② 带 code 回调-- 这个 Worker
 *   这个 Worker --③ code 换令牌（用 client_secret）--> GitHub
 *   这个 Worker --④ 令牌存进 KV，只把【随机会话 id】放进 httpOnly Cookie--> 浏览器
 *   浏览器  --⑤ 带着 Cookie 请求 /api--> 这个 Worker --⑥ 用 KV 里的令牌调 GitHub
 *
 * 浏览器全程只拿到一个随机的会话 id，拿不到 GitHub 令牌；Cookie 是 httpOnly，
 * 页面上的脚本读不到它。
 *
 * 【要配的东西】见同目录 README.md
 * ============================================================================
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, env);

    /* 预检请求 */
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      switch (url.pathname) {
        case "/login":
          return await handleLogin(request, env);
        case "/callback":
          return await handleCallback(request, env);
        case "/session":
          return await handleSession(request, env, cors);
        case "/logout":
          return await handleLogout(request, env, cors);
        case "/config":
          return await handleConfig(env, cors);
        case "/api":
          return await handleApi(request, env, cors);
        case "/":
          return json({ ok: true, service: "xudc-editor-oauth" }, 200, cors);
        default:
          return json({ error: "not_found", path: url.pathname }, 404, cors);
      }
    } catch (e) {
      /* 出错时不要把内部细节吐给浏览器，但服务端日志要留全 */
      console.error("worker error:", e && e.stack ? e.stack : e);
      return json({ error: "server_error", message: String(e && e.message || e) }, 500, cors);
    }
  },
};

/* --------------------------------------------------------------- CORS --- */

/**
 * 允许哪些来源访问这个 Worker。
 * 环境变量 ALLOWED_ORIGINS 是逗号分隔的列表，比如：
 *   https://xudc.org,https://kuanyuchen0309.github.io
 *
 * ⚠️ 绝不能用 "*"。用了通配符，任何一个网页都能拿着用户的 Cookie 调这个代理。
 */
function corsHeaders(origin, env) {
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const h = {
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-GitHub-Api-Version",
    "Access-Control-Max-Age": "600",
  };

  if (origin && allowed.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    /* 要带 Cookie，这一行不能少 */
    h["Access-Control-Allow-Credentials"] = "true";
  }
  return h;
}

function json(body, status, extra) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...(extra || {}) },
  });
}

/* --------------------------------------------------------- 小工具 --- */

const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str) {
  const p = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(p + "=".repeat((4 - (p.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** 签名一段文本，返回 base64url 形式的签名 */
async function sign(value, secret) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return b64url(new Uint8Array(sig));
}

/** 验证签名。用 timingSafeEqual 的思路：先各自摘要再比，避免逐字节提前返回 */
async function verify(value, signature, secret) {
  const expect = await sign(value, secret);
  if (expect.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expect.length; i++) {
    diff |= expect.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

async function randomId(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return b64url(a);
}

function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function cookieHeader(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "Secure"];
  /* SameSite=None 必须同时带 Secure，否则浏览器直接丢掉这个 Cookie。
     Worker 在 *.workers.dev 上、编辑页在 github.io 或 xudc.org 上，
     属于跨站，所以必须是 None。如果哪天编辑页和 Worker 变成同站，可以改成 Lax。 */
  parts.push(`SameSite=${opts.sameSite || "None"}`);
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`);
  return parts.join("; ");
}

function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`;
}

function sameSite(env) {
  const v = String(env.COOKIE_SAMESITE || "None");
  return v === "Lax" || v === "Strict" ? v : "None";
}

/** 配置缺了就直接报清楚，别等运行到一半才莫名其妙地失败 */
function requireEnv(env, keys) {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`缺少环境变量：${missing.join(", ")}（部署前用 wrangler secret put 设置）`);
  }
}

function adminUrl(env) {
  const base = String(env.ADMIN_URL || "").replace(/\/+$/, "");
  return base || "/";
}

function repoSlug(env) {
  const repo = String(env.GITHUB_REPO || "");
  if (!/^[^/]+\/[^/]+$/.test(repo)) {
    throw new Error('GITHUB_REPO 必须写成 "owner/repo" 的形式');
  }
  return repo;
}

/* ------------------------------------------------------------- /config --- */

/** 编辑页从这儿拿"要往哪个仓库写、默认分支是什么" */
async function handleConfig(env, cors) {
  return json(
    {
      repo: env.GITHUB_REPO || null,
      branch: env.GITHUB_BRANCH || "main",
      loggedIn: false,
    },
    200,
    cors
  );
}

/* ------------------------------------------------------- /login /callback --- */

async function handleLogin(request, env) {
  requireEnv(env, ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "STATE_SECRET", "ALLOWED_ORIGINS"]);

  const url = new URL(request.url);
  const origin = request.headers.get("Origin") || url.searchParams.get("origin") || "";

  const allowed = String(env.ALLOWED_ORIGINS).split(",").map((s) => s.trim());
  if (!origin || !allowed.includes(origin)) {
    /* 不在名单里的来源不许发起登录，否则任何一个页面都能把你的浏览器
       拐去做一次 OAuth 授权 */
    return json({ error: "origin_not_allowed", origin }, 403);
  }

  const state = await randomId(16);
  const sig = await sign(state, env.STATE_SECRET);

  const redirectUri = `${url.origin}/callback`;
  const auth = new URL("https://github.com/login/oauth/authorize");
  auth.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  auth.searchParams.set("redirect_uri", redirectUri);
  /* repo 就够了：要读写仓库内容。不要加 workflow 之类的额外权限 */
  auth.searchParams.set("scope", env.GITHUB_SCOPE || "repo");
  auth.searchParams.set("state", state);
  /* 让用户能换账号（默认会静默复用已授权的账号，调试时很烦） */
  auth.searchParams.set("allow_signup", "false");

  return new Response(null, {
    status: 302,
    headers: {
      Location: auth.toString(),
      /* state 和它的签名一起放 Cookie：回调时用它防 CSRF */
      "Set-Cookie": cookieHeader(`xudc_state`, `${state}.${sig}`, {
        maxAge: 600,
        sameSite: sameSite(env),
      }),
    },
  });
}

async function handleCallback(request, env) {
  requireEnv(env, ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "STATE_SECRET", "ALLOWED_ORIGINS", "SESSIONS"]);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const fail = (why) => {
    const u = new URL(adminUrl(env));
    u.searchParams.set("error", why);
    return new Response(null, { status: 302, headers: { Location: u.toString() } });
  };

  if (!code || !state) return fail("missing_code");

  /* 防 CSRF：回调里的 state 必须和登录时种下的那份一致，且签名有效 */
  const raw = readCookie(request, "xudc_state");
  if (!raw) return fail("missing_state_cookie");

  const dot = raw.lastIndexOf(".");
  if (dot === -1) return fail("bad_state_cookie");

  const cookieState = raw.slice(0, dot);
  const cookieSig = raw.slice(dot + 1);

  if (cookieState !== state) return fail("state_mismatch");
  if (!(await verify(cookieState, cookieSig, env.STATE_SECRET))) return fail("bad_state_signature");

  /* code 换令牌。client_secret 只存在于这个 Worker 的环境变量里，永远不下发 */
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/callback`,
    }),
  });

  const tokenJson = await tokenRes.json().catch(() => ({}));
  const token = tokenJson.access_token;
  if (!token) {
    console.error("token exchange failed:", JSON.stringify(tokenJson));
    return fail("token_exchange_failed");
  }

  /* 顺手拿一下用户名，编辑页要显示"已登录为谁" */
  let login = null;
  try {
    const me = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "xudc-editor", Accept: "application/vnd.github+json" },
    });
    if (me.ok) login = (await me.json()).login || null;
  } catch (e) {
    /* 拿不到用户名不影响写文章，忽略 */
  }

  /* 会话 id 进 Cookie，令牌进 KV。
     这样 Cookie 很小、可以随时撤销、也不会每次请求都带着令牌。 */
  const sid = await randomId(32);
  const ttl = Number(env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 7);
  await env.SESSIONS.put(
    `s:${sid}`,
    JSON.stringify({ token, login, at: Date.now() }),
    { expirationTtl: ttl }
  );

  const back = new URL(adminUrl(env));
  back.searchParams.set("ok", "1");

  return new Response(null, {
    status: 302,
    headers: [
      ["Location", back.toString()],
      ["Set-Cookie", cookieHeader("xudc_session", sid, { maxAge: ttl, sameSite: sameSite(env) })],
      ["Set-Cookie", clearCookie("xudc_state")],
    ],
  });
}

/* --------------------------------------------------- /session /logout --- */

async function handleSession(request, env, cors) {
  const s = await loadSession(request, env);
  if (!s) return json({ loggedIn: false }, 200, cors);
  return json({ loggedIn: true, login: s.login || null }, 200, cors);
}

async function handleLogout(request, env, cors) {
  const sid = readCookie(request, "xudc_session");
  /* 真的把 KV 里的令牌删掉 —— 只清 Cookie 的话，那个令牌还有效 */
  if (sid && env.SESSIONS) await env.SESSIONS.delete(`s:${sid}`);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors, "Set-Cookie": clearCookie("xudc_session") },
  });
}

async function loadSession(request, env) {
  if (!env.SESSIONS) return null;
  const sid = readCookie(request, "xudc_session");
  if (!sid) return null;
  const raw = await env.SESSIONS.get(`s:${sid}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------- /api --- */

/**
 * 把浏览器的请求转发到 GitHub API。
 *
 * 路径通过 ?p= 传，比如 ?p=repos/owner/repo/contents/data/feed.json
 *
 * ⚠️ 这里【必须】限制只能访问配置的那个仓库。不限制的话，任何一个拿到会话的
 * 页面都能用你的令牌去读写你账号下的【所有】仓库 —— 那就等于把整个 GitHub
 * 账号交出去了。下面这个检查是这一段代码里最重要的一行。
 */
async function handleApi(request, env, cors) {
  requireEnv(env, ["GITHUB_REPO", "SESSIONS"]);

  const url = new URL(request.url);
  let p = url.searchParams.get("p") || "";
  const repo = repoSlug(env);

  const s = await loadSession(request, env);
  if (!s) return json({ error: "not_logged_in" }, 401, cors);

  /* 新建文件时 GitHub API 要求带 ?branch=xxx，不写就走仓库默认分支。
     编辑页不该操心这件事，所以在这里补上：只要请求里没显式指定分支，
     就补成配置里的默认分支。 */
  if (env.GITHUB_BRANCH && p.startsWith(`repos/${repo}/contents/`) && !/[?&]branch=/.test(p)) {
    p += (p.includes("?") ? "&" : "?") + `branch=${encodeURIComponent(env.GITHUB_BRANCH)}`;
  }

  /* 只允许访问自己的仓库，或者 /user（编辑页要用它显示登录身份）。
     注意这个检查要在【补上 branch 参数之前】用原始路径做，否则拼进来的
     ?branch=... 会影响前缀匹配的判断。所以这里先算好 allowed。 */
  const pathOnly = p.split("?")[0];
  const allowedPrefixes = [`repos/${repo}/`];
  const ok = pathOnly === "user" || allowedPrefixes.some((x) => pathOnly.startsWith(x));
  if (!ok) {
    return json({ error: "path_not_allowed", path: pathOnly, repo }, 403, cors);
  }

  const method = request.method.toUpperCase();
  if (!["GET", "PUT", "POST", "PATCH", "DELETE"].includes(method)) {
    return json({ error: "method_not_allowed", method }, 405, cors);
  }

  const headers = {
    Authorization: `Bearer ${s.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": env.GITHUB_API_VERSION || "2022-11-28",
    "User-Agent": "xudc-editor",
  };

  const hasBody = method !== "GET" && method !== "DELETE";
  if (hasBody) headers["Content-Type"] = "application/json";

  const upstream = await fetch(`https://api.github.com/${p}`, {
    method,
    headers,
    body: hasBody ? await request.text() : undefined,
  });

  /* 原样把状态码和 body 传回去，编辑页自己判断 409（sha 不匹配）之类的错误 */
  const body = await upstream.text();
  const out = new Headers(cors);
  out.set("Content-Type", upstream.headers.get("Content-Type") || "application/json");
  for (const h of ["etag", "x-ratelimit-remaining", "x-ratelimit-reset"]) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(body, { status: upstream.status, headers: out });
}
