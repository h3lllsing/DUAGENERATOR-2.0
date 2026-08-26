let duas=[], busy=false, searchTerm='', activeCat='All';
let forceFlags={}, lastGridKey='', prevStep=null, barHidden=false, editingId=null;
var EXPERT=/[?&]expert=1/.test(location.search);
if(EXPERT){document.querySelectorAll('.js-expert').forEach(function(el){el.style.display='';});}
const THEME_LABEL={dark:'Dark Gold',mosque:'Mosque Night',sunset:'Sunset Dawn',manuscript:'Manuscript',emerald:'Emerald Pattern',ocean:'Ocean Night',desert:'Desert Gold',royal:'Royal Purple'};
const VOICE_PAIRS={'Hamed + Asad':['ar-SA-HamedNeural','ur-PK-AsadNeural'],'Zariyah + Uzma':['ar-SA-ZariyahNeural','ur-PK-UzmaNeural']};
function setThemeSel(v){
  document.querySelectorAll('#themegrid .topt').forEach(l=>{
    const on=l.dataset.v===v;
    l.classList.toggle('on',on);
    l.querySelector('input').checked=on;
  });
}
async function load(){
  const r=await fetch('/api/duas'); const j=await r.json(); duas=j.duas; buildChips(); render(); stats(); ytRenderPicker();
}
function stats(){
  const done=duas.filter(d=>d.videoFile).length;
  document.getElementById('statline').innerHTML='<b>'+done+'</b> / '+duas.length+' Rendered';
  const pct=duas.length?Math.round(done*100/duas.length):0;
  document.getElementById('ring').style.setProperty('--p',pct+'%');
  document.getElementById('ringtxt').textContent=pct+'%';
}
function buildChips(){
  const cats=['All',...new Set(duas.map(d=>d.category))];
  document.getElementById('chips').innerHTML=cats.map(c=>
    '<button class="chip'+(c===activeCat?' on':'')+'" onclick="setCat(\''+c+'\')">'+c+'</button>').join('');
}
function setCat(c){ activeCat=c; buildChips(); render(); }
function onSearch(v){ searchTerm=v.trim().toLowerCase(); render(); }
function filtered(){
  return duas.filter(d=>{
    const okCat=activeCat==='All'||d.category===activeCat;
    const q=searchTerm;
    const okQ=!q||d.title.toLowerCase().includes(q)||(d.reference||'').toLowerCase().includes(q)||d.id.includes(q);
    return okCat&&okQ;
  });
}
var ytPollT=null,ytWasRunning=false,ytWasAuth=false;
function ytToggle(){
  var p=document.getElementById('ytpanel');
  var show=p.style.display==='none';
  p.style.display=show?'block':'none';
  if(show){ ytRenderPicker(); ytRefresh(); }
}
function ytEsc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function ytEnsurePoll(){
  if(!ytPollT) ytPollT=setInterval(ytRefresh,1500);
}
function ytAuthBadgeHtml(c){
  if(c.auth==='ok') return '<span style="color:#56d364">&#9679; logged in</span>';
  if(c.auth==='unverified') return '<span style="color:#d4af37">&#9679; token?</span>';
  return '<span style="color:#ff7676">&#9679; not logged in</span>';
}
function ytSecToggle(btnId,secId){
  var b=document.getElementById(btnId);
  var s=document.getElementById(secId);
  var open=s.style.display==='none';
  s.style.display=open?'block':'none';
  b.textContent=b.textContent.replace(open?'\u{25B8}':'\u{25BE}',open?'\u{25BE}':'\u{25B8}');
}
function ytAdvToggle(){ ytSecToggle('yt_advbtn','yt_adv'); }
function ytAccToggle(){ ytSecToggle('yt_logaccbtn','yt_log'); }
function ytCopyFallback(t){
  var ta=document.createElement('textarea');
  ta.value=t;
  document.body.appendChild(ta);
  ta.select();
  try{document.execCommand('copy');}catch(e){}
  document.body.removeChild(ta);
}
function ytCopyLinks(){
  var links=window.ytLastLinks||[];
  if(!links.length){toast('Abhi koi YouTube link maujood nahi - pehle upload karo','err');return;}
  var txt=links.map(function(x){return x.title+' - '+x.url;}).join('\\n');
  var done=function(){toast(links.length+' links copy ho gaye - ready to share!','ok');};
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done,function(){ytCopyFallback(txt);done();});
  } else { ytCopyFallback(txt);done(); }
}
async function ytRefresh(){
  try{
    const r=await fetch('/api/youtube/status'); if(!r.ok)return;
    const j=await r.json();
    const sp=document.getElementById('yt_secret_pill');
    sp.textContent='client_secret: '+(j.clientSecret?('FOUND'+(j.secretInfo?' ('+j.secretInfo+')':'')):'MISSING');
    sp.style.borderColor=j.clientSecret?'#2ea043':'#6b2737';
    const cb=document.getElementById('yt_cred_badge');
    const cr=j.creds&&j.creds.present;
    cb.textContent='credentials: '+(cr?('SET '+(j.creds.maskedClientId||'')):'NOT SET');
    cb.style.borderColor=cr?'#2ea043':'#6b2737';
    const cidInp=document.getElementById('yt_cid');
    cidInp.placeholder=(cr&&j.creds.maskedClientId)?('saved: '+j.creds.maskedClientId):'Client ID (....apps.googleusercontent.com)';
    var ms=[];
    ['channel1','channel2'].forEach(function(ch,i){
      const c=(j.channels&&j.channels[ch])||{};
    var ch=window.ytCh&&window.ytCh[c];
    var qu=(ch&&typeof ch.quotaUploadsToday==='number')?ch.quotaUploadsToday:null;
    var suffix=(qu!==null)?(' \u00b7 Quota '+qu+'/5'):'';
    if(c.auth==='ok') ms.push('\u{1F7E2} Channel '+(i+1)+': Ready'+suffix);
    else if(c.auth==='unverified') ms.push('\u{1F7E1} Channel '+(i+1)+': Token check'+suffix);
    else ms.push('\u{1F534} Channel '+(i+1)+': Setup needed'+suffix);
    });
    var needSetup=(j.channels&&(j.channels.channel1||{}).auth!=='ok')||(j.channels&&(j.channels.channel2||{}).auth!=='ok');
    document.getElementById('yt_mainstatus').innerHTML=ms.join(' &nbsp;&middot;&nbsp; ')
      +(needSetup?'<div class="aihint no" style="margin:4px 0 0">Channel setup ke liye neeche \u2699 Advanced Setup kholo</div>':'');
    ['channel1','channel2'].forEach(ch=>{
      const c=(j.channels&&j.channels[ch])||{};
      const el=document.getElementById('yt_authst_'+ch);
      const running=j.auth&&j.auth.running&&j.auth.channel===ch;
      el.innerHTML=running?'<span style="color:#d4af37">&#9679; consent window khula...</span>':ytAuthBadgeHtml(c);
    });
    var lg=document.getElementById('yt_log');
    var tail=null;
    if(j.job&&j.job.running) tail=j.job.logTail;
    else if(j.auth&&j.auth.running) tail=j.auth.logTail;
    else{
      var jt=(j.job&&j.job.finishedAt)||0, at=(j.auth&&j.auth.finishedAt)||0;
      tail=jt>=at?(j.job&&j.job.logTail):(j.auth&&j.auth.logTail);
    }
    if(tail&&tail.length){
      lg.textContent=tail.join('\\n');
      lg.scrollTop=lg.scrollHeight;
    }
    var rows=[];
    ['channel1','channel2'].forEach(ch=>{
      const list=(j.channels&&j.channels[ch]&&j.channels[ch].recent)||[];
      list.forEach(u=>rows.push({ch:ch,u:u}));
    });
    rows.sort((a,b)=>String(b.u.uploadedAt||'').localeCompare(String(a.u.uploadedAt||'')));
    const tb=document.getElementById('yt_tbody');
    if(rows.length){
      tb.innerHTML=rows.slice(0,12).map((x,i)=>{
        const link=x.u.url?'<a href="'+x.u.url+'" target="_blank" style="color:#58a6ff">youtu.be/'+ytEsc(x.u.videoId)+'</a>':'-';
        return '<tr>'
          +'<td style="padding:6px;border-bottom:1px solid #232c3b;color:#8b93a3">'+(i+1)+'</td>'
          +'<td style="padding:6px;border-bottom:1px solid #232c3b">'+ytEsc(x.u.title)+'</td>'
          +'<td style="padding:6px;border-bottom:1px solid #232c3b;color:#8b93a3">'+(x.ch==='channel1'?'Ch 1':'Ch 2')+'</td>'
          +'<td style="padding:6px;border-bottom:1px solid #232c3b">'+link+'</td>'
          +'<td style="padding:6px;border-bottom:1px solid #232c3b;color:#8b93a3">'+ytEsc(x.u.privacy||'')+'</td>'
          +'</tr>';
      }).join('');
    } else {
      tb.innerHTML='<tr><td colspan="5" style="color:#8b93a3;padding:8px">koi upload nahi</td></tr>';
    }
    window.ytLastLinks=rows.filter(function(x){return x.u.url;})
      .map(function(x){return {title:x.u.title,url:x.u.url};});
    var pg=document.getElementById('yt_progress');
    var jb=j.job||{};
    if(jb.running){
      pg.style.display='block';
      var t=jb.total||0,d=jb.done||0;
      pg.innerHTML='\u{23F3} Uploading Video '+Math.min(d+1,t||1)+' of '+(t||'?')+'... Please wait '
        +'<button onclick="ytCancelReq()" style="margin-left:10px;background:#3a1520;color:#ff7b72;border:1px solid #6b2737;border-radius:8px;padding:4px 12px;font-size:11px;cursor:pointer">\u{23F9} CANCEL</button>';
    } else if(j.auth&&j.auth.running){
      pg.style.display='block';
      pg.innerHTML='\u{1F511} Google login window khuli hai - browser me account choose karke allow karo...';
    } else if(jb.code!==null&&jb.code!==undefined&&(jb.videos||[]).length){
      pg.style.display='block';
      pg.innerHTML=(jb.code===0?'\u{2705} ':'\u{26A0}\u{FE0F} ')+'Run complete - '+jb.videos.length+' video(s). Links neeche table me hain.';
    } else {
      pg.style.display='none';
    }
    window.ytCh=j.channels||{};
    var up=j.uploadedIds||[];
    if(JSON.stringify(up)!==JSON.stringify(window.ytUploadedIds||[])){
      window.ytUploadedIds=up;
      if(typeof ytRenderPicker==='function') ytRenderPicker();
    }
    ytApplyJob(j.job||{},j.auth||{});
  }catch(e){}
}
function ytApplyJob(job,auth){
  ytBusy=!!(job.running||auth.running);
  document.getElementById('yt_auth_channel1').disabled=!!auth.running;
  document.getElementById('yt_auth_channel2').disabled=!!auth.running;
  document.getElementById('yt_save_secret').disabled=ytBusy;
  document.getElementById('yt_savecred').disabled=ytBusy;
  ytUpdateCount();
  if(ytWasRunning&&!job.running){
    const n=(job.videos||[]).length;
    toast(n?('Upload done: '+n+' video(s) uploaded'):'Upload finished', job.code===0?'ok':'err');
    ytRefresh();
  }
  if(ytWasAuth&&!auth.running){
    toast(auth.code===0?'Token save ho gaya - channel ready!':'Auth fail hua - logs dekho', auth.code===0?'ok':'err');
  }
  ytWasRunning=!!job.running;
  ytWasAuth=!!auth.running;
  if(job.running||auth.running){ ytEnsurePoll(); }
  else if(ytPollT){ clearInterval(ytPollT); ytPollT=null; }
}
window.addEventListener('beforeunload',function(){
  if(window.ytPollT){ clearInterval(window.ytPollT); window.ytPollT=null; }
});
window.addEventListener('beforeunload',function(e){
  var renderOn=(typeof busy!=='undefined'&&busy);
  var uploadOn=(typeof ytBusy!=='undefined'&&ytBusy);
  if(renderOn||uploadOn){
    e.preventDefault();
    e.returnValue='Process chal raha hai - page chhorte ho?';
  }
});
async function ytSaveCreds(){
  const cid=document.getElementById('yt_cid').value.trim();
  const cs=document.getElementById('yt_cs').value.trim();
  if(!cid||!cs){toast('Client ID aur Client Secret dono bharo','err');return;}
  const badge=document.getElementById('yt_cred_badge').textContent;
  if(badge.indexOf('SET')>=0&&!confirm('Credentials pehle se set hain. Overwrite karoon?'))return;
  try{
    const r=await fetch('/api/youtube/settings',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({clientId:cid,clientSecret:cs})});
    const j=await r.json();
    if(!j.ok){toast(j.error||'Save fail','err');return;}
    toast('Credentials saved ('+j.maskedClientId+')','ok');
    document.getElementById('yt_cs').value='';
    document.getElementById('yt_cid').value='';
    ytRefresh();
  }catch(e){toast('Network error','err');}
}
function ytUploadSecret(){
  const inp=document.getElementById('yt_file');
  const f=inp.files&&inp.files[0];
  if(!f){toast('Pehle client_secret.json choose karo','err');return;}
  const fr=new FileReader();
  fr.onload=async function(){
    let parsed=null;
    try{parsed=JSON.parse(fr.result);}catch(e){}
    if(!parsed||typeof parsed!=='object'||(!parsed.installed&&!parsed.web)){
      toast('Ye Google OAuth client_secret file nahi lagti','err');return;
    }
    if(document.getElementById('yt_secret_pill').textContent.indexOf('FOUND')>=0
      &&!confirm('client_secret.json pehle se maujood hai. Overwrite karoon?'))return;
    try{
      const r=await fetch('/api/youtube/secret',{method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({content:fr.result})});
      const j=await r.json();
      if(!j.ok){toast(j.error||'Save fail','err');return;}
      toast('Secret saved'+(j.project?' ('+j.project+')':''),'ok');
      inp.value='';
      document.getElementById('yt_filename').textContent='';
      ytRefresh();
    }catch(e){toast('Network error','err');}
  };
  fr.readAsText(f);
}
document.addEventListener('change',function(e){
  if(e.target&&e.target.id==='yt_file'&&e.target.files[0]){
    document.getElementById('yt_filename').textContent=e.target.files[0].name;
  }
});
async function ytAuth(ch){
  const pill=document.getElementById('yt_secret_pill').textContent;
  if(pill.indexOf('MISSING')>=0){
    toast('Pehle STEP 1 me client_secret.json save karo','err');return;
  }
  if(!confirm(ch+' ke liye Google login shuru karoon? Browser window khulegi, apna account choose karke allow karo.'))return;
  try{
    const r=await fetch('/api/youtube/auth',{method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({channel:ch})});
    const j=await r.json();
    if(!j.ok){toast(j.error||'Auth start fail','err');return;}
    toast('Consent window browser me khul gayi - allow karo','ok');
    ytWasAuth=true;
    ytEnsurePoll();
    ytRefresh();
  }catch(e){toast('Network error','err');}
}
var ytBusy=false,ytSel={};
function ytUpdateCount(){
  var n=Object.keys(ytSel).length;
  document.getElementById('yt_pickcount').textContent='Selected: '+n+' / 6';
  var b=document.getElementById('yt_start');
  b.disabled=(ytBusy||n===0||n>6);
  b.textContent='\u{1F680} UPLOAD SELECTED ('+n+') VIDEOS';
}
function ytRenderPicker(){
  var q=(document.getElementById('yt_picksearch').value||'').toLowerCase();
  var rows=(typeof duas!=='undefined'?duas:[]).filter(function(d){
    if(!d.videoFile) return false;
    return !q||d.title.toLowerCase().includes(q)||d.id.toLowerCase().includes(q);
  });
  var keys=Object.keys(ytSel);
  document.getElementById('yt_picklist').innerHTML=rows.length?rows.map(function(d){
    var on=!!ytSel[d.id];
    var pos=on?(keys.indexOf(d.id)+1):null;
    return '<div onclick="ytToggleDua(\''+d.id+'\')" style="position:relative;background:'+(on?'#1c2431':'#151b26')+';border:2px solid '+(on?'#d4af37':'#2a3345')+';border-radius:12px;padding:12px 10px;cursor:pointer;user-select:none">'
      +'<span style="color:#8b93a3;font-size:10px">'+ytEsc(d.id)+'</span>'
       +'<div style="font-size:12.5px;color:#e6e2d2;margin-top:4px;line-height:1.35">'+ytEsc(d.title)+'</div>'
      +((window.ytUploadedIds||[]).indexOf(d.id)>=0?'<span style="display:inline-block;margin-top:6px;background:#1f3327;color:#7dd88f;border:1px solid #2f5a3f;border-radius:6px;padding:2px 8px;font-size:10px">[Uploaded]</span>':'')
      +(d.refShared?'<span style="display:inline-block;margin-top:6px;margin-left:4px;background:#3a2f14;color:#e0b34d;border:1px solid #5a4a1f;border-radius:6px;padding:2px 8px;font-size:10px" title="Isi hadith reference par ek aur dua bhi hai">ref shared</span>':'')
      +(pos?'<span style="position:absolute;top:-10px;right:-6px;background:#d4af37;color:#0b0e13;font-weight:bold;font-size:13px;border-radius:999px;min-width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.5)">#'+pos+'</span>':'')
      +'</div>';
  }).join(''):'<div style="font-size:12px;color:#8b93a3;padding:8px">koi dua nahi mili</div>';
}
function ytToggleDua(id){
  if(ytSel[id]){ delete ytSel[id]; }
  else{
    if(Object.keys(ytSel).length>=6){ toast('Max 6 videos ek run me select kar sakte ho','err'); return; }
    var upIds=window.ytUploadedIds||[];
    if(upIds.indexOf(id)>=0&&!confirm('Ye video pehle upload ho chuki hai. Phir bhi select karogi?'))return;
    ytSel[id]=true;
  }
  ytUpdateCount();
  ytRenderPicker();
}
function ytPickReset(){
  ytSel={};
  ytUpdateCount();
  ytRenderPicker();
  toast('Selection clear ho gayi - dobara 1-6 duas chuno','ok');
}
function quickUpload(id){
  if(window.ytUploadedIds&&ytUploadedIds.indexOf(id)>=0&&!confirm('Ye pehle upload ho chuki hai (ledger). Phir bhi select karni hai?'))return;
  if(!ytSel[id]){
    if(Object.keys(ytSel).length>=6){toast('Max 6 videos ek run me select kar sakte ho','err');return;}
    ytSel[id]=true;
  }
  var p=document.getElementById('ytpanel');
  if(p&&p.style.display==='none')ytToggle();
  ytUpdateCount();
  ytRenderPicker();
  var anchor=document.getElementById('yt_pickcount');
  if(anchor)anchor.scrollIntoView({behavior:'smooth',block:'center'});
  toast('YT panel me select ho gayi - wahan se UPLOAD SELECTED dabao','ok');
}
async function ytCancelReq(){
  try{
    var r=await fetch('/api/yt-cancel',{method:'POST'});
    var j=await r.json();
    var b=document.getElementById('yt_progress');
    if(b&&j.ok){b.innerHTML='<span style="color:#ff7b72">\u{23F9} Cancel request mil gayi - ye video poora hoga, uske baad ruk jayega...</span>';}
    toast(j.ok?'Cancel request bhej di - ye video ke baad ruk jayega':'Cancel fail: '+(j.error||''),j.ok?'ok':'err');
  }catch(e){}
}
async function ytStart(){  const sel=Object.keys(ytSel);
  if(!sel.length){toast('Pehle 1-6 duas select karo','err');return;}
  const mode=document.getElementById('yt_mode').value;
  if(mode==='live'&&!confirm('LIVE upload? '+sel.length+' selected videos ASLI YouTube channel par jayengi.'))return;
  var upIds=window.ytUploadedIds||[];
  var already=sel.filter(function(id){return upIds.indexOf(id)>=0;});
  if(already.length){
    if(!confirm(already.length+' video(s) pehle upload ho chuki hain: '
      +already.join(', ')+'. Dubara upload karogi?'))return;
  }
  var b=document.getElementById('yt_start');b.disabled=true;b.textContent='Uploading...';
  const bodyObj={
    channel:document.getElementById('yt_channel').value,
    privacy:document.getElementById('yt_privacy').value,
    mode,
    selectedDuas:sel};
  const body=JSON.stringify(bodyObj);
  try{
    const r=await fetch('/api/youtube/upload',{method:'POST',headers:{'Content-Type':'application/json'},body});
    const j=await r.json();
    if(!j.ok){b.disabled=false;b.textContent='\u{1F680} UPLOAD SELECTED ('+sel.length+') VIDEOS';toast(j.error||'Upload start fail','err');return;}
    toast('Upload start: '+j.channel+' manual x'+j.selectedCount+' ('+j.mode+')','ok');
    ytWasRunning=true;
    ytEnsurePoll();
    ytRefresh();
  }catch(e){b.disabled=false;b.textContent='\u{1F680} UPLOAD SELECTED ('+sel.length+') VIDEOS';toast('Network error','err');}
}
function logClass(l){
  if(l.indexOf('FAILED')>=0||l.indexOf('ERROR')>=0)return'lg-err';
  if(l.indexOf('DONE')===0||l.indexOf('OK')>=0)return'lg-ok';
  if(l.indexOf('$')===0)return'lg-cmd';
  return'';
}
function render(){
  const list=filtered();
  const key=JSON.stringify([list.map(d=>[d.id,d.videoFile,d.audioReady,d.manifest]),searchTerm,activeCat,busy]);
  if(key===lastGridKey)return;
  lastGridKey=key;
  const grid=document.getElementById('grid');
  if(!list.length){grid.innerHTML='<div class="empty">Koi dua nahi mili &#128269;</div>';return;}
  grid.innerHTML=list.map(d=>{
    const vid=d.videoFile;
    const cls='card'+(vid?' rendered':'')+((busy&&jobDua===d.id)?' active-job':'');
    return '<div class="'+cls+'">'+
      (d.thumbFile?'<img class="poster" src="/thumb/'+encodeURIComponent(d.thumbFile)+'" loading="lazy" onclick="openPlayer(\''+encodeURIComponent(vid)+'\')" style="cursor:'+(vid?'pointer':'default')+'">':'')+
      '<div class="trow"><div style="flex:1"><div class="ref">'+(d.reference||'')+'</div>'+
      '<div class="t">'+d.title+'</div></div>'+
      '<div class="actions">'+
        (vid?'':'<button class="ico" title="Edit" onclick="editDua(\''+d.id+'\')">&#9999;&#65039;</button>')+
        '<button class="ico danger" title="Delete" onclick="delDua(\''+d.id+'\')">&#128465;&#65039;</button>'+
      '</div></div>'+
      '<div class="meta">'+
        badge(d.audioReady,'AUDIO READY','NO AUDIO','')+
        badge(d.manifest,'MANIFEST','NO MANIFEST','')+
        (vid?'<span class="b ok">RENDERED</span>':(d.audioReady?'<span class="b warn">NOT RENDERED</span>':''))+
        (d.qc?(d.qc.pass?'<span class="b ok">&#9989; QC</span>':'<span class="b warn">&#9888;&#65039; QC FAIL</span>'):'')+
        '<span class="b theme">&#127912; '+(THEME_LABEL[d.theme]||d.theme||'Dark Gold')+'</span>'+
        (d.videoMB?'<span class="b mb">'+d.videoMB+' MB</span>':'')+
      '</div>'+
      '<div class="row">'+
        (vid
          ?'<button class="btn-play" onclick="openPlayer(\''+encodeURIComponent(vid)+'\')">PLAY</button>'+
           '<button class="btn-render" onclick="quickUpload(\''+d.id+'\')" style="background:#1f3327;border-color:#2f5a3f;color:#7dd88f">UPLOAD</button>'
          :'<button class="btn-render" '+(busy?'disabled':'')+' onclick="startRender(\''+d.id+'\')">'+(d.audioReady?'RENDER':'TTS + RENDER')+'</button>')+
      '</div>'+
      (vid?'':'<label class="force"><input type="checkbox" '+(forceFlags[d.id]?'checked':'')+' onchange="forceFlags[\''+d.id+'\']=this.checked"> force re-TTS</label>')+
    '</div>';
  }).join('');
}
function badge(ok,yes,no,warn){
  return ok?'<span class="b ok">'+yes+'</span>':'<span class="b '+(warn?'warn':'no')+'">'+no+'</span>';
}
async function startRender(id){
  const force=!!forceFlags[id];
  const r=await fetch('/api/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({duaId:id,force})});
  const j=await r.json(); if(!j.ok) toast(j.error,'err');
}
function toast(msg,type){
  const t=document.createElement('div'); t.className='toast '+type; t.textContent=msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(()=>t.remove(),5000);
}
function openPlayer(enc){
  const name=decodeURIComponent(enc);
  const v=document.getElementById('pvid');
  v.src='/video/'+enc+'?ts='+Date.now();
  document.getElementById('pname').textContent=name;
  document.getElementById('playerbg').classList.add('show');
  v.play();
}
function closePlayer(){
  const v=document.getElementById('pvid'); v.pause(); v.src='';
  document.getElementById('playerbg').classList.remove('show');
}
function dismissBar(){ barHidden=true; document.getElementById('jobbar').classList.remove('show'); }
async function poll(){
  try{
    const j=await (await fetch('/api/status')).json();
    window.jobDua=j.duaId; busy=j.running;
    if(j.running)barHidden=false;
    const showBar=j.running||(!barHidden&&(j.step==='done'||!!j.error));
    document.getElementById('jobbar').classList.toggle('show',showBar);
    document.getElementById('jstep').textContent=(j.step||'-').toUpperCase();
    document.getElementById('jdua').textContent=j.duaId||'';
    const indet=j.running&&(j.step!=='render');
    document.getElementById('jpct').textContent=j.running?((j.percent||0)+'%'):(j.error?'FAILED':(j.step==='done'?'100%':''));
    const f=document.getElementById('jfill');
    f.classList.toggle('indet',indet);
    f.style.width=indet?'30%':((j.percent||0)+'%');
    const lb=document.getElementById('jlog');
    if(lb){
      const recent=(j.logs||[]).slice(-3);
      const html=recent.map(l=>'<span class="'+logClass(l)+'">'+l+'</span>').join('\\n');
      if(lb.dataset.prev!==html){lb.innerHTML=html;lb.scrollTop=lb.scrollHeight;lb.dataset.prev=html;}
    }
    const jb=document.getElementById('jbatch');
    const jc=document.getElementById('jcancel');
    if(j.queue&&j.queue.active){
      jc.style.display='inline-block';
      jb.style.display='inline';
      jb.textContent=(j.queue.idx)+'/'+j.queue.total+
        ' \\u2705'+j.queue.done+' \\u274C'+(j.queue.failed?j.queue.failed.length:0)+
        (j.queue.skipped&&j.queue.skipped.length?(' \\u23ED'+j.queue.skipped.length):'')+
        ' | '+(j.duaId||'-');
    }else{jb.style.display='none';jc.style.display='none';}
    document.title = j.running ? (j.percent + '% - Dua Studio') : 'Dua Video Studio';
    if(prevStep && prevStep!=='done' && j.step==='done' && !j.running){
      toast('\\u2705 '+(j.lastVideo||'Video').split('\\\\').pop()+' ready!','ok');
      lastGridKey=''; load();
    }
    if(prevStep && prevStep!=='failed' && j.step==='failed' && !j.running){
      toast('\\u274C Render failed: '+j.error,'err');
      lastGridKey=''; load();
    }
    prevStep=j.step;
    render();
  }catch(e){}
}
document.getElementById('themegrid').addEventListener('click',e=>{
  const l=e.target.closest('.topt'); if(l) setThemeSel(l.dataset.v);
});
let voiceMode='portal';
function setVoiceMode(m){
  voiceMode=m;
  document.getElementById('vm_portal').style.display=m==='portal'?'block':'none';
  document.getElementById('vm_custom').style.display=m==='custom'?'block':'none';
  document.getElementById('vm_portal_btn').classList.toggle('on',m==='portal');
  document.getElementById('vm_custom_btn').classList.toggle('on',m==='custom');
}
function openVoice(){
  const sel=document.getElementById('v_dua');
  sel.innerHTML=duas.map(d=>'<option value="'+d.id+'">'+d.title+'</option>').join('');
  document.getElementById('voiceplayer').style.display='none';
  setVoiceMsg('','');
  document.getElementById('voicebg').classList.add('show');
}
function closeVoice(){ document.getElementById('voicebg').classList.remove('show'); }
function setVoiceMsg(t,c){ const m=document.getElementById('voicemsg'); m.textContent=t; m.className='formmsg '+c; }
async function genVoice(){
  if(voiceMode==='custom'){
    const a=document.getElementById('v_arabic').value.trim();
    const u=document.getElementById('v_urdu').value.trim();
    if(!a&&!u)return setVoiceMsg('Pehle Arabic ya Urdu text likho','err');
    let base=document.getElementById('v_name').value.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40);
    if(!base)base='custom_'+new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
    const finalName='custom_'+base;
    setVoiceMsg('Awaz ban rahi hai (TTS + master + save)...','');
    try{
      const r=await fetch('/api/tts-custom',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({arabic:a,urdu:u,name:finalName})});
      const j=await r.json();
      if(!j.ok)return setVoiceMsg(j.error||'Fail hua','err');
      document.getElementById('voiceplayer').style.display='block';
      document.getElementById('ap_voice').src='/audio/'+j.savedFile+'?v='+j.ts;
      setVoiceMsg('\\u2705 Ban gayi! AUDIO folder me save: '+j.savedFile,'ok');
    }catch(e){setVoiceMsg('Server error','err');}
    return;
  }
  const id=document.getElementById('v_dua').value;
  const force=document.getElementById('v_force').checked;
  const r=await fetch('/api/voice-only',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({duaId:id,force})});
  const j=await r.json();
  if(!j.ok)return setVoiceMsg(j.error||'Fail','err');
  setVoiceMsg('Awaz ban rahi hai (TTS + merge)...','');
  for(let i=0;i<180;i++){
    await new Promise(res=>setTimeout(res,1000));
    try{
      const s=await(await fetch('/api/status')).json();
      if(s.error){setVoiceMsg('Fail: '+s.error,'err');return;}
      if(!s.running&&s.step==='done'){
        document.getElementById('voiceplayer').style.display='block';
        document.getElementById('ap_voice').src='/temp-voice/'+id+'?v='+Date.now();
        setVoiceMsg('\\u2705 Ready! Neeche play dabao','ok');
        lastGridKey='';load();
        return;
      }
      if(!s.running)break;
    }catch(e){}
  }
  setVoiceMsg('Timeout ya fail hua','err');
}
function openFolder(which){
  fetch('/api/open-folder',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({which})});
}
async function renderAll(){
  if(busy)return toast('Pehle chalta hua job khatam hone do','err');
  if(!confirm('Saari duas ki videos banayen ge?\\n- Jo bani hain wo dobara banengi (naye style/voice ke sath)\\n- Fail hui wali skip ho kar aage barhegi'))return;
  const r=await fetch('/api/render-all',{method:'POST'});
  const j=await r.json();
  if(j.ok){toast('\\u26A1 Batch shuru: '+j.total+' videos','ok');barHidden=false;}
  else toast(j.error||'Fail hua','err');
}
async function cancelJob(){
  const r=await fetch('/api/cancel',{method:'POST'});
  const j=await r.json();
  if(j.ok)toast(j.batch?'\\u23F9 Batch cancel ho raha hai...':'\\u23F9 Job cancel ho raha hai...','ok');
}
async function openHistory(){
  document.getElementById('histbg').classList.add('show');
  const r=await fetch('/api/history');const j=await r.json();
  const h=j.history||[];
  document.getElementById('histlist').innerHTML=h.length?h.map(e=>{
    const d=new Date(e.ts);const when=d.toLocaleDateString()+' '+d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    const ok=e.result==='PASS';
    return '<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #1c2330">'+
      '<span class="b '+(ok?'ok':'no')+'">'+e.result+'</span>'+
      '<div style="flex:1"><div style="font-size:13.5px">'+escHtml(e.title)+'</div>'+
      '<div style="font-size:11px;color:#5a6474">'+when+(e.error?' &mdash; '+escHtml(e.error):'')+(e.look?'<div style="color:#c9a227;font-size:10.5px">&#127912; '+escHtml(e.look)+'</div>':'')+'</div></div></div>';
  }).join(''):'<div class="empty">Abhi koi render history nahi</div>';
}
function closeHistory(){document.getElementById('histbg').classList.remove('show');}
function escHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function thumbsAll(){
  if(busy)return toast('Pehle chalta hua job khatam hone do','err');
  if(!confirm('Jo videos ke thumbnails nahi hain, sab banayen ge?'))return;
  const r=await fetch('/api/thumbs-all',{method:'POST'});
  const j=await r.json();
  if(j.ok)toast('\\uD83D\\uDDBC\\uFE0F Thumbnails ban rahe hain - log dekho','ok');
  else toast(j.error||'Fail hua','err');
}
function openSettings(){
  fetch('/api/config').then(r=>r.json()).then(c=>{
    document.getElementById('s_name').value=c.channelName||'';
    document.getElementById('s_handle').value=c.handle||'';
    document.getElementById('s_style').value=c.stylePreset||'classic';
    const lm=c.lookMode==='signature'?'signature':'random';
    const r=document.querySelector('input[name=s_look][value="'+lm+'"]');
    if(r)r.checked=true;
    document.getElementById('s_art').value=c.artFx||'auto';
    document.getElementById('s_sky').value=c.skyFx||'auto';
    document.getElementById('s_border').value=c.borderFx||'auto';
  });
  setMsg2('','');
  document.getElementById('setbg').classList.add('show');
}
function closeSettings(){ document.getElementById('setbg').classList.remove('show'); }
function openHelp(){ document.getElementById('helpbg').classList.add('show'); tabHelp('ro'); }
function closeHelp(){ document.getElementById('helpbg').classList.remove('show'); }
function tabHelp(w){
  document.getElementById('help_ro').style.display = w==='ro' ? 'block' : 'none';
  document.getElementById('help_ur').style.display = w==='ur' ? 'block' : 'none';
  document.getElementById('ht_ro').className = w==='ro' ? 'on' : '';
  document.getElementById('ht_ur').className = w==='ur' ? 'on' : '';
}
window.addEventListener('load', function(){
  try {
    if(!localStorage.getItem('dua_help_seen')){
      openHelp();
      localStorage.setItem('dua_help_seen', '1');
    }
  } catch(e){}
});
function setMsg2(t,c){ const m=document.getElementById('setmsg'); m.textContent=t; m.className='formmsg '+c; }
async function saveSettings(){
  const r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channelName:document.getElementById('s_name').value,handle:document.getElementById('s_handle').value,stylePreset:document.getElementById('s_style').value,lookMode:((document.querySelector('input[name=s_look]:checked')||{}).value||'random'),artFx:document.getElementById('s_art').value,skyFx:document.getElementById('s_sky').value,borderFx:document.getElementById('s_border').value})});
  const j=await r.json();
  if(j.ok){setMsg2('\\u2705 Save ho gaya! Agla render in settings se banega.','ok');}
  else setMsg2('Save fail hua','err');
}
async function aiMetaPrompt(id){
  const d=duas.find(x=>x.id===id); if(!d)return;
  const p=['Mujhe is Islamic dua ke liye YouTube Shorts metadata chahiye:',
    '',
    'Title: '+d.title,
    'Arabic: '+(d.arabic||''),
    'Urdu: '+(d.urdu||''),
    'Reference: '+(d.reference||'-'),
    '',
    'EXACTLY ye format me do (koi extra text nahi):',
    '1. SEO Title (60 chars se kam, catchy)',
    '2. Description (2 lines: Roman Urdu + English)',
    '3. 15 tags (comma separated)',
    '4. 5 hashtags'].join('\\n');
  try{await navigator.clipboard.writeText(p);toast('\\uD83D\\uDCCB AI metadata prompt copy! Gemini pe paste karo','ok');}
  catch(e){toast('Copy fail hua','err');}
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closePlayer();closeForm();closeAi();closeVoice();closeSettings();}
});
function openForm(){ editingId=null; document.getElementById('modaltitle').innerHTML='&#10133; Nayi Dua Add Karo'; document.getElementById('f_bis').checked=true; document.getElementById('modalbg').classList.add('show'); setMsg('',''); }
const GEMINI_PROMPT=['Mujhe ek authentic Islamic dua ki details chahiye (Quran ya Sahih hadith se).',
'Dua: [YAHAN DUA KA NAAM LIKHO]',
'',
'ZAROORI LIMITS - inka palan karna:',
'1. title: Roman Urdu me SHORT (2-5 words, jaise "Safar Ki Dua")',
'2. arabic: poora Arabic text HARAKAT ke sath. Bismillah apne aap mat jodo (system khud lagata hai)',
'3. urdu: Urdu script me tarjuma - MAXIMUM 60 words (video 40 sec limit hai, lambi dua reject hogi)',
'4. reference: authentic source format (jaise "Sahih Bukhari 1234" ya "Quran 2:201")',
'5. category: SIRF in me se ek word: protection | rizq | forgiveness | morning_evening | guidance | health | anxiety_relief | gratitude | family | occasions | sleep | food | travel | prayer | morning | evening | bathroom | general',
'',
'Mujhe EXACTLY is JSON format me sirf JSON do, koi extra text nahi:',
'{"title":"Roman Urdu short title","arabic":"harakat ke sath Arabic","urdu":"max 60 words tarjuma","reference":"Sahih Bukhari 1234","category":"travel"}'].join('\\n');
function openAi(){
  document.getElementById('aimodalbg').classList.add('show');
  document.getElementById('ai_raw').value='';
  setAiMsg('','');
  detectAI();
}
function closeAi(){ document.getElementById('aimodalbg').classList.remove('show'); }
function setAiMsg(t,c){ const m=document.getElementById('aimsg'); m.textContent=t; m.className='formmsg '+c; }
async function detectAI(){
  const el=document.getElementById('aiengine');
  let ok=false;
  try{
    if(typeof LanguageModel!=='undefined'&&LanguageModel.availability){
      const a=await LanguageModel.availability(); ok=a&&a!=='unavailable';
    } else if(window.ai&&window.ai.languageModel&&window.ai.languageModel.capabilities){
      const c=await window.ai.languageModel.capabilities(); ok=c.available&&c.available!=='no';
    }
  }catch(e){}
  el.className='aihint '+(ok?'ok':'no');
  el.innerHTML=ok
    ?'\\u2705 <b>Chrome ka built-in Gemini mil gaya!</b> Koi bhi raw text paste karo - khud parse kar lega.'
    :'\\u2139\\uFE0F Built-in AI nahi mila (Chrome purana hai ya off hai) - koi baat nahi, gemini.google.com wala flow use karo, wo hamesha kaam karega.';
}
function copyPrompt(){
  navigator.clipboard.writeText(GEMINI_PROMPT)
    .then(()=>toast('\\uD83D\\uDCCB Prompt copy ho gaya! gemini.google.com pe paste karo','ok'))
    .catch(()=>toast('Copy fail - prompt manually select karo','err'));
}
function extractJson(txt){
  const i=txt.indexOf('{'), j=txt.lastIndexOf('}');
  if(i<0||j<=i)return null;
  try{ return JSON.parse(txt.slice(i,j+1)); }catch(e){ return null; }
}
function parseLabeled(txt){
  const get=(re)=>{const m=txt.match(re);return m?m[1].trim():'';};
  const o={
    title:get(/title\\s*[:\\-]\\s*(.+)/i),
    arabic:get(/arabic\\s*[:\\-]\\s*([\\s\\S]*?)(?=\\n\\s*urdu|\\n\\s*reference|\\n\\s*category|$)/i),
    urdu:get(/urdu\\s*[:\\-]\\s*([\\s\\S]*?)(?=\\n\\s*reference|\\n\\s*category|$)/i),
    reference:get(/reference\\s*[:\\-]\\s*(.+)/i),
    category:get(/category\\s*[:\\-]\\s*(.+)/i)
  };
  return (o.title&&(o.arabic||o.urdu))?o:null;
}
async function builtInAI(txt){
  let sess=null;
  try{
    if(typeof LanguageModel!=='undefined'&&LanguageModel.create){
      sess=await LanguageModel.create({initialPrompts:[{role:'system',content:'You extract Islamic dua info. Reply ONLY with minified JSON having keys: title, arabic, urdu, reference, category. Limits: title = short Roman Urdu (2-5 words); arabic = full text WITH harakat, never prepend bismillah; urdu = Urdu script translation MAX 60 words (40s video limit); reference = authentic source like "Sahih Bukhari 1234" or "Quran 2:201"; category must be exactly one of: protection, rizq, forgiveness, morning_evening, guidance, health, anxiety_relief, gratitude, family, occasions, sleep, food, travel, prayer, morning, evening, bathroom, general.'}]});
    } else if(window.ai&&window.ai.languageModel){
      sess=await window.ai.languageModel.create();
    }
    if(!sess)return null;
    const r=await sess.prompt('Extract dua info as JSON only:\\n\\n'+txt.slice(0,4000));
    if(sess.destroy)sess.destroy();
    return extractJson(r||'');
  }catch(e){ if(sess&&sess.destroy)sess.destroy(); return null; }
}
async function aiParse(){
  const txt=document.getElementById('ai_raw').value.trim();
  if(!txt)return setAiMsg('Pehle kuch paste karo','err');
  setAiMsg('Parse ho raha hai...','');
  let o=extractJson(txt);
  if(!o)o=await builtInAI(txt);
  if(!o)o=parseLabeled(txt);
  if(!o||!(o.arabic||o.urdu)){
    return setAiMsg('Samajh nahi aaya. Gemini se JSON format me mangwao (upar wala PROMPT COPY button dabao)','err');
  }
  const arStr=String(o.arabic||'').trim();
  const urduWords=(String(o.urdu||'').trim().match(/\\S+/g)||[]).length;
  if(!arStr){
    return setAiMsg('Arabic text nahi mila - Gemini se poora Arabic (harakat ke sath) mangwao','err');
  }
  if(urduWords>60){
    return setAiMsg('\\u26D4 Bohot lambi dua! Tarjuma '+urduWords+' words hai (max 60). Video 40 sec se lambi banegi aur RENDER FAIL hogi. Gemini se chhoti tarjuma mangwao','err');
  }
  applyDua(o);
}
function applyDua(o){
  editingId=null;
  document.getElementById('modaltitle').innerHTML='&#10133; Nayi Dua Add Karo';
  document.getElementById('f_title').value=o.title||'';
  document.getElementById('f_arabic').value=o.arabic||'';
  document.getElementById('f_urdu').value=o.urdu||'';
  document.getElementById('f_ref').value=o.reference||'';
  document.getElementById('f_cat').value=['sleep','food','travel','prayer','morning','evening','bathroom','general','protection','rizq','forgiveness','morning_evening','guidance','health','anxiety_relief','gratitude','family','occasions'].includes(o.category)?o.category:'general';
  setThemeSel(o.template&&THEME_LABEL[o.template]?o.template:'dark');
  closeAi();
  document.getElementById('modalbg').classList.add('show');
  const wc=(String(o.urdu||'').trim().match(/\\S+/g)||[]).length;
  toast('\\u2728 Form bhar diya ('+wc+' words) - check karke SAVE dabao','ok');
}
function editDua(id){
  const d=duas.find(x=>x.id===id); if(!d)return;
  editingId=id;
  document.getElementById('modaltitle').textContent='\\u270F\\uFE0F Edit: '+d.title;
  document.getElementById('f_title').value=d.title||'';
  document.getElementById('f_arabic').value=d.arabic||'';
  document.getElementById('f_urdu').value=d.urdu||'';
  document.getElementById('f_ref').value=d.reference||'';
  document.getElementById('f_cat').value=d.category||'general';
  document.getElementById('f_bis').checked=d.bismillah!==false;
  setThemeSel(d.template&&THEME_LABEL[d.template]?d.template:'dark');
  const vp=document.getElementById('f_vpair');
  vp.value=(d.voiceArabic==='ar-SA-ZariyahNeural')?'Zariyah + Uzma':'Hamed + Asad';
  setMsg('','');
  document.getElementById('modalbg').classList.add('show');
}
async function copyText(id){
  const d=duas.find(x=>x.id===id); if(!d)return;
  const txt=[d.title,'','Arabic:',d.arabic||'','','Urdu:',d.urdu||'','','Reference: '+(d.reference||'-')].join('\\n');
  try{await navigator.clipboard.writeText(txt);toast('\\uD83D\\uDCCB Text clipboard pe copy ho gaya','ok');}
  catch(e){toast('Copy fail hua','err');}
}
async function dupDua(id){
  const r=await fetch('/api/duplicate-dua',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  const j=await r.json();
  if(j.ok){toast('\\u29C9 Duplicate bana: '+j.id,'ok'); lastGridKey=''; load();}
  else toast(j.error||'Duplicate fail','err');
}
async function delDua(id){
  const d=duas.find(x=>x.id===id); if(!d)return;
  if(!confirm('"'+d.title+'" delete karein?\\n(list se hat jayegi - audio/video files rahengi)'))return;
  const r=await fetch('/api/delete-dua',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  const j=await r.json();
  if(j.ok){toast('\\uD83D\\uDDD1\\uFE0F Deleted: '+d.title,'ok'); lastGridKey=''; load();}
  else toast(j.error||'Delete fail','err');
}
function closeForm(){ document.getElementById('modalbg').classList.remove('show'); }
function setMsg(t,cls){ const m=document.getElementById('formmsg'); m.textContent=t; m.className='formmsg '+cls; }
async function saveDua(){
  const checked=document.querySelector('#themegrid input:checked');
  const vp=VOICE_PAIRS[document.getElementById('f_vpair').value]||VOICE_PAIRS['Hamed + Asad'];
  const body={
    title:document.getElementById('f_title').value,
    arabic:document.getElementById('f_arabic').value,
    urdu:document.getElementById('f_urdu').value,
    reference:document.getElementById('f_ref').value,
    category:document.getElementById('f_cat').value,
    bismillah:document.getElementById('f_bis').checked,
    template:checked?checked.value:'dark',
    voiceArabic:vp[0],
    voiceUrdu:vp[1]
  };
  if(editingId)body.id=editingId;
  const url=editingId?'/api/update-dua':'/api/add-dua';
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json();
  if(j.ok){
    setMsg(editingId?'Update ho gaya!':'Ho gaya! ID: '+j.id,'ok');
    toast(editingId?('\\u270F\\uFE0F Updated: '+editingId):('\\u2795 Nayi dua added: '+j.id),'ok');
    if(!editingId)['f_title','f_arabic','f_urdu','f_ref'].forEach(i=>document.getElementById(i).value='');
    editingId=null;
    setTimeout(()=>{closeForm(); load();},800);
  }
  else setMsg(j.error||'Error','err');
}
poll(); setInterval(poll,900); load(); setInterval(load,8000);