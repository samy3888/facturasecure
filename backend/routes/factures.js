const express = require('express');
const router = express.Router();
const { pool } = require('../server');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { lireFichier } = require('../services/ocr');
const { verifierFacture } = require('../services/verification');

// Upload en mémoire
const upload = multer({ storage: multer.memoryStorage() });

// ============================================
// GET — Liste des factures
// ============================================
router.get('/', auth, async (req, res) => {
try {
const { etablissement_id } = req.utilisateur;
const { statut, limit = 50, offset = 0 } = req.query;

let query = `
SELECT f.*, fo.nom as nom_fournisseur
FROM factures f
LEFT JOIN fournisseurs fo ON fo.id = f.fournisseur_id
WHERE f.etablissement_id = $1
`;
const params = [etablissement_id];

if (statut && statut !== 'tous') {
query += ` AND f.verification_statut = $${params.length + 1}`;
params.push(statut);
}

query += ` ORDER BY f.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
params.push(limit, offset);

const { rows } = await pool.query(query, params);
res.json({ success: true, donnees: rows });

} catch (err) {
console.error('❌ Erreur get factures:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// GET — Une facture
// ============================================
router.get('/:id', auth, async (req, res) => {
try {
const { etablissement_id } = req.utilisateur;
const { rows } = await pool.query(`
SELECT f.*, fo.nom as nom_fournisseur, fo.iban_reference
FROM factures f
LEFT JOIN fournisseurs fo ON fo.id = f.fournisseur_id
WHERE f.id = $1 AND f.etablissement_id = $2
`, [req.params.id, etablissement_id]);

if (rows.length === 0) {
return res.status(404).json({ success: false, message: 'Facture non trouvée' });
}

res.json({ success: true, donnees: rows[0] });

} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// POST — Upload facture PDF
// ============================================
router.post('/upload', auth, upload.single('facture'), async (req, res) => {
try {
const { etablissement_id } = req.utilisateur;

if (!req.file) {
return res.status(400).json({ success: false, message: 'Aucun fichier reçu' });
}

// Sauvegarder temporairement
const fs = require('fs');
const cheminTemp = path.join(require('os').tmpdir(), `${Date.now()}_${req.file.originalname}`);
fs.writeFileSync(cheminTemp, req.file.buffer);

// OCR
const resultOCR = await lireFichier(cheminTemp);
fs.unlinkSync(cheminTemp);

const donnees = resultOCR.success ? resultOCR.donnees : {};

// Chercher fournisseur
let fournisseurId = null;
if (donnees.iban) {
const { rows: fournisseurs } = await pool.query(`
SELECT id FROM fournisseurs
WHERE etablissement_id = $1 AND iban_reference = $2 AND actif = TRUE
LIMIT 1
`, [etablissement_id, donnees.iban]);
if (fournisseurs.length > 0) fournisseurId = fournisseurs[0].id;
}

// Créer la facture
const { rows } = await pool.query(`
INSERT INTO factures (
etablissement_id, fournisseur_id,
numero_facture, date_facture, date_echeance,
montant_ht, montant_ttc, taux_tva,
iban_facture, source, pdf_nom_original,
ocr_brut, ocr_lignes, ocr_statut,
statut, verification_statut
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
RETURNING id
`, [
etablissement_id, fournisseurId,
donnees.numero_facture, donnees.date_facture, donnees.date_echeance,
donnees.montant_ht, donnees.montant_ttc, donnees.taux_tva,
donnees.iban, 'upload_manuel', req.file.originalname,
JSON.stringify(resultOCR.texte_brut || ''),
JSON.stringify(donnees.lignes || []),
resultOCR.success ? 'ok' : 'erreur',
'en_attente', 'en_attente'
]);

const factureId = rows[0].id;

// Vérification automatique
await verifierFacture(factureId, etablissement_id);

res.status(201).json({
success: true,
message: 'Facture uploadée et analysée',
facture_id: factureId
});

} catch (err) {
console.error('❌ Erreur upload facture:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// POST — Valider une facture
// ============================================
router.post('/:id/valider', auth, async (req, res) => {
try {
const { etablissement_id, id: userId } = req.utilisateur;
const { decharge } = req.body;

const { rows } = await pool.query(`
UPDATE factures SET
statut = 'validee',
valide_par = $1,
valide_le = NOW(),
decharge_responsabilite = $2,
updated_at = NOW()
WHERE id = $3 AND etablissement_id = $4
RETURNING id
`, [userId, decharge || false, req.params.id, etablissement_id]);

if (rows.length === 0) {
return res.status(404).json({ success: false, message: 'Facture non trouvée' });
}

// Journal
await pool.query(`
INSERT INTO journal_activite (etablissement_id, utilisateur_id, action, entite_type, entite_id)
VALUES ($1, $2, 'facture_validee', 'facture', $3)
`, [etablissement_id, userId, req.params.id]);

res.json({ success: true, message: 'Facture validée' });

} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// POST — Rejeter une facture
// ============================================
router.post('/:id/rejeter', auth, async (req, res) => {
try {
const { etablissement_id, id: userId } = req.utilisateur;
const { motif } = req.body;

await pool.query(`
UPDATE factures SET
statut = 'rejetee',
rejete_par = $1,
rejete_le = NOW(),
motif_rejet = $2,
updated_at = NOW()
WHERE id = $3 AND etablissement_id = $4
`, [userId, motif, req.params.id, etablissement_id]);

// Journal
await pool.query(`
INSERT INTO journal_activite (etablissement_id, utilisateur_id, action, entite_type, entite_id, details)
VALUES ($1, $2, 'facture_rejetee', 'facture', $3, $4)
`, [etablissement_id, userId, req.params.id, JSON.stringify({ motif })]);

res.json({ success: true, message: 'Facture rejetée' });

} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// POST — Escalader une facture
// ============================================
router.post('/:id/escalader', auth, async (req, res) => {
try {
const { etablissement_id, id: userId } = req.utilisateur;

// Trouver le directeur financier
const { rows: directeurs } = await pool.query(`
SELECT id FROM utilisateurs
WHERE etablissement_id = $1
AND role = 'directeur_financier'
AND actif = TRUE
LIMIT 1
`, [etablissement_id]);

const escaladeVers = directeurs.length > 0 ? directeurs[0].id : null;

await pool.query(`
UPDATE factures SET
statut = 'escaladee',
escalade_par = $1,
escalade_le = NOW(),
escalade_vers = $2,
updated_at = NOW()
WHERE id = $3 AND etablissement_id = $4
`, [userId, escaladeVers, req.params.id, etablissement_id]);

// Journal
await pool.query(`
INSERT INTO journal_activite (etablissement_id, utilisateur_id, action, entite_type, entite_id)
VALUES ($1, $2, 'facture_escaladee', 'facture', $3)
`, [etablissement_id, userId, req.params.id]);

res.json({ success: true, message: 'Facture escaladée' });

} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

module.exports = router;
