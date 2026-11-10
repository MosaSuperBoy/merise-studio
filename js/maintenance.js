/* Affiche un écran global quand l'administrateur active la maintenance. */
(function () {
  'use strict';

  fetch('api/index.php?action=maintenance_status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    cache: 'no-store'
  }).then(function (response) {
    return response.json().then(function (data) {
      if (!response.ok) throw new Error(data.erreur || 'État de maintenance indisponible');
      return data;
    });
  }).then(function (data) {
    if (!data.actif) return;
    var overlay = document.createElement('div');
    overlay.className = 'maintenance-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'maintenanceTitle');
    overlay.setAttribute('tabindex', '-1');
    overlay.innerHTML =
      '<div class="maintenance-card">' +
        '<p class="maintenance-label">Maintenance en cours</p>' +
        '<h1 id="maintenanceTitle">Le site est temporairement indisponible</h1>' +
        '<p>Nous effectuons une opération de maintenance. Merci de réessayer un peu plus tard.</p>' +
        '<a href="admin.html" class="btn primaire">Espace administrateur</a>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.focus();
  }).catch(function (error) {
    console.error('Impossible de vérifier le mode maintenance :', error);
  });
})();
