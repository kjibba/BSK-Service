import './App.css';
import { AuthProvider } from './components/auth.jsx';
import { useAuth } from './components/hooks/useAuth'
import { ToastProvider, useToast } from './components/ui/Toast.jsx'
import { lazy, Suspense, useEffect, useRef, useState, useMemo } from 'react';
import ErrorBoundary from './components/Boundary.jsx'
import FeedbackButton from './components/FeedbackButton.jsx'

// Lazy-load pages/components that are relatively heavy
const CustomerList = lazy(() => import('./components/CustomerList.jsx'))
const MapView = lazy(() => import('./components/MapView.jsx'))
const MyMissions = lazy(() => import('./components/MyMissions.jsx'))
 const MyRoute = lazy(() => import('./components/MyRoute.jsx'))
const VisitDetail = lazy(() => import('./components/VisitDetail.jsx'))
const EquipmentService = lazy(() => import('./components/EquipmentService.jsx'))
const Employees = lazy(() => import('./components/Employees.jsx'))
const EmployeeDetail = lazy(() => import('./components/EmployeeDetail.jsx'))
const EquipmentTypesManager = lazy(() => import('./components/EquipmentTypesManager.jsx'))
const CustomerDetail = lazy(() => import('./components/CustomerDetail.jsx'))
const FeedbackAdmin = lazy(() => import('./components/FeedbackAdmin.jsx'))
const ReportsAdmin = lazy(() => import('./components/ReportsAdmin.jsx'))
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
  const isRoute = route === 'route';
  const isVisit = route.startsWith('visit:');
  const visitId = isVisit ? Number(route.split(':')[1]) : null;
  const isService = route.startsWith('service:');
  const [serviceVisitId, serviceEquipmentId] = useMemo(() => {
    if (!isService) return [null, null];
    const parts = route.split(':');
    return [Number(parts[1]), Number(parts[2])];
  }, [route]);
  const isEmployees = route === 'employees';
  const isEmployeeNew = route === 'employee:new';
  const isEmployee = !isEmployeeNew && route.startsWith('employee:');
  const employeeId = isEmployee ? Number(route.split(':')[1]) : null;
  const isEquipTypes = route === 'equipment-types';
  const isFeedbackAdmin = route === 'feedback'
  const isReports = route === 'reports'
  const isCustomer = route.startsWith('customer:');
  const customerId = isCustomer ? Number(route.split(':')[1]) : null;
  const isLogin = route === 'login';
  return (
  <AuthProvider>
  <ToastProvider>
  <ToastBridge />
  <div>
  <a href="#main" className="sr-only sr-only-focusable">Hopp til innhold</a>
  <SiteHeader route={route} />
  <Hero />
      <main id="main" ref={mainRef} tabIndex={-1} className="container" style={{padding:'2rem 1rem'}}>
        <ErrorBoundary>
        <Suspense fallback={<p>Laster…</p>}>
          {isService ? (
            <EquipmentService visitId={serviceVisitId} equipmentId={serviceEquipmentId} />
          ) : isVisit ? (
            <VisitDetail visitId={visitId} />
          ) : isCustomer ? (
            <CustomerDetail customerId={customerId} />
          ) : isMissions ? (
            <MyMissions />
           ) : isRoute ? (
             <MyRoute />
          ) : isEmployees ? (
            <Employees />
          ) : isEmployeeNew ? (
            <EmployeeDetail id={'new'} />
          ) : isEmployee ? (
            <EmployeeDetail id={employeeId} />
          ) : isEquipTypes ? (
            <EquipmentTypesManager />
          ) : isFeedbackAdmin ? (
            <FeedbackAdmin />
          ) : isReports ? (
            <ReportsAdmin />
          ) : isLogin ? (
            <Login />
          ) : isMap ? (
            <MapView />
          ) : (
            <CustomerList />
          )}
        </Suspense>
        </ErrorBoundary>
      </main>
  {/* Global feedback button */}
  <FeedbackButton context={{ page: route }} />
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

// Bridge global error events from api → Toasts
function ToastBridge(){
  const { push } = useToast()
  useEffect(() => {
    const onToast = (e) => {
      const { variant, title, description, timeout } = e.detail || {}
      push({ variant, title, description, timeout })
    }
    window.addEventListener('app:toast', onToast)
    return () => window.removeEventListener('app:toast', onToast)
  }, [push])
  return null
}

function SiteHeader({ route }){
  const { user } = useAuth()
  const [helpOpen, setHelpOpen] = useState(false)
  const [health, setHealth] = useState('')
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('bsk:theme') || 'light' } catch { return 'light' }
  })
  useEffect(() => {
    try { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('bsk:theme', theme) } catch(e) { console.debug(e) }
  }, [theme])
  // Lightweight health ping (no backend changes)
  useEffect(() => {
    let cancelled = false
    const ping = async () => {
      try {
        const r = await fetch('/health', { credentials: 'same-origin' })
        if (cancelled) return
        setHealth(r.ok ? 'OK' : `HTTP ${r.status}`)
      } catch (e) {
        if (cancelled) return
        setHealth('Ned')
      }
    }
    ping()
    const id = setInterval(ping, 30000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])
  const isManager = user?.role === 'manager'
  const isAdmin = user?.role === 'admin'
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
          <a href="#missions" className={`nav-link ${active('missions')}`} aria-current={route==='missions' ? 'page' : undefined}>Oppdrag</a>
          <a href="#route" className={`nav-link ${active('route')}`} aria-current={route==='route' ? 'page' : undefined}>Dagsrute</a>
          {isManager && <a href="#employees" className={`nav-link mobile-hide ${active('employees')}`} aria-current={route==='employees' ? 'page' : undefined}>Ansatte</a>}
          {/* Admin-visning fjernet; MyMissions viser alt for leder */}
          {isManager && <a href="#equipment-types" className={`nav-link mobile-hide ${active('equipment-types')}`} aria-current={route==='equipment-types' ? 'page' : undefined}>Utstyr</a>}
          {isManager && <a href="#feedback" className={`nav-link mobile-hide ${active('feedback')}`} aria-current={route==='feedback' ? 'page' : undefined}>Feedback</a>}
          {(isManager || isAdmin) && <a href="#reports" className={`nav-link mobile-hide ${active('reports')}`} aria-current={route==='reports' ? 'page' : undefined}>Rapporter</a>}
        </nav>
           {/* actions (login + theme toggle) positioned to the right */}
           <div className="header-actions" aria-hidden={false}>
             <span title="Backend health" style={{fontSize:12, marginRight:8, opacity:.8}}>API: {health || '...'}</span>
             <a href="#login" className="nav-link login-link">{user ? (user.name || user.email || 'Min profil') : 'Logg inn'}</a>
             <button className="btn" title="Hjelp" aria-label="Vis hjelp for siden" onClick={()=> setHelpOpen(true)}>?</button>
             <button title={theme === 'dark' ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'} className="theme-toggle-btn btn" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} aria-pressed={theme==='dark'} style={{padding:'6px 8px'}}>{theme === 'dark' ? '☀️' : '🌙'}</button>
           </div>
      {helpOpen && <HelpOverlay route={route} onClose={()=> setHelpOpen(false)} />}
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

function HelpOverlay({ route, onClose }){
  const tip = (() => {
    if (route.startsWith('customer:')) return 'Kundedetaljer: Bruk kartet for å flytte/redigere utstyr. Klikk «+ Legg til nytt utstyr» for å plassere nytt.'
    if (route === 'customers') return 'Kunder: Søk etter navn, adresse eller kundens ID. Klikk en rad for detaljer.'
    if (route === 'map') return 'Kart: Trykk på markører for info og handlinger. Bruk lagknappen for å bytte bakgrunn.'
    if (route === 'missions') return 'Oppdrag: Ledere kan tildele via nedtrekksmeny. Teknikere kan starte oppdrag og logge arbeid.'
    if (route === 'employees') return 'Ansatte: Opprett, oppdater, sett inaktiv og se detaljer. Inaktive vises med rød etikett.'
    if (route === 'equipment-types') return 'Utstyrstyper: Administrer felter og egenskaper for ulike utstyr.'
    if (route === 'feedback') return 'Feedback: Se innsendt tilbakemelding og oppdater status.'
    return 'Naviger via menyen. Bruk «Send tilbakemelding» for forslag og feilrapporter.'
  })()
  return (
    <div role="dialog" aria-modal="true" style={{position:'fixed',inset:0,background:'rgba(2,6,23,0.4)',zIndex:4500,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:'#fff',border:'1px solid var(--border)',borderRadius:10,boxShadow:'var(--shadow)',maxWidth:520,width:'100%',padding:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontWeight:700}}>Hjelp</div>
          <button className="btn" onClick={onClose} aria-label="Lukk">Lukk</button>
        </div>
        <div style={{marginTop:8,color:'#475569'}}>{tip}</div>
      </div>
    </div>
  )
}