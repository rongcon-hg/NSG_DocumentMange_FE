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
  DatePicker,
  AutoComplete,
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
  BookOutlined,
  HistoryOutlined,
  FileExcelOutlined,
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
  exportTrainingExcel,
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
  currentYear + 2,
  currentYear + 1,
  currentYear,
  currentYear - 1,
  currentYear - 2,
  currentYear - 3,
  currentYear - 4,
].map((y) => y.toString());

const TrainingListPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userId, userRole, refetchNotificationCounts } = useNotificationContext();

  const [currentUserData, setCurrentUserData] = useState(null);

  const isRealAdmin =
    userRole === "admin" ||
    currentUserData?.role === "admin";

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
  const [filterDateRange, setFilterDateRange] = useState(() => {
    const from = searchParams.get("fromDate");
    const to = searchParams.get("toDate");
    if (from && to && dayjs(from).isValid() && dayjs(to).isValid()) {
      return [dayjs(from), dayjs(to)];
    }
    return null;
  });
  const [exporting, setExporting] = useState(false);
  const [pagination, setPagination] = useState({
    current: parseInt(searchParams.get("page")) || 1,
    pageSize: 15,
  });

  // Nhận diện màn hình di động responsive
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
  const [reportCertificateNumber, setReportCertificateNumber] = useState("");
  const [reportIssueDate, setReportIssueDate] = useState(null);
  const [reportIssuePlace, setReportIssuePlace] = useState("");
  const [reportActualTrainingDuration, setReportActualTrainingDuration] = useState("");
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
      if (filterDateRange && filterDateRange[0]) {
        params.fromDate = filterDateRange[0].format("YYYY-MM-DD");
      }
      if (filterDateRange && filterDateRange[1]) {
        params.toDate = filterDateRange[1].format("YYYY-MM-DD");
      }

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
    filterDateRange,
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
      fromDate: filterDateRange?.[0] ? filterDateRange[0].format("YYYY-MM-DD") : "",
      toDate: filterDateRange?.[1] ? filterDateRange[1].format("YYYY-MM-DD") : "",
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
    setFilterDateRange(null);
    setSearchParams({});
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  // Xuất file Excel danh sách đăng ký bồi dưỡng
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      if (filterYear) params.year = filterYear;
      if (filterDept) params.department = filterDept;
      if (filterStatus) params.status = filterStatus;
      if (filterForm) params.trainingForm = filterForm;
      if (filterReportStatus) params.reportStatus = filterReportStatus;
      if (searchText.trim()) params.search = searchText.trim();
      if (filterDateRange && filterDateRange[0]) {
        params.fromDate = filterDateRange[0].format("YYYY-MM-DD");
      }
      if (filterDateRange && filterDateRange[1]) {
        params.toDate = filterDateRange[1].format("YYYY-MM-DD");
      }

      const res = await exportTrainingExcel(params);
      
      // Nếu BE trả về json lỗi (application/json) dưới dạng blob
      if (res.data?.type === "application/json") {
        const text = await res.data.text();
        const json = JSON.parse(text);
        throw new Error(json.message || "Lỗi máy chủ khi xuất Excel");
      }

      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Danh_Sach_Dang_Ky_Boi_Duong_${filterYear ? `Nam_${filterYear}` : "TatCa"}_${dayjs().format(
        "YYYYMMDD_HHmm"
      )}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success("Xuất file Excel danh sách bồi dưỡng thành công!");
    } catch (err) {
      console.error("Lỗi xuất Excel:", err);
      message.error(err.message || "Có lỗi xảy ra khi xuất file Excel!");
    } finally {
      setExporting(false);
    }
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
    setReportCertificateNumber(existing?.certificateNumber || "");
    setReportIssueDate(existing?.issueDate ? dayjs(existing.issueDate) : null);
    setReportIssuePlace(existing?.issuePlace || "");
    setReportActualTrainingDuration(
      existing?.actualTrainingDuration || record.trainingDuration || ""
    );
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
    if (reportAttended) {
      if (!reportResultDetails.trim()) {
        message.error("Vui lòng nhập kết quả học tập bồi dưỡng.");
        return;
      }
      if (!reportCertificateNumber.trim()) {
        message.error("Vui lòng nhập Số hiệu chứng chỉ/văn bằng.");
        return;
      }
      if (!reportIssueDate) {
        message.error("Vui lòng chọn Ngày cấp chứng chỉ/văn bằng.");
        return;
      }
      if (!reportIssuePlace.trim()) {
        message.error("Vui lòng nhập Nơi cấp chứng chỉ/văn bằng.");
        return;
      }
      if (!reportActualTrainingDuration.trim()) {
        message.error("Vui lòng nhập Thời gian đào tạo.");
        return;
      }
    }

    setReportSubmitting(true);
    try {
      const payload = {
        attended: reportAttended,
        notAttendedReason: !reportAttended ? reportNotAttendedReason.trim() : "",
        resultDetails: reportAttended ? reportResultDetails.trim() : "",
        certificateNumber: reportAttended ? reportCertificateNumber.trim() : "",
        issueDate: reportAttended && reportIssueDate ? reportIssueDate.toISOString() : null,
        issuePlace: reportAttended ? reportIssuePlace.trim() : "",
        actualTrainingDuration: reportAttended ? reportActualTrainingDuration.trim() : "",
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
                {r.reportResult.certificateNumber && (
                  <div className="text-slate-600 text-[11px] truncate">
                    Số CC/VB: <span className="font-semibold">{r.reportResult.certificateNumber}</span>
                  </div>
                )}
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
      width: isMobile ? 78 : 255,
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

        const canReview = (isManagerOrAdmin || isMaiAnhThy) && r.status === "PENDING";
        const canReport =
          r.status === "APPROVED" &&
          (isAdmin ||
            (isChuyenVien && isSelf) ||
            ((isCapTruong || isCapPho) && (isRecordInDept || isCreator || isSelf)));
        const canEdit =
          r.status === "PENDING" &&
          (isAdmin || isCreator || (isChuyenVien && isSelf));

        // Nút xóa:
        // - Hồ sơ đã được duyệt (r.status !== "PENDING"): Ẩn đối với manager, ban giám hiệu, cấp trưởng, cấp phó, chuyên viên. CHỈ admin thật mới thấy nút xóa.
        // - Hồ sơ đang chờ duyệt (r.status === "PENDING"): canEdit || isManagerOrAdmin || isRealAdmin
        const canDelete =
          r.status === "PENDING"
            ? (canEdit || isManagerOrAdmin || isRealAdmin)
            : isRealAdmin;

        return (
          <div className="flex flex-row flex-wrap sm:flex-nowrap gap-1 items-center justify-center max-w-[65px] sm:max-w-none mx-auto py-0.5">
            {/* Xem chi tiết */}
            <Tooltip title="Xem chi tiết hồ sơ">
              <Button
                size="small"
                onClick={() => {
                  setSelectedRecord(r);
                  setDetailModalVisible(true);
                }}
                className="rounded sm:h-7 sm:px-2 max-sm:!w-7 max-sm:!h-7 max-sm:!p-0 flex items-center justify-center text-xs font-medium border border-blue-200 bg-blue-50/70 text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-colors"
              >
                <EyeOutlined />
                <span className="hidden sm:inline ml-1">Chi tiết</span>
              </Button>
            </Tooltip>

            {/* Xét duyệt (Manager / Admin / Mai Anh Thy) */}
            {canReview && (
              <Tooltip title="Xét duyệt hồ sơ bồi dưỡng">
                <Button
                  size="small"
                  type="primary"
                  onClick={() => handleOpenReview(r)}
                  className="rounded sm:h-7 sm:px-2 max-sm:!w-7 max-sm:!h-7 max-sm:!p-0 flex items-center justify-center text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white border-none shadow-xs transition-colors"
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
                  className={`rounded sm:h-7 sm:px-2 max-sm:!w-7 max-sm:!h-7 max-sm:!p-0 flex items-center justify-center text-xs font-medium border-none text-white shadow-xs transition-colors ${
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
                  className="rounded sm:h-7 sm:px-1.5 max-sm:!w-7 max-sm:!h-7 max-sm:!p-0 flex items-center justify-center text-xs font-medium border border-amber-300 bg-amber-50/70 text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-colors"
                >
                  <EditOutlined />
                  <span className="hidden sm:inline ml-1">Sửa</span>
                </Button>
              </Tooltip>
            )}

            {/* Xóa: Chỉ admin được xóa hồ sơ đã duyệt; pending thì người lập/manager/admin được xóa */}
            {canDelete && (
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
                    className="rounded sm:h-7 sm:px-1.5 max-sm:!w-7 max-sm:!h-7 max-sm:!p-0 flex items-center justify-center text-xs font-medium border border-red-200 bg-red-50/70 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
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
            icon={<FileExcelOutlined className="text-emerald-600" />}
            loading={exporting}
            onClick={handleExportExcel}
            className="text-xs sm:text-sm h-9 flex-1 sm:flex-none border-emerald-500 text-emerald-700 hover:text-emerald-800 hover:border-emerald-600 bg-emerald-50/70 hover:bg-emerald-100 font-medium"
          >
            Xuất Excel
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
          {/* Năm (Nhập tự do hoặc chọn từ gợi ý) */}
          <Col xs={12} sm={6} md={3} lg={2}>
            <AutoComplete
              placeholder="Năm (tự do)"
              value={filterYear}
              options={YEAR_OPTIONS.map((y) => ({ value: y, label: `Năm ${y}` }))}
              filterOption={(inputValue, option) =>
                (option?.value || "").toLowerCase().includes((inputValue || "").toLowerCase())
              }
              onChange={(v) => {
                setFilterYear(v || "");
              }}
              onSelect={(v) => {
                setFilterYear(v);
                handleFilterChange({ year: v });
              }}
              onBlur={() => {
                handleFilterChange({ year: filterYear });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleFilterChange({ year: filterYear });
                }
              }}
              allowClear
              className="w-full"
            />
          </Col>

          {/* Đơn vị */}
          {!isChuyenVien && (
            <Col xs={12} sm={6} md={4} lg={4}>
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

          {/* Khoảng thời gian đăng ký */}
          <Col xs={24} sm={12} md={5} lg={4}>
            <DatePicker.RangePicker
              placeholder={["Từ ngày ĐK", "Đến ngày ĐK"]}
              format="DD/MM/YYYY"
              value={filterDateRange}
              onChange={(dates) => {
                setFilterDateRange(dates);
                handleFilterChange({
                  fromDate: dates && dates[0] ? dates[0].format("YYYY-MM-DD") : "",
                  toDate: dates && dates[1] ? dates[1].format("YYYY-MM-DD") : "",
                });
              }}
              allowClear
              className="w-full"
            />
          </Col>

          {/* Trạng thái xét duyệt */}
          <Col xs={12} sm={6} md={3} lg={3}>
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
          <Col xs={12} sm={6} md={3} lg={2}>
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
          <Col xs={12} sm={6} md={3} lg={3}>
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
          <Col xs={20} sm={10} md={5} lg={5}>
            <Input.Search
              placeholder="Tìm tên, nội dung, nơi học..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={(v) => handleFilterChange({ search: v })}
              allowClear
              className="w-full"
            />
          </Col>

          {/* Đặt lại bộ lọc */}
          <Col xs={4} sm={2} md={1} lg={1}>
            <Tooltip title="Đặt lại bộ lọc">
              <Button
                icon={<ReloadOutlined />}
                onClick={handleResetFilters}
                className="w-full flex items-center justify-center text-slate-500 hover:text-blue-600"
              />
            </Tooltip>
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
          scroll={{ x: isMobile ? 700 : 1150 }}
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
            <BookOutlined className="text-blue-600 text-lg" />
            Chi Tiết Kế Hoạch Bồi Dưỡng
          </div>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>,
        ]}
        width={720}
        destroyOnClose
      >
        {selectedRecord && (
          <div className="space-y-3.5 pt-2">
            {/* 1. THÔNG TIN CÁN BỘ / NHÂN SỰ */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-base text-slate-800 flex items-center gap-2">
                    <UserOutlined className="text-blue-600" />
                    {selectedRecord.userName || selectedRecord.user?.name}
                    {!selectedRecord.userId && !selectedRecord.user?._id && (
                      <Tag color="orange" className="text-[10px] font-normal m-0">
                        Chưa có tài khoản
                      </Tag>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600 mt-1">
                    Chức danh: <b>{selectedRecord.positionName || selectedRecord.position?.positionName || "Cán bộ"}</b> | Đơn vị: <b>{selectedRecord.departmentName || selectedRecord.department?.departmentName || "NSG"}</b>
                  </div>
                  {(selectedRecord.user?.email || selectedRecord.user?.mobile) && (
                    <div className="text-xs text-slate-400 mt-0.5">
                      Email: {selectedRecord.user?.email || "--"} | SĐT: {selectedRecord.user?.mobile || "Không có"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. NĂM HỌC VÀ TRẠNG THÁI PHÊ DUYỆT */}
            <div className="flex justify-between items-center p-2.5 sm:p-3 bg-blue-50/80 rounded-lg border border-blue-100">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-medium text-slate-700">Năm đào tạo:</span>
                <Tag color="blue" className="font-bold text-xs sm:text-sm m-0">
                  Năm {selectedRecord.year}
                </Tag>
                <Tag color="purple" className="font-semibold text-xs m-0">
                  {selectedRecord.trainingForm}
                </Tag>
              </div>
              <div>
                {selectedRecord.status === "APPROVED" ? (
                  <Tag color="success" className="font-bold px-2 py-0.5 m-0">
                    ✓ Đã phê duyệt
                  </Tag>
                ) : selectedRecord.status === "REJECTED" ? (
                  <Tag color="error" className="font-bold px-2 py-0.5 m-0">
                    ✕ Từ chối
                  </Tag>
                ) : (
                  <Tag color="warning" className="font-bold px-2 py-0.5 m-0">
                    ⏳ Chờ duyệt
                  </Tag>
                )}
              </div>
            </div>

            {/* 3. NỘI DUNG VÀ THÔNG TIN KHÓA HỌC */}
            <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-2.5">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Nội dung học tập bồi dưỡng:
                </span>
                <div className="font-bold text-blue-900 text-sm sm:text-base leading-relaxed">
                  {selectedRecord.trainingContent}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-100 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-500">Kinh phí dự kiến: </span>
                  <span className="font-bold text-emerald-600">
                    {(Number(selectedRecord.estimatedCost) || 0).toLocaleString("vi-VN")} đ
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Nơi đào tạo: </span>
                  <span className="font-medium text-slate-800">
                    {selectedRecord.trainingLocation || "Chưa xác định"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Thời gian dự kiến: </span>
                  <span className="font-medium text-slate-800">
                    {selectedRecord.trainingDuration || "Theo kế hoạch"}
                    {selectedRecord.startDate && selectedRecord.endDate && (
                      <span className="text-slate-500 text-xs ml-1">
                        ({dayjs(selectedRecord.startDate).format("DD/MM/YYYY")} - {dayjs(selectedRecord.endDate).format("DD/MM/YYYY")})
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Người lập hồ sơ: </span>
                  <span className="font-medium text-slate-800">
                    {selectedRecord.createdByUserName || selectedRecord.createdByUser?.name || "Cán bộ quản lý"}
                  </span>
                </div>
              </div>

              {selectedRecord.notes && (
                <div className="pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 font-semibold block mb-0.5">Ghi chú:</span>
                  <div className="p-2 bg-slate-50 rounded text-slate-700 italic whitespace-pre-wrap">
                    {selectedRecord.notes}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Ý KIẾN CHỈ ĐẠO CỦA CẤP PHÊ DUYỆT (NẾU CÓ) */}
            {selectedRecord.managerReview?.reviewedAt && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1">
                <div className="font-bold text-amber-800 flex items-center justify-between">
                  <span>Ý kiến / Chỉ đạo của cấp phê duyệt:</span>
                  <span className="text-[11px] font-normal text-amber-600">
                    {dayjs(selectedRecord.managerReview.reviewedAt).format("DD/MM/YYYY HH:mm")}
                  </span>
                </div>
                <div className="text-slate-800">
                  Người duyệt: <b>{selectedRecord.managerReview.reviewedByName}</b>
                </div>
                {selectedRecord.managerReview.note && (
                  <div className="text-slate-700 italic bg-white/70 p-2 rounded border border-amber-200/60 mt-1">
                    "{selectedRecord.managerReview.note}"
                  </div>
                )}
              </div>
            )}

            {/* 5. KẾT QUẢ BÁO CÁO SAU KHÓA HỌC */}
            <div>
              <div className="font-bold text-xs sm:text-sm text-slate-700 mb-2 flex items-center gap-1.5">
                <CheckCircleOutlined className="text-emerald-600" />
                Kết Quả Báo Cáo Sau Khóa Học:
              </div>

              {selectedRecord.reportResult?.status === "REPORTED" ? (
                <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs sm:text-sm space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-2">
                    <div>
                      <span className="text-slate-500">Tình trạng: </span>
                      {selectedRecord.reportResult.attended !== false ? (
                        <Tag color="success" className="font-bold m-0">✓ Đã tham gia hoàn thành</Tag>
                      ) : (
                        <Tag color="error" className="font-bold m-0">✗ Không tham gia học</Tag>
                      )}
                    </div>
                    {selectedRecord.reportResult.reportedByName && (
                      <span className="text-[11px] text-slate-400">
                        Nộp bởi: {selectedRecord.reportResult.reportedByName} (
                        {dayjs(selectedRecord.reportResult.reportedAt).format("DD/MM/YYYY HH:mm")})
                      </span>
                    )}
                  </div>

                  {selectedRecord.reportResult.attended !== false ? (
                    <>
                      <div>
                        <span className="text-slate-600 font-semibold">Kết quả đạt được: </span>
                        <span className="font-bold text-emerald-800">{selectedRecord.reportResult.resultDetails || "Đạt"}</span>
                      </div>

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

                      <div>
                        <span className="text-slate-600 font-semibold">Hỗ trợ kinh phí: </span>
                        {selectedRecord.reportResult.hasFundingSupport ? (
                          <span className="font-bold text-blue-700">
                            Có hỗ trợ: {(Number(selectedRecord.reportResult.actualFundAmount) || 0).toLocaleString("vi-VN")} đ
                          </span>
                        ) : (
                          <span className="text-slate-500">Không nhận hỗ trợ kinh phí</span>
                        )}
                      </div>

                      {Array.isArray(selectedRecord.reportResult.proofFiles) && selectedRecord.reportResult.proofFiles.length > 0 && (
                        <div>
                          <span className="text-slate-600 font-semibold block mb-1">
                            Hồ sơ minh chứng đính kèm ({selectedRecord.reportResult.proofFiles.length}):
                          </span>
                          <div className="divide-y border border-emerald-200 rounded-lg overflow-hidden bg-white">
                            {selectedRecord.reportResult.proofFiles.map((file, idx) => (
                              <div key={file.fileId || idx} className="p-2.5 flex justify-between items-center hover:bg-emerald-50/40">
                                <div className="flex items-center gap-2 overflow-hidden mr-2">
                                  <PaperClipOutlined className="text-blue-500 flex-shrink-0" />
                                  <a
                                    href={file.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 font-medium text-xs hover:underline truncate"
                                  >
                                    {file.fileName || `Minh chứng ${idx + 1}`}
                                  </a>
                                </div>
                                <Button
                                  type="link"
                                  size="small"
                                  href={file.fileUrl}
                                  target="_blank"
                                  className="text-xs text-blue-600"
                                >
                                  Xem file
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <span className="text-red-600 font-semibold">Lý do không tham gia: </span>
                      <span className="italic text-slate-700">{selectedRecord.reportResult.notAttendedReason || "Không nêu"}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                  <ExclamationCircleOutlined className="text-amber-500 text-sm" />
                  <span>Chưa thực hiện báo cáo kết quả bồi dưỡng.</span>
                </div>
              )}
            </div>

            {/* 6. LỊCH SỬ XỬ LÝ HỒ SƠ / TIẾN TRÌNH */}
            {selectedRecord.history && selectedRecord.history.length > 0 && (
              <div>
                <div className="font-bold text-xs sm:text-sm text-slate-700 mb-2 flex items-center gap-1.5">
                  <HistoryOutlined className="text-blue-600" />
                  Lịch Sử Xử Lý Hồ Sơ:
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <Timeline
                    className="text-xs pt-1"
                    items={selectedRecord.history.map((h) => ({
                      color:
                        h.action.includes("APPROVED") || h.action.includes("Phê duyệt") || h.action.includes("Báo cáo")
                          ? "green"
                          : h.action.includes("REJECT") || h.action.includes("Từ chối")
                          ? "red"
                          : "blue",
                      children: (
                        <div>
                          <div className="font-semibold text-slate-800">
                            {h.action}
                            <span className="font-normal text-slate-500 text-[11px] ml-2">
                              ({dayjs(h.timestamp).format("DD/MM/YYYY HH:mm")})
                            </span>
                          </div>
                          <div className="text-slate-600">
                            {h.details || `Thực hiện bởi: ${h.actorName || "Hệ thống"}`}
                          </div>
                          {h.details && h.actorName && (
                            <div className="text-slate-400 text-[11px]">
                              Thực hiện bởi: {h.actorName}
                            </div>
                          )}
                        </div>
                      ),
                    }))}
                  />
                </div>
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
                    placeholder="Ví dụ: Đạt, Hoàn thành xuất sắc, Điểm 9.0..."
                    value={reportResultDetails}
                    onChange={(e) => setReportResultDetails(e.target.value)}
                  />
                </div>

                {/* 4 trường bổ sung: Số hiệu, Ngày cấp, Nơi cấp, Thời gian đào tạo */}
                <div className="p-3 rounded-lg border border-blue-100 bg-blue-50/40 space-y-3">
                  <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <BookOutlined className="text-blue-600" />
                    Thông tin chứng chỉ / văn bằng được cấp:
                  </div>

                  <Row gutter={[12, 12]}>
                    <Col xs={24} sm={12}>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 block">
                          Số hiệu CC/VB <span className="text-red-500">*</span>:
                        </label>
                        <Input
                          placeholder="Ví dụ: CC-12345/2026, VB-987..."
                          value={reportCertificateNumber}
                          onChange={(e) => setReportCertificateNumber(e.target.value)}
                        />
                      </div>
                    </Col>

                    <Col xs={24} sm={12}>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 block">
                          Ngày cấp <span className="text-red-500">*</span>:
                        </label>
                        <DatePicker
                          className="w-full"
                          format="DD/MM/YYYY"
                          placeholder="Chọn ngày cấp"
                          value={reportIssueDate}
                          onChange={(val) => setReportIssueDate(val)}
                        />
                      </div>
                    </Col>

                    <Col xs={24} sm={12}>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 block">
                          Nơi cấp <span className="text-red-500">*</span>:
                        </label>
                        <Input
                          placeholder="Ví dụ: Trường Đại học Sư phạm TP.HCM..."
                          value={reportIssuePlace}
                          onChange={(e) => setReportIssuePlace(e.target.value)}
                        />
                      </div>
                    </Col>

                    <Col xs={24} sm={12}>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 block">
                          Thời gian đào tạo <span className="text-red-500">*</span>:
                        </label>
                        <Input
                          placeholder="Ví dụ: Từ 01/03/2026 đến 15/06/2026 hoặc 3 tháng..."
                          value={reportActualTrainingDuration}
                          onChange={(e) => setReportActualTrainingDuration(e.target.value)}
                        />
                      </div>
                    </Col>
                  </Row>
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
