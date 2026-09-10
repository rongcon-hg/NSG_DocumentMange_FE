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
  FileDoneOutlined,
  CloudDownloadOutlined,
} from "@ant-design/icons";
import {
  getEmulationDocTypes,
  createEmulationDocType,
  updateEmulationDocType,
  deleteEmulationDocType,
  initDefaultEmulationDocTypes,
  getEmulationTitles,
} from "../../api/emulationApi";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getUserInfo } from "../../api/auth";
import { isBghUser } from "../../utils/userClassification";

const { Title, Text } = Typography;
const { TextArea } = Input;

const EmulationDocumentPage = () => {
  const [docTypes, setDocTypes] = useState([]);
  const [titles, setTitles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Kiểm tra quyền manager/admin hoặc Ban Giám hiệu
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
            return;
          }
          if (decoded.userId) {
            const res = await getUserInfo(decoded.userId);
            if (res?.data && isBghUser(res.data)) {
              setCanManage(true);
            }
          }
        } catch (e) {
          console.error("Lỗi xác thực quyền:", e);
        }
      }
    };
    checkRole();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resDoc, resTitle] = await Promise.all([
        getEmulationDocTypes(),
        getEmulationTitles({ activeOnly: "true" }),
      ]);
      if (resDoc.success) setDocTypes(resDoc.data || []);
      if (resTitle.success) setTitles(resTitle.data || []);
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể tải danh mục hồ sơ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenModal = (item = null) => {
    setEditingItem(item);
    if (item) {
      form.setFieldsValue({
        code: item.code,
        name: item.name,
        isRequired: item.isRequired,
        applicableTitles: item.applicableTitles?.map((t) => (typeof t === "object" ? t._id : t)) || [],
        description: item.description,
        sampleFileUrl: item.sampleFileUrl,
        displayOrder: item.displayOrder,
        isActive: item.isActive,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        isRequired: false,
        applicableTitles: [],
        displayOrder: docTypes.length + 1,
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
        await updateEmulationDocType(editingItem._id, values);
        message.success("Cập nhật loại hồ sơ thành công!");
      } else {
        await createEmulationDocType(values);
        message.success("Thêm mới loại hồ sơ thành công!");
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
      await deleteEmulationDocType(id);
      message.success("Xóa loại hồ sơ thành công!");
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể xóa loại hồ sơ");
    }
  };

  const handleInitDefault = async () => {
    try {
      setLoading(true);
      const res = await initDefaultEmulationDocTypes();
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
      width: 60,
      align: "center",
      render: (_, __, index) => index + 1,
    },
    {
      title: "Mã loại hồ sơ",
      dataIndex: "code",
      key: "code",
      width: 130,
      render: (code) => <Tag color="blue" className="font-semibold">{code}</Tag>,
    },
    {
      title: "Tên loại hồ sơ / Minh chứng",
      dataIndex: "name",
      key: "name",
      render: (name, record) => (
        <div>
          <span className="font-medium text-gray-800">{name}</span>
          {record.isRequired && (
            <Tag color="error" className="ml-2">
              Bắt buộc
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "Danh hiệu áp dụng",
      dataIndex: "applicableTitles",
      key: "applicableTitles",
      render: (list) => {
        if (!list || list.length === 0) {
          return <Tag color="default">Áp dụng chung</Tag>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {list.map((t) => (
              <Tag color="cyan" key={t._id || t}>
                {t.name || t.code || t}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: "Quy cách / Hướng dẫn tài liệu",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (desc) => desc || <Text type="secondary" italic>Chưa có hướng dẫn</Text>,
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
            width: 120,
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
                    title="Xóa loại hồ sơ này?"
                    description="Bạn có chắc chắn muốn xóa loại hồ sơ này không?"
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
              <FileDoneOutlined className="text-blue-600 text-xl" />
              Danh mục Loại Hồ sơ Minh chứng
            </Title>
            <Text type="secondary">
              Quản lý các loại hồ sơ, báo cáo thành tích yêu cầu cán bộ đính kèm khi đăng ký thi đua
            </Text>
          </div>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
              Làm mới
            </Button>
            {canManage && (
              <>
                <Button
                  icon={<CloudDownloadOutlined />}
                  onClick={handleInitDefault}
                  loading={loading}
                  title="Nạp nhanh các loại hồ sơ thông dụng"
                >
                  Nạp hồ sơ mẫu
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => handleOpenModal()}
                  style={{ backgroundColor: "#1890ff" }}
                >
                  Thêm loại hồ sơ
                </Button>
              </>
            )}
          </Space>
        </div>

        <Table
          rowKey="_id"
          columns={columns}
          dataSource={docTypes}
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true }}
          bordered
          size="middle"
          scroll={{ x: 800 }}
        />
      </Card>

      {/* Modal Thêm / Sửa loại hồ sơ */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-700">
            <FileDoneOutlined />
            <span>{editingItem ? "Cập nhật loại hồ sơ minh chứng" : "Thêm mới loại hồ sơ minh chứng"}</span>
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
              label="Mã loại hồ sơ"
              rules={[
                { required: true, message: "Vui lòng nhập mã hồ sơ" },
                { pattern: /^[A-Z0-9_-]+$/i, message: "Mã chỉ gồm chữ cái và số (VD: BAN_DANG_KY, SKKN)" },
              ]}
            >
              <Input placeholder="VD: BAN_DANG_KY, BC_THANH_TICH..." style={{ textTransform: "uppercase" }} />
            </Form.Item>

            <Form.Item name="isRequired" label="Yêu cầu bắt buộc" valuePropName="checked">
              <Switch checkedChildren="Bắt buộc" unCheckedChildren="Tùy chọn" />
            </Form.Item>
          </div>

          <Form.Item
            name="name"
            label="Tên loại hồ sơ minh chứng"
            rules={[{ required: true, message: "Vui lòng nhập tên loại hồ sơ" }]}
          >
            <Input placeholder="VD: Bản giao ước đăng ký thi đua cá nhân, Báo cáo thành tích..." />
          </Form.Item>

          <Form.Item
            name="applicableTitles"
            label="Danh hiệu áp dụng tương ứng"
            tooltip="Nếu để trống sẽ tự động áp dụng chung cho tất cả danh hiệu"
          >
            <Select
              mode="multiple"
              placeholder="Chọn danh hiệu áp dụng (để trống nếu áp dụng chung)"
              allowClear
              optionFilterProp="children"
            >
              {titles.map((t) => (
                <Select.Option key={t._id} value={t._id}>
                  {t.name} ({t.code})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="displayOrder" label="Thứ tự hiển thị">
              <InputNumber min={0} className="w-full" />
            </Form.Item>

            <Form.Item name="isActive" label="Trạng thái áp dụng" valuePropName="checked">
              <Switch checkedChildren="Áp dụng" unCheckedChildren="Ngưng" />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Quy cách định dạng / Hướng dẫn nộp file">
            <TextArea
              rows={3}
              placeholder="VD: Định dạng file PDF hoặc DOCX, có chữ ký của cá nhân và xác nhận..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EmulationDocumentPage;
