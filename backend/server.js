const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const cron = require('node-cron');

dotenv.config();

const app = express();

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
origin: ['https://facturasecure.netlify.app', 'https://facturasecure.fr', 'https://www.facturasecure.fr', 'http://localhost:3000'],
credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// BASE DE DONNÉES
// ============================================
const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect((err) => {
if (err) {
console.error('❌ Erreur connexion PostgreSQL:', err.message);
} else {
console.log('✅ PostgreSQL connecté');
}
});

// Export pool pour les autres fichiers
module.exports = { pool };

// ============================================
// ROUTES
// ============================================
const authRoutes = require('./routes/auth');
const etablissementRoutes = require('./routes/etablissements');
const fournisseurRoutes = require('./routes/fournisseurs');
const factureRoutes = require('./routes/factures');
const alerteRoutes = require('./routes/alertes');
const rapportRoutes = require('./routes/rapports');
const utilisateurRoutes = require('./routes/utilisateurs');
const dashboardRoutes = require('./routes/dashboard');

app.use('/api/auth', authRoutes);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/etablissements', etablissementRoutes);
app.use('/api/fournisseurs', fournisseurRoutes);
app.use('/api/factures', factureRoutes);
app.use('/api/alertes', alerteRoutes);
app.use('/api/rapports', rapportRoutes);
app.use('/api/utilisateurs', utilisateurRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ============================================
// ROUTE TEST
// ============================================
app.get('/api/health', (req, res) => {
res.json({
status: 'OK',
message: 'FacturaSecure API opérationnelle',
timestamp: new Date().toISOString()
});
});

// ============================================
// TÂCHES AUTOMATIQUES (node-cron)
// ============================================

// Vérifier les essais expirés — chaque jour à minuit
cron.schedule('0 0 * * *', async () => {
console.log('⏰ Vérification essais expirés...');
try {
await pool.query(`
UPDATE etablissements
SET statut_abonnement = 'suspendu'
WHERE statut_abonnement = 'essai'
AND date_fin_essai < NOW()
`);
console.log('✅ Essais expirés mis à jour');
} catch (err) {
console.error('❌ Erreur cron essais:', err.message);
}
});

// Alertes expiration contrats — chaque jour à 8h
cron.schedule('0 8 * * *', async () => {
console.log('⏰ Vérification expiration contrats...');
try {
const { rows } = await pool.query(`
SELECT f.id, f.nom, f.contrat_date_fin, f.etablissement_id,
ac.alerte_60j_envoyee, ac.alerte_30j_envoyee, ac.alerte_7j_envoyee
FROM fournisseurs f
LEFT JOIN alertes_contrats ac ON ac.fournisseur_id = f.id
WHERE f.contrat_date_fin IS NOT NULL
AND f.contrat_date_fin > NOW()
AND f.actif = TRUE
`);

for (const fournisseur of rows) {
const joursRestants = Math.ceil(
(new Date(fournisseur.contrat_date_fin) - new Date()) / (1000 * 60 * 60 * 24)
);

if (joursRestants <= 60 && !fournisseur.alerte_60j_envoyee) {
await creerAlerteContrat(fournisseur, joursRestants, '60j');
} else if (joursRestants <= 30 && !fournisseur.alerte_30j_envoyee) {
await creerAlerteContrat(fournisseur, joursRestants, '30j');
} else if (joursRestants <= 7 && !fournisseur.alerte_7j_envoyee) {
await creerAlerteContrat(fournisseur, joursRestants, '7j');
}
}
console.log('✅ Contrats vérifiés');
} catch (err) {
console.error('❌ Erreur cron contrats:', err.message);
}
});

// Rapport mensuel automatique — 1er du mois à 7h
cron.schedule('0 7 1 * *', async () => {
console.log('⏰ Génération rapports mensuels...');
try {
const { rows: etablissements } = await pool.query(`
SELECT id FROM etablissements
WHERE statut_abonnement IN ('essai', 'actif')
`);

for (const etab of etablissements) {
const maintenant = new Date();
const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1);
const finMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 0);

const { rows: stats } = await pool.query(`
SELECT
COUNT(*) as nb_factures,
SUM(montant_ttc) as total_ttc,
COUNT(CASE WHEN verification_statut = 'alerte_rouge' THEN 1 END) as nb_alertes_rouge,
COUNT(CASE WHEN verification_statut = 'attention' THEN 1 END) as nb_alertes_attention,
COUNT(CASE WHEN statut = 'rejetee' THEN 1 END) as nb_rejetees
FROM factures
WHERE etablissement_id = $1
AND created_at BETWEEN $2 AND $3
`, [etab.id, debutMois, finMois]);

await pool.query(`
INSERT INTO rapports (etablissement_id, type_rapport, periode_debut, periode_fin, donnees)
VALUES ($1, 'mensuel', $2, $3, $4)
`, [etab.id, debutMois, finMois, JSON.stringify(stats[0])]);
}
console.log('✅ Rapports mensuels générés');
} catch (err) {
console.error('❌ Erreur cron rapports:', err.message);
}
});

// ============================================
// FONCTION ALERTE CONTRAT
// ============================================
async function creerAlerteContrat(fournisseur, joursRestants, type) {
try {
await pool.query(`
INSERT INTO alertes (etablissement_id, fournisseur_id, type_alerte, niveau, titre, description)
VALUES ($1, $2, 'expiration_contrat', 'attention', $3, $4)
`, [
fournisseur.etablissement_id,
fournisseur.id,
`Contrat expirant dans ${joursRestants} jours — ${fournisseur.nom}`,
`Le contrat avec ${fournisseur.nom} expire le ${new Date(fournisseur.contrat_date_fin).toLocaleDateString('fr-FR')}. Pensez à le renouveler.`
]);

const colonneAlerte = `alerte_${type}_envoyee`;
await pool.query(`
UPDATE alertes_contrats SET ${colonneAlerte} = TRUE
WHERE fournisseur_id = $1
`, [fournisseur.id]);

console.log(`✅ Alerte contrat ${type} créée pour ${fournisseur.nom}`);
} catch (err) {
console.error('❌ Erreur création alerte contrat:', err.message);
}
}

// ============================================
// GESTION ERREURS GLOBALE
// ============================================
app.use((err, req, res, next) => {
console.error('❌ Erreur serveur:', err.message);
res.status(500).json({
success: false,
message: 'Erreur serveur interne',
error: process.env.NODE_ENV === 'development' ? err.message : undefined
});
});

// Route 404
app.use((req, res) => {
res.status(404).json({ success: false, message: 'Route non trouvée' });
});

// ============================================
// DÉMARRAGE SERVEUR
// ============================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
console.log(`🚀 FacturaSecure API démarrée sur le port ${PORT}`);
console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
});
