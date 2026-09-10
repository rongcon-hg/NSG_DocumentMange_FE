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
  TrophyOutlined,
  CloudDownloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import {
  getEmulationTitles,
  createEmulationTitle,
  updateEmulationTitle,
  deleteEmulationTitle,
  initDefaultEmulationTitles,
} from "../../api/emulationApi";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getUserInfo } from "../../api/auth";
import { isBghUser } from "../../utils/userClassification";

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

  // Bộ lọc tìm kiếm
  const [searchText, setSearchText] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterTarget, setFilterTarget] = useState("");
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

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = titles.length;
    const coSo = titles.filter((t) => t.level === "CO_SO").length;
    const capCao = titles.filter((t) => t.level !== "CO_SO").length;
    const active = titles.filter((t) => t.isActive).length;
    return { total, coSo, capCao, active };
  }, [titles]);

  // Dữ liệu sau khi lọc
  const filteredTitles = useMemo(() => {
    return titles.filter((t) => {
      const matchSearch =
        !searchText ||
        t.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        t.code?.toLowerCase().includes(searchText.toLowerCase());

      const matchLevel = !filterLevel || t.level === filterLevel;
      const matchTarget = !filterTarget || t.targetType === filterTarget;
      const matchStatus =
        filterStatus === ""
          ? true
          : filterStatus === "active"
          ? t.isActive
          : !t.isActive;

      return matchSearch && matchLevel && matchTarget && matchStatus;
    });
  }, [titles, searchText, filterLevel, filterTarget, filterStatus]);

  const handleResetFilter = () => {
    setSearchText("");
    setFilterLevel("");
    setFilterTarget("");
    setFilterStatus("");
  };

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

  // Chuyển đổi trạng thái nhanh trực tiếp trên bảng
  const handleToggleStatus = async (record, checked) => {
    try {
      await updateEmulationTitle(record._id, { isActive: checked });
      message.success(
        `Đã ${checked ? "bật áp dụng" : "tắt áp dụng"} danh hiệu ${record.name}`
      );
      setTitles((prev) =>
        prev.map((t) => (t._id === record._id ? { ...t, isActive: checked } : t))
      );
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể thay đổi trạng thái");
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

  // Cấu hình các cột tự động co giãn tối ưu
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
      title: "Mã",
      dataIndex: "code",
      key: "code",
      width: 85,
      align: "center",
      render: (code) => (
        <Tag
          color="geekblue"
          className="font-mono font-bold tracking-wider px-2 py-0.5"
        >
          {code}
        </Tag>
      ),
    },
    {
      title: "Tên danh hiệu thi đua",
      dataIndex: "name",
      key: "name",
      width: 240,
      render: (name) => (
        <div className="flex items-center gap-2 py-1">
          <TrophyOutlined className="text-yellow-500 text-base flex-shrink-0" />
          <span className="font-semibold text-gray-900 text-sm hover:text-blue-600 transition-colors">
            {name}
          </span>
        </div>
      ),
    },
    {
      title: "Cấp khen thưởng",
      dataIndex: "level",
      key: "level",
      width: 140,
      align: "center",
      render: (level) => {
        const conf = LEVEL_CONFIG[level] || { label: level, color: "default" };
        return (
          <Tag color={conf.color} className="rounded-full px-2.5 py-0.5 text-xs font-medium">
            {conf.label}
          </Tag>
        );
      },
    },
    {
      title: "Đối tượng",
      dataIndex: "targetType",
      key: "targetType",
      width: 125,
      align: "center",
      render: (type) => {
        const conf = TARGET_CONFIG[type] || { label: type, color: "default" };
        return (
          <Tag color={conf.color} className="rounded-md font-medium text-xs">
            {conf.label}
          </Tag>
        );
      },
    },
    {
      title: "Tiêu chuẩn & Điều kiện xét tặng",
      dataIndex: "description",
      key: "description",
      minWidth: 280,
      render: (desc) => {
        if (!desc) {
          return <Text type="secondary" italic className="text-xs">Chưa có tiêu chuẩn cụ thể</Text>;
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
      width: 65,
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
                <Tooltip title="Xóa danh hiệu">
                  <Popconfirm
                    title="Xóa danh hiệu này?"
                    description="Bạn có chắc chắn muốn xóa danh hiệu thi đua này không?"
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
      {/* 1. THẺ THỐNG KÊ NHANH KPI (FULL WIDTH & CO GIÃN TỰ ĐỘNG) */}
      <Row gutter={[10, 10]}>
        <Col xs={12} sm={6}>
          <Card className="shadow-2xs border-l-4 border-l-blue-500 !p-2 sm:!p-3">
            <Statistic
              title={<span className="text-xs text-gray-500 font-medium">Tổng danh hiệu</span>}
              value={stats.total}
              prefix={<TrophyOutlined className="text-blue-500 text-base" />}
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
        <Col xs={12} sm={6}>
          <Card className="shadow-2xs border-l-4 border-l-cyan-500 !p-2 sm:!p-3">
            <Statistic
              title={<span className="text-xs text-gray-500 font-medium">Cấp Cơ sở (Trường)</span>}
              value={stats.coSo}
              valueStyle={{ fontSize: "1.2rem", fontWeight: "bold" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="shadow-2xs border-l-4 border-l-purple-500 !p-2 sm:!p-3">
            <Statistic
              title={<span className="text-xs text-gray-500 font-medium">Cấp TP / Bộ / Nhà nước</span>}
              value={stats.capCao}
              valueStyle={{ fontSize: "1.2rem", fontWeight: "bold" }}
            />
          </Card>
        </Col>
      </Row>

      {/* 2. CARD CHÍNH FULL ĐỘ RỘNG */}
      <Card className="shadow-sm border-gray-200 w-full">
        {/* HEADER TIÊU ĐỀ & CÁC NÚT THAO TÁC */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-gray-100">
          <div>
            <Title level={4} className="!mb-0 flex items-center gap-2 text-blue-800 text-base sm:text-lg">
              <TrophyOutlined className="text-yellow-500 text-xl" />
              Danh Mục Danh Hiệu Thi Đua
            </Title>
            <Text type="secondary" className="text-xs">
              Quản lý danh sách các danh hiệu thi đua, tiêu chuẩn điều kiện khen thưởng
            </Text>
          </div>

          <Space wrap className="w-full md:w-auto justify-end">
            <Button icon={<ReloadOutlined />} onClick={fetchTitles} loading={loading} size="middle">
              Làm mới
            </Button>
            {canManage && (
              <>
                <Button
                  icon={<CloudDownloadOutlined />}
                  onClick={handleInitDefault}
                  loading={loading}
                  size="middle"
                  title="Nạp nhanh các danh hiệu chuẩn ngành giáo dục"
                >
                  Nạp danh hiệu mẫu
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => handleOpenModal()}
                  className="bg-blue-600 hover:bg-blue-700 shadow-sm"
                  size="middle"
                >
                  Thêm danh hiệu
                </Button>
              </>
            )}
          </Space>
        </div>

        {/* BỘ LỌC TÌM KIẾM ĐA NĂNG */}
        <div className="my-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* TÌM THEO TỪ KHÓA */}
            <div>
              <Text className="text-xs text-gray-500 font-medium block mb-1">
                Tìm kiếm mã hoặc tên:
              </Text>
              <Input
                placeholder="Nhập tên hoặc mã danh hiệu..."
                prefix={<SearchOutlined className="text-gray-400" />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </div>

            {/* LỌC THEO CẤP */}
            <div>
              <Text className="text-xs text-gray-500 font-medium block mb-1">
                Cấp khen thưởng:
              </Text>
              <Select
                className="w-full"
                value={filterLevel}
                onChange={setFilterLevel}
                placeholder="Tất cả các cấp"
                allowClear
              >
                <Select.Option value="">Tất cả các cấp</Select.Option>
                <Select.Option value="CO_SO">Cấp Cơ sở (Trường)</Select.Option>
                <Select.Option value="CAP_TP">Cấp Thành phố</Select.Option>
                <Select.Option value="CAP_BO">Cấp Bộ</Select.Option>
                <Select.Option value="CAP_NHA_NUOC">Cấp Nhà nước</Select.Option>
              </Select>
            </div>

            {/* LỌC THEO ĐỐI TƯỢNG */}
            <div>
              <Text className="text-xs text-gray-500 font-medium block mb-1">
                Đối tượng áp dụng:
              </Text>
              <Select
                className="w-full"
                value={filterTarget}
                onChange={setFilterTarget}
                placeholder="Tất cả đối tượng"
                allowClear
              >
                <Select.Option value="">Tất cả đối tượng</Select.Option>
                <Select.Option value="CA_NHAN">Cá nhân</Select.Option>
                <Select.Option value="TAP_THE">Tập thể</Select.Option>
                <Select.Option value="CA_HAI">Cá nhân & Tập thể</Select.Option>
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

            {/* NÚT RESET BỘ LỌC */}
            <div className="flex items-end">
              <Button
                icon={<ClearOutlined />}
                onClick={handleResetFilter}
                className="w-full"
                disabled={!searchText && !filterLevel && !filterTarget && !filterStatus}
              >
                Xóa bộ lọc
              </Button>
            </div>
          </div>
        </div>

        {/* BẢNG HIỂN THỊ DANH SÁCH FULL WIDTH */}
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={filteredTitles}
          loading={loading}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "25", "50"],
            showTotal: (totalCount) => `Tổng cộng ${totalCount} danh hiệu thi đua`,
          }}
          bordered
          size="middle"
          scroll={{ x: 1150 }}
          locale={{
            emptyText: "Không tìm thấy danh hiệu thi đua nào phù hợp",
          }}
        />
      </Card>

      {/* MODAL THÊM / SỬA DANH HIỆU */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-700 text-base">
            <TrophyOutlined className="text-yellow-500 text-xl" />
            <span className="font-bold">
              {editingItem ? "Cập nhật danh hiệu thi đua" : "Thêm mới danh hiệu thi đua"}
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
              label="Mã danh hiệu (Viết tắt)"
              rules={[
                { required: true, message: "Vui lòng nhập mã danh hiệu" },
                { pattern: /^[A-Z0-9_-]+$/i, message: "Mã chỉ chứa chữ cái và số (VD: LDTT, CSTDCS)" },
              ]}
            >
              <Input
                placeholder="VD: LDTT, CSTDCS, BKKH..."
                style={{ textTransform: "uppercase" }}
              />
            </Form.Item>

            <Form.Item
              name="level"
              label="Cấp khen thưởng"
              rules={[{ required: true, message: "Vui lòng chọn cấp khen thưởng" }]}
            >
              <Select placeholder="Chọn cấp khen thưởng">
                <Select.Option value="CO_SO">Cấp Cơ sở (Trường)</Select.Option>
                <Select.Option value="CAP_TP">Cấp Thành phố</Select.Option>
                <Select.Option value="CAP_BO">Cấp Bộ</Select.Option>
                <Select.Option value="CAP_NHA_NUOC">Cấp Nhà nước</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="name"
            label="Tên danh hiệu thi đua đầy đủ"
            rules={[{ required: true, message: "Vui lòng nhập tên danh hiệu" }]}
          >
            <Input placeholder="VD: Lao động tiên tiến, Chiến sĩ thi đua cơ sở..." />
          </Form.Item>

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
              rows={4}
              placeholder="Nhập chi tiết điều kiện để đạt danh hiệu này (VD: Hoàn thành tốt nhiệm vụ, có sáng kiến kinh nghiệm, có thời gian công tác...)"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EmulationTitlePage;
