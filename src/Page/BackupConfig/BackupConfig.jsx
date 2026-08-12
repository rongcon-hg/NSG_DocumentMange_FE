import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, Table, message, Modal, Space, Tag, Typography } from 'antd';
import { DatabaseOutlined, SaveOutlined, ReloadOutlined, HistoryOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import axiosInstance from '../../api/axiosInstance';

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;

const BackupConfig = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [backupLoading, setBackupLoading] = useState(false);
    const [histories, setHistories] = useState([]);
    const [restoreModalVisible, setRestoreModalVisible] = useState(false);
    const [restoreOtp, setRestoreOtp] = useState('');
    const [selectedFileId, setSelectedFileId] = useState(null);
    const [otpLoading, setOtpLoading] = useState(false);
    const [restoreLoading, setRestoreLoading] = useState(false);

    useEffect(() => {
        fetchConfig();
        fetchHistory();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await axiosInstance.get('/api/backup/config');
            if (res.data.success && res.data.data) {
                form.setFieldsValue({
                    folderId: res.data.data.folderId || '1Q_gZeAqZW8x58pc2cuZVSCLrlfowDx8Z',
                    schedule: res.data.data.schedule || 'none'
                });
            }
        } catch (error) {
            console.error('Fetch config error:', error);
        }
    };

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get('/api/backup/history');
            if (res.data.success) {
                setHistories(res.data.data);
            }
        } catch (error) {
            console.error('Fetch history error:', error);
        } finally {
            setLoading(false);
        }
    };

    const onSaveConfig = async (values) => {
        try {
            const res = await axiosInstance.put('/api/backup/config', values);
            if (res.data.success) {
                message.success('Đã lưu cấu hình sao lưu');
            }
        } catch (error) {
            message.error(error.response?.data?.message || 'Lỗi lưu cấu hình');
        }
    };

    const handleManualBackup = async () => {
        confirm({
            title: 'Xác nhận sao lưu thủ công?',
            icon: <ExclamationCircleOutlined />,
            content: 'Quá trình sao lưu sẽ mất một chút thời gian tùy thuộc vào dung lượng dữ liệu.',
            async onOk() {
                setBackupLoading(true);
                try {
                    const res = await axiosInstance.post('/api/backup/manual');
                    if (res.data.success) {
                        message.success('Sao lưu thành công!');
                        fetchHistory();
                    }
                } catch (error) {
                    message.error(error.response?.data?.message || 'Lỗi sao lưu');
                } finally {
                    setBackupLoading(false);
                }
            },
        });
    };

    const handleRequestRestore = async (fileId) => {
        setSelectedFileId(fileId);
        setOtpLoading(true);
        try {
            const res = await axiosInstance.post('/api/backup/restore/request-otp');
            if (res.data.success) {
                message.success(res.data.message);
                setRestoreModalVisible(true);
            }
        } catch (error) {
            message.error(error.response?.data?.message || 'Không thể yêu cầu mã OTP');
        } finally {
            setOtpLoading(false);
        }
    };

    const handleVerifyRestore = async () => {
        if (!restoreOtp) {
            message.warning('Vui lòng nhập mã xác nhận');
            return;
        }
        setRestoreLoading(true);
        try {
            const res = await axiosInstance.post('/api/backup/restore/verify', {
                otp: restoreOtp,
                fileId: selectedFileId
            });
            if (res.data.success) {
                message.success(res.data.message);
                setRestoreModalVisible(false);
                setRestoreOtp('');
                
                // Buộc user đăng nhập lại sau khi khôi phục do db bị ghi đè hoàn toàn
                setTimeout(() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                }, 3000);
            }
        } catch (error) {
            message.error(error.response?.data?.message || 'Mã xác nhận sai hoặc hết hạn');
        } finally {
            setRestoreLoading(false);
        }
    };

    const columns = [
        {
            title: 'Thời gian',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (text) => new Date(text).toLocaleString('vi-VN')
        },
        {
            title: 'Tên File Backup',
            dataIndex: 'fileName',
            key: 'fileName',
        },
        {
            title: 'Kích thước',
            dataIndex: 'fileSize',
            key: 'fileSize',
            render: (size) => size ? `${(size / 1024).toFixed(2)} KB` : 'N/A'
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Tag color={status === 'SUCCESS' ? 'green' : 'red'}>
                    {status === 'SUCCESS' ? 'THÀNH CÔNG' : 'THẤT BẠI'}
                </Tag>
            )
        },
        {
            title: 'Người thực hiện',
            dataIndex: 'createdBy',
            key: 'createdBy',
            render: (user) => user ? user.name : 'Hệ thống (Tự động)'
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_, record) => (
                record.status === 'SUCCESS' ? (
                    <Button 
                        danger 
                        type="primary" 
                        onClick={() => handleRequestRestore(record.fileId)}
                        loading={otpLoading && selectedFileId === record.fileId}
                    >
                        Khôi phục
                    </Button>
                ) : <Text type="danger">{record.errorMessage}</Text>
            )
        }
    ];

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <Title level={3} className="!mb-0 flex items-center gap-2 text-blue-800">
                    <DatabaseOutlined /> Sao Lưu & Khôi Phục Dữ Liệu
                </Title>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title="Cấu Hình Sao Lưu (Google Drive)" className="shadow-md h-fit lg:col-span-1">
                    <Form form={form} layout="vertical" onFinish={onSaveConfig}>
                        <Form.Item 
                            name="folderId" 
                            label="ID Thư mục Google Drive"
                            rules={[{ required: true, message: 'Vui lòng nhập ID thư mục' }]}
                        >
                            <Input placeholder="Ví dụ: 1Q_gZeAqZW8x..." />
                        </Form.Item>

                        <Form.Item 
                            name="schedule" 
                            label="Lịch sao lưu tự động"
                        >
                            <Select>
                                <Option value="none">Không tự động</Option>
                                <Option value="daily">Hàng ngày</Option>
                                <Option value="weekly">Hàng tuần</Option>
                                <Option value="monthly">Hàng tháng</Option>
                            </Select>
                        </Form.Item>

                        <Space className="mt-4 w-full justify-between">
                            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                                Lưu Cấu Hình
                            </Button>
                            <Button 
                                type="dashed" 
                                icon={<ReloadOutlined />} 
                                onClick={handleManualBackup}
                                loading={backupLoading}
                            >
                                Sao lưu ngay
                            </Button>
                        </Space>
                    </Form>
                </Card>

                <Card title={<><HistoryOutlined /> Lịch sử Sao Lưu</>} className="shadow-md lg:col-span-2 overflow-auto">
                    <Table 
                        dataSource={histories} 
                        columns={columns} 
                        rowKey="_id"
                        loading={loading}
                        pagination={{ pageSize: 8 }}
                    />
                </Card>
            </div>

            <Modal
                title="Xác nhận Khôi Phục Dữ Liệu"
                open={restoreModalVisible}
                onCancel={() => {
                    setRestoreModalVisible(false);
                    setRestoreOtp('');
                }}
                footer={[
                    <Button key="back" onClick={() => setRestoreModalVisible(false)}>
                        Hủy bỏ
                    </Button>,
                    <Button key="submit" type="primary" danger loading={restoreLoading} onClick={handleVerifyRestore}>
                        Thực hiện Khôi phục
                    </Button>,
                ]}
            >
                <div className="text-red-500 font-bold mb-4 text-center">
                    ⚠️ CẢNH BÁO NGUY HIỂM ⚠️<br/>
                    Việc khôi phục sẽ xóa và ghi đè hoàn toàn dữ liệu hiện tại của hệ thống.
                </div>
                <p className="mb-4">
                    Một mã xác nhận (OTP) đã được gửi đến Email của bạn. Vui lòng kiểm tra hộp thư và nhập mã vào đây để xác nhận hành động này.
                </p>
                <Input 
                    placeholder="Nhập mã OTP (6 số)" 
                    size="large" 
                    value={restoreOtp}
                    onChange={(e) => setRestoreOtp(e.target.value)}
                    className="text-center text-xl tracking-[0.2em]"
                    maxLength={6}
                />
            </Modal>
        </div>
    );
};

export default BackupConfig;
