import React, { useState, useEffect, useMemo } from 'react';
import {
  Tabs,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  DatePicker,
  TimePicker,
  Select,
  AutoComplete,
  Space,
  Badge,
  Card,
  Popconfirm,
  message,
  Tooltip,
  Empty,
  Spin,
  Alert,
  Row,
  Col,
} from 'antd';
import {
  CalendarOutlined,
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  DeleteOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  InfoCircleOutlined,
  UserOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  ClockCircleTwoTone,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { useSearchParams } from 'react-router-dom';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { useNotificationContext } from '../../context/NotificationContext';
import {
  getWorkSchedules,
  getPendingWorkScheduleCount,
  createWorkSchedule,
  updateWorkSchedule,
  deleteWorkSchedule,
  approveWorkSchedule,
  rejectWorkSchedule,
  getBghUsers,
} from '../../api/workScheduleApi';
import { isBghUser } from '../../utils/userClassification';

dayjs.extend(customParseFormat);
dayjs.locale('vi');

const { TextArea } = Input;
const { Option } = Select;

const LOCATION_SUGGESTIONS = [
  'Phòng HĐTT',
  'Hội trường A',
  'Hội trường',
  'Hội trường C',
  'Phòng họp trực tuyến',
  'Cơ sở 1',
  'Cơ sở 2',
  'Phòng họp Ban Giám Hiệu',
  'Phòng Truyền thống',
];

const WorkSchedulePage = () => {
  // Token & current user
  const token = Cookies.get('accessToken');
  const decodedToken = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode(token);
    } catch (e) {
      return null;
    }
  }, [token]);

  const currentUserId = decodedToken?.userId || decodedToken?._id || decodedToken?.id || Cookies.get('userId');
  const { refetchNotificationCounts } = useNotificationContext();

  // State
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming', 'past', 'pending', 'my_registered'
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [userRoleInfo, setUserRoleInfo] = useState({});
  const [pendingCount, setPendingCount] = useState(0);
  const [bghUsers, setBghUsers] = useState([]);

  // Search & Filter
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState(null);

  // Modal Create / Edit
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Modal Reject Reason
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  // Modal In Lịch Công Tác
  const [printModalVisible, setPrintModalVisible] = useState(false);

  // Fetch BGH Users for dropdown
  useEffect(() => {
    const fetchBgh = async () => {
      try {
        const res = await getBghUsers();
        if (res && res.success) {
          setBghUsers(res.data || []);
        }
      } catch (e) {
        console.warn('Lỗi lấy danh sách BGH:', e);
      }
    };
    fetchBgh();
  }, []);

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      setFetchError(false);
      const params = { tab: activeTab };
      if (keyword.trim()) params.keyword = keyword.trim();
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }

      const res = await getWorkSchedules(params);
      if (res && res.success) {
        setSchedules(res.data || []);
        if (res.userRoleInfo) {
          setUserRoleInfo(res.userRoleInfo);
        }
      }

      // Load pending count if BGH/Manager
      loadPendingCount();
    } catch (error) {
      setFetchError(true);
      if (error.response?.status !== 404) {
        message.error('Không thể tải dữ liệu lịch công tác.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPendingCount = async () => {
    try {
      const res = await getPendingWorkScheduleCount();
      if (res && res.success) {
        setPendingCount(res.data?.count || 0);
      }
    } catch (err) {
      // ignore
    }
  };

  const [searchParams] = useSearchParams();

  // Handle URL query params: tab=pending, tab=my_registered, action=create
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['upcoming', 'past', 'pending', 'my_registered'].includes(tab)) {
      setActiveTab(tab);
    } else if (!tab && (activeTab === 'pending' || activeTab === 'my_registered')) {
      setActiveTab('upcoming');
    }
    const action = searchParams.get('action');
    if (action === 'create') {
      setTimeout(() => {
        handleOpenCreate();
      }, 150);
    }
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleSearch = () => {
    loadData();
  };

  const handleResetFilters = () => {
    setKeyword('');
    setDateRange(null);
    setTimeout(() => {
      loadData();
    }, 50);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      startDate: dayjs(),
      endDate: dayjs(),
      startTime: dayjs('08:00', 'HH:mm'),
      endTime: dayjs('10:30', 'HH:mm'),
      targetApprover: filteredBghUsers.length > 0 ? filteredBghUsers[0]._id : undefined,
    });
    setModalVisible(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (item) => {
    setEditingItem(item);
    form.setFieldsValue({
      startDate: dayjs(item.startDate),
      endDate: item.endDate ? dayjs(item.endDate) : dayjs(item.startDate),
      startTime: item.startTime ? dayjs(item.startTime, 'HH:mm') : null,
      endTime: item.endTime ? dayjs(item.endTime, 'HH:mm') : null,
      content: item.content,
      participants: item.participants,
      location: item.location,
      notes: item.notes,
      host: item.host,
      targetApprover: item.targetApprover?._id || item.targetApprover,
    });
    setModalVisible(true);
  };

  // Save Modal
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        startDate: values.startDate.format('YYYY-MM-DD'),
        endDate: values.endDate ? values.endDate.format('YYYY-MM-DD') : values.startDate.format('YYYY-MM-DD'),
        startTime: values.startTime ? values.startTime.format('HH:mm') : '',
        endTime: values.endTime ? values.endTime.format('HH:mm') : '',
        content: values.content,
        participants: values.participants || '',
        location: values.location || '',
        notes: values.notes || '',
        host: values.host || '',
        targetApprover: values.targetApprover || null,
      };

      if (editingItem) {
        await updateWorkSchedule(editingItem._id, payload);
        message.success('Cập nhật lịch công tác thành công.');
      } else {
        const res = await createWorkSchedule(payload);
        message.success(res.message || 'Thêm lịch công tác thành công.');
      }

      setModalVisible(false);
      loadData();
      if (typeof refetchNotificationCounts === 'function') {
        refetchNotificationCounts();
      }
    } catch (error) {
      if (error?.response?.data?.message) {
        message.error(error.response.data.message);
      } else if (error?.errorFields) {
        message.warning('Vui lòng kiểm tra lại các trường bắt buộc.');
      } else {
        message.error('Có lỗi xảy ra khi lưu lịch công tác.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Delete
  const handleDelete = async (id) => {
    try {
      await deleteWorkSchedule(id);
      message.success('Đã xóa lịch công tác.');
      loadData();
      if (typeof refetchNotificationCounts === 'function') {
        refetchNotificationCounts();
      }
    } catch (error) {
      message.error(error?.response?.data?.message || 'Không thể xóa lịch công tác.');
    }
  };

  // Approve
  const handleApprove = async (id) => {
    try {
      await approveWorkSchedule(id);
      message.success('Đã phê duyệt lịch công tác.');
      loadData();
      if (typeof refetchNotificationCounts === 'function') {
        refetchNotificationCounts();
      }
    } catch (error) {
      message.error(error?.response?.data?.message || 'Không thể phê duyệt lịch.');
    }
  };

  // Reject
  const handleOpenReject = (id) => {
    setRejectTargetId(id);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      message.warning('Vui lòng nhập lý do từ chối.');
      return;
    }
    try {
      setRejectSubmitting(true);
      await rejectWorkSchedule(rejectTargetId, rejectReason.trim());
      message.success('Đã từ chối lịch công tác.');
      setRejectModalVisible(false);
      loadData();
      if (typeof refetchNotificationCounts === 'function') {
        refetchNotificationCounts();
      }
    } catch (error) {
      message.error(error?.response?.data?.message || 'Lỗi khi từ chối lịch.');
    } finally {
      setRejectSubmitting(false);
    }
  };

  // Nhóm lịch công tác theo ngày
  const groupedSchedules = useMemo(() => {
    const groups = {};
    const todayStr = dayjs().format('YYYY-MM-DD');

    schedules.forEach((item) => {
      const dStr = dayjs(item.startDate).format('YYYY-MM-DD');
      if (!groups[dStr]) {
        groups[dStr] = {
          dateStr: dStr,
          isToday: dStr === todayStr,
          items: [],
        };
      }
      groups[dStr].items.push(item);
    });

    // Sắp xếp các ngày
    const groupList = Object.values(groups);
    if (activeTab === 'upcoming') {
      // Yêu cầu: "lịch ngày hiện tại nằm lên trên cùng và những ngày tiếp theo"
      groupList.sort((a, b) => {
        if (a.isToday) return -1;
        if (b.isToday) return 1;
        return a.dateStr.localeCompare(b.dateStr);
      });
    } else if (activeTab === 'past') {
      // Ngày đã qua: giảm dần (ngày gần nhất trước)
      groupList.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
    } else {
      groupList.sort((a, b) => a.dateStr.localeCompare(b.dateStr));
    }

    return groupList;
  }, [schedules, activeTab]);

  const canDirectAdd = userRoleInfo?.canDirectAdd;
  const canRegister = userRoleInfo?.canRegister;
  const canApprove = userRoleInfo?.canApprove;
  const isCapTruong = userRoleInfo?.isCapTruong;
  const isCapPho = userRoleInfo?.isCapPho;

  // Lọc nghiêm ngặt chỉ lấy Ban Giám Hiệu
  const filteredBghUsers = useMemo(() => {
    const list = (bghUsers || []).filter(isBghUser);
    return list.length > 0 ? list : bghUsers;
  }, [bghUsers]);

  const getDayLabel = (dateStr, isToday) => {
    const d = dayjs(dateStr);
    const dayOfWeek = d.format('dddd'); // Thứ Hai, Thứ Ba...
    const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
    const formattedDate = d.format('DD/MM/YYYY');

    if (isToday) {
      return (
        <span className="flex items-center gap-2">
          <span className="text-white font-bold tracking-wide">
            {capitalizedDay}, {formattedDate}
          </span>
          <span className="bg-amber-400 text-slate-900 text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs animate-pulse">
            Hôm nay
          </span>
        </span>
      );
    }

    return (
      <span className="font-bold text-white tracking-wide">
        {capitalizedDay}, {formattedDate}
      </span>
    );
  };

  const renderStatusTag = (status, rejectionReason) => {
    switch (status) {
      case 'APPROVED':
        return <Tag color="success" className="font-medium text-xs">Đã duyệt</Tag>;
      case 'PENDING':
        return <Tag color="warning" className="font-medium text-xs">Chờ duyệt</Tag>;
      case 'REJECTED':
        return (
          <Tooltip title={rejectionReason ? `Lý do: ${rejectionReason}` : 'Bị từ chối'}>
            <Tag color="error" className="cursor-help font-medium text-xs">Từ chối</Tag>
          </Tooltip>
        );
      default:
        return <Tag>{status}</Tag>;
    }
  };

  return (
    <div className="w-full min-h-screen p-2 sm:p-4 md:p-6 bg-slate-50/50 space-y-3 sm:space-y-4">
      {/* Banner Tiêu đề & Nút Thao tác */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-4 sm:p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 text-xl sm:text-2xl shadow-inner shrink-0">
              <CalendarOutlined />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold text-[#003366] leading-tight">
                Lịch Công Tác Nhà Trường
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Lịch họp, hội nghị, sự kiện và chương trình công tác của Ban Giám Hiệu & các Đơn vị
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              icon={<PrinterOutlined />}
              onClick={() => setPrintModalVisible(true)}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 text-xs sm:text-sm h-9 flex-1 sm:flex-none"
            >
              In lịch tuần
            </Button>

            <Button
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
              className="text-xs sm:text-sm h-9 flex-1 sm:flex-none"
            >
              Làm mới
            </Button>

            {/* Manager & BGH: Thêm trực tiếp */}
            {canDirectAdd && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenCreate}
                className="bg-[#003366] hover:bg-[#002244] text-xs sm:text-sm font-semibold h-9 w-full sm:w-auto"
              >
                Ban hành lịch công tác
              </Button>
            )}

            {/* Cấp trưởng: Đăng ký lịch gửi BGH duyệt */}
            {canRegister && !canDirectAdd && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleOpenCreate}
                className="bg-[#0284c7] hover:bg-[#0369a1] text-xs sm:text-sm font-semibold h-9 w-full sm:w-auto"
              >
                Đăng ký lịch công tác
              </Button>
            )}
          </div>
        </div>

        {/* Thanh tìm kiếm & bộ lọc */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
          <Input
            placeholder="Tìm theo nội dung, địa điểm, thành phần..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
            className="w-full sm:flex-1 sm:min-w-[240px] text-xs sm:text-sm h-9 rounded-lg"
          />

          <DatePicker.RangePicker
            value={dateRange}
            onChange={(val) => setDateRange(val)}
            format="DD/MM/YYYY"
            placeholder={['Từ ngày', 'Đến ngày']}
            className="w-full sm:w-64 text-xs sm:text-sm h-9 rounded-lg"
          />

          <div className="flex items-center gap-2">
            <Button type="primary" onClick={handleSearch} className="bg-[#003366] hover:bg-[#002244] text-xs sm:text-sm h-9 px-4 rounded-lg flex-1 sm:flex-none">
              Lọc
            </Button>

            {(keyword || dateRange) && (
              <Button onClick={handleResetFilters} className="text-xs sm:text-sm h-9 rounded-lg flex-1 sm:flex-none">
                Xóa bộ lọc
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs chuyển đổi */}
      <Card className="shadow-xs border border-gray-100 rounded-2xl w-full">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          type="card"
          className="work-schedule-tabs"
          items={[
            {
              key: 'upcoming',
              label: (
                <span className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm px-1">
                  <CalendarOutlined />
                  Lịch hiện tại & Sắp tới
                </span>
              ),
            },
            {
              key: 'past',
              label: (
                <span className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm px-1">
                  <HistoryOutlined />
                  Những ngày đã qua
                </span>
              ),
            },
            ...(isCapTruong || isCapPho || (!canDirectAdd && !canApprove)
              ? [
                  {
                    key: 'my_registered',
                    label: (
                      <span className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm px-1">
                        <UserOutlined />
                        Lịch tôi đã đăng ký
                      </span>
                    ),
                  },
                ]
              : []),
            ...(canApprove
              ? [
                  {
                    key: 'pending',
                    label: (
                      <span className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm px-1">
                        <ClockCircleTwoTone twoToneColor="#faad14" />
                        Chờ xét duyệt
                        {pendingCount > 0 && (
                          <Badge count={pendingCount} size="small" className="ml-1" />
                        )}
                      </span>
                    ),
                  },
                ]
              : []),
          ]}
        />

        {/* Banner thông báo trạng thái đồng bộ nếu có lỗi kết nối backend */}
        {fetchError && (
          <Alert
            type="warning"
            showIcon
            message="Máy chủ Backend đang trong quá trình cập nhật"
            description="Tính năng Lịch công tác trên hệ thống máy chủ (API /api/work-schedules) đang được cập nhật. Vui lòng bấm 'Thử lại' sau khi máy chủ hoàn tất hoặc liên hệ quản trị viên."
            action={
              <Button size="small" type="primary" onClick={loadData} className="bg-amber-600 border-none text-xs">
                Thử lại
              </Button>
            }
            className="mb-4 rounded-xl border border-amber-200"
          />
        )}

        {/* Nội dung danh sách dạng BẢNG (Table) */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Spin size="large" />
            <span className="mt-3 text-xs sm:text-sm text-gray-500">Đang tải dữ liệu lịch công tác...</span>
          </div>
        ) : groupedSchedules.length === 0 ? (
          <div className="py-16">
            <Empty
              description={
                <span className="text-gray-500 text-xs sm:text-sm">
                  {activeTab === 'upcoming'
                    ? 'Không có lịch công tác nào trong thời gian tới.'
                    : activeTab === 'past'
                    ? 'Không có lịch công tác nào trong những ngày đã qua.'
                    : activeTab === 'my_registered'
                    ? 'Bạn chưa đăng ký lịch công tác nào.'
                    : 'Không có lịch nào đang chờ phê duyệt.'}
                </span>
              }
            />
          </div>
        ) : (
          <div className="space-y-6 mt-2">
            <div className="flex items-center justify-between text-xs text-gray-500 italic pb-1">
              <span className="block sm:hidden text-[11px] text-amber-600 font-medium">
                👉 Vuốt ngang bảng để xem đầy đủ các cột thông tin
              </span>
              <span className="hidden sm:inline">
                Tổng cộng: <b className="text-slate-800">{schedules.length}</b> lịch công tác
              </span>
            </div>

            {groupedSchedules.map((group) => (
              <div
                key={group.dateStr}
                className={`rounded-xl border transition-all overflow-hidden ${
                  group.isToday
                    ? 'border-blue-400 ring-2 ring-blue-100 shadow-md'
                    : 'border-slate-300 bg-white shadow-xs'
                }`}
              >
                {/* Header Ngày */}
                <div
                  className={`px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-white transition-all ${
                    group.isToday
                      ? 'bg-gradient-to-r from-[#002b55] via-[#004b99] to-[#0284c7]'
                      : 'bg-[#003366]'
                  }`}
                >
                  <div className="font-bold text-xs sm:text-sm md:text-base flex items-center gap-2 uppercase tracking-wide text-white">
                    <CalendarOutlined className="text-base text-cyan-300 shrink-0" />
                    <div className="text-white">{getDayLabel(group.dateStr, group.isToday)}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    group.isToday
                      ? 'bg-white/25 text-white border border-white/30'
                      : 'bg-white/15 text-blue-100'
                  }`}>
                    {group.items.length} sự kiện
                  </span>
                </div>

                {/* BẢNG LỊCH (TABLE) */}
                <div className="overflow-x-auto w-full bg-white">
                  <table className="w-full min-w-[960px] border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold text-xs border-b border-slate-300">
                        <th className="p-2.5 text-center w-28 border-r border-slate-200 shrink-0">Thời gian</th>
                        <th className="p-2.5 text-left min-w-[220px] border-r border-slate-200">Nội dung công tác</th>
                        <th className="p-2.5 text-left w-44 border-r border-slate-200">Thành phần</th>
                        <th className="p-2.5 text-left w-40 border-r border-slate-200">Địa điểm</th>
                        <th className="p-2.5 text-left w-44 border-r border-slate-200">Đăng ký / Duyệt</th>
                        <th className="p-2.5 text-left w-40 border-r border-slate-200">Trạng thái & Ghi chú</th>
                        <th className="p-2.5 text-center w-24 shrink-0">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {group.items.map((item, idx) => {
                        const isOwner =
                          item.createdBy?._id?.toString() === currentUserId ||
                          item.createdBy?.toString() === currentUserId;
                        const canEditItem =
                          canDirectAdd || ((isCapTruong || isCapPho) && isOwner && item.status !== 'APPROVED');
                        const canDeleteItem =
                          canDirectAdd || ((isCapTruong || isCapPho) && isOwner && item.status !== 'APPROVED');

                        const isMultiDay =
                          item.startDate &&
                          item.endDate &&
                          dayjs(item.startDate).format('YYYY-MM-DD') !== dayjs(item.endDate).format('YYYY-MM-DD');

                        const timeDisplay =
                          item.startTime && item.endTime
                            ? `${item.startTime} - ${item.endTime}`
                            : item.startTime
                            ? `Từ ${item.startTime}`
                            : 'Cả ngày';

                        return (
                          <tr
                            key={item._id}
                            className={`hover:bg-blue-50/40 transition-colors ${
                              idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                            }`}
                          >
                            {/* Cột 1: Thời gian */}
                            <td className="p-2.5 text-center align-top whitespace-nowrap border-r border-slate-200">
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-900 font-bold text-xs border border-blue-200">
                                <ClockCircleOutlined className="text-blue-600 text-xs" />
                                {timeDisplay}
                              </span>
                              {isMultiDay && (
                                <div className="mt-1">
                                  <Tag color="cyan" className="text-[10px] rounded mr-0 font-semibold px-1.5 py-0.5 border-cyan-200 bg-cyan-50 text-cyan-800">
                                    {dayjs(item.startDate).format('DD/MM')} → {dayjs(item.endDate).format('DD/MM/YYYY')}
                                  </Tag>
                                </div>
                              )}
                            </td>

                            {/* Cột 2: Nội dung công tác */}
                            <td className="p-2.5 align-top border-r border-slate-200">
                              <div className="font-semibold text-slate-900 leading-snug break-words whitespace-pre-wrap">
                                {item.content}
                              </div>
                              {item.host && (
                                <div className="mt-1.5">
                                  <Tag color="purple" className="text-[11px] rounded mr-0 font-medium">
                                    <b>Chủ trì:</b> {item.host}
                                  </Tag>
                                </div>
                              )}
                            </td>

                            {/* Cột 3: Thành phần */}
                            <td className="p-2.5 align-top text-slate-700 border-r border-slate-200">
                              {item.participants ? (
                                <div className="flex items-start gap-1.5 break-words">
                                  <TeamOutlined className="text-blue-500 mt-0.5 shrink-0" />
                                  <span>{item.participants}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">--</span>
                              )}
                            </td>

                            {/* Cột 4: Địa điểm */}
                            <td className="p-2.5 align-top text-slate-700 border-r border-slate-200">
                              {item.location ? (
                                <div className="flex items-start gap-1.5 break-words font-medium text-slate-800">
                                  <EnvironmentOutlined className="text-red-500 mt-0.5 shrink-0" />
                                  <span>{item.location}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">--</span>
                              )}
                            </td>

                            {/* Cột 5: Đăng ký / Duyệt */}
                            <td className="p-2.5 align-top text-xs space-y-1 border-r border-slate-200">
                              {item.createdBy?.name && (
                                <div className="text-slate-600">
                                  <span className="text-slate-400">Đăng ký: </span>
                                  <b className="text-slate-800">{item.createdBy.name}</b>
                                </div>
                              )}
                              {item.targetApprover?.name && (
                                <div className="text-indigo-700">
                                  <span className="text-slate-400">Gửi duyệt: </span>
                                  <b>{item.targetApprover.name}</b>
                                </div>
                              )}
                              {item.approvedBy?.name && (
                                <div className="text-emerald-700">
                                  <span className="text-slate-400">Đã duyệt: </span>
                                  <b>{item.approvedBy.name}</b>
                                </div>
                              )}
                            </td>

                            {/* Cột 6: Trạng thái & Ghi chú */}
                            <td className="p-2.5 align-top text-xs space-y-1.5 border-r border-slate-200">
                              <div>{renderStatusTag(item.status, item.rejectionReason)}</div>
                              {item.notes && (
                                <div className="text-slate-500 italic break-words line-clamp-3">
                                  <InfoCircleOutlined className="text-amber-500 mr-1 not-italic" />
                                  {item.notes}
                                </div>
                              )}
                              {item.status === 'REJECTED' && item.rejectionReason && (
                                <div className="text-red-600 text-[11px] bg-red-50 p-1.5 rounded border border-red-200">
                                  <b>Lý do:</b> {item.rejectionReason}
                                </div>
                              )}
                            </td>

                            {/* Cột 7: Thao tác */}
                            <td className="p-2.5 text-center align-middle whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Duyệt / Từ chối (chỉ BGH/Manager khi status PENDING) */}
                                {canApprove && item.status === 'PENDING' && (
                                  <>
                                    <Tooltip title="Phê duyệt lịch">
                                      <Button
                                        type="primary"
                                        size="small"
                                        icon={<CheckOutlined className="text-white text-xs" />}
                                        onClick={() => handleApprove(item._id)}
                                        className="bg-emerald-600 hover:bg-emerald-700 border-none h-7 w-7 flex items-center justify-center p-0 rounded-md shadow-2xs"
                                      />
                                    </Tooltip>

                                    <Tooltip title="Từ chối lịch">
                                      <Button
                                        danger
                                        size="small"
                                        icon={<CloseOutlined className="text-xs" />}
                                        onClick={() => handleOpenReject(item._id)}
                                        className="h-7 w-7 flex items-center justify-center p-0 rounded-md border-red-300 text-red-600 hover:bg-red-50"
                                      />
                                    </Tooltip>
                                  </>
                                )}

                                {/* Sửa */}
                                {canEditItem && (
                                  <Tooltip title="Chỉnh sửa lịch">
                                    <Button
                                      size="small"
                                      icon={<EditOutlined className="text-blue-600 text-xs" />}
                                      onClick={() => handleOpenEdit(item)}
                                      className="h-7 w-7 flex items-center justify-center p-0 rounded-md border-blue-200 hover:bg-blue-50"
                                    />
                                  </Tooltip>
                                )}

                                {/* Xóa */}
                                {canDeleteItem && (
                                  <Popconfirm
                                    title="Xác nhận xóa lịch công tác này?"
                                    onConfirm={() => handleDelete(item._id)}
                                    okText="Xóa"
                                    cancelText="Hủy"
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Tooltip title="Xóa lịch">
                                      <Button
                                        danger
                                        size="small"
                                        icon={<DeleteOutlined className="text-xs" />}
                                        className="h-7 w-7 flex items-center justify-center p-0 rounded-md"
                                      />
                                    </Tooltip>
                                  </Popconfirm>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal Thêm / Chỉnh sửa lịch công tác */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-[#003366]">
            <CalendarOutlined className="text-blue-600" />
            <span>
              {editingItem
                ? 'Chỉnh sửa Lịch Công Tác'
                : canDirectAdd
                ? 'Thêm Mới Lịch Công Tác (Ban hành ngay)'
                : 'Đăng Ký Lịch Công Tác (Gửi BGH xét duyệt)'}
            </span>
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        confirmLoading={submitting}
        okText={editingItem ? 'Lưu cập nhật' : canDirectAdd ? 'Ban hành lịch' : 'Gửi đăng ký'}
        cancelText="Hủy"
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="pt-2">
          {!canDirectAdd && (
            <Alert
              type="info"
              showIcon
              message="Quy trình đăng ký lịch"
              description="Lịch sau khi đăng ký sẽ được chuyển đến Ban Giám Hiệu được chỉ định để xét duyệt trước khi hiển thị chính thức trên toàn trường."
              className="mb-4 text-xs"
            />
          )}

          {!canDirectAdd && (
            <Form.Item
              name="targetApprover"
              label={
                <span className="font-semibold text-slate-800">
                  Người duyệt (Ban Giám Hiệu) <span className="text-red-500">*</span>
                </span>
              }
              rules={[{ required: true, message: 'Vui lòng chọn Ban Giám Hiệu phê duyệt' }]}
            >
              <Select
                placeholder="Chọn Thầy/Cô Ban Giám Hiệu phê duyệt..."
                showSearch
                allowClear
                optionFilterProp="label"
                options={filteredBghUsers.map((u) => {
                  const posTitle = u.position?.positionName || 'Ban Giám Hiệu';
                  const deptTitle = u.department?.departmentName ? ` (${u.department.departmentName})` : '';
                  return {
                    value: u._id,
                    label: `${u.name} - ${posTitle}${deptTitle}`,
                  };
                })}
              />
            </Form.Item>
          )}

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="startDate"
                label="Ngày bắt đầu"
                rules={[{ required: true, message: 'Vui lòng chọn ngày bắt đầu' }]}
              >
                <DatePicker format="DD/MM/YYYY" className="w-full" placeholder="Chọn ngày bắt đầu" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="endDate"
                label="Ngày kết thúc"
                rules={[{ required: true, message: 'Vui lòng chọn ngày kết thúc' }]}
              >
                <DatePicker format="DD/MM/YYYY" className="w-full" placeholder="Chọn ngày kết thúc" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={12} sm={12}>
              <Form.Item name="startTime" label="Giờ bắt đầu">
                <TimePicker format="HH:mm" minuteStep={5} className="w-full" placeholder="Ví dụ: 08:00" />
              </Form.Item>
            </Col>

            <Col xs={12} sm={12}>
              <Form.Item name="endTime" label="Giờ kết thúc">
                <TimePicker format="HH:mm" minuteStep={5} className="w-full" placeholder="Ví dụ: 10:30" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="content"
            label="Nội dung cuộc họp / công tác"
            rules={[{ required: true, message: 'Vui lòng nhập nội dung công tác' }]}
          >
            <TextArea
              rows={3}
              placeholder="Nhập chi tiết nội dung cuộc họp, buổi làm việc hoặc sự kiện..."
            />
          </Form.Item>

          <Form.Item name="host" label="Người chủ trì (tùy chọn)">
            <Input placeholder="Ví dụ: Hiệu trưởng, Phó Hiệu trưởng, Trưởng phòng..." />
          </Form.Item>

          <Form.Item name="participants" label="Thành phần tham dự">
            <Input placeholder="Ví dụ: Ban Giám hiệu, Trưởng các đơn vị, GV Khoa CNTT..." />
          </Form.Item>

          <Form.Item name="location" label="Địa điểm">
            <AutoComplete
              options={LOCATION_SUGGESTIONS.map((loc) => ({ value: loc }))}
              placeholder="Chọn địa điểm gợi ý hoặc tự do gõ nhập nơi tổ chức..."
              filterOption={(inputValue, option) =>
                option?.value?.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
              }
              allowClear
            />
          </Form.Item>

          <Form.Item name="notes" label="Ghi chú">
            <TextArea
              rows={2}
              placeholder="Ghi chú thêm về tài liệu, chuẩn bị máy chiếu, đường link họp online..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Từ Chối */}
      <Modal
        title="Từ chối lịch công tác"
        open={rejectModalVisible}
        onCancel={() => setRejectModalVisible(false)}
        onOk={handleConfirmReject}
        confirmLoading={rejectSubmitting}
        okText="Xác nhận từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
      >
        <div className="py-2">
          <p className="text-xs sm:text-sm text-gray-600 mb-2">
            Vui lòng nhập lý do từ chối để thông báo cho người đăng ký lịch:
          </p>
          <TextArea
            rows={3}
            placeholder="Nhập lý do từ chối..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </div>
      </Modal>

      {/* Modal In Lịch Tuần */}
      <Modal
        title="In Lịch Công Tác"
        open={printModalVisible}
        onCancel={() => setPrintModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPrintModalVisible(false)}>
            Đóng
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => window.print()}
            className="bg-[#003366]"
          >
            In ngay
          </Button>,
        ]}
        width={850}
      >
        <div className="p-4 print-area text-slate-900 bg-white">
          <div className="text-center mb-6">
            <div className="font-bold text-xs uppercase tracking-wider text-gray-600">
              ỦY BAN NHÂN DÂN THÀNH PHỐ HỒ CHÍ MINH
            </div>
            <div className="font-bold text-sm uppercase text-[#003366]">
              TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN
            </div>
            <div className="w-24 h-0.5 bg-[#003366] mx-auto my-2"></div>
            <h2 className="text-lg font-bold uppercase mt-4 text-slate-800">
              LỊCH CÔNG TÁC NHÀ TRƯỜNG
            </h2>
            <p className="text-xs text-gray-500 italic">
              Thời gian xuất: {dayjs().format('DD/MM/YYYY HH:mm')}
            </p>
          </div>

          <table className="w-full border-collapse border border-gray-400 text-xs">
            <thead>
              <tr className="bg-gray-100 text-center font-bold">
                <th className="border border-gray-400 p-2 w-28">Thứ, Ngày</th>
                <th className="border border-gray-400 p-2 w-24">Thời gian</th>
                <th className="border border-gray-400 p-2">Nội dung công tác</th>
                <th className="border border-gray-400 p-2 w-36">Thành phần</th>
                <th className="border border-gray-400 p-2 w-32">Địa điểm</th>
                <th className="border border-gray-400 p-2 w-28">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {groupedSchedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center p-4 text-gray-400 border border-gray-400">
                    Không có lịch công tác nào.
                  </td>
                </tr>
              ) : (
                groupedSchedules.map((group) => (
                  <React.Fragment key={group.dateStr}>
                    {group.items.map((item, idx) => (
                      <tr key={item._id} className="hover:bg-gray-50">
                        {idx === 0 && (
                          <td
                            rowSpan={group.items.length}
                            className={`border border-gray-400 p-2 font-bold text-center align-top ${
                              group.isToday ? 'bg-blue-50 text-blue-900' : 'bg-gray-50'
                            }`}
                          >
                            <div>{dayjs(group.dateStr).format('dddd')}</div>
                            <div className="text-gray-600 font-normal">
                              {dayjs(group.dateStr).format('DD/MM/YYYY')}
                            </div>
                            {group.isToday && (
                              <span className="text-[10px] text-blue-700 font-bold block mt-0.5">
                                [HÔM NAY]
                              </span>
                            )}
                          </td>
                        )}
                        <td className="border border-gray-400 p-2 text-center font-semibold align-top">
                          {item.startTime && item.endTime
                            ? `${item.startTime} - ${item.endTime}`
                            : item.startTime
                            ? `${item.startTime}`
                            : 'Cả ngày'}
                        </td>
                        <td className="border border-gray-400 p-2 align-top font-medium">
                          {item.content}
                          {item.host && (
                            <div className="text-[11px] text-purple-700 mt-0.5">
                              <b>Chủ trì:</b> {item.host}
                            </div>
                          )}
                        </td>
                        <td className="border border-gray-400 p-2 align-top">{item.participants}</td>
                        <td className="border border-gray-400 p-2 align-top">{item.location}</td>
                        <td className="border border-gray-400 p-2 align-top italic text-gray-500">
                          {item.notes}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
};

export default WorkSchedulePage;
