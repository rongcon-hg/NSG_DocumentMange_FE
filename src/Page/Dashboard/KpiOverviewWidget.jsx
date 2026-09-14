import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Spin, Empty, Typography, Select, DatePicker, Space, Button, Tag } from 'antd';
import { 
    TrophyOutlined, CheckCircleOutlined, ClockCircleOutlined, 
    ExclamationCircleOutlined, SyncOutlined, ReloadOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import dayjs from 'dayjs';
import { getKpiStats } from '../../api/taskApi';
import { getUserInfo } from '../../api/auth';

const { Text } = Typography;
const { Option } = Select;

const KpiOverviewWidget = ({ refreshKey }) => {
    const navigate = useNavigate();
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [loading, setLoading] = useState(false);
    const [statsData, setStatsData] = useState(null);

    // Filters thời gian
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedQuarter, setSelectedQuarter] = useState(null);
    const [selectedYear, setSelectedYear] = useState(currentYear);

    // User permissions & profile
    const [currentUserRole, setCurrentUserRole] = useState('');
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
                const uId = decoded?.userId || decoded?._id || decoded?.id;
                if (uId) {
                    setCurrentUserId(uId);
                    getUserInfo(uId).then(res => {
                        const u = res?.data || res?.user || res;
                        if (u) {
                            const dept = u.department;
                            const dId = typeof dept === 'object' ? dept?._id : dept;
                            const dCode = typeof dept === 'object' ? dept?.departmentCode : null;
                            if (dId) setUserDeptId(String(dId));
                            if (dCode) setUserDeptCode(dCode);
                        }
                    }).catch(err => console.error("Error fetching user info:", err));
                }
            } catch (err) {
                console.error("Error decoding token in KpiOverviewWidget:", err);
            }
        }
    }, []);

    const isBGH = currentUserRole === 'admin' || currentUserRole === 'manager' || userDeptCode === 'BGH';
    const isCapTruong = !isBGH && (currentUserRole === 'captruong' || currentUserRole === 'staff');
    const isChuyenVien = !isBGH && !isCapTruong;

    const fetchKpiData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (selectedQuarter) params.quarter = selectedQuarter;
            else if (selectedMonth) params.month = selectedMonth;
            if (selectedYear) params.year = selectedYear;

            if (isChuyenVien) {
                if (userDeptId) params.departmentId = userDeptId;
                if (currentUserId) params.userId = currentUserId;
            } else if (!isBGH && userDeptId) {
                params.departmentId = userDeptId;
            }

            const res = await getKpiStats(params);
            if (res && res.success && res.data) {
                setStatsData(res.data);
            }
        } catch (err) {
            console.error("Lỗi lấy dữ liệu KPI Overview:", err);
        } finally {
            setLoading(false);
        }
    }, [selectedQuarter, selectedMonth, selectedYear, isBGH, isChuyenVien, currentUserId, userDeptId]);

    useEffect(() => {
        fetchKpiData();
    }, [fetchKpiData, refreshKey]);

    const summary = statsData?.summary || {
        totalTasksCount: 0,
        totalCompletedTasks: 0,
        totalInProgressTasks: 0,
        totalOnTimeTasks: 0,
        totalLateTasks: 0,
        totalOverdueTasks: 0,
        overallOnTimeRate: 0,
        overallKpiAverage: 0,
        overallKpi70Average: 0,
        totalUsersCount: 0
    };

    const leaderboard = statsData?.leaderboard || [];

    const userPersonalStats = isChuyenVien ? (leaderboard[0] || null) : null;
    const displayKpi70 = isChuyenVien 
        ? (userPersonalStats?.kpiScore70 !== undefined ? userPersonalStats.kpiScore70 : summary.overallKpi70Average)
        : (summary.overallKpi70Average !== undefined ? summary.overallKpi70Average : Number(((summary.overallKpiAverage * 70) / 100).toFixed(1)));
    const displayKpi100 = isChuyenVien
        ? (userPersonalStats?.kpiScore100 !== undefined ? userPersonalStats.kpiScore100 : (userPersonalStats?.kpiScore !== undefined ? userPersonalStats.kpiScore : summary.overallKpiAverage))
        : summary.overallKpiAverage;
    const displayRank = userPersonalStats?.rank;

    const getScoreColor = (score70) => {
        if (score70 >= 63) return '#52c41a'; // Xuất sắc
        if (score70 >= 52.5) return '#1890ff'; // Tốt
        if (score70 >= 35) return '#fa8c16'; // Đạt
        return '#ff4d4f'; // Chưa đạt
    };

    const renderRankBadge = (rank) => {
        switch (rank) {
            case 'A':
                return <Tag color="green" className="font-semibold text-xs mr-0">Hạng A - Xuất sắc</Tag>;
            case 'B':
                return <Tag color="blue" className="font-semibold text-xs mr-0">Hạng B - Tốt</Tag>;
            case 'C':
                return <Tag color="orange" className="font-semibold text-xs mr-0">Hạng C - Đạt</Tag>;
            case 'D':
                return <Tag color="red" className="font-semibold text-xs mr-0">Hạng D - Chưa đạt</Tag>;
            default:
                return <Tag color="default" className="text-xs mr-0">Chưa xếp hạng</Tag>;
        }
    };

    const COLORS = {
        onTime: '#52c41a',
        late: '#faad14',
        overdue: '#ff4d4f',
        inProgress: '#1890ff'
    };

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
            kpiScore70: u.kpiScore70 !== undefined ? u.kpiScore70 : Number(((u.kpiScore * 70) / 100).toFixed(1)),
            kpiScore100: u.kpiScore100 !== undefined ? u.kpiScore100 : u.kpiScore,
            onTimeRate: u.onTimeRate,
            rank: u.rank
        }));

    return (
        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-md mb-6 border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <div>
                    <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2 !mb-0">
                        <TrophyOutlined className="text-amber-500" />
                        {isChuyenVien ? 'Đánh giá & Điểm KPI Cá nhân' : 'Hiệu suất & Điểm KPI Công việc'}
                    </h2>
                    <Text type="secondary" className="text-xs">
                        {isChuyenVien 
                            ? 'Theo dõi tiến độ, tỷ lệ đúng hạn và điểm số KPI theo Thang điểm 70 chuẩn (Phụ lục 4).'
                            : 'Theo dõi tỷ lệ đúng hạn, kết quả thực hiện và bảng điểm KPI theo Thang điểm 70 chuẩn (Phụ lục 4).'}
                    </Text>
                </div>

                {/* Bộ lọc thời gian & Nút làm mới */}
                <Space wrap size="small">
                    <Select 
                        value={selectedQuarter} 
                        onChange={(val) => {
                            setSelectedQuarter(val);
                            if (val) setSelectedMonth(null);
                        }} 
                        size="small"
                        style={{ width: 100 }}
                        allowClear
                        placeholder="Chọn quý"
                    >
                        <Option value={1}>Quý I</Option>
                        <Option value={2}>Quý II</Option>
                        <Option value={3}>Quý III</Option>
                        <Option value={4}>Quý IV</Option>
                    </Select>
                    <Select 
                        value={selectedMonth} 
                        onChange={(val) => {
                            setSelectedMonth(val);
                            if (val) setSelectedQuarter(null);
                        }} 
                        size="small"
                        style={{ width: 105 }}
                        allowClear
                        placeholder="Cả năm"
                    >
                        {[...Array(12)].map((_, i) => (
                            <Option key={i + 1} value={i + 1}>{`Tháng ${i + 1}`}</Option>
                        ))}
                    </Select>
                    <DatePicker 
                        picker="year" 
                        value={selectedYear ? dayjs(`${selectedYear}-01-01`) : null} 
                        onChange={(date) => {
                            if (date) setSelectedYear(date.year());
                        }} 
                        size="small"
                        style={{ width: 85 }}
                        format="YYYY"
                        allowClear={false}
                    />
                    <Button 
                        icon={<ReloadOutlined spin={loading} />} 
                        size="small" 
                        onClick={fetchKpiData}
                        title="Làm mới dữ liệu KPI"
                    >
                        Làm mới
                    </Button>
                </Space>
            </div>

            {loading ? (
                <div className="py-12 flex justify-center items-center">
                    <Spin tip="Đang tải dữ liệu KPI..." />
                </div>
            ) : (
                <>
                    {/* 5 Thẻ thống kê KPI (Theo đúng mẫu hình ảnh & chuẩn Thang điểm 70) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-4">
                        {/* 1. KPI Trung bình toàn đơn vị / Điểm KPI cá nhân */}
                        <Card bordered={false} className="shadow-sm rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/schedule/kpi')}>
                            <Statistic 
                                title={
                                    <span className="text-blue-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5">
                                        <TrophyOutlined /> {isChuyenVien ? 'Điểm KPI cá nhân' : 'KPI Trung bình toàn đơn vị'}
                                    </span>
                                }
                                value={displayKpi70}
                                suffix={<span className="text-xs font-normal text-gray-500">/ 70đ</span>}
                                valueStyle={{ color: getScoreColor(displayKpi70), fontWeight: 'bold', fontSize: '24px' }}
                            />
                            <div className="mt-1 text-[11px] text-gray-500 flex flex-col gap-0.5">
                                <span>Quy đổi: <b className="text-blue-600">{displayKpi100}%</b></span>
                                {isChuyenVien ? (
                                    <div className="mt-0.5 flex items-center gap-1">
                                        <span>Xếp loại:</span> {renderRankBadge(displayRank)}
                                    </div>
                                ) : (
                                    <span>Tính trên <b>{summary.totalUsersCount}</b> cán bộ, GV-NV</span>
                                )}
                            </div>
                        </Card>

                        {/* 2. Đang làm */}
                        <Card bordered={false} className="shadow-sm rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/schedule/inprogress')}>
                            <Statistic 
                                title={<span className="text-sky-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5"><SyncOutlined /> Đang làm</span>}
                                value={summary.totalInProgressTasks || 0}
                                valueStyle={{ color: '#0284c7', fontWeight: 'bold', fontSize: '24px' }}
                            />
                            <div className="mt-1 text-[11px] text-gray-500">
                                Công việc đang triển khai trong hạn
                            </div>
                        </Card>

                        {/* 3. Tỷ lệ đúng hạn */}
                        <Card bordered={false} className="shadow-sm rounded-xl border border-green-100 bg-gradient-to-br from-green-50 to-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/schedule/done')}>
                            <Statistic 
                                title={<span className="text-green-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5"><CheckCircleOutlined /> Tỷ lệ đúng hạn</span>}
                                value={summary.overallOnTimeRate}
                                suffix="%"
                                valueStyle={{ color: '#52c41a', fontWeight: 'bold', fontSize: '24px' }}
                            />
                            <div className="mt-1 text-[11px] text-gray-500">
                                <b>{summary.totalOnTimeTasks}</b> / {summary.totalCompletedTasks} việc hoàn thành đúng hạn
                            </div>
                        </Card>

                        {/* 4. Hoàn thành trễ hạn */}
                        <Card bordered={false} className="shadow-sm rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/schedule/done')}>
                            <Statistic 
                                title={<span className="text-amber-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5"><ClockCircleOutlined /> Hoàn thành trễ hạn</span>}
                                value={summary.totalLateTasks}
                                valueStyle={{ color: '#faad14', fontWeight: 'bold', fontSize: '24px' }}
                            />
                            <div className="mt-1 text-[11px] text-gray-500">
                                Đã hoàn thành nhưng trễ so với hạn định
                            </div>
                        </Card>

                        {/* 5. Quá hạn chưa xong */}
                        <Card bordered={false} className="shadow-sm rounded-xl border border-red-100 bg-gradient-to-br from-red-50 to-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/schedule/inprogress')}>
                            <Statistic 
                                title={<span className="text-red-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5"><ExclamationCircleOutlined /> Quá hạn chưa xong</span>}
                                value={summary.totalOverdueTasks}
                                valueStyle={{ color: '#ff4d4f', fontWeight: 'bold', fontSize: '24px' }}
                            />
                            <div className="mt-1 text-[11px] text-red-500 font-medium">
                                Cần đôn đốc xử lý gấp
                            </div>
                        </Card>
                    </div>

                    {/* 2 Biểu đồ / Khung chi tiết: Phân bổ Tiến độ Công việc & Top Nhân viên / Chi tiết Cá nhân */}
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={isChuyenVien ? 12 : 10}>
                            <Card 
                                title={isChuyenVien ? "Phân bổ Tiến độ Công việc Cá nhân" : "Phân bổ Tiến độ Công việc"} 
                                bordered={false} 
                                className="shadow-sm rounded-xl border border-gray-100 h-full"
                            >
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

                        {isChuyenVien ? (
                            <Col xs={24} lg={12}>
                                <Card 
                                    title="Chi tiết Đánh giá & Hiệu suất Cá nhân" 
                                    bordered={false} 
                                    className="shadow-sm rounded-xl border border-gray-100 h-full"
                                    extra={
                                        <span 
                                            className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer font-medium"
                                            onClick={() => navigate('/schedule/kpi')}
                                        >
                                            Bảng KPI chi tiết &gt;
                                        </span>
                                    }
                                >
                                    {userPersonalStats ? (
                                        <div className="space-y-3 py-1">
                                            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                                                <span className="text-xs text-gray-600">Điểm cơ sở (Giá trị A):</span>
                                                <span className="font-bold text-gray-800 text-sm">{userPersonalStats.valueA || 0}đ</span>
                                            </div>
                                            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                                                <span className="text-xs text-gray-600">Điểm kết quả thực hiện (Giá trị B):</span>
                                                <span className="font-bold text-blue-600 text-sm">{userPersonalStats.valueB || 0}đ</span>
                                            </div>
                                            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                                                <span className="text-xs text-gray-600">Việc hoàn thành vượt yêu cầu:</span>
                                                <span className="font-semibold text-purple-600 text-xs">
                                                    {userPersonalStats.totalExceededTasks || 0} việc (+{userPersonalStats.totalBonusScore || 0}đ thưởng)
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                                                <span className="text-xs text-gray-600">Tỷ lệ hoàn thành đúng hạn:</span>
                                                <span className="font-bold text-green-600 text-sm">{userPersonalStats.onTimeRate || 0}%</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-1">
                                                <span className="text-xs text-gray-600">Xếp loại chuẩn Phụ lục 4:</span>
                                                <div>{renderRankBadge(userPersonalStats.rank)}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-8"><Empty description="Chưa có dữ liệu đánh giá cá nhân trong kỳ này" /></div>
                                    )}
                                </Card>
                            </Col>
                        ) : (
                            <Col xs={24} lg={14}>
                                <Card 
                                    title="Top Nhân viên có Điểm KPI cao nhất" 
                                    bordered={false} 
                                    className="shadow-sm rounded-xl border border-gray-100 h-full"
                                    extra={
                                        <span 
                                            className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer font-medium"
                                            onClick={() => navigate('/schedule/kpi')}
                                        >
                                            Xem tất cả &gt;
                                        </span>
                                    }
                                >
                                    {topPerformers.length > 0 ? (
                                        <div style={{ height: 260 }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={topPerformers} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                                                    <YAxis domain={[0, 70]} />
                                                    <RechartsTooltip 
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                const item = payload[0].payload;
                                                                return (
                                                                    <div className="bg-white p-2.5 rounded shadow-lg border border-gray-200 text-xs space-y-1">
                                                                        <p className="font-bold text-gray-800 mb-1">{item.name}</p>
                                                                        <p className="text-blue-600 font-semibold">Điểm KPI: {item.kpiScore70} / 70đ</p>
                                                                        <p className="text-gray-600">Quy đổi: {item.kpiScore100}%</p>
                                                                        <p className="text-green-600">Đúng hạn: {item.onTimeRate}%</p>
                                                                        <p className="text-gray-700">Xếp loại: <b>Hạng {item.rank}</b></p>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Bar dataKey="kpiScore70" name="Điểm KPI (Thang 70)" fill="#1890ff" radius={[4, 4, 0, 0]} />
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
                </>
            )}
        </div>
    );
};

export default KpiOverviewWidget;

