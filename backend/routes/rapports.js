const express = require('express');
const router = express.Router();
const { pool } = require('../server');
const auth = require('../middleware/auth');

// ============================================
// GET — Liste des rapports
// ============================================
router.get('/', auth, async (req, res) => {
try {
const { etablissement_id } = req.utilisateur;
const { rows } = await pool.query(`
SELECT r.*, u.nom as genere_par_nom, u.prenom as genere_par_prenom
FROM rapports r
LEFT JOIN utilisateurs u ON u.id = r.genere_par
WHERE r.etablissement_id = $1
ORDER BY r.created_at DESC
LIMIT 50
`, [etablissement_id]);

res.json({ success: true, donnees: rows });

} catch (err) {
console.error('❌ Erreur get rapports:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// POST — Générer un rapport
// ============================================
router.post('/generer', auth, async (req, res) => {
try {
const { etablissement_id, id: userId } = req.utilisateur;
const { periode } = req.body;

const maintenant = new Date();
let debutPeriode, finPeriode;

if (periode === 'mois') {
debutPeriode = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
finPeriode = new Date(maintenant.getFullYear(), maintenant.getMonth() + 1, 0);
} else if (periode === 'trimestre') {
const trimestre = Math.floor(maintenant.getMonth() / 3);
debutPeriode = new Date(maintenant.getFullYear(), trimestre * 3, 1);
finPeriode = new Date(maintenant.getFullYear(), trimestre * 3 + 3, 0);
} else {
debutPeriode = new Date(maintenant.getFullYear(), 0, 1);
finPeriode = new Date(maintenant.getFullYear(), 11, 31);
}

// Récupérer les stats
const { rows: stats } = await pool.query(`
SELECT
COUNT(*) as nb_factures,
COALESCE(SUM(montant_ttc), 0) as total_ttc,
COALESCE(SUM(montant_ht), 0) as total_ht,
COUNT(CASE WHEN verification_statut = 'alerte_rouge' THEN 1 END) as nb_alertes_rouge,
COUNT(CASE WHEN verification_statut = 'attention' THEN 1 END) as nb_alertes_attention,
COUNT(CASE WHEN statut = 'validee' THEN 1 END) as nb_validees,
COUNT(CASE WHEN statut = 'rejetee' THEN 1 END) as nb_rejetees
FROM factures
WHERE etablissement_id = $1
AND created_at BETWEEN $2 AND $3
`, [etablissement_id, debutPeriode, finPeriode]);

// Alertes par type
const { rows: alertesStats } = await pool.query(`
SELECT type_alerte, COUNT(*) as count
FROM alertes
WHERE etablissement_id = $1
AND created_at BETWEEN $2 AND $3
GROUP BY type_alerte
`, [etablissement_id, debutPeriode, finPeriode]);

// Top fournisseurs
const { rows: topFournisseurs } = await pool.query(`
SELECT fo.nom, COUNT(f.id) as nb_factures, COALESCE(SUM(f.montant_ttc), 0) as total
FROM factures f
JOIN fournisseurs fo ON fo.id = f.fournisseur_id
WHERE f.etablissement_id = $1
AND f.created_at BETWEEN $2 AND $3
GROUP BY fo.nom
ORDER BY total DESC
LIMIT 5
`, [etablissement_id, debutPeriode, finPeriode]);

const donnees = {
...stats[0],
alertes_par_type: alertesStats,
top_fournisseurs: topFournisseurs,
periode,
debut: debutPeriode,
fin: finPeriode
};

// Sauvegarder le rapport
const { rows } = await pool.query(`
INSERT INTO rapports (etablissement_id, type_rapport, periode_debut, periode_fin, donnees, genere_par)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id
`, [etablissement_id, periode, debutPeriode, finPeriode, JSON.stringify(donnees), userId]);

// Journal
await pool.query(`
INSERT INTO journal_activite (etablissement_id, utilisateur_id, action, entite_type, entite_id)
VALUES ($1, $2, 'rapport_genere', 'rapport', $3)
`, [etablissement_id, userId, rows[0].id]);

res.status(201).json({
success: true,
message: 'Rapport généré',
rapport_id: rows[0].id,
donnees
});

} catch (err) {
console.error('❌ Erreur génération rapport:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// GET — Exporter un rapport
// ============================================
router.get('/:id/export', auth, async (req, res) => {
try {
const { etablissement_id } = req.utilisateur;
const { format = 'pdf' } = req.query;

const { rows } = await pool.query(`
SELECT * FROM rapports
WHERE id = $1 AND etablissement_id = $2
`, [req.params.id, etablissement_id]);

if (rows.length === 0) {
return res.status(404).json({ success: false, message: 'Rapport non trouvé' });
}

const rapport = rows[0];
const donnees = rapport.donnees;

if (format === 'pdf') {
// Génération PDF simple
const contenuPDF = `
RAPPORT FACTURASECURE
=====================
Période : ${new Date(rapport.periode_debut).toLocaleDateString('fr-FR')} - ${new Date(rapport.periode_fin).toLocaleDateString('fr-FR')}
Type : ${rapport.type_rapport}
Généré le : ${new Date(rapport.genere_le).toLocaleDateString('fr-FR')}

RÉSUMÉ
------
Nombre de factures : ${donnees.nb_factures || 0}
Total HT : ${parseFloat(donnees.total_ht || 0).toLocaleString('fr-FR')}€
Total TTC : ${parseFloat(donnees.total_ttc || 0).toLocaleString('fr-FR')}€
Alertes rouges : ${donnees.nb_alertes_rouge || 0}
Alertes attention : ${donnees.nb_alertes_attention || 0}
Factures validées : ${donnees.nb_validees || 0}
Factures rejetées : ${donnees.nb_rejetees || 0}
`;

res.setHeader('Content-Type', 'text/plain');
res.setHeader('Content-Disposition', `attachment; filename=rapport_${rapport.id}.txt`);
return res.send(contenuPDF);
}

if (format === 'xlsx') {
// Export CSV simple
const csv = [
'Métrique,Valeur',
`Nombre de factures,${donnees.nb_factures || 0}`,
`Total HT,${donnees.total_ht || 0}`,
`Total TTC,${donnees.total_ttc || 0}`,
`Alertes rouges,${donnees.nb_alertes_rouge || 0}`,
`Alertes attention,${donnees.nb_alertes_attention || 0}`,
`Factures validées,${donnees.nb_validees || 0}`,
`Factures rejetées,${donnees.nb_rejetees || 0}`
].join('\n');

res.setHeader('Content-Type', 'text/csv');
res.setHeader('Content-Disposition', `attachment; filename=rapport_${rapport.id}.csv`);
return res.send(csv);
}

res.status(400).json({ success: false, message: 'Format non supporté' });

} catch (err) {
console.error('❌ Erreur export rapport:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

module.exports = router;
