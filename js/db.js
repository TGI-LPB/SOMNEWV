/**
 * INDEXEDDB ENGINE FOR OFFLINE STORAGE & QUEUE
 */
const DB = {
  dbName: 'SOM_OfflineDB',
  version: 1,
  db: null,

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'sync_id' });
        }
        if (!db.objectStoreNames.contains('master_cache')) {
          db.createObjectStore('master_cache', { keyPath: 'kode_upc' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => reject(e);
    });
  },

  async addSyncQueue(item) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      store.put(item);
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e);
    });
  },

  async getPendingQueue() {
    return new Promise((resolve) => {
      const tx = this.db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result || [];
        resolve(all.filter(i => i.sync_status === 'PENDING'));
      };
    });
  },

  async updateQueueStatus(sync_id, status) {
    return new Promise((resolve) => {
      const tx = this.db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.get(sync_id);
      req.onsuccess = () => {
        const data = req.result;
        if (data) {
          data.sync_status = status;
          store.put(data);
        }
        resolve(true);
      };
    });
  }
};
