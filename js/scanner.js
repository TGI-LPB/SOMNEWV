let html5QrCodeEngine = null;

function initScanner() {
  html5QrCodeEngine = new Html5Qrcode("reader");
  const config = { fps: 10, qrbox: { width: 250, height: 150 } };

  Html5Qrcode.getCameras().then(cameras => {
    if (cameras && cameras.length) {
      const cameraId = cameras[cameras.length - 1].id; // Gunakan kamera belakang
      html5QrCodeEngine.start(
        cameraId, 
        config, 
        (decodedText) => onBarcodeScanned(decodedText),
        (errorMessage) => { /* handling silent frame scan error */ }
      );
    }
  }).catch(err => console.error("Camera access failed", err));
}

function toggleTorch() {
  if (html5QrCodeEngine) {
    // Torch handling logic
  }
}
