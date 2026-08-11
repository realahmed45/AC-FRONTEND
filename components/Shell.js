'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

const NAV = [
  { href: '/', label: 'Dashboard', icon: '▦' },
  { href: '/calendar', label: 'Calendar', icon: '📅' },
  { href: '/bookings', label: 'Jobs', icon: '🧾' },
  { href: '/teams', label: 'Teams', icon: '👷' },
  { href: '/employees', label: 'Employees', icon: '👤' },
  { href: '/areas', label: 'Areas', icon: '📍' },
  { href: '/services', label: 'Services & Prices', icon: '💰' },
  { href: '/map', label: 'Map', icon: '🗺' },
  { href: '/streets', label: 'Streets', icon: '🛣' },
  { href: '/shops', label: 'Shops', icon: '🏪' },
  { href: '/commission', label: 'Commission', icon: '🧮' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export default function Shell({ children }) {
  const pathname = usePathname();
  const { user, ready, logout } = useAuth();

  if (!ready) return <div className="loading">Loading…</div>;
  if (!user) return <div className="loading">Redirecting to login…</div>;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          AC Service
          <span>Admin Panel</span>
        </div>
        <nav>
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`nav-link${active ? ' active' : ''}`}>
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div style={{ marginBottom: 8 }}>{user.email}</div>
          <button className="btn sm" onClick={logout} style={{ width: '100%' }}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
