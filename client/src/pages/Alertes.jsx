import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function Alertes({ utilisateur }) {
const navigate = useNavigate();
const [alertes, setAlertes] = useState([]);
const [chargement, setChargement] = useState(true);
const [filtreNiveau, setFiltreNiveau] = useState('tous');
const [alerteSelectionnee, setAlerteSelectionnee] = useState(null);

useEffect(() => {
chargerAlertes();
}, [filtreNiveau]);

async function chargerAlertes() {
try {
const token = localStorage.getItem('token');
const params = filtreNiveau !== 'tous' ? `?niveau=${filtreNiveau}` : '';
const { data } = await axios.get(`${API}/alertes${params}`, {
headers: { Authorization: `Bearer ${token}` }
});
setAlertes(data.donnees || []);
} catch (err) {
toast.error('Erreur chargement alertes');
} finally {
setChargement(false);
}
}

async function traiterAlerte(alerteId, statut) {
try {
const token = localStorage.getItem('token');
await axios.put(`${API}/alertes/${alerteId}`, { statut }, {
headers: { Authorization: `Bearer ${token}` }
});
toast.success(statut === 'traitee' ? 'Alerte marquée comme traitée' : 'Alerte ignorée');
chargerAlertes();
setAlerteSelectionnee(null);
} catch (err) {
toast.error('Erreur traitement alerte');
}
}

const nbRouge = alertes.filter(a => a.niveau === 'alerte_rouge').length;
const nbAttention = alertes.filter(a => a.niveau === 'attention').length;

return (
<div style={{ minHeight: '100vh', backgroundColor: '#0a0f1e', fontFamily: 'Inter, sans-serif' }}>
<Navbar navigate={navigate} />

<div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

{/* TITRE */}
<div style={{ marginBottom: '24px' }}>
<h1 style={{ color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0' }}>
🚨 Alertes
</h1>
<p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
{nbRouge} alerte(s) rouge · {nbAttention} attention(s)
</p>
</div>

{/* COMPTEURS */}
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
<div style={{ ...carteStyle, borderLeft: '4px solid #ef4444' }}>
<p style={{ color: '#6b7280', fontSize: '12px', margin: '0' }}>Alertes rouges</p>
<p style={{ color: '#ef4444', fontSize: '32px', fontWeight: '700', margin: '4px 0 0' }}>{nbRouge}</p>
</div>
<div style={{ ...carteStyle, borderLeft: '4px solid #FF8C00' }}>
<p style={{ color: '#6b7280', fontSize: '12px', margin: '0' }}>Attentions</p>
<p style={{ color: '#FF8C00', fontSize: '32px', fontWeight: '700', margin: '4px 0 0' }}>{nbAttention}</p>
</div>
<div style={{ ...carteStyle, borderLeft: '4px solid #00C97A' }}>
<p style={{ color: '#6b7280', fontSize: '12px', margin: '0' }}>Total alertes</p>
<p style={{ color: '#00C97A', fontSize: '32px', fontWeight: '700', margin: '4px 0 0' }}>{alertes.length}</p>
</div>
</div>

{/* FILTRES */}
<div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
{[
{ val: 'tous', label: 'Toutes' },
{ val: 'alerte_rouge', label: '🚨 Alertes rouges' },
{ val: 'attention', label: '⚠️ Attentions' },
{ val: 'traitee', label: '✅ Traitées' }
].map(f => (
<button
key={f.val}
onClick={() => setFiltreNiveau(f.val)}
style={{
padding: '6px 14px', borderRadius: '20px',
border: 'none', cursor: 'pointer',
fontSize: '13px', fontWeight: '500',
backgroundColor: filtreNiveau === f.val ? '#00B4D8' : '#1f2937',
color: filtreNiveau === f.val ? '#ffffff' : '#9ca3af'
}}
>
{f.label}
</button>
))}
</div>

{/* LISTE + DETAIL */}
<div style={{ display: 'grid', gridTemplateColumns: alerteSelectionnee ? '1fr 1fr' : '1fr', gap: '16px' }}>

{/* LISTE */}
<div style={carteStyle}>
{chargement ? (
<p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Chargement...</p>
) : alertes.length === 0 ? (
<div style={{ textAlign: 'center', padding: '60px' }}>
<p style={{ fontSize: '48px', margin: '0' }}>✅</p>
<p style={{ color: '#6b7280', fontSize: '16px', marginTop: '12px' }}>
Aucune alerte active
</p>
</div>
) : (
<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
{alertes.map(alerte => (
<div
key={alerte.id}
onClick={() => setAlerteSelectionnee(alerte)}
style={{
padding: '14px 16px',
borderRadius: '8px',
cursor: 'pointer',
backgroundColor: alerteSelectionnee?.id === alerte.id ? '#1f2937' : '#0d1117',
border: `1px solid ${alerte.niveau === 'alerte_rouge' ? '#ef444440' : '#FF8C0040'}`,
borderLeft: `4px solid ${alerte.niveau === 'alerte_rouge' ? '#ef4444' : '#FF8C00'}`,
transition: 'all 0.2s'
}}
>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
<div style={{ flex: 1 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
<BadgeNiveau niveau={alerte.niveau} />
<span style={{ color: '#6b7280', fontSize: '11px' }}>
{alerte.type_alerte?.replace(/_/g, ' ')}
</span>
</div>
<p style={{ color: '#ffffff', fontSize: '14px', fontWeight: '600', margin: '0' }}>
{alerte.titre}
</p>
<p style={{ color: '#9ca3af', fontSize: '12px', margin: '4px 0 0' }}>
{alerte.description?.substring(0, 80)}...
</p>
</div>
<div style={{ textAlign: 'right', marginLeft: '12px' }}>
<p style={{ color: '#6b7280', fontSize: '11px', margin: '0' }}>
{new Date(alerte.created_at).toLocaleDateString('fr-FR')}
</p>
<p style={{ color: '#6b7280', fontSize: '11px', margin: '2px 0 0' }}>
{new Date(alerte.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
</p>
</div>
</div>
</div>
))}
</div>
)}
</div>

{/* DETAIL */}
{alerteSelectionnee && (
<div style={carteStyle}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
<h3 style={{ color: '#ffffff', fontSize: '16px', fontWeight: '600', margin: '0' }}>
Détail alerte
</h3>
<button
onClick={() => setAlerteSelectionnee(null)}
style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}
>
✕
</button>
</div>

{/* Niveau */}
<div style={{ marginBottom: '20px' }}>
<BadgeNiveau niveau={alerteSelectionnee.niveau} large />
</div>

{/* Infos */}
<div style={{ marginBottom: '20px' }}>
<h4 style={{ color: '#ffffff', fontSize: '15px', fontWeight: '700', margin: '0 0 8px' }}>
{alerteSelectionnee.titre}
</h4>
<p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: '1.6', margin: '0' }}>
{alerteSelectionnee.description}
</p>
</div>

{/* Données techniques */}
{alerteSelectionnee.donnees && Object.keys(JSON.parse(alerteSelectionnee.donnees || '{}')).length > 0 && (
<div style={{ marginBottom: '20px' }}>
<h4 style={{ color: '#6b7280', fontSize: '12px', fontWeight: '600', marginBottom: '8px', textTransform: 'uppercase' }}>
Données techniques
</h4>
<div style={{ backgroundColor: '#0d1117', borderRadius: '8px', padding: '12px' }}>
{Object.entries(JSON.parse(alerteSelectionnee.donnees || '{}')).map(([key, val]) => (
<div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #1f2937' }}>
<span style={{ color: '#6b7280', fontSize: '12px' }}>{key.replace(/_/g, ' ')}</span>
<span style={{ color: '#ffffff', fontSize: '12px', fontFamily: 'monospace' }}>
{typeof val === 'object' ? JSON.stringify(val) : String(val)}
</span>
</div>
))}
</div>
</div>
)}

{/* Lien facture */}
{alerteSelectionnee.facture_id && (
<button
onClick={() => navigate('/factures')}
style={{ ...btnSecondaireStyle, width: '100%', marginBottom: '12px' }}
>
📋 Voir la facture concernée
</button>
)}

{/* Actions */}
{alerteSelectionnee.statut === 'active' && (
<div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
<button
onClick={() => traiterAlerte(alerteSelectionnee.id, 'traitee')}
style={{ ...btnActionStyle, backgroundColor: '#00C97A' }}
>
✅ Marquer comme traitée
</button>
<button
onClick={() => traiterAlerte(alerteSelectionnee.id, 'ignoree')}
style={{ ...btnActionStyle, backgroundColor: '#6b7280' }}
>
Ignorer cette alerte
</button>
</div>
)}

{alerteSelectionnee.statut !== 'active' && (
<div style={{
padding: '12px', backgroundColor: '#1f2937',
borderRadius: '8px', textAlign: 'center'
}}>
<span style={{ color: '#6b7280', fontSize: '13px' }}>
Alerte {alerteSelectionnee.statut}
</span>
</div>
)}
</div>
)}
</div>
</div>
</div>
);
}

// ============================================
// BADGE NIVEAU
// ============================================
function BadgeNiveau({ niveau, large }) {
const config = {
alerte_rouge: { couleur: '#ef4444', bg: '#ef444420', label: '🚨 Alerte rouge' },
attention: { couleur: '#FF8C00', bg: '#FF8C0020', label: '⚠️ Attention' },
conforme: { couleur: '#00C97A', bg: '#00C97A20', label: '✅ Conforme' }
};
const c = config[niveau] || config.conforme;
return (
<span style={{
backgroundColor: c.bg, color: c.couleur,
padding: large ? '6px 16px' : '3px 10px',
borderRadius: '20px',
fontSize: large ? '14px' : '12px',
fontWeight: '600'
}}>
{c.label}
</span>
);
}

// ============================================
// NAVBAR
// ============================================
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

const btnActionStyle = {
width: '100%', padding: '10px', border: 'none',
borderRadius: '8px', color: '#ffffff',
fontSize: '14px', fontWeight: '600', cursor: 'pointer'
};

const btnSecondaireStyle = {
backgroundColor: '#1f2937', border: '1px solid #374151',
color: '#9ca3af', padding: '8px 16px',
borderRadius: '6px', cursor: 'pointer', fontSize: '13px'
};
