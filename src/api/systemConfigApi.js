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
