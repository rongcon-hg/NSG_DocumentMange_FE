/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Switch,
  Space,
  Tag,
  Card,
  message,
  Popconfirm,
  Typography,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  TrophyOutlined,
  CloudDownloadOutlined,
} from "@ant-design/icons";
import {
  getEmulationTitles,
  createEmulationTitle,
  updateEmulationTitle,
  deleteEmulationTitle,
  initDefaultEmulationTitles,
} from "../../api/emulationApi";
import Cookies from "js-cookie";

const { Title, Text } = Typography;
const { TextArea } = Input;

const LEVEL_CONFIG = {
  CO_SO: { label: "Cấp Cơ sở (Trường)", color: "blue" },
  CAP_TP: { label: "Cấp Thành phố", color: "purple" },
  CAP_BO: { label: "Cấp Bộ", color: "orange" },
  CAP_NHA_NUOC: { label: "Cấp Nhà nước", color: "red" },
};

const TARGET_CONFIG = {
  CA_NHAN: { label: "Cá nhân", color: "green" },
  TAP_THE: { label: "Tập thể", color: "cyan" },
  CA_HAI: { label: "Cá nhân & Tập thể", color: "geekblue" },
};

const EmulationTitlePage = () => {
  const [titles, setTitles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const userRole = Cookies.get("userRole");
  const canManage = userRole === "admin" || userRole === "manager";

  const fetchTitles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getEmulationTitles();
      if (res.success) {
        setTitles(res.data || []);
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể tải danh mục danh hiệu");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTitles();
  }, [fetchTitles]);

  const handleOpenModal = (item = null) => {
    setEditingItem(item);
    if (item) {
      form.setFieldsValue({
        code: item.code,
        name: item.name,
        level: item.level,
        targetType: item.targetType,
        description: item.description,
        displayOrder: item.displayOrder,
        isActive: item.isActive,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        level: "CO_SO",
        targetType: "CA_NHAN",
        displayOrder: titles.length + 1,
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
        await updateEmulationTitle(editingItem._id, values);
        message.success("Cập nhật danh hiệu thành công!");
      } else {
        await createEmulationTitle(values);
        message.success("Thêm mới danh hiệu thành công!");
      }
      setModalVisible(false);
      fetchTitles();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || "Có lỗi xảy ra khi lưu dữ liệu");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteEmulationTitle(id);
      message.success("Xóa danh hiệu thành công!");
      fetchTitles();
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể xóa danh hiệu");
    }
  };

  const handleInitDefault = async () => {
    try {
      setLoading(true);
      const res = await initDefaultEmulationTitles();
      message.success(res.message || "Khởi tạo dữ liệu mẫu thành công!");
      fetchTitles();
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
      width: 60,
      align: "center",
      render: (_, __, index) => index + 1,
    },
    {
      title: "Mã",
      dataIndex: "code",
      key: "code",
      width: 110,
      render: (code) => <Tag color="geekblue" className="font-semibold">{code}</Tag>,
    },
    {
      title: "Tên danh hiệu thi đua",
      dataIndex: "name",
      key: "name",
      render: (name) => <span className="font-medium text-gray-800">{name}</span>,
    },
    {
      title: "Cấp khen thưởng",
      dataIndex: "level",
      key: "level",
      width: 170,
      render: (level) => (
        <Tag color={LEVEL_CONFIG[level]?.color || "default"}>
          {LEVEL_CONFIG[level]?.label || level}
        </Tag>
      ),
    },
    {
      title: "Đối tượng",
      dataIndex: "targetType",
      key: "targetType",
      width: 150,
      render: (type) => (
        <Tag color={TARGET_CONFIG[type]?.color || "default"}>
          {TARGET_CONFIG[type]?.label || type}
        </Tag>
      ),
    },
    {
      title: "Tiêu chuẩn / Điều kiện tóm tắt",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (desc) => desc || <Text type="secondary" italic>Chưa có mô tả</Text>,
    },
    {
      title: "Thứ tự",
      dataIndex: "displayOrder",
      key: "displayOrder",
      width: 80,
      align: "center",
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      width: 120,
      align: "center",
      render: (active) => (
        <Tag color={active ? "success" : "default"}>
          {active ? "Đang áp dụng" : "Ngưng áp dụng"}
        </Tag>
      ),
    },
    ...(canManage
      ? [
          {
            title: "Thao tác",
            key: "action",
            width: 130,
            align: "center",
            render: (_, record) => (
              <Space orientation="horizontal" size="small">
                <Tooltip title="Chỉnh sửa">
                  <Button
                    type="text"
                    icon={<EditOutlined className="text-blue-600" />}
                    onClick={() => handleOpenModal(record)}
                  />
                </Tooltip>
                <Tooltip title="Xóa">
                  <Popconfirm
                    title="Xóa danh hiệu này?"
                    description="Bạn có chắc chắn muốn xóa danh hiệu thi đua này không?"
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleDelete(record._id)}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Tooltip>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <Card className="shadow-sm border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-gray-100">
          <div>
            <Title level={4} className="!mb-1 flex items-center gap-2 text-blue-700">
              <TrophyOutlined className="text-yellow-500 text-xl" />
              Danh mục Danh hiệu Thi đua
            </Title>
            <Text type="secondary">
              Quản lý các danh hiệu khen thưởng được áp dụng trong toàn trường
            </Text>
          </div>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={fetchTitles} loading={loading}>
              Làm mới
            </Button>
            {canManage && (
              <>
                <Button
                  icon={<CloudDownloadOutlined />}
                  onClick={handleInitDefault}
                  loading={loading}
                  title="Nạp nhanh các danh hiệu chuẩn ngành giáo dục nếu chưa có"
                >
                  Nạp danh hiệu mẫu
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => handleOpenModal()}
                  style={{ backgroundColor: "#1890ff" }}
                >
                  Thêm danh hiệu
                </Button>
              </>
            )}
          </Space>
        </div>

        <Table
          rowKey="_id"
          columns={columns}
          dataSource={titles}
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true }}
          bordered
          size="middle"
          scroll={{ x: 800 }}
        />
      </Card>

      {/* Modal Thêm / Sửa danh hiệu */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-700">
            <TrophyOutlined className="text-yellow-500" />
            <span>{editingItem ? "Cập nhật danh hiệu thi đua" : "Thêm mới danh hiệu thi đua"}</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        confirmLoading={submitting}
        okText="Lưu lại"
        cancelText="Hủy bỏ"
        destroyOnClose
        width={650}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="code"
              label="Mã danh hiệu"
              rules={[
                { required: true, message: "Vui lòng nhập mã danh hiệu" },
                { pattern: /^[A-Z0-9_-]+$/i, message: "Mã chỉ chứa chữ cái và số (VD: LDTT, CSTDCS)" },
              ]}
            >
              <Input placeholder="VD: LDTT, CSTDCS..." style={{ textTransform: "uppercase" }} />
            </Form.Item>

            <Form.Item
              name="level"
              label="Cấp khen thưởng"
              rules={[{ required: true, message: "Vui lòng chọn cấp khen thưởng" }]}
            >
              <Select>
                <Select.Option value="CO_SO">Cấp Cơ sở (Trường)</Select.Option>
                <Select.Option value="CAP_TP">Cấp Thành phố</Select.Option>
                <Select.Option value="CAP_BO">Cấp Bộ</Select.Option>
                <Select.Option value="CAP_NHA_NUOC">Cấp Nhà nước</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="name"
              label="Tên danh hiệu thi đua"
              rules={[{ required: true, message: "Vui lòng nhập tên danh hiệu" }]}
              className="col-span-1 md:col-span-2"
            >
              <Input placeholder="VD: Lao động tiên tiến, Chiến sĩ thi đua cơ sở..." />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Form.Item
              name="targetType"
              label="Đối tượng áp dụng"
              rules={[{ required: true, message: "Vui lòng chọn đối tượng" }]}
            >
              <Select>
                <Select.Option value="CA_NHAN">Cá nhân</Select.Option>
                <Select.Option value="TAP_THE">Tập thể</Select.Option>
                <Select.Option value="CA_HAI">Cả hai</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="displayOrder" label="Thứ tự hiển thị">
              <InputNumber min={0} className="w-full" />
            </Form.Item>

            <Form.Item name="isActive" label="Trạng thái áp dụng" valuePropName="checked">
              <Switch checkedChildren="Áp dụng" unCheckedChildren="Ngưng" />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Tiêu chuẩn / Điều kiện xét tặng">
            <TextArea
              rows={3}
              placeholder="Nhập tóm tắt điều kiện để đạt danh hiệu này (VD: Hoàn thành tốt nhiệm vụ, có sáng kiến kinh nghiệm...)"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EmulationTitlePage;
