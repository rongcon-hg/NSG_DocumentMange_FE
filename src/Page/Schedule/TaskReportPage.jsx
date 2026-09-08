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

    // Thiết lập mặc định khi người dùng đăng nhập
    useEffect(() => {
        if (isChuyenVien && currentUserId) {
            setSelectedUserId(currentUserId);
            if (userDeptId) setSelectedDept(userDeptId);
        } else if (!isBGH && userDeptId) {
            setSelectedDept(userDeptId);
        }
    }, [isChuyenVien, isBGH, currentUserId, userDeptId]);

    // Lọc danh sách nhân viên theo phòng ban đã chọn
    const filteredUsers = useMemo(() => {
        let list = users;
        if (isChuyenVien && currentUserId) {
            return list.filter(u => u._id === currentUserId);
        }
        if (!isBGH && userDeptId) {
            list = list.filter(u => String(u.department?._id || u.department) === String(userDeptId));
        } else if (selectedDept) {
            list = list.filter(u => String(u.department?._id || u.department) === String(selectedDept));
        }
        return list;
    }, [users, isChuyenVien, isBGH, userDeptId, selectedDept, currentUserId]);

    // Tự động chọn nhân viên đầu tiên nếu chưa chọn
    useEffect(() => {
        if (!selectedUserId && filteredUsers.length > 0) {
            setSelectedUserId(filteredUsers[0]._id);
        } else if (selectedUserId && !filteredUsers.some(u => u._id === selectedUserId)) {
            setSelectedUserId(filteredUsers.length > 0 ? filteredUsers[0]._id : null);
        }
    }, [filteredUsers, selectedUserId]);

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
            if (selectedUserId) params.userId = selectedUserId;

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

    // Lấy thông tin cán bộ được chọn
    const currentUserRecord = useMemo(() => {
        if (!statsData?.leaderboard || !selectedUserId) return null;
        return statsData.leaderboard.find(item => item.user?._id === selectedUserId) || statsData.leaderboard[0] || null;
    }, [statsData, selectedUserId]);

    // Thông tin kỳ đánh giá dạng văn bản
    const periodLabel = useMemo(() => {
        if (periodType === 'QUARTER') {
            const qRoman = selectedQuarter === 1 ? 'I' : selectedQuarter === 2 ? 'II' : selectedQuarter === 3 ? 'III' : 'IV';
            return `QUÝ ${qRoman}, NĂM ${selectedYear}`;
        }
        if (periodType === 'MONTH') return `THÁNG ${selectedMonth}, NĂM ${selectedYear}`;
        return `NĂM ${selectedYear}`;
    }, [periodType, selectedQuarter, selectedMonth, selectedYear]);

    // --- XUẤT EXCEL ---
    const handleExportExcel = () => {
        if (!currentUserRecord) {
            message.warning("Chưa có dữ liệu để xuất Excel!");
            return;
        }

        const user = currentUserRecord.user || {};
        const userName = user.name || '';
        const userPosition = user.position?.positionName || '';
        const userDept = user.department?.departmentName || '';
        const details = currentUserRecord.details || [];

        const wb = XLSX.utils.book_new();

        if (reportType === 'PL3') {
            // Mẫu Phụ lục 3 chuẩn theo hình ảnh media_1788830984238.png
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

            // 3 dòng chân bảng của Phụ lục 3
            sheetData.push(["", "Tổng số nhiệm vụ thực hiện trong quý", details.length, "", "", "", "", "", ""]);
            sheetData.push(["", "Tổng số nhiệm vụ vượt tiến độ/chất lượng", totalExceeded, "", "", "", "", "", ""]);
            sheetData.push(["", "Tổng số điểm thưởng được đề xuất trong các nhiệm vụ vượt tiến độ/đạt chất lượng", totalBonus > 0 ? totalBonus : '....', "", "", "", "", "", ""]);

            // Chữ ký Phụ lục 3 (2 bên: Lãnh đạo đơn vị bên trái, Cá nhân bên phải)
            sheetData.push([""]);
            sheetData.push(["", "", "", "", "", "", `TP. Hồ Chí Minh, ngày ... tháng ... năm ${selectedYear}`]);
            sheetData.push(["", "XÁC NHẬN CỦA LÃNH ĐẠO ĐƠN VỊ", "", "", "", "", "CÁ NHÂN LẬP DANH MỤC SẢN PHẨM CÔNG VIỆC"]);
            sheetData.push(["", "(Ký, ghi rõ họ tên)", "", "", "", "", "(Ký, ghi rõ họ tên)"]);
            sheetData.push([""]);
            sheetData.push([""]);
            sheetData.push([""]);
            sheetData.push(["", "", "", "", "", "", userName]);

            // Khối Ghi chú của Phụ lục 3
            sheetData.push([""]);
            sheetData.push(["Ghi chú:"]);
            sheetData.push(["Danh mục sản phẩm/công việc chuẩn được lập tập trung các nội dung trọng tâm theo chủ đề năm học, nhiệm vụ trọng tâm trong năm học, trong quý; theo chức năng, nhiệm vụ và công việc được phân công; công tác đổi mới sáng tạo, chuyển đổi số; giữ gìn nội bộ thống nhất, đoàn kết, phòng chống tham nhũng, tiêu cực."]);
            sheetData.push(["Cột 2. Tên công việc: ghi nội dung ngắn gọn, phản ánh đúng nhiệm vụ;"]);
            sheetData.push(["Cột 3. Kết quả đầu ra: ghi loại văn bản cụ thể như báo cáo, công văn, kế hoạch, đề án, hồ sơ, dữ liệu;"]);
            sheetData.push(["Cột 4. Thời hạn hoàn thành: ghi ngày hoặc mốc thời gian yêu cầu hoàn thành sản phẩm; Đối với thời hạn hoàn thành trong quý phải ghi cụ thể ngày hoàn thành, không ghi chung chung khó xác định được tiến độ hoàn thành trước hay chậm trễ tiến độ tại phần minh chứng."]);
            sheetData.push(["Cột 5. Loại công việc:"]);
            sheetData.push(["+ Thường xuyên là các nhiệm vụ theo chức năng, nhiệm vụ và kế hoạch công tác;"]);
            sheetData.push(["+ Đột xuất là các nhiệm vụ phát sinh do cấp có thẩm quyền giao ngoài kế hoạch."]);
            sheetData.push(["Cột 6. Điểm chuẩn: Công việc thường xuyên 10 điểm/công việc; Công việc đột xuất 12 điểm/công việc;"]);
            sheetData.push(["Cột 7. Hệ số độ khó: phải được xác định ngay khi giao việc và được người giao việc phê duyệt"]);
            sheetData.push(["+ Công việc thông thường: 100%;"]);
            sheetData.push(["+ Công việc cần phối hợp từ 3 đơn vị / người thực hiện trở xuống: 110%"]);
            sheetData.push(["+ Công việc cần phối hợp từ 4 đơn vị / người thực hiện trở lên: 120%"]);
            sheetData.push(["Cột 8. Điểm quy đổi tối đa = Điểm chuẩn (cột 6) × Hệ số độ khó (cột 7);"]);
            sheetData.push(["Cột 9. Minh chứng: Ghi Văn bản ban hành, hồ sơ, báo cáo, số liệu, hệ thống điện tử và ngày tháng hoàn thành sản phẩm."]);

            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            ws['!cols'] = [
                { wch: 6 }, { wch: 35 }, { wch: 22 }, { wch: 20 }, { wch: 16 }, 
                { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 35 }
            ];
            XLSX.utils.book_append_sheet(wb, ws, "Phu_Luc_3");
            const safe = removeVietnameseTones(userName);
            XLSX.writeFile(wb, `Phu_Luc_3_DanhMucSanPham_${safe}_${periodType}_${selectedYear}.xlsx`);
            message.success("Xuất file Excel Phụ lục 3 thành công!");
        } else {
            // Mẫu Phụ lục 4 chuẩn theo hình ảnh media_1788830899665.png
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

            // 4 dòng tổng kết chân bảng chuẩn Phụ lục 4
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

            // Chữ ký Phụ lục 4 (2 bên: Lãnh đạo đơn vị bên trái, Cá nhân bên phải)
            sheetData.push([""]);
            sheetData.push(["", "", "", "", "", "", "", `TP. Hồ Chí Minh, ngày ... tháng ... năm ${selectedYear}`]);
            sheetData.push(["", "XÁC NHẬN CỦA LÃNH ĐẠO ĐƠN VỊ", "", "", "", "", "", "CÁ NHÂN ĐÁNH GIÁ"]);
            sheetData.push(["", "(Ký, ghi rõ họ tên)", "", "", "", "", "", "(Ký, ghi rõ họ tên)"]);
            sheetData.push([""]);
            sheetData.push([""]);
            sheetData.push([""]);
            sheetData.push(["", "", "", "", "", "", "", userName]);

            // Khối Ghi chú của Phụ lục 4
            sheetData.push([""]);
            sheetData.push(["Ghi chú:"]);
            sheetData.push(["Cột 2. Tên công việc: ghi nội dung ngắn gọn, phản ánh đúng nhiệm vụ;"]);
            sheetData.push(["Cột 3. Điểm chuẩn: Điểm chuẩn của công việc được xác định tại Danh mục sản phẩm công việc chuẩn"]);
            sheetData.push(["Cột 4. Hệ số độ khó: Hệ số độ khó của công việc được xác định tại Danh mục sản phẩm công việc chuẩn"]);
            sheetData.push(["Cột 5. Điểm quy đổi tối đa = Điểm chuẩn (cột 3) × Hệ số độ khó (cột 4);"]);
            sheetData.push(["Cột 6. Tiến độ %: tỷ lệ điểm căn cứ theo thời hạn hoàn thành"]);
            sheetData.push(["+ Hoàn thành đúng hoặc trước hạn: 100%;"]);
            sheetData.push(["+ Hoàn thành chậm 1 - 3 ngày làm việc: 80%;"]);
            sheetData.push(["+ Hoàn thành chậm 4 - 5 ngày làm việc: 60%;"]);
            sheetData.push(["+ Hoàn thành chậm trên 5 ngày làm việc: 0%."]);
            sheetData.push(["Cột 7. Kết quả %: tỷ lệ điểm căn cứ chất lượng sản phẩm"]);
            sheetData.push(["+ Đạt đầy đủ yêu cầu: 100%;  + Đạt yêu cầu, chỉnh sửa nhỏ: 80%;"]);
            sheetData.push(["+ Hoàn thành cơ bản: 60%;    + Không đạt yêu cầu: 0%."]);
            sheetData.push(["Cột 8. Điểm thực hiện = Điểm chuẩn (cột 3)*{30%*Tiến độ % (cột 6) + 70%*Kết quả % (cột 7)}"]);
            sheetData.push(["Cột 9. Điểm quy đổi thực tế = Điểm thực hiện (cột 8) × Hệ số độ khó (cột 4)"]);
            sheetData.push(["Giá trị A: Tổng Điểm quy đổi tối đa (tổng cột 5);  Giá trị B: Tổng Điểm quy đổi thực tế (tổng cột 9)"]);
            sheetData.push(["KPI= (B/A)*70 điểm (Nếu B>A thì KPI đạt tối đa 70 điểm)."]);
            sheetData.push(["Cột 10. Công việc hoàn thành vượt yêu cầu, đảm bảo về cả mặt tiến độ và chất lượng: Đánh dấu \"X\" vào những nội dung có tiến độ hoàn thành sớm so với thời hạn hoàn thành đã đề ra trong Danh mục sản phẩm công việc chuẩn và điểm kết quả đạt 100%"]);

            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            ws['!cols'] = [
                { wch: 6 }, { wch: 35 }, { wch: 14 }, { wch: 16 }, { wch: 18 },
                { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 26 }
            ];
            XLSX.utils.book_append_sheet(wb, ws, "Phu_Luc_4");
            const safe = removeVietnameseTones(userName);
            XLSX.writeFile(wb, `Phu_Luc_4_BangTinhDiemKPI_${safe}_${periodType}_${selectedYear}.xlsx`);
            message.success("Xuất file Excel Phụ lục 4 thành công!");
        }
    };

    // --- XUẤT PDF ---
    const handleExportPdf = () => {
        if (!reportPrintRef.current) return;
        setIsExportingPdf(true);
        message.loading({ content: 'Đang khởi tạo tài liệu PDF...', key: 'pdf_loading' });

        const element = reportPrintRef.current;
        const userName = currentUserRecord?.user?.name || 'CanBo';
        const safe = removeVietnameseTones(userName);
        const fileName = reportType === 'PL3' 
            ? `Phu_Luc_3_DanhMucSanPham_${safe}.pdf`
            : `Phu_Luc_4_BangTinhDiemKPI_${safe}.pdf`;

        const opt = {
            margin: [8, 8, 8, 8],
            filename: fileName,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: reportType === 'PL4' ? 'landscape' : 'portrait' }
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

                    <Col xs={24} sm={12} md={4}>
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
                        <Col xs={12} sm={6} md={4}>
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
                        <Col xs={12} sm={6} md={4}>
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

                    <Col xs={12} sm={6} md={4}>
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

                    <Col xs={24} sm={12} md={4}>
                        <div className="text-xs text-gray-500 mb-1 font-semibold">Phòng ban:</div>
                        <Select 
                            value={selectedDept} 
                            onChange={setSelectedDept} 
                            allowClear={isBGH} 
                            disabled={!isBGH}
                            placeholder={isBGH ? "Tất cả đơn vị" : "Đơn vị của tôi"}
                            style={{ width: '100%' }}
                            showSearch
                            optionFilterProp="children"
                        >
                            {(isBGH ? departments : departments.filter(d => String(d._id) === String(userDeptId))).map(d => (
                                <Option key={d._id} value={d._id}>{d.departmentName}</Option>
                            ))}
                        </Select>
                    </Col>

                    <Col xs={24} sm={12} md={8}>
                        <div className="text-xs text-gray-500 mb-1 font-semibold">Cán bộ / Nhân viên:</div>
                        <Select 
                            value={selectedUserId} 
                            onChange={setSelectedUserId} 
                            disabled={isChuyenVien}
                            placeholder="Chọn cán bộ, nhân viên..."
                            style={{ width: '100%' }}
                            showSearch
                            optionFilterProp="children"
                        >
                            {filteredUsers.map(u => (
                                <Option key={u._id} value={u._id}>
                                    {u.name} ({u.position?.positionName || 'Chuyên viên'} - {u.department?.departmentName || u.email})
                                </Option>
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
                ) : !currentUserRecord ? (
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
                                <span className="font-bold uppercase">{currentUserRecord.user?.name || '....................'}</span>
                            </div>
                            <div>
                                <span className="inline-block w-24 font-normal">Chức vụ:</span>
                                <span>{currentUserRecord.user?.position?.positionName || 'Chuyên viên'}</span>
                            </div>
                        </div>

                        {/* BẢNG NỘI DUNG: PHỤ LỤC 3 (Đúng chuẩn 9 cột theo ảnh) */}
                        {reportType === 'PL3' && (() => {
                            const details = currentUserRecord.details || [];
                            const totalExceeded = details.filter(t => t.isExceeded).length;
                            const totalBonus = details.reduce((acc, t) => acc + (t.bonusScore ? Number(t.bonusScore) : 0), 0);

                            return (
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
                            );
                        })()}

                        {/* BẢNG NỘI DUNG: PHỤ LỤC 4 (Đúng chuẩn 10 cột theo ảnh) */}
                        {reportType === 'PL4' && (() => {
                            const details = currentUserRecord.details || [];
                            const totalExceeded = details.filter(t => t.isExceeded).length;
                            const totalBonus = details.reduce((acc, t) => acc + (t.bonusScore ? Number(t.bonusScore) : 0), 0);

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
                                            {details.length > 0 ? (
                                                details.map((t, idx) => {
                                                    const base = t.baseScore !== undefined ? t.baseScore : (t.taskType === 'URGENT' ? 12 : 10);
                                                    const diff = t.difficultyRate !== undefined ? t.difficultyRate : 1.0;
                                                    const maxS = Number((base * diff).toFixed(2));
                                                    const prog = t.progressRate !== undefined ? t.progressRate : (t.isOnTime ? 100 : 80);
                                                    const qual = t.qualityRate !== undefined ? t.qualityRate : 100;
                                                    const exec = Number((base * (0.3 * (prog / 100) + 0.7 * (qual / 100))).toFixed(2));
                                                    const act = Number((exec * diff).toFixed(2));
                                                    const exc = t.isExceeded ? 'X' : '';

                                                    return (
                                                        <tr key={idx} className="hover:bg-gray-50">
                                                            <td className="border border-black p-1 text-center">{idx + 1}</td>
                                                            <td className="border border-black p-1 font-medium">{t.title}</td>
                                                            <td className="border border-black p-1 text-center">{base}</td>
                                                            <td className="border border-black p-1 text-center font-medium">{formatDiffRate(diff)}</td>
                                                            <td className="border border-black p-1 text-center font-semibold text-red-600">{maxS}</td>
                                                            <td className="border border-black p-1 text-center">{prog}</td>
                                                            <td className="border border-black p-1 text-center">{qual}</td>
                                                            <td className="border border-black p-1 text-center font-semibold text-red-600">{exec}</td>
                                                            <td className="border border-black p-1 text-center font-bold text-red-600">{act}</td>
                                                            <td className="border border-black p-1 text-center font-bold text-blue-900">{exc}</td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={10} className="border border-black p-4 text-center italic text-gray-500">
                                                        Không có công việc nào trong kỳ đánh giá này.
                                                    </td>
                                                </tr>
                                            )}

                                            {/* Dòng 1: Điểm giá trị A & Điểm giá trị B với ô màu vàng */}
                                            <tr>
                                                <td colSpan={3} className="border border-black p-1"></td>
                                                <td className="border border-black p-1 font-bold text-right">Điểm giá trị A</td>
                                                <td className="border border-black p-1 text-center font-bold text-red-600 bg-yellow-200">
                                                    {currentUserRecord.valueA || 0}
                                                </td>
                                                <td colSpan={3} className="border border-black p-1 font-bold text-right">Điểm giá trị B</td>
                                                <td className="border border-black p-1 text-center font-bold text-red-600 bg-yellow-200">
                                                    {currentUserRecord.valueB || 0}
                                                </td>
                                                <td className="border border-black p-1"></td>
                                            </tr>

                                            {/* Dòng 2: KPI = B/A*70 điểm */}
                                            <tr>
                                                <td colSpan={2} className="border border-black p-1 font-bold text-left">
                                                    KPI = B/A*70 điểm (nếu B&gt;A thì KPI là 70)
                                                </td>
                                                <td className="border border-black p-1 text-center font-bold text-red-600 bg-yellow-200">
                                                    {currentUserRecord.kpiScore70 || 0}
                                                </td>
                                                <td colSpan={7} className="border border-black p-1 text-xs italic">
                                                    (Điểm này được sử dụng để đưa vào cột Điểm đạt được, phần I-B, mẫu 1. Bản tự nhận xét, đánh giá của cá nhân)
                                                </td>
                                            </tr>

                                            {/* Dòng 3: Tổng số nhiệm vụ vượt tiến độ */}
                                            <tr>
                                                <td colSpan={2} className="border border-black p-1 italic">
                                                    Tổng số nhiệm vụ vượt tiến độ và đạt yêu cầu chất lượng
                                                </td>
                                                <td className="border border-black p-1 text-center font-bold">
                                                    {totalExceeded > 0 ? totalExceeded : '....'}
                                                </td>
                                                <td colSpan={7} className="border border-black p-1"></td>
                                            </tr>

                                            {/* Dòng 4: Tổng số điểm thưởng đề xuất */}
                                            <tr>
                                                <td colSpan={2} className="border border-black p-1 italic">
                                                    Tổng số điểm thưởng được đề xuất trong các nhiệm vụ vượt tiến độ/đạt chất lượng
                                                </td>
                                                <td className="border border-black p-1 text-center font-bold">
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
                                <div className="font-bold text-sm">{currentUserRecord.user?.name || ''}</div>
                            </div>
                        </div>

                        {/* Khối Ghi chú chi tiết ở cuối trang (chuẩn 100% theo hình ảnh) */}
                        <div className="mt-6 pt-3 border-t border-gray-300 text-[11px] sm:text-xs leading-relaxed text-gray-800 print:break-inside-avoid">
                            <div className="font-bold underline mb-1">Ghi chú:</div>
                            {reportType === 'PL3' ? (
                                <div className="space-y-1">
                                    <div>Danh mục sản phẩm/công việc chuẩn được lập tập trung các nội dung trọng tâm theo chủ đề năm học, nhiệm vụ trọng tâm trong năm học, trong quý; theo chức năng, nhiệm vụ và công việc được phân công; công tác đổi mới sáng tạo, chuyển đổi số; giữ gìn nội bộ thống nhất, đoàn kết, phòng chống tham nhũng, tiêu cực.</div>
                                    <div><b>Cột 2. Tên công việc:</b> ghi nội dung ngắn gọn, phản ánh đúng nhiệm vụ;</div>
                                    <div><b>Cột 3. Kết quả đầu ra:</b> ghi loại văn bản cụ thể như báo cáo, công văn, kế hoạch, đề án, hồ sơ, dữ liệu;</div>
                                    <div><b>Cột 4. Thời hạn hoàn thành:</b> ghi ngày hoặc mốc thời gian yêu cầu hoàn thành sản phẩm; Đối với thời hạn hoàn thành trong quý phải ghi cụ thể ngày hoàn thành, không ghi chung chung khó xác định được tiến độ hoàn thành trước hay chậm trễ tiến độ tại phần minh chứng.</div>
                                    <div><b>Cột 5. Loại công việc:</b></div>
                                    <div className="pl-3">+ Thường xuyên là các nhiệm vụ theo chức năng, nhiệm vụ và kế hoạch công tác;</div>
                                    <div className="pl-3">+ Đột xuất là các nhiệm vụ phát sinh do cấp có thẩm quyền giao ngoài kế hoạch.</div>
                                    <div><b>Cột 6. Điểm chuẩn:</b> Công việc thường xuyên 10 điểm/công việc; Công việc đột xuất 12 điểm/công việc;</div>
                                    <div><b>Cột 7. Hệ số độ khó:</b> phải được xác định ngay khi giao việc và được người giao việc phê duyệt</div>
                                    <div className="pl-3">+ Công việc thông thường: 100%;</div>
                                    <div className="pl-3">+ Công việc cần phối hợp từ 3 đơn vị / người thực hiện trở xuống: 110%</div>
                                    <div className="pl-3">+ Công việc cần phối hợp từ 4 đơn vị / người thực hiện trở lên: 120%</div>
                                    <div><b>Cột 8. Điểm quy đổi tối đa</b> = Điểm chuẩn (cột 6) × Hệ số độ khó (cột 7);</div>
                                    <div><b>Cột 9. Minh chứng:</b> Ghi Văn bản ban hành, hồ sơ, báo cáo, số liệu, hệ thống điện tử và ngày tháng hoàn thành sản phẩm.</div>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <div><b>Cột 2. Tên công việc:</b> ghi nội dung ngắn gọn, phản ánh đúng nhiệm vụ;</div>
                                    <div><b>Cột 3. Điểm chuẩn:</b> Điểm chuẩn của công việc được xác định tại Danh mục sản phẩm công việc chuẩn</div>
                                    <div><b>Cột 4. Hệ số độ khó:</b> Hệ số độ khó của công việc được xác định tại Danh mục sản phẩm công việc chuẩn</div>
                                    <div><b>Cột 5. Điểm quy đổi tối đa</b> = Điểm chuẩn (cột 3) × Hệ số độ khó (cột 4);</div>
                                    <div><b>Cột 6. Tiến độ %:</b> tỷ lệ điểm căn cứ theo thời hạn hoàn thành</div>
                                    <div className="pl-3">+ Hoàn thành đúng hoặc trước hạn: 100%;</div>
                                    <div className="pl-3">+ Hoàn thành chậm 1 - 3 ngày làm việc: 80%;</div>
                                    <div className="pl-3">+ Hoàn thành chậm 4 - 5 ngày làm việc: 60%;</div>
                                    <div className="pl-3">+ Hoàn thành chậm trên 5 ngày làm việc: 0%.</div>
                                    <div><b>Cột 7. Kết quả %:</b> tỷ lệ điểm căn cứ chất lượng sản phẩm</div>
                                    <div className="pl-3">+ Đạt đầy đủ yêu cầu: 100%; &nbsp;&nbsp;&nbsp;&nbsp; + Đạt yêu cầu, chỉnh sửa nhỏ: 80%;</div>
                                    <div className="pl-3">+ Hoàn thành cơ bản: 60%; &nbsp;&nbsp;&nbsp;&nbsp; + Không đạt yêu cầu: 0%.</div>
                                    <div><b>Cột 8. Điểm thực hiện</b> = Điểm chuẩn (cột 3) × {'{'}30% × Tiến độ % (cột 6) + 70% × Kết quả % (cột 7){'}'}</div>
                                    <div><b>Cột 9. Điểm quy đổi thực tế</b> = Điểm thực hiện (cột 8) × Hệ số độ khó (cột 4)</div>
                                    <div><b>Giá trị A:</b> Tổng Điểm quy đổi tối đa (tổng cột 5); &nbsp;&nbsp;&nbsp;&nbsp; <b>Giá trị B:</b> Tổng Điểm quy đổi thực tế (tổng cột 9)</div>
                                    <div><b>KPI = (B/A) × 70 điểm</b> (Nếu B &gt; A thì KPI đạt tối đa 70 điểm).</div>
                                    <div><b>Cột 10. Công việc hoàn thành vượt yêu cầu, đảm bảo về cả mặt tiến độ và chất lượng:</b> Đánh dấu "X" vào những nội dung có tiến độ hoàn thành sớm so với thời hạn hoàn thành đã đề ra trong Danh mục sản phẩm công việc chuẩn và điểm kết quả đạt 100%</div>
                                </div>
                            )}
                        </div>
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
