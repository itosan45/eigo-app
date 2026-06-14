import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const engineSource = html.match(/<script id="learning-engine">([\s\S]*?)<\/script>/)?.[1] || "";
const appScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];
const dataSource = appScript.slice(appScript.indexOf("const SUBJECTS="), appScript.indexOf("const STORE="));
const context = {};
vm.createContext(context);
vm.runInContext(
  `${engineSource}
   ${dataSource}
   globalThis.scopeApi={
     TOPICS,
     QUESTIONS,
     defaultLearnedTopicIds,
     isQuestionAvailable,
     filterAvailableQuestions,
     skipUnlearnedTopic,
     fillDeckToCount
   }`,
  context
);
const api = context.scopeApi;
const topics = JSON.parse(JSON.stringify(api.TOPICS));
const questions = JSON.parse(JSON.stringify(api.QUESTIONS));

test("grade 1 and 2 topics are learned by default while grade 3 topics are selectable", () => {
  const learned = JSON.parse(JSON.stringify(api.defaultLearnedTopicIds(api.TOPICS)));
  assert.deepEqual(learned, topics.filter(topic => topic.grade < 3).map(topic => topic.id));
  for (const id of ["english-present-perfect", "english-participles", "english-relative-pronouns", "english-indirect-questions"]) {
    assert.equal(topics.find(topic => topic.id === id)?.grade, 3);
    assert.equal(learned.includes(id), false);
  }
});

test("all generated questions carry complete curriculum metadata", () => {
  assert.equal(questions.length, 152);
  assert.ok(questions.every(question =>
    Number.isInteger(question.grade)
    && question.topicId
    && question.topicName
    && Array.isArray(question.prerequisites)
    && ["基礎", "標準", "入試"].includes(question.difficulty)
  ));
  assert.ok(questions.every(question => topics.some(topic => topic.id === question.topicId)));
});

test("unlearned grammar excludes listening reading writing and grammar questions using that topic", () => {
  for (const topicId of ["english-present-perfect", "english-participles", "english-relative-pronouns", "english-indirect-questions"]) {
    const related = questions.filter(question => question.topicId === topicId);
    assert.ok(related.length > 0, `${topicId} should have questions`);
    assert.ok(new Set(related.map(question => question.subjectId)).size >= 2, `${topicId} should span multiple skills`);
    const learned = topics.map(topic => topic.id).filter(id => id !== topicId);
    const available = JSON.parse(JSON.stringify(api.filterAvailableQuestions(api.QUESTIONS, learned)));
    assert.equal(available.some(question => question.topicId === topicId), false);
  }
});

test("questions with unmet prerequisites are unavailable", () => {
  assert.equal(api.isQuestionAvailable({
    topicId: "english-relative-pronouns",
    prerequisites: ["english-basic-sentences"]
  }, ["english-relative-pronouns"]), false);
  assert.equal(api.isQuestionAvailable({
    topicId: "english-relative-pronouns",
    prerequisites: ["english-basic-sentences"]
  }, ["english-basic-sentences", "english-relative-pronouns"]), true);
});

test("skipping an unlearned topic removes its deck without changing achievement data", () => {
  const state = {
    learnedTopics: ["english-basic-sentences", "english-relative-pronouns"],
    attempts: 12,
    correct: 8,
    weak: { q1: 2 },
    history: [{ id: "q1", ok: false }]
  };
  const result = api.skipUnlearnedTopic(state, "english-relative-pronouns", [
    { id: "a", topicId: "english-relative-pronouns" },
    { id: "b", topicId: "english-basic-sentences" }
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.learnedTopics)), ["english-basic-sentences"]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.deck.map(question => question.id))), ["b"]);
  assert.equal(result.attempts, 12);
  assert.equal(result.correct, 8);
  assert.deepEqual(JSON.parse(JSON.stringify(result.weak)), { q1: 2 });
  assert.deepEqual(JSON.parse(JSON.stringify(result.history)), [{ id: "q1", ok: false }]);
});

test("mock decks fill requested slots from unique available questions", () => {
  const selected = [{ id: "a" }, { id: "b" }];
  const pool = [{ id: "b" }, { id: "c" }, { id: "d" }];
  const filled = JSON.parse(JSON.stringify(api.fillDeckToCount(selected, pool, 4)));
  assert.deepEqual(filled.map(question => question.id), ["a", "b", "c", "d"]);
});

test("scope screen and browser-callable handlers are present", () => {
  assert.match(html, /id=["']screen-scope["']/);
  assert.match(html, /まだ習っていない/);
  for (const handler of ["showScope", "toggleTopic", "saveScope", "markCurrentTopicUnlearned"]) {
    assert.match(html, new RegExp(`window\\.${handler}\\s*=\\s*${handler}`));
  }
});

test("marking a topic unlearned does not ask for confirmation", () => {
  assert.doesNotMatch(html,/\bconfirm\s*\(/);
});
