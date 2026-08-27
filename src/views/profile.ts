import { navigate } from '../router.ts';
import { getUserStories, isLibraryUnlocked, unlockLibrary } from '../state.ts';
import { getSelectedAvatar, setSelectedAvatar } from '../state.ts';
import { getSocialLinks, setSocialLink, getUsername } from '../state.ts';
import type { SocialPlatform } from '../state.ts';
import { MONSTER_AVATARS } from '../data/avatars.ts';
import { showModal } from '../components/modal.ts';
import { isBetaTester } from '../lib/auth.ts';
import { checkIsGameMaster, hasAdminPrivileges, updateProfile } from '../lib/db.ts';

// ─── Social Media Config ───
const SOCIALS: { key: SocialPlatform; svg: string; label: string; color: string; placeholder: string }[] = [
  {
    key: 'instagram',
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
    label: 'Instagram',
    color: '#E4405F',
    placeholder: 'https://instagram.com/...'
  },
  {
    key: 'facebook',
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
    label: 'Facebook',
    color: '#1877F2',
    placeholder: 'https://facebook.com/...'
  },
  {
    key: 'youtube',
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.35 29 29 0 0 0-.46-5.33zM9.75 15.02V8.48l5.75 3.27z"/></svg>`,
    label: 'YouTube',
    color: '#FF0000',
    placeholder: 'https://youtube.com/@...'
  },
  {
    key: 'x',
    svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    label: 'X',
    color: 'var(--color-text-primary)',
    placeholder: 'https://x.com/...'
  },
  {
    key: 'bluesky',
    svg: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 6 4.5 9.5 4.5 12c0 3 1.5 4.5 3.5 4.5 1 0 2-.5 2.5-1.5-.5 2-2 3.5-4.5 4 3 .5 5.5-.5 6-3.5.5 3 3 4 6 3.5-2.5-.5-4-2-4.5-4 .5 1 1.5 1.5 2.5 1.5 2 0 3.5-1.5 3.5-4.5 0-2.5-2-6-8-10z"/></svg>`,
    label: 'Bluesky',
    color: '#0085FF',
    placeholder: 'https://bsky.app/profile/...'
  }
];

function renderSocialButton(key: SocialPlatform, svg: string, label: string, color: string, handle: string): string {
  const hasHandle = handle.length > 0;
  const href = hasHandle ? handle : '#';
  const target = hasHandle ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `
    <a class="profile-social ${hasHandle ? 'has-handle' : ''}" href="${href}"${target} aria-label="${label}" data-social="${key}" style="--social-color: ${color}">
      ${svg}
      ${hasHandle ? `<span class="profile-social__badge"></span>` : ''}
    </a>
  `;
}

export function render(): string {
  const selectedAvatar = getSelectedAvatar();
  const userStories = getUserStories();
  const hasStories = userStories.length > 0;
  const socialLinks = getSocialLinks();
  const username = getUsername();
  const displayName = username.replace(/_/g, ' ');

  return `
    <div class="view-profile fade-in" id="profile-container">

      <!-- ===== PROFILE HERO ===== -->
      <section class="profile-hero slide-up">
        <button class="profile-hero__edit-btn" id="open-profile-editor" aria-label="Edit profile">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
        </button>
        <div class="profile-hero__glow"></div>

        <!-- Avatar (entire ring is clickable) -->
        <div class="profile-avatar">
          <div class="profile-avatar__ring">
            <div class="profile-avatar__img" id="avatar-display">
              ${MONSTER_AVATARS[selectedAvatar]}
            </div>
          </div>
        </div>

        <!-- User Info -->
        <h2 class="profile-hero__name">${displayName}</h2>
        <p class="profile-hero__handle text-muted">@${username}</p>
        ${isBetaTester() ? `
          <div class="profile-beta-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>Beta Tester</span>
          </div>
        ` : ''}
        ${checkIsGameMaster() ? `
          <div class="profile-beta-badge" style="background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(217,119,6,0.15)); border-color: rgba(245,158,11,0.4); margin-top: 6px;">
            <span style="font-size: 0.8rem;">👑</span>
            <span style="color: #F59E0B; font-weight: 700;">Game Master</span>
          </div>
        ` : hasAdminPrivileges() ? `
          <div class="profile-beta-badge" style="background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(124,58,237,0.15)); border-color: rgba(139,92,246,0.4); margin-top: 6px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span style="color: #8B5CF6; font-weight: 700;">Admin</span>
          </div>
        ` : ''}
        <p class="profile-hero__bio text-muted" style="margin-top: 8px; font-size: 0.9rem; max-width: 260px; text-align: center; line-height: 1.5;">
          Storyteller & dreamer on DRiVE
        </p>

        <!-- Social Links -->
        <div class="profile-socials" id="profile-socials">
          ${SOCIALS.map(s => renderSocialButton(s.key, s.svg, s.label, s.color, socialLinks[s.key])).join('')}
          <button class="profile-social profile-social--edit" id="open-social-editor" aria-label="Edit social links" style="--social-color: var(--color-purple)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
            </svg>
          </button>
        </div>
      </section>

      <!-- ===== FRIENDS & SOCIAL BUTTON ===== -->
      <section class="section slide-up stagger-2" style="padding: 0 var(--space-md); margin-bottom: 0.75rem;">
        <button class="profile-friends-btn" id="go-to-friends">
          <div class="profile-friends-btn__left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C084FC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>Find & Add Friends</span>
          </div>
          <div class="profile-friends-btn__right">
            <span class="profile-friends-btn__badge">QR & Codes</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.7; flex-shrink: 0;">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </button>
      </section>

      <!-- ===== MY LIBRARY BUTTON ===== -->
      <section class="section slide-up stagger-2" style="padding: 0 var(--space-md);">
        <button class="profile-library-btn" id="go-to-library">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          <span>My Library</span>
          ${!isLibraryUnlocked() ? `
            <span class="profile-library-btn__lock">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </span>
          ` : ''}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: auto; opacity: 0.7;">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </section>

      <!-- ===== STORIES PREVIEW / EMPTY STATE ===== -->
      <section class="section slide-up stagger-3">
        <div class="section__header">
          <h2 class="section__title">My Stories</h2>
          <span class="text-muted" style="font-size: 0.85rem;">${userStories.length} ${userStories.length === 1 ? 'story' : 'stories'}</span>
        </div>

        ${hasStories ? `
          <div style="padding: 0 var(--space-md);">
            ${userStories.slice(0, 3).map((s: any) => `
              <div class="profile-story-item slide-up">
                <div class="profile-story-item__icon">${s.format === 'scroll' ? '📜' : s.format === 'book' ? '📖' : '🖼️'}</div>
                <div class="profile-story-item__info">
                  <h4 style="margin: 0; font-size: 0.95rem;">${s.title}</h4>
                  <span class="text-muted" style="font-size: 0.78rem;">${s.genre} · ${s.status.replace('-', ' ')}</span>
                </div>
              </div>
            `).join('')}
            ${userStories.length > 3 ? `<p class="text-muted text-center" style="font-size: 0.85rem; margin-top: var(--space-sm);">+ ${userStories.length - 3} more</p>` : ''}
          </div>
        ` : `
          <div class="profile-empty-state">
            <div class="profile-empty-state__graphic">
              <svg width="80" height="80" viewBox="0 0 100 100" fill="none">
                <rect x="20" y="15" width="60" height="70" rx="8" fill="var(--color-eggshell-dark)" stroke="var(--color-border)" stroke-width="2"/>
                <line x1="32" y1="35" x2="68" y2="35" stroke="var(--color-purple-light)" stroke-width="3" stroke-linecap="round" opacity="0.5"/>
                <line x1="32" y1="45" x2="58" y2="45" stroke="var(--color-pink-light)" stroke-width="3" stroke-linecap="round" opacity="0.4"/>
                <line x1="32" y1="55" x2="52" y2="55" stroke="var(--color-blue-light)" stroke-width="3" stroke-linecap="round" opacity="0.3"/>
                <circle cx="72" cy="72" r="18" fill="var(--color-eggshell)" stroke="var(--color-purple-light)" stroke-width="2"/>
                <line x1="72" y1="64" x2="72" y2="80" stroke="var(--color-purple)" stroke-width="3" stroke-linecap="round"/>
                <line x1="64" y1="72" x2="80" y2="72" stroke="var(--color-purple)" stroke-width="3" stroke-linecap="round"/>
              </svg>
            </div>
            <p class="profile-empty-state__text">Nothing to see here, try creating your first post!</p>
            <button class="btn btn--primary" id="empty-create-btn" style="margin-top: var(--space-md);">Create a Story</button>
          </div>
        `}
      </section>

      <!-- ===== AVATAR PICKER MODAL ===== -->
      <div class="avatar-picker-backdrop" id="avatar-picker-backdrop">
        <div class="avatar-picker" id="avatar-picker">
          <div class="avatar-picker__header">
            <h3>Choose Your Avatar</h3>
            <button class="avatar-picker__close" id="avatar-picker-close" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="avatar-picker__grid" id="avatar-grid">
            ${MONSTER_AVATARS.map((svg, i) => `
              <button class="avatar-picker__item ${i === selectedAvatar ? 'selected' : ''}" data-index="${i}" aria-label="Avatar ${i + 1}">
                ${svg}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- ===== SOCIAL LINKS EDITOR MODAL ===== -->
      <div class="social-editor-backdrop" id="social-editor-backdrop">
        <div class="social-editor" id="social-editor">
          <div class="social-editor__header">
            <h3>Edit Social Links</h3>
            <button class="social-editor__close" id="social-editor-close" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="social-editor__fields" id="social-fields">
            ${SOCIALS.map(s => `
              <div class="social-editor__field" data-platform="${s.key}">
                <div class="social-editor__icon" style="color: ${s.color}">
                  ${s.svg}
                </div>
                <div class="social-editor__input-wrap">
                  <label class="social-editor__label">${s.label}</label>
                  <input
                    type="url"
                    class="social-editor__input"
                    id="social-input-${s.key}"
                    placeholder="${s.placeholder}"
                    value="${socialLinks[s.key]}"
                    data-platform="${s.key}"
                  />
                </div>
                <div class="social-editor__status" id="social-status-${s.key}">
                  ${socialLinks[s.key] ? `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
          <button class="social-editor__save" id="social-save-btn">Save Changes</button>
        </div>
      </div>

    </div>
  `;
}

export function init(): void {
  const container = document.getElementById('profile-container');
  if (!container) return;

  // ─── Find & Add Friends button ───
  const friendsBtn = document.getElementById('go-to-friends');
  if (friendsBtn) {
    friendsBtn.addEventListener('click', () => {
      navigate('friends');
    });
  }

  // ─── My Library button (checks auth state) ───
  const libraryBtn = document.getElementById('go-to-library');
  if (libraryBtn) {
    libraryBtn.addEventListener('click', () => {
      if (isLibraryUnlocked()) {
        navigate('library');
      } else {
        showModal({
          title: 'Unlock My Library',
          content: '<p style="line-height:1.6;">Subscribe to <strong>DRiVE Creator</strong> for $9.99/month to access your library and create stories.</p>',
          confirmText: 'Subscribe',
          cancelText: 'Later',
          onConfirm: () => {
            unlockLibrary();
            navigate('library');
          }
        });
      }
    });
  }

  // ─── Empty state create button ───
  const createBtn = document.getElementById('empty-create-btn');
  if (createBtn) {
    createBtn.addEventListener('click', () => navigate('create'));
  }

  // ─── Avatar Picker ───
  const avatarBtn = document.getElementById('open-avatar-picker');
  const avatarBackdrop = document.getElementById('avatar-picker-backdrop');
  const avatarClose = document.getElementById('avatar-picker-close');
  const avatarGrid = document.getElementById('avatar-grid');
  const avatarDisplay = document.getElementById('avatar-display');

  const bottomNav = document.querySelector('.bottom-nav') as HTMLElement;

  const openAvatarPicker = () => {
    avatarBackdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (bottomNav) bottomNav.style.display = 'none';
  };
  const closeAvatarPicker = () => {
    avatarBackdrop?.classList.remove('open');
    document.body.style.overflow = '';
    if (bottomNav) bottomNav.style.display = '';
  };

  // Avatar is no longer clickable - edit profile button handles this now
  avatarClose?.addEventListener('click', closeAvatarPicker);
  avatarBackdrop?.addEventListener('click', (e) => {
    if (e.target === avatarBackdrop) closeAvatarPicker();
  });

  avatarGrid?.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('.avatar-picker__item') as HTMLElement;
    if (!item) return;
    const index = parseInt(item.dataset.index || '0', 10);

    // Update selection ring
    avatarGrid.querySelectorAll('.avatar-picker__item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');

    // Persist & update display immediately
    setSelectedAvatar(index);
    if (avatarDisplay) {
      avatarDisplay.innerHTML = MONSTER_AVATARS[index];
    }
    // Also update the header avatar
    const headerAvatarImg = document.getElementById('header-avatar-img');
    if (headerAvatarImg) {
      headerAvatarImg.innerHTML = MONSTER_AVATARS[index];
    }

    setTimeout(closeAvatarPicker, 250);
  });

  // ─── Edit Profile Popup ───
  const editProfileBtn = document.getElementById('open-profile-editor');
  editProfileBtn?.addEventListener('click', () => {
    const currentAvatar = getSelectedAvatar();
    const currentUsername = getUsername();
    let selectedAvatarIdx = currentAvatar;

    showModal({
      title: 'Edit Profile',
      content: `
        <div style="display:flex; flex-direction:column; gap:1rem;">
          <div>
            <label style="font-family:var(--font-heading); font-size:0.82rem; font-weight:600; color:var(--color-text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Choose Avatar</label>
            <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-top:8px;" id="modal-avatar-grid">
              ${MONSTER_AVATARS.map((svg: string, i: number) => `
                <div class="modal-avatar-item${i === currentAvatar ? ' selected' : ''}" data-avatar-idx="${i}" style="width:100%; aspect-ratio:1; border-radius:12px; border:2px solid ${i === currentAvatar ? 'var(--color-purple)' : 'var(--color-border)'}; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; background:${i === currentAvatar ? 'rgba(139,92,246,0.08)' : 'var(--color-surface)'}; padding:4px;">
                  ${svg}
                </div>
              `).join('')}
            </div>
          </div>
          <div>
            <label style="font-family:var(--font-heading); font-size:0.82rem; font-weight:600; color:var(--color-text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Display Name</label>
            <input type="text" id="modal-display-name" value="${currentUsername}" style="width:100%; padding:0.6rem 0.8rem; border:1.5px solid var(--color-border); border-radius:10px; font-size:0.9rem; outline:none; font-family:var(--font-body); margin-top:6px; box-sizing:border-box; background:var(--color-surface-elevated); color:var(--color-text-primary);" />
          </div>
          <div>
            <label style="font-family:var(--font-heading); font-size:0.82rem; font-weight:600; color:var(--color-text-secondary); text-transform:uppercase; letter-spacing:0.5px;">User ID</label>
            <input type="text" id="modal-user-id" value="${currentUsername}" style="width:100%; padding:0.6rem 0.8rem; border:1.5px solid var(--color-border); border-radius:10px; font-size:0.9rem; outline:none; font-family:var(--font-body); margin-top:6px; box-sizing:border-box; background:var(--color-surface-elevated); color:var(--color-text-primary);" />
            <p style="font-size:0.75rem; color:var(--color-text-muted); margin:4px 0 0;">Can only be changed once per month</p>
          </div>
        </div>
      `,
      confirmText: 'Save',
      cancelText: 'Cancel',
      onConfirm: () => {
        setSelectedAvatar(selectedAvatarIdx);
        if (avatarDisplay) {
          avatarDisplay.innerHTML = MONSTER_AVATARS[selectedAvatarIdx];
        }
        const headerAvatarImg = document.getElementById('header-avatar-img');
        if (headerAvatarImg) {
          headerAvatarImg.innerHTML = MONSTER_AVATARS[selectedAvatarIdx];
        }
        const newName = (document.getElementById('modal-display-name') as HTMLInputElement)?.value?.trim();
        if (newName) {
          localStorage.setItem('drive_username', newName);
          localStorage.setItem('drive_display_name', newName);
          // Persist username to Supabase so it survives reloads
          updateProfile({ username: newName, avatar_index: selectedAvatarIdx });
          // Update displayed name in profile hero
          const heroName = document.querySelector('.profile-hero__name');
          if (heroName) heroName.textContent = newName.replace(/_/g, ' ');
          const heroHandle = document.querySelector('.profile-hero__handle');
          if (heroHandle) heroHandle.textContent = '@' + newName;
        } else {
          // Still save avatar even if name wasn't changed
          updateProfile({ avatar_index: selectedAvatarIdx });
        }
      }
    });

    // Wire up avatar grid clicks after modal renders
    setTimeout(() => {
      const grid = document.getElementById('modal-avatar-grid');
      grid?.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest('[data-avatar-idx]') as HTMLElement;
        if (!item) return;
        const idx = parseInt(item.dataset.avatarIdx || '0', 10);
        selectedAvatarIdx = idx;
        grid.querySelectorAll('[data-avatar-idx]').forEach(el => {
          const htmlEl = el as HTMLElement;
          const isSelected = parseInt(htmlEl.dataset.avatarIdx || '-1') === idx;
          htmlEl.style.borderColor = isSelected ? 'var(--color-purple)' : 'var(--color-border)';
          htmlEl.style.background = isSelected ? 'rgba(139,92,246,0.08)' : 'var(--color-surface)';
        });
      });
    }, 50);
  });

  // ─── Social Links Editor ───
  const socialEditBtn = document.getElementById('open-social-editor');
  const socialBackdrop = document.getElementById('social-editor-backdrop');
  const socialClose = document.getElementById('social-editor-close');
  const socialSaveBtn = document.getElementById('social-save-btn');

  const openSocialEditor = () => {
    socialBackdrop?.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (bottomNav) bottomNav.style.display = 'none';
    // Focus first input
    setTimeout(() => {
      const firstInput = document.getElementById('social-input-instagram') as HTMLInputElement;
      firstInput?.focus();
    }, 350);
  };
  const closeSocialEditor = () => {
    socialBackdrop?.classList.remove('open');
    document.body.style.overflow = '';
    if (bottomNav) bottomNav.style.display = '';
  };

  socialEditBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openSocialEditor();
  });
  socialClose?.addEventListener('click', closeSocialEditor);
  socialBackdrop?.addEventListener('click', (e) => {
    if (e.target === socialBackdrop) closeSocialEditor();
  });

  // Auto-save on input change (per field)
  SOCIALS.forEach(s => {
    const input = document.getElementById(`social-input-${s.key}`) as HTMLInputElement;
    const statusEl = document.getElementById(`social-status-${s.key}`);
    if (!input) return;

    input.addEventListener('input', () => {
      const val = input.value.trim();
      setSocialLink(s.key, val);

      // Update the status indicator
      if (statusEl) {
        statusEl.innerHTML = val ? `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ` : '';
      }

      // Update the social button in the profile
      const socialBtn = container.querySelector(`.profile-social[data-social="${s.key}"]`) as HTMLElement;
      if (socialBtn) {
        socialBtn.classList.toggle('has-handle', val.length > 0);
        const badge = socialBtn.querySelector('.profile-social__badge');
        if (val && !badge) {
          socialBtn.insertAdjacentHTML('beforeend', '<span class="profile-social__badge"></span>');
        } else if (!val && badge) {
          badge.remove();
        }
      }
    });
  });

  // Save button (close with confirmation)
  socialSaveBtn?.addEventListener('click', () => {
    closeSocialEditor();
  });

  // ─── Keyboard: Escape closes modals ───
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (avatarBackdrop?.classList.contains('open')) closeAvatarPicker();
      if (socialBackdrop?.classList.contains('open')) closeSocialEditor();
    }
  });

}
