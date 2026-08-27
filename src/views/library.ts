import type { UserStory, Story } from '../types.ts';
import { getTrackedStories, removeTrackedStory, type TrackedStory } from '../lib/reading-tracker.ts';
import { isLibraryUnlocked, unlockLibrary, activatePlan, getUserStories, deleteUserStory, getUserPlan, getUserSubscription, canCreateStory, getTokensRemaining, getCreditsBalance } from '../state.ts';
import { navigate } from '../router.ts';
import { showModal, hideModal } from '../components/modal.ts';
import { hasAdminPrivileges, fetchOfficialStories, deleteOfficialStory } from '../lib/db.ts';

// ─── SVG Icons ───
const ICON = {
  share: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  trash: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  eye: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
};

function renderUserStoryCard(story: UserStory): string {
  const statusColors: Record<string, string> = {
    'draft': '#9CA3AF',
    'under-review': '#F59E0B',
    'published': '#22C55E',
    'denied': '#EF4444',
  };
  const statusColor = statusColors[story.status] || '#9CA3AF';
  const isDraft = story.status === 'draft';
  const canView = story.status === 'under-review' || story.status === 'published';
  const isDenied = story.status === 'denied';
  const coverImage = story.coverImage || story.pages?.[0]?.image || story.live_pages?.[0]?.image;

  return `
    <div class="lib-card slide-up" data-story-id="${story.id}">
      <div class="lib-card__cover">
        ${story.coverVideo
          ? `<video class="lib-card__cover-img" src="${story.coverVideo}" poster="${coverImage || ''}" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>`
          : coverImage
            ? `<img class="lib-card__cover-img" src="${coverImage}" alt="${story.title}">`
            : `<div class="lib-card__cover-empty">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                </svg>
              </div>`
        }
        <span class="lib-card__format">${story.format}</span>
      </div>
      <div class="lib-card__body">
        <h3 class="lib-card__title">${story.title}</h3>
        <div class="lib-card__meta">
          <span class="lib-card__status" style="color:${statusColor}; font-weight:700;">● ${story.status.replace('-', ' ')}</span>
          <span class="lib-card__date">${new Date(story.createdAt).toLocaleDateString()}</span>
        </div>

        ${isDenied && story.rejectionReason ? `
          <div class="lib-rejection-box" style="margin:8px 0; padding:8px 12px; background:rgba(239,68,68,0.12); border-left:3px solid #EF4444; border-radius:4px; font-size:0.8rem; color:#FCA5A5;">
            <strong>Developer Review Feedback:</strong><br>
            "${story.rejectionReason}"
          </div>
        ` : ''}

        <div class="lib-card__actions">
          ${isDraft ? `<button class="lib-card__btn lib-card__btn--edit" data-edit-user="${story.id}" style="background:#8B5CF6; color:white;" title="Edit Draft">✏️ Edit</button>` : ''}
          ${canView ? `<button class="lib-card__btn lib-card__btn--view" data-view="${story.id}" title="View">${ICON.eye} View</button>` : ''}
          ${isDenied ? `<button class="lib-card__btn" data-resubmit="${story.id}" style="background:#8B5CF6; color:white;" title="Resubmit">🔄 Edit & Resubmit</button>` : ''}
          <button class="lib-card__btn lib-card__btn--share" data-share="${story.id}" title="Share">${ICON.share}</button>
          <button class="lib-card__btn lib-card__btn--delete" data-delete="${story.id}" title="Delete">${ICON.trash}</button>
        </div>
      </div>
    </div>
  `;
}

function renderAdminDraftCard(story: Story): string {
  const coverImage = story.coverImage || story.panels?.[0];
  return `
    <div class="lib-card slide-up" data-admin-story-id="${story.id}">
      <div class="lib-card__cover">
        ${story.coverVideo
          ? `<video class="lib-card__cover-img" src="${story.coverVideo}" poster="${coverImage || ''}" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>`
          : coverImage
            ? `<img class="lib-card__cover-img" src="${coverImage}" alt="${story.title}">`
            : `<div class="lib-card__cover-empty">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                </svg>
              </div>`
        }
        <span class="lib-card__format">${story.format}</span>
      </div>
      <div class="lib-card__body">
        <h3 class="lib-card__title">${story.title}</h3>
        <div class="lib-card__meta">
          <span class="lib-card__status" style="color:#A78BFA; font-weight:700;">● Admin Draft</span>
          <span class="lib-card__date">${story.genre || 'Draft'}</span>
        </div>

        <div class="lib-card__actions">
          <button class="lib-card__btn lib-card__btn--edit" data-edit-admin="${story.id}" data-format="${story.format}" style="background:#8B5CF6; color:white;" title="Edit Admin Draft">✏️ Edit</button>
          <button class="lib-card__btn lib-card__btn--delete" data-delete-admin="${story.id}" title="Delete">${ICON.trash}</button>
        </div>
      </div>
    </div>
  `;
}

function getLocalAdminDraft(): any | null {
  try {
    const data = localStorage.getItem('drive_admin_create_draft');
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed && parsed.storyTitle && parsed.storyTitle !== 'Untitled') return parsed;
    return null;
  } catch {
    return null;
  }
}

function renderLocalAdminDraftCard(draft: any): string {
  return `
    <div class="lib-card slide-up" data-local-admin-draft="true">
      <div class="lib-card__cover">
        ${draft.storyCoverVideo
          ? `<video class="lib-card__cover-img" src="${draft.storyCoverVideo}" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>`
          : draft.coverThumbnail || draft.scrollPanels?.[0]?.image || draft.bookPages?.[0]?.image
            ? `<img class="lib-card__cover-img" src="${draft.coverThumbnail || draft.scrollPanels?.[0]?.image || draft.bookPages?.[0]?.image}" alt="${draft.storyTitle}">`
            : `<div class="lib-card__cover-empty">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                </svg>
              </div>`
        }
        <span class="lib-card__format">${draft.selectedFormat || 'scroll'}</span>
      </div>
      <div class="lib-card__body">
        <h3 class="lib-card__title">${draft.storyTitle || 'Unsaved Storyboard'}</h3>
        <div class="lib-card__meta">
          <span class="lib-card__status" style="color:#A78BFA; font-weight:700;">● Admin Draft</span>
          <span class="lib-card__date">${draft.storyGenre || 'Draft'}</span>
        </div>

        <div class="lib-card__actions">
          <button class="lib-card__btn lib-card__btn--edit" data-resume-local-admin="true" data-format="${draft.selectedFormat || 'scroll'}" style="background:#8B5CF6; color:white;" title="Resume Draft">✏️ Edit</button>
          <button class="lib-card__btn lib-card__btn--delete" data-delete-local-admin="true" title="Delete">${ICON.trash}</button>
        </div>
      </div>
    </div>
  `;
}


function renderTrackedReadingCard(story: TrackedStory): string {
  const statusLabels: Record<string, { label: string; color: string; bg: string; border: string }> = {
    'episode-1-access': {
      label: 'Episode 1 Access',
      color: '#c084fc',
      bg: 'rgba(192, 132, 252, 0.12)',
      border: 'rgba(192, 132, 252, 0.3)'
    },
    'awaiting-squad': {
      label: 'Awaiting Squad',
      color: '#fbbf24',
      bg: 'rgba(251, 191, 36, 0.12)',
      border: 'rgba(251, 191, 36, 0.3)'
    },
    'active-journey': {
      label: 'Active Squad Journey',
      color: '#34d399',
      bg: 'rgba(52, 211, 153, 0.12)',
      border: 'rgba(52, 211, 153, 0.3)'
    },
    'blocked': {
      label: 'Waiting on Squad',
      color: '#f87171',
      bg: 'rgba(248, 113, 113, 0.12)',
      border: 'rgba(248, 113, 113, 0.3)'
    },
    'completed': {
      label: 'Completed',
      color: '#60a5fa',
      bg: 'rgba(96, 165, 250, 0.12)',
      border: 'rgba(96, 165, 250, 0.3)'
    }
  };

  const statusInfo = statusLabels[story.status] || statusLabels['episode-1-access'];
  const cover = story.storyCoverImage;

  return `
    <div class="lib-card reading-journey-card slide-up" data-tracked-story-id="${story.storyId}">
      <div class="lib-card__cover">
        ${story.storyCoverVideo
          ? `<video class="lib-card__cover-img" src="${story.storyCoverVideo}" poster="${cover || ''}" autoplay loop muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>`
          : cover
            ? `<img class="lib-card__cover-img" src="${cover}" alt="${story.storyTitle}">`
            : `<div class="lib-card__cover-empty">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                </svg>
              </div>`
        }
        <span class="lib-card__format">${story.format === 'book' ? '📖 Book' : '📜 Waterfall'}</span>
      </div>
      <div class="lib-card__body">
        <h3 class="lib-card__title">${story.storyTitle}</h3>
        <div class="lib-card__meta">
          <span class="lib-card__status" style="color:${statusInfo.color}; background:${statusInfo.bg}; border:1px solid ${statusInfo.border}; padding:2px 8px; border-radius:12px; font-size:0.7rem; font-weight:700;">
            ● ${statusInfo.label}
          </span>
          <span class="lib-card__date">Ep. ${story.currentEpisode}</span>
        </div>

        <div class="lib-card__actions" style="margin-top:10px;">
          <button class="lib-card__btn lib-card__btn--continue" data-continue-reading="${story.storyId}" style="background:linear-gradient(135deg, #8B5CF6, #6366F1); color:white; font-weight:600; flex:1;" title="Continue Reading">
            📖 Continue
          </button>
          <button class="lib-card__btn lib-card__btn--delete" data-remove-tracked="${story.storyId}" title="Remove from Reading History">${ICON.trash}</button>
        </div>
      </div>
    </div>
  `;
}

export function render(): string {
  const unlocked = isLibraryUnlocked();

  if (!unlocked) {
    return `
      <div class="view-library fade-in" id="library-container">
        <div class="paywall">
          <!-- Greyed-out background workspace -->
          <div class="paywall__bg">
            <div class="paywall__bg-card">
              <div class="paywall__bg-card-icon">
                <svg width="28" height="28" viewBox="0 0 48 48" fill="none" stroke="#ccc" stroke-width="2"><rect x="12" y="4" width="24" height="40" rx="4"/><line x1="18" y1="14" x2="30" y2="14"/><line x1="18" y1="20" x2="28" y2="20"/><line x1="18" y1="26" x2="26" y2="26"/></svg>
              </div>
              <span>Waterfall Storyboard</span>
            </div>
            <div class="paywall__bg-card">
              <div class="paywall__bg-card-icon">
                <svg width="28" height="28" viewBox="0 0 48 48" fill="none" stroke="#ccc" stroke-width="2"><path d="M6 8c0-2 2-4 6-4h6c4 0 6 2 6 2s2-2 6-2h6c4 0 6 2 6 4v28c0 2-2 4-6 4h-6c-4 0-6 2-6 2s-2-2-6-2h-6c-4 0-6-2-6-4V8z"/><path d="M24 6v34"/></svg>
              </div>
              <span>Illustrated Book</span>
            </div>
          </div>

          <!-- Overlay card -->
          <div class="paywall__overlay">
            <div class="paywall__card slide-up stagger-1">
              <div class="paywall__glow"></div>
              <div class="paywall__card-inner">
                <div class="paywall__icon slide-up stagger-2">
                  <span>?</span>
                </div>
                <p class="paywall__text slide-up stagger-3">
                  It is completely free to consume content on DRiVE, <strong>however</strong>, creating your own stories will require a purchase, but we promise to keep it low ;) <span class="paywall__fine">(Token rates and admin. costs apply, with five percent of your purchase contributing to water sustainability efforts, as we strive to offset our water usage.)</span>
                </p>
                <button class="paywall__cta slide-up stagger-4" id="unlock-btn">Start Creating</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const userStories = getUserStories();

  return `
    <div class="view-library fade-in" id="library-container">
      <div class="library-unlocked" style="padding: 1.5rem;">
        <!-- Plan status pill -->
        <div class="lib-plan-status slide-up" style="display:flex; align-items:center; gap:8px; padding:10px 14px; background:linear-gradient(135deg, rgba(139,92,246,0.06), rgba(99,102,241,0.06)); border-radius:14px; margin-bottom:1rem; border:1px solid rgba(139,92,246,0.12);">
          <span style="font-size:1.1rem;">💎</span>
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:2px;">
              <span style="font-family:var(--font-heading); font-size:0.78rem; font-weight:700; color:var(--color-purple); text-transform:uppercase; letter-spacing:0.5px;">${getUserPlan() === 'creator' ? 'Creator Plan' : 'Starter Plan'}</span>
              <span style="font-size:0.7rem; padding:1px 6px; background:rgba(139,92,246,0.08); color:var(--color-purple); border-radius:8px; font-weight:600;">${getCreditsBalance().toLocaleString()} credits</span>
            </div>
            <span style="font-family:var(--font-body); font-size:0.72rem; color:var(--color-text-muted);">${getUserPlan() === 'creator' ? 'Unlimited stories' : getTokensRemaining() + ' token' + (getTokensRemaining() !== 1 ? 's' : '') + ' remaining'}</span>
          </div>
          <button class="btn btn--ghost btn--sm" id="manage-plan-btn" style="font-size:0.72rem; padding:4px 10px; border-radius:20px;">Manage</button>
        </div>

        <!-- Section 1: Active Reading Journeys (Auto-tracked when opening any Ep. 1) -->
        <div class="section__header slide-up stagger-1" style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.2rem;">📖</span>
            <h2 class="section__title" style="margin: 0;">Reading Journeys</h2>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn--secondary btn--sm" id="btn-library-friends" style="font-size:0.75rem; padding:4px 12px; border-radius:20px; display:inline-flex; align-items:center; gap:4px;">
              <span>👥</span>
              <span>Find Friends</span>
            </button>
            <button class="btn btn--ghost btn--sm" id="btn-browse-catalog" style="font-size:0.75rem; padding:4px 10px; border-radius:20px;">Browse Catalog →</button>
          </div>
        </div>

        <div class="library-unlocked__content slide-up stagger-2" style="margin-top: 1rem; margin-bottom: 2rem;">
          ${(() => {
            const tracked = getTrackedStories();
            if (tracked.length > 0) {
              return `<div class="lib-grid">${tracked.map(s => renderTrackedReadingCard(s)).join('')}</div>`;
            }
            return `
              <div class="library-empty text-center" style="padding: 2rem 1.5rem; background: var(--color-surface); border-radius: var(--radius-xl); border: 1px dashed var(--color-border);">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 0.5rem; opacity: 0.6;">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
                <h3 style="font-family: var(--font-heading); margin-bottom: 0.25rem; color: var(--color-text-primary); font-size: 1rem;">No stories started yet</h3>
                <p class="text-muted" style="font-size: 0.82rem; margin: 0 0 1rem 0;">Start reading Episode 1 of any story to track your journey here!</p>
                <button class="btn btn--primary btn--sm" id="btn-empty-browse" style="border-radius: 20px; font-size:0.8rem;">Explore Stories</button>
              </div>
            `;
          })()}
        </div>

        <!-- Section 2: My Created Stories -->
        <div class="section__header slide-up stagger-3" style="display: flex; justify-content: space-between; align-items: center; padding-top: 1.5rem; border-top: 1px solid var(--color-border);">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.2rem;">✍️</span>
            <h2 class="section__title" style="margin: 0;">My Creations</h2>
          </div>
          <button class="btn btn--primary btn--sm" id="create-new-btn" style="border-radius: 20px; padding: 0.5rem 1rem;">+ Create New</button>
        </div>
        
        <div class="library-unlocked__content slide-up stagger-4" style="margin-top: 1rem;">
          ${userStories.length > 0 
            ? `<div class="lib-grid">${userStories.map(s => renderUserStoryCard(s)).join('')}</div>`
            : `
            <div class="library-empty text-center" style="padding: 1.75rem 1.5rem; background: var(--color-surface); border-radius: var(--radius-xl); border: 1px dashed var(--color-border);">
              <h3 style="font-family: var(--font-heading); margin-bottom: 0.25rem; color: var(--color-text-primary); font-size: 0.95rem;">Your creations will appear here</h3>
              <p class="text-muted" style="font-size: 0.8rem; margin: 0;">Tap Create New to build your own interactive story</p>
            </div>
            `
          }
        </div>

        ${hasAdminPrivileges() ? `
          <div class="admin-drafts-section slide-up stagger-3" style="margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid var(--color-border);">
            <div class="section__header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:1.2rem;">🛠️</span>
                <h2 class="section__title" style="margin: 0; color: #A78BFA;">Admin Storyboards & Drafts</h2>
              </div>
              <button class="btn btn--secondary btn--sm" id="admin-create-new-btn" style="border-radius: 20px; padding: 0.5rem 1rem;">+ New Admin Storyboard</button>
            </div>
            <div id="admin-drafts-grid" class="lib-grid">
              ${(() => {
                const localDraft = getLocalAdminDraft();
                return localDraft ? renderLocalAdminDraftCard(localDraft) : '';
              })()}
              <div id="admin-drafts-loading" style="grid-column: 1 / -1; padding: 1rem; color: var(--color-text-muted); font-size: 0.85rem;">Loading admin drafts...</div>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

export function init(): void {
  const container = document.getElementById('library-container');
  if (!container) return;

  // ─── Handle return from Stripe Checkout ───
  const hash = window.location.hash; // e.g. #/library?purchase=success&tier=credits_10
  if (hash.includes('purchase=success')) {
    const tierMatch = hash.match(/tier=([^&]*)/);
    const tier = tierMatch ? tierMatch[1] : '';
    if (tier) {
      // Activate locally as immediate feedback
      activatePlan(tier);

      // Also refresh from Supabase (the webhook may have already credited the DB)
      import('../lib/db.ts').then(db => {
        db.refreshSubscription().then(() => {
          db.loadUserData();
        });
      });

      // Clean URL
      window.location.hash = '#/library';
      // Refresh the view
      const viewContainer = document.getElementById('view-container');
      if (viewContainer) {
        viewContainer.innerHTML = render();
        init();
        return;
      }
    }
  }

  const unlockBtn = document.getElementById('unlock-btn');
  if (unlockBtn) {
    unlockBtn.addEventListener('click', () => {
      showModal({
        title: '',
        hideActions: true,
        content: `
          <div class="pricing">
            <button class="pricing__close" id="pricing-close-btn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <h2 class="pricing__title">Choose Your Plan</h2>
            <p class="pricing__subtitle">Pick the option that works best for you</p>
 
            <!-- Tier cards -->
            <div class="pricing__tiers">
              <div class="pricing__card" data-tier="single">
                <div class="pricing__badge pricing__badge--blue">STARTER</div>
                <h3 class="pricing__card-title">Single Story Token</h3>
                <div class="pricing__price"><span class="pricing__currency">$</span>1<span class="pricing__period">.99</span></div>
                <ul class="pricing__features">
                  <li>Create 1 story</li>
                  <li>800 AI generation credits</li>
                  <li>All formats available</li>
                  <li>Share with anyone</li>
                </ul>
                <p class="pricing__card-note" style="font-size:0.65rem; color:#F59E0B; margin-top:8px; line-height:1.35; font-style:italic; padding:0 8px; text-align:center;">
                  * Purchase of additional credits recommended, but not necessary (higher performance models cost significantly more)
                </p>
                <button class="pricing__select-btn" data-select-tier="single" style="margin-top:10px;">Select</button>
              </div>
 
              <div class="pricing__card pricing__card--featured" data-tier="monthly">
                <div class="pricing__popular">MOST POPULAR</div>
                <div class="pricing__badge pricing__badge--purple">CREATOR</div>
                <h3 class="pricing__card-title">Monthly Creator Pass</h3>
                <div class="pricing__price"><span class="pricing__currency">$</span>9<span class="pricing__period">.99<small>/mo</small></span></div>
                <ul class="pricing__features">
                  <li>Unlimited stories</li>
                  <li>4,000 credits/month</li>
                  <li>Priority AI generation</li>
                  <li>All formats & features</li>
                  <li>Cancel anytime</li>
                </ul>
                <button class="pricing__select-btn pricing__select-btn--primary" data-select-tier="monthly">Select</button>
              </div>
 
              <div class="pricing__card" data-tier="pack">
                <div class="pricing__badge pricing__badge--red">VALUE</div>
                <h3 class="pricing__card-title">Token Pack (10)</h3>
                <div class="pricing__price"><span class="pricing__currency">$</span>14<span class="pricing__period">.99</span></div>
                <ul class="pricing__features">
                  <li>10 story tokens</li>
                  <li>8,000 AI credits</li>
                  <li>Never expire</li>
                  <li>Save 25% vs. single</li>
                </ul>
                <button class="pricing__select-btn" data-select-tier="pack">Select</button>
              </div>
            </div>

            <!-- Credit Packs Section -->
            <h3 style="font-family:var(--font-heading); font-size:1.05rem; font-weight:700; text-align:center; margin:1.5rem 0 0.5rem 0; color:var(--color-text-primary);">Need Additional Credits?</h3>
            <p style="font-family:var(--font-body); font-size:0.75rem; color:var(--color-text-muted); text-align:center; margin:0 0 1.25rem 0; max-width:380px; margin-inline:auto;">
              Top up your balance for higher-performance models. Credit packs never expire and stack with any plan.
            </p>
            <div class="pricing__packs">
              <div class="pricing__pack-card" data-tier="credits_5">
                <h4 style="font-family:var(--font-heading); font-size:0.85rem; font-weight:700; margin:0 0 4px 0;">$5 Credit Pack</h4>
                <div style="font-size:1.15rem; font-weight:800; color:var(--color-text-primary); margin-bottom:4px;">$5.00</div>
                <div style="font-size:0.72rem; color:var(--color-text-muted);">4,000 credits</div>
                <button class="pricing__select-btn" data-select-tier="credits_5" style="margin-top:10px; width:100%; padding:4px; font-size:0.72rem;">Select</button>
              </div>
              <div class="pricing__pack-card" data-tier="credits_10">
                <h4 style="font-family:var(--font-heading); font-size:0.85rem; font-weight:700; margin:0 0 4px 0;">$10 Credit Pack</h4>
                <div style="font-size:1.15rem; font-weight:800; color:var(--color-text-primary); margin-bottom:4px;">$10.00</div>
                <div style="font-size:0.72rem; color:var(--color-text-muted);">8,000 credits</div>
                <button class="pricing__select-btn" data-select-tier="credits_10" style="margin-top:10px; width:100%; padding:4px; font-size:0.72rem;">Select</button>
              </div>
              <div class="pricing__pack-card" data-tier="credits_20">
                <h4 style="font-family:var(--font-heading); font-size:0.85rem; font-weight:700; margin:0 0 4px 0;">$20 Credit Pack</h4>
                <div style="font-size:1.15rem; font-weight:800; color:var(--color-text-primary); margin-bottom:4px;">$20.00</div>
                <div style="font-size:0.72rem; color:var(--color-text-muted);">16,000 credits</div>
                <button class="pricing__select-btn" data-select-tier="credits_20" style="margin-top:10px; width:100%; padding:4px; font-size:0.72rem;">Select</button>
              </div>
              <div class="pricing__pack-card" data-tier="credits_50">
                <div style="position:absolute; top:-9px; left:50%; transform:translateX(-50%); background:var(--color-purple); color:white; font-size:0.58rem; font-weight:700; padding:1px 6px; border-radius:10px; white-space:nowrap; letter-spacing:0.3px;">+5% FREE</div>
                <h4 style="font-family:var(--font-heading); font-size:0.85rem; font-weight:700; margin:4px 0 4px 0;">$50 Credit Pack</h4>
                <div style="font-size:1.15rem; font-weight:800; color:var(--color-text-primary); margin-bottom:4px;">$50.00</div>
                <div style="font-size:0.72rem; color:var(--color-text-muted);">42,000 credits</div>
                <button class="pricing__select-btn" data-select-tier="credits_50" style="margin-top:10px; width:100%; padding:4px; font-size:0.72rem;">Select</button>
              </div>
              <div class="pricing__pack-card" data-tier="credits_100">
                <div style="position:absolute; top:-9px; left:50%; transform:translateX(-50%); background:var(--color-red); color:white; font-size:0.58rem; font-weight:700; padding:1px 6px; border-radius:10px; white-space:nowrap; letter-spacing:0.3px;">+10% FREE</div>
                <h4 style="font-family:var(--font-heading); font-size:0.85rem; font-weight:700; margin:4px 0 4px 0;">$100 Credit Pack</h4>
                <div style="font-size:1.15rem; font-weight:800; color:var(--color-text-primary); margin-bottom:4px;">$100.00</div>
                <div style="font-size:0.72rem; color:var(--color-text-muted);">88,000 credits</div>
                <button class="pricing__select-btn" data-select-tier="credits_100" style="margin-top:10px; width:100%; padding:4px; font-size:0.72rem;">Select</button>
              </div>
            </div>

            <!-- Transparency message -->
            <div style="text-align:center; padding:12px 16px; margin-bottom:16px; background:rgba(139,92,246,0.04); border-radius:12px; border:1px solid rgba(139,92,246,0.08);">
              <p style="font-family:var(--font-body); font-size:0.72rem; color:var(--color-text-muted); margin:0; line-height:1.5;">
                💜 We believe everyone has a story — not everyone has a big wallet. We aim to keep prices low and only take a <strong style="color:var(--color-purple);">20% cut</strong> from each purchase to cover hosting and managerial fees. The remaining 80% goes directly to AI generation costs for your creations.
              </p>
            </div>
 
            <!-- Sustainability badge -->
            <div class="pricing__sustain">
              <div class="pricing__sustain-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
              </div>
              <p><strong>5% of every purchase</strong> directly funds water sustainability initiatives. We strive to offset our water usage with every story you create.</p>
            </div>
 
            <!-- Payment methods -->
            <div class="pricing__payments" id="pricing-payments" style="display:none;">
              <h3 class="pricing__pay-title">Complete Purchase</h3>
              <p class="pricing__pay-selected" id="pricing-selected-label"></p>
              <div class="pricing__pay-methods">
                <button class="pricing__pay-btn pricing__pay-btn--stripe" id="pay-stripe">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  Pay with Card
                </button>
              </div>
            </div>
          </div>
        `,
      });
 
      // Wire up pricing interactions
      setTimeout(() => {
        const tiers: Record<string, string> = {
          single: 'Single Story Token — $1.99',
          monthly: 'Monthly Creator Pass — $9.99/mo',
          pack: 'Token Pack (10) — $14.99',
          credits_5: '$5 Credit Pack (4,000 credits) — $5.00',
          credits_10: '$10 Credit Pack (8,000 credits) — $10.00',
          credits_20: '$20 Credit Pack (16,000 credits) — $20.00',
          credits_50: '$50 Credit Pack (42,000 credits) — $50.00',
          credits_100: '$100 Credit Pack (88,000 credits) — $100.00',
        };
        let selectedTier = '';

        // Close button
        document.getElementById('pricing-close-btn')?.addEventListener('click', () => {
          hideModal();
        });

        // Tier select buttons
        document.querySelectorAll('[data-select-tier]').forEach(btn => {
          btn.addEventListener('click', () => {
            selectedTier = btn.getAttribute('data-select-tier') || '';
            // Highlight selected card
            document.querySelectorAll('.pricing__card, .pricing__pack-card').forEach(c => c.classList.remove('pricing__card--selected'));
            btn.closest('.pricing__card, .pricing__pack-card')?.classList.add('pricing__card--selected');
            // Show payment section
            const payments = document.getElementById('pricing-payments');
            const label = document.getElementById('pricing-selected-label');
            if (payments) payments.style.display = 'block';
            if (label) label.textContent = tiers[selectedTier] || '';
            payments?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          });
        });

        // Payment buttons — real Stripe Checkout integration
        const PRICE_MAP: Record<string, string> = {
          single:      'price_1U336k3YM398Mh5DPK6nxRg8',
          monthly:     'price_1U337Z3YM398Mh5D58XFSbiB',
          credits_5:   'price_1U338F3YM398Mh5DsgqEP8T9',
          credits_10:  'price_1U338z3YM398Mh5DbW2hwJX2',
          credits_20:  'price_1U33Zi3YM398Mh5DjdfrZm2U',
          credits_50:  'price_1U33nn3YM398Mh5DLnj7h27F',
          credits_100: 'price_1U33oT3YM398Mh5DvfWdsjFf',
        };

        // Pay with Card → real Stripe Checkout
        document.getElementById('pay-stripe')?.addEventListener('click', async () => {
          if (!selectedTier) return;
          const priceId = PRICE_MAP[selectedTier];
          if (!priceId) { alert('Please select a plan first.'); return; }

          const btn = document.getElementById('pay-stripe') as HTMLButtonElement | null;
          if (btn) { btn.disabled = true; btn.textContent = 'Redirecting to Stripe…'; }

          try {
            const res = await fetch('https://yqtsyulvyzgtmxnvddco.supabase.co/functions/v1/create-checkout-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                priceId,
                userId: localStorage.getItem('drive_username') || 'anonymous',
                successUrl: window.location.origin + '/#/library?purchase=success&tier=' + selectedTier,
                cancelUrl: window.location.origin + '/#/library?purchase=canceled',
              }),
            });
            const data = await res.json();
            if (data.url) {
              window.location.href = data.url;
            } else {
              throw new Error(data.error || 'Failed to create checkout session');
            }
          } catch (err: any) {
            alert('Payment error: ' + (err.message || 'Please try again.'));
            if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Pay with Card`; }
          }
        });

      }, 50);
    });
  }

  // Manage plan button
  document.getElementById('manage-plan-btn')?.addEventListener('click', () => {
    const sub = getUserSubscription();
    showModal({
      title: 'Your Plan',
      content: `
        <div style="text-align:center; padding:0.5rem 0;">
          <div style="font-size:2rem; margin-bottom:0.5rem;">💎</div>
          <h3 style="font-family:var(--font-heading); font-size:1.1rem; font-weight:700; margin:0 0 4px 0;">${sub.plan === 'creator' ? 'Creator Plan' : 'Starter Plan'}</h3>
          <p style="font-size:0.82rem; color:#888; margin:0 0 1rem 0;">${sub.plan === 'creator' ? 'Unlimited stories · Priority AI' : sub.tokensRemaining + ' token' + (sub.tokensRemaining !== 1 ? 's' : '') + ' remaining'}</p>
          <div style="background:#f8f7f4; border-radius:12px; padding:12px; margin-bottom:0.75rem; text-align:left;">
            <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:4px;"><span style="color:#888;">Plan</span><span style="font-weight:600;">${sub.selectedTier === 'monthly' ? 'Monthly Creator Pass' : sub.selectedTier === 'pack' ? 'Token Pack (10)' : 'Single Story Token'}</span></div>
            <div style="display:flex; justify-content:space-between; font-size:0.78rem; margin-bottom:4px;"><span style="color:#888;">Purchased</span><span style="font-weight:600;">${new Date(sub.purchasedAt).toLocaleDateString()}</span></div>
            ${sub.expiresAt ? '<div style="display:flex; justify-content:space-between; font-size:0.78rem;"><span style="color:#888;">Renews</span><span style="font-weight:600;">' + new Date(sub.expiresAt).toLocaleDateString() + '</span></div>' : ''}
          </div>
          <p style="font-size:0.7rem; color:#aaa; margin:0;">Payment management will be available through Stripe once the backend is connected.</p>
        </div>
      `,
      confirmText: 'Done',
    });
  });

  const createBtn = document.getElementById('create-new-btn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      navigate('create');
    });
  }

  // Edit user story draft
  container.querySelectorAll('[data-edit-user]').forEach(btn => {
    btn.addEventListener('click', () => {
      const storyId = btn.getAttribute('data-edit-user');
      if (storyId) {
        navigate(`create/${storyId}`);
      }
    });
  });

  // If admin, load and wire official drafts
  if (hasAdminPrivileges()) {
    const adminGrid = document.getElementById('admin-drafts-grid');
    const loadingEl = document.getElementById('admin-drafts-loading');
    const adminCreateBtn = document.getElementById('admin-create-new-btn');

    adminCreateBtn?.addEventListener('click', () => {
      navigate('admin-create');
    });

    fetchOfficialStories().then(stories => {
      if (loadingEl) loadingEl.remove();
      const drafts = stories.filter(s => s.officialStatus === 'draft' || (s as any).status === 'draft');
      const localDraft = getLocalAdminDraft();

      let html = '';
      if (localDraft && !drafts.some(d => d.id === localDraft.editStoryId)) {
        html += renderLocalAdminDraftCard(localDraft);
      }
      html += drafts.map(d => renderAdminDraftCard(d)).join('');

      if (adminGrid) {
        if (html.trim()) {
          adminGrid.innerHTML = html;
          wireAdminDraftListeners();
        } else {
          adminGrid.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 1.5rem; background: var(--color-surface); border-radius: var(--radius-lg); border: 1px dashed var(--color-border); text-align: center; color: var(--color-text-muted); font-size: 0.85rem;">
              No saved admin draft storyboards.
            </div>
          `;
        }
      }
    }).catch(err => {
      console.error('Failed to load official drafts', err);
      if (loadingEl) loadingEl.textContent = 'Could not load admin drafts.';
    });

    function wireAdminDraftListeners() {
      container?.querySelectorAll('[data-edit-admin]').forEach(btn => {
        btn.addEventListener('click', () => {
          const storyId = btn.getAttribute('data-edit-admin');
          const format = btn.getAttribute('data-format') || 'book';
          if (storyId) {
            navigate(`admin-create/${storyId}?format=${format}`);
          }
        });
      });

      container?.querySelectorAll('[data-resume-local-admin]').forEach(btn => {
        btn.addEventListener('click', () => {
          const format = btn.getAttribute('data-format') || 'scroll';
          navigate(`admin-create?format=${format}`);
        });
      });

      container?.querySelectorAll('[data-delete-local-admin]').forEach(btn => {
        btn.addEventListener('click', () => {
          showModal({
            title: 'Delete Local Admin Draft',
            content: '<p style="line-height:1.6;">Are you sure you want to discard this local draft? This cannot be undone.</p>',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: () => {
              localStorage.removeItem('drive_admin_create_draft');
              const viewContainer = document.getElementById('view-container');
              if (viewContainer) {
                viewContainer.innerHTML = render();
                init();
              }
            }
          });
        });
      });

      container?.querySelectorAll('[data-delete-admin]').forEach(btn => {
        btn.addEventListener('click', () => {
          const storyId = btn.getAttribute('data-delete-admin');
          if (!storyId) return;
          showModal({
            title: 'Delete Admin Draft',
            content: '<p style="line-height:1.6;">Are you sure you want to delete this admin draft storyboard? This cannot be undone.</p>',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
              try {
                await deleteOfficialStory(storyId);
                const viewContainer = document.getElementById('view-container');
                if (viewContainer) {
                  viewContainer.innerHTML = render();
                  init();
                }
              } catch (e) {
                console.error('Failed to delete official draft', e);
              }
            }
          });
        });
      });
    }
  }

  // Continue reading tracked stories
  container.querySelectorAll('[data-continue-reading]').forEach(btn => {
    btn.addEventListener('click', () => {
      const storyId = btn.getAttribute('data-continue-reading');
      if (storyId) navigate(`story/${storyId}`);
    });
  });

  // Remove tracked story from reading history
  container.querySelectorAll('[data-remove-tracked]').forEach(btn => {
    btn.addEventListener('click', () => {
      const storyId = btn.getAttribute('data-remove-tracked');
      if (!storyId) return;
      showModal({
        title: 'Remove from Reading History',
        content: '<p style="line-height:1.6;">Remove this story from your reading journeys? (You can always restart it anytime from the catalog.)</p>',
        confirmText: 'Remove',
        cancelText: 'Cancel',
        onConfirm: () => {
          removeTrackedStory(storyId);
          const viewContainer = document.getElementById('view-container');
          if (viewContainer) {
            viewContainer.innerHTML = render();
            init();
          }
        }
      });
    });
  });

  // Friends button in library
  document.getElementById('btn-library-friends')?.addEventListener('click', () => navigate('friends'));

  // Browse catalog buttons
  document.getElementById('btn-browse-catalog')?.addEventListener('click', () => navigate('home'));
  document.getElementById('btn-empty-browse')?.addEventListener('click', () => navigate('home'));

  // View story buttons
  container.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const storyId = btn.getAttribute('data-view');
      if (storyId) navigate(`book/${storyId}`);
    });
  });

  // Resubmit denied story buttons
  container.querySelectorAll('[data-resubmit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const storyId = btn.getAttribute('data-resubmit');
      if (!storyId) return;
      
      const { resubmitStoryUser } = await import('../lib/db.ts');
      await resubmitStoryUser(storyId);
      
      showModal({
        title: 'Story Resubmitted! 🚀',
        content: '<p style="line-height:1.6;">Your story has been resubmitted to the developer review queue (<strong>Under Review</strong>).</p>',
        confirmText: 'Awesome',
        onConfirm: () => {
          const viewContainer = document.getElementById('view-container');
          if (viewContainer) {
            viewContainer.innerHTML = render();
            init();
          }
        },
      });
    });
  });

  // Share story buttons
  container.querySelectorAll('[data-share]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const storyId = btn.getAttribute('data-share');
      if (!storyId) return;
      const story = getUserStories().find(s => s.id === storyId);
      if (!story) return;

      const shareUrl = `${window.location.origin}${window.location.pathname}#shared/${storyId}`;
      const shareData = {
        title: `${story.title} — DRiVE`,
        text: story.synopsis || `Check out "${story.title}" on DRiVE!`,
        url: shareUrl,
      };

      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(shareUrl);
          showModal({
            title: 'Link Copied!',
            content: '<p style="line-height:1.6;">The share link has been copied to your clipboard.</p>',
            confirmText: 'OK',
          });
        }
      } catch (err) {
        console.log('Share cancelled or failed:', err);
      }
    });
  });

  // Delete story buttons
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const storyId = btn.getAttribute('data-delete');
      if (!storyId) return;
      const story = getUserStories().find(s => s.id === storyId);
      if (!story) return;

      showModal({
        title: 'Delete Story',
        content: `<p style="line-height:1.6;">Are you sure you want to delete <strong>“${story.title}”</strong>? This cannot be undone.</p>`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        onConfirm: () => {
          deleteUserStory(storyId);
          const viewContainer = document.getElementById('view-container');
          if (viewContainer) {
            viewContainer.innerHTML = render();
            init();
          }
        },
      });
    });
  });
}
