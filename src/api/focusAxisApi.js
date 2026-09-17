import axiosInstance from './axiosInstance';

// Lấy danh sách trục kết quả
export const getFocusAxes = async (params = {}) => {
  try {
    const response = await axiosInstance.get('/api/focus-axes', { params });
    return response.data;
  } catch (error) {
    console.error('Lỗi getFocusAxes:', error);
    throw error;
  }
};

// Tạo mới trục kết quả
export const createFocusAxis = async (data) => {
  try {
    const response = await axiosInstance.post('/api/focus-axes', data);
    return response.data;
  } catch (error) {
    console.error('Lỗi createFocusAxis:', error);
    throw error;
  }
};

// Cập nhật trục kết quả
export const updateFocusAxis = async (id, data) => {
  try {
    const response = await axiosInstance.put(`/api/focus-axes/${id}`, data);
    return response.data;
  } catch (error) {
    console.error('Lỗi updateFocusAxis:', error);
    throw error;
  }
};

// Xóa trục kết quả
export const deleteFocusAxis = async (id) => {
  try {
    const response = await axiosInstance.delete(`/api/focus-axes/${id}`);
    return response.data;
  } catch (error) {
    console.error('Lỗi deleteFocusAxis:', error);
    throw error;
  }
};

// Khôi phục 6 trục kết quả chuẩn mặc định
export const resetDefaultFocusAxes = async () => {
  try {
    const response = await axiosInstance.post('/api/focus-axes/reset-default');
    return response.data;
  } catch (error) {
    console.error('Lỗi resetDefaultFocusAxes:', error);
    throw error;
  }
};
