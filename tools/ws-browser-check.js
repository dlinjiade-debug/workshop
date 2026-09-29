/* 解题工坊 · 真机验收（无头 Edge）
   运行：node workshop/tools/ws-browser-check.js
   前置：本地静态服务器已在本机 4270 端口运行

   逐题验证 + 「解题工坊」特有的核心链路：
   未提交答案时分步解答必须锁定 → 核对后解锁 → 点开能看到分步和「答：」行。
   绝不 taskkill msedge —— 用户可能正开着浏览器。 */

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const BASE = process.env.WS_BASE || "http://127.0.0.1:4270";
const TMP = path.join(ROOT, "tmp");
const PROFILE = path.join(TMP, "prof-ws-check");
const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
].find((p) => fs.existsSync(p));

if (!EDGE) { console.error("找不到 Edge，无法运行真机验收。"); process.exit(1); }

let pass = 0;
const fails = [];
function ok(cond, msg) { if (cond) pass++; else fails.push(msg); }
function eq(a, b, m) { ok(a === b, m + " → 实际 " + a + "，期望 " + b); }
function section(t) { console.log("\n── " + t); }

const sandbox = { window: {}, console };
vm.createContext(sandbox);
["js/ws-core.js", "js/ws-data-u1.js", "js/ws-data-u2.js", "js/ws-data-u3.js"]
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), sandbox, { filename: f }));
const BANK = sandbox.window.WS_BANK;
const UNITS = Object.keys(BANK).map(Number).sort((a, b) => a - b);
const LV_NAME = { 1: "基础应用", 2: "综合应用", 3: "思维挑战" };

function dumpDom(url) {
  return execFileSync(EDGE, [
    "--headless=new", "--disable-gpu", "--no-sandbox",
    "--no-first-run", "--no-default-browser-check",
    "--user-data-dir=" + PROFILE,
    "--virtual-time-budget=4000",
    "--dump-dom", BASE + url
  ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
}
function titleOf(html) { const m = html.match(/<title>([\s\S]*?)<\/title>/); return m ? m[1].trim() : ""; }
function flatten(s) {
  return String(s).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/gi, " ").replace(/\s+/g, "");
}
function countAll(html, re) { return (html.match(re) || []).length; }

/* iframe 探针：模拟「填答案 → 核对 → 解锁 → 展开分步」完整链路 */
const probeHTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>probe</title></head>
<body>
<iframe id="f" style="width:1280px;height:1200px;border:0"></iframe>
<script>
var p = new URLSearchParams(location.search);
var frame = document.getElementById("f");
frame.onload = function () {
  // 带 clear=1 时先清空 localStorage 并重载 iframe，保证每次探针都从干净状态开始
  if (p.get("clear") && !frame.dataset.cleared) {
    try { frame.contentWindow.localStorage.clear(); } catch (e) {}
    frame.dataset.cleared = "1";
    frame.src = frame.src;
    return;
  }
  var log = [];
  try {
    var d = frame.contentDocument;
    var stepsBtn = d.querySelector('[data-act="steps"]');
    log.push("locked=" + (stepsBtn && stepsBtn.disabled ? "yes" : (stepsBtn ? "no" : "?")));
    var input = d.querySelector("#ansInput");
    if (input) {
      input.value = p.get("answer") || "0";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    var btn = d.querySelector('[data-act="submit"]');
    if (btn) btn.click();
    setTimeout(function () {
      var d2 = frame.contentDocument;
      log.push("verdict=" + (d2.querySelector(".w-verdict") ? "yes" : "no"));
      log.push("isRight=" + (d2.querySelector(".w-verdict.is-right") ? "yes" : "no"));
      var stepsBtn2 = d2.querySelector('[data-act="steps"]');
      log.push("unlocked=" + (stepsBtn2 && !stepsBtn2.disabled ? "yes" : "no"));
      if (stepsBtn2 && !stepsBtn2.disabled) stepsBtn2.click();
      setTimeout(function () {
        var d3 = frame.contentDocument;
        log.push("stepsBox=" + (d3.querySelector(".w-steps-box") ? "yes" : "no"));
        log.push("steps=" + d3.querySelectorAll(".w-step").length);
        log.push("final=" + (d3.querySelector(".w-final") ? "yes" : "no"));
        log.push("point=" + (d3.querySelector(".w-point") ? "yes" : "no"));
        var rc = d3.querySelector("#railCount");
        log.push("rail=" + (rc ? rc.textContent.replace(/\\s+/g, "") : "?"));
        document.title = "PROBE " + log.join("|");
      }, 400);
    }, 400);
  } catch (e) {
    document.title = "PROBE ERR:" + e.message;
  }
};
frame.src = "/unit.html?u=" + (p.get("u") || "1") + "&d=" + (p.get("d") || "1") + "&q=" + (p.get("q") || "1");
</script>
</body></html>`;

console.log("解题工坊 · 真机验收");
console.log("服务器：" + BASE + "\n");

fs.mkdirSync(TMP, { recursive: true });
fs.writeFileSync(path.join(TMP, "probe.html"), probeHTML, "utf8");

/* 1. 首页 */
section("首页");
(function () {
  const html = dumpDom("/index.html");
  ok(html.indexOf("解题工坊") >= 0, "首页缺少站名");
  UNITS.forEach((u) => ok(html.indexOf(BANK[u].title) >= 0, "首页缺少知识点卡：" + BANK[u].title));
  eq(countAll(html, /class="w-unit-card"/g), UNITS.length, "首页知识点卡数量");
  eq(countAll(html, /class="w-level-row"/g), UNITS.length * 3, "首页难度行数量（每单元 3 档）");
  ok(html.indexOf("题库没有加载成功") < 0, "首页出现加载失败降级文案");
})();

/* 2. 逐题渲染：54 题，3 单元 × 3 档 × 6 题 */
section("逐题渲染（54 题）");
UNITS.forEach((u) => {
  const b = BANK[u];
  const lvNames = {};
  b.levels.forEach((l) => { lvNames[l.lv] = l.name; });

  b.questions.forEach((q) => {
    const tag = "知识点 " + u + " 第 " + q.no + " 题(" + q.id + ")";
    const html = dumpDom("/unit.html?u=" + u + "&d=" + q.level + "&q=" + q.no);

    ok(html.indexOf(">第 " + q.no + " 题<") >= 0, tag + " 题号没渲染出来");
    ok(html.indexOf(lvNames[q.level]) >= 0, tag + " 难度标签缺失");
    ok(html.indexOf(q.tag) >= 0, tag + " 场景标签缺失");
    ok(html.indexOf('class="w-qcard"') >= 0, tag + " 题卡没渲染");
    ok(html.indexOf("题库没有加载成功") < 0, tag + " 触发降级文案");

    const snippet = flatten(q.stem).slice(0, 10);
    ok(flatten(html).indexOf(snippet) >= 0, tag + " 题干指纹对不上：「" + snippet + "」");

    eq(countAll(html, /id="ansInput"/g), 1, tag + " 答案输入框应恰好 1 个");
    ok(html.indexOf('data-act="submit"') >= 0, tag + " 找不到核对按钮");
    ok(html.indexOf('data-act="steps"') >= 0, tag + " 找不到分步解答按钮");

    if (q.scene && q.scene.kind === "formula") {
      ok(html.indexOf('class="w-formula"') >= 0, tag + " 应渲染算式块");
    }
    if (q.scene && (q.scene.kind === "grid" || q.scene.kind === "group")) {
      ok(countAll(html, /<svg/g) >= 2, tag + " 需要图形但没有 svg");
    }
  });
});

/* 3. 异常参数兜底 */
section("异常参数兜底");
(function () {
  ok(dumpDom("/unit.html").indexOf(">第 1 题<") >= 0, "无参数应默认到第一个知识点第一题");
  ok(dumpDom("/unit.html?u=99").indexOf("没有找到这个知识点") >= 0, "u=99 应给出友好提示");
  ok(dumpDom("/unit.html?u=abc").indexOf(">第 1 题<") >= 0, "u=abc 应回退到第一单元");
  ok(dumpDom("/unit.html?u=1&q=1.5").indexOf(">第 1 题<") >= 0, "q=1.5 应向下取整");
  const d9 = dumpDom("/unit.html?u=1&d=9");
  ok(d9.indexOf(">第 1 题<") >= 0, "d=9 应回退到第一档");
})();

/* 4. 核心链路：锁定 → 核对 → 解锁 → 分步 */
section("作答与解锁链路");
(function () {
  // 第一单元第 1 题（正确答案 35.1）
  const good = titleOf(dumpDom("/tmp/probe.html?u=1&q=1&answer=35.1&clear=1"));
  ok(good.indexOf("locked=yes") >= 0, "未提交时分步解答应是锁定的：" + good);
  ok(good.indexOf("verdict=yes") >= 0, "提交后没有判分反馈：" + good);
  ok(good.indexOf("isRight=yes") >= 0, "填入正确答案应判为答对：" + good);
  ok(good.indexOf("unlocked=yes") >= 0, "核对后分步解答应解锁：" + good);
  ok(good.indexOf("stepsBox=yes") >= 0, "分步解答没有渲染出来：" + good);
  ok(/steps=[3-9]/.test(good), "分步解答步数异常：" + good);
  ok(good.indexOf("final=yes") >= 0, "缺少「答：」行：" + good);
  ok(good.indexOf("point=yes") >= 0, "缺少考点：" + good);
  ok(good.indexOf("rail=已做1/6题") >= 0, "侧栏进度没有更新：" + good);

  const bad = titleOf(dumpDom("/tmp/probe.html?u=1&q=1&answer=1&clear=1"));
  ok(bad.indexOf("verdict=yes") >= 0 && bad.indexOf("isRight=no") >= 0, "填错答案应判为答错：" + bad);
  ok(bad.indexOf("unlocked=yes") >= 0, "答错后也应能查看分步解答（学习场景）：" + bad);

  // 第三单元第 12 题（level 2，方程检验，正确答案 6）
  const eq = titleOf(dumpDom("/tmp/probe.html?u=3&d=2&q=12&answer=6&clear=1"));
  ok(eq.indexOf("locked=yes") >= 0, "方程题初始时分步应锁定：" + eq);
  ok(eq.indexOf("isRight=yes") >= 0 && eq.indexOf("stepsBox=yes") >= 0, "方程题链路异常：" + eq);
})();

try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { /* 忽略 */ }

console.log("\n" + "=".repeat(48));
if (fails.length === 0) {
  console.log("✅ 真机验收通过：" + pass + " 项断言");
} else {
  console.log("❌ 通过 " + pass + " 项，失败 " + fails.length + " 项：\n");
  fails.forEach((f, i) => console.log("  " + (i + 1) + ". " + f));
  process.exitCode = 1;
}
