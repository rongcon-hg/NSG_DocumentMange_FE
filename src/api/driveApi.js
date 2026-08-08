import axiosInstance from './axiosInstance';
import axios from 'axios';

// Get token from backend
export const getDriveToken = async () => {
    try {
        const response = await axiosInstance.get('/api/drive/token');
        return response.data; // { success, accessToken, folderId }
    } catch (error) {
        console.error("Lỗi khi lấy token Drive:", error);
        throw new Error("Không thể kết nối đến Google Drive.");
    }
};

// Upload a single file directly to Google Drive
export const uploadFileDirectlyToDrive = async (file, accessToken, folderId, onProgress) => {
    try {
        const metadata = {
            name: file.name,
            parents: [folderId],
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const response = await axios.post('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', form, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            withCredentials: false,
            onUploadProgress: (progressEvent) => {
                if (onProgress) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted);
                }
            },
        });

        return {
            fileId: response.data.id,
            fileName: response.data.name,
            mimeType: response.data.mimeType || file.type,
            size: file.size
        };
    } catch (error) {
        console.error("Lỗi khi tải file trực tiếp lên Drive:", error);
        throw new Error(`Không thể tải file ${file.name} lên Google Drive.`);
    }
};
