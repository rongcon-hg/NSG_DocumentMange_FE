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
  Dropdown,
  DatePicker,
  AutoComplete,
} from "antd";
import {
  FolderOpenOutlined,
  PlusOutlined,
  EditOutlined,
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
  GlobalOutlined,
  LockOutlined,
  TeamOutlined,
  DownOutlined,
  SwapOutlined,
  PrinterOutlined,
  CalendarOutlined,
  FileExcelOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { Upload, Progress, Radio } from "antd";
import * as XLSX from "xlsx";
import axiosInstance from "../../api/axiosInstance";
import { getAllDepartments } from "../../api/DepartmentAPI";
import dayjs from "dayjs";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import SelectFromSignatureArchive from "../../components/SelectFromSignatureArchive";
import { getDriveToken, uploadFileDirectlyToDrive } from "../../api/driveApi";
import ArchivePrintReportModal from "../../components/Archive/ArchivePrintReportModal";

const { Option } = Select;

const RETENTION_OPTIONS = ["Vĩnh viễn", "70 năm", "50 năm", "20 năm", "10 năm", "5 năm"];
const ACCESS_SCOPE_LABELS = {
  PUBLIC: { label: "Toàn trường", color: "green", icon: <GlobalOutlined /> },
  DEPARTMENT: { label: "Đơn vị nội bộ", color: "blue", icon: <TeamOutlined /> },
  RESTRICTED: { label: "Chỉ định", color: "purple", icon: <LockOutlined /> },
};
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

const DOCUMENT_TYPE_SUGGESTIONS = [
  { value: "Văn bản" },
  { value: "Tờ trình" },
  { value: "Báo cáo" },
  { value: "Quyết định" },
  { value: "Kế hoạch" },
  { value: "Thông báo" },
  { value: "Biên bản" },
  { value: "Công văn" },
  { value: "Kết quả công việc" },
  { value: "Phụ lục / Khác" },
];

const ArchiveManagementPage = () => {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // States cho modal In báo cáo hồ sơ công việc
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printReportType, setPrintReportType] = useState("list"); // "list" | "single"
  const [printTargetFolder, setPrintTargetFolder] = useState(null);

  const [form] = Form.useForm();
  const createScope = Form.useWatch("accessScope", form) || "DEPARTMENT";
  const [editForm] = Form.useForm();
  const editScope = Form.useWatch("accessScope", editForm) || "DEPARTMENT";
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);

  const [itemForm] = Form.useForm();
  const [editItemForm] = Form.useForm();
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [dateRangeFilter, setDateRangeFilter] = useState(null);

  // State cho tính năng Nhập Excel
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importing, setImporting] = useState(false);

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
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await getAllDepartments();
      const list = res?.AllDepartment || res?.departments || res?.data || (Array.isArray(res) ? res : []);
      setDepartments(list);
    } catch (e) {
      console.error("Lỗi tải danh sách phòng ban:", e);
    }
  };

  const fetchFolders = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchKeyword) params.search = searchKeyword;
      if (statusFilter) params.status = statusFilter;
      if (dateRangeFilter && dateRangeFilter[0] && dateRangeFilter[1]) {
        params.startDate = dateRangeFilter[0].startOf("day").toISOString();
        params.endDate = dateRangeFilter[1].endOf("day").toISOString();
      }

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

  const handleOpenCreateModal = () => {
    form.resetFields();
    form.setFieldsValue({
      accessScope: "DEPARTMENT",
      academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      retentionPeriod: "10 năm",
    });
    setIsCreateModalOpen(true);
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

  const handleOpenEditModal = (folder) => {
    setEditingFolder(folder);
    const deptIds = (folder.allowedDepartments || []).map((d) => (typeof d === "object" ? d._id : d));
    editForm.setFieldsValue({
      title: folder.title,
      academicYear: folder.academicYear,
      retentionPeriod: folder.retentionPeriod,
      accessScope: folder.accessScope || "DEPARTMENT",
      allowedDepartments: deptIds,
      description: folder.description || "",
      status: folder.status || "OPEN",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateFolder = async (values) => {
    if (!editingFolder) return;
    try {
      const res = await axiosInstance.put(`/archives/${editingFolder._id}`, values);
      if (res.data?.success) {
        message.success("Cập nhật thông tin hồ sơ thành công!");
        setIsEditModalOpen(false);
        setEditingFolder(null);
        fetchFolders();
        if (selectedFolder && selectedFolder._id === editingFolder._id) {
          handleViewDetail(editingFolder);
        }
      }
    } catch (error) {
      console.error("Lỗi updateFolder:", error);
      message.error(error.response?.data?.message || "Lỗi khi cập nhật hồ sơ");
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
      const errMsg = error.response?.data?.message || "Không thể tải chi tiết hồ sơ";
      message.error(errMsg);
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
        date: values.date ? values.date.toISOString() : undefined,
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

  const handleOpenEditItem = (item) => {
    setEditingItem(item);
    editItemForm.setFieldsValue({
      title: item.title,
      itemType: item.itemType || "Document",
      documentNumber: item.documentNumber || "",
      date: item.date ? dayjs(item.date) : null,
      pageCount: item.pageCount || 1,
      fileUrl: item.fileUrl || "",
      note: item.note || "",
    });
    setIsEditItemModalOpen(true);
  };

  const handleUpdateItem = async (values) => {
    if (!selectedFolder || !editingItem) return;
    try {
      const payload = {
        ...values,
        date: values.date ? values.date.toISOString() : null,
      };
      const res = await axiosInstance.put(`/archives/${selectedFolder._id}/items/${editingItem._id}`, payload);
      if (res.data?.success) {
        message.success("Cập nhật tài liệu thành công!");
        setIsEditItemModalOpen(false);
        setEditingItem(null);
        editItemForm.resetFields();
        handleViewDetail(selectedFolder);
        fetchFolders();
      }
    } catch (error) {
      console.error("Lỗi updateItem:", error);
      message.error(error.response?.data?.message || "Lỗi khi cập nhật tài liệu");
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!selectedFolder) return;
    try {
      const res = await axiosInstance.delete(`/archives/${selectedFolder._id}/items/${itemId}`);
      if (res.data?.success) {
        message.success("Đã xóa tài liệu khỏi danh mục hồ sơ");
        handleViewDetail(selectedFolder);
        fetchFolders();
      }
    } catch (error) {
      console.error("Lỗi deleteItem:", error);
      message.error(error.response?.data?.message || "Lỗi khi xóa tài liệu khỏi hồ sơ");
    }
  };

  const handleDeleteFolder = async (folderId) => {
    try {
      const res = await axiosInstance.delete(`/archives/${folderId}`);
      if (res.data?.success) {
        message.success("Đã xóa hồ sơ lưu trữ");
        if (selectedFolder && selectedFolder._id === folderId) {
          setIsDetailDrawerOpen(false);
          setSelectedFolder(null);
        }
        fetchFolders();
      }
    } catch (error) {
      console.error("Lỗi xóa hồ sơ:", error);
      message.error(error.response?.data?.message || "Không thể xóa hồ sơ");
    }
  };

  // Hàm tải file mẫu Excel nhập danh mục hồ sơ
  const handleDownloadTemplateExcel = () => {
    try {
      const templateData = [
        {
          STT: 1,
          "Mã hồ sơ (*)": "HS-2026/001",
          "Tiêu đề hồ sơ vụ việc (*)": "Hồ sơ tuyển sinh đại học chính quy đợt 1 năm 2026",
          "Năm học / Niên khóa": "2025-2026",
          "Thời hạn bảo quản": "10 năm",
          "Tên đơn vị / Phòng ban": "Phòng Đào tạo",
          "Phạm vi truy cập": "Đơn vị nội bộ",
          "Ghi chú": "Hồ sơ gốc có chữ ký phê duyệt",
        },
        {
          STT: 2,
          "Mã hồ sơ (*)": "HS-2026/002",
          "Tiêu đề hồ sơ vụ việc (*)": "Hồ sơ đánh giá thi đua khen thưởng năm học 2025-2026",
          "Năm học / Niên khóa": "2025-2026",
          "Thời hạn bảo quản": "Vĩnh viễn",
          "Tên đơn vị / Phòng ban": "Phòng Tổ chức - Hành chính",
          "Phạm vi truy cập": "Toàn trường",
          "Ghi chú": "",
        },
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);

      // Đặt độ rộng các cột
      ws["!cols"] = [
        { wch: 6 },  // STT
        { wch: 18 }, // Mã hồ sơ
        { wch: 45 }, // Tiêu đề
        { wch: 18 }, // Năm học
        { wch: 18 }, // Thời hạn
        { wch: 28 }, // Tên đơn vị
        { wch: 18 }, // Phạm vi
        { wch: 30 }, // Ghi chú
      ];

      // Sheet hướng dẫn / danh mục phòng ban
      const deptData = departments.map((d, index) => ({
        STT: index + 1,
        "Mã phòng ban": d.departmentCode || d.code || "",
        "Tên phòng ban": d.departmentName || d.name || "",
      }));
      const wsDept = XLSX.utils.json_to_sheet(
        deptData.length > 0 ? deptData : [{ STT: 1, "Mã phòng ban": "VP", "Tên phòng ban": "Văn phòng trường" }]
      );
      wsDept["!cols"] = [{ wch: 6 }, { wch: 18 }, { wch: 35 }];

      // Sheet ghi chú quy chuẩn
      const guideData = [
        { "Mục hướng dẫn": "Mã hồ sơ (*)", "Quy định / Giá trị hợp lệ": "Bắt buộc, không được trùng lặp (ví dụ: HS-2026/001)" },
        { "Mục hướng dẫn": "Tiêu đề hồ sơ (*)", "Quy định / Giá trị hợp lệ": "Bắt buộc, tiêu đề mô tả ngắn gọn hồ sơ vụ việc" },
        { "Mục hướng dẫn": "Năm học / Niên khóa", "Quy định / Giá trị hợp lệ": "Mặc định 2025-2026 nếu để trống" },
        { "Mục hướng dẫn": "Thời hạn bảo quản", "Quy định / Giá trị hợp lệ": "Vĩnh viễn, 70 năm, 50 năm, 20 năm, 10 năm, 5 năm (mặc định 10 năm)" },
        { "Mục hướng dẫn": "Phạm vi truy cập", "Quy định / Giá trị hợp lệ": "Đơn vị nội bộ (hoặc DEPARTMENT), Toàn trường (hoặc PUBLIC), Chỉ định (hoặc RESTRICTED)" },
        { "Mục hướng dẫn": "Tên đơn vị / Phòng ban", "Quy định / Giá trị hợp lệ": "Nhập tên hoặc mã phòng ban theo danh sách sheet DM_PhongBan" },
      ];
      const wsGuide = XLSX.utils.json_to_sheet(guideData);
      wsGuide["!cols"] = [{ wch: 25 }, { wch: 65 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mau_Nhap_Ho_So");
      XLSX.utils.book_append_sheet(wb, wsDept, "DM_PhongBan");
      XLSX.utils.book_append_sheet(wb, wsGuide, "Huong_Dan");

      XLSX.writeFile(wb, "Mau_Danh_Muc_Ho_So.xlsx");
      message.success("Đã tải xuống file mẫu thành công!");
    } catch (e) {
      console.error("Lỗi tạo file mẫu Excel:", e);
      message.error("Lỗi khi tạo file mẫu Excel");
    }
  };

  // Hàm đọc và tiền xử lý file Excel
  const handleUploadExcelFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!json || json.length === 0) {
          message.warning("File Excel không có dữ liệu!");
          return;
        }

        const existingCodes = new Set(folders.map((f) => (f.folderCode || "").trim().toLowerCase()));
        const seenCodesInFile = new Set();

        const parsed = json.map((row, index) => {
          const rowNum = index + 1;
          const folderCode = String(
            row["Mã hồ sơ (*)"] || row["Mã hồ sơ"] || row["folderCode"] || row["Mã hồ sơ lưu trữ"] || ""
          ).trim();
          const title = String(
            row["Tiêu đề hồ sơ vụ việc (*)"] ||
              row["Tiêu đề hồ sơ"] ||
              row["Tiêu đề vụ việc"] ||
              row["title"] ||
              ""
          ).trim();
          const academicYear = String(
            row["Năm học / Niên khóa"] || row["Năm học"] || row["academicYear"] || "2025-2026"
          ).trim();
          const retentionPeriod = String(
            row["Thời hạn bảo quản"] || row["Thời hạn"] || row["retentionPeriod"] || "10 năm"
          ).trim();
          const department = String(
            row["Tên đơn vị / Phòng ban"] || row["Phòng ban"] || row["Đơn vị"] || row["department"] || ""
          ).trim();
          const accessScope = String(
            row["Phạm vi truy cập"] || row["Phạm vi"] || row["accessScope"] || "Đơn vị nội bộ"
          ).trim();
          const description = String(row["Ghi chú"] || row["description"] || "").trim();

          const errors = [];
          if (!folderCode) {
            errors.push("Thiếu mã hồ sơ");
          } else {
            const lowerCode = folderCode.toLowerCase();
            if (existingCodes.has(lowerCode)) {
              errors.push("Mã hồ sơ đã tồn tại trên hệ thống");
            }
            if (seenCodesInFile.has(lowerCode)) {
              errors.push("Mã hồ sơ bị trùng lặp trong file tải lên");
            }
            seenCodesInFile.add(lowerCode);
          }

          if (!title) {
            errors.push("Thiếu tiêu đề hồ sơ");
          }

          return {
            key: rowNum,
            rowNum,
            folderCode,
            title,
            academicYear: academicYear || "2025-2026",
            retentionPeriod: retentionPeriod || "10 năm",
            department,
            accessScope,
            description,
            isValid: errors.length === 0,
            errorMessage: errors.join(", "),
          };
        });

        setImportData(parsed);
        setIsImportModalOpen(true);
      } catch (err) {
        console.error("Lỗi đọc file Excel:", err);
        message.error("Không thể đọc file Excel. Vui lòng kiểm tra định dạng file!");
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // Ngăn Antd tự động upload lên action
  };

  // Hàm xác nhận import vào backend
  const handleConfirmImport = async () => {
    const validRows = importData.filter((r) => r.isValid);
    if (validRows.length === 0) {
      message.error("Không có dòng dữ liệu hợp lệ nào để import!");
      return;
    }

    try {
      setImporting(true);
      const payload = validRows.map((r) => ({
        folderCode: r.folderCode,
        title: r.title,
        academicYear: r.academicYear,
        retentionPeriod: r.retentionPeriod,
        department: r.department,
        accessScope: r.accessScope,
        description: r.description,
      }));

      const res = await axiosInstance.post("/archives/batch-import", { folders: payload });
      if (res.data?.success) {
        message.success(res.data.message || `Đã import thành công ${validRows.length} hồ sơ!`);
        setIsImportModalOpen(false);
        setImportData([]);
        fetchFolders();
      } else {
        message.error(res.data?.message || "Lỗi khi import dữ liệu");
      }
    } catch (e) {
      console.error("Lỗi batch import:", e);
      message.error(e.response?.data?.message || "Đã xảy ra lỗi khi import danh mục hồ sơ");
    } finally {
      setImporting(false);
    }
  };

  const columns = [
    {
      title: "Mã Hồ Sơ",
      dataIndex: "folderCode",
      key: "folderCode",
      width: 130,
      render: (code, record) => (
        <span 
          className="font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
          onClick={() => handleViewDetail(record)}
        >
          {code}
        </span>
      ),
    },
    {
      title: "Tiêu đề hồ sơ vụ việc",
      dataIndex: "title",
      key: "title",
      minWidth: 380,
      render: (text, record) => (
        <div className="space-y-0.5">
          <div 
            className="font-medium text-slate-800 hover:text-blue-600 cursor-pointer line-clamp-2" 
            title={text}
            onClick={() => handleViewDetail(record)}
          >
            {text}
          </div>
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
      title: "Phạm vi",
      dataIndex: "accessScope",
      key: "accessScope",
      width: 120,
      align: "center",
      render: (scope) => {
        const item = ACCESS_SCOPE_LABELS[scope] || ACCESS_SCOPE_LABELS.DEPARTMENT;
        return (
          <Tag color={item.color} icon={item.icon} className="m-0 text-xs">
            {item.label}
          </Tag>
        );
      },
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
      width: 100,
      align: "center",
      fixed: "right",
      className: "action-column-tight",
      onCell: () => ({
        style: {
          paddingLeft: "4px !important",
          paddingRight: "4px !important",
          paddingTop: "6px !important",
          paddingBottom: "6px !important",
          width: "100px",
          maxWidth: "100px",
          minWidth: "100px",
        },
      }),
      onHeaderCell: () => ({
        style: {
          paddingLeft: "4px !important",
          paddingRight: "4px !important",
          width: "100px",
          maxWidth: "100px",
          minWidth: "100px",
        },
      }),
      render: (_, record) => {
        const isAdminOrManager = ["admin", "manager"].includes(currentUserRole);
        const canEdit = record.status === "OPEN" || isAdminOrManager;
        return (
          <div className="grid grid-cols-3 gap-1 place-items-center w-[84px] mx-auto">
            <Tooltip title="Xem chi tiết & mục lục hồ sơ">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined className="text-blue-600" />}
                onClick={() => handleViewDetail(record)}
                className="hover:bg-blue-50 flex items-center justify-center p-1 h-7 w-7"
              />
            </Tooltip>
            <Tooltip title="In báo cáo / Mục lục hồ sơ (PDF/Word)">
              <Button
                type="text"
                size="small"
                icon={<PrinterOutlined className="text-emerald-600" />}
                onClick={async () => {
                  if (!record.items) {
                    try {
                      const res = await axiosInstance.get(`/archives/${record._id}`);
                      if (res.data?.success) {
                        setPrintTargetFolder(res.data.data);
                      } else {
                        setPrintTargetFolder(record);
                      }
                    } catch (e) {
                      setPrintTargetFolder(record);
                    }
                  } else {
                    setPrintTargetFolder(record);
                  }
                  setPrintReportType("single");
                  setIsPrintModalOpen(true);
                }}
                className="hover:bg-emerald-50 flex items-center justify-center p-1 h-7 w-7"
              />
            </Tooltip>
            {canEdit && (
              <Tooltip title="Chỉnh sửa hồ sơ & phạm vi truy cập">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined className="text-amber-600" />}
                  onClick={() => handleOpenEditModal(record)}
                  className="hover:bg-amber-50 flex items-center justify-center p-1 h-7 w-7"
                />
              </Tooltip>
            )}
            {isAdminOrManager && (
              <Dropdown
                menu={{
                  items: [
                    { key: "OPEN", label: "Chuyển sang: Đang thu thập (OPEN)" },
                    { key: "SUBMITTED", label: "Chuyển sang: Chờ nộp lưu (SUBMITTED)" },
                    { key: "ARCHIVED", label: "Chuyển sang: Đã vào kho (ARCHIVED)" },
                    { key: "DISCARDED", label: "Chuyển sang: Tiêu hủy (DISCARDED)", danger: true },
                  ],
                  onClick: ({ key }) => handleUpdateStatus(record._id, key),
                }}
                trigger={["click"]}
              >
                <Tooltip title="Đổi trạng thái hồ sơ">
                  <Button
                    type="text"
                    size="small"
                    icon={<SwapOutlined className="text-purple-600" />}
                    className="hover:bg-purple-50 flex items-center justify-center p-1 h-7 w-7"
                  />
                </Tooltip>
              </Dropdown>
            )}
            {record.status === "OPEN" && !isAdminOrManager && (
              <Tooltip title="Nộp lưu hồ sơ">
                <Button
                  type="text"
                  size="small"
                  className="text-amber-600 hover:bg-amber-50 text-[11px] font-semibold flex items-center justify-center p-0.5 h-7 w-7"
                  onClick={() => handleUpdateStatus(record._id, "SUBMITTED")}
                >
                  Lưu
                </Button>
              </Tooltip>
            )}
            {record.status === "SUBMITTED" && isAdminOrManager && (
              <Tooltip title="Duyệt nhập kho">
                <Button
                  type="text"
                  size="small"
                  className="text-emerald-600 hover:bg-emerald-50 text-[11px] font-semibold flex items-center justify-center p-0.5 h-7 w-7"
                  onClick={() => handleUpdateStatus(record._id, "ARCHIVED")}
                >
                  Kho
                </Button>
              </Tooltip>
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
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    className="hover:bg-red-50 flex items-center justify-center p-1 h-7 w-7"
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </div>
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
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            <Button
              icon={<PrinterOutlined className="text-emerald-600" />}
              onClick={() => {
                setPrintTargetFolder(null);
                setPrintReportType("list");
                setIsPrintModalOpen(true);
              }}
              className="border-emerald-500 text-emerald-700 hover:border-emerald-600 hover:text-emerald-800"
            >
              In báo cáo danh mục hồ sơ
            </Button>
            <Button
              icon={<DownloadOutlined className="text-blue-600" />}
              onClick={handleDownloadTemplateExcel}
              className="border-blue-500 text-blue-700 hover:border-blue-600 hover:text-blue-800"
            >
              Tải file mẫu Excel
            </Button>
            <Upload
              accept=".xlsx, .xls"
              showUploadList={false}
              beforeUpload={handleUploadExcelFile}
            >
              <Button
                icon={<FileExcelOutlined className="text-emerald-600" />}
                className="border-emerald-600 text-emerald-700 hover:text-emerald-800 hover:border-emerald-700"
              >
                Nhập từ Excel
              </Button>
            </Upload>
            <Button icon={<ReloadOutlined />} onClick={fetchFolders}>
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="bg-blue-600 hover:bg-blue-500"
              onClick={handleOpenCreateModal}
            >
              Lập hồ sơ mới
            </Button>
          </div>
        </div>

        {/* Bộ lọc tìm kiếm */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-2.5 mb-4">
          <Input
            placeholder="Tìm theo tiêu đề hoặc mã hồ sơ..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={fetchFolders}
            className="w-full sm:w-64"
            allowClear
          />
          <Select
            placeholder="Lọc theo trạng thái"
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            allowClear
            className="w-full sm:w-44"
          >
            <Option value="OPEN">Đang thu thập</Option>
            <Option value="SUBMITTED">Chờ nộp lưu</Option>
            <Option value="ARCHIVED">Đã vào kho lưu trữ</Option>
          </Select>
          <DatePicker.RangePicker
            format="DD/MM/YYYY"
            placeholder={["Từ ngày", "Đến ngày"]}
            value={dateRangeFilter}
            onChange={(dates) => setDateRangeFilter(dates)}
            className="w-full sm:w-64"
            allowClear
          />
          <Button type="primary" ghost onClick={fetchFolders} className="w-full sm:w-auto">
            Tìm kiếm
          </Button>
          {(searchKeyword || statusFilter || dateRangeFilter) && (
            <Button
              type="text"
              onClick={() => {
                setSearchKeyword("");
                setStatusFilter(null);
                setDateRangeFilter(null);
                setTimeout(() => fetchFolders(), 0);
              }}
              className="text-slate-500 hover:text-slate-700"
            >
              Đặt lại
            </Button>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
          <style>{`
            .archive-table .ant-table-cell.action-column-tight,
            .archive-table td.action-column-tight,
            .archive-table th.action-column-tight {
              padding: 4px 2px !important;
              width: 100px !important;
              max-width: 100px !important;
              min-width: 100px !important;
              text-align: center !important;
            }
          `}</style>
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

          <Form.Item
            name="accessScope"
            label="Phạm vi truy cập hồ sơ"
            initialValue="DEPARTMENT"
            tooltip="Quyết định ai có thể tra cứu và xem tài liệu trong hồ sơ này."
          >
            <Radio.Group>
              <Radio value="DEPARTMENT">Đơn vị nội bộ</Radio>
              <Radio value="PUBLIC">Công khai toàn trường</Radio>
              <Radio value="RESTRICTED">Chỉ định đơn vị</Radio>
            </Radio.Group>
          </Form.Item>

          {createScope === "RESTRICTED" && (
            <Form.Item
              name="allowedDepartments"
              label="Các đơn vị / phòng ban được phép xem"
              rules={[{ required: true, message: "Vui lòng chọn ít nhất 1 đơn vị" }]}
            >
              <Select mode="multiple" placeholder="Chọn các phòng ban được cấp quyền xem hồ sơ" allowClear>
                {departments.map((dept) => (
                  <Option key={dept._id} value={dept._id}>
                    {dept.departmentName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="description" label="Ghi chú / Mô tả nội dung hồ sơ">
            <Input.TextArea rows={3} placeholder="Ghi chú thêm về hồ sơ vụ việc..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Chỉnh sửa thông tin hồ sơ */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-slate-800 text-lg">
            <EditOutlined className="text-amber-600" />
            Chỉnh Sửa Hồ Sơ: {editingFolder?.folderCode}
          </div>
        }
        open={isEditModalOpen}
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingFolder(null);
        }}
        onOk={() => editForm.submit()}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateFolder} className="mt-4">
          <Form.Item
            name="title"
            label="Tiêu đề hồ sơ vụ việc"
            rules={[{ required: true, message: "Vui lòng nhập tiêu đề hồ sơ" }]}
          >
            <Input placeholder="Hồ sơ tổ chức..." />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="academicYear"
              label="Năm học / Niên khóa"
            >
              <Input placeholder="2025-2026" />
            </Form.Item>
            <Form.Item
              name="retentionPeriod"
              label="Thời hạn bảo quản"
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

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="accessScope"
              label="Phạm vi truy cập hồ sơ"
              tooltip="Quyết định ai có thể tra cứu và xem tài liệu trong hồ sơ này."
            >
              <Radio.Group>
                <Radio value="DEPARTMENT">Đơn vị nội bộ</Radio>
                <Radio value="PUBLIC">Toàn trường</Radio>
                <Radio value="RESTRICTED">Chỉ định</Radio>
              </Radio.Group>
            </Form.Item>

            {["admin", "manager"].includes(currentUserRole) && (
              <Form.Item
                name="status"
                label="Trạng thái hồ sơ"
                tooltip="Thay đổi trạng thái quy trình lưu trữ hồ sơ"
              >
                <Select>
                  <Option value="OPEN">Đang thu thập (OPEN)</Option>
                  <Option value="SUBMITTED">Chờ nộp lưu (SUBMITTED)</Option>
                  <Option value="ARCHIVED">Đã vào kho lưu trữ (ARCHIVED)</Option>
                  <Option value="DISCARDED">Tiêu hủy (DISCARDED)</Option>
                </Select>
              </Form.Item>
            )}
          </div>

          {editScope === "RESTRICTED" && (
            <Form.Item
              name="allowedDepartments"
              label="Các đơn vị / phòng ban được phép xem"
              rules={[{ required: true, message: "Vui lòng chọn ít nhất 1 đơn vị" }]}
            >
              <Select mode="multiple" placeholder="Chọn các phòng ban được cấp quyền xem hồ sơ" allowClear>
                {departments.map((dept) => (
                  <Option key={dept._id} value={dept._id}>
                    {dept.departmentName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="description" label="Ghi chú / Mô tả nội dung hồ sơ">
            <Input.TextArea rows={3} placeholder="Ghi chú thêm về hồ sơ vụ việc..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer Chi tiết & Mục lục hồ sơ */}
      <Drawer
        title={
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-800 pr-2">
            <FileTextOutlined className="text-blue-600 shrink-0 text-base" />
            <span className="truncate">
              Hồ sơ: <span className="text-blue-700">{selectedFolder?.folderCode}</span>
            </span>
          </div>
        }
        width={typeof window !== "undefined" && window.innerWidth < 768 ? "100%" : 780}
        open={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        styles={{
          header: { padding: "12px 16px" },
          body: { padding: "14px 16px" },
        }}
      >
        {selectedFolder && (
          <div className="space-y-4">
            {/* Thanh công cụ thao tác trên Drawer - Co giãn linh hoạt cả mobile & desktop */}
            <div className="bg-slate-100 p-2.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="primary"
                  size="small"
                  icon={<PrinterOutlined />}
                  className="bg-emerald-600 hover:bg-emerald-500 font-medium"
                  onClick={() => {
                    setPrintTargetFolder(selectedFolder);
                    setPrintReportType("single");
                    setIsPrintModalOpen(true);
                  }}
                >
                  In mục lục (PDF/Word)
                </Button>
                {selectedFolder?.status === "OPEN" && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setIsAddItemModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500"
                  >
                    Bổ sung tài liệu
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                {(selectedFolder?.status === "OPEN" || ["manager", "admin"].includes(currentUserRole)) && (
                  <Button
                    type="default"
                    size="small"
                    icon={<EditOutlined className="text-amber-600" />}
                    className="text-amber-600 border-amber-400 hover:border-amber-500"
                    onClick={() => handleOpenEditModal(selectedFolder)}
                  >
                    Sửa hồ sơ
                  </Button>
                )}
                {(selectedFolder?.status === "OPEN" || currentUserRole === "admin") && (
                  <Popconfirm
                    title="Xóa hồ sơ lưu trữ?"
                    description="Bạn chắc chắn muốn xóa toàn bộ hồ sơ này?"
                    onConfirm={() => handleDeleteFolder(selectedFolder._id)}
                    okText="Xóa"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="default"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                    >
                      Xóa hồ sơ
                    </Button>
                  </Popconfirm>
                )}
                {["manager", "admin"].includes(currentUserRole) && (
                  <Dropdown
                    menu={{
                      items: [
                        { key: "OPEN", label: "Chuyển sang: Đang thu thập (OPEN)" },
                        { key: "SUBMITTED", label: "Chuyển sang: Chờ nộp lưu (SUBMITTED)" },
                        { key: "ARCHIVED", label: "Chuyển sang: Đã vào kho (ARCHIVED)" },
                        { key: "DISCARDED", label: "Chuyển sang: Tiêu hủy (DISCARDED)", danger: true },
                      ],
                      onClick: ({ key }) => handleUpdateStatus(selectedFolder._id, key),
                    }}
                    trigger={["click"]}
                  >
                    <Button
                      type="default"
                      size="small"
                      icon={<SwapOutlined className="text-purple-600" />}
                      className="text-purple-600 border-purple-300"
                    >
                      Đổi trạng thái <DownOutlined className="text-[10px]" />
                    </Button>
                  </Dropdown>
                )}
                {selectedFolder?.status === "OPEN" && !["manager", "admin"].includes(currentUserRole) && (
                  <Button
                    type="default"
                    size="small"
                    className="text-amber-600 border-amber-500"
                    onClick={() => handleUpdateStatus(selectedFolder._id, "SUBMITTED")}
                  >
                    Nộp lưu
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
              </div>
            </div>

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
              <Descriptions.Item label="Phạm vi truy cập" span={2}>
                <Tag
                  color={ACCESS_SCOPE_LABELS[selectedFolder.accessScope]?.color || "blue"}
                  icon={ACCESS_SCOPE_LABELS[selectedFolder.accessScope]?.icon}
                >
                  {ACCESS_SCOPE_LABELS[selectedFolder.accessScope]?.label || "Đơn vị nội bộ"}
                </Tag>
                {selectedFolder.accessScope === "RESTRICTED" && selectedFolder.allowedDepartments?.length > 0 && (
                  <span className="text-xs text-slate-500 ml-2">
                    (Được phân quyền cho {selectedFolder.allowedDepartments.length} đơn vị)
                  </span>
                )}
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
                    width: 110,
                  },
                  {
                    title: "Ngày văn bản",
                    dataIndex: "date",
                    key: "date",
                    width: 105,
                    align: "center",
                    render: (d) => (d ? (
                      <span className="text-slate-700 whitespace-nowrap">
                        <CalendarOutlined className="mr-1 text-slate-400" />
                        {dayjs(d).format("DD/MM/YYYY")}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )),
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
                    width: 70,
                    align: "center",
                  },
                  ...(selectedFolder?.status === "OPEN" || ["admin", "manager"].includes(currentUserRole)
                    ? [
                        {
                          title: "Thao tác",
                          key: "itemActions",
                          width: 80,
                          align: "center",
                          render: (_, item) => (
                            <div className="flex items-center justify-center gap-1">
                              <Tooltip title="Chỉnh sửa tài liệu">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EditOutlined className="text-amber-600 text-xs" />}
                                  onClick={() => handleOpenEditItem(item)}
                                  className="hover:bg-amber-50 h-6 w-6 flex items-center justify-center p-0"
                                />
                              </Tooltip>
                              <Popconfirm
                                title="Xóa tài liệu này khỏi hồ sơ?"
                                description="Bạn chắc chắn muốn xóa tài liệu này?"
                                onConfirm={() => handleDeleteItem(item._id)}
                                okText="Xóa"
                                cancelText="Hủy"
                                okButtonProps={{ danger: true }}
                              >
                                <Tooltip title="Xóa khỏi hồ sơ">
                                  <Button
                                    type="text"
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined className="text-xs" />}
                                    className="hover:bg-red-50 h-6 w-6 flex items-center justify-center p-0"
                                  />
                                </Tooltip>
                              </Popconfirm>
                            </div>
                          ),
                        },
                      ]
                    : []),
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
            <Form.Item name="itemType" label="Loại tài liệu" initialValue="Văn bản">
              <AutoComplete
                options={DOCUMENT_TYPE_SUGGESTIONS}
                placeholder="Nhập hoặc chọn loại..."
                filterOption={(inputValue, option) =>
                  option?.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                }
              />
            </Form.Item>
            <Form.Item name="documentNumber" label="Số / Ký hiệu văn bản">
              <Input placeholder="123/BC-NSG" />
            </Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="date" label="Ngày văn bản">
              <DatePicker format="DD/MM/YYYY" placeholder="Chọn ngày văn bản" className="w-full" />
            </Form.Item>
            <Form.Item name="pageCount" label="Số tờ / Số trang" initialValue={1}>
              <Input type="number" min={1} />
            </Form.Item>
          </div>
          <Form.Item name="note" label="Ghi chú">
            <Input placeholder="Bản chính / bản sao..." />
          </Form.Item>

          {/* Phương thức đính kèm tệp - Đưa xuống dưới cùng */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-2">
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
        </Form>
      </Modal>

      {/* Modal Chỉnh sửa tài liệu trong hồ sơ */}
      <Modal
        title="Chỉnh sửa tài liệu trong hồ sơ"
        open={isEditItemModalOpen}
        onCancel={() => {
          setIsEditItemModalOpen(false);
          setEditingItem(null);
        }}
        onOk={() => editItemForm.submit()}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        width={550}
      >
        <Form form={editItemForm} layout="vertical" onFinish={handleUpdateItem} className="mt-4">
          <Form.Item
            name="title"
            label="Tên tài liệu / Trích yếu"
            rules={[{ required: true, message: "Vui lòng nhập tên tài liệu" }]}
          >
            <Input placeholder="Tờ trình về việc..., Báo cáo kết quả..." />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="itemType" label="Loại tài liệu">
              <AutoComplete
                options={DOCUMENT_TYPE_SUGGESTIONS}
                placeholder="Nhập hoặc chọn loại..."
                filterOption={(inputValue, option) =>
                  option?.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                }
              />
            </Form.Item>
            <Form.Item name="documentNumber" label="Số / Ký hiệu văn bản">
              <Input placeholder="123/BC-NSG" />
            </Form.Item>
          </div>
          <Form.Item name="fileUrl" label="Đường dẫn file đính kèm">
            <Input placeholder="https://drive.google.com/..." />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="date" label="Ngày văn bản">
              <DatePicker format="DD/MM/YYYY" placeholder="Chọn ngày văn bản" className="w-full" />
            </Form.Item>
            <Form.Item name="pageCount" label="Số tờ / Số trang">
              <Input type="number" min={1} />
            </Form.Item>
          </div>
          <Form.Item name="note" label="Ghi chú">
            <Input placeholder="Bản chính / bản sao..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal In báo cáo & Xuất biểu mẫu Hồ sơ công việc */}
      <ArchivePrintReportModal
        open={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setPrintTargetFolder(null);
        }}
        folder={printTargetFolder || selectedFolder}
        foldersList={folders}
        reportType={printReportType}
      />

      {/* Modal Xem trước & Xác nhận Nhập danh mục hồ sơ từ Excel */}
      <Modal
        title={
          <div className="flex items-center justify-between pr-6">
            <span className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <FileExcelOutlined className="text-emerald-600" />
              Xem trước dữ liệu Import Danh mục hồ sơ
            </span>
            <Button
              type="dashed"
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleDownloadTemplateExcel}
              className="text-blue-600 border-blue-400 hover:text-blue-700"
            >
              Tải file mẫu Excel
            </Button>
          </div>
        }
        open={isImportModalOpen}
        onCancel={() => {
          if (!importing) {
            setIsImportModalOpen(false);
            setImportData([]);
          }
        }}
        width={950}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setIsImportModalOpen(false);
              setImportData([]);
            }}
            disabled={importing}
          >
            Hủy bỏ
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={importing}
            onClick={handleConfirmImport}
            disabled={importData.filter((r) => r.isValid).length === 0}
            className="bg-emerald-600 hover:bg-emerald-500"
          >
            Import {importData.filter((r) => r.isValid).length} hồ sơ hợp lệ
          </Button>,
        ]}
      >
        <div className="mb-3 flex items-center justify-between text-xs sm:text-sm bg-slate-50 p-2.5 rounded border border-slate-200">
          <div className="flex items-center gap-4">
            <span>
              Tổng số dòng: <strong>{importData.length}</strong>
            </span>
            <span className="text-emerald-600">
              Hợp lệ: <strong>{importData.filter((r) => r.isValid).length}</strong>
            </span>
            <span className="text-rose-600">
              Không hợp lệ / Trùng: <strong>{importData.filter((r) => !r.isValid).length}</strong>
            </span>
          </div>
          <Upload
            accept=".xlsx, .xls"
            showUploadList={false}
            beforeUpload={handleUploadExcelFile}
          >
            <Button size="small" icon={<UploadOutlined />}>
              Chọn file khác
            </Button>
          </Upload>
        </div>

        <Table
          dataSource={importData}
          size="small"
          pagination={{ pageSize: 8, showTotal: (total) => `Tổng ${total} dòng` }}
          scroll={{ x: 800, y: 380 }}
          columns={[
            {
              title: "STT",
              dataIndex: "rowNum",
              width: 55,
              align: "center",
            },
            {
              title: "Trạng thái",
              key: "isValid",
              width: 130,
              align: "center",
              render: (_, r) =>
                r.isValid ? (
                  <Tag color="green">Hợp lệ</Tag>
                ) : (
                  <Tooltip title={r.errorMessage}>
                    <Tag color="red" icon={<ExclamationCircleOutlined />}>
                      Lỗi
                    </Tag>
                  </Tooltip>
                ),
            },
            {
              title: "Mã hồ sơ",
              dataIndex: "folderCode",
              width: 130,
              render: (t, r) => (
                <span className={r.isValid ? "font-semibold text-slate-800" : "text-red-500 line-through"}>
                  {t}
                </span>
              ),
            },
            {
              title: "Tiêu đề hồ sơ vụ việc",
              dataIndex: "title",
              width: 220,
              ellipsis: true,
            },
            {
              title: "Năm học",
              dataIndex: "academicYear",
              width: 100,
              align: "center",
            },
            {
              title: "Thời hạn",
              dataIndex: "retentionPeriod",
              width: 100,
              align: "center",
            },
            {
              title: "Đơn vị / Phòng ban",
              dataIndex: "department",
              width: 140,
              ellipsis: true,
            },
            {
              title: "Lý do lỗi (nếu có)",
              dataIndex: "errorMessage",
              width: 180,
              render: (msg) => (msg ? <span className="text-rose-500 text-xs">{msg}</span> : "-"),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default ArchiveManagementPage;
