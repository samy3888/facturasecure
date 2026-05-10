const express = require('express');
const router = express.Router();
const { pool } = require('../server');
const auth = require('../middleware/auth');

// ============================================
// GET — Liste des fournisseurs
// ============================================
router.get('/', auth, async (req, res) => {
try {
const { etablissement_id } = req.utilisateur;
const { rows } = await pool.query(`
SELECT * FROM fournisseurs
WHERE etablissement_id = $1 AND actif = TRUE
ORDER BY nom ASC
`, [etablissement_id]);
res.json({ success: true, donnees: rows });
} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// GET — Un fournisseur
// ============================================
router.get('/:id', auth, async (req, res) => {
try {
const { etablissement_id } = req.utilisateur;
const { rows } = await pool.query(`
SELECT * FROM fournisseurs
WHERE id = $1 AND etablissement_id = $2
`, [req.params.id, etablissement_id]);

if (rows.length === 0) {
return res.status(404).json({ success: false, message: 'Fournisseur non trouvé' });
}
res.json({ success: true, donnees: rows[0] });
} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// POST — Créer un fournisseur
// ============================================
router.post('/', auth, async (req, res) => {
try {
const { etablissement_id, id: userId } = req.utilisateur;
const {
nom, siret, type_fournisseur, email, telephone, adresse,
iban_reference, bic, montant_min, montant_max,
frequence_facturation, contrat_date_debut, contrat_date_fin
} = req.body;

if (!nom || !iban_reference) {
return res.status(400).json({ success: false, message: 'Nom et IBAN obligatoires' });
}

// Vérifier doublon IBAN
const { rows: existing } = await pool.query(`
SELECT id FROM fournisseurs
WHERE etablissement_id = $1 AND iban_reference = $2 AND actif = TRUE
`, [etablissement_id, iban_reference]);

if (existing.length > 0) {
return res.status(400).json({ success: false, message: 'Un fournisseur avec cet IBAN existe déjà' });
}

const { rows } = await pool.query(`
INSERT INTO fournisseurs (
etablissement_id, nom, siret, type_fournisseur, email, telephone, adresse,
iban_reference, bic, montant_min, montant_max,
frequence_facturation, contrat_date_debut, contrat_date_fin
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
RETURNING *
`, [
etablissement_id, nom, siret, type_fournisseur, email, telephone, adresse,
iban_reference.replace(/\s/g, '').toUpperCase(),
bic, montant_min || null, montant_max || null,
frequence_facturation, contrat_date_debut || null, contrat_date_fin || null
]);

// Créer alerte contrat si date fin définie
if (contrat_date_fin) {
await pool.query(`
INSERT INTO alertes_contrats (etablissement_id, fournisseur_id, date_expiration)
VALUES ($1, $2, $3)
`, [etablissement_id, rows[0].id, contrat_date_fin]);
}

// Journal
await pool.query(`
INSERT INTO journal_activite (etablissement_id, utilisateur_id, action, entite_type, entite_id)
VALUES ($1, $2, 'fournisseur_cree', 'fournisseur', $3)
`, [etablissement_id, userId, rows[0].id]);

res.status(201).json({ success: true, message: 'Fournisseur créé', donnees: rows[0] });

} catch (err) {
console.error('❌ Erreur create fournisseur:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// PUT — Modifier un fournisseur
// ============================================
router.put('/:id', auth, async (req, res) => {
try {
const { etablissement_id, id: userId } = req.utilisateur;
const {
nom, siret, type_fournisseur, email, telephone, adresse,
iban_reference, bic, montant_min, montant_max,
frequence_facturation, contrat_date_debut, contrat_date_fin
} = req.body;

// Récupérer ancien IBAN
const { rows: ancien } = await pool.query(`
SELECT iban_reference FROM fournisseurs
WHERE id = $1 AND etablissement_id = $2
`, [req.params.id, etablissement_id]);

if (ancien.length === 0) {
return res.status(404).json({ success: false, message: 'Fournisseur non trouvé' });
}

const nouvelIBAN = iban_reference.replace(/\s/g, '').toUpperCase();
const ancienIBAN = ancien[0].iban_reference;

// Si IBAN changé → historique
if (nouvelIBAN !== ancienIBAN) {
await pool.query(`
INSERT INTO historique_rib (fournisseur_id, etablissement_id, iban_ancien, iban_nouveau, source)
VALUES ($1, $2, $3, $4, 'manuel')
`, [req.params.id, etablissement_id, ancienIBAN, nouvelIBAN]);
}

const { rows } = await pool.query(`
UPDATE fournisseurs SET
nom=$1, siret=$2, type_fournisseur=$3, email=$4, telephone=$5, adresse=$6,
iban_reference=$7, bic=$8, montant_min=$9, montant_max=$10,
frequence_facturation=$11, contrat_date_debut=$12, contrat_date_fin=$13,
updated_at=NOW()
WHERE id=$14 AND etablissement_id=$15
RETURNING *
`, [
nom, siret, type_fournisseur, email, telephone, adresse,
nouvelIBAN, bic, montant_min || null, montant_max || null,
frequence_facturation, contrat_date_debut || null, contrat_date_fin || null,
req.params.id, etablissement_id
]);

// Journal
await pool.query(`
INSERT INTO journal_activite (etablissement_id, utilisateur_id, action, entite_type, entite_id)
VALUES ($1, $2, 'fournisseur_modifie', 'fournisseur', $3)
`, [etablissement_id, userId, req.params.id]);

res.json({ success: true, message: 'Fournisseur mis à jour', donnees: rows[0] });

} catch (err) {
console.error('❌ Erreur update fournisseur:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// DELETE — Supprimer un fournisseur
// ============================================
router.delete('/:id', auth, async (req, res) => {
try {
const { etablissement_id, id: userId } = req.utilisateur;

await pool.query(`
UPDATE fournisseurs SET actif = FALSE, updated_at = NOW()
WHERE id = $1 AND etablissement_id = $2
`, [req.params.id, etablissement_id]);

// Journal
await pool.query(`
INSERT INTO journal_activite (etablissement_id, utilisateur_id, action, entite_type, entite_id)
VALUES ($1, $2, 'fournisseur_supprime', 'fournisseur', $3)
`, [etablissement_id, userId, req.params.id]);

res.json({ success: true, message: 'Fournisseur supprimé' });

} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

module.exports = router;
