import { formatFileName } from "../utils/formatFileName";
import axiosInstance from './axiosInstance';

// Lấy danh sách tất cả văn bản trình ký (cho manager)
export const fetchAllRepliedDocs = async (page = 1, limit = 10) => {
  try {
    const response = await axiosInstance.get("/replyDoc/getAll", {
      params: { page, limit },
    });
    return {
      success: true,
      data: response.data.data || response.data,
      total: response.data.total || response.data.length,
    };
  } catch (error) {
    console.error("Lỗi không thể lấy được danh sách trả lời văn bản:", error.response?.data || error.message);
    return { success: false, data: [], total: 0 };
  }
};

// Lấy danh sách văn bản trình ký theo userId
export const fetchRepliedDocsByUserId = async (userId, page = 1, limit = 10) => {
  try {
    const response = await axiosInstance.get(`/replyDoc/getByID/${userId}`, {
      params: { page, limit },
    });
    return {
      success: true,
      data: response.data.data || response.data,
      total: response.data.total || response.data.length,
    };
  } catch (error) {
    console.error("lỗi không lấy được danh sách văn bản dành cho người dùng:", error.response?.data || error.message);
    return { success: false, data: [], total: 0 };
  }
};

// Tạo văn bản trình ký
export const createRepliedDoc = async (formData) => {
  try {
    const response = await axiosInstance.post("/replyDoc/create", formData);
    return response.data;
  } catch (error) {
    console.error("lỗi không thể trả lời văn bản", error.response?.data || error.message);
    throw error;
  }
};

// Cập nhật trạng thái văn bản
export const processRepliedDoc = async (repliedDocId, action, rejectionReason = null) => {
  try {
    // Kiểm tra tham số đầu vào
    if (!repliedDocId || !action) {
      throw new Error("repliedDocId và action là bắt buộc!");
    }
    if (!["approve", "reject"].includes(action)) {
      throw new Error("Action không hợp lệ. Chỉ chấp nhận 'approve' hoặc 'reject'.");
    }

    // Tạo payload cho request
    const payload = {
      repliedDocId,
      action,
    };

    // Nếu action là "reject" và có rejectionReason, thêm vào payload
    if (action === "reject" && rejectionReason) {
      payload.rejectionReason = rejectionReason;
    }

    // Gửi yêu cầu POST đến API
    const response = await axiosInstance.post("/replyDoc/processReplyDoc", payload);

    // Trả về dữ liệu từ response
    return response.data;
  } catch (error) {
    // Xử lý lỗi chi tiết
    const errorMessage =
      error.response?.data?.message || error.message || "Lỗi không thể cập nhật trạng thái văn bản!";
    console.error("Lỗi trong processRepliedDoc:", errorMessage, error.response?.data || error);
    throw new Error(errorMessage); // Ném lỗi để xử lý ở nơi gọi hàm
  }
};

// Xóa văn bản trình ký
export const deleteRepliedDoc = async (docId, replyBy) => {
  try {
    const response = await axiosInstance.delete(`/replyDoc/delete/${docId}`, {
      data: { replyBy },
    });
    return response.data;
  } catch (error) {
    console.error("lỗi không thể xóa trả lời văn bản:", error.response?.data || error.message);
    throw error;
  }
};

export const getRepliedDocById = async (repliedDocId) => {
  const response = await axiosInstance.get(`/replyDoc/${repliedDocId}`);
  return response.data;
};

export const updateRepliedDoc = async (id, formData) => {
    try {
      const response = await axiosInstance.put(`/replyDoc/update/${id}`, formData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  };

// New function to get pending count for a specific staff user
export const getStaffPendingReplyCount = async (userId) => {
  if (!userId) {
    console.error("getStaffPendingReplyCount: userId is required");
    return 0;
  }
  try {
    const response = await axiosInstance.get(`/replyDoc/count/pending/${userId}`);
    if (response.data && typeof response.data.pendingAndRejectedCount === "number") {
      return response.data.pendingAndRejectedCount;
    } else {
      console.error("Error fetching staff pending count: Unexpected API response format.", response.data);
      return 0;
    }
  } catch (error) {
    console.error("Error in getStaffPendingReplyCount API call:", error);
    return 0;
  }
};

export const getPendingRepliesForRecipient = async (recipientId) => {
  // Đã kiểm tra recipientId trong hàm gọi useEffect, nhưng kiểm tra lại vẫn tốt
  if (!recipientId) { 
    console.error("getPendingRepliesForRecipient: recipientId is required");
    return 0; 
  }
  try {
    // Đảm bảo URL đúng với cấu hình API của bạn
    const response = await axiosInstance.get(`/replyDoc/count/pending/replied/${recipientId}`); 
    // Kiểm tra cấu trúc response chặt chẽ hơn
    if (response && response.data && typeof response.data.pendingCount === "number") {
      return response.data.pendingCount;
    } else {
      console.error("Error fetching pending replies: Unexpected API response format.", response?.data);
      return 0;
    }
  } catch (error) {
    // Log lỗi chi tiết hơn nếu có thể (ví dụ: error.response?.data)
    console.error("Error in getPendingRepliesForRecipient API call:", error.response?.data || error.message || error);
    return 0; 
  }
};
export const getPendingRepliesListForRecipient = async (recipientId, page = 1, limit = 10, filters = {}) => {
  if (!recipientId) {
    console.error("Recipient ID is required for getPendingRepliesListForRecipient");
    return { success: false, data: [], total: 0, currentPage: 1, totalPages: 0 };
  }
  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      status: filters.status || "pending,rejected", // Mặc định lấy pending + rejected
    });

    Object.keys(filters).forEach(key => {
      const value = filters[key];
      if (value !== null && value !== "" && !(Array.isArray(value) && value.length === 0) && key !== "status") {
        if ((key === "replyAtRange" || key === "processedAtRange") && Array.isArray(value)) {
          if (value[0]) params.append(`${key}Start`, value[0]);
          if (value[1]) params.append(`${key}End`, value[1]);
        } else if (Array.isArray(value)) {
          value.forEach(item => params.append(key, item));
        } else {
          params.append(key, value);
        }
      }
    });

    const response = await axiosInstance.get(`/replyDoc/list/${recipientId}`, { params });

    return {
      success: true,
      data: response.data.data || [],
      total: response.data.total || 0,
      currentPage: response.data.currentPage || page,
      totalPages: response.data.totalPages || Math.ceil((response.data.total || 0) / limit),
    };
  } catch (error) {
    console.error(`Error fetching pending replies for recipient ${recipientId}:`, error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || error.message || "Failed to fetch pending replies",
      data: [],
      total: 0,
      currentPage: page,
      totalPages: 0,
    };
  }
};

export const searchRepliedDocs = async (params) => {
  try {
    const response = await axiosInstance.get(`/replyDoc/search`, { params });
    return {
      success: true,
      data: response.data.data || [],
      total: response.data.total || 0,
    };
  } catch (error) {
    console.error("Search replied docs failed:", error.response?.data || error);
    return {
      success: false,
      data: [],
      total: 0,
      message: error.response?.data?.message || error.message || "Search failed",
    };
  }
};

// Gửi văn bản đến reviewer
export const sentToReview = async (repliedDocId, reviewerId) => {
  try {
    const response = await axiosInstance.post("/replyDoc/sentToReview", {
      id: repliedDocId,
      reviewerId: reviewerId,
    });
    return response.data;
  } catch (error) {
    console.error("Error sending to review:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Lỗi khi gửi văn bản đến người duyệt!");
  }
};

// Lấy danh sách văn bản đã được gửi đến reviewer
export const getReviewedDocs = async (reviewerUserId = null, status = null) => {
  try {
    const params = {};
    // Chỉ truyền reviewerUser nếu có userId (tức là user thuộc BGH)
    if (reviewerUserId) {
      params.reviewerUser = reviewerUserId;
    }
    if (status) {
      params.status = status;
    }
    const response = await axiosInstance.get("/replyDoc/reviewed", { params });
    return {
      success: true,
      data: response.data.data || [],
    };
  } catch (error) {
    console.error("Error fetching reviewed docs:", error.response?.data || error.message);
    return {
      success: false,
      data: [],
      message: error.response?.data?.message || error.message || "Lỗi khi lấy danh sách văn bản xét duyệt!",
    };
  }
};

// Reviewer thực hiện action (duyệt/từ chối)
export const reviewerAction = async (repliedDocId, action, reviewerNotes = null) => {
  try {
    const payload = {
      id: repliedDocId,
      action: action,
    };
    if (reviewerNotes) {
      payload.reviewerNotes = reviewerNotes;
    }
    const response = await axiosInstance.post("/replyDoc/reviewerAction", payload);
    return response.data;
  } catch (error) {
    console.error("Error performing reviewer action:", error.response?.data || error.message);
    throw new Error(error.response?.data?.message || "Lỗi khi thực hiện thao tác xét duyệt!");
  }
};

// Đếm số lượng văn bản đang chờ xét duyệt (inReview) cho BGH
export const getInReviewReplyCount = async (reviewerId) => {
  if (!reviewerId) {
    console.error("getInReviewReplyCount: reviewerId is required");
    return 0;
  }
  try {
    const response = await axiosInstance.get("/replyDoc/count/inReview", {
      params: { reviewerId },
    });
    return response.data.count || 0;
  } catch (error) {
    console.error("Error in getInReviewReplyCount API call:", error.response?.data || error.message || error);
    return 0;
  }
};

export const signFile = async (fileId, fileName) => {
  try {
    // 1. Tải file gốc từ Backend
    const downloadResponse = await axiosInstance.get(`/replyDoc/download/${fileId}`, {
      responseType: 'blob'
    });
    
    // 2. Tạo FormData để gửi sang Local Service
    const formData = new FormData();
    const blob = new Blob([downloadResponse.data], { type: downloadResponse.headers['content-type'] });
    const originalFile = new File([blob], formatFileName(fileName), { type: downloadResponse.headers['content-type'] });
    formData.append('file', originalFile);

    // 3. Gửi file tới Local Service (đang chạy ở cổng 8989)
    // Dùng fetch thay vì axiosInstance vì không cần gửi token lên máy local
    const localServiceUrl = 'http://localhost:8989/sign';
    const localResponse = await fetch(localServiceUrl, {
      method: 'POST',
      body: formData
    });

    if (!localResponse.ok) {
        throw new Error("Không thể kết nối với phần mềm Ký số (Local Service). Hãy chắc chắn bạn đã bật nó.");
    }

    // 4. Nhận file đã ký trả về
    const signedBlob = await localResponse.blob();
    const signedFile = new File([signedBlob], fileName, { type: signedBlob.type || 'application/pdf' });

    return {
      isSuccess: true,
      message: "Ký số thành công",
      file: signedFile
    };

  } catch (error) {
    console.error("Lỗi khi ký số:", error.response?.data || error.message);
    throw new Error(error.message || "Lỗi khi thực hiện ký số!");
  }
};