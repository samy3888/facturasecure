const express = require('express');
const router = express.Router();
const { pool } = require('../server');
const auth = require('../middleware/auth');

// ============================================
// GET — Mon établissement
// ============================================
router.get('/moi', auth, async (req, res) => {
try {
const { etablissement_id } = req.utilisateur;
const { rows } = await pool.query(`
SELECT * FROM etablissements WHERE id = $1
`, [etablissement_id]);

if (rows.length === 0) {
return res.status(404).json({ success: false, message: 'Établissement non trouvé' });
}

res.json({ success: true, donnees: rows[0] });

} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// PUT — Modifier mon établissement
// ============================================
router.put('/moi', auth, async (req, res) => {
try {
const { etablissement_id, id: userId } = req.utilisateur;
const {
nom_etablissement, siret, email_contact,
telephone, adresse, code_postal, ville
} = req.body;

const { rows } = await pool.query(`
UPDATE etablissements SET
nom = $1, siret = $2, email_contact = $3,
telephone = $4, adresse = $5, code_postal = $6, ville = $7,
updated_at = NOW()
WHERE id = $8
RETURNING *
`, [
nom_etablissement, siret, email_contact,
telephone, adresse, code_postal, ville,
etablissement_id
]);

// Journal
await pool.query(`
INSERT INTO journal_activite (etablissement_id, utilisateur_id, action, entite_type, entite_id)
VALUES ($1, $2, 'etablissement_modifie', 'etablissement', $3)
`, [etablissement_id, userId, etablissement_id]);

res.json({ success: true, message: 'Établissement mis à jour', donnees: rows[0] });

} catch (err) {
console.error('❌ Erreur update établissement:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// PUT — Configuration IMAP
// ============================================
router.put('/imap', auth, async (req, res) => {
try {
const { etablissement_id, id: userId } = req.utilisateur;
const { email_imap, imap_host, imap_port, imap_password, imap_actif } = req.body;

// En production : chiffrer le mot de passe
const { rows } = await pool.query(`
UPDATE etablissements SET
email_imap = $1,
imap_host = $2,
imap_port = $3,
imap_password_encrypted = $4,
imap_actif = $5,
updated_at = NOW()
WHERE id = $6
RETURNING id, email_imap, imap_host, imap_port, imap_actif
`, [
email_imap, imap_host, imap_port || 993,
imap_password, imap_actif, etablissement_id
]);

// Journal
await pool.query(`
INSERT INTO journal_activite (etablissement_id, utilisateur_id, action, entite_type, entite_id)
VALUES ($1, $2, 'imap_configure', 'etablissement', $3)
`, [etablissement_id, userId, etablissement_id]);

res.json({ success: true, message: 'Configuration IMAP sauvegardée', donnees: rows[0] });

} catch (err) {
console.error('❌ Erreur config IMAP:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// GET — Statistiques établissement
// ============================================
router.get('/stats', auth, async (req, res) => {
try {
const { etablissement_id } = req.utilisateur;

const { rows: statsFactures } = await pool.query(`
SELECT
COUNT(*) as total_factures,
COALESCE(SUM(montant_ttc), 0) as total_ttc,
COUNT(CASE WHEN statut = 'validee' THEN 1 END) as validees,
COUNT(CASE WHEN statut = 'rejetee' THEN 1 END) as rejetees,
COUNT(CASE WHEN verification_statut = 'alerte_rouge' THEN 1 END) as alertes_rouge
FROM factures
WHERE etablissement_id = $1
`, [etablissement_id]);

const { rows: statsFournisseurs } = await pool.query(`
SELECT COUNT(*) as total
FROM fournisseurs
WHERE etablissement_id = $1 AND actif = TRUE
`, [etablissement_id]);

res.json({
success: true,
donnees: {
...statsFactures[0],
total_fournisseurs: parseInt(statsFournisseurs[0].total)
}
});

} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

module.exports = router;
