/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Upload,
  DatePicker,
  Space,
  message,
  Alert,
  Typography,
  Divider,
  Spin,
  Tooltip,
  Modal,
  Table,
  AutoComplete,
  Row,
  Col,
  Radio,
  Tag,
} from "antd";
import {
  TrophyOutlined,
  UserOutlined,
  BankOutlined,
  FileTextOutlined,
  CalendarOutlined,
  LinkOutlined,
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  SaveOutlined,
  UnorderedListOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import {
  createAchievement,
  batchImportAchievements,
  uploadAchievementFiles,
  getEmulationTitles,
} from "../../api/emulationApi";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { getAllUsers, getUserInfo } from "../../api/auth";
import { isBghUser } from "../../utils/userClassification";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

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

const EmulationAchievementAddPage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // Phân quyền & Định danh người dùng đăng nhập từ Token
  const token = Cookies.get("accessToken");
  const decodedToken = React.useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode(token);
    } catch (e) {
      console.error("Lỗi decode token:", e);
      return null;
    }
  }, [token]);

  const currentUserId = decodedToken?.userId || decodedToken?._id || decodedToken?.id || Cookies.get("userId");
  const currentUserRole = decodedToken?.role;

  const [currentUser, setCurrentUser] = useState(null);

  const isBGH = React.useMemo(() => {
    return isBghUser(currentUser) || currentUser?.department?.departmentCode === "BGH";
  }, [currentUser]);

  const isManagerOrAdmin = currentUserRole === "manager" || currentUserRole === "admin";
  const canViewAll = isManagerOrAdmin || isBGH;
  const isCapTruongOrPho = !canViewAll && ["staff", "captruong", "cappho"].includes(currentUserRole);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [titles, setTitles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);

  // Danh sách cán bộ khả dụng để gợi ý:
  // - Cấp trưởng / cấp phó: CHỈ gợi ý nhân sự thuộc đơn vị mình
  // - Quản lý / BGH / Admin: Gợi ý tất cả nhân sự toàn trường
  const availableUsers = React.useMemo(() => {
    if (canViewAll) {
      return users;
    }

    const myDeptId = String(currentUser?.department?._id || currentUser?.department || "");
    const myDeptName = (currentUser?.department?.departmentName || "").trim().toLowerCase();

    return users.filter((u) => {
      const uDeptId = String(u.department?._id || u.department || "");
      const uDeptName = (u.department?.departmentName || "").trim().toLowerCase();
      if (myDeptId && uDeptId && myDeptId === uDeptId) return true;
      if (myDeptName && uDeptName && myDeptName === uDeptName) return true;
      return false;
    });
  }, [canViewAll, users, currentUser]);

  // Upload file local to Drive
  const [fileList, setFileList] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Import Excel Preview Modal
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [importing, setImporting] = useState(false);

  // Load master data: danh hiệu, phòng ban (AllDepartment), người dùng (users)
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [titleRes, deptRes, userRes, userInfoRes] = await Promise.all([
          getEmulationTitles({ activeOnly: "true" }),
          getAllDepartments(),
          getAllUsers(),
          currentUserId ? getUserInfo(currentUserId) : Promise.resolve(null),
        ]);

        if (titleRes?.success) setTitles(titleRes.data || []);

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
          (d) => d && d.departmentName && d.departmentName.trim().toLowerCase() !== "trường"
        );
        const schoolDept = {
          _id: "TRUONG",
          departmentName: "Trường",
          departmentCode: "TRUONG",
        };
        setDepartments([schoolDept, ...filteredDepts]);

        const allUsers = Array.isArray(userRes)
          ? userRes
          : Array.isArray(userRes?.users)
          ? userRes.users
          : Array.isArray(userRes?.data)
          ? userRes.data
          : [];
        setUsers(allUsers);

        const loadedUser = userInfoRes?.data || userInfoRes?.user || userInfoRes || null;
        setCurrentUser(loadedUser);

        // Với tài khoản cấp trưởng / cấp phó, tự động điền sẵn đơn vị công tác của mình
        const userDeptName = loadedUser?.department?.departmentName || "";
        const userDeptId = loadedUser?.department?._id || loadedUser?.department || "";
        const uRole = loadedUser?.role || currentUserRole;
        const isBgh = isBghUser(loadedUser) || loadedUser?.department?.departmentCode === "BGH";
        const isLeader = !isBgh && uRole !== "manager" && uRole !== "admin" && ["staff", "captruong", "cappho"].includes(uRole);

        if (isLeader && userDeptName) {
          form.setFieldsValue({
            departmentName: userDeptName,
            departmentId: userDeptId,
          });
        }
      } catch (err) {
        console.error("Lỗi tải danh mục master:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [currentUserId, currentUserRole]);

  // Tự động tìm và điền Đơn vị công tác khi chọn người dùng từ danh sách gợi ý
  const handleSelectUser = (selectedUserId) => {
    const selectedUser = availableUsers.find((u) => String(u._id) === String(selectedUserId));
    if (selectedUser) {
      form.setFieldsValue({
        fullName: selectedUser.name,
        userId: selectedUser._id,
      });

      const deptId = selectedUser.department?._id || selectedUser.department;
      const deptName = selectedUser.department?.departmentName || "";
      const dept = departments.find(
        (d) =>
          (deptId && String(d._id) === String(deptId)) ||
          (deptName && d.departmentName?.toLowerCase() === deptName.toLowerCase())
      );
      if (dept) {
        form.setFieldsValue({
          departmentId: dept._id === "TRUONG" ? null : dept._id,
          departmentName: dept.departmentName,
        });
      } else if (deptName) {
        form.setFieldsValue({
          departmentName: deptName,
        });
      }
    }
  };

  // Tra cứu tự động khi gõ tên: nếu trùng tên cán bộ có sẵn trong danh sách thì tự gán phòng ban, nếu không có thì tự do nhập
  const handleFullNameChange = (val) => {
    if (!val || typeof val !== "string") {
      form.setFieldsValue({ userId: null });
      return;
    }
    const trimmed = val.trim().toLowerCase();
    const matchedUser = availableUsers.find((u) => u.name?.trim().toLowerCase() === trimmed);
    if (matchedUser) {
      handleSelectUser(matchedUser._id);
    } else {
      // Cán bộ chưa có tài khoản trong hệ thống => để người dùng tự nhập tự do
      form.setFieldsValue({ userId: null });
    }
  };

  // Submit form đơn lẻ
  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);

      // Nếu có upload file local, upload lên Drive trước
      let uploadedAttachments = [];
      if (fileList.length > 0) {
        setUploadingFiles(true);
        const formData = new FormData();
        fileList.forEach((f) => {
          if (f.originFileObj) {
            formData.append("files", f.originFileObj);
          }
        });

        try {
          const uploadRes = await uploadAchievementFiles(formData);
          if (uploadRes?.success && uploadRes.data) {
            uploadedAttachments = uploadRes.data;
          }
        } catch (uploadErr) {
          console.error("Lỗi upload file minh chứng:", uploadErr);
          message.warning("Không thể upload tệp minh chứng lên Google Drive, dữ liệu thành tích vẫn sẽ được lưu.");
        } finally {
          setUploadingFiles(false);
        }
      }

      // Xác định titleName
      let selectedTitleName = values.titleName || "";
      if (values.titleId) {
        const foundT = titles.find((t) => String(t._id) === String(values.titleId));
        if (foundT) selectedTitleName = foundT.name;
      }

      // Xác định departmentName
      let selectedDeptName = values.departmentName || "";
      if (values.departmentId) {
        const foundD = departments.find((d) => String(d._id) === String(values.departmentId));
        if (foundD) selectedDeptName = foundD.departmentName;
      }

      const payload = {
        fullName: values.fullName,
        targetType: values.targetType || "CA_NHAN",
        userId: values.userId || null,
        departmentId: values.departmentId === "TRUONG" ? null : (values.departmentId || null),
        departmentName: selectedDeptName,
        titleId: values.titleId || null,
        titleName: selectedTitleName,
        achievementContent: values.achievementContent,
        decisionNumber: values.decisionNumber || "",
        decisionDate: values.decisionDate ? values.decisionDate.format("YYYY-MM-DD") : null,
        decisionAgency: values.decisionAgency || "",
        schoolYear: values.schoolYear || "2026-2027",
        driveLink: values.driveLink || "",
        attachedFiles: uploadedAttachments,
        notes: values.notes || "",
      };

      const res = await createAchievement(payload);
      if (res?.success) {
        message.success("Lưu thông tin thành tích khen thưởng thành công!");
        form.resetFields();
        setFileList([]);
        navigate("/emulation/achievements");
      }
    } catch (err) {
      console.error("Lỗi lưu thành tích:", err);
      message.error(err.response?.data?.message || "Lỗi khi lưu thành tích");
    } finally {
      setSubmitting(false);
    }
  };

  // Tải file mẫu Excel chuẩn (đã có cột Loại thành tích, Danh hiệu thi đua, Cơ quan ban hành)
  const handleDownloadExcelTemplate = () => {
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
          "Ghi chú": "Khen thưởng cấp cơ sở",
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
        { wch: 6 },  // STT
        { wch: 25 }, // Họ và tên
        { wch: 16 }, // Loại thành tích
        { wch: 30 }, // Đơn vị công tác
        { wch: 28 }, // Danh hiệu
        { wch: 45 }, // Nội dung thành tích
        { wch: 18 }, // Số quyết định
        { wch: 26 }, // Ngày ban hành
        { wch: 38 }, // Cơ quan ban hành
        { wch: 45 }, // Link Drive
        { wch: 15 }, // Năm học
        { wch: 25 }, // Ghi chú
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mau_Thanh_Tich");
      XLSX.writeFile(wb, "Mau_Danh_Sach_Thanh_Tich_Thi_Dua.xlsx");
      message.success("Đã tải xuống file mẫu Excel thành công!");
    } catch (err) {
      console.error("Lỗi tạo mẫu Excel:", err);
      message.error("Lỗi khi tải file mẫu Excel");
    }
  };

  // Đọc file Excel người dùng chọn để Preview
  const handleFileUploadExcel = (file) => {
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

        // Chuẩn hóa dữ liệu
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
          const schoolYear = row["Năm học"] || "2026-2027";
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
            schoolYear,
            notes,
            isValid,
            errors,
          };
        });

        setPreviewData(parsed);
        setImportModalVisible(true);
      } catch (err) {
        console.error("Lỗi đọc file Excel:", err);
        message.error("Lỗi đọc file Excel. Vui lòng kiểm tra lại định dạng file!");
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  // Xác nhận nhập dữ liệu từ Excel Preview
  const handleConfirmImport = async () => {
    const validRows = previewData.filter((r) => r.isValid);
    if (validRows.length === 0) {
      message.error("Không có dòng dữ liệu hợp lệ nào để nhập!");
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
        message.success(res.message || `Đã nhập thành công ${res.count} thành tích khen thưởng!`);
        setImportModalVisible(false);
        setPreviewData([]);
        navigate("/emulation/achievements");
      }
    } catch (err) {
      console.error("Lỗi import Excel:", err);
      message.error(err.response?.data?.message || "Lỗi khi nhập danh sách từ Excel");
    } finally {
      setImporting(false);
    }
  };

  // Columns cho bảng Preview Import
  const previewColumns = [
    {
      title: "STT",
      dataIndex: "stt",
      width: 50,
      align: "center",
    },
    {
      title: "Họ và tên",
      dataIndex: "fullName",
      width: 160,
      render: (text, record) => (
        <span className={record.errors.includes("Thiếu Họ tên") ? "text-red-500 font-bold" : "font-medium"}>
          {text || "(Trống)"}
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
      title: "Đơn vị công tác",
      dataIndex: "departmentName",
      width: 170,
      render: (text, record) => (
        <span className={record.errors.includes("Thiếu Đơn vị") ? "text-red-500 font-bold" : ""}>
          {text || "(Trống)"}
        </span>
      ),
    },
    {
      title: "Danh hiệu thi đua",
      dataIndex: "titleName",
      width: 170,
      render: (t) => (t ? <span className="text-amber-700 font-medium">{t}</span> : <Text type="secondary">--</Text>),
    },
    {
      title: "Nội dung thành tích",
      dataIndex: "achievementContent",
      width: 220,
      render: (text, record) => (
        <span className={record.errors.includes("Thiếu Nội dung") ? "text-red-500 font-bold" : ""}>
          {text || "(Trống)"}
        </span>
      ),
    },
    {
      title: "Số QĐ",
      dataIndex: "decisionNumber",
      width: 120,
    },
    {
      title: "Ngày ban hành",
      dataIndex: "decisionDate",
      width: 120,
    },
    {
      title: "Cơ quan ban hành",
      dataIndex: "decisionAgency",
      width: 180,
    },
    {
      title: "Link Google Drive",
      dataIndex: "driveLink",
      width: 150,
      render: (url) =>
        url ? (
          <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            Xem link Drive
          </a>
        ) : (
          <Text type="secondary">--</Text>
        ),
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 130,
      align: "center",
      render: (_, record) =>
        record.isValid ? (
          <span className="text-green-600 font-medium flex items-center justify-center gap-1">
            <CheckCircleOutlined /> Hợp lệ
          </span>
        ) : (
          <span className="text-red-500 text-xs flex items-center justify-center gap-1">
            <ExclamationCircleOutlined /> {record.errors.join(", ")}
          </span>
        ),
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
              Thêm Mới Thành Tích Thi Đua - Khen Thưởng
            </Title>
            <Text type="secondary">
              Quản lý và lưu trữ thông tin quyết định công nhận thành tích của cán bộ, giáo viên và đơn vị
            </Text>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center mt-2 sm:mt-0">
            <Tooltip title="Tra cứu danh sách thành tích" placement="top">
              <Button
                icon={<UnorderedListOutlined className="text-base text-blue-600" />}
                onClick={() => navigate("/emulation/achievements")}
                className="flex items-center justify-center h-9 w-9 p-0 bg-white hover:bg-blue-50 border-blue-300 hover:border-blue-500 rounded-lg shadow-sm transition-all"
              />
            </Tooltip>
            <Tooltip title="Tải file mẫu Excel" placement="top">
              <Button
                icon={<DownloadOutlined className="text-base text-emerald-600" />}
                onClick={handleDownloadExcelTemplate}
                className="flex items-center justify-center h-9 w-9 p-0 bg-white hover:bg-emerald-50 border-emerald-300 hover:border-emerald-500 rounded-lg shadow-sm transition-all"
              />
            </Tooltip>
            <Tooltip title="Nhập danh sách từ Excel (.xlsx, .xls)" placement="top">
              <Upload
                accept=".xlsx, .xls"
                showUploadList={false}
                beforeUpload={handleFileUploadExcel}
              >
                <Button
                  icon={<FileExcelOutlined className="text-base" />}
                  className="flex items-center justify-center h-9 w-9 p-0 bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-lg shadow-sm transition-all"
                />
              </Upload>
            </Tooltip>
          </div>
        </div>

        {/* BANNER HƯỚNG DẪN */}
        <Alert
          type="info"
          showIcon
          className="mb-6 text-sm"
          message="Hướng dẫn quản lý thành tích khen thưởng"
          description="Sau khi có quyết định khen thưởng, bạn hãy nhập thông tin bên dưới hoặc bấm 'Nhập từ Excel' để thêm hàng loạt. Hệ thống hỗ trợ nhúng trực tiếp link minh chứng Google Drive hoặc tải tệp đính kèm."
        />

        {/* BIỂU MẪU NHẬP THÀNH TÍCH */}
        <Spin spinning={loading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              targetType: "CA_NHAN",
              schoolYear: "2026-2027",
              decisionAgency: "Trường Cao đẳng Bách khoa Nam Sài Gòn",
            }}
          >
            {/* THÔNG TIN CÁN BỘ & ĐƠN VỊ */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-5">
              <Text strong className="text-base text-blue-800 flex items-center gap-1 mb-3 block">
                <UserOutlined /> 1. Thông tin đối tượng khen thưởng
              </Text>
              <Row gutter={[16, 12]}>
                <Col xs={24} md={10}>
                  <Form.Item
                    name="fullName"
                    label="Họ và tên cán bộ / Cá nhân / Tập thể"
                    rules={[{ required: true, message: "Vui lòng nhập họ và tên" }]}
                    tooltip={
                      isCapTruongOrPho
                        ? "Gợi ý cán bộ thuộc đơn vị mình hoặc tự nhập họ tên mới nếu chưa có tài khoản"
                        : "Gõ họ tên để tự động tra cứu cán bộ trong trường hoặc tự nhập mới"
                    }
                  >
                    <AutoComplete
                      options={availableUsers.map((u) => ({
                        value: u.name,
                        label: (
                          <div className="flex justify-between items-center py-0.5">
                            <span className="font-medium text-gray-800">{u.name}</span>
                            <span className="text-xs text-gray-400">
                              {u.position?.positionName || "Cán bộ"} - {u.department?.departmentName || ""}
                            </span>
                          </div>
                        ),
                        userId: u._id,
                      }))}
                      onSelect={(value, option) => handleSelectUser(option.userId)}
                      onChange={handleFullNameChange}
                      placeholder={
                        isCapTruongOrPho
                          ? "Chọn cán bộ đơn vị mình hoặc tự gõ họ tên mới..."
                          : "Nhập hoặc tìm kiếm họ tên cán bộ..."
                      }
                      filterOption={(inputValue, option) =>
                        (option?.value || "").toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                      }
                    />
                  </Form.Item>
                  <Form.Item name="userId" hidden>
                    <Input />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={5}>
                  <Form.Item
                    name="targetType"
                    label="Loại thành tích"
                    rules={[{ required: true, message: "Vui lòng chọn loại thành tích" }]}
                  >
                    <Radio.Group buttonStyle="solid" className="w-full flex">
                      <Radio.Button value="CA_NHAN" className="flex-1 text-center">
                        <UserOutlined className="mr-1" /> Cá nhân
                      </Radio.Button>
                      <Radio.Button value="TAP_THE" className="flex-1 text-center">
                        <TeamOutlined className="mr-1" /> Tập thể
                      </Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={9}>
                  <Form.Item
                    name="departmentName"
                    label="Đơn vị / Phòng ban công tác"
                    rules={[{ required: true, message: "Vui lòng chọn đơn vị công tác" }]}
                    tooltip="Tìm và chọn danh sách đơn vị trong cơ sở dữ liệu"
                  >
                    <Select
                      showSearch
                      allowClear
                      placeholder="Chọn đơn vị / phòng ban trong CSDL..."
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                        (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
                      }
                      onChange={(val) => {
                        const dept = departments.find((d) => d.departmentName === val);
                        form.setFieldsValue({
                          departmentName: val,
                          departmentId: dept && dept._id !== "TRUONG" ? dept._id : null,
                        });
                        if (val === "Trường") {
                          form.setFieldsValue({ targetType: "TAP_THE" });
                        }
                      }}
                    >
                      {departments.map((d) => (
                        <Select.Option key={d._id} value={d.departmentName}>
                          {d.departmentName}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item name="departmentId" hidden>
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* THÔNG TIN THÀNH TÍCH & QUYẾT ĐỊNH */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-5">
              <Text strong className="text-base text-amber-800 flex items-center gap-1 mb-3 block">
                <TrophyOutlined /> 2. Danh hiệu thi đua & Quyết định công nhận
              </Text>
              <Row gutter={[16, 12]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="titleId"
                    label="Danh hiệu thi đua (Chọn từ danh mục)"
                    tooltip="Chọn loại danh hiệu thi đua từ danh mục của nhà trường"
                  >
                    <Select
                      showSearch
                      placeholder="Chọn danh hiệu thi đua..."
                      allowClear
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                        (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
                      }
                      onChange={(val) => {
                        const t = titles.find((item) => String(item._id) === String(val));
                        form.setFieldsValue({ titleName: t ? t.name : "" });
                      }}
                    >
                      {titles.map((t) => (
                        <Select.Option key={t._id} value={t._id}>
                          {t.name}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item name="titleName" hidden>
                    <Input />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="schoolYear"
                    label="Năm học công nhận"
                    rules={[{ required: true, message: "Vui lòng chọn năm học" }]}
                  >
                    <AutoComplete
                      options={SCHOOL_YEARS.map((y) => ({ value: y, label: `Năm học ${y}` }))}
                      placeholder="Chọn hoặc nhập năm học..."
                    />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="achievementContent"
                    label="Nội dung thành tích / Chi tiết khen thưởng"
                    rules={[{ required: true, message: "Vui lòng nhập nội dung thành tích" }]}
                  >
                    <TextArea
                      rows={3}
                      placeholder="Ví dụ: Đạt danh hiệu Lao động tiên tiến năm học 2025-2026 vì đã hoàn thành xuất sắc các chỉ tiêu công tác..."
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="decisionNumber"
                    label="Số quyết định công nhận"
                    tooltip="Ví dụ: 125/QĐ-CĐBKSG"
                  >
                    <Input placeholder="Nhập số quyết định..." />
                  </Form.Item>
                </Col>

                <Col xs={24} sm={12} md={8}>
                  <Form.Item
                    name="decisionDate"
                    label="Ngày ban hành quyết định"
                  >
                    <DatePicker className="w-full" format="DD/MM/YYYY" placeholder="Chọn ngày ban hành" />
                  </Form.Item>
                </Col>

                <Col xs={24} md={8}>
                  <Form.Item
                    name="decisionAgency"
                    label="Cơ quan ban hành quyết định"
                    tooltip="Chọn từ gợi ý có sẵn hoặc tự gõ tên cơ quan bất kỳ"
                  >
                    <AutoComplete
                      options={COMMON_AGENCIES}
                      placeholder="Chọn gợi ý hoặc tự nhập tên cơ quan..."
                      filterOption={(inputValue, option) =>
                        (option?.value || "").toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                      }
                    />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* MINH CHỨNG & TỆP ĐÍNH KÈM */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-5">
              <Text strong className="text-base text-green-800 flex items-center gap-1 mb-3 block">
                <LinkOutlined /> 3. Tệp minh chứng & Link Google Drive
              </Text>
              <Row gutter={[16, 12]}>
                <Col xs={24} md={14}>
                  <Form.Item
                    name="driveLink"
                    label="Link minh chứng Google Drive"
                    tooltip="Dán đường dẫn chia sẻ file hoặc thư mục trên Google Drive của bạn"
                  >
                    <Input
                      prefix={<LinkOutlined className="text-blue-500" />}
                      placeholder="https://drive.google.com/file/d/..."
                      allowClear
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={10}>
                  <Form.Item
                    label="Hoặc tải file đính kèm trực tiếp (PDF, Word, Ảnh...)"
                    tooltip="File sẽ được tự động đồng bộ lên Google Drive của hệ thống"
                  >
                    <Upload
                      fileList={fileList}
                      beforeUpload={(file) => {
                        setFileList((prev) => [...prev, file]);
                        return false;
                      }}
                      onRemove={(file) => {
                        setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
                      }}
                      multiple
                    >
                      <Button icon={<UploadOutlined />} loading={uploadingFiles}>
                        Chọn tệp đính kèm ({fileList.length})
                      </Button>
                    </Upload>
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item name="notes" label="Ghi chú bổ sung (nếu có)">
                    <TextArea rows={2} placeholder="Nhập ghi chú thêm..." />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* NÚT THAO TÁC SUBMIT */}
            <div className="flex justify-end gap-3 pt-2">
              <Button onClick={() => form.resetFields()}>
                Nhập lại
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={submitting || uploadingFiles}
                size="large"
                style={{ backgroundColor: "#1890ff" }}
              >
                Lưu thành tích
              </Button>
            </div>
          </Form>
        </Spin>
      </Card>

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
        width={1100}
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
          <Text type="secondary" className="text-xs">
            Hệ thống sẽ tự động ghép danh hiệu thi đua và đơn vị theo tên tương ứng
          </Text>
        </div>

        <Table
          columns={previewColumns}
          dataSource={previewData}
          size="small"
          pagination={{ pageSize: 8 }}
          scroll={{ x: 1050, y: 380 }}
          bordered
        />
      </Modal>
    </div>
  );
};

export default EmulationAchievementAddPage;
