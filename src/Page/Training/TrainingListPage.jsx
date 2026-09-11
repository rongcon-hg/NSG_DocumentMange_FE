import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Modal,
  Form,
  Radio,
  InputNumber,
  Upload,
  message,
  Popconfirm,
  Badge,
  Tooltip,
  Row,
  Col,
  Descriptions,
  Timeline,
  Divider,
  Switch,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileDoneOutlined,
  UploadOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  UserOutlined,
  BarChartOutlined,
  ExclamationCircleOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  getTrainingRegistrations,
  reviewTrainingRegistration,
  reportTrainingResult,
  deleteTrainingRegistration,
  uploadTrainingProofFiles,
  updateTrainingRegistration,
} from "../../api/trainingApi";
import { getDepartments } from "../../api/DepartmentAPI";
import { getUserInfo } from "../../api/auth";
import { isBghUser } from "../../utils/userClassification";
import { useNotificationContext } from "../../context/NotificationContext";

const { Option } = Select;
const { TextArea } = Input;

const TRAINING_FORMS = ["Chứng chỉ", "Chứng nhận", "Văn bằng", "Khác"];
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [
  currentYear - 1,
  currentYear,
  currentYear + 1,
  currentYear + 2,
].map((y) => y.toString());

const TrainingListPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userId, userRole, refetchNotificationCounts } = useNotificationContext();

  const [currentUserData, setCurrentUserData] = useState(null);

  const isManagerOrAdmin =
    userRole === "admin" ||
    userRole === "manager" ||
    currentUserData?.role === "admin" ||
    currentUserData?.role === "manager";

  const isBgh =
    isBghUser(currentUserData) ||
    (currentUserData?.department?.departmentCode || "").toUpperCase() === "BGH";

  const isCapTruong =
    !isBgh &&
    !isManagerOrAdmin &&
    (currentUserData?.role === "staff" ||
      currentUserData?.role === "captruong" ||
      (currentUserData?.position?.positionName || "").toLowerCase().includes("trưởng"));

  const isCapPho =
    !isBgh &&
    !isManagerOrAdmin &&
    !isCapTruong &&
    (currentUserData?.role === "cappho" ||
      (currentUserData?.position?.positionName || "").toLowerCase().includes("phó"));

  const isChuyenVien = !isBgh && !isManagerOrAdmin && !isCapTruong && !isCapPho;

  const isAdmin = isManagerOrAdmin;

  // Data & loading states
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [departments, setDepartments] = useState([]);

  // Filters
  const [filterYear, setFilterYear] = useState(searchParams.get("year") || "");
  const [filterDept, setFilterDept] = useState(searchParams.get("department") || "");
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "");
  const [filterForm, setFilterForm] = useState(searchParams.get("trainingForm") || "");
  const [filterReportStatus, setFilterReportStatus] = useState(searchParams.get("reportStatus") || "");
  const [searchText, setSearchText] = useState(searchParams.get("search") || "");
  const [pagination, setPagination] = useState({
    current: parseInt(searchParams.get("page")) || 1,
    pageSize: 15,
  });

  // Modals
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewingRecord, setReviewingRecord] = useState(null);
  const [reviewStatus, setReviewStatus] = useState("APPROVED");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportingRecord, setReportingRecord] = useState(null);
  const [reportAttended, setReportAttended] = useState(true);
  const [reportResultDetails, setReportResultDetails] = useState("");
  const [reportNotAttendedReason, setReportNotAttendedReason] = useState("");
  const [reportHasFunding, setReportHasFunding] = useState(false);
  const [reportActualFund, setReportActualFund] = useState(0);
  const [reportProofFiles, setReportProofFiles] = useState([]);
  const [uploadingProofs, setUploadingProofs] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Edit Modal (cho PENDING)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm] = Form.useForm();
  const [editSubmitting, setEditSubmitting] = useState(false);

  // 1. Tải thông tin người dùng và danh mục phòng ban
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

  useEffect(() => {
    getDepartments()
      .then((res) => {
        const list = (
          res?.AllDepartment ||
          res?.data ||
          res?.departments ||
          (Array.isArray(res) ? res : [])
        ).filter((d) => !d.departmentName?.toLowerCase().includes("giải thể"));
        setDepartments(list);
      })
      .catch((err) => console.error("Lỗi lấy danh mục đơn vị:", err));
  }, []);

  // 2. Fetch danh sách bồi dưỡng
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
      };
      if (filterYear) params.year = filterYear;
      if (filterDept) params.department = filterDept;
      if (filterStatus) params.status = filterStatus;
      if (filterForm) params.trainingForm = filterForm;
      if (filterReportStatus) params.reportStatus = filterReportStatus;
      if (searchText.trim()) params.search = searchText.trim();

      const res = await getTrainingRegistrations(params);
      if (res && res.success) {
        setData(res.data || []);
        setTotal(res.total || 0);
      }
    } catch (err) {
      console.error("Lỗi tải danh sách bồi dưỡng:", err);
      message.error("Lỗi khi tải danh sách đăng ký bồi dưỡng.");
    } finally {
      setLoading(false);
    }
  }, [
    pagination.current,
    pagination.pageSize,
    filterYear,
    filterDept,
    filterStatus,
    filterForm,
    filterReportStatus,
    searchText,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cập nhật URL search params
  const handleFilterChange = (newFilters) => {
    const updated = {
      year: filterYear,
      department: filterDept,
      status: filterStatus,
      trainingForm: filterForm,
      reportStatus: filterReportStatus,
      search: searchText,
      page: "1",
      ...newFilters,
    };
    setSearchParams(
      Object.fromEntries(Object.entries(updated).filter(([_, v]) => Boolean(v)))
    );
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleResetFilters = () => {
    setFilterYear("");
    setFilterDept("");
    setFilterStatus("");
    setFilterForm("");
    setFilterReportStatus("");
    setSearchText("");
    setSearchParams({});
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  // 3. Xử lý Xét duyệt (Manager / Admin)
  const handleOpenReview = (record) => {
    setReviewingRecord(record);
    setReviewStatus("APPROVED");
    setReviewNote(record.managerReview?.note || "");
    setReviewModalVisible(true);
  };

  const handleSubmitReview = async () => {
    if (!reviewingRecord) return;
    setReviewSubmitting(true);
    try {
      const res = await reviewTrainingRegistration(reviewingRecord._id, {
        status: reviewStatus,
        note: reviewNote,
      });
      if (res.success) {
        message.success(`Đã ${reviewStatus === "APPROVED" ? "phê duyệt" : "từ chối"} hồ sơ thành công!`);
        setReviewModalVisible(false);
        fetchData();
        if (refetchNotificationCounts) refetchNotificationCounts();
      }
    } catch (err) {
      console.error("Lỗi review hồ sơ:", err);
      message.error(err.response?.data?.message || "Lỗi khi xét duyệt hồ sơ.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  // 4. Xử lý Báo cáo kết quả
  const handleOpenReport = (record) => {
    setReportingRecord(record);
    const existing = record.reportResult;
    setReportAttended(existing?.attended !== false);
    setReportResultDetails(existing?.resultDetails || "");
    setReportNotAttendedReason(existing?.notAttendedReason || "");
    setReportHasFunding(Boolean(existing?.hasFundingSupport));
    setReportActualFund(existing?.actualFundAmount || record.estimatedCost || 0);
    setReportProofFiles(existing?.proofFiles || []);
    setReportModalVisible(true);
  };

  // Upload file minh chứng Google Drive
  const handleUploadProof = async ({ file, onSuccess, onError }) => {
    setUploadingProofs(true);
    const formData = new FormData();
    formData.append("files", file);
    try {
      const res = await uploadTrainingProofFiles(formData);
      if (res.success && res.data && res.data.length > 0) {
        setReportProofFiles((prev) => [...prev, ...res.data]);
        message.success(`Đã tải lên tệp: ${file.name}`);
        onSuccess(res.data, file);
      } else {
        message.error("Lỗi tải tệp lên Google Drive.");
        onError(new Error("Lỗi upload"));
      }
    } catch (err) {
      console.error("Lỗi upload minh chứng:", err);
      message.error("Lỗi upload minh chứng Google Drive.");
      onError(err);
    } finally {
      setUploadingProofs(false);
    }
  };

  const handleRemoveProof = (fileId) => {
    setReportProofFiles((prev) => prev.filter((f) => f.fileId !== fileId));
  };

  const handleSubmitReport = async () => {
    if (!reportingRecord) return;
    if (!reportAttended && !reportNotAttendedReason.trim()) {
      message.error("Vui lòng nhập lý do không tham gia học.");
      return;
    }
    if (reportAttended && !reportResultDetails.trim()) {
      message.error("Vui lòng nhập kết quả học tập bồi dưỡng.");
      return;
    }

    setReportSubmitting(true);
    try {
      const payload = {
        attended: reportAttended,
        notAttendedReason: !reportAttended ? reportNotAttendedReason.trim() : "",
        resultDetails: reportAttended ? reportResultDetails.trim() : "",
        hasFundingSupport: reportAttended ? reportHasFunding : false,
        actualFundAmount: reportAttended && reportHasFunding ? reportActualFund : 0,
        proofFiles: reportAttended ? reportProofFiles : [],
      };

      const res = await reportTrainingResult(reportingRecord._id, payload);
      if (res.success) {
        message.success("Báo cáo kết quả bồi dưỡng thành công!");
        setReportModalVisible(false);
        fetchData();
        if (refetchNotificationCounts) refetchNotificationCounts();
      }
    } catch (err) {
      console.error("Lỗi gửi báo cáo kết quả:", err);
      message.error(err.response?.data?.message || "Lỗi khi gửi báo cáo kết quả.");
    } finally {
      setReportSubmitting(false);
    }
  };

  // 5. Chỉnh sửa khi PENDING
  const handleOpenEdit = (record) => {
    setEditingRecord(record);
    editForm.setFieldsValue({
      trainingContent: record.trainingContent,
      trainingForm: record.trainingForm,
      trainingLocation: record.trainingLocation,
      trainingDuration: record.trainingDuration,
      estimatedCost: record.estimatedCost,
      notes: record.notes,
      year: record.year,
    });
    setEditModalVisible(true);
  };

  const handleSubmitEdit = async () => {
    try {
      const values = await editForm.validateFields();
      setEditSubmitting(true);
      const res = await updateTrainingRegistration(editingRecord._id, values);
      if (res.success) {
        message.success("Cập nhật thông tin bồi dưỡng thành công!");
        setEditModalVisible(false);
        fetchData();
      }
    } catch (err) {
      console.error("Lỗi cập nhật bồi dưỡng:", err);
      message.error(err.response?.data?.message || "Lỗi khi cập nhật.");
    } finally {
      setEditSubmitting(false);
    }
  };

  // 6. Xóa hồ sơ
  const handleDelete = async (id) => {
    try {
      const res = await deleteTrainingRegistration(id);
      if (res.success) {
        message.success("Đã xóa hồ sơ bồi dưỡng.");
        fetchData();
      }
    } catch (err) {
      console.error("Lỗi xóa hồ sơ:", err);
      message.error(err.response?.data?.message || "Lỗi khi xóa hồ sơ.");
    }
  };

  // Cột hiển thị bảng
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
      title: "Nhân sự",
      key: "user",
      width: 220,
      render: (_, r) => (
        <div>
          <div className="font-semibold text-slate-800 text-sm">
            {r.userName || r.user?.name}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {r.positionName || r.position?.positionName || "Chức danh"}
          </div>
          <div className="text-[11px] text-blue-600 font-medium">
            {r.departmentName || r.department?.departmentName}
          </div>
        </div>
      ),
    },
    {
      title: "Khóa bồi dưỡng",
      key: "content",
      render: (_, r) => (
        <div className="space-y-1">
          <div className="font-medium text-slate-800 text-sm line-clamp-2">
            {r.trainingContent}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <Tag color="purple" className="m-0 font-medium">
              {r.trainingForm}
            </Tag>
            <Tag color="cyan" className="m-0">
              Năm {r.year}
            </Tag>
            {r.trainingLocation && (
              <span className="text-slate-600">
                • {r.trainingLocation}
              </span>
            )}
            {r.trainingDuration && (
              <span className="text-slate-500">
                ({r.trainingDuration})
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: "Kinh phí dự kiến",
      key: "cost",
      width: 140,
      align: "right",
      render: (_, r) => (
        <div className="font-semibold text-slate-800">
          {(r.estimatedCost || 0).toLocaleString("vi-VN")} đ
        </div>
      ),
    },
    {
      title: "Xét duyệt",
      key: "status",
      width: 140,
      align: "center",
      render: (_, r) => {
        if (r.status === "APPROVED") {
          return (
            <Tag color="success" className="font-semibold px-2 py-0.5 m-0">
              ✓ Đã duyệt
            </Tag>
          );
        }
        if (r.status === "REJECTED") {
          return (
            <Tag color="error" className="font-semibold px-2 py-0.5 m-0">
              ✕ Từ chối
            </Tag>
          );
        }
        return (
          <Tag color="warning" className="font-semibold px-2 py-0.5 m-0">
            ⏳ Chờ duyệt
          </Tag>
        );
      },
    },
    {
      title: "Kết quả bồi dưỡng",
      key: "reportResult",
      width: 180,
      render: (_, r) => {
        if (r.status !== "APPROVED") {
          return <span className="text-slate-400 text-xs italic">Cần duyệt trước</span>;
        }

        if (r.reportResult?.status === "REPORTED") {
          if (r.reportResult.attended === true) {
            return (
              <div className="space-y-0.5 text-xs">
                <Tag color="green" className="m-0 font-bold">
                  ✓ Đã học xong
                </Tag>
                <div className="text-slate-700 font-medium line-clamp-1 mt-1">
                  KQ: {r.reportResult.resultDetails || "Đạt"}
                </div>
                {r.reportResult.hasFundingSupport && (
                  <div className="text-emerald-700 text-[11px] font-semibold">
                    Hỗ trợ: {(r.reportResult.actualFundAmount || 0).toLocaleString("vi-VN")} đ
                  </div>
                )}
                {r.reportResult.proofFiles?.length > 0 && (
                  <div className="text-blue-600 text-[11px]">
                    <PaperClipOutlined /> {r.reportResult.proofFiles.length} minh chứng
                  </div>
                )}
              </div>
            );
          } else {
            return (
              <div className="space-y-0.5 text-xs">
                <Tag color="default" className="m-0 text-slate-500 font-medium">
                  Không tham gia học
                </Tag>
                {r.reportResult.notAttendedReason && (
                  <div className="text-slate-500 text-[11px] line-clamp-2 italic">
                    Lý do: {r.reportResult.notAttendedReason}
                  </div>
                )}
              </div>
            );
          }
        }

        return (
          <Tag color="processing" className="m-0 text-xs">
            Chưa báo cáo
          </Tag>
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 240,
      align: "center",
      fixed: "right",
      render: (_, r) => {
        const userDeptId = currentUserData?.department?._id || currentUserData?.department;
        const isRecordInDept =
          userDeptId &&
          (r.department?._id?.toString() === userDeptId.toString() ||
            r.department?.toString() === userDeptId.toString());
        const isSelf = r.user?._id === userId || r.user === userId;
        const isCreator = r.createdByUser?._id === userId || r.createdByUser === userId;

        const canReview = isAdmin && r.status === "PENDING";
        const canReport =
          r.status === "APPROVED" &&
          (isAdmin ||
            (isChuyenVien && isSelf) ||
            ((isCapTruong || isCapPho) && (isRecordInDept || isCreator || isSelf)));
        const canEdit =
          r.status === "PENDING" &&
          (isAdmin || isCreator || (isChuyenVien && isSelf));

        return (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {/* Xem chi tiết */}
            <Tooltip title="Xem chi tiết hồ sơ">
              <Button
                size="small"
                onClick={() => {
                  setSelectedRecord(r);
                  setDetailModalVisible(true);
                }}
                className="h-7 px-1.5 sm:px-2 text-xs flex items-center justify-center rounded border border-blue-200 bg-blue-50/70 text-blue-600 hover:bg-blue-100 hover:border-blue-300 font-medium"
              >
                <EyeOutlined />
                <span className="hidden sm:inline ml-1">Chi tiết</span>
              </Button>
            </Tooltip>

            {/* Xét duyệt (Manager / Admin) */}
            {canReview && (
              <Tooltip title="Xét duyệt hồ sơ bồi dưỡng">
                <Button
                  size="small"
                  type="primary"
                  onClick={() => handleOpenReview(r)}
                  className="h-7 px-1.5 sm:px-2 text-xs flex items-center justify-center rounded bg-amber-500 hover:bg-amber-600 text-white font-medium border-none shadow-xs"
                >
                  <CheckCircleOutlined />
                  <span className="hidden sm:inline ml-1">Xét duyệt</span>
                </Button>
              </Tooltip>
            )}

            {/* Báo cáo kết quả (Sau khi duyệt) */}
            {canReport && (
              <Tooltip
                title={
                  r.reportResult?.status === "REPORTED"
                    ? "Chỉnh sửa báo cáo kết quả"
                    : "Nộp báo cáo kết quả khóa học"
                }
              >
                <Button
                  size="small"
                  type="primary"
                  onClick={() => handleOpenReport(r)}
                  className={`h-7 px-1.5 sm:px-2 text-xs flex items-center justify-center rounded border-none text-white font-medium shadow-xs ${
                    r.reportResult?.status === "REPORTED"
                      ? "bg-slate-600 hover:bg-slate-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  <FileDoneOutlined />
                  <span className="hidden sm:inline ml-1">
                    {r.reportResult?.status === "REPORTED" ? "Sửa KQ" : "Báo cáo"}
                  </span>
                </Button>
              </Tooltip>
            )}

            {/* Sửa khi PENDING */}
            {canEdit && (
              <Tooltip title="Chỉnh sửa thông tin">
                <Button
                  size="small"
                  onClick={() => handleOpenEdit(r)}
                  className="h-7 px-1.5 sm:px-2 text-xs flex items-center justify-center rounded border border-amber-300 bg-amber-50/70 text-amber-700 hover:bg-amber-100 hover:border-amber-400 font-medium"
                >
                  <EditOutlined />
                  <span className="hidden sm:inline ml-1">Sửa</span>
                </Button>
              </Tooltip>
            )}

            {/* Xóa khi PENDING hoặc Admin */}
            {(canEdit || isAdmin) && (
              <Popconfirm
                title="Xóa hồ sơ bồi dưỡng này?"
                okText="Xóa"
                cancelText="Hủy"
                onConfirm={() => handleDelete(r._id)}
              >
                <Tooltip title="Xóa hồ sơ">
                  <Button
                    size="small"
                    danger
                    className="h-7 px-1.5 sm:px-2 text-xs flex items-center justify-center rounded border border-red-200 bg-red-50/70 text-red-600 hover:bg-red-100 hover:border-red-300 font-medium"
                  >
                    <DeleteOutlined />
                    <span className="hidden sm:inline ml-1">Xóa</span>
                  </Button>
                </Tooltip>
              </Popconfirm>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-800 m-0 flex items-center gap-2">
            <FileDoneOutlined className="text-blue-600" />
            Danh Sách Kế Hoạch Học Tập Bồi Dưỡng
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 m-0 mt-0.5">
            Theo dõi tiến độ xét duyệt, kế hoạch bồi dưỡng và báo cáo kết quả sau khóa học
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/training/register")}
            className="bg-blue-600 hover:bg-blue-700 font-semibold text-xs sm:text-sm h-9 flex-1 sm:flex-none"
          >
            Đăng ký mới
          </Button>

          <Button
            type="default"
            icon={<CheckCircleOutlined className="text-emerald-600" />}
            onClick={() => navigate("/training/result-report")}
            className="text-xs sm:text-sm h-9 flex-1 sm:flex-none border-emerald-300 text-emerald-700 hover:text-emerald-800 hover:border-emerald-500"
          >
            Báo cáo kết quả
          </Button>

          <Button
            icon={<BarChartOutlined />}
            onClick={() => navigate("/training/report")}
            className="text-xs sm:text-sm h-9 flex-1 sm:flex-none"
          >
            Thống kê - Báo cáo
          </Button>
        </div>
      </div>

      {/* Bộ Lọc & Tìm Kiếm Thông Minh */}
      <Card className="shadow-xs border-slate-200" bodyStyle={{ padding: "14px" }}>
        <Row gutter={[10, 10]} align="middle">
          {/* Năm */}
          <Col xs={12} sm={6} md={3}>
            <Select
              placeholder="Năm"
              value={filterYear || undefined}
              onChange={(v) => {
                setFilterYear(v);
                handleFilterChange({ year: v });
              }}
              allowClear
              className="w-full"
            >
              {YEAR_OPTIONS.map((y) => (
                <Option key={y} value={y}>
                  Năm {y}
                </Option>
              ))}
            </Select>
          </Col>

          {/* Đơn vị */}
          {!isChuyenVien && (
            <Col xs={12} sm={6} md={5}>
              {isCapTruong || isCapPho ? (
                <div className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 truncate font-semibold h-[32px] flex items-center">
                  <span>{currentUserData?.department?.departmentName || "Đơn vị của tôi"}</span>
                </div>
              ) : (
                <Select
                  placeholder="Tất cả đơn vị"
                  value={filterDept || undefined}
                  onChange={(v) => {
                    setFilterDept(v);
                    handleFilterChange({ department: v });
                  }}
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  className="w-full"
                >
                  {departments.map((d) => (
                    <Option key={d._id} value={d._id}>
                      {d.departmentName}
                    </Option>
                  ))}
                </Select>
              )}
            </Col>
          )}

          {/* Trạng thái xét duyệt */}
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Trạng thái duyệt"
              value={filterStatus || undefined}
              onChange={(v) => {
                setFilterStatus(v);
                handleFilterChange({ status: v });
              }}
              allowClear
              className="w-full"
            >
              <Option value="PENDING">Chờ duyệt</Option>
              <Option value="APPROVED">Đã phê duyệt</Option>
              <Option value="REJECTED">Từ chối</Option>
            </Select>
          </Col>

          {/* Hình thức */}
          <Col xs={12} sm={6} md={3}>
            <Select
              placeholder="Hình thức"
              value={filterForm || undefined}
              onChange={(v) => {
                setFilterForm(v);
                handleFilterChange({ trainingForm: v });
              }}
              allowClear
              className="w-full"
            >
              {TRAINING_FORMS.map((f) => (
                <Option key={f} value={f}>
                  {f}
                </Option>
              ))}
            </Select>
          </Col>

          {/* Tình trạng báo cáo */}
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="Tình trạng báo cáo"
              value={filterReportStatus || undefined}
              onChange={(v) => {
                setFilterReportStatus(v);
                handleFilterChange({ reportStatus: v });
              }}
              allowClear
              className="w-full"
            >
              <Option value="REPORTED">Đã nộp báo cáo</Option>
              <Option value="NOT_REPORTED">Chưa nộp báo cáo</Option>
            </Select>
          </Col>

          {/* Tìm kiếm từ khóa */}
          <Col xs={24} sm={12} md={5}>
            <Input.Search
              placeholder="Tìm tên, nội dung, nơi học..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={(v) => handleFilterChange({ search: v })}
              allowClear
              className="w-full"
            />
          </Col>
        </Row>
      </Card>

      {/* Bảng danh sách dữ liệu */}
      <Card className="shadow-xs border-slate-200" bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="_id"
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: total,
            showTotal: (tot) => `Tổng số: ${tot} hồ sơ`,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "20", "50"],
            onChange: (page, pageSize) => {
              setPagination({ current: page, pageSize });
              setSearchParams((prev) => {
                const p = Object.fromEntries(prev.entries());
                p.page = page.toString();
                return p;
              });
            },
          }}
        />
      </Card>

      {/* MODAL 1: XEM CHI TIẾT HỒ SƠ */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-800">
            <FileTextOutlined className="text-blue-600" />
            Chi Tiết Hồ Sơ Bồi Dưỡng
          </div>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>,
        ]}
        width={750}
      >
        {selectedRecord && (
          <div className="space-y-4 pt-2">
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Nhân sự">
                <b>{selectedRecord.userName}</b>
              </Descriptions.Item>
              <Descriptions.Item label="Chức danh">
                {selectedRecord.positionName || "Chưa có"}
              </Descriptions.Item>
              <Descriptions.Item label="Đơn vị">
                {selectedRecord.departmentName}
              </Descriptions.Item>
              <Descriptions.Item label="Năm đào tạo">
                Năm {selectedRecord.year}
              </Descriptions.Item>
              <Descriptions.Item label="Nội dung bồi dưỡng" span={2}>
                <span className="font-semibold text-blue-900">
                  {selectedRecord.trainingContent}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Hình thức">
                <Tag color="purple">{selectedRecord.trainingForm}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Nơi đào tạo">
                {selectedRecord.trainingLocation || "Chưa xác định"}
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian">
                {selectedRecord.trainingDuration || "Theo kế hoạch"}
              </Descriptions.Item>
              <Descriptions.Item label="Kinh phí dự kiến">
                <span className="font-bold text-emerald-600">
                  {(selectedRecord.estimatedCost || 0).toLocaleString("vi-VN")} đ
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái duyệt">
                {selectedRecord.status === "APPROVED" ? (
                  <Tag color="success">Đã phê duyệt</Tag>
                ) : selectedRecord.status === "REJECTED" ? (
                  <Tag color="error">Từ chối</Tag>
                ) : (
                  <Tag color="warning">Chờ duyệt</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Người lập hồ sơ">
                {selectedRecord.createdByUserName || selectedRecord.createdByUser?.name || "Cấp trưởng"}
              </Descriptions.Item>
              {selectedRecord.notes && (
                <Descriptions.Item label="Ghi chú" span={2}>
                  {selectedRecord.notes}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Thông tin xét duyệt của Manager */}
            {selectedRecord.managerReview?.reviewedAt && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-slate-700">
                  Thông tin xét duyệt của Quản lý:
                </div>
                <div>
                  Người duyệt: <b>{selectedRecord.managerReview.reviewedByName}</b> lúc{" "}
                  {dayjs(selectedRecord.managerReview.reviewedAt).format("DD/MM/YYYY HH:mm")}
                </div>
                {selectedRecord.managerReview.note && (
                  <div>Ý kiến chỉ đạo: <i>"{selectedRecord.managerReview.note}"</i></div>
                )}
              </div>
            )}

            {/* Thông tin Báo cáo kết quả bồi dưỡng */}
            <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/40 space-y-2">
              <div className="font-bold text-emerald-800 text-sm flex items-center gap-1.5">
                <CheckCircleOutlined /> Kết Quả Báo Cáo Sau Bồi Dưỡng
              </div>

              {selectedRecord.reportResult?.status === "REPORTED" ? (
                <div className="text-xs space-y-1.5 text-slate-700">
                  <div>
                    Tình trạng:{" "}
                    <b>
                      {selectedRecord.reportResult.attended === true
                        ? "Đã tham gia học hoàn tất"
                        : "Không tham gia học"}
                    </b>
                  </div>
                  {selectedRecord.reportResult.attended === true ? (
                    <>
                      <div>
                        Kết quả đạt được: <b>{selectedRecord.reportResult.resultDetails}</b>
                      </div>
                      <div>
                        Hỗ trợ kinh phí:{" "}
                        {selectedRecord.reportResult.hasFundingSupport ? (
                          <span className="font-bold text-emerald-700">
                            Có hỗ trợ (
                            {(
                              selectedRecord.reportResult.actualFundAmount || 0
                            ).toLocaleString("vi-VN")}{" "}
                            đ)
                          </span>
                        ) : (
                          "Không hỗ trợ"
                        )}
                      </div>
                      {selectedRecord.reportResult.proofFiles?.length > 0 && (
                        <div>
                          <div className="font-semibold mt-1">Minh chứng đính kèm:</div>
                          <div className="flex flex-col gap-1 mt-1">
                            {selectedRecord.reportResult.proofFiles.map((file, idx) => (
                              <a
                                key={file.fileId || idx}
                                href={file.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline inline-flex items-center gap-1"
                              >
                                <PaperClipOutlined /> {file.fileName}{" "}
                                {file.size ? `(${file.size})` : ""}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      Lý do không học:{" "}
                      <span className="text-red-600 italic">
                        {selectedRecord.reportResult.notAttendedReason}
                      </span>
                    </div>
                  )}
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-emerald-200">
                    Báo cáo bởi: {selectedRecord.reportResult.reportedByName} lúc{" "}
                    {dayjs(selectedRecord.reportResult.reportedAt).format(
                      "DD/MM/YYYY HH:mm"
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic">
                  Chưa thực hiện báo cáo kết quả bồi dưỡng.
                </div>
              )}
            </div>

            {/* Lịch sử tiến trình */}
            {selectedRecord.history?.length > 0 && (
              <div className="pt-2">
                <div className="font-semibold text-xs text-slate-600 mb-2">
                  Lịch sử tiến trình hồ sơ:
                </div>
                <Timeline
                  items={selectedRecord.history.map((h) => ({
                    children: (
                      <div className="text-xs">
                        <span className="font-medium text-slate-800">{h.action}</span> -{" "}
                        <span className="text-slate-500">{h.actorName}</span> (
                        {dayjs(h.timestamp).format("DD/MM/YYYY HH:mm")})
                        {h.details && (
                          <div className="text-slate-600 italic mt-0.5">{h.details}</div>
                        )}
                      </div>
                    ),
                  }))}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* MODAL 2: XÉT DUYỆT HỒ SƠ (MANAGER) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-800">
            <CheckCircleOutlined className="text-amber-600" />
            Xét Duyệt Kế Hoạch Bồi Dưỡng
          </div>
        }
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        onOk={handleSubmitReview}
        confirmLoading={reviewSubmitting}
        okText="Xác nhận xét duyệt"
        cancelText="Hủy"
        width={550}
      >
        {reviewingRecord && (
          <div className="space-y-3 pt-2">
            <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100 text-xs space-y-1">
              <div>
                Nhân sự: <b>{reviewingRecord.userName}</b> - {reviewingRecord.departmentName}
              </div>
              <div>
                Khóa bồi dưỡng: <b>{reviewingRecord.trainingContent}</b> ({reviewingRecord.trainingForm})
              </div>
              <div>
                Kinh phí đề xuất:{" "}
                <b className="text-emerald-700">
                  {(reviewingRecord.estimatedCost || 0).toLocaleString("vi-VN")} đ
                </b>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Quyết định xét duyệt:
              </label>
              <Radio.Group
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value)}
                className="w-full"
              >
                <Radio.Button
                  value="APPROVED"
                  className="w-1/2 text-center text-emerald-600 font-semibold"
                >
                  ✓ Phê duyệt
                </Radio.Button>
                <Radio.Button
                  value="REJECTED"
                  className="w-1/2 text-center text-red-600 font-semibold"
                >
                  ✕ Từ chối
                </Radio.Button>
              </Radio.Group>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Ý kiến chỉ đạo / Ghi chú lý do:
              </label>
              <TextArea
                rows={3}
                placeholder="Nhập ghi chú phê duyệt hoặc lý do từ chối..."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: BÁO CÁO KẾT QUẢ BỒI DƯỠNG (KÈM MINH CHỨNG & KINH PHÍ) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-emerald-800">
            <FileDoneOutlined className="text-emerald-600" />
            Báo Cáo Kết Quả Học Tập Bồi Dưỡng
          </div>
        }
        open={reportModalVisible}
        onCancel={() => setReportModalVisible(false)}
        onOk={handleSubmitReport}
        confirmLoading={reportSubmitting}
        okText="Nộp báo cáo kết quả"
        cancelText="Hủy"
        width={650}
      >
        {reportingRecord && (
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div>
                Khóa bồi dưỡng: <b>{reportingRecord.trainingContent}</b>
              </div>
              <div>
                Nhân sự: <b>{reportingRecord.userName}</b> ({reportingRecord.departmentName})
              </div>
            </div>

            {/* 1. Tình trạng tham gia học */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Tình trạng tham gia học tập:
              </label>
              <Radio.Group
                value={reportAttended}
                onChange={(e) => setReportAttended(e.target.value)}
                className="w-full"
              >
                <Radio.Button
                  value={true}
                  className="w-1/2 text-center text-emerald-700 font-semibold"
                >
                  ✓ Đã tham gia học xong
                </Radio.Button>
                <Radio.Button
                  value={false}
                  className="w-1/2 text-center text-red-600 font-semibold"
                >
                  ✕ Không tham gia học
                </Radio.Button>
              </Radio.Group>
            </div>

            {/* Trường hợp KHÔNG HỌC */}
            {!reportAttended ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-red-600 block">
                  Lý do không tham gia học <span className="text-red-500">*</span>:
                </label>
                <TextArea
                  rows={4}
                  placeholder="Nêu rõ lý do không thể tham gia khóa bồi dưỡng này (bận công tác, lý do cá nhân, dời lịch...)"
                  value={reportNotAttendedReason}
                  onChange={(e) => setReportNotAttendedReason(e.target.value)}
                />
              </div>
            ) : (
              /* Trường hợp CÓ HỌC */
              <div className="space-y-3">
                {/* Kết quả xếp loại / đạt */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Kết quả học tập bồi dưỡng <span className="text-red-500">*</span>:
                  </label>
                  <Input
                    placeholder="Ví dụ: Đạt, Xuất sắc, Giỏi, Khá, Điểm số, Số hiệu chứng chỉ/văn bằng..."
                    value={reportResultDetails}
                    onChange={(e) => setReportResultDetails(e.target.value)}
                  />
                </div>

                {/* Hỗ trợ kinh phí */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Xác nhận có hỗ trợ kinh phí từ nhà trường/đơn vị?
                    </span>
                    <Switch
                      checked={reportHasFunding}
                      onChange={setReportHasFunding}
                      checkedChildren="Có"
                      unCheckedChildren="Không"
                    />
                  </div>

                  {reportHasFunding && (
                    <div className="pt-2 border-t border-slate-200">
                      <label className="text-xs font-medium text-slate-600 mb-1 block">
                        Số tiền hỗ trợ thực tế (VNĐ):
                      </label>
                      <InputNumber
                        className="w-full"
                        value={reportActualFund}
                        min={0}
                        step={500000}
                        formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                        parser={(val) => val.replace(/\$\s?|(,*)/g, "")}
                        onChange={(val) => setReportActualFund(val || 0)}
                      />
                    </div>
                  )}
                </div>

                {/* Tải tệp minh chứng Google Drive */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Tệp minh chứng (Scan chứng chỉ, văn bằng, hóa đơn, quyết định...):
                  </label>

                  <Upload
                    customRequest={handleUploadProof}
                    showUploadList={false}
                    multiple
                  >
                    <Button
                      icon={<UploadOutlined />}
                      loading={uploadingProofs}
                      className="text-xs"
                    >
                      Tải tệp minh chứng lên Google Drive
                    </Button>
                  </Upload>

                  {/* Danh sách minh chứng đã tải lên */}
                  {reportProofFiles.length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {reportProofFiles.map((file, idx) => (
                        <div
                          key={file.fileId || idx}
                          className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white text-xs"
                        >
                          <a
                            href={file.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1.5 truncate max-w-[400px]"
                          >
                            <PaperClipOutlined /> {file.fileName}
                            {file.size && (
                              <span className="text-slate-400">({file.size})</span>
                            )}
                          </a>
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveProof(file.fileId)}
                            className="text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* MODAL 4: CHỈNH SỬA KHI PENDING */}
      <Modal
        title="Chỉnh Sửa Kế Hoạch Bồi Dưỡng"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleSubmitEdit}
        confirmLoading={editSubmitting}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        width={600}
      >
        <Form form={editForm} layout="vertical" className="pt-2">
          <Form.Item
            name="trainingContent"
            label="Nội dung bồi dưỡng"
            rules={[{ required: true, message: "Vui lòng nhập nội dung" }]}
          >
            <Input />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="trainingForm"
                label="Hình thức đào tạo"
                rules={[{ required: true }]}
              >
                <Select>
                  {TRAINING_FORMS.map((f) => (
                    <Option key={f} value={f}>
                      {f}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="year" label="Năm đào tạo" rules={[{ required: true }]}>
                <Select>
                  {YEAR_OPTIONS.map((y) => (
                    <Option key={y} value={y}>
                      Năm {y}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="trainingLocation" label="Nơi đào tạo">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="trainingDuration" label="Thời gian đào tạo">
                <Input placeholder="Ví dụ: 03 tháng, 5 ngày..." />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="estimatedCost" label="Kinh phí dự kiến (VNĐ)">
            <InputNumber
              className="w-full"
              min={0}
              step={500000}
              formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              parser={(val) => val.replace(/\$\s?|(,*)/g, "")}
            />
          </Form.Item>

          <Form.Item name="notes" label="Ghi chú">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TrainingListPage;
