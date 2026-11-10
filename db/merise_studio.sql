-- ============================================================
-- Merise Studio : base de données MySQL (utilisateurs + diagrammes)
-- Import : mysql -u root -p < merise_studio.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS merise_studio
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE merise_studio;

-- ------------------------------------------------------------
-- Utilisateurs
-- Le mot de passe est stocké haché (PHP : password_hash()),
-- jamais en clair.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilisateurs (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom              VARCHAR(100)  NOT NULL,
  email            VARCHAR(190)  NOT NULL UNIQUE,
  mot_de_passe     VARCHAR(255)  NOT NULL,
  role             ENUM('admin','utilisateur') NOT NULL DEFAULT 'utilisateur',
  actif            TINYINT(1)    NOT NULL DEFAULT 1,
  cree_le          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  derniere_connexion DATETIME    NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Diagrammes (MCD, MLD, MCC, MCT, MOT, dessin libre)
-- "contenu" contient le JSON exporté par l'éditeur.
-- "supprime_le" : suppression douce (corbeille) → restauration possible.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diagrammes (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id  INT UNSIGNED NOT NULL,
  titre           VARCHAR(150) NOT NULL,
  type            ENUM('MCD','MLD','MCC','MCT','MOT','LIBRE') NOT NULL,
  contenu         LONGTEXT     NOT NULL,
  cree_le         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  supprime_le     DATETIME     NULL,
  CONSTRAINT fk_diag_user FOREIGN KEY (utilisateur_id)
    REFERENCES utilisateurs(id) ON DELETE CASCADE,
  INDEX idx_diag_user (utilisateur_id, supprime_le)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Jetons de session (connexion côté API PHP)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  jeton           CHAR(64) PRIMARY KEY,
  utilisateur_id  INT UNSIGNED NOT NULL,
  cree_le         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expire_le       DATETIME NOT NULL,
  CONSTRAINT fk_sess_user FOREIGN KEY (utilisateur_id)
    REFERENCES utilisateurs(id) ON DELETE CASCADE,
  INDEX idx_sess_expire (expire_le)
) ENGINE=InnoDB;

-- Codes de réinitialisation de mot de passe (hachés, temporaires et à usage unique)
CREATE TABLE IF NOT EXISTS password_reset_codes (
  utilisateur_id  INT UNSIGNED PRIMARY KEY,
  code_hash       VARCHAR(255) NOT NULL,
  tentatives      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expire_le       DATETIME NOT NULL,
  cree_le         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reset_user FOREIGN KEY (utilisateur_id)
    REFERENCES utilisateurs(id) ON DELETE CASCADE,
  INDEX idx_reset_expire (expire_le)
) ENGINE=InnoDB;

-- Paramètres globaux du site, dont le mode maintenance
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key   VARCHAR(64) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  modifie_le    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO site_settings(setting_key,setting_value) VALUES('maintenance','0');

-- Désactive les installations qui utilisent encore le mot de passe administrateur publié.
UPDATE utilisateurs
SET actif = 0
WHERE LOWER(nom) = 'root'
  AND LOWER(email) = 'root@merise.local'
  AND mot_de_passe = '$2y$12$39eevJ5B5Mdbg.cZT1zEaOvtR72aD..rHRdU4kbehbZBVEQZ9icVS';

DELETE s FROM sessions s
JOIN utilisateurs u ON u.id = s.utilisateur_id
WHERE LOWER(u.nom) = 'root'
  AND LOWER(u.email) = 'root@merise.local'
  AND u.mot_de_passe = '$2y$12$39eevJ5B5Mdbg.cZT1zEaOvtR72aD..rHRdU4kbehbZBVEQZ9icVS';

-- ------------------------------------------------------------
-- Journal des actions (suppressions, restaurations, connexions…)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  utilisateur_id  INT UNSIGNED NULL,
  action          VARCHAR(60)  NOT NULL,
  details         VARCHAR(255) NULL,
  cree_le         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_journal_user FOREIGN KEY (utilisateur_id)
    REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Messages du formulaire de contact
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom        VARCHAR(100)  NOT NULL,
  email      VARCHAR(190)  NOT NULL,
  sujet      VARCHAR(150)  NOT NULL,
  message    TEXT          NOT NULL,
  lu         TINYINT(1)    NOT NULL DEFAULT 0,
  cree_le    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
