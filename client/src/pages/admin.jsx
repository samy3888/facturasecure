import React, { useState, useEffect } from 'react';

const API = process.env.REACT_APP_API_URL;

export default function Admin() {
const [utilisateurs, setUtilisateurs] = useState([]);
const [message, setMessage] = useState('');

useEffect(() => {
fetch(`${API}/admin/utilisateurs`)
.then(r => r.json())
.then(setUtilisateurs);
}, []);

const action = async (id, type) => {
await fetch(`${API}/admin/${type}/${id}`, { method: 'PUT' });
setMessage(`Utilisateur ${type} !`);
setUtilisateurs(utilisateurs.filter(u => u.id !== id));
};

const supprimer = async (id) => {
await fetch(`${API}/admin/supprimer/${id}`, { method: 'DELETE' });
setMessage('Utilisateur supprimé !');
setUtilisateurs(utilisateurs.filter(u => u.id !== id));
};

return (
<div style={{ padding: 30, color: 'white', background: '#0d1b2a', minHeight: '100vh' }}>
<h1 style={{ color: '#00B4D8' }}>Panel Admin FacturaSecure</h1>
{message && <p style={{ color: '#00C97A' }}>{message}</p>}
<p>Total utilisateurs : {utilisateurs.length}</p>
{utilisateurs.map(u => (
<div key={u.id} style={{ background: '#1a2a3a', padding: 15, marginBottom: 10, borderRadius: 8 }}>
<p><b>{u.email}</b> — {u.nom} {u.prenom}</p>
<p>Statut : <span style={{ color: u.statut === 'validé' ? '#00C97A' : '#E63946' }}>{u.statut || 'en_attente'}</span></p>
<button onClick={() => action(u.id, 'valider')} style={{ background: '#00C97A', color: 'white', marginRight: 10, padding: '5px 15px', borderRadius: 5, border: 'none', cursor: 'pointer' }}>✅ Valider</button>
<button onClick={() => action(u.id, 'refuser')} style={{ background: '#FF8C00', color: 'white', marginRight: 10, padding: '5px 15px', borderRadius: 5, border: 'none', cursor: 'pointer' }}>❌ Refuser</button>
<button onClick={() => supprimer(u.id)} style={{ background: '#E63946', color: 'white', padding: '5px 15px', borderRadius: 5, border: 'none', cursor: 'pointer' }}>🗑️ Supprimer</button>
</div>
))}
</div>
);
}
