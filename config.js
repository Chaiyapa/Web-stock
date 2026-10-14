/**
 * FORGE STOCK FUTURE X — API Configuration File (File 1/2)
 * ไฟล์กำหนดค่าการเชื่อมต่อ API ไปยัง Google Apps Script Web App
 */

window.STOCKFLOW_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbzSArZ0mT-QKCDz80jK38W_YcZa4h0h6K79k8SiEuUo9ApuZQNrklE2je_FOmDhkJZitw/exec',
  systemName: 'FORGE STOCK FUTURE X',
  version: '3.0.0',
  apiVersionRequired: '7.0.0',
  timeoutMs: 12000,
  enableAutoPing: true,
  pingIntervalMs: 60000,
  debug: false
};

window.STOCKFLOW_API_URL = window.STOCKFLOW_CONFIG.apiUrl;

console.log('[STOCKFLOW] Config loaded:', window.STOCKFLOW_CONFIG.apiUrl);
