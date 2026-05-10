import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const API = 'http://localhost:5000/api';

export default function Rapports({ utilisateur }) {
const navigate = useNavigate();
const [rapports, setRapports] = useState([]);
const [stats, setStats] = useState(null);
const [chargement, setChargement] = useState(true);
const [periodeSelectionnee, setPeriodeSelectionnee] = useState('mois');

useEffect(() => {
chargerDonnees();
}, [periodeSelectionnee]);

async function chargerDonnees() {
try {
const token = localStorage.getItem('token');
const headers = { Authorization: `Bearer ${token}` };
const [rapportsRes, statsRes] = await Promise.all([
axios.get(`${API}/rapports`, { headers }),
axios.get(`${API}/dashboard/stats?periode=${periodeSelectionnee}`, { headers })
]);
setRapports(rapportsRes.data.donnees || []);
setStats(statsRes.data.donnees);
} catch (err) {
toast.error('Erreur chargement rapports');
} finally {
setChargement(false);
}
}

async function exporterRapport(rapportId, format) {
try {
const token = localStorage.getItem('token');
const { data } = await axios.get(`${API}/rapports/${rapportId}/export?format=${format}`, {
headers: { Authorization: `Bearer ${token}` },
responseType: 'blob'
});
const url = window.URL.createObjectURL(new Blob([data]));
const link = document.createElement('a');
link.href = url;
link.setAttribute('download', `rapport_${rapportId}.${format}`);
document.body.appendChild(link);
link.click();
link.remove();
toast.success(`Export ${format.toUpperCase()} téléchargé !`);
} catch (err) {
toast.error('Erreur export');
}
}

async function genererRapport() {
try {
const token = localStorage.getItem('token');
await axios.post(`${API}/rapports/generer`, { periode: periodeSelectionnee }, {
headers: { Authorization: `Bearer ${token}` }
});
toast.success('Rapport généré !');
chargerDonnees();
} catch (err) {
toast.error('Erreur génération rapport');
}
}

return (
<div style={{ minHeight: '100vh', backgroundColor: '#0a0f1e', fontFamily: 'Inter, sans-serif' }}>
<Navbar navigate={navigate} />

<div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

{/* TITRE */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
<div>
<h1 style={{ color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0' }}>
📊 Rapports
</h1>
<p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
Analyse et exports de vos données
</p>
</div>
<div style={{ display: 'flex', gap: '10px' }}>
{/* Filtre période */}
{['mois', 'trimestre', 'annee'].map(p => (
<button
key={p}
onClick={() => setPeriodeSelectionnee(p)}
style={{
padding: '8px 16px', borderRadius: '8px', border: 'none',
cursor: 'pointer', fontSize: '13px', fontWeight: '500',
backgroundColor: periodeSelectionnee === p ? '#00B4D8' : '#1f2937',
color: periodeSelectionnee === p ? '#ffffff' : '#9ca3af'
}}
>
{p === 'mois' ? 'Ce mois' : p === 'trimestre' ? 'Trimestre' : 'Année'}
</button>
))}
<button onClick={genererRapport} style={btnPrimaryStyle}>
📄 Générer un rapport
</button>
</div>
</div>

{/* CARTES KPI */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
<CarteKPI
titre="Total factures"
valeur={stats?.factures_total || 0}
icone="📋"
couleur="#00B4D8"
/>
<CarteKPI
titre="Montant total TTC"
valeur={`${((stats?.total_ttc || 0) / 1000).toFixed(0)}k€`}
icone="💰"
couleur="#00C97A"
/>
<CarteKPI
titre="Alertes détectées"
valeur={stats?.alertes_total || 0}
icone="🚨"
couleur="#ef4444"
/>
<CarteKPI
titre="Économies estimées"
valeur={`${((stats?.economies || 0) / 1000).toFixed(0)}k€`}
icone="💎"
couleur="#FF8C00"
/>
</div>

{/* GRAPHIQUES */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>

{/* Factures par mois */}
<div style={carteStyle}>
<h3 style={titreSectionStyle}>Factures reçues par mois</h3>
<ResponsiveContainer width="100%" height={200}>
<BarChart data={stats?.evolution || []}>
<CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
<XAxis dataKey="mois" stroke="#6b7280" fontSize={11} />
<YAxis stroke="#6b7280" fontSize={11} />
<Tooltip
contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
labelStyle={{ color: '#ffffff' }}
/>
<Bar dataKey="nb_factures" fill="#00B4D8" radius={[4, 4, 0, 0]} />
</BarChart>
</ResponsiveContainer>
</div>

{/* Montants par mois */}
<div style={carteStyle}>
<h3 style={titreSectionStyle}>Montants TTC par mois (€)</h3>
<ResponsiveContainer width="100%" height={200}>
<LineChart data={stats?.evolution || []}>
<CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
<XAxis dataKey="mois" stroke="#6b7280" fontSize={11} />
<YAxis stroke="#6b7280" fontSize={11} />
<Tooltip
contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
labelStyle={{ color: '#ffffff' }}
/>
<Line type="monotone" dataKey="total_ttc" stroke="#00C97A" strokeWidth={2} dot={false} />
</LineChart>
</ResponsiveContainer>
</div>
</div>

{/* RÉPARTITION ALERTES */}
<div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '24px' }}>

<div style={carteStyle}>
<h3 style={titreSectionStyle}>Répartition des alertes</h3>
{[
{ label: 'Changement RIB', val: stats?.alertes_rib || 0, couleur: '#ef4444' },
{ label: 'Doublons', val: stats?.alertes_doublon || 0, couleur: '#FF8C00' },
{ label: 'Prix non contractuel', val: stats?.alertes_prix || 0, couleur: '#FF8C00' },
{ label: 'Fournisseur inconnu', val: stats?.alertes_fournisseur || 0, couleur: '#ef4444' },
{ label: 'Ligne suspecte', val: stats?.alertes_ligne || 0, couleur: '#FF8C00' }
].map(item => (
<div key={item.label} style={{ marginBottom: '12px' }}>
<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
<span style={{ color: '#9ca3af', fontSize: '12px' }}>{item.label}</span>
<span style={{ color: item.couleur, fontSize: '12px', fontWeight: '600' }}>{item.val}</span>
</div>
<div style={{ backgroundColor: '#1f2937', borderRadius: '4px', height: '6px' }}>
<div style={{
backgroundColor: item.couleur,
height: '6px', borderRadius: '4px',
width: `${Math.min((item.val / (stats?.alertes_total || 1)) * 100, 100)}%`
}} />
</div>
</div>
))}
</div>

{/* LISTE RAPPORTS */}
<div style={carteStyle}>
<h3 style={titreSectionStyle}>Rapports générés</h3>
{chargement ? (
<p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>Chargement...</p>
) : rapports.length === 0 ? (
<p style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
Aucun rapport généré
</p>
) : (
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
<thead>
<tr>
{['Type', 'Période', 'Généré le', 'Export'].map(col => (
<th key={col} style={thStyle}>{col}</th>
))}
</tr>
</thead>
<tbody>
{rapports.map(rapport => (
<tr key={rapport.id} style={{ borderBottom: '1px solid #1f2937' }}>
<td style={tdStyle}>
<span style={{
backgroundColor: '#1f2937', color: '#00B4D8',
padding: '2px 8px', borderRadius: '12px', fontSize: '11px'
}}>
{rapport.type_rapport}
</span>
</td>
<td style={tdStyle}>
{new Date(rapport.periode_debut).toLocaleDateString('fr-FR')} —{' '}
{new Date(rapport.periode_fin).toLocaleDateString('fr-FR')}
</td>
<td style={tdStyle}>
{new Date(rapport.genere_le).toLocaleDateString('fr-FR')}
</td>
<td style={tdStyle}>
<div style={{ display: 'flex', gap: '6px' }}>
<button
onClick={() => exporterRapport(rapport.id, 'pdf')}
style={{ ...btnPetitStyle, color: '#ef4444' }}
>
PDF
</button>
<button
onClick={() => exporterRapport(rapport.id, 'xlsx')}
style={{ ...btnPetitStyle, color: '#00C97A' }}
>
Excel
</button>
</div>
</td>
</tr>
))}
</tbody>
</table>
)}
</div>
</div>

{/* ARGUMENT ROI */}
<div style={{
...carteStyle,
background: 'linear-gradient(135deg, #00B4D820, #00C97A10)',
borderColor: '#00B4D840'
}}>
<div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
<span style={{ fontSize: '40px' }}>💎</span>
<div>
<h3 style={{ color: '#ffffff', fontSize: '16px', fontWeight: '700', margin: '0' }}>
ROI FacturaSecure
</h3>
<p style={{ color: '#9ca3af', fontSize: '14px', margin: '4px 0 0' }}>
990€/mois c'est 33€ par jour.{' '}
<span style={{ color: '#00C97A', fontWeight: '600' }}>
Une seule erreur détectée vous rembourse 2 ans d'abonnement.
</span>
</p>
</div>
<div style={{ marginLeft: 'auto', textAlign: 'right' }}>
<p style={{ color: '#6b7280', fontSize: '12px', margin: '0' }}>Économies estimées</p>
<p style={{ color: '#00C97A', fontSize: '28px', fontWeight: '700', margin: '4px 0 0' }}>
{((stats?.economies || 0)).toLocaleString('fr-FR')}€
</p>
</div>
</div>
</div>

</div>
</div>
);
}

// ============================================
// COMPOSANTS
// ============================================
function CarteKPI({ titre, valeur, icone, couleur }) {
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

function Navbar({ navigate }) {
return (
<nav style={{
backgroundColor: '#111827', borderBottom: '1px solid #1f2937',
padding: '0 24px', display: 'flex', alignItems: 'center',
justifyContent: 'space-between', height: '60px'
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
<button key={item.path} onClick={() => navigate(item.path)} style={{
background: 'none', border: 'none',
color: window.location.pathname === item.path ? '#00B4D8' : '#9ca3af',
fontSize: '14px', fontWeight: '500', cursor: 'pointer'
}}>
{item.label}
</button>
))}
<button onClick={() => { localStorage.clear(); navigate('/login'); }} style={{
backgroundColor: '#1f2937', border: 'none', color: '#ef4444',
padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
}}>
Déconnexion
</button>
</div>
</nav>
);
}

// ============================================
// STYLES
// ============================================
const carteStyle = {
backgroundColor: '#111827', borderRadius: '12px',
padding: '20px', border: '1px solid #1f2937'
};

const titreSectionStyle = {
color: '#ffffff', fontSize: '15px',
fontWeight: '600', marginBottom: '16px'
};

const thStyle = {
color: '#6b7280', fontSize: '12px', fontWeight: '600',
textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #1f2937'
};

const tdStyle = { color: '#d1d5db', fontSize: '13px', padding: '12px' };

const btnPrimaryStyle = {
backgroundColor: '#00B4D8', color: '#ffffff',
border: 'none', padding: '10px 20px',
borderRadius: '8px', cursor: 'pointer',
fontSize: '14px', fontWeight: '600'
};

const btnPetitStyle = {
backgroundColor: '#1f2937', border: '1px solid #374151',
padding: '4px 10px', borderRadius: '6px',
cursor: 'pointer', fontSize: '12px', fontWeight: '600'
};
