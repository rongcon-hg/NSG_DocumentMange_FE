import axiosInstance from './axiosInstance';

// === SMTP CONFIG API ===

// Lấy cấu hình SMTP
export const getSmtpConfigApi = async () => {
  try {
    const response = await axiosInstance.get('/api/smtp-config');
    return response.data;
  } catch (error) {
    console.error('Error fetching SMTP config:', error);
    throw error.response?.data?.message || 'Lỗi khi tải cấu hình SMTP!';
  }
};

// Lưu cấu hình SMTP
export const saveSmtpConfigApi = async (configData) => {
  try {
    const response = await axiosInstance.post('/api/smtp-config', configData);
    return response.data;
  } catch (error) {
    console.error('Error saving SMTP config:', error);
    throw error.response?.data?.message || 'Lỗi khi lưu cấu hình SMTP!';
  }
};

// Gửi email thử nghiệm
export const testSmtpConfigApi = async (testData) => {
  try {
    const response = await axiosInstance.post('/api/smtp-config/test', testData);
    return response.data;
  } catch (error) {
    console.error('Error testing SMTP config:', error);
    throw error.response?.data?.message || 'Lỗi khi gửi email thử nghiệm!';
  }
};

// === GOOGLE LOGIN CONFIG API ===

// Lấy cấu hình Google Login (Admin)
export const getGoogleLoginConfigApi = async () => {
  try {
    const response = await axiosInstance.get('/api/google-login-config');
    return response.data;
  } catch (error) {
    console.error('Error fetching Google Login config:', error);
    throw error.response?.data?.message || 'Lỗi khi tải cấu hình Google Login!';
  }
};

// Lưu cấu hình Google Login (Admin)
export const saveGoogleLoginConfigApi = async (configData) => {
  try {
    const response = await axiosInstance.post('/api/google-login-config', configData);
    return response.data;
  } catch (error) {
    console.error('Error saving Google Login config:', error);
    throw error.response?.data?.message || 'Lỗi khi lưu cấu hình Google Login!';
  }
};

// Lấy trạng thái kích hoạt Google Login (Public)
export const getGoogleLoginPublicStatusApi = async () => {
  try {
    const response = await axiosInstance.get('/api/google-login-config/status');
    return response.data;
  } catch (error) {
    console.error('Error fetching Google Login status:', error);
    return { success: true, isEnabled: true };
  }
};

// === BRANDING & UNIT SYSTEM CONFIG API ===

// Lấy thông tin cấu hình đơn vị & hệ thống (Public)
export const getUnitSystemConfigApi = async () => {
  try {
    const response = await axiosInstance.get('/api/system-config');
    return response.data;
  } catch (error) {
    console.error('Error fetching system config:', error);
    throw error.response?.data?.message || 'Lỗi khi tải cấu hình hệ thống!';
  }
};

// Cập nhật thông tin cấu hình đơn vị (Admin)
export const updateUnitSystemConfigApi = async (data) => {
  try {
    const response = await axiosInstance.put('/api/system-config', data);
    return response.data;
  } catch (error) {
    console.error('Error updating system config:', error);
    throw error.response?.data?.message || 'Lỗi khi lưu cấu hình hệ thống!';
  }
};

// Tải lên ảnh hệ thống (ảnh nền login, logo, favicon) - Đồng bộ Google Drive
export const uploadSystemImageApi = async (formData) => {
  try {
    const response = await axiosInstance.post('/api/system-config/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading system image:', error);
    throw error.response?.data?.message || 'Lỗi khi tải lên hình ảnh!';
  }
};

// Đặt lại ảnh hệ thống về mặc định (Admin)
export const resetSystemImageApi = async (type) => {
  try {
    const response = await axiosInstance.post('/api/system-config/reset-image', { type });
    return response.data;
  } catch (error) {
    console.error('Error resetting system image:', error);
    throw error.response?.data?.message || 'Lỗi khi đặt lại hình ảnh!';
  }
};
