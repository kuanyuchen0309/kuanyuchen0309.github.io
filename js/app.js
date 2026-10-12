/* ============================================================================
   xudc.org —— 页面交互
   ----------------------------------------------------------------------------
   这里面全都是"增强"，不是"必需"：

     关掉 JavaScript，这个网站照样能用 ——
     文章列表、归档、文章正文、返回链接，全是 HTML 里就写好的。
     只有四件事会失效：深色开关、搜索、顶栏淡化、按 Esc 清空搜索。

   这么做的理由：脚本一旦出错，页面不会变成白屏，只是少几个功能。
   ============================================================================ */
(function () {
  "use strict";

  const KEY = "xudc-theme";
  const root = document.documentElement;


  /* ==========================================================================
     一、深色模式开关
     --------------------------------------------------------------------------
     CSS 里已经写好了两种状态的配色：
       ① 跟随系统（没有 data-theme 属性时）
       ② 用户手动选（有 data-theme="dark" 或 "light" 时）

     这个开关只做一件事：把 <html> 上的 data-theme 改掉，并把选择存起来。
     真正的上色工作全部交给 CSS —— 这样不写 JS 也不会出错。
     ========================================================================== */
  const toggle = document.getElementById("themeToggle");
  const mq = window.matchMedia("(prefers-color-scheme: dark)");

  /* 算出"现在实际是什么主题"：
     用户选过 → 用他选的；没选过 → 看系统。 */
  function currentTheme() {
    const forced = root.getAttribute("data-theme");
    if (forced === "dark" || forced === "light") {
      return forced;
    }
    return mq.matches ? "dark" : "light";
  }

  /* 按钮上的提示文字要跟着状态变，读屏软件读到的才是准的 */
  function syncToggleLabel() {
    if (!toggle) {
      return;
    }
    const next = currentTheme() === "dark" ? "浅色" : "深色";
    toggle.setAttribute("aria-label", "切换到" + next + "模式");
    toggle.setAttribute("title", "切换到" + next + "模式");
  }

  if (toggle) {
    syncToggleLabel();

    toggle.addEventListener("click", function () {
      const next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        window.localStorage.setItem(KEY, next);
      } catch (e) {
        /* 存不了就只在本次会话生效，不影响功能 */
      }
      syncToggleLabel();
    });

    /* 用户还没手动选过时，系统主题变了，按钮上的提示文字也要跟着变 */
    if (mq.addEventListener) {
      mq.addEventListener("change", syncToggleLabel);
    } else if (mq.addListener) {
      mq.addListener(syncToggleLabel); /* 老版 Safari */
    }
  }


  /* ==========================================================================
     二、搜索
     --------------------------------------------------------------------------
     直接在 DOM 里筛：把不匹配的 <li class="post"> 加上 hidden 属性。
     一个月的文章全被筛掉了，就连月份标题一起藏起来。

     没有做成"搜索服务"是因为：内容本来就在 HTML 里，
     用不着网络请求，也用不着索引 —— 几百篇以内这样筛是一瞬间的事。
     ========================================================================== */
  const form = document.querySelector(".search");
  const input = document.getElementById("q");
  const listWrap = document.getElementById("listWrap");
  const emptyTip = document.getElementById("listEmpty");

  if (form) {
    /* 输入框没写 name，回车本来也不会带参数；这里再挡一下，
       免得回车时页面重新加载、把筛好的结果冲掉。 */
    form.addEventListener("submit", function (e) {
      e.preventDefault();
    });
  }

  if (input && listWrap) {
    const posts = listWrap.querySelectorAll(".post");
    const months = listWrap.querySelectorAll(".month");

    const runFilter = function () {
      const k = input.value.trim().toLowerCase();
      let shown = 0;

      posts.forEach(function (li) {
        const hit = !k || li.textContent.toLowerCase().indexOf(k) !== -1;
        li.hidden = !hit;
        if (hit) {
          shown += 1;
        }
      });

      months.forEach(function (m) {
        m.hidden = m.querySelectorAll(".post:not([hidden])").length === 0;
      });

      if (emptyTip) {
        emptyTip.hidden = shown !== 0;
      }
    };

    input.addEventListener("input", runFilter);

    /* 按 Esc 清空搜索 —— 手机上这比一个个删快 */
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && input.value !== "") {
        e.preventDefault();
        input.value = "";
        runFilter();
      }
    });
  }


  /* ==========================================================================
     三、顶栏淡化（只在「我」页生效）
     --------------------------------------------------------------------------
     这一页的结构是：顶栏（吸顶）→ 一大块自我介绍 → 一条条内容。

     往下翻过自我介绍之后，顶栏从「站点名 + 篇数」淡变成「头像 + 名字」。

     为什么用"淡化"而不是"把自我介绍压扁"：
       压扁会让下面的内容整体往上跳两三百像素，很晃眼。
       顶栏高度不变、只换里面的字，就没有任何跳动。

     判断条件用 getBoundingClientRect()，它拿到的是元素相对【屏幕】的位置，
     比 offsetTop 可靠（offsetTop 会被各种定位祖先影响）。
     ========================================================================== */
  const topbar = document.querySelector(".topbar");
  const hero = document.querySelector(".hero");

  if (topbar && hero && topbar.querySelector(".bar-b")) {
    const syncTopbar = function () {
      const pastHero = hero.getBoundingClientRect().bottom < topbar.offsetHeight;
      topbar.classList.toggle("is-alt", pastHero);
    };

    syncTopbar();
    window.addEventListener("scroll", syncTopbar, { passive: true });
    window.addEventListener("resize", syncTopbar);
  }
})();
