/**
 * MAIN APP CONTROLLER & ROUTER
 */
const Router = {
  routes: {
    'so': SOController,
    'location': {
      renderPage: () => `
        <div class="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
          <h3 class="font-bold text-sm text-slate-700">Pilih / Tambah Lokasi Aktif</h3>
          <input type="text" id="new-loc-input" placeholder="Nama Lokasi Baru..." class="w-full px-3 py-2 text-xs border rounded-xl">
          <button onclick="Router.addLocation()" class="w-full py-2 bg-slate-800 text-white text-xs rounded-xl font-medium">Tambah Lokasi</button>
        </div>
      `
    }
  },

  navigate(pageKey) {
    const viewport = document.getElementById('app-viewport');
    const controller = this.routes[pageKey];
    if (controller) {
      viewport.innerHTML = controller.renderPage();
    }
  },

  async addLocation() {
    const input = document.getElementById('new-loc-input').value.trim();
    if (!input) return;
    localStorage.setItem(CONFIG.ACTIVE_LOCATION_KEY, input);
    document.getElementById('active-location-display').textContent = 'Lokasi: ' + input;
    UI.showToast(`Lokasi aktif diubah ke: ${input}`, 'success');
    this.navigate('so');
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  await DB.init();
  SyncEngine.init();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }

  // Load Initial View
  Router.navigate('so');
});
