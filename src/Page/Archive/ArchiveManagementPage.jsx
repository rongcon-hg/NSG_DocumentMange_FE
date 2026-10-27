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
  UserOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { Upload, Progress, Radio } from "antd";
import * as XLSX from "xlsx";
import axiosInstance from "../../api/axiosInstance";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { extractDocumentMetadataByAI } from "../../api/documentApi";
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
  PERSONAL: { label: "Hồ sơ cá nhân", color: "cyan", icon: <UserOutlined /> },
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

  // State cho tính năng Nhập Excel Hồ sơ
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importing, setImporting] = useState(false);

  // State cho tính năng Nhập Excel Tài liệu thành phần trong hồ sơ
  const [isImportItemsModalOpen, setIsImportItemsModalOpen] = useState(false);
  const [importItemsData, setImportItemsData] = useState([]);
  const [importingItems, setImportingItems] = useState(false);

  // State bộ lọc và tìm kiếm cho tài liệu thành phần trong hồ sơ
  const [itemSearchText, setItemSearchText] = useState("");
  const [itemDateRange, setItemDateRange] = useState(null);
  const [itemTypeFilter, setItemTypeFilter] = useState(null);

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

  const [isGeneratingFolderCode, setIsGeneratingFolderCode] = useState(false);

  const fetchNextFolderCode = async () => {
    try {
      setIsGeneratingFolderCode(true);
      const res = await axiosInstance.get("/archives/next-code");
      if (res.data?.success && res.data?.nextCode) {
        form.setFieldsValue({ folderCode: res.data.nextCode });
        return res.data.nextCode;
      }
    } catch (err) {
      console.warn("Lỗi fetchNextFolderCode:", err);
      // Fallback cục bộ nếu route API gặp sự cố
      const currentYear = new Date().getFullYear();
      let maxNum = 0;
      (folders || []).forEach((f) => {
        const match = (f.folderCode || "").match(new RegExp(`^HS-?${currentYear}[/-](\\d+)`, "i"));
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) maxNum = num;
        }
      });
      const fallbackCode = `HS-${currentYear}/${String(maxNum + 1).padStart(3, "0")}`;
      form.setFieldsValue({ folderCode: fallbackCode });
      return fallbackCode;
    } finally {
      setIsGeneratingFolderCode(false);
    }
  };

  const handleOpenCreateModal = () => {
    form.resetFields();
    form.setFieldsValue({
      accessScope: "DEPARTMENT",
      academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      retentionPeriod: "10 năm",
    });
    fetchNextFolderCode();
    setIsCreateModalOpen(true);
  };

  const handleCreateFolder = async (values) => {
    try {
      const payload = {
        ...values,
        allowedDepartments: Array.isArray(values.allowedDepartments)
          ? values.allowedDepartments.filter((d) => Boolean(d))
          : [],
      };
      const res = await axiosInstance.post("/archives", payload);
      if (res.data?.success) {
        message.success("Tạo hồ sơ lưu trữ thành công!");
        setIsCreateModalOpen(false);
        form.resetFields();
        fetchFolders();
      }
    } catch (error) {
      console.error("Lỗi createFolder:", error);
      const serverMsg = error.response?.data?.message || error.response?.data?.error;
      message.error(serverMsg || "Lỗi khi tạo hồ sơ lưu trữ");
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
      const payload = {
        ...values,
        allowedDepartments: Array.isArray(values.allowedDepartments)
          ? values.allowedDepartments.filter((d) => Boolean(d))
          : [],
      };
      const res = await axiosInstance.put(`/archives/${editingFolder._id}`, payload);
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
      const serverMsg = error.response?.data?.message || error.response?.data?.error;
      message.error(serverMsg || "Lỗi khi cập nhật hồ sơ");
    }
  };

  const handleViewDetail = async (folder) => {
    try {
      setItemSearchText("");
      setItemDateRange(null);
      setItemTypeFilter(null);
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
  const [uploadedFilesList, setUploadedFilesList] = useState([]); // Hỗ trợ upload nhiều file
  const [isExtractingAi, setIsExtractingAi] = useState(false);

  // Hàm tự động quét và bóc tách thông tin văn bản bằng AI
  const handleAutoExtractMetadata = async (fileObj) => {
    if (!fileObj) return;
    try {
      setIsExtractingAi(true);
      const hideMsg = message.loading("🤖 AI đang đọc file để tự động điền số, ngày và trích yếu...", 0);
      const res = await extractDocumentMetadataByAI(fileObj);
      hideMsg();

      if (res?.success && res?.data) {
        const data = res.data;
        const patchValues = {};

        // 1. Số ký hiệu văn bản
        const docNumber = data.fullDocCode || data.docCode || data.docNum || "";
        if (docNumber) {
          patchValues.documentNumber = docNumber;
        }

        // 2. Trích yếu / Tên tài liệu
        const extractedTitle = data.shortDescription || data.title || "";
        if (extractedTitle) {
          patchValues.title = extractedTitle;
        }

        // 3. Loại văn bản
        const variantName = data.variantName || data.docVariantName || data.matchedVariantName || "";
        if (variantName) {
          patchValues.itemType = variantName;
        }

        // 4. Ngày văn bản
        if (data.issuedDate) {
          const parsedDate = dayjs(data.issuedDate);
          if (parsedDate.isValid()) {
            patchValues.date = parsedDate;
          }
        }

        // 5. Tác giả / Cơ quan ban hành (note)
        if (data.issuingUnit || data.signerName) {
          const authorInfo = [data.issuingUnit, data.signerName ? `Người ký: ${data.signerName}` : ""].filter(Boolean).join(" - ");
          if (authorInfo && !itemForm.getFieldValue("note")) {
            patchValues.note = authorInfo;
          }
        }

        itemForm.setFieldsValue(patchValues);
        message.success("✨ Đã tự động nhận diện và trích xuất thông tin văn bản thành công!");
      }
    } catch (err) {
      console.warn("Lỗi trích xuất thông tin bằng AI:", err);
      // Không chặn người dùng nếu AI quét gặp lỗi
    } finally {
      setIsExtractingAi(false);
    }
  };

  const handleCustomUpload = async ({ file, onSuccess, onError }) => {
    try {
      setUploadingFile(true);
      setUploadPercent(0);
      const { accessToken, folderId } = await getDriveToken();
      const res = await uploadFileDirectlyToDrive(file, accessToken, folderId, (percent) => {
        setUploadPercent(percent);
      });

      const fileUrl = `https://drive.google.com/file/d/${res.fileId}/view`;
      const newFileObj = {
        fileId: res.fileId,
        fileName: res.fileName || file.name,
        fileUrl,
        rawFile: file,
      };

      setUploadedFilesList((prev) => {
        const next = [...prev, newFileObj];
        // Cập nhật giá trị vào form nếu chưa có
        if (next.length === 1) {
          itemForm.setFieldsValue({
            fileUrl: newFileObj.fileUrl,
            fileId: newFileObj.fileId,
          });
          if (!itemForm.getFieldValue("title")) {
            itemForm.setFieldsValue({ title: file.name.replace(/\.[^/.]+$/, "") });
          }
        }
        return next;
      });

      onSuccess(res);
      message.success(`Đã tải lên "${file.name}" vào Google Drive!`);

      // Tự động phân tích và bóc tách thông tin văn bản bằng AI (ưu tiên file đầu tiên)
      if (uploadedFilesList.length === 0) {
        handleAutoExtractMetadata(file);
      }
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
      const newItems = files.map((selected) => ({
        fileId: selected.uid,
        fileName: selected.name,
        fileUrl: selected.fileUrl || selected.url,
      }));

      setUploadedFilesList((prev) => {
        const next = [...prev, ...newItems];
        if (next.length > 0 && !itemForm.getFieldValue("fileUrl")) {
          itemForm.setFieldsValue({
            fileUrl: next[0].fileUrl,
            fileId: next[0].fileId,
          });
        }
        if (!itemForm.getFieldValue("title")) {
          itemForm.setFieldsValue({ title: newItems[0].fileName.replace(/\.[^/.]+$/, "") });
        }
        return next;
      });

      message.success(`Đã chọn ${files.length} tài liệu từ Kho chữ ký!`);
    }
  };

  const handleRemoveUploadedFile = (indexToRemove) => {
    setUploadedFilesList((prev) => {
      const next = prev.filter((_, idx) => idx !== indexToRemove);
      if (next.length > 0) {
        itemForm.setFieldsValue({
          fileUrl: next[0].fileUrl,
          fileId: next[0].fileId,
        });
      } else {
        itemForm.setFieldsValue({
          fileUrl: "",
          fileId: "",
        });
      }
      return next;
    });
  };

  const handleAddItem = async (values) => {
    if (!selectedFolder) return;
    try {
      // Trường hợp người dùng tải nhiều tệp cùng lúc (upload nhiều file)
      if (uploadedFilesList.length > 1) {
        const itemsPayload = uploadedFilesList.map((f, idx) => ({
          title: idx === 0 && values.title ? values.title : f.fileName.replace(/\.[^/.]+$/, ""),
          itemType: values.itemType || "Văn bản",
          documentNumber: values.documentNumber || "",
          date: values.date ? values.date.toISOString() : undefined,
          pageCount: values.pageCount || 1,
          note: values.note || "",
          fileId: f.fileId || "",
          fileUrl: f.fileUrl || "",
        }));

        const res = await axiosInstance.post(`/archives/${selectedFolder._id}/items`, {
          items: itemsPayload,
        });

        if (res.data?.success) {
          message.success(`Đã thêm thành công ${uploadedFilesList.length} tài liệu vào hồ sơ!`);
          setIsAddItemModalOpen(false);
          itemForm.resetFields();
          setUploadedFilesList([]);
          setUploadPercent(0);
          handleViewDetail(selectedFolder);
          fetchFolders();
        }
      } else {
        // Trường hợp 1 file hoặc nhập URL trực tiếp
        const firstFile = uploadedFilesList[0];
        const payload = {
          ...values,
          date: values.date ? values.date.toISOString() : undefined,
          fileId: firstFile?.fileId || values.fileId || "",
          fileUrl: values.fileUrl || firstFile?.fileUrl || "",
        };
        const res = await axiosInstance.post(`/archives/${selectedFolder._id}/items`, payload);
        if (res.data?.success) {
          message.success("Đã thêm tài liệu vào hồ sơ!");
          setIsAddItemModalOpen(false);
          itemForm.resetFields();
          setUploadedFilesList([]);
          setUploadPercent(0);
          handleViewDetail(selectedFolder);
          fetchFolders();
        }
      }
    } catch (error) {
      console.error("Lỗi addItem:", error);
      message.error(error.response?.data?.message || "Lỗi khi thêm tài liệu vào hồ sơ");
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
        { "Mục hướng dẫn": "Phạm vi truy cập", "Quy định / Giá trị hợp lệ": "Hồ sơ cá nhân (hoặc PERSONAL), Đơn vị nội bộ (hoặc DEPARTMENT), Toàn trường (hoặc PUBLIC), Chỉ định (hoặc RESTRICTED)" },
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

  // Hàm tải file mẫu Excel cho Danh mục tài liệu thành phần
  const handleDownloadItemsTemplateExcel = () => {
    try {
      const templateData = [
        {
          STT: 1,
          "Số, Ký hiệu": "12/QĐ-NSG",
          "Ngày văn bản": "15/01/2026",
          "Trích yếu / Tên tài liệu (*)": "Quyết định về việc ban hành quy chế đào tạo",
          "Loại văn bản": "Quyết định",
          "Số tờ / Số trang": 5,
          "Tác giả / Cơ quan ban hành": "Hiệu trưởng",
          "Đường dẫn file (Link Google Drive)": "https://drive.google.com/file/d/...",
          "Ghi chú": "Bản chính",
        },
        {
          STT: 2,
          "Số, Ký hiệu": "45/BC-ĐT",
          "Ngày văn bản": "20/01/2026",
          "Trích yếu / Tên tài liệu (*)": "Báo cáo tổng kết công tác tuyển sinh năm 2025",
          "Loại văn bản": "Báo cáo",
          "Số tờ / Số trang": 12,
          "Tác giả / Cơ quan ban hành": "Phòng Đào tạo",
          "Đường dẫn file (Link Google Drive)": "",
          "Ghi chú": "Bản sao y",
        },
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      ws["!cols"] = [
        { wch: 6 },  // STT
        { wch: 18 }, // Số, Ký hiệu
        { wch: 15 }, // Ngày văn bản
        { wch: 45 }, // Trích yếu
        { wch: 18 }, // Loại văn bản
        { wch: 12 }, // Số tờ
        { wch: 25 }, // Tác giả
        { wch: 35 }, // Đường dẫn file
        { wch: 25 }, // Ghi chú
      ];

      const guideData = [
        { "Cột dữ liệu": "Trích yếu / Tên tài liệu (*)", "Quy định": "Bắt buộc nhập, tên hoặc nội dung tóm tắt văn bản" },
        { "Cột dữ liệu": "Số, Ký hiệu", "Quy định": "Ví dụ: 12/QĐ-NSG, 45/BC-ĐT" },
        { "Cột dữ liệu": "Ngày văn bản", "Quy định": "Định dạng ngày DD/MM/YYYY (ví dụ: 15/01/2026 hoặc 2026-01-15)" },
        { "Cột dữ liệu": "Loại văn bản", "Quy định": "Quyết định, Công văn, Tờ trình, Kế hoạch, Báo cáo, Biên bản, Thông báo, Hợp đồng, v.v." },
        { "Cột dữ liệu": "Số tờ / Số trang", "Quy định": "Nhập số nguyên dương (mặc định là 1 nếu để trống)" },
        { "Cột dữ liệu": "Đường dẫn file", "Quy định": "Link Google Drive hoặc link tải file tài liệu đính kèm (nếu có)" },
      ];
      const wsGuide = XLSX.utils.json_to_sheet(guideData);
      wsGuide["!cols"] = [{ wch: 25 }, { wch: 65 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mau_Tai_Lieu");
      XLSX.utils.book_append_sheet(wb, wsGuide, "Huong_Dan");

      XLSX.writeFile(wb, `Mau_Tai_Lieu_Thanh_Phan_${selectedFolder?.folderCode || "Ho_So"}.xlsx`);
      message.success("Đã tải xuống file mẫu tài liệu thành phần!");
    } catch (e) {
      console.error("Lỗi tạo template tài liệu:", e);
      message.error("Lỗi khi tạo file mẫu tài liệu Excel");
    }
  };

  // Hàm đọc file Excel tài liệu thành phần
  const handleUploadItemsExcelFile = (file) => {
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

        const parsed = json.map((row, index) => {
          const rowNum = index + 1;
          const title = String(
            row["Trích yếu / Tên tài liệu (*)"] ||
              row["Trích yếu / Tên tài liệu"] ||
              row["Trích yếu"] ||
              row["Tên tài liệu"] ||
              row["title"] ||
              ""
          ).trim();
          const documentNumber = String(
            row["Số, Ký hiệu"] || row["Số ký hiệu"] || row["Số / Ký hiệu văn bản"] || row["documentNumber"] || ""
          ).trim();
          const rawDate = row["Ngày văn bản"] || row["Ngày"] || row["date"] || "";
          let parsedDate = null;
          if (rawDate) {
            if (typeof rawDate === "number") {
              // Excel serial number date
              const jsDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
              parsedDate = dayjs(jsDate);
            } else {
              const strDate = String(rawDate).trim();
              if (strDate.includes("/")) {
                const parts = strDate.split("/");
                if (parts.length === 3) {
                  parsedDate = dayjs(`${parts[2]}-${parts[1]}-${parts[0]}`);
                } else {
                  parsedDate = dayjs(strDate);
                }
              } else {
                parsedDate = dayjs(strDate);
              }
            }
          }
          const itemType = String(
            row["Loại văn bản"] || row["Loại"] || row["itemType"] || "Văn bản"
          ).trim();
          const pageCount = Number(row["Số tờ / Số trang"] || row["Số trang"] || row["Số tờ"] || row["pageCount"] || 1);
          const author = String(
            row["Tác giả / Cơ quan ban hành"] || row["Tác giả"] || row["Cơ quan ban hành"] || row["author"] || ""
          ).trim();
          const fileUrl = String(
            row["Đường dẫn file (Link Google Drive)"] || row["Đường dẫn file"] || row["Link file"] || row["fileUrl"] || ""
          ).trim();
          const note = String(row["Ghi chú"] || row["note"] || "").trim();

          const errors = [];
          if (!title) {
            errors.push("Thiếu trích yếu / tên tài liệu");
          }

          return {
            key: rowNum,
            rowNum,
            title,
            documentNumber,
            date: parsedDate && parsedDate.isValid() ? parsedDate.format("YYYY-MM-DD") : "",
            displayDate: parsedDate && parsedDate.isValid() ? parsedDate.format("DD/MM/YYYY") : (rawDate ? String(rawDate) : "-"),
            itemType: itemType || "Văn bản",
            pageCount: !isNaN(pageCount) && pageCount > 0 ? pageCount : 1,
            author,
            fileUrl,
            note,
            isValid: errors.length === 0,
            errorMessage: errors.join(", "),
          };
        });

        setImportItemsData(parsed);
        setIsImportItemsModalOpen(true);
      } catch (err) {
        console.error("Lỗi đọc file Excel tài liệu:", err);
        message.error("Không thể đọc file Excel. Vui lòng kiểm tra định dạng file!");
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  // Xác nhận import tài liệu thành phần vào hồ sơ đang mở
  const handleConfirmImportItems = async () => {
    if (!selectedFolder?._id) {
      message.error("Chưa xác định hồ sơ để import tài liệu!");
      return;
    }

    const validRows = importItemsData.filter((r) => r.isValid);
    if (validRows.length === 0) {
      message.error("Không có dòng tài liệu hợp lệ nào để import!");
      return;
    }

    try {
      setImportingItems(true);
      const payload = validRows.map((r) => ({
        title: r.title,
        documentNumber: r.documentNumber,
        date: r.date || new Date(),
        itemType: r.itemType,
        pageCount: r.pageCount,
        author: r.author,
        fileUrl: r.fileUrl,
        note: r.note,
      }));

      const res = await axiosInstance.post(`/archives/${selectedFolder._id}/items/batch-import`, {
        items: payload,
      });

      if (res.data?.success) {
        message.success(res.data.message || `Đã import thành công ${validRows.length} tài liệu vào hồ sơ!`);
        setIsImportItemsModalOpen(false);
        setImportItemsData([]);
        // Cập nhật selectedFolder và danh sách hồ sơ
        if (res.data.data) {
          setSelectedFolder(res.data.data);
        } else {
          handleViewDetail(selectedFolder);
        }
        fetchFolders();
      } else {
        message.error(res.data?.message || "Lỗi khi import tài liệu");
      }
    } catch (e) {
      console.error("Lỗi batch import items:", e);
      message.error(e.response?.data?.message || "Đã xảy ra lỗi khi import tài liệu thành phần");
    } finally {
      setImportingItems(false);
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

  const filteredItems = (selectedFolder?.items || []).filter((item) => {
    if (itemTypeFilter) {
      if ((item.itemType || "Văn bản").trim().toLowerCase() !== itemTypeFilter.trim().toLowerCase()) {
        return false;
      }
    }

    if (itemSearchText) {
      const q = itemSearchText.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchDocNo = item.documentNumber?.toLowerCase().includes(q);
      const matchType = item.itemType?.toLowerCase().includes(q);
      const matchAuthor = item.author?.toLowerCase().includes(q);
      const matchNote = item.note?.toLowerCase().includes(q);
      if (!matchTitle && !matchDocNo && !matchType && !matchAuthor && !matchNote) {
        return false;
      }
    }

    if (itemDateRange && itemDateRange[0] && itemDateRange[1]) {
      if (!item.date) return false;
      const d = dayjs(item.date);
      const start = itemDateRange[0].startOf("day");
      const end = itemDateRange[1].endOf("day");
      if (d.isBefore(start) || d.isAfter(end)) {
        return false;
      }
    }

    return true;
  });

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
            label="Mã hồ sơ (Hệ thống tự động sinh theo năm)"
            rules={[{ required: true, message: "Vui lòng nhập hoặc để hệ thống tự động sinh mã hồ sơ" }]}
            tooltip="Hệ thống tự động sinh mã hồ sơ kế tiếp theo chuẩn HS-YYYY/XXX. Bạn có thể bấm nút làm mới bên cạnh để lấy lại mã mới nhất."
          >
            <Input
              placeholder="HS-2026/001"
              suffix={
                <Tooltip title="Tự động lấy lại mã hồ sơ kế tiếp">
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined spin={isGeneratingFolderCode} className="text-blue-600" />}
                    onClick={fetchNextFolderCode}
                    disabled={isGeneratingFolderCode}
                    className="p-0 h-auto"
                  />
                </Tooltip>
              }
            />
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
            <Radio.Group className="w-full">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
                <Radio.Button
                  value="DEPARTMENT"
                  className="flex items-center justify-center text-center text-xs h-9 px-1 rounded-md"
                >
                  <TeamOutlined className="mr-1 text-blue-600" /> Đơn vị nội bộ
                </Radio.Button>
                <Radio.Button
                  value="PUBLIC"
                  className="flex items-center justify-center text-center text-xs h-9 px-1 rounded-md"
                >
                  <GlobalOutlined className="mr-1 text-emerald-600" /> Toàn trường
                </Radio.Button>
                <Radio.Button
                  value="RESTRICTED"
                  className="flex items-center justify-center text-center text-xs h-9 px-1 rounded-md"
                >
                  <LockOutlined className="mr-1 text-purple-600" /> Chỉ định
                </Radio.Button>
                <Radio.Button
                  value="PERSONAL"
                  className="flex items-center justify-center text-center text-xs h-9 px-1 rounded-md"
                >
                  <UserOutlined className="mr-1 text-cyan-600" /> Hồ sơ cá nhân
                </Radio.Button>
              </div>
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

          <Form.Item
            name="accessScope"
            label="Phạm vi truy cập hồ sơ"
            tooltip="Quyết định ai có thể tra cứu và xem tài liệu trong hồ sơ này."
          >
            <Radio.Group className="w-full">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
                <Radio.Button
                  value="DEPARTMENT"
                  className="flex items-center justify-center text-center text-xs h-9 px-1 rounded-md"
                >
                  <TeamOutlined className="mr-1 text-blue-600" /> Đơn vị nội bộ
                </Radio.Button>
                <Radio.Button
                  value="PUBLIC"
                  className="flex items-center justify-center text-center text-xs h-9 px-1 rounded-md"
                >
                  <GlobalOutlined className="mr-1 text-emerald-600" /> Toàn trường
                </Radio.Button>
                <Radio.Button
                  value="RESTRICTED"
                  className="flex items-center justify-center text-center text-xs h-9 px-1 rounded-md"
                >
                  <LockOutlined className="mr-1 text-purple-600" /> Chỉ định
                </Radio.Button>
                <Radio.Button
                  value="PERSONAL"
                  className="flex items-center justify-center text-center text-xs h-9 px-1 rounded-md"
                >
                  <UserOutlined className="mr-1 text-cyan-600" /> Hồ sơ cá nhân
                </Radio.Button>
              </div>
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
            {/* Thanh công cụ thao tác trên Drawer - Tối ưu thanh công cụ chuyên nghiệp, tinh tế */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/90 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2">
                <Tooltip title="In mục lục hồ sơ (PDF/Word)">
                  <Button
                    type="primary"
                    icon={<PrinterOutlined className="text-sm" />}
                    className="bg-emerald-600 hover:bg-emerald-500 font-medium h-8 px-3 rounded-lg shadow-2xs inline-flex items-center"
                    onClick={() => {
                      setPrintTargetFolder(selectedFolder);
                      setPrintReportType("single");
                      setIsPrintModalOpen(true);
                    }}
                  >
                    <span>In mục lục</span>
                  </Button>
                </Tooltip>

                {selectedFolder?.status === "OPEN" && (
                  <>
                    <Tooltip title="Bổ sung tài liệu vào hồ sơ">
                      <Button
                        type="primary"
                        icon={<PlusOutlined className="text-sm" />}
                        onClick={() => setIsAddItemModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-500 font-medium h-8 px-3 rounded-lg shadow-2xs inline-flex items-center"
                      >
                        <span>Bổ sung tài liệu</span>
                      </Button>
                    </Tooltip>
                    <Upload
                      accept=".xlsx, .xls"
                      showUploadList={false}
                      beforeUpload={handleUploadItemsExcelFile}
                    >
                      <Tooltip title="Nhập danh mục tài liệu từ file Excel">
                        <Button
                          icon={<FileExcelOutlined className="text-emerald-600 text-sm" />}
                          className="bg-white border-slate-200 hover:border-emerald-500 text-slate-700 hover:text-emerald-700 font-medium h-8 px-3 rounded-lg shadow-2xs inline-flex items-center"
                        >
                          <span>Nhập từ Excel</span>
                        </Button>
                      </Tooltip>
                    </Upload>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                {(selectedFolder?.status === "OPEN" || ["manager", "admin"].includes(currentUserRole)) && (
                  <Tooltip title="Chỉnh sửa thông tin hồ sơ">
                    <Button
                      type="default"
                      icon={<EditOutlined className="text-amber-600 text-sm" />}
                      className="bg-white border-slate-200 hover:border-amber-400 text-slate-700 hover:text-amber-700 font-medium h-8 px-2.5 rounded-lg shadow-2xs inline-flex items-center"
                      onClick={() => handleOpenEditModal(selectedFolder)}
                    >
                      <span className="hidden sm:inline">Sửa</span>
                    </Button>
                  </Tooltip>
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
                    <Tooltip title="Xóa toàn bộ hồ sơ này">
                      <Button
                        type="default"
                        danger
                        icon={<DeleteOutlined className="text-sm" />}
                        className="bg-white border-slate-200 hover:border-rose-400 text-rose-600 hover:bg-rose-50/50 font-medium h-8 px-2.5 rounded-lg shadow-2xs inline-flex items-center"
                      >
                        <span className="hidden sm:inline">Xóa</span>
                      </Button>
                    </Tooltip>
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
                    <Tooltip title="Thay đổi trạng thái quy trình lưu trữ">
                      <Button
                        type="default"
                        icon={<SwapOutlined className="text-purple-600 text-sm" />}
                        className="bg-white border-slate-200 hover:border-purple-400 text-slate-700 hover:text-purple-700 font-medium h-8 px-2.5 rounded-lg shadow-2xs inline-flex items-center gap-1"
                      >
                        <span className="hidden sm:inline">Trạng thái</span>
                        <DownOutlined className="text-[10px] text-slate-400" />
                      </Button>
                    </Tooltip>
                  </Dropdown>
                )}
                {selectedFolder?.status === "OPEN" && !["manager", "admin"].includes(currentUserRole) && (
                  <Tooltip title="Nộp lưu hồ sơ về kho lưu trữ">
                    <Button
                      type="default"
                      size="small"
                      className="text-amber-600 border-amber-500 font-medium h-8 px-2.5"
                      onClick={() => handleUpdateStatus(selectedFolder._id, "SUBMITTED")}
                    >
                      Nộp lưu
                    </Button>
                  </Tooltip>
                )}
                {selectedFolder?.status === "SUBMITTED" && ["manager", "admin"].includes(currentUserRole) && (
                  <Tooltip title="Duyệt hồ sơ chính thức vào kho lưu trữ">
                    <Button
                      type="primary"
                      size="small"
                      className="bg-emerald-600 h-8 px-2.5"
                      onClick={() => handleUpdateStatus(selectedFolder._id, "ARCHIVED")}
                    >
                      Duyệt kho
                    </Button>
                  </Tooltip>
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
              <div className="font-bold text-slate-800 text-sm mb-3 flex flex-wrap items-center justify-between gap-2">
                <span>
                  Danh mục tài liệu thành phần ({selectedFolder.items?.length || 0})
                  {(itemSearchText || (itemDateRange && itemDateRange[0])) && (
                    <span className="text-blue-600 font-normal ml-2">
                      (Đang lọc: {filteredItems.length}/{selectedFolder.items?.length || 0})
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="dashed"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadItemsTemplateExcel}
                    className="text-blue-600 border-blue-400 hover:text-blue-700"
                  >
                    Tải mẫu Excel tài liệu
                  </Button>
                  {selectedFolder?.status === "OPEN" && (
                    <Upload
                      accept=".xlsx, .xls"
                      showUploadList={false}
                      beforeUpload={handleUploadItemsExcelFile}
                    >
                      <Button
                        size="small"
                        icon={<FileExcelOutlined className="text-emerald-600" />}
                        className="border-emerald-500 text-emerald-700 hover:text-emerald-800"
                      >
                        Nhập từ Excel
                      </Button>
                    </Upload>
                  )}
                </div>
              </div>

              {/* Bộ lọc & tìm kiếm tài liệu thành phần */}
              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 mb-3 flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Tìm theo trích yếu, số ký hiệu, tác giả..."
                  prefix={<SearchOutlined className="text-slate-400" />}
                  value={itemSearchText}
                  onChange={(e) => setItemSearchText(e.target.value)}
                  className="w-full sm:w-56"
                  size="small"
                  allowClear
                />
                <Select
                  placeholder="Lọc theo loại văn bản"
                  value={itemTypeFilter}
                  onChange={(val) => setItemTypeFilter(val)}
                  allowClear
                  className="w-full sm:w-44"
                  size="small"
                >
                  {Array.from(
                    new Set(
                      (selectedFolder?.items || [])
                        .map((i) => i.itemType || "Văn bản")
                        .filter(Boolean)
                    )
                  ).map((type) => (
                    <Option key={type} value={type}>
                      {type}
                    </Option>
                  ))}
                </Select>
                <DatePicker.RangePicker
                  format="DD/MM/YYYY"
                  placeholder={["Từ ngày", "Đến ngày"]}
                  value={itemDateRange}
                  onChange={(dates) => setItemDateRange(dates)}
                  className="w-full sm:w-52"
                  size="small"
                  allowClear
                />
                {(itemSearchText || itemDateRange || itemTypeFilter) && (
                  <Button
                    size="small"
                    type="link"
                    onClick={() => {
                      setItemSearchText("");
                      setItemDateRange(null);
                      setItemTypeFilter(null);
                    }}
                    className="text-slate-500 hover:text-slate-700 text-xs p-0"
                  >
                    Xóa lọc
                  </Button>
                )}
              </div>

              <Table
                dataSource={filteredItems}
                rowKey="_id"
                pagination={
                  filteredItems.length > 10
                    ? {
                        pageSize: 10,
                        size: "small",
                        showSizeChanger: true,
                        pageSizeOptions: ["10", "20", "50", "100"],
                        showLessItems: true,
                        showTotal: (total, range) => (
                          <span className="text-xs text-slate-500 hidden sm:inline">
                            {range[0]}-{range[1]} / {total}
                          </span>
                        ),
                      }
                    : false
                }
                size="small"
                bordered
                scroll={{ x: 750 }}
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
                          fixed: "right",
                          className: "bg-white",
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
                  multiple={true}
                >
                  <Button icon={<UploadOutlined />} loading={uploadingFile} className="w-full">
                    {uploadingFile ? `Đang tải lên Drive... (${uploadPercent}%)` : "Chọn một hoặc nhiều tệp từ máy tính để tải lên Drive"}
                  </Button>
                </Upload>
                {uploadingFile && <Progress percent={uploadPercent} size="small" />}

                {/* Danh sách các tệp đã tải lên */}
                {uploadedFilesList.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto mt-2">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                      <span>Đã chọn {uploadedFilesList.length} tệp đính kèm:</span>
                      {uploadedFilesList.length > 1 && (
                        <span className="text-blue-600 font-normal">Sẽ tạo đồng loạt {uploadedFilesList.length} tài liệu</span>
                      )}
                    </div>
                    {uploadedFilesList.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs text-slate-700 bg-white p-2 rounded border border-slate-200 shadow-2xs hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <CheckCircleOutlined className="text-emerald-500 shrink-0" />
                          <span className="truncate font-medium" title={f.fileName}>
                            {idx + 1}. {f.fileName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {idx === 0 && (
                            <Button
                              size="small"
                              type="link"
                              icon={<RobotOutlined />}
                              loading={isExtractingAi}
                              onClick={() => {
                                if (f.rawFile) {
                                  handleAutoExtractMetadata(f.rawFile);
                                }
                              }}
                              className="text-indigo-600 text-xs p-0"
                            >
                              AI quét
                            </Button>
                          )}
                          <Button
                            size="small"
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveUploadedFile(idx)}
                            className="p-0 h-6 w-6 flex items-center justify-center hover:bg-rose-50 rounded"
                          />
                        </div>
                      </div>
                    ))}
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
                {uploadedFilesList.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto mt-2">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Đã chọn {uploadedFilesList.length} tài liệu từ kho ký:
                    </div>
                    {uploadedFilesList.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs text-blue-700 bg-blue-50/60 p-2 rounded border border-blue-200"
                      >
                        <div className="flex items-center gap-1.5 truncate pr-2">
                          <CheckCircleOutlined className="text-blue-500 shrink-0" />
                          <span className="truncate font-medium">{f.fileName}</span>
                        </div>
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveUploadedFile(idx)}
                          className="p-0 h-6 w-6 flex items-center justify-center hover:bg-rose-50 rounded"
                        />
                      </div>
                    ))}
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

      {/* Modal Xem trước & Xác nhận Nhập danh mục tài liệu thành phần từ Excel */}
      <Modal
        title={
          <div className="flex items-center justify-between pr-6">
            <span className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <FileExcelOutlined className="text-emerald-600" />
              Xem trước Import Tài liệu vào hồ sơ: {selectedFolder?.folderCode}
            </span>
            <Button
              type="dashed"
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleDownloadItemsTemplateExcel}
              className="text-blue-600 border-blue-400 hover:text-blue-700"
            >
              Tải file mẫu Excel
            </Button>
          </div>
        }
        open={isImportItemsModalOpen}
        onCancel={() => {
          if (!importingItems) {
            setIsImportItemsModalOpen(false);
            setImportItemsData([]);
          }
        }}
        width={1000}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setIsImportItemsModalOpen(false);
              setImportItemsData([]);
            }}
            disabled={importingItems}
          >
            Hủy bỏ
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={importingItems}
            onClick={handleConfirmImportItems}
            disabled={importItemsData.filter((r) => r.isValid).length === 0}
            className="bg-emerald-600 hover:bg-emerald-500"
          >
            Import {importItemsData.filter((r) => r.isValid).length} tài liệu hợp lệ
          </Button>,
        ]}
      >
        <div className="mb-3 flex items-center justify-between text-xs sm:text-sm bg-slate-50 p-2.5 rounded border border-slate-200">
          <div className="flex items-center gap-4">
            <span>
              Tổng số dòng: <strong>{importItemsData.length}</strong>
            </span>
            <span className="text-emerald-600">
              Hợp lệ: <strong>{importItemsData.filter((r) => r.isValid).length}</strong>
            </span>
            <span className="text-rose-600">
              Không hợp lệ: <strong>{importItemsData.filter((r) => !r.isValid).length}</strong>
            </span>
          </div>
          <Upload
            accept=".xlsx, .xls"
            showUploadList={false}
            beforeUpload={handleUploadItemsExcelFile}
          >
            <Button size="small" icon={<UploadOutlined />}>
              Chọn file khác
            </Button>
          </Upload>
        </div>

        <Table
          dataSource={importItemsData}
          size="small"
          pagination={{ pageSize: 8, showTotal: (total) => `Tổng ${total} tài liệu` }}
          scroll={{ x: 850, y: 380 }}
          columns={[
            {
              title: "STT",
              dataIndex: "rowNum",
              width: 50,
              align: "center",
            },
            {
              title: "Trạng thái",
              key: "isValid",
              width: 100,
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
              title: "Số, Ký hiệu",
              dataIndex: "documentNumber",
              width: 120,
              render: (t) => t || <span className="text-slate-400 italic">Không có</span>,
            },
            {
              title: "Ngày văn bản",
              dataIndex: "displayDate",
              width: 110,
              align: "center",
            },
            {
              title: "Trích yếu / Tên tài liệu",
              dataIndex: "title",
              minWidth: 200,
              render: (t, r) => (
                <div>
                  <span className={r.isValid ? "font-medium text-slate-800" : "text-rose-500 line-through"}>
                    {t}
                  </span>
                  {r.fileUrl && (
                    <div className="text-xs text-blue-600 truncate max-w-[200px]">Link: {r.fileUrl}</div>
                  )}
                </div>
              ),
            },
            {
              title: "Loại",
              dataIndex: "itemType",
              width: 100,
              align: "center",
              render: (t) => <Tag>{t}</Tag>,
            },
            {
              title: "Số tờ",
              dataIndex: "pageCount",
              width: 70,
              align: "center",
            },
            {
              title: "Tác giả / Ban hành",
              dataIndex: "author",
              width: 130,
              ellipsis: true,
            },
            {
              title: "Lý do lỗi (nếu có)",
              dataIndex: "errorMessage",
              width: 150,
              render: (msg) => (msg ? <span className="text-rose-500 text-xs">{msg}</span> : "-"),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default ArchiveManagementPage;
