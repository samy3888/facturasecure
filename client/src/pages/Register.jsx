import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function Register() {
const navigate = useNavigate();
const [searchParams] = useSearchParams();
const token = searchParams.get('token');
const [chargement, setChargement] = useState(false);
const [invitation, setInvitation] = useState(null);
const [form, setForm] = useState({
prenom: '',
nom: '',
mot_de_passe: '',
confirmation: ''
});

useEffect(() => {
if (!token) {
toast.error('Lien d\'invitation invalide');
navigate('/login');
return;
}
verifierToken();
}, [token]);

async function verifierToken() {
try {
const { data } = await axios.get(`${API}/auth/invitation/${token}`);
if (data.success) {
setInvitation(data.invitation);
} else {
toast.error('Invitation expirée ou invalide');
navigate('/login');
}
} catch (err) {
toast.error('Invitation expirée ou invalide');
navigate('/login');
}
}

async function handleSubmit(e) {
e.preventDefault();

if (form.mot_de_passe !== form.confirmation) {
toast.error('Les mots de passe ne correspondent pas');
return;
}

if (form.mot_de_passe.length < 8) {
toast.error('Le mot de passe doit faire au moins 8 caractères');
return;
}

setChargement(true);
try {
const { data } = await axios.post(`${API}/auth/register-invitation`, {
token,
prenom: form.prenom,
nom: form.nom,
mot_de_passe: form.mot_de_passe
});

if (data.success) {
localStorage.setItem('token', data.token);
localStorage.setItem('utilisateur', JSON.stringify(data.utilisateur));
toast.success('Compte créé avec succès ! Bienvenue sur FacturaSecure !');
navigate('/dashboard');
}
} catch (err) {
toast.error(err.response?.data?.message || 'Erreur création du compte');
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
Créez votre compte
</p>
</div>

{/* Invitation info */}
{invitation && (
<div style={{
backgroundColor: '#00B4D810',
border: '1px solid #00B4D830',
borderRadius: '8px',
padding: '12px 16px',
marginBottom: '24px'
}}>
<p style={{ color: '#00B4D8', fontSize: '14px', margin: '0' }}>
✉️ Invitation pour : <strong>{invitation.email}</strong>
</p>
<p style={{ color: '#9ca3af', fontSize: '13px', margin: '4px 0 0' }}>
Rôle : <strong style={{ color: '#00B4D8' }}>{invitation.role?.replace(/_/g, ' ')}</strong>
</p>
</div>
)}

{/* Formulaire */}
<form onSubmit={handleSubmit}>
<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
<div>
<label style={labelStyle}>Prénom *</label>
<input
type="text"
required
placeholder="Jean"
value={form.prenom}
onChange={e => setForm({ ...form, prenom: e.target.value })}
style={inputStyle}
/>
</div>
<div>
<label style={labelStyle}>Nom *</label>
<input
type="text"
required
placeholder="Dupont"
value={form.nom}
onChange={e => setForm({ ...form, nom: e.target.value })}
style={inputStyle}
/>
</div>
</div>

<div>
<label style={labelStyle}>Mot de passe *</label>
<input
type="password"
required
placeholder="••••••••"
minLength={8}
value={form.mot_de_passe}
onChange={e => setForm({ ...form, mot_de_passe: e.target.value })}
style={inputStyle}
/>
</div>

<div>
<label style={labelStyle}>Confirmer le mot de passe *</label>
<input
type="password"
required
placeholder="••••••••"
value={form.confirmation}
onChange={e => setForm({ ...form, confirmation: e.target.value })}
style={inputStyle}
/>
</div>

<button
type="submit"
disabled={chargement}
style={{
backgroundColor: '#00B4D8',
color: '#ffffff',
border: 'none',
padding: '12px',
borderRadius: '8px',
fontSize: '15px',
fontWeight: '600',
cursor: chargement ? 'not-allowed' : 'pointer',
opacity: chargement ? 0.7 : 1,
marginTop: '8px'
}}
>
{chargement ? 'Création en cours...' : '✅ Créer mon compte'}
</button>

</div>
</form>

<p style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', marginTop: '16px' }}>
En créant votre compte vous acceptez les conditions d'utilisation de FacturaSecure
</p>

</div>
</div>
);
}

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
