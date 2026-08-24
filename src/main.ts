import './style.css';
import { getCurrentRoute, onRouteChange, navigate, requireAuth } from './router.ts';
import { renderNav, initNav } from './components/nav.ts';
import { renderMenu, initMenu } from './components/menu.ts';
import { renderModalContainer } from './components/modal.ts';
import { getGearButtonHtml, openSettings } from './components/settings-drawer.ts';
import { applyTheme, applyTextSize } from './lib/settings.ts';
import { MONSTER_AVATARS } from './data/avatars.ts';
import { getSelectedAvatar } from './state.ts';
import { initAuth, isAuthenticated, onAuthChange } from './lib/auth.ts';
import { loadUserData, migrateLocalData, clearCache } from './lib/db.ts';

// Lazy import views
import * as homeView from './views/home.ts';
import * as featuredView from './views/featured.ts';
import * as exploreView from './views/explore.ts';
import * as libraryView from './views/library.ts';
import * as createView from './views/create.ts';
import * as storyReaderView from './views/story-reader.ts';
import * as helpView from './views/help.ts';
import * as aboutView from './views/about.ts';
import * as profileView from './views/profile.ts';
import * as bookViewerView from './views/book-viewer.ts';
import * as guestViewerView from './views/guest-viewer.ts';
import * as authView from './views/auth.ts';
import * as adminView from './views/admin.ts';
import * as pathSelectView from './views/path-select.ts';
import * as squadLobbyView from './views/squad-lobby.ts';
import * as lfgBioView from './views/lfg-bio.ts';
import * as lfgBrowseView from './views/lfg-browse.ts';
import * as sparcCheckpointView from './views/sparc-checkpoint.ts';
import * as betaInviteView from './views/beta-invite.ts';

function getHeaderAvatarHtml(): string {
  if (!isAuthenticated()) {
    // Question mark icon for logged-out / new users — hints to click
    return `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.7;">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`;
  }
  const idx = getSelectedAvatar();
  return MONSTER_AVATARS[idx];
}

async function initApp() {
  const app = document.getElementById('app');
  if (!app) return;

  // Apply theme immediately before async work
  applyTheme();
  applyTextSize();

  // Initialize auth and wait for session check
  const user = await initAuth();

  // If authenticated, load all user data from Supabase
  if (user) {
    await loadUserData();
    await migrateLocalData(); // One-time migration of localStorage data
  }

  // Listen for auth changes (login/logout)
  onAuthChange(async (authUser) => {
    // Don't re-render on beta invite route — it manages its own auth flow
    const currentBase = getCurrentRoute().split('/')[0];
    if (currentBase === 'beta') return;

    if (authUser) {
      await loadUserData();
      await migrateLocalData();
    } else {
      clearCache();
    }
    // Re-render current view
    renderView(getCurrentRoute());
  });
  
  app.innerHTML = `
    <div class="app-shell">
      <!-- Menu drawer + backdrop -->
      ${renderMenu()}
      
      <!-- Main content area -->
      <main class="app-content" id="app-content">
        <!-- View header (hidden for reader) -->
        <header class="view-header" id="view-header">
          <button class="hamburger-btn" id="hamburger-btn" aria-label="Open menu" style="background:none; border:none; cursor:pointer;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <h1 class="view-title" id="view-title">Home</h1>
          <div class="header-right-group">
            ${getGearButtonHtml()}
            <button class="header-avatar" id="header-avatar-btn" aria-label="Profile">
              <div class="header-avatar__img" id="header-avatar-img">
                ${getHeaderAvatarHtml()}
              </div>
            </button>
          </div>
        </header>
        
        <!-- Dynamic view container -->
        <div id="view-container"></div>
      </main>
      
      <!-- Bottom navigation -->
      <div id="nav-container"></div>
      
      <!-- Modal container -->
      ${renderModalContainer()}
    </div>
  `;
  
  initMenu();

  // Apply saved theme
  applyTheme();
  applyTextSize();

  // Header avatar click → profile (logged in) or login (logged out)
  const avatarBtn = document.getElementById('header-avatar-btn');
  if (avatarBtn) {
    avatarBtn.addEventListener('click', () => {
      navigate(isAuthenticated() ? 'profile' : 'login');
    });
  }

  // Settings gear click → open settings drawer
  const settingsBtn = document.getElementById('header-settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => openSettings());
  }

  onRouteChange(renderView);
  
  const initialRoute = getCurrentRoute() || 'home';
  renderView(initialRoute);

  // After initial render, enable fade-in animations for subsequent route changes
  requestAnimationFrame(() => {
    document.documentElement.classList.add('app-ready');
  });
}

let isFirstRender = true;

function renderView(route: string) {
  const container = document.getElementById('view-container');
  const header = document.getElementById('view-header');
  const viewTitle = document.getElementById('view-title');
  const navContainer = document.getElementById('nav-container');
  const appContent = document.getElementById('app-content');
  
  if (!container || !header || !viewTitle || !navContainer || !appContent) return;

  // Auth guard — redirect to login for protected routes
  if (requireAuth(route)) return;

  const baseRoute = route.split('/')[0].split('?')[0];
  let viewModule: any;
  let title = 'Home';
  
  switch(baseRoute) {
    case 'home': viewModule = homeView; title = 'Home'; break;
    case 'featured': viewModule = featuredView; title = 'Featured'; break;
    case 'explore': viewModule = exploreView; title = 'Explore'; break;
    case 'library': viewModule = libraryView; title = 'My Library'; break;
    case 'create': viewModule = createView; title = 'Create'; break;
    case 'help': viewModule = helpView; title = 'Help'; break;
    case 'about': viewModule = aboutView; title = 'About'; break;
    case 'profile': viewModule = profileView; title = 'Profile'; break;
    case 'story': viewModule = storyReaderView; title = ''; break;
    case 'book': viewModule = bookViewerView; title = ''; break;
    case 'shared': viewModule = guestViewerView; title = ''; break;
    case 'login': case 'signup': viewModule = authView; title = ''; break;
    case 'admin': viewModule = adminView; title = 'Admin Dashboard'; break;
    case 'path-select': viewModule = pathSelectView; title = 'Choose Path'; break;
    case 'squad-lobby': viewModule = squadLobbyView; title = 'Squad Lobby'; break;
    case 'lfg-bio': viewModule = lfgBioView; title = 'Join Queue'; break;
    case 'lfg-browse': viewModule = lfgBrowseView; title = 'Find Players'; break;
    case 'sparc': viewModule = sparcCheckpointView; title = 'SPARC'; break;
    case 'beta': viewModule = betaInviteView; title = ''; break;
    default: viewModule = homeView; title = 'Home'; break;
  }
  
  // On very first render, skip fade-in animation to prevent white flash
  let html = viewModule.render();
  if (isFirstRender) {
    html = html.replace(/\bfade-in\b/g, 'fade-in no-initial-fade');
    isFirstRender = false;
  }

  container.innerHTML = html;
  viewModule.init();
  
  const isFullScreen = ['story', 'book', 'shared', 'login', 'signup', 'beta'].includes(baseRoute);
  
  if (isFullScreen) {
    header.style.display = 'none';
    navContainer.style.display = 'none';
  } else {
    header.style.display = 'flex';
    navContainer.style.display = 'block';
    viewTitle.textContent = title;
    navContainer.innerHTML = renderNav(baseRoute);
    initNav();

    // Refresh header avatar (may have changed on profile page)
    const headerAvatarImg = document.getElementById('header-avatar-img');
    if (headerAvatarImg) {
      headerAvatarImg.innerHTML = getHeaderAvatarHtml();
    }
  }
  
  appContent.scrollTop = 0;
}

document.addEventListener('DOMContentLoaded', initApp);

