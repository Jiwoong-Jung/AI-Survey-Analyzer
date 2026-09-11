/* Run locally: node tests/analysis.test.cjs (no packages or network). */
'use strict';
const assert=require('node:assert/strict');
const E=require('../analysis.js');
require('../demo.js');
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS',name);}
test('blank versus actual zero',()=>{
 assert.equal(E.score('').kind,'blank');assert.equal(E.score(null).kind,'blank');
 assert.equal(E.score(0).kind,'zero');assert.equal(E.score('0').kind,'zero');
});
test('valid scale and exclusions',()=>{
 assert.equal(E.score('5').value,5);assert.equal(E.score('매우 그렇다').value,5);
 assert.equal(E.score('6').kind,'invalid');assert.equal(E.score('해당 없음').kind,'excluded');
 assert.equal(E.score('7',7).value,7);assert.equal(E.score('매우 그렇다',7).kind,'invalid');
});
test('short comment and empty marker',()=>{
 assert.equal(E.commentKind('좋아요'),'meaningful');assert.equal(E.commentKind('없음'),'nonresponse');
 assert.equal(E.commentKind('0'),'nonresponse');
});
test('deterministic demo analysis',()=>{
 const options={scale:5,createdAt:'2026-09-11T00:00:00Z'};
 const a=E.analyze(E.prepare(SURVEY_DEMO.rows,SURVEY_DEMO.questions),options);
 const b=E.analyze(E.prepare(SURVEY_DEMO.rows,SURVEY_DEMO.questions),options);
 assert.deepEqual(a,b);
 assert.deepEqual(a.totals,{valid:141,blank:1,zero:1,excluded:1,invalid:0});
 assert.equal(a.comments.length,16);assert.equal(a.avg,3.43);
 assert.ok(E.completion(a).every(c=>c.actual>=c.target));
});
test('known names and email protection',()=>{
 const safe=E.makeSanitizer(['[김민수 교수] 설명','성명'],[['','이민수']],'검토대상명').safe;
 const x=safe('김민수 교수님 이민수 a@example.com 010-1234-5678 검토대상명');
 for(const token of ['김민수','이민수','a@example.com','010-1234-5678','검토대상명'])assert.ok(!x.includes(token));
});
test('aliases after an all-blank survey row',()=>{
 const p=E.prepare([['성명','[서술형] 의견'],['김민수','감사합니다'],['이민수',''],['박민수','박민수의 의견입니다.']]);
 const a=E.analyze(p);assert.equal(a.comments[1].respondent,'교육생 002');assert.ok(a.comments[1].text.startsWith('교육생 002'));
});
test('report dates are kept',()=>{
 const a=E.analyze(E.prepare(SURVEY_DEMO.rows,SURVEY_DEMO.questions),{period:'2026.09.01 ~ 2026.09.11'});
 assert.equal(a.period,'2026.09.01 ~ 2026.09.11');
});
test('manual feedback retained on regrouping',()=>{
 const a=E.analyze(E.prepare(SURVEY_DEMO.rows,SURVEY_DEMO.questions));a.feedback[0].edited=true;a.feedback[0].message='담당자 수정';
 a.comments[0].label='부정';a.comments[0].manual=true;E.refresh(a);assert.equal(a.feedback[0].message,'담당자 수정');
});
console.log(`${passed} tests passed.`);
