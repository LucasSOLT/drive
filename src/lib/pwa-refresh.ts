export function initPullToRefresh() {
  // Only activate in standalone (PWA) mode on mobile devices
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (!isPWA || !isMobile) return;

  const appContent = document.getElementById('app-content');
  if (!appContent) return;

  // Create the pull-to-refresh UI
  const ptrContainer = document.createElement('div');
  ptrContainer.id = 'pwa-ptr';
  ptrContainer.style.cssText = `
    position: absolute;
    top: -60px;
    left: 0;
    width: 100%;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.2s;
  `;

  const spinner = document.createElement('div');
  spinner.style.cssText = `
    width: 24px;
    height: 24px;
    border: 3px solid rgba(16, 185, 129, 0.2);
    border-top-color: var(--color-purple, #10B981);
    border-radius: 50%;
    animation: ptr-spin 1s linear infinite;
  `;
  
  // Inject the keyframes safely if they don't exist
  if (!document.getElementById('ptr-keyframes')) {
    const style = document.createElement('style');
    style.id = 'ptr-keyframes';
    style.textContent = '@keyframes ptr-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  ptrContainer.appendChild(spinner);
  
  // Wait for the app-content to have a wrapper, or we can just prepend it
  // Since app-content has overflow-y: auto, we can just position it relative
  appContent.style.position = 'relative';
  appContent.prepend(ptrContainer);

  let touchStartY = 0;
  let isAtTop = false;
  let ptrTimer: any = null;
  let isRefreshing = false;
  
  // On touch start, check if we are at the top
  appContent.addEventListener('touchstart', (e) => {
    if (appContent.scrollTop <= 0) {
      isAtTop = true;
      touchStartY = e.touches[0].clientY;
    } else {
      isAtTop = false;
    }
  }, { passive: true });

  // On scroll, check if iOS overscroll makes scrollTop negative
  appContent.addEventListener('scroll', () => {
    if (isRefreshing) return;
    
    if (appContent.scrollTop < -45) {
      ptrContainer.style.opacity = '1';
      if (!ptrTimer) {
        ptrTimer = setTimeout(() => {
          if (appContent.scrollTop < -45 && !isRefreshing) {
            isRefreshing = true;
            triggerRefresh();
          }
        }, 1200); // Wait for a second or two
      }
    } else {
      ptrContainer.style.opacity = '0';
      if (ptrTimer) {
        clearTimeout(ptrTimer);
        ptrTimer = null;
      }
    }
  }, { passive: true });
  
  appContent.addEventListener('touchend', () => {
    if (!isRefreshing && ptrTimer) {
      clearTimeout(ptrTimer);
      ptrTimer = null;
    }
  });

  function triggerRefresh() {
    // Show visual feedback
    spinner.style.borderTopColor = '#ffffff';
    spinner.style.borderWidth = '4px';
    
    setTimeout(() => {
      window.location.reload();
    }, 300);
  }
}
