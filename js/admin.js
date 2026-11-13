/* Merise Studio — Script de l'Espace Administrateur */
(function () {
  'use strict';

  var user = null;
  var ongletActuel = 'stats';
  var donneesStats = null;
  var donneesUsers = [];
  var donneesDiagrammes = [];
  var donneesMessages = [];
  var donneesJournal = [];

  var $ = function (s) { return document.querySelector(s); };
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg, ms) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('visible');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('visible'); }, ms || 3000);
  }

  async function appel(action, corps) {
    var r = await fetch('api/index.php?action=' + action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Token': localStorage.getItem('ms_token') || ''
      },
      body: JSON.stringify(corps || {})
    });
    var j = await r.json().catch(function () {
      return { erreur: 'Serveur indisponible ou base de données non configurée' };
    });
    if (r.status === 401 && action !== 'login') {
      localStorage.removeItem('ms_token');
      localStorage.removeItem('ms_user');
      user = null;
      vueLogin('Votre session a expiré. Veuillez vous reconnecter.');
      throw new Error(j.erreur || 'Session expirée');
    }
    if (!r.ok) throw new Error(j.erreur || 'Erreur requête (' + r.status + ')');
    return j;
  }

  // --- Mode maintenance : bouton de l'en-tête + carte « Mon compte » ---
  var maintenanceActif = null; // null = état inconnu (chargement ou erreur)

  function majBoutonsMaintenance(message) {
    var haut = $('#bMaintenanceHaut');
    var carte = $('#bMaintenance');
    var tableau = $('#bMaintenanceDashboard');
    var etat = $('#maintenanceEtat');
    var etatTableau = $('#maintenanceDashboardEtat');
    if (haut) {
      haut.textContent = maintenanceActif ? '🛠️ Maintenance : ACTIVE' : '🛠️ Maintenance';
      haut.classList.toggle('maintenance-on', maintenanceActif === true);
      haut.title = maintenanceActif === null ? 'État inconnu : cliquer pour réessayer'
        : (maintenanceActif ? 'Le site est en maintenance : cliquer pour le rouvrir' : 'Mettre le site en maintenance');
    }
    if (carte) {
      carte.textContent = maintenanceActif === null ? 'Réessayer'
        : (maintenanceActif ? 'Désactiver la maintenance' : 'Activer la maintenance');
      carte.disabled = false;
      carte.setAttribute('aria-pressed', maintenanceActif ? 'true' : 'false');
    }
    if (tableau) {
      tableau.textContent = maintenanceActif === null ? 'Réessayer'
        : (maintenanceActif ? 'Désactiver la maintenance' : 'Activer la maintenance');
      tableau.disabled = false;
      tableau.setAttribute('aria-pressed', maintenanceActif ? 'true' : 'false');
    }
    if (etat) {
      etat.textContent = message || (maintenanceActif === null ? 'État du site inconnu.'
        : (maintenanceActif ? 'La maintenance est activée.' : 'La maintenance est désactivée.'));
    }
    if (etatTableau) {
      etatTableau.textContent = message || (maintenanceActif === null ? 'État du site inconnu.'
        : (maintenanceActif ? 'La maintenance est activée.' : 'La maintenance est désactivée.'));
    }
  }

  async function chargerMaintenance() {
    try {
      var etat = await appel('maintenance_status');
      maintenanceActif = !!etat.actif;
      majBoutonsMaintenance();
    } catch (err) {
      maintenanceActif = null;
      majBoutonsMaintenance('Impossible de charger l’état : ' + err.message);
    }
  }

  async function basculerMaintenance() {
    if (maintenanceActif === null) { await chargerMaintenance(); return; }
    var prochainEtat = !maintenanceActif;
    if (!confirm(prochainEtat
      ? 'Activer la maintenance ? Les visiteurs ne pourront plus utiliser le site.'
      : 'Désactiver la maintenance et rouvrir le site aux visiteurs ?')) return;
    var boutons = [$('#bMaintenanceHaut'), $('#bMaintenance'), $('#bMaintenanceDashboard')];
    boutons.forEach(function (b) { if (b) b.disabled = true; });
    try {
      var resultat = await appel('maintenance_set', { actif: prochainEtat });
      maintenanceActif = !!resultat.actif;
      majBoutonsMaintenance();
      toast(maintenanceActif ? 'Mode maintenance activé.' : 'Mode maintenance désactivé.');
    } catch (err) {
      majBoutonsMaintenance('Impossible de modifier l’état : ' + err.message);
      toast('Maintenance non modifiée : ' + err.message, 5000);
    }
    boutons.forEach(function (b) { if (b) b.disabled = false; });
  }

  // --- Gestion du Thème ---
  function initTheme() {
    var sombre = localStorage.getItem('ms_theme') === 'sombre';
    document.documentElement.classList.toggle('sombre', sombre);
    var b = $('#bTheme');
    if (b) {
      b.textContent = sombre ? '☀️ Clair' : '🌙 Sombre';
      b.onclick = function () {
        var s = !document.documentElement.classList.contains('sombre');
        document.documentElement.classList.toggle('sombre', s);
        localStorage.setItem('ms_theme', s ? 'sombre' : 'clair');
        b.textContent = s ? '☀️ Clair' : '🌙 Sombre';
      };
    }
  }

  // --- Modal générique ---
  function ouvrirDlg(html) {
    var d = $('#dlgAdmin');
    d.innerHTML = html;
    d.showModal();
    return d;
  }
  function fermerDlg() {
    var d = $('#dlgAdmin');
    if (d && d.open) d.close();
  }

  // --- Vue Connexion Administrateur ---
  function vueLogin(erreur) {
    var alerteFile = '';
    if (window.location.protocol === 'file:') {
      alerteFile = '<div style="background:#fff3cd;color:#856404;border:1px solid #ffeeba;padding:.8rem;border-radius:10px;margin-bottom:1rem;font-size:.9rem;line-height:1.4;">' +
        '⚠️ <b>Attention :</b> Vous ouvrez la page en fichier local (<code>file://</code>). PHP et MySQL ne s\'exécutent qu\'à travers un serveur Web WAMP.<br>' +
        '👉 <a href="http://localhost/merise-studio/admin.html" style="font-weight:bold;color:#533f03;">Cliquez ici pour ouvrir via WAMP : http://localhost/merise-studio/admin.html</a>' +
      '</div>';
    }

    $('#adminApp').innerHTML =
      '<div class="auth-box">' +
        '<h1>Espace Administrateur</h1>' +
        '<p class="intro">Accès réservé à la gestion de Merise Studio.</p>' +
        alerteFile +
        (erreur ? '<p class="erreur" style="background:#fde8e8;padding:.6rem .8rem;border-radius:8px;">' + esc(erreur) + '</p>' : '') +
        '<form id="fLoginAdmin">' +
          '<label>Identifiant ou E-mail' +
            '<input name="identifiant" required autocomplete="username" placeholder="Identifiant ou e-mail">' +
          '</label>' +
          '<label>Mot de passe' +
            '<input name="mot_de_passe" type="password" required autocomplete="current-password" placeholder="Mot de passe">' +
          '</label>' +
          '<button class="primaire" type="submit" style="margin-top:.4rem;padding:.7rem;">Se connecter à l\'espace admin</button>' +
        '</form>' +
        '<p style="text-align:center;"><button type="button" id="bMdpOublieAdmin">Mot de passe oublié ?</button></p>' +
        '<p style="text-align:center;margin-top:1.5rem;"><a href="index.html" class="btn" style="text-decoration:none;">← Retour au site public</a> <a href="editeur.html" class="btn primaire" style="text-decoration:none;">Ouvrir l\'Éditeur</a></p>' +
      '</div>';

    $('#bMdpOublieAdmin').onclick = function () { vueResetAdmin(); };
    $('#fLoginAdmin').onsubmit = async function (e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(e.target));
      try {
        var r = await appel('login', data);
        if (r.utilisateur.role !== 'admin') {
          throw new Error('Ce compte n\'a pas les privilèges administrateur.');
        }
        localStorage.setItem('ms_token', r.jeton);
        localStorage.setItem('ms_user', JSON.stringify(r.utilisateur));
        user = r.utilisateur;
        initInterface();
        toast('Bienvenue dans l\'espace administrateur.');
      } catch (err) {
        vueLogin(err.message);
      }
    };
  }

  function vueResetAdmin(mode, email, erreur, info) {
    mode = mode || 'request';
    email = email || '';
    var demande = mode === 'request';
    $('#adminApp').innerHTML =
      '<div class="auth-box">' +
        '<h1>' + (demande ? 'Mot de passe oublié' : 'Réinitialiser le mot de passe') + '</h1>' +
        (info ? '<p class="intro">' + esc(info) + '</p>' : '') +
        (demande ? '<p class="intro">Utilisez l’adresse e-mail associée au compte administrateur, pas son identifiant de connexion. Si aucun code n’arrive, vérifiez les courriers indésirables et ajoutez une adresse MAIL_FROM_ADDRESS valide dans api/config.local.php.</p>' : '') +
        (erreur ? '<p class="erreur" style="background:#fde8e8;padding:.6rem .8rem;border-radius:8px;">' + esc(erreur) + '</p>' : '') +
        '<form id="fResetAdmin">' +
          '<label>Adresse e-mail du compte' +
            '<input name="email" type="email" required autocomplete="email" value="' + esc(email) + '">' +
          '</label>' +
          (demande ? '' :
            '<label>Code à 6 chiffres' +
              '<input name="code" inputmode="numeric" pattern="[0-9]{6}" minlength="6" maxlength="6" required autocomplete="one-time-code">' +
            '</label>' +
            '<label>Nouveau mot de passe (12 caractères min.)' +
              '<input name="nouveau" type="password" minlength="12" maxlength="72" required autocomplete="new-password">' +
            '</label>') +
          '<button class="primaire" type="submit">' + (demande ? 'Envoyer un code' : 'Réinitialiser le mot de passe') + '</button>' +
        '</form>' +
        '<p style="text-align:center;"><button type="button" id="bRetourLoginAdmin">Retour à la connexion</button></p>' +
      '</div>';
    $('#bRetourLoginAdmin').onclick = function () { vueLogin(); };
    $('#fResetAdmin').onsubmit = async function (e) {
      e.preventDefault();
      var data = Object.fromEntries(new FormData(e.target));
      try {
        if (demande) {
          var r = await appel('password_reset_request', data);
          vueResetAdmin('confirm', data.email, null, r.message);
        } else {
          await appel('password_reset_confirm', data);
          vueLogin('Mot de passe réinitialisé. Vous pouvez vous connecter.');
        }
      } catch (err) {
        vueResetAdmin(mode, email || data.email, err.message, info);
      }
    };
  }

  // --- Initialisation de l'interface admin ---
  async function initInterface() {
    var c = $('#adminApp');
    c.innerHTML =
      '<header class="admin-header">' +
        '<div class="admin-titre-groupe">' +
          '<a class="marque-app" href="index.html" style="color:#fff;text-decoration:none;font-size:1.15rem;font-weight:700;"><span class="logo" style="display:inline-block;vertical-align:middle;margin-right:.4rem;"></span>Merise Studio</a>' +
          '<span class="admin-badge-role">Administration</span>' +
        '</div>' +
        '<div class="admin-actions-haut">' +
          '<span class="admin-user-info" title="Connecté en tant qu\'administrateur">👤 ' + esc(user.nom) + '</span>' +
          '<button type="button" id="bMaintenanceHaut" class="btn-maintenance-haut" title="Activer ou désactiver le mode maintenance">🔧 Maintenance</button>' +
          '<button type="button" id="bMdpRapide" title="Changer le mot de passe administrateur">🔑 Mot de passe</button>' +
          '<a href="editeur.html" class="btn" style="background:#fff;color:var(--vert2);">🎨 Éditeur</a>' +
          '<a href="index.html" class="btn" style="background:#fff;color:var(--vert2);">🌐 Site</a>' +
          '<button type="button" id="bTheme">Thème</button>' +
          '<button type="button" id="bLogout" class="danger" style="background:#fff1e0;color:var(--orange2);">Déconnexion</button>' +
        '</div>' +
      '</header>' +
      '<main class="admin-conteneur">' +
        '<nav class="admin-onglets" role="tablist">' +
          '<button class="admin-onglet-btn actif" data-tab="stats">📊 Vue d\'ensemble</button>' +
          '<button class="admin-onglet-btn admin-onglet-maintenance" data-tab="maintenance">🔧 Maintenance</button>' +
          '<button class="admin-onglet-btn" data-tab="users">👥 Utilisateurs <span class="pillule" id="badgeNbUsers">0</span></button>' +
          '<button class="admin-onglet-btn" data-tab="diagrammes">📐 Diagrammes <span class="pillule" id="badgeNbDiags">0</span></button>' +
          '<button class="admin-onglet-btn" data-tab="messages">✉️ Messages <span class="pillule" id="badgeNbMsgs">0</span></button>' +
          '<button class="admin-onglet-btn" data-tab="journal">📜 Journal d\'activité</button>' +
          '<button class="admin-onglet-btn" data-tab="moncompte">🔐 Mon compte</button>' +
        '</nav>' +
        '<div id="contenuOnglet"></div>' +
      '</main>';

    initTheme();

    $('#bLogout').onclick = async function () {
      try { await appel('logout'); } catch (e) {}
      localStorage.removeItem('ms_token');
      localStorage.removeItem('ms_user');
      user = null;
      vueLogin();
      toast('Déconnecté.');
    };

    $('#bMdpRapide').onclick = vueChangerMonMdp;
    $('#bMaintenanceHaut').onclick = basculerMaintenance;
    chargerMaintenance();
    // Gestion du clic sur les onglets
    var onglets = document.querySelectorAll('.admin-onglet-btn');
    onglets.forEach(function (btn) {
      btn.onclick = function () {
        onglets.forEach(function (b) { b.classList.remove('actif'); });
        btn.classList.add('actif');
        ongletActuel = btn.getAttribute('data-tab');
        chargerOnglet(ongletActuel);
      };
    });

    chargerOnglet('stats');
  }

  // --- Chargement selon l'onglet ---
  function animerOnglet(zone) {
    zone.classList.remove('ms-onglet-visible');
    window.requestAnimationFrame(function () {
      if (document.getElementById('contenuOnglet') === zone) zone.classList.add('ms-onglet-visible');
    });
  }

  async function chargerOnglet(nom) {
    var zone = $('#contenuOnglet');
    zone.classList.remove('ms-onglet-visible');
    zone.innerHTML = '<p class="aide">Chargement des données en cours…</p>';

    try {
      if (nom === 'stats') await afficherStats(zone);
      else if (nom === 'users') await afficherUsers(zone);
      else if (nom === 'diagrammes') await afficherDiagrammes(zone);
      else if (nom === 'messages') await afficherMessages(zone);
      else if (nom === 'journal') await afficherJournal(zone);
      else if (nom === 'moncompte') await afficherMonCompte(zone);
      else if (nom === 'maintenance') await afficherOngletMaintenance(zone);
      animerOnglet(zone);
    } catch (err) {
      zone.innerHTML = '<p class="erreur">Erreur : ' + esc(err.message) + '</p>';
      animerOnglet(zone);
    }
  }

  // ==========================================
  // ONGLET 1 : STATISTIQUES & VUE D'ENSEMBLE
  // ==========================================
  async function afficherStats(zone) {
    var rep = await appel('admin_stats');
    var s = rep.stats;
    donneesStats = s;

    // Mettre à jour les badges
    if ($('#badgeNbUsers')) $('#badgeNbUsers').textContent = s.utilisateurs_total;
    if ($('#badgeNbDiags')) $('#badgeNbDiags').textContent = s.diagrammes_total;
    if ($('#badgeNbMsgs')) $('#badgeNbMsgs').textContent = s.messages_non_lus > 0 ? (s.messages_non_lus + ' non lu' + (s.messages_non_lus > 1 ? 's' : '')) : s.messages_total;

    var typesHtml = Object.entries(s.diagrammes_par_type || {}).map(function (e) {
      return '<span class="badge badge-type" style="margin-right:.3rem;">' + esc(e[0]) + ': ' + e[1] + '</span>';
    }).join('') || '<span class="aide">Aucun diagramme</span>';

    var journalHtml = (s.journal_recent || []).slice(0, 8).map(function (j) {
      return '<div class="journal-item">' +
        '<div><span class="journal-action">' + esc(j.action) + '</span> ' + (j.nom ? 'par <b>' + esc(j.nom) + '</b>' : '') +
        (j.details ? ' <span class="journal-details">(' + esc(j.details) + ')</span>' : '') + '</div>' +
        '<span class="journal-date">' + esc(j.cree_le) + '</span>' +
      '</div>';
    }).join('') || '<p class="aide">Aucune activité récente.</p>';

    zone.innerHTML =
      '<div class="stats-grille">' +
        '<div class="stat-carte">' +
          '<div class="stat-entete"><span>UTILISATEURS</span><span>👥</span></div>' +
          '<div class="stat-valeur">' + s.utilisateurs_total + '</div>' +
          '<div class="stat-details">' + s.utilisateurs_actifs + ' actif' + (s.utilisateurs_actifs > 1 ? 's' : '') + ' · ' + s.utilisateurs_admins + ' admin' + (s.utilisateurs_admins > 1 ? 's' : '') + '</div>' +
        '</div>' +
        '<div class="stat-carte">' +
          '<div class="stat-entete"><span>DIAGRAMMES ACTIFS</span><span>📐</span></div>' +
          '<div class="stat-valeur">' + s.diagrammes_total + '</div>' +
          '<div class="stat-details">' + typesHtml + (s.diagrammes_corbeille > 0 ? ' · ' + s.diagrammes_corbeille + ' en corbeille' : '') + '</div>' +
        '</div>' +
        '<div class="stat-carte">' +
          '<div class="stat-entete"><span>MESSAGES CONTACT</span><span>✉️</span></div>' +
          '<div class="stat-valeur">' + s.messages_total + '</div>' +
          '<div class="stat-details">' + (s.messages_non_lus > 0 ? '<b style="color:var(--orange2);">' + s.messages_non_lus + ' non lu' + (s.messages_non_lus > 1 ? 's' : '') + '</b>' : 'Tous les messages sont lus') + '</div>' +
        '</div>' +
        '<div class="stat-carte">' +
          '<div class="stat-entete"><span>ESPACE ADMINISTRATEUR</span><span>🔐</span></div>' +
          '<div class="stat-valeur" style="font-size:1.4rem;padding-top:.4rem;">' + esc(user.nom) + '</div>' +
          '<div class="stat-details"><button type="button" class="btn-mini primaire" id="bModifMdpRapide">Modifier mot de passe</button></div>' +
        '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1.5rem;">' +
      '<div class="carte maintenance-dashboard">' +
        '<div><h2>🔧 Maintenance du site</h2>' +
          '<p id="maintenanceDashboardEtat" class="aide">Chargement de l’état du site…</p>' +
          '<p class="aide">L’espace administrateur reste accessible pendant la maintenance.</p></div>' +
        '<button type="button" id="bMaintenanceDashboard" class="primaire">Chargement…</button>' +
      '</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1.5rem;">' +
      '<div class="carte">' +
        '<h2>⚡ Actions Rapides</h2>' +
          '<div style="display:flex;flex-direction:column;gap:.6rem;margin-top:.8rem;">' +
            '<button type="button" id="bAjoutUserRapide" class="primaire" style="text-align:left;">➕ Ajouter un nouvel utilisateur</button>' +
            '<button type="button" id="bVoirMessagesRapide" style="text-align:left;">✉️ Consulter les messages de contact (' + s.messages_non_lus + ' non lus)</button>' +
            '<a href="editeur.html" class="btn" style="text-decoration:none;display:block;text-align:left;">🎨 Ouvrir l\'éditeur Merise Studio</a>' +
            '<button type="button" id="bChangerMdpMenu" style="text-align:left;">🔑 Changer le mot de passe administrateur</button>' +
          '</div>' +
        '</div>' +
        '<div class="carte">' +
          '<h2>🕒 Activité Récente</h2>' +
          '<div class="journal-liste" style="margin-top:.8rem;">' + journalHtml + '</div>' +
        '</div>' +
      '</div>';

    var bModif = $('#bModifMdpRapide');
    if (bModif) bModif.onclick = vueChangerMonMdp;
    var bChg = $('#bChangerMdpMenu');
    if (bChg) bChg.onclick = vueChangerMonMdp;
    var bAjout = $('#bAjoutUserRapide');
    if (bAjout) bAjout.onclick = vueAjouterUser;
    var bMsg = $('#bVoirMessagesRapide');
    if (bMsg) bMsg.onclick = function () {
      document.querySelector('[data-tab="messages"]').click();
    };
    var bMaintenance = $('#bMaintenanceDashboard');
    if (bMaintenance) bMaintenance.onclick = basculerMaintenance;
    majBoutonsMaintenance();
  }

  // ==========================================
  // ONGLET 2 : GESTION DES UTILISATEURS
  // ==========================================
  async function afficherUsers(zone) {
    var rep = await appel('users');
    donneesUsers = rep.utilisateurs || [];

    zone.innerHTML =
      '<div class="barre-outils-admin">' +
        '<div class="filtres-groupe">' +
          '<input type="search" id="rechercheUser" placeholder="Rechercher par nom ou e-mail…">' +
          '<select id="filtreRole">' +
            '<option value="">Tous les rôles</option>' +
            '<option value="admin">Administrateurs</option>' +
            '<option value="utilisateur">Utilisateurs</option>' +
          '</select>' +
          '<select id="filtreStatut">' +
            '<option value="">Tous les statuts</option>' +
            '<option value="1">Actifs</option>' +
            '<option value="0">Désactivés</option>' +
          '</select>' +
        '</div>' +
        '<button type="button" class="primaire" id="bAjouterUser">➕ Nouvel utilisateur</button>' +
      '</div>' +
      '<div class="table-responsive">' +
        '<table class="table-admin">' +
          '<thead>' +
            '<tr>' +
              '<th>ID</th>' +
              '<th>Nom / Identifiant</th>' +
              '<th>E-mail</th>' +
              '<th>Rôle</th>' +
              '<th>Statut</th>' +
              '<th>Diagrammes</th>' +
              '<th>Dernière connexion</th>' +
              '<th style="text-align:right;">Actions</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody id="corpsTableUsers"></tbody>' +
        '</table>' +
      '</div>';

    $('#bAjouterUser').onclick = vueAjouterUser;

    function filtrerUsers() {
      var q = ($('#rechercheUser').value || '').toLowerCase().trim();
      var r = $('#filtreRole').value;
      var s = $('#filtreStatut').value;

      var liste = donneesUsers.filter(function (u) {
        if (q && u.nom.toLowerCase().indexOf(q) === -1 && u.email.toLowerCase().indexOf(q) === -1) return false;
        if (r && u.role !== r) return false;
        if (s !== '' && String(u.actif) !== s) return false;
        return true;
      });

      var tb = $('#corpsTableUsers');
      if (!liste.length) {
        tb.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:1.5rem;" class="aide">Aucun utilisateur trouvé.</td></tr>';
        return;
      }

      tb.innerHTML = liste.map(function (u) {
        var moi = u.id === user.id;
        var roleBadge = u.role === 'admin'
          ? '<span class="badge badge-admin">Admin</span>'
          : '<span class="badge badge-user">Utilisateur</span>';
        var statutBadge = u.actif
          ? '<span class="badge badge-actif">Actif</span>'
          : '<span class="badge badge-inactif">Désactivé</span>';

        return '<tr>' +
          '<td>' + u.id + '</td>' +
          '<td><b>' + esc(u.nom) + '</b>' + (moi ? ' <small style="color:var(--vert2);font-weight:bold;">(Vous)</small>' : '') + '</td>' +
          '<td>' + esc(u.email) + '</td>' +
          '<td>' + roleBadge + '</td>' +
          '<td>' + statutBadge + '</td>' +
          '<td>' + (u.nb_diagrammes || 0) + '</td>' +
          '<td>' + (u.derniere_connexion ? esc(u.derniere_connexion) : '<span class="aide">Jamais</span>') + '</td>' +
          '<td style="text-align:right;">' +
            '<div class="actions-cellule" style="justify-content:flex-end;">' +
              '<button type="button" class="btn-mini" data-action="edit" data-id="' + u.id + '">✏️ Modifier</button>' +
              (moi ? '' :
                '<button type="button" class="btn-mini" data-action="toggle-actif" data-id="' + u.id + '" data-v="' + (u.actif ? 0 : 1) + '">' +
                  (u.actif ? 'Désactiver' : 'Activer') +
                '</button>' +
                '<button type="button" class="btn-mini danger" data-action="suppr" data-id="' + u.id + '">🗑️</button>'
              ) +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    $('#rechercheUser').oninput = filtrerUsers;
    $('#filtreRole').onchange = filtrerUsers;
    $('#filtreStatut').onchange = filtrerUsers;
    filtrerUsers();

    $('#corpsTableUsers').onclick = async function (e) {
      var btn = e.target.closest('button[data-action]');
      if (!btn) return;
      var act = btn.getAttribute('data-action');
      var id = parseInt(btn.getAttribute('data-id'), 10);
      var cible = donneesUsers.find(function (x) { return x.id === id; });

      if (act === 'edit') {
        vueModifierUser(cible);
      } else if (act === 'toggle-actif') {
        var nouvelEtat = parseInt(btn.getAttribute('data-v'), 10);
        try {
          await appel('user_actif', { id: id, actif: nouvelEtat });
          toast(nouvelEtat ? 'Utilisateur activé.' : 'Utilisateur désactivé.');
          afficherUsers(zone);
        } catch (x) { toast(x.message); }
      } else if (act === 'suppr') {
        if (confirm('Confirmez-vous la suppression définitive de l\'utilisateur « ' + cible.nom + ' » ainsi que tous ses diagrammes ?')) {
          try {
            await appel('user_suppr', { id: id });
            toast('Utilisateur supprimé.');
            afficherUsers(zone);
          } catch (x) { toast(x.message); }
        }
      }
    };
  }

  // Modal : Ajouter utilisateur
  function vueAjouterUser() {
    var d = ouvrirDlg(
      '<div class="dlg-admin">' +
        '<h2>➕ Ajouter un utilisateur</h2>' +
        '<form id="fAjoutUser">' +
          '<label>Nom ou identifiant' +
            '<input name="nom" required maxlength="100" placeholder="ex. jdupont">' +
          '</label>' +
          '<label>Adresse e-mail' +
            '<input name="email" type="email" required placeholder="ex. dupont@exemple.ci">' +
          '</label>' +
          '<label>Mot de passe (12 caractères min.)' +
            '<input name="mot_de_passe" type="password" required minlength="12" maxlength="72" placeholder="Mot de passe">' +
          '</label>' +
          '<label>Rôle' +
            '<select name="role">' +
              '<option value="utilisateur" selected>Utilisateur classique</option>' +
              '<option value="admin">Administrateur</option>' +
            '</select>' +
          '</label>' +
          '<div id="dlgErrUser" class="erreur" style="display:none;"></div>' +
          '<div class="dlg-admin-actions">' +
            '<button type="button" id="bAnnulDlg">Annuler</button>' +
            '<button type="submit" class="primaire">Créer l\'utilisateur</button>' +
          '</div>' +
        '</form>' +
      '</div>'
    );

    $('#bAnnulDlg').onclick = fermerDlg;
    $('#fAjoutUser').onsubmit = async function (e) {
      e.preventDefault();
      var errEl = $('#dlgErrUser');
      errEl.style.display = 'none';
      var f = Object.fromEntries(new FormData(e.target));
      try {
        await appel('user_ajouter', f);
        toast('Utilisateur créé avec succès.');
        fermerDlg();
        chargerOnglet('users');
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    };
  }

  // Modal : Modifier utilisateur
  function vueModifierUser(cible) {
    if (!cible) return;
    var moi = cible.id === user.id;

    var d = ouvrirDlg(
      '<div class="dlg-admin">' +
        '<h2>✏️ Modifier l\'utilisateur #' + cible.id + '</h2>' +
        '<form id="fModifUser">' +
          '<input type="hidden" name="id" value="' + cible.id + '">' +
          '<label>Nom ou identifiant' +
            '<input name="nom" required maxlength="100" value="' + esc(cible.nom) + '">' +
          '</label>' +
          '<label>Adresse e-mail' +
            '<input name="email" type="email" required value="' + esc(cible.email) + '">' +
          '</label>' +
          '<label>Nouveau mot de passe (laisser vide pour ne pas changer)' +
            '<input name="mot_de_passe" type="password" minlength="12" maxlength="72" placeholder="Nouveau mot de passe (optionnel)">' +
          '</label>' +
          '<label>Rôle' +
            '<select name="role"' + (moi ? ' disabled title="Impossible de modifier votre propre rôle"' : '') + '>' +
              '<option value="utilisateur"' + (cible.role === 'utilisateur' ? ' selected' : '') + '>Utilisateur classique</option>' +
              '<option value="admin"' + (cible.role === 'admin' ? ' selected' : '') + '>Administrateur</option>' +
            '</select>' +
          '</label>' +
          '<div id="dlgErrUser" class="erreur" style="display:none;"></div>' +
          '<div class="dlg-admin-actions">' +
            '<button type="button" id="bAnnulDlg">Annuler</button>' +
            '<button type="submit" class="primaire">Enregistrer les modifications</button>' +
          '</div>' +
        '</form>' +
      '</div>'
    );

    $('#bAnnulDlg').onclick = fermerDlg;
    $('#fModifUser').onsubmit = async function (e) {
      e.preventDefault();
      var errEl = $('#dlgErrUser');
      errEl.style.display = 'none';
      var f = Object.fromEntries(new FormData(e.target));
      if (moi) f.role = 'admin'; // Conserver le rôle
      try {
        await appel('user_modifier', f);
        toast('Utilisateur mis à jour.');
        if (moi) {
          user.nom = f.nom;
          user.email = f.email;
          localStorage.setItem('ms_user', JSON.stringify(user));
          var elNom = document.querySelector('.admin-user-info');
          if (elNom) elNom.textContent = '👤 ' + user.nom;
        }
        fermerDlg();
        chargerOnglet('users');
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    };
  }

  // ==========================================
  // ONGLET 3 : GESTION DES DIAGRAMMES
  // ==========================================
  async function afficherDiagrammes(zone) {
    var rep = await appel('admin_diagrammes');
    donneesDiagrammes = rep.diagrammes || [];

    zone.innerHTML =
      '<div class="barre-outils-admin">' +
        '<div class="filtres-groupe">' +
          '<input type="search" id="rechercheDiag" placeholder="Rechercher par titre ou auteur…">' +
          '<select id="filtreTypeDiag">' +
            '<option value="">Tous les types</option>' +
            '<option value="MCD">MCD</option>' +
            '<option value="MLD">MLD</option>' +
            '<option value="MCC">MCC</option>' +
            '<option value="MCT">MCT</option>' +
            '<option value="MOT">MOT</option>' +
            '<option value="LIBRE">Dessin libre</option>' +
          '</select>' +
          '<select id="filtreEtatDiag">' +
            '<option value="">Tous les états</option>' +
            '<option value="actif">En ligne</option>' +
            '<option value="corbeille">Dans la corbeille</option>' +
          '</select>' +
        '</div>' +
        '<a href="editeur.html" class="btn primaire" style="text-decoration:none;">🎨 Créer un diagramme</a>' +
      '</div>' +
      '<div class="table-responsive">' +
        '<table class="table-admin">' +
          '<thead>' +
            '<tr>' +
              '<th>ID</th>' +
              '<th>Titre</th>' +
              '<th>Type</th>' +
              '<th>Auteur</th>' +
              '<th>Dernière modification</th>' +
              '<th>Statut</th>' +
              '<th style="text-align:right;">Actions</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody id="corpsTableDiags"></tbody>' +
        '</table>' +
      '</div>';

    function filtrerDiags() {
      var q = ($('#rechercheDiag').value || '').toLowerCase().trim();
      var t = $('#filtreTypeDiag').value;
      var e = $('#filtreEtatDiag').value;

      var liste = donneesDiagrammes.filter(function (d) {
        if (q) {
          var matchTitre = d.titre.toLowerCase().indexOf(q) !== -1;
          var matchAuteur = (d.auteur_nom || '').toLowerCase().indexOf(q) !== -1 || (d.auteur_email || '').toLowerCase().indexOf(q) !== -1;
          if (!matchTitre && !matchAuteur) return false;
        }
        if (t && d.type !== t) return false;
        if (e === 'actif' && d.supprime_le) return false;
        if (e === 'corbeille' && !d.supprime_le) return false;
        return true;
      });

      var tb = $('#corpsTableDiags');
      if (!liste.length) {
        tb.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:1.5rem;" class="aide">Aucun diagramme trouvé.</td></tr>';
        return;
      }

      tb.innerHTML = liste.map(function (d) {
        var corb = !!d.supprime_le;
        return '<tr>' +
          '<td>' + d.id + '</td>' +
          '<td><b>' + esc(d.titre) + '</b></td>' +
          '<td><span class="badge badge-type">' + esc(d.type) + '</span></td>' +
          '<td>' + esc(d.auteur_nom) + ' <small class="aide">(' + esc(d.auteur_email) + ')</small></td>' +
          '<td>' + esc(d.modifie_le) + '</td>' +
          '<td>' + (corb ? '<span class="badge badge-inactif">Corbeille</span>' : '<span class="badge badge-actif">En ligne</span>') + '</td>' +
          '<td style="text-align:right;">' +
            '<div class="actions-cellule" style="justify-content:flex-end;">' +
              '<a href="editeur.html?id=' + d.id + '" class="btn-mini" style="text-decoration:none;background:#eaf8ef;color:var(--vert2);">Ouvrir dans l\'éditeur</a>' +
              '<button type="button" class="btn-mini danger" data-action="suppr-diag" data-id="' + d.id + '" title="Supprimer définitivement">🗑️</button>' +
            '</div>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    $('#rechercheDiag').oninput = filtrerDiags;
    $('#filtreTypeDiag').onchange = filtrerDiags;
    $('#filtreEtatDiag').onchange = filtrerDiags;
    filtrerDiags();

    $('#corpsTableDiags').onclick = async function (e) {
      var btn = e.target.closest('button[data-action=suppr-diag]');
      if (!btn) return;
      var id = parseInt(btn.getAttribute('data-id'), 10);
      if (confirm('Voulez-vous supprimer définitivement ce diagramme de la base de données ?')) {
        try {
          await appel('admin_diag_suppr', { id: id });
          toast('Diagramme supprimé.');
          afficherDiagrammes(zone);
        } catch (x) { toast(x.message); }
      }
    };
  }

  // ==========================================
  // ONGLET 4 : MESSAGES DE CONTACT
  // ==========================================
  async function afficherMessages(zone) {
    var rep = await appel('messages');
    donneesMessages = rep.messages || [];

    zone.innerHTML =
      '<div class="barre-outils-admin">' +
        '<div class="filtres-groupe">' +
          '<input type="search" id="rechercheMsg" placeholder="Rechercher dans les messages…">' +
          '<select id="filtreMsgLu">' +
            '<option value="">Tous les messages</option>' +
            '<option value="0">Non lus uniquement</option>' +
            '<option value="1">Lus uniquement</option>' +
          '</select>' +
        '</div>' +
        '<span class="aide">' + donneesMessages.length + ' message' + (donneesMessages.length > 1 ? 's' : '') + '</span>' +
      '</div>' +
      '<div id="listeMessagesConteneur"></div>';

    function filtrerMessages() {
      var q = ($('#rechercheMsg').value || '').toLowerCase().trim();
      var fLu = $('#filtreMsgLu').value;

      var liste = donneesMessages.filter(function (m) {
        if (q) {
          var match = m.sujet.toLowerCase().indexOf(q) !== -1 ||
                      m.nom.toLowerCase().indexOf(q) !== -1 ||
                      m.email.toLowerCase().indexOf(q) !== -1 ||
                      m.message.toLowerCase().indexOf(q) !== -1;
          if (!match) return false;
        }
        if (fLu !== '' && String(m.lu) !== fLu) return false;
        return true;
      });

      var cont = $('#listeMessagesConteneur');
      if (!liste.length) {
        cont.innerHTML = '<div class="carte" style="text-align:center;padding:2rem;"><p class="aide">Aucun message de contact ne correspond aux critères.</p></div>';
        return;
      }

      cont.innerHTML = liste.map(function (m) {
        var nonLu = m.lu == 0;
        return '<article class="message-carte' + (nonLu ? ' non-lu' : '') + '">' +
          '<div class="message-entete">' +
            '<div>' +
              (nonLu ? '<span class="badge badge-nonlu" style="margin-right:.4rem;">Nouveau</span>' : '') +
              '<span class="message-expediteur">' + esc(m.nom) + '</span>' +
              '<a class="message-email" href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a>' +
            '</div>' +
            '<span class="message-date">' + esc(m.cree_le) + '</span>' +
          '</div>' +
          '<div class="message-sujet">' + esc(m.sujet) + '</div>' +
          '<div class="message-corps">' + esc(m.message) + '</div>' +
          '<div class="message-actions">' +
            '<a href="mailto:' + esc(m.email) + '?subject=Re: ' + encodeURIComponent(m.sujet) + '" class="btn-mini primaire" style="text-decoration:none;">✉️ Répondre</a>' +
            '<button type="button" class="btn-mini" data-action="toggle-lu" data-id="' + m.id + '" data-lu="' + (nonLu ? 1 : 0) + '">' +
              (nonLu ? 'Marquer comme lu' : 'Marquer comme non lu') +
            '</button>' +
            '<button type="button" class="btn-mini danger" data-action="suppr-msg" data-id="' + m.id + '">Supprimer</button>' +
          '</div>' +
        '</article>';
      }).join('');
    }

    $('#rechercheMsg').oninput = filtrerMessages;
    $('#filtreMsgLu').onchange = filtrerMessages;
    filtrerMessages();

    $('#listeMessagesConteneur').onclick = async function (e) {
      var btn = e.target.closest('button[data-action]');
      if (!btn) return;
      var act = btn.getAttribute('data-action');
      var id = parseInt(btn.getAttribute('data-id'), 10);

      if (act === 'toggle-lu') {
        var nouvelEtat = parseInt(btn.getAttribute('data-lu'), 10);
        try {
          await appel('message_lu', { id: id, lu: nouvelEtat });
          afficherMessages(zone);
        } catch (x) { toast(x.message); }
      } else if (act === 'suppr-msg') {
        if (confirm('Supprimer ce message de contact ?')) {
          try {
            await appel('message_suppr', { id: id });
            toast('Message supprimé.');
            afficherMessages(zone);
          } catch (x) { toast(x.message); }
        }
      }
    };
  }

  // ==========================================
  // ONGLET 5 : JOURNAL D'AUDIT
  // ==========================================
  async function afficherJournal(zone) {
    var rep = await appel('admin_journal');
    donneesJournal = rep.journal || [];

    zone.innerHTML =
      '<div class="barre-outils-admin">' +
        '<input type="search" id="rechercheJournal" placeholder="Filtrer les actions du journal…">' +
        '<span class="aide">Dernières 100 actions enregistrées</span>' +
      '</div>' +
      '<div class="table-responsive">' +
        '<table class="table-admin">' +
          '<thead>' +
            '<tr>' +
              '<th>ID</th>' +
              '<th>Date & Heure</th>' +
              '<th>Action</th>' +
              '<th>Utilisateur</th>' +
              '<th>Détails</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody id="corpsTableJournal"></tbody>' +
        '</table>' +
      '</div>';

    function filtrerJournal() {
      var q = ($('#rechercheJournal').value || '').toLowerCase().trim();
      var liste = donneesJournal.filter(function (j) {
        if (!q) return true;
        return (j.action || '').toLowerCase().indexOf(q) !== -1 ||
               (j.nom || '').toLowerCase().indexOf(q) !== -1 ||
               (j.email || '').toLowerCase().indexOf(q) !== -1 ||
               (j.details || '').toLowerCase().indexOf(q) !== -1;
      });

      var tb = $('#corpsTableJournal');
      if (!liste.length) {
        tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;" class="aide">Aucune entrée trouvée.</td></tr>';
        return;
      }

      tb.innerHTML = liste.map(function (j) {
        return '<tr>' +
          '<td>' + j.id + '</td>' +
          '<td><small>' + esc(j.cree_le) + '</small></td>' +
          '<td><span class="badge badge-user" style="font-family:monospace;">' + esc(j.action) + '</span></td>' +
          '<td>' + (j.nom ? '<b>' + esc(j.nom) + '</b> <small class="aide">(' + esc(j.email) + ')</small>' : '<span class="aide">Système / Anonyme</span>') + '</td>' +
          '<td><code style="font-size:.85rem;">' + esc(j.details || '—') + '</code></td>' +
        '</tr>';
      }).join('');
    }

    $('#rechercheJournal').oninput = filtrerJournal;
    filtrerJournal();
  }

  async function afficherOngletMaintenance(zone) {
    zone.innerHTML =
      '<div class="carte" style="max-width:680px">' +
        '<h2>🔧 Maintenance du site</h2>' +
        '<p id="maintenanceEtat" class="aide">Chargement de l’état du site…</p>' +
        '<p class="aide">En maintenance, les visiteurs ne peuvent plus utiliser le site. L’espace administrateur reste accessible.</p>' +
        '<button type="button" id="bMaintenance" class="primaire">Chargement…</button>' +
      '</div>';
    $('#bMaintenance').onclick = basculerMaintenance;
    majBoutonsMaintenance();
    if (maintenanceActif === null) await chargerMaintenance();
  }

  // ==========================================
  // ONGLET 6 : MON COMPTE & MOT DE PASSE
  // ==========================================
  async function afficherMonCompte(zone) {
    zone.innerHTML =
      '<div class="admin-profil-grille">' +
        '<div class="carte">' +
          '<h2>👤 Mon Profil Administrateur</h2>' +
          '<form id="fMonProfilAdmin">' +
            '<label>Nom de connexion (actuel : ' + esc(user.nom) + ')' +
              '<input name="nom" required maxlength="100" value="' + esc(user.nom) + '">' +
            '</label>' +
            '<label>Adresse e-mail' +
              '<input name="email" type="email" required value="' + esc(user.email) + '">' +
            '</label>' +
            '<p class="aide">Ce compte possède les droits complets d\'administration sur la plateforme.</p>' +
            '<button type="submit" class="primaire">Mettre à jour le profil</button>' +
          '</form>' +
        '</div>' +
        '<div class="carte">' +
          '<h2>🔑 Modifier mon Mot de Passe</h2>' +
          '<form id="fMonMdpAdmin">' +
            '<label>Mot de passe actuel' +
              '<input name="actuel" type="password" required placeholder="Mot de passe actuel">' +
            '</label>' +
            '<label>Nouveau mot de passe (12 caractères min.)' +
              '<input name="nouveau" type="password" required minlength="12" maxlength="72" placeholder="Nouveau mot de passe">' +
            '</label>' +
            '<label>Confirmer le nouveau mot de passe' +
              '<input name="confirme" type="password" required minlength="12" maxlength="72" placeholder="Confirmer le nouveau mot de passe">' +
            '</label>' +
            '<div id="errMdpProfil" class="erreur" style="display:none;margin-top:.4rem;"></div>' +
            '<button type="submit" class="primaire" style="margin-top:.5rem;">Changer mon mot de passe</button>' +
          '</form>' +
        '</div>' +
        '<div class="carte">' +
          '<h2>🛠️ Maintenance du site</h2>' +
          '<p id="maintenanceEtat" class="aide">Chargement de l’état du site…</p>' +
          '<p class="aide">En maintenance, les visiteurs ne peuvent plus utiliser le site. L’espace administrateur reste accessible.</p>' +
          '<button type="button" id="bMaintenance" class="danger" disabled>Chargement…</button>' +
        '</div>' +
      '</div>';

    $('#fMonProfilAdmin').onsubmit = async function (e) {
      e.preventDefault();
      var f = Object.fromEntries(new FormData(e.target));
      try {
        var r = await appel('profil', f);
        user = r.utilisateur;
        localStorage.setItem('ms_user', JSON.stringify(user));
        toast('Profil administrateur mis à jour.');
        var elNom = document.querySelector('.admin-user-info');
        if (elNom) elNom.textContent = '👤 ' + user.nom;
      } catch (err) { toast(err.message); }
    };

    $('#fMonMdpAdmin').onsubmit = async function (e) {
      e.preventDefault();
      var errEl = $('#errMdpProfil');
      errEl.style.display = 'none';
      var f = Object.fromEntries(new FormData(e.target));

      if (f.nouveau !== f.confirme) {
        errEl.textContent = 'La confirmation ne correspond pas au nouveau mot de passe.';
        errEl.style.display = 'block';
        return;
      }

      try {
        await appel('mot_de_passe', { actuel: f.actuel, nouveau: f.nouveau });
        toast('Votre mot de passe a été modifié avec succès !');
        e.target.reset();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    };

    $('#bMaintenance').onclick = basculerMaintenance;
    majBoutonsMaintenance();
    if (maintenanceActif === null) chargerMaintenance();
  }

  // Modal raccourci : Changer mon mot de passe
  function vueChangerMonMdp() {
    var d = ouvrirDlg(
      '<div class="dlg-admin">' +
        '<h2>🔑 Changer mon mot de passe administrateur</h2>' +
        '<form id="fMdpRapideDlg">' +
          '<label>Mot de passe actuel' +
            '<input name="actuel" type="password" required placeholder="Mot de passe actuel">' +
          '</label>' +
          '<label>Nouveau mot de passe (12 caractères min.)' +
            '<input name="nouveau" type="password" required minlength="12" maxlength="72" placeholder="Nouveau mot de passe">' +
          '</label>' +
          '<label>Confirmation' +
            '<input name="confirme" type="password" required minlength="12" maxlength="72" placeholder="Confirmez le nouveau mot de passe">' +
          '</label>' +
          '<div id="dlgErrMdp" class="erreur" style="display:none;"></div>' +
          '<div class="dlg-admin-actions">' +
            '<button type="button" id="bAnnulDlgMdp">Annuler</button>' +
            '<button type="submit" class="primaire">Enregistrer le nouveau mot de passe</button>' +
          '</div>' +
        '</form>' +
      '</div>'
    );

    $('#bAnnulDlgMdp').onclick = fermerDlg;
    $('#fMdpRapideDlg').onsubmit = async function (e) {
      e.preventDefault();
      var errEl = $('#dlgErrMdp');
      errEl.style.display = 'none';
      var f = Object.fromEntries(new FormData(e.target));
      if (f.nouveau !== f.confirme) {
        errEl.textContent = 'La confirmation ne correspond pas au nouveau mot de passe.';
        errEl.style.display = 'block';
        return;
      }
      try {
        await appel('mot_de_passe', { actuel: f.actuel, nouveau: f.nouveau });
        toast('Mot de passe mis à jour avec succès.');
        fermerDlg();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
    };
  }

  // --- Démarrage ---
  async function demarrer() {
    initTheme();
    var token = localStorage.getItem('ms_token');
    if (!token) {
      vueLogin();
      return;
    }

    try {
      var r = await appel('me');
      user = r.utilisateur;
      if (user.role !== 'admin') {
        vueLogin('Le compte actuellement connecté n\'est pas administrateur.');
        return;
      }
      initInterface();
    } catch (e) {
      vueLogin(e.message || 'Impossible de vérifier la session administrateur.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }

})();
