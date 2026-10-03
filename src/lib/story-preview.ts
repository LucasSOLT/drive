/**
 * story-preview.ts — Lightweight story page preview renderer.
 *
 * Renders a single story page (media + dialogue text) into any container.
 * Used by the inline editor preview. Shares dialogue layout conventions
 * with the reader (same CSS classes) but is self-contained with no
 * dependency on reader state, karaoke controllers, or audio playback.
 *
 * The reader (story-reader.ts) keeps its own deeply-integrated version
 * because it needs closure access to activeKaraokeCtrl, captionsOpen,
 * playAudioForPage, etc. This module is the "read-only preview" twin.
 */

import { isVideoMedia, ensureVideoPlayback } from '../lib/media.ts';
import type { Story, DialogueLine, StoryCharacter } from '../types.ts';

function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Generate the dialogue/narration HTML for a page using the reader's CSS classes. */
export function buildDialogueHtml(
  dialogueLines: DialogueLine[],
  scriptText: string,
  narratorColor: string,
  characters: StoryCharacter[]
): string {
  let globalWordIdx = 0;

  const wrapWords = (text: string, lineIdx: number, highlightColor: string) => {
    const words = text.split(/\s+/).filter(Boolean);
    return words.map(word => {
      const idx = globalWordIdx++;
      return `<span class="cc-word" data-line-idx="${lineIdx}" data-word-idx="${idx}" data-highlight-color="${highlightColor}">${escapeHtml(word)}</span>`;
    }).join(' ');
  };

  if (dialogueLines.length > 0) {
    return dialogueLines.map((line, idx) => {
      const isNarrator = line.characterId === 'narrator' || !line.characterId ||
        /^narrator$/i.test(line.characterName || '') ||
        (line.characterName && line.characterName.toLowerCase().includes('narrator'));
      const matchedChar = isNarrator ? null :
        characters.find(c => c.id === line.characterId || c.name?.toLowerCase() === line.characterName?.toLowerCase());
      const charColor = isNarrator ? narratorColor : (matchedChar?.color || '#3b82f6');
      const wordsHtml = wrapWords(line.text, idx, charColor);

      if (isNarrator) {
        return `<div class="reader-dialogue-row reader-dialogue-row--narrator" data-line-idx="${idx}">
          <div class="reader-dialogue-text">${wordsHtml}</div>
        </div>`;
      }
      return `<div class="reader-dialogue-row" data-line-idx="${idx}">
        <div class="reader-dialogue-speaker" style="color:${charColor};" title="${escapeHtml(line.characterName)}">${escapeHtml(line.characterName)}:</div>
        <div class="reader-dialogue-text">${wordsHtml}</div>
      </div>`;
    }).join('');
  }

  if (scriptText) {
    const wordsHtml = wrapWords(scriptText, 0, narratorColor);
    return `<div class="reader-dialogue-row reader-dialogue-row--narrator" data-line-idx="0">
      <div class="reader-dialogue-text">${wordsHtml}</div>
    </div>`;
  }

  return '';
}

export interface PreviewOptions {
  /** Container element to render into */
  container: HTMLElement;
  /** Story data */
  story: Story;
  /** Page index to preview */
  pageIdx: number;
  /** Whether to show audio controls (default false for preview) */
  showAudioControls?: boolean;
  /** Optional callback when user clicks close/back */
  onClose?: () => void;
}

/**
 * Render a self-contained story page preview into a container.
 * Shows the media (image/video) and dialogue text using the same
 * CSS classes as the reader for visual consistency.
 */
export function renderStoryPagePreview(opts: PreviewOptions): { destroy: () => void } {
  const { container, story, pageIdx, showAudioControls = false, onClose } = opts;

  const media = (story.pageVideos?.[pageIdx]) || (story.panels?.[pageIdx]) || '';
  const isVideo = isVideoMedia(media) || !!(story.pageVideos?.[pageIdx]);
  const focalPos = story.pageFocalPositions?.[pageIdx];
  const objPos = focalPos && focalPos !== 'center' ? `object-position:center ${focalPos};` : '';
  const narratorColor = story.narratorHighlightColor || '#7C6FFA';

  const dialogueLines = story.pageDialogue?.[pageIdx] || [];
  const scriptText = story.pageScripts?.[pageIdx] || '';
  const dialogueHtml = buildDialogueHtml(dialogueLines, scriptText, narratorColor, story.characters || []);

  const mediaHtml = isVideo
    ? `<video class="preview-media" src="${media}" autoplay loop playsinline webkit-playsinline muted style="max-width:100%;max-height:50dvh;object-fit:contain;${objPos}border-radius:8px;"></video>`
    : `<img class="preview-media" src="${media}" alt="Page ${pageIdx + 1}" style="max-width:100%;max-height:50dvh;object-fit:contain;${objPos}border-radius:8px;">`;

  container.innerHTML = `
    <div class="story-preview" style="display:flex;flex-direction:column;height:100%;background:var(--color-bg, #141424);overflow:hidden;">
      ${onClose ? `
        <div class="story-preview__header" style="display:flex;align-items:center;padding:8px 12px;flex-shrink:0;">
          <button type="button" class="story-preview__back" style="background:none;border:none;color:var(--color-text-primary);cursor:pointer;padding:4px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style="font-size:0.85rem;font-weight:700;color:var(--color-text-primary);margin-left:8px;">Preview — Page ${pageIdx + 1}</span>
        </div>
      ` : ''}
      <div style="flex:0 0 auto;display:flex;justify-content:center;align-items:center;padding:4px;">
        ${mediaHtml}
      </div>
      ${dialogueHtml ? `
        <div id="preview-captions-overlay" style="flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding:0 4px 6px;max-width:600px;margin:0 auto;width:100%;">
          <div class="reader-text-controls">
            <div class="reader-text-controls__tag">
              <span class="reader-text-dot"></span>
              <span class="reader-text-tag-label">Preview</span>
            </div>
          </div>
          <div class="reader-dialogue-body" style="mask-image:linear-gradient(to bottom, transparent 0%, black 5%, black 90%, transparent 100%);-webkit-mask-image:linear-gradient(to bottom, transparent 0%, black 5%, black 90%, transparent 100%);">
            ${dialogueHtml}
          </div>
        </div>
      ` : '<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--color-text-muted);font-size:0.85rem;">No text on this page</div>'}
      <div style="flex-shrink:0;display:flex;justify-content:center;padding:6px 0 10px;gap:6px;">
        <span style="font-size:0.72rem;color:var(--color-text-muted);">Page ${pageIdx + 1} of ${story.panels?.length || 1}</span>
      </div>
    </div>
  `;

  // Wire close button
  if (onClose) {
    container.querySelector('.story-preview__back')?.addEventListener('click', onClose);
  }

  // Autoplay videos muted
  const vid = container.querySelector('video.preview-media') as HTMLVideoElement | null;
  if (vid) ensureVideoPlayback(vid);

  return {
    destroy: () => {
      const v = container.querySelector('video.preview-media') as HTMLVideoElement | null;
      if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
      container.innerHTML = '';
    }
  };
}
