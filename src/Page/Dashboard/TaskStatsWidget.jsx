import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Spin, message } from 'antd';
import { ProfileOutlined, SyncOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { getTasks } from '../../api/taskApi';

const TaskStatsWidget = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchTasks = async () => {
            setLoading(true);
            try {
                // Fetch all tasks for dashboard
                const data = await getTasks();
                setTasks(Array.isArray(data) ? data : (data.tasks || []));
            } catch (error) {
                console.error("Lỗi khi tải công việc", error);
                message.error("Lỗi khi tải công việc");
            } finally {
                setLoading(false);
            }
        };
        fetchTasks();
    }, []);

    const todoCount = tasks.filter(t => t.status === 'TODO').length;
    const inProgressCount = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const doneCount = tasks.filter(t => t.status === 'DONE').length;

    const pieData = [
        { name: 'Chưa làm', value: todoCount, color: '#ff4d4f' },
        { name: 'Đang làm', value: inProgressCount, color: '#4096ff' },
        { name: 'Hoàn thành', value: doneCount, color: '#52c41a' },
    ];

    if (loading) {
        return <Spin tip="Đang tải dữ liệu công việc..." className="block mx-auto my-8" />;
    }

    return (
        <div className="bg-white p-3 sm:p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Thống kê công việc</h2>
            
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                    <Card bordered={false} className="shadow-sm bg-red-50 text-red-600 border border-red-100">
                        <Statistic 
                            title={<span className="text-red-500 font-semibold text-base"><ProfileOutlined /> Chưa làm</span>}
                            value={todoCount} 
                            valueStyle={{ color: '#cf1322', fontWeight: 'bold' }} 
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} className="shadow-sm bg-blue-50 text-blue-600 border border-blue-100">
                        <Statistic 
                            title={<span className="text-blue-500 font-semibold text-base"><SyncOutlined spin /> Đang làm</span>}
                            value={inProgressCount} 
                            valueStyle={{ color: '#096dd9', fontWeight: 'bold' }} 
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} className="shadow-sm bg-green-50 text-green-600 border border-green-100">
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

export default TaskStatsWidget;
