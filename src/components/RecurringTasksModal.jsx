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
    CheckCircleFilled, PaperClipOutlined, FileOutlined, UploadOutlined,
    CalendarOutlined
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

const FREQUENCY_OPTIONS = [
    { label: 'Hàng ngày', value: 'DAILY' },
    { label: 'Hàng tuần', value: 'WEEKLY' },
    { label: 'Hàng tháng', value: 'MONTHLY' },
    { label: 'Hàng quý', value: 'QUARTERLY' },
    { label: 'Học kỳ', value: 'SEMESTER' },
    { label: 'Hàng năm', value: 'YEARLY' },
];

// Component chọn chu kỳ lặp responsive: 3 cột trên mobile (2 hàng), 6 cột trên desktop (1 hàng)
const FrequencySelector = ({ value = 'WEEKLY', onChange }) => {
    return (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 w-full">
            {FREQUENCY_OPTIONS.map(opt => {
                const isActive = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange && onChange(opt.value)}
                        className={`py-2 px-1 text-center rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 select-none ${
                            isActive
                                ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/40'
                                : 'bg-white/80 text-slate-700 hover:text-blue-700 hover:bg-white border border-slate-200/60 sm:border-none sm:bg-transparent'
                        }`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
};

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
    const watchedQuarters = Form.useWatch('repeatQuarters', form);
    const watchedQuarterMonth = Form.useWatch('repeatQuarterMonth', form);
    const watchedDayOfMonth = Form.useWatch('repeatDayOfMonth', form);

    const getQuarterPreviewText = () => {
        const quarters = (Array.isArray(watchedQuarters) && watchedQuarters.length > 0)
            ? watchedQuarters
            : [1, 2, 3, 4];
        if (quarters.length === 0) {
            return 'Chưa chọn quý nào.';
        }
        const offset = Math.max(0, Math.min(2, (watchedQuarterMonth || 3) - 1)); // 0: đầu, 1: giữa, 2: cuối (mặc định cuối quý)
        const day = watchedDayOfMonth || 20;
        const sortedQuarters = [...quarters].sort((a, b) => a - b);
        const dates = sortedQuarters.map(q => {
            const monthNum = (q - 1) * 3 + offset + 1; // 1-12
            return `Ngày ${String(day).padStart(2, '0')}/${String(monthNum).padStart(2, '0')} (Quý ${q})`;
        });
        return `Tự động tạo việc định kỳ vào: ${dates.join(', ')} hàng năm.`;
    };

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
            repeatQuarters: [1, 2, 3, 4],
            repeatQuarterMonth: 3,
            repeatDayOfMonth: 20,
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
            repeatQuarters: Array.isArray(item.repeatQuarters) && item.repeatQuarters.length > 0 ? item.repeatQuarters : [1, 2, 3, 4],
            repeatQuarterMonth: item.repeatQuarterMonth !== undefined ? item.repeatQuarterMonth : 3,
            repeatDayOfMonth: item.repeatDayOfMonth !== undefined ? item.repeatDayOfMonth : 20,
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
            formData.append('repeatQuarters', JSON.stringify(values.repeatQuarters || [1, 2, 3, 4]));
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
                const qmText = item.repeatQuarterMonth === 2 ? 'Tháng giữa quý' : (item.repeatQuarterMonth === 1 ? 'Tháng đầu quý' : 'Tháng cuối quý');
                const quarters = (item.repeatQuarters && item.repeatQuarters.length > 0 && item.repeatQuarters.length < 4)
                    ? item.repeatQuarters.map(q => `Q${q}`).join(', ')
                    : '4 Quý';
                return (
                    <div className="flex flex-col gap-1">
                        <Tag color="magenta" className="font-semibold w-fit">Hàng quý ({quarters})</Tag>
                        <span className="text-xs text-gray-500 font-medium">
                            {qmText} - Ngày {item.repeatDayOfMonth || 20}
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
            width: 240,
            render: (text, record) => (
                <div className="max-w-[240px]">
                    <div className="font-bold text-[#003366] text-sm hover:underline cursor-pointer break-words" onClick={() => handleOpenEdit(record)}>
                        {text}
                    </div>
                    {record.description && (
                        <div className="text-xs text-gray-500 line-clamp-2 mt-0.5 break-words">
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
            width: 140,
            render: (_, record) => getFrequencyBadge(record)
        },
        {
            title: 'Người chủ trì',
            key: 'assignees',
            width: 140,
            render: (_, record) => {
                const assignees = record.assignees || [];
                if (assignees.length === 0) return <span className="text-gray-400 text-xs">Chưa gán</span>;
                return (
                    <div className="flex flex-wrap gap-1">
                        {assignees.map(u => (
                            <Tag key={u._id || u} color="blue" className="text-xs mr-0">
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
            width: 150,
            render: (_, record) => (
                <div className="text-xs space-y-1">
                    <div>⏱ Hạn: <b>{record.durationDays || 3} ngày</b></div>
                    {record.nextRunDate && (
                        <div className="text-emerald-700 font-medium">
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
            width: 95,
            align: 'center',
            render: (_, record) => (
                <div className="flex flex-col items-center gap-1">
                    <Switch
                        size="small"
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
            width: 105,
            align: 'center',
            fixed: 'right',
            render: (_, record) => (
                <div className="flex items-center justify-center gap-1">
                    <Tooltip title="Kích hoạt sinh ngay 1 công việc vào Lịch mà không cần chờ đến lịch hẹn">
                        <Button
                            type="primary"
                            size="small"
                            className="bg-amber-500 hover:bg-amber-600 text-white border-none text-xs flex items-center justify-center px-1.5 sm:px-2"
                            icon={<ThunderboltOutlined />}
                            loading={runningId === record._id}
                            onClick={() => handleRunNow(record._id)}
                        >
                            <span className="hidden sm:inline ml-1">Chạy</span>
                        </Button>
                    </Tooltip>
                    <Tooltip title="Chỉnh sửa mẫu">
                        <Button
                            size="small"
                            className="px-1.5"
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
                            className="px-1.5"
                            danger
                            icon={<DeleteOutlined />}
                        />
                    </Popconfirm>
                </div>
            )
        }
    ];

    return (
        <Modal
            title={
                <div className="flex items-center justify-between gap-2 pr-6 sm:pr-8">
                    <div className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base font-bold text-[#003366] min-w-0">
                        <SyncOutlined className="text-blue-600 shrink-0" />
                        <span className="truncate">Mẫu Việc Lặp Lại Định Kỳ</span>
                        <span className="hidden md:inline text-xs text-gray-400 font-normal shrink-0">(Tự động hóa)</span>
                    </div>
                    {viewMode === 'LIST' && (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={handleOpenCreate}
                            size="small"
                            className="bg-[#003366] hover:bg-[#002244] text-xs font-semibold shrink-0 sm:h-8 sm:px-3 sm:text-sm"
                        >
                            <span className="sm:hidden">Thêm mẫu</span>
                            <span className="hidden sm:inline">Thêm Mẫu Việc</span>
                        </Button>
                    )}
                </div>
            }
            open={visible}
            onCancel={onClose}
            width={1050}
            footer={null}
            destroyOnClose
            style={{ top: 15 }}
            className="max-w-[98vw] sm:max-w-[95vw] lg:max-w-[1050px] mx-auto"
        >
            {viewMode === 'LIST' ? (
                <div className="py-2">
                    <Alert
                        message={<span className="font-semibold text-xs sm:text-sm text-blue-900">Tự động hóa giao việc</span>}
                        description={
                            <div className="text-xs text-blue-800 leading-relaxed">
                                Hệ thống tự động quét mỗi ngày lúc 06:30 sáng và sinh ra công việc mới trên Lịch công tác theo đúng chu kỳ (Hàng ngày, Hàng tuần, Hàng tháng, Hàng quý, Học kỳ, Hàng năm). Đồng thời tự động gửi email thông báo trực tiếp đến người nhận việc.
                            </div>
                        }
                        type="info"
                        showIcon
                        className="mb-3 text-xs bg-blue-50/70 border-blue-200 rounded-lg py-2"
                    />
                    <Table
                        columns={columns}
                        dataSource={recurringTasks}
                        rowKey="_id"
                        loading={loading}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        size="small"
                        scroll={{ x: 870 }}
                        className="border border-gray-100 rounded-lg shadow-xs"
                    />
                </div>
            ) : (
                <div className="py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-gray-100">
                        <Button
                            icon={<ArrowLeftOutlined />}
                            size="middle"
                            onClick={() => setViewMode('LIST')}
                            className="text-xs sm:text-sm"
                        >
                            <span className="hidden sm:inline">Quay lại danh sách</span>
                            <span className="sm:hidden">Quay lại</span>
                        </Button>
                        <span className="font-bold text-slate-800 text-xs sm:text-sm text-center">
                            {editingItem ? 'Chỉnh sửa Mẫu việc' : 'Thêm mới Mẫu việc định kỳ'}
                        </span>
                        <Button
                            type="primary"
                            loading={submitting}
                            size="middle"
                            onClick={handleSave}
                            className="bg-blue-600 text-xs sm:text-sm font-semibold"
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
                                    <Row gutter={[16, 14]}>
                                        {/* Chu kỳ lặp lại hiển thị linh hoạt (Mobile: 2 hàng 3 cột, Desktop: 1 hàng 6 cột) */}
                                        <Col span={24}>
                                            <Form.Item
                                                name="frequency"
                                                label={<span className="font-semibold text-slate-700">Chu kỳ lặp lại</span>}
                                                className="mb-1"
                                            >
                                                <FrequencySelector />
                                            </Form.Item>
                                        </Col>

                                        {frequencyVal === 'WEEKLY' && (
                                            <Col span={24}>
                                                <div className="p-3 bg-white rounded-lg border border-blue-200/80">
                                                    <Form.Item
                                                        name="repeatDaysOfWeek"
                                                        label={<span className="font-semibold text-slate-700">Tự động sinh vào các ngày trong tuần:</span>}
                                                        rules={[{ required: true, message: 'Vui lòng chọn ít nhất 1 ngày trong tuần' }]}
                                                        className="mb-0"
                                                    >
                                                        <Checkbox.Group options={WEEK_DAYS} />
                                                    </Form.Item>
                                                </div>
                                            </Col>
                                        )}

                                        {frequencyVal === 'MONTHLY' && (
                                            <Col span={24}>
                                                <div className="p-3 bg-white rounded-lg border border-blue-200/80">
                                                    <Form.Item
                                                        name="repeatDayOfMonth"
                                                        label={<span className="font-semibold text-slate-700">Sinh việc vào ngày cố định trong tháng:</span>}
                                                        className="mb-0"
                                                    >
                                                        <InputNumber min={1} max={31} className="w-48 h-10 rounded-lg pt-1" placeholder="Ví dụ: ngày 1 hoặc 25" />
                                                    </Form.Item>
                                                </div>
                                            </Col>
                                        )}

                                        {frequencyVal === 'QUARTERLY' && (
                                            <Col span={24}>
                                                <div className="p-3 bg-white rounded-lg border border-blue-200/80 space-y-3">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <span className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                                                            <CalendarOutlined className="text-blue-600" />
                                                            1. Chọn các quý áp dụng trong năm:
                                                        </span>
                                                        <Space size="small">
                                                            <Button 
                                                                type="link" 
                                                                size="small" 
                                                                className="text-xs p-0 h-auto font-medium text-blue-600"
                                                                onClick={() => form.setFieldsValue({ repeatQuarters: [1, 2, 3, 4] })}
                                                            >
                                                                Chọn cả 4 quý
                                                            </Button>
                                                            <span className="text-gray-300">|</span>
                                                            <Button 
                                                                type="link" 
                                                                size="small" 
                                                                className="text-xs p-0 h-auto text-gray-500"
                                                                onClick={() => form.setFieldsValue({ repeatQuarters: [] })}
                                                            >
                                                                Bỏ chọn
                                                            </Button>
                                                        </Space>
                                                    </div>

                                                    <Form.Item
                                                        name="repeatQuarters"
                                                        noStyle
                                                        initialValue={[1, 2, 3, 4]}
                                                        rules={[{ required: true, message: 'Vui lòng chọn ít nhất một quý' }]}
                                                    >
                                                        <Checkbox.Group className="w-full">
                                                            <Row gutter={[10, 8]}>
                                                                <Col xs={12} sm={6}>
                                                                    <div className="border border-slate-200 rounded-lg p-2.5 hover:border-blue-300 hover:bg-blue-50/20 transition-all">
                                                                        <Checkbox value={1} className="font-semibold text-slate-700 w-full">
                                                                            Quý 1
                                                                            <div className="text-[11px] text-gray-400 font-normal">Tháng 1 - Tháng 3</div>
                                                                        </Checkbox>
                                                                    </div>
                                                                </Col>
                                                                <Col xs={12} sm={6}>
                                                                    <div className="border border-slate-200 rounded-lg p-2.5 hover:border-blue-300 hover:bg-blue-50/20 transition-all">
                                                                        <Checkbox value={2} className="font-semibold text-slate-700 w-full">
                                                                            Quý 2
                                                                            <div className="text-[11px] text-gray-400 font-normal">Tháng 4 - Tháng 6</div>
                                                                        </Checkbox>
                                                                    </div>
                                                                </Col>
                                                                <Col xs={12} sm={6}>
                                                                    <div className="border border-slate-200 rounded-lg p-2.5 hover:border-blue-300 hover:bg-blue-50/20 transition-all">
                                                                        <Checkbox value={3} className="font-semibold text-slate-700 w-full">
                                                                            Quý 3
                                                                            <div className="text-[11px] text-gray-400 font-normal">Tháng 7 - Tháng 9</div>
                                                                        </Checkbox>
                                                                    </div>
                                                                </Col>
                                                                <Col xs={12} sm={6}>
                                                                    <div className="border border-slate-200 rounded-lg p-2.5 hover:border-blue-300 hover:bg-blue-50/20 transition-all">
                                                                        <Checkbox value={4} className="font-semibold text-slate-700 w-full">
                                                                            Quý 4
                                                                            <div className="text-[11px] text-gray-400 font-normal">Tháng 10 - Tháng 12</div>
                                                                        </Checkbox>
                                                                    </div>
                                                                </Col>
                                                            </Row>
                                                        </Checkbox.Group>
                                                    </Form.Item>

                                                    <div className="pt-2 border-t border-slate-100">
                                                        <Row gutter={[16, 12]}>
                                                            <Col xs={24} sm={12}>
                                                                <Form.Item
                                                                    name="repeatQuarterMonth"
                                                                    label={<span className="font-semibold text-slate-700">2. Tháng sinh việc trong quý:</span>}
                                                                    initialValue={3}
                                                                    className="mb-0"
                                                                >
                                                                    <Select className="h-10 rounded-lg">
                                                                        <Option value={3}>Tháng cuối quý (T3, T6, T9, T12)</Option>
                                                                        <Option value={1}>Tháng đầu quý (T1, T4, T7, T10)</Option>
                                                                        <Option value={2}>Tháng giữa quý (T2, T5, T8, T11)</Option>
                                                                    </Select>
                                                                </Form.Item>
                                                            </Col>
                                                            <Col xs={24} sm={12}>
                                                                <Form.Item
                                                                    name="repeatDayOfMonth"
                                                                    label={<span className="font-semibold text-slate-700">3. Ngày sinh việc trong tháng:</span>}
                                                                    initialValue={20}
                                                                    className="mb-0"
                                                                >
                                                                    <InputNumber min={1} max={31} className="w-full h-10 rounded-lg pt-1" placeholder="Ví dụ: 20" />
                                                                </Form.Item>
                                                            </Col>
                                                        </Row>
                                                    </div>

                                                    <Alert
                                                        type="info"
                                                        showIcon
                                                        message={<span className="text-xs font-semibold text-blue-900">Lịch tạo việc tự động dự kiến:</span>}
                                                        description={
                                                            <div className="text-xs text-blue-800">
                                                                {getQuarterPreviewText()}
                                                            </div>
                                                        }
                                                        className="bg-blue-50/70 border-blue-200 rounded-lg py-1.5 px-3"
                                                    />
                                                </div>
                                            </Col>
                                        )}

                                        {frequencyVal === 'YEARLY' && (
                                            <Col span={24}>
                                                <div className="p-3 bg-white rounded-lg border border-blue-200/80">
                                                    <Row gutter={[16, 12]}>
                                                        <Col xs={24} sm={12}>
                                                            <Form.Item
                                                                name="repeatMonthOfYear"
                                                                label={<span className="font-semibold text-slate-700">Tháng sinh việc trong năm:</span>}
                                                                initialValue={1}
                                                                className="mb-0"
                                                            >
                                                                <Select className="h-10 rounded-lg">
                                                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                                        <Option key={m} value={m}>Tháng {m}</Option>
                                                                    ))}
                                                                </Select>
                                                            </Form.Item>
                                                        </Col>
                                                        <Col xs={24} sm={12}>
                                                            <Form.Item
                                                                name="repeatDayOfMonth"
                                                                label={<span className="font-semibold text-slate-700">Ngày sinh việc:</span>}
                                                                initialValue={1}
                                                                className="mb-0"
                                                            >
                                                                <InputNumber min={1} max={31} className="w-full h-10 rounded-lg pt-1" placeholder="Ví dụ: ngày 1 hoặc 15" />
                                                            </Form.Item>
                                                        </Col>
                                                    </Row>
                                                </div>
                                            </Col>
                                        )}

                                        {frequencyVal === 'SEMESTER' && (
                                            <Col span={24}>
                                                <div className="p-3 bg-white rounded-lg border border-blue-200/80 text-xs text-slate-600">
                                                    ℹ️ Chu kỳ <b>Theo học kỳ</b>: Hệ thống sẽ tự động lập lịch sinh việc định kỳ 6 tháng một lần tính từ ngày bắt đầu.
                                                </div>
                                            </Col>
                                        )}

                                        {/* Hàng Thời hạn hoàn thành & Khung giờ thực hiện mẫu */}
                                        <Col xs={24} md={12}>
                                            <Form.Item
                                                name="durationDays"
                                                label={<span className="font-semibold text-slate-700">Thời hạn hoàn thành (Số ngày)</span>}
                                                tooltip="Hệ thống tự động đặt Hạn hoàn thành = Ngày tạo việc + Số ngày này"
                                                rules={[{ required: true, message: 'Nhập số ngày hạn' }]}
                                                className="mb-0"
                                            >
                                                <InputNumber min={1} max={90} className="w-full h-10 rounded-lg pt-1" placeholder="Ví dụ: 3 ngày" />
                                            </Form.Item>
                                        </Col>

                                        <Col xs={24} md={12}>
                                            <Form.Item
                                                name="times"
                                                label={<span className="font-semibold text-slate-700">Khung giờ thực hiện mẫu</span>}
                                                className="mb-0"
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
                                            Chọn tệp đính kèm
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
                                                                    {userGroups && userGroups.length > 0 ? (
                                                                        userGroups.map(group => (
                                                                            <Select.OptGroup key={group.key} label={group.label}>
                                                                                {group.users.map(u => (
                                                                                    <Option key={u._id} value={u._id} label={`${u.name} (${u.email})`}>
                                                                                        {u.name} ({u.email})
                                                                                    </Option>
                                                                                ))}
                                                                            </Select.OptGroup>
                                                                        ))
                                                                    ) : (
                                                                        users.map(u => (
                                                                            <Option key={u._id} value={u._id} label={`${u.name} (${u.email})`}>
                                                                                {u.name} ({u.email})
                                                                            </Option>
                                                                        ))
                                                                    )}
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
