// GANTI DENGAN URL WEB APP DARI GOOGLE APPS SCRIPT ANDA
const API_URL = "https://script.google.com/macros/s/AKfycbzR2B4sdR0VbZlk5W9x-4xAPpHjqDFtg_t93Wgpwwclw5fWvCh20DArBF2jz_jarCHq9w/exec";

// State Management & DB Lokal
const state = { currentUser: null, isOnline: navigator.onLine, html5QrCode: null };
localforage.config({ name: 'SOM_DB' });

// UI Binders
const UI = {
    loginScreen: document.getElementById('loginScreen'),
    appScreen: document.getElementById('appScreen'),
    btnScanner: document.getElementById('btnScanner'),
    reader: document.getElementById('reader')
};

// 1. SYSTEM INITIALIZATION & LOGIN
document.addEventListener("DOMContentLoaded", async () => {
    // Check Auto Logout (12 Hours)
    const loginTime = localStorage.getItem('loginTime');
    if (loginTime && (Date.now() - parseInt(loginTime)) > 43200000) logout();

    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        state.currentUser = JSON.parse(savedUser);
        showAppScreen();
    }

    // Toggle Password View
    document.getElementById('togglePassword').addEventListener('click', (e) => {
        const pInp = document.getElementById('password');
        pInp.type = pInp.type === 'password' ? 'text' : 'password';
        e.target.innerText = pInp.type === 'password' ? 'Lihat' : 'Tutup';
    });
});

document.getElementById('btnLogin').addEventListener('click', async () => {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    
    // Rate Limiting Logic (Lockout 10 Mins)
    const attempts = parseInt(localStorage.getItem(`att_${user}`) || 0);
    const lockTime = parseInt(localStorage.getItem(`lock_${user}`) || 0);
    if (Date.now() < lockTime) {
        let mins = Math.ceil((lockTime - Date.now()) / 60000);
        return Swal.fire('Terkunci!', `Akun diblokir sementara. Coba ${mins} menit lagi.`, 'error');
    }

    Swal.showLoading();
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', username: user, password: pass })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            localStorage.setItem('user', JSON.stringify(data.data));
            localStorage.setItem('loginTime', Date.now().toString());
            localStorage.removeItem(`att_${user}`);
            state.currentUser = data.data;
            showAppScreen();
            Swal.close();
        } else {
            handleFailedLogin(user, attempts);
            Swal.fire('Gagal', data.message, 'error');
        }
    } catch (e) {
        Swal.fire('Error Jaringan', 'Pastikan koneksi internet stabil saat login.', 'warning');
    }
});

function handleFailedLogin(user, attempts) {
    attempts += 1;
    localStorage.setItem(`att_${user}`, attempts);
    if (attempts >= 6) {
        let penalty = 10 * 60000 * Math.floor(attempts / 6); // Kelipatan 10 menit
        localStorage.setItem(`lock_${user}`, Date.now() + penalty);
    }
}

function showAppScreen() {
    UI.loginScreen.classList.add('hidden');
    UI.appScreen.classList.remove('hidden');
    document.getElementById('userGreetings').innerText = `Halo, ${state.currentUser.nama}`;
    checkOfflineQueue();
}

function logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('loginTime');
    window.location.reload();
}

// 2. SCANNER (HTML5 QRCODE)
UI.btnScanner.addEventListener('click', () => {
    if (!state.html5QrCode) state.html5QrCode = new Html5Qrcode("reader");
    
    if (UI.reader.classList.contains('hidden')) {
        UI.reader.classList.remove('hidden');
        UI.btnScanner.innerText = 'Tutup Kamera';
        state.html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 150 }, formatsToSupport: [ Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.CODE_128 ] },
            (decodedText) => {
                document.getElementById('inputBarcode').value = decodedText;
                beep();
                fetchProductMaster(decodedText);
                stopScanner();
            },
            (errorMessage) => { /* Ignore feed errors */ }
        ).catch(err => {
            Swal.fire('Kamera Error', 'Izin kamera ditolak atau perangkat tidak didukung.', 'error');
        });
    } else {
        stopScanner();
    }
});

function stopScanner() {
    if (state.html5QrCode && state.html5QrCode.isScanning) {
        state.html5QrCode.stop().then(() => {
            UI.reader.classList.add('hidden');
            UI.btnScanner.innerText = 'Buka Kamera';
        });
    }
}

async function fetchProductMaster(barcode) {
    if(!state.isOnline) return showUnknownProduct(barcode); // Jika offline, bypass ke unknown
    
    Swal.showLoading();
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'get_master', barcode: barcode }) });
        const resData = await res.json();
        
        document.getElementById('scanResult').classList.remove('hidden');
        if(resData.status === 'success') {
            document.getElementById('resUpc').innerText = resData.data.upc;
            document.getElementById('resDesc').innerText = resData.data.deskripsi;
            Swal.close();
            document.getElementById('inputQty').focus();
        } else {
            showUnknownProduct(barcode);
        }
    } catch(e) { showUnknownProduct(barcode); }
}

function showUnknownProduct(barcode) {
    document.getElementById('scanResult').classList.remove('hidden');
    document.getElementById('resUpc').innerText = barcode;
    document.getElementById('resDesc').innerText = "Data Unknown / Tidak Ditemukan";
    
    Swal.fire({
        title: 'Data Tidak Terdaftar',
        text: "Apakah kamu ingin lanjut mencatat? Pastikan barcode benar atau hubungi admin.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#007aff',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Lanjutkan (Unknown)'
    });
}

function beep() {
    let ctx = new (window.AudioContext || window.webkitAudioContext)();
    let osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 800;
    osc.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.1);
}

// 3. OFFLINE CAPABILITY & SYNC
window.addEventListener('online', () => { state.isOnline = true; updateNetworkUI(); syncData(); });
window.addEventListener('offline', () => { state.isOnline = false; updateNetworkUI(); });

function updateNetworkUI() {
    document.getElementById('networkStatus').className = `w-2 h-2 rounded-full ${state.isOnline ? 'bg-green-500' : 'bg-red-500'}`;
    document.getElementById('networkText').innerText = state.isOnline ? 'Online' : 'Offline Mode';
}

document.getElementById('btnSaveSO').addEventListener('click', async () => {
    const lokasi = document.getElementById('inputLokasi').value;
    const upc = document.getElementById('inputBarcode').value;
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

    // Validasi Duplikat di Local Array
    let queue = await localforage.getItem('so_queue') || [];
    const isDuplicate = queue.find(q => q.upc === upc && q.lokasi === lokasi);
    
    if (isDuplicate) {
        Swal.fire({
            title: 'Barcode Sudah Ada di Lokasi Ini',
            text: "Data ini sudah pernah Anda scan di lokasi yang sama. Pilih tindakan:",
            icon: 'question',
            showDenyButton: true,
            showCancelButton: true,
            confirmButtonText: 'Tambahkan (Add)',
            denyButtonText: 'Timpa (Replace)',
            cancelButtonText: 'Batal'
        }).then(async (result) => {
            if (result.isConfirmed) { // Add
                payload.qty = (parseInt(isDuplicate.qty) + parseInt(qty)).toString();
                queue = queue.filter(q => q.id !== isDuplicate.id); // Hapus yg lama
                queue.push(payload);
            } else if (result.isDenied) { // Replace
                queue = queue.filter(q => q.id !== isDuplicate.id);
                queue.push(payload);
            } else { return; } // Cancel
            
            await localforage.setItem('so_queue', queue);
            finishSaveUI();
        });
    } else {
        queue.push(payload);
        await localforage.setItem('so_queue', queue);
        finishSaveUI();
    }
});

async function finishSaveUI() {
    // Reset Form (Kecuali Lokasi sesuai instruksi)
    document.getElementById('inputBarcode').value = '';
    document.getElementById('inputQty').value = '';
    document.getElementById('inputKet').value = '';
    document.getElementById('scanResult').classList.add('hidden');
    
    Swal.fire({ title: 'Tersimpan!', text: 'Data disave ke penyimpanan lokal/sistem.', icon: 'success', timer: 1500, showConfirmButton: false });
    
    if (state.isOnline) { syncData(); } else { checkOfflineQueue(); }
}

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
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'sync_so', payload: queue })
        });
        const resData = await res.json();
        
        if (resData.status === 'success') {
            await localforage.setItem('so_queue', []);
            checkOfflineQueue();
            Swal.fire({
                toast: true, position: 'top-end', icon: 'success',
                title: 'Data berhasil disinkronisasi ke Cloud.',
                showConfirmButton: false, timer: 3000
            });
        }
    } catch(e) {
        console.error("Gagal Sync", e);
    } finally {
        document.getElementById('btnSync').innerText = "Sync Sekarang";
    }
}
document.getElementById('btnSync').addEventListener('click', syncData);
