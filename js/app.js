/* Pointeuse — code de l'application
   Chargé par index.html. Après une modification, changez le ?v=… dans index.html pour forcer la mise à jour. */
(function(){
const COLORS=["#F2A33A","#4F7CFF","#2FB7A0","#E4572E","#8B5CF6","#3AA0D8","#B7791F","#D6457F"];
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const DEFAULT={
  types:[
    {id:"t_travail",name:"Travail",color:COLORS[0],archived:false},
    {id:"t_reunion",name:"Réunions",color:COLORS[1],archived:false},
    {id:"t_formation",name:"Formation",color:COLORS[3],archived:false},
    {id:"t_admin",name:"Administratif",color:COLORS[4],archived:false}
  ],
  sessions:[], active:null
};
let state=JSON.parse(JSON.stringify(DEFAULT)); // mes données
let selectedType=state.types[0].id;
let period="week", teamPeriod="week";
let journalLimit=14;
let backend=null;
let pendingDelete=null;
let myId=null;
let team={};          // id -> données de chaque personne (admin)
let mode="mine";      // mine | team | roles | person
const DEFAULT_ROLES={defaultRoleId:"r_employe",roles:[
  {id:"r_president",name:"Président",level:"admin",locked:true},
  {id:"r_vp",name:"Vice-président",level:"admin",locked:true},
  {id:"r_employe",name:"Membre",level:"standard",canManual:true,canDelete:false,canManageTypes:true}
]};
let org=JSON.parse(JSON.stringify(DEFAULT_ROLES));
let assignments={};   // id personne -> id rôle
let fdb=null, auth=null, ownerUid=null, teamSub=null, pendingName="";
let myProfile={displayName:"",email:"",photoURL:""};
const isOwnerNow=()=>!!myId&&ownerUid===myId;
const roleById=id=>org.roles.find(r=>r.id===id);
/* Valeur du bénévolat : taux du rôle, sinon taux de l'association */
const rateOf=pid=>{const r=roleOf(pid);const x=r&&Number(r.rate);return x>0?x:(Number(org.hourlyValue)||0);};
const fmtMoney=x=>{try{return new Intl.NumberFormat(LOC(),{style:"currency",currency:"CAD"}).format(x);}catch(e){return x.toFixed(2)+" $";}};
const moneyOf=(ms,pid)=>ms/3600000*rateOf(pid);
const roleOf=pid=>roleById(assignments[pid])||roleById(org.defaultRoleId)||org.roles.find(r=>r.level==="standard")||org.roles[0];
const adminUI=()=>!!curOrg&&(isOwnerNow()||(!!assignments[myId]&&roleOf(myId)?.level==="admin"));
function perms(){
  if(adminUI()) return {canManual:true,canDelete:true,canManageTypes:true};
  const r=roleOf(myId)||{};
  if(r.level==="admin") return {canManual:true,canDelete:true,canManageTypes:true};
  return {canManual:!!r.canManual,canDelete:!!r.canDelete,canManageTypes:!!r.canManageTypes};
}
let viewingId=null;

const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const fmtDur=ms=>{ms=Math.max(0,ms);if(state&&state.prefs&&state.prefs.dur==="dec")return (ms/3600000).toFixed(2).replace(".",DEC())+" h";const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000);return LANG==="fr"?h+" h "+pad(m):h+"h "+pad(m);};
const fmtClock=ms=>{ms=Math.max(0,ms);const s=Math.floor(ms/1000);return pad(Math.floor(s/3600))+":"+pad(Math.floor(s%3600/60))+":"+pad(s%60);};
const fmtTime=t=>{const d=new Date(t);return pad(d.getHours())+":"+pad(d.getMinutes());};
const dayKey=t=>{const d=new Date(t);return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());};
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const dayLabel=t=>cap(new Date(t).toLocaleDateString(LOC(),{weekday:"long",day:"numeric",month:"long"}));
const typeIn=(data,id)=>data.types.find(t=>t.id===id)||{name:"Type supprimé",color:"#888"};
const view=()=>mode==="person"&&viewingId!==myId?(team[viewingId]||{types:[],sessions:[],active:null}):state;
const readOnly=()=>mode==="person"&&viewingId!==myId;
let valid={};         // id personne -> {entries, rejected} (copie officielle, écrite seulement par les administrateurs)
let validSub=false;
const getValid=pid=>valid[pid]||{entries:{},rejected:{}};
const curPid=()=>mode==="person"?viewingId:myId;
function statusOf(pid,s){
  if(s.live) return null;
  const v=getValid(pid);const e=v.entries[s.id];
  if(e) return (e.start===s.start&&e.end===s.end&&e.typeId===s.typeId)?"ok":"changed";
  const r=v.rejected[s.id];
  if(r&&r.start===s.start&&r.end===s.end) return "rejected";
  return "pending";
}
const ST_LABEL={ok:"Validée",changed:"Modifiée après validation",rejected:"Refusée",pending:"En attente"};
function pendingCount(pid,d){return d.sessions.filter(s=>{const st=statusOf(pid,s);return st==="pending"||st==="changed";}).length;}
function writeValid(pid,mutate){
  const v=JSON.parse(JSON.stringify(getValid(pid)));mutate(v);valid[pid]=v;render();
  if(!fdb) return;
  L.val(pid).set(v).catch(()=>toast("Validation refusée : accès administrateur requis"));
}
function validateSessions(pid,d,list){
  writeValid(pid,v=>list.forEach(s=>{v.entries[s.id]={typeId:s.typeId,typeName:typeIn(d,s.typeId).name,start:s.start,end:s.end,note:s.note||"",by:myId,byName:nameOf(myId),at:Date.now()};delete v.rejected[s.id];}));
}
const profileOf=id=>id===myId?myProfile:(team[id]||{});
const nameOf=id=>{const p=profileOf(id);return p.displayName||p.email||(id===myId?"Moi":"Personne sans nom");};
function toast(msg,ms){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove("show"),ms||2200);}

/* ---------- Persistance (Firebase) ---------- */
let saveTimer=null;
function persist(){
  if(!backend) return;
  setSync("Enregistrement…");
  clearTimeout(saveTimer);
  saveTimer=setTimeout(async()=>{
    try{await backend.save(state);setSync("Enregistré");}
    catch(e){setSync("Échec de l'enregistrement. Vérifiez votre connexion.");}
  },400);
}
// L'état d'enregistrement n'est affiché qu'en cas de problème ;
// après plus d'une minute d'inactivité, une petite notice discrète confirme que tout est enregistré.
let syncState="ok",lastAct=Date.now(),noteShown=false;
function setSync(t){
  const bad=/échec|erreur|indisponible|seulement|refus/i.test(t||"");
  syncState=bad?"bad":(/enregistrement…/i.test(t||"")?"saving":"ok");
  const el=$("sync");el.textContent=bad?t:"";el.classList.toggle("bad",bad);
}
["pointerdown","keydown","wheel","touchstart"].forEach(ev=>addEventListener(ev,()=>{lastAct=Date.now();noteShown=false;},{passive:true}));
setInterval(()=>{
  if(noteShown||syncState!=="ok"||!myId||!curOrg||Date.now()-lastAct<60000) return;
  noteShown=true;const n=$("saveNote");n.textContent="✓ Tout est enregistré";n.classList.add("show");
  setTimeout(()=>n.classList.remove("show"),4000);
},10000);
function sanitize(o){
  if(!o||!Array.isArray(o.types)||!Array.isArray(o.sessions)) return null;
  return {types:o.types.filter(t=>t&&t.id&&t.name),sessions:o.sessions.filter(s=>s&&s.start&&s.end),active:o.active&&o.active.start?o.active:null,prefs:o.prefs&&typeof o.prefs==="object"?o.prefs:{}};
}
function showOnly(id){["authView","configView","app"].forEach(v=>$(v).hidden=v!==id);}
function initFirebase(){
  if(DEMO){startDemo();return;}
  const cfg=window.FIREBASE_CONFIG;
  if(!window.firebase||!cfg||!cfg.apiKey||/COLLEZ|VOTRE/i.test(cfg.apiKey)){showOnly("configView");return;}
  firebase.initializeApp(cfg);
  auth=firebase.auth();fdb=firebase.firestore();
  // Cache local : affichage quasi instantané aux visites suivantes et tolérance aux coupures réseau.
  try{if(fdb.enablePersistence)fdb.enablePersistence({synchronizeTabs:true}).catch(()=>{});}catch(e){}
  auth.onAuthStateChanged(u=>{if(u) startSession(u).catch(err=>{console.error(err);setSync("Erreur de chargement : "+(err.code||err.message));});else showOnly("authView");});
}
/* ---------- Associations : données (Firebase) ---------- */
let curOrg=null,myOrgIds=[],orgsInfo={},members={},orgCode="";
const ORG_KEY="pointeuse-org";
const L={
  idx:()=>fdb.collection("userOrgs").doc(myId),
  me:()=>fdb.collection("orgs").doc(curOrg).collection("people").doc(myId),
  person:u=>fdb.collection("orgs").doc(curOrg).collection("people").doc(u),
  val:u=>fdb.collection("orgs").doc(curOrg).collection("validations").doc(u),
  org:o=>fdb.collection("orgs").doc(o),
  members:o=>fdb.collection("orgs").doc(o).collection("members"),
  code:c=>fdb.collection("codes").doc(c)
};
function lsGetOrg(){try{return localStorage.getItem(ORG_KEY);}catch(e){return null;}}
function switchOrg(id){try{if(id)localStorage.setItem(ORG_KEY,id);else localStorage.removeItem(ORG_KEY);}catch(e){}location.reload();}
function genCode(){const A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";const r=crypto.getRandomValues(new Uint8Array(8));return [...r].map(x=>A[x%A.length]).join("");}
const normCode=c=>String(c||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
const fmtCode=c=>c?c.slice(0,4)+"-"+c.slice(4):"";

async function startSession(u){
  myId=u.uid;showOnly("app");
  myProfile={displayName:pendingName||u.displayName||"",email:u.email||"",photoURL:u.photoURL||""};
  render();
  try{
    const ix=await withRetry(()=>L.idx().get());
    if(ix.exists){const d=ix.data();myOrgIds=Array.isArray(d.orgIds)?d.orgIds.slice():[];if(d.displayName&&!pendingName)myProfile.displayName=d.displayName;}
    await loadOrgList();
  }catch(e){console.error(e);bootFail();return;}
  pendingName="";
  saveIndex().catch(()=>{});
  const saved=lsGetOrg();
  curOrg=myOrgIds.includes(saved)?saved:(myOrgIds[0]||null);
  orgsLoaded=true;
  if(!curOrg){setSync("");render();bootDone();return;}
  try{await openOrg();bootDone();}catch(e){console.error(e);bootFail();}
}
function saveIndex(){return L.idx().set({orgIds:myOrgIds,displayName:myProfile.displayName||"",email:myProfile.email||""});}
async function loadOrgList(){
  const out={};
  await Promise.all(myOrgIds.map(async id=>{
    try{
      const o=await withRetry(()=>L.org(id).get());if(!o.exists)return;const d=o.data();
      const m=await withRetry(()=>L.members(id).doc(myId).get());if(!m.exists)return;
      const r=(d.roles||[]).find(x=>x.id===m.data().roleId);
      out[id]={id,name:d.name||"Association",role:d.ownerUid===myId?"Propriétaire":(r&&r.level==="admin"?r.name:"Membre"),owner:d.ownerUid===myId,admin:d.ownerUid===myId||(!!r&&r.level==="admin"),banner:d.banner||null,code:d.code||""};
    }catch(e){}
  }));
  orgsInfo=out;
  const ok=myOrgIds.filter(id=>out[id]);
  if(ok.length!==myOrgIds.length){myOrgIds=ok;saveIndex().catch(()=>{});}
}
async function openOrg(){
  const ref=L.me();const snap=await withRetry(()=>ref.get());
  if(snap.exists){const r=sanitize(snap.data());if(r)state=r;}else state=JSON.parse(JSON.stringify(DEFAULT));
  backend={save:o=>ref.set(Object.assign(JSON.parse(JSON.stringify(o)),{updatedAt:Date.now(),displayName:myProfile.displayName,email:myProfile.email,photoURL:myProfile.photoURL}))};
  if(!snap.exists||snap.data().displayName!==myProfile.displayName) persist();
  applyDefaultType();if(!state.types.some(t=>t.id===selectedType&&!t.archived)){const f=state.types.find(t=>!t.archived);selectedType=f?f.id:null;}
  setSync("Enregistré");
  L.val(myId).onSnapshot(sn=>{if(validSub)return;const v=sn.exists?sn.data():{};valid[myId]={entries:v.entries||{},rejected:v.rejected||{}};render();},()=>{});
  L.org(curOrg).onSnapshot(sn=>{
    if(!sn.exists) return;const v=sn.data();
    ownerUid=v.ownerUid||null;orgCode=v.code||"";
    org={defaultRoleId:v.defaultRoleId||"r_employe",roles:JSON.parse(JSON.stringify(v.roles&&v.roles.length?v.roles:DEFAULT_ROLES.roles)),orgName:v.name||"",hourlyValue:Number(v.hourlyValue)||0};
    if(orgsInfo[curOrg]) Object.assign(orgsInfo[curOrg],{name:org.orgName,banner:v.banner||null,code:v.code||""});
    applyOrgTypes(v.activityTypes);
    onAccessChange();
  },e=>console.warn("org",e));
  L.members(curOrg).onSnapshot(sn=>{
    members={};assignments={};
    sn.docs.forEach(d=>{const m=d.data();members[d.id]=m;if(m.roleId)assignments[d.id]=m.roleId;});
    onAccessChange();
  },e=>console.warn("membres",e));
  render();
}
function onAccessChange(){
  const admin=adminUI();
  $("tabs").hidden=false;$("teamTab").hidden=!admin;$("rolesTab").hidden=!admin;
  projSync();calSync();
  if(admin&&!teamSub&&fdb){
    teamSub=fdb.collection("orgs").doc(curOrg).collection("people").onSnapshot(snap=>{
      const next={};
      snap.docs.forEach(d=>{const raw=d.data();const v=sanitize(raw);if(v){Object.assign(v,{updatedAt:raw.updatedAt||0,displayName:raw.displayName||(members[d.id]||{}).name||"",email:raw.email||"",photoURL:raw.photoURL||""});next[d.id]=v;}});
      team=next;$("teamCnt").textContent=Object.keys(team).length;render();
    },()=>{teamSub=null;});
  }
  if(admin&&!validSub&&fdb){
    validSub=true;
    fdb.collection("orgs").doc(curOrg).collection("validations").onSnapshot(snap=>{
      const next={};
      snap.docs.forEach(d=>{const v=JSON.parse(JSON.stringify(d.data()||{}));next[d.id]={entries:v.entries||{},rejected:v.rejected||{}};});
      if(!next[myId]&&valid[myId]) next[myId]=valid[myId];
      valid=next;render();
    },()=>{validSub=false;});
  }
  if(!admin&&(mode==="team"||mode==="roles"||mode==="person")){mode="mine";viewingId=null;}
  render();
}
async function saveOrg(){
  if(!fdb||!curOrg) return;
  const adminRoleIds=org.roles.filter(r=>r.level==="admin").map(r=>r.id);
  try{
    await L.org(curOrg).update({name:org.orgName||"",roles:JSON.parse(JSON.stringify(org.roles)),defaultRoleId:org.defaultRoleId,adminRoleIds,hourlyValue:Number(org.hourlyValue)||0});
    if(orgCode) L.code(orgCode).update({name:org.orgName||"",defaultRoleId:org.defaultRoleId}).catch(()=>{});
  }catch(e){toast("Modification refusée : accès administrateur requis");}
}
async function saveAssignments(){
  if(!fdb||!curOrg) return;
  for(const u of Object.keys(members)){
    const r=assignments[u]||org.defaultRoleId;
    if(members[u].roleId!==r){try{await L.members(curOrg).doc(u).update({roleId:r});}catch(e){toast("Modification refusée : accès administrateur requis");}}
  }
}
async function createOrg(name){
  const id=fdb.collection("orgs").doc().id,code=genCode();
  const b=fdb.batch();
  b.set(L.org(id),{name,ownerUid:myId,code,createdAt:Date.now(),defaultRoleId:DEFAULT_ROLES.defaultRoleId,roles:JSON.parse(JSON.stringify(DEFAULT_ROLES.roles)),adminRoleIds:["r_president","r_vp"]});
  b.set(L.code(code),{orgId:id,name,defaultRoleId:DEFAULT_ROLES.defaultRoleId});
  b.set(L.members(id).doc(myId),{uid:myId,name:nameOf(myId),roleId:"r_president",joinedAt:Date.now()});
  await b.commit();
  myOrgIds.push(id);await saveIndex();switchOrg(id);
}
async function joinOrg(raw){
  const code=normCode(raw);if(code.length!==8) throw {code:"invalid"};
  const c=await L.code(code).get();if(!c.exists) throw {code:"invalid"};
  const {orgId,defaultRoleId}=c.data();
  if(myOrgIds.includes(orgId)){switchOrg(orgId);return;}
  await L.members(orgId).doc(myId).set({uid:myId,name:nameOf(myId),roleId:defaultRoleId||"r_employe",joinedAt:Date.now(),code});
  myOrgIds.push(orgId);await saveIndex();switchOrg(orgId);
}
async function leaveOrg(){
  if(isOwnerNow()) throw {code:"owner"};
  await L.members(curOrg).doc(myId).delete();
  myOrgIds=myOrgIds.filter(x=>x!==curOrg);await saveIndex();switchOrg(myOrgIds[0]||"");
}
async function regenCode(){
  const nc=genCode();const b=fdb.batch();
  b.set(L.code(nc),{orgId:curOrg,name:org.orgName||"",defaultRoleId:org.defaultRoleId});
  b.update(L.org(curOrg),{code:nc});
  if(orgCode) b.delete(L.code(orgCode));
  await b.commit();orgCode=nc;
}
async function syncMyName(){
  saveIndex().catch(()=>{});
  if(curOrg) L.members(curOrg).doc(myId).update({name:myProfile.displayName||""}).catch(()=>{});
}
async function resolveNames(){return false;}

/* ---------- Authentification ---------- */
let signUpMode=false;
const AUTH_ERR={"auth/invalid-credential":"Courriel ou mot de passe incorrect.","auth/wrong-password":"Courriel ou mot de passe incorrect.","auth/user-not-found":"Aucun compte avec ce courriel.","auth/email-already-in-use":"Un compte existe déjà avec ce courriel. Connectez-vous.","auth/weak-password":"Le mot de passe doit contenir au moins 6 caractères.","auth/invalid-email":"Ce courriel n'est pas valide.","auth/popup-closed-by-user":"La fenêtre de connexion a été fermée avant la fin.","auth/unauthorized-domain":"Ce site n'est pas autorisé dans Firebase. Ajoutez son adresse aux domaines autorisés (étape 7 du guide).","auth/operation-not-allowed":"Cette méthode de connexion n'est pas activée dans Firebase (étape 3 du guide).","auth/too-many-requests":"Trop de tentatives. Réessayez dans quelques minutes.","auth/network-request-failed":"Pas de connexion Internet."};
const authErr=e=>{$("authErr").textContent=AUTH_ERR[e&&e.code]||("Connexion impossible ("+((e&&e.code)||"erreur inconnue")+").");};
function setAuthMode(up){
  signUpMode=up;$("nameField").hidden=!up;
  $("authTitle").textContent=up?"Créer un compte":"Connexion";
  $("authSubmit").textContent=up?"Créer mon compte":"Se connecter";
  $("authToggle").textContent=up?"J'ai déjà un compte":"Créer un compte";
  $("authPass").autocomplete=up?"new-password":"current-password";
  $("authErr").textContent="";
}
$("authToggle").onclick=()=>setAuthMode(!signUpMode);
$("gBtn").onclick=async()=>{
  $("authErr").textContent="";
  const p=new firebase.auth.GoogleAuthProvider();
  try{await auth.signInWithPopup(p);}
  catch(e){if(e&&(e.code==="auth/popup-blocked"||e.code==="auth/operation-not-supported-in-this-environment"))auth.signInWithRedirect(p);else authErr(e);}
};
$("authSubmit").onclick=async()=>{
  const email=$("authEmail").value.trim(),pass=$("authPass").value;
  if(!email||!pass){$("authErr").textContent="Entrez votre courriel et votre mot de passe.";return;}
  try{
    if(signUpMode){
      const name=$("authName").value.trim();
      if(!name){$("authErr").textContent="Entrez votre nom complet.";return;}
      pendingName=name;
      const cred=await auth.createUserWithEmailAndPassword(email,pass);
      await cred.user.updateProfile({displayName:name}).catch(()=>{});
    }else await auth.signInWithEmailAndPassword(email,pass);
  }catch(e){pendingName="";authErr(e);}
};
$("authPass").onkeydown=e=>{if(e.key==="Enter")$("authSubmit").click();};
$("authReset").onclick=async()=>{
  const email=$("authEmail").value.trim();
  if(!email){$("authErr").textContent="Entrez d'abord votre courriel ci-dessus.";return;}
  try{await auth.sendPasswordResetEmail(email);$("authErr").textContent="";toast("Courriel de réinitialisation envoyé");}catch(e){authErr(e);}
};
$("signOut").onclick=()=>auth.signOut().then(()=>location.reload());
/* ---------- Mon compte (clic sur son nom dans le menu) ---------- */
function openAccount(){
  const p=myProfile,nm=nameOf(myId);
  $("nName").value=p.displayName||"";
  $("accName").textContent=nm;$("accMail").textContent=p.email||"";$("accMail").hidden=!p.email;
  $("accRole").textContent=curOrg?myTitle():"";$("accRole").hidden=!curOrg;
  if(p.photoURL){$("accAv").src=p.photoURL;$("accAv").hidden=false;$("accIni").hidden=true;}
  else{$("accAv").hidden=true;$("accIni").hidden=false;$("accIni").textContent=(nm||"?").trim().charAt(0).toUpperCase();}
  $("accPw").hidden=!(auth&&auth.currentUser&&auth.currentUser.providerData.some(x=>x.providerId==="password"));
  if(matchMedia("(max-width: 760px)").matches){$("side").classList.remove("open");$("scrim").hidden=true;document.body.classList.remove("noscroll");}
  $("nameDlg").showModal();
}
$("meBtn").onclick=openAccount;
$("nName").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();$("nSave").click();}};
$("accSettings").onclick=()=>{$("nameDlg").close();mode="settings";viewingId=null;render();};
$("accPw").onclick=()=>$("sPw").click();
$("accOut").onclick=()=>$("sOut").click();
$("accDel").onclick=()=>{$("nameDlg").close();$("sDelete").click();};
$("nCancel").onclick=()=>$("nameDlg").close();
$("nSave").onclick=()=>{const v=$("nName").value.trim();if(!v)return;myProfile.displayName=v;persist();syncMyName();$("nameDlg").close();render();toast("Nom enregistré");};

/* ---------- Pointage ---------- */
function clockIn(){
  if(!selectedType){toast("Ajoutez d'abord un type d'activité");return;}
  state.active={typeId:selectedType,start:Date.now(),note:$("noteIn")?$("noteIn").value.trim():"",projectId:$("projIn")?$("projIn").value:""};
  persist();render();toast("Entrée pointée à "+fmtTime(state.active.start));
}
function closeActive(){
  const a=state.active;if(!a) return null;
  const end=Date.now();
  if(end-a.start>=30000) state.sessions.push(Object.assign({id:uid(),typeId:a.typeId,start:a.start,end,note:a.note||""},a.projectId?{projectId:a.projectId}:{}));
  state.active=null;return end;
}
function clockOut(){const end=closeActive();persist();render();if(end) toast("Sortie pointée à "+fmtTime(end));}
function switchTo(typeId){
  if(!state.active||state.active.typeId===typeId) return;
  const pj=state.active.projectId||"";closeActive();state.active={typeId,start:Date.now(),note:"",projectId:pj};
  selectedType=typeId;persist();render();toast("Activité changée : "+typeIn(state,typeId).name);
}

function renderClock(){
  const el=$("clock");
  renderTimerBtn();
  {const d0=state;const a0=d0.active;el.classList.toggle("running",!!a0);if(a0)el.style.setProperty("--act",typeIn(d0,a0.typeId).color);}
  if(false){
    const d=view();const a=d.active;
    if(a){const t=typeIn(d,a.typeId);
      el.innerHTML=`<div class="status"><span class="dot on"></span>En cours · ${esc(t.name)}</div>
      <div class="ro"><div class="timer" id="timer">${fmtClock(Date.now()-a.start)}</div><div class="since">Entrée à ${fmtTime(a.start)}${a.projectId&&projName(a.projectId)?" · 📁 "+esc(projName(a.projectId)):""}${a.note?" · "+esc(a.note):""}</div></div>`;
    }else{
      const last=d.sessions.reduce((m,s)=>Math.max(m,s.end),0);
      el.innerHTML=`<div class="status"><span class="dot"></span>Hors service</div>
      <div class="since">${last?"Dernière sortie : "+dayLabel(last)+" à "+fmtTime(last):"Aucune activité pointée pour l'instant."}</div>`;
    }
    return;
  }
  const a=state.active;const activeTypes=state.types.filter(t=>!t.archived);
  if(a){
    const t=typeIn(state,a.typeId);
    el.innerHTML=`
      <div class="status"><span class="dot on"></span>En cours · ${esc(t.name)}</div>
      <div>
        <div class="timer" id="timer">${fmtClock(Date.now()-a.start)}</div>
        <div class="since">Entrée à ${fmtTime(a.start)}${a.projectId&&projName(a.projectId)?" · 📁 "+esc(projName(a.projectId)):""}${a.note?" · "+esc(a.note):""}</div>
      </div>
      <div>
        <div class="since" style="margin-bottom:6px">Passer à une autre activité sans pointer la sortie :</div>
        <div class="chips">${activeTypes.filter(x=>x.id!==a.typeId).map(x=>`<button class="chip" data-switch="${x.id}" style="--c:${x.color}"><span class="sw" style="background:${x.color}"></span>${esc(x.name)}</button>`).join("")}</div>
      </div>
      <div class="row"><button class="btn big out" id="outBtn">Pointer la sortie</button></div>`;
    el.querySelectorAll("[data-switch]").forEach(b=>b.onclick=()=>switchTo(b.dataset.switch));
    $("outBtn").onclick=clockOut;
  }else{
    el.innerHTML=`
      <div class="status"><span class="dot"></span>Hors service</div>
      <div class="timer idle">00:00:00</div>
      <div>
        <div class="since" style="margin-bottom:6px">Activité</div>
        <div class="chips" role="group" aria-label="Choisir l'activité">${activeTypes.length?activeTypes.map(x=>`<button class="chip" data-sel="${x.id}" style="--c:${x.color}" aria-pressed="${x.id===selectedType}"><span class="sw" style="background:${x.color}"></span>${esc(x.name)}</button>`).join(""):'<span class="empty">Aucun type actif. Ajoutez-en un plus bas.</span>'}</div>
      </div>
      <div class="row">
        ${visibleProjects().length?`<select class="note" id="projIn" aria-label="Projet (facultatif)">${projOptions(selectedProject)}</select>`:""}
        <input type="text" class="note" id="noteIn" placeholder="Note (facultatif)" aria-label="Note">
        <button class="btn big in" id="inBtn" ${activeTypes.length?"":"disabled"}>Pointer l'entrée</button>
      </div>`;
    el.querySelectorAll("[data-sel]").forEach(b=>b.onclick=()=>{selectedType=b.dataset.sel;el.querySelectorAll("[data-sel]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.sel===selectedType));});
    $("inBtn").onclick=clockIn;if($("projIn"))$("projIn").onchange=()=>{selectedProject=$("projIn").value;};
    $("noteIn").onkeydown=e=>{if(e.key==="Enter")clockIn();};
  }
}

/* ---------- Totaux ---------- */
function rangeFor(p){
  const now=new Date();const s=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(p==="day") return [s.getTime(),s.getTime()+86400000];
  if(p==="week"){const ws=state.prefs&&state.prefs.week===0?0:1;const dow=(s.getDay()-ws+7)%7;const st=new Date(s);st.setDate(s.getDate()-dow);const en=new Date(st);en.setDate(st.getDate()+7);return [st.getTime(),en.getTime()];}
  if(p==="month") return [new Date(now.getFullYear(),now.getMonth(),1).getTime(),new Date(now.getFullYear(),now.getMonth()+1,1).getTime()];
  return [0,Infinity];
}
function allSessions(d){
  const list=d.sessions.slice();
  if(d.active) list.push({id:"__active",typeId:d.active.typeId,start:d.active.start,end:Date.now(),note:d.active.note,live:true});
  return list;
}
function totals(d,p){
  const [from,to]=rangeFor(p);const per={};let total=0;
  allSessions(d).forEach(s=>{const x=Math.min(s.end,to)-Math.max(s.start,from);if(x>0){per[s.typeId]=(per[s.typeId]||0)+x;total+=x;}});
  return {per,total};
}
function renderSummary(){
  document.querySelectorAll("#period button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.p===period));
  const d=view();const {per,total}=totals(d,period);
  const labels={day:"aujourd'hui",week:"cette semaine",month:"ce mois-ci",all:"au total"};
  const [vf,vt]=rangeFor(period);let vtot=0;
  Object.values(getValid(curPid()).entries).forEach(e=>{const x=Math.min(e.end,vt)-Math.max(e.start,vf);if(x>0)vtot+=x;});
  $("total").innerHTML=`<b>${fmtDur(total)}</b><span>${labels[period]}, dont ${fmtDur(vtot)} validées</span>${rateOf(curPid())>0&&vtot?`<span>Valeur estimée : ${fmtMoney(moneyOf(vtot,curPid()))}</span>`:""}`;
  const ids=Object.keys(per).sort((a,b)=>per[b]-per[a]);
  const max=ids.length?per[ids[0]]:1;
  $("bars").innerHTML=ids.length?ids.map(id=>{const t=typeIn(d,id);const pct=total?Math.round(per[id]/total*100):0;
    return `<div class="bar"><div class="lbl"><span style="width:10px;height:10px;border-radius:50%;background:${t.color};flex:none"></span>${esc(t.name)}</div>
    <div class="track"><div class="fill" style="width:${per[id]/max*100}%;background:${t.color}"></div></div>
    <div class="val">${fmtDur(per[id])}<small>${pct} %</small></div></div>`;}).join("")
    :`<div class="empty">📊 Aucune heure pointée pour cette période.</div>`;
}

/* ---------- Journal ---------- */
function actionsFor(pid,s,ro,P,admin){
  const st=statusOf(pid,s);let h="";
  if(!ro&&st!=="ok"){
    if(P.canManual) h+=`<button class="btn ghost" data-edit="${s.id}">Modifier</button>`;
    if(P.canDelete) h+=`<button class="btn ghost danger" data-del="${s.id}">${pendingDelete===s.id?"Confirmer la suppression":"Supprimer"}</button>`;
  }
  if(admin){
    if(st!=="ok") h+=`<button class="btn ghost ok" data-val="${s.id}">Valider</button>`;
    if(st==="pending"||st==="changed") h+=`<button class="btn ghost danger" data-ref="${s.id}">Refuser</button>`;
    if(st==="ok") h+=`<button class="btn ghost" data-unval="${s.id}">Annuler la validation</button>`;
  }
  return h;
}
function renderJournal(){
  const d=view();const ro=readOnly();
  const P=perms();const pid=curPid();const admin=adminUI();
  $("addManual").hidden=ro||!P.canManual;
  const nPend=pendingCount(pid,d);
  $("validateAll").hidden=!(admin&&nPend>0);
  $("validateAll").textContent="Valider les "+nPend+" entrée"+(nPend>1?"s":"")+" en attente";
  const list=allSessions(d).sort((a,b)=>b.start-a.start);
  if(!list.length){$("journal").innerHTML=`<div class="empty">${ro?"Aucune entrée pour cette personne.":"🕒 Le journal est vide. Pointez votre entrée pour commencer."}</div>`;return;}
  const groups=[];const map={};
  list.forEach(s=>{const k=dayKey(s.start);if(!map[k]){map[k]={t:s.start,items:[],total:0};groups.push(map[k]);}map[k].items.push(s);map[k].total+=s.end-s.start;});
  const shown=groups.slice(0,journalLimit);
  $("journal").innerHTML=shown.map((g,i)=>`<div class="day" style="${i===0?"margin-top:0":""}">
    <div class="dayhead"><span>${dayLabel(g.t)}</span><span>${fmtDur(g.total)}</span></div>
    ${g.items.map(s=>{const t=typeIn(d,s.typeId);const overnight=dayKey(s.end)!==dayKey(s.start)&&!s.live;
      return `<div class="entry" style="--c:${t.color}"><span class="sw" style="background:${t.color}"></span>
      <div class="what"><div>${esc(t.name)}${s.live?"":`<span class="st ${statusOf(pid,s)}">${ST_LABEL[statusOf(pid,s)]}</span>`}</div>${s.projectId&&projName(s.projectId)?`<div class="n">📁 ${esc(projName(s.projectId))}</div>`:""}${s.note?`<div class="n">${esc(s.note)}</div>`:""}</div>
      <div class="hrs">${fmtTime(s.start)} – ${s.live?"en cours":fmtTime(s.end)+(overnight?" (+1 j)":"")}</div>
      <div class="dur">${fmtDur(s.end-s.start)}</div>
      <div class="acts">${s.live?"":actionsFor(pid,s,ro,P,admin)}</div></div>`;}).join("")}
  </div>`).join("")+(groups.length>journalLimit?`<div class="more"><button class="btn" id="moreBtn">Afficher plus de jours</button></div>`:"");
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openDialog(b.dataset.edit));
  const byId=id=>d.sessions.find(x=>x.id===id);
  document.querySelectorAll("[data-val]").forEach(b=>b.onclick=()=>{validateSessions(pid,d,[byId(b.dataset.val)]);toast("Entrée validée");});
  document.querySelectorAll("[data-ref]").forEach(b=>b.onclick=()=>{const x=byId(b.dataset.ref);writeValid(pid,v=>{v.rejected[x.id]={start:x.start,end:x.end,by:myId,at:Date.now()};delete v.entries[x.id];});toast("Entrée refusée");});
  document.querySelectorAll("[data-unval]").forEach(b=>b.onclick=()=>{writeValid(pid,v=>{delete v.entries[b.dataset.unval];});toast("Validation annulée");});
  document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.del;
    if(pendingDelete===id){state.sessions=state.sessions.filter(s=>s.id!==id);pendingDelete=null;persist();render();toast("Entrée supprimée");}
    else{pendingDelete=id;renderJournal();clearTimeout(renderJournal._t);renderJournal._t=setTimeout(()=>{pendingDelete=null;renderJournal();},4000);}
  });
  const m=$("moreBtn");if(m)m.onclick=()=>{journalLimit+=14;renderJournal();};
}

/* ---------- Fenêtre d'édition ---------- */
let editingId=null;
function openDialog(id){
  editingId=id||null;pendingMeeting=null;
  const s=id?state.sessions.find(x=>x.id===id):null;
  $("dlgTitle").textContent=s?"Modifier l'entrée":"Ajouter une entrée";
  const opts=state.types.filter(t=>!t.archived||(s&&t.id===s.typeId));
  $("fType").innerHTML=opts.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("");
  const now=Date.now();const st=s?s.start:now-3600000, en=s?s.end:now;
  $("fType").value=s?s.typeId:(selectedType||opts[0]?.id||"");
  $("fDate").value=dayKey(st);$("fStart").value=fmtTime(st);$("fEnd").value=fmtTime(en);
  $("fNote").value=s?s.note||"":"";$("fErr").textContent="";
  $("fProj").innerHTML=projOptions(s?s.projectId||"":selectedProject);$("fProjRow").hidden=!visibleProjects().length&&!(s&&s.projectId);
  $("dlg").showModal();
}
$("fCancel").onclick=()=>$("dlg").close();
$("fSave").onclick=()=>{
  const typeId=$("fType").value,date=$("fDate").value,a=$("fStart").value,b=$("fEnd").value;
  if(!typeId||!date||!a||!b){$("fErr").textContent="Remplissez l'activité, la date et les deux heures.";return;}
  const [y,mo,d]=date.split("-").map(Number);const [ah,am]=a.split(":").map(Number);const [bh,bm]=b.split(":").map(Number);
  const start=new Date(y,mo-1,d,ah,am).getTime();let end=new Date(y,mo-1,d,bh,bm).getTime();
  if(end<=start) end+=86400000;
  if(end-start>24*3600000){$("fErr").textContent="Une entrée ne peut pas dépasser 24 heures.";return;}
  const note=$("fNote").value.trim();
  const projectId=$("fProj").value||"";
  if(editingId){const x=state.sessions.find(x=>x.id===editingId);Object.assign(x,{typeId,start,end,note});if(projectId)x.projectId=projectId;else delete x.projectId;}
  else state.sessions.push(Object.assign({id:uid(),typeId,start,end,note},projectId?{projectId}:{},pendingMeeting?{meetingId:pendingMeeting}:{}));
  pendingMeeting=null;
  $("dlg").close();persist();render();toast(editingId?"Entrée modifiée":"Entrée ajoutée");
};
$("addManual").onclick=()=>{if(!state.types.some(t=>!t.archived)){toast("Ajoutez d'abord un type d'activité");return;}openDialog(null);};

/* ---------- Types ---------- */
function renderTypes(){
  const hideT=readOnly()||!adminUI();
  $("typesSection").hidden=hideT;
  if(hideT) return;
  $("types").innerHTML=state.types.map(t=>`<div class="type ${t.archived?"archived":""}">
    <input type="text" value="${esc(t.name)}" data-rename="${t.id}" aria-label="Nom du type">
    <div class="swatches" role="group" aria-label="Couleur">${COLORS.map(c=>`<button style="background:${c}" data-color="${t.id}" data-c="${c}" aria-pressed="${c===t.color}" aria-label="Couleur ${c}"></button>`).join("")}</div>
    <button class="btn ghost" data-arch="${t.id}">${t.archived?"Réactiver":"Archiver"}</button>
  </div>`).join("");
  document.querySelectorAll("[data-rename]").forEach(i=>i.onchange=()=>{const t=state.types.find(x=>x.id===i.dataset.rename);const v=i.value.trim();if(v){t.name=v;saveTypes();render();}else i.value=t.name;});
  document.querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>{state.types.find(x=>x.id===b.dataset.color).color=b.dataset.c;saveTypes();render();});
  document.querySelectorAll("[data-arch]").forEach(b=>b.onclick=()=>{
    const t=state.types.find(x=>x.id===b.dataset.arch);
    if(!t.archived&&state.active&&state.active.typeId===t.id){toast("Pointez la sortie avant d'archiver l'activité en cours");return;}
    t.archived=!t.archived;
    if(t.archived&&selectedType===t.id){const f=state.types.find(x=>!x.archived);selectedType=f?f.id:null;}
    if(!t.archived&&!selectedType) selectedType=t.id;
    saveTypes();render();
  });
}
function addType(){
  const v=$("newType").value.trim();if(!v) return;
  if(state.types.some(t=>t.name.toLowerCase()===v.toLowerCase())){toast("Ce type existe déjà");return;}
  const t={id:"t_"+uid(),name:v,color:COLORS[state.types.length%COLORS.length],archived:false};
  state.types.push(t);if(!selectedType) selectedType=t.id;
  $("newType").value="";saveTypes();render();toast("Type ajouté : "+v);
}
$("addType").onclick=addType;
$("newType").onkeydown=e=>{if(e.key==="Enter")addType();};

/* ---------- Équipe (administrateur) ---------- */
function renderTeam(){
  document.querySelectorAll("#teamPeriod button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.p===teamPeriod));
  const ids=Object.keys(team);
  if(!ids.length){$("teamTable").innerHTML=`<div class="empty">Personne n'a encore pointé. Partagez la page avec votre équipe pour qu'elle apparaisse ici.</div>`;return;}
  const rows=ids.map(id=>{const d=team[id];return {id,d,t:totals(d,teamPeriod)};});
  rows.sort((a,b)=>(!!b.d.active-!!a.d.active)||(b.t.total-a.t.total));
  const lbl={day:"Aujourd'hui",week:"Cette semaine",month:"Ce mois-ci"}[teamPeriod];
  $("teamTable").innerHTML=`<table class="team"><thead><tr><th>Personne</th><th>Rôle</th><th>Statut</th><th class="num">${lbl}</th><th class="num">À valider</th><th>Activité principale</th><th>Dernière mise à jour</th></tr></thead><tbody>
  ${rows.map(r=>{const top=Object.keys(r.t.per).sort((a,b)=>r.t.per[b]-r.t.per[a])[0];const tt=top?typeIn(r.d,top):null;
    const st=r.d.active?`<span class="pill"><span class="dot on"></span>En cours · ${esc(typeIn(r.d,r.d.active.typeId).name)}</span>`:`<span class="pill"><span class="dot"></span>Hors service</span>`;
    return `<tr class="click" data-person="${esc(r.id)}" tabindex="0"><td><div class="person"><img alt="" data-av="${esc(r.id)}"><span data-nm="${esc(r.id)}"></span></div></td>
    <td>${roleCell(r.id,r.d)}</td><td>${st}</td><td class="num"><b>${fmtDur(r.t.total)}</b></td><td class="num">${pendingCount(r.id,r.d)||"—"}</td>
    <td>${tt?`<span class="pill"><span style="width:9px;height:9px;border-radius:50%;background:${tt.color}"></span>${esc(tt.name)}</span>`:"—"}</td>
    <td>${r.d.updatedAt?dayLabel(r.d.updatedAt)+" "+fmtTime(r.d.updatedAt):"—"}</td></tr>`;}).join("")}
  </tbody></table>`;
  fillNames();
  resolveNames(ids).then(()=>fillNames());
  document.querySelectorAll("select[data-assign]").forEach(sel=>{
    sel.onclick=e=>e.stopPropagation();sel.onkeydown=e=>e.stopPropagation();
    sel.onchange=()=>{assignments[sel.dataset.assign]=sel.value;saveAssignments();renderTeam();toast("Rôle modifié : "+roleById(sel.value).name);};
  });
  document.querySelectorAll("[data-person]").forEach(tr=>{
    const go=()=>openPerson(tr.dataset.person);
    tr.onclick=go;tr.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}};
  });
}
function roleCell(pid,d){
  const r=roleOf(pid);
  const warn="";
  return `<select class="rolesel" data-assign="${esc(pid)}" aria-label="Rôle">${org.roles.map(x=>`<option value="${x.id}" ${x.id===r.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select>${warn}`;
}
/* ---------- Rôles ---------- */
function renderRoles(){
  const counts={};Object.keys(team).forEach(id=>{const r=roleOf(id);counts[r.id]=(counts[r.id]||0)+1;});
  const permList=[["canManual","Ajouter et modifier des entrées à la main"],["canDelete","Supprimer des entrées"]];
  $("rolesList").innerHTML=org.roles.map(r=>`<div class="role">
    <div class="top">
      <input type="text" value="${esc(r.name)}" data-rname="${r.id}" aria-label="Nom du rôle">
      <span class="lvl">${r.level==="admin"?"Accès administrateur":"Accès restreint"} · ${counts[r.id]||0} personne${(counts[r.id]||0)>1?"s":""}</span>
      ${r.locked?"":`<button class="btn ghost danger" data-rdel="${r.id}">${pendingDelete===r.id?"Confirmer la suppression":"Supprimer"}</button>`}
    </div>
    <label class="since rrate">Valeur horaire propre à ce rôle ($/h) <input type="number" min="0" step="0.5" inputmode="decimal" data-rrate="${r.id}" value="${r.rate>0?r.rate:""}" placeholder="${org.hourlyValue||""}" style="max-width:100px" aria-label="Valeur horaire propre à ce rôle"></label>
    ${r.level==="admin"?`<div class="since">Voit toute l'équipe, attribue les rôles et a toutes les permissions dans son espace.</div>`:
    `<div class="perms">${permList.map(([k,l])=>`<label><input type="checkbox" data-rperm="${r.id}" data-k="${k}" ${r[k]?"checked":""}>${l}</label>`).join("")}</div>
     <div class="since">Voit uniquement son propre espace.</div>`}
  </div>`).join("");
  const std=org.roles.filter(r=>r.level==="standard");
  if(document.activeElement!==$("orgName")) $("orgName").value=org.orgName||"";
  $("defaultRole").innerHTML=std.map(r=>`<option value="${r.id}" ${r.id===org.defaultRoleId?"selected":""}>${esc(r.name)}</option>`).join("");
  document.querySelectorAll("[data-rname]").forEach(i=>i.onchange=()=>{const r=roleById(i.dataset.rname);const v=i.value.trim();if(!v){i.value=r.name;return;}r.name=v;saveOrg();render();});
  document.querySelectorAll("[data-rrate]").forEach(i=>i.onchange=()=>{const r=roleById(i.dataset.rrate);const v=Math.max(0,Number(String(i.value).replace(",","."))||0);if(v>0)r.rate=Math.round(v*100)/100;else delete r.rate;saveOrg();render();});
  document.querySelectorAll("[data-rperm]").forEach(c=>c.onchange=()=>{roleById(c.dataset.rperm)[c.dataset.k]=c.checked;saveOrg();});
  document.querySelectorAll("[data-rdel]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.rdel;
    if(org.roles.filter(r=>r.level==="standard").length<=1){toast("Gardez au moins un rôle à accès restreint");return;}
    if(pendingDelete!==id){pendingDelete=id;renderRoles();setTimeout(()=>{if(pendingDelete===id){pendingDelete=null;renderRoles();}},4000);return;}
    pendingDelete=null;
    org.roles=org.roles.filter(r=>r.id!==id);
    if(org.defaultRoleId===id) org.defaultRoleId=org.roles.find(r=>r.level==="standard").id;
    let changed=false;Object.keys(assignments).forEach(p=>{if(assignments[p]===id){delete assignments[p];changed=true;}});
    saveOrg();if(changed)saveAssignments();render();toast("Rôle supprimé");
  });
}
function addRole(){
  const v=$("newRole").value.trim();if(!v) return;
  if(org.roles.some(r=>r.name.toLowerCase()===v.toLowerCase())){toast("Ce rôle existe déjà");return;}
  org.roles.push({id:"r_"+uid(),name:v,level:"standard",canManual:false,canDelete:false,canManageTypes:false});
  $("newRole").value="";saveOrg();render();toast("Rôle créé : "+v);
}
$("addRole").onclick=addRole;
$("newRole").onkeydown=e=>{if(e.key==="Enter")addRole();};
$("orgName").onchange=()=>{org.orgName=$("orgName").value.trim();saveOrg();toast("Nom de l'organisation enregistré");};
$("defaultRole").onchange=()=>{org.defaultRoleId=$("defaultRole").value;saveOrg();};
function renderAccess(){
  const b=$("roleBadge");
  if(myId){b.hidden=false;b.textContent=myTitle();}
  $("meName").textContent=nameOf(myId);
  $("meInitial").textContent=initials(nameOf(myId));$("meInitial").style.background=hashColor(myId||"x");$("meInitial").hidden=!!myProfile.photoURL;
  if(myProfile.photoURL){$("meAvatar").src=myProfile.photoURL;$("meAvatar").hidden=false;}
  const n=$("roleNotice");
  const needShare=false;
  n.hidden=!(needShare&&mode==="mine");
  if(needShare) n.textContent="Votre rôle donne l'accès administrateur. Pour voir l'équipe, demandez au propriétaire de vous donner le rôle Éditeur dans le menu Partager de cette page.";
}
function fillNames(){
  document.querySelectorAll("[data-nm]").forEach(el=>{el.textContent=nameOf(el.dataset.nm)+(el.dataset.nm===myId?" (vous)":"");});
  document.querySelectorAll("[data-av]").forEach(el=>{const p=profileOf(el.dataset.av);if(p&&p.photoURL){el.src=p.photoURL;el.referrerPolicy="no-referrer";}else el.hidden=true;});
}
function openPerson(id){mode="person";viewingId=id;journalLimit=14;render();window.scrollTo(0,0);}
function renderWho(){
  const w=$("who");
  if(mode!=="person"){w.hidden=true;return;}
  w.hidden=false;
  const vd=view();const va=vd.active;
  w.innerHTML=`<button class="btn" id="backBtn">‹ Équipe</button><img alt="" data-av="${esc(viewingId)}"><span class="nm" data-nm="${esc(viewingId)}"></span>`+
    (va?`<span class="pill"><span class="dot on" style="--act:${typeIn(vd,va.typeId).color}"></span>En cours · ${esc(typeIn(vd,va.typeId).name)} depuis ${fmtTime(va.start)}</span>`:`<span class="pill"><span class="dot"></span>Hors service</span>`);
  $("backBtn").onclick=()=>{mode="team";render();};
  fillNames();resolveNames([viewingId]).then(()=>fillNames());
}

/* ---------- Export ---------- */
const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
function sessionRows(d,who){
  return d.sessions.slice().sort((a,b)=>a.start-b.start).map(s=>[...(who!=null?[who]:[]),dayKey(s.start),typeIn(d,s.typeId).name,fmtTime(s.start),fmtTime(s.end),((s.end-s.start)/3600000).toFixed(2).replace(".",DEC()),s.note||""].map(q).join(";"));
}
async function offerCsv(filename,lines){
  const csv="\uFEFF"+lines.join("\r\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=filename;a.click();
}
$("exportCsv").onclick=()=>{
  const d=view();if(!d.sessions.length){toast("Rien à exporter pour l'instant");return;}
  const head=["Date","Activité","Entrée","Sortie","Durée (h)","Note"].map(x=>q(tx(x))).join(";");
  const who=readOnly()?nameOf(viewingId).replace(/[^\p{L}\p{N}]+/gu,"-").toLowerCase()+"-":"";
  offerCsv("pointeuse-"+who+dayKey(Date.now())+".csv",[head,...sessionRows(d)]);
};
$("exportTeam").onclick=async()=>{
  const ids=Object.keys(team);if(!ids.length){toast("Rien à exporter pour l'instant");return;}
  await resolveNames(ids);
  const lines=[["Personne","Date","Activité","Entrée","Sortie","Durée (h)","Note"].map(x=>q(tx(x))).join(";")];
  ids.forEach(id=>lines.push(...sessionRows(team[id],nameOf(id))));
  offerCsv("pointeuse-equipe-"+dayKey(Date.now())+".csv",lines);
};

$("validateAll").onclick=()=>{
  const pid=curPid();const d=view();
  const list=d.sessions.filter(s=>{const st=statusOf(pid,s);return st==="pending"||st==="changed";});
  if(list.length){validateSessions(pid,d,list);toast(list.length+" entrée"+(list.length>1?"s validées":" validée"));}
};

/* ---------- Attestation ---------- */
function attEntries(){
  const pid=curPid();const f=$("aFrom").value,t=$("aTo").value;
  if(!f||!t) return {pid,list:[]};
  const [y1,m1,d1]=f.split("-").map(Number),[y2,m2,d2]=t.split("-").map(Number);
  const from=new Date(y1,m1-1,d1).getTime(),to=new Date(y2,m2-1,d2+1).getTime();
  const list=Object.entries(getValid(pid).entries).map(([id,e])=>Object.assign({id},e)).filter(e=>e.start>=from&&e.start<to).sort((a,b)=>a.start-b.start);
  return {pid,list,from,to};
}
function updateAttPreview(){
  const {list}=attEntries();const tot=list.reduce((m,e)=>m+e.end-e.start,0);
  $("aPreview").textContent=list.length?list.length+" entrée"+(list.length>1?"s":"")+" validée"+(list.length>1?"s":"")+", "+fmtDur(tot)+" au total."+(rateOf(attEntries().pid)>0?" "+tx("Valeur estimée : {}",fmtMoney(moneyOf(tot,attEntries().pid)))+".":""):"Aucune heure validée sur cette période.";
}
$("openAttest").onclick=async()=>{
  const pid=curPid();
  await resolveNames([pid]);
  const nm=nameOf(pid);$("aName").value=(nm==="Moi"||nm==="Personne sans nom")?"":nm;
  const es=Object.values(getValid(pid).entries).map(e=>e.start);
  const now=Date.now();
  $("aFrom").value=dayKey(es.length?Math.min(...es):now);$("aTo").value=dayKey(now);
  $("aSigner").value="";$("aErr").textContent="";updateAttPreview();
  $("attDlg").showModal();
};
$("aFrom").onchange=updateAttPreview;$("aTo").onchange=updateAttPreview;
$("aCancel").onclick=()=>$("attDlg").close();
async function verifCode(pid,list){
  const src=pid+"|"+list.map(e=>e.id+":"+e.start+":"+e.end+":"+e.typeId).join(",");
  try{const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(src));
    const hex=[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,"0")).join("").toUpperCase().slice(0,12);
    return hex.match(/.{4}/g).join("-");}catch(e){return "";}
}
const longDate=t=>new Date(t).toLocaleDateString(LOC(),{day:"numeric",month:"long",year:"numeric"});
$("aMake").onclick=async()=>{
  const name=$("aName").value.trim();const {pid,list,from,to}=attEntries();
  if(!name){$("aErr").textContent="Indiquez le nom de la personne.";return;}
  if(!list.length){$("aErr").textContent="Aucune heure validée sur cette période. Faites d'abord valider les entrées.";return;}
  if(!window.jspdf){$("aErr").textContent="Le générateur de PDF n'a pas pu se charger. Rechargez la page.";return;}
  const byIds=[...new Set(list.map(e=>e.by).filter(Boolean))];await resolveNames(byIds);
  const validators=[...new Set(list.map(e=>e.byName||(team[e.by]&&nameOf(e.by))||"").filter(Boolean))];
  const code=await verifCode(pid,list);
  const total=list.reduce((m,e)=>m+e.end-e.start,0);
  const per={};list.forEach(e=>{per[e.typeName]=(per[e.typeName]||0)+e.end-e.start;});
  const org=(window.__orgName&&window.__orgName())||tx("l'organisation");
  const hrs=ms=>(ms/3600000).toFixed(2).replace(".",DEC())+" h";

  const doc=new window.jspdf.jsPDF({unit:"mm",format:"letter"});
  const W=215.9,M=20;let y=24;
  const line=()=>{doc.setDrawColor(200);doc.line(M,y,W-M,y);};
  const need=h=>{if(y+h>262){doc.addPage();y=22;}};
  doc.setFont("helvetica","bold");doc.setFontSize(20);doc.text(tx("Attestation d'heures d'implication"),M,y);y+=8;
  doc.setFont("helvetica","normal");doc.setFontSize(12);if(org!=="l'organisation"){doc.setTextColor(90);doc.text(org,M,y);doc.setTextColor(0);y+=12;}else{y+=4;}
  doc.setFontSize(11.5);
  const para=doc.splitTextToSize(tx("Nous attestons que {} a consacré {} d'implication au sein de {}, du {} au {}. Ces heures ont été enregistrées au moyen de notre système de pointage et validées par un administrateur de l'organisation.",name,hrs(total),org,longDate(from),longDate(to-86400000)),W-2*M);
  doc.text(para,M,y,{lineHeightFactor:1.45});y+=para.length*6+6;
  doc.setFont("helvetica","bold");doc.text(tx("Répartition par type d'activité"),M,y);y+=4;line();y+=6;
  doc.setFont("helvetica","normal");
  Object.keys(per).sort((a,b)=>per[b]-per[a]).forEach(k=>{need(8);doc.text(tx(k),M,y);doc.text(hrs(per[k]),W-M,y,{align:"right"});y+=7;});
  line();y+=6;doc.setFont("helvetica","bold");doc.text(tx("Total"),M,y);doc.text(hrs(total),W-M,y,{align:"right"});y+=8;
  {const rt=rateOf(pid);if(rt>0){doc.text(tx("Valeur estimée du bénévolat"),M,y);doc.text(fmtMoney(moneyOf(total,pid)),W-M,y,{align:"right"});y+=6;
    doc.setFont("helvetica","normal");doc.setFontSize(9.5);doc.setTextColor(90);doc.text(tx("Calculée à {} de l'heure.",fmtMoney(rt)),M,y);doc.setTextColor(0);doc.setFontSize(11.5);doc.setFont("helvetica","bold");y+=8;}}
  y+=6;

  need(20);doc.text(tx("Détail des entrées validées"),M,y);y+=4;line();y+=6;
  doc.setFontSize(9.5);doc.setTextColor(90);
  const cols=[M,M+26,M+72,M+100];
  doc.text(tx("Date"),cols[0],y);doc.text(tx("Activité"),cols[1],y);doc.text(tx("Horaire"),cols[2],y);doc.text(tx("Note"),cols[3],y);doc.text(tx("Durée"),W-M,y,{align:"right"});
  doc.setTextColor(0);doc.setFont("helvetica","normal");y+=6;
  list.forEach(e=>{
    need(7);
    const note=doc.splitTextToSize(e.note||"",W-M-cols[3]-18)[0]||"";
    doc.text(dayKey(e.start),cols[0],y);
    doc.text(doc.splitTextToSize(tx(e.typeName),44)[0],cols[1],y);
    doc.text(fmtTime(e.start)+" – "+fmtTime(e.end),cols[2],y);
    doc.text(note,cols[3],y);
    doc.text(hrs(e.end-e.start),W-M,y,{align:"right"});y+=6;
  });
  y+=8;need(56);doc.setFontSize(10.5);
  if(validators.length){doc.text(tx("Heures validées par : {}",validators.join(", ")),M,y);y+=6;}
  doc.text(tx("Document émis le {}",longDate(Date.now())),M,y);y+=6;
  if(code){doc.text(tx("Code de vérification : {}",code),M,y);y+=6;}
  y+=14;doc.setDrawColor(0);doc.line(M,y,M+80,y);y+=5;
  doc.text($("aSigner").value.trim()||tx("Signature et fonction du signataire"),M,y);

  const buf=doc.output("arraybuffer");
  const filename="attestation-"+name.replace(/[^\p{L}\p{N}]+/gu,"-").toLowerCase()+".pdf";
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([buf],{type:"application/pdf"}));a.download=filename;a.click();$("attDlg").close();
};
window.__orgName=()=>org.orgName;


/* ---------- Vue par jour ---------- */
const startOfDay=t=>{const d=new Date(t);return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();};
const addDays=(t,n)=>{const d=new Date(t);return new Date(d.getFullYear(),d.getMonth(),d.getDate()+n).getTime();};
let dayCursor=startOfDay(Date.now());
function daySessions(d,ds){
  const de=addDays(ds,1);
  return allSessions(d).filter(s=>s.end>ds&&s.start<de).sort((a,b)=>a.start-b.start)
    .map(s=>Object.assign({},s,{cs:Math.max(s.start,ds),ce:Math.min(s.end,de)}));
}
function timelineHTML(d,list,ds){
  const span=addDays(ds,1)-ds; // gère les changements d'heure
  const grid=[6,12,18].map(h=>`<div class="grid" style="left:${h/24*100}%"></div>`).join("");
  return `<div class="tl">${grid}${list.map(s=>{const t=typeIn(d,s.typeId);
    return `<div class="blk ${s.live?"live":""}" style="left:${(s.cs-ds)/span*100}%;width:${(s.ce-s.cs)/span*100}%;background:${t.color}" title="${esc(t.name)} · ${fmtTime(s.start)} – ${s.live?"en cours":fmtTime(s.end)}"></div>`;}).join("")}</div>`;
}
const axisHTML=()=>`<div class="axis">${[0,6,12,18,24].map(h=>`<span style="left:${h/24*100}%">${h} h</span>`).join("")}</div>`;
function nearestActiveDay(lists,dir){
  let best=null;
  lists.forEach(d=>allSessions(d).forEach(s=>{
    const k=startOfDay(s.start);
    if(dir<0&&k<dayCursor&&(best===null||k>best)) best=k;
    if(dir>0&&k>dayCursor&&(best===null||k<best)) best=k;
  }));
  return best;
}
function syncDayPickers(){document.querySelectorAll(".dayPick").forEach(i=>{i.value=dayKey(dayCursor);});}
function jumpsHTML(lists){
  const p=nearestActiveDay(lists,-1),n=nearestActiveDay(lists,1);
  if(p===null&&n===null) return "";
  return `<div class="jumps">${p!==null?`<button class="btn" data-djump="${p}">Jour d'activité précédent (${esc(dayKey(p))})</button>`:""}${n!==null?`<button class="btn" data-djump="${n}">Jour d'activité suivant (${esc(dayKey(n))})</button>`:""}</div>`;
}
function renderDay(){
  syncDayPickers();
  const d=view();const pid=curPid();const list=daySessions(d,dayCursor);
  const total=list.reduce((m,s)=>m+s.ce-s.cs,0);
  const head=`<div class="daytitle"><b>${dayLabel(dayCursor)} ${new Date(dayCursor).getFullYear()}</b><span>${fmtDur(total)}</span></div>`;
  if(!list.length){
    $("dayCard").innerHTML=head+`<div class="empty">🌙 Aucune activité ce jour-là.</div>`+jumpsHTML([d]);
  }else{
    $("dayCard").innerHTML=head+timelineHTML(d,list,dayCursor)+axisHTML()+list.map(s=>{const t=typeIn(d,s.typeId);const st=statusOf(pid,s);
      const from=s.start<dayCursor?" (veille)":"",to=!s.live&&s.end>addDays(dayCursor,1)?" (lendemain)":"";
      return `<div class="entry" style="--c:${t.color}"><span class="sw" style="background:${t.color}"></span>
      <div class="what"><div>${esc(t.name)}${st?`<span class="st ${st}">${ST_LABEL[st]}</span>`:""}</div>${s.projectId&&projName(s.projectId)?`<div class="n">📁 ${esc(projName(s.projectId))}</div>`:""}${s.note?`<div class="n">${esc(s.note)}</div>`:""}</div>
      <div class="hrs">${fmtTime(s.start)}${from} – ${s.live?"en cours":fmtTime(s.end)+to}</div>
      <div class="dur">${fmtDur(s.ce-s.cs)}</div><div class="acts"></div></div>`;}).join("")+jumpsHTML([d]);
  }
  bindDayJumps($("dayCard"));
}
function renderTeamDay(){
  syncDayPickers();
  const ids=Object.keys(team);
  const rows=ids.map(id=>{const d=team[id];const list=daySessions(d,dayCursor);return {id,d,list,total:list.reduce((m,s)=>m+s.ce-s.cs,0)};}).filter(r=>r.list.length).sort((a,b)=>b.total-a.total);
  const total=rows.reduce((m,r)=>m+r.total,0);
  const head=`<div class="daytitle"><b>${dayLabel(dayCursor)} ${new Date(dayCursor).getFullYear()}</b><span>${rows.length} personne${rows.length>1?"s":""} · ${fmtDur(total)}</span></div>`;
  if(!rows.length){$("teamDayCard").innerHTML=head+`<div class="empty">🌙 Personne n'a pointé ce jour-là.</div>`+jumpsHTML(ids.map(i=>team[i]));bindDayJumps($("teamDayCard"));return;}
  $("teamDayCard").innerHTML=head+`<div class="dayaxis-wrap"><div></div>${axisHTML()}<div style="min-width:64px"></div></div>`+
    rows.map(r=>`<div class="teamday click" data-dayperson="${esc(r.id)}" tabindex="0" style="cursor:pointer">
      <div class="person"><img alt="" data-av="${esc(r.id)}"><span data-nm="${esc(r.id)}"></span></div>
      ${timelineHTML(r.d,r.list,dayCursor)}<div class="tot">${fmtDur(r.total)}</div></div>`).join("")+jumpsHTML(ids.map(i=>team[i]));
  fillNames();resolveNames(rows.map(r=>r.id)).then(()=>fillNames());
  document.querySelectorAll("[data-dayperson]").forEach(el=>{const go=()=>openPerson(el.dataset.dayperson);el.onclick=go;el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}};});
  bindDayJumps($("teamDayCard"));
}
function bindDayJumps(root){root.querySelectorAll("[data-djump]").forEach(b=>b.onclick=()=>setDay(Number(b.dataset.djump)));}
function setDay(t){dayCursor=startOfDay(t);if(mode==="team")renderTeamDay();else renderDay();}
document.querySelectorAll("[data-dnav]").forEach(b=>b.onclick=()=>setDay(addDays(dayCursor,Number(b.dataset.dnav))));
document.querySelectorAll("[data-dtoday]").forEach(b=>b.onclick=()=>setDay(Date.now()));
document.querySelectorAll(".dayPick").forEach(i=>i.onchange=()=>{if(!i.value)return;const [y,m,d]=i.value.split("-").map(Number);setDay(new Date(y,m-1,d).getTime());});

/* ---------- Stockage des projets (Firebase) ---------- */
// Les fichiers sont découpés en morceaux dans Firestore : aucun forfait payant n'est nécessaire.
const cleanDoc=d=>{const o=JSON.parse(JSON.stringify(d));delete o.id;return o;};
const snapList=sn=>sn.docs.map(d=>Object.assign({},d.data(),{id:d.id}));
const CHUNK=900*1024;
const pref=pid=>fdb.collection("orgs").doc(curOrg).collection("projects").doc(pid);
const PA={
  ready:()=>!!fdb&&!!myId&&!!curOrg,
  accept:"",
  maxSize:5*1024*1024,
  watchProjects(cb){
    let q=fdb.collection("orgs").doc(curOrg).collection("projects");
    if(!adminUI()) q=q.where("memberIds","array-contains",myId);
    return q.onSnapshot(sn=>cb(snapList(sn)),e=>console.warn("projets",e));
  },
  watchTasks:(pid,cb)=>pref(pid).collection("tasks").onSnapshot(sn=>cb(snapList(sn)),()=>{}),
  watchFiles:(pid,cb)=>pref(pid).collection("files").onSnapshot(sn=>cb(snapList(sn)),()=>{}),
  saveProject:(pid,d)=>pref(pid).set(cleanDoc(d)),
  saveTask:(pid,tid,d)=>pref(pid).collection("tasks").doc(tid).set(cleanDoc(d)),
  updateTask:(pid,tid,part)=>pref(pid).collection("tasks").doc(tid).update(cleanDoc(part)),
  deleteTask:(pid,tid)=>pref(pid).collection("tasks").doc(tid).delete(),
  async upload(pid,tid,file,meta){
    const buf=new Uint8Array(await file.arrayBuffer());
    const n=Math.max(1,Math.ceil(buf.length/CHUNK));
    const fref=pref(pid).collection("files").doc();
    const b=fdb.batch();
    b.set(fref,cleanDoc(Object.assign({},meta,{chunks:n})));
    for(let i=0;i<n;i++) b.set(fref.collection("chunks").doc(String(i)),{data:firebase.firestore.Blob.fromUint8Array(buf.subarray(i*CHUNK,(i+1)*CHUNK))});
    await b.commit();
  },
  async open(pid,f){
    const viewable=/^(image\/|video\/|text\/|application\/pdf)/.test(f.type||"");
    const w=viewable?window.open("","_blank"):null;
    try{
      const fref=pref(pid).collection("files").doc(f.id);const parts=[];
      for(let i=0;i<(f.chunks||1);i++){const d=await fref.collection("chunks").doc(String(i)).get();parts.push(d.data().data.toUint8Array());}
      const url=URL.createObjectURL(new Blob(parts,{type:f.type||"application/octet-stream"}));
      if(w) w.location.href=url;
      else{const a=document.createElement("a");a.href=url;a.download=f.name;document.body.appendChild(a);a.click();a.remove();}
      setTimeout(()=>URL.revokeObjectURL(url),120000);
    }catch(e){if(w)w.close();throw e;}
  },
  async deleteFile(pid,f){
    const fref=pref(pid).collection("files").doc(f.id);const b=fdb.batch();
    for(let i=0;i<(f.chunks||1);i++) b.delete(fref.collection("chunks").doc(String(i)));
    b.delete(fref);await b.commit();
  },
  async deleteProject(pid){
    const fs=await pref(pid).collection("files").get();
    for(const d of fs.docs) await PA.deleteFile(pid,Object.assign({},d.data(),{id:d.id}));
    const ts=await pref(pid).collection("tasks").get();
    for(const d of ts.docs) await d.ref.delete();
    await pref(pid).delete();
  }
};
function uploadErr(e){const c=e&&e.code,m=(e&&e.message)||"";
  return c==="permission-denied"?"Vous n'avez pas le droit de déposer un fichier dans ce projet."
    :c==="resource-exhausted"?"La limite gratuite du jour est atteinte. Réessayez demain."
    :/exceed|too large|maximum|size/i.test(m)?"Fichier trop volumineux (5 Mo maximum)."
    :"L'envoi a échoué.";}

/* ---------- Projets et tâches ---------- */
const TASK_ST={a_faire:"À faire",en_cours:"En cours",a_verifier:"À vérifier",terminee:"Terminée"};
const AV_COLORS=["#F2A33A","#4F7CFF","#2FB7A0","#E4572E","#8B5CF6","#3AA0D8","#B7791F","#D6457F"];
let projects={}, ptasks={}, pfiles={};
let projOpen=null, projFilter="actifs";
let projUnsub=null, projAsAdmin=null, filesUnsub=null, filesFor=null;
const taskUnsubs={};
let editingProj=null, editingTask=null, pendingProjDel=null;

const DAY=86400000;
const parseDay=s=>{if(!s)return null;const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d).getTime();};
const shortDate=s=>new Date(parseDay(s)).toLocaleDateString(LOC(),{day:"numeric",month:"short",year:new Date(parseDay(s)).getFullYear()!==new Date().getFullYear()?"numeric":undefined});
function dueHTML(deadline,done){
  if(!deadline) return "";
  const days=Math.round((parseDay(deadline)-startOfDay(Date.now()))/DAY);
  if(done) return `<span class="due done">✓ ${esc(shortDate(deadline))}</span>`;
  if(days<0) return `<span class="due late">En retard de ${-days} j</span>`;
  if(days===0) return `<span class="due late">Aujourd'hui</span>`;
  if(days<=3) return `<span class="due soon">Dans ${days} j</span>`;
  return `<span class="due">📅 ${esc(shortDate(deadline))}</span>`;
}
const hashColor=id=>{let h=0;for(const c of String(id))h=(h*31+c.charCodeAt(0))>>>0;return AV_COLORS[h%AV_COLORS.length];};
const initials=n=>String(n||"?").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("")||"?";
const pname=(p,id)=>(p&&p.memberNames&&p.memberNames[id])||nameOf(id);
function avatarsHTML(p,ids,max=5){
  const shown=ids.slice(0,max);
  return `<span class="avs">${shown.map(id=>`<span class="av" style="background:${hashColor(id)}" title="${esc(pname(p,id))}">${esc(initials(pname(p,id)))}</span>`).join("")}${ids.length>max?`<span class="av" style="background:var(--muted)">+${ids.length-max}</span>`:""}</span>`;
}
const fmtSize=b=>b<1024?b+" o":b<1048576?Math.round(b/1024)+" Ko":(b/1048576).toFixed(1).replace(".",DEC())+" Mo";
const fileIcon=t=>/^image\//.test(t)?"🖼️":t==="application/pdf"?"📄":/^video\//.test(t)?"🎬":"📎";

function visibleProjects(){return Object.values(projects).filter(p=>adminUI()||(p.memberIds||[]).includes(myId));}
function tasksOf(pid){return Object.values(ptasks[pid]||{}).sort((a,b)=>(a.status==="terminee")-(b.status==="terminee")||(parseDay(a.deadline)||9e15)-(parseDay(b.deadline)||9e15)||(a.createdAt||0)-(b.createdAt||0));}
function projProgress(pid){
  const ts=Object.values(ptasks[pid]||{});
  if(!ts.length) return 0;
  return Math.round(ts.reduce((m,t)=>m+(t.status==="terminee"?100:Math.min(95,t.progress||0)),0)/ts.length);
}
function myOpenTasks(){
  const out=[];
  visibleProjects().forEach(p=>tasksOf(p.id).forEach(t=>{if((t.assigneeIds||[]).includes(myId)&&t.status!=="terminee")out.push({p,t});}));
  return out.sort((a,b)=>(parseDay(a.t.deadline)||9e15)-(parseDay(b.t.deadline)||9e15));
}

/* Abonnements */
function projSync(){
  if(!PA.ready()) return;
  const a=adminUI();
  if(projUnsub&&projAsAdmin===a) return;
  if(projUnsub) projUnsub();
  projAsAdmin=a;
  projUnsub=PA.watchProjects(onProjects);
}
function onProjects(list){
  projects={};list.forEach(p=>{projects[p.id]=p;});
  const vis=new Set(visibleProjects().map(p=>p.id));
  Object.keys(taskUnsubs).forEach(pid=>{if(!vis.has(pid)){taskUnsubs[pid]();delete taskUnsubs[pid];delete ptasks[pid];}});
  vis.forEach(pid=>{if(!taskUnsubs[pid]) taskUnsubs[pid]=PA.watchTasks(pid,ts=>{ptasks[pid]={};ts.forEach(t=>{ptasks[pid][t.id]=t;});projRerender();});});
  if(projOpen&&!vis.has(projOpen)){projOpen=null;if(mode==="project")mode="projects";}
  projRerender();
}
function watchFilesFor(pid){
  if(filesFor===pid) return;
  if(filesUnsub) filesUnsub();
  filesFor=pid;
  filesUnsub=PA.watchFiles(pid,fs=>{pfiles[pid]={};fs.forEach(f=>{pfiles[pid][f.id]=f;});projRerender();});
}
function projRerender(){
  const n=myOpenTasks().length;
  $("projCnt").textContent=n||"";
  if(mode==="projects"||mode==="project") renderProjects();
  if(mode==="mine") renderDash();
}

/* Affichage */
/* ---------- Jalons et chronologie (Gantt) ---------- */
let projViewMode="grid";
const projStart=p=>parseDay(p.startDate)||p.createdAt||Date.now();
const projEnd=p=>p.deadline?parseDay(p.deadline)+DAY:null;
const msOf=p=>(Array.isArray(p.milestones)?p.milestones:[]).slice().sort((a,b)=>(parseDay(a.date)||0)-(parseDay(b.date)||0));
function projRow(p){
  const marks=msOf(p).filter(m=>m.date).map(m=>({t:parseDay(m.date),label:m.title,kind:"ms",done:m.done}))
    .concat(tasksOf(p.id).filter(t=>t.deadline).map(t=>({t:parseDay(t.deadline),label:t.title,kind:"tk",done:t.status==="terminee"})));
  return {label:p.title,sub:p.deadline?shortDate(p.deadline):"Sans date limite",start:projStart(p),end:projEnd(p),color:hashColor(p.id),pct:projProgress(p.id),done:p.status!=="actif"&&!!p.status,marks,attr:`data-openp="${esc(p.id)}"`};
}
function ganttHTML(rows,emptyMsg){
  if(!rows.length) return `<div class="card"><div class="empty">${emptyMsg}</div></div>`;
  const now=Date.now();let lo=now,hi=now;
  rows.forEach(r=>{lo=Math.min(lo,r.start);hi=Math.max(hi,r.end||now);(r.marks||[]).forEach(m=>{lo=Math.min(lo,m.t);hi=Math.max(hi,m.t);});});
  const a=new Date(lo),b=new Date(hi);const from=new Date(a.getFullYear(),a.getMonth(),1).getTime(),to=new Date(b.getFullYear(),b.getMonth()+1,1).getTime();
  const pos=t=>(Math.min(Math.max(t,from),to)-from)/(to-from)*100;
  let head="",lines="",nm=0;
  for(const d=new Date(from);d.getTime()<to;d.setMonth(d.getMonth()+1)){nm++;
    const x=pos(d.getTime()),w=pos(new Date(d.getFullYear(),d.getMonth()+1,1).getTime())-x;
    head+=`<div class="gm" style="left:${x}%;width:${w}%">${esc(d.toLocaleDateString(LOC(),{month:"short",year:(d.getMonth()===0||d.getTime()===from)?"2-digit":undefined}))}</div>`;
    lines+=`<i class="gline" style="left:${x}%"></i>`;}
  const nowL=now>=from&&now<=to?`<i class="gnow" style="left:${pos(now)}%" title="Aujourd'hui"></i>`:"";
  const body=rows.map(r=>{
    const x=pos(r.start),e=r.end?pos(r.end):100,w=Math.max(.8,e-x);
    const marks=(r.marks||[]).map(m=>`<span class="gmk ${m.kind}${m.done?" done":""}" style="left:${pos(m.t)}%" title="${esc(m.label)} · ${esc(new Date(m.t).toLocaleDateString(LOC(),{day:"numeric",month:"short"}))}"></span>`).join("");
    return `<div class="grow"><button class="glbl" ${r.attr||""}><b>${esc(r.label)}</b>${r.sub?`<small>${esc(r.sub)}</small>`:""}</button>
      <div class="gtrack">${lines}${nowL}<div class="gbar${r.end?"":" open"}${r.done?" done":""}" style="left:${x}%;width:${w}%;--c:${r.color}" title="${esc(r.label)}${r.pct!=null?" · "+r.pct+" %":""}"><span style="width:${r.pct||0}%"></span></div>${marks}</div></div>`;}).join("");
  return `<div class="card gantt"><div class="gscroll"><div class="gin" style="min-width:${Math.max(640,nm*72+180)}px">
    <div class="grow ghead"><div class="glbl"></div><div class="gtrack">${head}${nowL}</div></div>${body}</div></div>
    <div class="chleg"><span><i class="lg-bar"></i>Durée et avancement</span><span><i class="lg-ms"></i>Jalon</span><span><i class="lg-tk"></i>Échéance de tâche</span><span><i class="lg-now"></i>Aujourd'hui</span></div></div>`;
}
function projTimelineSec(p,ts,admin){
  const ms=msOf(p);
  const rows=[Object.assign(projRow(p),{attr:""})].concat(ts.filter(t=>t.deadline||t.createdAt).map(t=>({label:t.title,sub:TASK_ST[t.status]||"",start:t.createdAt||projStart(p),end:t.deadline?parseDay(t.deadline)+DAY:null,
    color:t.status==="terminee"?"var(--go)":t.status==="a_verifier"?"#D99A1E":hashColor(p.id),pct:t.status==="terminee"?100:(t.progress||0),done:t.status==="terminee",marks:[]})));
  const list=ms.length?ms.map(m=>`<div class="msrow"><label><input type="checkbox" data-msdone="${esc(m.id)}" ${m.done?"checked":""} ${admin?"":"disabled"}><span class="${m.done?"msdone":""}">${esc(m.title)}</span></label>${m.date?dueHTML(m.date,m.done):""}${admin?`<button class="btn ghost danger" data-msdel="${esc(m.id)}">${pendingDelete==="ms"+m.id?"Confirmer":"Retirer"}</button>`:""}</div>`).join("")
    :`<div class="empty">🏁 Aucun jalon pour l'instant.</div>`;
  return `<section><div class="sechead"><h2>Jalons</h2></div><div class="card"><div class="mslist">${list}</div>
    ${admin?`<div class="row msadd"><input type="text" id="msTitle" placeholder="Ex. Envoi des invitations" aria-label="Nom du jalon"><input type="date" id="msDate" aria-label="Date du jalon"><button class="btn" id="msAdd">Ajouter le jalon</button></div>`:""}</div></section>
    <section><div class="sechead"><h2>Chronologie</h2></div>${ganttHTML(rows,"")}</section>`;
}
function saveMilestones(p,ms,msg){PA.saveProject(p.id,Object.assign({},p,{milestones:ms,updatedAt:Date.now()})).then(()=>{if(msg)toast(msg);}).catch(()=>toast("Modification refusée"));}
function bindMilestones(p){
  const ms=msOf(p);
  if($("msAdd")) $("msAdd").onclick=()=>{const title=$("msTitle").value.trim(),date=$("msDate").value;
    if(!title||!date){toast("Indiquez le nom et la date du jalon.");return;}
    saveMilestones(p,ms.concat([{id:"m_"+uid(),title,date,done:false}]),"Jalon ajouté");};
  document.querySelectorAll("[data-msdone]").forEach(c=>c.onchange=()=>{if(!adminUI()){c.checked=!c.checked;return;}
    saveMilestones(p,ms.map(m=>m.id===c.dataset.msdone?Object.assign({},m,{done:c.checked}):m),c.checked?"Jalon atteint":null);});
  document.querySelectorAll("[data-msdel]").forEach(b=>b.onclick=()=>{const id=b.dataset.msdel;
    if(pendingDelete!=="ms"+id){pendingDelete="ms"+id;renderProjects();setTimeout(()=>{if(pendingDelete==="ms"+id){pendingDelete=null;renderProjects();}},4000);return;}
    pendingDelete=null;saveMilestones(p,ms.filter(m=>m.id!==id),"Jalon retiré");});
}
/* ---------- Tableau de bord graphique ---------- */
let chartWeeks=8;
function weekStartOf(t){const d=new Date(t);const st=new Date(d.getFullYear(),d.getMonth(),d.getDate());const ws=state.prefs&&state.prefs.week===0?0:1;st.setDate(st.getDate()-((st.getDay()-ws+7)%7));return st.getTime();}
function weekBuckets(n){const cur=weekStartOf(Date.now()),out=[];for(let i=n-1;i>=0;i--){const st=new Date(cur);st.setDate(st.getDate()-7*i);const en=new Date(st);en.setDate(en.getDate()+7);out.push({from:st.getTime(),to:en.getTime(),total:0,valid:0});}return out;}
function chartData(sources,n){
  const b=weekBuckets(n),from=b[0].from,proj={},ppl={};let total=0;
  sources.forEach(([pid,d])=>{if(!d||!d.sessions)return;allSessions(d).forEach(s=>{
    const ok=!s.live&&statusOf(pid,s)==="ok";
    b.forEach(w=>{const x=Math.min(s.end,w.to)-Math.max(s.start,w.from);if(x>0){w.total+=x;if(ok)w.valid+=x;}});
    const x=s.end-Math.max(s.start,from);if(x>0){const k=s.projectId&&projects[s.projectId]?s.projectId:"";proj[k]=(proj[k]||0)+x;ppl[pid]=(ppl[pid]||0)+x;total+=x;}
  });});
  return {b,proj,ppl,total};
}
function weekChartSVG(b){
  const n=b.length,W=Math.max(320,n*40+44),H=200,pl=40,pr=8,pt=12,pb=28,ih=H-pt-pb,iw=W-pl-pr;
  const maxH=Math.max(1,...b.map(w=>w.total/3600000));
  const step=maxH<=5?1:maxH<=10?2:maxH<=25?5:maxH<=50?10:maxH<=100?20:50,top=Math.ceil(maxH/step)*step;
  const y=h=>pt+ih-h/top*ih,slot=iw/n,bw=Math.min(28,slot*.62);let g="";
  for(let v=0;v<=top;v+=step) g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)" stroke-width="1"/><text x="${pl-6}" y="${y(v)+4}" text-anchor="end" class="chax">${v} h</text>`;
  const every=n>16?4:n>10?2:1,cur=weekStartOf(Date.now());
  b.forEach((w,i)=>{
    const x=pl+slot*i+(slot-bw)/2,ht=w.total/3600000,hv=w.valid/3600000;
    const lbl=new Date(w.from).toLocaleDateString(LOC(),{day:"numeric",month:"short"});
    g+=`<g><title>Semaine du ${esc(lbl)} : ${fmtDur(w.total)} (dont ${fmtDur(w.valid)} validées)</title>`;
    if(ht>0) g+=`<rect x="${x}" y="${y(ht)}" width="${bw}" height="${Math.max(1,y(0)-y(ht))}" rx="3" style="fill:var(--go);opacity:.3"/>`;
    if(hv>0) g+=`<rect x="${x}" y="${y(hv)}" width="${bw}" height="${Math.max(1,y(0)-y(hv))}" rx="3" style="fill:var(--go)"/>`;
    g+=`<rect x="${pl+slot*i}" y="${pt}" width="${slot}" height="${ih}" fill="transparent"/></g>`;
    if(i%every===0||i===n-1) g+=`<text x="${x+bw/2}" y="${H-8}" text-anchor="middle" class="chax${w.from===cur?" cur":""}">${esc(lbl)}</text>`;
  });
  const tot=b.reduce((m,w)=>m+w.total,0);
  return `<svg class="wchart${n>12?" wide":""}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Heures par semaine : ${esc(fmtDur(tot))} au total">${g}</svg>
  <div class="chleg"><span><i style="background:var(--go)"></i>Validées</span><span><i style="background:var(--go);opacity:.3"></i>En attente</span></div>`;
}
function hbarsHTML(map,total,label,color,empty){
  const ids=Object.keys(map).sort((a,c)=>map[c]-map[a]);if(!ids.length) return `<div class="empty">${empty}</div>`;
  const max=map[ids[0]]||1;
  return ids.slice(0,10).map(id=>{const c=color(id);return `<div class="bar"><div class="lbl"><span style="width:10px;height:10px;border-radius:50%;background:${c};flex:none"></span>${esc(label(id))}</div>
    <div class="track"><div class="fill" style="width:${map[id]/max*100}%;background:${c}"></div></div><div class="val">${fmtDur(map[id])}<small>${total?Math.round(map[id]/total*100):0} %</small></div></div>`;}).join("");
}
const projLbl=id=>id?projName(id):"Sans projet",projCol=id=>id?hashColor(id):"var(--muted)";
function chartRangeSync(){document.querySelectorAll(".chartRange button").forEach(b=>{b.setAttribute("aria-pressed",String(Number(b.dataset.w)===chartWeeks));b.onclick=()=>{chartWeeks=Number(b.dataset.w);render();};});}
function renderCharts(){
  chartRangeSync();const c=chartData([[curPid(),view()]],chartWeeks);
  $("chWeeks").innerHTML=weekChartSVG(c.b);
  $("chProj").innerHTML=hbarsHTML(c.proj,c.total,projLbl,projCol,"📊 Aucune heure sur cette période.");
}
function renderTeamCharts(){
  chartRangeSync();const src=Object.keys(team).map(id=>[id,id===myId?state:team[id]]);if(!team[myId]&&state)src.push([myId,state]);
  const c=chartData(src,chartWeeks);
  $("tchWeeks").innerHTML=weekChartSVG(c.b);
  $("tchPeople").innerHTML=hbarsHTML(c.ppl,c.total,id=>nameOf(id),id=>hashColor(id),"📊 Aucune heure sur cette période.");
  $("tchProj").innerHTML=hbarsHTML(c.proj,c.total,projLbl,projCol,"📊 Aucune heure sur cette période.");
}
/* ---------- Budget d'heures par projet ---------- */
let selectedProject="";
const projName=id=>id&&projects[id]?projects[id].title:"";
function projOptions(sel){
  const list=visibleProjects().filter(p=>(p.status||"actif")==="actif"||p.id===sel).sort((a,b)=>String(a.title).localeCompare(String(b.title)));
  return `<option value="">Aucun projet</option>`+list.map(p=>`<option value="${esc(p.id)}" ${p.id===sel?"selected":""}>${esc(p.title)}</option>`).join("");
}
function projHours(pid){
  const full=adminUI();const src=full?Object.assign({},team,{[myId]:state}):{[myId]:state};
  let total=0,valid=0,value=0;const per={};
  Object.entries(src).forEach(([who,d])=>{
    if(!d||!d.sessions) return;
    const list=d.sessions.filter(s=>s.projectId===pid);
    if(d.active&&d.active.projectId===pid) list.push({start:d.active.start,end:Date.now(),live:true});
    list.forEach(s=>{const ms=Math.max(0,s.end-s.start);total+=ms;per[who]=(per[who]||0)+ms;
      if(!s.live&&statusOf(who,s)==="ok"){valid+=ms;value+=moneyOf(ms,who);}});
  });
  return {total,valid,value,per,full};
}
function budgetHTML(p,big){
  const b=Number(p.budgetHours)||0,h=projHours(p.id);
  if(!b&&!h.total) return "";
  const hrs=h.total/3600000,pct=b?Math.round(hrs/b*100):0;
  const cls=!h.full||!b?"":pct>=100?"over":pct>=80?"warn":"";
  const flag=cls==="over"?`<span class="bflag over">⚠️ Budget dépassé de ${fmtDur(h.total-b*3600000)}</span>`:cls==="warn"?`<span class="bflag warn">${pct} % du budget utilisé</span>`:"";
  if(!h.full){
    return `<div class="bud"><div class="pmeta"><span>Mes heures sur ce projet : ${fmtDur(h.total)}</span>${b?`<span>Budget de l'équipe : ${b} h</span>`:""}</div></div>`;
  }
  let out=`<div class="bud ${cls}">${b?`<div class="prog"><div class="track"><div class="fill" style="width:${Math.min(100,pct)}%"></div></div><span>${fmtDur(h.total)} / ${b} h</span></div>`:`<div class="pmeta"><span>Heures pointées : ${fmtDur(h.total)}</span></div>`}${flag}`;
  if(big){
    const rest=b?b*3600000-h.total:0;
    out+=`<div class="pmeta" style="margin-top:6px"><span>Validées : ${fmtDur(h.valid)}</span>${b&&rest>0?`<span>Reste : ${fmtDur(rest)}</span>`:""}${h.value>0?`<span>Valeur estimée : ${fmtMoney(h.value)}</span>`:""}</div>`;
    const ppl=Object.keys(h.per).sort((a,c)=>h.per[c]-h.per[a]);
    if(ppl.length) out+=`<details class="bud-ppl"><summary>Heures par personne</summary>${ppl.map(id=>`<div class="pmeta"><span>${esc(pname(p,id))}</span><span>${fmtDur(h.per[id])}</span></div>`).join("")}</details>`;
  }
  return out+`</div>`;
}
function renderProjects(){
  const detail=mode==="project"&&projOpen&&projects[projOpen];
  $("projList").hidden=!!detail;$("projDetail").hidden=!detail;
  if(detail) return renderProjectDetail(projects[projOpen]);
  $("newProject").hidden=!adminUI();
  document.querySelectorAll("#projFilter button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.f===projFilter));
  // Mes tâches
  const mine=myOpenTasks();
  $("myTasks").innerHTML=mine.length?mine.map(({p,t})=>`<div class="mytask" data-openp="${esc(p.id)}" tabindex="0" style="--c:${hashColor(p.id)}">
      <div><b>${esc(t.title)}</b> <span class="tst ${t.status}">${TASK_ST[t.status]||""}</span><div class="sub">${esc(p.title)}</div></div>
      <div>${dueHTML(t.deadline,false)}</div></div>`).join("")
    :`<div class="empty">🎉 Aucune tâche en attente pour vous.</div>`;
  // Grille
  let list=visibleProjects();
  if(projFilter==="actifs") list=list.filter(p=>(p.status||"actif")==="actif");
  if(projFilter==="termines") list=list.filter(p=>p.status==="termine");
  list.sort((a,b)=>(parseDay(a.deadline)||9e15)-(parseDay(b.deadline)||9e15));
  $("projGrid").innerHTML=list.length?list.map(p=>{
    const ts=Object.values(ptasks[p.id]||{});const done=ts.filter(t=>t.status==="terminee").length;const pr=projProgress(p.id);
    return `<button class="pcard" data-openp="${esc(p.id)}" style="--c:${hashColor(p.id)}">
      <div class="pmeta"><span>${p.status==="termine"?"Terminé":p.status==="archive"?"Archivé":"En cours"}</span>${dueHTML(p.deadline,p.status==="termine")}</div>
      <h3>${esc(p.title)}</h3>
      ${p.description?`<div class="pdesc">${esc(p.description)}</div>`:""}
      <div class="prog"><div class="track"><div class="fill" style="width:${pr}%"></div></div><span>${pr} %</span></div>
      ${budgetHTML(p,false)}
      <div class="pmeta"><span>${done}/${ts.length} tâche${ts.length>1?"s":""} terminée${done>1?"s":""}</span>${avatarsHTML(p,p.memberIds||[])}</div>
    </button>`;}).join("")
    :`<div class="card"><div class="empty">${adminUI()?"📁 Aucun projet ici. Créez-en un avec « Nouveau projet ».":"📁 Vous ne faites encore partie d'aucun projet."}</div></div>`;
  $("projGrid").hidden=projViewMode==="gantt";$("projGantt").hidden=projViewMode!=="gantt";
  document.querySelectorAll("#projViewSeg button").forEach(b=>{b.setAttribute("aria-pressed",String(b.dataset.v===projViewMode));b.onclick=()=>{projViewMode=b.dataset.v;renderProjects();};});
  if(projViewMode==="gantt") $("projGantt").innerHTML=ganttHTML(list.map(projRow),adminUI()?"📁 Aucun projet ici. Créez-en un avec « Nouveau projet ».":"📁 Vous ne faites encore partie d'aucun projet.");
  document.querySelectorAll("[data-openp]").forEach(el=>{const go=()=>openProject(el.dataset.openp);el.onclick=go;el.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();go();}};});
}
function openProject(pid){projOpen=pid;mode="project";watchFilesFor(pid);render();window.scrollTo(0,0);}

function renderProjectDetail(p){
  const admin=adminUI();const ts=tasksOf(p.id);const pr=projProgress(p.id);
  const files=Object.values(pfiles[p.id]||{}).sort((a,b)=>b.at-a.at);
  const filesOf=tid=>files.filter(f=>f.taskId===tid);
  const fileHTML=f=>`<div class="file"><span class="fic">${fileIcon(f.type)}</span>
     <button class="fname" data-fopen="${esc(f.id)}">${esc(f.name)}</button>
     <span class="fsub">${fmtSize(f.size||0)} · ${esc(f.byName||pname(p,f.by))} · ${esc(dayLabel(f.at))}${f.taskId&&ptasks[p.id]&&ptasks[p.id][f.taskId]?"":""}</span>
     ${admin||f.by===myId?`<button class="btn ghost danger" data-fdel="${esc(f.id)}">${pendingDelete==="f"+f.id?"Confirmer":"Retirer"}</button>`:""}</div>`;
  $("projDetail").innerHTML=`
    <div class="phead" style="--c:${hashColor(p.id)}">
      <div class="row"><button class="btn" id="projBack">‹ Tous les projets</button>
        ${admin?`<div class="row"><button class="btn" id="projEdit">Modifier le projet</button><button class="btn ghost danger" id="projDel">${pendingProjDel===p.id?"Confirmer la suppression du projet":"Supprimer"}</button></div>`:""}</div>
      <div class="card" style="border-top:5px solid var(--c)">
        <div class="pmeta" style="margin-bottom:6px"><span>${p.status==="termine"?"Terminé":p.status==="archive"?"Archivé":"En cours"}</span>${dueHTML(p.deadline,p.status==="termine")}</div>
        <h2>${esc(p.title)}</h2>
        ${p.description?`<p class="tdesc" style="color:var(--muted);white-space:pre-wrap;margin:8px 0 0">${esc(p.description)}</p>`:""}
        <div class="prog" style="margin-top:14px"><div class="track"><div class="fill" style="width:${pr}%"></div></div><span>${pr} %</span></div>
        ${budgetHTML(p,true)}
        <div class="pmeta" style="margin-top:10px"><span>${(p.memberIds||[]).length} membre${(p.memberIds||[]).length>1?"s":""}</span>${avatarsHTML(p,p.memberIds||[],10)}</div>
      </div>
    </div>
    ${projTimelineSec(p,ts,admin)}
    <section>
      <div class="sechead"><h2>Tâches</h2>${admin?`<button class="btn in" id="newTask" style="border:none">Nouvelle tâche</button>`:""}</div>
      <div class="tasks">${ts.length?ts.map(t=>taskHTML(p,t,filesOf(t.id),fileHTML)).join(""):`<div class="card"><div class="empty">📝 Aucune tâche pour l'instant.</div></div>`}</div>
    </section>
    <section>
      <div class="sechead"><h2>Fichiers du projet</h2><span class="since">${files.length} fichier${files.length>1?"s":""}</span></div>
      <div class="card"><div class="files">${files.length?files.map(f=>{const t=ptasks[p.id]&&ptasks[p.id][f.taskId];return fileHTML(f).replace('<span class="fsub">',`<span class="fsub">${t?esc(t.title)+" · ":""}`);}).join(""):`<div class="empty">📂 Les preuves déposées dans les tâches apparaîtront ici.</div>`}</div></div>
    </section>`;
  bindProjectDetail(p);bindMilestones(p);
}
function taskHTML(p,t,files,fileHTML){
  const admin=adminUI();const mine=(t.assigneeIds||[]).includes(myId);
  const prog=t.status==="terminee"?100:(t.progress||0);
  const col={a_faire:"var(--line)",en_cours:"#4F7CFF",a_verifier:"#D98A1C",terminee:"var(--go)"}[t.status]||"var(--line)";
  const canUp=(admin||mine)&&t.status!=="terminee";
  let acts="";
  if(mine&&t.status==="a_faire") acts+=`<button class="btn" data-tst="en_cours" data-t="${t.id}">Commencer</button>`;
  if(mine&&(t.status==="a_faire"||t.status==="en_cours")) acts+=`<button class="btn in" style="border:none" data-tst="a_verifier" data-t="${t.id}">Soumettre pour vérification</button>`;
  if(admin&&t.status!=="terminee") acts+=`<button class="btn in" style="border:none" data-tst="terminee" data-t="${t.id}">Valider la tâche</button>`;
  if(admin&&t.status==="a_verifier") acts+=`<button class="btn" data-tst="en_cours" data-t="${t.id}">Renvoyer à la personne</button>`;
  if(admin&&t.status==="terminee") acts+=`<button class="btn" data-tst="en_cours" data-t="${t.id}">Rouvrir</button>`;
  if(admin) acts+=`<button class="btn ghost" data-tedit="${t.id}">Modifier</button><button class="btn ghost danger" data-tdel="${t.id}">${pendingDelete==="t"+t.id?"Confirmer":"Supprimer"}</button>`;
  const log=(t.log||[]).slice(-3).reverse();
  return `<div class="task ${t.status}" style="--tc:${col}">
    <div class="thead">
      <div class="ttitle"><b>${esc(t.title)}</b><span class="kind">${t.kind==="collective"?"Collective":"Individuelle"}</span><span class="tst ${t.status}">${TASK_ST[t.status]||""}</span></div>
      ${dueHTML(t.deadline,t.status==="terminee")}
    </div>
    ${t.description?`<div class="tdesc">${linkify(t.description)}</div>`:""}
    <div class="who">${avatarsHTML(p,t.assigneeIds||[])}<span>${(t.assigneeIds||[]).map(id=>esc(pname(p,id))).join(", ")||"Personne n'est assigné"}</span></div>
    <div class="prog" style="--c:${col==="var(--line)"?"var(--muted)":col}"><div class="track"><div class="fill" style="width:${prog}%"></div></div><span>${prog} %</span></div>
    ${mine&&(t.status==="a_faire"||t.status==="en_cours")?`<div class="row"><label for="rg_${t.id}" class="since" style="margin:0">Avancement</label><input type="range" min="0" max="100" step="10" value="${prog}" id="rg_${t.id}" data-tprog="${t.id}" aria-label="Avancement de la tâche"></div>`:""}
    ${files.length?`<div class="files">${files.map(fileHTML).join("")}</div>`:""}
    <div class="tacts">
      ${canUp?`<span class="btn upl">📎 Ajouter une preuve<input type="file" multiple data-tup="${t.id}" ${PA.accept?`accept="${PA.accept}"`:""} aria-label="Ajouter une preuve"></span>`:""}
      ${acts}
    </div>
    ${log.length?`<div class="tlog">${log.map(l=>`<span>${esc(dayLabel(l.at))} ${fmtTime(l.at)} · ${esc(l.byName||"")} ${esc(l.text)}</span>`).join("")}</div>`:""}
  </div>`;
}
function bindProjectDetail(p){
  $("projBack").onclick=()=>{mode="projects";projOpen=null;pendingProjDel=null;render();};
  if($("projEdit")) $("projEdit").onclick=()=>openProjDlg(p.id);
  if($("projDel")) $("projDel").onclick=async()=>{
    if(pendingProjDel!==p.id){pendingProjDel=p.id;renderProjects();setTimeout(()=>{if(pendingProjDel===p.id){pendingProjDel=null;renderProjects();}},4000);return;}
    pendingProjDel=null;
    try{await PA.deleteProject(p.id,Object.values(pfiles[p.id]||{}),Object.keys(ptasks[p.id]||{}));toast("Projet supprimé");mode="projects";projOpen=null;render();}
    catch(e){toast("Suppression impossible");}
  };
  if($("newTask")) $("newTask").onclick=()=>openTaskDlg(p.id,null);
  const T=id=>ptasks[p.id][id];
  document.querySelectorAll("[data-tst]").forEach(b=>b.onclick=()=>setTaskStatus(p,T(b.dataset.t),b.dataset.tst));
  document.querySelectorAll("[data-tprog]").forEach(r=>r.onchange=()=>{
    const t=T(r.dataset.tprog);const v=Number(r.value);
    PA.updateTask(p.id,t.id,{progress:v,status:t.status==="a_faire"&&v>0?"en_cours":t.status,updatedAt:Date.now(),log:addLog(t,"a mis l'avancement à "+v+" %")}).catch(()=>toast("Modification refusée"));
  });
  document.querySelectorAll("[data-tedit]").forEach(b=>b.onclick=()=>openTaskDlg(p.id,b.dataset.tedit));
  document.querySelectorAll("[data-tdel]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.tdel;
    if(pendingDelete!=="t"+id){pendingDelete="t"+id;renderProjects();setTimeout(()=>{if(pendingDelete==="t"+id){pendingDelete=null;renderProjects();}},4000);return;}
    pendingDelete=null;PA.deleteTask(p.id,id).then(()=>toast("Tâche supprimée")).catch(()=>toast("Suppression refusée"));
  });
  document.querySelectorAll("[data-tup]").forEach(inp=>inp.onchange=async()=>{
    const t=T(inp.dataset.tup);const list=[...inp.files];inp.value="";
    for(const f of list){
      if(f.size>PA.maxSize){toast("« "+f.name+" » dépasse "+fmtSize(PA.maxSize));continue;}
      toast("Envoi de « "+f.name+" »…");
      try{
        await PA.upload(p.id,t.id,f,{name:f.name,size:f.size,type:f.type||"",taskId:t.id,by:myId,byName:nameOf(myId),at:Date.now()});
        toast("Preuve ajoutée");
        if(!adminUI()) PA.updateTask(p.id,t.id,{updatedAt:Date.now(),status:t.status==="a_faire"?"en_cours":t.status,progress:t.progress||0,log:addLog(t,"a ajouté « "+f.name+" »")}).catch(()=>{});
      }catch(e){toast(uploadErr(e));}
    }
  });
  document.querySelectorAll("[data-fopen]").forEach(b=>b.onclick=()=>{const f=pfiles[p.id][b.dataset.fopen];PA.open(p.id,f).catch(()=>toast("Impossible d'ouvrir ce fichier"));});
  document.querySelectorAll("[data-fdel]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.fdel;
    if(pendingDelete!=="f"+id){pendingDelete="f"+id;renderProjects();setTimeout(()=>{if(pendingDelete==="f"+id){pendingDelete=null;renderProjects();}},4000);return;}
    pendingDelete=null;PA.deleteFile(p.id,pfiles[p.id][id]).then(()=>toast("Fichier retiré")).catch(()=>toast("Suppression refusée"));
  });
}
function addLog(t,text){return (t.log||[]).concat([{at:Date.now(),by:myId,byName:nameOf(myId),text}]).slice(-20);}
function setTaskStatus(p,t,st){
  const labels={en_cours:t.status==="terminee"?"a rouvert la tâche":t.status==="a_verifier"?"a renvoyé la tâche":"a commencé la tâche",a_verifier:"a soumis la tâche pour vérification",terminee:"a validé la tâche"};
  const part={status:st,updatedAt:Date.now(),log:addLog(t,labels[st]||"a changé l'état")};
  if(st==="a_verifier"||st==="terminee") part.progress=100;
  if(st==="en_cours"&&t.status==="terminee") part.progress=Math.min(t.progress||0,90);
  PA.updateTask(p.id,t.id,part).then(()=>toast(TASK_ST[st])).catch(()=>toast("Modification refusée"));
}

/* Fenêtres : projet */
function peopleForPick(){
  const ids=new Set(Object.keys(team));if(myId) ids.add(myId);
  return [...ids].sort((a,b)=>nameOf(a).localeCompare(nameOf(b),"fr"));
}
async function openProjDlg(pid){
  editingProj=pid;const p=pid?projects[pid]:null;
  $("projDlgTitle").textContent=p?"Modifier le projet":"Nouveau projet";
  $("pTitle").value=p?p.title:"";$("pDesc").value=p?p.description||"":"";
  $("pDeadline").value=p?p.deadline||"":"";$("pStart").value=p?p.startDate||"":"";$("pBudget").value=p&&p.budgetHours>0?p.budgetHours:"";$("pStatus").value=p?p.status||"actif":"actif";$("pErr").textContent="";
  const people=peopleForPick();await resolveNames(people);
  const sel=new Set(p?p.memberIds||[]:[myId]);
  $("pMembers").innerHTML=people.length?people.map(id=>`<label><input type="checkbox" value="${esc(id)}" ${sel.has(id)?"checked":""}>${esc(nameOf(id))}${id===myId?" (vous)":""}</label>`).join(""):`<span class="since">Aucun membre inscrit pour l'instant.</span>`;
  $("projDlg").showModal();
}
$("pCancel").onclick=()=>$("projDlg").close();
$("pSave").onclick=async()=>{
  const title=$("pTitle").value.trim();if(!title){$("pErr").textContent="Donnez un nom au projet.";return;}
  const picked=[...$("pMembers").querySelectorAll("input:checked")].map(i=>i.value);
  const pid=editingProj||("p_"+uid());const old=editingProj?projects[editingProj]:null;
  const assignees=Object.values(ptasks[pid]||{}).flatMap(t=>t.assigneeIds||[]);
  const memberIds=[...new Set([...picked,...assignees])];
  const memberNames={};memberIds.forEach(id=>{memberNames[id]=nameOf(id);});
  const data={title,description:$("pDesc").value.trim(),deadline:$("pDeadline").value||"",startDate:$("pStart").value||"",milestones:old&&Array.isArray(old.milestones)?old.milestones:[],status:$("pStatus").value,budgetHours:Math.max(0,Math.round(Number($("pBudget").value)||0)),memberIds,memberNames,
    createdBy:old?old.createdBy||myId:myId,createdAt:old?old.createdAt||Date.now():Date.now(),updatedAt:Date.now()};
  try{await PA.saveProject(pid,data);$("projDlg").close();toast(old?"Projet modifié":"Projet créé");if(!old)openProject(pid);}
  catch(e){$("pErr").textContent="Enregistrement refusé : accès administrateur requis.";}
};
$("newProject").onclick=()=>openProjDlg(null);
document.querySelectorAll("#projFilter button").forEach(b=>b.onclick=()=>{projFilter=b.dataset.f;renderProjects();});

/* Fenêtres : tâche */
async function openTaskDlg(pid,tid){
  editingTask={pid,tid};const p=projects[pid];const t=tid?ptasks[pid][tid]:null;
  $("taskDlgTitle").textContent=t?"Modifier la tâche":"Nouvelle tâche";
  $("tTitle").value=t?t.title:"";$("tDesc").value=t?t.description||"":"";$("tDeadline").value=t?t.deadline||"":(p.deadline||"");
  const kind=t?t.kind||"individuelle":"individuelle";
  document.querySelectorAll('input[name="tKind"]').forEach(r=>{r.checked=r.value===kind;});
  $("tErr").textContent="";
  const ids=[...new Set([...(p.memberIds||[]),...(t?t.assigneeIds||[]:[])])];
  await resolveNames(ids);
  const sel=new Set(t?t.assigneeIds||[]:[]);
  $("tAssignees").innerHTML=ids.length?ids.map(id=>`<label><input type="checkbox" value="${esc(id)}" ${sel.has(id)?"checked":""}>${esc(pname(p,id))}</label>`).join(""):`<span class="since">Ajoutez d'abord des membres au projet.</span>`;
  $("tAssignees").querySelectorAll("input").forEach(c=>c.onchange=()=>{
    const k=document.querySelector('input[name="tKind"]:checked').value;
    if(k==="individuelle"&&c.checked) $("tAssignees").querySelectorAll("input").forEach(o=>{if(o!==c)o.checked=false;});
  });
  $("taskDlg").showModal();
}
document.querySelectorAll('input[name="tKind"]').forEach(r=>r.onchange=()=>{
  if(r.value==="individuelle"&&r.checked){const on=[...$("tAssignees").querySelectorAll("input:checked")];on.slice(1).forEach(o=>{o.checked=false;});}
});
$("tCancel").onclick=()=>$("taskDlg").close();
$("tSave").onclick=async()=>{
  const {pid,tid}=editingTask;const p=projects[pid];const old=tid?ptasks[pid][tid]:null;
  const title=$("tTitle").value.trim();if(!title){$("tErr").textContent="Donnez un titre à la tâche.";return;}
  const kind=document.querySelector('input[name="tKind"]:checked').value;
  const assigneeIds=[...$("tAssignees").querySelectorAll("input:checked")].map(i=>i.value);
  if(!assigneeIds.length){$("tErr").textContent="Assignez la tâche à au moins une personne.";return;}
  if(kind==="individuelle"&&assigneeIds.length>1){$("tErr").textContent="Une tâche individuelle n'a qu'une seule personne.";return;}
  const id=tid||("t_"+uid());
  const data=Object.assign({},old||{status:"a_faire",progress:0,createdAt:Date.now(),log:[]},{title,description:$("tDesc").value.trim(),deadline:$("tDeadline").value||"",kind,assigneeIds,updatedAt:Date.now()});
  data.log=addLog(old||{log:[]},old?"a modifié la tâche":"a créé la tâche");
  try{
    await PA.saveTask(pid,id,data);
    const missing=assigneeIds.filter(a=>!(p.memberIds||[]).includes(a));
    if(missing.length||assigneeIds.some(a=>!(p.memberNames||{})[a])){
      const memberIds=[...new Set([...(p.memberIds||[]),...assigneeIds])];const memberNames=Object.assign({},p.memberNames||{});
      memberIds.forEach(m=>{if(!memberNames[m])memberNames[m]=nameOf(m);});
      await PA.saveProject(pid,Object.assign({},p,{memberIds,memberNames,updatedAt:Date.now()},{id:undefined}));
    }
    $("taskDlg").close();toast(old?"Tâche modifiée":"Tâche créée");
  }catch(e){$("tErr").textContent="Enregistrement refusé : accès administrateur requis.";}
};


/* ---------- Menu latéral ---------- */
(function(){
  const side=$("side"),scrim=$("scrim"),mq=window.matchMedia("(max-width: 760px)");
  let wide=false;try{wide=localStorage.getItem("pointeuse-nav")==="1";}catch(e){}
  const drawer=o=>{side.classList.toggle("open",o);scrim.hidden=!o;document.body.classList.toggle("noscroll",o);$("sideToggle").setAttribute("aria-expanded",String(o));};
  const apply=()=>{if(mq.matches){document.body.classList.remove("nav-wide");}else{drawer(false);document.body.classList.toggle("nav-wide",wide);$("sideToggle").setAttribute("aria-expanded",String(wide));}};
  $("sideToggle").onclick=()=>{if(mq.matches){drawer(false);return;}wide=!wide;try{localStorage.setItem("pointeuse-nav",wide?"1":"0");}catch(e){}apply();};
  $("mMenu").onclick=()=>drawer(true);
  scrim.onclick=()=>drawer(false);
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&side.classList.contains("open"))drawer(false);});
  side.querySelectorAll("#tabs button, .navbtn").forEach(b=>b.addEventListener("click",()=>{if(mq.matches)drawer(false);}));
  (mq.addEventListener?mq.addEventListener("change",apply):mq.addListener(apply));
  apply();
})();

/* ---------- Thème jour / nuit et couleur d'accent ---------- */
(function(){
  const $=id=>document.getElementById(id)||document.createElement("div");
  const root=document.documentElement,TK="pointeuse-theme",AK="pointeuse-accent",DEF="#F2A33A";
  const ACCENTS=[["#F2A33A","Orange du logo"],["#2FB7A0","Turquoise"],["#E4572E","Corail"],["#4F7CFF","Bleu"],["#8B5CF6","Violet"],["#D6457F","Framboise"],["#22A05B","Vert"],["#E3B505","Moutarde"]];
  const get=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
  const set=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v);}catch(e){}};
  const mq=window.matchMedia("(prefers-color-scheme: dark)");
  const SUN='<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>';
  const MOON='<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>';
  let pref=get(TK)||"auto";
  const isDark=()=>pref==="dark"||(pref==="auto"&&mq.matches);
  function applyTheme(){
    if(window.onAppearanceChange) setTimeout(window.onAppearanceChange,0);
    if(pref==="light"||pref==="dark") root.setAttribute("data-theme",pref); else root.removeAttribute("data-theme");
    const dark=isDark();
    // L'icône montre le mode vers lequel on bascule
    ["themeIco","themeQuickIco"].forEach(id=>{const el=$(id);if(el)el.innerHTML=dark?SUN:MOON;});
    $("themeLbl").textContent=dark?"Mode jour":"Mode nuit";
    $("themeBtn").title=$("themeQuick").ariaLabel=dark?"Passer en mode jour":"Passer en mode nuit";
    $("themeQuick").setAttribute("aria-label",dark?"Passer en mode jour":"Passer en mode nuit");
    document.querySelectorAll("#themeSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.th===pref));
    const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=dark?"#0A1122":"#14213D";
  }
  function inkFor(hex){const n=parseInt(hex.slice(1),16),r=n>>16&255,g=n>>8&255,b=n&255;return (0.299*r+0.587*g+0.114*b)/255>0.6?"#14213D":"#FFFFFF";}
  function favicon(c){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="44" fill="#14213D"/><g transform="translate(100 100) scale(.8125) translate(-100 -100)"><circle cx="100" cy="100" r="68" fill="none" stroke="#EEF1F5" stroke-width="26"/><line x1="100" y1="100" x2="160" y2="24" stroke="#14213D" stroke-width="54" stroke-linecap="round"/><polyline points="74,76 100,108 160,24" fill="none" stroke="${c}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
    const l=document.querySelector('link[rel="icon"]');if(l)l.href="data:image/svg+xml,"+encodeURIComponent(svg);
  }
  let accent=get(AK)||DEF;
  function applyAccent(c,save){
    if(window.onAppearanceChange) setTimeout(window.onAppearanceChange,0);
    if(!/^#[0-9a-fA-F]{6}$/.test(c)) c=DEF;
    accent=c.toUpperCase();
    root.style.setProperty("--accent",accent);root.style.setProperty("--accent-ink",inkFor(accent));
    favicon(accent);
    if(save) set(AK,accent===DEF?null:accent);
    $("accentCustom").value=accent.toLowerCase();
    document.querySelectorAll("#accentGrid button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.c===accent));
  }
  $("accentGrid").innerHTML=ACCENTS.map(([c,n])=>`<button data-c="${c}" style="background:${c}" aria-label="${n}" title="${n}"></button>`).join("");
  document.querySelectorAll("#accentGrid button").forEach(b=>b.onclick=()=>applyAccent(b.dataset.c,true));
  $("accentCustom").oninput=e=>applyAccent(e.target.value,true);
  $("accentReset").onclick=()=>{applyAccent(DEF,true);pref="auto";set(TK,null);applyTheme();};
  $("accentDone").onclick=()=>$("accentDlg").close();
  $("accentBtn").onclick=()=>$("accentDlg").showModal();
  document.querySelectorAll("#themeSeg button").forEach(b=>b.onclick=()=>{pref=b.dataset.th;set(TK,pref==="auto"?null:pref);applyTheme();});
  const toggle=()=>{pref=isDark()?"light":"dark";set(TK,pref);applyTheme();};
  $("themeBtn").onclick=toggle;$("themeQuick").onclick=toggle;
  (mq.addEventListener?mq.addEventListener("change",applyTheme):mq.addListener(applyTheme));
  window.Appearance={ACCENTS,DEF,getTheme:()=>pref,getAccent:()=>accent,
    setTheme:v=>{pref=v;set(TK,v==="auto"?null:v);applyTheme();},setAccent:c=>applyAccent(c,true)};
  applyAccent(accent,false);applyTheme();
})();

/* ---------- Chronomètre (icône) et tableau de bord ---------- */
function renderTimerBtn(){
  const a=state.active,b=$("timerBtn");
  b.classList.toggle("on",!!a);
  if(a){b.style.setProperty("--act",typeIn(state,a.typeId).color);$("tbTime").hidden=false;$("tbTime").textContent=fmtClock(Date.now()-a.start);b.setAttribute("aria-label","Chronomètre en cours : "+typeIn(state,a.typeId).name);}
  else{$("tbTime").hidden=true;b.setAttribute("aria-label","Ouvrir le chronomètre");}
}
function openTimer(o){
  $("timerPanel").hidden=!o;$("tscrim").hidden=!o;$("timerBtn").setAttribute("aria-expanded",String(o));
  if(o){renderClock();setTimeout(()=>{const f=$("timerPanel").querySelector("#inBtn,#outBtn");if(f)f.focus();},50);}
}
$("timerBtn").onclick=()=>openTimer($("timerPanel").hidden);
$("timerClose").onclick=()=>openTimer(false);
$("tscrim").onclick=()=>openTimer(false);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("timerPanel").hidden)openTimer(false);});
$("upAll").onclick=()=>{mode="calendar";render();};

function renderDash(){
  const d=view(),pid=curPid(),ro=readOnly(),own=!ro;
  const tday=totals(d,"day").total,tweek=totals(d,"week").total,tmonth=totals(d,"month").total;
  const vtot=Object.values(getValid(pid).entries).reduce((m,e)=>m+e.end-e.start,0);
  const pend=pendingCount(pid,d);
  const tiles=[];
  const a=d.active;
  if(a){const t=typeIn(d,a.typeId);
    tiles.push(`<button class="kpi live" ${own?'data-k="timer"':"disabled"} style="--act:${t.color}"><span class="k-lbl"><span class="dot on"></span>En service</span><span class="k-val" id="dashLive">${fmtClock(Date.now()-a.start)}</span><span class="k-sub">${esc(t.name)} · depuis ${fmtTime(a.start)}</span></button>`);}
  else tiles.push(`<button class="kpi" ${own?'data-k="timer"':"disabled"}><span class="k-lbl"><span class="dot"></span>Hors service</span><span class="k-val">—</span><span class="k-sub">${own?"Toucher pour pointer":"Aucune activité en cours"}</span></button>`);
  tiles.push(`<div class="kpi"><span class="k-lbl">Aujourd'hui</span><span class="k-val">${fmtDur(tday)}</span><span class="k-sub">${daySessions(d,startOfDay(Date.now())).length} entrée(s)</span></div>`);
  tiles.push(`<div class="kpi"><span class="k-lbl">Cette semaine</span><span class="k-val">${fmtDur(tweek)}</span><span class="k-sub">Ce mois-ci : ${fmtDur(tmonth)}</span></div>`);
  {const rt=rateOf(pid);if(rt>0)tiles.push(`<div class="kpi"><span class="k-lbl">Valeur du bénévolat</span><span class="k-val">${fmtMoney(moneyOf(vtot,pid))}</span><span class="k-sub">Heures validées × ${fmtMoney(rt)}/h</span></div>`);}
  tiles.push(`<div class="kpi"><span class="k-lbl">Heures validées</span><span class="k-val">${fmtDur(vtot)}</span><span class="k-sub">${pend?pend+" entrée"+(pend>1?"s":"")+" en attente":"Tout est validé"}</span></div>`);
  if(own){
    const mt=myOpenTasks();const late=mt.filter(x=>x.t.deadline&&parseDay(x.t.deadline)<startOfDay(Date.now())).length;
    tiles.push(`<button class="kpi" data-k="projects"><span class="k-lbl">Mes tâches</span><span class="k-val">${mt.length}</span><span class="k-sub ${late?"warn":""}">${late?late+" en retard":"Aucun retard"}</span></button>`);
  }
  if(own&&adminUI()){
    const ids=Object.keys(team);
    const onDuty=ids.filter(id=>team[id].active).length;
    const toVal=ids.reduce((m,id)=>m+pendingCount(id,team[id]),0);
    tiles.push(`<button class="kpi" data-k="team"><span class="k-lbl">Équipe en service</span><span class="k-val">${onDuty}</span><span class="k-sub">sur ${ids.length} personne${ids.length>1?"s":""}</span></button>`);
    tiles.push(`<button class="kpi" data-k="activities"><span class="k-lbl">À valider (équipe)</span><span class="k-val">${toVal}</span><span class="k-sub">${toVal?"entrées en attente":"Rien à valider"}</span></button>`);
  }
  $("kpis").innerHTML=tiles.join("");
  $("kpis").querySelectorAll("[data-k]").forEach(b=>b.onclick=()=>{const k=b.dataset.k;if(k==="timer")openTimer(true);else{mode=k;render();}});
  renderUpcoming(own);
}

/* ---------- Paramètres ---------- */
const UI_KEY="pointeuse-ui";
function uiPrefs(){try{return JSON.parse(localStorage.getItem(UI_KEY)||"{}")||{};}catch(e){return {};}}
function setUi(k,v){const u=uiPrefs();u[k]=v;try{localStorage.setItem(UI_KEY,JSON.stringify(u));}catch(e){}applyUi();}
function applyUi(){
  const u=uiPrefs();
  document.documentElement.style.fontSize={s:"14.5px",m:"",l:"17.5px"}[u.font||"m"];
  document.body.classList.toggle("comfy",u.density==="comfy");
  document.body.classList.toggle("nomotion",!!u.motion);
}
function prefs(){if(!state.prefs)state.prefs={};return state.prefs;}
function setPref(k,v){prefs()[k]=v;persist();render();}
function applyDefaultType(){const d=state.prefs&&state.prefs.defType;if(d&&state.types.some(t=>t.id===d&&!t.archived))selectedType=d;}
let remindedFor=null;
/* ---------- Pointage des présences aux réunions ---------- */
let pendingMeeting=null;const mtgCache={};
function mtgRefresh(){
  if(!EV.ready()||typeof events!=="object") return;const now=Date.now();
  Object.values(events).forEach(e=>{
    if(e.allDay||e.end>now||e.end<now-14*DAY) return;
    const c=mtgCache[e.id];if(c&&now-c.at<10*60000) return;
    mtgCache[e.id]={present:c?c.present:[],at:now};
    pvRef(e.id).get().then(sn=>{mtgCache[e.id]={present:sn.exists?(sn.data().present||[]):[],at:Date.now()};renderNotifSoon();}).catch(()=>{});
  });
}
function meetingEntry(e){
  if(!state.types.some(t=>!t.archived)){toast("Ajoutez d'abord un type d'activité");return;}
  mode="mine";viewingId=null;render();openDialog(null);
  const t=state.types.find(x=>!x.archived&&/r[ée]union/i.test(x.name));if(t)$("fType").value=t.id;
  $("fDate").value=dayKey(e.start);$("fStart").value=fmtTime(e.start);$("fEnd").value=fmtTime(e.end);
  $("fNote").value="Réunion : "+e.title;pendingMeeting=e.id;
}
function mtgItems(){
  const out=[];if(typeof events!=="object") return out;
  Object.entries(mtgCache).forEach(([eid,c])=>{const e=events[eid];
    if(!e||!c.present.includes(myId)||state.sessions.some(x=>x.meetingId===eid)) return;
    out.push({k:"mtg:"+eid,ico:"🗓️",txt:"Ajoutez vos heures de réunion : "+e.title,sub:dayLabel(e.start)+" · "+fmtTime(e.start)+" – "+fmtTime(e.end),go:()=>meetingEntry(e)});});
  return out;
}
/* ---------- Notifications ---------- */
const notifKey=()=>"pointeuse-notifs:"+(myId||"")+":"+(curOrg||"");
function notifStore(){try{const v=JSON.parse(localStorage.getItem(notifKey())||"null");if(v&&Array.isArray(v.seen))return{seen:v.seen,sys:Array.isArray(v.sys)?v.sys:[]};}catch(e){}return{seen:[],sys:[]};}
function notifSave(o){try{localStorage.setItem(notifKey(),JSON.stringify({seen:o.seen.slice(-300),sys:o.sys.slice(-300)}));}catch(e){}}
const goJournal=()=>{mode="activities";viewingId=null;render();setTimeout(()=>{const j=$("journalSec");if(j)j.scrollIntoView({behavior:"smooth"});},120);};
function notifItems(){
  const out=[];if(!curOrg||!myId) return out;
  const admin=adminUI(),now=Date.now();
  if(admin){
    let n=0,ppl=0;Object.keys(team).forEach(id=>{const d=team[id];if(!d||!d.sessions)return;const c=pendingCount(id,d);if(c){n+=c;ppl++;}});
    if(n) out.push({k:"val:"+n,ico:"✅",txt:`${n} entrée${n>1?"s":""} à valider`,sub:`${ppl} personne${ppl>1?"s":""}`,go:()=>{mode="activities";viewingId=null;render();}});
    visibleProjects().forEach(p=>{
      tasksOf(p.id).forEach(t=>{if(t.status==="a_verifier")out.push({k:"tv:"+t.id+":"+(t.updatedAt||0),ico:"🔎",txt:"Tâche à vérifier : "+t.title,sub:p.title,go:()=>openProject(p.id)});});
      const b=Number(p.budgetHours)||0;if(b&&(p.status||"actif")==="actif"){const h=projHours(p.id).total/3600000;
        if(h>=b) out.push({k:"bo:"+p.id+":"+b,ico:"⚠️",txt:"Budget dépassé : "+p.title,sub:`${fmtDur(h*3600000)} / ${b} h`,go:()=>openProject(p.id)});
        else if(h>=b*.8) out.push({k:"bw:"+p.id+":"+b,ico:"⏳",txt:"Budget presque atteint : "+p.title,sub:`${fmtDur(h*3600000)} / ${b} h`,go:()=>openProject(p.id)});}
    });
  }
  const rej=state.sessions.filter(x=>statusOf(myId,x)==="rejected");
  if(rej.length) out.push({k:"rej:"+rej.map(x=>x.id).join(","),ico:"↩️",txt:`${rej.length} entrée${rej.length>1?"s":""} refusée${rej.length>1?"s":""}`,sub:"Vérifiez-les dans votre journal.",go:goJournal});
  myOpenTasks().forEach(({p,t})=>{
    const late=t.deadline&&parseDay(t.deadline)<startOfDay(now);
    const last=(t.log||[]).slice(-1)[0];
    if(last&&last.by!==myId&&/a renvoyé la tâche/.test(last.text||"")) out.push({k:"back:"+t.id+":"+last.at,ico:"↩️",txt:"Tâche renvoyée : "+t.title,sub:p.title,go:()=>openProject(p.id)});
    else if(late) out.push({k:"late:"+t.id+":"+t.deadline,ico:"⏰",txt:"Tâche en retard : "+t.title,sub:p.title,go:()=>openProject(p.id)});
    else if(t.status==="a_faire") out.push({k:"new:"+t.id,ico:"📝",txt:"Nouvelle tâche : "+t.title,sub:p.title,go:()=>openProject(p.id)});
  });
  Object.values(typeof events==="object"&&events?events:{}).forEach(e=>{if(!hasVideo(e))return;const st=liveState(e);if(!st)return;
    out.push({k:"live:"+e.id+":"+st,ico:"🎥",txt:(st==="live"?"Réunion en cours : ":"Réunion bientôt : ")+e.title,sub:fmtTime(e.start)+" – "+fmtTime(e.end)+" · Rejoindre la salle vidéo",go:()=>window.open(roomUrl(e),"_blank","noopener")});});
  mtgRefresh();out.push(...mtgItems());
  const days=Number(prefs().nudge||0);
  if(days&&!state.active&&state.types.some(x=>!x.archived)){
    const lastEnd=state.sessions.reduce((m,x)=>Math.max(m,x.end),0);
    const idle=lastEnd?Math.floor((startOfDay(now)-startOfDay(lastEnd))/86400000):null;
    if(idle!==null&&idle>=days) out.push({k:"nudge:"+dayKey(now),ico:"🕒",txt:`Rien de pointé depuis ${idle} jours`,sub:"Ajoutez vos heures pendant que vous vous en souvenez.",go:goJournal});
  }
  return out;
}
let notifCache=[];
function notifRefresh(){
  notifCache=notifItems();const st=notifStore(),seen=new Set(st.seen);
  const unread=notifCache.filter(i=>!seen.has(i.k));
  const b=$("notifBadge");b.hidden=!unread.length;b.textContent=unread.length>9?"9+":String(unread.length);
  $("notifBtn").setAttribute("aria-label",unread.length?`Notifications (${unread.length} non lues)`:"Notifications");
  if(notifSysOn()&&document.hidden){const sent=new Set(st.sys);let ch=false;
    unread.filter(i=>!sent.has(i.k)).slice(0,3).forEach(i=>{try{const n=new Notification(tr("Pointeuse"),{body:tr(i.txt)+(i.sub?"\n"+tr(i.sub):""),tag:i.k});n.onclick=()=>{window.focus();i.go();n.close();};}catch(e){}st.sys.push(i.k);ch=true;});
    if(ch) notifSave(st);}
}
function notifOpen(){
  notifRefresh();const st=notifStore(),seen=new Set(st.seen);
  $("notifList").innerHTML=notifCache.length?notifCache.map((i,n)=>`<button class="nitem${seen.has(i.k)?"":" unread"}" data-ni="${n}"><span class="nico" aria-hidden="true">${i.ico}</span><span class="ntxt"><b>${esc(i.txt)}</b>${i.sub?`<span>${esc(i.sub)}</span>`:""}</span></button>`).join("")
    :`<div class="empty">🔔 Rien de nouveau pour l'instant.</div>`;
  $("notifList").querySelectorAll("[data-ni]").forEach(b=>b.onclick=()=>{$("notifDlg").close();notifCache[Number(b.dataset.ni)].go();});
  notifCache.forEach(i=>{if(!seen.has(i.k))st.seen.push(i.k);});notifSave(st);
  $("notifDlg").showModal();notifRefresh();
}
const notifSysOn=()=>{try{return "Notification" in window&&Notification.permission==="granted"&&localStorage.getItem("pointeuse-sysnotif")==="1";}catch(e){return false;}};
function notifSysLabel(){const b=$("sSysNotif");if(!("Notification" in window)){b.textContent="Non disponible sur ce navigateur";b.disabled=true;return;}
  b.disabled=Notification.permission==="denied";b.textContent=Notification.permission==="denied"?"Bloquées par le navigateur":notifSysOn()?"Désactiver":"Activer";}
$("sSysNotif").onclick=async()=>{
  if(!("Notification" in window)) return;
  if(notifSysOn()){try{localStorage.setItem("pointeuse-sysnotif","0");}catch(e){}notifSysLabel();toast("Notifications désactivées");return;}
  let p=Notification.permission;if(p==="default"){try{p=await Notification.requestPermission();}catch(e){}}
  if(p==="granted"){try{localStorage.setItem("pointeuse-sysnotif","1");}catch(e){}toast("Notifications activées");}
  notifSysLabel();
};
$("notifBtn").onclick=notifOpen;
$("notifClose").onclick=()=>$("notifDlg").close();
function checkReminder(){
  const h=Number(state.prefs&&state.prefs.remind||0),a=state.active;
  if(!h||!a||remindedFor===a.start) return;
  if(Date.now()-a.start>=h*3600000){remindedFor=a.start;toast("⏰ Votre chronomètre tourne depuis plus de "+h+" h. Pensez à pointer la sortie.",9000);}
}
function segSync(id,v){document.querySelectorAll("#"+id+" button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.v===String(v))));}
function renderSettings(){
  const A=window.Appearance,u=uiPrefs(),P=prefs();
  $("sName").readOnly=false;$("sNameHelp").textContent="Apparaît sur vos attestations et dans les projets.";
  $("sEmailRow").hidden=!myProfile.email;$("sEmail").textContent=myProfile.email||"";
  if(document.activeElement!==$("sName")) $("sName").value=myProfile.displayName||"";
  const pw=auth&&auth.currentUser&&auth.currentUser.providerData.some(x=>x.providerId==="password");$("sPwRow").hidden=!pw;
  $("sRole").textContent=myTitle();
  segSync("sTheme",A.getTheme());
  $("sAccent").innerHTML=A.ACCENTS.map(([c,n])=>`<button data-c="${c}" style="background:${c}" aria-label="${n}" title="${n}" aria-pressed="${c===A.getAccent()}"></button>`).join("");
  $("sAccent").querySelectorAll("button").forEach(b=>b.onclick=()=>A.setAccent(b.dataset.c));
  $("sAccentCustom").value=A.getAccent().toLowerCase();
  segSync("sFont",u.font||"m");segSync("sDensity",u.density||"compact");$("sMotion").checked=!!u.motion;
  const types=state.types.filter(t=>!t.archived);
  $("sDefType").innerHTML=`<option value="">Dernière utilisée</option>`+types.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join("");
  $("sDefType").value=P.defType&&types.some(t=>t.id===P.defType)?P.defType:"";
  segSync("sWeek",P.week===0?0:1);segSync("sDur",P.dur||"hm");$("sRemind").value=String(P.remind||0);$("sNudge").value=String(P.nudge||0);notifSysLabel();
  const admin=adminUI(),owner=(typeof isOwnerNow==="function")?isOwnerNow():isOwner;
  $("sOrgCard").hidden=!curOrg;$("sOrg").readOnly=!admin;
  $("sCodeRow").hidden=!admin;$("sRolesRow").hidden=!admin;$("sLeaveRow").hidden=owner;$("sDelOrgRow").hidden=!owner;
  $("sCode").textContent=fmtCode(orgCode);
  if(document.activeElement!==$("sOrg")) $("sOrg").value=org.orgName||"";
  $("sRate").readOnly=!admin;if(document.activeElement!==$("sRate")) $("sRate").value=org.hourlyValue||"";
}
window.onAppearanceChange=()=>{if(mode==="settings")renderSettings();};
document.querySelectorAll("#sTheme button").forEach(b=>b.onclick=()=>window.Appearance.setTheme(b.dataset.v));
$("sAccentCustom").oninput=e=>window.Appearance.setAccent(e.target.value);
document.querySelectorAll("#sFont button").forEach(b=>b.onclick=()=>{setUi("font",b.dataset.v);renderSettings();});
document.querySelectorAll("#sDensity button").forEach(b=>b.onclick=()=>{setUi("density",b.dataset.v);renderSettings();});
$("sMotion").onchange=()=>setUi("motion",$("sMotion").checked);
$("sDefType").onchange=()=>{const v=$("sDefType").value;setPref("defType",v||null);if(v&&!state.active)selectedType=v;toast("Préférence enregistrée");};
document.querySelectorAll("#sWeek button").forEach(b=>b.onclick=()=>{setPref("week",Number(b.dataset.v));toast("Préférence enregistrée");});
document.querySelectorAll("#sDur button").forEach(b=>b.onclick=()=>{setPref("dur",b.dataset.v);toast("Préférence enregistrée");});
$("sNudge").onchange=()=>{setPref("nudge",Number($("sNudge").value));toast("Préférence enregistrée");};
$("sRemind").onchange=()=>{setPref("remind",Number($("sRemind").value));remindedFor=null;toast("Préférence enregistrée");};
$("sRate").onchange=()=>{if(!adminUI())return;const v=Math.max(0,Number(String($("sRate").value).replace(",","."))||0);org.hourlyValue=Math.round(v*100)/100;saveOrg();render();toast("Valeur horaire enregistrée");};
$("sOrg").onchange=()=>{if(!adminUI())return;org.orgName=$("sOrg").value.trim();saveOrg();toast("Nom de l'organisation enregistré");};
$("sToRoles").onclick=()=>{mode="roles";render();};
$("sCsv").onclick=()=>{const keep=mode;mode="mine";$("exportCsv").click();mode=keep;};
$("sJson").onclick=()=>{
  const data={exporte_le:new Date().toISOString(),nom:nameOf(myId),types:state.types,entrees:state.sessions,en_cours:state.active,validations:getValid(myId),preferences:state.prefs||{}};
  const json=JSON.stringify(data,null,2),filename="mes-donnees-"+dayKey(Date.now())+".json";
  (async()=>{let dl=null;try{dl=window.claude&&window.claude.use?await window.claude.use("downloads"):null;}catch(e){}
    if(dl){try{await dl.save({filename,data:json});toast("Fichier téléchargé");}catch(e){if(e&&e.code!=="declined")toast("Le téléchargement a échoué");}return;}
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([json],{type:"application/json"}));a.download=filename;document.body.appendChild(a);a.click();a.remove();})();
};
$("sReset").onclick=()=>{
  try{localStorage.removeItem(UI_KEY);}catch(e){}
  window.Appearance.setTheme("auto");window.Appearance.setAccent(window.Appearance.DEF);
  state.prefs={};persist();applyUi();render();toast("Paramètres rétablis");
};
$("sName").onchange=()=>{const v=$("sName").value.trim();if(!v){$("sName").value=myProfile.displayName||"";return;}myProfile.displayName=v;persist();syncMyName();render();toast("Nom enregistré");};
$("sPw").onclick=async()=>{try{await auth.sendPasswordResetEmail(myProfile.email);toast("Courriel envoyé à "+myProfile.email,3500);}catch(e){toast("Envoi impossible pour le moment");}};
$("sOut").onclick=()=>auth.signOut().then(()=>location.reload());
/* ---------- Supprimer l'association (propriétaire seulement) ---------- */
// Efface une collection et ses sous-collections connues ; renvoie le nombre d'éléments refusés.
async function wipeCol(ref,tree){
  let fail=0,sn;try{sn=await ref.get();}catch(e){return 1;}
  for(const d of sn.docs){
    for(const k of Object.keys(tree||{})) fail+=await wipeCol(d.ref.collection(k),tree[k]);
    try{await d.ref.delete();}catch(e){fail++;}
  }
  return fail;
}
$("sDelOrg").onclick=()=>{
  if(!isOwnerNow()) return;
  $("doName").textContent=org.orgName||"";$("doConfirm").value="";$("doErr").textContent="";
  $("doOk").disabled=false;$("doOk").textContent="Supprimer définitivement";
  $("delOrgDlg").showModal();setTimeout(()=>$("doConfirm").focus(),50);
};
$("doCancel").onclick=()=>$("delOrgDlg").close();
$("doConfirm").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();$("doOk").click();}};
$("doOk").onclick=async()=>{
  const name=(org.orgName||"").trim(),typed=$("doConfirm").value.trim();
  if(!name||typed.toLocaleLowerCase()!==name.toLocaleLowerCase()){$("doErr").textContent="Le nom écrit ne correspond pas à celui de l'association.";return;}
  if(!isOwnerNow()||!curOrg) return;
  const id=curOrg,o=L.org(id),dlg=$("delOrgDlg");
  dlg.dataset.busy="1";$("doOk").disabled=true;$("doOk").textContent="Suppression en cours…";$("doErr").textContent="";
  clearTimeout(saveTimer);backend=null; // plus d'enregistrement automatique pendant l'effacement
  let fail=0;
  try{
    fail+=await wipeCol(o.collection("projects"),{tasks:{},files:{chunks:{}}});
    fail+=await wipeCol(o.collection("events"),{comments:{},minutes:{}});
    fail+=await wipeCol(o.collection("people"));
    fail+=await wipeCol(o.collection("validations"));
    fail+=await wipeCol(o.collection("members"));
    if(orgCode) await L.code(orgCode).delete().catch(()=>{fail++;});
    await o.delete(); // en dernier : les règles de sécurité s'appuient sur ce document
    if(fail) console.warn("Association supprimée ; éléments non effacés :",fail);
    myOrgIds=myOrgIds.filter(x=>x!==id);await saveIndex().catch(()=>{});
    toast("Association supprimée");setTimeout(()=>switchOrg(myOrgIds[0]||""),700);
  }catch(e){
    console.error(e);delete dlg.dataset.busy;
    $("doErr").textContent="Suppression refusée. Vérifiez votre connexion, puis réessayez.";
    $("doOk").disabled=false;$("doOk").textContent="Supprimer définitivement";
    setTimeout(()=>location.reload(),3500); // recharge un état propre (l'enregistrement automatique avait été coupé)
  }
};
$("doX").onclick=()=>$("delOrgDlg").close();
/* ---------- Activités : validation par l'administrateur ---------- */
const PEND_MAX=12;
function pendGroups(){
  const ids=[...new Set([myId,...Object.keys(team)])];
  return ids.map(pid=>{const d=pid===myId?state:team[pid];if(!d)return null;
    const list=d.sessions.filter(s=>{const st=statusOf(pid,s);return st==="pending"||st==="changed";}).sort((a,b)=>b.start-a.start);
    return list.length?{pid,d,list}:null;}).filter(Boolean).sort((a,b)=>b.list.length-a.list.length);
}
function renderPending(){
  const sec=$("pendSec"),on=adminUI()&&mode==="activities";
  sec.hidden=!on;if(!on) return;
  $("pendOrg").textContent=org.orgName?"· "+org.orgName:"";
  const groups=pendGroups(),total=groups.reduce((m,g)=>m+g.list.length,0);
  $("pendAll").hidden=!total;$("pendAll").textContent=total?`Tout valider (${total})`:"";
  const box=$("pendList");
  if(!total){box.innerHTML=`<div class="empty">✅ Tout est validé : aucune activité en attente dans l'association.</div>`;return;}
  box.innerHTML=groups.map((g,i)=>`<div class="day" style="${i===0?"margin-top:0":""}">
    <div class="dayhead"><span>${esc(nameOf(g.pid))} · ${g.list.length} en attente</span><span class="row" style="gap:6px">${g.pid!==myId?`<button class="btn ghost" data-popen="${esc(g.pid)}">Voir le journal</button>`:""}<button class="btn ghost ok" data-pall="${esc(g.pid)}">Tout valider</button></span></div>
    ${g.list.slice(0,PEND_MAX).map(s=>{const t=typeIn(g.d,s.typeId),st=statusOf(g.pid,s);
      return `<div class="entry" style="--c:${t.color}"><span class="sw" style="background:${t.color}"></span>
      <div class="what"><div>${esc(t.name)}<span class="st ${st}">${ST_LABEL[st]}</span></div><div class="n">${dayLabel(s.start)}</div>${s.projectId&&projName(s.projectId)?`<div class="n">📁 ${esc(projName(s.projectId))}</div>`:""}${s.note?`<div class="n">${esc(s.note)}</div>`:""}</div>
      <div class="hrs">${fmtTime(s.start)} – ${fmtTime(s.end)}</div><div class="dur">${fmtDur(s.end-s.start)}</div>
      <div class="acts"><button class="btn ghost ok" data-pval="${esc(g.pid)}|${esc(s.id)}">Valider</button><button class="btn ghost danger" data-pref="${esc(g.pid)}|${esc(s.id)}">Refuser</button></div></div>`;}).join("")}
    ${g.list.length>PEND_MAX?`<div class="since" style="padding:8px 4px">… et ${g.list.length-PEND_MAX} autre(s) dans son journal.</div>`:""}
  </div>`).join("");
  const find=k=>{const i=k.indexOf("|"),pid=k.slice(0,i),sid=k.slice(i+1),d=pid===myId?state:team[pid];return{pid,d,s:d&&d.sessions.find(x=>x.id===sid)};};
  box.querySelectorAll("[data-pval]").forEach(b=>b.onclick=()=>{const {pid,d,s}=find(b.dataset.pval);if(s){validateSessions(pid,d,[s]);toast("Entrée validée");}});
  box.querySelectorAll("[data-pref]").forEach(b=>b.onclick=()=>{const {pid,s}=find(b.dataset.pref);if(s){writeValid(pid,v=>{v.rejected[s.id]={start:s.start,end:s.end,by:myId,at:Date.now()};delete v.entries[s.id];});toast("Entrée refusée");}});
  box.querySelectorAll("[data-pall]").forEach(b=>b.onclick=()=>{const g=groups.find(x=>x.pid===b.dataset.pall);if(g){validateSessions(g.pid,g.d,g.list);toast(`${g.list.length} entrée(s) validée(s)`);}});
  box.querySelectorAll("[data-popen]").forEach(b=>b.onclick=()=>openPerson(b.dataset.popen));
}
$("pendAll").onclick=()=>{const gs=pendGroups();let n=0;gs.forEach(g=>{validateSessions(g.pid,g.d,g.list);n+=g.list.length;});if(n)toast(`${n} entrée(s) validée(s)`);};
/* ---------- Supprimer mon compte ---------- */
const myProviders=()=>{const u=auth&&auth.currentUser;return u?u.providerData.map(x=>x.providerId):[];};
$("sDelete").onclick=()=>{
  const owned=myOrgIds.filter(id=>orgsInfo[id]&&orgsInfo[id].owner).map(id=>orgsInfo[id].name);
  const pv=myProviders(),pw=pv.includes("password");
  $("dOwned").hidden=!owned.length;
  $("dOwned").textContent=owned.length?`Vous êtes propriétaire de : ${owned.join(", ")}. Supprimez d'abord ces associations (Paramètres › Association) : une association ne peut pas rester sans propriétaire.`:"";
  $("dPassField").hidden=!pw;$("dGoogle").hidden=pw||!pv.includes("google.com");
  $("dPass").value="";$("dConfirm").value="";$("dErr").textContent="";
  $("dOk").disabled=!!owned.length;$("dOk").textContent="Supprimer définitivement";
  $("delDlg").showModal();setTimeout(()=>(pw?$("dPass"):$("dConfirm")).focus(),50);
};
$("dCancel").onclick=()=>$("delDlg").close();
$("dOk").onclick=async()=>{
  const word=$("dConfirm").value.trim().toUpperCase();
  if(word!=="SUPPRIMER"&&word!=="DELETE"){$("dErr").textContent="Écrivez SUPPRIMER pour confirmer.";return;}
  const u=auth&&auth.currentUser;if(!u) return;
  const pv=myProviders(),dlg=$("delDlg");
  if(pv.includes("password")&&!$("dPass").value){$("dErr").textContent="Entrez votre mot de passe actuel.";return;}
  $("dErr").textContent="";$("dOk").disabled=true;$("dOk").textContent="Suppression en cours…";dlg.dataset.busy="1";
  try{
    // 1. Firebase exige une connexion récente : on confirme l'identité AVANT d'effacer quoi que ce soit.
    if(pv.includes("password")) await u.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(u.email,$("dPass").value));
    else if(pv.includes("google.com")) await u.reauthenticateWithPopup(new firebase.auth.GoogleAuthProvider());
    // 2. Plus aucun enregistrement automatique, puis effacement des données personnelles.
    clearTimeout(saveTimer);backend=null;
    for(const id of myOrgIds.slice()){
      if(orgsInfo[id]&&orgsInfo[id].owner) continue;
      await L.org(id).collection("people").doc(myId).delete().catch(()=>{});
      await L.members(id).doc(myId).delete().catch(()=>{});
    }
    await L.idx().delete().catch(()=>{});
    // 3. Suppression du compte lui-même.
    await u.delete();
    // 4. Nettoyage de cet appareil.
    try{Object.keys(localStorage).filter(k=>k.endsWith(":"+myId)).forEach(k=>localStorage.removeItem(k));localStorage.removeItem(ORG_KEY);}catch(e){}
    toast("Compte supprimé");setTimeout(()=>location.reload(),800);
  }catch(e){
    const c=e&&e.code;
    $("dErr").textContent=(c==="auth/wrong-password"||c==="auth/invalid-credential")?"Mot de passe incorrect."
      :(c==="auth/popup-closed-by-user"||c==="auth/cancelled-popup-request")?"La fenêtre de confirmation a été fermée."
      :c==="auth/user-mismatch"?"Utilisez le même compte Google que celui de la Pointeuse."
      :(AUTH_ERR[c]||"Suppression impossible pour le moment. Réessayez plus tard.");
    $("dOk").disabled=false;$("dOk").textContent="Supprimer définitivement";
  }finally{delete dlg.dataset.busy;}
};
applyUi();


$("homeLink").onclick=()=>{mode="mine";viewingId=null;projOpen=null;journalLimit=14;render();window.scrollTo({top:0,behavior:"smooth"});
  if(window.matchMedia("(max-width: 760px)").matches){$("side").classList.remove("open");$("scrim").hidden=true;document.body.classList.remove("noscroll");}};

/* ---------- Associations : interface ---------- */
let orgsLoaded=false,orgDlgMode="create";
const orgInitials=n=>{const w=String(n||"?").split(/[\s\-']+/).filter(Boolean);const big=w.filter(x=>x.length>2||/^[A-Z]{2,}$/.test(x));const use=(big.length?big:w).slice(0,2);return use.length===1&&/^[A-Z]{2,}$/.test(use[0])?use[0].slice(0,3):use.map(x=>x[0].toUpperCase()).join("");};
function renderOrgs(){
  $("orgSec").hidden=mode==="person";
  const list=myOrgIds.map(id=>orgsInfo[id]).filter(Boolean);
  $("orgList").innerHTML=list.length?list.map(o=>{const bn=o.banner||{},col=bn.color||hashColor(o.id),cur=o.id===curOrg;
      return `<div class="orgcard ${cur?"cur":""}" style="--oc:${esc(col)}">
      <button class="org-open" data-org="${esc(o.id)}" ${cur?'aria-current="true"':""} aria-label="${esc(o.name)}${cur?" (actuelle)":""}">
        <span class="org-ban" ${bn.image?`style="background-image:url('${bn.image}')"`:""}></span>
        <span class="org-body">${bn.icon?`<span class="org-av img" style="background-image:url('${bn.icon}')" aria-hidden="true"></span>`:`<span class="org-av">${esc(orgInitials(o.name))}</span>`}
          <span class="org-txt"><b>${esc(o.name)}</b><span>${esc(bn.tagline||o.role||"Membre")}</span>${bn.tagline?`<span class="org-role">${esc(o.role||"Membre")}</span>`:""}</span>
          ${cur?'<span class="org-cur">Actuelle</span>':'<span class="org-go">Ouvrir ›</span>'}</span>
      </button>
      ${o.admin&&!o.migratedOnly?`<button class="org-edit" data-oedit="${esc(o.id)}" title="Modifier la bannière" aria-label="Modifier la bannière de ${esc(o.name)}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4.2L19 9.2 14.8 5 4 15.8z"/><path d="M13 6.8l4.2 4.2"/></svg></button>`:""}
    </div>`;}).join("")
    :(orgsLoaded?`<div class="card org-empty"><b>Bienvenue !</b><p>Vous ne faites partie d'aucune association pour l'instant. Créez la vôtre, ou rejoignez celle de votre groupe avec le code d'invitation qu'on vous a transmis.</p></div>`:"");
  $("orgList").querySelectorAll("[data-org]").forEach(b=>b.onclick=()=>{if(b.dataset.org!==curOrg){b.closest(".orgcard").classList.add("loading");switchOrg(b.dataset.org);}});
  $("orgList").querySelectorAll("[data-oedit]").forEach(b=>b.onclick=e=>{e.stopPropagation();openBannerDlg(b.dataset.oedit);});
}
function openOrgDlg(m){
  orgDlgMode=m;const c=m==="create";
  $("orgDlgTitle").textContent=c?"Créer une association":"Rejoindre une association";
  $("oNameField").hidden=!c;$("oCodeField").hidden=c;
  $("oHelp").textContent=c?"Vous en deviendrez président·e. Un code d'invitation sera créé pour y ajouter des membres.":"Demandez le code à un·e administrateur·rice de l'association.";
  $("oOk").textContent=c?"Créer":"Rejoindre";$("oErr").textContent="";$("oName").value="";$("oCode").value="";
  $("orgDlg").showModal();setTimeout(()=>(c?$("oName"):$("oCode")).focus(),50);
}
$("newOrgBtn").onclick=()=>openOrgDlg("create");
$("joinOrgBtn").onclick=()=>openOrgDlg("join");
$("oCancel").onclick=()=>$("orgDlg").close();
$("oCode").oninput=e=>{const n=normCode(e.target.value).slice(0,8);e.target.value=n.length>4?n.slice(0,4)+"-"+n.slice(4):n;};
[$("oName"),$("oCode")].forEach(i=>i.onkeydown=e=>{if(e.key==="Enter")$("oOk").click();});
$("oOk").onclick=async()=>{
  $("oErr").textContent="";
  if(!myId){$("oErr").textContent="Connexion en cours, réessayez dans un instant.";return;}
  const btn=$("oOk");btn.disabled=true;
  try{
    if(orgDlgMode==="create"){const n=$("oName").value.trim();if(!n){$("oErr").textContent="Donnez un nom à l'association.";btn.disabled=false;return;}await createOrg(n);}
    else await joinOrg($("oCode").value);
  }catch(e){
    $("oErr").textContent=e&&e.code==="invalid"?"Ce code ne correspond à aucune association. Vérifiez-le auprès de la personne qui vous l'a transmis.":"Opération impossible pour le moment. Réessayez.";
    btn.disabled=false;
  }
};
$("sCopyCode").onclick=async()=>{
  const t=fmtCode(orgCode);
  try{await navigator.clipboard.writeText(t);toast("Code copié : "+t);}
  catch(e){const r=document.createRange();r.selectNodeContents($("sCode"));const sel=getSelection();sel.removeAllRanges();sel.addRange(r);toast("Code sélectionné : copiez-le avec Ctrl+C");}
};
let codeConfirm=false,leaveConfirm=false;
$("sNewCode").onclick=async()=>{
  if(!codeConfirm){codeConfirm=true;$("sNewCode").textContent="Confirmer (l'ancien code ne marchera plus)";setTimeout(()=>{codeConfirm=false;$("sNewCode").textContent="Nouveau code";},5000);return;}
  codeConfirm=false;$("sNewCode").textContent="Nouveau code";
  try{await regenCode();renderSettings();toast("Nouveau code : "+fmtCode(orgCode));}catch(e){toast("Impossible de changer le code");}
};
$("sLeave").onclick=async()=>{
  if(!leaveConfirm){leaveConfirm=true;$("sLeave").textContent="Confirmer le départ";setTimeout(()=>{leaveConfirm=false;$("sLeave").textContent="Quitter";},5000);return;}
  try{await leaveOrg();}catch(e){toast(e&&e.code==="owner"?"La personne propriétaire ne peut pas quitter son association.":"Impossible de quitter pour le moment");}
};

/* ---------- Bannière des associations ---------- */
let banEdit=null;
function banPreview(){
  const b=banEdit;if(!b)return;
  $("bPrev").style.setProperty("--oc",b.color);
  $("bPrevBan").style.backgroundImage=b.image?`url('${b.image}')`:"";
  $("bPrevAv").textContent=b.icon?"":orgInitials($("bName").value||"?");
  $("bPrevAv").classList.toggle("img",!!b.icon);$("bPrevAv").style.backgroundImage=b.icon?`url('${b.icon}')`:"";$("bIconDel").hidden=!b.icon;
  $("bPrevName").textContent=$("bName").value||"Nom de l'association";
  $("bPrevTag").textContent=$("bTag").value||(orgsInfo[b.id]&&orgsInfo[b.id].role)||"";
  $("bColors").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.c.toLowerCase()===b.color.toLowerCase()));
  $("bColor").value=b.color;$("bImgDel").hidden=!b.image;
}
function openBannerDlg(id){
  const o=orgsInfo[id];if(!o)return;const bn=o.banner||{};
  banEdit={id,color:bn.color||hashColor(id),image:bn.image||"",icon:bn.icon||""};
  $("bName").value=o.name||"";$("bTag").value=bn.tagline||"";$("bErr").textContent="";
  $("bColors").innerHTML=COLORS.concat(["#14213D"]).map(c=>`<button data-c="${c}" style="background:${c}" aria-label="Couleur ${c}"></button>`).join("");
  $("bColors").querySelectorAll("button").forEach(x=>x.onclick=()=>{banEdit.color=x.dataset.c;banPreview();});
  banPreview();$("banDlg").showModal();
}
$("bName").oninput=banPreview;$("bTag").oninput=banPreview;
$("bColor").oninput=e=>{banEdit.color=e.target.value;banPreview();};
$("bImgDel").onclick=()=>{banEdit.image="";banPreview();};
$("bIconDel").onclick=()=>{banEdit.icon="";banPreview();};
function shrinkIcon(file){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      const S=160,c=document.createElement("canvas");c.width=S;c.height=S;const g=c.getContext("2d");
      const w=img.naturalWidth||img.width||S,h=img.naturalHeight||img.height||S,r=Math.max(S/w,S/h);
      g.drawImage(img,(S-w*r)/2,(S-h*r)/2,w*r,h*r);URL.revokeObjectURL(url);
      let d=c.toDataURL("image/png");
      if(d.length>70000){const c2=document.createElement("canvas");c2.width=S;c2.height=S;const g2=c2.getContext("2d");g2.fillStyle="#fff";g2.fillRect(0,0,S,S);g2.drawImage(c,0,0);d=c2.toDataURL("image/jpeg",.85);}
      res(d);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("image"));};
    img.src=url;
  });
}
$("bIcon").onchange=async()=>{
  const f=$("bIcon").files[0];$("bIcon").value="";if(!f)return;$("bErr").textContent="";
  try{banEdit.icon=await shrinkIcon(f);banPreview();}catch(e){$("bErr").textContent="Cette image n'a pas pu être lue. Essayez un fichier PNG ou JPG.";}
};
$("bCancel").onclick=()=>$("banDlg").close();
function shrinkImage(file){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      const W=720,H=240,c=document.createElement("canvas");c.width=W;c.height=H;const g=c.getContext("2d");
      const r=Math.max(W/img.width,H/img.height),w=img.width*r,h=img.height*r;
      g.drawImage(img,(W-w)/2,(H-h)/2,w,h);URL.revokeObjectURL(url);
      let q=.82,d=c.toDataURL("image/jpeg",q);while(d.length>150000&&q>.4){q-=.12;d=c.toDataURL("image/jpeg",q);}
      res(d);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("image"));};
    img.src=url;
  });
}
$("bImg").onchange=async()=>{
  const f=$("bImg").files[0];$("bImg").value="";if(!f)return;
  $("bErr").textContent="";
  try{banEdit.image=await shrinkImage(f);banPreview();}catch(e){$("bErr").textContent="Cette image n'a pas pu être lue. Essayez un fichier JPG ou PNG.";}
};
$("bSave").onclick=async()=>{
  const b=banEdit,name=$("bName").value.trim();
  if(!name){$("bErr").textContent="Donnez un nom à l'association.";return;}
  const banner={color:b.color,tagline:$("bTag").value.trim(),image:b.image||"",icon:b.icon||""};
  $("bSave").disabled=true;
  try{
    await L.org(b.id).update({name,banner});
    const o=orgsInfo[b.id];if(o){o.name=name;o.banner=banner;if(o.code)L.code(o.code).update({name}).catch(()=>{});}
    if(b.id===curOrg){org.orgName=name;}
    $("banDlg").close();render();toast("Bannière mise à jour");
  }catch(e){$("bErr").textContent="Enregistrement refusé : il faut être administrateur de cette association.";}
  $("bSave").disabled=false;
};
/* ---------- Stockage du calendrier (Firebase) ---------- */
const EV={ready:()=>!!fdb&&!!myId&&!!curOrg,col:()=>fdb.collection("orgs").doc(curOrg).collection("events"),comments:eid=>fdb.collection("orgs").doc(curOrg).collection("events").doc(eid).collection("comments")};
function saveIcs(filename,text){
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/calendar;charset=utf-8"}));a.download=filename;
  document.body.appendChild(a);a.click();a.remove();toast("Calendrier téléchargé");
}

/* ---------- Calendrier ---------- */
const EV_TYPES={reunion:["Réunion","#4F7CFF"],evenement:["Événement","var(--accent)"],formation:["Formation","#2FB7A0"],autre:["Autre","#8B5CF6"]};
const DL_COLOR="#E4572E";
let events={},calUnsub=null,calOrg=null,calMonth=null,calSel=null,calMode=null,editingEv=null,viewingEv=null;
function calSync(){
  if(!EV.ready()||calOrg===curOrg) return;
  if(calUnsub) calUnsub();
  calOrg=curOrg;
  calUnsub=EV.col().onSnapshot(sn=>{events={};sn.docs.forEach(d=>{events[d.id]=normEvent(Object.assign({},d.data(),{id:d.id}));});if(mode==="calendar")renderCalendar();if(mode==="mine")renderDash();},()=>{});
}
const weekStart=()=>state.prefs&&state.prefs.week===0?0:1;
function calItems(from,to){
  const out=[];
  Object.values(events).forEach(e=>{const end=e.end||(e.start+DAY);if(e.start<to&&end>from)out.push({kind:"event",e,start:e.start,end,allDay:!!e.allDay,title:e.title,color:(EV_TYPES[e.type]||EV_TYPES.autre)[1]});});
  visibleProjects().forEach(p=>{
    if(p.status==="archive") return;
    if(p.deadline){const d=parseDay(p.deadline);if(d>=from&&d<to)out.push({kind:"deadline",pid:p.id,start:d,end:d+DAY,allDay:true,title:"Échéance : "+p.title,color:DL_COLOR,done:p.status==="termine"});}
    tasksOf(p.id).forEach(t=>{if(!t.deadline||t.status==="terminee")return;const d=parseDay(t.deadline);if(d>=from&&d<to)out.push({kind:"task",pid:p.id,start:d,end:d+DAY,allDay:true,title:t.title,sub:p.title,color:DL_COLOR,mine:(t.assigneeIds||[]).includes(myId)});});
  });
  return out.sort((a,b)=>(b.allDay-a.allDay)||a.start-b.start);
}
const monthLabel=t=>cap(new Date(t).toLocaleDateString(LOC(),{month:"long",year:"numeric"}));
function itemChip(it){
  const time=it.kind==="event"&&!it.allDay?fmtTime(it.start)+" ":"";
  const ico=it.kind==="event"?(it.e.icon?it.e.icon+" ":""):"⚑ ";
  return `<button class="cal-chip ${it.kind!=="event"?"dl":""}" style="--c:${it.color}" ${it.kind==="event"?`data-ev="${esc(it.e.id)}"`:`data-pj="${esc(it.pid)}"`} title="${esc(it.title)}">${ico}${esc(time+it.title)}</button>`;
}
function renderCalendar(){
  $("calTz").textContent="Heures affichées dans votre fuseau horaire : "+tzLabel();
  if(calMonth===null){const n=new Date();calMonth=new Date(n.getFullYear(),n.getMonth(),1).getTime();calSel=startOfDay(Date.now());}
  if(calMode===null) calMode=window.matchMedia("(max-width: 760px)").matches?"list":"month";
  const admin=adminUI();
  $("calNew").hidden=!admin;$("calDayAdd").hidden=!admin;$("syncImportOpt").hidden=!admin;
  document.querySelectorAll("#calMode button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===calMode));
  $("calTitle").textContent=monthLabel(calMonth);
  const m0=new Date(calMonth),y=m0.getFullYear(),mo=m0.getMonth();
  const mStart=calMonth,mEnd=new Date(y,mo+1,1).getTime();
  if(calMode==="month"){
    const ws=weekStart(),off=(m0.getDay()-ws+7)%7,dim=new Date(y,mo+1,0).getDate(),weeks=Math.ceil((off+dim)/7);
    const gStart=addDays(mStart,-off),gEnd=addDays(gStart,weeks*7);
    const items=calItems(gStart,gEnd);const today=startOfDay(Date.now());
    const names=[...Array(7)].map((_,i)=>new Date(2024,0,7+((i+ws)%7)).toLocaleDateString(LOC(),{weekday:"short"}).replace(".",""));
    let h=`<div class="cal-month">${names.map(n=>`<div class="cal-wd">${esc(cap(n))}</div>`).join("")}`;
    for(let i=0;i<weeks*7;i++){
      const d=addDays(gStart,i),de=addDays(d,1),its=items.filter(x=>x.start<de&&x.end>d);
      const cls=["cal-cell",new Date(d).getMonth()!==mo?"out":"",d===today?"today":"",d===calSel?"sel":""].join(" ");
      h+=`<div class="${cls}" data-day="${d}" tabindex="0" role="button" aria-label="${esc(dayLabel(d))}, ${its.length} élément(s)">
        <span class="cal-num">${new Date(d).getDate()}</span>
        <div class="cal-chips">${its.slice(0,3).map(itemChip).join("")}${its.length>3?`<span class="cal-more">+${its.length-3}</span>`:""}</div>
        <div class="cal-dots">${its.slice(0,4).map(x=>`<i style="background:${x.color}"></i>`).join("")}</div>
      </div>`;
    }
    $("calGrid").innerHTML=h+"</div>";
    $("calDaySec").hidden=false;renderCalDay();
  }else{
    const items=calItems(mStart,mEnd);const groups={};
    items.forEach(it=>{for(let d=Math.max(startOfDay(it.start),mStart);d<Math.min(it.end,mEnd);d=addDays(d,1)){(groups[d]=groups[d]||[]).push(it);}});
    const days=Object.keys(groups).map(Number).sort((a,b)=>a-b);
    $("calGrid").innerHTML=days.length?days.map(d=>`<div class="cal-lday ${d===startOfDay(Date.now())?"today":""}"><div class="cal-ldate"><b>${new Date(d).getDate()}</b><span>${esc(cap(new Date(d).toLocaleDateString(LOC(),{weekday:"short"}).replace(".","")))}</span></div><div class="cal-litems">${groups[d].map(rowHTML).join("")}</div></div>`).join("")
      :`<div class="empty">📅 Rien de prévu en ${esc(monthLabel(calMonth).toLowerCase())}.</div>`;
    $("calDaySec").hidden=true;
  }
  bindCal($("calGrid"));
}
function rowHTML(it){
  const when=it.kind==="event"?(it.allDay?"Toute la journée":fmtTime(it.e.start)+" – "+fmtTime(it.e.end)):(it.kind==="deadline"?"Échéance du projet":"Échéance de tâche"+(it.mine?" · vous":""));
  const loc=it.kind==="event"&&it.e.location?` · 📍 ${esc(it.e.location)}`:"";
  return `<button class="cal-row" style="--c:${it.color}" ${it.kind==="event"?`data-ev="${esc(it.e.id)}"`:`data-pj="${esc(it.pid)}"`}>
    <span class="cal-bar"></span><span class="cal-rmain"><b>${it.kind!=="event"?"⚑ ":(it.e.icon?esc(it.e.icon)+" ":"")}${esc(it.title)}</b><span>${esc(when)}${it.sub?" · "+esc(it.sub):""}${loc}</span></span></button>`;
}
function renderCalDay(){
  const d=calSel,its=calItems(d,addDays(d,1));
  $("calDayTitle").textContent=dayLabel(d);
  $("calDay").innerHTML=its.length?its.map(rowHTML).join(""):`<div class="empty">Rien de prévu ce jour-là.</div>`;
  bindCal($("calDay"));
}
function bindCal(root){
  root.querySelectorAll("[data-day]").forEach(c=>{const go=()=>{calSel=Number(c.dataset.day);if(new Date(calSel).getMonth()!==new Date(calMonth).getMonth()){const x=new Date(calSel);calMonth=new Date(x.getFullYear(),x.getMonth(),1).getTime();}renderCalendar();};c.onclick=e=>{if(e.target.closest("[data-ev],[data-pj]"))return;go();};c.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}};});
  root.querySelectorAll("[data-ev]").forEach(b=>b.onclick=e=>{e.stopPropagation();openEvView(b.dataset.ev);});
  root.querySelectorAll("[data-pj]").forEach(b=>b.onclick=e=>{e.stopPropagation();openProject(b.dataset.pj);});
}
$("calPrev").onclick=()=>{const d=new Date(calMonth);calMonth=new Date(d.getFullYear(),d.getMonth()-1,1).getTime();renderCalendar();};
$("calNext").onclick=()=>{const d=new Date(calMonth);calMonth=new Date(d.getFullYear(),d.getMonth()+1,1).getTime();renderCalendar();};
$("calToday").onclick=()=>{const n=new Date();calMonth=new Date(n.getFullYear(),n.getMonth(),1).getTime();calSel=startOfDay(Date.now());renderCalendar();};
document.querySelectorAll("#calMode button").forEach(b=>b.onclick=()=>{calMode=b.dataset.v;renderCalendar();});

/* Fenêtre d'édition */
function openEvDlg(id,day){
  editingEv=id||null;const e=id?events[id]:null;
  $("evDlgTitle").textContent=e?"Modifier l'événement":"Nouvel événement";
  $("eTitle").value=e?e.title:"";$("eVideo").checked=e?hasVideo(e):true;$("eTzHint").textContent="Heures dans votre fuseau horaire : "+tzLabel();$("eType").value=e?e.type||"reunion":"reunion";
  $("eDate").value=dayKey(e?e.start:(day||calSel||Date.now()));
  $("eAllDay").checked=e?!!e.allDay:false;
  $("eStart").value=e&&!e.allDay?fmtTime(e.start):"18:00";$("eEnd").value=e&&!e.allDay?fmtTime(e.end):"19:00";
  $("eLoc").value=e?e.location||"":"";$("eDesc").value=e?e.description||"":"";$("eErr").textContent="";
  evDraft={icon:e?e.icon||"":"",image:e?e.image||"":""};renderEvDraft();
  $("eTimes").hidden=$("eAllDay").checked;
  $("evDlg").showModal();
}
$("eAllDay").onchange=()=>{$("eTimes").hidden=$("eAllDay").checked;};
$("eCancel").onclick=()=>$("evDlg").close();
$("calNew").onclick=()=>openEvDlg(null);
$("calDayAdd").onclick=()=>openEvDlg(null,calSel);
$("eSave").onclick=async()=>{
  const title=$("eTitle").value.trim(),date=$("eDate").value;
  if(!title||!date){$("eErr").textContent="Indiquez au moins un titre et une date.";return;}
  const day=parseDay(date),allDay=$("eAllDay").checked;let start=day,end=addDays(day,1);
  if(!allDay){const [ah,am]=$("eStart").value.split(":").map(Number),[bh,bm]=$("eEnd").value.split(":").map(Number);
    if(isNaN(ah)||isNaN(bh)){$("eErr").textContent="Indiquez les heures de début et de fin.";return;}
    const d=new Date(day);start=new Date(d.getFullYear(),d.getMonth(),d.getDate(),ah,am).getTime();end=new Date(d.getFullYear(),d.getMonth(),d.getDate(),bh,bm).getTime();if(end<=start)end+=DAY;}
  const old=editingEv?events[editingEv]:null,id=editingEv||("e_"+uid());
  const [yy,mm,dd]=date.split("-").map(Number);
  const sStart=allDay?Date.UTC(yy,mm-1,dd):start,sEnd=allDay?sStart+DAY:end;
  const data={title,type:$("eType").value,allDay,start:sStart,end:sEnd,date:allDay?date:"",tz:allDay?"":userTZ(),video:$("eVideo").checked,location:$("eLoc").value.trim(),description:$("eDesc").value.trim(),icon:evDraft.icon||"",image:evDraft.image||"",
    createdBy:old?old.createdBy:myId,createdByName:old?old.createdByName:nameOf(myId),createdAt:old?old.createdAt:Date.now(),updatedAt:Date.now()};
  if(old&&old.icsUid) data.icsUid=old.icsUid;
  try{await EV.col().doc(id).set(data);$("evDlg").close();toast(old?"Événement modifié":"Événement ajouté");calSel=startOfDay(start);}
  catch(e){$("eErr").textContent="Enregistrement refusé : il faut être administrateur de l'association.";}
};

/* Fiche de l'événement et liens vers les calendriers en ligne */
const pad2=n=>String(n).padStart(2,"0");
const utcStamp=t=>{const d=new Date(t);return d.getUTCFullYear()+pad2(d.getUTCMonth()+1)+pad2(d.getUTCDate())+"T"+pad2(d.getUTCHours())+pad2(d.getUTCMinutes())+"00Z";};
const dateStamp=t=>{const d=new Date(t);return d.getFullYear()+pad2(d.getMonth()+1)+pad2(d.getDate());};
const isUrl=s=>/^https?:\/\//i.test(s||"");
/* ---------- Fuseaux horaires (stockage en UTC, affichage local) ---------- */
const userTZ=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"";}catch(e){return "";}};
function tzOffsetMin(t,tz){try{const p=new Intl.DateTimeFormat("en-US",{timeZone:tz,hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(new Date(t));
  const g=k=>+p.find(x=>x.type===k).value;return (Date.UTC(g("year"),g("month")-1,g("day"),g("hour")%24,g("minute"),g("second"))-Math.floor(t/1000)*1000)/60000;}catch(e){return null;}}
function zonedToUtc(Y,Mo,D,h,mi,sec,tz){const g=Date.UTC(Y,Mo-1,D,h,mi,sec);const o1=tzOffsetMin(g,tz);if(o1==null)return null;let t=g-o1*60000;const o2=tzOffsetMin(t,tz);if(o2!=null&&o2!==o1)t=g-o2*60000;return t;}
function utcLabel(t){const o=-new Date(t).getTimezoneOffset(),a=Math.abs(o);return "UTC"+(o>=0?"+":"−")+Math.floor(a/60)+(a%60?":"+pad(a%60):"");}
const tzLabel=()=>(userTZ()?userTZ().replace(/_/g," ")+", ":"")+utcLabel(Date.now());
function fmtInTZ(t,tz){try{return new Date(t).toLocaleTimeString("fr-CA",{timeZone:tz,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).replace(/\s*h\s*/,":");}catch(e){return "";}}
function normEvent(e){
  if(e.allDay&&e.start!=null){
    let k=e.date;if(!k){const r=new Date(Math.round(e.start/DAY)*DAY);k=r.getUTCFullYear()+"-"+pad(r.getUTCMonth()+1)+"-"+pad(r.getUTCDate());}
    const n=Math.max(1,Math.round(((e.end||e.start+DAY)-e.start)/DAY));e.start=parseDay(k);e.end=addDays(e.start,n);e.date=k;
  }
  return e;
}
/* ---------- Salle vidéo (Jitsi Meet, nouvel onglet) ---------- */
const hasVideo=e=>!!e&&!e.allDay&&(e.video===true||(e.video===undefined&&e.type==="reunion"));
function roomUrl(e){let h=2166136261>>>0,h2=5381;for(const c of (curOrg||"")+":"+e.id){const x=c.charCodeAt(0);h=Math.imul(h^x,16777619)>>>0;h2=(Math.imul(h2,33)+x)>>>0;}
  return "https://meet.jit.si/Pointeuse-"+h.toString(36)+h2.toString(36);}
function liveState(e){const n=Date.now();return n>=e.start&&n<e.end?"live":n>=e.start-15*60000&&n<e.start?"soon":"";}
function evWhen(e){
  if(e.allDay) return dayLabel(e.start)+" · toute la journée";
  return dayLabel(e.start)+" · "+fmtTime(e.start)+" – "+fmtTime(e.end)+(dayKey(e.end)!==dayKey(e.start)?" (lendemain)":"");
}
function evDetails(e){return [e.description||"",hasVideo(e)?"Salle vidéo : "+roomUrl(e):"",(org.orgName?"Association : "+org.orgName:"")].filter(Boolean).join("\n\n");}
function googleUrl(e){
  const dates=e.allDay?dateStamp(e.start)+"/"+dateStamp(e.end||addDays(e.start,1)):utcStamp(e.start)+"/"+utcStamp(e.end);
  return "https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent(e.title)+"&dates="+dates+"&details="+encodeURIComponent(evDetails(e))+"&location="+encodeURIComponent(e.location||"");
}
function outlookUrl(e,host){
  const iso=t=>new Date(t).toISOString();
  const s=e.allDay?dayKey(e.start):iso(e.start),en=e.allDay?dayKey(e.end||addDays(e.start,1)):iso(e.end);
  return "https://"+host+"/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject="+encodeURIComponent(e.title)+"&startdt="+encodeURIComponent(s)+"&enddt="+encodeURIComponent(en)+"&allday="+(e.allDay?"true":"false")+"&location="+encodeURIComponent(e.location||"")+"&body="+encodeURIComponent(evDetails(e));
}
function openEvView(id){
  const e=events[id];if(!e)return;viewingEv=id;const [tl,tc]=EV_TYPES[e.type]||EV_TYPES.autre;
  $("evvHead").style.setProperty("--c",tc);$("evvType").textContent=tl;$("evvTitle").textContent=(e.icon?e.icon+" ":"")+e.title;
  $("evvVis").hidden=!e.image;if(e.image)$("evvImg").src=e.image;$("evvWhen").textContent=evWhen(e);
  {const tz=e.allDay?"":userTZ();let txt="";
    if(!e.allDay){txt="Heure de votre fuseau : "+tzLabel();if(e.tz&&e.tz!==tz){const o=fmtInTZ(e.start,e.tz);if(o&&o!==fmtTime(e.start))txt+=" · Heure de l'organisateur : "+o+" ("+e.tz.replace(/_/g," ")+")";}}
    $("evvTz").textContent=txt;$("evvTz").hidden=!txt;}
  {const v=hasVideo(e);$("evvVideoRow").hidden=!v;if(v){const u=roomUrl(e);$("evvJoin").href=u;const st=liveState(e);
    $("evvLive").textContent=st==="live"?"En cours":st==="soon"?"Commence bientôt":"";$("evvJoin").classList.toggle("pulse",st==="live"||st==="soon");
    $("evvCopyRoom").onclick=async()=>{try{await navigator.clipboard.writeText(u);toast("Lien copié");}catch(_){toast(u,6000);}};}}
  $("evvLocRow").hidden=!e.location;
  if(e.location){
    const href=isUrl(e.location)?e.location:"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(e.location);
    $("evvLoc").innerHTML=`${linkify(e.location)}<span class="up-maps" style="margin-top:6px">${mapLinksHTML(e.location)}</span>`;
  }
  $("evvDesc").innerHTML=linkify(e.description||"");$("evvDesc").hidden=!e.description;
  $("evvGoogle").href=googleUrl(e);$("evvOutlook").href=outlookUrl(e,"outlook.live.com");$("evvO365").href=outlookUrl(e,"outlook.office.com");
  const admin=adminUI();$("evvEdit").hidden=!admin;$("evvDel").hidden=!admin;$("evvDel").textContent="Supprimer";
  $("evView").showModal();
  openComments(e);
}
$("evvClose").onclick=()=>$("evView").close();
/* ---------- Rapports d'activités (condensé / détaillé) ---------- */
let repFmt="condense";
const RFMT_HELP={condense:"Une page de synthèse : totaux, graphique, répartition par activité, projet et personne.",detaille:"La synthèse, puis toutes les entrées par personne, les tâches terminées, les jalons atteints et les réunions."};
function repSources(){const w=$("rWho").value;
  if(w==="__all") {const src=Object.keys(team).map(id=>[id,id===myId?state:team[id]]);if(!team[myId])src.push([myId,state]);return src;}
  return [[w,w===myId?state:team[w]]].filter(x=>x[1]);}
function repRange(){const f=$("rFrom").value,t=$("rTo").value;if(!f||!t)return null;const a=parseDay(f),b=addDays(parseDay(t),1);return b>a?[a,b]:null;}
function repCollect(){
  const r=repRange();if(!r) return null;const [from,to]=r,pj=$("rProj").value,onlyValid=$("rHours").value==="valid";const rows=[];
  repSources().forEach(([pid,d])=>{if(!d||!d.sessions)return;d.sessions.forEach(s=>{
    if(s.start<from||s.start>=to) return;
    if(pj==="__none"?!!(s.projectId&&projects[s.projectId]):pj&&s.projectId!==pj) return;
    const st=statusOf(pid,s);if(onlyValid&&st!=="ok") return;
    rows.push({pid,s,ms:s.end-s.start,st,type:typeIn(d,s.typeId).name,proj:s.projectId&&projects[s.projectId]?projects[s.projectId].title:""});});});
  rows.sort((a,b)=>a.s.start-b.s.start);
  return {rows,from,to};
}
function repGroup(rows,key){const m={};rows.forEach(r=>{const k=key(r);m[k]=(m[k]||0)+r.ms;});return Object.entries(m).sort((a,b)=>b[1]-a[1]);}
function repPreview(){
  const c=repCollect();$("rErr").textContent="";
  if(!c){$("rPreview").textContent="";return;}
  const tot=c.rows.reduce((m,r)=>m+r.ms,0),ppl=new Set(c.rows.map(r=>r.pid)).size;
  $("rPreview").textContent=c.rows.length?`${c.rows.length} entrée${c.rows.length>1?"s":""} · ${fmtDur(tot)} · ${ppl} personne${ppl>1?"s":""}`:"Aucune heure sur cette période.";
}
function repPreset(v){
  const n=new Date(),y=n.getFullYear(),m=n.getMonth();let a,b;
  if(v==="month"){a=new Date(y,m,1);b=new Date(y,m+1,0);}
  else if(v==="last"){a=new Date(y,m-1,1);b=new Date(y,m,0);}
  else if(v==="quarter"){const q=Math.floor(m/3)*3;a=new Date(y,q,1);b=new Date(y,q+3,0);}
  else {a=new Date(y,0,1);b=new Date(y,11,31);}
  $("rFrom").value=dayKey(a.getTime());$("rTo").value=dayKey(b.getTime());
  document.querySelectorAll("#rPreset button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.v===v)));repPreview();
}
function openReport(team_){
  const admin=adminUI();
  const opts=[[myId,"Moi"]];
  if(admin){opts.push(["__all","Toute l'équipe"]);peopleForPick().filter(id=>id!==myId).forEach(id=>opts.push([id,nameOf(id)]));}
  $("rWho").innerHTML=opts.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join("");
  $("rWho").value=team_&&admin?"__all":(mode==="person"&&viewingId&&admin?viewingId:myId);
  $("rWhoRow").hidden=!admin;
  $("rProj").innerHTML=`<option value="">Tous les projets</option><option value="__none">Sans projet</option>`+visibleProjects().map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join("");
  repSetFmt(repFmt);repPreset("month");$("repDlg").showModal();
}
function repSetFmt(v){repFmt=v;document.querySelectorAll("#rFormat button").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.v===v)));$("rFmtHelp").textContent=RFMT_HELP[v];}
document.querySelectorAll("#rFormat button").forEach(b=>b.onclick=()=>repSetFmt(b.dataset.v));
document.querySelectorAll("#rPreset button").forEach(b=>b.onclick=()=>repPreset(b.dataset.v));
["rFrom","rTo","rWho","rProj","rHours"].forEach(id=>$(id).onchange=()=>{if(id==="rFrom"||id==="rTo")document.querySelectorAll("#rPreset button").forEach(x=>x.setAttribute("aria-pressed","false"));repPreview();});
$("openReport").onclick=()=>openReport(false);
$("openReportTeam").onclick=()=>openReport(true);
$("rCancel").onclick=()=>$("repDlg").close();
const ST_TXT=st=>ST_LABEL[st]||"";
$("rCsv").onclick=()=>{
  const c=repCollect();if(!c){$("rErr").textContent="Choisissez une période valide.";return;}
  if(!c.rows.length){$("rErr").textContent="Aucune heure sur cette période.";return;}
  const head=["Personne","Date","Entrée","Sortie","Activité","Projet","Note","Durée (h)","Statut"].map(x=>q(tx(x))).join(";");
  const lines=[head].concat(c.rows.map(r=>[nameOf(r.pid),dayKey(r.s.start),fmtTime(r.s.start),fmtTime(r.s.end),tr(r.type),r.proj,r.s.note||"",(r.ms/3600000).toFixed(2).replace(".",DEC()),tr(ST_TXT(r.st))].map(q).join(";")));
  offerCsv(tx("rapport")+"-"+$("rFrom").value+"-"+$("rTo").value+".csv",lines);
};
$("rMake").onclick=()=>{
  if(!window.jspdf){$("rErr").textContent="Le générateur de PDF n'a pas pu se charger. Rechargez la page.";return;}
  const c=repCollect();if(!c){$("rErr").textContent="Choisissez une période valide.";return;}
  if(!c.rows.length){$("rErr").textContent="Aucune heure sur cette période.";return;}
  const detailed=repFmt==="detaille",{rows,from,to}=c;
  const P=x=>String(x==null?"":x).replace(/[\u202F\u2009\u2007]/g," ").replace(/\u2212/g,"-");
  const doc=new window.jspdf.jsPDF({unit:"mm",format:"letter"});const W=215.9,M=18;let y=20;
  const need=h=>{if(y+h>265){doc.addPage();y=20;}};
  const txt=(t,x,yy,o)=>doc.text(P(t),x,yy,o);
  const head=t=>{y+=5;need(14);doc.setFont("helvetica","bold");doc.setFontSize(12.5);doc.setTextColor(0);txt(t,M,y);y+=2;doc.setDrawColor(200);doc.line(M,y,W-M,y);y+=6;};
  const hrs=ms=>(ms/3600000).toFixed(2).replace(".",DEC())+" h";
  const total=rows.reduce((m,r)=>m+r.ms,0),valid=rows.filter(r=>r.st==="ok").reduce((m,r)=>m+r.ms,0);
  const ppl=[...new Set(rows.map(r=>r.pid))],value=rows.filter(r=>r.st==="ok").reduce((m,r)=>m+moneyOf(r.ms,r.pid),0);
  const fmtD=t=>new Date(t).toLocaleDateString(LOC(),{day:"numeric",month:"long",year:"numeric"});
  // En-tête
  doc.setFont("helvetica","bold");doc.setFontSize(19);txt(tx(detailed?"Rapport d'activités détaillé":"Rapport d'activités condensé"),M,y);y+=7;
  doc.setFont("helvetica","normal");doc.setFontSize(10.5);doc.setTextColor(90);
  const who=$("rWho").selectedOptions[0]?$("rWho").selectedOptions[0].textContent:"";
  [org.orgName||"",tx("Du {} au {}",fmtD(from),fmtD(to-DAY)),tx("Personnes : {}",who)+($("rProj").value?" · "+tx("Projet : {}",$("rProj").selectedOptions[0].textContent):"")+($("rHours").value==="valid"?" · "+tx("Heures validées seulement"):"")]
    .filter(Boolean).forEach(l=>{txt(l,M,y);y+=5;});doc.setTextColor(0);y+=3;
  // Indicateurs
  const kpis=[[tx("Heures"),hrs(total)],[tx("Validées"),hrs(valid)],[tx("En attente"),hrs(total-valid)],[tx("Entrées"),String(rows.length)],[tx("Personnes"),String(ppl.length)]];
  if(value>0) kpis.push([tx("Valeur estimée"),fmtMoney(value)]);
  const kw=(W-2*M-(kpis.length-1)*3)/kpis.length;
  kpis.forEach(([l,v],i)=>{const x=M+i*(kw+3);doc.setFillColor(243,245,249);doc.roundedRect(x,y,kw,16,2,2,"F");doc.setFontSize(8.5);doc.setTextColor(90);txt(l,x+3,y+5.5);doc.setTextColor(0);doc.setFont("helvetica","bold");doc.setFontSize(11.5);txt(v,x+3,y+12.5);doc.setFont("helvetica","normal");});
  y+=24;
  // Graphique : par semaine (≤ 120 jours) ou par mois
  {const byMonth=(to-from)/DAY>120,buckets=[];
    if(byMonth){for(let d=new Date(from);d.getTime()<to;d=new Date(d.getFullYear(),d.getMonth()+1,1))buckets.push({a:d.getTime(),b:Math.min(to,new Date(d.getFullYear(),d.getMonth()+1,1).getTime()),l:d.toLocaleDateString(LOC(),{month:"short"})});}
    else{let a=weekStartOf(from);while(a<to){const b=addDays(a,7);buckets.push({a:Math.max(a,from),b:Math.min(b,to),l:new Date(Math.max(a,from)).toLocaleDateString(LOC(),{day:"numeric",month:"short"})});a=b;}}
    buckets.forEach(k=>{k.t=0;k.v=0;rows.forEach(r=>{if(r.s.start>=k.a&&r.s.start<k.b){k.t+=r.ms;if(r.st==="ok")k.v+=r.ms;}});});
    head(tx(byMonth?"Heures par mois":"Heures par semaine"));need(48);
    const ch=36,max=Math.max(1,...buckets.map(k=>k.t)),slot=(W-2*M-10)/buckets.length,bw=Math.min(14,slot*.62),base=y+ch;
    doc.setFontSize(7.5);doc.setTextColor(120);txt(hrs(max).replace(/[,.]00/,""),M,y+2);doc.setDrawColor(220);doc.line(M+10,base,W-M,base);
    buckets.forEach((k,i)=>{const x=M+10+slot*i+(slot-bw)/2,ht=k.t/max*ch,hv=k.v/max*ch;
      if(ht>0){doc.setFillColor(190,222,212);doc.rect(x,base-ht,bw,ht,"F");}
      if(hv>0){doc.setFillColor(31,111,92);doc.rect(x,base-hv,bw,hv,"F");}
      if(buckets.length<=14||i%2===0) txt(k.l,x+bw/2,base+4,{align:"center"});});
    doc.setTextColor(0);y=base+9;doc.setFontSize(8);doc.setFillColor(31,111,92);doc.rect(M,y-2.5,3,3,"F");txt(tx("Validées"),M+4.5,y);doc.setFillColor(190,222,212);doc.rect(M+28,y-2.5,3,3,"F");txt(tx("En attente"),M+32.5,y);y+=4;}
  // Tableaux de répartition
  const table=(title,list,label)=>{head(title);doc.setFontSize(10);
    list.forEach(([k,ms])=>{need(7);const pct=total?Math.round(ms/total*100):0;doc.setFont("helvetica","normal");txt(doc.splitTextToSize(P(label(k)),90)[0],M,y);
      doc.setFillColor(230,233,238);doc.rect(M+95,y-3,50,3.5,"F");doc.setFillColor(31,111,92);doc.rect(M+95,y-3,50*ms/(list[0][1]||1),3.5,"F");
      txt(pct+" %",M+150,y);txt(hrs(ms),W-M,y,{align:"right"});y+=6.5;});};
  table(tx("Par activité"),repGroup(rows,r=>r.type),k=>tr(k));
  table(tx("Par projet"),repGroup(rows,r=>r.proj||""),k=>k||tx("Sans projet"));
  if(ppl.length>1) table(tx("Par personne"),repGroup(rows,r=>r.pid),k=>nameOf(k));
  // Faits marquants
  const inR=t=>t>=from&&t<to;
  const doneTasks=[],msDone=[],meetings=Object.values(typeof events==="object"?events:{}).filter(e=>e.type==="reunion"&&inR(e.start)).sort((a,b)=>a.start-b.start);
  visibleProjects().forEach(p=>{tasksOf(p.id).forEach(t=>{if(t.status==="terminee"&&inR(t.updatedAt||0))doneTasks.push([p,t]);});msOf(p).forEach(m=>{if(m.done&&m.date&&inR(parseDay(m.date)))msDone.push([p,m]);});});
  head(tx("Faits marquants"));doc.setFont("helvetica","normal");doc.setFontSize(10.5);
  [[tx("Tâches terminées"),doneTasks.length],[tx("Jalons atteints"),msDone.length],[tx("Réunions tenues"),meetings.length]].forEach(([l,n])=>{need(6);txt(l,M,y);txt(String(n),W-M,y,{align:"right"});y+=6;});
  if(detailed){
    const sub=t=>{y+=3;need(10);doc.setFont("helvetica","bold");doc.setFontSize(10.5);txt(t,M,y);y+=5.5;doc.setFont("helvetica","normal");doc.setFontSize(9);};
    if(doneTasks.length){sub(tx("Tâches terminées"));doneTasks.forEach(([p,t])=>{need(5);txt("• "+doc.splitTextToSize(P(t.title+" — "+p.title),W-2*M-30)[0],M,y);txt(dayKey(t.updatedAt),W-M,y,{align:"right"});y+=4.8;});}
    if(msDone.length){sub(tx("Jalons atteints"));msDone.forEach(([p,m])=>{need(5);txt("• "+doc.splitTextToSize(P(m.title+" — "+p.title),W-2*M-30)[0],M,y);txt(m.date,W-M,y,{align:"right"});y+=4.8;});}
    if(meetings.length){sub(tx("Réunions tenues"));meetings.forEach(e=>{need(5);txt("• "+doc.splitTextToSize(P(e.title),W-2*M-40)[0],M,y);txt(dayKey(e.start)+" "+fmtTime(e.start),W-M,y,{align:"right"});y+=4.8;});}
    // Entrées par personne
    const cols=[M,M+20,M+40,M+75,M+110,W-M-38];
    ppl.sort((a,b)=>nameOf(a).localeCompare(nameOf(b))).forEach(pid=>{
      const list=rows.filter(r=>r.pid===pid),sum=list.reduce((m,r)=>m+r.ms,0);
      head(nameOf(pid)+" — "+hrs(sum));
      doc.setFontSize(8.5);doc.setTextColor(90);[tx("Date"),tx("Horaire"),tx("Activité"),tx("Projet"),tx("Note"),tx("Statut")].forEach((h,i)=>txt(h,cols[i],y));txt(tx("Durée"),W-M,y,{align:"right"});doc.setTextColor(0);y+=5;
      list.forEach(r=>{need(5.5);doc.setFontSize(8.5);
        txt(dayKey(r.s.start),cols[0],y);txt(fmtTime(r.s.start)+"–"+fmtTime(r.s.end),cols[1],y);
        txt(doc.splitTextToSize(P(tr(r.type)),36)[0],cols[2],y);txt(doc.splitTextToSize(P(r.proj),38)[0]||"",cols[3],y);
        txt(doc.splitTextToSize(P(r.s.note||""),cols[5]-cols[4]-3)[0]||"",cols[4],y);txt(doc.splitTextToSize(P(tr(ST_TXT(r.st))),23)[0],cols[5],y);txt(hrs(r.ms),W-M,y,{align:"right"});y+=5;});
    });
  }
  // Pied de page
  const n=doc.getNumberOfPages();for(let i=1;i<=n;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(140);
    txt(tx("Document émis le {}",fmtD(Date.now())),M,272);txt(tx("Page {} sur {}",String(i),String(n)),W-M,272,{align:"right"});}
  const buf=doc.output("arraybuffer");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([buf],{type:"application/pdf"}));
  a.download=(tx("rapport")+"-"+(detailed?tx("detaille"):tx("condense"))+"-"+$("rFrom").value+"-"+$("rTo").value).replace(/[^\p{L}\p{N}]+/gu,"-").toLowerCase()+".pdf";a.click();
  $("repDlg").close();toast("Rapport téléchargé");
};
/* ---------- Notes de réunion (procès-verbal) ---------- */
let pvEv=null,pvData={},pvUnsub=null,pvTimers={},pvBeat=0;
const pvRef=eid=>EV.col().doc(eid).collection("minutes").doc("main");
const pvPeople=()=>{const ids=new Set([...Object.keys(members||{}),...Object.keys(team||{})]);if(myId)ids.add(myId);return [...ids].sort((a,b)=>nameOf(a).localeCompare(nameOf(b)));};
function pvWrite(part,quiet){
  if(!pvEv) return;
  const meta={updatedAt:Date.now(),updatedBy:myId,updatedByName:nameOf(myId)};
  setSync("Enregistrement…");
  pvRef(pvEv.id).set(Object.assign({},part,meta),{merge:true}).then(()=>setSync("Enregistré")).catch(()=>{setSync("Échec de l'enregistrement. Vérifiez votre connexion.");if(!quiet)toast("Enregistrement refusé");});
}
function pvTyping(f){const now=Date.now();if(now-pvBeat<10000)return;pvBeat=now;pvWrite({editing:{[myId]:{name:nameOf(myId),at:now,f}}},true);}
function pvStateText(){
  const now=Date.now(),ed=pvData.editing||{};
  const others=Object.entries(ed).filter(([id,v])=>id!==myId&&v&&now-v.at<30000).map(([,v])=>v.name);
  let t=others.length?"✍️ "+others.join(", ")+" écrit aussi en ce moment.":"";
  if(pvData.updatedAt) t+=(t?" ":"")+"Dernière modification : "+pvData.updatedByName+", "+dayLabel(pvData.updatedAt)+" à "+fmtTime(pvData.updatedAt)+".";
  $("pvState").textContent=t;
}
function pvRender(){
  const e=pvEv;if(!e) return;const d=pvData,admin=adminUI();
  document.querySelectorAll("#pvDlg [data-pvf]").forEach(el=>{if(document.activeElement!==el){const v=d[el.dataset.pvf];el.value=v!=null?v:(el.dataset.pvf==="agenda"?(e.description||""):"");}});
  const present=new Set(d.present||[]);
  $("pvPresent").innerHTML=pvPeople().map(id=>`<label><input type="checkbox" value="${esc(id)}" ${present.has(id)?"checked":""}>${esc(nameOf(id))}</label>`).join("");
  $("pvPresent").querySelectorAll("input").forEach(c=>c.onchange=()=>pvWrite({present:[...$("pvPresent").querySelectorAll("input:checked")].map(i=>i.value)}));
  const dec=d.decisions||[];
  $("pvDecisions").innerHTML=dec.length?dec.map((x,i)=>`<div class="pvitem"><span class="pvnum">${i+1}.</span><span class="pvtxt">${esc(x.text)}</span><button class="btn ghost danger" data-pvdec="${esc(x.id)}" aria-label="Retirer">✕</button></div>`).join(""):`<div class="since">Aucune décision notée.</div>`;
  $("pvDecisions").querySelectorAll("[data-pvdec]").forEach(b=>b.onclick=()=>pvWrite({decisions:(pvData.decisions||[]).filter(x=>x.id!==b.dataset.pvdec)}));
  const acts=d.actions||[],projOpts=visibleProjects().filter(p=>(p.status||"actif")==="actif");
  $("pvActions").innerHTML=acts.length?acts.map(a=>`<div class="pvitem"><span class="pvtxt"><b>${esc(a.text)}</b><small>${a.who?esc(nameOf(a.who)):"Sans responsable"}${a.due?" · "+esc(shortDate(a.due)):""}</small></span>
    ${a.taskId?`<span class="since">✓ Tâche créée${a.pid&&projects[a.pid]?" · "+esc(projects[a.pid].title):""}</span>`
      :admin&&projOpts.length&&a.who?`<select data-pvproj="${esc(a.id)}" aria-label="Projet">${projOpts.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join("")}</select><button class="btn" data-pvtask="${esc(a.id)}">Créer la tâche</button>`:""}
    <button class="btn ghost danger" data-pvact="${esc(a.id)}" aria-label="Retirer">✕</button></div>`).join(""):`<div class="since">Aucune action notée.</div>`;
  $("pvActions").querySelectorAll("[data-pvact]").forEach(b=>b.onclick=()=>pvWrite({actions:(pvData.actions||[]).filter(x=>x.id!==b.dataset.pvact)}));
  $("pvActions").querySelectorAll("[data-pvtask]").forEach(b=>b.onclick=()=>pvMakeTask(b.dataset.pvtask,$("pvActions").querySelector(`[data-pvproj="${b.dataset.pvtask}"]`).value));
  if(document.activeElement!==$("pvActWho")){const cur=$("pvActWho").value;$("pvActWho").innerHTML=`<option value="">Responsable…</option>`+pvPeople().map(id=>`<option value="${esc(id)}">${esc(nameOf(id))}</option>`).join("");$("pvActWho").value=cur;}
  {const e2=pvEv,mine=(d.present||[]).includes(myId)&&e2.end<=Date.now()&&!state.sessions.some(x=>x.meetingId===e2.id);
    $("pvMine").hidden=!mine;$("pvMine").onclick=()=>{$("pvDlg").close();meetingEntry(e2);};}
  if(pvEv) mtgCache[pvEv.id]={present:d.present||[],at:Date.now()};
  pvStateText();
}
async function pvMakeTask(aid,pid){
  const a=(pvData.actions||[]).find(x=>x.id===aid),p=projects[pid];if(!a||!p) return;
  const id="t_"+uid(),e=pvEv;
  const data={status:"a_faire",progress:0,createdAt:Date.now(),log:[],title:a.text,description:"Issue de la réunion « "+e.title+" » du "+dayLabel(e.start)+".",deadline:a.due||"",kind:"individuelle",assigneeIds:[a.who],updatedAt:Date.now()};
  data.log=addLog({log:[]},"a créé la tâche");
  try{
    await PA.saveTask(pid,id,data);
    if(!(p.memberIds||[]).includes(a.who)){const memberIds=[...(p.memberIds||[]),a.who];const memberNames=Object.assign({},p.memberNames||{},{[a.who]:nameOf(a.who)});
      await PA.saveProject(pid,Object.assign({},p,{memberIds,memberNames,updatedAt:Date.now()}));}
    pvWrite({actions:(pvData.actions||[]).map(x=>x.id===aid?Object.assign({},x,{taskId:id,pid}):x)});toast("Tâche créée");
  }catch(err){toast("Enregistrement refusé : accès administrateur requis.");}
}
function openMinutes(eid){
  const e=events[eid];if(!e) return;pvEv=e;pvData={};
  $("pvTitle").textContent=(e.icon?e.icon+" ":"")+e.title;$("pvWhen").textContent=evWhen(e)+(e.location?" · "+e.location:"");
  $("pvJoin").hidden=!hasVideo(e);if(hasVideo(e))$("pvJoin").href=roomUrl(e);
  if(pvUnsub)pvUnsub();
  pvUnsub=pvRef(eid).onSnapshot(sn=>{pvData=sn.exists?sn.data():{};pvRender();},()=>{$("pvState").textContent="Ces notes ne peuvent pas être chargées (accès refusé).";});
  pvRender();
  if($("evView").open)$("evView").close();
  $("pvDlg").showModal();
}
function closeMinutes(){
  document.querySelectorAll("#pvDlg [data-pvf]").forEach(el=>{if(pvTimers[el.dataset.pvf]){clearTimeout(pvTimers[el.dataset.pvf]);pvTimers[el.dataset.pvf]=0;pvWrite({[el.dataset.pvf]:el.value},true);}});
  if(pvEv&&myId){try{pvRef(pvEv.id).set({editing:{[myId]:firebase.firestore.FieldValue.delete()}},{merge:true}).catch(()=>{});}catch(e){}}
  if(pvUnsub){pvUnsub();pvUnsub=null;}pvEv=null;
}
document.querySelectorAll("#pvDlg [data-pvf]").forEach(el=>{
  el.addEventListener("input",()=>{const f=el.dataset.pvf;pvTyping(f);clearTimeout(pvTimers[f]);pvTimers[f]=setTimeout(()=>{pvTimers[f]=0;pvWrite({[f]:el.value},true);},800);});
  el.addEventListener("blur",()=>{const f=el.dataset.pvf;if(pvTimers[f]){clearTimeout(pvTimers[f]);pvTimers[f]=0;pvWrite({[f]:el.value},true);}});
});
$("pvDecAdd").onclick=()=>{const v=$("pvDecNew").value.trim();if(!v)return;pvWrite({decisions:(pvData.decisions||[]).concat([{id:"d_"+uid(),text:v}])});$("pvDecNew").value="";};
$("pvDecNew").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();$("pvDecAdd").click();}};
$("pvActAdd").onclick=()=>{const v=$("pvActNew").value.trim();if(!v)return;pvWrite({actions:(pvData.actions||[]).concat([{id:"a_"+uid(),text:v,who:$("pvActWho").value||"",due:$("pvActDue").value||""}])});$("pvActNew").value="";$("pvActDue").value="";};
$("pvActNew").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();$("pvActAdd").click();}};
$("pvClose").onclick=()=>$("pvDlg").close();
$("pvDlg").addEventListener("close",closeMinutes);
$("evvNotes").onclick=()=>{if(viewingEv)openMinutes(viewingEv);};
setInterval(()=>{if(pvEv&&$("pvDlg").open)pvStateText();},10000);
$("pvPdf").onclick=()=>{
  if(!window.jspdf){toast("Le générateur de PDF n'a pas pu se charger. Rechargez la page.");return;}
  const e=pvEv;if(!e) return;const d=Object.assign({},pvData);
  document.querySelectorAll("#pvDlg [data-pvf]").forEach(el=>{d[el.dataset.pvf]=el.value;});
  const doc=new window.jspdf.jsPDF({unit:"mm",format:"letter"});const W=215.9,M=20;let y=22;
  const need=h=>{if(y+h>262){doc.addPage();y=22;}};
  const para=(t,size)=>{doc.setFont("helvetica","normal");doc.setFontSize(size||11);doc.splitTextToSize(String(t||""),W-2*M).forEach(l=>{need(6);doc.text(l,M,y);y+=5.4;});};
  const head=t=>{y+=4;need(12);doc.setFont("helvetica","bold");doc.setFontSize(12.5);doc.text(t,M,y);y+=2;doc.setDrawColor(200);doc.line(M,y,W-M,y);y+=6;};
  doc.setFont("helvetica","bold");doc.setFontSize(19);doc.text(tx("Procès-verbal"),M,y);y+=8;
  doc.setFontSize(13);doc.text(doc.splitTextToSize(e.title,W-2*M)[0],M,y);y+=6;
  doc.setFont("helvetica","normal");doc.setFontSize(10.5);doc.setTextColor(90);
  [org.orgName||"",tr(evWhen(e)),e.location||""].filter(Boolean).forEach(l=>{doc.text(doc.splitTextToSize(l,W-2*M)[0],M,y);y+=5;});doc.setTextColor(0);
  head(tx("Présences"));para((d.present||[]).map(nameOf).join(", ")||"—");
  if(d.guests){y+=2;para(tx("Invités et absents excusés")+" : "+d.guests,10.5);}
  head(tx("Ordre du jour"));para(d.agenda!=null?d.agenda:(e.description||"—"));
  head(tx("Notes"));para(d.notes||"—");
  head(tx("Décisions"));(d.decisions||[]).length?(d.decisions||[]).forEach((x,i)=>para((i+1)+". "+x.text)):para("—");
  head(tx("Actions à faire"));(d.actions||[]).length?(d.actions||[]).forEach(a=>para("• "+a.text+(a.who?" — "+nameOf(a.who):"")+(a.due?" ("+shortDate(a.due)+")":""))):para("—");
  y+=8;need(10);doc.setFontSize(9);doc.setTextColor(120);doc.text(tx("Document émis le {}",new Date().toLocaleDateString(LOC(),{day:"numeric",month:"long",year:"numeric"})),M,y);
  const buf=doc.output("arraybuffer");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([buf],{type:"application/pdf"}));
  a.download=(tx("proces-verbal")+"-"+dayKey(e.start)+"-"+e.title).replace(/[^\p{L}\p{N}]+/gu,"-").toLowerCase()+".pdf";a.click();
};

$("evView").addEventListener("close",()=>{if(comUnsub){comUnsub();comUnsub=null;}});
$("evvEdit").onclick=()=>{$("evView").close();openEvDlg(viewingEv);};
$("evvDel").onclick=async()=>{
  if($("evvDel").textContent!=="Confirmer la suppression"){$("evvDel").textContent="Confirmer la suppression";return;}
  try{await EV.col().doc(viewingEv).delete();$("evView").close();toast("Événement supprimé");}catch(e){toast("Suppression refusée");}
};
$("evvIcs").onclick=()=>{const e=events[viewingEv];if(e)saveIcs(slug(e.title)+".ics",buildIcs([e],[]));};

/* Fichiers .ics */
const slug=s=>String(s||"calendrier").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-|-$/g,"").toLowerCase()||"calendrier";
const icsEsc=s=>String(s||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\r?\n/g,"\\n");
function icsFold(line){const out=[];let s=line;while(s.length>73){out.push(s.slice(0,73));s=" "+s.slice(73);}out.push(s);return out.join("\r\n");}
function buildIcs(evs,deadlines){
  const L_=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Pointeuse//Calendrier//FR","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:"+icsEsc(org.orgName||"Association")];
  const now=utcStamp(Date.now());
  evs.forEach(e=>{
    L_.push("BEGIN:VEVENT","UID:"+(e.icsUid||e.id+"@pointeuse"),"DTSTAMP:"+now);
    if(e.allDay) L_.push("DTSTART;VALUE=DATE:"+dateStamp(e.start),"DTEND;VALUE=DATE:"+dateStamp(e.end||addDays(e.start,1)));
    else L_.push("DTSTART:"+utcStamp(e.start),"DTEND:"+utcStamp(e.end));
    L_.push("SUMMARY:"+icsEsc(e.title));
    if(e.location) L_.push("LOCATION:"+icsEsc(e.location));
    const d=evDetails(e);if(d) L_.push("DESCRIPTION:"+icsEsc(d));
    L_.push("END:VEVENT");
  });
  deadlines.forEach(x=>{L_.push("BEGIN:VEVENT","UID:"+x.uid+"@pointeuse","DTSTAMP:"+now,"DTSTART;VALUE=DATE:"+dateStamp(x.start),"DTEND;VALUE=DATE:"+dateStamp(addDays(x.start,1)),"SUMMARY:"+icsEsc(x.title),"END:VEVENT");});
  L_.push("END:VCALENDAR");
  return L_.map(icsFold).join("\r\n")+"\r\n";
}
$("calSync").onclick=()=>$("syncDlg").showModal();
$("syncClose").onclick=()=>$("syncDlg").close();
$("syncExport").onclick=()=>{
  const dls=[];
  visibleProjects().forEach(p=>{
    if(p.deadline&&p.status!=="archive") dls.push({uid:"p-"+p.id,start:parseDay(p.deadline),title:"Échéance : "+p.title});
    tasksOf(p.id).forEach(t=>{if(t.deadline&&t.status!=="terminee")dls.push({uid:"t-"+t.id,start:parseDay(t.deadline),title:"Échéance : "+t.title+" ("+p.title+")"});});
  });
  saveIcs(slug(org.orgName||"association")+"-calendrier.ics",buildIcs(Object.values(events),dls));
};
function parseIcs(text){
  const lines=text.replace(/\r\n[ \t]/g,"").replace(/\n[ \t]/g,"").split(/\r?\n/);
  const out=[];let cur=null;
  const unesc=s=>s.replace(/\\n/gi,"\n").replace(/\\,/g,",").replace(/\\;/g,";").replace(/\\\\/g,"\\");
  const toTime=(v,params)=>{
    const m=v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);if(!m)return null;
    const [_,Y,Mo,D,h,mi,s,z]=m;
    if(h===undefined) return {t:new Date(+Y,+Mo-1,+D).getTime(),allDay:true};
    if(z) return {t:Date.UTC(+Y,+Mo-1,+D,+h,+mi,+(s||0)),allDay:false};
    const tzm=String(params||"").match(/TZID=([^;:]+)/);
    if(tzm){const u=zonedToUtc(+Y,+Mo,+D,+h,+mi,+(s||0),tzm[1].replace(/"/g,""));if(u!=null)return {t:u,allDay:false};}
    return {t:new Date(+Y,+Mo-1,+D,+h,+mi,+(s||0)).getTime(),allDay:false};
  };
  lines.forEach(l=>{
    if(l==="BEGIN:VEVENT"){cur={};return;}
    if(l==="END:VEVENT"){if(cur&&cur.start)out.push(cur);cur=null;return;}
    if(!cur) return;
    const i=l.indexOf(":");if(i<0)return;
    const key=l.slice(0,i).split(";")[0].toUpperCase(),params=l.slice(0,i),val=l.slice(i+1);
    if(key==="SUMMARY") cur.title=unesc(val);
    else if(key==="LOCATION") cur.location=unesc(val);
    else if(key==="DESCRIPTION") cur.description=unesc(val);
    else if(key==="UID") cur.icsUid=val;
    else if(key==="DTSTART"){const r=toTime(val,params);if(r){cur.start=r.t;cur.allDay=r.allDay;}}
    else if(key==="DTEND"){const r=toTime(val,params);if(r)cur.end=r.t;}
  });
  return out;
}
$("calImport").onchange=async()=>{
  const f=$("calImport").files[0];$("calImport").value="";if(!f)return;
  try{
    const list=parseIcs(await f.text());
    const known=new Set(Object.values(events).map(e=>e.icsUid).filter(Boolean));
    let n=0;
    for(const x of list){
      if(x.icsUid&&known.has(x.icsUid)) continue;
      const end=x.end||(x.allDay?addDays(x.start,1):x.start+3600000);
      await EV.col().doc("e_"+uid()).set({title:x.title||"Sans titre",type:"autre",allDay:!!x.allDay,start:x.start,end,location:x.location||"",description:x.description||"",icsUid:x.icsUid||"",createdBy:myId,createdByName:nameOf(myId),createdAt:Date.now(),updatedAt:Date.now()});
      n++;
    }
    toast(n?n+" événement"+(n>1?"s importés":" importé"):"Aucun nouvel événement dans ce fichier",3500);
  }catch(e){toast("Ce fichier n'a pas pu être importé.");}
};

// Titre affiché : Propriétaire, le nom du rôle administrateur, sinon « Membre ».
function myTitle(){if(isOwnerNow())return "Propriétaire";const r=roleOf(myId);return r&&r.level==="admin"?r.name:"Membre";}

/* ---------- Accès rapide : événements à venir ---------- */
function mapLinksHTML(loc){
  if(!loc) return "";
  if(isUrl(loc)) return `<a class="maplink" href="${esc(loc)}" target="_blank" rel="noopener">🎥 Rejoindre</a>`;
  const q=encodeURIComponent(loc);
  return `<a class="maplink" href="https://www.google.com/maps/dir/?api=1&destination=${q}" target="_blank" rel="noopener">Google Maps</a>`+
    `<a class="maplink" href="https://maps.apple.com/?daddr=${q}" target="_blank" rel="noopener">Plans (Apple)</a>`+
    `<a class="maplink" href="https://waze.com/ul?q=${q}&navigate=yes" target="_blank" rel="noopener">Waze</a>`;
}
let miniMonth=null,miniSel=null;
function upRowHTML(it){
  const d=new Date(it.start),ev=it.kind==="event"?it.e:null;
  const when=ev?(ev.allDay?dayLabel(ev.start)+" · toute la journée":dayLabel(ev.start)+" · "+fmtTime(ev.start)+" – "+fmtTime(ev.end)):dayLabel(it.start)+(it.kind==="task"?" · échéance de tâche"+(it.sub?" ("+it.sub+")":""):" · échéance du projet");
  const type=ev?(EV_TYPES[ev.type]||EV_TYPES.autre)[0]:"Échéance";
  const attr=ev?`data-ev="${esc(ev.id)}"`:`data-pj="${esc(it.pid)}"`;
  return `<div class="up-row ${ev&&ev.image?"has-img":""}" style="--c:${it.color}">
    <button class="up-date" ${attr} aria-label="Ouvrir ${esc(it.title)}"><b>${d.getDate()}</b><span>${esc(d.toLocaleDateString(LOC(),{month:"short"}).replace(".",""))}</span></button>
    <div class="up-main">
      <button class="up-title" ${attr}><span class="up-type">${esc(type)}</span>${ev&&ev.icon?esc(ev.icon)+" ":""}${esc(ev?ev.title:it.title.replace(/^Échéance : /,""))}</button>
      <span class="up-when">${esc(when)}</span>
      ${ev&&ev.location?`<span class="up-loc">📍 ${linkify(ev.location)}</span><span class="up-maps">${mapLinksHTML(ev.location)}</span>`:""}
    </div>
    ${ev&&ev.image?`<button class="up-thumb" ${attr} aria-label="Voir le visuel de ${esc(ev.title)}" style="background-image:url('${ev.image}')"></button>`:""}
  </div>`;
}
function renderMini(){
  if(miniMonth===null){const n=new Date();miniMonth=new Date(n.getFullYear(),n.getMonth(),1).getTime();}
  const m0=new Date(miniMonth),y=m0.getFullYear(),mo=m0.getMonth(),ws=weekStart();
  const off=(m0.getDay()-ws+7)%7,dim=new Date(y,mo+1,0).getDate(),weeks=Math.ceil((off+dim)/7);
  const gStart=addDays(miniMonth,-off),gEnd=addDays(gStart,weeks*7),items=calItems(gStart,gEnd),today=startOfDay(Date.now());
  const names=[...Array(7)].map((_,i)=>new Date(2024,0,7+((i+ws)%7)).toLocaleDateString(LOC(),{weekday:"narrow"}));
  let h=`<div class="mini-head"><button class="mini-nav" data-mn="-1" aria-label="Mois précédent">‹</button><b>${esc(monthLabel(miniMonth))}</b><button class="mini-nav" data-mn="1" aria-label="Mois suivant">›</button></div><div class="mini-grid">`+names.map(n=>`<span class="mini-wd">${esc(n.toUpperCase())}</span>`).join("");
  for(let i=0;i<weeks*7;i++){
    const d=addDays(gStart,i),de=addDays(d,1),its=items.filter(x=>x.start<de&&x.end>d);
    const cls=["mini-d",new Date(d).getMonth()!==mo?"out":"",d===today?"today":"",d===miniSel?"sel":"",its.length?"has":""].join(" ");
    h+=`<button class="${cls}" data-md="${d}" aria-label="${esc(dayLabel(d))}${its.length?", "+its.length+" élément(s)":""}" ${d===miniSel?'aria-pressed="true"':""}><span>${new Date(d).getDate()}</span><i class="mini-dots">${its.slice(0,3).map(x=>`<em style="background:${x.color}"></em>`).join("")}</i></button>`;
  }
  $("miniCal").innerHTML=h+"</div>";
  $("miniCal").querySelectorAll("[data-mn]").forEach(b=>b.onclick=()=>{const x=new Date(miniMonth);miniMonth=new Date(x.getFullYear(),x.getMonth()+Number(b.dataset.mn),1).getTime();renderMini();});
  $("miniCal").querySelectorAll("[data-md]").forEach(b=>b.onclick=()=>{const d=Number(b.dataset.md);miniSel=miniSel===d?null:d;if(miniSel!==null&&new Date(d).getMonth()!==mo){const x=new Date(d);miniMonth=new Date(x.getFullYear(),x.getMonth(),1).getTime();}renderUpcoming(true);});
}
function renderUpcoming(own){
  $("upSec").hidden=!own;if(!own) return;
  renderMini();
  const now=Date.now();let items,head="";
  if(miniSel!==null){
    items=calItems(miniSel,addDays(miniSel,1));
    head=`<div class="up-head"><b>${esc(dayLabel(miniSel))}</b><button class="btn ghost" id="upReset">Tout ce qui est à venir</button></div>`;
  }else{
    items=calItems(startOfDay(now),addDays(startOfDay(now),90)).filter(it=>(it.kind==="event"&&it.end>now)||it.kind==="deadline").sort((x,y)=>x.start-y.start).slice(0,6);
  }
  const empty=miniSel!==null?`<div class="empty">Rien de prévu ce jour-là.${adminUI()?` <button class="btn ghost" id="upAddDay">+ Ajouter un événement</button>`:""}</div>`
    :`<div class="empty">📅 Rien de prévu dans les prochaines semaines.${adminUI()?" Ajoutez un événement depuis le calendrier.":""}</div>`;
  $("upList").innerHTML=head+(items.length?items.map(upRowHTML).join(""):empty);
  $("upList").querySelectorAll("[data-ev]").forEach(b=>b.onclick=()=>openEvView(b.dataset.ev));
  $("upList").querySelectorAll("[data-pj]").forEach(b=>b.onclick=()=>openProject(b.dataset.pj));
  const r=$("upReset");if(r) r.onclick=()=>{miniSel=null;renderUpcoming(true);};
  const ad=$("upAddDay");if(ad) ad.onclick=()=>openEvDlg(null,miniSel);
}
/* ---------- Types d'activités communs à l'association ---------- */
// Seuls la personne propriétaire et les administrateurs modifient les intitulés ; tous les membres les utilisent.
let orgTypes=null;
function applyOrgTypes(list){
  if(!Array.isArray(list)||!list.length){
    orgTypes=null;
    if(adminUI()&&state.types.length) saveTypes();
    return;
  }
  orgTypes=JSON.parse(JSON.stringify(list));
  const ids=new Set(orgTypes.map(t=>t.id)),used=new Set(state.sessions.map(x=>x.typeId));
  if(state.active) used.add(state.active.typeId);
  const extra=state.types.filter(t=>!ids.has(t.id)&&used.has(t.id)).map(t=>Object.assign({},t,{archived:true,_personal:true}));
  const merged=orgTypes.concat(extra);
  if(JSON.stringify(merged)!==JSON.stringify(state.types)){state.types=merged;persist();}
  if(!state.types.some(t=>t.id===selectedType&&!t.archived)){const f=state.types.find(t=>!t.archived);selectedType=f?f.id:null;}
}
function saveTypes(){
  persist();
  if(!adminUI()||!curOrg) return;
  const list=state.types.filter(t=>!t._personal).map(t=>({id:t.id,name:t.name,color:t.color,archived:!!t.archived}));
  L.org(curOrg).update({activityTypes:list}).catch(()=>toast("Modification refusée : accès administrateur requis"));
}
/* ---------- Performance : ne réécrire un bloc que si son contenu a changé ---------- */
(function(){
  const desc=Object.getOwnPropertyDescriptor(Element.prototype,"innerHTML");
  ["orgList","kpis","upList","miniCal","dayCard","total","bars","journal","types","clock","who",
   "projGrid","myTasks","projDetail","teamTable","teamDayCard","calGrid","calDay","rolesList","recent"].forEach(id=>{
    const el=document.getElementById(id);if(!el) return;let last=null;
    Object.defineProperty(el,"innerHTML",{configurable:true,
      get(){return desc.get.call(this);},
      set(v){v=String(v);if(v===last)return;last=v;desc.set.call(this,v);}});
  });
})();

/* ---------- Visuels et commentaires des événements ---------- */
const EV_ICONS=["","📣","🎉","🎓","🤝","💼","📚","🎤","🎨","⚽","🍕","🎵","🏆","🌍","❤️"];
let evDraft={icon:"",image:""},comUnsub=null,comEv=null,comStars=0,comData=[];
function renderEvDraft(){
  $("eIcons").innerHTML=EV_ICONS.map(x=>`<button type="button" data-ic="${x}" aria-pressed="${x===evDraft.icon}" aria-label="${x?"Icône "+x:"Sans icône"}">${x||"∅"}</button>`).join("");
  $("eIcons").querySelectorAll("[data-ic]").forEach(b=>b.onclick=()=>{evDraft.icon=b.dataset.ic;renderEvDraft();});
  $("eVisPrev").hidden=!evDraft.image;$("eVisDel").hidden=!evDraft.image;if(evDraft.image)$("eVisImg").src=evDraft.image;
}
function shrinkPoster(file){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;let max=1000,d="";
      for(let k=0;k<6;k++){
        const r=Math.min(1,max/Math.max(w,h)),c=document.createElement("canvas");c.width=Math.round(w*r);c.height=Math.round(h*r);
        const g=c.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);
        let q=.82;d=c.toDataURL("image/jpeg",q);while(d.length>160000&&q>.45){q-=.1;d=c.toDataURL("image/jpeg",q);}
        if(d.length<=160000)break;max=Math.round(max*.8);
      }
      URL.revokeObjectURL(url);res(d);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("image"));};
    img.src=url;
  });
}
$("eVis").onchange=async()=>{
  const f=$("eVis").files[0];$("eVis").value="";if(!f)return;$("eErr").textContent="";
  try{evDraft.image=await shrinkPoster(f);renderEvDraft();}catch(e){$("eErr").textContent="Cette image n'a pas pu être lue. Essayez un fichier JPG ou PNG.";}
};
$("eVisDel").onclick=()=>{evDraft.image="";renderEvDraft();};

function relTime(t){
  const m=Math.round((Date.now()-t)/60000);
  if(m<1)return "à l'instant";if(m<60)return "il y a "+m+" min";
  const h=Math.round(m/60);if(h<24)return "il y a "+h+" h";
  return dayLabel(t)+" à "+fmtTime(t);
}
function starsHTML(n,cls){return `<span class="${cls||"st-show"}" aria-label="${n} sur 5">${"★".repeat(n)}${"☆".repeat(5-n)}</span>`;}
function renderStars(){
  const ev=events[comEv];const started=ev&&ev.start<=Date.now();
  $("evcStars").hidden=!started;
  $("evcStars").innerHTML=started?`<span class="since">Votre note :</span>`+[1,2,3,4,5].map(i=>`<button type="button" role="radio" aria-checked="${i===comStars}" aria-label="${i} étoile${i>1?"s":""}" data-star="${i}" class="${i<=comStars?"on":""}">★</button>`).join(""):"";
  $("evcStars").querySelectorAll("[data-star]").forEach(b=>b.onclick=()=>{const v=Number(b.dataset.star);comStars=comStars===v?0:v;renderStars();});
}
function renderComments(){
  const ev=events[comEv];if(!ev)return;
  const list=comData.slice().sort((a,b)=>a.at-b.at);
  const rated=list.filter(c=>c.rating>0),avg=rated.length?rated.reduce((m,c)=>m+c.rating,0)/rated.length:0;
  $("evcStats").textContent=(list.length?list.length+" message"+(list.length>1?"s":""):"")+(rated.length?" · "+avg.toFixed(1).replace(".",DEC())+" ★ ("+rated.length+" avis)":"");
  $("evcList").innerHTML=list.length?list.map(c=>{
    const org_=c.by===ev.createdBy;
    return `<div class="com ${org_?"orgz":""}"><span class="av" style="background:${hashColor(c.by)}">${esc(initials(c.byName||"?"))}</span>
      <div class="com-body"><div class="com-meta"><b>${esc(c.byName||"Membre")}</b>${org_?'<span class="com-badge">Organisateur</span>':""}<span>${esc(relTime(c.at))}</span>${c.rating?starsHTML(c.rating):""}</div>
      <div class="com-text">${linkify(c.text)}</div>
      ${c.by===myId||adminUI()?`<button class="btn ghost danger com-del" data-cdel="${esc(c.id)}">${pendingDelete==="c"+c.id?"Confirmer":"Supprimer"}</button>`:""}</div></div>`;}).join("")
    :`<div class="empty" style="padding:12px">💬 Aucun commentaire pour l'instant. Lancez la discussion !</div>`;
  $("evcList").querySelectorAll("[data-cdel]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.cdel;
    if(pendingDelete!=="c"+id){pendingDelete="c"+id;renderComments();setTimeout(()=>{if(pendingDelete==="c"+id){pendingDelete=null;renderComments();}},4000);return;}
    pendingDelete=null;EV.comments(comEv).doc(id).delete().catch(()=>toast("Suppression refusée"));
  });
  const box=$("evcList");box.scrollTop=box.scrollHeight;
}
function openComments(e){
  if(comUnsub){comUnsub();comUnsub=null;}
  comEv=e.id;comStars=0;comData=[];$("evcText").value="";
  $("evcText").placeholder=e.start<=Date.now()?"Votre avis, un retour sur la réunion…":"Votre commentaire ou une question avant la réunion…";
  renderStars();renderComments();
  comUnsub=EV.comments(e.id).onSnapshot(sn=>{comData=sn.docs.map(d=>Object.assign({},d.data(),{id:d.id}));renderComments();},()=>{});
}
$("evcSend").onclick=async()=>{
  const text=$("evcText").value.trim();
  if(!text&&!comStars){$("evcText").focus();return;}
  const btn=$("evcSend");btn.disabled=true;
  try{
    await EV.comments(comEv).doc("c_"+uid()).set({by:myId,byName:nameOf(myId),text,rating:comStars||0,at:Date.now()});
    $("evcText").value="";comStars=0;renderStars();
  }catch(e){toast("Impossible de publier le commentaire");}
  btn.disabled=false;
};
$("evcText").onkeydown=e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();$("evcSend").click();}};
/* ---------- Liens détectés automatiquement (sites, courriels, téléphones) ---------- */
const LINK_RE=/(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+\.[^\s<>"]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?:\s*(?:poste|ext\.?|#)\s*\d{1,6})?)/gi;
function linkify(text){
  const t=String(text||"");let out="",last=0;
  for(const m of t.matchAll(LINK_RE)){
    let raw=m[0],start=m.index;
    // ponctuation finale qui ne fait pas partie du lien
    let trail="";while(/[.,;:!?)\]»']$/.test(raw)&&!(raw.endsWith(")")&&raw.includes("("))){trail=raw.slice(-1)+trail;raw=raw.slice(0,-1);}
    let href;
    if(/^https?:\/\//i.test(raw)) href=raw;
    else if(/^www\./i.test(raw)) href="https://"+raw;
    else if(raw.includes("@")) href="mailto:"+raw;
    else href="tel:"+raw.replace(/(?:poste|ext\.?|#)\s*(\d+)/i,",$1").replace(/[^\d+,]/g,"");
    out+=esc(t.slice(last,start))+`<a class="autolink" href="${esc(href)}" ${href.startsWith("http")?'target="_blank" rel="noopener noreferrer"':""}>${esc(raw)}</a>`+esc(trail);
    last=start+m[0].length;
  }
  return out+esc(t.slice(last));
}

/* ---------- Chargement (squelette), reprise sur erreur ---------- */
const RETRY_CODES=/unavailable|resource[_-]exhausted|deadline|aborted|internal|network/i;
async function withRetry(fn,tries=4){
  let wait=400;
  for(let i=0;;i++){
    try{return await fn();}
    catch(e){if(i>=tries-1||!RETRY_CODES.test((e&&(e.code||e.message))||""))throw e;await new Promise(r=>setTimeout(r,wait+Math.random()*250));wait*=2;}
  }
}
let booted=false;
function bootDone(){booted=true;document.body.classList.remove("booting","bootfail");}
function bootFail(){if(booted)return;document.body.classList.add("bootfail");$("skErr").hidden=false;}
$("skRetry").onclick=()=>location.reload();
setTimeout(()=>{if(!booted&&document.body.classList.contains("booting"))bootFail();},25000);

/* ---------- Retour en arrière (bouton et bouton « précédent » du navigateur) ---------- */
let lastNavKey=null,navRestoring=false,navDepth=0,histOK=true;
const navKey=()=>mode+"|"+(mode==="project"?projOpen||"":"")+"|"+(mode==="person"?viewingId||"":"");
function recordNav(){
  const k=navKey();if(k===lastNavKey)return;
  const st={nav:{mode,projOpen,viewingId}};
  try{
    if(lastNavKey===null){navDepth=(history.state&&history.state.depth)||0;st.depth=navDepth;history.replaceState(st,"");}
    else if(!navRestoring){navDepth++;st.depth=navDepth;history.pushState(st,"");}
  }catch(e){histOK=false;}
  lastNavKey=k;$("navBack").hidden=!(histOK&&navDepth>0);
}
window.addEventListener("popstate",e=>{
  const n=e.state&&e.state.nav;if(!n)return;
  navRestoring=true;navDepth=e.state.depth||0;
  document.querySelectorAll("dialog[open]").forEach(d=>d.close());
  if(!$("timerPanel").hidden)openTimer(false);
  mode=n.mode||"mine";projOpen=n.projOpen||null;viewingId=n.viewingId||null;
  if(mode==="project"&&projOpen)watchFilesFor(projOpen);
  if(mode==="person"&&!viewingId)mode="team";
  renderNow();navRestoring=false;window.scrollTo(0,0);
});
$("navBack").onclick=()=>history.back();
/* ---------- Navigation / rendu ---------- */
document.querySelectorAll("#period button").forEach(b=>b.onclick=()=>{period=b.dataset.p;renderSummary();const bs=$("bars");bs.classList.remove("anim");void bs.offsetWidth;bs.classList.add("anim");});
document.querySelectorAll("#teamPeriod button").forEach(b=>b.onclick=()=>{teamPeriod=b.dataset.p;renderTeam();});
document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>{mode=b.dataset.tab;viewingId=null;journalLimit=14;render();});
// Regroupe les nombreux rendus déclenchés par les mises à jour en direct : un seul rendu par image.
let _rq=0;
function render(){if(_rq)return;_rq=1;const run=()=>{if(!_rq)return;_rq=0;renderNow();};requestAnimationFrame(run);setTimeout(run,80);}
function renderNow(){
  renderNotifSoon();
  const noorg=orgsLoaded&&!curOrg;
  document.body.classList.toggle("noorg",noorg);
  if(noorg&&mode!=="mine"&&mode!=="settings") mode="mine";
  if(!$("timerPanel").hidden) renderClock(); else renderTimerBtn();
  const hr=new Date().getHours();const nm=myId?nameOf(myId):"";
  const first=nm&&nm!=="Moi"&&nm!=="Personne sans nom"?" "+nm.split(/\s+/)[0]:"";
  $("today").textContent=tx(hr>=18||hr<5?"Bonsoir":"Bonjour")+first+(curOrg&&org.orgName?" · "+org.orgName:"")+" · "+new Date().toLocaleDateString(LOC(),{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const tabSel=mode==="person"?"team":mode==="project"?"projects":mode;
  $("pageTitle").textContent={settings:"Paramètres",calendar:"Calendrier",activities:"Activités",mine:"Accueil",projects:"Projets",project:"Projets",team:"Équipe",person:"Équipe",roles:"Rôles"}[mode]||"";
  document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-selected",b.dataset.tab===tabSel));
  recordNav();
  renderAccess();
  $("teamView").hidden=mode!=="team";
  $("rolesView").hidden=mode!=="roles";
  const inProj=mode==="projects"||mode==="project";
  $("projectsView").hidden=!inProj;
  $("settingsView").hidden=mode!=="settings";
  $("calView").hidden=mode!=="calendar";
  $("personalView").hidden=mode==="team"||mode==="roles"||inProj||mode==="settings"||mode==="calendar"||mode==="activities";
  $("activitiesView").hidden=!(mode==="activities"||mode==="person");
  if(mode!=="activities") $("pendSec").hidden=true;
  if(layEdit&&layCurView()!==layView) laySetEdit(false);
  if(mode==="settings") renderSettings();
  else if(mode==="calendar") renderCalendar();
  else if(inProj) renderProjects();
  else if(mode==="team"){renderTeam();renderTeamDay();renderTeamCharts();}
  else if(mode==="roles") renderRoles();
  else if(mode==="activities"){renderJournal();renderTypes();renderPending();}
  else{renderWho();renderOrgs();renderDash();renderDay();renderSummary();renderCharts();if(mode==="person"){renderJournal();renderTypes();}}
  layRefresh();
}
function renderNotifSoon(){clearTimeout(renderNotifSoon._t);renderNotifSoon._t=setTimeout(()=>{try{notifRefresh();}catch(e){}},300);}
/* ---- Disposition personnalisable (tous les onglets) ---- */
const LAY_VIEWS={mine:"pointeuse-accueil",activities:"pointeuse-dispo-activites",projects:"pointeuse-dispo-projets",calendar:"pointeuse-dispo-calendrier",team:"pointeuse-dispo-equipe",roles:"pointeuse-dispo-roles",settings:"pointeuse-dispo-parametres"};
// Première visite : accueil allégé. Les blocs masqués restent disponibles avec « Modifier l'accueil ».
const LAY_STARTER={mine:["day","hours","charts"]};
const LAY_EASE="cubic-bezier(.22,1,.36,1)";
// Les animations de déplacement utilisent l'API Web Animations : elles restent fluides même si le système
// réduit les transitions CSS. Seule l'option « Réduire les mouvements » de l'application les coupe.
const layMotion=()=>!document.body.classList.contains("nomotion");
let layEdit=false,layView=null,layDrag=null;
const layBox=v=>document.querySelector(`[data-lay="${v}"]`);
const layBlocks=v=>{const b=layBox(v);return b?[...b.querySelectorAll(":scope>[data-blk]")]:[];};
const LAY_DEF={};Object.keys(LAY_VIEWS).forEach(v=>LAY_DEF[v]=layBlocks(v).map(b=>b.dataset.blk));
const layKey=v=>LAY_VIEWS[v]+":"+(myId||"anon");
const welcomeKey=()=>"pointeuse-bienvenue:"+(myId||"anon");
const layCurView=()=>LAY_VIEWS[mode]?mode:null;
const layShown=o=>o.getClientRects().length>0;
function laySave(v,o){try{localStorage.setItem(layKey(v),JSON.stringify(o));}catch(e){}}
function layLoad(v){
  try{const s=JSON.parse(localStorage.getItem(layKey(v))||"null");if(s&&Array.isArray(s.order))return{order:s.order,hidden:Array.isArray(s.hidden)?s.hidden:[]};}catch(e){}
  const o={order:LAY_DEF[v].slice(),hidden:[]};
  // Nouvelle personne (données chargées, aucune entrée) : on enregistre la version allégée une seule fois.
  if(LAY_STARTER[v]&&booted&&myId&&curOrg&&!state.sessions.length&&!state.active){
    o.hidden=LAY_STARTER[v].slice();laySave(v,o);
    try{localStorage.setItem(welcomeKey(),"1");}catch(e){}
  }
  return o;
}
function layOrder(v,o){
  const def=LAY_DEF[v],out=o.order.filter(k=>def.includes(k));
  def.forEach((k,i)=>{if(out.includes(k))return;const prev=def.slice(0,i).reverse().find(x=>out.includes(x));out.splice(prev?out.indexOf(prev)+1:0,0,k);});
  return out;
}
function layApply(v){
  if(!v||layDrag) return;
  const box=layBox(v);if(!box) return;
  const o=layLoad(v),order=layOrder(v,o),blocks=layBlocks(v);
  if(blocks.map(b=>b.dataset.blk).join()!==order.join()){
    const anchor=blocks.length?blocks[blocks.length-1].nextSibling:null; // garde les éléments qui suivent les blocs (ex. bouton de réinitialisation)
    order.forEach(k=>box.insertBefore(box.querySelector(`:scope>[data-blk="${k}"]`),anchor));
  }
  layBlocks(v).forEach(b=>{const off=o.hidden.includes(b.dataset.blk);b.classList.toggle("lay-off",off);
    const t=b.querySelector(":scope>.blkbar .bb-vis");if(t){t.textContent=off?"Afficher":"Masquer";t.setAttribute("aria-pressed",off?"true":"false");}});
  layPair(v);
}
function layPair(v){
  const editing=layEdit&&layView===v,all=layBlocks(v);
  const vis=all.filter(b=>!b.hidden&&(editing||!b.classList.contains("lay-off")));
  all.forEach(b=>b.classList.toggle("lay-first",b===vis[0]));
  for(let i=0;i<vis.length;i++){const b=vis[i];if(!b.classList.contains("col2"))continue;
    const n=vis[i+1];if(n&&n.classList.contains("col2")){b.classList.remove("solo");n.classList.remove("solo");i++;}else b.classList.add("solo");}
}
function layCurrent(v){const bl=layBlocks(v);return{order:bl.map(b=>b.dataset.blk),hidden:bl.filter(b=>b.classList.contains("lay-off")).map(b=>b.dataset.blk)};}
// Position de mise en page d'un bloc, sans la translation d'animation en cours.
function layRect(o){
  const r=o.getBoundingClientRect();let dx=0,dy=0;
  try{const m=new DOMMatrixReadOnly(getComputedStyle(o).transform);dx=m.m41;dy=m.m42;}catch(e){}
  return{left:r.left-dx,right:r.right-dx,top:r.top-dy,bottom:r.bottom-dy,width:r.width,height:r.height};
}
// Animation FLIP : chaque bloc glisse de son ancienne position vers la nouvelle.
function layFlip(v,fn){
  const els=layBlocks(v).filter(o=>!(layDrag&&o===layDrag.b)&&layShown(o));
  const first=new Map(els.map(o=>[o,o.getBoundingClientRect()]));
  fn();
  if(!layMotion()) return;
  els.forEach(o=>{if(o._anim){o._anim.cancel();o._anim=null;}});
  els.forEach(o=>{
    if(!layShown(o)) return;
    const f=first.get(o),l=o.getBoundingClientRect(),dx=f.left-l.left,dy=f.top-l.top;
    if(Math.abs(dx)<.5&&Math.abs(dy)<.5) return;
    const an=o.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:"translate(0,0)"}],{duration:320,easing:LAY_EASE});
    o._anim=an;an.onfinish=an.oncancel=()=>{if(o._anim===an)o._anim=null;};
  });
}
function layBars(v,on){
  layBlocks(v).forEach(b=>{let bar=b.querySelector(":scope>.blkbar");
    if(on&&!bar){bar=document.createElement("div");bar.className="blkbar";
      bar.innerHTML=`<button class="bb-grip" aria-label="Déplacer le bloc ${esc(b.dataset.lbl)} (flèches haut et bas)" title="Glisser pour déplacer">⠿</button><span class="bb-name">${esc(b.dataset.lbl)}</span><button class="btn bb-vis"></button>`;
      b.prepend(bar);
      bar.querySelector(".bb-vis").onclick=()=>layFlip(v,()=>{b.classList.toggle("lay-off");laySave(v,layCurrent(v));layApply(v);});
      const g=bar.querySelector(".bb-grip");
      g.addEventListener("pointerdown",e=>layStart(e,b,g));
      g.addEventListener("keydown",e=>{const box=layBox(v);let ref;
        if(e.key==="ArrowUp"){const p=b.previousElementSibling;if(!p||!p.dataset.blk)return;ref=p;}
        else if(e.key==="ArrowDown"){const n=b.nextElementSibling;if(!n||!n.dataset.blk)return;ref=n.nextSibling;}
        else return;
        e.preventDefault();layFlip(v,()=>{box.insertBefore(b,ref);layPair(v);});laySave(v,layCurrent(v));g.focus({preventScroll:true});b.scrollIntoView({block:"nearest",behavior:"smooth"});});
    }
    if(!on&&bar) bar.remove();
  });
}
function laySetEdit(on){
  if(on===layEdit) return;
  const v=on?layCurView():layView;
  if(!v){layEdit=false;layView=null;document.body.classList.remove("layedit");$("homeEditBar").hidden=true;return;}
  layEdit=on;layView=on?v:null;
  layFlip(v,()=>{
    document.body.classList.toggle("layedit",on);
    $("homeEditBar").hidden=!on;
    layBars(v,on);
    if(!on) layBlocks(v).forEach(b=>{b.style.transform="";});
    layApply(v);
  });
  if(on){const g=layBox(v).querySelector(".bb-grip");if(g)g.focus({preventScroll:true});}
  else if(!$("homeBar").hidden) $("homeEdit").focus({preventScroll:true});
}
// Glisser-déposer : le bloc suit le pointeur image par image, un fantôme montre où il sera déposé,
// les autres blocs s'écartent en glissant et la page défile doucement près des bords.
function layStart(e,b,g){
  if(e.button>0||layDrag||!layView) return;e.preventDefault();
  try{g.setPointerCapture(e.pointerId);}catch(_){}
  if(b._anim){b._anim.cancel();b._anim=null;}b.classList.remove("lay-settle");
  const r=b.getBoundingClientRect();
  const d=layDrag={b,v:layView,id:e.pointerId,x:e.clientX,y:e.clientY,ox:e.clientX-r.left,oy:e.clientY-r.top,tx:0,ty:0,raf:0,px:NaN,py:NaN,sy:NaN,gh:null,gx:r.left,gy:r.top};
  const gh=d.gh=document.createElement("div");gh.className="lay-ghost";
  gh.style.width=r.width+"px";gh.style.height=r.height+"px";gh.style.transform=`translate(${r.left}px,${r.top}px)`;
  document.body.appendChild(gh);
  b.classList.add("dragging");document.body.classList.add("lay-dragging");
  if(layMotion()) b.animate([{boxShadow:"0 0 0 rgba(16,24,40,0)"},{boxShadow:"0 12px 30px rgba(16,24,40,.18)"}],{duration:180,easing:"ease-out"});
  const loop=()=>{if(layDrag!==d)return;layTick();d.raf=requestAnimationFrame(loop);};
  d.raf=requestAnimationFrame(loop);
  const move=ev=>{if(ev.pointerId===d.id){d.x=ev.clientX;d.y=ev.clientY;}};
  const end=ev=>{if(ev.pointerId!==d.id)return;
    cancelAnimationFrame(d.raf);
    removeEventListener("pointermove",move,true);removeEventListener("pointerup",end,true);removeEventListener("pointercancel",end,true);
    layDrag=null;
    const from=b.style.transform;b.style.transform="";b.classList.remove("dragging");document.body.classList.remove("lay-dragging");
    const gr=b.getBoundingClientRect(); // emplacement final
    if(layMotion()&&from){
      b.classList.add("lay-settle");
      const an=b.animate([{transform:from},{transform:"translate(0,0)"}],{duration:300,easing:LAY_EASE});
      b._anim=an;an.onfinish=an.oncancel=()=>{b.classList.remove("lay-settle");if(b._anim===an)b._anim=null;};
      gh.style.transform=`translate(${gr.left}px,${gr.top}px)`;
      gh.animate([{opacity:1},{opacity:0}],{duration:260,easing:"ease-out",fill:"forwards"}).onfinish=()=>gh.remove();
    }else gh.remove();
    laySave(d.v,layCurrent(d.v));layApply(d.v);};
  // Écoute sur la fenêtre : déplacer le bloc dans la page fait perdre la capture du pointeur à la poignée.
  addEventListener("pointermove",move,true);addEventListener("pointerup",end,true);addEventListener("pointercancel",end,true);
}
function layTick(){
  const d=layDrag;
  // défilement automatique, plus rapide à mesure qu'on approche du bord
  const edge=90,bottom=innerHeight-edge-60;let sp=0;
  if(d.y<edge) sp=-Math.ceil((edge-d.y)/edge*20);
  else if(d.y>bottom) sp=Math.ceil(Math.min(1,(d.y-bottom)/edge)*20);
  if(sp) scrollBy(0,sp);
  if(d.x!==d.px||d.y!==d.py||scrollY!==d.sy){d.px=d.x;d.py=d.y;d.sy=scrollY;layMove();}
  layFollow();
  // le fantôme rejoint l'emplacement de dépôt en douceur
  const r=d.b.getBoundingClientRect(),lx=r.left-d.tx,ly=r.top-d.ty,k=layMotion()?.3:1;
  d.gx+=(lx-d.gx)*k;d.gy+=(ly-d.gy)*k;
  d.gh.style.width=r.width+"px";d.gh.style.height=r.height+"px";
  d.gh.style.transform=`translate(${d.gx}px,${d.gy}px)`;
}
function layFollow(){
  const d=layDrag,r=d.b.getBoundingClientRect();
  const lx=r.left-d.tx,ly=r.top-d.ty;
  d.tx=d.x-d.ox-lx;d.ty=d.y-d.oy-ly;
  d.b.style.transform=`translate(${d.tx}px,${d.ty}px)`;
}
function layMove(){
  const d=layDrag,{b,x,y}=d,box=layBox(d.v);
  const t=layBlocks(d.v).find(o=>{if(o===b||o.hidden||!layShown(o))return false;const r=layRect(o);return y>=r.top-11&&y<=r.bottom+11&&x>=r.left-11&&x<=r.right+11;});
  if(!t) return;
  const r=layRect(t),bTop=b.getBoundingClientRect().top-d.ty;
  const side=Math.abs(r.top-bTop)<20&&t.classList.contains("col2")&&b.classList.contains("col2");
  const after=side?x>r.left+r.width/2:y>r.top+r.height/2;
  const ref=after?t.nextSibling:t;
  const already=after?t.nextElementSibling===b:b.nextElementSibling===t;
  if(!already) layFlip(d.v,()=>{box.insertBefore(b,ref);layPair(d.v);});
}
function layRefresh(){
  const v=layCurView(),lbl=v==="mine"?"Modifier l'accueil":"Modifier la disposition",el=$("homeEditLbl");
  $("homeBar").hidden=!v;
  if(el.dataset.k!==lbl){el.dataset.k=lbl;el.textContent=lbl;}
  if(v) layApply(v);
  welcomeRender();
}
$("homeEdit").onclick=()=>laySetEdit(true);
$("homeDone").onclick=()=>laySetEdit(false);
$("homeReset").onclick=()=>{const v=layView;if(!v)return;layFlip(v,()=>{laySave(v,{order:LAY_DEF[v].slice(),hidden:[]});layApply(v);});};
document.addEventListener("keydown",e=>{if(layEdit&&e.key==="Escape"&&!layDrag&&!document.querySelector("dialog[open]"))laySetEdit(false);});
/* ---- Première visite : message d'accueil ---- */
function welcomeRender(){
  let on=false;try{on=localStorage.getItem(welcomeKey())==="1";}catch(e){}
  $("welcomeCard").hidden=!(on&&mode==="mine"&&curOrg);
}
const welcomeDone=()=>{try{localStorage.setItem(welcomeKey(),"0");}catch(e){}welcomeRender();};
$("wcOk").onclick=welcomeDone;
$("wcEdit").onclick=()=>{welcomeDone();laySetEdit(true);};
$("wcAll").onclick=()=>{welcomeDone();layFlip("mine",()=>{laySave("mine",{order:layCurrent("mine").order,hidden:[]});layApply("mine");});toast("Tous les blocs sont affichés");};
/* ---- Fenêtres : un clic sur le fond les ferme ---- */
{
  const outside=(d,e)=>{const r=d.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
  let downOn=null; // le clic doit commencer ET finir sur le fond (évite de fermer en sélectionnant du texte)
  document.addEventListener("pointerdown",e=>{const d=e.target;downOn=d instanceof HTMLDialogElement&&d.open&&outside(d,e)?d:null;},true);
  document.addEventListener("click",e=>{const d=e.target;
    if(d===downOn&&d instanceof HTMLDialogElement&&d.open&&!d.dataset.busy&&outside(d,e)){e.preventDefault();d.close();}
    downOn=null;},true);
}
let lastMinute=-1;
document.addEventListener("visibilitychange",()=>{if(!document.hidden)render();});
setInterval(()=>{
  if(document.hidden) return;
  const d=view();
  if(state.active){const el=Date.now()-state.active.start;const t=$("timer");if(t)t.textContent=fmtClock(el);$("tbTime").textContent=fmtClock(el);}
  if(mode==="mine"||mode==="person"){const dl=$("dashLive");if(dl&&d.active)dl.textContent=fmtClock(Date.now()-d.active.start);}
  const m=new Date().getMinutes();
  if(m!==lastMinute){lastMinute=m;checkReminder();renderNotifSoon();
    if(mode==="team"){renderTeam();renderTeamDay();}
    else if(mode==="roles"){}
    else if(mode==="activities"){if(state.active&&!pendingDelete)renderJournal();}
    else if(mode==="mine"||mode==="person"){renderDash();if(d.active){renderSummary();renderDay();if(!pendingDelete)renderJournal();}}
  }
},1000);
/* ---------- Aperçu sans compte : vraie interface, données fictives gardées en mémoire ---------- */
const DEMO=(()=>{try{return sessionStorage.getItem("pointeuse-demo")==="1";}catch(e){return false;}})();
function memDB(seed){
  const D=new Map(Object.entries(seed)),subs=new Set();let pend=0;
  const plain=v=>!!v&&typeof v==="object"&&Object.getPrototypeOf(v)===Object.prototype;
  const cp=v=>Array.isArray(v)?v.map(cp):plain(v)?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,cp(x)])):v;
  const isDel=x=>{try{return !!x&&!plain(x)&&typeof x.isEqual==="function"&&x.isEqual(firebase.firestore.FieldValue.delete());}catch(e){return false;}};
  const strip=o=>{if(plain(o))Object.keys(o).forEach(k=>{if(isDel(o[k]))delete o[k];else strip(o[k]);});return o;};
  const merge=(a,b)=>{Object.keys(b).forEach(k=>{const v=b[k];if(isDel(v))delete a[k];else if(plain(v)&&plain(a[k]))merge(a[k],v);else a[k]=strip(cp(v));});return a;};
  const ping=()=>{if(pend)return;pend=setTimeout(()=>{pend=0;subs.forEach(f=>{try{f();}catch(e){console.error(e);}});},0);};
  const rid=()=>Math.random().toString(36).slice(2,12)+Date.now().toString(36).slice(-4);
  const snap=p=>{const v=D.get(p);return{id:p.split("/").pop(),exists:v!==undefined,data:()=>v===undefined?undefined:cp(v),get:k=>v===undefined?undefined:cp(v[k]),ref:docRef(p)};};
  const kids=p=>{const n=p.split("/").length+1;return [...D.keys()].filter(k=>k.startsWith(p+"/")&&k.split("/").length===n).sort();};
  const qsnap=docs=>({docs,empty:!docs.length,size:docs.length,forEach:f=>docs.forEach(f),docChanges:()=>docs.map(d=>({type:"added",doc:d}))});
  const listen=(fn,next,err)=>{const f=()=>{try{next(fn());}catch(e){if(err)err(e);else console.error(e);}};subs.add(f);setTimeout(f,0);return()=>subs.delete(f);};
  function docRef(p){return{id:p.split("/").pop(),path:p,
    collection:c=>colRef(p+"/"+c),
    get:async()=>snap(p),
    set:async(v,o)=>{D.set(p,o&&o.merge?merge(cp(D.get(p)||{}),v):strip(cp(v)));ping();},
    update:async v=>{if(!D.has(p))throw{code:"not-found"};const cur=cp(D.get(p));
      Object.keys(v).forEach(k=>{const ks=k.split(".");let o=cur;for(let i=0;i<ks.length-1;i++){if(!plain(o[ks[i]]))o[ks[i]]={};o=o[ks[i]];}
        const last=ks[ks.length-1];if(isDel(v[k]))delete o[last];else o[last]=strip(cp(v[k]));});
      D.set(p,cur);ping();},
    delete:async()=>{D.delete(p);ping();},
    onSnapshot:(next,err)=>listen(()=>snap(p),next,err)};}
  function colRef(p,f=[],ord=null,lim=0){
    const run=()=>{let ds=kids(p).map(snap);
      f.forEach(([fl,op,val])=>{ds=ds.filter(d=>{const x=(d.data()||{})[fl];return op==="array-contains"?Array.isArray(x)&&x.includes(val):op==="in"?val.includes(x):op==="!="?x!==val:x===val;});});
      if(ord) ds.sort((a,b)=>{const x=a.data()[ord[0]],y=b.data()[ord[0]];return (x>y?1:x<y?-1:0)*(ord[1]==="desc"?-1:1);});
      if(lim) ds=ds.slice(0,lim);return qsnap(ds);};
    return{id:p.split("/").pop(),path:p,
      doc:id=>docRef(p+"/"+(id||rid())),
      where:(fl,op,val)=>colRef(p,f.concat([[fl,op,val]]),ord,lim),
      orderBy:(fl,dir)=>colRef(p,f,[fl,dir||"asc"],lim),
      limit:n=>colRef(p,f,ord,n),
      get:async()=>run(),
      add:async v=>{const r=docRef(p+"/"+rid());await r.set(v);return r;},
      onSnapshot:(next,err)=>listen(run,next,err)};}
  return{collection:c=>colRef(c),doc:p=>docRef(p),enablePersistence:async()=>{},
    batch:()=>{const ops=[];return{set:(r,v,o)=>{ops.push(()=>r.set(v,o));},update:(r,v)=>{ops.push(()=>r.update(v));},delete:r=>{ops.push(()=>r.delete());},commit:async()=>{for(const op of ops)await op();}};}};
}
function demoSeed(){
  const now=Date.now(),H=3600000,DY=86400000,t0=startOfDay(now),O="orgs/demo-org",T=JSON.parse(JSON.stringify(DEFAULT.types));
  const ppl=[["demo","Visiteur","r_president"],["d_camille","Camille Roy","r_vp"],["d_samuel","Samuel Gagnon","r_employe"],["d_lea","Léa Tremblay","r_employe"],["d_noah","Noah Bergeron","r_employe"]];
  const names=Object.fromEntries(ppl.map(p=>[p[0],p[1]]));
  const at=(off,h,m)=>{const d=new Date(t0);d.setDate(d.getDate()+off);d.setHours(h,m||0,0,0);return d.getTime();};
  const ymd=off=>dayKey(at(off,12));
  const notes={t_travail:["Kiosque d'accueil","Préparation du gala","Mise à jour du site web","Inventaire du local"],t_reunion:["Réunion du conseil","Comité organisateur"],t_formation:["Formation premiers soins","Atelier d'animation"],t_admin:["Comptabilité","Courriels aux membres"]};
  let seed=11;const rnd=()=>(seed=seed*16807%2147483647)/2147483647;
  const db={"userOrgs/demo":{orgIds:["demo-org"],displayName:"Visiteur",email:""},
    [O]:{name:"Association étudiante (démo)",ownerUid:"demo",code:"DEMO2026",createdAt:now-60*DY,defaultRoleId:"r_employe",roles:JSON.parse(JSON.stringify(DEFAULT_ROLES.roles)),adminRoleIds:["r_president","r_vp"],hourlyValue:25,activityTypes:T},
    "codes/DEMO2026":{orgId:"demo-org",name:"Association étudiante (démo)",defaultRoleId:"r_employe"}};
  ppl.forEach(([id,name,role],pi)=>{
    db[O+"/members/"+id]={uid:id,name,roleId:role,joinedAt:now-50*DY};
    const sessions=[],val={entries:{},rejected:{}};
    for(let k=1;k<=21;k++){
      if(rnd()<.45) continue;
      const ty=T[Math.floor(rnd()*T.length)],start=at(-k,9+Math.floor(rnd()*8),rnd()<.5?30:0),end=start+(1+Math.floor(rnd()*4))*H;
      const s={id:"s"+pi+"_"+k,typeId:ty.id,start,end,note:notes[ty.id][Math.floor(rnd()*notes[ty.id].length)]};
      if(rnd()<.35) s.projectId=rnd()<.5?"p_gala":"p_recrue";
      sessions.push(s);
      if(k>4) val.entries[s.id]={typeId:s.typeId,typeName:ty.name,start,end,note:s.note,by:"demo",byName:"Visiteur",at:end+DY};
    }
    db[O+"/people/"+id]={types:T,sessions,active:pi===1?{typeId:"t_travail",start:now-95*60000,note:"Kiosque d'accueil",projectId:""}:null,prefs:{},displayName:name,email:"",photoURL:"",updatedAt:now};
    db[O+"/validations/"+id]=val;
  });
  const proj=(id,title,description,members,dl,budget)=>{db[O+"/projects/"+id]={title,description,deadline:ymd(dl),startDate:ymd(-20),milestones:[],status:"actif",budgetHours:budget,memberIds:members,memberNames:Object.fromEntries(members.map(m=>[m,names[m]])),createdBy:"demo",createdAt:now-20*DY,updatedAt:now-DY};};
  const task=(pid,id,title,who,status,progress,dl)=>{db[O+"/projects/"+pid+"/tasks/"+id]={title,description:"",deadline:dl==null?"":ymd(dl),kind:who.length>1?"collective":"individuelle",assigneeIds:who,status,progress,createdAt:now-10*DY,updatedAt:now-DY,log:[]};};
  proj("p_gala","Gala de fin d'année","Soirée de remise des prix pour les membres et les partenaires.",["demo","d_camille","d_samuel","d_lea"],30,60);
  task("p_gala","t_salle","Réserver la salle",["d_camille"],"terminee",100,-5);
  task("p_gala","t_comm","Préparer l'affiche et les invitations",["demo"],"en_cours",40,6);
  task("p_gala","t_comm2","Trouver trois commanditaires",["d_samuel","d_lea"],"a_faire",0,14);
  task("p_gala","t_menu","Valider le menu avec le traiteur",["demo"],"a_verifier",90,3);
  proj("p_recrue","Campagne de recrutement","Kiosques et activités pour accueillir de nouveaux bénévoles.",["demo","d_lea","d_noah"],12,25);
  task("p_recrue","t_kiosque","Tenir le kiosque à la cafétéria",["d_lea","d_noah"],"en_cours",50,2);
  task("p_recrue","t_form","Créer le formulaire d'inscription",["demo"],"a_faire",0,4);
  const ev=(id,title,type,off,h1,m1,h2,m2,x)=>{db[O+"/events/"+id]=Object.assign({title,type,allDay:false,start:at(off,h1,m1),end:at(off,h2,m2),date:"",tz:userTZ(),video:false,location:"",description:"",icon:"",image:"",createdBy:"demo",createdByName:"Visiteur",createdAt:now-5*DY,updatedAt:now-5*DY},x||{});};
  ev("e_conseil","Réunion du conseil","reunion",2,18,0,19,30,{video:true,location:"Local de l'association",description:"Ordre du jour : budget du gala, campagne de recrutement.",icon:"🗳️"});
  ev("e_form","Formation premiers soins","formation",9,13,0,16,0,{location:"Salle B-204",icon:"🩹"});
  ev("e_past","Comité organisateur","reunion",-3,17,0,18,0,{icon:"📋"});
  {const d=new Date(at(16,12));const s=Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
   db[O+"/events/e_gala"]={title:"Gala de fin d'année",type:"evenement",allDay:true,start:s,end:s+DY,date:ymd(16),tz:"",video:false,location:"Centre communautaire",description:"Tenue de soirée suggérée.",icon:"🎉",image:"",createdBy:"demo",createdByName:"Visiteur",createdAt:now-5*DY,updatedAt:now-5*DY};}
  return db;
}
function exitDemo(signup){try{sessionStorage.removeItem("pointeuse-demo");if(signup)sessionStorage.setItem("pointeuse-signup","1");}catch(e){}location.reload();}
function startDemo(){
  fdb=memDB(demoSeed());
  const u={uid:"demo",email:"",displayName:"Visiteur",photoURL:"",providerData:[],delete:async()=>{},updateProfile:async()=>{},reauthenticateWithCredential:async()=>{},reauthenticateWithPopup:async()=>{}};
  auth={currentUser:u,onAuthStateChanged:cb=>{setTimeout(()=>cb(u),0);return()=>{};},signOut:async()=>exitDemo(false),signInWithPopup:async()=>{},sendPasswordResetEmail:async()=>{throw{code:"demo"};}};
  document.body.classList.add("demo");$("demoBar").hidden=false;
  auth.onAuthStateChanged(x=>startSession(x).catch(err=>{console.error(err);setSync("Erreur de chargement : "+(err.code||err.message));}));
}
$("demoBtn").onclick=()=>{try{sessionStorage.setItem("pointeuse-demo","1");}catch(e){}location.reload();};
$("demoSignup").onclick=()=>exitDemo(true);
$("demoExit").onclick=()=>exitDemo(false);
try{if(sessionStorage.getItem("pointeuse-signup")){sessionStorage.removeItem("pointeuse-signup");setAuthMode(true);}}catch(e){}
// Dans l'aperçu, les actions qui touchent un vrai compte sont réservées aux personnes inscrites.
if(DEMO) document.addEventListener("click",e=>{
  const b=e.target.closest&&e.target.closest("#newOrgBtn,#joinOrgBtn,#sLeave,#sDelete,#accDel,#sPw,#accPw,#sNewCode,#doOk");
  if(!b) return;e.preventDefault();e.stopImmediatePropagation();toast("Créez un compte gratuit pour utiliser cette fonction.",3200);
},true);
/* Langue */
{const sl=$("sLang");sl.innerHTML=Object.keys(I18N).map(k=>`<option value="${k}" lang="${k}" translate="no">${esc(I18N[k]._name)}</option>`).join("");sl.value=LANG;
 sl.onchange=()=>setLang(sl.value);
 window.onLangChange=()=>{sl.value=LANG;render();};}
initFirebase();
})();
