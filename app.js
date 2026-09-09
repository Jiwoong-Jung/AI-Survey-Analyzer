(() => {
  'use strict';

  const el = id => document.getElementById(id);
  const state = { txtFile:null, xlsxFile:null, lastReport:'', analysis:null };

  el('txtFile').addEventListener('change', e => {
    state.txtFile = e.target.files?.[0] || null;
    el('txtName').textContent = state.txtFile ? state.txtFile.name : '선택되지 않음';
  });
  el('xlsxFile').addEventListener('change', e => {
    state.xlsxFile = e.target.files?.[0] || null;
    el('xlsxName').textContent = state.xlsxFile ? state.xlsxFile.name : '선택되지 않음';
  });

  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    el('tab-' + btn.dataset.tab).classList.add('active');
  }));

  function setStatus(msg, type=''){
    const s=el('status'); s.textContent=msg; s.className='status'+(type?' '+type:'');
  }

  function escapeHtml(v){
    return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function renderTable(targetId, rows, columns){
    const target=el(targetId);
    if(!rows || !rows.length){ target.innerHTML='<div class="empty">표시할 데이터가 없습니다.</div>'; return; }
    const cols=columns || Object.keys(rows[0]);
    const head=cols.map(c=>`<th>${escapeHtml(c)}</th>`).join('');
    const body=rows.map(r=>'<tr>'+cols.map(c=>{
      const val=r[c] ?? '';
      const numeric=(typeof val==='number') || ['평균','응답수','빈도'].includes(c);
      return `<td class="${numeric?'num':''}">${escapeHtml(val)}</td>`;
    }).join('')+'</tr>').join('');
    target.innerHTML=`<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function findHeaderRowIndex(rows){
    if(!rows.length) return 0;
    const limit=Math.min(10,rows.length); let bestIndex=0,bestScore=-1;
    const hint=/교수|교강사|강사|만족도|서술형|건의|의견|과제|출석|수업|강의|대상자|과정정보|제출일시/;
    for(let r=0;r<limit;r++){
      let nonEmpty=0, questionHints=0;
      for(const cell of rows[r]){
        const v=String(cell ?? '').trim(); if(!v) continue;
        nonEmpty++; if(hint.test(v)) questionHints++;
      }
      const score=nonEmpty*10+questionHints*4;
      if(nonEmpty>=2 && score>bestScore){bestScore=score;bestIndex=r;}
    }
    return bestIndex;
  }

  function toData(rows){
    if(!rows.length) return {headers:[],rows:[]};
    const headerRow=findHeaderRowIndex(rows);
    const maxCols=Math.max(...rows.map(r=>r.length));
    const headers=[];
    for(let i=0;i<maxCols;i++){
      let h=String(rows[headerRow]?.[i] ?? '').trim() || `열${i+1}`;
      const base=h; let k=2; while(headers.includes(h)) h=`${base} (${k++})`; headers.push(h);
    }
    const out=[];
    for(let r=headerRow+1;r<rows.length;r++){
      const arr=Array.from({length:maxCols},(_,c)=>String(rows[r]?.[c] ?? ''));
      if(!arr.some(v=>v.trim())) continue;
      const obj={}; headers.forEach((h,i)=>obj[h]=arr[i]); out.push(obj);
    }
    return {headers, rows:out};
  }

  function likertScore(v){
    const s=String(v ?? '').trim().replace(/\s+/g,' ');
    const map={'매우 그렇지 않다':1,'그렇지 않다':2,'보통이다':3,'그렇다':4,'매우 그렇다':5};
    if(map[s]) return map[s];
    const n=Number(s); return Number.isFinite(n)&&n>=1&&n<=5?n:null;
  }

  function category(header){
    const m=String(header).match(/^\[([^\]]+)\]/); if(m) return m[1];
    if(/교수|교강사|강사/.test(header)) return '교강사';
    return '기타';
  }

  function buildInstructorAliasMap(headers){
    const map=new Map(); let idx=0;
    for(const h of headers){
      const candidates=[];
      for(const m of h.matchAll(/\[([^\]]*(?:교수|교강사|강사)[^\]]*)\]/g)) candidates.push(m[1]);
      const lead=h.match(/^\s*([가-힣A-Za-z]{2,10})\s*(교수님?|강사님?|교강사)/); if(lead) candidates.push(lead[1]+' '+lead[2]);
      for(const c of candidates){
        const name=c.replace(/\s*(교수님?|강사님?|교강사).*?$/,'').trim();
        if(name && !/^[A-F]$/.test(name) && !map.has(name)) map.set(name,'교수자 '+String.fromCharCode(65+idx++));
      }
    }
    return map;
  }

  function regexEscape(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
  function protectInstructorNames(text, aliasMap){
    let out=String(text ?? '');
    for(const [name,alias] of aliasMap.entries()){
      const e=regexEscape(name);
      out=out.replace(new RegExp(e+'\\s*교수님?','g'),alias)
             .replace(new RegExp(e+'\\s*강사님?','g'),alias)
             .replace(new RegExp(e,'g'),alias);
    }
    return out;
  }

  function getKeywords(texts){
    const stop=new Set(['그리고','그러나','하지만','정말','너무','매우','수업','강의','교수','교수님','교수자','선생님','학생','과정','대한','있습니다','없습니다','좋습니다','좋았어요','좋았습니다','감사합니다','해주세요','하는','하고','해서','입니다','같습니다','부분','때문','조금','많이']);
    const freq=new Map();
    for(const t of texts){
      const words=(String(t).replace(/[^가-힣A-Za-z0-9 ]/g,' ').match(/[가-힣A-Za-z]{2,}/g)||[]).map(w=>w.toLowerCase());
      for(const w of words){ if(stop.has(w)) continue; freq.set(w,(freq.get(w)||0)+1); }
    }
    return [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([키워드,빈도])=>({키워드,빈도}));
  }

  function analyze(data, surveyText){
    const {headers,rows}=data; const aliasMap=buildInstructorAliasMap(headers);
    const questions=[], comments=[], feedback=[], allScores=[], commentTexts=[];
    let quantCount=0;

    for(const h of headers){
      const scores=rows.map(r=>likertScore(r[h])).filter(v=>v!==null);
      if(scores.length>=Math.max(2,Math.ceil(rows.length*0.3))){
        quantCount++; allScores.push(...scores);
        const avg=scores.reduce((a,b)=>a+b,0)/scores.length;
        const pos=scores.filter(s=>s>=4).length/scores.length*100;
        const neg=scores.filter(s=>s<=2).length/scores.length*100;
        const safe=protectInstructorNames(h,aliasMap);
        questions.push({구분:category(safe),문항:safe,평균:Number(avg.toFixed(2)),응답수:scores.length,긍정률:pos.toFixed(1)+'%',개선필요율:neg.toFixed(1)+'%'});
      }
    }

    rows.forEach((row,ri)=>{
      const label=`응답 ${String(ri+1).padStart(2,'0')}`; const rowScores=[], rowComments=[];
      for(const h of headers){
        const v=String(row[h] ?? ''); if(!v.trim()) continue;
        const sc=likertScore(v);
        if(sc!==null) rowScores.push(sc);
        else if(v.length>=4 && /서술|건의|의견|자유|기타|comment|feedback/i.test(h)){
          const safeV=protectInstructorNames(v,aliasMap); const safeH=protectInstructorNames(h,aliasMap);
          commentTexts.push(safeV); rowComments.push(safeV); comments.push({응답자:label,문항:safeH,의견:safeV});
        }
      }
      let avgTxt='-', fb='정량 응답이 충분하지 않습니다.';
      if(rowScores.length){
        const a=rowScores.reduce((x,y)=>x+y,0)/rowScores.length; avgTxt=Number(a.toFixed(2));
        if(a>=4.5) fb='전반적으로 매우 높은 만족도를 보였습니다. 현재의 강점을 유지하면서 서술형 의견이 있다면 세부 개선에 활용하면 좋습니다.';
        else if(a>=3.8) fb='전반적으로 긍정적인 평가입니다. 낮게 응답한 일부 문항과 서술형 의견을 중심으로 보완 포인트를 확인하면 좋습니다.';
        else if(a>=3.0) fb='보통 수준의 평가가 포함되어 있습니다. 전달 방식, 수업 운영, 상호작용 등 낮은 문항을 우선 점검하는 것이 좋습니다.';
        else fb='개선 필요 신호가 비교적 뚜렷합니다. 낮은 점수 문항과 서술형 의견을 함께 확인해 우선순위를 정하는 것이 좋습니다.';
        if(rowComments.length) fb+=' 서술형 의견이 있어 정성적 맥락도 함께 확인할 수 있습니다.';
      }
      feedback.push({응답자:label,평균점수:avgTxt,피드백:fb});
    });

    const keywords=getKeywords(commentTexts);
    const avgAll=allScores.length?Number((allScores.reduce((a,b)=>a+b,0)/allScores.length).toFixed(2)):0;
    const sorted=[...questions].sort((a,b)=>b.평균-a.평균); const best=sorted[0]||null; const worst=sorted.at(-1)||null;
    const summary=[
      {항목:'설문 문항 파일',결과:surveyText?'정상 불러옴':'미입력'},
      {항목:'응답자 수',결과:rows.length},
      {항목:'전체 평균',결과:allScores.length?`${avgAll} / 5.00`:'정량문항 없음'},
      {항목:'최고 평가 문항',결과:best?`${best.문항} (${best.평균})`:'-'},
      {항목:'우선 개선 문항',결과:worst?`${worst.문항} (${worst.평균})`:'-'},
      {항목:'서술형 의견 수',결과:comments.length}
    ];
    return {questions,comments,feedback,keywords,summary,avg:avgAll,quant:quantCount,commentCount:comments.length,responses:rows.length,best,worst};
  }

  async function readXlsxRows(file){
    if(typeof XLSX==='undefined') throw new Error('XLSX 분석 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 페이지를 새로고침해주세요.');
    const buf=await file.arrayBuffer();
    const wb=XLSX.read(buf,{type:'array',cellDates:false,raw:false});
    const ws=wb.Sheets[wb.SheetNames[0]];
    if(!ws) throw new Error('첫 번째 워크시트를 찾을 수 없습니다.');
    return XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false,blankrows:false});
  }

  function buildReport(a){
    const now=new Date(); const pad=n=>String(n).padStart(2,'0');
    const lines=['AI 강의평가 분석 보고서',`생성일시: ${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,'',
      `응답자 수: ${a.responses}`,`전체 평균: ${a.quant?a.avg:'-'} / 5`,`정량 문항 수: ${a.quant}`,`서술형 의견 수: ${a.commentCount}`,'','[문항별 분석]'];
    a.questions.forEach(r=>lines.push(`- [${r.구분}] ${r.문항} | 평균 ${r.평균} | 긍정률 ${r.긍정률} | 개선필요율 ${r.개선필요율}`));
    lines.push('','[핵심 키워드]'); a.keywords.forEach(r=>lines.push(`- ${r.키워드}: ${r.빈도}회`));
    lines.push('','[서술형 의견]'); a.comments.forEach(r=>lines.push(`- ${r.응답자} | ${r.문항} | ${r.의견}`));
    return lines.join('\r\n');
  }

  el('runBtn').addEventListener('click', async () => {
    try{
      if(!state.txtFile) throw new Error('설문 문항 TXT 파일을 먼저 선택해주세요.');
      if(!state.xlsxFile) throw new Error('응답 XLSX 파일을 먼저 선택해주세요.');
      setStatus('분석 중입니다...');
      const [surveyText, xlsxRows]=await Promise.all([state.txtFile.text(),readXlsxRows(state.xlsxFile)]);
      const data=toData(xlsxRows);
      if(!data.rows.length) throw new Error('응답 데이터가 없습니다. XLSX에서 문항명 행과 응답 행을 확인해주세요.');
      const a=analyze(data,surveyText); state.analysis=a; state.lastReport=buildReport(a);
      el('kpiResponses').textContent=a.responses; el('kpiAvg').textContent=a.quant?`${a.avg} / 5`:'-'; el('kpiQuestions').textContent=a.quant; el('kpiComments').textContent=a.commentCount;
      renderTable('summaryTable',a.summary,['항목','결과']);
      renderTable('questionTable',a.questions,['구분','문항','평균','응답수','긍정률','개선필요율']);
      renderTable('keywordTable',a.keywords,['키워드','빈도']);
      renderTable('commentTable',a.comments,['응답자','문항','의견']);
      renderTable('feedbackTable',a.feedback,['응답자','평균점수','피드백']);
      const best=a.best?.문항||'확인되지 않음';
      el('summaryText').textContent=`분석 완료 · 서술형 의견 ${a.commentCount}건 · 핵심 키워드 ${a.keywords.length}개 · 가장 높은 평가: ${best} · 교수자 실명은 자동 익명화됩니다 · 모든 데이터는 이 브라우저 내부에서 처리됩니다.`;
      setStatus('분석이 완료되었습니다.','ok');
    }catch(err){ setStatus(err.message||String(err),'error'); alert(err.message||String(err)); }
  });

  el('exportBtn').addEventListener('click', () => {
    if(!state.lastReport){ alert('먼저 분석을 실행해주세요.'); return; }
    const blob=new Blob(['\ufeff'+state.lastReport],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;
    const d=new Date(),pad=n=>String(n).padStart(2,'0');
    a.download=`강의평가_분석보고서_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.txt`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
})();
