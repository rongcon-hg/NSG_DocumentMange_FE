import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Statistic, Spin, Empty, Typography, Select, DatePicker, Space } from 'antd';
import { 
    TrophyOutlined, CheckCircleOutlined, ClockCircleOutlined, 
    ExclamationCircleOutlined, SyncOutlined
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

const KpiOverviewWidget = () => {
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
    const isChuyenVien = currentUserRole === 'chuyenvien';

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
            kpiScore: u.kpiScore,
            onTimeRate: u.onTimeRate
        }));

    return (
        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-md mb-6 border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <div>
                    <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2 !mb-0">
                        <TrophyOutlined className="text-amber-500" />
                        {isChuyenVien ? 'Đánh giá & KPI Cá nhân' : 'Hiệu suất & Điểm KPI Công việc'}
                    </h2>
                    <Text type="secondary" className="text-xs">
                        {isChuyenVien 
                            ? 'Theo dõi tiến độ, tỷ lệ đúng hạn và xếp hạng KPI của bạn.'
                            : 'Theo dõi tỷ lệ đúng hạn, kết quả thực hiện và xếp hạng KPI của toàn đơn vị.'}
                    </Text>
                </div>

                {/* Bộ lọc thời gian nhanh */}
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
                </Space>
            </div>

            {loading ? (
                <div className="py-12 flex justify-center items-center">
                    <Spin tip="Đang tải dữ liệu KPI..." />
                </div>
            ) : (
                <>
                    {/* 5 Thẻ thống kê KPI (Theo đúng mẫu hình ảnh) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-4">
                        {/* 1. KPI Trung bình toàn đơn vị */}
                        <Card bordered={false} className="shadow-sm rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/schedule/kpi')}>
                            <Statistic 
                                title={<span className="text-blue-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5"><TrophyOutlined /> {isChuyenVien ? 'Điểm KPI cá nhân' : 'KPI Trung bình toàn đơn vị'}</span>}
                                value={summary.overallKpiAverage}
                                suffix={<span className="text-xs font-normal text-gray-500">/ 100</span>}
                                valueStyle={{ color: '#1890ff', fontWeight: 'bold', fontSize: '24px' }}
                            />
                            <div className="mt-1 text-[11px] text-gray-500">
                                {isChuyenVien ? (
                                    <span>Xếp loại: <b>{leaderboard[0]?.rank ? `Hạng ${leaderboard[0].rank}` : 'N/A'}</b></span>
                                ) : (
                                    <span>Tính trên <b>{summary.totalUsersCount}</b> cán bộ, nhân viên</span>
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

                    {/* 2 Biểu đồ: Phân bổ Tiến độ Công việc & Top Nhân viên có Điểm KPI cao nhất */}
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={isChuyenVien ? 24 : 10}>
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

                        {!isChuyenVien && (
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
                </>
            )}
        </div>
    );
};

export default KpiOverviewWidget;
