import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = 'http://localhost:5000/api';

export default function Parametres({ utilisateur }) {
const navigate = useNavigate();
const [onglet, setOnglet] = useState('profil');
const [chargement, setChargement] = useState(false);
const [utilisateurs, setUtilisateurs] = useState([]);
const [etablissement, setEtablissement] = useState(null);

const [formProfil, setFormProfil] = useState({
nom: '', prenom: '', email: '', mot_de_passe_actuel: '',
nouveau_mot_de_passe: '', confirmation_mot_de_passe: ''
});

const [formEtablissement, setFormEtablissement] = useState({
nom_etablissement: '', siret: '', email_contact: '',
telephone: '', adresse: '', code_postal: '', ville: ''
});

const [formIMAP, setFormIMAP] = useState({
email_imap: '', imap_host: '', imap_port: '993', imap_password: '', imap_actif: false
});

const [formInvitation, setFormInvitation] = useState({
email: '', role: 'comptable'
});

useEffect(() => {
chargerDonnees();
}, []);

async function chargerDonnees() {
try {
const token = localStorage.getItem('token');
const headers = { Authorization: `Bearer ${token}` };
const [etabRes, usersRes] = await Promise.all([
axios.get(`${API}/etablissements/moi`, { headers }),
axios.get(`${API}/utilisateurs`, { headers })
]);
const etab = etabRes.data.donnees;
setEtablissement(etab);
setUtilisateurs(usersRes.data.donnees || []);
setFormEtablissement({
nom_etablissement: etab.nom || '',
siret: etab.siret || '',
email_contact: etab.email_contact || '',
telephone: etab.telephone || '',
adresse: etab.adresse || '',
code_postal: etab.code_postal || '',
ville: etab.ville || ''
});
setFormIMAP({
email_imap: etab.email_imap || '',
imap_host: etab.imap_host || '',
imap_port: etab.imap_port || '993',
imap_password: '',
imap_actif: etab.imap_actif || false
});
const userStocke = JSON.parse(localStorage.getItem('utilisateur') || '{}');
setFormProfil(prev => ({
...prev,
nom: userStocke.nom || '',
prenom: userStocke.prenom || '',
email: userStocke.email || ''
}));
} catch (err) {
toast.error('Erreur chargement paramètres');
}
}

async function sauvegarderProfil(e) {
e.preventDefault();
if (formProfil.nouveau_mot_de_passe &&
formProfil.nouveau_mot_de_passe !== formProfil.confirmation_mot_de_passe) {
toast.error('Les mots de passe ne correspondent pas');
return;
}
setChargement(true);
try {
const token = localStorage.getItem('token');
await axios.put(`${API}/utilisateurs/profil`, formProfil, {
headers: { Authorization: `Bearer ${token}` }
});
toast.success('Profil mis à jour !');
} catch (err) {
toast.error(err.response?.data?.message || 'Erreur mise à jour profil');
} finally {
setChargement(false);
}
}

async function sauvegarderEtablissement(e) {
e.preventDefault();
setChargement(true);
try {
const token = localStorage.getItem('token');
await axios.put(`${API}/etablissements/moi`, formEtablissement, {
headers: { Authorization: `Bearer ${token}` }
});
toast.success('Établissement mis à jour !');
} catch (err) {
toast.error('Erreur mise à jour établissement');
} finally {
setChargement(false);
}
}

async function sauvegarderIMAP(e) {
e.preventDefault();
setChargement(true);
try {
const token = localStorage.getItem('token');
await axios.put(`${API}/etablissements/imap`, formIMAP, {
headers: { Authorization: `Bearer ${token}` }
});
toast.success('Configuration email sauvegardée !');
} catch (err) {
toast.error('Erreur configuration email');
} finally {
setChargement(false);
}
}

async function envoyerInvitation(e) {
e.preventDefault();
setChargement(true);
try {
const token = localStorage.getItem('token');
await axios.post(`${API}/utilisateurs/inviter`, formInvitation, {
headers: { Authorization: `Bearer ${token}` }
});
toast.success(`Invitation envoyée à ${formInvitation.email} !`);
setFormInvitation({ email: '', role: 'comptable' });
chargerDonnees();
} catch (err) {
toast.error(err.response?.data?.message || 'Erreur invitation');
} finally {
setChargement(false);
}
}

async function desactiverUtilisateur(userId) {
if (!window.confirm('Désactiver cet utilisateur ?')) return;
try {
const token = localStorage.getItem('token');
await axios.put(`${API}/utilisateurs/${userId}/desactiver`, {}, {
headers: { Authorization: `Bearer ${token}` }
});
toast.success('Utilisateur désactivé');
chargerDonnees();
} catch (err) {
toast.error('Erreur désactivation');
}
}

const onglets = [
{ id: 'profil', label: '👤 Profil' },
{ id: 'etablissement', label: '🏢 Établissement' },
{ id: 'email', label: '📧 Email IMAP' },
{ id: 'utilisateurs', label: '👥 Utilisateurs' },
{ id: 'abonnement', label: '💳 Abonnement' }
];

return (
<div style={{ minHeight: '100vh', backgroundColor: '#0a0f1e', fontFamily: 'Inter, sans-serif' }}>
<Navbar navigate={navigate} />

<div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>

<div style={{ marginBottom: '24px' }}>
<h1 style={{ color: '#ffffff', fontSize: '22px', fontWeight: '700', margin: '0' }}>
⚙️ Paramètres
</h1>
</div>

<div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px' }}>

{/* MENU LATERAL */}
<div style={carteStyle}>
{onglets.map(o => (
<button
key={o.id}
onClick={() => setOnglet(o.id)}
style={{
width: '100%', textAlign: 'left',
padding: '10px 14px', borderRadius: '8px',
border: 'none', cursor: 'pointer',
fontSize: '14px', fontWeight: '500',
marginBottom: '4px',
backgroundColor: onglet === o.id ? '#00B4D820' : 'transparent',
color: onglet === o.id ? '#00B4D8' : '#9ca3af'
}}
>
{o.label}
</button>
))}
</div>

{/* CONTENU */}
<div style={carteStyle}>

{/* ===== PROFIL ===== */}
{onglet === 'profil' && (
<div>
<h3 style={titreSectionStyle}>Mon profil</h3>
<form onSubmit={sauvegarderProfil}>
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
<div>
<label style={labelStyle}>Prénom</label>
<input
value={formProfil.prenom}
onChange={e => setFormProfil({ ...formProfil, prenom: e.target.value })}
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Nom</label>
<input
value={formProfil.nom}
onChange={e => setFormProfil({ ...formProfil, nom: e.target.value })}
style={inputStyle}
/>
</div>
</div>

<div style={{ marginBottom: '16px' }}>
<label style={labelStyle}>Email</label>
<input
type="email"
value={formProfil.email}
onChange={e => setFormProfil({ ...formProfil, email: e.target.value })}
style={inputStyle}
/>
</div>

<div style={{ borderTop: '1px solid #1f2937', paddingTop: '16px', marginBottom: '16px' }}>
<h4 style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '12px' }}>
Changer le mot de passe (optionnel)
</h4>
<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
<div>
<label style={labelStyle}>Mot de passe actuel</label>
<input
type="password"
value={formProfil.mot_de_passe_actuel}
onChange={e => setFormProfil({ ...formProfil, mot_de_passe_actuel: e.target.value })}
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Nouveau mot de passe</label>
<input
type="password"
value={formProfil.nouveau_mot_de_passe}
onChange={e => setFormProfil({ ...formProfil, nouveau_mot_de_passe: e.target.value })}
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Confirmer le mot de passe</label>
<input
type="password"
value={formProfil.confirmation_mot_de_passe}
onChange={e => setFormProfil({ ...formProfil, confirmation_mot_de_passe: e.target.value })}
style={inputStyle}
/>
</div>
</div>
</div>

<button type="submit" disabled={chargement} style={btnPrimaryStyle}>
{chargement ? 'Sauvegarde...' : '💾 Sauvegarder le profil'}
</button>
</form>
</div>
)}

{/* ===== ÉTABLISSEMENT ===== */}
{onglet === 'etablissement' && (
<div>
<h3 style={titreSectionStyle}>Informations établissement</h3>
<form onSubmit={sauvegarderEtablissement}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
<div>
<label style={labelStyle}>Nom de l'établissement</label>
<input
value={formEtablissement.nom_etablissement}
onChange={e => setFormEtablissement({ ...formEtablissement, nom_etablissement: e.target.value })}
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>SIRET</label>
<input
value={formEtablissement.siret}
onChange={e => setFormEtablissement({ ...formEtablissement, siret: e.target.value })}
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Email de contact</label>
<input
type="email"
value={formEtablissement.email_contact}
onChange={e => setFormEtablissement({ ...formEtablissement, email_contact: e.target.value })}
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Téléphone</label>
<input
value={formEtablissement.telephone}
onChange={e => setFormEtablissement({ ...formEtablissement, telephone: e.target.value })}
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Adresse</label>
<input
value={formEtablissement.adresse}
onChange={e => setFormEtablissement({ ...formEtablissement, adresse: e.target.value })}
style={inputStyle}
/>
</div>
<div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
<div>
<label style={labelStyle}>Code postal</label>
<input
value={formEtablissement.code_postal}
onChange={e => setFormEtablissement({ ...formEtablissement, code_postal: e.target.value })}
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Ville</label>
<input
value={formEtablissement.ville}
onChange={e => setFormEtablissement({ ...formEtablissement, ville: e.target.value })}
style={inputStyle}
/>
</div>
</div>
<button type="submit" disabled={chargement} style={btnPrimaryStyle}>
{chargement ? 'Sauvegarde...' : '💾 Sauvegarder'}
</button>
</div>
</form>
</div>
)}

{/* ===== EMAIL IMAP ===== */}
{onglet === 'email' && (
<div>
<h3 style={titreSectionStyle}>Configuration email automatique</h3>
<div style={{
backgroundColor: '#00B4D810', border: '1px solid #00B4D830',
borderRadius: '8px', padding: '12px', marginBottom: '20px'
}}>
<p style={{ color: '#00B4D8', fontSize: '13px', margin: '0' }}>
📧 Connectez votre boîte email pour recevoir automatiquement les factures fournisseurs.
FacturaSecure analysera chaque PDF reçu.
</p>
</div>
<form onSubmit={sauvegarderIMAP}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
<div>
<label style={labelStyle}>Adresse email</label>
<input
type="email"
value={formIMAP.email_imap}
onChange={e => setFormIMAP({ ...formIMAP, email_imap: e.target.value })}
placeholder="factures@hopital.fr"
style={inputStyle}
/>
</div>
<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
<div>
<label style={labelStyle}>Serveur IMAP</label>
<input
value={formIMAP.imap_host}
onChange={e => setFormIMAP({ ...formIMAP, imap_host: e.target.value })}
placeholder="imap.gmail.com"
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Port</label>
<input
value={formIMAP.imap_port}
onChange={e => setFormIMAP({ ...formIMAP, imap_port: e.target.value })}
placeholder="993"
style={inputStyle}
/>
</div>
</div>
<div>
<label style={labelStyle}>Mot de passe</label>
<input
type="password"
value={formIMAP.imap_password}
onChange={e => setFormIMAP({ ...formIMAP, imap_password: e.target.value })}
placeholder="••••••••"
style={inputStyle}
/>
</div>
<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
<input
type="checkbox"
id="imap_actif"
checked={formIMAP.imap_actif}
onChange={e => setFormIMAP({ ...formIMAP, imap_actif: e.target.checked })}
style={{ width: '16px', height: '16px', cursor: 'pointer' }}
/>
<label htmlFor="imap_actif" style={{ ...labelStyle, margin: '0', cursor: 'pointer' }}>
Activer la réception automatique des emails
</label>
</div>
<button type="submit" disabled={chargement} style={btnPrimaryStyle}>
{chargement ? 'Sauvegarde...' : '💾 Sauvegarder la configuration'}
</button>
</div>
</form>
</div>
)}

{/* ===== UTILISATEURS ===== */}
{onglet === 'utilisateurs' && (
<div>
<h3 style={titreSectionStyle}>Gestion des utilisateurs</h3>

{/* Invitation */}
<div style={{
backgroundColor: '#1f2937', borderRadius: '8px',
padding: '16px', marginBottom: '24px'
}}>
<h4 style={{ color: '#ffffff', fontSize: '14px', marginBottom: '12px' }}>
Inviter un utilisateur
</h4>
<form onSubmit={envoyerInvitation}>
<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
<div>
<label style={labelStyle}>Email</label>
<input
type="email"
required
value={formInvitation.email}
onChange={e => setFormInvitation({ ...formInvitation, email: e.target.value })}
placeholder="collegue@hopital.fr"
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Rôle</label>
<select
value={formInvitation.role}
onChange={e => setFormInvitation({ ...formInvitation, role: e.target.value })}
style={inputStyle}
>
<option value="comptable">Comptable</option>
<option value="directeur_financier">Directeur financier</option>
<option value="directeur">Directeur</option>
<option value="admin_it">Admin IT</option>
</select>
</div>
<button type="submit" disabled={chargement} style={btnPrimaryStyle}>
Inviter
</button>
</div>
</form>
</div>

{/* Liste utilisateurs */}
<table style={{ width: '100%', borderCollapse: 'collapse' }}>
<thead>
<tr>
{['Nom', 'Email', 'Rôle', 'Statut', 'Action'].map(col => (
<th key={col} style={thStyle}>{col}</th>
))}
</tr>
</thead>
<tbody>
{utilisateurs.map(u => (
<tr key={u.id} style={{ borderBottom: '1px solid #1f2937' }}>
<td style={tdStyle}>
{u.prenom} {u.nom}
</td>
<td style={tdStyle}>{u.email}</td>
<td style={tdStyle}>
<span style={{
backgroundColor: '#1f2937', color: '#00B4D8',
padding: '2px 8px', borderRadius: '12px', fontSize: '11px'
}}>
{u.role?.replace(/_/g, ' ')}
</span>
</td>
<td style={tdStyle}>
<span style={{
color: u.actif ? '#00C97A' : '#ef4444',
fontSize: '12px', fontWeight: '600'
}}>
{u.actif ? '✅ Actif' : '❌ Inactif'}
</span>
</td>
<td style={tdStyle}>
{u.actif && u.id !== utilisateur?.id && (
<button
onClick={() => desactiverUtilisateur(u.id)}
style={{ ...btnPetitStyle, color: '#ef4444' }}
>
Désactiver
</button>
)}
</td>
</tr>
))}
</tbody>
</table>
</div>
)}

{/* ===== ABONNEMENT ===== */}
{onglet === 'abonnement' && (
<div>
<h3 style={titreSectionStyle}>Mon abonnement</h3>

<div style={{
background: 'linear-gradient(135deg, #00B4D820, #00C97A10)',
border: '1px solid #00B4D840',
borderRadius: '12px', padding: '24px', marginBottom: '24px'
}}>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
<div>
<p style={{ color: '#00B4D8', fontSize: '13px', fontWeight: '600', margin: '0' }}>
PLAN ACTUEL
</p>
<h2 style={{ color: '#ffffff', fontSize: '28px', fontWeight: '700', margin: '8px 0' }}>
FacturaSecure Pro
</h2>
<p style={{ color: '#9ca3af', fontSize: '14px', margin: '0' }}>
990€/mois · Sans engagement · Résiliable à tout moment
</p>
</div>
<div style={{ textAlign: 'right' }}>
<span style={{
backgroundColor: etablissement?.statut_abonnement === 'actif' ? '#00C97A20' : '#FF8C0020',
color: etablissement?.statut_abonnement === 'actif' ? '#00C97A' : '#FF8C00',
padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '600'
}}>
{etablissement?.statut_abonnement === 'essai' ? '⏳ Période d\'essai' :
etablissement?.statut_abonnement === 'actif' ? '✅ Actif' : '❌ Suspendu'}
</span>
</div>
</div>
</div>

{etablissement?.statut_abonnement === 'essai' && (
<div style={{
backgroundColor: '#FF8C0015', border: '1px solid #FF8C0030',
borderRadius: '8px', padding: '16px', marginBottom: '20px'
}}>
<p style={{ color: '#FF8C00', fontSize: '14px', margin: '0' }}>
⏳ Votre période d'essai se termine le{' '}
<strong>
{etablissement?.date_fin_essai
? new Date(etablissement.date_fin_essai).toLocaleDateString('fr-FR')
: '—'}
</strong>
</p>
</div>
)}

<div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
{[
'✅ 41 fonctionnalités complètes',
'✅ Vérification automatique des factures',
'✅ Détection fraude RIB prioritaire',
'✅ Archivage légal 10 ans',
'✅ Support prioritaire téléphone',
'✅ Conformité RGPD + HDS',
'✅ Mises à jour incluses'
].map(item => (
<p key={item} style={{ color: '#d1d5db', fontSize: '14px', margin: '0' }}>{item}</p>
))}
</div>

<div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #1f2937' }}>
<p style={{ color: '#6b7280', fontSize: '13px' }}>
Pour toute question concernant votre abonnement, contactez-nous :
</p>
<p style={{ color: '#00B4D8', fontSize: '14px', fontWeight: '600' }}>
support@facturasecure.fr
</p>
</div>
</div>
)}

</div>
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

const titreSectionStyle = {
color: '#ffffff', fontSize: '16px',
fontWeight: '700', marginBottom: '20px'
};

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
padding: '4px 10px', borderRadius: '6px',
cursor: 'pointer', fontSize: '12px', fontWeight: '600',
color: '#9ca3af'
};

const thStyle = {
color: '#6b7280', fontSize: '12px', fontWeight: '600',
textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid #1f2937'
};

const tdStyle = { color: '#d1d5db', fontSize: '13px', padding: '12px' };
