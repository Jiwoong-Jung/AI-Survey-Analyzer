/* A4 보고서 레이아웃 + 의존성 없는 PDF 1.4 작성기.
 * 한글은 브라우저 글꼴로 캔버스에 그려 이미지형 PDF에 넣습니다.
 * 폰트/원문 파일을 PDF에 첨부하지 않으며 네트워크 요청을 하지 않습니다.
 */
(function(root){
  'use strict';
  const E=()=>root.SurveyEngine;
  const val=n=>n==null?'—':String(n);
  const para=text=>({type:'p',text:String(text)});
  const heading=text=>({type:'h2',text});
  const sub=text=>({type:'h3',text});
  const table=(headers,rows,widths)=>({type:'table',headers,rows,widths});
  function reportTime(iso){const d=new Date(iso);return Number.isNaN(d.getTime())?'시각 확인 필요':d.toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})+' (한국시간)';}
  function blocks(a,includeComments=false){
    const b=[{type:'title',text:'강의평가 분석 보고서'},para(`과정명: ${a.course}\n설문 기간: ${a.period}\n문항 출처: ${a.questionSource||'엑셀 문항 사용'} / ${a.comparisonStatus||'TXT 대조 생략'}\n분석 시각: ${reportTime(a.createdAt)}\n분석 방식: ${a.engine}`),
      heading('01  분석 개요'),table(['분석 대상','전체 평균','정량 문항','분석 가능 의견'],[[`${a.responses}명`,`${val(a.avg)} / ${a.scale}`,`${a.questions.length}개`,`${a.comments.length}건`]],[1,1,1,1]),
      para('전체 평균 = 모든 유효한 정량 점수의 합 ÷ 유효 점수 개수. 문항별 평균의 단순 평균과 다를 수 있습니다. 점수의 크기로 개인의 성향이나 역량을 판단하지 않습니다.'),
      table(['유효 점수','빈칸','0값 (척도 밖)','해당 없음','기타 무효값'],[[a.totals.valid,a.totals.blank,a.totals.zero,a.totals.excluded,a.totals.invalid]],[1,1,1,1,1]),
      para(`서술형 제외: 빈칸 ${a.commentStats.blank}건 / 내용 없는 응답 ${a.commentStats.nonresponse}건. ‘0’, ‘없음’ 등을 감정 분석의 중립 응답으로 넣지 않습니다.\n문항명 행: ${a.headerRow}행 / ${a.hasSurveyText?`TXT 인식 ${a.surveyCount}문항 / 분석 대상 일치 ${a.matched}열`:'엑셀 문항 사용 / TXT 대조 생략'}`),
      sub('구현 기준 대비 자료 충족 현황'),table(['항목','확인 수','기준','상태'],E().completion(a).map(c=>[c.name,c.actual,c.target,c.actual>=c.target?'충족':'근거/선택 부족']),[3,1,1,2]),
      para('기준 수량보다 자료가 적으면 부족분을 만들어내지 않습니다. 충족 표시는 결과물 수량 확인이며, 정확도 또는 심사 점수가 아닙니다.')];
    for(const w of a.warnings)b.push(para('확인 사항: '+w));
    b.push(heading('02  핵심 키워드'),para('주제 사전으로 유사 표현을 묶었습니다. 빈도는 해당 주제를 포함한 의견 셀 수이며 동일 의견에서 반복해도 1건입니다. 주제 간 중복 집계가 가능합니다.'),table(['키워드','빈도','의미','근거 의견'],a.keywords.map(k=>[k.name,k.frequency,k.meaning,k.evidence.join(', ')]),[1.3,.5,2.5,1.8]));
    if(a.keywords.length<10)b.push(para(`확인 가능한 키워드는 ${a.keywords.length}개입니다. 10개에 미달하는 나머지는 근거 부족으로 생략했습니다.`));
    b.push(heading('03  의견 분류와 주요 사유'),para('하나의 의견 셀은 긍정, 중립, 부정 중 한 범주에 포함합니다. 긍정과 부정 표현이 섞인 경우 우세 표현으로 임시 분류하고, 동일하면 중립으로 두어 검토 표시합니다. 분류는 담당자가 수정할 수 있습니다.'),table(['긍정','중립','부정','미검토 자동 판단'],[[a.counts['긍정'],a.counts['중립'],a.counts['부정'],a.reviewCount]],[1,1,1,1]));
    for(const label of ['긍정','중립','부정']){
      b.push(sub(label+' 의견의 주요 사유'));
      const rs=a.reasons[label];
      if(!rs.length)b.push(para('확인 가능한 사유가 없습니다.'));
      else b.push(table(['주제','의견 수','근거와 대표 표현'],rs.map(r=>[r.topic,r.count,r.evidence.join(', ')+'\n“'+r.example+'”']),[1.2,.5,4]));
      if(rs.length<5)b.push(para(`사유 ${rs.length}개 확인 / 기준 5개. 추가 사유는 근거 부족으로 생략했습니다.`));
    }
    b.push(para('사유는 해당 범주의 주제를 묶은 요약이며, 한 의견이 여러 주제에 해당할 수 있습니다. 대표 표현은 응답자의 의견이지 기관이 확인한 사실이 아닙니다.'),heading('04  교육과정 개선 방안'));
    a.improvements.forEach((p,i)=>b.push(sub(`${i+1}. ${p.title} [${p.kind}]`),para('분석 근거: '+p.basis),para('대표 의견/확인 사항: '+p.quote),para('실행 검토안: '+p.action)));
    if(a.improvements.length<5)b.push(para(`근거에 연결된 제안 ${a.improvements.length}개만 작성했습니다. 남은 항목은 추가 자료 확인 후 작성해야 합니다.`));
    b.push(heading('05  문항별 분석'),para(`${a.scale}점 척도 / 긍정률: ${(a.scale+1)/2+1}~${a.scale}점 / 개선필요율: 1~${(a.scale+1)/2-1}점. 두 비율의 분모는 각 문항의 유효 응답 수입니다.`),table(['문항','평균','유효','긍정 %','개선 %','빈칸','0값','해당 없음','무효'],a.questions.map(q=>[q.header,val(q.avg),q.n,val(q.positive),val(q.negative),q.blank,q.zero,q.excluded,q.invalid]),[4,.7,.6,.8,.8,.6,.6,.7,.6]));
    const selected=a.feedback.filter(f=>f.selected&&f.opinionIds.length);
    b.push(heading(`06  교육생 개인별 피드백 (${selected.length}명)`),para('아래 메시지는 익명 응답별 의견을 반영한 검토용 초안입니다. 익명 번호로 실제 응답자를 추적하거나 메시지를 자동 발송하지 않습니다. 개선 조치의 확정, 통보 또는 실제 상담 기록을 의미하지 않습니다.'));
    if(!selected.length)b.push(para('선택한 피드백이 없습니다.'));
    selected.forEach(f=>b.push(sub(`${f.respondent} / 평균 ${val(f.average)} / ${f.edited?'담당자 수정본':'자동 작성 초안'}`),para('근거: '+f.opinionIds.join(', ')),para(f.message)));
    if(includeComments){
      b.push(heading('부록  익명화한 전체 의견'),para('응답자의 경험과 주장입니다. 사실 여부를 확인한 자료로 간주하지 마세요.'));
      a.comments.forEach(c=>b.push(sub(`${c.id} / ${c.respondent} / ${c.label}${c.mixed?' (혼합 표현)':''}${c.manual?' / 담당자 분류':''}`),para(c.question),para(c.text)));
    }
    b.push(heading('분석 기준과 개인정보 처리'),para('본 도구는 외부 생성형 AI를 호출하지 않는 규칙 기반 분석입니다. 문맥, 반어, 복잡한 부정 표현, 사전에 없는 주제는 잘못 분류하거나 놓칠 수 있습니다. 사용자가 확인하고 수정한 결과도 원자료와 함께 검토해야 합니다.'),para('교수자 호칭과 대상자 열에서 찾은 이름, 추가 지정 단어, 일부 연락처·이메일·식별번호를 가립니다. 자동 익명화는 완전하지 않으므로 공유 전 재확인이 필요합니다. 원본 파일과 실명 대응표는 이 PDF에 첨부하지 않습니다.'),para('PDF는 생성 버튼을 누를 당시의 분석 결과를 사용하며 재분석하지 않습니다. 한글 표시를 위해 이미지형 PDF로 저장되어 텍스트 검색과 복사가 제한됩니다.'));
    return b;
  }
  function escape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function previewHtml(bs){return bs.map(b=>{
    if(b.type==='table')return '<div class="table-wrap"><table><thead><tr>'+b.headers.map(h=>'<th>'+escape(h)+'</th>').join('')+'</tr></thead><tbody>'+b.rows.map(r=>'<tr>'+r.map(v=>'<td>'+escape(v).replace(/\n/g,'<br>')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
    if(b.type==='title')return '<div class="report-title">'+escape(b.text)+'</div>';
    return '<'+(b.type==='p'?'p':b.type)+'>'+escape(b.text)+'</'+(b.type==='p'?'p':b.type)+'>';
  }).join('');}
  function jpegBytes(canvas){const url=canvas.toDataURL('image/jpeg',0.93);if(!url.startsWith('data:image/jpeg;'))throw new Error('이 브라우저의 PDF 이미지 변환을 지원하지 않습니다. Edge 또는 Chrome을 사용해주세요.');const b64=url.split(',')[1],binary=atob(b64);return Uint8Array.from(binary,c=>c.charCodeAt(0));}
  function pdfBlob(images){
    const enc=new TextEncoder(),parts=[],offsets=[0];let length=0;
    const put=v=>{const bytes=typeof v==='string'?enc.encode(v):v;parts.push(bytes);length+=bytes.length;};
    const obj=(id,body)=>{offsets[id]=length;put(`${id} 0 obj\n`);if(Array.isArray(body))body.forEach(put);else put(body);put('\nendobj\n');};
    put('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
    obj(2,`<< /Type /Pages /Count ${images.length} /Kids [${images.map((_,i)=>`${5+i*3} 0 R`).join(' ')}] >>`);
    images.forEach((im,i)=>{
      const imageId=3+i*3,contentId=imageId+1,pageId=imageId+2;
      obj(imageId,[`<< /Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`,im.bytes,'\nendstream']);
      const stream='q\n595.276 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';
      obj(contentId,`<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}endstream`);
      obj(pageId,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    });
    const count=3+images.length*3,xref=length;
    put(`xref\n0 ${count}\n0000000000 65535 f \n`);
    for(let i=1;i<count;i++)put(String(offsets[i]).padStart(10,'0')+' 00000 n \n');
    put(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts,{type:'application/pdf'});
  }
  async function generate(a,includeComments,onProgress=()=>{}){
    const bs=blocks(a,includeComments),images=[];
    const W=794,H=1123,M=45,BOTTOM=1058,BODY=W-2*M,SCALE=2;
    const FONT='"Malgun Gothic","Apple SD Gothic Neo","Noto Sans CJK KR","NanumGothic",sans-serif';
    let canvas,ctx,y,pageNo=0;
    function font(size=13,bold=false){ctx.font=(bold?'700 ':'400 ')+size+'px '+FONT;ctx.fillStyle='#23344b';}
    function finish(){if(!canvas)return;font(10);ctx.fillStyle='#65768b';ctx.fillText('경기인력개발원 | 강의평가 분석 | v'+a.version+' | 담당자 검토용',M,1090);ctx.textAlign='right';ctx.fillText(String(pageNo),W-M,1090);ctx.textAlign='left';images.push({bytes:jpegBytes(canvas),width:canvas.width,height:canvas.height});canvas.width=1;canvas.height=1;}
    function newPage(){finish();if(images.length>=100)throw new Error('PDF가 100쪽을 넘습니다. 전체 의견 부록이나 선택 피드백 수를 줄여주세요.');pageNo++;canvas=document.createElement('canvas');canvas.width=W*SCALE;canvas.height=H*SCALE;ctx=canvas.getContext('2d',{alpha:false});ctx.scale(SCALE,SCALE);ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);font(11,true);ctx.fillStyle='#17345f';ctx.fillText('강의평가 분석 보고서',M,40);ctx.textAlign='right';font(10);ctx.fillText(E().cut(a.course,37),W-M,40);ctx.textAlign='left';ctx.strokeStyle='#ccd7e5';ctx.beginPath();ctx.moveTo(M,53);ctx.lineTo(W-M,53);ctx.stroke();y=78;}
    function ensure(h){if(y+h>BOTTOM)newPage();}
    function wrap(value,width,size=13,bold=false){font(size,bold);const lines=[];for(const p of String(value??'').split('\n')){let line='';for(const ch of Array.from(p)){if(line&&ctx.measureText(line+ch).width>width){lines.push(line.trimEnd());line=ch;}else line+=ch;}lines.push(line);}return lines.length?lines:[''];}
    function text(value,size=13,bold=false,gap=8){const ls=wrap(value,BODY,size,bold),lh=size*1.65;for(const line of ls){ensure(lh);font(size,bold);ctx.fillText(line,M,y+size);y+=lh;}y+=gap;}
    function drawTable(b){
      const total=(b.widths||b.headers.map(()=>1)).reduce((s,n)=>s+n,0),widths=(b.widths||b.headers.map(()=>1)).map(w=>BODY*w/total);
      const head=b.headers.map((v,i)=>wrap(v,widths[i]-14,11,true));
      const hh=Math.max(...head.map(l=>l.length))*17+14;
      function header(){ensure(hh+31);let x=M;head.forEach((ls,i)=>{ctx.fillStyle='#eaf0f8';ctx.fillRect(x,y,widths[i],hh);font(11,true);ls.forEach((l,j)=>ctx.fillText(l,x+7,y+10+j*17+10));x+=widths[i];});y+=hh;}
      header();
      if(!b.rows.length){text('표시할 자료 없음',11,false,8);return;}
      for(let ri=0;ri<b.rows.length;ri++){
        const ls=b.rows[ri].map((v,i)=>wrap(v,widths[i]-14,11,false));
        const max=Math.max(...ls.map(l=>l.length));let offset=0;
        while(offset<max){
          const remaining=max-offset;
          if(y+Math.min(remaining*17+14,110)>BOTTOM){newPage();header();}
          const fit=Math.max(1,Math.floor((BOTTOM-y-14)/17));
          const n=Math.min(remaining,fit),rh=n*17+14;
          let x=M;
          for(let ci=0;ci<widths.length;ci++){
            ctx.fillStyle=ri%2===0?'#ffffff':'#f6f8fb';ctx.fillRect(x,y,widths[ci],rh);font(11);
            for(let k=0;k<n;k++)if(ls[ci][offset+k]!=null)ctx.fillText(ls[ci][offset+k],x+7,y+21+k*17);
            x+=widths[ci];
          }
          ctx.strokeStyle='#dbe2ec';ctx.beginPath();ctx.moveTo(M,y+rh);ctx.lineTo(W-M,y+rh);ctx.stroke();y+=rh;offset+=n;
          if(offset<max){newPage();header();}
        }
      }
      y+=14;
    }
    newPage();
    for(let i=0;i<bs.length;i++){
      const b=bs[i];
      if(b.type==='title'){ensure(70);text(b.text,28,true,12);}
      else if(b.type==='h2'){ensure(86);y+=12;ctx.fillStyle='#17345f';ctx.fillRect(M,y,4,22);y+=2;const ls=wrap(b.text,BODY-12,18,true);ls.forEach(line=>{font(18,true);ctx.fillText(line,M+12,y+18);y+=29;});y+=8;}
      else if(b.type==='h3'){
        // Keep each feedback/improvement heading with its short associated paragraphs.
        let groupHeight=wrap(b.text,BODY,14,true).length*14*1.65+5;
        for(let j=i+1;j<bs.length&&bs[j].type==='p';j++)groupHeight+=wrap(bs[j].text,BODY,13,false).length*13*1.65+8;
        ensure(groupHeight<=BOTTOM-78?Math.max(65,groupHeight):65);
        text(b.text,14,true,5);
      }
      else if(b.type==='table')drawTable(b);
      else text(b.text);
      if(i%8===0){onProgress(Math.round((i+1)/bs.length*100));await new Promise(r=>setTimeout(r,0));}
    }
    finish();const blob=pdfBlob(images);return {blob,pages:images.length};
  }
  root.SurveyPDF={blocks,previewHtml,generate};
})(globalThis);
