/* Merise Studio : éditeur de diagrammes (SVG, sans bibliothèque) */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  // Types d'éléments : [libellé, forme, fond, bord, largeur, hauteur]
  var KINDS = {
    entite: ['Entité', 'rect', '#e8f7ee', '#1f9d55', 170, 60],
    association: ['Association', 'ellipse', '#fff1e0', '#f28c1b', 150, 70],
    table: ['Table', 'rect', '#e8f7ee', '#1f9d55', 180, 60],
    acteur: ['Acteur', 'rect', '#e8f7ee', '#1f9d55', 150, 56],
    message: ['Message', 'ellipse', '#fff1e0', '#f28c1b', 140, 64],
    evenement: ['Événement', 'round', '#e8f7ee', '#1f9d55', 160, 56],
    operation: ['Opération', 'round', '#fff1e0', '#f28c1b', 160, 56],
    synchro: ['Synchronisation', 'diamond', '#ffffff', '#157a40', 140, 80],
    poste: ['Poste', 'rect', '#e8f7ee', '#1f9d55', 150, 56],
    forme: ['Rectangle', 'rect', '#ffffff', '#157a40', 140, 60],
    ovale: ['Ovale', 'ellipse', '#ffffff', '#f28c1b', 140, 70],
    losange: ['Losange', 'diamond', '#ffffff', '#157a40', 130, 80],
    fleche: ['Flèche', 'arrow', '#fff1e0', '#f28c1b', 160, 50],
    texte: ['Zone de texte', 'text', 'none', 'none', 140, 40]
  };
  var TYPES = {
    MCD: ['entite', 'association'], MLD: ['table'], MCC: ['acteur', 'message', 'fleche'],
    MCT: ['evenement', 'operation', 'synchro'], MOT: ['poste', 'operation'],
    LIBRE: ['forme', 'ovale', 'losange', 'fleche', 'texte']
  };
  var TITRES = { MCD: 'MCD (conceptuel de données)', MLD: 'MLD (logique de données)', MCC: 'MCC (communication)',
    MCT: 'MCT (traitements)', MOT: 'MOT (organisationnel)', LIBRE: 'Dessin libre' };

  var $ = function (s) { return document.querySelector(s); };
  var svg = $('#toile'), dlg = $('#dlg');
  var doc, sel = new Set(), multi = false, undo = [], redo = [], drag = null, pend = null;
  var zoom = 1, grille = true, presse = null;
  if (localStorage.getItem('ms_theme') === 'sombre') document.documentElement.classList.add('sombre');

  /* ---------- Données et historique ---------- */
  function nouveau(type) { return { titre: 'Sans titre', type: type || 'MCD', seq: 0, nodes: [], links: [], trash: [], serveurId: null }; }
  function snap() { return JSON.stringify({ nodes: doc.nodes, links: doc.links, trash: doc.trash }); }
  function appliquer(s) { var o = JSON.parse(s); doc.nodes = o.nodes; doc.links = o.links; doc.trash = o.trash; sel.clear(); }
  function avant() { undo.push(snap()); if (undo.length > 100) undo.shift(); redo = []; }
  function annuler() { if (!undo.length) return; redo.push(snap()); appliquer(undo.pop()); maj(); }
  function refaire() { if (!redo.length) return; undo.push(snap()); appliquer(redo.pop()); maj(); }
  function noeud(id) { return doc.nodes.filter(function (n) { return n.id === id; })[0]; }
  function lien(id) { return doc.links.filter(function (l) { return l.id === id; })[0]; }
  function idsN() { return Array.from(sel).filter(function (i) { return i[0] === 'n'; }); }
  function idsL() { return Array.from(sel).filter(function (i) { return i[0] === 'l'; }); }

  function sauverLocal() { try { localStorage.setItem('ms_doc', JSON.stringify(doc)); } catch (e) {} }
  function maj() { sauverLocal(); dessiner(); panneau(); }

  /* ---------- Dessin ---------- */
  function el(tag, at, parent, txt) {
    var e = document.createElementNS(NS, tag);
    for (var k in at) e.setAttribute(k, at[k]);
    if (txt !== undefined) e.textContent = txt;
    if (parent) parent.appendChild(e);
    return e;
  }
  // Styles personnalisables : valeurs par défaut + choix de l'utilisateur
  var POLICES = ['Trebuchet MS', 'Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'Comic Sans MS', 'Impact'];
  function sn(n) {
    var k = KINDS[n.kind] || ['Élément', 'rect', '#e8f7ee', '#1f9d55', 160, 60], s = n.style || {};
    return {
      fill: s.fill !== undefined ? s.fill : k[2],
      stroke: s.stroke !== undefined ? s.stroke : k[3],
      sw: s.sw !== undefined ? +s.sw : (k[1] === 'text' && !s.stroke ? 0 : 2),
      tc: s.tc || '#14301f',
      font: s.font || POLICES[0],
      fs: s.fs || 15,
      b: s.b === undefined ? k[1] !== 'text' : s.b,
      i: !!s.i,
      u: !!s.u,
      dash: s.dash || 'none',
      rx: s.rx === undefined ? null : s.rx,
      w: s.w ? +s.w : null,
      h: s.h ? +s.h : null,
      align: s.align || (k[1] === 'text' ? 'left' : 'center')
    };
  }
  function sl(l) {
    var s = l.style || {};
    return {
      color: s.color || '#157a40',
      w: s.w !== undefined ? +s.w : 2,
      dash: s.dash || 'none',
      tc: s.tc || '#b35c00',
      fs: s.fs || 13,
      font: s.font || POLICES[0],
      arrow: s.arrow || 'none',
      arrowType: s.arrowType || 'triangle',
      arrowSize: s.arrowSize !== undefined ? +s.arrowSize : 1,
      u: !!s.u
    };
  }
  function hex(v) { return /^#[0-9a-f]{6}$/i.test(v) ? v : '#ffffff'; }
  function lignes(n) { return n.details ? n.details.split('\n').filter(Boolean) : []; }
  function taille(n) {
    var k = KINDS[n.kind] || ['Élément', 'rect', '#e8f7ee', '#1f9d55', 160, 60];
    var f = k[1], w = k[4], h = k[5], l = lignes(n);
    var y = sn(n), r = y.fs / 15;

    if (y.w) w = Math.max(30, y.w);
    else {
      if (f === 'rect' || f === 'round') {
        if (l.length) h = Math.max(h, (44 + l.length * 18) * r);
        var m = Math.max.apply(null, [n.label.length * 9 * r].concat(l.map(function (x) { return x.length * 7.5 * r; }))) + 28;
        w = Math.max(w, m);
      } else if (f === 'text') {
        var toutes = [n.label].concat(l).join('\n').split('\n');
        var maxLen = Math.max.apply(null, toutes.map(function (x) { return (x || '').length * 8.5 * r; }));
        w = Math.max(w, maxLen + 24);
        h = Math.max(h, (toutes.length * (y.fs * 1.35) + 16));
      } else if (f === 'arrow') {
        w = Math.max(w, n.label.length * 9 * r + 50);
        h = Math.max(h, 44);
      } else {
        w = Math.max(w, n.label.length * 9 * r + 36);
      }
    }

    if (y.h) h = Math.max(20, y.h);
    else if (f !== 'rect' && f !== 'round' && f !== 'text') {
      h = Math.max(h, 26 * r + 20);
    }
    return [w, h];
  }
  // Point où la droite centre → p traverse le contour de l'élément
  function bord(n, p) {
    var t = taille(n), w = t[0], h = t[1], cx = n.x + w / 2, cy = n.y + h / 2, dx = p.x - cx, dy = p.y - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    var f = (KINDS[n.kind] || [])[1], k;
    if (f === 'ellipse') k = 1 / Math.sqrt(Math.pow(dx / (w / 2), 2) + Math.pow(dy / (h / 2), 2));
    else if (f === 'diamond') k = 1 / (Math.abs(dx) / (w / 2) + Math.abs(dy) / (h / 2));
    else k = Math.min((w / 2) / Math.abs(dx || 1e-9), (h / 2) / Math.abs(dy || 1e-9));
    return { x: cx + dx * k, y: cy + dy * k };
  }
  var POLICE = { 'font-family': 'Trebuchet MS,Arial,sans-serif', fill: '#14301f', 'text-anchor': 'middle' };
  function texte(at, parent, t) { return el('text', Object.assign({}, POLICE, at), parent, t); }

  function dashAttr(v) {
    if (!v || v === 'none' || v === 'continu') return null;
    if (v === 'pointille' || v === 'dot') return '3 3';
    if (v === 'tiret' || v === 'dash' || v === true) return '8 5';
    if (v === 'dashdot') return '8 3 2 3';
    if (v === 'long') return '12 6';
    return null;
  }

  function dessinerPointeFleche(g, de, vers, col, w, type, taille) {
    var a = Math.atan2(vers.y - de.y, vers.x - de.x);
    var sc = typeof taille === 'number' && taille > 0 ? taille : 1;
    var L = (10 + w * 1.8) * sc;
    var W = (5 + w * 1.2) * sc;
    var bx = vers.x - L * Math.cos(a), by = vers.y - L * Math.sin(a);
    var lx = bx + W * Math.sin(a), ly = by - W * Math.cos(a);
    var rx = bx - W * Math.sin(a), ry = by + W * Math.cos(a);

    type = type || 'triangle';
    if (type === 'ouvert') {
      el('polyline', {
        points: [lx, ly, vers.x, vers.y, rx, ry].join(' '),
        fill: 'none',
        stroke: col,
        'stroke-width': Math.max(2, w),
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }, g);
    } else if (type === 'losange') {
      var ox = vers.x - 2 * L * Math.cos(a), oy = vers.y - 2 * L * Math.sin(a);
      el('polygon', { points: [vers.x, vers.y, lx, ly, ox, oy, rx, ry].join(' '), fill: col }, g);
    } else if (type === 'losange_vide') {
      var ox = vers.x - 2 * L * Math.cos(a), oy = vers.y - 2 * L * Math.sin(a);
      el('polygon', { points: [vers.x, vers.y, lx, ly, ox, oy, rx, ry].join(' '), fill: '#ffffff', stroke: col, 'stroke-width': Math.max(1.5, w) }, g);
    } else if (type === 'rond') {
      el('circle', { cx: bx, cy: by, r: Math.max(3.5, W * 0.85), fill: col }, g);
    } else {
      el('polygon', { points: [vers.x, vers.y, lx, ly, rx, ry].join(' '), fill: col }, g);
    }
  }

  function dessiner() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.style.backgroundColor = doc.fond || '#ffffff';
    doc.links.forEach(function (l) {
      var a = noeud(l.from), b = noeud(l.to);
      if (!a || !b) return;
      var ta = taille(a), tb = taille(b), st = sl(l), s = sel.has(l.id);
      var ca = { x: a.x + ta[0] / 2, y: a.y + ta[1] / 2 }, cb = { x: b.x + tb[0] / 2, y: b.y + tb[1] / 2 };
      var p = bord(a, cb), q = bord(b, ca);
      var g = el('g', { 'data-id': l.id, 'class': 'lien' }, svg);
      if (s) el('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, stroke: '#f28c1b', 'stroke-opacity': 0.4, 'stroke-width': st.w + 8 }, g);
      var at = { x1: p.x, y1: p.y, x2: q.x, y2: q.y, stroke: st.color, 'stroke-width': st.w };
      var dArr = dashAttr(st.dash);
      if (dArr) at['stroke-dasharray'] = dArr;
      el('line', at, g);
      el('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, stroke: 'transparent', 'stroke-width': 18 }, g);
      if (st.arrow === 'end' || st.arrow === 'both') dessinerPointeFleche(g, p, q, st.color, st.w, st.arrowType, st.arrowSize);
      if (st.arrow === 'start' || st.arrow === 'both') dessinerPointeFleche(g, q, p, st.color, st.w, st.arrowType, st.arrowSize);
      if (l.label) {
        var txLien = {
          x: (p.x + q.x) / 2,
          y: (p.y + q.y) / 2 - 6,
          'font-size': st.fs,
          'font-weight': 'bold',
          'font-family': st.font + ',Arial,sans-serif',
          fill: st.tc,
          stroke: doc.fond || '#fff',
          'stroke-width': 4,
          'paint-order': 'stroke'
        };
        if (st.u) {
          txLien['text-decoration'] = 'underline';
          txLien['style'] = 'text-decoration: underline;';
        }
        texte(txLien, g, l.label);
      }
    });
    doc.nodes.forEach(function (n) {
      var k = KINDS[n.kind] || ['Élément', 'rect', '#e8f7ee', '#1f9d55', 160, 60], f = k[1], t = taille(n), w = t[0], h = t[1], s = sel.has(n.id), l = lignes(n), y = sn(n), r = y.fs / 15;
      var g = el('g', { transform: 'translate(' + n.x + ',' + n.y + ')', 'data-id': n.id, 'class': 'noeud' }, svg);
      var st = {
        fill: (y.fill === 'none' || y.fill === 'transparent') ? 'transparent' : y.fill,
        stroke: (y.sw <= 0 || y.stroke === 'none' || y.stroke === 'transparent') ? 'none' : y.stroke,
        'stroke-width': y.sw
      };
      var dArr = dashAttr(y.dash);
      if (dArr && y.sw > 0 && y.stroke !== 'none') st['stroke-dasharray'] = dArr;
      var rx = y.rx === null ? (f === 'round' ? 18 : (f === 'rect' ? 4 : 0)) : y.rx;

      if (f === 'rect' || f === 'round') {
        el('rect', Object.assign({ width: w, height: h, rx: rx }, st), g);
      } else if (f === 'ellipse') {
        el('ellipse', Object.assign({ cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2 }, st), g);
      } else if (f === 'diamond') {
        el('polygon', Object.assign({ points: [w / 2, 0, w, h / 2, w / 2, h, 0, h / 2].join(' ') }, st), g);
      } else if (f === 'arrow') {
        el('polygon', Object.assign({
          points: [0, h * 0.25, w * 0.65, h * 0.25, w * 0.65, 0, w, h * 0.5, w * 0.65, h, w * 0.65, h * 0.75, 0, h * 0.75].join(' ')
        }, st), g);
      } else if (f === 'text') {
        if ((y.fill && y.fill !== 'none' && y.fill !== 'transparent') || (y.sw > 0 && y.stroke && y.stroke !== 'none')) {
          el('rect', Object.assign({ width: w, height: h, rx: rx }, st), g);
        }
      }

      if (s) el('rect', { x: -6, y: -6, width: w + 12, height: h + 12, rx: Math.max(6, rx + 4), fill: 'none', stroke: '#d96a00', 'stroke-width': 2, 'stroke-dasharray': '5 4', 'pointer-events': 'none' }, g);

      var tx = {
        'font-family': y.font + ',Arial,sans-serif',
        fill: y.tc,
        'font-weight': y.b ? 'bold' : 'normal',
        'font-style': y.i ? 'italic' : 'normal'
      };
      if (y.u) {
        tx['text-decoration'] = 'underline';
        tx['style'] = 'text-decoration: underline;';
      }

      if (f === 'text') {
        var morceaux = [n.label].concat(l).join('\n').split('\n');
        if (!morceaux.length) morceaux = ['Texte'];
        var interligne = y.fs * 1.35;
        var startY = Math.max(y.fs + 4, (h - (morceaux.length - 1) * interligne) / 2 + y.fs / 3);
        var posX = w / 2;
        var anchor = 'middle';
        if (y.align === 'left') { posX = 12; anchor = 'start'; }
        else if (y.align === 'right') { posX = w - 12; anchor = 'end'; }

        morceaux.forEach(function (ln, idx) {
          var estId = ln.indexOf('#') === 0 || (ln.indexOf('_') === 0 && ln.lastIndexOf('_') === ln.length - 1 && ln.length > 2);
          var lnTx = Object.assign({}, tx, {
            x: posX,
            y: startY + idx * interligne,
            'font-size': y.fs,
            'text-anchor': anchor
          });
          if (estId || y.u) {
            lnTx['text-decoration'] = 'underline';
            lnTx['style'] = 'text-decoration: underline;';
          }
          texte(lnTx, g, ln);
        });
      } else if (l.length && (f === 'rect' || f === 'round')) {
        var titleX = w / 2;
        var titleAnchor = 'middle';
        if (y.align === 'left') { titleX = 14; titleAnchor = 'start'; }
        else if (y.align === 'right') { titleX = w - 14; titleAnchor = 'end'; }

        texte(Object.assign({ x: titleX, y: 24 * r, 'font-size': y.fs, 'text-anchor': titleAnchor }, tx), g, n.label);
        el('line', { x1: 0, y1: 34 * r, x2: w, y2: 34 * r, stroke: y.sw > 0 ? y.stroke : '#1f9d55', 'stroke-width': Math.max(1, y.sw) }, g);
        l.forEach(function (x, i) {
          var estId = x.indexOf('#') === 0 || (x.indexOf('_') === 0 && x.lastIndexOf('_') === x.length - 1 && x.length > 2);
          var attrTx = Object.assign({}, tx, {
            x: 12,
            y: (56 + i * 18) * r,
            'font-size': 13 * r,
            'text-anchor': 'start',
            'font-weight': estId ? 'bold' : 'normal'
          });
          if (estId || y.u) {
            attrTx['text-decoration'] = 'underline';
            attrTx['style'] = 'text-decoration: underline;';
          }
          texte(attrTx, g, x);
        });
      } else {
        var posX = w / 2;
        var anchor = 'middle';
        if (y.align === 'left') { posX = 14; anchor = 'start'; }
        else if (y.align === 'right') { posX = w - 14; anchor = 'end'; }
        if (f === 'arrow') posX = w * 0.42;

        texte(Object.assign({ x: posX, y: h / 2 + y.fs / 3, 'font-size': y.fs, 'text-anchor': anchor }, tx), g, n.label);
      }
    });
  }

  /* ---------- Ajout, liaison, duplication ---------- */
  function ajouter(kind) {
    avant();
    var i = doc.nodes.length, id = 'n' + (++doc.seq);
    doc.nodes.push({ id: id, kind: kind, x: 60 + (i * 40) % 500, y: 60 + (i * 40) % 350, label: KINDS[kind][0], details: '' });
    sel.clear(); sel.add(id); maj();
  }
  function relier() {
    var n = idsN(); if (n.length !== 2) return;
    avant(); var id = 'l' + (++doc.seq);
    doc.links.push({ id: id, from: n[0], to: n[1], label: '' });
    sel.clear(); sel.add(id); maj();
  }
  function dupliquer() {
    var n = idsN(); if (!n.length) return;
    avant(); var map = {};
    n.forEach(function (id) { var o = noeud(id), c = JSON.parse(JSON.stringify(o)); c.id = 'n' + (++doc.seq); c.x += 30; c.y += 30; map[id] = c.id; doc.nodes.push(c); });
    doc.links.slice().forEach(function (l) { if (map[l.from] && map[l.to]) doc.links.push({ id: 'l' + (++doc.seq), from: map[l.from], to: map[l.to], label: l.label }); });
    sel.clear(); Object.keys(map).forEach(function (k) { sel.add(map[k]); }); maj();
  }

  /* ---------- Suppression (avec corbeille locale) ---------- */
  function suppr(nIds, lIds) {
    var ln = doc.links.filter(function (l) { return lIds.indexOf(l.id) >= 0 || nIds.indexOf(l.from) >= 0 || nIds.indexOf(l.to) >= 0; });
    var nn = doc.nodes.filter(function (n) { return nIds.indexOf(n.id) >= 0; });
    if (!nn.length && !ln.length) return;
    avant();
    doc.trash.push({ nodes: nn, links: ln, date: new Date().toISOString() });
    doc.nodes = doc.nodes.filter(function (n) { return nIds.indexOf(n.id) < 0; });
    doc.links = doc.links.filter(function (l) { return ln.indexOf(l) < 0; });
    sel.clear(); maj(); toast(nn.length + ' élément(s) et ' + ln.length + ' lien(s) supprimés. Annuler est possible.');
  }
  function dlgSuppr() {
    var ns = idsN(), ls = idsL(), liensDe = doc.links.filter(function (l) { return ns.indexOf(l.from) >= 0 || ns.indexOf(l.to) >= 0; });
    var isoles = doc.nodes.filter(function (n) { return !doc.links.some(function (l) { return l.from === n.id || l.to === n.id; }); });
    var kinds = ns.map(function (i) { return noeud(i).kind; });
    var memeType = doc.nodes.filter(function (n) { return kinds.indexOf(n.kind) >= 0; });
    var opts = [
      ['Supprimer la sélection (avec ses liens)', ns.length + ls.length, function () { suppr(ns, ls); }],
      ['Supprimer seulement les liens de la sélection', liensDe.length, function () { suppr([], liensDe.map(function (l) { return l.id; })); }],
      ['Supprimer les éléments isolés (sans lien)', isoles.length, function () { suppr(isoles.map(function (n) { return n.id; }), []); }],
      ['Supprimer tous les éléments du même type', memeType.length, function () { suppr(memeType.map(function (n) { return n.id; }), []); }],
      ['Supprimer tous les liens', doc.links.length, function () { suppr([], doc.links.map(function (l) { return l.id; })); }],
      ['Tout effacer', doc.nodes.length, function () { if (confirm('Tout effacer ? Vous pourrez annuler juste après.')) suppr(doc.nodes.map(function (n) { return n.id; }), []); }],
      ['Restaurer la dernière suppression', doc.trash.length, function () {
        var t = doc.trash[doc.trash.length - 1]; avant(); doc.trash.pop();
        t.nodes.forEach(function (n) { if (!noeud(n.id)) doc.nodes.push(n); });
        t.links.forEach(function (l) { if (!lien(l.id) && noeud(l.from) && noeud(l.to)) doc.links.push(l); });
        maj(); toast('Suppression restaurée.'); }],
      ['Vider la corbeille', doc.trash.length, function () { avant(); doc.trash = []; maj(); toast('Corbeille vidée.'); }]
    ].filter(function (o) { return o[1] > 0; });
    if (!opts.length) { toast('Rien à supprimer.'); return; }
    dialogue('<h2>Supprimer</h2><div class="liste">' + opts.map(function (o, i) {
      return '<button data-i="' + i + '"' + (i === 5 ? ' class="danger"' : '') + '><span>' + o[0] + '</span><b>' + o[1] + '</b></button>';
    }).join('') + '</div><p><button data-fermer>Fermer</button></p>');
    dlg.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-fermer')) return dlg.close();
      dlg.close(); opts[+b.getAttribute('data-i')][2]();
    };
  }

  /* ---------- Panneau de propriétés et de style ---------- */
  function cC(id, lab, v) { return '<label class="ligneS"><span>' + lab + '</span><input type="color" id="' + id + '" value="' + hex(v) + '"></label>'; }
  function cR(id, lab, v, mn, mx, unite) {
    return '<label class="ligneS"><span>' + lab + '</span><span style="display:flex;align-items:center;gap:.4rem;flex:1;"><input type="range" id="' + id + '" min="' + mn + '" max="' + mx + '" value="' + v + '"><span class="valeur-range" id="' + id + '_v">' + v + (unite || '') + '</span></span></label>';
  }
  function cK(id, lab, v) { return '<label class="ligneS"><span>' + lab + '</span><input type="checkbox" id="' + id + '"' + (v ? ' checked' : '') + '></label>'; }
  function cF(id, lab, v, vide) {
    return '<label class="ligneS"><span>' + lab + '</span><select id="' + id + '">' + (vide ? '<option value="">Choisir…</option>' : '') + POLICES.map(function (p) {
      return '<option' + (p === v ? ' selected' : '') + ' style="font-family:\'' + p + '\'">' + p + '</option>'; }).join('') + '</select></label>';
  }
  function cSelect(id, lab, options, v) {
    return '<label class="ligneS"><span>' + lab + '</span><select id="' + id + '">' + options.map(function (o) {
      return '<option value="' + o[0] + '"' + (String(o[0]) === String(v) ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select></label>';
  }

  // Applique une modification au style de chaque élément / lien sélectionné
  function appN(fn) { idsN().forEach(function (i) { var n = noeud(i); n.style = n.style || {}; fn(n.style, n); }); }
  function appL(fn) { idsL().forEach(function (i) { var l = lien(i); l.style = l.style || {}; fn(l.style, l); }); }
  function lie(id, fn, unite) {
    var e = $(id); if (!e) return;
    var valEl = $(id + '_v');
    e.addEventListener('input', function () {
      if (pend === null) pend = snap();
      var v = (e.type === 'checkbox' ? e.checked : (e.type === 'range' || e.type === 'number' ? +e.value : e.value));
      if (valEl) valEl.textContent = v + (unite || '');
      fn(v);
      sauverLocal(); dessiner();
    });
    e.addEventListener('change', function () {
      if (e.tagName === 'SELECT') { if (pend === null) pend = snap(); fn(e.value); sauverLocal(); dessiner(); }
      if (pend !== null && pend !== snap()) { undo.push(pend); redo = []; }
      pend = null; $('#bAnnuler').disabled = !undo.length;
    });
  }

  function panneau() {
    pend = null;
    var ns = idsN(), ls = idsL(), c = $('#champs'), h = '';
    $('#bAnnuler').disabled = !undo.length; $('#bRefaire').disabled = !redo.length;
    $('#bRelier').disabled = ns.length !== 2; $('#bDupliquer').disabled = !ns.length;
    $('#bCopier').disabled = !ns.length; $('#bColler').disabled = !presse;
    $('#bMulti').classList.toggle('actif', multi);
    var n1 = ns.length ? noeud(ns[0]) : null, l1 = ls.length ? lien(ls[0]) : null;
    var f1 = n1 ? (KINDS[n1.kind] || [])[1] : '';
    var hasDetails = n1 && (f1 === 'rect' || f1 === 'round' || f1 === 'text');

    if (ns.length === 1 && !ls.length) {
      h += '<label>Nom / Libellé<input id="fLabel"></label>' +
        (hasDetails ? '<label>Attributs / Contenu (un par ligne)<textarea id="fDet"></textarea></label><p class="aide">Astuce Merise : préfixez un attribut avec <code>#</code> pour le souligner automatiquement comme identifiant/clé primaire (ex. <code>#id_client</code>).</p>' : '');
    } else if (ls.length === 1 && !ns.length) {
      h += '<label>Texte du lien (ex. 0,N)<input id="fLien"></label><p class="aide">Cardinalités</p><div class="cardin" id="bCardin">' +
        ['0,1', '0,N', '1,1', '1,N'].map(function (card) { return '<button type="button" data-c="' + card + '">' + card + '</button>'; }).join('') + '</div>';
    } else if (!ns.length && !ls.length) {
      h += '<p class="aide">Touchez un élément pour le modifier. Glissez-le pour le déplacer. Pour relier deux éléments, activez « Sélection multiple », touchez-les, puis « Relier ».</p>' +
        '<h3>Tout le diagramme</h3>' + cC('gFond', 'Couleur du fond', doc.fond || '#ffffff') + cF('gFont', 'Police partout', '', true) +
        '<button id="bRazTout">Réinitialiser tous les styles</button>';
    }

    if (n1) {
      var y = sn(n1);
      h += '<h3>Texte & Typographie' + (ns.length > 1 ? ' (' + ns.length + ')' : '') + '</h3>' +
        cF('sFont', 'Police', y.font) +
        cR('sFs', 'Taille du texte', y.fs, 10, 36, 'px') +
        cC('sTc', 'Couleur du texte', y.tc) +
        '<div class="groupe-boutons">' +
          '<button type="button" id="bToggleB" class="btn-b' + (y.b ? ' actif' : '') + '" title="Gras (Ctrl+B)">Gras</button>' +
          '<button type="button" id="bToggleI" class="btn-i' + (y.i ? ' actif' : '') + '" title="Italique (Ctrl+I)">Italique</button>' +
          '<button type="button" id="bToggleU" class="btn-u' + (y.u ? ' actif' : '') + '" title="Souligné (Ctrl+U)"><u>Souligné</u></button>' +
        '</div>' +
        '<div class="ligneS" style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;font-size:.9rem;margin-top:.3rem;">' +
          '<span>Alignement</span>' +
          '<div class="groupe-boutons" style="margin:0;flex:1;max-width:180px;">' +
            '<button type="button" id="bAlignL" class="' + (y.align === 'left' ? 'actif' : '') + '">Gauche</button>' +
            '<button type="button" id="bAlignC" class="' + (y.align === 'center' ? 'actif' : '') + '">Centre</button>' +
            '<button type="button" id="bAlignR" class="' + (y.align === 'right' ? 'actif' : '') + '">Droite</button>' +
          '</div>' +
        '</div>';

      h += '<h3>Zone & Dimensions</h3>' +
        cR('sW', 'Largeur', y.w || Math.round(taille(n1)[0]), 40, 600, 'px') +
        cR('sH', 'Hauteur', y.h || Math.round(taille(n1)[1]), 20, 400, 'px') +
        '<div class="ligne-outils">' +
          '<button type="button" id="bAutoTaille" class="btn-petit">Taille auto adaptée au texte</button>' +
        '</div>';

      h += '<h3>Trait & Bordure</h3>' +
        cC('sStroke', 'Couleur du trait', (y.stroke === 'none' || y.stroke === 'transparent') ? '#1f9d55' : y.stroke) +
        cR('sSw', 'Épaisseur du trait', y.sw, 0, 12, 'px') +
        cSelect('sDash', 'Style du trait', [
          ['none', 'Continu ────'],
          ['pointille', 'Pointillés ·····'],
          ['tiret', 'Tirets - - -'],
          ['dashdot', 'Tiret-point -·-·-']
        ], y.dash) +
        cR('sRx', 'Coins arrondis', y.rx === null ? (f1 === 'round' ? 18 : (f1 === 'rect' ? 4 : 0)) : y.rx, 0, 35, 'px') +
        '<div class="ligne-outils">' +
          '<button type="button" id="bSansBordure" class="btn-petit">Sans bordure (trait 0)</button>' +
        '</div>';

      h += '<h3>Fond de la zone</h3>' +
        cC('sFill', 'Couleur du fond', (y.fill === 'none' || y.fill === 'transparent') ? '#ffffff' : y.fill) +
        '<div class="ligne-outils">' +
          '<button type="button" id="bFondTransp" class="btn-petit">Fond transparent</button>' +
        '</div>' +
        '<p><button id="bTous">Appliquer à tous les éléments du même type</button> <button id="bRazN">Réinitialiser le style</button></p>';
    }

    if (l1) {
      var z = sl(l1);
      h += '<h3>Texte du lien' + (ls.length > 1 ? ' (' + ls.length + ')' : '') + '</h3>' +
        cC('lTc', 'Couleur du texte', z.tc) +
        cF('lFont', 'Police', z.font) +
        cR('lFs', 'Taille du texte', z.fs, 10, 30, 'px') +
        '<div class="groupe-boutons">' +
          '<button type="button" id="bToggleLU" class="btn-u' + (z.u ? ' actif' : '') + '"><u>Souligné</u></button>' +
        '</div>';

      h += '<h3>Trait de la liaison</h3>' +
        cC('lCol', 'Couleur du trait', z.color) +
        cR('lW', 'Épaisseur du trait', z.w, 1, 15, 'px') +
        cSelect('lDash', 'Style du trait', [
          ['none', 'Continu ────'],
          ['pointille', 'Pointillés ·····'],
          ['tiret', 'Tirets - - -'],
          ['dashdot', 'Tiret-point -·-·-'],
          ['long', 'Tirets longs ——']
        ], z.dash);

      h += '<h3>Flèches</h3>' +
        cSelect('lArr', 'Direction de la flèche', [
          ['none', 'Aucune flèche ────'],
          ['end', 'Vers la fin ───►'],
          ['start', 'Vers le début ◄───'],
          ['both', 'Aux deux bouts ◄───►']
        ], z.arrow) +
        cSelect('lArrType', 'Forme de la flèche', [
          ['triangle', 'Triangle plein (standard)'],
          ['ouvert', 'Flèche ouverte en V ( > )'],
          ['losange', 'Losange plein (composition)'],
          ['losange_vide', 'Losange vide (agrégation)'],
          ['rond', 'Cercle / bille']
        ], z.arrowType) +
        cSelect('lArrSize', 'Taille de la flèche', [
          ['0.7', 'Petite (x0.7)'],
          ['1', 'Normale (x1.0)'],
          ['1.4', 'Grande (x1.4)'],
          ['1.8', 'Très grande (x1.8)']
        ], String(z.arrowSize)) +
        '<p><button id="bTousL">Appliquer à tous les liens</button> <button id="bRazL">Réinitialiser le style</button></p>';
    }

    c.innerHTML = h;

    // Événements éléments
    if (ns.length === 1 && !ls.length) {
      $('#fLabel').value = n1.label;
      lie('#fLabel', function (v) { n1.label = v || ' '; });
      if (hasDetails) {
        $('#fDet').value = n1.details || '';
        lie('#fDet', function (v) { n1.details = v; });
      }
    }

    // Événements liens
    if (ls.length === 1 && !ns.length) {
      $('#fLien').value = l1.label || '';
      lie('#fLien', function (v) { l1.label = v; });
      var card = $('#bCardin');
      if (card) card.onclick = function (e) {
        var b = e.target.closest('[data-c]'); if (!b) return;
        if (pend === null) pend = snap();
        l1.label = b.getAttribute('data-c');
        $('#fLien').value = l1.label;
        sauverLocal(); dessiner();
      };
    }

    if (n1) {
      lie('#sFont', function (v) { appN(function (s) { s.font = v; }); });
      lie('#sFs', function (v) { appN(function (s) { s.fs = v; }); }, 'px');
      lie('#sTc', function (v) { appN(function (s) { s.tc = v; }); });
      lie('#sW', function (v) { appN(function (s) { s.w = v; }); }, 'px');
      lie('#sH', function (v) { appN(function (s) { s.h = v; }); }, 'px');
      lie('#sStroke', function (v) { appN(function (s) { s.stroke = v; }); });
      lie('#sSw', function (v) { appN(function (s) { s.sw = v; }); }, 'px');
      lie('#sDash', function (v) { appN(function (s) { s.dash = v; }); });
      lie('#sRx', function (v) { appN(function (s) { s.rx = v; }); }, 'px');
      lie('#sFill', function (v) { appN(function (s) { s.fill = v; }); });

      // Boutons toggle Gras, Italique, Souligné
      var bB = $('#bToggleB');
      if (bB) bB.onclick = function () {
        avant();
        var nv = !sn(n1).b;
        appN(function (s) { s.b = nv; });
        maj();
      };
      var bI = $('#bToggleI');
      if (bI) bI.onclick = function () {
        avant();
        var nv = !sn(n1).i;
        appN(function (s) { s.i = nv; });
        maj();
      };
      var bU = $('#bToggleU');
      if (bU) bU.onclick = function () {
        avant();
        var nv = !sn(n1).u;
        appN(function (s) { s.u = nv; });
        maj();
      };

      // Alignements
      ['L', 'C', 'R'].forEach(function (code) {
        var alignVal = code === 'L' ? 'left' : (code === 'R' ? 'right' : 'center');
        var btn = $('#bAlign' + code);
        if (btn) btn.onclick = function () {
          avant();
          appN(function (s) { s.align = alignVal; });
          maj();
        };
      });

      // Bouton taille auto
      var bAuto = $('#bAutoTaille');
      if (bAuto) bAuto.onclick = function () {
        avant();
        appN(function (s) { delete s.w; delete s.h; });
        maj();
        toast('Taille automatique adaptée au texte.');
      };

      // Bouton sans bordure
      var bSans = $('#bSansBordure');
      if (bSans) bSans.onclick = function () {
        avant();
        appN(function (s) { s.sw = 0; s.stroke = 'none'; });
        maj();
      };

      // Bouton fond transparent
      var bTransp = $('#bFondTransp');
      if (bTransp) bTransp.onclick = function () {
        avant();
        appN(function (s) { s.fill = 'none'; });
        maj();
      };

      $('#bTous').onclick = function () {
        avant();
        doc.nodes.forEach(function (n) { if (n.kind === n1.kind) n.style = Object.assign({}, n1.style); });
        maj();
        toast('Style appliqué à tous les éléments « ' + KINDS[n1.kind][0] + ' ».');
      };
      $('#bRazN').onclick = function () {
        avant();
        ns.forEach(function (i) { delete noeud(i).style; });
        maj();
      };
    }

    if (l1) {
      lie('#lTc', function (v) { appL(function (s) { s.tc = v; }); });
      lie('#lFont', function (v) { appL(function (s) { s.font = v; }); });
      lie('#lFs', function (v) { appL(function (s) { s.fs = v; }); }, 'px');
      lie('#lCol', function (v) { appL(function (s) { s.color = v; }); });
      lie('#lW', function (v) { appL(function (s) { s.w = v; }); }, 'px');
      lie('#lDash', function (v) { appL(function (s) { s.dash = v; }); });
      lie('#lArr', function (v) { appL(function (s) { s.arrow = v; }); });
      lie('#lArrType', function (v) { appL(function (s) { s.arrowType = v; }); });
      lie('#lArrSize', function (v) { appL(function (s) { s.arrowSize = +v; }); });

      var bLU = $('#bToggleLU');
      if (bLU) bLU.onclick = function () {
        avant();
        var nv = !sl(l1).u;
        appL(function (s) { s.u = nv; });
        maj();
      };

      $('#bTousL').onclick = function () {
        avant();
        doc.links.forEach(function (l) { l.style = Object.assign({}, l1.style); });
        maj();
        toast('Style appliqué à tous les liens.');
      };
      $('#bRazL').onclick = function () {
        avant();
        ls.forEach(function (i) { delete lien(i).style; });
        maj();
      };
    }

    if (!ns.length && !ls.length) {
      lie('#gFond', function (v) { doc.fond = v; });
      $('#gFont').onchange = function (e) {
        if (!e.target.value) return; avant();
        doc.nodes.forEach(function (n) { n.style = n.style || {}; n.style.font = e.target.value; });
        doc.links.forEach(function (l) { l.style = l.style || {}; l.style.font = e.target.value; });
        maj();
      };
      $('#bRazTout').onclick = function () {
        if (!confirm('Réinitialiser les couleurs, polices et traits de tout le diagramme ?')) return;
        avant(); delete doc.fond;
        doc.nodes.forEach(function (n) { delete n.style; });
        doc.links.forEach(function (l) { delete l.style; });
        maj();
      };
    }
  }

  /* ---------- Interactions souris / tactile ---------- */
  function pos(e) { var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
  svg.addEventListener('pointerdown', function (e) {
    var c = e.target.closest('[data-id]'), m = multi || e.shiftKey || e.ctrlKey;
    if (!c) { if (!m) { sel.clear(); dessiner(); panneau(); } return; }
    var id = c.getAttribute('data-id');
    if (m) { if (sel.has(id)) sel.delete(id); else sel.add(id); }
    else if (!sel.has(id)) { sel.clear(); sel.add(id); }
    if (id[0] === 'n' && !m) { var p = pos(e); drag = { x: p.x, y: p.y, avant: snap(), bouge: false }; try { svg.setPointerCapture(e.pointerId); } catch (x) {} }
    dessiner(); panneau();
  });
  svg.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var p = pos(e), dx = p.x - drag.x, dy = p.y - drag.y;
    if (!drag.bouge && Math.abs(dx) + Math.abs(dy) < 3) return;
    drag.bouge = true; drag.x = p.x; drag.y = p.y;
    idsN().forEach(function (i) { var n = noeud(i); n.x = Math.max(0, n.x + dx); n.y = Math.max(0, n.y + dy); });
    dessiner();
  });
  function accrocher(n) {
    if (!grille) return;
    n.x = Math.round(n.x / 24) * 24; n.y = Math.round(n.y / 24) * 24;
  }
  function fin() {
    if (drag && drag.bouge) {
      idsN().forEach(function (i) { accrocher(noeud(i)); });
      undo.push(drag.avant); redo = []; maj();
    }
    drag = null;
  }
  svg.addEventListener('pointerup', fin); svg.addEventListener('pointercancel', fin);
  document.addEventListener('keydown', function (e) {
    var t = e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || dlg.open) return;
    var k = e.key.toLowerCase(), cmd = e.ctrlKey || e.metaKey;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); suppr(idsN(), idsL()); }
    else if (cmd && k === 'z') { e.preventDefault(); annuler(); }
    else if (cmd && k === 'y') { e.preventDefault(); refaire(); }
    else if (cmd && k === 's') { e.preventDefault(); $('#bEnregistrer').click(); }
    else if (cmd && k === 'a') { e.preventDefault(); sel.clear(); doc.nodes.forEach(function (n) { sel.add(n.id); }); maj(); }
    else if (cmd && k === 'c') { e.preventDefault(); copier(); }
    else if (cmd && k === 'v') { e.preventDefault(); coller(); }
    else if (cmd && k === 'd') { e.preventDefault(); dupliquer(); }
    else if (cmd && k === 'u') {
      e.preventDefault();
      if (!idsN().length && !idsL().length) return;
      avant();
      var nouvelEtatU = null;
      if (idsN().length) {
        var n0 = noeud(idsN()[0]);
        nouvelEtatU = !sn(n0).u;
        idsN().forEach(function (i) { var n = noeud(i); n.style = n.style || {}; n.style.u = nouvelEtatU; });
      }
      if (idsL().length) {
        if (nouvelEtatU === null) nouvelEtatU = !sl(lien(idsL()[0])).u;
        idsL().forEach(function (i) { var l = lien(i); l.style = l.style || {}; l.style.u = nouvelEtatU; });
      }
      maj();
      toast(nouvelEtatU ? 'Texte souligné.' : 'Soulignement retiré.');
    }
    else if (cmd && k === 'b') {
      e.preventDefault();
      if (!idsN().length) return;
      avant();
      var nvB = !sn(noeud(idsN()[0])).b;
      idsN().forEach(function (i) { var n = noeud(i); n.style = n.style || {}; n.style.b = nvB; });
      maj();
    }
    else if (cmd && k === 'i') {
      e.preventDefault();
      if (!idsN().length) return;
      avant();
      var nvI = !sn(noeud(idsN()[0])).i;
      idsN().forEach(function (i) { var n = noeud(i); n.style = n.style || {}; n.style.i = nvI; });
      maj();
    }
  });

  /* ---------- Zoom, alignement, copie, SQL, exemples ---------- */
  function appliquerVue() {
    svg.style.transform = 'scale(' + zoom + ')';
    svg.style.transformOrigin = '0 0';
    svg.classList.toggle('sans-grille', !grille);
    $('#bZoomReset').textContent = Math.round(zoom * 100) + ' %';
    $('#bGrille').classList.toggle('actif', grille);
  }
  function setZoom(z) { zoom = Math.min(2.5, Math.max(0.4, z)); appliquerVue(); }
  function ajuster() {
    if (!doc.nodes.length) { setZoom(1); return; }
    var x2 = 0, y2 = 0;
    doc.nodes.forEach(function (n) { var t = taille(n); x2 = Math.max(x2, n.x + t[0]); y2 = Math.max(y2, n.y + t[1]); });
    var box = svg.parentElement.getBoundingClientRect();
    var z = Math.min((box.width - 24) / (x2 + 80), (box.height - 60) / (y2 + 80), 1.5);
    setZoom(z);
  }
  function aligner(mode) {
    var ns = idsN(); if (ns.length < 2) { toast('Sélectionnez au moins deux éléments.'); return; }
    avant();
    var items = ns.map(function (i) { var n = noeud(i), t = taille(n); return { n: n, w: t[0], h: t[1] }; });
    if (mode === 'g') { var x = Math.min.apply(null, items.map(function (i) { return i.n.x; })); items.forEach(function (i) { i.n.x = x; }); }
    if (mode === 'd') { var r = Math.max.apply(null, items.map(function (i) { return i.n.x + i.w; })); items.forEach(function (i) { i.n.x = r - i.w; }); }
    if (mode === 'c') {
      var cx = items.reduce(function (s, i) { return s + i.n.x + i.w / 2; }, 0) / items.length;
      items.forEach(function (i) { i.n.x = cx - i.w / 2; });
    }
    if (mode === 'h') { var y = Math.min.apply(null, items.map(function (i) { return i.n.y; })); items.forEach(function (i) { i.n.y = y; }); }
    if (mode === 'b') { var bas = Math.max.apply(null, items.map(function (i) { return i.n.y + i.h; })); items.forEach(function (i) { i.n.y = bas - i.h; }); }
    if (mode === 'm') {
      var cy = items.reduce(function (s, i) { return s + i.n.y + i.h / 2; }, 0) / items.length;
      items.forEach(function (i) { i.n.y = cy - i.h / 2; });
    }
    maj();
  }
  function copier() {
    var ns = idsN(); if (!ns.length) { toast('Rien à copier.'); return; }
    var set = {}; ns.forEach(function (i) { set[i] = true; });
    presse = {
      nodes: ns.map(function (i) { return JSON.parse(JSON.stringify(noeud(i))); }),
      links: doc.links.filter(function (l) { return set[l.from] && set[l.to]; }).map(function (l) { return JSON.parse(JSON.stringify(l)); })
    };
    toast(presse.nodes.length + ' élément(s) copiés.');
  }
  function coller() {
    if (!presse || !presse.nodes.length) { toast('Presse-papiers vide.'); return; }
    avant(); var map = {};
    presse.nodes.forEach(function (o) {
      var c = JSON.parse(JSON.stringify(o)); c.id = 'n' + (++doc.seq); c.x += 36; c.y += 36; map[o.id] = c.id; doc.nodes.push(c);
    });
    presse.links.forEach(function (l) {
      doc.links.push({ id: 'l' + (++doc.seq), from: map[l.from], to: map[l.to], label: l.label, style: l.style });
    });
    sel.clear(); Object.keys(map).forEach(function (k) { sel.add(map[k]); }); maj();
  }
  function identSql(s) {
    var t = String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_]+/g, '_').replace(/^(\d)/, '_$1');
    return (t || 'objet').slice(0, 64);
  }
  function colSql(ligne) {
    var m = String(ligne).match(/^(\S+)\s+(.+)$/);
    if (m && /INT|VARCHAR|DATE|TEXT|BOOL|CHAR|DECIMAL|FLOAT|TIME/i.test(m[2])) return identSql(m[1]) + ' ' + m[2];
    return identSql(ligne) + ' VARCHAR(255)';
  }
  function genererSql() {
    var tables = doc.nodes.filter(function (n) { return n.kind === 'table' || n.kind === 'entite'; });
    if (!tables.length) { toast('Ajoutez des entités (MCD) ou des tables (MLD).'); return; }
    var sql = '-- Script généré par Merise Studio (« ' + (doc.titre || 'diagramme') + ' »)\n-- À relire avant exécution.\n\n';
    tables.forEach(function (n) {
      var cols = lignes(n); if (!cols.length) cols = ['id INT PRIMARY KEY AUTO_INCREMENT'];
      sql += 'CREATE TABLE ' + identSql(n.label) + ' (\n  ' + cols.map(colSql).join(',\n  ') + '\n);\n\n';
    });
    doc.nodes.filter(function (n) { return n.kind === 'association'; }).forEach(function (n) {
      var cols = lignes(n);
      sql += '-- Association « ' + n.label + ' »\nCREATE TABLE ' + identSql(n.label) + ' (\n  id INT PRIMARY KEY AUTO_INCREMENT' +
        (cols.length ? ',\n  ' + cols.map(colSql).join(',\n  ') : '') + '\n);\n\n';
    });
    afficherTexte('SQL généré', sql);
  }
  function dictionnaire() {
    if (!doc.nodes.length) { toast('Le diagramme est vide.'); return; }
    var txt = 'Dictionnaire de données — ' + (doc.titre || 'Sans titre') + '\nType : ' + (TITRES[doc.type] || doc.type) + '\n\n';
    doc.nodes.forEach(function (n) {
      txt += KINDS[n.kind][0] + ' : ' + n.label + '\n';
      lignes(n).forEach(function (l) { txt += '  - ' + l + '\n'; });
      txt += '\n';
    });
    if (doc.links.length) {
      txt += 'Liens\n';
      doc.links.forEach(function (l) {
        var a = noeud(l.from), b = noeud(l.to);
        txt += '  ' + (a ? a.label : '?') + ' — ' + (l.label || '…') + ' — ' + (b ? b.label : '?') + '\n';
      });
    }
    afficherTexte('Dictionnaire de données', txt);
  }
  function afficherTexte(titre, txt) {
    dialogue('<h2>' + titre + '</h2><div class="dlg-code"><textarea id="fCode" readonly></textarea></div>' +
      '<p><button class="primaire" id="bCopierTxt">Copier</button> <button data-fermer>Fermer</button></p>');
    $('#fCode').value = txt;
    $('#bCopierTxt').onclick = function () {
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('Copié dans le presse-papiers.'); });
      else { $('#fCode').select(); document.execCommand('copy'); toast('Copié.'); }
    };
  }
  function exemples() {
    var opts = [
      ['MCD boutique (Client, Commande, Produit)', exempleBoutique],
      ['MLD bibliothèque', exempleBiblio],
      ['MCC prise de rendez-vous', exempleMcc]
    ];
    dialogue('<h2>Exemples</h2><p class="aide">Le diagramme actuel sera remplacé. Enregistrez-le avant si besoin.</p><div class="liste">' +
      opts.map(function (o, i) { return '<button data-i="' + i + '">' + o[0] + '</button>'; }).join('') +
      '</div><p><button data-fermer>Fermer</button></p>');
    dlg.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-fermer')) return dlg.close();
      dlg.close(); opts[+b.getAttribute('data-i')][1]();
    };
  }
  function noeudEx(kind, x, y, label, details) {
    return { id: 'n' + (++doc.seq), kind: kind, x: x, y: y, label: label, details: details || '' };
  }
  function lienEx(from, to, label) { return { id: 'l' + (++doc.seq), from: from, to: to, label: label || '' }; }
  function chargerExemple(type, titre, nodes, links) {
    ouvrirDoc({ titre: titre, type: type, seq: doc.seq, nodes: nodes, links: links, trash: [], serveurId: null });
    toast('Exemple chargé : ' + titre);
  }
  function exempleBoutique() {
    doc.seq = 0;
    var c = noeudEx('entite', 80, 80, 'Client', 'id_client\nnom\nemail'),
      cmd = noeudEx('entite', 420, 80, 'Commande', 'id_commande\ndate\nmontant'),
      p = noeudEx('entite', 250, 320, 'Produit', 'id_produit\nlibelle\nprix'),
      passer = noeudEx('association', 250, 80, 'Passe', ''),
      contenir = noeudEx('association', 330, 200, 'Contient', 'quantite');
    chargerExemple('MCD', 'Boutique', [c, cmd, p, passer, contenir], [
      lienEx(c.id, passer.id, '1,1'), lienEx(passer.id, cmd.id, '0,N'),
      lienEx(cmd.id, contenir.id, '1,N'), lienEx(contenir.id, p.id, '0,N')
    ]);
  }
  function exempleBiblio() {
    doc.seq = 0;
    var a = noeudEx('table', 80, 100, 'Adherent', 'id INT PK\nnom VARCHAR(80)\nemail VARCHAR(120)'),
      l = noeudEx('table', 420, 100, 'Livre', 'id INT PK\ntitre VARCHAR(150)\nisbn VARCHAR(20)'),
      e = noeudEx('table', 250, 280, 'Emprunt', 'id INT PK\nadherent_id INT\nlivre_id INT\ndebut DATE\nretour DATE');
    chargerExemple('MLD', 'Bibliothèque', [a, l, e], [lienEx(a.id, e.id, '1,N'), lienEx(l.id, e.id, '1,N')]);
  }
  function exempleMcc() {
    doc.seq = 0;
    var cl = noeudEx('acteur', 80, 160, 'Client', ''), sec = noeudEx('acteur', 420, 80, 'Secrétariat', ''), med = noeudEx('acteur', 420, 260, 'Médecin', ''),
      d = noeudEx('message', 250, 80, 'Demande RDV', ''), c = noeudEx('message', 250, 200, 'Confirmation', ''), cr = noeudEx('message', 250, 320, 'Compte-rendu', '');
    chargerExemple('MCC', 'Rendez-vous', [cl, sec, med, d, c, cr], [
      lienEx(cl.id, d.id, ''), lienEx(d.id, sec.id, ''), lienEx(sec.id, c.id, ''), lienEx(c.id, cl.id, ''), lienEx(med.id, cr.id, ''), lienEx(cr.id, cl.id, '')
    ]);
  }
  function raccourcis() {
    dialogue('<h2>Raccourcis</h2><p>Ctrl+S enregistrer · Ctrl+Z / Y annuler / rétablir · Ctrl+A tout sélectionner<br>Ctrl+C / V / D copier / coller / dupliquer · Suppr supprimer · Maj+clic sélection multiple</p>' +
      '<p><a href="aide.html">Ouvrir le guide complet</a></p><p><button data-fermer>Fermer</button></p>');
  }

  /* ---------- Exports ---------- */
  function telecharger(blob, nom) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function nomFichier(ext) { return (doc.titre || 'diagramme').replace(/[^\w\-àâçéèêëîïôûùü ]+/gi, '_') + ext; }
  function svgExport() {
    if (!doc.nodes.length) { toast('Le diagramme est vide.'); return null; }
    var old = sel; sel = new Set(); dessiner();
    var x1 = 1e9, y1 = 1e9, x2 = 0, y2 = 0;
    doc.nodes.forEach(function (n) { var t = taille(n); x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y); x2 = Math.max(x2, n.x + t[0]); y2 = Math.max(y2, n.y + t[1]); });
    var c = svg.cloneNode(true), w = x2 - x1 + 60, h = y2 - y1 + 60;
    c.setAttribute('xmlns', NS); c.setAttribute('viewBox', (x1 - 30) + ' ' + (y1 - 30) + ' ' + w + ' ' + h);
    c.setAttribute('width', w); c.setAttribute('height', h); c.removeAttribute('style');
    var fond = el('rect', { x: x1 - 30, y: y1 - 30, width: w, height: h, fill: doc.fond || '#fff' }); c.insertBefore(fond, c.firstChild);
    sel = old; dessiner();
    return { txt: new XMLSerializer().serializeToString(c), w: w, h: h };
  }
  function exportPng() {
    var s = svgExport(); if (!s) return;
    var img = new Image();
    img.onload = function () {
      var cv = document.createElement('canvas'); cv.width = s.w * 2; cv.height = s.h * 2;
      var cx = cv.getContext('2d'); cx.scale(2, 2); cx.drawImage(img, 0, 0, s.w, s.h);
      cv.toBlob(function (b) { telecharger(b, nomFichier('.png')); toast('Image PNG enregistrée.'); });
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.txt);
  }
  function exportPdf() {
    var s = svgExport(); if (!s) return;
    var w = window.open('', '_blank');
    if (!w) { toast('Autorisez les fenêtres pop-up pour exporter en PDF.'); return; }
    w.document.write('<title>' + doc.titre + '</title><style>@page{margin:10mm}body{margin:0}svg{max-width:100%;height:auto}</style>' + s.txt);
    w.document.close(); setTimeout(function () { w.print(); }, 400);
  }
  function exportSvg() {
    var s = svgExport(); if (!s) return;
    telecharger(new Blob([s.txt], { type: 'image/svg+xml' }), nomFichier('.svg'));
    toast('Fichier SVG enregistré.');
  }

  /* ---------- Enregistrer : navigateur + fichier dans l'appareil + serveur ---------- */
  // Enregistrer exige un compte : sans connexion, on ouvre la fenêtre de connexion puis on reprend
  async function enregistrer() {
    sauverLocal(); // brouillon automatique dans le navigateur
    await Compte.pret;
    if (!Compte.connecte()) { Compte.demander(enregistrer); return; }
    try { await Compte.sauver(doc); sauverLocal(); }
    catch (e) {
      if (!Compte.connecte()) { Compte.demander(enregistrer); return; }
      toast('Enregistrement impossible : ' + e.message); return;
    }
    telecharger(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), nomFichier('.merise.json'));
    toast('Projet enregistré sur votre compte et dans les téléchargements de votre appareil.');
  }
  function ouvrirDoc(o) {
    if (!o || !Array.isArray(o.nodes)) { toast('Fichier invalide.'); return; }
    doc = Object.assign(nouveau(), o); doc.links = doc.links || []; doc.trash = doc.trash || [];
    undo = []; redo = []; sel.clear(); $('#titre').value = doc.titre; $('#type').value = doc.type; palette(); maj();
  }

  /* ---------- Utilitaires d'interface ---------- */
  var tt;
  function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('visible'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('visible'); }, 3500); }
  function dialogue(html) { dlg.innerHTML = html; dlg.onclick = function (e) { if (e.target.closest('[data-fermer]')) dlg.close(); }; if (!dlg.open) dlg.showModal(); }
  function palette() {
    $('#boutonsPalette').innerHTML = (TYPES[doc.type] || []).concat(doc.type === 'LIBRE' ? [] : ['texte']).map(function (k) {
      return '<button data-k="' + k + '">+ ' + KINDS[k][0] + '</button>';
    }).join('');
  }

  /* ---------- Démarrage ---------- */
  $('#type').innerHTML = Object.keys(TITRES).map(function (k) { return '<option value="' + k + '">' + TITRES[k] + '</option>'; }).join('');
  try { doc = JSON.parse(localStorage.getItem('ms_doc')); } catch (e) { doc = null; }
  if (!doc || !Array.isArray(doc.nodes)) doc = nouveau();
  doc.links = doc.links || []; doc.trash = doc.trash || [];
  $('#titre').value = doc.titre; $('#type').value = doc.type;
  $('#titre').addEventListener('input', function (e) { doc.titre = e.target.value; sauverLocal(); });
  $('#type').addEventListener('change', function (e) { doc.type = e.target.value; palette(); sauverLocal(); });
  $('#boutonsPalette').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (b) ajouter(b.getAttribute('data-k')); });
  $('#bAnnuler').onclick = annuler; $('#bRefaire').onclick = refaire; $('#bRelier').onclick = relier;
  $('#bDupliquer').onclick = dupliquer; $('#bSuppr').onclick = dlgSuppr;
  $('#bCopier').onclick = copier; $('#bColler').onclick = coller;
  $('#bMulti').onclick = function () { multi = !multi; panneau(); };
  $('#bZoomMoins').onclick = function () { setZoom(zoom - 0.1); };
  $('#bZoomPlus').onclick = function () { setZoom(zoom + 0.1); };
  $('#bZoomReset').onclick = function () { setZoom(1); };
  $('#bGrille').onclick = function () { grille = !grille; appliquerVue(); };
  $('#bAjuster').onclick = ajuster;
  $('#bAlG').onclick = function () { aligner('g'); };
  $('#bAlC').onclick = function () { aligner('c'); };
  $('#bAlD').onclick = function () { aligner('d'); };
  $('#bAlH').onclick = function () { aligner('h'); };
  $('#bAlM').onclick = function () { aligner('m'); };
  $('#bAlB').onclick = function () { aligner('b'); };
  $('#bSql').onclick = genererSql;
  $('#bDico').onclick = dictionnaire;
  $('#bExemples').onclick = exemples;
  $('#bRaccourcis').onclick = raccourcis;
  $('#bAide').onclick = function () { location.href = 'aide.html'; };
  (function themeApp() {
    var b = $('#bTheme');
    function lab() { b.textContent = document.documentElement.classList.contains('sombre') ? 'Clair' : 'Sombre'; }
    lab();
    b.onclick = function () {
      var s = !document.documentElement.classList.contains('sombre');
      document.documentElement.classList.toggle('sombre', s);
      localStorage.setItem('ms_theme', s ? 'sombre' : 'clair');
      lab();
    };
  })();
  appliquerVue();
  // Enregistrer, Ouvrir, PNG, PDF et Nouveau exigent un compte : sinon la connexion s'ouvre.
  // « reprise » = l'action reprend seule après connexion (impossible pour Ouvrir/PDF : le navigateur veut un nouveau clic).
  function protege(fn, action, reprise) {
    return async function () {
      await Compte.pret;
      if (Compte.connecte()) return fn();
      Compte.demander(reprise ? fn : function () { toast('Connecté. Cliquez à nouveau sur « ' + action + ' ».'); },
        'Pour utiliser « ' + action + ' », connectez-vous ou créez un compte gratuit. Votre travail en cours est conservé.');
    };
  }
  $('#bEnregistrer').onclick = protege(enregistrer, 'Enregistrer', true);
  $('#bPng').onclick = protege(exportPng, 'PNG', true);
  $('#bPdf').onclick = protege(exportPdf, 'PDF', false);
  $('#bSvg').onclick = protege(exportSvg, 'SVG', true);
  $('#bOuvrir').onclick = protege(function () { $('#fichier').click(); }, 'Ouvrir', false);
  $('#fichier').onchange = function (e) {
    var f = e.target.files[0]; if (!f) return; var r = new FileReader();
    r.onload = function () { try { ouvrirDoc(JSON.parse(r.result)); toast('Diagramme ouvert.'); } catch (x) { toast('Fichier invalide.'); } };
    r.readAsText(f); e.target.value = '';
  };
  $('#bNouveau').onclick = protege(function () {
    if (doc.nodes.length && !confirm('Créer un nouveau diagramme ? Pensez à enregistrer le diagramme actuel.')) return;
    ouvrirDoc(nouveau($('#type').value));
  }, 'Nouveau', true);
  palette(); maj();

  window.Editeur = { doc: function () { return doc; }, ouvrir: ouvrirDoc, toast: toast, dlg: dialogue, fermer: function () { dlg.close(); } };
})();
