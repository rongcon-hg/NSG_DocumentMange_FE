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
  Table,
  Tag,
  Typography,
  message,
  Popconfirm,
  Alert,
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
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { getAllUsers, getUserInfo } from "../../api/auth";
import { getAllDepartments } from "../../api/DepartmentAPI";
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

const TrainingRegisterPage = () => {
  const navigate = useNavigate();
  const { userId, userRole, refetchNotificationCounts } = useNotificationContext();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [currentUserData, setCurrentUserData] = useState(null);

  // Bộ lọc thông tin chung
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedDeptId, setSelectedDeptId] = useState(null);

  // Danh sách dòng đăng ký
  const [rows, setRows] = useState([
    {
      key: Date.now(),
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

  const isAdmin = userRole === "admin" || userRole === "manager";

  // 1. Tải thông tin người dùng hiện tại và danh mục
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const [usersRes, deptsRes] = await Promise.all([
          getAllUsers(),
          getAllDepartments(),
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

        if (userId) {
          const userRes = await getUserInfo(userId);
          const userData = userRes?.data || userRes?.user;
          if (userData) {
            setCurrentUserData(userData);
            const userDeptId = userData.department?._id || userData.department;
            setSelectedDeptId(userDeptId ? userDeptId.toString() : null);
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

  // 2. Lọc danh sách nhân sự khả dụng theo đơn vị đã chọn (hoặc tất cả nếu là admin)
  const availableUsers = useMemo(() => {
    if (!selectedDeptId) {
      return isAdmin ? allUsers : [];
    }
    return allUsers.filter((u) => {
      const uDeptId = u.department?._id || u.department;
      return uDeptId && uDeptId.toString() === selectedDeptId.toString();
    });
  }, [allUsers, selectedDeptId, isAdmin]);

  // 3. Thêm dòng đăng ký mới
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: Date.now() + Math.random(),
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

        // Nếu thay đổi nhân sự -> Tự động điền Họ tên và Chức danh
        if (field === "userId") {
          const matched = allUsers.find((u) => u._id === value);
          if (matched) {
            updated.userName = matched.name || "";
            updated.positionName =
              matched.position?.positionName || matched.positionName || "";
          } else {
            updated.userName = "";
            updated.positionName = "";
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

  // 7. Gửi đăng ký
  const handleSubmit = async () => {
    // Validate
    if (rows.length === 0) {
      message.error("Vui lòng thêm ít nhất một nhân sự đăng ký bồi dưỡng.");
      return;
    }

    const currentDept = departments.find(
      (d) => d._id?.toString() === selectedDeptId?.toString()
    );

    const itemsToSubmit = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.userId) {
        message.error(`Dòng ${i + 1}: Vui lòng chọn nhân sự bồi dưỡng.`);
        return;
      }
      if (!r.trainingContent.trim()) {
        message.error(`Dòng ${i + 1}: Vui lòng nhập nội dung học tập bồi dưỡng.`);
        return;
      }

      itemsToSubmit.push({
        user: r.userId,
        userName: r.userName,
        department: selectedDeptId,
        departmentName: currentDept?.departmentName || currentUserData?.departmentName || "",
        positionName: r.positionName,
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

  const currentDeptObj = departments.find(
    (d) => d._id?.toString() === selectedDeptId?.toString()
  );

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4">
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
              Lập kế hoạch đào tạo, bồi dưỡng chuyên môn nghiệp vụ hàng năm cho cán bộ, giảng viên, nhân viên
            </p>
          </div>
          <Button
            type="default"
            icon={<UnorderedListOutlined />}
            onClick={() => navigate("/training/list")}
            className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs sm:text-sm h-9"
          >
            Xem danh sách đề nghị
          </Button>
        </div>
      </div>

      {/* Thông tin đơn vị & Người lập */}
      <Card className="shadow-xs border-slate-200">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
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

          <Col xs={24} sm={12} md={8}>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 block">
                Đơn vị / Khoa / Phòng ban:
              </label>
              {isAdmin ? (
                <Select
                  value={selectedDeptId}
                  onChange={setSelectedDeptId}
                  placeholder="Chọn đơn vị"
                  className="w-full"
                  showSearch
                  optionFilterProp="children"
                >
                  {departments.map((d) => (
                    <Option key={d._id} value={d._id}>
                      {d.departmentName}
                    </Option>
                  ))}
                </Select>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm font-medium text-slate-800">
                  {currentDeptObj?.departmentName || currentUserData?.departmentName || "Đơn vị trực thuộc"}
                </div>
              )}
            </div>
          </Col>

          <Col xs={24} sm={24} md={8}>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 block">
                Người lập danh sách:
              </label>
              <div className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm text-slate-700 flex items-center justify-between">
                <span className="font-medium text-blue-700">
                  <UserOutlined className="mr-1.5" />
                  {currentUserData?.name || "Người dùng"}
                </span>
                <Tag color="blue" className="m-0 text-xs">
                  {userRole?.toUpperCase()}
                </Tag>
              </div>
            </div>
          </Col>
        </Row>
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
                    {row.userName ? `${row.userName} - ${row.positionName || "Chức danh"}` : "Chưa chọn nhân sự"}
                  </span>
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
                {/* Chọn nhân sự */}
                <Col xs={24} sm={12} md={6}>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">
                    Nhân sự bồi dưỡng <span className="text-red-500">*</span>
                  </label>
                  <Select
                    showSearch
                    placeholder="Chọn nhân sự"
                    value={row.userId}
                    onChange={(val) => handleUpdateRow(row.key, "userId", val)}
                    className="w-full"
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                      (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                    }
                    options={availableUsers.map((u) => ({
                      value: u._id,
                      label: `${u.name} (${u.email || u.position?.positionName || "Thành viên"})`,
                    }))}
                  />
                </Col>

                {/* Nội dung bồi dưỡng */}
                <Col xs={24} sm={12} md={10}>
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

                {/* Hình thức đào tạo */}
                <Col xs={24} sm={12} md={4}>
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

                {/* Kinh phí dự kiến */}
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

                {/* Nơi đào tạo */}
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

                {/* Thời gian đào tạo (Từ ngày - Đến ngày) */}
                <Col xs={24} sm={12} md={8}>
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

                {/* Ghi chú */}
                <Col xs={24} sm={24} md={8}>
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
