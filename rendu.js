// ===== RENDU SVG =====
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// Hauteur effective (les entités/tables grandissent avec leurs lignes)
const haut=o=>(o.g==='entity'||o.g==='tablemld')?Math.max(o.h,34+o.at.length*18):o.h;
// Texte multiligne centré ; u = souligné ; anc = ancrage ; halo = contour blanc
function txt(o,cx,cy,L,u,anc,halo){const lh=o.fs*1.25,y0=cy-(L.length-1)*lh/2;
 return`<text text-anchor="${anc||'middle'}" font-size="${o.fs}" fill="${o.c}" font-weight="${o.b?700:400}"${u?' text-decoration="underline"':''}${halo?' stroke="#fff" stroke-width="4" style="paint-order:stroke"':''}>`+
 L.map((l,i)=>`<tspan x="${cx}" y="${y0+i*lh}" dominant-baseline="middle">${esc(l)}</tspan>`).join('')+'</text>'}
// Pointe de flèche
function tete(px,py,a,o){const n=10+o.sw*2,p=d=>`${px-n*Math.cos(a+d)},${py-n*Math.sin(a+d)}`;return`<polygon points="${px},${py} ${p(-.4)} ${p(.4)}" fill="${o.s}"/>`}
function forme(o){const x=o.x,y=o.y,w=o.w,h=haut(o),cx=x+w/2,cy=y+h/2,L=String(o.t||'').split('\n'),u=!!o.t&&o.t[0]==='#',
 st=`fill="${o.f}" stroke="${o.s}" stroke-width="${o.sw}"${o.d?' stroke-dasharray="8 5"':''}`;
 switch(o.g){
 case'rect':case'round':case'note':return`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.g==='round'?16:0}" ${st}/>`+txt(o,cx,cy,L);
 case'phase':return`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${st}/>`+txt(o,x+10,y+16,L,0,'start');
 case'ell':case'circle':return`<ellipse cx="${cx}" cy="${cy}" rx="${w/2}" ry="${h/2}" ${st}/>`+txt(o,cx,cy,L.map(l=>l.replace(/^#/,'')),u);
 case'diamond':return`<polygon points="${cx},${y} ${x+w},${cy} ${cx},${y+h} ${x},${cy}" ${st}/>`+txt(o,cx,cy,L);
 case'tri':return`<polygon points="${cx},${y} ${x+w},${y+h} ${x},${y+h}" ${st}/>`+txt(o,cx,cy+h/6,L);
 case'text':return`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent"/>`+txt(o,cx,cy,L);
 case'entity':case'tablemld':{const m=o.g==='tablemld';
  let s=`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${st}/><line x1="${x}" y1="${y+28}" x2="${x+w}" y2="${y+28}" stroke="${o.s}" stroke-width="${o.sw}"/>`+txt({...o,b:1},cx,y+14,L);
  o.at.forEach((r,i)=>{const ry=y+43+i*18;
   if(!m){const id=r[0]==='#';s+=`<text x="${x+10}" y="${ry}" font-size="${o.fs}" fill="${o.c}" dominant-baseline="middle"${id?' text-decoration="underline" font-weight="700"':''}>${esc(id?r.slice(1):r)}</text>`;return}
   const p=r.split(':'),fl=p.slice(2).map(z=>z.trim().toUpperCase()),pk=fl.includes('PK'),fk=fl.includes('FK');
   s+=`<text x="${x+10}" y="${ry}" font-size="${o.fs}" fill="${o.c}" dominant-baseline="middle"${pk?' text-decoration="underline" font-weight="700"':''}>${esc(p[0])}</text>`+
   `<text x="${x+w-(fk?40:10)}" y="${ry}" font-size="${o.fs-2}" fill="#777" text-anchor="end" dominant-baseline="middle">${esc(p[1]||'')}</text>`+
   (fk?`<rect x="${x+w-34}" y="${ry-8}" width="26" height="16" rx="8" fill="#f57c00"/><text x="${x+w-21}" y="${ry}" font-size="10" fill="#fff" text-anchor="middle" dominant-baseline="middle" font-weight="700">FK</text>`:'')});
  return s}
 case'grid':{const R=o.at.map(r=>r.split('|')),nc=Math.max(1,...R.map(r=>r.length)),nr=Math.max(1,R.length),cw=w/nc,ch=h/nr;let s='';
  R.forEach((r,i)=>{for(let j=0;j<nc;j++)s+=`<rect x="${x+j*cw}" y="${y+i*ch}" width="${cw}" height="${ch}" ${st}/>`+txt(o,x+j*cw+cw/2,y+i*ch+ch/2,[r[j]||''])});return s}
 case'line':{const x2=x+w,y2=y+o.h,a=Math.atan2(o.h,w),ln=`x1="${x}" y1="${y}" x2="${x2}" y2="${y2}"`;
  let s=`<line ${ln} stroke="${o.s}" stroke-width="${o.sw}"${o.d?' stroke-dasharray="8 5"':''}/><line ${ln} stroke="transparent" stroke-width="18"/>`;
  if(o.k!=='line')s+=tete(x2,y2,a,o);if(o.k==='darrow')s+=tete(x,y,a+Math.PI,o);
  return s+(o.t?txt(o,(x+x2)/2,(y+y2)/2-10,L,0,'middle',1):'')}
 case'pen':{const p=o.pts.map(q=>q.join(',')).join(' ');return`<g transform="translate(${x} ${y})"><polyline points="${p}" fill="none" stroke="${o.s}" stroke-width="${o.sw}" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${p}" fill="none" stroke="transparent" stroke-width="16"/></g>`}}
 return''}
// Boîte englobante d'une forme
function bbox(o){if(o.g==='pen'){const X=o.pts.map(p=>p[0]+o.x),Y=o.pts.map(p=>p[1]+o.y),a=Math.min(...X),b=Math.min(...Y);return{x:a,y:b,w:Math.max(...X)-a,h:Math.max(...Y)-b}}
 if(o.g==='line')return{x:Math.min(o.x,o.x+o.w),y:Math.min(o.y,o.y+o.h),w:Math.abs(o.w),h:Math.abs(o.h)};return{x:o.x,y:o.y,w:o.w,h:haut(o)}}
// Dessin de l'onglet courant (+ sélection et poignée de redimensionnement)
function dessiner(){const S=liste();let g=S.map(o=>`<g data-id="${o.id}">${forme(o)}</g>`).join('');const o=S.find(s=>s.id===sel);
 if(o){const b=bbox(o),z=V.z;g+=`<g class="ui"><rect x="${b.x-4}" y="${b.y-4}" width="${b.w+8}" height="${b.h+8}" fill="none" stroke="#f57c00" stroke-width="${1.5/z}" stroke-dasharray="${6/z}" pointer-events="none"/>`+
  (o.g!=='pen'?`<circle data-h="1" cx="${o.x+o.w}" cy="${o.y+haut(o)}" r="${12/z}" fill="#f57c00" stroke="#fff" stroke-width="${2/z}"/>`:'')+'</g>'}
 $('#toile').innerHTML=`<g transform="translate(${V.x} ${V.y}) scale(${V.z})">${g}</g>`}
// SVG autonome pour l'export PNG
function svgExport(){const S=liste();if(!S.length)return null;const B=S.map(bbox),x=Math.min(...B.map(b=>b.x))-20,y=Math.min(...B.map(b=>b.y))-20,
 w=Math.max(...B.map(b=>b.x+b.w))+20-x,h=Math.max(...B.map(b=>b.y+b.h))+20-y;
 return{w,h,s:`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" font-family="Arial,sans-serif"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>${S.map(forme).join('')}</svg>`}}
