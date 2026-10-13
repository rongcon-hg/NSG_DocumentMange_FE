/**
 * Quản lý bộ nhớ ngoại tuyến (Offline Storage / Caching) cho NSG Office PWA
 * Hỗ trợ lưu trữ danh sách công việc, văn bản quan trọng và danh bạ để tra cứu khi mất Internet.
 */

const STORAGE_KEYS = {
  OFFLINE_TASKS: 'nsg_offline_tasks',
  OFFLINE_DOCS: 'nsg_offline_recent_docs',
  OFFLINE_CONTACTS: 'nsg_offline_contacts',
  LAST_SYNC: 'nsg_offline_last_sync'
};

export const offlineStorage = {
  // Lưu danh sách công việc ngoại tuyến
  saveTasks: (tasks) => {
    try {
      if (Array.isArray(tasks)) {
        localStorage.setItem(STORAGE_KEYS.OFFLINE_TASKS, JSON.stringify(tasks.slice(0, 100)));
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
      }
    } catch (e) {
      console.warn('Lỗi lưu công việc ngoại tuyến:', e);
    }
  },

  // Đọc danh sách công việc ngoại tuyến
  getTasks: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OFFLINE_TASKS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  // Lưu văn bản gần đây
  saveRecentDocs: (docs) => {
    try {
      if (Array.isArray(docs)) {
        localStorage.setItem(STORAGE_KEYS.OFFLINE_DOCS, JSON.stringify(docs.slice(0, 50)));
      }
    } catch (e) {
      console.warn('Lỗi lưu văn bản ngoại tuyến:', e);
    }
  },

  // Lấy văn bản gần đây
  getRecentDocs: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OFFLINE_DOCS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  // Kiểm tra thời gian đồng bộ lần cuối
  getLastSyncTime: () => {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  }
};

export default offlineStorage;
