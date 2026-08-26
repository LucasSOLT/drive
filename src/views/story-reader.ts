import { openSquadGateModal } from '../components/squad-gate-modal.ts';
import { getRouteParam, navigate } from '../router.ts';
import { getStoryById } from '../data/stories.ts';
import {
  getStoryLikes, hasUserLiked, toggleStoryLike,
  isBookmarked, toggleBookmark
} from '../state.ts';
import { stopSpeaking, isSpeaking, playAudioUrl } from '../lib/tts.ts';
import { getSettings } from '../lib/settings.ts';


// ─── SVG Icons ───
const ICON = {
  back: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  bookmarkOff: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  bookmarkOn: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  heartOff: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  heartOn: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  share: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  bigHeart: `<svg viewBox="0 0 24 24" fill="#EF4444" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  comment: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
};

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export function render(): string {
  const storyId = getRouteParam();
  if (!storyId) return '<div class="reader-error">No story ID provided.</div>';

  const story = getStoryById(storyId);
  if (!story) return '<div class="reader-error">Story not found.</div>';

  const liked = hasUserLiked(storyId);
  const likeCount = getStoryLikes(storyId);
  const bookmarked = isBookmarked(storyId);

  let contentHtml = '';

  if (story.format === 'scroll') {
    contentHtml = `
      <div class="reader__scroll-content">
        ${story.panels.map((panel: string, i: number) => `
          <div class="reader__panel" data-panel-index="${i}">
            <img src="${panel}" alt="Panel ${i + 1}" loading="lazy">
            ${story.pageAudio?.[i] ? `
              <button class="reader-audio-btn" data-audio-panel="${i}" type="button" title="Play audio">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>
            ` : ''}
          </div>
        `).join('')}

        <!-- Waterfall End-of-Episode Squad Gate Banner -->
        <div class="reader__waterfall-endcard" id="waterfall-endcard">
          <div class="reader__endcard-badge">
            <span class="squad-gate-badge-dot"></span>
            <span>EPISODE 1 COMPLETE</span>
          </div>
          <h3 class="reader__endcard-title">The Hook is Set.</h3>
          <p class="reader__endcard-desc">
            To unlock <strong>Episode 2</strong> and continue the journey, form or join a Squad of <strong>3 to 5 players</strong>.
          </p>
          <button class="reader__endcard-btn" id="btn-waterfall-squad-gate">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Unlock Episode 2 with Squad
          </button>
        </div>
      </div>
    `;
  } else if (story.format === 'book') {
    const isVideoPage = story.pageVideos && story.pageVideos[0];
    const scriptText = story.pageScripts && story.pageScripts[0] ? story.pageScripts[0] : '';
    const hasAudio = !!story.pageAudio?.[0];
    const firstPageMedia = isVideoPage
      ? `<video id="book-video" src="${story.pageVideos![0]}" autoplay loop muted playsinline style="width:100%;height:auto;border-radius:8px;"></video>`
      : `<img id="book-img" src="${story.panels[0]}" alt="Page 1">`;

    contentHtml = `
      <div class="reader__book-content">
        <div class="reader__page" id="book-page" style="position:relative;">
          ${firstPageMedia}
          ${hasAudio ? `
            <button class="reader-audio-btn" id="reader-audio-toggle" type="button" title="Play audio">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
          ` : ''}
        </div>
        ${scriptText ? `
          <button class="reader-text-toggle" id="reader-text-toggle" type="button" title="Show story text">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/>
            </svg>
          </button>
          <div class="reader__script reader__script--collapsed" id="book-script" style="padding:1rem 1.25rem;margin:0.5rem auto;max-width:600px;background:rgba(0,0,0,0.6);border-radius:12px;backdrop-filter:blur(6px);display:none;">
            ${scriptText.split('\n').map((line: string) => {
              if (!line.trim()) return '<br>';
              const match = line.match(/^(\w+)\s*\(([^)]+)\):\s*"([^"]*)"$/);
              if (match) {
                return `<p style="margin:0.4rem 0;font-size:0.95rem;line-height:1.5;color:#e2e8f0;">
                  <span style="color:#60a5fa;font-weight:600;">${match[1]}</span>
                  <span style="color:#94a3b8;font-size:0.8rem;"> (${match[2]})</span>
                  <span style="color:#f1f5f9;font-style:italic;"> "${match[3]}"</span>
                </p>`;
              }
              return `<p style="margin:0.4rem 0;font-size:0.95rem;line-height:1.5;color:#e2e8f0;">${line}</p>`;
            }).join('')}
          </div>
        ` : ''}
        <div class="reader__page-nav">
          <button class="reader__page-btn" id="book-prev" aria-label="Previous page">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div class="reader__page-dots" id="book-dots">
            ${story.panels.map((_: string, i: number) => `<span class="reader__dot ${i === 0 ? 'active' : ''}" data-page="${i}"></span>`).join('')}
          </div>
          <button class="reader__page-btn" id="book-next" aria-label="Next page">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="reader" id="reader-container" data-story-id="${storyId}">

      <!-- Progress bar -->
      <div class="reader__progress-track">
        <div class="reader__progress-bar" id="reader-progress"></div>
      </div>

      <!-- Floating action header -->
      <header class="reader__header" id="reader-header">
        <button class="reader__header-btn reader__header-btn--back" id="reader-back" aria-label="Go back">
          ${ICON.back}
        </button>

        <div class="reader__header-info">
          <h2 class="reader__header-title">${story.title}</h2>
          <span class="reader__header-meta">${story.author} · ${story.genre}</span>
        </div>

        <div class="reader__header-actions">
          <button class="reader__action-btn ${bookmarked ? 'active' : ''}" id="btn-bookmark" aria-label="Bookmark">
            <span class="reader__action-icon" id="bookmark-icon">${bookmarked ? ICON.bookmarkOn : ICON.bookmarkOff}</span>
          </button>
          <button class="reader__action-btn ${liked ? 'active liked' : ''}" id="btn-like" aria-label="Like">
            <span class="reader__action-icon" id="like-icon">${liked ? ICON.heartOn : ICON.heartOff}</span>
            <span class="reader__action-count" id="like-count">${formatCount(likeCount)}</span>
          </button>
          <button class="reader__action-btn" id="btn-share" aria-label="Share">
            <span class="reader__action-icon">${ICON.share}</span>
          </button>
          <button class="reader__action-btn" id="btn-comments" aria-label="Comments">
            <span class="reader__action-icon">${ICON.comment}</span>
          </button>
        </div>
      </header>

      <!-- Story content -->
      <div class="reader__content" id="reader-content">
        ${contentHtml}
      </div>

      <!-- Double-tap heart overlay -->
      <div class="reader__heart-overlay" id="heart-overlay">
        <div class="reader__heart-burst" id="heart-burst">
          ${ICON.bigHeart}
        </div>
      </div>

      <!-- Action toast (bookmark/share/etc) -->
      <div class="reader__action-toast" id="action-toast"></div>
    </div>
  `;
}

export function init(): void {
  const container = document.getElementById('reader-container');
  if (!container) return;

  const storyId = container.dataset.storyId || '';
  const story = getStoryById(storyId);
  if (!story) return;

  const progressBar = document.getElementById('reader-progress');
  const header = document.getElementById('reader-header');

  // ─── Back button ───
  document.getElementById('reader-back')?.addEventListener('click', () => navigate('home'));

  // ─── Auto-hide header on scroll ───
  let lastScroll = 0;
  let headerVisible = true;
  const showHeader = () => { if (header && !headerVisible) { header.classList.remove('hidden'); headerVisible = true; } };
  const hideHeader = () => { if (header && headerVisible) { header.classList.add('hidden'); headerVisible = false; } };

  container.addEventListener('scroll', () => {
    const scrollTop = container.scrollTop;

    // Progress bar
    if (progressBar && story.format === 'scroll') {
      const max = container.scrollHeight - container.clientHeight;
      progressBar.style.width = max > 0 ? `${(scrollTop / max) * 100}%` : '0%';
    }

    // Auto-hide header: hide on scroll down, show on scroll up
    if (scrollTop > lastScroll && scrollTop > 80) {
      hideHeader();
    } else {
      showHeader();
    }
    lastScroll = scrollTop;
  });

  // ─── Action toast helper ───
  const actionToast = document.getElementById('action-toast');
  const showActionToast = (msg: string) => {
    if (!actionToast) return;
    actionToast.textContent = msg;
    actionToast.classList.add('show');
    setTimeout(() => actionToast.classList.remove('show'), 2000);
  };

  // ─── Bookmark toggle ───
  const bookmarkBtn = document.getElementById('btn-bookmark');
  const bookmarkIcon = document.getElementById('bookmark-icon');
  bookmarkBtn?.addEventListener('click', () => {
    const nowBookmarked = toggleBookmark(storyId);
    bookmarkBtn.classList.toggle('active', nowBookmarked);
    bookmarkBtn.classList.toggle('bookmarked', nowBookmarked);
    if (bookmarkIcon) bookmarkIcon.innerHTML = nowBookmarked ? ICON.bookmarkOn : ICON.bookmarkOff;
    bookmarkBtn.classList.add('bounce');
    setTimeout(() => bookmarkBtn.classList.remove('bounce'), 400);
    showActionToast(nowBookmarked ? 'Added to your favorites' : 'Removed from favorites');
  });

  // ─── Like toggle ───
  const likeBtn = document.getElementById('btn-like');
  const likeIcon = document.getElementById('like-icon');
  const likeCount = document.getElementById('like-count');

  const performLike = () => {
    const result = toggleStoryLike(storyId);
    likeBtn?.classList.toggle('active', result.liked);
    likeBtn?.classList.toggle('liked', result.liked);
    if (likeIcon) likeIcon.innerHTML = result.liked ? ICON.heartOn : ICON.heartOff;
    if (likeCount) likeCount.textContent = formatCount(result.count);
    // Pop animation
    likeBtn?.classList.add('bounce');
    setTimeout(() => likeBtn?.classList.remove('bounce'), 400);
  };

  likeBtn?.addEventListener('click', performLike);

  // ─── Double-tap heart ───
  const heartOverlay = document.getElementById('heart-overlay');
  const heartBurst = document.getElementById('heart-burst');
  const content = document.getElementById('reader-content');
  let lastTapTime = 0;

  content?.addEventListener('click', (e) => {
    const now = Date.now();
    if (now - lastTapTime < 350) {
      // Double tap!
      e.preventDefault();

      // Only like if not already liked
      if (!hasUserLiked(storyId)) {
        performLike();
      }

      // Show heart burst at tap position
      if (heartOverlay && heartBurst) {
        const rect = container.getBoundingClientRect();
        const x = (e as MouseEvent).clientX - rect.left;
        const y = (e as MouseEvent).clientY - rect.top;
        heartBurst.style.left = `${x}px`;
        heartBurst.style.top = `${y}px`;
        heartOverlay.classList.add('show');
        setTimeout(() => heartOverlay.classList.remove('show'), 800);
      }
    }
    lastTapTime = now;
  });

  // ─── Share ───
  const shareBtn = document.getElementById('btn-share');
  shareBtn?.addEventListener('click', async () => {
    const shareData = {
      title: story.title,
      text: `Check out "${story.title}" by ${story.author} on DRiVE!`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showActionToast('Link copied!');
      }
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      showActionToast('Link copied!');
    }
  });

  // ─── Book format page navigation ───
  if (story.format === 'book') {
    let currentPage = 0;
    let scriptVisible = false;
    const totalPages = story.panels.length;
    const pageContainer = document.getElementById('book-page');
    const dotsContainer = document.getElementById('book-dots');
    let scriptContainer = document.getElementById('book-script');

    const updatePage = () => {
      if (pageContainer) {
        const isVideo = story.pageVideos && story.pageVideos[currentPage];
        const hasAudio = !!story.pageAudio?.[currentPage];
        if (isVideo) {
          pageContainer.innerHTML = `<video id="book-video" src="${story.pageVideos![currentPage]}" autoplay loop muted playsinline style="width:100%;height:auto;border-radius:8px;"></video>`;
        } else {
          pageContainer.innerHTML = `<img id="book-img" src="${story.panels[currentPage]}" alt="Page ${currentPage + 1}">`;
        }
        // Add audio play button if page has audio
        if (hasAudio) {
          const audioBtn = document.createElement('button');
          audioBtn.className = 'reader-audio-btn';
          audioBtn.id = 'reader-audio-toggle';
          audioBtn.title = isSpeaking() ? 'Pause audio' : 'Play audio';
          audioBtn.innerHTML = isSpeaking()
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
          pageContainer.appendChild(audioBtn);
          audioBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isSpeaking()) {
              stopSpeaking();
              audioBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
              audioBtn.title = 'Play audio';
            } else {
              playAudioUrl(story.pageAudio![currentPage]);
              audioBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
              audioBtn.title = 'Pause audio';
            }
          });

          // Autoplay if setting is on
          if (getSettings().autoPlay) {
            playAudioUrl(story.pageAudio![currentPage]);
            audioBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
            audioBtn.title = 'Pause audio';
          }
        }

        // Re-add position:relative for audio button positioning
        pageContainer.style.position = 'relative';
      }
      // Update script text
      scriptContainer = document.getElementById('book-script');
      if (scriptContainer) {
        const scriptText = story.pageScripts && story.pageScripts[currentPage] ? story.pageScripts[currentPage] : '';
        if (scriptText) {
          scriptContainer.innerHTML = scriptText.split('\n').map((line: string) => {
            if (!line.trim()) return '<br>';
            const match = line.match(/^(\w+)\s*\(([^)]+)\):\s*"([^"]*)"$/);
            if (match) {
              return `<p style="margin:0.4rem 0;font-size:0.95rem;line-height:1.5;color:#e2e8f0;">
                <span style="color:#60a5fa;font-weight:600;">${match[1]}</span>
                <span style="color:#94a3b8;font-size:0.8rem;"> (${match[2]})</span>
                <span style="color:#f1f5f9;font-style:italic;"> "${match[3]}"</span>
              </p>`;
            }
            return `<p style="margin:0.4rem 0;font-size:0.95rem;line-height:1.5;color:#e2e8f0;">${line}</p>`;
          }).join('');
          scriptContainer.style.display = scriptVisible ? 'block' : 'none';
        } else {
          scriptContainer.style.display = 'none';
        }
      }
      // Update text toggle button icon
      const toggleBtn = document.getElementById('reader-text-toggle');
      if (toggleBtn) {
        toggleBtn.innerHTML = scriptVisible
          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h10"/></svg>`;
        toggleBtn.title = scriptVisible ? 'Hide story text' : 'Show story text';
      }
      if (dotsContainer) {
        dotsContainer.querySelectorAll('.reader__dot').forEach((dot, i) => {
          dot.classList.toggle('active', i === currentPage);
        });
      }
      if (progressBar) {
        progressBar.style.width = `${((currentPage + 1) / totalPages) * 100}%`;
      }
    };

    document.getElementById('book-prev')?.addEventListener('click', () => {
      if (currentPage > 0) { stopSpeaking(); currentPage--; updatePage(); }
    });
    document.getElementById('book-next')?.addEventListener('click', () => {
      if (currentPage < totalPages - 1) {
        stopSpeaking();
        currentPage++;
        updatePage();
      } else {
        // Reached end of Episode 1 in Illustrated Book
        stopSpeaking();
        openSquadGateModal({
          storyId: story.id,
          storyTitle: story.title,
          storyCoverImage: story.coverImage,
          episodeNumber: story.episodeNumber || 1,
          onReplay: () => {
            currentPage = 0;
            updatePage();
          },
        });
      }
    });

    // Waterfall squad gate button listener
    document.getElementById('btn-waterfall-squad-gate')?.addEventListener('click', () => {
      openSquadGateModal({
        storyId: story.id,
        storyTitle: story.title,
        storyCoverImage: story.coverImage,
        episodeNumber: story.episodeNumber || 1,
        onReplay: () => {
          container.scrollTo({ top: 0, behavior: 'smooth' });
        },
      });
    });

    // Text toggle
    document.getElementById('reader-text-toggle')?.addEventListener('click', () => {
      scriptVisible = !scriptVisible;
      updatePage();
    });

    // Dot click navigation
    dotsContainer?.addEventListener('click', (e) => {
      const dot = (e.target as HTMLElement).closest('.reader__dot') as HTMLElement;
      if (dot) {
        stopSpeaking();
        currentPage = parseInt(dot.dataset.page || '0', 10);
        updatePage();
      }
    });

    updatePage();
  }

  // Waterfall autoplay with IntersectionObserver
  if (story.format === 'scroll' && story.pageAudio) {
    const settings = getSettings();
    let currentPlayingPanel = -1;

    // Wire up manual audio buttons
    document.querySelectorAll('[data-audio-panel]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-audio-panel') || '0');
        if (isSpeaking() && currentPlayingPanel === idx) {
          stopSpeaking();
          currentPlayingPanel = -1;
          (btn as HTMLElement).innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
        } else {
          stopSpeaking();
          // Reset all buttons
          document.querySelectorAll('[data-audio-panel]').forEach(b => {
            (b as HTMLElement).innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
          });
          const audioUrl = story.pageAudio![idx];
          if (audioUrl) {
            playAudioUrl(audioUrl);
            currentPlayingPanel = idx;
            (btn as HTMLElement).innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
          }
        }
      });
    });

    // Autoplay on scroll into view
    if (settings.autoPlay) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = parseInt((entry.target as HTMLElement).getAttribute('data-panel-index') || '-1');
            if (idx >= 0 && idx !== currentPlayingPanel && story.pageAudio![idx]) {
              stopSpeaking();
              // Reset all buttons
              document.querySelectorAll('[data-audio-panel]').forEach(b => {
                (b as HTMLElement).innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
              });
              playAudioUrl(story.pageAudio![idx]);
              currentPlayingPanel = idx;
              const audioBtn = document.querySelector(`[data-audio-panel="${idx}"]`) as HTMLElement;
              if (audioBtn) {
                audioBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
              }
            }
          }
        });
      }, { threshold: 0.8 }); // 80% visible triggers autoplay

      document.querySelectorAll('[data-panel-index]').forEach(panel => {
        observer.observe(panel);
      });
    }
  }

  // ─── Comment button → fullscreen comments ───
  const commentBtn = document.getElementById('btn-comments');
  commentBtn?.addEventListener('click', () => {
    openFullscreenComments(storyId, story);
  });
}

function openFullscreenComments(storyId: string, story: any): void {
  // Create fullscreen comment view
  const overlay = document.createElement('div');
  overlay.className = 'comment-fullscreen';
  overlay.innerHTML = `
    <div class="comment-fullscreen__header">
      <button class="comment-fullscreen__back" id="comment-back" aria-label="Back">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h3 class="comment-fullscreen__title">Comments</h3>
      <span class="comment-fullscreen__count" id="fs-comment-count">0 comments</span>
    </div>
    <div class="comment-fullscreen__feed" id="fs-comment-feed">
      <div class="comment-fullscreen__empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>No comments yet. Be the first!</p>
      </div>
    </div>
    <div class="comment-fullscreen__input-area">
      <textarea class="comment-fullscreen__textarea" id="fs-comment-input" placeholder="Write a comment..." rows="1" maxlength="500"></textarea>
      <button class="comment-fullscreen__send" id="fs-comment-send" disabled aria-label="Send">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  // Back button
  overlay.querySelector('#comment-back')?.addEventListener('click', () => {
    overlay.remove();
    document.body.style.overflow = '';
  });

  // Textarea input handling
  const textarea = overlay.querySelector('#fs-comment-input') as HTMLTextAreaElement;
  const sendBtn = overlay.querySelector('#fs-comment-send') as HTMLButtonElement;

  textarea?.addEventListener('input', () => {
    const len = textarea.value.trim().length;
    sendBtn.disabled = len === 0;
    // Auto-grow
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  });

  // Send comment (stored in localStorage for now)
  sendBtn?.addEventListener('click', () => {
    const content = textarea.value.trim();
    if (!content) return;

    // Store comment locally
    const commentsKey = `drive_comments_${storyId}`;
    const existing = JSON.parse(localStorage.getItem(commentsKey) || '[]');
    existing.push({
      id: Date.now().toString(),
      author: localStorage.getItem('drive_username') || 'You',
      content,
      created_at: new Date().toISOString(),
    });
    localStorage.setItem(commentsKey, JSON.stringify(existing));

    // Add to feed
    const feed = overlay.querySelector('#fs-comment-feed');
    const emptyState = feed?.querySelector('.comment-fullscreen__empty');
    if (emptyState) emptyState.remove();

    const commentEl = document.createElement('div');
    commentEl.className = 'comment-item fade-in';
    commentEl.style.cssText = 'padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.06);';
    commentEl.innerHTML = `
      <div style="display:flex;gap:0.5rem;align-items:flex-start;">
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#6366f1);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.8rem;color:#fff;font-weight:600;">${(localStorage.getItem('drive_username') || 'Y')[0].toUpperCase()}</div>
        <div style="flex:1;">
          <div style="display:flex;align-items:baseline;gap:0.5rem;">
            <span style="font-weight:600;font-size:0.85rem;color:#e2e8f0;">${localStorage.getItem('drive_username') || 'You'}</span>
            <span style="font-size:0.7rem;color:#94a3b8;">Just now</span>
          </div>
          <p style="margin:0.25rem 0 0;font-size:0.88rem;color:#cbd5e1;line-height:1.4;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        </div>
      </div>
    `;
    feed?.appendChild(commentEl);

    // Update count
    const countEl = overlay.querySelector('#fs-comment-count');
    const allComments = JSON.parse(localStorage.getItem(commentsKey) || '[]');
    if (countEl) countEl.textContent = `${allComments.length} comment${allComments.length !== 1 ? 's' : ''}`;

    // Clear input
    textarea.value = '';
    textarea.style.height = 'auto';
    sendBtn.disabled = true;
  });

  // Load existing comments from localStorage
  const commentsKey = `drive_comments_${storyId}`;
  const savedComments = JSON.parse(localStorage.getItem(commentsKey) || '[]');
  if (savedComments.length > 0) {
    const feed = overlay.querySelector('#fs-comment-feed');
    const emptyState = feed?.querySelector('.comment-fullscreen__empty');
    if (emptyState) emptyState.remove();

    const countEl = overlay.querySelector('#fs-comment-count');
    if (countEl) countEl.textContent = `${savedComments.length} comment${savedComments.length !== 1 ? 's' : ''}`;

    savedComments.forEach((c: any) => {
      const commentEl = document.createElement('div');
      commentEl.className = 'comment-item fade-in';
      commentEl.style.cssText = 'padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.06);';
      const timeAgo = getTimeAgo(c.created_at);
      commentEl.innerHTML = `
        <div style="display:flex;gap:0.5rem;align-items:flex-start;">
          <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#6366f1);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:0.8rem;color:#fff;font-weight:600;">${(c.author || 'Y')[0].toUpperCase()}</div>
          <div style="flex:1;">
            <div style="display:flex;align-items:baseline;gap:0.5rem;">
              <span style="font-weight:600;font-size:0.85rem;color:#e2e8f0;">${c.author || 'You'}</span>
              <span style="font-size:0.7rem;color:#94a3b8;">${timeAgo}</span>
            </div>
            <p style="margin:0.25rem 0 0;font-size:0.88rem;color:#cbd5e1;line-height:1.4;">${(c.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          </div>
        </div>
      `;
      feed?.appendChild(commentEl);
    });
  }
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
