/**
 * FORGE STOCK FUTURE X — API Configuration File (File 1/2)
 * ไฟล์กำหนดค่าการเชื่อมต่อ API ไปยัง Google Apps Script Web App
 */

// ตรวจสอบและตั้งค่า Global Namespace
window.STOCKFLOW_CONFIG = {
  // Google Apps Script Web App URL ที่ Deploy แล้ว (ลงท้ายด้วย /exec)
  apiUrl: 'https://script.google.com/macros/s/AKfycbzSArZ0mT-QKCDz80jK38W_YcZa4h0h6K79k8SiEuUo9ApuZQNrklE2je_FOmDhkJZitw/exec',
  
  // ข้อมูลระบบ
  systemName: 'FORGE STOCK FUTURE X',
  version: '3.0.0',
  apiVersionRequired: '7.0.0',
  
  // การตั้งค่า Timeout และการเชื่อมต่อ
  timeoutMs: 12000,
  enableAutoPing: true,
  pingIntervalMs: 60000,
  
  // บันทึกสถานะการเชื่อมต่อ
  debug: false
};

// เผยแพร่ URL สู่ Global Window เพื่อความเข้ากันได้
window.STOCKFLOW_API_URL = window.STOCKFLOW_CONFIG.apiUrl;

console.log('[STOCKFLOW] Config loaded:', window.STOCKFLOW_CONFIG.apiUrl);
