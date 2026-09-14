import React, { useState, useEffect, useCallback } from 'react';
import { Card, Statistic, Row, Col, Spin, message, Button, Typography, Space } from 'antd';
import { ProfileOutlined, SyncOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { getTasks } from '../../api/taskApi';
import { useNavigate } from 'react-router-dom';
import { useNotificationContext } from '../../context/NotificationContext';

const { Text } = Typography;

const TaskStatsWidget = ({ refreshKey }) => {
    const { userId } = useNotificationContext();
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchTasks = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const res = await getTasks(userId);
            if (res && res.success) {
                setTasks(res.data || []);
            } else {
                setTasks(Array.isArray(res) ? res : (res.tasks || []));
            }
        } catch (error) {
            console.error("Lỗi khi tải công việc", error);
            message.error("Lỗi khi tải công việc");
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks, refreshKey]);

    const totalTasks = tasks.length;
    const todoCount = tasks.filter(t => t.status === 'TODO').length;
    const inProgressCount = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const doneCount = tasks.filter(t => t.status === 'DONE').length;

    const todoRate = totalTasks > 0 ? Math.round((todoCount / totalTasks) * 100) : 0;
    const inProgressRate = totalTasks > 0 ? Math.round((inProgressCount / totalTasks) * 100) : 0;
    const doneRate = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

    const pieData = [
        { name: 'Chưa làm', value: todoCount, color: '#ff4d4f' },
        { name: 'Đang làm', value: inProgressCount, color: '#4096ff' },
        { name: 'Hoàn thành', value: doneCount, color: '#52c41a' },
    ];

    return (
        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-md mb-6 border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <div>
                    <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2 !mb-0">
                        <ProfileOutlined className="text-blue-600" />
                        Thống Kê Công Việc
                    </h2>
                    <Text type="secondary" className="text-xs">
                        Tổng cộng: <b>{totalTasks}</b> công việc | Tỷ lệ hoàn thành: <b className="text-green-600">{doneRate}%</b>
                    </Text>
                </div>

                <Space size="small">
                    <Button 
                        icon={<ReloadOutlined spin={loading} />} 
                        size="small" 
                        onClick={fetchTasks}
                        title="Làm mới danh sách công việc"
                    >
                        Làm mới
                    </Button>
                </Space>
            </div>

            {loading && tasks.length === 0 ? (
                <div className="py-12 flex justify-center items-center">
                    <Spin tip="Đang tải dữ liệu công việc..." />
                </div>
            ) : (
                <>
                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={8}>
                            <Card 
                                bordered={false} 
                                className="shadow-sm bg-red-50 text-red-600 border border-red-100 cursor-pointer hover:shadow-md transition-shadow rounded-xl" 
                                onClick={() => navigate('/schedule/todo')}
                            >
                                <Statistic 
                                    title={<span className="text-red-500 font-semibold text-xs sm:text-sm"><ProfileOutlined /> Chưa làm</span>}
                                    value={todoCount} 
                                    suffix={<span className="text-xs font-normal text-gray-500">({todoRate}%)</span>}
                                    valueStyle={{ color: '#cf1322', fontWeight: 'bold', fontSize: '24px' }} 
                                />
                                <div className="mt-1 text-[11px] text-gray-500">
                                    Công việc chưa bắt đầu thực hiện
                                </div>
                            </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Card 
                                bordered={false} 
                                className="shadow-sm bg-blue-50 text-blue-600 border border-blue-100 cursor-pointer hover:shadow-md transition-shadow rounded-xl" 
                                onClick={() => navigate('/schedule/inprogress')}
                            >
                                <Statistic 
                                    title={<span className="text-blue-500 font-semibold text-xs sm:text-sm"><SyncOutlined spin={inProgressCount > 0} /> Đang làm</span>}
                                    value={inProgressCount} 
                                    suffix={<span className="text-xs font-normal text-gray-500">({inProgressRate}%)</span>}
                                    valueStyle={{ color: '#096dd9', fontWeight: 'bold', fontSize: '24px' }} 
                                />
                                <div className="mt-1 text-[11px] text-gray-500">
                                    Công việc đang trong quá trình thực hiện
                                </div>
                            </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                            <Card 
                                bordered={false} 
                                className="shadow-sm bg-green-50 text-green-600 border border-green-100 cursor-pointer hover:shadow-md transition-shadow rounded-xl" 
                                onClick={() => navigate('/schedule/done')}
                            >
                                <Statistic 
                                    title={<span className="text-green-500 font-semibold text-xs sm:text-sm"><CheckCircleOutlined /> Hoàn thành</span>}
                                    value={doneCount} 
                                    suffix={<span className="text-xs font-normal text-gray-500">({doneRate}%)</span>}
                                    valueStyle={{ color: '#389e0d', fontWeight: 'bold', fontSize: '24px' }} 
                                />
                                <div className="mt-1 text-[11px] text-gray-500">
                                    Công việc đã hoàn thành nghiệm thu
                                </div>
                            </Card>
                        </Col>
                    </Row>

                    <Row gutter={[16, 16]} className="mt-4">
                        <Col xs={24} md={12}>
                            <Card title="Biểu đồ phân bổ" bordered={false} className="shadow-sm border border-gray-100 rounded-xl">
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
                            <Card title="Biểu đồ số lượng" bordered={false} className="shadow-sm border border-gray-100 rounded-xl">
                                <div style={{ height: 250 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={pieData}
                                            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
                </>
            )}
        </div>
    );
};

export default TaskStatsWidget;
