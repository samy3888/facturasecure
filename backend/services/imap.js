const Imap = require('imap');
const { simpleParser } = require('mailparser');
const fs = require('fs');
const path = require('path');
const { pool } = require('../server');
const { lireFichier } = require('./ocr');

// ============================================
// CONNEXION IMAP — Un établissement
// ============================================
async function connecterIMAP(etablissement) {
return new Promise((resolve, reject) => {
const imap = new Imap({
user: etablissement.email_imap,
password: etablissement.imap_password_decrypte,
host: etablissement.imap_host,
port: etablissement.imap_port || 993,
tls: true,
tlsOptions: { rejectUnauthorized: false },
authTimeout: 10000
});

imap.once('ready', () => {
console.log(`✅ IMAP connecté pour ${etablissement.email_imap}`);
resolve(imap);
});

imap.once('error', (err) => {
console.error(`❌ Erreur IMAP ${etablissement.email_imap}:`, err.message);
reject(err);
});

imap.connect();
});
}

// ============================================
// LIRE LES NOUVEAUX EMAILS
// ============================================
async function lireNouveauxEmails(etablissement) {
let imap;
try {
imap = await connecterIMAP(etablissement);

const emails = await new Promise((resolve, reject) => {
imap.openBox('INBOX', false, (err, box) => {
if (err) return reject(err);

// Chercher emails non lus
imap.search(['UNSEEN'], (err, uids) => {
if (err) return reject(err);
if (!uids || uids.length === 0) {
console.log('📭 Aucun nouvel email');
return resolve([]);
}

console.log(`📬 ${uids.length} nouveaux emails trouvés`);
const emails = [];
const fetch = imap.fetch(uids, { bodies: '', markSeen: true });

fetch.on('message', (msg) => {
const emailData = { uid: null, buffer: '' };

msg.on('attributes', (attrs) => {
emailData.uid = attrs.uid;
});

msg.on('body', (stream) => {
let buffer = '';
stream.on('data', (chunk) => { buffer += chunk.toString('utf8'); });
stream.once('end', () => { emailData.buffer = buffer; });
});

msg.once('end', () => { emails.push(emailData); });
});

fetch.once('error', reject);
fetch.once('end', () => resolve(emails));
});
});
});

// Traiter chaque email
for (const emailData of emails) {
await traiterEmail(emailData, etablissement);
}

imap.end();
return { success: true, nb_traites: emails.length };

} catch (err) {
console.error('❌ Erreur lecture IMAP:', err.message);
if (imap) imap.end();
return { success: false, message: err.message };
}
}

// ============================================
// TRAITER UN EMAIL
// ============================================
async function traiterEmail(emailData, etablissement) {
try {
const parsed = await simpleParser(emailData.buffer);

console.log(`📧 Email de: ${parsed.from?.text} — Sujet: ${parsed.subject}`);

// Vérifier si l'email contient des pièces jointes PDF
const piecesPDF = (parsed.attachments || []).filter(att =>
att.contentType === 'application/pdf' ||
att.filename?.toLowerCase().endsWith('.pdf')
);

if (piecesPDF.length === 0) {
console.log('⏭️ Pas de PDF dans cet email, ignoré');
return;
}

console.log(`📎 ${piecesPDF.length} PDF(s) trouvé(s)`);

// Traiter chaque PDF
for (const pdf of piecesPDF) {
await traiterPDF(pdf, parsed, etablissement);
}

} catch (err) {
console.error('❌ Erreur traitement email:', err.message);
}
}

// ============================================
// TRAITER UN PDF
// ============================================
async function traiterPDF(pdf, emailParsed, etablissement) {
try {
const nomFichier = pdf.filename || `facture_${Date.now()}.pdf`;
const cheminTemp = path.join('/tmp', `${Date.now()}_${nomFichier}`);

// Sauvegarder le PDF temporairement
fs.writeFileSync(cheminTemp, pdf.content);
console.log(`💾 PDF sauvegardé: ${cheminTemp}`);

// Lancer l'OCR
const resultOCR = await lireFichier(cheminTemp);

// Supprimer le fichier temporaire
fs.unlinkSync(cheminTemp);

if (!resultOCR.success) {
console.error('❌ OCR échoué pour:', nomFichier);
return;
}

const donnees = resultOCR.donnees;

// Chercher le fournisseur correspondant
const fournisseur = await trouverFournisseur(donnees, etablissement.id);

// Vérifier si doublon
const estDoublon = await verifierDoublon(
donnees.numero_facture,
donnees.montant_ttc,
etablissement.id
);

if (estDoublon) {
console.log(`⚠️ Doublon détecté: ${donnees.numero_facture}`);
}

// Créer la facture en base
const { rows } = await pool.query(`
INSERT INTO factures (
etablissement_id, fournisseur_id,
numero_facture, date_facture, date_echeance,
montant_ht, montant_ttc, taux_tva,
iban_facture, source,
email_expediteur, email_sujet,
pdf_nom_original, ocr_brut, ocr_lignes,
ocr_statut, statut, verification_statut
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
RETURNING id
`, [
etablissement.id,
fournisseur?.id || null,
donnees.numero_facture,
donnees.date_facture,
donnees.date_echeance,
donnees.montant_ht,
donnees.montant_ttc,
donnees.taux_tva,
donnees.iban,
'email',
emailParsed.from?.text,
emailParsed.subject,
nomFichier,
JSON.stringify(resultOCR.texte_brut),
JSON.stringify(donnees.lignes),
'ok',
'en_attente',
'en_attente'
]);

const factureId = rows[0].id;
console.log(`✅ Facture créée: ${factureId}`);

// Lancer la vérification automatique
const { verifierFacture } = require('./verification');
await verifierFacture(factureId, etablissement.id);

} catch (err) {
console.error('❌ Erreur traitement PDF:', err.message);
}
}

// ============================================
// TROUVER LE FOURNISSEUR
// ============================================
async function trouverFournisseur(donnees, etablissementId) {
try {
// Chercher par IBAN d'abord
if (donnees.iban) {
const { rows } = await pool.query(`
SELECT * FROM fournisseurs
WHERE etablissement_id = $1 AND iban_reference = $2 AND actif = TRUE
LIMIT 1
`, [etablissementId, donnees.iban]);
if (rows.length > 0) return rows[0];
}

// Chercher par SIRET
if (donnees.siret) {
const { rows } = await pool.query(`
SELECT * FROM fournisseurs
WHERE etablissement_id = $1 AND siret = $2 AND actif = TRUE
LIMIT 1
`, [etablissementId, donnees.siret]);
if (rows.length > 0) return rows[0];
}

return null;
} catch (err) {
console.error('❌ Erreur recherche fournisseur:', err.message);
return null;
}
}

// ============================================
// VÉRIFIER DOUBLON
// ============================================
async function verifierDoublon(numeroFacture, montantTTC, etablissementId) {
if (!numeroFacture) return false;
try {
const { rows } = await pool.query(`
SELECT id FROM factures
WHERE etablissement_id = $1
AND numero_facture = $2
AND montant_ttc = $3
LIMIT 1
`, [etablissementId, numeroFacture, montantTTC]);
return rows.length > 0;
} catch (err) {
return false;
}
}

// ============================================
// LANCER IMAP POUR TOUS LES ÉTABLISSEMENTS
// ============================================
async function verifierTousLesEmails() {
try {
const { rows: etablissements } = await pool.query(`
SELECT * FROM etablissements
WHERE imap_actif = TRUE
AND statut_abonnement IN ('essai', 'actif')
`);

console.log(`📨 Vérification emails pour ${etablissements.length} établissement(s)`);

for (const etab of etablissements) {
await lireNouveauxEmails(etab);
}

} catch (err) {
console.error('❌ Erreur vérification emails:', err.message);
}
}

// ============================================
// EXPORT
// ============================================
module.exports = { lireNouveauxEmails, verifierTousLesEmails };
