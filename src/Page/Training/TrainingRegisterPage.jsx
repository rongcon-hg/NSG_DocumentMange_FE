import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  DatePicker,
  Row,
  Col,
  Space,
  Tag,
  Typography,
  message,
  Popconfirm,
  Tooltip,
  Upload,
  Divider,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  SendOutlined,
  UnorderedListOutlined,
  UserOutlined,
  BookOutlined,
  DollarOutlined,
  BankOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  UploadOutlined,
  ExportOutlined,
  FileExcelOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { getAllUsers, getUserInfo } from "../../api/auth";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { getAllPositions } from "../../api/PositionAPI";
import { createTrainingRegistrations } from "../../api/trainingApi";
import { useNotificationContext } from "../../context/NotificationContext";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const TRAINING_FORMS = ["Chứng chỉ", "Chứng nhận", "Văn bằng", "Khác"];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [
  currentYear - 1,
  currentYear,
  currentYear + 1,
  currentYear + 2,
].map((y) => y.toString());

// Chuẩn hóa họ tên tiếng Việt
const formatFullName = (str) => {
  if (!str) return "";
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const TrainingRegisterPage = () => {
  const navigate = useNavigate();
  const { userId, userRole, refetchNotificationCounts } = useNotificationContext();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [currentUserData, setCurrentUserData] = useState(null);

  // Bộ lọc thông tin chung
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedDeptId, setSelectedDeptId] = useState(null);

  // Danh sách dòng đăng ký
  const [rows, setRows] = useState([
    {
      key: Date.now(),
      isCustomUser: false,
      userId: null,
      userName: "",
      positionName: "",
      trainingContent: "",
      trainingForm: "Chứng chỉ",
      trainingLocation: "",
      dateRange: null,
      trainingDuration: "",
      estimatedCost: 0,
      notes: "",
    },
  ]);

  // Phân quyền: Manager / Admin được chọn mọi đơn vị và đăng ký cho mọi người
  // Cấp trưởng / Cấp phó: Cố định đơn vị của mình và chỉ đăng ký cho nhân sự thuộc đơn vị
  const isManagerOrAdmin =
    userRole === "admin" ||
    userRole === "manager" ||
    currentUserData?.role === "admin" ||
    currentUserData?.role === "manager";

  // 1. Tải thông tin người dùng hiện tại và danh mục
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const [usersRes, deptsRes, posRes] = await Promise.all([
          getAllUsers(),
          getAllDepartments(),
          getAllPositions(),
        ]);

        if (usersRes && usersRes.users) {
          setAllUsers(usersRes.users);
        }

        const deptList = (
          deptsRes?.AllDepartment ||
          deptsRes?.data ||
          deptsRes?.departments ||
          (Array.isArray(deptsRes) ? deptsRes : [])
        ).filter((d) => !d.departmentName?.toLowerCase().includes("giải thể"));
        setDepartments(deptList);

        const posList = (
          posRes?.AllPosition ||
          posRes?.data ||
          posRes?.positions ||
          (Array.isArray(posRes) ? posRes : [])
        );
        setPositions(posList);

        if (userId) {
          const userRes = await getUserInfo(userId);
          const userData = userRes?.data || userRes?.user;
          if (userData) {
            setCurrentUserData(userData);
            const userDeptId = userData.department?._id || userData.department;
            if (userDeptId) {
              setSelectedDeptId(userDeptId.toString());
            }
          }
        }
      } catch (err) {
        console.error("Lỗi khởi tạo dữ liệu:", err);
        message.error("Lỗi khi tải thông tin nhân sự và đơn vị.");
      } finally {
        setLoading(false);
      }
    };

    initData();
  }, [userId]);

  // 2. Lọc danh sách nhân sự khả dụng theo vai trò và đơn vị
  const availableUsers = useMemo(() => {
    if (isManagerOrAdmin) {
      if (!selectedDeptId) return allUsers;
      return allUsers.filter((u) => {
        const uDeptId = u.department?._id || u.department;
        return uDeptId && uDeptId.toString() === selectedDeptId.toString();
      });
    }

    // Cấp trưởng: chỉ xem nhân sự thuộc đơn vị của cấp trưởng
    const myDeptId = currentUserData?.department?._id || currentUserData?.department;
    if (!myDeptId) return [];

    return allUsers.filter((u) => {
      const uDeptId = u.department?._id || u.department;
      return uDeptId && uDeptId.toString() === myDeptId.toString();
    });
  }, [allUsers, selectedDeptId, isManagerOrAdmin, currentUserData]);

  // Đơn vị hiện hành
  const currentDeptObj = useMemo(() => {
    const targetDeptId = isManagerOrAdmin
      ? selectedDeptId
      : currentUserData?.department?._id || currentUserData?.department;
    return departments.find((d) => d._id?.toString() === targetDeptId?.toString());
  }, [departments, selectedDeptId, isManagerOrAdmin, currentUserData]);

  // 3. Thêm dòng đăng ký mới
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: Date.now() + Math.random(),
        isCustomUser: false,
        userId: null,
        userName: "",
        positionName: "",
        trainingContent: "",
        trainingForm: "Chứng chỉ",
        trainingLocation: "",
        dateRange: null,
        trainingDuration: "",
        estimatedCost: 0,
        notes: "",
      },
    ]);
  };

  // 4. Xóa dòng
  const handleRemoveRow = (key) => {
    if (rows.length === 1) {
      message.warning("Cần giữ ít nhất 1 dòng đăng ký.");
      return;
    }
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  // 5. Cập nhật dữ liệu một dòng
  const handleUpdateRow = (key, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;

        const updated = { ...r, [field]: value };

        // Nếu người dùng chọn "CUSTOM_UNREGISTERED"
        if (field === "userSelection") {
          if (value === "CUSTOM_UNREGISTERED") {
            updated.isCustomUser = true;
            updated.userId = null;
            updated.userName = "";
            updated.positionName = "";
          } else {
            updated.isCustomUser = false;
            updated.userId = value;
            const matched = allUsers.find((u) => u._id === value);
            if (matched) {
              updated.userName = matched.name || "";
              updated.positionName =
                matched.position?.positionName || matched.positionName || "Cán bộ";
            } else {
              updated.userName = "";
              updated.positionName = "";
            }
          }
        }

        // Nếu thay đổi dateRange -> Tính chuỗi thời gian gợi ý
        if (field === "dateRange" && value && value.length === 2) {
          const start = value[0];
          const end = value[1];
          const days = end.diff(start, "day") + 1;
          updated.trainingDuration = `${days} ngày (${start.format("DD/MM/YYYY")} - ${end.format("DD/MM/YYYY")})`;
        }

        return updated;
      })
    );
  };

  // 6. Tính tổng kinh phí
  const totalEstimatedCost = useMemo(() => {
    return rows.reduce((sum, r) => sum + (Number(r.estimatedCost) || 0), 0);
  }, [rows]);

  // 7. Tải file mẫu Excel
  const handleDownloadTemplate = () => {
    try {
      const sampleDept = currentDeptObj?.departmentName || "Khoa Công nghệ Thông tin";

      const sampleData = [
        {
          STT: 1,
          "Họ và tên": "Nguyễn Văn A",
          "Chức vụ": "Giảng viên",
          "Nội dung học tập bồi dưỡng": "Bồi dưỡng tiêu chuẩn chức danh nghề nghiệp Giảng viên",
          "Hình thức đào tạo": "Chứng chỉ",
          "Kinh phí dự kiến (VNĐ)": 3000000,
          "Nơi đào tạo": "Trường ĐH Sư Phạm Kỹ Thuật",
          "Thời gian bắt đầu": "01/06/2026",
          "Thời gian kết thúc": "30/08/2026",
          "Ghi chú": "Kế hoạch nâng cao nghiệp vụ",
        },
        {
          STT: 2,
          "Họ và tên": "Trần Thị B",
          "Chức vụ": "Chuyên viên",
          "Nội dung học tập bồi dưỡng": "Ứng dụng AI và chuyển đổi số trong quản trị văn phòng số",
          "Hình thức đào tạo": "Chứng nhận",
          "Kinh phí dự kiến (VNĐ)": 1500000,
          "Nơi đào tạo": "Học viện Hành chính Quốc gia",
          "Thời gian bắt đầu": "15/07/2026",
          "Thời gian kết thúc": "20/07/2026",
          "Ghi chú": "Cán bộ hợp đồng (chưa có TK hệ thống)",
        },
      ];

      const ws = XLSX.utils.json_to_sheet(sampleData);
      ws["!cols"] = [
        { wch: 6 },
        { wch: 25 },
        { wch: 20 },
        { wch: 45 },
        { wch: 18 },
        { wch: 22 },
        { wch: 30 },
        { wch: 18 },
        { wch: 18 },
        { wch: 30 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Dang_Ky");

      // Sheet 2: Danh mục tham chiếu
      const refForms = TRAINING_FORMS.map((f, idx) => ({
        STT: idx + 1,
        "Hình thức đào tạo chuẩn": f,
      }));
      const wsForms = XLSX.utils.json_to_sheet(refForms);
      wsForms["!cols"] = [{ wch: 6 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsForms, "Hinh_Thuc_Dao_Tao");

      const refPositions = positions.map((p, idx) => ({
        STT: idx + 1,
        "Chức vụ chuẩn": p.positionName,
      }));
      const wsPositions = XLSX.utils.json_to_sheet(refPositions);
      wsPositions["!cols"] = [{ wch: 6 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsPositions, "Danh_Muc_Chuc_Vu");

      XLSX.writeFile(wb, "Mau_Dang_Ky_Hoc_Tap_Boi_Duong.xlsx");
      message.success("Đã tải xuống file mẫu Excel thành công!");
    } catch (err) {
      console.error("Lỗi xuất file mẫu Excel:", err);
      message.error("Lỗi khi tạo file mẫu Excel");
    }
  };

  // 8. Import dữ liệu từ file Excel
  const handleImportExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (!rawJson || rawJson.length === 0) {
          message.warning("File Excel tải lên không có dữ liệu!");
          return;
        }

        const candidateUsers = isManagerOrAdmin ? allUsers : availableUsers;
        const importedRows = [];
        let matchedAccountCount = 0;
        let unregisteredCount = 0;

        rawJson.forEach((row, idx) => {
          const rawName = (
            row["Họ và tên"] ||
            row["Họ tên"] ||
            row["Ho va ten"] ||
            row["name"] ||
            ""
          ).toString().trim();

          if (!rawName) return;

          const formattedName = formatFullName(rawName);

          // Rà soát trong CSDL người dùng
          const matchedUser = candidateUsers.find(
            (u) =>
              u.name &&
              u.name.trim().toLowerCase() === formattedName.toLowerCase()
          );

          let userId = null;
          let isCustomUser = false;
          let positionName = (
            row["Chức vụ"] ||
            row["Chuc vu"] ||
            row["position"] ||
            ""
          ).toString().trim();

          if (matchedUser) {
            userId = matchedUser._id;
            isCustomUser = false;
            matchedAccountCount += 1;
            if (!positionName && matchedUser.position?.positionName) {
              positionName = matchedUser.position.positionName;
            }
          } else {
            userId = null;
            isCustomUser = true;
            unregisteredCount += 1;
            if (!positionName) positionName = "Cán bộ";
          }

          const trainingContent = (
            row["Nội dung học tập bồi dưỡng"] ||
            row["Nội dung bồi dưỡng"] ||
            row["Noi dung"] ||
            row["content"] ||
            ""
          ).toString().trim();

          const rawForm = (
            row["Hình thức đào tạo"] ||
            row["Hình thức"] ||
            row["Hinh thuc"] ||
            "Chứng chỉ"
          ).toString().trim();
          const trainingForm = TRAINING_FORMS.includes(rawForm) ? rawForm : "Chứng chỉ";

          const estimatedCost = Number(
            String(row["Kinh phí dự kiến (VNĐ)"] || row["Kinh phí"] || row["cost"] || 0)
              .replace(/[^0-9]/g, "")
          ) || 0;

          const trainingLocation = (
            row["Nơi đào tạo"] ||
            row["Cơ sở bồi dưỡng"] ||
            row["location"] ||
            ""
          ).toString().trim();

          // Xử lý ngày tháng
          const rawStart = row["Thời gian bắt đầu"] || row["Từ ngày"] || "";
          const rawEnd = row["Thời gian kết thúc"] || row["Đến ngày"] || "";

          let dateRange = null;
          let trainingDuration = "";

          const parseExcelDate = (val) => {
            if (!val) return null;
            if (val instanceof Date) return dayjs(val);
            if (typeof val === "number") {
              return dayjs(new Date((val - (25567 + 2)) * 86400 * 1000));
            }
            const s = String(val).trim();
            const d1 = dayjs(s, "DD/MM/YYYY");
            if (d1.isValid()) return d1;
            const d2 = dayjs(s);
            if (d2.isValid()) return d2;
            return null;
          };

          const startDateObj = parseExcelDate(rawStart);
          const endDateObj = parseExcelDate(rawEnd);

          if (startDateObj && endDateObj && endDateObj.isAfter(startDateObj.subtract(1, "day"))) {
            dateRange = [startDateObj, endDateObj];
            const days = endDateObj.diff(startDateObj, "day") + 1;
            trainingDuration = `${days} ngày (${startDateObj.format("DD/MM/YYYY")} - ${endDateObj.format("DD/MM/YYYY")})`;
          } else if (startDateObj) {
            trainingDuration = `Từ ${startDateObj.format("DD/MM/YYYY")}`;
          }

          const notes = (row["Ghi chú"] || row["ghi chu"] || row["notes"] || "").toString().trim();

          importedRows.push({
            key: Date.now() + idx + Math.random(),
            isCustomUser,
            userId,
            userName: formattedName,
            positionName,
            trainingContent,
            trainingForm,
            trainingLocation,
            dateRange,
            trainingDuration,
            estimatedCost,
            notes,
          });
        });

        if (importedRows.length === 0) {
          message.error("Không tìm thấy dòng dữ liệu hợp lệ trong file Excel.");
          return;
        }

        setRows(importedRows);
        message.success(
          `Đã nhập thành công ${importedRows.length} nhân sự từ file Excel (${matchedAccountCount} có tài khoản, ${unregisteredCount} chưa có tài khoản)!`
        );
      } catch (err) {
        console.error("Lỗi đọc file Excel:", err);
        message.error("Định dạng file Excel không hợp lệ hoặc bị lỗi.");
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // Chặn upload mặc định của antd
  };

  // 9. Xuất danh sách hiện tại ra Excel
  const handleExportExcel = () => {
    try {
      if (rows.length === 0) {
        message.warning("Danh sách đăng ký hiện đang trống.");
        return;
      }

      const exportData = rows.map((r, idx) => ({
        STT: idx + 1,
        "Họ và tên": r.userName || "Chưa nhập",
        "Có tài khoản": r.userId ? "Có" : "Chưa có",
        "Chức vụ": r.positionName || "Cán bộ",
        "Đơn vị": currentDeptObj?.departmentName || currentUserData?.departmentName || "",
        "Nội dung học tập bồi dưỡng": r.trainingContent || "",
        "Hình thức đào tạo": r.trainingForm || "",
        "Kinh phí dự kiến (VNĐ)": Number(r.estimatedCost) || 0,
        "Nơi đào tạo": r.trainingLocation || "",
        "Thời gian dự kiến": r.trainingDuration || "",
        "Ghi chú": r.notes || "",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 6 },
        { wch: 25 },
        { wch: 14 },
        { wch: 20 },
        { wch: 30 },
        { wch: 45 },
        { wch: 18 },
        { wch: 22 },
        { wch: 30 },
        { wch: 30 },
        { wch: 30 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Dang_Ky");

      XLSX.writeFile(
        wb,
        `Dang_Ky_Boi_Duong_${selectedYear}_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`
      );
      message.success("Đã xuất danh sách ra file Excel thành công!");
    } catch (err) {
      console.error("Lỗi xuất file Excel:", err);
      message.error("Lỗi khi xuất danh sách ra Excel");
    }
  };

  // 10. Gửi đăng ký
  const handleSubmit = async () => {
    if (rows.length === 0) {
      message.error("Vui lòng thêm ít nhất một nhân sự đăng ký bồi dưỡng.");
      return;
    }

    const currentDept = currentDeptObj;
    const targetDeptId = isManagerOrAdmin
      ? selectedDeptId
      : currentUserData?.department?._id || currentUserData?.department;

    const itemsToSubmit = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const trimmedName = (r.userName || "").trim();

      if (!trimmedName) {
        message.error(`Dòng ${i + 1}: Vui lòng chọn hoặc nhập Họ và tên nhân sự.`);
        return;
      }
      if (!r.trainingContent.trim()) {
        message.error(`Dòng ${i + 1} (${trimmedName}): Vui lòng nhập nội dung học tập bồi dưỡng.`);
        return;
      }

      itemsToSubmit.push({
        userId: r.userId || null,
        userName: trimmedName,
        department: targetDeptId,
        departmentName: currentDept?.departmentName || currentUserData?.departmentName || "",
        positionName: r.positionName || "Cán bộ",
        year: selectedYear,
        trainingContent: r.trainingContent.trim(),
        trainingForm: r.trainingForm,
        trainingLocation: r.trainingLocation?.trim() || "",
        startDate: r.dateRange && r.dateRange[0] ? r.dateRange[0].toDate() : null,
        endDate: r.dateRange && r.dateRange[1] ? r.dateRange[1].toDate() : null,
        trainingDuration: r.trainingDuration?.trim() || "",
        estimatedCost: Number(r.estimatedCost) || 0,
        notes: r.notes?.trim() || "",
      });
    }

    setSubmitting(true);
    try {
      const res = await createTrainingRegistrations({ items: itemsToSubmit });
      if (res.success) {
        message.success(res.message || "Gửi đăng ký bồi dưỡng thành công!");
        if (refetchNotificationCounts) refetchNotificationCounts();
        navigate("/training/list");
      }
    } catch (err) {
      console.error("Lỗi gửi đăng ký bồi dưỡng:", err);
      message.error(err.response?.data?.message || "Lỗi khi gửi đăng ký bồi dưỡng.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white rounded-xl p-4 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BookOutlined className="text-2xl sm:text-3xl text-yellow-300" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight m-0 text-white">
                Đăng Ký Học Tập Bồi Dưỡng
              </h1>
            </div>
            <p className="text-blue-100 text-xs sm:text-sm mt-1 mb-0">
              Lập kế hoạch đào tạo, bồi dưỡng chuyên môn nghiệp vụ hàng năm cho cán bộ, giảng viên, nhân viên (bao gồm cả nhân sự chưa có tài khoản)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="default"
              icon={<UnorderedListOutlined />}
              onClick={() => navigate("/training/list")}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs sm:text-sm h-9"
            >
              Xem danh sách đề nghị
            </Button>
            <Button
              type="default"
              icon={<CheckCircleOutlined />}
              onClick={() => navigate("/training/result-report")}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs sm:text-sm h-9"
            >
              Báo cáo kết quả
            </Button>
          </div>
        </div>
      </div>

      {/* Thông tin đơn vị & Người lập + Công cụ Excel */}
      <Card className="shadow-xs border-slate-200">
        <Row gutter={[16, 16]} align="middle">
          {/* Năm đào tạo */}
          <Col xs={24} sm={8} md={6}>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 block">
                Năm đào tạo / bồi dưỡng:
              </label>
              <Select
                value={selectedYear}
                onChange={setSelectedYear}
                className="w-full"
                size="middle"
              >
                {YEAR_OPTIONS.map((y) => (
                  <Option key={y} value={y}>
                    Năm {y}
                  </Option>
                ))}
              </Select>
            </div>
          </Col>

          {/* Đơn vị / Khoa / Phòng ban */}
          <Col xs={24} sm={16} md={10}>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 block">
                  Đơn vị / Khoa / Phòng ban:
                </label>
                {isManagerOrAdmin && (
                  <span className="text-[11px] text-blue-600 font-medium">
                    (Manager/Admin được chọn mọi đơn vị)
                  </span>
                )}
              </div>
              {isManagerOrAdmin ? (
                <Select
                  value={selectedDeptId}
                  onChange={setSelectedDeptId}
                  placeholder="Chọn đơn vị đào tạo"
                  className="w-full"
                  showSearch
                  allowClear
                  optionFilterProp="children"
                >
                  {departments.map((d) => (
                    <Option key={d._id} value={d._id}>
                      {d.departmentName}
                    </Option>
                  ))}
                </Select>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm font-semibold text-slate-800 flex items-center justify-between">
                  <span>{currentDeptObj?.departmentName || currentUserData?.departmentName || "Đơn vị của tôi"}</span>
                  <Tag color="purple" className="m-0 text-[10px]">CẤP TRƯỞNG</Tag>
                </div>
              )}
            </div>
          </Col>

          {/* Người lập danh sách */}
          <Col xs={24} sm={24} md={8}>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 block">
                Người lập danh sách:
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700 flex items-center justify-between">
                <span className="font-medium text-blue-700 truncate">
                  <UserOutlined className="mr-1.5" />
                  {currentUserData?.name || "Người dùng"}
                </span>
                <Tag color={isManagerOrAdmin ? "geekblue" : "blue"} className="m-0 text-xs uppercase">
                  {userRole}
                </Tag>
              </div>
            </div>
          </Col>
        </Row>

        <Divider className="my-3" />

        {/* Thanh công cụ Import / Export Excel */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <FileExcelOutlined className="text-emerald-600 text-base" />
            <span>Tiện ích Excel: Hỗ trợ nạp nhanh danh sách thành viên và xuất kế hoạch</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadTemplate}
              className="text-xs text-slate-700 border-slate-300 hover:text-emerald-600 hover:border-emerald-600"
            >
              Tải file mẫu Excel
            </Button>

            <Upload
              beforeUpload={handleImportExcel}
              showUploadList={false}
              accept=".xlsx, .xls"
            >
              <Button
                type="primary"
                icon={<UploadOutlined />}
                className="bg-emerald-600 hover:bg-emerald-700 text-xs font-medium"
              >
                Nhập từ Excel
              </Button>
            </Upload>

            <Button
              icon={<ExportOutlined />}
              onClick={handleExportExcel}
              className="text-xs text-slate-700 border-slate-300 hover:text-blue-600 hover:border-blue-600"
            >
              Xuất danh sách ra Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* Danh sách các khóa bồi dưỡng đăng ký */}
      <Card
        title={
          <div className="flex flex-wrap items-center justify-between gap-2 py-1">
            <span className="font-semibold text-slate-800 text-sm sm:text-base flex items-center gap-2">
              <CheckCircleOutlined className="text-blue-600" />
              Danh Sách Đăng Ký ({rows.length} người)
            </span>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="text-slate-500">Tổng kinh phí dự kiến:</span>
              <span className="font-bold text-emerald-600 text-sm sm:text-base">
                {totalEstimatedCost.toLocaleString("vi-VN")} đ
              </span>
            </div>
          </div>
        }
        className="shadow-xs border-slate-200"
      >
        <div className="space-y-4">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 transition-all shadow-xs space-y-3 relative"
            >
              {/* Row Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center">
                    {index + 1}
                  </span>
                  <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                    {row.userName ? `${row.userName} - ${row.positionName || "Cán bộ"}` : "Chưa chọn hoặc chưa nhập nhân sự"}
                  </span>
                  {row.isCustomUser ? (
                    <Tag color="orange" className="text-[10px] m-0">
                      Chưa có tài khoản
                    </Tag>
                  ) : row.userId ? (
                    <Tag color="cyan" className="text-[10px] m-0">
                      Đã có tài khoản
                    </Tag>
                  ) : null}
                </div>
                {rows.length > 1 && (
                  <Popconfirm
                    title="Xóa dòng này?"
                    okText="Xóa"
                    cancelText="Hủy"
                    onConfirm={() => handleRemoveRow(row.key)}
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      className="text-xs hover:bg-red-50"
                    >
                      <span className="hidden sm:inline">Xóa</span>
                    </Button>
                  </Popconfirm>
                )}
              </div>

              {/* Form fields in Grid */}
              <Row gutter={[12, 12]}>
                {/* 1. Chọn nhân sự hoặc chọn nhập tay */}
                <Col xs={24} sm={12} md={6}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Nhân sự bồi dưỡng <span className="text-red-500">*</span>
                  </label>
                  <Select
                    showSearch
                    placeholder="Chọn nhân sự hoặc nhập tay"
                    value={row.isCustomUser ? "CUSTOM_UNREGISTERED" : row.userId || undefined}
                    onChange={(val) => handleUpdateRow(row.key, "userSelection", val)}
                    className="w-full"
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                      (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    <Option value="CUSTOM_UNREGISTERED" className="font-semibold text-orange-600">
                      ➕ Nhân sự chưa có tài khoản / Nhập tay
                    </Option>
                    <Select.OptGroup label={`Nhân sự có tài khoản (${availableUsers.length})`}>
                      {availableUsers.map((u) => (
                        <Option
                          key={u._id}
                          value={u._id}
                          label={`${u.name} ${u.email || ""} ${u.position?.positionName || ""}`}
                        >
                          {u.name} ({u.position?.positionName || "Cán bộ"} - {u.email || "NSG"})
                        </Option>
                      ))}
                    </Select.OptGroup>
                  </Select>
                </Col>

                {/* 2. Nếu là nhân sự chưa có tài khoản: Cho phép nhập Họ tên & Chức vụ */}
                {row.isCustomUser && (
                  <>
                    <Col xs={24} sm={12} md={4}>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">
                        Họ và tên nhân sự <span className="text-red-500">*</span>
                      </label>
                      <Input
                        placeholder="Nhập họ và tên..."
                        value={row.userName}
                        onChange={(e) =>
                          handleUpdateRow(row.key, "userName", e.target.value)
                        }
                      />
                    </Col>
                    <Col xs={24} sm={12} md={3}>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">
                        Chức vụ
                      </label>
                      <Input
                        placeholder="Giảng viên, Chuyên viên..."
                        value={row.positionName}
                        onChange={(e) =>
                          handleUpdateRow(row.key, "positionName", e.target.value)
                        }
                      />
                    </Col>
                  </>
                )}

                {/* 3. Nội dung bồi dưỡng */}
                <Col xs={24} sm={12} md={row.isCustomUser ? 7 : 10}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Nội dung học tập bồi dưỡng <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Nhập tên khóa bồi dưỡng, chuyên đề đào tạo..."
                    value={row.trainingContent}
                    onChange={(e) =>
                      handleUpdateRow(row.key, "trainingContent", e.target.value)
                    }
                  />
                </Col>

                {/* 4. Hình thức đào tạo */}
                <Col xs={24} sm={12} md={row.isCustomUser ? 4 : 4}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Hình thức đào tạo <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={row.trainingForm}
                    onChange={(val) => handleUpdateRow(row.key, "trainingForm", val)}
                    className="w-full"
                  >
                    {TRAINING_FORMS.map((f) => (
                      <Option key={f} value={f}>
                        {f}
                      </Option>
                    ))}
                  </Select>
                </Col>

                {/* 5. Kinh phí dự kiến */}
                <Col xs={24} sm={12} md={4}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Kinh phí dự kiến (VNĐ)
                  </label>
                  <InputNumber
                    className="w-full"
                    value={row.estimatedCost}
                    min={0}
                    step={500000}
                    formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                    parser={(val) => val.replace(/\$\s?|(,*)/g, "")}
                    onChange={(val) => handleUpdateRow(row.key, "estimatedCost", val)}
                  />
                </Col>

                {/* 6. Nơi đào tạo */}
                <Col xs={24} sm={12} md={8}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Nơi đào tạo / Cơ sở bồi dưỡng
                  </label>
                  <Input
                    placeholder="Tên trường, viện, trung tâm đào tạo..."
                    value={row.trainingLocation}
                    onChange={(e) =>
                      handleUpdateRow(row.key, "trainingLocation", e.target.value)
                    }
                  />
                </Col>

                {/* 7. Thời gian đào tạo (Từ ngày - Đến ngày) */}
                <Col xs={24} sm={12} md={6}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Thời gian dự kiến
                  </label>
                  <RangePicker
                    format="DD/MM/YYYY"
                    value={row.dateRange}
                    onChange={(dates) => handleUpdateRow(row.key, "dateRange", dates)}
                    className="w-full"
                    placeholder={["Bắt đầu", "Kết thúc"]}
                  />
                </Col>

                {/* 8. Ghi chú */}
                <Col xs={24} sm={24} md={6}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Ghi chú / Đề xuất thêm
                  </label>
                  <Input
                    placeholder="Ghi chú thêm nếu có..."
                    value={row.notes}
                    onChange={(e) => handleUpdateRow(row.key, "notes", e.target.value)}
                  />
                </Col>
              </Row>
            </div>
          ))}

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <Button
              type="dashed"
              onClick={handleAddRow}
              icon={<PlusOutlined />}
              className="w-full sm:w-auto text-blue-600 border-blue-400 hover:border-blue-600 h-9"
            >
              Thêm nhân sự đăng ký
            </Button>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button
                onClick={() => navigate("/training/list")}
                className="w-full sm:w-auto h-9"
              >
                Hủy bỏ
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={submitting}
                onClick={handleSubmit}
                className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto h-9 px-5 font-semibold"
              >
                Gửi Hồ Sơ Đăng Ký ({rows.length})
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default TrainingRegisterPage;
