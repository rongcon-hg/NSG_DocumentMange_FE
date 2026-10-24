import React, { useState, useEffect } from "react";
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
  createDriver,
  deleteVehicle,
  deleteDriver,
} from "../../api/vehicleApi";
import { getAllUsers, getUserInfo } from "../../api/auth";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getBghUsers } from "../../api/workScheduleApi";
import { isBghUser, isCapTruongUser, isCapPhoUser } from "../../utils/userClassification";
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
  const [leaderUsers, setLeaderUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Forms
  const [createForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [dispatchForm] = Form.useForm();

  // Modal tạo xe & tài xế mới
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
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

    // Tải danh sách BGH để chọn khi đăng ký xe
    const fetchUserData = async () => {
      try {
        // 1. Tải danh sách BGH từ endpoint chuyên dụng
        const bghRes = await getBghUsers();
        let bghList = [];
        if (bghRes?.success && Array.isArray(bghRes.data)) {
          bghList = bghRes.data;
        }

        // 2. Tải toàn bộ nhân sự hệ thống để dùng cho smart-search tài xế và fallback BGH
        const userRes = await getAllUsers();
        const users = userRes?.data?.users || userRes?.data || [];
        setAllUsers(users);

        if (bghList.length === 0) {
          // Fallback lọc từ toàn bộ users
          bghList = users.filter((u) => isBghUser(u));
        }

        setBghUsers(bghList);

        // Lọc danh sách Lãnh đạo / Phụ trách phân bổ xe (Cấp trưởng, Cấp phó, Manager, QTTB-CSVC)
        const leaders = users.filter((u) => {
          if (!u || isBghUser(u)) return false;
          const isLead = isCapTruongUser(u) || isCapPhoUser(u) || u.role === "manager" || u.role === "admin";
          const dept = (u.department?.departmentName || u.department?.name || "").toLowerCase();
          const isQttb = dept.includes("qttb") || dept.includes("thiết bị") || dept.includes("cơ sở vật chất");
          return isLead || isQttb;
        });

        leaders.sort((a, b) => {
          const aDept = (a.department?.departmentName || "").toLowerCase();
          const bDept = (b.department?.departmentName || "").toLowerCase();
          const aIsQttb = aDept.includes("qttb") || aDept.includes("thiết bị") || aDept.includes("cơ sở vật chất");
          const bIsQttb = bDept.includes("qttb") || bDept.includes("thiết bị") || bDept.includes("cơ sở vật chất");
          if (aIsQttb && !bIsQttb) return -1;
          if (!aIsQttb && bIsQttb) return 1;
          return (a.name || a.fullName || "").localeCompare(b.name || b.fullName || "", "vi");
        });
        setLeaderUsers(leaders.length > 0 ? leaders : users);
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
      const payload = {
        ...values,
        departureTime: values.timeRange[0].toISOString(),
        estimatedReturnTime: values.timeRange[1].toISOString(),
      };
      delete payload.timeRange;

      const res = await createVehicleBooking(payload);
      if (res.data?.success) {
        message.success(res.data.message || "Tạo đơn đăng ký xe thành công");
        setIsCreateModalOpen(false);
        createForm.resetFields();
        fetchBookings(1);
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

  // Cập nhật trạng thái chuyến đi
  const handleUpdateStatus = async (id, status) => {
    try {
      const res = await updateTripStatus(id, {
        status,
        actualReturnTime: status === "COMPLETED" ? new Date().toISOString() : undefined,
      });
      if (res.data?.success) {
        message.success("Đã cập nhật trạng thái chuyến đi");
        fetchBookings(pagination.current);
      }
    } catch (err) {
      message.error("Lỗi cập nhật trạng thái");
    }
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
      title: "Thời Gian",
      key: "time",
      render: (_, record) => (
        <div className="text-xs min-w-[125px]">
          <div><span className="text-gray-500">Đi:</span> <strong className="text-blue-700">{dayjs(record.departureTime).format("DD/MM/YYYY HH:mm")}</strong></div>
          <div className="mt-0.5"><span className="text-gray-500">Về:</span> <span>{dayjs(record.estimatedReturnTime).format("DD/MM/YYYY HH:mm")}</span></div>
        </div>
      ),
      width: 140,
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
        <div className="space-y-1 min-w-[120px]">
          <div>{renderApprovalTag(record.approvalStatus)}</div>
          {record.approvalStatus === "APPROVED" && (
            <div>{renderDispatchTag(record.dispatchStatus, record.vehicleType)}</div>
          )}
        </div>
      ),
      width: 140,
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

        const isAssigned = record.dispatchStatus === "ASSIGNED";
        const isInProgress = record.dispatchStatus === "IN_PROGRESS";

        return (
          <Space direction="vertical" size={2}>
            <Button
              size="small"
              icon={<EyeOutlined />}
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
                className="bg-emerald-600 hover:bg-emerald-700"
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
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => {
                  setSelectedBooking(record);
                  dispatchForm.resetFields();
                  setIsDispatchModalOpen(true);
                }}
              >
                Phân bổ xe
              </Button>
            )}

            {/* Tài xế lái xe bấm Bắt đầu đi & Hoàn thành chuyến về */}
            {isAssigned && isAssignedDriverOfTrip && (
              <Popconfirm
                title="Xác nhận bắt đầu chuyến đi?"
                onConfirm={() => handleUpdateStatus(record._id, "IN_PROGRESS")}
                okText="Bắt đầu"
                cancelText="Hủy"
              >
                <Button size="small" type="primary" className="bg-blue-600 hover:bg-blue-700 text-xs">
                  🚗 Bắt đầu đi
                </Button>
              </Popconfirm>
            )}
            {isInProgress && isAssignedDriverOfTrip && (
              <Popconfirm
                title="Xác nhận chuyến xe đã về an toàn / kết thúc?"
                onConfirm={() => handleUpdateStatus(record._id, "COMPLETED")}
                okText="Đã về"
                cancelText="Hủy"
              >
                <Button size="small" type="primary" className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                  🏁 Đã về (Hoàn thành)
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
                <Button size="small" danger>
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
                <Button size="small" danger icon={<DeleteOutlined />} className="text-xs">
                  Xóa
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
      width: 120,
      fixed: "right",
    },
  ];

  // Phân quyền người dùng hiện tại
  const userRole = (currentUser?.role || Cookies.get("role") || "").toUpperCase();
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
          {(isBgh || isAdminOrManager) && (
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
                        render: (_, rec) => (
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
                        render: (_, rec) => (
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

          <Form.Item
            name="timeRange"
            label="Thời gian đi & Thời gian về (Dự kiến)"
            rules={[{ required: true, message: "Vui lòng chọn khoảng thời gian" }]}
          >
            <RangePicker
              showTime={{ format: "HH:mm" }}
              format="DD/MM/YYYY HH:mm"
              className="w-full"
              placeholder={["Thời gian xuất phát", "Thời gian về"]}
            />
          </Form.Item>

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
              <div><strong>Thời gian:</strong> {dayjs(selectedBooking.departureTime).format("DD/MM/YYYY HH:mm")} - {dayjs(selectedBooking.estimatedReturnTime).format("DD/MM/YYYY HH:mm")}</div>
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
                        extra="Chỉ định Trưởng/Phó đơn vị (ưu tiên P.QTTB-CSVC) để thực hiện xếp xe và tài xế"
                      >
                        <Select
                          placeholder="Chọn Lãnh đạo phụ trách phân bổ xe"
                          showSearch
                          allowClear
                          optionFilterProp="filterLabel"
                          popupMatchSelectWidth={380}
                        >
                          {leaderUsers.map((u) => {
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
            onClick={() => window.print()}
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

                <Col xs={24} sm={12}>
                  <div className="text-xs text-gray-500">Thời gian xuất phát</div>
                  <div className="text-blue-700 font-semibold mt-0.5">
                    {dayjs(selectedBooking.departureTime).format("HH:mm - DD/MM/YYYY")}
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div className="text-xs text-gray-500">Thời gian về (dự kiến)</div>
                  <div className="text-slate-800 font-medium mt-0.5">
                    {dayjs(selectedBooking.estimatedReturnTime).format("HH:mm - DD/MM/YYYY")}
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
            {(selectedBooking.assignedVehicle || selectedBooking.assignedDriver || selectedBooking.dispatchNotes) && (
              <Card size="small" title={<span className="text-xs font-bold uppercase text-slate-600">4. Phương tiện & Tài xế thực hiện</span>} className="border-emerald-200 bg-emerald-50/30">
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
          </div>
        )}
      </Modal>

      {/* Modal Thêm Xe */}
      <Modal
        title="Thêm Phương Tiện Mới"
        open={isVehicleModalOpen}
        onCancel={() => setIsVehicleModalOpen(false)}
        footer={null}
      >
        <Form
          form={vehicleForm}
          layout="vertical"
          onFinish={async (val) => {
            try {
              const res = await createVehicle(val);
              if (res.data?.success) {
                message.success("Thêm xe thành công");
                setIsVehicleModalOpen(false);
                loadVehiclesAndDrivers();
              }
            } catch (e) {
              message.error(e.response?.data?.message || "Lỗi tạo xe");
            }
          }}
        >
          <Form.Item name="name" label="Tên phương tiện" rules={[{ required: true }]}>
            <Input placeholder="Ví dụ: Ford Transit 16 chỗ" />
          </Form.Item>
          <Form.Item name="licensePlate" label="Biển số xe" rules={[{ required: true }]}>
            <Input placeholder="Ví dụ: 51B-123.45" />
          </Form.Item>
          <Form.Item name="seats" label="Số chỗ ngồi" initialValue={7} rules={[{ required: true }]}>
            <InputNumber min={2} max={60} className="w-full" />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú">
            <Input placeholder="Tình trạng xe, bảo dưỡng..." />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsVehicleModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit">Lưu Phương Tiện</Button>
          </div>
        </Form>
      </Modal>

      {/* Modal Thêm Tài Xế */}
      <Modal
        title="Thêm Tài Xế Mới"
        open={isDriverModalOpen}
        onCancel={() => setIsDriverModalOpen(false)}
        footer={null}
      >
        <Form
          form={driverForm}
          layout="vertical"
          onFinish={async (val) => {
            try {
              const res = await createDriver(val);
              if (res.data?.success) {
                message.success("Thêm tài xế thành công");
                setIsDriverModalOpen(false);
                loadVehiclesAndDrivers();
              }
            } catch (e) {
              message.error(e.response?.data?.message || "Lỗi tạo tài xế");
            }
          }}
        >
          {/* Trường ẩn lưu userAccount ID nếu chọn từ hệ thống */}
          <Form.Item name="userAccount" hidden>
            <Input />
          </Form.Item>

          <Form.Item
            name="fullName"
            label="Họ và tên tài xế"
            rules={[{ required: true, message: "Vui lòng nhập hoặc chọn tên tài xế" }]}
            extra="Nhập tên tùy ý hoặc gõ từ khóa để chọn nhanh nhân sự có sẵn trên hệ thống"
          >
            <AutoComplete
              placeholder="Nhập họ tên hoặc tìm kiếm tài khoản nhân sự..."
              allowClear
              options={allUsers.map((u) => {
                const name = u.fullName || u.userName || u.name;
                const pos = u.position?.positionName || u.position?.name || "";
                const dept = u.department?.departmentName || "";
                const phone = u.phone || "";
                return {
                  value: name,
                  userObj: u,
                  label: (
                    <div className="flex justify-between items-center py-1">
                      <div>
                        <span className="font-semibold text-slate-800">{name}</span>
                        {(pos || dept) && (
                          <span className="text-xs text-gray-500 ml-2">
                            ({pos ? `${pos}` : ""}{pos && dept ? " - " : ""}{dept})
                          </span>
                        )}
                      </div>
                      {phone && <span className="text-xs text-blue-600 font-mono">{phone}</span>}
                    </div>
                  ),
                };
              })}
              filterOption={(inputValue, option) => {
                if (!inputValue) return true;
                const text = `${option?.value || ""} ${option?.userObj?.phone || ""} ${option?.userObj?.email || ""}`.toLowerCase();
                return text.includes(inputValue.toLowerCase());
              }}
              onSelect={(value, option) => {
                if (option?.userObj) {
                  const u = option.userObj;
                  driverForm.setFieldsValue({
                    fullName: u.fullName || u.userName || u.name,
                    phone: u.phone || driverForm.getFieldValue("phone") || "",
                    userAccount: u._id,
                  });
                }
              }}
              onChange={(value) => {
                // Nếu người dùng tự gõ không khớp với user đã chọn thì xóa userAccount
                const currentAccount = driverForm.getFieldValue("userAccount");
                if (currentAccount) {
                  const matched = allUsers.find(
                    (u) => (u.fullName || u.userName || u.name) === value && u._id === currentAccount
                  );
                  if (!matched) {
                    driverForm.setFieldsValue({ userAccount: null });
                  }
                }
              }}
            />
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

          <Form.Item name="notes" label="Ghi chú">
            <Input placeholder="Kinh nghiệm, ca trực, ghi chú khác..." />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button onClick={() => setIsDriverModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit">Lưu Tài Xế</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default VehicleManagementPage;
