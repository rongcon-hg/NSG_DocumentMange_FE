import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Card, Row, Col, Statistic, Select, Button, Table, Tag, Progress, 
    Space, Typography, Spin, Empty, Drawer, Tooltip, Badge, Divider, Input,
    DatePicker, Modal, Rate, InputNumber, message, Result, Pagination
} from 'antd';
import { 
    TrophyOutlined, CheckCircleOutlined, ClockCircleOutlined, 
    ExclamationCircleOutlined, ExportOutlined, ReloadOutlined, 
    EyeOutlined, StarFilled, UserOutlined, TeamOutlined, FireOutlined, SearchOutlined,
    SyncOutlined, FilterOutlined, ClearOutlined, SortAscendingOutlined
} from '@ant-design/icons';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { getKpiStats, evaluateTask } from '../../api/taskApi';
import { getAllDepartments } from '../../api/DepartmentAPI';
import { getAllUsers, getUserInfo } from '../../api/auth';

const { Title, Text } = Typography;
const { Option } = Select;

// Helper xóa dấu tiếng Việt phục vụ tìm kiếm thông minh
const removeVietnameseTones = (str) => {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase();
};

const KpiDashboard = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [loading, setLoading] = useState(false);
    const [statsData, setStatsData] = useState(null);
    const [departments, setDepartments] = useState([]);
    const [users, setUsers] = useState([]);

    // Filters
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedDept, setSelectedDept] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [keywordSearch, setKeywordSearch] = useState('');

    // Detail Drawer & Smart Filters
    const [selectedUserDetail, setSelectedUserDetail] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [drawerStatusFilter, setDrawerStatusFilter] = useState('ALL');
    const [drawerKeyword, setDrawerKeyword] = useState('');
    const [drawerRoleFilter, setDrawerRoleFilter] = useState('ALL');
    const [drawerPriorityFilter, setDrawerPriorityFilter] = useState('ALL');
    const [drawerEvalFilter, setDrawerEvalFilter] = useState('ALL');
    const [drawerSortBy, setDrawerSortBy] = useState('DEADLINE_DESC');
    const [drawerCurrentPage, setDrawerCurrentPage] = useState(1);
    const [drawerPageSize, setDrawerPageSize] = useState(5);

    const resetDrawerFilters = useCallback(() => {
        setDrawerStatusFilter('ALL');
        setDrawerKeyword('');
        setDrawerRoleFilter('ALL');
        setDrawerPriorityFilter('ALL');
        setDrawerEvalFilter('ALL');
        setDrawerSortBy('DEADLINE_DESC');
        setDrawerCurrentPage(1);
    }, []);

    const hasActiveDrawerFilters = useMemo(() => {
        return drawerStatusFilter !== 'ALL' || 
            drawerKeyword.trim() !== '' || 
            drawerRoleFilter !== 'ALL' || 
            drawerPriorityFilter !== 'ALL' || 
            drawerEvalFilter !== 'ALL' || 
            drawerSortBy !== 'DEADLINE_DESC';
    }, [drawerStatusFilter, drawerKeyword, drawerRoleFilter, drawerPriorityFilter, drawerEvalFilter, drawerSortBy]);

    // User role & Task evaluation modal state
    const [currentUserRole, setCurrentUserRole] = useState('');
    const [evaluatingTask, setEvaluatingTask] = useState(null);
    const [evalScore, setEvalScore] = useState(80);
    const [evalRating, setEvalRating] = useState(4);
    const [evalFeedback, setEvalFeedback] = useState('');
    const [isEvalModalVisible, setIsEvalModalVisible] = useState(false);
    const [isSubmittingEval, setIsSubmittingEval] = useState(false);

    const [currentUserId, setCurrentUserId] = useState(null);
    const [userDeptId, setUserDeptId] = useState(null);
    const [userDeptCode, setUserDeptCode] = useState(null);

    useEffect(() => {
        const token = Cookies.get("accessToken");
        if (token) {
            try {
                const decoded = jwtDecode(token);
                const role = decoded?.role || '';
                setCurrentUserRole(role);
                const userId = decoded?.userId;
                if (userId) {
                    setCurrentUserId(userId);
                    if (role === 'chuyenvien') {
                        setSelectedUser(userId);
                    }
                    getUserInfo(userId).then(res => {
                        if (res && res.success && res.data) {
                            const dept = res.data.department;
                            const dId = typeof dept === 'object' ? dept?._id : dept;
                            const dCode = typeof dept === 'object' ? dept?.departmentCode : null;
                            setUserDeptId(dId || null);
                            setUserDeptCode(dCode || null);

                            const isUserBGH = role === 'admin' || role === 'manager' || dCode === 'BGH';
                            if (!isUserBGH && dId) {
                                setSelectedDept(dId);
                            }
                        }
                    }).catch(e => {
                        console.error("Error fetching user profile in KpiDashboard:", e);
                    });
                }
            } catch (e) {
                console.error("Error decoding token in KpiDashboard:", e);
            }
        }
    }, []);

    // Nhóm BGH gồm: vai trò admin, manager, hoặc phòng ban BGH
    const isBGH = currentUserRole === 'admin' || currentUserRole === 'manager' || userDeptCode === 'BGH';
    const isChuyenVien = currentUserRole === 'chuyenvien';

    const handleOpenEvaluate = (task) => {
        setEvaluatingTask(task);
        const existing = task.evaluation;
        const score = existing?.score !== undefined ? existing.score : (task.qualityScore || 80);
        const rating = existing?.rating || Math.round(score / 20);
        setEvalRating(rating);
        setEvalScore(score);
        setEvalFeedback(existing?.feedback || '');
        setIsEvalModalVisible(true);
    };

    const handleRatingChange = (val) => {
        setEvalRating(val);
        setEvalScore(val * 20);
    };

    const handleScoreChange = (val) => {
        const s = val !== null ? val : 0;
        setEvalScore(s);
        setEvalRating(Math.min(5, Math.max(1, Math.round(s / 20))));
    };

    const handleSubmitEvaluate = async () => {
        if (!evaluatingTask) return;
        setIsSubmittingEval(true);
        try {
            const taskId = evaluatingTask.taskId || evaluatingTask._id;
            const res = await evaluateTask(taskId, {
                score: evalScore,
                rating: evalRating,
                feedback: evalFeedback
            });
            if (res.success) {
                message.success("Đã lưu đánh giá chất lượng KPI thành công!");
                setIsEvalModalVisible(false);
                await fetchKpiData();
                if (selectedUserDetail) {
                    const updatedDetails = (selectedUserDetail.details || []).map(t => {
                        if ((t.taskId || t._id) === taskId) {
                            return {
                                ...t,
                                evaluation: {
                                    score: evalScore,
                                    rating: evalRating,
                                    feedback: evalFeedback
                                },
                                qualityScore: evalScore,
                                combinedTaskScore: Math.round((t.progressScore * 0.5) + (evalScore * 0.5))
                            };
                        }
                        return t;
                    });
                    setSelectedUserDetail(prev => ({
                        ...prev,
                        details: updatedDetails
                    }));
                }
            }
        } catch (err) {
            console.error("Error evaluating task:", err);
            message.error(err.response?.data?.message || "Lỗi khi lưu đánh giá KPI");
        } finally {
            setIsSubmittingEval(false);
        }
    };

    // Fetch Departments and Users for filters
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [deptRes, userRes] = await Promise.all([
                    getAllDepartments(),
                    getAllUsers()
                ]);
                const deptList = deptRes?.AllDepartment || deptRes?.data || (Array.isArray(deptRes) ? deptRes : []);
                setDepartments(deptList);
                if (userDeptId) {
                    const myDept = deptList.find(d => String(d._id) === String(userDeptId));
                    if (myDept && myDept.departmentCode === 'BGH') {
                        setUserDeptCode('BGH');
                    }
                }

                const rawUsers = userRes?.users || userRes?.data || (Array.isArray(userRes) ? userRes : []);
                // Lọc bỏ nhân viên bị vô hiệu hóa (role null) và tài khoản admin qlvb@nsgpc.edu.vn
                const validUsers = rawUsers.filter(u => {
                    if (!u.role || u.role === null) return false;
                    const email = (u.email || '').trim().toLowerCase();
                    if (email === 'qlvb@nsgpc.edu.vn') return false;
                    return true;
                });
                setUsers(validUsers);
            } catch (err) {
                console.error("Error fetching filter data:", err);
            }
        };
        fetchInitialData();
    }, [userDeptId]);

    // Nếu không thuộc BGH (ví dụ: cappho, staff) -> tự động khóa vào phòng ban của mình
    useEffect(() => {
        if (!isBGH && userDeptId) {
            setSelectedDept(userDeptId);
        }
    }, [isBGH, userDeptId]);

    // Lọc danh sách nhân viên:
    // - Chuyên viên (chuyenvien): BẮT BUỘC chỉ lọc và xem chính mình
    // - Nhóm BGH (admin, manager, hoặc đơn vị BGH): Có thể lọc tất cả nhân viên hoặc lọc theo phòng ban đã chọn
    // - Nhóm cấp phó (cappho): BẮT BUỘC chỉ lọc các nhân viên thuộc đơn vị mình
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            if (!u.role || u.role === null) return false;
            const email = (u.email || '').trim().toLowerCase();
            if (email === 'qlvb@nsgpc.edu.vn') return false;

            if (isChuyenVien) {
                return currentUserId ? String(u._id) === String(currentUserId) : false;
            }

            if (isBGH) {
                if (selectedDept) {
                    const deptId = u.department?._id || u.department;
                    return String(deptId) === String(selectedDept);
                }
                return true;
            } else {
                // cappho: chỉ xem được nhân viên trong phòng ban của mình
                if (!userDeptId) return false;
                const deptId = u.department?._id || u.department;
                return String(deptId) === String(userDeptId);
            }
        });
    }, [users, selectedDept, isBGH, isChuyenVien, currentUserId, userDeptId]);

    // Nếu là chuyên viên -> luôn cố định chọn chính mình
    useEffect(() => {
        if (isChuyenVien && currentUserId) {
            setSelectedUser(currentUserId);
        }
    }, [isChuyenVien, currentUserId]);

    // Tự động hủy chọn nhân viên nếu người đó không nằm trong danh sách được phép lọc (ngoại trừ chuyên viên đã cố định)
    useEffect(() => {
        if (!isChuyenVien && selectedUser && filteredUsers.length > 0) {
            const exists = filteredUsers.some(u => String(u._id) === String(selectedUser));
            if (!exists) {
                setSelectedUser(null);
            }
        }
    }, [filteredUsers, selectedUser, isChuyenVien]);

    const handleDeptChange = (value) => {
        setSelectedDept(value);
        if (value && selectedUser) {
            const belongs = filteredUsers.some(u => {
                const deptId = u.department?._id || u.department;
                return String(u._id) === String(selectedUser) && String(deptId) === String(value);
            });
            if (!belongs) setSelectedUser(null);
        }
    };

    // Fetch KPI Stats
    const fetchKpiData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (selectedMonth) params.month = selectedMonth;
            if (selectedYear) params.year = selectedYear;

            if (isChuyenVien) {
                if (userDeptId) params.departmentId = userDeptId;
                if (currentUserId) params.userId = currentUserId;
            } else if (isBGH) {
                if (selectedDept) params.departmentId = selectedDept;
                if (selectedUser) params.userId = selectedUser;
            } else {
                if (userDeptId) params.departmentId = userDeptId;
                if (selectedUser) params.userId = selectedUser;
            }

            const res = await getKpiStats(params);
            if (res.success && res.data) {
                setStatsData(res.data);
            }
        } catch (err) {
            console.error("Error fetching KPI stats:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, selectedYear, selectedDept, selectedUser, isBGH, isChuyenVien, currentUserId, userDeptId]);

    useEffect(() => {
        fetchKpiData();
    }, [fetchKpiData]);

    const summary = statsData?.summary || {
        totalTasksCount: 0,
        totalCompletedTasks: 0,
        totalInProgressTasks: 0,
        totalOnTimeTasks: 0,
        totalLateTasks: 0,
        totalOverdueTasks: 0,
        overallOnTimeRate: 0,
        overallKpiAverage: 0,
        totalUsersCount: 0
    };

    const leaderboard = statsData?.leaderboard || [];

    const displayLeaderboard = useMemo(() => {
        if (!keywordSearch.trim()) return leaderboard;
        const kw = keywordSearch.trim().toLowerCase();
        return leaderboard.filter(item => {
            const name = (item.user?.name || '').toLowerCase();
            const email = (item.user?.email || '').toLowerCase();
            const dept = (item.user?.department?.departmentName || item.user?.department || '').toLowerCase();
            return name.includes(kw) || email.includes(kw) || dept.includes(kw);
        });
    }, [leaderboard, keywordSearch]);

    // Colors
    const COLORS = {
        onTime: '#52c41a',
        late: '#faad14',
        overdue: '#ff4d4f',
        inProgress: '#1890ff'
    };

    // Chart Data
    const pieData = [
        { name: 'Đang làm', value: summary.totalInProgressTasks || 0, color: COLORS.inProgress },
        { name: 'Đúng hạn', value: summary.totalOnTimeTasks, color: COLORS.onTime },
        { name: 'Trễ hạn', value: summary.totalLateTasks, color: COLORS.late },
        { name: 'Quá hạn chưa xong', value: summary.totalOverdueTasks, color: COLORS.overdue },
    ].filter(item => item.value > 0);

    const topPerformers = leaderboard
        .filter(u => u.totalTasks > 0)
        .slice(0, 7)
        .map(u => ({
            name: u.user?.name || 'N/A',
            kpiScore: u.kpiScore,
            onTimeRate: u.onTimeRate
        }));

    // Rank Helper
    const getRankTag = (rank) => {
        switch (rank) {
            case 'A':
                return <Tag color="green" className="font-bold px-2 py-0.5 text-xs">Hạng A - Xuất sắc</Tag>;
            case 'B':
                return <Tag color="blue" className="font-bold px-2 py-0.5 text-xs">Hạng B - Tốt</Tag>;
            case 'C':
                return <Tag color="orange" className="font-bold px-2 py-0.5 text-xs">Hạng C - Đạt</Tag>;
            default:
                return <Tag color="red" className="font-bold px-2 py-0.5 text-xs">Hạng D - Chưa đạt</Tag>;
        }
    };

    // Export to Excel
    const handleExportExcel = () => {
        if (!leaderboard.length) return;

        const dataToExport = leaderboard.map((row, index) => ({
            "Hạng": index + 1,
            "Họ và tên": row.user?.name || '',
            "Email": row.user?.email || '',
            "Phòng ban": row.user?.department?.departmentName || '',
            "Chức vụ": row.user?.position?.positionName || '',
            "Tổng công việc": row.totalTasks,
            "Chủ trì": row.totalAssignedTasks,
            "Phối hợp": row.totalCollaboratedTasks,
            "Đang làm": row.inProgressTasks || 0,
            "Hoàn thành đúng hạn": row.onTimeTasks,
            "Hoàn thành trễ hạn": row.lateTasks,
            "Quá hạn chưa xong": row.overdueTasks,
            "Tỷ lệ đúng hạn (%)": `${row.onTimeRate}%`,
            "Điểm chất lượng TB": row.averageQualityScore !== null ? `${row.averageQualityScore}/100` : 'Chưa đánh giá',
            "Điểm KPI tổng kết": row.kpiScore,
            "Xếp loại": row.rank === 'A' ? 'Xuất sắc' : row.rank === 'B' ? 'Tốt' : row.rank === 'C' ? 'Đạt' : 'Chưa đạt'
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(dataToExport);

        const wscols = [
            { wch: 6 }, { wch: 25 }, { wch: 25 }, { wch: 22 }, { wch: 18 },
            { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 20 },
            { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 15 }
        ];
        ws['!cols'] = wscols;

        const sheetName = selectedMonth ? `KPI_Thang_${selectedMonth}_${selectedYear}` : `KPI_Nam_${selectedYear}`;
        XLSX.utils.book_append_sheet(wb, ws, "Bang_KPI");
        XLSX.writeFile(wb, `${sheetName}.xlsx`);
    };

    // Filter and paginate tasks inside detail Drawer
    const filteredDrawerTasks = useMemo(() => {
        if (!selectedUserDetail?.details) return [];
        let list = [...selectedUserDetail.details];

        // 1. Lọc theo trạng thái hoàn thành / tiến độ
        if (drawerStatusFilter === 'IN_PROGRESS') {
            list = list.filter(t => t.status !== 'DONE' && !t.isOverdue);
        } else if (drawerStatusFilter === 'ON_TIME') {
            list = list.filter(t => t.isOnTime);
        } else if (drawerStatusFilter === 'LATE') {
            list = list.filter(t => t.isLate);
        } else if (drawerStatusFilter === 'OVERDUE') {
            list = list.filter(t => t.isOverdue);
        }

        // 2. Tìm kiếm thông minh (không dấu, tìm theo tiêu đề, nội dung, phản hồi đánh giá)
        if (drawerKeyword.trim()) {
            const kw = removeVietnameseTones(drawerKeyword.trim());
            list = list.filter(t => {
                const titleNorm = removeVietnameseTones(t.title);
                const descNorm = removeVietnameseTones(t.description);
                const feedbackNorm = removeVietnameseTones(t.evaluation?.feedback);
                return titleNorm.includes(kw) || descNorm.includes(kw) || feedbackNorm.includes(kw);
            });
        }

        // 3. Lọc theo vai trò (Chủ trì / Phối hợp)
        if (drawerRoleFilter !== 'ALL') {
            list = list.filter(t => t.role === drawerRoleFilter);
        }

        // 4. Lọc theo mức độ ưu tiên
        if (drawerPriorityFilter !== 'ALL') {
            list = list.filter(t => t.priority === drawerPriorityFilter);
        }

        // 5. Lọc theo tình trạng chấm điểm KPI
        if (drawerEvalFilter === 'EVALUATED') {
            list = list.filter(t => t.evaluation && t.evaluation.score !== undefined);
        } else if (drawerEvalFilter === 'NOT_EVALUATED') {
            list = list.filter(t => !t.evaluation || t.evaluation.score === undefined);
        }

        // 6. Sắp xếp thông minh
        list.sort((a, b) => {
            if (drawerSortBy === 'DEADLINE_DESC') {
                return new Date(b.endDate || 0) - new Date(a.endDate || 0);
            }
            if (drawerSortBy === 'DEADLINE_ASC') {
                return new Date(a.endDate || 0) - new Date(b.endDate || 0);
            }
            if (drawerSortBy === 'SCORE_DESC') {
                return (b.combinedTaskScore || 0) - (a.combinedTaskScore || 0);
            }
            if (drawerSortBy === 'SCORE_ASC') {
                return (a.combinedTaskScore || 0) - (b.combinedTaskScore || 0);
            }
            if (drawerSortBy === 'LATE_DESC') {
                return (b.daysLate || 0) - (a.daysLate || 0);
            }
            return 0;
        });

        return list;
    }, [
        selectedUserDetail, 
        drawerStatusFilter, 
        drawerKeyword, 
        drawerRoleFilter, 
        drawerPriorityFilter, 
        drawerEvalFilter, 
        drawerSortBy
    ]);

    const paginatedDrawerTasks = useMemo(() => {
        const start = (drawerCurrentPage - 1) * drawerPageSize;
        return filteredDrawerTasks.slice(start, start + drawerPageSize);
    }, [filteredDrawerTasks, drawerCurrentPage, drawerPageSize]);

    // Table columns
    const columns = [
        {
            title: 'Hạng',
            key: 'rank_index',
            width: 70,
            align: 'center',
            render: (_, __, index) => {
                if (index === 0) return <span className="text-xl">🥇</span>;
                if (index === 1) return <span className="text-xl">🥈</span>;
                if (index === 2) return <span className="text-xl">🥉</span>;
                return <span className="font-semibold text-gray-500">{index + 1}</span>;
            }
        },
        {
            title: 'Cán bộ / Nhân viên',
            key: 'user',
            render: (_, record) => (
                <div>
                    <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                        <UserOutlined className="text-blue-500" />
                        {record.user?.name || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">
                        {record.user?.position?.positionName ? `${record.user.position.positionName} - ` : ''}
                        {record.user?.department?.departmentName || record.user?.email}
                    </div>
                </div>
            )
        },
        {
            title: 'Khối lượng việc',
            key: 'workload',
            align: 'center',
            render: (_, record) => (
                <div className="text-xs">
                    <span className="font-bold text-gray-800 text-sm">{record.totalTasks}</span> việc
                    <div className="text-gray-400 mt-0.5">
                        <span>Chính: <b>{record.totalAssignedTasks}</b></span> | <span>Phụ: <b>{record.totalCollaboratedTasks}</b></span>
                    </div>
                </div>
            )
        },
        {
            title: 'Tiến độ hoàn thành',
            key: 'progress_status',
            render: (_, record) => (
                <div className="min-w-[160px]">
                    <div className="flex flex-wrap gap-x-2 text-xs mb-1">
                        {record.inProgressTasks > 0 && <span className="text-blue-600 font-medium">{record.inProgressTasks} đang làm</span>}
                        <span className="text-green-600 font-medium">{record.onTimeTasks} đúng hạn</span>
                        {record.lateTasks > 0 && <span className="text-amber-500 font-medium">{record.lateTasks} trễ hạn</span>}
                        {record.overdueTasks > 0 && <span className="text-red-500 font-bold">{record.overdueTasks} quá hạn</span>}
                    </div>
                    <Progress 
                        percent={record.onTimeRate} 
                        size="small" 
                        status={record.overdueTasks > 0 ? 'exception' : record.onTimeRate >= 80 ? 'success' : 'normal'}
                        strokeColor={record.onTimeRate >= 80 ? '#52c41a' : record.onTimeRate >= 50 ? '#faad14' : '#ff4d4f'}
                    />
                </div>
            )
        },
        {
            title: 'Điểm chất lượng',
            key: 'quality',
            align: 'center',
            render: (_, record) => (
                <div>
                    {record.averageQualityScore !== null ? (
                        <div className="flex items-center justify-center gap-1">
                            <StarFilled className="text-yellow-400 text-sm" />
                            <span className="font-bold text-gray-700">{record.averageQualityScore}</span>
                            <span className="text-xs text-gray-400">/100</span>
                        </div>
                    ) : (
                        <span className="text-xs text-gray-400 italic">Chưa đánh giá</span>
                    )}
                </div>
            )
        },
        {
            title: 'Điểm KPI',
            key: 'kpiScore',
            align: 'center',
            sorter: (a, b) => a.kpiScore - b.kpiScore,
            defaultSortOrder: 'descend',
            render: (_, record) => (
                <div className="flex flex-col items-center">
                    <span className={`text-lg font-bold ${
                        record.kpiScore >= 90 ? 'text-green-600' :
                        record.kpiScore >= 75 ? 'text-blue-600' :
                        record.kpiScore >= 50 ? 'text-orange-500' : 'text-red-500'
                    }`}>
                        {record.kpiScore}
                    </span>
                    <span className="text-[11px] text-gray-400">điểm</span>
                </div>
            )
        },
        {
            title: 'Xếp loại',
            key: 'rank',
            align: 'center',
            render: (_, record) => getRankTag(record.rank)
        },
        {
            title: 'Thao tác',
            key: 'action',
            align: 'center',
            render: (_, record) => (
                <Button 
                    type="link" 
                    size="small" 
                    icon={<EyeOutlined />}
                    onClick={() => {
                        setSelectedUserDetail(record);
                        resetDrawerFilters();
                        setIsDrawerOpen(true);
                    }}
                >
                    Chi tiết
                </Button>
            )
        }
    ];

    return (
        <div className="bg-gray-50 min-h-screen p-4 sm:p-6 space-y-6">
            {/* Header */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <Title level={3} className="!mb-1 flex items-center gap-2 text-gray-800">
                        <TrophyOutlined className="text-amber-500 text-2xl" />
                        {isChuyenVien ? 'Đánh giá & KPI Cá nhân' : 'Báo cáo & Đánh giá KPI Công việc'}
                    </Title>
                    <Text type="secondary" className="text-sm">
                        {isChuyenVien 
                            ? 'Theo dõi tiến độ, tỷ lệ hoàn thành đúng hạn và điểm đánh giá chất lượng công việc cá nhân.'
                            : 'Theo dõi tỷ lệ đúng hạn, điểm chất lượng nghiệm thu và xếp hạng hiệu suất công việc theo định kỳ.'}
                    </Text>
                </div>
                <Space wrap>
                    <Button 
                        icon={<ReloadOutlined />} 
                        onClick={fetchKpiData} 
                        loading={loading}
                    >
                        Làm mới
                    </Button>
                    <Button 
                        type="primary" 
                        icon={<ExportOutlined />} 
                        onClick={handleExportExcel}
                        style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                        disabled={!leaderboard.length}
                    >
                        Xuất Excel
                    </Button>
                </Space>
            </div>

            {/* Filter Bar */}
            <Card className="shadow-sm rounded-xl border border-gray-100" bodyStyle={{ padding: '16px' }}>
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={12} md={6} lg={4}>
                        <div className="text-xs text-gray-500 mb-1 font-medium">Tháng</div>
                        <Select 
                            value={selectedMonth} 
                            onChange={setSelectedMonth} 
                            style={{ width: '100%' }}
                            allowClear
                            placeholder="Cả năm"
                        >
                            {[...Array(12)].map((_, i) => (
                                <Option key={i + 1} value={i + 1}>{`Tháng ${i + 1}`}</Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6} lg={4}>
                        <div className="text-xs text-gray-500 mb-1 font-medium">Năm</div>
                        <DatePicker 
                            picker="year" 
                            value={selectedYear ? dayjs(`${selectedYear}-01-01`) : null} 
                            onChange={(date) => {
                                if (date) setSelectedYear(date.year());
                            }} 
                            placeholder="Nhập hoặc chọn năm"
                            style={{ width: '100%' }}
                            format="YYYY"
                            allowClear={false}
                        />
                    </Col>
                    <Col xs={24} sm={12} md={6} lg={6}>
                        <div className="text-xs text-gray-500 mb-1 font-medium">Phòng ban</div>
                        <Select 
                            value={selectedDept} 
                            onChange={handleDeptChange} 
                            allowClear={isBGH} 
                            disabled={!isBGH}
                            placeholder={isBGH ? "Tất cả phòng ban" : "Phòng ban của tôi"}
                            style={{ width: '100%' }}
                            showSearch
                            optionFilterProp="children"
                        >
                            {(isBGH ? departments : departments.filter(d => String(d._id) === String(userDeptId))).map(d => (
                                <Option key={d._id} value={d._id}>{d.departmentName}</Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6} lg={6}>
                        <div className="text-xs text-gray-500 mb-1 font-medium">Nhân viên</div>
                        <Select 
                            value={selectedUser} 
                            onChange={setSelectedUser} 
                            allowClear={!isChuyenVien} 
                            disabled={isChuyenVien}
                            placeholder={isBGH ? "Tất cả nhân viên" : isChuyenVien ? "Chỉ xem cá nhân" : "Tất cả nhân viên đơn vị"}
                            style={{ width: '100%' }}
                            showSearch
                            optionFilterProp="children"
                        >
                            {filteredUsers.map(u => (
                                <Option key={u._id} value={u._id}>{u.name}</Option>
                            ))}
                        </Select>
                    </Col>
                </Row>
            </Card>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card bordered={false} className="shadow-sm rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white">
                    <Statistic 
                        title={<span className="text-blue-700 font-semibold text-sm flex items-center gap-1.5"><TrophyOutlined /> {isChuyenVien ? 'Điểm KPI cá nhân' : 'KPI Trung bình toàn đơn vị'}</span>}
                        value={summary.overallKpiAverage}
                        suffix={<span className="text-sm font-normal text-gray-500">/ 100</span>}
                        valueStyle={{ color: '#1890ff', fontWeight: 'bold', fontSize: '26px' }}
                    />
                    <div className="mt-2 text-xs text-gray-500">
                        {isChuyenVien ? (
                            <span>Xếp loại: <b>{leaderboard[0]?.rank ? `Hạng ${leaderboard[0].rank}` : 'N/A'}</b></span>
                        ) : (
                            <span>Tính trên <b>{summary.totalUsersCount}</b> cán bộ, nhân viên</span>
                        )}
                    </div>
                </Card>
                <Card bordered={false} className="shadow-sm rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white">
                    <Statistic 
                        title={<span className="text-sky-700 font-semibold text-sm flex items-center gap-1.5"><SyncOutlined /> Đang làm</span>}
                        value={summary.totalInProgressTasks || 0}
                        valueStyle={{ color: '#0284c7', fontWeight: 'bold', fontSize: '26px' }}
                    />
                    <div className="mt-2 text-xs text-gray-500">
                        Công việc đang triển khai trong hạn
                    </div>
                </Card>
                <Card bordered={false} className="shadow-sm rounded-xl border border-green-100 bg-gradient-to-br from-green-50 to-white">
                    <Statistic 
                        title={<span className="text-green-700 font-semibold text-sm flex items-center gap-1.5"><CheckCircleOutlined /> Tỷ lệ đúng hạn</span>}
                        value={summary.overallOnTimeRate}
                        suffix="%"
                        valueStyle={{ color: '#52c41a', fontWeight: 'bold', fontSize: '26px' }}
                    />
                    <div className="mt-2 text-xs text-gray-500">
                        <b>{summary.totalOnTimeTasks}</b> / {summary.totalCompletedTasks} việc hoàn thành đúng hạn
                    </div>
                </Card>
                <Card bordered={false} className="shadow-sm rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white">
                    <Statistic 
                        title={<span className="text-amber-700 font-semibold text-sm flex items-center gap-1.5"><ClockCircleOutlined /> Hoàn thành trễ hạn</span>}
                        value={summary.totalLateTasks}
                        valueStyle={{ color: '#faad14', fontWeight: 'bold', fontSize: '26px' }}
                    />
                    <div className="mt-2 text-xs text-gray-500">
                        Đã hoàn thành nhưng trễ so với hạn định
                    </div>
                </Card>
                <Card bordered={false} className="shadow-sm rounded-xl border border-red-100 bg-gradient-to-br from-red-50 to-white">
                    <Statistic 
                        title={<span className="text-red-700 font-semibold text-sm flex items-center gap-1.5"><ExclamationCircleOutlined /> Quá hạn chưa xong</span>}
                        value={summary.totalOverdueTasks}
                        valueStyle={{ color: '#ff4d4f', fontWeight: 'bold', fontSize: '26px' }}
                    />
                    <div className="mt-2 text-xs text-red-500 font-medium">
                        Cần đôn đốc xử lý gấp
                    </div>
                </Card>
            </div>

            {/* Charts Section */}
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={isChuyenVien ? 24 : 10}>
                    <Card title={isChuyenVien ? "Phân bổ Tiến độ Công việc Cá nhân" : "Phân bổ Tiến độ Công việc"} className="shadow-sm rounded-xl border border-gray-100 h-full">
                        {pieData.length > 0 ? (
                            <div style={{ height: 260 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={85}
                                            paddingAngle={4}
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="py-12"><Empty description="Chưa có dữ liệu phân bổ" /></div>
                        )}
                    </Card>
                </Col>
                {!isChuyenVien && (
                    <Col xs={24} lg={14}>
                        <Card title="Top Nhân viên có Điểm KPI cao nhất" className="shadow-sm rounded-xl border border-gray-100 h-full">
                            {topPerformers.length > 0 ? (
                                <div style={{ height: 260 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={topPerformers} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                                            <YAxis domain={[0, 100]} />
                                            <RechartsTooltip />
                                            <Bar dataKey="kpiScore" name="Điểm KPI" fill="#1890ff" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="py-12"><Empty description="Chưa có dữ liệu xếp hạng" /></div>
                            )}
                        </Card>
                    </Col>
                )}
            </Row>

            {/* Leaderboard Table */}
            <Card 
                title={
                    <div className="flex items-center gap-2">
                        <FireOutlined className="text-orange-500" />
                        <span>{isChuyenVien ? 'Thông Tin Đánh Giá KPI Cá Nhân' : 'Bảng Xếp Hạng & Đánh Giá Hiệu Suất Nhân Viên'}</span>
                    </div>
                } 
                extra={!isChuyenVien && (
                    <Input
                        prefix={<SearchOutlined className="text-gray-400" />}
                        placeholder="Tìm theo tên nhân viên, email..."
                        allowClear
                        value={keywordSearch}
                        onChange={(e) => setKeywordSearch(e.target.value)}
                        style={{ width: 260 }}
                    />
                )}
                className="shadow-sm rounded-xl border border-gray-100"
            >
                <Spin spinning={loading}>
                    <Table 
                        columns={columns} 
                        dataSource={displayLeaderboard} 
                        rowKey={(record) => record.user?._id || Math.random()}
                        pagination={isChuyenVien ? false : { pageSize: 10, showTotal: (total) => `Tổng ${total} nhân viên` }}
                        scroll={{ x: 'max-content' }}
                    />
                </Spin>
            </Card>

            {/* Detail Drawer for Selected User */}
            <Drawer
                title={
                    <div>
                        <div className="text-base font-bold text-gray-800">
                            Chi tiết KPI: {selectedUserDetail?.user?.name}
                        </div>
                        <div className="text-xs text-gray-500 font-normal">
                            Điểm KPI: <b className="text-blue-600">{selectedUserDetail?.kpiScore}</b> | Xếp loại: {selectedUserDetail?.rank}
                        </div>
                    </div>
                }
                width={720}
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
            >
                {selectedUserDetail && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            <div 
                                onClick={() => { setDrawerStatusFilter('ALL'); setDrawerCurrentPage(1); }}
                                className={`p-2.5 rounded-lg text-center cursor-pointer transition-all border ${drawerStatusFilter === 'ALL' ? 'border-gray-800 bg-gray-100 shadow-sm ring-2 ring-gray-400 font-semibold' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                                title="Bấm để xem tất cả công việc"
                            >
                                <div className="text-xs text-gray-500">Tổng công việc</div>
                                <div className="text-base font-bold text-gray-800">{selectedUserDetail.totalTasks}</div>
                            </div>
                            <div 
                                onClick={() => { setDrawerStatusFilter(prev => prev === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS'); setDrawerCurrentPage(1); }}
                                className={`p-2.5 rounded-lg text-center cursor-pointer transition-all border ${drawerStatusFilter === 'IN_PROGRESS' ? 'border-sky-600 bg-sky-100 shadow-sm ring-2 ring-sky-400 font-semibold' : 'border-sky-100 bg-sky-50 hover:bg-sky-100'}`}
                                title="Bấm để lọc công việc đang làm"
                            >
                                <div className="text-xs text-sky-600 font-medium">Đang làm</div>
                                <div className="text-base font-bold text-sky-700">{selectedUserDetail.inProgressTasks || 0}</div>
                            </div>
                            <div 
                                onClick={() => { setDrawerStatusFilter(prev => prev === 'ON_TIME' ? 'ALL' : 'ON_TIME'); setDrawerCurrentPage(1); }}
                                className={`p-2.5 rounded-lg text-center cursor-pointer transition-all border ${drawerStatusFilter === 'ON_TIME' ? 'border-green-600 bg-green-100 shadow-sm ring-2 ring-green-400 font-semibold' : 'border-green-100 bg-green-50 hover:bg-green-100'}`}
                                title="Bấm để lọc công việc đúng hạn"
                            >
                                <div className="text-xs text-green-600 font-medium">Đúng hạn</div>
                                <div className="text-base font-bold text-green-700">{selectedUserDetail.onTimeTasks}</div>
                            </div>
                            <div 
                                onClick={() => { setDrawerStatusFilter(prev => prev === 'LATE' ? 'ALL' : 'LATE'); setDrawerCurrentPage(1); }}
                                className={`p-2.5 rounded-lg text-center cursor-pointer transition-all border ${drawerStatusFilter === 'LATE' ? 'border-amber-600 bg-amber-100 shadow-sm ring-2 ring-amber-400 font-semibold' : 'border-amber-100 bg-amber-50 hover:bg-amber-100'}`}
                                title="Bấm để lọc công việc trễ hạn"
                            >
                                <div className="text-xs text-amber-600 font-medium">Trễ hạn</div>
                                <div className="text-base font-bold text-amber-700">{selectedUserDetail.lateTasks}</div>
                            </div>
                            <div 
                                onClick={() => { setDrawerStatusFilter(prev => prev === 'OVERDUE' ? 'ALL' : 'OVERDUE'); setDrawerCurrentPage(1); }}
                                className={`p-2.5 rounded-lg text-center cursor-pointer transition-all border ${drawerStatusFilter === 'OVERDUE' ? 'border-red-600 bg-red-100 shadow-sm ring-2 ring-red-400 font-semibold' : 'border-red-100 bg-red-50 hover:bg-red-100'}`}
                                title="Bấm để lọc công việc quá hạn"
                            >
                                <div className="text-xs text-red-600 font-medium">Quá hạn</div>
                                <div className="text-base font-bold text-red-700">{selectedUserDetail.overdueTasks}</div>
                            </div>
                        </div>

                        {/* Thanh tìm kiếm thông minh & bộ lọc nâng cao */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                            {/* Ô tìm kiếm thông minh */}
                            <div className="flex flex-col sm:flex-row gap-2 items-center">
                                <Input
                                    prefix={<SearchOutlined className="text-gray-400 mr-1" />}
                                    placeholder="Tìm nhanh tên công việc, nội dung, nhận xét đánh giá..."
                                    value={drawerKeyword}
                                    onChange={(e) => {
                                        setDrawerKeyword(e.target.value);
                                        setDrawerCurrentPage(1);
                                    }}
                                    allowClear
                                    className="flex-1 rounded-lg"
                                />
                                {hasActiveDrawerFilters && (
                                    <Button 
                                        onClick={resetDrawerFilters} 
                                        icon={<ClearOutlined />}
                                        size="middle"
                                        danger
                                        className="shrink-0 text-xs flex items-center"
                                    >
                                        Đặt lại bộ lọc
                                    </Button>
                                )}
                            </div>

                            {/* Các bộ lọc thông minh liên quan */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200/70">
                                {/* Vai trò */}
                                <div>
                                    <div className="text-[11px] text-gray-500 mb-0.5 font-medium flex items-center gap-1">
                                        <UserOutlined /> Vai trò
                                    </div>
                                    <Select
                                        value={drawerRoleFilter}
                                        onChange={(v) => { setDrawerRoleFilter(v); setDrawerCurrentPage(1); }}
                                        style={{ width: '100%' }}
                                        size="small"
                                    >
                                        <Option value="ALL">Tất cả vai trò</Option>
                                        <Option value="assignee">Chủ trì</Option>
                                        <Option value="collaborator">Phối hợp</Option>
                                    </Select>
                                </div>

                                {/* Mức độ ưu tiên */}
                                <div>
                                    <div className="text-[11px] text-gray-500 mb-0.5 font-medium flex items-center gap-1">
                                        <FilterOutlined /> Mức độ ưu tiên
                                    </div>
                                    <Select
                                        value={drawerPriorityFilter}
                                        onChange={(v) => { setDrawerPriorityFilter(v); setDrawerCurrentPage(1); }}
                                        style={{ width: '100%' }}
                                        size="small"
                                    >
                                        <Option value="ALL">Tất cả mức độ</Option>
                                        <Option value="NORMAL">Bình thường</Option>
                                        <Option value="URGENT">Khẩn</Option>
                                        <Option value="FLASH">Thượng khẩn</Option>
                                    </Select>
                                </div>

                                {/* Đánh giá KPI */}
                                <div>
                                    <div className="text-[11px] text-gray-500 mb-0.5 font-medium flex items-center gap-1">
                                        <StarFilled className="text-amber-500 text-[10px]" /> Đánh giá KPI
                                    </div>
                                    <Select
                                        value={drawerEvalFilter}
                                        onChange={(v) => { setDrawerEvalFilter(v); setDrawerCurrentPage(1); }}
                                        style={{ width: '100%' }}
                                        size="small"
                                    >
                                        <Option value="ALL">Tất cả đánh giá</Option>
                                        <Option value="EVALUATED">Đã chấm điểm</Option>
                                        <Option value="NOT_EVALUATED">Chưa chấm điểm</Option>
                                    </Select>
                                </div>

                                {/* Sắp xếp thông minh */}
                                <div>
                                    <div className="text-[11px] text-gray-500 mb-0.5 font-medium flex items-center gap-1">
                                        <SortAscendingOutlined /> Sắp xếp theo
                                    </div>
                                    <Select
                                        value={drawerSortBy}
                                        onChange={(v) => { setDrawerSortBy(v); setDrawerCurrentPage(1); }}
                                        style={{ width: '100%' }}
                                        size="small"
                                    >
                                        <Option value="DEADLINE_DESC">Hạn: Mới nhất</Option>
                                        <Option value="DEADLINE_ASC">Hạn: Cũ nhất</Option>
                                        <Option value="SCORE_DESC">Điểm: Cao → Thấp</Option>
                                        <Option value="SCORE_ASC">Điểm: Thấp → Cao</Option>
                                        <Option value="LATE_DESC">Trễ hạn: Nhiều nhất</Option>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Tiêu đề & Tag bộ lọc đang áp dụng */}
                        <div className="flex justify-between items-center flex-wrap gap-2 pt-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-gray-800 text-sm">
                                    Danh sách công việc
                                </span>
                                <span className="text-xs text-gray-500 font-normal">
                                    (Hiển thị <b>{filteredDrawerTasks.length}</b> / {selectedUserDetail.totalTasks})
                                </span>
                                {drawerStatusFilter !== 'ALL' && (
                                    <Tag color="blue" closable onClose={() => { setDrawerStatusFilter('ALL'); setDrawerCurrentPage(1); }}>
                                        Trạng thái: {
                                            drawerStatusFilter === 'IN_PROGRESS' ? 'Đang làm' :
                                            drawerStatusFilter === 'ON_TIME' ? 'Đúng hạn' :
                                            drawerStatusFilter === 'LATE' ? 'Trễ hạn' : 'Quá hạn'
                                        }
                                    </Tag>
                                )}
                                {drawerRoleFilter !== 'ALL' && (
                                    <Tag color="cyan" closable onClose={() => { setDrawerRoleFilter('ALL'); setDrawerCurrentPage(1); }}>
                                        Vai trò: {drawerRoleFilter === 'assignee' ? 'Chủ trì' : 'Phối hợp'}
                                    </Tag>
                                )}
                                {drawerPriorityFilter !== 'ALL' && (
                                    <Tag color="orange" closable onClose={() => { setDrawerPriorityFilter('ALL'); setDrawerCurrentPage(1); }}>
                                        Mức độ: {drawerPriorityFilter}
                                    </Tag>
                                )}
                                {drawerEvalFilter !== 'ALL' && (
                                    <Tag color="purple" closable onClose={() => { setDrawerEvalFilter('ALL'); setDrawerCurrentPage(1); }}>
                                        {drawerEvalFilter === 'EVALUATED' ? 'Đã chấm điểm' : 'Chưa chấm điểm'}
                                    </Tag>
                                )}
                                {drawerKeyword.trim() && (
                                    <Tag color="gold" closable onClose={() => { setDrawerKeyword(''); setDrawerCurrentPage(1); }}>
                                        Từ khóa: "{drawerKeyword}"
                                    </Tag>
                                )}
                            </div>
                            {hasActiveDrawerFilters && (
                                <Button size="small" type="link" onClick={resetDrawerFilters} className="!p-0 text-blue-600 text-xs">
                                    Xem tất cả ({selectedUserDetail.totalTasks})
                                </Button>
                            )}
                        </div>

                        {filteredDrawerTasks.length > 0 ? (
                            <>
                                <div className="space-y-3">
                                    {paginatedDrawerTasks.map((task, idx) => (
                                        <div key={idx} className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-300 transition-colors">
                                            <div className="flex justify-between items-start gap-2">
                                                <span className="font-semibold text-gray-800 text-sm">{task.title}</span>
                                                <Tag color={task.role === 'assignee' ? 'blue' : 'cyan'}>
                                                    {task.role === 'assignee' ? 'Chủ trì' : 'Phối hợp'}
                                                </Tag>
                                            </div>
                                            {task.description && (
                                                <div className="text-xs text-gray-600 mt-1 bg-gray-50 p-1.5 rounded border border-gray-100 line-clamp-2">
                                                    {task.description}
                                                </div>
                                            )}
                                            <div className="text-xs text-gray-500 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                                                <span>Hạn: <b>{dayjs(task.endDate).format('DD/MM/YYYY HH:mm')}</b></span>
                                                {task.completedAt && <span>Hoàn thành: <b>{dayjs(task.completedAt).format('DD/MM/YYYY HH:mm')}</b></span>}
                                                <span>Mức độ: <Tag size="small" color={task.priority === 'FLASH' ? 'red' : task.priority === 'URGENT' ? 'orange' : 'default'}>{task.priority}</Tag></span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap items-center justify-between border-t border-gray-100 pt-2 text-xs">
                                                <div className="flex items-center gap-2">
                                                    {task.isOnTime && <Tag color="green">Đúng hạn (100đ)</Tag>}
                                                    {task.isLate && <Tag color="orange">Trễ {task.daysLate} ngày ({task.progressScore}đ)</Tag>}
                                                    {task.isOverdue && <Tag color="red">Quá hạn ({task.daysLate} ngày)</Tag>}
                                                    {task.status !== 'DONE' && !task.isOverdue && <Tag color="blue">Đang làm</Tag>}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-gray-500">
                                                        Chất lượng: <b className="text-amber-600">{task.evaluation ? `${task.evaluation.score}đ` : 'Chưa chấm'}</b>
                                                    </div>
                                                    <div className="font-semibold text-gray-700">
                                                        Điểm quy đổi: <span className="text-blue-600">{task.combinedTaskScore}/100</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-center justify-between">
                                                <div className="text-xs text-gray-500">
                                                    {task.evaluation?.feedback ? (
                                                        <span className="italic bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200 text-gray-700">
                                                            💬 "{task.evaluation.feedback}"
                                                        </span>
                                                    ) : null}
                                                </div>
                                                {task.status === 'DONE' && ['admin', 'manager', 'cappho'].includes(currentUserRole) && (
                                                    <Button
                                                        size="small"
                                                        type="link"
                                                        icon={<StarFilled className="text-amber-500" />}
                                                        onClick={() => handleOpenEvaluate(task)}
                                                        className="!px-1 text-xs text-amber-600 font-medium hover:text-amber-700"
                                                    >
                                                        {task.evaluation ? 'Sửa điểm KPI' : 'Chấm điểm KPI'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {filteredDrawerTasks.length > drawerPageSize && (
                                    <div className="flex justify-end pt-3">
                                        <Pagination
                                            current={drawerCurrentPage}
                                            pageSize={drawerPageSize}
                                            total={filteredDrawerTasks.length}
                                            onChange={(page, size) => {
                                                setDrawerCurrentPage(page);
                                                setDrawerPageSize(size);
                                            }}
                                            showSizeChanger
                                            pageSizeOptions={['5', '10', '20']}
                                            showTotal={(total, range) => `${range[0]}-${range[1]} của ${total} công việc`}
                                            size="small"
                                        />
                                    </div>
                                )}
                            </>
                        ) : (
                            <Empty 
                                description={
                                    hasActiveDrawerFilters 
                                        ? "Không tìm thấy công việc nào phù hợp với điều kiện tìm kiếm và bộ lọc" 
                                        : "Không có công việc nào trong kỳ này"
                                } 
                                className="py-8"
                            >
                                {hasActiveDrawerFilters && (
                                    <Button size="small" type="primary" ghost onClick={resetDrawerFilters}>
                                        Xóa bộ lọc để xem tất cả
                                    </Button>
                                )}
                            </Empty>
                        )}
                    </div>
                )}
            </Drawer>

            {/* Modal Chấm điểm KPI nghiệm thu */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base text-gray-800">
                        <StarFilled className="text-amber-500 text-lg" />
                        <span>Chấm điểm chất lượng công việc (KPI)</span>
                    </div>
                }
                open={isEvalModalVisible}
                onCancel={() => setIsEvalModalVisible(false)}
                onOk={handleSubmitEvaluate}
                confirmLoading={isSubmittingEval}
                okText="Lưu đánh giá"
                cancelText="Hủy"
                destroyOnClose
            >
                {evaluatingTask && (
                    <div className="space-y-4 py-2">
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="font-semibold text-gray-800">{evaluatingTask.title}</div>
                            <div className="text-xs text-gray-500 mt-1">
                                Hạn chót: <b>{dayjs(evaluatingTask.endDate).format('DD/MM/YYYY HH:mm')}</b>
                                {evaluatingTask.completedAt && ` • Hoàn thành: ${dayjs(evaluatingTask.completedAt).format('DD/MM/YYYY HH:mm')}`}
                            </div>
                        </div>

                        <div>
                            <div className="text-xs font-semibold text-gray-600 mb-1">Mức độ hài lòng (1 - 5 Sao):</div>
                            <Rate value={evalRating} onChange={handleRatingChange} className="text-2xl text-amber-500" />
                        </div>

                        <div>
                            <div className="text-xs font-semibold text-gray-600 mb-1">Điểm chất lượng (0 - 100 điểm):</div>
                            <InputNumber 
                                min={0} 
                                max={100} 
                                value={evalScore} 
                                onChange={handleScoreChange} 
                                style={{ width: '100%' }} 
                                size="large"
                                addonAfter="/ 100 điểm"
                            />
                            <div className="text-[11px] text-gray-400 mt-1">
                                * Điểm chất lượng chiếm 50% trọng số kết hợp với 50% điểm tiến độ đúng hạn để ra Điểm KPI của công việc.
                            </div>
                        </div>

                        <div>
                            <div className="text-xs font-semibold text-gray-600 mb-1">Nhận xét / Đánh giá sản phẩm (tùy chọn):</div>
                            <Input.TextArea 
                                rows={3} 
                                value={evalFeedback} 
                                onChange={(e) => setEvalFeedback(e.target.value)} 
                                placeholder="Ghi nhận xét về chất lượng sản phẩm, mức độ hoàn thành nhiệm vụ..."
                            />
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default KpiDashboard;
