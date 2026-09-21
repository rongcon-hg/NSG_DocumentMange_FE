import axiosInstance from "./axiosInstance";

export const previewHandover = async (fromUserId) => {
  const response = await axiosInstance.get(`/api/handover/preview`, {
    params: { fromUserId }
  });
  return response.data;
};

export const executeHandover = async (payload) => {
  const response = await axiosInstance.post(`/api/handover/execute`, payload);
  return response.data;
};

export const getHandoverLogs = async (page = 1, limit = 20) => {
  const response = await axiosInstance.get(`/api/handover/logs`, {
    params: { page, limit }
  });
  return response.data;
};
