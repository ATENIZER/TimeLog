/* Pointeuse — Médiathèque de l'association
   Historique centralisé de tous les fichiers :
   - dépôts directs   : orgs/{org}/media/{id} + chunks/{n}
   - fichiers projets : orgs/{org}/projects/{pid}/files/{id} + chunks/{n}
   - pièces jointes   : orgs/{org}/channels/{cid}/messages (att.file) — canaux publics seulement, pas les messages directs
   Chargé après app.js, qui expose window.PT. Après une modification, changez le ?v=… dans index.html. */
(function(){
const $=id=>document.getElementById(id);
const P=()=>window.PT;
const ICO={
  image:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 15.5l-5-5-9 9"/></svg>',
  video:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>',
  audio:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5M8.5 13h7M8.5 16.5h5"/></svg>',
  other:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17a1.7 1.7 0 0 1-2.4-2.4l7.5-7.5"/></svg>',
  dl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></svg>',
  go:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4.5h5.5V10M19.5 4.5L11 13M17 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1H10"/></svg>',
  del:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/></svg>'
};

let direct=[],others=[],lastLoad=0,loadedFor=null,loading=false,unsub=null,uploading=0,armedDel=null;
const filt={kind:"all",src:"all",q:""};
const urls=new Map(),urlLoads=new Map();

/* ---------- Classement ---------- */
function kindOf(mime,name,attKind){
  if(attKind==="image"||attKind==="gif") return "image";
  if(attKind==="video") return "video";
  if(attKind==="audio"||attKind==="voice") return "audio";
  const m=String(mime||""),n=String(name||"").toLowerCase();
  if(/^image\//.test(m)) return "image";
  if(/^video\//.test(m)) return "video";
  if(/^audio\//.test(m)) return "audio";
  if(/^text\//.test(m)||/pdf|word|excel|spreadsheet|presentation|powerpoint|opendocument|rtf|csv/.test(m)||/\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|txt|csv|rtf|md)$/.test(n)) return "doc";
  return "other";
}
const viewable=it=>/^(image\/|video\/|audio\/|text\/|application\/pdf)/.test(it.mime||"");

/* ---------- Chargement ---------- */
const orgRef=()=>P().db().collection("orgs").doc(P().org());
function watchDirect(){
  if(unsub) unsub();
  unsub=orgRef().collection("media").onSnapshot(sn=>{
    direct=sn.docs.map(d=>{const x=d.data();return {key:"m:"+d.id,src:"media",id:d.id,name:x.name||"",size:x.size||0,mime:x.type||"",kind:kindOf(x.type,x.name),by:x.by,byName:x.byName||"",at:x.at||0,chunks:x.chunks||1,srcName:tx("Dépôt direct")};});
    if(P().active()) draw();
  },e=>console.warn("médiathèque",e));
}
async function loadOthers(){
  if(loading) return;loading=true;lastLoad=Date.now();draw();
  const out=[],T=P();
  // Fichiers des projets visibles (tous pour un administrateur, sinon ceux dont on est membre)
  const projs=T.projects()||{};
  await Promise.all(Object.keys(projs).map(pid=>orgRef().collection("projects").doc(pid).collection("files").get().then(sn=>sn.docs.forEach(d=>{
    const x=d.data();
    out.push({key:"p:"+pid+":"+d.id,src:"project",srcId:pid,id:d.id,name:x.name||"",size:x.size||0,mime:x.type||"",kind:kindOf(x.type,x.name),by:x.by,byName:x.byName||"",at:x.at||0,chunks:x.chunks||1,srcName:tx("Projet « {} »",projs[pid].name||tx("Sans nom"))});
  })).catch(e=>console.warn("fichiers du projet",pid,e))));
  // Pièces jointes des canaux publics (les messages vocaux sont exclus)
  const ch=T.chans()||{};
  await Promise.all(Object.keys(ch).filter(cid=>ch[cid].kind==="channel").map(cid=>orgRef().collection("channels").doc(cid).collection("messages").where("att.file","==",true).limit(300).get().then(sn=>sn.docs.forEach(d=>{
    const x=d.data(),a=x.att||{};if(a.kind==="voice") return;
    out.push({key:"c:"+cid+":"+d.id,src:"channel",srcId:cid,id:d.id,att:a,name:a.name||(a.kind==="image"?tx("Image"):a.kind==="video"?tx("Vidéo"):tx("Fichier")),size:a.size||0,mime:a.mime||"",kind:kindOf(a.mime,a.name,a.kind),by:x.by,byName:x.byName||"",at:x.at||0,srcName:"#"+(ch[cid].name||cid)});
  })).catch(e=>console.warn("pièces jointes",cid,e))));
  others=out;loading=false;draw();
}
function ensureLoaded(force){
  const T=P();if(!T||!T.ready()) return false;
  const org=T.org();
  if(loadedFor!==org){loadedFor=org;direct=[];others=[];watchDirect();force=true;}
  if(force&&loading) return true;
  if(force) loadOthers();
  return true;
}

/* ---------- Contenu binaire ---------- */
async function readChunks(ref,n){
  const ss=await Promise.all(Array.from({length:Math.max(1,Math.min(6,n||1))},(_,i)=>ref.collection("chunks").doc(String(i)).get()));
  return ss.map(s=>{if(!s.exists) throw new Error("absent");return s.data().data.toUint8Array();});
}
function urlOf(it){
  if(urls.has(it.key)) return Promise.resolve(urls.get(it.key));
  if(urlLoads.has(it.key)) return urlLoads.get(it.key);
  let p;
  if(it.src==="channel") p=P().msgFileUrl(it.srcId,it.id,it.att);
  else{
    const ref=it.src==="media"?orgRef().collection("media").doc(it.id):orgRef().collection("projects").doc(it.srcId).collection("files").doc(it.id);
    p=readChunks(ref,it.chunks).then(parts=>URL.createObjectURL(new Blob(parts,{type:it.mime||"application/octet-stream"})));
  }
  p=p.then(u=>{urls.set(it.key,u);urlLoads.delete(it.key);return u;},e=>{urlLoads.delete(it.key);throw e;});
  urlLoads.set(it.key,p);return p;
}
async function openItem(it,download){
  const w=!download&&viewable(it)?window.open("","_blank"):null;
  try{
    const u=await urlOf(it);
    if(w){w.location.href=u;return;}
    const a=document.createElement("a");a.href=u;a.download=it.name||"fichier";document.body.appendChild(a);a.click();a.remove();
  }catch(e){if(w)w.close();P().toast(tx("Impossible d'ouvrir ce fichier"));}
}

/* ---------- Dépôt ---------- */
async function uploadFiles(list){
  const T=P();if(!T||!T.ready()||!list||!list.length) return;
  const files=[...list],tooBig=files.filter(f=>f.size>T.maxSize),ok=files.filter(f=>f.size<=T.maxSize&&f.size>0);
  if(tooBig.length) T.toast(tx("{} fichier(s) ignoré(s) : 5 Mo maximum",tooBig.length),3500);
  if(!ok.length) return;
  uploading+=ok.length;draw();
  let done=0;
  for(const f of ok){
    try{
      const buf=new Uint8Array(await f.arrayBuffer()),n=Math.max(1,Math.ceil(buf.length/T.CHUNK));
      const ref=orgRef().collection("media").doc(),b=T.db().batch();
      b.set(ref,{name:String(f.name).slice(0,160),size:f.size,type:f.type||"",by:T.me(),byName:T.name(T.me()),at:Date.now(),chunks:n});
      for(let i=0;i<n;i++) b.set(ref.collection("chunks").doc(String(i)),{data:firebase.firestore.Blob.fromUint8Array(buf.subarray(i*T.CHUNK,(i+1)*T.CHUNK))});
      await b.commit();done++;
    }catch(e){
      console.warn("dépôt",e);
      T.toast(e&&e.code==="permission-denied"?tx("Dépôt refusé. Publiez les nouvelles règles Firestore."):e&&e.code==="resource-exhausted"?tx("La limite gratuite du jour est atteinte. Réessayez demain."):tx("L'envoi de « {} » a échoué.",f.name),3500);
    }
    uploading--;draw();
  }
  if(done) T.toast(tx("{} fichier(s) ajouté(s) à la médiathèque",done));
}
async function deleteItem(it){
  const ref=orgRef().collection("media").doc(it.id),b=P().db().batch();
  for(let i=0;i<(it.chunks||1);i++) b.delete(ref.collection("chunks").doc(String(i)));
  b.delete(ref);await b.commit();
  const u=urls.get(it.key);if(u){URL.revokeObjectURL(u);urls.delete(it.key);}
}

/* ---------- Affichage ---------- */
let io=null;
function lazyThumb(el){
  if(!io) io=new IntersectionObserver(es=>es.forEach(e=>{
    if(!e.isIntersecting) return;io.unobserve(e.target);
    const it=byKey(e.target.dataset.thumb);if(!it) return;
    urlOf(it).then(u=>{if(e.target.isConnected)e.target.innerHTML=`<img src="${P().esc(u)}" alt="" loading="lazy">`;}).catch(()=>{});
  }),{rootMargin:"300px 0px"});
  io.observe(el);
}
const all=()=>direct.concat(others).sort((a,b)=>(b.at||0)-(a.at||0));
const byKey=k=>all().find(x=>x.key===k);
function visible(){
  const q=filt.q.trim().toLowerCase();
  return all().filter(it=>(filt.kind==="all"||it.kind===filt.kind)&&(filt.src==="all"||it.src===filt.src)
    &&(!q||(it.name+" "+it.byName+" "+it.srcName).toLowerCase().includes(q)));
}
function card(it,T){
  const esc=T.esc,canDel=it.src==="media"&&(it.by===T.me()||T.admin());
  const d=new Date(it.at||0),date=d.toLocaleDateString(LOC(),{day:"numeric",month:"short"})+" · "+d.toLocaleTimeString(LOC(),{hour:"2-digit",minute:"2-digit"});
  const thumb=it.kind==="image"?`<span class="md-ico" data-thumb="${esc(it.key)}">${ICO.image}</span>`:`<span class="md-ico">${ICO[it.kind]}</span>`;
  return `<article class="md-card k-${it.kind}">
    <button class="md-thumb" data-open="${esc(it.key)}" title="${esc(tx("Ouvrir"))}">${thumb}</button>
    <div class="md-info">
      <b class="md-name" translate="no" title="${esc(it.name)}">${esc(it.name)}</b>
      <small>${esc(it.size?T.fmtSize(it.size):"")}${it.size?" · ":""}${esc(date)}</small>
      <small class="md-meta"><span translate="no">${esc(it.byName||T.name(it.by))}</span> · <span class="md-src s-${it.src}">${esc(it.srcName)}</span></small>
    </div>
    <div class="md-acts">
      ${it.src!=="media"?`<button class="md-b" data-go="${esc(it.key)}" title="${esc(tx("Voir la source"))}" aria-label="${esc(tx("Voir la source"))}">${ICO.go}</button>`:""}
      <button class="md-b" data-dl="${esc(it.key)}" title="${esc(tx("Télécharger"))}" aria-label="${esc(tx("Télécharger"))}">${ICO.dl}</button>
      ${canDel?`<button class="md-b md-del${armedDel===it.key?" armed":""}" data-del="${esc(it.key)}" title="${esc(tx("Supprimer"))}" aria-label="${esc(tx("Supprimer"))}">${armedDel===it.key?esc(tx("Confirmer")):ICO.del}</button>`:""}
    </div>
  </article>`;
}
function draw(){
  const T=P(),list=$("mdList");if(!list||!T) return;
  $("mdUpload").disabled=!T.ready()||uploading>0;
  $("mdUpload").textContent=uploading?tx("Envoi en cours… ({})",uploading):tx("Déposer des fichiers");
  if(!T.ready()){list.innerHTML=`<div class="empty">${T.esc(tx("La médiathèque est disponible une fois connecté à une association."))}</div>`;$("mdStats").textContent="";return;}
  const v=visible(),total=v.reduce((s,x)=>s+(x.size||0),0);
  $("mdStats").textContent=(loading?tx("Chargement de l'historique…")+" · ":"")+tx("{} fichier(s)",v.length)+(total?" · "+T.fmtSize(total):"");
  if(!v.length){list.innerHTML=`<div class="empty">${T.esc(loading?tx("Chargement de l'historique…"):all().length?tx("Aucun fichier ne correspond à ces filtres."):tx("Aucun fichier pour l'instant. Déposez-en un ou glissez-le ici."))}</div>`;return;}
  // Regroupement par mois : l'historique se lit du plus récent au plus ancien
  let html="",cur="";
  v.forEach(it=>{
    const m=new Date(it.at||0).toLocaleDateString(LOC(),{month:"long",year:"numeric"});
    if(m!==cur){html+=(cur?"</div>":"")+`<h3 class="md-month">${T.esc(m.charAt(0).toUpperCase()+m.slice(1))}</h3><div class="md-grid">`;cur=m;}
    html+=card(it,T);
  });
  list.innerHTML=html+"</div>";
  list.querySelectorAll("[data-thumb]").forEach(lazyThumb);
}

/* ---------- Événements ---------- */
function bind(){
  $("mdUpload").onclick=()=>$("mdFile").click();
  $("mdFile").onchange=e=>{uploadFiles(e.target.files);e.target.value="";};
  $("mdRefresh").onclick=()=>{if(ensureLoaded(true))P().toast(tx("Historique actualisé"));};
  $("mdSearch").oninput=e=>{filt.q=e.target.value;draw();};
  $("mdSrc").onchange=e=>{filt.src=e.target.value;draw();};
  document.querySelectorAll("#mdKind button").forEach(b=>b.onclick=()=>{
    filt.kind=b.dataset.v;document.querySelectorAll("#mdKind button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));draw();
  });
  const list=$("mdList");
  list.addEventListener("click",e=>{
    const t=e.target.closest("button");if(!t) return;
    const it=byKey(t.dataset.open||t.dataset.dl||t.dataset.go||t.dataset.del||"");if(!it) return;
    if(t.dataset.open) openItem(it,false);
    else if(t.dataset.dl) openItem(it,true);
    else if(t.dataset.go){if(it.src==="project")P().goProject(it.srcId);else P().goChannel(it.srcId);}
    else if(t.dataset.del){
      if(armedDel!==it.key){armedDel=it.key;draw();clearTimeout(bind._t);bind._t=setTimeout(()=>{armedDel=null;draw();},3500);return;}
      armedDel=null;deleteItem(it).then(()=>P().toast(tx("Fichier retiré"))).catch(()=>P().toast(tx("Suppression refusée")));
    }
  });
  // Glisser-déposer directement sur la liste
  ["dragenter","dragover"].forEach(ev=>list.addEventListener(ev,e=>{if(!P().ready()||!e.dataTransfer||![...e.dataTransfer.types].includes("Files"))return;e.preventDefault();list.classList.add("over");}));
  ["dragleave","drop"].forEach(ev=>list.addEventListener(ev,e=>{if(ev==="dragleave"&&list.contains(e.relatedTarget))return;list.classList.remove("over");}));
  list.addEventListener("drop",e=>{if(!e.dataTransfer||!e.dataTransfer.files.length)return;e.preventDefault();uploadFiles(e.dataTransfer.files);});
}
bind();

window.MediaLib={
  // Appelé par render() quand l'onglet Médiathèque est affiché
  // Projets et canaux sont relus au plus toutes les 2 minutes ; les dépôts directs sont en direct.
  render(){ensureLoaded(Date.now()-lastLoad>120000);draw();}
};
})();
