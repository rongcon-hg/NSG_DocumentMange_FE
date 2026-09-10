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
  Divider,
  AutoComplete,
  DatePicker,
  Row,
  Col,
  Upload,
  Radio,
  Timeline,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  DownloadOutlined,
  TrophyOutlined,
  UserOutlined,
  BankOutlined,
  CalendarOutlined,
  LinkOutlined,
  FilePdfOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  IdcardOutlined,
  TeamOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import dayjs from "dayjs";
import {
  getAchievements,
  getAchievementById,
  updateAchievement,
  deleteAchievement,
  deleteBatchAchievements,
  batchImportAchievements,
  getEmulationTitles,
} from "../../api/emulationApi";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { getAllPositions } from "../../api/PositionAPI";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const SCHOOL_YEARS = [
  "2026-2027",
  "2025-2026",
  "2024-2025",
  "2023-2024",
];

const COMMON_AGENCIES = [
  { value: "Trường Cao đẳng Bách khoa Nam Sài Gòn" },
  { value: "Sở Giáo dục và Đào tạo TP. Hồ Chí Minh" },
  { value: "Ủy ban Nhân dân TP. Hồ Chí Minh" },
  { value: "Bộ Lao động - Thương binh và Xã hội" },
  { value: "Bộ Giáo dục và Đào tạo" },
  { value: "Thủ tướng Chính phủ" },
  { value: "Chủ tịch nước" },
];

const EmulationAchievementListPage = () => {
  const navigate = useNavigate();

  // Thông tin user đăng nhập
  const token = Cookies.get("accessToken");
  const decodedToken = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode(token);
    } catch (e) {
      return null;
    }
  }, [token]);

  const currentUserId = decodedToken?.userId || decodedToken?._id || decodedToken?.id || Cookies.get("userId");
  const currentUserRole = decodedToken?.role;
  const isAdmin = currentUserRole === "admin";

  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Bộ lọc
  const [searchText, setSearchText] = useState("");
  const [department, setDepartment] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [dateRange, setDateRange] = useState(null);

  // Master data
  const [departments, setDepartments] = useState([]);
  const [titles, setTitles] = useState([]);
  const [positions, setPositions] = useState([]);
  const [userRoleInfo, setUserRoleInfo] = useState({});

  // Batch delete selection
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // Drawer xem chi tiết
  const [selectedItem, setSelectedItem] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Modal chỉnh sửa
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm] = Form.useForm();

  // Import Excel Modal
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [importing, setImporting] = useState(false);

  // Export Excel loading
  const [exporting, setExporting] = useState(false);

  // Tải master data
  useEffect(() => {
    const loadMaster = async () => {
      try {
        const [deptRes, titleRes, posRes] = await Promise.all([
          getAllDepartments(),
          getEmulationTitles({ activeOnly: "true" }),
          getAllPositions(),
        ]);

        const allDepts = Array.isArray(deptRes)
          ? deptRes
          : Array.isArray(deptRes?.AllDepartment)
          ? deptRes.AllDepartment
          : Array.isArray(deptRes?.departments)
          ? deptRes.departments
          : Array.isArray(deptRes?.data)
          ? deptRes.data
          : [];

        // Đơn vị "Trường" luôn nằm ở trên cùng, phía trên đơn vị "Ban Giám hiệu"
        const filteredDepts = allDepts.filter(
          (d) =>
            d &&
            d.departmentName &&
            d.departmentName.trim().toLowerCase() !== "trường" &&
            !d.departmentName.toLowerCase().includes("giải thể")
        );
        const schoolDept = {
          _id: "TRUONG",
          departmentName: "Trường",
          departmentCode: "TRUONG",
        };
        setDepartments([schoolDept, ...filteredDepts]);

        const allPositions = Array.isArray(posRes)
          ? posRes
          : Array.isArray(posRes?.AllPosition)
          ? posRes.AllPosition
          : Array.isArray(posRes?.data)
          ? posRes.data
          : [];
        setPositions(allPositions);

        if (titleRes?.success) setTitles(titleRes.data || []);
      } catch (err) {
        console.error("Lỗi tải master data:", err);
      }
    };
    loadMaster();
  }, []);

  // Tải danh sách thành tích
  const fetchAchievements = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: pageSize,
        search: searchText || undefined,
        department: department || undefined,
        targetType: targetTypeFilter || undefined,
        title: titleFilter || undefined,
        schoolYear: schoolYear || undefined,
        fromDate: dateRange && dateRange[0] ? dateRange[0].format("YYYY-MM-DD") : undefined,
        toDate: dateRange && dateRange[1] ? dateRange[1].format("YYYY-MM-DD") : undefined,
      };

      const res = await getAchievements(params);
      if (res?.success) {
        setAchievements(res.data || []);
        setTotal(res.total || 0);
        if (res.userRoleInfo) setUserRoleInfo(res.userRoleInfo);
      }
    } catch (err) {
      console.error("Lỗi fetchAchievements:", err);
      message.error(err.response?.data?.message || "Không thể tải danh sách thành tích");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchText, department, targetTypeFilter, titleFilter, schoolYear, dateRange]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  // Xóa 1 thành tích
  const handleDelete = async (id) => {
    try {
      await deleteAchievement(id);
      message.success("Xóa thành tích thành công!");
      fetchAchievements();
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi khi xóa thành tích");
    }
  };

  // Xóa danh sách hàng loạt (Admin)
  const handleBatchDelete = async () => {
    if (!selectedRowKeys || selectedRowKeys.length === 0) return;
    try {
      setLoading(true);
      const res = await deleteBatchAchievements(selectedRowKeys);
      message.success(res.message || `Đã xóa ${selectedRowKeys.length} thành tích`);
      setSelectedRowKeys([]);
      fetchAchievements();
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi khi xóa danh sách thành tích");
    } finally {
      setLoading(false);
    }
  };

  // Mở modal chỉnh sửa
  const handleOpenEdit = (record) => {
    setEditingItem(record);
    editForm.resetFields();
    editForm.setFieldsValue({
      fullName: record.fullName,
      targetType: record.targetType || "CA_NHAN",
      departmentName: record.departmentName,
      departmentId: record.department?._id || record.department,
      titleId: record.title?._id || record.title,
      titleName: record.titleName,
      achievementContent: record.achievementContent,
      decisionNumber: record.decisionNumber,
      decisionDate: record.decisionDate ? dayjs(record.decisionDate) : null,
      decisionAgency: record.decisionAgency,
      schoolYear: record.schoolYear,
      driveLink: record.driveLink,
      notes: record.notes,
    });
    setEditModalVisible(true);
  };

  // Lưu chỉnh sửa
  const handleConfirmEdit = async () => {
    try {
      const values = await editForm.validateFields();
      setEditSubmitting(true);

      let selectedTitleName = values.titleName || "";
      if (values.titleId) {
        const foundT = titles.find((t) => String(t._id) === String(values.titleId));
        if (foundT) selectedTitleName = foundT.name;
      }

      let selectedDeptName = values.departmentName || "";
      if (values.departmentId) {
        const foundD = departments.find((d) => String(d._id) === String(values.departmentId));
        if (foundD) selectedDeptName = foundD.departmentName;
      }

      const payload = {
        fullName: values.fullName,
        targetType: values.targetType || "CA_NHAN",
        departmentName: selectedDeptName,
        departmentId: values.departmentId === "TRUONG" || selectedDeptName === "Trường" ? null : (values.departmentId || null),
        titleId: values.titleId || null,
        titleName: selectedTitleName,
        achievementContent: values.achievementContent,
        decisionNumber: values.decisionNumber || "",
        decisionDate: values.decisionDate ? values.decisionDate.format("YYYY-MM-DD") : null,
        decisionAgency: values.decisionAgency || "",
        schoolYear: values.schoolYear || "",
        driveLink: values.driveLink || "",
        notes: values.notes || "",
      };

      const res = await updateAchievement(editingItem._id, payload);
      message.success("Cập nhật thành tích thành công!");
      setEditModalVisible(false);
      fetchAchievements();
      if (selectedItem && selectedItem._id === editingItem._id) {
        setSelectedItem(res?.data || { ...selectedItem, ...payload, decisionDate: values.decisionDate });
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || "Lỗi khi cập nhật thành tích");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Xuất Excel danh sách theo bộ lọc (đã có cột Loại thành tích)
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const params = {
        page: 1,
        limit: 5000,
        search: searchText || undefined,
        department: department || undefined,
        targetType: targetTypeFilter || undefined,
        title: titleFilter || undefined,
        schoolYear: schoolYear || undefined,
        fromDate: dateRange && dateRange[0] ? dateRange[0].format("YYYY-MM-DD") : undefined,
        toDate: dateRange && dateRange[1] ? dateRange[1].format("YYYY-MM-DD") : undefined,
      };

      const res = await getAchievements(params);
      const exportList = res?.success ? res.data || [] : achievements;

      if (!exportList || exportList.length === 0) {
        message.warning("Không có thành tích nào phù hợp để xuất Excel!");
        return;
      }

      const rows = exportList.map((item, idx) => ({
        "STT": idx + 1,
        "Họ và tên": item.fullName,
        "Loại thành tích": item.targetType === "TAP_THE" ? "Tập thể" : "Cá nhân",
        "Đơn vị công tác": item.departmentName || item.department?.departmentName || "",
        "Danh hiệu thi đua": item.titleName || item.title?.name || "",
        "Nội dung thành tích": item.achievementContent || "",
        "Số quyết định": item.decisionNumber || "",
        "Ngày ban hành": item.decisionDate ? dayjs(item.decisionDate).format("DD/MM/YYYY") : "",
        "Cơ quan ban hành": item.decisionAgency || "",
        "Năm học": item.schoolYear || "",
        "Link minh chứng Drive": item.driveLink || (item.attachedFiles?.[0]?.fileUrl || ""),
        "Người tạo": item.createdByName || "",
        "Ngày tạo": item.createdAt ? dayjs(item.createdAt).format("DD/MM/YYYY HH:mm") : "",
        "Ghi chú": item.notes || "",
      }));

      // Dòng tổng kết cuối bảng
      rows.push({
        "STT": "",
        "Họ và tên": "TỔNG CỘNG",
        "Loại thành tích": "",
        "Đơn vị công tác": `${exportList.length} thành tích`,
        "Danh hiệu thi đua": "",
        "Nội dung thành tích": "",
        "Số quyết định": "",
        "Ngày ban hành": "",
        "Cơ quan ban hành": "",
        "Năm học": "",
        "Link minh chứng Drive": "",
        "Người tạo": "",
        "Ngày tạo": "",
        "Ghi chú": "",
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 6 },  // STT
        { wch: 25 }, // Họ và tên
        { wch: 16 }, // Loại thành tích
        { wch: 30 }, // Đơn vị công tác
        { wch: 28 }, // Danh hiệu
        { wch: 45 }, // Nội dung thành tích
        { wch: 18 }, // Số QĐ
        { wch: 15 }, // Ngày ban hành
        { wch: 36 }, // Cơ quan ban hành
        { wch: 14 }, // Năm học
        { wch: 40 }, // Link Drive
        { wch: 20 }, // Người tạo
        { wch: 18 }, // Ngày tạo
        { wch: 25 }, // Ghi chú
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Thanh_Tich");
      const fileName = `Danh_Sach_Thanh_Tich_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      message.success(`Đã xuất thành công ${exportList.length} thành tích ra file Excel!`);
    } catch (err) {
      console.error("Lỗi xuất Excel:", err);
      message.error("Lỗi khi xuất file Excel");
    } finally {
      setExporting(false);
    }
  };

  // Tải file mẫu Excel
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          "STT": 1,
          "Họ và tên": "Nguyễn Văn A",
          "Loại thành tích": "Cá nhân",
          "Đơn vị công tác": "Khoa Công nghệ thông tin",
          "Danh hiệu thi đua": "Lao động tiên tiến",
          "Nội dung thành tích": "Hoàn thành xuất sắc nhiệm vụ giảng dạy và nghiên cứu khoa học năm học 2025-2026",
          "Số quyết định": "125/QĐ-CĐBKSG",
          "Ngày ban hành (DD/MM/YYYY)": "15/08/2026",
          "Cơ quan ban hành quyết định": "Trường Cao đẳng Bách khoa Nam Sài Gòn",
          "Link minh chứng Google Drive": "https://drive.google.com/file/d/sample-id/view",
          "Năm học": "2026-2027",
          "Ghi chú": "",
        },
        {
          "STT": 2,
          "Họ và tên": "Tập thể Khoa Điện - Điện tử",
          "Loại thành tích": "Tập thể",
          "Đơn vị công tác": "Khoa Điện - Điện tử",
          "Danh hiệu thi đua": "Tập thể lao động xuất sắc",
          "Nội dung thành tích": "Đạt thành tích xuất sắc trong công tác đào tạo và hội thi tay nghề",
          "Số quyết định": "130/QĐ-CĐBKSG",
          "Ngày ban hành (DD/MM/YYYY)": "20/08/2026",
          "Cơ quan ban hành quyết định": "Ủy ban Nhân dân TP. Hồ Chí Minh",
          "Link minh chứng Google Drive": "https://drive.google.com/file/d/sample-id-2/view",
          "Năm học": "2026-2027",
          "Ghi chú": "",
        },
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      ws["!cols"] = [
        { wch: 6 },
        { wch: 25 },
        { wch: 16 },
        { wch: 30 },
        { wch: 28 },
        { wch: 45 },
        { wch: 18 },
        { wch: 25 },
        { wch: 38 },
        { wch: 40 },
        { wch: 15 },
        { wch: 25 },
      ];
      // Sheet 2: Danh mục danh hiệu thi đua (để người dùng tra cứu, copy chính xác)
      const titlesList = (titles && titles.length > 0 ? titles : [
        { code: "LĐTT", name: "Lao động tiên tiến", level: "Cấp cơ sở" },
        { code: "CSTĐCS", name: "Chiến sĩ thi đua cơ sở", level: "Cấp cơ sở" },
        { code: "CSTĐTP", name: "Chiến sĩ thi đua cấp Thành phố", level: "Cấp Thành phố" },
        { code: "TTLĐTT", name: "Tập thể lao động tiên tiến", level: "Cấp cơ sở" },
        { code: "TTLĐXS", name: "Tập thể lao động xuất sắc", level: "Cấp Thành phố" },
        { code: "BK_UBND", name: "Bằng khen của Chủ tịch UBND Thành phố", level: "Cấp Thành phố" },
        { code: "HCLĐ_3", name: "Huân chương Lao động hạng Ba", level: "Cấp Nhà nước" },
      ]).map((t, idx) => ({
        "STT": idx + 1,
        "Mã danh hiệu": t.code || "",
        "Tên danh hiệu thi đua": t.name || "",
        "Cấp khen thưởng": t.level || "",
      }));
      const wsTitles = XLSX.utils.json_to_sheet(titlesList);
      wsTitles["!cols"] = [
        { wch: 6 },
        { wch: 16 },
        { wch: 38 },
        { wch: 22 },
      ];

      // Sheet 3: Danh mục chức vụ (để người dùng tra cứu, copy)
      const positionsList = (positions && positions.length > 0 ? positions : [
        { positionCode: "GV", positionName: "Giảng viên" },
        { positionCode: "CV", positionName: "Chuyên viên" },
        { positionCode: "TP", positionName: "Trưởng phòng" },
        { positionCode: "PP", positionName: "Phó trưởng phòng" },
        { positionCode: "TK", positionName: "Trưởng khoa" },
        { positionCode: "PK", positionName: "Phó trưởng khoa" },
        { positionCode: "HT", positionName: "Hiệu trưởng" },
        { positionCode: "PHT", positionName: "Phó Hiệu trưởng" },
      ]).map((p, idx) => ({
        "STT": idx + 1,
        "Mã chức vụ": p.positionCode || p.code || "",
        "Tên chức vụ": p.positionName || p.name || "",
      }));
      const wsPositions = XLSX.utils.json_to_sheet(positionsList);
      wsPositions["!cols"] = [
        { wch: 6 },
        { wch: 16 },
        { wch: 30 },
      ];

      // Sheet 4: Danh mục phòng ban / đơn vị (để người dùng tra cứu, copy)
      const departmentsList = (departments && departments.length > 0 ? departments : [
        { departmentCode: "TRUONG", departmentName: "Trường" },
        { departmentCode: "BGH", departmentName: "Ban Giám hiệu" },
        { departmentCode: "CNTT", departmentName: "Khoa Công nghệ thông tin" },
        { departmentCode: "DDT", departmentName: "Khoa Điện - Điện tử" },
        { departmentCode: "KT", departmentName: "Khoa Kinh tế" },
        { departmentCode: "TCHC", departmentName: "Phòng Tổ chức - Hành chính" },
        { departmentCode: "ĐT", departmentName: "Phòng Đào tạo" },
      ]).map((d, idx) => ({
        "STT": idx + 1,
        "Mã đơn vị": d.departmentCode || d.code || "",
        "Tên đơn vị / Phòng ban": d.departmentName || "",
      }));
      const wsDepartments = XLSX.utils.json_to_sheet(departmentsList);
      wsDepartments["!cols"] = [
        { wch: 6 },
        { wch: 16 },
        { wch: 38 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mau_Thanh_Tich");
      XLSX.utils.book_append_sheet(wb, wsTitles, "DM_Danh_Hieu");
      XLSX.utils.book_append_sheet(wb, wsPositions, "DM_Chuc_Vu");
      XLSX.utils.book_append_sheet(wb, wsDepartments, "DM_Phong_Ban");
      XLSX.writeFile(wb, "Mau_Danh_Sach_Thanh_Tich_Thi_Dua.xlsx");
      message.success("Đã tải xuống file mẫu Excel kèm các sheet danh mục thành công!");
    } catch (err) {
      console.error(err);
      message.error("Lỗi tải mẫu Excel");
    }
  };

  // Đọc file Excel khi import
  const handleUploadExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        if (!json || json.length === 0) {
          message.warning("File Excel không có dòng dữ liệu nào!");
          return;
        }

        const parsed = json.map((row, idx) => {
          const fullName = row["Họ và tên"] || row["Họ tên"] || row["fullName"] || "";
          const rawTargetType = row["Loại thành tích"] || row["Loại đối tượng"] || row["targetType"] || "Cá nhân";
          const targetType = String(rawTargetType).toLowerCase().includes("tập thể") || String(rawTargetType).toUpperCase() === "TAP_THE" ? "TAP_THE" : "CA_NHAN";
          const departmentName = row["Đơn vị công tác"] || row["Đơn vị"] || row["departmentName"] || "";
          const titleName = row["Loại danh hiệu thi đua"] || row["Danh hiệu thi đua"] || row["Danh hiệu"] || "";
          const achievementContent = row["Nội dung thành tích"] || row["Nội dung"] || "";
          const decisionNumber = row["Số quyết định"] || row["Số QĐ"] || "";
          const rawDate = row["Ngày ban hành (DD/MM/YYYY)"] || row["Ngày ban hành"] || row["Ngày quyết định"] || "";
          const decisionAgency = row["Cơ quan ban hành quyết định"] || row["Cơ quan ban hành"] || "";
          const driveLink = row["Link minh chứng Google Drive"] || row["Link minh chứng"] || row["Minh chứng"] || "";
          const schoolYearVal = row["Năm học"] || "2026-2027";
          const notes = row["Ghi chú"] || "";

          let isValid = true;
          const errors = [];
          if (!fullName.trim()) {
            isValid = false;
            errors.push("Thiếu Họ tên");
          }
          if (!departmentName.trim()) {
            isValid = false;
            errors.push("Thiếu Đơn vị");
          }
          if (!achievementContent.trim()) {
            isValid = false;
            errors.push("Thiếu Nội dung");
          }

          return {
            key: idx,
            stt: idx + 1,
            fullName,
            targetType,
            departmentName,
            titleName,
            achievementContent,
            decisionNumber,
            decisionDate: rawDate,
            decisionAgency,
            driveLink,
            schoolYear: schoolYearVal,
            notes,
            isValid,
            errors,
          };
        });

        setPreviewData(parsed);
        setImportModalVisible(true);
      } catch (err) {
        console.error("Lỗi đọc file Excel:", err);
        message.error("Lỗi đọc file Excel!");
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  // Xác nhận nhập từ Excel
  const handleConfirmImport = async () => {
    const validRows = previewData.filter((r) => r.isValid);
    if (validRows.length === 0) {
      message.error("Không có dòng hợp lệ!");
      return;
    }

    try {
      setImporting(true);
      const items = validRows.map((r) => ({
        fullName: r.fullName,
        targetType: r.targetType,
        departmentName: r.departmentName,
        titleName: r.titleName,
        achievementContent: r.achievementContent,
        decisionNumber: r.decisionNumber,
        decisionDate: r.decisionDate,
        decisionAgency: r.decisionAgency,
        driveLink: r.driveLink,
        schoolYear: r.schoolYear,
        notes: r.notes,
      }));

      const res = await batchImportAchievements(items);
      if (res?.success) {
        message.success(res.message || `Đã nhập thành công ${res.count} thành tích!`);
        setImportModalVisible(false);
        setPreviewData([]);
        fetchAchievements();
      }
    } catch (err) {
      console.error("Lỗi import Excel:", err);
      message.error(err.response?.data?.message || "Lỗi khi nhập danh sách từ Excel");
    } finally {
      setImporting(false);
    }
  };

  // Cột bảng tra cứu thành tích
  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 50,
      align: "center",
      render: (_, __, index) => (page - 1) * pageSize + index + 1,
    },
    {
      title: "Cá nhân hoặc tập thể",
      dataIndex: "targetType",
      key: "targetType",
      width: 120,
      align: "center",
      render: (type) =>
        type === "TAP_THE" ? (
          <Tag color="purple" className="font-medium">
            <TeamOutlined className="mr-1" /> Tập thể
          </Tag>
        ) : (
          <Tag color="blue" className="font-medium">
            <UserOutlined className="mr-1" /> Cá nhân
          </Tag>
        ),
    },
    {
      title: "Đơn vị / Họ tên",
      key: "unitAndFullName",
      width: 200,
      render: (_, record) => (
        <div>
          <div className="font-semibold text-gray-800 flex items-center gap-1.5">
            {record.targetType === "TAP_THE" ? (
              <TeamOutlined className="text-purple-600 text-xs" />
            ) : (
              <UserOutlined className="text-blue-500 text-xs" />
            )}
            <span>{record.fullName}</span>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
            <BankOutlined className="text-gray-400" />
            <span>{record.departmentName || record.department?.departmentName || "--"}</span>
          </div>
        </div>
      ),
    },
    {
      title: "Danh hiệu thi đua",
      key: "title",
      width: 170,
      render: (_, record) => {
        const tName = record.titleName || record.title?.name;
        if (!tName) return <Text type="secondary">--</Text>;
        return (
          <Tag color="gold" className="font-medium flex items-center w-fit">
            <TrophyOutlined className="mr-1 text-yellow-600" />
            {tName}
          </Tag>
        );
      },
    },
    {
      title: "Nội dung thành tích",
      dataIndex: "achievementContent",
      key: "achievementContent",
      minWidth: 180,
      render: (content) => (
        <Paragraph
          ellipsis={{ rows: 2, expandable: true, symbol: "xem thêm" }}
          className="!mb-0 text-sm text-gray-700"
        >
          {content}
        </Paragraph>
      ),
    },
    {
      title: "Quyết định công nhận",
      dataIndex: "decisionNumber",
      key: "decisionNumber",
      width: 140,
      render: (num) =>
        num ? (
          <span className="font-semibold text-blue-700">{num}</span>
        ) : (
          <Text type="secondary" className="text-xs italic">Chưa cập nhật</Text>
        ),
    },
    {
      title: "Ngày ban hành",
      dataIndex: "decisionDate",
      key: "decisionDate",
      width: 110,
      align: "center",
      render: (d) =>
        d ? (
          <span className="text-xs text-gray-700 font-medium">
            {dayjs(d).format("DD/MM/YYYY")}
          </span>
        ) : (
          <Text type="secondary" className="text-xs italic">--</Text>
        ),
    },
    {
      title: "Cơ quan ban hành",
      dataIndex: "decisionAgency",
      key: "decisionAgency",
      width: 160,
      render: (agency) =>
        agency ? (
          <span className="text-xs text-gray-700 font-medium">{agency}</span>
        ) : (
          <Text type="secondary" className="text-xs italic">--</Text>
        ),
    },
    {
      title: "Minh chứng",
      key: "evidence",
      width: 110,
      align: "center",
      render: (_, record) => {
        const driveUrl = record.driveLink || record.attachedFiles?.[0]?.fileUrl;
        if (driveUrl) {
          return (
            <Tooltip title="Mở link minh chứng Google Drive">
              <a
                href={driveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 bg-blue-50 rounded border border-blue-200"
              >
                <LinkOutlined /> Xem Drive
              </a>
            </Tooltip>
          );
        }
        if (record.attachedFiles && record.attachedFiles.length > 0) {
          return (
            <Tooltip title="Xem tệp đính kèm">
              <Button
                size="small"
                type="dashed"
                icon={<FilePdfOutlined className="text-red-500" />}
                onClick={() => {
                  setSelectedItem(record);
                  setDrawerVisible(true);
                }}
              >
                {record.attachedFiles.length} tệp
              </Button>
            </Tooltip>
          );
        }
        return <Text type="secondary" className="text-xs italic">Không có</Text>;
      },
    },
    {
      title: "Thao tác",
      key: "action",
      width: 100,
      align: "center",
      render: (_, record) => {
        const isOwner =
          String(record.createdBy?._id || record.createdBy) === String(currentUserId) ||
          String(record.user?._id || record.user) === String(currentUserId);
        const canEdit = isAdmin || currentUserRole === "manager" || isOwner;
        const canDelete = isAdmin || isOwner;

        return (
          <Space size="small">
            <Tooltip title="Xem chi tiết">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined className="text-blue-600" />}
                onClick={() => {
                  setSelectedItem(record);
                  setDrawerVisible(true);
                }}
              />
            </Tooltip>

            {canEdit && (
              <Tooltip title="Chỉnh sửa">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined className="text-amber-500" />}
                  onClick={() => handleOpenEdit(record)}
                />
              </Tooltip>
            )}

            {canDelete && (
              <Tooltip title="Xóa thành tích">
                <Popconfirm
                  title="Xóa thành tích này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleDelete(record._id)}
                >
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="w-full px-2 sm:px-4 py-3">
      <Card className="shadow-sm border-gray-200">
        {/* HEADER & ACTION BUTTONS */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-gray-100">
          <div>
            <Title level={4} className="!mb-1 flex items-center gap-2 text-blue-700">
              <TrophyOutlined className="text-yellow-500 text-xl" />
              Tra Cứu Thành Tích Thi Đua - Khen Thưởng
            </Title>
            <Text type="secondary">
              {userRoleInfo.canViewAll
                ? "Quản trị viên & Ban Giám hiệu: Tra cứu và quản lý toàn bộ thành tích khen thưởng của nhà trường"
                : userRoleInfo.isCapTruongOrPho
                ? `Cấp trưởng/phó: Tra cứu thành tích khen thưởng của đơn vị ${userRoleInfo.userDepartmentName || ""}`
                : "Chuyên viên: Tra cứu các thành tích khen thưởng của cá nhân mình"}
            </Text>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center mt-2 sm:mt-0">
            {isAdmin && selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`Xóa ${selectedRowKeys.length} thành tích đã chọn?`}
                description="Thao tác này sẽ xóa vĩnh viễn dữ liệu thành tích đã chọn."
                okText="Xóa danh sách"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
                onConfirm={handleBatchDelete}
              >
                <Tooltip title={`Xóa ${selectedRowKeys.length} thành tích đã chọn`} placement="top">
                  <Button
                    danger
                    type="primary"
                    icon={<DeleteOutlined className="text-base" />}
                    className="flex items-center justify-center h-9 px-2.5 rounded-lg shadow-sm"
                  >
                    <span className="ml-1 text-xs font-semibold">{selectedRowKeys.length}</span>
                  </Button>
                </Tooltip>
              </Popconfirm>
            )}

            <Tooltip title="Làm mới danh sách" placement="top">
              <Button
                icon={<ReloadOutlined className="text-base text-gray-600" />}
                onClick={fetchAchievements}
                loading={loading}
                className="flex items-center justify-center h-9 w-9 p-0 rounded-lg shadow-sm"
              />
            </Tooltip>

            <Tooltip title="Xuất toàn bộ danh sách ra file Excel" placement="top">
              <Button
                icon={<FileExcelOutlined className="text-base text-emerald-600" />}
                onClick={handleExportExcel}
                loading={exporting}
                className="flex items-center justify-center h-9 w-9 p-0 bg-white hover:bg-emerald-50 border-emerald-300 hover:border-emerald-500 rounded-lg shadow-sm transition-all"
              />
            </Tooltip>

            <Tooltip title="Tải file mẫu Excel" placement="top">
              <Button
                icon={<DownloadOutlined className="text-base text-emerald-600" />}
                onClick={handleDownloadTemplate}
                className="flex items-center justify-center h-9 w-9 p-0 bg-white hover:bg-emerald-50 border-emerald-300 hover:border-emerald-500 rounded-lg shadow-sm transition-all"
              />
            </Tooltip>

            <Tooltip title="Nhập danh sách từ Excel (.xlsx, .xls)" placement="top">
              <Upload
                accept=".xlsx, .xls"
                showUploadList={false}
                beforeUpload={handleUploadExcel}
              >
                <Button
                  icon={<FileExcelOutlined className="text-base" />}
                  className="flex items-center justify-center h-9 w-9 p-0 bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-lg shadow-sm transition-all"
                />
              </Upload>
            </Tooltip>

            <Tooltip title="Thêm mới thành tích" placement="top">
              <Button
                type="primary"
                icon={<PlusOutlined className="text-base" />}
                onClick={() => navigate("/emulation/achievements/add")}
                className="flex items-center justify-center h-9 w-9 p-0 bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all"
              />
            </Tooltip>
          </div>
        </div>

        {/* THANH BỘ LỌC TÌM KIẾM THÔNG MINH */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="md:col-span-2">
            <Text className="text-xs text-gray-500 block mb-1">Tìm kiếm từ khóa:</Text>
            <Input
              placeholder="Nhập họ tên, nội dung, số QĐ, cơ quan..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={fetchAchievements}
              allowClear
            />
          </div>

          <div>
            <Text className="text-xs text-gray-500 block mb-1">Loại thành tích:</Text>
            <Select
              className="w-full"
              placeholder="Tất cả loại"
              value={targetTypeFilter || undefined}
              onChange={setTargetTypeFilter}
              allowClear
            >
              <Select.Option value="CA_NHAN">Cá nhân</Select.Option>
              <Select.Option value="TAP_THE">Tập thể</Select.Option>
            </Select>
          </div>

          <div>
            <Text className="text-xs text-gray-500 block mb-1">Đơn vị công tác:</Text>
            <Select
              className="w-full"
              showSearch
              placeholder="Tất cả đơn vị"
              value={department || undefined}
              onChange={setDepartment}
              allowClear
              disabled={!userRoleInfo.canViewAll && userRoleInfo.isCapTruongOrPho}
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
              }
            >
              {departments.map((d) => (
                <Select.Option key={d._id} value={d._id}>
                  {d.departmentName}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div>
            <Text className="text-xs text-gray-500 block mb-1">Danh hiệu thi đua:</Text>
            <Select
              className="w-full"
              showSearch
              placeholder="Tất cả danh hiệu"
              value={titleFilter || undefined}
              onChange={setTitleFilter}
              allowClear
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
              }
            >
              {titles.map((t) => (
                <Select.Option key={t._id} value={t.name}>
                  {t.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div>
            <Text className="text-xs text-gray-500 block mb-1">Năm học:</Text>
            <AutoComplete
              className="w-full"
              value={schoolYear}
              onChange={setSchoolYear}
              options={SCHOOL_YEARS.map((y) => ({ value: y, label: `Năm học ${y}` }))}
              placeholder="Chọn năm học..."
              allowClear
            />
          </div>
        </div>

        {/* BẢNG DỮ LIỆU */}
        <Table
          rowKey="_id"
          onRow={(record) => ({
            onClick: (e) => {
              if (
                e.target.closest("button") ||
                e.target.closest(".ant-btn") ||
                e.target.closest("a") ||
                e.target.closest(".ant-checkbox-wrapper") ||
                e.target.closest(".ant-popover") ||
                e.target.closest(".ant-popconfirm")
              ) {
                return;
              }
              setSelectedItem(record);
              setDrawerVisible(true);
            },
            className: "cursor-pointer hover:bg-blue-50/50 transition-colors",
          })}
          rowSelection={
            isAdmin
              ? {
                  selectedRowKeys,
                  onChange: (keys) => setSelectedRowKeys(keys),
                }
              : undefined
          }
          columns={columns}
          dataSource={achievements}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
            showTotal: (totalCount) => `Tổng cộng ${totalCount} thành tích`,
          }}
          bordered
          size="middle"
          scroll={{ x: 1100 }}
        />
      </Card>

      {/* DRAWER XEM CHI TIẾT THÀNH TÍCH */}
      <Drawer
        title={
          <div className="flex items-center gap-2 text-blue-700">
            <TrophyOutlined className="text-yellow-500 text-lg" />
            <span>Chi tiết Thành tích Khen thưởng</span>
          </div>
        }
        width={680}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        destroyOnClose
      >
        {selectedItem && (
          <div className="space-y-4">
            {/* KHỐI VINH DANH */}
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Tag color="gold" className="text-sm font-semibold px-2.5 py-1">
                    <TrophyOutlined className="mr-1" />
                    {selectedItem.titleName || selectedItem.title?.name || "Thành tích thi đua"}
                  </Tag>
                  <Tag color={selectedItem.targetType === "TAP_THE" ? "purple" : "blue"}>
                    {selectedItem.targetType === "TAP_THE" ? "Tập thể" : "Cá nhân"}
                  </Tag>
                </div>
                {selectedItem.schoolYear && (
                  <Tag color="blue" className="text-xs">
                    Năm học {selectedItem.schoolYear}
                  </Tag>
                )}
              </div>
              <div className="text-lg font-bold text-gray-900 mt-1 flex items-center gap-2">
                {selectedItem.targetType === "TAP_THE" ? <TeamOutlined className="text-purple-600" /> : <UserOutlined className="text-blue-500" />}
                <span>{selectedItem.fullName}</span>
              </div>
              <div className="text-sm text-gray-600 mt-0.5 flex items-center gap-1">
                <BankOutlined /> Đơn vị: {selectedItem.departmentName || selectedItem.department?.departmentName || "Trường CĐ Bách khoa Nam Sài Gòn"}
              </div>
            </div>

            {/* NỘI DUNG THÀNH TÍCH */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <Text strong className="block mb-1 text-gray-700">
                Nội dung thành tích khen thưởng:
              </Text>
              <Paragraph className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap !mb-0">
                {selectedItem.achievementContent}
              </Paragraph>
            </div>

            {/* THÔNG TIN QUYẾT ĐỊNH */}
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200">
              <Text strong className="block mb-2 text-blue-800 flex items-center gap-1">
                <IdcardOutlined /> Quyết định khen thưởng:
              </Text>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Số quyết định:</span>{" "}
                  <b className="text-blue-700">{selectedItem.decisionNumber || "--"}</b>
                </div>
                <div>
                  <span className="text-gray-500">Ngày ban hành:</span>{" "}
                  <b>{selectedItem.decisionDate ? dayjs(selectedItem.decisionDate).format("DD/MM/YYYY") : "--"}</b>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-gray-500">Cơ quan ban hành:</span>{" "}
                  <b>{selectedItem.decisionAgency || "--"}</b>
                </div>
              </div>
            </div>

            {/* MINH CHỨNG GOOGLE DRIVE & TỆP */}
            <div className="p-3 bg-green-50/50 rounded-lg border border-green-200">
              <Text strong className="block mb-2 text-green-800 flex items-center gap-1">
                <LinkOutlined /> Minh chứng đính kèm:
              </Text>
              {selectedItem.driveLink && (
                <div className="mb-2">
                  <span className="text-xs text-gray-500 block mb-1">Đường dẫn Google Drive:</span>
                  <a
                    href={selectedItem.driveLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:underline font-medium break-all"
                  >
                    <LinkOutlined /> {selectedItem.driveLink}
                  </a>
                </div>
              )}

              {selectedItem.attachedFiles && selectedItem.attachedFiles.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  <span className="text-xs text-gray-500 block">Tệp tải lên:</span>
                  {selectedItem.attachedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 text-xs"
                    >
                      <span className="font-medium text-gray-700 flex items-center gap-1">
                        <FilePdfOutlined className="text-red-500" /> {file.fileName}
                      </span>
                      {file.fileUrl && (
                        <a
                          href={file.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Mở file
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!selectedItem.driveLink && (!selectedItem.attachedFiles || selectedItem.attachedFiles.length === 0) && (
                <Text type="secondary" className="text-xs italic">
                  Chưa có minh chứng đính kèm
                </Text>
              )}
            </div>

            {/* THÔNG TIN KHÁC */}
            {selectedItem.notes && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs">
                <span className="text-gray-500 block mb-1">Ghi chú:</span>
                <span className="text-gray-800">{selectedItem.notes}</span>
              </div>
            )}

            {/* LỊCH SỬ CHỈNH SỬA & CẬP NHẬT */}
            <div className="p-3 bg-gray-50/80 rounded-lg border border-gray-200">
              <Text strong className="block mb-2 text-gray-700 flex items-center gap-1.5 text-sm">
                <HistoryOutlined className="text-blue-600" /> Lịch sử chỉnh sửa & cập nhật:
              </Text>
              {(() => {
                const historyList =
                  selectedItem.history && selectedItem.history.length > 0
                    ? selectedItem.history
                    : [
                        {
                          action: selectedItem.source === "IMPORT_EXCEL" ? "IMPORTED" : "CREATED",
                          actorName: selectedItem.createdByName || "Cán bộ hệ thống",
                          actorRole: "Khởi tạo",
                          details:
                            selectedItem.source === "IMPORT_EXCEL"
                              ? "Nhập thành tích từ file Excel"
                              : `Tạo mới thành tích khen thưởng ${selectedItem.targetType === "TAP_THE" ? "tập thể" : "cá nhân"}`,
                          timestamp: selectedItem.createdAt || new Date(),
                        },
                      ];

                return (
                  <Timeline
                    className="mt-3 text-xs"
                    items={historyList.map((h, idx) => ({
                      key: h._id || idx,
                      color:
                        h.action === "CREATED" || h.action === "IMPORTED"
                          ? "green"
                          : h.action === "UPDATED"
                          ? "blue"
                          : "gray",
                      children: (
                        <div>
                          <div className="font-medium text-gray-800">
                            <span className="text-blue-700 font-semibold">{h.actorName || "Cán bộ"}</span>
                            {h.actorRole ? (
                              <span className="text-gray-500 font-normal"> ({h.actorRole})</span>
                            ) : null}
                            : <span className="text-gray-700 font-normal">{h.details}</span>
                          </div>
                          <div className="text-gray-400 text-xs mt-0.5">
                            {dayjs(h.timestamp).format("DD/MM/YYYY HH:mm:ss")}
                          </div>
                        </div>
                      ),
                    }))}
                  />
                );
              })()}
            </div>

            <div className="text-xs text-gray-400 pt-2">
              Người tạo: {selectedItem.createdByName || "Hệ thống"} | Ngày tạo:{" "}
              {selectedItem.createdAt ? dayjs(selectedItem.createdAt).format("DD/MM/YYYY HH:mm") : "--"}
            </div>

            <Divider />

            <div className="flex justify-end gap-2">
              <Button onClick={() => setDrawerVisible(false)}>Đóng</Button>
              {(isAdmin || String(selectedItem.createdBy?._id || selectedItem.createdBy) === String(currentUserId)) && (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => {
                    handleOpenEdit(selectedItem);
                  }}
                  style={{ backgroundColor: "#faad14" }}
                >
                  Sửa thành tích
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* MODAL CHỈNH SỬA THÀNH TÍCH */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-700">
            <EditOutlined className="text-amber-500" />
            <span>Chỉnh sửa Thông tin Thành tích</span>
          </div>
        }
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleConfirmEdit}
        confirmLoading={editSubmitting}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        width={750}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" className="mt-4">
          <Row gutter={[16, 8]}>
            <Col xs={24} md={10}>
              <Form.Item
                name="fullName"
                label="Họ và tên"
                rules={[{ required: true, message: "Họ và tên là bắt buộc" }]}
              >
                <Input placeholder="Nhập họ và tên cán bộ/tập thể..." />
              </Form.Item>
            </Col>

            <Col xs={24} md={5}>
              <Form.Item name="targetType" label="Loại thành tích">
                <Radio.Group buttonStyle="solid" className="w-full flex">
                  <Radio.Button value="CA_NHAN" className="flex-1 text-center">Cá nhân</Radio.Button>
                  <Radio.Button value="TAP_THE" className="flex-1 text-center">Tập thể</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>

            <Col xs={24} md={9}>
              <Form.Item
                name="departmentName"
                label="Đơn vị công tác"
                rules={[{ required: true, message: "Đơn vị công tác là bắt buộc" }]}
              >
                <Select
                  showSearch
                  placeholder="Chọn đơn vị công tác..."
                  options={departments.map((d) => ({
                    value: d.departmentName,
                    label: d.departmentName,
                  }))}
                  onChange={(val) => {
                    const dept = departments.find((d) => d.departmentName === val);
                    editForm.setFieldsValue({
                      departmentName: val,
                      departmentId: dept && dept._id !== "TRUONG" ? dept._id : null,
                    });
                    if (val === "Trường") {
                      editForm.setFieldsValue({ targetType: "TAP_THE" });
                    }
                  }}
                  filterOption={(input, option) =>
                    (option?.label || "").toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="titleId" label="Loại danh hiệu thi đua">
                <Select
                  showSearch
                  placeholder="Chọn danh hiệu thi đua..."
                  allowClear
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {titles.map((t) => (
                    <Select.Option key={t._id} value={t._id}>
                      {t.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} md={12}>
              <Form.Item name="schoolYear" label="Năm học">
                <AutoComplete
                  options={SCHOOL_YEARS.map((y) => ({ value: y, label: `Năm học ${y}` }))}
                  placeholder="Chọn năm học..."
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name="achievementContent"
                label="Nội dung thành tích"
                rules={[{ required: true, message: "Nội dung thành tích là bắt buộc" }]}
              >
                <TextArea rows={3} placeholder="Nhập nội dung thành tích..." />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="decisionNumber" label="Số quyết định">
                <Input placeholder="Ví dụ: 125/QĐ-CĐBKSG" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={8}>
              <Form.Item name="decisionDate" label="Ngày ban hành">
                <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày" />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item name="decisionAgency" label="Cơ quan ban hành">
                <AutoComplete
                  options={COMMON_AGENCIES}
                  placeholder="Chọn hoặc tự nhập cơ quan ban hành..."
                  filterOption={(inputValue, option) =>
                    (option?.value || "").toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                  }
                />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="driveLink" label="Link minh chứng Google Drive">
                <Input prefix={<LinkOutlined />} placeholder="https://drive.google.com/..." />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item name="notes" label="Ghi chú">
                <TextArea rows={2} placeholder="Ghi chú thêm nếu có..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* MODAL PREVIEW IMPORT TỪ EXCEL */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-700">
            <FileExcelOutlined className="text-green-600 text-lg" />
            <span>Xem trước danh sách Thành tích nhập từ Excel</span>
          </div>
        }
        open={importModalVisible}
        onCancel={() => {
          if (!importing) {
            setImportModalVisible(false);
            setPreviewData([]);
          }
        }}
        width={1050}
        footer={[
          <Button key="cancel" onClick={() => setImportModalVisible(false)} disabled={importing}>
            Hủy bỏ
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={importing}
            onClick={handleConfirmImport}
            style={{ backgroundColor: "#52c41a" }}
          >
            Xác nhận nhập ({previewData.filter((r) => r.isValid).length} dòng hợp lệ)
          </Button>,
        ]}
      >
        <div className="mb-3 flex justify-between items-center">
          <Text>
            Tổng số dòng: <b>{previewData.length}</b> | Hợp lệ:{" "}
            <b className="text-green-600">{previewData.filter((r) => r.isValid).length}</b> | Lỗi:{" "}
            <b className="text-red-500">{previewData.filter((r) => !r.isValid).length}</b>
          </Text>
        </div>

        <Table
          columns={[
            { title: "STT", dataIndex: "stt", width: 50, align: "center" },
            {
              title: "Họ và tên",
              dataIndex: "fullName",
              width: 160,
              render: (t, r) => (
                <span className={r.errors.includes("Thiếu Họ tên") ? "text-red-500 font-bold" : "font-medium"}>
                  {t || "(Trống)"}
                </span>
              ),
            },
            {
              title: "Loại",
              dataIndex: "targetType",
              width: 90,
              align: "center",
              render: (t) => (t === "TAP_THE" ? <Tag color="purple">Tập thể</Tag> : <Tag color="blue">Cá nhân</Tag>),
            },
            {
              title: "Đơn vị",
              dataIndex: "departmentName",
              width: 170,
              render: (t, r) => (
                <span className={r.errors.includes("Thiếu Đơn vị") ? "text-red-500 font-bold" : ""}>
                  {t || "(Trống)"}
                </span>
              ),
            },
            { title: "Danh hiệu", dataIndex: "titleName", width: 170 },
            {
              title: "Nội dung",
              dataIndex: "achievementContent",
              width: 200,
              render: (t, r) => (
                <span className={r.errors.includes("Thiếu Nội dung") ? "text-red-500 font-bold" : ""}>
                  {t || "(Trống)"}
                </span>
              ),
            },
            { title: "Số QĐ", dataIndex: "decisionNumber", width: 110 },
            { title: "Ngày ban hành", dataIndex: "decisionDate", width: 120 },
            { title: "Link Drive", dataIndex: "driveLink", width: 140, render: (u) => u ? <a href={u} target="_blank" rel="noreferrer">Xem Link</a> : "--" },
            {
              title: "Trạng thái",
              key: "st",
              width: 120,
              align: "center",
              render: (_, r) =>
                r.isValid ? (
                  <span className="text-green-600 font-medium">Hợp lệ</span>
                ) : (
                  <span className="text-red-500 text-xs">{r.errors.join(", ")}</span>
                ),
            },
          ]}
          dataSource={previewData}
          size="small"
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1000, y: 360 }}
          bordered
        />
      </Modal>
    </div>
  );
};

export default EmulationAchievementListPage;
