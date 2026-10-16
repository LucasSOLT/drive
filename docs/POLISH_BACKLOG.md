# DRiVE: Polish & Stabilization Backlog (LIVING DOCUMENT)

> [!IMPORTANT]
> **This is the single source of truth for polish work. Never delete items, only change their status.**
> A mirror copy lives in the repo at `docs/POLISH_BACKLOG.md`. Update **both** whenever changes occur.

**Status legend:** `[ ]` open · `[~]` in progress · `[x]` done
**Timeline:** Demo in 7 days, Customer MVP in 14 days. Push in batches of 5.

---

## A. Admin-Only Pivot & Access Control
| ID | Status | Item | Description |
|---|---|---|---|
| ADM-1 | [x] | **Admin-Only Story Creation** | Soft-delete all normal user story creation flows. Only admins can create stories via the Admin Dashboard. Remove "Create Story" from library and remove the "Pending Approval" tab entirely. |
| ADM-2 | [x] | **Live Content Read-Only Locks** | CRITICAL: If *any* episode is live, Story Settings become strictly read-only for admins. Any Live episodes have read-only Episode Settings. Admins can only edit settings of non-live episodes. |

## B. Story vs. Episode Architecture
| ID | Status | Item | Description |
|---|---|---|---|
| STR-1 | [x] | **Story Settings Scope** | Handles story title, description, genre, cast, and story-wide background colors. Not editable from within Episode Settings. Story synopsis is REQUIRED for pre-flight. |
| STR-2 | [x] | **Episode Settings Scope** | Handles episode title, description, thumbnail, and optional specific background color override. Episode synopsis is OPTIONAL for pre-flight. |
| STR-3 | [x] | **Cast Management Link** | Characters are viewed in Episode Settings, but added/removed in Story Settings. Add a shortcut button inside the episode editor linking to Story Settings to add a character, with a back arrow to return. |
| STR-4 | [x] | **Display Cleanup** | Show *only* the episode title on the series page and episode cards (hide episode synopsis). |

## C. Editor UI, Pages & Numbering
| ID | Status | Item | Description |
|---|---|---|---|
| EDT-1 | [x] | **Add Page Button** | Replace the non-functional "Add Panel" gear menu item with exactly that button, but named "+ Add Page". Inserts at the END of the episode, completely blank. Remove "Duplicate Page" and "Duplicate Episode". |
| EDT-2 | [x] | **Episode Numbering** | Auto-assign by default. Add a manual numbering toggle in Story Settings (preserves existing numbers). Strictly enforce sequential publishing (even with decimals like 2.5). Inactive episodes cannot be moved before/between live ones. |
| EDT-3 | [ ] | **Pre-flight & Selective Release** | Admins can release selectively/on a schedule. If an episode fails pre-flight, skip it and provide a clear report. |
| EDT-4 | [x] | **Text Box Auto-Grow** | Implement auto-growing text boxes in the editor. |

## D. Dialogue, Quotes & Text Parsing
| ID | Status | Item | Description |
|---|---|---|---|
| TXT-1 | [x] | **Curly Quote Normalization** | Auto-normalize iOS curly quotes behind the scenes so parser doesn't break, but visually keep them as typed in the UI. TTS must NEVER read quotation marks out loud. |
| TXT-2 | [x] | **Paragraph Spans** | Spoken dialogue ends at the last closing quote of a paragraph. Multi-paragraph dialogue requires fresh `NAME: "..."` tags per paragraph. |
| TXT-3 | [x] | **Multiple Speakers & Unknown** | Parser must handle/split multiple speakers on a single line. If `UNKNOWNNAME:` is typed, show a subtle "add as character?" chip. |
| TXT-4 | [x] | **Character Color Highlighting** | Color only the `"..."` text span during playback and in the editor (the `NAME:` label remains uncolored). Add suggested colors to the character palette based on voice type (warm/cool). Reader-side colors must perfectly match editor colors. |

## E. Audio, Video & Timing Tracks
| ID | Status | Item | Description |
|---|---|---|---|
| AVM-1 | [ ] | **Parallel Audio (CRUCIAL)** | Editor needs TWO distinct upload blocks per page: visual media (video/image) and a smaller one below strictly for a secondary audio file. Both native video audio AND secondary audio play in parallel. Include basic volume mixing sliders. |
| AVM-2 | [ ] | **Native Video Audio & Limits** | Creators choose audio behavior per page (default: native video audio plays, disabling TTS for that page). Limit videos to 60s / ~50MB. Show inline poster-frame thumbnail with tap-to-play on the slide card. |
| AVM-3 | [x] | **iOS Autoplay Bypass** | Add a "Tap to start" screen on the first page of the reader to gracefully bypass iOS autoplay blocks. |
| AVM-4 | [ ] | **Timing Track Pre-Compute** | Pre-compute word-timing track at Pre-record time. Estimate free Google TTS timing by syllable/silence. Fixes the drift/desync on long pages. |
| AVM-5 | [ ] | **Admin Preview & Pre-record Fix** | Fix "Pre-record All" bug (must genuinely record the page and show play all). Add Admin Preview in the editor with ±200ms nudge slider, Play, Restart, Auto Play, and CC buttons. |
| AVM-6 | [x] | **Expand Google TTS** | Expand free Google TTS fallback to include as many voices as possible (add multiple US male and US female options). |

## F. Squad Gate & Single-Player Mode
| ID | Status | Item | Description |
|---|---|---|---|
| SQD-1 | [x] | **Single-Player Mode (CRITICAL)** | Remove ALL "admin skip" buttons app-wide. Add "Single-player mode" button on Series Info (admins/beta testers only). Runs exact SG/SPARC screens but overrides roster to 1 player and requires only 1 SPARC reply to continue. |
| SQD-2 | [x] | **Squad Gate Consolidation** | Consolidate to 1 screen with 3 states (Create/Join → Lobby/Roster → Starting). Clean, uncluttered, consistent. Add "1 — 2 — 3" progress indicator. Keep slots, join code, avatars, countdown. |
| SQD-3 | [x] | **Roster Rules** | Min 2, Max 5 players. Empty slots = soft placeholders containing an "Invite / Share-code" button. |

## G. SPARC Interactions
| ID | Status | Item | Description |
|---|---|---|---|
| SPC-1 | [x] | **Toolbar Fixes** | Keep simple (bold, italic, underline, lists, links). Fix active state bug: buttons must light up dynamically based on cursor's current formatting (e.g., both bold/italic light up if cursor is in text with both). |
| SPC-2 | [x] | **Post-Submission & Timer** | Show recap card, confetti ("Squad goal achieved!"), and countdown timer (in days). If timer ends and someone hasn't replied, skip them and unlock next episode. |
| SPC-3 | [x] | **Social Features** | Cannot edit replies, but can delete (must resubmit to circumvent timer). Players can react with emojis and reply to other submissions. |

## H. Branding, UX & Layout
| ID | Status | Item | Description |
|---|---|---|---|
| BRN-1 | [x] | **Brand Update** | Update color palette globally (CSS vars) to match SOL DRiVE kit. Replace logo. Keep "games" terminology ("Trending Games"). |
| BRN-2 | [x] | **Navigation & Footer** | "Sign Up Free" CTA in top-right nav AND as secondary button in hero. Clean footer: remove junk, add Privacy/TOS, add "[Page Name] coming soon" placeholders. |
| BRN-3 | [x] | **Modals & Loading** | Ban all native iOS/browser pop-ups (alerts, confirms). Replace with in-app modals/toasts. Uniform loading/skeletons and empty states. Create Design System doc. |
| BRN-4 | [x] | **Admin Dashboard Menu** | iOS-style bottom sheet for 3-dot menu. "Edit" & "Preview" = standalone buttons. "Go Live", "Move up/down", "Delete", "Unpublish" = inside bottom sheet. |

## I. Performance & Logging
| ID | Status | Item | Description |
|---|---|---|---|
| PRF-1 | [x] | **Performance Priorities** | Dark Mode ONLY. Prioritize editor typing lag (Mobile Safari) and Explore page initial load time. Scale for ~100 concurrent users. |

## J. Won't Do / Later
| ID | Status | Item | Description |
|---|---|---|---|
| LTR-1 | [x] | **Duplicate Page/Episode** | Removed for MVP to prevent numbering/data bugs. |
| LTR-2 | [x] | **Squad Gate Chat** | Deferred from the consolidated lobby screen. |
| LTR-3 | [x] | **Crash & Perf Reporting** | Supabase lightweight logs and Sentry free tier. Pushed to the very end of development. |
| LTR-4 | [x] | **Video Transcoding** | Restrict to 60s/50mb MP4/MOV for now, build transcoding pipeline later. |
