/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  message,
  Card,
  Popconfirm,
  Tooltip,
  DatePicker,
  Row,
  Col,
  Statistic,
  Alert,
  Descriptions,
} from "antd";
import {
  BookOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  LinkOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance";
import dayjs from "dayjs";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

const { Option } = Select;

const STATUS_CONFIG = {
  ACTIVE: { label: "Còn hiệu lực", color: "green" },
  PENDING: { label: "Sắp hiệu lực", color: "processing" },
  EXPIRED: { label: "Hết hiệu lực", color: "red" },
  PARTIALLY_EXPIRED: { label: "Hết hiệu lực 1 phần", color: "orange" },
};

const DOC_TYPES = [
  { value: "LUAT", label: "Luật" },
  { value: "NGHI_DINH", label: "Nghị định" },
  { value: "THONG_TU", label: "Thông tư" },
  { value: "QUYET_DINH", label: "Quyết định" },
  { value: "CHI_THI", label: "Chỉ thị" },
  { value: "KHAC", label: "Văn bản khác" },
];

const LegalBasisManagementPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);

  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [docTypeFilter, setDocTypeFilter] = useState(null);

  const [stats, setStats] = useState({
    total: 0,
    ACTIVE: 0,
    PENDING: 0,
    EXPIRED: 0,
    PARTIALLY_EXPIRED: 0,
  });
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserRole(decoded.role || "");
      } catch (e) {
        console.error("Token decode error:", e);
      }
    }
  }, []);

  // Tự động tìm kiếm thông minh khi từ khóa (debounce 300ms), bộ lọc trạng thái hoặc loại văn bản thay đổi
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword, statusFilter, docTypeFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchKeyword && searchKeyword.trim()) params.search = searchKeyword.trim();
      if (statusFilter) params.status = statusFilter;
      if (docTypeFilter) params.docType = docTypeFilter;

      const res = await axiosInstance.get("/legal-bases", { params });
      if (res.data?.success) {
        setData(res.data.data || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      }
    } catch (error) {
      console.error("Lỗi fetchData:", error);
      message.error("Không thể tải danh sách căn cứ pháp luật");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setDuplicateWarning(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (record) => {
    setEditingItem(record);
    setDuplicateWarning(null);
    form.setFieldsValue({
      ...record,
      issuedDate: record.issuedDate ? dayjs(record.issuedDate) : null,
      effectiveDate: record.effectiveDate ? dayjs(record.effectiveDate) : null,
    });
    setIsModalOpen(true);
  };

  // Kiểm tra Số / Ký hiệu văn bản đã tồn tại trong CSDL hay chưa khi người dùng gõ
  const handleCodeChange = (e) => {
    const val = (e.target.value || "").trim().toLowerCase();
    if (!val) {
      setDuplicateWarning(null);
      return;
    }
    const matched = data.find(
      (item) =>
        (item.code || "").trim().toLowerCase() === val &&
        (!editingItem || item._id !== editingItem._id)
    );
    if (matched) {
      setDuplicateWarning(
        `Văn bản với số hiệu "${matched.code}" đã có trong CSDL ("${matched.title}"). Vui lòng kiểm tra lại để tránh nhập trùng lặp!`
      );
    } else {
      setDuplicateWarning(null);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        issuedDate: values.issuedDate ? values.issuedDate.toISOString() : null,
        effectiveDate: values.effectiveDate ? values.effectiveDate.toISOString() : null,
      };

      if (editingItem) {
        const res = await axiosInstance.put(`/legal-bases/${editingItem._id}`, payload);
        if (res.data?.success) {
          message.success("Cập nhật căn cứ pháp luật thành công!");
        }
      } else {
        const res = await axiosInstance.post("/legal-bases", payload);
        if (res.data?.success) {
          message.success("Thêm mới căn cứ pháp luật thành công!");
        }
      }
      setIsModalOpen(false);
      form.resetFields();
      setDuplicateWarning(null);
      fetchData();
    } catch (error) {
      console.error("Lỗi submit:", error);
      message.error(error.response?.data?.message || "Lỗi khi lưu dữ liệu");
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await axiosInstance.delete(`/legal-bases/${id}`);
      if (res.data?.success) {
        message.success("Đã xóa căn cứ pháp luật");
        fetchData();
      }
    } catch (error) {
      console.error("Lỗi xóa:", error);
      message.error("Không thể xóa căn cứ pháp luật");
    }
  };

  const isManagerOrAdmin = ["admin", "manager"].includes(userRole);

  const columns = [
    {
      title: "Số / Ký hiệu",
      dataIndex: "code",
      key: "code",
      width: 140,
      render: (code) => <span className="font-bold text-blue-600 hover:underline">{code}</span>,
    },
    {
      title: "Tên văn bản / Trích yếu",
      dataIndex: "title",
      key: "title",
      minWidth: 260,
      render: (text, record) => (
        <div className="space-y-0.5">
          <div className="font-medium text-slate-800 line-clamp-2">{text}</div>
          <div className="text-xs text-slate-400">
            {record.issuingAuthority ? `Cơ quan: ${record.issuingAuthority} • ` : ""}
            {record.issuedDate ? `Ban hành: ${dayjs(record.issuedDate).format("DD/MM/YYYY")}` : ""}
          </div>
        </div>
      ),
    },
    {
      title: "Loại VB",
      dataIndex: "docType",
      key: "docType",
      width: 110,
      align: "center",
      render: (type) => {
        const item = DOC_TYPES.find((d) => d.value === type);
        return <Tag color="blue">{item?.label || type}</Tag>;
      },
    },
    {
      title: "Ngày hiệu lực",
      dataIndex: "effectiveDate",
      key: "effectiveDate",
      width: 120,
      align: "center",
      render: (date) =>
        date ? (
          <span className="font-medium text-slate-700">{dayjs(date).format("DD/MM/YYYY")}</span>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        ),
    },
    {
      title: "Tình trạng",
      dataIndex: "status",
      key: "status",
      width: 140,
      align: "center",
      render: (st) => {
        const item = STATUS_CONFIG[st] || STATUS_CONFIG.ACTIVE;
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: "Văn bản thay thế",
      dataIndex: "replacedBy",
      key: "replacedBy",
      width: 170,
      render: (val) =>
        val ? (
          <span className="text-rose-600 font-medium text-xs">
            👉 {val}
          </span>
        ) : (
          <span className="text-slate-400 text-xs">-</span>
        ),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 110,
      align: "center",
      fixed: "right",
      render: (_, record) => (
        <Space size={2} onClick={(e) => e.stopPropagation()}>
          <Tooltip title="Xem chi tiết">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined className="text-emerald-600" />}
              onClick={(e) => {
                e.stopPropagation();
                setViewingItem(record);
              }}
            />
          </Tooltip>
          {record.documentUrl && (
            <Tooltip title="Xem toàn văn văn bản">
              <Button
                type="text"
                size="small"
                icon={<LinkOutlined className="text-blue-500" />}
                href={record.documentUrl}
                target="_blank"
                onClick={(e) => e.stopPropagation()}
              />
            </Tooltip>
          )}
          {isManagerOrAdmin && (
            <>
              <Tooltip title="Chỉnh sửa">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined className="text-amber-500" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(record);
                  }}
                />
              </Tooltip>
              <Popconfirm
                title="Xác nhận xóa căn cứ này?"
                onConfirm={() => handleDelete(record._id)}
                okText="Xóa"
                cancelText="Hủy"
              >
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined className="text-red-500" />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="w-full min-h-screen bg-slate-50 p-2 sm:p-4 md:p-6">
      <Card className="rounded-xl shadow-xs border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2 m-0">
              <SafetyCertificateOutlined className="text-blue-600" />
              Cơ Sở Dữ Liệu Căn Cứ Pháp Luật & Cảnh Báo Hiệu Lực
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-0">
              Quản lý danh mục các văn bản quy phạm pháp luật, cảnh báo văn bản hết hiệu lực và liên kết tự động với Trợ lý AI Soạn thảo.
            </p>
          </div>
          {isManagerOrAdmin && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
              className="bg-blue-600 rounded-lg"
            >
              Thêm Căn Cứ Mới
            </Button>
          )}
        </div>

        {/* Thống kê số liệu văn bản căn cứ pháp luật */}
        <Row gutter={[12, 12]} className="mb-5">
          <Col xs={12} sm={6} md={4} lg={4}>
            <Card size="small" className={`rounded-xl border-slate-200 bg-white shadow-2xs hover:border-blue-400 transition-all cursor-pointer ${!statusFilter ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setStatusFilter(null)}>
              <Statistic
                title={<span className="text-xs font-semibold text-slate-500">TỔNG SỐ VĂN BẢN</span>}
                value={stats.total || data.length}
                valueStyle={{ color: '#2563eb', fontWeight: 'bold' }}
                prefix={<FileTextOutlined className="text-blue-500" />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6} md={5} lg={5}>
            <Card size="small" className={`rounded-xl border-slate-200 bg-white shadow-2xs hover:border-green-400 transition-all cursor-pointer ${statusFilter === 'ACTIVE' ? 'ring-2 ring-emerald-500' : ''}`} onClick={() => setStatusFilter(statusFilter === 'ACTIVE' ? null : 'ACTIVE')}>
              <Statistic
                title={<span className="text-xs font-semibold text-emerald-600">CÒN HIỆU LỰC</span>}
                value={stats.ACTIVE}
                valueStyle={{ color: '#059669', fontWeight: 'bold' }}
                prefix={<CheckCircleOutlined className="text-emerald-500" />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6} md={5} lg={5}>
            <Card size="small" className={`rounded-xl border-slate-200 bg-white shadow-2xs hover:border-blue-400 transition-all cursor-pointer ${statusFilter === 'PENDING' ? 'ring-2 ring-blue-500' : ''}`} onClick={() => setStatusFilter(statusFilter === 'PENDING' ? null : 'PENDING')}>
              <Statistic
                title={<span className="text-xs font-semibold text-blue-600">SẮP HIỆU LỰC</span>}
                value={stats.PENDING}
                valueStyle={{ color: '#2563eb', fontWeight: 'bold' }}
                prefix={<ClockCircleOutlined className="text-blue-500" />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6} md={5} lg={5}>
            <Card size="small" className={`rounded-xl border-slate-200 bg-white shadow-2xs hover:border-rose-400 transition-all cursor-pointer ${statusFilter === 'EXPIRED' ? 'ring-2 ring-rose-500' : ''}`} onClick={() => setStatusFilter(statusFilter === 'EXPIRED' ? null : 'EXPIRED')}>
              <Statistic
                title={<span className="text-xs font-semibold text-rose-600">HẾT HIỆU LỰC</span>}
                value={stats.EXPIRED}
                valueStyle={{ color: '#e11d48', fontWeight: 'bold' }}
                prefix={<CloseCircleOutlined className="text-rose-500" />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6} md={5} lg={5}>
            <Card size="small" className={`rounded-xl border-slate-200 bg-white shadow-2xs hover:border-amber-400 transition-all cursor-pointer ${statusFilter === 'PARTIALLY_EXPIRED' ? 'ring-2 ring-amber-500' : ''}`} onClick={() => setStatusFilter(statusFilter === 'PARTIALLY_EXPIRED' ? null : 'PARTIALLY_EXPIRED')}>
              <Statistic
                title={<span className="text-xs font-semibold text-amber-600">HẾT HIỆU LỰC 1 PHẦN</span>}
                value={stats.PARTIALLY_EXPIRED}
                valueStyle={{ color: '#d97706', fontWeight: 'bold' }}
                prefix={<ExclamationCircleOutlined className="text-amber-500" />}
              />
            </Card>
          </Col>
        </Row>

        {/* Bộ lọc & Tìm kiếm thông minh */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Input
            placeholder="Tìm số hiệu, tên văn bản, cơ quan..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            allowClear
            className="rounded-lg"
          />
          <Select
            placeholder="Tất cả loại văn bản"
            value={docTypeFilter}
            onChange={(val) => setDocTypeFilter(val)}
            allowClear
            className="rounded-lg"
          >
            {DOC_TYPES.map((d) => (
              <Option key={d.value} value={d.value}>
                {d.label}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="Tất cả trạng thái hiệu lực"
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            allowClear
            className="rounded-lg"
          >
            <Option value="ACTIVE">Còn hiệu lực</Option>
            <Option value="PENDING">Sắp hiệu lực</Option>
            <Option value="EXPIRED">Hết hiệu lực</Option>
            <Option value="PARTIALLY_EXPIRED">Hết hiệu lực 1 phần</Option>
          </Select>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setSearchKeyword("");
              setStatusFilter(null);
              setDocTypeFilter(null);
            }}
            className="rounded-lg font-medium"
          >
            Đặt lại bộ lọc
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="_id"
          loading={loading}
          bordered
          size="middle"
          scroll={{ x: 1000 }}
          onRow={(record) => ({
            onClick: () => setViewingItem(record),
            className: "cursor-pointer hover:bg-blue-50/50 transition-colors",
          })}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ["15", "30", "50", "100"],
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} văn bản`,
          }}
        />
      </Card>

      {/* Modal Xem chi tiết Căn cứ pháp luật */}
      <Modal
        title={null}
        open={!!viewingItem}
        onCancel={() => setViewingItem(null)}
        footer={null}
        width={700}
        centered
        className="legal-detail-modal"
        styles={{
          body: { padding: 0, maxHeight: "85vh", overflowY: "auto" },
        }}
      >
        {viewingItem && (
          <div className="flex flex-col">
            {/* Header Card */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-5 sm:p-6 rounded-t-2xl relative">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 pr-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-xs">
                    <BookOutlined />
                    {DOC_TYPES.find((d) => d.value === viewingItem.docType)?.label || viewingItem.docType}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight m-0 mt-1">
                    {viewingItem.code}
                  </h2>
                  <p className="text-blue-100 text-xs sm:text-sm leading-relaxed mt-2 mb-0 line-clamp-3 font-normal">
                    {viewingItem.title}
                  </p>
                </div>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-6 space-y-4 bg-slate-50/60">
              {/* Trạng thái & Cơ quan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-xs font-medium text-slate-400 mb-1.5">Tình trạng hiệu lực</div>
                  <div>
                    <Tag
                      color={STATUS_CONFIG[viewingItem.status]?.color || "green"}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md m-0"
                    >
                      {STATUS_CONFIG[viewingItem.status]?.label || viewingItem.status}
                    </Tag>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-xs font-medium text-slate-400 mb-1">Cơ quan ban hành</div>
                  <div className="text-sm font-semibold text-slate-800">
                    {viewingItem.issuingAuthority || "Chưa cập nhật"}
                  </div>
                </div>
              </div>

              {/* Ngày ban hành & Ngày hiệu lực */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Ngày ban hành</span>
                  <span className="text-sm font-semibold text-slate-700">
                    {viewingItem.issuedDate ? dayjs(viewingItem.issuedDate).format("DD/MM/YYYY") : "—"}
                  </span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Ngày có hiệu lực</span>
                  <span className="text-sm font-bold text-blue-600">
                    {viewingItem.effectiveDate ? dayjs(viewingItem.effectiveDate).format("DD/MM/YYYY") : "—"}
                  </span>
                </div>
              </div>

              {/* Văn bản thay thế (nếu có) */}
              {viewingItem.replacedBy && (
                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl flex items-start gap-2.5">
                  <WarningOutlined className="text-rose-500 text-base mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-rose-800">Văn bản thay thế mới nhất:</div>
                    <div className="text-sm font-extrabold text-rose-600 mt-0.5">
                      👉 {viewingItem.replacedBy}
                    </div>
                  </div>
                </div>
              )}

              {/* Đường dẫn tra cứu */}
              {viewingItem.documentUrl && (
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1">
                    <LinkOutlined className="text-blue-500" /> Liên kết tra cứu toàn văn
                  </div>
                  <a
                    href={viewingItem.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 hover:underline break-all font-medium inline-block"
                  >
                    {viewingItem.documentUrl}
                  </a>
                </div>
              )}

              {/* Ghi chú áp dụng */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <div className="text-xs font-medium text-slate-400 mb-1">Ghi chú áp dụng</div>
                <div className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {viewingItem.notes || "Không có ghi chú thêm."}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-end gap-2 rounded-b-2xl">
              {viewingItem.documentUrl && (
                <Button
                  type="primary"
                  ghost
                  icon={<LinkOutlined />}
                  href={viewingItem.documentUrl}
                  target="_blank"
                  className="rounded-lg order-2 sm:order-1"
                >
                  Xem toàn văn
                </Button>
              )}
              {isManagerOrAdmin && (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => {
                    const item = viewingItem;
                    setViewingItem(null);
                    handleOpenEdit(item);
                  }}
                  className="bg-blue-600 rounded-lg order-1 sm:order-2"
                >
                  Chỉnh sửa
                </Button>
              )}
              <Button
                onClick={() => setViewingItem(null)}
                className="rounded-lg order-3"
              >
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Thêm / Sửa */}
      <Modal
        title={editingItem ? "Chỉnh Sửa Căn Cứ Pháp Luật" : "Thêm Căn Cứ Pháp Luật Mới"}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        okText={editingItem ? "Cập nhật" : "Thêm mới"}
        cancelText="Hủy"
        width={650}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} className="mt-4">
          {duplicateWarning && (
            <Alert
              message="Cảnh báo văn bản đã có trong CSDL"
              description={duplicateWarning}
              type="warning"
              showIcon
              className="mb-4 rounded-lg border-amber-300 bg-amber-50"
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="code"
              label="Số / Ký hiệu văn bản"
              rules={[{ required: true, message: "Vui lòng nhập số hiệu văn bản" }]}
              validateStatus={duplicateWarning ? "warning" : ""}
              help={duplicateWarning ? "Số hiệu này đã có trong cơ sở dữ liệu" : null}
            >
              <Input
                placeholder="Ví dụ: 30/2020/NĐ-CP"
                onChange={handleCodeChange}
              />
            </Form.Item>
            <Form.Item name="docType" label="Loại văn bản" initialValue="NGHI_DINH">
              <Select>
                {DOC_TYPES.map((d) => (
                  <Option key={d.value} value={d.value}>
                    {d.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="title"
            label="Tên văn bản / Trích yếu nội dung"
            rules={[{ required: true, message: "Vui lòng nhập tên văn bản" }]}
          >
            <Input placeholder="Ví dụ: Về công tác văn thư" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="issuingAuthority" label="Cơ quan ban hành">
              <Input placeholder="Chính phủ, Quốc hội, UBND TP.HCM..." />
            </Form.Item>
            <Form.Item name="status" label="Tình trạng hiệu lực" initialValue="ACTIVE">
              <Select>
                <Option value="ACTIVE">Còn hiệu lực</Option>
                <Option value="PENDING">Sắp hiệu lực</Option>
                <Option value="EXPIRED">Đã hết hiệu lực</Option>
                <Option value="PARTIALLY_EXPIRED">Hết hiệu lực 1 phần</Option>
              </Select>
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="issuedDate" label="Ngày ban hành">
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày ban hành" />
            </Form.Item>
            <Form.Item name="effectiveDate" label="Ngày có hiệu lực">
              <DatePicker
                className="w-full"
                format="DD/MM/YYYY"
                placeholder="Chọn ngày có hiệu lực"
                onChange={(date) => {
                  if (date) {
                    const today = dayjs().startOf("day");
                    const eff = dayjs(date).startOf("day");
                    const currentStatus = form.getFieldValue("status");
                    // Nếu ngày có hiệu lực ở tương lai (> hôm nay) và đang là Còn hiệu lực -> tự chuyển thành Sắp hiệu lực
                    if (eff.isAfter(today)) {
                      if (!currentStatus || currentStatus === "ACTIVE") {
                        form.setFieldsValue({ status: "PENDING" });
                      }
                    } else {
                      // Nếu ngày có hiệu lực <= hôm nay và đang là Sắp hiệu lực -> tự chuyển thành Còn hiệu lực
                      if (currentStatus === "PENDING") {
                        form.setFieldsValue({ status: "ACTIVE" });
                      }
                    }
                  }
                }}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="replacedBy"
            label="Văn bản thay thế (nếu đã hết hiệu lực)"
            tooltip="Ghi số hiệu văn bản mới nhất thay thế văn bản này để AI tự động khuyến nghị khi thẩm định."
          >
            <Input placeholder="Ví dụ: Nghị định số 30/2020/NĐ-CP" />
          </Form.Item>

          <Form.Item name="documentUrl" label="Liên kết tra cứu toàn văn">
            <Input placeholder="https://thuvienphapluat.vn/..." />
          </Form.Item>

          <Form.Item name="notes" label="Ghi chú chi tiết">
            <Input.TextArea rows={3} placeholder="Phạm vi điều chỉnh, lưu ý khi áp dụng..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LegalBasisManagementPage;
