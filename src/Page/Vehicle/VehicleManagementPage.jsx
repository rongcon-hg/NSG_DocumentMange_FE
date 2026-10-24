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
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
  getVehicleBookings,
  createVehicleBooking,
  reviewVehicleBooking,
  dispatchVehicleBooking,
  updateTripStatus,
  cancelVehicleBooking,
  getAllVehicles,
  getAllDrivers,
  createVehicle,
  createDriver,
} from "../../api/vehicleApi";
import { getAllUsers } from "../../api/auth";

const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const VehicleManagementPage = () => {
  const [activeTab, setActiveTab] = useState("my"); // "my", "pending_approval", "dispatch", "all", "vehicles", "drivers"
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });

  // Danh mục xe & tài xế
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [bghUsers, setBghUsers] = useState([]);
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

  // Load danh sách người dùng BGH & Current User từ local storage
  useEffect(() => {
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const u = JSON.parse(userStr);
        setCurrentUser(u);
      }
    } catch (e) {
      console.warn("Lỗi đọc user:", e);
    }

    // Tải danh sách BGH để chọn khi đăng ký xe
    getAllUsers()
      .then((res) => {
        const users = res.data?.users || res.data || [];
        const bgh = users.filter((u) => {
          const role = (u.role || "").toUpperCase();
          const pos = (u.position?.name || u.position || "").toUpperCase();
          return (
            pos.includes("HIỆU TRƯỞNG") ||
            pos.includes("PHÓ HIỆU TRƯỞNG") ||
            role.includes("HIỆU TRƯỞNG") ||
            role.includes("BGH")
          );
        });
        setBghUsers(bgh.length > 0 ? bgh : users.slice(0, 10));
      })
      .catch((err) => console.warn("Lỗi tải users:", err));

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
      width: 140,
    },
    {
      title: "Người Đăng Ký",
      key: "requester",
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-800">{record.requesterName}</div>
          <div className="text-xs text-gray-500">{record.departmentName || record.department?.name || "--"}</div>
          <div className="text-xs text-blue-600 font-mono"><PhoneOutlined /> {record.contactPhone}</div>
        </div>
      ),
      width: 170,
    },
    {
      title: "Nội Dung & Lộ Trình",
      key: "purpose",
      render: (_, record) => (
        <div>
          <div className="font-semibold text-slate-800">{record.purpose}</div>
          <div className="text-xs text-gray-600 mt-1">
            <span className="font-medium text-slate-700">Lộ trình:</span> {record.route}
          </div>
          {record.passengerNames && (
            <div className="text-xs text-purple-700 mt-0.5">
              <TeamOutlined /> Cùng đi ({record.passengersCount} người): {record.passengerNames}
            </div>
          )}
        </div>
      ),
      minWidth: 260,
    },
    {
      title: "Thời Gian",
      key: "time",
      render: (_, record) => (
        <div className="text-xs">
          <div><span className="text-gray-500">Đi:</span> <strong className="text-blue-700">{dayjs(record.departureTime).format("DD/MM/YYYY HH:mm")}</strong></div>
          <div className="mt-0.5"><span className="text-gray-500">Về:</span> <span>{dayjs(record.estimatedReturnTime).format("DD/MM/YYYY HH:mm")}</span></div>
        </div>
      ),
      width: 160,
    },
    {
      title: "Phương Tiện",
      dataIndex: "vehicleType",
      key: "vehicleType",
      render: (type, record) => (
        <div>
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
      width: 160,
    },
    {
      title: "Trạng Thái",
      key: "status",
      render: (_, record) => (
        <div className="space-y-1">
          <div>{renderApprovalTag(record.approvalStatus)}</div>
          {record.approvalStatus === "APPROVED" && (
            <div>{renderDispatchTag(record.dispatchStatus, record.vehicleType)}</div>
          )}
        </div>
      ),
      width: 160,
    },
    {
      title: "Thao Tác",
      key: "actions",
      render: (_, record) => {
        const isBGH = activeTab === "pending_approval";
        const canDispatch = record.approvalStatus === "APPROVED" && record.dispatchStatus === "UNASSIGNED";
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
            {isBGH && record.approvalStatus === "PENDING" && (
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

            {/* Đơn vị quản lý xếp xe */}
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

            {/* Đang đi / Hoàn thành */}
            {isAssigned && (
              <Button
                size="small"
                onClick={() => handleUpdateStatus(record._id, "IN_PROGRESS")}
                className="text-blue-600 border-blue-600"
              >
                Bắt đầu đi
              </Button>
            )}
            {isInProgress && (
              <Button
                size="small"
                onClick={() => handleUpdateStatus(record._id, "COMPLETED")}
                className="text-emerald-700 border-emerald-700"
              >
                Hoàn thành
              </Button>
            )}

            {/* Hủy đơn */}
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
          </Space>
        );
      },
      width: 120,
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

        {/* Tabs giao diện */}
        <Tabs activeKey={activeTab} onChange={setActiveTab} className="mt-2">
          <TabPane tab="Đơn Đăng Ký Của Tôi" key="my" />
          <TabPane
            tab={
              <span>
                Chờ BGH Phê Duyệt
              </span>
            }
            key="pending_approval"
          />
          <TabPane tab="Phân Bổ Xe & Lịch Trình" key="dispatch" />
          <TabPane tab="Tất Cả Lịch Xe" key="all" />
          <TabPane tab="Danh Mục Phương Tiện" key="vehicles" />
          <TabPane tab="Danh Sách Tài Xế" key="drivers" />
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
              ]}
            />
          </div>
        ) : (
          <Table
            dataSource={bookings}
            columns={bookingColumns}
            rowKey="_id"
            loading={loading}
            scroll={{ x: 1100 }}
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
        width={720}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateSubmit} className="mt-3">
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="targetApprover"
                label="Kính gửi BGH phê duyệt"
                rules={[{ required: true, message: "Vui lòng chọn Ban Giám Hiệu phụ trách duyệt" }]}
              >
                <Select placeholder="Chọn Thầy/Cô BGH duyệt" showSearch optionFilterProp="children">
                  {bghUsers.map((u) => (
                    <Option key={u._id} value={u._id}>
                      {u.fullName || u.userName} ({u.position?.name || u.position || "BGH"})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
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
                <Option value="APPROVE">✅ Phê duyệt đơn (Chuyển đơn vị quản lý xe xếp xe)</Option>
                <Option value="REJECT">❌ Từ chối duyệt</Option>
              </Select>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.action !== currentValues.action}
            >
              {({ getFieldValue }) =>
                getFieldValue("action") === "REJECT" ? (
                  <Form.Item
                    name="rejectionReason"
                    label="Lý do từ chối"
                    rules={[{ required: true, message: "Vui lòng nhập lý do từ chối" }]}
                  >
                    <TextArea rows={3} placeholder="Nhập lý do không phê duyệt để phản hồi cho người đăng ký..." />
                  </Form.Item>
                ) : null
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
        title="Thông Tin Chi Tiết Phiếu Điều Xe"
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
        width={700}
      >
        {selectedBooking && (
          <div className="space-y-4 py-2 text-slate-800">
            <div className="flex justify-between items-center pb-2 border-b border-gray-200">
              <span className="font-bold text-base text-blue-800">MÃ PHIẾU: {selectedBooking.bookingCode}</span>
              <div>
                {renderApprovalTag(selectedBooking.approvalStatus)}
                <span className="ml-2">{renderDispatchTag(selectedBooking.dispatchStatus, selectedBooking.vehicleType)}</span>
              </div>
            </div>

            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Người đăng ký">{selectedBooking.requesterName}</Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">{selectedBooking.contactPhone}</Descriptions.Item>
              <Descriptions.Item label="Đơn vị / Phòng ban">{selectedBooking.departmentName || "--"}</Descriptions.Item>
              <Descriptions.Item label="Số người đi">{selectedBooking.passengersCount} người</Descriptions.Item>
              <Descriptions.Item label="Nội dung công tác" span={2}>
                <strong>{selectedBooking.purpose}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Lộ trình" span={2}>
                {selectedBooking.route}
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian đi">
                {dayjs(selectedBooking.departureTime).format("DD/MM/YYYY HH:mm")}
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian về (dự kiến)">
                {dayjs(selectedBooking.estimatedReturnTime).format("DD/MM/YYYY HH:mm")}
              </Descriptions.Item>
              <Descriptions.Item label="Loại phương tiện">
                {selectedBooking.vehicleType === "SCHOOL_VEHICLE" ? "Xe trường" : "Xe công nghệ"}
              </Descriptions.Item>
              <Descriptions.Item label="Người duyệt (BGH)">
                {selectedBooking.approvedBy?.fullName || selectedBooking.targetApprover?.fullName || "--"}
              </Descriptions.Item>
              {selectedBooking.assignedVehicle && (
                <>
                  <Descriptions.Item label="Phương tiện phân bổ">
                    <span className="font-semibold text-blue-700">{selectedBooking.assignedVehicle.name} ({selectedBooking.assignedVehicle.licensePlate})</span>
                  </Descriptions.Item>
                  <Descriptions.Item label="Tài xế">
                    <span className="font-semibold text-emerald-700">{selectedBooking.assignedDriver?.fullName} ({selectedBooking.assignedDriver?.phone})</span>
                  </Descriptions.Item>
                </>
              )}
              {selectedBooking.dispatchNotes && (
                <Descriptions.Item label="Ghi chú điều xe" span={2}>
                  <em>{selectedBooking.dispatchNotes}</em>
                </Descriptions.Item>
              )}
            </Descriptions>
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
          <Form.Item name="fullName" label="Họ và tên tài xế" rules={[{ required: true }]}>
            <Input placeholder="Ví dụ: Nguyễn Văn A" />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true }]}>
            <Input placeholder="Số điện thoại di động" />
          </Form.Item>
          <Form.Item name="licenseClass" label="Hạng bằng lái" initialValue="D">
            <Select>
              <Option value="B2">Hạng B2</Option>
              <Option value="C">Hạng C</Option>
              <Option value="D">Hạng D</Option>
              <Option value="E">Hạng E</Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú">
            <Input placeholder="Kinh nghiệm, ca trực..." />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsDriverModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit">Lưu Tài Xế</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default VehicleManagementPage;
