import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  Tabs,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Row,
  Col,
  message,
  Popconfirm,
  Tooltip,
  Badge,
  Descriptions,
  Divider,
  AutoComplete,
  Alert,
  Checkbox,
  Radio,
  Progress,
  Statistic,
  Pagination,
  Spin,
} from "antd";
import {
  CarOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  PhoneOutlined,
  TeamOutlined,
  ToolOutlined,
  PrinterOutlined,
  EyeOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  AuditOutlined,
  RollbackOutlined,
  CompassOutlined,
  GlobalOutlined,
  EnvironmentOutlined,
  WarningOutlined,
  AlertOutlined,
  SearchOutlined,
  FilterOutlined,
  ClearOutlined,
  BarChartOutlined,
  FileExcelOutlined,
  PieChartOutlined,
  DashboardOutlined,
  LineChartOutlined,
  AppstoreOutlined,
  TableOutlined,
  UpOutlined,
  DownOutlined,
  CompressOutlined,
  ExpandOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import RouteWaypointsEditor, {
  buildGoogleMapsDirectionUrl,
  DEFAULT_SCHOOL_ORIGIN,
} from "./RouteWaypointsEditor";
import {
  getVehicleBookings,
  getVehicleStats,
  createVehicleBooking,
  updateVehicleBooking,
  reviewVehicleBooking,
  dispatchVehicleBooking,
  updateTripStatus,
  cancelVehicleBooking,
  deleteVehicleBooking,
  checkDispatchConflictsApi,
  getAllVehicles,
  getAllDrivers,
  createVehicle,
  updateVehicle,
  createDriver,
  updateDriver,
  deleteVehicle,
  deleteDriver,
} from "../../api/vehicleApi";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { getAllUsers, getAllUsersCanSearchBanUser, getUserInfo } from "../../api/auth";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getBghUsers } from "../../api/workScheduleApi";
import { isBghUser, isCapTruongUser, isCapPhoUser, categorizeUsers } from "../../utils/userClassification";
import { useNotificationContext } from "../../context/NotificationContext";

const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

// Hàm định dạng thứ và ngày tiếng Việt: "Thứ 2, ngày 22/11/2026", "Chủ Nhật, ngày 22/11/2026"
export const formatVietnameseDayAndDate = (dateVal) => {
  if (!dateVal) return "--";
  const d = dayjs(dateVal);
  if (!d.isValid()) return "--";
  const dayOfWeek = d.day(); // 0: Chủ Nhật, 1: Thứ 2, ..., 6: Thứ 7
  const dayNames = [
    "Chủ Nhật",
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7",
  ];
  const dayName = dayNames[dayOfWeek] || "";
  return `${dayName}, ngày ${d.format("DD/MM/YYYY")}`;
};

const VehicleManagementPage = () => {
  const { vehiclePendingDetails, refetchNotificationCounts } = useNotificationContext();
  const [activeTab, setActiveTab] = useState("my"); // "my", "pending_approval", "dispatch", "all", "vehicles", "drivers"
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });

  // Danh mục xe & tài xế
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [bghUsers, setBghUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [leaderGroups, setLeaderGroups] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const printRef = useRef(null);

  // Multi-stop routing states
  const [createWaypointsData, setCreateWaypointsData] = useState(null);
  const [editWaypointsData, setEditWaypointsData] = useState(null);

  // Sub-filter phê duyệt dành cho Ban Giám Hiệu
  const [bghApprovalFilter, setBghApprovalFilter] = useState("PENDING"); // "PENDING", "APPROVED", "REJECTED", "ALL"

  // Bộ lọc thông minh (Smart Filters)
  const [searchKeyword, setSearchKeyword] = useState("");
  const [dateRange, setDateRange] = useState(null);
  const [filterApprovalStatus, setFilterApprovalStatus] = useState("ALL");
  const [filterDispatchStatus, setFilterDispatchStatus] = useState("ALL");
  const [filterVehicleType, setFilterVehicleType] = useState("ALL");
  const [filterVehicleId, setFilterVehicleId] = useState("ALL");
  const [filterDriverId, setFilterDriverId] = useState("ALL");
  const [filterDepartment, setFilterDepartment] = useState("ALL");
  const [departmentsList, setDepartmentsList] = useState([]);

  // Thống kê & Phân tích chuyên sâu
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [statsActiveTab, setStatsActiveTab] = useState("departments");

  // Tùy chọn hiển thị & độ thu nhỏ (Responsive & Compact controls)
  const [isKpiCollapsed, setIsKpiCollapsed] = useState(() => {
    return window.innerWidth < 768;
  });
  const [isFilterExpanded, setIsFilterExpanded] = useState(() => {
    return window.innerWidth >= 768;
  });
  const [viewMode, setViewMode] = useState("auto"); // "auto", "table", "cards"
  const [tableDensity, setTableDensity] = useState("small"); // "small", "middle"

  // Phân nhóm lịch: "all" (Tất cả phân nhóm), "uncompleted" (Chưa chạy / Đang đi), "completed" (Đã xong / Lịch sử)
  const [scheduleGroupTab, setScheduleGroupTab] = useState("all");
  const [collapseUncompleted, setCollapseUncompleted] = useState(false);
  const [collapseCompleted, setCollapseCompleted] = useState(false);

  // Phân tách danh sách đơn đăng ký thành 2 nhóm:
  // 1. Chưa chạy & Đang thực hiện: PENDING, APPROVED (UNASSIGNED, ASSIGNED, IN_PROGRESS)
  //    Sắp xếp: Chuyến gần nhất (sắp tới / đang đi) nằm lên trên cùng!
  // 2. Đã xong & Lịch sử: COMPLETED, REJECTED, CANCELLED
  //    Sắp xếp: Mới hoàn thành gần đây nhất nằm lên trên cùng!
  const { uncompletedBookings, completedBookings } = React.useMemo(() => {
    const uncompleted = [];
    const completed = [];

    (bookings || []).forEach((b) => {
      const isDone =
        b.approvalStatus === "REJECTED" ||
        b.dispatchStatus === "COMPLETED" ||
        b.dispatchStatus === "CANCELLED";

      if (isDone) {
        completed.push(b);
      } else {
        uncompleted.push(b);
      }
    });

    // Nhóm chưa chạy: Sắp xếp theo departureTime tăng dần (chuyến gần nhất / sắp diễn ra nằm trên cùng)
    uncompleted.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));

    // Nhóm đã xong: Sắp xếp theo departureTime giảm dần (mới hoàn thành gần đây nhất nằm trên cùng)
    completed.sort((a, b) => new Date(b.departureTime) - new Date(a.departureTime));

    return { uncompletedBookings: uncompleted, completedBookings: completed };
  }, [bookings]);

  // Kiểm tra có tiêu chí lọc nào đang kích hoạt không
  const isAnyFilterActive = Boolean(
    (searchKeyword && searchKeyword.trim()) ||
    (filterApprovalStatus && filterApprovalStatus !== "ALL") ||
    (filterDispatchStatus && filterDispatchStatus !== "ALL") ||
    (filterVehicleType && filterVehicleType !== "ALL") ||
    (filterVehicleId && filterVehicleId !== "ALL") ||
    (filterDriverId && filterDriverId !== "ALL") ||
    (filterDepartment && filterDepartment !== "ALL") ||
    (dateRange && dateRange[0] && dateRange[1])
  );

  // Số lượng tiêu chí lọc đang được chọn
  const activeFiltersCount = [
    Boolean(searchKeyword && searchKeyword.trim()),
    Boolean(dateRange && dateRange[0] && dateRange[1]),
    Boolean(filterApprovalStatus && filterApprovalStatus !== "ALL"),
    Boolean(filterDispatchStatus && filterDispatchStatus !== "ALL"),
    Boolean(filterVehicleType && filterVehicleType !== "ALL"),
    Boolean(filterVehicleId && filterVehicleId !== "ALL"),
    Boolean(filterDriverId && filterDriverId !== "ALL"),
    Boolean(filterDepartment && filterDepartment !== "ALL"),
  ].filter(Boolean).length;

  // Trạng thái kiểm tra xung đột trùng lịch tài xế & xe
  const [dispatchConflicts, setDispatchConflicts] = useState({ busyDrivers: [], busyVehicles: [] });
  const [selectedDriverId, setSelectedDriverId] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [forceDispatch, setForceDispatch] = useState(false);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  // Tính toán xung đột lịch của tài xế đang được chọn
  const selectedDriverConflict = React.useMemo(() => {
    if (!selectedDriverId || !dispatchConflicts?.busyDrivers?.length) return null;
    return dispatchConflicts.busyDrivers.find(
      (c) =>
        String(c.driverId) === String(selectedDriverId) ||
        (c.phone && c.phone === drivers.find((d) => String(d._id) === String(selectedDriverId))?.phone)
    );
  }, [selectedDriverId, dispatchConflicts, drivers]);

  // Tính toán xung đột lịch của xe trường đang được chọn
  const selectedVehicleConflict = React.useMemo(() => {
    if (!selectedVehicleId || !dispatchConflicts?.busyVehicles?.length) return null;
    return dispatchConflicts.busyVehicles.find(
      (c) => String(c.vehicleId) === String(selectedVehicleId)
    );
  }, [selectedVehicleId, dispatchConflicts]);

  // Forms
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [dispatchForm] = Form.useForm();

  // Nhóm người dùng phục vụ Đăng ký hộ (chia theo BGH, Cấp trưởng, Cấp phó, Cán bộ khác)
  const onBehalfOfGroups = React.useMemo(() => {
    if (!allUsers || allUsers.length === 0) return [];
    const bgh = [];
    const capTruong = [];
    const capPho = [];
    const others = [];

    allUsers.forEach((u) => {
      if (isBghUser(u)) bgh.push(u);
      else if (isCapTruongUser(u)) capTruong.push(u);
      else if (isCapPhoUser(u)) capPho.push(u);
      else others.push(u);
    });

    const sortByName = (arr) => [...arr].sort((a, b) => (a.name || a.fullName || "").localeCompare(b.name || b.fullName || ""));

    return [
      { key: "bgh", label: "🏛️ Ban Giám Hiệu", users: sortByName(bgh) },
      { key: "cap_truong", label: "👔 Lãnh đạo Cấp trưởng đơn vị (Trưởng phòng/Khoa/TT)", users: sortByName(capTruong) },
      { key: "cap_pho", label: "💼 Lãnh đạo Cấp phó đơn vị (Phó Trưởng phòng/Khoa/TT)", users: sortByName(capPho) },
      { key: "others", label: "👨‍🏫 Giảng viên, Chuyên viên & Cán bộ khác", users: sortByName(others) },
    ].filter((g) => g.users.length > 0);
  }, [allUsers]);

  // Nhóm người dùng phục vụ Chỉ định người phân bổ xe (Ưu tiên Phòng Quản trị thiết bị / Quản lý xe lên đầu)
  const dispatchAssigneeGroups = React.useMemo(() => {
    if (!allUsers || allUsers.length === 0) return [];
    const qttbUsers = [];
    const bghUsersList = [];
    const capTruongList = [];
    const capPhoList = [];
    const otherUsers = [];

    allUsers.forEach((u) => {
      const deptName = (u.department?.departmentName || "").toLowerCase();
      const deptCode = (u.department?.departmentCode || "").toUpperCase();
      const posName = (u.position?.positionName || "").toLowerCase();

      const isQttb =
        deptCode.includes("QTTB") ||
        deptName.includes("quản trị thiết bị") ||
        deptName.includes("cơ sở vật chất") ||
        deptName.includes("hành chính") ||
        posName.includes("quản lý xe") ||
        posName.includes("điều xe");

      if (isQttb) {
        qttbUsers.push(u);
      } else if (isBghUser(u)) {
        bghUsersList.push(u);
      } else if (isCapTruongUser(u)) {
        capTruongList.push(u);
      } else if (isCapPhoUser(u)) {
        capPhoList.push(u);
      } else {
        otherUsers.push(u);
      }
    });

    const sortByName = (arr) => [...arr].sort((a, b) => (a.name || a.fullName || "").localeCompare(b.name || b.fullName || ""));

    return [
      { key: "qttb", label: "🏢 Đơn vị Quản trị thiết bị & Quản lý xe (Khuyên dùng)", users: sortByName(qttbUsers) },
      { key: "bgh", label: "🏛️ Ban Giám Hiệu", users: sortByName(bghUsersList) },
      { key: "cap_truong", label: "👔 Lãnh đạo Cấp trưởng đơn vị", users: sortByName(capTruongList) },
      { key: "cap_pho", label: "💼 Lãnh đạo Cấp phó đơn vị", users: sortByName(capPhoList) },
      { key: "others", label: "👨‍🏫 Giảng viên - Chuyên viên khác", users: sortByName(otherUsers) },
    ].filter((g) => g.users.length > 0);
  }, [allUsers]);

  // Danh sách Cấp trưởng đơn vị (phục vụ Manager/Admin đăng ký hộ xe công tác - tương thích ngược)
  const departmentHeads = React.useMemo(() => {
    if (!allUsers || allUsers.length === 0) return [];
    return allUsers
      .filter((u) => u && isCapTruongUser(u))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [allUsers]);

  // Tự động đồng bộ leaderGroups mỗi khi allUsers thay đổi
  useEffect(() => {
    if (allUsers && allUsers.length > 0) {
      const categorized = categorizeUsers(allUsers);
      setLeaderGroups(categorized);
    }
  }, [allUsers]);

  // Modal tạo xe & tài xế mới
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [vehicleForm] = Form.useForm();
  const [driverForm] = Form.useForm();

  // Load danh sách người dùng BGH & Current User (từ API + cookie + localStorage)
  useEffect(() => {
    const initCurrentUser = async () => {
      let uId = Cookies.get("userId");
      const token = Cookies.get("accessToken");
      if (token && !uId) {
        try {
          const dec = jwtDecode(token);
          uId = dec.userId || dec._id || dec.id;
        } catch (e) {}
      }

      try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const u = JSON.parse(userStr);
          setCurrentUser(u);
          if (!uId) uId = u._id || u.id;
        }
      } catch (e) {
        console.warn("Lỗi đọc user:", e);
      }

      if (uId) {
        try {
          const uInfo = await getUserInfo(uId);
          if (uInfo?.success && uInfo.data) {
            setCurrentUser(uInfo.data);
          }
        } catch (e) {
          console.warn("Lỗi lấy chi tiết user hiện tại:", e);
        }
      }
    };

    initCurrentUser();

    // Tải danh sách BGH và toàn bộ nhân sự để phân bổ xe / tài xế
    const fetchUserData = async () => {
      try {
        // 1. Tải danh sách BGH từ endpoint chuyên dụng
        const bghRes = await getBghUsers();
        let bghList = [];
        if (bghRes?.success && Array.isArray(bghRes.data)) {
          bghList = bghRes.data;
        }

        // 2. Tải toàn bộ nhân sự hệ thống để dùng cho smart-search tài xế và phân bổ xe
        let users = [];
        try {
          const userRes = await getAllUsersCanSearchBanUser();
          users =
            userRes && Array.isArray(userRes.users)
              ? userRes.users
              : userRes?.data && Array.isArray(userRes.data.users)
              ? userRes.data.users
              : userRes?.data && Array.isArray(userRes.data)
              ? userRes.data
              : Array.isArray(userRes)
              ? userRes
              : [];
        } catch {
          const fallbackRes = await getAllUsers();
          users =
            fallbackRes && Array.isArray(fallbackRes.users)
              ? fallbackRes.users
              : fallbackRes?.data && Array.isArray(fallbackRes.data.users)
              ? fallbackRes.data.users
              : fallbackRes?.data && Array.isArray(fallbackRes.data)
              ? fallbackRes.data
              : Array.isArray(fallbackRes)
              ? fallbackRes
              : [];
        }

        setAllUsers(users);

        if (bghList.length === 0) {
          // Fallback lọc từ toàn bộ users
          bghList = users.filter((u) => isBghUser(u));
        }

        setBghUsers(bghList);

        // Phân loại danh sách người dùng thành các nhóm: BGH, Cấp trưởng, Cấp phó, GV-CV, Manager
        const categorized = categorizeUsers(users);
        setLeaderGroups(categorized);
      } catch (err) {
        console.warn("Lỗi tải thông tin người dùng / BGH:", err);
      }
    };

    const loadDepartments = async () => {
      try {
        const dRes = await getAllDepartments({ onlyActive: true });
        const list = dRes?.AllDepartment || dRes?.departments || (Array.isArray(dRes) ? dRes : []);
        setDepartmentsList(list);
      } catch (e) {
        console.warn("Lỗi tải phòng ban:", e);
      }
    };

    fetchUserData();
    loadVehiclesAndDrivers();
    loadDepartments();
    fetchStats();
  }, []);

  const loadVehiclesAndDrivers = async () => {
    try {
      const [vRes, dRes] = await Promise.all([getAllVehicles(), getAllDrivers()]);
      if (vRes.data?.success) setVehicles(vRes.data.data || []);
      if (dRes.data?.success) setDrivers(dRes.data.data || []);
    } catch (err) {
      console.warn("Lỗi tải danh mục xe/tài xế:", err);
    }
  };

  // Tải thống kê điều xe tổng thể
  const fetchStats = async (overrideRange = dateRange, overrideDept = filterDepartment) => {
    setStatsLoading(true);
    try {
      const params = {};
      const range = overrideRange !== undefined ? overrideRange : dateRange;
      if (range && range[0] && range[1]) {
        params.startDate = range[0].startOf("day").toISOString();
        params.endDate = range[1].endOf("day").toISOString();
      }
      const dept = overrideDept !== undefined ? overrideDept : filterDepartment;
      if (dept && dept !== "ALL") params.department = dept;
      if (filterVehicleType && filterVehicleType !== "ALL") params.vehicleType = filterVehicleType;
      if (filterVehicleId && filterVehicleId !== "ALL") params.assignedVehicle = filterVehicleId;
      if (filterDriverId && filterDriverId !== "ALL") params.assignedDriver = filterDriverId;

      const res = await getVehicleStats(params);
      if (res.data?.success) {
        setStatsData(res.data.data);
      }
    } catch (err) {
      console.warn("Lỗi tải thống kê điều xe:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Tải danh sách bookings theo tab hiện tại và bộ lọc thông minh
  const fetchBookings = async (page = 1, overrideFilters = {}) => {
    setLoading(true);
    try {
      const activeBgh = overrideFilters.bghApprovalFilter !== undefined ? overrideFilters.bghApprovalFilter : bghApprovalFilter;
      const kw = overrideFilters.searchKeyword !== undefined ? overrideFilters.searchKeyword : searchKeyword;
      const appStat = overrideFilters.filterApprovalStatus !== undefined ? overrideFilters.filterApprovalStatus : filterApprovalStatus;
      const dispStat = overrideFilters.filterDispatchStatus !== undefined ? overrideFilters.filterDispatchStatus : filterDispatchStatus;
      const vType = overrideFilters.filterVehicleType !== undefined ? overrideFilters.filterVehicleType : filterVehicleType;
      const vId = overrideFilters.filterVehicleId !== undefined ? overrideFilters.filterVehicleId : filterVehicleId;
      const dId = overrideFilters.filterDriverId !== undefined ? overrideFilters.filterDriverId : filterDriverId;
      const deptId = overrideFilters.filterDepartment !== undefined ? overrideFilters.filterDepartment : filterDepartment;
      const dRange = overrideFilters.dateRange !== undefined ? overrideFilters.dateRange : dateRange;

      const params = {
        tab: activeTab,
        page,
        limit: pagination.pageSize,
      };

      if (activeTab === "pending_approval") {
        params.approvalStatus = activeBgh;
      } else if (appStat && appStat !== "ALL") {
        params.approvalStatus = appStat;
      }

      const sGroup = overrideFilters.scheduleGroupTab !== undefined ? overrideFilters.scheduleGroupTab : scheduleGroupTab;
      if (sGroup === "uncompleted") {
        params.statusGroup = "active";
      } else if (sGroup === "completed") {
        params.statusGroup = "completed";
      }

      if (dispStat && dispStat !== "ALL") {
        params.dispatchStatus = dispStat;
      }
      if (vType && vType !== "ALL") {
        params.vehicleType = vType;
      }
      if (vId && vId !== "ALL") {
        params.assignedVehicle = vId;
      }
      if (dId && dId !== "ALL") {
        params.assignedDriver = dId;
      }
      if (deptId && deptId !== "ALL") {
        params.department = deptId;
      }
      if (kw && kw.trim()) {
        params.search = kw.trim();
      }
      if (dRange && dRange[0] && dRange[1]) {
        params.startDate = dRange[0].startOf("day").toISOString();
        params.endDate = dRange[1].endOf("day").toISOString();
      }

      const res = await getVehicleBookings(params);
      if (res.data?.success) {
        setBookings(res.data.data || []);
        setPagination({
          ...pagination,
          current: page,
          total: res.data.pagination?.total || 0,
        });
      }
    } catch (err) {
      message.error("Lỗi khi tải danh sách đơn đăng ký xe");
    } finally {
      setLoading(false);
    }
  };

  // Đặt lại toàn bộ bộ lọc về mặc định
  const handleResetFilter = () => {
    setSearchKeyword("");
    setDateRange(null);
    setFilterApprovalStatus("ALL");
    setFilterDispatchStatus("ALL");
    setFilterVehicleType("ALL");
    setFilterVehicleId("ALL");
    setFilterDriverId("ALL");
    setFilterDepartment("ALL");
    fetchBookings(1, {
      searchKeyword: "",
      dateRange: null,
      filterApprovalStatus: "ALL",
      filterDispatchStatus: "ALL",
      filterVehicleType: "ALL",
      filterVehicleId: "ALL",
      filterDriverId: "ALL",
      filterDepartment: "ALL",
    });
    fetchStats(null, "ALL");
  };

  // Lọc nhanh bằng cách click vào các thẻ KPI Thống kê
  const handleQuickFilter = (type) => {
    if (type === "ALL") {
      handleResetFilter();
      return;
    }
    if (type === "PENDING") {
      const nextStat = filterApprovalStatus === "PENDING" ? "ALL" : "PENDING";
      setFilterApprovalStatus(nextStat);
      setFilterDispatchStatus("ALL");
      fetchBookings(1, { filterApprovalStatus: nextStat, filterDispatchStatus: "ALL" });
      return;
    }
    if (type === "UNASSIGNED") {
      const nextDisp = filterDispatchStatus === "UNASSIGNED" ? "ALL" : "UNASSIGNED";
      setFilterApprovalStatus(nextDisp === "UNASSIGNED" ? "APPROVED" : "ALL");
      setFilterDispatchStatus(nextDisp);
      fetchBookings(1, {
        filterApprovalStatus: nextDisp === "UNASSIGNED" ? "APPROVED" : "ALL",
        filterDispatchStatus: nextDisp,
      });
      return;
    }
    if (type === "IN_PROGRESS") {
      const nextDisp = filterDispatchStatus === "IN_PROGRESS" ? "ALL" : "IN_PROGRESS";
      setFilterDispatchStatus(nextDisp);
      fetchBookings(1, { filterDispatchStatus: nextDisp });
      return;
    }
    if (type === "COMPLETED") {
      const nextDisp = filterDispatchStatus === "COMPLETED" ? "ALL" : "COMPLETED";
      setFilterDispatchStatus(nextDisp);
      fetchBookings(1, { filterDispatchStatus: nextDisp });
      return;
    }
  };

  // Xuất danh sách chuyến xe hiện tại ra file Excel
  const exportBookingsToExcel = () => {
    if (!bookings || bookings.length === 0) {
      message.warning("Không có dữ liệu chuyến xe để xuất Excel");
      return;
    }
    try {
      const rows = [
        ["DANH SÁCH ĐIỀU ĐỘNG PHƯƠNG TIỆN & XE CÔNG TÁC - TRƯỜNG CĐ BÁCH KHOA NAM SÀI GÒN"],
        [`Ngày xuất báo cáo: ${dayjs().format("DD/MM/YYYY HH:mm")}`],
        [],
        [
          "STT",
          "Mã đơn",
          "Người đăng ký",
          "Đơn vị",
          "Số điện thoại",
          "Mục đích công tác",
          "Lộ trình di chuyển",
          "Điểm xuất phát",
          "Điểm đến",
          "Ngày giờ đi",
          "Ngày giờ về",
          "Số người",
          "Danh sách người đi",
          "Loại xe",
          "Xe phân bổ",
          "Biển số",
          "Tài xế",
          "SĐT tài xế",
          "Quãng đường (km)",
          "Trạng thái BGH",
          "Tiến độ điều xe",
        ],
      ];

      bookings.forEach((b, idx) => {
        const approvalText =
          b.approvalStatus === "APPROVED"
            ? "Đã duyệt"
            : b.approvalStatus === "REJECTED"
            ? "Từ chối"
            : b.approvalStatus === "CANCELLED"
            ? "Đã hủy"
            : "Chờ duyệt";

        const dispatchText =
          b.dispatchStatus === "COMPLETED"
            ? "Đã hoàn thành"
            : b.dispatchStatus === "IN_PROGRESS"
            ? "Đang di chuyển"
            : b.dispatchStatus === "ASSIGNED"
            ? "Đã xếp xe"
            : b.dispatchStatus === "CANCELLED"
            ? "Đã hủy"
            : "Chưa xếp xe";

        const depTime = b.departureTime
          ? `${b.departureHour ? b.departureHour + " - " : ""}${formatVietnameseDayAndDate(b.departureTime)}`
          : "";
        const retTime = b.estimatedReturnTime ? formatVietnameseDayAndDate(b.estimatedReturnTime) : "";

        rows.push([
          idx + 1,
          b.bookingCode || "",
          b.requesterName || b.requester?.name || "",
          b.departmentName || b.department?.departmentName || "",
          b.contactPhone || "",
          b.purpose || "",
          b.route || "",
          b.departureLocation || "",
          b.destination || "",
          depTime,
          retTime,
          b.passengersCount || 1,
          b.passengerNames || "",
          b.vehicleType === "SCHOOL_VEHICLE" ? "Xe trường" : "Xe công nghệ",
          b.assignedVehicle?.name || "",
          b.assignedVehicle?.licensePlate || "",
          b.assignedDriver?.fullName || "",
          b.assignedDriver?.phone || "",
          b.totalDistanceKm || 0,
          approvalText,
          dispatchText,
        ]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 6 },
        { wch: 16 },
        { wch: 22 },
        { wch: 22 },
        { wch: 14 },
        { wch: 30 },
        { wch: 35 },
        { wch: 25 },
        { wch: 25 },
        { wch: 18 },
        { wch: 14 },
        { wch: 10 },
        { wch: 30 },
        { wch: 14 },
        { wch: 18 },
        { wch: 14 },
        { wch: 20 },
        { wch: 14 },
        { wch: 16 },
        { wch: 14 },
        { wch: 16 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "LichXeCongTac");
      const filename = `Lich_Xe_Cong_Tac_NSG_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`;
      XLSX.writeFile(workbook, filename);
      message.success("Xuất file Excel thành công!");
    } catch (err) {
      console.error("Lỗi xuất Excel:", err);
      message.error("Lỗi khi xuất file Excel");
    }
  };

  useEffect(() => {
    if (activeTab === "vehicles" || activeTab === "drivers") {
      loadVehiclesAndDrivers();
    } else {
      fetchBookings(1);
    }
  }, [activeTab]);

  // Xử lý tạo đơn đăng ký xe mới
  const handleCreateSubmit = async (values) => {
    try {
      const dates = values.dateRange || values.timeRange;
      const payload = {
        ...values,
        departureTime: dates[0].startOf('day').toISOString(),
        estimatedReturnTime: dates[1].endOf('day').toISOString(),
        departureHour: values.departureHour || "07:30",
        waypoints: createWaypointsData?.waypoints || [],
        totalDistanceKm: createWaypointsData?.totalDistanceKm || 0,
        isRoundTrip: createWaypointsData?.isRoundTrip !== false,
        estimatedDurationMinutes: createWaypointsData?.estimatedDurationMinutes || 0,
        distanceCalculationMethod: "ROUTING_API",
      };
      delete payload.dateRange;
      delete payload.timeRange;

      const res = await createVehicleBooking(payload);
      if (res.data?.success) {
        message.success(res.data.message || "Tạo đơn đăng ký xe thành công");
        setIsCreateModalOpen(false);
        createForm.resetFields();
        setCreateWaypointsData(null);
        fetchBookings(1);
        if (typeof refetchNotificationCounts === "function") refetchNotificationCounts();
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi tạo đơn đăng ký xe");
    }
  };

  // Mở modal chỉnh sửa đơn xe khi BGH chưa duyệt
  const handleOpenEditModal = (record) => {
    setEditingBooking(record);
    setEditWaypointsData({
      waypoints: record.waypoints || [],
      totalDistanceKm: record.totalDistanceKm || 0,
      isRoundTrip: record.isRoundTrip !== false,
      estimatedDurationMinutes: record.estimatedDurationMinutes || 0,
    });
    const startDate = record.departureTime ? dayjs(record.departureTime) : dayjs();
    const returnDate = record.estimatedReturnTime ? dayjs(record.estimatedReturnTime) : startDate;

    editForm.setFieldsValue({
      onBehalfOfUser: record.onBehalfOf ? (record.requester?._id || record.requester) : undefined,
      targetApprover: record.targetApprover?._id || record.targetApprover,
      contactPhone: record.contactPhone,
      vehicleType: record.vehicleType || "SCHOOL_VEHICLE",
      assignedVehicle: record.assignedVehicle?._id || record.assignedVehicle || undefined,
      assignedDriver: record.assignedDriver?._id || record.assignedDriver || undefined,
      requiredSeats: record.requiredSeats || 7,
      passengersCount: record.passengersCount || 1,
      passengerNames: record.passengerNames || "",
      purpose: record.purpose,
      route: record.route,
      departureLocation: record.departureLocation || "Trường Cao đẳng Bách khoa Nam Sài Gòn",
      destination: record.destination || "",
      dateRange: [startDate, returnDate],
      departureHour: record.departureHour || "07:30",
      notes: record.notes || "",
    });
    setIsEditModalOpen(true);
  };

  // Xử lý lưu chỉnh sửa đơn xe
  const handleEditSubmit = async (values) => {
    if (!editingBooking) return;
    try {
      const dates = values.dateRange || values.timeRange;
      const payload = {
        ...values,
        departureTime: dates[0].startOf('day').toISOString(),
        estimatedReturnTime: dates[1].endOf('day').toISOString(),
        departureHour: values.departureHour || "07:30",
        waypoints: editWaypointsData?.waypoints || editingBooking?.waypoints || [],
        totalDistanceKm:
          editWaypointsData?.totalDistanceKm !== undefined
            ? editWaypointsData.totalDistanceKm
            : (editingBooking?.totalDistanceKm || 0),
        isRoundTrip:
          editWaypointsData?.isRoundTrip !== undefined
            ? editWaypointsData.isRoundTrip
            : (editingBooking?.isRoundTrip !== false),
        estimatedDurationMinutes:
          editWaypointsData?.estimatedDurationMinutes !== undefined
            ? editWaypointsData.estimatedDurationMinutes
            : (editingBooking?.estimatedDurationMinutes || 0),
        distanceCalculationMethod: "ROUTING_API",
      };
      delete payload.dateRange;
      delete payload.timeRange;

      const res = await updateVehicleBooking(editingBooking._id, payload);
      if (res.data?.success) {
        message.success(res.data.message || "Cập nhật phiếu đăng ký xe thành công!");
        setIsEditModalOpen(false);
        editForm.resetFields();
        setEditWaypointsData(null);
        fetchBookings(pagination.current);
        loadVehiclesAndDrivers();
        fetchStats();
        if (typeof refetchNotificationCounts === "function") refetchNotificationCounts();
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi cập nhật phiếu đăng ký xe");
    }
  };

  // Xử lý BGH Duyệt / Từ chối
  const handleReviewSubmit = async (values) => {
    if (!selectedBooking) return;
    try {
      const res = await reviewVehicleBooking(selectedBooking._id, values);
      if (res.data?.success) {
        message.success(res.data.message);
        setIsReviewModalOpen(false);
        reviewForm.resetFields();
        fetchBookings(pagination.current);
        loadVehiclesAndDrivers();
        fetchStats();
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi phê duyệt đơn");
    }
  };

  // Mở modal phân bổ xe và kiểm tra xung đột trùng lịch tài xế / xe (Hỗ trợ phân bổ mới và Đổi xe/tài xế)
  const handleOpenDispatchModal = async (record) => {
    setSelectedBooking(record);
    dispatchForm.resetFields();
    setDispatchConflicts({ busyDrivers: [], busyVehicles: [] });

    const currentVehId = record.assignedVehicle?._id || record.assignedVehicle || null;
    const currentDrvId = record.assignedDriver?._id || record.assignedDriver || null;

    dispatchForm.setFieldsValue({
      assignedVehicle: currentVehId || undefined,
      assignedDriver: currentDrvId || undefined,
      dispatchNotes: record.dispatchNotes || "",
    });
    setSelectedVehicleId(currentVehId);
    setSelectedDriverId(currentDrvId);
    setForceDispatch(false);
    setIsDispatchModalOpen(true);
    setIsCheckingConflicts(true);

    try {
      const res = await checkDispatchConflictsApi({
        departureTime: record.departureTime,
        estimatedReturnTime: record.estimatedReturnTime,
        excludeBookingId: record._id,
      });
      if (res.data?.success) {
        setDispatchConflicts(res.data.data || { busyDrivers: [], busyVehicles: [] });
      }
    } catch (err) {
      console.warn("Lỗi kiểm tra trùng lịch điều xe:", err);
    } finally {
      setIsCheckingConflicts(false);
    }
  };

  // Xử lý Phân bổ xe & tài xế
  const handleDispatchSubmit = async (values) => {
    if (!selectedBooking) return;
    if ((selectedDriverConflict || selectedVehicleConflict) && !forceDispatch) {
      message.error(
        "Tài xế hoặc xe đã có lịch trùng với một chuyến đi khác! Vui lòng chọn tài xế/xe khác hoặc tích xác nhận phân công đặc biệt."
      );
      return;
    }
    try {
      const payload = {
        ...values,
        forceDispatch: Boolean(forceDispatch),
      };
      const res = await dispatchVehicleBooking(selectedBooking._id, payload);
      if (res.data?.success) {
        message.success("Phân bổ xe và tài xế thành công");
        setIsDispatchModalOpen(false);
        dispatchForm.resetFields();
        setDispatchConflicts({ busyDrivers: [], busyVehicles: [] });
        setSelectedDriverId(null);
        setSelectedVehicleId(null);
        setForceDispatch(false);
        fetchBookings(pagination.current);
        loadVehiclesAndDrivers();
        fetchStats();
        if (typeof refetchNotificationCounts === "function") refetchNotificationCounts();
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi phân bổ xe");
    }
  };

  // Hủy đơn
  const handleCancelBooking = async (id) => {
    try {
      const res = await cancelVehicleBooking(id);
      if (res.data?.success) {
        message.success("Đã hủy đơn đăng ký thành công");
        fetchBookings(pagination.current);
        loadVehiclesAndDrivers();
        fetchStats();
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi hủy đơn");
    }
  };

  // Cập nhật trạng thái chuyến đi (Ghi nhận thời gian thực tế đi & về)
  const handleUpdateStatus = async (id, status) => {
    try {
      const nowIso = new Date().toISOString();
      const payload = {
        status,
        actualDepartureTime: status === "IN_PROGRESS" ? nowIso : undefined,
        actualReturnTime: status === "COMPLETED" ? nowIso : undefined,
      };

      const res = await updateTripStatus(id, payload);
      if (res.data?.success) {
        message.success(
          status === "IN_PROGRESS"
            ? "Đã xác nhận bắt đầu chuyến đi và ghi nhận thời gian xuất phát"
            : status === "COMPLETED"
            ? "Đã xác nhận chuyến xe đã về an toàn và ghi nhận thời gian kết thúc"
            : "Đã cập nhật trạng thái chuyến đi"
        );
        fetchBookings(pagination.current);
        loadVehiclesAndDrivers();
        fetchStats();
      }
    } catch (err) {
      message.error("Lỗi cập nhật trạng thái chuyến đi");
    }
  };

  // In phiếu đăng ký xe công tác chuẩn hành chính (A4)
  const handlePrintBooking = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Phiếu Đăng Ký Sử Dụng Xe Công Tác - ${selectedBooking?.bookingCode || ""}</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 20mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 13pt;
            line-height: 1.4;
            color: #000;
            margin: 0;
            padding: 0;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
          }
          .header-table td {
            vertical-align: top;
            text-align: center;
            padding: 0 4px;
          }
          .org-title {
            font-size: 11pt;
            font-weight: normal;
            text-transform: uppercase;
          }
          .school-title {
            font-size: 11.5pt;
            font-weight: bold;
            text-transform: uppercase;
          }
          .national-title {
            font-size: 11pt;
            font-weight: bold;
            text-transform: uppercase;
          }
          .motto {
            font-size: 11pt;
            font-weight: bold;
          }
          .line-decor {
            width: 120px;
            height: 1px;
            background: #000;
            margin: 3px auto 0 auto;
          }
          .doc-number {
            font-size: 11pt;
            margin-top: 6px;
            font-style: italic;
          }
          .main-title {
            text-align: center;
            font-size: 15pt;
            font-weight: bold;
            text-transform: uppercase;
            margin: 16px 0 4px 0;
          }
          .sub-title-date {
            text-align: center;
            font-size: 11pt;
            font-style: italic;
            margin-bottom: 16px;
          }
          .info-list {
            margin: 0;
            padding: 0;
            list-style: none;
          }
          .info-row {
            margin-bottom: 6px;
            font-size: 12.5pt;
          }
          .info-label {
            font-weight: bold;
          }
          .section-title {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 12pt;
            margin-top: 14px;
            margin-bottom: 6px;
            border-bottom: 1px dashed #555;
            padding-bottom: 2px;
          }
          .bordered-table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0 12px 0;
          }
          .bordered-table th, .bordered-table td {
            border: 1px solid #000;
            padding: 6px 8px;
            font-size: 11.5pt;
          }
          .bordered-table th {
            background-color: #f5f5f5;
            text-align: center;
            font-weight: bold;
          }
          .signature-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 24px;
            page-break-inside: avoid;
          }
          .signature-table td {
            text-align: center;
            vertical-align: top;
            width: 33.33%;
            padding: 0 4px;
          }
          .signature-table tr.sign-names-row td {
            vertical-align: bottom;
          }
          .sign-role {
            font-weight: bold;
            font-size: 11.5pt;
            text-transform: uppercase;
            line-height: 1.35;
          }
          .sign-note {
            font-size: 10.5pt;
            font-style: italic;
            margin-top: 2px;
          }
          .sign-space {
            height: 65px;
          }
          .sign-name {
            font-weight: bold;
            font-size: 11.5pt;
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 350);
  };

  // Render tag trạng thái duyệt
  const renderApprovalTag = (status) => {
    switch (status) {
      case "APPROVED":
        return <Tag color="success" icon={<CheckCircleOutlined />}>BGH Đã Duyệt</Tag>;
      case "REJECTED":
        return <Tag color="error" icon={<CloseCircleOutlined />}>Từ Chối</Tag>;
      case "CANCELLED":
        return <Tag color="default">Đã Hủy</Tag>;
      case "PENDING":
      default:
        return <Tag color="processing" icon={<ClockCircleOutlined />}>Chờ BGH Duyệt</Tag>;
    }
  };

  // Render tag trạng thái điều xe
  const renderDispatchTag = (status, vehicleType) => {
    switch (status) {
      case "ASSIGNED":
        return <Tag color="cyan" icon={<CarOutlined />}>Đã Xếp Xe</Tag>;
      case "IN_PROGRESS":
        return <Tag color="blue" icon={<CarOutlined />}>Đang Đi Công Tác</Tag>;
      case "COMPLETED":
        return <Tag color="green" icon={<CheckCircleOutlined />}>Hoàn Thành</Tag>;
      case "UNASSIGNED":
      default:
        return vehicleType === "RIDE_HAILING" ? (
          <Tag color="orange">Xe Công Nghệ (Chờ xác nhận)</Tag>
        ) : (
          <Tag color="warning">Chưa Phân Bổ Xe</Tag>
        );
    }
  };

  // Phân quyền người dùng hiện tại
  const userRole = (currentUser?.role || Cookies.get("role") || "").toUpperCase();
  const isAdmin = userRole === "ADMIN";
  const isAdminOrManager = userRole === "ADMIN" || userRole === "MANAGER";
  const isBgh =
    isBghUser(currentUser) ||
    (currentUser?.department?.departmentCode || "").toUpperCase() === "BGH" ||
    (currentUser?.department?.departmentName || "").toLowerCase().includes("giám hiệu") ||
    (currentUser?.position?.positionCode || "").toUpperCase() === "PHT" ||
    (currentUser?.position?.positionCode || "").toUpperCase() === "HT" ||
    ["HIỆU TRƯỞNG", "Q.HIỆU TRƯỞNG", "PHÓ HIỆU TRƯỞNG", "BGH"].some((r) => userRole.includes(r));

  // Kiểm tra người dùng hiện tại có phải tài xế hay không
  const currentDriver = drivers.find(
    (d) =>
      (d.userAccount && (d.userAccount._id === currentUser?._id || d.userAccount === currentUser?._id)) ||
      (d.phone && currentUser?.mobile && d.phone.trim() === currentUser.mobile.trim()) ||
      (d.phone && currentUser?.phone && d.phone.trim() === currentUser.phone.trim()) ||
      (d.fullName && (currentUser?.name || currentUser?.fullName) && d.fullName.trim().toLowerCase() === (currentUser.name || currentUser.fullName).trim().toLowerCase())
  );
  const isDriver = !!currentDriver;

  // Nút hành động cho từng chuyến xe (Dùng chung cho cả Table View và Mobile Card View)
  const renderActionButtons = (record, isMobileView = false) => {
    const isBGHReviewer =
      (isBgh || isAdminOrManager) &&
      (record.targetApprover?._id === currentUser?._id ||
        record.targetApprover === currentUser?._id ||
        isAdminOrManager);

    // Lãnh đạo được giao phân bổ hoặc Quản trị viên (Hỗ trợ phân bổ mới & Đổi xe/tài xế)
    const canDispatch =
      record.approvalStatus === "APPROVED" &&
      record.vehicleType === "SCHOOL_VEHICLE" &&
      !["COMPLETED", "CANCELLED"].includes(record.dispatchStatus) &&
      (isAdminOrManager ||
        record.assignedDispatcher?._id === currentUser?._id ||
        record.assignedDispatcher === currentUser?._id ||
        !record.assignedDispatcher);

    // Quyền chỉnh sửa đơn: Người tạo sửa khi PENDING; Admin/Manager có thể sửa bất kỳ lúc nào khi chưa hoàn thành
    const canEditTrip =
      (record.approvalStatus === "PENDING" && (isRequesterOfTrip || isAdminOrManager)) ||
      (isAdminOrManager && !["COMPLETED", "CANCELLED"].includes(record.dispatchStatus));

    // Tài xế được phân bổ lái xe (hoặc Admin)
    const isAssignedDriverOfTrip =
      isAdminOrManager ||
      (currentDriver &&
        record.assignedDriver &&
        (record.assignedDriver._id === currentDriver._id || record.assignedDriver === currentDriver._id));

    // Người đăng ký đơn cũng có thể xác nhận bắt đầu đi và đã về
    const isRequesterOfTrip =
      record.requester?._id === currentUser?._id ||
      record.requester === currentUser?._id ||
      record.createdBy?._id === currentUser?._id ||
      record.createdBy === currentUser?._id;

    const canConfirmTrip = isAssignedDriverOfTrip || isRequesterOfTrip;

    const isAssigned = record.dispatchStatus === "ASSIGNED";
    const isInProgress = record.dispatchStatus === "IN_PROGRESS";

    return (
      <div className={isMobileView ? "flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100" : "flex flex-col gap-1.5 w-full min-w-[100px] max-w-[120px]"}>
        <Button
          size="small"
          icon={<EyeOutlined />}
          className={isMobileView ? "text-xs font-medium" : "w-full text-xs flex items-center justify-center font-medium shadow-sm hover:border-blue-500 hover:text-blue-600"}
          onClick={() => {
            setSelectedBooking(record);
            setIsDetailModalOpen(true);
          }}
        >
          Chi tiết
        </Button>

        {/* Chỉnh sửa đơn: Người đăng ký sửa khi PENDING, Admin có thể sửa lịch trình/tài xế mọi lúc khi chưa kết thúc */}
        {canEditTrip && (
          <Button
            size="small"
            icon={<EditOutlined />}
            className={isMobileView ? "text-xs font-medium border-amber-500 text-amber-700 hover:bg-amber-50" : "w-full text-xs flex items-center justify-center font-medium border-amber-500 text-amber-700 hover:bg-amber-50 hover:border-amber-600 shadow-2xs"}
            onClick={() => handleOpenEditModal(record)}
          >
            Chỉnh sửa
          </Button>
        )}

        {/* BGH Duyệt / Từ chối */}
        {isBGHReviewer && record.approvalStatus === "PENDING" && (
          <Button
            size="small"
            type="primary"
            icon={<AuditOutlined />}
            className={isMobileView ? "text-xs font-medium bg-emerald-600 hover:bg-emerald-700 border-emerald-600" : "w-full text-xs flex items-center justify-center font-medium bg-emerald-600 hover:bg-emerald-700 border-emerald-600 shadow-sm"}
            onClick={() => {
              setSelectedBooking(record);
              reviewForm.setFieldsValue({
                action: "APPROVE",
                vehicleType: record.vehicleType || "SCHOOL_VEHICLE",
                assignedDispatcher: record.assignedDispatcher?._id || record.assignedDispatcher || undefined,
                approvalNotes: "",
                rejectionReason: "",
              });
              setIsReviewModalOpen(true);
            }}
          >
            Xét duyệt
          </Button>
        )}

        {/* Lãnh đạo được giao xếp xe hoặc Admin phân xe / Đổi xe & tài xế */}
        {canDispatch && (
          <Button
            size="small"
            type={record.dispatchStatus === "UNASSIGNED" ? "primary" : "default"}
            icon={record.dispatchStatus === "UNASSIGNED" ? <CarOutlined /> : <ToolOutlined />}
            className={
              record.dispatchStatus === "UNASSIGNED"
                ? isMobileView
                  ? "text-xs font-medium bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-white"
                  : "w-full text-xs flex items-center justify-center font-medium bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-white shadow-sm"
                : isMobileView
                ? "text-xs font-medium border-indigo-500 text-indigo-700 hover:bg-indigo-50"
                : "w-full text-xs flex items-center justify-center font-medium border-indigo-500 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-600 shadow-2xs"
            }
            onClick={() => handleOpenDispatchModal(record)}
          >
            {record.dispatchStatus === "UNASSIGNED" ? "Phân bổ xe" : "Đổi xe / Tài xế"}
          </Button>
        )}

        {/* Tài xế lái xe hoặc Người đăng ký bấm Bắt đầu đi & Hoàn thành chuyến về */}
        {isAssigned && canConfirmTrip && (
          <Popconfirm
            title="Xác nhận bắt đầu chuyến đi?"
            onConfirm={() => handleUpdateStatus(record._id, "IN_PROGRESS")}
            okText="Bắt đầu"
            cancelText="Hủy"
          >
            <Button
              size="small"
              type="primary"
              icon={<CarOutlined />}
              className={isMobileView ? "text-xs font-medium bg-blue-600 hover:bg-blue-700 border-blue-600" : "w-full text-xs flex items-center justify-center font-medium bg-blue-600 hover:bg-blue-700 border-blue-600 shadow-sm"}
            >
              Bắt đầu đi
            </Button>
          </Popconfirm>
        )}
        {isInProgress && canConfirmTrip && (
          <Popconfirm
            title="Xác nhận chuyến xe đã về an toàn / kết thúc?"
            onConfirm={() => handleUpdateStatus(record._id, "COMPLETED")}
            okText="Đã về"
            cancelText="Hủy"
          >
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              className={isMobileView ? "text-xs font-medium bg-emerald-600 hover:bg-emerald-700 border-emerald-600" : "w-full text-xs flex items-center justify-center font-medium bg-emerald-600 hover:bg-emerald-700 border-emerald-600 shadow-sm"}
            >
              Hoàn thành
            </Button>
          </Popconfirm>
        )}

        {/* Hủy đơn dành cho người đăng ký */}
        {record.approvalStatus === "PENDING" && (activeTab === "my" || isRequesterOfTrip || isAdminOrManager) && (
          <Popconfirm
            title="Hủy yêu cầu đăng ký xe này?"
            onConfirm={() => handleCancelBooking(record._id)}
            okText="Đồng ý"
            cancelText="Không"
          >
            <Button
              size="small"
              danger
              icon={<RollbackOutlined />}
              className={isMobileView ? "text-xs font-medium" : "w-full text-xs flex items-center justify-center font-medium shadow-sm"}
            >
              Hủy đơn
            </Button>
          </Popconfirm>
        )}

        {/* Toàn quyền Admin / Manager: Xóa hoàn toàn đơn */}
        {isAdminOrManager && (
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa vĩnh viễn đơn đăng ký xe này không?"
            onConfirm={async () => {
              try {
                const res = await deleteVehicleBooking(record._id);
                if (res.data?.success) {
                  message.success("Đã xóa đơn đăng ký xe thành công");
                  fetchBookings(pagination.current);
        loadVehiclesAndDrivers();
        fetchStats();
                }
              } catch (e) {
                message.error(e.response?.data?.message || "Lỗi xóa đơn đăng ký xe");
              }
            }}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              className={isMobileView ? "text-xs font-medium hover:bg-red-50" : "w-full text-xs flex items-center justify-center font-medium shadow-sm hover:bg-red-50"}
            >
              Xóa
            </Button>
          </Popconfirm>
        )}
      </div>
    );
  };

  // Cột bảng Bookings
  const bookingColumns = [
    {
      title: "Mã Đơn",
      dataIndex: "bookingCode",
      key: "bookingCode",
      render: (code, record) => (
        <div>
          <span className="font-semibold text-blue-700">{code}</span>
          <div className="text-[11px] text-gray-400">{dayjs(record.createdAt).format("DD/MM/YYYY HH:mm")}</div>
        </div>
      ),
      width: 130,
    },
    {
      title: "Người Đăng Ký",
      key: "requester",
      render: (_, record) => {
        const name =
          record.requesterName ||
          record.requester?.name ||
          record.requester?.fullName ||
          record.requester?.userName ||
          "";
        const dept =
          record.departmentName ||
          record.department?.departmentName ||
          record.department?.name ||
          record.requester?.department?.departmentName ||
          record.requester?.department?.name ||
          "--";
        const phone =
          record.contactPhone ||
          record.requester?.mobile ||
          record.requester?.phone ||
          "";

        return (
          <div className="min-w-[140px]">
            <div className="font-medium text-slate-800">{name}</div>
            <div className="text-xs text-gray-500 line-clamp-1" title={dept}>{dept}</div>
            {phone && (
              <div className="text-xs text-blue-600 font-mono">
                <PhoneOutlined /> {phone}
              </div>
            )}
            {record.onBehalfOf && (
              <div className="text-[11px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded mt-1 border border-amber-200/80 inline-block">
                ✍️ ĐK hộ{record.createdByName ? `: ${record.createdByName}` : ""}
              </div>
            )}
          </div>
        );
      },
      width: 160,
    },
    {
      title: "Nội Dung & Lộ Trình",
      key: "purpose",
      width: 340,
      render: (_, record) => (
        <div className="w-full max-w-[340px] whitespace-normal break-words space-y-1.5 py-1">
          <div
            className="font-semibold text-slate-800 leading-snug break-words"
            title={record.purpose}
          >
            {record.purpose}
          </div>
          {record.route && (
            <div
              className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-md border border-slate-200/80 leading-relaxed break-words"
              title={record.route}
            >
              <div className="flex items-center justify-between gap-1 flex-wrap mb-1">
                <span className="font-semibold text-slate-700">📍 Lộ trình:</span>
                {record.totalDistanceKm > 0 && (
                  <Tag color="blue" className="text-[11px] font-mono py-0 px-1.5 m-0 font-semibold border-blue-200">
                    ~{record.totalDistanceKm} km
                  </Tag>
                )}
              </div>
              <div className="text-slate-800">{record.route}</div>
              {Array.isArray(record.waypoints) && record.waypoints.length > 0 && (
                <div className="mt-1 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    {record.waypoints.length} điểm {record.isRoundTrip ? "(khứ hồi)" : "(1 chiều)"}
                  </span>
                  <a
                    href={buildGoogleMapsDirectionUrl(record.waypoints, record.isRoundTrip)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GlobalOutlined /> Chỉ đường Maps
                  </a>
                </div>
              )}
            </div>
          )}
          {record.passengerNames && (
            <div
              className="text-xs text-purple-700 bg-purple-50/70 px-2.5 py-0.5 rounded-md border border-purple-100/80 leading-relaxed break-words flex items-start gap-1"
              title={record.passengerNames}
            >
              <TeamOutlined className="mt-1 shrink-0 text-purple-600" />
              <span>
                <strong className="font-semibold">Cùng đi ({record.passengersCount || 1} người):</strong>{" "}
                {record.passengerNames}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Ngày Đi & Về",
      key: "time",
      render: (_, record) => (
        <div className="text-xs min-w-[170px] space-y-1">
          <div className="leading-tight">
            <span className="text-gray-500 font-medium">Đi:</span>{" "}
            <strong className="text-blue-700">{formatVietnameseDayAndDate(record.departureTime)}</strong>
          </div>
          <div className="leading-tight">
            <span className="text-gray-500 font-medium">Về:</span>{" "}
            <span className="text-slate-700 font-medium">{formatVietnameseDayAndDate(record.estimatedReturnTime)}</span>
          </div>
        </div>
      ),
      width: 195,
    },
    {
      title: "Giờ Xuất Phát",
      key: "departureHour",
      render: (_, record) => {
        const hour = record.departureHour || (record.departureTime && !dayjs(record.departureTime).isSame(dayjs(record.departureTime).startOf('day')) ? dayjs(record.departureTime).format("HH:mm") : "--");
        return (
          <div className="min-w-[90px]">
            <Tag color="cyan" className="font-mono font-medium">
              <ClockCircleOutlined className="mr-1" />
              {hour}
            </Tag>
          </div>
        );
      },
      width: 110,
    },
    {
      title: "Phương Tiện & Phân Xe",
      dataIndex: "vehicleType",
      key: "vehicleType",
      render: (type, record) => {
        const isSchool = type === "SCHOOL_VEHICLE";
        return (
          <div className="min-w-[160px] space-y-1">
            <div className="flex items-center gap-1 flex-wrap">
              <Tag color={isSchool ? "blue" : "purple"} className="m-0 font-medium">
                {isSchool ? "Xe Trường" : "Xe Công Nghệ"}
              </Tag>
              {record.requiredSeats && (
                <span className="text-[11px] text-gray-500 font-medium">({record.requiredSeats} chỗ)</span>
              )}
            </div>

            {isSchool ? (
              record.assignedVehicle ? (
                <div className="text-xs bg-emerald-50 p-1.5 rounded border border-emerald-200/90 space-y-0.5 mt-1">
                  <div className="font-semibold text-emerald-900 flex items-center gap-1 flex-wrap">
                    <CarOutlined className="text-emerald-700" />
                    <span>{record.assignedVehicle.name}</span>
                    <Tag color="cyan" className="text-[10px] py-0 px-1 font-mono m-0 font-bold border-cyan-300">
                      {record.assignedVehicle.licensePlate}
                    </Tag>
                  </div>
                  {record.assignedDriver ? (
                    <div className="text-slate-700 flex items-center gap-1 text-[11px]">
                      <UserOutlined className="text-blue-600" />
                      <span className="font-semibold text-slate-800">{record.assignedDriver.fullName}</span>
                      {record.assignedDriver.phone && (
                        <span className="text-blue-600 font-mono">({record.assignedDriver.phone})</span>
                      )}
                    </div>
                  ) : (
                    <div className="text-amber-700 text-[11px] italic">Chưa chỉ định tài xế</div>
                  )}
                  {record.assignedDispatcher && (
                    <div className="text-[10px] text-gray-500 truncate" title={`Người điều xe: ${record.assignedDispatcher.name || record.assignedDispatcher.fullName || ""}`}>
                      ĐP: {record.assignedDispatcher.name || record.assignedDispatcher.fullName}
                    </div>
                  )}
                </div>
              ) : record.approvalStatus === "APPROVED" ? (
                <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 flex items-center gap-1 font-medium mt-1">
                  <ClockCircleOutlined /> Chờ phòng QTTB phân xe & tài xế
                </div>
              ) : (
                <div className="text-xs text-gray-400 italic mt-0.5">Chờ BGH duyệt để xếp xe</div>
              )
            ) : (
              <div className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/60 mt-0.5">
                Chuyến đi đặt xe công nghệ
              </div>
            )}
          </div>
        );
      },
      width: 175,
    },
    {
      title: "Trạng Thái & Phê Duyệt",
      key: "status",
      render: (_, record) => {
        const approverName =
          record.approvedByName ||
          record.approvedBy?.name ||
          record.approvedBy?.fullName ||
          record.targetApprover?.name ||
          record.targetApprover?.fullName;

        return (
          <div className="space-y-1.5 min-w-[160px]">
            <div className="flex items-center gap-1 flex-wrap">
              {renderApprovalTag(record.approvalStatus)}
              {record.approvalStatus === "APPROVED" && (
                renderDispatchTag(record.dispatchStatus, record.vehicleType)
              )}
            </div>

            {/* Chi tiết BGH phê duyệt */}
            {record.approvalStatus === "APPROVED" && (
              <div className="text-[11px] bg-slate-50 p-1.5 rounded border border-slate-200 text-slate-700 space-y-0.5">
                <div className="flex items-center gap-1 font-semibold text-emerald-800">
                  <CheckCircleOutlined className="text-emerald-600" />
                  <span>Duyệt: {approverName || "BGH"}</span>
                </div>
                {record.approvedAt && (
                  <div className="text-gray-400 text-[10px]">
                    {dayjs(record.approvedAt).format("DD/MM/YYYY HH:mm")}
                  </div>
                )}
                {record.approvalNotes && (
                  <Tooltip title={`Ý kiến BGH: ${record.approvalNotes}`}>
                    <div className="text-indigo-600 truncate text-[11px] italic cursor-pointer">
                      💬 "{record.approvalNotes}"
                    </div>
                  </Tooltip>
                )}
              </div>
            )}

            {record.approvalStatus === "REJECTED" && (
              <div className="text-[11px] bg-rose-50 p-1.5 rounded border border-rose-200 text-rose-800">
                <div className="font-semibold">BGH từ chối</div>
                {record.rejectionReason && (
                  <Tooltip title={record.rejectionReason}>
                    <div className="truncate text-[11px] text-rose-600 cursor-pointer">
                      Lý do: "{record.rejectionReason}"
                    </div>
                  </Tooltip>
                )}
              </div>
            )}

            {record.approvalStatus === "PENDING" && (
              <div className="text-[11px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/70 truncate">
                Kính gửi: <strong>{approverName || "Ban Giám Hiệu"}</strong>
              </div>
            )}

            {record.actualDepartureTime && (
              <div className="text-[11px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                <span>🚗 Bắt đầu đi:</span>
                <span className="font-semibold">{dayjs(record.actualDepartureTime).format("DD/MM HH:mm")}</span>
              </div>
            )}
            {record.actualReturnTime && (
              <div className="text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                <span>🏁 Chuyến về:</span>
                <span className="font-semibold">{dayjs(record.actualReturnTime).format("DD/MM HH:mm")}</span>
              </div>
            )}
          </div>
        );
      },
      width: 175,
    },
    {
      title: "Thao Tác",
      key: "actions",
      render: (_, record) => renderActionButtons(record, false),
      width: 130,
      fixed: "right",
    },
  ];

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <Card className="shadow-sm rounded-xl border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2 m-0">
              <CarOutlined className="text-blue-600" /> Quản Lý Phương Tiện & Điều Xe Công Tác
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 mb-0">
              Quy trình đăng ký, Ban Giám Hiệu phê duyệt và phân bổ xe công tác trường Nam Sài Gòn
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                if (activeTab === "vehicles" || activeTab === "drivers") {
                  loadVehiclesAndDrivers();
                } else {
                  fetchBookings(pagination.current);
        loadVehiclesAndDrivers();
        fetchStats();
                  fetchStats();
                }
              }}
            >
              Làm mới
            </Button>
            <Button
              icon={<BarChartOutlined className="text-purple-600" />}
              onClick={() => setIsStatsModalOpen(true)}
              className="border-purple-200 hover:border-purple-400 text-purple-700 bg-purple-50/50"
            >
              Báo Cáo Thống Kê
            </Button>
            <Button
              icon={<FileExcelOutlined className="text-emerald-600" />}
              onClick={exportBookingsToExcel}
              className="border-emerald-200 hover:border-emerald-400 text-emerald-700 bg-emerald-50/50"
            >
              Xuất Excel
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createForm.resetFields();
                setCreateWaypointsData(null);
                if (currentUser) {
                  createForm.setFieldsValue({
                    contactPhone: currentUser.mobile || currentUser.phone || "",
                    passengersCount: 1,
                    vehicleType: "SCHOOL_VEHICLE",
                    requiredSeats: 7,
                    departureLocation: "Trường Cao đẳng Bách khoa Nam Sài Gòn",
                  });
                }
                setIsCreateModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 shadow-sm"
            >
              Đăng Ký Xe Công Tác
            </Button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* KHỐI KPI THỐNG KÊ NHANH & TÙY CHỌN THU GỌN / MỞ RỘNG      */}
        {/* ========================================================= */}
        <div className="mt-3 mb-2">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wide">
              <DashboardOutlined className="text-blue-600" />
              <span>Thống Kê Xe ({statsData?.overview?.totalBookings ?? pagination.total ?? 0})</span>
            </div>
            <Button
              size="small"
              type="text"
              onClick={() => setIsKpiCollapsed(!isKpiCollapsed)}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium px-2 py-0.5 bg-blue-50/70 hover:bg-blue-100 rounded-md border border-blue-200/60"
            >
              {isKpiCollapsed ? (
                <>
                  <ExpandOutlined /> <span className="hidden sm:inline">Mở rộng thẻ</span><span className="sm:hidden">Chi tiết</span>
                </>
              ) : (
                <>
                  <CompressOutlined /> <span className="hidden sm:inline">Thu gọn thẻ</span><span className="sm:hidden">Thu nhỏ</span>
                </>
              )}
            </Button>
          </div>

          {/* Dạng 1: Thu gọn (Cuộn ngang 1 hàng siêu gọn - Tiết kiệm không gian) */}
          {isKpiCollapsed ? (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar select-none text-xs">
              {/* Tất cả */}
              <div
                onClick={() => handleQuickFilter("ALL")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer whitespace-nowrap transition-all shrink-0 ${
                  !isAnyFilterActive
                    ? "bg-blue-600 text-white border-blue-600 shadow-2xs font-semibold"
                    : "bg-white text-slate-700 border-slate-200 hover:border-blue-300"
                }`}
              >
                <CarOutlined />
                <span>Tất cả: <strong>{statsData?.overview?.totalBookings ?? pagination.total ?? 0}</strong></span>
              </div>

              {/* Chờ BGH duyệt */}
              <div
                onClick={() => handleQuickFilter("PENDING")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer whitespace-nowrap transition-all shrink-0 ${
                  filterApprovalStatus === "PENDING"
                    ? "bg-amber-500 text-white border-amber-500 shadow-2xs font-semibold"
                    : "bg-amber-50/90 text-amber-800 border-amber-200 hover:border-amber-400"
                }`}
              >
                <ClockCircleOutlined />
                <span>Chờ BGH: <strong>{statsData?.overview?.pendingApproval ?? vehiclePendingDetails?.bghPendingCount ?? 0}</strong></span>
              </div>

              {/* Chờ xếp xe */}
              <div
                onClick={() => handleQuickFilter("UNASSIGNED")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer whitespace-nowrap transition-all shrink-0 ${
                  filterDispatchStatus === "UNASSIGNED"
                    ? "bg-sky-500 text-white border-sky-500 shadow-2xs font-semibold"
                    : "bg-sky-50/90 text-sky-800 border-sky-200 hover:border-sky-400"
                }`}
              >
                <AuditOutlined />
                <span>Chờ xếp: <strong>{statsData?.overview?.unassigned ?? vehiclePendingDetails?.dispatchPendingCount ?? 0}</strong></span>
              </div>

              {/* Đang đi */}
              <div
                onClick={() => handleQuickFilter("IN_PROGRESS")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer whitespace-nowrap transition-all shrink-0 ${
                  filterDispatchStatus === "IN_PROGRESS"
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold"
                    : "bg-emerald-50/90 text-emerald-800 border-emerald-200 hover:border-emerald-400"
                }`}
              >
                <CompassOutlined />
                <span>Đang đi: <strong>{statsData?.overview?.inProgress ?? 0}</strong></span>
              </div>

              {/* Hoàn thành */}
              <div
                onClick={() => handleQuickFilter("COMPLETED")}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border cursor-pointer whitespace-nowrap transition-all shrink-0 ${
                  filterDispatchStatus === "COMPLETED"
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs font-semibold"
                    : "bg-indigo-50/90 text-indigo-800 border-indigo-200 hover:border-indigo-400"
                }`}
              >
                <CheckCircleOutlined />
                <span>Đã về: <strong>{statsData?.overview?.completed ?? 0}</strong></span>
              </div>

              {/* Báo cáo */}
              <div
                onClick={() => setIsStatsModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer whitespace-nowrap font-medium transition-all shrink-0"
              >
                <BarChartOutlined />
                <span>Báo cáo: <strong>{statsData?.overview?.totalPassengers ?? 0}</strong> khách</span>
              </div>
            </div>
          ) : (
            /* Dạng 2: Mở rộng (Grid thẻ chi tiết, tối ưu padding nhỏ gọn trên mobile) */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5">
              {/* 1. Tổng chuyến */}
              <div
                onClick={() => handleQuickFilter("ALL")}
                className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  !isAnyFilterActive
                    ? "bg-blue-50/90 border-blue-400 shadow-sm ring-2 ring-blue-200/80"
                    : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between text-slate-500 text-[10px] sm:text-[11px] font-bold tracking-wider">
                  <span>TỔNG CHUYẾN</span>
                  <CarOutlined className="text-blue-500 text-xs sm:text-sm" />
                </div>
                <div className="text-lg sm:text-xl font-bold text-slate-800 mt-0.5 sm:mt-1">
                  {statsData?.overview?.totalBookings ?? pagination.total ?? 0}
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate font-medium">
                  {statsData?.overview?.totalDistanceKm ? `${statsData.overview.totalDistanceKm} km` : "Tất cả kỳ"}
                </div>
              </div>

              {/* 2. Chờ BGH duyệt */}
              <div
                onClick={() => handleQuickFilter("PENDING")}
                className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  filterApprovalStatus === "PENDING"
                    ? "bg-amber-50/90 border-amber-400 shadow-sm ring-2 ring-amber-200/80"
                    : "bg-white border-slate-200 hover:border-amber-300 hover:shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between text-amber-700 text-[10px] sm:text-[11px] font-bold tracking-wider">
                  <span>CHỜ BGH DUYỆT</span>
                  <ClockCircleOutlined className="text-amber-500 text-xs sm:text-sm" />
                </div>
                <div className="text-lg sm:text-xl font-bold text-amber-600 mt-0.5 sm:mt-1">
                  {statsData?.overview?.pendingApproval ?? vehiclePendingDetails?.bghPendingCount ?? 0}
                </div>
                <div className="text-[10px] sm:text-[11px] text-amber-700/70 mt-0.5 truncate font-medium">
                  Bấm lọc nhanh
                </div>
              </div>

              {/* 3. Chờ xếp xe */}
              <div
                onClick={() => handleQuickFilter("UNASSIGNED")}
                className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  filterDispatchStatus === "UNASSIGNED"
                    ? "bg-sky-50/90 border-sky-400 shadow-sm ring-2 ring-sky-200/80"
                    : "bg-white border-slate-200 hover:border-sky-300 hover:shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between text-sky-700 text-[10px] sm:text-[11px] font-bold tracking-wider">
                  <span>CHỜ XẾP XE</span>
                  <AuditOutlined className="text-sky-500 text-xs sm:text-sm" />
                </div>
                <div className="text-lg sm:text-xl font-bold text-sky-600 mt-0.5 sm:mt-1">
                  {statsData?.overview?.unassigned ?? vehiclePendingDetails?.dispatchPendingCount ?? 0}
                </div>
                <div className="text-[10px] sm:text-[11px] text-sky-700/70 mt-0.5 truncate font-medium">
                  Đã duyệt BGH
                </div>
              </div>

              {/* 4. Đang di chuyển */}
              <div
                onClick={() => handleQuickFilter("IN_PROGRESS")}
                className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  filterDispatchStatus === "IN_PROGRESS"
                    ? "bg-emerald-50/90 border-emerald-400 shadow-sm ring-2 ring-emerald-200/80"
                    : "bg-white border-slate-200 hover:border-emerald-300 hover:shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between text-emerald-700 text-[10px] sm:text-[11px] font-bold tracking-wider">
                  <span>ĐANG DI CHUYỂN</span>
                  <CompassOutlined className="text-emerald-500 text-xs sm:text-sm" />
                </div>
                <div className="text-lg sm:text-xl font-bold text-emerald-600 mt-0.5 sm:mt-1">
                  {statsData?.overview?.inProgress ?? 0}
                </div>
                <div className="text-[10px] sm:text-[11px] text-emerald-700/70 mt-0.5 truncate font-medium">
                  Xe đang chạy
                </div>
              </div>

              {/* 5. Hoàn thành */}
              <div
                onClick={() => handleQuickFilter("COMPLETED")}
                className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  filterDispatchStatus === "COMPLETED"
                    ? "bg-indigo-50/90 border-indigo-400 shadow-sm ring-2 ring-indigo-200/80"
                    : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between text-indigo-700 text-[10px] sm:text-[11px] font-bold tracking-wider">
                  <span>ĐÃ HOÀN THÀNH</span>
                  <CheckCircleOutlined className="text-indigo-500 text-xs sm:text-sm" />
                </div>
                <div className="text-lg sm:text-xl font-bold text-indigo-600 mt-0.5 sm:mt-1">
                  {statsData?.overview?.completed ?? 0}
                </div>
                <div className="text-[10px] sm:text-[11px] text-indigo-700/70 mt-0.5 truncate font-medium">
                  Về an toàn
                </div>
              </div>

              {/* 6. Phân tích & Lượt người */}
              <div
                onClick={() => setIsStatsModalOpen(true)}
                className="p-2.5 sm:p-3 rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50/90 to-pink-50/60 hover:border-purple-400 hover:shadow-sm transition-all cursor-pointer select-none"
              >
                <div className="flex items-center justify-between text-purple-700 text-[10px] sm:text-[11px] font-bold tracking-wider">
                  <span>BÁO CÁO</span>
                  <BarChartOutlined className="text-purple-600 text-xs sm:text-sm" />
                </div>
                <div className="text-lg sm:text-xl font-bold text-purple-700 mt-0.5 sm:mt-1 flex items-baseline gap-1">
                  <span>{statsData?.overview?.totalPassengers ?? 0}</span>
                  <span className="text-[10px] font-medium text-purple-500">khách</span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-purple-600 font-semibold mt-0.5 flex items-center gap-1 truncate">
                  <span>Phân tích</span> ➔
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs giao diện phân quyền */}
        <Tabs activeKey={activeTab} onChange={setActiveTab} className="mt-2">
          <TabPane tab="Đơn Đăng Ký Của Tôi" key="my" />
          {(isBgh || isAdmin) && (
            <TabPane
              tab={
                <span className="flex items-center gap-1.5">
                  <span>Duyệt Đăng Ký Xe (BGH)</span>
                  {(vehiclePendingDetails?.bghPendingCount || 0) > 0 && (
                    <Badge count={vehiclePendingDetails.bghPendingCount} size="small" />
                  )}
                </span>
              }
              key="pending_approval"
            />
          )}
          <TabPane
            tab={
              <span className="flex items-center gap-1.5">
                <span>Phân Bổ Xe & Lịch Trình</span>
                {(vehiclePendingDetails?.dispatchPendingCount || 0) > 0 && (
                  <Badge count={vehiclePendingDetails.dispatchPendingCount} size="small" />
                )}
              </span>
            }
            key="dispatch"
          />
          {isDriver && (
            <TabPane
              tab={
                <span className="flex items-center gap-1.5">
                  <span>🚗 Lịch Chạy Của Tôi</span>
                  {(vehiclePendingDetails?.driverTripCount || 0) > 0 && (
                    <Badge count={vehiclePendingDetails.driverTripCount} size="small" />
                  )}
                </span>
              }
              key="assigned_driver"
            />
          )}
          <TabPane tab="Tất Cả Lịch Xe" key="all" />
          {isAdminOrManager && <TabPane tab="Danh Mục Phương Tiện" key="vehicles" />}
          {isAdminOrManager && <TabPane tab="Danh Sách Tài Xế" key="drivers" />}
        </Tabs>

        {/* Bảng dữ liệu hoặc Danh mục */}
        {activeTab === "vehicles" ? (
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-slate-700">Đội xe trường ({vehicles.length} xe):</span>
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingVehicle(null);
                  vehicleForm.resetFields();
                  setIsVehicleModalOpen(true);
                }}
              >
                Thêm Phương Tiện
              </Button>
            </div>
            <Table
              dataSource={vehicles}
              rowKey="_id"
              pagination={false}
              scroll={{ x: 600 }}
              columns={[
                { title: "Tên Xe", dataIndex: "name", key: "name", render: (t) => <strong>{t}</strong> },
                { title: "Biển Số", dataIndex: "licensePlate", key: "licensePlate", render: (t) => <Tag color="blue">{t}</Tag> },
                { title: "Số Chỗ", dataIndex: "seats", key: "seats", render: (s) => `${s} chỗ` },
                {
                  title: "Trạng Thái",
                  dataIndex: "status",
                  key: "status",
                  render: (st, rec) => (
                    <Tag
                      color={st === "IN_USE" ? "processing" : st === "AVAILABLE" ? "success" : "warning"}
                      icon={st === "IN_USE" ? <CarOutlined /> : undefined}
                      className="font-medium"
                    >
                      {st === "IN_USE"
                        ? `Đang đi công tác${rec.activeBookingCode ? ` (${rec.activeBookingCode})` : ""}`
                        : st === "AVAILABLE"
                        ? "Sẵn sàng"
                        : "Bảo dưỡng"}
                    </Tag>
                  ),
                },
                { title: "Ghi Chú", dataIndex: "notes", key: "notes" },
                ...(isAdminOrManager
                  ? [
                      {
                        title: "Thao Tác",
                        key: "actions",
                        width: 140,
                        render: (_, rec) => (
                          <Space size={4}>
                            <Button
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => {
                                setEditingVehicle(rec);
                                vehicleForm.setFieldsValue({
                                  name: rec.name,
                                  licensePlate: rec.licensePlate,
                                  seats: rec.seats,
                                  status: rec.status || "AVAILABLE",
                                  notes: rec.notes || "",
                                });
                                setIsVehicleModalOpen(true);
                              }}
                            >
                              Sửa
                            </Button>
                            <Popconfirm
                              title="Xóa phương tiện này khỏi danh mục?"
                              onConfirm={async () => {
                                try {
                                  const res = await deleteVehicle(rec._id);
                                  if (res.data?.success) {
                                    message.success("Đã xóa xe thành công");
                                    loadVehiclesAndDrivers();
                                  }
                                } catch (e) {
                                  message.error(e.response?.data?.message || "Lỗi xóa xe");
                                }
                              }}
                              okText="Xóa"
                              cancelText="Hủy"
                              okButtonProps={{ danger: true }}
                            >
                              <Button size="small" danger icon={<DeleteOutlined />}>
                                Xóa
                              </Button>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        ) : activeTab === "drivers" ? (
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="font-semibold text-slate-700">Đội ngũ tài xế ({drivers.length} nhân sự):</span>
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingDriver(null);
                  driverForm.resetFields();
                  setIsDriverModalOpen(true);
                }}
              >
                Thêm Tài Xế
              </Button>
            </div>
            <Table
              dataSource={drivers}
              rowKey="_id"
              pagination={false}
              scroll={{ x: 600 }}
              columns={[
                { title: "Họ Và Tên", dataIndex: "fullName", key: "fullName", render: (t) => <strong>{t}</strong> },
                { title: "Số Điện Thoại", dataIndex: "phone", key: "phone", render: (p) => <span className="font-mono text-blue-700">{p}</span> },
                { title: "Hạng Bằng", dataIndex: "licenseClass", key: "licenseClass", render: (c) => <Tag color="purple">Hạng {c}</Tag> },
                {
                  title: "Trạng Thái",
                  dataIndex: "status",
                  key: "status",
                  render: (st, rec) => (
                    <Tag
                      color={st === "ON_TRIP" ? "blue" : st === "AVAILABLE" ? "success" : "default"}
                      icon={st === "ON_TRIP" ? <CarOutlined /> : undefined}
                      className="font-medium"
                    >
                      {st === "ON_TRIP"
                        ? `Đang chạy công tác${rec.activeBookingCode ? ` (${rec.activeBookingCode})` : ""}`
                        : st === "AVAILABLE"
                        ? "Sẵn sàng nhận lịch"
                        : "Nghỉ"}
                    </Tag>
                  ),
                },
                { title: "Ghi Chú", dataIndex: "notes", key: "notes" },
                ...(isAdminOrManager
                  ? [
                      {
                        title: "Thao Tác",
                        key: "actions",
                        width: 140,
                        render: (_, rec) => (
                          <Space size={4}>
                            <Button
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => {
                                setEditingDriver(rec);
                                driverForm.setFieldsValue({
                                  userAccount: rec.userAccount?._id || rec.userAccount || undefined,
                                  fullName: rec.fullName,
                                  phone: rec.phone,
                                  licenseClass: rec.licenseClass || "D",
                                  status: rec.status || "AVAILABLE",
                                  notes: rec.notes || "",
                                });
                                setIsDriverModalOpen(true);
                              }}
                            >
                              Sửa
                            </Button>
                            <Popconfirm
                              title="Xóa tài xế này khỏi danh sách?"
                              onConfirm={async () => {
                                try {
                                  const res = await deleteDriver(rec._id);
                                  if (res.data?.success) {
                                    message.success("Đã xóa tài xế thành công");
                                    loadVehiclesAndDrivers();
                                  }
                                } catch (e) {
                                  message.error(e.response?.data?.message || "Lỗi xóa tài xế");
                                }
                              }}
                              okText="Xóa"
                              cancelText="Hủy"
                              okButtonProps={{ danger: true }}
                            >
                              <Button size="small" danger icon={<DeleteOutlined />}>
                                Xóa
                              </Button>
                            </Popconfirm>
                          </Space>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        ) : (
          <div>
            {/* ========================================================= */}
            {/* THANH BỘ LỌC THÔNG MINH (SMART FILTER BAR)               */}
            {/* ========================================================= */}
            <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 mb-3 sm:mb-4 shadow-2xs">
              {/* Dòng 1: Tìm kiếm chính + Nút mở rộng bộ lọc + Nút lọc */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Tìm theo mã đơn, người đăng ký, điểm đến, lộ trình..."
                    prefix={<SearchOutlined className="text-gray-400" />}
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onPressEnter={() => fetchBookings(1)}
                    allowClear
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type={isFilterExpanded ? "primary" : "default"}
                    icon={<FilterOutlined />}
                    onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                    className={isFilterExpanded ? "bg-blue-600 border-blue-600" : ""}
                  >
                    <span>Bộ lọc</span>
                    {activeFiltersCount > 0 && (
                      <Badge count={activeFiltersCount} className="ml-1" style={{ backgroundColor: "#10b981" }} />
                    )}
                    {isFilterExpanded ? <UpOutlined className="text-xs ml-1" /> : <DownOutlined className="text-xs ml-1" />}
                  </Button>

                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    onClick={() => fetchBookings(1)}
                    className="bg-blue-600 hover:bg-blue-700 hidden sm:inline-flex"
                  >
                    Lọc
                  </Button>

                  {isAnyFilterActive && (
                    <Button
                      icon={<ClearOutlined />}
                      onClick={handleResetFilter}
                      className="text-gray-500 hover:text-red-600"
                      title="Đặt lại bộ lọc"
                    >
                      <span className="hidden sm:inline">Đặt lại</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Dòng chi tiết mở rộng của bộ lọc */}
              {isFilterExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {/* Khoảng thời gian xuất phát */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Thời gian xuất phát:</label>
                      <RangePicker
                        className="w-full"
                        value={dateRange}
                        onChange={(val) => {
                          setDateRange(val);
                          fetchBookings(1, { dateRange: val });
                          fetchStats(val);
                        }}
                        format="DD/MM/YYYY"
                        placeholder={["Từ ngày", "Đến ngày"]}
                        presets={[
                          { label: "Hôm nay", value: [dayjs().startOf("day"), dayjs().endOf("day")] },
                          { label: "Tuần này", value: [dayjs().startOf("week"), dayjs().endOf("week")] },
                          { label: "Tháng này", value: [dayjs().startOf("month"), dayjs().endOf("month")] },
                          { label: "Quý này", value: [dayjs().startOf("quarter"), dayjs().endOf("quarter")] },
                          {
                            label: "Năm học này",
                            value: [
                              dayjs().month() >= 8
                                ? dayjs().month(8).startOf("month")
                                : dayjs().subtract(1, "year").month(8).startOf("month"),
                              dayjs().month() >= 8
                                ? dayjs().add(1, "year").month(7).endOf("month")
                                : dayjs().month(7).endOf("month"),
                            ],
                          },
                        ]}
                      />
                    </div>

                    {/* Lọc theo Phê duyệt BGH */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">BGH phê duyệt:</label>
                      <Select
                        className="w-full"
                        value={activeTab === "pending_approval" ? bghApprovalFilter : filterApprovalStatus}
                        onChange={(val) => {
                          if (activeTab === "pending_approval") {
                            setBghApprovalFilter(val);
                            fetchBookings(1, { bghApprovalFilter: val });
                          } else {
                            setFilterApprovalStatus(val);
                            fetchBookings(1, { filterApprovalStatus: val });
                          }
                        }}
                        placeholder="BGH phê duyệt"
                      >
                        <Option value="ALL">Tất cả duyệt</Option>
                        <Option value="PENDING">⏳ Chờ duyệt</Option>
                        <Option value="APPROVED">✅ Đã phê duyệt</Option>
                        <Option value="REJECTED">❌ Đã từ chối</Option>
                        {activeTab !== "pending_approval" && <Option value="CANCELLED">🚫 Đã hủy</Option>}
                      </Select>
                    </div>

                    {/* Lọc theo Tiến độ điều xe */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tiến độ điều xe:</label>
                      <Select
                        className="w-full"
                        value={filterDispatchStatus}
                        onChange={(val) => {
                          setFilterDispatchStatus(val);
                          fetchBookings(1, { filterDispatchStatus: val });
                        }}
                        placeholder="Tiến độ điều xe"
                      >
                        <Option value="ALL">Tất cả tiến độ</Option>
                        <Option value="UNASSIGNED">📋 Chưa xếp xe</Option>
                        <Option value="ASSIGNED">🚗 Đã xếp xe & tài xế</Option>
                        <Option value="IN_PROGRESS">🟢 Đang di chuyển</Option>
                        <Option value="COMPLETED">🏁 Đã hoàn thành</Option>
                        <Option value="CANCELLED">❌ Đã hủy</Option>
                      </Select>
                    </div>

                    {/* Loại xe */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Loại phương tiện:</label>
                      <Select
                        className="w-full"
                        value={filterVehicleType}
                        onChange={(val) => {
                          setFilterVehicleType(val);
                          fetchBookings(1, { filterVehicleType: val });
                        }}
                        placeholder="Loại phương tiện"
                      >
                        <Option value="ALL">Tất cả loại xe</Option>
                        <Option value="SCHOOL_VEHICLE">Xe của trường</Option>
                        <Option value="RIDE_HAILING">Xe công nghệ</Option>
                      </Select>
                    </div>

                    {/* Xe trường cụ thể */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Xe trường cụ thể:</label>
                      <Select
                        className="w-full"
                        value={filterVehicleId}
                        onChange={(val) => {
                          setFilterVehicleId(val);
                          fetchBookings(1, { filterVehicleId: val });
                        }}
                        placeholder="Chọn xe trường"
                        showSearch
                        optionFilterProp="children"
                      >
                        <Option value="ALL">Tất cả xe trường</Option>
                        {vehicles.map((v) => (
                          <Option key={v._id} value={v._id}>
                            {v.name} ({v.licensePlate})
                          </Option>
                        ))}
                      </Select>
                    </div>

                    {/* Tài xế phụ trách */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tài xế phụ trách:</label>
                      <Select
                        className="w-full"
                        value={filterDriverId}
                        onChange={(val) => {
                          setFilterDriverId(val);
                          fetchBookings(1, { filterDriverId: val });
                        }}
                        placeholder="Chọn tài xế"
                        showSearch
                        optionFilterProp="children"
                      >
                        <Option value="ALL">Tất cả tài xế</Option>
                        {drivers.map((d) => (
                          <Option key={d._id} value={d._id}>
                            {d.fullName} {d.phone ? `(${d.phone})` : ""}
                          </Option>
                        ))}
                      </Select>
                    </div>

                    {/* Đơn vị đăng ký */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Đơn vị đăng ký:</label>
                      <Select
                        className="w-full"
                        value={filterDepartment}
                        onChange={(val) => {
                          setFilterDepartment(val);
                          fetchBookings(1, { filterDepartment: val });
                        }}
                        placeholder="Đơn vị đăng ký"
                        showSearch
                        optionFilterProp="children"
                      >
                        <Option value="ALL">Tất cả đơn vị</Option>
                        {departmentsList.map((dept) => (
                          <Option key={dept._id} value={dept._id}>
                            {dept.departmentName || dept.name}
                          </Option>
                        ))}
                      </Select>
                    </div>

                    {/* Nút lọc & đặt lại trên mobile */}
                    <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4 justify-end pt-1">
                      <Button
                        type="primary"
                        icon={<SearchOutlined />}
                        onClick={() => fetchBookings(1)}
                        className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                      >
                        Áp dụng bộ lọc
                      </Button>
                      {isAnyFilterActive && (
                        <Button
                          icon={<ClearOutlined />}
                          onClick={handleResetFilter}
                          className="text-gray-500 hover:text-red-600 w-full sm:w-auto"
                        >
                          Xóa bộ lọc
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tags tiêu chí đang lọc */}
              {isAnyFilterActive && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pt-2 border-t border-dashed border-slate-200 text-xs">
                  <span className="text-slate-500 font-semibold mr-1">Đang lọc theo:</span>
                  {searchKeyword && (
                    <Tag
                      closable
                      onClose={() => {
                        setSearchKeyword("");
                        fetchBookings(1, { searchKeyword: "" });
                      }}
                      color="blue"
                    >
                      Từ khóa: "{searchKeyword}"
                    </Tag>
                  )}
                  {dateRange && dateRange[0] && dateRange[1] && (
                    <Tag
                      closable
                      onClose={() => {
                        setDateRange(null);
                        fetchBookings(1, { dateRange: null });
                        fetchStats(null);
                      }}
                      color="purple"
                    >
                      {dateRange[0].format("DD/MM/YYYY")} - {dateRange[1].format("DD/MM/YYYY")}
                    </Tag>
                  )}
                  {filterApprovalStatus !== "ALL" && (
                    <Tag
                      closable
                      onClose={() => {
                        setFilterApprovalStatus("ALL");
                        fetchBookings(1, { filterApprovalStatus: "ALL" });
                      }}
                      color="orange"
                    >
                      Duyệt: {filterApprovalStatus}
                    </Tag>
                  )}
                  {filterDispatchStatus !== "ALL" && (
                    <Tag
                      closable
                      onClose={() => {
                        setFilterDispatchStatus("ALL");
                        fetchBookings(1, { filterDispatchStatus: "ALL" });
                      }}
                      color="cyan"
                    >
                      Tiến độ: {filterDispatchStatus}
                    </Tag>
                  )}
                  {filterVehicleType !== "ALL" && (
                    <Tag
                      closable
                      onClose={() => {
                        setFilterVehicleType("ALL");
                        fetchBookings(1, { filterVehicleType: "ALL" });
                      }}
                      color="geekblue"
                    >
                      {filterVehicleType === "SCHOOL_VEHICLE" ? "Xe trường" : "Xe công nghệ"}
                    </Tag>
                  )}
                  {filterVehicleId !== "ALL" && (
                    <Tag
                      closable
                      onClose={() => {
                        setFilterVehicleId("ALL");
                        fetchBookings(1, { filterVehicleId: "ALL" });
                      }}
                      color="volcano"
                    >
                      Xe: {vehicles.find((v) => v._id === filterVehicleId)?.licensePlate || filterVehicleId}
                    </Tag>
                  )}
                  {filterDriverId !== "ALL" && (
                    <Tag
                      closable
                      onClose={() => {
                        setFilterDriverId("ALL");
                        fetchBookings(1, { filterDriverId: "ALL" });
                      }}
                      color="gold"
                    >
                      Tài xế: {drivers.find((d) => d._id === filterDriverId)?.fullName || filterDriverId}
                    </Tag>
                  )}
                  {filterDepartment !== "ALL" && (
                    <Tag
                      closable
                      onClose={() => {
                        setFilterDepartment("ALL");
                        fetchBookings(1, { filterDepartment: "ALL" });
                      }}
                      color="magenta"
                    >
                      Đơn vị: {departmentsList.find((d) => d._id === filterDepartment)?.departmentName || filterDepartment}
                    </Tag>
                  )}
                </div>
              )}
            </div>

            {/* Bộ lọc phụ cho Ban Giám Hiệu khi ở tab pending_approval */}
            {activeTab === "pending_approval" && (
              <div className="mb-3.5 p-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 border border-blue-200/80 rounded-xl flex items-center justify-between flex-wrap gap-2 shadow-2xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Lọc danh sách BGH:
                  </span>
                  <Radio.Group
                    size="small"
                    value={bghApprovalFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setBghApprovalFilter(val);
                      fetchBookings(1, { bghApprovalFilter: val });
                    }}
                    buttonStyle="solid"
                  >
                    <Radio.Button value="PENDING">
                      ⏳ Chờ BGH duyệt {(vehiclePendingDetails?.bghPendingCount || 0) > 0 ? `(${vehiclePendingDetails.bghPendingCount})` : ""}
                    </Radio.Button>
                    <Radio.Button value="APPROVED">
                      ✅ BGH đã phê duyệt
                    </Radio.Button>
                    <Radio.Button value="REJECTED">
                      ❌ BGH đã từ chối
                    </Radio.Button>
                    <Radio.Button value="ALL">
                      📋 Tất cả đơn BGH phụ trách
                    </Radio.Button>
                  </Radio.Group>
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  {bghApprovalFilter === "APPROVED" && "🔎 Xem lại các chuyến đi đã phê duyệt và tình trạng phân bổ xe/tài xế"}
                  {bghApprovalFilter === "PENDING" && "⏳ Đang xem các phiếu đăng ký xe cần Ban Giám Hiệu xem xét duyệt"}
                  {bghApprovalFilter === "REJECTED" && "❌ Danh sách các phiếu đăng ký xe đã bị từ chối"}
                  {bghApprovalFilter === "ALL" && "📋 Xem toàn bộ danh sách phiếu thuộc phạm vi phê duyệt của BGH"}
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* THANH ĐIỀU KHIỂN PHÂN NHÓM LỊCH, CHẾ ĐỘ XEM & CỠ CHỮ     */}
            {/* ========================================================= */}
            <div className="flex items-center justify-between flex-wrap gap-2.5 mb-3 px-1">
              {/* Phân nhóm lịch: Tất cả / Chưa chạy (Gần nhất lên đầu) / Đã xong */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <Radio.Group
                  value={scheduleGroupTab}
                  onChange={(e) => {
                    const val = e.target.value;
                    setScheduleGroupTab(val);
                    fetchBookings(1, { scheduleGroupTab: val });
                  }}
                  size="small"
                  buttonStyle="solid"
                >
                  <Radio.Button value="all">
                    <span className="font-medium text-xs">
                      📌 Tất cả ({pagination.total || bookings.length})
                    </span>
                  </Radio.Button>
                  <Radio.Button value="uncompleted">
                    <span className="font-semibold text-xs text-blue-700">
                      ⏳ Chưa chạy / Sắp tới ({scheduleGroupTab === "uncompleted" ? (pagination.total || uncompletedBookings.length) : uncompletedBookings.length})
                    </span>
                  </Radio.Button>
                  <Radio.Button value="completed">
                    <span className="font-semibold text-xs text-emerald-700">
                      ✅ Đã xong / Lịch sử ({scheduleGroupTab === "completed" ? (pagination.total || completedBookings.length) : completedBookings.length})
                    </span>
                  </Radio.Button>
                </Radio.Group>
              </div>

              <div className="flex items-center gap-2 flex-wrap ml-auto">
                {/* Lựa chọn Chế độ xem: Tự động / Dạng Thẻ / Dạng Bảng */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                  <span className="text-[11px] text-slate-500 px-1 font-medium hidden sm:inline">Chế độ xem:</span>
                  <Radio.Group
                    size="small"
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value)}
                    buttonStyle="solid"
                  >
                    <Radio.Button value="auto">
                      <Tooltip title="Tự động (Thẻ trên Mobile, Bảng trên Desktop)">
                        <span className="text-xs font-medium">Tự động</span>
                      </Tooltip>
                    </Radio.Button>
                    <Radio.Button value="cards">
                      <Tooltip title="Dạng Thẻ (Dễ nhìn trên điện thoại & màn hình nhỏ)">
                        <AppstoreOutlined className="mr-0.5" /> <span className="text-xs font-medium">Thẻ</span>
                      </Tooltip>
                    </Radio.Button>
                    <Radio.Button value="table">
                      <Tooltip title="Dạng Bảng (Đầy đủ các cột dữ liệu)">
                        <TableOutlined className="mr-0.5" /> <span className="text-xs font-medium">Bảng</span>
                      </Tooltip>
                    </Radio.Button>
                  </Radio.Group>
                </div>

                {/* Tùy chọn thu nhỏ cỡ chữ / khoảng cách (Table density) */}
                {(viewMode === "table" || viewMode === "auto") && (
                  <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                    <span className="text-[11px] text-slate-500 px-1 font-medium">Cỡ chữ:</span>
                    <Radio.Group
                      size="small"
                      value={tableDensity}
                      onChange={(e) => setTableDensity(e.target.value)}
                      buttonStyle="solid"
                    >
                      <Radio.Button value="small">
                        <Tooltip title="Thu nhỏ kích thước bảng để xem nhiều dòng hơn">
                          <CompressOutlined className="mr-0.5" /> <span className="text-xs">Thu nhỏ</span>
                        </Tooltip>
                      </Radio.Button>
                      <Radio.Button value="middle">
                        <Tooltip title="Kích thước tiêu chuẩn">
                          <ExpandOutlined className="mr-0.5" /> <span className="text-xs">Chuẩn</span>
                        </Tooltip>
                      </Radio.Button>
                    </Radio.Group>
                  </div>
                )}
              </div>
            </div>

            {/* ========================================================= */}
            {/* HÀM RENDER TỪNG THẺ CHUYẾN ĐI (CARD ITEM CHO MOBILE)     */}
            {/* ========================================================= */}
            {(() => {
              const renderCardItem = (record) => {
                const creatorName =
                  record.user?.fullName ||
                  record.user?.name ||
                  record.requester?.fullName ||
                  record.requester?.name ||
                  "Chưa xác định";
                const creatorDept =
                  record.department?.departmentName ||
                  record.department?.name ||
                  record.requesterDepartment ||
                  "";
                const creatorPhone =
                  record.user?.phone ||
                  record.user?.phoneNumber ||
                  record.requester?.phone ||
                  "";
                const departureHour =
                  record.departureHour ||
                  (record.departureTime && !dayjs(record.departureTime).isSame(dayjs(record.departureTime).startOf("day"))
                    ? dayjs(record.departureTime).format("HH:mm")
                    : "--");
                const isSchool = record.vehicleType === "SCHOOL_VEHICLE";

                return (
                  <div
                    key={record._id}
                    onClick={() => {
                      setSelectedBooking(record);
                      setIsDetailModalOpen(true);
                    }}
                    className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all p-3.5 space-y-2.5 cursor-pointer active:bg-slate-50"
                  >
                    {/* Header: Mã đơn + Loại xe + Trạng thái */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Tag color="geekblue" className="font-mono font-bold text-xs m-0">
                          {record.bookingCode || "ĐK-XE"}
                        </Tag>
                        <Tag color={isSchool ? "blue" : "purple"} className="text-[11px] m-0 font-medium">
                          {isSchool ? "Xe Trường" : "Xe Công Nghệ"}
                        </Tag>
                        {record.requiredSeats && (
                          <span className="text-[11px] text-gray-500 font-medium">({record.requiredSeats} chỗ)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {renderApprovalTag(record.approvalStatus)}
                        {record.approvalStatus === "APPROVED" && renderDispatchTag(record.dispatchStatus, record.vehicleType)}
                      </div>
                    </div>

                    {/* Mục đích chuyến đi */}
                    <div>
                      <div className="font-semibold text-slate-800 text-sm leading-snug break-words">
                        {record.purpose}
                      </div>
                      {record.onBehalfOf && (
                        <div className="text-[11px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded mt-1 border border-amber-200/80 inline-block font-medium">
                          ✍️ ĐK hộ{record.createdByName ? `: ${record.createdByName}` : ""}
                        </div>
                      )}
                    </div>

                    {/* Thời gian xuất phát & về */}
                    <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200/70 text-xs space-y-1.5">
                      <div className="flex items-start justify-between gap-1 flex-wrap">
                        <span className="text-gray-500 font-medium shrink-0">Khởi hành:</span>
                        <span className="font-semibold text-blue-700 text-right">
                          <ClockCircleOutlined className="mr-1" />
                          {formatVietnameseDayAndDate(record.departureTime)} ({departureHour})
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-1 flex-wrap">
                        <span className="text-gray-500 font-medium shrink-0">Dự kiến về:</span>
                        <span className="text-slate-700 font-medium text-right">
                          {formatVietnameseDayAndDate(record.estimatedReturnTime)}
                        </span>
                      </div>
                    </div>

                    {/* Lộ trình & Google Maps */}
                    {record.route && (
                      <div className="text-xs bg-slate-50 p-2 rounded-lg border border-slate-200/70 space-y-1">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <span className="font-semibold text-slate-700">📍 Lộ trình:</span>
                          {record.totalDistanceKm > 0 && (
                            <Tag color="blue" className="text-[11px] font-mono py-0 px-1 m-0 font-semibold">
                              ~{record.totalDistanceKm} km
                            </Tag>
                          )}
                        </div>
                        <div className="text-slate-800 break-words">{record.route}</div>
                        {Array.isArray(record.waypoints) && record.waypoints.length > 0 && (
                          <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500">
                              {record.waypoints.length} điểm {record.isRoundTrip ? "(khứ hồi)" : "(1 chiều)"}
                            </span>
                            <a
                              href={buildGoogleMapsDirectionUrl(record.waypoints, record.isRoundTrip)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GlobalOutlined /> Chỉ đường Maps
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Người đăng ký & Người cùng đi */}
                    <div className="text-xs text-slate-700 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <UserOutlined className="text-blue-600" />
                          <span className="font-medium text-slate-800">{creatorName}</span>
                          {creatorDept && <span className="text-gray-400">({creatorDept})</span>}
                        </div>
                        {creatorPhone && (
                          <a
                            href={`tel:${creatorPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:text-blue-800 font-mono inline-flex items-center gap-0.5 font-medium"
                          >
                            <PhoneOutlined /> {creatorPhone}
                          </a>
                        )}
                      </div>
                      {record.passengerNames && (
                        <div className="text-[11px] text-purple-700 bg-purple-50/70 px-2 py-0.5 rounded border border-purple-100 flex items-start gap-1">
                          <TeamOutlined className="mt-0.5 shrink-0 text-purple-600" />
                          <span>
                            <strong>Cùng đi ({record.passengersCount || 1} người):</strong> {record.passengerNames}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Xe & Tài xế phân bổ */}
                    {isSchool ? (
                      record.assignedVehicle ? (
                        <div className="text-xs bg-emerald-50 p-2 rounded-lg border border-emerald-200/90 space-y-1">
                          <div className="font-semibold text-emerald-900 flex items-center justify-between gap-1">
                            <span className="flex items-center gap-1">
                              <CarOutlined className="text-emerald-700" />
                              {record.assignedVehicle.name}
                            </span>
                            <Tag color="cyan" className="text-[10px] py-0 px-1 font-mono m-0 font-bold border-cyan-300">
                              {record.assignedVehicle.licensePlate}
                            </Tag>
                          </div>
                          {record.assignedDriver ? (
                            <div className="text-slate-700 flex items-center justify-between gap-1 text-[11px]">
                              <span className="flex items-center gap-1">
                                <UserOutlined className="text-blue-600" />
                                <strong className="text-slate-800">{record.assignedDriver.fullName}</strong>
                              </span>
                              {record.assignedDriver.phone && (
                                <a
                                  href={`tel:${record.assignedDriver.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-600 hover:text-blue-800 font-mono inline-flex items-center gap-0.5"
                                >
                                  <PhoneOutlined /> {record.assignedDriver.phone}
                                </a>
                              )}
                            </div>
                          ) : (
                            <div className="text-amber-700 text-[11px] italic">Chưa chỉ định tài xế</div>
                          )}
                        </div>
                      ) : record.approvalStatus === "APPROVED" ? (
                        <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 flex items-center gap-1 font-medium">
                          <ClockCircleOutlined /> Chờ phòng QTTB phân xe & tài xế
                        </div>
                      ) : null
                    ) : null}

                    {/* Footer: Nút thao tác */}
                    <div
                      className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1 flex-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {renderActionButtons(record, true)}
                    </div>
                  </div>
                );
              };

              const tableRowConfig = (record) => ({
                onClick: (e) => {
                  const target = e.target;
                  if (
                    target.closest("button") ||
                    target.closest(".ant-btn") ||
                    target.closest(".ant-popconfirm") ||
                    target.closest(".ant-modal") ||
                    target.closest(".ant-dropdown") ||
                    target.closest("a")
                  ) {
                    return;
                  }
                  setSelectedBooking(record);
                  setIsDetailModalOpen(true);
                },
                className: "cursor-pointer hover:bg-blue-50/50 transition-colors",
              });

              return (
                <>
                  {/* ========================================================= */}
                  {/* 1. DẠNG THẺ (CARD VIEW - TỐI ƯU MOBILE & MÀN HÌNH NHỎ)     */}
                  {/* ========================================================= */}
                  {(viewMode === "cards" || viewMode === "auto") && (
                    <div className={viewMode === "auto" ? "block md:hidden space-y-4" : "space-y-4"}>
                      {loading ? (
                        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                          <Spin tip="Đang tải danh sách chuyến đi..." />
                        </div>
                      ) : (
                        <>
                          {/* Nhóm 1: Chưa chạy & Đang thực hiện */}
                          {(scheduleGroupTab === "all" || scheduleGroupTab === "uncompleted") && (
                            <div className="space-y-2.5">
                              <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-2.5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse shrink-0" />
                                  <div>
                                    <div className="font-bold text-blue-900 text-xs">
                                      CHƯA CHẠY & SẮP TỚI ({uncompletedBookings.length})
                                    </div>
                                    <div className="text-[10px] text-blue-700">
                                      Chuyến gần nhất xếp lên trên cùng
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={collapseUncompleted ? <DownOutlined /> : <UpOutlined />}
                                  onClick={() => setCollapseUncompleted(!collapseUncompleted)}
                                  className="text-blue-800 text-xs"
                                >
                                  {collapseUncompleted ? "Mở" : "Thu gọn"}
                                </Button>
                              </div>

                              {!collapseUncompleted && (
                                uncompletedBookings.length === 0 ? (
                                  <div className="text-center py-6 bg-white rounded-xl border border-dashed border-blue-200 text-gray-500 text-xs">
                                    Không có chuyến đi nào chưa chạy trong trang này
                                  </div>
                                ) : (
                                  uncompletedBookings.map(renderCardItem)
                                )
                              )}
                            </div>
                          )}

                          {/* Nhóm 2: Đã xong & Lịch sử */}
                          {(scheduleGroupTab === "all" || scheduleGroupTab === "completed") && (
                            <div className="space-y-2.5 pt-1">
                              <div className="bg-slate-100/90 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CheckCircleOutlined className="text-emerald-600 text-sm shrink-0" />
                                  <div>
                                    <div className="font-bold text-slate-800 text-xs">
                                      ĐÃ HOÀN THÀNH / KẾT THÚC ({completedBookings.length})
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                      Chuyến hoàn thành gần nhất xếp lên trên cùng
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={collapseCompleted ? <DownOutlined /> : <UpOutlined />}
                                  onClick={() => setCollapseCompleted(!collapseCompleted)}
                                  className="text-slate-700 text-xs"
                                >
                                  {collapseCompleted ? "Mở" : "Thu gọn"}
                                </Button>
                              </div>

                              {!collapseCompleted && (
                                completedBookings.length === 0 ? (
                                  <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-200 text-gray-500 text-xs">
                                    Không có chuyến đi nào đã hoàn thành trong trang này
                                  </div>
                                ) : (
                                  completedBookings.map(renderCardItem)
                                )
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* 2. DẠNG BẢNG (TABLE VIEW - TỐI ƯU DESKTOP MÀN HÌNH LỚN)    */}
                  {/* ========================================================= */}
                  {(viewMode === "table" || viewMode === "auto") && (
                    <div className={viewMode === "auto" ? "hidden md:block space-y-5" : "block space-y-5"}>
                      {/* Bảng Nhóm 1: Chưa chạy & Đang thực hiện */}
                      {(scheduleGroupTab === "all" || scheduleGroupTab === "uncompleted") && (
                        <div>
                          <div className="flex items-center justify-between bg-blue-50/90 border border-blue-200/90 px-3.5 py-2.5 rounded-t-xl mb-0">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse shrink-0" />
                              <div>
                                <span className="font-bold text-blue-900 text-xs sm:text-sm">
                                  LỊCH CHƯA CHẠY & ĐANG THỰC HIỆN ({uncompletedBookings.length})
                                </span>
                                <span className="hidden sm:inline-block text-[11px] text-blue-700 ml-2 font-normal">
                                  (Sắp xếp theo thứ tự: Chuyến gần nhất hiển thị lên trên cùng để tiện theo dõi & điều phối)
                                </span>
                              </div>
                            </div>
                            <Button
                              type="text"
                              size="small"
                              icon={collapseUncompleted ? <DownOutlined /> : <UpOutlined />}
                              onClick={() => setCollapseUncompleted(!collapseUncompleted)}
                              className="text-blue-800 text-xs font-medium"
                            >
                              {collapseUncompleted ? "Mở rộng" : "Thu gọn"}
                            </Button>
                          </div>

                          {!collapseUncompleted && (
                            <div className="border border-t-0 border-blue-200/80 rounded-b-xl overflow-hidden shadow-2xs">
                              <Table
                                dataSource={uncompletedBookings}
                                columns={bookingColumns}
                                rowKey="_id"
                                loading={loading}
                                size={tableDensity}
                                scroll={{ x: "max-content" }}
                                onRow={tableRowConfig}
                                pagination={false}
                                locale={{
                                  emptyText: (
                                    <div className="py-6 text-slate-500 text-xs">
                                      Không có chuyến đi nào chưa chạy hoặc đang thực hiện trong trang này
                                    </div>
                                  ),
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bảng Nhóm 2: Đã xong & Lịch sử */}
                      {(scheduleGroupTab === "all" || scheduleGroupTab === "completed") && (
                        <div>
                          <div className="flex items-center justify-between bg-slate-100/90 border border-slate-200/90 px-3.5 py-2.5 rounded-t-xl mb-0">
                            <div className="flex items-center gap-2">
                              <CheckCircleOutlined className="text-emerald-600 text-sm shrink-0" />
                              <div>
                                <span className="font-bold text-slate-800 text-xs sm:text-sm">
                                  LỊCH SỬ CHUYẾN ĐI ĐÃ HOÀN THÀNH / KẾT THÚC ({completedBookings.length})
                                </span>
                                <span className="hidden sm:inline-block text-[11px] text-slate-600 ml-2 font-normal">
                                  (Bao gồm các chuyến đã hoàn thành, từ chối hoặc đã hủy - Chuyến mới nhất lên đầu)
                                </span>
                              </div>
                            </div>
                            <Button
                              type="text"
                              size="small"
                              icon={collapseCompleted ? <DownOutlined /> : <UpOutlined />}
                              onClick={() => setCollapseCompleted(!collapseCompleted)}
                              className="text-slate-700 text-xs font-medium"
                            >
                              {collapseCompleted ? "Mở rộng" : "Thu gọn"}
                            </Button>
                          </div>

                          {!collapseCompleted && (
                            <div className="border border-t-0 border-slate-200/90 rounded-b-xl overflow-hidden shadow-2xs">
                              <Table
                                dataSource={completedBookings}
                                columns={bookingColumns}
                                rowKey="_id"
                                loading={loading}
                                size={tableDensity}
                                scroll={{ x: "max-content" }}
                                onRow={tableRowConfig}
                                pagination={false}
                                locale={{
                                  emptyText: (
                                    <div className="py-6 text-slate-500 text-xs">
                                      Không có chuyến đi nào trong lịch sử hoàn thành trong trang này
                                    </div>
                                  ),
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* PHÂN TRANG CHUNG (PAGINATION)                             */}
                  {/* ========================================================= */}
                  {bookings.length > 0 && (
                    <div className="flex justify-between items-center flex-wrap gap-2 pt-3 pb-1 border-t border-slate-200 mt-3 px-1">
                      <div className="text-xs text-slate-600 font-medium">
                        {scheduleGroupTab === "all" && (
                          <span>
                            Hiển thị <strong>{bookings.length}</strong> / <strong>{pagination.total || bookings.length}</strong> đơn (
                            <span className="text-blue-700 font-semibold">{uncompletedBookings.length} chưa chạy</span>,{" "}
                            <span className="text-emerald-700 font-semibold">{completedBookings.length} đã xong</span>)
                          </span>
                        )}
                        {scheduleGroupTab === "uncompleted" && (
                          <span>
                            Hiển thị <strong className="text-blue-700">{uncompletedBookings.length}</strong> / <strong className="text-blue-700">{pagination.total || uncompletedBookings.length}</strong> đơn chưa chạy & sắp tới
                          </span>
                        )}
                        {scheduleGroupTab === "completed" && (
                          <span>
                            Hiển thị <strong className="text-emerald-700">{completedBookings.length}</strong> / <strong className="text-emerald-700">{pagination.total || completedBookings.length}</strong> đơn đã xong & lịch sử
                          </span>
                        )}
                      </div>
                      <Pagination
                        current={pagination.current}
                        pageSize={pagination.pageSize}
                        total={pagination.total}
                        onChange={(page) => fetchBookings(page)}
                        showSizeChanger={false}
                        size="small"
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </Card>

      {/* ========================================================= */}
      {/* 1. MODAL TẠO ĐƠN ĐĂNG KÝ XE MỚI                          */}
      {/* ========================================================= */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800">
            <CarOutlined className="text-blue-600 text-lg" />
            <span className="font-bold">Đăng Ký Phương Tiện Đi Công Tác</span>
          </div>
        }
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        footer={null}
        width={800}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateSubmit} className="mt-3">
          {isAdminOrManager && (
            <Row gutter={16}>
              <Col xs={24}>
                <Form.Item
                  name="onBehalfOfUser"
                  label="Đăng ký hộ cho Cán bộ / Lãnh đạo"
                  tooltip="Dành cho Quản lý / Quản trị viên đăng ký xe công tác hộ cho Ban Giám Hiệu, Cấp trưởng, Cấp phó hoặc Cán bộ khác"
                >
                  <Select
                    placeholder="Chọn Cán bộ / Lãnh đạo đăng ký hộ (để trống nếu đăng ký cho chính mình)"
                    showSearch
                    allowClear
                    optionFilterProp="filterLabel"
                    popupMatchSelectWidth={450}
                    onChange={(leaderId) => {
                      if (leaderId) {
                        const leader = allUsers.find((l) => l._id === leaderId);
                        if (leader) {
                          createForm.setFieldsValue({
                            contactPhone: leader.mobile || leader.phone || "",
                          });
                        }
                      } else {
                        createForm.setFieldsValue({
                          contactPhone: currentUser?.mobile || currentUser?.phone || "",
                        });
                      }
                    }}
                  >
                    {onBehalfOfGroups.map((group) => (
                      <Select.OptGroup key={group.key} label={group.label}>
                        {group.users.map((u) => {
                          const posName = u.position?.positionName || u.position?.name || (typeof u.position === 'string' ? u.position : "Cán bộ");
                          const deptName = u.department?.departmentName ? ` - ${u.department.departmentName}` : "";
                          const phoneText = u.mobile || u.phone ? ` (SĐT: ${u.mobile || u.phone})` : "";
                          const label = `${u.name || u.fullName} - ${posName}${deptName}${phoneText}`;
                          return (
                            <Option key={u._id} value={u._id} filterLabel={label}>
                              <div className="py-0.5">
                                <span className="font-semibold text-slate-800">{u.name || u.fullName}</span>
                                <span className="text-xs text-blue-600 ml-1.5 font-medium">[{posName}{deptName}]</span>
                                {(u.mobile || u.phone) && (
                                  <span className="text-xs text-gray-500 ml-1.5 font-mono">📞 {u.mobile || u.phone}</span>
                                )}
                              </div>
                            </Option>
                          );
                        })}
                      </Select.OptGroup>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}

          <Row gutter={16}>
            <Col xs={24} sm={13}>
              <Form.Item
                name="targetApprover"
                label="Kính gửi BGH phê duyệt"
                rules={[{ required: true, message: "Vui lòng chọn Ban Giám Hiệu phụ trách duyệt" }]}
              >
                <Select
                  placeholder="Chọn Thầy/Cô BGH duyệt"
                  showSearch
                  allowClear
                  optionFilterProp="filterLabel"
                  optionLabelProp="selectedLabel"
                  popupMatchSelectWidth={360}
                >
                  {bghUsers.map((u) => {
                    const displayName = u.fullName || u.userName || u.name;
                    const posName = u.position?.positionName || u.position?.name || (typeof u.position === 'string' ? u.position : 'Ban Giám Hiệu');
                    const deptName = u.department?.departmentName ? ` (${u.department.departmentName})` : '';
                    const fullLabel = `${displayName} - ${posName}${deptName}`;
                    return (
                      <Option
                        key={u._id}
                        value={u._id}
                        filterLabel={fullLabel}
                        selectedLabel={`${displayName} - ${posName}`}
                      >
                        <div className="py-1">
                          <div className="font-semibold text-slate-800 leading-snug">{displayName}</div>
                          <div className="text-xs text-gray-500 leading-snug mt-0.5">{posName}{deptName}</div>
                        </div>
                      </Option>
                    );
                  })}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={11}>
              <Form.Item
                name="contactPhone"
                label="Số điện thoại liên hệ"
                rules={[{ required: true, message: "Vui lòng nhập SĐT liên hệ" }]}
              >
                <Input prefix={<PhoneOutlined className="text-gray-400" />} placeholder="Số điện thoại di động" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="vehicleType"
                label="Loại phương tiện yêu cầu"
                rules={[{ required: true }]}
                initialValue="SCHOOL_VEHICLE"
              >
                <Select>
                  <Option value="SCHOOL_VEHICLE">🚗 Xe của trường</Option>
                  <Option value="RIDE_HAILING">🚕 Xe công nghệ (Grab, Be, Taxi...)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="requiredSeats" label="Số chỗ yêu cầu" initialValue={7}>
                <InputNumber min={4} max={50} className="w-full" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="passengersCount" label="Số người đi cùng" initialValue={1}>
                <InputNumber min={1} max={50} className="w-full" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="purpose"
            label="Nội dung / Mục đích công tác"
            rules={[{ required: true, message: "Vui lòng nhập nội dung công tác" }]}
          >
            <Input placeholder="Ví dụ: Dự hội nghị công tác tại Sở GD&ĐT, Tiếp đón đoàn đại biểu..." />
          </Form.Item>

          {/* Quản lý lộ trình đa điểm, định vị GPS & tính khoảng cách tự động */}
          <div className="mb-4">
            <RouteWaypointsEditor
              onChange={(data) => {
                setCreateWaypointsData(data);
                if (data.routeText) {
                  createForm.setFieldsValue({ route: data.routeText });
                }
              }}
            />
          </div>

          <Form.Item
            name="route"
            label="Tóm tắt lộ trình di chuyển"
            rules={[{ required: true, message: "Vui lòng nhập hoặc chọn lộ trình di chuyển" }]}
            tooltip="Hệ thống tự động cập nhật lộ trình theo các điểm dừng đã chọn ở trên. Bạn cũng có thể chỉnh sửa lại nội dung nếu cần."
          >
            <Input placeholder="Ví dụ: Trường Cao đẳng Bách khoa Nam Sài Gòn ➔ 66 Lê Thánh Tôn, Q.1 ➔ Về trường" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item
                name="dateRange"
                label="Ngày đi & Ngày về"
                rules={[{ required: true, message: "Vui lòng chọn ngày đi và ngày về" }]}
              >
                <RangePicker
                  format="DD/MM/YYYY"
                  className="w-full"
                  placeholder={["Ngày xuất phát", "Ngày về"]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="departureHour"
                label="Giờ xuất phát"
                rules={[{ required: true, message: "Vui lòng nhập giờ xuất phát" }]}
                initialValue="07:30"
              >
                <Input
                  prefix={<ClockCircleOutlined className="text-gray-400" />}
                  placeholder="Ví dụ: 07:30 hoặc 13:30"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="passengerNames" label="Danh sách người tham gia đoàn công tác">
            <Input placeholder="Ví dụ: Thầy Minh, Cô Châu, Anh Hải (P. Đào tạo)..." />
          </Form.Item>

          <Form.Item name="notes" label="Ghi chú thêm (Hành lý, đón tại điểm hẹn...)">
            <TextArea rows={2} placeholder="Nhập các yêu cầu hoặc lưu ý khác nếu có" />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button onClick={() => setIsCreateModalOpen(false)}>Hủy bỏ</Button>
            <Button type="primary" htmlType="submit" className="bg-blue-600 hover:bg-blue-700">
              Gửi Yêu Cầu Đăng Ký
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ========================================================= */}
      {/* 1.1 MODAL CHỈNH SỬA ĐƠN ĐĂNG KÝ XE (KHI BGH CHƯA DUYỆT)   */}
      {/* ========================================================= */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800">
            <EditOutlined className="text-amber-600 text-lg" />
            <span className="font-bold">Chỉnh Sửa Phiếu Đăng Ký Xe Công Tác</span>
            {editingBooking && (
              <Tag color="orange" className="ml-2 font-mono">
                {editingBooking.bookingCode}
              </Tag>
            )}
          </div>
        }
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={null}
        width={800}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit} className="mt-3">
          {isAdminOrManager && (
            <Row gutter={16}>
              <Col xs={24}>
                <Form.Item
                  name="onBehalfOfUser"
                  label="Đăng ký hộ cho Cán bộ / Lãnh đạo"
                  tooltip="Dành cho Quản lý / Quản trị viên đăng ký xe công tác hộ cho Ban Giám Hiệu, Cấp trưởng, Cấp phó hoặc Cán bộ khác"
                >
                  <Select
                    placeholder="Chọn Cán bộ / Lãnh đạo đăng ký hộ (để trống nếu đăng ký cho chính mình)"
                    showSearch
                    allowClear
                    optionFilterProp="filterLabel"
                    popupMatchSelectWidth={450}
                    onChange={(leaderId) => {
                      if (leaderId) {
                        const leader = allUsers.find((l) => l._id === leaderId);
                        if (leader) {
                          editForm.setFieldsValue({
                            contactPhone: leader.mobile || leader.phone || "",
                          });
                        }
                      } else {
                        editForm.setFieldsValue({
                          contactPhone: currentUser?.mobile || currentUser?.phone || "",
                        });
                      }
                    }}
                  >
                    {onBehalfOfGroups.map((group) => (
                      <Select.OptGroup key={group.key} label={group.label}>
                        {group.users.map((u) => {
                          const posName = u.position?.positionName || u.position?.name || (typeof u.position === 'string' ? u.position : "Cán bộ");
                          const deptName = u.department?.departmentName ? ` - ${u.department.departmentName}` : "";
                          const phoneText = u.mobile || u.phone ? ` (SĐT: ${u.mobile || u.phone})` : "";
                          const label = `${u.name || u.fullName} - ${posName}${deptName}${phoneText}`;
                          return (
                            <Option key={u._id} value={u._id} filterLabel={label}>
                              <div className="py-0.5">
                                <span className="font-semibold text-slate-800">{u.name || u.fullName}</span>
                                <span className="text-xs text-blue-600 ml-1.5 font-medium">[{posName}{deptName}]</span>
                                {(u.mobile || u.phone) && (
                                  <span className="text-xs text-gray-500 ml-1.5 font-mono">📞 {u.mobile || u.phone}</span>
                                )}
                              </div>
                            </Option>
                          );
                        })}
                      </Select.OptGroup>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          )}

          <Row gutter={16}>
            <Col xs={24} sm={13}>
              <Form.Item
                name="targetApprover"
                label="Kính gửi BGH phê duyệt"
                rules={[{ required: true, message: "Vui lòng chọn Ban Giám Hiệu phụ trách duyệt" }]}
              >
                <Select
                  placeholder="Chọn Thầy/Cô BGH duyệt"
                  showSearch
                  allowClear
                  optionFilterProp="filterLabel"
                  optionLabelProp="selectedLabel"
                  popupMatchSelectWidth={360}
                >
                  {bghUsers.map((u) => {
                    const displayName = u.fullName || u.userName || u.name;
                    const posName = u.position?.positionName || u.position?.name || (typeof u.position === 'string' ? u.position : 'Ban Giám Hiệu');
                    const deptName = u.department?.departmentName ? ` (${u.department.departmentName})` : '';
                    const fullLabel = `${displayName} - ${posName}${deptName}`;
                    return (
                      <Option
                        key={u._id}
                        value={u._id}
                        filterLabel={fullLabel}
                        selectedLabel={`${displayName} - ${posName}`}
                      >
                        <div className="py-1">
                          <div className="font-semibold text-slate-800 leading-snug">{displayName}</div>
                          <div className="text-xs text-gray-500 leading-snug mt-0.5">{posName}{deptName}</div>
                        </div>
                      </Option>
                    );
                  })}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={11}>
              <Form.Item
                name="contactPhone"
                label="Số điện thoại liên hệ"
                rules={[{ required: true, message: "Vui lòng nhập SĐT liên hệ" }]}
              >
                <Input prefix={<PhoneOutlined className="text-gray-400" />} placeholder="Số điện thoại di động" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="vehicleType"
                label="Loại phương tiện yêu cầu"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="SCHOOL_VEHICLE">🚗 Xe của trường</Option>
                  <Option value="RIDE_HAILING">🚕 Xe công nghệ (Grab, Be, Taxi...)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="requiredSeats" label="Số chỗ yêu cầu">
                <InputNumber min={4} max={50} className="w-full" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="passengersCount" label="Số người đi cùng">
                <InputNumber min={1} max={50} className="w-full" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="purpose"
            label="Nội dung / Mục đích công tác"
            rules={[{ required: true, message: "Vui lòng nhập nội dung công tác" }]}
          >
            <Input placeholder="Ví dụ: Dự hội nghị công tác tại Sở GD&ĐT, Tiếp đón đoàn đại biểu..." />
          </Form.Item>

          {/* Quản lý lộ trình đa điểm, định vị GPS & tính khoảng cách tự động (Chỉnh sửa) */}
          <div className="mb-4">
            <RouteWaypointsEditor
              initialWaypoints={editingBooking?.waypoints}
              initialIsRoundTrip={editingBooking?.isRoundTrip !== false}
              onChange={(data) => {
                setEditWaypointsData(data);
                if (data.routeText) {
                  editForm.setFieldsValue({ route: data.routeText });
                }
              }}
            />
          </div>

          <Form.Item
            name="route"
            label="Tóm tắt lộ trình di chuyển"
            rules={[{ required: true, message: "Vui lòng nhập hoặc chọn lộ trình di chuyển" }]}
            tooltip="Hệ thống tự động cập nhật lộ trình theo các điểm dừng đã chọn ở trên. Bạn cũng có thể chỉnh sửa lại nội dung nếu cần."
          >
            <Input placeholder="Ví dụ: Trường Cao đẳng Bách khoa Nam Sài Gòn ➔ 66 Lê Thánh Tôn, Q.1 ➔ Về trường" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item
                name="dateRange"
                label="Ngày đi & Ngày về"
                rules={[{ required: true, message: "Vui lòng chọn ngày đi và ngày về" }]}
              >
                <RangePicker
                  format="DD/MM/YYYY"
                  className="w-full"
                  placeholder={["Ngày xuất phát", "Ngày về"]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="departureHour"
                label="Giờ xuất phát"
                rules={[{ required: true, message: "Vui lòng nhập giờ xuất phát" }]}
              >
                <Input
                  prefix={<ClockCircleOutlined className="text-gray-400" />}
                  placeholder="Ví dụ: 07:30 hoặc 13:30"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="passengerNames" label="Danh sách người tham gia đoàn công tác">
            <Input placeholder="Ví dụ: Thầy Minh, Cô Châu, Anh Hải (P. Đào tạo)..." />
          </Form.Item>

          <Form.Item name="notes" label="Ghi chú thêm (Hành lý, đón tại điểm hẹn...)">
            <TextArea rows={2} placeholder="Nhập các yêu cầu hoặc lưu ý khác nếu có" />
          </Form.Item>

          {/* Dành cho Quản trị viên / Quản lý xe điều chỉnh lại Xe & Tài xế */}
          {isAdminOrManager && editingBooking?.approvalStatus === "APPROVED" && (
            <div className="bg-blue-50/70 p-3 rounded-lg border border-blue-200/80 mb-3 space-y-2">
              <div className="text-xs font-bold text-blue-900 flex items-center gap-1">
                <CarOutlined className="text-blue-600" /> Điều chỉnh Phân bổ Xe & Tài xế (Quyền Quản trị viên):
              </div>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="assignedVehicle" label="Phương tiện trường" className="mb-0">
                    <Select placeholder="Chọn xe trường" allowClear showSearch optionFilterProp="children">
                      {vehicles.map((v) => (
                        <Option key={v._id} value={v._id}>
                          {v.name} ({v.licensePlate}) - {v.seats} chỗ
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="assignedDriver" label="Tài xế phụ trách" className="mb-0">
                    <Select placeholder="Chọn tài xế" allowClear showSearch optionFilterProp="children">
                      {drivers.map((d) => (
                        <Option key={d._id} value={d._id}>
                          {d.fullName} {d.phone ? `(${d.phone})` : ""}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <Button onClick={() => setIsEditModalOpen(false)}>Hủy bỏ</Button>
            <Button type="primary" htmlType="submit" className="bg-amber-600 hover:bg-amber-700">
              Lưu Thay Đổi
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ========================================================= */}
      {/* 2. MODAL XÉT DUYỆT CỦA BAN GIÁM HIỆU                      */}
      {/* ========================================================= */}
      <Modal
        title="Ban Giám Hiệu Phê Duyệt Đơn Đăng Ký Xe"
        open={isReviewModalOpen}
        onCancel={() => setIsReviewModalOpen(false)}
        footer={null}
        width={600}
      >
        {selectedBooking && (
          <Form form={reviewForm} layout="vertical" onFinish={handleReviewSubmit} className="mt-3">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 text-xs space-y-1">
              <div><strong>Mã đơn:</strong> {selectedBooking.bookingCode}</div>
              <div><strong>Người đăng ký:</strong> {selectedBooking.requesterName} ({selectedBooking.departmentName || "Đơn vị"})</div>
              <div><strong>Mục đích:</strong> {selectedBooking.purpose}</div>
              <div><strong>Lộ trình:</strong> {selectedBooking.route}</div>
              <div>
                <strong>Lịch trình:</strong> {formatVietnameseDayAndDate(selectedBooking.departureTime)} đến {formatVietnameseDayAndDate(selectedBooking.estimatedReturnTime)}
                {selectedBooking.departureHour && (
                  <span className="ml-2 font-mono text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                    <ClockCircleOutlined className="mr-1" />{selectedBooking.departureHour}
                  </span>
                )}
              </div>
            </div>

            <Form.Item name="action" label="Quyết định phê duyệt" rules={[{ required: true }]}>
              <Select>
                <Option value="APPROVE">✅ Phê duyệt đơn đăng ký xe</Option>
                <Option value="REJECT">❌ Từ chối duyệt</Option>
              </Select>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.action !== currentValues.action || prevValues.vehicleType !== currentValues.vehicleType
              }
            >
              {({ getFieldValue }) =>
                getFieldValue("action") === "APPROVE" ? (
                  <>
                    {/* Bổ sung cho phép BGH chuyển đổi loại phương tiện: Xe trường hoặc Xe công nghệ */}
                    <Form.Item
                      name="vehicleType"
                      label="Phương tiện được phê duyệt"
                      rules={[{ required: true, message: "Vui lòng chọn loại phương tiện" }]}
                      extra={
                        selectedBooking.vehicleType === "SCHOOL_VEHICLE"
                          ? "Người đăng ký xin đi Xe của trường. BGH có thể chuyển sang Xe công nghệ nếu trường không còn xe phù hợp."
                          : "Người đăng ký xin đi Xe công nghệ. BGH có thể phân sang Xe của trường nếu có xe sẵn sàng."
                      }
                    >
                      <Radio.Group buttonStyle="solid" className="w-full">
                        <Radio.Button value="SCHOOL_VEHICLE" className="w-1/2 text-center font-medium">
                          🚗 Xe của trường
                        </Radio.Button>
                        <Radio.Button value="RIDE_HAILING" className="w-1/2 text-center font-medium">
                          🚕 Xe công nghệ (Grab / Taxi)
                        </Radio.Button>
                      </Radio.Group>
                    </Form.Item>

                    {/* Chỉ đơn Xe trường mới cần bước phân bổ xe & tài xế */}
                    {getFieldValue("vehicleType") === "SCHOOL_VEHICLE" ? (
                      <Form.Item
                        name="assignedDispatcher"
                        label="Chỉ định người chịu trách nhiệm phân bổ xe & tài xế"
                        rules={[{ required: true, message: "Vui lòng chỉ định người chịu trách nhiệm phân bổ xe" }]}
                        extra="Ưu tiên Phòng Quản trị thiết bị & Quản lý xe; hỗ trợ gõ tên hoặc đơn vị để tìm kiếm"
                      >
                        <Select
                          placeholder="Chọn Lãnh đạo / Phụ trách phân bổ xe"
                          showSearch
                          allowClear
                          optionFilterProp="filterLabel"
                          popupMatchSelectWidth={420}
                        >
                          {dispatchAssigneeGroups.map((group) => (
                            <Select.OptGroup key={group.key} label={group.label}>
                              {group.users.map((u) => {
                                const name = u.name || u.fullName || u.userName;
                                const pos = u.position?.positionName || u.position?.name || "";
                                const dept = u.department?.departmentName || u.department?.name || "";
                                const full = `${name} - ${pos} (${dept})`;
                                return (
                                  <Option key={u._id} value={u._id} filterLabel={full}>
                                    <div className="py-1">
                                      <span className="font-semibold text-slate-800">{name}</span>
                                      <div className="text-xs text-gray-500">
                                        {pos ? `${pos} - ` : ""}{dept}
                                      </div>
                                    </div>
                                  </Option>
                                );
                              })}
                            </Select.OptGroup>
                          ))}
                        </Select>
                      </Form.Item>
                    ) : (
                      <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 mb-4 text-xs text-emerald-800 leading-relaxed">
                        🚕 <strong>Phê duyệt sử dụng Xe công nghệ:</strong> Sau khi Ban Giám Hiệu phê duyệt, đơn đăng ký sẽ hoàn tất duyệt trực tiếp để người đăng ký chủ động đặt xe và thanh toán theo quy chế tài chính hiện hành mà không cần qua khâu bố trí xe trường.
                      </div>
                    )}

                    <Form.Item name="approvalNotes" label="Ý kiến chỉ đạo của Ban Giám Hiệu">
                      <TextArea rows={2} placeholder="Nhập ý kiến chỉ đạo hoặc yêu cầu cụ thể nếu có..." />
                    </Form.Item>
                  </>
                ) : (
                  <Form.Item
                    name="rejectionReason"
                    label="Lý do từ chối"
                    rules={[{ required: true, message: "Vui lòng nhập lý do từ chối" }]}
                  >
                    <TextArea rows={3} placeholder="Nhập lý do không phê duyệt để phản hồi cho người đăng ký..." />
                  </Form.Item>
                )
              }
            </Form.Item>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <Button onClick={() => setIsReviewModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" className="bg-emerald-600 hover:bg-emerald-700">
                Xác Nhận Quyết Định
              </Button>
            </div>
          </Form>
        )}
      </Modal>

      {/* ========================================================= */}
      {/* 3. MODAL PHÂN BỔ PHƯƠNG TIỆN & TÀI XẾ (QUẢN LÝ XE)       */}
      {/* ========================================================= */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <CarOutlined className="text-indigo-600 text-lg" />
            <span className="font-bold text-slate-800">Điều Phối Xe & Phân Bổ Tài Xế</span>
          </div>
        }
        open={isDispatchModalOpen}
        onCancel={() => setIsDispatchModalOpen(false)}
        footer={null}
        width={700}
      >
        {selectedBooking && (
          <Form form={dispatchForm} layout="vertical" onFinish={handleDispatchSubmit} className="mt-3">
            <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-200 mb-4 text-xs space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <div>
                  <span className="text-gray-500">Mã đơn: </span>
                  <strong className="text-blue-700 font-mono text-sm">{selectedBooking.bookingCode}</strong>
                </div>
                <Tag color={selectedBooking.vehicleType === "SCHOOL_VEHICLE" ? "blue" : "purple"}>
                  {selectedBooking.vehicleType === "SCHOOL_VEHICLE" ? "Xe trường" : "Xe công nghệ"} ({selectedBooking.requiredSeats || 7} chỗ)
                </Tag>
              </div>
              <div><strong>Nội dung:</strong> {selectedBooking.purpose}</div>
              <div><strong>Lộ trình:</strong> {selectedBooking.route}</div>
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-blue-200/60">
                <div>
                  <strong>Thời gian:</strong> {formatVietnameseDayAndDate(selectedBooking.departureTime)} đến {formatVietnameseDayAndDate(selectedBooking.estimatedReturnTime)}
                  <span className="ml-2 font-mono text-cyan-800 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                    <ClockCircleOutlined className="mr-1" />{selectedBooking.departureHour || "07:30"}
                  </span>
                </div>
                {isCheckingConflicts ? (
                  <Tag color="processing">Đang kiểm tra lịch tài xế & xe...</Tag>
                ) : (dispatchConflicts.busyDrivers.length > 0 || dispatchConflicts.busyVehicles.length > 0) ? (
                  <Tag color="warning" icon={<WarningOutlined />}>
                    Phát hiện {dispatchConflicts.busyDrivers.length} TX / {dispatchConflicts.busyVehicles.length} xe bận
                  </Tag>
                ) : (
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    Tất cả tài xế và xe đều sẵn sàng
                  </Tag>
                )}
              </div>
            </div>

            {selectedBooking.vehicleType === "SCHOOL_VEHICLE" ? (
              <>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="assignedVehicle"
                      label={<span className="font-semibold text-slate-700">Chọn Xe Trường</span>}
                      rules={[{ required: true, message: "Vui lòng chọn xe trường" }]}
                    >
                      <Select
                        placeholder="Chọn xe của trường"
                        allowClear
                        onChange={(val) => setSelectedVehicleId(val)}
                      >
                        {vehicles.map((v) => {
                          const busyV = dispatchConflicts?.busyVehicles?.find(
                            (b) => String(b.vehicleId) === String(v._id) || (b.licensePlate && b.licensePlate === v.licensePlate)
                          );
                          return (
                            <Option key={v._id} value={v._id}>
                              <div className="flex items-center justify-between gap-1">
                                <span className={busyV ? "text-amber-800 font-semibold" : ""}>
                                  {busyV ? "⚠️ " : ""}{v.name} - {v.licensePlate} ({v.seats} chỗ)
                                </span>
                                {busyV ? (
                                  <Tag color="error" className="text-[10px] m-0 font-mono">
                                    Bận [{busyV.bookingCode}]
                                  </Tag>
                                ) : (
                                  <Tag color="success" className="text-[10px] m-0">Sẵn sàng</Tag>
                                )}
                              </div>
                            </Option>
                          );
                        })}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="assignedDriver"
                      label={<span className="font-semibold text-slate-700">Chọn Tài Xế Phụ Trách</span>}
                      rules={[{ required: true, message: "Vui lòng chọn tài xế" }]}
                    >
                      <Select
                        placeholder="Chọn tài xế"
                        allowClear
                        onChange={(val) => setSelectedDriverId(val)}
                      >
                        {drivers.map((d) => {
                          const busyD = dispatchConflicts?.busyDrivers?.find(
                            (b) => String(b.driverId) === String(d._id) || (b.phone && b.phone === d.phone)
                          );
                          return (
                            <Option key={d._id} value={d._id}>
                              <div className="flex items-center justify-between gap-1">
                                <span className={busyD ? "text-amber-800 font-semibold" : ""}>
                                  {busyD ? "⚠️ " : ""}{d.fullName} ({d.phone})
                                </span>
                                {busyD ? (
                                  <Tag color="error" className="text-[10px] m-0 font-mono">
                                    Đã có lịch [{busyD.bookingCode}]
                                  </Tag>
                                ) : (
                                  <Tag color="success" className="text-[10px] m-0">Sẵn sàng</Tag>
                                )}
                              </div>
                            </Option>
                          );
                        })}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                {/* Cảnh báo chi tiết nếu tài xế được chọn bị trùng lịch */}
                {selectedDriverConflict && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<WarningOutlined className="text-amber-600" />}
                    className="mb-3 border-amber-300 bg-amber-50 rounded-lg shadow-2xs"
                    message={
                      <div className="text-xs">
                        <strong className="text-amber-900 text-sm">⚠️ CẢNH BÁO: TÀI XẾ ĐÃ ĐƯỢC PHÂN CÔNG CHUYẾN KHÁC!</strong>
                        <div className="mt-1 text-slate-800 space-y-0.5">
                          <div>
                            Tài xế <strong>{selectedDriverConflict.driverName}</strong> ({selectedDriverConflict.phone}) đã được phân công cho chuyến xe{" "}
                            <strong className="text-blue-700 font-mono">[{selectedDriverConflict.bookingCode}]</strong>:{" "}
                            <em>"{selectedDriverConflict.purpose}"</em>.
                          </div>
                          <div>
                            ⏰ Thời gian chuyến trước: <strong>{dayjs(selectedDriverConflict.departureTime).format("DD/MM/YYYY")}</strong> đến{" "}
                            <strong>{dayjs(selectedDriverConflict.estimatedReturnTime).format("DD/MM/YYYY")}</strong> (Xuất phát: {selectedDriverConflict.departureHour || "07:30"}).
                          </div>
                          <div className="text-amber-900 font-semibold pt-1">
                            👉 Đề xuất: Hãy chọn tài xế khác có nhãn [Sẵn sàng] để không bị trùng lịch công tác!
                          </div>
                        </div>
                      </div>
                    }
                  />
                )}

                {/* Cảnh báo chi tiết nếu xe trường được chọn bị trùng lịch */}
                {selectedVehicleConflict && (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<WarningOutlined className="text-amber-600" />}
                    className="mb-3 border-amber-300 bg-amber-50 rounded-lg shadow-2xs"
                    message={
                      <div className="text-xs">
                        <strong className="text-amber-900 text-sm">⚠️ CẢNH BÁO: XE TRƯỜNG ĐÃ ĐƯỢC XẾP LỊCH TRÙNG!</strong>
                        <div className="mt-1 text-slate-800 space-y-0.5">
                          <div>
                            Xe <strong>{selectedVehicleConflict.vehicleName} ({selectedVehicleConflict.licensePlate})</strong> đã được bố trí cho chuyến{" "}
                            <strong className="text-blue-700 font-mono">[{selectedVehicleConflict.bookingCode}]</strong>:{" "}
                            <em>"{selectedVehicleConflict.purpose}"</em>.
                          </div>
                          <div>
                            ⏰ Thời gian chuyến đó: <strong>{dayjs(selectedVehicleConflict.departureTime).format("DD/MM/YYYY")}</strong> đến{" "}
                            <strong>{dayjs(selectedVehicleConflict.estimatedReturnTime).format("DD/MM/YYYY")}</strong>.
                          </div>
                        </div>
                      </div>
                    }
                  />
                )}

                {/* Tùy chọn xác nhận ghi đè nếu bắt buộc phân công */}
                {(selectedDriverConflict || selectedVehicleConflict) && (
                  <div className="p-3 bg-amber-50/90 rounded-lg border border-amber-300 mb-3.5">
                    <Checkbox
                      checked={forceDispatch}
                      onChange={(e) => setForceDispatch(e.target.checked)}
                      className="text-xs font-semibold text-amber-950"
                    >
                      Xác nhận vẫn phân công dù có cảnh báo trùng lịch (Trường hợp đặc biệt / tài xế chạy nối chuyến)
                    </Checkbox>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 mb-4 text-xs">
                <div><strong>Lưu ý:</strong> Đơn này sử dụng <strong>Xe công nghệ</strong>. Đơn vị quản lý xác nhận duyệt phương thức di chuyển hoặc cấp mã đặt chuyến nếu có.</div>
              </div>
            )}

            <Form.Item name="dispatchNotes" label={<span className="font-semibold text-slate-700">Ghi chú điều phối (Điểm đón cụ thể, giờ tập trung...)</span>}>
              <TextArea rows={2} placeholder="Nhập ghi chú cho tài xế và người đăng ký..." />
            </Form.Item>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <Button onClick={() => setIsDispatchModalOpen(false)}>Hủy</Button>
              <Button
                type="primary"
                htmlType="submit"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={(selectedDriverConflict || selectedVehicleConflict) && !forceDispatch}
              >
                Xác Nhận Điều Xe
              </Button>
            </div>
          </Form>
        )}
      </Modal>

      {/* ========================================================= */}
      {/* 4. MODAL XEM CHI TIẾT & IN PHIẾU ĐIỀU XE                 */}
      {/* ========================================================= */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <CarOutlined className="text-blue-600 text-lg" />
            <span className="font-bold text-slate-800 text-base">Thông Tin Chi Tiết Phiếu Điều Xe</span>
          </div>
        }
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsDetailModalOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrintBooking}
            className="bg-blue-600"
          >
            In Phiếu
          </Button>,
        ]}
        width={850}
      >
        {selectedBooking && (
          <div className="py-1 text-slate-800 space-y-4">
            {/* Header mã phiếu & trạng thái */}
            <div className="flex flex-wrap justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wide">Mã Phiếu Đăng Ký</span>
                <div className="font-bold text-lg text-blue-700">{selectedBooking.bookingCode}</div>
              </div>
              <div className="flex items-center gap-2 mt-2 sm:mt-0">
                {renderApprovalTag(selectedBooking.approvalStatus)}
                {renderDispatchTag(selectedBooking.dispatchStatus, selectedBooking.vehicleType)}
              </div>
            </div>

            {/* Khối 1: Thông tin người đăng ký */}
            <Card size="small" title={<span className="text-xs font-bold uppercase text-slate-600">1. Thông tin người đăng ký</span>} className="border-gray-200">
              <Row gutter={[16, 12]}>
                <Col xs={24} sm={8}>
                  <div className="text-xs text-gray-500">Họ và tên người đăng ký</div>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedBooking.requesterName ||
                      selectedBooking.requester?.name ||
                      selectedBooking.requester?.fullName ||
                      "--"}
                  </div>
                </Col>
                <Col xs={24} sm={8}>
                  <div className="text-xs text-gray-500">Số điện thoại liên hệ</div>
                  <div className="font-mono text-blue-700 font-semibold mt-0.5">
                    {selectedBooking.contactPhone ||
                      selectedBooking.requester?.mobile ||
                      selectedBooking.requester?.phone ||
                      "--"}
                  </div>
                </Col>
                <Col xs={24} sm={8}>
                  <div className="text-xs text-gray-500">Đơn vị / Phòng ban</div>
                  <div className="font-medium text-slate-700 mt-0.5">
                    {selectedBooking.departmentName ||
                      selectedBooking.department?.departmentName ||
                      selectedBooking.department?.name ||
                      "--"}
                  </div>
                </Col>
              </Row>
            </Card>

            {/* Khối 2: Lịch trình & Chuyến đi */}
            <Card size="small" title={<span className="text-xs font-bold uppercase text-slate-600">2. Chi tiết chuyến đi & Lộ trình</span>} className="border-gray-200">
              <Row gutter={[16, 12]}>
                <Col xs={24} sm={16}>
                  <div className="text-xs text-gray-500">Nội dung / Mục đích công tác</div>
                  <div className="font-semibold text-slate-900 mt-0.5">{selectedBooking.purpose}</div>
                </Col>
                <Col xs={24} sm={8}>
                  <div className="text-xs text-gray-500">Phương tiện yêu cầu</div>
                  <div className="mt-0.5">
                    <Tag color={selectedBooking.vehicleType === "SCHOOL_VEHICLE" ? "blue" : "purple"} className="text-xs">
                      {selectedBooking.vehicleType === "SCHOOL_VEHICLE" ? "Xe trường" : "Xe công nghệ"}
                    </Tag>
                    <span className="text-xs text-gray-600">({selectedBooking.requiredSeats || 7} chỗ)</span>
                  </div>
                </Col>

                <Col xs={24}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs text-gray-500">Lộ trình di chuyển & Điểm đến</div>
                    {selectedBooking.totalDistanceKm > 0 && (
                      <Tag color="blue" className="text-xs font-mono font-bold">
                        ⚡ Tổng cự ly: {selectedBooking.totalDistanceKm} km {selectedBooking.isRoundTrip ? "(Khứ hồi)" : "(Một chiều)"}
                      </Tag>
                    )}
                  </div>
                  <div className="text-slate-800 font-medium bg-gray-50 p-2.5 rounded border border-gray-100 space-y-2">
                    <div>{selectedBooking.route}</div>

                    {/* Hiển thị chi tiết từng điểm dừng nếu có waypoints */}
                    {Array.isArray(selectedBooking.waypoints) && selectedBooking.waypoints.length > 0 && (
                      <div className="pt-2 border-t border-gray-200 text-xs space-y-1">
                        <div className="font-semibold text-slate-700 mb-1">Các điểm dừng trên lộ trình:</div>
                        {selectedBooking.waypoints.map((wp, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-slate-600">
                            <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="font-medium text-slate-800">{wp.name || wp.address}</span>
                            {wp.address && wp.name && wp.address !== wp.name && (
                              <span className="text-gray-400 text-[11px] truncate">({wp.address})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Nút mở chỉ đường Google Maps */}
                    {Array.isArray(selectedBooking.waypoints) && selectedBooking.waypoints.length > 0 && (
                      <div className="pt-2 border-t border-gray-200 flex justify-end">
                        <a
                          href={buildGoogleMapsDirectionUrl(selectedBooking.waypoints, selectedBooking.isRoundTrip)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-white px-2.5 py-1 rounded border border-blue-200 shadow-2xs"
                        >
                          <GlobalOutlined /> Xem & Dẫn đường trên Google Maps
                        </a>
                      </div>
                    )}
                  </div>
                </Col>

                <Col xs={24} sm={8}>
                  <div className="text-xs text-gray-500">Ngày xuất phát</div>
                  <div className="text-blue-700 font-semibold mt-0.5">
                    {formatVietnameseDayAndDate(selectedBooking.departureTime)}
                  </div>
                </Col>
                <Col xs={24} sm={8}>
                  <div className="text-xs text-gray-500">Giờ xuất phát</div>
                  <div className="text-cyan-700 font-bold mt-0.5 font-mono">
                    <ClockCircleOutlined className="mr-1" />
                    {selectedBooking.departureHour || (selectedBooking.departureTime && !dayjs(selectedBooking.departureTime).isSame(dayjs(selectedBooking.departureTime).startOf('day')) ? dayjs(selectedBooking.departureTime).format("HH:mm") : "--")}
                  </div>
                </Col>
                <Col xs={24} sm={8}>
                  <div className="text-xs text-gray-500">Ngày về (dự kiến)</div>
                  <div className="text-slate-800 font-medium mt-0.5">
                    {formatVietnameseDayAndDate(selectedBooking.estimatedReturnTime)}
                  </div>
                </Col>

                <Col xs={24} sm={8}>
                  <div className="text-xs text-gray-500">Số lượng người tham gia</div>
                  <div className="font-semibold text-slate-800 mt-0.5">{selectedBooking.passengersCount} người</div>
                </Col>
                <Col xs={24} sm={16}>
                  <div className="text-xs text-gray-500">Danh sách người đi cùng</div>
                  <div className="text-slate-700 mt-0.5">{selectedBooking.passengerNames || "Không có danh sách cụ thể"}</div>
                </Col>

                {selectedBooking.notes && (
                  <Col xs={24}>
                    <div className="text-xs text-gray-500">Ghi chú từ người đăng ký</div>
                    <div className="text-gray-600 italic mt-0.5">{selectedBooking.notes}</div>
                  </Col>
                )}
              </Row>
            </Card>

            {/* Khối 3: Phê duyệt của Ban Giám Hiệu & Phân công */}
            <Card size="small" title={<span className="text-xs font-bold uppercase text-slate-600">3. Phê duyệt của Ban Giám Hiệu & Phân công</span>} className="border-gray-200">
              <Row gutter={[16, 12]}>
                <Col xs={24} sm={8}>
                  <div className="text-xs text-gray-500">Lãnh đạo phê duyệt</div>
                  <div className="mt-0.5">
                    {(() => {
                      const approverObj = selectedBooking.approvedBy || selectedBooking.targetApprover;
                      const approverName =
                        selectedBooking.approvedByName ||
                        approverObj?.name ||
                        approverObj?.fullName ||
                        approverObj?.userName;
                      const approverPos =
                        approverObj?.position?.positionName ||
                        approverObj?.position?.name ||
                        (typeof approverObj?.position === "string" ? approverObj.position : "");

                      return approverName ? (
                        <div>
                          <span className="font-semibold text-slate-800">{approverName}</span>
                          {approverPos && <span className="text-xs text-gray-500 ml-1">({approverPos})</span>}
                        </div>
                      ) : (
                        <span className="text-gray-400">Chưa xét duyệt</span>
                      );
                    })()}
                  </div>
                </Col>

                <Col xs={24} sm={8}>
                  <div className="text-xs text-gray-500">Thời gian phê duyệt</div>
                  <div className="font-medium text-slate-700 mt-0.5">
                    {selectedBooking.approvedAt ? dayjs(selectedBooking.approvedAt).format("HH:mm - DD/MM/YYYY") : "--"}
                  </div>
                </Col>

                <Col xs={24} sm={8}>
                  <div className="text-xs text-gray-500">Lãnh đạo được giao phân bổ xe</div>
                  <div className="mt-0.5">
                    {selectedBooking.assignedDispatcher ? (
                      <div>
                        <span className="font-semibold text-indigo-700">
                          {selectedBooking.assignedDispatcher.name ||
                            selectedBooking.assignedDispatcher.fullName ||
                            selectedBooking.assignedDispatcher.userName}
                        </span>
                        {(selectedBooking.assignedDispatcher.position?.positionName ||
                          selectedBooking.assignedDispatcher.department?.departmentName) && (
                          <span className="text-xs text-gray-500 ml-1">
                            ({selectedBooking.assignedDispatcher.position?.positionName || ""}{" "}
                            {selectedBooking.assignedDispatcher.department?.departmentName || ""})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">Chưa chỉ định</span>
                    )}
                  </div>
                </Col>

                {selectedBooking.approvalNotes && (
                  <Col xs={24}>
                    <div className="text-xs text-gray-500">Ý kiến chỉ đạo của BGH</div>
                    <div className="text-indigo-800 bg-indigo-50 p-2.5 rounded-lg border border-indigo-100 mt-0.5 text-xs font-medium">
                      💬 {selectedBooking.approvalNotes}
                    </div>
                  </Col>
                )}

                {selectedBooking.rejectionReason && (
                  <Col xs={24}>
                    <div className="text-xs text-gray-500">Lý do không duyệt</div>
                    <div className="text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-100 mt-0.5 font-medium text-xs">
                      ❌ {selectedBooking.rejectionReason}
                    </div>
                  </Col>
                )}
              </Row>
            </Card>

            {/* Khối 4: Kết quả điều phối phương tiện & Tài xế */}
            <Card size="small" title={<span className="text-xs font-bold uppercase text-slate-600">4. Phương tiện & Kết quả phân công</span>} className="border-emerald-200 bg-emerald-50/20">
              {selectedBooking.assignedVehicle || selectedBooking.assignedDriver ? (
                <Row gutter={[16, 12]}>
                  <Col xs={24} sm={12}>
                    <div className="text-xs text-gray-500">Phương tiện được bố trí</div>
                    <div className="font-bold text-blue-700 mt-0.5 text-sm flex items-center gap-1.5">
                      <CarOutlined className="text-blue-600" />
                      <span>{selectedBooking.assignedVehicle?.name || "Xe trường"}</span>
                      {selectedBooking.assignedVehicle?.licensePlate && (
                        <Tag color="cyan" className="font-mono font-bold text-xs">
                          {selectedBooking.assignedVehicle.licensePlate}
                        </Tag>
                      )}
                    </div>
                  </Col>

                  <Col xs={24} sm={12}>
                    <div className="text-xs text-gray-500">Tài xế phụ trách</div>
                    <div className="font-bold text-emerald-800 mt-0.5 text-sm flex items-center gap-1.5">
                      <UserOutlined className="text-emerald-600" />
                      <span>{selectedBooking.assignedDriver?.fullName || selectedBooking.assignedDriverName || "Chưa có"}</span>
                      {(selectedBooking.assignedDriver?.phone || selectedBooking.assignedDriverPhone) && (
                        <span className="font-mono text-blue-600 text-xs font-normal">
                          ({selectedBooking.assignedDriver?.phone || selectedBooking.assignedDriverPhone})
                        </span>
                      )}
                    </div>
                  </Col>

                  {selectedBooking.actualDepartureTime && (
                    <Col xs={24} sm={12}>
                      <div className="text-xs text-gray-500">Thời gian thực tế bắt đầu đi</div>
                      <div className="font-bold text-blue-800 mt-0.5 flex items-center gap-1.5 text-xs">
                        <ClockCircleOutlined className="text-blue-600" />
                        <span>{dayjs(selectedBooking.actualDepartureTime).format("HH:mm - DD/MM/YYYY")}</span>
                        {selectedBooking.departureConfirmedBy && (
                          <span className="text-[11px] font-normal text-gray-500">
                            (Xác nhận: {selectedBooking.departureConfirmedBy.fullName || selectedBooking.departureConfirmedBy.name || selectedBooking.departureConfirmedBy.userName})
                          </span>
                        )}
                      </div>
                    </Col>
                  )}

                  {selectedBooking.actualReturnTime && (
                    <Col xs={24} sm={12}>
                      <div className="text-xs text-gray-500">Thời gian thực tế chuyến xe về đến</div>
                      <div className="font-bold text-emerald-800 mt-0.5 flex items-center gap-1.5 text-xs">
                        <CheckCircleOutlined className="text-emerald-600" />
                        <span>{dayjs(selectedBooking.actualReturnTime).format("HH:mm - DD/MM/YYYY")}</span>
                        {selectedBooking.returnConfirmedBy && (
                          <span className="text-[11px] font-normal text-gray-500">
                            (Xác nhận: {selectedBooking.returnConfirmedBy.fullName || selectedBooking.returnConfirmedBy.name || selectedBooking.returnConfirmedBy.userName})
                          </span>
                        )}
                      </div>
                    </Col>
                  )}

                  {selectedBooking.dispatchNotes && (
                    <Col xs={24}>
                      <div className="text-xs text-gray-500">Ghi chú điều phối xe</div>
                      <div className="text-gray-700 italic mt-0.5 bg-white p-2 rounded border border-gray-200 text-xs">
                        {selectedBooking.dispatchNotes}
                      </div>
                    </Col>
                  )}
                </Row>
              ) : selectedBooking.vehicleType === "SCHOOL_VEHICLE" && selectedBooking.approvalStatus === "APPROVED" ? (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <ClockCircleOutlined className="text-amber-600 text-base shrink-0" />
                  <div>
                    <strong>Chờ phân bổ phương tiện & tài xế:</strong> Chuyến đi đã được Ban Giám Hiệu phê duyệt. Phòng Quản trị thiết bị / cán bộ phụ trách sẽ điều phối xe trường và tài xế trước giờ xuất phát.
                  </div>
                </div>
              ) : selectedBooking.vehicleType !== "SCHOOL_VEHICLE" ? (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-purple-900 text-xs">
                  <strong>Phương tiện:</strong> Chuyến đi được duyệt sử dụng Xe công nghệ (đơn vị chủ động đặt chuyến hoặc thanh toán công tác phí theo quy định).
                </div>
              ) : (
                <div className="text-xs text-gray-400 italic">
                  Chưa có thông tin phân công phương tiện (chờ Ban Giám Hiệu phê duyệt đơn).
                </div>
              )}
            </Card>

            {/* Mẫu Phiếu In Chuẩn Hành Chính (ẩn trên màn hình xem, xuất ra khi bấm In Phiếu) */}
            <div style={{ display: "none" }}>
              <div ref={printRef}>
                {/* 1. Header Quốc hiệu & Tên Trường */}
                <table className="header-table">
                  <tbody>
                    <tr>
                      <td style={{ width: "45%" }}>
                        <div className="org-title">
                          ỦY BAN NHÂN DÂN<br />THÀNH PHỐ HỒ CHÍ MINH
                        </div>
                        <div className="school-title">TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN</div>
                        <div className="line-decor"></div>
                        <div className="doc-number">Số: {selectedBooking.bookingCode}</div>
                      </td>
                      <td style={{ width: "55%" }}>
                        <div className="national-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                        <div className="motto">Độc lập - Tự do - Hạnh phúc</div>
                        <div className="line-decor"></div>
                        <div className="doc-number">
                          TP. Hồ Chí Minh, ngày {dayjs(selectedBooking.createdAt).format("DD")} tháng{" "}
                          {dayjs(selectedBooking.createdAt).format("MM")} năm {dayjs(selectedBooking.createdAt).format("YYYY")}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* 2. Tiêu đề Phiếu */}
                <div className="main-title">PHIẾU ĐĂNG KÝ SỬ DỤNG XE Ô TÔ CÔNG TÁC</div>
                <div className="sub-title-date">
                  (Kèm theo Quy chế quản lý và sử dụng phương tiện công tác của Nhà trường)
                </div>

                {/* 3. Phần I: Thông tin người và đơn vị đề nghị */}
                <div className="section-title">I. THÔNG TIN NGƯỜI ĐĂNG KÝ VÀ ĐƠN VỊ ĐỀ NGHỊ</div>
                <ul className="info-list">
                  <li className="info-row">
                    <span className="info-label">1. Họ và tên người đăng ký:</span>{" "}
                    {selectedBooking.requesterName ||
                      selectedBooking.requester?.fullName ||
                      selectedBooking.requester?.name ||
                      selectedBooking.requester?.userName ||
                      "...................................................................."}
                  </li>
                  <li className="info-row">
                    <span className="info-label">2. Đơn vị / Phòng ban:</span>{" "}
                    {selectedBooking.departmentName ||
                      selectedBooking.department?.departmentName ||
                      selectedBooking.department?.name ||
                      "...................................................................."}
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    <span className="info-label">Số điện thoại liên hệ:</span>{" "}
                    {selectedBooking.contactPhone ||
                      selectedBooking.requester?.mobile ||
                      selectedBooking.requester?.phone ||
                      "......................."}
                  </li>
                  <li className="info-row">
                    <span className="info-label">3. Số lượng người tham gia:</span>{" "}
                    <strong>{selectedBooking.passengersCount || 1}</strong> người.
                  </li>
                  <li className="info-row">
                    <span className="info-label">4. Danh sách người cùng đi:</span>{" "}
                    {selectedBooking.passengerNames || "(Không có)"}
                  </li>
                </ul>

                {/* 4. Phần II: Mục đích, lộ trình và thời gian */}
                <div className="section-title">II. MỤC ĐÍCH, LỘ TRÌNH VÀ THỜI GIAN CÔNG TÁC</div>
                <ul className="info-list">
                  <li className="info-row">
                    <span className="info-label">1. Nội dung / Mục đích công tác:</span>{" "}
                    {selectedBooking.purpose}
                  </li>
                  <li className="info-row">
                    <span className="info-label">2. Lộ trình di chuyển (nơi đi - nơi đến):</span>{" "}
                    {selectedBooking.route}
                    {selectedBooking.totalDistanceKm > 0 && (
                      <span style={{ fontWeight: 600, color: "#1e40af", marginLeft: "6px" }}>
                        (Tổng cự ly dự kiến: ~{selectedBooking.totalDistanceKm} km{selectedBooking.isRoundTrip ? " khứ hồi" : ""})
                      </span>
                    )}
                  </li>
                  <li className="info-row">
                    <span className="info-label">3. Thời gian xuất phát:</span>{" "}
                    {selectedBooking.departureHour ? `${selectedBooking.departureHour}, ` : ""}
                    {formatVietnameseDayAndDate(selectedBooking.departureTime || selectedBooking.departureDate)}
                  </li>
                  <li className="info-row">
                    <span className="info-label">4. Thời gian về dự kiến:</span>{" "}
                    {formatVietnameseDayAndDate(selectedBooking.estimatedReturnTime || selectedBooking.returnDate)}
                  </li>
                  <li className="info-row">
                    <span className="info-label">5. Hình thức phương tiện đề nghị:</span>{" "}
                    {selectedBooking.vehicleType === "SCHOOL_VEHICLE"
                      ? `Xe cơ quan Nhà trường (${selectedBooking.requiredSeats || 7} chỗ)`
                      : `Xe công nghệ / Hợp đồng ngoài (${selectedBooking.requiredSeats || 7} chỗ)`}
                  </li>
                  {selectedBooking.notes && (
                    <li className="info-row">
                      <span className="info-label">6. Ghi chú yêu cầu thêm:</span> {selectedBooking.notes}
                    </li>
                  )}
                </ul>

                {/* 5. Phần III: Ý kiến phê duyệt của Ban Giám Hiệu */}
                <div className="section-title">III. Ý KIẾN PHÊ DUYỆT CỦA BAN GIÁM HIỆU</div>
                <ul className="info-list">
                  <li className="info-row">
                    <span className="info-label">1. Kết quả phê duyệt:</span>{" "}
                    <strong>
                      {selectedBooking.approvalStatus === "APPROVED"
                        ? "ĐỒNG Ý DUYỆT ĐI CÔNG TÁC"
                        : selectedBooking.approvalStatus === "REJECTED"
                        ? "TỪ CHỐI DUYỆT"
                        : "ĐANG CHỜ BAN GIÁM HIỆU XÉT DUYỆT"}
                    </strong>
                  </li>
                  <li className="info-row">
                    <span className="info-label">2. Người phê duyệt (BGH):</span>{" "}
                    {(() => {
                      const approverObj = selectedBooking.approvedBy;
                      if (!approverObj) return "....................................................................";
                      const name = approverObj.name || approverObj.fullName || approverObj.userName;
                      const pos =
                        approverObj.position?.positionName ||
                        approverObj.position?.name ||
                        (typeof approverObj.position === "string" ? approverObj.position : "");
                      return `${name} ${pos ? `(${pos})` : ""}`;
                    })()}
                  </li>
                  <li className="info-row">
                    <span className="info-label">3. Giao lãnh đạo/phụ trách phân bổ xe:</span>{" "}
                    {selectedBooking.assignedDispatcher ? (
                      `${selectedBooking.assignedDispatcher.name || selectedBooking.assignedDispatcher.fullName || selectedBooking.assignedDispatcher.userName}`
                    ) : (
                      "...................................................................."
                    )}
                  </li>
                  {selectedBooking.approvalNotes && (
                    <li className="info-row">
                      <span className="info-label">4. Ý kiến chỉ đạo của BGH:</span>{" "}
                      {selectedBooking.approvalNotes}
                    </li>
                  )}
                  {selectedBooking.rejectionReason && (
                    <li className="info-row">
                      <span className="info-label">4. Lý do từ chối:</span>{" "}
                      {selectedBooking.rejectionReason}
                    </li>
                  )}
                </ul>

                {/* 6. Phần IV: Kết quả điều phối phương tiện & tài xế */}
                <div className="section-title">IV. KẾT QUẢ ĐIỀU ĐỘNG PHƯƠNG TIỆN VÀ LÁI XE</div>
                <table className="bordered-table">
                  <thead>
                    <tr>
                      <th style={{ width: "35%" }}>Phương tiện được bố trí</th>
                      <th style={{ width: "35%" }}>Lái xe phụ trách</th>
                      <th style={{ width: "30%" }}>Ghi chú điều phối</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        {selectedBooking.assignedVehicle ? (
                          <>
                            <strong>{selectedBooking.assignedVehicle.name}</strong>
                            <div>Biển số: {selectedBooking.assignedVehicle.licensePlate}</div>
                          </>
                        ) : selectedBooking.vehicleType === "RIDE_HAILING" ? (
                          "Xe công nghệ (Đơn vị tự túc)"
                        ) : (
                          "Chưa điều xe"
                        )}
                      </td>
                      <td>
                        {selectedBooking.assignedDriver ? (
                          <>
                            <strong>{selectedBooking.assignedDriver.fullName}</strong>
                            <div>SĐT: {selectedBooking.assignedDriver.phone}</div>
                          </>
                        ) : (
                          "...................................."
                        )}
                      </td>
                      <td>{selectedBooking.dispatchNotes || "(Không có)"}</td>
                    </tr>
                  </tbody>
                </table>

                {/* 7. Phần chữ ký xác nhận các bên */}
                <table className="signature-table">
                  <tbody>
                    <tr>
                      <td style={{ verticalAlign: "top" }}>
                        <div className="sign-role">NGƯỜI ĐĂNG KÝ XE</div>
                        <div className="sign-note">(Ký và ghi rõ họ tên)</div>
                      </td>
                      <td style={{ verticalAlign: "top" }}>
                        <div className="sign-role">LÃNH ĐẠO ĐIỀU PHỐI XE</div>
                        <div className="sign-note">(Ký và ghi rõ họ tên)</div>
                      </td>
                      <td style={{ verticalAlign: "top" }}>
                        <div className="sign-role">
                          BAN GIÁM HIỆU<br />PHÊ DUYỆT
                        </div>
                        <div className="sign-note">(Ký và ghi rõ họ tên)</div>
                      </td>
                    </tr>
                    <tr className="sign-names-row">
                      <td style={{ verticalAlign: "bottom" }}>
                        <div className="sign-space"></div>
                        <div className="sign-name">
                          {selectedBooking.requesterName ||
                            selectedBooking.requester?.fullName ||
                            selectedBooking.requester?.name ||
                            selectedBooking.requester?.userName ||
                            ""}
                        </div>
                      </td>
                      <td style={{ verticalAlign: "bottom" }}>
                        <div className="sign-space"></div>
                        <div className="sign-name">
                          {selectedBooking.assignedDispatcher?.name ||
                            selectedBooking.assignedDispatcher?.fullName ||
                            selectedBooking.assignedDispatcher?.userName ||
                            ""}
                        </div>
                      </td>
                      <td style={{ verticalAlign: "bottom" }}>
                        <div className="sign-space"></div>
                        <div className="sign-name">
                          {selectedBooking.approvedBy?.name ||
                            selectedBooking.approvedBy?.fullName ||
                            selectedBooking.approvedBy?.userName ||
                            ""}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Thêm / Chỉnh Sửa Phương Tiện */}
      <Modal
        title={editingVehicle ? "Chỉnh Sửa Phương Tiện" : "Thêm Phương Tiện Mới"}
        open={isVehicleModalOpen}
        onCancel={() => {
          setIsVehicleModalOpen(false);
          setEditingVehicle(null);
        }}
        footer={null}
      >
        <Form
          form={vehicleForm}
          layout="vertical"
          onFinish={async (val) => {
            try {
              if (editingVehicle) {
                const res = await updateVehicle(editingVehicle._id, val);
                if (res.data?.success) {
                  message.success("Cập nhật thông tin xe thành công");
                  setIsVehicleModalOpen(false);
                  setEditingVehicle(null);
                  loadVehiclesAndDrivers();
                }
              } else {
                const res = await createVehicle(val);
                if (res.data?.success) {
                  message.success("Thêm xe thành công");
                  setIsVehicleModalOpen(false);
                  loadVehiclesAndDrivers();
                }
              }
            } catch (e) {
              message.error(e.response?.data?.message || (editingVehicle ? "Lỗi cập nhật xe" : "Lỗi tạo xe"));
            }
          }}
        >
          <Form.Item name="name" label="Tên phương tiện" rules={[{ required: true, message: "Vui lòng nhập tên phương tiện" }]}>
            <Input placeholder="Ví dụ: Ford Transit 16 chỗ" />
          </Form.Item>
          <Form.Item name="licensePlate" label="Biển số xe" rules={[{ required: true, message: "Vui lòng nhập biển số xe" }]}>
            <Input placeholder="Ví dụ: 51B-123.45" />
          </Form.Item>
          <Form.Item name="seats" label="Số chỗ ngồi" initialValue={7} rules={[{ required: true, message: "Vui lòng nhập số chỗ" }]}>
            <InputNumber min={2} max={60} className="w-full" />
          </Form.Item>
          {editingVehicle && (
            <Form.Item name="status" label="Trạng thái phương tiện" initialValue="AVAILABLE">
              <Select>
                <Option value="AVAILABLE">Sẵn sàng</Option>
                <Option value="IN_USE">Đang đi</Option>
                <Option value="MAINTENANCE">Bảo dưỡng</Option>
              </Select>
            </Form.Item>
          )}
          <Form.Item name="notes" label="Ghi chú">
            <Input placeholder="Tình trạng xe, bảo dưỡng..." />
          </Form.Item>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button
              onClick={() => {
                setIsVehicleModalOpen(false);
                setEditingVehicle(null);
              }}
            >
              Hủy
            </Button>
            <Button type="primary" htmlType="submit">
              {editingVehicle ? "Cập Nhật Phương Tiện" : "Lưu Phương Tiện"}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Thêm / Chỉnh Sửa Tài Xế */}
      <Modal
        title={editingDriver ? "Chỉnh Sửa Thông Tin Tài Xế" : "Thêm Tài Xế Mới"}
        open={isDriverModalOpen}
        onCancel={() => {
          setIsDriverModalOpen(false);
          setEditingDriver(null);
        }}
        footer={null}
      >
        <Form
          form={driverForm}
          layout="vertical"
          onFinish={async (val) => {
            try {
              if (editingDriver) {
                const res = await updateDriver(editingDriver._id, val);
                if (res.data?.success) {
                  message.success("Cập nhật thông tin tài xế thành công");
                  setIsDriverModalOpen(false);
                  setEditingDriver(null);
                  loadVehiclesAndDrivers();
                }
              } else {
                const res = await createDriver(val);
                if (res.data?.success) {
                  message.success("Thêm tài xế thành công");
                  setIsDriverModalOpen(false);
                  loadVehiclesAndDrivers();
                }
              }
            } catch (e) {
              message.error(e.response?.data?.message || (editingDriver ? "Lỗi cập nhật tài xế" : "Lỗi tạo tài xế"));
            }
          }}
        >
          <Form.Item
            name="userAccount"
            label="Chọn tài khoản nhân sự làm tài xế"
            rules={[{ required: true, message: "Vui lòng chọn nhân sự làm tài xế để đảm bảo đầy đủ thông tin và phân quyền" }]}
            extra="Tìm kiếm theo tên, phòng ban hoặc số điện thoại. Hệ thống sẽ tự động liên kết tài khoản để tài xế có thể nhận lịch và xác nhận chuyến đi"
          >
            <Select
              placeholder="Chọn hoặc tìm kiếm nhân sự..."
              showSearch
              allowClear
              optionFilterProp="filterLabel"
              popupMatchSelectWidth={420}
              onChange={(userId) => {
                const u = allUsers.find((x) => x._id === userId);
                if (u) {
                  const name = u.fullName || u.userName || u.name || "";
                  const phone = u.phone || u.mobile || "";
                  driverForm.setFieldsValue({
                    fullName: name,
                    phone: phone || driverForm.getFieldValue("phone") || "",
                  });
                }
              }}
            >
              {leaderGroups.map((group) => (
                <Select.OptGroup key={group.key} label={group.label}>
                  {group.users.map((u) => {
                    const name = u.fullName || u.userName || u.name;
                    const pos = u.position?.positionName || u.position?.name || "";
                    const dept = u.department?.departmentName || u.department?.name || "";
                    const phone = u.phone || u.mobile || "";
                    const full = `${name} - ${pos} (${dept}) ${phone}`;
                    return (
                      <Option key={u._id} value={u._id} filterLabel={full}>
                        <div className="flex justify-between items-center py-1">
                          <div>
                            <span className="font-semibold text-slate-800">{name}</span>
                            <div className="text-xs text-gray-500">
                              {pos ? `${pos} - ` : ""}{dept}
                            </div>
                          </div>
                          {phone && <span className="text-xs text-blue-600 font-mono">{phone}</span>}
                        </div>
                      </Option>
                    );
                  })}
                </Select.OptGroup>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="fullName"
            label="Họ và tên hiển thị"
            rules={[{ required: true, message: "Họ và tên tài xế không được để trống" }]}
          >
            <Input placeholder="Họ và tên tài xế" />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Số điện thoại liên lạc"
            rules={[{ required: true, message: "Vui lòng nhập số điện thoại" }]}
          >
            <Input prefix={<PhoneOutlined className="text-gray-400" />} placeholder="Ví dụ: 0901234567" />
          </Form.Item>

          <Form.Item name="licenseClass" label="Hạng bằng lái" initialValue="D">
            <Select>
              <Option value="B2">Hạng B2 (Xe dưới 9 chỗ)</Option>
              <Option value="C">Hạng C (Xe tải)</Option>
              <Option value="D">Hạng D (Xe 10 - 30 chỗ)</Option>
              <Option value="E">Hạng E (Xe trên 30 chỗ)</Option>
            </Select>
          </Form.Item>

          {editingDriver && (
            <Form.Item name="status" label="Trạng thái tài xế" initialValue="AVAILABLE">
              <Select>
                <Option value="AVAILABLE">Sẵn sàng nhận lịch</Option>
                <Option value="ON_TRIP">Đang chạy</Option>
                <Option value="OFF">Nghỉ</Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item name="notes" label="Ghi chú">
            <Input placeholder="Kinh nghiệm, ca trực, ghi chú khác..." />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button
              onClick={() => {
                setIsDriverModalOpen(false);
                setEditingDriver(null);
              }}
            >
              Hủy
            </Button>
            <Button type="primary" htmlType="submit">
              {editingDriver ? "Cập Nhật Tài Xế" : "Lưu Tài Xế"}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* ========================================================= */}
      {/* 5. MODAL BÁO CÁO THỐNG KÊ & PHÂN TÍCH CHUYÊN SÂU             */}
      {/* ========================================================= */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <BarChartOutlined className="text-purple-600 text-lg" />
            <div>
              <div className="font-bold text-slate-800 text-base leading-tight">
                Báo Cáo Thống Kê & Phân Tích Xe Công Tác
              </div>
              <div className="text-xs text-slate-500 font-normal mt-0.5">
                Trường Cao đẳng Bách khoa Nam Sài Gòn
              </div>
            </div>
          </div>
        }
        open={isStatsModalOpen}
        onCancel={() => setIsStatsModalOpen(false)}
        width={960}
        footer={[
          <Button
            key="excel"
            icon={<FileExcelOutlined className="text-emerald-600" />}
            onClick={exportBookingsToExcel}
          >
            Xuất Báo Cáo Excel
          </Button>,
          <Button key="close" type="primary" onClick={() => setIsStatsModalOpen(false)}>
            Đóng
          </Button>,
        ]}
      >
        <div className="space-y-4 pt-1">
          {/* Dải Thẻ Tổng Quan */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-center">
              <div className="text-xs text-blue-700 font-semibold uppercase">Tổng chuyến đi</div>
              <div className="text-2xl font-bold text-blue-800 mt-1">{statsData?.overview?.totalBookings || 0}</div>
              <div className="text-[11px] text-blue-600/80 mt-0.5">
                {statsData?.overview?.completed || 0} đã hoàn thành
              </div>
            </div>
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center">
              <div className="text-xs text-emerald-700 font-semibold uppercase">Hành khách phục vụ</div>
              <div className="text-2xl font-bold text-emerald-800 mt-1">{statsData?.overview?.totalPassengers || 0}</div>
              <div className="text-[11px] text-emerald-600/80 mt-0.5">Lượt cán bộ / GV / SV</div>
            </div>
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-center">
              <div className="text-xs text-indigo-700 font-semibold uppercase">Tổng quãng đường</div>
              <div className="text-2xl font-bold text-indigo-800 mt-1">
                {statsData?.overview?.totalDistanceKm || 0} <span className="text-sm font-normal">km</span>
              </div>
              <div className="text-[11px] text-indigo-600/80 mt-0.5">Ước tính & thực tế</div>
            </div>
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-center">
              <div className="text-xs text-amber-700 font-semibold uppercase">Đang chờ xử lý</div>
              <div className="text-2xl font-bold text-amber-800 mt-1">
                {(statsData?.overview?.pendingApproval || 0) + (statsData?.overview?.unassigned || 0)}
              </div>
              <div className="text-[11px] text-amber-700/80 mt-0.5">Chờ BGH duyệt & xếp xe</div>
            </div>
          </div>

          {/* Thanh phân bổ Loại xe: Xe trường vs Xe công nghệ */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
              <span>Phân bổ theo loại hình phương tiện:</span>
              <span>
                Xe trường: <strong>{statsData?.overview?.schoolVehicles || 0}</strong> | Xe công nghệ:{" "}
                <strong>{statsData?.overview?.rideHailing || 0}</strong>
              </span>
            </div>
            <Progress
              percent={
                statsData?.overview?.totalBookings
                  ? Math.round(((statsData.overview.schoolVehicles || 0) / statsData.overview.totalBookings) * 100)
                  : 0
              }
              strokeColor="#2563eb"
              trailColor="#f59e0b"
              format={(percent) => `${percent}% Xe trường`}
            />
          </div>

          {/* Tabs Chi Tiết */}
          <Tabs
            activeKey={statsActiveTab}
            onChange={setStatsActiveTab}
            items={[
              {
                key: "departments",
                label: (
                  <span>
                    <TeamOutlined /> Theo Khoa / Phòng Ban ({statsData?.byDepartment?.length || 0})
                  </span>
                ),
                children: (
                  <Table
                    size="small"
                    dataSource={statsData?.byDepartment || []}
                    rowKey="name"
                    pagination={{ pageSize: 8 }}
                    columns={[
                      { title: "STT", render: (_, __, i) => i + 1, width: 60, align: "center" },
                      { title: "Đơn Vị / Khoa", dataIndex: "name", key: "name", render: (t) => <strong>{t}</strong> },
                      {
                        title: "Số Chuyến Đi",
                        dataIndex: "count",
                        key: "count",
                        align: "center",
                        sorter: (a, b) => a.count - b.count,
                        render: (c) => <Badge count={c} style={{ backgroundColor: "#2563eb" }} />,
                      },
                      {
                        title: "Lượt Người Đi",
                        dataIndex: "passengers",
                        key: "passengers",
                        align: "center",
                        sorter: (a, b) => a.passengers - b.passengers,
                        render: (p) => `${p} người`,
                      },
                      {
                        title: "Quãng Đường",
                        dataIndex: "distanceKm",
                        key: "distanceKm",
                        align: "right",
                        sorter: (a, b) => a.distanceKm - b.distanceKm,
                        render: (d) => `${Math.round(d * 10) / 10} km`,
                      },
                    ]}
                  />
                ),
              },
              {
                key: "vehicles",
                label: (
                  <span>
                    <CarOutlined /> Theo Phương Tiện Trường ({statsData?.byVehicle?.length || 0})
                  </span>
                ),
                children: (
                  <Table
                    size="small"
                    dataSource={statsData?.byVehicle || []}
                    rowKey="name"
                    pagination={{ pageSize: 8 }}
                    columns={[
                      { title: "STT", render: (_, __, i) => i + 1, width: 60, align: "center" },
                      { title: "Phương Tiện (Biển số)", dataIndex: "name", key: "name", render: (t) => <strong>{t}</strong> },
                      {
                        title: "Số Chuyến Phục Vụ",
                        dataIndex: "count",
                        key: "count",
                        align: "center",
                        sorter: (a, b) => a.count - b.count,
                        render: (c) => <Badge count={c} style={{ backgroundColor: "#059669" }} />,
                      },
                      {
                        title: "Tổng Quãng Đường",
                        dataIndex: "distanceKm",
                        key: "distanceKm",
                        align: "right",
                        sorter: (a, b) => a.distanceKm - b.distanceKm,
                        render: (d) => `${Math.round(d * 10) / 10} km`,
                      },
                    ]}
                  />
                ),
              },
              {
                key: "drivers",
                label: (
                  <span>
                    <UserOutlined /> Theo Tài Xế ({statsData?.byDriver?.length || 0})
                  </span>
                ),
                children: (
                  <Table
                    size="small"
                    dataSource={statsData?.byDriver || []}
                    rowKey="name"
                    pagination={{ pageSize: 8 }}
                    columns={[
                      { title: "STT", render: (_, __, i) => i + 1, width: 60, align: "center" },
                      { title: "Họ Tên Tài Xế", dataIndex: "name", key: "name", render: (t) => <strong>{t}</strong> },
                      {
                        title: "Số Chuyến Lái",
                        dataIndex: "count",
                        key: "count",
                        align: "center",
                        sorter: (a, b) => a.count - b.count,
                        render: (c) => <Badge count={c} style={{ backgroundColor: "#7c3aed" }} />,
                      },
                      {
                        title: "Tổng Quãng Đường",
                        dataIndex: "distanceKm",
                        key: "distanceKm",
                        align: "right",
                        sorter: (a, b) => a.distanceKm - b.distanceKm,
                        render: (d) => `${Math.round(d * 10) / 10} km`,
                      },
                    ]}
                  />
                ),
              },
              {
                key: "monthly",
                label: (
                  <span>
                    <LineChartOutlined /> Xu Hướng Theo Tháng ({statsData?.byMonth?.length || 0})
                  </span>
                ),
                children: (
                  <Table
                    size="small"
                    dataSource={statsData?.byMonth || []}
                    rowKey="month"
                    pagination={{ pageSize: 8 }}
                    columns={[
                      { title: "STT", render: (_, __, i) => i + 1, width: 60, align: "center" },
                      { title: "Tháng / Năm", dataIndex: "month", key: "month", render: (t) => <strong>{t}</strong> },
                      {
                        title: "Số Lượng Chuyến Đi",
                        dataIndex: "count",
                        key: "count",
                        align: "center",
                        render: (c) => <Tag color="blue">{c} chuyến</Tag>,
                      },
                      {
                        title: "Tổng Km Lăn Bánh",
                        dataIndex: "distanceKm",
                        key: "distanceKm",
                        align: "right",
                        render: (d) => `${Math.round(d * 10) / 10} km`,
                      },
                    ]}
                  />
                ),
              },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
};

export default VehicleManagementPage;
