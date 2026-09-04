// ==========================================
// OFFLINE QUEUE & AUTO-SYNC ENGINE
// ==========================================

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyKTM6KanSJhQn01emHnoDny1btCpZTVInaQs3YgfDd27TMDG9aDLLIkCIFnMssosJ6hQ/exec"; // Ganti dengan URL Deploy GAS Anda

// Masukkan data SO ke antrean offline IndexedDB
async function queueSOData(soData) {
  const db = await openDB();
  const tx = db.transaction("so_queue", "readwrite");
  const store = tx.objectStore("so_queue");
  
  // Berikan ID unik sementara untuk antrean lokal
  soData.localId = Date.now() + "_" + Math.random().toString(36).substr(2, 5);
  soData.syncStatus = "PENDING";
  
  await store.add(soData);
  
  // Jika jaringan online, langsung picu sinkronisasi
  if (navigator.onLine) {
    triggerAutoSync();
  }
}

// Proses sinkronisasi data dari IndexedDB ke Google Sheets
async function triggerAutoSync() {
  if (!navigator.onLine) return;

  const db = await openDB();
  const tx = db.transaction("so_queue", "readonly");
  const store = tx.objectStore("so_queue");
  const pendingItems = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });

  if (!pendingItems || pendingItems.length === 0) return;

  updateSyncUI("SYNCING", pendingItems.length);

  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "saveSOBatch",
        payload: pendingItems
      })
    });

    const result = await response.json();

    if (result.success) {
      // Hapus data yang berhasil di-sync dari antrean IndexedDB
      const clearTx = db.transaction("so_queue", "readwrite");
      const clearStore = clearTx.objectStore("so_queue");
      await clearStore.clear();

      updateSyncUI("ONLINE", 0);
      showToast(`${result.count} data berhasil terupload!`);
    } else {
      updateSyncUI("ERROR", pendingItems.length);
    }
  } catch (err) {
    console.error("Auto Sync Failed:", err);
    updateSyncUI("OFFLINE", pendingItems.length);
  }
}

// Pemantau Status Koneksi Internet
window.addEventListener("online", () => {
  updateSyncUI("ONLINE", 0);
  triggerAutoSync();
});

window.addEventListener("offline", () => {
  updateSyncUI("OFFLINE", 0);
});

function updateSyncUI(status, count = 0) {
  const netBadge = document.getElementById("networkStatus");
  const netText = document.getElementById("networkText");

  if (!netBadge || !netText) return;

  if (status === "ONLINE") {
    netBadge.className = "flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700";
    netText.innerText = "ONLINE";
  } else if (status === "SYNCING") {
    netBadge.className = "flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700 animate-pulse";
    netText.innerText = `UPLOADING (${count})`;
  } else {
    netBadge.className = "flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-200 text-gray-600";
    netText.innerText = count > 0 ? `OFFLINE (${count} Pending)` : "OFFLINE";
  }
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "fixed top-5 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-4 py-2.5 rounded-full backdrop-blur-md z-50 shadow-lg";
  toast.innerText = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
