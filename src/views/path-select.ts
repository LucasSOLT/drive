import { navigate } from '../router.ts';

export function render(): string {
  return `
    <div class="view-path-select fade-in" id="path-select-container">
      <div class="path-select-hero slide-up stagger-1" style="text-align: center; padding: var(--space-xl) var(--space-md) var(--space-lg);">
        <h1 style="font-family: var(--font-heading); font-size: 2rem; font-weight: 700; color: var(--color-text-primary); margin-bottom: 0.25rem;">Welcome to DRiVE</h1>
        <p style="font-family: var(--font-body); font-size: 1rem; color: var(--color-text-secondary);">Choose your path</p>
      </div>

      <div class="path-select-cards" style="display: flex; flex-direction: column; gap: var(--space-md); padding: 0 var(--space-md);">

        <!-- PATH A: CREATE -->
        <button class="path-card slide-up stagger-2" id="path-create" style="
          position: relative; overflow: hidden; display: flex; align-items: center; gap: var(--space-lg);
          background: linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(139,92,246,0.02) 100%);
          border: 1.5px solid rgba(139,92,246,0.2); border-radius: var(--radius-xl);
          padding: var(--space-lg); cursor: pointer; text-align: left;
          transition: transform var(--transition-bounce), box-shadow var(--transition), border-color var(--transition);
        ">
          <div style="
            width: 64px; height: 64px; border-radius: var(--radius-lg); flex-shrink: 0;
            background: linear-gradient(135deg, var(--color-purple) 0%, var(--color-purple-dark) 100%);
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 16px rgba(139,92,246,0.3);
          ">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </div>
          <div style="flex: 1; min-width: 0;">
            <h2 style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 700; color: var(--color-text-primary); margin-bottom: 4px;">Create Stories</h2>
            <p style="font-family: var(--font-body); font-size: 0.88rem; color: var(--color-text-secondary); margin: 0; line-height: 1.4;">Author & publish your own DRiVE experiences</p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>

        <!-- PATH B: PLAY -->
        <button class="path-card slide-up stagger-3" id="path-play" style="
          position: relative; overflow: hidden; display: flex; align-items: center; gap: var(--space-lg);
          background: linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 100%);
          border: 1.5px solid rgba(59,130,246,0.2); border-radius: var(--radius-xl);
          padding: var(--space-lg); cursor: pointer; text-align: left;
          transition: transform var(--transition-bounce), box-shadow var(--transition), border-color var(--transition);
        ">
          <div style="
            width: 64px; height: 64px; border-radius: var(--radius-lg); flex-shrink: 0;
            background: linear-gradient(135deg, var(--color-blue) 0%, #2563EB 100%);
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 16px rgba(59,130,246,0.3);
          ">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </div>
          <div style="flex: 1; min-width: 0;">
            <h2 style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 700; color: var(--color-text-primary); margin-bottom: 4px;">Play Stories</h2>
            <p style="font-family: var(--font-body); font-size: 0.88rem; color: var(--color-text-secondary); margin: 0; line-height: 1.4;">Join a squad and experience stories together</p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>

      </div>

      <div class="slide-up stagger-4" style="text-align: center; padding: var(--space-lg) var(--space-md) 0;">
        <p style="font-size: 0.82rem; color: var(--color-text-muted);">You can always switch paths later from the menu</p>
      </div>

      <!-- Hover description panel -->
      <div id="path-hover-desc" class="path-hover-desc" style="opacity: 0; pointer-events: none; transition: opacity 0.35s ease;">
        <div id="path-hover-content" class="path-hover-content"></div>
      </div>
    </div>
  `;
}

export function init(): void {
  document.getElementById('path-create')?.addEventListener('click', () => {
    navigate('create');
  });

  document.getElementById('path-play')?.addEventListener('click', () => {
    navigate('explore');
  });

  // Hover description panel
  const hoverDesc = document.getElementById('path-hover-desc');
  const hoverContent = document.getElementById('path-hover-content');

  const createDescription = `
    <div class="path-desc-inner path-desc-create">
      <div class="path-desc-badge">⚡ Purchase Required</div>
      <p class="path-desc-lead">To empower everyone to tell stories that otherwise wouldn't exist, DRiVE's studio tools rely on AI generation — a small purchase covers the token costs and keeps the platform running.</p>
      <div class="path-desc-features">
        <div class="path-desc-feature">
          <span class="path-desc-feature-icon">🖼️</span>
          <div>
            <strong>Multiple Formats</strong>
            <span>Waterfall storyboards, comic strip panels, and illustrated book pages</span>
          </div>
        </div>
        <div class="path-desc-feature">
          <span class="path-desc-feature-icon">🎙️</span>
          <div>
            <strong>Interactive Studio Tools</strong>
            <span>AI voices by ElevenLabs, curated sound effects, and dynamic animations</span>
          </div>
        </div>
        <div class="path-desc-feature">
          <span class="path-desc-feature-icon">✨</span>
          <div>
            <strong>For Everyone</strong>
            <span>Your story, someone else's story, a group's story — maybe even humanity's story</span>
          </div>
        </div>
      </div>
      <p class="path-desc-tagline">Everyone has a story. Time for you to take the wheel.</p>
    </div>
  `;

  const playDescription = `
    <div class="path-desc-inner path-desc-play">
      <div class="path-desc-badge path-desc-badge--free">🎮 Free to Play</div>
      <p class="path-desc-lead">Dive into a growing library of community-crafted interactive stories. Each one is a unique experience waiting to unfold.</p>
      <div class="path-desc-features">
        <div class="path-desc-feature">
          <span class="path-desc-feature-icon">📖</span>
          <div>
            <strong>Endless Adventures</strong>
            <span>Browse stories across every genre — from fantasy epics to slice-of-life tales</span>
          </div>
        </div>
        <div class="path-desc-feature">
          <span class="path-desc-feature-icon">👥</span>
          <div>
            <strong>Squad Play</strong>
            <span>Team up with friends or join strangers to experience stories together in real-time</span>
          </div>
        </div>
        <div class="path-desc-feature">
          <span class="path-desc-feature-icon">🏆</span>
          <div>
            <strong>Shape the Narrative</strong>
            <span>Your choices matter — every decision branches the story in a new direction</span>
          </div>
        </div>
      </div>
      <p class="path-desc-tagline">Don't just read the story. Live it.</p>
    </div>
  `;

  // Hover effects with description panel
  const createCard = document.getElementById('path-create');
  const playCard = document.getElementById('path-play');

  function showDesc(card: HTMLElement, desc: string) {
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-4px) scale(1.01)';
      card.style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)';
      if (hoverDesc && hoverContent) {
        hoverContent.innerHTML = desc;
        hoverDesc.style.opacity = '1';
        hoverDesc.style.pointerEvents = 'auto';
      }
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
      if (hoverDesc) {
        hoverDesc.style.opacity = '0';
        hoverDesc.style.pointerEvents = 'none';
      }
    });
  }

  if (createCard) showDesc(createCard, createDescription);
  if (playCard) showDesc(playCard, playDescription);
}
