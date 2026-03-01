var state = { folderId:null, projectId:null, folders:[], assets:[], currentAsset:null, draggingAssetId:null, scoreFilter:'all', statusFilter:'all', commentsOnly:false };
var uploadFiles = { video:null, pptx:null };
var ctxId=null, projCtxId=null, folderCtxId=null, moveAssetId=null, dragCounter=0;
var reportVersionId=null, reportFile=null, reportVideoName=null;
var colorValues = { red:0, amber:50, green:100 };
var projectStats = {};
var collapsedFolders = new Set();
var PHASES = ['Reach','Action'];
var PLATFORMS = ['Meta','Snapchat','TikTok','OLV','YouTube','Pinterest'];
var FORMATS = ['4x5','9x16','16x9','1x1','2x3'];
var tagState = { assetId:null, videoUrl:null, baseName:null, projectId:null, phase:null, platform:null, format:null, isMaster:false, audienceTags:[] };
var homeSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';

async function api(url, opts) {
  var res = await fetch(url, Object.assign({ headers:{"Content-Type":"application/json"} }, opts||{}));
  return res.json();
}
async function loadFolders() { state.folders = await api("/api/folders"); }

async function showHome() {
  pauseVideo();
  state.folderId=null; state.projectId=null; state.assets=[];
  document.getElementById("detail-view").style.display="none";
  document.getElementById("grid-view").style.display="block";
  document.getElementById("home-view").style.display="block";
  document.getElementById("project-view").style.display="none";
  document.getElementById("breadcrumb").innerHTML="";
document.getElementById("hdr-btns").innerHTML="";
document.querySelector(".hdr").style.display="none";
var ch=document.getElementById('home-compact-hdr');ch.style.display='';ch.classList.remove('visible');
  try { projectStats = await api("/api/projects/stats"); } catch(e) { projectStats={}; }
  renderHome();
}

function renderHome() {
  var grid = document.getElementById("project-grid");
  var projects = state.folders.filter(function(f){ return !f.parent_id; });
  if (!projects.length) { grid.innerHTML='<div class="home-empty"><div style="font-size:64px;margin-bottom:20px">📁</div><div style="font-size:20px;font-weight:600;color:#64748b;margin-bottom:8px">No projects yet</div><div style="font-size:14px">Click + New Project to get started</div></div>'; return; }
  grid.innerHTML = projects.map(function(f) {
    var s = projectStats[String(f.id)] || {total:0,green:0,amber:0,red:0,unscored:0};
    var meta = []; if(s.total) meta.push(s.total+' asset'+(s.total!==1?'s':''));
    var bar='', dist='';
    if (s.total>0) {
      var t=s.total;
      bar='<div class="score-bar"><div class="sb-g" style="width:'+(s.green/t*100)+'%"></div><div class="sb-a" style="width:'+(s.amber/t*100)+'%"></div><div class="sb-r" style="width:'+(s.red/t*100)+'%"></div><div class="sb-u" style="width:'+(s.unscored/t*100)+'%"></div></div>';
      var parts=[]; if(s.green) parts.push('<span>🟢 '+s.green+'</span>'); if(s.amber) parts.push('<span>🟡 '+s.amber+'</span>'); if(s.red) parts.push('<span>🔴 '+s.red+'</span>'); if(s.unscored) parts.push('<span>○ '+s.unscored+'</span>');
      dist='<div class="pc-dist">'+parts.join('')+'</div>';
    }
    return '<div class="project-card" data-id="'+f.id+'" onclick="enterProject('+f.id+')">'+'<div class="pc-icon">📁</div><div class="pc-name">'+f.name+'</div><div class="pc-meta">'+(meta.join(' · ')||'Empty project')+'</div>'+bar+dist+'</div>';
  }).join("");
  grid.querySelectorAll(".project-card").forEach(function(card){ card.addEventListener("contextmenu",function(e){e.preventDefault();showProjCtx(e,parseInt(card.dataset.id));}); });
}

async function newProject() {
showProjectSetupModal();
}
function enterProject(id) { state.projectId=id; state.scoreFilter='all';state.statusFilter='all';state.commentsOnly=false; collapsedFolders.clear(); document.getElementById("home-view").style.display="none"; document.getElementById("project-view").style.display="flex"; document.querySelector(".hdr").style.display="";
var ch=document.getElementById('home-compact-hdr');ch.classList.remove('visible');ch.style.display='none'; loadAssets(id); }

async function loadAssets(fid) {
  state.folderId=(fid!==undefined)?fid:null;
  pauseVideo();
  document.getElementById("detail-view").style.display="none";
  document.getElementById("grid-view").style.display="flex";
  var isOverview = state.projectId && state.folderId === state.projectId;
  if (isOverview) {
    state.assets = await api("/api/assets?project_id="+state.projectId);
    renderSidebar(); renderOverview(); renderBreadcrumb();
  } else {
    var url=fid?"/api/assets?folder_id="+fid:"/api/assets";
    state.assets=await api(url);
    renderSidebar(); renderGrid(); renderBreadcrumb();
  }
}

function pauseVideo(){
var p=document.getElementById("video-player");
if(p){p.pause();p.src="";}
updatePlayBtn(false);updatePlaybar();
}

function renderBreadcrumb() {
  var bc=document.getElementById("breadcrumb"), btns=document.getElementById("hdr-btns");
  if (!state.projectId) { bc.innerHTML=""; return; }
  var project=state.folders.find(function(f){return f.id===state.projectId;});
  var path=[]; var id=state.folderId;
  while(id&&id!==state.projectId){var folder=state.folders.find(function(f){return f.id===id;});if(!folder)break;path.unshift({id:folder.id,name:folder.name});id=folder.parent_id;}
  var html='<span class="bc-item" onclick="showHome()">Projects</span><span class="bc-sep">›</span>';
  if(state.folderId===state.projectId){html+='<span class="bc-cur">'+(project?project.name:'')+'</span>';}
  else{html+='<span class="bc-item" onclick="loadAssets('+state.projectId+')">'+(project?project.name:'')+'</span>';}
  path.forEach(function(item,i){html+='<span class="bc-sep">›</span>';html+=(i===path.length-1)?'<span class="bc-cur">'+item.name+'</span>':'<span class="bc-item" onclick="loadAssets('+item.id+')">'+item.name+'</span>';});
  bc.innerHTML=html;
  document.getElementById("mtitle").textContent=path.length?path[path.length-1].name:(project?project.name:'');
  var isOverview = state.folderId === state.projectId;
btns.innerHTML=(isOverview?'<button class="btn btn-ghost" onclick="showProjectSetupModal('+state.projectId+')">⚙️ Edit Brief</button>':'<button class="btn btn-ghost" onclick="showInlineFolderInput()">+ Add Folder</button>')+'<button class="btn btn-primary" onclick="showUpload()">⬆ Upload</button>';
}

function renderSidebar() {
  var tree=document.getElementById("folder-tree"); tree.innerHTML="";
  if(!state.projectId) return;
  var isOv=state.folderId===state.projectId;
  var ovRow=document.createElement("div");
  ovRow.className="sidebar-ov"+(isOv?" active":"");
  ovRow.style.paddingLeft="12px";
  ovRow.innerHTML='<span class="farrow-sp"></span><span style="margin-right:6px;display:flex;align-items:center">'+homeSvg+'</span><span class="fname">Overview</span>';
  ovRow.onclick=function(){loadAssets(state.projectId);};
  tree.appendChild(ovRow);
  var sep=document.createElement("div");sep.style.cssText="height:1px;background:#1e293b;margin:6px 8px 4px";tree.appendChild(sep);
  var lbl=document.createElement("div");lbl.className="slabel";lbl.textContent="Folders";tree.appendChild(lbl);
  state.folders.filter(function(f){return f.parent_id===state.projectId;}).forEach(function(f){addFolder(f,tree,0);});
}

function toggleCollapse(id) {
  if(collapsedFolders.has(id))collapsedFolders.delete(id);else collapsedFolders.add(id);
  renderSidebar();
}

function makeRow(id,label,depth) {
var row=document.createElement("div");
var isTop=depth===0;
var folder = state.folders.find(function(f) { return f.id === id; });
var isManaged = folder && folder.is_managed;

row.className="frow"+(state.folderId===id?" active":"")+(isTop?" frow-toplevel":"");
row.style.paddingLeft=(12+depth*14)+"px";

var hasKids=state.folders.some(function(f){return f.parent_id===id;});
var isCol=collapsedFolders.has(id);
var arrow=hasKids?'<span class="farrow'+(isCol?'':' open')+'" onclick="event.stopPropagation();toggleCollapse('+id+')">▶</span>':'<span class="farrow-sp"></span>';

var icon = '📁';
var acts = isManaged ? '' : '<span class="factions"><button class="ibtn" onclick="event.stopPropagation();renameF('+id+')">✏️</button><button class="ibtn" onclick="event.stopPropagation();deleteF('+id+')">🗑</button></span>';

row.innerHTML=arrow+'<span class="ficon">'+icon+'</span><span class="fname">'+label+'</span>'+acts;
row.onclick=function(){loadAssets(id);};

if (isManaged) {
  row.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    showManagedFolderCtx(e, id);
  });
} else {
  row.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    showFolderCtx(e, id);
  });
}

return row;
}

function addFolder(folder,container,depth) {
  container.appendChild(makeRow(folder.id,folder.name,depth));
  if(!collapsedFolders.has(folder.id)){
    state.folders.filter(function(f){return f.parent_id===folder.id;}).forEach(function(c){addFolder(c,container,depth+1);});
  }
}

function getAssetPath(asset) {
  if(!asset.folder_id||asset.folder_id===state.projectId)return null;
  var path=[],id=asset.folder_id;
  while(id&&id!==state.projectId){var f=state.folders.find(function(x){return x.id===id;});if(!f)break;path.unshift(f.name);id=f.parent_id;}
  return path.length?path.join(' — '):null;
}

function filterAssets(assets) {
var result=assets;
var sf=state.scoreFilter;
if(sf==='notgreen') result=result.filter(function(a){return a.ace_score===null||a.ace_score<67;});
else if(sf==='green') result=result.filter(function(a){return a.ace_score!==null&&a.ace_score>=67;});
else if(sf==='amber') result=result.filter(function(a){return a.ace_score!==null&&a.ace_score>=34&&a.ace_score<67;});
else if(sf==='red') result=result.filter(function(a){return a.ace_score!==null&&a.ace_score<34;});
else if(sf==='unscored') result=result.filter(function(a){return a.ace_score===null;});
var stf=state.statusFilter;
if(stf==='approved') result=result.filter(function(a){return a.review_status==='approved';});
else if(stf==='reviewed') result=result.filter(function(a){return a.review_status==='reviewed';});
else if(stf==='needs_attention') result=result.filter(function(a){return a.review_status==='needs_attention';});
else if(stf==='unreviewed') result=result.filter(function(a){return (a.review_status||'unreviewed')==='unreviewed';});
if(state.commentsOnly) result=result.filter(function(a){return (a.comment_count||0)>0;});
return result;
}

function setOverviewFilter(f){state.overviewFilter=f;renderOverview();}

function renderOverview() {
  document.querySelector(".mtoolbar").style.display="none";
  var hdrEl=document.getElementById("overview-proj-hdr");
  var bar=document.getElementById("filter-bar");
  var grid=document.getElementById("grid");
  hdrEl.style.display="block";
  bar.style.display="none";
  grid.classList.add("overview-mode");
  var project=state.folders.find(function(f){return f.id===state.projectId;});
  var g=0,a=0,r=0,u=0,t=state.assets.length;
  state.assets.forEach(function(x){if(x.ace_score===null)u++;else if(x.ace_score>=67)g++;else if(x.ace_score>=34)a++;else r++;});
  var bands='<div class="score-bands">';
  if(g)bands+='<div class="score-band sb-g" style="width:'+(g/t*100)+'%">'+g+'</div>';
  if(a)bands+='<div class="score-band sb-a" style="width:'+(a/t*100)+'%">'+a+'</div>';
  if(r)bands+='<div class="score-band sb-r" style="width:'+(r/t*100)+'%">'+r+'</div>';
  if(u)bands+='<div class="score-band sb-u" style="width:'+(u/t*100)+'%">'+u+'</div>';
  bands+='</div>';
  var scoreLabelMap={all:'Score',notgreen:'Not Green',green:'Green',amber:'Amber',red:'Red',unscored:'Unscored'};
var scoreDD='<div class="ov-dd-wrap"><div class="ov-dd-btn'+(state.scoreFilter!=='all'?' has-filter':'')+'" onclick="toggleOvDropdown(\'score-filter-dd\',event)">'+scoreLabelMap[state.scoreFilter]+' ▾</div><div class="ov-dd-panel" id="score-filter-dd" style="display:none">'+['all','notgreen','green','amber','red','unscored'].map(function(v){return'<div class="ov-dd-item'+(state.scoreFilter===v?' active':'')+'" onclick="setScoreFilter(\''+v+'\')">'+scoreLabelMap[v]+'</div>';}).join('')+'</div></div>';
var statusDD='<div class="ov-dd-wrap"><div class="ov-dd-btn'+(state.statusFilter!=='all'?' has-filter':'')+'" onclick="toggleOvDropdown(\'status-filter-dd\',event)">'+(state.statusFilter==='all'?'Status':statusLabel(state.statusFilter))+' ▾</div><div class="ov-dd-panel" id="status-filter-dd" style="display:none">'+['all','approved','reviewed','needs_attention','unreviewed'].map(function(v){return'<div class="ov-dd-item'+(state.statusFilter===v?' active':'')+'" onclick="setStatusFilter(\''+v+'\')">'+( v==='all'?'All':statusLabel(v))+'</div>';}).join('')+'</div></div>';
hdrEl.innerHTML='<div class="ov-proj-row"><div class="ov-proj-name">'+(project?project.name:'')+'</div>'+(t>0?bands:'')+'</div>'+(t>0?'<div class="ov-filter-row">'+scoreDD+statusDD+'<button class="ov-dd-btn'+(state.commentsOnly?' has-filter':'')+'" onclick="toggleCommentsFilter()">💬 Has Comments</button>'+'</div>':'');
var filtered=filterAssets(state.assets);
  var groups={},untaggedArr=[];
  filtered.forEach(function(x){var p=getAssetPath(x);if(!p)untaggedArr.push(x);else{if(!groups[p])groups[p]=[];groups[p].push(x);}});
  var html='';
  Object.keys(groups).sort().forEach(function(path){var assets=sortedByMaster(groups[path]);html+='<div class="overview-section"><div class="overview-hdr"><span class="overview-path">'+path.toUpperCase()+'</span><span class="overview-count">'+assets.length+' asset'+(assets.length!==1?'s':'')+'</span></div><div class="overview-grid">'+assets.map(makeCard).join('')+'</div></div>';});
if(untaggedArr.length){var sortedUntagged=sortedByMaster(untaggedArr);html+='<div class="overview-section"><div class="overview-hdr"><span class="overview-path">UNTAGGED</span><span class="overview-count">'+untaggedArr.length+' asset'+(untaggedArr.length!==1?'s':'')+'</span></div><div class="overview-grid">'+sortedUntagged.map(makeCard).join('')+'</div></div>';}
  if(!html){
  if(state.assets.length===0){
    html='<div class="empty"><div class="esub">Nothing here yet — drag something in or hit ⬆ Upload</div></div>';
  } else {
    html='<div style="padding:60px 24px;text-align:center;color:#94a3b8"><div style="font-size:48px;margin-bottom:16px">🔍</div><div style="font-size:16px;font-weight:600;color:#64748b;margin-bottom:8px">No assets match this filter</div></div>';
  }
}
  grid.innerHTML=html;
  grid.querySelectorAll(".card[data-video]").forEach(function(card){if(card.dataset.video)initCardPreview(card);});
}

function renderGrid() {
document.querySelector(".mtoolbar").style.display="";
document.getElementById("overview-proj-hdr").style.display="none";
document.getElementById("filter-bar").style.display="none";
var grid=document.getElementById("grid");
grid.classList.remove("overview-mode");
var subFolders=state.folders.filter(function(f){return f.parent_id===state.folderId;});
var parts=[]; if(subFolders.length)parts.push(subFolders.length+" folder"+(subFolders.length!==1?"s":"")); if(state.assets.length)parts.push(state.assets.length+" asset"+(state.assets.length!==1?"s":""));
document.getElementById("mcount").textContent=parts.join(", ");
if(!subFolders.length&&!state.assets.length){
  grid.innerHTML='<div class="empty"><div class="esub">Nothing here yet — drag something in or hit ⬆ Upload</div></div>';
  return;
}
var foldersHtml=subFolders.length?'<div class="folders-section">'+subFolders.map(makeFolderCard).join('')+'</div>':'';
var assetsHtml=state.assets.length?'<div class="assets-section">'+sortedByMaster(state.assets).map(makeCard).join('')+'</div>':'';
grid.innerHTML=foldersHtml+assetsHtml;
grid.querySelectorAll(".card[data-video]").forEach(function(card){if(card.dataset.video)initCardPreview(card);});
}

function makeFolderCard(folder) {
var subs = state.folders.filter(function(f) { return f.parent_id === folder.id; }).length;
var isManaged = folder.is_managed;
var icon = '📁';
var contextMenu = isManaged ? 'showManagedFolderCtx(event,' + folder.id + ')' : 'showFolderCtx(event,' + folder.id + ')';

var h = '<div class="folder-card" onclick="loadAssets(' + folder.id + ')" oncontextmenu="' + contextMenu + '" ondragover="folderDragOver(event,this)" ondragleave="folderDragLeave(this)" ondrop="folderDrop(event,' + folder.id + ')">';
h += '<div class="fc-thumb">' + icon + '</div><div class="fc-body"><div class="fc-name">' + folder.name + '</div>';
if (subs) h += '<div class="fc-meta">' + subs + ' sub-folder' + (subs !== 1 ? 's' : '') + '</div>';
h += '</div></div>';
return h;
}
var managedFolderCtxId = null;

function makeCard(a){
var s=a.ace_score;
var cls=s===null?"none":s>=67?"green":s>=34?"amber":"red";
var thumb=a.thumbnail?'<img src="'+a.thumbnail+'" alt="" draggable="false">':'<span class="cph">🎬</span>';
var date=a.uploaded_at?new Date(a.uploaded_at).toLocaleDateString("en-GB",{day:"numeric",month:"short"}):"";
var displayName=a.display_name||a.base_name;
var dur=a.duration?formatDuration(a.duration):'';
var cc=a.comment_count||0;
var audTags=[];try{audTags=JSON.parse(a.audience_tags||'[]');}catch(e){}
var tagsHtml=audTags.length?'<div class="card-tags">'+audTags.map(function(t){return'<span class="card-tag">'+t+'</span>';}).join('')+'</div>':'';

var h='<div class="card" data-video="'+(a.latest_version_id||'')+'" draggable="true" onclick="openAsset('+a.id+')" oncontextmenu="showCtx(event,'+a.id+')" ondragstart="cardDragStart(event,'+a.id+')" ondragend="cardDragEnd()" ondragover="cardStackOver(event,this,'+a.id+')" ondragleave="cardStackLeave(event,this)" ondrop="cardStackDrop(event,'+a.id+')">';

// Thumbnail + overlays
h+='<div class="cthumb">'+thumb;
if(s!==null) h+='<span class="ace '+cls+'">'+s+'</span>';
if(dur) h+='<span class="cdur-overlay">'+dur+'</span>';
h+='</div>';

// Body
h+='<div class="cbody"><div class="cname" title="'+displayName+'">'+displayName+'</div>';
h+='<div class="cmeta"><span class="vtag">v'+(a.latest_version||1)+'</span>';
if(a.is_master) h+='<span class="master-vtag">★ Master</span>';
h+='<span class="cdate">'+date+'</span>';
if(cc) h+='<span class="cdur">💬 '+cc+'</span>';
h+='</div>';
h+=tagsHtml;
var st=a.review_status||'unreviewed';
if(st!=='unreviewed') h+='<div class="card-tags"><span class="rstatus rstatus-'+st+'">'+statusLabel(st)+'</span></div>';
h+='</div></div>';
return h;
}
function showInlineFolderInput(){
if(document.getElementById('inline-folder-input'))return;
var inputCard='<div class="folder-card-ghost-input" id="inline-folder-card"><input type="text" id="inline-folder-input" class="finput-inline" placeholder="Folder name..." onkeydown="handleInlineFolderKey(event)"></div>';
var section=document.querySelector('.folders-section');
if(section){
  section.insertAdjacentHTML('beforeend',inputCard);
} else {
  var grid=document.getElementById('grid');
  var assetsSection=document.querySelector('.assets-section');
  var newSection=document.createElement('div');
  newSection.className='folders-section';
  newSection.innerHTML=inputCard;
  if(assetsSection){grid.insertBefore(newSection,assetsSection);}
  else{grid.insertAdjacentHTML('afterbegin','<div class="folders-section">'+inputCard+'</div>');}
}
document.getElementById('inline-folder-input').focus();
}

function handleInlineFolderKey(e){
if(e.key==='Enter'){var name=document.getElementById('inline-folder-input').value.trim();if(name)saveInlineFolder(name);else renderGrid();}
if(e.key==='Escape')renderGrid();
}

async function saveInlineFolder(name){
await api('/api/folders',{method:'POST',body:JSON.stringify({name:name,parent_id:state.folderId})});
await loadFolders();
renderGrid();
renderSidebar();
}

function showFolderInput(){document.getElementById("finput-row").style.display="block";document.getElementById("finput").focus();}
function handleFolderKey(e){if(e.key==="Enter")saveFolder();if(e.key==="Escape")hideFolderInput();}
async function saveFolder(){var name=document.getElementById("finput").value.trim();if(!name){hideFolderInput();return;}await api("/api/folders",{method:"POST",body:JSON.stringify({name:name,parent_id:state.folderId})});hideFolderInput();await loadFolders();renderGrid();renderSidebar();}
function hideFolderInput(){document.getElementById("finput-row").style.display="none";document.getElementById("finput").value="";}

async function safeDeleteFolder(id,onSuccess){var data=await api("/api/folders/"+id+"/count");var count=data.count||0;var folder=state.folders.find(function(f){return f.id===id;});var name=folder?folder.name:"this folder";var msg=count>0?'Delete "'+name+'"?\n\n'+count+' asset'+(count!==1?'s':'')+' and all their files will be permanently deleted. This cannot be undone.':'Delete "'+name+'"?';if(!confirm(msg))return;await api("/api/folders/"+id,{method:"DELETE"});if(onSuccess)onSuccess();}
async function deleteF(id){await safeDeleteFolder(id,async function(){if(state.folderId===id)state.folderId=state.projectId;await loadFolders();loadAssets(state.folderId);});}
async function renameF(id){var f=state.folders.find(function(x){return x.id===id;});var name=prompt("Rename:",f?f.name:"");if(!name||name===(f&&f.name))return;await api("/api/folders/"+id,{method:"PUT",body:JSON.stringify({name:name})});await loadFolders();renderSidebar();renderBreadcrumb();}
async function deleteAssetCard(id){var a=state.assets.find(function(x){return x.id===id;});if(!confirm('Delete "'+(a?a.base_name:"this asset")+'"? Cannot be undone.'))return;await api("/api/assets/"+id,{method:"DELETE"});loadAssets(state.folderId);}

function moveAsset(assetId){
moveAssetId=assetId;
var asset=state.assets.find(function(a){return a.id===assetId;});
var list=document.getElementById("move-list");
var html='';
function addOpt(folder,depth){
  var isCur=asset&&asset.folder_id===folder.id;
  if(depth>=2){html+='<div class="move-opt'+(isCur?" cur":"")+'" style="padding-left:'+(14+(depth-2)*16)+'px" onclick="submitMove('+assetId+','+folder.id+')">📁 '+folder.name+'</div>';}
  state.folders.filter(function(f){return f.parent_id===folder.id;}).forEach(function(c){addOpt(c,depth+1);});
}
var projectRoot=state.folders.find(function(f){return f.id===state.projectId;});
if(projectRoot)addOpt(projectRoot,0);
list.innerHTML=html;
document.getElementById("move-modal").style.display="block";
}
function closeMoveModal(){document.getElementById("move-modal").style.display="none";moveAssetId=null;}
async function submitMove(assetId,folderId){await fetch("/api/assets/"+assetId,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({folder_id:folderId})});closeMoveModal();loadAssets(state.folderId);}

function showCtx(e,id){e.preventDefault();e.stopPropagation();ctxId=id;var asset=state.assets.find(function(a){return a.id===id;});var rptItem=document.querySelector("#ctx-menu .ctx-item:first-child");rptItem.style.display=(asset&&asset.ace_score===null)?"block":"none";var m=document.getElementById("ctx-menu");m.style.display="block";m.style.left=e.clientX+"px";m.style.top=e.clientY+"px";var r=m.getBoundingClientRect();if(r.right>window.innerWidth)m.style.left=(e.clientX-r.width)+"px";if(r.bottom>window.innerHeight)m.style.top=(e.clientY-r.height)+"px";}
function hideCtx(){document.getElementById("ctx-menu").style.display="none";ctxId=null;}
function showProjCtx(e,id){projCtxId=id;var m=document.getElementById("proj-ctx-menu");m.style.display="block";m.style.left=e.clientX+"px";m.style.top=e.clientY+"px";var r=m.getBoundingClientRect();if(r.right>window.innerWidth)m.style.left=(e.clientX-r.width)+"px";if(r.bottom>window.innerHeight)m.style.top=(e.clientY-r.height)+"px";}
function hideProjCtx(){document.getElementById("proj-ctx-menu").style.display="none";projCtxId=null;}
async function renameProjCtx(){if(!projCtxId)return;var f=state.folders.find(function(x){return x.id===projCtxId;});var name=prompt("Rename project:",f?f.name:"");if(!name||name===(f&&f.name))return;await api("/api/folders/"+projCtxId,{method:"PUT",body:JSON.stringify({name:name})});await loadFolders();renderHome();}
async function deleteProjCtx(){if(!projCtxId)return;var id=projCtxId;hideProjCtx();await safeDeleteFolder(id,async function(){await loadFolders();renderHome();});}
function editProjCtx() {
if (!projCtxId) return;
showProjectSetupModal(projCtxId);
}
var folderCtxId=null;
function showFolderCtx(e,id){e.preventDefault();e.stopPropagation();folderCtxId=id;var m=document.getElementById("folder-ctx-menu");m.style.display="block";m.style.left=e.clientX+"px";m.style.top=e.clientY+"px";var r=m.getBoundingClientRect();if(r.right>window.innerWidth)m.style.left=(e.clientX-r.width)+"px";if(r.bottom>window.innerHeight)m.style.top=(e.clientY-r.height)+"px";}
function hideFolderCtx(){document.getElementById("folder-ctx-menu").style.display="none";folderCtxId=null;}
function showManagedFolderCtx(e, id) {
e.preventDefault();
e.stopPropagation();
managedFolderCtxId = id;
var m = document.getElementById('managed-folder-ctx-menu');
m.style.display = 'block';
m.style.left = e.clientX + 'px';
m.style.top = e.clientY + 'px';
var r = m.getBoundingClientRect();
if (r.right > window.innerWidth) m.style.left = (e.clientX - r.width) + 'px';
if (r.bottom > window.innerHeight) m.style.top = (e.clientY - r.height) + 'px';
}

function hideManagedFolderCtx() {
document.getElementById('managed-folder-ctx-menu').style.display = 'none';
managedFolderCtxId = null;
}

function editViaProjectSettings() {
if (!managedFolderCtxId) return;
var folder = state.folders.find(function(f) { return f.id === managedFolderCtxId; });
if (!folder) return;

// Walk up to find root project
var projectId = managedFolderCtxId;
while (folder && folder.parent_id) {
  projectId = folder.parent_id;
  folder = state.folders.find(function(f) { return f.id === projectId; });
}

hideManagedFolderCtx();
showProjectSetupModal(projectId);
}
async function folderCtxRename(){if(!folderCtxId)return;var f=state.folders.find(function(x){return x.id===folderCtxId;});var name=prompt("Rename:",f?f.name:"");if(!name||name===(f&&f.name))return;await api("/api/folders/"+folderCtxId,{method:"PUT",body:JSON.stringify({name:name})});await loadFolders();renderSidebar();renderGrid();renderBreadcrumb();}
async function folderCtxDelete(){if(!folderCtxId)return;var id=folderCtxId;hideFolderCtx();await safeDeleteFolder(id,async function(){if(state.folderId===id)state.folderId=state.projectId;await loadFolders();renderSidebar();renderGrid();});}

document.addEventListener("click",function(e){if(!e.target.closest("#ctx-menu"))hideCtx();if(!e.target.closest("#proj-ctx-menu"))hideProjCtx();if(!e.target.closest("#folder-ctx-menu"))hideFolderCtx();if(!e.target.closest("#managed-folder-ctx-menu"))hideManagedFolderCtx();if(!e.target.closest("#tag-suggestions"))hideSuggestions();
if(!e.target.closest("#status-select-wrap")){var dd=document.getElementById('status-dropdown');if(dd)dd.style.display='none';}
if(!e.target.closest('.ov-dd-wrap')){['score-filter-dd','status-filter-dd'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});}
});

async function openAsset(id){var versions=await api("/api/versions/"+id);if(!versions.length)return;var asset=state.assets.find(function(a){return a.id===id;});state.currentAsset={id:id,versions:versions,asset:asset};renderDetail(asset,versions[0]);document.getElementById("grid-view").style.display="none";document.getElementById("detail-view").style.display="flex";}
function closeDetail(){pauseVideo();document.getElementById("detail-view").style.display="none";document.getElementById("grid-view").style.display="flex";}

function renderDetail(asset,version){
  var info={};try{if(version.asset_info)info=JSON.parse(version.asset_info);}catch(e){}
  var cleanFile=version.video_filename?version.video_filename.replace(/^[a-f0-9]{8}_/,''):'';
var cleanBase=cleanFile.replace(/\.[^/.]+$/,'');
var displayName=asset.display_name||(cleanBase||asset.base_name);
document.getElementById("detail-name").textContent=displayName;
var sub=document.getElementById("detail-subname");
if(asset.display_name&&cleanBase&&cleanBase!==asset.display_name){
sub.textContent=cleanFile;sub.style.display='block';
}else{
sub.style.display='none';
}
  var sel=document.getElementById("version-select");
sel.innerHTML=state.currentAsset.versions.map(function(v){return'<option value="'+v.id+'"'+(v.id===version.id?" selected":"")+'>v'+v.version_number+(v.is_latest?" (latest)":"")+'</option>';}).join("");
  var player=document.getElementById("video-player");
  player.src=version.id?"/api/media/"+version.id:"";player.load();
updatePlayBtn(false);updatePlaybar();
var dlBtn=document.getElementById('player-dl-btn');
if(dlBtn){dlBtn.href=version.id?'/api/media/'+version.id:'#';dlBtn.download=version.video_filename||'video';}
  var metaTags=[];
  if(asset.phase)metaTags.push(asset.phase);if(asset.platform)metaTags.push(asset.platform);if(asset.format)metaTags.push(asset.format);
  if(asset.is_master)metaTags.push('★ Master');
  try{JSON.parse(asset.audience_tags||'[]').forEach(function(t){metaTags.push(t);});}catch(e){}
  if(version.uploaded_at)metaTags.push(new Date(version.uploaded_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}));
  var mb=document.getElementById("detail-meta");
var st=asset.review_status||'unreviewed';
var statusHtml='<div class="status-select-wrap" id="status-select-wrap">'+
'<span class="rstatus rstatus-'+st+'" id="status-select-btn" onclick="toggleStatusDropdown(event)">'+statusLabel(st)+' ▾</span>'+
'<div class="status-dropdown" id="status-dropdown" style="display:none">'+
['unreviewed','needs_attention','reviewed','approved'].map(function(s){
  return '<div class="status-drop-item" onclick="setReviewStatus('+asset.id+',\''+s+'\')"><span class="rstatus rstatus-'+s+'">'+statusLabel(s)+'</span></div>';
}).join('')+
'</div></div><div class="status-meta-sep"></div>';
mb.innerHTML=statusHtml+metaTags.map(function(t){return'<span class="meta-tag">'+t+'</span>';}).join('')+'<button class="meta-edit-btn" onclick="editAssetTags()">✏️ Edit</button>';
mb.style.display="flex";
  var btn=document.getElementById("add-report-btn");
  if(!btn){btn=document.createElement("button");btn.id="add-report-btn";btn.className="btn btn-ghost";btn.style.fontSize="12px";document.querySelector(".detail-hdr").appendChild(btn);}
  btn.textContent=version.kpi_data?"📊 Replace Report":"📊 Add Report";
  btn.onclick=function(){showReportModal(version.id,version.video_filename);};
  renderScores(version);
  loadComments(version.id);
}

async function switchVersion(versionId){var v=state.currentAsset.versions.find(function(x){return x.id===parseInt(versionId);});if(v)renderDetail(state.currentAsset.asset,v);}
function renderScores(version){
var el=document.getElementById("scores-content");
if(!version.kpi_data||!version.ace_score){
  el.innerHTML='<div class="no-score">No Brainsuite report paired<br>with this version</div>';return;
}
var cats;
try{cats=JSON.parse(version.kpi_data);}catch(e){el.innerHTML='<div class="no-score">Could not read score data</div>';return;}
var ace=version.ace_score;
var color=ace>=67?'#10b981':ace>=34?'#f59e0b':'#ef4444';
var label=ace>=67?'Green':ace>=34?'Amber':'Red';
var statCls=ace>=67?'cg':ace>=34?'ca':'cr';
var r=50,cx=60,cy=60,circ=2*Math.PI*r,offset=circ*(1-ace/100);
var html='<div class="ace-ring-wrap">';
html+='<div class="ace-ring-inner">';
html+='<svg width="120" height="120"><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#f1f5f9" stroke-width="10"/>';
html+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="10" stroke-linecap="round" stroke-dasharray="'+circ+'" stroke-dashoffset="'+offset+'" transform="rotate(-90 '+cx+' '+cy+')" style="transition:stroke-dashoffset .6s ease"/></svg>';
html+='<div class="ace-ring-num" style="color:'+color+'">'+ace+'</div></div>';
html+='<br><button class="ace-copy-btn" id="ace-copy-btn" onclick="copyAceScore('+ace+',\''+color+'\',\''+label+'\')">📋 Copy score</button>';
html+='</div><div class="cats">';
var catKeys=Object.keys(cats);catKeys.forEach(function(key,idx){
  var cat=cats[key],sum=cat.kpis.reduce(function(a,k){return a+colorValues[k.original];},0),score=Math.round(sum/cat.kpis.length);
  var sc=score>=67?'cg':score>=34?'ca':'cr';
  html+='<div class="cat-sec"><div class="cat-hdr" onclick="toggleCat(\''+key+'\')"><span class="cat-nm">'+cat.name+'</span><span class="cat-wt">×'+cat.weight+'</span><span class="cat-sc '+sc+'">'+score+'</span><span class="cat-chv'+(idx===0?' open':'')+'" id="chev-'+key+'">▼</span></div><div class="cat-kpis" id="kpis-'+key+'" style="'+(idx===0?'display:block':'display:none')+'">';
  cat.kpis.forEach(function(kpi){var bc=kpi.original==='green'?'kg':kpi.original==='amber'?'kam':'kred';html+='<div class="kpi-row"><span class="kpi-nm">'+kpi.name+'</span><span class="kpi-badge '+bc+'">'+kpi.value+'</span></div>';});
  html+='</div></div>';
});
el.innerHTML=html+'</div>';
}
function copyAceScore(ace,color,label){
var scale=2;
var canvas=document.createElement('canvas');
canvas.width=80*scale;canvas.height=80*scale;
var ctx=canvas.getContext('2d');
ctx.scale(scale,scale);
var cx=40,cy=40,r=33,lw=7;
ctx.strokeStyle='#f1f5f9';ctx.lineWidth=lw;ctx.beginPath();ctx.arc(cx,cy,r,-Math.PI/2,Math.PI*1.5);ctx.stroke();
ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.lineCap='round';ctx.beginPath();
ctx.arc(cx,cy,r,-Math.PI/2,-Math.PI/2+(Math.PI*2*(ace/100)));ctx.stroke();
ctx.fillStyle=color;ctx.font='bold 24px -apple-system,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ace,cx,cy);

var btn=document.getElementById('ace-copy-btn');
function tick(msg){
  if(btn){btn.textContent=msg;btn.classList.add('copied');setTimeout(function(){btn.textContent='📋 Copy score';btn.classList.remove('copied');},2000);}
}

var textCopied=false;
var ta=document.createElement('textarea');
ta.value=ace+' — '+label;
ta.style.cssText='position:fixed;opacity:0;top:0;left:0;width:1px;height:1px';
document.body.appendChild(ta);
try{ta.focus();ta.select();textCopied=document.execCommand('copy');}catch(e){}
document.body.removeChild(ta);
if(textCopied) tick('✓ Text copied');

canvas.toBlob(function(blob){
  if(window.ClipboardItem&&navigator.clipboard&&navigator.clipboard.write){
    navigator.clipboard.write([new ClipboardItem({'image/png':blob})])
      .then(function(){tick('✓ Image copied!');})
      .catch(function(){if(!textCopied){dlBlob(blob,ace,tick);}});
  } else if(!textCopied){
    dlBlob(blob,ace,tick);
  }
});
}

function dlBlob(blob,ace,tick){
var url=URL.createObjectURL(blob);
var a=document.createElement('a');a.href=url;a.download='ace-score-'+ace+'.png';
document.body.appendChild(a);a.click();document.body.removeChild(a);
URL.revokeObjectURL(url);tick('↓ Saved as image');
}
function toggleCat(key){
var el=document.getElementById('kpis-'+key);
var chev=document.getElementById('chev-'+key);
if(!el)return;
var isOpen=el.style.display==='none';
document.querySelectorAll('.cat-kpis').forEach(function(k){k.style.display='none';});
document.querySelectorAll('.cat-chv').forEach(function(c){c.className='cat-chv';});
if(isOpen){el.style.display='block';chev.className='cat-chv open';}
}

function showUpload() {
if (!state.projectId) {
alert("Please open a project first.");
return;
}

uploadFiles = {video: null, pptx: null};
document.getElementById('video-fname').textContent = '';
document.getElementById('pptx-fname').textContent = '';
document.getElementById('upstatus').style.display = 'none';
document.getElementById('upload-submit').disabled = false;
document.getElementById('upload-modal').style.display = 'block';
}
function closeUpload(){document.getElementById("upload-modal").style.display="none";}
document.getElementById("modal-overlay").addEventListener("click",function(e){if(e.target===this)closeUpload();});
document.getElementById("move-overlay").addEventListener("click",function(e){if(e.target===this)closeMoveModal();});
document.getElementById("report-overlay").addEventListener("click",function(e){if(e.target===this)closeReportModal();});
document.getElementById("tag-overlay").addEventListener("click",function(e){if(e.target===this)submitTags(true);});
function filePicked(type,input){if(!input.files[0])return;uploadFiles[type]=input.files[0];document.getElementById(type+"-fname").textContent="✓ "+input.files[0].name;}
function dzOver(e,id){e.preventDefault();document.getElementById(id).classList.add("over");}
function dzOut(id){document.getElementById(id).classList.remove("over");}
function dzDrop(e,type){e.preventDefault();dzOut(type+"-dz");var f=e.dataTransfer.files[0];if(!f)return;var ok=type==="video"?/\.(mp4|mov|avi|webm|mkv)$/i.test(f.name):/\.pptx$/i.test(f.name);if(!ok){setStatus("Wrong file type for "+type,"error");return;}uploadFiles[type]=f;document.getElementById(type+"-fname").textContent="✓ "+f.name;}
function setStatus(msg,type){var el=document.getElementById("upstatus");el.style.display="block";el.className="upstatus "+type;el.textContent=msg;}

async function submitUpload(){
  if(!uploadFiles.video){setStatus("Please select a video file","error");return;}
  document.getElementById("upload-submit").disabled=true;setStatus("Processing...","info");
  if(uploadFiles.pptx&&!checkPair(uploadFiles.video.name,uploadFiles.pptx.name)){if(!confirm('This report may not belong to this video.\n\nVideo: '+uploadFiles.video.name+'\nReport: '+uploadFiles.pptx.name+'\n\nPair them anyway?')){document.getElementById("upload-submit").disabled=false;setStatus("Upload cancelled.","error");return;}}
  var scoresJson=null,assetInfoJson=null,thumbnail=null,aceScore=null;
  if(uploadFiles.pptx){try{setStatus("Parsing Brainsuite report...","info");var parsed=await parsePPTX(uploadFiles.pptx);aceScore=calcACE(parsed.categories);scoresJson=JSON.stringify(parsed.categories);assetInfoJson=JSON.stringify(parsed.assetInfo);}catch(err){console.error(err);setStatus("Could not parse PPTX — uploading video only","info");}}
  setStatus("Generating thumbnail...","info");
var thumbResult=await generateVideoThumbnail(uploadFiles.video);
thumbnail=thumbResult.thumbnail;
var duration=thumbResult.duration;
  setStatus("Uploading...","info");
  var form=new FormData();form.append("video",uploadFiles.video);if(uploadFiles.pptx)form.append("pptx",uploadFiles.pptx);if(state.folderId)form.append("folder_id",state.folderId);if(scoresJson)form.append("scores",scoresJson);if(assetInfoJson)form.append("asset_info",assetInfoJson);if(thumbnail)form.append("thumbnail",thumbnail);if(duration!==null&&duration!==undefined)form.append("duration",duration);if(aceScore!==null)form.append("ace_score",aceScore);
  try{
    var res=await fetch("/api/upload",{method:"POST",body:form});var data=await res.json();
    if(data.ok){
      if(data.version===1){var bName=uploadFiles.video.name.replace(/\.[^/.]+$/,"");var vUrl=URL.createObjectURL(uploadFiles.video);closeUpload();showTagModal(data.asset_id,vUrl,bName,state.projectId);}
      else{setStatus("Uploaded! v"+data.version,"success");setTimeout(function(){closeUpload();loadAssets(state.folderId);},1200);}
    } else {setStatus("Error: "+(data.error||"Upload failed"),"error");document.getElementById("upload-submit").disabled=false;}
  }catch(err){setStatus("Error: "+err.message,"error");document.getElementById("upload-submit").disabled=false;}
}

function showReportModal(versionId,videoFilename){reportVersionId=versionId;reportVideoName=videoFilename||null;reportFile=null;document.getElementById("report-fname").textContent="";document.getElementById("report-status").style.display="none";document.getElementById("report-submit").disabled=false;document.getElementById("report-modal").style.display="block";}
function closeReportModal(){document.getElementById("report-modal").style.display="none";reportVersionId=null;reportFile=null;}
function reportPicked(input){if(!input.files[0])return;reportFile=input.files[0];document.getElementById("report-fname").textContent="✓ "+input.files[0].name;}
function reportDrop(e){e.preventDefault();dzOut("report-dz");var f=e.dataTransfer.files[0];if(!f||!/\.pptx$/i.test(f.name)){setRptStatus("Please drop a PPTX file","error");return;}reportFile=f;document.getElementById("report-fname").textContent="✓ "+f.name;}
function setRptStatus(msg,type){var el=document.getElementById("report-status");el.style.display="block";el.className="upstatus "+type;el.textContent=msg;}
async function submitReport(){
  if(!reportFile){setRptStatus("Please select a PPTX file","error");return;}
  if(reportVideoName&&!checkPair(reportVideoName,reportFile.name)){if(!confirm('This report may not belong to this video.\n\nVideo: '+reportVideoName+'\nReport: '+reportFile.name+'\n\nPair them anyway?'))return;}
  document.getElementById("report-submit").disabled=true;setRptStatus("Parsing report...","info");
  try{var parsed=await parsePPTX(reportFile);var aceScore=calcACE(parsed.categories);setRptStatus("Uploading...","info");var form=new FormData();form.append("pptx",reportFile);form.append("scores",JSON.stringify(parsed.categories));form.append("asset_info",JSON.stringify(parsed.assetInfo));form.append("ace_score",aceScore);var res=await fetch("/api/versions/"+reportVersionId+"/report",{method:"POST",body:form});var data=await res.json();if(data.ok){setRptStatus("Report added!","success");setTimeout(function(){closeReportModal();loadAssets(state.folderId);if(document.getElementById("detail-view").style.display!=="none"&&state.currentAsset)openAsset(state.currentAsset.id);},1000);}else{setRptStatus("Error: "+(data.error||"Failed"),"error");document.getElementById("report-submit").disabled=false;}}catch(err){setRptStatus("Error: "+err.message,"error");document.getElementById("report-submit").disabled=false;}
}
function addReportFromCtx(){var asset=state.assets.find(function(a){return a.id===ctxId;});if(!asset||!asset.latest_version_id)return;showReportModal(asset.latest_version_id,asset.video_filename);}

function showTagModal(assetId, videoUrl, baseName, projectId) {
tagState.assetId = assetId;
tagState.videoUrl = videoUrl;
tagState.baseName = baseName;
tagState.projectId = projectId;
tagState.phase = null;
tagState.platform = null;
tagState.format = null;
tagState.isMaster = false;
tagState.audienceTags = [];
tagState.contentOrigin = 'Brand';
tagState.language = null;

var ctx = getFolderContext(state.folderId, projectId);
if (ctx.phase) tagState.phase = ctx.phase;
if (ctx.platform) tagState.platform = ctx.platform;
if (ctx.format) tagState.format = ctx.format;
if (ctx.test) tagState.testConfig = {test: ctx.test, cta: ctx.cta};
else tagState.testConfig = null;

// Load project config for languages
api('/api/folders/' + projectId + '/config').then(function(config) {
  tagState.projectConfig = config;
  renderTagModal();
});

var vid = document.getElementById('tag-video');
vid.src = videoUrl;
vid.load();
vid.play().catch(function(){});

document.getElementById('tag-display-name').value = baseName;
document.getElementById('tag-master').checked = false;

document.getElementById('tag-modal').style.display = 'block';
}
function closeTagModal(){var vid=document.getElementById("tag-video");if(vid.src.startsWith("blob:"))URL.revokeObjectURL(vid.src);vid.pause();vid.src="";document.getElementById("tag-modal").style.display="none";loadFolders().then(function(){loadAssets(state.folderId);});}
function getFolderContext(folderId, projectId) {
if (!folderId || folderId === projectId) return {};

var path = [];
var id = folderId;

// Walk up to project root, collecting managed folders
while (id && id !== projectId) {
  var f = state.folders.find(function(x) { return x.id === id; });
  if (!f) break;
  if (f.is_managed) {
    path.unshift({id: f.id, name: f.name, test: f.brainsuite_test, cta: f.cta});
  }
  id = f.parent_id;
}

// Parse path: Phase / Platform / Format (if exists)
if (path.length === 0) return {};
if (path.length === 1) return {phase: path[0].name};
if (path.length === 2) return {
  phase: path[0].name, 
  platform: path[1].name,
  test: path[1].test,
  cta: path[1].cta
};
if (path.length >= 3) return {
  phase: path[0].name, 
  platform: path[1].name, 
  format: path[2].name,
  test: path[2].test,
  cta: path[2].cta
};

return {};
}
function renderTagModal() {
var ctx = getFolderContext(state.folderId, tagState.projectId);
var inManagedFolder = !!(ctx.phase || ctx.platform || ctx.format);
var config = tagState.projectConfig || {};
var hasAdditionalLangs = config.identity && config.identity.additionalLanguages && config.identity.additionalLanguages.length > 0;

// Show/hide context-dependent sections
var phaseSection = document.getElementById('tag-section-phase');
var platformSection = document.getElementById('tag-section-platform');
var formatSection = document.getElementById('tag-section-format');
var testBanner = document.getElementById('tag-test-banner');
var contentOriginSection = document.getElementById('tag-section-content-origin');
var languageSection = document.getElementById('tag-section-language');

if (inManagedFolder) {
  if (phaseSection) phaseSection.style.display = 'none';
  if (platformSection) platformSection.style.display = 'none';
  if (formatSection) formatSection.style.display = 'none';
  
  // Show test banner if test is configured
  if (testBanner && tagState.testConfig && tagState.testConfig.test) {
    testBanner.style.display = 'block';
    testBanner.innerHTML = '📍 Will test as: <strong>' + tagState.testConfig.test + '</strong>';
  } else if (testBanner) {
    testBanner.style.display = 'none';
  }
} else {
  if (phaseSection) phaseSection.style.display = 'block';
  if (platformSection) platformSection.style.display = 'block';
  if (formatSection) formatSection.style.display = 'block';
  if (testBanner) testBanner.style.display = 'none';
  
  // Render pills for manual selection using project config
var configPhases = (config.org && config.org.phases) || PHASES;
document.getElementById('tag-phases').innerHTML = configPhases.map(function(p) {
return '<button class="pill' + (tagState.phase === p ? ' active' : '') + '" onclick="selectTag(\'phase\',\'' + p + '\')">' + p + '</button>';
}).join('');

// Get available platforms from project config
var configPlatforms = [];
if (config.phaseChannels && tagState.phase && config.phaseChannels[tagState.phase]) {
configPlatforms = config.phaseChannels[tagState.phase]
  .filter(function(ch) { return ch.enabled !== false; })
  .map(function(ch) { return ch.name; });
}

// Use config platforms if available, otherwise fallback to hardcoded
var platformList = configPlatforms.length > 0 ? configPlatforms : PLATFORMS;
document.getElementById('tag-platforms').innerHTML = platformList.map(function(p) {
return '<button class="pill' + (tagState.platform === p ? ' active' : '') + '" onclick="selectTag(\'platform\',\'' + p + '\')">' + p + '</button>';
}).join('');

// Build format list from project config for selected platform
var formatOptions = [];

if (tagState.platform && tagState.phase && config.phaseChannels && config.phaseChannels[tagState.phase]) {
var channels = config.phaseChannels[tagState.phase];
var platformChannel = channels.find(function(ch) { return ch.name === tagState.platform; });

if (platformChannel && platformChannel.formats) {
  // Multi-format platform (Meta, OLV 6, etc.)
  formatOptions = platformChannel.formats
    .filter(function(f) { return f.enabled !== false; })
    .map(function(f) { return f.name; });
}
}

// Show/hide format section based on whether platform has formats
if (formatOptions.length > 0) {
if (formatSection) formatSection.style.display = 'block';
document.getElementById('tag-formats').innerHTML = formatOptions.map(function(f) {
  return '<button class="pill' + (tagState.format === f ? ' active' : '') + '" onclick="selectTag(\'format\',\'' + f + '\')">' + f + '</button>';
}).join('');
} else {
// Single-format platform (TikTok, Snapchat, etc.) - hide format section
if (formatSection) formatSection.style.display = 'none';
tagState.format = null; // Clear any selected format
}
}

// Content Origin
if (contentOriginSection) {
  contentOriginSection.style.display = 'block';
  document.getElementById('tag-content-origin').innerHTML = ['Brand', 'Creator'].map(function(co) {
    return '<button class="pill' + (tagState.contentOrigin === co ? ' active' : '') + '" onclick="tagState.contentOrigin=\'' + co + '\';renderTagModal()">' + co + '</button>';
  }).join('');
}

// Language (only if project has additional languages)
if (languageSection) {
  if (hasAdditionalLangs) {
    languageSection.style.display = 'block';
    var allLangs = [config.identity.defaultLanguage].concat(config.identity.additionalLanguages);
    document.getElementById('tag-language').innerHTML = allLangs.map(function(lang) {
      var isSelected = tagState.language === lang || (!tagState.language && lang === config.identity.defaultLanguage);
      return '<button class="pill' + (isSelected ? ' active' : '') + '" onclick="tagState.language=\'' + lang + '\';renderTagModal()">' + lang + '</button>';
    }).join('');
  } else {
    languageSection.style.display = 'none';
  }
}
// Show project-defined audiences as clickable pills
var audiencePillsEl = document.getElementById('tag-audience-pills');
if (audiencePillsEl) {
var configAudiences = (config.org && config.org.audiences) || [];
if (configAudiences.length > 0) {
  audiencePillsEl.innerHTML = configAudiences.map(function(aud) {
    var isAdded = tagState.audienceTags.indexOf(aud) !== -1;
    return '<button class="pill' + (isAdded ? ' active' : '') + '" onclick="toggleAudienceTag(\'' + aud + '\')">' + aud + '</button>';
  }).join('');
  audiencePillsEl.style.display = 'flex';
} else {
  audiencePillsEl.style.display = 'none';
}
}
validateTagForm();
}
function selectTag(field,val){
tagState[field]=tagState[field]===val?null:val;
// Clear format if platform changed
if (field === 'platform') tagState.format = null;
renderTagModal();
}
function toggleAudienceTag(tag) {
if (tagState.audienceTags.length === 1 && tagState.audienceTags[0] === tag) {
  // Clicking the already-selected tag deselects it
  tagState.audienceTags = [];
} else {
  // Select this tag (replaces any previous selection)
  tagState.audienceTags = [tag];
}
renderTagModal(); // Re-render to update pill state
}
function validateTagForm() {
var ctx = getFolderContext(state.folderId, tagState.projectId);
var inManagedFolder = !!(ctx.phase || ctx.platform);

// If in managed folder, always valid (context provides phase/platform)
if (inManagedFolder) {
  document.getElementById('tag-confirm').disabled = false;
} else {
  // Manual tagging requires phase + platform
  document.getElementById('tag-confirm').disabled = !(tagState.phase && tagState.platform);
}
}
async function getBrainsuiteTestConfig(assetId) {
// Returns test configuration for an asset, ready for Brainsuite API
// Returns: {test: "Instagram Story", cta: true, language: "English", company: "Unilever", brand: "Dove", ...}
// Returns null if asset has no test configured (e.g., Pinterest, Display, or unmanaged folder)

var asset = state.assets.find(function(a) { return a.id === assetId; });
if (!asset) return null;

// Walk up folder tree to find managed folder with test config
var folderId = asset.folder_id;
var testConfig = null;

while (folderId) {
  var folder = state.folders.find(function(f) { return f.id === folderId; });
  if (!folder) break;
  
  // If this is a managed folder with a test configured, use it
  if (folder.is_managed && folder.brainsuite_test) {
    testConfig = {
      test: folder.brainsuite_test,
      cta: folder.cta === 1
    };
    break;
  }
  
  folderId = folder.parent_id;
}

// If no test found, return null (non-testable asset)
if (!testConfig) return null;

// Get project-level config
var projectId = state.projectId;
var projectConfig = await api('/api/folders/' + projectId + '/config');

// Build complete config object for Brainsuite API
return {
  // Test configuration
  test: testConfig.test,
  cta: testConfig.cta,
  
  // Asset metadata
  assetName: asset.base_name,
  language: asset.language || (projectConfig.identity && projectConfig.identity.defaultLanguage) || 'English',
  contentOrigin: asset.content_origin || 'Brand',
  
  // Project/campaign context (from Step 1 of project setup)
  company: projectConfig.identity && projectConfig.identity.company,
  brand: projectConfig.identity && projectConfig.identity.brand,
  market: projectConfig.identity && projectConfig.identity.market,
  businessGroup: projectConfig.identity && projectConfig.identity.businessGroup,
  category: projectConfig.identity && projectConfig.identity.category,
  
  // Hardcoded values as per original spec
  assetStage: 'Iteration',
  assetOrigin: 'Global (BG)',
  
  // Asset ID for reference
  assetId: assetId
};
}
function findTargetFolder(projectId, phase, platform, format) {
if (!projectId || !phase || !platform) return null;

// Find phase folder
var phaseFolder = state.folders.find(function(f) {
  return f.parent_id === projectId && f.name === phase && f.is_managed;
});
if (!phaseFolder) return null;

// Find platform folder under phase
var platformFolder = state.folders.find(function(f) {
  return f.parent_id === phaseFolder.id && f.name === platform && f.is_managed;
});

// If platform has subfolders (formats), try to find format folder
if (platformFolder && format) {
  var formatFolder = state.folders.find(function(f) {
    return f.parent_id === platformFolder.id && f.name === format && f.is_managed;
  });
  if (formatFolder) return formatFolder.id;
}

// If no format or format folder not found, return platform folder
if (platformFolder) return platformFolder.id;

// Fallback to phase folder if platform not found
return phaseFolder.id;
}
async function submitTags(skip){
  if(skip){closeTagModal();return;}
var displayName=document.getElementById("tag-display-name").value.trim();
var payload={display_name:displayName!==tagState.baseName?displayName:null,phase:tagState.phase,platform:tagState.platform,format:tagState.format||null,is_master:tagState.isMaster?1:0,audience_tags:tagState.audienceTags,content_origin:tagState.contentOrigin||'Brand',language:tagState.language||null,project_id:tagState.projectId};
var res=await api("/api/assets/"+tagState.assetId+"/tags",{method:"PUT",body:JSON.stringify(payload)});
if(!res.ok)return;

// Auto-move to correct folder based on tags
var targetFolderId = findTargetFolder(tagState.projectId, tagState.phase, tagState.platform, tagState.format);
if (targetFolderId) {
  await api("/api/assets/"+tagState.assetId, {
    method: "PUT", 
    body: JSON.stringify({folder_id: targetFolderId})
  });
}
  var vid=document.getElementById("tag-video");if(vid.src.startsWith("blob:"))URL.revokeObjectURL(vid.src);vid.pause();vid.src="";document.getElementById("tag-modal").style.display="none";
  var savedId=tagState.assetId;
var inDetail=document.getElementById("detail-view").style.display!=="none";
var wasInOverview = state.folderId === state.projectId;

await loadFolders();

// Stay in overview if user uploaded from overview
if (wasInOverview) {
state.folderId = state.projectId;
state.assets = await api("/api/assets?project_id="+state.projectId);
renderSidebar();
renderOverview();
renderBreadcrumb();
} else {
// Otherwise go to the folder where asset landed
state.assets = await api(state.folderId?"/api/assets?folder_id="+state.folderId:"/api/assets");
renderSidebar();
renderBreadcrumb();
if(inDetail&&savedId){
  var updated=state.assets.find(function(a){return a.id===savedId;});
  if(updated&&state.currentAsset){
    state.currentAsset.asset=updated;
    renderDetail(updated,state.currentAsset.versions[0]);
  }
}else{
  renderGrid();
}
}
}

window.addEventListener("dragenter",function(e){if(state.draggingAssetId)return;if(document.getElementById("upload-modal").style.display==="block"||document.getElementById("move-modal").style.display==="block"||document.getElementById("report-modal").style.display==="block"||document.getElementById("tag-modal").style.display==="block")return;if(!e.dataTransfer||!Array.from(e.dataTransfer.types||[]).includes("Files"))return;dragCounter++;if(dragCounter===1)document.getElementById("drag-overlay").classList.add("active");});
window.addEventListener("dragleave",function(){if(state.draggingAssetId)return;dragCounter--;if(dragCounter<=0){dragCounter=0;document.getElementById("drag-overlay").classList.remove("active");}});
window.addEventListener("dragover",function(e){e.preventDefault();updateDragGhost(e.clientX,e.clientY);});
window.addEventListener("drop",function(e){e.preventDefault();dragCounter=0;document.getElementById("drag-overlay").classList.remove("active");if(state.draggingAssetId)return;if(document.getElementById("upload-modal").style.display==="block")return;if(document.getElementById("report-modal").style.display==="block")return;if(document.getElementById("tag-modal").style.display==="block")return;if(!state.projectId)return;var files=Array.from(e.dataTransfer.files);var video=files.find(function(f){return /\.(mp4|mov|avi|webm|mkv)$/i.test(f.name);});var pptx=files.find(function(f){return /\.pptx$/i.test(f.name);});if(!video&&!pptx)return;showUpload();if(video){uploadFiles.video=video;document.getElementById("video-fname").textContent="✓ "+video.name;}if(pptx){uploadFiles.pptx=pptx;document.getElementById("pptx-fname").textContent="✓ "+pptx.name;}});
document.getElementById('home-view').addEventListener('scroll',function(){
var hero=document.querySelector('.home-hero');
var compact=document.getElementById('home-compact-hdr');
if(!hero||!compact)return;
if(this.scrollTop>hero.offsetHeight*0.4){compact.classList.add('visible');}
else{compact.classList.remove('visible');}
});

function cardDragStart(e,id){
state.draggingAssetId=id;
e.dataTransfer.setData("assetId",id);
e.dataTransfer.effectAllowed="move";
var card=e.currentTarget;
var clone=card.cloneNode(true);
clone.querySelectorAll("video").forEach(function(v){v.remove();});
clone.style.cssText='position:fixed;pointer-events:none;opacity:0.85;z-index:9999;width:'+card.offsetWidth+'px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.2);transition:transform 0.2s ease;transform:scale(1);';
dragGhostOffsetX=e.offsetX;
dragGhostOffsetY=e.offsetY;
clone.style.transformOrigin=dragGhostOffsetX+'px '+dragGhostOffsetY+'px';
document.body.appendChild(clone);
dragGhostEl=clone;
var canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;
canvas.style.cssText='position:fixed;top:-9999px;left:-9999px';
document.body.appendChild(canvas);
e.dataTransfer.setDragImage(canvas,0,0);
setTimeout(function(){document.body.removeChild(canvas);},0);
updateDragGhost(e.clientX,e.clientY);
}
function cardDragEnd(){
state.draggingAssetId=null;
if(dragGhostEl){dragGhostEl.remove();dragGhostEl=null;}
}
function updateDragGhost(x,y){
if(!dragGhostEl)return;
dragGhostEl.style.left=(x-dragGhostOffsetX)+'px';
dragGhostEl.style.top=(y-dragGhostOffsetY)+'px';
}
function folderDragOver(e,el){if(!state.draggingAssetId)return;e.preventDefault();el.style.outline="3px solid #6366f1";if(dragGhostEl)dragGhostEl.style.transform='scale(0.5)';}
function folderDragLeave(el){el.style.outline="";if(dragGhostEl)dragGhostEl.style.transform='scale(1)';}
async function folderDrop(e,folderId){e.preventDefault();folderDragLeave(e.currentTarget);if(!state.draggingAssetId)return;await submitMove(state.draggingAssetId,folderId);state.draggingAssetId=null;}

function cardStackOver(e,el,targetId){
if(!state.draggingAssetId||state.draggingAssetId===targetId)return;
e.preventDefault();
e.stopPropagation();
updateDragGhost(e.clientX,e.clientY);
if(!el.querySelector('.stack-overlay')){
  var ov=document.createElement('div');
  ov.className='stack-overlay';
  ov.textContent='⊕ Stack version';
  el.appendChild(ov);
}
if(dragGhostEl)dragGhostEl.style.transform='scale(0.5)';
}

function cardStackLeave(e,el){
if(el&&el.contains&&el.contains(e.relatedTarget))return;
var ov=el&&el.querySelector?el.querySelector('.stack-overlay'):null;
if(ov)ov.remove();
if(dragGhostEl)dragGhostEl.style.transform='scale(1)';
}

function cardStackDrop(e,targetId){
e.preventDefault();
e.stopPropagation();
var sourceId=state.draggingAssetId;
if(!sourceId||sourceId===targetId)return;
cardStackLeave({relatedTarget:null},e.currentTarget);
state.draggingAssetId=null;
var src=state.assets.find(function(a){return a.id===sourceId;});
var tgt=state.assets.find(function(a){return a.id===targetId;});
var srcName=src?(src.display_name||src.base_name):'this asset';
var tgtName=tgt?(tgt.display_name||tgt.base_name):'this asset';
if(!confirm('Stack "'+srcName+'" onto "'+tgtName+'"?\n\n"'+srcName+'" becomes the latest version. Its metadata will be replaced by "'+tgtName+'\'s". This cannot be undone.'))return;
absorbAsset(targetId,sourceId);
}

async function absorbAsset(targetId,sourceId){
var res=await api('/api/assets/'+targetId+'/absorb/'+sourceId,{method:'POST'});
if(res.ok){
  loadAssets(state.folderId);
} else {
  alert('Stack failed: '+(res.error||'Unknown error'));
}
}

function initCardPreview(card){var src=card.dataset.video;if(!src)return;var thumb=card.querySelector(".cthumb");var video=document.createElement("video");video.muted=true;video.playsInline=true;video.preload="none";video.style.cssText="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity 0.15s;pointer-events:none;";thumb.appendChild(video);var loaded=false;card.addEventListener("mouseenter",function(){if(!loaded){video.src="/api/media/"+src;video.load();loaded=true;}var bg=thumb.querySelector("img,.cph");if(bg)bg.style.opacity="0";video.style.opacity="1";});card.addEventListener("mousemove",function(e){if(!video.duration)return;var rect=thumb.getBoundingClientRect();video.currentTime=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))*video.duration;});card.addEventListener("mouseleave",function(){video.style.opacity="0";video.pause();var bg=thumb.querySelector("img,.cph");if(bg)bg.style.opacity="1";});card.addEventListener("dragstart",function(){video.style.opacity="0";var bg=thumb.querySelector("img,.cph");if(bg)bg.style.opacity="1";});}

document.addEventListener("keydown",function(e){if(e.key==="Escape"){if(document.getElementById("detail-view").style.display!=="none"){closeDetail();return;}if(document.getElementById("project-setup-modal").style.display==="block"){closeProjectSetup();return;}closeUpload();closeMoveModal();closeReportModal();hideCtx();hideProjCtx();hideFolderCtx();hideManagedFolderCtx();}});

function checkPair(videoName,pptxName){var vNorm=videoName.toLowerCase().replace(/[^a-z0-9]/g,"");var pNorm=pptxName.toLowerCase().replace(/[^a-z0-9]/g,"");if(pNorm.includes(vNorm))return true;var pCore=pptxName.toLowerCase().replace(/^ace[^_]*_/,"").replace(/_?\d{8}\.pptx$/,"").replace(/^[a-z]+_/,"").replace(/[^a-z0-9]/g,"");return pCore.length>4&&vNorm.includes(pCore);}

async function generateVideoThumbnail(file){return new Promise(function(resolve){var video=document.createElement("video"),url=URL.createObjectURL(file),captured=false;video.muted=true;video.playsInline=true;function capture(){if(captured)return;captured=true;try{var c=document.createElement("canvas");c.width=320;c.height=Math.round(320*video.videoHeight/video.videoWidth)||180;c.getContext("2d").drawImage(video,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve({thumbnail:c.toDataURL("image/jpeg",0.7),duration:Math.round(video.duration)||null});}catch(e){URL.revokeObjectURL(url);resolve({thumbnail:null,duration:null});}}video.addEventListener("seeked",capture);video.addEventListener("loadeddata",function(){video.currentTime=video.duration>0?Math.min(2,video.duration*0.2):0;});video.onerror=function(){URL.revokeObjectURL(url);resolve({thumbnail:null,duration:null});};video.src=url;video.load();});}

function calcACE(cats){var tw=0,ws=0;Object.keys(cats).forEach(function(k){var sum=cats[k].kpis.reduce(function(a,kpi){return a+colorValues[kpi.original];},0);ws+=(sum/cats[k].kpis.length)*cats[k].weight;tw+=cats[k].weight;});return Math.round(ws/tw);}
function mkCats(){return JSON.parse(JSON.stringify({attention:{name:"Attention",weight:3,kpis:[{id:"att_1",name:"Engaging Beginning",type:"binary",original:"green",value:"✓",thresholds:null,hasAmber:false},{id:"att_2",name:"Scene Pace",type:"binary",original:"green",value:"✓",thresholds:null,hasAmber:false},{id:"att_3",name:"Scene Motion",type:"numeric",original:"green",value:75,thresholds:{red:33,amber:50},hasAmber:true}]},branding:{name:"Branding",weight:5,kpis:[{id:"bra_1",name:"Brand Cut-Through",type:"numeric",original:"red",value:19,thresholds:{red:25,amber:50},hasAmber:true},{id:"bra_2",name:"Brand CT First Seconds",type:"binary",original:"green",value:"✓",thresholds:null,hasAmber:false},{id:"bra_3",name:"Product Attention Over Time",type:"numeric",original:"red",value:0,thresholds:{red:5,amber:27},hasAmber:true},{id:"bra_4",name:"Product CT First Seconds",type:"binary",original:"red",value:"✗",thresholds:null,hasAmber:false}]},processing:{name:"Processing",weight:1,kpis:[{id:"pro_1",name:"Ad Recall Potential",type:"numeric",original:"green",value:94,thresholds:{red:33,amber:50},hasAmber:true},{id:"pro_2",name:"Visual Simplicity",type:"numeric",original:"green",value:81,thresholds:{red:33,amber:50},hasAmber:true},{id:"pro_3",name:"Ideal Aspect Ratio",type:"binary",original:"green",value:"✓",thresholds:null,hasAmber:false},{id:"pro_4",name:"Enough Time to Read",type:"numeric",original:"red",value:8,thresholds:{red:33,amber:50},hasAmber:true},{id:"pro_5",name:"Ideal Sound Setting",type:"binary",original:"green",value:"✓",thresholds:null,hasAmber:false}]},emotional:{name:"Emotional",weight:1,kpis:[{id:"emo_1",name:"Human Element",type:"numeric",original:"green",value:81,thresholds:{red:30,amber:70},hasAmber:true},{id:"emo_2",name:"Activation: Visual",type:"numeric",original:"green",value:81,thresholds:{red:33,amber:50},hasAmber:true},{id:"emo_3",name:"Activation: Text",type:"numeric",original:"green",value:83,thresholds:{red:25,amber:40},hasAmber:true}]},persuasion:{name:"Persuasion",weight:1,kpis:[{id:"per_1",name:"CTA Cut-Through",type:"binary",original:"red",value:"✗",thresholds:null,hasAmber:false},{id:"per_2",name:"Engagement Potential",type:"numeric",original:"amber",value:50,thresholds:{red:33,amber:50},hasAmber:true}]}}))}
function exText(xml){var m=xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);if(m)return m.map(function(x){return x.replace(/<[^>]+>/g,"");}).join(" ");return xml.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();}
function exThresh(text){var p1=[/&lt;\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*&gt;\s*(\d+(?:\.\d+)?)/,/<\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*>\s*(\d+(?:\.\d+)?)/];for(var i=0;i<p1.length;i++){var m=text.match(p1[i]);if(m)return{red:parseFloat(m[1]),amber:parseFloat(m[3]),hasAmber:true};}var p2=[/&lt;\s*(\d+(?:\.\d+)?)\s*&gt;\s*(\d+(?:\.\d+)?)/,/<\s*(\d+(?:\.\d+)?)\s*>\s*(\d+(?:\.\d+)?)/];for(var j=0;j<p2.length;j++){var m2=text.match(p2[j]);if(m2)return{red:parseFloat(m2[1]),amber:null,hasAmber:false};}return null;}
function detColor(val,t){if(!t)return val>0?"green":"red";if(t.hasAmber){if(val<t.red)return"red";if(val<=t.amber)return"amber";return"green";}return val>t.red?"green":"red";}
async function parsePPTX(file){var zip=await JSZip.loadAsync(file);var thumbUrl,allText="",kpiOv="",slideTexts={},kpiData={},thresh={};var tp=Object.keys(zip.files).find(function(p){return /ppt\/media\/image-4-1\.(png|jpg|jpeg)/i.test(p);});if(tp){try{var d=await zip.file(tp).async("base64");var e=tp.split(".").pop().toLowerCase();thumbUrl="data:image/"+(e==="png"?"png":"jpeg")+";base64,"+d;}catch(e){}}for(var path in zip.files){var mm=path.match(/ppt\/slides\/slide(\d+)\.xml/);if(mm){var content=await zip.file(path).async("string");var text=exText(content);slideTexts[mm[1]]=text;allText+=" "+text;if(/KPI Overview|Attention:.*Branding:.*Processing Ease:/i.test(text))kpiOv=text;}}var nm=allText.match(/Asset Name:\s*([A-Za-z0-9_\s&;]+?)\s+Asset Stage/i);var assetName=nm?nm[1].trim():"Unknown";var tsm=allText.match(/Date:\s*(\d{1,2}\/\d{1,2}\/\d{4},\s*\d{1,2}:\d{2}\s*[AP]M)/i);var assetDate=tsm?tsm[1]:null;var company=(allText.match(/Which Company\?:\s*(\w+)/i)||[])[1]||null;var brand=(allText.match(/Brand Name:\s*([^\n:]+?)(?=\s+(?:Voice-Over|Asset|File|Market|Date|Category))/i)||[])[1];if(brand)brand=brand.trim();var pm=allText.match(/Scene pace is.*?(?:above|below) benchmark for\s+([A-Za-z0-9\s\-]+)/i);var platform=pm?pm[1].trim():null;for(var sn in slideTexts){var st=slideTexts[sn];if(/KPI Overview/i.test(st))continue;if(/Scene Motion.*?motion score/i.test(st)&&!thresh.sm)thresh.sm=exThresh(st);if(/Brand Cut-Through\s+\d+.*?brand cut-through/i.test(st)&&!/First Seconds/i.test(st.substring(0,100))&&!thresh.bc)thresh.bc=exThresh(st);if(/Packaged Product Attention Over Time/i.test(st)&&!thresh.pt)thresh.pt=exThresh(st);if(/Ad Recall Potential.*?ad recall potential/i.test(st)&&!thresh.ar)thresh.ar=exThresh(st);if(/Visual Simplicity.*?visual simplicity/i.test(st)&&!thresh.vs)thresh.vs=exThresh(st);if(/Enough Time to Read.*?text on the screen/i.test(st)&&!thresh.rt)thresh.rt=exThresh(st);if(/Human Element.*?incorporates a person/i.test(st)&&!thresh.he)thresh.he=exThresh(st);if(/Activation Potential: Visual.*?of scenes, the visuals/i.test(st)&&!thresh.va)thresh.va=exThresh(st);if(/Activation Potential: Text.*?scenes with text/i.test(st)&&!thresh.ta)thresh.ta=exThresh(st);if(/Engagement Potential.*?engagement potential/i.test(st)&&!thresh.ep)thresh.ep=exThresh(st);}function gv(rx){var m=kpiOv.match(rx);return m?parseInt(m[1]):undefined;}kpiData.sm=gv(/(\d+)\s+Scene Motion/i);kpiData.bc=gv(/(\d+)\s+Brand Cut-Through(?!\s+in\s+First)/i);kpiData.pt=gv(/(\d+)\s+Packaged Product Attention Over Time/i);kpiData.ar=gv(/(\d+)\s+Ad Recall Potential/i);kpiData.vs=gv(/(\d+)\s+Visual Simplicity/i);kpiData.rt=gv(/(\d+)\s+Enough Time to Read/i);kpiData.he=gv(/(\d+)\s+Human Element/i);kpiData.va=gv(/(\d+)\s+Activation Potential:\s*Visual/i);kpiData.ta=gv(/(\d+)\s+Activation Potential:\s*Text/i);kpiData.ep=gv(/(\d+)\s+Engagement Potential/i);var bin={eb:/Engaging Beginning.*?has enough movement/i.test(allText)&&!/has not enough movement/i.test(allText),sp:/Scene pace is.*?\d+\.?\d*\s+which is\s+above benchmark/i.test(allText),bf:/Brand Cut-Through in First Seconds.*?The brand attracts enough attention/i.test(allText),pf:/Packaged Product Cut-Through in First Seconds.*?The product attracts enough attention in the first \d+ seconds/i.test(allText),ar:/Ideal Aspect Ratio.*?The video respects the ideal aspect ratio/i.test(allText)&&!/does not respect/i.test(allText),so:/Ideal Sound Setting.*?The video respects the ideal audio settings/i.test(allText)&&!/does not respect/i.test(allText),ct:/Call-to-Action Cut-Through.*?Call-to-action cuts through above norm in none/i.test(allText)};var cats=mkCats();function applyT(kpi,t){if(t){kpi.thresholds=t;kpi.hasAmber=t.hasAmber;}}applyT(cats.attention.kpis[2],thresh.sm);applyT(cats.branding.kpis[0],thresh.bc);applyT(cats.branding.kpis[2],thresh.pt);applyT(cats.processing.kpis[0],thresh.ar);applyT(cats.processing.kpis[1],thresh.vs);applyT(cats.processing.kpis[3],thresh.rt);applyT(cats.emotional.kpis[0],thresh.he);applyT(cats.emotional.kpis[1],thresh.va);applyT(cats.emotional.kpis[2],thresh.ta);applyT(cats.persuasion.kpis[1],thresh.ep);function applyN(kpi,val){if(val!==undefined){kpi.value=val;kpi.original=detColor(val,kpi.thresholds);}}applyN(cats.attention.kpis[2],kpiData.sm);applyN(cats.branding.kpis[0],kpiData.bc);applyN(cats.branding.kpis[2],kpiData.pt);applyN(cats.processing.kpis[0],kpiData.ar);applyN(cats.processing.kpis[1],kpiData.vs);applyN(cats.processing.kpis[3],kpiData.rt);applyN(cats.emotional.kpis[0],kpiData.he);applyN(cats.emotional.kpis[1],kpiData.va);applyN(cats.emotional.kpis[2],kpiData.ta);applyN(cats.persuasion.kpis[1],kpiData.ep);function applyB(kpi,val){kpi.original=val?"green":"red";kpi.value=val?"✓":"✗";}applyB(cats.attention.kpis[0],bin.eb);applyB(cats.attention.kpis[1],bin.sp);applyB(cats.branding.kpis[1],bin.bf);applyB(cats.branding.kpis[3],bin.pf);applyB(cats.processing.kpis[2],bin.ar);applyB(cats.processing.kpis[4],bin.so);cats.persuasion.kpis[0].original=bin.ct?"red":"green";cats.persuasion.kpis[0].value=bin.ct?"✗":"✓";return{categories:cats,assetInfo:{name:assetName,date:assetDate,company:company,brand:brand,platform:platform,thumbnail:thumbUrl}};}

// ============ PROJECT SETUP MODAL ============
var psState = {
step: 1,
editingProjectId: null,
name: '',
company: 'Unilever',
brand: '',
market: '',
businessGroup: '',
category: '',
defaultLanguage: 'English',
additionalLanguages: [],
phases: [],
audiences: [],
phaseChannels: {}
};

var DEFAULT_CHANNELS = [
{name: 'OLV 15', test: 'YouTube In-Stream', cta: false},
{name: 'OLV 6', formats: [{name: '16x9', test: 'YouTube In-Stream', cta: false}, {name: '9x16', test: 'YouTube Short', cta: true}]},
{name: 'Meta', formats: [{name: 'Story', test: 'Instagram Story', cta: true}, {name: 'Feed', test: 'Instagram Feed', cta: true}]},
{name: 'TikTok', test: 'TikTok', cta: true},
{name: 'Snapchat', test: 'Snapchat', cta: true},
{name: 'Pinterest', test: null, cta: false},
{name: 'Display', test: null, cta: false}
];

async function showProjectSetupModal(projectId) {
psState.editingProjectId = projectId || null;
psState.step = 1;
resetProjectSetupState();

if (projectId) {
document.getElementById('ps-modal-title').textContent = 'Edit Project Settings';
await loadProjectConfig(projectId);
} else {
document.getElementById('ps-modal-title').textContent = 'New Project Setup';
}

renderPsStep();
document.getElementById('project-setup-modal').style.display = 'block';
}

function closeProjectSetup() {
document.getElementById('project-setup-modal').style.display = 'none';
resetProjectSetupState();
}

function resetProjectSetupState() {
psState.name = '';
psState.company = 'Unilever';
psState.brand = '';
psState.market = '';
psState.businessGroup = '';
psState.category = '';
psState.defaultLanguage = 'English';
psState.additionalLanguages = [];
psState.phases = ['Reach', 'Action'];
psState.audiences = [];
psState.phaseChannels = {};
}

async function loadProjectConfig(projectId) {
var config = await api('/api/folders/' + projectId + '/config');
var project = state.folders.find(function(f) { return f.id === projectId; });

if (project) psState.name = project.name;
if (config.identity) {
  psState.company = config.identity.company || 'Unilever';
  psState.brand = config.identity.brand || '';
  psState.market = config.identity.market || '';
  psState.businessGroup = config.identity.businessGroup || '';
  psState.category = config.identity.category || '';
  psState.defaultLanguage = config.identity.defaultLanguage || 'English';
  psState.additionalLanguages = config.identity.additionalLanguages || [];
}
if (config.org) {
  psState.phases = config.org.phases || ['Reach', 'Action'];
  psState.audiences = config.org.audiences || [];
}
psState.phaseChannels = config.phaseChannels || {};
}

function renderPsStep() {
document.getElementById('ps-step-1').style.display = psState.step === 1 ? 'block' : 'none';
document.getElementById('ps-step-2').style.display = psState.step === 2 ? 'block' : 'none';
document.getElementById('ps-step-3').style.display = psState.step === 3 ? 'block' : 'none';

document.getElementById('ps-back-btn').style.display = psState.step > 1 ? 'block' : 'none';
document.getElementById('ps-next-btn').textContent = psState.step === 3 ? 'Save & Generate Folders' : 'Next →';

if (psState.step === 1) renderPsStep1();
if (psState.step === 2) renderPsStep2();
if (psState.step === 3) renderPsStep3();
}

function renderPsStep1() {
// Capture current values before re-rendering
if (document.getElementById('ps-name')) {
  psState.name = document.getElementById('ps-name').value || psState.name;
  psState.brand = document.getElementById('ps-brand').value || psState.brand;
  psState.market = document.getElementById('ps-market').value || psState.market;
  psState.businessGroup = document.getElementById('ps-bg').value || psState.businessGroup;
  psState.category = document.getElementById('ps-category').value || psState.category;
  psState.defaultLanguage = document.getElementById('ps-lang').value || psState.defaultLanguage;
}

document.getElementById('ps-name').value = psState.name;
document.getElementById('ps-brand').value = psState.brand;
document.getElementById('ps-market').value = psState.market;
document.getElementById('ps-bg').value = psState.businessGroup;
document.getElementById('ps-category').value = psState.category;
document.getElementById('ps-lang').value = psState.defaultLanguage;

document.getElementById('ps-company').innerHTML = ['Unilever', 'Competitor'].map(function(c) {
  return '<button class="pill' + (psState.company === c ? ' active' : '') + '" onclick="psState.company=\'' + c + '\';renderPsStep1()">' + c + '</button>';
}).join('');

var wrap = document.getElementById('ps-addlang-wrap');
wrap.querySelectorAll('.tag-pill').forEach(function(p) { p.remove(); });
var input = document.getElementById('ps-addlang-input');
psState.additionalLanguages.forEach(function(lang) {
  var pill = document.createElement('span');
  pill.className = 'tag-pill';
  pill.innerHTML = lang + '<span class="tag-pill-x" onclick="psRemoveAddLang(\'' + lang + '\')">×</span>';
  wrap.insertBefore(pill, input);
});
}

function psAddLangKey(e) {
if (e.key === 'Enter' || e.key === ',') {
  e.preventDefault();
  var val = document.getElementById('ps-addlang-input').value.trim().replace(',', '');
  if (val && psState.additionalLanguages.indexOf(val) === -1) {
    psState.additionalLanguages.push(val);
    document.getElementById('ps-addlang-input').value = '';
    renderPsStep1();
  }
}
if (e.key === 'Backspace' && !document.getElementById('ps-addlang-input').value && psState.additionalLanguages.length) {
  psState.additionalLanguages.pop();
  renderPsStep1();
}
}

function psRemoveAddLang(lang) {
psState.additionalLanguages = psState.additionalLanguages.filter(function(l) { return l !== lang; });
renderPsStep1();
}

function renderPsStep2() {
var commonPhases = ['Tease', 'Reach', 'Action'];
document.getElementById('ps-phases-pills').innerHTML = psState.phases.map(function(p) {
  return '<button class="pill active" onclick="psRemovePhase(\'' + p + '\')">' + p + ' ×</button>';
}).join('') + commonPhases.filter(function(p) { return psState.phases.indexOf(p) === -1; }).map(function(p) {
  return '<button class="pill" onclick="psAddPhase(\'' + p + '\')">' + p + '</button>';
}).join('');

var wrap = document.getElementById('ps-audience-wrap');
wrap.querySelectorAll('.tag-pill').forEach(function(p) { p.remove(); });
var input = document.getElementById('ps-audience-input');
psState.audiences.forEach(function(aud) {
  var pill = document.createElement('span');
  pill.className = 'tag-pill';
  pill.innerHTML = aud + '<span class="tag-pill-x" onclick="psRemoveAudience(\'' + aud + '\')">×</span>';
  wrap.insertBefore(pill, input);
});
}

function psAddPhase(phase) {
if (psState.phases.indexOf(phase) === -1) {
  psState.phases.push(phase);
  renderPsStep2();
}
}

function psRemovePhase(phase) {
psState.phases = psState.phases.filter(function(p) { return p !== phase; });
renderPsStep2();
}

function psAddPhaseKey(e) {
if (e.key === 'Enter') {
  e.preventDefault();
  var val = document.getElementById('ps-phase-input').value.trim();
  if (val) {
    psAddPhase(val);
    document.getElementById('ps-phase-input').value = '';
  }
}
}

function psAddAudienceKey(e) {
if (e.key === 'Enter' || e.key === ',') {
  e.preventDefault();
  var val = document.getElementById('ps-audience-input').value.trim().replace(',', '');
  if (val && psState.audiences.indexOf(val) === -1) {
    psState.audiences.push(val);
    document.getElementById('ps-audience-input').value = '';
    renderPsStep2();
  }
}
if (e.key === 'Backspace' && !document.getElementById('ps-audience-input').value && psState.audiences.length) {
  psState.audiences.pop();
  renderPsStep2();
}
}

function psRemoveAudience(aud) {
psState.audiences = psState.audiences.filter(function(a) { return a !== aud; });
renderPsStep2();
}

function renderPsStep3() {
var container = document.getElementById('ps-channels-container');
var html = '';

psState.phases.forEach(function(phase) {
  if (!psState.phaseChannels[phase]) {
    psState.phaseChannels[phase] = JSON.parse(JSON.stringify(DEFAULT_CHANNELS));
  }
  
  html += '<div style="margin-bottom:24px"><div class="tag-label" style="margin-bottom:10px">' + phase + ' Channels</div>';
  
  psState.phaseChannels[phase].forEach(function(ch, chIdx) {
    var chId = 'ch-' + phase + '-' + chIdx;
    var checked = ch.enabled !== false ? 'checked' : '';
    
    html += '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:8px;background:' + (ch.enabled !== false ? 'white' : '#f8fafc') + '">';
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:' + (ch.formats ? '8px' : '0') + '">';
    html += '<input type="checkbox" id="' + chId + '" ' + checked + ' onchange="psToggleChannel(\'' + phase + '\',' + chIdx + ',this.checked)" style="width:18px;height:18px;cursor:pointer">';
    html += '<label for="' + chId + '" style="font-size:13px;font-weight:600;cursor:pointer;flex:1">' + ch.name + '</label>';
    if (ch.test) html += '<span style="font-size:11px;color:#94a3b8">→ ' + ch.test + '</span>';
    if (ch.test === null) html += '<span style="font-size:11px;color:#94a3b8;font-style:italic">No test</span>';
    html += '</div>';
    
    if (ch.formats && ch.enabled !== false) {
      html += '<div style="margin-left:28px;display:flex;flex-direction:column;gap:4px">';
      ch.formats.forEach(function(fmt, fIdx) {
        var fId = 'fmt-' + phase + '-' + chIdx + '-' + fIdx;
        var fChecked = fmt.enabled !== false ? 'checked' : '';
        html += '<div style="display:flex;align-items:center;gap:8px">';
        html += '<input type="checkbox" id="' + fId + '" ' + fChecked + ' onchange="psToggleFormat(\'' + phase + '\',' + chIdx + ',' + fIdx + ',this.checked)" style="width:16px;height:16px;cursor:pointer">';
        html += '<label for="' + fId + '" style="font-size:12px;cursor:pointer;flex:1">' + fmt.name + '</label>';
        html += '<span style="font-size:10px;color:#94a3b8">→ ' + fmt.test + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }
    
    html += '</div>';
  });
  
  html += '</div>';
});

container.innerHTML = html;
}

function psToggleChannel(phase, chIdx, enabled) {
psState.phaseChannels[phase][chIdx].enabled = enabled;
renderPsStep3();
}

function psToggleFormat(phase, chIdx, fIdx, enabled) {
psState.phaseChannels[phase][chIdx].formats[fIdx].enabled = enabled;
renderPsStep3();
}

function psStepBack() {
if (psState.step > 1) {
  psState.step--;
  renderPsStep();
}
}

function psStepNext() {
if (psState.step === 1) {
  psState.name = document.getElementById('ps-name').value.trim();
  psState.brand = document.getElementById('ps-brand').value.trim();
  psState.market = document.getElementById('ps-market').value.trim();
  psState.businessGroup = document.getElementById('ps-bg').value.trim();
  psState.category = document.getElementById('ps-category').value.trim();
  psState.defaultLanguage = document.getElementById('ps-lang').value.trim();
  
  if (!psState.name || !psState.company || !psState.brand || !psState.market || !psState.defaultLanguage) {
    alert('Please fill in all required fields (marked with *)');
    return;
  }
  psState.step = 2;
  renderPsStep();
} else if (psState.step === 2) {
  if (psState.phases.length === 0) {
    alert('Please select at least one phase');
    return;
  }
  psState.step = 3;
  renderPsStep();
} else if (psState.step === 3) {
  saveProjectSetup();
}
}

async function saveProjectSetup() {
var config = {
  identity: {
    company: psState.company,
    brand: psState.brand,
    market: psState.market,
    businessGroup: psState.businessGroup,
    category: psState.category,
    defaultLanguage: psState.defaultLanguage,
    additionalLanguages: psState.additionalLanguages
  },
  org: {
    phases: psState.phases,
    audiences: psState.audiences
  },
  phaseChannels: psState.phaseChannels
};

var projectId = psState.editingProjectId;

if (!projectId) {
  var res = await api('/api/folders', {
    method: 'POST',
    body: JSON.stringify({name: psState.name, parent_id: null})
  });
  projectId = res.id;
} else {
  await api('/api/folders/' + projectId, {
    method: 'PUT',
    body: JSON.stringify({name: psState.name})
  });
}

await api('/api/folders/' + projectId + '/config', {
  method: 'PUT',
  body: JSON.stringify({config: config})
});

if (psState.editingProjectId) {
await loadFolders();
await cleanupRemovedManagedFolders(projectId, config);
}
await generateManagedFolders(projectId, config);

closeProjectSetup();
await loadFolders();
if (state.projectId) {
await loadAssets(state.folderId);
} else {
renderHome();
}
}

async function getOrCreateManagedFolder(name, parentId, extra) {
var existing = state.folders.find(function(f) {
return f.parent_id === parentId && f.name === name && f.is_managed;
});
if (existing) return existing.id;
var body = Object.assign({name: name, parent_id: parentId, is_managed: 1}, extra || {});
var res = await api('/api/folders', {method: 'POST', body: JSON.stringify(body)});
state.folders.push({id: res.id, name: name, parent_id: parentId, is_managed: 1});
return res.id;
}

async function generateManagedFolders(projectId, config) {
await loadFolders();
for (var i = 0; i < config.org.phases.length; i++) {
var phase = config.org.phases[i];
var channels = config.phaseChannels[phase] || [];
var phaseId = await getOrCreateManagedFolder(phase, projectId);
for (var j = 0; j < channels.length; j++) {
  var ch = channels[j];
  if (ch.enabled === false) continue;
  if (ch.formats) {
    var chId = await getOrCreateManagedFolder(ch.name, phaseId);
    for (var k = 0; k < ch.formats.length; k++) {
      var fmt = ch.formats[k];
      if (fmt.enabled === false) continue;
      await getOrCreateManagedFolder(fmt.name, chId, {brainsuite_test: fmt.test, cta: fmt.cta ? 1 : 0});
    }
  } else {
    await getOrCreateManagedFolder(ch.name, phaseId, {brainsuite_test: ch.test, cta: ch.cta ? 1 : 0});
  }
}
}
}

async function init(){await loadFolders();initPlayer();initSidebarResize();showHome();}

async function refreshAssetsData(){var url=state.folderId?"/api/assets?folder_id="+state.folderId:"/api/assets";state.assets=await api(url);}

async function cleanupRemovedManagedFolders(projectId, config) {
var toDelete = [];

var phaseFolders = state.folders.filter(function(f) {
  return f.parent_id === projectId && f.is_managed;
});

phaseFolders.forEach(function(phaseFolder) {
  if (config.org.phases.indexOf(phaseFolder.name) === -1) {
    toDelete.push(phaseFolder.id);
    return;
  }
  var channels = config.phaseChannels[phaseFolder.name] || [];
  var enabledChannels = channels.filter(function(ch) { return ch.enabled !== false; }).map(function(ch) { return ch.name; });

  state.folders.filter(function(f) { return f.parent_id === phaseFolder.id && f.is_managed; }).forEach(function(chFolder) {
    if (enabledChannels.indexOf(chFolder.name) === -1) {
      toDelete.push(chFolder.id);
      return;
    }
    var chConfig = channels.find(function(c) { return c.name === chFolder.name; });
    if (chConfig && chConfig.formats) {
      var enabledFormats = chConfig.formats.filter(function(f) { return f.enabled !== false; }).map(function(f) { return f.name; });
      state.folders.filter(function(f) { return f.parent_id === chFolder.id && f.is_managed; }).forEach(function(fmtFolder) {
        if (enabledFormats.indexOf(fmtFolder.name) === -1) toDelete.push(fmtFolder.id);
      });
    }
  });
});

if (!toDelete.length) return;

var totalAssets = 0;
for (var i = 0; i < toDelete.length; i++) {
  var data = await api('/api/folders/' + toDelete[i] + '/count');
  totalAssets += data.count || 0;
}

var msg = totalAssets > 0
  ? toDelete.length + ' folder' + (toDelete.length !== 1 ? 's' : '') + ' removed from brief.\n\n' + totalAssets + ' asset' + (totalAssets !== 1 ? 's' : '') + ' and all their files will be permanently deleted. This cannot be undone.'
  : toDelete.length + ' folder' + (toDelete.length !== 1 ? 's' : '') + ' removed from brief.';

if (!confirm(msg)) return;

for (var j = 0; j < toDelete.length; j++) {
  await api('/api/folders/' + toDelete[j], {method: 'DELETE'});
}
}

function editAssetTags(){
var asset=state.currentAsset.asset;var version=state.currentAsset.versions.find(function(v){return v.is_latest;})||state.currentAsset.versions[0];
tagState.assetId=asset.id;tagState.baseName=asset.base_name;tagState.projectId=state.projectId;
tagState.phase=asset.phase||null;tagState.platform=asset.platform||null;tagState.format=asset.format||null;tagState.isMaster=!!asset.is_master;
tagState.contentOrigin=asset.content_origin||'Brand';
tagState.language=asset.language||null;
try{tagState.audienceTags=JSON.parse(asset.audience_tags||'[]');}catch(e){tagState.audienceTags=[];}

// Load project config
api('/api/folders/' + state.projectId + '/config').then(function(config) {
  tagState.projectConfig = config;
  renderTagModal();
});

var vid=document.getElementById("tag-video");vid.src=version.id?"/api/media/"+version.id:"";vid.load();vid.play().catch(function(){});
document.getElementById("tag-display-name").value=asset.display_name||asset.base_name;
document.getElementById("tag-master").checked=!!asset.is_master;

document.getElementById("tag-modal").style.display="block";
}
function formatDuration(s){if(!s)return'';var m=Math.floor(s/60),sec=Math.floor(s%60);return m+':'+(sec<10?'0':'')+sec;}

function sortedByMaster(assets){
return assets.slice().sort(function(a,b){
  var am=a.is_master?1:0;
  var bm=b.is_master?1:0;
  return bm-am;
});
}

function hideSuggestions(){
// Empty stub - suggestions feature removed
}

var currentVersionId = null;
var currentComments = [];

function switchScoreTab(tab) {
document.getElementById('tab-scores').classList.toggle('active', tab==='scores');
document.getElementById('tab-comments').classList.toggle('active', tab==='comments');
document.getElementById('scores-panel').classList.toggle('active', tab==='scores');
document.getElementById('comments-panel').classList.toggle('active', tab==='comments');
}

async function loadComments(versionId) {
currentVersionId = versionId;
try { currentComments = await api('/api/versions/'+versionId+'/comments'); }
catch(e) { currentComments = []; }
renderComments();
updateCommentTab();
}

function updateCommentTab() {
var tab = document.getElementById('tab-comments');
if (tab) tab.textContent = currentComments.length ? 'Comments ('+currentComments.length+')' : 'Comments';
}

function renderComments() {
var list = document.getElementById('comment-list');
if (!list) return;
if (!currentComments.length) {
  list.innerHTML = '<div class="no-comments">No comments yet<br><span style="font-size:11px">Click the timeline to add one</span></div>';
  return;
}
list.innerHTML = currentComments.map(function(c) {
  return '<div class="comment-item" onclick="seekToComment('+c.timecode+')">' +
    '<span class="comment-ts">'+formatDuration(c.timecode)+'</span>' +
    '<div class="comment-body">' +
    '<div class="comment-text">'+escHtml(c.text)+'</div>' +
    '<div class="comment-date">'+new Date(c.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'</div>' +
    '</div>' +
    '<button class="comment-del" onclick="event.stopPropagation();deleteComment('+c.id+')">×</button>' +
    '</div>';
}).join('');
renderMarkers();
}

function seekToComment(timecode) {
var player = document.getElementById('video-player');
if (player) { player.currentTime = timecode; player.play(); }
}

async function sendComment() {
var input = document.getElementById('comment-input');
var text = input ? input.value.trim() : '';
if (!text || !currentVersionId) return;
var player = document.getElementById('video-player');
var timecode = player ? Math.floor(player.currentTime) : 0;
var res = await api('/api/versions/'+currentVersionId+'/comments', {
  method:'POST', body:JSON.stringify({text:text, timecode:timecode})
});
if (res && res.id) {
  currentComments.push(res);
  renderComments();
  updateCommentTab();
  input.value = '';
  var list = document.getElementById('comment-list');
  if (list) list.scrollTop = list.scrollHeight;
}
}

async function deleteComment(id) {
await api('/api/comments/'+id, {method:'DELETE'});
currentComments = currentComments.filter(function(c){ return c.id !== id; });
renderComments();
updateCommentTab();
}

function commentInputKey(e) {
if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); }
}

function copyComments() {
if (!currentComments.length) return;
var text = currentComments.map(function(c){ return formatDuration(c.timecode)+' — '+c.text; }).join('\n');
var btn = document.getElementById('comment-copy-btn');
function tick(){ if(btn){btn.textContent='✓ Copied';btn.classList.add('copied');setTimeout(function(){btn.textContent='📋 Copy all';btn.classList.remove('copied');},2000);} }
var ta = document.createElement('textarea');
ta.value = text;
ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px';
document.body.appendChild(ta);
try { ta.focus(); ta.select(); document.execCommand('copy'); tick(); } catch(e) {}
document.body.removeChild(ta);
}

function escHtml(str) {
return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

var playerScrubbing = false;
var scrubClickX = null;
var playIcon = '<svg width="12" height="14" viewBox="0 0 10 12" fill="currentColor"><polygon points="0,0 10,6 0,12"/></svg>';
var pauseIcon = '<svg width="12" height="14" viewBox="0 0 10 12" fill="currentColor"><rect x="0" y="0" width="3.5" height="12"/><rect x="6.5" y="0" width="3.5" height="12"/></svg>';
var muteIcon='<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>';
var muteOffIcon='<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
var fsIcon='<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
var fsExitIcon='<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>';
var dragGhostEl=null, dragGhostOffsetX=0, dragGhostOffsetY=0;

function initPlayer(){
var v=document.getElementById('video-player');
if(!v)return;
v.addEventListener('timeupdate',updatePlaybar);
v.addEventListener('play',function(){updatePlayBtn(true);});
v.addEventListener('pause',function(){updatePlayBtn(false);});
v.addEventListener('ended',function(){updatePlayBtn(false);});
v.addEventListener('loadedmetadata',function(){updatePlaybar();renderMarkers();});
v.addEventListener('volumechange',function(){
  var btn=document.getElementById('mute-btn');
  if(btn)btn.innerHTML=v.muted?muteOffIcon:muteIcon;
});
document.addEventListener('fullscreenchange',function(){
  var btn=document.getElementById('fs-btn');
  if(btn)btn.innerHTML=document.fullscreenElement?fsExitIcon:fsIcon;
});
document.addEventListener('webkitfullscreenchange',function(){
  var btn=document.getElementById('fs-btn');
  if(btn)btn.innerHTML=document.webkitFullscreenElement?fsExitIcon:fsIcon;
});
var wrap=document.getElementById('scrub-wrap');
if(wrap){var tip=document.createElement('div');tip.id='marker-tooltip';wrap.appendChild(tip);}
}

function togglePlay() {
var v = document.getElementById('video-player');
if (!v || !v.src) return;
if (v.paused) v.play(); else v.pause();
}

function updatePlayBtn(playing) {
var btn = document.getElementById('play-btn');
if (btn) btn.innerHTML = playing ? pauseIcon : playIcon;
}

function updatePlaybar() {
var v = document.getElementById('video-player');
if (!v || playerScrubbing) return;
var dur = v.duration && !isNaN(v.duration) ? v.duration : 0;
var pct = dur ? v.currentTime / dur * 100 : 0;
var fill = document.getElementById('scrub-fill');
var head = document.getElementById('scrub-head');
var time = document.getElementById('player-time');
if (fill) fill.style.width = pct + '%';
if (head) head.style.left = pct + '%';
if (time) time.textContent = formatDuration(Math.floor(v.currentTime||0)) + ' / ' + formatDuration(Math.floor(dur));
}

function scrubStart(e) {
e.preventDefault();
playerScrubbing = true;
scrubClickX = e.clientX;
scrubSeek(e);
document.addEventListener('mousemove', scrubMoveDoc);
document.addEventListener('mouseup', scrubEndDoc);
}

function scrubMoveDoc(e) {
if (!playerScrubbing) return;
scrubSeek(e);
}

function scrubEndDoc(e) {
var wasDrag = Math.abs(e.clientX - (scrubClickX||e.clientX)) > 5;
playerScrubbing = false;
scrubClickX = null;
document.removeEventListener('mousemove', scrubMoveDoc);
document.removeEventListener('mouseup', scrubEndDoc);
if (!wasDrag) {
  switchScoreTab('comments');
  var input = document.getElementById('comment-input');
  if (input) setTimeout(function(){ input.focus(); }, 50);
}
}

function scrubSeek(e) {
var v = document.getElementById('video-player');
var wrap = document.getElementById('scrub-wrap');
if (!v || !wrap || !v.duration || isNaN(v.duration)) return;
var rect = wrap.getBoundingClientRect();
var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
v.currentTime = pct * v.duration;
updatePlaybar();
}

function toggleMute(){
var v=document.getElementById('video-player');if(!v)return;
v.muted=!v.muted;
var btn=document.getElementById('mute-btn');
if(btn)btn.innerHTML=v.muted?muteOffIcon:muteIcon;
}

function toggleFullscreen(){
var el=document.querySelector('.vcol');if(!el)return;
if(!document.fullscreenElement&&!document.webkitFullscreenElement){
  (el.requestFullscreen||el.webkitRequestFullscreen).call(el);
} else {
  (document.exitFullscreen||document.webkitExitFullscreen).call(document);
}
}

function showMarkerTooltip(el,comment){
var tip=document.getElementById('marker-tooltip');if(!tip)return;
tip.innerHTML='<div class="mt-time">'+formatDuration(Math.floor(comment.timecode))+'</div>'+escHtml(comment.text);
tip.style.left='0px';tip.style.display='block';
var wrap=document.getElementById('scrub-wrap');if(!wrap)return;
var mr=el.getBoundingClientRect(),wr=wrap.getBoundingClientRect(),tw=tip.getBoundingClientRect().width;
var left=mr.left-wr.left+mr.width/2;
tip.style.left=Math.max(tw/2,Math.min(left,wr.width-tw/2))+'px';
}

function hideMarkerTooltip(){
var t=document.getElementById('marker-tooltip');if(t)t.style.display='none';
}

function renderMarkers(){
var container=document.getElementById('marker-container');
if(!container)return;
var v=document.getElementById('video-player');
var dur=v&&v.duration&&!isNaN(v.duration)?v.duration:0;
if(!dur||!currentComments.length){container.innerHTML='';return;}
container.innerHTML=currentComments.map(function(c){
  var pct=Math.max(0,Math.min(100,c.timecode/dur*100));
  return '<div class="player-marker" style="left:'+pct+'%" onmousedown="event.stopPropagation()" onclick="event.stopPropagation();seekToComment('+c.timecode+')"></div>';
}).join('');
container.querySelectorAll('.player-marker').forEach(function(el,i){
  var comment=currentComments[i];
  el.addEventListener('mouseenter',function(){showMarkerTooltip(el,comment);});
  el.addEventListener('mouseleave',hideMarkerTooltip);
});
}

function statusLabel(s) {
return {unreviewed:'Unreviewed',needs_attention:'Needs Attention',reviewed:'Reviewed',approved:'Approved'}[s]||'Unreviewed';
}

function renderStatusPicker(assetId, currentStatus) {
var wrap = document.getElementById('status-picker-wrap');
if (!wrap) return;
var st = currentStatus || 'unreviewed';
var statuses = ['unreviewed','needs_attention','reviewed','approved'];
wrap.innerHTML = '<div class="status-picker">' + statuses.map(function(s) {
  return '<button class="status-opt'+(st===s?' active-'+s:'')+'" onclick="setReviewStatus('+assetId+',\''+s+'\')">'+statusLabel(s)+'</button>';
}).join('') + '</div>';
}

async function setReviewStatus(assetId, status) {
await api('/api/assets/'+assetId+'/status', {method:'PUT', body:JSON.stringify({status:status})});
var a = state.assets.find(function(x){ return x.id===assetId; });
if (a) a.review_status = status;
if (state.currentAsset && state.currentAsset.asset.id===assetId) state.currentAsset.asset.review_status = status;
var btn=document.getElementById('status-select-btn');
if(btn){btn.className='rstatus rstatus-'+status;btn.innerHTML=statusLabel(status)+' ▾';}
var dd=document.getElementById('status-dropdown');if(dd)dd.style.display='none';
if(state.folderId===state.projectId) renderOverview(); else renderGrid();
}

function toggleStatusDropdown(e) {
e.stopPropagation();
var dd=document.getElementById('status-dropdown');
if(dd) dd.style.display=dd.style.display==='none'?'block':'none';
}

var sidebarResizing=false,sidebarStartX=0,sidebarStartW=0;

function initSidebarResize(){
var handle=document.getElementById('sidebar-resizer');
if(!handle)return;
handle.addEventListener('mousedown',function(e){
  sidebarResizing=true;
  sidebarStartX=e.clientX;
  sidebarStartW=document.querySelector('.sidebar').offsetWidth;
  handle.classList.add('dragging');
  document.addEventListener('mousemove',sidebarResizeMove);
  document.addEventListener('mouseup',sidebarResizeEnd);
  e.preventDefault();
});
}

function sidebarResizeMove(e){
if(!sidebarResizing)return;
var w=Math.max(160,Math.min(420,sidebarStartW+(e.clientX-sidebarStartX)));
document.querySelector('.sidebar').style.width=w+'px';
}

function sidebarResizeEnd(){
sidebarResizing=false;
var handle=document.getElementById('sidebar-resizer');
if(handle)handle.classList.remove('dragging');
document.removeEventListener('mousemove',sidebarResizeMove);
document.removeEventListener('mouseup',sidebarResizeEnd);
}

function toggleOvDropdown(id,e){
e.stopPropagation();
var dd=document.getElementById(id);
if(!dd)return;
['score-filter-dd','status-filter-dd'].forEach(function(did){
  var el=document.getElementById(did);
  if(el&&did!==id)el.style.display='none';
});
dd.style.display=dd.style.display==='none'?'block':'none';
}
function setScoreFilter(v){state.scoreFilter=v;var dd=document.getElementById('score-filter-dd');if(dd)dd.style.display='none';renderOverview();}
function setStatusFilter(v){state.statusFilter=v;var dd=document.getElementById('status-filter-dd');if(dd)dd.style.display='none';renderOverview();}
function toggleCommentsFilter(){state.commentsOnly=!state.commentsOnly;renderOverview();}

init();