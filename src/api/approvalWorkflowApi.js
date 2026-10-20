import axiosInstance from "./axiosInstance";

// 1. Lấy danh sách quy trình tuyến ký duyệt
export const getApprovalWorkflows = async () => {
  try {
    const res = await axiosInstance.get("/api/approval-workflows");
    return res.data;
  } catch (error) {
    console.error("Lỗi khi tải danh sách tuyến ký duyệt:", error);
    throw error;
  }
};

// 2. Sinh các bước ký duyệt cụ thể cho người tạo
export const generateApprovalSteps = async (creatorId, workflowId) => {
  try {
    const params = {};
    if (creatorId) params.creatorId = creatorId;
    if (workflowId) params.workflowId = workflowId;
    const res = await axiosInstance.get("/api/approval-workflows/generate-steps", { params });
    return res.data;
  } catch (error) {
    console.error("Lỗi khi sinh các bước ký duyệt:", error);
    throw error;
  }
};

// 3. Tạo mới tuyến ký duyệt (Admin / Manager)
export const createApprovalWorkflow = async (data) => {
  try {
    const res = await axiosInstance.post("/api/approval-workflows", data);
    return res.data;
  } catch (error) {
    console.error("Lỗi khi tạo tuyến ký duyệt:", error);
    throw error;
  }
};

// 4. Cập nhật tuyến ký duyệt (Admin / Manager)
export const updateApprovalWorkflow = async (id, data) => {
  try {
    const res = await axiosInstance.put(`/api/approval-workflows/${id}`, data);
    return res.data;
  } catch (error) {
    console.error("Lỗi khi cập nhật tuyến ký duyệt:", error);
    throw error;
  }
};

// 5. Xóa tuyến ký duyệt (Admin / Manager)
export const deleteApprovalWorkflow = async (id) => {
  try {
    const res = await axiosInstance.delete(`/api/approval-workflows/${id}`);
    return res.data;
  } catch (error) {
    console.error("Lỗi khi xóa tuyến ký duyệt:", error);
    throw error;
  }
};
