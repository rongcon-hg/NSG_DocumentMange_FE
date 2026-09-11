import axiosInstance from "./axiosInstance";

/**
 * 1. Tạo mới danh sách đăng ký bồi dưỡng
 */
export const createTrainingRegistrations = async (data) => {
  const res = await axiosInstance.post("/api/training/registrations", data);
  return res.data;
};

/**
 * 2. Lấy danh sách đăng ký bồi dưỡng
 */
export const getTrainingRegistrations = async (params = {}) => {
  const res = await axiosInstance.get("/api/training/registrations", { params });
  return res.data;
};

/**
 * 3. Lấy chi tiết hồ sơ bồi dưỡng
 */
export const getTrainingRegistrationById = async (id) => {
  const res = await axiosInstance.get(`/api/training/registrations/${id}`);
  return res.data;
};

/**
 * 4. Cập nhật hồ sơ bồi dưỡng
 */
export const updateTrainingRegistration = async (id, data) => {
  const res = await axiosInstance.put(`/api/training/registrations/${id}`, data);
  return res.data;
};

/**
 * 5. Xóa hồ sơ bồi dưỡng
 */
export const deleteTrainingRegistration = async (id) => {
  const res = await axiosInstance.delete(`/api/training/registrations/${id}`);
  return res.data;
};

/**
 * 6. Manager phê duyệt / từ chối hồ sơ
 */
export const reviewTrainingRegistration = async (id, data) => {
  const res = await axiosInstance.patch(`/api/training/registrations/${id}/review`, data);
  return res.data;
};

/**
 * 7. Báo cáo kết quả bồi dưỡng
 */
export const reportTrainingResult = async (id, data) => {
  const res = await axiosInstance.patch(`/api/training/registrations/${id}/report`, data);
  return res.data;
};

/**
 * 7.1. Manager xác nhận kết quả báo cáo
 */
export const confirmTrainingReportResult = async (id) => {
  const res = await axiosInstance.patch(`/api/training/registrations/${id}/confirm-result`);
  return res.data;
};

/**
 * 8. Upload tệp minh chứng lên Google Drive
 */
export const uploadTrainingProofFiles = async (formData) => {
  const res = await axiosInstance.post("/api/training/registrations/upload-proof", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

/**
 * 9. Lấy thống kê tổng hợp bồi dưỡng
 */
export const getTrainingStats = async (params = {}) => {
  const res = await axiosInstance.get("/api/training/registrations/stats", { params });
  return res.data;
};

/**
 * 10. Tải file mẫu Excel đăng ký
 */
export const downloadTrainingTemplate = async () => {
  const res = await axiosInstance.get("/api/training/registrations/template", {
    responseType: "blob",
  });
  return res;
};

/**
 * 11. Xuất Excel danh sách bồi dưỡng
 */
export const exportTrainingExcel = async (params = {}) => {
  const res = await axiosInstance.get("/api/training/registrations/export", {
    params,
    responseType: "blob",
  });
  return res;
};

/**
 * 12. Import Excel danh sách bồi dưỡng
 */
export const importTrainingExcel = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await axiosInstance.post("/api/training/registrations/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};
