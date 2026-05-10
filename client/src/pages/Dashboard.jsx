import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API = 'http://localhost:5000/api';

export default function Dashboard({ utilisateur }) {
const navigate = useNavigate();
const [stats, setStats] = useState(null);
const [alertes, setAlertes] = useState([]);
const [facturesRecentes, setFacturesRecentes] = useState([]);
const [chargement, setChargement] = useState(true);

useEffect(() => {
chargerDonnees();
}, []);

async function chargerDonnees() {
try {
const token = localStorage.getItem('token');
const headers = { Authorization: `Bearer ${token}` };

const [statsRes, alertesRes, facturesRes] = await Promise.all([
axios.get(`${API}/dashboard/stats`, { headers }),
axios.get(`${API}/alertes?limit=5`, { headers }),
axios.get(`${API}/factures?limit=5`, { headers })
]);

setStats(statsRes.data.donnees);
setAlertes(alertesRes.data.donnees || []);
setFacturesRecentes(facturesRes.data.donnees || []);
} catch (err) {
toast.error('Erreur chargement dashboard');
} finally {
setChargement(false);
}
}

function deconnexion() {
localStorage.clear();
navigate('/login');
}

if (chargement) return <Chargement />;

return (
<div style={{ minHeight: '100vh', backgroundColor: '#0a0f1e', fontFamily: 'Inter, sans-serif' }}>

{/* ============ NAVBAR ============ */}
<nav style={{
backgroundColor: '#111827',
borderBottom: '1px solid #1f2937',
padding: '0 24px',
display: 'flex',
alignItems: 'center',
justifyContent: 'space-between',
height: '60px'
}}>
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
<button
key={item.path}
onClick={() => navigate(item.path)}
style={{
background: 'none',
border: 'none',
color: window.location.pathname === item.path ? '#00B4D8' : '#9ca3af',
fontSize: '14px',
fontWeight: '500',
cursor: 'pointer'
}}
>
{item.label}
</button>
))}

<button onClick={deconnexion} style={{
backgroundColor: '#1f2937',
border: 'none',
color: '#ef4444',
padding: '6px 14px',
borderRadius: '6px',
cursor: 'pointer',
fontSize: '13px'
}}>
Déconnexion
</button>
</div>
</nav>

{/* ============ CONTENU ============ */}
<div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

{/* Titre */}
<div style={{ marginBottom: '24px' }}>
<h1 style={{ color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0' }}>
Bonjour {utilisateur?.prenom} 👋
</h1>
<p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
Voici le résumé de votre activité
</p>
</div>

{/* ============ CARTES STATS ============ */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
<CarteStats
titre="Factures en attente"
valeur={stats?.factures_en_attente || 0}
couleur="#00B4D8"
icone="📋"
/>
<CarteStats
titre="Alertes actives"
valeur={stats?.alertes_actives || 0}
couleur="#ef4444"
icone="🚨"
/>
<CarteStats
titre="Factures ce mois"
valeur={stats?.factures_mois || 0}
couleur="#00C97A"
icone="✅"
/>
<CarteStats
titre="Total TTC ce mois"
valeur={`${(stats?.total_ttc_mois || 0).toLocaleString('fr-FR')}€`}
couleur="#FF8C00"
icone="💰"
/>
</div>

{/* ============ GRAPHIQUE + ALERTES ============ */}
<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '24px' }}>

{/* Graphique évolution */}
<div style={carteStyle}>
<h3 style={titreSectionStyle}>Évolution des factures (6 mois)</h3>
<ResponsiveContainer width="100%" height={220}>
<LineChart data={stats?.evolution || []}>
<CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
<XAxis dataKey="mois" stroke="#6b7280" fontSize={12} />
<YAxis stroke="#6b7280" fontSize={12} />
<Tooltip
contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
labelStyle={{ color: '#ffffff' }}
/>
<Line type="monotone" dataKey="nb_factures" stroke="#00B4D8" strokeWidth={2} dot={false} />
</LineChart>
</ResponsiveContainer>
</div>

{/* Alertes récentes */}
<div style={carteStyle}>
<h3 style={titreSectionStyle}>Alertes récentes</h3>
{alertes.length === 0 ? (
<p style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
✅ Aucune alerte active
</p>
) : (
alertes.map(alerte => (
<div key={alerte.id} style={{
padding: '10px',
borderRadius: '8px',
marginBottom: '8px',
backgroundColor: alerte.niveau === 'alerte_rouge' ? '#2d0f0f' : '#1c1a0f',
borderLeft: `3px solid ${alerte.niveau === 'alerte_rouge' ? '#ef4444' : '#FF8C00'}`
}}>
<p style={{ color: '#ffffff', fontSize: '13px', margin: '0', fontWeight: '600' }}>
{alerte.titre}
</p>
<p style={{ color: '#6b7280', fontSize: '11px', margin: '4px 0 0' }}>
{new Date(alerte.created_at).toLocaleDateString('fr-FR')}
</p>
</div>
))
)}
<button
onClick={() => navigate('/alertes')}
style={{ ...btnSecondaireStyle, marginTop: '12px', width: '100%' }}
>
Voir toutes les alertes
</button>
</div>
</div>

{/* ============ FACTURES RÉCENTES ============ */}
<div style={carteStyle}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
<h3 style={{ ...titreSectionStyle, margin: '0' }}>Factures récentes</h3>
<button onClick={() => navigate('/factures')} style={btnSecondaireStyle}>
Voir toutes
</button>
</div>

<table style={{ width: '100%', borderCollapse: 'collapse' }}>
<thead>
<tr>
{['Numéro', 'Fournisseur', 'Montant TTC', 'Date', 'Statut'].map(col => (
<th key={col} style={{
color: '#6b7280', fontSize: '12px', fontWeight: '600',
textAlign: 'left', padding: '8px 12px',
borderBottom: '1px solid #1f2937'
}}>
{col}
</th>
))}
</tr>
</thead>
<tbody>
{facturesRecentes.length === 0 ? (
<tr>
<td colSpan={5} style={{ color: '#6b7280', textAlign: 'center', padding: '24px', fontSize: '14px' }}>
Aucune facture pour l'instant
</td>
</tr>
) : (
facturesRecentes.map(facture => (
<tr key={facture.id} style={{ borderBottom: '1px solid #1f2937' }}>
<td style={cellStyle}>{facture.numero_facture || '—'}</td>
<td style={cellStyle}>{facture.nom_fournisseur || '—'}</td>
<td style={cellStyle}>{facture.montant_ttc ? `${parseFloat(facture.montant_ttc).toLocaleString('fr-FR')}€` : '—'}</td>
<td style={cellStyle}>{facture.date_facture ? new Date(facture.date_facture).toLocaleDateString('fr-FR') : '—'}</td>
<td style={cellStyle}>
<Badge statut={facture.verification_statut} />
</td>
</tr>
))
)}
</tbody>
</table>
</div>

</div>
</div>
);
}

// ============================================
// COMPOSANTS
// ============================================
function CarteStats({ titre, valeur, couleur, icone }) {
return (
<div style={{ ...carteStyle, display: 'flex', alignItems: 'center', gap: '16px' }}>
<div style={{
width: '48px', height: '48px', borderRadius: '12px',
backgroundColor: couleur + '20',
display: 'flex', alignItems: 'center', justifyContent: 'center',
fontSize: '22px', flexShrink: 0
}}>
{icone}
</div>
<div>
<p style={{ color: '#6b7280', fontSize: '12px', margin: '0', fontWeight: '500' }}>{titre}</p>
<p style={{ color: couleur, fontSize: '24px', fontWeight: '700', margin: '4px 0 0' }}>{valeur}</p>
</div>
</div>
);
}

function Badge({ statut }) {
const config = {
conforme: { couleur: '#00C97A', bg: '#00C97A20', label: '✅ Conforme' },
attention: { couleur: '#FF8C00', bg: '#FF8C0020', label: '⚠️ Attention' },
alerte_rouge: { couleur: '#ef4444', bg: '#ef444420', label: '🚨 Alerte' },
en_attente: { couleur: '#6b7280', bg: '#6b728020', label: '⏳ En attente' }
};
const c = config[statut] || config.en_attente;
return (
<span style={{
backgroundColor: c.bg, color: c.couleur,
padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600'
}}>
{c.label}
</span>
);
}

function Chargement() {
return (
<div style={{
minHeight: '100vh', backgroundColor: '#0a0f1e',
display: 'flex', alignItems: 'center', justifyContent: 'center'
}}>
<p style={{ color: '#6b7280', fontSize: '16px' }}>Chargement...</p>
</div>
);
}

// ============================================
// STYLES
// ============================================
const carteStyle = {
backgroundColor: '#111827',
borderRadius: '12px',
padding: '20px',
border: '1px solid #1f2937'
};

const titreSectionStyle = {
color: '#ffffff',
fontSize: '15px',
fontWeight: '600',
marginBottom: '16px'
};

const cellStyle = {
color: '#d1d5db',
fontSize: '13px',
padding: '12px'
};

const btnSecondaireStyle = {
backgroundColor: '#1f2937',
border: '1px solid #374151',
color: '#9ca3af',
padding: '6px 14px',
borderRadius: '6px',
cursor: 'pointer',
fontSize: '13px'
};
