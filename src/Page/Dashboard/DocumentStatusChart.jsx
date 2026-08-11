/* eslint-disable react/prop-types */
import { useState, useEffect, useReducer, useCallback } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { Select, Spin, Row, Col, message, Empty, InputNumber } from 'antd';
import _ from 'lodash';
import { fetchDocumentsStatusStats } from '../../api/statsAPI';
import { getAllUsers } from '../../api/auth';  
import { getAllDocVariants } from '../../api/docVariantApi';

const { Option } = Select;

const modes = [
  { label: "Tháng", value: "month" },
  { label: "Quý", value: "quarter" },
  { label: "Năm", value: "year" },
];

// Cập nhật statusNames để bao gồm tất cả trạng thái từ API
const statusNames = {
  receivedOnTime: 'Đúng hạn',
  receivedSoon: 'Trước hạn',
  receivedLate: 'Trễ hạn',
  receivedPending: 'Đang xử lý',
  receivedUnhandled: 'Chưa xử lý',
};

const currentYear = new Date().getFullYear();

const filterReducer = (state, action) => {
  switch (action.type) {
    case "SET_FILTER":
      if (action.key === 'mode' && (action.value === 'month' || action.value === 'quarter') && !state.year) {
         return { ...state, [action.key]: action.value, year: currentYear };
      }
      if (action.key === 'year' && action.value !== null && action.value !== undefined) {
           return { ...state, year: Number(action.value) };
      }
      return { ...state, [action.key]: action.value };
    case "RESET_FILTERS":
      return {
        mode: "month",
        year: currentYear,
        userId: undefined,
        docVariant: undefined,
      };
    default:
      return state;
  }
};

const DocumentStatusChart = () => {
  const [filters, dispatch] = useReducer(filterReducer, {
    mode: "month",
    year: currentYear,
    userId: undefined,
    docVariant: undefined,
  });

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false); 
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [users, setUsers] = useState([]);
  const [docVariantOptions, setDocVariantOptions] = useState([]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      setLoadingOptions(true);
      try {
        const [usersRes, variantsRes] = await Promise.all([
          getAllUsers(),
          getAllDocVariants()
        ]);
        setUsers(usersRes?.users && Array.isArray(usersRes.users) ? usersRes.users : []);
        setDocVariantOptions(Array.isArray(variantsRes) ? variantsRes : []);
      } catch (error) {
        message.error("Không thể tải các tùy chọn bộ lọc. Vui lòng kiểm tra kết nối hoặc thử lại.");
        console.error("Error fetching filter options:", error);
        setUsers([]); 
        setDocVariantOptions([]);
      } finally {
        setLoadingOptions(false);
      }
    };
    fetchFilterOptions();
  }, []); 

  const fetchData = useCallback(
    _.debounce(async (currentFilters) => {
      if ((currentFilters.mode === 'month' || currentFilters.mode === 'quarter') && !currentFilters.year) {
           message.warning('Vui lòng chọn năm khi xem theo tháng hoặc quý.');
           setData([]); 
           setLoading(false);
           return;
       }
       if (currentFilters.year && (isNaN(currentFilters.year) || currentFilters.year < 1900 || currentFilters.year > currentYear + 10)) {
            message.error(`Năm không hợp lệ (${currentFilters.year}). Vui lòng chọn năm trong khoảng 1900 - ${currentYear + 10}.`);
            setData([]);
            setLoading(false);
            return;
        }

      setLoading(true);
      try {
          const apiFilters = {
              ...currentFilters,
              year: currentFilters.year ? String(currentFilters.year) : undefined,
              userId: currentFilters.userId || undefined,
              docVariant: currentFilters.docVariant || undefined,
              // Không gửi docType vì API chỉ xử lý received
          };

          const result = await fetchDocumentsStatusStats(apiFilters);
          setData(result || []); 
      } catch (error) {
        message.error("Lỗi khi tải dữ liệu biểu đồ trạng thái. Vui lòng thử lại.");
        console.error("Error fetching document status stats from API:", error);
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

  const handleFilterChange = (key, value) => {
     const newValue = value === undefined || value === null ? undefined : value;
     dispatch({ type: "SET_FILTER", key, value: newValue });
  };

  const handleYearChange = (value) => {
       const yearValue = value === null ? undefined : value;
       if (yearValue !== undefined && (isNaN(yearValue) || yearValue < 1900 || yearValue > currentYear + 10)) {
           message.error(`Vui lòng nhập năm hợp lệ (1900 - ${currentYear + 10})`);
           return;
       }
       handleFilterChange("year", yearValue); 
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const labelPrefix = filters.mode === 'month' ? 'Tháng' : filters.mode === 'quarter' ? 'Quý' : 'Năm';
      return (
        <div className="p-2 bg-white border border-gray-300 rounded shadow-md text-xs">
          <p className="font-semibold mb-1">{`${labelPrefix} ${label}`}</p>
          {payload.map((entry) => (
            <p key={entry.dataKey} style={{ color: entry.fill }} className="my-0.5">
              {statusNames[entry.dataKey] || entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props) => {
    const { payload } = props;
    return (
      <ul className="flex flex-wrap justify-center list-none p-0 mt-2">
        {payload.map((entry, index) => (
          <li key={`item-${index}`} className="mx-2 my-1 text-xs cursor-pointer flex items-center" style={{ color: entry.color }}>
            <span
              className="hidden sm:inline-block w-2.5 h-2.5 mr-1.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {statusNames[entry.value] || entry.value} 
          </li>
        ))}
      </ul>
    );
  };

  const xAxisDataKey = filters.mode === 'month' ? 'month' : filters.mode === 'quarter' ? 'quarter' : 'year';
  const xAxisLabel = filters.mode === 'month' ? 'Tháng' : filters.mode === 'quarter' ? 'Quý' : 'Năm';

  const formatXAxisTick = (value) => {
    if (filters.mode === 'month') {
      return `Tháng ${value}`;
    } else if (filters.mode === 'quarter') {
      return `Quý ${value}`;
    }
    return value;
  };

  return (
    <div className="bg-white p-4 md:p-6 rounded-lg shadow">
      <h2 className="text-base md:text-lg font-semibold mb-4 text-gray-700">Biểu đồ trạng thái tài liệu</h2>

      <Row gutter={[12, 12]} className="mb-4 items-center">
        <Col xs={24} sm={12} md={6} lg={4}>
          <Select
            value={filters.mode}
            onChange={(value) => handleFilterChange("mode", value)}
            style={{ width: '100%' }}
          >
            {modes.map((item) => (
              <Option key={item.value} value={item.value}>
                {item.label}
              </Option>
            ))}
          </Select>
        </Col>

        <Col xs={24} sm={12} md={6} lg={4}>
          <InputNumber
            value={filters.year}
            onChange={handleYearChange}
            placeholder="Năm"
            style={{ width: '100%' }}
            min={1900}
            max={currentYear + 10}
          />
        </Col>

        <Col xs={24} sm={12} md={6} lg={5}>
          <Select
            allowClear
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
            }
            loading={loadingOptions}
            value={filters.userId}
            onChange={(value) => handleFilterChange("userId", value)}
            placeholder="Chọn người dùng"
            style={{ width: '100%' }}
          >
            {Array.isArray(users) && users.length > 0 ? (
              users.map((user) => (
                <Option key={user._id} value={user._id}>
                  {user.name || `ID: ${user._id}`}
                </Option>
              ))
            ) : (
              !loadingOptions && <Option disabled value="">Không có người dùng</Option>
            )}
          </Select>
        </Col>

        <Col xs={24} sm={12} md={6} lg={5}>
          <Select
            allowClear
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
            }
            loading={loadingOptions}
            value={filters.docVariant}
            onChange={(value) => handleFilterChange("docVariant", value)}
            placeholder="Chọn loại văn bản"
            style={{ width: '100%' }}
          >
            {Array.isArray(docVariantOptions) && docVariantOptions.length > 0 ? (
              docVariantOptions.map((variant) => (
                <Option key={variant._id} value={variant._id}>
                  {variant.docVariantName || `ID: ${variant._id}`}
                </Option>
              ))
            ) : (
              !loadingOptions && <Option disabled value="">Không có loại văn bản</Option>
            )}
          </Select>
        </Col>
      </Row>

      <div style={{ height: 400 }}>
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Spin tip="Đang tải dữ liệu..." size="large"/>
          </div>
        ) : data.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <Empty description="Không có dữ liệu trạng thái phù hợp" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey={xAxisDataKey}
                tick={{ fontSize: 11 }}
                tickFormatter={formatXAxisTick}
                label={{ value: xAxisLabel, position: 'insideBottom', offset: -15, fontSize: 12, fill: '#666' }}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                label={{ value: 'Số lượng', angle: -90, position: 'insideLeft', offset: 10, fontSize: 12, fill: '#666' }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(206, 219, 234, 0.4)' }}/>
              <Legend content={renderLegend} verticalAlign="bottom" wrapperStyle={{ paddingTop: '10px' }}/>
              <Bar dataKey="receivedOnTime" name={statusNames.receivedOnTime} fill="#2196f3" radius={[3, 3, 0, 0]}/>
              <Bar dataKey="receivedSoon" name={statusNames.receivedSoon} fill="#6ddb4e" radius={[3, 3, 0, 0]}/>
              <Bar dataKey="receivedLate" name={statusNames.receivedLate} fill="#ff4d4f" radius={[3, 3, 0, 0]}/>
              <Bar dataKey="receivedPending" name={statusNames.receivedPending} fill="#ffca28" radius={[3, 3, 0, 0]}/>
              <Bar dataKey="receivedUnhandled" name={statusNames.receivedUnhandled} fill="#757575" radius={[3, 3, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default DocumentStatusChart;