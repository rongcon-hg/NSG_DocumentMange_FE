import { useEffect, useReducer, useCallback, useState } from "react";
import { Select, Spin, Row, Col, message, Empty, InputNumber, Button } from "antd";
import { ReloadOutlined, DashboardOutlined } from "@ant-design/icons";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { fetchDocumentStats } from "../../api/statsAPI"; // API cho DocumentStatsChart
import { getAllUsers } from "../../api/auth";
import { getAllDocVariants } from "../../api/docVariantApi";
import DocumentStatusChart from "./DocumentStatusChart.jsx";
import _ from "lodash";
import dayjs from "dayjs";
import TaskStatsWidget from "./TaskStatsWidget.jsx";
import KpiOverviewWidget from "./KpiOverviewWidget.jsx";

const { Option } = Select;

const modes = [
  { label: "Tháng", value: "month" },
  { label: "Quý", value: "quarter" },
  { label: "Năm", value: "year" },
];

const currentYear = new Date().getFullYear();

const filterReducer = (state, action) => {
  switch (action.type) {
    case "SET_FILTER":
      return { ...state, [action.key]: action.value };
    case "RESET_FILTERS":
      return {
        mode: "month",
        year: currentYear,
        userId: undefined,
        docType: undefined,
        docVariant: undefined,
      };
    default:
      return state;
  }
};

const DocumentStatsChart = () => {
  const [filters, dispatch] = useReducer(filterReducer, {
    mode: "month",
    year: currentYear,
    userId: undefined,
    docType: undefined,
    docVariant: undefined,
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [docVariantOptions, setDocVariantOptions] = useState([]);
  const [users, setUsers] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(dayjs().format("HH:mm:ss DD/MM/YYYY"));

  // Lấy options lọc từ API
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [usersRes, variants] = await Promise.all([getAllUsers(), getAllDocVariants()]);
        setUsers(usersRes.users || []);
        setDocVariantOptions(Array.isArray(variants) ? variants : []);
      } catch (error) {
        message.error("Không thể tải dữ liệu bộ lọc");
        console.error("Lỗi khi lấy filter options:", error);
        setDocVariantOptions([]);
      }
    };
    fetchFilterOptions();
  }, []);

  // Gọi API lấy dữ liệu biểu đồ với debounce
  const fetchData = useCallback(
    _.debounce(async (filters) => {
      setLoading(true);
      try {
        const res = await fetchDocumentStats(filters);
        setData(res || []);
      } catch (error) {
        message.error("Không thể tải dữ liệu biểu đồ");
        console.error("Lỗi khi lấy dữ liệu biểu đồ:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    }, 500),
    []
  );

  useEffect(() => {
    fetchData(filters);
  }, [filters, fetchData, refreshKey]);

  const handleRefreshAll = () => {
    setRefreshing(true);
    setRefreshKey(prev => prev + 1);
    setLastUpdated(dayjs().format("HH:mm:ss DD/MM/YYYY"));
    message.success("Đang làm mới toàn bộ số liệu thống kê...");
    setTimeout(() => {
      setRefreshing(false);
    }, 800);
  };

  // Xử lý thay đổi bộ lọc
  const handleFilterChange = (key, value) => {
    dispatch({ type: "SET_FILTER", key, value });
  };

  // Xử lý nhập năm
  const handleYearChange = (value) => {
    if (value === null || isNaN(value) || value < 1900 || value > currentYear + 10) {
      message.error(`Vui lòng nhập năm hợp lệ (1900 - ${currentYear + 10})`);
      return;
    }
    handleFilterChange("year", value);
  };

  // Xác định dataKey cho XAxis dựa trên mode
  const xAxisDataKey = filters.mode === "month" ? "month" : filters.mode === "quarter" ? "quarter" : "year";

  return (
    <>
      {/* Header Dashboard tổng quan */}
      <div className="bg-white p-4 sm:p-5 rounded-lg shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-800 !mb-0 flex items-center gap-2">
            <DashboardOutlined className="text-blue-600" />
            Bảng Điều Khiển Tổng Quan
          </h1>
          <p className="text-xs text-gray-500 !mb-0 mt-1">
            Tổng hợp dữ liệu công việc, chỉ số đánh giá KPI theo chuẩn Phụ lục 4 và thống kê luồng văn bản
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs text-gray-400 hidden md:inline">
            Cập nhật: <b>{lastUpdated}</b>
          </span>
          <Button 
            type="primary" 
            icon={<ReloadOutlined spin={refreshing} />} 
            onClick={handleRefreshAll}
            className="bg-blue-600 hover:bg-blue-700 font-medium"
          >
            Làm mới tất cả
          </Button>
        </div>
      </div>

      <TaskStatsWidget refreshKey={refreshKey} />
      <KpiOverviewWidget refreshKey={refreshKey} />
      <div className="bg-white p-3 sm:p-6 rounded-lg shadow-md border border-gray-100">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Biểu đồ thống kê tài liệu</h2>

      {/* Form lọc */}
      <Row gutter={[8, 8]} className="mb-3 sm:mb-4">
        <Col xs={24} sm={12} md={6} lg={4}>
          <Select
            value={filters.mode}
            onChange={(value) => handleFilterChange("mode", value)}
            className="w-full"
          >
            {modes.map((item) => (
              <Option key={item.value} value={item.value}>
                {item.label}
              </Option>
            ))}
          </Select>
        </Col>
        <Col xs={24} sm={12} md={6} lg={3}>
          <InputNumber
            value={filters.year}
            onChange={handleYearChange}
            placeholder="Nhập năm"
            className="w-full"
            min={1900}
            max={currentYear + 10}
          />
        </Col>
        <Col xs={24} sm={12} md={6} lg={5}>
          <Select
            allowClear
            value={filters.userId}
            onChange={(value) => handleFilterChange("userId", value)}
            placeholder="Người dùng"
            className="w-full"
          >
            {Array.isArray(users) && users.length > 0 ? (
              users.map((user) => (
                <Option key={user._id} value={user._id}>
                  {user.name || "Không có tên"}
                </Option>
              ))
            ) : (
              <Option disabled value="">
                Không có người dùng
              </Option>
            )}
          </Select>
        </Col>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Select
            allowClear
            value={filters.docType}
            onChange={(value) => handleFilterChange("docType", value)}
            placeholder="Kiểu văn bản"
            className="w-full"
          >
            <Option value="sent">Văn bản đi</Option>
            <Option value="received">Văn bản đến</Option>
          </Select>
        </Col>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Select
            allowClear
            value={filters.docVariant}
            onChange={(value) => handleFilterChange("docVariant", value)}
            placeholder="Loại văn bản"
            className="w-full"
          >
            {Array.isArray(docVariantOptions) && docVariantOptions.length > 0 ? (
              docVariantOptions.map((variant) => (
                <Option key={variant._id} value={variant._id}>
                  {variant.docVariantName || "Không có tên"}
                </Option>
              ))
            ) : (
              <Option disabled value="">
                Không có Loại văn bản
              </Option>
            )}
          </Select>
        </Col>
      </Row>

      {/* Biểu đồ DocumentStatsChart */}
      <h3 className="text-sm sm:text-md font-medium mb-2">Thống kê văn bản đi/đến</h3>
      {loading ? (
        <Spin tip="Đang tải..." />
) : data.length === 0 ? (
        <Empty description="Không có dữ liệu để hiển thị" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <XAxis
              dataKey={xAxisDataKey}
              tickFormatter={(value) =>
                filters.mode === "month"
                  ? `Tháng ${value}`
                  : filters.mode === "quarter"
                  ? `Quý ${value}`
                  : value
              }
            />
            <YAxis />
            <Tooltip
              labelFormatter={(label) =>
                filters.mode === "month"
                  ? `Tháng ${label}`
                  : filters.mode === "quarter"
                  ? `Quý ${label}`
                  : `Năm ${label}`
              }
            />
            <Legend />
            <Bar dataKey="sent" name="Văn bản đi" fill="#4096ff" />
            <Bar dataKey="received" name="Văn bản đến" fill="#ff4d4f" />
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Biểu đồ DocumentStatusChart */}
      <h3 className="text-sm sm:text-md font-medium mb-2 mt-4 sm:mt-6">Thống kê trạng thái tài liệu</h3>
      <DocumentStatusChart
        year={filters.year}
        mode={filters.mode}
        userId={filters.userId}
        docVariant={filters.docVariant}
      />
      </div>
    </>
  );
};

export default DocumentStatsChart;