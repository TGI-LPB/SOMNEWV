// ==========================================
// STATE MANAGEMENT & APP INIT
// ==========================================
let currentUser = null;
let currentScannedItem = null;
let failedAttempts = 0;
let blockUntil = null;

document.addEventListener("DOMContentLoaded", () => {
  checkSession();
  registerServiceWorker();
});

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js")
      .then(() => console.log("Service Worker Registered"))
      .catch(err => console.error("SW Reg Failed:", err));
  }
}

// ==========================================
// AUTHENTICATION LOGIC (LOGIN & SECURITY)
// ==========================================
async function execLogin() {
  const usernameInput = document.getElementById("loginUsername").value.trim();
  const passwordInput = document.getElementById("loginPassword").value.trim();

  // Cek jika akun sedang terblokir sementara
  if (blockUntil && Date.now() < blockUntil) {
    const remainingMinutes = Math.ceil((blockUntil - Date.now()) / 60000);
    alert(`Akun terblokir! Coba lagi dalam ${remainingMinutes} menit.`);
    return;
  }

  if (!usernameInput || passwordInput.length < 6) {
    alert("Username dan Password (min 6 karakter) wajib diisi!");
    return;
  }

  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "login",
        payload: { username: usernameInput, password: passwordInput }
      })
    });

    const result = await response.json();

    if (result.success) {
      failedAttempts = 0;
      currentUser = result.user;
      
      // Simpan Sesi Login (Auto Logout 12 Jam)
      const sessionData = {
        user: currentUser,
        expiry: Date.now() + (12 * 60 * 60 * 1000)
      };
      localStorage.setItem("som_session", JSON.stringify(sessionData));

      // Download & Cache Data Master ke IndexedDB
      downloadMasterData();
      
      initAppUI();
    } else {
      handleFailedLogin();
      alert(result.message || "Login gagal.");
    }
  } catch (err) {
    alert("Gagal terhubung ke server. Periksa koneksi internet Anda.");
  }
}

function handleFailedLogin() {
  failedAttempts++;
  if (failedAttempts >= 6) {
    const blockDuration = (failedAttempts / 6) * 10 * 60 * 1000; // 10 menit, 20 menit, dst.
    blockUntil = Date.now() + blockDuration;
    alert(`Salah password 6 kali! Akses diblokir selama ${blockDuration / 60000} menit.`);
  }
}

function checkSession() {
  const sessionRaw = localStorage.getItem("som_session");
  if (sessionRaw) {
    const session = JSON.parse(sessionRaw);
    if (Date.now() < session.expiry) {
      currentUser = session.user;
      initAppUI();
    } else {
      execLogout();
    }
  }
}

function execLogout() {
  localStorage.removeItem("som_session");
  currentUser = null;
  document.getElementById("appScreen").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
}

function togglePasswordVisibility() {
  const pwdInput = document.getElementById("loginPassword");
  pwdInput.type = pwdInput.type === "password" ? "text" : "password";
}

// ==========================================
// MASTER DATA SYNC (BACKGROUND CACHING)
// ==========================================
async function downloadMasterData() {
  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "syncMasterData" })
    });
    const result = await response.json();
    if (result.success) {
      await saveMasterToLocal(result.master, result.stockSystem);
      console.log("Data Master berhasil tersimpan di lokal HP.");
    }
  } catch (err) {
    console.warn("Gagal mengunduh Data Master baru, menggunakan data offline lokal.");
  }
}

// ==========================================
// UI ROUTER & NAVIGATION
// ==========================================
function initAppUI() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
  document.getElementById("userDisplayName").innerText = currentUser.namaStaff;
  
  switchView("dashboard");
}

function switchView(viewName) {
  const views = ["viewDashboard", "viewSO"];
  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.add("hidden");
  });

  if (viewName === "dashboard") {
    document.getElementById("viewDashboard").classList.remove("hidden");
    if (typeof stopScanner === "function") stopScanner();
  } else if (viewName === "so") {
    document.getElementById("viewSO").classList.remove("hidden");
    if (typeof initScanner === "function") initScanner();
  }
}

// ==========================================
// BARCODE LOOKUP & SO PROCESSING
// ==========================================
async function onBarcodeScanned(barcode) {
  if (!barcode) return;
  
  // Cari di IndexedDB Lokal
  const item = await searchMasterLocal(barcode);
  
  if (item) {
    currentScannedItem = item;
    document.getElementById("outDeskripsi").innerText = item["Deskripsi Produk"] || "-";
    document.getElementById("outDept").innerText = item["Department"] || "-";
    document.getElementById("outVendor").innerText = item["Vendor Name"] || "-";
    
    // Ambil Qty System dari lokal
    const db = await openDB();
    const tx = db.transaction("stock_system", "readonly");
    const req = tx.objectStore("stock_system").get(barcode);
    req.onsuccess = () => {
      document.getElementById("outQtySys").innerText = req.result ? req.result.qty : "0";
    };
  } else {
    // Jika tidak terdaftar di Data Master
    currentScannedItem = {
      "Kode UPC": barcode,
      "Deskripsi Produk": "UNKNOWN / UNREGISTERED",
      "Department": "UNKNOWN",
      "Vendor Code": "-",
      "Vendor Name": "-"
    };
    
    document.getElementById("outDeskripsi").innerText = "Barang Tidak Terdaftar!";
    document.getElementById("outDept").innerText = "-";
    document.getElementById("outVendor").innerText = "-";
    document.getElementById("outQtySys").innerText = "0";
    
    alert("Peringatan: Barcode tidak terdaftar di Data Master! Data tetap bisa disimpan sebagai Unknown.");
  }
}

async function saveSOData() {
  const lokasi = document.getElementById("soLokasiSelect")?.value;
  const qtyInput = document.getElementById("inputQtySO").value;
  const keterangan = document.getElementById("inputKetSO").value;

  if (!lokasi) {
    alert("Pilih lokasi terlebih dahulu!");
    return;
  }
  if (!currentScannedItem) {
    alert("Scan barcode barang terlebih dahulu!");
    return;
  }
  if (!qtyInput || parseInt(qtyInput) < 0) {
    alert("Masukkan Qty fisik yang valid!");
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    lokasi: lokasi,
    kodeUPC: currentScannedItem["Kode UPC"],
    deskripsi: currentScannedItem["Deskripsi Produk"],
    department: currentScannedItem["Department"],
    vendorCode: currentScannedItem["Vendor Code"] || "-",
    vendorName: currentScannedItem["Vendor Name"] || "-",
    qtySO: parseInt(qtyInput),
    keterangan: keterangan,
    inputBy: currentUser.username
  };

  // Simpan ke antrean IndexedDB & Auto Sync
  await queueSOData(payload);

  // Reset Form Input
  document.getElementById("inputQtySO").value = "";
  document.getElementById("inputKetSO").value = "";
  document.getElementById("inputBarcodeManual").value = "";
  showToast("Data SO tersimpan!");
}
