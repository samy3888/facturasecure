const jwt = require('jsonwebtoken');
const { pool } = require('../server');

module.exports = async (req, res, next) => {
try {
// Récupérer le token
const authHeader = req.headers.authorization;
if (!authHeader || !authHeader.startsWith('Bearer ')) {
return res.status(401).json({ success: false, message: 'Token manquant' });
}

const token = authHeader.split(' ')[1];

// Vérifier le token
const decoded = jwt.verify(token, process.env.JWT_SECRET);

// Vérifier que l'utilisateur existe et est actif
const { rows } = await pool.query(`
SELECT u.id, u.nom, u.prenom, u.email, u.role, u.etablissement_id, u.actif,
e.statut_abonnement
FROM utilisateurs u
JOIN etablissements e ON e.id = u.etablissement_id
WHERE u.id = $1 AND u.actif = TRUE
`, [decoded.id]);

if (rows.length === 0) {
return res.status(401).json({ success: false, message: 'Utilisateur non autorisé' });
}

const utilisateur = rows[0];

// Vérifier abonnement
if (utilisateur.statut_abonnement === 'suspendu') {
return res.status(403).json({
success: false,
message: 'Abonnement suspendu. Contactez support@facturasecure.fr'
});
}

// Attacher l'utilisateur à la requête
req.utilisateur = utilisateur;
next();

} catch (err) {
if (err.name === 'TokenExpiredError') {
return res.status(401).json({ success: false, message: 'Token expiré' });
}
return res.status(401).json({ success: false, message: 'Token invalide' });
}
};
