import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';

const API = 'http://localhost:5000/api';

export default function Login({ setUtilisateur }) {
const navigate = useNavigate();
const [etape, setEtape] = useState('login'); // login, register
const [chargement, setChargement] = useState(false);

// Formulaire connexion
const [formLogin, setFormLogin] = useState({ email: '', mot_de_passe: '' });

// Formulaire inscription
const [formRegister, setFormRegister] = useState({
nom_etablissement: '',
siret: '',
type_etablissement: 'hopital',
email: '',
mot_de_passe: '',
nom: '',
prenom: ''
});

// ============================================
// CONNEXION
// ============================================
async function handleLogin(e) {
e.preventDefault();
setChargement(true);
try {
const { data } = await axios.post(`${API}/auth/login`, formLogin);
if (data.success) {
localStorage.setItem('token', data.token);
localStorage.setItem('utilisateur', JSON.stringify(data.utilisateur));
setUtilisateur(data.utilisateur);
toast.success('Connexion réussie !');
navigate('/dashboard');
}
} catch (err) {
toast.error(err.response?.data?.message || 'Erreur de connexion');
} finally {
setChargement(false);
}
}

// ============================================
// INSCRIPTION
// ============================================
async function handleRegister(e) {
e.preventDefault();
setChargement(true);
try {
const { data } = await axios.post(`${API}/auth/register`, formRegister);
if (data.success) {
localStorage.setItem('token', data.token);
localStorage.setItem('utilisateur', JSON.stringify(data.utilisateur));
setUtilisateur(data.utilisateur);
toast.success('Compte créé ! 30 jours d\'essai gratuit.');
navigate('/dashboard');
}
} catch (err) {
toast.error(err.response?.data?.message || 'Erreur lors de l\'inscription');
} finally {
setChargement(false);
}
}

return (
<div style={{
minHeight: '100vh',
backgroundColor: '#0a0f1e',
display: 'flex',
alignItems: 'center',
justifyContent: 'center',
fontFamily: 'Inter, sans-serif',
padding: '20px'
}}>
<div style={{
backgroundColor: '#111827',
borderRadius: '16px',
padding: '40px',
width: '100%',
maxWidth: '480px',
border: '1px solid #1f2937'
}}>

{/* Logo */}
<div style={{ textAlign: 'center', marginBottom: '32px' }}>
<div style={{ fontSize: '40px', marginBottom: '8px' }}>🛡️</div>
<h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: '700', margin: '0' }}>
FacturaSecure
</h1>
<p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
Contrôle automatique des factures fournisseurs
</p>
</div>

{/* Onglets */}
<div style={{
display: 'flex',
backgroundColor: '#1f2937',
borderRadius: '8px',
padding: '4px',
marginBottom: '28px'
}}>
{['login', 'register'].map((tab) => (
<button
key={tab}
onClick={() => setEtape(tab)}
style={{
flex: 1,
padding: '8px',
borderRadius: '6px',
border: 'none',
cursor: 'pointer',
fontSize: '14px',
fontWeight: '600',
backgroundColor: etape === tab ? '#00B4D8' : 'transparent',
color: etape === tab ? '#ffffff' : '#6b7280',
transition: 'all 0.2s'
}}
>
{tab === 'login' ? 'Connexion' : 'Inscription'}
</button>
))}
</div>

{/* ============ FORMULAIRE CONNEXION ============ */}
{etape === 'login' && (
<form onSubmit={handleLogin}>
<div style={{ marginBottom: '16px' }}>
<label style={labelStyle}>Email</label>
<input
type="email"
required
placeholder="votre@email.fr"
value={formLogin.email}
onChange={e => setFormLogin({ ...formLogin, email: e.target.value })}
style={inputStyle}
/>
</div>

<div style={{ marginBottom: '24px' }}>
<label style={labelStyle}>Mot de passe</label>
<input
type="password"
required
placeholder="••••••••"
value={formLogin.mot_de_passe}
onChange={e => setFormLogin({ ...formLogin, mot_de_passe: e.target.value })}
style={inputStyle}
/>
</div>

<button type="submit" disabled={chargement} style={btnStyle}>
{chargement ? 'Connexion...' : 'Se connecter'}
</button>
</form>
)}

{/* ============ FORMULAIRE INSCRIPTION ============ */}
{etape === 'register' && (
<form onSubmit={handleRegister}>
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
<div>
<label style={labelStyle}>Prénom</label>
<input
type="text"
required
placeholder="Jean"
value={formRegister.prenom}
onChange={e => setFormRegister({ ...formRegister, prenom: e.target.value })}
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Nom</label>
<input
type="text"
required
placeholder="Dupont"
value={formRegister.nom}
onChange={e => setFormRegister({ ...formRegister, nom: e.target.value })}
style={inputStyle}
/>
</div>
</div>

<div style={{ marginBottom: '16px' }}>
<label style={labelStyle}>Nom de l'établissement</label>
<input
type="text"
required
placeholder="Clinique Saint-Jean"
value={formRegister.nom_etablissement}
onChange={e => setFormRegister({ ...formRegister, nom_etablissement: e.target.value })}
style={inputStyle}
/>
</div>

<div style={{ marginBottom: '16px' }}>
<label style={labelStyle}>SIRET</label>
<input
type="text"
required
placeholder="12345678901234"
maxLength={14}
value={formRegister.siret}
onChange={e => setFormRegister({ ...formRegister, siret: e.target.value })}
style={inputStyle}
/>
</div>

<div style={{ marginBottom: '16px' }}>
<label style={labelStyle}>Type d'établissement</label>
<select
value={formRegister.type_etablissement}
onChange={e => setFormRegister({ ...formRegister, type_etablissement: e.target.value })}
style={inputStyle}
>
<option value="hopital">Hôpital</option>
<option value="clinique">Clinique privée</option>
<option value="ehpad">EHPAD / Maison de retraite</option>
<option value="mairie">Mairie / Collectivité</option>
<option value="pme">PME</option>
<option value="autre">Autre</option>
</select>
</div>

<div style={{ marginBottom: '16px' }}>
<label style={labelStyle}>Email</label>
<input
type="email"
required
placeholder="votre@email.fr"
value={formRegister.email}
onChange={e => setFormRegister({ ...formRegister, email: e.target.value })}
style={inputStyle}
/>
</div>

<div style={{ marginBottom: '24px' }}>
<label style={labelStyle}>Mot de passe</label>
<input
type="password"
required
placeholder="••••••••"
minLength={8}
value={formRegister.mot_de_passe}
onChange={e => setFormRegister({ ...formRegister, mot_de_passe: e.target.value })}
style={inputStyle}
/>
</div>

<button type="submit" disabled={chargement} style={btnStyle}>
{chargement ? 'Création...' : 'Commencer l\'essai gratuit (30 jours)'}
</button>

<p style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', marginTop: '12px' }}>
Sans engagement — résiliable à tout moment
</p>
</form>
)}

</div>
</div>
);
}

// ============================================
// STYLES
// ============================================
const labelStyle = {
display: 'block',
color: '#9ca3af',
fontSize: '13px',
fontWeight: '500',
marginBottom: '6px'
};

const inputStyle = {
width: '100%',
padding: '10px 14px',
backgroundColor: '#1f2937',
border: '1px solid #374151',
borderRadius: '8px',
color: '#ffffff',
fontSize: '14px',
outline: 'none',
boxSizing: 'border-box'
};

const btnStyle = {
width: '100%',
padding: '12px',
backgroundColor: '#00B4D8',
color: '#ffffff',
border: 'none',
borderRadius: '8px',
fontSize: '15px',
fontWeight: '600',
cursor: 'pointer'
};
