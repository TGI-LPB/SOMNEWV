// ====== WAJIB GANTI DENGAN URL WEB APP ANDA =======
const API_URL = "https://script.google.com/macros/s/AKfycbwAlINdFJEiRZpr13O31gcPV3ygqfSis7JZvPszygiFhKOMJvrJ_Fa0J-PICQNdMSNW/exec";
// ====================================================

const state = { currentUser: null, isOnline: navigator.onLine, html5QrCode: null };
localforage.config({ name: 'SOM_DB' });

// ==========================================
// 1. HELPER: FETCH KE GOOGLE APPS SCRIPT
// ==========================================
// PENTING: Gunakan text/plain untuk menghindari error CORS preflight
async function fetchGAS(payload) {
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        console.error("Fetch Error:", error);
        throw error;
    }
}

// ==========================================
// 2. INITIALIZATION & LOGIN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        state.currentUser = JSON.parse(savedUser);
        showAppScreen();
    }

    // Toggle Password Visibility
    document.getElementById('togglePassword').addEventListener('click', (e) => {
        const pInp = document.getElementById('password');
        pInp.type = pInp.type === 'password' ? 'text' : 'password';
        e.target.innerText = pInp.type === 'password' ? 'Tutup' : 'Lihat';
    });
});

document.getElementById('btnLogin').addEventListener('click', async () => {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    
    if(!user || !pass) return Swal.fire('Error', 'Username dan Password wajib diisi', 'warning');

    Swal.fire({ title: 'Memeriksa...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
        const data = await fetchGAS({ action: 'login', username: user, password: pass });
        
        if (data.status === 'success') {
            localStorage.setItem('user', JSON.stringify(data.data));
            state.currentUser = data.data;
            showAppScreen();
            Swal.close();
        } else {
            Swal.fire('Login Gagal', data.message || 'Username/Password salah', 'error');
        }
    } catch (e) {
        Swal.fire('Error Jaringan', 'Gagal menghubungi server. Pastikan URL API_URL sudah benar.', 'error');
    }
});

function showAppScreen() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
    document.getElementById('userGreetings').innerText = `Halo, ${state.currentUser.nama}`;
    
    // Tampilkan tombol menu Admin jika rolenya Admin
    if(state.currentUser.role.toLowerCase() === 'admin') {
        document.getElementById('tabAdmin').classList.remove('hidden');
        document.getElementById('tabAdmin').classList.add('flex');
    }
    
    switchTab('SO'); // Default tab
    checkOfflineQueue();
}

function logout() {
    localStorage.removeItem('user');
    window.location.reload();
}

// ==========================================
// 3. TAB NAVIGATION SYSTEM
// ==========================================
function switchTab(tabName) {
    // Sembunyikan semua konten view
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    
    // Reset warna icon bawah
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-[#007aff]');
        btn.classList.add('text-gray-400');
    });

    // Tampilkan view yang dipilih
    document.getElementById('view' + tabName).classList.remove('hidden');
    
    // Warnai icon yang aktif
    const activeBtn = document.getElementById('tab' + tabName);
    activeBtn.classList.remove('text-gray-400');
    activeBtn.classList.add('text-[#007aff]');
}

// ==========================================
// 4. SCANNER & MASTER DATA PULL
// ==========================================
document.getElementById('btnScanner').addEventListener('click', () => {
    const reader = document.getElementById('reader');
    const btn = document.getElementById('btnScanner');

    if (!state.html5QrCode) state.html5QrCode = new Html5Qrcode("reader");
    
    if (reader.classList.contains('hidden')) {
        reader.classList.remove('hidden');
        btn.innerText = 'Tutup Kamera';
        
        state.html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 150 } },
            (decodedText) => {
                document.getElementById('inputBarcode').value = decodedText;
                processBarcode(decodedText);
                stopScanner();
            },
            (err) => {} // Abaikan error frame kosong
        ).catch(err => {
            Swal.fire('Kamera Error', 'Gagal mengakses kamera.', 'error');
            stopScanner();
        });
    } else {
        stopScanner();
    }
});

function stopScanner() {
    if (state.html5QrCode && state.html5QrCode.isScanning) {
        state.html5QrCode.stop().then(() => {
            document.getElementById('reader').classList.add('hidden');
            document.getElementById('btnScanner').innerText = 'Kamera';
        });
    }
}

// Tombol cari manual dari input ketikan
document.getElementById('btnCariManual').addEventListener('click', () => {
    const code = document.getElementById('inputBarcode').value;
    if(code) processBarcode(code);
});

async function processBarcode(barcode) {
    if(!state.isOnline) return showUnknownProduct(barcode); 
    
    Swal.fire({ title: 'Mencari...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    
    try {
        const resData = await fetchGAS({ action: 'get_master', barcode: barcode });
        
        document.getElementById('scanResult').classList.remove('hidden');
        if(resData.status === 'success') {
            document.getElementById('resUpc').innerText = resData.data.upc;
            document.getElementById('resDesc').innerText = resData.data.deskripsi;
            Swal.close();
            document.getElementById('inputQty').focus();
        } else {
            showUnknownProduct(barcode);
        }
    } catch(e) { 
        showUnknownProduct(barcode); 
    }
}

function showUnknownProduct(barcode) {
    Swal.close();
    document.getElementById('scanResult').classList.remove('hidden');
    document.getElementById('resUpc').innerText = barcode;
    document.getElementById('resDesc').innerText = "Tidak Ditemukan (Unknown)";
}

// ==========================================
// 5. PENYIMPANAN SO & OFFLINE SYNC
// ==========================================
window.addEventListener('online', () => { state.isOnline = true; updateNetworkUI(); syncData(); });
window.addEventListener('offline', () => { state.isOnline = false; updateNetworkUI(); });

function updateNetworkUI() {
    document.getElementById('networkStatus').className = `w-2 h-2 rounded-full ${state.isOnline ? 'bg-green-500' : 'bg-red-500'}`;
    document.getElementById('networkText').innerText = state.isOnline ? 'Online' : 'Offline Mode';
}

document.getElementById('btnSaveSO').addEventListener('click', async () => {
    const lokasi = document.getElementById('inputLokasi').value.trim();
    const upc = document.getElementById('inputBarcode').value.trim();
    const desc = document.getElementById('resDesc').innerText;
    const qty = document.getElementById('inputQty').value;
    const ket = document.getElementById('inputKet').value;

    if (!lokasi || !upc || !qty) return Swal.fire('Error', 'Lokasi, Barcode, dan Qty wajib diisi!', 'warning');

    const payload = {
        id: 'SO_' + Date.now(),
        timestamp: new Date().toISOString(),
        user: state.currentUser.username,
        lokasi, upc, deskripsi: desc, qty, keterangan: ket
    };

    let queue = await localforage.getItem('so_queue') || [];
    queue.push(payload);
    await localforage.setItem('so_queue', queue);
    
    // Reset Form
    document.getElementById('inputBarcode').value = '';
    document.getElementById('inputQty').value = '';
    document.getElementById('inputKet').value = '';
    document.getElementById('scanResult').classList.add('hidden');
    
    Swal.fire({ title: 'Tersimpan!', toast: true, position: 'top-end', icon: 'success', timer: 1500, showConfirmButton: false });
    
    if (state.isOnline) { syncData(); } else { checkOfflineQueue(); }
});

async function checkOfflineQueue() {
    const queue = await localforage.getItem('so_queue') || [];
    const alert = document.getElementById('offlineQueueAlert');
    if (queue.length > 0) {
        alert.classList.remove('hidden');
        document.getElementById('queueCount').innerText = queue.length;
    } else {
        alert.classList.add('hidden');
    }
}

async function syncData() {
    const queue = await localforage.getItem('so_queue') || [];
    if (queue.length === 0 || !state.isOnline) return;

    document.getElementById('btnSync').innerText = "Syncing...";
    try {
        const resData = await fetchGAS({ action: 'sync_so', payload: queue });
        
        if (resData.status === 'success') {
            await localforage.setItem('so_queue', []);
            checkOfflineQueue();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Data tersinkronisasi', showConfirmButton: false, timer: 3000 });
        }
    } catch(e) {
        console.error("Gagal Sync", e);
    } finally {
        document.getElementById('btnSync').innerText = "Sync";
    }
}
document.getElementById('btnSync').addEventListener('click', syncData);

// ==========================================
// 6. ADMIN FUNCTIONS
// ==========================================
async function submitNewUser() {
    const nama = document.getElementById('addName').value;
    const username = document.getElementById('addUsername').value;
    const password = document.getElementById('addPassword').value;
    const role = document.getElementById('addRole').value;

    if(!nama || !username || !password) return Swal.fire('Error', 'Semua kolom wajib diisi!', 'warning');

    Swal.showLoading();
    try {
        const data = await fetchGAS({ action: 'add_user', payload: { nama, username, password, role } });
        if (data.status === 'success') {
            Swal.fire('Berhasil', data.message, 'success');
            document.getElementById('addName').value = '';
            document.getElementById('addUsername').value = '';
            document.getElementById('addPassword').value = '';
        } else {
            Swal.fire('Gagal', data.message, 'error');
        }
    } catch (e) {
        Swal.fire('Error', 'Gagal memproses ke server.', 'error');
    }
}

async function submitResetPassword() {
    const username = document.getElementById('resetUsername').value;
    const new_password = document.getElementById('resetPasswordInput').value;

    if(!username || !new_password) return Swal.fire('Error', 'Semua kolom wajib diisi!', 'warning');

    Swal.showLoading();
    try {
        const data = await fetchGAS({ action: 'reset_password', payload: { username, new_password } });
        if (data.status === 'success') {
            Swal.fire('Berhasil', data.message, 'success');
            document.getElementById('resetUsername').value = '';
            document.getElementById('resetPasswordInput').value = '';
        } else {
            Swal.fire('Gagal', data.message, 'error');
        }
    } catch (e) {
        Swal.fire('Error', 'Gagal memproses ke server.', 'error');
    }
}
