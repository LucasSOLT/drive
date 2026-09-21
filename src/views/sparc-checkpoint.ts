import { navigate, getCurrentRoute } from '../router.ts';
import { supabase } from '../lib/supabase.ts';
import { getUserId } from '../lib/auth.ts';
import { 
  getSquadSession, 
  getSparcResponses, 
  submitSparcResponse, 
  markSparcCompleted, 
  checkAllSparcCompleted, 
  getSquadMembers,
  toggleSparcReaction,
  getSparcReactions,
  submitSparcReply,
  getSparcReplies
} from '../lib/db.ts';
import { tryAdvanceSquad, isEpisodeTimerExpired } from '../lib/squad-engine.ts';
import { uploadMedia } from '../lib/storage.ts';
import { MONSTER_AVATARS } from '../data/avatars.ts';
import { type SparcPost, type SquadMemberState, type SquadSession } from '../types.ts';

// State
let pollInterval: number;
let currentSquadId = '';
let currentStoryGroupId = '';
let currentEpisodeNumber = 1;
let currentSession: SquadSession | null = null;
let attachments: { type: 'photo' | 'link'; url: string }[] = [];
let hasSubmitted = false;
let hasAutoAdvanced = false;
let posts: SparcPost[] = [];
let members: SquadMemberState[] = [];
let reactions: Record<string, Array<{ emoji: string; count: number; userReacted: boolean }>> = {};
let replies: Record<string, Array<{ id: string; userId: string; username: string; avatarIndex: number; content: string; createdAt: string }>> = {};

const REACTION_EMOJIS: { key: string; emoji: string; label: string }[] = [
  { key: 'fire', emoji: '🔥', label: 'Fire' },
  { key: 'lightbulb', emoji: '💡', label: 'Great Idea' },
  { key: 'mindblown', emoji: '🤯', label: 'Mind Blown' },
  { key: 'heart', emoji: '❤️', label: 'Love' },
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getTimeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function renderFeed(posts: SparcPost[], members: SquadMemberState[]): string {
  const postedUserIds = new Set(posts.map(p => p.userId));

  let html = '';
  for (const post of posts) {
    const avatar = MONSTER_AVATARS[post.avatarIndex % MONSTER_AVATARS.length] || MONSTER_AVATARS[0];
    const timeAgo = getTimeAgo(post.createdAt);
    const postReactions = reactions[post.id] || [];
    const postReplies = replies[post.id] || [];

    // Build reaction buttons
    const reactionHtml = REACTION_EMOJIS.map(r => {
      const found = postReactions.find(pr => pr.emoji === r.key);
      const count = found?.count || 0;
      const active = found?.userReacted ? ' sparc-reaction-btn--active' : '';
      return `<button class="sparc-reaction-btn${active}" data-emoji="${r.key}" data-response-id="${post.id}" title="${r.label}">
        <span>${r.emoji}</span>${count > 0 ? `<span class="sparc-reaction-count">${count}</span>` : ''}
      </button>`;
    }).join('');

    // Build replies
    const repliesHtml = postReplies.map(reply => {
      const rAvatar = MONSTER_AVATARS[reply.avatarIndex % MONSTER_AVATARS.length] || MONSTER_AVATARS[0];
      return `
        <div class="sparc-reply">
          <div class="sparc-reply__avatar">${rAvatar}</div>
          <div class="sparc-reply__body">
            <span class="sparc-reply__username">${escapeHtml(reply.username)}</span>
            <span class="sparc-reply__time">${getTimeAgo(reply.createdAt)}</span>
            <p class="sparc-reply__content">${escapeHtml(reply.content)}</p>
          </div>
        </div>`;
    }).join('');

    const replyCount = postReplies.length;

    html += `
      <div class="sparc-feed__post" data-post-id="${post.id}">
        <div class="sparc-feed__post-header">
          <div class="sparc-feed__avatar">${avatar}</div>
          <div class="sparc-feed__meta">
            <span class="sparc-feed__username">${escapeHtml(post.username)}</span>
            <span class="sparc-feed__time">${timeAgo}</span>
          </div>
          <span class="sparc-feed__badge">✅ Greenlit</span>
        </div>
        <div class="sparc-feed__content">${post.content}</div>
        ${post.mediaUrls.length > 0 ? `
          <div class="sparc-feed__media">
            ${post.mediaUrls.map(url => `<img src="${url}" class="sparc-feed__media-img" alt="Attachment">`).join('')}
          </div>
        ` : ''}

        <div class="sparc-reactions" style="display:flex; gap:6px; margin-top:10px; flex-wrap:wrap;">
          ${reactionHtml}
        </div>

        <div class="sparc-reply-section" style="margin-top:10px;">
          <button class="sparc-reply-toggle" data-response-id="${post.id}" style="background:none; border:none; color:var(--color-text-muted); font-size:0.78rem; cursor:pointer; padding:4px 0; display:flex; align-items:center; gap:4px;">
            💬 ${replyCount > 0 ? `${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}` : 'Reply'}
          </button>
          <div class="sparc-replies-thread" data-thread-id="${post.id}" style="display:none; margin-top:8px; padding-left:12px; border-left:2px solid var(--color-border);">
            ${repliesHtml}
            <div class="sparc-reply-composer" style="display:flex; gap:6px; margin-top:8px;">
              <input type="text" class="sparc-reply-input" data-response-id="${post.id}" placeholder="Reply to ${escapeHtml(post.username)}..." maxlength="500" style="flex:1; padding:8px 12px; border:1px solid var(--color-border); border-radius:var(--radius-md); font-size:0.82rem; background:var(--color-bg); color:var(--color-text-primary);">
              <button class="sparc-reply-send" data-response-id="${post.id}" style="padding:8px 14px; background:var(--color-purple); color:white; border:none; border-radius:var(--radius-md); font-size:0.78rem; font-weight:700; cursor:pointer; white-space:nowrap;">Send</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Render "hasn't replied" for missing members
  for (const member of members) {
    if (!postedUserIds.has(member.userId)) {
      const avatar = MONSTER_AVATARS[member.avatarIndex % MONSTER_AVATARS.length] || MONSTER_AVATARS[0];
      html += `
        <div class="sparc-feed__post sparc-feed__post--pending">
          <div class="sparc-feed__post-header">
            <div class="sparc-feed__avatar" style="opacity:0.4;">${avatar}</div>
            <span class="sparc-feed__username" style="opacity:0.6;">${escapeHtml(member.username)}</span>
            <span class="sparc-feed__badge sparc-feed__badge--pending">⏳ Waiting</span>
          </div>
        </div>
      `;
    }
  }

  return html || '<p style="text-align:center; color:var(--color-text-muted); padding:24px;">No responses yet. Be the first to reply!</p>';
}

function renderAttachments(): string {
  if (attachments.length === 0) return '';
  return attachments.map((att, i) => `
    <div style="display:inline-block; position:relative; margin-right:8px; margin-top:8px;">
      ${att.type === 'photo' 
        ? `<img src="${att.url}" style="height:60px; border-radius:4px;">`
        : `<a href="${att.url}" target="_blank" style="display:inline-block; padding:8px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:4px;">🔗 Link</a>`
      }
      <button class="remove-attachment-btn" data-index="${i}" style="position:absolute; top:-6px; right:-6px; background:red; color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px;">×</button>
    </div>
  `).join('');
}

function updateProgressBar() {
  const postedCount = new Set(posts.map(p => p.userId)).size;
  const totalCount = members.length;
  const progressEl = document.getElementById('sparc-progress-text');
  const barEl = document.getElementById('sparc-progress-bar-fill');
  if (progressEl) progressEl.textContent = `${postedCount}/${totalCount} members greenlit`;
  if (barEl) {
    const pct = totalCount > 0 ? (postedCount / totalCount) * 100 : 0;
    barEl.style.width = `${pct}%`;
  }
}

export function render(): string {
  return `
    <div class="view-sparc-checkpoint fade-in">
      <div class="sparc-timer" id="sparc-timer" style="display:none; padding: 12px; background: var(--color-purple); color: white; text-align: center; font-weight: bold;"></div>
      
      <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
        <div class="sparc-header" style="text-align:center; margin-bottom: 24px;">
          <div style="font-size: 32px; margin-bottom: 8px;">🔥</div>
          <h1 id="sparc-title">Episode Complete</h1>
        </div>

        <div class="sparc-progress" style="margin-bottom: 24px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span id="sparc-progress-text" style="font-weight:bold;">0/0 members greenlit</span>
          </div>
          <div style="height:8px; background:var(--color-border); border-radius:4px; overflow:hidden;">
            <div id="sparc-progress-bar-fill" style="height:100%; width:0%; background:var(--color-purple); transition:width 0.3s ease;"></div>
          </div>
        </div>

        <div class="sparc-prompt-card" id="sparc-prompt-card" style="background:var(--color-surface); padding:16px; border-radius:8px; border:1px solid var(--color-border); margin-bottom:24px;">
          <p id="sparc-prompt-text">Loading challenge...</p>
          <div id="sparc-prompt-media"></div>
        </div>

        <div style="text-align:center; margin-bottom: 24px;">
          <button id="btn-toggle-composer" class="btn btn--primary">Reply to String</button>
        </div>

        <div class="sparc-composer" id="sparc-composer" style="display:none; background:var(--color-surface); padding:16px; border-radius:8px; border:1px solid var(--color-border); margin-bottom:24px;">
          <div class="sparc-composer__toolbar" style="margin-bottom:8px; display:flex; gap:8px;">
            <button class="format-btn" data-cmd="bold"><b>B</b></button>
            <button class="format-btn" data-cmd="italic"><i>I</i></button>
            <button class="format-btn" data-cmd="underline"><u>U</u></button>
            <button class="format-btn" data-cmd="createLink">🔗</button>
          </div>
          
          <div class="sparc-composer__editor" id="sparc-editor" contenteditable="true" style="min-height:100px; border:1px solid var(--color-border); padding:8px; border-radius:4px; margin-bottom:12px; background:var(--color-bg);"></div>
          
          <div class="sparc-composer__attachments" id="sparc-attachments-container" style="margin-bottom:12px;"></div>

          <div style="display:flex; gap:12px; margin-bottom:12px;">
            <button id="btn-attach-photo" class="btn btn--secondary" style="font-size:12px;">+ Photo</button>
            <button id="btn-attach-link" class="btn btn--secondary" style="font-size:12px;">+ Link</button>
            <input type="file" id="sparc-file-input" accept="image/*" hidden>
          </div>

          <button id="btn-submit-post" class="btn btn--primary" style="width:100%;">Submit</button>
        </div>

        <div class="sparc-feed" id="sparc-feed" style="margin-bottom:24px;"></div>

        <button id="btn-next-episode" class="sparc-advance-btn btn btn--primary" style="width:100%; margin-top:24px;" disabled>Next Episode</button>
      </div>
    </div>
  `;
}

export async function init(): Promise<void> {
  const routeParts = getCurrentRoute().split('/');
  // route format: sparc/{squadId}/{storyGroupId}/{episodeNumber}
  currentSquadId = routeParts[1] || '';
  currentStoryGroupId = routeParts[2] || '';
  currentEpisodeNumber = parseInt(routeParts[3] || '1', 10);
  attachments = [];
  hasSubmitted = false;
  hasAutoAdvanced = false;

  const titleEl = document.getElementById('sparc-title');
  if (titleEl) titleEl.textContent = `Episode ${currentEpisodeNumber} Complete`;

  // Fetch data
  try {
    const [promptRes, sessionData, membersData, postsData] = await Promise.all([
      supabase.from('official_stories').select('sparc_prompt').eq('story_group_id', currentStoryGroupId).eq('episode_number', currentEpisodeNumber).single(),
      getSquadSession(currentSquadId),
      getSquadMembers(currentSquadId),
      getSparcResponses(currentSquadId, currentStoryGroupId, currentEpisodeNumber)
    ]);

    currentSession = sessionData;
    members = membersData || [];
    posts = postsData || [];

    // Fetch reactions and replies for all posts
    const responseIds = posts.map(p => p.id);
    if (responseIds.length > 0) {
      const [reactionsData, repliesData] = await Promise.all([
        getSparcReactions(responseIds),
        getSparcReplies(responseIds),
      ]);
      reactions = reactionsData;
      replies = repliesData;
    } else {
      reactions = {};
      replies = {};
    }

    // Render prompt
    const promptTextEl = document.getElementById('sparc-prompt-text');
    const promptMediaEl = document.getElementById('sparc-prompt-media');
    if (promptRes.data?.sparc_prompt) {
      if (promptTextEl) promptTextEl.textContent = promptRes.data.sparc_prompt.text || 'Reflect on what you just read.';
      if (promptMediaEl && promptRes.data.sparc_prompt.mediaUrls?.length) {
        promptMediaEl.innerHTML = promptRes.data.sparc_prompt.mediaUrls.map((url: string) => `<img src="${url}" style="max-width:100%; border-radius:4px; margin-top:8px;">`).join('');
      }
    } else {
      if (promptTextEl) promptTextEl.textContent = 'Reflect on what you just read.';
    }

    // Check if current user already submitted
    const userId = getUserId();
    hasSubmitted = posts.some(p => p.userId === userId);
    
    if (hasSubmitted) {
      const btnToggle = document.getElementById('btn-toggle-composer');
      if (btnToggle) btnToggle.style.display = 'none';
    }

    refreshFeedUI();

    // 48h Timer setup
    if (currentSession?.episodeStartedAt) {
      const timerEl = document.getElementById('sparc-timer');
      if (timerEl) {
        timerEl.style.display = 'block';
        updateTimer(currentSession.episodeStartedAt, timerEl);
        const timerInterval = setInterval(() => {
          updateTimer(currentSession!.episodeStartedAt, timerEl);
        }, 60000); // update every minute
        window.addEventListener('hashchange', () => clearInterval(timerInterval), { once: true });
      }
    }

    // Polling setup
    pollInterval = window.setInterval(async () => {
      try {
        const session = await getSquadSession(currentSquadId);
        if (session && session.currentEpisodeNumber > currentEpisodeNumber) {
          clearInterval(pollInterval);
          const { data } = await supabase
            .from('official_stories')
            .select('id')
            .eq('story_group_id', currentStoryGroupId)
            .eq('episode_number', session.currentEpisodeNumber)
            .single();
          if (data) {
            navigate('story/' + data.id);
          }
          return;
        }

        const newPosts = await getSparcResponses(currentSquadId, currentStoryGroupId, currentEpisodeNumber);
        const postsChanged = newPosts.length !== posts.length;
        posts = newPosts;

        // Always refresh reactions and replies
        const responseIds = posts.map(p => p.id);
        if (responseIds.length > 0) {
          const [reactionsData, repliesData] = await Promise.all([
            getSparcReactions(responseIds),
            getSparcReplies(responseIds),
          ]);
          reactions = reactionsData;
          replies = repliesData;
        }

        refreshFeedUI();
      } catch (err) {
        console.error('Polling error', err);
      }
    }, 10000);
    window.addEventListener('hashchange', () => clearInterval(pollInterval), { once: true });

  } catch (err) {
    console.error('Error initializing SPARC checkpoint:', err);
  }

  setupEventListeners();
}

function updateTimer(startedAt: string, el: HTMLElement) {
  const start = new Date(startedAt).getTime();
  const end = start + (48 * 60 * 60 * 1000);
  const now = Date.now();
  const left = end - now;
  
  if (left <= 0) {
    el.textContent = 'Time is up! The story must move forward.';
  } else {
    const hrs = Math.floor(left / (1000 * 60 * 60));
    const mins = Math.floor((left % (1000 * 60 * 60)) / (1000 * 60));
    el.textContent = `${hrs}h ${mins}m remaining to greenlight`;
  }
}

function refreshFeedUI() {
  const feedEl = document.getElementById('sparc-feed');
  if (feedEl) {
    feedEl.innerHTML = renderFeed(posts, members);
    attachFeedInteractionListeners(feedEl);
  }
  updateProgressBar();

  const postedCount = new Set(posts.map(p => p.userId)).size;
  const allGreenlit = postedCount === members.length && members.length > 0;

  const nextBtn = document.getElementById('btn-next-episode') as HTMLButtonElement;
  if (nextBtn && currentSession) {
    const timerExpired = isEpisodeTimerExpired(currentSession);
    
    if (allGreenlit || timerExpired) {
      nextBtn.disabled = false;
      
      if (timerExpired && !allGreenlit) {
        nextBtn.textContent = '⏰ Time\'s up — Continue to Next Episode →';
      }
      
      if (allGreenlit && !hasAutoAdvanced) {
        hasAutoAdvanced = true;
        nextBtn.textContent = '🚀 All squad members greenlit! Advancing in 5s...';
        nextBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        setTimeout(() => {
          nextBtn.click();
        }, 5000);
      }
    } else {
      nextBtn.disabled = true;
    }
  }
}

function attachFeedInteractionListeners(feedEl: HTMLElement) {
  // Reaction buttons
  feedEl.querySelectorAll('.sparc-reaction-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      const emoji = el.dataset.emoji || '';
      const responseId = el.dataset.responseId || '';
      if (!emoji || !responseId) return;

      // Optimistic toggle
      el.classList.toggle('sparc-reaction-btn--active');

      try {
        await toggleSparcReaction(responseId, emoji);
        // Refresh reactions data
        const responseIds = posts.map(p => p.id);
        reactions = await getSparcReactions(responseIds);
        refreshFeedUI();
      } catch (err) {
        console.error('Reaction error:', err);
      }
    });
  });

  // Reply toggle buttons
  feedEl.querySelectorAll('.sparc-reply-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const responseId = (btn as HTMLElement).dataset.responseId || '';
      const thread = feedEl.querySelector(`[data-thread-id="${responseId}"]`) as HTMLElement;
      if (thread) {
        thread.style.display = thread.style.display === 'none' ? 'block' : 'none';
      }
    });
  });

  // Reply send buttons
  feedEl.querySelectorAll('.sparc-reply-send').forEach(btn => {
    btn.addEventListener('click', async () => {
      const el = btn as HTMLElement;
      const responseId = el.dataset.responseId || '';
      const input = feedEl.querySelector(`.sparc-reply-input[data-response-id="${responseId}"]`) as HTMLInputElement;
      const content = input?.value?.trim();
      if (!content || !responseId) return;

      el.textContent = '...';
      try {
        await submitSparcReply(responseId, content);
        input.value = '';
        // Refresh replies
        const responseIds = posts.map(p => p.id);
        replies = await getSparcReplies(responseIds);
        refreshFeedUI();
        // Auto-open the thread after sending
        setTimeout(() => {
          const thread = feedEl.querySelector(`[data-thread-id="${responseId}"]`) as HTMLElement;
          if (thread) thread.style.display = 'block';
        }, 50);
      } catch (err) {
        console.error('Reply error:', err);
        alert('Failed to send reply');
      }
    });
  });

  // Reply send on Enter key
  feedEl.querySelectorAll('.sparc-reply-input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        e.preventDefault();
        const responseId = (input as HTMLElement).dataset.responseId || '';
        const sendBtn = feedEl.querySelector(`.sparc-reply-send[data-response-id="${responseId}"]`) as HTMLElement;
        sendBtn?.click();
      }
    });
  });
}

function setupEventListeners() {
  const btnToggle = document.getElementById('btn-toggle-composer');
  const composer = document.getElementById('sparc-composer');
  const fileInput = document.getElementById('sparc-file-input') as HTMLInputElement;

  btnToggle?.addEventListener('click', () => {
    if (composer) {
      composer.style.display = composer.style.display === 'none' ? 'block' : 'none';
    }
  });

  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = (e.currentTarget as HTMLButtonElement).dataset.cmd;
      if (cmd === 'createLink') {
        const url = prompt('Enter link URL:');
        if (url) document.execCommand(cmd, false, url);
      } else if (cmd) {
        document.execCommand(cmd, false);
      }
      document.getElementById('sparc-editor')?.focus();
    });
  });

  document.getElementById('btn-attach-photo')?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    
    // show loading state on button
    const btn = document.getElementById('btn-attach-photo') as HTMLButtonElement;
    if (btn) btn.textContent = 'Uploading...';
    
    try {
      const res = await uploadMedia(file, 'sparc');
      const url = res.url;
      attachments.push({ type: 'photo', url });
      renderAttachmentsUI();
    } catch (err) {
      console.error('Upload error', err);
      alert('Failed to upload image');
    } finally {
      if (btn) btn.textContent = '+ Photo';
      fileInput.value = '';
    }
  });

  document.getElementById('btn-attach-link')?.addEventListener('click', () => {
    const url = prompt('Enter URL to attach:');
    if (url) {
      attachments.push({ type: 'link', url });
      renderAttachmentsUI();
    }
  });

  document.getElementById('sparc-attachments-container')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('remove-attachment-btn')) {
      const index = parseInt(target.dataset.index || '0', 10);
      attachments.splice(index, 1);
      renderAttachmentsUI();
    }
  });

  document.getElementById('btn-submit-post')?.addEventListener('click', async () => {
    const editor = document.getElementById('sparc-editor');
    const content = editor?.innerHTML.trim();
    if (!content && attachments.length === 0) {
      alert('Please write something or attach media.');
      return;
    }

    const userId = getUserId();
    if (!userId || !currentSquadId) return;

    const btn = document.getElementById('btn-submit-post') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
      const mediaUrls = attachments.map(a => a.url);
      await submitSparcResponse({
        squadId: currentSquadId,
        storyGroupId: currentStoryGroupId,
        episodeNumber: currentEpisodeNumber,
        userId,
        content: content || '',
        mediaUrls
      });
      await markSparcCompleted(currentSquadId, userId, currentEpisodeNumber);
      
      hasSubmitted = true;
      if (composer) composer.style.display = 'none';
      if (btnToggle) btnToggle.style.display = 'none';
      
      // manual refresh
      posts = await getSparcResponses(currentSquadId, currentStoryGroupId, currentEpisodeNumber);
      refreshFeedUI();
    } catch (err) {
      console.error('Error submitting SPARC:', err);
      alert('Failed to submit. Please try again.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Submit';
    }
  });

  document.getElementById('btn-next-episode')?.addEventListener('click', async () => {
    if (!currentSession) return;
    const btn = document.getElementById('btn-next-episode') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Advancing...';

    try {
      const result = await tryAdvanceSquad(currentSession.id, currentSquadId, currentEpisodeNumber);
      if (result.completed) {
        alert('Story Complete! Returning to library.');
        navigate('library');
      } else if (result.advanced && result.nextEpisode) {
        // Find next episode's story ID
        const { data, error } = await supabase
          .from('official_stories')
          .select('id')
          .eq('story_group_id', currentStoryGroupId)
          .eq('episode_number', result.nextEpisode)
          .single();
          
        if (data && !error) {
          navigate(`story/${data.id}`);
        } else {
          console.error('Could not find next episode story ID', error);
          navigate('library');
        }
      } else {
        alert('Could not advance. Make sure all members have submitted.');
        btn.disabled = false;
        btn.textContent = 'Next Episode';
      }
    } catch (err) {
      console.error('Advance error:', err);
      alert('Error advancing episode');
      btn.disabled = false;
      btn.textContent = 'Next Episode';
    }
  });
}

function renderAttachmentsUI() {
  const container = document.getElementById('sparc-attachments-container');
  if (container) {
    container.innerHTML = renderAttachments();
  }
}
