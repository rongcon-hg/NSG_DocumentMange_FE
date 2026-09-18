import axiosInstance from './axiosInstance';

export const summarizeDocumentApi = async (documentId, forceRefresh = false) => {
    try {
        const response = await axiosInstance.post(`/documents/${documentId}/ai-summarize`, { forceRefresh });
        return response.data;
    } catch (error) {
        console.error('Lỗi khi gọi API AI tóm tắt văn bản:', error);
        throw error;
    }
};
