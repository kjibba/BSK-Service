import './App.css';
import { AuthProvider } from './components/auth.jsx';
import { useAuth } from './components/hooks/useAuth'
import { ToastProvider } from './components/ui/Toast.jsx'
import { lazy, Suspense, useEffect, useRef, useState, useMemo } from 'react';

// Lazy-load pages/components that are relatively heavy
const CustomerList = lazy(() => import('./components/CustomerList.jsx'))
const MapView = lazy(() => import('./components/MapView.jsx'))
const MyMissions = lazy(() => import('./components/MyMissions.jsx'))
const VisitDetail = lazy(() => import('./components/VisitDetail.jsx'))
const EquipmentService = lazy(() => import('./components/EquipmentService.jsx'))
const Employees = lazy(() => import('./components/Employees.jsx'))
const EquipmentTypesManager = lazy(() => import('./components/EquipmentTypesManager.jsx'))
const CustomerDetail = lazy(() => import('./components/CustomerDetail.jsx'))
const FeedbackAdmin = lazy(() => import('./components/FeedbackAdmin.jsx'))
const Login = lazy(() => import('./components/Login.jsx'))

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
  const mainRef = useRef(null)
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.slice(1));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // Move focus to main on route change for accessibility
  useEffect(() => {
    const el = mainRef.current
    if (el) {
      // ensure focus after render
      setTimeout(() => {
      try { el.focus({ preventScroll: true }) } catch (e) { console.debug(e) }
      }, 0)
    }
  }, [route])
  const isMap = route === 'map';
  const isMissions = route === 'missions';
  const isVisit = route.startsWith('visit:');
  const visitId = isVisit ? Number(route.split(':')[1]) : null;
  const isService = route.startsWith('service:');
  const [serviceVisitId, serviceEquipmentId] = useMemo(() => {
    if (!isService) return [null, null];
    const parts = route.split(':');
    return [Number(parts[1]), Number(parts[2])];
  }, [route]);
  const isEmployees = route === 'employees';
  const isEquipTypes = route === 'equipment-types';
  const isFeedbackAdmin = route === 'feedback'
  const isCustomer = route.startsWith('customer:');
  const customerId = isCustomer ? Number(route.split(':')[1]) : null;
  const isLogin = route === 'login';
  return (
  <AuthProvider>
  <ToastProvider>
  <div>
  <a href="#main" className="sr-only sr-only-focusable">Hopp til innhold</a>
  <SiteHeader route={route} />
  <Hero />
      <main id="main" ref={mainRef} tabIndex={-1} className="container" style={{padding:'2rem 1rem'}}>
        <Suspense fallback={<p>Laster…</p>}>
          {isService ? (
            <EquipmentService visitId={serviceVisitId} equipmentId={serviceEquipmentId} />
          ) : isVisit ? (
            <VisitDetail visitId={visitId} />
          ) : isCustomer ? (
            <CustomerDetail customerId={customerId} />
          ) : isMissions ? (
            <MyMissions />
          ) : isEmployees ? (
            <Employees />
          ) : isEquipTypes ? (
            <EquipmentTypesManager />
          ) : isFeedbackAdmin ? (
            <FeedbackAdmin />
          ) : isLogin ? (
            <Login />
          ) : isMap ? (
            <MapView />
          ) : (
            <CustomerList />
          )}
        </Suspense>
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
    </ToastProvider>
    </AuthProvider>
  );
}

export default App;

function SiteHeader({ route }){
  const { user } = useAuth()
  const isManager = user?.role === 'manager'
  const active = (r) => (route === r ? 'active' : '')
  return (
  <header className="site-header">
      <div className="container" style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.75rem 1rem'}}>
        <div className="brand" style={{display:'flex', alignItems:'center', gap:10}}>
          <img src="/logo.png" alt="Bergen Skadedyrkontroll AS" style={{height:36}} />
          <span>Bergen Skadedyrkontroll — Service</span>
        </div>
        {/* On mobile, hide the nav links for compactness; keep them on desktop */}
        <nav className="nav mobile-hide">
          <a href="#customers" className={`nav-link ${active('customers')}`} aria-current={route==='customers' ? 'page' : undefined}>Kunder</a>
          <a href="#map" className={`nav-link ${active('map')}`} aria-current={route==='map' ? 'page' : undefined}>Kart</a>
          <a href="#missions" className={`nav-link ${active('missions')}`} aria-current={route==='missions' ? 'page' : undefined}>Mine oppdrag</a>
          {isManager && <a href="#employees" className={`nav-link mobile-hide ${active('employees')}`} aria-current={route==='employees' ? 'page' : undefined}>Ansatte</a>}
          {isManager && <a href="#equipment-types" className={`nav-link mobile-hide ${active('equipment-types')}`} aria-current={route==='equipment-types' ? 'page' : undefined}>Utstyrstyper</a>}
          {isManager && <a href="#feedback" className={`nav-link mobile-hide ${active('feedback')}`} aria-current={route==='feedback' ? 'page' : undefined}>Feedback</a>}
        </nav>
        {/* On mobile, only show login/user at top-right for cleanliness. Replace text with username when logged in. */}
        <a href="#login" className="nav-link login-link">{user ? (user.name || user.email || 'Min profil') : 'Logg inn'}</a>
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