const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("legacy provider keys are removed unread and generation uses transient keys", async () => {
  const html = fs.readFileSync(require("node:path").join(__dirname, "../shorts-factory/index.html"), "utf8");
  const script = html.slice(html.indexOf("/* ================= Claude API mode"), html.indexOf("/* ================= schedule"));
  assert.ok(script.startsWith("/* ================= Claude API mode"));
  const values = new Map([["sf_api_key", "synthetic-legacy-a"], ["sf_yt_key", "synthetic-legacy-y"]]);
  const removed = [];
  const secretKeys = new Set(["sf_api_key", "sf_yt_key"]);
  const localStorage = {
    getItem(key) { if (secretKeys.has(key)) throw new Error("legacy key read"); return values.get(key); },
    setItem(key, value) { if (secretKeys.has(key)) throw new Error("key persisted"); values.set(key, value); },
    removeItem(key) { removed.push(key); values.delete(key); },
  };
  const elements = {};
  const $ = (id) => elements[id] ??= {
    value: "", textContent: "",
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(_event, callback) { this.click = callback; },
  };
  let anthropicCalls = 0;
  let youtubeCalls = 0;
  const fetch = async (url, options) => {
    if (url.includes("googleapis")) {
      youtubeCalls++;
      assert.ok(url.includes("synthetic-y"));
      return { ok: true, json: async () => ({ items: [] }) };
    }
    anthropicCalls++;
    assert.equal(options.headers["x-api-key"], "synthetic-a");
    return { ok: true, json: async () => ({
      content: [{ text: JSON.stringify(Object.fromEntries(["a", "b", "c"].map(k => [k, { title: k, lines: [] }]))) }],
    }) };
  };
  const context = {
    localStorage, $, document: { querySelectorAll: () => [] }, fetch,
    setInterval() {}, statusEl: { textContent: "" },
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  assert.ok(removed.includes("sf_api_key") && removed.includes("sf_yt_key"));
  assert.equal(values.has("sf_api_key") || values.has("sf_yt_key"), false);
  $("api-key-input").value = "synthetic-a";
  $("yt-key-input").value = "synthetic-y";
  $("api-key-save").click();
  await vm.runInContext("fetchRealBuzz()", context);
  const output = await vm.runInContext("generateViaAPI({url:'https://example.test',name:'item',duration:55})", context);
  assert.deepEqual(Object.keys(output), ["a", "b", "c"]);
  assert.equal(anthropicCalls, 1);
  assert.ok(youtubeCalls >= 1);
  assert.equal(values.has("sf_api_key") || values.has("sf_yt_key"), false);
});
