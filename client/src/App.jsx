import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  Link,
  NavLink,
  Routes,
  Route,
  useNavigate,
  useParams,
  useSearchParams,
  Navigate,
  useLocation
} from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import {
  Car,
  MapPin,
  CalendarDays,
  ArrowRight,
  ShieldCheck,
  Search,
  Star,
  User,
  LogOut,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  Plus,
  FileText,
  Users,
  Shield,
  BarChart2,
  Layers,
  Wrench,
  Filter,
  Check,
  Eye,
  CreditCard,
  Phone,
  Mail,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

// ==========================================
// 1. UTILITIES & API CLIENT
// ==========================================

const api = async (path, opts = {}) => {
  const r = await fetch('/api' + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const contentType = r.headers.get('content-type');
  let j = null;
  if (contentType && contentType.includes('application/json')) {
    j = await r.json();
  }
  if (!r.ok) {
    throw new Error((j && j.error) || `Request failed with status ${r.status}`);
  }
  return j;
};

const money = n =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

function parsePeriod(p) {
  if (!p) return { start: null, end: null, formatted: '—', days: 1 };
  try {
    const raw = String(p).replace(/^[\[\(]/, '').replace(/[\]\)]$/, '');
    const parts = raw.split(',');
    const s = parts[0]?.replace(/^"|"$/g, '').trim();
    const e = parts[1]?.replace(/^"|"$/g, '').trim();
    const startDate = s ? new Date(s) : null;
    const endDate = e ? new Date(e) : null;
    if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      const ms = endDate.getTime() - startDate.getTime();
      const days = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
      const sFormatted = startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const eFormatted = endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      return {
        startDate,
        endDate,
        days,
        formatted: `${sFormatted} → ${eFormatted} (${days} day${days > 1 ? 's' : ''})`,
      };
    }
  } catch (err) {}
  return { startDate: null, endDate: null, formatted: String(p), days: 1 };
}

// ==========================================
// 2. AUTH CONTEXT & PROVIDER
// ==========================================

const AuthContext = createContext({
  user: null,
  loading: true,
  refreshUser: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const data = await api('/auth/me');
      setUser(data.user || null);
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      toast.success('Logged out successfully');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ==========================================
// 3. COMMON UI COMPONENTS
// ==========================================

function StatusChip({ status }) {
  const s = String(status || '').toLowerCase();
  return <span className={`status ${s}`}>{status}</span>;
}

function RoleChip({ role }) {
  const r = String(role || '').toLowerCase();
  return <span className={`chip chip-${r}`}>{role}</span>;
}

function ActionChip({ action }) {
  const a = String(action || '').toUpperCase();
  const cls = a === 'INSERT' ? 'chip-insert' : a === 'UPDATE' ? 'chip-update' : 'chip-delete';
  return <span className={`chip ${cls}`}>{action}</span>;
}

function Modal({ title, children, onClose, maxWidth = '540px' }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', letterSpacing: '-0.5px' }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#748079', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AdminNav() {
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', borderBottom: '1px solid #e8eeeb', paddingBottom: '14px', flexWrap: 'wrap' }}>
      <NavLink to="/admin" end className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
      <NavLink to="/fleet" className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}>Fleet Manager</NavLink>
      <NavLink to="/users" className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}>Users</NavLink>
      <NavLink to="/audit" className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}>Audit Log</NavLink>
      <NavLink to="/masters" className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}>Masters</NavLink>
    </div>
  );
}

function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => {
    await logout();
    nav('/');
  };

  return (
    <>
      <header>
        <Link className="logo" to="/">
          <span className="logo-mark"><Car size={20} /></span> go<span>drive</span>
        </Link>
        <nav>
          <NavLink to="/" end>Home</NavLink>
          {(!user || user.role === 'customer') && (
            <NavLink to="/search">Explore cars</NavLink>
          )}

          {user && user.role === 'customer' && (
            <>
              <NavLink to="/my-bookings">My bookings</NavLink>
              <NavLink to="/profile">Profile</NavLink>
            </>
          )}

          {user && user.role === 'staff' && (
            <NavLink to="/staff">Staff Board</NavLink>
          )}

          {user && user.role === 'admin' && (
            <>
              <NavLink to="/admin">Dashboard</NavLink>
              <NavLink to="/fleet">Fleet</NavLink>
              <NavLink to="/users">Users</NavLink>
              <NavLink to="/audit">Audit</NavLink>
              <NavLink to="/masters">Masters</NavLink>
            </>
          )}

          {!user ? (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <Link to="/login" style={{ fontWeight: 600 }}>Log in</Link>
              <Link className="primary" to="/signup" style={{ padding: '8px 16px', borderRadius: '8px' }}>
                Sign up <ArrowRight size={15} />
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={15} />
                <b>{user.full_name}</b>
                <RoleChip role={user.role} />
              </span>
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f2f6f4',
                  border: 0,
                  padding: '7px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <LogOut size={14} /> Log out
              </button>
            </div>
          )}
        </nav>
      </header>
      {children}
      <footer>
        GoDrive <span>·</span> Your next journey starts here <span>·</span> Chandigarh · Delhi · Jaipur
      </footer>
      <Toaster position="top-right" />
    </>
  );
}

// ==========================================
// 4. SCREEN 1: HOME (/)
// ==========================================

function Home() {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const fourDaysLater = new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0];

  const [city, setCity] = useState('Chandigarh');
  const [start, setStart] = useState(tomorrow);
  const [end, setEnd] = useState(fourDaysLater);
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    api('/vehicles?city=Chandigarh')
      .then(res => setFeatured(res.slice(0, 3)))
      .catch(() => {});
  }, []);

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <div className="eyebrow"><span /> EASY RENTALS. BETTER JOURNEYS.</div>
          <h1>Find your drive.<br /><em>Own the road.</em></h1>
          <p>Thoughtfully selected vehicles for every plan — from quick city runs to the long way home.</p>

          <div className="searchbox">
            <label>
              <MapPin />
              <span>Pickup city
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  style={{ border: 0, background: 'transparent', outline: 0, fontSize: '12px', color: '#26342e', fontWeight: 600 }}
                >
                  <option value="Chandigarh">Chandigarh</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Jaipur">Jaipur</option>
                </select>
              </span>
            </label>
            <label>
              <CalendarDays />
              <span>Pick-up
                <input type="date" value={start} onChange={e => setStart(e.target.value)} />
              </span>
            </label>
            <label>
              <CalendarDays />
              <span>Return
                <input type="date" value={end} onChange={e => setEnd(e.target.value)} />
              </span>
            </label>
            <Link
              className="search-btn"
              to={`/search?city=${encodeURIComponent(city)}&start=${start}&end=${end}`}
            >
              <Search size={18} /> Find a car
            </Link>
          </div>

          <div className="trust">
            <ShieldCheck /> Clear pricing <b>·</b> Verified fleet <b>·</b> 24/7 support
          </div>
        </div>

        <div className="hero-image">
          <img
            src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1500&q=85"
            alt="GoDrive Fleet"
          />
          <div className="float-card">
            <b>Drive your way</b>
            <span>Find the right car for every road.</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">MADE FOR YOUR NEXT PLAN</div>
            <h2>Choose your kind of drive</h2>
          </div>
          <Link to={`/search?city=${encodeURIComponent(city)}&start=${start}&end=${end}`}>
            View all vehicles <ArrowRight size={16} />
          </Link>
        </div>

        <div className="categories">
          {[
            { label: 'City friendly', cat: 'Hatchback', imgClass: 'cat0' },
            { label: 'Room for more', cat: 'Full-size SUV', imgClass: 'cat1' },
            { label: 'Open road', cat: 'Sedan', imgClass: 'cat2' },
          ].map(x => (
            <Link
              to={`/search?city=${encodeURIComponent(city)}&category=${encodeURIComponent(x.cat)}&start=${start}&end=${end}`}
              className="category"
              key={x.label}
            >
              <div className={`cat-img ${x.imgClass}`} />
              <span>{x.label}</span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="section" style={{ borderTop: '1px solid #edf0ee' }}>
          <div className="section-heading">
            <div>
              <div className="eyebrow">FEATURED FLEET</div>
              <h2>Popular rides in {city}</h2>
            </div>
            <Link to={`/search?city=${encodeURIComponent(city)}&start=${start}&end=${end}`}>
              Explore full fleet <ArrowRight size={16} />
            </Link>
          </div>

          <div className="car-grid">
            {featured.map(v => (
              <article className="car-card" key={v.vehicle_id}>
                <img
                  src={v.image_url || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80'}
                  alt={`${v.make} ${v.model}`}
                />
                <div className="car-body">
                  <div className="card-top">
                    <span>{v.category}</span>
                    <span><Star size={13} fill="currentColor" /> 4.9</span>
                  </div>
                  <h3>{v.make} {v.model}</h3>
                  <p>{v.city} · {v.seats} seats · {v.transmission}</p>
                  <div className="card-bottom">
                    <b>{money(v.base_daily_rate)} <small>/ day</small></b>
                    <Link to={`/checkout?vehicle_id=${v.vehicle_id}&start=${start}&end=${end}`}>
                      Book now <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ==========================================
// 5. SCREEN 2: SEARCH PAGE (/search)
// ==========================================

function SearchPage() {
  const [params, setParams] = useSearchParams();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const fourDaysLater = new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0];

  const cityParam = params.get('city') || '%';
  const startParam = params.get('start') || tomorrow;
  const endParam = params.get('end') || fourDaysLater;
  const categoryParam = params.get('category') || '';

  const [city, setCity] = useState(cityParam === '%' ? '' : cityParam);
  const [start, setStart] = useState(startParam);
  const [end, setEnd] = useState(endParam);
  const [category, setCategory] = useState(categoryParam);

  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const loadVehicles = () => {
    setBusy(true);
    setError('');
    let url = `/vehicles?city=${encodeURIComponent(city || '%')}&start=${start}&end=${end}`;
    if (category) url += `&category=${encodeURIComponent(category)}`;

    api(url)
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    loadVehicles();
  }, [params]);

  const handleSearchSubmit = e => {
    e.preventDefault();
    const newParams = {};
    if (city) newParams.city = city;
    if (start) newParams.start = start;
    if (end) newParams.end = end;
    if (category) newParams.category = category;
    setParams(newParams);
  };

  return (
    <main className="page">
      <div className="eyebrow">THE GO DRIVE COLLECTION</div>
      <h1>Find your next ride</h1>
      <p className="muted">Comfort, confidence, and a little more freedom.</p>

      {/* Search Filters Bar */}
      <form
        onSubmit={handleSearchSubmit}
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: '#f8faf9',
          border: '1px solid #e7ece9',
          padding: '16px',
          borderRadius: '14px',
          marginTop: '24px'
        }}
      >
        <div style={{ flex: '1', minWidth: '140px' }}>
          <label style={{ fontSize: '11px', color: '#68746e', display: 'block', marginBottom: '4px', fontWeight: 600 }}>CITY</label>
          <select
            value={city}
            onChange={e => setCity(e.target.value)}
            className="input-field"
          >
            <option value="">All Cities</option>
            <option value="Chandigarh">Chandigarh</option>
            <option value="Delhi">Delhi</option>
            <option value="Jaipur">Jaipur</option>
          </select>
        </div>

        <div style={{ flex: '1', minWidth: '140px' }}>
          <label style={{ fontSize: '11px', color: '#68746e', display: 'block', marginBottom: '4px', fontWeight: 600 }}>CATEGORY</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="input-field"
          >
            <option value="">All Categories</option>
            <option value="Hatchback">Hatchback</option>
            <option value="Sedan">Sedan</option>
            <option value="Compact SUV">Compact SUV</option>
            <option value="Full-size SUV">Full-size SUV</option>
            <option value="Luxury">Luxury</option>
          </select>
        </div>

        <div style={{ flex: '1', minWidth: '140px' }}>
          <label style={{ fontSize: '11px', color: '#68746e', display: 'block', marginBottom: '4px', fontWeight: 600 }}>PICK-UP</label>
          <input
            type="date"
            value={start}
            onChange={e => setStart(e.target.value)}
            className="input-field"
            required
          />
        </div>

        <div style={{ flex: '1', minWidth: '140px' }}>
          <label style={{ fontSize: '11px', color: '#68746e', display: 'block', marginBottom: '4px', fontWeight: 600 }}>RETURN</label>
          <input
            type="date"
            value={end}
            onChange={e => setEnd(e.target.value)}
            className="input-field"
            required
          />
        </div>

        <div style={{ alignSelf: 'flex-end' }}>
          <button type="submit" className="primary" style={{ padding: '10px 20px', borderRadius: '8px' }}>
            <Search size={16} /> Filter Cars
          </button>
        </div>
      </form>

      {busy ? (
        <div className="loading" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={18} className="animate-spin" /> Finding available cars…
        </div>
      ) : error ? (
        <div className="notice">
          {error} <button onClick={loadVehicles}>Retry</button>
        </div>
      ) : !items.length ? (
        <div className="empty">
          No vehicles found for those criteria. Try expanding your search to all cities or other dates.
        </div>
      ) : (
        <div className="car-grid">
          {items.map(v => (
            <article className="car-card" key={v.vehicle_id}>
              <img
                src={v.image_url || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80'}
                alt={`${v.make} ${v.model}`}
              />
              <div className="car-body">
                <div className="card-top">
                  <span>{v.category}</span>
                  <span><Star size={13} fill="currentColor" /> 4.9</span>
                </div>
                <h3>{v.make} {v.model}</h3>
                <p>{v.city} · {v.seats} seats · {v.fuel} · {v.transmission}</p>
                <div className="card-bottom">
                  <b>{money(v.base_daily_rate)} <small>/ day</small></b>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link
                      to={`/vehicle/${v.vehicle_id}?start=${start}&end=${end}`}
                      style={{ fontSize: '12px', fontWeight: 600, color: '#52615b', padding: '6px 10px', background: '#f2f6f4', borderRadius: '6px' }}
                    >
                      Details
                    </Link>
                    <Link
                      to={`/checkout?vehicle_id=${v.vehicle_id}&start=${start}&end=${end}`}
                      style={{ fontSize: '12px', fontWeight: 700, color: '#176b5b', padding: '6px 10px', background: '#eff6f2', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      Book <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}

// ==========================================
// 6. SCREEN 3: VEHICLE DETAIL PAGE (/vehicle/:id)
// ==========================================

function Vehicle() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const fourDaysLater = new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0];

  const [start, setStart] = useState(params.get('start') || tomorrow);
  const [end, setEnd] = useState(params.get('end') || fourDaysLater);
  const [v, setV] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/vehicles/' + id)
      .then(setV)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <main className="page"><div className="loading">Loading vehicle details…</div></main>;
  if (!v) return <main className="page"><div className="notice">Vehicle not found. <Link to="/search">Return to search</Link></div></main>;

  const reviews = Array.isArray(v.reviews) ? v.reviews : [];

  return (
    <main className="page">
      <div className="vehicle-hero">
        <img
          src={v.image_url || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1300&q=80'}
          alt={`${v.make} ${v.model}`}
        />
        <div>
          <div className="eyebrow">{v.category} · {v.city} · {v.branch_name}</div>
          <h1 style={{ fontSize: '42px', margin: '8px 0 16px' }}>{v.make} {v.model}</h1>
          <p style={{ color: '#65716d', fontSize: '15px', marginBottom: '18px' }}>
            Registration: <b>{v.reg_number}</b> · Branch: {v.branch_address}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', background: '#f8faf9', padding: '16px', borderRadius: '12px', marginBottom: '22px' }}>
            <div><span style={{ fontSize: '11px', color: '#748079' }}>FUEL</span><br /><b>{v.fuel?.toUpperCase()}</b></div>
            <div><span style={{ fontSize: '11px', color: '#748079' }}>TRANSMISSION</span><br /><b>{v.transmission?.toUpperCase()}</b></div>
            <div><span style={{ fontSize: '11px', color: '#748079' }}>SEATING</span><br /><b>{v.seats} Passenger Seats</b></div>
            <div><span style={{ fontSize: '11px', color: '#748079' }}>YEAR</span><br /><b>{v.manufacture_year}</b></div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #e7ece9', padding: '18px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', color: '#65716d' }}>Daily Rental Rate</span>
              <strong style={{ fontSize: '24px', color: '#176b5b' }}>{money(v.base_daily_rate)} <small style={{ fontSize: '12px', color: '#748079' }}>/ day</small></strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#65716d', fontWeight: 600 }}>PICK-UP</label>
                <input type="date" value={start} onChange={e => setStart(e.target.value)} className="input-field" />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#65716d', fontWeight: 600 }}>RETURN</label>
                <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="input-field" />
              </div>
            </div>

            <Link
              className="primary"
              to={`/checkout?vehicle_id=${v.vehicle_id}&start=${start}&end=${end}`}
              style={{ width: '100%', justifyContent: 'center', borderRadius: '8px' }}
            >
              Book this car <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <section className="panel" style={{ marginTop: '36px' }}>
        <h2>Comfort and Reliability</h2>
        <p style={{ color: '#65716d', maxWidth: '750px', marginTop: '8px' }}>
          Every vehicle in our fleet undergoes a comprehensive 40-point maintenance inspection prior to each booking.
          Includes 24/7 roadside assistance, sanitized cabin, and fully comprehensive commercial insurance.
        </p>

        <div style={{ marginTop: '28px', borderTop: '1px solid #edf0ee', paddingTop: '22px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Star size={18} fill="#e9a75c" color="#e9a75c" /> Verified Guest Reviews ({reviews.length})
          </h3>

          {!reviews.length ? (
            <p className="muted" style={{ fontStyle: 'italic' }}>
              No reviews yet for this vehicle. Be the first to take it on a journey and leave a review!
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {reviews.map((r, i) => (
                <div key={i} style={{ padding: '14px', background: '#f8faf9', borderRadius: '10px', border: '1px solid #edf0ee' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#e9a75c', marginBottom: '6px' }}>
                    {Array.from({ length: r.rating || 5 }).map((_, si) => (
                      <Star key={si} size={14} fill="currentColor" />
                    ))}
                    <span style={{ fontSize: '12px', color: '#65716d', marginLeft: '6px' }}>
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', color: '#26342e' }}>"{r.comment || 'Smooth ride and great condition.'}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

// ==========================================
// 7. SCREEN 4: BOOKING CHECKOUT PAGE (/checkout)
// ==========================================

function Checkout() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const vehicleId = params.get('vehicle_id');
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const fourDaysLater = new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0];

  const [start, setStart] = useState(params.get('start') || tomorrow);
  const [end, setEnd] = useState(params.get('end') || fourDaysLater);

  const [vehicle, setVehicle] = useState(null);
  const [branches, setBranches] = useState([]);
  const [extras, setExtras] = useState([]);

  const [pickupBranchId, setPickupBranchId] = useState('');
  const [dropBranchId, setDropBranchId] = useState('');
  const [selectedExtras, setSelectedExtras] = useState(new Set());
  const [method, setMethod] = useState('card');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');

  useEffect(() => {
    if (!vehicleId) {
      setLoading(false);
      return;
    }

    Promise.all([
      api('/vehicles/' + vehicleId),
      api('/branches'),
      api('/extras'),
    ])
      .then(([v, b, e]) => {
        setVehicle(v);
        setBranches(b);
        setExtras(e);
        if (v && v.branch_id) {
          setPickupBranchId(String(v.branch_id));
          setDropBranchId(String(v.branch_id));
        } else if (b.length > 0) {
          setPickupBranchId(String(b[0].branch_id));
          setDropBranchId(String(b[0].branch_id));
        }
      })
      .catch(err => setErrorNotice(err.message))
      .finally(() => setLoading(false));
  }, [vehicleId]);

  if (!vehicleId) {
    return (
      <main className="page">
        <div className="notice">
          No vehicle selected for checkout. <Link to="/search">Browse our fleet →</Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return <main className="page"><div className="loading">Preparing checkout…</div></main>;
  }

  if (!vehicle) {
    return (
      <main className="page">
        <div className="notice">
          {errorNotice || 'Vehicle not found.'} <Link to="/search">Return to fleet search</Link>
        </div>
      </main>
    );
  }

  // Calculate rental duration in days
  const startDateObj = new Date(start + 'T10:00:00');
  const endDateObj = new Date(end + 'T10:00:00');
  const diffDays = Math.max(1, Math.round((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)));

  const baseRate = Number(vehicle.base_daily_rate) || 0;
  const baseCost = baseRate * diffDays;

  // Extras calculation
  const selectedExtrasList = extras.filter(e => selectedExtras.has(e.extra_id));
  const extrasCostPerDay = selectedExtrasList.reduce((sum, e) => sum + Number(e.price_per_day), 0);
  const totalExtrasCost = extrasCostPerDay * diffDays;
  const grandTotal = baseCost + totalExtrasCost;

  const toggleExtra = extraId => {
    setSelectedExtras(prev => {
      const next = new Set(prev);
      if (next.has(extraId)) next.delete(extraId);
      else next.add(extraId);
      return next;
    });
  };

  const handleConfirmBooking = async e => {
    e.preventDefault();
    if (!user) {
      toast.error('Please log in or sign up to complete your booking');
      nav(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }

    if (new Date(end) <= new Date(start)) {
      toast.error('Return date must be after pick-up date');
      return;
    }

    setSubmitting(true);
    setErrorNotice('');

    try {
      const payload = {
        vehicle_id: Number(vehicleId),
        start: new Date(start + 'T10:00:00Z').toISOString(),
        end: new Date(end + 'T10:00:00Z').toISOString(),
        pickup_branch_id: Number(pickupBranchId),
        drop_branch_id: Number(dropBranchId),
        method,
        extra_ids: Array.from(selectedExtras),
      };

      const res = await api('/bookings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success(`Booking confirmed! (Booking #${res.booking_id})`);
      nav('/my-bookings');
    } catch (err) {
      let msg = err.message;
      if (msg.includes('exclude') || msg.includes('booked') || msg.includes('conflict')) {
        msg = 'Vehicle is already booked for these dates. Please choose different dates or another car.';
      }
      setErrorNotice(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="page">
      <div className="eyebrow">CONFIRM YOUR RESERVATION</div>
      <h1>Booking Checkout</h1>
      <p className="muted">Review your journey details and complete your reservation.</p>

      {!user && (
        <div style={{ background: '#fef9e7', border: '1px solid #f9df94', padding: '16px 20px', borderRadius: '12px', marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <b style={{ color: '#8d6303' }}>Sign in required to complete reservation</b>
            <p style={{ margin: 0, fontSize: '13px', color: '#68746e' }}>Already have an account, or creating one? Your booking details will be preserved.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} className="btn-secondary">Log in</Link>
            <Link to={`/signup?redirect=${encodeURIComponent(location.pathname + location.search)}`} className="btn-primary">Sign up</Link>
          </div>
        </div>
      )}

      {errorNotice && (
        <div className="notice" style={{ background: '#fbefef', color: '#af4848', border: '1px solid #f6d1d1' }}>
          <AlertTriangle size={16} /> <b>Booking Error:</b> {errorNotice}
        </div>
      )}

      <form onSubmit={handleConfirmBooking} className="checkout-grid">
        {/* Left column: configurations */}
        <div style={{ display: 'grid', gap: '24px' }}>
          {/* Vehicle Summary Banner */}
          <div style={{ display: 'flex', gap: '20px', padding: '20px', border: '1px solid #e8eeeb', borderRadius: '14px', background: '#fff', alignItems: 'center' }}>
            <img
              src={vehicle.image_url || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=400&q=80'}
              alt={vehicle.model}
              style={{ width: '130px', height: '90px', objectFit: 'cover', borderRadius: '10px' }}
            />
            <div>
              <span className="chip chip-staff" style={{ marginBottom: '6px' }}>{vehicle.category}</span>
              <h3 style={{ margin: '4px 0' }}>{vehicle.make} {vehicle.model}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#65716d' }}>
                Reg: <b>{vehicle.reg_number}</b> · {vehicle.fuel} · {vehicle.transmission}
              </p>
            </div>
          </div>

          {/* Dates & Duration */}
          <div className="panel" style={{ margin: 0 }}>
            <h3 style={{ fontSize: '18px', marginTop: 0, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarDays size={18} /> Rental Schedule
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#65716d', fontWeight: 600, display: 'block', marginBottom: '6px' }}>PICK-UP DATE</label>
                <input
                  type="date"
                  value={start}
                  onChange={e => setStart(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: '#65716d', fontWeight: 600, display: 'block', marginBottom: '6px' }}>RETURN DATE</label>
                <input
                  type="date"
                  value={end}
                  onChange={e => setEnd(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: '13px', color: '#176b5b', fontWeight: 600 }}>
              Calculated duration: {diffDays} day{diffDays > 1 ? 's' : ''}
            </p>
          </div>

          {/* Branches */}
          <div className="panel" style={{ margin: 0 }}>
            <h3 style={{ fontSize: '18px', marginTop: 0, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} /> Pick-up & Return Locations
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#65716d', fontWeight: 600, display: 'block', marginBottom: '6px' }}>PICK-UP BRANCH</label>
                <select
                  value={pickupBranchId}
                  onChange={e => setPickupBranchId(e.target.value)}
                  className="input-field"
                  required
                >
                  {branches.map(b => (
                    <option key={b.branch_id} value={b.branch_id}>
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#65716d', fontWeight: 600, display: 'block', marginBottom: '6px' }}>RETURN BRANCH</label>
                <select
                  value={dropBranchId}
                  onChange={e => setDropBranchId(e.target.value)}
                  className="input-field"
                  required
                >
                  {branches.map(b => (
                    <option key={b.branch_id} value={b.branch_id}>
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Add-on Extras */}
          <div className="panel" style={{ margin: 0 }}>
            <h3 style={{ fontSize: '18px', marginTop: 0, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={18} /> Optional Add-ons & Equipment
            </h3>
            <div style={{ display: 'grid', gap: '8px' }}>
              {extras.map(ex => {
                const isSelected = selectedExtras.has(ex.extra_id);
                return (
                  <div
                    key={ex.extra_id}
                    onClick={() => toggleExtra(ex.extra_id)}
                    className={`extra-item ${isSelected ? 'selected' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{ex.name}</span>
                    </div>
                    <span style={{ fontSize: '13px', color: '#176b5b', fontWeight: 700 }}>
                      +{money(ex.price_per_day)} / day
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment Method */}
          <div className="panel" style={{ margin: 0 }}>
            <h3 style={{ fontSize: '18px', marginTop: 0, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} /> Payment Method
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[
                { id: 'card', label: 'Credit/Debit' },
                { id: 'upi', label: 'UPI / QR' },
                { id: 'netbanking', label: 'Net Banking' },
                { id: 'cash', label: 'Cash at Desk' },
              ].map(pm => (
                <label
                  key={pm.id}
                  style={{
                    border: method === pm.id ? '2px solid #176b5b' : '1px solid #dfe7e3',
                    background: method === pm.id ? '#f2f8f6' : '#fff',
                    padding: '12px 10px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="radio"
                    name="method"
                    value={pm.id}
                    checked={method === pm.id}
                    onChange={() => setMethod(pm.id)}
                    style={{ display: 'none' }}
                  />
                  {pm.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Sticky Summary & Confirmation */}
        <div className="summary-box">
          <h3 style={{ fontSize: '19px', marginTop: 0, marginBottom: '16px', letterSpacing: '-0.5px' }}>Price Summary</h3>

          <div style={{ display: 'grid', gap: '12px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Base rate ({diffDays} days × {money(baseRate)})</span>
              <b>{money(baseCost)}</b>
            </div>

            {selectedExtrasList.map(ex => (
              <div key={ex.extra_id} style={{ display: 'flex', justifyContent: 'space-between', color: '#52615b', fontSize: '13px' }}>
                <span>• {ex.name} ({diffDays} days)</span>
                <span>+{money(Number(ex.price_per_day) * diffDays)}</span>
              </div>
            ))}

            <div style={{ borderTop: '1px solid #e2e8e5', paddingTop: '14px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontSize: '18px' }}>
              <b>Total Amount</b>
              <b style={{ color: '#176b5b' }}>{money(grandTotal)}</b>
            </div>
          </div>

          <div style={{ background: '#f2f6f4', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#65716d', marginTop: '20px' }}>
            <ShieldCheck size={16} style={{ display: 'inline', verticalAlign: '-3px', color: '#176b5b' }} /> Free cancellation up to 24 hours prior to pick-up.
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="primary"
            style={{ width: '100%', marginTop: '20px', padding: '14px', borderRadius: '10px', fontSize: '15px' }}
          >
            {submitting ? 'Confirming reservation…' : `Confirm & Reserve (${money(grandTotal)})`}
          </button>
        </div>
      </form>
    </main>
  );
}

// ==========================================
// 8. SCREEN 5: MY BOOKINGS (/my-bookings)
// ==========================================

function MyBookings() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [reviewingBooking, setReviewingBooking] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [selectedBookingDetail, setSelectedBookingDetail] = useState(null);

  const loadBookings = () => {
    api('/bookings/mine')
      .then(setData)
      .catch(e => setErr(e.message));
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleCancel = async () => {
    if (!cancellingBooking) return;
    try {
      const res = await api(`/bookings/${cancellingBooking.booking_id}/cancel`, { method: 'POST' });
      toast.success(`Booking cancelled. Refund amount: ${money(res.refund)}`);
      setCancellingBooking(null);
      loadBookings();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleReview = async e => {
    e.preventDefault();
    if (!reviewingBooking) return;
    try {
      await api(`/bookings/${reviewingBooking.booking_id}/review`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment }),
      });
      toast.success('Thank you for rating your journey!');
      setReviewingBooking(null);
      setComment('');
      loadBookings();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openBookingDetails = async b => {
    try {
      const full = await api(`/bookings/${b.booking_id}`);
      setSelectedBookingDetail(full);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <main className="page">
      <div className="eyebrow">YOUR JOURNEYS</div>
      <h1>My bookings</h1>
      <p className="muted">Track upcoming reservations, completed trips, and manage cancellations.</p>

      {data === null ? (
        <p className="loading">{err || 'Loading your bookings…'}</p>
      ) : !data.length ? (
        <div className="empty">
          No bookings yet. Your next journey is just around the corner.{' '}
          <Link to="/search" style={{ color: '#176b5b', fontWeight: 700 }}>Explore our cars →</Link>
        </div>
      ) : (
        <div className="booking-list">
          {data.map(b => {
            const periodInfo = parsePeriod(b.period);
            return (
              <div className="booking" key={b.booking_id} style={{ alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <img
                    src={b.image_url || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=250&q=80'}
                    alt={b.model}
                    style={{ width: '90px', height: '65px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <StatusChip status={b.status} />
                      <span style={{ fontSize: '11px', color: '#748079' }}>Booking #{b.booking_id}</span>
                    </div>
                    <h3 style={{ margin: '2px 0 4px', fontSize: '17px' }}>{b.make} {b.model}</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#65716d' }}>
                      {periodInfo.formatted} · <b>{b.reg_number}</b>
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#748079' }}>
                      Pick-up: {b.pickup_branch} → Return: {b.drop_branch}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <b style={{ fontSize: '19px', color: '#17212b' }}>{money(b.total_amount)}</b>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => openBookingDetails(b)}
                      className="btn-secondary btn-sm"
                    >
                      <Eye size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> Details
                    </button>

                    {['confirmed', 'pending'].includes(b.status) && (
                      <button
                        onClick={() => setCancellingBooking(b)}
                        className="btn-danger btn-sm"
                      >
                        Cancel
                      </button>
                    )}

                    {b.status === 'completed' && (
                      <button
                        onClick={() => {
                          setReviewingBooking(b);
                          setRating(5);
                          setComment('');
                        }}
                        className="btn-primary btn-sm"
                      >
                        <Star size={13} /> Rate Trip
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancellingBooking && (
        <Modal title="Cancel Booking" onClose={() => setCancellingBooking(null)}>
          <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
            <p>
              Are you sure you want to cancel your booking for <b>{cancellingBooking.make} {cancellingBooking.model}</b>?
            </p>
            <div style={{ background: '#f8faf9', padding: '14px', borderRadius: '10px', margin: '14px 0', border: '1px solid #e7ece9' }}>
              <b>Cancellation Policy:</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px', color: '#65716d' }}>
                <li>Cancellations with {'>'}24 hours notice receive a <b>100% refund</b>.</li>
                <li>Cancellations within 24 hours receive a <b>50% refund</b>.</li>
              </ul>
            </div>
            <p style={{ color: '#748079', fontSize: '13px' }}>
              Refund will be credited back via original payment method.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setCancellingBooking(null)} className="btn-secondary">Keep Booking</button>
              <button onClick={handleCancel} className="btn-danger">Confirm Cancellation</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Rate & Review Modal */}
      {reviewingBooking && (
        <Modal title="Rate Your Journey" onClose={() => setReviewingBooking(null)}>
          <form onSubmit={handleReview}>
            <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#65716d' }}>
              How was your experience with <b>{reviewingBooking.make} {reviewingBooking.model}</b>?
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: '4px' }}
                >
                  <Star
                    size={28}
                    fill={star <= rating ? '#e9a75c' : 'none'}
                    color={star <= rating ? '#e9a75c' : '#c4cec8'}
                  />
                </button>
              ))}
            </div>

            <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d', display: 'block', marginBottom: '6px' }}>
              COMMENTS (OPTIONAL)
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Tell others how clean, comfortable, and reliable the car was…"
              rows={3}
              className="input-field"
              style={{ resize: 'vertical' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
              <button type="button" onClick={() => setReviewingBooking(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Submit Review</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Booking Details Modal */}
      {selectedBookingDetail && (
        <Modal title={`Booking #${selectedBookingDetail.booking_id} Details`} onClose={() => setSelectedBookingDetail(null)} maxWidth="640px">
          <div style={{ fontSize: '14px', display: 'grid', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>{selectedBookingDetail.make} {selectedBookingDetail.model}</h3>
                <span style={{ color: '#748079', fontSize: '13px' }}>Reg: {selectedBookingDetail.reg_number}</span>
              </div>
              <StatusChip status={selectedBookingDetail.status} />
            </div>

            <div style={{ background: '#f8faf9', padding: '14px', borderRadius: '10px', border: '1px solid #e7ece9' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                <div><b>Period:</b><br />{parsePeriod(selectedBookingDetail.period).formatted}</div>
                <div><b>Total Paid:</b><br /><span style={{ color: '#176b5b', fontWeight: 700, fontSize: '16px' }}>{money(selectedBookingDetail.total_amount)}</span></div>
                <div><b>Pick-up Branch:</b><br />{selectedBookingDetail.pickup_branch_name} ({selectedBookingDetail.pickup_city})</div>
                <div><b>Return Branch:</b><br />{selectedBookingDetail.drop_branch_name} ({selectedBookingDetail.drop_city})</div>
              </div>
            </div>

            {selectedBookingDetail.extras?.length > 0 && (
              <div>
                <b style={{ fontSize: '13px', color: '#65716d' }}>INCLUDED EXTRAS</b>
                <div style={{ marginTop: '6px', display: 'grid', gap: '6px' }}>
                  {selectedBookingDetail.extras.map((ex, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', background: '#fafcfb', padding: '8px 12px', borderRadius: '6px' }}>
                      <span>• {ex.name}</span>
                      <span>{money(ex.price_per_day)} / day</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedBookingDetail.rental && (
              <div style={{ background: '#eef5f8', padding: '14px', borderRadius: '10px', border: '1px solid #dce8ef' }}>
                <b style={{ fontSize: '13px', color: '#2b5f7e' }}>RENTAL DISPATCH STATUS</b>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '6px', fontSize: '12px' }}>
                  <div>Odometer at Pickup: <b>{selectedBookingDetail.rental.odometer_out} km</b></div>
                  <div>Odometer at Return: <b>{selectedBookingDetail.rental.odometer_in ? `${selectedBookingDetail.rental.odometer_in} km` : 'In Journey'}</b></div>
                  <div>Handed out: {new Date(selectedBookingDetail.rental.pickup_at).toLocaleString()}</div>
                  <div>Returned: {selectedBookingDetail.rental.return_at ? new Date(selectedBookingDetail.rental.return_at).toLocaleString() : 'Active'}</div>
                </div>
              </div>
            )}

            {selectedBookingDetail.payments?.length > 0 && (
              <div>
                <b style={{ fontSize: '13px', color: '#65716d' }}>PAYMENT TRANSACTIONS</b>
                <div style={{ marginTop: '6px', display: 'grid', gap: '6px' }}>
                  {selectedBookingDetail.payments.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', background: '#f8faf9', padding: '8px 12px', borderRadius: '6px' }}>
                      <span>{p.method?.toUpperCase()} · Ref: {p.transaction_ref}</span>
                      <b style={{ color: '#176b5b' }}>{money(p.amount)} ({p.status})</b>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </main>
  );
}

// ==========================================
// 9. SCREEN 6: PROFILE PAGE (/profile)
// ==========================================

function Profile() {
  const { user, refreshUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setPhone(user.phone || '');
      setAddress(user.address || '');
    }
  }, [user]);

  if (!user) {
    return (
      <main className="page">
        <div className="notice">Please <Link to="/login">log in</Link> to view your profile.</div>
      </main>
    );
  }

  const handleSave = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/profile', {
        method: 'PATCH',
        body: JSON.stringify({ phone, address }),
      });
      await refreshUser();
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

  return (
    <main className="page" style={{ maxWidth: '720px' }}>
      <div className="eyebrow">ACCOUNT SETTINGS</div>
      <h1>Customer Profile</h1>
      <p className="muted">Manage your verified customer credentials and contact details.</p>

      <form onSubmit={handleSave} className="panel" style={{ marginTop: '24px', display: 'grid', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid #edf0ee' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#eff6f2', color: '#176b5b', display: 'grid', placeItems: 'center', fontSize: '22px', fontWeight: 700 }}>
            {user.full_name?.charAt(0) || 'U'}
          </div>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '20px' }}>{user.full_name}</h3>
            <span style={{ fontSize: '13px', color: '#65716d' }}>{user.email}</span> · <RoleChip role={user.role} />
          </div>
        </div>

        {/* Read-Only Identity Verified Details */}
        <div>
          <b style={{ fontSize: '13px', color: '#65716d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Verified Driving Credentials</b>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '10px' }}>
            <div style={{ background: '#f8faf9', padding: '12px', borderRadius: '8px', border: '1px solid #e7ece9' }}>
              <span style={{ fontSize: '11px', color: '#748079', display: 'block' }}>LICENCE NUMBER</span>
              <b style={{ fontSize: '14px' }}>{user.licence_no || 'DL-PENDING'}</b>
            </div>
            <div style={{ background: '#f8faf9', padding: '12px', borderRadius: '8px', border: '1px solid #e7ece9' }}>
              <span style={{ fontSize: '11px', color: '#748079', display: 'block' }}>EXPIRY DATE</span>
              <b style={{ fontSize: '14px' }}>{formatDate(user.licence_expiry)}</b>
            </div>
            <div style={{ background: '#f8faf9', padding: '12px', borderRadius: '8px', border: '1px solid #e7ece9' }}>
              <span style={{ fontSize: '11px', color: '#748079', display: 'block' }}>DATE OF BIRTH</span>
              <b style={{ fontSize: '14px' }}>{formatDate(user.date_of_birth)}</b>
            </div>
          </div>
          <small style={{ color: '#748079', display: 'block', marginTop: '6px' }}>
            To update your driving licence documents, contact support verification.
          </small>
        </div>

        {/* Editable Contact Info */}
        <div style={{ display: 'grid', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d', display: 'block', marginBottom: '6px' }}>PHONE NUMBER</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="input-field"
              placeholder="+91 9876543210"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d', display: 'block', marginBottom: '6px' }}>RESIDENTIAL ADDRESS</label>
            <textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
              rows={3}
              className="input-field"
              placeholder="House/Street, City, Postal Code"
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #edf0ee', paddingTop: '16px' }}>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving changes…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </main>
  );
}

// ==========================================
// 10. SCREEN 7: STAFF BOARD (/staff)
// ==========================================

function Staff() {
  const { user } = useAuth();
  const [todayData, setTodayData] = useState([]);
  const [overdueData, setOverdueData] = useState([]);
  const [tab, setTab] = useState('pickups'); // 'pickups' | 'returns' | 'overdue'

  const [handoverBooking, setHandoverBooking] = useState(null);
  const [odometerOut, setOdometerOut] = useState('');

  const [returnRental, setReturnRental] = useState(null);
  const [odometerIn, setOdometerIn] = useState('');
  const [damageDescription, setDamageDescription] = useState('');
  const [damageFine, setDamageFine] = useState('');

  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api('/staff/today'),
      api('/staff/overdue'),
    ])
      .then(([today, overdue]) => {
        setTodayData(today);
        setOverdueData(overdue);
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!user) {
    return (
      <main className="page">
        <div className="notice" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Staff authentication required. Sign in as a staff member or administrator to operate the dispatch board.</span>
          <Link to="/login" className="btn-primary btn-sm">Log in as Staff</Link>
        </div>
      </main>
    );
  }

  if (user.role === 'customer') {
    return <main className="page"><div className="notice">Staff access only. Customers cannot access operational consoles.</div></main>;
  }

  // Pickups are items without rental_id or handover_type === 'pickup'
  const pickups = todayData.filter(d => !d.rental_id || d.handover_type === 'pickup');
  // Returns are items with active rental_id and return_at is null
  const activeRentals = todayData.filter(d => d.rental_id && !d.return_at);

  const handleHandoverSubmit = async e => {
    e.preventDefault();
    if (!handoverBooking) return;
    try {
      await api('/rentals', {
        method: 'POST',
        body: JSON.stringify({
          booking_id: Number(handoverBooking.booking_id),
          odometer_out: Number(odometerOut),
        }),
      });
      toast.success('Vehicle handed over successfully! Rental dispatched.');
      setHandoverBooking(null);
      setOdometerOut('');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleReturnSubmit = async e => {
    e.preventDefault();
    if (!returnRental) return;
    try {
      const payload = {
        odometer_in: Number(odometerIn),
      };
      if (damageDescription.trim()) {
        payload.damage = damageDescription.trim();
        payload.fine = Number(damageFine) || 0;
      }
      await api(`/rentals/${returnRental.rental_id}/return`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      toast.success('Vehicle return recorded successfully!');
      setReturnRental(null);
      setOdometerIn('');
      setDamageDescription('');
      setDamageFine('');
      loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <main className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div className="eyebrow">BRANCH OPERATIONS DESK</div>
          <h1>Staff Operations Board</h1>
          <p className="muted">Live vehicle handovers, return check-in with odometer/damage capture, and overdue fleet tracking.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ background: '#eef8f3', color: '#166534', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
            Operations Online · {user.full_name} ({user.role})
          </div>
          <button onClick={loadData} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh Board
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', margin: '24px 0 20px' }}>
        <button
          onClick={() => setTab('pickups')}
          className={`tab-btn ${tab === 'pickups' ? 'active' : ''}`}
        >
          Pickups for Handover ({pickups.length})
        </button>
        <button
          onClick={() => setTab('returns')}
          className={`tab-btn ${tab === 'returns' ? 'active' : ''}`}
        >
          Active Rentals / In-Journey ({activeRentals.length})
        </button>
        <button
          onClick={() => setTab('overdue')}
          className={`tab-btn ${tab === 'overdue' ? 'active' : ''}`}
          style={{ color: overdueData.length ? '#b44e4e' : undefined }}
        >
          Overdue Alert ({overdueData.length})
        </button>
      </div>

      {loading ? (
        <div className="loading">Refreshing dispatch data…</div>
      ) : tab === 'pickups' ? (
        <div>
          {!pickups.length ? (
            <div className="empty">No confirmed customer vehicle handovers waiting. All clear!</div>
          ) : (
            <div className="booking-list">
              {pickups.map(p => {
                const isToday = p.timeline_status === 'today';
                const isPast = p.timeline_status === 'past_due';
                return (
                  <div className="booking" key={p.booking_id}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        {isToday ? (
                          <span className="chip" style={{ background: '#dcfce7', color: '#166534', fontWeight: 700 }}>TODAY'S PICKUP</span>
                        ) : isPast ? (
                          <span className="chip" style={{ background: '#fee2e2', color: '#991b1b', fontWeight: 700 }}>PAST DUE PICKUP</span>
                        ) : (
                          <span className="chip" style={{ background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>SCHEDULED PICKUP</span>
                        )}
                        <span style={{ fontSize: '12px', color: '#748079' }}>Booking #{p.booking_id}</span>
                      </div>
                      <h3 style={{ margin: '3px 0' }}>{p.make} {p.model} ({p.reg_number})</h3>
                      <p style={{ margin: '2px 0', fontSize: '13px' }}>
                        Customer: <b>{p.customer_name}</b> · <Phone size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> {p.customer_phone}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#748079' }}>
                        Rental Period: {parsePeriod(p.period).formatted}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setHandoverBooking(p);
                        setOdometerOut('15000');
                      }}
                      className="btn-primary"
                    >
                      Hand Over Vehicle →
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : tab === 'returns' ? (
        <div>
          {!activeRentals.length ? (
            <div className="empty">No active rentals awaiting return check-in.</div>
          ) : (
            <div className="booking-list">
              {activeRentals.map(r => (
                <div className="booking" key={r.rental_id}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <StatusChip status="active" />
                      <span style={{ fontSize: '12px', color: '#748079' }}>Rental #{r.rental_id} · Booking #{r.booking_id}</span>
                    </div>
                    <h3 style={{ margin: '3px 0' }}>{r.make} {r.model} ({r.reg_number})</h3>
                    <p style={{ margin: '2px 0', fontSize: '13px' }}>
                      Customer: <b>{r.customer_name}</b> · {r.customer_phone}
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#748079' }}>
                      Odometer at departure: <b>{r.odometer_out} km</b> · Dispatched: {r.pickup_at ? new Date(r.pickup_at).toLocaleString() : 'Active'}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setReturnRental(r);
                      setOdometerIn(String((Number(r.odometer_out) || 15000) + 120));
                      setDamageDescription('');
                      setDamageFine('');
                    }}
                    className="btn-primary"
                    style={{ background: '#2563eb' }}
                  >
                    Record Return Check-in
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {!overdueData.length ? (
            <div className="empty" style={{ background: '#f2f8f6', color: '#176b5b' }}>
              <CheckCircle2 size={24} style={{ display: 'block', margin: '0 auto 8px' }} />
              No overdue returns! All customer vehicles are returned or on schedule.
            </div>
          ) : (
            <div className="booking-list">
              {overdueData.map((ov, i) => (
                <div className="booking" key={i} style={{ borderLeft: '4px solid #b44e4e' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="status cancelled">OVERDUE</span>
                      <b style={{ color: '#b44e4e', fontSize: '12px' }}>
                        Overdue by {typeof ov.overdue_by === 'object' ? JSON.stringify(ov.overdue_by) : ov.overdue_by}
                      </b>
                    </div>
                    <h3 style={{ margin: '3px 0' }}>{ov.make} {ov.model} ({ov.reg_number})</h3>
                    <p style={{ margin: '2px 0', fontSize: '13px' }}>
                      Customer: <b>{ov.customer_name}</b> · Phone: <b>{ov.phone}</b>
                    </p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#748079' }}>
                      Scheduled Return was: {ov.expected_return ? new Date(ov.expected_return).toLocaleString() : 'Past'}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setReturnRental({
                        rental_id: ov.rental_id,
                        booking_id: ov.booking_id,
                        reg_number: ov.reg_number,
                        customer_name: ov.customer_name,
                        odometer_out: ov.odometer_out || 20000,
                      });
                      setOdometerIn(String((ov.odometer_out || 20000) + 300));
                    }}
                    className="btn-danger"
                  >
                    Record Return Now
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Handover Modal */}
      {handoverBooking && (
        <Modal title={`Vehicle Handover — Booking #${handoverBooking.booking_id}`} onClose={() => setHandoverBooking(null)}>
          <form onSubmit={handleHandoverSubmit}>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: '#65716d' }}>
              Handing over <b>{handoverBooking.make} {handoverBooking.model}</b> ({handoverBooking.reg_number}) to customer <b>{handoverBooking.customer_name}</b>.
            </p>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d', display: 'block', marginBottom: '6px' }}>
                CURRENT ODOMETER READING (KM)
              </label>
              <input
                type="number"
                min="0"
                value={odometerOut}
                onChange={e => setOdometerOut(e.target.value)}
                className="input-field"
                placeholder="e.g. 25400"
                required
              />
              <small style={{ color: '#748079', display: 'block', marginTop: '4px' }}>
                Ensure physical inspection matches this reading.
              </small>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={() => setHandoverBooking(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Confirm Handover</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Return Modal */}
      {returnRental && (
        <Modal title={`Vehicle Check-in — Rental #${returnRental.rental_id}`} onClose={() => setReturnRental(null)}>
          <form onSubmit={handleReturnSubmit}>
            <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#65716d' }}>
              Customer <b>{returnRental.customer_name}</b> is returning <b>{returnRental.reg_number}</b>.
            </p>

            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d', display: 'block', marginBottom: '6px' }}>
                  RETURN ODOMETER READING (KM)
                </label>
                <input
                  type="number"
                  min={returnRental.odometer_out || 0}
                  value={odometerIn}
                  onChange={e => setOdometerIn(e.target.value)}
                  className="input-field"
                  placeholder="e.g. 25650"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d', display: 'block', marginBottom: '6px' }}>
                  DAMAGE OR INCIDENT DESCRIPTION (OPTIONAL)
                </label>
                <textarea
                  value={damageDescription}
                  onChange={e => setDamageDescription(e.target.value)}
                  placeholder="Scratches on bumper, missing spare tyre, etc."
                  rows={2}
                  className="input-field"
                  style={{ resize: 'vertical' }}
                />
              </div>

              {damageDescription.trim() && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d', display: 'block', marginBottom: '6px' }}>
                    DAMAGE ASSESSMENT FINE (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={damageFine}
                    onChange={e => setDamageFine(e.target.value)}
                    className="input-field"
                    placeholder="e.g. 2500"
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={() => setReturnRental(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Complete Check-in</button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}

// ==========================================
// 11. SCREEN 8: ADMIN DASHBOARD (/admin)
// ==========================================

function Admin() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [revenueData, setRevenueData] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [staffHandovers, setStaffHandovers] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = () => {
    setRefreshing(true);
    Promise.all([
      api('/admin/stats').catch(() => null),
      api('/admin/reports/categories').catch(() => []),
      api('/admin/reports/revenue').catch(() => []),
      api('/admin/reports/customers').catch(() => []),
      api('/admin/vehicles').catch(() => []),
      api('/staff/today').catch(() => []),
    ])
      .then(([stats, cats, rev, custs, vehs, handovers]) => {
        if (stats) setAdminStats(stats);
        if (Array.isArray(cats)) setCategories(cats);
        if (Array.isArray(rev)) setRevenueData(rev);
        if (Array.isArray(custs)) setTopCustomers(custs);
        if (Array.isArray(vehs)) setVehicles(vehs);
        if (Array.isArray(handovers)) setStaffHandovers(handovers);
      })
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (!user) {
    return (
      <main className="page">
        <div className="notice" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Administrator authentication required to access executive consoles.</span>
          <Link to="/login" className="btn-primary btn-sm">Log in as Admin</Link>
        </div>
      </main>
    );
  }

  if (user.role !== 'admin') {
    return <main className="page"><div className="notice">Admin credentials required.</div></main>;
  }

  const totalRevenue = adminStats?.revenue?.net_revenue
    ? Number(adminStats.revenue.net_revenue)
    : revenueData.reduce((acc, r) => acc + (Number(r.net_revenue) || 0), 0);

  const totalBookingsCount = adminStats?.bookings?.total_bookings
    ? Number(adminStats.bookings.total_bookings)
    : categories.reduce((acc, c) => acc + (Number(c.rentals) || 0), 0);

  const activeRentalsCount = adminStats?.active_rentals !== undefined
    ? adminStats.active_rentals
    : staffHandovers.filter(h => h.rental_id && !h.return_at).length;

  return (
    <main className="page">
      <AdminNav />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <div className="eyebrow">EXECUTIVE INTELLIGENCE & ADBMS GOVERNANCE</div>
          <h1>Good day, {user?.full_name || 'Admin'}</h1>
          <p className="muted">Live fleet performance, real-time customer mutations, and financial audit reports.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ background: '#eef8f3', color: '#166534', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
            PostgreSQL Connected · rental_db
          </div>
          <button
            onClick={loadDashboard}
            disabled={refreshing}
            className="btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Syncing…' : 'Refresh Metrics'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat">
          <span>Total Bookings (All-Time)</span>
          <b>{totalBookingsCount}</b>
          <small>{adminStats?.bookings?.confirmed_bookings || 0} confirmed · {adminStats?.bookings?.completed_bookings || 0} completed</small>
        </div>

        <div className="stat">
          <span>Net Revenue (Payments Ledger)</span>
          <b style={{ color: '#176b5b' }}>{money(totalRevenue)}</b>
          <small>Refunds deducted: {money(adminStats?.revenue?.total_refunded || 0)}</small>
        </div>

        <div className="stat">
          <span>Active Rentals on Road</span>
          <b>{activeRentalsCount}</b>
          <small>{adminStats?.fleet?.rented_vehicles || 0} vehicles currently dispatched</small>
        </div>

        <div className="stat">
          <span>Total Fleet Size</span>
          <b>{adminStats?.fleet?.total_vehicles || vehicles.length || 30}</b>
          <small>{adminStats?.fleet?.available_vehicles || 0} available for booking</small>
        </div>
      </div>

      {/* Live Recent Customer Bookings Feed */}
      {adminStats?.recent_bookings?.length > 0 && (
        <div className="panel" style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '18px', margin: 0 }}>Live Customer Activity (Recent Bookings)</h2>
            <small style={{ color: '#748079' }}>Updates automatically as customers book</small>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Booking #</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Period</th>
                <th>Total Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {adminStats.recent_bookings.map(b => (
                <tr key={b.booking_id}>
                  <td><b>#{b.booking_id}</b></td>
                  <td>
                    <b>{b.customer_name}</b><br />
                    <small style={{ color: '#748079' }}>{b.customer_email}</small>
                  </td>
                  <td>{b.make} {b.model} ({b.reg_number})</td>
                  <td style={{ fontSize: '12px' }}>{parsePeriod(b.period).formatted}</td>
                  <td style={{ fontWeight: 700, color: '#176b5b' }}>{money(b.total_amount)}</td>
                  <td><StatusChip status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Revenue Over Time Chart */}
      <div className="panel chart" style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Monthly Revenue Overview (Materialized View)</h2>
        {revenueData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueData} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0ee" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#748079' }} />
              <YAxis tickFormatter={v => `₹${v / 1000}k`} tick={{ fontSize: 12, fill: '#748079' }} />
              <Tooltip formatter={val => [money(val), 'Net Revenue']} />
              <Bar dataKey="net_revenue" fill="#176b5b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="loading">Loading ledger trends…</div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
        {/* Top Customers Report */}
        <div className="panel" style={{ margin: 0 }}>
          <h2 style={{ fontSize: '19px', marginTop: 0 }}>Top Customers (Net Spend)</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Trips</th>
                <th>Total Spent</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.slice(0, 6).map((c, i) => (
                <tr key={i}>
                  <td>
                    <b>{c.full_name}</b><br />
                    <small style={{ color: '#748079' }}>{c.email}</small>
                  </td>
                  <td><b>{c.bookings || c.booking_count || 1}</b></td>
                  <td style={{ fontWeight: 700, color: '#176b5b' }}>{money(c.net_spend || c.total_spent || c.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Category Revenue Breakdown */}
        <div className="panel" style={{ margin: 0 }}>
          <h2 style={{ fontSize: '19px', marginTop: 0 }}>Revenue by Category</h2>
          <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
            {categories.map((r, i) => (
              <div key={i} className="report-row">
                <div>
                  <b>{r.category}</b>
                  <div style={{ fontSize: '12px', color: '#748079' }}>{r.rentals} bookings</div>
                </div>
                <b style={{ color: '#176b5b' }}>{money(r.revenue)}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

// ==========================================
// 12. SCREEN 9: FLEET MANAGER (/fleet)
// ==========================================

function FleetManager() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    reg_number: '',
    make: '',
    model: '',
    category_id: '',
    branch_id: '',
    manufacture_year: '2023',
    fuel: 'petrol',
    transmission: 'automatic',
  });

  const [maintenanceVehicle, setMaintenanceVehicle] = useState(null);
  const [maintenanceList, setMaintenanceList] = useState([]);
  const [mDesc, setMDesc] = useState('');
  const [mCost, setMCost] = useState('');
  const [mStartDate, setMStartDate] = useState(new Date().toISOString().split('T')[0]);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api('/admin/vehicles'),
      api('/admin/branches'),
      api('/admin/categories'),
    ])
      .then(([v, b, c]) => {
        setVehicles(v);
        setBranches(b);
        setCategories(c);
        if (c.length) setNewVehicle(prev => ({ ...prev, category_id: String(c[0].category_id) }));
        if (b.length) setNewVehicle(prev => ({ ...prev, branch_id: String(b[0].branch_id) }));
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (user && user.role !== 'admin') {
    return <main className="page"><div className="notice">Admin credentials required.</div></main>;
  }

  const handleStatusChange = async (vehicleId, newStatus) => {
    try {
      await api(`/admin/vehicles/${vehicleId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(`Vehicle status updated to ${newStatus}`);
      loadData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleAddVehicle = async e => {
    e.preventDefault();
    try {
      await api('/admin/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          ...newVehicle,
          category_id: Number(newVehicle.category_id),
          branch_id: Number(newVehicle.branch_id),
          manufacture_year: Number(newVehicle.manufacture_year),
        }),
      });
      toast.success('Vehicle added to fleet successfully!');
      setShowAddModal(false);
      loadData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openMaintenance = async v => {
    setMaintenanceVehicle(v);
    try {
      const records = await api(`/admin/maintenance/${v.vehicle_id}`);
      setMaintenanceList(records);
    } catch (e) {
      setMaintenanceList([]);
    }
  };

  const handleAddMaintenance = async e => {
    e.preventDefault();
    if (!maintenanceVehicle) return;
    try {
      await api('/admin/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          vehicle_id: maintenanceVehicle.vehicle_id,
          description: mDesc,
          start_date: mStartDate,
          cost: mCost ? Number(mCost) : null,
        }),
      });
      toast.success('Maintenance logged!');
      setMDesc('');
      setMCost('');
      const records = await api(`/admin/maintenance/${maintenanceVehicle.vehicle_id}`);
      setMaintenanceList(records);
      loadData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const text = `${v.make} ${v.model} ${v.reg_number} ${v.city}`.toLowerCase();
    const matchesText = text.includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesText && matchesStatus;
  });

  return (
    <main className="page">
      <AdminNav />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div className="eyebrow">ASSET INVENTORY</div>
          <h1 style={{ margin: '4px 0' }}>Fleet Manager</h1>
          <p className="muted" style={{ margin: 0 }}>Register vehicles, track maintenance, and toggle operational states.</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          <Plus size={16} /> Add New Vehicle
        </button>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '12px', background: '#f8faf9', padding: '14px', borderRadius: '12px', border: '1px solid #edf0ee', marginBottom: '20px' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            placeholder="Search make, model, or registration…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="input-field"
          style={{ width: '180px' }}
        >
          <option value="all">All Statuses</option>
          <option value="available">Available</option>
          <option value="rented">Rented</option>
          <option value="maintenance">Maintenance</option>
          <option value="retired">Retired</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading fleet database…</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Reg Number</th>
              <th>Make & Model</th>
              <th>Category</th>
              <th>Branch / City</th>
              <th>Status</th>
              <th>Odometer</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVehicles.map(v => (
              <tr key={v.vehicle_id}>
                <td><b>{v.reg_number}</b></td>
                <td>
                  {v.make} {v.model}
                  <span style={{ fontSize: '11px', color: '#748079', display: 'block' }}>{v.fuel} · {v.transmission}</span>
                </td>
                <td>{v.category}</td>
                <td>{v.branch_name} ({v.city})</td>
                <td><StatusChip status={v.status} /></td>
                <td>{v.odometer || 0} km</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={v.status}
                      onChange={e => handleStatusChange(v.vehicle_id, e.target.value)}
                      style={{ fontSize: '12px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #dfe7e3' }}
                    >
                      <option value="available">available</option>
                      <option value="maintenance">maintenance</option>
                      <option value="retired">retired</option>
                      <option value="rented" disabled>rented</option>
                    </select>

                    <button
                      onClick={() => openMaintenance(v)}
                      className="btn-secondary btn-sm"
                      title="Maintenance Log"
                    >
                      <Wrench size={13} style={{ display: 'inline' }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <Modal title="Register New Vehicle" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAddVehicle} style={{ display: 'grid', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>REGISTRATION NUMBER</label>
                <input
                  type="text"
                  placeholder="e.g. CH01CD9999"
                  value={newVehicle.reg_number}
                  onChange={e => setNewVehicle({ ...newVehicle, reg_number: e.target.value.toUpperCase() })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>YEAR</label>
                <input
                  type="number"
                  value={newVehicle.manufacture_year}
                  onChange={e => setNewVehicle({ ...newVehicle, manufacture_year: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>MAKE</label>
                <input
                  type="text"
                  placeholder="e.g. Hyundai"
                  value={newVehicle.make}
                  onChange={e => setNewVehicle({ ...newVehicle, make: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>MODEL</label>
                <input
                  type="text"
                  placeholder="e.g. Creta"
                  value={newVehicle.model}
                  onChange={e => setNewVehicle({ ...newVehicle, model: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>CATEGORY</label>
                <select
                  value={newVehicle.category_id}
                  onChange={e => setNewVehicle({ ...newVehicle, category_id: e.target.value })}
                  className="input-field"
                  required
                >
                  {categories.map(c => (
                    <option key={c.category_id} value={c.category_id}>{c.name} ({money(c.base_daily_rate)}/day)</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>BASE BRANCH</label>
                <select
                  value={newVehicle.branch_id}
                  onChange={e => setNewVehicle({ ...newVehicle, branch_id: e.target.value })}
                  className="input-field"
                  required
                >
                  {branches.map(b => (
                    <option key={b.branch_id} value={b.branch_id}>{b.name} ({b.city})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>FUEL</label>
                <select
                  value={newVehicle.fuel}
                  onChange={e => setNewVehicle({ ...newVehicle, fuel: e.target.value })}
                  className="input-field"
                >
                  <option value="petrol">Petrol</option>
                  <option value="diesel">Diesel</option>
                  <option value="electric">Electric</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="cng">CNG</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>TRANSMISSION</label>
                <select
                  value={newVehicle.transmission}
                  onChange={e => setNewVehicle({ ...newVehicle, transmission: e.target.value })}
                  className="input-field"
                >
                  <option value="automatic">Automatic</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Register Vehicle</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Maintenance Modal */}
      {maintenanceVehicle && (
        <Modal title={`Maintenance Records — ${maintenanceVehicle.reg_number}`} onClose={() => setMaintenanceVehicle(null)}>
          <div style={{ fontSize: '14px' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '15px' }}>Log New Maintenance Work</h4>
            <form onSubmit={handleAddMaintenance} style={{ display: 'grid', gap: '10px', background: '#f8faf9', padding: '14px', borderRadius: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Description of work (e.g. Brake pad replacement, oil change)"
                value={mDesc}
                onChange={e => setMDesc(e.target.value)}
                className="input-field"
                required
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="date"
                  value={mStartDate}
                  onChange={e => setMStartDate(e.target.value)}
                  className="input-field"
                  required
                />
                <input
                  type="number"
                  placeholder="Cost (₹)"
                  value={mCost}
                  onChange={e => setMCost(e.target.value)}
                  className="input-field"
                />
              </div>
              <button type="submit" className="btn-primary btn-sm" style={{ justifySelf: 'start' }}>
                Save Maintenance Entry
              </button>
            </form>

            <h4 style={{ margin: '0 0 10px', fontSize: '15px' }}>Service History</h4>
            {!maintenanceList.length ? (
              <p className="muted" style={{ fontStyle: 'italic' }}>No past service records logged for this vehicle.</p>
            ) : (
              <div style={{ display: 'grid', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {maintenanceList.map((m, i) => (
                  <div key={i} style={{ padding: '10px', background: '#fff', border: '1px solid #edf0ee', borderRadius: '8px', fontSize: '13px' }}>
                    <b>{m.description}</b>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#748079', fontSize: '12px', marginTop: '4px' }}>
                      <span>Started: {new Date(m.start_date).toLocaleDateString()}</span>
                      <span>Cost: {m.cost ? money(m.cost) : 'Under warranty'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </main>
  );
}

// ==========================================
// 13. SCREEN 10: MASTERS PAGE (/masters)
// ==========================================

function Masters() {
  const { user } = useAuth();
  const [tab, setTab] = useState('branches'); // 'branches' | 'categories' | 'extras'

  const [branches, setBranches] = useState([]);
  const [categories, setCategories] = useState([]);
  const [extras, setExtras] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [branchForm, setBranchForm] = useState({ name: '', city: '', address: '', phone: '' });

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', base_daily_rate: '', seats: '5' });

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api('/admin/branches'),
      api('/admin/categories'),
      api('/extras'),
    ])
      .then(([b, c, e]) => {
        setBranches(b);
        setCategories(c);
        setExtras(e);
      })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (user && user.role !== 'admin') {
    return <main className="page"><div className="notice">Admin credentials required.</div></main>;
  }

  const handleCreateBranch = async e => {
    e.preventDefault();
    try {
      await api('/admin/branches', { method: 'POST', body: JSON.stringify(branchForm) });
      toast.success('Branch added successfully!');
      setShowAddBranch(false);
      setBranchForm({ name: '', city: '', address: '', phone: '' });
      loadData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleCreateCategory = async e => {
    e.preventDefault();
    try {
      await api('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: catForm.name,
          base_daily_rate: Number(catForm.base_daily_rate),
          seats: Number(catForm.seats),
        }),
      });
      toast.success('Category added successfully!');
      setShowAddCategory(false);
      setCatForm({ name: '', base_daily_rate: '', seats: '5' });
      loadData();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <main className="page">
      <AdminNav />

      <div className="eyebrow">CONFIGURATION & CATALOG</div>
      <h1>Masters Management</h1>
      <p className="muted">Configure business branches, vehicle categories, and rental add-ons.</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', margin: '20px 0 16px' }}>
        <button onClick={() => setTab('branches')} className={`tab-btn ${tab === 'branches' ? 'active' : ''}`}>
          Branches ({branches.length})
        </button>
        <button onClick={() => setTab('categories')} className={`tab-btn ${tab === 'categories' ? 'active' : ''}`}>
          Vehicle Categories ({categories.length})
        </button>
        <button onClick={() => setTab('extras')} className={`tab-btn ${tab === 'extras' ? 'active' : ''}`}>
          Equipment & Extras ({extras.length})
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading configuration data…</div>
      ) : tab === 'branches' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button onClick={() => setShowAddBranch(true)} className="btn-primary">
              <Plus size={16} /> Add Branch
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Branch ID</th>
                <th>Name</th>
                <th>City</th>
                <th>Address</th>
                <th>Contact Phone</th>
              </tr>
            </thead>
            <tbody>
              {branches.map(b => (
                <tr key={b.branch_id}>
                  <td>#{b.branch_id}</td>
                  <td><b>{b.name}</b></td>
                  <td>{b.city}</td>
                  <td>{b.address}</td>
                  <td>{b.phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'categories' ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button onClick={() => setShowAddCategory(true)} className="btn-primary">
              <Plus size={16} /> Add Category
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Category ID</th>
                <th>Category Name</th>
                <th>Seats</th>
                <th>Base Daily Rate</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(c => (
                <tr key={c.category_id}>
                  <td>#{c.category_id}</td>
                  <td><b>{c.name}</b></td>
                  <td>{c.seats} seats</td>
                  <td style={{ fontWeight: 700, color: '#176b5b' }}>{money(c.base_daily_rate)} / day</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Extra ID</th>
                <th>Equipment / Add-on</th>
                <th>Price Per Day</th>
              </tr>
            </thead>
            <tbody>
              {extras.map(e => (
                <tr key={e.extra_id}>
                  <td>#{e.extra_id}</td>
                  <td><b>{e.name}</b></td>
                  <td style={{ fontWeight: 700, color: '#176b5b' }}>{money(e.price_per_day)} / day</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Branch Modal */}
      {showAddBranch && (
        <Modal title="Create New Branch" onClose={() => setShowAddBranch(false)}>
          <form onSubmit={handleCreateBranch} style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>BRANCH NAME</label>
              <input
                type="text"
                placeholder="e.g. Sector 17 City Hub"
                value={branchForm.name}
                onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>CITY</label>
              <input
                type="text"
                placeholder="e.g. Chandigarh"
                value={branchForm.city}
                onChange={e => setBranchForm({ ...branchForm, city: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>STREET ADDRESS</label>
              <textarea
                placeholder="e.g. SCO 45-46, Sector 17D"
                value={branchForm.address}
                onChange={e => setBranchForm({ ...branchForm, address: e.target.value })}
                className="input-field"
                rows={2}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>CONTACT PHONE</label>
              <input
                type="text"
                placeholder="e.g. +91 172 2700100"
                value={branchForm.phone}
                onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })}
                className="input-field"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button type="button" onClick={() => setShowAddBranch(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Add Branch</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Category Modal */}
      {showAddCategory && (
        <Modal title="Create Vehicle Category" onClose={() => setShowAddCategory(false)}>
          <form onSubmit={handleCreateCategory} style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>CATEGORY NAME</label>
              <input
                type="text"
                placeholder="e.g. Compact EV"
                value={catForm.name}
                onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>BASE DAILY RATE (₹)</label>
                <input
                  type="number"
                  min="100"
                  placeholder="e.g. 2400"
                  value={catForm.base_daily_rate}
                  onChange={e => setCatForm({ ...catForm, base_daily_rate: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>SEATS</label>
                <input
                  type="number"
                  min="1"
                  max="15"
                  value={catForm.seats}
                  onChange={e => setCatForm({ ...catForm, seats: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button type="button" onClick={() => setShowAddCategory(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Create Category</button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}

// ==========================================
// 14. SCREEN 11: USERS PAGE (/users)
// ==========================================

function UsersManager() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'staff',
  });

  const loadUsers = () => {
    setLoading(true);
    api('/admin/users')
      .then(setUsers)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  if (currentUser && currentUser.role !== 'admin') {
    return <main className="page"><div className="notice">Admin credentials required.</div></main>;
  }

  const handleToggleStatus = async u => {
    try {
      const nextActive = !u.is_active;
      await api(`/admin/users/${u.user_id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: nextActive }),
      });
      toast.success(`User ${u.full_name} is now ${nextActive ? 'Active' : 'Blocked'}`);
      loadUsers();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleCreateStaff = async e => {
    e.preventDefault();
    try {
      await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify(staffForm),
      });
      toast.success('Staff user created successfully!');
      setShowAddStaff(false);
      setStaffForm({ full_name: '', email: '', phone: '', password: '', role: 'staff' });
      loadUsers();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const filteredUsers = users.filter(u => {
    const text = `${u.full_name} ${u.email} ${u.phone}`.toLowerCase();
    const matchesText = text.includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesText && matchesRole;
  });

  return (
    <main className="page">
      <AdminNav />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div className="eyebrow">IDENTITY & ACCESS MANAGEMENT</div>
          <h1 style={{ margin: '4px 0' }}>User Accounts</h1>
          <p className="muted" style={{ margin: 0 }}>Manage customer accounts, dispatch staff, and access rights.</p>
        </div>
        <button onClick={() => setShowAddStaff(true)} className="btn-primary">
          <Plus size={16} /> Create Staff User
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', background: '#f8faf9', padding: '14px', borderRadius: '12px', border: '1px solid #edf0ee', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search by name, email, or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field"
          style={{ flex: 1 }}
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="input-field"
          style={{ width: '160px' }}
        >
          <option value="all">All Roles</option>
          <option value="customer">Customer</option>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading accounts…</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(u => (
              <tr key={u.user_id}>
                <td>#{u.user_id}</td>
                <td><b>{u.full_name}</b></td>
                <td>{u.email}</td>
                <td>{u.phone || '—'}</td>
                <td><RoleChip role={u.role} /></td>
                <td>
                  <span className={`status ${u.is_active ? 'available' : 'cancelled'}`}>
                    {u.is_active ? 'Active' : 'Blocked'}
                  </span>
                </td>
                <td style={{ fontSize: '12px', color: '#748079' }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                </td>
                <td>
                  {u.user_id !== currentUser?.user_id && (
                    <button
                      onClick={() => handleToggleStatus(u)}
                      className={u.is_active ? 'btn-danger btn-sm' : 'btn-secondary btn-sm'}
                    >
                      {u.is_active ? 'Block' : 'Unblock'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Create Staff Modal */}
      {showAddStaff && (
        <Modal title="Add Staff Account" onClose={() => setShowAddStaff(false)}>
          <form onSubmit={handleCreateStaff} style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>FULL NAME</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Singh"
                value={staffForm.full_name}
                onChange={e => setStaffForm({ ...staffForm, full_name: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>EMAIL ADDRESS</label>
              <input
                type="email"
                placeholder="staff@godrive.in"
                value={staffForm.email}
                onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>PHONE NUMBER</label>
              <input
                type="text"
                placeholder="+91 9876543210"
                value={staffForm.phone}
                onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                className="input-field"
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>TEMPORARY PASSWORD</label>
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={staffForm.password}
                onChange={e => setStaffForm({ ...staffForm, password: e.target.value })}
                className="input-field"
                minLength={8}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#65716d' }}>ROLE</label>
              <select
                value={staffForm.role}
                onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}
                className="input-field"
              >
                <option value="staff">Staff (Operations)</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button type="button" onClick={() => setShowAddStaff(false)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">Create User</button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}

// ==========================================
// 15. SCREEN 12: AUDIT LOG PAGE (/audit)
// ==========================================

function AuditLog() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTable, setFilterTable] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchLogs = () => {
    setLoading(true);
    api('/admin/audit')
      .then(setLogs)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  if (!user) {
    return (
      <main className="page">
        <div className="notice" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Administrator sign-in required to inspect system audit trail.</span>
          <Link to="/login" className="btn-primary btn-sm">Log in as Admin</Link>
        </div>
      </main>
    );
  }

  if (user.role !== 'admin') {
    return <main className="page"><div className="notice">Admin credentials required.</div></main>;
  }

  const toggleExpand = id => {
    setExpandedLogId(prev => (prev === id ? null : id));
  };

  const filteredLogs = logs.filter(l => filterTable === 'all' || l.table_name === filterTable);

  return (
    <main className="page">
      <AdminNav />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div className="eyebrow">SYSTEM GOVERNANCE & ADBMS LOGS</div>
          <h1>Audit Trail & Trigger Journal</h1>
          <p className="muted">PostgreSQL trigger-recorded mutations showing before/after snapshots and exact actor tracking.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ background: '#eef8f3', color: '#166534', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
            Audit System Connected
          </div>
          <button onClick={fetchLogs} className="btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} /> Refresh Logs
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', background: '#f8faf9', padding: '14px', borderRadius: '12px', border: '1px solid #edf0ee', margin: '20px 0' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#65716d', alignSelf: 'center' }}>FILTER TABLE:</span>
        <select
          value={filterTable}
          onChange={e => setFilterTable(e.target.value)}
          className="input-field"
          style={{ width: '220px' }}
        >
          <option value="all">All Tables ({logs.length} entries)</option>
          <option value="bookings">bookings (reservations)</option>
          <option value="rentals">rentals (handovers & returns)</option>
          <option value="vehicles">vehicles (fleet updates)</option>
          <option value="users">users (accounts & statuses)</option>
          <option value="payments">payments (transactions & refunds)</option>
          <option value="damage_reports">damage_reports (fines)</option>
          <option value="reviews">reviews (ratings)</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Reading audit journal from PostgreSQL…</div>
      ) : !filteredLogs.length ? (
        <div className="empty">No audit entries matching filter.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Table</th>
              <th>Action</th>
              <th>Record ID</th>
              <th>Changed By (Actor)</th>
              <th>Payload Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map(l => {
              const isExpanded = expandedLogId === l.audit_id;
              return (
                <React.Fragment key={l.audit_id}>
                  <tr>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {new Date(l.changed_at).toLocaleString()}
                    </td>
                    <td><code style={{ background: '#f2f6f4', padding: '2px 6px', borderRadius: '4px' }}>{l.table_name}</code></td>
                    <td><ActionChip action={l.action} /></td>
                    <td><b>#{l.record_id}</b></td>
                    <td>
                      {l.actor_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 600 }}>{l.actor_name}</span>
                          <span className={`chip chip-${l.actor_role || 'staff'}`} style={{ textTransform: 'capitalize' }}>
                            {l.actor_role}
                          </span>
                          <small style={{ color: '#748079' }}>#{l.changed_by}</small>
                        </div>
                      ) : (
                        <span className="chip" style={{ background: '#f1f5f9', color: '#64748b', fontSize: '11px' }}>
                          System / Initial Seed
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        onClick={() => toggleExpand(l.audit_id)}
                        className="btn-secondary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExpanded ? 'Hide' : 'Inspect JSON'}
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={6} style={{ background: '#f8faf9', padding: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#b44e4e' }}>PREVIOUS STATE (OLD DATA)</span>
                            <pre style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8e5', fontSize: '11px', overflowX: 'auto', maxHeight: '240px' }}>
                              {l.old_data ? JSON.stringify(l.old_data, null, 2) : '(none / INSERT)'}
                            </pre>
                          </div>
                          <div>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#30874a' }}>NEW COMMITTED STATE (NEW DATA)</span>
                            <pre style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8e5', fontSize: '11px', overflowX: 'auto', maxHeight: '240px' }}>
                              {l.new_data ? JSON.stringify(l.new_data, null, 2) : '(none / DELETE)'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}

// ==========================================
// 16. SCREENS 13 & 14: AUTH (LOGIN & SIGNUP)
// ==========================================

function Auth({ signup = false }) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { refreshUser } = useAuth();
  const redirectUrl = params.get('redirect') || '/search';

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    licence_no: '',
    licence_expiry: '',
    date_of_birth: '',
    address: '',
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (validationErrors[e.target.name]) {
      setValidationErrors({ ...validationErrors, [e.target.name]: null });
    }
  };

  const validate = () => {
    const errs = {};
    if (signup) {
      if (!formData.full_name.trim()) errs.full_name = 'Full name is required';
      if (!/^[0-9+ -]{10,15}$/.test(formData.phone)) errs.phone = 'Enter a valid 10-15 digit phone number';
      if (!formData.licence_no.trim()) errs.licence_no = 'Driving licence number is required';

      if (!formData.date_of_birth) {
        errs.date_of_birth = 'Date of birth is required';
      } else {
        const age = (Date.now() - new Date(formData.date_of_birth).getTime()) / 31557600000;
        if (age < 18) errs.date_of_birth = 'You must be at least 18 years old to rent';
      }

      if (!formData.licence_expiry) {
        errs.licence_expiry = 'Licence expiry date is required';
      } else if (new Date(formData.licence_expiry) <= new Date()) {
        errs.licence_expiry = 'Licence must not be expired';
      }

      if (formData.password.length < 8 || !/[A-Za-z]/.test(formData.password) || !/[0-9]/.test(formData.password)) {
        errs.password = 'Must be 8+ characters and contain both letters and numbers';
      }
    }
    return errs;
  };

  const submit = async e => {
    e.preventDefault();
    setApiError('');

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setValidationErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api('/auth/' + (signup ? 'signup' : 'login'), {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      await refreshUser();
      toast.success(signup ? 'Account created! Welcome to GoDrive.' : `Welcome back, ${res.user.full_name}`);

      // Smart role-based redirect if no specific checkout return path
      if (!params.get('redirect')) {
        if (res.user.role === 'admin') nav('/admin');
        else if (res.user.role === 'staff') nav('/staff');
        else nav(redirectUrl);
      } else {
        nav(redirectUrl);
      }
    } catch (err) {
      setApiError(err.message);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-wrap">
      <form className="auth-card" onSubmit={submit} style={{ width: 'min(100%, 520px)' }}>
        <div className="eyebrow">WELCOME {signup ? 'ABOARD' : 'BACK'}</div>
        <h1 style={{ fontSize: '32px' }}>
          {signup ? 'Your next journey starts here.' : 'Good to see you again.'}
        </h1>
        <p className="muted" style={{ margin: 0, fontSize: '14px' }}>
          {signup ? 'Create your verified account to reserve any car in our fleet.' : 'Sign in to access your bookings and manage journeys.'}
        </p>

        {apiError && (
          <div style={{ background: '#fbefef', color: '#b44e4e', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
            <AlertTriangle size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> {apiError}
          </div>
        )}

        {signup && (
          <>
            <div>
              <input
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Full name as on ID"
                required
              />
              {validationErrors.full_name && <small style={{ color: '#b44e4e' }}>{validationErrors.full_name}</small>}
            </div>

            <div>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Mobile phone (+91...)"
                required
              />
              {validationErrors.phone && <small style={{ color: '#b44e4e' }}>{validationErrors.phone}</small>}
            </div>

            <div>
              <input
                name="licence_no"
                value={formData.licence_no}
                onChange={handleChange}
                placeholder="Driving licence number"
                required
              />
              {validationErrors.licence_no && <small style={{ color: '#b44e4e' }}>{validationErrors.licence_no}</small>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label>
                Date of birth
                <input
                  name="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  required
                />
                {validationErrors.date_of_birth && <small style={{ color: '#b44e4e' }}>{validationErrors.date_of_birth}</small>}
              </label>

              <label>
                Licence expiry
                <input
                  name="licence_expiry"
                  type="date"
                  value={formData.licence_expiry}
                  onChange={handleChange}
                  required
                />
                {validationErrors.licence_expiry && <small style={{ color: '#b44e4e' }}>{validationErrors.licence_expiry}</small>}
              </label>
            </div>

            <div>
              <input
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Residential address (optional)"
              />
            </div>
          </>
        )}

        <div>
          <input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Email address"
            required
          />
        </div>

        <div>
          <input
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Password"
            required
            minLength={8}
          />
          {signup && (
            <small style={{ color: '#748079' }}>
              Must have 8+ characters including letters and digits.
            </small>
          )}
          {validationErrors.password && <small style={{ color: '#b44e4e', display: 'block' }}>{validationErrors.password}</small>}
        </div>

        <button type="submit" disabled={submitting} className="primary" style={{ width: '100%', justifyContent: 'center' }}>
          {submitting ? 'Authenticating…' : signup ? 'Create account' : 'Log in'} <ArrowRight size={17} />
        </button>

        <p className="muted" style={{ textAlign: 'center', marginTop: '10px' }}>
          {signup ? 'Already have an account?' : 'New to GoDrive?'}{' '}
          <Link
            to={signup ? `/login?redirect=${encodeURIComponent(redirectUrl)}` : `/signup?redirect=${encodeURIComponent(redirectUrl)}`}
            style={{ color: '#176b5b', fontWeight: 700 }}
          >
            {signup ? 'Log in here' : 'Create an account'}
          </Link>
        </p>
      </form>
    </main>
  );
}

// ==========================================
// 17. NOT FOUND PAGE
// ==========================================

function NotFound() {
  return (
    <main className="page" style={{ textAlign: 'center', paddingTop: '100px' }}>
      <div className="eyebrow" style={{ justifyContent: 'center' }}>404 ERROR</div>
      <h1>Page not found</h1>
      <p className="muted" style={{ maxWidth: '420px', margin: '0 auto 24px' }}>
        The path you requested doesn't exist or has moved. Let's get you back on the road.
      </p>
      <Link to="/" className="primary" style={{ margin: '0 auto' }}>
        Return to Home
      </Link>
    </main>
  );
}

// ==========================================
// 18. MAIN APP ROUTING & PROVIDERS
// ==========================================

export default function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/vehicle/:id" element={<Vehicle />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/fleet" element={<FleetManager />} />
          <Route path="/masters" element={<Masters />} />
          <Route path="/users" element={<UsersManager />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/signup" element={<Auth signup />} />
          <Route path="/login" element={<Auth />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}
