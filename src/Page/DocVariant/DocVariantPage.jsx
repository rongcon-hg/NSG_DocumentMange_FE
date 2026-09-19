import { useState, useEffect } from "react";
import { Button, message, Select } from "antd";
import { 
  getTotalsByYear, 
  createDocVariant, 
  updateDocVariant, 
  deleteDocVariant, 
  toggleDocVariantStatus 
} from "../../api/docVariantApi";
import DocVariantTable from "../../components/DocVariantTable";
import DocVariantModal from "../../components/DocVariantModal";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { removeVietnameseTones } from "../../utils/stringUtils";
import { Input } from "antd";

const { Option } = Select;

const DocVariantPage = () => {
  const currentYear = new Date().getFullYear();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [searchText, setSearchText] = useState("");

  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  const filteredDocVariants = data.filter((variant) => {
    const searchLower = removeVietnameseTones(searchText.toLowerCase());
    return variant.docVariantName && removeVietnameseTones(variant.docVariantName.toLowerCase()).includes(searchLower);
  });

  // Lấy role của user từ token
  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setCurrentUserRole(decodedToken.role || "");
      } catch (error) {
        console.error("Lỗi khi decode token:", error);
        setCurrentUserRole("");
      }
    }
  }, []);

  const fetchData = async (year) => {
    try {
      setLoading(true);
      const result = await getTotalsByYear(year);
      if (Array.isArray(result)) {
        setData(result);
      } else if (result?.error) {
        message.error(result.error);
        setData([]);
      } else {
        setData([]);
        message.error("Dữ liệu không đúng định dạng");
      }
    } catch (error) {
      message.error("Lỗi khi tải dữ liệu");
      setData([]);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedYear);
  }, [selectedYear]);

  const handleAdd = () => {
    setEditingVariant(null);
    setModalVisible(true);
  };

  const handleEdit = (variant) => {
    setEditingVariant(variant);
    setModalVisible(true);
  };

  const handleToggleStatus = async (docVariantId, isActive) => {
    try {
      // Optimistic update
      setData((prev) =>
        prev.map((item) =>
          item.docVariantId === docVariantId ? { ...item, isActive } : item
        )
      );
      const res = await toggleDocVariantStatus(docVariantId, isActive);
      if (res?.error) {
        message.error(res.error);
        fetchData(selectedYear);
      } else {
        message.success(res?.message || "Cập nhật trạng thái thành công!");
      }
    } catch (error) {
      message.error("Lỗi khi cập nhật trạng thái");
      fetchData(selectedYear);
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    try {
      setLoading(true);
      const response = await deleteDocVariant(id);
      if (response.error) {
        message.error(response.error);
      } else {
        message.success("Xóa thành công!");
        fetchData(selectedYear);
      }
    } catch (error) {
      message.error("Lỗi khi xóa");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (docVariantName) => {
    try {
      setLoading(true);
      if (editingVariant) {
        const response = await updateDocVariant(editingVariant.docVariantId, docVariantName);
        if (response.error) {
          message.error(response.error);
        } else {
          message.success("Cập nhật thành công!");
          fetchData(selectedYear);
        }
      } else {
        const response = await createDocVariant(docVariantName);
        if (response.error) {
          message.error(response.error);
        } else {
          message.success("Thêm thành công!");
          fetchData(selectedYear);
        }
      }
    } catch (error) {
      message.error("Lỗi khi lưu");
      console.error(error);
    } finally {
      setLoading(false);
      setModalVisible(false);
    }
  };

  // Kiểm tra quyền xóa (chỉ admin)
  const hasDeletePermission = () => {
    return currentUserRole === "admin";
  };

  // Kiểm tra quyền chung (admin hoặc manager)
  const hasPermission = () => {
    return currentUserRole === "admin" || currentUserRole === "manager";
  };

  return (
    <div className="p-5">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Quản lý loại văn bản</h1>
        <div className="flex items-center gap-4">
          <div>
            <label className="mr-2">Chọn năm:</label>
            <Select
              value={selectedYear}
              onChange={(value) => setSelectedYear(value)}
              style={{ width: 100 }}
              loading={loading}
              disabled={loading}
            >
              {yearOptions.map((year) => (
                <Option key={year} value={year}>
                  {year}
                </Option>
              ))}
            </Select>
          </div>
          {hasPermission() && (
            <Button
              type="primary"
              onClick={handleAdd}
              loading={loading}
              disabled={loading}
            >
              Thêm Mới
            </Button>
          )}
          <Input.Search
            placeholder="Tìm kiếm loại văn bản"
            allowClear
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 250 }}
          />
        </div>
      </div>
      <DocVariantTable
        data={filteredDocVariants}
        onEdit={hasPermission() ? handleEdit : undefined}
        onDelete={hasDeletePermission() ? handleDelete : undefined}
        onToggleStatus={hasPermission() ? handleToggleStatus : undefined}
        loading={loading}
      />
      <DocVariantModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        editingVariant={editingVariant}
        loading={loading}
        okText={editingVariant ? "Lưu" : "Thêm"}
        cancelText="Hủy"
      />
    </div>
  );
};

export default DocVariantPage;