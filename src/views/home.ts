import { navigate } from '../router.ts';
import { renderStoryCard, initVideoCovers } from '../components/story-card.ts';
import { stories, getFeaturedStories, getEditorPicks } from '../data/stories.ts';

export function render(): string {
  return `
    <div class="view-home fade-in" id="home-container">

      <!-- ===== HERO SECTION ===== -->
      <section class="hero slide-up" id="hero-section">
        <div class="hero__canvas">
          <!-- Animated floating abstract shapes -->
          <div class="hero__shape hero__shape--1"></div>
          <div class="hero__shape hero__shape--2"></div>
          <div class="hero__shape hero__shape--3"></div>
          <div class="hero__shape hero__shape--4"></div>
          <div class="hero__shape hero__shape--5"></div>
          <div class="hero__shape hero__shape--6"></div>
          <div class="hero__shape hero__shape--7"></div>

          <!-- Paint splatter accents -->
          <div class="hero__splatter hero__splatter--1"></div>
          <div class="hero__splatter hero__splatter--2"></div>
          <div class="hero__splatter hero__splatter--3"></div>
        </div>

        <div class="hero__content">
          <h1 class="hero__title">
            <span class="hero__title-letter hero__title-letter--d">D</span><span
              class="hero__title-letter hero__title-letter--r">R</span><span
              class="hero__title-letter hero__title-letter--i">i</span><span
              class="hero__title-letter hero__title-letter--v">V</span><span
              class="hero__title-letter hero__title-letter--e">E</span>
          </h1>
          <p class="hero__tagline">Stories that move you</p>
          <div class="hero__cta-row">
            <button class="btn btn--primary hero__cta" id="hero-explore-btn">Start Exploring</button>
          </div>
          <button class="hero__signup-link" id="hero-signup-btn">Sign Up</button>
        </div>
      </section>

      <!-- ===== FEATURED SECTION ===== -->
      <section class="section slide-up stagger-2" id="featured-section">
        <div class="section__header">
          <h2 class="section__title">Featured</h2>
          <a href="#featured" class="section__see-all" data-link="featured">See all</a>
        </div>
        ${(() => {
          const editorPicks = getEditorPicks();
          const featured = getFeaturedStories();
          const allCards = [...new Map([...editorPicks, ...featured].map(s => [s.id, s])).values()];
          const card1 = allCards[0];
          const card2 = allCards[1];
          const card3 = allCards[2] || allCards[0];
          const card4 = allCards[3] || allCards[1] || allCards[0];

          return `
          <!-- Row 1: Big left, Small right -->
          <div class="featured-row" style="display:flex; gap:var(--space-md); padding:0 var(--space-md); margin-bottom:var(--space-md);">
            <div style="flex:3; position:relative;">
              ${card1 ? renderStoryCard(card1, 'hero') : ''}
            </div>
            <div style="flex:2;">
              ${card2 ? renderStoryCard(card2, 'full') : ''}
            </div>
          </div>
          <!-- Row 2: Small left, Big right (inverted!) -->
          <div class="featured-row" style="display:flex; gap:var(--space-md); padding:0 var(--space-md);">
            <div style="flex:2;">
              ${card3 ? renderStoryCard(card3, 'full') : ''}
            </div>
            <div style="flex:3; position:relative;">
              ${card4 ? renderStoryCard(card4, 'hero') : ''}
            </div>
          </div>
          `;
        })()}
      </section>

      <!-- ===== BEST-SELLING SECTION ===== -->
      <section class="section slide-up stagger-3" id="bestselling-section">
        <div class="section__header">
          <h2 class="section__title">Best-Selling</h2>
          <a href="#explore" class="section__see-all" data-link="explore">See all</a>
        </div>
        <div class="scroll-row no-scrollbar" style="padding: 0 1rem;">
          ${[...stories].sort((a, b) => b.readCount - a.readCount).map(story => renderStoryCard(story, 'full')).join('')}
        </div>
      </section>

      <!-- ===== FOOTER ===== -->
      <footer class="site-footer slide-up stagger-4">
        <div class="footer__brand">
          <span class="footer__logo gradient-text">DRiVE</span>
          <p class="footer__desc">A story-driven creative platform. Discover, read, and create AI-powered stories in Waterfall Storyboard, illustrated book, and comic strip formats.</p>
        </div>

        <div class="footer__links-grid">
          <div class="footer__links-col">
            <h4 class="footer__col-title">Platform</h4>
            <a href="#explore" class="footer__link" data-link="explore">Explore Stories</a>
            <a href="#featured" class="footer__link" data-link="featured">Featured</a>
            <a href="#library" class="footer__link" data-link="library">My Library</a>
            <a href="#create" class="footer__link" data-link="create">Create a Story</a>
          </div>
          <div class="footer__links-col">
            <h4 class="footer__col-title">Company</h4>
            <a href="#" class="footer__link">About Us</a>
            <a href="#" class="footer__link">Careers</a>
            <a href="#" class="footer__link">Blog</a>
            <a href="#" class="footer__link">Press Kit</a>
          </div>
          <div class="footer__links-col">
            <h4 class="footer__col-title">Support</h4>
            <a href="#" class="footer__link">Help Center</a>
            <a href="#" class="footer__link">Contact Us</a>
            <a href="#" class="footer__link">Submission Guidelines</a>
            <a href="#" class="footer__link">Community</a>
          </div>
          <div class="footer__links-col">
            <h4 class="footer__col-title">Legal</h4>
            <a href="#" class="footer__link">Privacy Policy</a>
            <a href="#" class="footer__link">Terms of Service</a>
            <a href="#" class="footer__link">Cookie Policy</a>
            <a href="#" class="footer__link">Content Policy</a>
          </div>
        </div>

        <div class="footer__contact">
          <p>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            hello@drive.stories
          </p>
          <p>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            San Francisco, CA
          </p>
        </div>

        <div class="footer__bottom">
          <p>&copy; ${new Date().getFullYear()} DRiVE Inc. All rights reserved.</p>
          <div class="footer__socials">
            <a href="#" class="footer__social" aria-label="Twitter">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="#" class="footer__social" aria-label="Instagram">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
            <a href="#" class="footer__social" aria-label="Discord">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            </a>
          </div>
        </div>
      </footer>

    </div>
  `;
}

export function init(): void {
  const container = document.getElementById('home-container');
  if (!container) return;

  // Enable hover-to-play on video covers
  initVideoCovers(container);

  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Hero CTA
    const cta = target.closest('#hero-explore-btn');
    if (cta) {
      e.preventDefault();
      navigate('explore');
      return;
    }

    // Hero Sign Up
    const signupBtn = target.closest('#hero-signup-btn');
    if (signupBtn) {
      e.preventDefault();
      navigate('signup');
      return;
    }

    // See-all links
    const link = target.closest('[data-link]');
    if (link) {
      e.preventDefault();
      const route = link.getAttribute('data-link');
      if (route) {
        navigate(route);
      }
      return;
    }

    // Story card clicks
    const card = target.closest('[data-story-id]');
    if (card) {
      const storyId = card.getAttribute('data-story-id');
      if (storyId) {
        navigate('story/' + storyId);
      }
    }
  });
}
