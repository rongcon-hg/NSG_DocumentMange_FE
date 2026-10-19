/* eslint-disable no-unused-vars */
import { useEffect, useState } from "react";
import { Table, Modal, Form, Input, Button, message, Tooltip, Popconfirm, Switch } from "antd";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { getAllPositions, createPosition, deletePosition, updatePosition, togglePositionStatus } from "../../api/PositionAPI";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

import { removeVietnameseTones } from "../../utils/stringUtils";

const PositionPage = () => {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [searchText, setSearchText] = useState("");

  const filteredPositions = positions.filter((pos) => {
    const searchLower = removeVietnameseTones(searchText.toLowerCase());
    return (
      (pos.positionCode && removeVietnameseTones(pos.positionCode.toLowerCase()).includes(searchLower)) ||
      (pos.positionName && removeVietnameseTones(pos.positionName.toLowerCase()).includes(searchLower))
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

  // Fetch all positions from API
  useEffect(() => {
    fetchPositions();
  }, []);

  const fetchPositions = async () => {
    setLoading(true);
    try {
      const result = await getAllPositions({ includeInactive: true });
      setPositions(result.AllPosition || []);
    } catch (error) {
      message.error("Không thể tải danh sách chức vụ");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (positionID, isActive) => {
    try {
      await togglePositionStatus(positionID, isActive);
      message.success(`Đã ${isActive ? "kích hoạt" : "vô hiệu hóa"} chức vụ!`);
      fetchPositions();
    } catch (error) {
      message.error(error.message || "Lỗi khi cập nhật trạng thái chức vụ!");
    }
  };

  const handleCreatePosition = async (values) => {
    try {
      await createPosition(values);
      message.success("Chức vụ đã được tạo thành công!");
      setIsModalOpen(false);
      form.resetFields();
      fetchPositions();
    } catch (error) {
      message.error("Không thể tạo chức vụ");
    }
  };

  const handleUpdatePosition = async (values) => {
    try {
      await updatePosition({ ...values, positionID: selectedPosition._id });
      message.success("Chức vụ đã được cập nhật thành công!");
      setIsEditModalOpen(false);
      setSelectedPosition(null);
      fetchPositions();
    } catch (error) {
      message.error("Không thể cập nhật chức vụ");
    }
  };

  const handleDeletePosition = (positionID) => {
    Modal.confirm({
      title: "Xác nhận xóa chức vụ",
      content: "Bạn có chắc chắn muốn xóa chức vụ này?",
      okText: "Có",
      okType: "danger",
      cancelText: "Không",
      onOk: async () => {
        try {
          await deletePosition(positionID);
          message.success("Chức vụ đã được xóa thành công!");
          fetchPositions();
        } catch (error) {
          message.error("Không thể xóa chức vụ");
        }
      },
    });
  };

  // Kiểm tra quyền xóa (chỉ admin)
  const hasDeletePermission = () => {
    return currentUserRole === "admin";
  };

  // Kiểm tra quyền chung (admin hoặc manager)
  const hasPermission = () => {
    return currentUserRole === "admin" || currentUserRole === "manager";
  };

  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 60,
      align: "center",
      render: (text, record) => filteredPositions.indexOf(record) + 1,
    },
    {
      title: "Mã chức vụ",
      dataIndex: "positionCode",
      key: "positionCode",
    },
    {
      title: "Tên chức vụ",
      dataIndex: "positionName",
      key: "positionName",
    },
    {
      title: "Số lượng người dùng",
      dataIndex: "userCount",
      key: "userCount",
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      width: 140,
      align: "center",
      render: (isActive, record) => {
        const active = isActive !== false;
        return (
          <div className="flex items-center justify-center gap-1.5">
            <Switch
              size="small"
              checked={active}
              disabled={!hasPermission()}
              onChange={(checked) => handleToggleStatus(record._id, checked)}
            />
            <span className={`text-xs font-semibold ${active ? "text-emerald-600" : "text-gray-400"}`}>
              {active ? "Hoạt động" : "Đã tắt"}
            </span>
          </div>
        );
      },
    },
    {
      title: "Hành Động",
      key: "actions",
      className: "action-col",
      fixed: "right",
      align: "center",
      width: 150,
      render: (_, record) =>
        hasPermission() && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <Tooltip title="Chỉnh sửa">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setSelectedPosition(record);
                  form.setFieldsValue({ positionCode: record.positionCode, positionName: record.positionName });
                  setIsEditModalOpen(true);
                }}
                className="rounded text-xs px-2 flex items-center justify-center h-7"
              >
                <span className="hidden sm:inline text-xs ml-0.5">Sửa</span>
              </Button>
            </Tooltip>
            {hasDeletePermission() && (
              <Popconfirm
                title="Bạn có chắc chắn muốn xóa chức vụ này không?"
                onConfirm={() => handleDeletePosition(record._id)}
                okText="Có"
                cancelText="Không"
              >
                <Tooltip title="Xóa">
                  <Button
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    className="rounded text-xs px-2 flex items-center justify-center h-7"
                  >
                    <span className="hidden sm:inline text-xs ml-0.5">Xóa</span>
                  </Button>
                </Tooltip>
              </Popconfirm>
            )}
          </div>
        ),
    },
  ];

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        {hasPermission() ? (
          <Button
            type="primary"
            onClick={() => setIsModalOpen(true)}
          >
            Thêm chức vụ
          </Button>
        ) : <div />}
        <Input.Search
          placeholder="Tìm kiếm theo mã hoặc tên chức vụ"
          allowClear
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
      </div>

      <Table
        dataSource={filteredPositions}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{ pageSize: 20, showLessItems: true, responsive: true }}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: "Không có dữ liệu",
        }}
      />

      {/* Modal Thêm chức vụ */}
      <Modal
        title="Thêm chức vụ Mới"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleCreatePosition}>
          <Form.Item
            label="Mã chức vụ"
            name="positionCode"
            rules={[{ required: true, message: "Vui lòng nhập mã chức vụ!" }]}
          >
            <Input placeholder="Nhập mã chức vụ" />
          </Form.Item>
          <Form.Item
            label="Tên chức vụ"
            name="positionName"
            rules={[{ required: true, message: "Vui lòng nhập tên chức vụ!" }]}
          >
            <Input placeholder="Nhập tên chức vụ" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: "100%" }}>
              Tạo
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Chỉnh Sửa chức vụ */}
      <Modal
        title="Chỉnh Sửa chức vụ"
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setSelectedPosition(null);
          form.resetFields();
        }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleUpdatePosition}>
          <Form.Item
            label="Mã chức vụ"
            name="positionCode"
            rules={[{ required: true, message: "Vui lòng nhập mã chức vụ!" }]}
          >
            <Input placeholder="Nhập mã chức vụ" />
          </Form.Item>
          <Form.Item
            label="Tên chức vụ"
            name="positionName"
            rules={[{ required: true, message: "Vui lòng nhập tên chức vụ!" }]}
          >
            <Input placeholder="Nhập tên chức vụ" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: "100%" }}>
              Cập Nhật
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PositionPage;