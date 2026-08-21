import { supabase } from '../lib/supabase.ts';
import { navigate } from '../router.ts';
import { loadUserData } from '../lib/db.ts';

export function render(): string {
  return `
    <div class="auth-page fade-in">
      <div class="auth-card">
        <button class="auth-close-btn" id="auth-close-btn" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div class="auth-logo">
          <img src="/logo.jpg" alt="DRiVE" style="width:64px; height:64px; border-radius:50%; object-fit:cover;">
          <span style="font-family:var(--font-heading); font-size:1.5rem; font-weight:700; margin-top:8px; letter-spacing:1px;">DRiVE</span>
        </div>
        
        <div class="auth-tabs" data-active="login">
          <button type="button" class="auth-tab auth-tab--active" data-tab="login">Login</button>
          <button type="button" class="auth-tab" data-tab="signup">Sign Up</button>
        </div>

        <div id="auth-error" class="auth-error"></div>
        <div id="auth-success" class="auth-success"></div>

        <form id="auth-form">
          <div class="auth-form-group" id="username-group" style="display: none;">
            <label for="username">Username</label>
            <input type="text" id="username" class="auth-input" placeholder="Enter your display name">
          </div>

          <div class="auth-form-group">
            <label for="email">Email</label>
            <input type="email" id="email" class="auth-input" placeholder="you@example.com" required>
          </div>

          <div class="auth-form-group" style="position:relative;">
            <label for="password">Password</label>
            <input type="password" id="password" class="auth-input" placeholder="••••••••" required style="padding-right:44px;">
            <button type="button" class="auth-eye-btn" id="toggle-password" aria-label="Show password">
              <svg id="eye-open" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <svg id="eye-closed" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>

          <div class="auth-form-group" id="confirm-password-group" style="display:none; position:relative;">
            <label for="confirm-password">Confirm Password</label>
            <input type="password" id="confirm-password" class="auth-input" placeholder="••••••••" style="padding-right:44px;">
            <button type="button" class="auth-eye-btn" id="toggle-confirm-password" aria-label="Show password">
              <svg id="confirm-eye-open" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <svg id="confirm-eye-closed" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>

          <button type="submit" id="submit-btn" class="auth-btn">Sign In</button>
        </form>

        <a class="auth-link" id="forgot-password">Forgot password?</a>
      </div>
    </div>
  `;
}

export function init(): void {
  const tabs = document.querySelectorAll('.auth-tab');
  const tabsContainer = document.querySelector('.auth-tabs');
  const form = document.getElementById('auth-form') as HTMLFormElement;
  const usernameGroup = document.getElementById('username-group');
  const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
  const forgotPasswordLink = document.getElementById('forgot-password');
  const errorEl = document.getElementById('auth-error');
  const successEl = document.getElementById('auth-success');
  const usernameInput = document.getElementById('username') as HTMLInputElement;
  const emailInput = document.getElementById('email') as HTMLInputElement;
  const passwordInput = document.getElementById('password') as HTMLInputElement;
  const confirmPasswordInput = document.getElementById('confirm-password') as HTMLInputElement;
  const confirmPasswordGroup = document.getElementById('confirm-password-group');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const toggleConfirmPasswordBtn = document.getElementById('toggle-confirm-password');
  const closeBtn = document.getElementById('auth-close-btn');

  let isLogin = true;

  function showError(msg: string) {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    }
    if (successEl) successEl.style.display = 'none';
  }

  function showSuccess(msg: string) {
    if (successEl) {
      successEl.textContent = msg;
      successEl.style.display = 'block';
    }
    if (errorEl) errorEl.style.display = 'none';
  }

  function clearMessages() {
    if (errorEl) errorEl.style.display = 'none';
    if (successEl) successEl.style.display = 'none';
  }

  // Close button → go back to home
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      navigate('home');
    });
  }

  // Password visibility toggle
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const eyeOpen = document.getElementById('eye-open');
      const eyeClosed = document.getElementById('eye-closed');
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        if (eyeOpen) eyeOpen.style.display = 'none';
        if (eyeClosed) eyeClosed.style.display = 'block';
      } else {
        passwordInput.type = 'password';
        if (eyeOpen) eyeOpen.style.display = 'block';
        if (eyeClosed) eyeClosed.style.display = 'none';
      }
    });
  }

  // Confirm password visibility toggle
  if (toggleConfirmPasswordBtn && confirmPasswordInput) {
    toggleConfirmPasswordBtn.addEventListener('click', () => {
      const cEyeOpen = document.getElementById('confirm-eye-open');
      const cEyeClosed = document.getElementById('confirm-eye-closed');
      if (confirmPasswordInput.type === 'password') {
        confirmPasswordInput.type = 'text';
        if (cEyeOpen) cEyeOpen.style.display = 'none';
        if (cEyeClosed) cEyeClosed.style.display = 'block';
      } else {
        confirmPasswordInput.type = 'password';
        if (cEyeOpen) cEyeOpen.style.display = 'block';
        if (cEyeClosed) cEyeClosed.style.display = 'none';
      }
    });
  }

  // Tab switching
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const tabName = target.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('auth-tab--active'));
      target.classList.add('auth-tab--active');
      
      if (tabsContainer) {
        tabsContainer.setAttribute('data-active', tabName || 'login');
        if (tabName === 'signup') {
          (tabsContainer as HTMLElement).style.setProperty('--tab-offset', '100%');
        } else {
          (tabsContainer as HTMLElement).style.setProperty('--tab-offset', '0%');
        }
      }

      isLogin = tabName === 'login';
      
      if (isLogin) {
        if (usernameGroup) usernameGroup.style.display = 'none';
        if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'none';
        if (forgotPasswordLink) forgotPasswordLink.style.display = 'block';
        submitBtn.textContent = 'Sign In';
      } else {
        if (usernameGroup) usernameGroup.style.display = 'block';
        if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'block';
        if (forgotPasswordLink) forgotPasswordLink.style.display = 'none';
        submitBtn.textContent = 'Create Account';
      }
      
      clearMessages();
    });
  });

  // Forgot password
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async (e) => {
      e.preventDefault();
      clearMessages();
      
      const email = emailInput.value.trim();
      if (!email) {
        showError('Please enter your email first to reset your password.');
        return;
      }

      submitBtn.classList.add('auth-btn--loading');
      
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      submitBtn.classList.remove('auth-btn--loading');

      if (error) {
        showError(error.message);
      } else {
        showSuccess('Password reset link sent! Check your email.');
      }
    });
  }

  // Form submit (login or signup)
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMessages();
      
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      
      if (!email || !password) {
        showError('Please fill in all fields.');
        return;
      }

      if (!isLogin && password.length < 6) {
        showError('Password must be at least 6 characters.');
        return;
      }

      if (!isLogin) {
        const confirmPassword = confirmPasswordInput?.value || '';
        if (password !== confirmPassword) {
          showError('Passwords do not match.');
          return;
        }
      }

      submitBtn.classList.add('auth-btn--loading');
      submitBtn.disabled = true;

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        
        submitBtn.classList.remove('auth-btn--loading');
        submitBtn.disabled = false;
        
        if (error) {
          showError(error.message);
        } else {
          await loadUserData();
          // Returning users go to home, not path-select
          navigate('home');
        }
      } else {
        const username = usernameInput.value.trim() || ('User_' + Math.random().toString(36).substring(2, 8));
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username }
          }
        });
        
        submitBtn.classList.remove('auth-btn--loading');
        submitBtn.disabled = false;
        
        if (error) {
          showError(error.message);
        } else {
          if (data.session) {
            await loadUserData();
            navigate('path-select');
          } else {
            // No session = email confirmation required
            // Show waiting UI and poll for verification
            showSuccess('✅ Account created! Verify your email on any device — we\'ll detect it automatically.');

            // Replace the submit button with a waiting indicator
            submitBtn.textContent = 'Waiting for verification...';
            submitBtn.disabled = true;
            submitBtn.classList.add('auth-btn--loading');

            // Poll every 5 seconds: attempt to sign in
            // Once the email is verified, signIn will succeed
            let pollCount = 0;
            const maxPolls = 120; // 10 minutes max
            const pollInterval = setInterval(async () => {
              pollCount++;
              if (pollCount >= maxPolls) {
                clearInterval(pollInterval);
                submitBtn.classList.remove('auth-btn--loading');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Create Account';
                showSuccess('✅ Account created! You can verify your email later and come back to log in.');
                return;
              }

              try {
                const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                if (!signInError) {
                  // Email was verified and sign-in succeeded!
                  clearInterval(pollInterval);
                  await loadUserData();
                  navigate('path-select');
                }
                // If error, email isn't verified yet — keep polling
              } catch {
                // Network error etc — keep polling
              }
            }, 5000);
          }
        }
      }
    });
  }
}
