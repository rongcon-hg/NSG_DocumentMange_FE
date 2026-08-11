import { formatFileName } from "../../utils/formatFileName";
import { getDriveToken, uploadFileDirectlyToDrive } from "../../api/driveApi";
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, DatePicker, TimePicker, Select, Button, message, Segmented, Pagination, Upload, Row, Col, Card, Statistic, Table, Tag, Space, Tooltip, Timeline, Alert } from 'antd';
import { UploadOutlined, ProfileOutlined, SyncOutlined, CheckCircleOutlined, FileTextOutlined, ExportOutlined, EditOutlined, EyeOutlined, HistoryOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { getTasks, createTask, updateTask, deleteTask } from '../../api/taskApi';
import { getAllUsers } from '../../api/auth';
import { useNotificationContext } from '../../context/NotificationContext';
import { Calendar as BigCalendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'moment/locale/vi';

// Thiết lập ngôn ngữ tiếng Việt cho moment
moment.locale('vi');
const localizer = momentLocalizer(moment);

const { Option } = Select;
const { RangePicker } = DatePicker;

const SchedulePage = () => {
    const { tab } = useParams();
    const navigate = useNavigate();
    const { userId } = useNotificationContext();
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isDetailsVisible, setIsDetailsVisible] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [selectedTask, setSelectedTask] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [form] = Form.useForm();

    const handleViewDetails = (task) => {
        setSelectedTask(task);
        setIsDetailsVisible(true);
    };

    const handleViewHistory = (task) => {
        setSelectedTask(task);
        setHistoryPage(1);
        setIsHistoryVisible(true);
    };
    const [editingTask, setEditingTask] = useState(null);
    const [viewMode, setViewMode] = useState('Hệ thống'); // 'Hệ thống' hoặc 'Google'
    const [currentUser, setCurrentUser] = useState(null);
    const [fileList, setFileList] = useState([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterAssignee, setFilterAssignee] = useState(null);
    const [kanbanPage, setKanbanPage] = useState({ TODO: 1, IN_PROGRESS: 1, DONE: 1 });
    const KANBAN_PAGE_SIZE = 10;

    useEffect(() => {
        loadTasks();
        loadUsers();
    }, [userId]);

    useEffect(() => {
        if (tab === 'create') {
            handleSelectSlot({ start: new Date(), end: new Date() });
            setFilterStatus('ALL');
        } else if (tab === 'todo') {
            setFilterStatus('TODO');
        } else if (tab === 'inprogress') {
            setFilterStatus('IN_PROGRESS');
        } else if (tab === 'done') {
            setFilterStatus('DONE');
        } else {
            setFilterStatus('ALL');
        }
    }, [tab]);

    const loadTasks = async () => {
        try {
            const res = await getTasks(userId);
            if (res.success) {
                setTasks(res.data);
            }
        } catch (error) {
            message.error("Lỗi khi tải danh sách công việc");
        }
    };

    const loadUsers = async () => {
        try {
            const res = await getAllUsers();
            if (res && res.users) {
                setUsers(res.users);
                const current = res.users.find(u => u._id === userId);
                if (current) {
                    setCurrentUser(current);
                }
            }
        } catch (error) {
            console.error("Lỗi tải danh sách người dùng", error);
        }
    };

    const handleSelectSlot = ({ start, end }) => {
        form.resetFields();
        form.setFieldsValue({
            dates: [dayjs(start), dayjs(end)],
            times: [dayjs(start), dayjs(end)],
            assignees: currentUser ? [currentUser._id] : []
        });
        setFileList([]);
        setEditingTask(null);
        setIsModalVisible(true);
    };

    const handleSelectEvent = (event) => {
        const task = event.resource;
        setEditingTask(task);
        form.setFieldsValue({
            title: task.title,
            description: task.description,
            dates: [dayjs(task.startDate), dayjs(task.endDate)],
            times: [dayjs(task.startDate), dayjs(task.endDate)],
            assignees: task.assignees.map(a => a._id),
            collaborators: (task.collaborators || []).map(a => a._id || a),
            status: task.status,
            priority: task.priority || 'NORMAL'
        });
        setFileList([]);
        setIsModalVisible(true);
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setIsSaving(true);
            const formData = new FormData();
            formData.append("title", values.title);
            if (values.description) formData.append("description", values.description);
            
            let startDateObj = values.dates[0].clone();
            let endDateObj = values.dates[1].clone();
            
            if (values.times && values.times.length === 2 && values.times[0] && values.times[1]) {
                startDateObj = startDateObj.hour(values.times[0].hour()).minute(values.times[0].minute()).second(0);
                endDateObj = endDateObj.hour(values.times[1].hour()).minute(values.times[1].minute()).second(0);
            } else {
                const now = dayjs();
                startDateObj = startDateObj.hour(now.hour()).minute(now.minute()).second(0);
                endDateObj = endDateObj.hour(now.hour()).minute(now.minute()).second(0);
            }

            formData.append("startDate", startDateObj.toDate());
            formData.append("endDate", endDateObj.toDate());
            formData.append("assignees", JSON.stringify(values.assignees || []));
            formData.append("collaborators", JSON.stringify(values.collaborators || []));
            formData.append("status", values.status || 'TODO');
            formData.append("priority", values.priority || 'NORMAL');
            if (!editingTask) formData.append("createdBy", userId);

            const filesToUploadDirectly = [];

            fileList.forEach(file => {
                if (file.originFileObj) {
                    filesToUploadDirectly.push(file.originFileObj);
                }
            });

            const newlyUploadedFiles = [];
            if (filesToUploadDirectly.length > 0) {
                message.loading({ content: 'Đang tải tệp lên Google Drive...', key: 'uploading' });
                try {
                    const driveAuth = await getDriveToken();
                    const accessToken = driveAuth.accessToken;
                    const folderId = driveAuth.folderId;

                    for (const fileObj of filesToUploadDirectly) {
                        const uploadedFile = await uploadFileDirectlyToDrive(fileObj, accessToken, folderId);
                        newlyUploadedFiles.push(uploadedFile);
                    }
                    message.success({ content: 'Tải tệp lên Google Drive thành công!', key: 'uploading', duration: 2 });
                } catch (error) {
                    message.error({ content: `Lỗi tải tệp: ${error.message}`, key: 'uploading', duration: 4 });
                    setIsSaving(false);
                    return; // Stop the process
                }
            }

            if (newlyUploadedFiles.length > 0) {
                formData.append("uploadedFiles", JSON.stringify(newlyUploadedFiles));
            }

            if (editingTask && editingTask.files) {
                // Giữ lại các file cũ
                formData.append("existingFiles", JSON.stringify(editingTask.files));
            }

            if (editingTask) {
                await updateTask(editingTask._id, formData);
                message.success("Cập nhật công việc thành công!");
            } else {
                await createTask(formData);
                message.success("Thêm công việc thành công!");
            }
            setIsModalVisible(false);
            setFileList([]);
            loadTasks();
        } catch (error) {
            console.error(error);
            if (error.name !== 'ValidationError' && error.errorFields === undefined) {
                // If it's an API error, not a form validation error
                if (error.response?.status === 413) {
                    message.error("Lỗi: Tệp đính kèm quá lớn (vượt giới hạn 4.5MB của máy chủ).");
                } else {
                    message.error("Có lỗi xảy ra: " + (error.response?.data?.message || error.message));
                }
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (editingTask) {
            try {
                await deleteTask(editingTask._id);
                message.success("Đã xóa công việc!");
                setIsModalVisible(false);
                loadTasks();
            } catch (error) {
                message.error("Lỗi khi xóa");
            }
        }
    };

    // Lọc công việc theo tiêu chí tìm kiếm và bộ lọc
    const normalizeString = (str) => {
        return str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
    };

    const getFilteredTasks = () => {
        return tasks.filter(task => {
            let match = true;
            if (searchTerm) {
                const term = normalizeString(searchTerm);
                const title = normalizeString(task.title);
                const desc = normalizeString(task.description);
                match = match && (title.includes(term) || desc.includes(term));
            }
            if (filterStatus && filterStatus !== 'ALL') {
                match = match && (task.status === filterStatus);
            }
            if (filterAssignee) {
                match = match && task.assignees?.some(a => (a._id || a) === filterAssignee);
            }
            return match;
        });
    };

    const filteredTasks = getFilteredTasks();

    // Chuyển đổi dữ liệu tasks cho BigCalendar
    const events = filteredTasks.map(t => ({
        id: t._id,
        title: t.title,
        start: new Date(t.startDate),
        end: new Date(t.endDate),
        resource: t
    }));

    // Hàm tạo mã màu dựa theo trạng thái
    const eventStyleGetter = (event) => {
        let backgroundColor = '#3174ad';
        if (event.resource.status === 'DONE') backgroundColor = '#52c41a';
        else if (event.resource.status === 'IN_PROGRESS') backgroundColor = '#1890ff';
        else if (event.resource.status === 'TODO') backgroundColor = '#faad14';

        return {
            style: {
                backgroundColor,
                borderRadius: '5px',
                opacity: 0.8,
                color: 'white',
                border: '0px',
                display: 'block'
            }
        };
    };

    const renderGoogleCalendar = () => {
        if (!currentUser || !currentUser.email) {
            return (
                <div className="flex flex-col items-center justify-center h-[600px] bg-gray-50 border rounded text-gray-500">
                    <p>Không tìm thấy email của bạn để hiển thị lịch.</p>
                </div>
            );
        }

        const encodedEmail = encodeURIComponent(currentUser.email);
        const iframeSrc = `https://calendar.google.com/calendar/embed?src=${encodedEmail}&ctz=Asia%2FHo_Chi_Minh`;

        return (
            <div className="w-full h-[700px]">
                <div className="mb-2 text-right">
                    <a href="https://calendar.google.com/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                        Mở trực tiếp trên Google Calendar
                    </a>
                </div>
                <iframe 
                    src={iframeSrc} 
                    style={{ border: 0 }} 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    scrolling="no"
                    title="Google Calendar"
                ></iframe>
            </div>
        );
    };

    // --- DASHBOARD LOGIC ---
    const todoCount = tasks.filter(t => t.status === 'TODO').length;
    const inProgressCount = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const doneCount = tasks.filter(t => t.status === 'DONE').length;

    const pieData = [
        { name: 'Chưa làm', value: todoCount, color: '#ff4d4f' },
        { name: 'Đang làm', value: inProgressCount, color: '#1890ff' },
        { name: 'Hoàn thành', value: doneCount, color: '#52c41a' },
    ];

    const isListView = ['todo', 'inprogress', 'done'].includes(tab);

    const exportToExcel = () => {
        const filteredTasks = getFilteredTasks();
        const dataToExport = filteredTasks.map((t, index) => ({
            "STT": index + 1,
            "Tiêu đề": t.title,
            "Người thực hiện": t.assignees?.map(a => a.name).join(', '),
            "Bắt đầu": dayjs(t.startDate).format('DD/MM/YYYY HH:mm'),
            "Kết thúc": dayjs(t.endDate).format('DD/MM/YYYY HH:mm'),
            "Trạng thái": t.status === 'TODO' ? 'Chưa làm' : t.status === 'IN_PROGRESS' ? 'Đang làm' : 'Hoàn thành'
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Danh_sach_cong_viec");
        XLSX.writeFile(wb, "Danh_sach_cong_viec.xlsx");
    };

    const tableColumns = [
        { title: 'STT', key: 'stt', render: (text, record, index) => index + 1, width: 60 },
        { title: 'Tiêu đề', dataIndex: 'title', key: 'title', render: text => <b>{text}</b> },
        { 
            title: 'Người thực hiện', 
            key: 'assignees', 
            render: (_, record) => record.assignees?.map(a => <Tag color="blue" key={a._id}>{a.name}</Tag>) 
        },
        { 
            title: 'Người phối hợp', 
            key: 'collaborators', 
            render: (_, record) => record.collaborators?.length ? record.collaborators.map(a => <Tag color="cyan" key={a._id}>{a.name}</Tag>) : <span className="text-gray-400">Không có</span>
        },
        { 
            title: 'Tệp đính kèm', 
            key: 'files', 
            render: (_, record) => record.files?.length ? (
                <div className="flex flex-col gap-1">
                    {record.files.map((file, idx) => (
                        <a key={idx} href={`https://drive.google.com/file/d/${file.fileId}/view`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                            <FileTextOutlined /> <span className="truncate w-32 inline-block" title={file.fileName}>{file.fileName}</span>
                        </a>
                    ))}
                </div>
            ) : <span className="text-gray-400 text-xs">Không có</span>
        },
        { 
            title: 'Thời gian', 
            key: 'time', 
            render: (_, record) => (
                <div className="text-sm">
                    <p className="m-0 text-gray-500">Từ: {dayjs(record.startDate).format('DD/MM/YYYY HH:mm')}</p>
                    <p className="m-0 text-gray-500">Đến: {dayjs(record.endDate).format('DD/MM/YYYY HH:mm')}</p>
                </div>
            ) 
        },
        { 
            title: 'Mức độ', 
            dataIndex: 'priority', 
            key: 'priority', 
            render: priority => {
                const color = priority === 'FLASH' ? 'red' : priority === 'URGENT' ? 'orange' : 'blue';
                const label = priority === 'FLASH' ? 'Hỏa tốc' : priority === 'URGENT' ? 'Khẩn' : 'Bình thường';
                return <Tag color={color}>{label}</Tag>;
            }
        },
        { 
            title: 'Trạng thái', 
            dataIndex: 'status', 
            key: 'status', 
            render: status => {
                const color = status === 'TODO' ? 'red' : status === 'IN_PROGRESS' ? 'blue' : 'green';
                const label = status === 'TODO' ? 'Chưa làm' : status === 'IN_PROGRESS' ? 'Đang làm' : 'Hoàn thành';
                return <Tag color={color}>{label}</Tag>;
            }
        },
        {
              title: 'Thao tác',
              key: 'action',
              className: "action-col", fixed: "right",
              render: (_, record) => (
                  <div className="flex flex-col gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="Xem chi tiết">
                          <Button type="primary" size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); handleViewDetails(record); }} className="rounded-md !w-[110px] flex items-center justify-center  text-xs">
                              <span className="inline text-xs">Xem chi tiết</span>
                          </Button>
                      </Tooltip>
                      <Tooltip title="Cập nhật">
                          <Button type="default" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleSelectEvent({ resource: record }); }} className="rounded-md !w-[110px] flex items-center justify-center  border-orange-500 text-orange-500 hover:bg-orange-50 text-xs">
                              <span className="inline text-xs">Cập nhật</span>
                          </Button>
                      </Tooltip>
                      <Tooltip title="Lịch sử">
                          <Button type="default" size="small" icon={<HistoryOutlined />} onClick={(e) => { e.stopPropagation(); handleViewHistory(record); }} className="rounded-md !w-[110px] flex items-center justify-center  text-gray-500 border-gray-500 hover:bg-gray-50 text-xs">
                              <span className="inline text-xs">Lịch sử</span>
                          </Button>
                      </Tooltip>
                  </div>
              )
          }
    ];

    const renderTableView = () => {
        const filteredTasks = getFilteredTasks();
        return (
            <Table 
                columns={tableColumns} 
                dataSource={filteredTasks} 
                rowKey="_id"
                pagination={{ pageSize: 20 }}
                className="mt-4 shadow-sm border border-gray-100"
                scroll={{ x: 'max-content' }}
                onRow={(record) => ({
                    onClick: () => handleViewDetails(record),
                    style: { cursor: 'pointer' }
                })}
            />
        );
    };

    const renderDashboard = () => {
        if (isListView) return null;
        return (
        <div className="mb-6">
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

    // --- KANBAN BOARD LOGIC ---
    const handleDragStart = (e, taskId) => {
        e.dataTransfer.setData("taskId", taskId);
    };

    const handleDragOver = (e) => {
        e.preventDefault(); // Cho phép thả
    };

    const handleDrop = async (e, newStatus) => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("taskId");
        if (taskId) {
            const taskToMove = tasks.find(t => t._id === taskId);
            if (taskToMove && taskToMove.status !== newStatus) {
                // Optimistic update
                setTasks(prev => prev.map(t => t._id === taskId ? { ...t, status: newStatus } : t));
                
                try {
                    await updateTask(taskId, { status: newStatus });
                    message.success("Cập nhật trạng thái thành công");
                } catch (error) {
                    message.error("Lỗi khi cập nhật trạng thái");
                    loadTasks(); // Revert
                }
            }
        }
    };

    const getTaskHighlightClass = (task) => {
        if (task.status === "DONE") return "border-gray-200 bg-white border-l-green-500";
        if (!task.endDate) return "border-gray-200 bg-white border-l-blue-500";
        
        const end = new Date(task.endDate);
        end.setHours(23, 59, 59, 999);
        const now = new Date();
        const timeDiff = end.getTime() - now.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

        if (daysDiff < 0) {
            // Quá hạn
            return "border-red-500 bg-red-50 shadow-sm shadow-red-200";
        } else if (daysDiff >= 0 && daysDiff <= 3) {
            // Sắp đến hạn
            return "border-orange-500 bg-orange-50 shadow-sm shadow-orange-200";
        }
        return "border-gray-200 bg-white border-l-blue-500";
    };

    const renderKanbanBoard = () => {
        const columns = [
            { id: "TODO", title: "Chưa làm", color: "bg-gray-500" },
            { id: "IN_PROGRESS", title: "Đang làm", color: "bg-blue-500" },
            { id: "DONE", title: "Hoàn thành", color: "bg-green-500" },
        ];

        return (
            <div className="mt-8 border-t pt-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Bảng Công Việc (Kanban)</h3>
                <div className="flex flex-col md:flex-row gap-4 overflow-x-auto pb-4">
                    {columns.map(col => {
                        const colTasks = filteredTasks.filter(t => t.status === col.id);
                        const currentPage = kanbanPage[col.id] || 1;
                        const startIndex = (currentPage - 1) * KANBAN_PAGE_SIZE;
                        const paginatedTasks = colTasks.slice(startIndex, startIndex + KANBAN_PAGE_SIZE);

                        return (
                        <div 
                            key={col.id} 
                            className="flex-1 min-w-[300px] bg-gray-100 rounded-lg p-4 flex flex-col"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, col.id)}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="font-semibold text-gray-700">{col.title}</h4>
                                <span className={`${col.color} text-white text-xs px-2 py-1 rounded-full`}>
                                    {colTasks.length}
                                </span>
                            </div>
                            
                            <div className="flex flex-col gap-3 min-h-[150px] flex-grow">
                                {paginatedTasks.map(task => (
                                    <div
                                        key={task._id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, task._id)}
                                        onClick={() => {
                                            setEditingTask(task);
                                            form.setFieldsValue({
                                                title: task.title,
                                                description: task.description,
                                                dates: [dayjs(task.startDate), dayjs(task.endDate)],
                                                times: [dayjs(task.startDate), dayjs(task.endDate)],
                                                assignees: task.assignees.map(u => u._id ? u._id : u),
                                                status: task.status,
                                                priority: task.priority || 'NORMAL'
                                            });
                                            setIsModalVisible(true);
                                        }}
                                        className={`p-3 rounded border-l-4 cursor-pointer hover:shadow-md transition-shadow ${getTaskHighlightClass(task)}`}
                                    >
                                        <div className="font-medium text-gray-800 mb-1">
                                            {task.priority === 'FLASH' && <Tag color="red" className="mb-1">Hỏa tốc</Tag>}
                                            {task.priority === 'URGENT' && <Tag color="orange" className="mb-1">Khẩn</Tag>}
                                            {task.title}
                                        </div>
                                        {task.endDate && (
                                            <div className="text-xs text-gray-500 mb-2">
                                                Hạn: {moment(task.endDate).format("DD/MM/YYYY HH:mm")}
                                            </div>
                                        )}
                                        {task.assignees && task.assignees.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {task.assignees.map(a => {
                                                    const assignedUser = users.find(u => u._id === (a._id || a));
                                                    return (
                                                        <span key={a._id || a} className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                                                            {assignedUser ? assignedUser.name : "User"}
                                                        </span>
                                                    )
                                                })}
                                                {task.collaborators && task.collaborators.map(c => {
                                                    const colUser = users.find(u => u._id === (c._id || c));
                                                    return (
                                                        <span key={'col'+(c._id || c)} className="text-[10px] bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded">
                                                            {colUser ? colUser.name : "User"}
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            {colTasks.length > KANBAN_PAGE_SIZE && (
                                <div className="mt-4 flex justify-center">
                                    <Pagination 
                                        simple 
                                        current={currentPage} 
                                        pageSize={KANBAN_PAGE_SIZE} 
                                        total={colTasks.length} 
                                        onChange={(page) => setKanbanPage(prev => ({ ...prev, [col.id]: page }))} 
                                    />
                                </div>
                            )}
                        </div>
                    )})}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b pb-4 gap-4">
                <h2 className="text-2xl font-bold text-gray-800">Công việc</h2>
                
                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                    <Segmented 
                        options={['Hệ thống', 'Google']} 
                        value={viewMode}
                        onChange={setViewMode}
                    />
                    
                    {viewMode === 'Hệ thống' && (
                        <Button type="primary" onClick={() => handleSelectSlot({ start: new Date(), end: new Date() })}>
                            + Thêm công việc
                        </Button>
                    )}
                </div>
            </div>
            
            {/* Dashboard Component */}
            {renderDashboard()}
            
            <div className="mt-4">
                {viewMode === 'Hệ thống' && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-6 flex flex-wrap gap-4 items-center border border-gray-200">
                        <Input.Search 
                            placeholder="Tìm kiếm công việc..." 
                            allowClear 
                            onSearch={value => setSearchTerm(value)}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: 250 }}
                        />
                        <Select 
                            placeholder="Lọc theo trạng thái" 
                            value={filterStatus}
                            onChange={value => {
                                setFilterStatus(value);
                                if (value === 'TODO') navigate('/schedule/todo');
                                else if (value === 'IN_PROGRESS') navigate('/schedule/inprogress');
                                else if (value === 'DONE') navigate('/schedule/done');
                                else navigate('/schedule/all');
                            }}
                            style={{ width: 150 }}
                        >
                            <Option value="ALL">Tất cả</Option>
                            <Option value="TODO">Chưa làm</Option>
                            <Option value="IN_PROGRESS">Đang làm</Option>
                            <Option value="DONE">Hoàn thành</Option>
                        </Select>
                        <Select 
                            placeholder="Người thực hiện" 
                            allowClear
                            showSearch
                            optionFilterProp="children"
                            onChange={value => setFilterAssignee(value)}
                            style={{ width: 200 }}
                        >
                            {users.filter(u => u.role !== null).map(u => (
                                <Option key={u._id} value={u._id}>{u.name}</Option>
                            ))}
                        </Select>
                        {isListView && (
                            <Button type="primary" icon={<ExportOutlined />} onClick={exportToExcel} style={{ marginLeft: 'auto', backgroundColor: '#52c41a', borderColor: '#52c41a' }}>
                                Xuất Excel
                            </Button>
                        )}
                    </div>
                )}
                {viewMode === 'Hệ thống' ? (
                    isListView ? renderTableView() : (
                        <div style={{ height: '700px' }}>
                            <BigCalendar
                                localizer={localizer}
                            events={events}
                            startAccessor="start"
                            endAccessor="end"
                            style={{ height: '100%' }}
                            selectable
                            onSelectSlot={handleSelectSlot}
                            onSelectEvent={handleSelectEvent}
                            eventPropGetter={eventStyleGetter}
                            messages={{
                                next: "Sau",
                                previous: "Trước",
                                today: "Hôm nay",
                                month: "Tháng",
                                week: "Tuần",
                                day: "Ngày",
                                agenda: "Lịch trình"
                            }}
                        />
                    </div>
                    )
                ) : (
                    renderGoogleCalendar()
                )}
                {viewMode === 'Hệ thống' && !isListView && renderKanbanBoard()}
            </div>

            <Modal
                title={editingTask ? "Cập nhật công việc" : "Thêm công việc mới"}
                open={isModalVisible}
                onOk={handleOk}
                width={800}
                onCancel={() => setIsModalVisible(false)}
                footer={[
                    (editingTask && currentUser && (editingTask.createdBy?._id === currentUser._id || editingTask.createdBy === currentUser._id)) && <Button key="delete" danger onClick={handleDelete} disabled={isSaving}>Xóa</Button>,
                    <Button key="cancel" onClick={() => setIsModalVisible(false)} disabled={isSaving}>Hủy</Button>,
                    <Button key="submit" type="primary" onClick={handleOk} loading={isSaving}>{isSaving ? "Đang lưu..." : "Lưu"}</Button>
                ].filter(Boolean)}
            >
                <Form form={form} layout="vertical">
                    <Row gutter={[16, 16]}>
                        <Col span={24}>
                            <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item name="description" label="Nội dung">
                                <Input.TextArea rows={3} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="dates" label="Ngày thực hiện" rules={[{ required: true, message: 'Vui lòng chọn ngày' }]}>
                                <RangePicker format="DD/MM/YYYY" className="w-full" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="times" label="Giờ thực hiện (tùy chọn)">
                                <TimePicker.RangePicker format="HH:mm" className="w-full" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="priority" label="Mức độ công việc" initialValue="NORMAL">
                                <Select>
                                    <Option value="NORMAL">Bình thường</Option>
                                    <Option value="URGENT">Khẩn</Option>
                                    <Option value="FLASH">Hỏa tốc</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="assignees" label="Người thực hiện">
                                <Select mode="multiple" placeholder="Chọn người thực hiện" showSearch optionFilterProp="children">
                                    {users.filter(u => u.role !== null).map(u => {
                                        const isAssignee = editingTask && editingTask.assignees?.some(a => (a._id || a) === currentUser?._id);
                                        const isOriginalAssignee = editingTask && editingTask.assignees?.some(a => (a._id || a) === u._id);
                                        const disableRemoval = editingTask && ((!isAssignee && isOriginalAssignee) || (isOriginalAssignee && u._id === currentUser?._id));
                                        return (
                                            <Option key={u._id} value={u._id} disabled={disableRemoval}>{u.name} ({u.email})</Option>
                                        );
                                    })}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="collaborators" label="Người phối hợp">
                                <Select mode="multiple" placeholder="Chọn người phối hợp" showSearch optionFilterProp="children">
                                    {users.filter(u => u.role !== null).map(u => {
                                        const isAssignee = editingTask && editingTask.assignees?.some(a => (a._id || a) === currentUser?._id);
                                        const isOriginalCollaborator = editingTask && editingTask.collaborators?.some(c => (c._id || c) === u._id);
                                        const disableRemoval = editingTask && ((!isAssignee && isOriginalCollaborator) || (isOriginalCollaborator && u._id === currentUser?._id));
                                        return (
                                            <Option key={u._id} value={u._id} disabled={disableRemoval}>{u.name} ({u.email})</Option>
                                        );
                                    })}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={24}>
                            <Form.Item label="Tệp đính kèm">
                                <Upload
                                    multiple
                                    beforeUpload={() => false}
                                    fileList={fileList}
                                    onChange={(info) => {
                                        const newFileList = info.fileList.map(f => {
                                            if (f.originFileObj && !f.formattedName) {
                                                f.name = formatFileName(f.name);
                                                f.formattedName = true;
                                            }
                                            return f;
                                        });
                                        setFileList(newFileList);
                                    }}
                                >
                                    <Button icon={<UploadOutlined />}>Tải tệp lên</Button>
                                </Upload>
                            </Form.Item>
                        </Col>
                        {editingTask && (
                            <Col span={24}>
                                <Form.Item name="status" label="Trạng thái">
                                    <Select>
                                        <Option value="TODO">Chưa làm</Option>
                                        <Option value="IN_PROGRESS">Đang làm</Option>
                                        <Option value="DONE">Hoàn thành</Option>
                                    </Select>
                                </Form.Item>
                            </Col>
                        )}
                    </Row>
                </Form>
                {editingTask && editingTask.files && editingTask.files.length > 0 && (
                    <div style={{ marginTop: 15 }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Tệp đính kèm mới nhất:</h4>
                        <div className="flex flex-col gap-2">
                            {editingTask.files.map((file, index) => (
                                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border hover:bg-gray-100 transition-colors">
                                    <FileTextOutlined className="text-blue-500 text-lg" />
                                    <a href={`https://drive.google.com/file/d/${file.fileId}/view`} target="_blank" rel="noreferrer" className="flex-1 text-sm text-gray-700 hover:text-blue-600 truncate">
                                        {file.fileName}
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {editingTask && editingTask.relatedDocument && editingTask.relatedDocument.files && editingTask.relatedDocument.files.length > 0 && (
                    <div style={{ marginTop: 15 }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>Tệp từ văn bản liên quan:</h4>
                        <div className="flex flex-col gap-2">
                            {editingTask.relatedDocument.files.map((file, index) => (
                                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border hover:bg-gray-100 transition-colors">
                                    <FileTextOutlined className="text-blue-500 text-lg" />
                                    <a href={`https://drive.google.com/file/d/${file.fileId}/view`} target="_blank" rel="noreferrer" className="flex-1 text-sm text-gray-700 hover:text-blue-600 truncate">
                                        {file.fileName}
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal Xem chi tiết */}
            <Modal
                title="Chi tiết công việc"
                open={isDetailsVisible}
                onCancel={() => setIsDetailsVisible(false)}
                footer={[<Button key="close" onClick={() => setIsDetailsVisible(false)}>Đóng</Button>]}
                width={800}
            >
                {selectedTask && (
                    <div className="space-y-4 text-base">
                        {selectedTask.priority === 'FLASH' && (
                            <Alert message="Văn bản Hỏa tốc" description="Công việc này cần được xử lý ngay lập tức!" type="error" showIcon className="mb-4" />
                        )}
                        {selectedTask.priority === 'URGENT' && (
                            <Alert message="Văn bản Khẩn" description="Công việc này cần được ưu tiên xử lý sớm!" type="warning" showIcon className="mb-4" />
                        )}
                        <div><strong className="text-gray-600">Tiêu đề:</strong> <span className="text-lg font-semibold">{selectedTask.title}</span></div>
                        <div>
                            <strong className="text-gray-600">Mức độ:</strong> 
                            <Tag className="ml-2" color={selectedTask.priority === 'FLASH' ? 'red' : selectedTask.priority === 'URGENT' ? 'orange' : 'blue'}>
                                {selectedTask.priority === 'FLASH' ? 'Hỏa tốc' : selectedTask.priority === 'URGENT' ? 'Khẩn' : 'Bình thường'}
                            </Tag>
                        </div>
                        <div><strong className="text-gray-600">Trạng thái:</strong> <Tag className="ml-2" color={selectedTask.status === 'TODO' ? 'red' : selectedTask.status === 'IN_PROGRESS' ? 'blue' : 'green'}>{selectedTask.status === 'TODO' ? 'Chưa làm' : selectedTask.status === 'IN_PROGRESS' ? 'Đang làm' : 'Hoàn thành'}</Tag></div>
                        <div><strong className="text-gray-600">Thời gian:</strong> {dayjs(selectedTask.startDate).format('DD/MM/YYYY HH:mm')} - {dayjs(selectedTask.endDate).format('DD/MM/YYYY HH:mm')}</div>
                        <div><strong className="text-gray-600">Mô tả:</strong> <div className="mt-1 p-3 bg-gray-50 rounded whitespace-pre-wrap">{selectedTask.description || 'Không có mô tả'}</div></div>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <div><strong className="text-gray-600">Người thực hiện:</strong> {selectedTask.assignees?.map(a => <Tag color="blue" key={a._id}>{a.name}</Tag>)}</div>
                            </Col>
                            <Col span={12}>
                                <div><strong className="text-gray-600">Người phối hợp:</strong> {selectedTask.collaborators?.map(a => <Tag color="cyan" key={a._id}>{a.name}</Tag>)}</div>
                            </Col>
                        </Row>
                        <div>
                            <strong className="text-gray-600">Tệp đính kèm:</strong>
                            {selectedTask.files && selectedTask.files.length > 0 ? (
                                <div className="flex flex-col gap-2 mt-2">
                                    {selectedTask.files.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                                            <div className="flex items-center gap-2 overflow-hidden mr-2">
                                                <FileTextOutlined className="text-blue-500 flex-shrink-0" />
                                                <span className="truncate" title={file.fileName}>{file.fileName}</span>
                                            </div>
                                            <Space className="flex-shrink-0">
                                                <Button size="small" type="primary" ghost icon={<EyeOutlined />} onClick={() => window.open(`https://drive.google.com/file/d/${file.fileId}/view`, '_blank')} title="Xem file">Xem</Button>
                                                <Button size="small" icon={<ExportOutlined />} onClick={() => {
                                                    const link = document.createElement('a');
                                                    link.href = `https://drive.google.com/uc?export=download&id=${file.fileId}`;
                                                    link.setAttribute('download', '');
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                }} title="Tải xuống">Tải xuống</Button>
                                            </Space>
                                        </div>
                                    ))}
                                </div>
                            ) : <div className="text-gray-400 mt-1">Không có tệp đính kèm</div>}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal Lịch sử */}
            <Modal
                title="Lịch sử cập nhật"
                open={isHistoryVisible}
                onCancel={() => setIsHistoryVisible(false)}
                footer={[<Button key="close" onClick={() => setIsHistoryVisible(false)}>Đóng</Button>]}
            >
                {selectedTask && selectedTask.history && selectedTask.history.length > 0 ? (
                    <div className="flex flex-col h-full">
                        <Timeline className="mt-4 flex-grow">
                            {[...selectedTask.history].reverse().slice((historyPage - 1) * 5, historyPage * 5).map((h, i) => (
                                <Timeline.Item key={i} color={h.action === 'Tạo mới' ? 'green' : h.action === 'Cập nhật trạng thái' ? 'blue' : 'gray'}>
                                    <div className="text-xs text-gray-400">{dayjs(h.timestamp).format('DD/MM/YYYY HH:mm')}</div>
                                    <div className="font-semibold">{h.action} - <span className="text-blue-600">{h.user?.name || 'Người dùng ẩn'}</span></div>
                                    <div className="text-sm mt-1">{h.details}</div>
                                </Timeline.Item>
                            ))}
                        </Timeline>
                        {selectedTask.history.length > 5 && (
                            <div className="mt-4 flex justify-center">
                                <Pagination 
                                    simple 
                                    current={historyPage} 
                                    pageSize={5} 
                                    total={selectedTask.history.length} 
                                    onChange={(page) => setHistoryPage(page)} 
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-4">Chưa có lịch sử cập nhật nào.</div>
                )}
            </Modal>
        </div>
    );
};

export default SchedulePage;
