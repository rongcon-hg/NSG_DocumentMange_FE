/* eslint-disable no-unused-vars */
import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, message, Popconfirm, Spin, Card, Space, Tooltip } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { getAllUnits, createUnit, updateUnit, deleteUnit } from "../../api/unitApi";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { removeVietnameseTones } from "../../utils/stringUtils";

const UnitList = () => {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [form] = Form.useForm();
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [searchText, setSearchText] = useState("");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    pageSizeOptions: ['10', '20', '50', '100'],
  });

  const filteredUnits = units.filter((unit) => {
    const searchLower = removeVietnameseTones(searchText.toLowerCase());
    return (
      (unit.unitCode && removeVietnameseTones(unit.unitCode.toLowerCase()).includes(searchLower)) ||
      (unit.unitName && removeVietnameseTones(unit.unitName.toLowerCase()).includes(searchLower))
    );
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

  // Fetch units from API
  const fetchUnits = async () => {
    setLoading(true);
    try {
      const data = await getAllUnits();
      setUnits(data || []);
    } catch (error) {
      message.error("Lỗi khi tải danh sách cơ quan ban hành!");
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  // Open modal for adding
  const handleAdd = () => {
    setEditingUnit(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  // Open modal for editing
  const handleEdit = (record) => {
    setEditingUnit(record);
    form.setFieldsValue({
      unitCode: record.unitCode,
      unitName: record.unitName,
    });
    setIsModalVisible(true);
  };

  // Handle delete confirmation
  const handleDelete = async (unitID) => {
    setLoading(true);
    try {
      await deleteUnit(unitID);
      message.success("Xóa cơ quan ban hành thành công!");
      fetchUnits();
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || "Lỗi khi xóa cơ quan ban hành.";
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Close modal
  const handleModalCancel = () => {
    setIsModalVisible(false);
    setEditingUnit(null);
    form.resetFields();
  };

  // Handle form submission (Add or Update)
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (editingUnit) {
        await updateUnit({ ...values, unitID: editingUnit._id });
        message.success("Cập nhật cơ quan ban hành thành công!");
      } else {
        await createUnit(values);
        message.success("Thêm cơ quan ban hành thành công!");
      }
      setIsModalVisible(false);
      setEditingUnit(null);
      form.resetFields();
      fetchUnits();
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || "Thao tác thất bại. Vui lòng thử lại.";
      message.error(errorMsg);
      console.error("Form submission error:", error);
    } finally {
      setLoading(false);
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

  // Table columns definition
  const columns = [
    {
      title: "STT",
      key: "index",
      render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
      width: 60,
    },
    {
      title: "Mã Cơ quan",
      dataIndex: "unitCode",
      key: "unitCode",
      sorter: (a, b) => (a.unitCode || "").localeCompare(b.unitCode || ""),
    },
    {
      title: "Tên Cơ quan ban hành",
      dataIndex: "unitName",
      key: "unitName",
      sorter: (a, b) => (a.unitName || "").localeCompare(b.unitName || ""),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 100,
      fixed: "right",
      render: (text, record) =>
        hasPermission() && (
          <div className="flex flex-wrap gap-2 justify-center">
            <Tooltip title="Sửa">
              <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small" className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 flex items-center justify-center">
                <span className="hidden sm:inline text-xs">Sửa</span>
              </Button>
            </Tooltip>
            {hasDeletePermission() && (
              <Popconfirm
                title="Bạn chắc chắn muốn xóa?"
                onConfirm={() => handleDelete(record._id)}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true, size: "small" }}
                cancelButtonProps={{ size: "small" }}
              >
                <Tooltip title="Xóa">
                  <Button icon={<DeleteOutlined />} danger size="small" className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 flex items-center justify-center">
                    <span className="hidden sm:inline text-xs">Xóa</span>
                  </Button>
                </Tooltip>
              </Popconfirm>
            )}
          </div>
        ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <Card
        title={<span className="text-xl font-bold">Quản lý Cơ quan ban hành</span>}
        bordered={false}
        className="shadow-sm rounded-lg mb-4"
        extra={
          <Space>
            <Input.Search
              placeholder="Tìm kiếm mã hoặc tên cơ quan"
              allowClear
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 250 }}
            />
            {hasPermission() && (
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                Thêm mới
              </Button>
            )}
          </Space>
        }
      />
      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={filteredUnits}
          rowKey="_id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            pageSizeOptions: pagination.pageSizeOptions,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} cơ quan ban hành`,
            onChange: (page, pageSize) => {
              setPagination(prev => ({
                ...prev,
                current: page,
                pageSize: pageSize,
              }));
            },
            onShowSizeChange: (current, size) => {
              setPagination(prev => ({
                ...prev,
                current: 1,
                pageSize: size,
              }));
            },
          }}
          scroll={{ x: "max-content" }}
          bordered
        />
      </Spin>

      <Modal
        title={editingUnit ? "Sửa Cơ quan ban hành" : "Thêm Cơ quan ban hành mới"}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okText={editingUnit ? "Lưu" : "Thêm"}
        cancelText="Hủy"
        confirmLoading={loading}
        destroyOnClose
        forceRender
      >
        <Form form={form} layout="vertical" name="unitForm" initialValues={{ unitCode: "", unitName: "" }}>
          <Form.Item
            name="unitCode"
            label="Mã Cơ quan"
            rules={[
              { required: true, message: "Vui lòng nhập Mã Cơ quan!" },
              { whitespace: true, message: "Mã không được chứa khoảng trắng!" },
              { pattern: /^[a-zA-Z0-9_.-]*$/, message: "Mã chỉ chứa chữ, số và ký tự _, ., -" },
            ]}
          >
            <Input placeholder="Nhập mã (ví dụ: SNV, SGDDT)" />
          </Form.Item>
          <Form.Item
            name="unitName"
            label="Tên Cơ quan ban hành"
            rules={[
              { required: true, message: "Vui lòng nhập Tên Cơ quan!" },
              { whitespace: true, message: "Tên không được chỉ chứa khoảng trắng!" },
            ]}
          >
            <Input placeholder="Nhập tên (ví dụ: Sở Nội vụ, Sở Giáo dục và Đào tạo)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UnitList;