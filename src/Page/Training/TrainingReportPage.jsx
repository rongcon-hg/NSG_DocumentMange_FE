/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  Button,
  Table,
  Tag,
  Typography,
  Space,
  message,
  Spin,
  Input,
  Drawer,
  Divider,
  Timeline,
  Modal,
  Upload,
  Alert,
  Tooltip,
  Badge,
  Progress,
} from "antd";
import {
  ReadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileExcelOutlined,
  ReloadOutlined,
  SearchOutlined,
  FilterOutlined,
  UndoOutlined,
  EyeOutlined,
  DownloadOutlined,
  UploadOutlined,
  DollarOutlined,
  BankOutlined,
  TrophyOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  InboxOutlined,
  PaperClipOutlined,
  BookOutlined,
} from "@ant-design/icons";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import dayjs from "dayjs";
import {
  getTrainingStats,
  getTrainingRegistrations,
  exportTrainingExcel,
  downloadTrainingTemplate,
  importTrainingExcel,
} from "../../api/trainingApi";
import { getDepartments } from "../../api/DepartmentAPI";
import { getUserInfo } from "../../api/auth";
import { isBghUser } from "../../utils/userClassification";
import { useNotificationContext } from "../../context/NotificationContext";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

const TRAINING_FORMS = ["Chứng chỉ", "Chứng nhận", "Văn bằng", "Khác"];
const PIE_COLORS = ["#1890ff", "#52c41a", "#722ed1", "#fa8c16"];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [
  currentYear - 2,
  currentYear - 1,
  currentYear,
  currentYear + 1,
  currentYear + 2,
].map((y) => y.toString());

const formatProofFileName = (file, recordOrCert, idx) => {
  if (!file) return `Tệp minh chứng ${idx + 1}`;
  const name = (file.fileName || "").trim();
  if (!name || /^(view|preview|edit|download)(\?.*)?$/i.test(name) || /^https?:\/\//i.test(name)) {
    const cert =
      typeof recordOrCert === "string"
        ? recordOrCert
        : recordOrCert?.certificateNumber || recordOrCert?.reportResult?.certificateNumber;
    return cert ? `Tệp minh chứng (${cert})` : `Tệp minh chứng đính kèm ${idx + 1}`;
  }
  return name;
};

const TrainingReportPage = () => {
  const { userId, userRole } = useNotificationContext();
  const [currentUserData, setCurrentUserData] = useState(null);

  const isManagerOrAdmin =
    userRole === "admin" ||
    userRole === "manager" ||
    currentUserData?.role === "admin" ||
    currentUserData?.role === "manager";

  // Check tài khoản đặc quyền: Mai Anh Thy
  const isMaiAnhThy = (() => {
    const name = (currentUserData?.name || "").trim().toLowerCase();
    const normalizedName = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
    if (normalizedName === "mai anh thy" || normalizedName.includes("mai anh thy")) return true;

    const username = (currentUserData?.username || "").trim().toLowerCase();
    if (username === "maianhthy" || username.includes("maianhthy") || username === "thymaianh") return true;

    const email = (currentUserData?.email || "").trim().toLowerCase();
    if (email.includes("maianhthy") || email.startsWith("thy") || email.includes("thiy")) return true;

    return false;
  })();

  const isBgh =
    isBghUser(currentUserData) ||
    (currentUserData?.department?.departmentCode || "").toUpperCase() === "BGH";

  const isCapTruong =
    !isMaiAnhThy &&
    !isBgh &&
    !isManagerOrAdmin &&
    (currentUserData?.role === "staff" ||
      currentUserData?.role === "captruong" ||
      (currentUserData?.position?.positionName || "").toLowerCase().includes("trưởng"));

  const isCapPho =
    !isMaiAnhThy &&
    !isBgh &&
    !isManagerOrAdmin &&
    !isCapTruong &&
    (currentUserData?.role === "cappho" ||
      (currentUserData?.position?.positionName || "").toLowerCase().includes("phó"));

  const isChuyenVien = !isMaiAnhThy && !isBgh && !isManagerOrAdmin && !isCapTruong && !isCapPho;

  // State bộ lọc
  const [filterYear, setFilterYear] = useState(currentYear.toString());
  const [filterDept, setFilterDept] = useState("");
  const [filterForm, setFilterForm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterReported, setFilterReported] = useState("");
  const [searchText, setSearchText] = useState("");

  // Dữ liệu
  const [stats, setStats] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Phân trang bảng
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Modal Chi tiết
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Modal Import Excel
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importFileList, setImportFileList] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Responsive mobile
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (userId) {
      getUserInfo(userId)
        .then((res) => {
          const u = res?.data || res?.user;
          if (u) setCurrentUserData(u);
        })
        .catch((err) => console.error("Lỗi lấy thông tin user:", err));
    }
  }, [userId]);

  // Lấy danh mục phòng ban
  useEffect(() => {
    const loadDepts = async () => {
      try {
        const res = await getDepartments();
        const list = (
          res?.AllDepartment ||
          res?.data ||
          res?.departments ||
          (Array.isArray(res) ? res : [])
        ).filter((d) => !d.departmentName?.toLowerCase().includes("giải thể"));
        setDepartments(list);
      } catch (err) {
        console.error("Lỗi nạp danh sách phòng ban:", err);
      }
    };
    loadDepts();
  }, []);

  // Tải dữ liệu thống kê
  const fetchStats = useCallback(async () => {
    try {
      const params = {};
      if (filterYear) params.year = filterYear;
      if (filterDept) params.department = filterDept;

      const res = await getTrainingStats(params);
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error("Lỗi lấy thống kê bồi dưỡng:", err);
    }
  }, [filterYear, filterDept]);

  // Tải danh sách chi tiết
  const fetchRegistrations = useCallback(
    async (page = 1, pageSize = 10) => {
      setLoading(true);
      try {
        const params = {
          page,
          limit: pageSize,
        };
        if (filterYear) params.year = filterYear;
        if (filterDept) params.department = filterDept;
        if (filterForm) params.trainingForm = filterForm;
        if (filterStatus) params.status = filterStatus;
        if (filterReported) params.reportStatus = filterReported;
        if (searchText) params.search = searchText.trim();

        const res = await getTrainingRegistrations(params);
        if (res.success && res.data) {
          setRegistrations(res.data);
          const totalCount =
            typeof res.total === "number"
              ? res.total
              : typeof res.pagination?.total === "number"
              ? res.pagination.total
              : res.data.length;
          const curPage = res.page || res.pagination?.page || page;
          const curLimit = res.limit || res.pagination?.limit || pageSize;
          setPagination({
            current: curPage,
            pageSize: curLimit,
            total: totalCount,
          });
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách bồi dưỡng:", err);
        message.error("Không thể tải danh sách học tập bồi dưỡng");
      } finally {
        setLoading(false);
      }
    },
    [filterYear, filterDept, filterForm, filterStatus, filterReported, searchText]
  );

  useEffect(() => {
    fetchStats();
    fetchRegistrations(1, pagination.pageSize);
  }, [fetchStats, fetchRegistrations]);

  // Xử lý đổi trang
  const handleTableChange = (newPagination) => {
    fetchRegistrations(newPagination.current, newPagination.pageSize);
  };

  // Đặt lại bộ lọc
  const handleResetFilters = () => {
    setFilterYear(currentYear.toString());
    setFilterDept("");
    setFilterForm("");
    setFilterStatus("");
    setFilterReported("");
    setSearchText("");
  };

  // Xem chi tiết
  const handleOpenDetail = (record) => {
    setSelectedRecord(record);
    setDrawerVisible(true);
  };

  // Xuất file Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      if (filterYear) params.year = filterYear;
      if (filterDept) params.department = filterDept;
      if (filterForm) params.trainingForm = filterForm;
      if (filterStatus) params.status = filterStatus;

      const res = await exportTrainingExcel(params);
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bao_cao_boi_duong_${filterYear || "TatCa"}_${dayjs().format(
        "YYYYMMDD_HHmm"
      )}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success("Xuất báo cáo Excel thành công!");
    } catch (err) {
      console.error("Lỗi xuất Excel:", err);
      message.error("Có lỗi xảy ra khi xuất file Excel!");
    } finally {
      setExporting(false);
    }
  };

  // Tải file mẫu Excel
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await downloadTrainingTemplate();
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Mau_dang_ky_boi_duong.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success("Đã tải file mẫu Excel kèm danh mục hướng dẫn!");
    } catch (err) {
      console.error("Lỗi tải file mẫu:", err);
      message.error("Không thể tải file mẫu Excel!");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Thực hiện Import file Excel
  const handleExecuteImport = async () => {
    if (importFileList.length === 0) {
      message.warning("Vui lòng chọn file Excel để import!");
      return;
    }

    setImporting(true);
    setImportResult(null);
    try {
      const fileToUpload = importFileList[0].originFileObj || importFileList[0];
      const res = await importTrainingExcel(fileToUpload);
      if (res.success) {
        setImportResult(res);
        message.success(res.message || "Import thành công!");
        fetchStats();
        fetchRegistrations(1, pagination.pageSize);
      } else {
        message.error(res.message || "Import thất bại!");
        setImportResult(res);
      }
    } catch (err) {
      console.error("Lỗi import Excel:", err);
      const errMsg = err?.response?.data?.message || "Có lỗi xảy ra khi import file!";
      message.error(errMsg);
      if (err?.response?.data) {
        setImportResult(err.response.data);
      }
    } finally {
      setImporting(false);
    }
  };

  // Dữ liệu biểu đồ hình thức đào tạo
  const formChartData = useMemo(() => {
    if (!stats || !stats.formStats) return [];
    return Object.entries(stats.formStats).map(([name, value]) => ({
      name,
      value,
    }));
  }, [stats]);

  // Dữ liệu biểu đồ phòng ban
  const deptChartData = useMemo(() => {
    if (!stats || !stats.departmentBreakdown) return [];
    return stats.departmentBreakdown.slice(0, 10).map((d) => ({
      name:
        d.departmentName.length > 20
          ? d.departmentName.substring(0, 18) + "..."
          : d.departmentName,
      fullName: d.departmentName,
      tong: d.total,
      daDuyet: d.approved,
      daHoc: d.attended,
    }));
  }, [stats]);

  // Cột bảng danh sách
  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 60,
      align: "center",
      render: (_, __, index) =>
        (pagination.current - 1) * pagination.pageSize + index + 1,
    },
    {
      title: "Cán bộ / Giảng viên",
      key: "user",
      width: 220,
      render: (_, record) => (
        <div>
          <div className="font-semibold text-blue-700">
            {record.userName || record.user?.name || "N/A"}
          </div>
          {record.user?.email && (
            <div className="text-xs text-gray-500">{record.user.email}</div>
          )}
          <div className="text-xs text-gray-600 font-medium">
            {record.positionName || record.position?.positionName || record.user?.position?.positionName || "Cán bộ / Giảng viên"}
          </div>
        </div>
      ),
    },
    {
      title: "Đơn vị",
      key: "department",
      width: 180,
      render: (_, record) => (
        <span className="text-gray-800 font-medium">
          {record.departmentName || record.department?.departmentName || record.user?.department?.departmentName || "—"}
        </span>
      ),
    },
    {
      title: "Năm & Hình thức",
      key: "form",
      width: 150,
      render: (_, record) => {
        let color = "blue";
        if (record.trainingForm === "Chứng chỉ") color = "green";
        if (record.trainingForm === "Văn bằng") color = "purple";
        if (record.trainingForm === "Chứng nhận") color = "cyan";
        return (
          <Space direction="vertical" size={2}>
            <Tag color="geekblue" className="font-bold">
              Năm {record.year}
            </Tag>
            <Tag color={color}>{record.trainingForm || "Khác"}</Tag>
          </Space>
        );
      },
    },
    {
      title: "Nội dung & Nơi đào tạo",
      key: "content",
      width: 260,
      render: (_, record) => (
        <div>
          <div className="font-semibold text-gray-900 line-clamp-2">
            {record.trainingContent}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            <BankOutlined className="mr-1 text-gray-400" />
            {record.trainingLocation || "Chưa xác định"}
          </div>
          {record.trainingDuration && (
            <div className="text-xs text-indigo-600">
              Thời gian: {record.trainingDuration}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Kinh phí dự kiến",
      dataIndex: "estimatedCost",
      key: "estimatedCost",
      width: 140,
      align: "right",
      render: (cost) => (
        <span className="font-bold text-blue-800">
          {cost ? Number(cost).toLocaleString("vi-VN") + " đ" : "0 đ"}
        </span>
      ),
    },
    {
      title: "Trạng thái duyệt",
      dataIndex: "status",
      key: "status",
      width: 130,
      align: "center",
      render: (status) => {
        if (status === "APPROVED")
          return (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Đã duyệt
            </Tag>
          );
        if (status === "REJECTED")
          return (
            <Tag color="error" icon={<CloseCircleOutlined />}>
              Từ chối
            </Tag>
          );
        return (
          <Tag color="warning" icon={<ClockCircleOutlined />}>
            Chờ duyệt
          </Tag>
        );
      },
    },
    {
      title: "Kết quả bồi dưỡng",
      key: "reportResult",
      width: 180,
      render: (_, record) => {
        const report = record.reportResult;
        if (!report || report.status === "NOT_REPORTED") {
          return <Tag color="default">Chưa báo cáo</Tag>;
        }
        if (report.attended) {
          return (
            <Space direction="vertical" size={2}>
              <Tag color="green" icon={<SafetyCertificateOutlined />}>
                Đã hoàn thành
              </Tag>
              {report.hasFundingSupport && (
                <span className="text-xs text-emerald-700 font-semibold">
                  Hỗ trợ:{" "}
                  {Number(report.actualFundAmount || 0).toLocaleString("vi-VN")}{" "}
                  đ
                </span>
              )}
              {report.proofFiles && report.proofFiles.length > 0 && (
                <span className="text-xs text-blue-600">
                  <PaperClipOutlined /> {report.proofFiles.length} minh chứng
                </span>
              )}
            </Space>
          );
        }
        return (
          <Tooltip title={`Lý do: ${report.notAttendedReason || "Không nêu"}`}>
            <Tag color="volcano" icon={<CloseCircleOutlined />}>
              Không tham gia
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Thao tác",
      key: "action",
      width: isMobile ? 55 : 95,
      align: "center",
      fixed: "right",
      render: (_, record) => (
        <Tooltip title="Xem chi tiết hồ sơ">
          <Button
            size="small"
            onClick={() => handleOpenDetail(record)}
            className="rounded sm:h-7 sm:px-2.5 max-sm:!w-7 max-sm:!h-7 max-sm:!p-0 flex items-center justify-center text-xs font-medium mx-auto border border-blue-200 bg-blue-50/70 text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-colors"
          >
            <EyeOutlined />
            <span className="hidden sm:inline ml-1">Chi tiết</span>
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="p-2 sm:p-4 max-w-full overflow-hidden">
      {/* Tiêu đề trang và các nút hành động */}
      <Card className="mb-4 shadow-sm border-blue-100 bg-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <Title level={4} className="!mb-0 text-blue-800 flex items-center gap-2">
              <ReadOutlined className="text-blue-600" />
              Báo cáo - Thống kê Học tập bồi dưỡng
            </Title>
            <Text type="secondary" className="text-xs sm:text-sm">
              Theo dõi tình hình đăng ký, tiến độ học tập và kinh phí hỗ trợ đào tạo cán bộ viên chức
            </Text>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                fetchStats();
                fetchRegistrations(pagination.current, pagination.pageSize);
              }}
              loading={loading}
            >
              Làm mới
            </Button>

            {!isChuyenVien && (
              <Button
                icon={<UploadOutlined />}
                className="border-green-600 text-green-700 hover:bg-green-50"
                onClick={() => {
                  setImportFileList([]);
                  setImportResult(null);
                  setImportModalVisible(true);
                }}
              >
                Nhập Excel
              </Button>
            )}

            <Button
              type="primary"
              icon={<DownloadOutlined />}
              className="bg-green-600 hover:bg-green-700 border-green-600"
              onClick={handleExportExcel}
              loading={exporting}
            >
              Xuất Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* Thẻ thống kê KPI */}
      <Row gutter={[12, 12]} className="mb-4">
        <Col xs={12} sm={8} lg={4}>
          <Card bordered={false} className="shadow-sm bg-blue-50 border border-blue-200">
            <Statistic
              title={<span className="text-blue-900 font-semibold text-xs sm:text-sm">Tổng đăng ký</span>}
              value={stats?.totalRegistrations || 0}
              valueStyle={{ color: "#1e40af", fontWeight: "bold" }}
              prefix={<ReadOutlined />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={8} lg={4}>
          <Card bordered={false} className="shadow-sm bg-green-50 border border-green-200">
            <Statistic
              title={<span className="text-green-900 font-semibold text-xs sm:text-sm">Đã phê duyệt</span>}
              value={stats?.approvedCount || 0}
              valueStyle={{ color: "#15803d", fontWeight: "bold" }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={8} lg={4}>
          <Card bordered={false} className="shadow-sm bg-amber-50 border border-amber-200">
            <Statistic
              title={<span className="text-amber-900 font-semibold text-xs sm:text-sm">Chờ phê duyệt</span>}
              value={stats?.pendingCount || 0}
              valueStyle={{ color: "#b45309", fontWeight: "bold" }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={8} lg={4}>
          <Card bordered={false} className="shadow-sm bg-purple-50 border border-purple-200">
            <Statistic
              title={<span className="text-purple-900 font-semibold text-xs sm:text-sm">Đã hoàn thành</span>}
              value={stats?.attendedCount || 0}
              valueStyle={{ color: "#7e22ce", fontWeight: "bold" }}
              prefix={<SafetyCertificateOutlined />}
              suffix={
                <span className="text-xs text-purple-700 font-normal">
                  ({stats?.completionRate || 0}%)
                </span>
              }
            />
          </Card>
        </Col>

        <Col xs={12} sm={12} lg={4}>
          <Card bordered={false} className="shadow-sm bg-indigo-50 border border-indigo-200">
            <Statistic
              title={<span className="text-indigo-900 font-semibold text-xs sm:text-sm">Kinh phí dự kiến</span>}
              value={(stats?.totalEstimatedCost || 0) / 1000000}
              precision={1}
              valueStyle={{ color: "#3730a3", fontWeight: "bold" }}
              prefix={<DollarOutlined />}
              suffix={<span className="text-xs text-indigo-700 font-normal">Tr.đ</span>}
            />
          </Card>
        </Col>

        <Col xs={12} sm={12} lg={4}>
          <Card bordered={false} className="shadow-sm bg-teal-50 border border-teal-200">
            <Statistic
              title={<span className="text-teal-900 font-semibold text-xs sm:text-sm">Kinh phí hỗ trợ</span>}
              value={(stats?.totalActualFund || 0) / 1000000}
              precision={1}
              valueStyle={{ color: "#0f766e", fontWeight: "bold" }}
              prefix={<TrophyOutlined />}
              suffix={<span className="text-xs text-teal-700 font-normal">Tr.đ</span>}
            />
          </Card>
        </Col>
      </Row>

      {/* Biểu đồ phân tích */}
      <Row gutter={[12, 12]} className="mb-4">
        <Col xs={24} lg={8}>
          <Card
            title={
              <span className="font-semibold text-sm sm:text-base text-gray-800">
                Phân loại theo hình thức đào tạo
              </span>
            }
            className="shadow-sm h-full"
          >
            {formChartData.length > 0 && formChartData.some((d) => d.value > 0) ? (
              <div className="h-64 flex flex-col justify-center items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={formChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {formChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(val) => [`${val} lượt`, "Số lượng"]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs">
                  {formChartData.map((item, idx) => (
                    <div key={item.name} className="flex items-center gap-1">
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                      />
                      <span>
                        {item.name}: <b>{item.value}</b>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">
                Chưa có dữ liệu thống kê
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card
            title={
              <span className="font-semibold text-sm sm:text-base text-gray-800">
                Top đơn vị có lượt đăng ký nhiều nhất
              </span>
            }
            className="shadow-sm h-full"
          >
            {deptChartData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={deptChartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip
                      formatter={(val, name) => {
                        const labels = {
                          tong: "Tổng đăng ký",
                          daDuyet: "Đã phê duyệt",
                          daHoc: "Đã hoàn thành",
                        };
                        return [`${val} lượt`, labels[name] || name];
                      }}
                      labelFormatter={(label, payload) =>
                        payload?.[0]?.payload?.fullName || label
                      }
                    />
                    <Legend
                      verticalAlign="top"
                      wrapperStyle={{ paddingBottom: "10px" }}
                      formatter={(val) => {
                        const labels = {
                          tong: "Tổng đăng ký",
                          daDuyet: "Đã phê duyệt",
                          daHoc: "Đã hoàn thành",
                        };
                        return labels[val] || val;
                      }}
                    />
                    <Bar dataKey="tong" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="daDuyet" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="daHoc" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">
                Chưa có dữ liệu thống kê đơn vị
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Thanh bộ lọc dữ liệu bảng */}
      <Card className="mb-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-32">
            <Text className="text-xs text-gray-500 block mb-1">Năm đào tạo</Text>
            <Select
              className="w-full"
              value={filterYear}
              onChange={setFilterYear}
              placeholder="Chọn năm"
            >
              <Option value="">Tất cả các năm</Option>
              {YEAR_OPTIONS.map((y) => (
                <Option key={y} value={y}>
                  Năm {y}
                </Option>
              ))}
            </Select>
          </div>

          {!isChuyenVien && (
            <div className="w-48 sm:w-56">
              <Text className="text-xs text-gray-500 block mb-1">Đơn vị / Khoa / Phòng</Text>
              {isCapTruong || isCapPho ? (
                <div className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 truncate font-semibold h-[32px] flex items-center">
                  <span>{currentUserData?.department?.departmentName || "Đơn vị của tôi"}</span>
                </div>
              ) : (
                <Select
                  className="w-full"
                  value={filterDept}
                  onChange={setFilterDept}
                  placeholder="Tất cả đơn vị"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                >
                  <Option value="">Tất cả đơn vị</Option>
                  {departments.map((d) => (
                    <Option key={d._id} value={d._id}>
                      {d.departmentName}
                    </Option>
                  ))}
                </Select>
              )}
            </div>
          )}

          <div className="w-36">
            <Text className="text-xs text-gray-500 block mb-1">Hình thức</Text>
            <Select
              className="w-full"
              value={filterForm}
              onChange={setFilterForm}
              placeholder="Tất cả hình thức"
              allowClear
            >
              <Option value="">Tất cả</Option>
              {TRAINING_FORMS.map((f) => (
                <Option key={f} value={f}>
                  {f}
                </Option>
              ))}
            </Select>
          </div>

          <div className="w-36">
            <Text className="text-xs text-gray-500 block mb-1">Xét duyệt</Text>
            <Select
              className="w-full"
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="Trạng thái duyệt"
              allowClear
            >
              <Option value="">Tất cả trạng thái</Option>
              <Option value="PENDING">Chờ duyệt</Option>
              <Option value="APPROVED">Đã duyệt</Option>
              <Option value="REJECTED">Từ chối</Option>
            </Select>
          </div>

          <div className="w-36">
            <Text className="text-xs text-gray-500 block mb-1">Báo cáo</Text>
            <Select
              className="w-full"
              value={filterReported}
              onChange={setFilterReported}
              placeholder="Kết quả"
              allowClear
            >
              <Option value="">Tất cả</Option>
              <Option value="REPORTED">Đã báo cáo</Option>
              <Option value="ATTENDED">Đã học</Option>
              <Option value="NOT_ATTENDED">Không tham gia</Option>
              <Option value="NOT_REPORTED">Chưa báo cáo</Option>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <Text className="text-xs text-gray-500 block mb-1">Tìm kiếm</Text>
            <Input.Search
              placeholder="Tìm theo họ tên, nội dung, nơi đào tạo..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={() => fetchRegistrations(1, pagination.pageSize)}
              allowClear
            />
          </div>

          <div className="self-end pt-5">
            <Button icon={<UndoOutlined />} onClick={handleResetFilters}>
              Đặt lại
            </Button>
          </div>
        </div>
      </Card>

      {/* Bảng dữ liệu danh sách */}
      <Card className="shadow-sm">
        <Table
          columns={columns}
          dataSource={registrations}
          rowKey="_id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showLessItems: true,
            responsive: true,
            pageSizeOptions: ["10", "20", "50", "100"],
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} trong tổng số ${total} hồ sơ`,
          }}
          onChange={handleTableChange}
          scroll={{ x: isMobile ? 800 : 1300 }}
          size="middle"
        />
      </Card>

      {/* Drawer Chi tiết hồ sơ */}
      <Drawer
        title={
          <div className="flex items-center gap-2 text-blue-700">
            <ReadOutlined /> Chi tiết hồ sơ học tập bồi dưỡng
          </div>
        }
        placement="right"
        width={isMobile ? "100%" : 650}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
      >
        {selectedRecord && (
          <div className="space-y-4">
            {/* Thông tin nhân sự */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-base font-bold text-blue-900">
                {selectedRecord.userName || selectedRecord.user?.name || "Chưa có tên"}
              </div>
              <div className="text-xs text-gray-600">
                Email: {selectedRecord.user?.email || "—"}
              </div>
              <div className="text-xs text-gray-600">
                SĐT: {selectedRecord.user?.mobile || selectedRecord.user?.phone || selectedRecord.user?.phoneNumber || "—"}
              </div>
              <div className="text-xs text-gray-600">
                Đơn vị:{" "}
                <b className="text-gray-800">
                  {selectedRecord.departmentName || selectedRecord.department?.departmentName || selectedRecord.user?.department?.departmentName || "—"}
                </b>
              </div>
              <div className="text-xs text-gray-600">
                Chức danh:{" "}
                <b className="text-gray-800">
                  {selectedRecord.positionName || selectedRecord.position?.positionName || selectedRecord.user?.position?.positionName || "—"}
                </b>
              </div>
            </div>

            {/* Chi tiết khóa bồi dưỡng */}
            <div>
              <Title level={5} className="!text-sm text-gray-800 border-b pb-1">
                Nội dung chương trình đào tạo
              </Title>
              <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm mt-2">
                <div>
                  <span className="text-gray-500">Năm thực hiện:</span>{" "}
                  <b className="text-blue-700">{selectedRecord.year}</b>
                </div>
                <div>
                  <span className="text-gray-500">Hình thức:</span>{" "}
                  <Tag color="cyan">{selectedRecord.trainingForm}</Tag>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Nội dung đào tạo:</span>
                  <div className="font-semibold text-gray-900 mt-1">
                    {selectedRecord.trainingContent}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Nơi đào tạo:</span>{" "}
                  <b className="text-gray-800">{selectedRecord.trainingLocation || "—"}</b>
                </div>
                <div>
                  <span className="text-gray-500">Thời gian:</span>{" "}
                  <span className="text-gray-800">{selectedRecord.trainingDuration || "—"}</span>
                </div>
                <div>
                  <span className="text-gray-500">Kinh phí dự kiến:</span>{" "}
                  <b className="text-blue-700">
                    {selectedRecord.estimatedCost
                      ? Number(selectedRecord.estimatedCost).toLocaleString("vi-VN") + " đ"
                      : "0 đ"}
                  </b>
                </div>
                {selectedRecord.notes && (
                  <div className="col-span-2">
                    <span className="text-gray-500">Ghi chú:</span>{" "}
                    <span className="text-gray-800 italic">{selectedRecord.notes}</span>
                  </div>
                )}
              </div>
            </div>

            <Divider className="!my-2" />

            {/* Trạng thái duyệt */}
            <div>
              <Title level={5} className="!text-sm text-gray-800 border-b pb-1">
                Thông tin nhân sự quản lý phê duyệt
              </Title>
              <div className="mt-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-gray-500">Trạng thái:</span>
                  {selectedRecord.status === "APPROVED" && (
                    <Tag color="success" icon={<CheckCircleOutlined />}>
                      Đã duyệt
                    </Tag>
                  )}
                  {selectedRecord.status === "REJECTED" && (
                    <Tag color="error" icon={<CloseCircleOutlined />}>
                      Từ chối
                    </Tag>
                  )}
                  {selectedRecord.status === "PENDING" && (
                    <Tag color="warning" icon={<ClockCircleOutlined />}>
                      Chờ duyệt
                    </Tag>
                  )}
                </div>

                {selectedRecord.managerReview && (
                  <div className="p-2 bg-gray-50 rounded border text-xs space-y-1">
                    <div>
                      Người duyệt:{" "}
                      <b>{selectedRecord.managerReview.reviewedByName || selectedRecord.managerReview.reviewedBy?.name || "Quản lý"}</b>
                    </div>
                    <div>
                      Thời gian:{" "}
                      {selectedRecord.managerReview.reviewedAt
                        ? dayjs(selectedRecord.managerReview.reviewedAt).format(
                            "DD/MM/YYYY HH:mm"
                          )
                        : "—"}
                    </div>
                    {selectedRecord.managerReview.comment && (
                      <div>
                        Ý kiến duyệt:{" "}
                        <span className="italic">{selectedRecord.managerReview.comment}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Divider className="!my-2" />

            {/* Báo cáo kết quả */}
            <div>
              <Title level={5} className="!text-sm text-gray-800 border-b pb-1">
                Báo cáo kết quả sau khóa học
              </Title>
              {selectedRecord.reportResult?.status === "REPORTED" ? (
                <div className="mt-2 text-xs sm:text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Tình trạng học tập:</span>
                    {selectedRecord.reportResult.attended ? (
                      <Tag color="green">Đã tham gia học và hoàn thành</Tag>
                    ) : (
                      <Tag color="volcano">Không tham gia</Tag>
                    )}
                  </div>

                  {!selectedRecord.reportResult.attended && (
                    <Alert
                      type="warning"
                      message="Lý do không tham gia:"
                      description={selectedRecord.reportResult.notAttendedReason || "Không nêu rõ"}
                      showIcon
                    />
                  )}

                  {selectedRecord.reportResult.attended && (
                    <>
                      {selectedRecord.reportResult.resultDetails && (
                        <div>
                          <span className="text-gray-500 block mb-1">Kết quả đạt được:</span>
                          <div className="p-2 bg-gray-50 rounded border text-gray-800">
                            {selectedRecord.reportResult.resultDetails}
                          </div>
                        </div>
                      )}

                      {(selectedRecord.reportResult.certificateNumber ||
                        selectedRecord.reportResult.issueDate ||
                        selectedRecord.reportResult.issuePlace ||
                        selectedRecord.reportResult.actualTrainingDuration) && (
                        <div className="p-2.5 rounded bg-white border border-emerald-200 space-y-1.5 text-xs">
                          <div className="font-bold text-emerald-900 flex items-center gap-1">
                            <BookOutlined className="text-emerald-700" />
                            Thông tin Chứng chỉ / Văn bằng:
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                            <div>
                              <span className="text-slate-500">Số hiệu CC/VB: </span>
                              <b className="text-slate-800">{selectedRecord.reportResult.certificateNumber || "—"}</b>
                            </div>
                            <div>
                              <span className="text-slate-500">Ngày cấp: </span>
                              <b className="text-slate-800">
                                {selectedRecord.reportResult.issueDate
                                  ? dayjs(selectedRecord.reportResult.issueDate).format("DD/MM/YYYY")
                                  : "—"}
                              </b>
                            </div>
                            <div>
                              <span className="text-slate-500">Nơi cấp: </span>
                              <b className="text-slate-800">{selectedRecord.reportResult.issuePlace || "—"}</b>
                            </div>
                            <div>
                              <span className="text-slate-500">Thời gian đào tạo: </span>
                              <b className="text-slate-800">{selectedRecord.reportResult.actualTrainingDuration || "—"}</b>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between p-2 bg-emerald-50 rounded border border-emerald-200">
                        <span>Hỗ trợ kinh phí thực tế:</span>
                        <b className="text-emerald-700">
                          {selectedRecord.reportResult.hasFundingSupport
                            ? `${Number(
                                selectedRecord.reportResult.actualFundAmount || 0
                              ).toLocaleString("vi-VN")} đ`
                            : "Không hỗ trợ"}
                        </b>
                      </div>

                      {/* Minh chứng */}
                      <div>
                        <span className="text-gray-500 block mb-1">Tệp minh chứng đã nộp:</span>
                        {selectedRecord.reportResult.proofFiles &&
                        selectedRecord.reportResult.proofFiles.length > 0 ? (
                          <div className="space-y-1">
                            {selectedRecord.reportResult.proofFiles.map((file, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2 bg-gray-50 rounded border text-xs"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <PaperClipOutlined className="text-blue-500" />
                                  <span className="truncate">{formatProofFileName(file, selectedRecord, idx)}</span>
                                  {file.size && (
                                    <span className="text-gray-400">({file.size})</span>
                                  )}
                                </div>
                                <a
                                  href={file.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline font-semibold"
                                >
                                  Xem file
                                </a>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">
                            Chưa có tệp minh chứng
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  <div className="text-xs text-gray-400">
                    Báo cáo lúc:{" "}
                    {selectedRecord.reportResult.reportedAt
                      ? dayjs(selectedRecord.reportResult.reportedAt).format(
                          "DD/MM/YYYY HH:mm"
                        )
                      : "—"}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500 italic mt-2">
                  Cán bộ chưa thực hiện báo cáo kết quả bồi dưỡng.
                </div>
              )}
            </div>

            {/* Lịch sử thao tác */}
            {selectedRecord.history && selectedRecord.history.length > 0 && (
              <>
                <Divider className="!my-2" />
                <div>
                  <Title level={5} className="!text-sm text-gray-800 border-b pb-1">
                    Lịch sử cập nhật
                  </Title>
                  <Timeline
                    className="mt-3"
                    items={selectedRecord.history.map((h) => ({
                      children: (
                        <div className="text-xs">
                          <span className="font-semibold text-gray-800">{h.action}</span>
                          <span className="text-gray-500 ml-2">
                            ({dayjs(h.timestamp).format("DD/MM/YYYY HH:mm")})
                          </span>
                          {h.note && <div className="text-gray-600">{h.note}</div>}
                        </div>
                      ),
                    }))}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>

      {/* Modal Nhập dữ liệu từ Excel */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-green-700 font-bold">
            <FileExcelOutlined /> Nhập danh sách bồi dưỡng từ Excel
          </div>
        }
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={650}
      >
        <div className="space-y-4">
          <Alert
            type="info"
            showIcon
            message="Hướng dẫn thực hiện Import"
            description={
              <ul className="list-disc pl-4 text-xs space-y-1">
                <li>
                  Vui lòng tải <b>File mẫu chuẩn</b> để đảm bảo cấu trúc cột và định dạng hợp lệ.
                </li>
                <li>
                  File mẫu gồm 2 sheet: <b>Mau_Dang_Ky</b> để nhập liệu và <b>Huong_Dan_DanhMuc</b> chứa danh sách Phòng ban, Chức vụ và Email nhân sự để tham chiếu.
                </li>
                <li>
                  Các cột có dấu (*) là bắt buộc: <i>Email/Mã nhân sự, Đơn vị, Năm đào tạo, Nội dung, Hình thức, Nơi đào tạo</i>.
                </li>
              </ul>
            }
          />

          <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div>
              <div className="font-semibold text-blue-900 text-xs sm:text-sm">
                File mẫu đăng ký kèm danh mục tham chiếu
              </div>
              <div className="text-xs text-gray-500">
                Tự động đồng bộ danh sách đơn vị, chức danh hiện hành
              </div>
            </div>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownloadTemplate}
              loading={downloadingTemplate}
              className="bg-blue-600"
            >
              Tải file mẫu
            </Button>
          </div>

          <Dragger
            accept=".xlsx, .xls"
            maxCount={1}
            fileList={importFileList}
            beforeUpload={(file) => {
              setImportFileList([file]);
              return false; // Chặn tự upload
            }}
            onRemove={() => {
              setImportFileList([]);
              setImportResult(null);
            }}
          >
            <p className="ant-upload-drag-icon text-green-600">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text font-semibold text-gray-700">
              Nhấp hoặc kéo thả file Excel (.xlsx, .xls) vào đây
            </p>
            <p className="ant-upload-hint text-xs text-gray-500">
              Hỗ trợ file Excel từ Microsoft Excel 2007 trở lên
            </p>
          </Dragger>

          {importResult && (
            <div className="mt-3">
              <Alert
                type={importResult.success ? "success" : "error"}
                showIcon
                message={importResult.message}
                description={
                  <div>
                    {importResult.createdCount !== undefined && (
                      <div className="text-xs font-semibold">
                        Đã nhập thành công: {importResult.createdCount} hồ sơ
                      </div>
                    )}
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="mt-2 text-xs">
                        <span className="font-bold text-red-600">Các dòng bị lỗi:</span>
                        <div className="max-h-32 overflow-y-auto mt-1 p-2 bg-red-50 rounded border border-red-200">
                          {importResult.errors.map((err, i) => (
                            <div key={i} className="text-red-700">
                              • Dòng {err.row}: {err.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                }
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button onClick={() => setImportModalVisible(false)}>Đóng</Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              className="bg-green-600 hover:bg-green-700 border-green-600"
              onClick={handleExecuteImport}
              loading={importing}
              disabled={importFileList.length === 0}
            >
              Tiến hành Import
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TrainingReportPage;
