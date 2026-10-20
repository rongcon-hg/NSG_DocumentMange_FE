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

// API gọi lấy tất cả các Department (mặc định ẩn các đơn vị có chữ "giải thể" và các đơn vị bị vô hiệu hóa)
export const getAllDepartments = async (options = {}) => {
    try {
        const params = {};
        if (options && options.includeDissolved) {
            params.includeDissolved = 'true';
        }
        if (options && options.onlyActive !== undefined) {
            params.onlyActive = options.onlyActive ? 'true' : 'false';
        } else if (!options || !options.includeInactive) {
            // Mặc định chỉ lấy các phòng ban đang kích hoạt
            params.onlyActive = 'true';
        }

        const response = await axiosInstance.get("/departments/getAll", { params });

        // Nếu caller cần lấy toàn bộ không lọc client (ví dụ trang Quản lý phòng ban của Admin)
        if (options && (options.includeInactive || options.onlyActive === false)) {
            if (options.includeDissolved) return response.data;
            const filterDissolvedOnly = (item) => !isDissolvedDepartment(item);
            if (response && response.data) {
                if (Array.isArray(response.data.AllDepartment)) return { ...response.data, AllDepartment: response.data.AllDepartment.filter(filterDissolvedOnly) };
                if (Array.isArray(response.data)) return response.data.filter(filterDissolvedOnly);
            }
            return response.data;
        }

        const filterActiveAndDissolved = (item) => {
            if (isDissolvedDepartment(item)) return false;
            if (item.isActive === false) return false;
            return true;
        };

        if (response && response.data) {
            if (Array.isArray(response.data.AllDepartment)) {
                return {
                    ...response.data,
                    AllDepartment: response.data.AllDepartment.filter(filterActiveAndDissolved),
                };
            }
            if (Array.isArray(response.data.departments)) {
                return {
                    ...response.data,
                    departments: response.data.departments.filter(filterActiveAndDissolved),
                };
            }
            if (Array.isArray(response.data.data)) {
                return {
                    ...response.data,
                    data: response.data.data.filter(filterActiveAndDissolved),
                };
            }
            if (Array.isArray(response.data)) {
                return response.data.filter(filterActiveAndDissolved);
            }
        }

        return response.data;
    } catch (error) {
        console.error("lỗi lấy danh sách phòng ban", error);
        throw error;
    }
};

export const getDepartments = getAllDepartments;

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

// API gọi đổi trạng thái Kích hoạt / Vô hiệu hóa Department
export const toggleDepartmentStatus = async (departmentID, isActive) => {
    try {
        const response = await axiosInstance.post("/departments/toggle-status", { departmentID, isActive });
        return response.data;
    } catch (error) {
        console.error("lỗi đổi trạng thái phòng ban", error);
        throw error;
    }
};
