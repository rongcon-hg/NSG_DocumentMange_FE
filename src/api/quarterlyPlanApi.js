import axiosInstance from './axiosInstance';

// Lấy danh mục metadata (Đơn vị & Lãnh đạo BGH)
export const getQuarterlyPlanMetadata = async () => {
  const res = await axiosInstance.get('/quarterly-plans/metadata');
  return res.data;
};

// Lấy danh sách các Kế hoạch quý
export const getQuarterlyPlans = async (params = {}) => {
  const res = await axiosInstance.get('/quarterly-plans', { params });
  return res.data;
};

// Tạo kế hoạch quý mới
export const createQuarterlyPlan = async (data) => {
  const res = await axiosInstance.post('/quarterly-plans', data);
  return res.data;
};

// Cập nhật thông tin kế hoạch quý
export const updateQuarterlyPlan = async (planId, data) => {
  const res = await axiosInstance.put(`/quarterly-plans/${planId}`, data);
  return res.data;
};

// Xóa kế hoạch quý và toàn bộ nhiệm vụ
export const deleteQuarterlyPlan = async (planId) => {
  const res = await axiosInstance.delete(`/quarterly-plans/${planId}`);
  return res.data;
};

// Lấy chi tiết kế hoạch quý và các nhiệm vụ
export const getQuarterlyPlanDetail = async (planId) => {
  const res = await axiosInstance.get(`/quarterly-plans/${planId}`);
  return res.data;
};

// Thêm nhiệm vụ mới vào kế hoạch quý
export const createPlanItem = async (data) => {
  const res = await axiosInstance.post('/quarterly-plans/items', data);
  return res.data;
};

// Cập nhật nhiệm vụ (tiến độ, thực tế hoàn thành hoặc sửa đổi)
export const updatePlanItem = async (itemId, data) => {
  const res = await axiosInstance.put(`/quarterly-plans/items/${itemId}`, data);
  return res.data;
};

// Xóa nhiệm vụ
export const deletePlanItem = async (itemId) => {
  const res = await axiosInstance.delete(`/quarterly-plans/items/${itemId}`);
  return res.data;
};
