// ===== MODÈLE DE DONNÉES =====
// Projet : {id, nom, maj, tabs:{mcd:[formes], mld:[...], ...}}
const ONGLETS={mcd:'MCD',mld:'MLD',mcc:'MCC',mct:'MCT',mot:'MOT',libre:'Dessin libre'};
// type : [géométrie, largeur, hauteur, fond, texte, icône, libellé]
const TYPES={
 entity:['entity',160,90,'#e8f5e9','ENTITÉ','▭','Entité'],assoc:['ell',120,60,'#fff3e0','ASSOCIER','⬭','Association'],
 attr:['ell',100,40,'#ffffff','attribut','○','Attribut'],herit:['tri',70,60,'#fff3e0','','△','Héritage'],
 tablemld:['tablemld',170,100,'#e8f5e9','TABLE','▦','Table'],op:['ell',130,60,'#fff3e0','Opération','⬭','Opération'],
 state:['round',130,60,'#e8f5e9','État','▢','État'],event:['rect',110,40,'#fff3e0','Événement','▭','Événement'],
 cond:['diamond',110,70,'#ffffff','Condition','◇','Condition'],action:['rect',110,40,'#ffffff','Action','▭','Action'],
 phase:['phase',300,180,'none','Phase','⬚','Phase'],actor:['rect',120,50,'#e8f5e9','Poste / acteur','☺','Acteur'],
 task:['round',130,50,'#fff3e0','Tâche','▢','Tâche'],
 rect:['rect',120,70,'#ffffff','Texte','▭','Rectangle'],round:['round',120,70,'#ffffff','Texte','▢','Arrondi'],
 circle:['circle',80,80,'#ffffff','','○','Cercle'],ellipse:['ell',130,70,'#ffffff','Texte','⬭','Ellipse'],
 diamond:['diamond',120,80,'#ffffff','Texte','◇','Losange'],triangle:['tri',100,80,'#ffffff','','△','Triangle'],
 arrow:['line',140,0,'none','','→','Flèche'],darrow:['line',140,0,'none','','↔','Double'],pointille:['line',140,0,'none','','⇢','Pointillée'],
 line:['line',140,0,'none','','╱','Ligne'],grid:['grid',180,90,'#ffffff','','▦','Tableau'],
 text:['text',140,40,'none','Texte','T','Texte'],note:['note',130,90,'#fff59d','Note','🗒','Post-it'],pen:['pen',0,0,'none','','✎','Stylo']};
const OUTILS={
 mcd:['entity','assoc','attr','herit','line','text'],mld:['tablemld','arrow','text'],mcc:['op','arrow','text','note'],
 mct:['state','event','cond','action','arrow','text'],mot:['phase','actor','task','arrow','text'],
 libre:['rect','round','circle','ellipse','diamond','triangle','arrow','darrow','pointille','line','grid','text','note','pen']};
const uid=()=>Math.random().toString(36).slice(2,9);
// Crée une forme : f=fond s=contour c=texte fs=police sw=trait d=pointillé b=gras at=lignes (attributs/colonnes)
function nouvelle(k,x,y){const t=TYPES[k];
 const o={id:uid(),k,g:t[0],x,y,w:t[1],h:t[2],t:t[4],f:t[3],s:'#2e7d32',c:'#1b1b1b',fs:14,sw:2,d:(k==='pointille'||k==='phase')?1:0,b:0,at:[]};
 if(k==='entity')o.at=['#id','attribut'];if(k==='tablemld')o.at=['id:INT:PK','nom:VARCHAR'];
 if(k==='grid')o.at=['A|B|C','1|2|3','4|5|6'];if(k==='pen')o.pts=[];if(k==='note')o.s='#f9a825';
 return o}
function nouveauProjet(nom){const e=exemples();return{id:uid()+uid(),nom:nom||'Mon projet MERISE',maj:Date.now(),tabs:e}}
// Exemples pré-remplis (Client / Commande)
function exemples(){const E=(k,x,y,p)=>Object.assign(nouvelle(k,x,y),p||{});
 const A=(x,y,w,h,t)=>E('arrow',x,y,{w,h,t}),L=(x,y,w,h,t)=>E('line',x,y,{w,h,t});
 return{
 mcd:[E('entity',20,60,{t:'CLIENT',at:['#idClient','nom','email']}),E('assoc',290,70,{t:'PASSER'}),E('entity',540,60,{t:'COMMANDE',at:['#numero','date']}),L(180,101,110,0,'0,n'),L(410,100,130,0,'1,1')],
 mld:[E('tablemld',20,40,{t:'CLIENT',at:['idClient:INT:PK','nom:VARCHAR(50)']}),E('tablemld',360,40,{t:'COMMANDE',at:['numero:INT:PK','date:DATE','idClient:INT:FK']}),A(360,120,-170,-20,'idClient')],
 mcc:[E('op',20,80,{t:'Prise de commande'}),E('op',330,80,{t:'Préparation'}),E('op',640,80,{t:'Expédition'}),A(150,110,180,0,'Commande validée'),A(460,110,180,0,'Colis prêt')],
 mct:[E('state',20,100,{t:'Commande reçue'}),E('event',250,40,{t:'Paiement reçu'}),E('state',420,100,{t:'Commande payée'}),A(150,130,270,0,'Si stock disponible'),E('action',250,200,{t:'Envoyer facture'})],
 mot:[E('phase',20,20,{t:'Phase 1 : Réception',w:320,h:160}),E('actor',40,70,{t:'Commercial'}),E('task',190,70,{t:'Saisir commande'}),A(160,95,30,0),
  E('phase',380,20,{t:'Phase 2 : Livraison',w:300,h:160}),E('actor',400,70,{t:'Logisticien'}),E('task',540,70,{t:'Expédier',w:120}),A(520,95,20,0),A(340,100,40,0)],
 libre:[E('note',30,30,{t:'Bienvenue ! Choisissez un outil.'}),E('rect',250,40),E('circle',420,40),A(370,75,50,0)]}}
