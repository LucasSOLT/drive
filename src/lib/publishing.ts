/**
 * Story Publishing — Pre-flight Validation & Submission State Machine.
 *
 * Validates story completeness before submission to the moderation queue.
 * Returns actionable check results so the UI can display a live checklist
 * with pass/fail indicators and specific guidance for each requirement.
 *
 * Status lifecycle:
 *   draft → under-review → published | denied
 *                             ↓
 *                        (resubmit) → under-review
 */

import type { UserStory, StoryCharacter, DialogueLine, StoryAudioMode } from '../types.ts';
import { realCharacters } from './cast-voices.ts';

// ─── Pre-flight Check Types ───

export type CheckStatus = 'pass' | 'fail' | 'warn';

export interface PreflightCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface PreflightResult {
  checks: PreflightCheck[];
  canSubmit: boolean;       // true if all required checks pass (no 'fail')
  failCount: number;
  warnCount: number;
  passCount: number;
}

// ─── Validation Functions ───

/**
 * Run all pre-flight checks against a story to determine if it's ready
 * for submission to the moderation queue.
 *
 * Required checks (block submission if fail):
 * - Title (non-empty, ≥3 chars)
 * - Synopsis (non-empty, ≥10 chars)
 * - Cover Media (has cover image or video)
 * - Page Count (≥2 pages with content)
 * - Page Content (every page has an image or video)
 *
 * Advisory checks (warn but don't block):
 * - Audio Presence (at least some pages have audio)
 * - Character Voices (if dialogue exists, characters have voices assigned)
 * - Dialogue Coverage (screenplay/dialogue on most pages)
 */
export function runPreflightChecks(story: {
  title?: string;
  synopsis?: string;
  coverImage?: string;
  coverVideo?: string;
  pages?: { image: string | null; text: string }[];
  panels?: string[];
  pageScripts?: Record<number, string>;
  pageAudio?: Record<number, string>;
  pageDialogue?: Record<number, DialogueLine[]>;
  audioMode?: StoryAudioMode;
  characters?: StoryCharacter[];
  narratorVoiceId?: string;
}): PreflightResult {
  const checks: PreflightCheck[] = [];

  // ── Required: Title ──
  const title = (story.title || '').trim();
  checks.push({
    id: 'title',
    label: 'Story Title',
    status: title.length >= 3 ? 'pass' : 'fail',
    detail: title.length >= 3
      ? `"${title}"`
      : title.length > 0
        ? 'Title must be at least 3 characters long.'
        : 'Add a title to your story.',
  });

  // ── Required: Synopsis ──
  const synopsis = (story.synopsis || '').trim();
  checks.push({
    id: 'synopsis',
    label: 'Synopsis / Description',
    status: synopsis.length >= 10 ? 'pass' : 'fail',
    detail: synopsis.length >= 10
      ? `${synopsis.length} characters`
      : synopsis.length > 0
        ? 'Synopsis should be at least 10 characters. Give readers a hook!'
        : 'Write a short description so readers know what your story is about.',
  });

  // ── Required: Cover Media ──
  const hasCover = !!(story.coverImage || story.coverVideo);
  checks.push({
    id: 'cover',
    label: 'Cover Image or Video',
    status: hasCover ? 'pass' : 'fail',
    detail: hasCover
      ? 'Cover media attached'
      : 'Upload a cover image or video. This is the first thing readers see!',
  });

  // ── Required: Page Count ──
  // Support both panels (official Story) and pages (UserStory) formats
  const pageImages = story.panels || (story.pages || []).map(p => p.image);
  const pageCount = pageImages.length;
  checks.push({
    id: 'pages',
    label: 'Minimum Pages (2+)',
    status: pageCount >= 2 ? 'pass' : 'fail',
    detail: pageCount >= 2
      ? `${pageCount} page${pageCount > 1 ? 's' : ''}`
      : `Only ${pageCount} page${pageCount !== 1 ? 's' : ''}. Add at least 2 pages to tell your story.`,
  });

  // ── Required: Page Content ──
  // Every page must have an image or video
  const emptyPages: number[] = [];
  pageImages.forEach((img, i) => {
    if (!img) emptyPages.push(i + 1);
  });
  checks.push({
    id: 'page-content',
    label: 'All Pages Have Media',
    status: emptyPages.length === 0 && pageCount > 0 ? 'pass' : pageCount === 0 ? 'fail' : 'fail',
    detail: emptyPages.length === 0
      ? 'All pages have images or video'
      : `Page${emptyPages.length > 1 ? 's' : ''} ${emptyPages.slice(0, 5).join(', ')}${emptyPages.length > 5 ? '…' : ''} missing media.`,
  });

  // ── Advisory: Audio Presence ──
  const pageAudio = story.pageAudio || {};
  const pageDialogue = story.pageDialogue || {};
  let pagesWithAudio = 0;
  for (let i = 0; i < pageCount; i++) {
    const hasPageAudio = !!pageAudio[i];
    const hasDialogueAudio = (pageDialogue[i] || []).some(l => !!l.audioUrl);
    if (hasPageAudio || hasDialogueAudio) pagesWithAudio++;
  }
  const audioPercent = pageCount > 0 ? Math.round((pagesWithAudio / pageCount) * 100) : 0;
  checks.push({
    id: 'audio',
    label: 'Audio / Narration',
    status: pagesWithAudio > 0 ? 'pass' : 'warn',
    detail: pagesWithAudio > 0
      ? `${pagesWithAudio}/${pageCount} pages have audio (${audioPercent}%)`
      : 'No audio recorded yet. Stories with narration get 3× more engagement!',
  });

  // ── Advisory: Dialogue / Script ──
  const pageScripts = story.pageScripts || {};
  let pagesWithText = 0;
  for (let i = 0; i < pageCount; i++) {
    const hasScript = !!(pageScripts[i] && pageScripts[i].trim());
    const hasDialogue = (pageDialogue[i] || []).length > 0;
    if (hasScript || hasDialogue) pagesWithText++;
  }
  checks.push({
    id: 'dialogue',
    label: 'Dialogue / Screenplay',
    status: pagesWithText > 0 ? 'pass' : 'warn',
    detail: pagesWithText > 0
      ? `${pagesWithText}/${pageCount} pages have dialogue or narration text`
      : 'Consider adding dialogue to bring your story to life with captions.',
  });

  // ── Advisory: Character Voices ──
  const characters = realCharacters(story.characters);
  const totalDialogueLines = Object.values(pageDialogue).flat().length;
  if (totalDialogueLines > 0 && characters.length > 0) {
    const charsWithoutVoice = characters.filter(c => !c.voiceId);
    checks.push({
      id: 'voices',
      label: 'Character Voices Assigned',
      status: charsWithoutVoice.length === 0 ? 'pass' : 'warn',
      detail: charsWithoutVoice.length === 0
        ? `All ${characters.length} characters have voices`
        : `${charsWithoutVoice.map(c => c.name).join(', ')} ${charsWithoutVoice.length === 1 ? 'needs' : 'need'} a voice assigned.`,
    });
  }

  // ── Compute summary ──
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const passCount = checks.filter(c => c.status === 'pass').length;

  return {
    checks,
    canSubmit: failCount === 0,
    failCount,
    warnCount,
    passCount,
  };
}

// ─── Status Transitions ───

export type StoryStatus = 'draft' | 'under-review' | 'published' | 'denied';

/** Check if a status transition is valid. */
export function isValidTransition(from: StoryStatus, to: StoryStatus): boolean {
  const allowed: Record<StoryStatus, StoryStatus[]> = {
    'draft':        ['under-review'],
    'under-review': ['published', 'denied'],
    'published':    ['under-review'],  // admin can un-publish for re-review
    'denied':       ['under-review'],  // creator can resubmit
  };
  return (allowed[from] || []).includes(to);
}

/** Get a human-readable label for a story status. */
export function getStatusLabel(status: StoryStatus): string {
  const labels: Record<StoryStatus, string> = {
    'draft': '📝 Draft',
    'under-review': '⏳ Under Review',
    'published': '✅ Published',
    'denied': '❌ Denied',
  };
  return labels[status] || status;
}

/** Get the accent color for a story status. */
export function getStatusColor(status: StoryStatus): string {
  const colors: Record<StoryStatus, string> = {
    'draft': '#6B7280',         // gray
    'under-review': '#F59E0B',  // amber
    'published': '#10B981',     // emerald
    'denied': '#EF4444',        // red
  };
  return colors[status] || '#6B7280';
}
