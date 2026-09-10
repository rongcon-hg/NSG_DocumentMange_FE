import axiosInstance from './axiosInstance.js';

// API gọi tạo Department
export const createDepartment = async (departmentData) => {
    try {
        const response = await axiosInstance.post("/departments/create", departmentData);
        return response.data;
    } catch (error) {
        console.error("lỗi tạo phòng ban", error);
        throw error;
    }
};
//Api gọi lấy thông tin của 1 Department
export const getUsersByDepartment = async (departmentId) => {
    try {
        const response = await axiosInstance.get(`/departments/${departmentId}`);
        return response.data;
    } catch (error) {
        console.error("Lỗi khi lấy danh sách user:", error);
        throw error;
    }
};
// Helper kiểm tra đơn vị có phải đơn vị giải thể không
export const isDissolvedDepartment = (dept) => {
    if (!dept) return false;
    const name = (typeof dept === 'string' ? dept : dept.departmentName || dept.name || '').toLowerCase();
    return name.includes('giải thể');
};

// API gọi lấy tất cả các Department (mặc định ẩn các đơn vị có chữ "giải thể")
export const getAllDepartments = async (options = {}) => {
    try {
        const params = {};
        if (options && options.includeDissolved) {
            params.includeDissolved = 'true';
        }
        const response = await axiosInstance.get("/departments/getAll", { params });

        // Nếu caller cần lấy toàn bộ (ví dụ trang Quản lý phòng ban của Admin)
        if (options && options.includeDissolved) {
            return response.data;
        }

        const filterDissolved = (item) => !isDissolvedDepartment(item);

        if (response && response.data) {
            if (Array.isArray(response.data.AllDepartment)) {
                return {
                    ...response.data,
                    AllDepartment: response.data.AllDepartment.filter(filterDissolved),
                };
            }
            if (Array.isArray(response.data.departments)) {
                return {
                    ...response.data,
                    departments: response.data.departments.filter(filterDissolved),
                };
            }
            if (Array.isArray(response.data.data)) {
                return {
                    ...response.data,
                    data: response.data.data.filter(filterDissolved),
                };
            }
            if (Array.isArray(response.data)) {
                return response.data.filter(filterDissolved);
            }
        }

        return response.data;
    } catch (error) {
        console.error("lỗi lấy danh sách phòng ban", error);
        throw error;
    }
};

// API gọi xóa Department
export const deleteDepartment = async (departmentID) => {
    try {
        const response = await axiosInstance.post("/departments/delete", { departmentID });
        return response.data;
    } catch (error) {
        console.error("lỗi xóa phòng ban", error);
        throw error;
    }
};

// API gọi cập nhật Department
export const updateDepartment = async (departmentData) => {
    try {
        const response = await axiosInstance.post("/departments/update", departmentData);
        return response.data;
    } catch (error) {
        console.error("lỗi cập nhật phòng ban", error);
        throw error;
    }
};
