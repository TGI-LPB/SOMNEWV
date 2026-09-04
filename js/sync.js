/**
 * BACKGROUND SYNC ENGINE (IDEMPOTENT QUEUE)
 */
const SyncEngine = {
  isSyncing: false,

  init() {
    window.addEventListener('online', () => this.processQueue());
    setInterval(() => this.processQueue(), 30000); // Poll sync every 30s
  },

  async processQueue() {
    if (!navigator.onLine || this.isSyncing) return;
    this.isSyncing = true;

    try {
      const pendingItems = await DB.getPendingQueue();
      if (pendingItems.length === 0) {
        UI.updateSyncBadge('ONLINE', 'bg-emerald-500/20 text-emerald-400');
        this.isSyncing = false;
        return;
      }

      UI.updateSyncBadge(`SYNCING (${pendingItems.length})`, 'bg-amber-500/20 text-amber-400');

      for (const item of pendingItems) {
        const res = await API.request('saveSO', item);
        if (res.success || res.code === 'SO_SYNC_DUPLICATE') {
          await DB.updateQueueStatus(item.sync_id, 'SYNCED');
        } else if (res.code !== 'NETWORK_ERROR') {
          await DB.updateQueueStatus(item.sync_id, 'FAILED');
        }
      }

      UI.showToast('Sinkronisasi data berhasil!', 'success');
      UI.updateSyncBadge('ONLINE', 'bg-emerald-500/20 text-emerald-400');
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      this.isSyncing = false;
    }
  }
};
