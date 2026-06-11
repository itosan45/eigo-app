import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const appScript=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];
const dataSource=appScript.slice(appScript.indexOf("const SUBJECTS="),appScript.indexOf("const STORE="));
const context={};vm.createContext(context);
vm.runInContext(`${dataSource};globalThis.app={subjects:SUBJECTS,units:UNITS,questions:QUESTIONS}`,context);
const app=JSON.parse(JSON.stringify(context.app));

test("English app has six screens and explicit window handlers",()=>{
 for(const id of ["screen-home","screen-units","screen-question","screen-result","screen-stats","screen-shizuoka"])assert.match(html,new RegExp(`id=["']${id}["']`));
 for(const handler of ["goHome","openSubject","startUnit","startDaily","startWeak","startMiniMock","startFullMock","answer","answerNumber","answerText","answerOrder","answerOrderDone","nextQuestion","retryWrong","leaveQuiz","showShizuoka","showStats","enlarge","showHint2","speakCurrent"])assert.match(html,new RegExp(`window\\.${handler}\\s*=\\s*${handler}`));
});

test("English curriculum contains four domains, 24 units, and 152 questions",()=>{
 assert.deepEqual(app.subjects.map(s=>s.id),["listening","grammar","reading","writing"]);
 assert.equal(app.units.length,24);
 assert.equal(app.questions.length,152);
 assert.equal(new Set(app.questions.map(q=>q.id)).size,152);
});

test("all questions have hints and explanations",()=>{
 assert.ok(app.questions.every(q=>q.hint1&&q.hint2&&q.explanation&&q.misconception));
 assert.ok(app.questions.some(q=>q.type==="text"));
 assert.match(html,/SpeechSynthesisUtterance/);
});

test("JavaScript syntax and canvas future-proof lock are present",()=>{
 for(const source of [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]))assert.doesNotThrow(()=>new Function(source));
 assert.match(html,/touchcancel/);
 assert.match(html,/document\.body\.style\.overflow="hidden"/);
});
