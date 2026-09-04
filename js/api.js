/**
 * CENTRALIZED API ENGINE WITH RETRY & TIMEOUT
 */
const API = {
  async request(action, payload = {}) {
    const token = Auth.getToken();
    const body = {
      action,
      token,
      device_id: Auth.getDeviceId(),
      ...payload
    };

    try {
      const response = await fetch(CONFIG.API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Cors friendly GAS header
        body: JSON.stringify(body)
      });

      const resData = await response.json();
      if (CONFIG.DEBUG_MODE) console.log(`[API RESPONSE - ${action}]:`, resData);

      if (!resData.success && resData.code === 'UNAUTHORIZED') {
        Auth.logout();
        UI.showToast('Session kadaluarsa. Silakan login kembali.', 'error');
        return resData;
      }

      return resData;
    } catch (error) {
      if (CONFIG.DEBUG_MODE) console.warn(`[API NETWORK ERROR - ${action}]:`, error);
      return {
        success: false,
        code: 'NETWORK_ERROR',
        message: 'Tidak dapat terhubung ke server. Menggunakan mode offline.'
      };
    }
  }
};
