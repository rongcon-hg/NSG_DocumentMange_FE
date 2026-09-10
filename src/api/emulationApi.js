import axiosInstance from "./axiosInstance";

// === 1. DANH MỤC DANH HIỆU THI ĐUA ===
export const getEmulationTitles = async (params = {}) => {
  const res = await axiosInstance.get("/api/emulation/titles", { params });
  return res.data;
};

export const createEmulationTitle = async (data) => {
  const res = await axiosInstance.post("/api/emulation/titles", data);
  return res.data;
};

export const updateEmulationTitle = async (id, data) => {
  const res = await axiosInstance.put(`/api/emulation/titles/${id}`, data);
  return res.data;
};

export const deleteEmulationTitle = async (id) => {
  const res = await axiosInstance.delete(`/api/emulation/titles/${id}`);
  return res.data;
};

export const initDefaultEmulationTitles = async () => {
  const res = await axiosInstance.post("/api/emulation/titles/init-default");
  return res.data;
};

// === 2. DANH MỤC LOẠI HỒ SƠ MINH CHỨNG ===
export const getEmulationDocTypes = async (params = {}) => {
  const res = await axiosInstance.get("/api/emulation/document-types", { params });
  return res.data;
};

export const createEmulationDocType = async (data) => {
  const res = await axiosInstance.post("/api/emulation/document-types", data);
  return res.data;
};

export const updateEmulationDocType = async (id, data) => {
  const res = await axiosInstance.put(`/api/emulation/document-types/${id}`, data);
  return res.data;
};

export const deleteEmulationDocType = async (id) => {
  const res = await axiosInstance.delete(`/api/emulation/document-types/${id}`);
  return res.data;
};

export const initDefaultEmulationDocTypes = async () => {
  const res = await axiosInstance.post("/api/emulation/document-types/init-default");
  return res.data;
};

// === 3. HỒ SƠ ĐĂNG KÝ & XÉT DUYỆT ===
export const uploadEmulationFiles = async (formData) => {
  const res = await axiosInstance.post("/api/emulation/registrations/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const getEmulationRegistrations = async (params = {}) => {
  const res = await axiosInstance.get("/api/emulation/registrations", { params });
  return res.data;
};

export const getMyEmulationRegistration = async (schoolYear) => {
  const res = await axiosInstance.get("/api/emulation/registrations/my-active", {
    params: { schoolYear },
  });
  return res.data;
};

export const getEmulationRegistrationById = async (id) => {
  const res = await axiosInstance.get(`/api/emulation/registrations/${id}`);
  return res.data;
};

export const createEmulationRegistration = async (data) => {
  const res = await axiosInstance.post("/api/emulation/registrations", data);
  return res.data;
};

export const updateEmulationRegistration = async (id, data) => {
  const res = await axiosInstance.put(`/api/emulation/registrations/${id}`, data);
  return res.data;
};

export const deleteEmulationRegistration = async (id) => {
  const res = await axiosInstance.delete(`/api/emulation/registrations/${id}`);
  return res.data;
};

export const reviewEmulationRegistration = async (id, reviewData) => {
  const res = await axiosInstance.patch(`/api/emulation/registrations/${id}/review`, reviewData);
  return res.data;
};

export const getEmulationStats = async (schoolYear) => {
  const res = await axiosInstance.get("/api/emulation/registrations/stats", {
    params: { schoolYear },
  });
  return res.data;
};
