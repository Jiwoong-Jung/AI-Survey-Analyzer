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

function analyzed(text='',rows=SURVEY_DEMO.rows,extra={}){
 const options={scale:5,createdAt:'2026-09-11T00:00:00Z',...extra};
 return E.analyze(E.prepare(rows,text,options),options);
}
function outputs(a){return {avg:a.avg,totals:a.totals,comments:a.comments,questions:a.questions,
 keywords:a.keywords,reasons:a.reasons,improvements:a.improvements,feedback:a.feedback};}
test('Excel-only: no TXT required',()=>{
 const a=analyzed();assert.equal(a.hasSurveyText,false);assert.equal(a.comparisonStatus,'TXT 대조 생략');
 assert.equal(a.version,'2.1.0');assert.equal(a.responses,18);assert.equal(a.comments.length,16);
});
test('Excel-only and optional TXT have identical analytical results',()=>{
 assert.deepEqual(outputs(analyzed()),outputs(analyzed(SURVEY_DEMO.questions)));
});
test('Unmatched optional TXT cannot overwrite headers or roles',()=>{
 const a=analyzed('[무관] 1. 분석과 관계없는 문항입니다');
 assert.deepEqual(outputs(a),outputs(analyzed()));assert.ok(a.warnings.some(s=>s.includes('일치하지')));
});
test('TXT without recognized lines gives an explicit warning',()=>{
 const a=analyzed('원본 문항 전체가 한 줄의 일반 안내문으로만 제공됨');
 assert.equal(a.hasSurveyText,true);assert.equal(a.surveyCount,0);
 assert.ok(a.warnings.some(s=>s.includes('문항 형식')));
});
test('Generic or empty Excel headings are flagged',()=>{
 const a=analyzed('',[['Q1','','[서술형] 의견'],[4,3,'자료가 좋아요']]);
 assert.deepEqual(a.headerIssues,[1,2]);assert.ok(a.warnings.some(s=>s.includes('전체 문항')));
});
test('Duplicate Excel headings are flagged without collapsing responses',()=>{
 const a=analyzed('',[['강의 만족도','강의 만족도'],[4,2]]);
 assert.equal(a.questions.length,2);assert.equal(a.avg,3);assert.deepEqual(a.headerIssues,[1,2]);
});
test('No recognized columns can still be configured in the UI',()=>{
 const rows=[['항목 A','항목 B'],['가나다','마바사']];
 const p=E.prepare(rows,'',{allowUnconfigured:true});
 assert.ok(p.columns.every(c=>c.role==='exclude'));assert.throws(()=>E.analyze(p),/열/);
 const q=E.prepare(rows,'',{roles:{0:'comment',1:'exclude'}});assert.equal(E.analyze(q).comments.length,1);
});
test('Meta columns remain excluded even when listed in TXT',()=>{
 const p=E.prepare([['응답자','만족도'],[1,5],[2,4]],'[응답자] 1. 응답자');
 assert.equal(p.columns[0].role,'exclude');assert.equal(E.analyze(p).totals.valid,2);
});
test('7-point Excel-only mode preserves its numeric scale',()=>{
 const a=analyzed('',[['수업 만족도','[서술형] 의견'],[7,'자료가 좋습니다'],[4,'실습 추가 요청']],{scale:7});
 assert.equal(a.avg,5.5);assert.equal(a.questions[0].positive,50);
});
test('PDF blocks clearly label TXT comparison as skipped',()=>{
 require('../pdf-report.js');const text=JSON.stringify(SurveyPDF.blocks(analyzed()));
 assert.ok(text.includes('엑셀 문항 사용 / TXT 대조 생략'));
 assert.ok(!text.includes('TXT 인식 문항: 0'));assert.ok(!text.includes('TXT 일치 열: 0'));
});
console.log(`${passed} tests passed.`);
