const express = require('express');
const router = express.Router();
const { pool } = require('../server');
const auth = require('../middleware/auth');

// ============================================
// GET — Liste des alertes
// ============================================
router.get('/', auth, async (req, res) => {
try {
const { etablissement_id } = req.utilisateur;
const { niveau, statut = 'active', limit = 50 } = req.query;

let query = `
SELECT a.*, f.numero_facture, fo.nom as nom_fournisseur
FROM alertes a
LEFT JOIN factures f ON f.id = a.facture_id
LEFT JOIN fournisseurs fo ON fo.id = a.fournisseur_id
WHERE a.etablissement_id = $1
`;
const params = [etablissement_id];

if (niveau && niveau !== 'tous') {
query += ` AND a.niveau = $${params.length + 1}`;
params.push(niveau);
}

if (statut && statut !== 'tous') {
query += ` AND a.statut = $${params.length + 1}`;
params.push(statut);
}

query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1}`;
params.push(limit);

const { rows } = await pool.query(query, params);
res.json({ success: true, donnees: rows });

} catch (err) {
console.error('❌ Erreur get alertes:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// GET — Une alerte
// ============================================
router.get('/:id', auth, async (req, res) => {
try {
const { etablissement_id } = req.utilisateur;
const { rows } = await pool.query(`
SELECT a.*, f.numero_facture, fo.nom as nom_fournisseur
FROM alertes a
LEFT JOIN factures f ON f.id = a.facture_id
LEFT JOIN fournisseurs fo ON fo.id = a.fournisseur_id
WHERE a.id = $1 AND a.etablissement_id = $2
`, [req.params.id, etablissement_id]);

if (rows.length === 0) {
return res.status(404).json({ success: false, message: 'Alerte non trouvée' });
}
res.json({ success: true, donnees: rows[0] });

} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// PUT — Traiter une alerte
// ============================================
router.put('/:id', auth, async (req, res) => {
try {
const { etablissement_id, id: userId } = req.utilisateur;
const { statut } = req.body;

const statutsValides = ['lue', 'traitee', 'ignoree'];
if (!statutsValides.includes(statut)) {
return res.status(400).json({ success: false, message: 'Statut invalide' });
}

const { rows } = await pool.query(`
UPDATE alertes SET
statut = $1,
traitee_par = $2,
traitee_le = NOW(),
updated_at = NOW()
WHERE id = $3 AND etablissement_id = $4
RETURNING id
`, [statut, userId, req.params.id, etablissement_id]);

if (rows.length === 0) {
return res.status(404).json({ success: false, message: 'Alerte non trouvée' });
}

// Journal
await pool.query(`
INSERT INTO journal_activite (etablissement_id, utilisateur_id, action, entite_type, entite_id)
VALUES ($1, $2, $3, 'alerte', $4)
`, [etablissement_id, userId, `alerte_${statut}`, req.params.id]);

res.json({ success: true, message: `Alerte ${statut}` });

} catch (err) {
console.error('❌ Erreur update alerte:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// GET — Notifications non lues
// ============================================
router.get('/notifications/nonlues', auth, async (req, res) => {
try {
const { id: userId, etablissement_id } = req.utilisateur;
const { rows } = await pool.query(`
SELECT * FROM notifications
WHERE utilisateur_id = $1 AND lu = FALSE
ORDER BY created_at DESC
LIMIT 20
`, [userId]);

res.json({ success: true, donnees: rows });

} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// PUT — Marquer notification comme lue
// ============================================
router.put('/notifications/:id/lue', auth, async (req, res) => {
try {
const { id: userId } = req.utilisateur;
await pool.query(`
UPDATE notifications SET lu = TRUE, lu_le = NOW()
WHERE id = $1 AND utilisateur_id = $2
`, [req.params.id, userId]);

res.json({ success: true, message: 'Notification lue' });

} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

module.exports = router;
