import './App.css';
import CustomerList from './components/CustomerList.jsx';
import MapView from './components/MapView.jsx';
import MyMissions from './components/MyMissions.jsx';
import VisitDetail from './components/VisitDetail.jsx';
import { AuthProvider, useAuth } from './components/auth.jsx';
import Employees from './components/Employees.jsx';
import Login from './components/Login.jsx';

import { useEffect, useState } from 'react';

function App() {
  const [route, setRoute] = useState(() => {
    if (typeof window === 'undefined') return 'map';
    const h = window.location.hash.slice(1);
    if (h) return h;
    try {
      return window.matchMedia && window.matchMedia('(max-width: 640px)').matches ? 'map' : 'customers';
    } catch {
      return 'customers';
    }
  });
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.slice(1));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const isMap = route === 'map';
  const isMissions = route === 'missions';
  const isVisit = route.startsWith('visit:');
  const visitId = isVisit ? Number(route.split(':')[1]) : null;
  const isEmployees = route === 'employees';
  const isLogin = route === 'login';
  return (
    <AuthProvider>
    <div>
  <SiteHeader />
  <Hero />
      <main className="container" style={{padding:'2rem 1rem'}}>
        {isVisit ? (
          <VisitDetail visitId={visitId} />
        ) : isMissions ? (
          <MyMissions />
        ) : isEmployees ? (
          <Employees />
        ) : isLogin ? (
          <Login />
        ) : isMap ? (
          <MapView />
        ) : (
          <CustomerList />
        )}
      </main>
      {/* Mobile bottom tab bar */}
      <div className="bottom-tabbar">
        <div className="container inner">
          <a className={`tab-btn ${(!isMap && !isMissions && !isVisit) ? 'active' : ''}`} href="#customers">Kunder</a>
          <a className={`tab-btn ${isMap ? 'active' : ''}`} href="#map">Kart</a>
          <a className={`tab-btn ${isMissions ? 'active' : ''}`} href="#missions">Mine oppdrag</a>
        </div>
      </div>
      <SiteFooter />
    </div>
    </AuthProvider>
  );
}

export default App;

function SiteHeader(){
  const { user } = useAuth()
  const isManager = user?.role === 'manager'
  return (
  <header className="site-header">
      <div className="container" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.75rem 1rem'}}>
        <div className="brand" style={{display:'flex', alignItems:'center', gap:10}}>
          <img src="/logo.png" alt="Bergen Skadedyrkontroll AS" style={{height:36}} />
          <span>Bergen Skadedyrkontroll — Service</span>
        </div>
        <nav className="nav">
          <a href="#customers" className="nav-link">Kunder</a>
          <a href="#map" className="nav-link">Kart</a>
          <a href="#missions" className="nav-link mobile-hide">Mine oppdrag</a>
          {isManager && <a href="#employees" className="nav-link mobile-hide">Ansatte</a>}
        </nav>
        <a href="#login" className="nav-link login-link">Logg inn</a>
      </div>
    </header>
  )
}

function Hero(){
  return (
  <section className="surface hero">
      <div className="container" style={{padding:'2rem 1rem', textAlign:'center'}}>
        <h1>Vi bekjemper skadedyr — og vi holder styr på servicearbeidet</h1>
        <p>Internt verktøy for kunder, besøk, utstyr og servicelogger.</p>
      </div>
    </section>
  )
}

function SiteFooter(){
  return (
    <footer style={{background:'#0f172a', color:'#fff', marginTop:40}}>
      <div className="container" style={{padding:'1rem'}}>
        <p>© {new Date().getFullYear()} Bergen Skadedyrkontroll</p>
      </div>
    </footer>
  )
}