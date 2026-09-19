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
  Pagination,
  Radio,
  Segmented,
} from 'antd';
import {
  CalendarOutlined,
  EyeOutlined,
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
  FileExcelOutlined,
  FilePdfOutlined,
  LeftOutlined,
  RightOutlined,
  DownloadOutlined,
  UploadOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import ExcelJS from 'exceljs';
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
  importWorkSchedules,
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
  const userTokenRole = decodedToken?.role || Cookies.get('role');
  const { refetchNotificationCounts, userNotifications, markNotificationAsRead } = useNotificationContext();

  // State
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming', 'past', 'pending', 'my_registered'
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [userRoleInfo, setUserRoleInfo] = useState({});
  const [pendingCount, setPendingCount] = useState(0);
  const [bghUsers, setBghUsers] = useState([]);

  // Phân quyền derived từ userRoleInfo & token
  const isManagerUser = Boolean(userRoleInfo?.isManager || userTokenRole === 'manager');
  const isAdminUser = Boolean(userRoleInfo?.isAdmin || userTokenRole === 'admin');
  const isGvCvUser = Boolean(userRoleInfo?.isGvCv);
  const hideMyRegisteredTab = isManagerUser || isGvCvUser;

  // Tự động đánh dấu đã đọc các thông báo trạng thái lịch công tác khi người dùng vào trang Lịch công tác
  useEffect(() => {
    if (userNotifications && userNotifications.length > 0) {
      const scheduleNotifs = userNotifications.filter(
        (n) =>
          !n.isRead &&
          (n.link?.includes('work-schedule') ||
            n.title?.toLowerCase().includes('lịch') ||
            n.message?.toLowerCase().includes('lịch công tác'))
      );
      if (scheduleNotifs.length > 0) {
        scheduleNotifs.forEach((n) => {
          markNotificationAsRead(n._id);
        });
      }
    }
  }, [userNotifications, markNotificationAsRead]);


  // Search & Filter
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('ALL');

  // Phân trang
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  // Modal In & Xuất Lịch Công Tác
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [printRangeType, setPrintRangeType] = useState('week'); // 'week' | 'today'
  const [selectedPrintDate, setSelectedPrintDate] = useState(dayjs());
  const [printSchedules, setPrintSchedules] = useState([]);
  const [printLoading, setPrintLoading] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Modal Chi Tiết Lịch Công Tác
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  // Modal Import Lịch Công Tác
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleOpenDetail = (item) => {
    setDetailItem(item);
    setDetailModalVisible(true);
  };


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
  const loadData = async (overrideStatus = null) => {
    try {
      setLoading(true);
      setFetchError(false);
      const params = { tab: activeTab };
      if (keyword.trim()) params.keyword = keyword.trim();
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      if (activeTab === 'pending') {
        if (isAdminUser) {
          const statusToUse = overrideStatus !== null ? overrideStatus : approvalStatusFilter;
          params.status = statusToUse || 'ALL';
        } else {
          params.status = 'PENDING';
        }
      } else if (activeTab === 'my_registered') {
        const statusToUse = overrideStatus !== null ? overrideStatus : approvalStatusFilter;
        if (statusToUse && statusToUse !== 'ALL') {
          params.status = statusToUse;
        } else {
          params.status = 'ALL';
        }
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

  const handleStatusFilterChange = (val) => {
    setApprovalStatusFilter(val);
    setCurrentPage(1);
    loadData(val);
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
      if (hideMyRegisteredTab && (tab === 'pending' || tab === 'my_registered')) {
        setActiveTab('upcoming');
      } else {
        setActiveTab(tab);
      }
    } else if (!tab && (activeTab === 'pending' || activeTab === 'my_registered') && hideMyRegisteredTab) {
      setActiveTab('upcoming');
    }
    const action = searchParams.get('action');
    if (action === 'create') {
      setTimeout(() => {
        handleOpenCreate();
      }, 150);
    }
  }, [searchParams, hideMyRegisteredTab]);


  useEffect(() => {
    setCurrentPage(1);
    loadData();
  }, [activeTab]);

  const handleSearch = () => {
    setCurrentPage(1);
    loadData();
  };

  const handleResetFilters = () => {
    setKeyword('');
    setDateRange(null);
    setCurrentPage(1);
    setTimeout(() => {
      loadData();
    }, 50);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingItem(null);
    form.resetFields();
    // Ưu tiên chọn Hiệu trưởng làm người duyệt mặc định nếu có
    const htUser = filteredBghUsers.find(
      (u) =>
        u.position?.positionName?.toLowerCase().includes('hiệu trưởng') &&
        !u.position?.positionName?.toLowerCase().includes('phó')
    );
    form.setFieldsValue({
      startDate: dayjs(),
      endDate: dayjs(),
      startTime: dayjs('08:00', 'HH:mm'),
      endTime: dayjs('10:30', 'HH:mm'),
      targetApprover: htUser ? htUser._id : (filteredBghUsers.length > 0 ? filteredBghUsers[0]._id : undefined),
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

  // Phân trang danh sách nhóm ngày
  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return groupedSchedules.slice(startIndex, startIndex + pageSize);
  }, [groupedSchedules, currentPage, pageSize]);

  const canDirectAdd = userRoleInfo?.canDirectAdd;
  const canRegister = userRoleInfo?.canRegister;
  const canApprove = userRoleInfo?.canApprove;
  const isCapTruong = userRoleInfo?.isCapTruong;
  const isCapPho = userRoleInfo?.isCapPho;

  // Lọc nghiêm ngặt chỉ lấy Ban Giám Hiệu (loại trừ chính mình để không tự chọn mình duyệt)
  const filteredBghUsers = useMemo(() => {
    const list = (bghUsers || []).filter(isBghUser);
    const result = list.length > 0 ? list : bghUsers;
    return result.filter(
      (u) =>
        u._id?.toString() !== currentUserId?.toString() &&
        u.id?.toString() !== currentUserId?.toString()
    );
  }, [bghUsers, currentUserId]);

  // Cột Đăng ký / Duyệt chỉ hiển thị ở tab "Chờ xét duyệt" và "Lịch tôi đã đăng ký"
  const showApprovalCol = activeTab === 'pending' || activeTab === 'my_registered';

  // --- LOGIC IN & XUẤT LỊCH CÔNG TÁC ---
  // Tính thứ 2 và chủ nhật chuẩn xác của tuần
  const getMondayAndSunday = (date) => {
    const d = dayjs(date || new Date());
    const day = d.day(); // 0: Chủ Nhật, 1: Thứ Hai, ..., 6: Thứ Bảy
    const monday = day === 0 ? d.subtract(6, 'day').startOf('day') : d.subtract(day - 1, 'day').startOf('day');
    const sunday = monday.add(6, 'day').endOf('day');
    return { monday, sunday };
  };

  // Tải dữ liệu lịch phê duyệt theo phạm vi In / Xuất
  useEffect(() => {
    if (!printModalVisible) return;

    const fetchPrintData = async () => {
      try {
        setPrintLoading(true);
        let start, end;
        if (printRangeType === 'today') {
          start = selectedPrintDate.format('YYYY-MM-DD');
          end = selectedPrintDate.format('YYYY-MM-DD');
        } else {
          const { monday, sunday } = getMondayAndSunday(selectedPrintDate);
          start = monday.format('YYYY-MM-DD');
          end = sunday.format('YYYY-MM-DD');
        }

        const res = await getWorkSchedules({
          startDate: start,
          endDate: end,
          status: 'APPROVED',
        });

        if (res && res.success) {
          setPrintSchedules(res.data || []);
        } else {
          setPrintSchedules([]);
        }
      } catch (err) {
        console.error('Lỗi lấy dữ liệu in lịch:', err);
        message.error('Không thể tải lịch công tác cho phạm vi đã chọn.');
      } finally {
        setPrintLoading(false);
      }
    };

    fetchPrintData();
  }, [printModalVisible, printRangeType, selectedPrintDate]);

  // Phân nhóm lịch in theo ngày
  const groupedPrintSchedules = useMemo(() => {
    const groups = {};
    const todayStr = dayjs().format('YYYY-MM-DD');

    printSchedules.forEach((item) => {
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

    const list = Object.values(groups);
    // Sắp xếp ngày tăng dần từ Thứ Hai đến Chủ Nhật
    list.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

    // Sắp xếp theo giờ trong mỗi ngày
    list.forEach((g) => {
      g.items.sort((a, b) => {
        const timeA = a.startTime || '';
        const timeB = b.startTime || '';
        return timeA.localeCompare(timeB);
      });
    });

    return list;
  }, [printSchedules]);

  // Tiêu đề và tên file xuất
  const printTitleInfo = useMemo(() => {
    if (printRangeType === 'today') {
      const d = selectedPrintDate;
      const dayName = d.format('dddd');
      const capDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
      return {
        subTitle: `${capDayName}, ngày ${d.format('DD/MM/YYYY')}`,
        fileName: `Lich_Cong_Tac_Ngay_${d.format('DD_MM_YYYY')}`,
      };
    } else {
      const { monday, sunday } = getMondayAndSunday(selectedPrintDate);
      return {
        subTitle: `Tuần từ Thứ Hai (${monday.format('DD/MM/YYYY')}) đến Chủ Nhật (${sunday.format('DD/MM/YYYY')})`,
        fileName: `Lich_Cong_Tac_Tuan_${monday.format('DD_MM_YYYY')}_den_${sunday.format('DD_MM_YYYY')}`,
      };
    }
  }, [printRangeType, selectedPrintDate]);

  // In ngay qua iframe độc lập
  const handlePrint = (isExportPdf = false) => {
    const printElement = document.getElementById('work-schedule-print-content');
    if (!printElement) return;

    let iframe = document.getElementById('work-schedule-print-iframe');
    if (iframe) {
      document.body.removeChild(iframe);
    }
    iframe = document.createElement('iframe');
    iframe.id = 'work-schedule-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const contentHtml = printElement.innerHTML;
    const iframeDoc = iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${printTitleInfo.fileName}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm 12mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 13px;
            line-height: 1.4;
            color: #000;
            margin: 0;
            padding: 0;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .font-semibold { font-weight: 600; }
          .italic { font-style: italic; }
          .uppercase { text-transform: uppercase; }
          table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #333;
            font-size: 12px;
            margin-top: 10px;
          }
          th, td {
            border: 1px solid #333;
            padding: 6px 8px;
            vertical-align: top;
          }
          th {
            background-color: #f1f5f9 !important;
            font-weight: bold;
            text-align: center;
          }
          tr {
            page-break-inside: avoid;
          }
          .header-line {
            width: 100px;
            height: 1px;
            background: #000;
            margin: 4px auto 0 auto;
          }
          .no-print {
            display: none !important;
          }
        </style>
      </head>
      <body>
        ${contentHtml}
      </body>
      </html>
    `);
    iframeDoc.close();

    if (isExportPdf) {
      message.info({
        content: 'Tại hộp thoại in, vui lòng chọn Máy in là "Lưu dưới dạng PDF" (Save as PDF) để lưu file PDF sắc nét.',
        duration: 6,
        key: 'pdf_tip',
      });
    }

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 500);
  };

  // Xuất file PDF (tự động tải file PDF)
  const handleExportPdf = async () => {
    if (printSchedules.length === 0) {
      message.warning('Không có lịch công tác nào để xuất file PDF.');
      return;
    }

    try {
      setExportingPdf(true);
      const printElement = document.getElementById('work-schedule-print-content');
      if (!printElement) return;

      message.loading({ content: 'Đang tạo file PDF...', key: 'pdf_export' });

      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const opt = {
        margin: [8, 8, 8, 8],
        filename: `${printTitleInfo.fileName}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
      };

      await html2pdf().set(opt).from(printElement).save();
      message.success({ content: 'Xuất file PDF thành công!', key: 'pdf_export' });
    } catch (err) {
      console.warn('html2pdf fallback sang iframe print:', err);
      handlePrint(true);
    } finally {
      setExportingPdf(false);
    }
  };

  // Xuất file Excel định dạng chuẩn
  const handleExportExcel = async () => {
    if (printSchedules.length === 0) {
      message.warning('Không có lịch công tác nào để xuất file Excel.');
      return;
    }

    try {
      setExportingExcel(true);
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Trường Cao đẳng Bách Khoa Nam Sài Gòn';
      workbook.created = new Date();

      const ws = workbook.addWorksheet('Lịch Công Tác', {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
      });

      ws.columns = [
        { key: 'colDate', width: 22 },
        { key: 'colTime', width: 16 },
        { key: 'colContent', width: 44 },
        { key: 'colParticipants', width: 26 },
        { key: 'colLocation', width: 24 },
        { key: 'colNotes', width: 22 },
      ];

      const thinBorder = {
        top: { style: 'thin', color: { argb: 'FF999999' } },
        left: { style: 'thin', color: { argb: 'FF999999' } },
        bottom: { style: 'thin', color: { argb: 'FF999999' } },
        right: { style: 'thin', color: { argb: 'FF999999' } },
      };

      // Header trường học
      const r1 = ws.addRow(['ỦY BAN NHÂN DÂN THÀNH PHỐ HỒ CHÍ MINH', '', '', '', '', '']);
      ws.mergeCells(`A${r1.number}:F${r1.number}`);
      r1.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true };
      r1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      const r2 = ws.addRow(['TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN', '', '', '', '', '']);
      ws.mergeCells(`A${r2.number}:F${r2.number}`);
      r2.getCell(1).font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF003366' } };
      r2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      ws.addRow([]);

      const rTitle = ws.addRow(['LỊCH CÔNG TÁC NHÀ TRƯỜNG', '', '', '', '', '']);
      ws.mergeCells(`A${rTitle.number}:F${rTitle.number}`);
      rTitle.getCell(1).font = { name: 'Times New Roman', size: 15, bold: true, color: { argb: 'FF003366' } };
      rTitle.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      const rSub = ws.addRow([printTitleInfo.subTitle, '', '', '', '', '']);
      ws.mergeCells(`A${rSub.number}:F${rSub.number}`);
      rSub.getCell(1).font = { name: 'Times New Roman', size: 11, italic: true };
      rSub.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      const rExportTime = ws.addRow([`Thời gian xuất: ${dayjs().format('DD/MM/YYYY HH:mm')}`, '', '', '', '', '']);
      ws.mergeCells(`A${rExportTime.number}:F${rExportTime.number}`);
      rExportTime.getCell(1).font = { name: 'Times New Roman', size: 10, italic: true, color: { argb: 'FF666666' } };
      rExportTime.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      ws.addRow([]);

      const headerRow = ws.addRow([
        'Thứ, Ngày',
        'Thời gian',
        'Nội dung công tác',
        'Thành phần',
        'Địa điểm',
        'Ghi chú',
      ]);
      headerRow.height = 26;
      for (let c = 1; c <= 6; c++) {
        const cell = headerRow.getCell(c);
        cell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF003366' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = thinBorder;
      }

      groupedPrintSchedules.forEach((group) => {
        const startRow = ws.lastRow.number + 1;
        const d = dayjs(group.dateStr);
        const dayOfWeek = d.format('dddd');
        const capDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
        const dateLabel = `${capDay}\n${d.format('DD/MM/YYYY')}`;

        group.items.forEach((item) => {
          const timeText =
            item.startTime && item.endTime
              ? `${item.startTime} - ${item.endTime}`
              : item.startTime
              ? `${item.startTime}`
              : 'Cả ngày';

          let contentText = item.content || '';
          if (item.host) {
            contentText += `\nChủ trì: ${item.host}`;
          }

          const isMultiDay =
            item.startDate &&
            item.endDate &&
            dayjs(item.startDate).format('YYYY-MM-DD') !== dayjs(item.endDate).format('YYYY-MM-DD');
          if (isMultiDay) {
            contentText += `\n(Diễn ra từ ${dayjs(item.startDate).format('DD/MM')} đến ${dayjs(item.endDate).format('DD/MM')})`;
          }

          const row = ws.addRow([
            dateLabel,
            timeText,
            contentText,
            item.participants || '',
            item.location || '',
            item.notes || '',
          ]);

          row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
          row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
          row.getCell(6).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

          for (let c = 1; c <= 6; c++) {
            row.getCell(c).font = { name: 'Times New Roman', size: 11 };
            row.getCell(c).border = thinBorder;
          }
        });

        const endRow = ws.lastRow.number;
        if (endRow > startRow) {
          ws.mergeCells(`A${startRow}:A${endRow}`);
        }
      });

      ws.addRow([]);
      ws.addRow([]);

      const sigRow1 = ws.addRow(['', '', '', '', 'TP. Hồ Chí Minh, ngày ... tháng ... năm ' + dayjs().format('YYYY'), '']);
      ws.mergeCells(`E${sigRow1.number}:F${sigRow1.number}`);
      sigRow1.getCell(5).font = { name: 'Times New Roman', size: 11, italic: true };
      sigRow1.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

      const sigRow2 = ws.addRow(['', '', '', '', 'HIỆU TRƯỞNG', '']);
      ws.mergeCells(`E${sigRow2.number}:F${sigRow2.number}`);
      sigRow2.getCell(5).font = { name: 'Times New Roman', size: 11, bold: true };
      sigRow2.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

      const sigRow3 = ws.addRow(['', '', '', '', '(Ký, đóng dấu)', '']);
      ws.mergeCells(`E${sigRow3.number}:F${sigRow3.number}`);
      sigRow3.getCell(5).font = { name: 'Times New Roman', size: 10, italic: true };
      sigRow3.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${printTitleInfo.fileName}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      message.success('Xuất file Excel thành công!');
    } catch (err) {
      console.error('Lỗi xuất Excel:', err);
      message.error('Không thể xuất file Excel: ' + (err.message || ''));
    } finally {
      setExportingExcel(false);
    }
  };

  // Tải file Excel mẫu nhập lịch công tác
  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Mau_Nhap_Lich');

      ws.columns = [
        { header: 'Ngày (DD/MM/YYYY)', key: 'date', width: 20 },
        { header: 'Giờ bắt đầu (HH:mm)', key: 'startTime', width: 20 },
        { header: 'Giờ kết thúc (HH:mm)', key: 'endTime', width: 20 },
        { header: 'Nội dung công tác (*)', key: 'content', width: 45 },
        { header: 'Thành phần tham dự', key: 'participants', width: 30 },
        { header: 'Địa điểm', key: 'location', width: 25 },
        { header: 'Chủ trì', key: 'host', width: 25 },
        { header: 'Ghi chú', key: 'notes', width: 25 },
      ];

      // Format header
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Times New Roman' };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      headerRow.height = 30;

      for (let i = 1; i <= 8; i++) {
        headerRow.getCell(i).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF003366' },
        };
        headerRow.getCell(i).border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }

      // Thêm một số dòng mẫu
      const sampleRows = [
        [
          dayjs().format('DD/MM/YYYY'),
          '08:00',
          '10:30',
          'Họp Ban Giám Hiệu thường kỳ đầu tuần',
          'Ban Giám Hiệu, Trưởng các Phòng, Khoa',
          'Phòng họp Ban Giám Hiệu',
          'Hiệu trưởng',
          'Các đơn vị chuẩn bị báo cáo tiến độ tuần',
        ],
        [
          dayjs().format('DD/MM/YYYY'),
          '14:00',
          '16:30',
          'Làm việc với Đoàn công tác Sở GD&ĐT TP.HCM',
          'Ban Giám Hiệu, Phòng Đào tạo',
          'Phòng HĐTT',
          'Hiệu trưởng',
          'Phòng Đào tạo chuẩn bị tài liệu tiếp đoàn',
        ],
        [
          dayjs().add(1, 'day').format('DD/MM/YYYY'),
          '09:00',
          '11:00',
          'Tập huấn ứng dụng công nghệ thông tin và số hóa văn bản',
          'Toàn thể cán bộ, giảng viên, nhân viên',
          'Hội trường A',
          'Phó Hiệu trưởng',
          'Tổ CNTT chuẩn bị âm thanh, máy chiếu',
        ],
      ];

      sampleRows.forEach((rowValues) => {
        const row = ws.addRow(rowValues);
        row.font = { name: 'Times New Roman', size: 11 };
        row.alignment = { vertical: 'middle', wrapText: true };
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

        for (let c = 1; c <= 8; c++) {
          row.getCell(c).border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        }
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Mau_Nhap_Lich_Cong_Tac_NSG.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
      message.success('Đã tải xuống file mẫu nhập lịch công tác!');
    } catch (err) {
      console.error('Lỗi tải template Excel:', err);
      message.error('Không thể tạo file mẫu Excel: ' + (err.message || ''));
    }
  };

  // Thực hiện import file Excel lịch công tác
  const handleExecuteImport = async () => {
    if (!importFile) {
      message.warning('Vui lòng chọn file Excel (.xlsx) để import.');
      return;
    }

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', importFile);

      const res = await importWorkSchedules(formData);
      if (res && res.success) {
        message.success(res.message || 'Import lịch công tác thành công!');
        setImportModalVisible(false);
        setImportFile(null);
        loadData();
      } else {
        message.error(res?.message || 'Import thất bại.');
      }
    } catch (err) {
      console.error('Lỗi import:', err);
      message.error(err?.response?.data?.message || 'Có lỗi xảy ra trong quá trình import lịch công tác.');
    } finally {
      setImporting(false);
    }
  };


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

            {/* Manager, Hiệu trưởng & Admin: Import lịch từ Excel */}
            {canDirectAdd && (
              <Button
                icon={<UploadOutlined />}
                onClick={() => {
                  setImportFile(null);
                  setImportModalVisible(true);
                }}
                className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-700 text-xs sm:text-sm font-semibold h-9 flex-1 sm:flex-none"
              >
                Import lịch công tác
              </Button>
            )}

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
            ...(!hideMyRegisteredTab
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
            ...(!isManagerUser && canApprove
              ? [
                  {
                    key: 'pending',
                    label: (
                      <span className="flex items-center gap-1.5 font-semibold text-xs sm:text-sm px-1">
                        <ClockCircleTwoTone twoToneColor="#faad14" />
                        {isAdminUser ? 'Lịch đăng ký / Chờ xét duyệt' : 'Chờ xét duyệt'}
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

        {/* Bộ lọc trạng thái cho Tab Lịch tôi đã đăng ký và Tab Chờ xét duyệt của Admin */}
        {((activeTab === 'my_registered' && !hideMyRegisteredTab) || (activeTab === 'pending' && isAdminUser)) && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 mt-2 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-700">Trạng thái:</span>
              <Segmented

                value={approvalStatusFilter}
                onChange={handleStatusFilterChange}
                options={[
                  {
                    label: <span className="px-1.5 font-medium">Tất cả lịch</span>,
                    value: 'ALL',
                  },
                  {
                    label: (
                      <span className="flex items-center gap-1.5 px-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                        <span>Chờ duyệt</span>
                        {activeTab === 'pending' && pendingCount > 0 && (
                          <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                            {pendingCount}
                          </span>
                        )}
                      </span>
                    ),
                    value: 'PENDING',
                  },
                  {
                    label: (
                      <span className="flex items-center gap-1.5 px-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                        <span>Đã duyệt</span>
                      </span>
                    ),
                    value: 'APPROVED',
                  },
                  {
                    label: (
                      <span className="flex items-center gap-1.5 px-1.5 font-medium">
                        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                        <span>Từ chối</span>
                      </span>
                    ),
                    value: 'REJECTED',
                  },
                ]}
              />
            </div>
            <div className="text-xs text-slate-500 italic">
              {activeTab === 'pending'
                ? 'Hiển thị tất cả các lịch do Phó Hiệu trưởng và Cấp trưởng đăng ký'
                : 'Xem danh sách lịch do bạn đăng ký: chưa duyệt, đã duyệt và từ chối'}
            </div>
          </div>
        )}

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
                    ? 'Không có lịch công tác nào phù hợp với bộ lọc.'
                    : 'Không có lịch công tác nào phù hợp với bộ lọc.'}
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

            {paginatedGroups.map((group) => (
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
                  <table className={`w-full ${showApprovalCol ? 'min-w-[1060px]' : 'min-w-[960px]'} border-collapse text-xs sm:text-sm`}>
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold text-xs border-b border-slate-300">
                        <th className="p-2.5 text-center w-28 border-r border-slate-200 shrink-0">Thời gian</th>
                        <th className="p-2.5 text-left min-w-[200px] border-r border-slate-200">Nội dung công tác</th>
                        <th className="p-2.5 text-left w-64 sm:w-72 border-r border-slate-200">Thành phần</th>
                        <th className="p-2.5 text-left w-40 border-r border-slate-200">Địa điểm</th>
                        {showApprovalCol && (
                          <th className="p-2.5 text-left w-44 border-r border-slate-200">Đăng ký / Duyệt</th>
                        )}
                        <th className="p-2.5 text-left w-36 border-r border-slate-200">
                          {showApprovalCol ? 'Trạng thái & Ghi chú' : 'Ghi chú'}
                        </th>
                        <th className="p-2.5 text-center w-24 shrink-0">Thao tác</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {group.items.map((item, idx) => {
                        const isOwner =
                          item.createdBy?._id?.toString() === currentUserId ||
                          item.createdBy?.toString() === currentUserId;

                        const isManagerOrBGH = Boolean(
                          userRoleInfo?.isBGH ||
                          userRoleInfo?.isManager ||
                          canDirectAdd ||
                          canApprove
                        );

                        // Đối với quyền Manager và Ban giám hiệu: có thêm nút Chỉnh sửa và Xóa đối với những lịch đã được duyệt và chờ duyệt
                        // Đối với Cấp trưởng/Cấp phó/chuyên viên: chỉ sửa/xóa được lịch của chính mình khi chưa duyệt (status !== 'APPROVED')
                        const canEditItem =
                          isManagerOrBGH ||
                          (isOwner && item.status !== 'APPROVED');

                        const canDeleteItem =
                          isManagerOrBGH ||
                          (isOwner && item.status !== 'APPROVED');

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
                            onClick={() => handleOpenDetail(item)}
                            className={`cursor-pointer hover:bg-blue-50/70 transition-colors ${
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

                            {/* Cột 5: Đăng ký / Duyệt (Chỉ hiển thị ở tab Chờ xét duyệt và Lịch tôi đã đăng ký) */}
                            {showApprovalCol && (
                              <td className="p-2.5 align-top text-xs space-y-1 border-r border-slate-200">
                                {item.createdBy?.name && (
                                  <div className="text-slate-600">
                                    <span className="text-slate-400">
                                      {item.createdBy?.role === 'manager' || item.isDirectIssuedByManager ? 'Ban hành: ' : 'Đăng ký: '}
                                    </span>
                                    <b className="text-slate-800">{item.createdBy.name}</b>
                                    {(item.createdBy?.role === 'manager' || item.isDirectIssuedByManager) && (
                                      <Tag color="purple" className="text-[10px] ml-1 px-1 py-0 border-purple-200 bg-purple-50 text-purple-700 font-normal">Manager</Tag>
                                    )}
                                  </div>
                                )}
                                {item.targetApprover?.name && (
                                  <div className="text-indigo-700">
                                    <span className="text-slate-400">Gửi duyệt: </span>
                                    <b>{item.targetApprover.name}</b>
                                  </div>
                                )}
                                {item.approvedBy?.name &&
                                  item.createdBy?.role !== 'manager' &&
                                  !item.isDirectIssuedByManager &&
                                  item.approvedBy?._id?.toString() !== item.createdBy?._id?.toString() && (
                                    <div className="text-emerald-700">
                                      <span className="text-slate-400">Đã duyệt: </span>
                                      <b>{item.approvedBy.name}</b>
                                    </div>
                                  )}
                              </td>
                            )}


                            {/* Cột 6: Trạng thái & Ghi chú */}
                            <td className="p-2.5 align-top text-xs space-y-1.5 border-r border-slate-200">
                              {showApprovalCol && (
                                <div>{renderStatusTag(item.status, item.rejectionReason)}</div>
                              )}
                              {item.notes ? (
                                <div className="text-slate-600 italic break-words line-clamp-3">
                                  <InfoCircleOutlined className="text-blue-500 mr-1 not-italic" />
                                  {item.notes}
                                </div>
                              ) : !showApprovalCol ? (
                                <span className="text-slate-400 italic">--</span>
                              ) : null}
                              {item.status === 'REJECTED' && item.rejectionReason && (
                                <div className="text-red-600 text-[11px] bg-red-50 p-1.5 rounded border border-red-200">
                                  <b>Lý do:</b> {item.rejectionReason}
                                </div>
                              )}
                            </td>

                            {/* Cột 7: Thao tác */}
                            <td 
                              className="p-2.5 text-center align-middle whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Xem chi tiết lịch (Hiển thị cho tất cả đối tượng: BGH, Manager, Cấp trưởng, Cấp phó, GV/CV) */}
                                <Tooltip title="Xem chi tiết lịch">
                                  <Button
                                    size="small"
                                    icon={<EyeOutlined className="text-slate-600 text-xs" />}
                                    onClick={() => handleOpenDetail(item)}
                                    className="h-7 w-7 flex items-center justify-center p-0 rounded-md border-slate-300 hover:border-blue-500 hover:text-blue-600 bg-white shadow-2xs"
                                  />
                                </Tooltip>

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

                                {/* Sửa (chỉ BGH nếu đã duyệt, hoặc người tạo khi chưa duyệt) */}
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

            {/* Phân trang */}
            {groupedSchedules.length > 0 && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-500 font-medium">
                  Hiển thị từ ngày <b>{(currentPage - 1) * pageSize + 1}</b> - <b>{Math.min(currentPage * pageSize, groupedSchedules.length)}</b> trong tổng số <b>{groupedSchedules.length}</b> ngày ({schedules.length} lịch công tác)
                </span>
                <Pagination
                  current={currentPage}
                  pageSize={pageSize}
                  total={groupedSchedules.length}
                  onChange={(page, size) => {
                    setCurrentPage(page);
                    setPageSize(size);
                    window.scrollTo({ top: 250, behavior: 'smooth' });
                  }}
                  showSizeChanger
                  pageSizeOptions={['5', '10', '15', '20']}
                  size="small"
                />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Modal Xem Chi Tiết Lịch Công Tác */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-base font-bold text-[#003366]">
            <CalendarOutlined className="text-blue-600 text-lg" />
            <span>Chi Tiết Lịch Công Tác</span>
          </div>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setDetailModalVisible(false)} className="bg-[#003366]">
            Đóng
          </Button>,
        ]}
        width={680}
        destroyOnClose
      >
        {detailItem && (
          <div className="py-2 space-y-4 text-xs sm:text-sm">
            {/* Nội dung chính */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">
                Nội dung cuộc họp / công tác:
              </div>
              <div className="font-bold text-slate-900 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                {detailItem.content}
              </div>
              {detailItem.host && (
                <div className="mt-2 text-xs">
                  <Tag color="purple" className="font-semibold">
                    Chủ trì: {detailItem.host}
                  </Tag>
                </div>
              )}
            </div>

            {/* Thông tin thời gian, địa điểm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
                  <ClockCircleOutlined className="text-blue-600" />
                  <span>Thời gian</span>
                </div>
                <div className="font-semibold text-slate-800">
                  {dayjs(detailItem.startDate).format('DD/MM/YYYY')}
                  {detailItem.endDate &&
                    dayjs(detailItem.startDate).format('YYYY-MM-DD') !== dayjs(detailItem.endDate).format('YYYY-MM-DD') && (
                      <span> → {dayjs(detailItem.endDate).format('DD/MM/YYYY')}</span>
                    )}
                </div>
                <div className="text-xs text-blue-700 font-bold mt-0.5">
                  {detailItem.startTime && detailItem.endTime
                    ? `${detailItem.startTime} - ${detailItem.endTime}`
                    : detailItem.startTime
                    ? `Từ ${detailItem.startTime}`
                    : 'Cả ngày'}
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
                  <EnvironmentOutlined className="text-red-500" />
                  <span>Địa điểm</span>
                </div>
                <div className="font-semibold text-slate-800">
                  {detailItem.location || <span className="text-slate-400 italic">Chưa xác định</span>}
                </div>
              </div>
            </div>

            {/* Thành phần */}
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mb-1">
                <TeamOutlined className="text-blue-500" />
                <span>Thành phần tham dự</span>
              </div>
              <div className="text-slate-800 leading-normal">
                {detailItem.participants || <span className="text-slate-400 italic">Không có thông tin</span>}
              </div>
            </div>

            {/* Quy trình đăng ký & phê duyệt */}
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-400 font-medium mb-2">Quy trình đăng ký & Phê duyệt</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 block">Người đăng ký:</span>
                  <b className="text-slate-800">{detailItem.createdBy?.name || '--'}</b>
                </div>
                <div>
                  <span className="text-slate-400 block">Gửi BGH duyệt:</span>
                  <b className="text-indigo-700">{detailItem.targetApprover?.name || '--'}</b>
                </div>
                <div>
                  <span className="text-slate-400 block">Trạng thái:</span>
                  <div className="mt-0.5">{renderStatusTag(detailItem.status, detailItem.rejectionReason)}</div>
                </div>
              </div>

              {detailItem.approvedBy &&
                detailItem.createdBy?.role !== 'manager' &&
                !detailItem.isDirectIssuedByManager &&
                detailItem.approvedBy?._id?.toString() !== detailItem.createdBy?._id?.toString() && (
                  <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-emerald-700">
                    <b>Đã phê duyệt bởi:</b> {detailItem.approvedBy?.name}
                    {detailItem.approvedAt && (
                      <span className="text-slate-400 ml-1">
                        ({dayjs(detailItem.approvedAt).format('DD/MM/YYYY HH:mm')})
                      </span>
                    )}
                  </div>
                )}

              {detailItem.status === 'REJECTED' && detailItem.rejectionReason && (
                <div className="mt-2 p-2 bg-red-50 rounded border border-red-200 text-red-700 text-xs">
                  <b>Lý do từ chối:</b> {detailItem.rejectionReason}
                </div>
              )}

            </div>

            {detailItem.notes && (
              <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200">
                <div className="text-xs text-amber-800 font-semibold mb-1 flex items-center gap-1">
                  <InfoCircleOutlined />
                  <span>Ghi chú:</span>
                </div>
                <div className="text-slate-700 italic text-xs leading-relaxed whitespace-pre-wrap">
                  {detailItem.notes}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

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
                : userRoleInfo?.isPhoHieuTruong
                ? 'Đăng Ký Lịch Công Tác (Gửi Hiệu trưởng xét duyệt)'
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
              description={
                userRoleInfo?.isPhoHieuTruong
                  ? 'Lịch sau khi đăng ký sẽ được gửi đến Thầy/Cô Hiệu trưởng để xét duyệt trước khi hiển thị chính thức trên toàn trường.'
                  : 'Lịch sau khi đăng ký sẽ được chuyển đến Ban Giám Hiệu được chỉ định để xét duyệt trước khi hiển thị chính thức trên toàn trường.'
              }
              className="mb-4 text-xs"
            />
          )}

          {!canDirectAdd && (
            <Form.Item
              name="targetApprover"
              label={
                <span className="font-semibold text-slate-800">
                  {userRoleInfo?.isPhoHieuTruong ? 'Người duyệt (Hiệu trưởng)' : 'Người duyệt (Ban Giám Hiệu)'}{' '}
                  <span className="text-red-500">*</span>
                </span>
              }
              rules={[{ required: true, message: 'Vui lòng chọn người phê duyệt' }]}
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

      {/* Modal In & Xuất Lịch Tuần / Ngày */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800">
            <PrinterOutlined className="text-[#003366] text-lg" />
            <span className="font-bold text-base sm:text-lg">In & Xuất Lịch Công Tác</span>
          </div>
        }
        open={printModalVisible}
        onCancel={() => setPrintModalVisible(false)}
        width={1200}
        style={{ top: 20, maxWidth: '96vw' }}
        bodyStyle={{ maxHeight: 'calc(85vh - 120px)', overflowY: 'auto', padding: '16px 20px' }}
        footer={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-500 text-left hidden md:block">
              💡 <span className="italic">Xuất Excel để tùy biến mẫu in hoặc In trực tiếp / Xuất PDF khổ giấy A4 ngang chuẩn văn phòng.</span>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              <Button
                key="close"
                size="middle"
                onClick={() => setPrintModalVisible(false)}
                className="w-full sm:w-auto order-4 sm:order-1"
              >
                Đóng
              </Button>
              <Button
                key="excel"
                size="middle"
                icon={<FileExcelOutlined />}
                loading={exportingExcel}
                onClick={handleExportExcel}
                className="w-full sm:w-auto order-1 sm:order-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-700 font-medium"
              >
                Xuất Excel
              </Button>
              <Button
                key="pdf"
                size="middle"
                icon={<FilePdfOutlined />}
                loading={exportingPdf}
                onClick={handleExportPdf}
                className="w-full sm:w-auto order-2 sm:order-3 border-rose-600 text-rose-700 hover:bg-rose-50 hover:border-rose-700 font-medium"
              >
                Xuất PDF
              </Button>
              <Button
                key="print"
                type="primary"
                size="middle"
                icon={<PrinterOutlined />}
                onClick={() => handlePrint(false)}
                className="w-full sm:w-auto order-3 sm:order-4 bg-[#003366] hover:bg-[#002244] font-medium shadow-sm"
              >
                In ngay
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Thanh tùy chọn phạm vi in/xuất */}
          <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Chọn chế độ Tuần / Ngày */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-xs sm:text-sm text-slate-700">Phạm vi:</span>
                <Segmented
                  value={printRangeType}
                  onChange={(val) => setPrintRangeType(val)}
                  options={[
                    { label: '📅 Lịch cả tuần (Thứ 2 - CN)', value: 'week' },
                    { label: '📆 Lịch ngày', value: 'today' },
                  ]}
                  className="bg-white border border-slate-200 font-medium text-xs sm:text-sm"
                />
              </div>

              {/* Điều hướng thời gian */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {printRangeType === 'week' ? (
                  <>
                    <Button.Group size="middle">
                      <Button
                        icon={<LeftOutlined />}
                        onClick={() => setSelectedPrintDate((prev) => prev.subtract(7, 'day'))}
                      >
                        Tuần trước
                      </Button>
                      <Button
                        onClick={() => setSelectedPrintDate(dayjs())}
                        className={selectedPrintDate.isSame(dayjs(), 'week') ? 'font-bold text-blue-700 border-blue-400 bg-blue-50' : ''}
                      >
                        Tuần này
                      </Button>
                      <Button
                        onClick={() => setSelectedPrintDate((prev) => prev.add(7, 'day'))}
                      >
                        Tuần sau <RightOutlined />
                      </Button>
                    </Button.Group>
                    <DatePicker
                      size="middle"
                      value={selectedPrintDate}
                      onChange={(d) => d && setSelectedPrintDate(d)}
                      format="DD/MM/YYYY"
                      placeholder="Chọn tuần"
                      className="w-32"
                    />
                  </>
                ) : (
                  <>
                    <Button.Group size="middle">
                      <Button
                        icon={<LeftOutlined />}
                        onClick={() => setSelectedPrintDate((prev) => prev.subtract(1, 'day'))}
                      >
                        Hôm qua
                      </Button>
                      <Button
                        onClick={() => setSelectedPrintDate(dayjs())}
                        className={selectedPrintDate.isSame(dayjs(), 'day') ? 'font-bold text-blue-700 border-blue-400 bg-blue-50' : ''}
                      >
                        Hôm nay
                      </Button>
                      <Button
                        onClick={() => setSelectedPrintDate((prev) => prev.add(1, 'day'))}
                      >
                        Ngày mai <RightOutlined />
                      </Button>
                    </Button.Group>
                    <DatePicker
                      size="middle"
                      value={selectedPrintDate}
                      onChange={(d) => d && setSelectedPrintDate(d)}
                      format="DD/MM/YYYY"
                      placeholder="Chọn ngày"
                      className="w-32"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Thông tin phạm vi đang xem */}
            <div className="text-xs text-slate-600 flex items-center gap-2 pt-2 border-t border-slate-200/80 flex-wrap">
              <span className="font-semibold text-[#003366]">Đang hiển thị:</span>
              <Tag color="blue" className="font-medium text-xs">
                {printTitleInfo.subTitle}
              </Tag>
              <span className="text-gray-300">|</span>
              <span>Tổng cộng: <b className="text-slate-800">{printSchedules.length}</b> lịch công tác đã duyệt</span>
            </div>
          </div>

          {/* Gợi ý cuộn ngang cho thiết bị màn hình nhỏ */}
          <div className="block lg:hidden text-[11px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded border border-amber-200 text-center">
            👉 Vuốt ngang bảng để xem đầy đủ các cột nội dung, thành phần, địa điểm
          </div>

          {/* Vùng xem trước & nội dung in */}
          <div id="work-schedule-print-content" className="p-4 sm:p-6 bg-white text-slate-900 border border-slate-200 rounded-lg overflow-x-auto shadow-inner">
            <div className="text-center mb-6">
              <div className="font-bold text-xs sm:text-sm uppercase tracking-wider text-gray-700">
                ỦY BAN NHÂN DÂN THÀNH PHỐ HỒ CHÍ MINH
              </div>
              <div className="font-bold text-sm sm:text-base uppercase text-[#003366] mt-0.5">
                TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN
              </div>
              <div className="w-32 h-[1.5px] bg-[#003366] mx-auto my-2"></div>
              <h2 className="text-lg sm:text-xl font-bold uppercase mt-3 text-slate-800 tracking-wide">
                LỊCH CÔNG TÁC NHÀ TRƯỜNG
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 italic mt-0.5">
                {printTitleInfo.subTitle}
              </p>
              <p className="text-[11px] text-gray-400 italic mt-0.5">
                Thời gian xuất: {dayjs().format('DD/MM/YYYY HH:mm')}
              </p>
            </div>

            {printLoading ? (
              <div className="py-12 text-center">
                <Spin tip="Đang tải dữ liệu lịch công tác..." />
              </div>
            ) : (
              <table className="w-full min-w-[840px] lg:min-w-[1000px] border-collapse border border-gray-400 text-xs">
                <thead>
                  <tr className="bg-gray-100 text-center font-bold text-slate-800">
                    <th className="border border-gray-400 p-2.5 w-32">Thứ, Ngày</th>
                    <th className="border border-gray-400 p-2.5 w-28">Thời gian</th>
                    <th className="border border-gray-400 p-2.5 min-w-[260px]">Nội dung công tác</th>
                    <th className="border border-gray-400 p-2.5 w-44">Thành phần</th>
                    <th className="border border-gray-400 p-2.5 w-40">Địa điểm</th>
                    <th className="border border-gray-400 p-2.5 w-32">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedPrintSchedules.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-6 text-gray-400 border border-gray-400 italic">
                        Không có lịch công tác nào trong khoảng thời gian này.
                      </td>
                    </tr>
                  ) : (
                    groupedPrintSchedules.map((group) => {
                      const d = dayjs(group.dateStr);
                      const dayOfWeek = d.format('dddd');
                      const capDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
                      return (
                        <React.Fragment key={group.dateStr}>
                          {group.items.map((item, idx) => {
                            const isMultiDay =
                              item.startDate &&
                              item.endDate &&
                              dayjs(item.startDate).format('YYYY-MM-DD') !== dayjs(item.endDate).format('YYYY-MM-DD');

                            return (
                              <tr key={item._id} className="hover:bg-gray-50">
                                {idx === 0 && (
                                  <td
                                    rowSpan={group.items.length}
                                    className={`border border-gray-400 p-2 font-bold text-center align-top ${
                                      group.isToday ? 'bg-blue-50 text-blue-900' : 'bg-gray-50 text-slate-800'
                                    }`}
                                  >
                                    <div className="text-[13px]">{capDay}</div>
                                    <div className="text-gray-600 font-normal">
                                      {d.format('DD/MM/YYYY')}
                                    </div>
                                    {group.isToday && (
                                      <span className="text-[10px] text-blue-700 font-bold block mt-0.5">
                                        [HÔM NAY]
                                      </span>
                                    )}
                                  </td>
                                )}
                                <td className="border border-gray-400 p-2 text-center font-semibold align-top text-slate-700">
                                  {item.startTime && item.endTime
                                    ? `${item.startTime} - ${item.endTime}`
                                    : item.startTime
                                    ? `${item.startTime}`
                                    : 'Cả ngày'}
                                </td>
                                <td className="border border-gray-400 p-2 align-top font-medium leading-relaxed">
                                  <div>{item.content}</div>
                                  {item.host && (
                                    <div className="text-[11px] text-purple-700 mt-1 font-semibold">
                                      <span>Chủ trì: </span>{item.host}
                                    </div>
                                  )}
                                  {isMultiDay && (
                                    <div className="text-[11px] text-blue-600 italic mt-0.5">
                                      (Diễn ra từ {dayjs(item.startDate).format('DD/MM')} đến {dayjs(item.endDate).format('DD/MM')})
                                    </div>
                                  )}
                                </td>
                                <td className="border border-gray-400 p-2 align-top leading-relaxed">{item.participants || '--'}</td>
                                <td className="border border-gray-400 p-2 align-top leading-relaxed">{item.location || '--'}</td>
                                <td className="border border-gray-400 p-2 align-top italic text-gray-500 leading-relaxed">
                                  {item.notes || '--'}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* Ký tên chân trang */}
            <div className="mt-8 flex justify-end text-center">
              <div className="w-64 text-xs">
                <div className="italic text-gray-500">
                  TP. Hồ Chí Minh, ngày ... tháng ... năm {dayjs().format('YYYY')}
                </div>
                <div className="font-bold uppercase text-slate-800 mt-1">
                  HIỆU TRƯỞNG
                </div>
                <div className="italic text-gray-400 text-[11px] mt-0.5">
                  (Ký, đóng dấu)
                </div>
                <div className="h-16"></div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Import Lịch Công Tác từ Excel */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800">
            <UploadOutlined className="text-emerald-600 text-lg" />
            <span className="font-bold text-base sm:text-lg">Import Lịch Công Tác Từ Excel</span>
          </div>
        }
        open={importModalVisible}
        onCancel={() => {
          if (!importing) {
            setImportModalVisible(false);
            setImportFile(null);
          }
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setImportModalVisible(false);
              setImportFile(null);
            }}
            disabled={importing}
          >
            Đóng
          </Button>,
          <Button
            key="import"
            type="primary"
            icon={<FileDoneOutlined />}
            loading={importing}
            onClick={handleExecuteImport}
            className="bg-emerald-600 hover:bg-emerald-700 font-medium"
          >
            Tiến hành Import
          </Button>,
        ]}
        width={600}
        destroyOnClose
      >
        <div className="space-y-4 py-2">
          {/* Hướng dẫn & Tải file mẫu */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-bold text-emerald-900 text-sm">
                  1. Tải về file mẫu Excel chuẩn
                </h4>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  Vui lòng tải file mẫu và điền thông tin lịch công tác theo đúng các cột quy định (Ngày, Giờ, Nội dung, Thành phần, Địa điểm, Chủ trì, Ghi chú).
                </p>
              </div>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
                className="border-emerald-600 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs shrink-0"
              >
                Tải file mẫu (.xlsx)
              </Button>
            </div>
          </div>

          {/* Chọn file import */}
          <div className="space-y-2">
            <label className="font-semibold text-xs sm:text-sm text-slate-700 block">
              2. Chọn file Excel (.xlsx) đã điền thông tin:
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center bg-slate-50/50 transition-colors">
              <input
                type="file"
                id="work-schedule-excel-file"
                accept=".xlsx, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (!file.name.endsWith('.xlsx')) {
                      message.error('Vui lòng chọn file định dạng .xlsx');
                      return;
                    }
                    setImportFile(file);
                  }
                }}
                className="hidden"
              />
              <label htmlFor="work-schedule-excel-file" className="cursor-pointer block">
                <FileExcelOutlined className="text-4xl text-emerald-600 mb-2" />
                <div className="text-xs sm:text-sm font-medium text-slate-700">
                  {importFile ? (
                    <span className="text-emerald-700 font-bold">{importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</span>
                  ) : (
                    <span>Nhấp vào đây để chọn tệp tin Excel (.xlsx)</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Chỉ hỗ trợ tệp Microsoft Excel (.xlsx) tối đa 10MB
                </p>
              </label>
            </div>
          </div>

          {/* Ghi chú */}
          <div className="text-[11px] text-slate-500 bg-slate-100 p-3 rounded-lg space-y-1">
            <div className="font-semibold text-slate-700">Lưu ý khi nhập liệu:</div>
            <div>• Cột <b>Ngày</b> định dạng <code>DD/MM/YYYY</code> (ví dụ: 20/09/2026).</div>
            <div>• Cột <b>Giờ</b> định dạng <code>HH:mm</code> (ví dụ: 08:00, 14:30).</div>
            <div>• Cột <b>Nội dung công tác</b> là bắt buộc.</div>
            <div>• Các lịch sau khi import sẽ được tự động đưa vào danh sách lịch chính thức của nhà trường.</div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WorkSchedulePage;
