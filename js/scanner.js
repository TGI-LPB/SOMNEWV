let html5QrCodeEngine = null;

function initScanner() {
  if (html5QrCodeEngine) return;
  
  html5QrCodeEngine = new Html5Qrcode("reader");
  const config = { fps: 10, qrbox: { width: 220, height: 120 } };

  Html5Qrcode.getCameras().then(cameras => {
    if (cameras && cameras.length) {
      const cameraId = cameras[cameras.length - 1].id;
      html5QrCodeEngine.start(
        cameraId, 
        config, 
        (decodedText) => onBarcodeScanned(decodedText),
        () => {}
      );
    }
  }).catch(err => console.error("Camera error:", err));
}

function stopScanner() {
  if (html5QrCodeEngine) {
    html5QrCodeEngine.stop().then(() => {
      html5QrCodeEngine = null;
    }).catch(err => console.error(err));
  }
}
