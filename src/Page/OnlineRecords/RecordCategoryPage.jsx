/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Tag,
  Card,
  message,
  Popconfirm,
  Typography,
  Tooltip,
  Row,
  Col,
  Statistic,
  Space,
  Result,
  Spin,
} from "antd";
import { useNavigate } from "react-router-dom";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  FolderOpenOutlined,
  CloudDownloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClearOutlined,
  FileDoneOutlined,
} from "@ant-design/icons";
import {
  getRecordCategories,
  createRecordCategory,
  updateRecordCategory,
  deleteRecordCategory,
  initDefaultRecordCategories,
} from "../../api/onlineRecordApi";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getUserInfo } from "../../api/auth";
import { isBghUser } from "../../utils/userClassification";

const { Title, Text } = Typography;
const { TextArea } = Input;

const RecordCategoryPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const navigate = useNavigate();

  // Bộ lọc
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Phân quyền: Chỉ hiển thị và cho phép thao tác với quyền Manager hoặc Admin
  const [checkingRole, setCheckingRole] = useState(true);
  const [canManage, setCanManage] = useState(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        return decoded.role === "admin" || decoded.role === "manager";
      } catch (e) {
        return false;
      }
    }
    return false;
  });

  useEffect(() => {
    const checkRole = async () => {
      const token = Cookies.get("accessToken");
      if (token) {
        try {
          const decoded = jwtDecode(token);
          if (decoded.role === "admin" || decoded.role === "manager") {
            setCanManage(true);
            setCheckingRole(false);
            return;
          }
          if (decoded.userId) {
            const res = await getUserInfo(decoded.userId);
            const r = res?.data?.role;
            if (r === "admin" || r === "manager") {
              setCanManage(true);
            } else {
              setCanManage(false);
            }
          } else {
            setCanManage(false);
          }
        } catch (e) {
          console.error("Lỗi xác thực quyền:", e);
          setCanManage(false);
        } finally {
          setCheckingRole(false);
        }
      } else {
        setCanManage(false);
        setCheckingRole(false);
      }
    };
    checkRole();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getRecordCategories();
      if (res.success) setCategories(res.data || []);
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể tải danh mục hồ sơ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) {
      fetchData();
    }
  }, [canManage, fetchData]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c) => c.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [categories]);

  // Dữ liệu lọc
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const matchSearch =
        !searchText ||
        c.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        c.code?.toLowerCase().includes(searchText.toLowerCase());

      const matchStatus =
        filterStatus === ""
          ? true
          : filterStatus === "active"
          ? c.isActive
          : !c.isActive;

      return matchSearch && matchStatus;
    });
  }, [categories, searchText, filterStatus]);

  const handleOpenModal = (item = null) => {
    setEditingItem(item);
    if (item) {
      form.setFieldsValue({
        code: item.code,
        name: item.name,
        description: item.description,
        displayOrder: item.displayOrder,
        isActive: item.isActive,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        displayOrder: categories.length + 1,
        isActive: true,
      });
    }
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingItem) {
        await updateRecordCategory(editingItem._id, values);
        message.success("Cập nhật danh mục hồ sơ thành công!");
      } else {
        await createRecordCategory(values);
        message.success("Thêm mới danh mục hồ sơ thành công!");
      }
      setModalVisible(false);
      fetchData();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || "Có lỗi xảy ra khi lưu dữ liệu");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRecordCategory(id);
      message.success("Xóa loại hồ sơ thành công!");
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể xóa loại hồ sơ");
    }
  };

  const handleToggleStatus = async (record, checked) => {
    try {
      await updateRecordCategory(record._id, { isActive: checked });
      message.success(
        `Đã ${checked ? "bật áp dụng" : "tắt áp dụng"} danh mục ${record.name}`
      );
      setCategories((prev) =>
        prev.map((c) => (c._id === record._id ? { ...c, isActive: checked } : c))
      );
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể thay đổi trạng thái");
    }
  };

  const handleInitDefault = async () => {
    try {
      setLoading(true);
      const res = await initDefaultRecordCategories();
      message.success(res.message || "Khởi tạo dữ liệu mẫu thành công!");
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi khi khởi tạo danh mục mẫu");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 55,
      align: "center",
      render: (_, __, index) => (
        <span className="font-semibold text-gray-500">{index + 1}</span>
      ),
    },
    {
      title: "Mã loại hồ sơ",
      dataIndex: "code",
      key: "code",
      width: 130,
      align: "center",
      render: (code) => (
        <Tag color="geekblue" className="font-mono font-bold px-2 py-0.5">
          {code}
        </Tag>
      ),
    },
    {
      title: "Tên loại hồ sơ",
      dataIndex: "name",
      key: "name",
      minWidth: 240,
      render: (name) => (
        <div className="flex items-center gap-2 py-1">
          <FolderOpenOutlined className="text-blue-500 text-base flex-shrink-0" />
          <span className="font-semibold text-gray-900 text-sm">{name}</span>
        </div>
      ),
    },
    {
      title: "Mô tả / Hướng dẫn áp dụng",
      dataIndex: "description",
      key: "description",
      minWidth: 260,
      render: (desc) => {
        if (!desc) {
          return <Text type="secondary" italic className="text-xs">Chưa có hướng dẫn</Text>;
        }
        return (
          <div className="text-xs text-gray-700 leading-relaxed py-1">
            {desc}
          </div>
        );
      },
    },
    {
      title: "Thứ tự",
      dataIndex: "displayOrder",
      key: "displayOrder",
      width: 75,
      align: "center",
      render: (val) => <span className="font-semibold text-slate-600">{val}</span>,
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      width: 110,
      align: "center",
      render: (active, record) => {
        if (canManage) {
          return (
            <Tooltip title={active ? "Bấm để ngưng áp dụng" : "Bấm để kích hoạt áp dụng"}>
              <Switch
                size="small"
                checked={active}
                checkedChildren="Áp dụng"
                unCheckedChildren="Ngưng"
                onChange={(checked) => handleToggleStatus(record, checked)}
              />
            </Tooltip>
          );
        }
        return (
          <Tag
            icon={active ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            color={active ? "success" : "default"}
            className="rounded-full px-2"
          >
            {active ? "Áp dụng" : "Ngưng"}
          </Tag>
        );
      },
    },
    ...(canManage
      ? [
          {
            title: "Thao tác",
            key: "action",
            width: 130,
            align: "center",
            fixed: "right",
            render: (_, record) => (
              <div className="flex flex-row items-center justify-center gap-1.5 py-0.5">
                <Tooltip title="Chỉnh sửa">
                  <Button
                    type="primary"
                    ghost
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleOpenModal(record)}
                    className="rounded text-xs flex items-center px-2 py-0.5"
                  >
                    Sửa
                  </Button>
                </Tooltip>
                <Tooltip title="Xóa loại hồ sơ">
                  <Popconfirm
                    title="Xóa loại hồ sơ này?"
                    description="Bạn có chắc chắn muốn xóa loại hồ sơ này không?"
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleDelete(record._id)}
                  >
                    <Button
                      type="primary"
                      danger
                      ghost
                      size="small"
                      icon={<DeleteOutlined />}
                      className="rounded text-xs flex items-center px-2 py-0.5"
                    >
                      Xóa
                    </Button>
                  </Popconfirm>
                </Tooltip>
              </div>
            ),
          },
        ]
      : []),
  ];

  if (checkingRole) {
    return (
      <div className="flex justify-center items-center py-24">
        <Spin size="large" tip="Đang kiểm tra quyền truy cập..." />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="w-full px-2 sm:px-4 py-12 flex justify-center">
        <Result
          status="403"
          title="Không có quyền truy cập"
          subTitle="Trang quản lý Danh mục hồ sơ trực tuyến chỉ hiển thị với quyền Quản lý (Manager)."
          extra={
            <Button type="primary" onClick={() => navigate("/online-records/list")}>
              Về trang Quản lý hồ sơ
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="w-full px-2 sm:px-4 py-3 space-y-3">
      {/* 1. THẺ THỐNG KÊ */}
      <Row gutter={[10, 10]}>
        <Col xs={12} sm={8}>
          <Card className="shadow-2xs border-l-4 border-l-blue-500 !p-2 sm:!p-3">
            <Statistic
              title={<span className="text-xs text-gray-500 font-medium">Tổng danh mục hồ sơ</span>}
              value={stats.total}
              prefix={<FileDoneOutlined className="text-blue-500 text-base" />}
              valueStyle={{ fontSize: "1.2rem", fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="shadow-2xs border-l-4 border-l-green-500 !p-2 sm:!p-3">
            <Statistic
              title={<span className="text-xs text-gray-500 font-medium">Đang áp dụng</span>}
              value={stats.active}
              prefix={<CheckCircleOutlined className="text-green-500 text-base" />}
              valueStyle={{ fontSize: "1.2rem", fontWeight: "bold", color: "#389e0d" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="shadow-2xs border-l-4 border-l-gray-400 !p-2 sm:!p-3">
            <Statistic
              title={<span className="text-xs text-gray-500 font-medium">Ngưng áp dụng</span>}
              value={stats.inactive}
              prefix={<CloseCircleOutlined className="text-gray-400 text-base" />}
              valueStyle={{ fontSize: "1.2rem", fontWeight: "bold" }}
            />
          </Card>
        </Col>
      </Row>

      {/* 2. CARD CHÍNH */}
      <Card className="shadow-sm border-gray-200 w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-gray-100">
          <div>
            <Title level={4} className="!mb-0 flex items-center gap-2 text-blue-800 text-base sm:text-lg">
              <FolderOpenOutlined className="text-blue-600 text-xl" />
              Danh Mục Loại Hồ Sơ Trực Tuyến
            </Title>
            <Text type="secondary" className="text-xs">
              Quản lý các loại hồ sơ phục vụ cho việc gửi và tiếp nhận hồ sơ trực tuyến trong toàn trường
            </Text>
          </div>

          <Space wrap className="w-full md:w-auto justify-end">
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} size="middle">
              Làm mới
            </Button>
            {canManage && (
              <>
                <Button
                  icon={<CloudDownloadOutlined />}
                  onClick={handleInitDefault}
                  loading={loading}
                  size="middle"
                  title="Nạp nhanh các loại hồ sơ mẫu thông dụng"
                >
                  Nạp hồ sơ mẫu
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => handleOpenModal()}
                  className="bg-blue-600 hover:bg-blue-700 shadow-sm"
                  size="middle"
                >
                  Thêm loại hồ sơ
                </Button>
              </>
            )}
          </Space>
        </div>

        {/* BỘ LỌC */}
        <div className="my-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <Text className="text-xs text-gray-500 font-medium block mb-1">
                Tìm kiếm mã hoặc tên:
              </Text>
              <Input
                placeholder="Nhập tên hoặc mã hồ sơ..."
                prefix={<SearchOutlined className="text-gray-400" />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </div>

            <div>
              <Text className="text-xs text-gray-500 font-medium block mb-1">
                Trạng thái áp dụng:
              </Text>
              <select
                className="w-full border border-gray-300 rounded px-2.5 py-1 text-sm bg-white"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="active">Đang áp dụng</option>
                <option value="inactive">Ngưng áp dụng</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                icon={<ClearOutlined />}
                onClick={() => {
                  setSearchText("");
                  setFilterStatus("");
                }}
                className="w-full"
                disabled={!searchText && !filterStatus}
              >
                Xóa bộ lọc
              </Button>
            </div>
          </div>
        </div>

        {/* BẢNG DỮ LIỆU */}
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={filteredCategories}
          loading={loading}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showLessItems: true,
            responsive: true,
            pageSizeOptions: ["10", "15", "25", "50"],
            showTotal: (totalCount) => `Tổng cộng ${totalCount} loại hồ sơ`,
          }}
          bordered
          size="middle"
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: "Không tìm thấy loại hồ sơ nào phù hợp",
          }}
        />
      </Card>

      {/* MODAL THÊM / SỬA */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-700 text-base">
            <FolderOpenOutlined className="text-blue-600 text-xl" />
            <span className="font-bold">
              {editingItem ? "Cập nhật loại hồ sơ trực tuyến" : "Thêm mới loại hồ sơ trực tuyến"}
            </span>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        confirmLoading={submitting}
        okText="Lưu lại"
        cancelText="Hủy bỏ"
        destroyOnClose
        width={600}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="code"
            label="Mã loại hồ sơ"
            rules={[
              { required: true, message: "Vui lòng nhập mã hồ sơ" },
              { pattern: /^[A-Z0-9_-]+$/i, message: "Mã chỉ gồm chữ cái và số (VD: HS_THU_VIEC, HS_NGHI_PHEP)" },
            ]}
          >
            <Input placeholder="VD: HS_THU_VIEC, HS_BOI_DUONG..." style={{ textTransform: "uppercase" }} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Tên loại hồ sơ"
            rules={[{ required: true, message: "Vui lòng nhập tên loại hồ sơ" }]}
          >
            <Input placeholder="VD: Hồ sơ đánh giá hết thời gian tập sự / thử việc..." />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="displayOrder" label="Thứ tự hiển thị">
              <InputNumber min={0} className="w-full" />
            </Form.Item>

            <Form.Item name="isActive" label="Trạng thái áp dụng" valuePropName="checked">
              <Switch checkedChildren="Áp dụng" unCheckedChildren="Ngưng" />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Quy cách định dạng / Mô tả hướng dẫn">
            <TextArea
              rows={3}
              placeholder="VD: Dành cho giảng viên, viên chức mới hoàn thành thời gian tập sự..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RecordCategoryPage;
