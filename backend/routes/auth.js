const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../server');

// ============================================
// INSCRIPTION
// ============================================
router.post('/register', async (req, res) => {
try {
const {
nom, prenom, email, mot_de_passe,
nom_etablissement, siret, type_etablissement
} = req.body;

// Vérifier si email existe déjà
const { rows: existing } = await pool.query(
'SELECT id FROM utilisateurs WHERE email = $1', [email]
);
if (existing.length > 0) {
return res.status(400).json({ success: false, message: 'Email déjà utilisé' });
}

// Créer l'établissement
const { rows: etabs } = await pool.query(`
INSERT INTO etablissements (nom, siret, type_etablissement, email_contact)
VALUES ($1, $2, $3, $4) RETURNING id
`, [nom_etablissement, siret, type_etablissement, email]);

const etablissementId = etabs[0].id;

// Hasher le mot de passe
const hash = await bcrypt.hash(mot_de_passe, 12);

// Créer l'utilisateur
const { rows: users } = await pool.query(`
INSERT INTO utilisateurs (etablissement_id, nom, prenom, email, mot_de_passe_hash, role)
VALUES ($1, $2, $3, $4, $5, 'comptable') RETURNING id, nom, prenom, email, role
`, [etablissementId, nom, prenom, email, hash]);

const utilisateur = users[0];

// Générer le token
const token = jwt.sign(
{ id: utilisateur.id, etablissement_id: etablissementId, role: utilisateur.role },
process.env.JWT_SECRET,
{ expiresIn: process.env.JWT_EXPIRES_IN }
);

res.status(201).json({
success: true,
message: 'Compte créé avec succès',
token,
utilisateur: { ...utilisateur, etablissement_id: etablissementId }
});

} catch (err) {
console.error('❌ Erreur register:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// CONNEXION
// ============================================
router.post('/login', async (req, res) => {
try {
const { email, mot_de_passe } = req.body;

// Chercher l'utilisateur
const { rows } = await pool.query(`
SELECT u.*, e.statut_abonnement, e.nom as nom_etablissement
FROM utilisateurs u
JOIN etablissements e ON e.id = u.etablissement_id
WHERE u.email = $1 AND u.actif = TRUE
`, [email]);

if (rows.length === 0) {
return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
}

const utilisateur = rows[0];

// Vérifier le mot de passe
const valide = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe_hash);
if (!valide) {
return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect' });
}

// Vérifier statut abonnement
if (utilisateur.statut_abonnement === 'suspendu') {
return res.status(403).json({
success: false,
message: 'Votre abonnement est suspendu. Contactez support@facturasecure.fr'
});
}

// Mettre à jour dernière connexion
await pool.query(
'UPDATE utilisateurs SET derniere_connexion = NOW() WHERE id = $1',
[utilisateur.id]
);

// Générer token
const token = jwt.sign(
{ id: utilisateur.id, etablissement_id: utilisateur.etablissement_id, role: utilisateur.role },
process.env.JWT_SECRET,
{ expiresIn: process.env.JWT_EXPIRES_IN }
);

res.json({
success: true,
message: 'Connexion réussie',
token,
utilisateur: {
id: utilisateur.id,
nom: utilisateur.nom,
prenom: utilisateur.prenom,
email: utilisateur.email,
role: utilisateur.role,
etablissement_id: utilisateur.etablissement_id,
nom_etablissement: utilisateur.nom_etablissement
}
});

} catch (err) {
console.error('❌ Erreur login:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// VÉRIFIER TOKEN
// ============================================
router.get('/me', async (req, res) => {
try {
const token = req.headers.authorization?.split(' ')[1];
if (!token) return res.status(401).json({ success: false, message: 'Token manquant' });

const decoded = jwt.verify(token, process.env.JWT_SECRET);

const { rows } = await pool.query(`
SELECT u.id, u.nom, u.prenom, u.email, u.role, u.etablissement_id,
e.nom as nom_etablissement, e.statut_abonnement
FROM utilisateurs u
JOIN etablissements e ON e.id = u.etablissement_id
WHERE u.id = $1 AND u.actif = TRUE
`, [decoded.id]);

if (rows.length === 0) {
return res.status(401).json({ success: false, message: 'Utilisateur non trouvé' });
}

res.json({ success: true, utilisateur: rows[0] });

} catch (err) {
res.status(401).json({ success: false, message: 'Token invalide' });
}
});
// ============================================
// VÉRIFIER TOKEN INVITATION
// ============================================
router.get('/invitation/:token', async (req, res) => {
try {
const { rows } = await pool.query(`
SELECT * FROM invitations
WHERE token = $1
AND expires_at > NOW()
AND utilise = FALSE
`, [req.params.token]);

if (rows.length === 0) {
return res.status(404).json({ success: false, message: 'Invitation expirée ou invalide' });
}

res.json({ success: true, invitation: rows[0] });

} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// CRÉER COMPTE VIA INVITATION
// ============================================
router.post('/register-invitation', async (req, res) => {
try {
const { token, prenom, nom, mot_de_passe } = req.body;

// Vérifier le token
const { rows: invitations } = await pool.query(`
SELECT * FROM invitations
WHERE token = $1
AND expires_at > NOW()
AND utilise = FALSE
`, [token]);

if (invitations.length === 0) {
return res.status(400).json({ success: false, message: 'Invitation expirée ou invalide' });
}

const invitation = invitations[0];

// Vérifier si email déjà utilisé
const { rows: existing } = await pool.query(
'SELECT id FROM utilisateurs WHERE email = $1', [invitation.email]
);
if (existing.length > 0) {
return res.status(400).json({ success: false, message: 'Email déjà utilisé' });
}

// Hasher le mot de passe
const hash = await bcrypt.hash(mot_de_passe, 12);

// Créer l'utilisateur
const { rows: users } = await pool.query(`
INSERT INTO utilisateurs (etablissement_id, nom, prenom, email, mot_de_passe_hash, role)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, nom, prenom, email, role, etablissement_id
`, [invitation.etablissement_id, nom, prenom, invitation.email, hash, invitation.role]);

const utilisateur = users[0];

// Marquer l'invitation comme utilisée
await pool.query(`
UPDATE invitations SET utilise = TRUE WHERE token = $1
`, [token]);

// Générer le token JWT
const jwtToken = jwt.sign(
{ id: utilisateur.id, etablissement_id: utilisateur.etablissement_id, role: utilisateur.role },
process.env.JWT_SECRET,
{ expiresIn: process.env.JWT_EXPIRES_IN }
);

res.status(201).json({
success: true,
message: 'Compte créé avec succès',
token: jwtToken,
utilisateur
});

} catch (err) {
console.error('❌ Erreur register-invitation:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

module.exports = router;
