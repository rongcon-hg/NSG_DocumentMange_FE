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
  Space,
  Tag,
  Card,
  message,
  Popconfirm,
  Typography,
  Tooltip,
  Row,
  Col,
  Statistic,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  FileDoneOutlined,
  CloudDownloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClearOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
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

  // Bộ lọc tìm kiếm
  const [searchText, setSearchText] = useState("");
  const [filterRequired, setFilterRequired] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

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

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = docTypes.length;
    const required = docTypes.filter((d) => d.isRequired).length;
    const optional = total - required;
    const active = docTypes.filter((d) => d.isActive).length;
    return { total, required, optional, active };
  }, [docTypes]);

  // Dữ liệu lọc
  const filteredDocTypes = useMemo(() => {
    return docTypes.filter((d) => {
      const matchSearch =
        !searchText ||
        d.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        d.code?.toLowerCase().includes(searchText.toLowerCase());

      const matchRequired =
        filterRequired === ""
          ? true
          : filterRequired === "true"
          ? d.isRequired
          : !d.isRequired;

      const matchStatus =
        filterStatus === ""
          ? true
          : filterStatus === "active"
          ? d.isActive
          : !d.isActive;

      return matchSearch && matchRequired && matchStatus;
    });
  }, [docTypes, searchText, filterRequired, filterStatus]);

  const handleResetFilter = () => {
    setSearchText("");
    setFilterRequired("");
    setFilterStatus("");
  };

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

  // Chuyển đổi trạng thái nhanh trực tiếp
  const handleToggleStatus = async (record, checked) => {
    try {
      await updateEmulationDocType(record._id, { isActive: checked });
      message.success(
        `Đã ${checked ? "bật áp dụng" : "tắt áp dụng"} loại hồ sơ ${record.name}`
      );
      setDocTypes((prev) =>
        prev.map((d) => (d._id === record._id ? { ...d, isActive: checked } : d))
      );
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể thay đổi trạng thái");
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

  // Cột hiển thị tối ưu tự động co giãn
  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 50,
      align: "center",
      render: (_, __, index) => (
        <span className="font-semibold text-gray-500">{index + 1}</span>
      ),
    },
    {
      title: "Mã hồ sơ",
      dataIndex: "code",
      key: "code",
      width: 85,
      align: "center",
      render: (code) => (
        <Tag color="blue" className="font-mono font-bold tracking-wider px-2 py-0.5">
          {code}
        </Tag>
      ),
    },
    {
      title: "Tên loại hồ sơ / Minh chứng",
      dataIndex: "name",
      key: "name",
      width: 250,
      render: (name, record) => (
        <div className="flex items-center gap-2 py-1">
          <FileTextOutlined className="text-blue-500 text-base flex-shrink-0" />
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
      title: "Yêu cầu",
      dataIndex: "isRequired",
      key: "isRequired",
      width: 95,
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
      title: "Danh hiệu áp dụng",
      dataIndex: "applicableTitles",
      key: "applicableTitles",
      width: 170,
      render: (list) => {
        if (!list || list.length === 0) {
          return <Tag color="default">Áp dụng chung toàn bộ</Tag>;
        }
        return (
          <div className="flex flex-wrap gap-1 py-1">
            {list.map((t) => (
              <Tag color="cyan" key={t._id || t} className="text-xs">
                {t.name || t.code || t}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: "Quy cách & Hướng dẫn file",
      dataIndex: "description",
      key: "description",
      minWidth: 280,
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
      width: 60,
      align: "center",
      render: (val) => <span className="font-semibold text-slate-600">{val}</span>,
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      width: 100,
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
            width: 140,
            align: "center",
            fixed: "right",
            render: (_, record) => (
              <div className="flex flex-row flex-wrap gap-1.5 items-center justify-center">
                <Tooltip title="Chỉnh sửa">
                  <Button
                    type="primary"
                    ghost
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleOpenModal(record)}
                    className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 flex items-center justify-center text-xs"
                  >
                    <span className="hidden sm:inline text-xs ml-1">Sửa</span>
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
                      className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 flex items-center justify-center text-xs"
                    >
                      <span className="hidden sm:inline text-xs ml-1">Xóa</span>
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
      {/* 1. THẺ THỐNG KÊ NHANH KPI */}
      <Row gutter={[10, 10]}>
        <Col xs={12} sm={6}>
          <Card className="shadow-2xs border-l-4 border-l-blue-500 !p-2 sm:!p-3">
            <Statistic
              title={<span className="text-xs text-gray-500 font-medium">Tổng loại hồ sơ</span>}
              value={stats.total}
              prefix={<FileDoneOutlined className="text-blue-500 text-base" />}
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
              title={<span className="text-xs text-gray-500 font-medium">Hồ sơ tùy chọn</span>}
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

      {/* 2. CARD CHÍNH FULL ĐỘ RỘNG */}
      <Card className="shadow-sm border-gray-200 w-full">
        {/* HEADER TIÊU ĐỀ & NÚT HÀNH ĐỘNG */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-gray-100">
          <div>
            <Title level={4} className="!mb-0 flex items-center gap-2 text-blue-800 text-base sm:text-lg">
              <FileDoneOutlined className="text-blue-600 text-xl" />
              Danh Mục Loại Hồ Sơ Minh Chứng
            </Title>
            <Text type="secondary" className="text-xs">
              Quản lý các loại hồ sơ, báo cáo thành tích yêu cầu cán bộ đính kèm khi đề nghị khen thưởng, thi đua
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
                  title="Nạp nhanh các loại hồ sơ minh chứng thông dụng"
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

        {/* BỘ LỌC TÌM KIẾM */}
        <div className="my-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* TÌM THEO TỪ KHÓA */}
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

            {/* LỌC THEO BẮT BUỘC / TÙY CHỌN */}
            <div>
              <Text className="text-xs text-gray-500 font-medium block mb-1">
                Tính chất hồ sơ:
              </Text>
              <Select
                className="w-full"
                value={filterRequired}
                onChange={setFilterRequired}
                placeholder="Tất cả tính chất"
                allowClear
              >
                <Select.Option value="">Tất cả</Select.Option>
                <Select.Option value="true">Bắt buộc nộp</Select.Option>
                <Select.Option value="false">Tùy chọn</Select.Option>
              </Select>
            </div>

            {/* LỌC THEO TRẠNG THÁI */}
            <div>
              <Text className="text-xs text-gray-500 font-medium block mb-1">
                Trạng thái:
              </Text>
              <Select
                className="w-full"
                value={filterStatus}
                onChange={setFilterStatus}
                placeholder="Tất cả trạng thái"
                allowClear
              >
                <Select.Option value="">Tất cả</Select.Option>
                <Select.Option value="active">Đang áp dụng</Select.Option>
                <Select.Option value="inactive">Ngưng áp dụng</Select.Option>
              </Select>
            </div>

            {/* NÚT RESET */}
            <div className="flex items-end">
              <Button
                icon={<ClearOutlined />}
                onClick={handleResetFilter}
                className="w-full"
                disabled={!searchText && !filterRequired && !filterStatus}
              >
                Xóa bộ lọc
              </Button>
            </div>
          </div>
        </div>

        {/* BẢNG HIỂN THỊ FULL WIDTH */}
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={filteredDocTypes}
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
          scroll={{ x: 950 }}
          locale={{
            emptyText: "Không tìm thấy loại hồ sơ nào phù hợp",
          }}
        />
      </Card>

      {/* MODAL THÊM / SỬA LOẠI HỒ SƠ */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-700 text-base">
            <FileDoneOutlined className="text-blue-600 text-xl" />
            <span className="font-bold">
              {editingItem ? "Cập nhật loại hồ sơ minh chứng" : "Thêm mới loại hồ sơ minh chứng"}
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
