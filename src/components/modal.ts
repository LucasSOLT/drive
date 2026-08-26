export function renderModalContainer(): string {
  return `<div id="modal-container"></div>`;
}

export function showModal(options: { 
  title: string; 
  content: string; 
  confirmText?: string; 
  cancelText?: string; 
  extraText?: string;
  onConfirm?: () => void; 
  onCancel?: () => void; 
  onExtra?: () => void;
  hideActions?: boolean;
  showCloseBtn?: boolean;
}): void {
  const container = document.getElementById('modal-container');
  if (!container) return;
  
  const showClose = options.showCloseBtn ?? true;

  container.innerHTML = `
    <div class="modal-backdrop open">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">${options.title}</h3>
          ${showClose ? `<button class="modal-close-x" id="modal-close-x" aria-label="Close popup">✕</button>` : ''}
        </div>
        <div class="modal-content">${options.content}</div>
        ${options.hideActions ? '' : `
          <div class="modal-actions">
            ${options.extraText ? `<button class="btn btn--secondary" id="modal-extra-btn">${options.extraText}</button>` : ''}
            ${options.cancelText ? `<button class="btn btn--ghost" id="modal-cancel-btn">${options.cancelText}</button>` : ''}
            ${options.confirmText ? `<button class="btn btn--primary" id="modal-confirm-btn">${options.confirmText}</button>` : ''}
          </div>
        `}
      </div>
    </div>
  `;
  
  const backdrop = container.querySelector('.modal-backdrop');
  const cancelBtn = container.querySelector('#modal-cancel-btn');
  const confirmBtn = container.querySelector('#modal-confirm-btn');
  const extraBtn = container.querySelector('#modal-extra-btn');
  const closeXBtn = container.querySelector('#modal-close-x');
  
  const close = () => {
    if (backdrop) backdrop.classList.remove('open');
    setTimeout(() => {
      container.innerHTML = '';
    }, 300); // Wait for transition
  };

  if (closeXBtn) {
    closeXBtn.addEventListener('click', () => {
      if (options.onCancel) options.onCancel();
      close();
    });
  }
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (options.onCancel) options.onCancel();
      close();
    });
  }
  
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      const prevTitle = container.querySelector('.modal-title')?.textContent;
      if (options.onConfirm) options.onConfirm();
      // Only auto-close if the onConfirm didn't open a new modal
      const newTitle = container.querySelector('.modal-title')?.textContent;
      if (newTitle === prevTitle || !container.querySelector('.modal-backdrop')) {
        close();
      }
    });
  }

  if (extraBtn) {
    extraBtn.addEventListener('click', () => {
      if (options.onExtra) {
        options.onExtra();
      } else {
        close();
      }
    });
  }
}

export function hideModal(): void {
  const container = document.getElementById('modal-container');
  if (!container) return;
  
  const backdrop = container.querySelector('.modal-backdrop');
  if (backdrop) backdrop.classList.remove('open');
  
  setTimeout(() => {
    container.innerHTML = '';
  }, 300);
}
