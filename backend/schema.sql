-- ============================================
-- FACTARASECURE — schema.sql
-- ============================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ÉTABLISSEMENTS (clients FacturaSecure)
-- ============================================
CREATE TABLE etablissements (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
nom VARCHAR(255) NOT NULL,
siret VARCHAR(14) UNIQUE NOT NULL,
type_etablissement VARCHAR(100) NOT NULL, -- hopital, clinique, ehpad, mairie, pme, etc.
email_contact VARCHAR(255) NOT NULL,
telephone VARCHAR(20),
adresse TEXT,
code_postal VARCHAR(10),
ville VARCHAR(100),
pays VARCHAR(100) DEFAULT 'France',
-- Abonnement
statut_abonnement VARCHAR(50) DEFAULT 'essai', -- essai, actif, suspendu, resilié
date_debut_essai TIMESTAMP DEFAULT NOW(),
date_fin_essai TIMESTAMP DEFAULT NOW() + INTERVAL '30 days',
date_abonnement TIMESTAMP,
-- Stripe
stripe_customer_id VARCHAR(255),
stripe_subscription_id VARCHAR(255),
-- Config email réception
email_imap VARCHAR(255),
imap_host VARCHAR(255),
imap_port INTEGER DEFAULT 993,
imap_password_encrypted TEXT,
imap_actif BOOLEAN DEFAULT FALSE,
-- Métadonnées
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 2. UTILISATEURS
-- ============================================
CREATE TABLE utilisateurs (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
nom VARCHAR(255) NOT NULL,
prenom VARCHAR(255) NOT NULL,
email VARCHAR(255) UNIQUE NOT NULL,
mot_de_passe_hash VARCHAR(255) NOT NULL,
role VARCHAR(50) NOT NULL, -- comptable, directeur_financier, directeur, admin_it
-- 2FA
totp_secret VARCHAR(255),
totp_actif BOOLEAN DEFAULT FALSE,
-- Statut
actif BOOLEAN DEFAULT TRUE,
derniere_connexion TIMESTAMP,
-- Métadonnées
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 3. FOURNISSEURS
-- ============================================
CREATE TABLE fournisseurs (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
nom VARCHAR(255) NOT NULL,
siret VARCHAR(14),
type_fournisseur VARCHAR(100), -- medicaments, materiel, services, maintenance, etc.
email VARCHAR(255),
telephone VARCHAR(20),
adresse TEXT,
-- RIB de référence (celui enregistré = celui de confiance)
iban_reference VARCHAR(34) NOT NULL,
bic VARCHAR(11),
-- Paramètres de contrôle
montant_min DECIMAL(12,2), -- montant minimum habituel
montant_max DECIMAL(12,2), -- montant maximum habituel
frequence_facturation VARCHAR(50), -- mensuel, hebdomadaire, trimestriel, ponctuel
-- Contrat cadre
contrat_pdf_key VARCHAR(500), -- clé AWS S3
contrat_date_debut DATE,
contrat_date_fin DATE,
-- Statut
actif BOOLEAN DEFAULT TRUE,
verifie BOOLEAN DEFAULT FALSE, -- vérifié manuellement par l'établissement
-- Métadonnées
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 4. TARIFS CONTRACTUELS (lignes du contrat cadre)
-- ============================================
CREATE TABLE tarifs_contrat (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id) ON DELETE CASCADE,
etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
designation VARCHAR(500) NOT NULL,
prix_unitaire DECIMAL(12,4) NOT NULL,
unite VARCHAR(100), -- boîte, heure, kg, forfait, etc.
taux_tva DECIMAL(5,2) DEFAULT 20.00,
actif BOOLEAN DEFAULT TRUE,
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 5. FACTURES
-- ============================================
CREATE TABLE factures (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
fournisseur_id UUID REFERENCES fournisseurs(id),
-- Identité de la facture
numero_facture VARCHAR(255),
date_facture DATE,
date_echeance DATE,
-- Montants
montant_ht DECIMAL(12,2),
taux_tva DECIMAL(5,2),
montant_tva DECIMAL(12,2),
montant_ttc DECIMAL(12,2),
-- IBAN sur la facture (celui détecté par OCR — peut différer du référence)
iban_facture VARCHAR(34),
-- Source
source VARCHAR(50) DEFAULT 'email', -- email, upload_manuel
email_expediteur VARCHAR(255),
email_sujet TEXT,
-- Fichier
pdf_key VARCHAR(500), -- clé AWS S3
pdf_nom_original VARCHAR(500),
-- OCR
ocr_brut JSONB, -- données brutes extraites par OCR
ocr_lignes JSONB, -- lignes de facturation extraites
ocr_statut VARCHAR(50) DEFAULT 'en_attente', -- en_attente, ok, erreur
-- Statut global
statut VARCHAR(50) DEFAULT 'en_attente', -- en_attente, validee, rejetee, bloquee, escaladee
-- Vérification
verification_statut VARCHAR(50) DEFAULT 'en_attente', -- en_attente, conforme, attention, alerte_rouge
verification_date TIMESTAMP,
verification_resultats JSONB, -- résultats détaillés des contrôles
-- Validation humaine
valide_par UUID REFERENCES utilisateurs(id),
valide_le TIMESTAMP,
decharge_responsabilite BOOLEAN DEFAULT FALSE, -- case cochée si validation malgré alerte
rejete_par UUID REFERENCES utilisateurs(id),
rejete_le TIMESTAMP,
motif_rejet TEXT,
-- Escalade
escalade_par UUID REFERENCES utilisateurs(id),
escalade_le TIMESTAMP,
escalade_vers UUID REFERENCES utilisateurs(id),
-- Métadonnées
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 6. LIGNES DE FACTURE
-- ============================================
CREATE TABLE lignes_facture (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
facture_id UUID NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
-- Contenu
designation TEXT,
quantite DECIMAL(10,3),
prix_unitaire DECIMAL(12,4),
taux_tva DECIMAL(5,2),
montant_ht DECIMAL(12,2),
montant_ttc DECIMAL(12,2),
-- Vérification vs contrat
tarif_contrat_id UUID REFERENCES tarifs_contrat(id),
prix_contrat DECIMAL(12,4), -- prix attendu selon contrat
ecart_prix DECIMAL(12,4), -- différence constatée
ecart_pourcentage DECIMAL(8,2),
-- Statut de la ligne
statut_ligne VARCHAR(50) DEFAULT 'normale', -- normale, suspecte, inconnue, hors_contrat
motif_suspicion TEXT,
created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 7. ALERTES
-- ============================================
CREATE TABLE alertes (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
facture_id UUID REFERENCES factures(id) ON DELETE CASCADE,
fournisseur_id UUID REFERENCES fournisseurs(id),
-- Type et niveau
type_alerte VARCHAR(100) NOT NULL,
-- changement_rib, doublon, ligne_suspecte, augmentation_prix,
-- fournisseur_inconnu, montant_hors_fourchette, tva_incorrecte, echeance_depassee
niveau VARCHAR(20) NOT NULL, -- conforme, attention, alerte_rouge
-- Contenu
titre VARCHAR(500) NOT NULL,
description TEXT,
donnees JSONB, -- données spécifiques à l'alerte (ex: ancien IBAN vs nouveau IBAN)
-- Statut
statut VARCHAR(50) DEFAULT 'active', -- active, lue, traitee, ignoree
traitee_par UUID REFERENCES utilisateurs(id),
traitee_le TIMESTAMP,
-- Blocage automatique
bloquage_automatique BOOLEAN DEFAULT FALSE,
-- Métadonnées
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 8. NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
utilisateur_id UUID REFERENCES utilisateurs(id) ON DELETE CASCADE,
alerte_id UUID REFERENCES alertes(id) ON DELETE CASCADE,
-- Contenu
type VARCHAR(50) NOT NULL, -- app, email, sms
titre VARCHAR(500),
message TEXT,
-- Statut envoi
envoye BOOLEAN DEFAULT FALSE,
envoye_le TIMESTAMP,
erreur_envoi TEXT,
-- Statut lecture (pour notifications in-app)
lu BOOLEAN DEFAULT FALSE,
lu_le TIMESTAMP,
created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 9. JOURNAL D'ACTIVITÉ
-- ============================================
CREATE TABLE journal_activite (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
utilisateur_id UUID REFERENCES utilisateurs(id),
-- Action
action VARCHAR(255) NOT NULL,
-- ex: facture_validee, facture_rejetee, fournisseur_cree, alerte_traitee, etc.
entite_type VARCHAR(100), -- facture, fournisseur, utilisateur, alerte, etc.
entite_id UUID,
-- Détails
details JSONB, -- données avant/après, contexte
ip_address INET,
user_agent TEXT,
created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 10. RAPPORTS
-- ============================================
CREATE TABLE rapports (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
type_rapport VARCHAR(50) NOT NULL, -- mensuel, annuel, custom
periode_debut DATE NOT NULL,
periode_fin DATE NOT NULL,
-- Données du rapport
donnees JSONB NOT NULL,
-- ex: nb_factures, total_ttc, nb_alertes, economies_estimees, etc.
-- Fichier exporté
pdf_key VARCHAR(500),
excel_key VARCHAR(500),
-- Génération
genere_par UUID REFERENCES utilisateurs(id),
genere_le TIMESTAMP DEFAULT NOW(),
envoye_directeur BOOLEAN DEFAULT FALSE,
envoye_le TIMESTAMP,
created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 11. HISTORIQUE RIB FOURNISSEURS
-- ============================================
CREATE TABLE historique_rib (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id) ON DELETE CASCADE,
etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
-- IBAN
iban_ancien VARCHAR(34),
iban_nouveau VARCHAR(34) NOT NULL,
bic_nouveau VARCHAR(11),
-- Changement
motif VARCHAR(500),
source VARCHAR(50), -- facture, manuel
facture_id UUID REFERENCES factures(id),
-- Validation
valide_par UUID REFERENCES utilisateurs(id),
valide_le TIMESTAMP,
statut VARCHAR(50) DEFAULT 'en_attente', -- en_attente, valide, rejete
created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 12. TOKENS & SESSIONS
-- ============================================
CREATE TABLE refresh_tokens (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
utilisateur_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
token_hash VARCHAR(255) NOT NULL UNIQUE,
expires_at TIMESTAMP NOT NULL,
revoke BOOLEAN DEFAULT FALSE,
created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 13. INVITATIONS UTILISATEURS
-- ============================================
CREATE TABLE invitations (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
email VARCHAR(255) NOT NULL,
role VARCHAR(50) NOT NULL,
token VARCHAR(255) UNIQUE NOT NULL,
expires_at TIMESTAMP NOT NULL,
utilise BOOLEAN DEFAULT FALSE,
invite_par UUID REFERENCES utilisateurs(id),
created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 14. CONTRATS EXPIRATION (suivi)
-- ============================================
CREATE TABLE alertes_contrats (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
fournisseur_id UUID NOT NULL REFERENCES fournisseurs(id) ON DELETE CASCADE,
date_expiration DATE NOT NULL,
alerte_60j_envoyee BOOLEAN DEFAULT FALSE,
alerte_30j_envoyee BOOLEAN DEFAULT FALSE,
alerte_7j_envoyee BOOLEAN DEFAULT FALSE,
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEX (performance)
-- ============================================
CREATE INDEX idx_utilisateurs_etablissement ON utilisateurs(etablissement_id);
CREATE INDEX idx_utilisateurs_email ON utilisateurs(email);
CREATE INDEX idx_fournisseurs_etablissement ON fournisseurs(etablissement_id);
CREATE INDEX idx_fournisseurs_iban ON fournisseurs(iban_reference);
CREATE INDEX idx_factures_etablissement ON factures(etablissement_id);
CREATE INDEX idx_factures_fournisseur ON factures(fournisseur_id);
CREATE INDEX idx_factures_statut ON factures(statut);
CREATE INDEX idx_factures_verification ON factures(verification_statut);
CREATE INDEX idx_factures_numero ON factures(numero_facture);
CREATE INDEX idx_factures_created ON factures(created_at);
CREATE INDEX idx_lignes_facture ON lignes_facture(facture_id);
CREATE INDEX idx_alertes_etablissement ON alertes(etablissement_id);
CREATE INDEX idx_alertes_facture ON alertes(facture_id);
CREATE INDEX idx_alertes_statut ON alertes(statut);
CREATE INDEX idx_alertes_niveau ON alertes(niveau);
CREATE INDEX idx_journal_etablissement ON journal_activite(etablissement_id);
CREATE INDEX idx_journal_utilisateur ON journal_activite(utilisateur_id);
CREATE INDEX idx_journal_created ON journal_activite(created_at);
CREATE INDEX idx_notifications_utilisateur ON notifications(utilisateur_id);
CREATE INDEX idx_notifications_lu ON notifications(lu);

-- ============================================
-- FONCTION updated_at automatique
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers updated_at
CREATE TRIGGER update_etablissements_updated_at BEFORE UPDATE ON etablissements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_utilisateurs_updated_at BEFORE UPDATE ON utilisateurs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fournisseurs_updated_at BEFORE UPDATE ON fournisseurs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tarifs_contrat_updated_at BEFORE UPDATE ON tarifs_contrat FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_factures_updated_at BEFORE UPDATE ON factures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alertes_updated_at BEFORE UPDATE ON alertes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alertes_contrats_updated_at BEFORE UPDATE ON alertes_contrats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
