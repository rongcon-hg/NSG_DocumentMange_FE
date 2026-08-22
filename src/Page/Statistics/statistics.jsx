import { useState, useEffect, useCallback } from 'react';
import { Table, Spin, message, InputNumber, Row, Col, DatePicker, Button, Select, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import axiosInstance from '../../api/axiosInstance';
import { getAllDocVariants } from "../../api/docVariantApi";
import { getAllUsers } from "../../api/auth";
import dayjs from 'dayjs';
import FilterFormWrapper from "../../components/FilterFormWrapper.jsx";
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';

const { RangePicker } = DatePicker;
const { Option } = Select;

const UserStatisticsTable = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [docVariants, setDocVariants] = useState([]);
  const [users, setUsers] = useState([]);
  // Mặc định lấy 30 ngày gần nhất
  const defaultFromDate = dayjs().subtract(30, 'day');
  const defaultToDate = dayjs();

  const [filters, setFilters] = useState({
    year: dayjs().year(),
    fromDate: defaultFromDate,
    toDate: defaultToDate,
    userId: null,
    docVariantId: null,
  });
  // Filters actually applied to queries
  const [appliedFilters, setAppliedFilters] = useState({
    year: dayjs().year(),
    fromDate: defaultFromDate,
    toDate: defaultToDate,
    userId: null,
    docVariantId: null,
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [currentRole, setCurrentRole] = useState('');

  const fetchData = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const params = {
        year: appliedFilters.year,
        docVariantId: appliedFilters.docVariantId,
        fromDate: appliedFilters.fromDate ? dayjs(appliedFilters.fromDate).format('YYYY-MM-DD') : null,
        toDate: appliedFilters.toDate ? dayjs(appliedFilters.toDate).format('YYYY-MM-DD') : null,
        userId: appliedFilters.userId,
      };
      const response = await axiosInstance.get('/statistics', {
        params: { ...params, page, limit: pageSize },
      });
      setData(response.data);
      setPagination(prev => ({ ...prev, total: response.data.length, current: page }));
    } catch (error) {
      message.error('Lỗi khi tải dữ liệu thống kê: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  const fetchDocVariants = async () => {
    try {
      const result = await getAllDocVariants();
      setDocVariants(result || []);
    } catch (error) {
      message.error("Lỗi khi tải danh sách loại văn bản!");
      console.error("Error fetching doc variants:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await getAllUsers();
      const filteredUsers = (response.users || []).filter(u => ['manager', 'staff', 'cappho', 'chuyenvien'].includes(u.role));
      setUsers(filteredUsers);
    } catch (error) {
      message.error("Lỗi khi tải danh sách người dùng!");
      console.error("Error fetching users:", error);
    }
  };

  const handleExportExcel = async () => {
    try {
      setLoading(true);
      const params = {
        year: appliedFilters.year,
        docVariantId: appliedFilters.docVariantId,
        fromDate: appliedFilters.fromDate ? dayjs(appliedFilters.fromDate).format('YYYY-MM-DD') : null,
        toDate: appliedFilters.toDate ? dayjs(appliedFilters.toDate).format('YYYY-MM-DD') : null,
        userId: appliedFilters.userId,
      };

      const response = await axiosInstance.get('/exports/userStatistics', {
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `thongke-${dayjs().format("YYYY-MM-DD")}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('Xuất file Excel thành công!');
    } catch (error) {
      message.error('Lỗi khi xuất file Excel: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocVariants();
    fetchUsers();
    // Decode role for permission checks
    const token = Cookies.get('accessToken');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentRole(decoded?.role || '');
      } catch {
        setCurrentRole('');
      }
    }
  }, []);

  // Fetch data when pagination or applied filters change
  useEffect(() => {
    fetchData(pagination.current, pagination.pageSize);
  }, [pagination.current, pagination.pageSize, fetchData]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleDateRangeChange = (dates) => {
    handleFilterChange('fromDate', dates ? dates[0] : null);
    handleFilterChange('toDate', dates ? dates[1] : null);
  };

  const handleTableChange = (pagination) => {
    setPagination(pagination);
  };

  const handleSearch = () => {
    setAppliedFilters({ ...filters });
    // Reset to first page then fetch
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchData(1, pagination.pageSize);
  };

  const handleReset = () => {
    const resetFromDate = dayjs().subtract(30, 'day');
    const resetToDate = dayjs();
    setFilters({
      year: dayjs().year(),
      fromDate: resetFromDate,
      toDate: resetToDate,
      userId: null,
      docVariantId: null,
    });
    setAppliedFilters({
      year: dayjs().year(),
      fromDate: resetFromDate,
      toDate: resetToDate,
      userId: null,
      docVariantId: null,
    });
    setPagination(prev => ({ ...prev, current: 1 }));
    fetchData(1, pagination.pageSize);
  };

  const columns = [
    { title: 'STT', key: 'stt', width: 60, render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1 },
    {
      title: 'Người nhận',
      dataIndex: 'userName',
      key: 'userName',
      width: 200,
      sorter: (a, b) => a.userName.localeCompare(b.userName),
    },
    {
      title: 'Văn bản đến',
      dataIndex: 'totalReceived',
      key: 'totalReceived',
      width: 120,
      sorter: (a, b) => a.totalReceived - b.totalReceived,
    },
    {
      title: 'Văn bản đi',
      dataIndex: 'totalSent',
      key: 'totalSent',
      width: 120,
      sorter: (a, b) => a.totalSent - b.totalSent,
    },
    {
      title: 'Văn bản trình ký',
      dataIndex: 'totalReplied',
      key: 'totalReplied',
      width: 120,
      sorter: (a, b) => a.totalReplied - b.totalReplied,
    },
    {
      title: 'Văn bản chưa xem',
      dataIndex: 'totalUnread',
      key: 'totalUnread',
      width: 120,
      sorter: (a, b) => a.totalUnread - b.totalUnread,
    },
    {
      title: 'Văn bản đúng hạn',
      dataIndex: 'onTimeCount',
      key: 'onTimeCount',
      width: 120,
      sorter: (a, b) => a.onTimeCount - b.onTimeCount,
    },
    {
      title: 'Văn bản trước hạn',
      dataIndex: 'soonCount',
      key: 'soonCount',
      width: 120,
      sorter: (a, b) => a.soonCount - b.soonCount,
    },
    {
      title: 'Văn bản trễ hạn',
      dataIndex: 'lateCount',
      key: 'lateCount',
      width: 120,
      sorter: (a, b) => a.lateCount - b.lateCount,
    },
    {
      title: 'Văn bản đang xử lý',
      dataIndex: 'pendingCount',
      key: 'pendingCount',
      width: 120,
      sorter: (a, b) => a.pendingCount - b.pendingCount,
    },
    {
      title: 'Văn bản chưa xử lý (quá hạn)',
      dataIndex: 'unhandledCount',
      key: 'unhandledCount',
      width: 120,
      sorter: (a, b) => a.unhandledCount - b.unhandledCount,
    },
  ];

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4 text-gray-700">Thống kê tài liệu theo người dùng</h2>
      
      <FilterFormWrapper onSearch={handleSearch}>
      <Row gutter={[12, 12]} className="mb-4 items-center">
        <Col xs={24} sm={12} md={6} lg={4}>
          <InputNumber
            value={filters.year}
            onChange={(value) => handleFilterChange('year', value)}
            placeholder="Năm"
            style={{ width: '100%' }}
            min={1900}
            max={dayjs().year() + 10}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <RangePicker
            placeholder={["Từ ngày", "Đến ngày"]}
            value={filters.fromDate && filters.toDate ? [dayjs(filters.fromDate), dayjs(filters.toDate)] : null}
            onChange={handleDateRangeChange}
            style={{ width: '100%' }}
            format="YYYY-MM-DD"
          />
        </Col>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Select
            placeholder="Người dùng"
            value={filters.userId}
            onChange={(value) => handleFilterChange('userId', value)}
            allowClear
            style={{ width: '100%' }}
            showSearch
            filterOption={(input, option) =>
              (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
            }
          >
            {users.map((user) => (
              <Option key={user._id} value={user._id}>
                {user.name}
              </Option>
            ))}
          </Select>
        </Col>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Select
            placeholder="Loại văn bản"
            value={filters.docVariantId}
            onChange={(value) => handleFilterChange('docVariantId', value)}
            allowClear
            style={{ width: '100%' }}
            showSearch
            filterOption={(input, option) =>
              (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
            }
          >
            {docVariants.map((variant) => (
              <Option key={variant._id} value={variant._id}>
                {variant.docVariantName}
              </Option>
            ))}
          </Select>
        </Col>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Tooltip title="Tìm kiếm dữ liệu">
            <Button onClick={handleSearch} type="primary" icon={<SearchOutlined />} style={{ width: '100%' }}>
              <span className="hidden sm:inline">Tìm kiếm</span>
            </Button>
          </Tooltip>
        </Col>
        <Col xs={24} sm={12} md={6} lg={4}>
          <Tooltip title="Đặt lại bộ lọc">
            <Button onClick={handleReset} type="default" icon={<ReloadOutlined />} style={{ width: '100%' }}>
              <span className="hidden sm:inline">Đặt lại</span>
            </Button>
          </Tooltip>
        </Col>
        {(currentRole === 'admin' || currentRole === 'manager') && (
          <Col xs={24} sm={12} md={6} lg={4}>
            <Tooltip title="Xuất dữ liệu Excel">
              <Button onClick={handleExportExcel} type="primary" icon={<FileExcelOutlined />} style={{ width: '100%' }} loading={loading}>
                <span className="hidden sm:inline">Xuất Excel</span>
              </Button>
            </Tooltip>
          </Col>
        )}
      </Row>
      </FilterFormWrapper>

      <Spin spinning={loading} size="large" tip="Đang tải dữ liệu...">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="userId"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} bản ghi`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 'max-content' }}
          className="shadow-md rounded-lg overflow-hidden border border-gray-200"
        />
      </Spin>
    </div>
  );
};

export default UserStatisticsTable;