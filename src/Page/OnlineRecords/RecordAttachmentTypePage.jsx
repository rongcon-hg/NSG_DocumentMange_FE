/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
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
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  PaperClipOutlined,
  CloudDownloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClearOutlined,
  FileDoneOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import {
  getRecordAttachmentTypes,
  createRecordAttachmentType,
  updateRecordAttachmentType,
  deleteRecordAttachmentType,
  initDefaultRecordAttachmentTypes,
  getRecordCategories,
} from "../../api/onlineRecordApi";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getUserInfo } from "../../api/auth";
import { isBghUser } from "../../utils/userClassification";

const { Title, Text } = Typography;
const { TextArea } = Input;

const RecordAttachmentTypePage = () => {
  const [attachmentTypes, setAttachmentTypes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Bộ lọc
  const [searchText, setSearchText] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterRequired, setFilterRequired] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

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
      const [resTypes, resCats] = await Promise.all([
        getRecordAttachmentTypes(),
        getRecordCategories({ activeOnly: "true" }),
      ]);
      if (resTypes.success) setAttachmentTypes(resTypes.data || []);
      if (resCats.success) setCategories(resCats.data || []);
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể tải danh mục file đính kèm");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = attachmentTypes.length;
    const required = attachmentTypes.filter((t) => t.isRequired).length;
    const optional = total - required;
    const active = attachmentTypes.filter((t) => t.isActive).length;
    return { total, required, optional, active };
  }, [attachmentTypes]);

  // Dữ liệu lọc
  const filteredTypes = useMemo(() => {
    return attachmentTypes.filter((item) => {
      const matchSearch =
        !searchText ||
        item.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.code?.toLowerCase().includes(searchText.toLowerCase());

      const matchCat =
        !filterCategory ||
        (item.applicableCategories &&
          item.applicableCategories.some(
            (c) => (c._id || c) === filterCategory
          )) ||
        (!item.applicableCategories || item.applicableCategories.length === 0);

      const matchRequired =
        filterRequired === ""
          ? true
          : filterRequired === "true"
          ? item.isRequired
          : !item.isRequired;

      const matchStatus =
        filterStatus === ""
          ? true
          : filterStatus === "active"
          ? item.isActive
          : !item.isActive;

      return matchSearch && matchCat && matchRequired && matchStatus;
    });
  }, [attachmentTypes, searchText, filterCategory, filterRequired, filterStatus]);

  const handleOpenModal = (item = null) => {
    setEditingItem(item);
    if (item) {
      form.setFieldsValue({
        code: item.code,
        name: item.name,
        applicableCategories:
          item.applicableCategories?.map((c) => (typeof c === "object" ? c._id : c)) || [],
        isRequired: item.isRequired,
        allowedExtensions: item.allowedExtensions,
        description: item.description,
        displayOrder: item.displayOrder,
        isActive: item.isActive,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        applicableCategories: [],
        isRequired: false,
        allowedExtensions: ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg",
        displayOrder: attachmentTypes.length + 1,
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
        await updateRecordAttachmentType(editingItem._id, values);
        message.success("Cập nhật loại file đính kèm thành công!");
      } else {
        await createRecordAttachmentType(values);
        message.success("Thêm mới loại file đính kèm thành công!");
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
      await deleteRecordAttachmentType(id);
      message.success("Xóa loại file đính kèm thành công!");
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể xóa loại file");
    }
  };

  const handleToggleStatus = async (record, checked) => {
    try {
      await updateRecordAttachmentType(record._id, { isActive: checked });
      message.success(
        `Đã ${checked ? "bật áp dụng" : "tắt áp dụng"} file ${record.name}`
      );
      setAttachmentTypes((prev) =>
        prev.map((t) => (t._id === record._id ? { ...t, isActive: checked } : t))
      );
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể thay đổi trạng thái");
    }
  };

  const handleInitDefault = async () => {
    try {
      setLoading(true);
      const res = await initDefaultRecordAttachmentTypes();
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
      title: "Mã loại file",
      dataIndex: "code",
      key: "code",
      width: 130,
      align: "center",
      render: (code) => (
        <Tag color="cyan" className="font-mono font-bold px-2 py-0.5">
          {code}
        </Tag>
      ),
    },
    {
      title: "Tên loại file đính kèm",
      dataIndex: "name",
      key: "name",
      minWidth: 230,
      render: (name, record) => (
        <div className="flex items-center gap-2 py-1">
          <PaperClipOutlined className="text-blue-500 text-base flex-shrink-0" />
          <div>
            <span className="font-semibold text-gray-900 text-sm">{name}</span>
            {record.isRequired && (
              <Tag color="error" className="ml-2 text-xs">
                Bắt buộc
              </Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Tính chất",
      dataIndex: "isRequired",
      key: "isRequired",
      width: 100,
      align: "center",
      render: (req) =>
        req ? (
          <Tag color="error" className="font-medium">
            Bắt buộc
          </Tag>
        ) : (
          <Tag color="default" className="text-gray-500">
            Tùy chọn
          </Tag>
        ),
    },
    {
      title: "Loại hồ sơ áp dụng",
      dataIndex: "applicableCategories",
      key: "applicableCategories",
      width: 200,
      render: (list) => {
        if (!list || list.length === 0) {
          return <Tag color="default">Áp dụng chung toàn bộ</Tag>;
        }
        return (
          <div className="flex flex-wrap gap-1 py-1">
            {list.map((c) => (
              <Tag color="blue" key={c._id || c} className="text-xs">
                {c.name || c.code || c}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: "Định dạng cho phép",
      dataIndex: "allowedExtensions",
      key: "allowedExtensions",
      width: 150,
      render: (ext) => (
        <span className="text-xs font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
          {ext || "*.*"}
        </span>
      ),
    },
    {
      title: "Hướng dẫn nộp",
      dataIndex: "description",
      key: "description",
      minWidth: 240,
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
      width: 70,
      align: "center",
      render: (val) => <span className="font-semibold text-slate-600">{val}</span>,
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      width: 105,
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
                <Tooltip title="Xóa loại file">
                  <Popconfirm
                    title="Xóa loại file này?"
                    description="Bạn có chắc chắn muốn xóa loại file đính kèm này không?"
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

  return (
    <div className="w-full px-2 sm:px-4 py-3 space-y-3">
      {/* 1. THẺ THỐNG KÊ */}
      <Row gutter={[10, 10]}>
        <Col xs={12} sm={6}>
          <Card className="shadow-2xs border-l-4 border-l-blue-500 !p-2 sm:!p-3">
            <Statistic
              title={<span className="text-xs text-gray-500 font-medium">Tổng loại file</span>}
              value={stats.total}
              prefix={<PaperClipOutlined className="text-blue-500 text-base" />}
              valueStyle={{ fontSize: "1.2rem", fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="shadow-2xs border-l-4 border-l-red-500 !p-2 sm:!p-3">
            <Statistic
              title={<span className="text-xs text-gray-500 font-medium">Bắt buộc nộp</span>}
              value={stats.required}
              prefix={<ExclamationCircleOutlined className="text-red-500 text-base" />}
              valueStyle={{ fontSize: "1.2rem", fontWeight: "bold", color: "#cf1322" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="shadow-2xs border-l-4 border-l-cyan-500 !p-2 sm:!p-3">
            <Statistic
              title={<span className="text-xs text-gray-500 font-medium">Tùy chọn</span>}
              value={stats.optional}
              valueStyle={{ fontSize: "1.2rem", fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="shadow-2xs border-l-4 border-l-green-500 !p-2 sm:!p-3">
            <Statistic
              title={<span className="text-xs text-gray-500 font-medium">Đang áp dụng</span>}
              value={stats.active}
              prefix={<CheckCircleOutlined className="text-green-500 text-base" />}
              valueStyle={{ fontSize: "1.2rem", fontWeight: "bold", color: "#389e0d" }}
            />
          </Card>
        </Col>
      </Row>

      {/* 2. CARD CHÍNH */}
      <Card className="shadow-sm border-gray-200 w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-gray-100">
          <div>
            <Title level={4} className="!mb-0 flex items-center gap-2 text-blue-800 text-base sm:text-lg">
              <PaperClipOutlined className="text-blue-600 text-xl" />
              Danh Mục File Đính Kèm Theo Hồ Sơ
            </Title>
            <Text type="secondary" className="text-xs">
              Cấu hình các loại giấy tờ, biên bản, biểu mẫu yêu cầu cán bộ đính kèm tương ứng với từng loại hồ sơ trực tuyến
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
                  title="Nạp nhanh các loại file mẫu thông dụng"
                >
                  Nạp file mẫu
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => handleOpenModal()}
                  className="bg-blue-600 hover:bg-blue-700 shadow-sm"
                  size="middle"
                >
                  Thêm loại file
                </Button>
              </>
            )}
          </Space>
        </div>

        {/* BỘ LỌC */}
        <div className="my-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div>
              <Text className="text-xs text-gray-500 font-medium block mb-1">
                Tìm mã hoặc tên file:
              </Text>
              <Input
                placeholder="Nhập tên hoặc mã file..."
                prefix={<SearchOutlined className="text-gray-400" />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </div>

            <div>
              <Text className="text-xs text-gray-500 font-medium block mb-1">
                Thuộc loại hồ sơ:
              </Text>
              <Select
                className="w-full"
                value={filterCategory}
                onChange={setFilterCategory}
                placeholder="Tất cả loại hồ sơ"
                allowClear
              >
                <Select.Option value="">Tất cả loại hồ sơ</Select.Option>
                {categories.map((c) => (
                  <Select.Option key={c._id} value={c._id}>
                    {c.name}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div>
              <Text className="text-xs text-gray-500 font-medium block mb-1">
                Tính chất yêu cầu:
              </Text>
              <Select
                className="w-full"
                value={filterRequired}
                onChange={setFilterRequired}
                placeholder="Tất cả tính chất"
                allowClear
              >
                <Select.Option value="">Tất cả tính chất</Select.Option>
                <Select.Option value="true">Bắt buộc nộp</Select.Option>
                <Select.Option value="false">Tùy chọn</Select.Option>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                icon={<ClearOutlined />}
                onClick={() => {
                  setSearchText("");
                  setFilterCategory("");
                  setFilterRequired("");
                  setFilterStatus("");
                }}
                className="w-full"
                disabled={!searchText && !filterCategory && !filterRequired && !filterStatus}
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
          dataSource={filteredTypes}
          loading={loading}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showLessItems: true,
            responsive: true,
            pageSizeOptions: ["10", "15", "25", "50"],
            showTotal: (totalCount) => `Tổng cộng ${totalCount} loại file đính kèm`,
          }}
          bordered
          size="middle"
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: "Không tìm thấy loại file nào phù hợp",
          }}
        />
      </Card>

      {/* MODAL THÊM / SỬA */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-700 text-base">
            <PaperClipOutlined className="text-blue-600 text-xl" />
            <span className="font-bold">
              {editingItem ? "Cập nhật loại file đính kèm" : "Thêm mới loại file đính kèm"}
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
        width={650}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="code"
              label="Mã loại file"
              rules={[
                { required: true, message: "Vui lòng nhập mã file" },
                { pattern: /^[A-Z0-9_-]+$/i, message: "Mã chỉ gồm chữ cái và số (VD: DON_DE_NGHI, GIAY_XAC_NHAN)" },
              ]}
            >
              <Input placeholder="VD: DON_DE_NGHI, MINH_CHUNG..." style={{ textTransform: "uppercase" }} />
            </Form.Item>

            <Form.Item name="isRequired" label="Tính chất yêu cầu" valuePropName="checked">
              <Switch checkedChildren="Bắt buộc nộp" unCheckedChildren="Tùy chọn" />
            </Form.Item>
          </div>

          <Form.Item
            name="name"
            label="Tên loại file đính kèm"
            rules={[{ required: true, message: "Vui lòng nhập tên loại file" }]}
          >
            <Input placeholder="VD: Đơn đề nghị thanh toán bồi dưỡng, Giấy xác nhận..." />
          </Form.Item>

          <Form.Item
            name="applicableCategories"
            label="Áp dụng cho loại hồ sơ nào"
            tooltip="Nếu để trống sẽ áp dụng chung cho tất cả các loại hồ sơ trực tuyến"
          >
            <Select
              mode="multiple"
              placeholder="Chọn loại hồ sơ áp dụng (để trống nếu áp dụng chung)"
              allowClear
              optionFilterProp="children"
            >
              {categories.map((c) => (
                <Select.Option key={c._id} value={c._id}>
                  {c.name} ({c.code})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="allowedExtensions"
            label="Định dạng tệp cho phép tải lên"
            tooltip="Danh sách đuôi file phân cách bằng dấu phẩy"
          >
            <Input placeholder=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg" />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="displayOrder" label="Thứ tự hiển thị">
              <InputNumber min={0} className="w-full" />
            </Form.Item>

            <Form.Item name="isActive" label="Trạng thái áp dụng" valuePropName="checked">
              <Switch checkedChildren="Áp dụng" unCheckedChildren="Ngưng" />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Quy cách định dạng / Hướng dẫn nộp">
            <TextArea
              rows={3}
              placeholder="VD: File scan định dạng PDF rõ nét, có chữ ký và xác nhận của lãnh đạo đơn vị..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RecordAttachmentTypePage;
