import './style.css';
import { getCurrentRoute, onRouteChange, navigate, requireAuth } from './router.ts';
import { renderNav, initNav } from './components/nav.ts';
import { renderMenu, initMenu } from './components/menu.ts';
import { renderModalContainer, showModal } from './components/modal.ts';
import { openSquadGateFromDeepLink } from './components/squad-gate-modal.ts';
import { addFriendByCode, findUserByFriendCode } from './lib/friends.ts';
import { getGearButtonHtml, openSettings } from './components/settings-drawer.ts';
import { applyTheme, applyTextSize } from './lib/settings.ts';
import { MONSTER_AVATARS } from './data/avatars.ts';
import { getSelectedAvatar, isContentManagementMode, setContentManagementMode, initSlotOverrides } from './state.ts';
import { initAuth, isAuthenticated, onAuthChange } from './lib/auth.ts';
import { loadUserData, migrateLocalData, clearCache, joinSquadByCode, fetchSquadByCode, getSquadMembers } from './lib/db.ts';

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
import * as friendsView from './views/friends.ts';
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
import * as adminCreateView from './views/admin-create.ts';

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

  // Sync cloud slot overrides so all devices see the same homepage/feed layout
  initSlotOverrides().catch(() => {});

  // Initialize auth and wait for session check
  const user = await initAuth();

  // If authenticated, load all user data from Supabase
  if (user) {
    await loadUserData();
    await migrateLocalData(); // One-time migration of localStorage data
  }

  // Listen for auth changes (login/logout).
  // Skip the FIRST callback — Supabase emits a SIGNED_IN event on session
  // restore which is redundant because initAuth() already resolved the user.
  // Without this guard, the app would do two full renderView() calls on boot.
  let authCallbackReady = false;
  onAuthChange(async (authUser) => {
    if (!authCallbackReady) {
      authCallbackReady = true;
      return; // Skip the initial SIGNED_IN / session-restore event
    }

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
  
  // ── Hydrate the pre-rendered shell (injected via index.html) ──
  // Instead of overwriting app.innerHTML (which would destroy the static shell
  // and cause a layout shift), we inject dynamic parts into existing containers.

  // 1. Inject the menu drawer into the app-shell (before app-content)
  const appShell = app.querySelector('.app-shell');
  if (appShell) {
    const menuFragment = document.createElement('div');
    menuFragment.innerHTML = renderMenu();
    // Insert each child of the menu HTML before <main>
    const appContentEl = document.getElementById('app-content');
    while (menuFragment.firstChild) {
      appShell.insertBefore(menuFragment.firstChild, appContentEl);
    }
  }

  // 2. Inject gear + avatar buttons into the header-right-group
  const headerRightGroup = app.querySelector('.header-right-group');
  if (headerRightGroup) {
    headerRightGroup.innerHTML = `
      ${getGearButtonHtml()}
      <button class="header-avatar" id="header-avatar-btn" aria-label="Profile">
        <div class="header-avatar__img" id="header-avatar-img">
          ${getHeaderAvatarHtml()}
        </div>
      </button>
    `;
  }

  // 3. Set up modal container
  const modalContainer = document.getElementById('modal-container');
  if (modalContainer) {
    modalContainer.outerHTML = renderModalContainer();
  }

  initMenu();

  // Apply saved theme
  applyTheme();
  applyTextSize();

  // Exit Content Management handler
  const exitCMMode = () => {
    setContentManagementMode(false);
    document.body.classList.remove('content-management-mode');
    navigate('admin?tab=content-management');
  };

  document.getElementById('cm-back-btn')?.addEventListener('click', exitCMMode);
  document.getElementById('cm-banner-exit-btn')?.addEventListener('click', exitCMMode);

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

  // In Content Management mode, block navigating to Library and redirect to Home
  if (isContentManagementMode() && baseRoute === 'library') {
    navigate('home');
    return;
  }

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
    case 'friends': viewModule = friendsView; title = 'Social'; break;
    case 'story': viewModule = storyReaderView; title = ''; break;
    case 'book': viewModule = bookViewerView; title = ''; break;
    case 'shared': viewModule = guestViewerView; title = ''; break;
    case 'login': case 'signup': viewModule = authView; title = ''; break;
    case 'admin': viewModule = adminView; title = 'Admin Dashboard'; break;
    case 'admin-create': viewModule = adminCreateView; title = ''; break;
    case 'path-select': viewModule = pathSelectView; title = 'Choose Path'; break;
    case 'squad-lobby': viewModule = squadLobbyView; title = 'Squad Lobby'; break;
    case 'lfg-bio': viewModule = lfgBioView; title = 'Join Queue'; break;
    case 'lfg-browse': viewModule = lfgBrowseView; title = 'Find Players'; break;
    case 'sparc': viewModule = sparcCheckpointView; title = 'SPARC'; break;
    case 'beta': viewModule = betaInviteView; title = ''; break;
    case 'join': viewModule = homeView; title = 'Home'; break;
    case 'add-friend': viewModule = homeView; title = 'Home'; break;
    default: viewModule = homeView; title = 'Home'; break;
  }

  // ── Phase 1: Compute layout state BEFORE touching the DOM ──
  const isFullScreen = ['story', 'book', 'shared', 'login', 'signup', 'beta', 'admin-create'].includes(baseRoute);
  const isCMActive = isContentManagementMode();
  const isCMFeedPage = ['home', 'featured', 'explore'].includes(baseRoute);

  // ── Phase 2: Reset scroll BEFORE new content is visible ──
  appContent.scrollTop = 0;

  // ── Phase 3: Set header/nav/CM visibility BEFORE injecting content ──
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const cmBackBtn = document.getElementById('cm-back-btn');
  const cmBanner = document.getElementById('cm-top-banner');

  if (isFullScreen) {
    header.style.display = 'none';
    navContainer.style.display = 'none';
  } else {
    header.style.display = 'flex';
    navContainer.style.display = 'block';
    viewTitle.textContent = title;
  }

  if (isCMActive && isCMFeedPage) {
    document.body.classList.add('content-management-mode');
    if (hamburgerBtn) hamburgerBtn.style.display = 'none';
    if (cmBackBtn) cmBackBtn.style.display = 'inline-flex';
    if (cmBanner) cmBanner.style.display = 'flex';
  } else {
    document.body.classList.remove('content-management-mode');
    if (hamburgerBtn) hamburgerBtn.style.display = 'flex';
    if (cmBackBtn) cmBackBtn.style.display = 'none';
    if (cmBanner) cmBanner.style.display = 'none';
    if (!isCMFeedPage && isCMActive) {
      setContentManagementMode(false);
    }
  }

  // ── Phase 4: Inject content (single main reflow) ──
  const html = viewModule.render();

  container.innerHTML = html;
  viewModule.init();

  // ── Phase 4c: Handle QR code / deep link friend scan (#add-friend?code=...) ──
  if (baseRoute === 'add-friend') {
    const hash = window.location.hash;
    const codeMatch = hash.match(/code=([^&]+)/);
    if (codeMatch) {
      const friendCode = codeMatch[1].trim();
      setTimeout(async () => {
        if (!isAuthenticated()) {
          // Unauthenticated user scanned QR code -> save pending friend and prompt login
          localStorage.setItem('drive_pending_friend_add', friendCode);
          showModal({
            title: 'Add Friend on DRiVE',
            content: `
              <div style="text-align:center; padding:10px 0;">
                <div style="font-size:2.5rem; margin-bottom:8px;">👥</div>
                <p style="line-height:1.5; color:#f1f5f9; font-size:0.95rem; margin-bottom:12px;">
                  You scanned a friend code! Please log in or create an account to connect as friends on DRiVE.
                </p>
                <div style="padding:8px 12px; background:rgba(139,92,246,0.12); border-radius:8px; display:inline-block; font-family:monospace; font-weight:700; font-size:1.1rem; color:#c084fc; letter-spacing:2px;">
                  ${friendCode}
                </div>
              </div>
            `,
            confirmText: 'Log In / Sign Up',
            cancelText: 'Cancel',
            onConfirm: () => {
              navigate('login');
            }
          });
          return;
        }

        // Authenticated user scanned QR code -> look up friend and show confirmation prompt
        const targetUser = await findUserByFriendCode(friendCode);
        const displayName = targetUser?.username || ('User ' + friendCode.slice(-4));

        showModal({
          title: 'Add Friend?',
          content: `
            <div style="text-align:center; padding:10px 0;">
              <div style="font-size:2.5rem; margin-bottom:8px;">🤝</div>
              <p style="line-height:1.5; color:#f1f5f9; font-size:0.95rem; margin-bottom:12px;">
                Would you like to add <strong>${displayName}</strong> as a friend on DRiVE?
              </p>
              <div style="padding:6px 14px; background:rgba(139,92,246,0.15); border:1px solid rgba(139,92,246,0.3); border-radius:100px; display:inline-block; font-family:monospace; font-weight:700; font-size:0.9rem; color:#c084fc; letter-spacing:1px;">
                Code: ${friendCode}
              </div>
            </div>
          `,
          confirmText: 'Yes, Add Friend',
          cancelText: 'Cancel',
          onConfirm: async () => {
            const res = await addFriendByCode(friendCode);
            showModal({
              title: res.success ? 'Friend Added! 🎉' : 'Notice',
              content: `<p style="line-height:1.6; text-align:center;">${res.message}</p>`,
              confirmText: 'Go to Social Hub',
              onConfirm: () => {
                navigate('friends');
              }
            });
          }
        });
      }, 250);
    }
  }

  // ── Phase 4b: Handle deep link squad join ──
  if (baseRoute === 'join') {
    const hash = window.location.hash;
    const squadMatch = hash.match(/squad=([^&]+)/);
    const storyMatch = hash.match(/story=([^&]+)/);
    if (squadMatch) {
      const squadCode = squadMatch[1];
      const storyId = storyMatch ? storyMatch[1] : '';
      // Small delay to let home view render first
      setTimeout(async () => {
        if (isAuthenticated()) {
          try {
            const result = await joinSquadByCode(squadCode);
            if (result) {
              navigate('squad-lobby/' + result.squadId);
            }
          } catch (err: any) {
            console.error('Failed to join squad:', err);
            alert(err.message || 'Failed to join squad');
          }
        } else {
          // Render welcome overlay
          const overlay = document.createElement('div');
          overlay.id = 'invite-welcome-overlay';
          overlay.style.cssText = 'position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; padding:20px;';
          overlay.innerHTML = `
            <div style="background:var(--color-surface); border-radius:var(--radius-xl); max-width:420px; width:100%; padding:32px; text-align:center; border:1.5px solid var(--color-border);">
              <div style="font-size:2.5rem; margin-bottom:12px;">👋</div>
              <h2 style="font-family:var(--font-heading); font-size:1.3rem; margin:0 0 8px;">You've Been Invited!</h2>
              <p style="color:var(--color-text-secondary); font-size:0.9rem; line-height:1.6; margin:0 0 20px;">
                <strong id="invite-driver-name">A DRiVER</strong> has invited you to a DRiVE Story Squad!
              </p>
              <p style="color:var(--color-text-muted); font-size:0.82rem; line-height:1.5; margin:0 0 24px;">
                To keep your progress through this experience, you must create a free account below.
                We don't use your account to sell anything or advertise.
              </p>
              <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="invite-signup-btn" style="padding:14px; background:linear-gradient(135deg, var(--color-purple), #7c3aed); color:white; border:none; border-radius:var(--radius-lg); font-weight:700; font-size:0.95rem; cursor:pointer;">Create Free Account</button>
                <button id="invite-login-btn" style="padding:12px; background:var(--color-eggshell); color:var(--color-text-primary); border:1px solid var(--color-border); border-radius:var(--radius-lg); font-weight:600; font-size:0.9rem; cursor:pointer;">Already have one? Log In</button>
              </div>
              <p style="color:var(--color-text-muted); font-size:0.75rem; margin-top:16px; line-height:1.4;">
                ℹ️ You'll start at Episode 1 to experience the story hook before joining your squad for the full journey.
              </p>
            </div>
          `;
          document.body.appendChild(overlay);

          // Fetch driver name asynchronously
          fetchSquadByCode(squadCode).then(squad => {
            if (squad) {
              getSquadMembers(squad.id).then(members => {
                const driver = members.find(m => m.role === 'driver');
                if (driver) {
                  const nameEl = document.getElementById('invite-driver-name');
                  if (nameEl) nameEl.textContent = driver.username;
                }
              });
            }
          }).catch(err => console.error('Error fetching driver:', err));

          const handleAuth = (route: string) => {
            localStorage.setItem('drive_pending_squad_join', JSON.stringify({ squadCode, storyId, timestamp: Date.now() }));
            overlay.remove();
            navigate(route);
          };

          document.getElementById('invite-signup-btn')?.addEventListener('click', () => handleAuth('signup'));
          document.getElementById('invite-login-btn')?.addEventListener('click', () => handleAuth('login'));
        }
      }, 200);
    }
  }

  // ── Phase 5: Update navigation (avoid full rebuild when possible) ──
  if (!isFullScreen) {
    const existingNav = navContainer.querySelector('.bottom-nav');
    const needsCMClass = isCMActive && isCMFeedPage;
    const hasCMClass = existingNav?.classList.contains('bottom-nav--cm') ?? false;

    if (!existingNav || needsCMClass !== hasCMClass) {
      // Full rebuild needed (first render or CM mode changed)
      navContainer.innerHTML = renderNav(baseRoute);
      initNav();
    } else {
      // Just update active tab highlighting — no DOM destruction
      navContainer.querySelectorAll('.nav-item').forEach(item => {
        const itemRoute = item.getAttribute('data-route');
        if (itemRoute) {
          item.classList.toggle('active', itemRoute === baseRoute);
        }
      });
    }

    // Refresh header avatar (may have changed on profile page)
    const headerAvatarImg = document.getElementById('header-avatar-img');
    if (headerAvatarImg) {
      headerAvatarImg.innerHTML = getHeaderAvatarHtml();
    }
  }
}

document.addEventListener('DOMContentLoaded', initApp);


