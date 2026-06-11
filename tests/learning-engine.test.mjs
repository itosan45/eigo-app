import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const source = html.match(/<script id="learning-engine">([\s\S]*?)<\/script>/)?.[1] || "";
const context = {};
vm.createContext(context);
vm.runInContext(`${source};globalThis.api={createQuestionState,tickQuestionState,answerQuestionState,advanceQuestionState,nextWeakLevel,isUnitCleared}`, context);
const api = context.api;

test("question starts hidden with thirty seconds", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(api.createQuestionState("q1"))), { questionId: "q1", remainingSeconds: 30, hintVisible: false, answered: false, usedHint: false });
});

test("zero reveals hint but not answer", () => {
  let state = api.createQuestionState("q1");
  for (let i = 0; i < 30; i++) state = api.tickQuestionState(state);
  assert.equal(state.hintVisible, true);
  assert.equal(state.answered, false);
});

test("answer locks and next question resets", () => {
  const answered = api.answerQuestionState(api.createQuestionState("q1"), false);
  assert.equal(answered.answered, true);
  assert.deepEqual(api.answerQuestionState(answered, true), answered);
  assert.deepEqual(api.advanceQuestionState("q2"), api.createQuestionState("q2"));
});

test("weak level and unit clear rules", () => {
  assert.equal(api.nextWeakLevel(1, false, false), 2);
  assert.equal(api.nextWeakLevel(2, true, false), 1);
  assert.equal(api.nextWeakLevel(2, true, true), 2);
  assert.equal(api.isUnitCleared(7, 10), true);
  assert.equal(api.isUnitCleared(6, 10), false);
});
