import { useState, useEffect, useMemo } from "react";
import { Select, Form, Button, Table, message, Spin, Modal, Input, Space, Card, Upload, Alert, Tag, Tooltip } from "antd";
import { getAllUsersCanSearchBanUser, updateUserInfo, disableUser, restoreUser, deleteUser, importUsersApi } from "../../api/auth";
import { getAllPositions } from "../../api/PositionAPI";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { Link } from "react-router-dom";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import {
  EditOutlined,
  UserDeleteOutlined,
  UserAddOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  FileExcelOutlined,
  UploadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import FilterFormWrapper from "../../components/FilterFormWrapper.jsx";
import { removeVietnameseTones } from "../../utils/stringUtils";
import * as XLSX from "xlsx";
import dayjs from "dayjs";

// const { Title } = Typography;

const UserListPage = () => {
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // Lưu toàn bộ danh sách người dùng
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);  
  const [isRestoreModalVisible, setIsRestoreModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [selectedRole, setSelectedRole] = useState(null);
  const [form] = Form.useForm();
  const [restoreForm] = Form.useForm();
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    pageSizeOptions: ['10', '20', '50', '100'],
  });
  
  // State cho bộ lọc
  const [filters, setFilters] = useState({
    name: "",
    email: "",
    mobile: "",
    position: null,
    department: null,
  });

  // State cho Import / Export Excel
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [parsedUsers, setParsedUsers] = useState([]);
  const [importSummary, setImportSummary] = useState({ total: 0, valid: 0, invalid: 0 });

  // Danh sách vai trò
  const roles = [
    { _id: "manager", name: "Manager" },
    { _id: "staff", name: "Cấp trưởng" },
    { _id: "cappho", name: "Cấp phó" },
    { _id: "chuyenvien", name: "GV-VC" },
  ];

  // Lấy role của user từ token
  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setCurrentUserRole(decodedToken.role || "");
      } catch (error) {
        console.error("Lỗi khi decode token:", error);
        setCurrentUserRole("");
      }
    }
  }, []);

  // Lấy danh sách người dùng, positions và departments từ API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersResponse, positionsData, departmentsData] = await Promise.all([
          getAllUsersCanSearchBanUser(),
          getAllPositions(),
          getAllDepartments(),
        ]);

        const usersList = usersResponse.users || [];
        setUsers(usersList);
        setAllUsers(usersList);

        if (positionsData && Array.isArray(positionsData.AllPosition)) {
          const positionNames = positionsData.AllPosition.map((position) => ({
            _id: position._id,
            name: position.positionName,
          }));
          setPositions(positionNames);
        } else {
          message.error("Dữ liệu Chức vụ không hợp lệ");
        }

        if (departmentsData && Array.isArray(departmentsData.AllDepartment)) {
          const departmentNames = departmentsData.AllDepartment.map((department) => ({
            _id: department._id,
            name: department.departmentName,
          }));
          setDepartments(departmentNames);
        } else {
          message.error("Dữ liệu phòng ban không hợp lệ");
        }
      } catch (error) {
        message.error("Lỗi khi tải dữ liệu!");
        console.error("Lỗi lấy dữ liệu:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Xử lý xóa người dùng
  const handleDelete = async (userId) => {
    Modal.confirm({
      title: "Bạn có chắc chắn muốn xóa người dùng này?",
      content: "Hành động này không thể hoàn tác!",
      okText: "Xóa",
      cancelText: "Hủy",
      okType: "danger",
      onOk: async () => {
        try {
          const response = await deleteUser(userId);
          if (response.success) {
            const updatedUsers = allUsers.filter((user) => user._id !== userId);
            setAllUsers(updatedUsers);
            message.success("Xóa người dùng thành công!");
          } else {
            message.error(response.message || "Lỗi khi xóa người dùng!");
          }
        } catch (error) {
          message.error(error.message || "Lỗi khi xóa người dùng!");
          console.error("Lỗi khi xóa:", error);
        }
      },
    });
  };

  // Vô hiệu hóa người dùng
  const handleBan = async (userId) => {
    Modal.confirm({
      title: "Bạn có chắc chắn muốn vô hiệu hóa người dùng này?",
      okText: "Vô hiệu hóa",
      cancelText: "Hủy",
      okType: "danger",
      onOk: async () => {
        try {
          const response = await disableUser(userId);
          if (response.success) {
            const updatedUsers = allUsers.map((user) => (user._id === userId ? { ...user, role: null } : user));
            setAllUsers(updatedUsers);
            message.success("Vô hiệu hóa người dùng thành công!");
          } else {
            message.error(response.message || "Lỗi khi vô hiệu hóa người dùng!");
          }
        } catch (error) {
          message.error(error.message);
          console.error("Lỗi khi vô hiệu hóa:", error);
        }
      },
    });
  };

  // Mở modal khôi phục
  const handleUnban = (user) => {
    setSelectedUser(user);
    setIsRestoreModalVisible(true);
  };

  // Khôi phục người dùng
  const handleRestore = async (values) => {
    if (!selectedUser) return;
    try {
      const response = await restoreUser(selectedUser._id, values.role);
      if (response.success) {
        const updatedUsers = allUsers.map((user) =>
          user._id === selectedUser._id ? { ...user, role: values.role } : user
        );
        setAllUsers(updatedUsers);
        message.success("Khôi phục người dùng thành công!");
        setIsRestoreModalVisible(false);
        restoreForm.resetFields();
      } else {
        message.error(response.message || "Lỗi khi khôi phục người dùng!");
      }
    } catch (error) {
      message.error(error.message);
      console.error("Lỗi khi khôi phục:", error);
    }
  };

  // Mở modal chỉnh sửa
  const handleEdit = (user) => {
    setSelectedUser(user);
    form.setFieldsValue({
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      position: user.position?._id,
      department: user.department?._id,
      description: user.description || "",
      password: "",
    });
    setIsModalVisible(true);
  };

  // Cập nhật thông tin người dùng
  const handleUpdate = async (values) => {
    if (!selectedUser) return;
    try {
      const updatedData = {
        name: values.name,
        email: values.email,
        mobile: values.mobile,
        role: values.role,
        position: values.position,
        department: values.department,
        description: values.description,
        password: values.password || undefined,
      };
      const response = await updateUserInfo(selectedUser._id, updatedData);
      if (response.success) {
        // Tìm position và department objects từ ID
        const positionObj = positions.find(p => p._id === updatedData.position);
        const departmentObj = departments.find(d => d._id === updatedData.department);
        
        const updatedUsers = allUsers.map((user) =>
          user._id === selectedUser._id 
            ? { 
                ...user, 
                ...updatedData,
                position: positionObj ? { _id: positionObj._id, positionName: positionObj.name } : user.position,
                department: departmentObj ? { _id: departmentObj._id, departmentName: departmentObj.name } : user.department,
              } 
            : user
        );
        setAllUsers(updatedUsers);
        message.success("Cập nhật thông tin người dùng thành công!");
        setIsModalVisible(false);
        form.resetFields();
        // Không cần reload trang nữa vì đã cập nhật state
      } else {
        message.error(response.message || "Lỗi khi cập nhật thông tin người dùng!");
      }
    } catch (error) {
      message.error(error.toString() || "Lỗi khi cập nhật thông tin người dùng!");
      console.error("Lỗi khi cập nhật:", error);
    }
  };

  // Kiểm tra quyền chỉnh sửa/vô hiệu hóa/khôi phục/xóa
  const hasPermission = () => {
    return currentUserRole === "admin" || currentUserRole === "manager";
  };

  // ======================= XUẤT / NHẬP EXCEL =======================
  const normalize = (str) =>
    str ? removeVietnameseTones(String(str).trim().toLowerCase()) : "";

  // 1. Xuất danh sách người dùng ra Excel
  const handleExportExcel = () => {
    if (!users || users.length === 0) {
      message.warning("Không có dữ liệu người dùng để xuất Excel");
      return;
    }

    const exportRows = users.map((u, idx) => {
      const posName =
        u.position?.positionName ||
        positions.find((p) => p._id === u.position)?.name ||
        "";
      const deptName =
        u.department?.departmentName ||
        departments.find((d) => d._id === u.department)?.name ||
        "";
      const roleObj = roles.find((r) => r._id === u.role);
      const roleName =
        u.role === "admin"
          ? "Quản trị viên (Admin)"
          : roleObj
          ? roleObj.name
          : u.role || "Vô hiệu hóa";
      const statusStr = u.role ? "Đang hoạt động" : "Đã vô hiệu hóa";

      return {
        STT: idx + 1,
        "Họ và tên": u.name || "",
        Email: u.email || "",
        "Số điện thoại": u.mobile || "",
        "Đơn vị / Phòng ban": deptName,
        "Chức vụ": posName,
        "Vai trò": roleName,
        "Trạng thái": statusStr,
        "Ghi chú / Mô tả": u.description || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = [
      { wch: 6 },  // STT
      { wch: 25 }, // Họ tên
      { wch: 28 }, // Email
      { wch: 15 }, // SĐT
      { wch: 28 }, // Đơn vị
      { wch: 20 }, // Chức vụ
      { wch: 18 }, // Vai trò
      { wch: 16 }, // Trạng thái
      { wch: 30 }, // Ghi chú
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Nguoi_Dung");
    XLSX.writeFile(wb, `Danh_Sach_Nguoi_Dung_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`);
    message.success(`Đã xuất thành công ${exportRows.length} người dùng ra file Excel!`);
  };

  // 2. Tải file mẫu Excel kèm Sheet danh mục tham chiếu (Đơn vị, Chức vụ, Vai trò)
  const handleDownloadTemplate = () => {
    const sampleDept = departments[0]?.name || "Khoa Công Nghệ Thông Tin";
    const sampleDept2 = departments[1]?.name || departments[0]?.name || "Phòng Đào Tạo";
    const samplePos = positions[0]?.name || "Giảng viên";
    const samplePos2 = positions[1]?.name || positions[0]?.name || "Chuyên viên";

    const templateData = [
      {
        STT: 1,
        "Họ và tên (*)": "Nguyễn Văn A",
        "Email (*)": "nguyenvana@namsaigon.edu.vn",
        "Số điện thoại (*)": "0901234567",
        "Mật khẩu": "123456",
        "Đơn vị / Phòng ban (*)": sampleDept,
        "Chức vụ (*)": samplePos,
        "Vai trò (*)": "Cấp trưởng",
        "Ghi chú": "Cán bộ quản lý",
      },
      {
        STT: 2,
        "Họ và tên (*)": "Trần Thị B",
        "Email (*)": "tranthib@namsaigon.edu.vn",
        "Số điện thoại (*)": "0912345678",
        "Mật khẩu": "123456",
        "Đơn vị / Phòng ban (*)": sampleDept2,
        "Chức vụ (*)": samplePos2,
        "Vai trò (*)": "GV-VC",
        "Ghi chú": "Nhân viên phòng ban / Giảng viên",
      },
    ];

    const wsUsers = XLSX.utils.json_to_sheet(templateData);
    wsUsers["!cols"] = [
      { wch: 6 },  // STT
      { wch: 22 }, // Họ tên
      { wch: 30 }, // Email
      { wch: 16 }, // SĐT
      { wch: 14 }, // Mật khẩu
      { wch: 32 }, // Đơn vị
      { wch: 22 }, // Chức vụ
      { wch: 18 }, // Vai trò
      { wch: 26 }, // Ghi chú
    ];

    // Sheet 2: Danh mục tham chiếu
    const maxRows = Math.max(departments.length, positions.length, roles.length, 5);
    const refData = [];
    for (let i = 0; i < maxRows; i++) {
      const dept = departments[i];
      const pos = positions[i];
      const role = roles[i];

      let note = "";
      if (i === 0) note = "1. Các cột có dấu (*) là thông tin bắt buộc phải có.";
      else if (i === 1) note = "2. Cột Đơn vị / Phòng ban: nhập đúng tên theo danh mục tại sheet này.";
      else if (i === 2) note = "3. Cột Chức vụ: nhập đúng tên theo danh mục tại sheet này.";
      else if (i === 3) note = "4. Cột Vai trò có thể nhập: Manager, Cấp trưởng, Cấp phó, GV-VC (hoặc Chuyên viên).";
      else if (i === 4) note = "5. Cột Mật khẩu nếu để trống thì hệ thống sẽ tự đặt mặc định là 123456.";

      refData.push({
        "STT ĐV": dept ? i + 1 : "",
        "Đơn vị / Phòng ban": dept ? dept.name : "",
        "STT CV": pos ? i + 1 : "",
        "Chức vụ": pos ? pos.name : "",
        "Mã vai trò": role ? role._id : "",
        "Tên vai trò": role ? role.name : "",
        "Hướng dẫn nhập liệu": note,
      });
    }

    const wsRef = XLSX.utils.json_to_sheet(refData);
    wsRef["!cols"] = [
      { wch: 8 },  // STT ĐV
      { wch: 32 }, // Đơn vị
      { wch: 8 },  // STT CV
      { wch: 24 }, // Chức vụ
      { wch: 14 }, // Mã vai trò
      { wch: 18 }, // Tên vai trò
      { wch: 65 }, // Hướng dẫn
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsUsers, "Danh_Sach_Nguoi_Dung");
    XLSX.utils.book_append_sheet(wb, wsRef, "Danh_Muc_Tham_Chieu");

    XLSX.writeFile(wb, "Mau_Import_Nguoi_Dung_NSG.xlsx");
    message.success("Đã tải file mẫu Excel kèm Sheet danh mục tham chiếu!");
  };

  // Tra cứu Đơn vị / Chức vụ / Vai trò
  const resolveRole = (input) => {
    if (!input) return null;
    const s = normalize(input);
    if (s.includes("quan tri") || s === "admin") return null;
    if (s.includes("manager") || s.includes("quan ly")) return "manager";
    if (s.includes("truong") || s === "staff" || s.includes("cap truong")) return "staff";
    if (s.includes("pho") || s === "cappho" || s.includes("cap pho")) return "cappho";
    if (
      s.includes("chuyen vien") ||
      s === "chuyenvien" ||
      s.includes("nhan vien") ||
      s.includes("gv-vc") ||
      s.includes("gvvc") ||
      s.includes("giang vien") ||
      s.includes("vien chuc")
    )
      return "chuyenvien";
    return null;
  };

  const resolveDepartment = (input) => {
    if (!input) return null;
    const norm = normalize(input);
    let found = departments.find((d) => normalize(d.name) === norm);
    if (!found) {
      found = departments.find(
        (d) => normalize(d.name).includes(norm) || norm.includes(normalize(d.name))
      );
    }
    return found || null;
  };

  const resolvePosition = (input) => {
    if (!input) return null;
    const norm = normalize(input);
    let found = positions.find((p) => normalize(p.name) === norm);
    if (!found) {
      found = positions.find(
        (p) => normalize(p.name).includes(norm) || norm.includes(normalize(p.name))
      );
    }
    return found || null;
  };

  // 3. Đọc và phân tích file Excel import
  const handleFileUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!rawJson || rawJson.length === 0) {
          message.error("File Excel không có dữ liệu!");
          return;
        }

        const parsed = [];
        let validCount = 0;
        let invalidCount = 0;
        const emailSet = new Set(allUsers.map((u) => (u.email || "").toLowerCase()));
        const fileEmailSet = new Set();

        rawJson.forEach((row, idx) => {
          const getVal = (...keys) => {
            for (const k of Object.keys(row)) {
              const kNorm = normalize(k);
              for (const target of keys) {
                if (kNorm.includes(normalize(target))) {
                  return String(row[k]).trim();
                }
              }
            }
            return "";
          };

          const name = getVal("ho va ten", "ho ten", "ten", "name");
          const email = getVal("email", "thu dien tu").toLowerCase();
          const mobile = getVal("so dien thoai", "sdt", "dien thoai", "mobile", "phone");
          const password = getVal("mat khau", "password") || "123456";
          const deptRaw = getVal("don vi", "phong ban", "khoa", "department");
          const posRaw = getVal("chuc vu", "position");
          const roleRaw = getVal("vai tro", "role", "quyen");
          const description = getVal("ghi chu", "mo ta", "description");

          const errors = [];
          if (!name) errors.push("Thiếu Họ và tên");
          if (!email) {
            errors.push("Thiếu Email");
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push("Email không hợp lệ");
          } else if (emailSet.has(email)) {
            errors.push("Email đã tồn tại trên hệ thống");
          } else if (fileEmailSet.has(email)) {
            errors.push("Email bị trùng lặp trong file");
          }

          if (!mobile) errors.push("Thiếu Số điện thoại");

          const matchedDept = resolveDepartment(deptRaw);
          if (!matchedDept) {
            errors.push(`Không tìm thấy đơn vị '${deptRaw || "Trống"}'`);
          }

          const matchedPos = resolvePosition(posRaw);
          if (!matchedPos) {
            errors.push(`Không tìm thấy chức vụ '${posRaw || "Trống"}'`);
          }

          const matchedRole = resolveRole(roleRaw);
          if (!matchedRole) {
            errors.push(
              `Vai trò '${roleRaw || "Trống"}' không hợp lệ (hỗ trợ: Manager, Cấp trưởng, Cấp phó, GV-VC)`
            );
          }

          if (email && !fileEmailSet.has(email)) {
            fileEmailSet.add(email);
          }

          const isValid = errors.length === 0;
          if (isValid) validCount++;
          else invalidCount++;

          parsed.push({
            key: idx,
            rowNumber: idx + 2,
            name,
            email,
            mobile,
            password,
            department: matchedDept ? matchedDept._id : null,
            departmentName: matchedDept ? matchedDept.name : deptRaw,
            position: matchedPos ? matchedPos._id : null,
            positionName: matchedPos ? matchedPos.name : posRaw,
            role: matchedRole || "staff",
            roleName: roles.find((r) => r._id === matchedRole)?.name || roleRaw,
            description,
            isValid,
            errors,
          });
        });

        setParsedUsers(parsed);
        setImportSummary({ total: parsed.length, valid: validCount, invalid: invalidCount });
        setIsImportModalVisible(true);
      } catch (err) {
        console.error("Lỗi đọc file Excel:", err);
        message.error("Không thể đọc nội dung file Excel!");
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  // 4. Xác nhận Import dữ liệu hợp lệ
  const handleExecuteImport = async () => {
    const validUsers = parsedUsers.filter((u) => u.isValid);
    if (validUsers.length === 0) {
      message.warning("Không có dòng dữ liệu hợp lệ nào để import!");
      return;
    }

    try {
      setImportLoading(true);
      const payload = validUsers.map((u) => ({
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        password: u.password,
        department: u.department,
        position: u.position,
        role: u.role,
        description: u.description,
      }));

      const res = await importUsersApi(payload);
      if (res.success) {
        message.success(res.message || `Đã nhập thành công ${res.createdCount} người dùng!`);
        setIsImportModalVisible(false);
        setParsedUsers([]);
        // Nạp lại danh sách người dùng
        const usersResponse = await getAllUsersCanSearchBanUser();
        if (usersResponse && usersResponse.users) {
          setUsers(usersResponse.users);
          setAllUsers(usersResponse.users);
        }
      } else {
        message.error(res.message || "Lỗi khi nhập danh sách người dùng!");
      }
    } catch (err) {
      console.error(err);
      message.error(err.toString() || "Lỗi khi nhập danh sách người dùng!");
    } finally {
      setImportLoading(false);
    }
  };

  // Xử lý thay đổi bộ lọc
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Áp dụng bộ lọc
  const applyFilters = useMemo(() => {
    let filtered = [...allUsers];

    if (filters.name) {
      const searchName = removeVietnameseTones(filters.name.toLowerCase());
      filtered = filtered.filter((user) =>
        removeVietnameseTones(user.name?.toLowerCase() || "").includes(searchName)
      );
    }

    if (filters.email) {
      const searchEmail = removeVietnameseTones(filters.email.toLowerCase());
      filtered = filtered.filter((user) =>
        removeVietnameseTones(user.email?.toLowerCase() || "").includes(searchEmail)
      );
    }

    if (filters.mobile) {
      const searchMobile = removeVietnameseTones(filters.mobile);
      filtered = filtered.filter((user) =>
        removeVietnameseTones(user.mobile || "").includes(searchMobile)
      );
    }

    if (filters.position) {
      filtered = filtered.filter((user) => {
        const positionId = typeof user.position === 'object' ? user.position?._id : user.position;
        return positionId === filters.position;
      });
    }

    if (filters.department) {
      filtered = filtered.filter((user) => {
        const departmentId = typeof user.department === 'object' ? user.department?._id : user.department;
        return departmentId === filters.department;
      });
    }

    return filtered;
  }, [allUsers, filters]);

  // Cập nhật danh sách người dùng khi filter thay đổi
  useEffect(() => {
    setUsers(applyFilters);
    // Reset pagination về trang 1 khi filter thay đổi
    setPagination(prev => ({
      ...prev,
      current: 1,
    }));
  }, [applyFilters]);

  // Xử lý tìm kiếm
  const handleSearch = () => {
    // Filter đã được áp dụng tự động qua useMemo
  };

  // Đặt lại bộ lọc
  const handleResetFilters = () => {
    setFilters({
      name: "",
      email: "",
      mobile: "",
      position: null,
      department: null,
    });
    setUsers(allUsers);
  };

  // Cấu hình bảng
  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 60,
      align: "center",
      render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
    },
    { title: "Họ tên", dataIndex: "name", key: "name" },
    { title: "Email", dataIndex: "email", key: "email", render: (email) => email || "Chưa có" },
    { title: "Số Điện Thoại", dataIndex: "mobile", key: "mobile" },
    {
      title: "Chức vụ",
      dataIndex: ["position", "positionName"],
      key: "position",
      render: (positionName) => positionName || "Không có",
      width: 180,
    },
    {
      title: "Phòng ban",
      dataIndex: ["department", "departmentName"],
      key: "department",
      render: (departmentName) => departmentName || "Không có",
      width: 200,
    },
    { 
      title: "Vai Trò", 
      dataIndex: "role", 
      key: "role", 
      render: (role) => {
        if (!role) return "Bị vô hiệu hóa";
        const roleObj = roles.find(r => r._id === role);
        return roleObj ? roleObj.name : role;
      } 
    },
    {
      title: "Hành Động",
      key: "action",
      className: "action-col", fixed: "right", align: "center",
      render: (_, record) =>
        hasPermission() && (
          <div className="flex flex-wrap gap-2 justify-center">
            <Tooltip title="Chỉnh sửa thông tin">
              <Button type="primary" icon={<EditOutlined />} onClick={() => handleEdit(record)} className="text-xs rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center">
                <span className="hidden sm:inline text-xs">Sửa</span>
              </Button>
            </Tooltip>
            {record.role ? (
              <Tooltip title="Vô hiệu hóa tài khoản">
                <Button type="default" danger icon={<UserDeleteOutlined />} onClick={() => handleBan(record._id)} className="text-xs rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center">
                  <span className="hidden sm:inline text-xs">Khóa</span>
                </Button>
              </Tooltip>
            ) : (
              <Tooltip title="Khôi phục tài khoản">
                <Button type="default" icon={<UserAddOutlined />} onClick={() => handleUnban(record)} className="text-xs rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center">
                  <span className="hidden sm:inline text-xs">Khôi phục</span>
                </Button>
              </Tooltip>
            )}
            {currentUserRole === "admin" && (
              <Tooltip title="Xóa tài khoản">
                <Button type="default" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record._id)} className="text-xs rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center">
                  <span className="hidden sm:inline text-xs">Xóa</span>
                </Button>
              </Tooltip>
            )}
          </div>
        ),
    },
  ];

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-gray-50 min-h-screen">
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mb-3 sm:mb-4 md:mb-6 text-center">
        Danh Sách Người Dùng
      </h2>
      <div className="mb-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 md:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/CreateUser">
            <Button type="primary" icon={<UserAddOutlined />} className="rounded-md">
              Tạo tài khoản
            </Button>
          </Link>
          <Upload
            accept=".xlsx,.xls"
            showUploadList={false}
            beforeUpload={handleFileUpload}
          >
            <Button icon={<UploadOutlined />} className="rounded-md bg-amber-500 hover:bg-amber-600 text-white border-none">
              Nhập từ Excel
            </Button>
          </Upload>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownloadTemplate}
            className="rounded-md text-blue-600 border-blue-400 hover:bg-blue-50"
          >
            Tải file mẫu Excel
          </Button>
        </div>
        <div>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            onClick={handleExportExcel}
            style={{ backgroundColor: "#52c41a" }}
            className="rounded-md w-full md:w-auto"
          >
            Xuất Excel ({users.length})
          </Button>
        </div>
      </div>

      {/* Form lọc */}
      <Card className="mb-4 md:mb-6 p-3 md:p-4 shadow-sm rounded-lg border border-gray-200">
        <FilterFormWrapper onSearch={handleSearch}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 items-end">
            <Input
              placeholder="Tìm theo tên"
              value={filters.name}
              onChange={(e) => handleFilterChange("name", e.target.value)}
              className="w-full rounded-md"
              allowClear
            />
            <Input
              placeholder="Tìm theo email"
              value={filters.email}
              onChange={(e) => handleFilterChange("email", e.target.value)}
              className="w-full rounded-md"
              allowClear
            />
            <Input
              placeholder="Tìm theo số điện thoại"
              value={filters.mobile}
              onChange={(e) => handleFilterChange("mobile", e.target.value)}
              className="w-full rounded-md"
              allowClear
            />
            <Select
              placeholder="Chức vụ"
              value={filters.position}
              onChange={(value) => handleFilterChange("position", value)}
              allowClear
              className="w-full"
              showSearch
              filterOption={(input, option) =>
                (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
              }
            >
              {positions.map((position) => (
                <Select.Option key={position._id} value={position._id}>
                  {position.name}
                </Select.Option>
              ))}
            </Select>
            <Select
              placeholder="Phòng ban"
              value={filters.department}
              onChange={(value) => handleFilterChange("department", value)}
              allowClear
              className="w-full"
              showSearch
              filterOption={(input, option) =>
                (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
              }
            >
              {departments.map((department) => (
                <Select.Option key={department._id} value={department._id}>
                  {department.name}
                </Select.Option>
              ))}
            </Select>
            <div className="flex gap-2 col-span-full sm:col-span-1 justify-end">
              <Tooltip title="Lọc dữ liệu">
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} className="rounded-md">
                  <span className="hidden sm:inline">Lọc</span>
                </Button>
              </Tooltip>
              <Tooltip title="Đặt lại bộ lọc">
                <Button type="default" icon={<ReloadOutlined />} onClick={handleResetFilters} className="rounded-md">
                  <span className="hidden sm:inline">Đặt lại</span>
                </Button>
              </Tooltip>
            </div>
          </div>
        </FilterFormWrapper>
      </Card>
      {loading ? (
        <div className="text-center mt-5">
          <Spin size="large" />
        </div>
      ) : (
        <Table 
          columns={columns} 
          dataSource={users} 
          rowKey="_id" 
          bordered 
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            pageSizeOptions: pagination.pageSizeOptions,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} người dùng`,
            size: "small",
            responsive: true,
            showLessItems: true,
            onChange: (page, pageSize) => {
              setPagination(prev => ({
                ...prev,
                current: page,
                pageSize: pageSize,
              }));
            },
            onShowSizeChange: (current, size) => {
              setPagination(prev => ({
                ...prev,
                current: 1,
                pageSize: size,
              }));
            },
          }}
          scroll={{ x: 'max-content' }}
          size="small"
        />
      )}

      {/* Modal chỉnh sửa */}
      <Modal
        title="Chỉnh sửa thông tin"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width="90%"
        style={{ maxWidth: 600 }}
      >
        <Form form={form} onFinish={handleUpdate} layout="vertical">
          <Form.Item name="name" label="Họ tên" rules={[{ required: true, message: "Vui lòng nhập họ tên!" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="mobile" label="Số Điện Thoại">
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="Mật Khẩu"
            rules={[
              {
                min: 6,
                message: "Mật khẩu phải có ít nhất 6 ký tự!",
              },
            ]}
          >
            <Input.Password placeholder="Nhập mật khẩu mới (để trống nếu không thay đổi)" />
          </Form.Item>
          <Form.Item
            name="position"
            label="Chức danh / Chức vụ"
            rules={[{ required: true, message: "Vui lòng chọn Chức danh / Chức vụ!" }]}
          >
            <Select placeholder="Chọn vị trí" loading={positions.length === 0}>
              {positions.map((position) => (
                <Select.Option key={position._id} value={position._id}>
                  {position.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="department"
            label="Phòng Ban"
            rules={[{ required: true, message: "Vui lòng chọn phòng ban!" }]}
          >
            <Select placeholder="Chọn phòng ban" loading={departments.length === 0}>
              {departments.map((department) => (
                <Select.Option key={department._id} value={department._id}>
                  {department.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="role" label="Vai Trò" rules={[{ required: true, message: "Vui lòng chọn vai trò!" }]}>
            <Select placeholder="Chọn vai trò">
              {roles.map((role) => (
                <Select.Option key={role._id} value={role._id}>
                  {role.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Mô Tả">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Cập nhật
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => setIsModalVisible(false)}>
              Hủy
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal khôi phục */}
      <Modal
        title="Khôi phục người dùng"
        open={isRestoreModalVisible}
        onCancel={() => setIsRestoreModalVisible(false)}
        footer={null}
      >
        <Form form={restoreForm} onFinish={handleRestore} layout="vertical">
          <Form.Item
            name="role"
            label="Vai Trò"
            rules={[{ required: true, message: "Vui lòng chọn vai trò!" }]}
          >
            <Select placeholder="Chọn vai trò">
              {roles.map((role) => (
                <Select.Option key={role._id} value={role._id}>
                  {role.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Khôi phục
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => setIsRestoreModalVisible(false)}>
              Hủy
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal xem trước và xác nhận Import Excel */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-blue-700">
            <FileExcelOutlined className="text-green-600" />
            Xem Trước Dữ Liệu Import Người Dùng
          </div>
        }
        open={isImportModalVisible}
        onCancel={() => {
          setIsImportModalVisible(false);
          setParsedUsers([]);
        }}
        width={1000}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setIsImportModalVisible(false);
              setParsedUsers([]);
            }}
          >
            Hủy
          </Button>,
          <Button
            key="import"
            type="primary"
            loading={importLoading}
            disabled={importSummary.valid === 0}
            onClick={handleExecuteImport}
            style={{ backgroundColor: "#1890ff" }}
          >
            Xác nhận Import ({importSummary.valid} người dùng hợp lệ)
          </Button>,
        ]}
      >
        <div className="space-y-3">
          <Alert
            message={
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                <span>
                  Tổng số dòng trong file: <b>{importSummary.total}</b>
                </span>
                <span className="text-green-600 font-semibold">
                  Hợp lệ: <b>{importSummary.valid}</b>
                </span>
                <span className="text-red-600 font-semibold">
                  Không hợp lệ: <b>{importSummary.invalid}</b>
                </span>
              </div>
            }
            type={importSummary.invalid > 0 ? "warning" : "success"}
            showIcon
          />

          <Table
            dataSource={parsedUsers}
            rowKey="key"
            size="small"
            bordered
            pagination={{ pageSize: 10, showLessItems: true, responsive: true }}
            scroll={{ x: 850 }}
            columns={[
              {
                title: "Dòng",
                dataIndex: "rowNumber",
                key: "rowNumber",
                width: 60,
                align: "center",
              },
              {
                title: "Trạng thái",
                key: "status",
                width: 110,
                align: "center",
                render: (_, r) =>
                  r.isValid ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>
                      Hợp lệ
                    </Tag>
                  ) : (
                    <Tooltip title={r.errors.join("; ")}>
                      <Tag color="error" icon={<CloseCircleOutlined />} className="cursor-pointer">
                        Lỗi ({r.errors.length})
                      </Tag>
                    </Tooltip>
                  ),
              },
              {
                title: "Họ và tên",
                dataIndex: "name",
                key: "name",
                render: (n, r) => (
                  <span className={!r.name ? "text-red-500 italic" : "font-medium"}>
                    {n || "Thiếu tên"}
                  </span>
                ),
              },
              {
                title: "Email",
                dataIndex: "email",
                key: "email",
                render: (e, r) => (
                  <span className={!r.email || r.errors.some((err) => err.includes("Email")) ? "text-red-500" : ""}>
                    {e || "Thiếu email"}
                  </span>
                ),
              },
              {
                title: "Số ĐT",
                dataIndex: "mobile",
                key: "mobile",
              },
              {
                title: "Đơn vị / Phòng ban",
                dataIndex: "departmentName",
                key: "departmentName",
                render: (d, r) => (
                  <span className={!r.department ? "text-red-500" : ""}>
                    {d || "Chưa xác định"}
                  </span>
                ),
              },
              {
                title: "Chức vụ",
                dataIndex: "positionName",
                key: "positionName",
                render: (p, r) => (
                  <span className={!r.position ? "text-red-500" : ""}>
                    {p || "Chưa xác định"}
                  </span>
                ),
              },
              {
                title: "Vai trò",
                dataIndex: "roleName",
                key: "roleName",
                width: 110,
                align: "center",
              },
              {
                title: "Chi tiết lỗi",
                key: "errors",
                render: (_, r) =>
                  r.errors && r.errors.length > 0 ? (
                    <span className="text-red-500 text-xs">{r.errors.join(", ")}</span>
                  ) : (
                    <span className="text-green-600 text-xs">Sẵn sàng</span>
                  ),
              },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
};

export default UserListPage;