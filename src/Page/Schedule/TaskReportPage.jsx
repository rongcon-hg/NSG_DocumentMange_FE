import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Card, Row, Col, Select, Button, Space, Typography, Spin, 
    Empty, Tag, message, Radio, DatePicker, Divider, Tooltip 
} from 'antd';
import { 
    PrinterOutlined, FileExcelOutlined, FilePdfOutlined, 
    ReloadOutlined, UserOutlined, ApartmentOutlined, CalendarOutlined,
    FileTextOutlined, CheckCircleOutlined, TrophyOutlined
} from '@ant-design/icons';
import ExcelJS from 'exceljs';
import dayjs from 'dayjs';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { getKpiStats, evaluateTask } from '../../api/taskApi';
import { getAllDepartments } from '../../api/DepartmentAPI';
import { getAllUsers, getUserInfo } from '../../api/auth';
import { categorizeUsers, isBghUser } from '../../utils/userClassification';
import { removeVietnameseTones as removeAccents } from '../../utils/stringUtils';

const { Title, Text } = Typography;
const { Option } = Select;

// Helper xóa dấu tiếng Việt phục vụ tìm kiếm & đặt tên file
const removeVietnameseTones = (str) => {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, '_');
};

// Helper hiển thị hệ số độ khó dạng % (100%, 110%, 120%)
const formatDiffRate = (diff) => {
    const n = diff !== undefined && diff !== null ? Number(diff) : 1.0;
    return `${Math.round(n * 100)}%`;
};

const TaskReportPage = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const currentQuarter = Math.ceil(currentMonth / 3);

    const reportPrintRef = useRef(null);

    // Filter states
    const [reportType, setReportType] = useState('PL4'); // 'PL3' (Phụ lục 3) hoặc 'PL4' (Phụ lục 4)
    const [periodType, setPeriodType] = useState('QUARTER'); // 'QUARTER' | 'MONTH' | 'YEAR'
    const [selectedQuarter, setSelectedQuarter] = useState(currentQuarter);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedDept, setSelectedDept] = useState(null);
    const [selectedUserId, setSelectedUserId] = useState(null);

    // Data states
    const [loading, setLoading] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [users, setUsers] = useState([]);
    const [statsData, setStatsData] = useState(null);

    // User permissions & profile
    const [currentUserObj, setCurrentUserObj] = useState(null);
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
                setCurrentUserId(uId);

                if (uId) {
                    getUserInfo(uId).then(res => {
                        const u = res?.data || res?.user || res;
                        if (u) {
                            setCurrentUserObj(u);
                            const dept = u.department;
                            const deptId = typeof dept === 'object' ? dept?._id : dept;
                            const deptCode = typeof dept === 'object' ? dept?.departmentCode : null;
                            if (deptId) {
                                setUserDeptId(deptId.toString());
                            }
                            if (deptCode) {
                                setUserDeptCode(deptCode);
                            }
                        }
                    }).catch(err => console.error("Error fetching user info:", err));
                }
            } catch (err) {
                console.error("Token decode error:", err);
            }
        }
    }, []);

    // 1. BGH / Manager / Admin: Xem được tất cả mọi người và tất cả phòng ban
    const isBGH = useMemo(() => {
        if (currentUserRole === 'admin' || currentUserRole === 'manager') return true;
        if (userDeptCode === 'BGH') return true;
        if (currentUserObj && isBghUser(currentUserObj)) return true;
        return false;
    }, [currentUserRole, userDeptCode, currentUserObj]);

    // 2. Cấp trưởng: Hiển thị hết thông tin của người dùng trong đơn vị mình
    const isCapTruong = useMemo(() => {
        if (isBGH) return false;
        return currentUserRole === 'staff' || currentUserRole === 'captruong';
    }, [isBGH, currentUserRole]);

    // 3. Cấp phó và Chuyên viên: Chỉ thấy thông tin của cá nhân mình thôi
    const isCapPhoOrChuyenVien = useMemo(() => {
        if (isBGH || isCapTruong) return false;
        return true;
    }, [isBGH, isCapTruong]);

    // Tải danh mục phòng ban và người dùng
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [deptRes, userRes] = await Promise.all([
                    getAllDepartments(),
                    getAllUsers()
                ]);

                const deptList = deptRes?.AllDepartment || deptRes?.departments || deptRes?.data || (Array.isArray(deptRes) ? deptRes : []);
                setDepartments(deptList);

                if (userRes && Array.isArray(userRes.users)) {
                    setUsers(userRes.users.filter(u => u.role !== null && u.email?.toLowerCase() !== 'qlvb@nsgpc.edu.vn'));
                }
            } catch (err) {
                console.error("Lỗi nạp dữ liệu ban đầu:", err);
            }
        };
        fetchData();
    }, []);

    // Đồng bộ phòng ban của người dùng hiện tại từ danh sách users
    useEffect(() => {
        if (currentUserId && users.length > 0) {
            const self = users.find(u => String(u._id) === String(currentUserId));
            if (self) {
                if (!currentUserObj) setCurrentUserObj(self);
                const d = self.department;
                const dId = typeof d === 'object' ? d?._id : d;
                const dCode = typeof d === 'object' ? d?.departmentCode : null;
                if (dId && !userDeptId) {
                    setUserDeptId(dId.toString());
                }
                if (dCode && !userDeptCode) {
                    setUserDeptCode(dCode);
                }
            }
        }
    }, [currentUserId, users, currentUserObj, userDeptId, userDeptCode]);

    // Xác định ID phòng ban của người dùng hiện tại
    const myEffectiveDeptId = useMemo(() => {
        if (userDeptId) return userDeptId.toString();
        const selfInList = users.find(u => String(u._id) === String(currentUserId));
        const d = selfInList?.department || currentUserObj?.department;
        const dId = typeof d === 'object' ? d?._id : d;
        return dId ? dId.toString() : null;
    }, [userDeptId, users, currentUserId, currentUserObj]);

    // Tên phòng ban của người dùng hiện tại
    const myEffectiveDeptName = useMemo(() => {
        const foundInDepts = departments.find(d => String(d._id) === String(myEffectiveDeptId));
        if (foundInDepts?.departmentName) return foundInDepts.departmentName;
        const selfInList = users.find(u => String(u._id) === String(currentUserId));
        const d = selfInList?.department || currentUserObj?.department;
        return typeof d === 'object' ? d?.departmentName : '';
    }, [departments, myEffectiveDeptId, users, currentUserId, currentUserObj]);

    // Thiết lập phòng ban mặc định theo vai trò:
    // - BGH: mặc định xem "Tất cả phòng ban / đơn vị" ("")
    // - Cấp trưởng, Cấp phó, Chuyên viên: luôn luôn gán và khóa vào đơn vị của chính mình
    useEffect(() => {
        if (!isBGH && myEffectiveDeptId) {
            if (selectedDept !== myEffectiveDeptId) {
                setSelectedDept(myEffectiveDeptId);
            }
        } else if (isBGH && selectedDept === null) {
            setSelectedDept("");
        }
    }, [isBGH, myEffectiveDeptId, selectedDept]);

    // Lọc danh sách nhân viên theo quyền hạn và phòng ban:
    // - Cấp phó & Chuyên viên: CHỈ THẤY DUY NHẤT CHÍNH MÌNH
    // - Cấp trưởng: BẮT BUỘC CHỈ THẤY NHÂN SỰ TRONG ĐƠN VỊ MÌNH
    // - BGH / Admin / Manager: Xem toàn trường hoặc theo phòng ban đã chọn
    const filteredUsers = useMemo(() => {
        if (isCapPhoOrChuyenVien) {
            const found = users.filter(u => String(u._id) === String(currentUserId));
            if (found.length > 0) return found;
            const selfInList = users.find(u => String(u._id) === String(currentUserId));
            if (selfInList) return [selfInList];
            if (currentUserObj) return [currentUserObj];
            return [];
        }

        let list = users;
        if (isCapTruong) {
            // Cấp trưởng: BẮT BUỘC CHỈ LỌC NHÂN SỰ THUỘC ĐƠN VỊ CỦA MÌNH
            if (myEffectiveDeptId) {
                list = list.filter(u => {
                    const uDept = u.department?._id || u.department;
                    return String(uDept) === String(myEffectiveDeptId);
                });
            } else {
                return [];
            }
        } else if (selectedDept) {
            // BGH / Admin / Manager đã chọn phòng ban cụ thể
            list = list.filter(u => {
                const uDept = u.department?._id || u.department;
                return String(uDept) === String(selectedDept);
            });
        }
        return list;
    }, [users, selectedDept, isBGH, isCapTruong, isCapPhoOrChuyenVien, currentUserId, myEffectiveDeptId, currentUserObj]);

    // Phân nhóm cán bộ / nhân viên theo 5 nhóm chuẩn giống bên ban hành văn bản
    const userGroups = useMemo(() => {
        return categorizeUsers(filteredUsers);
    }, [filteredUsers]);

    // BỎ TỰ ĐỘNG CHỌN CÁN BỘ / NHÂN VIÊN:
    // Người dùng bắt buộc phải tự chọn từ danh sách để hiển thị báo cáo.
    // Nếu nhân sự đang chọn không còn nằm trong filteredUsers thì reset về null.
    useEffect(() => {
        if (selectedUserId && selectedUserId !== 'ALL') {
            const exists = filteredUsers.some(u => String(u._id) === String(selectedUserId));
            if (!exists) {
                setSelectedUserId(null);
            }
        }
    }, [filteredUsers, selectedUserId]);

    // Tải dữ liệu KPI từ Backend
    const fetchKpiData = async () => {
        if (!selectedUserId) {
            setStatsData(null);
            return;
        }
        setLoading(true);
        try {
            const params = {
                year: selectedYear,
            };
            if (periodType === 'QUARTER') {
                params.quarter = selectedQuarter;
            } else if (periodType === 'MONTH') {
                params.month = selectedMonth;
            }

            if (selectedDept) params.departmentId = selectedDept;
            if (selectedUserId && selectedUserId !== 'ALL') params.userId = selectedUserId;

            const res = await getKpiStats(params);
            if (res && res.success) {
                setStatsData(res.data);
            }
        } catch (err) {
            console.error("Lỗi lấy dữ liệu KPI:", err);
            message.error("Không thể tải dữ liệu báo cáo");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedUserId) {
            fetchKpiData();
        } else {
            setStatsData(null);
        }
    }, [periodType, selectedQuarter, selectedMonth, selectedYear, selectedDept, selectedUserId]);

    // Phân quyền cho phép chỉnh sửa Kết quả % (Cấp trưởng, Ban Giám hiệu, Admin, Manager)
    const canEditQualityRate = useMemo(() => {
        return isBGH || isCapTruong;
    }, [isBGH, isCapTruong]);

    // Xử lý cập nhật Kết quả % trực tiếp trên bảng dữ liệu
    const handleUpdateQualityRate = async (taskItem, newRate) => {
        const taskId = taskItem.taskId || taskItem._id;
        const subtaskId = taskItem.subtaskInfo?._id || null;

        if (!taskId) {
            message.error("Không tìm thấy mã công việc");
            return;
        }

        const prevQualityRate = taskItem.qualityRate;

        // Cập nhật lạc quan (optimistic update) trên statsData để UI và điểm KPI phản hồi ngay lập tức
        setStatsData(prev => {
            if (!prev || !prev.leaderboard) return prev;
            const updatedLeaderboard = prev.leaderboard.map(member => {
                const updatedDetails = member.details?.map(d => {
                    const matchTask = String(d.taskId || d._id) === String(taskId);
                    const matchSubtask = subtaskId ? String(d.subtaskInfo?._id) === String(subtaskId) : true;
                    if (matchTask && matchSubtask) {
                        return {
                            ...d,
                            qualityRate: newRate,
                            qualityScore: newRate,
                            evaluation: {
                                ...(d.evaluation || {}),
                                qualityRate: newRate
                            },
                            subtaskInfo: d.subtaskInfo ? {
                                ...d.subtaskInfo,
                                evaluation: {
                                    ...(d.subtaskInfo.evaluation || {}),
                                    qualityRate: newRate
                                }
                            } : null
                        };
                    }
                    return d;
                });
                return {
                    ...member,
                    details: updatedDetails
                };
            });
            return {
                ...prev,
                leaderboard: updatedLeaderboard
            };
        });

        try {
            await evaluateTask(taskId, {
                qualityRate: newRate,
                subtaskId: subtaskId || undefined
            });
            message.success("Đã lưu kết quả % đánh giá!");
        } catch (error) {
            console.error("Lỗi cập nhật kết quả %:", error);
            message.error(error.response?.data?.message || "Không thể lưu kết quả %, đã hoàn tác.");
            // Hoàn tác nếu lỗi
            setStatsData(prev => {
                if (!prev || !prev.leaderboard) return prev;
                const updatedLeaderboard = prev.leaderboard.map(member => {
                    const updatedDetails = member.details?.map(d => {
                        const matchTask = String(d.taskId || d._id) === String(taskId);
                        const matchSubtask = subtaskId ? String(d.subtaskInfo?._id) === String(subtaskId) : true;
                        if (matchTask && matchSubtask) {
                            return {
                                ...d,
                                qualityRate: prevQualityRate,
                                qualityScore: prevQualityRate
                            };
                        }
                        return d;
                    });
                    return {
                        ...member,
                        details: updatedDetails
                    };
                });
                return {
                    ...prev,
                    leaderboard: updatedLeaderboard
                };
            });
        }
    };

    // Danh sách bản ghi báo cáo cần render (1 cá nhân hoặc toàn bộ đơn vị)
    const recordsToRender = useMemo(() => {
        if (!selectedUserId || !statsData?.leaderboard || statsData.leaderboard.length === 0) return [];
        if (selectedUserId === 'ALL') {
            return statsData.leaderboard;
        }
        const found = statsData.leaderboard.find(item => item.user?._id === selectedUserId);
        return found ? [found] : [];
    }, [statsData, selectedUserId]);

    // Lấy thông tin cán bộ đại diện được chọn
    const currentUserRecord = recordsToRender[0] || null;

    // Thông tin kỳ đánh giá dạng văn bản
    const periodLabel = useMemo(() => {
        if (periodType === 'QUARTER') {
            const qRoman = selectedQuarter === 1 ? 'I' : selectedQuarter === 2 ? 'II' : selectedQuarter === 3 ? 'III' : 'IV';
            return `QUÝ ${qRoman}, NĂM ${selectedYear}`;
        }
        if (periodType === 'MONTH') return `THÁNG ${selectedMonth}, NĂM ${selectedYear}`;
        return `NĂM ${selectedYear}`;
    }, [periodType, selectedQuarter, selectedMonth, selectedYear]);

    // Helper tạo trang Excel cho Phụ lục 3 với đầy đủ kẻ ô và canh lề chuẩn
    const addPhuLuc3Sheet = (workbook, record, sheetName) => {
        const user = record.user || {};
        const userName = user.name || '';
        const userPosition = user.position?.positionName || '';
        const details = record.details || [];

        const ws = workbook.addWorksheet(sheetName, {
            pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 }
        });

        // 9 cột chuẩn
        ws.columns = [
            { key: 'col1', width: 6 },   // TT
            { key: 'col2', width: 34 },  // Tên công việc
            { key: 'col3', width: 22 },  // Kết quả đầu ra
            { key: 'col4', width: 16 },  // Thời hạn hoàn thành
            { key: 'col5', width: 16 },  // Loại công việc
            { key: 'col6', width: 12 },  // Điểm chuẩn
            { key: 'col7', width: 14 },  // Hệ số độ khó
            { key: 'col8', width: 16 },  // Điểm quy đổi tối đa
            { key: 'col9', width: 32 },  // Minh chứng
        ];

        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };

        // Row 1: Phụ lục 3
        const r1 = ws.addRow(['', '', '', '', '', '', '', '', 'Phụ lục 3']);
        r1.getCell(9).font = { name: 'Times New Roman', size: 11, bold: true, italic: true };
        r1.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };

        // Row 2: Header cơ quan
        ws.mergeCells('A2:D2');
        ws.mergeCells('E2:I2');
        const r2 = ws.getRow(2);
        r2.getCell(1).value = 'ỦY BAN NHÂN DÂN';
        r2.getCell(1).font = { name: 'Times New Roman', size: 11 };
        r2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        r2.getCell(5).value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
        r2.getCell(5).font = { name: 'Times New Roman', size: 11, bold: true };
        r2.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

        // Row 3
        ws.mergeCells('A3:D3');
        ws.mergeCells('E3:I3');
        const r3 = ws.getRow(3);
        r3.getCell(1).value = 'THÀNH PHỐ HỒ CHÍ MINH';
        r3.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true };
        r3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        r3.getCell(5).value = 'Độc lập - Tự do - Hạnh phúc';
        r3.getCell(5).font = { name: 'Times New Roman', size: 11, bold: true, underline: true };
        r3.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

        // Row 4
        ws.mergeCells('A4:D4');
        const r4 = ws.getRow(4);
        r4.getCell(1).value = 'TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN';
        r4.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true, underline: true };
        r4.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.addRow([]); // Row 5

        // Row 6: Tiêu đề chính
        ws.mergeCells('A6:I6');
        const r6 = ws.getRow(6);
        r6.getCell(1).value = 'DANH MỤC SẢN PHẨM CÔNG VIỆC CỦA CÁ NHÂN';
        r6.getCell(1).font = { name: 'Times New Roman', size: 14, bold: true };
        r6.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        // Row 7: Kỳ đánh giá
        ws.mergeCells('A7:I7');
        const r7 = ws.getRow(7);
        r7.getCell(1).value = periodLabel;
        r7.getCell(1).font = { name: 'Times New Roman', size: 12, bold: true, italic: true };
        r7.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.addRow([]); // Row 8

        // Row 9 & 10: Thông tin cá nhân
        const r9 = ws.addRow([`Họ và tên: ${userName}`]);
        r9.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true };
        const r10 = ws.addRow([`Chức vụ: ${userPosition}`]);
        r10.getCell(1).font = { name: 'Times New Roman', size: 11 };

        ws.addRow([]); // Row 11

        // Header Table
        const headerRow = ws.addRow([
            'TT',
            'Tên công việc',
            'Kết quả đầu ra',
            'Thời hạn hoàn thành',
            'Loại công việc',
            'Điểm chuẩn',
            'Hệ số độ khó',
            'Điểm quy đổi tối đa',
            'Minh chứng/thể hiện số liệu kết quả đối với các nhiệm vụ vượt tiến độ'
        ]);
        headerRow.height = 36;
        for (let c = 1; c <= 9; c++) {
            const cell = headerRow.getCell(c);
            cell.font = { name: 'Times New Roman', size: 10, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = thinBorder;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        }

        // Subheader (1) to (9)
        const subHeader = ws.addRow(['(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)', '(9)']);
        subHeader.height = 20;
        for (let c = 1; c <= 9; c++) {
            const cell = subHeader.getCell(c);
            cell.font = { name: 'Times New Roman', size: 10, italic: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = thinBorder;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
        }

        let totalExceeded = 0;
        let totalBonus = 0;

        details.forEach((t, idx) => {
            const base = t.baseScore !== undefined ? t.baseScore : (t.taskType === 'URGENT' ? 12 : 10);
            const diff = t.difficultyRate !== undefined ? t.difficultyRate : 1.0;
            const maxS = Number((base * diff).toFixed(2));
            const typeName = (t.taskType === 'URGENT' || t.priority === 'URGENT' || t.priority === 'FLASH') ? 'Đột xuất' : 'Thường xuyên';
            const deadline = (t.subtaskInfo?.endDate || t.endDate) ? dayjs(t.subtaskInfo?.endDate || t.endDate).format('DD/MM/YYYY') : '';
            const compDate = t.subtaskInfo?.completedAt || t.completedAt;
            let proof = 'Đang thực hiện';
            if (compDate) {
                proof = `Hoàn thành ngày ${dayjs(compDate).format('DD/MM/YYYY')}`;
            } else if (t.isOverdue) {
                proof = 'Quá hạn';
            } else if (t.status === 'TODO') {
                proof = 'Chưa thực hiện';
            }

            if (t.isExceeded) totalExceeded += 1;
            if (t.bonusScore) totalBonus += Number(t.bonusScore);

            const row = ws.addRow([
                idx + 1,
                t.subtaskInfo?.title ? `${t.title} (Việc con: ${t.subtaskInfo.title})` : (t.title || ''),
                output,
                deadline,
                typeName,
                base,
                formatDiffRate(diff),
                maxS,
                proof
            ]);
            row.height = 28;
            row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle', bold: true };
            row.getCell(9).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

            for (let c = 1; c <= 9; c++) {
                row.getCell(c).font = { name: 'Times New Roman', size: 11, bold: c === 8 };
                row.getCell(c).border = thinBorder;
            }
        });

        // Tổng kết chân bảng Phụ lục 3
        const sumRow1 = ws.addRow(['', 'Tổng số nhiệm vụ thực hiện trong quý', details.length, '', '', '', '', '', '']);
        ws.mergeCells(`B${sumRow1.number}:C${sumRow1.number}`);
        ws.mergeCells(`D${sumRow1.number}:I${sumRow1.number}`);
        sumRow1.getCell(2).font = { name: 'Times New Roman', size: 11, bold: true };
        sumRow1.getCell(4).font = { name: 'Times New Roman', size: 11, bold: true };

        const sumRow2 = ws.addRow(['', 'Tổng số nhiệm vụ vượt tiến độ/chất lượng', totalExceeded, '', '', '', '', '', '']);
        ws.mergeCells(`B${sumRow2.number}:C${sumRow2.number}`);
        ws.mergeCells(`D${sumRow2.number}:I${sumRow2.number}`);
        sumRow2.getCell(2).font = { name: 'Times New Roman', size: 11, bold: true };
        sumRow2.getCell(4).font = { name: 'Times New Roman', size: 11, bold: true };

        const sumRow3 = ws.addRow(['', 'Tổng số điểm thưởng được đề xuất trong các nhiệm vụ vượt tiến độ/đạt chất lượng', totalBonus > 0 ? totalBonus : '....', '', '', '', '', '', '']);
        ws.mergeCells(`B${sumRow3.number}:C${sumRow3.number}`);
        ws.mergeCells(`D${sumRow3.number}:I${sumRow3.number}`);
        sumRow3.getCell(2).font = { name: 'Times New Roman', size: 11, bold: true };
        sumRow3.getCell(4).font = { name: 'Times New Roman', size: 11, bold: true };

        ws.addRow([]);
        ws.addRow([]);

        // Chữ ký
        const sigRow1 = ws.addRow([
            '', '', '', '', '', '',
            `TP. Hồ Chí Minh, ngày ... tháng ... năm ${selectedYear}`, '', ''
        ]);
        ws.mergeCells(`G${sigRow1.number}:I${sigRow1.number}`);
        sigRow1.getCell(7).font = { name: 'Times New Roman', size: 11, italic: true };
        sigRow1.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

        const sigRow2 = ws.addRow([
            'XÁC NHẬN CỦA LÃNH ĐẠO ĐƠN VỊ', '', '', '', '', '',
            'CÁ NHÂN LẬP DANH MỤC SẢN PHẨM CÔNG VIỆC', '', ''
        ]);
        ws.mergeCells(`A${sigRow2.number}:D${sigRow2.number}`);
        ws.mergeCells(`G${sigRow2.number}:I${sigRow2.number}`);
        sigRow2.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true };
        sigRow2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        sigRow2.getCell(7).font = { name: 'Times New Roman', size: 11, bold: true };
        sigRow2.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

        const sigRow3 = ws.addRow([
            '(Ký, ghi rõ họ tên)', '', '', '', '', '',
            '(Ký, ghi rõ họ tên)', '', ''
        ]);
        ws.mergeCells(`A${sigRow3.number}:D${sigRow3.number}`);
        ws.mergeCells(`G${sigRow3.number}:I${sigRow3.number}`);
        sigRow3.getCell(1).font = { name: 'Times New Roman', size: 10, italic: true };
        sigRow3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        sigRow3.getCell(7).font = { name: 'Times New Roman', size: 10, italic: true };
        sigRow3.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.addRow([]);
        ws.addRow([]);
        ws.addRow([]);

        const sigRowName = ws.addRow([
            '', '', '', '', '', '',
            userName, '', ''
        ]);
        ws.mergeCells(`G${sigRowName.number}:I${sigRowName.number}`);
        sigRowName.getCell(7).font = { name: 'Times New Roman', size: 11, bold: true };
        sigRowName.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    };

    // Helper tạo trang Excel cho Phụ lục 4 với đầy đủ kẻ ô và canh lề chuẩn
    const addPhuLuc4Sheet = (workbook, record, sheetName) => {
        const user = record.user || {};
        const userName = user.name || '';
        const userPosition = user.position?.positionName || '';
        const details = record.details || [];

        const ws = workbook.addWorksheet(sheetName, {
            pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
        });

        // 10 cột chuẩn
        ws.columns = [
            { key: 'col1', width: 6 },   // TT
            { key: 'col2', width: 35 },  // Tên công việc
            { key: 'col3', width: 12 },  // Điểm chuẩn
            { key: 'col4', width: 14 },  // Hệ số độ khó
            { key: 'col5', width: 15 },  // Điểm quy đổi tối đa
            { key: 'col6', width: 12 },  // Tiến độ %
            { key: 'col7', width: 12 },  // Kết quả %
            { key: 'col8', width: 16 },  // Điểm thực hiện
            { key: 'col9', width: 16 },  // Điểm quy đổi thực tế
            { key: 'col10', width: 22 }, // Công việc vượt yêu cầu (đánh dấu X)
        ];

        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };

        // Row 1: Phụ lục 4
        const r1 = ws.addRow(['', '', '', '', '', '', '', '', '', 'Phụ lục 4']);
        r1.getCell(10).font = { name: 'Times New Roman', size: 11, bold: true, italic: true };
        r1.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };

        // Row 2: Cơ quan
        ws.mergeCells('A2:E2');
        ws.mergeCells('F2:J2');
        const r2 = ws.getRow(2);
        r2.getCell(1).value = 'ỦY BAN NHÂN DÂN';
        r2.getCell(1).font = { name: 'Times New Roman', size: 11 };
        r2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        r2.getCell(6).value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
        r2.getCell(6).font = { name: 'Times New Roman', size: 11, bold: true };
        r2.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

        // Row 3
        ws.mergeCells('A3:E3');
        ws.mergeCells('F3:J3');
        const r3 = ws.getRow(3);
        r3.getCell(1).value = 'THÀNH PHỐ HỒ CHÍ MINH';
        r3.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true };
        r3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        r3.getCell(6).value = 'Độc lập - Tự do - Hạnh phúc';
        r3.getCell(6).font = { name: 'Times New Roman', size: 11, bold: true, underline: true };
        r3.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

        // Row 4
        ws.mergeCells('A4:E4');
        const r4 = ws.getRow(4);
        r4.getCell(1).value = 'TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN';
        r4.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true, underline: true };
        r4.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.addRow([]); // Row 5

        // Row 6: Tiêu đề
        ws.mergeCells('A6:J6');
        const r6 = ws.getRow(6);
        r6.getCell(1).value = 'BẢNG TÍNH ĐIỂM KPI CỦA CÁ NHÂN';
        r6.getCell(1).font = { name: 'Times New Roman', size: 14, bold: true };
        r6.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        // Row 7: Kỳ đánh giá
        ws.mergeCells('A7:J7');
        const r7 = ws.getRow(7);
        r7.getCell(1).value = periodLabel;
        r7.getCell(1).font = { name: 'Times New Roman', size: 12, bold: true, italic: true };
        r7.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.addRow([]); // Row 8

        // Row 9 & 10: Họ tên & Chức vụ
        const r9 = ws.addRow([`Họ và tên: ${userName}`]);
        r9.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true };
        const r10 = ws.addRow([`Chức vụ: ${userPosition}`]);
        r10.getCell(1).font = { name: 'Times New Roman', size: 11 };

        ws.addRow([]); // Row 11

        // Header bảng 10 cột
        const headerRow = ws.addRow([
            'TT',
            'Tên công việc',
            'Điểm chuẩn',
            'Hệ số độ khó',
            'Điểm quy đổi tối đa',
            'Tiến độ %',
            'Kết quả %',
            'Điểm thực hiện',
            'Điểm quy đổi thực tế',
            'Công việc vượt yêu cầu về tiến độ/ chất lượng (đánh dấu X)'
        ]);
        headerRow.height = 36;
        for (let c = 1; c <= 10; c++) {
            const cell = headerRow.getCell(c);
            cell.font = { name: 'Times New Roman', size: 10, bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = thinBorder;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        }

        // Subheader (1) to (10)
        const subHeader = ws.addRow(['(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)', '(9)', '(10)']);
        subHeader.height = 20;
        for (let c = 1; c <= 10; c++) {
            const cell = subHeader.getCell(c);
            cell.font = { name: 'Times New Roman', size: 10, italic: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = thinBorder;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
        }

        let sumMax = 0;
        let sumActual = 0;
        let totalExceeded = 0;
        let totalBonus = 0;

        details.forEach((t, idx) => {
            const isDone = (t.subtaskInfo ? t.subtaskInfo.status === 'DONE' : t.status === 'DONE');
            let isPending = false;
            if (t.isPendingWithinDeadline !== undefined) {
                isPending = Boolean(t.isPendingWithinDeadline);
            } else if (!isDone) {
                const deadlineStr = t.subtaskInfo?.endDate || t.endDate;
                if (!deadlineStr) {
                    isPending = true;
                } else {
                    const deadline = new Date(deadlineStr);
                    deadline.setHours(23, 59, 59, 999);
                    isPending = (new Date().getTime() <= deadline.getTime());
                }
            }

            const base = t.baseScore !== undefined ? t.baseScore : (t.taskType === 'URGENT' ? 12 : 10);
            const diff = t.difficultyRate !== undefined ? t.difficultyRate : 1.0;
            const maxS = Number((base * diff).toFixed(2));
            
            let progText = '';
            let qualText = '';
            let execVal = '';
            let actVal = '';
            let exc = '';

            if (!isPending) {
                const prog = t.progressRate !== undefined && t.progressRate !== null 
                    ? t.progressRate 
                    : (isDone ? (t.isOnTime ? 100 : 80) : 0);
                const qual = t.qualityRate !== undefined && t.qualityRate !== null 
                    ? t.qualityRate 
                    : (isDone ? 100 : 60);
                const exec = Number((base * (0.3 * (prog / 100) + 0.7 * (qual / 100))).toFixed(2));
                const act = Number((exec * diff).toFixed(2));
                
                progText = `${prog}%`;
                qualText = `${qual}%`;
                execVal = exec;
                actVal = act;
                exc = t.isExceeded ? 'X' : '';
                
                sumMax += maxS;
                sumActual += act;
                if (t.isExceeded) totalExceeded += 1;
            }
            if (t.bonusScore) totalBonus += Number(t.bonusScore);

            const row = ws.addRow([
                idx + 1,
                t.subtaskInfo?.title ? `${t.title} (Việc con: ${t.subtaskInfo.title})` : (t.title || ''),
                base,
                formatDiffRate(diff),
                maxS,
                progText,
                qualText,
                execVal,
                actVal,
                exc
            ]);
            row.height = 28;
            row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle', bold: true };
            row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
            row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle', bold: true };
            row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle', bold: true };

            for (let c = 1; c <= 10; c++) {
                row.getCell(c).font = { name: 'Times New Roman', size: 11, bold: (c === 5 || c === 9 || c === 10) };
                row.getCell(c).border = thinBorder;
                if (c === 10 && exc) {
                    row.getCell(c).font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FFCC0000' } };
                }
            }
        });

        const valA = Number(sumMax.toFixed(2));
        const valB = Number(sumActual.toFixed(2));
        const kpi70 = valA > 0 ? Number(Math.min(70, (valB / valA) * 70).toFixed(1)) : 0;

        const yellowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } };

        // Dòng Điểm giá trị A & B
        const sumRow = ws.addRow([
            '', '', '', 'Điểm giá trị A', valA,
            '', '', 'Điểm giá trị B', valB, ''
        ]);
        sumRow.height = 24;
        ws.mergeCells(`A${sumRow.number}:D${sumRow.number}`);
        ws.mergeCells(`F${sumRow.number}:H${sumRow.number}`);
        
        for (let c = 1; c <= 10; c++) {
            sumRow.getCell(c).border = thinBorder;
            sumRow.getCell(c).font = { name: 'Times New Roman', size: 11, bold: true };
        }
        sumRow.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
        sumRow.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true, italic: true };
        sumRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        sumRow.getCell(5).fill = yellowFill;

        sumRow.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
        sumRow.getCell(6).font = { name: 'Times New Roman', size: 11, bold: true, italic: true };
        sumRow.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
        sumRow.getCell(9).fill = yellowFill;

        // Dòng III (Điểm KPI)
        const kpiRow = ws.addRow([
            'III',
            'Điểm KPI theo kết quả thực hiện nhiệm vụ = (B/A) × 70 điểm:',
            '', '', '',
            kpi70, '',
            '(Điểm này được sử dụng để đưa vào cột Điểm đạt được, phần I-B, mẫu 1. Bản tự nhận xét, đánh giá của cá nhân)',
            '', ''
        ]);
        kpiRow.height = 28;
        ws.mergeCells(`B${kpiRow.number}:E${kpiRow.number}`);
        ws.mergeCells(`F${kpiRow.number}:G${kpiRow.number}`);
        ws.mergeCells(`H${kpiRow.number}:J${kpiRow.number}`);

        for (let c = 1; c <= 10; c++) {
            const cell = kpiRow.getCell(c);
            cell.border = thinBorder;
            cell.fill = yellowFill;
        }
        kpiRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        kpiRow.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true };
        kpiRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        kpiRow.getCell(2).font = { name: 'Times New Roman', size: 11, bold: true };
        kpiRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
        kpiRow.getCell(6).font = { name: 'Times New Roman', size: 13, bold: true, color: { argb: 'FF1E3A8A' } };
        kpiRow.getCell(8).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        kpiRow.getCell(8).font = { name: 'Times New Roman', size: 10, italic: true };

        // Dòng IV (Vượt tiến độ)
        const excRow = ws.addRow([
            'IV',
            'Tổng số nhiệm vụ vượt tiến độ và đạt yêu cầu chất lượng (đánh dấu X tại cột 10):',
            '', '', '', '',
            `${totalExceeded} nhiệm vụ`,
            '', '', ''
        ]);
        excRow.height = 24;
        ws.mergeCells(`B${excRow.number}:F${excRow.number}`);
        ws.mergeCells(`G${excRow.number}:J${excRow.number}`);
        for (let c = 1; c <= 10; c++) {
            excRow.getCell(c).border = thinBorder;
            excRow.getCell(c).font = { name: 'Times New Roman', size: 11, bold: true };
        }
        excRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        excRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        excRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

        // Dòng V (Điểm thưởng)
        const bonusRow = ws.addRow([
            'V',
            'Tổng số điểm thưởng được đề xuất trong các nhiệm vụ vượt tiến độ/đạt chất lượng:',
            '', '', '', '',
            totalBonus > 0 ? `${totalBonus} điểm` : '.... điểm',
            '', '', ''
        ]);
        bonusRow.height = 24;
        ws.mergeCells(`B${bonusRow.number}:F${bonusRow.number}`);
        ws.mergeCells(`G${bonusRow.number}:J${bonusRow.number}`);
        for (let c = 1; c <= 10; c++) {
            bonusRow.getCell(c).border = thinBorder;
            bonusRow.getCell(c).font = { name: 'Times New Roman', size: 11, bold: true };
        }
        bonusRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        bonusRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        bonusRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.addRow([]);
        ws.addRow([]);

        // Phần ký tên
        const sigRow1 = ws.addRow([
            '', '', '', '', '', '', '',
            `TP. Hồ Chí Minh, ngày ... tháng ... năm ${selectedYear}`,
            '', ''
        ]);
        ws.mergeCells(`H${sigRow1.number}:J${sigRow1.number}`);
        sigRow1.getCell(8).font = { name: 'Times New Roman', size: 11, italic: true };
        sigRow1.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

        const sigRow2 = ws.addRow([
            'XÁC NHẬN CỦA LÃNH ĐẠO ĐƠN VỊ',
            '', '', '', '', '', '',
            'CÁ NHÂN ĐÁNH GIÁ',
            '', ''
        ]);
        ws.mergeCells(`A${sigRow2.number}:E${sigRow2.number}`);
        ws.mergeCells(`H${sigRow2.number}:J${sigRow2.number}`);
        sigRow2.getCell(1).font = { name: 'Times New Roman', size: 11, bold: true };
        sigRow2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        sigRow2.getCell(8).font = { name: 'Times New Roman', size: 11, bold: true };
        sigRow2.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

        const sigRow3 = ws.addRow([
            '(Ký, ghi rõ họ tên)',
            '', '', '', '', '', '',
            '(Ký, ghi rõ họ tên)',
            '', ''
        ]);
        ws.mergeCells(`A${sigRow3.number}:E${sigRow3.number}`);
        ws.mergeCells(`H${sigRow3.number}:J${sigRow3.number}`);
        sigRow3.getCell(1).font = { name: 'Times New Roman', size: 10, italic: true };
        sigRow3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        sigRow3.getCell(8).font = { name: 'Times New Roman', size: 10, italic: true };
        sigRow3.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

        ws.addRow([]);
        ws.addRow([]);
        ws.addRow([]);

        const sigRowName = ws.addRow([
            '', '', '', '', '', '', '',
            userName,
            '', ''
        ]);
        ws.mergeCells(`H${sigRowName.number}:J${sigRowName.number}`);
        sigRowName.getCell(8).font = { name: 'Times New Roman', size: 11, bold: true };
        sigRowName.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
    };

    // --- XUẤT EXCEL (ExcelJS định dạng kẻ ô, canh lề, màu sắc đầy đủ) ---
    const handleExportExcel = async () => {
        if (!recordsToRender || recordsToRender.length === 0) {
            message.warning("Chưa có dữ liệu để xuất Excel!");
            return;
        }

        const hideLoading = message.loading("Đang khởi tạo file Excel với định dạng kẻ ô và màu sắc...", 0);

        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = "Trường Cao đẳng Bách khoa Nam Sài Gòn";
            workbook.created = new Date();

            if (recordsToRender.length === 1) {
                const sheetName = reportType === 'PL3' ? 'Phu_Luc_3' : 'Phu_Luc_4';
                if (reportType === 'PL3') {
                    addPhuLuc3Sheet(workbook, recordsToRender[0], sheetName);
                } else {
                    addPhuLuc4Sheet(workbook, recordsToRender[0], sheetName);
                }
                const safe = removeVietnameseTones(recordsToRender[0].user?.name || '');
                const fileName = `${reportType === 'PL3' ? 'Phu_Luc_3_DanhMucSP' : 'Phu_Luc_4_BangTinhKPI'}_${safe}_${periodType}_${selectedYear}.xlsx`;

                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                window.URL.revokeObjectURL(url);
            } else {
                // Xuất nhiều cán bộ: mỗi người 1 sheet
                const usedNames = new Set();
                recordsToRender.forEach((record, idx) => {
                    let sName = (record.user?.name || `NV_${idx + 1}`).replace(/[\\/?*[\]:]/g, '').trim().slice(0, 25);
                    if (usedNames.has(sName)) {
                        sName = `${sName.slice(0, 20)}_${idx + 1}`;
                    }
                    usedNames.add(sName);

                    if (reportType === 'PL3') {
                        addPhuLuc3Sheet(workbook, record, sName);
                    } else {
                        addPhuLuc4Sheet(workbook, record, sName);
                    }
                });

                const deptObj = departments.find(d => String(d._id) === String(selectedDept));
                const safeDept = deptObj ? removeVietnameseTones(deptObj.departmentName) : 'DonVi';
                const fileName = `${reportType === 'PL3' ? 'Phu_Luc_3_DanhMucSP' : 'Phu_Luc_4_BangTinhKPI'}_${safeDept}_TatCaCanBo_${periodType}_${selectedYear}.xlsx`;

                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                a.click();
                window.URL.revokeObjectURL(url);
            }

            message.success("Xuất file Excel thành công!");
        } catch (error) {
            console.error("Lỗi xuất Excel:", error);
            message.error("Có lỗi xảy ra khi tạo file Excel!");
        } finally {
            hideLoading();
        }
    };

    // --- IN & XUẤT PDF VECTOR SẮC NÉT (Không qua ảnh canvas, không mất nội dung, không dính thanh menu) ---
    const printReportDocument = (isExportPdf = false) => {
        if (!reportPrintRef.current || recordsToRender.length === 0) return;

        let docTitle = '';
        if (recordsToRender.length === 1) {
            const userName = recordsToRender[0].user?.name || 'CanBo';
            const safe = removeVietnameseTones(userName);
            docTitle = reportType === 'PL3' 
                ? `Phu_Luc_3_DanhMucSanPham_${safe}_${periodType}_${selectedYear}`
                : `Phu_Luc_4_BangTinhDiemKPI_${safe}_${periodType}_${selectedYear}`;
        } else {
            const deptObj = departments.find(d => String(d._id) === String(selectedDept));
            const safeDept = deptObj ? removeVietnameseTones(deptObj.departmentName) : 'DonVi';
            docTitle = reportType === 'PL3' 
                ? `Phu_Luc_3_TatCaCanBo_${safeDept}_${periodType}_${selectedYear}`
                : `Phu_Luc_4_TatCaCanBo_${safeDept}_${periodType}_${selectedYear}`;
        }

        const orientation = reportType === 'PL4' ? 'landscape' : 'portrait';

        // Tạo iframe độc lập chỉ chứa nội dung văn bản để in
        let iframe = document.getElementById('report-print-iframe');
        if (iframe) {
            document.body.removeChild(iframe);
        }
        iframe = document.createElement('iframe');
        iframe.id = 'report-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const contentHtml = reportPrintRef.current.innerHTML;

        const iframeDoc = iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>${docTitle}</title>
                <style>
                    @page {
                        size: A4 ${orientation};
                        margin: 8mm 10mm;
                    }
                    * {
                        box-sizing: border-box;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body {
                        font-family: "Times New Roman", Times, serif;
                        font-size: 13px;
                        line-height: 1.35;
                        color: #000;
                        margin: 0;
                        padding: 0;
                        background: #fff;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        border: 1px solid #000;
                        font-size: 12px;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 4px 6px;
                    }
                    th {
                        font-weight: bold;
                        text-align: center;
                    }
                    tr {
                        page-break-inside: avoid;
                    }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .text-left { text-align: left; }
                    .font-bold { font-weight: bold; }
                    .font-semibold { font-weight: 600; }
                    .font-medium { font-weight: 500; }
                    .italic { font-style: italic; }
                    .underline { text-decoration: underline; }
                    .uppercase { text-transform: uppercase; }
                    .bg-\\[\\#ffeb3b\\] { background-color: #ffeb3b !important; }
                    .bg-gray-50 { background-color: #f9fafb !important; }
                    .text-blue-900 { color: #1e3a8a !important; }
                    .text-red-600 { color: #dc2626 !important; }
                    .text-black { color: #000 !important; }
                    .flex { display: flex; }
                    .justify-between { justify-content: space-between; }
                    .items-start { align-items: flex-start; }
                    .w-5\\/12 { width: 41.666667%; }
                    .w-6\\/12 { width: 50%; }
                    .w-full { width: 100%; }
                    .my-2 { margin-top: 8px; margin-bottom: 8px; }
                    .my-3 { margin-top: 12px; margin-bottom: 12px; }
                    .mb-1 { margin-bottom: 4px; }
                    .mt-0\\.5 { margin-top: 2px; }
                    .h-20 { height: 75px; }
                    .page-break {
                        page-break-after: always;
                        break-after: page;
                    }
                    .screen-only {
                        display: none !important;
                    }
                    .print-only {
                        display: inline !important;
                    }
                </style>
            </head>
            <body>
                ${contentHtml}
            </body>
            </html>
        `);
        iframeDoc.close();

        if (isExportPdf) {
            message.info({
                content: 'Tại hộp thoại in, vui lòng chọn Máy in là "Lưu dưới dạng PDF" (Save as PDF) để xuất file PDF vector sắc nét.',
                duration: 6,
                key: 'pdf_export_tip'
            });
        }

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        }, 400);
    };

    // --- IN TRỰC TIẾP ---
    const handlePrintDirect = () => {
        printReportDocument(false);
    };

    // --- XUẤT PDF ---
    const handleExportPdf = () => {
        printReportDocument(true);
    };

    const renderReportSheet = (record, recIdx, isLast) => {
        const user = record.user || {};
        const userName = user.name || '....................';
        const userPosition = user.position?.positionName || 'Chuyên viên';
        const details = record.details || [];
        const totalExceeded = details.filter(t => t.isExceeded).length;
        const totalBonus = details.reduce((acc, t) => acc + (t.bonusScore ? Number(t.bonusScore) : 0), 0);

        return (
            <div 
                key={user._id || recIdx}
                className={`single-report-sheet ${!isLast ? 'mb-10 pb-10 border-b-2 border-dashed border-gray-300 print:mb-0 print:pb-0 print:border-none' : ''}`}
                style={{ breakAfter: isLast ? 'auto' : 'page', pageBreakAfter: isLast ? 'auto' : 'always' }}
            >
                {/* Nhãn phụ lục góc trên cùng bên phải */}
                <div className="text-right text-xs font-bold italic mb-1">
                    {reportType === 'PL3' ? 'Phụ lục 3' : 'Phụ lục 4'}
                </div>

                {/* Header Cơ quan & Quốc hiệu chuẩn thể thức */}
                <div className="flex justify-between items-start pb-2">
                    <div className="text-center w-5/12">
                        <div className="text-xs uppercase">ỦY BAN NHÂN DÂN</div>
                        <div className="text-xs uppercase">THÀNH PHỐ HỒ CHÍ MINH</div>
                        <div className="text-xs font-bold uppercase">TRƯỜNG CAO ĐẲNG BÁCH KHOA</div>
                        <div className="text-xs font-bold uppercase underline">NAM SÀI GÒN</div>
                    </div>
                    <div className="text-center w-6/12">
                        <div className="text-xs font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                        <div className="text-xs font-bold underline">Độc lập - Tự do - Hạnh phúc</div>
                    </div>
                </div>

                {/* Tiêu đề Báo cáo */}
                <div className="text-center py-4">
                    <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide !mb-1">
                        {reportType === 'PL3' 
                            ? 'DANH MỤC SẢN PHẨM CÔNG VIỆC CỦA CÁ NHÂN' 
                            : 'BẢNG TÍNH ĐIỂM KPI CỦA CÁ NHÂN'
                        }
                    </h2>
                    <div className="font-bold text-sm tracking-wider uppercase">{periodLabel}</div>
                </div>

                {/* Thông tin cá nhân */}
                <div className="space-y-1 pb-3 text-xs sm:text-sm">
                    <div>
                        <span className="inline-block w-24 font-normal">Họ và tên:</span>
                        <span className="font-bold uppercase">{userName}</span>
                    </div>
                    <div>
                        <span className="inline-block w-24 font-normal">Chức vụ:</span>
                        <span>{userPosition}</span>
                    </div>
                </div>

                {/* BẢNG NỘI DUNG: PHỤ LỤC 3 (Đúng chuẩn 9 cột theo ảnh) */}
                {reportType === 'PL3' && (
                    <div className="my-2">
                        <table className="w-full border-collapse border border-black text-xs">
                            <thead>
                                <tr className="text-center font-bold">
                                    <th className="border border-black p-1.5 w-8">TT</th>
                                    <th className="border border-black p-1.5 min-w-[170px]">Tên công việc</th>
                                    <th className="border border-black p-1.5 w-28">Kết quả<br/>đầu ra</th>
                                    <th className="border border-black p-1.5 w-24">Thời hạn<br/>hoàn thành</th>
                                    <th className="border border-black p-1.5 w-24">Loại công<br/>việc</th>
                                    <th className="border border-black p-1.5 w-16">Điểm<br/>chuẩn</th>
                                    <th className="border border-black p-1.5 w-16">Hệ số độ<br/>khó</th>
                                    <th className="border border-black p-1.5 w-20">Điểm quy đổi<br/>tối đa</th>
                                    <th className="border border-black p-1.5 min-w-[140px]">
                                        Minh chứng/thể hiện số liệu kết quả đối với các nhiệm vụ vượt tiến độ
                                    </th>
                                </tr>
                                <tr className="text-center text-[11px] font-normal bg-gray-50">
                                    <th className="border border-black p-0.5">(1)</th>
                                    <th className="border border-black p-0.5">(2)</th>
                                    <th className="border border-black p-0.5">(3)</th>
                                    <th className="border border-black p-0.5">(4)</th>
                                    <th className="border border-black p-0.5">(5)</th>
                                    <th className="border border-black p-0.5">(6)</th>
                                    <th className="border border-black p-0.5">(7)</th>
                                    <th className="border border-black p-0.5">(8)</th>
                                    <th className="border border-black p-0.5">(9)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {details.length > 0 ? (
                                    details.map((t, idx) => {
                                        const base = t.baseScore !== undefined ? t.baseScore : (t.taskType === 'URGENT' ? 12 : 10);
                                        const diff = t.difficultyRate !== undefined ? t.difficultyRate : 1.0;
                                        const maxS = Number((base * diff).toFixed(2));
                                        const typeName = (t.taskType === 'URGENT' || t.priority === 'URGENT' || t.priority === 'FLASH') ? 'Đột xuất' : 'Thường xuyên';
                                        const output = t.outputResult || (t.description ? t.description.slice(0, 50) : 'Hoàn thành');
                                        const deadline = (t.subtaskInfo?.endDate || t.endDate) ? dayjs(t.subtaskInfo?.endDate || t.endDate).format('DD/MM/YYYY') : '';
                                        const compDate = t.subtaskInfo?.completedAt || t.completedAt;
                                        let proof = 'Đang làm';
                                        if (compDate) {
                                            proof = `Hoàn thành ${dayjs(compDate).format('DD/MM/YYYY')}`;
                                        } else if (t.isOverdue) {
                                            proof = 'Quá hạn';
                                        } else if (t.status === 'TODO') {
                                            proof = 'Chưa làm';
                                        }

                                        return (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                                                <td className="border border-black p-1.5 font-medium">
                                                    <div>{t.title}</div>
                                                    {t.subtaskInfo?.title && (
                                                        <div className="text-[11px] text-blue-700 italic mt-0.5">
                                                            (Việc con: {t.subtaskInfo.title})
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="border border-black p-1.5">{output}</td>
                                                <td className="border border-black p-1.5 text-center">{deadline}</td>
                                                <td className="border border-black p-1.5 text-center">{typeName}</td>
                                                <td className="border border-black p-1.5 text-center">{base}</td>
                                                <td className="border border-black p-1.5 text-center font-medium">{formatDiffRate(diff)}</td>
                                                <td className="border border-black p-1.5 text-center font-semibold">{maxS}</td>
                                                <td className="border border-black p-1.5 text-xs">{proof}</td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="border border-black p-4 text-center italic text-gray-500">
                                            Không có sản phẩm, công việc nào trong kỳ đánh giá này.
                                        </td>
                                    </tr>
                                )}

                                {/* 3 dòng chân bảng Phụ lục 3 chuẩn theo ảnh */}
                                <tr className="font-semibold italic">
                                    <td colSpan={2} className="border border-black p-1.5">
                                        Tổng số nhiệm vụ thực hiện trong quý
                                    </td>
                                    <td className="border border-black p-1.5 text-center not-italic font-bold">
                                        {details.length}
                                    </td>
                                    <td colSpan={6} className="border border-black p-1.5"></td>
                                </tr>
                                <tr className="font-semibold italic">
                                    <td colSpan={2} className="border border-black p-1.5">
                                        Tổng số nhiệm vụ vượt tiến độ/chất lượng
                                    </td>
                                    <td className="border border-black p-1.5 text-center not-italic font-bold">
                                        {totalExceeded > 0 ? totalExceeded : '....'}
                                    </td>
                                    <td colSpan={6} className="border border-black p-1.5"></td>
                                </tr>
                                <tr className="font-semibold italic">
                                    <td colSpan={2} className="border border-black p-1.5">
                                        Tổng số điểm thưởng được đề xuất trong các nhiệm vụ vượt tiến độ/đạt chất lượng
                                    </td>
                                    <td className="border border-black p-1.5 text-center not-italic font-bold">
                                        {totalBonus > 0 ? `+${totalBonus}đ` : '....'}
                                    </td>
                                    <td colSpan={6} className="border border-black p-1.5"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* BẢNG NỘI DUNG: PHỤ LỤC 4 (Đúng chuẩn 10 cột theo ảnh) */}
                {reportType === 'PL4' && (() => {
                    let sumMax = 0;
                    let sumActual = 0;

                    const computedRows = details.map((t, idx) => {
                        const isDone = (t.subtaskInfo ? t.subtaskInfo.status === 'DONE' : t.status === 'DONE');
                        let isPending = false;
                        if (t.isPendingWithinDeadline !== undefined) {
                            isPending = Boolean(t.isPendingWithinDeadline);
                        } else if (!isDone) {
                            const deadlineStr = t.subtaskInfo?.endDate || t.endDate;
                            if (!deadlineStr) {
                                isPending = true;
                            } else {
                                const deadline = new Date(deadlineStr);
                                deadline.setHours(23, 59, 59, 999);
                                isPending = (new Date().getTime() <= deadline.getTime());
                            }
                        }

                        const base = t.baseScore !== undefined ? t.baseScore : (t.taskType === 'URGENT' ? 12 : 10);
                        const diff = t.difficultyRate !== undefined ? t.difficultyRate : 1.0;
                        const maxS = Number((base * diff).toFixed(2));

                        let prog = null;
                        let qual = null;
                        let exec = null;
                        let act = null;

                        if (!isPending) {
                            prog = t.progressRate !== undefined && t.progressRate !== null 
                                ? t.progressRate 
                                : (isDone ? (t.isOnTime ? 100 : 80) : 0);
                            qual = t.qualityRate !== undefined && t.qualityRate !== null 
                                ? t.qualityRate 
                                : (isDone ? 100 : 60);
                            exec = Number((base * (0.3 * (prog / 100) + 0.7 * (qual / 100))).toFixed(2));
                            act = Number((exec * diff).toFixed(2));

                            sumMax += maxS;
                            sumActual += act;
                        }

                        return { t, idx, base, diff, maxS, prog, qual, exec, act, isPending };
                    });

                    const valA = Number(sumMax.toFixed(2));
                    const valB = Number(sumActual.toFixed(2));
                    const kpi70 = valA > 0 ? Number(Math.min(70, (valB / valA) * 70).toFixed(1)) : 0;

                    return (
                        <div className="my-2">
                            <table className="w-full border-collapse border border-black text-xs">
                                <thead>
                                    <tr className="text-center font-bold">
                                        <th className="border border-black p-1.5 w-8">TT</th>
                                        <th className="border border-black p-1.5 min-w-[170px]">Tên công việc</th>
                                        <th className="border border-black p-1 w-14">Điểm<br/>chuẩn</th>
                                        <th className="border border-black p-1 w-16">Hệ số độ<br/>khó</th>
                                        <th className="border border-black p-1 w-16">Điểm quy<br/>đổi tối đa</th>
                                        <th className="border border-black p-1 w-14">Tiến độ<br/>%</th>
                                        <th className="border border-black p-1 w-14">Kết quả<br/>%</th>
                                        <th className="border border-black p-1 w-16">Điểm<br/>thực hiện</th>
                                        <th className="border border-black p-1 w-16">Điểm<br/>quy đổi<br/>thực tế</th>
                                        <th className="border border-black p-1 w-24">
                                            Công việc vượt yêu cầu về tiến độ/ chất lượng (đánh dấu X)
                                        </th>
                                    </tr>
                                    <tr className="text-center text-[11px] font-normal bg-gray-50">
                                        <th className="border border-black p-0.5">(1)</th>
                                        <th className="border border-black p-0.5">(2)</th>
                                        <th className="border border-black p-0.5">(3)</th>
                                        <th className="border border-black p-0.5">(4)</th>
                                        <th className="border border-black p-0.5">(5)</th>
                                        <th className="border border-black p-0.5">(6)</th>
                                        <th className="border border-black p-0.5">(7)</th>
                                        <th className="border border-black p-0.5">(8)</th>
                                        <th className="border border-black p-0.5">(9)</th>
                                        <th className="border border-black p-0.5">(10)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {computedRows.length > 0 ? (
                                        computedRows.map(({ t, idx, base, diff, maxS, prog, qual, exec, act, isPending }) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                                                <td className="border border-black p-1.5 font-medium">
                                                    <div>{t.title}</div>
                                                    {t.subtaskInfo?.title && (
                                                        <div className="text-[11px] text-blue-700 italic mt-0.5">
                                                            (Việc con: {t.subtaskInfo.title})
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="border border-black p-1 text-center">{base}</td>
                                                <td className="border border-black p-1 text-center font-medium">{formatDiffRate(diff)}</td>
                                                <td className="border border-black p-1 text-center font-semibold">{maxS}</td>
                                                <td className="border border-black p-1 text-center">{prog !== null ? `${prog}%` : ''}</td>
                                                <td className="border border-black p-0.5 text-center">
                                                    {(!isPending && canEditQualityRate) ? (
                                                        <>
                                                            <span className="screen-only">
                                                                <Select
                                                                    value={qual !== null ? qual : undefined}
                                                                    placeholder="Chọn mức"
                                                                    size="small"
                                                                    bordered={false}
                                                                    className="w-full text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded"
                                                                    onChange={(newVal) => handleUpdateQualityRate(t, newVal)}
                                                                    options={[
                                                                        { value: 100, label: '⭐ Đạt đầy đủ yêu cầu (100%)', display: '100%' },
                                                                        { value: 80, label: '🔹 Đạt yêu cầu, chỉnh sửa nhỏ (80%)', display: '80%' },
                                                                        { value: 60, label: '🔸 Hoàn thành cơ bản (60%)', display: '60%' },
                                                                        { value: 0, label: '❌ Không đạt yêu cầu (0%)', display: '0%' },
                                                                    ]}
                                                                    optionRender={(option) => (
                                                                        <div className="py-0.5 text-xs">
                                                                            {option.data.label}
                                                                        </div>
                                                                    )}
                                                                    labelRender={(props) => (
                                                                        <span className="font-bold text-blue-800 text-xs">
                                                                            {props.value !== undefined && props.value !== null ? `${props.value}%` : ''}
                                                                        </span>
                                                                    )}
                                                                    popupMatchSelectWidth={260}
                                                                />
                                                            </span>
                                                            <span className="print-only">
                                                                {qual !== null ? `${qual}%` : ''}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span>{qual !== null ? `${qual}%` : ''}</span>
                                                    )}
                                                </td>
                                                <td className="border border-black p-1 text-center font-medium">{exec !== null ? exec : ''}</td>
                                                <td className="border border-black p-1 text-center font-bold text-blue-900">{act !== null ? act : ''}</td>
                                                <td className="border border-black p-1 text-center font-bold text-red-600">
                                                    {!isPending && t.isExceeded ? 'X' : ''}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={10} className="border border-black p-4 text-center italic text-gray-500">
                                                Không có công việc nào hoàn thành trong kỳ đánh giá này.
                                            </td>
                                        </tr>
                                    )}

                                    {/* 4 dòng tổng kết chân bảng chuẩn Phụ lục 4 */}
                                    <tr className="font-semibold text-xs">
                                        <td colSpan={4} className="border border-black p-1.5 text-right italic font-bold">
                                            Điểm giá trị A
                                        </td>
                                        <td className="border border-black p-1.5 text-center font-bold bg-[#ffeb3b] text-black">
                                            {valA}
                                        </td>
                                        <td colSpan={3} className="border border-black p-1.5 text-right italic font-bold">
                                            Điểm giá trị B
                                        </td>
                                        <td className="border border-black p-1.5 text-center font-bold bg-[#ffeb3b] text-black">
                                            {valB}
                                        </td>
                                        <td className="border border-black p-1.5"></td>
                                    </tr>
                                    <tr className="font-bold text-xs bg-[#ffeb3b] text-black">
                                        <td className="border border-black p-1 text-center">III</td>
                                        <td colSpan={4} className="border border-black p-1">
                                            Điểm KPI theo kết quả thực hiện nhiệm vụ = (B/A) × 70 điểm:
                                        </td>
                                        <td colSpan={2} className="border border-black p-1 text-center text-sm font-extrabold text-blue-900">
                                            {kpi70}
                                        </td>
                                        <td colSpan={3} className="border border-black p-1 text-[11px] font-normal italic">
                                            (Nếu B &gt; A thì KPI đạt tối đa 70 điểm)
                                        </td>
                                    </tr>
                                    <tr className="italic font-semibold text-xs">
                                        <td colSpan={2} className="border border-black p-1.5">
                                            Tổng số nhiệm vụ vượt tiến độ và đạt yêu cầu chất lượng
                                        </td>
                                        <td className="border border-black p-1.5 text-center not-italic font-bold">
                                            {totalExceeded > 0 ? totalExceeded : '....'}
                                        </td>
                                        <td colSpan={7} className="border border-black p-1"></td>
                                    </tr>
                                    <tr className="italic font-semibold text-xs">
                                        <td colSpan={2} className="border border-black p-1.5">
                                            Tổng số điểm thưởng được đề xuất trong các nhiệm vụ vượt tiến độ/đạt chất lượng
                                        </td>
                                        <td className="border border-black p-1.5 text-center not-italic font-bold">
                                            {totalBonus > 0 ? `+${totalBonus}đ` : '....'}
                                        </td>
                                        <td colSpan={7} className="border border-black p-1"></td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    );
                })()}

                {/* Phần Chữ ký & Ngày tháng chuẩn 2 bên theo hình ảnh */}
                <div className="mt-6 pt-2 flex justify-between items-start text-xs sm:text-sm print:break-inside-avoid">
                    <div className="text-center w-5/12">
                        <div className="font-bold uppercase">XÁC NHẬN CỦA LÃNH ĐẠO ĐƠN VỊ</div>
                        <div className="italic text-xs mt-0.5">(Ký, ghi rõ họ tên)</div>
                        <div className="h-24"></div>
                    </div>
                    <div className="text-center w-5/12">
                        <div className="italic text-xs mb-1">
                            TP. Hồ Chí Minh, ngày ... tháng ... năm {selectedYear}
                        </div>
                        <div className="font-bold uppercase">
                            {reportType === 'PL3' 
                                ? 'CÁ NHÂN LẬP DANH MỤC SẢN PHẨM CÔNG VIỆC' 
                                : 'CÁ NHÂN ĐÁNH GIÁ'}
                        </div>
                        <div className="italic text-xs mt-0.5">(Ký, ghi rõ họ tên)</div>
                        <div className="h-20"></div>
                        <div className="font-bold text-sm">{userName}</div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-gray-100 min-h-screen p-4 sm:p-6 space-y-6">
            {/* Thanh điều khiển trên cùng (ẩn khi in) */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 print:hidden space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <Title level={3} className="!mb-1 flex items-center gap-2 text-gray-800">
                            <PrinterOutlined className="text-blue-600 text-2xl" />
                            In Báo Cáo Công Việc & KPI
                        </Title>
                        <Text type="secondary" className="text-sm">
                            Xem trước bản in, xuất file Excel và PDF chuẩn theo mẫu Phụ lục 3 & Phụ lục 4.
                        </Text>
                    </div>
                    <Space wrap>
                        <Button 
                            icon={<ReloadOutlined />} 
                            onClick={fetchKpiData} 
                            loading={loading}
                        >
                            Làm mới
                        </Button>
                        <Button 
                            type="primary" 
                            icon={<FileExcelOutlined />} 
                            onClick={handleExportExcel}
                            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                            disabled={!selectedUserId || recordsToRender.length === 0}
                        >
                            Xuất Excel
                        </Button>
                        <Button 
                            type="primary" 
                            icon={<FilePdfOutlined />} 
                            onClick={handleExportPdf}
                            style={{ backgroundColor: '#ff4d4f', borderColor: '#ff4d4f' }}
                            disabled={!selectedUserId || recordsToRender.length === 0}
                        >
                            Xuất PDF
                        </Button>
                        <Button 
                            type="primary" 
                            icon={<PrinterOutlined />} 
                            onClick={handlePrintDirect}
                            disabled={!selectedUserId || recordsToRender.length === 0}
                        >
                            In trực tiếp
                        </Button>
                    </Space>
                </div>

                <Divider className="!my-2" />

                {/* Bộ chọn mẫu phụ lục và thời gian */}
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} md={8}>
                        <div className="text-xs text-gray-500 mb-1 font-semibold">Chọn Mẫu Phụ lục cần in:</div>
                        <Radio.Group 
                            value={reportType} 
                            onChange={(e) => setReportType(e.target.value)}
                            buttonStyle="solid"
                            className="w-full"
                        >
                            <Radio.Button value="PL3" className="w-1/2 text-center">
                                Phụ lục 3 (Danh mục SP)
                            </Radio.Button>
                            <Radio.Button value="PL4" className="w-1/2 text-center">
                                Phụ lục 4 (Bảng tính KPI)
                            </Radio.Button>
                        </Radio.Group>
                    </Col>

                    <Col xs={12} sm={6} md={5}>
                        <div className="text-xs text-gray-500 mb-1 font-semibold">Kỳ đánh giá:</div>
                        <Select 
                            value={periodType} 
                            onChange={setPeriodType} 
                            style={{ width: '100%' }}
                        >
                            <Option value="QUARTER">Theo Quý</Option>
                            <Option value="MONTH">Theo Tháng</Option>
                            <Option value="YEAR">Cả năm</Option>
                        </Select>
                    </Col>

                    {periodType === 'QUARTER' && (
                        <Col xs={12} sm={6} md={5}>
                            <div className="text-xs text-gray-500 mb-1 font-semibold">Chọn Quý:</div>
                            <Select 
                                value={selectedQuarter} 
                                onChange={setSelectedQuarter} 
                                style={{ width: '100%' }}
                            >
                                <Option value={1}>Quý 1 (T1 - T3)</Option>
                                <Option value={2}>Quý 2 (T4 - T6)</Option>
                                <Option value={3}>Quý 3 (T7 - T9)</Option>
                                <Option value={4}>Quý 4 (T10 - T12)</Option>
                            </Select>
                        </Col>
                    )}

                    {periodType === 'MONTH' && (
                        <Col xs={12} sm={6} md={5}>
                            <div className="text-xs text-gray-500 mb-1 font-semibold">Chọn Tháng:</div>
                            <Select 
                                value={selectedMonth} 
                                onChange={setSelectedMonth} 
                                style={{ width: '100%' }}
                            >
                                {[...Array(12)].map((_, i) => (
                                    <Option key={i + 1} value={i + 1}>{`Tháng ${i + 1}`}</Option>
                                ))}
                            </Select>
                        </Col>
                    )}

                    <Col xs={12} sm={6} md={periodType === 'YEAR' ? 11 : 6}>
                        <div className="text-xs text-gray-500 mb-1 font-semibold">Năm:</div>
                        <DatePicker 
                            picker="year" 
                            value={selectedYear ? dayjs(`${selectedYear}-01-01`) : null} 
                            onChange={(date) => {
                                if (date) setSelectedYear(date.year());
                            }} 
                            style={{ width: '100%' }}
                            format="YYYY"
                            allowClear={false}
                        />
                    </Col>

                    <Col xs={24} md={12}>
                        <div className="text-xs text-gray-500 mb-1 font-semibold">Phòng ban / Bộ phận:</div>
                        <Select 
                            value={selectedDept || (!isBGH ? myEffectiveDeptId : "")} 
                            onChange={(val) => {
                                setSelectedDept(val);
                                setSelectedUserId(null);
                            }} 
                            disabled={!isBGH}
                            allowClear={isBGH} 
                            placeholder={isBGH ? "Tất cả phòng ban / đơn vị" : (myEffectiveDeptName || "Đơn vị của tôi")}
                            style={{ width: '100%' }}
                            showSearch={isBGH}
                            optionFilterProp="children"
                        >
                            {isBGH && <Option value="">Tất cả phòng ban / đơn vị</Option>}
                            {departments
                                .filter(d => isBGH || String(d._id) === String(myEffectiveDeptId))
                                .map(d => (
                                    <Option key={d._id} value={d._id}>{d.departmentName}</Option>
                                ))
                            }
                            {!isBGH && myEffectiveDeptId && !departments.some(d => String(d._id) === String(myEffectiveDeptId)) && (
                                <Option key={myEffectiveDeptId} value={myEffectiveDeptId}>
                                    {myEffectiveDeptName || "Đơn vị của tôi"}
                                </Option>
                            )}
                        </Select>
                    </Col>

                    <Col xs={24} md={12}>
                        <div className="text-xs text-gray-500 mb-1 font-semibold">Cán bộ / Nhân viên:</div>
                        <Select 
                            value={selectedUserId} 
                            onChange={setSelectedUserId} 
                            placeholder="-- Chọn cán bộ / nhân viên --"
                            style={{ width: '100%' }}
                            showSearch
                            allowClear
                            optionFilterProp="label"
                            optionLabelProp="label"
                            filterOption={(input, option) => {
                                if (!input) return true;
                                const search = removeAccents(input.toLowerCase().trim());
                                const label = removeAccents(String(option?.label || option?.children || "").toLowerCase());
                                return label.includes(search);
                            }}
                        >
                            {(isBGH || isCapTruong) && filteredUsers.length > 0 && (
                                <Option value="ALL" label={`Tất cả cán bộ trong đơn vị (${filteredUsers.length} người - In 1 lần)`}>
                                    <span className="font-bold text-blue-600">
                                        📋 Tất cả cán bộ trong đơn vị ({filteredUsers.length} người - In 1 lần)
                                    </span>
                                </Option>
                            )}
                            {userGroups.map((group) => (
                                group.users.length > 0 && (
                                    <Select.OptGroup key={group.key} label={group.label}>
                                        {group.users.map((u) => {
                                            const posStr = u.position?.positionName ? ` (${u.position.positionName})` : "";
                                            const deptStr = u.department?.departmentName ? ` - ${u.department.departmentName}` : "";
                                            const labelStr = `${u.name || ""}${posStr}${deptStr}`.trim();
                                            return (
                                                <Option key={u._id} value={u._id} label={labelStr}>
                                                    {labelStr}
                                                </Option>
                                            );
                                        })}
                                    </Select.OptGroup>
                                )
                            ))}
                        </Select>
                    </Col>
                </Row>
            </div>

            {/* Vùng hiển thị Trang In Văn bản (Paper Preview Container) */}
            <div className="flex justify-center">
                {loading ? (
                    <div className="py-24 text-center bg-white rounded-xl w-full max-w-5xl shadow-sm border border-gray-200">
                        <Spin size="large" tip="Đang tải dữ liệu báo cáo..." />
                    </div>
                ) : !selectedUserId ? (
                    <div className="py-24 text-center bg-white rounded-xl w-full max-w-5xl shadow-sm border border-gray-200">
                        <Empty 
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                                <div className="space-y-1">
                                    <div className="font-semibold text-base text-gray-700">
                                        Chưa chọn Cán bộ / Nhân viên
                                    </div>
                                    <div className="text-gray-500 text-sm">
                                        Vui lòng chọn Cán bộ / Nhân viên ở bộ lọc bên trên để xem trước và in báo cáo.
                                    </div>
                                </div>
                            } 
                        />
                    </div>
                ) : recordsToRender.length === 0 ? (
                    <div className="py-24 text-center bg-white rounded-xl w-full max-w-5xl shadow-sm border border-gray-200">
                        <Empty description="Không có dữ liệu công việc trong kỳ này để tạo báo cáo." />
                    </div>
                ) : (
                    <div 
                        ref={reportPrintRef} 
                        id="report-paper-container"
                        className={`bg-white shadow-md border border-gray-300 p-6 sm:p-10 text-black transition-all ${
                            reportType === 'PL4' ? 'w-full max-w-6xl' : 'w-full max-w-5xl'
                        }`}
                        style={{
                            fontFamily: '"Times New Roman", Times, serif',
                            minHeight: '297mm',
                            fontSize: '13px',
                            lineHeight: '1.35'
                        }}
                    >
                        {recordsToRender.map((record, recIdx) => 
                            renderReportSheet(record, recIdx, recIdx === recordsToRender.length - 1)
                        )}
                    </div>
                )}
            </div>

            {/* CSS Print Styles */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    body {
                        background: white !important;
                        color: black !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    /* Ẩn tất cả ngoại trừ paper container */
                    .print\\:hidden, 
                    header, 
                    nav, 
                    aside, 
                    .ant-layout-sider, 
                    .ant-layout-header,
                    .ant-float-btn,
                    #chatbot-widget-container {
                        display: none !important;
                    }
                    #report-paper-container {
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 auto !important;
                        width: 100% !important;
                        max-width: 100% !important;
                    }
                    table {
                        border-collapse: collapse !important;
                    }
                    table, th, td {
                        border: 1px solid black !important;
                    }
                    @page {
                        size: ${reportType === 'PL4' ? 'A4 landscape' : 'A4 portrait'};
                        margin: 15mm 10mm 15mm 10mm;
                    }
                }
            ` }} />
        </div>
    );
};

export default TaskReportPage;
