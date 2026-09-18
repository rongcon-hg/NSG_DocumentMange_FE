import React, { useState, useEffect, useMemo } from 'react';
import {
    Modal, Table, Button, Tag, Switch, Popconfirm, Form, Input, Select,
    InputNumber, TimePicker, Row, Col, Space, Tooltip, message, Segmented,
    AutoComplete, Checkbox, Divider, Alert, Upload
} from 'antd';
import {
    SyncOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
    ThunderboltOutlined, ClockCircleOutlined, UserOutlined,
    BranchesOutlined, FileDoneOutlined, DownOutlined, ArrowLeftOutlined,
    CheckCircleFilled, PaperClipOutlined, FileOutlined, UploadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
    getRecurringTasks, createRecurringTask, updateRecurringTask,
    deleteRecurringTask, toggleRecurringTask, runRecurringTaskNow
} from '../api/recurringTaskApi';

const { Option } = Select;

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

const WEEK_DAYS = [
    { label: 'Thứ 2', value: 1 },
    { label: 'Thứ 3', value: 2 },
    { label: 'Thứ 4', value: 3 },
    { label: 'Thứ 5', value: 4 },
    { label: 'Thứ 6', value: 5 },
    { label: 'Thứ 7', value: 6 },
    { label: 'Chủ nhật', value: 7 },
];

const RecurringTasksModal = ({
    visible,
    onClose,
    users = [],
    userGroups = [],
    filterUserOption,
    focusAxes = [],
    onTaskGenerated
}) => {
    const [loading, setLoading] = useState(false);
    const [recurringTasks, setRecurringTasks] = useState([]);
    const [viewMode, setViewMode] = useState('LIST'); // 'LIST' | 'FORM'
    const [editingItem, setEditingItem] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [runningId, setRunningId] = useState(null);
    const [fileList, setFileList] = useState([]);
    const [existingFiles, setExistingFiles] = useState([]);
    const [form] = Form.useForm();
    const frequencyVal = Form.useWatch('frequency', form);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await getRecurringTasks();
            if (res.success) {
                setRecurringTasks(res.data || []);
            }
        } catch (error) {
            message.error('Không thể tải danh sách mẫu việc định kỳ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (visible) {
            loadData();
            setViewMode('LIST');
            setEditingItem(null);
            setFileList([]);
            setExistingFiles([]);
        }
    }, [visible]);

    const handleOpenCreate = () => {
        setEditingItem(null);
        setFileList([]);
        setExistingFiles([]);
        form.resetFields();
        form.setFieldsValue({
            priority: 'NORMAL',
            taskType: 'REGULAR',
            difficultyRate: 1.0,
            baseScore: 10,
            frequency: 'WEEKLY',
            repeatDaysOfWeek: [1],
            repeatQuarterMonth: 1,
            repeatDayOfMonth: 1,
            repeatMonthOfYear: 1,
            durationDays: 3,
            times: [dayjs('08:00', 'HH:mm'), dayjs('17:00', 'HH:mm')],
            subtasks: []
        });
        setViewMode('FORM');
    };

    const handleOpenEdit = (item) => {
        setEditingItem(item);
        setFileList([]);
        setExistingFiles(item.files || []);
        form.resetFields();

        let timesVal = [dayjs('08:00', 'HH:mm'), dayjs('17:00', 'HH:mm')];
        if (Array.isArray(item.times) && item.times.length >= 2) {
            timesVal = [dayjs(item.times[0], 'HH:mm'), dayjs(item.times[1], 'HH:mm')];
        }

        form.setFieldsValue({
            title: item.title,
            description: item.description,
            notes: item.notes,
            priority: item.priority || 'NORMAL',
            taskType: item.taskType || 'REGULAR',
            difficultyRate: item.difficultyRate || 1.0,
            baseScore: item.baseScore || 10,
            outputResult: item.outputResult || '',
            focusAxis: item.focusAxis || '',
            assignees: (item.assignees || []).map(u => (u._id || u).toString()),
            collaborators: (item.collaborators || []).map(u => (u._id || u).toString()),
            frequency: item.frequency || 'WEEKLY',
            repeatDaysOfWeek: item.repeatDaysOfWeek || [1],
            repeatQuarterMonth: item.repeatQuarterMonth || 1,
            repeatDayOfMonth: item.repeatDayOfMonth || 1,
            repeatMonthOfYear: item.repeatMonthOfYear || 1,
            durationDays: item.durationDays !== undefined ? item.durationDays : 3,
            times: timesVal,
            subtasks: (item.subtasks || []).map(st => ({
                title: st.title,
                assignee: st.assignee?._id || st.assignee
            }))
        });
        setViewMode('FORM');
    };

    const handleRemoveExistingFile = (fileId) => {
        setExistingFiles(prev => prev.filter(f => f.fileId !== fileId));
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);

            const timesArr = values.times && values.times.length === 2
                ? [values.times[0].format('HH:mm'), values.times[1].format('HH:mm')]
                : ['08:00', '17:00'];

            const formData = new FormData();
            formData.append('title', values.title.trim());
            formData.append('description', values.description || '');
            formData.append('notes', values.notes || '');
            formData.append('priority', values.priority || 'NORMAL');
            formData.append('taskType', values.taskType || 'REGULAR');
            formData.append('difficultyRate', values.difficultyRate || 1.0);
            formData.append('baseScore', values.baseScore || (values.taskType === 'URGENT' ? 12 : 10));
            formData.append('outputResult', values.outputResult || '');
            formData.append('focusAxis', values.focusAxis || '');
            formData.append('frequency', values.frequency || 'WEEKLY');
            formData.append('durationDays', values.durationDays !== undefined ? values.durationDays : 3);
            formData.append('repeatDayOfMonth', values.repeatDayOfMonth !== undefined ? values.repeatDayOfMonth : 1);
            formData.append('repeatQuarterMonth', values.repeatQuarterMonth !== undefined ? values.repeatQuarterMonth : 1);
            formData.append('repeatMonthOfYear', values.repeatMonthOfYear !== undefined ? values.repeatMonthOfYear : 1);

            formData.append('times', JSON.stringify(timesArr));
            formData.append('assignees', JSON.stringify(values.assignees || []));
            formData.append('collaborators', JSON.stringify(values.collaborators || []));
            formData.append('repeatDaysOfWeek', JSON.stringify(values.repeatDaysOfWeek || [1]));
            formData.append('subtasks', JSON.stringify((values.subtasks || []).filter(s => s && s.title && s.title.trim())));

            // Danh sách file cũ còn lại
            formData.append('uploadedFiles', JSON.stringify(existingFiles));

            // Tệp đính kèm mới tải lên
            fileList.forEach(file => {
                if (file.originFileObj) {
                    formData.append('files', file.originFileObj);
                }
            });

            if (editingItem) {
                await updateRecurringTask(editingItem._id, formData);
                message.success('Cập nhật mẫu việc định kỳ thành công!');
            } else {
                await createRecurringTask(formData);
                message.success('Tạo mới mẫu việc định kỳ thành công!');
            }

            setViewMode('LIST');
            loadData();
        } catch (err) {
            if (err?.errorFields) {
                message.error('Vui lòng hoàn thành các trường bắt buộc');
            } else {
                message.error(err?.response?.data?.message || 'Có lỗi xảy ra khi lưu mẫu việc');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggle = async (id) => {
        try {
            const res = await toggleRecurringTask(id);
            if (res.success) {
                message.success(res.message);
                loadData();
            }
        } catch (err) {
            message.error('Không thể thay đổi trạng thái mẫu việc');
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteRecurringTask(id);
            message.success('Đã xóa mẫu việc định kỳ');
            loadData();
        } catch (err) {
            message.error('Lỗi khi xóa mẫu việc');
        }
    };

    const handleRunNow = async (id) => {
        setRunningId(id);
        try {
            const res = await runRecurringTaskNow(id);
            if (res.success) {
                message.success(`Đã kích hoạt tạo công việc thành công: "${res.data?.title}"`);
                loadData();
                if (onTaskGenerated) onTaskGenerated();
            }
        } catch (err) {
            message.error(err?.response?.data?.message || 'Lỗi khi kích hoạt công việc định kỳ');
        } finally {
            setRunningId(null);
        }
    };

    const getFrequencyBadge = (item) => {
        switch (item.frequency) {
            case 'DAILY':
                return <Tag color="blue" className="font-semibold">Hàng ngày</Tag>;
            case 'WEEKLY': {
                const dayLabels = (item.repeatDaysOfWeek || [])
                    .map(d => WEEK_DAYS.find(w => w.value === d)?.label)
                    .filter(Boolean)
                    .join(', ');
                return (
                    <div className="flex flex-col gap-1">
                        <Tag color="cyan" className="font-semibold w-fit">Hàng tuần</Tag>
                        <span className="text-xs text-gray-500 font-medium">{dayLabels ? `${dayLabels}` : 'Thứ 2'}</span>
                    </div>
                );
            }
            case 'MONTHLY':
                return (
                    <div className="flex flex-col gap-1">
                        <Tag color="purple" className="font-semibold w-fit">Hàng tháng</Tag>
                        <span className="text-xs text-gray-500 font-medium">Ngày {item.repeatDayOfMonth || 1} hàng tháng</span>
                    </div>
                );
            case 'QUARTERLY': {
                const qmText = item.repeatQuarterMonth === 2 ? 'Tháng giữa quý' : (item.repeatQuarterMonth === 3 ? 'Tháng cuối quý' : 'Tháng đầu quý');
                return (
                    <div className="flex flex-col gap-1">
                        <Tag color="magenta" className="font-semibold w-fit">Hàng quý</Tag>
                        <span className="text-xs text-gray-500 font-medium">
                            {qmText} (Ngày {item.repeatDayOfMonth || 1})
                        </span>
                    </div>
                );
            }
            case 'SEMESTER':
                return <Tag color="geekblue" className="font-semibold">Theo học kỳ (6 tháng)</Tag>;
            case 'YEARLY':
                return (
                    <div className="flex flex-col gap-1">
                        <Tag color="orange" className="font-semibold w-fit">Hàng năm</Tag>
                        <span className="text-xs text-gray-500 font-medium">
                            Ngày {item.repeatDayOfMonth || 1} tháng {item.repeatMonthOfYear || 1}
                        </span>
                    </div>
                );
            default:
                return <Tag>Định kỳ</Tag>;
        }
    };

    const columns = [
        {
            title: 'Tiêu đề & Nội dung mẫu',
            dataIndex: 'title',
            key: 'title',
            render: (text, record) => (
                <div className="max-w-[280px]">
                    <div className="font-bold text-[#003366] text-sm hover:underline cursor-pointer" onClick={() => handleOpenEdit(record)}>
                        {text}
                    </div>
                    {record.description && (
                        <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                            {record.description}
                        </div>
                    )}
                    {record.subtasks && record.subtasks.length > 0 && (
                        <div className="mt-1 text-[11px] text-blue-600 font-medium flex items-center gap-1">
                            <BranchesOutlined /> Kèm {record.subtasks.length} việc con
                        </div>
                    )}
                    {record.files && record.files.length > 0 && (
                        <div className="mt-0.5 text-[11px] text-teal-600 font-medium flex items-center gap-1">
                            <PaperClipOutlined /> Kèm {record.files.length} tệp đính kèm
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Chu kỳ lặp',
            key: 'frequency',
            width: 170,
            render: (_, record) => getFrequencyBadge(record)
        },
        {
            title: 'Người chủ trì',
            key: 'assignees',
            width: 170,
            render: (_, record) => {
                const assignees = record.assignees || [];
                if (assignees.length === 0) return <span className="text-gray-400 text-xs">Chưa gán</span>;
                return (
                    <div className="flex flex-wrap gap-1">
                        {assignees.map(u => (
                            <Tag key={u._id || u} color="blue" className="text-xs">
                                {u.name || 'Cán bộ'}
                            </Tag>
                        ))}
                    </div>
                );
            }
        },
        {
            title: 'Thời hạn & Lịch chạy',
            key: 'timing',
            width: 180,
            render: (_, record) => (
                <div className="text-xs space-y-1">
                    <div>⏱ Hạn làm: <b>{record.durationDays || 3} ngày</b></div>
                    {record.nextRunDate && (
                        <div className="text-emerald-700">
                            🗓 Kế tiếp: <b>{dayjs(record.nextRunDate).format('DD/MM/YYYY')}</b>
                        </div>
                    )}
                    <div className="text-gray-400 text-[11px]">
                        Đã sinh: {record.totalGeneratedCount || 0} lần
                    </div>
                </div>
            )
        },
        {
            title: 'Trạng thái',
            key: 'isActive',
            width: 110,
            align: 'center',
            render: (_, record) => (
                <div className="flex flex-col items-center gap-1">
                    <Switch
                        checked={record.isActive}
                        onChange={() => handleToggle(record._id)}
                        checkedChildren="Bật"
                        unCheckedChildren="Tắt"
                    />
                    <span className={`text-[10px] ${record.isActive ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                        {record.isActive ? 'Đang chạy' : 'Tạm dừng'}
                    </span>
                </div>
            )
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 140,
            align: 'center',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="Kích hoạt sinh ngay 1 công việc vào Lịch mà không cần chờ đến lịch hẹn">
                        <Button
                            type="primary"
                            size="small"
                            className="bg-amber-500 hover:bg-amber-600 text-white border-none text-xs flex items-center justify-center"
                            icon={<ThunderboltOutlined />}
                            loading={runningId === record._id}
                            onClick={() => handleRunNow(record._id)}
                        >
                            Chạy
                        </Button>
                    </Tooltip>
                    <Tooltip title="Chỉnh sửa mẫu">
                        <Button
                            size="small"
                            icon={<EditOutlined className="text-blue-600" />}
                            onClick={() => handleOpenEdit(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Xóa mẫu việc định kỳ này?"
                        description="Hệ thống sẽ không tự động sinh công việc từ mẫu này nữa."
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleDelete(record._id)}
                    >
                        <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                        />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <Modal
            title={
                <div className="flex items-center justify-between pr-8">
                    <div className="flex items-center gap-2 text-base font-bold text-[#003366]">
                        <SyncOutlined className="text-blue-600" />
                        <span>Mẫu Công Việc Lặp Lại Định Kỳ (Tự Động Hóa Lịch Giao Việc)</span>
                    </div>
                    {viewMode === 'LIST' && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleOpenCreate}
                            className="bg-[#003366] hover:bg-[#002244]"
                        >
                            Thêm Mẫu Việc Định Kỳ
                        </Button>
                    )}
                </div>
            }
            open={visible}
            onCancel={onClose}
            width={1000}
            footer={null}
            destroyOnClose
            style={{ top: 20 }}
        >
            {viewMode === 'LIST' ? (
                <div className="py-2">
                    <Alert
                        message="Tự động hóa giao việc"
                        description="Hệ thống tự động quét mỗi ngày lúc 06:30 sáng và sinh ra công việc mới trên Lịch công tác theo đúng chu kỳ (Hàng ngày, Hàng tuần, Hàng tháng). Đồng thời tự động gửi email thông báo trực tiếp đến người nhận việc."
                        type="info"
                        showIcon
                        className="mb-4 text-xs"
                    />
                    <Table
                        columns={columns}
                        dataSource={recurringTasks}
                        rowKey="_id"
                        loading={loading}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        size="middle"
                        className="border border-gray-100 rounded-lg"
                    />
                </div>
            ) : (
                <div className="py-2">
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                        <Button
                            icon={<ArrowLeftOutlined />}
                            onClick={() => setViewMode('LIST')}
                        >
                            Quay lại danh sách
                        </Button>
                        <span className="font-bold text-slate-800 text-sm">
                            {editingItem ? 'Chỉnh sửa Mẫu việc định kỳ' : 'Thêm mới Mẫu việc định kỳ'}
                        </span>
                        <Button
                            type="primary"
                            loading={submitting}
                            onClick={handleSave}
                            className="bg-blue-600"
                        >
                            {editingItem ? 'Lưu thay đổi' : 'Tạo mẫu việc'}
                        </Button>
                    </div>

                    <Form form={form} layout="vertical">
                        <Row gutter={[16, 12]}>
                            {/* Tiêu đề & Ưu tiên */}
                            <Col xs={24} md={16}>
                                <Form.Item
                                    name="title"
                                    label={<span className="font-semibold text-slate-700">Tiêu đề công việc định kỳ <span className="text-red-500">*</span></span>}
                                    rules={[{ required: true, message: 'Vui lòng nhập tiêu đề mẫu công việc!' }]}
                                >
                                    <Input placeholder="Ví dụ: Báo cáo giao ban đầu tuần, Nộp bảng chấm công, Rà soát điểm rèn luyện..." className="h-10 rounded-lg font-medium" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                                <Form.Item
                                    name="priority"
                                    label={<span className="font-semibold text-slate-700">Mức độ ưu tiên</span>}
                                >
                                    <Select className="h-10">
                                        <Option value="NORMAL">Bình thường</Option>
                                        <Option value="URGENT">Khẩn</Option>
                                        <Option value="FLASH">Hỏa tốc</Option>
                                    </Select>
                                </Form.Item>
                            </Col>

                            {/* Cấu hình Chu kỳ Lặp */}
                            <Col span={24}>
                                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 mb-2">
                                    <div className="font-bold text-[#003366] text-sm mb-3 flex items-center gap-2">
                                        <ClockCircleOutlined className="text-blue-600" />
                                        Thiết lập Chu kỳ Lặp & Thời hạn Hoàn thành
                                    </div>
                                    <Row gutter={[16, 12]}>
                                        <Col xs={24} md={12}>
                                            <Form.Item
                                                name="frequency"
                                                label={<span className="font-semibold text-slate-700">Chu kỳ lặp lại</span>}
                                            >
                                                <Segmented
                                                    block
                                                    options={[
                                                        { label: 'Hàng ngày', value: 'DAILY' },
                                                        { label: 'Hàng tuần', value: 'WEEKLY' },
                                                        { label: 'Hàng tháng', value: 'MONTHLY' },
                                                        { label: 'Hàng quý', value: 'QUARTERLY' },
                                                        { label: 'Học kỳ', value: 'SEMESTER' },
                                                        { label: 'Hàng năm', value: 'YEARLY' },
                                                    ]}
                                                />
                                            </Form.Item>
                                        </Col>

                                        <Col xs={24} md={12}>
                                            <Form.Item
                                                name="durationDays"
                                                label={<span className="font-semibold text-slate-700">Thời hạn hoàn thành (Số ngày)</span>}
                                                tooltip="Hệ thống tự động đặt Hạn hoàn thành = Ngày tạo + Số ngày này"
                                                rules={[{ required: true, message: 'Nhập số ngày hạn' }]}
                                            >
                                                <InputNumber min={1} max={90} className="w-full h-10 rounded-lg pt-1" placeholder="Ví dụ: 3 ngày" />
                                            </Form.Item>
                                        </Col>

                                        {frequencyVal === 'WEEKLY' && (
                                            <Col span={24}>
                                                <Form.Item
                                                    name="repeatDaysOfWeek"
                                                    label={<span className="font-semibold text-slate-700">Tự động sinh vào các ngày trong tuần:</span>}
                                                    rules={[{ required: true, message: 'Vui lòng chọn ít nhất 1 ngày trong tuần' }]}
                                                >
                                                    <Checkbox.Group options={WEEK_DAYS} />
                                                </Form.Item>
                                            </Col>
                                        )}

                                        {frequencyVal === 'MONTHLY' && (
                                            <Col xs={24} md={12}>
                                                <Form.Item
                                                    name="repeatDayOfMonth"
                                                    label={<span className="font-semibold text-slate-700">Sinh việc vào ngày cố định trong tháng:</span>}
                                                >
                                                    <InputNumber min={1} max={31} className="w-full h-10 rounded-lg pt-1" placeholder="Ví dụ: ngày 1 hoặc 25" />
                                                </Form.Item>
                                            </Col>
                                        )}

                                        {frequencyVal === 'QUARTERLY' && (
                                            <>
                                                <Col xs={24} sm={12} md={6}>
                                                    <Form.Item
                                                        name="repeatQuarterMonth"
                                                        label={<span className="font-semibold text-slate-700">Tháng sinh việc trong quý:</span>}
                                                        initialValue={1}
                                                    >
                                                        <Select className="h-10 rounded-lg">
                                                            <Option value={1}>Tháng đầu quý (T1, T4, T7, T10)</Option>
                                                            <Option value={2}>Tháng giữa quý (T2, T5, T8, T11)</Option>
                                                            <Option value={3}>Tháng cuối quý (T3, T6, T9, T12)</Option>
                                                        </Select>
                                                    </Form.Item>
                                                </Col>
                                                <Col xs={24} sm={12} md={6}>
                                                    <Form.Item
                                                        name="repeatDayOfMonth"
                                                        label={<span className="font-semibold text-slate-700">Ngày sinh việc trong tháng:</span>}
                                                        initialValue={1}
                                                    >
                                                        <InputNumber min={1} max={31} className="w-full h-10 rounded-lg pt-1" placeholder="Ví dụ: ngày 1 hoặc 15" />
                                                    </Form.Item>
                                                </Col>
                                            </>
                                        )}

                                        {frequencyVal === 'YEARLY' && (
                                            <>
                                                <Col xs={24} sm={12} md={6}>
                                                    <Form.Item
                                                        name="repeatMonthOfYear"
                                                        label={<span className="font-semibold text-slate-700">Tháng sinh việc trong năm:</span>}
                                                        initialValue={1}
                                                    >
                                                        <Select className="h-10 rounded-lg">
                                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                                <Option key={m} value={m}>Tháng {m}</Option>
                                                            ))}
                                                        </Select>
                                                    </Form.Item>
                                                </Col>
                                                <Col xs={24} sm={12} md={6}>
                                                    <Form.Item
                                                        name="repeatDayOfMonth"
                                                        label={<span className="font-semibold text-slate-700">Ngày sinh việc:</span>}
                                                        initialValue={1}
                                                    >
                                                        <InputNumber min={1} max={31} className="w-full h-10 rounded-lg pt-1" placeholder="Ví dụ: ngày 1 hoặc 15" />
                                                    </Form.Item>
                                                </Col>
                                            </>
                                        )}

                                        <Col xs={24} md={12}>
                                            <Form.Item
                                                name="times"
                                                label={<span className="font-semibold text-slate-700">Khung giờ thực hiện mẫu</span>}
                                            >
                                                <TimePicker.RangePicker format="HH:mm" className="w-full h-10 rounded-lg" />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>
                            </Col>

                            {/* Người thực hiện & Phối hợp */}
                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="assignees"
                                    label={<span className="font-semibold text-slate-700">Người thực hiện chính <span className="text-red-500">*</span></span>}
                                    rules={[{ required: true, message: 'Vui lòng chọn ít nhất 1 người thực hiện!' }]}
                                >
                                    <Select
                                        mode="multiple"
                                        placeholder="Chọn người chủ trì thực hiện"
                                        showSearch
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
                                </Form.Item>
                            </Col>

                            <Col xs={24} md={12}>
                                <Form.Item
                                    name="collaborators"
                                    label={<span className="font-semibold text-slate-700">Người phối hợp</span>}
                                >
                                    <Select
                                        mode="multiple"
                                        placeholder="Chọn người phối hợp"
                                        showSearch
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
                                </Form.Item>
                            </Col>

                            {/* Mô tả & Ghi chú */}
                            <Col xs={24} md={12}>
                                <Form.Item name="description" label={<span className="font-semibold text-slate-700">Mô tả nội dung công việc</span>}>
                                    <Input.TextArea rows={3} placeholder="Nội dung, yêu cầu chi tiết khi việc được tạo..." className="rounded-lg" />
                                </Form.Item>
                            </Col>
                            <Col xs={24} md={12}>
                                <Form.Item name="notes" label={<span className="font-semibold text-slate-700">Ghi chú thêm</span>}>
                                    <Input.TextArea rows={3} placeholder="Ghi chú, lưu ý tiến độ..." className="rounded-lg" />
                                </Form.Item>
                            </Col>

                            {/* Cụm Phụ lục 3 & 4 */}
                            <Col span={24}>
                                <div className="p-4 bg-gradient-to-r from-blue-50/40 via-indigo-50/20 to-blue-50/30 rounded-xl border border-blue-100">
                                    <div className="font-bold text-[#003366] text-sm mb-3 flex items-center gap-2">
                                        <FileDoneOutlined className="text-blue-600" />
                                        Tiêu chuẩn Phụ lục 3 & 4 (Độ khó & Kết quả đầu ra)
                                    </div>
                                    <Row gutter={[16, 12]}>
                                        <Col xs={24} md={8}>
                                            <Form.Item name="taskType" label="Loại công việc">
                                                <Select className="h-10">
                                                    <Option value="REGULAR">Thường xuyên (Điểm chuẩn: 10đ)</Option>
                                                    <Option value="URGENT">Đột xuất (Điểm chuẩn: 12đ)</Option>
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item name="difficultyRate" label="Hệ số độ khó">
                                                <Select className="h-10">
                                                    <Option value={1.0}>1.0 (100% - Thông thường)</Option>
                                                    <Option value={1.1}>1.1 (110% - Phối hợp ≤ 3 người)</Option>
                                                    <Option value={1.2}>1.2 (120% - Phối hợp ≥ 4 người)</Option>
                                                </Select>
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={8}>
                                            <Form.Item name="outputResult" label="Kết quả đầu ra / Sản phẩm">
                                                <AutoComplete
                                                    options={OUTPUT_RESULT_OPTIONS.map(s => ({ value: s, label: s }))}
                                                    filterOption={(input, opt) => !input || (opt?.value || '').toLowerCase().includes(input.toLowerCase())}
                                                    showAction={['focus', 'click']}
                                                >
                                                    <Input className="h-10" placeholder="Chọn gợi ý hoặc tự gõ..." suffix={<DownOutlined className="text-gray-400 text-xs" />} />
                                                </AutoComplete>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </div>
                            </Col>

                            {/* Tệp đính kèm mẫu việc */}
                            <Col span={24}>
                                <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200">
                                    <div className="font-bold text-[#003366] text-sm mb-2 flex flex-wrap items-center justify-between gap-1">
                                        <span className="flex items-center gap-2">
                                            <PaperClipOutlined className="text-teal-600" />
                                            Tệp đính kèm mẫu việc
                                        </span>
                                        <span className="text-xs font-normal text-slate-500">
                                            (Tự động sao chép sang công việc mới khi sinh)
                                        </span>
                                    </div>

                                    {/* Danh sách file cũ nếu có */}
                                    {existingFiles.length > 0 && (
                                        <div className="mb-3 space-y-1.5">
                                            <div className="text-xs text-slate-500 font-medium">Tệp hiện có trong mẫu:</div>
                                            <div className="flex flex-wrap gap-2">
                                                {existingFiles.map(f => (
                                                    <Tag
                                                        key={f.fileId}
                                                        closable
                                                        onClose={() => handleRemoveExistingFile(f.fileId)}
                                                        color="blue"
                                                        className="py-1 px-2.5 text-xs flex items-center gap-1.5 rounded-lg border-blue-200"
                                                    >
                                                        <FileOutlined />
                                                        <span className="max-w-[180px] truncate" title={f.fileName}>{f.fileName}</span>
                                                    </Tag>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Upload file mới */}
                                    <Upload
                                        fileList={fileList}
                                        beforeUpload={() => false}
                                        onChange={({ fileList }) => setFileList(fileList)}
                                        multiple
                                    >
                                        <Button icon={<UploadOutlined />} className="border-teal-500 text-teal-700 hover:bg-teal-50">
                                            Chọn tệp đính kèm (PDF, Word, Excel, Hình ảnh...)
                                        </Button>
                                    </Upload>
                                </div>
                            </Col>

                            {/* Danh sách công việc con mẫu (Subtasks) */}
                            <Col span={24}>
                                <div className="border border-gray-200 rounded-xl p-4">
                                    <Form.List name="subtasks">
                                        {(fields, { add, remove }) => (
                                            <>
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                                                        <BranchesOutlined className="text-blue-600" /> Danh sách công việc con định kỳ (Subtasks)
                                                    </span>
                                                    <Button
                                                        type="dashed"
                                                        size="small"
                                                        icon={<PlusOutlined />}
                                                        onClick={() => add()}
                                                    >
                                                        Thêm việc con
                                                    </Button>
                                                </div>
                                                {fields.map(({ key, name, ...restField }, idx) => (
                                                    <Row key={key} gutter={12} align="middle" className="mb-2">
                                                        <Col xs={14} sm={16}>
                                                            <Form.Item
                                                                {...restField}
                                                                name={[name, 'title']}
                                                                rules={[{ required: true, message: 'Nhập nội dung việc con' }]}
                                                                className="mb-0"
                                                            >
                                                                <Input placeholder={`Việc con ${idx + 1}...`} />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col xs={8} sm={7}>
                                                            <Form.Item
                                                                {...restField}
                                                                name={[name, 'assignee']}
                                                                className="mb-0"
                                                            >
                                                                <Select
                                                                    placeholder="Gán người làm"
                                                                    showSearch
                                                                    optionFilterProp="label"
                                                                    filterOption={filterUserOption}
                                                                    allowClear
                                                                >
                                                                    {users.map(u => (
                                                                        <Option key={u._id} value={u._id} label={`${u.name} (${u.email})`}>
                                                                            {u.name}
                                                                        </Option>
                                                                    ))}
                                                                </Select>
                                                            </Form.Item>
                                                        </Col>
                                                        <Col xs={2} sm={1}>
                                                            <Button
                                                                type="text"
                                                                danger
                                                                icon={<DeleteOutlined />}
                                                                onClick={() => remove(name)}
                                                            />
                                                        </Col>
                                                    </Row>
                                                ))}
                                            </>
                                        )}
                                    </Form.List>
                                </div>
                            </Col>
                        </Row>

                        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                            <Button onClick={() => setViewMode('LIST')}>Hủy</Button>
                            <Button type="primary" loading={submitting} onClick={handleSave} className="bg-blue-600">
                                {editingItem ? 'Lưu cập nhật' : 'Tạo mẫu việc định kỳ'}
                            </Button>
                        </div>
                    </Form>
                </div>
            )}
        </Modal>
    );
};

export default RecurringTasksModal;
