import { navigate } from '../router.ts';

export function render(): string {
  return `
    <div class="view-about fade-in" id="about-container">
      <div class="section__header text-center slide-up stagger-1" style="margin-bottom: 2rem;">
        <h1 class="section__title gradient-text" style="font-size: 3rem; letter-spacing: -0.05em; margin-bottom: 0.5rem;">DRiVE</h1>
        <p style="font-family: var(--font-heading); font-size: 1.25rem; color: var(--color-text-secondary); font-weight: 500;">Stories that move you</p>
      </div>

      <div class="slide-up stagger-2" style="max-width: 800px; margin: 0 auto 2rem auto; padding: 0 var(--space-md);">
        <h2 style="font-family: var(--font-heading); font-size: 1.75rem; font-weight: 600; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem;">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          Our Mission
        </h2>
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 1.5rem; box-shadow: var(--shadow-sm);">
          <p style="font-size: 1.05rem; line-height: 1.7; color: var(--color-text-primary); margin: 0;">
            We believe that storytelling is the heartbeat of humanity. Our mission is to empower creators with tools that break the boundaries of traditional formats, bringing narratives to life in ways that captivate, inspire, and deeply connect with audiences around the globe.
          </p>
        </div>
      </div>

      <div class="slide-up stagger-3" style="max-width: 800px; margin: 0 auto 2rem auto; padding: 0 var(--space-md);">
        <h2 style="font-family: var(--font-heading); font-size: 1.75rem; font-weight: 600; margin-bottom: 1rem;">What We Offer</h2>
        
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="display: flex; align-items: center; background: var(--color-surface); border-radius: var(--radius-lg); padding: 1.25rem; border: 1px solid var(--color-border); box-shadow: var(--shadow-sm);">
            <div style="font-size: 2rem; margin-right: 1rem; width: 48px; text-align: center;">📜</div>
            <div>
              <h3 style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 600; margin-bottom: 0.15rem;">Waterfall Storyboard</h3>
              <p class="text-muted" style="margin: 0; font-size: 0.9rem;">Continuous vertical storytelling</p>
            </div>
          </div>

          <div style="display: flex; align-items: center; background: var(--color-surface); border-radius: var(--radius-lg); padding: 1.25rem; border: 1px solid var(--color-border); box-shadow: var(--shadow-sm);">
            <div style="font-size: 2rem; margin-right: 1rem; width: 48px; text-align: center;">📖</div>
            <div>
              <h3 style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 600; margin-bottom: 0.15rem;">Illustrated Book</h3>
              <p class="text-muted" style="margin: 0; font-size: 0.9rem;">Page-by-page narratives</p>
            </div>
          </div>
        </div>
      </div>

      <div class="slide-up stagger-4" style="max-width: 800px; margin: 0 auto 2rem auto; padding: 0 var(--space-md);">
        <h2 style="font-family: var(--font-heading); font-size: 1.75rem; font-weight: 600; margin-bottom: 1rem;">The Team</h2>
        <div style="background: var(--color-eggshell-dark); border: 2px dashed var(--color-border); border-radius: var(--radius-xl); padding: 1.5rem; text-align: center;">
          <p class="text-muted" style="font-style: italic; margin: 0;">Meet the creative minds behind DRiVE</p>
        </div>
      </div>

      <div class="slide-up stagger-5 text-center" style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--color-border);">
        <h2 style="font-family: var(--font-heading); font-size: 1.75rem; font-weight: 600; margin-bottom: 1rem;">Ready to start your story?</h2>
        <button id="about-explore-btn" class="btn btn--primary" style="font-size: 1.1rem; padding: 0.75rem 2rem;">Start Exploring</button>
      </div>
    </div>
  `;
}

export function init(): void {
  const exploreBtn = document.getElementById('about-explore-btn');
  if (exploreBtn) {
    exploreBtn.addEventListener('click', () => {
      navigate('/explore');
    });
  }
}
