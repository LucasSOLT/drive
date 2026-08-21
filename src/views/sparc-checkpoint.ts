import { navigate } from '../router.ts';
import { supabase } from '../lib/supabase.ts';
import { getUserId } from '../lib/auth.ts';

const SPARC_PROMPTS: Record<string, string> = {
  reflection: 'Reflect on what you just read. What resonated with you?',
  poem: 'Write a 6-word poem about what you just experienced.',
  haiku: 'Express your thoughts as a haiku (5-7-5 syllables).',
  voice: 'Record a voice memo sharing your reaction.',
};

let currentSquadId = '';
let currentChapterIndex = 0;
let currentPromptType: 'reflection' | 'poem' | 'haiku' | 'voice' = 'reflection';
let isRecording = false;
let recognition: any = null;

export function setSparcContext(squadId: string, chapterIndex: number, promptType: 'reflection' | 'poem' | 'haiku' | 'voice') {
  currentSquadId = squadId;
  currentChapterIndex = chapterIndex;
  currentPromptType = promptType;
}

export function render(): string {
  const prompt = SPARC_PROMPTS[currentPromptType] || SPARC_PROMPTS.reflection;

  return `
    <div class="view-sparc-checkpoint fade-in" id="sparc-container" style="padding: var(--space-md); max-width: 430px; margin: 0 auto;">

      <!-- SPARC Header -->
      <div class="slide-up stagger-1" style="text-align: center; margin-bottom: var(--space-lg);">
        <div style="
          width: 56px; height: 56px; border-radius: 50%; margin: 0 auto var(--space-sm);
          background: linear-gradient(135deg, var(--color-purple), var(--color-blue));
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 16px rgba(139,92,246,0.3);
        ">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
            <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
          </svg>
        </div>
        <span style="font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--color-purple); font-weight: 700;">SPARC Checkpoint</span>
        <h1 style="font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: var(--color-text-primary); margin: 6px 0 0;">Chapter ${currentChapterIndex + 1} Complete</h1>
      </div>

      <!-- Prompt Card -->
      <div class="slide-up stagger-2" style="
        background: var(--color-surface); border: 1.5px solid var(--color-border);
        border-radius: var(--radius-xl); padding: var(--space-lg); box-shadow: var(--shadow-md);
        margin-bottom: var(--space-md);
      ">
        <div style="
          background: linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.05));
          border-radius: var(--radius-lg); padding: var(--space-md);
          margin-bottom: var(--space-md); border-left: 3px solid var(--color-purple);
        ">
          <p style="font-family: var(--font-body); font-size: 0.95rem; font-style: italic; color: var(--color-text-primary); margin: 0; line-height: 1.5;">
            "${prompt}"
          </p>
        </div>

        <!-- Response Textarea -->
        <textarea id="sparc-response" rows="6" placeholder="Type your response here..." style="
          width: 100%; border: 1px solid var(--color-border); border-radius: var(--radius-md);
          padding: var(--space-sm) var(--space-md); font-family: var(--font-body); font-size: 0.92rem;
          background: var(--color-eggshell); color: var(--color-text-primary); outline: none; resize: none;
          line-height: 1.5;
        "></textarea>

        <!-- Action Row -->
        <div style="display: flex; gap: var(--space-sm); margin-top: var(--space-md);">
          <!-- Voice Button -->
          <button id="sparc-mic-btn" style="
            width: 44px; height: 44px; border-radius: 50%; border: 1.5px solid var(--color-border);
            background: var(--color-eggshell); cursor: pointer; display: flex; align-items: center; justify-content: center;
            transition: all 0.2s ease; flex-shrink: 0;
          " title="Voice-to-text">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>

          <!-- Image Upload -->
          <button id="sparc-upload-btn" style="
            width: 44px; height: 44px; border-radius: 50%; border: 1.5px solid var(--color-border);
            background: var(--color-eggshell); cursor: pointer; display: flex; align-items: center; justify-content: center;
            transition: all 0.2s ease; flex-shrink: 0;
          " title="Upload media">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
          <input type="file" id="sparc-file-input" accept="image/*" hidden>

          <!-- Spacer -->
          <div style="flex: 1;"></div>

          <div id="sparc-status" style="font-size: 0.78rem; color: var(--color-text-muted); align-self: center;"></div>
        </div>

        <!-- Media Preview -->
        <div id="sparc-media-preview" style="display: none; margin-top: var(--space-md); position: relative;">
          <img id="sparc-media-img" style="width: 100%; border-radius: var(--radius-md); object-fit: cover; max-height: 200px;" alt="Uploaded media">
          <button id="sparc-remove-media" style="
            position: absolute; top: 8px; right: 8px; width: 28px; height: 28px;
            border-radius: 50%; background: rgba(0,0,0,0.5); border: none; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Submit Button -->
      <div class="slide-up stagger-3">
        <button id="sparc-submit-btn" class="btn btn--primary" style="
          width: 100%; padding: var(--space-md); font-size: 1rem; font-weight: 700;
        ">
          Submit & Continue →
        </button>
      </div>

    </div>
  `;
}

let uploadedMediaUrl: string | null = null;

export function init(): void {
  const textarea = document.getElementById('sparc-response') as HTMLTextAreaElement;

  // Voice-to-text
  const micBtn = document.getElementById('sparc-mic-btn');
  const statusEl = document.getElementById('sparc-status');
  if (micBtn) {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      micBtn.addEventListener('click', () => {
        if (isRecording && recognition) {
          recognition.stop();
          isRecording = false;
          micBtn.style.background = 'var(--color-eggshell)';
          micBtn.style.borderColor = 'var(--color-border)';
          if (statusEl) statusEl.textContent = '';
          return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (textarea) textarea.value = transcript;
        };

        recognition.onend = () => {
          isRecording = false;
          micBtn.style.background = 'var(--color-eggshell)';
          micBtn.style.borderColor = 'var(--color-border)';
          if (statusEl) statusEl.textContent = '';
        };

        recognition.start();
        isRecording = true;
        micBtn.style.background = 'rgba(239,68,68,0.1)';
        micBtn.style.borderColor = 'var(--color-red)';
        if (statusEl) statusEl.textContent = '🔴 Listening...';
      });
    } else {
      micBtn.style.opacity = '0.3';
      micBtn.style.cursor = 'not-allowed';
      micBtn.title = 'Voice input not supported in this browser';
    }
  }

  // Image Upload
  const uploadBtn = document.getElementById('sparc-upload-btn');
  const fileInput = document.getElementById('sparc-file-input') as HTMLInputElement;
  const mediaPreview = document.getElementById('sparc-media-preview');
  const mediaImg = document.getElementById('sparc-media-img') as HTMLImageElement;

  uploadBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedMediaUrl = e.target?.result as string;
      if (mediaImg) mediaImg.src = uploadedMediaUrl;
      if (mediaPreview) mediaPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('sparc-remove-media')?.addEventListener('click', () => {
    uploadedMediaUrl = null;
    if (mediaPreview) mediaPreview.style.display = 'none';
  });

  // Submit
  const submitBtn = document.getElementById('sparc-submit-btn');
  submitBtn?.addEventListener('click', async () => {
    const content = textarea?.value?.trim() || '';
    if (!content && !uploadedMediaUrl) {
      alert('Please share your response before continuing.');
      return;
    }

    submitBtn.textContent = 'Saving...';
    (submitBtn as HTMLButtonElement).disabled = true;

    try {
      const userId = getUserId();
      if (userId && currentSquadId) {
        await supabase.from('sparc_responses').insert({
          squad_id: currentSquadId,
          user_id: userId,
          chapter_index: currentChapterIndex,
          prompt_type: currentPromptType,
          content,
          media_url: uploadedMediaUrl,
        });
      }
    } catch (err) {
      console.error('Error saving SPARC response:', err);
    }

    // Reset
    uploadedMediaUrl = null;
    if (recognition) { recognition.stop(); recognition = null; }
    isRecording = false;

    // Navigate to next chapter or back to story
    navigate('explore');
  });
}
