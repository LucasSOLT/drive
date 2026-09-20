import { navigate } from '../router';
import { joinSquadByCode } from '../lib/db';
import { isAuthenticated } from '../lib/auth';

export function render(): string {
  return `
    <div style="max-width: 430px; margin: 0 auto; padding: 2rem 1rem;">
      <h1 style="color: var(--color-text-primary); font-size: 2rem; margin-bottom: 0.5rem; text-align: center;">Find Your Squad</h1>
      <p style="color: var(--color-text-secondary); text-align: center; margin-bottom: 2rem;">Join an existing squad using a room code or invite link</p>
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
        
        <div style="margin-bottom: 1rem;">
          <input type="text" id="lfg-room-code" placeholder="Enter room code (e.g. DRV-ABC)" maxlength="10" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.2); border: 1px solid var(--color-border); border-radius: 4px; color: var(--color-text-primary); margin-bottom: 0.5rem; box-sizing: border-box; font-size: 1rem;" />
          <button id="lfg-join-code-btn" style="width: 100%; padding: 0.75rem; background: var(--color-purple); color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 1rem;">Join</button>
        </div>
        
        <div style="display: flex; align-items: center; margin: 1.5rem 0;">
          <div style="flex-grow: 1; height: 1px; background: var(--color-border);"></div>
          <span style="padding: 0 1rem; color: var(--color-text-secondary); font-size: 0.9rem;">or</span>
          <div style="flex-grow: 1; height: 1px; background: var(--color-border);"></div>
        </div>
        
        <div style="margin-bottom: 0.5rem;">
          <input type="text" id="lfg-invite-link" placeholder="Paste a DRiVE invite link" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.2); border: 1px solid var(--color-border); border-radius: 4px; color: var(--color-text-primary); margin-bottom: 0.5rem; box-sizing: border-box; font-size: 1rem;" />
          <button id="lfg-join-link-btn" style="width: 100%; padding: 0.75rem; background: var(--color-purple); color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 1rem;">Join from Link</button>
        </div>
        
        <div id="lfg-error" style="color: #ff6b6b; margin-top: 1rem; text-align: center; display: none;"></div>
      </div>
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; position: relative; overflow: hidden;">
        <h2 style="color: var(--color-text-primary); font-size: 1.2rem; margin-top: 0; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          🌐 ONLINE MATCHMAKING
        </h2>
        <div style="font-family: monospace; color: var(--color-text-secondary); background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 4px; line-height: 1.5;">
          ┌────────────────────────────────────┐<br>
          │ 🚧 Coming Soon!                    │<br>
          │                                    │<br>
          │ Online matchmaking with readers    │<br>
          │ around the world is in             │<br>
          │ development. For now, share your   │<br>
          │ invite link with friends to form   │<br>
          │ a squad!                           │<br>
          └────────────────────────────────────┘
        </div>
      </div>
      
      <button id="lfg-back-btn" style="background: transparent; color: var(--color-text-secondary); border: none; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 1rem; padding: 0;">
        ← Back to Stories
      </button>
    </div>
  `;
}

export function init(): void {
  const codeInput = document.getElementById('lfg-room-code') as HTMLInputElement;
  const joinCodeBtn = document.getElementById('lfg-join-code-btn') as HTMLButtonElement;
  
  const linkInput = document.getElementById('lfg-invite-link') as HTMLInputElement;
  const joinLinkBtn = document.getElementById('lfg-join-link-btn') as HTMLButtonElement;
  
  const errorContainer = document.getElementById('lfg-error') as HTMLDivElement;
  const backBtn = document.getElementById('lfg-back-btn') as HTMLButtonElement;

  const showError = (msg: string) => {
    errorContainer.textContent = msg;
    errorContainer.style.display = 'block';
  };

  const handleJoin = async (code: string, btn: HTMLButtonElement) => {
    if (!isAuthenticated()) {
      localStorage.setItem('drive_pending_squad_join', code);
      alert('You need an account to join a squad');
      navigate('login');
      return;
    }

    try {
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Joining...';
      
      const result = await joinSquadByCode(code);
      if (result) {
        localStorage.setItem('drive_active_squad_id', result.squadId);
        navigate('squad-lobby/' + result.squadId);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to join squad');
      btn.disabled = false;
      btn.textContent = btn.id === 'lfg-join-code-btn' ? 'Join' : 'Join from Link';
    }
  };

  joinCodeBtn?.addEventListener('click', () => {
    errorContainer.style.display = 'none';
    const code = codeInput.value.trim().toUpperCase();
    if (!code) {
      showError('Please enter a room code');
      return;
    }
    handleJoin(code, joinCodeBtn);
  });

  joinLinkBtn?.addEventListener('click', () => {
    errorContainer.style.display = 'none';
    const link = linkInput.value.trim();
    if (!link) {
      showError('Please enter an invite link');
      return;
    }

    const match = link.match(/squad=([^&]+)/);
    if (!match || !match[1]) {
      showError('Invalid invite link format');
      return;
    }

    const code = match[1].toUpperCase();
    handleJoin(code, joinLinkBtn);
  });

  backBtn?.addEventListener('click', () => {
    navigate('explore');
  });
}
