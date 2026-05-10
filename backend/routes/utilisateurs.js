const express = require('express');
const router = express.Router();
const { pool } = require('../server');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ============================================
// GET — Liste des utilisateurs
// ============================================
router.get('/', auth, async (req, res) => {
try {
const { etablissement_id } = req.utilisateur;
const { rows } = await pool.query(`
SELECT id, nom, prenom, email, role, actif, derniere_connexion, created_at
FROM utilisateurs
WHERE etablissement_id = $1
ORDER BY created_at ASC
`, [etablissement_id]);

res.json({ success: true, donnees: rows });

} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// PUT — Modifier son profil
// ============================================
router.put('/profil', auth, async (req, res) => {
try {
const { id: userId, etablissement_id } = req.utilisateur;
const { nom, prenom, email, mot_de_passe_actuel, nouveau_mot_de_passe } = req.body;

// Récupérer utilisateur actuel
const { rows: users } = await pool.query(
'SELECT * FROM utilisateurs WHERE id = $1', [userId]
);
if (users.length === 0) {
return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
}

const utilisateur = users[0];

// Si changement mot de passe
let nouveauHash = utilisateur.mot_de_passe_hash;
if (nouveau_mot_de_passe && mot_de_passe_actuel) {
const valide = await bcrypt.compare(mot_de_passe_actuel, utilisateur.mot_de_passe_hash);
if (!valide) {
return res.status(400).json({ success: false, message: 'Mot de passe actuel incorrect' });
}
nouveauHash = await bcrypt.hash(nouveau_mot_de_passe, 12);
}

// Mettre à jour
const { rows } = await pool.query(`
UPDATE utilisateurs SET
nom = $1, prenom = $2, email = $3,
mot_de_passe_hash = $4, updated_at = NOW()
WHERE id = $5
RETURNING id, nom, prenom, email, role
`, [nom, prenom, email, nouveauHash, userId]);

// Journal
await pool.query(`
INSERT INTO journal_activite (etablissement_id, utilisateur_id, action, entite_type, entite_id)
VALUES ($1, $2, 'profil_modifie', 'utilisateur', $3)
`, [etablissement_id, userId, userId]);

res.json({ success: true, message: 'Profil mis à jour', donnees: rows[0] });

} catch (err) {
console.error('❌ Erreur update profil:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// POST — Inviter un utilisateur
// ============================================
router.post('/inviter', auth, async (req, res) => {
try {
const { etablissement_id, id: userId, role } = req.utilisateur;
const { email, role: roleInvite } = req.body;

// Vérifier droits
if (!['directeur_financier', 'directeur', 'admin_it'].includes(role)) {
return res.status(403).json({ success: false, message: 'Droits insuffisants' });
}

// Vérifier si email déjà utilisé
const { rows: existing } = await pool.query(
'SELECT id FROM utilisateurs WHERE email = $1', [email]
);
if (existing.length > 0) {
return res.status(400).json({ success: false, message: 'Email déjà utilisé' });
}

// Créer token invitation
const token = crypto.randomBytes(32).toString('hex');
const expiration = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

await pool.query(`
INSERT INTO invitations (etablissement_id, email, role, token, expires_at, invite_par)
VALUES ($1, $2, $3, $4, $5, $6)
`, [etablissement_id, email, roleInvite, token, expiration, userId]);

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
host: process.env.SMTP_HOST,
port: process.env.SMTP_PORT,
secure: false,
auth: {
user: process.env.SMTP_USER,
pass: process.env.SMTP_PASSWORD
}
});

await transporter.sendMail({
from: `"FacturaSecure" <${process.env.SMTP_USER}>`,
to: email,
subject: 'Invitation FacturaSecure',
html: `
<div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto;">
<div style="background: #0a0f1e; padding: 40px; border-radius: 12px;">
<h1 style="color: #ffffff; font-size: 24px;">🛡️ FacturaSecure</h1>
<p style="color: #9ca3af; font-size: 16px;">Vous avez été invité à rejoindre FacturaSecure.</p>
<p style="color: #9ca3af;">Votre rôle : <strong style="color: #00B4D8;">${roleInvite}</strong></p>
<a href="${process.env.FRONTEND_URL}/register?token=${token}"
style="display: inline-block; background: #00B4D8; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px;">
Créer mon compte
</a>
<p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Ce lien expire dans 7 jours.</p>
</div>
</div>
`
});


// Journal
await pool.query(`
INSERT INTO journal_activite (etablissement_id, utilisateur_id, action, entite_type, entite_id, details)
VALUES ($1, $2, 'invitation_envoyee', 'utilisateur', $3, $4)
`, [etablissement_id, userId, userId, JSON.stringify({ email, role: roleInvite })]);

res.status(201).json({
success: true,
message: `Invitation envoyée à ${email}`,
token // En prod, ne pas retourner le token
});

} catch (err) {
console.error('❌ Erreur invitation:', err.message);
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// PUT — Désactiver un utilisateur
// ============================================
router.put('/:id/desactiver', auth, async (req, res) => {
try {
const { etablissement_id, id: userId, role } = req.utilisateur;

// Vérifier droits
if (!['directeur_financier', 'directeur', 'admin_it'].includes(role)) {
return res.status(403).json({ success: false, message: 'Droits insuffisants' });
}

// Ne pas se désactiver soi-même
if (req.params.id === userId) {
return res.status(400).json({ success: false, message: 'Impossible de se désactiver soi-même' });
}

await pool.query(`
UPDATE utilisateurs SET actif = FALSE, updated_at = NOW()
WHERE id = $1 AND etablissement_id = $2
`, [req.params.id, etablissement_id]);

// Journal
await pool.query(`
INSERT INTO journal_activite (etablissement_id, utilisateur_id, action, entite_type, entite_id)
VALUES ($1, $2, 'utilisateur_desactive', 'utilisateur', $3)
`, [etablissement_id, userId, req.params.id]);

res.json({ success: true, message: 'Utilisateur désactivé' });

} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

// ============================================
// GET — Journal d'activité
// ============================================
router.get('/journal', auth, async (req, res) => {
try {
const { etablissement_id } = req.utilisateur;
const { rows } = await pool.query(`
SELECT j.*, u.nom, u.prenom, u.email
FROM journal_activite j
LEFT JOIN utilisateurs u ON u.id = j.utilisateur_id
WHERE j.etablissement_id = $1
ORDER BY j.created_at DESC
LIMIT 100
`, [etablissement_id]);

res.json({ success: true, donnees: rows });

} catch (err) {
res.status(500).json({ success: false, message: 'Erreur serveur' });
}
});

module.exports = router;
