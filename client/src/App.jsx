import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useState, useEffect } from 'react';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Factures from './pages/Factures';
import Fournisseurs from './pages/Fournisseurs';
import Alertes from './pages/Alertes';
import Rapports from './pages/Rapports';
import Parametres from './pages/Parametres';

// ============================================
// ROUTE PROTÉGÉE
// ============================================
function RouteProtegee({ children }) {
const token = localStorage.getItem('token');
if (!token) return <Navigate to="/login" replace />;
return children;
}

// ============================================
// APP PRINCIPALE
// ============================================
export default function App() {
const [utilisateur, setUtilisateur] = useState(null);

useEffect(() => {
const userStocke = localStorage.getItem('utilisateur');
if (userStocke) {
setUtilisateur(JSON.parse(userStocke));
}
}, []);

return (
<Router>
{/* Notifications Toast */}
<ToastContainer
position="top-right"
autoClose={4000}
hideProgressBar={false}
newestOnTop
closeOnClick
pauseOnHover
theme="dark"
/>

<Routes>
{/* Pages publiques */}
<Route path="/login" element={<Login setUtilisateur={setUtilisateur} />} />
<Route path="/register" element={<Register />} />

{/* Pages protégées */}
<Route path="/dashboard" element={
<RouteProtegee>
<Dashboard utilisateur={utilisateur} />
</RouteProtegee>
} />

<Route path="/factures" element={
<RouteProtegee>
<Factures utilisateur={utilisateur} />
</RouteProtegee>
} />

<Route path="/fournisseurs" element={
<RouteProtegee>
<Fournisseurs utilisateur={utilisateur} />
</RouteProtegee>
} />

<Route path="/alertes" element={
<RouteProtegee>
<Alertes utilisateur={utilisateur} />
</RouteProtegee>
} />

<Route path="/rapports" element={
<RouteProtegee>
<Rapports utilisateur={utilisateur} />
</RouteProtegee>
} />

<Route path="/parametres" element={
<RouteProtegee>
<Parametres utilisateur={utilisateur} />
</RouteProtegee>
} />

{/* Redirection par défaut */}
<Route path="/" element={<Navigate to="/dashboard" replace />} />
<Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>
</Router>
);
}
