/* 解题工坊 · 题库门禁自检
   运行：node workshop/tools/ws-check.js

   与培优站 py-check.js 最大的不同：应用题没有「枚举搭法」可跑，
   但每道题都强制携带 check 字段 —— 一个 JS 验算算式，门禁把它重算一遍与 answer 比对，
   54 道题的最终答案全部由机器重算，不靠人眼核对。 */

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const sandbox = { window: {}, console, Math };
vm.createContext(sandbox);

function load(rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), "utf8");
  vm.runInContext(code, sandbox, { filename: rel });
}

let pass = 0;
const fails = [];
function ok(cond, msg) { if (cond) pass++; else fails.push(msg); }
function eq(actual, expect, msg) { ok(actual === expect, msg + " → 实际 " + JSON.stringify(actual) + "，期望 " + JSON.stringify(expect)); }
function section(t) { console.log("\n── " + t); }

try {
  load("js/ws-core.js");
  ["ws-data-u1.js", "ws-data-u2.js", "ws-data-u3.js"].forEach((f) => load("js/" + f));
} catch (e) {
  console.error("脚本加载失败：" + e.message);
  process.exit(1);
}

const BANK = sandbox.window.WS_BANK;
const UNITS = Object.keys(BANK).map(Number).sort((a, b) => a - b);
const Q_PER_UNIT = 18;
const LEVELS = [1, 2, 3];
const LV_NAME = { 1: "基础应用", 2: "综合应用", 3: "思维挑战" };

function need(u, id) {
  const list = (BANK[u] && BANK[u].questions) || [];
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  throw new Error("题库里找不到 " + id);
}

/* ---------------- 1. 结构检查 ---------------- */

section("结构检查");
eq(UNITS.join(","), "1,2,3", "知识点应为 1、2、3");

const allIds = new Set();
const byLevelCount = {};

UNITS.forEach((u) => {
  const b = BANK[u];
  eq(b.u, u, "知识点 " + u + " 的 u 字段应与键一致");
  ok(!!b.title && !!b.en && !!b.brief, "知识点 " + u + " 缺元信息");
  ok(/^#[0-9a-f]{6}$/i.test(b.accent || ""), "知识点 " + u + " 的 accent 应为十六进制色值");
  eq((b.levels || []).map((l) => l.lv).join(","), "1,2,3", "知识点 " + u + " 应有三档难度");
  ok((b.levels || []).every((l) => !!LV_NAME[l.lv] && !!l.name), "知识点 " + u + " 的难度名称非法");
  eq((b.questions || []).length, Q_PER_UNIT, "知识点 " + u + " 应有 " + Q_PER_UNIT + " 道题");

  byLevelCount[u] = {};
  b.questions.forEach((q, i) => {
    const tag = "知识点 " + u + " 第 " + (i + 1) + " 题(" + q.id + ")";
    eq(q.no, i + 1, tag + " 的 no 应与位置一致");
    ok(!allIds.has(q.id), tag + " 的 id 重复");
    allIds.add(q.id);
    byLevelCount[u][q.level] = (byLevelCount[u][q.level] || 0) + 1;

    ok(LEVELS.indexOf(q.level) >= 0, tag + " 的 level 非法");
    ok(!!q.tag, tag + " 缺 tag");
    ok(!!q.tag && q.tag.length >= 2, tag + " 缺 tag（场景标签，如「分段计费」）");
    ok(!!q.stem, tag + " 缺 stem");
    ok(!!q.answerLabel, tag + " 缺 answerLabel");
    ok(q.answer !== undefined && q.answer !== "", tag + " 缺 answer");
    ok(/^[\w.+\-*/() ]+$/.test(q.answer || "") && !isNaN(Number(q.answer)),
      tag + " answer 必须是可判分的数值，实际：" + q.answer);
    ok(!!q.final && q.final.length >= 10,
      tag + " final 过短（渲染器会补「答：」前缀，final 只存完整结论）");
    ok(!!q.point, tag + " 缺 point");
    ok(Array.isArray(q.hints) && q.hints.length >= 1 && q.hints.length <= 3, tag + " hints 应为 1~3 条");
    q.hints.forEach((h, k) => ok(!!h && h.length >= 8, tag + " 第 " + (k + 1) + " 条提示过短"));

    ok(Array.isArray(q.steps) && q.steps.length >= 2, tag + " 分步解答至少 2 步，实际 " +
      (q.steps ? q.steps.length : 0));
    (q.steps || []).forEach((st, k) => {
      ok(!!st.why && st.why.length >= 6, tag + " 第 " + (k + 1) + " 步缺 why 或过短");
      ok(!!st.formula && st.formula.length >= 3, tag + " 第 " + (k + 1) + " 步缺 formula");
    });

    if (q.scene) {
      ok(["grid", "group", "formula"].indexOf(q.scene.kind) >= 0, tag + " scene.kind 非法");
    }
  });

  LEVELS.forEach((lv) => {
    eq(byLevelCount[u][lv] || 0, 6, "知识点 " + u + " 的「" + LV_NAME[lv] + "」应有 6 题");
  });
});

/* ---------------- 2. check 全量重算 ---------------- */

section("check 验算（每题答案由机器重算）");

UNITS.forEach((u) => {
  BANK[u].questions.forEach((q) => {
    const tag = "知识点 " + u + " 第 " + q.no + " 题(" + q.id + ")";
    ok(!!q.check, tag + " 缺 check 验算算式");
    if (!q.check) return;

    let computed;
    try {
      computed = Function('"use strict";return (' + q.check + ")")();
    } catch (e) {
      ok(false, tag + " check 算式无法计算：" + q.check + "（" + e.message + "）");
      return;
    }
    ok(typeof computed === "number" && isFinite(computed),
      tag + " check 结果不是有限数字：" + q.check);
    if (typeof computed !== "number" || !isFinite(computed)) return;

    const expect = Number(q.answer);
    ok(isFinite(expect), tag + " answer 不是合法数字：" + q.answer);
    if (!isFinite(expect)) return;

    const diff = Math.abs(computed - expect);
    const tol = Math.max(1e-9, Math.abs(expect) * 1e-9);
    ok(diff <= tol,
      tag + " 重算不一致：check=" + q.check + " → " + computed + "，answer=" + expect);
  });
});

/* ---------------- 3. 抽样语义检查：方程题必须「代回原式」成立 ---------------- */

section("方程题抽验（解代回原方程）");
(function () {
  // 3-107：4x + 15.2 = 50
  const x1 = Number(need(3, "3-107").answer);
  ok(Math.abs(4 * x1 + 15.2 - 50) < 1e-9, "3-107 代回 4x + 15.2 = 50 不成立");
  // 3-112：3x − 6.9 = 11.1
  const x2 = Number(need(3, "3-112").answer);
  ok(Math.abs(3 * x2 - 6.9 - 11.1) < 1e-9, "3-112 代回 3x − 6.9 = 11.1 不成立");
  // 3-113：65x + 55x = 480
  const x3 = Number(need(3, "3-113").answer);
  ok(Math.abs(65 * x3 + 55 * x3 - 480) < 1e-9, "3-113 代回 65x + 55x = 480 不成立");
  // 3-115：15x + x = 72
  const x4 = Number(need(3, "3-115").answer);
  ok(Math.abs(16 * x4 - 72) < 1e-9, "3-115 代回 16x = 72 不成立");
  // 3-116：12.5x = 15x − 30
  const x5 = Number(need(3, "3-116").answer);
  ok(Math.abs(12.5 * x5 - (15 * x5 - 30)) < 1e-9, "3-116 两种分法的总数应相等");
  // 3-118：300 − 5x = 5x + 12
  const x6 = Number(need(3, "3-118").answer);
  ok(Math.abs((300 - 5 * x6) - (5 * x6 + 12)) < 1e-9, "3-118 「剩下的 = 花掉的 + 12」应成立");
})();

/* ---------------- 4. 站点一致性 ---------------- */

section("站点一致性");
["index.html", "unit.html"].forEach((page) => {
  const html = fs.readFileSync(path.join(ROOT, page), "utf8");
  const refs = [];
  const re = /(?:src|href)="((?:js|css)\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html))) refs.push(m[1]);
  ok(refs.length > 0, page + " 没有找到任何 js/css 引用");
  refs.forEach((ref) => {
    const [file, query] = ref.split("?");
    ok(fs.existsSync(path.join(ROOT, file)), page + " 引用了不存在的文件：" + file);
    ok(/^v=1$/.test(query || ""), page + " 的 " + file + " 版本号应为 v=1，实际 " + query);
  });
  ok(html.indexOf("py-data") < 0 && html.indexOf("ws-data-u4") < 0 && html.indexOf("ws-data-u5") < 0,
    page + " 不应引用不存在的题库文件");
});

/* ---------------- 汇总 ---------------- */

console.log("\n" + "=".repeat(48));
if (fails.length === 0) {
  console.log("✅ 全部通过：" + pass + " 项断言");
} else {
  console.log("❌ 通过 " + pass + " 项，失败 " + fails.length + " 项：\n");
  fails.forEach((f, i) => console.log("  " + (i + 1) + ". " + f));
  process.exitCode = 1;
}
