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

        // Step 1: Create file metadata
        const metadataResponse = await axios.post('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', metadata, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            withCredentials: false
        });

        const fileId = metadataResponse.data.id;

        // Step 2: Upload file content
        const response = await axios.patch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`, file, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': file.type || 'application/octet-stream'
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
            fileId: fileId,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size
        };
    } catch (error) {
        console.error("Lỗi khi tải file trực tiếp lên Drive:", error);
        throw new Error(`Không thể tải file ${file.name} lên Google Drive.`);
    }
};
