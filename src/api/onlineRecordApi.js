import axiosInstance from "./axiosInstance";

// ==========================================
// 1. DANH MỤC HỒ SƠ (Record Categories)
// ==========================================
export const getRecordCategories = async (params = {}) => {
  const res = await axiosInstance.get("/api/online-records/categories", { params });
  return res.data;
};

export const createRecordCategory = async (data) => {
  const res = await axiosInstance.post("/api/online-records/categories", data);
  return res.data;
};

export const updateRecordCategory = async (id, data) => {
  const res = await axiosInstance.put(`/api/online-records/categories/${id}`, data);
  return res.data;
};

export const deleteRecordCategory = async (id) => {
  const res = await axiosInstance.delete(`/api/online-records/categories/${id}`);
  return res.data;
};

export const initDefaultRecordCategories = async () => {
  const res = await axiosInstance.post("/api/online-records/categories/init-default");
  return res.data;
};

// ==========================================
// 2. DANH MỤC FILE ĐÍNH KÈM (Attachment Types)
// ==========================================
export const getRecordAttachmentTypes = async (params = {}) => {
  const res = await axiosInstance.get("/api/online-records/attachment-types", { params });
  return res.data;
};

export const createRecordAttachmentType = async (data) => {
  const res = await axiosInstance.post("/api/online-records/attachment-types", data);
  return res.data;
};

export const updateRecordAttachmentType = async (id, data) => {
  const res = await axiosInstance.put(`/api/online-records/attachment-types/${id}`, data);
  return res.data;
};

export const deleteRecordAttachmentType = async (id) => {
  const res = await axiosInstance.delete(`/api/online-records/attachment-types/${id}`);
  return res.data;
};

export const initDefaultRecordAttachmentTypes = async () => {
  const res = await axiosInstance.post("/api/online-records/attachment-types/init-default");
  return res.data;
};

// ==========================================
// 3. HỒ SƠ TRỰC TUYẾN (Online Records)
// ==========================================
export const uploadRecordFiles = async (formData) => {
  const res = await axiosInstance.post("/api/online-records/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const getOnlineRecords = async (params = {}) => {
  const res = await axiosInstance.get("/api/online-records", { params });
  return res.data;
};

export const getOnlineRecordById = async (id) => {
  const res = await axiosInstance.get(`/api/online-records/${id}`);
  return res.data;
};

export const createOnlineRecord = async (data) => {
  const res = await axiosInstance.post("/api/online-records", data);
  return res.data;
};

export const updateOnlineRecord = async (id, data) => {
  const res = await axiosInstance.put(`/api/online-records/${id}`, data);
  return res.data;
};

export const reviewOnlineRecord = async (id, data) => {
  const res = await axiosInstance.patch(`/api/online-records/${id}/review`, data);
  return res.data;
};

export const deleteOnlineRecord = async (id) => {
  const res = await axiosInstance.delete(`/api/online-records/${id}`);
  return res.data;
};

export const getPendingRecordCount = async () => {
  const res = await axiosInstance.get("/api/online-records/pending-count");
  return res.data;
};
