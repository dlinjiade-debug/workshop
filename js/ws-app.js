/* 解题工坊 · 页面交互层
   题库数据结构约定（ws-data-uN.js）：
   { u, title, en, accent, brief, levels:[{lv,name}], skills:[],
     questions: [{ id, no, level, tag, stem, scene?, answerLabel, answer, unit?,
                   hints:[...], steps:[{why, formula, note?}], final, check, point }] } */

(function () {
  "use strict";

  var LV_NAME = { 1: "基础应用", 2: "综合应用", 3: "思维挑战" };
  var ICONS = {
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.6 2.5L16 9.5"/>',
    cross: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    steps: '<path d="M4 6h16M4 12h10M4 18h6"/><path d="m16.5 16 2.5 2.5 4-4.5" transform="translate(-2,0)"/>'
  };

  var state = { u: 0, d: 1, bank: null, qs: [], idx: 0, progress: {}, showHints: false, showSteps: false };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function unitList() { return Object.keys(window.WS_BANK || {}).map(Number).sort(function (a, b) { return a - b; }); }
  function icon(name) { return '<span class="w-icon" aria-hidden="true"><svg viewBox="0 0 24 24">' + (ICONS[name] || "") + "</svg></span>"; }

  /* ---------------- 场景渲染 ---------------- */

  function figureSVG(spec, label) {
    if (!spec) return "";
    if (Array.isArray(spec)) spec = { rows: spec };
    var cell = spec.cell || 24;
    var pad = 10;
    var rows = spec.rows || [];
    var h = rows.length, w = 0, i, r, c;
    rows.forEach(function (rw) { if (rw.length > w) w = rw.length; });
    if (spec.cols && spec.cols > w) w = spec.cols;
    if (!w) return "";

    var W = w * cell + pad * 2, H = h * cell + pad * 2;
    var parts = [];
    for (i = 0; i <= w; i++) parts.push('<line x1="' + (pad + i * cell) + '" y1="' + pad + '" x2="' + (pad + i * cell) + '" y2="' + (pad + h * cell) + '" stroke="rgba(43,76,140,.18)" stroke-width="1"/>');
    for (i = 0; i <= h; i++) parts.push('<line x1="' + pad + '" y1="' + (pad + i * cell) + '" x2="' + (pad + w * cell) + '" y2="' + (pad + i * cell) + '" stroke="rgba(43,76,140,.18)" stroke-width="1"/>');
    for (r = 0; r < h; r++) {
      for (c = 0; c < rows[r].length; c++) {
        if (rows[r].charAt(c) !== "1") continue;
        parts.push('<rect x="' + (pad + c * cell + 1.5) + '" y="' + (pad + r * cell + 1.5) + '" width="' + (cell - 3) + '" height="' + (cell - 3) + '" rx="2.5" fill="#dde7f6" stroke="#3a5a96" stroke-width="1.5"/>');
      }
    }
    if (spec.axisV !== undefined && spec.axisV !== null) {
      var ax = pad + spec.axisV * cell;
      parts.push('<line x1="' + ax + '" y1="' + (pad - 5) + '" x2="' + ax + '" y2="' + (pad + h * cell + 5) + '" stroke="#c94b44" stroke-width="1.8" stroke-dasharray="6 4" stroke-linecap="round"/>');
    }
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + (label || "示意图") + '">' + parts.join("") + "</svg>";
  }

  function sceneHTML(scene) {
    if (!scene) return "";
    if (scene.kind === "grid") {
      return '<div class="w-scene">' + figureSVG(scene, scene.caption || "示意图") +
        (scene.caption ? '<p class="w-scene-cap">' + scene.caption + "</p>" : "") + "</div>";
    }
    if (scene.kind === "group") {
      var figs = (scene.items || []).map(function (it) {
        return "<figure>" + figureSVG(it, it.caption || "示意图") + (it.caption ? "<figcaption>" + it.caption + "</figcaption>" : "") + "</figure>";
      }).join("");
      return '<div class="w-scene"><div class="w-scene-row">' + figs + "</div>" +
        (scene.caption ? '<p class="w-scene-cap">' + scene.caption + "</p>" : "") + "</div>";
    }
    if (scene.kind === "formula") {
      return '<div class="w-formula">' + (scene.lines || []).map(function (l) { return "<div>" + l + "</div>"; }).join("") + "</div>";
    }
    return "";
  }

  /* ---------------- 首页 ---------------- */

  function initHome() {
    var grid = $("#unitGrid");
    grid.innerHTML = unitList().map(function (u) {
      var b = window.WS_BANK[u];
      var p = WS.loadProgress(u);
      var s = WS.stats(b.questions, p);

      var levelRows = b.levels.map(function (lv) {
        var st = s.byLevel[lv.lv] || { done: 0, total: 0, right: 0 };
        var pct = st.total ? Math.round(st.done / st.total * 100) : 0;
        var tail = st.done ? "已做 " + st.done + "/" + st.total : "共 " + st.total + " 题";
        return '<div class="w-level-row"><small>' + lv.name + '</small>' +
          '<div class="w-meter"><i style="width:' + pct + '%"></i></div>' +
          '<u class="' + (st.done === st.total && st.total ? "is-done" : "") + '">' + tail + "</u></div>";
      }).join("");

      return '<a class="w-unit-card" href="unit.html?u=' + u + '&d=1&q=1" style="--card-accent:' + b.accent + '">' +
        '<div class="w-unit-head"><span class="w-unit-no">' + "一二三".charAt(u - 1) + "</span><small>" + b.en + "</small></div>" +
        "<h3>" + b.title + "</h3><p>" + b.brief + "</p>" +
        '<div class="w-levels">' + levelRows + "</div>" +
        '<div class="w-unit-foot"><span>共 ' + s.total + " 题 · 做对 " + s.right + '</span><span class="w-unit-go">开始练习 →</span></div>' +
        "</a>";
    }).join("");
  }

  /* ---------------- 练习页 ---------------- */

  function intParam(raw, fallback) {
    if (raw === null || raw === "") return fallback;
    var n = Number(raw);
    if (!isFinite(n)) return fallback;
    return Math.floor(n);
  }

  function initUnit() {
    var params = new URLSearchParams(location.search);
    var order = unitList();
    var u = intParam(params.get("u"), order[0]);
    if (!window.WS_BANK[u]) {
      $("#stage").innerHTML = '<p class="w-empty">没有找到这个知识点。</p>';
      return;
    }

    state.u = u;
    state.bank = window.WS_BANK[u];
    state.d = intParam(params.get("d"), 1);
    if ([1, 2, 3].indexOf(state.d) < 0 || !state.bank.levels.some(function (l) { return l.lv === state.d; })) state.d = 1;
    state.qs = state.bank.questions.filter(function (q) { return q.level === state.d; });
    if (!state.qs.length) state.qs = state.bank.questions;
    state.progress = WS.loadProgress(u);
    // q 是全局题号 no：先在当前难度里按 no 精确定位，找不到再按序号夹取
    var qn = intParam(params.get("q"), 1);
    var pos = -1;
    for (var i = 0; i < state.qs.length; i++) {
      if (state.qs[i].no === qn) { pos = i; break; }
    }
    state.idx = pos >= 0 ? pos : Math.min(Math.max(qn, 1), state.qs.length) - 1;

    document.title = state.bank.title + " · " + LV_NAME[state.d] + " · 解题工坊";
    $("#unitTitle").textContent = state.bank.title;
    $("#unitMeta").textContent = state.bank.en + " · 共 " + state.bank.questions.length + " 道应用题";
    $("#unitBrief").textContent = state.bank.brief;

    renderRail();
    renderStage();
    document.addEventListener("click", onClick);
    document.addEventListener("input", onInput);
  }

  function renderRail() {
    $("#railUnits").innerHTML = unitList().map(function (n) {
      var b = window.WS_BANK[n];
      return '<a href="unit.html?u=' + n + '&d=' + state.d + '&q=1" class="' + (n === state.u ? "is-current" : "") + '">' +
        "<em>" + "一二三".charAt(n - 1) + "</em><span>" + b.title + "</span></a>";
    }).join("");

    $("#railDiff").innerHTML = state.bank.levels.map(function (lv) {
      return '<a href="unit.html?u=' + state.u + "&d=" + lv.lv + '&q=1" class="is-lv' + lv.lv + (lv.lv === state.d ? " is-on" : "") + '">' + lv.name + "</a>";
    }).join("");

    var s = WS.stats(state.qs, state.progress);
    $("#railCount").textContent = "已做 " + s.done + " / " + s.total + " 题 · 做对 " + s.right;
    $("#railMeter").style.width = (s.total ? Math.round(s.done / s.total * 100) : 0) + "%";

    $("#qnav").innerHTML = state.qs.map(function (q, i) {
      var rec = state.progress[q.id];
      var cls = "", mark = "";
      if (rec && rec.graded) {
        cls = rec.ok ? "is-right" : "is-wrong";
        mark = "<i>" + (rec.ok ? "✓" : "✕") + "</i>";
      }
      if (i === state.idx) cls += " is-current";
      return '<button type="button" data-act="go" data-i="' + i + '" class="' + cls.trim() + '">' + q.no + mark + "</button>";
    }).join("");
  }

  function curQ() { return state.qs[state.idx]; }
  function recOf(q) { return state.progress[q.id] || (state.progress[q.id] = {}); }

  function renderStage() {
    var q = curQ();
    var rec = state.progress[q.id] || {};
    var graded = !!rec.graded;

    var hintBlock = "";
    if (state.showHints && q.hints && q.hints.length) {
      hintBlock = '<div class="w-hints">' + q.hints.map(function (h, i) {
        return '<div class="w-hint"><b>提示 ' + (i + 1) + "：</b>" + h + "</div>";
      }).join("") + "</div>";
    }

    var verdict = "";
    if (graded) {
      var okAns = rec.ok;
      verdict = '<div class="w-verdict ' + (okAns ? "is-right" : "is-wrong") + '">' + icon(okAns ? "check" : "cross") +
        "<div><b>" + (okAns ? "答案正确。" : "答案不对。") + "</b>" +
        (okAns ? "你的结果和标准答案一致。分步解答再过一遍，确认每一步都说得出理由。"
               : "别急着看解答 —— 先对照题目把数量关系再理一遍，然后再展开下面的分步解答，看看自己卡在哪一步。") +
        "</div></div>";
    }

    var stepsBox = "";
    if (state.showSteps) {
      stepsBox = '<div class="w-steps-box">' +
        '<div class="w-steps-head"><h5>' + icon("steps") + "分步解答</h5>" +
        '<button type="button" class="w-btn is-ghost" data-act="hide-steps">收起</button></div>' +
        '<div class="w-steps">' + q.steps.map(function (st, i) {
          return '<div class="w-step"><span class="w-step-no">' + (i + 1) + '</span><div class="w-step-body">' +
            '<div class="w-step-why">' + st.why + "</div>" +
            '<div class="w-step-formula">' + st.formula + "</div>" +
            (st.note ? '<div class="w-step-note">' + st.note + "</div>" : "") +
            "</div></div>";
        }).join("") +
        '<div class="w-final"><b>答：</b>' + q.final + "</div></div>" +
        '<div class="w-point">' + q.point + "</div></div>";
    }

    var answerBlock =
      '<div class="w-answer">' +
      '<div class="w-answer-label">' + q.answerLabel + "（先自己在纸上写出完整过程，再把最终结果填进来核对）</div>" +
      '<div class="w-answer-row">' +
      '<input type="text" id="ansInput" inputmode="decimal" autocomplete="off" value="' +
      WS.esc(rec.ans === undefined || rec.ans === null ? "" : rec.ans) + '" class="' +
      (graded ? (rec.ok ? "is-right" : "is-wrong") : "") + '"' + (graded ? " disabled" : "") + ">" +
      (q.unit ? '<span class="w-answer-unit">' + q.unit + "</span>" : "") +
      (graded
        ? '<button type="button" class="w-btn" data-act="retry">重新作答</button>'
        : '<button type="button" class="w-btn is-primary" data-act="submit">核对答案</button>') +
      "</div>" +
      '<div class="w-answer-row" style="margin-top:12px">' +
      '<button type="button" class="w-btn" data-act="steps"' + (graded ? "" : " disabled") + ">" +
      (state.showSteps ? "收起分步解答" : "查看分步解答") + "</button>" +
      (graded ? "" : '<span style="font-size:13px;color:var(--w-muted)">核对答案后解锁 —— 不可以跳过自己的思考直接看过程。</span>') +
      "</div></div>";

    $("#stage").innerHTML =
      '<article class="w-qcard">' +
      '<div class="w-qmeta"><span class="w-qno">第 ' + q.no + " 题</span>" +
      '<span class="w-chip lv' + q.level + '">' + LV_NAME[q.level] + "</span>" +
      '<span class="w-tag tag-skill">' + q.tag + "</span></div>" +
      '<div class="w-stem">' + q.stem + "</div>" +
      sceneHTML(q.scene) +
      '<div class="w-hints-toggle" style="margin-top:16px">' +
      (q.hints && q.hints.length
        ? '<button type="button" class="w-btn is-ghost" data-act="hints">' + (state.showHints ? "收起思路提示" : "看思路提示") + "</button>"
        : "") +
      "</div>" + hintBlock +
      answerBlock + verdict + stepsBox +
      "</article>";

    updateNavbar();
    if (!graded) { var inp = $("#ansInput"); if (inp) inp.focus({ preventScroll: true }); }
  }

  function updateNavbar() {
    var total = state.qs.length;
    $("#posLabel").textContent = "第 " + (state.idx + 1) + " / " + total + " 题（" + LV_NAME[state.d] + "）";
    $("#btnPrev").disabled = state.idx === 0;
    $("#btnNext").disabled = state.idx === total - 1;
  }

  /* ---------------- 交互 ---------------- */

  function persist() { WS.saveProgress(state.u, state.progress); renderRail(); }

  function syncUrl() {
    try { history.replaceState(null, "", "unit.html?u=" + state.u + "&d=" + state.d + "&q=" + (state.idx + 1)); } catch (e) { /* file:// 忽略 */ }
  }

  function goto() { renderRail(); renderStage(); syncUrl(); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function onClick(ev) {
    var el = ev.target.closest("[data-act]");
    if (el) { handleAction(el.getAttribute("data-act"), el); return; }
  }

  function onInput(ev) {
    if (ev.target.id !== "ansInput") return;
    var q = curQ();
    var rec = recOf(q);
    if (rec.graded) return;
    rec.ans = ev.target.value;
    rec.graded = false;
    WS.saveProgress(state.u, state.progress);
  }

  function handleAction(act, el) {
    var q = curQ();

    if (act === "go") { state.idx = Number(el.dataset.i); state.showHints = false; state.showSteps = false; goto(); return; }
    if (act === "prev") { state.idx = Math.max(0, state.idx - 1); state.showHints = false; state.showSteps = false; goto(); return; }
    if (act === "next") { state.idx = Math.min(state.qs.length - 1, state.idx + 1); state.showHints = false; state.showSteps = false; goto(); return; }

    if (act === "hints") { state.showHints = !state.showHints; if (state.showHints) { var r0 = recOf(q); r0.seenHints = true; persist(); } renderStage(); return; }

    if (act === "submit") {
      var rec = recOf(q);
      var val = $("#ansInput") ? $("#ansInput").value : rec.ans;
      if (!String(val || "").trim()) return;
      rec.ans = val;
      rec.ok = WS.checkAnswer(q.answer, val);
      rec.graded = true;
      persist();
      renderStage();
      return;
    }

    if (act === "retry") {
      var r = recOf(q);
      r.graded = false;
      persist();
      renderStage();
      return;
    }

    if (act === "steps") {
      state.showSteps = !state.showSteps;
      if (state.showSteps) { recOf(q).seenSteps = true; persist(); }
      renderStage();
      return;
    }

    if (act === "hide-steps") { state.showSteps = false; renderStage(); return; }

    if (act === "clear") {
      if (!window.confirm("确定清空" + state.bank.title + "「" + LV_NAME[state.d] + "」的全部作答记录吗？")) return;
      state.qs.forEach(function (qq) { delete state.progress[qq.id]; });
      WS.saveProgress(state.u, state.progress);
      state.showHints = false; state.showSteps = false;
      goto();
      return;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.WS_BANK || !window.WS) {
      document.body.innerHTML = '<p class="w-empty">题库没有加载成功，请刷新页面。</p>';
      return;
    }
    if (document.body.dataset.page === "home") initHome();
    else initUnit();
  });
})();
