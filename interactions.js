// ===== INTERACTIONS : onglets, outils, tactile, panneau, menu =====
const $=s=>document.querySelector(s);
let P,ong='mcd',outil='select',sel=null,V={x:20,y:20,z:1},U=[],R=[],mode=null,dep=null,pinch=null,tapT=0,tapId=null,unefois=0;
const svg=$('#toile'),ptrs=new Map(),liste=()=>P.tabs[ong],cur=()=>liste().find(s=>s.id===sel);
const snap=()=>{U.push(JSON.stringify(P.tabs));if(U.length>60)U.shift();R=[]};
function finir(){sauver();dessiner();barre();panneau()}
function ouvrir(p){P=p;U=[];R=[];sel=null;$('#nomProjet').value=P.nom;barre();fit();panneau()}
function undo(){if(!U.length)return;R.push(JSON.stringify(P.tabs));P.tabs=JSON.parse(U.pop());sel=null;finir()}
function redo(){if(!R.length)return;U.push(JSON.stringify(P.tabs));P.tabs=JSON.parse(R.pop());sel=null;finir()}
// Onglets + boîte à outils
function barre(){$('#onglets').innerHTML=Object.keys(ONGLETS).map(k=>`<button data-t="${k}" class="${k===ong?'actif':''}">${ONGLETS[k]}<i>${P.tabs[k].length}</i></button>`).join('');
 $('#outils').innerHTML=['select',...OUTILS[ong]].map(k=>{const t=TYPES[k];return`<button data-o="${k}" class="${outil===k?'actif':''}">${t?t[5]:'➤'}<small>${t?t[6]:'Sélection'}</small></button>`}).join('')}
// Zoom / ajustement
function zoom(f,cx,cy){const r=svg.getBoundingClientRect();cx=cx??r.width/2;cy=cy??r.height/2;const wx=(cx-V.x)/V.z,wy=(cy-V.y)/V.z;V.z=Math.min(4,Math.max(.2,V.z*f));V.x=cx-wx*V.z;V.y=cy-wy*V.z;dessiner()}
function fit(){const S=liste(),r=svg.getBoundingClientRect();if(!S.length){V={x:20,y:20,z:1};return dessiner()}
 const B=S.map(bbox),x=Math.min(...B.map(b=>b.x)),y=Math.min(...B.map(b=>b.y)),w=Math.max(...B.map(b=>b.x+b.w))-x||1,h=Math.max(...B.map(b=>b.y+b.h))-y||1;
 V.z=Math.min(1.5,.9*Math.min(r.width/w,r.height/h));V.x=(r.width-w*V.z)/2-x*V.z;V.y=(r.height-h*V.z)/2-y*V.z;dessiner()}
const pt=e=>{const r=svg.getBoundingClientRect();return{x:(e.clientX-r.left-V.x)/V.z,y:(e.clientY-r.top-V.y)/V.z}};
const g10=v=>Math.round(v/10)*10;
// Création d'une forme au toucher
function creer(p){snap();const o=nouvelle(outil,g10(p.x),g10(p.y));
 if(o.g==='pen'){o.x=0;o.y=0;o.pts=[[p.x,p.y]];liste().push(o);sel=o.id;mode='pen';return}
 if(o.g!=='line'){o.x=g10(o.x-o.w/2);o.y=g10(o.y-o.h/2)}liste().push(o);sel=o.id;outil='select';finir();$('#panneau').classList.add('ouvert')}
// Pointeurs : déplacer, redimensionner, dessiner, panoramique, pincement
function mesure(){const a=[...ptrs.values()],r=svg.getBoundingClientRect();return{d:Math.hypot(a[0].clientX-a[1].clientX,a[0].clientY-a[1].clientY)||1,mx:(a[0].clientX+a[1].clientX)/2-r.left,my:(a[0].clientY+a[1].clientY)/2-r.top}}
svg.addEventListener('pointerdown',e=>{svg.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,e);
 if(ptrs.size===2){const m=mesure();pinch={...m,z:V.z,vx:V.x,vy:V.y};mode='pinch';return}
 const p=pt(e),t=e.target.closest('[data-id],[data-h]');
 if(outil!=='select'&&!t){creer(p);return}
 if(t&&t.dataset.h){snap();mode='size';return}
 if(t){const id=t.dataset.id,now=Date.now();if(id===tapId&&now-tapT<350){sel=id;panneau();$('#panneau').classList.add('ouvert');setTimeout(()=>$('#f_t')&&$('#f_t').focus(),50)}
  tapT=now;tapId=id;sel=id;const o=cur();snap();mode='move';dep={p,x:o.x,y:o.y};dessiner();panneau();return}
 sel=null;mode='pan';dep={x:e.clientX,y:e.clientY,vx:V.x,vy:V.y};dessiner();panneau()});
svg.addEventListener('pointermove',e=>{if(!ptrs.has(e.pointerId))return;ptrs.set(e.pointerId,e);const p=pt(e),o=cur();
 if(mode==='pinch'&&ptrs.size>=2){const m=mesure(),z=Math.min(4,Math.max(.2,pinch.z*m.d/pinch.d)),wx=(pinch.mx-pinch.vx)/pinch.z,wy=(pinch.my-pinch.vy)/pinch.z;V.z=z;V.x=m.mx-wx*z;V.y=m.my-wy*z;dessiner()}
 else if(mode==='pan'){V.x=dep.vx+e.clientX-dep.x;V.y=dep.vy+e.clientY-dep.y;dessiner()}
 else if(mode==='move'&&o){o.x=g10(dep.x+p.x-dep.p.x);o.y=g10(dep.y+p.y-dep.p.y);dessiner()}
 else if(mode==='size'&&o){if(o.g==='line'){o.w=g10(p.x-o.x);o.h=g10(p.y-o.y)}else{o.w=Math.max(20,g10(p.x-o.x));o.h=Math.max(20,g10(p.y-o.y))}dessiner()}
 else if(mode==='pen'&&o){o.pts.push([Math.round(p.x),Math.round(p.y)]);dessiner()}});
const fin=e=>{ptrs.delete(e.pointerId);if(mode==='pinch'){if(ptrs.size<2)mode=null;return}
 if(['move','size','pen'].includes(mode))finir();mode=null};
svg.addEventListener('pointerup',fin);svg.addEventListener('pointercancel',fin);
svg.addEventListener('wheel',e=>{e.preventDefault();const r=svg.getBoundingClientRect();zoom(e.deltaY<0?1.1:.9,e.clientX-r.left,e.clientY-r.top)},{passive:false});
// Panneau de propriétés
function panneau(){const o=cur(),c=$('#panneau .corps');
 if(!o){c.innerHTML='<p class="aide">Touchez une forme pour la modifier (double-tap ou Entrée : éditer le texte).</p>';return}
 const aide={entity:'Un attribut par ligne ; « # » devant = identifiant (souligné).',tablemld:'nom:type:PK:FK (une colonne par ligne).',grid:'Cellules séparées par « | », une ligne par rangée.'}[o.g];
 c.innerHTML=(o.g!=='pen'?`<label>Texte</label><textarea id="f_t" rows="2">${esc(o.t)}</textarea>`:'')+(aide?`<label>Lignes — ${aide}</label><textarea id="f_at" rows="5">${esc(o.at.join('\n'))}</textarea>`:'')+
 `<div class="rang"><span>Fond<br><input type="color" id="f_f" value="${/^#/.test(o.f)?o.f.slice(0,7):'#ffffff'}"></span><span>Contour<br><input type="color" id="f_s" value="${o.s}"></span><span>Texte<br><input type="color" id="f_c" value="${o.c}"></span></div>
 <div class="rang"><span><label>Police</label><input type="number" id="f_fs" min="8" max="60" value="${o.fs}"></span><span><label>Trait</label><input type="number" id="f_sw" min="1" max="12" value="${o.sw}"></span>
 <label><input type="checkbox" id="f_d" ${o.d?'checked':''}> Pointillé</label><label><input type="checkbox" id="f_b" ${o.b?'checked':''}> Gras</label></div>
 <button data-a="dup">Dupliquer</button><button data-a="av">Devant</button><button data-a="ar">Derrière</button><button class="or" data-a="del">Supprimer</button>`}
$('#panneau').addEventListener('input',e=>{const o=cur(),i=e.target.id,v=e.target;if(!o||!i)return;
 if(!unefois){snap();unefois=1;setTimeout(()=>unefois=0,1000)}
 if(i==='f_t')o.t=v.value;else if(i==='f_at')o.at=v.value.split('\n');else if(i==='f_f')o.f=v.value;else if(i==='f_s')o.s=v.value;else if(i==='f_c')o.c=v.value;
 else if(i==='f_fs')o.fs=+v.value||14;else if(i==='f_sw')o.sw=+v.value||2;else if(i==='f_d')o.d=v.checked?1:0;else if(i==='f_b')o.b=v.checked?1:0;
 sauver();dessiner()});
// Actions des boutons
function action(a){const S=liste(),i=S.findIndex(s=>s.id===sel),o=S[i];
 if(a==='undo')undo();else if(a==='redo')redo();else if(a==='zp')zoom(1.25);else if(a==='zm')zoom(.8);else if(a==='fit')fit();
 else if(a==='save'){sauver();alert('Projet enregistré sur cet appareil.')}else if(a==='menu')menu();
 else if(a==='pan')$('#panneau').classList.toggle('ouvert');
 else if(o){snap();if(a==='dup'){const c=JSON.parse(JSON.stringify(o));c.id=uid();c.x+=20;c.y+=20;S.push(c);sel=c.id}
  else if(a==='del'){S.splice(i,1);sel=null}else if(a==='av'){S.push(S.splice(i,1)[0])}else if(a==='ar'){S.unshift(S.splice(i,1)[0])}finir()}}
document.body.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if(d.a)action(d.a);else if(d.t){ong=d.t;outil='select';sel=null;barre();fit();panneau()}else if(d.o){outil=d.o;barre()}else if(d.m)menuAction(d.m,d.id)});
$('#nomProjet').addEventListener('input',e=>{P.nom=e.target.value;sauver()});
document.addEventListener('keydown',e=>{const ed=/INPUT|TEXTAREA/.test(document.activeElement.tagName);
 if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();undo()}else if((e.ctrlKey||e.metaKey)&&e.key==='y'){e.preventDefault();redo()}
 else if(!ed&&e.key==='Enter'&&sel){e.preventDefault();$('#panneau').classList.add('ouvert');$('#f_t')&&$('#f_t').focus()}else if(!ed&&(e.key==='Delete'||e.key==='Backspace')&&sel)action('del')});
// Menu : projets, export, serveur
function menu(){const m=Object.values(lireTous()).sort((a,b)=>b.maj-a.maj);$('#menu').hidden=false;
 $('#menu .corps').innerHTML=`<h3>Projet courant</h3><button data-m="nouveau">＋ Nouveau</button><button data-m="save">💾 Enregistrer</button><button data-m="json">⬇ Copie .json</button><button data-m="import">⬆ Importer .json</button><button data-m="png">🖼 PNG</button><button data-m="pdf">🖨 PDF / Imprimer</button>
 <h3>Projets sur cet appareil</h3>`+m.map(p=>`<div class="ligne"><b>${esc(p.nom)}</b><span>${new Date(p.maj).toLocaleString()}</span><button data-m="ouvrir" data-id="${p.id}">Ouvrir</button><button data-m="dup" data-id="${p.id}">Dupliquer</button><button class="or" data-m="sup" data-id="${p.id}">Suppr.</button></div>`).join('')+
 `<h3>Copies sur le serveur (PHP)</h3><button data-m="envoyer">☁ Envoyer ce projet</button><button data-m="liste">↻ Lister les copies</button><div id="srv"></div>`}
async function menuAction(a,id){const m=lireTous();
 if(a==='fermer')$('#menu').hidden=true;
 else if(a==='nouveau'){ouvrir(nouveauProjet());sauver();menu()}else if(a==='save'){sauver();alert('Enregistré.')}
 else if(a==='json')exportJSON();else if(a==='import')$('#fichier').click();else if(a==='png')exportPNG();else if(a==='pdf'){$('#menu').hidden=true;fit();setTimeout(()=>print(),200)}
 else if(a==='ouvrir'){ouvrir(m[id]);$('#menu').hidden=true}
 else if(a==='dup'){const c=JSON.parse(JSON.stringify(m[id]));c.id=uid()+uid();c.nom+=' (copie)';m[c.id]=c;localStorage.setItem(CLE,JSON.stringify(m));menu()}
 else if(a==='sup'){if(confirm('Supprimer ce projet ?')){supprimerLocal(id);if(id===P.id){ouvrir(nouveauProjet());sauver()}menu()}}
 else if(a==='envoyer')srvEnvoyer();
 else if(a==='liste'){try{const l=await srvListe();$('#srv').innerHTML=l.length?l.map(p=>`<div class="ligne"><b>${esc(p.nom)}</b><span>${new Date(p.maj).toLocaleString()}</span><button data-m="rest" data-id="${p.id}">Restaurer</button></div>`).join(''):'<p class="aide">Aucune copie.</p>'}catch(e){$('#srv').textContent='Serveur PHP indisponible (ouvrez le site via PHP, voir README).'}}
 else if(a==='rest'){try{ouvrir(await srvRestaurer(id));sauver();$('#menu').hidden=true}catch(e){alert('Restauration impossible.')}}}
$('#fichier').addEventListener('change',e=>{if(e.target.files[0])importJSON(e.target.files[0]);e.target.value='';$('#menu').hidden=true});
// Démarrage : dernier projet ou exemple
(function(){const m=lireTous(),d=m[localStorage.getItem('merise:dernier')];ouvrir(d||nouveauProjet());if(!d)sauver();addEventListener('resize',fit)})();
