// ─── SOCIAL & FRIENDING HUB (Engine A - Social) ───

import { navigate } from '../router.ts';
import { getUserFriendCode, getFriendsList, addFriendByCode, removeFriend, type FriendUser } from '../lib/friends.ts';
import { generateQRCodeSVG } from '../lib/qrcode.ts';
import { MONSTER_AVATARS } from '../data/avatars.ts';
import { showModal } from '../components/modal.ts';
import { isAuthenticated } from '../lib/auth.ts';

export function render(): string {
  return `
    <div class="view-friends fade-in" id="friends-container">
      <div class="friends-wrapper">
        
        <!-- Header / Banner -->
        <div class="friends-hero slide-up">
          <div class="friends-hero__glow"></div>
          <div class="friends-hero__badge">
            <span class="friends-hero__dot"></span>
            <span>SOCIAL NETWORK</span>
          </div>
          <h1 class="friends-hero__title">Friends & Cohorts</h1>
          <p class="friends-hero__subtitle">
            Share your unique code, scan QR codes to connect instantly, and team up for squad story journeys.
          </p>
        </div>

        <!-- Section 1: Your Friend Code & QR Code -->
        <div class="friend-card friend-code-card slide-up stagger-1">
          <div class="friend-code-header">
            <span class="friend-section-pill">YOUR UNIQUE ID</span>
            <h2 class="friend-card__title">Your Friend Code</h2>
          </div>

          <div class="friend-code-box">
            <div class="friend-code-number" id="my-friend-code-val">••••••••</div>
            <button class="friend-copy-btn" id="btn-copy-friend-code" title="Copy your 8-digit friend code">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span id="copy-code-label">Copy Code</span>
            </button>
          </div>

          <!-- Live QR Code -->
          <div class="friend-qr-wrapper">
            <div class="friend-qr-frame" id="friend-qr-target">
              <div class="qr-placeholder-shimmer"></div>
            </div>
            <p class="friend-qr-caption">
              Point a camera at this QR code to connect instantly on DRiVE.
            </p>
            <button class="friend-share-btn" id="btn-share-friend-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              <span>Share Invite Link</span>
            </button>
          </div>
        </div>

        <!-- Section 2: Add a Friend by 8-Digit Code -->
        <div class="friend-card friend-add-card slide-up stagger-2">
          <div class="friend-code-header">
            <span class="friend-section-pill">CONNECT</span>
            <h2 class="friend-card__title">Add Friend by Code</h2>
          </div>
          <p class="friend-card__desc">Have a friend's 8-digit code? Enter it below to link accounts.</p>
          
          <form class="friend-add-form" id="friend-add-form">
            <div class="friend-input-wrap">
              <input 
                type="text" 
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="8" 
                id="input-friend-code" 
                class="friend-add-input" 
                placeholder="Enter 8-digit code (e.g. 84920194)" 
                required 
              />
              <button type="submit" class="friend-add-submit-btn" id="btn-submit-friend-code">
                <span>Add Friend</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
            <div id="friend-form-msg" class="friend-form-msg" style="display:none;"></div>
          </form>
        </div>

        <!-- Section 3: Friends List -->
        <div class="friend-card friends-list-card slide-up stagger-3">
          <div class="friends-list-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:1.2rem;">👥</span>
              <h2 class="friend-card__title" style="margin:0;">My Friends</h2>
            </div>
            <span class="friends-count-badge" id="friends-count-pill">0 Friends</span>
          </div>

          <div class="friends-list-grid" id="friends-list-target">
            <div class="friends-list-loading">Loading your friends...</div>
          </div>
        </div>

      </div>
    </div>
  `;
}

function formatFriendDuration(isoString?: string): string {
  if (!isoString) return 'Friends recently';
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return 'Friends today';
    if (diffDays === 1) return 'Friends for 1 day';
    if (diffDays < 30) return `Friends for ${diffDays} days`;
    const date = new Date(isoString);
    return `Friends since ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
  } catch {
    return 'Friends recently';
  }
}

function renderFriendTile(friend: FriendUser): string {
  const avatarSvg = MONSTER_AVATARS[friend.avatarIndex] || MONSTER_AVATARS[0];
  const durationText = formatFriendDuration(friend.friendsSince);

  return `
    <div class="friend-tile slide-up" data-friend-id="${friend.id}">
      <div class="friend-tile__avatar">
        ${avatarSvg}
      </div>
      <div class="friend-tile__info">
        <h3 class="friend-tile__name">${friend.username}</h3>
        <div class="friend-tile__meta">
          <span class="friend-tile__code">ID: ${friend.friendCode || 'Connected'}</span>
          <span class="friend-tile__duration">● ${durationText}</span>
        </div>
      </div>
      <div class="friend-tile__actions">
        <button class="friend-tile__remove-btn" data-remove-friend="${friend.id}" data-friend-name="${friend.username}" title="Remove Friend">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `;
}

export async function init(): Promise<void> {
  const container = document.getElementById('friends-container');
  if (!container) return;

  // 1. Fetch current user friend code & generate QR code
  let myCode = '84920194';
  try {
    myCode = await getUserFriendCode();
  } catch (err) {
    console.warn('[Friends] Failed to get user friend code:', err);
  }

  const codeEl = document.getElementById('my-friend-code-val');
  if (codeEl) codeEl.textContent = myCode;

  // Generate QR Code SVG
  const qrTarget = document.getElementById('friend-qr-target');
  if (qrTarget) {
    const qrUrl = `${window.location.origin}/#add-friend?code=${myCode}`;
    const qrSvg = generateQRCodeSVG(qrUrl, { size: 180, color: '#A855F7', background: 'transparent' });
    qrTarget.innerHTML = qrSvg;
  }

  // 2. Wire up Copy Code button
  const copyBtn = document.getElementById('btn-copy-friend-code');
  copyBtn?.addEventListener('click', () => {
    navigator.clipboard?.writeText(myCode).then(() => {
      const label = document.getElementById('copy-code-label');
      if (label) label.textContent = 'Copied!';
      setTimeout(() => { if (label) label.textContent = 'Copy Code'; }, 2000);
    });
  });

  // 3. Wire up Share Link button
  const shareBtn = document.getElementById('btn-share-friend-link');
  shareBtn?.addEventListener('click', async () => {
    const shareUrl = `${window.location.origin}/#add-friend?code=${myCode}`;
    const shareData = {
      title: 'Connect with me on DRiVE!',
      text: `Add me on DRiVE with friend code ${myCode} to form squads and journey together!`,
      url: shareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('Invite link copied to clipboard!');
      }
    } catch {
      await navigator.clipboard.writeText(shareUrl);
      alert('Invite link copied to clipboard!');
    }
  });

  // 4. Load and render Friends List
  async function refreshFriendsList(): Promise<void> {
    const target = document.getElementById('friends-list-target');
    const countPill = document.getElementById('friends-count-pill');
    if (!target) return;

    const friends = await getFriendsList();
    if (countPill) countPill.textContent = `${friends.length} ${friends.length === 1 ? 'Friend' : 'Friends'}`;

    if (friends.length > 0) {
      target.innerHTML = friends.map(f => renderFriendTile(f)).join('');
      
      // Wire up remove friend buttons
      target.querySelectorAll('[data-remove-friend]').forEach(btn => {
        btn.addEventListener('click', () => {
          const friendId = btn.getAttribute('data-remove-friend');
          const friendName = btn.getAttribute('data-friend-name') || 'this user';
          if (!friendId) return;

          showModal({
            title: 'Remove Friend',
            content: `<p style="line-height:1.6; text-align:center;">Are you sure you want to remove <strong>${friendName}</strong> from your friends list?</p>`,
            confirmText: 'Remove',
            cancelText: 'Cancel',
            onConfirm: async () => {
              await removeFriend(friendId);
              refreshFriendsList();
            }
          });
        });
      });
    } else {
      target.innerHTML = `
        <div class="friends-empty-state">
          <div class="friends-empty-icon">🤝</div>
          <h3 class="friends-empty-title">No Friends Added Yet</h3>
          <p class="friends-empty-desc">
            Share your 8-digit friend code or let friends scan your QR code to connect and start exploring stories together!
          </p>
        </div>
      `;
    }
  }

  await refreshFriendsList();

  // 5. Wire up Add Friend Form
  const addForm = document.getElementById('friend-add-form') as HTMLFormElement | null;
  const inputCode = document.getElementById('input-friend-code') as HTMLInputElement | null;
  const msgEl = document.getElementById('friend-form-msg');
  const submitBtn = document.getElementById('btn-submit-friend-code') as HTMLButtonElement | null;

  addForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = inputCode?.value.trim() || '';
    if (!code) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Searching...';
    }

    if (msgEl) msgEl.style.display = 'none';

    const res = await addFriendByCode(code);

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Add Friend</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    }

    if (res.success) {
      if (inputCode) inputCode.value = '';
      if (msgEl) {
        msgEl.className = 'friend-form-msg success';
        msgEl.textContent = res.message;
        msgEl.style.display = 'block';
      }
      await refreshFriendsList();
    } else {
      if (msgEl) {
        msgEl.className = 'friend-form-msg error';
        msgEl.textContent = res.message;
        msgEl.style.display = 'block';
      }
    }
  });
}
