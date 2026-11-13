/* En-tête, pied de page, thème et formulaire de contact — pages du site */
(function () {
  'use strict';
  var PAGE = document.body.getAttribute('data-page') || '';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function liens(actif) {
    var arr = [
      ['index.html', 'Accueil'],
      ['editeur.html', 'Éditeur'],
      ['aide.html', 'Aide'],
      ['a-propos.html', 'À propos'],
      ['contact.html', 'Contact']
    ];
    try {
      var u = JSON.parse(localStorage.getItem('ms_user') || 'null');
      if (u && u.role === 'admin') {
        arr.push(['admin.html', 'Administration']);
      }
    } catch (e) {}
    return arr.map(function (x) {
      return '<a href="' + x[0] + '"' + (x[0] === actif ? ' aria-current="page"' : '') + '>' + x[1] + '</a>';
    }).join('');
  }

  function injecter() {
    var skip = document.createElement('a');
    skip.className = 'skip';
    skip.href = '#contenu';
    skip.textContent = 'Aller au contenu';
    document.body.insertBefore(skip, document.body.firstChild);

    var header = document.createElement('header');
    header.className = 'site-barre';
    header.innerHTML =
      '<a class="marque" href="index.html"><span class="logo" aria-hidden="true"></span>Merise Studio</a>' +
      '<button type="button" class="menu-btn" id="bMenu" aria-expanded="false" aria-controls="navSite">Menu</button>' +
      '<nav id="navSite" class="site-nav">' + liens(PAGE) +
      '<button type="button" id="bTheme" class="theme-btn" aria-label="Changer le thème">Thème</button></nav>';
    document.body.insertBefore(header, skip.nextSibling);

    var footer = document.createElement('footer');
    footer.className = 'site-pied';
    footer.innerHTML =
      '<div class="pied-grille">' +
      '<div><strong>Merise Studio</strong><p>Éditeur de diagrammes MERISE pour étudier, concevoir et exporter vos modèles.</p></div>' +
      '<div><strong>Outils</strong><a href="editeur.html">Éditeur</a><a href="aide.html">Guide</a><a href="editeur.html">MCD · MLD · MCC · MCT · MOT</a></div>' +
      '<div><strong>Site</strong><a href="a-propos.html">À propos</a><a href="contact.html">Contact</a><a href="admin.html">Espace Administrateur</a><a href="mentions.html">Mentions légales</a><a href="confidentialite.html">Confidentialité</a></div>' +
      '</div><p class="copy">© ' + new Date().getFullYear() + ' Merise Studio · Projet éducatif</p>';
    document.body.appendChild(footer);

    var bMenu = document.getElementById('bMenu');
    var nav = document.getElementById('navSite');
    var menuQuery = window.matchMedia('(max-width: 720px)');
    function definirMenuOuvert(ouvert, rendreFocus) {
      nav.classList.toggle('ouvert', ouvert);
      bMenu.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
      bMenu.textContent = ouvert ? 'Fermer' : 'Menu';
      nav.setAttribute('aria-hidden', menuQuery.matches && !ouvert ? 'true' : 'false');
      if (!ouvert && rendreFocus) bMenu.focus();
    }
    bMenu.onclick = function () {
      definirMenuOuvert(!nav.classList.contains('ouvert'), false);
    };
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) definirMenuOuvert(false, false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('ouvert')) definirMenuOuvert(false, true);
    });
    function adapterMenuAuViewport(e) {
      if (!e.matches) definirMenuOuvert(false, false);
      else nav.setAttribute('aria-hidden', nav.classList.contains('ouvert') ? 'false' : 'true');
    }
    if (typeof menuQuery.addEventListener === 'function') menuQuery.addEventListener('change', adapterMenuAuViewport);
    else if (typeof menuQuery.addListener === 'function') menuQuery.addListener(adapterMenuAuViewport);
    definirMenuOuvert(false, false);
    themeInit();
  }

  function themeInit() {
    var sombre = localStorage.getItem('ms_theme') === 'sombre';
    document.documentElement.classList.toggle('sombre', sombre);
    var b = document.getElementById('bTheme');
    if (b) {
      b.textContent = sombre ? 'Clair' : 'Sombre';
      b.onclick = function () {
        var s = !document.documentElement.classList.contains('sombre');
        document.documentElement.classList.toggle('sombre', s);
        localStorage.setItem('ms_theme', s ? 'sombre' : 'clair');
        b.textContent = s ? 'Clair' : 'Sombre';
      };
    }
  }

  function animerContenu() {
    var requeteMouvementReduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (requeteMouvementReduit && requeteMouvementReduit.matches) return;
    if (!('IntersectionObserver' in window)) return;

    var cibles = document.querySelectorAll('.page > *');
    if (!cibles.length) return;

    var observateur = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (entree) {
        if (!entree.isIntersecting) return;
        entree.target.classList.add('ms-visible');
        observateur.unobserve(entree.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    Array.prototype.forEach.call(cibles, function (cible, index) {
      cible.style.setProperty('--ms-reveal-delay', Math.min(index % 4, 3) * 65 + 'ms');
      cible.classList.add('ms-reveal');
      observateur.observe(cible);
    });
  }

  function contact() {
    var f = document.getElementById('fContact');
    if (!f) return;
    f.onsubmit = async function (e) {
      e.preventDefault();
      var err = document.getElementById('contactErr');
      var ok = document.getElementById('contactOk');
      err.hidden = true; ok.hidden = true;
      var data = Object.fromEntries(new FormData(f));
      try {
        var r = await fetch('api/index.php?action=contact', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(j.erreur || 'Envoi impossible. Vérifiez que PHP/MySQL tourne.');
        ok.hidden = false;
        f.reset();
      } catch (x) {
        err.textContent = x.message;
        err.hidden = false;
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { injecter(); contact(); animerContenu(); });
  else { injecter(); contact(); animerContenu(); }

  window.MS = { esc: esc, themeInit: themeInit };
})();
