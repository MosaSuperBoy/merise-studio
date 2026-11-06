// ===== STOCKAGE : localStorage, fichiers JSON, serveur PHP, PNG, PDF =====
const CLE='merise:projets',API='api.php';
const lireTous=()=>{try{return JSON.parse(localStorage.getItem(CLE))||{}}catch(e){return{}}};
function sauver(){P.maj=Date.now();try{const m=lireTous();m[P.id]=P;localStorage.setItem(CLE,JSON.stringify(m));localStorage.setItem('merise:dernier',P.id)}catch(e){alert('Stockage local plein ou indisponible.')}}
function supprimerLocal(id){const m=lireTous();delete m[id];localStorage.setItem(CLE,JSON.stringify(m))}
function telecharger(blob,nom){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nom;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
const exportJSON=()=>telecharger(new Blob([JSON.stringify(P)],{type:'application/json'}),(P.nom||'projet').replace(/\W+/g,'_')+'.json');
function importJSON(f){const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result);if(!p.tabs)throw 0;p.id=p.id||uid();P=p;sauver();ouvrir(P)}catch(e){alert('Fichier invalide.')}};r.readAsText(f)}
function exportPNG(){const v=svgExport();if(!v)return alert('Diagramme vide.');const im=new Image(),k=2;
 im.onload=()=>{const c=document.createElement('canvas');c.width=v.w*k;c.height=v.h*k;const g=c.getContext('2d');g.scale(k,k);g.drawImage(im,0,0);c.toBlob(b=>telecharger(b,(ONGLETS[ong]+'.png')))};
 im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(v.s)}
// Serveur PHP
async function srv(a,opt,q=''){const r=await fetch(API+'?a='+a+q,opt);if(!r.ok)throw 0;return r.json()}
const srvEnvoyer=()=>srv('save',{method:'POST',body:JSON.stringify(P)}).then(()=>alert('Copie envoyée au serveur.')).catch(()=>alert('Serveur PHP indisponible.'));
const srvListe=()=>srv('list');
const srvRestaurer=id=>srv('get',{},'&id='+encodeURIComponent(id));
