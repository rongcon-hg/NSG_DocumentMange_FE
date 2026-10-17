import axiosInstance from "./axiosInstance";

// 1. Lấy danh sách hồ sơ trình ký (theo tab: pending_my_action, my_submitted, all)
export const getApprovalDocuments = async (params = {}) => {
  try {
    const response = await axiosInstance.get("/api/approval-documents", { params });
    return response.data;
  } catch (error) {
    console.error("Lỗi khi tải danh sách hồ sơ trình ký:", error.response?.data || error.message);
    throw error;
  }
};

// 2. Lấy chi tiết hồ sơ trình ký
export const getApprovalDocumentById = async (id) => {
  try {
    const response = await axiosInstance.get(`/api/approval-documents/${id}`);
    return response.data;
  } catch (error) {
    console.error("Lỗi khi tải chi tiết hồ sơ trình ký:", error.response?.data || error.message);
    throw error;
  }
};

// 3. Tạo mới hồ sơ trình ký (Multipart form data: file, title, description, urgency, signSteps)
export const createApprovalDocument = async (formData) => {
  try {
    const response = await axiosInstance.post("/api/approval-documents/create", formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return response.data;
  } catch (error) {
    console.error("Lỗi khi tạo hồ sơ trình ký:", error.response?.data || error.message);
    throw error;
  }
};

// 4. Ký duyệt hoặc thẩm định hồ sơ
export const signAndApproveStep = async (id, data) => {
  try {
    const response = await axiosInstance.post(`/api/approval-documents/${id}/sign`, data);
    return response.data;
  } catch (error) {
    console.error("Lỗi khi ký duyệt hồ sơ:", error.response?.data || error.message);
    throw error;
  }
};

// 5. Từ chối hồ sơ trình ký
export const rejectApprovalDocument = async (id, reason) => {
  try {
    const response = await axiosInstance.post(`/api/approval-documents/${id}/reject`, { reason });
    return response.data;
  } catch (error) {
    console.error("Lỗi khi từ chối hồ sơ trình ký:", error.response?.data || error.message);
    throw error;
  }
};

// 6. Xóa hồ sơ trình ký (Admin/Manager hoặc người tạo)
export const deleteApprovalDocument = async (id) => {
  try {
    const response = await axiosInstance.delete(`/api/approval-documents/${id}`);
    return response.data;
  } catch (error) {
    console.error("Lỗi khi xóa hồ sơ trình ký:", error.response?.data || error.message);
    throw error;
  }
};

