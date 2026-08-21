// ─── Beta Invite View ───
// Handles the #beta/:token route
// Forces signup OR login, validates token, shows welcome popup, invalidates token

import { supabase } from '../lib/supabase.ts';
import { navigate } from '../router.ts';
import { loadUserData } from '../lib/db.ts';

let _currentToken: string | null = null;

export function render(): string {
  const hash = window.location.hash;
  const parts = hash.replace('#', '').split('/');
  _currentToken = parts[1] || null;

  return `
    <div class="beta-invite-view" id="beta-invite-container">
      <!-- Animated background -->
      <div class="beta-bg">
        <div class="beta-bg__orb beta-bg__orb--1"></div>
        <div class="beta-bg__orb beta-bg__orb--2"></div>
        <div class="beta-bg__orb beta-bg__orb--3"></div>
      </div>

      <!-- Loading state -->
      <div class="beta-loading" id="beta-loading">
        <div class="beta-spinner"></div>
        <p style="color:rgba(255,255,255,0.7); font-size:0.9rem; margin-top:16px;">Validating your invite...</p>
      </div>

      <!-- Invalid token (never existed) -->
      <div class="beta-invalid" id="beta-invalid" style="display:none;">
        <div class="beta-card beta-card--error">
          <div style="font-size:3rem; margin-bottom:16px;">🚫</div>
          <h2 style="font-family:var(--font-heading); font-size:1.4rem; margin:0 0 8px 0; color:white;">Invalid Invite</h2>
          <p style="color:rgba(255,255,255,0.7); font-size:0.9rem; line-height:1.6; margin:0;">
            This beta invite link doesn't exist.
            <br>Contact the Game Master for a valid one.
          </p>
        </div>
      </div>

      <!-- Already claimed state (used token) -->
      <div class="beta-claimed" id="beta-claimed" style="display:none;">
        <div class="beta-card" style="max-width:400px;">
          <img src="/whistling-duck.jpg" alt="Whistling duck" style="width:140px; height:140px; border-radius:50%; object-fit:cover; margin-bottom:16px; border:3px solid rgba(255,255,255,0.1);" />
          <h2 style="font-family:var(--font-heading); font-size:1.3rem; margin:0 0 8px 0; color:white;">Nothing to see here...</h2>
          <p style="color:rgba(255,255,255,0.6); font-size:0.9rem; line-height:1.6; margin:0;">
            This link has already been claimed! 🦆
          </p>
        </div>
      </div>

      <!-- Auth form (signup / login toggle) -->
      <div class="beta-signup" id="beta-signup" style="display:none;">
        <div class="beta-card">
          <div class="beta-card__badge">BETA ACCESS</div>
          <div style="font-size:2.5rem; margin-bottom:8px;">🎮</div>
          <h2 style="font-family:var(--font-heading); font-size:1.3rem; margin:0 0 4px 0; color:white;">You've Been Invited</h2>
          <p class="beta-invite-text">
            The <strong style="color:#c4b5fd;">Game Master</strong> has invited you to join the beta.
            <br>Create a new account or log in with an existing one.
          </p>

          <!-- Mode toggle -->
          <div class="beta-mode-toggle" id="beta-mode-toggle">
            <button class="beta-mode-btn beta-mode-btn--active" data-mode="signup">Sign Up</button>
            <button class="beta-mode-btn" data-mode="login">Log In</button>
          </div>

          <form id="beta-signup-form" autocomplete="off">
            <!-- Username (signup only) -->
            <div class="beta-field" id="beta-username-field">
              <label class="beta-label">Username</label>
              <input type="text" class="beta-input" id="beta-username" placeholder="Your display name" autocomplete="off" />
            </div>
            <div class="beta-field">
              <label class="beta-label">Email</label>
              <input type="email" class="beta-input" id="beta-email" placeholder="you@email.com" required autocomplete="off" />
            </div>
            <div class="beta-field">
              <label class="beta-label">Password</label>
              <input type="password" class="beta-input" id="beta-password" placeholder="Min. 6 characters" required minlength="6" autocomplete="new-password" />
            </div>
            <div class="beta-error" id="beta-error" style="display:none;"></div>
            <button type="submit" class="beta-submit" id="beta-submit">Create Account</button>
          </form>

          <p class="beta-toggle-text" id="beta-toggle-text">
            Already have an account? <button class="beta-toggle-link" id="beta-switch-mode" data-target="login">Log in here</button>
          </p>
        </div>
      </div>

      <!-- Welcome popup (after signup/login) -->
      <div class="beta-welcome-backdrop" id="beta-welcome" style="display:none;">
        <div class="beta-welcome">
          <div class="beta-welcome__glow"></div>
          <div class="beta-welcome__badge">🎯 BETA TESTER</div>
          <h2 class="beta-welcome__title">Welcome, Beta Tester!</h2>
          <div class="beta-welcome__divider"></div>
          <p class="beta-welcome__text">
            The <strong>Game Master</strong> has invited you to create, experience, and test
            <span class="beta-welcome__brand">SOL Theory</span>'s new platform,
            <span class="beta-welcome__brand">DRiVE</span>.
          </p>
          <p class="beta-welcome__sub">
            Click the button below to return to the homescreen and start exploring.
          </p>
          <p class="beta-welcome__cheers">Cheers! 🥂</p>
          <button class="beta-welcome__btn" id="beta-get-started">Get Started</button>
        </div>
      </div>
    </div>
  `;
}

export function init(): void {
  const container = document.getElementById('beta-invite-container');
  if (!container) return;

  const loadingEl = document.getElementById('beta-loading')!;
  const invalidEl = document.getElementById('beta-invalid')!;
  const claimedEl = document.getElementById('beta-claimed')!;
  const signupEl = document.getElementById('beta-signup')!;
  const welcomeEl = document.getElementById('beta-welcome')!;
  const passwordInput = document.getElementById('beta-password') as HTMLInputElement;
  const errorEl = document.getElementById('beta-error')!;
  const submitBtn = document.getElementById('beta-submit') as HTMLButtonElement;

  let isLoginMode = false;

  // Step 1: Validate token — distinguish between "never existed" and "already used"
  checkToken(_currentToken).then(status => {
    loadingEl.style.display = 'none';
    if (status === 'valid') {
      signupEl.style.display = 'flex';
    } else if (status === 'claimed') {
      claimedEl.style.display = 'flex';
    } else {
      invalidEl.style.display = 'flex';
    }
  });

  // ─── Mode switching ───
  const modeToggle = document.getElementById('beta-mode-toggle')!;
  const usernameField = document.getElementById('beta-username-field')!;
  const toggleText = document.getElementById('beta-toggle-text')!;

  function setMode(mode: 'signup' | 'login') {
    isLoginMode = mode === 'login';
    errorEl.style.display = 'none';

    // Update tabs
    modeToggle.querySelectorAll('.beta-mode-btn').forEach(btn => {
      btn.classList.toggle('beta-mode-btn--active', btn.getAttribute('data-mode') === mode);
    });

    // Show/hide username
    usernameField.style.display = isLoginMode ? 'none' : 'block';

    // Update password placeholder
    passwordInput.placeholder = isLoginMode ? 'Your password' : 'Min. 6 characters';

    // Update button
    submitBtn.textContent = isLoginMode ? 'Log In' : 'Create Account';
    submitBtn.disabled = false;

    // Update toggle text
    if (isLoginMode) {
      toggleText.innerHTML = 'Need an account? <button class="beta-toggle-link" id="beta-switch-mode">Sign up here</button>';
    } else {
      toggleText.innerHTML = 'Already have an account? <button class="beta-toggle-link" id="beta-switch-mode">Log in here</button>';
    }

    // Re-bind new switch button
    document.getElementById('beta-switch-mode')?.addEventListener('click', () => {
      setMode(isLoginMode ? 'signup' : 'login');
    });
  }

  // Tab clicks
  modeToggle.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-mode]') as HTMLElement;
    if (!btn) return;
    setMode(btn.getAttribute('data-mode') as 'signup' | 'login');
  });

  // Bottom link
  document.getElementById('beta-switch-mode')?.addEventListener('click', () => setMode('login'));

  // ─── Form submit ───
  const form = document.getElementById('beta-signup-form') as HTMLFormElement;
  const emailInput = document.getElementById('beta-email') as HTMLInputElement;
  const usernameInput = document.getElementById('beta-username') as HTMLInputElement;

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none'; // Clear previous errors on new submission

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Please fill in all fields.');
      return;
    }

    if (!isLoginMode && password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = isLoginMode ? 'Logging in...' : 'Creating account...';

    if (isLoginMode) {
      // ─── LOGIN FLOW ───
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        showError(error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log In';
        return;
      }

      // Check if user already has beta_tester flag
      const userMeta = data.user?.user_metadata;
      if (userMeta?.beta_tester) {
        // Sign them out — this account already has beta
        await supabase.auth.signOut();
        showError('This account ALREADY has beta tester permissions. Please use another account or sign up for a new one.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log In';
        return; // Error stays visible until next submit or mode switch
      }

      // Grant beta_tester flag to existing account
      await supabase.auth.updateUser({
        data: { beta_tester: true }
      });

      await loadUserData();
      showWelcome(signupEl, welcomeEl);

    } else {
      // ─── SIGNUP FLOW ───
      const username = usernameInput.value.trim() || ('BetaTester_' + Math.random().toString(36).substring(2, 8));
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username, beta_tester: true } }
      });

      if (error) {
        showError(error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
        return;
      }

      if (data.session) {
        await loadUserData();
        showWelcome(signupEl, welcomeEl);
        return;
      }

      // Email confirmation required → poll
      submitBtn.textContent = 'Waiting for email verification...';

      const pollInterval = setInterval(async () => {
        try {
          const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (!signInError) {
            clearInterval(pollInterval);
            await loadUserData();
            showWelcome(signupEl, welcomeEl);
          }
        } catch { /* keep polling */ }
      }, 5000);

      setTimeout(() => {
        clearInterval(pollInterval);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
        showError('Verification timed out. Try logging in after verifying your email.');
      }, 600000);
    }
  });

  // ─── "Get Started" → invalidate token and go home ───
  document.getElementById('beta-get-started')?.addEventListener('click', async () => {
    if (_currentToken) {
      await supabase
        .from('beta_invites')
        .update({
          used: true,
          used_by: (await supabase.auth.getUser()).data.user?.email || 'unknown',
          used_at: new Date().toISOString()
        })
        .eq('token', _currentToken);
    }
    navigate('home');
  });

  function showError(msg: string) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }
}

function showWelcome(signupEl: HTMLElement, welcomeEl: HTMLElement): void {
  signupEl.style.display = 'none';
  welcomeEl.style.display = 'flex';
  requestAnimationFrame(() => {
    welcomeEl.querySelector('.beta-welcome')?.classList.add('beta-welcome--visible');
  });
}

async function checkToken(token: string | null): Promise<'valid' | 'claimed' | 'invalid'> {
  if (!token || token.length < 6) return 'invalid';

  try {
    // First check if the token exists at all (regardless of used status)
    const { data: anyMatch, error: anyError } = await supabase
      .from('beta_invites')
      .select('used')
      .eq('token', token)
      .single();

    if (anyError || !anyMatch) return 'invalid'; // Token doesn't exist
    if (anyMatch.used) return 'claimed'; // Token exists but already used
    return 'valid'; // Token exists and is unused
  } catch {
    return 'invalid';
  }
}
