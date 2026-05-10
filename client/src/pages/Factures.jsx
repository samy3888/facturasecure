import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function Factures({ utilisateur }) {
const navigate = useNavigate();
const [factures, setFactures] = useState([]);
const [chargement, setChargement] = useState(true);
const [filtreStatut, setFiltreStatut] = useState('tous');
const [factureSelectionnee, setFactureSelectionnee] = useState(null);
const [uploading, setUploading] = useState(false);

useEffect(() => {
chargerFactures();
}, [filtreStatut]);

async function chargerFactures() {
try {
const token = localStorage.getItem('token');
const params = filtreStatut !== 'tous' ? `?statut=${filtreStatut}` : '';
const { data } = await axios.get(`${API}/factures${params}`, {
headers: { Authorization: `Bearer ${token}` }
});
setFactures(data.donnees || []);
} catch (err) {
toast.error('Erreur chargement factures');
} finally {
setChargement(false);
}
}

async function uploadFacture(e) {
const fichier = e.target.files[0];
if (!fichier) return;
setUploading(true);
try {
const token = localStorage.getItem('token');
const formData = new FormData();
formData.append('facture', fichier);
await axios.post(`${API}/factures/upload`, formData, {
headers: {
Authorization: `Bearer ${token}`,
'Content-Type': 'multipart/form-data'
}
});
toast.success('Facture uploadée et analysée !');
chargerFactures();
} catch (err) {
toast.error('Erreur upload facture');
} finally {
setUploading(false);
}
}

async function validerFacture(factureId) {
try {
const token = localStorage.getItem('token');
await axios.post(`${API}/factures/${factureId}/valider`, {}, {
headers: { Authorization: `Bearer ${token}` }
});
toast.success('Facture validée !');
chargerFactures();
setFactureSelectionnee(null);
} catch (err) {
toast.error('Erreur validation');
}
}

async function rejeterFacture(factureId, motif) {
try {
const token = localStorage.getItem('token');
await axios.post(`${API}/factures/${factureId}/rejeter`, { motif }, {
headers: { Authorization: `Bearer ${token}` }
});
toast.success('Facture rejetée');
chargerFactures();
setFactureSelectionnee(null);
} catch (err) {
toast.error('Erreur rejet');
}
}

async function escaladerFacture(factureId) {
try {
const token = localStorage.getItem('token');
await axios.post(`${API}/factures/${factureId}/escalader`, {}, {
headers: { Authorization: `Bearer ${token}` }
});
toast.success('Facture escaladée au directeur financier');
chargerFactures();
setFactureSelectionnee(null);
} catch (err) {
toast.error('Erreur escalade');
}
}

function getResultats(facture) {
if (!facture.verification_resultats) return [];
if (Array.isArray(facture.verification_resultats)) return facture.verification_resultats;
if (typeof facture.verification_resultats === 'string') {
try { return JSON.parse(facture.verification_resultats); } catch { return []; }
}
return [];
}

return (
<div style={{ minHeight: '100vh', backgroundColor: '#0a0f1e', fontFamily: 'Inter, sans-serif' }}>
<Navbar navigate={navigate} />

<div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
<div>
<h1 style={{ color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0' }}>
📋 Factures
</h1>
<p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
{factures.length} facture(s) trouvée(s)
</p>
</div>

<label style={{
backgroundColor: '#00B4D8', color: '#ffffff',
padding: '10px 20px', borderRadius: '8px',
cursor: 'pointer', fontSize: '14px', fontWeight: '600'
}}>
{uploading ? '⏳ Analyse...' : '📤 Uploader une facture'}
<input type="file" accept=".pdf" onChange={uploadFacture} style={{ display: 'none' }} />
</label>
</div>

<div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
{[
{ val: 'tous', label: 'Toutes' },
{ val: 'en_attente', label: '⏳ En attente' },
{ val: 'conforme', label: '✅ Conformes' },
{ val: 'attention', label: '⚠️ Attention' },
{ val: 'alerte_rouge', label: '🚨 Alertes' },
{ val: 'bloquee', label: '🔒 Bloquées' }
].map(f => (
<button key={f.val} onClick={() => setFiltreStatut(f.val)} style={{
padding: '6px 14px', borderRadius: '20px', border: 'none',
cursor: 'pointer', fontSize: '13px', fontWeight: '500',
backgroundColor: filtreStatut === f.val ? '#00B4D8' : '#1f2937',
color: filtreStatut === f.val ? '#ffffff' : '#9ca3af'
}}>
{f.label}
</button>
))}
</div>

<div style={{ display: 'grid', gridTemplateColumns: factureSelectionnee ? '1fr 1fr' : '1fr', gap: '16px' }}>

<div style={carteStyle}>
{chargement ? (
<p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Chargement...</p>
) : factures.length === 0 ? (
<p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Aucune facture trouvée</p>
) : (
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
<thead>
<tr>
{['Numéro', 'Fournisseur', 'Montant TTC', 'Date', 'Statut', 'Action'].map(col => (
<th key={col} style={thStyle}>{col}</th>
))}
</tr>
</thead>
<tbody>
{factures.map(facture => (
<tr key={facture.id} style={{
borderBottom: '1px solid #1f2937', cursor: 'pointer',
backgroundColor: factureSelectionnee?.id === facture.id ? '#1f2937' : 'transparent'
}} onClick={() => setFactureSelectionnee(facture)}>
<td style={tdStyle}>{facture.numero_facture || '—'}</td>
<td style={tdStyle}>{facture.nom_fournisseur || '⚠️ Inconnu'}</td>
<td style={tdStyle}>
{facture.montant_ttc ? `${parseFloat(facture.montant_ttc).toLocaleString('fr-FR')}€` : '—'}
</td>
<td style={tdStyle}>
{facture.date_facture ? new Date(facture.date_facture).toLocaleDateString('fr-FR') : '—'}
</td>
<td style={tdStyle}><Badge statut={facture.verification_statut} /></td>
<td style={tdStyle}>
<button onClick={(e) => { e.stopPropagation(); setFactureSelectionnee(facture); }} style={btnPetitStyle}>
Voir
</button>
</td>
</tr>
))}
</tbody>
</table>
)}
</div>

{factureSelectionnee && (
<div style={carteStyle}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
<h3 style={{ color: '#ffffff', fontSize: '16px', fontWeight: '600', margin: '0' }}>Détail facture</h3>
<button onClick={() => setFactureSelectionnee(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}>✕</button>
</div>

<div style={{ marginBottom: '20px' }}>
{[
{ label: 'Numéro', val: factureSelectionnee.numero_facture },
{ label: 'Fournisseur', val: factureSelectionnee.nom_fournisseur },
{ label: 'Montant HT', val: factureSelectionnee.montant_ht ? `${factureSelectionnee.montant_ht}€` : '—' },
{ label: 'TVA', val: factureSelectionnee.taux_tva ? `${factureSelectionnee.taux_tva}%` : '—' },
{ label: 'Montant TTC', val: factureSelectionnee.montant_ttc ? `${parseFloat(factureSelectionnee.montant_ttc).toLocaleString('fr-FR')}€` : '—' },
{ label: 'IBAN facture', val: factureSelectionnee.iban_facture },
{ label: 'Date facture', val: factureSelectionnee.date_facture ? new Date(factureSelectionnee.date_facture).toLocaleDateString('fr-FR') : '—' },
{ label: 'Échéance', val: factureSelectionnee.date_echeance ? new Date(factureSelectionnee.date_echeance).toLocaleDateString('fr-FR') : '—' },
{ label: 'Source', val: factureSelectionnee.source },
].map(item => (
<div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1f2937' }}>
<span style={{ color: '#6b7280', fontSize: '13px' }}>{item.label}</span>
<span style={{ color: '#ffffff', fontSize: '13px', fontWeight: '500' }}>{String(item.val || '—')}</span>
</div>
))}
</div>

{getResultats(factureSelectionnee).length > 0 && (
<div style={{ marginBottom: '20px' }}>
<h4 style={{ color: '#ffffff', fontSize: '14px', marginBottom: '10px' }}>Résultats de vérification</h4>
{getResultats(factureSelectionnee).map((r, i) => (
<div key={i} style={{
padding: '8px 12px', borderRadius: '6px', marginBottom: '6px',
backgroundColor: r.niveau === 'alerte_rouge' ? '#2d0f0f' : r.niveau === 'attention' ? '#1c1a0f' : '#0f1f15',
borderLeft: `3px solid ${r.niveau === 'alerte_rouge' ? '#ef4444' : r.niveau === 'attention' ? '#FF8C00' : '#00C97A'}`
}}>
<p style={{ color: '#ffffff', fontSize: '12px', fontWeight: '600', margin: '0' }}>
{String(r.titre || '')}
</p>
<p style={{ color: '#9ca3af', fontSize: '11px', margin: '2px 0 0' }}>
{String(r.description || '')}
</p>
</div>
))}
</div>
)}

{(factureSelectionnee.statut === 'en_attente' || factureSelectionnee.statut === 'bloquee') ? (
<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
<button onClick={() => validerFacture(factureSelectionnee.id)} style={{ ...btnActionStyle, backgroundColor: '#00C97A' }}>
✅ Valider la facture
</button>
<button onClick={() => escaladerFacture(factureSelectionnee.id)} style={{ ...btnActionStyle, backgroundColor: '#FF8C00' }}>
⬆️ Escalader au directeur
</button>
<button onClick={() => {
const motif = prompt('Motif du rejet :');
if (motif) rejeterFacture(factureSelectionnee.id, motif);
}} style={{ ...btnActionStyle, backgroundColor: '#ef4444' }}>
❌ Rejeter la facture
</button>
</div>
) : (
<div style={{ padding: '12px', backgroundColor: '#1f2937', borderRadius: '8px', textAlign: 'center' }}>
<span style={{ color: '#6b7280', fontSize: '13px' }}>Facture déjà traitée — statut : {factureSelectionnee.statut}</span>
</div>
)}
</div>
)}
</div>
</div>
</div>
);
}

function Navbar({ navigate }) {
function deconnexion() { localStorage.clear(); navigate('/login'); }
return (
<nav style={{ backgroundColor: '#111827', borderBottom: '1px solid #1f2937', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px' }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
<span style={{ fontSize: '24px' }}>🛡️</span>
<span style={{ color: '#ffffff', fontWeight: '700', fontSize: '18px' }}>FacturaSecure</span>
</div>
<div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
{[
{ label: 'Dashboard', path: '/dashboard' },
{ label: 'Factures', path: '/factures' },
{ label: 'Fournisseurs', path: '/fournisseurs' },
{ label: 'Alertes', path: '/alertes' },
{ label: 'Rapports', path: '/rapports' },
{ label: 'Paramètres', path: '/parametres' }
].map(item => (
<button key={item.path} onClick={() => navigate(item.path)} style={{
background: 'none', border: 'none',
color: window.location.pathname === item.path ? '#00B4D8' : '#9ca3af',
fontSize: '14px', fontWeight: '500', cursor: 'pointer'
}}>{item.label}</button>
))}
<button onClick={deconnexion} style={{ backgroundColor: '#1f2937', border: 'none', color: '#ef4444', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
Déconnexion
</button>
</div>
</nav>
);
}

function Badge({ statut }) {
const config = {
conforme: { couleur: '#00C97A', bg: '#00C97A20', label: '✅ Conforme' },
attention: { couleur: '#FF8C00', bg: '#FF8C0020', label: '⚠️ Attention' },
alerte_rouge: { couleur: '#ef4444', bg: '#ef444420', label: '🚨 Alerte' },
en_attente: { couleur: '#6b7280', bg: '#6b728020', label: '⏳ En attente' },
bloquee: { couleur: '#ef4444', bg: '#ef444420', label: '🔒 Bloquée' },
validee: { couleur: '#00C97A', bg: '#00C97A20', label: '✅ Validée' },
rejetee: { couleur: '#6b7280', bg: '#6b728020', label: '❌ Rejetée' }
};
const c = config[statut] || config.en_attente;
return (
<span style={{ backgroundColor: c.bg, color: c.couleur, padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
{c.label}
</span>
);
}

const carteStyle = { backgroundColor: '#111827', borderRadius: '12px', padding: '20px', border: '1px solid #1f2937' };
const thStyle = { color: '#6b7280', fontSize: '12px', fontWeight: '600', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #1f2937' };
const tdStyle = { color: '#d1d5db', fontSize: '13px', padding: '12px' };
const btnPetitStyle = { backgroundColor: '#1f2937', border: '1px solid #374151', color: '#9ca3af', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' };
const btnActionStyle = { width: '100%', padding: '10px', border: 'none', borderRadius: '8px', color: '#ffffff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' };
