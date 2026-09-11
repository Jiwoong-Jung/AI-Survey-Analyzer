/* 일반 .xlsx ZIP/XML을 브라우저 기본 기능으로 읽습니다. 외부 라이브러리/서버 없음.
 * 지원: SharedStrings/inlineStr, 숫자, 문자열, 수식의 저장된 결과값, 다중 시트.
 * 미지원: .xls/.xlsb/.xlsm, 암호화, ZIP64, 매크로, 수식 재계산.
 */
(function(root){
  'use strict';
  const MAX_FILE=10*1024*1024, MAX_XML=16*1024*1024, MAX_TOTAL=64*1024*1024;
  const decoder=new TextDecoder('utf-8',{fatal:true});
  const CRC_TABLE=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
  function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=CRC_TABLE[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
  function xml(text){
    if(/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('외부 엔터티가 포함된 XML은 지원하지 않습니다.');
    const doc=new DOMParser().parseFromString(text,'application/xml');
    if(doc.getElementsByTagName('parsererror').length)throw new Error('XLSX 내부 XML이 손상되었습니다. Excel에서 다시 저장해주세요.');
    return doc;
  }
  const nodes=(d,n)=>Array.from(d.getElementsByTagNameNS('*',n));
  function zipDirectory(buffer){
    if(buffer.byteLength>MAX_FILE)throw new Error('XLSX는 10MB 이하만 지원합니다. 파일을 나누어주세요.');
    const view=new DataView(buffer), bytes=new Uint8Array(buffer);
    let eocd=-1;
    for(let p=buffer.byteLength-22;p>=Math.max(0,buffer.byteLength-65557);p--){
      if(view.getUint32(p,true)===0x06054b50&&p+22+view.getUint16(p+20,true)===buffer.byteLength){eocd=p;break;}
    }
    if(eocd<0)throw new Error('일반 XLSX 파일이 아닙니다. 암호가 없는 .xlsx 형식으로 다시 저장해주세요.');
    const count=view.getUint16(eocd+10,true),start=view.getUint32(eocd+16,true),size=view.getUint32(eocd+12,true);
    if(count===65535||start===0xffffffff||size===0xffffffff||view.getUint16(eocd+4,true)||view.getUint16(eocd+6,true))throw new Error('분할 ZIP 또는 ZIP64 파일은 지원하지 않습니다.');
    if(count>2000||start+size>eocd)throw new Error('파일 구조 또는 크기가 지원 범위를 벗어났습니다.');
    const entries=new Map();let p=start,total=0;
    for(let n=0;n<count;n++){
      if(p+46>eocd||view.getUint32(p,true)!==0x02014b50)throw new Error('XLSX ZIP 목록이 손상되었습니다.');
      const flags=view.getUint16(p+8,true),method=view.getUint16(p+10,true),crc=view.getUint32(p+16,true),compressed=view.getUint32(p+20,true),raw=view.getUint32(p+24,true),nl=view.getUint16(p+28,true),el=view.getUint16(p+30,true),cl=view.getUint16(p+32,true),offset=view.getUint32(p+42,true);
      if(p+46+nl+el+cl>eocd)throw new Error('ZIP 목록의 길이가 올바르지 않습니다.');
      const name=decoder.decode(bytes.subarray(p+46,p+46+nl));
      total+=raw;
      if(flags&1)throw new Error('암호화된 파일은 읽을 수 없습니다.');
      if(raw>MAX_XML||total>MAX_TOTAL||entries.has(name))throw new Error('압축 해제 크기가 너무 크거나 파일 구조가 중복되었습니다.');
      entries.set(name,{name,method,crc,compressed,raw,offset});p+=46+nl+el+cl;
    }
    async function read(name,required=true){
      const e=entries.get(name);if(!e){if(required)throw new Error('XLSX 필수 구성요소를 찾지 못했습니다: '+name);return null;}
      if(e.offset+30>bytes.length||view.getUint32(e.offset,true)!==0x04034b50)throw new Error('ZIP 항목이 손상되었습니다.');
      const at=e.offset+30+view.getUint16(e.offset+26,true)+view.getUint16(e.offset+28,true);
      if(at+e.compressed>start)throw new Error('ZIP 항목 범위가 올바르지 않습니다.');
      let output;
      if(e.method===0)output=bytes.slice(at,at+e.compressed);
      else if(e.method===8){
        let ds;try{ds=new DecompressionStream('deflate-raw');}catch{throw new Error('이 브라우저는 XLSX 압축 해제를 지원하지 않습니다. 최신 Edge 또는 Chrome으로 접속해주세요.');}
        const reader=new Blob([bytes.subarray(at,at+e.compressed)]).stream().pipeThrough(ds).getReader();
        const chunks=[];let length=0;
        const timer=setTimeout(()=>reader.cancel('압축 해제 제한 시간 초과'),20000);
        try{
          while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>MAX_XML||length>e.raw){await reader.cancel();throw new Error('압축 해제 크기가 허용 범위를 넘었습니다.');}chunks.push(value);}
        }finally{clearTimeout(timer);}
        output=new Uint8Array(length);let pos=0;chunks.forEach(c=>{output.set(c,pos);pos+=c.length;});
      }else throw new Error('지원하지 않는 ZIP 압축 방식입니다. Excel에서 XLSX로 다시 저장해주세요.');
      if(output.length!==e.raw||crc32(output)!==e.crc)throw new Error('파일 무결성 검사에 실패했습니다. 원본을 다시 저장해주세요.');
      return decoder.decode(output);
    }
    return {read,entries};
  }
  function resolvePath(target){
    if(/^\w+:/.test(target))throw new Error('외부 연결 시트는 지원하지 않습니다.');
    const parts=(target.startsWith('/')?target.slice(1):'xl/'+target).split('/'),out=[];
    for(const p of parts){if(p==='..')out.pop();else if(p&&p!=='.')out.push(p);}
    const path=out.join('/');if(!path.startsWith('xl/'))throw new Error('지원하지 않는 시트 경로입니다.');return path;
  }
  function richText(element){
    return Array.from(element.children).filter(n=>n.localName==='t'||n.localName==='r').map(n=>n.localName==='t'?n.textContent:nodes(n,'t').map(x=>x.textContent).join('')).join('');
  }
  async function read(buffer,requestedIndex=null){
    const zip=zipDirectory(buffer);
    const [workbook,rels]=await Promise.all([zip.read('xl/workbook.xml'),zip.read('xl/_rels/workbook.xml.rels')]);
    const relationship=new Map(nodes(xml(rels),'Relationship').filter(n=>n.getAttribute('TargetMode')!=='External').map(n=>[n.getAttribute('Id'),resolvePath(n.getAttribute('Target')||'')]));
    const sheetNodes=nodes(xml(workbook),'sheet');
    const sheets=sheetNodes.map(n=>({name:n.getAttribute('name')||'시트',state:n.getAttribute('state')||'visible',path:relationship.get(n.getAttribute('r:id')||n.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'))}));
    if(!sheets.length)throw new Error('워크시트가 없습니다.');
    const index=requestedIndex==null?Math.max(0,sheets.findIndex(s=>s.state==='visible')):Number(requestedIndex);
    if(!sheets[index]||!sheets[index].path)throw new Error('선택한 워크시트를 읽을 수 없습니다.');
    const [ss,ws]=await Promise.all([zip.read('xl/sharedStrings.xml',false),zip.read(sheets[index].path)]);
    const strings=ss?nodes(xml(ss),'si').map(richText):[];
    const rows=[],warnings=[];let cellCount=0,uncached=0;
    for(const row of nodes(xml(ws),'row')){
      const ri=Number(row.getAttribute('r'))-1;
      if(!Number.isInteger(ri)||ri<0||ri>=3002)throw new Error('워크시트는 3,002행 이내로 정리해주세요.');
      const cells=[];
      for(const c of Array.from(row.children).filter(n=>n.localName==='c')){
        const address=c.getAttribute('r')||'',m=address.match(/^([A-Z]+)\d+$/);
        if(!m)throw new Error('셀 주소가 올바르지 않습니다.');
        let ci=0;for(const l of m[1])ci=ci*26+l.charCodeAt(0)-64;ci--;
        if(ci>=200||++cellCount>250000)throw new Error('200열 또는 250,000셀을 초과했습니다. 필요한 설문 범위만 남겨주세요.');
        const v=nodes(c,'v')[0]?.textContent??'',type=c.getAttribute('t');let value='';
        if(type==='s'){const si=Number(v);if(!/^\d+$/.test(v)||si>=strings.length)throw new Error('공유 문자열 인덱스가 잘못되었습니다.');value=strings[si];}
        else if(type==='inlineStr'){const inline=nodes(c,'is')[0];value=inline?richText(inline):'';}
        else if(type==='e')value='[엑셀 오류: '+v+']';
        else value=v; // 빈 값과 문자열 '0'을 구분. 원시값을 수식으로 실행하지 않음.
        if(nodes(c,'f').length&&!nodes(c,'v').length)uncached++;
        if(value.length>10000)throw new Error('한 셀의 내용이 10,000자를 넘습니다. 내용을 나누어주세요.');
        cells[ci]=value;
      }
      rows[ri]=cells;
    }
    for(let i=0;i<rows.length;i++)if(!rows[i])rows[i]=[];
    if(uncached)warnings.push(`저장된 계산 결과가 없는 수식 ${uncached}개를 빈 값으로 읽었습니다. Excel에서 계산 후 저장해주세요.`);
    return {rows,sheetNames:sheets.map(s=>s.name),sheetIndex:index,warnings};
  }
  root.LocalXLSX={read,MAX_FILE};
})(globalThis);
