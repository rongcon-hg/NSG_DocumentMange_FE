import axiosInstance from './axiosInstance.js';



 export const createUnit = async (unitData) => {
    try {
      const response = await axiosInstance.post('/units/create', unitData); 
      return response.data;
    } catch (error) {
      console.error("Error creating unit:", error.response?.data || error.message);
      throw error.response?.data || new Error("Failed to create unit"); 
    }
  };
  export const getAllUnits = async (options = {}) => {
    try {
      const params = {};
      if (options && options.onlyActive !== undefined) {
        params.onlyActive = options.onlyActive ? "true" : "false";
      } else if (!options || !options.includeInactive) {
        params.onlyActive = "true";
      }

      const response = await axiosInstance.get('/units/getAll', { params }); 
      let units = response.data.Units || [];
      if (!options || !options.includeInactive) {
        units = units.filter(u => u.isActive !== false);
      }
      return units; 
    } catch (error) {
      console.error("Error fetching units:", error.response?.data || error.message);
      throw error.response?.data || new Error("Failed to fetch units");
    }
  };
  export const updateUnit = async (unitUpdateData) => {
    try {
    
      const response = await axiosInstance.put('/units/update', unitUpdateData);
      return response.data;
    } catch (error) {
      console.error("Error updating unit:", error.response?.data || error.message);
      throw error.response?.data || new Error("Failed to update unit");
    }
  };
  export const toggleUnitStatus = async (unitID, isActive) => {
    try {
      const response = await axiosInstance.post('/units/toggle-status', { unitID, isActive });
      return response.data;
    } catch (error) {
      console.error("Error toggling unit status:", error.response?.data || error.message);
      throw error.response?.data || new Error("Failed to toggle unit status");
    }
  };
  export const deleteUnit = async (unitID) => {
    try {
      
      const response = await axiosInstance.delete('/units/delete', {
        data: { unitID: unitID } 
      });
      return response.data;
    } catch (error) {
      console.error("Error deleting unit:", error.response?.data || error.message);
      throw error.response?.data || new Error("Failed to delete unit");
    }
  };