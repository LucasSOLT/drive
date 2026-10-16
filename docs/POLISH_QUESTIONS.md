# DRiVE Polish: Questions to Talk Through

> Paste this into Gemini. Each question references a backlog ID. Where I have a recommendation, it's marked **(Rec)**, you can just say "go with the rec."
> **Context for Gemini:** DRiVE is a PWA (Vite + TypeScript + Supabase) for interactive story-reading. Creators (admin/"DRiVE Originals" and users) build stories made of Episodes → Pages (image/video + screenplay text with `CHARACTER: "dialogue"` lines, ElevenLabs/Google TTS voices, pre-recorded audio). Readers read solo, then join a "Squad Gate" lobby (3 players) to read later episodes together and complete a "SPARC" checkpoint (48h timer, replies with text/images/links).

---

## 1. Priorities & process
1. We now have ~60 backlog items. Do you want to work in **this order**: (1) data-integrity/flow breakers (P0: adding pages, duplicate episodes, quote parsing, X button, video render, native pop-ups) → (2) Story/Episode settings split → (3) Squad Gate consolidation + SPARC → (4) Highlight/karaoke → (5) Branding/landing polish? **(Rec: yes)**
2. Is there a **launch date / demo date** that decides what can wait?
3. After each batch should I (a) push right away, (b) wait for you to test on your phone first? **(Rec: wait for your test, since you've been testing on iOS PWA)**
4. Should the backlog get a **"Won't do / Later"** section so ideas aren't lost but don't clutter? **(Rec: yes)**

## 2. Adding pages (ED-1)
5. What exactly did the gear menu show instead of "Add Page"? (Duplicate Page? Something else?) A screenshot of that menu would help.
6. Where should **"+ Add Page"** live? Options: (a) a "+" tile at the end of the page-dots strip, (b) a floating "+ Add Page" button under the current page card, (c) both. **(Rec: (a) + (b))**
7. Should adding a page insert **after the current page** or **at the end**? **(Rec: after the current page, with an option to move)**
8. A new page should start **blank**. Should it inherit anything from the previous page (alignment, background, cast)? **(Rec: inherit alignment only)**
9. Do you want to **keep "Duplicate Page"** at all? If yes, keep it in the gear menu only. **(Rec: keep, but clearly labeled and separate from Add Page)**

## 3. Story vs. Episode settings (ED-2, ED-7/ED-8)
10. **Story-level fields:** title, synopsis, cover image/video, genre, format, age rating/tags, cast list, narrator, story-text voice. Anything to add or move? Which should be **inherited by every episode** unless overridden?
11. **Episode-level fields:** episode number, episode title, episode synopsis, anything else? (Per-episode cover/thumbnail? Per-episode narrator override?)
12. Where does the **cast / voices (Narrator, Non-character dialogue, characters)** belong: story-level (shared across episodes, consistent voices) or episode-level? **(Rec: story-level, since characters recur across episodes)**
13. Who can edit story settings: only the creator/admin from **Library "My Creations"** and the **Admin Dashboard**? Should the editor still show a read-only story title at the top?
14. Is the episode synopsis **required** to publish, or optional? Is the **story synopsis** required? What goes in the pre-flight checklist for each?
15. In the story settings, do you want a **"Go Live (all episodes)"** button plus a way to choose "go live only these episodes"? How should it treat episodes that fail pre-flight (skip them and report, or block everything)? **(Rec: skip + clear report)**
16. Should readers see the **episode title + episode synopsis** on the series page and in the reader (e.g., on the episode card)? 

## 4. Duplicates & episode numbers (ED-3, ED-4)
17. Confirm: **remove "Duplicate Episode" entirely**? Is there any scenario (e.g., "start Episode 2 from Episode 1's layout") where you'd want a template feature instead? **(Rec: remove now; maybe add "Use as template" later)**
18. Episode numbering: **auto-assign the next number** on creation, and allow reordering via Move Up / Move Down, which **renumbers automatically**? Or should creators type numbers manually? **(Rec: auto + reorder renumbers; no manual typing)**
19. Should Go Live be allowed with gaps (Episode 1 and 3 live, 2 draft)? 
20. For stories that **already have duplicate numbers** (like your test story): should I write a one-time auto-fix that renumbers them in order of creation?

## 5. Dialogue, quotes & parser (ED-5, ED-6)
21. iOS keyboards produce curly quotes (`“ ”`). OK to **auto-normalize everything to one style behind the scenes**, and leave what the creator typed visible? **(Rec: yes, normalize only for parsing; optionally "Smart Punctuation" off in the editor)**
22. Nested quotes: in `NARRATOR: "There isn't much a 2D "thing" can do…"` the inner "thing" is inside the dialogue. Rule proposal: **the dialogue ends at the last closing quote on that line/paragraph**, inner quotes are spoken as normal text. OK? What about when a character's line spans multiple paragraphs?
23. Can one line contain **multiple speakers** (e.g., `A: "Hi," B: "Hello."`)? Should the parser split them?
24. Highlight color: the **character's chosen color** (from Cast) for the whole `"…"` span. Should the **NAME:** label also be colored? Should the narrator line be colored too (narrator has its own color), or is narrator treated as "non-character" uncolored? You said plain story text should be uncolored, **please confirm narrator is colored**.
25. Mention on color psychology: should I add **suggested colors** per voice type (e.g., warm for friendly, cool for villain) when creating a character, or just keep the existing 10-color palette?
26. What should happen if a line is `UNKNOWNNAME: "…"` (name not in the cast)? Warn, auto-create the character, or treat as plain text? **(Rec: show a subtle "add as character?" chip)**

## 6. Karaoke highlight timing (ED-7, PF-2)
27. Your idea: **pre-compute the word-timing track when pre-recording audio** and store it, so playback is deterministic. This works best with ElevenLabs (real timestamps). With **Google free TTS I currently fake timing** (evenly spaced), which is a big part of lag. For free voices, OK to estimate timing by **decoding the audio and distributing words by syllable length/silence detection**? **(Rec: yes)**
28. Should an **admin preview of the highlight** exist in the editor (play page with highlight before going live), and should creators be able to **nudge/offset timing** (e.g., ±200ms slider) if it's off?
29. When does the timing get generated: at **Pre-record time** (adds seconds to the recording process) – OK?
30. Where do you see the lag most: start of the page, drifting over a long page, or after pausing/resuming? Which device/browser?

## 7. Squad Gate (SG-1)
31. Please list the **exact current screens** in order (or screenshot each). My understanding: ...lobby gate → create/join → code → waiting room → ready/queue → start. What should it become? Options: (a) **one screen with 3 states** (Create/Join → Lobby/Roster → Starting), (b) two screens (Join/Create + Lobby), (c) a bottom sheet over the series page. **(Rec: (a))**
32. Which of the "cool elements" must stay? (Roster slots, join code, countdown, animations, avatars, chat?)
33. The roster currently **requires 3 players**. Can a squad start with 2? What's the min/max? What happens if someone leaves/disconnects mid-episode?
34. Admin-only tools ("Admin test launch", "Admin skip") on the same screen as real players: should they move behind a small **"Admin tools" collapsible** or only show up when logged in as admin? **(Rec: collapsible, admin-only)**
35. Red dashed empty slots → soft placeholders. Should empty slots have a **"Invite" / share-code** button inside them? **(Rec: yes)**

## 8. SPARC (SP-1, SP-2)
36. Formatting toolbar: describe the exact bug: "stays highlighted while active instead of only the most recent." Expected behavior: **buttons light up based on the formatting at the cursor/selection** (bold on → lit; move cursor to non-bold → unlit). Correct?
37. Which formatting tools exist/are wanted (bold, italic, underline, links, lists, headings…)?
38. After everyone submits (SP-2), what should the screen show? Options: summary of all replies, "Waiting for squad…" timeline, confetti + "Next episode unlocks in 48h", a share/recap card. What do you want to be the **emotional payoff**?
39. Can people **edit/delete** their reply before the 48h ends? Can others **react** to replies?
40. What happens when the 48 hours ends but someone hasn't replied: skip them, extend, or lock the next episode?

## 9. Admin dashboard & menus (AD-1)
41. For the 3-dot menu on mobile, would you rather it be an **iOS-style bottom sheet** (always fully visible, big tap targets) instead of a floating dropdown? **(Rec: bottom sheet on mobile)**
42. Which actions should be **in the menu vs. visible as buttons**? (Edit, Preview, Go Live, Move up/down, Delete, Unpublish…)

## 10. Video, audio & media (ED-12 to ED-15)
43. Native video audio: when a video has its own sound, should the page **auto-play with native audio and disable narration/TTS** for that page, or play both (narration over video, ducking the video volume)? **(Rec: let creator choose per page, default = native audio only)**
44. Does autoplay need to be **muted until the first user tap** on iOS (browsers block unmuted autoplay)? I'd handle with a "Tap to start" on first page. OK?
45. Max video size/length and format? (iPhone .mov, HEVC – transcoding may be needed. Do you have a storage budget for Supabase?)
46. "Preview uploaded video" – inline thumbnail with play button on the slide card, or a full-screen preview modal? **(Rec: poster-frame thumbnail + tap-to-play)**
47. When a video has no audio: offer "Record narrator", "Use character voices", or "Leave silent" at upload time or later in the page?

## 11. Branding & landing page (BR-*)
48. Please send **the brand kit PNG ("Updated SOL DRiVE Brand Guidelines (Final).png")** and the **new logo files** (ideally SVG + transparent PNG, light & dark versions).
49. The coworker mentions "Trending **Games**", "Top **Games**", "Stats for Nerds", "Feed Recommendation", "+ Post Friends". Are these on a **different version/page** than what we've built (DRiVE is stories, not games)? Could you ask them which URL/screen, or is this text still in our app somewhere? I need to know whether to rename ("Trending Stories") or ignore.
50. Footer: do you have the **content** for Company (About, Careers, Press), Support (Help, Contact, FAQ), Legal (Terms, Privacy, Cookies)? If not, should I **generate placeholder pages** you will replace later? Should there be real links (email, social)?
51. Should "Sign Up Free" appear as a **nav bar button** (top right), a **hero secondary button**, or both? **(Rec: both)**
52. Do you want the **color palette updated** from the brand kit globally (CSS variables) or only logo + accents?
53. Is a **light mode** needed or only dark?

## 12. Performance & stability (PF-1)
54. Please describe the "performance things": which screens were slow, how slow (seconds?), which device/browser, home/explore load, editor typing lag, audio recording, squad realtime?
55. Do you want me to add a **lightweight performance/error log** (e.g., console + Supabase table) so we can see real slow moments during your tests instead of relying on memory?
56. Should I set up **automatic crash/error reporting** (e.g., Sentry free tier)? 
57. Are there **realistic user numbers** (how many concurrent users/stories) to plan for?

## 13. Native pop-ups & general UX (GN-1)
58. OK to **ban all native alert/confirm/prompt** app-wide and replace with consistent in-app modals + toasts (success/error/info)? **(Rec: yes)**
59. Do you want a consistent **loading/skeleton** and **empty state** style across the app (and a design system doc of buttons/spacing/colors)? **(Rec: yes, makes branding updates much faster)**

## 14. Scope check on the earlier deferred items
60. Still wanted: text box auto-grow (ED-9) and reader-side dialogue highlighting (ED-10)? Is reader-side highlighting the same colors as the editor (character color on the quote)?
61. Should we keep **free Google TTS voices** as permanent options, or are they a temporary fallback until ElevenLabs credits are back? (They cap around 200 characters per request and have no real timestamps.)

---

**What I need from you to start (minimum):** answers to #5, #10-12, #17-18, #21-22, #31, #36, #38, and the brand assets (#48). Everything else I can start with the recommendations.
