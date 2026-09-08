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
import * as XLSX from 'xlsx';
import html2pdf from 'html2pdf.js';
import dayjs from 'dayjs';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import { getKpiStats } from '../../api/taskApi';
import { getAllDepartments } from '../../api/DepartmentAPI';
import { getAllUsers, getUserInfo } from '../../api/auth';
import { categorizeUsers } from '../../utils/userClassification';
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

    // User permissions
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
                const uId = decoded?._id || decoded?.id;
                setCurrentUserId(uId);

                getUserInfo(uId).then(res => {
                    const u = res?.user || res?.data || res;
                    if (u) {
                        const deptId = u.department?._id || u.department;
                        setUserDeptId(deptId ? deptId.toString() : null);
                        if (u.department?.departmentCode) {
                            setUserDeptCode(u.department.departmentCode);
                        }
                    }
                }).catch(err => console.error("Error fetching user info:", err));
            } catch (err) {
                console.error("Token decode error:", err);
            }
        }
    }, []);

    const isBGH = currentUserRole === 'admin' || currentUserRole === 'manager' || userDeptCode === 'BGH';
    const isChuyenVien = currentUserRole === 'chuyenvien';

    // Tải danh mục phòng ban và người dùng
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [deptRes, userRes] = await Promise.all([
                    getAllDepartments(),
                    getAllUsers()
                ]);

                if (deptRes && Array.isArray(deptRes)) {
                    setDepartments(deptRes);
                } else if (deptRes && Array.isArray(deptRes.departments)) {
                    setDepartments(deptRes.departments);
                }

                if (userRes && Array.isArray(userRes.users)) {
                    setUsers(userRes.users.filter(u => u.role !== null && u.email?.toLowerCase() !== 'qlvb@nsgpc.edu.vn'));
                }
            } catch (err) {
                console.error("Lỗi nạp dữ liệu ban đầu:", err);
            }
        };
        fetchData();
    }, []);

    // Thiết lập mặc định phòng ban ban đầu khi đăng nhập
    useEffect(() => {
        if (userDeptId && selectedDept === null) {
            setSelectedDept(userDeptId);
        }
    }, [userDeptId, selectedDept]);

    // Lọc danh sách nhân viên theo phòng ban đã chọn (hoặc tất cả nếu không chọn phòng ban)
    const filteredUsers = useMemo(() => {
        let list = users;
        if (selectedDept) {
            list = list.filter(u => String(u.department?._id || u.department) === String(selectedDept));
        }
        return list;
    }, [users, selectedDept]);

    // Phân nhóm cán bộ / nhân viên theo 5 nhóm chuẩn giống bên ban hành văn bản
    const userGroups = useMemo(() => {
        return categorizeUsers(filteredUsers);
    }, [filteredUsers]);

    // Tự động chọn nhân viên nếu chưa chọn
    useEffect(() => {
        if (selectedUserId === 'ALL') return;
        if (!selectedUserId && filteredUsers.length > 0) {
            const matchSelf = filteredUsers.find(u => u._id === currentUserId);
            setSelectedUserId(matchSelf ? matchSelf._id : filteredUsers[0]._id);
        } else if (selectedUserId && !filteredUsers.some(u => u._id === selectedUserId)) {
            setSelectedUserId(filteredUsers.length > 0 ? filteredUsers[0]._id : null);
        }
    }, [filteredUsers, selectedUserId, currentUserId]);

    // Tải dữ liệu KPI từ Backend
    const fetchKpiData = async () => {
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
        }
    }, [periodType, selectedQuarter, selectedMonth, selectedYear, selectedDept, selectedUserId]);

    // Danh sách bản ghi báo cáo cần render (1 cá nhân hoặc toàn bộ đơn vị)
    const recordsToRender = useMemo(() => {
        if (!statsData?.leaderboard || statsData.leaderboard.length === 0) return [];
        if (selectedUserId === 'ALL') {
            return statsData.leaderboard;
        }
        const found = statsData.leaderboard.find(item => item.user?._id === selectedUserId);
        return found ? [found] : (statsData.leaderboard[0] ? [statsData.leaderboard[0]] : []);
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

    // Helper tạo dữ liệu bảng Excel cho một người
    const generateExcelSheetData = (record) => {
        const user = record.user || {};
        const userName = user.name || '';
        const userPosition = user.position?.positionName || '';
        const details = record.details || [];

        if (reportType === 'PL3') {
            const sheetData = [
                ["", "", "", "", "", "", "", "", "Phụ lục 3"],
                ["ỦY BAN NHÂN DÂN", "", "", "", "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
                ["THÀNH PHỐ HỒ CHÍ MINH", "", "", "", "Độc lập - Tự do - Hạnh phúc"],
                ["TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN"],
                [""],
                ["", "", "DANH MỤC SẢN PHẨM CÔNG VIỆC CỦA CÁ NHÂN"],
                ["", "", periodLabel],
                [""],
                [`Họ và tên: ${userName}`],
                [`Chức vụ: ${userPosition}`],
                [""],
                [
                    "TT", 
                    "Tên công việc", 
                    "Kết quả đầu ra", 
                    "Thời hạn hoàn thành", 
                    "Loại công việc", 
                    "Điểm chuẩn", 
                    "Hệ số độ khó", 
                    "Điểm quy đổi tối đa", 
                    "Minh chứng/thể hiện số liệu kết quả đối với các nhiệm vụ vượt tiến độ"
                ],
                ["(1)", "(2)", "(3)", "(4)", "(5)", "(6)", "(7)", "(8)", "(9)"]
            ];

            let totalExceeded = 0;
            let totalBonus = 0;

            details.forEach((t, idx) => {
                const base = t.baseScore !== undefined ? t.baseScore : (t.taskType === 'URGENT' ? 12 : 10);
                const diff = t.difficultyRate !== undefined ? t.difficultyRate : 1.0;
                const maxS = Number((base * diff).toFixed(2));
                const typeName = (t.taskType === 'URGENT' || t.priority === 'URGENT' || t.priority === 'FLASH') ? 'Đột xuất' : 'Thường xuyên';
                const output = t.outputResult || (t.description ? t.description.slice(0, 50) : 'Hoàn thành nhiệm vụ');
                const deadline = t.endDate ? dayjs(t.endDate).format('DD/MM/YYYY') : '';
                const proof = t.completedAt ? `Hoàn thành ngày ${dayjs(t.completedAt).format('DD/MM/YYYY')}` : 'Đang thực hiện';

                if (t.isExceeded) totalExceeded += 1;
                if (t.bonusScore) totalBonus += Number(t.bonusScore);

                sheetData.push([
                    idx + 1, 
                    t.title || '', 
                    output, 
                    deadline, 
                    typeName, 
                    base, 
                    formatDiffRate(diff), 
                    maxS, 
                    proof
                ]);
            });

            sheetData.push(["", "Tổng số nhiệm vụ thực hiện trong quý", details.length, "", "", "", "", "", ""]);
            sheetData.push(["", "Tổng số nhiệm vụ vượt tiến độ/chất lượng", totalExceeded, "", "", "", "", "", ""]);
            sheetData.push(["", "Tổng số điểm thưởng được đề xuất trong các nhiệm vụ vượt tiến độ/đạt chất lượng", totalBonus > 0 ? totalBonus : '....', "", "", "", "", "", ""]);

            sheetData.push([""]);
            sheetData.push(["", "", "", "", "", "", `TP. Hồ Chí Minh, ngày ... tháng ... năm ${selectedYear}`]);
            sheetData.push(["", "XÁC NHẬN CỦA LÃNH ĐẠO ĐƠN VỊ", "", "", "", "", "CÁ NHÂN LẬP DANH MỤC SẢN PHẨM CÔNG VIỆC"]);
            sheetData.push(["", "(Ký, ghi rõ họ tên)", "", "", "", "", "(Ký, ghi rõ họ tên)"]);
            sheetData.push([""]);
            sheetData.push([""]);
            sheetData.push([""]);
            sheetData.push(["", "", "", "", "", "", userName]);

            const cols = [
                { wch: 6 }, { wch: 35 }, { wch: 22 }, { wch: 20 }, { wch: 16 }, 
                { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 35 }
            ];

            return { sheetData, cols };
        } else {
            // Phụ lục 4
            const sheetData = [
                ["", "", "", "", "", "", "", "", "", "Phụ lục 4"],
                ["ỦY BAN NHÂN DÂN", "", "", "", "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
                ["THÀNH PHỐ HỒ CHÍ MINH", "", "", "", "Độc lập - Tự do - Hạnh phúc"],
                ["TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN"],
                [""],
                ["", "", "", "BẢNG TÍNH ĐIỂM KPI CỦA CÁ NHÂN"],
                ["", "", "", periodLabel],
                [""],
                [`Họ và tên: ${userName}`],
                [`Chức vụ: ${userPosition}`],
                [""],
                [
                    "TT", 
                    "Tên công việc", 
                    "Điểm chuẩn", 
                    "Hệ số độ khó", 
                    "Điểm quy đổi tối đa", 
                    "Tiến độ %", 
                    "Kết quả %", 
                    "Điểm thực hiện", 
                    "Điểm quy đổi thực tế", 
                    "Công việc vượt yêu cầu về tiến độ/ chất lượng (đánh dấu X)"
                ],
                ["(1)", "(2)", "(3)", "(4)", "(5)", "(6)", "(7)", "(8)", "(9)", "(10)"]
            ];

            let sumMax = 0;
            let sumActual = 0;
            let totalExceeded = 0;
            let totalBonus = 0;

            details.forEach((t, idx) => {
                const base = t.baseScore !== undefined ? t.baseScore : (t.taskType === 'URGENT' ? 12 : 10);
                const diff = t.difficultyRate !== undefined ? t.difficultyRate : 1.0;
                const maxS = Number((base * diff).toFixed(2));
                const prog = t.progressRate !== undefined ? t.progressRate : (t.isOnTime ? 100 : 80);
                const qual = t.qualityRate !== undefined ? t.qualityRate : 100;
                const exec = Number((base * (0.3 * (prog / 100) + 0.7 * (qual / 100))).toFixed(2));
                const act = Number((exec * diff).toFixed(2));
                const exc = t.isExceeded ? 'X' : '';
                if (t.isExceeded) totalExceeded += 1;
                if (t.bonusScore) totalBonus += Number(t.bonusScore);

                sumMax += maxS;
                sumActual += act;

                sheetData.push([
                    idx + 1,
                    t.title || '',
                    base,
                    formatDiffRate(diff),
                    maxS,
                    prog,
                    qual,
                    exec,
                    act,
                    exc
                ]);
            });

            const valA = Number(sumMax.toFixed(2));
            const valB = Number(sumActual.toFixed(2));
            const kpi70 = valA > 0 ? Number(Math.min(70, (valB / valA) * 70).toFixed(1)) : 0;

            sheetData.push(["", "", "", "Điểm giá trị A", valA, "", "", "Điểm giá trị B", valB, ""]);
            sheetData.push([
                "", 
                "KPI = B/A*70 điểm (nếu B>A thì KPI là 70)", 
                kpi70, 
                "(Điểm này được sử dụng để đưa vào cột Điểm đạt được, phần I-B, mẫu 1. Bản tự nhận xét, đánh giá của cá nhân)", 
                "", "", "", "", "", ""
            ]);
            sheetData.push(["", "Tổng số nhiệm vụ vượt tiến độ và đạt yêu cầu chất lượng", totalExceeded, "", "", "", "", "", "", ""]);
            sheetData.push(["", "Tổng số điểm thưởng được đề xuất trong các nhiệm vụ vượt tiến độ/đạt chất lượng", totalBonus > 0 ? totalBonus : '....', "", "", "", "", "", "", ""]);

            sheetData.push([""]);
            sheetData.push(["", "", "", "", "", "", "", `TP. Hồ Chí Minh, ngày ... tháng ... năm ${selectedYear}`]);
            sheetData.push(["", "XÁC NHẬN CỦA LÃNH ĐẠO ĐƠN VỊ", "", "", "", "", "", "CÁ NHÂN ĐÁNH GIÁ"]);
            sheetData.push(["", "(Ký, ghi rõ họ tên)", "", "", "", "", "", "(Ký, ghi rõ họ tên)"]);
            sheetData.push([""]);
            sheetData.push([""]);
            sheetData.push([""]);
            sheetData.push(["", "", "", "", "", "", "", userName]);

            const cols = [
                { wch: 6 }, { wch: 35 }, { wch: 14 }, { wch: 16 }, { wch: 18 },
                { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 26 }
            ];

            return { sheetData, cols };
        }
    };

    // --- XUẤT EXCEL ---
    const handleExportExcel = () => {
        if (!recordsToRender || recordsToRender.length === 0) {
            message.warning("Chưa có dữ liệu để xuất Excel!");
            return;
        }

        const wb = XLSX.utils.book_new();

        if (recordsToRender.length === 1) {
            const { sheetData, cols } = generateExcelSheetData(recordsToRender[0]);
            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            ws['!cols'] = cols;
            const sheetName = reportType === 'PL3' ? 'Phu_Luc_3' : 'Phu_Luc_4';
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            const safe = removeVietnameseTones(recordsToRender[0].user?.name || '');
            XLSX.writeFile(wb, `${reportType === 'PL3' ? 'Phu_Luc_3_DanhMucSP' : 'Phu_Luc_4_BangTinhKPI'}_${safe}_${periodType}_${selectedYear}.xlsx`);
        } else {
            // Xuất nhiều cán bộ: mỗi người 1 sheet
            recordsToRender.forEach((record, idx) => {
                const { sheetData, cols } = generateExcelSheetData(record);
                const ws = XLSX.utils.aoa_to_sheet(sheetData);
                ws['!cols'] = cols;
                let sName = (record.user?.name || `NV_${idx + 1}`).replace(/[\\/?*[\]:]/g, '').trim().slice(0, 25);
                if (wb.SheetNames.includes(sName)) {
                    sName = `${sName.slice(0, 20)}_${idx + 1}`;
                }
                XLSX.utils.book_append_sheet(wb, ws, sName);
            });
            const deptObj = departments.find(d => String(d._id) === String(selectedDept));
            const safeDept = deptObj ? removeVietnameseTones(deptObj.departmentName) : 'DonVi';
            XLSX.writeFile(wb, `${reportType === 'PL3' ? 'Phu_Luc_3_DanhMucSP' : 'Phu_Luc_4_BangTinhKPI'}_${safeDept}_TatCaCanBo_${periodType}_${selectedYear}.xlsx`);
        }

        message.success("Xuất file Excel thành công!");
    };

    // --- XUẤT PDF ---
    const handleExportPdf = () => {
        if (!reportPrintRef.current || recordsToRender.length === 0) return;
        setIsExportingPdf(true);
        message.loading({ content: 'Đang khởi tạo tài liệu PDF...', key: 'pdf_loading' });

        const element = reportPrintRef.current;
        let fileName = '';
        if (recordsToRender.length === 1) {
            const userName = recordsToRender[0].user?.name || 'CanBo';
            const safe = removeVietnameseTones(userName);
            fileName = reportType === 'PL3' 
                ? `Phu_Luc_3_DanhMucSanPham_${safe}_${periodType}_${selectedYear}.pdf`
                : `Phu_Luc_4_BangTinhDiemKPI_${safe}_${periodType}_${selectedYear}.pdf`;
        } else {
            const deptObj = departments.find(d => String(d._id) === String(selectedDept));
            const safeDept = deptObj ? removeVietnameseTones(deptObj.departmentName) : 'DonVi';
            fileName = reportType === 'PL3' 
                ? `Phu_Luc_3_TatCaCanBo_${safeDept}_${periodType}_${selectedYear}.pdf`
                : `Phu_Luc_4_TatCaCanBo_${safeDept}_${periodType}_${selectedYear}.pdf`;
        }

        const opt = {
            margin: [8, 8, 8, 8],
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: reportType === 'PL4' ? 'landscape' : 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            message.success({ content: 'Xuất file PDF thành công!', key: 'pdf_loading' });
            setIsExportingPdf(false);
        }).catch(err => {
            console.error("Lỗi xuất PDF:", err);
            message.error({ content: 'Lỗi khi tạo file PDF', key: 'pdf_loading' });
            setIsExportingPdf(false);
        });
    };

    // --- IN TRỰC TIẾP ---
    const handlePrintDirect = () => {
        window.print();
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
                                        const deadline = t.endDate ? dayjs(t.endDate).format('DD/MM/YYYY') : '';
                                        const proof = t.completedAt ? `Hoàn thành ${dayjs(t.completedAt).format('DD/MM/YYYY')}` : 'Đang làm';

                                        return (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                                                <td className="border border-black p-1.5 font-medium">{t.title}</td>
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
                        const base = t.baseScore !== undefined ? t.baseScore : (t.taskType === 'URGENT' ? 12 : 10);
                        const diff = t.difficultyRate !== undefined ? t.difficultyRate : 1.0;
                        const maxS = Number((base * diff).toFixed(2));
                        const prog = t.progressRate !== undefined ? t.progressRate : (t.isOnTime ? 100 : 80);
                        const qual = t.qualityRate !== undefined ? t.qualityRate : 100;
                        const exec = Number((base * (0.3 * (prog / 100) + 0.7 * (qual / 100))).toFixed(2));
                        const act = Number((exec * diff).toFixed(2));

                        sumMax += maxS;
                        sumActual += act;

                        return { t, idx, base, diff, maxS, prog, qual, exec, act };
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
                                        computedRows.map(({ t, idx, base, diff, maxS, prog, qual, exec, act }) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                                                <td className="border border-black p-1.5 font-medium">{t.title}</td>
                                                <td className="border border-black p-1 text-center">{base}</td>
                                                <td className="border border-black p-1 text-center font-medium">{formatDiffRate(diff)}</td>
                                                <td className="border border-black p-1 text-center font-semibold">{maxS}</td>
                                                <td className="border border-black p-1 text-center">{prog}%</td>
                                                <td className="border border-black p-1 text-center">{qual}%</td>
                                                <td className="border border-black p-1 text-center font-medium">{exec}</td>
                                                <td className="border border-black p-1 text-center font-bold text-blue-900">{act}</td>
                                                <td className="border border-black p-1 text-center font-bold text-red-600">
                                                    {t.isExceeded ? 'X' : ''}
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
                            disabled={!currentUserRecord}
                        >
                            Xuất Excel
                        </Button>
                        <Button 
                            type="primary" 
                            icon={<FilePdfOutlined />} 
                            onClick={handleExportPdf}
                            loading={isExportingPdf}
                            style={{ backgroundColor: '#ff4d4f', borderColor: '#ff4d4f' }}
                            disabled={!currentUserRecord}
                        >
                            Xuất PDF
                        </Button>
                        <Button 
                            type="primary" 
                            icon={<PrinterOutlined />} 
                            onClick={handlePrintDirect}
                            disabled={!currentUserRecord}
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
                            value={selectedDept} 
                            onChange={(val) => {
                                setSelectedDept(val);
                                setSelectedUserId(null);
                            }} 
                            allowClear 
                            placeholder="Tất cả phòng ban / đơn vị"
                            style={{ width: '100%' }}
                            showSearch
                            optionFilterProp="children"
                        >
                            <Option value="">Tất cả phòng ban / đơn vị</Option>
                            {departments.map(d => (
                                <Option key={d._id} value={d._id}>{d.departmentName}</Option>
                            ))}
                        </Select>
                    </Col>

                    <Col xs={24} md={12}>
                        <div className="text-xs text-gray-500 mb-1 font-semibold">Cán bộ / Nhân viên:</div>
                        <Select 
                            value={selectedUserId} 
                            onChange={setSelectedUserId} 
                            placeholder="Chọn cán bộ, nhân viên..."
                            style={{ width: '100%' }}
                            showSearch
                            optionFilterProp="label"
                            optionLabelProp="label"
                            filterOption={(input, option) => {
                                if (!input) return true;
                                const search = removeAccents(input.toLowerCase().trim());
                                const label = removeAccents(String(option?.label || option?.children || "").toLowerCase());
                                return label.includes(search);
                            }}
                        >
                            <Option value="ALL" label={`Tất cả cán bộ trong đơn vị (${filteredUsers.length} người - In 1 lần)`}>
                                <span className="font-bold text-blue-600">
                                    📋 Tất cả cán bộ trong đơn vị ({filteredUsers.length} người - In 1 lần)
                                </span>
                            </Option>
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
