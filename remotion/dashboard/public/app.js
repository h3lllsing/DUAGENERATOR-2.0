let duas=[], busy=false, searchTerm='', activeCat='All';
let forceFlags={}, lastGridKey='', prevStep=null, barHidden=false, editingId=null, jobDua='', prevQueueActive=false, autoHideBarT=null;
const _AUTH=(window.AUTH_TOKEN||'');
const _origFetch=window.fetch;
window.fetch=function(url,opts){
  opts=opts||{};
  if(typeof url==='string'&&url.startsWith('/api/')){
    opts.headers=opts.headers||{};
    if(opts.headers instanceof Headers){opts.headers.set('Authorization','Bearer '+_AUTH);}
    else if(Array.isArray(opts.headers)){opts.headers.push(['Authorization','Bearer '+_AUTH]);}
    else{opts.headers['Authorization']='Bearer '+_AUTH;}
  }
  return _origFetch(url,opts);
};
var EXPERT=/[?&]expert=1/.test(location.search);
if(EXPERT){document.body.classList.add('expert');}
const THEME_LABEL={dark:'Dark Gold',mosque:'Mosque Night',sunset:'Sunset Dawn',manuscript:'Manuscript',emerald:'Emerald Pattern',ocean:'Ocean Night',desert:'Desert Gold',royal:'Royal Purple'};
const VOICE_PAIRS={'Hamed + Asad':['ar-SA-HamedNeural','ur-PK-AsadNeural'],'Zariyah + Uzma':['ar-SA-ZariyahNeural','ur-PK-UzmaNeural']};
function setThemeSel(v){
  document.querySelectorAll('#themegrid .topt').forEach(l=>{
    const on=l.dataset.v===v;
    l.classList.toggle('on',on);
    l.querySelector('input').checked=on;
  });
}
let _loaded=false;
async function load(){
  if(!_loaded){document.getElementById('grid').innerHTML='<div class="loading">Loading...</div>';}
  try{
    const r=await fetch('/api/duas');
    if(!r.ok) throw new Error('Server error: '+r.status);
    const j=await r.json();
    duas=j.duas||[];
    buildChips();
    render();
    stats();
    _loaded=true;
    if(document.getElementById('ytHub').style.display!=='none') ytRenderPicker();
  }catch(e){
    document.getElementById('grid').innerHTML='<div class="empty"><div class="empty-big">Load fail ho gaya</div><div class="empty-hint">'+escHtml(String(e.message||e))+'</div><button class="aibtn" onclick="load()" style="margin-top:12px">Retry</button></div>';
    if(typeof toast==='function') toast('Dashboard load fail: '+e.message,'err');
  }
}
function stats(){
  const done=duas.filter(d=>d.videoFile).length;
  document.getElementById('statline').innerHTML='<b>'+done+'</b> / '+duas.length+' Rendered';
  const pct=duas.length?Math.round(done*100/duas.length):0;
  document.getElementById('ring').style.setProperty('--p',pct+'%');
  document.getElementById('ringtxt').textContent=pct+'%';
  const upCount=(window.ytUploadedIds||[]).length;
  const el=document.getElementById('uploaded_count');
  if(el) el.textContent=upCount;
}
function buildChips(){
  const cats=['All',...new Set(duas.map(d=>d.category))];
  document.getElementById('chips').innerHTML=cats.map(c=>
    '<button class="chip'+(c===activeCat?' on':'')+'" onclick="setCat(\''+c+'\')">'+c+'</button>').join('');
}
function setCat(c){ activeCat=c; buildChips(); render(); }
function onSearch(v){ searchTerm=v.trim().toLowerCase(); render(); }
function filtered(){
  var upIds=window.ytUploadedIds||[];
  return duas.filter(d=>{
    if(upIds.indexOf(d.id)>=0) return false;
    const okCat=activeCat==='All'||d.category===activeCat;
    const q=searchTerm;
    const okQ=!q||d.title.toLowerCase().includes(q)||(d.reference||'').toLowerCase().includes(q)||d.id.includes(q);
    return okCat&&okQ;
  });
}
var ytPollT=null,ytWasRunning=false,ytWasAuth=false;
var ytHubTab='upload';
function ytToggle(tab){
  var p=document.getElementById('ytHub');
  var isOpen=p.style.display!=='none';
  tab=tab||'upload';
  if(!isOpen){
    p.style.display='block';
    _pushModal('ytHub');
    ytTab(tab);
    ytRefresh();
    ytRenderPicker();
  } else if(ytHubTab!==tab){
    ytTab(tab);
  } else {
    p.style.display='none';
    _popModal('ytHub');
  }
}
function ytTab(name){
  ytHubTab=name;
  document.querySelectorAll('.yt-tab').forEach(function(b){b.classList.toggle('active',b.dataset.tab===name);});
  document.getElementById('ytTab_upload').style.display=name==='upload'?'block':'none';
  document.getElementById('ytTab_uploaded').style.display=name==='uploaded'?'block':'none';
  if(name==='uploaded'){ openUploadedList(); }
  else { stopYtStatsAuto(); }
}
function ytHubClose(){ document.getElementById('ytHub').style.display='none'; _popModal('ytHub'); stopYtStatsAuto(); }
function ytEsc(s){return escHtml(s);}
function ytEnsurePoll(){
  if(!ytPollT) ytPollT=setInterval(ytRefresh,5000);
}

function ytAccToggle(){ var b=document.getElementById('yt_log_box'); b.style.display=b.style.display==='none'?'block':'none'; }
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
  var txt=links.map(function(x){return x.title+' - '+x.url;}).join('\n');
  var done=function(){toast(links.length+' links copy ho gaye - ready to share!','ok');};
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(done,function(){ytCopyFallback(txt);done();});
  } else { ytCopyFallback(txt);done(); }
}
async function ytRefresh(){
  try{
    const r=await fetch('/api/youtube/status'); if(!r.ok)return;
    const j=await r.json();
    var ms=[];
    var totalQuota=0;
    ['channel1','channel2'].forEach(function(ch,i){
      const c=(j.channels&&j.channels[ch])||{};
      const qu=(typeof c.quotaUploadsToday==='number')?c.quotaUploadsToday:0;
      totalQuota+=qu;
      if(c.auth==='ok') ms.push('<span style="color:#56d364">&#9679; Ch '+(i+1)+': Ready</span> <span style="color:#5a6474">('+qu+'/5 quota)</span>');
      else ms.push('<span style="color:#ff8585">&#9679; Ch '+(i+1)+': Setup needed</span>');
    });
    var needSetup=(j.channels&&(j.channels.channel1||{}).auth!=='ok')||(j.channels&&(j.channels.channel2||{}).auth!=='ok');
    document.getElementById('yt_mainstatus').innerHTML=ms.join(' &nbsp;&nbsp; ')
      +(needSetup?'<div style="margin:6px 0 0;font-size:12px;color:#8b93a3">Setup ke liye <b onclick="openSettings()" style="cursor:pointer;color:#d4af37">Settings &#8594; YouTube Auth</b></div>':'');
    var sb=document.getElementById('yt_statbar');
    if(sb){
      var hasJob=j.job&&j.job.running;
      var hasAuth=j.auth&&j.auth.running;
      sb.innerHTML='<div class="yt-stat"><div class="val">'+totalQuota+'</div><div class="lbl">Quota Used</div></div>'
        +'<div class="yt-stat"><div class="val">'+(j.channels?2:0)+'</div><div class="lbl">Channels</div></div>'
        +'<div class="yt-stat"><div class="val">'+(hasJob?((j.job.done||0)+'/'+(j.job.total||0)):'Idle')+'</div><div class="lbl">Upload Status</div></div>'
        +'<div class="yt-stat"><div class="val">'+(hasAuth?'Active':'--')+'</div><div class="lbl">Auth</div></div>';
    }
    var lg=document.getElementById('yt_log');
    var tail=null;
    if(j.job&&j.job.running) tail=j.job.logTail;
    else if(j.auth&&j.auth.running) tail=j.auth.logTail;
    else{
      var jt=(j.job&&j.job.finishedAt)||0, at=(j.auth&&j.auth.finishedAt)||0;
      tail=jt>=at?(j.job&&j.job.logTail):(j.auth&&j.auth.logTail);
    }
    if(tail&&tail.length){
      lg.textContent=tail.join('\n');
      lg.scrollTop=lg.scrollHeight;
    }
    window.ytLastLinks=(j.job&&j.job.finishedLinks)||[];
    var pg=document.getElementById('yt_progress');
    var jb=j.job||{};
    if(jb.running){
      pg.className='progress-box show';
      var t=jb.total||0,d=jb.done||0;
      var pct=t?Math.round(d*100/t):0;
      document.getElementById('yt_progress_title').textContent='Uploading Video '+Math.min(d+1,t||1)+' of '+(t||'?');
      document.getElementById('yt_progress_fill').style.width=pct+'%';
    } else if(j.auth&&j.auth.running){
      pg.className='progress-box show';
      document.getElementById('yt_progress_title').textContent='Google login window khuli hai - browser me account choose karo';
      document.getElementById('yt_progress_fill').style.width='50%';
    } else if(jb.code!==null&&jb.code!==undefined&&(jb.videos||[]).length){
      pg.className='progress-box show';
      document.getElementById('yt_progress_title').textContent=(jb.code===0?'Done':'Warning')+' - '+jb.videos.length+' video(s) uploaded';
      document.getElementById('yt_progress_fill').style.width='100%';
    } else {
      pg.className='progress-box';
    }
    var ac=document.getElementById('yt_start');
    if(ac) ac.disabled=!!(jb.running||(j.auth&&j.auth.running));
    window.ytCh=j.channels||{};
    var up=j.uploadedIds||[];
    if(JSON.stringify(up)!==JSON.stringify(window.ytUploadedIds||[])){
      window.ytUploadedIds=up;
      lastGridKey='';
      if(typeof render==='function') render();
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
  document.getElementById('yt_pickcount').textContent=n+' / 6 Selected';
  var b=document.getElementById('yt_start');
  b.disabled=(ytBusy||n===0||n>6);
  b.textContent='\u{1F680} UPLOAD SELECTED ('+n+') VIDEOS';
}
function ytRenderPicker(){
  var q=(document.getElementById('yt_picksearch').value||'').toLowerCase();
  var upIds=window.ytUploadedIds||[];
  var rows=(typeof duas!=='undefined'?duas:[]).filter(function(d){
    if(!d.videoFile) return false;
    if(upIds.indexOf(d.id)>=0) return false;
    return !q||d.title.toLowerCase().includes(q)||d.id.toLowerCase().includes(q)||(d.reference||'').toLowerCase().includes(q);
  });
  var keys=Object.keys(ytSel);
  var el=document.getElementById('yt_picklist');
  if(!rows.length){
    el.innerHTML='<div style="font-size:12px;color:#5a6474;padding:16px;text-align:center">Koi rendered dua nahi mili</div>';
    return;
  }
  var frag=document.createDocumentFragment();
  rows.forEach(function(d){
    var on=!!ytSel[d.id];
    var pos=on?(keys.indexOf(d.id)+1):null;
    var isUploaded=(window.ytUploadedIds||[]).indexOf(d.id)>=0;
    var card=document.createElement('div');
    card.className='card picker-card'+(on?' selected':'');
    card.setAttribute('data-id',d.id);
    card.onclick=function(){ ytToggleDua(d.id); };
    var thumb=d.thumbFile
      ?'<img class="card-thumb" src="/thumb/'+encodeURIComponent(d.thumbFile)+'" loading="lazy" style="cursor:default">'
      :'<div class="card-thumb" style="display:flex;align-items:center;justify-content:center;color:#39445a;font-size:18px">&#9654;</div>';
    card.innerHTML=thumb
      +'<div class="card-body">'
        +'<div class="card-ref">'+(d.reference||'&nbsp;')+'</div>'
        +'<div class="card-title">'+ytEsc(d.title)+'</div>'
        +'<div class="card-meta">'
          +'<span class="b ok">Ready</span>'
          +(isUploaded?'<span class="pi-up">&#10003; Uploaded</span>':'')
        +'</div>'
      +'</div>'
      +'<div class="card-actions" style="align-items:center;gap:4px">'
        +'<div class="pi-check">'+(on?'&#10003;':'')+'</div>'
        +(pos?'<div class="pi-pos">'+pos+'</div>':'')
      +'</div>';
    frag.appendChild(card);
  });
  el.innerHTML='';
  el.appendChild(frag);
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
function cardYtToggle(id){
  if(ytSel[id]){
    delete ytSel[id];
    ytUpdateCount();
    ytRenderPicker();
    lastGridKey=''; render();
    toast('Selection hat gayi: '+id,'ok');
    return;
  }
  if(window.ytUploadedIds&&ytUploadedIds.indexOf(id)>=0&&!confirm('Ye pehle upload ho chuki hai (ledger). Phir bhi select karni hai?'))return;
  if(Object.keys(ytSel).length>=6){toast('Max 6 videos ek run me select kar sakte ho','err');return;}
  ytSel[id]=true;
  ytUpdateCount();
  ytRenderPicker();
  lastGridKey=''; render();
  toast('Select ho gayi - YouTube me already selected dikhegi','ok');
}
function quickUpload(id){
  if(window.ytUploadedIds&&ytUploadedIds.indexOf(id)>=0&&!confirm('Ye pehle upload ho chuki hai (ledger). Phir bhi select karni hai?'))return;
  if(!ytSel[id]){
    if(Object.keys(ytSel).length>=6){toast('Max 6 videos ek run me select kar sakte ho','err');return;}
    ytSel[id]=true;
  }
  var p=document.getElementById('ytHub');
  if(p&&p.style.display==='none')ytToggle('upload');
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
  var mode=document.getElementById('yt_mode').value;
  if(mode==='live'&&!confirm('LIVE MODE - Asli YouTube pe upload hoga. Confirm karo?'))return;
  var b=document.getElementById('yt_start');b.disabled=true;b.textContent='Uploading...';
  const bodyObj={
    channel:document.getElementById('yt_channel').value,
    privacy:document.getElementById('yt_privacy').value,
    mode:mode,
    selectedDuas:sel};
  const body=JSON.stringify(bodyObj);
  try{
    const r=await fetch('/api/youtube/upload',{method:'POST',headers:{'Content-Type':'application/json'},body});
    const j=await r.json();
    if(!j.ok){b.disabled=false;b.textContent='\u{1F680} UPLOAD SELECTED ('+sel.length+') VIDEOS';toast(j.error||'Upload start fail','err');return;}
    toast('Upload start: '+j.channel+' '+mode+' x'+j.selectedCount,mode==='live'?'ok':'warn');
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
  const done=list.filter(d=>d.videoFile).length;
  const total=list.length;
  const busyKey=busy?jobDua:'';
  const key=total+':'+done+':'+busyKey+':'+searchTerm+':'+activeCat;
  if(key===lastGridKey)return;
  lastGridKey=key;
  const grid=document.getElementById('grid');
  if(!total){grid.innerHTML='<div class="empty">Koi dua nahi mili</div>';return;}
  const frag=document.createDocumentFragment();
  list.forEach(d=>{
    const vid=d.videoFile;
    const el=document.createElement('div');
    el.className='card'+(vid?' rendered':'')+((busy&&jobDua===d.id)?' active-job':'');
    const thumb=d.thumbFile
      ?'<img class="card-thumb" src="/thumb/'+encodeURIComponent(d.thumbFile)+'" loading="lazy" '+(vid?'onclick="openPlayer(\''+encodeURIComponent(vid)+'\')" style="cursor:pointer"':'')+' >'
      :'<div class="card-thumb" style="display:flex;align-items:center;justify-content:center;color:#39445a;font-size:18px">&#9654;</div>';
    const ytOn=!!ytSel[d.id];
    const upIds=window.ytUploadedIds||[];
    const isUp=upIds.indexOf(d.id)>=0;
    const ref=String(d.reference||'').trim();
    el.innerHTML=
      '<div class="card-tt thumb">'
      + (isUp?'<span class="up-badge">&#10003;&#65039; Uploaded</span>':'')
      + (thumb?thumb:'<div class="card-thumb ph"><span>&#9654;</span></div>')
      +'</div>'
      +'<div class="card-body">'
        +(ref?'<div class="card-ref" title="'+escHtml(ref)+'">'+escHtml(ref)+'</div>':'')
        +'<div class="card-title" title="'+escHtml(d.title)+'">'+escHtml(d.title)+'</div>'
        +'<div class="card-meta">'
          +(vid?'<span class="b ok">Done</span>':(d.audioReady?'<span class="b warn">Pending</span>':'<span class="b no">No Audio</span>'))
          +(d.videoMB?'<span class="b mb">'+d.videoMB+'</span>':'')
          +(d.category?'<span class="b cat">'+escHtml(d.category)+'</span>':'')
          +(isUp?'<span class="b up">&#10003; Uploaded</span>':'')
        +'</div>'
      +'</div>'
      +'<div class="card-actions">'
        +(ytOn?'<button class="btn-icon sel" title="YouTube me selected - hatao" onclick="cardYtToggle(\''+d.id+'\')">&#10003;</button>'
             :'<button class="btn-icon'+(isUp?' upi':'')+'" title="'+(isUp?'Ye pehle upload ho chuki hai':'YouTube ke liye select karo')+'" onclick="cardYtToggle(\''+d.id+'\')">'+ (isUp?'&#9679;':'&#9711;') +'</button>')
        +'<button class="btn-icon del" title="Hamesha ke liye delete" onclick="delDua(\''+d.id+'\')">&#128465;</button>'
        +'<div class="spacer"></div>'
        +(vid?'<button class="btn-play" onclick="openPlayer(\''+encodeURIComponent(vid)+'\')">PLAY</button>'
          :(isUp?'<span class="btn-render uploaded-lock" title="Ye dua YouTube pe upload ho chuki hai. TTS dubara banane ki zaroorat nahi.">&#10003; Uploaded</span>'
            :'<button class="btn-render" '+(busy?'disabled':'')+' onclick="startRender(\''+d.id+'\')">'+(d.audioReady?'Render':'TTS')+'</button>'))
      +'</div>'
      +'<div class="card-pop">'
        +(ref?'<div class="cpop-ref">'+escHtml(ref)+'</div>':'')
        +'<div class="cpop-title">'+escHtml(d.title)+'</div>'
        +(d.arabic?'<div class="cpop-arabic">'+escHtml(d.arabic)+'</div>':'')
        +(d.urdu?'<div class="cpop-urdu">'+escHtml(d.urdu)+'</div>':'')
        +(d.explanation?'<div class="cpop-exp">'+escHtml(d.explanation)+'</div>':'')
        +'<div class="cpop-meta">'
          +(vid?'<span class="b ok">Done</span>':(d.audioReady?'<span class="b warn">Pending</span>':'<span class="b no">No Audio</span>'))
          +(d.videoMB?'<span class="b mb">'+d.videoMB+'</span>':'')
          +(d.category?'<span class="b cat">'+escHtml(d.category)+'</span>':'')
        +'</div>'
      +'</div>';
    frag.appendChild(el);
  });
  grid.innerHTML='';
  grid.appendChild(frag);
}

async function startRender(id){
  const force=!!forceFlags[id];
  const r=await fetch('/api/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({duaId:id,force})});
  const j=await r.json(); if(!j.ok) toast(j.error,'err');
}
async function aiFillCard(id){
  var d=duas.find(function(x){return x.id===id;});
  if(!d)return;
  var btn=document.querySelector('.cpop-actions .btn-ai-fill');
  if(btn){btn.disabled=true;btn.textContent='Generating...';}
  try{
    var r=await fetch('/api/ai-fill-metadata',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({title:d.title,reference:d.reference||'',category:d.category||'general'})});
    var j=await r.json();
    if(j.ok){
      editingId=d.id;
      document.getElementById('modaltitle').innerHTML='&#9998; Edit: '+escHtml(d.title);
      document.getElementById('f_title').value=d.title||'';
      document.getElementById('f_arabic').value=j.arabic||d.arabic||'';
      document.getElementById('f_urdu').value=j.urdu||d.urdu||'';
      document.getElementById('f_ref').value=d.reference||'';
      document.getElementById('f_cat').value=d.category||'general';
      setThemeSel(d.template&&THEME_LABEL[d.template]?d.template:'dark');
      document.getElementById('modalbg').classList.add('show');
      _pushModal('form');
      toast('AI se metadata generate ho gaya! Check karke Save karo','ok');
    }else{
      toast(j.error||'AI fill fail','err');
    }
  }catch(e){toast('Network error: '+e.message,'err');}
  if(btn){btn.disabled=false;btn.textContent='\u{1F916} AI Fill';}
}
function toast(msg,type){
  const t=document.createElement('div'); t.className='toast '+type; t.textContent=msg;
  document.getElementById('toasts').appendChild(t);
  setTimeout(()=>t.remove(),5000);
}
// ── Live dedup alerts (add/edit form) ──
function normDedup(s){return String(s==null?'':s).replace(/\s+/g,' ').trim().toLowerCase();}
function normArDedup(s){return normDedup(s).replace(/[\u064B-\u065F\u0670\u0640]/g,'');}
function simDedup(a,b){
  const len=Math.max(a.length,b.length);
  if(!len)return 0;
  let m=0;
  for(let i=0;i<a.length;i++)if(a[i]===b[i])m++;
  return m/len;
}
function dedupHit(field,val){
  const v=(field==='arabic'?normArDedup:normDedup)(val);
  if(v.length<3)return null;
  const norm=(field==='arabic'?normArDedup:normDedup);
  for(const d of duas){
    if(editingId&&d.id===editingId)continue;
    const t=norm(d[field]);
    if(!t||t.length<3)continue;
    if(t===v||simDedup(v,t)>=0.90)return d;
  }
  return null;
}
function checkDedupLive(){
  const alert=document.getElementById('dedupalert');
  if(!alert)return;
  const checks=[['title','f_title'],['arabic','f_arabic'],['urdu','f_urdu']];
  for(const c of checks){
    const el=document.getElementById(c[1]);
    const v=el&&el.value;
    if(v&&v.trim()){
      const hit=dedupHit(c[0],v.trim());
      if(hit){
        const fieldLabel=c[0]==='title'?('title "'+hit.title+'"'):(c[0]==='arabic'?'Arabic text':'Urdu tarjuma');
        alert.style.display='block';
        alert.innerHTML='&#9888;&#65039; Duplicate! <b>'+escHtml(hit.title)+'</b> ('+hit.id+') me ye '+fieldLabel+' already maujood hai';
        return;
      }
    }
  }
  alert.style.display='none';
}
function ensureDedupAlert(){
  let el=document.getElementById('dedupalert');
  if(el)return el;
  const mb=document.querySelector('#modalbg .mbtns');
  if(!mb)return null;
  el=document.createElement('div');
  el.id='dedupalert';
  el.className='dedupalert';
  el.style.cssText='margin:12px 0 0;padding:10px 12px;border-radius:8px;background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.35);color:#e6c46a;font-size:12.5px;line-height:1.5;display:none';
  mb.parentNode.insertBefore(el,mb);
  return el;
}
let dedupT=null;
function checkDedupLiveDebounced(){
  if(dedupT)clearTimeout(dedupT);
  dedupT=setTimeout(()=>{dedupT=null;checkDedupLive();},350);
}
(function(){
  ['f_title','f_arabic','f_urdu'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.addEventListener('input',checkDedupLiveDebounced);
  });
})();
function scheduleBarHide(){
  if(autoHideBarT)clearTimeout(autoHideBarT);
  autoHideBarT=setTimeout(()=>{
    autoHideBarT=null;
    if(!busy){
      barHidden=true;
      const b=document.getElementById('jobbar');
      if(b)b.classList.remove('show');
    }
  },6000);
}
function openPlayer(enc){
  const name=decodeURIComponent(enc);
  const v=document.getElementById('pvid');
  v.src='/video/'+enc+'?ts='+Date.now();
  document.getElementById('pname').textContent=name;
  document.getElementById('playerbg').classList.add('show');
  _pushModal('player');
  v.play();
}
function closePlayer(){
  const v=document.getElementById('pvid'); v.pause(); v.src='';
  document.getElementById('playerbg').classList.remove('show');
  _popModal('player');
}
function dismissBar(){ barHidden=true; document.getElementById('jobbar').classList.remove('show'); }
async function poll(){
  try{
    const j=await (await fetch('/api/status')).json();
    window.jobDua=j.duaId; busy=j.running;
    if(j.running){
      barHidden=false;
      if(autoHideBarT){clearTimeout(autoHideBarT);autoHideBarT=null;}
    }
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
      // Escape HTML to prevent XSS
      const html=recent.map(l=>'<span class="'+logClass(l)+'">'+escHtml(l)+'</span>').join('\n');
      if(lb.dataset.prev!==html){lb.innerHTML=html;lb.scrollTop=lb.scrollHeight;lb.dataset.prev=html;}
    }
    const jb=document.getElementById('jbatch');
    const jc=document.getElementById('jcancel');
    if(j.queue&&j.queue.active){
      jc.style.display='inline-block';
      jb.style.display='inline';
      const qt=j.queue.total||0;
      const qp=qt?Math.round((j.queue.done||0)*100/qt):0;
      jb.textContent=qp+'% '+(j.queue.idx)+'/'+qt+
        ' \u2705'+j.queue.done+' \u274C'+(j.queue.failed?j.queue.failed.length:0)+
        (j.queue.skipped&&j.queue.skipped.length?(' \u23ED'+j.queue.skipped.length):'')+
        ' | '+(j.duaId||'-');
    }else{jb.style.display='none';jc.style.display='none';}
    document.title = j.running ? (j.percent + '% - Dua Studio') : 'Dua Video Studio';
    if(prevStep && prevStep!=='done' && j.step==='done' && !j.running){
      toast('\u2705 '+(j.lastVideo||'Video').split('\\').pop()+' ready!','ok');
      lastGridKey=''; load();
      scheduleBarHide();
    }
    if(prevStep && prevStep!=='failed' && j.step==='failed' && !j.running){
      toast('\u274C Render failed: '+j.error,'err');
      lastGridKey=''; load();
      scheduleBarHide();
    }
    prevStep=j.step;
    const qa=!!(j.queue&&j.queue.active);
    if(prevQueueActive&&!qa){
      const qt=(j.queue&&j.queue.total)||0;
      const qd=(j.queue&&j.queue.done)||0;
      toast(qt?('\u26A1 Batch complete: '+qd+'/'+qt+' done'):'\u26A1 Batch complete','ok');
      lastGridKey=''; load();
      scheduleBarHide();
    }
    prevQueueActive=qa;
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
let vpReady=false;
let waveSurfer=null;
let vpGen=0;
let vpBlobUrl=null;
function vpTimeFmt(s){ if(!isFinite(s)||s<0)s=0; const m=Math.floor(s/60),x=Math.floor(s%60); return m+':'+('0'+x).slice(-2); }
function vpSetBtn(playing){ const b=document.getElementById('vp_play'); if(b) b.innerHTML=playing?'&#10074;&#10074; Pause':'&#9654; Play'; }
function vpReset(){ vpReady=false; if(waveSurfer){ try{ waveSurfer.destroy(); }catch(_){} waveSurfer=null; } if(vpBlobUrl){ try{ URL.revokeObjectURL(vpBlobUrl); }catch(_){} vpBlobUrl=null; } const t=document.getElementById('vp_time'); if(t) t.textContent='0:00 / 0:00'; vpSetBtn(false); }
async function vpLoad(url){
  const gen=++vpGen;
  document.getElementById('voiceplayer').style.display='block';
  vpReset();
  const time=document.getElementById('vp_time');
  const fail=(msg)=>{ if(gen!==vpGen)return; if(time)time.textContent=msg; vpSetBtn(false); };
  if(typeof WaveSurfer==='undefined')return fail('Waveform library load nahi hui');
  try{
    const res=await fetch(url);
    if(gen!==vpGen)return;
    if(!res.ok)return fail('Audio file nahi mili (HTTP '+res.status+')');
    const bl=await res.blob();
    if(gen!==vpGen)return;
    const ab=await bl.arrayBuffer();
    if(!ab.byteLength)return fail('Audio file khaali hai');
    let probe=null;
    try{ probe=new OfflineAudioContext(1,1,8000); await probe.decodeAudioData(ab); }
    finally{ try{ if(probe)probe.close(); }catch(_){} }
    if(gen!==vpGen)return;
    const blobUrl=URL.createObjectURL(bl);
    vpBlobUrl=blobUrl;
    const ws=WaveSurfer.create({
      container:'#ap_voice',
      url:blobUrl,
      height:80,
      barWidth:2,
      barGap:1,
      barRadius:2,
      barMinHeight:1,
      waveColor:'#3d4452',
      progressColor:'#d4af37',
      cursorColor:'#e6c46a',
      cursorWidth:1.5,
      hideScrollbar:true
    });
    if(gen!==vpGen){ try{ ws.destroy(); }catch(_){} return; }
    waveSurfer=ws;
    let ready=false;
    const wd=setTimeout(()=>{ if(gen===vpGen&&!ready){ if(waveSurfer===ws){ try{ ws.destroy(); }catch(_){} waveSurfer=null; } fail('Audio load me waqt lag gaya (timeout)'); } },10000);
    const stale=()=>gen!==vpGen||waveSurfer!==ws;
    ws.on('ready',()=>{ ready=true; vpReady=true; clearTimeout(wd); if(stale())return; if(time)time.textContent='0:00 / '+vpTimeFmt(ws.getDuration()); });
    ws.on('timeupdate',(c)=>{ if(stale())return; if(time)time.textContent=vpTimeFmt(c)+' / '+vpTimeFmt(ws.getDuration()); });
    ws.on('play',()=>{ if(stale())return; vpSetBtn(true); });
    ws.on('pause',()=>{ if(stale())return; vpSetBtn(false); });
    ws.on('finish',()=>{ if(stale())return; vpSetBtn(false); if(time)time.textContent='0:00 / '+vpTimeFmt(ws.getDuration()); });
    ws.on('error',()=>{ if(stale())return; ready=true; vpReady=false; clearTimeout(wd); fail('Audio load/decode fail'); });
  }catch(e){ if(gen===vpGen)fail('Audio load fail: '+(e&&e.message?e.message:e)); }
}
function vpToggle(){ if(!waveSurfer||!vpReady)return; waveSurfer.playPause(); }
function openVoice(){
  const sel=document.getElementById('v_dua');
  sel.innerHTML=duas.map(d=>'<option value="'+d.id+'">'+escHtml(d.title)+'</option>').join('');
  document.getElementById('voiceplayer').style.display='none';
  vpGen++;
  vpReset();
  setVoiceMsg('','');
  document.getElementById('voicebg').classList.add('show');
  _pushModal('voice');
}
function closeVoice(){ vpGen++; vpReset(); document.getElementById('voicebg').classList.remove('show'); _popModal('voice'); }
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
      vpLoad('/audio/'+j.savedFile+'?v='+j.ts);
      setVoiceMsg('\u2705 Ban gayi! AUDIO folder me save: '+j.savedFile,'ok');
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
        vpLoad('/temp-voice/'+id+'?v='+Date.now());
        setVoiceMsg('\u2705 Ready! Neeche play dabao','ok');
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
  if(!confirm('Saari PENDING videos banayen ge?\nJo bani hain wo automatically skip ho jayengi'))return;
  const r=await fetch('/api/render-all',{method:'POST'});
  const j=await r.json();
  if(j.ok){toast('\u26A1 Batch shuru: '+j.total+' videos','ok');barHidden=false;}
  else toast(j.error||'Fail hua','err');
}
async function cancelJob(){
  const r=await fetch('/api/cancel',{method:'POST'});
  const j=await r.json();
  if(j.ok)toast(j.batch?'\u23F9 Batch cancel ho raha hai...':'\u23F9 Job cancel ho raha hai...','ok');
}
async function openHistory(){
  document.getElementById('histbg').classList.add('show');
  _pushModal('history');
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
function closeHistory(){document.getElementById('histbg').classList.remove('show');_popModal('history');}
function escHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function thumbsAll(){
  if(busy)return toast('Pehle chalta hua job khatam hone do','err');
  if(!confirm('Jo videos ke thumbnails nahi hain, sab banayen ge?'))return;
  const r=await fetch('/api/thumbs-all',{method:'POST'});
  const j=await r.json();
  if(j.ok)toast('\uD83D\uDDBC\uFE0F Thumbnails ban rahe hain - log dekho','ok');
  else toast(j.error||'Fail hua','err');
}
function openSettings(){
  setStatusMsg('Loading...','');
  document.getElementById('setbg').classList.add('show');
  _pushModal('settings');
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
    setStatusMsg('','');
  }).catch(e=>{
    setStatusMsg('Settings load fail: '+e.message,'err');
    if(typeof toast==='function') toast('Settings load fail: '+e.message,'err');
  });
  ytRefresh();
}
function closeSettings(){ document.getElementById('setbg').classList.remove('show'); _popModal('settings'); }
function openHelp(){ document.getElementById('helpbg').classList.add('show'); _pushModal('help'); tabHelp('ro'); }
function closeHelp(){ document.getElementById('helpbg').classList.remove('show'); _popModal('help'); }
async function openUploadedList(){
  var hub=document.getElementById('ytHub');
  if(hub.style.display==='none'){ hub.style.display='block'; _pushModal('ytHub'); ytTab('uploaded'); }
  var statusEl=document.getElementById('yt_up_status');
  var statbarEl=document.getElementById('yt_up_statbar');
  var listEl=document.getElementById('uploaded_list');
  statusEl.innerHTML='&#128269; Loading...';
  statbarEl.innerHTML='';
  listEl.innerHTML='';
  try{
    const r=await fetch('/api/youtube/uploaded');
    const j=await r.json();
    if(!j.ok||!j.items.length){
      statusEl.innerHTML='&#9898; Koi video upload nahi hui';
      statbarEl.innerHTML='<div class="yt-stat"><div class="val">0</div><div class="lbl">Total</div></div>'
        +'<div class="yt-stat"><div class="val">0</div><div class="lbl">Subscribers</div></div>'
        +'<div class="yt-stat"><div class="val">0</div><div class="lbl">Ch Views</div></div>'
        +'<div class="yt-stat"><div class="val">0</div><div class="lbl">Video Likes</div></div>';
      listEl.innerHTML='<div style="text-align:center;padding:24px;color:#5a6474;font-size:12px">Pehle Upload tab se videos upload karo.</div>';
      return;
    }
    var pcs={public:'rgba(63,185,80,.12);color:#56d364',unlisted:'rgba(212,175,55,.12);color:#e6c46a',private:'rgba(255,99,99,.1);color:#ff8585'};
    var ch1=j.items.filter(function(u){return u.channel==='channel1';}).length;
    var ch2=j.items.filter(function(u){return u.channel==='channel2';}).length;
    var withLinks=j.items.filter(function(u){return u.url;}).length;
    statusEl.innerHTML='&#9745; <b>'+j.items.length+'</b> videos uploaded ('+ch1+' ch1, '+ch2+' ch2)';
    statbarEl.innerHTML='<div class="yt-stat"><div class="val">'+j.items.length+'</div><div class="lbl">Uploaded</div></div>'
      +'<div class="yt-stat"><div class="val" id="yt_up_subs">...</div><div class="lbl">Subscribers</div></div>'
      +'<div class="yt-stat"><div class="val" id="yt_up_chviews">...</div><div class="lbl">Ch Views</div></div>'
      +'<div class="yt-stat"><div class="val" id="yt_up_vidlikes">...</div><div class="lbl">Video Likes</div></div>';
    listEl.innerHTML='<div class="yt-uploaded-wrap"><table class="yt-uploaded"><thead><tr><th>#</th><th>Title</th><th>Ch</th><th>Views</th><th>Likes</th><th>Comments</th><th>Date</th><th></th></tr></thead><tbody>'
      +j.items.map(function(u,i){
      var date=u.uploadedAt?new Date(u.uploadedAt).toLocaleDateString('en-PK',{day:'numeric',month:'short'}):'';
      var sty=pcs[u.privacy]||'';
      return '<tr>'
        +'<td>'+(i+1)+'</td>'
        +'<td class="url-col"><a href="'+(u.url||'#')+'" target="_blank">'+ytEsc(u.title)+'</a></td>'
        +'<td class="ch-col">'+(u.channel==='channel1'?'1':'2')+'</td>'
        +'<td data-stat="views-'+u.videoId+'"><span style="color:#5a6474">-</span></td>'
        +'<td data-stat="likes-'+u.videoId+'"><span style="color:#5a6474">-</span></td>'
        +'<td data-stat="comments-'+u.videoId+'"><span style="color:#5a6474">-</span></td>'
        +'<td>'+date+'</td>'
        +'<td>'
          +'<button class="btn-sm" onclick="ytCopySingle(\''+ytEsc(u.url||'')+'\')" title="Copy link">&#128203;</button> '
          +'<button class="btn-sm gold" onclick="reUpload(\''+ytEsc(u.duaId)+'\',\''+ytEsc(u.channel)+'\')" title="Re-upload">&#8635;</button>'
        +'</td>'
      +'</tr>';
    }).join('')
      +'</tbody></table></div>';
    window.ytLastLinks=j.items.filter(function(u){return u.url;}).map(function(u){return {title:u.title,url:u.url};});
    var vidIds=j.items.map(function(u){return u.videoId;}).filter(Boolean);
    var channels=new Set(j.items.map(function(u){return u.channel;}));
    var activeCh=channels.has('channel1')?'channel1':'channel2';
    // Stats fetch with timeout and error handling
    var statsUrl='/api/youtube/stats?channel='+activeCh+(vidIds.length?'&ids='+encodeURIComponent(vidIds.join(',')):'');
    var statsTimeout=setTimeout(function(){
      var els=document.querySelectorAll('[data-stat]');
      els.forEach(function(el){if(el.textContent==='...')el.textContent='--';});
    },8000);
    fetch(statsUrl).then(function(sr){
      clearTimeout(statsTimeout);
      if(!sr.ok)throw new Error('Stats HTTP '+sr.status);
      return sr.json();
    }).then(function(sj){
      clearTimeout(statsTimeout);
      if(!sj.ok){
        document.querySelectorAll('[data-stat]').forEach(function(el){if(el.textContent==='...')el.textContent='--';});
        return;
      }
      if(sj.channel){
        var ch=sj.channel;
        var subEl=document.getElementById('yt_up_subs');
        var cvEl=document.getElementById('yt_up_chviews');
        if(subEl)subEl.textContent=ch.hiddenSubscriberCount?'Hidden':ch.subscriberCount.toLocaleString();
        if(cvEl)cvEl.textContent=ch.viewCount.toLocaleString();
        statusEl.innerHTML='&#9745; <b>'+j.items.length+'</b> videos uploaded &mdash; '+ch.title+' ('+ch.subscriberCount.toLocaleString()+' subs)';
      }
      if(sj.stats){
        j.items.forEach(function(u){
          if(!u.videoId||!sj.stats[u.videoId])return;
          var st=sj.stats[u.videoId];
          var vEl=document.querySelector('[data-stat="views-'+u.videoId+'"]');
          var lEl=document.querySelector('[data-stat="likes-'+u.videoId+'"]');
          var cEl=document.querySelector('[data-stat="comments-'+u.videoId+'"]');
          if(vEl)vEl.textContent=st.viewCount!=null?st.viewCount.toLocaleString():'-';
          if(lEl)lEl.textContent=st.likeCount!=null?st.likeCount.toLocaleString():'-';
          if(cEl)cEl.textContent=st.commentCount!=null?st.commentCount.toLocaleString():'-';
        });
        var totalL=Object.values(sj.stats).reduce(function(s,x){return s+(x.likeCount||0);},0);
        var vlEl=document.getElementById('yt_up_vidlikes');
        if(vlEl)vlEl.textContent=totalL.toLocaleString();
      }
    }).catch(function(e){
      clearTimeout(statsTimeout);
      document.querySelectorAll('[data-stat]').forEach(function(el){if(el.textContent==='...')el.textContent='--';});
    });
    startYtStatsAuto();
  }catch(e){
    statusEl.innerHTML='&#10060; Load fail';
    listEl.innerHTML='';
  }
}

// ── Auto-refresh YouTube stats every 30s while Uploaded tab is open ──
var ytStatsAutoT=null;
function startYtStatsAuto(){
  if(!ytStatsAutoT){
    ytStatsAutoT=setInterval(function(){
      var hub=document.getElementById('ytHub');
      if(!hub||hub.style.display==='none'){clearInterval(ytStatsAutoT);ytStatsAutoT=null;return;}
      if(ytHubTab==='uploaded'){
        refreshUploadedStatsOnly();
      }
    },30000);
  }
}
function stopYtStatsAuto(){
  if(ytStatsAutoT){clearInterval(ytStatsAutoT);ytStatsAutoT=null;}
}
// Refresh only the stats (channel + per-video) without rebuilding table.
async function refreshUploadedStatsOnly(){
  try{
    const r=await fetch('/api/youtube/uploaded');
    const j=await r.json();
    if(!j.ok||!j.items.length)return;
    var vidIds=j.items.map(function(u){return u.videoId;}).filter(Boolean);
    var channels=new Set(j.items.map(function(u){return u.channel;}));
    var activeCh=channels.has('channel1')?'channel1':'channel2';
    fetch('/api/youtube/stats?channel='+activeCh+(vidIds.length?'&ids='+encodeURIComponent(vidIds.join(',')):'')).then(function(sr){return sr.json()}).then(function(sj){
      if(!sj.ok)return;
      if(sj.channel){
        var ch=sj.channel;
        var subEl=document.getElementById('yt_up_subs');
        var cvEl=document.getElementById('yt_up_chviews');
        if(subEl)subEl.textContent=ch.hiddenSubscriberCount?'Hidden':ch.subscriberCount.toLocaleString();
        if(cvEl)cvEl.textContent=ch.viewCount.toLocaleString();
        var statusEl=document.getElementById('yt_up_status');
        if(statusEl)statusEl.innerHTML='&#9745; <b>'+j.items.length+'</b> videos uploaded &mdash; '+ch.title+' ('+ch.subscriberCount.toLocaleString()+' subs)';
      }
      if(sj.stats){
        j.items.forEach(function(u){
          if(!u.videoId||!sj.stats[u.videoId])return;
          var st=sj.stats[u.videoId];
          var vEl=document.querySelector('[data-stat="views-'+u.videoId+'"]');
          var lEl=document.querySelector('[data-stat="likes-'+u.videoId+'"]');
          var cEl=document.querySelector('[data-stat="comments-'+u.videoId+'"]');
          if(vEl)vEl.textContent=st.viewCount!=null?st.viewCount.toLocaleString():'-';
          if(lEl)lEl.textContent=st.likeCount!=null?st.likeCount.toLocaleString():'-';
          if(cEl)cEl.textContent=st.commentCount!=null?st.commentCount.toLocaleString():'-';
        });
        var totalL=Object.values(sj.stats).reduce(function(s,x){return s+(x.likeCount||0);},0);
        var vlEl=document.getElementById('yt_up_vidlikes');
        if(vlEl)vlEl.textContent=totalL.toLocaleString();
      }
    }).catch(function(){});
  }catch(e){}
}
async function reUpload(duaId,channel){
  if(!confirm('⚠️ Re-Upload: "'+duaId+'" ka ledger entry hatayein?\n\nYe video dubara upload ke liye available ho jayegi.\nChannel: '+channel))return;
  try{
    const r=await fetch('/api/youtube/re-upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({duaId,channel})});
    const j=await r.json();
    if(j.ok){ toast(duaId+' ledger se hataya - dubara upload kar sakte ho','ok'); lastGridKey='';load(); openUploadedList(); }
    else toast(j.error||'Fail','err');
  }catch(e){toast('Network error','err');}
}
function ytCopySingle(url){
  if(!url)return;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(url).then(()=>toast('Link copied','ok'),()=>toast('Copy fail','err'));
  }else toast('Copy not supported','err');
}
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
function setStatusMsg(t,c){ const m=document.getElementById('setmsg'); m.textContent=t; m.className='formmsg '+c; }
async function saveSettings(){
  const channelName=document.getElementById('s_name').value.trim();
  const handle=document.getElementById('s_handle').value.trim();
  if(!channelName){
    setStatusMsg('Channel Name zaroori hai','err');
    return;
  }
  if(channelName.length>60){
    setStatusMsg('Channel Name 60 characters se kam hona chahiye','err');
    return;
  }
  if(handle.length>40){
    setStatusMsg('Handle 40 characters se kam hona chahiye','err');
    return;
  }
  try{
    const r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channelName:channelName,handle:handle,stylePreset:document.getElementById('s_style').value,lookMode:((document.querySelector('input[name=s_look]:checked')||{}).value||'random'),artFx:document.getElementById('s_art').value,skyFx:document.getElementById('s_sky').value,borderFx:document.getElementById('s_border').value})});
    const j=await r.json();
    if(j.ok){setStatusMsg('\u2705 Save ho gaya! Agla render in settings se banega.','ok');}
    else setStatusMsg(j.error||'Save fail hua','err');
  }catch(e){
    setStatusMsg('Network error: '+e.message,'err');
    if(typeof toast==='function') toast('Settings save fail: '+e.message,'err');
  }
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
    '4. 5 hashtags'].join('\n');
  try{await navigator.clipboard.writeText(p);toast('\uD83D\uDCCB AI metadata prompt copy! Gemini pe paste karo','ok');}
  catch(e){toast('Copy fail hua','err');}
}
let _modalStack=[];
let _previousFocus=null;
function _pushModal(id){
  _previousFocus=document.activeElement;
  _modalStack.push(id);
  _trapFocus(id);
}
function _popModal(id){
  _modalStack=_modalStack.filter(x=>x!==id);
  if(_previousFocus&&_previousFocus.focus){_previousFocus.focus();_previousFocus=null;}
}
function _trapFocus(modalId){
  var modal=document.getElementById(modalId==='form'?'modalbg':
    modalId==='ai'?'aimodalbg':modalId==='voice'?'voicebg':
    modalId==='settings'?'setbg':modalId==='help'?'helpbg':
    modalId==='history'?'histbg':modalId==='vfx'?'vfxbg':null);
  if(!modal)return;
  var focusable=modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
  if(!focusable.length)return;
  var first=focusable[0];
  var last=focusable[focusable.length-1];
  modal.addEventListener('keydown',function(e){
    if(e.key!=='Tab')return;
    if(e.shiftKey){
      if(document.activeElement===first){e.preventDefault();last.focus();}
    }else{
      if(document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  setTimeout(function(){first.focus();},100);
}
function _closeTopModal(){
  if(!_modalStack.length)return;
  var last=_modalStack.pop();
  if(last==='player')closePlayer();
  else if(last==='form')closeForm();
  else if(last==='ai')closeAi();
  else if(last==='voice')closeVoice();
  else if(last==='settings')closeSettings();
  else if(last==='help')closeHelp();
  else if(last==='history')closeHistory();
  else if(last==='ytHub')ytHubClose();
  else if(last==='vfx')closeVfxStudio();
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();_closeTopModal();}
});
function openForm(){ editingId=null; document.getElementById('modaltitle').innerHTML='&#10133; Nayi Dua Add Karo'; document.getElementById('f_bis').checked=true; document.getElementById('modalbg').classList.add('show'); _pushModal('form'); setMsg('',''); ensureDedupAlert(); checkDedupLive(); }
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
'{"title":"Roman Urdu short title","arabic":"harakat ke sath Arabic","urdu":"max 60 words tarjuma","reference":"Sahih Bukhari 1234","category":"travel"}'].join('\n');
function openAi(){
  document.getElementById('aimodalbg').classList.add('show');
  _pushModal('ai');
  document.getElementById('ai_raw').value='';
  setAiMsg('','');
  detectAI();
}
function closeAi(){ document.getElementById('aimodalbg').classList.remove('show'); _popModal('ai'); }
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
    ?'\u2705 <b>Chrome ka built-in Gemini mil gaya!</b> Koi bhi raw text paste karo - khud parse kar lega.'
    :'\u2139\uFE0F Built-in AI nahi mila (Chrome purana hai ya off hai) - koi baat nahi, gemini.google.com wala flow use karo, wo hamesha kaam karega.';
}
function copyPrompt(){
  navigator.clipboard.writeText(GEMINI_PROMPT)
    .then(()=>toast('\uD83D\uDCCB Prompt copy ho gaya! gemini.google.com pe paste karo','ok'))
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
    return setAiMsg('\u26D4 Bohot lambi dua! Tarjuma '+urduWords+' words hai (max 60). Video 40 sec se lambi banegi aur RENDER FAIL hogi. Gemini se chhoti tarjuma mangwao','err');
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
  _pushModal('form');
  ensureDedupAlert(); checkDedupLive();
  const wc=(String(o.urdu||'').trim().match(/\\S+/g)||[]).length;
  toast('\u2728 Form bhar diya ('+wc+' words) - check karke SAVE dabao','ok');
}
async function delDua(id){
  const d=duas.find(x=>x.id===id); if(!d)return;
  if(!confirm('"'+d.title+'" HAMESHA KE LIYE delete karein?\nSab kuch mit jayega: audio, video mp4, thumbnail, temp files, aur data. Kya sure ho?'))return;
  const r=await fetch('/api/delete-dua',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});
  const j=await r.json();
  if(j.ok){toast('\uD83D\uDDD1\uFE0F Deleted: '+d.title+' (sab files remove)','ok'); lastGridKey=''; load();}
  else toast(j.error||'Delete fail','err');
}
function closeForm(){ document.getElementById('modalbg').classList.remove('show'); }
function vfxEsc(s){return escHtml(s);}
const _VS=(function(){
  const w=(typeof window==='undefined')?null:window;
  return (w&&w.VFX_SCHEMA_UI)||null;
})();
const VFX_KINDS=((_VS&&_VS.kind)||['girih-band','arabesque-corners','starfield-dots','geometric-rosette']).join('"|"');
const VFX_TOKENS=((_VS&&_VS.colorToken)||['accent','glowColor','particleColor','solid']).join('"|"');
const VFX_ZONES=((_VS&&_VS.zones)||['top','bottom','frame','corners']).join('","');
const VFX_ZX=((_VS&&_VS.zonesExclusive)||['top','frame']).join('","');
const VFX_OVR=(_VS&&_VS.overrides&&_VS.overrides.length)?_VS.overrides.map(function(o){return o.key;}).join(','):'cornerInset,cornerSize,cornerOpacity,frameEnabled,frameOpacity1,frameOpacity2,ornamentScale,ornamentSwayDeg,raysOpacity,orbsOpacity,particlesScale,grainOpacityDark,grainOpacityPaper,vignetteScale,bokehCount,bokehOpacity,chromaticAberration,shimmerStrength,noiseVeilOpacity,raysAngleDeg';
const _MS=(function(){
  const w=(typeof window==='undefined')?null:window;
  if(w&&w.MASTER_SCHEMA_UI) return w.MASTER_SCHEMA_UI;
  return _VS||null;
})();
const MS_THEMES=(_MS&&_MS.theme&&_MS.theme.enums&&_MS.theme.enums.id)||['dark','mosque','sunset','manuscript','emerald','ocean','desert','royal','ramadan','eid','qadr'];
const MS_DECOR=(_MS&&_MS.theme&&_MS.theme.enums&&_MS.theme.enums.decor)||[];
const MS_FAMILY=(_MS&&_MS.typography&&_MS.typography.enums&&_MS.typography.enums.family)||['amiri-quran','noto-nastaliq-urdu','scheherazade-new'];
const MS_MOTION=(_MS&&_MS.motion&&_MS.motion.enums)||null;
const MS_AUDIO=(_MS&&_MS.audio&&_MS.audio.enums)||null;
const _mq=function(a){return (a&&a.length)?('"'+a.join('"|"')+'"'):'?';};
const _mw=function(a){return (a&&a.length)?('"'+a.join('","')+'"'):'?';};
let _vfxRegistry=null, _vfxRawItems=[];
function openVfxStudio(){
  document.getElementById('vfxbg').classList.add('show');
  _pushModal('vfx');
  fillVfxDuaSel();
  vfxRefresh();
  vfxLiveCheck();
}
function closeVfxStudio(){ document.getElementById('vfxbg').classList.remove('show'); _popModal('vfx'); }
function fillVfxDuaSel(){
  const sel=document.getElementById('vfx_dua');
  const cur=sel.value;
  sel.innerHTML='<option value="">(pehli dua — default)</option>'+duas.map(d=>'<option value="'+vfxEsc(d.id)+'">'+vfxEsc(d.title||d.id)+'</option>').join('');
  sel.value=cur||'';
}
function vfxPromptText(){
  const r=_vfxRegistry;
  const L=[];
  const fld=function(k){return (_VS&&_VS.fields&&_VS.fields.find(function(x){return x.key===k;}))||{min:0,max:999};};
  const lo=function(k){return fld(k).min;};
  const hi=function(k){return fld(k).max;};
  L.push('You design visual presets (UNIFIED MASTER pool) for a Remotion dua-video app. Output: ONLY a JSON array. Har element EK item type follow kare — SIRF ye 6 types allow hain:');
  L.push('');
  L.push('1) PATTERN (geometric SVG VFX): {"type":"pattern","label":"human readable name","kind":"'+VFX_KINDS+'","tileSize":'+lo('tileSize')+'-'+hi('tileSize')+',"strokeWidth":'+lo('strokeWidth')+'-'+hi('strokeWidth')+',"colorToken":"'+VFX_TOKENS+'","alpha":'+lo('alpha')+'-'+hi('alpha')+',"zones":["'+VFX_ZONES+'"],"solidColor":"#RRGGBB","breathFrames":0-'+hi('breathFrames')+',"breathAmpl":0-'+hi('breathAmpl')+',"seedSalt":0-'+hi('seedSalt')+',"bandSize":'+lo('bandSize')+'-'+hi('bandSize')+'} — solidColor sirf tab jab colorToken="solid"; warna omit.');
  L.push('  id mat bhejo — server label se unique id khud banayega.');
  L.push('');
  L.push('2) PLUGIN (VFX pool attachment — "match" STRICTLY MANDATORY): {"type":"plugin","label":"name","match":"*","frameCustomId":"existing_pattern_id","styleOverrides":{...}} — "match" ki VALUE sirf "*" (sab duas, global — koi dua-id hardcode nahi) ya ["dua_id_1","dua_id_2"] (sirf targeted legacy) ho sakti hai. frameCustomId = existing pattern ki exact id (ya inline "frameCustom": {poora Pattern object}). styleOverrides ki COMPLETE whitelist yehi hai: '+VFX_OVR+'. Iske bahar koi key (jaise alpha/strokeWidth/tileSize — ye pattern-fields hain, overrides nahi) silently drop ho jayegi.');
  L.push('');
  L.push('3) THEME (naya color-mood; existing themes mutate mat karo): {"type":"theme","label":"name","match":"*","affinity":["category_id_1","category_id_2"],"payload":{"decor":'+_mq(MS_DECOR)+',"grade":{"brightness":0.7-1.5,"contrast":0.7-1.6,"saturate":0.5-1.8}} } — affinity optional (in categories par prioritized), grade optional.');
  L.push('');
  L.push('4) TYPOGRAPHY (sirf packaged families): {"type":"typography","label":"name","match":"*","fontFamily":'+_mq(MS_FAMILY)+',"baseSize":44-160,"minSize":20-90,"lineHeight":1.2-3} — baseSize aur minSize pura integer.');
  L.push('');
  L.push('5) MOTION (clean movement pick — enum-only, kabhi timing seconds NAHI — audio sync sacred; ek ya zyada positions): {"type":"motion","label":"name","match":"*","camera":"static","textFx":"glide","introFx":"classic"}');
  if(MS_MOTION){
    for(const k of Object.keys(MS_MOTION)) L.push('     • '+k+' = '+_mq(MS_MOTION[k]));
  }
  L.push('');
  L.push('6) AUDIO (voice/sfx selection — recitation track kabhi override nahi): {"type":"audio","label":"name","match":"*","voiceArabic":'+_mq(MS_AUDIO&&MS_AUDIO.voiceArabic)+',"voiceUrdu":'+_mq(MS_AUDIO&&MS_AUDIO.voiceUrdu)+',"sfxSet":'+_mq(MS_AUDIO&&MS_AUDIO.sfxSet)+'}');
  L.push('');
  L.push('HARD RULES:');
  L.push('CRITICAL: The \'match\' property MUST BE EXACTLY "*" (e.g. "match": "*"). NEVER output an empty string like "match": "" under any circumstances.');
  L.push('1. SIRF JSON array output do — koi extra text, markdown, ya explanation nahi.');
  L.push('2. VFX zones mein "'+VFX_ZX+'" ek sath allowed NAHI (exclusive).');
  L.push('3. colorToken SIRF "'+VFX_TOKENS+'" mein se ho; "solid" token par solidColor #RRGGBB ZARURI hai.');
  L.push('4. Har number documented range ke andar ho; theme/typography/motion/audio sirf listed enums/limits.');
  L.push('5. DEDUP CHECKER RUNGEGA — ye ALREADY-REGISTERED signatures duplicate/very-similar mat banao:');
  if(r&&r.indexes){
    L.push('   REGISTERED patterns ('+(r.patterns||[]).length+'):');
    for(const p of (r.patterns||[])) L.push('     - "'+p.id+'" kind='+((p.descriptor&&p.descriptor.kind)||'?')+' zones='+JSON.stringify((p.descriptor&&p.descriptor.zones)||[]));
    L.push('   REGISTERED plugins ('+(r.plugins||[]).length+'):');
    for(const p of (r.plugins||[])){
      const m=p.plugin&&p.plugin.match;
      L.push('     - "'+p.id+'" match='+(Array.isArray(m)?m.join(','):(m||'any')));
    }
  }
  L.push('6. Every PLUGIN item MUST include "match": "*" (or an array of dua IDs). NEVER omit the match field or set it to an empty string.');
  L.push('');
  L.push('Output: [ {pehla design}, {doosra design}, ... ] (sirf 6 types — unknown type reject hoga)');
  return L.join('\n');
}
function vfxCopyPrompt(){
  const t=vfxPromptText();
  const el=document.getElementById('vfx_promptbox');
  if(el) el.textContent=t;
  navigator.clipboard.writeText(t)
    .then(()=>toast('AI Master prompt copy! Gemini pe paste karo','ok'))
    .catch(()=>toast('Copy fail — prompt box se manually copy karo','err'));
}
function vfxLiveCheck(){
  const raw=document.getElementById('vfx_raw').value.trim();
  const st=document.getElementById('vfx_jstatus');
  const btn=document.getElementById('vfx_drybtn');
  if(!raw){ st.textContent=''; st.className='formmsg'; btn.disabled=true; return; }
  let items=null, errText='';
  try{
    const o=JSON.parse(raw);
    items=Array.isArray(o)?o:(o&&Array.isArray(o.items)?o.items:[o]);
  }catch(e){ errText=e.message||'Invalid JSON'; }
  if(items){
    st.textContent='JSON valid — '+items.length+' item(s)';
    st.className='formmsg ok';
    btn.disabled=false;
  }else{
    st.textContent='JSON error: '+errText;
    st.className='formmsg er';
    btn.disabled=true;
  }
}
async function vfxDryRun(){
  const raw=document.getElementById('vfx_raw').value.trim();
  let items;
  try{
    const o=JSON.parse(raw);
    items=Array.isArray(o)?o:(o&&Array.isArray(o.items)?o.items:[o]);
  }catch(e){ toast('JSON me error hai — pehle sahi karo','err'); return; }
  if(!items.length){ toast('Empty array','err'); return; }
  _vfxRawItems=items;
  const btn=document.getElementById('vfx_drybtn');
  btn.disabled=true; const old=btn.innerHTML; btn.innerHTML='Checking...';
  try{
    const r=await fetch('/api/vfx/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,dryRun:1})});
    const j=await r.json();
    if(!j.ok){ toast(j.error||'Dry-run fail','err'); return; }
    vfxRenderResults(j);
  }catch(e){ toast('Network error: '+e.message,'err'); }
  finally{ btn.disabled=false; btn.innerHTML=old; }
}
function vfxBadge(status){
  const m={added:['VALID','vfx-b vfx-ok'],duplicate:['EXACT DUPLICATE (Skipped)','vfx-b vfx-dup'],similar:['SIMILAR DESIGN WARNING','vfx-b vfx-sim'],invalid:['SCHEMA ERROR','vfx-b vfx-err']}[status];
  const b=m||[status,'vfx-b'];
  return '<span class="'+b[1]+'">'+b[0]+'</span>';
}
function vfxRenderResults(j){
  const sec=document.getElementById('vfx_sec_results');
  sec.style.display='block';
  document.getElementById('vfx_result_summary').textContent=
    (j.added||0)+' new, '+(j.similar||0)+' similar, '+(j.duplicates||0)+' duplicate, '+(j.invalid||0)+' invalid — '+(j.dryRun?'DRY-RUN (kuch save nahi hua)':'SAVED');
  const rows=(j.results||[]).map(r=>{
    const label=r.label||(r.id||('item '+(r.index+1)));
    const chips=[];
    if(r.id) chips.push('<span class="vfx-id">'+vfxEsc(r.id)+'</span>');
    if(r.matchedId) chips.push('<span class="vfx-mtag">matches '+vfxEsc(r.matchedId)+'</span>');
    if(r.status==='similar'&&r.dist!==undefined) chips.push('<span class="vfx-mtag">dist '+(r.dist.toFixed?r.dist.toFixed(3):r.dist)+'</span>');
    if(r.reason) chips.push('<span class="vfx-mtag">'+vfxEsc(r.reason)+'</span>');
    const pv=(r.status==='added'||r.status==='similar')?'<button class="chip vfx-pvbtn" onclick="vfxPreview('+r.index+')">Preview Still</button>':'';
    return '<div class="vfx-row"><span class="vfx-rowtype">'+vfxEsc(r.type||'?')+'</span><span class="vfx-rowlabel">'+vfxEsc(label)+chips.join('')+'</span>'+vfxBadge(r.status)+pv+'</div>';
  }).join('');
  document.getElementById('vfx_results').innerHTML=rows||'<div class="vfx-empty">Koi result nahi</div>';
  const canAdd=(j.added||0)+(j.similar||0);
  const sb=document.getElementById('vfx_savebtn');
  sb.disabled=!(canAdd>0);
  sb.innerHTML=canAdd>0?'CONFIRM IMPORT ('+canAdd+')':'CONFIRM IMPORT';
  setVfxPvMsg('','');
}
function setVfxPvMsg(t,c){ const el=document.getElementById('vfx_pvmsg'); el.textContent=t; el.className='formmsg '+c; }
async function vfxPreview(i){
  const item=_vfxRawItems[i];
  if(!item){ toast('Raw item lost — dobara dry-run karo','err'); return; }
  const box=document.getElementById('vfx_previewbox');
  box.style.display='block';
  const img=document.getElementById('vfx_pvimg');
  img.removeAttribute('src');
  document.getElementById('vfx_pvname').textContent=item.label||('item '+i);
  setVfxPvMsg('Still render ho raha hai (Chrome) — ek minute tak lagega...','');
  let payload=null;
  if(item.type==='pattern'){
    const frame=Object.assign({},item);
    for(const k of ['type','label']) delete frame[k];
    payload={frame};
  }else if(item.type==='plugin'){
    const ov=item.styleOverrides||{};
    const frameCustom=item.frameCustom;
    const frameCustomId=item.frameCustomId||'';
    if(frameCustom){ payload={frame:frameCustom,styleOverrides:ov}; }
    else if(frameCustomId){ payload={patternId:frameCustomId,styleOverrides:ov}; }
    else{ setVfxPvMsg('Plugin ke paas frameCustom ya frameCustomId dono nahi — preview possible nahi','er'); return; }
  }else{
    setVfxPvMsg('Yeh item preview nahi ho sakta','er'); return;
  }
  const duaId=document.getElementById('vfx_dua').value;
  if(duaId) payload.duaId=duaId;
  try{
    const r=await fetch('/api/vfx/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const j=await r.json();
    if(!j.ok){ setVfxPvMsg(j.error||'render fail','er'); return; }
    img.src=j.url+'?t='+Date.now();
    setVfxPvMsg('Rendered: '+j.duaId+' / frame '+j.frame+' / theme '+j.theme,'ok');
  }catch(e){ setVfxPvMsg('Network error: '+e.message,'er'); }
}
async function vfxConfirm(){
  if(!_vfxRawItems.length)return;
  const sb=document.getElementById('vfx_savebtn');
  const old=sb.innerHTML;
  sb.disabled=true; sb.innerHTML='Saving...';
  try{
    const r=await fetch('/api/vfx/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:_vfxRawItems,dryRun:0})});
    const j=await r.json();
    if(!j.ok){ sb.disabled=false; sb.innerHTML=old; toast(j.error||'Save fail','err'); return; }
    vfxRenderResults(j);
    await vfxRefresh();
    toast((j.added||0)+' new saved'+(j.similar>0?', '+j.similar+' similar flagged':'')+' — pack updated!','ok');
    if((j.invalid||0)>0) toast((j.invalid)+' invalid item skip hue','warn');
  }catch(e){ sb.disabled=false; sb.innerHTML=old; toast('Network error: '+e.message,'err'); }
}
async function vfxRefresh(){
  const rc=document.getElementById('vfx_regcount');
  if(rc) rc.textContent='(load ho raha hai...)';
  try{
    const r=await fetch('/api/vfx/list');
    const j=await r.json();
    if(!j.ok) throw new Error(j.error||'list fail');
    _vfxRegistry=j;
    if(rc) rc.textContent='('+(j.patterns.length)+' patterns / '+(j.plugins.length)+' plugins'+(j.master&&(j.master.themes||0)+(j.master.typography||0)+(j.master.motion||0)+(j.master.audio||0)>0?' + '+(j.master.themes||0)+' theme / '+(j.master.typography||0)+' type / '+(j.master.motion||0)+' motion / '+(j.master.audio||0)+' audio':'')+' registered)';
    const box=document.getElementById('vfx_registry');
    box.innerHTML='';
    const both=[];
    for(const p of (j.patterns||[])) both.push({kind:'pattern',id:p.id,label:p.label,fp:p.fingerprint});
    for(const p of (j.plugins||[])) both.push({kind:'plugin',id:p.id,label:p.label||p.plugin.label,fp:p.fingerprint});
    if(!both.length){ box.innerHTML='<div class="vfx-empty">Abhi koi custom VFX registered nahi</div>'; }
    for(const e of both){
      const div=document.createElement('div');
      div.className='vfx-regrow';
      div.innerHTML='<span class="vfx-b '+(e.kind==='pattern'?'vfx-ok':'vfx-sim')+'">'+e.kind+'</span><span class="vfx-id">'+vfxEsc(e.id)+'</span><span class="vfx-fp">'+vfxEsc(e.fp||'')+'</span><span class="vfx-reglabel">'+vfxEsc(e.label||'')+'</span>';
      box.appendChild(div);
    }
    const pbox=document.getElementById('vfx_promptbox');
    if(pbox) pbox.textContent=vfxPromptText();
  }catch(e){
    document.getElementById('vfx_registry').innerHTML='<div class="vfx-empty">Registry load fail: '+vfxEsc(e.message)+'</div>';
    if(typeof toast==='function') toast('VFX Registry load fail: '+e.message,'err');
  }
}
async function saveDua(){
  var fields=[{id:'f_title',label:'Title'},{id:'f_arabic',label:'Arabic'},{id:'f_urdu',label:'Urdu'}];
  var valid=true;
  fields.forEach(function(f){
    var el=document.getElementById(f.id);
    var empty=!el.value.trim();
    el.classList.toggle('invalid',empty);
    if(empty)valid=false;
  });
  if(!valid){setMsg('Title, Arabic, aur Urdu zaroori hain','err');return;}
  fields.forEach(function(f){document.getElementById(f.id).classList.remove('invalid');});
  var title=document.getElementById('f_title').value.trim();
  var arabic=document.getElementById('f_arabic').value.trim().substring(0,50);
  var action=editingId?'Update':'Add';
  if(!confirm(action+' karein?\n\nTitle: '+title+'\nArabic: '+arabic+'...')){
    return;
  }
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
    toast(editingId?('\u270F\uFE0F Updated: '+editingId):('\u2795 Nayi dua added: '+j.id),'ok');
    if(!editingId)['f_title','f_arabic','f_urdu','f_ref'].forEach(i=>document.getElementById(i).value='');
    editingId=null;
    setTimeout(()=>{closeForm(); load();},800);
  }
  else { setMsg(j.error||'Error','err'); ensureDedupAlert(); checkDedupLive(); }
}
poll();
load();
var _pollIntervals=[3000,15000];
var _pollTimers=[];
var _sseSource=null;
function _startSSE(){
  if(_sseSource){return;}
  try{
    _sseSource=new EventSource('/api/status/stream');
    _sseSource.onmessage=function(e){
      try{
        var j=JSON.parse(e.data);
        _handleJobUpdate(j);
      }catch(_){}
    };
    _sseSource.onerror=function(){
      _sseSource.close();_sseSource=null;
      setTimeout(_startSSE,5000);
    };
  }catch(_){}
}
function _stopSSE(){
  if(_sseSource){_sseSource.close();_sseSource=null;}
}
function _handleJobUpdate(j){
  window.jobDua=j.duaId;busy=j.running;
  if(j.running){
    barHidden=false;
    if(autoHideBarT){clearTimeout(autoHideBarT);autoHideBarT=null;}
  }
  var showBar=j.running||(!barHidden&&(j.step==='done'||!!j.error));
  document.getElementById('jobbar').classList.toggle('show',showBar);
  document.getElementById('jstep').textContent=(j.step||'-').toUpperCase();
  document.getElementById('jdua').textContent=j.duaId||'';
  var indet=j.running&&(j.step!=='render');
  document.getElementById('jpct').textContent=j.running?((j.percent||0)+'%'):(j.error?'FAILED':(j.step==='done'?'100%':''));
  var f=document.getElementById('jfill');
  f.classList.toggle('indet',indet);
  f.style.width=indet?'30%':((j.percent||0)+'%');
  var lb=document.getElementById('jlog');
  if(lb){
    var recent=(j.logs||[]).slice(-3);
    var html=recent.map(function(l){return '<span class="'+logClass(l)+'">'+escHtml(l)+'</span>';}).join('\n');
    if(lb.dataset.prev!==html){lb.innerHTML=html;lb.scrollTop=lb.scrollHeight;lb.dataset.prev=html;}
  }
  var jb=document.getElementById('jbatch');
  var jc=document.getElementById('jcancel');
  if(j.queue&&j.queue.active){
    jc.style.display='inline-block';
    jb.style.display='inline';
    var qt=j.queue.total||0;
    var qp=qt?Math.round((j.queue.done||0)*100/qt):0;
    jb.textContent=qp+'% '+(j.queue.idx)+'/'+qt+
      ' \u2705'+j.queue.done+' \u274C'+(j.queue.failed?j.queue.failed.length:0)+
      (j.queue.skipped&&j.queue.skipped.length?(' \u23ED'+j.queue.skipped.length):'')+
      ' | '+(j.duaId||'-');
  }else{jb.style.display='none';jc.style.display='none';}
  document.title=j.running?(j.percent+'% - Dua Studio'):'Dua Video Studio';
}
function _startPolling(){
  _stopPolling();
  _startSSE();
  load();
  _pollTimers.push(setInterval(poll,_pollIntervals[0]));
  _pollTimers.push(setInterval(load,_pollIntervals[1]));
}
function _stopPolling(){
  _pollTimers.forEach(function(t){clearInterval(t);});
  _pollTimers=[];
  _stopSSE();
}
_startPolling();
document.addEventListener('visibilitychange',function(){
  if(document.hidden){_stopPolling();}
  else{_startPolling();}
});
document.getElementById('yt_mode').addEventListener('change',function(){
  var w=document.getElementById('yt_mode_warn');
  var btn=document.getElementById('yt_start');
  if(this.value==='live'){
    w.style.display='inline';
    btn.style.background='linear-gradient(135deg,#b91c1c,#dc2626)';
    btn.style.boxShadow='0 0 12px rgba(220,38,38,.3)';
  }else{
    w.style.display='none';
    btn.style.background='';
    btn.style.boxShadow='';
  }
});
function openAiImport(){
  document.getElementById('aiimportbg').classList.add('show');
  document.getElementById('ai_result').style.display='none';
  setMsg2('aiimportmsg','','');
  aiConfigLoad();
}
function closeAiImport(){document.getElementById('aiimportbg').classList.remove('show');}
function aiTab(tab){
  document.getElementById('aitab_gen').className=tab==='gen'?'chip on':'chip';
  document.getElementById('aitab_fmt').className=tab==='fmt'?'chip on':'chip';
  document.getElementById('ai_panel_gen').style.display=tab==='gen'?'block':'none';
  document.getElementById('ai_panel_fmt').style.display=tab==='fmt'?'block':'none';
  setMsg2('aiimportmsg','','');
  document.getElementById('ai_result').style.display='none';
}
function aiConfigToggle(){
  var box=document.getElementById('ai_cfg_box');
  var tog=document.getElementById('ai_cfg_toggle');
  var show=box.style.display==='none';
  box.style.display=show?'block':'none';
  tog.textContent=show?'Hide':'Show';
}
async function aiConfigLoad(){
  try{
    var r=await fetch('/api/ai-config');
    var j=await r.json();
    if(j.ok&&j.config){
      if(j.config.base_url)document.getElementById('ai_base_url').value=j.config.base_url;
      if(j.config.api_keys&&j.config.api_keys.length)document.getElementById('ai_keys').value=j.config.api_keys.join('\n');
      if(j.config.models&&j.config.models.length)document.getElementById('ai_models').value=j.config.models.join(', ');
    }
  }catch(e){}
}
async function aiConfigSave(){
  var base=document.getElementById('ai_base_url').value.trim()||'https://aihubmix.com/v1';
  var keys=document.getElementById('ai_keys').value.split('\n').map(function(k){return k.trim();}).filter(Boolean);
  var models=document.getElementById('ai_models').value.split(',').map(function(m){return m.trim();}).filter(Boolean);
  if(!keys.length)return setMsg2('aicfgmsg','Kam se kam 1 API key chahiye','err');
  try{
    var r=await fetch('/api/ai-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_url:base,api_keys:keys,models:models})});
    var j=await r.json();
    if(j.ok)setMsg2('aicfgmsg','\u2705 API settings save ho gayen!','ok');
    else setMsg2('aicfgmsg',j.error||'Save fail','err');
  }catch(e){setMsg2('aicfgmsg','Network error','err');}
}
async function aiImport(){
  var btn=document.getElementById('ai_gen_btn');
  var msg=document.getElementById('aiimportmsg');
  var res=document.getElementById('ai_result');
  var cat=document.getElementById('ai_category').value;
  var count=document.getElementById('ai_count').value;
  var topic=document.getElementById('ai_topic').value;
  var countNum=parseInt(count);
  var topicText=topic?('\nTopic: '+topic):'';
  var catText=cat?('\nCategory: '+cat):'general';
  if(!confirm(countNum+' duas generate karke library mein add hongi:'+catText+topicText+'\n\nConfirm karo?')){
    return;
  }
  btn.disabled=true;btn.textContent='Generating...';setMsg2('aiimportmsg','AI se duas generate ho rahi hain...','warn');res.style.display='none';
  try{
    var r=await fetch('/api/ai-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({count:countNum,category:cat,topic:topic})});
    var j=await r.json();
    if(j.ok&&j.added>0){
      setMsg2('aiimportmsg',j.added+' nayi duas library mein add ho gayin!','ok');
      var html='<div style="max-height:200px;overflow-y:auto;font-size:12px">';
      (j.duas||[]).forEach(function(d){html+='<div style="padding:6px 0;border-bottom:1px solid #1a2030"><b style="color:#d4af37">'+ytEsc(d.title)+'</b> <span style="color:#5a6474">('+ytEsc(d.id)+')</span></div>';});
      html+='</div>';
      res.innerHTML=html;res.style.display='block';
      load();
    }else{
      setMsg2('aiimportmsg',j.error||'Koi nayi dua add nahi ho payi - check API balance','err');
    }
  }catch(e){setMsg2('aiimportmsg','Network error: '+e.message,'err');}
  btn.disabled=false;btn.textContent='\u{1F916} GENERATE + ADD';
}
async function aiFormatSave(){
  var btn=document.getElementById('ai_fmt_btn');
  var msg=document.getElementById('aiimportmsg');
  var title=document.getElementById('fmt_title').value.trim();
  var arabic=document.getElementById('fmt_arabic').value.trim();
  var urdu=document.getElementById('fmt_urdu').value.trim();
  var ref=document.getElementById('fmt_ref').value.trim();
  var cat=document.getElementById('fmt_category').value;
  var exp=document.getElementById('fmt_explanation').value.trim();
  if(!title||!arabic||!urdu)return setMsg2('aiimportmsg','Title, Arabic, aur Urdu zaroori hain','err');
  if(!confirm('Dua library mein add karein?\n\nTitle: '+title+'\nArabic: '+arabic.substring(0,50)+'...'))return;
  btn.disabled=true;btn.textContent='Saving...';
  setMsg2('aiimportmsg','Dua add ho raha hai...','warn');
  try{
    var body={title:title,arabic:arabic,urdu:urdu,reference:ref,category:cat,explanation:exp,bismillah:true,template:'dark',voiceArabic:'ar-SA-HamedNeural',voiceUrdu:'ur-PK-AsadNeural'};
    var r=await fetch('/api/add-dua',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var j=await r.json();
    if(j.ok){
      setMsg2('aiimportmsg','Dua add ho gayi: '+j.id,'ok');
      document.getElementById('fmt_title').value='';
      document.getElementById('fmt_arabic').value='';
      document.getElementById('fmt_urdu').value='';
      document.getElementById('fmt_ref').value='';
      document.getElementById('fmt_explanation').value='';
      load();
    }else{
      setMsg2('aiimportmsg',j.error||'Add nahi ho paya','err');
    }
  }catch(e){setMsg2('aiimportmsg','Network error: '+e.message,'err');}
  btn.disabled=false;btn.textContent='\u2713 SAVE TO LIBRARY';
}
function copyFmtPrompt(){
  var prompt='You are an expert Islamic Sunni scholar. I will give you a dua name/topic. Generate the metadata in EXACTLY this JSON format:\n\n'+
'[{\n'+
'  "id": "unique_english_snake_case_id",\n'+
'  "title": "Roman Urdu short title (2-5 words)",\n'+
'  "titleEn": "English title",\n'+
'  "arabic": "Full Arabic dua text WITH harakat/tashkeel",\n'+
'  "urdu": "Complete Urdu translation in Urdu script",\n'+
'  "reference": "Authentic hadith source (e.g. Sahih Bukhari 1234)",\n'+
'  "explanation": "1-2 line Urdu explanation about when this dua is read",\n'+
'  "category": "prayer|travel|food|sleep|health|study|safety|parents|ramadan|morning_evening|mosque|work|clothing|weather|protection|rizq|forgiveness|guidance|anxiety_relief|gratitude|family|occasions|bathroom|morning|evening|general"\n'+
'}]\n\n'+
'RULES:\n'+
'1. ONLY authentic Sunni duas from Quran/Hadith\n'+
'2. Arabic MUST be original text with diacritics, NOT transliteration\n'+
'3. Urdu MUST be accurate and respectful\n'+
'4. Return ONLY valid JSON array, no markdown, no explanation\n'+
'5. Category must be EXACTLY one of the values listed above\n\n'+
'---\n\n'+
'NOW GENERATE FOR: [yahan dua ka naam/topic likho]';
  navigator.clipboard.writeText(prompt).then(function(){
    var el=document.getElementById('fmt_copy_msg');
    el.textContent='Copied! Ab kisi bhi AI (ChatGPT/Gemini) mein paste karo';
    el.style.display='block';
    el.style.color='#3fb950';
    setTimeout(function(){el.style.display='none';},3000);
  }).catch(function(){
    var ta=document.createElement('textarea');
    ta.value=prompt;document.body.appendChild(ta);
    ta.select();document.execCommand('copy');
    document.body.removeChild(ta);
    var el=document.getElementById('fmt_copy_msg');
    el.textContent='Copied!';
    el.style.display='block';
    el.style.color='#3fb950';
    setTimeout(function(){el.style.display='none';},3000);
  });
}
function setMsg2(id,msg,type){
  var el=document.getElementById(id);if(!el)return;
  el.textContent=msg;el.className='formmsg'+(type==='ok'?' ok':type==='err'?' err':type==='warn'?' warn':'');
}