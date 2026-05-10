const express = require('express');
const router = express.Router();
const { pool } = require('../server');
const auth = require('../middleware/auth');

// ============================================
// STATS DASHBOARD
// ============================================
router.get('/stats', auth, async (req, res) => {
try {
const { etablissement_id } = req.utilisateur;

// Factures en attente
const { rows: attente } = await pool.query(`
SELECT COUNT(*) as count FROM factures
WHERE etablissement_id = $1 AND statut = 'en_attente'
`, [etablissement_id]);

// Alertes actives
const { rows: alertes } = await pool.query(`
SELECT COUNT(*) as count FROM alertes
WHERE etablissement_id = $1 AND statut = 'active'
`, [etablissement_id]);

// Factures ce mois
const { rows: factureMois } = await pool.query(`
SELECT COUNT(*) as count, COALESCE(SUM(montant_ttc), 0) as total
FROM factures
WHERE etablissement_id = $1
AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())
`, [etablissement_id]);

// Evolution 6 derniers mois
const { rows: evolution } = await pool.query(`
SELECT
TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YY') as mois,
COUNT(*) as nb_factures,
COALESCE(SUM(montant_ttc), 0) as total_ttc
FROM factures
WHERE etablissement_id = $1
AND created_at >= NOW() - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY DATE_TRUNC('month', created_at)
`, [etablissement_id]);

// Stats alertes par type
const { rows: statsAlertes } = await pool.query(`
SELECT type_alerte, COUNT(*) as count
FROM alertes
WHERE etablissement_id = $1
GROUP BY type_alerte
`, [etablissement_id]);

const alertesMap = {};
statsAlertes.forEach(a => { alertesMap[a.type_alerte] = parseInt(a.count); });

res.json({
success: true,
donnees: {
factures_en_attente: parseInt(attente[0].count),
alertes_actives: parseInt(alertes[0].count),
factures_mois: parseInt(factureMois[0].count),
total_ttc_mois: parseFloat(factureMois[0].total),
evolution,
alertes_rib: alertesMap['changement_rib'] || 0,
alertes_doublon: alertesMap['doublon'] || 0,
alertes_prix: alertesMap['augmentation_prix'] || 0,
alertes_fournisseur: alertesMap['fournisseur_inconnu'] || 0,
alertes_ligne: alertesMap['ligne_suspecte'] || 0,
alertes_total: parseInt(alertes[0].count),
economies: (alertesMap['changement_rib'] || 0) * 5000
}
});

} catch (err) {
console.error('❌ Erreur dashboard stats:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

module.exports = router;
