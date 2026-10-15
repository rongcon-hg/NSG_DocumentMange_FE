import axiosInstance from "./axiosInstance";

export const getTemplatesApi = async (params = {}) => {
  const response = await axiosInstance.get("/document-templates", { params });
  return response.data;
};

export const getTemplateByIdApi = async (id) => {
  const response = await axiosInstance.get(`/document-templates/${id}`);
  return response.data;
};

export const createTemplateApi = async (data) => {
  const response = await axiosInstance.post("/document-templates", data);
  return response.data;
};

export const updateTemplateApi = async (id, data) => {
  const response = await axiosInstance.put(`/document-templates/${id}`, data);
  return response.data;
};

export const deleteTemplateApi = async (id) => {
  const response = await axiosInstance.delete(`/document-templates/${id}`);
  return response.data;
};
