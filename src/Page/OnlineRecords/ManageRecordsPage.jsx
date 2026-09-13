/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  Card,
  Modal,
  Drawer,
  Form,
  message,
  Popconfirm,
  Typography,
  Tooltip,
  Badge,
  Timeline,
  Divider,
  Row,
  Col,
  Tabs,
  Radio,
  DatePicker,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  DeleteOutlined,
  FileDoneOutlined,
  UserOutlined,
  BankOutlined,
  CalendarOutlined,
  LinkOutlined,
  FilePdfOutlined,
  ClearOutlined,
  SendOutlined,
  InboxOutlined,
  AuditOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import {
  getOnlineRecords,
  getOnlineRecordById,
  reviewOnlineRecord,
  deleteOnlineRecord,
  getRecordCategories,
} from "../../api/onlineRecordApi";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

const ManageRecordsPage = () => {
  const navigate = useNavigate();

  const token = Cookies.get("accessToken");
  const decodedToken = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode(token);
    } catch (e) {
      return null;
    }
  }, [token]);

  const currentUserId = decodedToken?.userId || decodedToken?._id || decodedToken?.id;
  const currentUserRole = decodedToken?.role;
  const isAdmin = currentUserRole === "admin";
  const isManager = currentUserRole === "manager" || isAdmin;

  // Dữ liệu danh sách hồ sơ
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Bộ lọc
  const [activeTab, setActiveTab] = useState("all"); // "all", "sent", "received"
  const [searchText, setSearchText] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dateRange, setDateRange] = useState(null); // [dayjs, dayjs]
  const [categories, setCategories] = useState([]);
  const [exporting, setExporting] = useState(false);

  // Drawer chi tiết hồ sơ
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Modal xử lý / Phê duyệt
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewAction, setReviewAction] = useState("APPROVED"); // "PROCESSING", "APPROVED", "REJECTED"
  const [reviewOpinion, setReviewOpinion] = useState("");

  // 1. Tải danh mục loại hồ sơ cho bộ lọc
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await getRecordCategories();
        if (res.success) setCategories(res.data || []);
      } catch (err) {
        console.error("Lỗi nạp categories:", err);
      }
    };
    fetchCats();
  }, []);

  // 2. Tải danh sách hồ sơ
  const fetchRecordsList = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: pageSize,
        type: activeTab,
        search: searchText || undefined,
        category: filterCategory || undefined,
        status: filterStatus || undefined,
        startDate: dateRange && dateRange[0] ? dateRange[0].format("YYYY-MM-DD") : undefined,
        endDate: dateRange && dateRange[1] ? dateRange[1].format("YYYY-MM-DD") : undefined,
      };

      const res = await getOnlineRecords(params);
      if (res.success) {
        setRecords(res.data || []);
        setTotal(res.total || 0);
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể tải danh sách hồ sơ");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, activeTab, searchText, filterCategory, filterStatus, dateRange]);

  useEffect(() => {
    fetchRecordsList();
  }, [fetchRecordsList]);

  // 3. Xuất danh sách hồ sơ ra file Excel
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      message.loading({ content: "Đang tải dữ liệu hồ sơ để xuất Excel...", key: "exporting" });

      const params = {
        type: activeTab,
        search: searchText || undefined,
        category: filterCategory || undefined,
        status: filterStatus || undefined,
        startDate: dateRange && dateRange[0] ? dateRange[0].format("YYYY-MM-DD") : undefined,
        endDate: dateRange && dateRange[1] ? dateRange[1].format("YYYY-MM-DD") : undefined,
        isExport: "true",
      };

      const res = await getOnlineRecords(params);
      const dataToExport = res?.data || [];

      if (dataToExport.length === 0) {
        message.warning({ content: "Không có dữ liệu hồ sơ phù hợp để xuất!", key: "exporting" });
        return;
      }

      const statusMap = {
        PENDING: "Chờ tiếp nhận / Phê duyệt",
        PROCESSING: "Đang xử lý",
        APPROVED: "Đã duyệt / Tiếp nhận",
        REJECTED: "Từ chối / Cần bổ sung",
      };

      const exportRows = dataToExport.map((rec, index) => {
        const reviewersDetail = (rec.recipientReviews || [])
          .map((rv) => {
            const st = statusMap[rv.status] || rv.status || "Chưa duyệt";
            const op = rv.reviewOpinion ? ` - Ý kiến: ${rv.reviewOpinion}` : "";
            return `${rv.userName} (${st}${op})`;
          })
          .join("; ");

        const recipientNames = (rec.recipients || [])
          .map((u) => u.name || u.email || "")
          .filter(Boolean)
          .join(", ");

        const fileNames = (rec.attachedFiles || [])
          .map((f, i) => `${i + 1}. ${f.fileName || f.name || "Tệp đính kèm"}`)
          .join("; ");

        return {
          "STT": index + 1,
          "Mã hồ sơ": rec.recordCode || "",
          "Tiêu đề hồ sơ": rec.title || "",
          "Loại hồ sơ": rec.category?.name || rec.categoryName || "",
          "Người nộp hồ sơ": rec.fullName || rec.sender?.name || "",
          "Chức vụ": rec.positionName || "",
          "Đơn vị / Phòng ban": rec.departmentName || "",
          "Số điện thoại": rec.phoneNumber || "",
          "Email": rec.email || "",
          "Ngày nộp": rec.createdAt ? dayjs(rec.createdAt).format("DD/MM/YYYY HH:mm") : "",
          "Người tiếp nhận": recipientNames,
          "Trạng thái": statusMap[rec.status] || rec.status,
          "Ý kiến & Tiến độ từng người duyệt": reviewersDetail || recipientNames,
          "Số lượng tệp đính kèm": (rec.attachedFiles || []).length,
          "Danh sách tệp đính kèm": fileNames,
          "Ghi chú / Diễn giải": rec.note || "",
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportRows);

      ws["!cols"] = [
        { wch: 6 },
        { wch: 15 },
        { wch: 35 },
        { wch: 25 },
        { wch: 22 },
        { wch: 18 },
        { wch: 25 },
        { wch: 14 },
        { wch: 24 },
        { wch: 18 },
        { wch: 28 },
        { wch: 22 },
        { wch: 40 },
        { wch: 14 },
        { wch: 35 },
        { wch: 30 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ho_So_Truc_Tuyen");

      const dateStr = dayjs().format("YYYYMMDD_HHmm");
      XLSX.writeFile(wb, `Danh_Sach_Ho_So_Truc_Tuyen_${dateStr}.xlsx`);

      message.success({ content: `Xuất thành công ${exportRows.length} hồ sơ ra file Excel!`, key: "exporting" });
    } catch (err) {
      console.error("Lỗi xuất Excel:", err);
      message.error({ content: "Có lỗi xảy ra khi xuất Excel!", key: "exporting" });
    } finally {
      setExporting(false);
    }
  };

  // Xem chi tiết hồ sơ
  const handleViewDetail = async (id) => {
    try {
      setLoadingDetail(true);
      setDrawerVisible(true);
      const res = await getOnlineRecordById(id);
      if (res.success) {
        setSelectedRecord(res.data);
      }
    } catch (err) {
      message.error("Không thể tải chi tiết hồ sơ");
    } finally {
      setLoadingDetail(false);
    }
  };

  // Mở modal duyệt / xử lý hồ sơ
  const handleOpenReview = (record, action) => {
    setSelectedRecord(record);
    setReviewAction(action || (record.status === "PROCESSING" ? "APPROVED" : record.status) || "APPROVED");
    setReviewOpinion(record.reviewOpinion || "");
    setReviewModalVisible(true);
  };

  // Gửi kết quả xử lý
  const handleConfirmReview = async () => {
    if (!selectedRecord) return;
    try {
      setReviewSubmitting(true);
      const res = await reviewOnlineRecord(selectedRecord._id, {
        status: reviewAction,
        reviewOpinion: reviewOpinion.trim(),
      });
      if (res.success) {
        message.success(res.message || "Cập nhật trạng thái thành công");
        setReviewModalVisible(false);
        if (drawerVisible) {
          const detailRes = await getOnlineRecordById(selectedRecord._id);
          if (detailRes.success) setSelectedRecord(detailRes.data);
        }
        fetchRecordsList();
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi khi xử lý hồ sơ");
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Xóa hồ sơ
  const handleDelete = async (id) => {
    try {
      await deleteOnlineRecord(id);
      message.success("Xóa hồ sơ thành công!");
      fetchRecordsList();
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể xóa hồ sơ");
    }
  };

  const renderStatusTag = (status) => {
    switch (status) {
      case "PENDING":
        return <Badge status="warning" text={<span className="text-amber-600 font-medium">Chờ tiếp nhận</span>} />;
      case "PROCESSING":
        return <Badge status="processing" text={<span className="text-blue-600 font-medium">Đang xử lý</span>} />;
      case "APPROVED":
        return <Badge status="success" text={<span className="text-green-600 font-semibold">Đã duyệt / Tiếp nhận</span>} />;
      case "REJECTED":
        return <Badge status="error" text={<span className="text-red-600 font-medium">Từ chối / Cần bổ sung</span>} />;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 50,
      align: "center",
      render: (_, __, index) => (
        <span className="font-semibold text-gray-500">
          {(page - 1) * pageSize + index + 1}
        </span>
      ),
    },
    {
      title: "Mã hồ sơ",
      dataIndex: "recordCode",
      key: "recordCode",
      width: 120,
      align: "center",
      render: (code, record) => (
        <Tag
          color="blue"
          className="font-mono font-bold tracking-wider px-2 py-0.5 cursor-pointer"
          onClick={() => handleViewDetail(record._id)}
        >
          {code || "HS-XXXX"}
        </Tag>
      ),
    },
    {
      title: "Người nộp hồ sơ",
      key: "senderInfo",
      width: 200,
      render: (_, record) => (
        <div>
          <div className="font-semibold text-gray-900 flex items-center gap-1.5">
            <UserOutlined className="text-blue-500 text-xs" />
            <span>{record.fullName}</span>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
            <BankOutlined className="text-gray-400 text-xs" />
            <span className="truncate">{record.departmentName || "--"}</span>
          </div>
        </div>
      ),
    },
    {
      title: "Loại hồ sơ",
      dataIndex: "categoryName",
      key: "categoryName",
      width: 200,
      render: (catName, record) => (
        <Tag color="cyan" className="text-xs font-medium whitespace-normal max-w-full">
          {catName || record.category?.name || "Hồ sơ chung"}
        </Tag>
      ),
    },
    {
      title: "Tiêu đề hồ sơ",
      dataIndex: "title",
      key: "title",
      minWidth: 230,
      render: (title, record) => (
        <div>
          <span
            className="font-semibold text-gray-900 hover:text-blue-600 cursor-pointer transition-colors block text-sm"
            onClick={() => handleViewDetail(record._id)}
          >
            {title}
          </span>
          <span className="text-xs text-gray-400 flex items-center gap-1 mt-1">
            <CalendarOutlined />
            {dayjs(record.createdAt).format("DD/MM/YYYY HH:mm")}
          </span>
        </div>
      ),
    },
    {
      title: "File đính kèm",
      key: "files",
      width: 120,
      align: "center",
      render: (_, record) => {
        const count = record.attachedFiles?.length || 0;
        if (count === 0) return <Text type="secondary" className="text-xs italic">Không có</Text>;
        return (
          <Button
            size="small"
            type="dashed"
            icon={<FilePdfOutlined className="text-red-500" />}
            onClick={() => handleViewDetail(record._id)}
            className="text-xs"
          >
            {count} tệp
          </Button>
        );
      },
    },
    {
      title: "Người nhận / Cấp duyệt",
      key: "recipients",
      width: 180,
      render: (_, record) => {
        const names = record.recipientNames || record.recipients?.map((r) => r.name) || [];
        if (names.length === 0) return <Text type="secondary">--</Text>;
        return (
          <div className="flex flex-wrap gap-1">
            {names.map((n, i) => (
              <Tag key={i} color="geekblue" className="text-xs">
                {n}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 150,
      render: (status) => renderStatusTag(status),
    },
    {
      title: "Thao tác",
      key: "action",
      width: isMobile ? 105 : 180,
      align: "center",
      fixed: "right",
      render: (_, record) => {
        const isOwner = String(record.sender?._id || record.sender) === String(currentUserId);
        const isRecipient = record.recipients?.some(
          (r) => String(r._id || r) === String(currentUserId)
        );
        const canReview = isRecipient || isManager;
        const canDelete = isOwner || isAdmin;

        return (
          <div className="flex flex-row items-center justify-center gap-1.5 py-0.5">
            <Tooltip title="Xem chi tiết hồ sơ">
              <Button
                type="primary"
                ghost
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleViewDetail(record._id)}
                className="rounded text-xs flex items-center justify-center px-2 py-0.5 max-sm:!w-7 max-sm:!h-7 max-sm:!p-0"
              >
                <span className="hidden sm:inline ml-1">Xem</span>
              </Button>
            </Tooltip>

            {canReview && (record.status === "PENDING" || record.status === "PROCESSING" || isManager) && (
              <Tooltip title={record.status === "PROCESSING" ? "Cập nhật tiến độ / Phê duyệt hồ sơ" : "Tiếp nhận & Xử lý hồ sơ"}>
                <Button
                  size="small"
                  icon={record.status === "PROCESSING" ? <SyncOutlined /> : <CheckCircleOutlined />}
                  onClick={() => handleOpenReview(record, record.status === "PROCESSING" ? "APPROVED" : "APPROVED")}
                  className={`rounded text-xs flex items-center justify-center px-2 py-0.5 max-sm:!w-7 max-sm:!h-7 max-sm:!p-0 ${
                    record.status === "PROCESSING"
                      ? "text-blue-600 border-blue-400 hover:bg-blue-50"
                      : "text-emerald-600 border-emerald-400 hover:bg-emerald-50"
                  }`}
                >
                  <span className="hidden sm:inline ml-1">
                    {record.status === "PROCESSING" ? "Cập nhật" : "Duyệt"}
                  </span>
                </Button>
              </Tooltip>
            )}

            {canDelete && (
              <Tooltip title="Xóa hồ sơ">
                <Popconfirm
                  title="Xóa hồ sơ này?"
                  description="Bạn có chắc chắn muốn xóa hồ sơ này không?"
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
                    className="rounded text-xs flex items-center justify-center px-2 py-0.5 max-sm:!w-7 max-sm:!h-7 max-sm:!p-0"
                  >
                    <span className="hidden sm:inline ml-1">Xóa</span>
                  </Button>
                </Popconfirm>
              </Tooltip>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="w-full px-2 sm:px-4 py-3 space-y-3">
      <Card className="shadow-sm border-gray-200 w-full">
        {/* HEADER TIÊU ĐỀ & NÚT TẠO */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gray-100">
          <div>
            <Title level={4} className="!mb-0 flex items-center gap-2 text-blue-800 text-base sm:text-lg">
              <AuditOutlined className="text-blue-600 text-xl" />
              Quản Lý Hồ Sơ Trực Tuyến
            </Title>
            <Text type="secondary" className="text-xs">
              Theo dõi, xử lý và phê duyệt các hồ sơ nộp trực tuyến trong toàn trường
            </Text>
          </div>

          <Space wrap className="w-full sm:w-auto justify-end">
            <Button
              icon={<FileExcelOutlined />}
              onClick={handleExportExcel}
              loading={exporting}
              size="middle"
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-none flex items-center shadow-2xs"
            >
              Xuất Excel
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchRecordsList} loading={loading} size="middle">
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => navigate("/online-records/submit")}
              className="bg-blue-600 hover:bg-blue-700 shadow-sm"
              size="middle"
            >
              Gửi hồ sơ mới
            </Button>
          </Space>
        </div>

        {/* TABS PHÂN LOẠI DANH SÁCH */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setPage(1);
          }}
          className="mt-2"
        >
          <TabPane
            tab={
              <span>
                <AuditOutlined /> Tất cả hồ sơ
              </span>
            }
            key="all"
          />
          <TabPane
            tab={
              <span>
                <SendOutlined /> Hồ sơ tôi gửi
              </span>
            }
            key="sent"
          />
          <TabPane
            tab={
              <span>
                <InboxOutlined /> Hồ sơ gửi đến tôi
              </span>
            }
            key="received"
          />
        </Tabs>

        {/* BỘ LỌC TÌM KIẾM */}
        <div className="mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <div>
              <Text className="text-xs text-gray-500 font-medium block mb-1">
                Tìm mã, tiêu đề, người nộp:
              </Text>
              <Input
                placeholder="Nhập từ khóa tìm kiếm..."
                prefix={<SearchOutlined className="text-gray-400" />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </div>

            <div>
              <Text className="text-xs text-gray-500 font-medium block mb-1">
                Loại hồ sơ:
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
                Trạng thái duyệt:
              </Text>
              <Select
                className="w-full"
                value={filterStatus}
                onChange={setFilterStatus}
                placeholder="Tất cả trạng thái"
                allowClear
              >
                <Select.Option value="">Tất cả trạng thái</Select.Option>
                <Select.Option value="PENDING">Chờ tiếp nhận</Select.Option>
                <Select.Option value="PROCESSING">Đang xử lý</Select.Option>
                <Select.Option value="APPROVED">Đã duyệt / Tiếp nhận</Select.Option>
                <Select.Option value="REJECTED">Từ chối / Cần bổ sung</Select.Option>
              </Select>
            </div>

            <div>
              <Text className="text-xs text-gray-500 font-medium block mb-1">
                Khoảng thời gian nộp:
              </Text>
              <RangePicker
                className="w-full"
                value={dateRange}
                onChange={setDateRange}
                format="DD/MM/YYYY"
                placeholder={["Từ ngày", "Đến ngày"]}
                allowClear
              />
            </div>

            <div className="flex items-end">
              <Button
                icon={<ClearOutlined />}
                onClick={() => {
                  setSearchText("");
                  setFilterCategory("");
                  setFilterStatus("");
                  setDateRange(null);
                }}
                className="w-full"
                disabled={!searchText && !filterCategory && !filterStatus && !dateRange}
              >
                Xóa bộ lọc
              </Button>
            </div>
          </div>
        </div>

        {/* BẢNG DANH SÁCH */}
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={records}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showLessItems: true,
            responsive: true,
            pageSizeOptions: ["10", "15", "25", "50"],
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showTotal: (totalCount) => `Tổng cộng ${totalCount} hồ sơ`,
          }}
          bordered
          size="middle"
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: "Không tìm thấy hồ sơ trực tuyến nào",
          }}
        />
      </Card>

      {/* DRAWER CHI TIẾT HỒ SƠ */}
      <Drawer
        title={
          <div className="flex items-center gap-2 text-blue-800">
            <FileDoneOutlined className="text-blue-600 text-lg" />
            <span className="font-bold">Chi tiết Hồ sơ Trực tuyến</span>
            {selectedRecord?.recordCode && (
              <Tag color="blue" className="font-mono">
                {selectedRecord.recordCode}
              </Tag>
            )}
          </div>
        }
        width={720}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        destroyOnClose
        extra={
          selectedRecord && (
            <Space>
              {(isManager || selectedRecord.recipients?.some((r) => String(r._id || r) === String(currentUserId))) &&
                (selectedRecord.status === "PENDING" || selectedRecord.status === "PROCESSING") && (
                  <>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleOpenReview(selectedRecord, "APPROVED")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                    >
                      Duyệt hồ sơ
                    </Button>
                    <Button
                      icon={<SyncOutlined />}
                      onClick={() => handleOpenReview(selectedRecord, "PROCESSING")}
                      className="text-blue-600 border-blue-400 hover:bg-blue-50 font-medium"
                    >
                      Đang xử lý
                    </Button>
                    <Button 
                      danger 
                      icon={<CloseCircleOutlined />}
                      onClick={() => handleOpenReview(selectedRecord, "REJECTED")}
                      className="font-medium"
                    >
                      Yêu cầu sửa
                    </Button>
                  </>
                )}
            </Space>
          )
        }
      >
        {selectedRecord && (
          <div className="space-y-4">
            {/* TRẠNG THÁI */}
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-xs text-gray-500 font-medium">Trạng thái hồ sơ:</span>
              <div>{renderStatusTag(selectedRecord.status)}</div>
            </div>

            {/* THÔNG TIN NGƯỜI NỘP */}
            <Card size="small" title={<span className="text-sm font-semibold text-gray-800">Người nộp hồ sơ</span>}>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-500 block">Họ và tên:</span>
                  <span className="font-semibold text-gray-800 text-sm">{selectedRecord.fullName}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Đơn vị / Phòng ban:</span>
                  <span className="font-medium text-gray-800">{selectedRecord.departmentName || "--"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Chức vụ:</span>
                  <span className="text-gray-800">{selectedRecord.positionName || "--"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Ngày gửi:</span>
                  <span className="text-gray-800">
                    {dayjs(selectedRecord.createdAt).format("DD/MM/YYYY HH:mm:ss")}
                  </span>
                </div>
              </div>
            </Card>

            {/* NỘI DUNG HỒ SƠ */}
            <Card size="small" title={<span className="text-sm font-semibold text-gray-800">Nội dung hồ sơ</span>}>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-500 block">Loại hồ sơ:</span>
                  <Tag color="cyan" className="font-medium text-xs mt-0.5">
                    {selectedRecord.categoryName || selectedRecord.category?.name}
                  </Tag>
                </div>
                <div>
                  <span className="text-gray-500 block">Tiêu đề / Trích yếu:</span>
                  <span className="font-bold text-gray-900 text-sm block mt-0.5">
                    {selectedRecord.title}
                  </span>
                </div>
                {selectedRecord.note && (
                  <div>
                    <span className="text-gray-500 block">Ghi chú của người gửi:</span>
                    <Paragraph className="!mb-0 text-gray-700 bg-gray-50 p-2 rounded border border-gray-200 mt-1">
                      {selectedRecord.note}
                    </Paragraph>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 block mb-1">Người nhận & Trạng thái thẩm định từng người:</span>
                  <div className="space-y-1.5 mt-1 bg-white p-2.5 rounded border border-gray-200">
                    {selectedRecord.recipientReviews && selectedRecord.recipientReviews.length > 0 ? (
                      selectedRecord.recipientReviews.map((rev, idx) => {
                        const statusTag =
                          rev.status === "APPROVED" ? (
                            <Tag color="success">Đã duyệt</Tag>
                          ) : rev.status === "REJECTED" ? (
                            <Tag color="error">Từ chối / Bổ sung</Tag>
                          ) : rev.status === "PROCESSING" ? (
                            <Tag color="processing">Đang xử lý</Tag>
                          ) : (
                            <Tag color="warning">Chưa duyệt</Tag>
                          );

                        return (
                          <div
                            key={rev._id || idx}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-1.5 border-b border-gray-100 last:border-b-0 gap-1"
                          >
                            <div className="flex items-center gap-1.5">
                              <UserOutlined className="text-blue-500 text-xs" />
                              <span className="font-semibold text-gray-800">{rev.userName}</span>
                              <span className="text-gray-400">({rev.userRole})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {rev.reviewOpinion && (
                                <Tooltip title={`Ý kiến: ${rev.reviewOpinion}`}>
                                  <span className="text-xs text-gray-500 italic max-w-[200px] truncate">
                                    "{rev.reviewOpinion}"
                                  </span>
                                </Tooltip>
                              )}
                              {statusTag}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {(selectedRecord.recipientNames || selectedRecord.recipients?.map((r) => r.name) || []).map(
                          (n, idx) => (
                            <Tag color="blue" key={idx}>
                              {n}
                            </Tag>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* FILE ĐÍNH KÈM */}
            <Card
              size="small"
              title={
                <span className="text-sm font-semibold text-gray-800 flex items-center justify-between">
                  <span>File đính kèm ({selectedRecord.attachedFiles?.length || 0})</span>
                </span>
              }
            >
              {selectedRecord.attachedFiles?.length === 0 ? (
                <Text type="secondary" className="text-xs italic">Không có file đính kèm</Text>
              ) : (
                <div className="space-y-2">
                  {selectedRecord.attachedFiles?.map((file, idx) => (
                    <div
                      key={file.fileId || idx}
                      className="flex items-center justify-between p-2.5 bg-gray-50 rounded border border-gray-200 text-xs hover:bg-blue-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FilePdfOutlined className="text-red-500 text-base flex-shrink-0" />
                        <div className="overflow-hidden">
                          <span className="font-medium text-gray-900 block truncate" title={file.fileName}>
                            {file.fileName}
                          </span>
                          <span className="text-xs text-blue-600">
                            Loại file: {file.attachmentTypeName || file.attachmentType?.name || "Minh chứng"}
                          </span>
                        </div>
                      </div>
                      <a
                        href={file.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 bg-white rounded border border-blue-200 flex-shrink-0"
                      >
                        <LinkOutlined /> Mở file
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* THÔNG TIN VỀ NGƯỜI QUẢN LÝ XỬ LÝ HỒ SƠ */}
            {(selectedRecord.reviewOpinion || selectedRecord.reviewedByName) && (
              <Card
                size="small"
                className="border-emerald-200 bg-emerald-50/20"
                title={<span className="text-sm font-semibold text-emerald-800">Thông tin về người quản lý xử lý hồ sơ</span>}
              >
                <div className="text-xs text-gray-700">
                  <div className="flex items-center justify-between mb-1 text-gray-500">
                    <span>Người xử lý: <strong>{selectedRecord.reviewedByName || "Người duyệt"}</strong></span>
                    <span>
                      {selectedRecord.reviewedAt && dayjs(selectedRecord.reviewedAt).format("DD/MM/YYYY HH:mm")}
                    </span>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-emerald-200 mt-1 leading-relaxed">
                    {selectedRecord.reviewOpinion}
                  </div>
                </div>
              </Card>
            )}

            {/* LỊCH SỬ XỬ LÝ */}
            <Card size="small" title={<span className="text-sm font-semibold text-gray-800">Lịch sử tiến trình hồ sơ</span>}>
              <Timeline
                className="mt-2 text-xs"
                items={(selectedRecord.history || []).map((h) => ({
                  color: h.action === "APPROVED" ? "green" : h.action === "REJECTED" ? "red" : "blue",
                  children: (
                    <div>
                      <div className="font-semibold text-gray-800">
                        {h.details || h.action}
                      </div>
                      <div className="text-gray-400 text-xs mt-0.5">
                        Thực hiện bởi: {h.actorName} ({dayjs(h.timestamp).format("DD/MM/YYYY HH:mm:ss")})
                      </div>
                    </div>
                  ),
                }))}
              />
            </Card>
          </div>
        )}
      </Drawer>

      {/* MODAL PHÊ DUYỆT / XỬ LÝ HỒ SƠ */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-700">
            <AuditOutlined className="text-blue-600 text-xl" />
            <span className="font-bold">Xử lý & Phê duyệt Hồ sơ Trực tuyến</span>
          </div>
        }
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        onOk={handleConfirmReview}
        confirmLoading={reviewSubmitting}
        okText="Xác nhận xử lý"
        cancelText="Hủy bỏ"
        destroyOnClose
        width={550}
      >
        <div className="space-y-3 mt-4">
          <div>
            <Text className="text-xs text-gray-500 block mb-1">Hồ sơ đang xử lý:</Text>
            <div className="p-2 bg-slate-50 rounded border text-xs font-semibold text-gray-800">
              {selectedRecord?.recordCode} - {selectedRecord?.title} ({selectedRecord?.fullName})
            </div>
          </div>

          <div>
            <Text className="text-xs text-gray-500 block mb-2 font-medium">
              Kết quả thẩm định / Xử lý:
            </Text>
            <div className="grid grid-cols-3 gap-2.5">
              <Button
                type={reviewAction === "APPROVED" ? "primary" : "default"}
                icon={<CheckCircleOutlined className={reviewAction === "APPROVED" ? "text-white" : "text-emerald-600"} />}
                onClick={() => setReviewAction("APPROVED")}
                className={`flex items-center justify-center text-xs h-10 font-semibold rounded-md transition-all ${
                  reviewAction === "APPROVED"
                    ? "!bg-emerald-600 !border-emerald-600 !text-white shadow-sm ring-2 ring-emerald-200"
                    : "!border-emerald-400 !text-emerald-700 bg-emerald-50/40 hover:!bg-emerald-100/70"
                }`}
              >
                Duyệt hồ sơ
              </Button>
              <Button
                type={reviewAction === "PROCESSING" ? "primary" : "default"}
                icon={<SyncOutlined spin={reviewAction === "PROCESSING"} className={reviewAction === "PROCESSING" ? "text-white" : "text-blue-600"} />}
                onClick={() => setReviewAction("PROCESSING")}
                className={`flex items-center justify-center text-xs h-10 font-semibold rounded-md transition-all ${
                  reviewAction === "PROCESSING"
                    ? "!bg-blue-600 !border-blue-600 !text-white shadow-sm ring-2 ring-blue-200"
                    : "!border-blue-400 !text-blue-700 bg-blue-50/40 hover:!bg-blue-100/70"
                }`}
              >
                Đang xử lý
              </Button>
              <Button
                type={reviewAction === "REJECTED" ? "primary" : "default"}
                danger={reviewAction === "REJECTED"}
                icon={<CloseCircleOutlined className={reviewAction === "REJECTED" ? "text-white" : "text-red-600"} />}
                onClick={() => setReviewAction("REJECTED")}
                className={`flex items-center justify-center text-xs h-10 font-semibold rounded-md transition-all ${
                  reviewAction === "REJECTED"
                    ? "!bg-red-600 !border-red-600 !text-white shadow-sm ring-2 ring-red-200"
                    : "!border-red-400 !text-red-700 bg-red-50/40 hover:!bg-red-100/70"
                }`}
              >
                Yêu cầu sửa
              </Button>
            </div>
          </div>

          <div>
            <Text className="text-xs text-gray-500 block mb-1 font-medium">
              Ý kiến chỉ đạo / Nhận xét phản hồi:
            </Text>
            <TextArea
              rows={3}
              value={reviewOpinion}
              onChange={(e) => setReviewOpinion(e.target.value)}
              placeholder="Nhập nội dung phản hồi, hướng dẫn bổ sung hồ sơ hoặc ý kiến phê duyệt..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ManageRecordsPage;
