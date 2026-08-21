import { navigate } from '../router.ts';
import { isLibraryUnlocked } from '../state.ts';

export function renderNav(activeTab: string): string {
  const locked = !isLibraryUnlocked();
  return `
    <nav class="bottom-nav slide-up">
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
      <a class="nav-item ${activeTab === 'library' ? 'active' : ''}" data-route="library">
        ${locked ? '<div class="nav-item__lock-badge"></div>' : ''}
        <svg class="nav-item__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
        <span class="nav-item__label">Library</span>
      </a>
    </nav>
  `;
}

export function initNav(): void {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const route = target.getAttribute('data-route');
      if (route) {
        navigate(route);
      }
    });
  });
}
