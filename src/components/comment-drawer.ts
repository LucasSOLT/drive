// ─── Comment Drawer for Story Reader ───
import { supabase } from '../lib/supabase.ts';
import { moderateContent } from '../lib/moderation.ts';
import { getUsername, getSelectedAvatar } from '../state.ts';
import { MONSTER_AVATARS } from '../data/avatars.ts';

interface Comment {
  id: string;
  author_name: string;
  avatar_index: number;
  content: string;
  created_at: string;
}

function timeAgo(dateStr: string): string {
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

function renderComment(c: Comment): string {
  const displayName = c.author_name.replace(/_/g, ' ');
  const avatarSvg = MONSTER_AVATARS[c.avatar_index] || MONSTER_AVATARS[0];
  return `
    <div class="comment-item fade-in">
      <div class="comment-item__avatar">${avatarSvg}</div>
      <div class="comment-item__body">
        <div class="comment-item__header">
          <span class="comment-item__name">${displayName}</span>
          <span class="comment-item__time">${timeAgo(c.created_at)}</span>
        </div>
        <p class="comment-item__text">${escapeHtml(c.content)}</p>
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function renderCommentDrawer(storyId: string): string {
  return `
    <div class="comment-drawer-backdrop" id="comment-backdrop">
      <div class="comment-drawer" id="comment-drawer">
        <!-- Handle bar -->
        <div class="comment-drawer__handle"><span></span></div>

        <!-- Header -->
        <div class="comment-drawer__header">
          <h3>Comments</h3>
          <span class="comment-drawer__count" id="comment-count">—</span>
          <button class="comment-drawer__close" id="comment-close" aria-label="Close comments">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- Comment feed -->
        <div class="comment-drawer__feed" id="comment-feed">
          <div class="comment-drawer__loading" id="comment-loading">
            <div class="comment-drawer__spinner"></div>
            <span>Loading comments...</span>
          </div>
          <div class="comment-drawer__empty" id="comment-empty" style="display: none;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p>No comments yet. Be the first!</p>
          </div>
        </div>

        <!-- Input area -->
        <div class="comment-drawer__input-area" id="comment-input-area">
          <div class="comment-drawer__input-row">
            <div class="comment-drawer__user-avatar" id="comment-user-avatar">
              ${MONSTER_AVATARS[getSelectedAvatar()]}
            </div>
            <textarea
              class="comment-drawer__textarea"
              id="comment-textarea"
              placeholder="Add a comment..."
              maxlength="500"
              rows="1"
              data-story-id="${storyId}"
            ></textarea>
          </div>
          <div class="comment-drawer__actions">
            <span class="comment-drawer__char-count" id="comment-char-count">0/500</span>
            <button class="comment-drawer__submit" id="comment-submit" disabled>
              Post
            </button>
          </div>
        </div>

        <!-- Moderation toast -->
        <div class="comment-drawer__toast" id="comment-toast"></div>
      </div>
    </div>
  `;
}

export function initCommentDrawer(storyId: string): void {
  const backdrop = document.getElementById('comment-backdrop');
  const closeBtn = document.getElementById('comment-close');
  const textarea = document.getElementById('comment-textarea') as HTMLTextAreaElement;
  const submitBtn = document.getElementById('comment-submit');
  const charCount = document.getElementById('comment-char-count');
  const feed = document.getElementById('comment-feed');
  const loading = document.getElementById('comment-loading');
  const empty = document.getElementById('comment-empty');
  const countBadge = document.getElementById('comment-count');
  const toast = document.getElementById('comment-toast');

  if (!backdrop || !textarea || !submitBtn || !feed) return;

  let isSubmitting = false;

  // ─── Open / Close ───
  const open = () => {
    backdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
    loadComments();
  };
  const close = () => {
    backdrop.classList.remove('open');
    document.body.style.overflow = '';
  };

  closeBtn?.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.classList.contains('open')) close();
  });

  // ─── Comment button in reader header ───
  const commentBtn = document.getElementById('btn-comments');
  commentBtn?.addEventListener('click', open);

  // ─── Textarea auto-grow + char count ───
  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    if (charCount) charCount.textContent = `${len}/500`;
    submitBtn.toggleAttribute('disabled', len === 0 || len > 500);

    // Auto-grow
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  });

  // ─── Show toast ───
  const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `comment-drawer__toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 3500);
  };

  // ─── Load comments from Supabase ───
  async function loadComments() {
    if (loading) loading.style.display = 'flex';
    if (empty) empty.style.display = 'none';

    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('story_id', storyId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (loading) loading.style.display = 'none';

    if (error) {
      console.warn('Failed to load comments:', error.message);
      // Show empty state on error
      if (empty) empty.style.display = 'flex';
      if (countBadge) countBadge.textContent = '0';
      return;
    }

    const comments = (data || []) as Comment[];
    if (countBadge) countBadge.textContent = String(comments.length);

    if (comments.length === 0) {
      if (empty) empty.style.display = 'flex';
      return;
    }

    // Render comments (keep loading/empty elements, append comments)
    if (feed) {
      const existingComments = feed.querySelectorAll('.comment-item');
      existingComments.forEach(el => el.remove());
      const emptyEl = feed.querySelector('.comment-drawer__empty');
      comments.forEach(c => {
        const div = document.createElement('div');
        div.innerHTML = renderComment(c);
        const child = div.firstElementChild;
        if (child && emptyEl) {
          feed.insertBefore(child, emptyEl);
        } else if (child) {
          feed.appendChild(child);
        }
      });
    }
  }

  // ─── Submit comment ───
  submitBtn.addEventListener('click', async () => {
    const content = textarea.value.trim();
    if (!content || isSubmitting) return;

    isSubmitting = true;
    submitBtn.textContent = '...';
    submitBtn.setAttribute('disabled', 'true');

    // Step 1: Moderation check
    const modResult = await moderateContent(content);
    if (!modResult.safe) {
      showToast(modResult.reason || 'Your comment contains offensive material', 'error');
      isSubmitting = false;
      submitBtn.textContent = 'Post';
      submitBtn.removeAttribute('disabled');
      return;
    }

    // Step 2: Save to Supabase
    const username = getUsername();
    const avatarIndex = getSelectedAvatar();

    const { error } = await supabase.from('comments').insert({
      story_id: storyId,
      author_name: username,
      avatar_index: avatarIndex,
      content: content,
    });

    if (error) {
      showToast('Failed to post comment. Try again.', 'error');
      console.error('Comment insert error:', error.message);
      isSubmitting = false;
      submitBtn.textContent = 'Post';
      submitBtn.removeAttribute('disabled');
      return;
    }

    // Step 3: Success — clear input and reload
    textarea.value = '';
    textarea.style.height = 'auto';
    if (charCount) charCount.textContent = '0/500';
    submitBtn.textContent = 'Post';
    submitBtn.setAttribute('disabled', 'true');
    isSubmitting = false;

    showToast('Comment posted!', 'success');
    await loadComments();
  });
}
