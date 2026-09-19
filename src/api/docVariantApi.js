import axiosInstance from './axiosInstance';


export const getAllDocVariants = async (onlyActive = true) => {
    try {
        const response = await axiosInstance.get(`/docVariants/getAll`, {
            params: { onlyActive: onlyActive ? "true" : "false" }
        });
        return response.data.allDocVariants;
    } catch (error) {
        console.error("Lỗi khi lấy danh sách loại văn bản:", error);
        return [];
    }
};

export const toggleDocVariantStatus = async (docVariantID, isActive) => {
    try {
        const response = await axiosInstance.post(`/docVariants/toggle-status`, { docVariantID, isActive });
        return response.data;
    } catch (error) {
        console.error("Lỗi khi đổi trạng thái loại văn bản:", error);
        return { error: error.response?.data?.message || "Lỗi không xác định" };
    }
};

export const createDocVariant = async (docVariantName) => {
    try {
        const response = await axiosInstance.post(`/docVariants/create`, { docVariantName });
        return response.data;
    } catch (error) {
        console.error("Lỗi khi tạo loại văn bản:", error);
        return { error: error.response?.data?.message || "Lỗi không xác định" };
    }
};

export const updateDocVariant = async (docVariantID, docVariantName, isActive) => {
    try {
        const response = await axiosInstance.post(`/docVariants/update`, { docVariantID, docVariantName, isActive });
        return response.data;
    } catch (error) {
        console.error("Lỗi khi cập nhật loại văn bản:", error);
        return { error: error.response?.data?.message || "Lỗi không xác định" };
    }
};

export const deleteDocVariant = async (docVariantID) => {
    try {
        const response = await axiosInstance.post(`/docVariants/delete`, { docVariantID });
        return response.data;
    } catch (error) {
        console.error("Lỗi khi xóa loại văn bản:", error);
        return { error: error.response?.data?.message || "Lỗi không xác định" };
    }
};
export const getTotalsByYear = async (year) => {
    try {
        const response = await axiosInstance.get('/docVariants/' + year);
        return response.data;
    } catch (error) {
        console.error("Lỗi khi lấy tổng số văn bản theo năm:", error);
        return { error: error.message };
    }
};
export const getDocumentsBySentBy = async (userId, page, pageSize) => {
    try {
      const response = await axiosInstance.get(`/documents/by-sentby/${userId}`, {
        params: { page, limit: pageSize },
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || "Error fetching documents by sentBy");
    }
  };