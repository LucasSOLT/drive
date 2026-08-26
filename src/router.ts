import { isAuthenticated } from './lib/auth.ts';
import { hasAdminPrivileges } from './lib/db.ts';

const ROUTE_KEY = 'drive_last_route';

export function navigate(route: string): void {
  window.location.hash = route;
  localStorage.setItem(ROUTE_KEY, route);
}

export function getCurrentRoute(): string {
  const hash = window.location.hash;
  if (hash && hash !== '#') return hash.substring(1);

  // Fallback: restore last route from localStorage if hash is empty
  const saved = localStorage.getItem(ROUTE_KEY);
  if (saved) {
    window.location.replace('#' + saved);
    return saved;
  }

  return 'home';
}

export function getRouteParam(): string | null {
  const route = getCurrentRoute();
  const parts = route.split('/');
  return parts.length > 1 ? parts[1].split('?')[0] : null;
}

// Routes that require authentication
const PROTECTED_ROUTES = ['library', 'create', 'profile', 'admin', 'admin-create', 'path-select', 'squad-lobby', 'lfg-bio', 'lfg-browse', 'sparc'];

// Routes that require admin/game_master role
const ADMIN_ROUTES = ['admin', 'admin-create'];

export function isProtectedRoute(route: string): boolean {
  const base = route.split('/')[0].split('?')[0];
  return PROTECTED_ROUTES.includes(base);
}

function isAdminRoute(route: string): boolean {
  const base = route.split('/')[0].split('?')[0];
  return ADMIN_ROUTES.includes(base);
}

export function requireAuth(route: string): boolean {
  if (!isProtectedRoute(route)) return false;
  if (!isAuthenticated()) {
    navigate('login');
    return true; // blocked
  }

  // Admin route guard — must have admin or game_master role
  if (isAdminRoute(route) && !hasAdminPrivileges()) {
    console.warn('[Router] Access denied: admin privileges required for', route);
    navigate('home');
    return true; // blocked
  }

  return false;
}

export function onRouteChange(callback: (route: string) => void): void {
  let lastRoute = '';
  window.addEventListener('hashchange', () => {
    const route = getCurrentRoute();
    if (route === lastRoute) return;
    lastRoute = route;
    localStorage.setItem(ROUTE_KEY, route);
    callback(route);
  });
}
