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

  /* 标签筛选要用的几个元素。找不到就说明这个页面没有列表（比如「我」页），
     下面所有相关逻辑都会自己跳过。 */
  const filterBar = document.getElementById("filterBar");
  const filterTagEl = document.getElementById("filterTag");
  const filterCountEl = document.getElementById("filterCount");
  const filterClear = document.getElementById("filterClear");
  const hasTags = !!(listWrap && filterBar && filterClear);

  /* 当前选中的标签（空字符串 = 没筛） */
  let activeTag = "";

  /* 把一个 li 上的 data-tags="随笔 生活" 拆成数组 */
  function tagsOf(li) {
    return (li.getAttribute("data-tags") || "").split(/\s+/).filter(Boolean);
  }

  /* 标题、摘要、标签合起来当一段文字，给搜索用 */
  function haystackOf(li) {
    const link = li.querySelector(".post-link") || li;
    return link.textContent.toLowerCase();
  }

  /* ==========================================================================
     唯一的筛选入口
     --------------------------------------------------------------------------
     搜索和标签筛选都会改这一件事：某些文章该不该显示。
     所以判断写在一处、由两边共同调用，而不是各写一套 —— 各写一套的话，
     两个条件叠加时（比如"选了 #随笔 又在搜书名"）行为会互相打架。
     ========================================================================== */
  function applyFilter() {
    if (!listWrap) {
      return;
    }

    const k = input ? input.value.trim().toLowerCase() : "";
    let shown = 0;

    listWrap.querySelectorAll(".post").forEach(function (li) {
      const byTag = !activeTag || tagsOf(li).indexOf(activeTag) !== -1;
      const byText = !k || haystackOf(li).indexOf(k) !== -1;
      const hit = byTag && byText;

      li.hidden = !hit;
      if (hit) {
        shown += 1;
      }
    });

    /* 一个月的文章全被筛掉了，就连月份标题一起藏起来 */
    listWrap.querySelectorAll(".month").forEach(function (m) {
      m.hidden = m.querySelectorAll(".post:not([hidden])").length === 0;
    });

    if (emptyTip) {
      emptyTip.hidden = shown !== 0;
    }

    if (hasTags) {
      filterBar.hidden = activeTag === "";
      if (activeTag) {
        filterTagEl.textContent = "#" + activeTag;
        filterCountEl.textContent = " · " + shown + " 篇";
      }
    }
  }

  if (input && listWrap) {
    input.addEventListener("input", applyFilter);

    /* 按 Esc 清空搜索 —— 手机上这比一个个删快。
       注意这里【不清除标签筛选】：Esc 的语义是"清掉我刚打的字"。
       想取消标签，点筛选行里的「清除」，或者再点一次那个标签。 */
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && input.value !== "") {
        e.preventDefault();
        input.value = "";
        applyFilter();
      }
    });
  }


  /* ==========================================================================
     二之二、标签筛选
     --------------------------------------------------------------------------
     标签在 HTML 里写的是 <span class="tag">#随笔</span>。

     有 JavaScript 的时候，这里把它【就地换成 <button>】：
     同样是那枚标签，但变成真的能按的东西（能看到焦点框、能按空格键触发、
       读屏软件会念成"按钮"）。不用 <div onclick> 硬做，是因为那样键盘用不了。

     没有 JavaScript 的时候它就是一段死文字 —— 也就是说，标签永远不会
     出现"看着能点、点了没反应"的情况。
     ========================================================================== */
  if (hasTags) {
    const tagEls = listWrap.querySelectorAll(".tag");

    /* 把 span 换成 button，样式不变（.is-tag-btn 和 .tag 是同一套尺寸）。

       ⚠️ 这里必须【幂等】：已经换成按钮的跳过，不要再套一层。
       因为这段代码有可能被执行第二次（浏览器"后退"时从缓存恢复页面、
       某些扩展重新注入脚本都会造成这种局面）。不判断的话，第二次会把
       <button class="tag is-tag-btn"> 当成待升级的标签，再包一层，
       页面上就出现两份标签，而且后面查按钮数量、点标签都会跟着错乱。 */
    tagEls.forEach(function (span) {
      if (span.classList.contains("is-tag-btn")) {
        return;
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag is-tag-btn";
      btn.textContent = span.textContent;
      btn.setAttribute("data-tag", span.textContent.replace(/^#/, ""));
      btn.setAttribute("aria-pressed", "false");
      span.parentNode.replaceChild(btn, span);
    });

    /* 点标签：选中它；已经选中的话再点一次就取消 —— 和开关一样 */
    listWrap.addEventListener("click", function (e) {
      const btn = e.target.closest(".is-tag-btn");
      if (!btn) {
        return;
      }

      /* 标签在 <a> 里面，不拦住的话点标签会同时跳进那篇文章 */
      e.preventDefault();

      const tag = btn.getAttribute("data-tag") || "";
      activeTag = activeTag === tag ? "" : tag;

      listWrap.querySelectorAll(".is-tag-btn").forEach(function (b) {
        const on = b.getAttribute("data-tag") === activeTag;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });

      applyFilter();
    });

    filterClear.addEventListener("click", function () {
      activeTag = "";
      listWrap.querySelectorAll(".is-tag-btn").forEach(function (b) {
        b.classList.remove("is-on");
        b.setAttribute("aria-pressed", "false");
      });
      applyFilter();
    });
  }


  /* ==========================================================================
     二之三、顶栏的「最后更新」
     --------------------------------------------------------------------------
     原来这里写的是一句死文字「共 5 篇文章」，加一篇文章就要回来改一遍，
     而且首页一眼就能看到全部文章，这句话本身没什么信息量。

     改成从 HTML 里算：标了 data-newest 的那一篇的 data-date，就是"最后更新"。
     这样加文章时只要把 data-newest 和 data-date 挪到新的那一条上，顶栏自己会跟着变。

     ⚠️ 日期读的是 li 上的 data-date，不是 <time datetime>。
     因为首页列表里的日期是由月份标题（2026 年 10 月）承担的，每条文章里
     故意不写 <time> —— 所以去列表里找 <time> 是找不到的。
     （这里仍然保留"如果有 <time> 就用它"的兜底，方便以后改结构。）

     只处理带 id="statusLatest" 的元素；归档页和「我」页没有列表，
     那两页里的文字是静态兜底，这里不会去动它。
     ========================================================================== */
  const latest = document.querySelector("[data-newest]");

  if (latest) {
    const statusEl = document.getElementById("statusLatest");
    const timeEl = latest.querySelector("time[datetime]");
    const raw = latest.getAttribute("data-date") ||
                (timeEl ? timeEl.getAttribute("datetime") : "");

    if (statusEl && raw) {
      const parts = raw.split("-");
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);

      if (month && day) {
        statusEl.textContent = "最后更新：" + month + " 月 " + day + " 日";
      }
      /* 取不到合法日期就保持 HTML 里那句兜底文字，不显示半截结果 */
    }
  }


  /* ==========================================================================
     二之四、置顶排序
     --------------------------------------------------------------------------
     置顶在 HTML 里是 <li class="post is-pinned" data-pin="1">。

     data-pin 里的数字只用来【决定置顶之间的先后】，不参与日期排序：
       数字小的排前面，没写数字的当作 0，也就是排在最前。
     所以想把某一篇挪到置顶第一位，改数字就行，不用搬动整段 HTML。

     只有一条置顶的时候，这段代码什么也不会改（顺序本来就是对的）。
     ========================================================================== */
  if (listWrap) {
    const pinned = Array.prototype.slice.call(listWrap.querySelectorAll(":scope > .post[data-pin]"));

    if (pinned.length > 1) {
      pinned.sort(function (a, b) {
        const va = parseFloat(a.getAttribute("data-pin")) || 0;
        const vb = parseFloat(b.getAttribute("data-pin")) || 0;
        return va - vb;
      });

      /* 先把它们从原来的位置摘下来，再整块插到列表最前面。
         用 DocumentFragment 是为了只动一次 DOM —— 一条一条插的话，
         浏览器要重排好几遍。 */
      const frag = document.createDocumentFragment();
      pinned.forEach(function (li) {
        frag.appendChild(li);
      });

      const first = listWrap.querySelector(".post-list");
      if (first) {
        first.insertBefore(frag, first.firstChild);
      } else {
        listWrap.insertBefore(frag, listWrap.firstChild);
      }
    }
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
