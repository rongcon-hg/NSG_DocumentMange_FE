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
} from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance";
import dayjs from "dayjs";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

const { Option } = Select;

const STATUS_CONFIG = {
  ACTIVE: { label: "Còn hiệu lực", color: "green" },
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

  const [form] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);

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
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchKeyword) params.search = searchKeyword;
      if (statusFilter) params.status = statusFilter;

      const res = await axiosInstance.get("/legal-bases", { params });
      if (res.data?.success) {
        setData(res.data.data || []);
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
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      ...record,
      issuedDate: record.issuedDate ? dayjs(record.issuedDate) : null,
      effectiveDate: record.effectiveDate ? dayjs(record.effectiveDate) : null,
    });
    setIsModalOpen(true);
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
      width: 150,
      render: (code) => <span className="font-bold text-blue-600">{code}</span>,
    },
    {
      title: "Tên văn bản / Trích yếu",
      dataIndex: "title",
      key: "title",
      minWidth: 260,
      render: (text, record) => (
        <div className="space-y-0.5">
          <div className="font-medium text-slate-800">{text}</div>
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
      title: "Hiệu lực",
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
      width: 180,
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
      width: 100,
      align: "center",
      render: (_, record) => (
        <Space size={4}>
          {record.documentUrl && (
            <Tooltip title="Xem toàn văn văn bản">
              <Button
                type="text"
                size="small"
                icon={<LinkOutlined className="text-blue-500" />}
                href={record.documentUrl}
                target="_blank"
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
                  onClick={() => handleOpenEdit(record)}
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

        {/* Bộ lọc & Tìm kiếm */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <Input
            placeholder="Tìm theo số hiệu, tên văn bản, cơ quan..."
            prefix={<SearchOutlined />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={fetchData}
            allowClear
          />
          <Select
            placeholder="Lọc theo tình trạng hiệu lực"
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            allowClear
          >
            <Option value="ACTIVE">Còn hiệu lực</Option>
            <Option value="EXPIRED">Hết hiệu lực</Option>
            <Option value="PARTIALLY_EXPIRED">Hết hiệu lực 1 phần</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchData} className="rounded-lg">
            Làm mới
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="_id"
          loading={loading}
          bordered
          size="small"
          scroll={{ x: 900 }}
        />
      </Card>

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
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="code"
              label="Số / Ký hiệu văn bản"
              rules={[{ required: true, message: "Vui lòng nhập số hiệu văn bản" }]}
            >
              <Input placeholder="Ví dụ: 30/2020/NĐ-CP" />
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
              <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày có hiệu lực" />
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
