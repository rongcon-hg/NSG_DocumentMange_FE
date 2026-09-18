import axiosInstance from './axiosInstance';

/**
 * Lấy dữ liệu Hồ sơ Đóng góp Số của cán bộ theo năm học hoặc khoảng thời gian
 * @param {Object} params - { userId, year, fromDate, toDate }
 */
export const getStaffScorecard = async (params = {}) => {
    try {
        const response = await axiosInstance.get('/api/staff-scorecard', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching staff scorecard:', error);
        throw error;
    }
};

/**
 * Tải file Excel Báo cáo Hồ sơ Đóng góp Số Cán bộ
 * @param {Object} params - { userId, year, fromDate, toDate }
 */
export const exportStaffScorecardExcel = async (params = {}) => {
    try {
        const response = await axiosInstance.get('/api/staff-scorecard/export-excel', {
            params,
            responseType: 'blob'
        });

        // Tạo link download blob
        const blob = new Blob([response.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Ho_so_dong_gop_can_bo_${params.year || 'nam_hoc'}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting staff scorecard excel:', error);
        throw error;
    }
};
