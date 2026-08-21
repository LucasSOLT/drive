



export function render(): string {
  return `
    <div class="view-help fade-in" id="help-container">
      <div class="section__header text-center slide-up stagger-1">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-purple); margin-bottom: 1rem;">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <h1 class="section__title gradient-text">How can we help?</h1>
      </div>

      <div class="slide-up stagger-2" style="max-width: 600px; margin: 0 auto 1.5rem auto;">
        <div style="display: flex; align-items: center; background: var(--color-surface); border-radius: var(--radius-full); padding: 0.75rem 1.5rem; box-shadow: var(--shadow-sm); border: 1px solid var(--color-border);">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted" style="margin-right: 0.75rem;">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" placeholder="Search help topics..." style="border: none; outline: none; width: 100%; font-family: var(--font-body); font-size: 1rem; background: transparent;">
        </div>
      </div>

      <div class="slide-up stagger-3" style="display: flex; flex-direction: column; gap: 1rem; max-width: 800px; margin: 0 auto; padding: 0 var(--space-md);">
        
        <div class="help-card" data-help-card style="background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; border: 1px solid var(--color-border); overflow: hidden;">
          <div style="display: flex; align-items: center; padding: 1.25rem; gap: 0.75rem;">
            <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: rgba(139, 92, 246, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
            </div>
            <div style="flex: 1;">
              <h3 style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem; color: var(--color-text-primary);">Getting Started</h3>
              <p class="text-muted" style="font-size: 0.9rem; margin: 0;">Learn the basics of DRiVE</p>
            </div>
            <svg class="help-card__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-muted); transition: transform 0.3s ease; flex-shrink: 0;">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="help-card__content" style="display:none; padding: 0 1.25rem 1.25rem; border-top: 1px solid var(--color-border);">
            <p style="font-size: 0.92rem; line-height: 1.7; color: var(--color-text-muted); margin: 1rem 0 0;">Welcome to DRiVE! Start by creating an account and exploring stories from our community. Browse the Featured and Explore pages to discover content, or jump into creating your own story.</p>
          </div>
        </div>

        <div class="help-card" data-help-card style="background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; border: 1px solid var(--color-border); overflow: hidden;">
          <div style="display: flex; align-items: center; padding: 1.25rem; gap: 0.75rem;">
            <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: rgba(59, 130, 246, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </div>
            <div style="flex: 1;">
              <h3 style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem; color: var(--color-text-primary);">Creating Stories</h3>
              <p class="text-muted" style="font-size: 0.9rem; margin: 0;">Story creation tools & formats</p>
            </div>
            <svg class="help-card__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-muted); transition: transform 0.3s ease; flex-shrink: 0;">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="help-card__content" style="display:none; padding: 0 1.25rem 1.25rem; border-top: 1px solid var(--color-border);">
            <p style="font-size: 0.92rem; line-height: 1.7; color: var(--color-text-muted); margin: 1rem 0 0;">Choose between Waterfall Storyboard (upload or generate your vertical panels) or Illustrated Book (AI-generated images with your text). After creating your story, submit it for review. An admin will check it for harmful or explicit content before it goes live.</p>
          </div>
        </div>

        <div class="help-card" data-help-card style="background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; border: 1px solid var(--color-border); overflow: hidden;">
          <div style="display: flex; align-items: center; padding: 1.25rem; gap: 0.75rem;">
            <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: rgba(236, 72, 153, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-pink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
            </div>
            <div style="flex: 1;">
              <h3 style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem; color: var(--color-text-primary);">Account & Billing</h3>
              <p class="text-muted" style="font-size: 0.9rem; margin: 0;">Manage your subscription</p>
            </div>
            <svg class="help-card__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-muted); transition: transform 0.3s ease; flex-shrink: 0;">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="help-card__content" style="display:none; padding: 0 1.25rem 1.25rem; border-top: 1px solid var(--color-border);">
            <p style="font-size: 0.92rem; line-height: 1.7; color: var(--color-text-muted); margin: 1rem 0 0;">Manage your subscription from the Library page. You can upgrade, downgrade, or cancel your plan at any time. All payments are processed securely through Stripe.</p>
          </div>
        </div>

        <div class="help-card" data-help-card style="background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; border: 1px solid var(--color-border); overflow: hidden;">
          <div style="display: flex; align-items: center; padding: 1.25rem; gap: 0.75rem;">
            <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: rgba(239, 68, 68, 0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div style="flex: 1;">
              <h3 style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem; color: var(--color-text-primary);">Community Guidelines</h3>
              <p class="text-muted" style="font-size: 0.9rem; margin: 0;">Rules & best practices</p>
            </div>
            <svg class="help-card__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-text-muted); transition: transform 0.3s ease; flex-shrink: 0;">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <div class="help-card__content" style="display:none; padding: 0 1.25rem 1.25rem; border-top: 1px solid var(--color-border);">
            <p style="font-size: 0.92rem; line-height: 1.7; color: var(--color-text-muted); margin: 1rem 0 0;">Be respectful, creative, and original. No explicit, hateful, or plagiarized content. All stories go through a review process before publication. Violations may result in account suspension.</p>
          </div>
        </div>

      </div>

      <div class="slide-up stagger-4 text-center" style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--color-border);">
        <h2 style="font-family: var(--font-heading); font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; color: var(--color-text-primary);">Still need help?</h2>
        <p class="text-muted" style="margin-bottom: 1.5rem;">Contact us at <a href="mailto:team@soltheory.com" style="color: var(--color-purple); text-decoration: none; font-weight: 500;">team@soltheory.com</a></p>
        <button class="btn btn--primary" id="btn-get-in-touch" style="font-weight: 600;">Get in Touch</button>
      </div>
    </div>
  `;
}

export function init(): void {
  // Toggle help card dropdowns
  document.querySelectorAll('[data-help-card]').forEach(card => {
    card.addEventListener('click', () => {
      const content = card.querySelector('.help-card__content') as HTMLElement;
      const chevron = card.querySelector('.help-card__chevron') as HTMLElement;
      if (!content) return;
      const isExpanded = content.style.display !== 'none';
      content.style.display = isExpanded ? 'none' : 'block';
      card.classList.toggle('expanded', !isExpanded);
      if (chevron) {
        chevron.style.transform = isExpanded ? '' : 'rotate(180deg)';
      }
    });
  });

  // Get in Touch button opens mail app
  document.getElementById('btn-get-in-touch')?.addEventListener('click', () => {
    window.location.href = 'mailto:team@soltheory.com';
  });
}
