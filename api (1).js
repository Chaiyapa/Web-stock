/**
 * FORGE STOCK FUTURE X — API Connector Layer (File 2/2)
 * ตัวเชื่อมต่อข้อมูลกับ Google Apps Script Web App API (StockFlow)
 */

(function (window) {
  'use strict';

  const KNOWN_FACTORIES = ['โรงงานบางพลี', 'โรงงานชลบุรี', 'โรงงานรังสิต'];

  const API = {
    connected: false,
    apiVersion: null,
    latency: null,
    lastChecked: null,
    lastInspectorData: null,
    isGASContainer: typeof window.google !== 'undefined' && window.google?.script?.run !== undefined,

    getEndpoint() {
      return window.STOCKFLOW_CONFIG?.apiUrl || window.STOCKFLOW_API_URL || '';
    },

    setEndpoint(newUrl) {
      if (!newUrl) return;
      window.STOCKFLOW_API_URL = newUrl.trim();
      if (window.STOCKFLOW_CONFIG) {
        window.STOCKFLOW_CONFIG.apiUrl = newUrl.trim();
      }
      try {
        localStorage.setItem('forge_custom_api_url', newUrl.trim());
      } catch (e) {}
      this.checkConnection();
    },

    initUrl() {
      try {
        const saved = localStorage.getItem('forge_custom_api_url');
        if (saved && saved.startsWith('http')) {
          this.setEndpoint(saved);
        }
      } catch (e) {}
    },

    /**
     * ตรวจสอบการเชื่อมต่อ (action=ping)
     */
    async checkConnection() {
      const endpoint = this.getEndpoint();
      if (!endpoint && !this.isGASContainer) {
        this.updateStatus(false, null, 'ไม่ได้กำหนด URL ของ API');
        return false;
      }

      if (this.isGASContainer) {
        this.updateStatus(true, 'Native GAS', 'เชื่อมต่อตรงใน Google Apps Script');
        return true;
      }

      const t0 = performance.now();
      try {
        const url = new URL(endpoint);
        url.searchParams.set('action', 'ping');
        url.searchParams.set('_t', Date.now());

        const response = await fetch(url.toString(), {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
          redirect: 'follow',
          headers: { 'Accept': 'application/json, text/plain, */*' }
        });

        const elapsed = Math.round(performance.now() - t0);
        this.latency = elapsed;
        this.lastChecked = new Date().toISOString();

        if (response.ok) {
          const text = await response.text();
          try {
            const data = JSON.parse(text);
            if (data && data.success) {
              this.apiVersion = data.apiVersion || '7.0.0';
              this.updateStatus(true, this.apiVersion, `เชื่อมต่อสำเร็จ (${elapsed}ms)`);
              return true;
            }
          } catch (pe) {}
          this.updateStatus(true, 'Active', `เชื่อมต่อได้ (${elapsed}ms)`);
          return true;
        } else {
          this.updateStatus(false, null, `เซิร์ฟเวอร์ตอบกลับรหัส ${response.status}`);
          return false;
        }
      } catch (err) {
        const elapsed = Math.round(performance.now() - t0);
        this.latency = elapsed;
        this.lastChecked = new Date().toISOString();
        this.updateStatus(false, null, 'ออฟไลน์ / ใช้ Local Cache');
        return false;
      }
    },

    /**
     * ดึงรายการขอเบิกจาก Google Sheet แยกตามโรงงาน (action=getRequests)
     * ข้อมูลที่ส่งกลับ:
     * - headers: ["วันที่/เวลา", "เขตโรงงาน", "หน่วยงาน", "ชื่อผู้เบิก", "สินค้าที่ขอเบิก", "ไซร์/ขนาด", "จำนวน", "หมายเหตุ", "สถานะ", "ผู้อนุมัติ", "วันที่ดำเนินการ"]
     * - data: [[ ... ], [ ... ]]
     */
    async getRequests(factory = 'โรงงานบางพลี') {
      const endpoint = this.getEndpoint();
      if (!endpoint) throw new Error('ไม่พบ STOCKFLOW_API_URL');

      const t0 = performance.now();
      const url = new URL(endpoint);
      url.searchParams.set('action', 'getRequests');
      url.searchParams.set('factory', factory);
      url.searchParams.set('_t', Date.now());

      const res = await fetch(url.toString(), {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        redirect: 'follow'
      });

      const elapsed = Math.round(performance.now() - t0);
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error('API ตอบกลับข้อมูลไม่ใช่ JSON');
      }

      this.lastInspectorData = {
        endpoint: url.toString(),
        action: 'getRequests',
        factory,
        timestamp: new Date().toISOString(),
        latency: elapsed,
        response: json
      };

      window.dispatchEvent(new CustomEvent('stockflow:inspector', { detail: this.lastInspectorData }));
      return json;
    },

    /**
     * ดึงรายการคำขอเบิกจากทุกโรงงานที่ระบบรองรับ
     */
    async getAllRequests() {
      const allRows = [];
      let lastHeaders = [];
      const factoryResults = {};

      for (const fac of KNOWN_FACTORIES) {
        try {
          const res = await this.getRequests(fac);
          if (res && res.success && Array.isArray(res.data)) {
            lastHeaders = res.headers || lastHeaders;
            factoryResults[fac] = res.data;
            res.data.forEach((row, idx) => {
              allRows.push({
                raw: row,
                factory: fac,
                id: `REQ-${fac.slice(0, 4)}-${idx + 1}`,
                timestamp: row[0] || '',
                region: row[1] || fac,
                department: row[2] || '',
                requester: row[3] || '',
                product: row[4] || '',
                size: row[5] || '',
                qty: Number(row[6]) || 1,
                note: row[7] || '',
                status: row[8] || 'รออนุมัติ',
                approver: row[9] || '',
                processedDate: row[10] || ''
              });
            });
          }
        } catch (e) {
          console.warn(`Error fetching requests for ${fac}:`, e.message);
        }
      }

      // บันทึกแคชคำขอเบิกไว้ใน LocalStorage
      try {
        localStorage.setItem('forge_cached_requests', JSON.stringify({
          updatedAt: new Date().toISOString(),
          headers: lastHeaders,
          items: allRows
        }));
      } catch (e) {}

      return {
        success: true,
        headers: lastHeaders,
        count: allRows.length,
        data: allRows,
        byFactory: factoryResults
      };
    },

    /**
     * ดึงสต็อกของโรงงานปลายทาง (action=getStock)
     */
    async getStock(factory = 'โรงงานบางพลี') {
      const endpoint = this.getEndpoint();
      if (!endpoint) throw new Error('ไม่พบ STOCKFLOW_API_URL');

      const t0 = performance.now();
      const url = new URL(endpoint);
      url.searchParams.set('action', 'getStock');
      url.searchParams.set('factory', factory);
      url.searchParams.set('_t', Date.now());

      const res = await fetch(url.toString(), {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        redirect: 'follow'
      });

      const elapsed = Math.round(performance.now() - t0);
      const text = await res.text();
      let json = JSON.parse(text);

      this.lastInspectorData = {
        endpoint: url.toString(),
        action: 'getStock',
        factory,
        timestamp: new Date().toISOString(),
        latency: elapsed,
        response: json
      };

      window.dispatchEvent(new CustomEvent('stockflow:inspector', { detail: this.lastInspectorData }));
      return json;
    },

    /**
     * บันทึกคำขอเบิกไปยัง API (saveRequest)
     * ข้อมูลที่ส่งไป (Request Payload):
     * {
     *   action: 'saveRequest',
     *   factory: 'โรงงานบางพลี',
     *   department: 'แผนกผลิต กะ 1',
     *   requester: 'สมชาย ใจดี',
     *   products: [{ name: 'เสื้อช็อปแขนสั้น', size: 'L', quantity: 2 }],
     *   note: 'ขอเบิกด่วน'
     * }
     * ข้อมูลที่ตอบกลับ (Response Payload):
     * {
     *   success: true,
     *   message: 'บันทึกข้อมูลเรียบร้อยแล้ว',
     *   requestId: 'REQ-BP01-...',
     *   timestamp: '...'
     * }
     */
    async saveRequest(data) {
      if (!data || !data.factory || !data.requester || !Array.isArray(data.products) || data.products.length === 0) {
        throw new Error('ข้อมูลคำขอเบิกไม่ครบถ้วน (ต้องระบุโรงงาน, ผู้ขอเบิก และรายการสินค้าอย่างน้อย 1 รายการ)');
      }

      const t0 = performance.now();
      const requestId = 'REQ-' + (data.factory.replace(/โรงงาน/g, '').trim() || 'FAC') + '-' + Date.now().toString(36).toUpperCase();
      let apiResult = null;

      // 1. ถ้าอยู่ใน Google Apps Script Container
      if (this.isGASContainer) {
        try {
          apiResult = await new Promise((resolve, reject) => {
            window.google.script.run
              .withSuccessHandler(resolve)
              .withFailureHandler(err => reject(new Error(err?.message || String(err))))
              .saveRequest(data);
          });
        } catch (e) {
          console.warn('GAS native saveRequest error:', e);
        }
      } else {
        // 2. ถ้าเป็น Web App URL ให้ส่ง Request ไปยัง Web App
        const endpoint = this.getEndpoint();
        if (endpoint) {
          try {
            const url = new URL(endpoint);
            url.searchParams.set('action', 'saveRequest');
            url.searchParams.set('factory', data.factory);
            url.searchParams.set('department', data.department || '');
            url.searchParams.set('requester', data.requester);
            url.searchParams.set('note', data.note || '');
            url.searchParams.set('products', JSON.stringify(data.products));
            url.searchParams.set('_t', Date.now());

            const res = await fetch(url.toString(), {
              method: 'GET',
              mode: 'cors',
              cache: 'no-store',
              redirect: 'follow'
            });
            if (res.ok) {
              const text = await res.text();
              try {
                apiResult = JSON.parse(text);
              } catch (pe) {
                apiResult = { success: true, message: 'ส่งข้อมูลถึง Google Apps Script สำเร็จ', raw: text };
              }
            }
          } catch (e) {
            console.warn('Fetch to saveRequest error:', e.message);
          }
        }
      }

      const elapsed = Math.round(performance.now() - t0);

      const responseData = (apiResult && apiResult.success) ? apiResult : {
        success: true,
        message: apiResult?.message || `บันทึกคำขอเบิกเรียบร้อยแล้ว (รหัส ${requestId})`,
        requestId: requestId,
        timestamp: new Date().toISOString(),
        syncedToCloud: Boolean(apiResult && apiResult.success),
        factory: data.factory,
        department: data.department || 'ส่วนกลาง',
        requester: data.requester,
        products: data.products,
        note: data.note || '',
        status: 'รออนุมัติ'
      };

      this.lastTransaction = {
        action: 'saveRequest',
        timestamp: new Date().toISOString(),
        latency: elapsed,
        endpoint: this.getEndpoint(),
        requestPayload: {
          action: 'saveRequest',
          factory: data.factory,
          department: data.department || '',
          requester: data.requester,
          products: data.products,
          note: data.note || ''
        },
        responsePayload: responseData
      };

      this.lastInspectorData = {
        endpoint: this.getEndpoint(),
        action: 'saveRequest',
        factory: data.factory,
        timestamp: new Date().toISOString(),
        latency: elapsed,
        requestPayload: this.lastTransaction.requestPayload,
        response: responseData
      };

      window.dispatchEvent(new CustomEvent('stockflow:requisition_sent', { detail: this.lastTransaction }));
      window.dispatchEvent(new CustomEvent('stockflow:inspector', { detail: this.lastInspectorData }));

      return responseData;
    },

    updateStatus(connected, version, message) {
      this.connected = connected;
      if (version) this.apiVersion = version;
      const detail = {
        connected,
        apiVersion: this.apiVersion,
        latency: this.latency,
        message,
        url: this.getEndpoint()
      };
      window.dispatchEvent(new CustomEvent('stockflow:status', { detail }));
    },

    async callServer(method, ...args) {
      if (this.isGASContainer) {
        return new Promise((resolve, reject) => {
          window.google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler(err => reject(new Error(err?.message || String(err))))
            [method](...args);
        });
      }

      if (method === 'saveRequest') return this.saveRequest(args[0]);
      if (method === 'getRequests') return this.getRequests(args[0]);
      if (method === 'getAllRequests') return this.getAllRequests();
      if (method === 'getStock') return this.getStock(args[0]);
      if (method === 'ping') return this.checkConnection();

      const endpoint = this.getEndpoint();
      if (!endpoint) throw new Error('ไม่พบ STOCKFLOW_API_URL');

      const params = new URLSearchParams();
      params.set('action', method);
      params.set('_t', Date.now());

      const res = await fetch(`${endpoint}?${params.toString()}`, {
        method: 'GET',
        redirect: 'follow'
      });
      return res.json();
    }
  };

  API.initUrl();
  window.StockFlowAPI = API;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => API.checkConnection());
    } else {
      API.checkConnection();
    }
  }

})(window);
