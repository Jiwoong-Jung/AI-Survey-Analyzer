/* 강의평가 분석 엔진 v2.1.0. 네트워크/저장소 접근 없는 결정적 규칙 기반 분석. */
(function(root) {
  'use strict';
  const S = v => v == null ? '' : String(v).trim();
  const round = n => n == null ? null : Math.round((n + Number.EPSILON) * 100) / 100;
  const avg = a => a.length ? round(a.reduce((s,n)=>s+n,0)/a.length) : null;
  const esc = s => S(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const cut = (s,n=140) => Array.from(S(s)).length > n ? Array.from(S(s)).slice(0,n).join('')+'…' : S(s);
  const TEXT_HINT = /서술|건의|의견|자유|개선사항|느낀|좋았던|아쉬웠던|comment|feedback/i;
  const META_HINT = /^(대상자|성명|이름|학번|번호|순번|응답자|교육생|과정정보|제출일시|제출시간|응답일|이메일|메일|전화|연락처|생년월일|성별|소속|아이디|id|name|timestamp|email|phone)(\s|$|[(_\[])/i;
  const Q_HINT = /교수|교강사|강사|만족도|수업|강의|출석|과제|질문|학습|추천|설명|설문|평가|준비/;
  const OMIT = /^(무응답|미응답|해당\s*없음|해당\s*없다|해당사항\s*없음|n\/?a|응답\s*안\s*함|[-—–])$/i;
  const NO_COMMENT = /^(0|없음|없다|없습니다[.!]?|없어요[.!]?|특이사항\s*없음|특별히\s*없음|해당사항\s*없음|해당\s*없음|무응답|미응답|n\/?a|[-—–.\s]+)$/i;
  const TOPICS = [
    ['설명과 전달','설명|전달|판서|개념|용어|이해|정확|명확','설명, 판서, 개념 전달의 명확성과 정확성','핵심 개념과 용어를 수업 전 점검하고, 판서 가독성과 이해 여부를 확인하는 짧은 점검을 운영합니다.'],
    ['수업 진도','진도|속도|빠르|빠른|빨라|느리|느린|따라가','수업 속도와 진도에 대한 체감','단원별 진도를 안내하고 중간 이해도 확인 후 속도를 조정하는 방안을 검토합니다.'],
    ['실습 기회','실습|실무|프로젝트|직접\s*해','실습의 양과 실제 수행 기회','단원별 실습 시간을 점검하고 시범, 개별 수행, 확인 순서의 실습안을 검토합니다.'],
    ['교재와 자료','교재|자료|프린트|유인물|학습지|교안','교재와 학습자료의 제공 및 구성','자료 제공 시점과 내용을 점검하고 핵심 요약과 실습 안내를 수업 전에 공유하는 방안을 검토합니다.'],
    ['질문과 응답','질문|답변|질의|물어|응답','질문 기회와 답변 방식','질문 시간을 별도로 확보하고 미해결 질문을 다음 수업에 확인하는 방안을 검토합니다.'],
    ['과제와 평가','과제|평가\s*기준|채점|시험\s*범위|피드백|성적','과제 부담, 평가 기준, 결과 피드백','과제량과 평가 기준을 사전 안내하고 평가 결과에 대한 구체적인 설명을 보완합니다.'],
    ['시설과 장비','시설|장비|컴퓨터|기자재|화면|스크린|흑판|책상|냉방|난방|강의실','교육 시설, 장비와 수업 환경','수업 전 장비와 화면 가독성을 점검하고 장애 발생 시 사용할 대체 방안을 마련합니다.'],
    ['출결과 시간','출석|출결|지각|정해진\s*시간|시간표|수업\s*시간|시간\s*운영','출결 관리와 수업 시간 준수','출결 확인과 수업 시작 및 종료 기준을 재확인하고 운영 일정을 명확히 안내합니다.'],
    ['기초 학습','기초|초보|입문|선행\s*학습','학습 출발점과 기초 내용 지원','선수 지식을 간단히 확인하고 기초 복습자료와 단계별 예제를 보완합니다.'],
    ['교육 내용','내용|주제|교육과정|커리큘럼|태양광|전기|보안|네트워크|PLC|반도체','교육 내용의 구성과 직무 관련성','차시별 학습목표와 교육 내용을 점검하고 목표와 관계없는 설명을 줄이는 방안을 검토합니다.'],
    ['수업 집중','집중|다른\s*얘기|다른\s*이야기|벗어나|잡담|산만','수업 집중과 주제 유지','수업 흐름을 핵심 주제 중심으로 정리하고 관련 없는 이야기로 진도가 지연되는지 확인합니다.'],
    ['자격과 시험','자격증|자격\s*시험|기능사|기사|시험\s*대비|기출','자격시험 준비와 학습 연계','시험 일정과 출제 범위를 교육 내용과 연결하고 취약 영역을 확인하는 연습을 검토합니다.'],
    ['취업 연계','취업|채용|면접|이력서|자기소개서|구직','취업 준비와 훈련 내용의 연결','과정의 기술을 채용 직무와 연결하고 지원서 및 면접 준비에 필요한 정보를 안내합니다.'],
    ['소통과 태도','소통|친절|배려|태도|존중|강요|화내|성의|적극|불친절|신경\s*써','소통 방식과 수강생 응대','질문과 의견을 존중하는 응대 기준을 공유하고 불편 사례는 구체적인 상황을 확인해 개선을 검토합니다.'],
    ['온라인 환경','온라인|접속|인터넷|와이파이|원격|영상|로그인','온라인 접속과 디지털 학습 환경','접속 오류와 영상 이용 환경을 점검하고 대체 자료와 문의 경로를 안내합니다.'],
    ['수업 준비','수업\s*준비|수업준비|준비성|성실|꼼꼼','수업 준비와 운영의 충실성','차시별 준비물과 수업 진행안을 점검하고 우수한 운영 방식을 다른 차시에 공유합니다.'],
    ['학습 난이도','난이도|어려|어렵|쉬웠|쉬워|수준','학습 난이도와 수준의 적절성','수강생 수준과 어려운 단원을 확인하고 단계별 예제와 보충 설명을 제공합니다.'],
    ['반복과 복습','복습|반복|다시\s*설명|보충','반복 설명과 복습 지원','수업 전후 핵심 내용을 짧게 반복하고 어려웠던 내용의 보충 자료를 검토합니다.'],
    ['휴식과 부담','휴식|쉬는\s*시간|휴게|피로|부담','수업 중 휴식과 학습 부담','수업과 휴식의 배분 및 학습량을 확인하고 무리가 있는 구간의 조정을 검토합니다.'],
    ['안전 관리','안전|위험|보호구|사고','실습과 시설의 안전 관리','실습 전 안전 수칙과 보호구를 확인하고 위험 상황의 보고 및 대응 절차를 점검합니다.']
  ].map(([name,pattern,meaning,action],order)=>({name,pattern,regex:new RegExp(pattern,'i'),meaning,action,order}));

  function score(value, max=5) {
    const s=S(value).replace(/\s+/g,' ');
    if (!s) return {kind:'blank',value:null};
    if (/^[+-]?0(?:\.0+)?$/.test(s)) return {kind:'zero',value:null};
    if (OMIT.test(s)) return {kind:'excluded',value:null};
    const labels={'매우 그렇지 않다':1,'그렇지 않다':2,'보통이다':3,'그렇다':4,'매우 그렇다':5,'매우 불만족':1,'불만족':2,'보통':3,'만족':4,'매우 만족':5};
    if (max===5 && Object.prototype.hasOwnProperty.call(labels,s)) return {kind:'valid',value:labels[s]};
    if (/^\d+(?:\.\d+)?(?:\s*점)?$/.test(s)) {
      const n=Number(s.replace(/\s*점$/,''));
      if (Number.isInteger(n)&&n>=1&&n<=max) return {kind:'valid',value:n};
    }
    return {kind:'invalid',value:null};
  }
  function commentKind(v) { const s=S(v); return !s?'blank':NO_COMMENT.test(s)?'nonresponse':'meaningful'; }
  function aliasLetters(n) { let s=''; for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s; return s; }
  function makeSanitizer(headers=[], data=[], extras='') {
    const teacher = new Map(), people = new Map();
    function addTeacher(n) {
      n=S(n);
      const plausible=/^[A-Z]$/.test(n)||/^[김이박최정강조윤장임한오서신권황안송전홍유고문양손배백허남심노하곽성차주우구민류진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예경봉사부복순관빙견음대단갈궁독시돈빈동목상승][가-힣]{1,2}$/.test(n)||/^(남궁|황보|제갈|선우|사공|독고|서문|동방)[가-힣]{1,2}$/.test(n);
      if(!plausible)return;
      if(!n || /^(담당|우리|해당|다른|모든|전체|교강사|교수자|교수|강사|선생|좋은|새로운|좋으신|친절한|성실한|수업|교사|대한|저희|전문|외부|내부|전임|계약직)$/.test(n))return;
      if(!teacher.has(n))teacher.set(n,'교수자 '+aliasLetters(teacher.size));
    }
    for(const h of headers) {
      for(const m of S(h).matchAll(/(?:\[|^|\s)([가-힣]{2,4}|[A-Z])\s*(?:교강사|교수님?|강사님?)/g)) addTeacher(m[1]);
    }
    headers.forEach((h,ci)=>{
      if(/^(대상자|성명|이름|응답자|교육생|name)(\s|$|[(_\[])/i.test(S(h))) {
        data.forEach((r,ri)=>{
          const n=S(r[ci]).split(/[\n[(]/)[0].trim();
          if(n && n.length<=40 && !/^\d+$/.test(n))people.set(n,'교육생 '+String(ri+1).padStart(3,'0'));
        });
      }
    });
    const titles=headers.concat(data.flatMap(r=>r.filter(x=>typeof x==='string'&&x.length>1)));
    for(const t of titles)for(const m of S(t).matchAll(/([가-힣]{2,4}?)\s*(?:교강사|교수님?|강사님?|선생님)/g)) addTeacher(m[1]);
    const replacements=[];
    teacher.forEach((alias,n)=>replacements.push([n,alias,true]));
    people.forEach((alias,n)=>{if(!teacher.has(n))replacements.push([n,alias,false]);});
    for(const n of S(extras).split(/[\n,]+/).map(S).filter(Boolean))if(!teacher.has(n)&&!people.has(n))replacements.push([n,'[추가 익명화]',false]);
    replacements.sort((a,b)=>b[0].length-a[0].length);
    function safe(value, options={}) {
      let out=S(value);
      // Placeholders prevent cascading replacement (e.g. English A inside a generated alias).
      const tokens=[];
      for(const [name,alias,isTeacher] of replacements) {
        let pattern=esc(name);
        if (/^[A-Z]$/.test(name)) pattern += '\\s*(?:교강사|교수님?|강사님?)';
        else if(isTeacher) pattern+='(?:\\s*(?:교강사|교수님?|강사님?|선생님))?';
        out=out.replace(new RegExp(pattern,'g'),()=>{const k=tokens.push(alias)-1;return '\uE000'+k+'\uE001';});
      }
      out=out.replace(/\uE000(\d+)\uE001/g,(_,n)=>tokens[Number(n)]);
      out=out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[이메일 제외]')
        .replace(/(?:\+82[-.\s]?)?0?1[016789][- .]?\d{3,4}[- .]?\d{4}/g,'[연락처 제외]')
        .replace(/\b0\d{1,2}[- .]\d{3,4}[- .]\d{4}\b/g,'[연락처 제외]')
        .replace(/\b\d{6}\s*[-]\s*[1-8]\d{6}\b/g,'[식별번호 제외]')
        .replace(/https?:\/\/[^\s<>]+/gi,'[외부주소 제외]')

        .replace(/(?:치매|편집증|불안증세|강박성\s*성격장애|정신병|정신질환)/g,'[개인 건강 관련 표현 제외]');
      if(!options.keepDates)out=out.replace(/(?:19|20)\d{2}[./-]\d{1,2}[./-]\d{1,2}/g,'[날짜 제외]');
      return out;
    }
    return {safe,teacherCount:teacher.size,personCount:people.size,extraCount:S(extras).split(/[\n,]+/).filter(x=>S(x)).length};
  }
  function detectHeader(rows) {
    let best=0, bestScore=-Infinity;
    for(let i=0;i<Math.min(20,rows.length);i++) {
      let filled=0,hints=0,meta=0,numbers=0;
      for(const v of rows[i]||[]) {if(!S(v))continue;filled++;if(Q_HINT.test(S(v))||TEXT_HINT.test(S(v)))hints++;if(META_HINT.test(S(v)))meta++;if(/^\d+$/.test(S(v)))numbers++;}
      const total=hints*30+meta*12+Math.min(filled,30)-numbers*4;
      if(filled>=2&&total>bestScore){best=i;bestScore=total;}
    }
    return best;
  }
  function surveyQuestions(text) {
    return S(text).split(/\r?\n/).map(S).filter(s=>/^(\[.+\]|\d+[.)]|Q\d+)/i.test(s)&&s.length>5);
  }
  function canonical(s) {return S(s).replace(/교수자\s*([A-Z]+)/g,'$1교수').replace(/[\s·.,:;!?()[\]{}\-_/]/g,'').toLowerCase();}
  function prepare(rawRows,surveyText='',options={}) {
    if(!Array.isArray(rawRows)||!rawRows.length)throw new Error('응답 데이터가 없습니다.');
    const hi=options.headerRow==null?detectHeader(rawRows):Number(options.headerRow);
    if(!Number.isInteger(hi)||hi<0||hi>=rawRows.length-1)throw new Error('문항명 행 아래에 응답 데이터가 있어야 합니다.');
    const width=Math.max(...rawRows.map(r=>r.length));
    if(width>200||rawRows.length>3002)throw new Error('지원 범위는 200열, 약 3,000응답입니다. 파일을 나누어 분석해주세요.');
    const headers=Array.from({length:width},(_,i)=>S(rawRows[hi]?.[i])||`이름 없는 열 ${i+1}`);
    let skipped=0;
    const records=[];
    rawRows.slice(hi+1).forEach((r,i)=>{
      if(!r.some(v=>S(v)))return;
      if(r.slice(0,3).some(v=>/^(합계|총계|평균|총\s*응답\s*수|설문완료\s*>?)$/.test(S(v)))){skipped++;return;}
      records.push({sourceRow:hi+i+2,values:Array.from({length:width},(_,ci)=>r[ci]??'')});
    });
    const sanitizer=makeSanitizer(headers,records.map(r=>r.values),options.extraNames||'');
    const tq=surveyQuestions(surveyText); const safeT=makeSanitizer(tq).safe;
    const canonQuestions=new Set(tq.map(q=>canonical(safeT(q))));
    const cols=headers.map((h,i)=>{
      const safeHeader=sanitizer.safe(h);
      const exact=canonQuestions.has(canonical(safeHeader));
      const valid=records.filter(r=>score(r.values[i],options.scale||5).kind==='valid').length;
      const nonempty=records.filter(r=>S(r.values[i])).length;
      let role=TEXT_HINT.test(h)?'comment':(S(rawRows[hi]?.[i])&&META_HINT.test(h))?'exclude':Q_HINT.test(h)?'score':(valid>0&&valid/Math.max(nonempty,1)>=0.8)?'score':'exclude';
      if(options.roles&&options.roles[i])role=options.roles[i];
      return {index:i,header:safeHeader,role,matched:exact};
    });
    const active=cols.filter(c=>c.role!=='exclude');
    if(!active.length&&!options.allowUnconfigured)throw new Error('분석할 열이 없습니다. 문항명 행과 열의 용도를 확인해주세요.');
    const filtered=active.length?records.filter(r=>active.some(c=>S(r.values[c.index]))):records;
    if(!filtered.length)throw new Error('선택된 설문 열에 응답이 없습니다.');
    // Rebuild participant aliases after omitted rows, keeping feedback labels consistent.
    const finalSanitizer=makeSanitizer(headers,filtered.map(r=>r.values),options.extraNames||'');
    for(const c of cols){c.header=finalSanitizer.safe(headers[c.index]);c.matched=canonQuestions.has(canonical(c.header));}
    const headerIssues=cols.filter(c=>c.role!=='exclude'&&(/^(?:Q\s*\d+|문항\s*\d+|질문\s*\d+|열\s*\d+|이름 없는 열\s*\d+|\d+[.)]?)$/i.test(c.header)||headers.filter(h=>h===headers[c.index]).length>1)).map(c=>c.index+1);
    return {headers,columns:cols,records:filtered,headerRow:hi,sanitizer:finalSanitizer,surveyCount:tq.length,hasSurveyText:!!S(surveyText),headerIssues,skipped,ignoredRows:records.length-filtered.length};
  }
  function sentiment(text) {
    let s=S(text),pos=0,neg=0;
    // Negative constructions are consumed before positive words such as '만족'.
    const negations=/불만족|(?:만족|좋|도움|친절|이해|유익)[가-힣\s]{0,8}(?:하지\s*않|지\s*않|안\s*되|되지\s*않|없)/g;
    s=s.replace(negations,()=>{neg++;return ' ';});
    s=s.replace(/(?:나쁘|어렵|불편하|부족하|힘들)[가-힣\s]{0,5}(?:지\s*않|없)/g,()=>{pos++;return ' ';});
    const p=/좋(?:아|았|은|고|습|네요|음)|만족|도움|친절|명확|성실|꼼꼼|감사|유익|훌륭|최고|감동|행운|이해[가-힣\s]{0,6}잘|잘[가-힣\s]{0,6}(?:설명|이해)|쉽게/g;
    const n=/불만|어려|어렵|부족|아쉽|빠르|빠른|빨라|느리|느린|불편|싫|틀린|잘못|보이지\s*않|벗어나|엉터리|불친절|떨어|중단|문제|못하|부정확|강요|힘들|산만|안\s*보|미흡|지연|오류|부담|없어서|없어[요서]|없었/g;
    s=s.replace(/불친절/g,()=>{neg++;return ' ';});
    pos+=(s.match(p)||[]).length; neg+=(s.match(n)||[]).length;
    const mixed=pos>0&&neg>0;
    return {label:neg>pos?'부정':pos>neg?'긍정':'중립',positiveHits:pos,negativeHits:neg,mixed,review:mixed||(pos===0&&neg===0),reason:mixed?'긍정과 부정 표현이 함께 있어 검토가 필요합니다.':pos===0&&neg===0?'감정 표현이 명확하지 않아 중립으로 임시 분류했습니다.':'표현 사전에 따른 자동 분류 초안입니다.'};
  }
  function topicMatches(s) {return TOPICS.filter(t=>t.regex.test(S(s)));}
  function clauses(s) {return S(s).split(/[.!?\n]+|(?:하지만|다만|그러나|그런데)/).map(S).filter(Boolean);}
  function analyze(prepared,options={}) {
    const scale=Number(options.scale)||5;
    if(![5,7].includes(scale))throw new Error('5점 또는 7점 척도를 선택해주세요.');
    const {records,columns,sanitizer}=prepared;
    const scols=columns.filter(c=>c.role==='score'), ccols=columns.filter(c=>c.role==='comment');
    if(!scols.length&&!ccols.length)throw new Error('분석할 열이 없습니다. 열의 분석 용도를 지정해주세요.');
    const totals={valid:0,blank:0,zero:0,excluded:0,invalid:0};
    const comments=[],feedback=[],allScores=[],commentStats={meaningful:0,blank:0,nonresponse:0};
    const questions=scols.map(c=>{
      const counts={valid:0,blank:0,zero:0,excluded:0,invalid:0}, vals=[];
      for(const r of records){const v=score(r.values[c.index],scale);counts[v.kind]++;totals[v.kind]++;if(v.kind==='valid')vals.push(v.value);}
      allScores.push(...vals);
      return {index:c.index,header:c.header,category:(c.header.match(/^\[([^\]]+)\]/)||[])[1]||'기타',n:vals.length,avg:avg(vals),positive:vals.length?round(vals.filter(x=>x>(scale+1)/2).length/vals.length*100):null,negative:vals.length?round(vals.filter(x=>x<(scale+1)/2).length/vals.length*100):null,...counts};
    });
    records.forEach((r,ri)=>{
      const respondent='교육생 '+String(ri+1).padStart(3,'0'); const mine=[];
      for(const c of ccols){
        const kind=commentKind(r.values[c.index]); commentStats[kind]++;
        if(kind!=='meaningful')continue;
        const text=sanitizer.safe(r.values[c.index]);
        const id='의견 '+String(comments.length+1).padStart(3,'0');
        const auto=sentiment(text);
        const item={id,respondent,rowIndex:ri,sourceRow:r.sourceRow,question:c.header,text,...auto,autoLabel:auto.label,manual:false};
        comments.push(item); mine.push(item);
      }
      const vals=scols.map(c=>score(r.values[c.index],scale)).filter(x=>x.kind==='valid').map(x=>x.value);
      feedback.push({respondent,rowIndex:ri,sourceRow:r.sourceRow,average:avg(vals),opinionIds:mine.map(c=>c.id),selected:false,edited:false,message:''});
    });
    const a={version:'2.1.0',engine:'로컬 규칙 기반 분석 / 생성형 AI 미연결',scale,createdAt:options.createdAt||new Date().toISOString(),course:sanitizer.safe(options.course,{keepDates:true})||'강의평가',period:sanitizer.safe(options.period,{keepDates:true})||'미입력',responses:records.length,columns,questions,comments,feedback,totals,commentStats,avg:avg(allScores),surveyCount:prepared.surveyCount,hasSurveyText:prepared.hasSurveyText,questionSource:'엑셀 문항 사용',comparisonStatus:prepared.hasSurveyText?'TXT 선택 대조':'TXT 대조 생략',headerIssues:prepared.headerIssues||[],matched:columns.filter(c=>c.role!=='exclude'&&c.matched).length,headerRow:prepared.headerRow+1,skipped:prepared.skipped,ignoredRows:prepared.ignoredRows,privacy:{teachers:sanitizer.teacherCount,participants:sanitizer.personCount,extra:sanitizer.extraCount},warnings:[]};
    if(prepared.hasSurveyText&&!prepared.surveyCount)a.warnings.push('선택한 TXT에서 대조 가능한 문항 형식을 찾지 못했습니다. 엑셀 문항으로 분석하며 TXT 내용은 별도로 확인해주세요.');
    if(a.headerIssues.length)a.warnings.push('엑셀 '+a.headerIssues.join(', ')+'열의 문항명이 번호만 있거나 비어 있거나 중복됩니다. 원본 엑셀에 전체 문항 내용을 보완한 뒤 다시 선택해주세요. TXT는 문항을 자동으로 대체하지 않습니다.');
    if(!scols.length)a.warnings.push('정량 문항이 없어 평균은 계산하지 않았습니다.');
    if(!ccols.length)a.warnings.push('서술형 열이 없습니다. 열 용도를 확인해주세요.');
    if(prepared.surveyCount&&a.matched<columns.filter(c=>c.role!=='exclude').length)a.warnings.push('TXT와 XLSX 문항명이 완전히 일치하지 않는 열이 있습니다. 자동으로 순서를 강제 연결하지 않았습니다.');
    if(scale===7)a.warnings.push('7점 모드에서는 숫자 1~7만 인정합니다. 5점 응답 문구를 7점으로 환산하지 않습니다.');
    if(totals.zero||totals.invalid)a.warnings.push(`척도 밖 0값 ${totals.zero}건, 기타 무효값 ${totals.invalid}건을 평균에서 제외했습니다. 의미를 미응답으로 단정하지 않습니다.`);
    if(a.comments.some(c=>/개인 건강 관련 표현 제외/.test(c.text)))a.warnings.push('개인 건강에 대한 단정 표현을 가렸습니다. 의견에 포함된 주장과 확인된 사실을 구분해주세요.');
    refresh(a,true);
    let selected=0; a.feedback.forEach(f=>{if(f.opinionIds.length&&selected<10){f.selected=true;selected++;}});
    return a;
  }
  function refresh(a,resetFeedback=false) {
    a.counts={'긍정':0,'중립':0,'부정':0}; a.comments.forEach(c=>a.counts[c.label]++);
    a.reviewCount=a.comments.filter(c=>c.review&&!c.manual).length;
    a.keywords=TOPICS.map(t=>{
      const matches=a.comments.filter(c=>t.regex.test(c.text));
      return {name:t.name,frequency:matches.length,meaning:t.meaning,evidence:matches.map(c=>c.id),example:cut(matches[0]?.text||'',100),order:t.order};
    }).filter(t=>t.frequency).sort((a,b)=>b.frequency-a.frequency||a.order-b.order).slice(0,10);
    a.reasons={};
    for(const label of ['긍정','중립','부정']) {
      const pool=a.comments.filter(c=>c.label===label);
      let items=TOPICS.map(t=>{
        const matches=pool.map(c=>{
          const parts=clauses(c.text).filter(p=>t.regex.test(p));
          const chosen=parts.find(p=>sentiment(p).label===label)|| (label==='중립'||c.manual?parts[0]:null);
          return chosen?{id:c.id,text:chosen}:null;
        }).filter(Boolean);
        return {topic:t.name,count:matches.length,evidence:matches.map(m=>m.id),example:matches[0]?cut(matches[0].text,160):'',order:t.order};
      }).filter(x=>x.count);
      if(!items.length&&pool.length)items=[{topic:label==='중립'?'구체적 감정 판단 유보':`전반적인 ${label} 표현`,count:pool.length,evidence:pool.map(c=>c.id),example:cut(pool[0].text,160),order:999}];
      a.reasons[label]=items.sort((x,y)=>y.count-x.count||x.order-y.order).slice(0,5);
    }
    const improvements=[]; const used=new Set();
    const candidates=TOPICS.map(t=>{
      const evidence=a.comments.filter(c=>c.label!=='긍정'&&clauses(c.text).some(p=>t.regex.test(p)&&(sentiment(p).label==='부정'||/해주세요|바랍니다|희망|원합니다|필요|요청|했으면|해주셨으면/.test(p)||c.manual&&c.label==='부정')));
      return {t,evidence,priority:evidence.filter(c=>c.label==='부정').length*2+evidence.length};
    }).filter(x=>x.evidence.length).sort((x,y)=>y.priority-x.priority||x.t.order-y.t.order);
    for(const c of candidates){
      if(improvements.length>=5)break;
      used.add(c.t.name);
      improvements.push({title:c.t.name+' 운영 점검',kind:'개선 검토',basis:`관련 의견 ${c.evidence.length}건 (${c.evidence.map(x=>x.id).join(', ')})`,quote:cut(c.evidence[0].text,160),action:c.t.action});
    }
    for(const q of [...a.questions].filter(q=>q.n&&q.avg<(a.scale+1)/2+1).sort((x,y)=>x.avg-y.avg||x.index-y.index)){
      if(improvements.length>=5)break;
      const t=topicMatches(q.header).find(t=>!used.has(t.name));if(!t)continue;used.add(t.name);
      improvements.push({title:t.name+' 추가 확인',kind:'정량 근거',basis:`${q.header} / 평균 ${q.avg}, 유효 응답 ${q.n}명`,quote:'평균만으로 원인을 확정하지 않습니다. 구체적 사례를 추가 확인해야 합니다.',action:t.action});
    }
    for(const k of a.keywords){
      if(improvements.length>=5)break;
      if(used.has(k.name))continue;
      const positives=a.comments.filter(c=>c.label==='긍정'&&k.evidence.includes(c.id));if(!positives.length)continue;
      used.add(k.name);
      improvements.push({title:k.name+' 강점 유지',kind:'유지·강화 제안',basis:`긍정 의견 ${positives.length}건 (${positives.map(c=>c.id).join(', ')})`,quote:cut(positives[0].text,160),action:'긍정적으로 평가된 운영 방식을 확인해 유지하고 다른 차시에 적용 가능한지 검토합니다.'});
    }
    a.improvements=improvements;
    a.feedback.forEach(f=>{
      if(f.edited&&!resetFeedback)return;
      const cs=a.comments.filter(c=>f.opinionIds.includes(c.id));
      if(!cs.length){f.message='구체적인 서술형 의견이 없어 개인화 메시지 작성을 보류합니다. 정량점수만으로 성향이나 학습태도를 추정하지 않습니다.';return;}
      const snippets=cs.map(c=>'“'+cut(c.text,170)+'”').join(' / ');
      const ts=[...new Set(cs.flatMap(c=>topicMatches(c.text).map(t=>t.name)))].slice(0,3);
      const labels=[...new Set(cs.map(c=>c.label))];
      const focus=ts.length?ts.join(', '):'말씀해주신 내용';
      const tail=labels.every(x=>x==='긍정')?`${focus}에 대한 긍정적인 경험을 유지할 항목으로 정리했습니다.`:`${focus} 관련 의견을 담당자가 구체적으로 확인할 검토 항목으로 정리했습니다.`;
      f.message=`${f.respondent}님, 의견을 남겨주셔서 감사합니다. ${snippets}라는 의견을 확인했습니다. ${tail} 남겨주신 의견은 교육과정 운영을 점검하기 위한 검토 자료로 정리했으며, 아직 개선 조치나 일정이 확정된 것은 아닙니다.`;
      f.edited=false;
    });
    return a;
  }
  function completion(a) {
    const selected=a.feedback.filter(f=>f.selected&&f.opinionIds.length).length;
    return [{name:'키워드',actual:a.keywords.length,target:10},{name:'긍정 사유',actual:a.reasons['긍정'].length,target:5},{name:'중립 사유',actual:a.reasons['중립'].length,target:5},{name:'부정 사유',actual:a.reasons['부정'].length,target:5},{name:'개선·유지 제안',actual:a.improvements.length,target:5},{name:'선택한 개인 피드백',actual:selected,target:10}];
  }
  const api={S,round,avg,cut,score,commentKind,makeSanitizer,detectHeader,surveyQuestions,prepare,sentiment,topicMatches,analyze,refresh,completion,TOPICS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.SurveyEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
