/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  DatePicker,
  Modal,
  Form,
  message,
  Tooltip,
  Badge,
  Descriptions,
  Popconfirm,
  Row,
  Col,
} from "antd";
import {
  VideoCameraOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  UserOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  DeleteOutlined,
  EditOutlined,
  QrcodeOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import {
  getMeetings,
  createMeeting,
  updateMeeting,
  updateMeetingStatus,
  deleteMeeting,
} from "../../api/meetingApi";
import { getAllUsers } from "../../api/auth";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { categorizeUsers } from "../../utils/userClassification";
import { removeVietnameseTones } from "../../utils/stringUtils";

const { Option } = Select;
const { RangePicker } = DatePicker;

const MEETING_TYPE_LABELS = {
  INTERNAL: { label: "Nội bộ", color: "blue" },
  BGH: { label: "Họp Ban Giám Hiệu", color: "purple" },
  STAFF: { label: "Hội đồng Sư phạm", color: "green" },
  ACADEMIC: { label: "Họp Chuyên môn", color: "cyan" },
  PARTY: { label: "Họp Chi bộ / Đảng", color: "red" },
  UNION: { label: "Công đoàn / Đoàn thể", color: "orange" },
  OTHER: { label: "Khác", color: "default" },
};

const STATUS_LABELS = {
  PREPARING: { label: "Chuẩn bị", color: "default" },
  IN_PROGRESS: { label: "Đang diễn ra", color: "processing" },
  CONCLUDED: { label: "Đã kết luận", color: "success" },
  CANCELLED: { label: "Đã hủy", color: "error" },
};

const PaperlessMeetingListPage = () => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Search & Filter
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedType, setSelectedType] = useState(null);

  // User State
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [form] = Form.useForm();

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
    fetchMeetings();
    fetchUsersAndDepartments();
  }, []);

  const fetchUsersAndDepartments = async () => {
    try {
      const [usersRes, deptsRes] = await Promise.all([
        getAllUsers(),
        getAllDepartments(),
      ]);
      setUsers(usersRes?.users || usersRes?.data || []);
      const deptList =
        deptsRes?.AllDepartment || deptsRes?.departments || deptsRes?.data || [];
      setDepartments(deptList);
    } catch (err) {
      console.error("Lỗi nạp người dùng / phòng ban:", err);
    }
  };

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchKeyword) params.search = searchKeyword;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedType) params.type = selectedType;

      const res = await getMeetings(params);
      if (res && res.success) {
        setMeetings(res.data || []);
      }
    } catch (error) {
      console.error("Lỗi fetchMeetings:", error);
      message.error("Không thể tải danh sách cuộc họp");
    } finally {
      setLoading(false);
    }
  };

  const userGroups = useMemo(() => categorizeUsers(users), [users]);
  const attendeesWatch = Form.useWatch("attendees", form) || [];

  const handleToggleGroupAttendees = (groupKey) => {
    const current = form.getFieldValue("attendees") || [];
    let targetIds = [];

    if (groupKey === "allUsers") {
      targetIds = (users || []).map((u) => u._id);
    } else {
      const group = userGroups.find((g) => g.key === groupKey);
      if (group && group.users) {
        targetIds = group.users.map((u) => u._id);
      }
    }

    if (targetIds.length === 0) return;

    const allSelected = targetIds.every((id) => current.includes(id));
    let updated;
    if (allSelected) {
      updated = current.filter((id) => !targetIds.includes(id));
    } else {
      updated = Array.from(new Set([...current, ...targetIds]));
    }
    form.setFieldsValue({ attendees: updated });
  };

  const isGroupFullySelectedAttendees = (groupKey) => {
    const current = attendeesWatch || [];
    let targetIds = [];
    if (groupKey === "allUsers") {
      targetIds = (users || []).map((u) => u._id);
    } else {
      const group = userGroups.find((g) => g.key === groupKey);
      if (group && group.users) {
        targetIds = group.users.map((u) => u._id);
      }
    }
    return targetIds.length > 0 && targetIds.every((id) => current.includes(id));
  };

  const handleAttendeesChange = (selectedValues) => {
    let updated = [...(selectedValues || [])];
    let hasSpecial = false;

    if (updated.includes("SPECIAL|ALL_USERS")) {
      hasSpecial = true;
      const allUserIds = (users || []).map((u) => u._id);
      updated = Array.from(new Set([...updated.filter((v) => v !== "SPECIAL|ALL_USERS"), ...allUserIds]));
    }

    for (const group of userGroups) {
      const specialKey = `SPECIAL|GROUP_${group.key}`;
      if (updated.includes(specialKey)) {
        hasSpecial = true;
        const groupUserIds = group.users.map((u) => u._id);
        updated = Array.from(new Set([...updated.filter((v) => v !== specialKey), ...groupUserIds]));
      }
    }

    if (hasSpecial) {
      form.setFieldsValue({ attendees: updated });
    }
  };

  const handleCreateMeeting = async (values) => {
    try {
      const [start, end] = values.timeRange || [];
      if (!start || !end) {
        message.warning("Vui lòng chọn thời gian bắt đầu và kết thúc cuộc họp!");
        return;
      }

      const payload = {
        title: values.title,
        meetingType: values.meetingType,
        location: values.location,
        roomType: values.roomType,
        onlineMeetingUrl: values.onlineMeetingUrl,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        host: values.host,
        secretary: values.secretary,
        department: values.department,
        attendees: values.attendees || [],
      };

      const res = await createMeeting(payload);
      if (res && res.success) {
        message.success("Tạo cuộc họp không giấy tờ thành công!");
        setIsCreateModalOpen(false);
        form.resetFields();
        fetchMeetings();
      }
    } catch (error) {
      console.error("Lỗi createMeeting:", error);
      message.error(error.response?.data?.message || "Lỗi tạo phiên họp");
    }
  };

  const handleUpdateStatus = async (meetingId, newStatus) => {
    try {
      const res = await updateMeetingStatus(meetingId, newStatus);
      if (res && res.success) {
        message.success(`Đã cập nhật trạng thái cuộc họp!`);
        fetchMeetings();
      }
    } catch (error) {
      console.error("Lỗi updateMeetingStatus:", error);
      message.error("Không thể cập nhật trạng thái");
    }
  };

  const handleDeleteMeeting = async (id) => {
    try {
      const res = await deleteMeeting(id);
      if (res && res.success) {
        message.success("Đã xóa cuộc họp thành công!");
        fetchMeetings();
      }
    } catch (error) {
      console.error("Lỗi deleteMeeting:", error);
      message.error(error.response?.data?.message || "Không thể xóa cuộc họp");
    }
  };

  const columns = [
    {
      title: "Mã phiên",
      dataIndex: "meetingCode",
      key: "meetingCode",
      width: 120,
      render: (code) => <span className="font-bold text-blue-600">{code}</span>,
    },
    {
      title: "Tiêu đề cuộc họp",
      dataIndex: "title",
      key: "title",
      render: (title, record) => (
        <div>
          <div className="font-semibold text-slate-800 text-sm hover:text-blue-600 cursor-pointer" onClick={() => {
            navigate(`/meetings/${record._id}`);
          }}>
            {title}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
            <Tag color={MEETING_TYPE_LABELS[record.meetingType]?.color || "default"}>
              {MEETING_TYPE_LABELS[record.meetingType]?.label || record.meetingType}
            </Tag>
            <span><EnvironmentOutlined /> {record.location}</span>
          </div>
        </div>
      ),
    },
    {
      title: "Thời gian",
      key: "time",
      width: 170,
      render: (_, record) => (
        <div className="text-xs text-slate-700">
          <div className="font-medium text-slate-800">
            <CalendarOutlined className="mr-1 text-blue-500" />
            {dayjs(record.startTime).format("DD/MM/YYYY")}
          </div>
          <div className="text-slate-500 mt-0.5">
            <ClockCircleOutlined className="mr-1" />
            {dayjs(record.startTime).format("HH:mm")} - {dayjs(record.endTime).format("HH:mm")}
          </div>
        </div>
      ),
    },
    {
      title: "Chủ tọa / Thư ký",
      key: "roles",
      width: 180,
      render: (_, record) => (
        <div className="text-xs space-y-0.5">
          <div>
            <span className="text-slate-400">Chủ tọa:</span>{" "}
            <span className="font-semibold text-slate-700">{record.host?.name || record.hostName || "N/A"}</span>
          </div>
          {record.secretary && (
            <div>
              <span className="text-slate-400">Thư ký:</span>{" "}
              <span className="text-slate-600">{record.secretary?.name || record.secretaryName}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Đại biểu",
      dataIndex: "attendees",
      key: "attendees",
      width: 100,
      align: "center",
      render: (attendees) => {
        const total = attendees?.length || 0;
        const attended = attendees?.filter((a) => a.attendanceStatus === "ATTENDED").length || 0;
        return (
          <Tooltip title={`Có mặt: ${attended} / ${total} đại biểu`}>
            <Tag color={attended > 0 ? "cyan" : "default"}>
              <TeamOutlined className="mr-1" />
              {attended}/{total}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      align: "center",
      render: (st) => (
        <Tag color={STATUS_LABELS[st]?.color || "default"}>
          {STATUS_LABELS[st]?.label || st}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 130,
      align: "center",
      fixed: "right",
      render: (_, record) => {
        const isPrivileged = ["admin", "manager"].includes(currentUserRole) || record.createdBy === currentUserId || record.host?._id === currentUserId;
        return (
          <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-[105px] mx-auto">
            <Tooltip title="Vào phòng họp số">
              <Button
                type="primary"
                size="small"
                icon={<EyeOutlined />}
                className="bg-blue-600 hover:bg-blue-500 w-7 h-7 flex items-center justify-center p-0"
                onClick={() => {
                  navigate(`/meetings/${record._id}`);
                }}
              />
            </Tooltip>
            <Tooltip title="Xem chi tiết phiên họp">
              <Button
                type="default"
                size="small"
                icon={<FileTextOutlined />}
                className="w-7 h-7 flex items-center justify-center p-0"
                onClick={() => {
                  setSelectedMeeting(record);
                  setIsDetailModalOpen(true);
                }}
              />
            </Tooltip>
            {isPrivileged && record.status === "PREPARING" && (
              <Tooltip title="Bắt đầu phiên họp">
                <Button
                  type="default"
                  size="small"
                  icon={<PlayCircleOutlined className="text-emerald-600" />}
                  className="w-7 h-7 flex items-center justify-center p-0"
                  onClick={() => handleUpdateStatus(record._id, "IN_PROGRESS")}
                />
              </Tooltip>
            )}
            {isPrivileged && record.status === "IN_PROGRESS" && (
              <Tooltip title="Bế mạc / Kết luận phiên họp">
                <Button
                  type="default"
                  size="small"
                  icon={<CheckCircleOutlined className="text-blue-600" />}
                  className="w-7 h-7 flex items-center justify-center p-0"
                  onClick={() => handleUpdateStatus(record._id, "CONCLUDED")}
                />
              </Tooltip>
            )}
            {isPrivileged && (record.status === "PREPARING" || currentUserRole === "admin") && (
              <Popconfirm
                title="Xóa phiên họp?"
                description="Bạn chắc chắn muốn hủy và xóa cuộc họp này?"
                onConfirm={() => handleDeleteMeeting(record._id)}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined />} className="w-7 h-7 flex items-center justify-center p-0" />
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 m-0">
              <VideoCameraOutlined className="text-blue-600" />
              Phòng Họp Không Giấy Tờ (e-Cabinet)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-0">
              Điều hành phiên họp thông minh, tài liệu số hóa, điểm danh tự động và biểu quyết điện tử thời gian thực
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button icon={<ReloadOutlined />} onClick={fetchMeetings}>
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="bg-blue-600 hover:bg-blue-500"
              onClick={() => {
                form.resetFields();
                setIsCreateModalOpen(true);
              }}
            >
              Tạo phiên họp mới
            </Button>
          </div>
        </div>

        {/* Bộ lọc tìm kiếm */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 mb-4">
          <Input
            placeholder="Tìm theo tiêu đề, mã hoặc địa điểm..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={fetchMeetings}
            className="w-full sm:w-72"
            allowClear
          />
          <Select
            placeholder="Loại cuộc họp"
            value={selectedType}
            onChange={(val) => setSelectedType(val)}
            allowClear
            className="w-full sm:w-48"
          >
            {Object.keys(MEETING_TYPE_LABELS).map((k) => (
              <Option key={k} value={k}>
                {MEETING_TYPE_LABELS[k].label}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="Trạng thái"
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val)}
            allowClear
            className="w-full sm:w-44"
          >
            {Object.keys(STATUS_LABELS).map((k) => (
              <Option key={k} value={k}>
                {STATUS_LABELS[k].label}
              </Option>
            ))}
          </Select>
          <Button type="primary" ghost onClick={fetchMeetings}>
            Tìm kiếm
          </Button>
        </div>

        {/* Table danh sách cuộc họp */}
        <Table
          columns={columns}
          dataSource={meetings}
          rowKey="_id"
          loading={loading}
          bordered
          size="small"
          scroll={{ x: 960 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} cuộc họp`,
          }}
        />
      </Card>

      {/* Modal Tạo phiên họp mới */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-slate-800 text-lg">
            <VideoCameraOutlined className="text-blue-600" />
            Thiết Lập Phiên Họp Không Giấy Tờ Mới
          </div>
        }
        open={isCreateModalOpen}
        onCancel={() => setIsCreateModalOpen(false)}
        onOk={() => form.submit()}
        okText="Tạo cuộc họp"
        cancelText="Hủy"
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateMeeting} className="mt-4">
          <Form.Item
            name="title"
            label="Tiêu đề / Nội dung phiên họp"
            rules={[{ required: true, message: "Vui lòng nhập tiêu đề phiên họp" }]}
          >
            <Input placeholder="Ví dụ: Họp Giao ban Ban Giám Hiệu Quý IV..." />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="meetingType"
                label="Loại cuộc họp"
                initialValue="INTERNAL"
                rules={[{ required: true }]}
              >
                <Select>
                  {Object.keys(MEETING_TYPE_LABELS).map((k) => (
                    <Option key={k} value={k}>
                      {MEETING_TYPE_LABELS[k].label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="timeRange"
                label="Thời gian bắt đầu - kết thúc"
                rules={[{ required: true, message: "Chọn thời gian họp" }]}
              >
                <RangePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="location"
                label="Địa điểm / Phòng họp"
                initialValue="Phòng họp số 1 - Nhà A"
                rules={[{ required: true }]}
              >
                <Input placeholder="Phòng họp số 1" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="roomType" label="Hình thức tổ chức" initialValue="PHYSICAL">
                <Select>
                  <Option value="PHYSICAL">Họp trực tiếp tại hội trường</Option>
                  <Option value="HYBRID">Kết hợp trực tiếp & Trực tuyến</Option>
                  <Option value="ONLINE">Họp trực tuyến 100%</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.roomType !== currentValues.roomType}
          >
            {({ getFieldValue }) =>
              ["ONLINE", "HYBRID"].includes(getFieldValue("roomType")) ? (
                <Form.Item
                  name="onlineMeetingUrl"
                  label="Đường dẫn họp trực tuyến (Google Meet, Zoom, MS Teams...)"
                  rules={[{ required: true, message: "Vui lòng nhập đường dẫn họp trực tuyến!" }]}
                >
                  <Input placeholder="https://meet.google.com/xyz-abcd-efg hoặc link Zoom..." />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="host"
                label="Chủ tọa cuộc họp"
                rules={[{ required: true, message: "Vui lòng chọn Chủ tọa" }]}
              >
                <Select
                  showSearch
                  placeholder="Chọn người chủ tọa (BGH, Cấp trưởng, Manager...)"
                  optionFilterProp="label"
                  optionLabelProp="label"
                  filterOption={(input, option) => {
                    if (!input) return true;
                    const search = removeVietnameseTones(input.toLowerCase().trim());
                    const label = removeVietnameseTones(String(option?.label || "").toLowerCase());
                    return label.includes(search);
                  }}
                >
                  {userGroups.map((group) => (
                    <Select.OptGroup key={group.key} label={group.label}>
                      {group.users.map((u) => {
                        const posStr = u.position?.positionName ? ` - ${u.position.positionName}` : "";
                        const deptStr = u.department?.departmentName ? ` (${u.department.departmentName})` : "";
                        const labelStr = `${u.name || "Người dùng"}${posStr}${deptStr}`;
                        return (
                          <Option key={u._id} value={u._id} label={labelStr}>
                            {labelStr}
                          </Option>
                        );
                      })}
                    </Select.OptGroup>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="secretary" label="Thư ký ghi biên bản">
                <Select
                  showSearch
                  allowClear
                  placeholder="Chọn thư ký cuộc họp"
                  optionFilterProp="label"
                  optionLabelProp="label"
                  filterOption={(input, option) => {
                    if (!input) return true;
                    const search = removeVietnameseTones(input.toLowerCase().trim());
                    const label = removeVietnameseTones(String(option?.label || "").toLowerCase());
                    return label.includes(search);
                  }}
                >
                  {userGroups.map((group) => (
                    <Select.OptGroup key={group.key} label={group.label}>
                      {group.users.map((u) => {
                        const posStr = u.position?.positionName ? ` - ${u.position.positionName}` : "";
                        const deptStr = u.department?.departmentName ? ` (${u.department.departmentName})` : "";
                        const labelStr = `${u.name || "Người dùng"}${posStr}${deptStr}`;
                        return (
                          <Option key={u._id} value={u._id} label={labelStr}>
                            {labelStr}
                          </Option>
                        );
                      })}
                    </Select.OptGroup>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="attendees"
            label="Thành phần đại biểu tham gia"
            rules={[{ required: true, message: "Vui lòng chọn đại biểu tham gia phiên họp!" }]}
          >
            <Select
              mode="multiple"
              placeholder="Chọn đại biểu tham dự (hoặc nhấp các nút chọn nhanh theo nhóm ở trên)"
              allowClear
              showSearch
              onChange={handleAttendeesChange}
              optionFilterProp="label"
              optionLabelProp="label"
              filterOption={(input, option) => {
                if (!input) return true;
                const search = removeVietnameseTones(input.toLowerCase().trim());
                const label = removeVietnameseTones(String(option?.label || "").toLowerCase());
                return label.includes(search);
              }}
              dropdownRender={(menu) => (
                <div>
                  <div className="p-2 border-b border-gray-200 bg-slate-50 flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs font-bold text-gray-600 mr-1">⚡ Chọn nhanh:</span>
                    <Button
                      size="small"
                      type={isGroupFullySelectedAttendees("bgh") ? "primary" : "dashed"}
                      className="!text-[11px] !h-6 !px-2"
                      onClick={() => handleToggleGroupAttendees("bgh")}
                    >
                      {isGroupFullySelectedAttendees("bgh") ? "✓ BGH" : "+ BGH"}
                    </Button>
                    <Button
                      size="small"
                      type={isGroupFullySelectedAttendees("capTruong") ? "primary" : "dashed"}
                      className="!text-[11px] !h-6 !px-2"
                      onClick={() => handleToggleGroupAttendees("capTruong")}
                    >
                      {isGroupFullySelectedAttendees("capTruong") ? "✓ Cấp trưởng" : "+ Cấp trưởng"}
                    </Button>
                    <Button
                      size="small"
                      type={isGroupFullySelectedAttendees("capPho") ? "primary" : "dashed"}
                      className="!text-[11px] !h-6 !px-2"
                      onClick={() => handleToggleGroupAttendees("capPho")}
                    >
                      {isGroupFullySelectedAttendees("capPho") ? "✓ Cấp phó" : "+ Cấp phó"}
                    </Button>
                    <Button
                      size="small"
                      type={isGroupFullySelectedAttendees("chuyenVien") ? "primary" : "dashed"}
                      className="!text-[11px] !h-6 !px-2"
                      onClick={() => handleToggleGroupAttendees("chuyenVien")}
                    >
                      {isGroupFullySelectedAttendees("chuyenVien") ? "✓ GV-CV" : "+ GV-CV"}
                    </Button>
                    <Button
                      size="small"
                      type={isGroupFullySelectedAttendees("manager") ? "primary" : "dashed"}
                      className="!text-[11px] !h-6 !px-2"
                      onClick={() => handleToggleGroupAttendees("manager")}
                    >
                      {isGroupFullySelectedAttendees("manager") ? "✓ Manager" : "+ Manager"}
                    </Button>
                    <Button
                      size="small"
                      type={isGroupFullySelectedAttendees("allUsers") ? "primary" : "dashed"}
                      className="!text-[11px] !h-6 !px-2 text-emerald-700"
                      onClick={() => handleToggleGroupAttendees("allUsers")}
                    >
                      {isGroupFullySelectedAttendees("allUsers") ? "✓ Toàn bộ người dùng" : "+ Toàn bộ người dùng"}
                    </Button>
                  </div>
                  {menu}
                </div>
              )}
            >
              {userGroups.map((group) => (
                <Select.OptGroup key={group.key} label={group.label}>
                  <Option
                    key={`SPECIAL|GROUP_${group.key}`}
                    value={`SPECIAL|GROUP_${group.key}`}
                    label={`Chọn tất cả ${group.label}`}
                    className="font-semibold text-blue-600 bg-blue-50/40"
                  >
                    ⚡ [Chọn tất cả {group.label}]
                  </Option>
                  {group.users.map((u) => {
                    const posStr = u.position?.positionName ? ` - ${u.position.positionName}` : "";
                    const deptStr = u.department?.departmentName ? ` (${u.department.departmentName})` : "";
                    const labelStr = `${u.name || "Người dùng"}${posStr}${deptStr}`;
                    return (
                      <Option key={u._id} value={u._id} label={labelStr}>
                        {labelStr}
                      </Option>
                    );
                  })}
                </Select.OptGroup>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Xem chi tiết phiên họp */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-slate-800 text-lg">
            <CalendarOutlined className="text-blue-600" />
            Thông Tin Phiên Họp: {selectedMeeting?.meetingCode}
          </div>
        }
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsDetailModalOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="enter"
            type="primary"
            icon={<EyeOutlined />}
            className="bg-blue-600 hover:bg-blue-500"
            onClick={() => {
              setIsDetailModalOpen(false);
              navigate(`/meetings/${selectedMeeting?._id}`);
            }}
          >
            Vào phòng họp ngay
          </Button>,
        ]}
        width={760}
      >
        {selectedMeeting && (
          <div className="space-y-4 mt-2">
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Tiêu đề" span={2}>
                <span className="font-semibold text-slate-800">{selectedMeeting.title}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Mã phiên">{selectedMeeting.meetingCode}</Descriptions.Item>
              <Descriptions.Item label="Mã PIN">{selectedMeeting.pinCode || "Không có"}</Descriptions.Item>
              <Descriptions.Item label="Hình thức">
                {selectedMeeting.roomType === "PHYSICAL" ? "Trực tiếp" : selectedMeeting.roomType === "ONLINE" ? "Trực tuyến" : "Kết hợp (Hybrid)"}
              </Descriptions.Item>
              <Descriptions.Item label="Địa điểm">{selectedMeeting.location}</Descriptions.Item>
              <Descriptions.Item label="Thời gian" span={2}>
                {dayjs(selectedMeeting.startTime).format("HH:mm DD/MM/YYYY")} - {dayjs(selectedMeeting.endTime).format("HH:mm DD/MM/YYYY")}
              </Descriptions.Item>
              <Descriptions.Item label="Chủ tọa">{selectedMeeting.host?.name || selectedMeeting.hostName}</Descriptions.Item>
              <Descriptions.Item label="Thư ký">{selectedMeeting.secretary?.name || selectedMeeting.secretaryName || "Chưa phân công"}</Descriptions.Item>
            </Descriptions>

            <div className="mt-4">
              <div className="font-semibold text-slate-800 text-sm mb-2 flex items-center justify-between">
                <span>Danh sách đại biểu tham dự ({selectedMeeting.attendees?.length || 0})</span>
              </div>
              <Table
                dataSource={selectedMeeting.attendees || []}
                rowKey={(r) => r.user?._id || r.user || r._id}
                size="small"
                pagination={false}
                bordered
                columns={[
                  { title: "STT", render: (_, __, i) => i + 1, width: 50, align: "center" },
                  { title: "Họ và tên", dataIndex: "name", render: (n, r) => n || r.user?.name || "Đại biểu" },
                  { title: "Vai trò", dataIndex: "roleInMeeting", width: 120, render: (r) => <Tag color={r === "HOST" ? "red" : r === "SECRETARY" ? "blue" : "default"}>{r}</Tag> },
                  {
                    title: "Điểm danh",
                    dataIndex: "attendanceStatus",
                    width: 120,
                    align: "center",
                    render: (st) => (
                      <Tag color={st === "ATTENDED" ? "green" : "default"}>
                        {st === "ATTENDED" ? "Có mặt" : "Chưa có mặt"}
                      </Tag>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PaperlessMeetingListPage;
