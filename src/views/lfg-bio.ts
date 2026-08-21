import { navigate } from '../router.ts';
import { supabase } from '../lib/supabase.ts';
import { getUserId } from '../lib/auth.ts';
import { runAutoMatch } from '../lib/db.ts';

export function render(): string {
  return `
    <div class="view-lfg-bio fade-in" id="lfg-bio-container" style="padding: var(--space-md); max-width: 430px; margin: 0 auto;">
      
      <div class="section__header slide-up stagger-1" style="text-align: center; margin-bottom: var(--space-lg);">
        <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: var(--color-purple); font-weight: 700;">Matchmaking Pool</span>
        <h1 style="font-family: var(--font-heading); font-size: 1.6rem; font-weight: 700; color: var(--color-text-primary); margin: 4px 0;">Find Your Squad</h1>
        <p class="text-muted" style="font-size: 0.88rem; margin: 0;">Tell us a bit about yourself so we can pair you with compatible players.</p>
      </div>

      <form id="lfg-bio-form" class="slide-up stagger-2" style="
        background: var(--color-surface); border: 1.5px solid var(--color-border);
        border-radius: var(--radius-xl); padding: var(--space-lg); box-shadow: var(--shadow-md);
        display: flex; flex-direction: column; gap: var(--space-md);
      ">

        <!-- 1. Who are you? -->
        <div class="form-group">
          <label style="display: block; font-family: var(--font-heading); font-size: 0.9rem; font-weight: 600; color: var(--color-text-primary); margin-bottom: 6px;">
            Who are you?
          </label>
          <textarea id="lfg-bio-input" maxlength="200" rows="3" placeholder="A brief intro (e.g. Fantasy lover, casual reader, likes sci-fi plot twists...)" style="
            width: 100%; border: 1px solid var(--color-border); border-radius: var(--radius-md);
            padding: var(--space-sm) var(--space-md); font-family: var(--font-body); font-size: 0.9rem;
            background: var(--color-eggshell); color: var(--color-text-primary); outline: none; resize: none;
          "></textarea>
          <div style="text-align: right; font-size: 0.72rem; color: var(--color-text-muted); margin-top: 4px;">
            <span id="lfg-bio-count">0</span>/200
          </div>
        </div>

        <!-- 2. Timezone -->
        <div class="form-group">
          <label style="display: block; font-family: var(--font-heading); font-size: 0.9rem; font-weight: 600; color: var(--color-text-primary); margin-bottom: 6px;">
            Primary Timezone
          </label>
          <select id="lfg-timezone-select" style="
            width: 100%; border: 1px solid var(--color-border); border-radius: var(--radius-md);
            padding: var(--space-sm) var(--space-md); font-family: var(--font-body); font-size: 0.9rem;
            background: var(--color-eggshell); color: var(--color-text-primary); outline: none;
          ">
            <option value="US/Pacific (PST)">US/Pacific (PST/PDT)</option>
            <option value="US/Mountain (MST)">US/Mountain (MST/MDT)</option>
            <option value="US/Central (CST)" selected>US/Central (CST/CDT)</option>
            <option value="US/Eastern (EST)">US/Eastern (EST/EDT)</option>
            <option value="Europe (GMT/CET)">Europe (GMT/CET)</option>
            <option value="Asia/Pacific (JST/AEST)">Asia/Pacific (JST/AEST)</option>
          </select>
        </div>

        <!-- 3. Availability -->
        <div class="form-group">
          <label style="display: block; font-family: var(--font-heading); font-size: 0.9rem; font-weight: 600; color: var(--color-text-primary); margin-bottom: 6px;">
            General Availability
          </label>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--color-text-primary); cursor: pointer;">
              <input type="checkbox" name="lfg-avail" value="Morning" checked style="accent-color: var(--color-purple);"> Morning
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--color-text-primary); cursor: pointer;">
              <input type="checkbox" name="lfg-avail" value="Afternoon" style="accent-color: var(--color-purple);"> Afternoon
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--color-text-primary); cursor: pointer;">
              <input type="checkbox" name="lfg-avail" value="Evening" checked style="accent-color: var(--color-purple);"> Evening
            </label>
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem; color: var(--color-text-primary); cursor: pointer;">
              <input type="checkbox" name="lfg-avail" value="Late Night" style="accent-color: var(--color-purple);"> Late Night
            </label>
          </div>
        </div>

        <!-- Submit Button -->
        <button type="submit" id="lfg-submit-btn" class="btn btn--primary" style="
          width: 100%; padding: var(--space-md); font-size: 1rem; font-weight: 700; margin-top: var(--space-xs);
        ">
          🔍 Enter LFG Queue
        </button>

      </form>

      <div class="slide-up stagger-3" style="text-align: center; margin-top: var(--space-md);">
        <button id="lfg-cancel-btn" class="btn btn--ghost" style="font-size: 0.85rem; color: var(--color-text-muted);">
          Back to Path Selection
        </button>
      </div>

    </div>
  `;
}

export function init(): void {
  const bioInput = document.getElementById('lfg-bio-input') as HTMLTextAreaElement;
  const bioCount = document.getElementById('lfg-bio-count');

  if (bioInput && bioCount) {
    bioInput.addEventListener('input', () => {
      bioCount.textContent = bioInput.value.length.toString();
    });
  }

  const form = document.getElementById('lfg-bio-form') as HTMLFormElement;
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('lfg-submit-btn') as HTMLButtonElement;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Joining Queue...';
      }

      const bio = bioInput?.value.trim() || '';
      const timezone = (document.getElementById('lfg-timezone-select') as HTMLSelectElement)?.value || 'UTC';
      const checkedAvail = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="lfg-avail"]:checked')).map(el => el.value);

      try {
        const userId = getUserId();
        if (userId) {
          await supabase.from('matchmaking_queue').upsert({
            user_id: userId,
            bio,
            timezone,
            availability: checkedAvail.join(', '),
            status: 'searching',
          });
          await runAutoMatch();
        }
        // Direct to squad lobby
        navigate('squad-lobby');
      } catch (err) {
        console.error('Error entering matchmaking queue:', err);
        alert('Failed to join queue. Navigating to lobby...');
        navigate('squad-lobby');
      }
    });
  }

  document.getElementById('lfg-cancel-btn')?.addEventListener('click', () => {
    navigate('path-select');
  });
}
