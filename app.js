/* DOM/UI controller. Raw files stay in page memory; no fetch, upload, cookies, or storage. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), E=window.SurveyEngine;
  if(!E||!window.LocalXLSX||!window.SurveyPDF){$('status').textContent='필수 코드 파일이 누락되었습니다. 압축 안의 파일 전체를 같은 폴더에 올려주세요.';return;}
  const state={raw:null,survey:'',prepared:null,analysis:null,roles:null,demo:false,busy:false,token:0,sheets:[],readWarnings:[]};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>n==null?'—':Number(n).toFixed(2);
  function status(text,type=''){ $('status').textContent=text;$('status').className='status '+type; }
  function busy(value){state.busy=value;for(const id of ['runBtn','demoBtn','txtFile','xlsxFile','sheetSelect','headerRow','scale','encoding','course','period','extraNames','clearTxtBtn'])$(id).disabled=value||(id==='sheetSelect'&&(!state.sheets.length||state.demo));document.querySelectorAll('[data-column],[data-sentiment],[data-feedback-select],[data-feedback-text],#selectTenBtn,#includeComments,#privacyChecked').forEach(x=>{x.disabled=value||(x.dataset.feedbackSelect!=null&&!state.analysis?.feedback[Number(x.dataset.feedbackSelect)]?.opinionIds.length);});syncExport();}
  function syncExport(){ $('exportBtn').disabled=state.busy||!state.analysis||!$('privacyChecked').checked; }
  function clearAnalysis(){
    state.analysis=null;$('privacyChecked').checked=false;syncExport();
    for(const id of ['kpiResponses','kpiAvg','kpiQuestions','kpiComments'])$(id).textContent='—';
    for(const id of ['summaryContent','questionContent','keywordContent','sentimentSummary','reasonContent','opinionContent','improvementContent','feedbackContent','reportPreview'])$(id).innerHTML='';
    $('summaryContent').innerHTML='<div class="empty">자료 또는 설정이 변경되었습니다. 분석을 실행해주세요.</div>';
    $('feedbackCount').textContent='';
  }
  function options(){return {scale:Number($('scale').value),course:$('course').value,period:$('period').value,headerRow:Number($('headerRow').value)-1,extraNames:$('extraNames').value,roles:state.roles};}
  function table(headers,rows,classes=[]){
    if(!rows.length)return '<div class="empty compact">표시할 자료가 없습니다.</div>';
    return '<div class="table-wrap"><table><thead><tr>'+headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map((v,i)=>'<td class="'+(classes[i]||'')+'">'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  function mapping(){
    if(!state.raw)return;
    state.prepared=E.prepare(state.raw,state.survey,{...options(),allowUnconfigured:true});
    const p=state.prepared;
    $('mappingCount').textContent=`${p.columns.length}열 / ${p.hasSurveyText?'TXT '+p.surveyCount+'문항 대조':'엑셀 문항 사용'}`;
    $('sourceInfo').textContent=p.hasSurveyText?`엑셀 문항 사용 / TXT ${p.surveyCount}문항 선택 대조`:'엑셀 문항 사용 / TXT 대조 생략';
    $('columnMapping').className='';
    $('columnMapping').innerHTML='<div class="table-wrap"><table><thead><tr><th>열</th><th>익명화한 문항명</th><th>TXT 대조 (선택)</th><th>분석 용도</th></tr></thead><tbody>'+p.columns.map(c=>'<tr><td>'+String(c.index+1)+'</td><td class="wide">'+esc(c.header)+'</td><td>'+(c.role==='exclude'?'분석 제외':!p.hasSurveyText?'대조 생략':c.matched?'일치':'확인 필요')+'</td><td><select data-column="'+c.index+'" aria-label="'+esc(c.header)+' 분석 용도">'+[['score','정량 점수'],['comment','서술형 의견'],['exclude','분석 제외']].map(([v,n])=>'<option value="'+v+'"'+(c.role===v?' selected':'')+'>'+n+'</option>').join('')+'</select></td></tr>').join('')+'</tbody></table></div>';
    $('inputInfo').textContent=`응답 ${p.records.length}행 / 정량 ${p.columns.filter(c=>c.role==='score').length}열 / 서술형 ${p.columns.filter(c=>c.role==='comment').length}열`;
  }
  async function readText(file){
    if(file.size>1024*1024)throw new Error('문항 TXT는 1MB 이하로 선택해주세요.');
    const buf=await file.arrayBuffer(),mode=$('encoding').value;
    let text;
    if(mode==='auto'){try{text=new TextDecoder('utf-8',{fatal:true}).decode(buf);}catch{text=new TextDecoder('euc-kr',{fatal:true}).decode(buf);}}
    else text=new TextDecoder(mode,{fatal:true}).decode(buf);
    if(text.includes('\uFFFD'))throw new Error('TXT 문자가 깨졌습니다. 문자 인코딩 설정을 확인해주세요.');
    if(!text.trim())throw new Error('문항 TXT가 비어 있습니다.');return text;
  }
  async function loadFiles(sheetIndex=null){
    const token=++state.token;clearAnalysis();busy(true);state.demo=false;$('demoBanner').hidden=true;
    const tf=$('txtFile').files[0],xf=$('xlsxFile').files[0];
    $('txtName').textContent=tf?tf.name:'미선택 — 엑셀만으로 분석 가능';$('xlsxName').textContent=xf?xf.name:'선택되지 않음';
    state.raw=null;state.survey='';state.prepared=null;state.roles=null;state.sheets=[];state.readWarnings=[];
    $('mappingCount').textContent='';$('inputInfo').textContent='';
    $('columnMapping').innerHTML='<div class="empty compact">자료를 읽고 있습니다.</div>';status('파일을 브라우저 안에서 읽고 있습니다.');
    try{
      if(tf&&!/\.txt$/i.test(tf.name))throw new Error('문항 파일은 .txt로 선택해주세요.');
      if(xf&&!/\.xlsx$/i.test(xf.name))throw new Error('응답 파일은 암호가 없는 .xlsx로 선택해주세요.');
      if(xf&&xf.size>LocalXLSX.MAX_FILE)throw new Error('XLSX는 10MB 이하만 지원합니다. 필요한 설문 범위만 남겨주세요.');
      const [text,workbook]=await Promise.all([tf?readText(tf):Promise.resolve(''),xf?xf.arrayBuffer().then(buf=>LocalXLSX.read(buf,sheetIndex)):Promise.resolve(null)]);
      if(token!==state.token)return;
      state.survey=text;
      if(workbook){
        state.raw=workbook.rows;state.sheets=workbook.sheetNames;state.readWarnings=workbook.warnings;
        $('sheetSelect').innerHTML=workbook.sheetNames.map((n,i)=>'<option value="'+i+'">'+esc(n)+'</option>').join('');$('sheetSelect').value=String(workbook.sheetIndex);
        $('headerRow').value=String(E.detectHeader(workbook.rows)+1);mapping();
      }else{$('sheetSelect').innerHTML='<option>파일 선택 후 표시</option>';$('columnMapping').innerHTML='<div class="empty compact">응답 XLSX를 선택해주세요.</div>';$('inputInfo').textContent='';}
      status(workbook?(tf?'자료를 읽었습니다. TXT 대조는 참고용입니다. 문항과 열 용도를 확인하고 분석을 실행하세요.':'엑셀 파일을 읽었습니다. TXT 없이 분석할 수 있습니다. 문항과 열 용도를 확인하세요.'):'응답 XLSX를 선택해주세요. TXT는 선택 사항입니다.','ok');
    }catch(err){if(token!==state.token)return;state.raw=null;state.prepared=null;state.sheets=[];$('inputInfo').textContent='';$('mappingCount').textContent='';$('columnMapping').innerHTML='<div class="empty compact">자료를 불러오지 못했습니다.</div>';status(err.message||'파일을 읽지 못했습니다.','error');}
    finally{if(token===state.token)busy(false);}
  }
  async function run(){
    clearAnalysis();
    try{
      if(!state.raw)throw new Error('응답 XLSX를 먼저 선택해주세요.');
      busy(true);status('점수, 의견, 개선 방안과 개인별 피드백을 분석하고 있습니다.');
      const token=++state.token;await new Promise(r=>setTimeout(r,20));if(token!==state.token)return;
      mapping();const a=E.analyze(state.prepared,options());
      a.warnings.push(...state.readWarnings);if(state.demo)a.warnings.unshift('가상 시연용 자료입니다. 실제 조사 결과가 아닙니다.');
      state.analysis=a;render();showTab('summary');
      status(`분석 완료: ${a.responses}명, 유효 점수 ${a.totals.valid}건, 의견 ${a.comments.length}건. 분류와 익명화 결과를 검토해주세요.`,'ok');
    }catch(err){clearAnalysis();status(err.message||'분석에 실패했습니다.','error');}
    finally{busy(false);}
  }
  function renderSummary(a){
    const cs=E.completion(a);
    $('summaryContent').className='';
    $('summaryContent').innerHTML='<h2>분석 결과와 검토 항목</h2><p class="fine">같은 자료와 같은 설정에는 같은 분석 규칙을 적용합니다. 아래는 수량 확인이며 심사 점수나 정확도 평가가 아닙니다.</p><div class="checks">'+cs.map(c=>'<div class="check-tile"><span>'+esc(c.name)+'</span><strong class="'+(c.actual>=c.target?'pass':'warn')+'">'+c.actual+' / '+c.target+'</strong></div>').join('')+'</div>'+table(['항목','분석 결과'],[
      ['전체 평균',fmt(a.avg)+' / '+a.scale+'점 (모든 유효 점수 합 ÷ 유효 점수 수)'],
      ['정량 점수 제외 내역',`빈칸 ${a.totals.blank} / 0값 ${a.totals.zero} / 해당 없음 ${a.totals.excluded} / 기타 무효 ${a.totals.invalid}`],
      ['서술형 제외 내역',`빈칸 ${a.commentStats.blank} / 내용 없는 응답 ${a.commentStats.nonresponse}`],
      ['문항 출처',`${a.questionSource} / ${a.comparisonStatus}`],
      ['문항 확인',a.hasSurveyText?`엑셀 ${a.headerRow}행 / TXT ${a.surveyCount}문항 / 분석 대상 일치 ${a.matched}열`:`엑셀 ${a.headerRow}행의 문항명과 응답으로 분석 (TXT 미사용)`],
      ['익명화 탐지',`교수자 ${a.privacy.teachers}개 이름 / 교육생 ${a.privacy.participants}개 이름 (공유 전 수동 확인 필요)`],
      ['의견 분류 검토',`${a.reviewCount}건은 혼합 표현 또는 판단 유보 상태입니다.`],
      ['자료 처리',`합계·요약 ${a.skipped}행 및 선택한 설문 열이 빈 ${a.ignoredRows}행 제외`]
    ])+(a.warnings.length?'<div class="warning-box">'+a.warnings.map(w=>'<p>'+esc(w)+'</p>').join('')+'</div>':'')+'<p class="fine">원문에 없는 이유와 사례를 만들지 않습니다. 자료가 부족하면 충족 수량이 낮게 표시됩니다.</p>';
  }
  function renderQuestions(a){
    $('scoreMethod').textContent=`${a.scale}점 척도 / 긍정 ${((a.scale+1)/2)+1}~${a.scale}점, 개선 필요 1~${((a.scale+1)/2)-1}점. 분모는 문항별 유효 응답 수입니다. 빈칸과 0은 다르게 집계합니다.`;
    $('questionContent').innerHTML=table(['문항','평균','유효','긍정률','개선필요율','빈칸','0값','해당 없음','무효'],a.questions.map(q=>[q.header,fmt(q.avg),q.n,q.positive==null?'—':q.positive+'%',q.negative==null?'—':q.negative+'%',q.blank,q.zero,q.excluded,q.invalid]),['wide','num','num','num','num','num','num','num','num']);
  }
  function renderKeywords(a){$('keywordContent').innerHTML=table(['순위','키워드','빈도 (의견 수)','의미','근거 의견'],a.keywords.map((k,i)=>[i+1,k.name,k.frequency,k.meaning,k.evidence.join(', ')]),['num','','num','wide',''])+(a.keywords.length<10?'<p class="warning-box">확인 가능한 키워드는 '+a.keywords.length+'개입니다. 나머지는 근거 부족으로 생략했습니다.</p>':'');}
  function renderReasons(a){
    const labels=['긍정','중립','부정'];
    $('sentimentSummary').innerHTML='<div class="metrics">'+labels.map((l,i)=>'<div class="metric '+['pos','neu','neg'][i]+'">'+l+'<strong>'+a.counts[l]+'건</strong><small>'+ (a.comments.length?(a.counts[l]/a.comments.length*100).toFixed(1):'0.0')+'%</small></div>').join('')+'</div>';
    $('reasonContent').innerHTML=labels.map(l=>'<article class="reason-card"><h3>'+l+' 주요 사유</h3>'+a.reasons[l].map(r=>'<div class="reason"><strong>'+esc(r.topic)+' / '+r.count+'건</strong><p>'+esc(r.evidence.join(', '))+'</p><p class="quote">“'+esc(r.example)+'”</p></div>').join('')+(a.reasons[l].length<5?'<p class="fine">'+a.reasons[l].length+'개 확인 / 나머지는 근거 부족</p>':'')+'</article>').join('');
  }
  function renderOpinions(){
    const a=state.analysis;if(!a)return;const filter=$('opinionFilter').value;
    const cs=a.comments.filter(c=>filter==='all'||(filter==='review'?c.review&&!c.manual:c.label===filter));
    $('opinionContent').innerHTML=cs.length?cs.map(c=>'<article class="opinion-card"><div class="card-head"><strong>'+esc(c.id)+' / '+esc(c.respondent)+' <span class="tag'+(c.review&&!c.manual?' review':'')+'">'+(c.manual?'담당자 분류':c.review?'검토 필요':'자동 분류')+'</span></strong><select data-sentiment="'+esc(c.id)+'" aria-label="'+esc(c.id)+' 분류">'+['긍정','중립','부정'].map(l=>'<option'+(c.label===l?' selected':'')+'>'+l+'</option>').join('')+'</select></div><p class="evidence">'+esc(c.question)+'</p><p class="quote">'+esc(c.text)+'</p><p class="fine">'+esc(c.reason)+'</p></article>').join(''):'<div class="empty compact">해당하는 의견이 없습니다.</div>';
  }
  function renderImprovements(a){$('improvementContent').innerHTML=a.improvements.map((p,i)=>'<article class="improvement-card"><h3>'+ (i+1)+'. '+esc(p.title)+' <span class="tag">'+esc(p.kind)+'</span></h3><p class="evidence">'+esc(p.basis)+'</p><p class="quote">“'+esc(p.quote)+'”</p><p><strong>실행 검토안</strong> '+esc(p.action)+'</p></article>').join('')+(a.improvements.length<5?'<p class="warning-box">제안 '+a.improvements.length+'개 확인. 나머지는 근거 부족으로 보류했습니다.</p>':'');}
  function feedbackCount(){const a=state.analysis;if(!a)return;$('feedbackCount').textContent=`전체 ${a.feedback.length}명 / 서술형 의견이 있는 ${a.feedback.filter(f=>f.opinionIds.length).length}명 중 ${a.feedback.filter(f=>f.selected&&f.opinionIds.length).length}명 보고서 포함. 기본은 의견이 있는 응답 순서의 10명입니다.`;}
  function renderFeedback(a){
    feedbackCount();
    $('feedbackContent').innerHTML=a.feedback.map(f=>'<article class="feedback-card"><div class="card-head"><label class="check"><input type="checkbox" data-feedback-select="'+f.rowIndex+'"'+(f.selected?' checked':'')+(!f.opinionIds.length?' disabled':'')+'>'+esc(f.respondent)+' / 평균 '+fmt(f.average)+'</label><span class="tag" id="edited-'+f.rowIndex+'">'+(f.edited?'담당자 수정본':'자동 작성 초안')+'</span></div><p class="evidence">근거: '+esc(f.opinionIds.join(', ')||'서술형 의견 없음')+'</p>'+(f.opinionIds.length?'<label class="fine">피드백 메시지<textarea data-feedback-text="'+f.rowIndex+'" maxlength="3000" rows="5">'+esc(f.message)+'</textarea></label>':'<p class="fine">'+esc(f.message)+'</p>')+'</article>').join('');
  }
  function renderReport(){if(!state.analysis){$('reportPreview').innerHTML='<p>분석을 먼저 실행해주세요.</p>';return;}$('reportPreview').innerHTML=SurveyPDF.previewHtml(SurveyPDF.blocks(state.analysis,$('includeComments').checked));}
  function render(){
    const a=state.analysis;if(!a)return;
    $('kpiResponses').textContent=a.responses+'명';$('kpiAvg').textContent=fmt(a.avg)+' / '+a.scale;$('kpiQuestions').textContent=a.questions.length+'개';$('kpiComments').textContent=a.comments.length+'건';
    renderSummary(a);renderQuestions(a);renderKeywords(a);renderReasons(a);renderOpinions();renderImprovements(a);renderFeedback(a);if(!$('panel-report').hidden)renderReport();syncExport();
  }
  function showTab(name){
    document.querySelectorAll('.tab').forEach(b=>{const active=b.dataset.tab===name;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    document.querySelectorAll('.tab-panel').forEach(p=>p.hidden=p.id!=='panel-'+name);
    if(name==='report')renderReport();
  }
  function modified(){ $('privacyChecked').checked=false;syncExport();if(!$('panel-report').hidden)renderReport(); }
  async function loadOptionalText(){
    const token=++state.token;clearAnalysis();busy(true);state.survey='';
    const file=$('txtFile').files[0];
    try{
      if(file&&!/\.txt$/i.test(file.name))throw new Error('문항 파일은 .txt로 선택해주세요.');
      const text=file?await readText(file):'';if(token!==state.token)return;
      state.survey=text;$('txtName').textContent=file?file.name:'미선택 — 엑셀만으로 분석 가능';
      if(state.raw)mapping();else $('sourceInfo').textContent=text?'엑셀 선택 대기 / TXT 선택 대조 준비':'엑셀 문항 사용 / TXT 대조 생략';
      status(state.raw?'TXT 대조 설정이 변경되었습니다. 다시 분석해주세요.':'TXT 대조 파일을 읽었습니다. 응답 XLSX를 선택해주세요.','ok');
    }catch(err){
      if(token!==state.token)return;
      $('txtFile').value='';state.survey='';$('txtName').textContent='TXT 읽기 실패 — 선택 해제됨';
      if(state.raw)mapping();else $('sourceInfo').textContent='엑셀 문항 사용 / TXT 대조 생략';
      status((err.message||'TXT를 읽지 못했습니다.')+' TXT를 해제했습니다. 엑셀만으로 분석할 수 있습니다.','error');
    }finally{if(token===state.token)busy(false);}
  }
  $('txtFile').addEventListener('change',loadOptionalText);
  $('clearTxtBtn').addEventListener('click',()=>{if(state.busy)return;$('txtFile').value='';loadOptionalText();});
  $('xlsxFile').addEventListener('change',()=>loadFiles());
  $('sheetSelect').addEventListener('change',()=>loadFiles(Number($('sheetSelect').value)));
  $('encoding').addEventListener('change',()=>{if($('txtFile').files[0])loadOptionalText();});
  ['headerRow','scale','extraNames'].forEach(id=>$(id).addEventListener('change',()=>{clearAnalysis();state.roles=null;try{mapping();status('설정이 변경되었습니다. 다시 분석해주세요.');}catch(err){status(err.message,'error');}}));
  ['course','period'].forEach(id=>$(id).addEventListener('input',()=>{clearAnalysis();status('보고서 정보가 변경되었습니다. 다시 분석해주세요.');}));
  $('columnMapping').addEventListener('change',e=>{const target=e.target;if(!target.matches('[data-column]'))return;state.roles=Object.fromEntries(state.prepared.columns.map(c=>[c.index,c.role]));state.roles[Number(target.dataset.column)]=target.value;clearAnalysis();try{mapping();status('분석할 열을 변경했습니다. 다시 분석해주세요.');}catch(err){status(err.message,'error');}});
  $('runBtn').addEventListener('click',run);
  $('resetBtn').addEventListener('click',()=>{state.token++;state.raw=null;state.survey='';state.prepared=null;state.roles=null;state.demo=false;state.sheets=[];state.readWarnings=[];for(const id of ['txtFile','xlsxFile','course','period','extraNames'])$(id).value='';$('headerRow').value='1';$('scale').value='5';$('encoding').value='auto';$('txtName').textContent='미선택 — 엑셀만으로 분석 가능';$('xlsxName').textContent='선택되지 않음';$('sourceInfo').textContent='엑셀 문항 사용 / TXT 대조 생략';$('optionalTxt').open=false;$('settings').open=false;$('mappingCount').textContent='';$('columnMapping').innerHTML='<div class="empty compact">응답 파일을 선택해주세요.</div>';$('sheetSelect').innerHTML='<option>파일 선택 후 표시</option>';$('inputInfo').textContent='';$('includeComments').checked=false;$('demoBanner').hidden=true;clearAnalysis();busy(false);showTab('summary');status('현재 페이지의 자료와 분석 결과를 초기화했습니다. 이미 저장한 PDF는 삭제되지 않습니다.');});
  $('demoBtn').addEventListener('click',()=>{state.token++;clearAnalysis();state.demo=true;state.raw=structuredClone(SURVEY_DEMO.rows);state.survey='';state.roles=null;state.readWarnings=[];state.sheets=['가상 시연 응답'];$('txtFile').value='';$('xlsxFile').value='';$('extraNames').value='';$('scale').value='5';$('txtName').textContent='미선택 — 엑셀만으로 분석 가능';$('optionalTxt').open=false;$('xlsxName').textContent='내장 가상 응답 (실데이터 아님)';$('course').value='가상 교육과정 — 시연용';$('period').value='가상 설문';$('headerRow').value=String(E.detectHeader(state.raw)+1);$('sheetSelect').innerHTML='<option value="0">가상 시연 응답</option>';$('sheetSelect').disabled=true;$('demoBanner').hidden=false;mapping();run();});
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
  document.querySelector('.tabs').addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const tabs=Array.from(document.querySelectorAll('.tab')),i=tabs.indexOf(document.activeElement);let n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[n].focus();showTab(tabs[n].dataset.tab);});
  $('opinionFilter').addEventListener('change',renderOpinions);
  $('opinionContent').addEventListener('change',e=>{const id=e.target.dataset.sentiment;if(!id||!state.analysis)return;const c=state.analysis.comments.find(c=>c.id===id);if(!c)return;c.label=e.target.value;c.manual=true;c.review=false;c.reason='담당자가 분류를 확인하여 지정했습니다.';E.refresh(state.analysis);modified();render();status('의견 분류를 수정했습니다. 근거 요약과 미수정 피드백을 갱신했습니다.','ok');});
  $('feedbackContent').addEventListener('change',e=>{if(e.target.dataset.feedbackSelect==null||!state.analysis)return;const f=state.analysis.feedback[Number(e.target.dataset.feedbackSelect)];f.selected=e.target.checked;modified();feedbackCount();renderSummary(state.analysis);});
  $('feedbackContent').addEventListener('input',e=>{if(e.target.dataset.feedbackText==null||!state.analysis)return;const f=state.analysis.feedback[Number(e.target.dataset.feedbackText)];f.message=state.prepared.sanitizer.safe(e.target.value);f.edited=true;$('edited-'+f.rowIndex).textContent='담당자 수정본';modified();});
  $('feedbackContent').addEventListener('focusout',e=>{if(e.target.dataset.feedbackText==null||!state.analysis)return;const f=state.analysis.feedback[Number(e.target.dataset.feedbackText)];e.target.value=f.message;});
  $('selectTenBtn').addEventListener('click',()=>{if(!state.analysis)return;let n=0;state.analysis.feedback.forEach(f=>{f.selected=!!f.opinionIds.length&&n<10;if(f.selected)n++;});modified();renderFeedback(state.analysis);renderSummary(state.analysis);});
  $('includeComments').addEventListener('change',()=>{modified();renderReport();});$('privacyChecked').addEventListener('change',syncExport);
  $('exportBtn').addEventListener('click',async()=>{
    if(!state.analysis||!$('privacyChecked').checked||state.busy)return;
    const snapshot=structuredClone(state.analysis),include=$('includeComments').checked;
    const token=++state.token;busy(true);
    try{
      const {blob,pages}=await SurveyPDF.generate(snapshot,include,p=>status(`PDF 보고서를 작성하고 있습니다. ${p}%`));
      if(token!==state.token)return;
      const url=URL.createObjectURL(blob),link=document.createElement('a'),d=new Date(),pad=n=>String(n).padStart(2,'0');
      link.href=url;link.download=`강의평가_분석보고서_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.pdf`;
      document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      status(`${pages}쪽 PDF를 생성해 다운로드를 요청했습니다. 브라우저 다운로드 목록에서 확인해주세요.`,'ok');
    }catch(err){if(token===state.token)status('PDF 저장 실패: '+(err.message||'다시 시도해주세요.'),'error');}
    finally{if(token===state.token)busy(false);}
  });
})();
