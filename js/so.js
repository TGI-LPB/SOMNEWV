/**
 * STOCK OPNAME FRONTEND CONTROLLER
 */
const SOController = {
  activeProduct: null,

  renderPage() {
    const activeLocation = localStorage.getItem(CONFIG.ACTIVE_LOCATION_KEY) || 'Belum Dipilih';
    return `
      <div class="space-y-4">
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Scan Barcode / Kode UPC</label>
          <div id="reader" class="overflow-hidden rounded-xl bg-slate-100 hidden border border-dashed border-slate-300"></div>
          
          <div class="flex space-x-2">
            <input type="text" id="barcode-input" placeholder="Masukkan Barcode / Kode UPC..." class="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <button onclick="SOController.toggleScanner()" class="px-3 py-2.5 bg-slate-800 text-white rounded-xl hover:bg-slate-700">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h0a2 2 0 012 2v0a2 2 0 01-2 2h0a2 2 0 01-2-2v0zm0 6a2 2 0 012-2h0a2 2 0 012 2v0a2 2 0 01-2 2h0a2 2 0 01-2-2v0zm12-6a2 2 0 012-2h0a2 2 0 012 2v0a2 2 0 01-2 2h0a2 2 0 01-2-2v0zm0 6a2 2 0 012-2h0a2 2 0 012 2v0a2 2 0 01-2 2h0a2 2 0 01-2-2v0z"/></svg>
            </button>
            <button onclick="SOController.searchProduct()" class="px-4 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-xl hover:bg-indigo-700">Cari</button>
          </div>
        </div>

        <div id="product-card" class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4 hidden">
          <div class="border-b border-slate-100 pb-3">
            <span id="p-dept" class="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md">DEPT</span>
            <h3 id="p-title" class="font-semibold text-base text-slate-800 mt-1">Deskripsi Produk</h3>
            <p id="p-upc" class="text-xs text-slate-400 font-mono">UPC: -</p>
          </div>

          <div class="grid grid-cols-2 gap-3 text-center">
            <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span class="text-[10px] text-slate-400 uppercase font-medium">Qty System</span>
              <p id="p-qty-sys" class="text-lg font-bold text-slate-700">0</p>
            </div>
            <div class="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100">
              <span class="text-[10px] text-indigo-500 uppercase font-medium">Lokasi Aktif</span>
              <p class="text-sm font-semibold text-indigo-700 truncate">${activeLocation}</p>
            </div>
          </div>

          <div class="space-y-2">
            <label class="block text-xs font-medium text-slate-600">Input Qty SO</label>
            <input type="number" id="qty-input" min="0" placeholder="0" class="w-full text-center text-2xl font-bold py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500">
          </div>

          <div class="space-y-2">
            <label class="block text-xs font-medium text-slate-600">Keterangan (Opsional)</label>
            <input type="text" id="note-input" placeholder="Contoh: Barang Display / Rusak" class="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl">
          </div>

          <button onclick="SOController.submitSO('ADD')" class="w-full py-3 bg-indigo-600 text-white font-semibold text-sm rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200">
            Simpan SO (SAVE)
          </button>
        </div>
      </div>
    `;
  },

  async searchProduct() {
    const input = document.getElementById('barcode-input').value.trim();
    if (!input) return UI.showToast('Masukkan barcode terlebih dahulu.', 'warning');

    const activeLoc = localStorage.getItem(CONFIG.ACTIVE_LOCATION_KEY);
    if (!activeLoc) return UI.showToast('Pilih lokasi terlebih dahulu di menu Lokasi!', 'warning');

    const res = await API.request('searchProduct', { query: input, lokasi: activeLoc });
    const productCard = document.getElementById('product-card');

    if (res.success && res.data.found) {
      this.activeProduct = res.data.product;
      document.getElementById('p-dept').textContent = this.activeProduct['Department'] || 'GENERAL';
      document.getElementById('p-title').textContent = this.activeProduct['Deskripsi Produk'];
      document.getElementById('p-upc').textContent = 'UPC: ' + this.activeProduct['Kode UPC'];
      document.getElementById('p-qty-sys').textContent = this.activeProduct.qty_system || 0;
      productCard.classList.remove('hidden');
    } else {
      // UNKNOWN PRODUCT MODAL PROMPT
      UI.showModal(`
        <div class="text-center space-y-3">
          <div class="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">⚠</div>
          <h3 class="font-bold text-base">Produk Tidak Ditemukan</h3>
          <p class="text-xs text-slate-500">Barcode <span class="font-mono font-bold">${input}</span> tidak terdaftar pada Master Data. Lanjutkan sebagai Unknown Product?</p>
          <div class="flex space-x-2 pt-2">
            <button onclick="UI.closeModal()" class="flex-1 py-2 text-xs bg-slate-100 text-slate-600 rounded-xl">Batal</button>
            <button onclick="SOController.proceedUnknown('${input}')" class="flex-1 py-2 text-xs bg-amber-600 text-white rounded-xl">Lanjutkan</button>
          </div>
        </div>
      `);
    }
  },

  proceedUnknown(barcode) {
    UI.closeModal();
    this.activeProduct = {
      'Kode UPC': barcode,
      'Deskripsi Produk': 'UNKNOWN PRODUCT',
      'Department': 'UNKNOWN',
      qty_system: 0
    };
    document.getElementById('p-dept').textContent = 'UNKNOWN';
    document.getElementById('p-title').textContent = 'UNKNOWN PRODUCT';
    document.getElementById('p-upc').textContent = 'UPC: ' + barcode;
    document.getElementById('p-qty-sys').textContent = '0';
    document.getElementById('product-card').classList.remove('hidden');
  },

  async submitSO(operation = 'ADD') {
    const qtyInput = Number(document.getElementById('qty-input').value);
    if (isNaN(qtyInput) || qtyInput < 0) return UI.showToast('Masukkan jumlah Qty yang valid.', 'warning');

    const note = document.getElementById('note-input').value;
    const activeLoc = localStorage.getItem(CONFIG.ACTIVE_LOCATION_KEY);
    const syncId = crypto.randomUUID();

    const payload = {
      sync_id: syncId,
      location_id: activeLoc,
      lokasi: activeLoc,
      barcode: this.activeProduct['Kode UPC'],
      kode_upc: this.activeProduct['Kode UPC'],
      deskripsi_produk: this.activeProduct['Deskripsi Produk'],
      department: this.activeProduct['Department'],
      qty_system: this.activeProduct.qty_system || 0,
      qty_so: qtyInput,
      keterangan: note,
      operation: operation,
      client_created_at: new Date().toISOString(),
      sync_status: navigator.onLine ? 'PENDING' : 'LOCAL'
    };

    if (navigator.onLine) {
      const res = await API.request('saveSO', payload);
      if (res.success) {
        UI.showToast('Data SO berhasil disimpan!', 'success');
      } else {
        await DB.addSyncQueue(payload);
        UI.showToast('Tersimpan offline di perangkat.', 'warning');
      }
    } else {
      await DB.addSyncQueue(payload);
      UI.showToast('Offline mode: Data disimpan di perangkat.', 'warning');
    }

    // Reset Form for next continuous scanning
    document.getElementById('qty-input').value = '';
    document.getElementById('barcode-input').value = '';
    document.getElementById('product-card').classList.add('hidden');
    document.getElementById('barcode-input').focus();
  }
};
