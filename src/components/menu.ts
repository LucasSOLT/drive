import { navigate, getCurrentRoute } from '../router.ts';
import { hasAdminPrivileges, checkIsGameMaster } from '../lib/db.ts';

export function renderMenu(): string {
  return `
    <div class="fullmenu" id="fullmenu">
      <!-- Close button -->
      <button class="fullmenu__close" id="fullmenu-close" aria-label="Close menu">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <!-- Decorative abstract shapes -->
      <div class="fullmenu__decor">
        <div class="fullmenu__shape fullmenu__shape--1"></div>
        <div class="fullmenu__shape fullmenu__shape--2"></div>
        <div class="fullmenu__shape fullmenu__shape--3"></div>
      </div>

      <!-- Brand -->
      <div class="fullmenu__brand" style="display: flex; align-items: center; gap: 12px;">
        <img src="/logo.jpg" alt="DRiVE" style="width: 44px; height: 44px; border-radius: 50%; border: 1.5px solid var(--color-border); object-fit: cover;">
        <span class="fullmenu__logo">DRiVE</span>
      </div>

      <!-- Navigation links -->
      <nav class="fullmenu__nav" id="fullmenu-nav">
        <a class="fullmenu__link" data-route="home">
          <span class="fullmenu__link-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </span>
          <span class="fullmenu__link-text">Home</span>
        </a>
        <a class="fullmenu__link" data-route="featured">
          <span class="fullmenu__link-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </span>
          <span class="fullmenu__link-text">Featured</span>
        </a>
        <a class="fullmenu__link" data-route="explore">
          <span class="fullmenu__link-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
            </svg>
          </span>
          <span class="fullmenu__link-text">Explore</span>
        </a>
        <a class="fullmenu__link" data-route="help">
          <span class="fullmenu__link-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </span>
          <span class="fullmenu__link-text">Help</span>
        </a>
        <a class="fullmenu__link" data-route="about">
          <span class="fullmenu__link-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </span>
          <span class="fullmenu__link-text">About</span>
        </a>
        <a class="fullmenu__link" data-route="profile">
          <span class="fullmenu__link-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </span>
          <span class="fullmenu__link-text">Profile</span>
        </a>
        <a class="fullmenu__link" data-route="admin" id="menu-admin-link" style="display:none;">
          <span class="fullmenu__link-icon" id="menu-admin-icon" style="color:var(--color-purple);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </span>
          <span class="fullmenu__link-text" id="menu-admin-label" style="color:var(--color-purple); font-weight:700;">Admin Creation Dashboard</span>
        </a>
      </nav>


      <!-- Footer -->
      <div class="fullmenu__footer">
        <p>&copy; ${new Date().getFullYear()} DRiVE Inc.</p>
      </div>
    </div>
  `;
}

export function initMenu(): void {
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const menu = document.getElementById('fullmenu');
  const closeBtn = document.getElementById('fullmenu-close');
  const nav = document.getElementById('fullmenu-nav');

  if (!menu) return;

  const openMenu = () => {
    menu.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Show Admin link if logged in user has admin privileges
    const adminLink = document.getElementById('menu-admin-link');
    if (adminLink) {
      const isAdmin = hasAdminPrivileges();
      console.log('[Menu] Admin privileges check:', isAdmin);
      
      if (isAdmin) {
        adminLink.style.display = 'flex';
        
        // Customize label and color based on role
        const label = document.getElementById('menu-admin-label');
        const icon = document.getElementById('menu-admin-icon');
        const isGM = checkIsGameMaster();
        
        if (isGM) {
          if (label) {
            label.textContent = '👑 Game Master Dashboard';
            label.style.color = '#F59E0B';
          }
          if (icon) icon.style.color = '#F59E0B';
        } else {
          if (label) {
            label.textContent = 'Admin Creation Dashboard';
            label.style.color = 'var(--color-purple)';
          }
          if (icon) icon.style.color = 'var(--color-purple)';
        }
      } else {
        adminLink.style.display = 'none';
      }
    }


    // Mark active link based on current route
    const currentRoute = getCurrentRoute().split('/')[0] || 'home';
    const links = menu.querySelectorAll('.fullmenu__link');
    links.forEach((link, i) => {
      const el = link as HTMLElement;
      el.style.animationDelay = `${0.08 + i * 0.06}s`;
      el.classList.toggle('active', el.getAttribute('data-route') === currentRoute);
    });
  };

  const closeMenu = () => {
    menu.classList.remove('open');
    document.body.style.overflow = '';
  };

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', openMenu);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeMenu);
  }

  if (nav) {
    nav.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest('.fullmenu__link');
      if (!link) return;
      e.preventDefault();
      const route = link.getAttribute('data-route');
      if (route) {
        closeMenu();
        // Small delay so close animation plays before navigation
        setTimeout(() => navigate(route), 150);
      }
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) {
      closeMenu();
    }
  });


}
