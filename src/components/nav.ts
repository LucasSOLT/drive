import { navigate } from '../router.ts';
import { isLibraryUnlocked, isContentManagementMode } from '../state.ts';

export function renderNav(activeTab: string): string {
  const inCM = isContentManagementMode();
  const locked = !isLibraryUnlocked();
  return `
    <nav class="bottom-nav slide-up ${inCM ? 'bottom-nav--cm' : ''}">
      <a class="nav-item ${activeTab === 'home' ? 'active' : ''}" data-route="home">
        <svg class="nav-item__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span class="nav-item__label">Home</span>
      </a>
      <a class="nav-item ${activeTab === 'featured' ? 'active' : ''}" data-route="featured">
        <svg class="nav-item__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        <span class="nav-item__label">Featured</span>
      </a>
      <a class="nav-item ${activeTab === 'explore' ? 'active' : ''}" data-route="explore">
        <svg class="nav-item__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
        </svg>
        <span class="nav-item__label">Explore</span>
      </a>
      ${inCM ? `
      <a class="nav-item nav-item--cm-disabled" style="opacity: 0.35; cursor: not-allowed; position: relative;" title="Library is unavailable in Content Management View">
        <div style="position: absolute; top: 6px; right: 12px; font-size: 0.55rem; background: rgba(139,92,246,0.3); color: var(--color-purple); padding: 1px 4px; border-radius: 4px; font-weight: 800;">LOCKED</div>
        <svg class="nav-item__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <span class="nav-item__label">Library</span>
      </a>
      ` : `
      <a class="nav-item ${activeTab === 'library' ? 'active' : ''}" data-route="library">
        ${locked ? '<div class="nav-item__lock-badge"></div>' : ''}
        <svg class="nav-item__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
        <span class="nav-item__label">Library</span>
      </a>
      `}
    </nav>
  `;
}

export function initNav(): void {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      if (target.classList.contains('nav-item--cm-disabled')) {
        showCMDisabledToast();
        return;
      }
      const route = target.getAttribute('data-route');
      if (route) {
        navigate(route);
      }
    });
  });
}

function showCMDisabledToast(): void {
  const existing = document.getElementById('cm-disabled-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'cm-disabled-toast';
  toast.style.cssText = 'position: fixed; bottom: 85px; left: 50%; transform: translateX(-50%); background: rgba(30,20,50,0.95); color: #fff; border: 1px solid var(--color-purple); padding: 10px 18px; border-radius: 14px; font-size: 0.78rem; font-weight: 600; z-index: 10000; box-shadow: 0 4px 20px rgba(139,92,246,0.35); text-align: center; max-width: 90%; backdrop-filter: blur(8px);';
  toast.innerHTML = '🚫 <strong>Library is locked</strong> in Content Management View.<br><span style="font-size:0.72rem; color: var(--color-text-muted);">Use the Back button at top-left to return to Admin.</span>';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
