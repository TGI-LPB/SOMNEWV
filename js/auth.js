/**
 * AUTHENTICATION MODULE
 */
const Auth = {
  getToken() {
    return localStorage.getItem(CONFIG.SESSION_TOKEN_KEY);
  },

  getDeviceId() {
    let deviceId = localStorage.getItem(CONFIG.DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = 'DEV-' + crypto.randomUUID();
      localStorage.setItem(CONFIG.DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  async login(username, password) {
    const res = await API.request('login', { username, password });
    if (res.success && res.data.token) {
      localStorage.setItem(CONFIG.SESSION_TOKEN_KEY, res.data.token);
      localStorage.setItem('SOM_USER_DATA', JSON.stringify(res.data.user));
    }
    return res;
  },

  logout() {
    localStorage.removeItem(CONFIG.SESSION_TOKEN_KEY);
    localStorage.removeItem('SOM_USER_DATA');
    window.location.reload();
  }
};
