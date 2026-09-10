/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Upload,
  Tag,
  Space,
  message,
  Alert,
  Typography,
  Divider,
  Spin,
  Tooltip,
  Result,
  Popconfirm,
  AutoComplete,
} from "antd";
import {
  UploadOutlined,
  DownloadOutlined,
  TrophyOutlined,
  UserOutlined,
  BankOutlined,
  IdcardOutlined,
  CalendarOutlined,
  PaperClipOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  DeleteOutlined,
  SendOutlined,
  FilePdfOutlined,
  UserAddOutlined,
  FileExcelOutlined,
  TeamOutlined,
  CrownOutlined,
} from "@ant-design/icons";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import * as XLSX from "xlsx";
import { getUserInfo, getAllUsers } from "../../api/auth";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { getAllPositions } from "../../api/PositionAPI";
import { isBghUser } from "../../utils/userClassification";
import {
  getEmulationTitles,
  getEmulationDocTypes,
  uploadEmulationFiles,
  createEmulationRegistration,
  updateEmulationRegistration,
  getMyEmulationRegistration,
} from "../../api/emulationApi";
import { useNavigate } from "react-router-dom";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// Helper viết hoa chữ cái đầu mỗi từ tiếng Việt
const formatFullName = (str) => {
  if (!str) return "";
  return str
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

// Helper tính toán năm học tự động
const getDefaultSchoolYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  if (month >= 8) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
};

const SCHOOL_YEARS = [
  "2026-2027",
  "2025-2026",
  "2024-2025",
  "2023-2024",
];

const EmulationRegisterPage = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // 1. Phân quyền & Định danh người dùng đăng nhập từ Token
  const token = Cookies.get("accessToken");
  const decodedToken = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode(token);
    } catch (e) {
      console.error("Lỗi decode token:", e);
      return null;
    }
  }, [token]);

  const currentUserId = decodedToken?.userId || decodedToken?._id || decodedToken?.id;
  const currentUserRole = decodedToken?.role;

  const isManagerOrAdmin = currentUserRole === "manager" || currentUserRole === "admin";
  const isCapTruong = currentUserRole === "staff" || currentUserRole === "captruong";
  const canAccess = isManagerOrAdmin || isCapTruong;

  // 2. State dữ liệu
  const [currentUser, setCurrentUser] = useState(null);
  const [titles, setTitles] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [allUsersList, setAllUsersList] = useState([]);

  // Dành cho Manager / Admin: chọn đơn vị hoặc nhóm BGH
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [selectedDeptName, setSelectedDeptName] = useState("");
  const [selectedTargetUserId, setSelectedTargetUserId] = useState(null);

  // Danh sách thành viên đề nghị trong hồ sơ: [{ id, name, positionName, departmentName, titles: [] }]
  const [members, setMembers] = useState([]);

  // Danh sách file đính kèm: { [docTypeId]: fileObject }
  const [attachedFilesMap, setAttachedFilesMap] = useState({});

  const [existingReg, setExistingReg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState(null);

  const selectedSchoolYear = Form.useWatch("schoolYear", form) || getDefaultSchoolYear();

  // Đơn vị áp dụng của Cấp trưởng đăng nhập
  const capTruongDeptName = useMemo(() => {
    return currentUser?.department?.departmentName || "Chưa phân bổ";
  }, [currentUser]);

  // Đơn vị hiện tại áp dụng cho hồ sơ
  const currentActiveDeptName = useMemo(() => {
    if (isManagerOrAdmin) {
      return selectedDeptName || capTruongDeptName;
    }
    return capTruongDeptName;
  }, [isManagerOrAdmin, selectedDeptName, capTruongDeptName]);

  // Danh sách người dùng để Manager/Admin chọn làm cán bộ đại diện (BGH + Cấp trưởng)
  const representativeUsers = useMemo(() => {
    const bgh = allUsersList.filter(isBghUser);
    const capTruong = allUsersList.filter(
      (u) => (u.role === "staff" || u.role === "captruong") && !isBghUser(u)
    );
    return { bgh, capTruong };
  }, [allUsersList]);

  // Helper kiểm tra một user có thuộc đơn vị hay không
  const isUserInDept = useCallback((u, deptId, deptName) => {
    if (!u) return false;
    const uDeptId = String(u.department?._id || u.department || "");
    const uDeptName = (u.department?.departmentName || "").trim().toLowerCase();
    const targetDeptId = String(deptId || "");
    const targetDeptName = (deptName || "").trim().toLowerCase();

    if (targetDeptId && uDeptId && targetDeptId === uDeptId) return true;
    if (targetDeptName && uDeptName && targetDeptName === uDeptName) return true;
    return false;
  }, []);

  // Danh sách nhân sự khả dụng để gợi ý và nhận diện:
  // - Cấp trưởng: CHỈ lọc nhân sự thuộc đơn vị của cấp trưởng đăng nhập
  // - Manager / Admin: Thấy và chọn được toàn bộ nhân sự trường như hiện tại
  const availableUsersForRegistration = useMemo(() => {
    if (!isCapTruong) {
      return allUsersList;
    }

    const myDeptId = currentUser?.department?._id || currentUser?.department || "";
    const myDeptName = currentUser?.department?.departmentName || capTruongDeptName || "";

    return allUsersList.filter((u) => isUserInDept(u, myDeptId, myDeptName));
  }, [isCapTruong, allUsersList, currentUser, capTruongDeptName, isUserInDept]);

  // Gợi ý autocomplete danh sách tên nhân sự (Cấp trưởng chỉ gợi ý người đơn vị mình, Manager thấy hết)
  const userAutoCompleteOptions = useMemo(() => {
    return availableUsersForRegistration.map((u) => ({
      value: u.name,
      label: (
        <div className="flex justify-between items-center py-0.5">
          <span className="font-medium text-gray-800">{u.name}</span>
          <span className="text-xs text-gray-400">
            {u.position?.positionName || "Cán bộ"} - {u.department?.departmentName || ""}
          </span>
        </div>
      ),
      userData: u,
    }));
  }, [availableUsersForRegistration]);

  // 3. Khởi tạo dữ liệu ban đầu
  const initData = useCallback(async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const promises = [
        getUserInfo(currentUserId),
        getEmulationTitles({ activeOnly: "true" }),
        getEmulationDocTypes({ activeOnly: "true" }),
        getAllDepartments(),
        getAllPositions(),
        getAllUsers(),
      ];

      const results = await Promise.all(promises);
      const userRes = results[0];
      const titlesRes = results[1];
      const docsRes = results[2];
      const deptsRes = results[3];
      const posRes = results[4];
      const usersRes = results[5];

      // 1. User hiện tại
      if (userRes?.data) {
        const u = userRes.data;
        setCurrentUser(u);
        const deptName = u.department?.departmentName || "Chưa phân bổ";
        setSelectedDeptId(u.department?._id || null);
        setSelectedDeptName(deptName);

        form.setFieldsValue({
          name: u.name || "",
          departmentName: deptName,
          positionName: u.position?.positionName || "Chưa phân bổ",
          email: u.email || "",
          schoolYear: getDefaultSchoolYear(),
        });
      }

      // 2. Danh mục danh hiệu & hồ sơ
      if (titlesRes?.success) setTitles(titlesRes.data || []);
      if (docsRes?.success) setDocTypes(docsRes.data || []);

      // 3. Toàn bộ danh sách đơn vị (AllDepartment)
      const allDepts = Array.isArray(deptsRes)
        ? deptsRes
        : Array.isArray(deptsRes?.AllDepartment)
        ? deptsRes.AllDepartment
        : Array.isArray(deptsRes?.data)
        ? deptsRes.data
        : [];
      setDepartments(allDepts);

      // 4. Toàn bộ danh sách chức vụ (AllPosition)
      const allPositions = Array.isArray(posRes)
        ? posRes
        : Array.isArray(posRes?.AllPosition)
        ? posRes.AllPosition
        : Array.isArray(posRes?.data)
        ? posRes.data
        : [];
      setPositions(allPositions);

      // 5. Toàn bộ danh sách người dùng (users)
      const allUsers = Array.isArray(usersRes)
        ? usersRes
        : Array.isArray(usersRes?.users)
        ? usersRes.users
        : Array.isArray(usersRes?.data)
        ? usersRes.data
        : [];
      setAllUsersList(allUsers);
    } catch (err) {
      console.error("Lỗi initData:", err);
      message.error("Lỗi khi tải thông tin từ hệ thống");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, form]);

  useEffect(() => {
    initData();
  }, [initData]);

  // 4. Kiểm tra hồ sơ đề nghị đã có trong năm học
  const checkExistingRegistration = useCallback(
    async (year, deptId = null, targetUid = null) => {
      if (!year) return;
      try {
        const params = { schoolYear: year };
        if (isManagerOrAdmin) {
          if (deptId && deptId !== "BGH") params.departmentId = deptId;
          if (targetUid) params.targetUserId = targetUid;
        }

        const res = await getMyEmulationRegistration(params);
        if (res.success && res.data) {
          const reg = res.data;
          setExistingReg(reg);
          form.setFieldsValue({
            notes: reg.notes || "",
            name: reg.name,
            positionName: reg.positionName,
            departmentName: reg.departmentName,
          });

          // Nạp danh sách thành viên đề nghị
          if (Array.isArray(reg.members) && reg.members.length > 0) {
            setMembers(
              reg.members.map((m, idx) => ({
                id: m._id || `mem_${idx}`,
                name: m.name,
                positionName: m.positionName || "",
                departmentName: m.departmentName || reg.departmentName,
                titles: (m.titles || []).map((t) => (typeof t === "object" ? t._id : t)),
              }))
            );
          } else {
            setMembers([
              {
                id: `mem_default_${Date.now()}`,
                name: reg.name,
                positionName: reg.positionName || "",
                departmentName: reg.departmentName,
                titles: (reg.titles || []).map((t) => (typeof t === "object" ? t._id : t)),
              },
            ]);
          }

          // Nạp file đính kèm
          const fileMap = {};
          (reg.attachedFiles || []).forEach((f) => {
            const docTypeId = f.documentType?._id || f.documentType;
            if (docTypeId) {
              fileMap[docTypeId] = f;
            }
          });
          setAttachedFilesMap(fileMap);
        } else {
          setExistingReg(null);
          form.setFieldsValue({ notes: "" });
          setAttachedFilesMap({});

          // Khởi tạo 1 dòng thành viên mặc định
          const defaultDept = isManagerOrAdmin
            ? selectedDeptName
            : capTruongDeptName;
          const defaultName = isManagerOrAdmin ? "" : currentUser?.name || "";
          const defaultPos = isManagerOrAdmin
            ? ""
            : currentUser?.position?.positionName || "";

          setMembers([
            {
              id: `mem_${Date.now()}`,
              name: defaultName,
              positionName: defaultPos,
              departmentName: defaultDept,
              titles: [],
            },
          ]);
        }
      } catch (err) {
        console.error(err);
      }
    },
    [isManagerOrAdmin, selectedDeptName, capTruongDeptName, currentUser, form]
  );

  useEffect(() => {
    if (selectedSchoolYear && currentUser) {
      checkExistingRegistration(selectedSchoolYear, selectedDeptId, selectedTargetUserId);
    }
  }, [
    selectedSchoolYear,
    selectedDeptId,
    selectedTargetUserId,
    currentUser,
    checkExistingRegistration,
  ]);

  // 5. Khi Manager/Admin đổi đơn vị đề nghị
  const handleManagerChangeDepartment = (deptId) => {
    setSelectedDeptId(deptId);
    setSelectedTargetUserId(null);

    let deptName = "";
    if (deptId === "BGH") {
      deptName = "Ban Giám hiệu";
    } else {
      const found = departments.find((d) => d._id === deptId);
      deptName = found?.departmentName || "";
    }
    setSelectedDeptName(deptName);
    form.setFieldsValue({ departmentName: deptName, name: "", positionName: "" });

    // Cập nhật lại đơn vị cho các thành viên trong bảng
    setMembers((prev) =>
      prev.map((m) => ({
        ...m,
        departmentName: deptName,
      }))
    );
  };

  // Khi Manager/Admin chọn người đại diện lập hồ sơ (BGH hoặc Cấp trưởng)
  const handleManagerChangeTargetUser = (uid) => {
    setSelectedTargetUserId(uid);
    const targetUser = allUsersList.find((u) => u._id === uid);
    if (targetUser) {
      const posName = targetUser.position?.positionName || "";
      const deptName = targetUser.department?.departmentName || selectedDeptName;

      form.setFieldsValue({
        name: targetUser.name,
        positionName: posName,
      });

      // Nếu đơn vị chưa khớp với đơn vị của cán bộ đại diện thì tự cập nhật
      if (targetUser.department?._id && selectedDeptId !== targetUser.department._id && selectedDeptId !== "BGH") {
        setSelectedDeptId(targetUser.department._id);
        setSelectedDeptName(deptName);
        form.setFieldsValue({ departmentName: deptName });
      }

      // Nếu bảng thành viên chỉ có 1 dòng và chưa có tên thì điền luôn
      if (members.length === 1 && !members[0].name) {
        setMembers([
          {
            ...members[0],
            name: targetUser.name,
            positionName: posName,
            departmentName: deptName,
          },
        ]);
      }
    }
  };

  // 6. Quản lý danh sách thành viên đề nghị
  const handleAddMember = () => {
    setMembers((prev) => [
      ...prev,
      {
        id: `mem_${Date.now()}_${Math.random()}`,
        name: "",
        positionName: "",
        departmentName: isCapTruong ? capTruongDeptName : currentActiveDeptName,
        titles: [],
      },
    ]);
  };

  const handleUpdateMember = (id, field, value) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleUpdateMemberMulti = (id, fieldsObj) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...fieldsObj } : m))
    );
  };

  // Xử lý khi kết thúc nhập Họ và tên (onBlur):
  // 1. Tự động viết hoa chữ cái đầu mỗi từ
  // 2. Rà soát trong CSDL: Cấp trưởng chỉ nhận diện cán bộ trong đơn vị mình; Manager rà soát toàn trường
  const handleMemberNameBlur = (id, rawName) => {
    if (!rawName || !rawName.trim()) return;
    const formatted = formatFullName(rawName);

    // Rà soát trong danh sách cán bộ được phép theo quyền
    const targetUserList = isCapTruong ? availableUsersForRegistration : allUsersList;
    const matchUser = targetUserList.find(
      (u) => u.name && u.name.trim().toLowerCase() === formatted.toLowerCase()
    );

    if (matchUser) {
      const autoPos = matchUser.position?.positionName || "";
      // Với cấp trưởng: đơn vị luôn cố định theo cấp trưởng
      const autoDept = isCapTruong
        ? capTruongDeptName
        : matchUser.department?.departmentName || currentActiveDeptName;

      handleUpdateMemberMulti(id, {
        name: formatted,
        positionName: autoPos || members.find((m) => m.id === id)?.positionName,
        departmentName: autoDept,
      });

      message.success(
        `Đã nhận diện cán bộ: ${matchUser.name} - ${autoPos || "Cán bộ"} (${autoDept})`
      );
    } else {
      handleUpdateMember(id, "name", formatted);

      // Nếu là Cấp trưởng mà tên này thuộc về cán bộ ở đơn vị khác -> cảnh báo rõ ràng
      if (isCapTruong) {
        const otherDeptUser = allUsersList.find(
          (u) => u.name && u.name.trim().toLowerCase() === formatted.toLowerCase()
        );
        if (otherDeptUser) {
          message.warning(
            `Cán bộ "${formatted}" thuộc đơn vị "${otherDeptUser.department?.departmentName || "đơn vị khác"}". Cấp trưởng chỉ đề nghị cho nhân sự thuộc đơn vị mình!`
          );
        }
      }
    }
  };

  // Khi chọn từ gợi ý AutoComplete
  const handleMemberNameSelect = (id, value, option) => {
    const u = option.userData;
    if (u) {
      const formatted = formatFullName(u.name);
      const autoPos = u.position?.positionName || "";
      const autoDept = isCapTruong
        ? capTruongDeptName
        : u.department?.departmentName || currentActiveDeptName;

      handleUpdateMemberMulti(id, {
        name: formatted,
        positionName: autoPos,
        departmentName: autoDept,
      });
      message.success(`Đã chọn cán bộ: ${formatted} - ${autoPos} (${autoDept})`);
    }
  };

  const handleRemoveMember = (id) => {
    if (members.length === 1) {
      message.warning("Danh sách đề nghị cần có ít nhất 1 cán bộ!");
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  // 7. Xuất mẫu Excel
  const handleExportTemplate = () => {
    try {
      const sampleDept = currentActiveDeptName || "Tên đơn vị / Phòng ban";
      const sampleData = [
        {
          STT: 1,
          "Họ và tên": "Nguyễn Văn Luyến",
          "Chức vụ": "Giảng viên",
          "Đơn vị": sampleDept,
          "Danh hiệu đề nghị": "Lao động tiên tiến, Chiến sĩ thi đua cơ sở",
        },
        {
          STT: 2,
          "Họ và tên": "Trần Thị Lan",
          "Chức vụ": "Chuyên viên",
          "Đơn vị": sampleDept,
          "Danh hiệu đề nghị": "Lao động tiên tiến",
        },
      ];

      const ws = XLSX.utils.json_to_sheet(sampleData);
      ws["!cols"] = [
        { wch: 6 },
        { wch: 25 },
        { wch: 25 },
        { wch: 30 },
        { wch: 45 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Thanh_Vien");

      // Sheet 2: Danh mục danh hiệu
      const titleSheetData = titles.map((t, idx) => ({
        STT: idx + 1,
        "Mã danh hiệu": t.code,
        "Tên danh hiệu thi đua": t.name,
        "Cấp khen thưởng": t.level === "CO_SO" ? "Cấp Trường" : "Cấp Tỉnh/TP/Bộ",
        "Đối tượng":
          t.targetType === "CA_NHAN"
            ? "Cá nhân"
            : t.targetType === "TAP_THE"
            ? "Tập thể"
            : "Cá nhân & Tập thể",
      }));
      const wsTitles = XLSX.utils.json_to_sheet(titleSheetData);
      wsTitles["!cols"] = [
        { wch: 6 },
        { wch: 15 },
        { wch: 35 },
        { wch: 20 },
        { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(wb, wsTitles, "Danh_Muc_Danh_Hieu");

      // Sheet 3: Danh mục chức vụ chuẩn
      const posSheetData = positions.map((p, idx) => ({
        STT: idx + 1,
        "Tên chức vụ": p.positionName,
        "Mã chức vụ": p.positionCode || "",
      }));
      const wsPositions = XLSX.utils.json_to_sheet(posSheetData);
      wsPositions["!cols"] = [{ wch: 6 }, { wch: 30 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsPositions, "Danh_Muc_Chuc_Vu");

      XLSX.writeFile(wb, "Mau_Danh_Sach_De_Nghi_Thi_Dua.xlsx");
      message.success("Đã tải xuống file mẫu Excel thành công!");
    } catch (err) {
      console.error(err);
      message.error("Lỗi khi xuất file mẫu Excel");
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
        const rawJson = XLSX.utils.sheet_to_json(sheet);

        if (!rawJson || rawJson.length === 0) {
          message.warning("File Excel tải lên không có dữ liệu!");
          return;
        }

        const parsedMembers = [];
        for (let i = 0; i < rawJson.length; i++) {
          const row = rawJson[i];
          const rawName =
            row["Họ và tên"] || row["Họ tên"] || row["Ho va ten"] || row["name"] || "";
          if (!rawName || String(rawName).trim() === "") continue;

          const formattedName = formatFullName(String(rawName));

          // Rà soát trong CSDL (Cấp trưởng chỉ nhận diện cán bộ trong đơn vị mình)
          const targetUserList = isCapTruong ? availableUsersForRegistration : allUsersList;
          const matchUser = targetUserList.find(
            (u) => u.name && u.name.trim().toLowerCase() === formattedName.toLowerCase()
          );

          let positionName =
            row["Chức vụ"] || row["Chuc vu"] || row["position"] || "";
          if (!positionName && matchUser?.position?.positionName) {
            positionName = matchUser.position.positionName;
          }

          let departmentName = isCapTruong
            ? capTruongDeptName
            : row["Đơn vị"] ||
              row["Don vi"] ||
              row["department"] ||
              matchUser?.department?.departmentName ||
              currentActiveDeptName;

          const rawTitles =
            row["Danh hiệu đề nghị"] ||
            row["Danh hiệu"] ||
            row["Danh hieu"] ||
            row["titles"] ||
            "";

          const titleTokens = String(rawTitles)
            .split(/[,;+]/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);

          const matchedIds = [];
          titleTokens.forEach((tk) => {
            const matched = titles.find(
              (t) =>
                t.name.toLowerCase() === tk ||
                t.code.toLowerCase() === tk ||
                t.name.toLowerCase().includes(tk) ||
                tk.includes(t.name.toLowerCase())
            );
            if (matched && !matchedIds.includes(matched._id)) {
              matchedIds.push(matched._id);
            }
          });

          parsedMembers.push({
            id: `import_${Date.now()}_${i}_${Math.random()}`,
            name: formattedName,
            positionName: String(positionName).trim(),
            departmentName: String(departmentName).trim(),
            titles: matchedIds,
          });
        }

        if (parsedMembers.length === 0) {
          message.warning(
            "Không tìm thấy cán bộ nào hợp lệ từ file Excel. Vui lòng kiểm tra lại cấu trúc cột theo file mẫu!"
          );
          return;
        }

        if (members.length === 1 && !members[0].name.trim()) {
          setMembers(parsedMembers);
        } else {
          setMembers((prev) => [...prev, ...parsedMembers]);
        }

        message.success(
          `Đã nhập thành công ${parsedMembers.length} cán bộ vào danh sách đề nghị!`
        );
      } catch (err) {
        console.error("Lỗi khi đọc file Excel:", err);
        message.error("Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.");
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  // 9. Quản lý upload file minh chứng lên Drive
  const handleFileUpload = async (file, docType) => {
    try {
      setUploadingDocId(docType._id);
      const formData = new FormData();
      formData.append("files", file);

      const res = await uploadEmulationFiles(formData);
      if (res.success && res.data && res.data.length > 0) {
        const uploaded = res.data[0];
        setAttachedFilesMap((prev) => ({
          ...prev,
          [docType._id]: {
            ...uploaded,
            documentType: docType._id,
            documentTypeName: docType.name,
          },
        }));
        message.success(`Đã tải lên minh chứng cho: ${docType.name}`);
      }
    } catch (err) {
      console.error(err);
      message.error("Lỗi khi tải file lên Google Drive");
    } finally {
      setUploadingDocId(null);
    }
    return false;
  };

  const handleRemoveFile = (docTypeId) => {
    setAttachedFilesMap((prev) => {
      const next = { ...prev };
      delete next[docTypeId];
      return next;
    });
    message.info("Đã gỡ bỏ file minh chứng");
  };

  // 10. Gửi hồ sơ đề nghị
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (!members || members.length === 0) {
        message.error("Vui lòng thêm ít nhất một thành viên vào danh sách đề nghị!");
        return;
      }

      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        if (!m.name || !m.name.trim()) {
          message.error(`Dòng ${i + 1}: Vui lòng nhập Họ và tên thành viên!`);
          return;
        }
        if (!m.positionName) {
          message.error(`Dòng ${i + 1} (${m.name}): Vui lòng chọn chức vụ!`);
          return;
        }
        if (!m.titles || m.titles.length === 0) {
          message.error(
            `Dòng ${i + 1} (${m.name}): Vui lòng chọn ít nhất một danh hiệu đề nghị!`
          );
          return;
        }
      }

      const allSelectedTitleIds = [];
      members.forEach((m) => {
        (m.titles || []).forEach((tId) => {
          if (!allSelectedTitleIds.includes(tId)) {
            allSelectedTitleIds.push(tId);
          }
        });
      });

      // Lọc danh mục hồ sơ bắt buộc tương ứng
      const missingRequired = [];
      docTypes.forEach((dt) => {
        if (dt.isRequired && dt.isActive) {
          const isApplicable =
            !dt.applicableTitles ||
            dt.applicableTitles.length === 0 ||
            dt.applicableTitles.some((t) =>
              allSelectedTitleIds.includes(typeof t === "object" ? t._id : t)
            );

          if (isApplicable && !attachedFilesMap[dt._id]) {
            missingRequired.push(dt.name);
          }
        }
      });

      if (missingRequired.length > 0) {
        message.error(
          `Vui lòng đính kèm các hồ sơ bắt buộc sau: ${missingRequired.join(", ")}`
        );
        return;
      }

      setSubmitting(true);

      const attachedFiles = Object.values(attachedFilesMap);
      const payload = {
        schoolYear: values.schoolYear,
        members: members,
        titles: allSelectedTitleIds,
        attachedFiles: attachedFiles,
        notes: values.notes,
      };

      if (isManagerOrAdmin) {
        if (selectedTargetUserId) {
          payload.targetUserId = selectedTargetUserId;
        }
        if (selectedDeptId && selectedDeptId !== "BGH") {
          payload.targetDepartmentId = selectedDeptId;
        }
      }

      if (existingReg) {
        await updateEmulationRegistration(existingReg._id, payload);
        message.success("Cập nhật hồ sơ đề nghị thi đua thành công!");
      } else {
        await createEmulationRegistration(payload);
        message.success("Gửi hồ sơ đề nghị thi đua thành công!");
      }

      navigate("/emulation/list");
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || "Lỗi khi lưu hồ sơ đề nghị");
    } finally {
      setSubmitting(false);
    }
  };

  const allCurrentMemberTitles = useMemo(() => {
    const list = [];
    members.forEach((m) => {
      (m.titles || []).forEach((tId) => {
        if (!list.includes(tId)) list.push(tId);
      });
    });
    return list;
  }, [members]);

  const relevantDocTypes = useMemo(() => {
    return docTypes.filter((dt) => {
      if (!dt.applicableTitles || dt.applicableTitles.length === 0) return true;
      return dt.applicableTitles.some((t) =>
        allCurrentMemberTitles.includes(typeof t === "object" ? t._id : t)
      );
    });
  }, [docTypes, allCurrentMemberTitles]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "PENDING":
        return <Tag color="gold">Chờ Quản lý đơn vị xem xét</Tag>;
      case "SUBMITTED_TO_BGH":
        return <Tag color="blue">Đã chuyển Ban Giám hiệu</Tag>;
      case "SCHOOL_APPROVED":
        return <Tag color="success">Ban Giám hiệu công nhận đạt</Tag>;
      case "REJECTED":
        return <Tag color="error">Từ chối / Cần chỉnh sửa</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  // 11. Kiểm tra quyền truy cập
  if (!canAccess) {
    return (
      <div className="w-full px-2 sm:px-4 py-8 flex justify-center">
        <Result
          status="403"
          title="Không có quyền truy cập"
          subTitle="Chức năng lập hồ sơ Đề nghị thi đua chỉ dành cho Cấp trưởng đơn vị (Trưởng phòng/Khoa/Bộ môn) hoặc Quản trị viên/Manager."
          extra={
            <Button type="primary" onClick={() => navigate("/emulation/list")}>
              Xem Danh sách đề nghị
            </Button>
          }
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" tip="Đang tải thông tin đề nghị..." />
      </div>
    );
  }

  const isApproved = existingReg?.status === "SCHOOL_APPROVED";

  return (
    <div className="w-full px-2 sm:px-4 py-3 space-y-4">
      <Card className="shadow-sm border-gray-200 w-full">
        {/* HEADER TIÊU ĐỀ */}
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
            <TrophyOutlined className="text-3xl text-yellow-500" />
          </div>
          <div>
            <Title level={3} className="!mb-0 text-blue-700">
              Lập Hồ Sơ Đề Nghị Thi Đua
            </Title>
            <Text type="secondary">
              {isManagerOrAdmin
                ? "Quản trị viên / Manager: Cho phép lập hồ sơ đề nghị cho các đơn vị, phòng ban và Ban Giám hiệu"
                : `Cấp trưởng đơn vị: Đề nghị danh hiệu thi đua cho cán bộ, giảng viên thuộc ${capTruongDeptName}`}
            </Text>
          </div>
        </div>

        {/* THÔNG BÁO NẾU ĐÃ CÓ HỒ SƠ */}
        {existingReg && (
          <Alert
            message={
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span>
                  Đơn vị đã có hồ sơ đề nghị cho năm học <strong>{existingReg.schoolYear}</strong>.
                  Trạng thái hiện tại: {getStatusBadge(existingReg.status)}
                </span>
                {isApproved && (
                  <Text type="success" className="font-semibold">
                    <CheckCircleOutlined /> Đã được Ban Giám hiệu phê duyệt chính thức
                  </Text>
                )}
              </div>
            }
            description={
              existingReg.reviewNote ||
              existingReg.managerReview?.note ||
              existingReg.bghReview?.note
                ? `Nhận xét từ cấp duyệt: ${
                    existingReg.bghReview?.note ||
                    existingReg.managerReview?.note ||
                    existingReg.reviewNote
                  }`
                : undefined
            }
            type={
              existingReg.status === "SCHOOL_APPROVED"
                ? "success"
                : existingReg.status === "REJECTED"
                ? "error"
                : "info"
            }
            showIcon
            className="mb-4"
          />
        )}

        <Form form={form} layout="vertical" disabled={isApproved}>
          {/* PHẦN 1: THÔNG TIN ĐƠN VỊ VÀ NGƯỜI LẬP HỒ SƠ */}
          <div className="bg-slate-50 p-4 rounded-lg mb-4 border border-slate-200">
            <Title level={5} className="!mb-3 text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BankOutlined className="text-blue-600" />
                Thông Tin Đơn Vị & Người Lập Hồ Sơ
              </span>
              {isManagerOrAdmin ? (
                <Tag color="blue">Quyền Manager / Admin: Chọn đơn vị linh hoạt</Tag>
              ) : (
                <Tag color="green">Cấp trưởng đơn vị: Tự động nhận diện</Tag>
              )}
            </Title>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* NĂM HỌC ĐỀ NGHỊ */}
              <Form.Item
                name="schoolYear"
                label="Năm học đề nghị"
                rules={[{ required: true, message: "Vui lòng chọn năm học" }]}
              >
                <Select placeholder="Chọn năm học" suffixIcon={<CalendarOutlined />}>
                  {SCHOOL_YEARS.map((y) => (
                    <Select.Option key={y} value={y}>
                      Năm học {y}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              {/* ĐƠN VỊ ĐỀ NGHỊ */}
              <div>
                <label className="text-xs text-gray-600 font-medium block mb-2">
                  Đơn vị / Phòng ban đề nghị:
                </label>
                {isManagerOrAdmin ? (
                  <Select
                    className="w-full"
                    placeholder="Chọn đơn vị cần lập đề nghị"
                    value={selectedDeptId}
                    onChange={handleManagerChangeDepartment}
                    showSearch
                    optionFilterProp="children"
                  >
                    <Select.Option value="BGH">
                      ⭐ Ban Giám hiệu (Ban Lãnh đạo trường)
                    </Select.Option>
                    {departments.map((d) => (
                      <Select.Option key={d._id} value={d._id}>
                        {d.departmentName}
                      </Select.Option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    prefix={<BankOutlined className="text-gray-400" />}
                    value={capTruongDeptName}
                    disabled
                  />
                )}
              </div>

              {/* CÁN BỘ ĐẠI DIỆN LẬP HỒ SƠ */}
              <div>
                <label className="text-xs text-gray-600 font-medium block mb-2">
                  Cán bộ đại diện lập hồ sơ:
                </label>
                {isManagerOrAdmin ? (
                  <Select
                    className="w-full"
                    placeholder="Chọn BGH hoặc Cấp trưởng..."
                    value={selectedTargetUserId}
                    onChange={handleManagerChangeTargetUser}
                    allowClear
                    showSearch
                    optionFilterProp="children"
                  >
                    <Select.OptGroup label="⭐ 1. Ban Giám hiệu">
                      {representativeUsers.bgh.map((u) => (
                        <Select.Option key={u._id} value={u._id}>
                          {u.name} - {u.position?.positionName || "Lãnh đạo"}
                        </Select.Option>
                      ))}
                    </Select.OptGroup>
                    <Select.OptGroup label="👔 2. Cấp trưởng các đơn vị">
                      {representativeUsers.capTruong.map((u) => (
                        <Select.Option key={u._id} value={u._id}>
                          {u.name} - {u.position?.positionName || "Cấp trưởng"} ({u.department?.departmentName || "Đơn vị"})
                        </Select.Option>
                      ))}
                    </Select.OptGroup>
                  </Select>
                ) : (
                  <Form.Item name="name" noStyle>
                    <Input prefix={<UserOutlined className="text-gray-400" />} disabled />
                  </Form.Item>
                )}
              </div>

              {/* CHỨC VỤ ĐẠI DIỆN */}
              <Form.Item name="positionName" label="Chức vụ đại diện">
                <Input
                  prefix={<IdcardOutlined className="text-gray-400" />}
                  disabled={!isManagerOrAdmin}
                />
              </Form.Item>
            </div>
          </div>

          {/* PHẦN 2: DANH SÁCH THÀNH VIÊN ĐỀ NGHỊ (THEO YÊU CẦU MỚI) */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 bg-amber-50/60 p-3 rounded-lg border border-amber-200">
              <div>
                <Title level={5} className="!mb-0 text-amber-800 flex items-center gap-2">
                  <TeamOutlined className="text-amber-600 text-lg" />
                  Danh Sách Thành Viên Đề Nghị Thi Đua
                </Title>
                <Text type="secondary" className="text-xs">
                  {isCapTruong
                    ? `* Danh sách gợi ý và nhận diện nhân sự thuộc ${capTruongDeptName}. Tự động chuẩn hóa chữ in hoa đầu từ.`
                    : "* Nhập tên sẽ tự động chuẩn hóa chữ in hoa đầu mỗi từ và tự nhận diện Chức vụ, Đơn vị nếu đã có trong hệ thống."}
                </Text>
              </div>

              {/* THANH CÔNG CỤ EXCEL VÀ THÊM CÁN BỘ */}
              <Space wrap>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExportTemplate}
                  size="small"
                  className="bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300"
                >
                  Tải mẫu Excel
                </Button>

                {!isApproved && (
                  <>
                    <Upload
                      beforeUpload={handleImportExcel}
                      showUploadList={false}
                      accept=".xlsx, .xls"
                    >
                      <Button
                        icon={<FileExcelOutlined />}
                        size="small"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        Nhập từ Excel
                      </Button>
                    </Upload>

                    <Button
                      type="primary"
                      icon={<UserAddOutlined />}
                      onClick={handleAddMember}
                      size="small"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Thêm người mới
                    </Button>
                  </>
                )}
              </Space>
            </div>

            {/* BẢNG NHẬP LIỆU THÀNH VIÊN */}
            <div className="border border-gray-200 rounded-lg overflow-x-auto shadow-sm">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-100 text-slate-700 border-b border-gray-200">
                  <tr>
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3 w-64 min-w-[220px]">Họ và tên</th>
                    <th className="p-3 w-56 min-w-[190px]">Chức vụ</th>
                    <th className="p-3 w-56 min-w-[180px]">Đơn vị công tác</th>
                    <th className="p-3 min-w-[280px]">Danh hiệu thi đua đề nghị</th>
                    <th className="p-3 w-16 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {members.map((member, index) => (
                    <tr key={member.id} className="hover:bg-slate-50 transition-colors">
                      {/* STT */}
                      <td className="p-2.5 text-center font-semibold text-gray-500">
                        {index + 1}
                      </td>

                      {/* HỌ VÀ TÊN - AUTOCOMPLETE & CHUẨN HÓA HOA ĐẦU TỪ */}
                      <td className="p-2.5">
                        <AutoComplete
                          options={userAutoCompleteOptions}
                          value={member.name}
                          onChange={(val) => handleUpdateMember(member.id, "name", val)}
                          onSelect={(val, opt) => handleMemberNameSelect(member.id, val, opt)}
                          disabled={isApproved}
                          filterOption={(inputValue, option) =>
                            (option?.value || "")
                              .toLowerCase()
                              .includes(inputValue.toLowerCase())
                          }
                          className="w-full"
                        >
                          <Input
                            placeholder="Nhập họ và tên..."
                            onBlur={(e) => handleMemberNameBlur(member.id, e.target.value)}
                            className="font-medium text-gray-800"
                          />
                        </AutoComplete>
                      </td>

                      {/* CHỨC VỤ - CHỌN TỪ DANH MỤC CHỨC VỤ TRONG CSDL */}
                      <td className="p-2.5">
                        <Select
                          placeholder="Chọn chức vụ..."
                          value={member.positionName || undefined}
                          onChange={(val) => handleUpdateMember(member.id, "positionName", val)}
                          showSearch
                          optionFilterProp="children"
                          disabled={isApproved}
                          className="w-full"
                          allowClear
                        >
                          {positions.map((p) => (
                            <Select.Option key={p._id} value={p.positionName}>
                              {p.positionName}
                            </Select.Option>
                          ))}
                        </Select>
                      </td>

                      {/* ĐƠN VỊ CÔNG TÁC (TỰ ĐỘNG ĐƠN VỊ CỦA CẤP TRƯỞNG / HỒ SƠ) */}
                      <td className="p-2.5">
                        <div className="px-2.5 py-1 bg-gray-100 rounded border border-gray-200 text-xs text-gray-700 font-medium truncate" title={isCapTruong ? capTruongDeptName : (member.departmentName || currentActiveDeptName)}>
                          {isCapTruong
                            ? capTruongDeptName
                            : member.departmentName || currentActiveDeptName}
                        </div>
                      </td>

                      {/* DANH HIỆU ĐỀ NGHỊ (ĐA CHỌN) */}
                      <td className="p-2.5">
                        <Select
                          mode="multiple"
                          placeholder="Chọn một hoặc nhiều danh hiệu..."
                          value={member.titles}
                          onChange={(vals) =>
                            handleUpdateMember(member.id, "titles", vals)
                          }
                          disabled={isApproved}
                          className="w-full"
                          optionFilterProp="children"
                        >
                          {titles.map((t) => (
                            <Select.Option key={t._id} value={t._id}>
                              {t.name} ({t.level === "CO_SO" ? "Cấp Trường" : "Cấp Tỉnh/TP/Bộ"})
                            </Select.Option>
                          ))}
                        </Select>
                      </td>

                      {/* NÚT XÓA */}
                      <td className="p-2.5 text-center">
                        {!isApproved && (
                          <Popconfirm
                            title="Xóa cán bộ này khỏi danh sách?"
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => handleRemoveMember(member.id)}
                            disabled={members.length === 1}
                          >
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              disabled={members.length === 1}
                            />
                          </Popconfirm>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center mt-2 px-1">
              <Text type="secondary" className="text-xs">
                Tổng số cán bộ đề nghị: <strong>{members.length}</strong> người
              </Text>
              {!isApproved && (
                <Button
                  type="dashed"
                  icon={<UserAddOutlined />}
                  onClick={handleAddMember}
                  size="small"
                >
                  + Thêm thành viên tiếp theo
                </Button>
              )}
            </div>
          </div>

          {/* PHẦN 3: HỒ SƠ MINH CHỨNG ĐÍNH KÈM (GOOGLE DRIVE) */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <Title level={5} className="!mb-0 text-slate-700 flex items-center gap-2">
                <PaperClipOutlined /> Hồ sơ / Minh chứng đính kèm (Theo Danh mục Hồ sơ)
              </Title>
              <Text type="secondary" className="text-xs">
                * Tải file lên Google Drive của trường
              </Text>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-gray-100 text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3 min-w-[200px]">Loại hồ sơ / Minh chứng</th>
                    <th className="p-3 min-w-[240px]">Quy cách / Hướng dẫn</th>
                    <th className="p-3 w-80 min-w-[240px]">File minh chứng đính kèm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {relevantDocTypes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-gray-400">
                        Chưa có loại hồ sơ nào được cấu hình cho danh hiệu đã chọn
                      </td>
                    </tr>
                  ) : (
                    relevantDocTypes.map((docType, idx) => {
                      const file = attachedFilesMap[docType._id];
                      const isUploading = uploadingDocId === docType._id;

                      return (
                        <tr key={docType._id} className="hover:bg-slate-50">
                          <td className="p-3 text-center">{idx + 1}</td>
                          <td className="p-3">
                            <span className="font-medium text-gray-800">{docType.name}</span>
                            {docType.isRequired && (
                              <Tag color="red" className="ml-2">
                                * Bắt buộc
                              </Tag>
                            )}
                          </td>
                          <td className="p-3 text-gray-500 text-xs">
                            {docType.description || "Tải lên file định dạng PDF hoặc DOCX"}
                          </td>
                          <td className="p-3">
                            {file ? (
                              <div className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-200">
                                <div className="flex items-center gap-2 truncate mr-2">
                                  <FilePdfOutlined className="text-red-500" />
                                  <a
                                    href={file.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 truncate text-xs hover:underline"
                                    title={file.fileName}
                                  >
                                    {file.fileName}
                                  </a>
                                </div>
                                {!isApproved && (
                                  <Tooltip title="Xóa file">
                                    <Button
                                      type="text"
                                      danger
                                      size="small"
                                      icon={<DeleteOutlined />}
                                      onClick={() => handleRemoveFile(docType._id)}
                                    />
                                  </Tooltip>
                                )}
                              </div>
                            ) : (
                              <Upload
                                beforeUpload={(f) => handleFileUpload(f, docType)}
                                showUploadList={false}
                                disabled={isApproved}
                              >
                                <Button
                                  size="small"
                                  icon={<UploadOutlined />}
                                  loading={isUploading}
                                  disabled={isApproved}
                                >
                                  {isUploading ? "Đang tải lên Drive..." : "Chọn file đính kèm"}
                                </Button>
                              </Upload>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PHẦN 4: GHI CHÚ / CAM KẾT */}
          <Form.Item
            name="notes"
            label="Ghi chú / Cam kết phương hướng phấn đấu hoặc tóm tắt thành tích nổi bật"
          >
            <TextArea
              rows={3}
              placeholder="Nhập nội dung cam kết phấn đấu thi đua của đơn vị..."
            />
          </Form.Item>

          <Divider />

          {/* NÚT THỰC HIỆN */}
          <div className="flex justify-end gap-3">
            <Button onClick={() => navigate("/emulation/list")}>Xem danh sách đề nghị</Button>
            {!isApproved && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSubmit}
                loading={submitting}
                className="bg-blue-600 hover:bg-blue-700"
                size="large"
              >
                {existingReg ? "Cập nhật hồ sơ đề nghị" : "Gửi hồ sơ đề nghị thi đua"}
              </Button>
            )}
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default EmulationRegisterPage;
