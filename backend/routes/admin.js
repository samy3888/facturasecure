const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: { rejectUnauthorized: false }
});

// Vérification admin
const isAdmin = async (req, res, next) => {
const { email } = req.body;
if (email !== 'samy@test.fr') {
return res.status(403).json({ error: 'Accès refusé' });
}
next();
};

// Liste tous les utilisateurs
router.get('/utilisateurs', async (req, res) => {
try {
const result = await pool.query(
'SELECT id, email, nom, prenom, statut, created_at FROM users ORDER BY created_at DESC'
);
res.json(result.rows);
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// Valider un utilisateur
router.put('/valider/:id', async (req, res) => {
try {
await pool.query('UPDATE users SET statut = $1 WHERE id = $2', ['validé', req.params.id]);
res.json({ message: 'Utilisateur validé' });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// Refuser un utilisateur
router.put('/refuser/:id', async (req, res) => {
try {
await pool.query('UPDATE users SET statut = $1 WHERE id = $2', ['refusé', req.params.id]);
res.json({ message: 'Utilisateur refusé' });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

// Supprimer un utilisateur
router.delete('/supprimer/:id', async (req, res) => {
try {
await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
res.json({ message: 'Utilisateur supprimé' });
} catch (err) {
res.status(500).json({ error: err.message });
}
});

module.exports = router;
