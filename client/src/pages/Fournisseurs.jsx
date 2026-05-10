import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function Fournisseurs({ utilisateur }) {
const navigate = useNavigate();
const [fournisseurs, setFournisseurs] = useState([]);
const [chargement, setChargement] = useState(true);
const [showForm, setShowForm] = useState(false);
const [fournisseurSelectionne, setFournisseurSelectionne] = useState(null);
const [form, setForm] = useState({
nom: '',
siret: '',
type_fournisseur: 'medicaments',
email: '',
telephone: '',
adresse: '',
iban_reference: '',
bic: '',
montant_min: '',
montant_max: '',
frequence_facturation: 'mensuel',
contrat_date_debut: '',
contrat_date_fin: ''
});

useEffect(() => {
chargerFournisseurs();
}, []);

async function chargerFournisseurs() {
try {
const token = localStorage.getItem('token');
const { data } = await axios.get(`${API}/fournisseurs`, {
headers: { Authorization: `Bearer ${token}` }
});
setFournisseurs(data.donnees || []);
} catch (err) {
toast.error('Erreur chargement fournisseurs');
} finally {
setChargement(false);
}
}

async function sauvegarderFournisseur(e) {
e.preventDefault();
try {
const token = localStorage.getItem('token');
const headers = { Authorization: `Bearer ${token}` };

if (fournisseurSelectionne) {
await axios.put(`${API}/fournisseurs/${fournisseurSelectionne.id}`, form, { headers });
toast.success('Fournisseur mis à jour !');
} else {
await axios.post(`${API}/fournisseurs`, form, { headers });
toast.success('Fournisseur ajouté !');
}

setShowForm(false);
setFournisseurSelectionne(null);
resetForm();
chargerFournisseurs();
} catch (err) {
toast.error(err.response?.data?.message || 'Erreur sauvegarde');
}
}

async function supprimerFournisseur(id) {
if (!window.confirm('Supprimer ce fournisseur ?')) return;
try {
const token = localStorage.getItem('token');
await axios.delete(`${API}/fournisseurs/${id}`, {
headers: { Authorization: `Bearer ${token}` }
});
toast.success('Fournisseur supprimé');
chargerFournisseurs();
} catch (err) {
toast.error('Erreur suppression');
}
}

function editerFournisseur(f) {
setFournisseurSelectionne(f);
setForm({
nom: f.nom || '',
siret: f.siret || '',
type_fournisseur: f.type_fournisseur || 'medicaments',
email: f.email || '',
telephone: f.telephone || '',
adresse: f.adresse || '',
iban_reference: f.iban_reference || '',
bic: f.bic || '',
montant_min: f.montant_min || '',
montant_max: f.montant_max || '',
frequence_facturation: f.frequence_facturation || 'mensuel',
contrat_date_debut: f.contrat_date_debut?.split('T')[0] || '',
contrat_date_fin: f.contrat_date_fin?.split('T')[0] || ''
});
setShowForm(true);
}

function resetForm() {
setForm({
nom: '', siret: '', type_fournisseur: 'medicaments',
email: '', telephone: '', adresse: '',
iban_reference: '', bic: '',
montant_min: '', montant_max: '',
frequence_facturation: 'mensuel',
contrat_date_debut: '', contrat_date_fin: ''
});
}

return (
<div style={{ minHeight: '100vh', backgroundColor: '#0a0f1e', fontFamily: 'Inter, sans-serif' }}>
<Navbar navigate={navigate} />

<div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>

{/* TITRE */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
<div>
<h1 style={{ color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0' }}>
🏢 Fournisseurs
</h1>
<p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
{fournisseurs.length} fournisseur(s) enregistré(s)
</p>
</div>
<button
onClick={() => { resetForm(); setFournisseurSelectionne(null); setShowForm(true); }}
style={btnPrimaryStyle}
>
+ Ajouter un fournisseur
</button>
</div>

<div style={{ display: 'grid', gridTemplateColumns: showForm ? '1fr 1fr' : '1fr', gap: '16px' }}>

{/* LISTE */}
<div style={carteStyle}>
{chargement ? (
<p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Chargement...</p>
) : fournisseurs.length === 0 ? (
<p style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>
Aucun fournisseur enregistré
</p>
) : (
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
<thead>
<tr>
{['Nom', 'Type', 'IBAN référence', 'Fourchette', 'Contrat', 'Actions'].map(col => (
<th key={col} style={thStyle}>{col}</th>
))}
</tr>
</thead>
<tbody>
{fournisseurs.map(f => (
<tr key={f.id} style={{ borderBottom: '1px solid #1f2937' }}>
<td style={tdStyle}>
<div style={{ fontWeight: '600', color: '#ffffff' }}>{f.nom}</div>
<div style={{ color: '#6b7280', fontSize: '11px' }}>{f.email}</div>
</td>
<td style={tdStyle}>
<span style={{
backgroundColor: '#1f2937', color: '#9ca3af',
padding: '2px 8px', borderRadius: '12px', fontSize: '11px'
}}>
{f.type_fournisseur}
</span>
</td>
<td style={tdStyle}>
<span style={{ color: '#00B4D8', fontSize: '12px', fontFamily: 'monospace' }}>
{f.iban_reference ? f.iban_reference.substring(0, 16) + '...' : '—'}
</span>
</td>
<td style={tdStyle}>
{f.montant_min && f.montant_max
? `${f.montant_min}€ - ${f.montant_max}€`
: '—'}
</td>
<td style={tdStyle}>
{f.contrat_date_fin ? (
<span style={{
color: new Date(f.contrat_date_fin) < new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
? '#FF8C00' : '#00C97A',
fontSize: '12px'
}}>
{new Date(f.contrat_date_fin).toLocaleDateString('fr-FR')}
</span>
) : '—'}
</td>
<td style={tdStyle}>
<div style={{ display: 'flex', gap: '6px' }}>
<button onClick={() => editerFournisseur(f)} style={btnPetitStyle}>
✏️
</button>
<button onClick={() => supprimerFournisseur(f.id)} style={{
...btnPetitStyle, color: '#ef4444'
}}>
🗑️
</button>
</div>
</td>
</tr>
))}
</tbody>
</table>
)}
</div>

{/* FORMULAIRE */}
{showForm && (
<div style={carteStyle}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
<h3 style={{ color: '#ffffff', fontSize: '16px', fontWeight: '600', margin: '0' }}>
{fournisseurSelectionne ? 'Modifier fournisseur' : 'Nouveau fournisseur'}
</h3>
<button
onClick={() => setShowForm(false)}
style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}
>
✕
</button>
</div>

<form onSubmit={sauvegarderFournisseur}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

<div>
<label style={labelStyle}>Nom du fournisseur *</label>
<input
required
value={form.nom}
onChange={e => setForm({ ...form, nom: e.target.value })}
placeholder="Pharmacie Centrale"
style={inputStyle}
/>
</div>

<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
<div>
<label style={labelStyle}>SIRET</label>
<input
value={form.siret}
onChange={e => setForm({ ...form, siret: e.target.value })}
placeholder="12345678901234"
maxLength={14}
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Type</label>
<select
value={form.type_fournisseur}
onChange={e => setForm({ ...form, type_fournisseur: e.target.value })}
style={inputStyle}
>
<option value="medicaments">Médicaments</option>
<option value="materiel">Matériel médical</option>
<option value="services">Services</option>
<option value="maintenance">Maintenance</option>
<option value="alimentation">Alimentation</option>
<option value="informatique">Informatique</option>
<option value="autre">Autre</option>
</select>
</div>
</div>

<div>
<label style={labelStyle}>IBAN de référence *</label>
<input
required
value={form.iban_reference}
onChange={e => setForm({ ...form, iban_reference: e.target.value.toUpperCase() })}
placeholder="FR76 3000 6000 0112 3456 7890 189"
style={{ ...inputStyle, fontFamily: 'monospace', color: '#00B4D8' }}
/>
<p style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>
⚠️ IBAN de confiance — toute différence déclenchera une alerte rouge
</p>
</div>

<div>
<label style={labelStyle}>BIC</label>
<input
value={form.bic}
onChange={e => setForm({ ...form, bic: e.target.value.toUpperCase() })}
placeholder="BNPAFRPP"
style={inputStyle}
/>
</div>

<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
<div>
<label style={labelStyle}>Email</label>
<input
type="email"
value={form.email}
onChange={e => setForm({ ...form, email: e.target.value })}
placeholder="contact@fournisseur.fr"
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Téléphone</label>
<input
value={form.telephone}
onChange={e => setForm({ ...form, telephone: e.target.value })}
placeholder="01 23 45 67 89"
style={inputStyle}
/>
</div>
</div>

<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
<div>
<label style={labelStyle}>Montant min habituel (€)</label>
<input
type="number"
value={form.montant_min}
onChange={e => setForm({ ...form, montant_min: e.target.value })}
placeholder="500"
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Montant max habituel (€)</label>
<input
type="number"
value={form.montant_max}
onChange={e => setForm({ ...form, montant_max: e.target.value })}
placeholder="5000"
style={inputStyle}
/>
</div>
</div>

<div>
<label style={labelStyle}>Fréquence de facturation</label>
<select
value={form.frequence_facturation}
onChange={e => setForm({ ...form, frequence_facturation: e.target.value })}
style={inputStyle}
>
<option value="hebdomadaire">Hebdomadaire</option>
<option value="mensuel">Mensuel</option>
<option value="trimestriel">Trimestriel</option>
<option value="ponctuel">Ponctuel</option>
</select>
</div>

<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
<div>
<label style={labelStyle}>Début contrat</label>
<input
type="date"
value={form.contrat_date_debut}
onChange={e => setForm({ ...form, contrat_date_debut: e.target.value })}
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Fin contrat</label>
<input
type="date"
value={form.contrat_date_fin}
onChange={e => setForm({ ...form, contrat_date_fin: e.target.value })}
style={inputStyle}
/>
</div>
</div>

<button type="submit" style={btnPrimaryStyle}>
{fournisseurSelectionne ? '💾 Mettre à jour' : '➕ Ajouter le fournisseur'}
</button>
</div>
</form>
</div>
)}
</div>
</div>
</div>
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

const thStyle = {
color: '#6b7280', fontSize: '12px', fontWeight: '600',
textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #1f2937'
};

const tdStyle = { color: '#d1d5db', fontSize: '13px', padding: '12px' };

const labelStyle = {
display: 'block', color: '#9ca3af',
fontSize: '13px', fontWeight: '500', marginBottom: '6px'
};

const inputStyle = {
width: '100%', padding: '10px 14px',
backgroundColor: '#1f2937', border: '1px solid #374151',
borderRadius: '8px', color: '#ffffff',
fontSize: '14px', outline: 'none', boxSizing: 'border-box'
};

const btnPrimaryStyle = {
backgroundColor: '#00B4D8', color: '#ffffff',
border: 'none', padding: '10px 20px',
borderRadius: '8px', cursor: 'pointer',
fontSize: '14px', fontWeight: '600'
};

const btnPetitStyle = {
backgroundColor: '#1f2937', border: '1px solid #374151',
color: '#9ca3af', padding: '4px 10px',
borderRadius: '6px', cursor: 'pointer', fontSize: '12px'
};
