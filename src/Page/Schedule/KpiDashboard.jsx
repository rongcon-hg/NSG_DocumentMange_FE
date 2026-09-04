import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    Card, Row, Col, Statistic, Select, Button, Table, Tag, Progress, 
    Space, Typography, Spin, Empty, Drawer, Tooltip, Badge, Divider, Input,
    DatePicker, Modal, Rate, InputNumber, message, Result
} from 'antd';
import { 
    TrophyOutlined, CheckCircleOutlined, ClockCircleOutlined, 
    ExclamationCircleOutlined, ExportOutlined, ReloadOutlined, 
    EyeOutlined, StarFilled, UserOutlined, TeamOutlined, FireOutlined, SearchOutlined 
} from '@ant-design/icons';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { getKpiStats, evaluateTask } from '../../api/taskApi';
import { getAllDepartments } from '../../api/DepartmentAPI';
import { getAllUsers } from '../../api/auth';

const { Title, Text } = Typography;
const { Option } = Select;

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

    // Detail Drawer
    const [selectedUserDetail, setSelectedUserDetail] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // User role & Task evaluation modal state
    const [currentUserRole, setCurrentUserRole] = useState('');
    const [evaluatingTask, setEvaluatingTask] = useState(null);
    const [evalScore, setEvalScore] = useState(80);
    const [evalRating, setEvalRating] = useState(4);
    const [evalFeedback, setEvalFeedback] = useState('');
    const [isEvalModalVisible, setIsEvalModalVisible] = useState(false);
    const [isSubmittingEval, setIsSubmittingEval] = useState(false);

    const [userDeptId, setUserDeptId] = useState(null);
    const [userDeptCode, setUserDeptCode] = useState(null);

    useEffect(() => {
        const token = Cookies.get("accessToken");
        if (token) {
            try {
                const decoded = jwtDecode(token);
                setCurrentUserRole(decoded?.role || '');
                const dId = decoded?.department?._id || decoded?.department || null;
                const dCode = decoded?.department?.departmentCode || decoded?.departmentCode || null;
                setUserDeptId(dId);
                setUserDeptCode(dCode);
            } catch (e) {
                console.error("Error decoding token in KpiDashboard:", e);
            }
        }
    }, []);

    // Nhóm BGH gồm: vai trò admin, manager, hoặc phòng ban BGH
    const isBGH = currentUserRole === 'admin' || currentUserRole === 'manager' || userDeptCode === 'BGH';

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

    // Lọc danh sách nhân viên theo phòng ban được chọn (loại trừ tài khoản vô hiệu hóa và admin qlvb)
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            if (!u.role || u.role === null) return false;
            const email = (u.email || '').trim().toLowerCase();
            if (email === 'qlvb@nsgpc.edu.vn') return false;

            if (selectedDept) {
                const deptId = u.department?._id || u.department;
                return String(deptId) === String(selectedDept);
            }
            return true;
        });
    }, [users, selectedDept]);

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
            if (selectedDept) params.departmentId = selectedDept;
            if (selectedUser) params.userId = selectedUser;

            const res = await getKpiStats(params);
            if (res.success && res.data) {
                setStatsData(res.data);
            }
        } catch (err) {
            console.error("Error fetching KPI stats:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, selectedYear, selectedDept, selectedUser]);

    useEffect(() => {
        fetchKpiData();
    }, [fetchKpiData]);

    const summary = statsData?.summary || {
        totalTasksCount: 0,
        totalCompletedTasks: 0,
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
                <div className="min-w-[150px]">
                    <div className="flex justify-between text-xs mb-1">
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
                        setIsDrawerOpen(true);
                    }}
                >
                    Chi tiết
                </Button>
            )
        }
    ];

    if (currentUserRole === 'chuyenvien') {
        return (
            <div className="bg-gray-50 min-h-screen p-8 flex items-center justify-center">
                <Card className="max-w-md w-full text-center shadow-md rounded-2xl p-6">
                    <Result
                        status="403"
                        title="Không có quyền truy cập"
                        subTitle="Chuyên viên không có quyền truy cập trang Báo cáo & Đánh giá KPI."
                        extra={
                            <Button type="primary" onClick={() => window.location.href = '/schedule/all'}>
                                Về trang Công việc
                            </Button>
                        }
                    />
                </Card>
            </div>
        );
    }

    return (
        <div className="bg-gray-50 min-h-screen p-4 sm:p-6 space-y-6">
            {/* Header */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <Title level={3} className="!mb-1 flex items-center gap-2 text-gray-800">
                        <TrophyOutlined className="text-amber-500 text-2xl" />
                        Báo cáo & Đánh giá KPI Công việc
                    </Title>
                    <Text type="secondary" className="text-sm">
                        Theo dõi tỷ lệ đúng hạn, điểm chất lượng nghiệm thu và xếp hạng hiệu suất công việc theo định kỳ.
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
                            allowClear 
                            placeholder="Tất cả nhân viên"
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
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} className="shadow-sm rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white">
                        <Statistic 
                            title={<span className="text-blue-700 font-semibold text-sm flex items-center gap-1.5"><TrophyOutlined /> KPI Trung bình toàn đơn vị</span>}
                            value={summary.overallKpiAverage}
                            suffix={<span className="text-sm font-normal text-gray-500">/ 100</span>}
                            valueStyle={{ color: '#1890ff', fontWeight: 'bold', fontSize: '28px' }}
                        />
                        <div className="mt-2 text-xs text-gray-500">
                            Tính trên <b>{summary.totalUsersCount}</b> cán bộ, nhân viên
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} className="shadow-sm rounded-xl border border-green-100 bg-gradient-to-br from-green-50 to-white">
                        <Statistic 
                            title={<span className="text-green-700 font-semibold text-sm flex items-center gap-1.5"><CheckCircleOutlined /> Tỷ lệ đúng hạn</span>}
                            value={summary.overallOnTimeRate}
                            suffix="%"
                            valueStyle={{ color: '#52c41a', fontWeight: 'bold', fontSize: '28px' }}
                        />
                        <div className="mt-2 text-xs text-gray-500">
                            <b>{summary.totalOnTimeTasks}</b> / {summary.totalCompletedTasks} việc hoàn thành đúng tiến độ
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} className="shadow-sm rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white">
                        <Statistic 
                            title={<span className="text-amber-700 font-semibold text-sm flex items-center gap-1.5"><ClockCircleOutlined /> Hoàn thành trễ hạn</span>}
                            value={summary.totalLateTasks}
                            valueStyle={{ color: '#faad14', fontWeight: 'bold', fontSize: '28px' }}
                        />
                        <div className="mt-2 text-xs text-gray-500">
                            Đã hoàn thành nhưng trễ so với hạn định
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} className="shadow-sm rounded-xl border border-red-100 bg-gradient-to-br from-red-50 to-white">
                        <Statistic 
                            title={<span className="text-red-700 font-semibold text-sm flex items-center gap-1.5"><ExclamationCircleOutlined /> Quá hạn chưa xong</span>}
                            value={summary.totalOverdueTasks}
                            valueStyle={{ color: '#ff4d4f', fontWeight: 'bold', fontSize: '28px' }}
                        />
                        <div className="mt-2 text-xs text-red-500 font-medium">
                            Cần đôn đốc xử lý gấp
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Charts Section */}
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={10}>
                    <Card title="Phân bổ Tiến độ Công việc" className="shadow-sm rounded-xl border border-gray-100 h-full">
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
            </Row>

            {/* Leaderboard Table */}
            <Card 
                title={
                    <div className="flex items-center gap-2">
                        <FireOutlined className="text-orange-500" />
                        <span>Bảng Xếp Hạng & Đánh Giá Hiệu Suất Nhân Viên</span>
                    </div>
                } 
                extra={
                    <Input
                        prefix={<SearchOutlined className="text-gray-400" />}
                        placeholder="Tìm theo tên nhân viên, email..."
                        allowClear
                        value={keywordSearch}
                        onChange={(e) => setKeywordSearch(e.target.value)}
                        style={{ width: 260 }}
                    />
                }
                className="shadow-sm rounded-xl border border-gray-100"
            >
                <Spin spinning={loading}>
                    <Table 
                        columns={columns} 
                        dataSource={displayLeaderboard} 
                        rowKey={(record) => record.user?._id || Math.random()}
                        pagination={{ pageSize: 10, showTotal: (total) => `Tổng ${total} nhân viên` }}
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
                        <Row gutter={[12, 12]}>
                            <Col span={6}>
                                <div className="bg-gray-50 p-3 rounded text-center">
                                    <div className="text-xs text-gray-500">Tổng công việc</div>
                                    <div className="text-lg font-bold">{selectedUserDetail.totalTasks}</div>
                                </div>
                            </Col>
                            <Col span={6}>
                                <div className="bg-green-50 p-3 rounded text-center">
                                    <div className="text-xs text-green-600">Đúng hạn</div>
                                    <div className="text-lg font-bold text-green-700">{selectedUserDetail.onTimeTasks}</div>
                                </div>
                            </Col>
                            <Col span={6}>
                                <div className="bg-amber-50 p-3 rounded text-center">
                                    <div className="text-xs text-amber-600">Trễ hạn</div>
                                    <div className="text-lg font-bold text-amber-700">{selectedUserDetail.lateTasks}</div>
                                </div>
                            </Col>
                            <Col span={6}>
                                <div className="bg-red-50 p-3 rounded text-center">
                                    <div className="text-xs text-red-600">Quá hạn</div>
                                    <div className="text-lg font-bold text-red-700">{selectedUserDetail.overdueTasks}</div>
                                </div>
                            </Col>
                        </Row>

                        <Divider className="my-3" />
                        <Title level={5}>Danh sách công việc trong kỳ</Title>

                        <div className="space-y-3">
                            {selectedUserDetail.details?.map((task, idx) => (
                                <div key={idx} className="p-3 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-300 transition-colors">
                                    <div className="flex justify-between items-start gap-2">
                                        <span className="font-semibold text-gray-800 text-sm">{task.title}</span>
                                        <Tag color={task.role === 'assignee' ? 'blue' : 'cyan'}>
                                            {task.role === 'assignee' ? 'Chủ trì' : 'Phối hợp'}
                                        </Tag>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
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
