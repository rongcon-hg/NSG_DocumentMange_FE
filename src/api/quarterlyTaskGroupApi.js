import axiosInstance from './axiosInstance';

// Lấy danh sách nhóm nhiệm vụ / trục công việc kế hoạch quý
export const getQuarterlyTaskGroups = async (params = {}) => {
  try {
    const response = await axiosInstance.get('/api/quarterly-task-groups', { params });
    return response.data;
  } catch (error) {
    console.error('Lỗi getQuarterlyTaskGroups:', error);
    throw error;
  }
};

// Tạo mới nhóm nhiệm vụ / trục công việc
export const createQuarterlyTaskGroup = async (data) => {
  try {
    const response = await axiosInstance.post('/api/quarterly-task-groups', data);
    return response.data;
  } catch (error) {
    console.error('Lỗi createQuarterlyTaskGroup:', error);
    throw error;
  }
};

// Cập nhật nhóm nhiệm vụ / trục công việc
export const updateQuarterlyTaskGroup = async (id, data) => {
  try {
    const response = await axiosInstance.put(`/api/quarterly-task-groups/${id}`, data);
    return response.data;
  } catch (error) {
    console.error('Lỗi updateQuarterlyTaskGroup:', error);
    throw error;
  }
};

// Xóa nhóm nhiệm vụ / trục công việc
export const deleteQuarterlyTaskGroup = async (id) => {
  try {
    const response = await axiosInstance.delete(`/api/quarterly-task-groups/${id}`);
    return response.data;
  } catch (error) {
    console.error('Lỗi deleteQuarterlyTaskGroup:', error);
    throw error;
  }
};

// Khôi phục 8 nhóm nhiệm vụ chuẩn mặc định
export const resetDefaultQuarterlyTaskGroups = async () => {
  try {
    const response = await axiosInstance.post('/api/quarterly-task-groups/reset-default');
    return response.data;
  } catch (error) {
    console.error('Lỗi resetDefaultQuarterlyTaskGroups:', error);
    throw error;
  }
};
