import { formatFileName } from "../../utils/formatFileName";
import { getDriveToken, uploadFileDirectlyToDrive } from "../../api/driveApi";
import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, DatePicker, TimePicker, Select, Button, message, Segmented, Pagination, Upload, Row, Col, Card, Statistic, Table, Tag, Space, Tooltip, Timeline, Alert, Rate, InputNumber, Progress, Checkbox, Popconfirm, Badge, AutoComplete } from 'antd';
import { UploadOutlined, ProfileOutlined, SyncOutlined, CheckCircleOutlined, CheckCircleFilled, FileTextOutlined, ExportOutlined, EditOutlined, EyeOutlined, HistoryOutlined, StarFilled, StarOutlined, TrophyOutlined, DeleteOutlined, ExclamationCircleOutlined, PlusOutlined, BranchesOutlined, ClockCircleOutlined, UserOutlined, CheckOutlined, SendOutlined, CloudServerOutlined, PrinterOutlined, FileExcelOutlined, FileDoneOutlined, SaveOutlined, DownOutlined } from '@ant-design/icons';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { getTasks, createTask, updateTask, deleteTask, evaluateTask, addSubtask, updateSubtask, deleteSubtask } from '../../api/taskApi';
import { getFocusAxes } from '../../api/focusAxisApi';
import { getAllUsers, getUserInfo } from '../../api/auth';
import { categorizeUsers, isBghUser, getAssignableUsers } from "../../utils/userClassification";
import { removeVietnameseTones } from "../../utils/stringUtils";
import { useNotificationContext } from '../../context/NotificationContext';
import SelectFromSignatureArchive from '../../components/SelectFromSignatureArchive';
import RecurringTasksModal from '../../components/RecurringTasksModal';
import ThreadDiscussionBox from '../../components/ThreadDiscussion/ThreadDiscussionBox';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'moment/locale/vi';

// Thiết lập ngôn ngữ tiếng Việt cho moment
moment.locale('vi');
const localizer = momentLocalizer(moment);

const { Option } = Select;
const { RangePicker } = DatePicker;

const OUTPUT_RESULT_OPTIONS = [
    'Văn bản / Tài liệu',
    'Báo cáo tổng hợp',
    'Quyết định',
    'Kế hoạch',
    'Thông báo',
    'Công văn',
    'Phần mềm ứng dụng',
    'Tờ trình',
    'Biên bản',
    'Hội nghị / Hội thảo',
    'Kết quả kiểm tra / Giám sát',
    'Khác'
];

const FOCUS_AXIS_OPTIONS = [
    {
        key: 'TRUC_1',
        label: 'TRỤC 1 - THỰC HIỆN MỤC TIÊU PHÁT TRIỂN KINH TẾ - XÃ HỘI VÀ NHIỆM VỤ CHÍNH TRỊ ĐƯỢC GIAO',
        shortLabel: 'Trục 1',
        color: 'blue'
    },
    {
        key: 'TRUC_2',
        label: 'TRỤC 2 - HOÀN THIỆN THỂ CHẾ, ĐẨY MẠNH PHÂN CẤP, PHÂN QUYỀN GẮN VỚI KIỂM TRA, GIÁM SÁT',
        shortLabel: 'Trục 2',
        color: 'cyan'
    },
    {
        key: 'TRUC_3',
        label: 'TRỤC 3 - THÚC ĐẨY PHÁT TRIỂN KHOA HỌC, CÔNG NGHỆ, ĐỔI MỚI SÁNG TẠO VÀ CHUYỂN ĐỔI SỐ',
        shortLabel: 'Trục 3',
        color: 'purple'
    },
    {
        key: 'TRUC_4',
        label: 'TRỤC 4 - XÂY DỰNG ĐẢNG VÀ HỆ THỐNG CHÍNH TRỊ TRONG SẠCH, VỮNG MẠNH; GIỮ GÌN ĐOÀN KẾT, THỐNG NHẤT NỘI BỘ; PHÒNG, CHỐNG THAM NHŨNG, LÃNG PHÍ, TIÊU CỰC',
        shortLabel: 'Trục 4',
        color: 'red'
    },
    {
        key: 'TRUC_5',
        label: 'TRỤC 5 - PHÁT TRIỂN VĂN HÓA, CON NGƯỜI, BẢO ĐẢM AN SINH XÃ HỘI, NÂNG CAO ĐỜI SỐNG NHÂN DÂN',
        shortLabel: 'Trục 5',
        color: 'green'
    },
    {
        key: 'TRUC_6',
        label: 'TRỤC 6 - CỦNG CỐ QUỐC PHÒNG, AN NINH, GIỮ VỮNG ỔN ĐỊNH CHÍNH TRỊ - XÃ HỘI, NÂNG CAO HIỆU QUẢ ĐỐI NGOẠI VÀ HỘI NHẬP QUỐC TẾ',
        shortLabel: 'Trục 6',
        color: 'gold'
    }
];

// Component hiển thị bộ chọn trạng thái trực quan, nổi bật
const StatusSelector = ({ value = 'TODO', onChange, formSubtasks = [] }) => {
    const hasUnfinishedSubtasks = formSubtasks.length > 0 && formSubtasks.some(s => s.status !== 'DONE');
    const unfinishedCount = formSubtasks.filter(s => s.status !== 'DONE').length;

    const items = [
        {
            key: 'TODO',
            label: 'Chưa làm',
            desc: 'Chưa bắt đầu thực hiện',
            icon: ClockCircleOutlined,
            activeBg: 'bg-gradient-to-br from-slate-50 to-slate-100/90 border-slate-500 shadow-md ring-2 ring-slate-400/50',
            activeText: 'text-slate-800',
            activeIcon: 'text-slate-700',
            badgeBg: 'bg-slate-200 text-slate-700',
            dotBg: 'bg-slate-500'
        },
        {
            key: 'IN_PROGRESS',
            label: 'Đang làm',
            desc: 'Đang trong tiến trình xử lý',
            icon: SyncOutlined,
            activeBg: 'bg-gradient-to-br from-blue-50 to-indigo-50/90 border-blue-600 shadow-md ring-2 ring-blue-400/50',
            activeText: 'text-blue-900',
            activeIcon: 'text-blue-600',
            badgeBg: 'bg-blue-100 text-blue-800',
            dotBg: 'bg-blue-600'
        },
        {
            key: 'DONE',
            label: 'Hoàn thành',
            desc: hasUnfinishedSubtasks ? `Còn ${unfinishedCount} việc con chưa xong` : 'Đã hoàn tất kết quả đầu ra',
            icon: CheckCircleFilled,
            disabled: hasUnfinishedSubtasks,
            activeBg: 'bg-gradient-to-br from-emerald-50 to-teal-50/90 border-emerald-600 shadow-md ring-2 ring-emerald-400/50',
            activeText: 'text-emerald-900',
            activeIcon: 'text-emerald-600',
            badgeBg: 'bg-emerald-100 text-emerald-800',
            dotBg: 'bg-emerald-600'
        }
    ];

    return (
        <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                {items.map(item => {
                    const Icon = item.icon;
                    const isSelected = value === item.key;
                    const isDisabled = !!item.disabled;

                    return (
                        <div
                            key={item.key}
                            onClick={() => {
                                if (!isDisabled && onChange) {
                                    onChange(item.key);
                                }
                            }}
                            className={`relative rounded-xl border-2 p-3 transition-all duration-200 select-none flex flex-col justify-between ${
                                isDisabled
                                    ? 'opacity-60 cursor-not-allowed bg-slate-50 border-dashed border-slate-300 text-slate-400'
                                    : isSelected
                                        ? `${item.activeBg} cursor-pointer scale-[1.01]`
                                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 text-slate-600 cursor-pointer'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isSelected ? item.badgeBg : 'bg-slate-100 text-slate-400'}`}>
                                        <Icon 
                                            className={`text-base ${isSelected ? item.activeIcon : 'text-slate-400'}`} 
                                            spin={item.key === 'IN_PROGRESS' && isSelected} 
                                        />
                                    </div>
                                    <span className={`text-sm sm:text-base font-semibold ${isSelected ? `${item.activeText} font-bold` : 'text-slate-700'}`}>
                                        {item.label}
                                    </span>
                                </div>
                                {isSelected && (
                                    <span className="flex h-3 w-3 relative">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${item.dotBg}`}></span>
                                        <span className={`relative inline-flex rounded-full h-3 w-3 ${item.dotBg}`}></span>
                                    </span>
                                )}
                            </div>
                            <div className="text-[12px] leading-tight text-slate-500 pl-9">
                                {item.desc}
                            </div>
                        </div>
                    );
                })}
            </div>
            {hasUnfinishedSubtasks && (
                <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                    <ExclamationCircleOutlined className="text-amber-600 text-base flex-shrink-0" />
                    <span><b>Lưu ý:</b> Công việc lớn chỉ được phép hoàn thành khi toàn bộ <b>{formSubtasks.length}</b> công việc con đã hoàn thành. Hiện còn <b>{unfinishedCount}</b> công việc con chưa xong.</span>
                </div>
            )}
        </div>
    );
};

const SchedulePage = () => {
    const { tab } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [displayView, setDisplayView] = useState(['todo', 'inprogress', 'done'].includes(tab) ? 'table' : 'kanban');

    useEffect(() => {
        if (['todo', 'inprogress', 'done'].includes(tab)) {
            setDisplayView('table');
        }
    }, [tab]);

    const { userId, userRole, refetchNotificationCounts } = useNotificationContext();
    const normalizedRole = (userRole || '').toLowerCase();
    const isGvCv = normalizedRole === 'chuyenvien' || normalizedRole === 'gv-cv' || normalizedRole === 'gv-vc' || normalizedRole === 'user';
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);

    const currentUserObj = useMemo(() => {
        return currentUser || users.find(u => String(u._id) === String(userId)) || null;
    }, [currentUser, users, userId]);

    const isBgh = useMemo(() => {
        if (normalizedRole === 'bgh') return true;
        if (currentUserObj) {
            return isBghUser(currentUserObj) || (currentUserObj.department?.departmentCode || '').toUpperCase() === 'BGH';
        }
        return false;
    }, [normalizedRole, currentUserObj]);

    const shouldHideSendReply = isGvCv || isBgh;
    const [isEvalModalVisible, setIsEvalModalVisible] = useState(false);
    const [evaluatingTask, setEvaluatingTask] = useState(null);
    const [evalScore, setEvalScore] = useState(80);
    const [evalRating, setEvalRating] = useState(4);
    const [evalQualityRate, setEvalQualityRate] = useState(100);
    const [evalProgressRate, setEvalProgressRate] = useState(100);
    const [evalIsExceeded, setEvalIsExceeded] = useState(false);
    const [evalBonusScore, setEvalBonusScore] = useState(0);
    const [evalFeedback, setEvalFeedback] = useState('');
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isRecurringModalVisible, setIsRecurringModalVisible] = useState(false);
    const [isDetailsVisible, setIsDetailsVisible] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [selectedTask, setSelectedTask] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [form] = Form.useForm();
    const [focusAxes, setFocusAxes] = useState(FOCUS_AXIS_OPTIONS);

    useEffect(() => {
        const fetchFocusAxes = async () => {
            try {
                const res = await getFocusAxes({ activeOnly: 'true' });
                if (res && res.success && res.data && res.data.length > 0) {
                    setFocusAxes(res.data.map(item => ({
                        key: item.code,
                        label: item.name,
                        shortLabel: item.shortName || item.code,
                        color: item.color || 'blue'
                    })));
                }
            } catch (error) {
                console.error('Lỗi khi tải danh mục trục kết quả:', error);
            }
        };
        fetchFocusAxes();
    }, []);

    const renderFocusAxisTag = (val) => {
        if (!val) return <span className="text-gray-400 italic text-xs">Chưa xác định</span>;
        const found = focusAxes.find(a => a.key === val || a.label === val || a.shortLabel === val);
        if (found) {
            return <Tag color={found.color} className="text-xs">{found.shortLabel || found.label}</Tag>;
        }
        return <Tag color="blue" className="text-xs">{val}</Tag>;
    };

    // --- SUBTASK STATES & HANDLERS ---
    const [showAddSubtaskForm, setShowAddSubtaskForm] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [newSubtaskAssignee, setNewSubtaskAssignee] = useState(null);
    const [newSubtaskEndDate, setNewSubtaskEndDate] = useState(null);
    const [isSubmittingSubtask, setIsSubmittingSubtask] = useState(false);

    const [isEditSubtaskModalVisible, setIsEditSubtaskModalVisible] = useState(false);
    const [subtaskToEdit, setSubtaskToEdit] = useState(null);
    const [editSubtaskForm] = Form.useForm();

    // Subtasks khi Tạo / Sửa trong Modal Form
    const [formSubtasks, setFormSubtasks] = useState([]);
    const [tempSubtaskTitle, setTempSubtaskTitle] = useState('');
    const [tempSubtaskAssignee, setTempSubtaskAssignee] = useState(null);
    const [tempSubtaskEndDate, setTempSubtaskEndDate] = useState(null);

    const getSubtaskStats = (task) => {
        if (!task || !task.subtasks || !Array.isArray(task.subtasks) || task.subtasks.length === 0) {
            return null;
        }
        const total = task.subtasks.length;
        const done = task.subtasks.filter(s => s.status === 'DONE').length;
        const percent = Math.round((done / total) * 100);
        const hasUnfinished = done < total;
        return { total, done, percent, hasUnfinished };
    };

    const canManageSubtasks = useMemo(() => {
        if (!selectedTask) return false;
        const isCreator = (selectedTask.createdBy?._id || selectedTask.createdBy) === userId;
        const isAssignee = selectedTask.assignees?.some(a => (a._id || a) === userId);
        const isAdminOrManager = ['admin', 'manager', 'cappho'].includes(userRole);
        return isCreator || isAssignee || isAdminOrManager;
    }, [selectedTask, userId, userRole]);

    const handleToggleSubtaskStatus = async (task, subtask) => {
        const newStatus = subtask.status === 'DONE' ? 'TODO' : 'DONE';
        try {
            const res = await updateSubtask(task._id, subtask._id, { status: newStatus });
            if (res.success) {
                message.success(`Đã chuyển công việc con sang "${newStatus === 'DONE' ? 'Hoàn thành' : 'Chưa làm'}"`);
                setSelectedTask(res.data);
                setTasks(prev => prev.map(t => t._id === task._id ? res.data : t));
                if (refetchNotificationCounts) refetchNotificationCounts();
            }
        } catch (error) {
            message.error(error.response?.data?.message || "Lỗi cập nhật việc con");
        }
    };

    const handleChangeSubtaskStatus = async (task, subtask, newStatus) => {
        try {
            const res = await updateSubtask(task._id, subtask._id, { status: newStatus });
            if (res.success) {
                message.success("Cập nhật trạng thái việc con thành công");
                setSelectedTask(res.data);
                setTasks(prev => prev.map(t => t._id === task._id ? res.data : t));
                if (refetchNotificationCounts) refetchNotificationCounts();
            }
        } catch (error) {
            message.error(error.response?.data?.message || "Lỗi cập nhật việc con");
        }
    };

    const handleAddSubtaskSubmit = async (task) => {
        if (!newSubtaskTitle.trim()) {
            message.warning("Vui lòng nhập tiêu đề công việc con");
            return;
        }
        setIsSubmittingSubtask(true);
        try {
            const payload = {
                title: newSubtaskTitle.trim(),
                assignee: newSubtaskAssignee || null,
                endDate: newSubtaskEndDate ? newSubtaskEndDate.toDate() : null,
                status: 'TODO'
            };
            const res = await addSubtask(task._id, payload);
            if (res.success) {
                message.success("Thêm công việc con thành công");
                setSelectedTask(res.data);
                setTasks(prev => prev.map(t => t._id === task._id ? res.data : t));
                setNewSubtaskTitle('');
                setNewSubtaskAssignee(null);
                setNewSubtaskEndDate(null);
                setShowAddSubtaskForm(false);
            }
        } catch (error) {
            message.error(error.response?.data?.message || "Lỗi thêm công việc con");
        } finally {
            setIsSubmittingSubtask(false);
        }
    };

    const handleDeleteSubtask = async (task, subtaskId) => {
        try {
            const res = await deleteSubtask(task._id, subtaskId);
            if (res.success) {
                message.success("Đã xóa công việc con");
                setSelectedTask(res.data);
                setTasks(prev => prev.map(t => t._id === task._id ? res.data : t));
            }
        } catch (error) {
            message.error(error.response?.data?.message || "Lỗi xóa việc con");
        }
    };

    const handleOpenEditSubtask = (task, subtask) => {
        setSubtaskToEdit({ task, subtask });
        editSubtaskForm.setFieldsValue({
            title: subtask.title,
            assignee: subtask.assignee?._id || subtask.assignee || null,
            endDate: subtask.endDate ? dayjs(subtask.endDate) : null,
            status: subtask.status || 'TODO'
        });
        setIsEditSubtaskModalVisible(true);
    };

    const handleSaveEditSubtask = async () => {
        try {
            const values = await editSubtaskForm.validateFields();
            setIsSubmittingSubtask(true);
            const res = await updateSubtask(subtaskToEdit.task._id, subtaskToEdit.subtask._id, {
                title: values.title.trim(),
                assignee: values.assignee || null,
                endDate: values.endDate ? values.endDate.toDate() : null,
                status: values.status
            });
            if (res.success) {
                message.success("Đã cập nhật công việc con!");
                setIsEditSubtaskModalVisible(false);
                setSelectedTask(res.data);
                setTasks(prev => prev.map(t => t._id === subtaskToEdit.task._id ? res.data : t));
            }
        } catch (error) {
            message.error(error.response?.data?.message || "Lỗi cập nhật việc con");
        } finally {
            setIsSubmittingSubtask(false);
        }
    };

    const handleViewDetails = (task) => {
        setSelectedTask(task);
        setShowAddSubtaskForm(false);
        setNewSubtaskTitle('');
        setNewSubtaskAssignee(null);
        setNewSubtaskEndDate(null);
        setIsDetailsVisible(true);
    };

    const handleViewHistory = (task) => {
        setSelectedTask(task);
        setHistoryPage(1);
        setIsHistoryVisible(true);
    };

    const getHistoryUserName = (h) => {
        if (!h) return 'Người thực hiện';
        // 1. Nếu h.user là object đã populate có name
        if (h.user && typeof h.user === 'object' && h.user.name) {
            return h.user.name;
        }
        // 2. Nếu h.user là ID (string hoặc ObjectId) hoặc object chỉ có _id
        const uid = typeof h.user === 'string' 
            ? h.user 
            : (h.user?._id ? h.user._id.toString() : (h.user?.toString && typeof h.user.toString === 'function' ? h.user.toString() : null));

        if (uid && Array.isArray(users) && users.length > 0) {
            const found = users.find(u => u._id?.toString() === uid);
            if (found && found.name) return found.name;
            if (found && found.email) return found.email;
        }

        if (h.user && typeof h.user === 'object' && h.user.email) {
            return h.user.email;
        }

        // 3. Fallback theo ngữ cảnh nếu dữ liệu cũ chưa lưu user
        if (h.action === 'Tạo mới' && selectedTask?.createdBy) {
            return selectedTask.createdBy.name || selectedTask.createdBy.email || 'Người tạo';
        }
        if (h.action?.includes('Đánh giá') && selectedTask?.evaluation?.evaluatedBy) {
            const eb = selectedTask.evaluation.evaluatedBy;
            if (typeof eb === 'object' && eb.name) return eb.name;
            const ebId = typeof eb === 'string' ? eb : eb?._id?.toString();
            const found = users.find(u => u._id?.toString() === ebId);
            if (found && found.name) return found.name;
            return 'Người đánh giá';
        }

        return 'Người thực hiện';
    };

    const calculateTaskWorkingDaysLate = (compDate, deadlineDate) => {
        if (!compDate || !deadlineDate) return 0;
        const comp = dayjs(compDate).startOf('day');
        const dead = dayjs(deadlineDate).endOf('day');
        if (dayjs(compDate).isBefore(dead) || dayjs(compDate).isSame(dead)) return 0;
        let cur = dayjs(deadlineDate).add(1, 'day').startOf('day');
        let workingDays = 0;
        while (cur.isBefore(comp) || cur.isSame(comp)) {
            const day = cur.day();
            if (day !== 0 && day !== 6) workingDays++;
            cur = cur.add(1, 'day');
        }
        return Math.max(1, workingDays);
    };

    const handleOpenEvaluate = (task) => {
        setEvaluatingTask(task);
        const existingEval = task.evaluation;
        
        let completedTime = task.completedAt;
        if (!completedTime && task.status === 'DONE') {
            if (Array.isArray(task.history)) {
                const doneEntry = [...task.history].reverse().find(h => 
                    h.details && h.details.includes('Hoàn thành')
                );
                if (doneEntry && doneEntry.timestamp) completedTime = doneEntry.timestamp;
            }
            if (!completedTime) completedTime = task.updatedAt;
        }

        const endOfDay = dayjs(task.endDate).endOf('day');
        const compDay = completedTime ? dayjs(completedTime) : endOfDay;
        let isEarlyOrOnTime = compDay.isBefore(endOfDay) || compDay.isSame(endOfDay);
        
        let autoProgress = 100;
        if (!isEarlyOrOnTime) {
            const lateDays = calculateTaskWorkingDaysLate(completedTime, task.endDate);
            if (lateDays > 5) autoProgress = 0;
            else if (lateDays >= 4) autoProgress = 60;
            else autoProgress = 80;
        }
        
        const qRate = existingEval?.qualityRate !== undefined ? existingEval.qualityRate : (existingEval?.score !== undefined ? existingEval.score : 100);
        let pRate = (existingEval?.evaluatedBy && existingEval?.progressRate !== undefined) ? existingEval.progressRate : autoProgress;
        const isExc = existingEval?.isExceeded !== undefined ? existingEval.isExceeded : (compDay.isBefore(endOfDay.subtract(6, 'hour')) && qRate === 100);
        const bonus = existingEval?.bonusScore || 0;

        setEvalQualityRate(qRate);
        setEvalProgressRate(pRate);
        setEvalIsExceeded(isExc);
        setEvalBonusScore(bonus);
        setEvalRating(existingEval?.rating || Math.min(5, Math.max(1, Math.round(qRate / 20))));
        setEvalScore(existingEval?.score !== undefined ? existingEval.score : Math.round((0.3 * pRate) + (0.7 * qRate)));
        setEvalFeedback(existingEval?.feedback || '');
        setIsEvalModalVisible(true);
    };

    const handleRatingChange = (val) => {
        setEvalRating(val);
        setEvalQualityRate(val * 20);
    };

    const handleScoreChange = (val) => {
        const s = val || 0;
        setEvalQualityRate(s);
        setEvalRating(Math.min(5, Math.max(1, Math.round(s / 20))));
    };

    const handleSubmitEvaluate = async () => {
        if (!evaluatingTask) return;
        setIsEvaluating(true);
        try {
            const calculatedScore = Math.round((0.3 * evalProgressRate) + (0.7 * evalQualityRate));
            const calculatedRating = Math.min(5, Math.max(1, Math.round(calculatedScore / 20)));

            const res = await evaluateTask(evaluatingTask._id, {
                qualityRate: evalQualityRate,
                progressRate: evalProgressRate,
                isExceeded: evalIsExceeded,
                bonusScore: evalBonusScore,
                score: calculatedScore,
                rating: calculatedRating,
                feedback: evalFeedback
            });
            if (res.success) {
                message.success("Đánh giá nghiệm thu KPI thành công!");
                setIsEvalModalVisible(false);
                setTasks(prev => prev.map(t => t._id === evaluatingTask._id ? res.data : t));
                if (selectedTask && selectedTask._id === evaluatingTask._id) {
                    setSelectedTask(res.data);
                }
            }
        } catch (err) {
            console.error("Error evaluating task:", err);
            message.error(err.response?.data?.message || "Lỗi khi lưu đánh giá KPI");
        } finally {
            setIsEvaluating(false);
        }
    };
    const [editingTask, setEditingTask] = useState(null);

    // Theo dõi giá trị ngày & giờ trong Form
    const watchedDates = Form.useWatch('dates', form);
    const watchedTimes = Form.useWatch('times', form);

    // Quyền thay đổi thời gian: Chỉ người tạo công việc (createdBy) và người chủ trì (assignees) mới được phép thay đổi
    const isCreator = editingTask && (
        (editingTask.createdBy?._id && String(editingTask.createdBy._id) === String(userId)) ||
        (editingTask.createdBy && String(editingTask.createdBy) === String(userId))
    );
    const isAssignee = editingTask && editingTask.assignees?.some(a => String(a._id || a) === String(userId));
    const isAdminOrManager = ['admin', 'manager', 'cappho'].includes(userRole);
    const canChangeTaskTime = !editingTask || isCreator || isAssignee || isAdminOrManager;
    const canEditAssignees = !editingTask || isCreator || isAssignee || isAdminOrManager;
    const canDeleteTask = editingTask && isCreator && editingTask.status !== 'DONE';

    // Danh sách người dùng được phép nhìn thấy để giao việc/phối hợp theo phân quyền hạn:
    // - Manager & BGH: thấy hết toàn bộ người dùng
    // - Cấp trưởng & Cấp phó: thấy cấp trưởng/phó đơn vị khác + toàn bộ thành viên đơn vị mình
    // - GV-CV: chỉ thấy thành viên đơn vị mình
    const assignableUsers = useMemo(() => {
        return getAssignableUsers(users, currentUserObj, userRole);
    }, [users, currentUserObj, userRole]);

    // Phân loại và sắp xếp người dùng theo thứ tự: BGH, Cấp trưởng, Cấp phó, Chuyên viên, Manager
    const userGroups = useMemo(() => {
        return categorizeUsers(assignableUsers).filter(g => g.users && g.users.length > 0);
    }, [assignableUsers]);

    const filterUserOption = (input, option) => {
        if (!input) return true;
        const search = removeVietnameseTones(input.toLowerCase().trim());
        const label = removeVietnameseTones(String(option?.label || option?.children || "").toLowerCase());
        const name = removeVietnameseTones(String(option?.name || "").toLowerCase());
        return label.includes(search) || name.includes(search);
    };

    // Kiểm tra xem thời gian có bị thay đổi so với ban đầu hay không
    const isTimeChanged = useMemo(() => {
        if (!editingTask || !watchedDates || watchedDates.length < 2) return false;
        const origStart = dayjs(editingTask.startDate);
        const origEnd = dayjs(editingTask.endDate);

        if (!origStart.isSame(watchedDates[0], 'day') || !origEnd.isSame(watchedDates[1], 'day')) {
            return true;
        }
        if (watchedTimes && watchedTimes.length === 2 && watchedTimes[0] && watchedTimes[1]) {
            if (origStart.hour() !== watchedTimes[0].hour() || origStart.minute() !== watchedTimes[0].minute() ||
                origEnd.hour() !== watchedTimes[1].hour() || origEnd.minute() !== watchedTimes[1].minute()) {
                return true;
            }
        }
        return false;
    }, [editingTask, watchedDates, watchedTimes]);

    const [viewMode, setViewMode] = useState('Hệ thống'); // 'Hệ thống' hoặc 'Google'
    const [fileList, setFileList] = useState([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterAssignee, setFilterAssignee] = useState(null);
    const [filterFocusAxis, setFilterFocusAxis] = useState(null);
    const [filterDateRange, setFilterDateRange] = useState(null);
    const [kanbanPage, setKanbanPage] = useState({ TODO: 1, IN_PROGRESS: 1, DONE: 1 });
    const KANBAN_PAGE_SIZE = 10;

    useEffect(() => {
        loadUsers();
    }, []);

    useEffect(() => {
        if (userId) {
            loadTasks();
            loadUsers();
        }
    }, [userId]);

    useEffect(() => {
        if (tab === 'create') {
            handleSelectSlot({ start: new Date(), end: new Date() });
            setFilterStatus('ALL');
        } else if (tab === 'todo') {
            setFilterStatus('TODO');
        } else if (tab === 'inprogress') {
            setFilterStatus('IN_PROGRESS');
        } else if (tab === 'done') {
            setFilterStatus('DONE');
        } else {
            setFilterStatus('ALL');
        }
    }, [tab]);

    const loadTasks = async () => {
        try {
            const res = await getTasks(userId);
            if (res.success) {
                setTasks(res.data);
                const targetTaskId = searchParams.get('taskId');
                if (targetTaskId) {
                    const target = res.data.find(t => t._id === targetTaskId);
                    if (target) {
                        handleViewDetails(target);
                    }
                }
            }
        } catch (error) {
            message.error("Lỗi khi tải danh sách công việc");
        }
    };

    const loadUsers = async () => {
        try {
            const res = await getAllUsers();
            const userList = (res && Array.isArray(res.users))
                ? res.users
                : (res && Array.isArray(res.data))
                ? res.data
                : (Array.isArray(res) ? res : []);

            if (userList.length > 0) {
                const validUsers = userList.filter(u => u && u.role !== null && (u.email || '').trim().toLowerCase() !== 'qlvb@nsgpc.edu.vn');
                setUsers(validUsers);
                if (userId) {
                    const current = validUsers.find(u => String(u._id) === String(userId));
                    if (current) {
                        setCurrentUser(current);
                    }
                }
            }
        } catch (error) {
            console.error("Lỗi tải danh sách người dùng", error);
        }
    };

    const handleSelectSlot = ({ start, end }) => {
        form.resetFields();
        const defaultAssigneeId = currentUser?._id || userId;
        const now = dayjs();
        const defaultEndTime = dayjs().hour(23).minute(59).second(0);
        form.setFieldsValue({
            dates: [dayjs(start), dayjs(end)],
            times: [now, defaultEndTime],
            assignees: defaultAssigneeId ? [defaultAssigneeId] : [],
            collaborators: [],
            status: 'TODO',
            priority: 'NORMAL',
            taskType: 'REGULAR',
            baseScore: 10,
            outputResult: '',
            focusAxis: '',
            difficultyRate: 1.0,
            timeChangeReason: ''
        });
        setFileList([]);
        setFormSubtasks([]);
        setTempSubtaskTitle('');
        setTempSubtaskAssignee(null);
        setTempSubtaskEndDate(null);
        setEditingTask(null);

        // Hỗ trợ tự động điền dữ liệu khi người dùng bấm "Tạo công việc từ tóm tắt AI"
        const rawAiData = sessionStorage.getItem('prefillTaskFromAi');
        if (rawAiData) {
            try {
                const aiData = JSON.parse(rawAiData);
                form.setFieldsValue({
                    title: aiData.title || '',
                    description: aiData.description || '',
                    notes: aiData.notes || '',
                    ...(aiData.deadlineDay ? { dates: [dayjs(), dayjs(aiData.deadlineDay)] } : {})
                });
            } catch (e) {
                console.error('Lỗi parse prefillTaskFromAi:', e);
            } finally {
                sessionStorage.removeItem('prefillTaskFromAi');
            }
        }

        setIsModalVisible(true);
    };

    const handleSelectEvent = (event) => {
        const task = event.resource;
        setEditingTask(task);
        form.setFieldsValue({
            title: task.title,
            description: task.description,
            notes: task.notes,
            dates: [dayjs(task.startDate), dayjs(task.endDate)],
            times: [dayjs(task.startDate), dayjs(task.endDate)],
            assignees: (task.assignees || []).map(a => a._id || a),
            collaborators: (task.collaborators || []).map(a => a._id || a),
            status: task.status,
            priority: task.priority || 'NORMAL',
            taskType: task.taskType || 'REGULAR',
            baseScore: task.baseScore !== undefined ? task.baseScore : (task.taskType === 'URGENT' ? 12 : 10),
            outputResult: task.outputResult || '',
            focusAxis: task.focusAxis || '',
            difficultyRate: task.difficultyRate || 1.0,
            timeChangeReason: ''
        });
        setFileList([]);
        setFormSubtasks(task.subtasks ? JSON.parse(JSON.stringify(task.subtasks)) : []);
        setTempSubtaskTitle('');
        setTempSubtaskAssignee(null);
        setTempSubtaskEndDate(null);
        setIsModalVisible(true);
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();

            // Kiểm tra ràng buộc khi hoàn thành công việc
            if (values.status === 'DONE') {
                if (formSubtasks.length > 0) {
                    const hasUnfinished = formSubtasks.some(s => s.status !== 'DONE');
                    if (hasUnfinished) {
                        message.error("Không thể hoàn thành công việc lớn khi còn công việc con chưa hoàn thành. Vui lòng hoàn thành tất cả công việc con trước!");
                        return;
                    }
                }
                if (!values.taskType) {
                    message.error("Vui lòng chọn Loại công việc (Phụ lục 3 & 4) khi hoàn thành công việc!");
                    return;
                }
                if (!values.difficultyRate) {
                    message.error("Vui lòng chọn Hệ số độ khó (Phụ lục 3) khi hoàn thành công việc!");
                    return;
                }
                if (!values.outputResult || (typeof values.outputResult === 'string' && !values.outputResult.trim())) {
                    message.error("Vui lòng chọn hoặc nhập Kết quả đầu ra / Sản phẩm (Phụ lục 3) khi hoàn thành công việc!");
                    return;
                }
                if (!values.focusAxis || (typeof values.focusAxis === 'string' && !values.focusAxis.trim())) {
                    message.error("Vui lòng chọn Trục kết quả trọng tâm khi hoàn thành công việc!");
                    return;
                }
            }

            setIsSaving(true);
            const formData = new FormData();
            formData.append("title", values.title);
            if (values.description) formData.append("description", values.description);
            if (values.notes) formData.append("notes", values.notes);
            const cleanedSubtasks = formSubtasks.map(s => ({
                ...s,
                assignee: s.assignee ? (s.assignee._id || s.assignee) : null
            }));
            formData.append("subtasks", JSON.stringify(cleanedSubtasks));
            
            let startDateObj = values.dates[0].clone();
            let endDateObj = values.dates[1].clone();
            
            if (values.times && values.times.length === 2 && values.times[0] && values.times[1]) {
                startDateObj = startDateObj.hour(values.times[0].hour()).minute(values.times[0].minute()).second(0);
                endDateObj = endDateObj.hour(values.times[1].hour()).minute(values.times[1].minute()).second(0);
            } else {
                const now = dayjs();
                startDateObj = startDateObj.hour(now.hour()).minute(now.minute()).second(0);
                endDateObj = endDateObj.hour(23).minute(59).second(0);
            }

            formData.append("startDate", startDateObj.toDate());
            formData.append("endDate", endDateObj.toDate());
            if (!values.assignees || values.assignees.length === 0) {
                message.error("Vui lòng chọn ít nhất một người thực hiện!");
                setIsSaving(false);
                return;
            }
            formData.append("assignees", JSON.stringify(values.assignees));
            formData.append("collaborators", JSON.stringify(values.collaborators || []));
            formData.append("status", values.status || 'TODO');
            formData.append("priority", values.priority || 'NORMAL');
            formData.append("taskType", values.taskType || 'REGULAR');
            formData.append("baseScore", values.taskType === 'URGENT' ? (values.baseScore || 12) : (values.baseScore || 10));
            if (values.outputResult) formData.append("outputResult", values.outputResult.trim());
            if (values.focusAxis) formData.append("focusAxis", values.focusAxis.trim());
            formData.append("difficultyRate", values.difficultyRate || 1.0);
            if (values.timeChangeReason) {
                formData.append("timeChangeReason", values.timeChangeReason.trim());
            }
            if (!editingTask) formData.append("createdBy", userId);

            const filesToUploadDirectly = [];

            fileList.forEach(file => {
                if (file.originFileObj) {
                    filesToUploadDirectly.push(file.originFileObj);
                }
            });

            const newlyUploadedFiles = [];
            if (filesToUploadDirectly.length > 0) {
                message.loading({ content: 'Đang tải tệp lên Google Drive...', key: 'uploading' });
                try {
                    const driveAuth = await getDriveToken();
                    const accessToken = driveAuth.accessToken;
                    const folderId = driveAuth.folderId;

                    for (const fileObj of filesToUploadDirectly) {
                        const uploadedFile = await uploadFileDirectlyToDrive(fileObj, accessToken, folderId);
                        newlyUploadedFiles.push(uploadedFile);
                    }
                    message.success({ content: 'Tải tệp lên Google Drive thành công!', key: 'uploading', duration: 2 });
                } catch (error) {
                    message.error({ content: `Lỗi tải tệp: ${error.message}`, key: 'uploading', duration: 4 });
                    setIsSaving(false);
                    return; // Stop the process
                }
            }

            // Thêm các tệp chọn từ Kho lưu trữ chữ ký (đã có sẵn trên Drive)
            fileList.forEach(file => {
                if (!file.originFileObj && (file.fileId || file.url)) {
                    newlyUploadedFiles.push({
                        fileId: file.fileId,
                        fileName: file.fileName || file.name,
                        fileMimeType: file.mimeType || file.fileMimeType || "application/pdf"
                    });
                }
            });

            if (newlyUploadedFiles.length > 0) {
                formData.append("uploadedFiles", JSON.stringify(newlyUploadedFiles));
            }

            if (editingTask && editingTask.files) {
                // Giữ lại các file cũ (sau khi có thể đã xóa một số file)
                formData.append("existingFiles", JSON.stringify(editingTask.files));
            }

            if (editingTask) {
                const res = await updateTask(editingTask._id, formData);
                message.success("Cập nhật công việc thành công!");
                if (res?.data && selectedTask && selectedTask._id === editingTask._id) {
                    setSelectedTask(res.data);
                }
            } else {
                await createTask(formData);
                message.success("Thêm công việc thành công!");
            }
            setIsModalVisible(false);
            setFileList([]);
            loadTasks();
        } catch (error) {
            console.error(error);
            if (error.name !== 'ValidationError' && error.errorFields === undefined) {
                // If it's an API error, not a form validation error
                if (error.response?.status === 413) {
                    message.error("Lỗi: Tệp đính kèm quá lớn (vượt giới hạn 4.5MB của máy chủ).");
                } else {
                    message.error("Có lỗi xảy ra: " + (error.response?.data?.message || error.message));
                }
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (!editingTask) return;
        if (editingTask.status === 'DONE') {
            message.warning("Công việc đã hoàn thành, không thể xóa.");
            return;
        }
        if (!isCreator) {
            message.error("Chỉ người tạo công việc mới có quyền xóa công việc này.");
            return;
        }

        Modal.confirm({
            title: 'Xác nhận xóa công việc',
            content: 'Bạn có chắc chắn muốn xóa công việc này không? Hành động này không thể hoàn tác.',
            okText: 'Xóa',
            okType: 'danger',
            cancelText: 'Hủy',
            onOk: async () => {
                try {
                    await deleteTask(editingTask._id);
                    message.success("Đã xóa công việc thành công!");
                    setIsModalVisible(false);
                    loadTasks();
                } catch (error) {
                    message.error(error.response?.data?.message || "Lỗi khi xóa công việc");
                }
            }
        });
    };

    // Lọc công việc theo tiêu chí tìm kiếm và bộ lọc
    const normalizeString = (str) => {
        return str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
    };

    // Lấy mốc thời gian cập nhật trạng thái mới nhất của công việc
    const getTaskStatusUpdateTime = (task) => {
        if (!task) return 0;

        // 1. Nếu công việc đã Hoàn thành: ưu tiên mốc thời gian hoàn thành (completedAt)
        if (task.status === 'DONE') {
            if (task.completedAt) return new Date(task.completedAt).getTime();
            // Tra cứu trong history xem có log chuyển sang Hoàn thành hoặc Đánh giá KPI
            if (task.history && Array.isArray(task.history)) {
                for (let i = task.history.length - 1; i >= 0; i--) {
                    const h = task.history[i];
                    const details = (h.details || '').toLowerCase();
                    const action = (h.action || '').toLowerCase();
                    if (details.includes('hoàn thành') || action.includes('hoàn thành') || action.includes('đánh giá kpi')) {
                        if (h.timestamp) return new Date(h.timestamp).getTime();
                    }
                }
            }
        }

        // 2. Tra cứu trong history xem có log chuyển trạng thái gần nhất
        if (task.history && Array.isArray(task.history) && task.history.length > 0) {
            for (let i = task.history.length - 1; i >= 0; i--) {
                const h = task.history[i];
                const details = (h.details || '').toLowerCase();
                const action = (h.action || '').toLowerCase();
                if (
                    details.includes('trạng thái') ||
                    details.includes('chuyển trạng thái') ||
                    action.includes('trạng thái')
                ) {
                    if (h.timestamp) return new Date(h.timestamp).getTime();
                }
            }
            // Nếu không có log trạng thái riêng, lấy mốc lịch sử gần nhất
            const lastH = task.history[task.history.length - 1];
            if (lastH && lastH.timestamp) return new Date(lastH.timestamp).getTime();
        }

        // 3. Fallback: updatedAt -> createdAt -> startDate
        if (task.updatedAt) return new Date(task.updatedAt).getTime();
        if (task.createdAt) return new Date(task.createdAt).getTime();
        if (task.startDate) return new Date(task.startDate).getTime();
        return 0;
    };

    const getFilteredTasks = () => {
        let result = tasks.filter(task => {
            let match = true;
            if (searchTerm) {
                const term = normalizeString(searchTerm);
                const title = normalizeString(task.title);
                const desc = normalizeString(task.description);
                match = match && (title.includes(term) || desc.includes(term));
            }
            if (filterStatus && filterStatus !== 'ALL') {
                match = match && (task.status === filterStatus);
            }
            if (filterAssignee) {
                match = match && (
                    task.assignees?.some(a => (a._id || a) === filterAssignee) ||
                    task.collaborators?.some(c => (c._id || c) === filterAssignee) ||
                    task.subtasks?.some(s => (s.assignee?._id || s.assignee) === filterAssignee) ||
                    ((!task.assignees || task.assignees.length === 0) && (task.createdBy?._id || task.createdBy) === filterAssignee)
                );
            }
            if (filterFocusAxis) {
                match = match && (task.focusAxis === filterFocusAxis || (task.focusAxis && task.focusAxis.includes(filterFocusAxis)));
            }
            if (filterDateRange && filterDateRange.length === 2 && filterDateRange[0] && filterDateRange[1]) {
                const rangeStart = filterDateRange[0].startOf('day').toDate();
                const rangeEnd = filterDateRange[1].endOf('day').toDate();

                const taskStart = task.startDate ? new Date(task.startDate) : null;
                const taskEnd = task.endDate ? new Date(task.endDate) : taskStart;
                const taskCompleted = task.completedAt ? new Date(task.completedAt) : null;

                const isInRange = (taskStart && taskEnd && taskStart <= rangeEnd && taskEnd >= rangeStart) ||
                                  (taskStart && taskStart >= rangeStart && taskStart <= rangeEnd) ||
                                  (taskEnd && taskEnd >= rangeStart && taskEnd <= rangeEnd) ||
                                  (taskCompleted && taskCompleted >= rangeStart && taskCompleted <= rangeEnd);

                match = match && isInRange;
            }
            return match;
        });

        // Sắp xếp: Công việc đến hạn, sắp đến hạn và có hạn xử lý gần nhất sẽ nằm lên đầu
        result = [...result].sort((a, b) => {
            const isDoneA = a.status === 'DONE';
            const isDoneB = b.status === 'DONE';

            // 1. Công việc chưa hoàn thành luôn xếp TRƯỚC công việc đã hoàn thành
            if (!isDoneA && isDoneB) return -1;
            if (isDoneA && !isDoneB) return 1;

            // 2. Nếu CẢ HAI đều đã hoàn thành (DONE): Sắp xếp theo thời gian hoàn thành / cập nhật mới nhất giảm dần
            if (isDoneA && isDoneB) {
                const compA = a.completedAt ? new Date(a.completedAt).getTime() : getTaskStatusUpdateTime(a);
                const compB = b.completedAt ? new Date(b.completedAt).getTime() : getTaskStatusUpdateTime(b);
                return compB - compA;
            }

            // 3. Nếu CẢ HAI đều CHƯA hoàn thành (TODO hoặc IN_PROGRESS):
            // Ưu tiên công việc có hạn xử lý (endDate) xếp trước công việc không có hạn
            const endA = a.endDate ? new Date(a.endDate).getTime() : null;
            const endB = b.endDate ? new Date(b.endDate).getTime() : null;

            if (endA !== null && endB === null) return -1;
            if (endA === null && endB !== null) return 1;

            // Công việc có hạn xử lý gần nhất (tăng dần: quá hạn/đến hạn hôm nay có endDate nhỏ nhất sẽ nằm lên đầu)
            if (endA !== null && endB !== null && endA !== endB) {
                return endA - endB;
            }

            // 4. Nếu cùng hạn: Ưu tiên mức độ khẩn (FLASH -> URGENT -> NORMAL)
            const priorityWeight = { FLASH: 3, URGENT: 2, NORMAL: 1 };
            const prioA = priorityWeight[a.priority] || 1;
            const prioB = priorityWeight[b.priority] || 1;
            if (prioB !== prioA) {
                return prioB - prioA;
            }

            // 5. Fallback: Thời gian cập nhật gần nhất
            const timeA = getTaskStatusUpdateTime(a);
            const timeB = getTaskStatusUpdateTime(b);
            if (timeB !== timeA) return timeB - timeA;

            const startA = a.startDate ? new Date(a.startDate).getTime() : 0;
            const startB = b.startDate ? new Date(b.startDate).getTime() : 0;
            return startB - startA;
        });

        return result;
    };

    const filteredTasks = getFilteredTasks();

    // Chuyển đổi dữ liệu tasks cho BigCalendar
    const events = filteredTasks.map(t => ({
        id: t._id,
        title: t.title,
        start: new Date(t.startDate),
        end: new Date(t.endDate),
        resource: t
    }));

    // Hàm tạo mã màu dựa theo trạng thái
    const eventStyleGetter = (event) => {
        let backgroundColor = '#3174ad';
        if (event.resource.status === 'DONE') backgroundColor = '#52c41a';
        else if (event.resource.status === 'IN_PROGRESS') backgroundColor = '#1890ff';
        else if (event.resource.status === 'TODO') backgroundColor = '#faad14';

        return {
            style: {
                backgroundColor,
                borderRadius: '5px',
                opacity: 0.8,
                color: 'white',
                border: '0px',
                display: 'block'
            }
        };
    };

    const renderGoogleCalendar = () => {
        if (!currentUser || !currentUser.email) {
            return (
                <div className="flex flex-col items-center justify-center h-[600px] bg-gray-50 border rounded text-gray-500">
                    <p>Không tìm thấy email của bạn để hiển thị lịch.</p>
                </div>
            );
        }

        const encodedEmail = encodeURIComponent(currentUser.email);
        const iframeSrc = `https://calendar.google.com/calendar/embed?src=${encodedEmail}&ctz=Asia%2FHo_Chi_Minh`;

        return (
            <div className="w-full h-[700px]">
                <div className="mb-2 text-right">
                    <a href="https://calendar.google.com/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                        Mở trực tiếp trên Google Calendar
                    </a>
                </div>
                <iframe 
                    src={iframeSrc} 
                    style={{ border: 0 }} 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    scrolling="no"
                    title="Google Calendar"
                ></iframe>
            </div>
        );
    };

    // --- DASHBOARD LOGIC ---
    const todoCount = tasks.filter(t => t.status === 'TODO').length;
    const inProgressCount = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const doneCount = tasks.filter(t => t.status === 'DONE').length;

    const pieData = [
        { name: 'Chưa làm', value: todoCount, color: '#ff4d4f' },
        { name: 'Đang làm', value: inProgressCount, color: '#1890ff' },
        { name: 'Hoàn thành', value: doneCount, color: '#52c41a' },
    ];

    const isListView = ['todo', 'inprogress', 'done'].includes(tab);

    const exportToExcel = () => {
        const filteredTasks = getFilteredTasks();
        const dataToExport = filteredTasks.map((t, index) => {
            const priorityStr = t.priority === 'FLASH' ? 'Hỏa tốc' : t.priority === 'URGENT' ? 'Khẩn' : 'Bình thường';
            const statusStr = t.status === 'TODO' ? 'Chưa làm' : t.status === 'IN_PROGRESS' ? 'Đang làm' : 'Hoàn thành';
            return {
                "STT": index + 1,
                "Tiêu đề": t.title,
                "Trục kết quả trọng tâm": t.focusAxis || '',
                "Kết quả đầu ra": t.outputResult || '',
                "Mức độ": priorityStr,
                "Người thực hiện": t.assignees?.map(a => a.name).join(', ') || '',
                "Người phối hợp": t.collaborators?.map(a => a.name).join(', ') || '',
                "Bắt đầu": t.startDate ? dayjs(t.startDate).format('DD/MM/YYYY HH:mm') : '',
                "Kết thúc": t.endDate ? dayjs(t.endDate).format('DD/MM/YYYY HH:mm') : '',
                "Trạng thái": statusStr
            };
        });

        const historyData = [];
        let historyIndex = 1;
        filteredTasks.forEach(t => {
            if (t.history && t.history.length > 0) {
                // Sắp xếp lịch sử từ cũ đến mới hoặc mới đến cũ tuỳ ý, ở đây dùng thứ tự gốc (cũ -> mới)
                t.history.forEach(h => {
                    historyData.push({
                        "STT": historyIndex++,
                        "Tiêu đề công việc": t.title,
                        "Thời gian thay đổi": h.timestamp ? dayjs(h.timestamp).format('DD/MM/YYYY HH:mm:ss') : '',
                        "Hành động": h.action,
                        "Người thay đổi": h.user?.name || 'Người dùng ẩn',
                        "Chi tiết": h.details || ''
                    });
                });
            }
        });

        const wb = XLSX.utils.book_new();
        
        // Sheet 1: Danh sách công việc
        const wsTasks = XLSX.utils.json_to_sheet(dataToExport);
        // Tự động căn chỉnh độ rộng cột cơ bản
        const wscolsTasks = [
            {wch: 5}, {wch: 40}, {wch: 15}, {wch: 25}, {wch: 25}, {wch: 20}, {wch: 20}, {wch: 15}
        ];
        wsTasks['!cols'] = wscolsTasks;
        XLSX.utils.book_append_sheet(wb, wsTasks, "Danh_sach_cong_viec");

        // Sheet 2: Lịch sử thay đổi trạng thái
        if (historyData.length > 0) {
            const wsHistory = XLSX.utils.json_to_sheet(historyData);
            const wscolsHistory = [
                {wch: 5}, {wch: 40}, {wch: 20}, {wch: 25}, {wch: 25}, {wch: 40}
            ];
            wsHistory['!cols'] = wscolsHistory;
            XLSX.utils.book_append_sheet(wb, wsHistory, "Lich_su_thay_doi");
        } else {
            const wsHistory = XLSX.utils.json_to_sheet([{"Thông báo": "Không có lịch sử nào cho các công việc này"}]);
            wsHistory['!cols'] = [{wch: 50}];
            XLSX.utils.book_append_sheet(wb, wsHistory, "Lich_su_thay_doi");
        }

        XLSX.writeFile(wb, "Danh_sach_cong_viec.xlsx");
    };

    // Chuyển tiếp công việc hoàn thành sang trang Trình ký (/replyDoc)
    const handleSendReplyDoc = (task) => {
        if (!task) return;

        // Trích xuất ID văn bản liên quan (nếu có)
        const documentId = task.relatedDocument?._id || task.relatedDocument;

        // Gom toàn bộ tệp đính kèm của công việc
        const allFiles = [];
        const seenFileIds = new Set();

        if (task.files && Array.isArray(task.files)) {
            task.files.forEach(f => {
                if (f && f.fileId && !seenFileIds.has(f.fileId)) {
                    seenFileIds.add(f.fileId);
                    allFiles.push({
                        fileId: f.fileId,
                        fileName: f.fileName || 'Tài liệu đính kèm',
                        name: f.fileName || 'Tài liệu đính kèm',
                        fileMimeType: f.fileMimeType || f.mimeType,
                        fileUrl: f.fileUrl || `https://drive.google.com/file/d/${f.fileId}/view`,
                    });
                }
            });
        }

        // Nếu văn bản liên quan cũng có tệp đính kèm thì gộp thêm
        if (task.relatedDocument && Array.isArray(task.relatedDocument.files)) {
            task.relatedDocument.files.forEach(f => {
                if (f && f.fileId && !seenFileIds.has(f.fileId)) {
                    seenFileIds.add(f.fileId);
                    allFiles.push({
                        fileId: f.fileId,
                        fileName: f.fileName || 'Tài liệu văn bản',
                        name: f.fileName || 'Tài liệu văn bản',
                        fileMimeType: f.fileMimeType || f.mimeType,
                        fileUrl: f.fileUrl || `https://drive.google.com/file/d/${f.fileId}/view`,
                    });
                }
            });
        }

        navigate('/replyDoc', {
            state: {
                documentId: documentId || undefined,
                title: task.title,
                shortDescription: task.title, // Tiêu đề công việc -> Trích yếu văn bản trình ký
                files: allFiles,             // Tệp đính kèm -> Danh sách tệp đính kèm
                fromTaskId: task._id,
            },
        });
    };

    const tableColumns = [
        { title: 'STT', key: 'stt', render: (text, record, index) => index + 1, width: 60 },
        { 
            title: 'Tiêu đề', 
            dataIndex: 'title', 
            key: 'title', 
            render: (text, record) => {
                let urgencyTag = null;
                if (record.status !== 'DONE' && record.endDate) {
                    const now = dayjs().startOf('day');
                    const end = dayjs(record.endDate).startOf('day');
                    if (end.isBefore(now)) {
                        urgencyTag = <Tag color="red" className="mb-1 font-semibold">Quá hạn</Tag>;
                    } else if (end.isSame(now)) {
                        urgencyTag = <Tag color="orange" className="mb-1 font-semibold">Đến hạn</Tag>;
                    } else if (end.diff(now, 'day') <= 3) {
                        urgencyTag = <Tag color="gold" className="mb-1 font-semibold">Sắp đến hạn</Tag>;
                    }
                }
                return (
                    <div className="whitespace-normal break-words min-w-[150px] max-w-[300px]">
                        {urgencyTag && <div>{urgencyTag}</div>}
                        <b>{text}</b>
                        {record.subtasks && record.subtasks.length > 0 && (() => {
                            const stats = getSubtaskStats(record);
                            if (!stats) return null;
                            const isAllDone = stats.done === stats.total;
                            const mySubtasks = record.subtasks.filter(s => (s.assignee?._id || s.assignee) === userId);
                            const displaySubtasks = mySubtasks.length > 0 
                                ? mySubtasks 
                                : (record.subtasks.length <= 2 ? record.subtasks : record.subtasks.slice(0, 2));

                            return (
                                <div className="mt-1.5 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Progress 
                                            percent={stats.percent} 
                                            size="small" 
                                            showInfo={false} 
                                            className="!m-0 w-16" 
                                            status={isAllDone ? 'success' : 'active'}
                                            strokeColor={isAllDone ? '#52c41a' : '#1890ff'} 
                                        />
                                        <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                            {stats.done}/{stats.total} việc con ({stats.percent}%)
                                        </span>
                                    </div>
                                    {displaySubtasks.length > 0 && (
                                        <div className="text-[11px] text-blue-700 bg-blue-50/90 px-1.5 py-0.5 rounded border border-blue-100">
                                            {displaySubtasks.map((ms, mIdx) => (
                                                <div key={ms._id || mIdx} className="flex items-center justify-between gap-1">
                                                    <span className="truncate max-w-[190px]" title={ms.title}>
                                                        📌 {ms.title} {mySubtasks.length === 0 && ms.assignee?.name ? `(${ms.assignee.name.split(' ').pop()})` : ''}
                                                    </span>
                                                    <span className={
                                                        ms.status === 'DONE' 
                                                            ? 'text-emerald-600 font-semibold text-[10px]' 
                                                            : ms.status === 'IN_PROGRESS' 
                                                            ? 'text-blue-600 font-semibold text-[10px]' 
                                                            : 'text-amber-600 font-medium text-[10px]'
                                                    }>
                                                        {ms.status === 'DONE' ? '✓ Xong' : ms.status === 'IN_PROGRESS' ? 'Đang làm' : 'Chưa làm'}
                                                    </span>
                                                </div>
                                            ))}
                                            {mySubtasks.length === 0 && record.subtasks.length > 2 && (
                                                <div className="text-[10px] text-slate-400 italic text-right">
                                                    + còn {record.subtasks.length - 2} việc con khác
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                );
            } 
        },
        { 
            title: 'Người thực hiện', 
            key: 'assignees', 
            align: 'center',
            render: (_, record) => {
                const assigneesList = (record.assignees && record.assignees.length > 0)
                    ? record.assignees
                    : (record.createdBy ? [record.createdBy] : []);
                return (
                    <div className="flex flex-wrap gap-1 justify-center">
                        {assigneesList.map(a => <Tag color="blue" key={a._id || a}>{a.name || 'Người tạo'}</Tag>)}
                    </div>
                );
            }
        },
        { 
            title: 'Người phối hợp', 
            key: 'collaborators', 
            align: 'center',
            render: (_, record) => {
                const collabList = [...(record.collaborators || [])];
                if (record.subtasks && Array.isArray(record.subtasks)) {
                    record.subtasks.forEach(s => {
                        if (s.assignee) {
                            const sId = (s.assignee._id || s.assignee).toString();
                            const exists = collabList.some(c => (c._id || c).toString() === sId);
                            const isMain = record.assignees?.some(a => (a._id || a).toString() === sId);
                            if (!exists && !isMain) {
                                const userObj = typeof s.assignee === 'object' && s.assignee.name ? s.assignee : users.find(u => u._id?.toString() === sId);
                                if (userObj) collabList.push(userObj);
                            }
                        }
                    });
                }
                return (
                    <div className="flex flex-wrap gap-1 justify-center">
                        {collabList.length ? collabList.map((a, cIdx) => (
                            <Tag color="cyan" key={a._id || a || cIdx}>{a.name || 'Thành viên'}</Tag>
                        )) : <span className="text-gray-400">Không có</span>}
                    </div>
                );
            }
        },
        { 
            title: 'Tệp đính kèm', 
            key: 'files', 
            render: (_, record) => record.files?.length ? (
                <div className="flex flex-col gap-1">
                    {record.files.map((file, idx) => (
                        <a key={idx} href={`https://drive.google.com/file/d/${file.fileId}/view`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                            <FileTextOutlined /> <span className="truncate w-32 inline-block" title={file.fileName}>{file.fileName}</span>
                        </a>
                    ))}
                </div>
            ) : <span className="text-gray-400 text-xs">Không có</span>
        },
        { 
            title: 'Thời gian', 
            key: 'time', 
            render: (_, record) => (
                <div className="text-sm">
                    <p className="m-0 text-gray-500">Từ: {dayjs(record.startDate).format('DD/MM/YYYY HH:mm')}</p>
                    <p className="m-0 text-gray-500">Đến: {dayjs(record.endDate).format('DD/MM/YYYY HH:mm')}</p>
                </div>
            ) 
        },
        { 
            title: 'Mức độ', 
            dataIndex: 'priority', 
            key: 'priority', 
            render: priority => {
                const color = priority === 'FLASH' ? 'red' : priority === 'URGENT' ? 'orange' : 'blue';
                const label = priority === 'FLASH' ? 'Hỏa tốc' : priority === 'URGENT' ? 'Khẩn' : 'Bình thường';
                return <Tag color={color}>{label}</Tag>;
            }
        },
        {
            title: 'Ghi chú',
            dataIndex: 'notes',
            key: 'notes',
            render: text => <div className="whitespace-pre-wrap break-words min-w-[100px] max-w-[200px] text-sm text-gray-600">{text || ''}</div>
        },
        {
            title: 'Kết quả đầu ra',
            dataIndex: 'outputResult',
            key: 'outputResult',
            render: text => text ? <Tag color="geekblue" className="text-xs">{text}</Tag> : <span className="text-gray-400 text-xs">-</span>
        },
        {
            title: 'Trục kết quả trọng tâm',
            dataIndex: 'focusAxis',
            key: 'focusAxis',
            render: val => renderFocusAxisTag(val)
        },
        { 
            title: 'Trạng thái', 
            dataIndex: 'status', 
            key: 'status', 
            render: (status, record) => {
                const color = status === 'TODO' ? 'red' : status === 'IN_PROGRESS' ? 'blue' : 'green';
                const label = status === 'TODO' ? 'Chưa làm' : status === 'IN_PROGRESS' ? 'Đang làm' : 'Hoàn thành';
                
                if (status === 'DONE') {
                    const completed = record.completedAt || record.updatedAt;
                    const endOfDay = record.endDate ? new Date(record.endDate) : null;
                    if (endOfDay) endOfDay.setHours(23, 59, 59, 999);

                    const isLate = completed && endOfDay && (new Date(completed).getTime() > endOfDay.getTime());
                    const daysLate = isLate ? Math.max(1, Math.ceil((new Date(completed).getTime() - endOfDay.getTime()) / (1000 * 60 * 60 * 24))) : 0;
                    return (
                        <div className="flex flex-col gap-1 items-start">
                            <Tag color={color}>{label}</Tag>
                            {completed && (
                                <span className="text-[11px] text-gray-500 whitespace-nowrap font-medium">
                                    {dayjs(completed).format('HH:mm DD/MM/YYYY')}
                                </span>
                            )}
                            {isLate ? (
                                <Tag color="orange" className="text-[10px]">Trễ {daysLate} ngày</Tag>
                            ) : (
                                <Tag color="green" className="text-[10px]">Đúng hạn</Tag>
                            )}
                            {record.evaluation?.score !== undefined && (
                                <Tag color="gold" className="text-[10px] flex items-center gap-1 font-semibold">
                                    ★ {record.evaluation.score}đ
                                </Tag>
                            )}
                        </div>
                    );
                }
                return <Tag color={color}>{label}</Tag>;
            }
        },
        {
              title: 'Thao tác',
              key: 'action',
              className: "action-col", fixed: "right", align: "center",
              render: (_, record) => {
                  const canEvaluate = record.status === 'DONE' && userRole !== 'chuyenvien' && (
                      ['admin', 'manager', 'cappho'].includes(userRole) ||
                      (record.createdBy && (record.createdBy._id === userId || record.createdBy === userId))
                  );

                  return (
                      <div className="grid grid-cols-2 sm:flex sm:flex-col gap-1.5 sm:gap-2 justify-items-center sm:justify-center items-center max-w-[76px] sm:max-w-none mx-auto" onClick={(e) => e.stopPropagation()}>
                          <Tooltip title="Xem chi tiết">
                              <Button type="primary" size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); handleViewDetails(record); }} className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center text-xs">
                                  <span className="hidden sm:inline text-xs">Xem chi tiết</span>
                              </Button>
                          </Tooltip>
                          {record.status === 'DONE' && !shouldHideSendReply && (
                              <Tooltip title="Gửi văn bản trình ký từ công việc hoàn thành này">
                                  <Button 
                                      type="default" 
                                      size="small" 
                                      icon={<SendOutlined className="text-blue-600" />} 
                                      onClick={(e) => { e.stopPropagation(); handleSendReplyDoc(record); }} 
                                      className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center border-blue-500 text-blue-600 hover:bg-blue-50 text-xs font-medium"
                                  >
                                      <span className="hidden sm:inline text-xs">Gửi Trình ký</span>
                                  </Button>
                              </Tooltip>
                          )}
                          {canEvaluate && (
                              <Tooltip title={record.evaluation ? "Cập nhật đánh giá KPI" : "Chấm điểm nghiệm thu KPI"}>
                                  <Button type="default" size="small" icon={<StarFilled className="text-amber-500" />} onClick={(e) => { e.stopPropagation(); handleOpenEvaluate(record); }} className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center border-amber-500 text-amber-600 hover:bg-amber-50 text-xs">
                                      <span className="hidden sm:inline text-xs">{record.evaluation ? 'Sửa KPI' : 'Chấm KPI'}</span>
                                  </Button>
                              </Tooltip>
                          )}
                          <Tooltip title="Cập nhật">
                              <Button type="default" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleSelectEvent({ resource: record }); }} className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center border-orange-500 text-orange-500 hover:bg-orange-50 text-xs">
                                  <span className="hidden sm:inline text-xs">Cập nhật</span>
                              </Button>
                          </Tooltip>
                          <Tooltip title="Lịch sử">
                              <Button type="default" size="small" icon={<HistoryOutlined />} onClick={(e) => { e.stopPropagation(); handleViewHistory(record); }} className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center text-gray-500 border-gray-500 hover:bg-gray-50 text-xs">
                                  <span className="hidden sm:inline text-xs">Lịch sử</span>
                              </Button>
                          </Tooltip>
                      </div>
                  );
              }
          }
    ];

    const renderTableView = () => {
        const filteredTasks = getFilteredTasks();
        return (
            <Table 
                columns={tableColumns} 
                dataSource={filteredTasks} 
                rowKey="_id"
                pagination={{ pageSize: 10, showLessItems: true, responsive: true }}
                className="mt-4 shadow-sm border border-gray-100"
                scroll={{ x: 'max-content' }}
                rowClassName={(record) => {
                    let className = "";
                    if (record.status !== 'DONE' && record.endDate) {
                        const now = dayjs().startOf('day');
                        const end = dayjs(record.endDate).startOf('day');
                        if (end.isBefore(now)) {
                            className = "!bg-red-50 hover:!bg-red-100 font-medium"; // Quá hạn
                        } else if (end.isSame(now)) {
                            className = "!bg-orange-50 hover:!bg-orange-100 font-medium"; // Đến hạn hôm nay
                        } else if (end.diff(now, 'day') <= 3) {
                            className = "!bg-yellow-50 hover:!bg-yellow-100"; // Sắp đến hạn
                        }
                    }
                    return className;
                }}
                onRow={(record) => ({
                    onClick: () => handleViewDetails(record),
                    style: { cursor: 'pointer' }
                })}
            />
        );
    };

    const renderDashboard = () => {
        if (isListView) return null;
        return (
        <div className="mb-6">
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                    <Card bordered={false} className="shadow-sm bg-red-50 text-red-600 border border-red-100 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/schedule/todo')}>
                        <Statistic 
                            title={<span className="text-red-500 font-semibold text-base"><ProfileOutlined /> Chưa làm</span>}
                            value={todoCount} 
                            valueStyle={{ color: '#cf1322', fontWeight: 'bold' }} 
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} className="shadow-sm bg-blue-50 text-blue-600 border border-blue-100 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/schedule/inprogress')}>
                        <Statistic 
                            title={<span className="text-blue-500 font-semibold text-base"><SyncOutlined spin /> Đang làm</span>}
                            value={inProgressCount} 
                            valueStyle={{ color: '#096dd9', fontWeight: 'bold' }} 
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} className="shadow-sm bg-green-50 text-green-600 border border-green-100 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/schedule/done')}>
                        <Statistic 
                            title={<span className="text-green-500 font-semibold text-base"><CheckCircleOutlined /> Hoàn thành</span>}
                            value={doneCount} 
                            valueStyle={{ color: '#389e0d', fontWeight: 'bold' }} 
                        />
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} className="mt-4">
                <Col xs={24} md={12}>
                    <Card title="Biểu đồ phân bổ" bordered={false} className="shadow-sm border border-gray-100">
                        <div style={{ height: 250 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} md={12}>
                    <Card title="Biểu đồ số lượng" bordered={false} className="shadow-sm border border-gray-100">
                        <div style={{ height: 250 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={pieData}
                                    margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis allowDecimals={false} />
                                    <RechartsTooltip />
                                    <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
    };

    // --- KANBAN BOARD LOGIC ---
    const handleDragStart = (e, taskId) => {
        e.dataTransfer.setData("taskId", taskId);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Cho phép thả
    };

    const handleDrop = async (e, newStatus) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("taskId");
        if (taskId) {
            const taskToMove = tasks.find(t => t._id === taskId);
            if (taskToMove && taskToMove.status !== newStatus) {
                // Kiểm tra ràng buộc hoàn thành công việc lớn khi còn công việc con
                if (newStatus === 'DONE') {
                    const stats = getSubtaskStats(taskToMove);
                    if (stats && stats.hasUnfinished) {
                        message.warning(`Không thể hoàn thành công việc lớn khi còn ${stats.total - stats.done} công việc con chưa hoàn thành. Vui lòng hoàn thành tất cả công việc con trước!`);
                        return;
                    }
                    if (!taskToMove.taskType || !taskToMove.difficultyRate || !taskToMove.outputResult || !taskToMove.focusAxis) {
                        message.warning("Công việc cần có đủ Loại công việc, Hệ số độ khó, Kết quả đầu ra và Trục kết quả trọng tâm khi hoàn thành. Vui lòng hoàn tất thông tin trong bảng cập nhật!");
                        handleSelectEvent({ resource: taskToMove });
                        form.setFieldsValue({ status: 'DONE' });
                        return;
                    }
                }

                // Optimistic update: cập nhật tức thì trạng thái và mốc thời gian hoàn thành
                const now = new Date();
                setTasks(prev => prev.map(t => t._id === taskId ? {
                    ...t,
                    status: newStatus,
                    completedAt: newStatus === 'DONE' ? now.toISOString() : (t.status === 'DONE' ? null : t.completedAt),
                    updatedAt: now.toISOString(),
                    history: [
                        ...(t.history || []),
                        {
                            action: 'Cập nhật trạng thái',
                            details: `Chuyển trạng thái sang "${newStatus === 'DONE' ? 'Hoàn thành' : newStatus === 'IN_PROGRESS' ? 'Đang làm' : 'Chưa làm'}"`,
                            timestamp: now.toISOString()
                        }
                    ]
                } : t));
                
                try {
                    const res = await updateTask(taskId, { status: newStatus });
                    message.success("Cập nhật trạng thái thành công");
                    if (res && res.data) {
                        setTasks(prev => prev.map(t => t._id === taskId ? res.data : t));
                        if (selectedTask && selectedTask._id === taskId) {
                            setSelectedTask(res.data);
                        }
                    }
                } catch (error) {
                    message.error(error.response?.data?.message || "Lỗi khi cập nhật trạng thái");
                    loadTasks(); // Revert
                }
            }
        }
    };

    const getTaskHighlightClass = (task) => {
        if (task.status === "DONE") return "border-gray-200 bg-white border-l-green-500";
        if (!task.endDate) return "border-gray-200 bg-white border-l-blue-500";
        
        const end = new Date(task.endDate);
        end.setHours(23, 59, 59, 999);
        const now = new Date();
        const timeDiff = end.getTime() - now.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        if (daysDiff < 0) {
            // Quá hạn
            return "border-red-500 bg-red-50 shadow-sm shadow-red-200";
        } else if (daysDiff >= 0 && daysDiff <= 3) {
            // Sắp đến hạn
            return "border-orange-500 bg-orange-50 shadow-sm shadow-orange-200";
        }
        return "border-gray-200 bg-white border-l-blue-500";
    };

    const renderKanbanBoard = () => {
        const columns = [
            { id: "TODO", title: "Chưa làm", color: "bg-amber-500", badgeColor: "bg-amber-100 text-amber-800" },
            { id: "IN_PROGRESS", title: "Đang làm", color: "bg-blue-500", badgeColor: "bg-blue-100 text-blue-800" },
            { id: "DONE", title: "Hoàn thành", color: "bg-emerald-500", badgeColor: "bg-emerald-100 text-emerald-800" },
        ];

        return (
            <div className="pb-4">
                <div className="flex flex-col md:flex-row gap-4 overflow-x-auto pb-4 items-start">
                    {columns.map(col => {
                        const colTasks = filteredTasks
                            .filter(t => t.status === col.id)
                            .sort((a, b) => {
                                if (col.id === 'DONE') {
                                    const compA = a.completedAt ? new Date(a.completedAt).getTime() : getTaskStatusUpdateTime(a);
                                    const compB = b.completedAt ? new Date(b.completedAt).getTime() : getTaskStatusUpdateTime(b);
                                    return compB - compA;
                                }

                                // TODO và IN_PROGRESS: Hạn xử lý gần nhất / quá hạn / đến hạn lên đầu
                                const endA = a.endDate ? new Date(a.endDate).getTime() : null;
                                const endB = b.endDate ? new Date(b.endDate).getTime() : null;

                                if (endA !== null && endB === null) return -1;
                                if (endA === null && endB !== null) return 1;
                                if (endA !== null && endB !== null && endA !== endB) {
                                    return endA - endB; // Tăng dần: Hạn gần nhất lên đầu
                                }

                                const priorityWeight = { FLASH: 3, URGENT: 2, NORMAL: 1 };
                                const prioA = priorityWeight[a.priority] || 1;
                                const prioB = priorityWeight[b.priority] || 1;
                                if (prioB !== prioA) return prioB - prioA;

                                return getTaskStatusUpdateTime(b) - getTaskStatusUpdateTime(a);
                            });
                        const currentPage = kanbanPage[col.id] || 1;
                        const startIndex = (currentPage - 1) * KANBAN_PAGE_SIZE;
                        const paginatedTasks = colTasks.slice(startIndex, startIndex + KANBAN_PAGE_SIZE);

                        return (
                        <div 
                            key={col.id} 
                            className="flex-1 min-w-[300px] bg-gray-100 rounded-lg p-4 flex flex-col"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="font-semibold text-gray-700">{col.title}</h4>
                                <span className={`${col.color} text-white text-xs px-2 py-1 rounded-full`}>
                                    {colTasks.length}
                                </span>
                            </div>
                            
                            <div className="flex flex-col gap-3 min-h-[150px] flex-grow">
                                {paginatedTasks.map(task => (
                                    <div
                                        key={task._id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, task._id)}
                                        onClick={() => handleSelectEvent({ resource: task })}
                                        className={`p-3 rounded border-l-4 cursor-pointer hover:shadow-md transition-shadow ${getTaskHighlightClass(task)}`}
                                    >
                                        <div className="font-medium text-gray-800 mb-1">
                                            {task.priority === 'FLASH' && <Tag color="red" className="mb-1">Hỏa tốc</Tag>}
                                            {task.priority === 'URGENT' && <Tag color="orange" className="mb-1">Khẩn</Tag>}
                                            {task.title}
                                        </div>
                                        {task.focusAxis && (
                                            <div className="mb-1">
                                                {renderFocusAxisTag(task.focusAxis)}
                                            </div>
                                        )}
                                        {task.endDate && (
                                            <div className="text-xs text-gray-500 mb-1">
                                                Hạn: {moment(task.endDate).format("DD/MM/YYYY HH:mm")}
                                            </div>
                                        )}
                                        {task.status === 'DONE' && (task.completedAt || task.updatedAt) && (
                                            <div className="text-xs text-green-600 mb-2 flex items-center gap-1 font-medium">
                                                <CheckCircleFilled className="text-emerald-500 text-[11px]" />
                                                <span>Hoàn thành: {moment(task.completedAt || task.updatedAt).format("HH:mm DD/MM/YYYY")}</span>
                                            </div>
                                        )}
                                        {(() => {
                                            const assigneesList = (task.assignees && task.assignees.length > 0)
                                                ? task.assignees
                                                : (task.createdBy ? [task.createdBy] : []);
                                            return (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {assigneesList.map(a => {
                                                        const aId = a._id || a;
                                                        const assignedUser = users.find(u => u._id === aId) || (a.name ? a : null);
                                                        return (
                                                            <span key={aId} className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                                                {assignedUser ? assignedUser.name : "Người thực hiện"}
                                                            </span>
                                                        );
                                                    })}
                                                    {(() => {
                                                        const collabList = [...(task.collaborators || [])];
                                                        if (task.subtasks && Array.isArray(task.subtasks)) {
                                                            task.subtasks.forEach(s => {
                                                                if (s.assignee) {
                                                                    const sId = (s.assignee._id || s.assignee).toString();
                                                                    const exists = collabList.some(c => (c._id || c).toString() === sId);
                                                                    const isMain = assigneesList.some(a => (a._id || a).toString() === sId);
                                                                    if (!exists && !isMain) {
                                                                        const uObj = typeof s.assignee === 'object' && s.assignee.name ? s.assignee : users.find(u => u._id?.toString() === sId);
                                                                        if (uObj) collabList.push(uObj);
                                                                    }
                                                                }
                                                            });
                                                        }
                                                        return collabList.map((c, cIdx) => {
                                                            const colUser = typeof c === 'object' && c.name ? c : users.find(u => u._id === (c._id || c));
                                                            return (
                                                                <span key={'col'+(c._id || c || cIdx)} className="text-[10px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded">
                                                                    {colUser ? colUser.name : "User"}
                                                                </span>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            );
                                        })()}
                                        {task.subtasks && task.subtasks.length > 0 && (() => {
                                            const stats = getSubtaskStats(task);
                                            if (!stats) return null;
                                            const isAllDone = stats.done === stats.total;
                                            const mySubtasks = task.subtasks.filter(s => (s.assignee?._id || s.assignee) === userId);
                                            const displaySubtasks = mySubtasks.length > 0 
                                                ? mySubtasks 
                                                : (task.subtasks.length <= 2 ? task.subtasks : task.subtasks.slice(0, 2));

                                            return (
                                                <div className="mt-2.5 pt-2 border-t border-gray-100">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                                                            <BranchesOutlined className="text-blue-500" /> Việc con:
                                                        </span>
                                                        <div className="flex items-center gap-1.5">
                                                            <Progress 
                                                                percent={stats.percent} 
                                                                size="small" 
                                                                showInfo={false} 
                                                                className="!m-0 w-12" 
                                                                status={isAllDone ? 'success' : 'active'}
                                                                strokeColor={isAllDone ? '#52c41a' : '#1890ff'}
                                                            />
                                                            <Tag color={isAllDone ? "green" : "blue"} className="mr-0 text-[10px] leading-tight px-1.5 py-0.5 font-semibold">
                                                                {stats.done}/{stats.total} ({stats.percent}%)
                                                            </Tag>
                                                        </div>
                                                    </div>
                                                    {displaySubtasks.length > 0 && (
                                                        <div className="mt-1 space-y-0.5">
                                                            {displaySubtasks.map((ms, mIdx) => (
                                                                <div key={ms._id || mIdx} className="text-[10px] text-blue-700 bg-blue-50/80 px-1.5 py-0.5 rounded flex items-center justify-between border border-blue-100">
                                                                    <span className="truncate max-w-[160px]" title={ms.title}>
                                                                        📌 {mySubtasks.length > 0 ? `Việc của bạn: ${ms.title}` : ms.title}
                                                                    </span>
                                                                    <span className={
                                                                        ms.status === 'DONE' 
                                                                            ? 'text-emerald-600 font-semibold' 
                                                                            : ms.status === 'IN_PROGRESS' 
                                                                            ? 'text-blue-600 font-semibold' 
                                                                            : 'text-amber-600 font-medium'
                                                                    }>
                                                                        {ms.status === 'DONE' ? '✓ Xong' : ms.status === 'IN_PROGRESS' ? 'Đang làm' : 'Chưa làm'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ))}
                            </div>
                            
                            {colTasks.length > KANBAN_PAGE_SIZE && (
                                <div className="mt-4 flex justify-center">
                                    <Pagination 
                                        simple 
                                        current={currentPage} 
                                        pageSize={KANBAN_PAGE_SIZE} 
                                        total={colTasks.length} 
                                        onChange={(page) => setKanbanPage(prev => ({ ...prev, [col.id]: page }))} 
                                    />
                                </div>
                            )}
                        </div>
                    )})}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white p-3 sm:p-6 rounded-lg shadow min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b pb-4 gap-4">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Công việc</h2>
                
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full md:w-auto">
                    <Segmented 
                        options={['Hệ thống', 'Google']} 
                        value={viewMode}
                        onChange={setViewMode}
                    />
                    
                    {viewMode === 'Hệ thống' && (
                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full md:w-auto">
                            <Button 
                                type="primary" 
                                onClick={() => handleSelectSlot({ start: new Date(), end: new Date() })}
                                className="w-full sm:w-auto flex items-center justify-center font-medium"
                            >
                                + Thêm công việc
                            </Button>
                            <Button 
                                icon={<PrinterOutlined />} 
                                onClick={() => navigate('/schedule/report')}
                                className="w-full sm:w-auto flex items-center justify-center border-indigo-500 text-indigo-600 hover:bg-indigo-50 font-medium"
                            >
                                In báo cáo
                            </Button>
                            <Button 
                                icon={<FileExcelOutlined />} 
                                onClick={() => navigate('/schedule/report?type=IPCV')}
                                className="w-full sm:w-auto flex items-center justify-center border-pink-500 text-pink-600 hover:bg-pink-50 font-medium"
                            >
                                iCPV
                            </Button>
                            <Button 
                                icon={<SyncOutlined />} 
                                onClick={() => setIsRecurringModalVisible(true)}
                                className="w-full sm:w-auto flex items-center justify-center border-teal-600 text-teal-700 hover:bg-teal-50 font-medium"
                            >
                                Mẫu việc định kỳ
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Dashboard Component */}
            {renderDashboard()}
            
            <div className="mt-4">
                {viewMode === 'Hệ thống' && (
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-xl mb-6 flex flex-wrap gap-3 items-center justify-between border border-gray-200 shadow-xs">
                        <div className="flex flex-wrap gap-3 items-center flex-1">
                            <Segmented
                                options={[
                                    { label: '📑 Bảng Kanban', value: 'kanban' },
                                    { label: '📋 Danh sách', value: 'table' },
                                    { label: '📅 Lịch công tác', value: 'calendar' }
                                ]}
                                value={displayView}
                                onChange={(val) => setDisplayView(val)}
                                className="bg-white border border-slate-200 shadow-xs p-0.5 font-medium"
                            />
                            <Input.Search 
                                placeholder="Tìm kiếm công việc..." 
                                allowClear 
                                onSearch={value => setSearchTerm(value)}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ width: 220 }}
                            />
                            <Select 
                                placeholder="Lọc theo trạng thái" 
                                value={filterStatus}
                                onChange={value => {
                                    setFilterStatus(value);
                                    if (value === 'TODO') navigate('/schedule/todo');
                                    else if (value === 'IN_PROGRESS') navigate('/schedule/inprogress');
                                    else if (value === 'DONE') navigate('/schedule/done');
                                    else navigate('/schedule/all');
                                }}
                                style={{ width: 140 }}
                            >
                                <Option value="ALL">Tất cả</Option>
                                <Option value="TODO">Chưa làm</Option>
                                <Option value="IN_PROGRESS">Đang làm</Option>
                                <Option value="DONE">Hoàn thành</Option>
                            </Select>
                            <Select 
                                placeholder="Người thực hiện" 
                                allowClear
                                showSearch
                                optionFilterProp="children"
                                onChange={value => setFilterAssignee(value)}
                                style={{ width: 170 }}
                            >
                                {users.filter(u => u.role !== null && (u.email || '').trim().toLowerCase() !== 'qlvb@nsgpc.edu.vn').map(u => (
                                    <Option key={u._id} value={u._id}>{u.name}</Option>
                                ))}
                            </Select>
                            <Select 
                                placeholder="Trục kết quả trọng tâm" 
                                allowClear
                                showSearch
                                value={filterFocusAxis}
                                optionFilterProp="children"
                                onChange={value => setFilterFocusAxis(value)}
                                style={{ minWidth: 180, maxWidth: 240 }}
                            >
                                {focusAxes.map(axis => (
                                    <Option key={axis.key || axis.code} value={axis.label || axis.name}>
                                        {axis.shortLabel ? `${axis.shortLabel} - ${axis.label.substring(0, 32)}...` : axis.label}
                                    </Option>
                                ))}
                            </Select>
                            <RangePicker 
                                placeholder={['Từ ngày', 'Đến ngày']}
                                format="DD/MM/YYYY"
                                value={filterDateRange}
                                onChange={(dates) => setFilterDateRange(dates)}
                                allowClear
                                presets={[
                                    { label: 'Hôm nay', value: [dayjs().startOf('day'), dayjs().endOf('day')] },
                                    { label: 'Tuần này', value: [dayjs().startOf('week'), dayjs().endOf('week')] },
                                    { label: 'Tháng này', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
                                    { label: 'Tháng trước', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
                                    { label: 'Quý này', value: [dayjs().startOf('quarter'), dayjs().endOf('quarter')] },
                                    { label: 'Năm nay', value: [dayjs().startOf('year'), dayjs().endOf('year')] },
                                ]}
                                style={{ minWidth: 240 }}
                            />
                        </div>
                        <Button 
                            type="primary" 
                            icon={<ExportOutlined />} 
                            onClick={exportToExcel} 
                            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                            className="font-medium"
                        >
                            Xuất Excel
                        </Button>
                    </div>
                )}
                {viewMode === 'Hệ thống' ? (
                    displayView === 'kanban' ? renderKanbanBoard() :
                    displayView === 'table' ? renderTableView() : (
                        <div style={{ height: '700px' }}>
                            <BigCalendar
                                localizer={localizer}
                                events={events}
                                startAccessor="start"
                                endAccessor="end"
                                style={{ height: '100%' }}
                                selectable
                                onSelectSlot={handleSelectSlot}
                                onSelectEvent={handleSelectEvent}
                                eventPropGetter={eventStyleGetter}
                                messages={{
                                    next: "Sau",
                                    previous: "Trước",
                                    today: "Hôm nay",
                                    month: "Tháng",
                                    week: "Tuần",
                                    day: "Ngày",
                                    agenda: "Lịch trình"
                                }}
                            />
                        </div>
                    )
                ) : (
                    renderGoogleCalendar()
                )}
            </div>

            <Modal
                title={
                    <div className="flex flex-wrap items-center justify-between gap-2 pr-6 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 text-base sm:text-lg font-bold text-[#003366]">
                            {editingTask ? (
                                <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <EditOutlined />
                                </span>
                            ) : (
                                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                    <PlusOutlined />
                                </span>
                            )}
                            <span>{editingTask ? "Cập nhật thông tin công việc" : "Thêm mới công việc"}</span>
                        </div>
                        {editingTask && (
                            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.status !== curr.status}>
                                {({ getFieldValue }) => {
                                    const st = getFieldValue('status') || editingTask.status || 'TODO';
                                    const color = st === 'DONE' ? 'green' : st === 'IN_PROGRESS' ? 'blue' : 'default';
                                    const text = st === 'DONE' ? 'Hoàn thành' : st === 'IN_PROGRESS' ? 'Đang làm' : 'Chưa làm';
                                    return (
                                        <Tag color={color} className="text-xs px-2.5 py-0.5 font-medium rounded-full m-0">
                                            {text}
                                        </Tag>
                                    );
                                }}
                            </Form.Item>
                        )}
                    </div>
                }
                open={isModalVisible}
                onOk={handleOk}
                width={1050}
                style={{ maxWidth: '96vw', top: 20 }}
                onCancel={() => setIsModalVisible(false)}
                footer={
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <div>
                            {canDeleteTask && (
                                <Button 
                                    key="delete" 
                                    danger 
                                    icon={<DeleteOutlined />} 
                                    onClick={handleDelete} 
                                    disabled={isSaving}
                                    className="rounded-lg h-9 px-4 font-medium"
                                >
                                    Xóa công việc
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-end">
                            <Button 
                                key="cancel" 
                                onClick={() => setIsModalVisible(false)} 
                                disabled={isSaving}
                                className="rounded-lg h-9 px-5 font-medium max-sm:flex-1"
                            >
                                Hủy bỏ
                            </Button>
                            <Button 
                                key="submit" 
                                type="primary" 
                                icon={<SaveOutlined />} 
                                onClick={handleOk} 
                                loading={isSaving}
                                className="rounded-lg h-9 px-6 font-semibold bg-[#003366] hover:bg-[#002244] border-none shadow-sm max-sm:flex-1"
                            >
                                {isSaving ? "Đang lưu..." : (editingTask ? "Lưu thay đổi" : "Tạo công việc")}
                            </Button>
                        </div>
                    </div>
                }
            >
                <Form form={form} layout="vertical" className="mt-1">
                    <Row gutter={[16, 16]}>
                        <Col xs={24} md={16}>
                            <Form.Item 
                                name="title" 
                                label={<span className="font-semibold text-slate-700">Tiêu đề công việc <span className="text-red-500">*</span></span>} 
                                rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                            >
                                <Input placeholder="Nhập tiêu đề công việc..." className="rounded-lg h-10" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                            <Form.Item 
                                name="priority" 
                                label={<span className="font-semibold text-slate-700">Mức độ ưu tiên</span>} 
                                initialValue="NORMAL"
                            >
                                <Select className="h-10">
                                    <Option value="NORMAL">
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-slate-400"></span> Bình thường
                                        </span>
                                    </Option>
                                    <Option value="URGENT">
                                        <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                                            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Khẩn
                                        </span>
                                    </Option>
                                    <Option value="FLASH">
                                        <span className="flex items-center gap-1.5 text-red-600 font-bold">
                                            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span> Hỏa tốc
                                        </span>
                                    </Option>
                                </Select>
                            </Form.Item>
                        </Col>

                        {/* Phần Trạng thái công việc nổi bật (Highlight Status) */}
                        <Col span={24}>
                            <div className="bg-slate-50/90 border border-slate-200/90 p-3.5 sm:p-4 rounded-xl shadow-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                                    <span className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                                        <SyncOutlined className="text-blue-600" />
                                        Trạng thái công việc <span className="text-red-500">*</span>
                                    </span>
                                    <span className="text-xs text-slate-500 hidden sm:inline">
                                        (Nhấn trực tiếp để cập nhật tiến độ công việc)
                                    </span>
                                </div>
                                <Form.Item name="status" noStyle>
                                    <StatusSelector formSubtasks={formSubtasks} />
                                </Form.Item>
                                <Form.Item noStyle shouldUpdate={(prev, curr) => prev.status !== curr.status}>
                                    {({ getFieldValue }) => {
                                        if (getFieldValue('status') === 'DONE') {
                                            return (
                                                <div className="mt-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex items-center gap-2">
                                                    <CheckCircleFilled className="text-emerald-600 text-base flex-shrink-0" />
                                                    <span><b>Đã chuyển sang Hoàn thành:</b> Hệ thống yêu cầu bắt buộc hoàn tất 4 thông tin tại phần <b>Tiêu chuẩn đánh giá & Kết quả đầu ra (Phụ lục 3 & 4)</b> bên dưới trước khi lưu.</span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                </Form.Item>
                            </div>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item 
                                name="dates" 
                                label={
                                    <span className="font-semibold text-slate-700">
                                        Ngày thực hiện <span className="text-red-500">*</span> {!canChangeTaskTime && <span className="text-xs text-red-500 font-normal ml-1">(Chỉ người tạo/chủ trì được sửa)</span>}
                                    </span>
                                } 
                                rules={[{ required: true, message: 'Vui lòng chọn ngày' }]}
                            >
                                <RangePicker 
                                    format="DD/MM/YYYY" 
                                    className="w-full h-10 rounded-lg" 
                                    disabled={editingTask && !canChangeTaskTime}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item 
                                name="times" 
                                label={
                                    <span className="font-semibold text-slate-700">
                                        Giờ thực hiện (tùy chọn) {!canChangeTaskTime && <span className="text-xs text-red-500 font-normal ml-1">(Chỉ người tạo/chủ trì được sửa)</span>}
                                    </span>
                                }
                            >
                                <TimePicker.RangePicker 
                                    format="HH:mm" 
                                    className="w-full h-10 rounded-lg" 
                                    disabled={editingTask && !canChangeTaskTime}
                                />
                            </Form.Item>
                        </Col>

                        {isTimeChanged && (
                            <Col span={24}>
                                <div className="bg-amber-50 p-3 rounded-lg border border-amber-300 mb-1">
                                    <Form.Item
                                        name="timeChangeReason"
                                        label={
                                            <span className="font-semibold text-amber-900 flex items-center gap-1.5">
                                                <ExclamationCircleOutlined className="text-amber-600 text-base" />
                                                Lý do thay đổi thời gian thực hiện <span className="text-red-500">*</span>
                                            </span>
                                        }
                                        rules={[{ required: true, message: 'Vui lòng nhập lý do thay đổi thời gian thực hiện công việc!' }]}
                                        className="!mb-1"
                                    >
                                        <Input.TextArea
                                            rows={2}
                                            placeholder="Bắt buộc ghi rõ lý do điều chỉnh thời gian (ví dụ: Chờ phê duyệt từ Sở, phát sinh khối lượng bổ sung...)"
                                            className="border-amber-300 rounded-lg"
                                        />
                                    </Form.Item>
                                    <div className="text-[12px] text-amber-700">
                                        * Lý do này sẽ được ghi nhận chi tiết vào Lịch sử cập nhật công việc cùng với người thực hiện và thời gian thay đổi.
                                    </div>
                                </div>
                            </Col>
                        )}

                        <Col xs={24} md={12}>
                            <Form.Item name="description" label={<span className="font-semibold text-slate-700">Nội dung chi tiết</span>}>
                                <Input.TextArea rows={3} placeholder="Nhập nội dung, yêu cầu công việc..." className="rounded-lg" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item name="notes" label={<span className="font-semibold text-slate-700">Ghi chú thêm</span>}>
                                <Input.TextArea rows={3} placeholder="Ghi chú, lưu ý tiến độ..." className="rounded-lg" />
                            </Form.Item>
                        </Col>

                        {/* Tiêu chuẩn đánh giá & Kết quả đầu ra (Phụ lục 3 & 4) */}
                        <Col span={24}>
                            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-blue-50/40 via-indigo-50/20 to-blue-50/30 rounded-xl border border-blue-100">
                                <div className="font-bold text-[#003366] text-sm sm:text-base mb-3 flex items-center justify-between">
                                    <span className="flex items-center gap-2">
                                        <FileDoneOutlined className="text-blue-600 text-base" />
                                        Tiêu chuẩn đánh giá & Kết quả đầu ra (Phụ lục 3 & 4)
                                    </span>
                                    <span className="text-xs text-slate-500 font-normal hidden sm:inline">
                                        * Bắt buộc khi chuyển trạng thái Hoàn thành
                                    </span>
                                </div>
                                <Row gutter={[16, 12]}>
                                    <Col xs={24} md={12}>
                                        <Form.Item
                                            noStyle
                                            shouldUpdate={(prevValues, currentValues) => prevValues.status !== currentValues.status}
                                        >
                                            {({ getFieldValue }) => {
                                                const isDone = getFieldValue('status') === 'DONE';
                                                return (
                                                    <Form.Item 
                                                        name="taskType" 
                                                        label={
                                                            <span>
                                                                Loại công việc (Phụ lục 3 & 4) {isDone && <span className="text-red-500 font-bold">*</span>}
                                                            </span>
                                                        } 
                                                        initialValue="REGULAR"
                                                        rules={isDone ? [{ required: true, message: 'Vui lòng chọn Loại công việc (Phụ lục 3 & 4) khi hoàn thành!' }] : []}
                                                        tooltip="Thường xuyên: Điểm chuẩn 10đ. Đột xuất: Điểm chuẩn 12đ."
                                                    >
                                                        <Select 
                                                            placeholder="Chọn loại công việc"
                                                            className="h-10"
                                                            onChange={(val) => {
                                                                form.setFieldsValue({ baseScore: val === 'URGENT' ? 12 : 10 });
                                                            }}
                                                        >
                                                            <Option value="REGULAR">Thường xuyên (Điểm chuẩn: 10đ)</Option>
                                                            <Option value="URGENT">Đột xuất (Điểm chuẩn: 12đ)</Option>
                                                        </Select>
                                                    </Form.Item>
                                                );
                                            }}
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item
                                            noStyle
                                            shouldUpdate={(prevValues, currentValues) => prevValues.status !== currentValues.status}
                                        >
                                            {({ getFieldValue }) => {
                                                const isDone = getFieldValue('status') === 'DONE';
                                                return (
                                                    <Form.Item 
                                                        name="difficultyRate" 
                                                        label={
                                                            <span>
                                                                Hệ số độ khó (Phụ lục 3) {isDone && <span className="text-red-500 font-bold">*</span>}
                                                            </span>
                                                        } 
                                                        initialValue={1.0}
                                                        rules={isDone ? [{ required: true, message: 'Vui lòng chọn Hệ số độ khó (Phụ lục 3) khi hoàn thành!' }] : []}
                                                        tooltip="1.0 (100%): Thông thường. 1.1 (110%): Phối hợp ≤ 3 người/đơn vị. 1.2 (120%): Phối hợp ≥ 4 người/đơn vị."
                                                    >
                                                        <Select placeholder="Chọn hệ số độ khó" className="h-10">
                                                            <Option value={1.0}>1.0 (100% - Thông thường)</Option>
                                                            <Option value={1.1}>1.1 (110% - Phối hợp ≤ 3 đơn vị / người)</Option>
                                                            <Option value={1.2}>1.2 (120% - Phối hợp ≥ 4 đơn vị / người)</Option>
                                                        </Select>
                                                    </Form.Item>
                                                );
                                            }}
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item
                                            noStyle
                                            shouldUpdate={(prevValues, currentValues) => 
                                                prevValues.status !== currentValues.status || 
                                                prevValues.outputResult !== currentValues.outputResult
                                            }
                                        >
                                            {({ getFieldValue }) => {
                                                const isDone = getFieldValue('status') === 'DONE';
                                                const currentOutput = getFieldValue('outputResult');
                                                const options = [
                                                    ...OUTPUT_RESULT_OPTIONS.map(opt => ({ value: opt, label: opt })),
                                                    ...(currentOutput && !OUTPUT_RESULT_OPTIONS.includes(currentOutput)
                                                        ? [{ value: currentOutput, label: currentOutput }]
                                                        : [])
                                                ];

                                                return (
                                                    <Form.Item 
                                                        name="outputResult" 
                                                        label={
                                                            <span>
                                                                Kết quả đầu ra / Sản phẩm (Phụ lục 3) {isDone && <span className="text-red-500 font-bold">*</span>}
                                                            </span>
                                                        } 
                                                        rules={isDone ? [{ required: true, message: 'Vui lòng chọn hoặc nhập Kết quả đầu ra / Sản phẩm (Phụ lục 3) khi hoàn thành!' }] : []}
                                                        tooltip="Ví dụ: Văn bản / Tài liệu, Báo cáo tổng hợp, Quyết định, Kế hoạch, Phần mềm ứng dụng, Thông báo..."
                                                    >
                                                        <AutoComplete 
                                                            allowClear 
                                                            showAction={['focus', 'click']}
                                                            defaultActiveFirstOption={false}
                                                            options={options}
                                                            className="w-full"
                                                            filterOption={(inputValue, option) =>
                                                                !inputValue || (option?.value ?? '').toLowerCase().includes(inputValue.toLowerCase())
                                                            }
                                                        >
                                                            <Input 
                                                                className="h-10" 
                                                                placeholder="Chọn gợi ý từ danh sách hoặc tự do nhập kết quả..." 
                                                                suffix={<DownOutlined className="text-gray-400 text-xs pointer-events-none" />}
                                                            />
                                                        </AutoComplete>
                                                    </Form.Item>
                                                );
                                            }}
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                        <Form.Item
                                            noStyle
                                            shouldUpdate={(prevValues, currentValues) => prevValues.status !== currentValues.status}
                                        >
                                            {({ getFieldValue }) => {
                                                const isDone = getFieldValue('status') === 'DONE';
                                                return (
                                                    <Form.Item
                                                        name="focusAxis"
                                                        label={
                                                            <span>
                                                                Trục kết quả trọng tâm {isDone && <span className="text-red-500 font-bold">*</span>}
                                                            </span>
                                                        }
                                                        rules={isDone ? [{ required: true, message: 'Vui lòng chọn Trục kết quả trọng tâm khi hoàn thành công việc!' }] : []}
                                                        tooltip="Bắt buộc chọn khi chuyển trạng thái công việc sang Hoàn thành"
                                                    >
                                                        <Select
                                                            allowClear
                                                            showSearch
                                                            className="h-10"
                                                            placeholder="Chọn trục kết quả trọng tâm"
                                                            filterOption={(input, option) =>
                                                                (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                                                            }
                                                        >
                                                            {focusAxes.map(axis => (
                                                                <Option key={axis.key || axis.code} value={axis.label || axis.name}>
                                                                    {axis.label || axis.name}
                                                                </Option>
                                                            ))}
                                                        </Select>
                                                    </Form.Item>
                                                );
                                            }}
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </div>
                        </Col>
                        <Col span={12}>
                            <Form.Item 
                                name="assignees" 
                                label="Người thực hiện"
                                rules={[{ required: true, message: 'Vui lòng chọn ít nhất một người thực hiện!' }]}
                            >
                                <Select 
                                    mode="multiple" 
                                    placeholder="Chọn người thực hiện" 
                                    showSearch 
                                    optionFilterProp="label"
                                    filterOption={filterUserOption}
                                    disabled={!canEditAssignees}
                                >
                                    {userGroups.map(group => (
                                        <Select.OptGroup key={group.key} label={group.label}>
                                            {group.users.map(u => {
                                                const labelStr = `${u.name} (${u.email})`;
                                                return (
                                                    <Option key={u._id} value={u._id} label={labelStr} name={u.name || ""}>
                                                        {labelStr}
                                                    </Option>
                                                );
                                            })}
                                        </Select.OptGroup>
                                    ))}
                                    {users.length > 0 && (
                                        <Select.OptGroup label="Khác">
                                            {users.filter(u => !userGroups.some(g => g.users.some(gu => gu._id === u._id))).map(u => {
                                                const labelStr = `${u.name} (${u.email})`;
                                                return (
                                                    <Option key={u._id} value={u._id} label={labelStr} name={u.name || ""}>
                                                        {labelStr}
                                                    </Option>
                                                );
                                            })}
                                        </Select.OptGroup>
                                    )}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="collaborators" label="Người phối hợp">
                                <Select 
                                    mode="multiple" 
                                    placeholder="Chọn người phối hợp" 
                                    showSearch 
                                    optionFilterProp="label"
                                    filterOption={filterUserOption}
                                    disabled={!canEditAssignees}
                                >
                                    {userGroups.map(group => (
                                        <Select.OptGroup key={group.key} label={group.label}>
                                            {group.users.map(u => {
                                                const labelStr = `${u.name} (${u.email})`;
                                                return (
                                                    <Option key={u._id} value={u._id} label={labelStr} name={u.name || ""}>
                                                        {labelStr}
                                                    </Option>
                                                );
                                            })}
                                        </Select.OptGroup>
                                    ))}
                                    {users.length > 0 && (
                                        <Select.OptGroup label="Khác">
                                            {users.filter(u => !userGroups.some(g => g.users.some(gu => gu._id === u._id))).map(u => {
                                                const labelStr = `${u.name} (${u.email})`;
                                                return (
                                                    <Option key={u._id} value={u._id} label={labelStr} name={u.name || ""}>
                                                        {labelStr}
                                                    </Option>
                                                );
                                            })}
                                        </Select.OptGroup>
                                    )}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item label="Tệp đính kèm">
                                <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Upload
                                            multiple
                                            beforeUpload={() => false}
                                            fileList={fileList}
                                            showUploadList={false}
                                            onChange={(info) => {
                                                const newFileList = info.fileList.map(f => {
                                                    if (f.originFileObj && !f.formattedName) {
                                                        f.name = formatFileName(f.name);
                                                        f.formattedName = true;
                                                    }
                                                    return f;
                                                });
                                                setFileList(newFileList);
                                            }}
                                        >
                                            <Button icon={<UploadOutlined />}>Tải tệp lên</Button>
                                        </Upload>

                                        <SelectFromSignatureArchive
                                            buttonText="Chọn từ Kho lưu trữ"
                                            modalTitle="Chọn tệp từ kho văn bản đã ký"
                                            buttonProps={{
                                                icon: <CloudServerOutlined className="text-purple-600" />,
                                                className: "border-purple-300 text-purple-700 hover:bg-purple-50",
                                            }}
                                            onSelectFiles={(selectedArchiveFiles) => {
                                                const existingFileIds = new Set([
                                                    ...((editingTask && editingTask.files) || []).map(f => f.fileId),
                                                    ...fileList.map(f => f.fileId).filter(Boolean)
                                                ]);
                                                const updatedList = [...fileList];
                                                let addedCount = 0;
                                                selectedArchiveFiles.forEach(f => {
                                                    if (!existingFileIds.has(f.fileId)) {
                                                        updatedList.push(f);
                                                        existingFileIds.add(f.fileId);
                                                        addedCount++;
                                                    }
                                                });
                                                setFileList(updatedList);
                                                if (addedCount > 0) {
                                                    message.success(`Đã thêm ${addedCount} tệp từ Kho lưu trữ`);
                                                } else {
                                                    message.info("Các tệp đã chọn đã có trong danh sách đính kèm");
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* Danh sách tệp mới thêm vào */}
                                    {fileList.length > 0 && (
                                        <div className="flex flex-col gap-1.5 mt-1">
                                            {fileList.map((file, idx) => (
                                                <div 
                                                    key={file.uid || idx} 
                                                    className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200 hover:bg-blue-50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                                                        {file.isExisting ? (
                                                            <CloudServerOutlined className="text-purple-600 text-base flex-shrink-0" />
                                                        ) : (
                                                            <FileTextOutlined className="text-blue-500 text-base flex-shrink-0" />
                                                        )}
                                                        <span className="text-sm text-gray-700 truncate" title={file.name || file.fileName}>
                                                            {file.name || file.fileName}
                                                        </span>
                                                        {file.isExisting && (
                                                            <Tag color="purple" className="text-[11px] mr-0 flex-shrink-0">Từ Kho lưu trữ</Tag>
                                                        )}
                                                    </div>
                                                    <Space className="flex-shrink-0">
                                                        {file.url && (
                                                            <Button 
                                                                size="small" 
                                                                type="link" 
                                                                icon={<EyeOutlined />} 
                                                                onClick={() => window.open(file.url, '_blank')}
                                                            >
                                                                Xem
                                                            </Button>
                                                        )}
                                                        <Button 
                                                            size="small" 
                                                            type="text" 
                                                            danger 
                                                            icon={<DeleteOutlined />} 
                                                            onClick={() => {
                                                                setFileList(prev => prev.filter(f => (f.uid ? f.uid !== file.uid : f !== file)));
                                                            }}
                                                            title="Xóa tệp đính kèm này"
                                                        >
                                                            Xóa
                                                        </Button>
                                                    </Space>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Form.Item>
                        </Col>
                        {!(editingTask?.status === 'DONE' && formSubtasks.length === 0) && (
                            <Col span={24}>
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-semibold text-slate-700 text-sm flex items-center gap-1.5">
                                            <BranchesOutlined className="text-blue-600" /> Phân chia công việc con ({formSubtasks.length})
                                        </span>
                                        {formSubtasks.length > 0 && (
                                            <Tag color={formSubtasks.every(s => s.status === 'DONE') ? 'green' : 'blue'}>
                                                {formSubtasks.filter(s => s.status === 'DONE').length}/{formSubtasks.length} đã xong
                                            </Tag>
                                        )}
                                    </div>
                                    {editingTask?.status !== 'DONE' && (
                                        <div className="space-y-2 mb-3">
                                            <Row gutter={[8, 8]}>
                                                <Col xs={24} sm={10}>
                                                    <Input 
                                                        placeholder="Tiêu đề việc con..." 
                                                        value={tempSubtaskTitle}
                                                        onChange={e => setTempSubtaskTitle(e.target.value)}
                                                        onPressEnter={(e) => {
                                                            e.preventDefault();
                                                            if (tempSubtaskTitle.trim()) {
                                                                setFormSubtasks(prev => [
                                                                    ...prev, 
                                                                    {
                                                                        title: tempSubtaskTitle.trim(),
                                                                        assignee: tempSubtaskAssignee || null,
                                                                        endDate: tempSubtaskEndDate ? tempSubtaskEndDate.toDate() : null,
                                                                        status: 'TODO'
                                                                    }
                                                                ]);
                                                                setTempSubtaskTitle('');
                                                                setTempSubtaskAssignee(null);
                                                                setTempSubtaskEndDate(null);
                                                            }
                                                        }}
                                                    />
                                                </Col>
                                                <Col xs={24} sm={7}>
                                                    <Select 
                                                        placeholder="Giao cho..." 
                                                        allowClear
                                                        showSearch
                                                        optionFilterProp="label"
                                                        filterOption={filterUserOption}
                                                        value={tempSubtaskAssignee}
                                                        onChange={val => setTempSubtaskAssignee(val)}
                                                        className="w-full"
                                                    >
                                                        {userGroups.map(group => (
                                                            <Select.OptGroup key={group.key} label={group.label}>
                                                                {group.users.map(u => {
                                                                    const labelStr = `${u.name} (${u.email})`;
                                                                    return (
                                                                        <Option key={u._id} value={u._id} label={labelStr} name={u.name || ""}>
                                                                            {u.name}
                                                                        </Option>
                                                                    );
                                                                })}
                                                            </Select.OptGroup>
                                                        ))}
                                                    </Select>
                                                </Col>
                                                <Col xs={18} sm={5}>
                                                    <DatePicker 
                                                        placeholder="Hạn chót"
                                                        format="DD/MM/YYYY"
                                                        value={tempSubtaskEndDate}
                                                        onChange={d => setTempSubtaskEndDate(d)}
                                                        className="w-full"
                                                    >
                                                    </DatePicker>
                                                </Col>
                                                <Col xs={6} sm={2}>
                                                    <Button 
                                                        type="dashed" 
                                                        icon={<PlusOutlined />} 
                                                        className="w-full flex items-center justify-center"
                                                        onClick={() => {
                                                            if (!tempSubtaskTitle.trim()) {
                                                                message.warning("Vui lòng nhập tiêu đề việc con");
                                                                return;
                                                            }
                                                            const foundUser = users.find(u => String(u._id) === String(tempSubtaskAssignee));
                                                            setFormSubtasks(prev => [
                                                                ...prev, 
                                                                {
                                                                    title: tempSubtaskTitle.trim(),
                                                                    assignee: foundUser ? { _id: foundUser._id, name: foundUser.name, email: foundUser.email } : (tempSubtaskAssignee || null),
                                                                    endDate: tempSubtaskEndDate ? tempSubtaskEndDate.toDate() : null,
                                                                    status: 'TODO'
                                                                }
                                                            ]);
                                                            setTempSubtaskTitle('');
                                                            setTempSubtaskAssignee(null);
                                                            setTempSubtaskEndDate(null);
                                                        }}
                                                    >
                                                        Thêm
                                                    </Button>
                                                </Col>
                                            </Row>
                                        </div>
                                    )}

                                    {formSubtasks.length > 0 ? (
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                            {formSubtasks.map((st, idx) => {
                                                const assignedUser = users.find(u => String(u._id) === String(st.assignee?._id || st.assignee));
                                                const assigneeDisplayName = (typeof st.assignee === 'object' && st.assignee?.name)
                                                    ? st.assignee.name
                                                    : assignedUser?.name;
                                                return (
                                                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 text-xs">
                                                        <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                                                            <span className="font-semibold text-slate-500">#{idx + 1}</span>
                                                            <span className={`truncate font-medium ${st.status === 'DONE' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                                                {st.title}
                                                            </span>
                                                            {assigneeDisplayName && (
                                                                <Tag color="blue" className="text-[10px] m-0">
                                                                    {assigneeDisplayName}
                                                                </Tag>
                                                            )}
                                                            {st.endDate && (
                                                                <span className="text-slate-400 text-[11px]">
                                                                    {dayjs(st.endDate).format('DD/MM/YYYY')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {editingTask?.status === 'DONE' ? (
                                                            <Tag color={st.status === 'DONE' ? 'green' : 'blue'}>
                                                                {st.status === 'DONE' ? 'Hoàn thành' : (st.status === 'IN_PROGRESS' ? 'Đang làm' : 'Chưa làm')}
                                                            </Tag>
                                                        ) : (
                                                            <Space size="small">
                                                                <Select 
                                                                    size="small" 
                                                                    value={st.status || 'TODO'} 
                                                                    onChange={newSt => {
                                                                        setFormSubtasks(prev => prev.map((item, i) => i === idx ? { ...item, status: newSt } : item));
                                                                    }}
                                                                    className="w-24 text-[11px]"
                                                                >
                                                                    <Option value="TODO">Chưa làm</Option>
                                                                    <Option value="IN_PROGRESS">Đang làm</Option>
                                                                    <Option value="DONE">Hoàn thành</Option>
                                                                </Select>
                                                                <Button 
                                                                    size="small" 
                                                                    type="text" 
                                                                    danger 
                                                                    icon={<DeleteOutlined />} 
                                                                    onClick={() => {
                                                                        setFormSubtasks(prev => prev.filter((_, i) => i !== idx));
                                                                    }}
                                                                />
                                                            </Space>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-slate-400 text-center py-2 text-xs">
                                            Chưa thêm công việc con nào.
                                        </div>
                                    )}
                                </div>
                            </Col>
                        )}
                    </Row>
                </Form>
                {(() => {
                    const taskFiles = (editingTask && editingTask.files) ? editingTask.files : [];
                    const relatedFiles = (editingTask && editingTask.relatedDocument && editingTask.relatedDocument.files) ? editingTask.relatedDocument.files : [];
                    
                    if (taskFiles.length === 0 && relatedFiles.length === 0) return null;

                    return (
                        <div style={{ marginTop: 15 }} className="space-y-3">
                            {taskFiles.length > 0 && (
                                <div>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600 }}>Tệp đính kèm công việc ({taskFiles.length}):</h4>
                                    <div className="flex flex-col gap-1.5">
                                        {taskFiles.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border hover:bg-gray-100 transition-colors">
                                                <div className="flex items-center gap-2 overflow-hidden mr-2">
                                                    <FileTextOutlined className="text-blue-500 text-base flex-shrink-0" />
                                                    <a href={`https://drive.google.com/file/d/${file.fileId}/view`} target="_blank" rel="noreferrer" className="flex-1 text-sm text-gray-700 hover:text-blue-600 truncate" title={file.fileName}>
                                                        {file.fileName}
                                                    </a>
                                                </div>
                                                <Space className="flex-shrink-0">
                                                    <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => window.open(`https://drive.google.com/file/d/${file.fileId}/view`, '_blank')}>Xem</Button>
                                                    <Button 
                                                        size="small" 
                                                        type="text" 
                                                        danger 
                                                        icon={<DeleteOutlined />} 
                                                        onClick={() => {
                                                            setEditingTask(prev => ({
                                                                ...prev,
                                                                files: (prev.files || []).filter(f => f.fileId !== file.fileId)
                                                            }));
                                                        }} 
                                                        title="Xóa tệp đính kèm này"
                                                    >
                                                        Xóa
                                                    </Button>
                                                </Space>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {relatedFiles.length > 0 && (
                                <div>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 600 }} className="text-gray-500">Tệp từ văn bản liên quan ({relatedFiles.length}):</h4>
                                    <div className="flex flex-col gap-1.5">
                                        {relatedFiles.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 bg-blue-50/50 rounded border border-blue-100 hover:bg-blue-50 transition-colors">
                                                <div className="flex items-center gap-2 overflow-hidden mr-2">
                                                    <FileTextOutlined className="text-blue-500 text-base flex-shrink-0" />
                                                    <a href={`https://drive.google.com/file/d/${file.fileId}/view`} target="_blank" rel="noreferrer" className="flex-1 text-sm text-gray-700 hover:text-blue-600 truncate" title={file.fileName}>
                                                        {file.fileName}
                                                    </a>
                                                </div>
                                                <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => window.open(`https://drive.google.com/file/d/${file.fileId}/view`, '_blank')}>Xem</Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </Modal>

            {/* Modal Xem chi tiết */}
            <Modal
                title="Chi tiết công việc"
                open={isDetailsVisible}
                onCancel={() => setIsDetailsVisible(false)}
                footer={[
                    selectedTask?.status === 'DONE' && !shouldHideSendReply && (
                        <Button 
                            key="sendReply" 
                            type="primary" 
                            icon={<SendOutlined />} 
                            onClick={() => {
                                setIsDetailsVisible(false);
                                handleSendReplyDoc(selectedTask);
                            }}
                            className="bg-blue-600 hover:bg-blue-500"
                        >
                            Gửi Trình ký
                        </Button>
                    ),
                    <Button key="close" onClick={() => setIsDetailsVisible(false)}>Đóng</Button>
                ].filter(Boolean)}
                width={800}
            >
                {selectedTask && (
                    <div className="space-y-4 text-base">
                        {selectedTask.status === 'DONE' && (
                            <Alert 
                                message="Công việc đã hoàn thành" 
                                description={
                                    !shouldHideSendReply ? (
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1">
                                            <span className="text-sm">Bạn có thể sử dụng kết quả và tệp đính kèm của công việc này để tạo hồ sơ Trình ký gửi Ban Giám hiệu.</span>
                                            <Button 
                                                type="primary" 
                                                size="small" 
                                                icon={<SendOutlined />} 
                                                onClick={() => {
                                                    setIsDetailsVisible(false);
                                                    handleSendReplyDoc(selectedTask);
                                                }}
                                                className="bg-blue-600 hover:bg-blue-500 flex-shrink-0"
                                            >
                                                Gửi Trình ký ngay
                                            </Button>
                                        </div>
                                    ) : (
                                        <span className="text-sm">Công việc này đã được ghi nhận hoàn thành.</span>
                                    )
                                } 
                                type="success" 
                                showIcon 
                                className="mb-4" 
                            />
                        )}
                        {selectedTask.priority === 'FLASH' && (
                            <Alert message="Văn bản Hỏa tốc" description="Công việc này cần được xử lý ngay lập tức!" type="error" showIcon className="mb-4" />
                        )}
                        {selectedTask.priority === 'URGENT' && (
                            <Alert message="Văn bản Khẩn" description="Công việc này cần được ưu tiên xử lý sớm!" type="warning" showIcon className="mb-4" />
                        )}
                        <div><strong className="text-gray-600">Tiêu đề:</strong> <span className="text-lg font-semibold">{selectedTask.title}</span></div>
                        <div>
                            <strong className="text-gray-600">Mức độ:</strong> 
                            <Tag className="ml-2" color={selectedTask.priority === 'FLASH' ? 'red' : selectedTask.priority === 'URGENT' ? 'orange' : 'blue'}>
                                {selectedTask.priority === 'FLASH' ? 'Hỏa tốc' : selectedTask.priority === 'URGENT' ? 'Khẩn' : 'Bình thường'}
                            </Tag>
                        </div>
                        <div>
                            <strong className="text-gray-600">Trạng thái:</strong> 
                            <Tag className="ml-2" color={selectedTask.status === 'TODO' ? 'red' : selectedTask.status === 'IN_PROGRESS' ? 'blue' : 'green'}>
                                {selectedTask.status === 'TODO' ? 'Chưa làm' : selectedTask.status === 'IN_PROGRESS' ? 'Đang làm' : 'Hoàn thành'}
                            </Tag>
                            {selectedTask.status === 'DONE' && (() => {
                                const completed = selectedTask.completedAt || selectedTask.updatedAt;
                                const endOfDay = selectedTask.endDate ? new Date(selectedTask.endDate) : null;
                                if (endOfDay) endOfDay.setHours(23, 59, 59, 999);

                                const isLate = completed && endOfDay && (new Date(completed).getTime() > endOfDay.getTime());
                                const daysLate = isLate ? Math.max(1, Math.ceil((new Date(completed).getTime() - endOfDay.getTime()) / (1000 * 60 * 60 * 24))) : 0;
                                return isLate ? (
                                    <Tag color="orange" className="ml-2">Trễ {daysLate} ngày</Tag>
                                ) : (
                                    <Tag color="green" className="ml-2">Đúng hạn</Tag>
                                );
                            })()}
                        </div>
                        {selectedTask.focusAxis && (
                            <div>
                                <strong className="text-gray-600">Trục kết quả trọng tâm:</strong> 
                                <span className="ml-2 font-medium">{renderFocusAxisTag(selectedTask.focusAxis)}</span>
                                <span className="text-xs text-gray-500 ml-1">({selectedTask.focusAxis})</span>
                            </div>
                        )}
                        {selectedTask.outputResult && (
                            <div>
                                <strong className="text-gray-600">Kết quả đầu ra / Sản phẩm:</strong> 
                                <Tag color="geekblue" className="ml-2">{selectedTask.outputResult}</Tag>
                            </div>
                        )}
                        {selectedTask.status === 'DONE' && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <strong className="text-blue-800 flex items-center gap-1.5"><TrophyOutlined /> Đánh giá nghiệm thu KPI:</strong>
                                    {(['admin', 'manager', 'cappho'].includes(userRole) || (selectedTask.createdBy && (selectedTask.createdBy._id === userId || selectedTask.createdBy === userId))) && (
                                        <Button size="small" type="primary" onClick={() => handleOpenEvaluate(selectedTask)}>
                                            {selectedTask.evaluation ? "Đánh giá lại" : "Chấm điểm ngay"}
                                        </Button>
                                    )}
                                </div>
                                {selectedTask.evaluation?.score !== undefined ? (
                                    <div className="text-sm space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span>Điểm chất lượng: <b className="text-blue-600 text-base">{selectedTask.evaluation.score}/100</b></span>
                                            <Rate disabled value={selectedTask.evaluation.rating || Math.round(selectedTask.evaluation.score / 20)} className="text-sm text-amber-500" />
                                        </div>
                                        {selectedTask.evaluation.feedback && (
                                            <div>Nhận xét: <i className="text-gray-700 font-medium">"{selectedTask.evaluation.feedback}"</i></div>
                                        )}
                                        {selectedTask.evaluation.evaluatedBy && (
                                            <div className="text-xs text-gray-400">
                                                Người đánh giá: {selectedTask.evaluation.evaluatedBy.name || selectedTask.evaluation.evaluatedBy.email} ({dayjs(selectedTask.evaluation.evaluatedAt).format('DD/MM/YYYY HH:mm')})
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500 italic">Công việc đã hoàn thành, chưa có đánh giá nghiệm thu từ quản lý/người giao việc.</div>
                                )}
                            </div>
                        )}
                        <div><strong className="text-gray-600">Thời gian:</strong> {dayjs(selectedTask.startDate).format('DD/MM/YYYY HH:mm')} - {dayjs(selectedTask.endDate).format('DD/MM/YYYY HH:mm')}</div>
                        <div><strong className="text-gray-600">Mô tả:</strong> <div className="mt-1 p-3 bg-gray-50 rounded whitespace-pre-wrap">{selectedTask.description || 'Không có mô tả'}</div></div>
                        <div><strong className="text-gray-600">Ghi chú:</strong> <div className="mt-1 p-3 bg-gray-50 rounded whitespace-pre-wrap">{selectedTask.notes || 'Không có ghi chú'}</div></div>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <div><strong className="text-gray-600">Người thực hiện:</strong> {selectedTask.assignees?.map(a => <Tag color="blue" key={a._id}>{a.name}</Tag>)}</div>
                            </Col>
                            <Col span={12}>
                                <div><strong className="text-gray-600">Người phối hợp:</strong> {selectedTask.collaborators?.map(a => <Tag color="cyan" key={a._id}>{a.name}</Tag>)}</div>
                            </Col>
                        </Row>
                        <div>
                            <strong className="text-gray-600">Tệp đính kèm:</strong>
                            {selectedTask.files && selectedTask.files.length > 0 ? (
                                <div className="flex flex-col gap-2 mt-2">
                                    {selectedTask.files.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                                            <div className="flex items-center gap-2 overflow-hidden mr-2">
                                                <FileTextOutlined className="text-blue-500 flex-shrink-0" />
                                                <span className="truncate" title={file.fileName}>{file.fileName}</span>
                                            </div>
                                            <Space className="flex-shrink-0">
                                                <Button size="small" type="primary" ghost icon={<EyeOutlined />} onClick={() => window.open(`https://drive.google.com/file/d/${file.fileId}/view`, '_blank')} title="Xem file"><span className="hidden sm:inline">Xem</span></Button>
                                                <Button size="small" icon={<ExportOutlined />} onClick={() => {
                                                    const link = document.createElement('a');
                                                    link.href = `https://drive.google.com/uc?export=download&id=${file.fileId}`;
                                                    link.setAttribute('download', '');
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                }} title="Tải xuống"><span className="hidden sm:inline">Tải xuống</span></Button>
                                            </Space>
                                        </div>
                                    ))}
                                </div>
                            ) : <div className="text-gray-400 mt-1">Không có tệp đính kèm</div>}
                        </div>
                        {/* Section: Công việc con (Subtasks) */}
                        {/* Nếu công việc đã hoàn thành và không có việc con thì ẩn hoàn toàn */}
                        {!(selectedTask.status === 'DONE' && (!selectedTask.subtasks || selectedTask.subtasks.length === 0)) && (
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                                            <BranchesOutlined className="text-blue-600 text-lg" /> Danh sách công việc con (Subtasks)
                                        </span>
                                        {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                                            <Tag color={selectedTask.subtasks.every(s => s.status === 'DONE') ? 'green' : 'blue'} className="font-semibold text-xs">
                                                {selectedTask.subtasks.filter(s => s.status === 'DONE').length}/{selectedTask.subtasks.length} hoàn thành
                                            </Tag>
                                        )}
                                    </div>
                                    {/* Chỉ cho phép thêm việc con khi công việc lớn CHƯA hoàn thành */}
                                    {canManageSubtasks && selectedTask.status !== 'DONE' && (
                                        <Button 
                                            type="primary" 
                                            size="small" 
                                            icon={<PlusOutlined />} 
                                            onClick={() => setShowAddSubtaskForm(!showAddSubtaskForm)}
                                            className="bg-blue-600 hover:bg-blue-500 rounded-md"
                                        >
                                            {showAddSubtaskForm ? "Đóng form" : "Thêm việc con"}
                                        </Button>
                                    )}
                                </div>

                                {/* Thanh tiến độ */}
                                {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (() => {
                                    const stats = getSubtaskStats(selectedTask);
                                    if (!stats) return null;
                                    return (
                                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                                            <div className="flex justify-between items-center text-xs text-slate-600 mb-1.5">
                                                <span className="font-medium">Tiến độ hoàn thành các việc con:</span>
                                                <span className="font-bold text-slate-800">
                                                    {stats.done}/{stats.total} ({stats.percent}%)
                                                </span>
                                            </div>
                                            <Progress 
                                                percent={stats.percent} 
                                                status={stats.percent === 100 ? 'success' : 'active'}
                                                strokeColor={stats.percent === 100 ? '#52c41a' : { '0%': '#108ee9', '100%': '#87d068' }}
                                                className="!m-0"
                                            />
                                        </div>
                                    );
                                })()}

                                {/* Form thêm nhanh công việc con (chỉ khi task chưa hoàn thành) */}
                                {selectedTask.status !== 'DONE' && showAddSubtaskForm && (
                                    <div className="bg-white p-3 rounded-lg border border-blue-300 shadow-sm space-y-3">
                                        <div className="font-semibold text-blue-900 text-xs uppercase tracking-wider flex items-center gap-1">
                                            <PlusOutlined /> Phân công công việc con mới
                                        </div>
                                        <Input 
                                            placeholder="Nhập tiêu đề công việc con (ví dụ: Soạn thảo phụ lục, Kiểm tra số liệu...)" 
                                            value={newSubtaskTitle}
                                            onChange={e => setNewSubtaskTitle(e.target.value)}
                                            onPressEnter={() => handleAddSubtaskSubmit(selectedTask)}
                                            className="rounded-md"
                                        />
                                        <Row gutter={[8, 8]}>
                                            <Col xs={24} sm={14}>
                                                <Select 
                                                    placeholder="Chọn người thực hiện việc con" 
                                                    allowClear
                                                    showSearch
                                                    optionFilterProp="label"
                                                    filterOption={filterUserOption}
                                                    value={newSubtaskAssignee}
                                                    onChange={val => setNewSubtaskAssignee(val)}
                                                    className="w-full"
                                                >
                                                    {userGroups.map(group => (
                                                        <Select.OptGroup key={group.key} label={group.label}>
                                                            {group.users.map(u => {
                                                                const labelStr = `${u.name} (${u.email})`;
                                                                return (
                                                                    <Option key={u._id} value={u._id} label={labelStr} name={u.name || ""}>
                                                                        {labelStr}
                                                                    </Option>
                                                                );
                                                            })}
                                                        </Select.OptGroup>
                                                    ))}
                                                </Select>
                                            </Col>
                                            <Col xs={24} sm={10}>
                                                <DatePicker 
                                                    placeholder="Hạn hoàn thành"
                                                    format="DD/MM/YYYY"
                                                    value={newSubtaskEndDate}
                                                    onChange={d => setNewSubtaskEndDate(d)}
                                                    className="w-full"
                                                />
                                            </Col>
                                        </Row>
                                        <div className="flex justify-end gap-2">
                                            <Button size="small" onClick={() => { setShowAddSubtaskForm(false); setNewSubtaskTitle(''); }}>
                                                Hủy
                                            </Button>
                                            <Button 
                                                size="small" 
                                                type="primary" 
                                                loading={isSubmittingSubtask} 
                                                onClick={() => handleAddSubtaskSubmit(selectedTask)}
                                                className="bg-blue-600"
                                            >
                                                Tạo việc con
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* Danh sách công việc con */}
                                {selectedTask.subtasks && selectedTask.subtasks.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedTask.subtasks.map((st) => {
                                            const isDone = st.status === 'DONE';
                                            const isOverdue = !isDone && st.endDate && dayjs(st.endDate).isBefore(dayjs().startOf('day'));
                                            const canEditThisSubtask = selectedTask.status !== 'DONE' && (canManageSubtasks || (st.assignee && (st.assignee._id === userId || st.assignee === userId)));

                                            return (
                                                <div 
                                                    key={st._id} 
                                                    className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 ${
                                                        isDone 
                                                            ? 'bg-emerald-50/40 border-emerald-200' 
                                                            : isOverdue 
                                                            ? 'bg-red-50/40 border-red-200' 
                                                            : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                                        {selectedTask.status === 'DONE' ? (
                                                            <CheckCircleFilled className="text-emerald-500 text-base mt-0.5 flex-shrink-0" />
                                                        ) : (
                                                            <Checkbox 
                                                                checked={isDone} 
                                                                onChange={() => handleToggleSubtaskStatus(selectedTask, st)}
                                                                className="mt-0.5"
                                                                disabled={!canEditThisSubtask}
                                                            />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className={`text-sm font-medium ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                                                {st.title}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                                                                {st.assignee ? (
                                                                    <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                                                                        <UserOutlined /> {st.assignee.name || users.find(u => String(u._id) === String(st.assignee?._id || st.assignee))?.name || 'Người thực hiện'}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400 italic">Chưa phân công</span>
                                                                )}

                                                                {st.endDate && (
                                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${
                                                                        isDone ? 'text-slate-400' : isOverdue ? 'text-red-600 bg-red-50 font-semibold' : 'text-slate-600'
                                                                    }`}>
                                                                        <ClockCircleOutlined /> Hạn: {dayjs(st.endDate).format('DD/MM/YYYY')}
                                                                    </span>
                                                                )}

                                                                {isDone && st.completedAt && (
                                                                    <span className="text-emerald-600 text-[11px] font-medium">
                                                                        ✓ Xong lúc {dayjs(st.completedAt).format('DD/MM HH:mm')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
                                                        {selectedTask.status === 'DONE' ? (
                                                            <Tag color="green" className="font-semibold text-xs m-0 px-2 py-0.5 rounded-full">
                                                                ✓ Hoàn thành
                                                            </Tag>
                                                        ) : (
                                                            <>
                                                                <Select 
                                                                    size="small" 
                                                                    value={st.status} 
                                                                    onChange={(val) => handleChangeSubtaskStatus(selectedTask, st, val)}
                                                                    className="w-28 text-xs"
                                                                    disabled={!canEditThisSubtask}
                                                                >
                                                                    <Option value="TODO"><span className="text-gray-600">Chưa làm</span></Option>
                                                                    <Option value="IN_PROGRESS"><span className="text-blue-600">Đang làm</span></Option>
                                                                    <Option value="DONE"><span className="text-emerald-600 font-semibold">Hoàn thành</span></Option>
                                                                </Select>

                                                                {canManageSubtasks && (
                                                                    <>
                                                                        <Button 
                                                                            size="small" 
                                                                            type="text" 
                                                                            icon={<EditOutlined />} 
                                                                            onClick={() => handleOpenEditSubtask(selectedTask, st)} 
                                                                            className="text-slate-500 hover:text-blue-600"
                                                                            title="Chỉnh sửa việc con"
                                                                        />
                                                                        <Popconfirm
                                                                            title="Xóa công việc con?"
                                                                            description="Bạn có chắc chắn muốn xóa việc con này?"
                                                                            onConfirm={() => handleDeleteSubtask(selectedTask, st._id)}
                                                                            okText="Xóa"
                                                                            cancelText="Hủy"
                                                                            okButtonProps={{ danger: true }}
                                                                        >
                                                                            <Button 
                                                                                size="small" 
                                                                                type="text" 
                                                                                danger 
                                                                                icon={<DeleteOutlined />} 
                                                                                title="Xóa việc con"
                                                                            />
                                                                        </Popconfirm>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 bg-white rounded-lg border border-dashed border-slate-200 text-slate-400 text-xs">
                                        {selectedTask.status === 'DONE' ? 'Không có công việc con nào.' : 'Chưa có công việc con nào. Nhấn "+ Thêm việc con" ở trên để phân chia nhiệm vụ cho người phối hợp.'}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Trao đổi / Thảo luận công việc */}
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <ThreadDiscussionBox 
                                targetType="Task" 
                                targetId={selectedTask._id} 
                                title="Trao đổi công việc & Tiến độ"
                            />
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal Sửa công việc con */}
            <Modal
                title="Chỉnh sửa công việc con"
                open={isEditSubtaskModalVisible}
                onCancel={() => setIsEditSubtaskModalVisible(false)}
                onOk={handleSaveEditSubtask}
                confirmLoading={isSubmittingSubtask}
                okText="Lưu thay đổi"
                cancelText="Hủy"
                width={500}
            >
                <Form form={editSubtaskForm} layout="vertical">
                    <Form.Item name="title" label="Tiêu đề việc con" rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}>
                        <Input placeholder="Tiêu đề công việc con" />
                    </Form.Item>
                    <Form.Item name="assignee" label="Người thực hiện việc con">
                        <Select 
                            allowClear 
                            showSearch 
                            optionFilterProp="label" 
                            filterOption={filterUserOption} 
                            placeholder="Chọn người thực hiện"
                        >
                            {userGroups.map(group => (
                                <Select.OptGroup key={group.key} label={group.label}>
                                    {group.users.map(u => {
                                        const labelStr = `${u.name} (${u.email})`;
                                        return (
                                            <Option key={u._id} value={u._id} label={labelStr} name={u.name || ""}>
                                                {labelStr}
                                            </Option>
                                        );
                                    })}
                                </Select.OptGroup>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="endDate" label="Hạn hoàn thành">
                        <DatePicker format="DD/MM/YYYY" className="w-full" placeholder="Chọn ngày hết hạn" />
                    </Form.Item>
                    <Form.Item name="status" label="Trạng thái">
                        <Select>
                            <Option value="TODO">Chưa làm</Option>
                            <Option value="IN_PROGRESS">Đang làm</Option>
                            <Option value="DONE">Hoàn thành</Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Modal Lịch sử */}
            <Modal
                title={
                    <div className="flex items-center gap-2 font-bold text-gray-800 text-base">
                        <HistoryOutlined className="text-blue-600 text-lg" />
                        <span>Lịch sử cập nhật công việc</span>
                    </div>
                }
                open={isHistoryVisible}
                onCancel={() => setIsHistoryVisible(false)}
                footer={[<Button key="close" onClick={() => setIsHistoryVisible(false)}>Đóng</Button>]}
                width={650}
            >
                {selectedTask && selectedTask.history && selectedTask.history.length > 0 ? (
                    <div className="flex flex-col h-full py-2">
                        <Timeline className="mt-4 flex-grow">
                            {[...selectedTask.history].reverse().slice((historyPage - 1) * 5, historyPage * 5).map((h, i) => {
                                const actionStr = h.action || '';
                                const color = 
                                    actionStr === 'Tạo mới' ? 'green' : 
                                    actionStr.includes('trạng thái') ? 'blue' : 
                                    actionStr.includes('thời gian') || actionStr.includes('hạn') ? 'orange' :
                                    actionStr.includes('người thực hiện') || actionStr.includes('phối hợp') ? 'purple' :
                                    actionStr.includes('Đánh giá') ? 'gold' : 
                                    actionStr.includes('tệp') ? 'cyan' : 'gray';

                                return (
                                    <Timeline.Item key={i} color={color}>
                                        <div className="text-xs text-gray-400 mb-0.5">{dayjs(h.timestamp).format('DD/MM/YYYY HH:mm')}</div>
                                        <div className="font-semibold text-gray-800">
                                            {h.action} - <span className="text-blue-600">{getHistoryUserName(h)}</span>
                                        </div>
                                        <div className="text-sm mt-1 whitespace-pre-line text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100 leading-relaxed font-normal">
                                            {h.details}
                                        </div>
                                    </Timeline.Item>
                                );
                            })}
                        </Timeline>
                        {selectedTask.history.length > 5 && (
                            <div className="mt-4 flex justify-center">
                                <Pagination 
                                    simple 
                                    current={historyPage} 
                                    pageSize={5} 
                                    total={selectedTask.history.length} 
                                    onChange={(page) => setHistoryPage(page)} 
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-6">Chưa có lịch sử cập nhật nào.</div>
                )}
            </Modal>

            {/* Modal Đánh giá KPI theo Phụ lục 4 */}
            <Modal
                title={<div className="flex items-center gap-2 text-amber-600 font-bold"><TrophyOutlined /> Đánh giá & Nghiệm thu KPI Công việc (Phụ lục 4)</div>}
                open={isEvalModalVisible}
                onCancel={() => setIsEvalModalVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setIsEvalModalVisible(false)} disabled={isEvaluating}>Hủy</Button>,
                    <Button key="submit" type="primary" onClick={handleSubmitEvaluate} loading={isEvaluating}>Lưu Đánh Giá</Button>
                ]}
                width={650}
            >
                {evaluatingTask && (() => {
                    const taskType = evaluatingTask.taskType || 'REGULAR';
                    const baseScore = evaluatingTask.baseScore !== undefined ? evaluatingTask.baseScore : (taskType === 'URGENT' ? 12 : 10);
                    const diffRate = evaluatingTask.difficultyRate !== undefined ? evaluatingTask.difficultyRate : 1.0;
                    const maxScore = Number((baseScore * diffRate).toFixed(2));
                    const execScore = Number((baseScore * (0.3 * (evalProgressRate / 100) + 0.7 * (evalQualityRate / 100))).toFixed(2));
                    const actualScore = Number((execScore * diffRate).toFixed(2));

                    return (
                        <div className="space-y-4 py-2">
                            {/* Card thông tin công việc */}
                            <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-sm space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                    <span className="font-bold text-slate-800 text-base">{evaluatingTask.title}</span>
                                    <Tag color={taskType === 'URGENT' ? 'red' : 'blue'} className="mr-0">
                                        {taskType === 'URGENT' ? 'Đột xuất (12đ)' : 'Thường xuyên (10đ)'}
                                    </Tag>
                                </div>
                                {evaluatingTask.outputResult && (
                                    <div className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                        📦 <b>Sản phẩm / Kết quả:</b> {evaluatingTask.outputResult}
                                    </div>
                                )}
                                {evaluatingTask.focusAxis && (
                                    <div className="text-xs text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                        🎯 <b>Trục kết quả trọng tâm:</b> {evaluatingTask.focusAxis}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-1">
                                    <div><span className="text-gray-400">Hạn hoàn thành:</span> <b>{dayjs(evaluatingTask.endDate).format('DD/MM/YYYY HH:mm')}</b></div>
                                    <div><span className="text-gray-400">Hoàn thành thực tế:</span> <b>{evaluatingTask.completedAt ? dayjs(evaluatingTask.completedAt).format('DD/MM/YYYY HH:mm') : 'Chưa có'}</b></div>
                                    <div><span className="text-gray-400">Chủ trì:</span> {evaluatingTask.assignees?.map(a => a.name).join(', ') || 'N/A'}</div>
                                    <div><span className="text-gray-400">Hệ số độ khó:</span> <b>{Math.round(diffRate * 100)}%</b></div>
                                </div>
                            </div>

                            {/* Tiêu chí 1: Tiến độ % (Cột 6 Phụ lục 4 - 30%) */}
                            <div>
                                <div className="text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                                    <span>1. Tiến độ hoàn thành (Trọng số 30% - Cột 6):</span>
                                    <span className="text-blue-600 font-bold">{evalProgressRate}%</span>
                                </div>
                                <Select 
                                    value={evalProgressRate} 
                                    onChange={(v) => {
                                        setEvalProgressRate(v);
                                        // Nếu hoàn thành sớm/đúng hạn và đạt 100% chất lượng -> gợi ý vượt yêu cầu
                                        if (v === 100 && evalQualityRate === 100) setEvalIsExceeded(true);
                                    }}
                                    style={{ width: '100%' }}
                                >
                                    <Option value={100}>100% - Hoàn thành đúng hoặc trước hạn</Option>
                                    <Option value={80}>80% - Chậm 1 đến 3 ngày làm việc</Option>
                                    <Option value={60}>60% - Chậm 4 đến 5 ngày làm việc</Option>
                                    <Option value={0}>0% - Chậm trên 5 ngày làm việc</Option>
                                </Select>
                            </div>

                            {/* Tiêu chí 2: Chất lượng / Kết quả % (Cột 7 Phụ lục 4 - 70%) */}
                            <div>
                                <div className="text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                                    <span>2. Kết quả / Chất lượng sản phẩm (Trọng số 70% - Cột 7):</span>
                                    <span className="text-emerald-600 font-bold">{evalQualityRate}%</span>
                                </div>
                                <Select 
                                    value={evalQualityRate} 
                                    onChange={(v) => {
                                        setEvalQualityRate(v);
                                        setEvalRating(Math.min(5, Math.max(1, Math.round(v / 20))));
                                        if (v === 100 && evalProgressRate === 100) setEvalIsExceeded(true);
                                    }}
                                    style={{ width: '100%' }}
                                >
                                    <Option value={100}>100% - Đạt đầy đủ yêu cầu chất lượng</Option>
                                    <Option value={80}>80% - Đạt yêu cầu, có chỉnh sửa nhỏ</Option>
                                    <Option value={60}>60% - Hoàn thành cơ bản</Option>
                                    <Option value={0}>0% - Không đạt yêu cầu</Option>
                                </Select>
                            </div>

                            {/* Hộp tính điểm trực tiếp theo công thức Phụ lục 4 */}
                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                                <div className="font-semibold text-amber-950 flex items-center justify-between border-b border-amber-200 pb-1">
                                    <span>Bảng tính điểm theo công thức Phụ lục 4:</span>
                                    <span>Điểm tối đa: <b>{maxScore}đ</b></span>
                                </div>
                                <div className="flex items-center justify-between pt-0.5">
                                    <span>Điểm thực hiện (Cột 8) = {baseScore} × (30% × {evalProgressRate}% + 70% × {evalQualityRate}%):</span>
                                    <span className="font-bold text-amber-800">{execScore}đ</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span>Điểm quy đổi thực tế (Cột 9) = {execScore} × {Math.round(diffRate * 100)}%:</span>
                                    <span className="font-bold text-blue-700 text-sm">{actualScore}đ</span>
                                </div>
                            </div>

                            {/* Vượt yêu cầu và điểm thưởng */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                <div className="flex items-center p-2.5 bg-gray-50 rounded border border-gray-200">
                                    <Checkbox 
                                        checked={evalIsExceeded} 
                                        onChange={(e) => setEvalIsExceeded(e.target.checked)}
                                    >
                                        <span className="text-xs font-semibold text-gray-700">
                                            Vượt yêu cầu (Đánh dấu X - Cột 10)
                                        </span>
                                    </Checkbox>
                                </div>
                                <div className="p-2.5 bg-gray-50 rounded border border-gray-200 flex items-center justify-between">
                                    <span className="text-xs font-semibold text-gray-700">Điểm thưởng đề xuất:</span>
                                    <InputNumber 
                                        min={0} 
                                        max={20} 
                                        value={evalBonusScore} 
                                        onChange={(v) => setEvalBonusScore(v || 0)} 
                                        size="small" 
                                        className="w-24"
                                        addonAfter="đ"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="text-xs font-semibold text-gray-700 mb-1">Nhận xét & Góp ý:</div>
                                <Input.TextArea 
                                    rows={2} 
                                    placeholder="Nhập nhận xét về chất lượng sản phẩm, tinh thần phối hợp..."
                                    value={evalFeedback}
                                    onChange={(e) => setEvalFeedback(e.target.value)}
                                />
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            <RecurringTasksModal
                visible={isRecurringModalVisible}
                onClose={() => setIsRecurringModalVisible(false)}
                users={assignableUsers}
                userGroups={userGroups}
                filterUserOption={filterUserOption}
                focusAxes={focusAxes}
                onTaskGenerated={() => loadTasks()}
            />
        </div>
    );
};

export default SchedulePage;
