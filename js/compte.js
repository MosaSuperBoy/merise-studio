/* Merise Studio : compte utilisateur, diagrammes du serveur et administration */
(function () {
  'use strict';
  var E = window.Editeur, user = null, apres = null;
  var $ = function (s) { return document.querySelector(s); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  async function appel(action, corps) {
    var r = await fetch('api/index.php?action=' + action, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Token': localStorage.getItem('ms_token') || '' },
      body: JSON.stringify(corps || {})
    });
    var j = await r.json().catch(function () { return { erreur: 'Serveur indisponible (PHP/MySQL non configuré ?)' }; });
    if (r.status === 401 && action !== 'login' && action !== 'register') { localStorage.removeItem('ms_token'); localStorage.removeItem('ms_user'); user = null; majBouton(); }
    if (!r.ok) throw new Error(j.erreur || 'Erreur');
    return j;
  }

  function vueConnexion(mode, erreur, info) {
    var ins = mode === 'register';
    if (!info && window.location.protocol === 'file:') {
      info = 'Ouvrez le site via http://localhost/merise-studio/ (WAMP) pour que PHP et MySQL puissent fonctionner.';
    }
    E.dlg('<h2>' + (ins ? 'Créer un compte' : 'Se connecter') + '</h2>' + (info ? '<p class="aide">' + esc(info) + '</p>' : '') + '<form id="fAuth"> ' +
      (ins ? '<input name="nom" placeholder="Nom" required autocomplete="name">' : '') +
      '<input name="email" type="' + (ins ? 'email' : 'text') + '" placeholder="' + (ins ? 'E-mail' : 'Identifiant ou e-mail') + '" required autocomplete="' + (ins ? 'email' : 'username') + '">' +
      '<input name="mot_de_passe" type="password" placeholder="Mot de passe' + (ins ? ' (12 caractères min.)' : '') + '" ' + (ins ? 'minlength="12" maxlength="72"' : '') + ' required autocomplete="' + (ins ? 'new-password' : 'current-password') + '">' +
      (erreur ? '<p class="erreur">' + esc(erreur) + '</p>' : '') +
      '<button class="primaire">' + (ins ? 'Créer mon compte' : 'Se connecter') + '</button>' +
      '<button type="button" data-a="bascule">' + (ins ? 'J\'ai déjà un compte' : 'Créer un compte') + '</button>' +
      (ins ? '' : '<button type="button" data-a="oubli">Mot de passe oublié ?</button>') +
      '<button type="button" data-fermer>Fermer</button></form>');
    var d = $('#dlg');
    d.onclick = function (e) {
      if (e.target.closest('[data-fermer]')) d.close();
      if (e.target.closest('[data-a=bascule]')) vueConnexion(ins ? 'login' : 'register', null, info);
      if (e.target.closest('[data-a=oubli]')) vueResetRequest(info);
    };
    $('#fAuth').onsubmit = async function (e) {
      e.preventDefault();
      var f = Object.fromEntries(new FormData(e.target));
      try {
        var r = await appel(mode, f);
        localStorage.setItem('ms_token', r.jeton);
        localStorage.setItem('ms_user', JSON.stringify(r.utilisateur));
        user = r.utilisateur;
        majBouton();
        if (apres) { var f = apres; apres = null; d.close(); E.toast('Connecté.'); f(); } else vueCompte();
      } catch (x) { vueConnexion(mode, x.message, info); }
    };
  }

  function vueResetRequest(info, erreur) {
    E.dlg('<h2>Mot de passe oublié</h2>' +
      (info ? '<p class="aide">' + esc(info) + '</p>' : '') +
      '<form id="fResetRequest"><input name="email" type="email" placeholder="Adresse e-mail du compte" required autocomplete="email">' +
      (erreur ? '<p class="erreur">' + esc(erreur) + '</p>' : '') +
      '<button class="primaire">Envoyer un code</button><button type="button" data-a="retour-login">Retour à la connexion</button></form>');
    var d = $('#dlg');
    d.onclick = function (e) { if (e.target.closest('[data-a=retour-login]')) vueConnexion('login', null, info); };
    $('#fResetRequest').onsubmit = async function (e) {
      e.preventDefault();
      var email = new FormData(e.target).get('email');
      try {
        var r = await appel('password_reset_request', { email: email });
        vueResetConfirm(email, r.message);
      } catch (x) { vueResetRequest(info, x.message); }
    };
  }

  function vueResetConfirm(email, info, erreur) {
    E.dlg('<h2>Réinitialiser le mot de passe</h2>' +
      (info ? '<p class="aide">' + esc(info) + '</p>' : '') +
      '<form id="fResetConfirm"><input name="email" type="email" value="' + esc(email) + '" required autocomplete="email">' +
      '<input name="code" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" placeholder="Code à 6 chiffres" required autocomplete="one-time-code">' +
      '<input name="nouveau" type="password" minlength="12" maxlength="72" placeholder="Nouveau mot de passe (12 caractères min.)" required autocomplete="new-password">' +
      (erreur ? '<p class="erreur">' + esc(erreur) + '</p>' : '') +
      '<button class="primaire">Réinitialiser</button><button type="button" data-a="retour-reset">Renvoyer un code</button>' +
      '<button type="button" data-a="retour-login">Retour à la connexion</button></form>');
    var d = $('#dlg');
    d.onclick = function (e) {
      if (e.target.closest('[data-a=retour-reset]')) vueResetRequest();
      if (e.target.closest('[data-a=retour-login]')) vueConnexion('login');
    };
    $('#fResetConfirm').onsubmit = async function (e) {
      e.preventDefault();
      var f = Object.fromEntries(new FormData(e.target));
      try {
        await appel('password_reset_confirm', f);
        vueConnexion('login', null, 'Votre mot de passe a été réinitialisé. Vous pouvez vous connecter.');
      } catch (x) { vueResetConfirm(email, info, x.message); }
    };
  }

  function vueCompte() {
    if (!user) return vueConnexion('login');
    E.dlg('<h2>' + esc(user.nom) + '</h2><p class="aide">' + esc(user.email) + ' · ' + (user.role === 'admin' ? 'administrateur' : 'utilisateur') + '</p>' +
      '<div class="liste">' +
      (user.role === 'admin' ? '<a href="admin.html" class="btn primaire" style="text-align:center;text-decoration:none;display:block;margin-bottom:.4rem;font-weight:700;">🛠️ Espace Administrateur</a>' : '') +
      '<button data-a="liste">Mes diagrammes sur le serveur</button>' +
      '<button data-a="profil">Modifier mon profil</button>' +
      '<button data-a="mdp">Changer le mot de passe</button>' +
      (user.role === 'admin' ? '<button data-a="users">Gérer les utilisateurs</button><button data-a="messages">Messages de contact</button>' : '') +
      '<button data-a="sortir" class="danger">Se déconnecter</button><button data-fermer>Fermer</button></div>');
    var d = $('#dlg');
    d.onclick = async function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-fermer')) return d.close();
      var a = b.getAttribute('data-a');
      if (a === 'liste') vueListe();
      if (a === 'users') vueUsers();
      if (a === 'profil') vueProfil();
      if (a === 'mdp') vueMdp();
      if (a === 'messages') vueMessages();
      if (a === 'sortir') {
        try { await appel('logout'); } catch (x) {}
        localStorage.removeItem('ms_token');
        localStorage.removeItem('ms_user');
        user = null;
        majBouton();
        d.close();
        E.toast('Déconnecté.');
      }
    };
  }

  async function vueListe() {
    var d = $('#dlg');
    try {
      var l = (await appel('list')).diagrammes;
      E.dlg('<h2>Mes diagrammes</h2>' + (l.length ? l.map(function (x) {
        var corb = !!x.supprime_le;
        return '<div class="ligne"><span>' + esc(x.titre) + '<small>' + x.type + ' · ' + esc(x.modifie_le) + (corb ? ' · corbeille' : '') + '</small></span><span>' +
          (corb ? '<button data-a="restaurer" data-id="' + x.id + '">Restaurer</button> <button class="danger" data-a="purger" data-id="' + x.id + '">Effacer</button>'
                : '<button data-a="ouvrir" data-id="' + x.id + '">Ouvrir</button> <button class="danger" data-a="corbeille" data-id="' + x.id + '">Supprimer</button>') + '</span></div>';
      }).join('') : '<p class="aide">Aucun diagramme. Cliquez sur Enregistrer pour en envoyer un.</p>') +
        '<p><button data-a="retour">Retour</button></p>');
    } catch (x) { return E.toast(x.message); }
    d.onclick = async function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.getAttribute('data-a'), id = +b.getAttribute('data-id');
      try {
        if (a === 'retour') return vueCompte();
        if (a === 'ouvrir') { var o = (await appel('get', { id: id })).diagramme; o.contenu.serveurId = id; E.ouvrir(o.contenu); d.close(); return; }
        if (a === 'corbeille') await appel('delete', { id: id });
        if (a === 'restaurer') await appel('restore', { id: id });
        if (a === 'purger' && confirm('Effacer définitivement ce diagramme ?')) await appel('purge', { id: id });
        vueListe();
      } catch (x) { E.toast(x.message); }
    };
  }

  function vueProfil() {
    E.dlg('<h2>Profil</h2><form id="fProfil"><label>Nom<input name="nom" required maxlength="100" value="' + esc(user.nom) + '"></label>' +
      '<p class="aide">' + esc(user.email) + ' (e-mail non modifiable)</p>' +
      '<button class="primaire">Enregistrer</button><button type="button" data-a="retour">Retour</button></form>');
    var d = $('#dlg');
    d.onclick = function (e) { if (e.target.closest('[data-a=retour]')) vueCompte(); };
    $('#fProfil').onsubmit = async function (e) {
      e.preventDefault();
      try {
        var r = await appel('profil', { nom: new FormData(e.target).get('nom') });
        user = r.utilisateur; majBouton(); E.toast('Profil mis à jour.'); vueCompte();
      } catch (x) { E.toast(x.message); }
    };
  }

  function vueMdp() {
    E.dlg('<h2>Mot de passe</h2><form id="fMdp">' +
      '<input name="actuel" type="password" placeholder="Mot de passe actuel" required autocomplete="current-password">' +
      '<input name="nouveau" type="password" placeholder="Nouveau (12 caractères min.)" minlength="12" maxlength="72" required autocomplete="new-password">' +
      '<button class="primaire">Changer</button><button type="button" data-a="retour">Retour</button></form>');
    var d = $('#dlg');
    d.onclick = function (e) { if (e.target.closest('[data-a=retour]')) vueCompte(); };
    $('#fMdp').onsubmit = async function (e) {
      e.preventDefault();
      var f = Object.fromEntries(new FormData(e.target));
      try { await appel('mot_de_passe', f); E.toast('Mot de passe modifié.'); vueCompte(); }
      catch (x) { E.toast(x.message); }
    };
  }

  async function vueMessages() {
    var d = $('#dlg');
    try {
      var l = (await appel('messages')).messages;
      E.dlg('<h2>Messages</h2>' + (l.length ? l.map(function (m) {
        return '<div class="ligne"><span>' + esc(m.sujet) + '<small>' + esc(m.nom) + ' · ' + esc(m.email) + ' · ' + esc(m.cree_le) + (m.lu == 1 ? '' : ' · non lu') + '</small><small>' + esc(m.message) + '</small></span><span>' +
          '<button data-a="lu" data-id="' + m.id + '">Lu</button> <button class="danger" data-a="suppr" data-id="' + m.id + '">Supprimer</button></span></div>';
      }).join('') : '<p class="aide">Aucun message.</p>') + '<p><button data-a="retour">Retour</button></p>');
    } catch (x) { return E.toast(x.message); }
    d.onclick = async function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.getAttribute('data-a'), id = +b.getAttribute('data-id');
      try {
        if (a === 'retour') return vueCompte();
        if (a === 'lu') await appel('message_lu', { id: id });
        if (a === 'suppr' && confirm('Supprimer ce message ?')) await appel('message_suppr', { id: id });
        vueMessages();
      } catch (x) { E.toast(x.message); }
    };
  }

  async function vueUsers() {
    var d = $('#dlg');
    try {
      var l = (await appel('users')).utilisateurs;
      E.dlg('<h2>Utilisateurs</h2>' + l.map(function (u) {
        var moi = u.id === user.id;
        return '<div class="ligne"><span>' + esc(u.nom) + ' <small>' + esc(u.email) + ' · ' + u.role + (u.actif ? '' : ' · désactivé') + '</small></span><span>' +
          (moi ? '' : '<button data-a="actif" data-id="' + u.id + '" data-v="' + (u.actif ? 0 : 1) + '">' + (u.actif ? 'Désactiver' : 'Activer') + '</button> <button class="danger" data-a="suppr" data-id="' + u.id + '">Supprimer</button>') + '</span></div>';
      }).join('') + '<p><button data-a="retour">Retour</button></p>');
    } catch (x) { return E.toast(x.message); }
    d.onclick = async function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.getAttribute('data-a'), id = +b.getAttribute('data-id');
      try {
        if (a === 'retour') return vueCompte();
        if (a === 'actif') await appel('user_actif', { id: id, actif: +b.getAttribute('data-v') });
        if (a === 'suppr' && confirm('Supprimer cet utilisateur et ses diagrammes ?')) await appel('user_suppr', { id: id });
        vueUsers();
      } catch (x) { E.toast(x.message); }
    };
  }

  function majBouton() {
    if (!user) { $('#bCompte').textContent = 'Compte'; return; }
    $('#bCompte').textContent = user.nom + (user.role === 'admin' ? ' (Admin)' : '');
  }
  $('#bCompte').onclick = vueCompte;

  var pret = localStorage.getItem('ms_token')
    ? appel('me').then(function (r) {
        user = r.utilisateur;
        localStorage.setItem('ms_user', JSON.stringify(user));
        majBouton();
        var m = location.search.match(/[?&]id=(\d+)/);
        if (m && E && E.ouvrir) {
          appel('get', { id: parseInt(m[1], 10) }).then(function (res) {
            var doc = res.diagramme.contenu;
            doc.serveurId = res.diagramme.id;
            E.ouvrir(doc);
            E.toast('Diagramme « ' + res.diagramme.titre + ' » ouvert.');
          }).catch(function (e) { E.toast(e.message); });
        }
      }).catch(function () {
        localStorage.removeItem('ms_token');
        localStorage.removeItem('ms_user');
      })
    : Promise.resolve();

  window.Compte = {
    pret: pret,
    connecte: function () { return !!user; },
    // Ouvre la connexion avec un message ; « suite » est relancée après connexion
    demander: function (suite, info) { apres = suite; vueConnexion('login', null, info || 'Pour enregistrer votre projet, connectez-vous ou créez un compte gratuit. Votre travail en cours est conservé.'); },
    sauver: async function (doc) {
      var r = await appel('save', { id: doc.serveurId, titre: doc.titre, type: doc.type, contenu: doc });
      doc.serveurId = r.id;
    }
  };
})();
