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
  Badge,
  Tooltip,
  Row,
  Col,
  Descriptions,
  Timeline,
  Divider,
  Switch,
  Statistic,
  DatePicker,
  Popconfirm,
  Alert,
} from "antd";
import {
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
  FileTextOutlined,
  PaperClipOutlined,
  UserOutlined,
  BarChartOutlined,
  DollarOutlined,
  BookOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  FileExcelOutlined,
  DeleteOutlined,
  DownloadOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  getTrainingRegistrations,
  reportTrainingResult,
  confirmTrainingReportResult,
  batchConfirmTrainingReportResults,
  uploadTrainingProofFiles,
  exportTrainingExcel,
  deleteTrainingRegistration,
  downloadReportResultTemplate,
  importTrainingReportResults,
} from "../../api/trainingApi";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { getUserInfo } from "../../api/auth";
import { isBghUser } from "../../utils/userClassification";
import { useNotificationContext } from "../../context/NotificationContext";

const { Option } = Select;
const { TextArea } = Input;

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [
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

const TrainingResultReportPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userId, userRole, refetchNotificationCounts } = useNotificationContext();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Bộ lọc
  const [filterYear, setFilterYear] = useState(currentYear.toString());
  const [filterDept, setFilterDept] = useState(null);
  const [filterReportStatus, setFilterReportStatus] = useState("ALL"); // ALL, NOT_REPORTED, REPORTED, NOT_ATTENDED
  const [searchText, setSearchText] = useState("");
  const [exporting, setExporting] = useState(false);

  // Modal Báo cáo kết quả
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportingRecord, setReportingRecord] = useState(null);
  const [reportForm] = Form.useForm();
  const [reportAttended, setReportAttended] = useState(true);
  const [reportHasFunding, setReportHasFunding] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  // Modal Chi tiết
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);

  // Modal Import Báo cáo kết quả
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importResultSummary, setImportResultSummary] = useState(null);

  // Nhận diện màn hình di động responsive
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  // Batch actions state (Xác nhận / Duyệt nhiều cùng lúc)
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [batchConfirming, setBatchConfirming] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isRealAdmin =
    userRole === "admin" ||
    currentUserData?.role === "admin";

  const isManagerOrAdmin =
    isRealAdmin ||
    userRole === "manager" ||
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
    if (email.includes("maianhthy") || email.startsWith("thy") || email.includes("thiy") || email === "anhthy@nsg.edu.vn" || email.includes("anhthy")) return true;

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
  const canImportResult = isManagerOrAdmin || isMaiAnhThy || isCapTruong || isCapPho;

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
    const fetchDepts = async () => {
      try {
        const res = await getAllDepartments();
        const deptList = (
          res?.AllDepartment ||
          res?.data ||
          res?.departments ||
          (Array.isArray(res) ? res : [])
        ).filter((d) => !d.departmentName?.toLowerCase().includes("giải thể"));
        setDepartments(deptList);
      } catch (err) {
        console.error("Lỗi lấy danh sách phòng ban:", err);
      }
    };
    fetchDepts();
  }, []);

  // 2. Tải danh sách hồ sơ bồi dưỡng đã được phê duyệt
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        fetchAll: "true",
        status: "APPROVED", // Chỉ các hồ sơ đã duyệt mới báo cáo kết quả
      };

      if (filterYear) params.year = filterYear;
      if (filterDept) params.department = filterDept;
      if (searchText.trim()) params.search = searchText.trim();

      const res = await getTrainingRegistrations(params);
      if (res.success) {
        setData(res.data || []);
      }
    } catch (err) {
      console.error("Lỗi tải danh sách báo cáo bồi dưỡng:", err);
      message.error("Lỗi khi tải danh sách bồi dưỡng.");
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterDept, searchText]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 3. Lọc dữ liệu theo trạng thái báo cáo
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const rep = item.reportResult || {};
      const isReported = rep.status === "REPORTED";

      if (filterReportStatus === "NOT_REPORTED") {
        return !isReported;
      }
      if (filterReportStatus === "REPORTED") {
        return isReported && rep.attended !== false;
      }
      if (filterReportStatus === "NOT_ATTENDED") {
        return isReported && rep.attended === false;
      }
      return true;
    });
  }, [data, filterReportStatus]);

  // 4. Thống kê nhanh
  const stats = useMemo(() => {
    const total = data.length;
    let reportedCount = 0;
    let notAttendedCount = 0;
    let totalFund = 0;

    data.forEach((d) => {
      const rep = d.reportResult;
      if (rep && rep.status === "REPORTED") {
        if (rep.attended === false) {
          notAttendedCount += 1;
        } else {
          reportedCount += 1;
          if (rep.hasFundingSupport && rep.actualFundAmount) {
            totalFund += Number(rep.actualFundAmount) || 0;
          }
        }
      }
    });

    const pendingCount = total - reportedCount - notAttendedCount;

    return {
      total,
      reportedCount,
      notAttendedCount,
      pendingCount: pendingCount > 0 ? pendingCount : 0,
      totalFund,
    };
  }, [data]);

  // 5. Mở modal Báo cáo kết quả
  const handleOpenReportModal = (record) => {
    setReportingRecord(record);
    const existing = record.reportResult || {};
    const attended = existing.attended !== false;
    const hasFund = Boolean(existing.hasFundingSupport);

    setReportAttended(attended);
    setReportHasFunding(hasFund);
    setUploadedFiles(existing.proofFiles || []);

    reportForm.setFieldsValue({
      attended: attended ? "true" : "false",
      resultDetails: existing.resultDetails || "Đạt",
      certificateNumber: existing.certificateNumber || "",
      issueDate: existing.issueDate ? dayjs(existing.issueDate) : null,
      issuePlace: existing.issuePlace || "",
      actualTrainingDuration: existing.actualTrainingDuration || record.trainingDuration || "",
      notAttendedReason: existing.notAttendedReason || "",
      hasFundingSupport: hasFund,
      actualFundAmount: existing.actualFundAmount || 0,
    });

    setIsReportModalOpen(true);
  };

  // 6. Xử lý Upload minh chứng
  const handleCustomUpload = async ({ file, onSuccess, onError }) => {
    setUploadingFiles(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await uploadTrainingProofFiles(formData);
      if (res.success && res.data && res.data.length > 0) {
        setUploadedFiles((prev) => [...prev, ...res.data]);
        message.success(`Đã tải lên minh chứng: ${file.name}`);
        onSuccess(res.data);
      } else {
        throw new Error(res.message || "Tải file thất bại");
      }
    } catch (err) {
      console.error("Lỗi upload minh chứng:", err);
      message.error(err.response?.data?.message || "Lỗi tải file minh chứng lên Drive");
      onError(err);
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleRemoveFile = (fileId) => {
    setUploadedFiles((prev) => prev.filter((f) => f.fileId !== fileId));
    message.info("Đã gỡ bỏ file minh chứng");
  };

  // 7. Gửi Báo cáo kết quả
  const handleSubmitReport = async () => {
    try {
      const values = await reportForm.validateFields();
      setSubmittingReport(true);

      const payload = {
        attended: reportAttended,
        notAttendedReason: !reportAttended ? values.notAttendedReason : "",
        resultDetails: reportAttended ? values.resultDetails : "",
        certificateNumber: reportAttended ? (values.certificateNumber || "").trim() : "",
        issueDate: reportAttended && values.issueDate ? values.issueDate.toISOString() : null,
        issuePlace: reportAttended ? (values.issuePlace || "").trim() : "",
        actualTrainingDuration: reportAttended ? (values.actualTrainingDuration || "").trim() : "",
        hasFundingSupport: reportAttended ? reportHasFunding : false,
        actualFundAmount: reportAttended && reportHasFunding ? values.actualFundAmount : 0,
        proofFiles: reportAttended ? uploadedFiles : [],
      };

      const res = await reportTrainingResult(reportingRecord._id, payload);
      if (res.success) {
        message.success("Báo cáo kết quả bồi dưỡng thành công!");
        setIsReportModalOpen(false);
        fetchData();
        if (refetchNotificationCounts) refetchNotificationCounts();
      }
    } catch (err) {
      console.error("Lỗi gửi báo cáo kết quả:", err);
      message.error(err.response?.data?.message || "Lỗi khi báo cáo kết quả");
    } finally {
      setSubmittingReport(false);
    }
  };

  // 8. Manager xác nhận kết quả
  const handleConfirmResult = async (record) => {
    try {
      const res = await confirmTrainingReportResult(record._id);
      if (res.success) {
        message.success("Đã xác nhận kết quả bồi dưỡng!");
        fetchData();
      }
    } catch (err) {
      console.error("Lỗi xác nhận kết quả:", err);
      message.error(err.response?.data?.message || "Lỗi khi xác nhận kết quả");
    }
  };

  // 8.1. Manager / Mai Anh Thy xác nhận kết quả nhiều hồ sơ cùng lúc
  const canBatchConfirm = isAdmin || isMaiAnhThy;

  const confirmableRows = useMemo(() => {
    return filteredData.filter(
      (r) => r.reportResult?.status === "REPORTED" && !r.reportResult?.managerConfirmed
    );
  }, [filteredData]);

  const selectedConfirmableKeys = useMemo(() => {
    const confirmableSet = new Set(confirmableRows.map((r) => r._id.toString()));
    return selectedRowKeys.filter((k) => confirmableSet.has(k.toString()));
  }, [selectedRowKeys, confirmableRows]);

  const handleBatchConfirm = async () => {
    const targetKeys = selectedConfirmableKeys.length > 0 ? selectedConfirmableKeys : selectedRowKeys;
    if (targetKeys.length === 0) {
      message.warning("Vui lòng chọn ít nhất một hồ sơ đã nộp báo cáo chờ duyệt để xác nhận.");
      return;
    }
    setBatchConfirming(true);
    try {
      const res = await batchConfirmTrainingReportResults(targetKeys);
      if (res.success) {
        message.success(res.message || `Đã xác nhận kết quả cho ${res.count || targetKeys.length} hồ sơ.`);
        setSelectedRowKeys([]);
        fetchData();
        if (refetchNotificationCounts) refetchNotificationCounts();
      }
    } catch (err) {
      console.error("Lỗi xác nhận hàng loạt:", err);
      message.error(err.response?.data?.message || "Lỗi khi xác nhận kết quả hàng loạt.");
    } finally {
      setBatchConfirming(false);
    }
  };

  const rowSelection = canBatchConfirm
    ? {
        selectedRowKeys,
        onChange: (keys) => setSelectedRowKeys(keys),
        selections: [
          Table.SELECTION_ALL,
          Table.SELECTION_INVERT,
          Table.SELECTION_NONE,
          {
            key: "select-pending-confirm",
            text: `Chọn tất cả chờ duyệt (${confirmableRows.length})`,
            onSelect: () => {
              setSelectedRowKeys(confirmableRows.map((r) => r._id));
            },
          },
        ],
      }
    : undefined;

  // 8.1. Xóa hồ sơ đào tạo (Dành cho Admin)
  const handleDelete = async (recordId) => {
    setDeletingId(recordId);
    try {
      const res = await deleteTrainingRegistration(recordId);
      if (res.success) {
        message.success(res.message || "Đã xóa hồ sơ thành công.");
        fetchData();
        if (refetchNotificationCounts) refetchNotificationCounts();
      }
    } catch (err) {
      console.error("Lỗi xóa hồ sơ:", err);
      message.error(err.response?.data?.message || "Lỗi khi xóa hồ sơ.");
    } finally {
      setDeletingId(null);
    }
  };

  // 9. Xuất danh sách báo cáo ra file Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = {
        status: "APPROVED", // Hồ sơ báo cáo kết quả là hồ sơ đã được duyệt
      };
      if (filterYear) params.year = filterYear;
      if (filterDept) params.department = filterDept;
      if (filterReportStatus && filterReportStatus !== "ALL") {
        if (filterReportStatus === "NOT_REPORTED") {
          params.reportStatus = "NOT_REPORTED";
        } else if (filterReportStatus === "REPORTED") {
          params.reportStatus = "REPORTED";
          params.attended = "true";
        } else if (filterReportStatus === "NOT_ATTENDED") {
          params.reportStatus = "REPORTED";
          params.attended = "false";
        }
      }
      if (searchText.trim()) params.search = searchText.trim();

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
      a.download = `Bao_Cao_Ket_Qua_Boi_Duong_${filterYear ? `Nam_${filterYear}` : "TatCa"}_${dayjs().format(
        "YYYYMMDD_HHmm"
      )}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success("Xuất file Excel danh sách báo cáo kết quả thành công!");
    } catch (err) {
      console.error("Lỗi xuất Excel báo cáo kết quả:", err);
      message.error(err.message || "Có lỗi xảy ra khi xuất file Excel!");
    } finally {
      setExporting(false);
    }
  };

  // 10. Tải file mẫu Excel Báo cáo kết quả (kèm Sheet Danh mục tham chiếu liên quan)
  const handleDownloadResultTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const params = {};
      if (filterYear) params.year = filterYear;
      if (filterDept) params.department = filterDept;

      const res = await downloadReportResultTemplate(params);
      if (res.data?.type === "application/json") {
        const text = await res.data.text();
        const json = JSON.parse(text);
        throw new Error(json.message || "Lỗi máy chủ khi tải file mẫu");
      }

      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Mau_Bao_Cao_Ket_Qua_Boi_Duong_${filterYear ? `Nam_${filterYear}` : "TatCa"}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      message.success("Đã tải file mẫu báo cáo kết quả thành công!");
    } catch (err) {
      console.error("Lỗi tải file mẫu kết quả:", err);
      message.error(err.message || "Không thể tải file mẫu báo cáo kết quả.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // 11. Tiến hành Import file kết quả bồi dưỡng
  const handleImportResultSubmit = async () => {
    if (!importFile) {
      message.warning("Vui lòng chọn file Excel kết quả trước khi nhấn Import.");
      return;
    }

    setImporting(true);
    setImportResultSummary(null);
    try {
      const res = await importTrainingReportResults(importFile);
      if (res.success) {
        setImportResultSummary(res.data);
        message.success(res.message || "Import kết quả bồi dưỡng thành công!");
        fetchData();
        if (refetchNotificationCounts) refetchNotificationCounts();
        setImportFile(null);
      } else {
        message.error(res.message || "Import kết quả thất bại.");
      }
    } catch (err) {
      console.error("Lỗi import kết quả bồi dưỡng:", err);
      message.error(err.response?.data?.message || err.message || "Lỗi khi import file Excel kết quả.");
    } finally {
      setImporting(false);
    }
  };

  const handleCloseImportModal = () => {
    setIsImportModalOpen(false);
    setImportFile(null);
    setImportResultSummary(null);
  };

  // Cột bảng dữ liệu
  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 60,
      align: "center",
      render: (_, __, index) => <span className="font-semibold text-slate-500">{index + 1}</span>,
    },
    {
      title: "Nhân sự",
      key: "userName",
      width: 220,
      render: (_, r) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-800 text-sm">{r.userName}</span>
            {!r.user && (
              <Tag color="orange" className="text-[10px] px-1 py-0 m-0 border-none font-medium">
                Chưa có TK
              </Tag>
            )}
          </div>
          <div className="text-xs text-slate-500">{r.positionName || "Cán bộ"}</div>
          <div className="text-xs text-blue-600 font-medium">{r.departmentName || "Đơn vị"}</div>
        </div>
      ),
    },
    {
      title: "Khóa học & Hình thức",
      key: "trainingContent",
      width: 280,
      render: (_, r) => (
        <div className="space-y-1">
          <div className="font-semibold text-slate-800 text-sm line-clamp-2" title={r.trainingContent}>
            {r.trainingContent}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag color="blue" className="text-xs m-0">
              {r.trainingForm || "Chứng chỉ"}
            </Tag>
            {r.trainingLocation && (
              <span className="text-xs text-slate-500 truncate max-w-[180px]" title={r.trainingLocation}>
                📍 {r.trainingLocation}
              </span>
            )}
          </div>
          {r.trainingDuration && (
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <CalendarOutlined /> {r.trainingDuration}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Tình trạng báo cáo",
      key: "reportStatus",
      width: 170,
      render: (_, r) => {
        const rep = r.reportResult;
        if (!rep || rep.status !== "REPORTED") {
          return (
            <Tag icon={<ClockCircleOutlined />} color="warning" className="px-2.5 py-0.5 font-medium">
              Chưa báo cáo
            </Tag>
          );
        }
        if (rep.attended === false) {
          return (
            <Tag icon={<CloseCircleOutlined />} color="error" className="px-2.5 py-0.5 font-medium">
              Không tham gia
            </Tag>
          );
        }
        return (
          <div className="space-y-1">
            <Tag icon={<CheckCircleOutlined />} color="success" className="px-2.5 py-0.5 font-medium m-0">
              Đã tham gia học
            </Tag>
            {rep.managerConfirmed ? (
              <div>
                <Tag color="cyan" className="text-[10px] m-0">
                  ✓ Quản lý đã xác nhận
                </Tag>
              </div>
            ) : (
              <div>
                <Tag color="default" className="text-[10px] m-0 text-slate-400">
                  Chờ quản lý duyệt KQ
                </Tag>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Kết quả & Minh chứng",
      key: "resultDetails",
      width: 240,
      render: (_, r) => {
        const rep = r.reportResult;
        if (!rep || rep.status !== "REPORTED") {
          return <span className="text-slate-400 text-xs italic">Chưa có kết quả</span>;
        }

        if (rep.attended === false) {
          return (
            <div className="text-xs text-red-600">
              <span className="font-semibold">Lý do: </span>
              <span>{rep.notAttendedReason || "Không nêu rõ"}</span>
            </div>
          );
        }

        return (
          <div className="space-y-1 text-xs">
            <div>
              <span className="font-semibold text-slate-700">Kết quả: </span>
              <span className="text-emerald-700 font-medium">{rep.resultDetails || "Đạt"}</span>
            </div>
            {rep.certificateNumber && (
              <div className="text-slate-600 truncate">
                Số CC/VB: <span className="font-semibold">{rep.certificateNumber}</span>
                {rep.issueDate && (
                  <span className="text-slate-400 ml-1">
                    ({dayjs(rep.issueDate).format("DD/MM/YYYY")})
                  </span>
                )}
              </div>
            )}
            {rep.hasFundingSupport ? (
              <div className="text-blue-700 font-medium">
                💰 Hỗ trợ: {(Number(rep.actualFundAmount) || 0).toLocaleString("vi-VN")} đ
              </div>
            ) : (
              <div className="text-slate-400">Không nhận kinh phí</div>
            )}
            {Array.isArray(rep.proofFiles) && rep.proofFiles.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {rep.proofFiles.map((file, idx) => (
                  <a
                    key={file.fileId || idx}
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200"
                  >
                    <PaperClipOutlined /> {formatProofFileName(file, rep, idx)}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      width: isMobile ? 75 : 180,
      align: "center",
      fixed: "right",
      render: (_, r) => {
        const rep = r.reportResult;
        const isReported = rep && rep.status === "REPORTED";

        const userDeptId = (
          currentUserData?.department?._id ||
          currentUserData?.department ||
          ""
        ).toString();
        const recordDeptId = (
          r.department?._id ||
          r.department ||
          ""
        ).toString();
        const isRecordInDept = userDeptId && recordDeptId && userDeptId === recordDeptId;

        const currentUserIdStr = (userId || currentUserData?._id || "").toString();
        const recordUserIdStr = (r.user?._id || r.user || "").toString();
        const isSelf = Boolean(
          (currentUserIdStr && recordUserIdStr && currentUserIdStr === recordUserIdStr) ||
          (currentUserData?.name && r.userName && currentUserData.name.trim().toLowerCase() === r.userName.trim().toLowerCase()) ||
          (isMaiAnhThy && r.userName && (
            r.userName.trim().toLowerCase() === "mai anh thy" ||
            r.userName.toLowerCase().includes("mai anh thy")
          ))
        );

        const recordCreatorIdStr = (r.createdByUser?._id || r.createdByUser || "").toString();
        const isCreator = Boolean(
          currentUserIdStr && recordCreatorIdStr && currentUserIdStr === recordCreatorIdStr
        );

        const canReportBase =
          isAdmin ||
          isMaiAnhThy ||
          isSelf ||
          ((isCapTruong || isCapPho) && (isRecordInDept || isCreator));

        const isConfirmed = Boolean(rep?.managerConfirmed);

        // Khi trạng thái Báo cáo kết quả đã được Quản lý xác nhận:
        // - Ẩn nút Sửa KQ với tất cả các vai trò khác (nhân viên, quản lý, người duyệt...)
        // - CHỈ nhóm quyền Admin (isRealAdmin) mới được quyền Sửa KQ
        const showReportBtn = !isReported
          ? canReportBase
          : isConfirmed
          ? isRealAdmin
          : canReportBase;

        const canConfirmSingle = (isAdmin || isMaiAnhThy) && isReported && !isConfirmed;
        const canDelete = isRealAdmin;

        return (
          <div className="grid grid-cols-2 gap-1.5 w-[164px] mx-auto max-sm:flex max-sm:flex-wrap max-sm:gap-1 max-sm:w-auto max-sm:justify-center py-0.5">
            {/* Chi tiết */}
            <Tooltip title="Xem chi tiết hồ sơ">
              <Button
                size="small"
                onClick={() => {
                  setDetailRecord(r);
                  setIsDetailModalOpen(true);
                }}
                className={`w-full h-7 px-1.5 max-sm:!w-7 max-sm:!h-7 max-sm:!p-0 flex items-center justify-center text-xs font-medium border border-blue-200 bg-blue-50/70 text-blue-600 hover:bg-blue-100 hover:border-blue-300 rounded transition-colors ${
                  showReportBtn ? "col-span-1" : "col-span-2"
                }`}
              >
                <EyeOutlined />
                <span className="hidden sm:inline ml-1">Chi tiết</span>
              </Button>
            </Tooltip>

            {/* Báo cáo kết quả / Sửa kết quả */}
            {showReportBtn && (
              <Tooltip
                title={
                  isReported
                    ? isConfirmed
                      ? "Chỉnh sửa báo cáo kết quả (Quyền Admin)"
                      : "Chỉnh sửa báo cáo kết quả"
                    : "Nộp báo cáo kết quả bồi dưỡng"
                }
              >
                <Button
                  size="small"
                  type="primary"
                  onClick={() => handleOpenReportModal(r)}
                  className={`w-full h-7 px-1.5 max-sm:!w-7 max-sm:!h-7 max-sm:!p-0 flex items-center justify-center text-xs font-medium border-none text-white shadow-xs rounded transition-colors ${
                    isReported
                      ? "bg-slate-600 hover:bg-slate-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {isReported ? <EditOutlined /> : <FileDoneOutlined />}
                  <span className="hidden sm:inline ml-1">
                    {isReported ? "Sửa KQ" : "Báo cáo"}
                  </span>
                </Button>
              </Tooltip>
            )}

            {/* Xác nhận kết quả (Manager / Admin / Mai Anh Thy) */}
            {canConfirmSingle && (
              <Tooltip title="Xác nhận kết quả bồi dưỡng">
                <Button
                  size="small"
                  onClick={() => handleConfirmResult(r)}
                  className={`w-full h-7 px-1.5 max-sm:!w-7 max-sm:!h-7 max-sm:!p-0 max-sm:!col-span-1 flex items-center justify-center text-xs font-medium border border-emerald-400 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-500 rounded transition-colors ${
                    canDelete ? "col-span-1" : "col-span-2"
                  }`}
                >
                  <CheckCircleOutlined />
                  <span className="hidden sm:inline ml-1">Xác nhận KQ</span>
                </Button>
              </Tooltip>
            )}

            {/* Xóa hồ sơ (Chỉ nhóm quyền Admin) */}
            {canDelete && (
              <Popconfirm
                title="Xóa hồ sơ bồi dưỡng này?"
                description="Dữ liệu đã xóa sẽ không thể khôi phục."
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true, loading: deletingId === r._id }}
                onConfirm={() => handleDelete(r._id)}
              >
                <Tooltip title="Xóa hồ sơ (Chỉ Quản trị viên)">
                  <Button
                    size="small"
                    danger
                    className={`w-full h-7 px-1.5 max-sm:!w-7 max-sm:!h-7 max-sm:!p-0 max-sm:!col-span-1 flex items-center justify-center text-xs font-medium border border-red-200 bg-red-50/70 text-red-600 hover:bg-red-100 hover:border-red-300 rounded transition-colors ${
                      canConfirmSingle ? "col-span-1" : "col-span-2"
                    }`}
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
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white rounded-xl p-4 sm:p-5 shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <FileDoneOutlined className="text-2xl sm:text-3xl text-emerald-200 shrink-0" />
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight m-0 text-white">
                Báo Cáo Kết Quả Học Tập Bồi Dưỡng
              </h1>
            </div>
            <p className="text-emerald-100 text-xs sm:text-sm mt-1 mb-0">
              Thực hiện báo cáo kết quả bồi dưỡng (đạt/không đạt, tải minh chứng văn bằng chứng chỉ, kinh phí hỗ trợ hoặc lý do chưa tham gia) sau khi hoàn thành khóa đào tạo.
            </p>
          </div>

          {/* Nút Thao tác: Thu gọn thành icon kèm Tooltip trên màn hình nhỏ/vừa, hiển thị đầy đủ icon + chữ trên màn hình lớn */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-end sm:self-auto mt-2 sm:mt-0">
            {canImportResult && (
              <Tooltip title="Nhập kết quả bồi dưỡng từ file Excel">
                <Button
                  type="primary"
                  icon={<UploadOutlined className="text-base" />}
                  onClick={() => setIsImportModalOpen(true)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-500 font-medium text-xs sm:text-sm h-9 px-2.5 sm:px-3 shadow-xs flex items-center justify-center rounded-lg"
                >
                  <span className="hidden xl:inline ml-1">Import kết quả</span>
                </Button>
              </Tooltip>
            )}

            <Tooltip title="Xuất danh sách báo cáo ra file Excel">
              <Button
                type="primary"
                icon={<FileExcelOutlined className="text-base" />}
                onClick={handleExportExcel}
                loading={exporting}
                className="bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-400 font-medium text-xs sm:text-sm h-9 px-2.5 sm:px-3 shadow-xs flex items-center justify-center rounded-lg"
              >
                <span className="hidden xl:inline ml-1">Xuất Excel</span>
              </Button>
            </Tooltip>

            <Tooltip title="Chuyển sang Danh sách đề nghị bồi dưỡng">
              <Button
                type="default"
                icon={<UnorderedListOutlined className="text-base" />}
                onClick={() => navigate("/training/list")}
                className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs sm:text-sm h-9 px-2.5 sm:px-3 flex items-center justify-center rounded-lg"
              >
                <span className="hidden xl:inline ml-1">Danh sách đề nghị</span>
              </Button>
            </Tooltip>

            <Tooltip title="Chuyển sang Thống kê - Báo cáo tổng hợp">
              <Button
                type="default"
                icon={<BarChartOutlined className="text-base" />}
                onClick={() => navigate("/training/report")}
                className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs sm:text-sm h-9 px-2.5 sm:px-3 flex items-center justify-center rounded-lg"
              >
                <span className="hidden xl:inline ml-1">Thống kê - Báo cáo</span>
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <Row gutter={[10, 10]}>
        <Col xs={12} sm={6} md={6}>
          <Card className="shadow-xs border-slate-200" bodyStyle={{ padding: isMobile ? "10px 12px" : "12px 16px" }}>
            <Statistic
              title={<span className="text-[11px] sm:text-xs text-slate-500 font-medium">Tổng khóa được duyệt</span>}
              value={stats.total}
              suffix="khóa"
              valueStyle={{ color: "#1e293b", fontWeight: "bold", fontSize: isMobile ? "1.05rem" : "1.25rem" }}
              prefix={<BookOutlined className="text-blue-500 text-sm" />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6} md={6}>
          <Card className="shadow-xs border-slate-200" bodyStyle={{ padding: isMobile ? "10px 12px" : "12px 16px" }}>
            <Statistic
              title={<span className="text-[11px] sm:text-xs text-slate-500 font-medium">Chưa báo cáo</span>}
              value={stats.pendingCount}
              suffix="khóa"
              valueStyle={{ color: "#d97706", fontWeight: "bold", fontSize: isMobile ? "1.05rem" : "1.25rem" }}
              prefix={<ClockCircleOutlined className="text-amber-500 text-sm" />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6} md={6}>
          <Card className="shadow-xs border-slate-200" bodyStyle={{ padding: isMobile ? "10px 12px" : "12px 16px" }}>
            <Statistic
              title={<span className="text-[11px] sm:text-xs text-slate-500 font-medium">Đã tham gia học</span>}
              value={stats.reportedCount}
              suffix="khóa"
              valueStyle={{ color: "#059669", fontWeight: "bold", fontSize: isMobile ? "1.05rem" : "1.25rem" }}
              prefix={<CheckCircleOutlined className="text-emerald-500 text-sm" />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6} md={6}>
          <Card className="shadow-xs border-slate-200" bodyStyle={{ padding: isMobile ? "10px 12px" : "12px 16px" }}>
            <Statistic
              title={<span className="text-[11px] sm:text-xs text-slate-500 font-medium">Tổng kinh phí hỗ trợ</span>}
              value={stats.totalFund}
              formatter={(val) => `${Number(val).toLocaleString("vi-VN")} đ`}
              valueStyle={{ color: "#2563eb", fontWeight: "bold", fontSize: isMobile ? "0.95rem" : "1.1rem" }}
              prefix={<DollarOutlined className="text-blue-500 text-sm" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Toolbar: Phân bố chính xác 24 cột Grid để 100% không bị tràn hàng */}
      <Card className="shadow-xs border-slate-200" bodyStyle={{ padding: "12px 16px" }}>
        <Row gutter={[10, 10]} align="middle">
          {/* 1. Năm: 3 cột */}
          <Col xs={12} sm={6} md={3} lg={3}>
            <Select
              value={filterYear}
              onChange={setFilterYear}
              className="w-full"
              placeholder="Chọn năm"
            >
              {YEAR_OPTIONS.map((y) => (
                <Option key={y} value={y}>
                  Năm {y}
                </Option>
              ))}
            </Select>
          </Col>

          {/* 2. Đơn vị: 5 cột (chỉ hiện nếu không phải GV-VC) */}
          {!isChuyenVien && (
            <Col xs={12} sm={6} md={5} lg={5}>
              {isCapTruong || isCapPho ? (
                <div className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-700 truncate font-semibold h-[32px] flex items-center">
                  <span>{currentUserData?.department?.departmentName || "Đơn vị của tôi"}</span>
                </div>
              ) : (
                <Select
                  value={filterDept}
                  onChange={setFilterDept}
                  placeholder="Tất cả đơn vị"
                  className="w-full"
                  allowClear
                  showSearch
                  optionFilterProp="children"
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

          {/* 3. Trạng thái: 4 cột */}
          <Col xs={12} sm={6} md={4} lg={4}>
            <Select
              value={filterReportStatus}
              onChange={setFilterReportStatus}
              className="w-full"
            >
              <Option value="ALL">Tất cả trạng thái</Option>
              <Option value="NOT_REPORTED">⚠️ Chưa báo cáo</Option>
              <Option value="REPORTED">✓ Đã tham gia học</Option>
              <Option value="NOT_ATTENDED">✗ Không tham gia</Option>
            </Select>
          </Col>

          {/* 4. Tìm kiếm: 7 cột (hoặc 12 cột nếu GV-VC) */}
          <Col
            xs={!isChuyenVien ? 12 : 24}
            sm={!isChuyenVien ? 6 : 12}
            md={isChuyenVien ? 12 : 7}
            lg={isChuyenVien ? 12 : 7}
          >
            <Input
              placeholder="Tìm tên, nội dung học..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              className="w-full"
            />
          </Col>

          {/* 5. Nút Thao tác: 5 cột (Xuất Excel + Tải lại vừa vặn trong cùng 1 hàng) */}
          <Col xs={24} sm={24} md={5} lg={5} className="flex items-center justify-end gap-2">
            <Button
              icon={<FileExcelOutlined />}
              onClick={handleExportExcel}
              loading={exporting}
              className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 flex-1 sm:flex-initial flex items-center justify-center font-medium h-[32px] px-2.5"
            >
              <span>Xuất Excel</span>
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchData}
              loading={loading}
              className="flex-1 sm:flex-initial flex items-center justify-center font-medium h-[32px] px-2.5"
            >
              <span>Tải lại</span>
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Batch Action Toolbar: Dành cho Quản lý & Mai Anh Thy duyệt / xác nhận nhiều kết quả cùng lúc */}
      {canBatchConfirm && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
              <CheckCircleOutlined className="text-emerald-600" />
              Duyệt / Xác nhận kết quả:
            </span>
            {selectedRowKeys.length > 0 ? (
              <Tag color="emerald" className="m-0 text-xs font-medium">
                Đã chọn {selectedRowKeys.length} hồ sơ ({selectedConfirmableKeys.length} chờ duyệt KQ)
              </Tag>
            ) : (
              <span className="text-xs text-slate-500">
                (Có {confirmableRows.length} hồ sơ đã nộp báo cáo đang chờ duyệt KQ)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {confirmableRows.length > 0 && selectedRowKeys.length === 0 && (
              <Button
                size="small"
                onClick={() => setSelectedRowKeys(confirmableRows.map((r) => r._id))}
                className="text-xs text-emerald-700 border-emerald-300 hover:border-emerald-400 bg-white"
              >
                Chọn tất cả chờ duyệt ({confirmableRows.length})
              </Button>
            )}

            {selectedRowKeys.length > 0 && (
              <>
                <Popconfirm
                  title="Xác nhận kết quả hàng loạt"
                  description={`Bạn có chắc muốn duyệt/xác nhận kết quả cho ${
                    selectedConfirmableKeys.length > 0
                      ? `${selectedConfirmableKeys.length} hồ sơ đã chọn`
                      : `${selectedRowKeys.length} hồ sơ`
                  }?`}
                  onConfirm={handleBatchConfirm}
                  okText="Xác nhận"
                  cancelText="Hủy"
                  disabled={selectedConfirmableKeys.length === 0}
                >
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    loading={batchConfirming}
                    disabled={selectedConfirmableKeys.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-7 px-3 shadow-xs"
                  >
                    Duyệt / Xác nhận ({selectedConfirmableKeys.length})
                  </Button>
                </Popconfirm>

                <Button
                  size="small"
                  onClick={() => setSelectedRowKeys([])}
                  className="text-xs text-slate-500 hover:text-slate-700 h-7"
                >
                  Bỏ chọn
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Table */}
      <Card className="shadow-xs border-slate-200" bodyStyle={{ padding: "0" }}>
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={filteredData}
          rowKey="_id"
          loading={loading}
          scroll={{ x: isMobile ? 850 : 1300 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showLessItems: true,
            responsive: true,
            pageSizeOptions: ["10", "15", "30", "50"],
            showTotal: (total) => `Tổng số ${total} khóa học`,
          }}
          locale={{ emptyText: "Không có khóa học nào đã được phê duyệt cần báo cáo." }}
        />
      </Card>

      {/* Modal Báo cáo kết quả */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800">
            <FileDoneOutlined className="text-blue-600 text-lg" />
            <span className="font-bold">Báo Cáo Kết Quả Bồi Dưỡng</span>
          </div>
        }
        open={isReportModalOpen}
        onCancel={() => setIsReportModalOpen(false)}
        onOk={handleSubmitReport}
        confirmLoading={submittingReport}
        okText="Gửi báo cáo"
        cancelText="Hủy"
        width={650}
        destroyOnClose
      >
        {reportingRecord && (
          <div className="space-y-4 pt-2">
            {/* Tóm tắt thông tin khóa học */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Nhân sự bồi dưỡng:</span>
                <span className="font-bold text-slate-800">
                  {reportingRecord.userName} ({reportingRecord.positionName || "Cán bộ"} - {reportingRecord.departmentName})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Khóa bồi dưỡng:</span>
                <span className="font-semibold text-blue-700">{reportingRecord.trainingContent}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hình thức:</span>
                <span className="text-slate-700">{reportingRecord.trainingForm} | {reportingRecord.trainingLocation || "Chưa rõ"}</span>
              </div>
            </div>

            <Form form={reportForm} layout="vertical">
              {/* Tham gia hay không */}
              <Form.Item label="Tình trạng tham gia đào tạo" required>
                <Radio.Group
                  value={reportAttended ? "true" : "false"}
                  onChange={(e) => setReportAttended(e.target.value === "true")}
                  className="w-full"
                >
                  <Row gutter={[12, 12]}>
                    <Col span={12}>
                      <Radio.Button value="true" className="w-full text-center h-10 flex items-center justify-center font-medium">
                        ✓ Đã tham gia học
                      </Radio.Button>
                    </Col>
                    <Col span={12}>
                      <Radio.Button value="false" className="w-full text-center h-10 flex items-center justify-center font-medium">
                        ✗ Không tham gia học
                      </Radio.Button>
                    </Col>
                  </Row>
                </Radio.Group>
              </Form.Item>

              {/* Nếu tham gia học */}
              {reportAttended ? (
                <>
                  <Form.Item
                    name="resultDetails"
                    label="Kết quả bồi dưỡng"
                    rules={[{ required: true, message: "Vui lòng nhập kết quả bồi dưỡng" }]}
                  >
                    <Input placeholder="Ví dụ: Đạt, Hoàn thành xuất sắc, Điểm 9.0..." />
                  </Form.Item>

                  {/* 4 trường bổ sung: Số hiệu, Ngày cấp, Nơi cấp, Thời gian đào tạo */}
                  <div className="p-3 rounded-lg border border-blue-100 bg-blue-50/40 space-y-3">
                    <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <BookOutlined className="text-blue-600" />
                      Thông tin chứng chỉ / văn bằng được cấp:
                    </div>

                    <Row gutter={[12, 12]}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="certificateNumber"
                          label={<span className="text-xs font-semibold text-slate-700">Số hiệu CC/VB</span>}
                          rules={[{ required: true, message: "Vui lòng nhập số hiệu CC/VB" }]}
                          className="mb-0"
                        >
                          <Input placeholder="Ví dụ: CC-12345/2026, VB-987..." />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="issueDate"
                          label={<span className="text-xs font-semibold text-slate-700">Ngày cấp</span>}
                          rules={[{ required: true, message: "Vui lòng chọn ngày cấp" }]}
                          className="mb-0"
                        >
                          <DatePicker
                            className="w-full"
                            format="DD/MM/YYYY"
                            placeholder="Chọn ngày cấp"
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="issuePlace"
                          label={<span className="text-xs font-semibold text-slate-700">Nơi cấp</span>}
                          rules={[{ required: true, message: "Vui lòng nhập nơi cấp" }]}
                          className="mb-0"
                        >
                          <Input placeholder="Ví dụ: Trường Đại học Sư phạm TP.HCM..." />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="actualTrainingDuration"
                          label={<span className="text-xs font-semibold text-slate-700">Thời gian đào tạo</span>}
                          rules={[{ required: true, message: "Vui lòng nhập thời gian đào tạo" }]}
                          className="mb-0"
                        >
                          <Input placeholder="Ví dụ: Từ 01/03/2026 đến 15/06/2026 hoặc 3 tháng..." />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>

                  <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">
                        Xác nhận hỗ trợ kinh phí đào tạo:
                      </span>
                      <Switch
                        checked={reportHasFunding}
                        onChange={setReportHasFunding}
                        checkedChildren="Có hỗ trợ"
                        unCheckedChildren="Không hỗ trợ"
                      />
                    </div>

                    {reportHasFunding && (
                      <Form.Item
                        name="actualFundAmount"
                        label="Số tiền kinh phí thực tế hỗ trợ (VNĐ)"
                        className="mb-0"
                      >
                        <InputNumber
                          className="w-full"
                          min={0}
                          step={500000}
                          formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          parser={(val) => val.replace(/\$\s?|(,*)/g, "")}
                        />
                      </Form.Item>
                    )}
                  </div>

                  {/* Minh chứng chứng chỉ / văn bằng */}
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Minh chứng đính kèm (Ảnh / File PDF văn bằng, chứng chỉ, chứng nhận):
                    </label>

                    <Upload
                      customRequest={handleCustomUpload}
                      showUploadList={false}
                      multiple
                    >
                      <Button
                        icon={<UploadOutlined />}
                        loading={uploadingFiles}
                        className="text-xs"
                      >
                        Tải lên minh chứng
                      </Button>
                    </Upload>

                    {uploadedFiles.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {uploadedFiles.map((file) => (
                          <div
                            key={file.fileId}
                            className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs"
                          >
                            <a
                              href={file.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline truncate max-w-[380px]"
                            >
                              📄 {file.fileName}
                            </a>
                            <Button
                              type="text"
                              danger
                              size="small"
                              onClick={() => handleRemoveFile(file.fileId)}
                            >
                              Xóa
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Nếu không tham gia học */
                <Form.Item
                  name="notAttendedReason"
                  label="Lý do không tham gia học tập bồi dưỡng"
                  rules={[{ required: true, message: "Vui lòng nêu rõ lý do không tham gia" }]}
                >
                  <TextArea
                    rows={3}
                    placeholder="Nêu rõ lý do (Ví dụ: Trùng lịch công tác đột xuất của trường, lý do sức khỏe, khóa học bị hoãn...)"
                  />
                </Form.Item>
              )}
            </Form>
          </div>
        )}
      </Modal>

      {/* Modal Chi tiết */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-slate-800">
            <BookOutlined className="text-blue-600 text-lg" />
            <span>Chi Tiết Kế Hoạch Bồi Dưỡng</span>
          </div>
        }
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsDetailModalOpen(false)}>
            Đóng
          </Button>,
        ]}
        width={720}
        destroyOnClose
      >
        {detailRecord && (
          <div className="space-y-3.5 pt-2">
            {/* 1. THÔNG TIN CÁN BỘ / NHÂN SỰ */}
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-base text-slate-800 flex items-center gap-2">
                    <UserOutlined className="text-blue-600" />
                    {detailRecord.userName || detailRecord.user?.name}
                    {!detailRecord.userId && !detailRecord.user?._id && (
                      <Tag color="orange" className="text-[10px] font-normal m-0">
                        Chưa có tài khoản
                      </Tag>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600 mt-1">
                    Chức vụ: <b>{detailRecord.positionName || detailRecord.position?.positionName || "Cán bộ"}</b> | Đơn vị: <b>{detailRecord.departmentName || detailRecord.department?.departmentName || "NSG"}</b>
                  </div>
                  {(detailRecord.user?.email || detailRecord.user?.mobile || detailRecord.user?.phone || detailRecord.user?.phoneNumber) && (
                    <div className="text-xs text-slate-400 mt-0.5">
                      Email: {detailRecord.user?.email || "--"} | SĐT: {detailRecord.user?.mobile || detailRecord.user?.phone || detailRecord.user?.phoneNumber || "Không có"}
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
                  Năm {detailRecord.year}
                </Tag>
                <Tag color="purple" className="font-semibold text-xs m-0">
                  {detailRecord.trainingForm}
                </Tag>
              </div>
              <div>
                {detailRecord.status === "APPROVED" ? (
                  <Tag color="success" className="font-bold px-2 py-0.5 m-0">
                    ✓ Đã phê duyệt
                  </Tag>
                ) : detailRecord.status === "REJECTED" ? (
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
                  {detailRecord.trainingContent}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-100 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-500">Kinh phí dự kiến: </span>
                  <span className="font-bold text-emerald-600">
                    {(Number(detailRecord.estimatedCost) || 0).toLocaleString("vi-VN")} đ
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Nơi đào tạo: </span>
                  <span className="font-medium text-slate-800">
                    {detailRecord.trainingLocation || "Chưa xác định"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Thời gian dự kiến: </span>
                  <span className="font-medium text-slate-800">
                    {detailRecord.trainingDuration || "Theo kế hoạch"}
                    {detailRecord.startDate && detailRecord.endDate && (
                      <span className="text-slate-500 text-xs ml-1">
                        ({dayjs(detailRecord.startDate).format("DD/MM/YYYY")} - {dayjs(detailRecord.endDate).format("DD/MM/YYYY")})
                      </span>
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Người lập hồ sơ: </span>
                  <span className="font-medium text-slate-800">
                    {detailRecord.createdByUserName || detailRecord.createdByUser?.name || "Cán bộ quản lý"}
                  </span>
                </div>
              </div>

              {detailRecord.notes && (
                <div className="pt-2 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 font-semibold block mb-0.5">Ghi chú:</span>
                  <div className="p-2 bg-slate-50 rounded text-slate-700 italic whitespace-pre-wrap">
                    {detailRecord.notes}
                  </div>
                </div>
              )}
            </div>

            {/* 4. Ý KIẾN CHỈ ĐẠO CỦA CẤP PHÊ DUYỆT (NẾU CÓ) */}
            {detailRecord.managerReview?.reviewedAt && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1">
                <div className="font-bold text-amber-800 flex items-center justify-between">
                  <span>Thông tin nhân sự quản lý phê duyệt:</span>
                  <span className="text-[11px] font-normal text-amber-600">
                    {dayjs(detailRecord.managerReview.reviewedAt).format("DD/MM/YYYY HH:mm")}
                  </span>
                </div>
                <div className="text-slate-800">
                  Người duyệt: <b>{detailRecord.managerReview.reviewedByName}</b>
                </div>
                {detailRecord.managerReview.note && (
                  <div className="text-slate-700 italic bg-white/70 p-2 rounded border border-amber-200/60 mt-1">
                    "{detailRecord.managerReview.note}"
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

              {detailRecord.reportResult?.status === "REPORTED" ? (
                <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs sm:text-sm space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-2">
                    <div>
                      <span className="text-slate-500">Tình trạng: </span>
                      {detailRecord.reportResult.attended !== false ? (
                        <Tag color="success" className="font-bold m-0">✓ Đã tham gia hoàn thành</Tag>
                      ) : (
                        <Tag color="error" className="font-bold m-0">✗ Không tham gia học</Tag>
                      )}
                    </div>
                    {detailRecord.reportResult.reportedByName && (
                      <span className="text-[11px] text-slate-400">
                        Nộp bởi: {detailRecord.reportResult.reportedByName} (
                        {dayjs(detailRecord.reportResult.reportedAt).format("DD/MM/YYYY HH:mm")})
                      </span>
                    )}
                  </div>

                  {detailRecord.reportResult.attended !== false ? (
                    <>
                      <div>
                        <span className="text-slate-600 font-semibold">Kết quả đạt được: </span>
                        <span className="font-bold text-emerald-800">{detailRecord.reportResult.resultDetails || "Đạt"}</span>
                      </div>

                      {(detailRecord.reportResult.certificateNumber ||
                        detailRecord.reportResult.issueDate ||
                        detailRecord.reportResult.issuePlace ||
                        detailRecord.reportResult.actualTrainingDuration) && (
                        <div className="p-2.5 rounded bg-white border border-emerald-200 space-y-1.5 text-xs">
                          <div className="font-bold text-emerald-900 flex items-center gap-1">
                            <BookOutlined className="text-emerald-700" />
                            Thông tin Chứng chỉ / Văn bằng:
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                            <div>
                              <span className="text-slate-500">Số hiệu CC/VB: </span>
                              <b className="text-slate-800">{detailRecord.reportResult.certificateNumber || "—"}</b>
                            </div>
                            <div>
                              <span className="text-slate-500">Ngày cấp: </span>
                              <b className="text-slate-800">
                                {detailRecord.reportResult.issueDate
                                  ? dayjs(detailRecord.reportResult.issueDate).format("DD/MM/YYYY")
                                  : "—"}
                              </b>
                            </div>
                            <div>
                              <span className="text-slate-500">Nơi cấp: </span>
                              <b className="text-slate-800">{detailRecord.reportResult.issuePlace || "—"}</b>
                            </div>
                            <div>
                              <span className="text-slate-500">Thời gian đào tạo: </span>
                              <b className="text-slate-800">{detailRecord.reportResult.actualTrainingDuration || "—"}</b>
                            </div>
                          </div>
                        </div>
                      )}

                      <div>
                        <span className="text-slate-600 font-semibold">Hỗ trợ kinh phí: </span>
                        {detailRecord.reportResult.hasFundingSupport ? (
                          <span className="font-bold text-blue-700">
                            Có hỗ trợ: {(Number(detailRecord.reportResult.actualFundAmount) || 0).toLocaleString("vi-VN")} đ
                          </span>
                        ) : (
                          <span className="text-slate-500">Không nhận hỗ trợ kinh phí</span>
                        )}
                      </div>

                      {Array.isArray(detailRecord.reportResult.proofFiles) && detailRecord.reportResult.proofFiles.length > 0 && (
                        <div>
                          <span className="text-slate-600 font-semibold block mb-1">
                            Hồ sơ minh chứng đính kèm ({detailRecord.reportResult.proofFiles.length}):
                          </span>
                          <div className="divide-y border border-emerald-200 rounded-lg overflow-hidden bg-white">
                            {detailRecord.reportResult.proofFiles.map((file, idx) => (
                              <div key={file.fileId || idx} className="p-2.5 flex justify-between items-center hover:bg-emerald-50/40">
                                <div className="flex items-center gap-2 overflow-hidden mr-2">
                                  <PaperClipOutlined className="text-blue-500 flex-shrink-0" />
                                  <a
                                    href={file.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 font-medium text-xs hover:underline truncate"
                                  >
                                    {formatProofFileName(file, detailRecord, idx)}
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
                      <span className="italic text-slate-700">{detailRecord.reportResult.notAttendedReason || "Không nêu"}</span>
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
            {detailRecord.history && detailRecord.history.length > 0 && (
              <div>
                <div className="font-bold text-xs sm:text-sm text-slate-700 mb-2 flex items-center gap-1.5">
                  <HistoryOutlined className="text-blue-600" />
                  Lịch Sử Xử Lý Hồ Sơ:
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <Timeline
                    className="text-xs pt-1"
                    items={detailRecord.history.map((h) => ({
                      color:
                        h.action?.includes("phê duyệt") || h.action?.includes("APPROVED") || h.action?.includes("hoàn thành")
                          ? "green"
                          : h.action?.includes("REJECT") || h.action?.includes("Từ chối")
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

      {/* MODAL IMPORT KẾT QUẢ TỪ FILE EXCEL */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-base sm:text-lg">
            <UploadOutlined className="text-emerald-600 text-xl" />
            <span>Import Kết Quả Bồi Dưỡng Từ File Excel</span>
          </div>
        }
        open={isImportModalOpen}
        onCancel={handleCloseImportModal}
        width={720}
        footer={[
          <Button key="close" onClick={handleCloseImportModal}>
            Đóng
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={<UploadOutlined />}
            loading={importing}
            disabled={!importFile}
            onClick={handleImportResultSubmit}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Tiến hành Import
          </Button>,
        ]}
      >
        <div className="space-y-4 py-2">
          <Alert
            message="Lưu ý quan trọng khi nạp kết quả từ Excel"
            description={
              <div className="text-xs space-y-1 text-slate-600">
                <p className="m-0">
                  • <b>Cấp trưởng / Cấp phó</b>: chỉ có quyền nạp và cập nhật kết quả bồi dưỡng cho các nhân sự thuộc đơn vị mình.
                </p>
                <p className="m-0">
                  • <b>Quản lý (Manager / Admin / Mai Anh Thy)</b>: được phép nạp kết quả cho tất cả nhân sự toàn trường và kết quả sẽ tự động được phê duyệt xác nhận.
                </p>
                <p className="m-0">
                  • File mẫu đã tạo sẵn danh sách hồ sơ bồi dưỡng hợp lệ theo bộ lọc hiện tại. Đơn vị có thể cập nhật thông tin kết quả và cột <b>Minh chứng đính kèm</b> (nhập liên kết URL hoặc tên tệp minh chứng).
                </p>
              </div>
            }
            type="info"
            showIcon
            className="border-emerald-200 bg-emerald-50/70"
          />

          {/* BƯỚC 1: TẢI FILE MẪU */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                  Tải file mẫu Excel báo cáo kết quả
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Chứa danh sách hồ sơ cần báo cáo theo bộ lọc hiện tại kèm cột Minh chứng đính kèm.
                </div>
              </div>
              <Button
                icon={<DownloadOutlined />}
                loading={downloadingTemplate}
                onClick={handleDownloadResultTemplate}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 font-medium shrink-0"
              >
                Tải file mẫu Excel
              </Button>
            </div>
          </div>

          {/* BƯỚC 2: CHỌN FILE EXCEL ĐỂ IMPORT */}
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <div className="font-semibold text-slate-800 text-sm mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">2</span>
              Chọn file Excel kết quả đã điền để tải lên
            </div>
            <Upload.Dragger
              accept=".xlsx, .xls"
              maxCount={1}
              beforeUpload={(file) => {
                const isExcel =
                  file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                  file.type === "application/vnd.ms-excel" ||
                  file.name.endsWith(".xlsx") ||
                  file.name.endsWith(".xls");
                if (!isExcel) {
                  message.error("Chỉ chấp nhận file Excel (.xlsx, .xls)!");
                  return Upload.LIST_IGNORE;
                }
                setImportFile(file);
                return false;
              }}
              onRemove={() => setImportFile(null)}
              fileList={importFile ? [importFile] : []}
              className="bg-white"
            >
              <p className="ant-upload-drag-icon text-emerald-600 mb-1">
                <InboxOutlined className="text-3xl" />
              </p>
              <p className="ant-upload-text text-sm font-medium text-slate-700">
                Nhấp hoặc kéo thả file Excel vào khu vực này để tải lên
              </p>
              <p className="ant-upload-hint text-xs text-slate-400">
                Chỉ hỗ trợ file Excel định dạng .xlsx hoặc .xls (Tối đa 10MB)
              </p>
            </Upload.Dragger>
          </div>

          {/* KẾT QUẢ IMPORT NẾU CÓ */}
          {importResultSummary && (
            <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-800 text-sm">Kết quả Import:</div>
                <div className="flex items-center gap-2">
                  <Tag color="success">Thành công: {importResultSummary.successCount || 0}</Tag>
                  {importResultSummary.errorCount > 0 && (
                    <Tag color="error">Lỗi / Bỏ qua: {importResultSummary.errorCount}</Tag>
                  )}
                </div>
              </div>
              {Array.isArray(importResultSummary.errors) && importResultSummary.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 bg-white p-2 rounded border border-slate-200 text-xs text-red-600">
                  {importResultSummary.errors.map((e, idx) => (
                    <div key={idx} className="flex items-start gap-1">
                      <span className="font-semibold">Dòng {e.row}:</span>
                      <span>{e.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default TrainingResultReportPage;
