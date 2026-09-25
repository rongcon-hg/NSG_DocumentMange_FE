import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  message,
  Popconfirm,
  Tooltip,
  Typography,
  Row,
  Col,
  Statistic,
  Upload,
  Divider,
  Timeline,
  Drawer,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  FileDoneOutlined,
  AuditOutlined,
  PaperClipOutlined,
  UploadOutlined,
  FileExcelOutlined,
  InboxOutlined,
  EyeOutlined,
  SendOutlined,
  HistoryOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import * as XLSX from 'xlsx';
import {
  getQuarterlyPlanMetadata,
  getQuarterlyPlans,
  createQuarterlyPlan,
  updateQuarterlyPlan,
  deleteQuarterlyPlan,
  getQuarterlyPlanDetail,
  createPlanItem,
  updatePlanItem,
  deletePlanItem,
  importPlanItems,
} from '../../api/quarterlyPlanApi';
import { uploadRecordFiles } from '../../api/onlineRecordApi';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Danh sách các nhóm nhiệm vụ mặc định theo chuẩn nhà trường
const DEFAULT_TASK_GROUPS = [
  'I. CÔNG TÁC CHÍNH TRỊ - TƯ TƯỞNG',
  'II. CÔNG TÁC QUẢN LÝ CHIẾN LƯỢC',
  'III. QUẢN LÝ CHUYÊN MÔN',
  'IV. QUẢN LÝ CHUYÊN MÔN',
  'V. QUẢN LÝ VẬT LỰC',
  'VI. QUẢN LÝ HỌC SINH SINH VIÊN',
  'VII. QUẢN LÝ NHÂN LỰC',
  'VIII. HOẠT ĐỘNG ĐOÀN THỂ',
];

// Định nghĩa màu sắc và nhãn theo quy tắc nhận xét tự động
const REMARK_STATUS_MAP = {
  EARLY: {
    color: 'success',
    bg: '#f6ffed',
    border: '#b7eb8f',
    textColor: '#389e0d',
    label: 'Sớm hạn',
    icon: <CheckCircleOutlined />,
  },
  ON_TIME: {
    color: 'success',
    bg: '#f6ffed',
    border: '#b7eb8f',
    textColor: '#389e0d',
    label: 'Đúng hạn',
    icon: <CheckCircleOutlined />,
  },
  IN_PROGRESS: {
    color: 'processing',
    bg: '#e6f4ff',
    border: '#91caff',
    textColor: '#0958d9',
    label: 'Đang làm',
    icon: <ClockCircleOutlined />,
  },
  LATE: {
    color: 'warning',
    bg: '#fffbe6',
    border: '#ffe58f',
    textColor: '#d46b08',
    label: 'Trễ hạn',
    icon: <ExclamationCircleOutlined />,
  },
  OVERDUE: {
    color: 'error',
    bg: '#fff2f0',
    border: '#ffccc7',
    textColor: '#cf1322',
    label: 'Quá hạn',
    icon: <ExclamationCircleOutlined />,
  },
  NOT_STARTED: {
    color: 'default',
    bg: '#fafafa',
    border: '#d9d9d9',
    textColor: '#595959',
    label: 'Chưa làm',
    icon: <ClockCircleOutlined />,
  },
};

// Lựa chọn trạng thái công việc
const STATUS_OPTIONS = [
  { value: 'NOT_STARTED', label: 'Chưa làm', color: 'default', border: 'border-slate-300' },
  { value: 'IN_PROGRESS', label: 'Đang thực hiện', color: 'processing', border: 'border-blue-400' },
  { value: 'COMPLETED', label: 'Đã hoàn thành', color: 'success', border: 'border-emerald-500' },
  { value: 'PAUSED', label: 'Tạm dừng', color: 'warning', border: 'border-amber-400' },
];

// CSS nhúng đảm bảo Table luôn hiển thị thanh cuộn ngang khi bảng rộng hơn khung nhìn, không bị co dọc chữ
const tableScrollStyles = `
  .quarterly-plan-table .ant-table-thead > tr > th {
    white-space: nowrap !important;
    word-break: keep-all !important;
    background-color: #f8fafc !important;
    font-weight: 600 !important;
    color: #334155 !important;
    font-size: 13px !important;
  }
  .quarterly-plan-table .ant-table-cell {
    word-break: normal !important;
  }
  .quarterly-plan-table .ant-table-body,
  .quarterly-plan-table .ant-table-content {
    overflow-x: auto !important;
  }
  .quarterly-plan-table .ant-table-body::-webkit-scrollbar,
  .quarterly-plan-table .ant-table-content::-webkit-scrollbar {
    height: 8px !important;
  }
  .quarterly-plan-table .ant-table-body::-webkit-scrollbar-thumb,
  .quarterly-plan-table .ant-table-content::-webkit-scrollbar-thumb {
    background: #cbd5e1 !important;
    border-radius: 4px !important;
  }
  .quarterly-plan-table .ant-table-body::-webkit-scrollbar-thumb:hover,
  .quarterly-plan-table .ant-table-content::-webkit-scrollbar-thumb:hover {
    background: #94a3b8 !important;
  }
`;

const QuarterlyPlanPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [planItems, setPlanItems] = useState([]);

  // Metadata
  const [departments, setDepartments] = useState([]);
  const [bghUsers, setBghUsers] = useState([]);

  // Modals
  const [createPlanModalVisible, setCreatePlanModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [createItemModalVisible, setCreateItemModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [progressItem, setProgressItem] = useState(null);

  // Modal Chi tiết nhiệm vụ
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  // Modal Lịch sử thay đổi nhiệm vụ
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);

  // Modal Import Excel
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importedPreviewList, setImportedPreviewList] = useState([]);

  // File Upload State
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  // Forms
  const [planForm] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [progressForm] = Form.useForm();

  // Filters
  const [filterYear, setFilterYear] = useState(null); // Lọc năm / năm học của kế hoạch
  const [filterDepartment, setFilterDepartment] = useState(null);
  const [filterBgh, setFilterBgh] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState(''); // Tìm kiếm nội dung công việc thông minh
  const [searchDateRange, setSearchDateRange] = useState(null); // Khoảng thời gian thực hiện công việc

  // User Role Check
  const token = Cookies.get('accessToken');
  let currentUser = null;
  if (token) {
    try {
      currentUser = jwtDecode(token);
    } catch (e) {
      console.error(e);
    }
  }

  const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';
  const posName = (currentUser?.position?.positionName || '').toLowerCase();
  const isLeader =
    currentUser?.role === 'cappho' ||
    posName.includes('trưởng') ||
    posName.includes('phó') ||
    posName.includes('giám đốc') ||
    posName.includes('hiệu trưởng');

  // Lấy danh sách các nhóm nhiệm vụ đã có trong kế hoạch để gợi ý thêm
  const availableGroups = useMemo(() => {
    const setGroups = new Set(DEFAULT_TASK_GROUPS);
    planItems.forEach((item) => {
      if (item.groupName) setGroups.add(item.groupName.trim());
    });
    return Array.from(setGroups);
  }, [planItems]);

  // Hàm tính số thứ tự tiếp theo cho một nhóm nhiệm vụ
  const getNextOrderForGroup = (groupName) => {
    if (!groupName) return 1;
    const itemsInGroup = planItems.filter(
      (item) => item.groupName && item.groupName.trim() === groupName.trim()
    );
    if (itemsInGroup.length === 0) return 1;
    const maxOrder = itemsInGroup.reduce((max, item) => {
      const ord = typeof item.order === 'number' && !isNaN(item.order) ? item.order : 0;
      return Math.max(max, ord);
    }, 0);
    // Nếu maxOrder >= itemsInGroup.length thì lấy maxOrder + 1, hoặc itemsInGroup.length + 1
    return Math.max(maxOrder + 1, itemsInGroup.length + 1);
  };

  // Nhóm danh mục đơn vị: Khoa, Phòng/Ban/Trung tâm, Khác và danh sách ID tất cả đơn vị
  const allDepartmentIds = useMemo(() => departments.map((d) => d._id), [departments]);

  const groupedDepartments = useMemo(() => {
    const facultyList = [];
    const departmentList = [];
    const otherList = [];

    departments.forEach((d) => {
      const name = (d.departmentName || '').toLowerCase();
      if (name.startsWith('khoa')) {
        facultyList.push(d);
      } else if (name.startsWith('phòng') || name.startsWith('trung tâm') || name.startsWith('ban')) {
        departmentList.push(d);
      } else {
        otherList.push(d);
      }
    });

    return [
      { label: 'Khoa chuyên môn', key: 'faculties', items: facultyList },
      { label: 'Phòng / Ban / Trung tâm', key: 'departments', items: departmentList },
      ...(otherList.length > 0 ? [{ label: 'Đơn vị khác', key: 'others', items: otherList }] : []),
    ].filter((g) => g.items.length > 0);
  }, [departments]);

  // Tải danh mục ban đầu (chỉ lấy các đơn vị không bị giải thể)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await getQuarterlyPlanMetadata();
        if (res.success) {
          const rawDepts = res.data.departments || [];
          const activeDepts = rawDepts.filter(
            (d) => !d.departmentName.toLowerCase().includes('giải thể')
          );
          setDepartments(activeDepts);
          setBghUsers(res.data.bghUsers || []);
        }
      } catch (err) {
        console.error('Lỗi tải metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Tải danh sách các Kế hoạch quý - Mặc định chọn kế hoạch của quý và năm hiện tại
  const loadPlans = async () => {
    try {
      setLoading(true);
      const res = await getQuarterlyPlans();
      if (res.success) {
        const planList = res.data || [];
        setPlans(planList);

        if (planList.length > 0 && !selectedPlanId) {
          // Tính toán quý và năm hiện tại
          const now = new Date();
          const currentMonth = now.getMonth() + 1; // 1 - 12
          const currentYear = now.getFullYear();
          const currentQuarter = Math.ceil(currentMonth / 3); // 1, 2, 3, 4

          // Tìm kế hoạch khớp quý & năm hiện tại (so sánh quarter và year hoặc startDate/endDate)
          let matchPlan = planList.find((p) => {
            const matchQ = Number(p.quarter) === currentQuarter;
            const matchY = Number(p.year) === currentYear || (p.academicYear && p.academicYear.includes(String(currentYear)));
            return matchQ && matchY;
          });

          // Nếu không thấy, tìm theo quý hiện tại
          if (!matchPlan) {
            matchPlan = planList.find((p) => Number(p.quarter) === currentQuarter);
          }

          // Fallback kế hoạch đầu tiên nếu không khớp
          const defaultPlan = matchPlan || planList[0];
          setSelectedPlanId(defaultPlan._id);
        }
      }
    } catch (err) {
      message.error('Lỗi tải danh sách kế hoạch quý');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  // Tải chi tiết kế hoạch khi chọn một kế hoạch cụ thể
  const loadPlanDetail = async (planId) => {
    if (!planId) return;
    try {
      setLoading(true);
      const res = await getQuarterlyPlanDetail(planId);
      if (res.success) {
        setCurrentPlan(res.data.plan);
        setPlanItems(res.data.items || []);
      }
    } catch (err) {
      message.error('Lỗi tải chi tiết kế hoạch quý');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPlanId) {
      loadPlanDetail(selectedPlanId);
    }
  }, [selectedPlanId]);

  // Xử lý tạo / sửa Kế hoạch quý
  const handleSavePlan = async (values) => {
    try {
      const payload = {
        title: values.title,
        academicYear: values.academicYear,
        year: values.year,
        quarter: values.quarter,
        startDate: values.dateRange ? values.dateRange[0].toISOString() : null,
        endDate: values.dateRange ? values.dateRange[1].toISOString() : null,
        note: values.note,
      };

      if (editingPlan) {
        const res = await updateQuarterlyPlan(editingPlan._id, payload);
        if (res.success) {
          message.success('Đã cập nhật kế hoạch quý thành công!');
          setCreatePlanModalVisible(false);
          setEditingPlan(null);
          planForm.resetFields();
          await loadPlans();
          loadPlanDetail(editingPlan._id);
        }
      } else {
        const res = await createQuarterlyPlan(payload);
        if (res.success) {
          message.success('Đã tạo kế hoạch quý thành công!');
          setCreatePlanModalVisible(false);
          planForm.resetFields();
          await loadPlans();
          if (res.data?._id) {
            setSelectedPlanId(res.data._id);
          }
        }
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi lưu kế hoạch quý');
    }
  };

  // Xử lý xóa Kế hoạch quý
  const handleDeletePlan = async (planId) => {
    if (!planId) return;
    try {
      const res = await deleteQuarterlyPlan(planId);
      if (res.success) {
        message.success('Đã xóa kế hoạch quý thành công!');
        setSelectedPlanId(null);
        setCurrentPlan(null);
        setPlanItems([]);
        const updatedPlansRes = await getQuarterlyPlans();
        if (updatedPlansRes.success) {
          setPlans(updatedPlansRes.data || []);
          if (updatedPlansRes.data && updatedPlansRes.data.length > 0) {
            setSelectedPlanId(updatedPlansRes.data[0]._id);
          }
        }
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi xóa kế hoạch quý');
    }
  };

  // Upload file đính kèm
  const handleCustomUpload = async ({ file, onSuccess, onError }) => {
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('files', file);
      const res = await uploadRecordFiles(formData);
      if (res.success && res.data && res.data.length > 0) {
        const newFile = res.data[0];
        setUploadedFiles((prev) => [
          ...prev,
          {
            fileId: newFile.fileId,
            fileName: newFile.fileName,
            fileMimeType: newFile.fileMimeType,
            fileSize: newFile.fileSize,
            webViewLink: newFile.webViewLink,
          },
        ]);
        message.success(`Đã tải lên tệp: ${file.name}`);
        onSuccess(res, file);
      } else {
        throw new Error(res.message || 'Tải tệp thất bại');
      }
    } catch (err) {
      console.error(err);
      message.error(err.message || 'Lỗi khi tải tệp');
      onError(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveUploadedFile = (fileId) => {
    setUploadedFiles((prev) => prev.filter((f) => f.fileId !== fileId));
  };

  // Xử lý thêm / cập nhật Nhiệm vụ trong kế hoạch
  const handleSaveItem = async (values) => {
    try {
      const payload = {
        planId: selectedPlanId,
        groupName: values.groupName,
        order: values.order || 0,
        taskContent: values.taskContent,
        expectedOutcome: values.expectedOutcome,
        assignedDepartments: values.assignedDepartments || [],
        coordinatingDepartments: values.coordinatingDepartments || [],
        bghInCharge: values.bghInCharge || [],
        startDate: values.expectedRange ? values.expectedRange[0].toISOString() : null,
        expectedDeadline: values.expectedRange ? values.expectedRange[1].toISOString() : null,
        actualCompletedDate: values.actualCompletedDate ? values.actualCompletedDate.toISOString() : null,
        status: values.status || 'IN_PROGRESS',
        pauseReason: values.pauseReason || '',
        manualRemark: values.manualRemark,
        files: uploadedFiles,
      };

      if (editingItem) {
        const res = await updatePlanItem(editingItem._id, payload);
        if (res.success) {
          message.success('Đã cập nhật nhiệm vụ thành công!');
          setCreateItemModalVisible(false);
          setEditingItem(null);
          setUploadedFiles([]);
          itemForm.resetFields();
          loadPlanDetail(selectedPlanId);
        }
      } else {
        const res = await createPlanItem(payload);
        if (res.success) {
          message.success('Đã thêm nhiệm vụ vào kế hoạch quý!');
          setCreateItemModalVisible(false);
          setUploadedFiles([]);
          itemForm.resetFields();
          loadPlanDetail(selectedPlanId);
        }
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi lưu thông tin nhiệm vụ');
    }
  };

  // Xử lý cập nhật tiến độ & ngày hoàn thành thực tế nhanh
  const handleUpdateProgress = async (values) => {
    if (!progressItem) return;
    try {
      const payload = {
        progressPercent: values.progressPercent,
        actualCompletedDate: values.actualCompletedDate ? values.actualCompletedDate.toISOString() : null,
        status: values.status,
        pauseReason: values.pauseReason || '',
      };
      const res = await updatePlanItem(progressItem._id, payload);
      if (res.success) {
        message.success('Đã cập nhật tiến độ công việc thành công!');
        setProgressModalVisible(false);
        setProgressItem(null);
        progressForm.resetFields();
        loadPlanDetail(selectedPlanId);
      }
    } catch (err) {
      message.error('Lỗi khi cập nhật tiến độ');
    }
  };

  // Xử lý xóa nhiệm vụ
  const handleDeleteItem = async (itemId) => {
    try {
      const res = await deletePlanItem(itemId);
      if (res.success) {
        message.success('Đã xóa nhiệm vụ');
        loadPlanDetail(selectedPlanId);
      }
    } catch (err) {
      message.error('Lỗi khi xóa nhiệm vụ');
    }
  };

  // ==========================================
  // XUẤT EXCEL KẾ HOẠCH QUÝ
  // ==========================================
  const handleExportExcel = () => {
    if (!currentPlan) {
      message.warning('Vui lòng chọn một kế hoạch quý để xuất Excel!');
      return;
    }

    try {
      const rows = [];
      // Tiêu đề lớn
      rows.push(['KẾ HOẠCH CÔNG TÁC TRỌNG TÂM THEO QUÝ']);
      rows.push([`Kế hoạch: ${currentPlan.title} (Quý ${currentPlan.quarter} - Năm học ${currentPlan.academicYear})`]);
      rows.push([`Thời gian: ${currentPlan.startDate ? dayjs(currentPlan.startDate).format('DD/MM/YYYY') : ''} - ${currentPlan.endDate ? dayjs(currentPlan.endDate).format('DD/MM/YYYY') : ''}`]);
      rows.push([]); // Dòng trống

      // Header bảng
      rows.push([
        'STT',
        'Nhóm nhiệm vụ / Trục kết quả',
        'Nội dung công việc',
        'Sản phẩm / Kết quả đầu ra',
        'Đơn vị chủ trì thực hiện',
        'Đơn vị phối hợp',
        'BGH Phụ trách',
        'Hạn dự kiến HT',
        'Thời gian thực tế HT',
        'Trạng thái',
        'Đánh giá nhận xét',
        'Ghi chú thêm',
      ]);

      filteredItems.forEach((item, idx) => {
        const assigned = item.assignedDepartments?.map((d) => d.departmentName).join(', ') || '';
        const coordinating = item.coordinatingDepartments?.map((d) => d.departmentName).join(', ') || '';
        const bgh = item.bghInCharge?.map((u) => `${u.name}${u.position?.positionName ? ` (${u.position.positionName})` : ''}`).join(', ') || '';
        
        let deadlineDisplay = '';
        if (item.startDate && item.expectedDeadline) {
          deadlineDisplay = `${dayjs(item.startDate).format('DD/MM/YYYY')} - ${dayjs(item.expectedDeadline).format('DD/MM/YYYY')}`;
        } else if (item.expectedDeadline) {
          deadlineDisplay = dayjs(item.expectedDeadline).format('DD/MM/YYYY');
        }

        const actualDateDisplay = item.actualCompletedDate ? dayjs(item.actualCompletedDate).format('DD/MM/YYYY') : '';

        rows.push([
          idx + 1,
          item.groupName || '',
          item.taskContent || '',
          item.expectedOutcome || '',
          assigned,
          coordinating,
          bgh,
          deadlineDisplay,
          actualDateDisplay,
          item.status || '',
          item.autoRemark || '',
          item.manualRemark || '',
        ]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(rows);

      // Căn chỉnh độ rộng các cột
      worksheet['!cols'] = [
        { wch: 6 },  // STT
        { wch: 35 }, // Nhóm
        { wch: 45 }, // Nội dung
        { wch: 30 }, // Sản phẩm
        { wch: 28 }, // Chủ trì
        { wch: 25 }, // Phối hợp
        { wch: 25 }, // BGH
        { wch: 25 }, // Hạn dự kiến
        { wch: 15 }, // Thực tế HT
        { wch: 15 }, // Trạng thái
        { wch: 30 }, // Nhận xét
        { wch: 25 }, // Ghi chú
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `KeHoach_Q${currentPlan.quarter}`);

      const fileName = `Ke_Hoach_Quy_${currentPlan.quarter}_${currentPlan.academicYear.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      message.success('Xuất tệp Excel thành công!');
    } catch (err) {
      console.error(err);
      message.error('Lỗi khi xuất tệp Excel');
    }
  };

  // ==========================================
  // TẢI FILE MẪU IMPORT EXCEL (CÓ SHEET PHỤ DANH MỤC)
  // ==========================================
  const handleDownloadSampleExcel = () => {
    try {
      const sampleRows = [
        [
          'STT',
          'Nhóm nhiệm vụ (*)',
          'Nội dung công việc (*)',
          'Sản phẩm đầu ra',
          'Đơn vị chủ trì (*)',
          'Đơn vị phối hợp',
          'BGH Phụ trách (*)',
          'Ngày bắt đầu (DD/MM/YYYY)',
          'Hạn hoàn thành (*) (DD/MM/YYYY)',
          'Ngày thực tế HT (nếu có)',
          'Ghi chú',
        ],
        [
          1,
          'I. CÔNG TÁC CHÍNH TRỊ - TƯ TƯỞNG',
          'Phong trào "Học tập và làm theo tư tưởng, đạo đức, phong cách Hồ Chí Minh"',
          'Báo cáo chuyên đề và Kế hoạch thực hiện',
          'Khoa Giáo dục đại cương',
          'Khoa Kinh tế - Du lịch',
          'Nguyễn Trí Dũng',
          '01/06/2026',
          '15/06/2026',
          '15/06/2026',
          'Nhiệm vụ trọng tâm quý',
        ],
        [
          2,
          'III. QUẢN LÝ CHUYÊN MÔN',
          'Tổ chức Hội thảo đổi mới phương pháp giảng dạy tích hợp số hóa',
          'Kỷ yếu hội thảo và danh sách giảng viên tham dự',
          'Khoa Công nghệ thông tin - Kỹ thuật điện',
          'Khoa Chăm sóc sắc đẹp - Nuôi dưỡng trẻ',
          'Nguyễn Trí Dũng',
          '10/06/2026',
          '25/06/2026',
          '',
          'Tổ chức trực tiếp tại Hội trường A',
        ],
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(sampleRows);
      worksheet['!cols'] = [
        { wch: 6 },
        { wch: 35 },
        { wch: 45 },
        { wch: 30 },
        { wch: 35 },
        { wch: 30 },
        { wch: 25 },
        { wch: 20 },
        { wch: 25 },
        { wch: 25 },
        { wch: 25 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau_Import_Nhiem_Vu');

      // Sheet phụ 1: Danh sách Đơn vị (để sao chép chuẩn xác không lỗi)
      const deptRows = [
        ['STT', 'Mã đơn vị', 'Tên đơn vị (Copy tên này vào cột Đơn vị chủ trì / phối hợp)'],
        ...departments.map((d, i) => [i + 1, d.departmentCode || '', d.departmentName]),
      ];
      const deptSheet = XLSX.utils.aoa_to_sheet(deptRows);
      deptSheet['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 45 }];
      XLSX.utils.book_append_sheet(workbook, deptSheet, 'Danh_Muc_Don_Vi');

      // Sheet phụ 2: Danh sách Ban Giám hiệu
      const bghRows = [
        ['STT', 'Họ và tên BGH (Copy tên này vào cột BGH Phụ trách)', 'Chức vụ'],
        ...bghUsers.map((u, i) => [i + 1, u.name, u.position?.positionName || '']),
      ];
      const bghSheet = XLSX.utils.aoa_to_sheet(bghRows);
      bghSheet['!cols'] = [{ wch: 6 }, { wch: 30 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, bghSheet, 'Danh_Muc_BGH');

      // Sheet phụ 3: Danh sách Nhóm nhiệm vụ chuẩn
      const groupRows = [
        ['STT', 'Tên nhóm nhiệm vụ chuẩn (Copy vào cột Nhóm nhiệm vụ)'],
        ...DEFAULT_TASK_GROUPS.map((g, i) => [i + 1, g]),
      ];
      const groupSheet = XLSX.utils.aoa_to_sheet(groupRows);
      groupSheet['!cols'] = [{ wch: 6 }, { wch: 45 }];
      XLSX.utils.book_append_sheet(workbook, groupSheet, 'Danh_Muc_Nhom_Nhiem_Vu');

      XLSX.writeFile(workbook, 'Mau_Import_Nhiem_Vu_Ke_Hoach_Quy.xlsx');
      message.success('Đã tải tệp mẫu Excel có kèm các Sheet phụ tra cứu thành công!');
    } catch (err) {
      console.error(err);
      message.error('Lỗi tải file mẫu');
    }
  };

  // ==========================================
  // XỬ LÝ ĐỌC FILE EXCEL ĐỂ IMPORT
  // ==========================================
  const handleReadExcelFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (json.length < 2) {
          message.warning('Tệp Excel không có dòng dữ liệu hợp lệ!');
          return;
        }

        // Tìm dòng header
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(json.length, 5); i++) {
          const row = json[i] || [];
          if (row.some((cell) => typeof cell === 'string' && cell.toLowerCase().includes('nội dung'))) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) headerRowIndex = 0;

        const dataRows = json.slice(headerRowIndex + 1);
        const parsedItems = [];

        // Helper parse ngày dd/mm/yyyy
        const parseDate = (val) => {
          if (!val) return null;
          if (val instanceof Date) return val.toISOString();
          const str = String(val).trim();
          const parts = str.split(/[/.-]/);
          if (parts.length === 3) {
            const d = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10) - 1;
            const y = parseInt(parts[2], 10);
            const dt = new Date(y, m, d, 12, 0, 0);
            if (!isNaN(dt.getTime())) return dt.toISOString();
          }
          const dt = new Date(str);
          return !isNaN(dt.getTime()) ? dt.toISOString() : null;
        };

        dataRows.forEach((row, idx) => {
          if (!row || row.length === 0) return;
          const order = parseInt(row[0], 10) || (idx + 1);
          const groupName = row[1] ? String(row[1]).trim() : 'I. CÔNG TÁC CHÍNH TRỊ - TƯ TƯỞNG';
          const taskContent = row[2] ? String(row[2]).trim() : '';
          const expectedOutcome = row[3] ? String(row[3]).trim() : '';
          const assignedStr = row[4] ? String(row[4]).trim() : '';
          const coordStr = row[5] ? String(row[5]).trim() : '';
          const bghStr = row[6] ? String(row[6]).trim() : '';
          const startDate = parseDate(row[7]);
          const expectedDeadline = parseDate(row[8]);
          const actualCompletedDate = parseDate(row[9]);
          const manualRemark = row[10] ? String(row[10]).trim() : '';

          if (taskContent) {
            parsedItems.push({
              order,
              groupName,
              taskContent,
              expectedOutcome,
              assignedDepartmentNames: assignedStr ? assignedStr.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [],
              coordinatingDepartmentNames: coordStr ? coordStr.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [],
              bghNames: bghStr ? bghStr.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [],
              startDate,
              expectedDeadline,
              actualCompletedDate,
              manualRemark,
            });
          }
        });

        if (parsedItems.length === 0) {
          message.warning('Không tìm thấy nhiệm vụ nào có nội dung trong tệp!');
          return;
        }

        setImportedPreviewList(parsedItems);
        message.success(`Đã đọc ${parsedItems.length} nhiệm vụ từ Excel. Vui lòng kiểm tra và xác nhận!`);
      } catch (err) {
        console.error(err);
        message.error('Lỗi khi phân tích tệp Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // Chặn upload mặc định của Antd
  };

  // Xác nhận lưu Import
  const handleConfirmImport = async () => {
    if (!selectedPlanId) {
      message.error('Vui lòng chọn Kế hoạch quý cần import vào!');
      return;
    }

    if (importedPreviewList.length === 0) {
      message.warning('Chưa có danh sách nhiệm vụ để import!');
      return;
    }

    try {
      setImportLoading(true);
      const res = await importPlanItems({
        planId: selectedPlanId,
        items: importedPreviewList,
      });

      if (res.success) {
        message.success(res.message || 'Import danh sách nhiệm vụ thành công!');
        setImportModalVisible(false);
        setImportedPreviewList([]);
        loadPlanDetail(selectedPlanId);
      } else {
        message.error(res.message || 'Lỗi khi import');
      }
    } catch (err) {
      console.error(err);
      message.error(err.response?.data?.message || 'Lỗi hệ thống khi import danh sách');
    } finally {
      setImportLoading(false);
    }
  };

  // Danh sách các năm / năm học duy nhất từ danh sách kế hoạch
  const availableYears = useMemo(() => {
    const setY = new Set();
    plans.forEach((p) => {
      if (p.academicYear) setY.add(p.academicYear.trim());
      else if (p.year) setY.add(String(p.year));
    });
    return Array.from(setY).sort().reverse();
  }, [plans]);

  // Danh sách kế hoạch sau khi lọc theo Năm (nếu có chọn)
  const filteredPlans = useMemo(() => {
    if (!filterYear) return plans;
    return plans.filter((p) => {
      return (
        (p.academicYear && p.academicYear.includes(filterYear)) ||
        (p.year && String(p.year) === String(filterYear))
      );
    });
  }, [plans, filterYear]);

  // Lọc dữ liệu nhiệm vụ thông minh
  const filteredItems = useMemo(() => {
    return planItems.filter((item) => {
      // 1. Lọc đơn vị: kiểm tra cả Đơn vị chủ trì và Đơn vị phối hợp
      if (filterDepartment) {
        const inAssigned = item.assignedDepartments?.some((d) => (d._id || d) === filterDepartment);
        const inCoord = item.coordinatingDepartments?.some((d) => (d._id || d) === filterDepartment);
        if (!inAssigned && !inCoord) return false;
      }

      // 2. Lọc Ban Giám hiệu: kiểm tra trong bghInCharge
      if (filterBgh) {
        const matchBgh = item.bghInCharge?.some((u) => (u._id || u) === filterBgh);
        if (!matchBgh) return false;
      }

      // 3. Lọc trạng thái nhận xét tự động hoặc trạng thái công việc
      if (filterStatus) {
        const matchAuto = item.autoRemarkStatus === filterStatus;
        const matchWorkStatus = item.status === filterStatus;
        if (!matchAuto && !matchWorkStatus) return false;
      }

      // 4. Tìm kiếm nội dung công việc thông minh (từ khóa trong taskContent, expectedOutcome, manualRemark)
      if (searchKeyword && searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase();
        const content = (item.taskContent || '').toLowerCase();
        const outcome = (item.expectedOutcome || '').toLowerCase();
        const remark = (item.manualRemark || '').toLowerCase();
        const pause = (item.pauseReason || '').toLowerCase();
        if (!content.includes(kw) && !outcome.includes(kw) && !remark.includes(kw) && !pause.includes(kw)) {
          return false;
        }
      }

      // 5. Lọc theo khoảng thời gian thực hiện (searchDateRange)
      if (searchDateRange && searchDateRange[0] && searchDateRange[1]) {
        const startFilter = searchDateRange[0].startOf('day').valueOf();
        const endFilter = searchDateRange[1].endOf('day').valueOf();

        const itemStart = item.startDate ? dayjs(item.startDate).startOf('day').valueOf() : null;
        const itemDeadline = item.expectedDeadline ? dayjs(item.expectedDeadline).endOf('day').valueOf() : null;
        const itemActual = item.actualCompletedDate ? dayjs(item.actualCompletedDate).valueOf() : null;

        // Công việc thuộc khoảng thời gian nếu hạn hoặc ngày bắt đầu hoặc ngày hoàn thành giao thoa với khoảng lọc
        const hasOverlap =
          (itemDeadline && itemDeadline >= startFilter && itemDeadline <= endFilter) ||
          (itemStart && itemStart >= startFilter && itemStart <= endFilter) ||
          (itemStart && itemDeadline && itemStart <= startFilter && itemDeadline >= endFilter) ||
          (itemActual && itemActual >= startFilter && itemActual <= endFilter);

        if (!hasOverlap) return false;
      }

      return true;
    });
  }, [planItems, filterDepartment, filterBgh, filterStatus, searchKeyword, searchDateRange]);

  // Gom nhóm danh sách nhiệm vụ theo groupName
  const groupedTasks = useMemo(() => {
    const map = new Map();
    filteredItems.forEach((item) => {
      const gName = (item.groupName && item.groupName.trim()) || 'I. CÔNG TÁC CHÍNH TRỊ - TƯ TƯỞNG';
      if (!map.has(gName)) {
        map.set(gName, []);
      }
      map.get(gName).push(item);
    });

    const groups = [];
    map.forEach((items, groupName) => {
      items.sort((a, b) => (a.order || 0) - (b.order || 0));
      groups.push({ groupName, items });
    });

    return groups;
  }, [filteredItems]);

  // Thống kê nhanh
  const statistics = useMemo(() => {
    const total = planItems.length;
    const completed = planItems.filter((i) => i.actualCompletedDate).length;
    const onTime = planItems.filter((i) => i.autoRemarkStatus === 'ON_TIME' || i.autoRemarkStatus === 'EARLY').length;
    const overdue = planItems.filter((i) => i.autoRemarkStatus === 'OVERDUE').length;
    const inProgress = planItems.filter((i) => i.autoRemarkStatus === 'IN_PROGRESS').length;

    return { total, completed, onTime, overdue, inProgress };
  }, [planItems]);

  // Render danh sách file đính kèm
  const renderFileList = (files) => {
    if (!files || files.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {files.map((f, idx) => (
          <a
            key={f.fileId || idx}
            href={f.webViewLink || `/api/online-records/file/${f.fileId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs border border-blue-200 transition-colors"
            title={f.fileName}
          >
            <PaperClipOutlined className="text-blue-500" />
            <span className="max-w-[140px] truncate">{f.fileName}</span>
          </a>
        ))}
      </div>
    );
  };

  // Cấu hình các cột của Bảng Kế Hoạch Quý (STT đánh số tăng dần theo hàng)
  const columns = [
    {
      title: 'STT',
      key: 'rowNumber',
      width: 55,
      align: 'center',
      render: (_, __, index) => <span className="font-semibold text-slate-600">{index + 1}</span>,
    },
    {
      title: 'Nội dung công việc & Mục tiêu',
      key: 'taskContent',
      width: 320,
      render: (_, record) => (
        <div className="space-y-1">
          <div className="font-semibold text-slate-800 text-sm leading-snug">
            {record.taskContent}
          </div>
          {record.expectedOutcome && (
            <div className="text-xs text-slate-500 italic">
              <span className="font-medium text-slate-600">Sản phẩm:</span> {record.expectedOutcome}
            </div>
          )}
          {renderFileList(record.files)}
        </div>
      ),
    },
    {
      title: 'Phân công đơn vị',
      key: 'departments',
      width: 210,
      render: (_, record) => (
        <div className="space-y-1.5 text-xs max-h-36 overflow-y-auto pr-1">
          <div>
            <span className="text-slate-400 font-medium block">Chủ trì thực hiện:</span>
            {record.assignedDepartments && record.assignedDepartments.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {record.assignedDepartments.map((d) => (
                  <Tag
                    color="cyan"
                    key={d._id}
                    className="font-medium mr-0 text-[11px] max-w-full whitespace-normal break-words py-0.5"
                  >
                    {d.departmentName}
                  </Tag>
                ))}
              </div>
            ) : (
              <span className="text-slate-400 italic">Chưa phân công</span>
            )}
          </div>
          {record.coordinatingDepartments && record.coordinatingDepartments.length > 0 && (
            <div>
              <span className="text-slate-400 font-medium block">Phối hợp:</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {record.coordinatingDepartments.map((d) => (
                  <Tag
                    key={d._id}
                    className="text-slate-600 mr-0 text-[11px] max-w-full whitespace-normal break-words py-0.5"
                  >
                    {d.departmentName}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'BGH Phụ trách',
      dataIndex: 'bghInCharge',
      key: 'bghInCharge',
      width: 160,
      render: (bghList) => (
        <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
          {bghList && bghList.length > 0 ? (
            bghList.map((u) => (
              <Tag
                color="purple"
                key={u._id}
                className="font-medium block text-center mr-0 text-[11px] whitespace-normal break-words py-0.5"
              >
                {u.name}
              </Tag>
            ))
          ) : (
            <span className="text-slate-400 italic text-xs">Ban Giám hiệu</span>
          )}
        </div>
      ),
    },
    {
      title: 'Hạn dự kiến HT',
      key: 'expectedDeadline',
      width: 130,
      align: 'center',
      render: (_, record) => {
        if (record.startDate && record.expectedDeadline) {
          return (
            <div className="text-xs font-semibold text-slate-700 leading-tight space-y-0.5">
              <div>{dayjs(record.startDate).format('DD/MM/YYYY')}</div>
              <div className="text-[10px] text-slate-400 font-normal">đến</div>
              <div className="text-blue-700">{dayjs(record.expectedDeadline).format('DD/MM/YYYY')}</div>
            </div>
          );
        }
        return (
          <span className="text-xs font-semibold text-slate-700">
            {record.expectedDeadline ? dayjs(record.expectedDeadline).format('DD/MM/YYYY') : '—'}
          </span>
        );
      },
    },
    {
      title: 'Thực tế HT',
      dataIndex: 'actualCompletedDate',
      key: 'actualCompletedDate',
      width: 120,
      align: 'center',
      render: (completed, record) => (
        <div className="space-y-1">
          {completed ? (
            <Tag color="green" className="font-bold mr-0">
              {dayjs(completed).format('DD/MM/YYYY')}
            </Tag>
          ) : isManager ? (
            <Button
              size="small"
              type="dashed"
              icon={<AuditOutlined />}
              onClick={() => {
                setProgressItem(record);
                progressForm.setFieldsValue({
                  progressPercent: record.progressPercent || 0,
                  actualCompletedDate: record.actualCompletedDate ? dayjs(record.actualCompletedDate) : dayjs(),
                  status: record.status || 'IN_PROGRESS',
                  pauseReason: record.pauseReason || '',
                });
                setProgressModalVisible(true);
              }}
              className="text-xs text-blue-600 border-blue-300 hover:text-blue-500"
            >
              Cập nhật
            </Button>
          ) : (
            <span className="text-xs text-slate-400 italic">Chưa hoàn thành</span>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      align: 'center',
      render: (status, record) => {
        const opt = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
        if (status === 'PAUSED' && record.pauseReason) {
          return (
            <Tooltip title={`Lý do: ${record.pauseReason}`}>
              <Tag color={opt.color} className="font-semibold mr-0 cursor-pointer">
                {opt.label}
              </Tag>
            </Tooltip>
          );
        }
        return (
          <Tag color={opt.color} className="font-semibold mr-0">
            {opt.label}
          </Tag>
        );
      },
    },
    {
      title: 'Nhận xét tự động',
      key: 'autoRemark',
      width: 160,
      align: 'center',
      render: (_, record) => {
        const meta = REMARK_STATUS_MAP[record.autoRemarkStatus] || REMARK_STATUS_MAP.NOT_STARTED;
        return (
          <div
            className="p-1.5 rounded-lg text-xs font-semibold text-center border space-y-0.5"
            style={{
              backgroundColor: meta.bg,
              borderColor: meta.border,
              color: meta.textColor,
            }}
          >
            <div className="flex items-center justify-center gap-1">
              {meta.icon}
              <span>{meta.label}</span>
            </div>
            <div className="text-[11px] font-normal leading-tight opacity-90">
              {record.autoRemark}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Ghi chú',
      dataIndex: 'manualRemark',
      key: 'manualRemark',
      width: 170,
      render: (text) => (
        <div className="text-xs text-slate-600 italic max-h-24 overflow-y-auto pr-1">
          {text ? (
            <span className="whitespace-pre-line">{text}</span>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 96,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <div className="flex flex-col items-center justify-center gap-1.5 py-1">
          {/* Hàng 1: Xem chi tiết & Lịch sử */}
          <div className="flex items-center justify-center gap-1">
            {/* Nút Xem Chi Tiết cho Manager, Cấp trưởng, Cấp phó */}
            {(isManager || isLeader) && (
              <Tooltip title="Xem chi tiết">
                <Button
                  type="text"
                  size="small"
                  className="w-7 h-7 flex items-center justify-center p-0 rounded-lg hover:bg-emerald-50 text-emerald-600 border border-transparent hover:border-emerald-200 transition-colors"
                  icon={<EyeOutlined className="text-emerald-600 text-sm" />}
                  onClick={() => {
                    setDetailItem(record);
                    setDetailModalVisible(true);
                  }}
                />
              </Tooltip>
            )}

            {/* Nút Xem lịch sử thay đổi */}
            <Tooltip title="Lịch sử thay đổi">
              <Button
                type="text"
                size="small"
                className="w-7 h-7 flex items-center justify-center p-0 rounded-lg hover:bg-purple-50 text-purple-600 border border-transparent hover:border-purple-200 transition-colors"
                icon={<HistoryOutlined className="text-purple-600 text-sm" />}
                onClick={() => {
                  setHistoryItem(record);
                  setHistoryModalVisible(true);
                }}
              />
            </Tooltip>
          </div>

          {/* Hàng 2: Nộp báo cáo & Chỉnh sửa / Xóa */}
          <div className="flex items-center justify-center gap-1">
            {/* Nút Nộp báo cáo cho Cấp trưởng, Cấp phó (kể cả Manager) */}
            {(isLeader || isManager) && (
              <Tooltip title="Nộp báo cáo trực tuyến">
                <Button
                  type="text"
                  size="small"
                  className="w-7 h-7 flex items-center justify-center p-0 rounded-lg hover:bg-blue-50 text-blue-600 border border-transparent hover:border-blue-200 transition-colors"
                  icon={<SendOutlined className="text-blue-600 text-sm" />}
                  onClick={() => navigate('/online-records/submit')}
                />
              </Tooltip>
            )}

            {/* Nút Chỉnh sửa chỉ dành cho Manager */}
            {isManager && (
              <Tooltip title="Chỉnh sửa nhiệm vụ">
                <Button
                  type="text"
                  size="small"
                  className="w-7 h-7 flex items-center justify-center p-0 rounded-lg hover:bg-amber-50 text-amber-600 border border-transparent hover:border-amber-200 transition-colors"
                  icon={<EditOutlined className="text-amber-600 text-sm" />}
                  onClick={() => {
                    setEditingItem(record);
                    setUploadedFiles(record.files || []);
                    itemForm.setFieldsValue({
                      groupName: record.groupName,
                      order: record.order,
                      taskContent: record.taskContent,
                      expectedOutcome: record.expectedOutcome,
                      assignedDepartments: record.assignedDepartments?.map((d) => d._id),
                      coordinatingDepartments: record.coordinatingDepartments?.map((d) => d._id),
                      bghInCharge: record.bghInCharge?.map((u) => u._id),
                      expectedRange: [
                        record.startDate ? dayjs(record.startDate) : dayjs(record.expectedDeadline),
                        record.expectedDeadline ? dayjs(record.expectedDeadline) : dayjs(),
                      ],
                      actualCompletedDate: record.actualCompletedDate ? dayjs(record.actualCompletedDate) : null,
                      status: record.status || 'IN_PROGRESS',
                      pauseReason: record.pauseReason || '',
                      manualRemark: record.manualRemark,
                    });
                    setCreateItemModalVisible(true);
                  }}
                />
              </Tooltip>
            )}

            {/* Nút Xóa chỉ dành cho Manager */}
            {isManager && (
              <Popconfirm
                title="Xóa nhiệm vụ này khỏi kế hoạch quý?"
                onConfirm={() => handleDeleteItem(record._id)}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Xóa nhiệm vụ">
                  <Button
                    type="text"
                    size="small"
                    className="w-7 h-7 flex items-center justify-center p-0 rounded-lg hover:bg-red-50 text-red-500 border border-transparent hover:border-red-200 transition-colors"
                    icon={<DeleteOutlined className="text-red-500 text-sm" />}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full max-w-full px-2 sm:px-4 md:px-6 py-4 space-y-4 overflow-x-hidden">
      <style>{tableScrollStyles}</style>
      {/* Header & Tiêu đề phân hệ */}
      <div className="bg-white p-3.5 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 sm:p-2.5 bg-blue-100 text-blue-700 rounded-xl shrink-0">
              <CalendarOutlined className="text-lg sm:text-xl" />
            </span>
            <div>
              <Title level={4} className="!mb-0 text-slate-800 text-base sm:text-lg">
                Kế Hoạch Quý & Theo Dõi Tiến Độ
              </Title>
              <Text className="text-xs text-slate-500 hidden sm:block">
                Theo dõi thực hiện công tác trọng tâm theo Quý, phân công BGH chỉ đạo và tự động nhận xét tiến độ
              </Text>
            </div>
          </div>
        </div>

        {/* Thanh tác vụ chính: Bố trí gọn gàng, chia khối rõ ràng trên Desktop & Mobile */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-start xl:justify-end">
          {/* Nhóm chọn Năm & Kế hoạch quý */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            {/* Bộ lọc Năm / Năm học của kế hoạch */}
            <Select
              placeholder="Tất cả các năm"
              allowClear
              value={filterYear}
              onChange={(val) => {
                setFilterYear(val);
                if (val) {
                  const plansInYear = plans.filter(
                    (p) => (p.academicYear && p.academicYear.includes(val)) || (p.year && String(p.year) === String(val))
                  );
                  if (plansInYear.length > 0 && !plansInYear.some((p) => p._id === selectedPlanId)) {
                    setSelectedPlanId(plansInYear[0]._id);
                  }
                }
              }}
              className="w-32 sm:w-36 shrink-0"
              size="middle"
            >
              {availableYears.map((yr) => (
                <Option key={yr} value={yr}>
                  {yr.includes('-') ? `NH ${yr}` : `Năm ${yr}`}
                </Option>
              ))}
            </Select>

            {/* Bộ chọn Kế hoạch quý - Tìm kiếm thông minh showSearch */}
            <Select
              showSearch
              placeholder="Tìm chọn kế hoạch quý..."
              value={selectedPlanId}
              onChange={(val) => setSelectedPlanId(val)}
              filterOption={(input, option) =>
                (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
              className="flex-1 sm:w-64 md:w-72"
              size="middle"
            >
              {filteredPlans.map((p) => (
                <Option key={p._id} value={p._id}>
                  {p.title} (Quý {p.quarter})
                </Option>
              ))}
            </Select>
          </div>

          {/* Nhóm nút tác vụ: Xuất, Import, Tạo KH, Thêm Nhiệm vụ */}
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-end">
            <Button
              icon={<DownloadOutlined />}
              disabled={!selectedPlanId}
              onClick={handleExportExcel}
              className="rounded-lg text-emerald-700 border-emerald-300 hover:text-emerald-600 hover:border-emerald-400 bg-emerald-50 text-xs sm:text-sm font-medium"
            >
              Xuất Excel
            </Button>

            {isManager && (
              <>
                <Button
                  icon={<FileExcelOutlined />}
                  disabled={!selectedPlanId}
                  onClick={() => {
                    setImportedPreviewList([]);
                    setImportModalVisible(true);
                  }}
                  className="rounded-lg text-blue-700 border-blue-300 hover:text-blue-600 hover:border-blue-400 bg-blue-50 text-xs sm:text-sm font-medium"
                >
                  Import Excel
                </Button>

                <Button
                  type="default"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    planForm.resetFields();
                    setCreatePlanModalVisible(true);
                  }}
                  className="rounded-lg border-slate-300 text-slate-700 hover:border-blue-500 hover:text-blue-600 text-xs sm:text-sm font-medium"
                >
                  Tạo KH mới
                </Button>

                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={!selectedPlanId}
                  onClick={() => {
                    setEditingItem(null);
                    setUploadedFiles([]);
                    const defaultGroup = "I. CÔNG TÁC CHÍNH TRỊ - TƯ TƯỞNG";
                    const nextOrder = getNextOrderForGroup(defaultGroup);
                    itemForm.resetFields();
                    itemForm.setFieldsValue({
                      groupName: defaultGroup,
                      order: nextOrder,
                    });
                    setCreateItemModalVisible(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm text-xs sm:text-sm font-medium"
                >
                  Thêm Nhiệm vụ
                </Button>
              </>
            )}

            <Tooltip title="Làm mới dữ liệu">
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  if (selectedPlanId) loadPlanDetail(selectedPlanId);
                  else loadPlans();
                }}
                className="rounded-lg shrink-0 border-slate-300 hover:border-blue-500"
              />
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Thống kê tiến độ nhanh: 5 thẻ chia đều 5 cột trên Desktop lớn */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="rounded-xl shadow-xs border-slate-200 hover:border-blue-300 transition-all p-0">
          <Statistic
            title={<span className="text-[11px] sm:text-xs text-slate-500 font-semibold uppercase tracking-wider">Tổng nhiệm vụ</span>}
            value={statistics.total}
            valueStyle={{ color: '#1e293b', fontWeight: 'bold', fontSize: '1.4rem' }}
            prefix={<FileDoneOutlined className="text-blue-600 text-lg mr-1.5" />}
          />
        </Card>

        <Card className="rounded-xl shadow-xs border-slate-200 hover:border-emerald-300 transition-all p-0">
          <Statistic
            title={<span className="text-[11px] sm:text-xs text-emerald-600 font-semibold uppercase tracking-wider">Đúng / Sớm hạn</span>}
            value={statistics.onTime}
            valueStyle={{ color: '#16a34a', fontWeight: 'bold', fontSize: '1.4rem' }}
            prefix={<CheckCircleOutlined className="text-emerald-500 text-lg mr-1.5" />}
          />
        </Card>

        <Card className="rounded-xl shadow-xs border-slate-200 hover:border-blue-300 transition-all p-0">
          <Statistic
            title={<span className="text-[11px] sm:text-xs text-blue-600 font-semibold uppercase tracking-wider">Đang triển khai</span>}
            value={statistics.inProgress}
            valueStyle={{ color: '#2563eb', fontWeight: 'bold', fontSize: '1.4rem' }}
            prefix={<ClockCircleOutlined className="text-blue-500 text-lg mr-1.5" />}
          />
        </Card>

        <Card className="rounded-xl shadow-xs border-slate-200 hover:border-red-300 transition-all p-0">
          <Statistic
            title={<span className="text-[11px] sm:text-xs text-red-600 font-semibold uppercase tracking-wider">Trễ / Quá hạn</span>}
            value={statistics.overdue}
            valueStyle={{ color: '#dc2626', fontWeight: 'bold', fontSize: '1.4rem' }}
            prefix={<ExclamationCircleOutlined className="text-red-500 text-lg mr-1.5" />}
          />
        </Card>

        <Card className="rounded-xl shadow-xs border-slate-200 hover:border-teal-300 transition-all p-0 col-span-2 sm:col-span-1">
          <Statistic
            title={<span className="text-[11px] sm:text-xs text-teal-700 font-semibold uppercase tracking-wider">Đã hoàn thành</span>}
            value={statistics.completed}
            suffix={<span className="text-sm font-semibold text-slate-400">/ {statistics.total}</span>}
            valueStyle={{ color: '#0f766e', fontWeight: 'bold', fontSize: '1.4rem' }}
            prefix={<CheckCircleOutlined className="text-teal-600 text-lg mr-1.5" />}
          />
        </Card>
      </div>

      {/* Thanh bộ lọc & Tìm kiếm thông minh */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-xs border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Cột tìm từ khóa: 7/12 desktop */}
          <div className="md:col-span-7">
            <Input
              placeholder="Tìm nhanh nội dung công việc, sản phẩm đầu ra, lý do..."
              allowClear
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full rounded-lg"
              size="middle"
            />
          </div>

          {/* Cột chọn khoảng ngày: 5/12 desktop */}
          <div className="md:col-span-5">
            <DatePicker.RangePicker
              placeholder={['Từ ngày', 'Đến ngày']}
              format="DD/MM/YYYY"
              allowClear
              value={searchDateRange}
              onChange={(dates) => setSearchDateRange(dates)}
              className="w-full rounded-lg"
              size="middle"
            />
          </div>

          {/* Dòng thứ 2: Các bộ lọc danh mục */}
          <div className="md:col-span-12 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Lọc theo:</span>

            <Select
              showSearch
              placeholder="Tất cả đơn vị (Chủ trì & Phối hợp)"
              allowClear
              value={filterDepartment}
              onChange={(val) => setFilterDepartment(val)}
              filterOption={(input, option) =>
                (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
              className="flex-1 min-w-[200px]"
              size="middle"
            >
              {groupedDepartments.map((grp) => (
                <Select.OptGroup key={grp.key} label={<span className="font-bold text-slate-700">{grp.label}</span>}>
                  {grp.items.map((d) => (
                    <Option key={d._id} value={d._id}>
                      {d.departmentName}
                    </Option>
                  ))}
                </Select.OptGroup>
              ))}
            </Select>

            <Select
              showSearch
              placeholder="Tất cả Ban Giám hiệu"
              allowClear
              value={filterBgh}
              onChange={(val) => setFilterBgh(val)}
              filterOption={(input, option) =>
                (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
              className="flex-1 min-w-[180px]"
              size="middle"
            >
              {bghUsers.map((u) => (
                <Option key={u._id} value={u._id}>
                  {u.name}{u.position?.positionName ? `: ${u.position.positionName}` : ''}
                </Option>
              ))}
            </Select>

            <Select
              placeholder="Trạng thái thực hiện / nhận xét"
              allowClear
              value={filterStatus}
              onChange={(val) => setFilterStatus(val)}
              className="w-full sm:w-56"
              size="middle"
            >
              <Option value="IN_PROGRESS">Đang thực hiện</Option>
              <Option value="COMPLETED">Đã hoàn thành</Option>
              <Option value="PAUSED">Tạm dừng</Option>
              <Option value="NOT_STARTED">Chưa làm</Option>
              <Option value="ON_TIME">Đúng hạn</Option>
              <Option value="EARLY">Sớm hạn</Option>
              <Option value="LATE">Trễ hạn</Option>
              <Option value="OVERDUE">Quá hạn</Option>
            </Select>

            {(filterDepartment || filterBgh || filterStatus || searchKeyword || searchDateRange) && (
              <Button
                size="middle"
                onClick={() => {
                  setFilterDepartment(null);
                  setFilterBgh(null);
                  setFilterStatus(null);
                  setSearchKeyword('');
                  setSearchDateRange(null);
                }}
                className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 rounded-lg shrink-0"
              >
                Xóa lọc
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Hiển thị Danh Sách Nhiệm Vụ Gom Nhóm */}
      <Card
        title={
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-slate-800">
                {currentPlan?.title || 'Bảng Tổng Hợp Kế Hoạch Quý'}
              </span>
              {currentPlan && (
                <Tag color="blue" className="font-bold text-[11px] sm:text-xs mr-0">
                  NH {currentPlan.academicYear} • Quý {currentPlan.quarter}
                </Tag>
              )}
            </div>

            {/* Nút Chỉnh sửa & Xóa Kế hoạch quý hiện tại cho Manager */}
            {isManager && currentPlan && (
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingPlan(currentPlan);
                    planForm.setFieldsValue({
                      title: currentPlan.title,
                      academicYear: currentPlan.academicYear,
                      year: currentPlan.year,
                      quarter: currentPlan.quarter,
                      dateRange: currentPlan.startDate && currentPlan.endDate
                        ? [dayjs(currentPlan.startDate), dayjs(currentPlan.endDate)]
                        : null,
                      note: currentPlan.note,
                    });
                    setCreatePlanModalVisible(true);
                  }}
                  className="text-xs text-blue-600 border-blue-300 hover:text-blue-500 rounded-md"
                >
                  Sửa KH
                </Button>

                <Popconfirm
                  title="Xác nhận xóa Kế hoạch quý này?"
                  description="Toàn bộ nhiệm vụ trong kế hoạch cũng sẽ bị xóa vĩnh viễn!"
                  onConfirm={() => handleDeletePlan(currentPlan._id)}
                  okText="Xóa luôn"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    className="text-xs rounded-md"
                  >
                    Xóa KH
                  </Button>
                </Popconfirm>
              </div>
            )}
          </div>
        }
        className="rounded-2xl shadow-xs border-slate-200 overflow-hidden"
      >
        {groupedTasks.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            Chưa có nhiệm vụ nào trong kế hoạch này
          </div>
        ) : (
          <div className="space-y-6">
            {groupedTasks.map((group, gIdx) => (
              <div key={gIdx} className="space-y-2">
                {/* TIÊU ĐỀ NHÓM NHIỆM VỤ NỔI BẬT */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600 rounded-r-lg">
                  <span className="font-bold text-sm sm:text-base text-blue-900 uppercase tracking-wide">
                    {group.groupName}
                  </span>
                  <span className="text-xs text-blue-600 font-semibold bg-white px-2 py-0.5 rounded-full border border-blue-200">
                    {group.items.length} nhiệm vụ
                  </span>
                </div>

                {/* Mobile View: Dạng thẻ tối ưu trên màn hình nhỏ */}
                <div className="block md:hidden space-y-3">
                  {group.items.map((record, idx) => {
                    const meta = REMARK_STATUS_MAP[record.autoRemarkStatus] || REMARK_STATUS_MAP.NOT_STARTED;
                    return (
                      <div
                        key={record._id}
                        onClick={(e) => {
                          if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.ant-popover')) {
                            return;
                          }
                          setDetailItem(record);
                          setDetailModalVisible(true);
                        }}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 shadow-xs cursor-pointer hover:border-blue-300 transition-all"
                      >
                        {/* Thứ tự & Trạng thái */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded leading-tight">
                            #{idx + 1}
                          </span>
                          <div
                            className="px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 shrink-0"
                            style={{
                              backgroundColor: meta.bg,
                              borderColor: meta.border,
                              color: meta.textColor,
                            }}
                          >
                            {meta.icon}
                            <span>{meta.label}</span>
                          </div>
                        </div>

                        {/* Nội dung công việc */}
                        <div className="font-semibold text-slate-800 text-sm leading-snug">
                          {record.taskContent}
                        </div>

                        {/* Sản phẩm đầu ra */}
                        {record.expectedOutcome && (
                          <div className="text-xs text-slate-500">
                            <span className="font-medium text-slate-600">Đầu ra:</span> {record.expectedOutcome}
                          </div>
                        )}

                        {/* Tệp đính kèm */}
                        {renderFileList(record.files)}

                        {/* Đơn vị phân công */}
                        <div className="text-xs space-y-1 pt-1 border-t border-slate-100">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-slate-400 font-medium">Chủ trì:</span>
                            {record.assignedDepartments && record.assignedDepartments.length > 0 ? (
                              record.assignedDepartments.map((d) => (
                                <Tag color="cyan" key={d._id} className="text-[11px] mr-0">
                                  {d.departmentName}
                                </Tag>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">Chưa phân công</span>
                            )}
                          </div>

                          {record.coordinatingDepartments && record.coordinatingDepartments.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-slate-400 font-medium">Phối hợp:</span>
                              {record.coordinatingDepartments.map((d) => (
                                <Tag key={d._id} className="text-[11px] text-slate-500 mr-0">
                                  {d.departmentName}
                                </Tag>
                              ))}
                            </div>
                          )}

                          {record.bghInCharge && record.bghInCharge.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              <span className="text-slate-400 font-medium">BGH:</span>
                              {record.bghInCharge.map((u) => (
                                <Tag color="purple" key={u._id} className="text-[11px] mr-0">
                                  {u.name}
                                </Tag>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Trạng thái & Lý do tạm dừng nếu có */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="text-slate-400 text-xs">Trạng thái:</span>
                          {(() => {
                            const opt = STATUS_OPTIONS.find((s) => s.value === record.status) || STATUS_OPTIONS[0];
                            if (record.status === 'PAUSED' && record.pauseReason) {
                              return (
                                <Tooltip title={`Lý do: ${record.pauseReason}`}>
                                  <Tag color={opt.color} className="text-[11px] font-semibold mr-0">
                                    {opt.label} ({record.pauseReason})
                                  </Tag>
                                </Tooltip>
                              );
                            }
                            return (
                              <Tag color={opt.color} className="text-[11px] font-semibold mr-0">
                                {opt.label}
                              </Tag>
                            );
                          })()}
                        </div>

                        {/* Thời hạn & Thao tác */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                          <div>
                            <span className="text-slate-400">Hạn HT: </span>
                            <span className="font-semibold text-slate-700">
                              {record.startDate && record.expectedDeadline
                                ? `${dayjs(record.startDate).format('DD/MM')} - ${dayjs(record.expectedDeadline).format('DD/MM/YYYY')}`
                                : (record.expectedDeadline ? dayjs(record.expectedDeadline).format('DD/MM/YYYY') : '—')}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {record.actualCompletedDate ? (
                              <Tag color="green" className="text-[11px] font-bold mr-0">
                                HT: {dayjs(record.actualCompletedDate).format('DD/MM/YYYY')}
                              </Tag>
                            ) : isManager ? (
                              <Button
                                size="small"
                                type="dashed"
                                icon={<AuditOutlined />}
                                onClick={() => {
                                  setProgressItem(record);
                                  progressForm.setFieldsValue({
                                    progressPercent: record.progressPercent || 0,
                                    actualCompletedDate: record.actualCompletedDate ? dayjs(record.actualCompletedDate) : dayjs(),
                                    status: record.status || 'IN_PROGRESS',
                                    pauseReason: record.pauseReason || '',
                                  });
                                  setProgressModalVisible(true);
                                }}
                                className="text-[11px] text-blue-600 border-blue-300"
                              >
                                Cập nhật
                              </Button>
                            ) : null}

                            {/* Nút Xem chi tiết */}
                            {(isManager || isLeader) && (
                              <Tooltip title="Xem chi tiết">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EyeOutlined className="text-emerald-600" />}
                                  onClick={() => {
                                    setDetailItem(record);
                                    setDetailModalVisible(true);
                                  }}
                                />
                              </Tooltip>
                            )}

                            {/* Nút Xem lịch sử thay đổi */}
                            <Tooltip title="Xem lịch sử">
                              <Button
                                type="text"
                                size="small"
                                icon={<HistoryOutlined className="text-purple-600" />}
                                onClick={() => {
                                  setHistoryItem(record);
                                  setHistoryModalVisible(true);
                                }}
                              />
                            </Tooltip>

                            {/* Nút Nộp báo cáo */}
                            {(isLeader || isManager) && (
                              <Tooltip title="Nộp báo cáo trực tuyến">
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<SendOutlined className="text-blue-600" />}
                                  onClick={() => navigate('/online-records/submit')}
                                />
                              </Tooltip>
                            )}

                            {isManager && (
                              <>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<EditOutlined className="text-amber-600" />}
                                  onClick={() => {
                                    setEditingItem(record);
                                    setUploadedFiles(record.files || []);
                                    itemForm.setFieldsValue({
                                      groupName: record.groupName,
                                      order: record.order,
                                      taskContent: record.taskContent,
                                      expectedOutcome: record.expectedOutcome,
                                      assignedDepartments: record.assignedDepartments?.map((d) => d._id),
                                      coordinatingDepartments: record.coordinatingDepartments?.map((d) => d._id),
                                      bghInCharge: record.bghInCharge?.map((u) => u._id),
                                      expectedRange: [
                                        record.startDate ? dayjs(record.startDate) : dayjs(record.expectedDeadline),
                                        record.expectedDeadline ? dayjs(record.expectedDeadline) : dayjs(),
                                      ],
                                      actualCompletedDate: record.actualCompletedDate ? dayjs(record.actualCompletedDate) : null,
                                      status: record.status || 'IN_PROGRESS',
                                      pauseReason: record.pauseReason || '',
                                      manualRemark: record.manualRemark,
                                    });
                                    setCreateItemModalVisible(true);
                                  }}
                                />
                                <Popconfirm
                                  title="Xóa nhiệm vụ này?"
                                  onConfirm={() => handleDeleteItem(record._id)}
                                  okText="Xóa"
                                  cancelText="Hủy"
                                  okButtonProps={{ danger: true }}
                                >
                                  <Button type="text" size="small" icon={<DeleteOutlined className="text-red-500" />} />
                                </Popconfirm>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop View: Table danh sách thuộc nhóm - Luôn có thanh trượt ngang khi vượt màn hình */}
                <div className="hidden md:block w-full overflow-x-auto">
                  <Table
                    rowKey="_id"
                    columns={columns}
                    dataSource={group.items}
                    loading={loading}
                    pagination={false}
                    bordered
                    size="middle"
                    scroll={{ x: 'max-content' }}
                    className="rounded-lg overflow-hidden quarterly-plan-table min-w-[1260px]"
                    rowClassName="cursor-pointer hover:bg-blue-50/40 transition-colors"
                    onRow={(record) => ({
                      onClick: (e) => {
                        // Tránh trigger khi người dùng click vào nút, link file, popconfirm hoặc input
                        if (e.target.closest('button') || e.target.closest('a') || e.target.closest('.ant-popover') || e.target.closest('.ant-select')) {
                          return;
                        }
                        setDetailItem(record);
                        setDetailModalVisible(true);
                      },
                    })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* MODAL 1: Tạo / Sửa Kế hoạch quý */}
      <Modal
        title={
          <span className="font-bold text-base text-blue-900">
            {editingPlan ? 'Chỉnh Sửa Kế Hoạch Quý' : 'Tạo Kế Hoạch Quý Mới'}
          </span>
        }
        open={createPlanModalVisible}
        onCancel={() => {
          setCreatePlanModalVisible(false);
          setEditingPlan(null);
        }}
        onOk={() => planForm.submit()}
        okText={editingPlan ? 'Lưu Thay Đổi' : 'Tạo Kế hoạch'}
        cancelText="Hủy"
        width="95%"
        style={{ maxWidth: 550 }}
        centered
      >
        <Form form={planForm} layout="vertical" onFinish={handleSavePlan} className="pt-2">
          <Form.Item
            name="title"
            label="Tiêu đề Kế hoạch quý"
            rules={[{ required: true, message: 'Vui lòng nhập tên kế hoạch' }]}
            initialValue="Kế hoạch công tác Quý I năm học 2026 - 2027"
          >
            <Input placeholder="Ví dụ: Kế hoạch công tác Quý I..." />
          </Form.Item>

          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="academicYear"
                label="Năm học"
                rules={[{ required: true }]}
                initialValue="2026-2027"
              >
                <Input placeholder="2026-2027" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="quarter"
                label="Quý thực hiện"
                rules={[{ required: true }]}
                initialValue={1}
              >
                <Select>
                  <Option value={1}>Quý I</Option>
                  <Option value={2}>Quý II</Option>
                  <Option value={3}>Quý III</Option>
                  <Option value={4}>Quý IV</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="dateRange" label="Khoảng thời gian thực hiện">
            <DatePicker.RangePicker className="w-full" format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú thêm">
            <TextArea rows={2} placeholder="Nội dung căn cứ, chỉ đạo..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 2: Thêm / Sửa nhiệm vụ trong kế hoạch quý */}
      <Modal
        title={
          <span className="font-bold text-base text-blue-900">
            {editingItem ? 'Chỉnh Sửa Nhiệm Vụ Kế Hoạch Quý' : 'Thêm Nhiệm Vụ Mới Vào Kế Hoạch Quý'}
          </span>
        }
        open={createItemModalVisible}
        onCancel={() => setCreateItemModalVisible(false)}
        onOk={() => itemForm.submit()}
        okText="Lưu Nhiệm Vụ"
        cancelText="Hủy"
        width="95%"
        style={{ maxWidth: 750 }}
        centered
      >
        <Form form={itemForm} layout="vertical" onFinish={handleSaveItem} className="pt-2">
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={18}>
              <Form.Item
                name="groupName"
                label="Nhóm nhiệm vụ / Trục kết quả"
                rules={[{ required: true, message: 'Vui lòng chọn hoặc nhập nhóm nhiệm vụ' }]}
                initialValue="I. CÔNG TÁC CHÍNH TRỊ - TƯ TƯỞNG"
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="Chọn nhóm nhiệm vụ hoặc nhập nhóm mới..."
                  optionFilterProp="children"
                  onChange={(val) => {
                    // Khi chọn hoặc đổi nhóm công việc, tự động tính STT tiếp theo trong nhóm đó (nếu đang tạo mới)
                    if (!editingItem) {
                      const nextOrd = getNextOrderForGroup(val);
                      itemForm.setFieldsValue({ order: nextOrd });
                    }
                  }}
                  dropdownRender={(menu) => (
                    <div>
                      {menu}
                      <Divider className="my-1" />
                      <div className="px-3 py-1.5 text-xs text-slate-400 italic">
                        Có thể chọn trong danh sách hoặc gõ trực tiếp tên nhóm mới
                      </div>
                    </div>
                  )}
                >
                  {availableGroups.map((g) => (
                    <Option key={g} value={g}>
                      {g}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="order" label="Thứ tự (STT)" initialValue={1}>
                <InputNumber min={1} className="w-full" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="taskContent"
            label="Nội dung công việc / Nhiệm vụ cụ thể"
            rules={[{ required: true, message: 'Vui lòng nhập nội dung công việc' }]}
          >
            <TextArea rows={3} placeholder="Nội dung chi tiết công việc cần triển khai..." />
          </Form.Item>

          <Form.Item name="expectedOutcome" label="Sản phẩm / Kết quả đầu ra dự kiến">
            <Input placeholder="Ví dụ: Quyết định ban hành, Báo cáo nghiệm thu, Kế hoạch chi tiết..." />
          </Form.Item>

          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="assignedDepartments"
                label={
                  <div className="flex items-center justify-between w-full">
                    <span>Đơn vị chủ trì thực hiện <span className="text-red-500">*</span></span>
                    <Button
                      type="link"
                      size="small"
                      className="p-0 h-auto text-xs text-blue-600 hover:text-blue-500 font-medium"
                      onClick={() => {
                        const current = itemForm.getFieldValue('assignedDepartments') || [];
                        if (current.length === allDepartmentIds.length) {
                          itemForm.setFieldsValue({ assignedDepartments: [] });
                        } else {
                          itemForm.setFieldsValue({ assignedDepartments: allDepartmentIds });
                        }
                      }}
                    >
                      {itemForm.getFieldValue('assignedDepartments')?.length === allDepartmentIds.length
                        ? 'Bỏ chọn tất cả'
                        : 'Chọn tất cả'}
                    </Button>
                  </div>
                }
                rules={[{ required: true, message: 'Chọn ít nhất một đơn vị chủ trì' }]}
              >
                <Select
                  mode="multiple"
                  showSearch
                  placeholder="Chọn Khoa/Phòng/Trung tâm"
                  allowClear
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  dropdownRender={(menu) => (
                    <div>
                      <div className="p-2 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <span className="text-xs text-slate-500 font-medium">
                          Tổng số {departments.length} đơn vị
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="small"
                            type="primary"
                            ghost
                            className="text-xs h-6 px-2"
                            onClick={() => {
                              itemForm.setFieldsValue({ assignedDepartments: allDepartmentIds });
                            }}
                          >
                            Chọn tất cả
                          </Button>
                          <Button
                            size="small"
                            className="text-xs h-6 px-2 text-slate-500"
                            onClick={() => {
                              itemForm.setFieldsValue({ assignedDepartments: [] });
                            }}
                          >
                            Bỏ chọn
                          </Button>
                        </div>
                      </div>
                      {menu}
                    </div>
                  )}
                >
                  {groupedDepartments.map((grp) => (
                    <Select.OptGroup key={grp.key} label={<span className="font-bold text-slate-700">{grp.label}</span>}>
                      {grp.items.map((d) => (
                        <Option key={d._id} value={d._id}>
                          {d.departmentName}
                        </Option>
                      ))}
                    </Select.OptGroup>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="coordinatingDepartments"
                label={
                  <div className="flex items-center justify-between w-full">
                    <span>Đơn vị phối hợp</span>
                    <Button
                      type="link"
                      size="small"
                      className="p-0 h-auto text-xs text-blue-600 hover:text-blue-500 font-medium"
                      onClick={() => {
                        const current = itemForm.getFieldValue('coordinatingDepartments') || [];
                        if (current.length === allDepartmentIds.length) {
                          itemForm.setFieldsValue({ coordinatingDepartments: [] });
                        } else {
                          itemForm.setFieldsValue({ coordinatingDepartments: allDepartmentIds });
                        }
                      }}
                    >
                      {itemForm.getFieldValue('coordinatingDepartments')?.length === allDepartmentIds.length
                        ? 'Bỏ chọn tất cả'
                        : 'Chọn tất cả'}
                    </Button>
                  </div>
                }
              >
                <Select
                  mode="multiple"
                  showSearch
                  placeholder="Đơn vị phối hợp (nếu có)"
                  allowClear
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  dropdownRender={(menu) => (
                    <div>
                      <div className="p-2 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <span className="text-xs text-slate-500 font-medium">
                          Tổng số {departments.length} đơn vị
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="small"
                            type="primary"
                            ghost
                            className="text-xs h-6 px-2"
                            onClick={() => {
                              itemForm.setFieldsValue({ coordinatingDepartments: allDepartmentIds });
                            }}
                          >
                            Chọn tất cả
                          </Button>
                          <Button
                            size="small"
                            className="text-xs h-6 px-2 text-slate-500"
                            onClick={() => {
                              itemForm.setFieldsValue({ coordinatingDepartments: [] });
                            }}
                          >
                            Bỏ chọn
                          </Button>
                        </div>
                      </div>
                      {menu}
                    </div>
                  )}
                >
                  {groupedDepartments.map((grp) => (
                    <Select.OptGroup key={grp.key} label={<span className="font-bold text-slate-700">{grp.label}</span>}>
                      {grp.items.map((d) => (
                        <Option key={d._id} value={d._id}>
                          {d.departmentName}
                        </Option>
                      ))}
                    </Select.OptGroup>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="bghInCharge"
            label="Ban Giám hiệu phụ trách chỉ đạo"
            rules={[{ required: true, message: 'Chọn lãnh đạo Ban Giám hiệu phụ trách' }]}
          >
            <Select
              mode="multiple"
              showSearch
              placeholder="Chọn lãnh đạo Ban Giám hiệu"
              allowClear
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {bghUsers.map((u) => (
                <Option key={u._id} value={u._id}>
                  {u.name}{u.position?.positionName ? `: ${u.position.positionName}` : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={[12, 12]}>
            <Col xs={24} sm={14}>
              <Form.Item
                name="expectedRange"
                label="Hạn dự kiến HT (Từ ngày - Đến ngày)"
                rules={[{ required: true, message: 'Chọn khoảng thời gian dự kiến hoàn thành' }]}
              >
                <DatePicker.RangePicker format="DD/MM/YYYY" className="w-full" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item name="actualCompletedDate" label="Ngày thực tế HT (nếu có)">
                <DatePicker format="DD/MM/YYYY" className="w-full" allowClear />
              </Form.Item>
            </Col>
          </Row>

          {/* Trạng thái thực hiện nhiệm vụ (dạng nút nổi bật) */}
          <Form.Item
            name="status"
            label="Trạng thái nhiệm vụ"
            initialValue="IN_PROGRESS"
          >
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue, setFieldsValue }) => {
                const currentStatus = getFieldValue('status') || 'IN_PROGRESS';
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {STATUS_OPTIONS.map((opt) => {
                      const isSelected = currentStatus === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            const newVals = { status: opt.value };
                            if (opt.value === 'COMPLETED') {
                              if (!getFieldValue('actualCompletedDate')) {
                                newVals.actualCompletedDate = dayjs();
                              }
                            } else {
                              newVals.actualCompletedDate = null;
                            }
                            setFieldsValue(newVals);
                          }}
                          className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02]'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                          }`}
                        >
                          <Tag
                            color={opt.color}
                            className={`mr-0 font-bold ${isSelected ? '!text-white !bg-transparent !border-0' : ''}`}
                          >
                            {opt.label}
                          </Tag>
                        </button>
                      );
                    })}
                  </div>
                );
              }}
            </Form.Item>
          </Form.Item>

          {/* Lý do tạm dừng khi status là PAUSED */}
          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.status !== currentValues.status}>
            {({ getFieldValue }) =>
              getFieldValue('status') === 'PAUSED' ? (
                <Form.Item
                  name="pauseReason"
                  label="Lý do tạm ngưng thực hiện"
                  rules={[{ required: true, message: 'Vui lòng nhập lý do tạm ngưng nhiệm vụ' }]}
                  className="mt-2"
                >
                  <TextArea rows={2} placeholder="Nhập lý do hoặc nguyên nhân tạm ngưng nhiệm vụ..." />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          {/* Tệp đính kèm */}
          <Form.Item label="Tệp đính kèm (văn bản, tài liệu, minh chứng nếu có)">
            <Upload
              customRequest={handleCustomUpload}
              showUploadList={false}
              disabled={isUploading}
            >
              <Button icon={<UploadOutlined />} loading={isUploading} size="middle">
                Tải lên tệp đính kèm
              </Button>
            </Upload>

            {uploadedFiles.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.fileId}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <PaperClipOutlined className="text-blue-500 shrink-0" />
                      <span className="truncate font-medium text-slate-700">{file.fileName}</span>
                    </div>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveUploadedFile(file.fileId)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Form.Item>

          <Form.Item name="manualRemark" label="Ghi chú thêm">
            <Input placeholder="Ghi chú thêm của Quản lý / Ban Giám hiệu..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 3: Cập nhật tiến độ & hoàn thành thực tế (Chỉ Manager) */}
      <Modal
        title={<span className="font-bold text-base text-blue-900">Cập Nhật Tiến Độ & Ngày Hoàn Thành</span>}
        open={progressModalVisible}
        onCancel={() => setProgressModalVisible(false)}
        onOk={() => progressForm.submit()}
        okText="Lưu Cập Nhật"
        cancelText="Hủy"
        width="95%"
        style={{ maxWidth: 520 }}
        centered
      >
        <Form form={progressForm} layout="vertical" onFinish={handleUpdateProgress} className="pt-2">
          {progressItem && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3 text-xs space-y-1">
              <div className="font-bold text-slate-800">{progressItem.taskContent}</div>
              <div className="text-slate-500">
                Hạn dự kiến HT:{' '}
                <span className="font-semibold text-blue-700">
                  {progressItem.startDate && progressItem.expectedDeadline
                    ? `${dayjs(progressItem.startDate).format('DD/MM/YYYY')} - ${dayjs(progressItem.expectedDeadline).format('DD/MM/YYYY')}`
                    : (progressItem.expectedDeadline ? dayjs(progressItem.expectedDeadline).format('DD/MM/YYYY') : '—')}
                </span>
              </div>
            </div>
          )}

          <Form.Item name="actualCompletedDate" label="Ngày thực tế hoàn thành">
            <DatePicker format="DD/MM/YYYY" className="w-full" allowClear placeholder="Chọn ngày nếu đã hoàn thành" />
          </Form.Item>

          <Form.Item name="progressPercent" label="Tiến độ thực hiện (%)">
            <InputNumber min={0} max={100} className="w-full" />
          </Form.Item>

          {/* Trạng thái dạng nổi bật lựa chọn nút */}
          <Form.Item
            name="status"
            label="Trạng thái thực hiện"
            rules={[{ required: true, message: 'Vui lòng chọn trạng thái' }]}
          >
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue, setFieldsValue }) => {
                const currentStatus = getFieldValue('status') || 'IN_PROGRESS';
                return (
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_OPTIONS.map((opt) => {
                      const isSelected = currentStatus === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            const newVals = { status: opt.value };
                            if (opt.value === 'COMPLETED') {
                              if (!getFieldValue('actualCompletedDate')) {
                                newVals.actualCompletedDate = dayjs();
                              }
                              newVals.progressPercent = 100;
                            } else {
                              newVals.actualCompletedDate = null;
                            }
                            setFieldsValue(newVals);
                          }}
                          className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02]'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                          }`}
                        >
                          <Tag
                            color={opt.color}
                            className={`mr-0 font-bold ${isSelected ? '!text-white !bg-transparent !border-0' : ''}`}
                          >
                            {opt.label}
                          </Tag>
                        </button>
                      );
                    })}
                  </div>
                );
              }}
            </Form.Item>
          </Form.Item>

          {/* Lý do tạm dừng nếu chọn PAUSED */}
          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.status !== currentValues.status}>
            {({ getFieldValue }) =>
              getFieldValue('status') === 'PAUSED' ? (
                <Form.Item
                  name="pauseReason"
                  label="Lý do tạm ngưng thực hiện"
                  rules={[{ required: true, message: 'Vui lòng nhập lý do tạm ngưng nhiệm vụ' }]}
                  className="mt-2"
                >
                  <TextArea rows={2} placeholder="Nhập nguyên nhân hoặc lý do tạm ngưng..." />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 4: Import danh sách nhiệm vụ từ Excel */}
      <Modal
        title={<span className="font-bold text-base text-blue-900">Import Danh Sách Nhiệm Vụ Từ Excel</span>}
        open={importModalVisible}
        onCancel={() => {
          setImportModalVisible(false);
          setImportedPreviewList([]);
        }}
        onOk={handleConfirmImport}
        okText={importLoading ? 'Đang Import...' : `Xác Nhận Import (${importedPreviewList.length} nhiệm vụ)`}
        okButtonProps={{ disabled: importedPreviewList.length === 0, loading: importLoading }}
        cancelText="Hủy"
        width="95%"
        style={{ maxWidth: 850 }}
        centered
      >
        <div className="space-y-4 pt-2">
          {/* Hướng dẫn và Nút tải file mẫu */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-900 text-sm">Hướng dẫn Import:</span>
              <Button
                size="small"
                type="primary"
                ghost
                icon={<DownloadOutlined />}
                onClick={handleDownloadSampleExcel}
                className="text-xs"
              >
                Tải file mẫu Excel (.xlsx)
              </Button>
            </div>
            <ul className="list-disc list-inside text-slate-600 space-y-1">
              <li>File Excel mẫu có kèm các <strong>Sheet phụ tra cứu</strong> (Danh mục Đơn vị, Ban Giám hiệu, Nhóm nhiệm vụ) giúp bạn sao chép chuẩn xác không bị lỗi.</li>
              <li>Hệ thống sẽ tự động ghép nối Tên đơn vị và Tên Ban Giám hiệu theo dữ liệu thực tế của trường.</li>
            </ul>
          </div>

          {/* Vùng tải file có viền rõ ràng */}
          <div className="border-2 border-dashed border-blue-300 rounded-2xl p-4 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-500 transition-all text-center">
            <Upload
              accept=".xlsx, .xls"
              beforeUpload={handleReadExcelFile}
              showUploadList={false}
              className="w-full block"
            >
              <div className="py-4 cursor-pointer flex flex-col items-center justify-center space-y-2">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-full inline-flex">
                  <InboxOutlined className="text-3xl" />
                </div>
                <div className="font-semibold text-slate-800 text-sm">
                  Nhấp hoặc kéo thả tệp Excel vào đây để tải lên
                </div>
                <div className="text-xs text-slate-500">
                  Hỗ trợ định dạng .xlsx hoặc .xls
                </div>
              </div>
            </Upload>
          </div>

          {/* Danh sách nhiệm vụ đã đọc được để xem trước */}
          {importedPreviewList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-700">
                  Xem trước dữ liệu ({importedPreviewList.length} nhiệm vụ tìm thấy):
                </span>
                <Button
                  size="small"
                  danger
                  type="text"
                  onClick={() => setImportedPreviewList([])}
                >
                  Xóa danh sách tải lên
                </Button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                {importedPreviewList.map((item, idx) => (
                  <div key={idx} className="p-2.5 flex items-start justify-between gap-3 hover:bg-slate-50">
                    <div className="space-y-0.5">
                      <div className="font-bold text-blue-800 text-[11px]">{item.groupName}</div>
                      <div className="font-medium text-slate-800">{item.taskContent}</div>
                      <div className="text-slate-500 text-[11px]">
                        Chủ trì: <span className="text-cyan-700">{item.assignedDepartmentNames?.join(', ') || 'Chưa rõ'}</span> • BGH: <span className="text-purple-700">{item.bghNames?.join(', ') || 'Ban Giám hiệu'}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-slate-500">
                      Hạn: {item.expectedDeadline ? dayjs(item.expectedDeadline).format('DD/MM/YYYY') : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 5: Xem chi tiết nhiệm vụ (Dành cho Manager, Cấp trưởng, Cấp phó) */}
      <Modal
        title={<span className="font-bold text-base text-blue-900">Chi Tiết Nhiệm Vụ Kế Hoạch Quý</span>}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          (isLeader || isManager) && (
            <Button
              key="submit-report"
              type="primary"
              icon={<SendOutlined />}
              onClick={() => {
                setDetailModalVisible(false);
                navigate('/online-records/submit');
              }}
              className="bg-blue-600"
            >
              Gửi Hồ Sơ Báo Cáo
            </Button>
          ),
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>,
        ]}
        width="95%"
        style={{ maxWidth: 680 }}
        centered
      >
        {detailItem && (
          <div className="space-y-4 pt-2 text-xs">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">
                {detailItem.groupName}
              </span>
              <div className="text-sm font-bold text-slate-800 leading-snug">
                {detailItem.taskContent}
              </div>
            </div>

            <Row gutter={[16, 16]}>
              <Col span={24}>
                <span className="text-slate-400 font-medium block">Sản phẩm / Kết quả đầu ra:</span>
                <span className="font-semibold text-slate-800 text-sm">
                  {detailItem.expectedOutcome || '—'}
                </span>
              </Col>

              <Col xs={24} sm={12}>
                <span className="text-slate-400 font-medium block">Đơn vị chủ trì thực hiện:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {detailItem.assignedDepartments && detailItem.assignedDepartments.length > 0 ? (
                    detailItem.assignedDepartments.map((d) => (
                      <Tag color="cyan" key={d._id} className="font-semibold text-xs">
                        {d.departmentName}
                      </Tag>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">Chưa phân công</span>
                  )}
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <span className="text-slate-400 font-medium block">Đơn vị phối hợp:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {detailItem.coordinatingDepartments && detailItem.coordinatingDepartments.length > 0 ? (
                    detailItem.coordinatingDepartments.map((d) => (
                      <Tag key={d._id} className="text-slate-600 text-xs">
                        {d.departmentName}
                      </Tag>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">Không có</span>
                  )}
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <span className="text-slate-400 font-medium block">Ban Giám hiệu phụ trách chỉ đạo:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {detailItem.bghInCharge && detailItem.bghInCharge.length > 0 ? (
                    detailItem.bghInCharge.map((u) => (
                      <Tag color="purple" key={u._id} className="font-semibold text-xs">
                        {u.name}{u.position?.positionName ? `: ${u.position.positionName}` : ''}
                      </Tag>
                    ))
                  ) : (
                    <span className="text-slate-400 italic">Ban Giám hiệu</span>
                  )}
                </div>
              </Col>

              <Col xs={24} sm={12}>
                <span className="text-slate-400 font-medium block">Hạn dự kiến hoàn thành:</span>
                <span className="font-bold text-blue-700 text-xs">
                  {detailItem.startDate && detailItem.expectedDeadline
                    ? `${dayjs(detailItem.startDate).format('DD/MM/YYYY')} - ${dayjs(detailItem.expectedDeadline).format('DD/MM/YYYY')}`
                    : (detailItem.expectedDeadline ? dayjs(detailItem.expectedDeadline).format('DD/MM/YYYY') : '—')}
                </span>
              </Col>

              <Col xs={24} sm={12}>
                <span className="text-slate-400 font-medium block">Thời gian thực tế hoàn thành:</span>
                <span className="font-bold text-emerald-700 text-xs">
                  {detailItem.actualCompletedDate
                    ? dayjs(detailItem.actualCompletedDate).format('DD/MM/YYYY')
                    : 'Chưa hoàn thành'}
                </span>
              </Col>

              <Col xs={24} sm={12}>
                <span className="text-slate-400 font-medium block">Đánh giá / Nhận xét tự động:</span>
                <span className="font-semibold text-slate-700 text-xs">
                  {detailItem.autoRemark || '—'}
                </span>
              </Col>

              <Col xs={24} sm={12}>
                <span className="text-slate-400 font-medium block">Trạng thái công việc:</span>
                <div className="mt-1">
                  {(() => {
                    const opt = STATUS_OPTIONS.find((s) => s.value === detailItem.status) || STATUS_OPTIONS[0];
                    return (
                      <Tag color={opt.color} className="font-bold text-xs">
                        {opt.label}
                      </Tag>
                    );
                  })()}
                </div>
              </Col>

              {detailItem.status === 'PAUSED' && detailItem.pauseReason && (
                <Col span={24}>
                  <span className="text-amber-600 font-medium block">Lý do tạm ngưng:</span>
                  <div className="p-2 bg-amber-50 rounded-lg text-amber-900 text-xs mt-1 border border-amber-200">
                    {detailItem.pauseReason}
                  </div>
                </Col>
              )}

              {detailItem.files && detailItem.files.length > 0 && (
                <Col span={24}>
                  <span className="text-slate-400 font-medium block">Tệp đính kèm:</span>
                  <div className="mt-1">{renderFileList(detailItem.files)}</div>
                </Col>
              )}

              {detailItem.manualRemark && (
                <Col span={24}>
                  <span className="text-slate-400 font-medium block">Ghi chú thêm:</span>
                  <div className="p-2 bg-slate-50 rounded-lg text-slate-700 text-xs mt-1 border border-slate-200">
                    {detailItem.manualRemark}
                  </div>
                </Col>
              )}
            </Row>
          </div>
        )}
      </Modal>

      {/* MODAL 6: Xem lịch sử thay đổi nội dung & trạng thái nhiệm vụ */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-900">
            <HistoryOutlined className="text-purple-600 text-lg" />
            <span className="font-bold text-base">Lịch Sử Thay Đổi Nhiệm Vụ</span>
          </div>
        }
        open={historyModalVisible}
        onCancel={() => {
          setHistoryModalVisible(false);
          setHistoryItem(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setHistoryModalVisible(false);
            setHistoryItem(null);
          }}>
            Đóng
          </Button>,
        ]}
        width="95%"
        style={{ maxWidth: 650 }}
        centered
      >
        {historyItem && (
          <div className="space-y-4 pt-2 text-xs">
            {/* Tóm tắt nhiệm vụ */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
              <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wide">
                {historyItem.groupName}
              </span>
              <div className="text-sm font-bold text-slate-800 leading-snug">
                {historyItem.taskContent}
              </div>
              <div className="text-[11px] text-slate-500 pt-1 flex items-center gap-2">
                <span>Trạng thái hiện tại:</span>
                {(() => {
                  const opt = STATUS_OPTIONS.find((s) => s.value === historyItem.status) || STATUS_OPTIONS[0];
                  return <Tag color={opt.color} className="font-semibold mr-0">{opt.label}</Tag>;
                })()}
                {historyItem.pauseReason && (
                  <span className="text-amber-700 italic">({historyItem.pauseReason})</span>
                )}
              </div>
            </div>

            {/* Dòng thời gian lịch sử */}
            <div className="p-3 bg-white rounded-xl border border-slate-200">
              <span className="font-bold text-slate-800 text-xs block mb-3">
                Nhật ký tiến trình & các lần chỉnh sửa ({historyItem.history?.length || 0}):
              </span>
              {(!historyItem.history || historyItem.history.length === 0) ? (
                <div className="text-center py-6 text-slate-400 italic">
                  Chưa ghi nhận lịch sử thay đổi nào cho nhiệm vụ này.
                </div>
              ) : (
                <Timeline
                  className="mt-2 text-xs"
                  items={historyItem.history.map((h, idx) => {
                    let dotColor = 'blue';
                    if (h.action === 'CREATE') dotColor = 'green';
                    else if (h.action === 'STATUS_CHANGE') dotColor = 'orange';

                    const actorDisplay = h.actor?.name || h.actorName || 'Người dùng hệ thống';
                    return {
                      color: dotColor,
                      children: (
                        <div key={idx} className="space-y-1">
                          <div className="font-semibold text-slate-800 leading-snug">
                            {h.details || 'Cập nhật thông tin nhiệm vụ'}
                          </div>
                          <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
                            <span className="font-medium text-slate-600">{actorDisplay}</span>
                            <span>•</span>
                            <span>{dayjs(h.timestamp).format('DD/MM/YYYY HH:mm:ss')}</span>
                          </div>
                        </div>
                      ),
                    };
                  })}
                />
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default QuarterlyPlanPage;
