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
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  getVehicleBookings,
  createVehicleBooking,
  reviewVehicleBooking,
  dispatchVehicleBooking,
  updateTripStatus,
  cancelVehicleBooking,
  deleteVehicleBooking,
  getAllVehicles,
  getAllDrivers,
  createVehicle,
  updateVehicle,
  createDriver,
  updateDriver,
  deleteVehicle,
  deleteDriver,
} from "../../api/vehicleApi";
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
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const printRef = useRef(null);

  // Forms
  const [createForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [dispatchForm] = Form.useForm();

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

    fetchUserData();
    loadVehiclesAndDrivers();
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

  // Tải danh sách bookings theo tab hiện tại
  const fetchBookings = async (page = 1) => {
    setLoading(true);
    try {
      const res = await getVehicleBookings({
        tab: activeTab,
        page,
        limit: pagination.pageSize,
      });
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
      };
      delete payload.dateRange;
      delete payload.timeRange;

      const res = await createVehicleBooking(payload);
      if (res.data?.success) {
        message.success(res.data.message || "Tạo đơn đăng ký xe thành công");
        setIsCreateModalOpen(false);
        createForm.resetFields();
        fetchBookings(1);
        if (typeof refetchNotificationCounts === "function") refetchNotificationCounts();
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi tạo đơn đăng ký xe");
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
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi phê duyệt đơn");
    }
  };

  // Xử lý Phân bổ xe & tài xế
  const handleDispatchSubmit = async (values) => {
    if (!selectedBooking) return;
    try {
      const res = await dispatchVehicleBooking(selectedBooking._id, values);
      if (res.data?.success) {
        message.success("Phân bổ xe và tài xế thành công");
        setIsDispatchModalOpen(false);
        dispatchForm.resetFields();
        fetchBookings(pagination.current);
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
          .sign-role {
            font-weight: bold;
            font-size: 11.5pt;
            text-transform: uppercase;
          }
          .sign-note {
            font-size: 10.5pt;
            font-style: italic;
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
          </div>
        );
      },
      width: 160,
    },
    {
      title: "Nội Dung & Lộ Trình",
      key: "purpose",
      render: (_, record) => (
        <div className="min-w-[200px]">
          <div className="font-semibold text-slate-800 line-clamp-2" title={record.purpose}>{record.purpose}</div>
          <div className="text-xs text-gray-600 mt-1 line-clamp-2" title={record.route}>
            <span className="font-medium text-slate-700">Lộ trình:</span> {record.route}
          </div>
          {record.passengerNames && (
            <div className="text-xs text-purple-700 mt-0.5 line-clamp-1" title={record.passengerNames}>
              <TeamOutlined /> Cùng đi ({record.passengersCount} người): {record.passengerNames}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Ngày Đi & Về",
      key: "time",
      render: (_, record) => (
        <div className="text-xs min-w-[125px]">
          <div><span className="text-gray-500">Đi:</span> <strong className="text-blue-700">{dayjs(record.departureTime).format("DD/MM/YYYY")}</strong></div>
          <div className="mt-0.5"><span className="text-gray-500">Về:</span> <span>{dayjs(record.estimatedReturnTime).format("DD/MM/YYYY")}</span></div>
        </div>
      ),
      width: 135,
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
      title: "Phương Tiện",
      dataIndex: "vehicleType",
      key: "vehicleType",
      render: (type, record) => (
        <div className="min-w-[130px]">
          <Tag color={type === "SCHOOL_VEHICLE" ? "blue" : "purple"}>
            {type === "SCHOOL_VEHICLE" ? "Xe Trường" : "Xe Công Nghệ"}
          </Tag>
          {type === "SCHOOL_VEHICLE" && record.assignedVehicle ? (
            <div className="text-xs mt-1 font-semibold text-emerald-800">
              {record.assignedVehicle.name} ({record.assignedVehicle.licensePlate})
              {record.assignedDriver && (
                <div className="text-gray-600 font-normal">TX: {record.assignedDriver.fullName} - {record.assignedDriver.phone}</div>
              )}
            </div>
          ) : null}
        </div>
      ),
      width: 150,
    },
    {
      title: "Trạng Thái",
      key: "status",
      render: (_, record) => (
        <div className="space-y-1 min-w-[130px]">
          <div>{renderApprovalTag(record.approvalStatus)}</div>
          {record.approvalStatus === "APPROVED" && (
            <div>{renderDispatchTag(record.dispatchStatus, record.vehicleType)}</div>
          )}
          {record.actualDepartureTime && (
            <div className="text-[11px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1">
              <span>🚗 Đi:</span>
              <span className="font-semibold">{dayjs(record.actualDepartureTime).format("DD/MM HH:mm")}</span>
            </div>
          )}
          {record.actualReturnTime && (
            <div className="text-[11px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
              <span>🏁 Về:</span>
              <span className="font-semibold">{dayjs(record.actualReturnTime).format("DD/MM HH:mm")}</span>
            </div>
          )}
        </div>
      ),
      width: 150,
    },
    {
      title: "Thao Tác",
      key: "actions",
      render: (_, record) => {
        const isBGHReviewer =
          (isBgh || isAdminOrManager) &&
          (record.targetApprover?._id === currentUser?._id ||
            record.targetApprover === currentUser?._id ||
            isAdminOrManager);

        // Lãnh đạo được giao phân bổ hoặc Quản trị viên
        const canDispatch =
          record.approvalStatus === "APPROVED" &&
          record.dispatchStatus === "UNASSIGNED" &&
          (isAdminOrManager ||
            record.assignedDispatcher?._id === currentUser?._id ||
            record.assignedDispatcher === currentUser?._id ||
            !record.assignedDispatcher); // Nếu BGH chưa chỉ định ai cụ thể, các lãnh đạo có thể nhận phân bổ

        // Tài xế được phân bổ lái xe (hoặc Admin)
        const isAssignedDriverOfTrip =
          isAdminOrManager ||
          (currentDriver &&
            record.assignedDriver &&
            (record.assignedDriver._id === currentDriver._id || record.assignedDriver === currentDriver._id));

        // Người đăng ký đơn cũng có thể xác nhận bắt đầu đi và đã về
        const isRequesterOfTrip =
          record.requester?._id === currentUser?._id ||
          record.requester === currentUser?._id;

        const canConfirmTrip = isAssignedDriverOfTrip || isRequesterOfTrip;

        const isAssigned = record.dispatchStatus === "ASSIGNED";
        const isInProgress = record.dispatchStatus === "IN_PROGRESS";

        return (
          <div className="flex flex-col gap-1.5 w-full min-w-[100px] max-w-[120px]">
            <Button
              size="small"
              icon={<EyeOutlined />}
              className="w-full text-xs flex items-center justify-center font-medium shadow-sm hover:border-blue-500 hover:text-blue-600"
              onClick={() => {
                setSelectedBooking(record);
                setIsDetailModalOpen(true);
              }}
            >
              Chi tiết
            </Button>

            {/* BGH Duyệt / Từ chối */}
            {isBGHReviewer && record.approvalStatus === "PENDING" && (
              <Button
                size="small"
                type="primary"
                icon={<AuditOutlined />}
                className="w-full text-xs flex items-center justify-center font-medium bg-emerald-600 hover:bg-emerald-700 border-emerald-600 shadow-sm"
                onClick={() => {
                  setSelectedBooking(record);
                  reviewForm.setFieldsValue({ action: "APPROVE", rejectionReason: "" });
                  setIsReviewModalOpen(true);
                }}
              >
                Xét duyệt
              </Button>
            )}

            {/* Lãnh đạo được giao xếp xe */}
            {canDispatch && (
              <Button
                size="small"
                type="primary"
                icon={<CarOutlined />}
                className="w-full text-xs flex items-center justify-center font-medium bg-indigo-600 hover:bg-indigo-700 border-indigo-600 shadow-sm"
                onClick={() => {
                  setSelectedBooking(record);
                  dispatchForm.resetFields();
                  setIsDispatchModalOpen(true);
                }}
              >
                Phân bổ xe
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
                  className="w-full text-xs flex items-center justify-center font-medium bg-blue-600 hover:bg-blue-700 border-blue-600 shadow-sm"
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
                  className="w-full text-xs flex items-center justify-center font-medium bg-emerald-600 hover:bg-emerald-700 border-emerald-600 shadow-sm"
                >
                  Hoàn thành
                </Button>
              </Popconfirm>
            )}

            {/* Hủy đơn dành cho người đăng ký */}
            {record.approvalStatus === "PENDING" && activeTab === "my" && (
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
                  className="w-full text-xs flex items-center justify-center font-medium shadow-sm"
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
                  className="w-full text-xs flex items-center justify-center font-medium shadow-sm hover:bg-red-50"
                >
                  Xóa
                </Button>
              </Popconfirm>
            )}
          </div>
        );
      },
      width: 130,
      fixed: "right",
    },
  ];

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
                if (activeTab === "vehicles" || activeTab === "drivers") loadVehiclesAndDrivers();
                else fetchBookings(pagination.current);
              }}
            >
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                createForm.resetFields();
                if (currentUser) {
                  createForm.setFieldsValue({
                    contactPhone: currentUser.phone || "",
                    passengersCount: 1,
                    vehicleType: "SCHOOL_VEHICLE",
                    requiredSeats: 7,
                    departureLocation: "Trường CĐ Bách Khoa Nam Sài Gòn",
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

        {/* Tabs giao diện phân quyền */}
        <Tabs activeKey={activeTab} onChange={setActiveTab} className="mt-2">
          <TabPane tab="Đơn Đăng Ký Của Tôi" key="my" />
          {(isBgh || isAdmin) && (
            <TabPane
              tab={
                <span className="flex items-center gap-1.5">
                  <span>Chờ BGH Phê Duyệt</span>
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
                  render: (st) => (
                    <Tag color={st === "AVAILABLE" ? "success" : st === "IN_USE" ? "processing" : "warning"}>
                      {st === "AVAILABLE" ? "Sẵn sàng" : st === "IN_USE" ? "Đang đi" : "Bảo dưỡng"}
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
                  render: (st) => (
                    <Tag color={st === "AVAILABLE" ? "success" : st === "ON_TRIP" ? "blue" : "default"}>
                      {st === "AVAILABLE" ? "Sẵn sàng nhận lịch" : st === "ON_TRIP" ? "Đang chạy" : "Nghỉ"}
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
          <Table
            dataSource={bookings}
            columns={bookingColumns}
            rowKey="_id"
            loading={loading}
            scroll={{ x: "max-content" }}
            pagination={{
              ...pagination,
              showTotal: (total) => `Tổng cộng ${total} đơn đăng ký`,
              onChange: (page) => fetchBookings(page),
            }}
          />
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

          <Form.Item
            name="route"
            label="Lộ trình di chuyển (Điểm đi -> Điểm đến)"
            rules={[{ required: true, message: "Vui lòng nhập lộ trình" }]}
          >
            <Input placeholder="Ví dụ: Trường CĐ Nam Sài Gòn -> 66 Lê Thánh Tôn, Q.1 -> Về trường" />
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
                <strong>Lịch trình:</strong> {dayjs(selectedBooking.departureTime).format("DD/MM/YYYY")} - {dayjs(selectedBooking.estimatedReturnTime).format("DD/MM/YYYY")}
                {selectedBooking.departureHour && (
                  <span className="ml-2 font-mono text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                    <ClockCircleOutlined className="mr-1" />{selectedBooking.departureHour}
                  </span>
                )}
              </div>
            </div>

            <Form.Item name="action" label="Quyết định phê duyệt" rules={[{ required: true }]}>
              <Select>
                <Option value="APPROVE">
                  {selectedBooking.vehicleType === "RIDE_HAILING"
                    ? "✅ Phê duyệt đơn (Đồng ý cho đi Xe công nghệ)"
                    : "✅ Phê duyệt đơn (Giao nhiệm vụ phân bổ xe)"}
                </Option>
                <Option value="REJECT">❌ Từ chối duyệt</Option>
              </Select>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.action !== currentValues.action}
            >
              {({ getFieldValue }) =>
                getFieldValue("action") === "APPROVE" ? (
                  <>
                    {/* Chỉ đơn Xe trường mới cần bước phân bổ xe & tài xế */}
                    {selectedBooking.vehicleType === "SCHOOL_VEHICLE" ? (
                      <Form.Item
                        name="assignedDispatcher"
                        label="Chọn Lãnh đạo / Phụ trách phân bổ xe"
                        rules={[{ required: true, message: "Vui lòng chỉ định người chịu trách nhiệm phân bổ xe" }]}
                        extra="Liệt kê theo nhóm: BGH, Cấp trưởng, Cấp phó, GV-CV; hỗ trợ gõ tên hoặc đơn vị để tìm kiếm"
                      >
                        <Select
                          placeholder="Chọn Lãnh đạo phụ trách phân bổ xe"
                          showSearch
                          allowClear
                          optionFilterProp="filterLabel"
                          popupMatchSelectWidth={420}
                        >
                          {leaderGroups.map((group) => (
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
                      <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 mb-4 text-xs text-emerald-800">
                        🚕 Đơn đăng ký sử dụng <strong>Xe công nghệ</strong>: Sau khi BGH phê duyệt, người đăng ký chủ động đặt xe và thanh toán theo quy định mà không cần qua khâu điều xe trường.
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
        title="Điều Phối Xe & Phân Bổ Tài Xế"
        open={isDispatchModalOpen}
        onCancel={() => setIsDispatchModalOpen(false)}
        footer={null}
        width={650}
      >
        {selectedBooking && (
          <Form form={dispatchForm} layout="vertical" onFinish={handleDispatchSubmit} className="mt-3">
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mb-4 text-xs space-y-1">
              <div><strong>Mã đơn:</strong> {selectedBooking.bookingCode}</div>
              <div><strong>Nội dung:</strong> {selectedBooking.purpose}</div>
              <div><strong>Thời gian xuất phát:</strong> {dayjs(selectedBooking.departureTime).format("DD/MM/YYYY HH:mm")}</div>
              <div><strong>Loại xe yêu cầu:</strong> {selectedBooking.vehicleType === "SCHOOL_VEHICLE" ? "Xe trường" : "Xe công nghệ"} ({selectedBooking.requiredSeats} chỗ)</div>
            </div>

            {selectedBooking.vehicleType === "SCHOOL_VEHICLE" ? (
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="assignedVehicle"
                    label="Chọn Xe Trường"
                    rules={[{ required: true, message: "Vui lòng chọn xe trường" }]}
                  >
                    <Select placeholder="Chọn xe của trường">
                      {vehicles.map((v) => (
                        <Option key={v._id} value={v._id}>
                          {v.name} - {v.licensePlate} ({v.seats} chỗ)
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="assignedDriver"
                    label="Chọn Tài Xế Phụ Trách"
                    rules={[{ required: true, message: "Vui lòng chọn tài xế" }]}
                  >
                    <Select placeholder="Chọn tài xế">
                      {drivers.map((d) => (
                        <Option key={d._id} value={d._id}>
                          {d.fullName} ({d.phone})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            ) : (
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 mb-4 text-xs">
                <div><strong>Lưu ý:</strong> Đơn này sử dụng <strong>Xe công nghệ</strong>. Đơn vị quản lý xác nhận duyệt phương thức di chuyển hoặc cấp mã đặt chuyến nếu có.</div>
              </div>
            )}

            <Form.Item name="dispatchNotes" label="Ghi chú điều phối (Điểm đón cụ thể, giờ tập trung...)">
              <TextArea rows={2} placeholder="Nhập ghi chú cho tài xế và người đăng ký..." />
            </Form.Item>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <Button onClick={() => setIsDispatchModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" className="bg-indigo-600 hover:bg-indigo-700">
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
                  <div className="text-xs text-gray-500">Lộ trình di chuyển</div>
                  <div className="text-slate-800 font-medium mt-0.5 bg-gray-50 p-2 rounded border border-gray-100">
                    {selectedBooking.route}
                  </div>
                </Col>

                <Col xs={24} sm={8}>
                  <div className="text-xs text-gray-500">Ngày xuất phát</div>
                  <div className="text-blue-700 font-semibold mt-0.5">
                    {dayjs(selectedBooking.departureTime).format("DD/MM/YYYY")}
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
                    {dayjs(selectedBooking.estimatedReturnTime).format("DD/MM/YYYY")}
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
            <Card size="small" title={<span className="text-xs font-bold uppercase text-slate-600">3. Phê duyệt của BGH & Điều động</span>} className="border-gray-200">
              <Row gutter={[16, 12]}>
                <Col xs={24} sm={12}>
                  <div className="text-xs text-gray-500">Người duyệt (BGH)</div>
                  <div className="mt-0.5">
                    {(() => {
                      const approverObj = selectedBooking.approvedBy || selectedBooking.targetApprover;
                      const approverName =
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

                <Col xs={24} sm={12}>
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
                    <div className="text-indigo-800 bg-indigo-50 p-2 rounded border border-indigo-100 mt-0.5">
                      {selectedBooking.approvalNotes}
                    </div>
                  </Col>
                )}

                {selectedBooking.rejectionReason && (
                  <Col xs={24}>
                    <div className="text-xs text-gray-500">Lý do không duyệt</div>
                    <div className="text-rose-700 bg-rose-50 p-2 rounded border border-rose-100 mt-0.5 font-medium">
                      {selectedBooking.rejectionReason}
                    </div>
                  </Col>
                )}
              </Row>
            </Card>

            {/* Khối 4: Kết quả điều phối phương tiện & Tài xế */}
            {(selectedBooking.assignedVehicle || selectedBooking.assignedDriver || selectedBooking.dispatchNotes || selectedBooking.actualDepartureTime || selectedBooking.actualReturnTime) && (
              <Card size="small" title={<span className="text-xs font-bold uppercase text-slate-600">4. Phương tiện & Lịch trình thực tế</span>} className="border-emerald-200 bg-emerald-50/30">
                <Row gutter={[16, 12]}>
                  {selectedBooking.assignedVehicle && (
                    <Col xs={24} sm={12}>
                      <div className="text-xs text-gray-500">Phương tiện phân bổ</div>
                      <div className="font-bold text-blue-700 mt-0.5">
                        {selectedBooking.assignedVehicle.name} ({selectedBooking.assignedVehicle.licensePlate})
                      </div>
                    </Col>
                  )}
                  {selectedBooking.assignedDriver && (
                    <Col xs={24} sm={12}>
                      <div className="text-xs text-gray-500">Tài xế phụ trách</div>
                      <div className="font-bold text-emerald-700 mt-0.5">
                        {selectedBooking.assignedDriver.fullName} - {selectedBooking.assignedDriver.phone}
                      </div>
                    </Col>
                  )}
                  {selectedBooking.actualDepartureTime && (
                    <Col xs={24} sm={12}>
                      <div className="text-xs text-gray-500">Thời gian thực tế bắt đầu đi</div>
                      <div className="font-bold text-blue-800 mt-0.5 flex items-center gap-1.5">
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
                      <div className="font-bold text-emerald-800 mt-0.5 flex items-center gap-1.5">
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
                      <div className="text-gray-700 italic mt-0.5 bg-white p-2 rounded border border-gray-200">
                        {selectedBooking.dispatchNotes}
                      </div>
                    </Col>
                  )}
                </Row>
              </Card>
            )}

            {/* Mẫu Phiếu In Chuẩn Hành Chính (ẩn trên màn hình xem, xuất ra khi bấm In Phiếu) */}
            <div style={{ display: "none" }}>
              <div ref={printRef}>
                {/* 1. Header Quốc hiệu & Tên Trường */}
                <table className="header-table">
                  <tbody>
                    <tr>
                      <td style={{ width: "45%" }}>
                        <div className="org-title">ỦY BAN NHÂN DÂN THÀNH PHỐ HỒ CHÍ MINH</div>
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
                  </li>
                  <li className="info-row">
                    <span className="info-label">3. Thời gian xuất phát:</span>{" "}
                    {selectedBooking.departureHour ? `${selectedBooking.departureHour}, ` : ""}
                    ngày {dayjs(selectedBooking.departureDate).format("DD/MM/YYYY")}
                  </li>
                  <li className="info-row">
                    <span className="info-label">4. Thời gian về dự kiến:</span>{" "}
                    ngày {dayjs(selectedBooking.returnDate).format("DD/MM/YYYY")}
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
                      <td>
                        <div className="sign-role">NGƯỜI ĐĂNG KÝ XE</div>
                        <div className="sign-note">(Ký và ghi rõ họ tên)</div>
                        <div className="sign-space"></div>
                        <div className="sign-name">
                          {selectedBooking.requesterName ||
                            selectedBooking.requester?.fullName ||
                            selectedBooking.requester?.name ||
                            selectedBooking.requester?.userName ||
                            ""}
                        </div>
                      </td>
                      <td>
                        <div className="sign-role">LÃNH ĐẠO ĐIỀU PHỐI XE</div>
                        <div className="sign-note">(Ký và ghi rõ họ tên)</div>
                        <div className="sign-space"></div>
                        <div className="sign-name">
                          {selectedBooking.assignedDispatcher?.name ||
                            selectedBooking.assignedDispatcher?.fullName ||
                            selectedBooking.assignedDispatcher?.userName ||
                            ""}
                        </div>
                      </td>
                      <td>
                        <div className="sign-role">BAN GIÁM HIỆU PHÊ DUYỆT</div>
                        <div className="sign-note">(Ký và ghi rõ họ tên)</div>
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
    </div>
  );
};

export default VehicleManagementPage;
