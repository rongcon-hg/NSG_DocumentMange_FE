import axiosInstance from './axiosInstance';

// Lấy danh sách menu liên kết
export const getExternalMenusApi = async (all = false) => {
  try {
    const response = await axiosInstance.get(`/api/external-menus${all ? '?all=true' : ''}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching external menus:', error);
    throw error.response?.data?.message || 'Lỗi khi tải danh sách menu liên kết!';
  }
};

// Tạo menu liên kết mới (Admin)
export const createExternalMenuApi = async (data) => {
  try {
    const response = await axiosInstance.post('/api/external-menus', data);
    return response.data;
  } catch (error) {
    console.error('Error creating external menu:', error);
    throw error.response?.data?.message || 'Lỗi khi tạo menu liên kết!';
  }
};

// Cập nhật menu liên kết (Admin)
export const updateExternalMenuApi = async (id, data) => {
  try {
    const response = await axiosInstance.put(`/api/external-menus/${id}`, data);
    return response.data;
  } catch (error) {
    console.error('Error updating external menu:', error);
    throw error.response?.data?.message || 'Lỗi khi cập nhật menu liên kết!';
  }
};

// Bật/tắt trạng thái menu (Admin)
export const toggleExternalMenuStatusApi = async (id) => {
  try {
    const response = await axiosInstance.patch(`/api/external-menus/${id}/toggle-status`);
    return response.data;
  } catch (error) {
    console.error('Error toggling external menu status:', error);
    throw error.response?.data?.message || 'Lỗi khi thay đổi trạng thái menu!';
  }
};

// Xóa menu liên kết (Admin)
export const deleteExternalMenuApi = async (id) => {
  try {
    const response = await axiosInstance.delete(`/api/external-menus/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting external menu:', error);
    throw error.response?.data?.message || 'Lỗi khi xóa menu liên kết!';
  }
};
