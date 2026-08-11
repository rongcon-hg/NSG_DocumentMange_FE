import axiosInstance from './axiosInstance';
import Cookies from "js-cookie"; 

export const uploadDocument = async (formData) => {
  try {
    const response = await axiosInstance.post(`/documents/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Upload document failed";
    console.error("Upload document error:", error.response?.data || error);
    throw new Error(message);
  }
};

export const getAllDocuments = async (userId, page = 1, limit = 10, filters = {}) => {
  try {
    // Validate inputs
    if (!userId) {
      throw new Error("userId là bắt buộc");
    }

    const params = { userId, page, limit };
    
    // Add filters to params
    if (filters.docIdentifier) params.docIdentifier = filters.docIdentifier;
    if (filters.shortDescription) params.shortDescription = filters.shortDescription;
    if (filters.recipients && filters.recipients.length > 0) {
      params.recipients = Array.isArray(filters.recipients) ? filters.recipients.join(",") : filters.recipients;
    }
    if (filters.unit) params.unit = filters.unit;
    if (filters.urgency) params.urgency = filters.urgency;
    if (filters.year) params.year = filters.year;
    if (filters.docVariant) params.docVariant = filters.docVariant;
    if (filters.deadlineRange && filters.deadlineRange[0] && filters.deadlineRange[1]) {
      params.deadlineRange = JSON.stringify(filters.deadlineRange);
    }
    if (filters.createAtRange && filters.createAtRange[0] && filters.createAtRange[1]) {
      params.createAtRange = JSON.stringify(filters.createAtRange);
    }

    const response = await axiosInstance.get("/documents", { params });

    // Validate response structure
    if (!response.data || typeof response.data !== "object") {
      throw new Error("Phản hồi từ server không hợp lệ");
    }

    const { success, data, totalDocuments, totalPages } = response.data;
    if (!success) {
      throw new Error(response.data.message || "Không thể lấy danh sách tài liệu");
    }

    return {
      success,
      data: data || [],
      totalDocuments: totalDocuments || 0,
      totalPages: totalPages || 0,
      page: page,
      limit: limit,
    };
  } catch (error) {
    console.error("Lỗi khi lấy danh sách tài liệu:", error);
    const message =
      error.response?.data?.message || error.message || "Lỗi khi lấy danh sách tài liệu";
    throw new Error(message);
  }
};


export const getNextDocNum = async (docType, docVariantId, year) => {
    if (!docType || !docVariantId || !year) {
        console.error("getNextDocNum requires docType, docVariantId, and year.");
        // Optionally throw an error or return a specific error object
        throw new Error("Missing required parameters for getNextDocNum");
    }
    const response = await axiosInstance.get(`/documents/nextdocnum/${docType}/${docVariantId}/${year}`);
    return response.data;
};
export const getTotalDocNum = async (docVariantId, year) => {
  if (!docVariantId || !year) {
      console.error("totalDocNum requires docType, docVariantId, and year.");
      // Optionally throw an error or return a specific error object
      throw new Error("Missing required parameters for totalDocNum");
  }
  const response = await axiosInstance.get(`/documents/totalDocNum/${docVariantId}/${year}`);
  return response.data;
};

// export const getDocumentsByType = async (docType, page = 1, limit = 10) => {
//     const response = await axiosInstance.get(`/documents/${docType}`, {
//         params: { page, limit },
//     });
//     return response.data;
// };  

export const getUnreadDocCount = async (userId) => {
  try {
    const response = await axiosInstance.get(`/documents/unread-count/${userId}`);
    return response.data;
  } catch (error) {
    console.error("Lỗi khi đếm văn bản chưa đọc:", error);
    throw error;
  }
};

export const getDocumentsByUserAndType = async (userId, docType, page = 1, limit = 10) => {
    try {
        const response = await axiosInstance.get(`/documents/${userId}/${docType}`, {
            params: {
                page,
                limit,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Lỗi không thể lấy được văn bản:', error);
        throw error;
    }
};

export const deleteDocument = async (documentId,userId) => {
    try {
      const response = await axiosInstance.delete(`/documents/${documentId}/${userId}`);
      return response.data; // Trả về kết quả từ API
    } catch (error) {
      console.error("lỗi ko thể xóa văn bản:", error.response?.data || error.message);
      throw error; // Quăng lỗi để xử lý ở component
    }
  };

  export const updateDocument = async (documentId, formData) => {
    try {
      const response = await axiosInstance.put(`/documents/${documentId}`, formData, {
        withCredentials: true,
      });
  
      return response.data;
    } catch (error) {
      console.error("lỗi không thể cập nhật văn bản:", error.response?.data || error.message);
      throw error;
    }
  };
  

  export const getFilteredDocuments = async (params) => {
    try {
      const response = await axiosInstance.get("/documents/fillter", {
        params,
        headers: {
          Authorization: `Bearer ${Cookies.get("accessToken")}`,
        },
      });
      return response.data; 
    } catch (error) {
      console.error("lỗi không thể lọc văn bản:", error);
      throw error;
    }
  };

  export const getDocumentById = async (documentId) => {
    try {
        const response = await axiosInstance.get(`/documents/${documentId}`);
        return response.data;
    } catch (error) {
        console.error("Lỗi khi gọi API:", error.response ? error.response.data : error.message);
        throw error;
    }
};

export const markAsRead = async (userId, documentId) => {
  try {
    const response = await axiosInstance.post(`/documents/isRead`, { userId, documentId });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Error marking as read");
  }
};
export const getAllDocCodes = async () => {
  try {
    const response = await axiosInstance.get(`/documents/doc-codes`);
    return response.data.docCodesAndNums; // Trả về mảng docCodesAndNums
  } catch (error) {
    console.error('Lỗi khi lấy danh sách docCode và docNum:', error);
    throw error;
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
export const getDocumentsByAssignedTo = async (userId, page = 1, limit = 10, filters = {}) => {
  try {
    const params = { page, limit };
    
    // Add filters to params
    if (filters.docIdentifier) params.docIdentifier = filters.docIdentifier;
    if (filters.shortDescription) params.shortDescription = filters.shortDescription;
    if (filters.issuingUnit) params.issuingUnit = filters.issuingUnit;
    if (filters.recipients && filters.recipients.length > 0) {
      params.recipients = Array.isArray(filters.recipients) ? filters.recipients.join(",") : filters.recipients;
    }
    if (filters.urgency) params.urgency = filters.urgency;
    if (filters.year) params.year = filters.year;
    if (filters.docVariant) params.docVariant = filters.docVariant;
    if (filters.isRead !== null && filters.isRead !== undefined) params.isRead = filters.isRead;
    if (filters.deadlineRange && filters.deadlineRange[0] && filters.deadlineRange[1]) {
      params.deadlineRange = JSON.stringify(filters.deadlineRange);
    }
    if (filters.createAtRange && filters.createAtRange[0] && filters.createAtRange[1]) {
      params.createAtRange = JSON.stringify(filters.createAtRange);
    }
    
    const response = await axiosInstance.get(`/documents/by-assignedto/${userId}`, { params });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.message || "Error fetching documents by assignedTo");
  }
};

export const exportDocumentsToExcel = async (
  year,
  docType,
  docVariant,
  fromDate,
  toDate,
  executorId,
  onTimeStatus
) => {
  try {
    const params = {
      year: year || undefined,
      docType: docType || undefined,
      docVariant: docVariant || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      executorId: executorId || undefined,
      onTimeStatus: onTimeStatus || undefined,
    };

    // Loại bỏ các giá trị undefined để tránh gửi tham số rỗng không cần thiết
    Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);

    const response = await axiosInstance.get('/exports', { params });
    return response.data.data; // Trả về dữ liệu từ API
  } catch (error) {
    console.error('Error fetching documents for Excel:', error);
    throw new Error('Failed to fetch documents for Excel export');
  }
};

export const getDeadlineStatusCounts = async (userId) => {
  try {
    const response = await axiosInstance.get(
      `/documents/deadline-notifications`,
      {
        params: { userId }
      }
    );

    return response.data; // { soonCount, dueTodayCount, overdueCount }
  } catch (error) {
    console.error("Failed to fetch deadline counts:", error);
    throw error;
  }
};

// Search documents (global search)
export const searchDocuments = async (params) => {
  try {
    const response = await axiosInstance.get(`/documents/search`, { params });
    return response.data; // { ok, total, page, limit, items }
  } catch (error) {
    console.error("Search documents failed:", error.response?.data || error);
    throw new Error(error.response?.data?.message || error.message || "Search failed");
  }
};