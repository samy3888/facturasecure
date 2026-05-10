const { pool } = require('../server');

// ============================================
// FONCTION PRINCIPALE — Vérifier une facture
// ============================================
async function verifierFacture(factureId, etablissementId) {
try {
console.log(`🔍 Vérification facture: ${factureId}`);

// Récupérer la facture complète
const { rows: factures } = await pool.query(`
SELECT f.*, fo.*
FROM factures f
LEFT JOIN fournisseurs fo ON fo.id = f.fournisseur_id
WHERE f.id = $1 AND f.etablissement_id = $2
`, [factureId, etablissementId]);

if (factures.length === 0) {
return { success: false, message: 'Facture non trouvée' };
}

const facture = factures[0];
const resultats = [];
let niveauGlobal = 'conforme';

// ============================================
// CONTRÔLE 1 — Fournisseur connu ou inconnu
// ============================================
const controleFournisseur = await verifierFournisseur(facture, etablissementId);
resultats.push(controleFournisseur);
niveauGlobal = majNiveau(niveauGlobal, controleFournisseur.niveau);

// ============================================
// CONTRÔLE 2 — RIB / IBAN (PRIORITÉ ABSOLUE)
// ============================================
const controleRIB = await verifierRIB(facture);
resultats.push(controleRIB);
niveauGlobal = majNiveau(niveauGlobal, controleRIB.niveau);

// ============================================
// CONTRÔLE 3 — Montant dans la fourchette
// ============================================
const controleMontant = await verifierMontant(facture);
resultats.push(controleMontant);
niveauGlobal = majNiveau(niveauGlobal, controleMontant.niveau);

// ============================================
// CONTRÔLE 4 — Prix unitaires vs contrat
// ============================================
const controlePrix = await verifierPrixUnitaires(facture, etablissementId);
resultats.push(controlePrix);
niveauGlobal = majNiveau(niveauGlobal, controlePrix.niveau);

// ============================================
// CONTRÔLE 5 — Doublon
// ============================================
const controleDoublon = await verifierDoublon(facture);
resultats.push(controleDoublon);
niveauGlobal = majNiveau(niveauGlobal, controleDoublon.niveau);

// ============================================
// CONTRÔLE 6 — Lignes suspectes
// ============================================
const controleLignes = await verifierLignes(facture, etablissementId);
resultats.push(controleLignes);
niveauGlobal = majNiveau(niveauGlobal, controleLignes.niveau);

// ============================================
// CONTRÔLE 7 — Date d'échéance
// ============================================
const controleEcheance = verifierEcheance(facture);
resultats.push(controleEcheance);
niveauGlobal = majNiveau(niveauGlobal, controleEcheance.niveau);

// ============================================
// CONTRÔLE 8 — TVA
// ============================================
const controleTVA = verifierTVA(facture);
resultats.push(controleTVA);
niveauGlobal = majNiveau(niveauGlobal, controleTVA.niveau);

// ============================================
// METTRE À JOUR LA FACTURE
// ============================================
const statutFacture = niveauGlobal === 'alerte_rouge' ? 'bloquee' : 'en_attente';

await pool.query(`
UPDATE factures SET
verification_statut = $1,
verification_date = NOW(),
verification_resultats = $2,
statut = $3,
updated_at = NOW()
WHERE id = $4
`, [niveauGlobal, JSON.stringify(resultats), statutFacture, factureId]);

// ============================================
// CRÉER LES ALERTES
// ============================================
for (const resultat of resultats) {
if (resultat.niveau !== 'conforme') {
await creerAlerte(facture, resultat, etablissementId);
}
}

// ============================================
// ENVOYER NOTIFICATIONS
// ============================================
if (niveauGlobal !== 'conforme') {
await envoyerNotifications(facture, niveauGlobal, etablissementId);
}

console.log(`✅ Vérification terminée — Niveau: ${niveauGlobal}`);
return { success: true, niveau: niveauGlobal, resultats };

} catch (err) {
console.error('❌ Erreur vérification:', err.message);
return { success: false, message: err.message };
}
}

// ============================================
// CONTRÔLE 1 — FOURNISSEUR
// ============================================
async function verifierFournisseur(facture, etablissementId) {
if (!facture.fournisseur_id) {
return {
type: 'fournisseur_inconnu',
niveau: 'alerte_rouge',
titre: 'Fournisseur inconnu',
description: 'Ce fournisseur n\'est pas enregistré dans votre base.',
donnees: { nom_detecte: facture.ocr_brut }
};
}
return {
type: 'fournisseur',
niveau: 'conforme',
titre: 'Fournisseur connu',
description: 'Fournisseur reconnu et enregistré.'
};
}

// ============================================
// CONTRÔLE 2 — RIB / IBAN (PRIORITÉ ABSOLUE)
// ============================================
async function verifierRIB(facture) {
// Pas d'IBAN sur la facture
if (!facture.iban_facture) {
return {
type: 'rib',
niveau: 'attention',
titre: 'IBAN non détecté',
description: 'Aucun IBAN n\'a été détecté sur cette facture.',
donnees: {}
};
}

// Pas de fournisseur enregistré = pas de référence à comparer
if (!facture.iban_reference) {
return {
type: 'rib',
niveau: 'attention',
titre: 'IBAN de référence manquant',
description: 'Aucun IBAN de référence enregistré pour ce fournisseur.',
donnees: { iban_facture: facture.iban_facture }
};
}

// Comparaison IBAN facture vs IBAN référence
const ibanFacture = facture.iban_facture.replace(/\s/g, '').toUpperCase();
const ibanReference = facture.iban_reference.replace(/\s/g, '').toUpperCase();

if (ibanFacture !== ibanReference) {
return {
type: 'changement_rib',
niveau: 'alerte_rouge',
titre: '🚨 CHANGEMENT DE RIB DÉTECTÉ',
description: 'L\'IBAN sur la facture est différent de celui enregistré. Risque de fraude élevé.',
donnees: {
iban_reference: ibanReference,
iban_facture: ibanFacture,
difference: true
}
};
}

return {
type: 'rib',
niveau: 'conforme',
titre: 'RIB conforme',
description: 'L\'IBAN de la facture correspond à celui enregistré.',
donnees: { iban: ibanFacture }
};
}

// ============================================
// CONTRÔLE 3 — MONTANT
// ============================================
async function verifierMontant(facture) {
if (!facture.montant_ttc) {
return {
type: 'montant',
niveau: 'attention',
titre: 'Montant non détecté',
description: 'Le montant TTC n\'a pas pu être extrait de la facture.'
};
}

if (!facture.montant_min && !facture.montant_max) {
return {
type: 'montant',
niveau: 'conforme',
titre: 'Montant non contrôlé',
description: 'Aucune fourchette définie pour ce fournisseur.'
};
}

const montant = parseFloat(facture.montant_ttc);
const min = parseFloat(facture.montant_min);
const max = parseFloat(facture.montant_max);

if (montant < min || montant > max) {
const ecart = montant > max
? `+${((montant - max) / max * 100).toFixed(1)}%`
: `-${((min - montant) / min * 100).toFixed(1)}%`;

return {
type: 'montant_hors_fourchette',
niveau: 'attention',
titre: 'Montant hors fourchette habituelle',
description: `Le montant de ${montant}€ est en dehors de la fourchette habituelle (${min}€ - ${max}€). Écart: ${ecart}`,
donnees: { montant, min, max, ecart }
};
}

return {
type: 'montant',
niveau: 'conforme',
titre: 'Montant dans la fourchette',
description: `Montant de ${montant}€ dans la fourchette attendue.`
};
}

// ============================================
// CONTRÔLE 4 — PRIX UNITAIRES VS CONTRAT
// ============================================
async function verifierPrixUnitaires(facture, etablissementId) {
if (!facture.fournisseur_id || !facture.ocr_lignes) {
return {
type: 'prix_unitaires',
niveau: 'conforme',
titre: 'Prix non contrôlés',
description: 'Pas de contrat cadre ou de lignes détectées.'
};
}

try {
const lignesFacture = JSON.parse(facture.ocr_lignes || '[]');
if (lignesFacture.length === 0) {
return {
type: 'prix_unitaires',
niveau: 'conforme',
titre: 'Aucune ligne à contrôler',
description: 'Aucune ligne de facturation détectée.'
};
}

const { rows: tarifsContrat } = await pool.query(`
SELECT * FROM tarifs_contrat
WHERE fournisseur_id = $1 AND etablissement_id = $2 AND actif = TRUE
`, [facture.fournisseur_id, etablissementId]);

if (tarifsContrat.length === 0) {
return {
type: 'prix_unitaires',
niveau: 'conforme',
titre: 'Pas de tarifs contractuels',
description: 'Aucun tarif contrat enregistré pour ce fournisseur.'
};
}

const anomalies = [];

for (const ligne of lignesFacture) {
const tarif = tarifsContrat.find(t =>
ligne.designation?.toLowerCase().includes(t.designation.toLowerCase().substring(0, 10))
);

if (tarif && ligne.montant) {
const ecartPct = Math.abs((ligne.montant - tarif.prix_unitaire) / tarif.prix_unitaire * 100);
if (ecartPct > 5) { // tolérance 5%
anomalies.push({
designation: ligne.designation,
prix_facture: ligne.montant,
prix_contrat: tarif.prix_unitaire,
ecart_pct: ecartPct.toFixed(1)
});
}
}
}

if (anomalies.length > 0) {
return {
type: 'augmentation_prix',
niveau: 'attention',
titre: `${anomalies.length} ligne(s) avec prix non contractuel`,
description: 'Des prix facturés ne correspondent pas aux tarifs du contrat cadre.',
donnees: { anomalies }
};
}

return {
type: 'prix_unitaires',
niveau: 'conforme',
titre: 'Prix conformes au contrat',
description: 'Tous les prix correspondent aux tarifs contractuels.'
};

} catch (err) {
return {
type: 'prix_unitaires',
niveau: 'conforme',
titre: 'Contrôle prix non effectué',
description: err.message
};
}
}

// ============================================
// CONTRÔLE 5 — DOUBLON
// ============================================
async function verifierDoublon(facture) {
if (!facture.numero_facture) {
return {
type: 'doublon',
niveau: 'attention',
titre: 'Numéro de facture non détecté',
description: 'Impossible de vérifier les doublons sans numéro de facture.'
};
}

try {
const { rows } = await pool.query(`
SELECT id FROM factures
WHERE etablissement_id = $1
AND numero_facture = $2
AND id != $3
LIMIT 1
`, [facture.etablissement_id, facture.numero_facture, facture.id]);

if (rows.length > 0) {
return {
type: 'doublon',
niveau: 'alerte_rouge',
titre: '🚨 DOUBLON DÉTECTÉ',
description: `Une facture avec le numéro ${facture.numero_facture} existe déjà.`,
donnees: { facture_existante_id: rows[0].id, numero: facture.numero_facture }
};
}

return {
type: 'doublon',
niveau: 'conforme',
titre: 'Pas de doublon',
description: 'Ce numéro de facture est unique.'
};

} catch (err) {
return {
type: 'doublon',
niveau: 'conforme',
titre: 'Vérification doublon échouée',
description: err.message
};
}
}

// ============================================
// CONTRÔLE 6 — LIGNES SUSPECTES
// ============================================
async function verifierLignes(facture, etablissementId) {
if (!facture.ocr_lignes) {
return {
type: 'lignes',
niveau: 'conforme',
titre: 'Lignes non analysées',
description: 'Aucune ligne extraite.'
};
}

try {
const lignes = JSON.parse(facture.ocr_lignes || '[]');
const motsSuspects = [
'frais de dossier', 'frais administratif', 'frais de gestion',
'contribution', 'participation', 'supplément', 'majoration',
'frais divers', 'divers', 'autre', 'misc', 'various',
'commission', 'honoraire supplémentaire'
];

const lignesSuspectes = lignes.filter(ligne => {
const designation = (ligne.designation || '').toLowerCase();
return motsSuspects.some(mot => designation.includes(mot));
});

if (lignesSuspectes.length > 0) {
return {
type: 'ligne_suspecte',
niveau: 'attention',
titre: `${lignesSuspectes.length} ligne(s) inhabituelle(s) détectée(s)`,
description: 'Des lignes avec des désignations inhabituelles ont été détectées.',
donnees: { lignes_suspectes: lignesSuspectes }
};
}

return {
type: 'lignes',
niveau: 'conforme',
titre: 'Lignes normales',
description: 'Aucune ligne suspecte détectée.'
};

} catch (err) {
return {
type: 'lignes',
niveau: 'conforme',
titre: 'Analyse lignes échouée',
description: err.message
};
}
}

// ============================================
// CONTRÔLE 7 — DATE D'ÉCHÉANCE
// ============================================
function verifierEcheance(facture) {
if (!facture.date_echeance) {
return {
type: 'echeance',
niveau: 'attention',
titre: 'Date d\'échéance non détectée',
description: 'Aucune date d\'échéance trouvée sur la facture.'
};
}

const echeance = new Date(facture.date_echeance);
const maintenant = new Date();
const joursRestants = Math.ceil((echeance - maintenant) / (1000 * 60 * 60 * 24));

if (joursRestants < 0) {
return {
type: 'echeance_depassee',
niveau: 'attention',
titre: `Échéance dépassée de ${Math.abs(joursRestants)} jours`,
description: `Cette facture était due le ${echeance.toLocaleDateString('fr-FR')}.`,
donnees: { jours_retard: Math.abs(joursRestants), date_echeance: facture.date_echeance }
};
}

if (joursRestants <= 7) {
return {
type: 'echeance_proche',
niveau: 'attention',
titre: `Échéance dans ${joursRestants} jour(s)`,
description: `Cette facture doit être payée avant le ${echeance.toLocaleDateString('fr-FR')}.`,
donnees: { jours_restants: joursRestants }
};
}

return {
type: 'echeance',
niveau: 'conforme',
titre: 'Échéance normale',
description: `Échéance dans ${joursRestants} jours.`
};
}

// ============================================
// CONTRÔLE 8 — TVA
// ============================================
function verifierTVA(facture) {
const tauxValides = [0, 2.1, 5.5, 10, 20];

if (!facture.taux_tva) {
return {
type: 'tva',
niveau: 'attention',
titre: 'TVA non détectée',
description: 'Le taux de TVA n\'a pas été trouvé sur la facture.'
};
}

const taux = parseFloat(facture.taux_tva);

if (!tauxValides.includes(taux)) {
return {
type: 'tva_incorrecte',
niveau: 'attention',
titre: `Taux de TVA inhabituel: ${taux}%`,
description: `Le taux de TVA ${taux}% ne correspond pas aux taux légaux français (0%, 2.1%, 5.5%, 10%, 20%).`,
donnees: { taux_detecte: taux, taux_valides: tauxValides }
};
}

// Vérifier cohérence HT + TVA = TTC
if (facture.montant_ht && facture.montant_ttc) {
const ttcCalcule = facture.montant_ht * (1 + taux / 100);
const ecart = Math.abs(ttcCalcule - facture.montant_ttc);
if (ecart > 1) { // tolérance 1€
return {
type: 'tva_incoherente',
niveau: 'attention',
titre: 'TVA incohérente',
description: `Le calcul HT + TVA ne correspond pas au TTC affiché. Écart: ${ecart.toFixed(2)}€`,
donnees: {
montant_ht: facture.montant_ht,
taux_tva: taux,
ttc_calcule: ttcCalcule.toFixed(2),
ttc_facture: facture.montant_ttc
}
};
}
}

return {
type: 'tva',
niveau: 'conforme',
titre: `TVA conforme (${taux}%)`,
description: 'Le taux de TVA est valide et le calcul est cohérent.'
};
}

// ============================================
// CRÉER UNE ALERTE EN BASE
// ============================================
async function creerAlerte(facture, resultat, etablissementId) {
try {
await pool.query(`
INSERT INTO alertes (
etablissement_id, facture_id, fournisseur_id,
type_alerte, niveau, titre, description, donnees,
bloquage_automatique
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
`, [
etablissementId,
facture.id,
facture.fournisseur_id || null,
resultat.type,
resultat.niveau,
resultat.titre,
resultat.description,
JSON.stringify(resultat.donnees || {}),
resultat.niveau === 'alerte_rouge'
]);
} catch (err) {
console.error('❌ Erreur création alerte:', err.message);
}
}

// ============================================
// ENVOYER NOTIFICATIONS
// ============================================
async function envoyerNotifications(facture, niveau, etablissementId) {
try {
// Récupérer les utilisateurs à notifier
const { rows: utilisateurs } = await pool.query(`
SELECT id, email, role FROM utilisateurs
WHERE etablissement_id = $1 AND actif = TRUE
AND role IN ('comptable', 'directeur_financier')
`, [etablissementId]);

for (const user of utilisateurs) {
await pool.query(`
INSERT INTO notifications (etablissement_id, utilisateur_id, type, titre, message)
VALUES ($1, $2, 'app', $3, $4)
`, [
etablissementId,
user.id,
`Nouvelle facture — Niveau: ${niveau}`,
`Une facture de ${facture.email_expediteur || 'source inconnue'} requiert votre attention.`
]);
}
} catch (err) {
console.error('❌ Erreur notifications:', err.message);
}
}

// ============================================
// UTILITAIRE — Niveau le plus élevé
// ============================================
function majNiveau(niveauActuel, nouveauNiveau) {
const priorite = { conforme: 0, attention: 1, alerte_rouge: 2 };
return priorite[nouveauNiveau] > priorite[niveauActuel] ? nouveauNiveau : niveauActuel;
}

// ============================================
// EXPORT
// ============================================
module.exports = { verifierFacture };
