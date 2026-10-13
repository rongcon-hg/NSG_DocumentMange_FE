import React, { useState, useMemo } from 'react';
import { Button, Tag, Tooltip, Select, DatePicker, Empty, Progress } from 'antd';
import { 
    LeftOutlined, 
    RightOutlined, 
    CalendarOutlined, 
    BranchesOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    SyncOutlined,
    ExclamationCircleOutlined,
    UserOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;

/**
 * TaskGanttChart: Component vẽ biểu đồ Gantt Chart trực quan chuyên nghiệp
 * Hỗ trợ các góc nhìn Ngày, Tuần, Tháng, liên kết tiến độ và phụ thuộc
 */
const TaskGanttChart = ({ tasks = [], onTaskClick, focusAxes = [] }) => {
    const [viewMode, setViewMode] = useState('day'); // 'day', 'week', 'month'
    const [currentAnchorDate, setCurrentAnchorDate] = useState(dayjs());
    const [groupBy, setGroupBy] = useState('none'); // 'none', 'focusAxis', 'status'

    // Xác định dải thời gian hiển thị (Timeline bounds)
    const { startDate, endDate, totalDays, dateSlots } = useMemo(() => {
        let start, end;
        if (viewMode === 'day') {
            start = currentAnchorDate.subtract(3, 'day').startOf('day');
            end = currentAnchorDate.add(18, 'day').endOf('day');
        } else if (viewMode === 'week') {
            start = currentAnchorDate.subtract(1, 'month').startOf('week');
            end = currentAnchorDate.add(2, 'month').endOf('week');
        } else {
            // Month
            start = currentAnchorDate.subtract(2, 'month').startOf('month');
            end = currentAnchorDate.add(4, 'month').endOf('month');
        }

        const slots = [];
        let curr = start.clone();
        while (curr.isBefore(end) || curr.isSame(end, 'day')) {
            slots.push(curr.clone());
            curr = curr.add(1, 'day');
        }

        return {
            startDate: start,
            endDate: end,
            totalDays: slots.length,
            dateSlots: slots
        };
    }, [currentAnchorDate, viewMode]);

    // Chuẩn bị các task có ngày bắt đầu và kết thúc
    const validTasks = useMemo(() => {
        return (tasks || []).map(task => {
            const tStart = task.startDate ? dayjs(task.startDate) : dayjs(task.createdAt || new Date());
            const tEnd = task.endDate ? dayjs(task.endDate) : tStart.add(1, 'day');
            const now = dayjs();
            const isDone = task.status === 'DONE';
            const isOverdue = !isDone && tEnd.endOf('day').isBefore(now);
            const isDueSoon = !isDone && !isOverdue && tEnd.diff(now, 'day') <= 3;

            return {
                ...task,
                startDay: tStart,
                endDay: tEnd,
                isDone,
                isOverdue,
                isDueSoon
            };
        });
    }, [tasks]);

    // Nhóm công việc
    const groupedData = useMemo(() => {
        if (groupBy === 'none') {
            return [{ key: 'all', title: 'Tất cả công việc', tasks: validTasks }];
        }
        if (groupBy === 'status') {
            return [
                { key: 'TODO', title: 'Chưa làm', tasks: validTasks.filter(t => t.status === 'TODO'), color: '#faad14' },
                { key: 'IN_PROGRESS', title: 'Đang làm', tasks: validTasks.filter(t => t.status === 'IN_PROGRESS'), color: '#1890ff' },
                { key: 'DONE', title: 'Hoàn thành', tasks: validTasks.filter(t => t.status === 'DONE'), color: '#52c41a' },
            ];
        }
        if (groupBy === 'focusAxis') {
            const axisGroups = {};
            validTasks.forEach(t => {
                const axisKey = t.focusAxis || 'Chưa phân trục';
                if (!axisGroups[axisKey]) axisGroups[axisKey] = [];
                axisGroups[axisKey].push(t);
            });
            return Object.keys(axisGroups).map(k => ({
                key: k,
                title: k,
                tasks: axisGroups[k]
            }));
        }
        return [{ key: 'all', title: 'Tất cả công việc', tasks: validTasks }];
    }, [validTasks, groupBy]);

    // Hàm tính tọa độ thanh ngang Gantt (% left và % width)
    const getTaskBarPosition = (taskStart, taskEnd) => {
        const totalDuration = endDate.diff(startDate, 'minute');
        if (totalDuration <= 0) return { left: '0%', width: '0%' };

        const startDiff = taskStart.diff(startDate, 'minute');
        const endDiff = taskEnd.diff(startDate, 'minute');

        const leftRatio = Math.max(0, Math.min(1, startDiff / totalDuration));
        const rightRatio = Math.max(0, Math.min(1, endDiff / totalDuration));
        const widthRatio = Math.max(0.015, rightRatio - leftRatio);

        return {
            left: `${(leftRatio * 100).toFixed(2)}%`,
            width: `${(widthRatio * 100).toFixed(2)}%`
        };
    };

    // Vị trí của đường ngày hôm nay
    const todayPos = useMemo(() => {
        const now = dayjs();
        const totalDuration = endDate.diff(startDate, 'minute');
        if (now.isBefore(startDate) || now.isAfter(endDate) || totalDuration <= 0) return null;
        const diff = now.diff(startDate, 'minute');
        return `${((diff / totalDuration) * 100).toFixed(2)}%`;
    }, [startDate, endDate]);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col gap-4 select-none">
            {/* Thanh công cụ Gantt */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 text-sm sm:text-base flex items-center gap-1.5">
                        <CalendarOutlined className="text-blue-600" /> Tiến độ thời gian (Gantt Chart)
                    </span>
                    <Tag color="blue" className="rounded-full px-2.5 font-semibold text-xs">
                        {validTasks.length} nhiệm vụ
                    </Tag>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Chuyển tới lui thời gian */}
                    <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                        <Button 
                            type="text" 
                            size="small" 
                            icon={<LeftOutlined />} 
                            onClick={() => setCurrentAnchorDate(prev => prev.subtract(viewMode === 'day' ? 7 : 30, 'day'))}
                        />
                        <Button 
                            type="text" 
                            size="small" 
                            onClick={() => setCurrentAnchorDate(dayjs())}
                            className="font-medium text-blue-600"
                        >
                            Hôm nay
                        </Button>
                        <Button 
                            type="text" 
                            size="small" 
                            icon={<RightOutlined />} 
                            onClick={() => setCurrentAnchorDate(prev => prev.add(viewMode === 'day' ? 7 : 30, 'day'))}
                        />
                    </div>

                    {/* Chọn chế độ xem */}
                    <Select 
                        value={viewMode} 
                        size="small" 
                        onChange={setViewMode} 
                        style={{ width: 110 }}
                        className="text-xs"
                    >
                        <Option value="day">Theo Ngày</Option>
                        <Option value="week">Theo Tuần</Option>
                        <Option value="month">Theo Tháng</Option>
                    </Select>

                    {/* Phân nhóm */}
                    <Select 
                        value={groupBy} 
                        size="small" 
                        onChange={setGroupBy} 
                        style={{ width: 140 }}
                        className="text-xs"
                    >
                        <Option value="none">Không nhóm</Option>
                        <Option value="status">Theo Trạng thái</Option>
                        <Option value="focusAxis">Theo Trục kết quả</Option>
                    </Select>
                </div>
            </div>

            {/* Bảng chú giải màu sắc */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 px-1 py-0.5">
                <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block"></span> Hoàn thành
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-blue-500 inline-block"></span> Đang làm
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-amber-500 inline-block"></span> Chưa làm
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-red-500 ring-2 ring-red-200 inline-block animate-pulse"></span> Quá hạn
                </span>
                <span className="flex items-center gap-1.5 ml-auto text-slate-400">
                    <span className="w-2.5 h-0.5 bg-red-500 border-dashed border-t border-red-500 inline-block"></span> Đường kẻ đỏ: Hiện tại ({dayjs().format('DD/MM/YYYY')})
                </span>
            </div>

            {/* Khung nội dung Gantt */}
            {validTasks.length === 0 ? (
                <Empty description="Không có công việc nào trong danh sách hiện tại" className="my-8" />
            ) : (
                <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white relative">
                    <div className="min-w-[900px]">
                        {/* Timeline Header (Trục ngày tháng) */}
                        <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
                            {/* Cột tên công việc cố định bên trái */}
                            <div className="w-[280px] flex-shrink-0 p-3 font-semibold text-slate-700 text-xs border-r border-slate-200 bg-slate-100 flex items-center">
                                Nhiệm vụ / Công việc
                            </div>

                            {/* Cột các ngày */}
                            <div className="flex-1 relative flex">
                                {dateSlots.map((d, idx) => {
                                    const isToday = d.isSame(dayjs(), 'day');
                                    const isWeekend = d.day() === 0 || d.day() === 6;
                                    return (
                                        <div 
                                            key={idx} 
                                            className={`flex-1 text-center py-2 text-[11px] border-r border-slate-100 flex flex-col items-center justify-center min-w-[28px] ${
                                                isToday 
                                                    ? 'bg-blue-100/70 font-bold text-blue-700' 
                                                    : isWeekend 
                                                    ? 'bg-slate-100/50 text-slate-400' 
                                                    : 'text-slate-600'
                                            }`}
                                        >
                                            <span className="text-[10px] uppercase">{d.format('dd')}</span>
                                            <span className="font-semibold">{d.format('D')}</span>
                                            {viewMode === 'day' && idx === 0 && (
                                                <span className="text-[9px] text-slate-400">{d.format('MM/YY')}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Danh sách nhiệm vụ và các thanh ngang */}
                        <div className="relative">
                            {/* Đường chỉ đỏ thời gian hiện tại */}
                            {todayPos && (
                                <div 
                                    className="absolute top-0 bottom-0 z-10 pointer-events-none border-l-2 border-red-500 shadow-sm"
                                    style={{ left: `calc(280px + (100% - 280px) * ${parseFloat(todayPos) / 100})` }}
                                >
                                    <div className="bg-red-500 text-white text-[9px] px-1 py-0.5 rounded font-bold -translate-x-1/2 absolute -top-2">
                                        Hôm nay
                                    </div>
                                </div>
                            )}

                            {groupedData.map((group) => (
                                <div key={group.key} className="border-b border-slate-200 last:border-b-0">
                                    {/* Tiêu đề nhóm nếu có */}
                                    {groupBy !== 'none' && (
                                        <div className="bg-slate-100/80 px-3 py-1.5 text-xs font-bold text-slate-700 flex items-center justify-between border-b border-slate-200">
                                            <span>📁 {group.title}</span>
                                            <span className="text-slate-500 font-normal">({group.tasks.length} công việc)</span>
                                        </div>
                                    )}

                                    {group.tasks.map((task) => {
                                        const pos = getTaskBarPosition(task.startDay, task.endDay);
                                        const isMulti = (task.assignees || []).length > 1;
                                        
                                        // Màu sắc thanh tiến độ
                                        let barBg = 'bg-blue-500 border-blue-600 text-white hover:bg-blue-600';
                                        let statusBadge = 'Đang làm';
                                        if (task.isDone) {
                                            barBg = 'bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600';
                                            statusBadge = 'Hoàn thành';
                                        } else if (task.isOverdue) {
                                            barBg = 'bg-red-500 border-red-600 text-white shadow-md shadow-red-200 animate-pulse hover:bg-red-600';
                                            statusBadge = 'Quá hạn';
                                        } else if (task.status === 'TODO') {
                                            barBg = 'bg-amber-500 border-amber-600 text-white hover:bg-amber-600';
                                            statusBadge = 'Chưa làm';
                                        }

                                        // Tiến độ việc con
                                        const totalSub = task.subtasks?.length || 0;
                                        const doneSub = task.subtasks?.filter(s => s.status === 'DONE').length || 0;
                                        const subPercent = totalSub > 0 ? Math.round((doneSub / totalSub) * 100) : (task.isDone ? 100 : 0);

                                        return (
                                            <div 
                                                key={task._id} 
                                                className="flex items-center border-b border-slate-100 hover:bg-blue-50/40 transition-colors h-12"
                                            >
                                                {/* Cột trái: Tên công việc & Người phụ trách */}
                                                <div 
                                                    className="w-[280px] flex-shrink-0 px-3 py-1.5 border-r border-slate-200 truncate cursor-pointer"
                                                    onClick={() => onTaskClick && onTaskClick(task)}
                                                >
                                                    <div className="font-medium text-xs text-slate-800 truncate" title={task.title}>
                                                        {task.isOverdue && <span className="text-red-500 mr-1 font-bold">⚠️</span>}
                                                        {task.title}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                                        <span className="truncate max-w-[140px] flex items-center gap-0.5">
                                                            <UserOutlined /> {task.assignees?.map(a => a.name).join(', ') || 'Chưa gán'}
                                                        </span>
                                                        {totalSub > 0 && (
                                                            <span className="text-blue-600 font-semibold flex items-center gap-0.5">
                                                                <BranchesOutlined /> {doneSub}/{totalSub}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Cột phải: Dải Gantt Chart */}
                                                <div className="flex-1 relative h-full flex items-center">
                                                    {/* Các vạch cột nền */}
                                                    <div className="absolute inset-0 flex pointer-events-none">
                                                        {dateSlots.map((d, dIdx) => (
                                                            <div 
                                                                key={dIdx} 
                                                                className={`flex-1 border-r border-slate-100/70 h-full ${
                                                                    (d.day() === 0 || d.day() === 6) ? 'bg-slate-50/50' : ''
                                                                }`}
                                                            />
                                                        ))}
                                                    </div>

                                                    {/* Thanh thanh bar công việc */}
                                                    <Tooltip 
                                                        title={
                                                            <div className="text-xs space-y-1 p-1">
                                                                <div className="font-bold">{task.title}</div>
                                                                <div>Bắt đầu: {task.startDay.format('DD/MM/YYYY HH:mm')}</div>
                                                                <div>Hạn chót: {task.endDay.format('DD/MM/YYYY HH:mm')}</div>
                                                                <div>Trạng thái: <b>{statusBadge}</b></div>
                                                                <div>Người thực hiện: {task.assignees?.map(a => a.name).join(', ')}</div>
                                                                {totalSub > 0 && <div>Việc con: {doneSub}/{totalSub} ({subPercent}%)</div>}
                                                                <div className="text-cyan-300 text-[10px] italic">Nhấp để xem chi tiết / sửa</div>
                                                            </div>
                                                        }
                                                    >
                                                        <div 
                                                            onClick={() => onTaskClick && onTaskClick(task)}
                                                            className={`absolute h-7 rounded-md cursor-pointer flex items-center px-2 shadow-xs border transition-all text-xs font-semibold overflow-hidden group select-none ${barBg}`}
                                                            style={{
                                                                left: pos.left,
                                                                width: pos.width,
                                                                zIndex: 5
                                                            }}
                                                        >
                                                            {/* Thanh tiến độ nền chìm bên trong */}
                                                            {totalSub > 0 && (
                                                                <div 
                                                                    className="absolute left-0 top-0 bottom-0 bg-white/20 pointer-events-none"
                                                                    style={{ width: `${subPercent}%` }}
                                                                />
                                                            )}
                                                            <span className="truncate relative z-10 drop-shadow-xs">
                                                                {task.title}
                                                            </span>
                                                            <span className="ml-auto text-[10px] opacity-90 pl-1.5 flex-shrink-0 relative z-10">
                                                                {task.endDay.format('DD/MM')}
                                                            </span>
                                                        </div>
                                                    </Tooltip>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TaskGanttChart;
