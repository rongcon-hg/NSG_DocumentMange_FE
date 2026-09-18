import React, { useState, useEffect, useMemo } from 'react';
import {
    Card, Row, Col, Select, Button, Tag, Table, Progress, Rate,
    Statistic, Space, Spin, message, Tabs, Avatar, Alert, Tooltip, Empty
} from 'antd';
import {
    TrophyOutlined, UserOutlined, FileExcelOutlined, ArrowLeftOutlined,
    CheckCircleOutlined, ClockCircleOutlined, StarFilled, BookOutlined,
    FileTextOutlined, FireOutlined, ThunderboltOutlined, RiseOutlined,
    AuditOutlined, CalendarOutlined, SafetyCertificateOutlined, ReloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getAllUsers, getUserInfo } from '../../api/auth';
import { categorizeUsers } from '../../utils/userClassification';
import { removeVietnameseTones } from '../../utils/stringUtils';
import { getStaffScorecard, exportStaffScorecardExcel } from '../../api/staffScorecardApi';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';

const { Option } = Select;

const SCHOOL_YEAR_OPTIONS = [
    { label: 'Năm học 2025 - 2026', value: '2025-2026' },
    { label: 'Năm học 2024 - 2025', value: '2024-2025' },
    { label: 'Năm học 2023 - 2024', value: '2023-2024' },
    { label: 'Năm học 2026 - 2027', value: '2026-2027' },
    { label: 'Năm 2026', value: '2026' },
    { label: 'Năm 2025', value: '2025' }
];

const StaffScorecardPage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [selectedYear, setSelectedYear] = useState('2025-2026');
    const [scorecardData, setScorecardData] = useState(null);

    // Lấy thông tin user hiện tại
    useEffect(() => {
        const token = Cookies.get('accessToken');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                const currentId = decoded._id || decoded.id;
                setSelectedUserId(currentId);
            } catch (e) {
                console.error('Decode token error:', e);
            }
        }
    }, []);

    // Tải danh sách người dùng
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await getAllUsers();
                if (res && Array.isArray(res.users)) {
                    setUsers(res.users);
                } else if (Array.isArray(res)) {
                    setUsers(res);
                }
            } catch (err) {
                console.error('Error fetching users:', err);
            }
        };
        fetchUsers();
    }, []);

    // Phân nhóm người dùng
    const userGroups = useMemo(() => {
        return categorizeUsers(users).filter(g => g.users && g.users.length > 0);
    }, [users]);

    const filterUserOption = (input, option) => {
        const label = option?.label || option?.children || '';
        return removeVietnameseTones(String(label).toLowerCase()).includes(
            removeVietnameseTones(String(input).toLowerCase())
        );
    };

    // Tải dữ liệu hồ sơ số
    const loadScorecard = async () => {
        if (!selectedUserId) return;
        setLoading(true);
        try {
            const res = await getStaffScorecard({
                userId: selectedUserId,
                year: selectedYear
            });
            if (res.success) {
                setScorecardData(res.data);
            } else {
                message.error(res.message || 'Không thể tải hồ sơ cán bộ');
            }
        } catch (error) {
            console.error('Load scorecard error:', error);
            message.error(error?.response?.data?.message || 'Lỗi khi tải hồ sơ đóng góp');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedUserId) {
            loadScorecard();
        }
    }, [selectedUserId, selectedYear]);

    // Xuất Excel
    const handleExportExcel = async () => {
        if (!selectedUserId) return;
        setExporting(true);
        try {
            await exportStaffScorecardExcel({
                userId: selectedUserId,
                year: selectedYear
            });
            message.success('Xuất file báo cáo đóng góp thành công!');
        } catch (err) {
            message.error('Lỗi khi xuất file Excel');
        } finally {
            setExporting(false);
        }
    };

    const summary = scorecardData?.summary || {};
    const userInfo = scorecardData?.user || {};
    const breakdowns = scorecardData?.breakdowns || {};

    const getGradeTag = (grade) => {
        if (grade?.includes('xuất sắc')) {
            return <Tag color="gold" className="text-sm px-3 py-1 font-bold">🏆 {grade}</Tag>;
        }
        if (grade?.includes('tốt')) {
            return <Tag color="green" className="text-sm px-3 py-1 font-bold">🌟 {grade}</Tag>;
        }
        if (grade?.includes('Không')) {
            return <Tag color="red" className="text-sm px-3 py-1 font-bold">⚠️ {grade}</Tag>;
        }
        return <Tag color="blue" className="text-sm px-3 py-1 font-bold">✓ {grade || 'Hoàn thành nhiệm vụ'}</Tag>;
    };

    // Cột danh sách công việc đã hoàn thành
    const taskColumns = [
        {
            title: 'Tiêu đề công việc',
            dataIndex: 'title',
            key: 'title',
            render: (text, record) => (
                <div>
                    <div className="font-semibold text-slate-800">{text}</div>
                    {record.outputResult && (
                        <div className="text-xs text-blue-600 mt-0.5">
                            🏷 Sản phẩm: {record.outputResult}
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Loại việc',
            dataIndex: 'taskType',
            key: 'taskType',
            width: 120,
            render: (val) => val === 'URGENT'
                ? <Tag color="red" className="font-medium">Khẩn cấp</Tag>
                : <Tag color="blue" className="font-medium">Thường xuyên</Tag>
        },
        {
            title: 'Hệ số độ khó',
            dataIndex: 'difficultyRate',
            key: 'difficultyRate',
            width: 110,
            align: 'center',
            render: (val) => <Tag color="purple">x{val || 1.0}</Tag>
        },
        {
            title: 'Điểm KPI',
            key: 'kpi',
            width: 130,
            render: (_, record) => {
                const ev = record.evaluation;
                if (!ev || ev.score === undefined) {
                    return <span className="text-gray-400 text-xs italic">Chưa chấm</span>;
                }
                return (
                    <div>
                        <span className="font-bold text-emerald-600 text-sm">{ev.score} đ</span>
                        {ev.rating && (
                            <div className="flex items-center gap-0.5 text-xs text-amber-500">
                                <StarFilled /> {ev.rating}/5
                            </div>
                        )}
                        {ev.bonusScore > 0 && (
                            <span className="text-[11px] text-orange-500 block">+{ev.bonusScore} thưởng</span>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Người đánh giá',
            key: 'evaluatedBy',
            width: 140,
            render: (_, record) => record.evaluation?.evaluatedBy?.name || '—'
        }
    ];

    // Cột danh hiệu thi đua
    const emulationColumns = [
        {
            title: 'Tên danh hiệu / Khen thưởng',
            dataIndex: 'titleName',
            key: 'titleName',
            render: (text) => <span className="font-semibold text-slate-800">{text}</span>
        },
        {
            title: 'Cấp khen thưởng',
            dataIndex: 'rewardLevel',
            key: 'rewardLevel',
            width: 180,
            render: (val) => val ? <Tag color="gold">{val}</Tag> : '—'
        },
        {
            title: 'Số quyết định',
            dataIndex: 'decisionNumber',
            key: 'decisionNumber',
            width: 160,
            render: (val) => val ? <Tag color="geekblue">{val}</Tag> : '—'
        },
        {
            title: 'Ngày quyết định',
            dataIndex: 'decisionDate',
            key: 'decisionDate',
            width: 140,
            render: (val) => val ? new Date(val).toLocaleDateString('vi-VN') : '—'
        }
    ];

    // Cột đào tạo bồi dưỡng
    const trainingColumns = [
        {
            title: 'Tên khóa bồi dưỡng / Học tập',
            dataIndex: 'courseName',
            key: 'courseName',
            render: (text) => <span className="font-semibold text-slate-800">{text}</span>
        },
        {
            title: 'Đơn vị tổ chức',
            dataIndex: 'organizer',
            key: 'organizer',
            width: 220,
            render: (val) => val || '—'
        },
        {
            title: 'Thời gian hoàn thành',
            dataIndex: 'completionDate',
            key: 'completionDate',
            width: 150,
            render: (val) => val ? new Date(val).toLocaleDateString('vi-VN') : '—'
        },
        {
            title: 'Kết quả / Xếp loại',
            dataIndex: 'result',
            key: 'result',
            width: 150,
            render: (val) => <Tag color="green">{val || 'Hoàn thành'}</Tag>
        }
    ];

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-5">
            {/* Thanh điều hướng & bộ lọc */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80">
                <div className="flex items-center gap-3">
                    <Button
                        icon={<ArrowLeftOutlined />}
                        onClick={() => navigate('/schedule')}
                        className="border-slate-300 hover:border-slate-400"
                    >
                        Quay lại
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2 m-0">
                            <TrophyOutlined className="text-amber-500" />
                            Hồ Sơ Đóng Góp Số Cán Bộ
                        </h1>
                        <p className="text-xs text-slate-500 m-0 mt-0.5">
                            Tổng hợp đa chiều đóng góp, KPI, thi đua & đào tạo phục vụ đánh giá tổng kết
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {/* Chọn cán bộ */}
                    <div className="min-w-[220px]">
                        <Select
                            showSearch
                            placeholder="Chọn cán bộ"
                            value={selectedUserId}
                            onChange={setSelectedUserId}
                            optionFilterProp="label"
                            filterOption={filterUserOption}
                            className="w-full"
                        >
                            {userGroups.map(group => (
                                <Select.OptGroup key={group.key} label={group.label}>
                                    {group.users.map(u => (
                                        <Option key={u._id} value={u._id} label={`${u.name} (${u.email})`}>
                                            {u.name} ({u.email})
                                        </Option>
                                    ))}
                                </Select.OptGroup>
                            ))}
                        </Select>
                    </div>

                    {/* Chọn năm học */}
                    <Select
                        value={selectedYear}
                        onChange={setSelectedYear}
                        options={SCHOOL_YEAR_OPTIONS}
                        className="w-[180px]"
                    />

                    {/* Nút Reload */}
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={loadScorecard}
                        loading={loading}
                    />

                    {/* Nút Xuất Excel */}
                    <Button
                        type="primary"
                        icon={<FileExcelOutlined />}
                        onClick={handleExportExcel}
                        loading={exporting}
                        className="bg-emerald-600 hover:bg-emerald-700 border-none font-medium flex items-center gap-1 shadow-sm"
                    >
                        Xuất Excel Hồ Sơ
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <Spin size="large" />
                    <span className="text-slate-500 font-medium text-sm">Đang tổng hợp dữ liệu hồ sơ số...</span>
                </div>
            ) : !scorecardData ? (
                <Empty description="Chưa có dữ liệu hồ sơ đóng góp cho cán bộ này" />
            ) : (
                <>
                    {/* Header Card: Thông tin Cán bộ & Xếp loại */}
                    <Card className="rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
                        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 p-2">
                            <div className="flex items-center gap-4">
                                <Avatar
                                    size={72}
                                    src={userInfo.avatar}
                                    icon={<UserOutlined />}
                                    className="border-2 border-white/30 shadow-lg bg-blue-700"
                                />
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-2xl font-bold text-white m-0">{userInfo.name}</h2>
                                        <Tag color="cyan" className="font-semibold text-xs">{userInfo.position}</Tag>
                                    </div>
                                    <div className="text-sm text-blue-200 mt-1 flex items-center gap-3 flex-wrap">
                                        <span>🏢 {userInfo.department}</span>
                                        <span>✉️ {userInfo.email}</span>
                                        <span>📅 {scorecardData.period?.label}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-center lg:items-end bg-white/10 backdrop-blur-md px-6 py-3.5 rounded-2xl border border-white/20">
                                <div className="text-xs uppercase tracking-wider text-blue-200 font-semibold mb-1">
                                    Đánh giá & Xếp loại thi đua
                                </div>
                                <div>{getGradeTag(summary.overallGrade)}</div>
                                <div className="text-[11px] text-blue-200/80 mt-1">
                                    Tỷ lệ hoàn thành: <b>{summary.completionRate}%</b> | Đúng hạn: <b>{summary.onTimeRate}%</b>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* 4 Thẻ Thống Kê Chính */}
                    <Row gutter={[16, 16]}>
                        {/* Thẻ 1: Khối lượng công việc */}
                        <Col xs={24} sm={12} lg={6}>
                            <Card className="rounded-xl border border-slate-200 shadow-sm h-full hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between text-slate-500 mb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider">Công việc được giao</span>
                                    <CheckCircleOutlined className="text-blue-500 text-lg" />
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-extrabold text-slate-800">{summary.completedTasks || 0}</span>
                                    <span className="text-xs text-slate-500">/ {summary.totalTasks || 0} việc</span>
                                </div>
                                <div className="mt-3">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-500">Tỷ lệ hoàn thành</span>
                                        <span className="font-semibold text-blue-600">{summary.completionRate || 0}%</span>
                                    </div>
                                    <Progress percent={summary.completionRate || 0} strokeColor="#2563eb" showInfo={false} size="small" />
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
                                    <span>Đúng hạn: <b className="text-emerald-600">{summary.onTimeTasks || 0}</b></span>
                                    <span>Trễ hạn: <b className="text-rose-500">{summary.lateTasks || 0}</b></span>
                                </div>
                            </Card>
                        </Col>

                        {/* Thẻ 2: Điểm đánh giá KPI */}
                        <Col xs={24} sm={12} lg={6}>
                            <Card className="rounded-xl border border-slate-200 shadow-sm h-full hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between text-slate-500 mb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider">Điểm KPI Trung bình</span>
                                    <StarFilled className="text-amber-500 text-lg" />
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-extrabold text-amber-500">{summary.avgKpiScore || 0}</span>
                                    <span className="text-xs text-slate-500">/ 100 điểm</span>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <Rate disabled allowHalf value={summary.avgRating || 0} className="text-xs text-amber-500" />
                                    <span className="text-xs font-semibold text-slate-600">{summary.avgRating || 0}/5★</span>
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
                                    <span>Đã chấm: <b>{summary.evaluatedCount || 0} việc</b></span>
                                    <span>Điểm thưởng: <b className="text-orange-500">+{summary.bonusScoreTotal || 0}</b></span>
                                </div>
                            </Card>
                        </Col>

                        {/* Thẻ 3: Thành tích thi đua */}
                        <Col xs={24} sm={12} lg={6}>
                            <Card className="rounded-xl border border-slate-200 shadow-sm h-full hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between text-slate-500 mb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider">Thi đua & Khen thưởng</span>
                                    <TrophyOutlined className="text-orange-500 text-lg" />
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-extrabold text-orange-600">{summary.emulationCount || 0}</span>
                                    <span className="text-xs text-slate-500">danh hiệu / thành tích</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                                    Ghi nhận từ hệ thống Thi đua - Khen thưởng cấp cơ sở, Sở và Thành phố.
                                </p>
                                <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                                    {summary.emulationCount > 0 ? (
                                        <span className="text-emerald-600 font-semibold">✓ Đạt danh hiệu năm học</span>
                                    ) : (
                                        <span className="text-gray-400">Chưa ghi nhận danh hiệu</span>
                                    )}
                                </div>
                            </Card>
                        </Col>

                        {/* Thẻ 4: Đào tạo & Văn bản */}
                        <Col xs={24} sm={12} lg={6}>
                            <Card className="rounded-xl border border-slate-200 shadow-sm h-full hover:shadow-md transition-shadow">
                                <div className="flex items-center justify-between text-slate-500 mb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider">Bồi dưỡng & Văn bản</span>
                                    <BookOutlined className="text-indigo-500 text-lg" />
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-extrabold text-indigo-600">{summary.trainingCount || 0}</span>
                                    <span className="text-xs text-slate-500">khóa bồi dưỡng</span>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                                    <span>Văn bản đã ban hành/gửi:</span>
                                    <b className="text-slate-800">{summary.sentDocsCount || 0}</b>
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between text-[11px] text-slate-500">
                                    <span>Văn bản ký duyệt: <b>{summary.signedDocsCount || 0}</b></span>
                                    <span className="text-indigo-600 font-medium">Hồ sơ số đồng bộ</span>
                                </div>
                            </Card>
                        </Col>
                    </Row>

                    {/* Phân Tích Chuyên Sâu (Breakdowns) */}
                    <Row gutter={[16, 16]}>
                        <Col xs={24} md={8}>
                            <Card title="Phân loại tính chất việc" size="small" className="rounded-xl border border-slate-200 shadow-sm h-full">
                                <div className="space-y-3 py-1">
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-600">Việc Thường xuyên</span>
                                            <span className="font-bold text-blue-600">{breakdowns.taskType?.regular || 0} việc</span>
                                        </div>
                                        <Progress
                                            percent={summary.totalTasks > 0 ? Math.round(((breakdowns.taskType?.regular || 0) / summary.totalTasks) * 100) : 0}
                                            strokeColor="#3b82f6"
                                            size="small"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-600">Việc Khẩn cấp / Đột xuất</span>
                                            <span className="font-bold text-rose-600">{breakdowns.taskType?.urgent || 0} việc</span>
                                        </div>
                                        <Progress
                                            percent={summary.totalTasks > 0 ? Math.round(((breakdowns.taskType?.urgent || 0) / summary.totalTasks) * 100) : 0}
                                            strokeColor="#ef4444"
                                            size="small"
                                        />
                                    </div>
                                </div>
                            </Card>
                        </Col>

                        <Col xs={24} md={8}>
                            <Card title="Độ khó nhiệm vụ (Phụ lục 4)" size="small" className="rounded-xl border border-slate-200 shadow-sm h-full">
                                <div className="space-y-2 py-1 text-xs">
                                    <div className="flex justify-between items-center p-1.5 rounded bg-slate-50">
                                        <span>Độ khó 1.0 (Thông thường):</span>
                                        <Tag color="default" className="font-bold">{breakdowns.difficulty?.['1.0'] || 0} việc</Tag>
                                    </div>
                                    <div className="flex justify-between items-center p-1.5 rounded bg-blue-50">
                                        <span>Độ khó 1.1 (Phức tạp / Liên phòng):</span>
                                        <Tag color="blue" className="font-bold">{breakdowns.difficulty?.['1.1'] || 0} việc</Tag>
                                    </div>
                                    <div className="flex justify-between items-center p-1.5 rounded bg-purple-50">
                                        <span>Độ khó 1.2 (Rất phức tạp / Chiến lược):</span>
                                        <Tag color="purple" className="font-bold">{breakdowns.difficulty?.['1.2'] || 0} việc</Tag>
                                    </div>
                                </div>
                            </Card>
                        </Col>

                        <Col xs={24} md={8}>
                            <Card title="4 Trục Trọng Tâm Công Tác" size="small" className="rounded-xl border border-slate-200 shadow-sm h-full">
                                <div className="space-y-1.5 py-1 text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600 truncate pr-2">Trục 1: Kinh tế - Xã hội & CT:</span>
                                        <Tag color="blue" className="font-bold">{breakdowns.focusAxis?.['TRUC_1'] || 0}</Tag>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600 truncate pr-2">Trục 2: Thể chế & Phân cấp:</span>
                                        <Tag color="cyan" className="font-bold">{breakdowns.focusAxis?.['TRUC_2'] || 0}</Tag>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600 truncate pr-2">Trục 3: KHCN, ĐMST & CĐS:</span>
                                        <Tag color="purple" className="font-bold">{breakdowns.focusAxis?.['TRUC_3'] || 0}</Tag>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600 truncate pr-2">Trục 4: Hạ tầng, Đô thị & GD:</span>
                                        <Tag color="orange" className="font-bold">{breakdowns.focusAxis?.['TRUC_4'] || 0}</Tag>
                                    </div>
                                </div>
                            </Card>
                        </Col>
                    </Row>

                    {/* Chi tiết theo Tabs */}
                    <Card className="rounded-2xl shadow-sm border border-slate-200">
                        <Tabs
                            defaultActiveKey="tasks"
                            items={[
                                {
                                    key: 'tasks',
                                    label: (
                                        <span className="flex items-center gap-2 font-medium">
                                            <CheckCircleOutlined />
                                            Công việc hoàn thành ({scorecardData.keyCompletedTasks?.length || 0})
                                        </span>
                                    ),
                                    children: (
                                        <Table
                                            columns={taskColumns}
                                            dataSource={scorecardData.keyCompletedTasks || []}
                                            rowKey="_id"
                                            pagination={{ pageSize: 6 }}
                                            size="middle"
                                        />
                                    )
                                },
                                {
                                    key: 'emulation',
                                    label: (
                                        <span className="flex items-center gap-2 font-medium">
                                            <TrophyOutlined />
                                            Thành tích Thi đua ({scorecardData.emulationAchievements?.length || 0})
                                        </span>
                                    ),
                                    children: (
                                        <Table
                                            columns={emulationColumns}
                                            dataSource={scorecardData.emulationAchievements || []}
                                            rowKey="_id"
                                            pagination={{ pageSize: 6 }}
                                            size="middle"
                                        />
                                    )
                                },
                                {
                                    key: 'training',
                                    label: (
                                        <span className="flex items-center gap-2 font-medium">
                                            <BookOutlined />
                                            Đào tạo bồi dưỡng ({scorecardData.trainingCourses?.length || 0})
                                        </span>
                                    ),
                                    children: (
                                        <Table
                                            columns={trainingColumns}
                                            dataSource={scorecardData.trainingCourses || []}
                                            rowKey="_id"
                                            pagination={{ pageSize: 6 }}
                                            size="middle"
                                        />
                                    )
                                }
                            ]}
                        />
                    </Card>
                </>
            )}
        </div>
    );
};

export default StaffScorecardPage;
