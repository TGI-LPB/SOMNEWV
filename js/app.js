let currentUser = null;
let currentScannedItem = null;
let failedAttempts = 0;
let blockUntil = null;

document.addEventListener("DOMContentLoaded", () => {
  checkSession();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
});

async function execLogin() {
  const usernameInput = document.getElementById("loginUsername").value.trim();
  const passwordInput = document.getElementById("loginPassword").value.trim();

  if (blockUntil && Date.now() < blockUntil) {
    const remMinutes = Math.ceil((blockUntil - Date.now()) / 60000);
    alert(`Akun terblokir! Coba lagi dalam ${remMinutes} menit.`);
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
      
      const sessionData = { user: currentUser, expiry: Date.now() + (12 * 60 * 60 * 1000) };
      localStorage.setItem("som_session", JSON.stringify(sessionData));

      downloadMasterData();
      initAppUI();
    } else {
      failedAttempts++;
      if (failedAttempts >= 6) {
        blockUntil = Date.now() + (10 * 60 * 1000);
        alert("Salah password 6 kali! Akses diblokir selama 10 menit.");
      } else {
        alert(result.message || "Login gagal.");
      }
    }
  } catch (err) {
    alert("Gagal terhubung ke server.");
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
    }
  } catch (err) {}
}

function initAppUI() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("appScreen").classList.remove("hidden");
  document.getElementById("userDisplayName").innerText = currentUser.namaStaff;
  
  const btnAdmin = document.getElementById("btnAdminMenu");
  if (currentUser.role === "admin" && btnAdmin) {
    btnAdmin.classList.remove("hidden");
  }

  switchView("dashboard");
}

function switchView(viewName) {
  const views = ["viewDashboard", "viewSO", "viewAdminUser"];
  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.add("hidden");
  });

  if (viewName === "dashboard") {
    document.getElementById("viewDashboard").classList.remove("hidden");
    stopScanner();
  } else if (viewName === "so") {
    document.getElementById("viewSO").classList.remove("hidden");
    initScanner();
  } else if (viewName === "adminUser") {
    document.getElementById("viewAdminUser").classList.remove("hidden");
    stopScanner();
    loadUserList();
  }
}

async function onBarcodeScanned(barcode) {
  if (!barcode) return;
  const item = await searchMasterLocal(barcode);
  
  if (item) {
    currentScannedItem = item;
    document.getElementById("outDeskripsi").innerText = item["Deskripsi Produk"] || "-";
    document.getElementById("outDept").innerText = item["Department"] || "-";
    document.getElementById("outVendor").innerText = item["Vendor Name"] || "-";
    
    const db = await openDB();
    const tx = db.transaction("stock_system", "readonly");
    const req = tx.objectStore("stock_system").get(barcode);
    req.onsuccess = () => {
      document.getElementById("outQtySys").innerText = req.result ? req.result.qty : "0";
    };
  } else {
    currentScannedItem = {
      "Kode UPC": barcode,
      "Deskripsi Produk": "UNKNOWN",
      "Department": "UNKNOWN",
      "Vendor Code": "-",
      "Vendor Name": "-"
    };
    document.getElementById("outDeskripsi").innerText = "Tidak Terdaftar";
    document.getElementById("outQtySys").innerText = "0";
  }
}

async function saveSOData() {
  const lokasi = document.getElementById("soLokasiInput")?.value.trim();
  const qtyInput = document.getElementById("inputQtySO").value;
  const keterangan = document.getElementById("inputKetSO").value;

  if (!lokasi || !currentScannedItem || !qtyInput) {
    alert("Lengkapi Lokasi, Scan Barcode, dan Qty!");
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

  await queueSOData(payload);
  document.getElementById("inputQtySO").value = "";
  document.getElementById("inputKetSO").value = "";
  document.getElementById("inputBarcodeManual").value = "";
  showToast("Data SO tersimpan!");
}

async function loadUserList() {
  const container = document.getElementById("userListContainer");
  container.innerHTML = `<p class="text-xs text-gray-400 text-center py-2">Memuat...</p>`;

  try {
    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getUsers", payload: { role: currentUser.role } })
    });
    const result = await response.json();
    if (result.success) {
      container.innerHTML = "";
      result.users.forEach(u => {
        const isBlocked = u.status === "BLOCKED";
        const card = document.createElement("div");
        card.className = "flex items-center justify-between p-3 bg-gray-50 rounded-xl text-xs";
        card.innerHTML = `
          <div>
            <p class="font-bold">${u.namaStaff} (@${u.username})</p>
            <p class="text-[10px] text-gray-500">${u.role} | ${u.status}</p>
          </div>
          <div class="flex space-x-1">
            <button onclick="execResetPassword('${u.username}')" class="bg-blue-50 text-blue-600 px-2 py-1 rounded">Reset</button>
            <button onclick="execToggleStatus('${u.username}')" class="bg-red-50 text-red-600 px-2 py-1 rounded">${isBlocked ? 'Unblock' : 'Block'}</button>
          </div>
        `;
        container.appendChild(card);
      });
    }
  } catch (err) {}
}

async function execAddUser() {
  const username = document.getElementById("adminNewUsername").value.trim();
  const namaStaff = document.getElementById("adminNewNama").value.trim();
  const password = document.getElementById("adminNewPassword").value.trim();
  const role = document.getElementById("adminNewRole").value;

  if (!username || !namaStaff || password.length < 6) {
    alert("Isi data dengan benar!");
    return;
  }

  const response = await fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "addUser",
      payload: { adminRole: currentUser.role, adminUsername: currentUser.username, username, namaStaff, password, role }
    })
  });
  const result = await response.json();
  alert(result.message);
  if (result.success) loadUserList();
}

async function execResetPassword(targetUsername) {
  const newPassword = prompt(`Password baru untuk @${targetUsername}:`);
  if (!newPassword || newPassword.length < 6) return;

  const response = await fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "resetPassword",
      payload: { adminRole: currentUser.role, adminUsername: currentUser.username, targetUsername, newPassword }
    })
  });
  const result = await response.json();
  alert(result.message);
}

async function execToggleStatus(targetUsername) {
  const response = await fetch(GAS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "toggleUserStatus",
      payload: { adminRole: currentUser.role, adminUsername: currentUser.username, targetUsername }
    })
  });
  const result = await response.json();
  alert(result.message);
  loadUserList();
}
