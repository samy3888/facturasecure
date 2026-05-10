const axios = require('axios');
const fs = require('fs');
const path = require('path');

const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY;
const VISION_API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;

// ============================================
// FONCTION PRINCIPALE — Lire un PDF/Image
// ============================================
async function lireFichier(cheminFichier) {
try {
console.log('🔍 OCR en cours pour:', cheminFichier);

// Lire le fichier et le convertir en base64
const fileContent = fs.readFileSync(cheminFichier);
const base64Content = fileContent.toString('base64');

// Appel à l'API Google Vision
const response = await axios.post(VISION_API_URL, {
requests: [{
image: { content: base64Content },
features: [{ type: 'TEXT_DETECTION', maxResults: 1 }]
}]
});

const texteComplet = response.data.responses[0]?.fullTextAnnotation?.text || '';

if (!texteComplet) {
return { success: false, message: 'Aucun texte détecté', donnees: null };
}

const donnees = extraireDonnees(texteComplet);

console.log('✅ OCR terminé');
return { success: true, texte_brut: texteComplet, donnees };

} catch (err) {
console.error('❌ Erreur OCR:', err.message);
return { success: false, message: err.message, donnees: null };
}
}

// ============================================
// EXTRACTION DES DONNÉES CLÉS
// ============================================
function extraireDonnees(texte) {
return {
numero_facture: extraireNumeroFacture(texte),
date_facture: extraireDate(texte),
date_echeance: extraireDateEcheance(texte),
montant_ht: extraireMontantHT(texte),
montant_ttc: extraireMontantTTC(texte),
taux_tva: extraireTVA(texte),
iban: extraireIBAN(texte),
bic: extraireBIC(texte),
fournisseur: extraireNomFournisseur(texte),
siret: extraireSIRET(texte),
lignes: extraireLignes(texte)
};
}

// ============================================
// EXTRACTEURS INDIVIDUELS
// ============================================

function extraireNumeroFacture(texte) {
const patterns = [
/(?:facture|invoice|fact\.?)\s*[n°#:]*\s*([A-Z0-9\-\/]+)/i,
/n°\s*facture\s*:?\s*([A-Z0-9\-\/]+)/i,
/numéro\s*:?\s*([A-Z0-9\-\/]+)/i,
/FA[\-]?(\d+)/i,
/INV[\-]?(\d+)/i
];
for (const pattern of patterns) {
const match = texte.match(pattern);
if (match) return match[1].trim();
}
return null;
}

function extraireDate(texte) {
const patterns = [
/(?:date\s*(?:de\s*)?facture|date\s*d['']émission)\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
/(?:émise?\s*le|le)\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/
];
for (const pattern of patterns) {
const match = texte.match(pattern);
if (match) return normaliserDate(match[1]);
}
return null;
}

function extraireDateEcheance(texte) {
const patterns = [
/(?:date\s*d['']échéance|échéance|payable\s*(?:le|avant\s*le)|à\s*payer\s*(?:le|avant\s*le))\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
/due\s*date\s*:?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i
];
for (const pattern of patterns) {
const match = texte.match(pattern);
if (match) return normaliserDate(match[1]);
}
return null;
}

function extraireMontantHT(texte) {
const patterns = [
/(?:total\s*HT|montant\s*HT|sous[\-\s]total\s*HT)\s*:?\s*([0-9\s]+[.,]\d{2})\s*€?/i,
/HT\s*:?\s*([0-9\s]+[.,]\d{2})\s*€?/i
];
for (const pattern of patterns) {
const match = texte.match(pattern);
if (match) return parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
}
return null;
}

function extraireMontantTTC(texte) {
const patterns = [
/(?:total\s*TTC|montant\s*TTC|total\s*à\s*payer|net\s*à\s*payer)\s*:?\s*([0-9\s]+[.,]\d{2})\s*€?/i,
/TTC\s*:?\s*([0-9\s]+[.,]\d{2})\s*€?/i,
/total\s*:?\s*([0-9\s]+[.,]\d{2})\s*€/i
];
for (const pattern of patterns) {
const match = texte.match(pattern);
if (match) return parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
}
return null;
}

function extraireTVA(texte) {
const tauxValides = [0, 2.1, 5.5, 10, 20];
const patterns = [
/TVA\s*(?:à)?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/i,
/taux\s*(?:de\s*)?TVA\s*:?\s*(\d{1,2}(?:[.,]\d+)?)\s*%/i
];
for (const pattern of patterns) {
const match = texte.match(pattern);
if (match) return parseFloat(match[1].replace(',', '.'));
}
return 20.0;
}

function extraireIBAN(texte) {
const pattern = /\b(FR\d{2}[\s]?(?:\d{4}[\s]?){4,6}[\d]{1,3})\b/gi;
const matches = texte.match(pattern);
if (matches && matches.length > 0) {
return matches[0].replace(/\s/g, '').toUpperCase();
}
const patternGeneral = /\b([A-Z]{2}\d{2}[A-Z0-9]{4,30})\b/g;
const matchesGen = texte.match(patternGeneral);
if (matchesGen) {
return matchesGen[0].replace(/\s/g, '').toUpperCase();
}
return null;
}

function extraireBIC(texte) {
const pattern = /\b([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/g;
const matches = texte.match(pattern);
if (matches) {
const exclusions = ['FACTURE', 'FRANCE', 'TOTAL'];
const bic = matches.find(m => m.length >= 8 && !exclusions.includes(m));
return bic || null;
}
return null;
}

function extraireNomFournisseur(texte) {
const lignes = texte.split('\n').filter(l => l.trim().length > 2);
return lignes.slice(0, 3).map(l => l.trim()).join(' | ');
}

function extraireSIRET(texte) {
const pattern = /\b(\d{3}[\s]?\d{3}[\s]?\d{3}[\s]?\d{5})\b/;
const match = texte.match(pattern);
if (match) return match[1].replace(/\s/g, '');
return null;
}

function extraireLignes(texte) {
const lignes = [];
const lignesTexte = texte.split('\n');
for (let i = 0; i < lignesTexte.length; i++) {
const ligne = lignesTexte[i].trim();
const montantPattern = /(\d+[.,]\d{2})\s*€?/;
const quantitePattern = /(\d+(?:[.,]\d+)?)\s*(?:x|×|\*)/;
if (montantPattern.test(ligne) && ligne.length > 10) {
const montantMatch = ligne.match(/([0-9\s]+[.,]\d{2})\s*€?\s*$/);
const quantiteMatch = ligne.match(quantitePattern);
lignes.push({
texte_brut: ligne,
designation: extraireDesignation(ligne),
quantite: quantiteMatch ? parseFloat(quantiteMatch[1].replace(',', '.')) : 1,
montant: montantMatch ? parseFloat(montantMatch[1].replace(/\s/g, '').replace(',', '.')) : null
});
}
}
return lignes;
}

function extraireDesignation(ligne) {
return ligne
.replace(/\d+[.,]\d{2}\s*€?/g, '')
.replace(/\d+\s*(?:x|×|\*)\s*/g, '')
.replace(/\s+/g, ' ')
.trim();
}

function normaliserDate(dateStr) {
if (!dateStr) return null;
const match = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
if (match) {
let [, jour, mois, annee] = match;
if (annee.length === 2) annee = '20' + annee;
return `${annee}-${mois.padStart(2, '0')}-${jour.padStart(2, '0')}`;
}
return dateStr;
}

module.exports = { lireFichier, extraireDonnees };
