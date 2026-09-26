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
  Badge,
  Tooltip,
  Drawer,
  Descriptions,
} from "antd";
import {
  FolderOpenOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  FileTextOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  PaperClipOutlined,
  UploadOutlined,
  CloudServerOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { Upload, Progress, Radio } from "antd";
import axiosInstance from "../../api/axiosInstance";
import dayjs from "dayjs";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import SelectFromSignatureArchive from "../../components/SelectFromSignatureArchive";
import { getDriveToken, uploadFileDirectlyToDrive } from "../../api/driveApi";

const { Option } = Select;

const RETENTION_OPTIONS = ["Vĩnh viễn", "70 năm", "50 năm", "20 năm", "10 năm", "5 năm"];
const STATUS_COLORS = {
  OPEN: "blue",
  SUBMITTED: "orange",
  ARCHIVED: "green",
  DISCARDED: "red",
};
const STATUS_LABELS = {
  OPEN: "Đang thu thập",
  SUBMITTED: "Chờ nộp lưu",
  ARCHIVED: "Đã vào kho lưu trữ",
  DISCARDED: "Tiêu hủy",
};

const ArchiveManagementPage = () => {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  const [form] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);

  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUserRole(decoded.role || "");
        setCurrentUserId(decoded.userId || decoded.id || "");
      } catch (e) {
        console.error("Token decode error:", e);
      }
    }
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchKeyword) params.search = searchKeyword;
      if (statusFilter) params.status = statusFilter;

      const res = await axiosInstance.get("/archives", { params });
      if (res.data?.success) {
        setFolders(res.data.data || []);
      }
    } catch (error) {
      console.error("Lỗi fetchFolders:", error);
      const errMsg = error.response?.data?.message || "Không thể tải danh mục hồ sơ lưu trữ.";
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async (values) => {
    try {
      const res = await axiosInstance.post("/archives", values);
      if (res.data?.success) {
        message.success("Tạo hồ sơ lưu trữ thành công!");
        setIsCreateModalOpen(false);
        form.resetFields();
        fetchFolders();
      }
    } catch (error) {
      console.error("Lỗi createFolder:", error);
      message.error(error.response?.data?.message || "Lỗi khi tạo hồ sơ lưu trữ");
    }
  };

  const handleViewDetail = async (folder) => {
    try {
      const res = await axiosInstance.get(`/archives/${folder._id}`);
      if (res.data?.success) {
        setSelectedFolder(res.data.data);
        setIsDetailDrawerOpen(true);
      }
    } catch (error) {
      console.error("Lỗi xem chi tiết hồ sơ:", error);
      message.error("Không thể tải chi tiết hồ sơ");
    }
  };

  const [fileSourceMode, setFileSourceMode] = useState("upload"); // "upload" | "archive" | "url"
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadedFileInfo, setUploadedFileInfo] = useState(null);

  const handleCustomUpload = async ({ file, onSuccess, onError }) => {
    try {
      setUploadingFile(true);
      setUploadPercent(0);
      const { accessToken, folderId } = await getDriveToken();
      const res = await uploadFileDirectlyToDrive(file, accessToken, folderId, (percent) => {
        setUploadPercent(percent);
      });

      const fileUrl = `https://drive.google.com/file/d/${res.fileId}/view`;
      setUploadedFileInfo({
        fileId: res.fileId,
        fileName: res.fileName,
        fileUrl,
      });

      itemForm.setFieldsValue({
        fileUrl,
        fileId: res.fileId,
      });
      if (!itemForm.getFieldValue("title")) {
        itemForm.setFieldsValue({ title: file.name.replace(/\.[^/.]+$/, "") });
      }

      onSuccess(res);
      message.success(`Đã tải lên tệp "${file.name}" vào Google Drive!`);
    } catch (err) {
      console.error("Lỗi upload Drive:", err);
      onError(err);
      message.error(err.message || "Tải lên tệp thất bại");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSelectFromArchive = (files) => {
    if (files && files.length > 0) {
      const selected = files[0];
      const url = selected.fileUrl || selected.url;
      setUploadedFileInfo({
        fileId: selected.uid,
        fileName: selected.name,
        fileUrl: url,
      });
      itemForm.setFieldsValue({
        fileUrl: url,
        fileId: selected.uid,
      });
      if (!itemForm.getFieldValue("title")) {
        itemForm.setFieldsValue({ title: selected.name.replace(/\.[^/.]+$/, "") });
      }
      message.success(`Đã chọn tài liệu: ${selected.name}`);
    }
  };

  const handleAddItem = async (values) => {
    if (!selectedFolder) return;
    try {
      const payload = {
        ...values,
        fileId: uploadedFileInfo?.fileId || values.fileId || "",
        fileUrl: values.fileUrl || uploadedFileInfo?.fileUrl || "",
      };
      const res = await axiosInstance.post(`/archives/${selectedFolder._id}/items`, payload);
      if (res.data?.success) {
        message.success("Đã thêm tài liệu vào hồ sơ!");
        setIsAddItemModalOpen(false);
        itemForm.resetFields();
        setUploadedFileInfo(null);
        setUploadPercent(0);
        // Cập nhật lại drawer
        handleViewDetail(selectedFolder);
        fetchFolders();
      }
    } catch (error) {
      console.error("Lỗi addItem:", error);
      message.error("Lỗi khi thêm tài liệu vào hồ sơ");
    }
  };

  const handleUpdateStatus = async (folderId, newStatus) => {
    try {
      const res = await axiosInstance.put(`/archives/${folderId}/status`, { status: newStatus });
      if (res.data?.success) {
        message.success(`Đã cập nhật trạng thái hồ sơ sang: ${STATUS_LABELS[newStatus]}`);
        fetchFolders();
        if (selectedFolder && selectedFolder._id === folderId) {
          handleViewDetail(selectedFolder);
        }
      }
    } catch (error) {
      console.error("Lỗi cập nhật trạng thái:", error);
      message.error(error.response?.data?.message || "Không thể cập nhật trạng thái hồ sơ");
    }
  };

  const handleDeleteFolder = async (folderId) => {
    try {
      const res = await axiosInstance.delete(`/archives/${folderId}`);
      if (res.data?.success) {
        message.success("Đã xóa hồ sơ lưu trữ");
        fetchFolders();
      }
    } catch (error) {
      console.error("Lỗi xóa hồ sơ:", error);
      message.error(error.response?.data?.message || "Không thể xóa hồ sơ");
    }
  };

  const columns = [
    {
      title: "Mã Hồ Sơ",
      dataIndex: "folderCode",
      key: "folderCode",
      width: 130,
      render: (code) => <span className="font-bold text-blue-600">{code}</span>,
    },
    {
      title: "Tiêu đề hồ sơ vụ việc",
      dataIndex: "title",
      key: "title",
      width: 320,
      render: (text, record) => (
        <div className="space-y-0.5">
          <div className="font-medium text-slate-800 line-clamp-2" title={text}>{text}</div>
          <div className="text-xs text-slate-400">
            {record.department?.departmentName ? `Đơn vị: ${record.department.departmentName} • ` : ""}Lập bởi: {record.creator?.name || "N/A"}
          </div>
        </div>
      ),
    },
    {
      title: "Niên khóa",
      dataIndex: "academicYear",
      key: "academicYear",
      width: 110,
      align: "center",
      render: (year) => <Tag color="cyan" className="m-0 text-xs">{year}</Tag>,
    },
    {
      title: "Thời hạn",
      dataIndex: "retentionPeriod",
      key: "retentionPeriod",
      width: 95,
      align: "center",
      render: (val) => <span className="text-xs text-slate-600">{val}</span>,
    },
    {
      title: "Số TL",
      key: "itemCount",
      width: 70,
      align: "center",
      render: (_, r) => <Badge count={r.items?.length || 0} showZero color="#108ee9" />,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      align: "center",
      render: (st) => <Tag color={STATUS_COLORS[st]} className="m-0 text-xs">{STATUS_LABELS[st] || st}</Tag>,
    },
    {
      title: "Thao tác",
      key: "action",
      width: 140,
      align: "center",
      fixed: "right",
      render: (_, record) => {
        const isAdminOrManager = ["admin", "manager"].includes(currentUserRole);
        return (
          <Space size={4} className="flex justify-center flex-nowrap">
            <Tooltip title="Xem chi tiết & mục lục hồ sơ">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined className="text-blue-600" />}
                onClick={() => handleViewDetail(record)}
                className="hover:bg-blue-50"
              />
            </Tooltip>
            {record.status === "OPEN" && (
              <Button
                type="default"
                size="small"
                className="text-amber-600 border-amber-400 hover:text-amber-500 hover:border-amber-500 text-xs px-1.5"
                onClick={() => handleUpdateStatus(record._id, "SUBMITTED")}
              >
                Nộp lưu
              </Button>
            )}
            {record.status === "SUBMITTED" && isAdminOrManager && (
              <Button
                type="primary"
                size="small"
                className="bg-emerald-600 hover:bg-emerald-500 text-xs px-1.5"
                onClick={() => handleUpdateStatus(record._id, "ARCHIVED")}
              >
                Duyệt kho
              </Button>
            )}
            {(record.status === "OPEN" || currentUserRole === "admin") && (
              <Popconfirm
                title="Xóa hồ sơ lưu trữ?"
                description="Bạn chắc chắn muốn xóa hồ sơ này khỏi danh mục?"
                onConfirm={() => handleDeleteFolder(record._id)}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Xóa hồ sơ">
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} className="hover:bg-red-50" />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-slate-50 min-h-screen">
      <Card className="shadow-xs rounded-xl border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 m-0">
              <FolderOpenOutlined className="text-blue-600" />
              Kho Lưu Trữ Số & Hồ Sơ Công Việc (e-Archive)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-0">
              Quản lý danh mục hồ sơ lưu trữ điện tử cơ quan, nộp lưu và khai thác hồ sơ vụ việc
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button icon={<ReloadOutlined />} onClick={fetchFolders}>
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="bg-blue-600 hover:bg-blue-500"
              onClick={() => setIsCreateModalOpen(true)}
            >
              Lập hồ sơ mới
            </Button>
          </div>
        </div>

        {/* Bộ lọc tìm kiếm */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 mb-4">
          <Input
            placeholder="Tìm theo tiêu đề hoặc mã hồ sơ..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={fetchFolders}
            className="w-full sm:w-72"
            allowClear
          />
          <Select
            placeholder="Lọc theo trạng thái"
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            allowClear
            className="w-full sm:w-48"
          >
            <Option value="OPEN">Đang thu thập</Option>
            <Option value="SUBMITTED">Chờ nộp lưu</Option>
            <Option value="ARCHIVED">Đã vào kho lưu trữ</Option>
          </Select>
          <Button type="primary" ghost onClick={fetchFolders} className="w-full sm:w-auto">
            Tìm kiếm
          </Button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
          <Table
            columns={columns}
            dataSource={folders}
            rowKey="_id"
            loading={loading}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              pageSizeOptions: ["10", "15", "25", "50"],
              showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} hồ sơ`,
              responsive: true,
              size: "small",
            }}
            bordered
            size="small"
            scroll={{ x: 980 }}
            className="archive-table"
          />
        </div>
      </Card>

      {/* Modal Lập hồ sơ mới */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-slate-800 text-lg">
            <FolderOpenOutlined className="text-blue-600" />
            Lập Hồ Sơ Công Việc Mới
          </div>
        }
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        onOk={() => form.submit()}
        okText="Tạo hồ sơ"
        cancelText="Hủy"
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateFolder} className="mt-4">
          <Form.Item
            name="folderCode"
            label="Mã hồ sơ (Ví dụ: HS-2026/001)"
            rules={[{ required: true, message: "Vui lòng nhập mã hồ sơ" }]}
          >
            <Input placeholder="HS-2026/001" />
          </Form.Item>
          <Form.Item
            name="title"
            label="Tiêu đề hồ sơ vụ việc"
            rules={[{ required: true, message: "Vui lòng nhập tiêu đề hồ sơ" }]}
          >
            <Input placeholder="Hồ sơ tổ chức Hội thảo Khoa học năm 2026..." />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="academicYear"
              label="Năm học / Niên khóa"
              initialValue={`${new Date().getFullYear()}-${new Date().getFullYear() + 1}`}
            >
              <Input placeholder="2025-2026" />
            </Form.Item>
            <Form.Item
              name="retentionPeriod"
              label="Thời hạn bảo quản"
              initialValue="10 năm"
            >
              <Select>
                {RETENTION_OPTIONS.map((opt) => (
                  <Option key={opt} value={opt}>
                    {opt}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="description" label="Ghi chú / Mô tả nội dung hồ sơ">
            <Input.TextArea rows={3} placeholder="Ghi chú thêm về hồ sơ vụ việc..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer Chi tiết & Mục lục hồ sơ */}
      <Drawer
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-800">
            <FileTextOutlined className="text-blue-600" />
            Mục Lục Tài Liệu Trong Hồ Sơ: {selectedFolder?.folderCode}
          </div>
        }
        width={typeof window !== "undefined" && window.innerWidth < 768 ? "100%" : 780}
        open={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        extra={
          <Space wrap size="small">
            {selectedFolder?.status === "OPEN" && (
              <Button
                type="default"
                size="small"
                className="text-amber-600 border-amber-500"
                onClick={() => handleUpdateStatus(selectedFolder._id, "SUBMITTED")}
              >
                Nộp lưu hồ sơ
              </Button>
            )}
            {selectedFolder?.status === "SUBMITTED" && ["manager", "admin"].includes(currentUserRole) && (
              <Button
                type="primary"
                size="small"
                className="bg-emerald-600"
                onClick={() => handleUpdateStatus(selectedFolder._id, "ARCHIVED")}
              >
                Duyệt nhập kho
              </Button>
            )}
            {selectedFolder?.status === "OPEN" && (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setIsAddItemModalOpen(true)}
                className="bg-blue-600"
              >
                Bổ sung tài liệu
              </Button>
            )}
          </Space>
        }
      >
        {selectedFolder && (
          <div className="space-y-6">
            <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Mã hồ sơ">{selectedFolder.folderCode}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={STATUS_COLORS[selectedFolder.status]}>
                  {STATUS_LABELS[selectedFolder.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tiêu đề vụ việc" span={2}>
                <span className="font-semibold">{selectedFolder.title}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Thời hạn bảo quản">
                {selectedFolder.retentionPeriod}
              </Descriptions.Item>
              <Descriptions.Item label="Năm học">
                {selectedFolder.academicYear}
              </Descriptions.Item>
              <Descriptions.Item label="Người lập">
                {selectedFolder.creator?.name || "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="Đơn vị">
                {selectedFolder.department?.departmentName || "Cơ quan"}
              </Descriptions.Item>
            </Descriptions>

            {/* Bảng mục lục tài liệu */}
            <div>
              <div className="font-bold text-slate-800 text-sm mb-3 flex items-center justify-between">
                <span>Danh mục tài liệu thành phần ({selectedFolder.items?.length || 0})</span>
              </div>
              <Table
                dataSource={selectedFolder.items || []}
                rowKey="_id"
                pagination={false}
                size="small"
                bordered
                scroll={{ x: 600 }}
                columns={[
                  {
                    title: "STT",
                    key: "stt",
                    width: 50,
                    align: "center",
                    render: (_, __, idx) => idx + 1,
                  },
                  {
                    title: "Số, Ký hiệu",
                    dataIndex: "documentNumber",
                    key: "documentNumber",
                    width: 120,
                  },
                  {
                    title: "Trích yếu / Tên tài liệu",
                    dataIndex: "title",
                    key: "title",
                    minWidth: 200,
                    render: (t, r) => (
                      <div>
                        <div className="font-medium text-slate-800">{t}</div>
                        {r.fileUrl && (
                          <a
                            href={r.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <PaperClipOutlined /> Xem tệp đính kèm
                          </a>
                        )}
                      </div>
                    ),
                  },
                  {
                    title: "Loại",
                    dataIndex: "itemType",
                    key: "itemType",
                    width: 100,
                    align: "center",
                    render: (type) => <Tag>{type}</Tag>,
                  },
                  {
                    title: "Tờ/Trang",
                    dataIndex: "pageCount",
                    key: "pageCount",
                    width: 80,
                    align: "center",
                  },
                ]}
              />
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal bổ sung tài liệu vào hồ sơ */}
      <Modal
        title="Thêm tài liệu vào hồ sơ lưu trữ"
        open={isAddItemModalOpen}
        onCancel={() => setIsAddItemModalOpen(false)}
        onOk={() => itemForm.submit()}
        okText="Thêm vào hồ sơ"
        cancelText="Hủy"
        width={550}
      >
        <Form form={itemForm} layout="vertical" onFinish={handleAddItem} className="mt-4">
          <Form.Item
            name="title"
            label="Tên tài liệu / Trích yếu"
            rules={[{ required: true, message: "Vui lòng nhập tên tài liệu" }]}
          >
            <Input placeholder="Tờ trình về việc..., Báo cáo kết quả..." />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="itemType" label="Loại tài liệu" initialValue="Document">
              <Select>
                <Option value="Document">Văn bản</Option>
                <Option value="Task">Kết quả công việc</Option>
                <Option value="Report">Báo cáo tổng hợp</Option>
                <Option value="Attachment">Phụ lục / Khác</Option>
              </Select>
            </Form.Item>
            <Form.Item name="documentNumber" label="Số / Ký hiệu văn bản">
              <Input placeholder="123/BC-NSG" />
            </Form.Item>
          </div>
          {/* Phương thức đính kèm tệp */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
            <div className="font-semibold text-slate-700 text-xs mb-2">ĐÍNH KÈM TỆP TÀI LIỆU:</div>
            <Radio.Group
              value={fileSourceMode}
              onChange={(e) => setFileSourceMode(e.target.value)}
              className="mb-3"
              size="small"
            >
              <Radio.Button value="upload">
                <UploadOutlined /> Tải file lên
              </Radio.Button>
              <Radio.Button value="archive">
                <CloudServerOutlined /> Chọn từ Kho chữ ký
              </Radio.Button>
              <Radio.Button value="url">
                <LinkOutlined /> Nhập link Google Drive
              </Radio.Button>
            </Radio.Group>

            {fileSourceMode === "upload" && (
              <div className="space-y-2">
                <Upload
                  customRequest={handleCustomUpload}
                  showUploadList={false}
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />} loading={uploadingFile} className="w-full">
                    {uploadingFile ? `Đang tải lên Drive... (${uploadPercent}%)` : "Chọn tệp từ máy tính để tải lên Drive"}
                  </Button>
                </Upload>
                {uploadingFile && <Progress percent={uploadPercent} size="small" />}
                {uploadedFileInfo && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 p-2 rounded border border-emerald-200">
                    <CheckCircleOutlined /> Đã chọn tệp: <span className="font-semibold truncate">{uploadedFileInfo.fileName}</span>
                  </div>
                )}
              </div>
            )}

            {fileSourceMode === "archive" && (
              <div className="space-y-2">
                <SelectFromSignatureArchive
                  onSelectFiles={handleSelectFromArchive}
                  buttonText="Mở Kho văn bản đã ký điện tử để chọn"
                  buttonProps={{ className: "w-full", icon: <CloudServerOutlined /> }}
                />
                {uploadedFileInfo && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded border border-blue-200">
                    <CheckCircleOutlined /> Đã lấy từ Kho ký: <span className="font-semibold truncate">{uploadedFileInfo.fileName}</span>
                  </div>
                )}
              </div>
            )}

            {fileSourceMode === "url" && (
              <Form.Item name="fileUrl" label="Đường dẫn file (Google Drive URL)" className="mb-0">
                <Input placeholder="https://drive.google.com/file/d/.../view" />
              </Form.Item>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="pageCount" label="Số tờ / Số trang" initialValue={1}>
              <Input type="number" min={1} />
            </Form.Item>
          </div>
          <Form.Item name="note" label="Ghi chú">
            <Input placeholder="Bản chính / bản sao..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ArchiveManagementPage;
