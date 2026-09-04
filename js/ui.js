/**
 * UI & MODAL MANAGEMENT MODULE
 */
const UI = {
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const bgColors = {
      success: 'bg-emerald-800 text-white',
      error: 'bg-rose-800 text-white',
      warning: 'bg-amber-800 text-white',
      info: 'bg-slate-800 text-white'
    };

    toast.className = `px-4 py-2.5 rounded-xl text-xs font-medium shadow-xl transition-all transform translate-y-[-10px] opacity-0 pointer-events-auto flex items-center space-x-2 ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `<span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => toast.classList.remove('translate-y-[-10px]', 'opacity-0'), 10);

    setTimeout(() => {
      toast.classList.add('opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  updateSyncBadge(text, colorClasses) {
    const badge = document.getElementById('sync-status-badge');
    if (badge) {
      badge.textContent = text;
      badge.className = `px-2 py-0.5 rounded-full text-[10px] font-medium border ${colorClasses}`;
    }
  },

  showModal(htmlContent) {
    const container = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    content.innerHTML = htmlContent;
    container.classList.remove('hidden');
    setTimeout(() => {
      content.classList.remove('scale-95', 'opacity-0');
    }, 10);
  },

  closeModal() {
    const container = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => container.classList.add('hidden'), 200);
  }
};
