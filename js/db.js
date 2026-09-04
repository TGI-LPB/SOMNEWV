const DB_NAME = "SOMandiriDB";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("master")) {
        db.createObjectStore("master", { keyPath: "Kode UPC" });
      }
      if (!db.objectStoreNames.contains("so_queue")) {
        db.createObjectStore("so_queue", { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("stock_system")) {
        db.createObjectStore("stock_system", { keyPath: "upc" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveMasterToLocal(masterData, stockMap) {
  const db = await openDB();
  const tx = db.transaction(["master", "stock_system"], "readwrite");
  const masterStore = tx.objectStore("master");
  const stockStore = tx.objectStore("stock_system");

  masterData.forEach(item => masterStore.put(item));
  for (let upc in stockMap) {
    stockStore.put({ upc: String(upc), qty: stockMap[upc] });
  }
}

async function searchMasterLocal(code) {
  const db = await openDB();
  const tx = db.transaction("master", "readonly");
  const store = tx.objectStore("master");
  
  return new Promise((resolve) => {
    const req = store.get(code);
    req.onsuccess = () => resolve(req.result || null);
  });
}
