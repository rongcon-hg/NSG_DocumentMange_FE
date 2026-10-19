import axiosInstance from './axiosInstance.js';


// Lấy tất cả các vị trí (mặc định chỉ lấy các vị trí đang hoạt động)
export const getAllPositions = async (options = {}) => {
  try {
    const params = {};
    if (options && options.onlyActive !== undefined) {
      params.onlyActive = options.onlyActive ? "true" : "false";
    } else if (!options || !options.includeInactive) {
      params.onlyActive = "true";
    }

    const response = await axiosInstance.get("/positions/getAll", { params });

    // Lọc phía client để đảm bảo các vị trí isActive: false bị loại trừ nếu không yêu cầu includeInactive
    if (response && response.data && Array.isArray(response.data.AllPosition)) {
      if (!options || !options.includeInactive) {
        return {
          ...response.data,
          AllPosition: response.data.AllPosition.filter(p => p.isActive !== false)
        };
      }
    }
    return response.data;
  } catch (error) {
    throw new Error(error.message);
  }
};

// Tạo một vị trí mới
export const createPosition = async (positionData) => {
  try {
    const response = await axiosInstance.post("/positions/create", positionData);
    return response.data;
  } catch (error) {
    throw new Error(error.message);
  }
};

// Cập nhật vị trí
export const updatePosition = async (positionData) => {
  try {
    const response = await axiosInstance.post("/positions/update", positionData);
    return response.data;
  } catch (error) {
    throw new Error(error.message);
  }
};

// Đổi trạng thái kích hoạt / vô hiệu hóa vị trí
export const togglePositionStatus = async (positionID, isActive) => {
  try {
    const response = await axiosInstance.post("/positions/toggle-status", { positionID, isActive });
    return response.data;
  } catch (error) {
    throw new Error(error.message);
  }
};

// Xóa vị trí
export const deletePosition = async (positionID) => {
  try {
    const response = await axiosInstance.post("/positions/delete", { positionID });
    return response.data;
  } catch (error) {
    throw new Error(error.message);
  }
};
