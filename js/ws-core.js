/* 解题工坊 · 判分与进度核心（纯函数，可在 Node 下直接单测） */

(function (root) {
  "use strict";

  var PREFIX = "ws-progress-v1-u";

  function normalize(input) {
    if (input === null || input === undefined) return "";
    var s = String(input);
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c === 12288) { out += " "; continue; }
      if (c >= 65281 && c <= 65374) { out += String.fromCharCode(c - 65248); continue; }
      out += s.charAt(i);
    }
    out = out.replace(/[\s\u3000]+/g, "");
    out = out.replace(/[，、]/g, ",");
    return out;
  }

  function canon(text) {
    var s = normalize(text);
    if (!s) return "";
    var plain = s.replace(/^\+/, "");
    if (/^-?\d+(\.\d+)?$/.test(plain)) {
      var n = Number(plain);
      if (isFinite(n)) return String(n);
    }
    return s;
  }

  function checkAnswer(expect, got) {
    if (got === null || got === undefined) return false;
    var b = canon(got);
    if (!b) return false;
    return canon(expect) === b;
  }

  function store() {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage;
    } catch (e) { return null; }
  }

  function loadProgress(unit) {
    var ls = store();
    if (!ls) return {};
    try {
      var raw = ls.getItem(PREFIX + unit);
      var obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) { return {}; }
  }

  function saveProgress(unit, data) {
    var ls = store();
    if (!ls) return false;
    try {
      ls.setItem(PREFIX + unit, JSON.stringify(data || {}));
      return true;
    } catch (e) { return false; }
  }

  function clearProgress(unit) {
    var ls = store();
    if (!ls) return;
    try { ls.removeItem(PREFIX + unit); } catch (e) { /* ignore */ }
  }

  /** 汇总：总/已做/做对，按难度分档。answered = 提交过答案的题 */
  function stats(questions, progress) {
    var total = questions.length;
    var done = 0, right = 0;
    var byLevel = {};
    var rows = [];

    questions.forEach(function (q) {
      var rec = progress[q.id];
      var lv = q.level || 1;
      if (!byLevel[lv]) byLevel[lv] = { total: 0, done: 0, right: 0, seen: 0 };
      byLevel[lv].total++;

      var state = "todo";
      if (rec && rec.graded) {
        done++;
        byLevel[lv].done++;
        if (rec.ok) { right++; byLevel[lv].right++; state = "right"; }
        else state = "wrong";
      }
      if (rec && rec.seenSteps) { byLevel[lv].seen++; state = "seen"; }
      rows.push({ id: q.id, no: q.no, level: lv, tag: q.tag, state: state });
    });

    return { total: total, done: done, right: right, rate: done ? Math.round(right / done * 100) : 0, byLevel: byLevel, rows: rows };
  }

  function esc(text) {
    return String(text === null || text === undefined ? "" : text)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  var API = {
    normalize: normalize,
    canon: canon,
    checkAnswer: checkAnswer,
    loadProgress: loadProgress,
    saveProgress: saveProgress,
    clearProgress: clearProgress,
    stats: stats,
    esc: esc,
    PREFIX: PREFIX
  };

  root.WS = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
