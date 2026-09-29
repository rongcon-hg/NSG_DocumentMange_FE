import axiosInstance from "./axiosInstance";

/**
 * Lấy danh sách các cuộc họp (có phân quyền và bộ lọc)
 */
export const getMeetings = async (params = {}) => {
  const response = await axiosInstance.get("/meetings", { params });
  return response.data;
};

/**
 * Lấy chi tiết phiên họp theo ID
 */
export const getMeetingById = async (id) => {
  const response = await axiosInstance.get(`/meetings/${id}`);
  return response.data;
};

/**
 * Tạo mới phiên họp
 */
export const createMeeting = async (data) => {
  const response = await axiosInstance.post("/meetings", data);
  return response.data;
};

/**
 * Cập nhật thông tin cuộc họp
 */
export const updateMeeting = async (id, data) => {
  const response = await axiosInstance.put(`/meetings/${id}`, data);
  return response.data;
};

/**
 * Cập nhật trạng thái cuộc họp (PREPARING, IN_PROGRESS, CONCLUDED, CANCELLED)
 */
export const updateMeetingStatus = async (id, status) => {
  const response = await axiosInstance.patch(`/meetings/${id}/status`, { status });
  return response.data;
};

/**
 * Điểm danh tham dự cuộc họp
 */
export const checkInMeeting = async (id, data = {}) => {
  const response = await axiosInstance.post(`/meetings/${id}/check-in`, data);
  return response.data;
};

/**
 * Đăng ký hoặc hủy phát biểu
 */
export const toggleSpeakRequest = async (id, isRequested) => {
  const response = await axiosInstance.post(`/meetings/${id}/speak-request`, { isRequested });
  return response.data;
};

/**
 * Tạo hoặc mở phiên biểu quyết
 */
export const createOrOpenVote = async (id, data) => {
  const response = await axiosInstance.post(`/meetings/${id}/votes`, data);
  return response.data;
};

/**
 * Đại biểu bỏ phiếu / biểu quyết
 */
export const submitVote = async (id, voteId, selectedOptionIndexes) => {
  const response = await axiosInstance.post(`/meetings/${id}/votes/${voteId}/submit`, {
    selectedOptionIndexes,
  });
  return response.data;
};

/**
 * Đóng phiên biểu quyết
 */
export const closeVote = async (id, voteId) => {
  const response = await axiosInstance.patch(`/meetings/${id}/votes/${voteId}/close`);
  return response.data;
};

/**
 * Lưu biên bản cuộc họp & tự động sinh nhiệm vụ
 */
export const saveMinutesAndActionItems = async (id, data) => {
  const response = await axiosInstance.post(`/meetings/${id}/minutes`, data);
  return response.data;
};

/**
 * Xóa phiên họp
 */
export const deleteMeeting = async (id) => {
  const response = await axiosInstance.delete(`/meetings/${id}`);
  return response.data;
};

/**
 * Thêm tài liệu số vào phiên họp
 */
export const addMeetingDocument = async (id, data) => {
  const response = await axiosInstance.post(`/meetings/${id}/documents`, data);
  return response.data;
};
