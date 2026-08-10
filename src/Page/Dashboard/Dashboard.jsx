import { useEffect, useReducer, useCallback, useState } from "react";
import { Select, Spin, Row, Col, message, Empty, InputNumber } from "antd";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { fetchDocumentStats } from "../../api/statsAPI"; // API cho DocumentStatsChart
import { getAllUsers } from "../../api/auth";
import { getAllDocVariants } from "../../api/docVariantApi";
import DocumentStatusChart from "./DocumentStatusChart.jsx";
import _ from "lodash";
import FilterFormWrapper from "../../components/FilterFormWrapper.jsx";
import TaskStatsWidget from "./TaskStatsWidget.jsx";

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
  }, [filters, fetchData]);

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
      <TaskStatsWidget />
      <div className="bg-white p-3 sm:p-6 rounded-lg shadow-md">
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