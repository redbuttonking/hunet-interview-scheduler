// 다우오피스에서 실행할 북마크 코드 문자열을 생성하는 도우미

/** 시스템 주소에 연결되는 다우오피스 예약 감지 북마크 주소를 생성한다 */
export function createRoomBookmarkletHref(systemOrigin: string): string {
  const importUrl = `${systemOrigin.replace(/\/$/, '')}/bookmark-import`
  const script = [
    '(()=>{',
    `const D='https://hug.hunet.co.kr',I=${JSON.stringify(importUrl)},S='HUNET_ROOM_BOOKMARK';`,
    "if(location.origin!==D){alert('다우오피스에서만 실행할 수 있습니다.');return}",
    "if(window.__hunetRoomBookmark){alert('회의실 예약 동기화가 이미 대기 중입니다.');return}",
    'window.__hunetRoomBookmark=true;',
    "const P=window.open(I,'hunet-room-bookmark-import','popup,width=540,height=680');",
    "if(!P){alert('등록 확인 창을 열 수 없습니다. 팝업 차단을 해제해 주세요.');return}",
    "let ready=false,queued=[];const target=new URL(I).origin;",
    "const badge=document.createElement('div');badge.id='hunet-room-bookmark-badge';badge.textContent='휴넷 회의실 동기화 대기 중';badge.style.cssText='position:fixed;right:20px;bottom:20px;z-index:2147483647;padding:10px 14px;border-radius:8px;background:#191e28;color:#fff;font:600 13px sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.2)';document.body.appendChild(badge);",
    "const stop=()=>{window.__hunetRoomBookmark=false;window.__hunetRoomBookmarkDeliver=null;badge.remove()};",
    "const watcher=setInterval(()=>{if(!P.closed)return;clearInterval(watcher);stop()},500);",
    "const deliver=p=>{if(P.closed){stop();return}if(!ready){queued.push(p);return}P.postMessage({source:S,type:'RESERVATION',payload:p},target);badge.textContent='휴넷 회의실 예약 등록 확인 중'};window.__hunetRoomBookmarkDeliver=deliver;",
    "addEventListener('message',e=>{if(e.origin!==target||e.data?.source!==S)return;if(e.data.type==='CLOSED'){clearInterval(watcher);stop();return}if(e.data.type!=='READY')return;ready=true;const pending=queued;queued=[];pending.forEach(deliver)});",
    "const date=v=>String(v||'').split('T')[0],time=v=>{const m=String(v||'').match(/T(\\d{2}:\\d{2})/);return m?m[1]:'00:00'};",
    "const build=(method,url,text)=>{try{const j=JSON.parse(text);if(String(j.code)!=='200'||!j.data)return null;if((method==='POST'||method==='PUT')&&/\\/reserve(\\/\\d+)?$/.test(url)){const d=j.data;return{action:method==='POST'?'create':'update',externalId:Number(d.id),roomName:String(d.itemName||''),date:date(d.startTime),startTime:time(d.startTime),endTime:time(d.endTime)}}if(method==='DELETE'&&url.includes('/asset/item/reservation')){const a=Array.isArray(j.data)?j.data:[j.data];return a.map(x=>({action:'cancel',externalId:Number(x.id),roomName:String(x.name||'')}))}}catch(_){return null}return null};",
    "const result=p=>{const deliver=window.__hunetRoomBookmarkDeliver;(Array.isArray(p)?p:[p]).filter(Boolean).forEach(item=>deliver?.(item))};",
    "const install=w=>{try{if(!w||w.__hunetRoomBookmarkInstalled)return;w.__hunetRoomBookmarkInstalled=true;const X=w.XMLHttpRequest.prototype,O=X.open,N=X.send;X.open=function(m,u,...r){this.__hunetMethod=String(m||'').toUpperCase();this.__hunetUrl=String(u||'');return O.call(this,m,u,...r)};X.send=function(...a){if(this.__hunetUrl.includes('/api/asset/'))this.addEventListener('load',function(){if(this.status===200)result(build(this.__hunetMethod,this.__hunetUrl,this.responseText))});return N.apply(this,a)};const F=w.fetch;w.fetch=async function(input,init,...r){const u=typeof input==='string'?input:input?.url||'',m=String(init?.method||input?.method||'GET').toUpperCase(),res=await F.call(this,input,init,...r);if(u.includes('/api/asset/')&&res.ok)res.clone().text().then(t=>result(build(m,u,t)));return res}}catch(_){}};",
    "const scan=()=>{install(window);for(let i=0;i<window.frames.length;i++)try{install(window.frames[i])}catch(_){}};scan();const timer=setInterval(scan,1000);setTimeout(()=>clearInterval(timer),60000);",
    '})()',
  ].join('')
  return `javascript:${script}`
}
