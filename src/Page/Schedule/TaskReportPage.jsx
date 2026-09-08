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

// Helper xóa dấu tiếng Việt phục vụ tên file
const removeVietnameseTones = (str) => {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D')
        .replace(/[^a-zA-Z0-9]/g, '_');
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
        if (periodType === 'QUARTER') return `Quý ${selectedQuarter}, Năm ${selectedYear}`;
        if (periodType === 'MONTH') return `Tháng ${selectedMonth}, Năm ${selectedYear}`;
        return `Năm ${selectedYear}`;
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
            // Mẫu Phụ lục 3
            const sheetData = [
                ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
                ["Độc lập - Tự do - Hạnh phúc"],
                [""],
                ["PHỤ LỤC 3: DANH MỤC SẢN PHẨM CÔNG VIỆC CỦA CÁ NHÂN"],
                [`(${periodLabel})`],
                [""],
                [`1. Họ và tên: ${userName}`],
                [`2. Chức danh / Vị trí việc làm: ${userPosition}`],
                [`3. Đơn vị công tác: ${userDept}`],
                [""],
                ["STT", "Danh mục sản phẩm / Tên công việc", "Loại công việc", "Kết quả đầu ra", "Đơn vị / Người phối hợp", "Thời gian hoàn thành"]
            ];

            details.forEach((t, idx) => {
                const typeName = (t.taskType === 'URGENT' || t.priority === 'URGENT' || t.priority === 'FLASH') ? 'Đột xuất' : 'Thường xuyên';
                const output = t.outputResult || (t.description ? t.description.slice(0, 50) : 'Hoàn thành nhiệm vụ');
                const collab = t.role === 'collaborator' ? 'Phối hợp thực hiện' : (t.subtaskInfo ? `Phối hợp: ${t.subtaskInfo.title}` : 'Chủ trì thực hiện');
                const comp = t.completedAt ? dayjs(t.completedAt).format('DD/MM/YYYY') : (t.endDate ? dayjs(t.endDate).format('DD/MM/YYYY') : '');

                sheetData.push([idx + 1, t.title || '', typeName, output, collab, comp]);
            });

            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            ws['!cols'] = [{ wch: 6 }, { wch: 35 }, { wch: 18 }, { wch: 25 }, { wch: 25 }, { wch: 20 }];
            XLSX.utils.book_append_sheet(wb, ws, "Phu_Luc_3");
            const safe = removeVietnameseTones(userName);
            XLSX.writeFile(wb, `Phu_Luc_3_DanhMucSanPham_${safe}_${periodType}_${selectedYear}.xlsx`);
            message.success("Xuất file Excel Phụ lục 3 thành công!");
        } else {
            // Mẫu Phụ lục 4
            const sheetData = [
                ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
                ["Độc lập - Tự do - Hạnh phúc"],
                [""],
                ["PHỤ LỤC 4: BẢNG TÍNH ĐIỂM KPI CỦA CÁ NHÂN"],
                [`(${periodLabel})`],
                [""],
                [`1. Họ và tên: ${userName}`],
                [`2. Vị trí việc làm: ${userPosition}`],
                [`3. Đơn vị công tác: ${userDept}`],
                [""],
                [
                    "STT", 
                    "Tên công việc / Sản phẩm", 
                    "Điểm chuẩn (1)", 
                    "Hệ số độ khó (2)", 
                    "Điểm quy đổi tối đa (3 = 1 x 2)", 
                    "Tiến độ % (4)", 
                    "Kết quả % (5)", 
                    "Điểm thực hiện (6 = 1 x [30%x(4) + 70%x(5)])", 
                    "Điểm quy đổi thực tế (7 = 6 x 2)", 
                    "Vượt yêu cầu (8)", 
                    "Đề xuất khen thưởng (9)"
                ]
            ];

            let sumMax = 0;
            let sumActual = 0;

            details.forEach((t, idx) => {
                const base = t.baseScore !== undefined ? t.baseScore : (t.taskType === 'URGENT' ? 12 : 10);
                const diff = t.difficultyRate !== undefined ? t.difficultyRate : 1.0;
                const maxS = Number((base * diff).toFixed(2));
                const prog = t.progressRate !== undefined ? t.progressRate : (t.isOnTime ? 100 : 80);
                const qual = t.qualityRate !== undefined ? t.qualityRate : 100;
                const exec = Number((base * (0.3 * (prog / 100) + 0.7 * (qual / 100))).toFixed(2));
                const act = Number((exec * diff).toFixed(2));
                const exc = t.isExceeded ? 'X' : '';
                const bonus = t.bonusScore ? `+${t.bonusScore}đ` : '';

                sumMax += maxS;
                sumActual += act;

                sheetData.push([
                    idx + 1,
                    t.title || '',
                    base,
                    diff,
                    maxS,
                    `${prog}%`,
                    `${qual}%`,
                    exec,
                    act,
                    exc,
                    bonus
                ]);
            });

            const valA = Number(sumMax.toFixed(2));
            const valB = Number(sumActual.toFixed(2));
            const kpi70 = valA > 0 ? Number(Math.min(70, (valB / valA) * 70).toFixed(1)) : 0;
            const kpi100 = valA > 0 ? Math.min(100, Math.round((valB / valA) * 100)) : 0;
            const rankName = kpi70 >= 63 ? 'Hạng A (Xuất sắc)' : kpi70 >= 52.5 ? 'Hạng B (Tốt)' : kpi70 >= 35 ? 'Hạng C (Đạt)' : 'Hạng D (Chưa đạt)';

            sheetData.push([""]);
            sheetData.push(["", "TỔNG CỘNG:", "", "", valA, "", "", "", valB, "", ""]);
            sheetData.push(["", "Tổng điểm quy đổi tối đa (Giá trị A):", "", "", valA]);
            sheetData.push(["", "Tổng điểm quy đổi thực tế (Giá trị B):", "", "", valB]);
            sheetData.push(["", "ĐIỂM KPI CÁ NHÂN (Thang 70 điểm = (B / A) * 70):", "", "", `${kpi70} / 70 điểm`]);
            sheetData.push(["", "ĐIỂM KPI QUY ĐỔI (Thang 100 = (B / A) * 100):", "", "", `${kpi100} / 100 (${kpi100}%)`]);
            sheetData.push(["", "KẾT QUẢ XẾP LOẠI:", "", "", rankName]);

            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            ws['!cols'] = [
                { wch: 6 }, { wch: 35 }, { wch: 14 }, { wch: 15 }, { wch: 18 },
                { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 22 }
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
                        className={`bg-white shadow-md border border-gray-300 p-8 sm:p-12 text-black transition-all ${
                            reportType === 'PL4' ? 'w-full max-w-6xl' : 'w-full max-w-4xl'
                        }`}
                        style={{
                            fontFamily: '"Times New Roman", Times, serif',
                            minHeight: '297mm',
                            fontSize: '14px',
                            lineHeight: '1.4'
                        }}
                    >
                        {/* Header Cơ quan & Quốc hiệu */}
                        <div className="flex justify-between items-start pb-4 border-b border-gray-300">
                            <div className="text-center w-1/2 pr-2">
                                <div className="text-xs font-semibold uppercase">TRƯỜNG CAO ĐẲNG BÁCH KHOA</div>
                                <div className="text-xs font-bold uppercase text-blue-900">NAM SÀI GÒN</div>
                                <div className="text-xs font-semibold mt-0.5">
                                    {currentUserRecord.user?.department?.departmentName?.toUpperCase() || 'ĐƠN VỊ CÔNG TÁC'}
                                </div>
                                <div className="w-24 h-[1px] bg-black mx-auto mt-1"></div>
                            </div>
                            <div className="text-center w-1/2 pl-2">
                                <div className="text-xs font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                <div className="text-xs font-bold">Độc lập - Tự do - Hạnh phúc</div>
                                <div className="w-32 h-[1px] bg-black mx-auto mt-1"></div>
                            </div>
                        </div>

                        {/* Tiêu đề Báo cáo */}
                        <div className="text-center py-6">
                            <h2 className="text-lg sm:text-xl font-bold uppercase tracking-wide">
                                {reportType === 'PL3' 
                                    ? 'PHỤ LỤC 3: DANH MỤC SẢN PHẨM CÔNG VIỆC CỦA CÁ NHÂN' 
                                    : 'PHỤ LỤC 4: BẢNG TÍNH ĐIỂM KPI CỦA CÁ NHÂN'
                                }
                            </h2>
                            <div className="italic text-sm mt-1">({periodLabel})</div>
                        </div>

                        {/* Thông tin cá nhân */}
                        <div className="space-y-1 pb-4 text-sm">
                            <div className="flex">
                                <span className="w-56 font-semibold">1. Họ và tên:</span>
                                <span className="font-bold uppercase text-blue-950">{currentUserRecord.user?.name || 'N/A'}</span>
                            </div>
                            <div className="flex">
                                <span className="w-56 font-semibold">2. Chức danh / Vị trí việc làm:</span>
                                <span>{currentUserRecord.user?.position?.positionName || 'Chuyên viên'}</span>
                            </div>
                            <div className="flex">
                                <span className="w-56 font-semibold">3. Đơn vị công tác:</span>
                                <span>{currentUserRecord.user?.department?.departmentName || 'N/A'}</span>
                            </div>
                        </div>

                        {/* BẢNG NỘI DUNG: PHỤ LỤC 3 */}
                        {reportType === 'PL3' && (
                            <div className="overflow-x-auto my-4">
                                <table className="w-full border-collapse border border-black text-xs sm:text-sm">
                                    <thead>
                                        <tr className="bg-gray-100 text-center font-bold">
                                            <th className="border border-black p-2 w-10">STT</th>
                                            <th className="border border-black p-2">Danh mục sản phẩm / Tên công việc</th>
                                            <th className="border border-black p-2 w-28">Loại công việc</th>
                                            <th className="border border-black p-2 w-36">Kết quả đầu ra</th>
                                            <th className="border border-black p-2 w-44">Đơn vị / Người phối hợp</th>
                                            <th className="border border-black p-2 w-28">Thời gian hoàn thành</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentUserRecord.details && currentUserRecord.details.length > 0 ? (
                                            currentUserRecord.details.map((t, idx) => {
                                                const typeName = (t.taskType === 'URGENT' || t.priority === 'URGENT' || t.priority === 'FLASH') 
                                                    ? 'Đột xuất' 
                                                    : 'Thường xuyên';
                                                const output = t.outputResult || (t.description ? t.description.slice(0, 60) : 'Hoàn thành nhiệm vụ');
                                                const collab = t.role === 'collaborator' 
                                                    ? 'Phối hợp thực hiện' 
                                                    : (t.subtaskInfo ? `Phối hợp: ${t.subtaskInfo.title}` : 'Chủ trì thực hiện');
                                                const comp = t.completedAt ? dayjs(t.completedAt).format('DD/MM/YYYY') : (t.endDate ? dayjs(t.endDate).format('DD/MM/YYYY') : '');

                                                return (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                        <td className="border border-black p-2 text-center">{idx + 1}</td>
                                                        <td className="border border-black p-2 font-medium">{t.title}</td>
                                                        <td className="border border-black p-2 text-center">{typeName}</td>
                                                        <td className="border border-black p-2">{output}</td>
                                                        <td className="border border-black p-2">{collab}</td>
                                                        <td className="border border-black p-2 text-center">{comp}</td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="border border-black p-4 text-center italic text-gray-500">
                                                    Không có sản phẩm, công việc nào trong kỳ đánh giá này.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* BẢNG NỘI DUNG: PHỤ LỤC 4 */}
                        {reportType === 'PL4' && (
                            <div className="overflow-x-auto my-4">
                                <table className="w-full border-collapse border border-black text-xs">
                                    <thead>
                                        <tr className="bg-gray-100 text-center font-bold">
                                            <th className="border border-black p-1 w-8">STT</th>
                                            <th className="border border-black p-1.5 min-w-[160px]">Tên công việc / Sản phẩm</th>
                                            <th className="border border-black p-1 w-14">Điểm chuẩn<br/>(1)</th>
                                            <th className="border border-black p-1 w-16">Hệ số độ khó<br/>(2)</th>
                                            <th className="border border-black p-1 w-20">Điểm tối đa<br/>(3 = 1 x 2)</th>
                                            <th className="border border-black p-1 w-14">Tiến độ %<br/>(4)</th>
                                            <th className="border border-black p-1 w-14">Kết quả %<br/>(5)</th>
                                            <th className="border border-black p-1 w-24">Điểm thực hiện<br/>(6 = 1x[30%(4)+70%(5)])</th>
                                            <th className="border border-black p-1 w-20">Quy đổi thực tế<br/>(7 = 6 x 2)</th>
                                            <th className="border border-black p-1 w-14">Vượt yêu cầu<br/>(8)</th>
                                            <th className="border border-black p-1 w-20">Đề xuất khen thưởng<br/>(9)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentUserRecord.details && currentUserRecord.details.length > 0 ? (
                                            currentUserRecord.details.map((t, idx) => {
                                                const base = t.baseScore !== undefined ? t.baseScore : (t.taskType === 'URGENT' ? 12 : 10);
                                                const diff = t.difficultyRate !== undefined ? t.difficultyRate : 1.0;
                                                const maxS = Number((base * diff).toFixed(2));
                                                const prog = t.progressRate !== undefined ? t.progressRate : (t.isOnTime ? 100 : 80);
                                                const qual = t.qualityRate !== undefined ? t.qualityRate : 100;
                                                const exec = Number((base * (0.3 * (prog / 100) + 0.7 * (qual / 100))).toFixed(2));
                                                const act = Number((exec * diff).toFixed(2));
                                                const exc = t.isExceeded ? 'X' : '';
                                                const bonus = t.bonusScore ? `+${t.bonusScore}đ` : '';

                                                return (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                        <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                                                        <td className="border border-black p-1.5 font-medium">
                                                            {t.title}
                                                            {t.outputResult && (
                                                                <div className="text-[11px] text-gray-500 italic">SP: {t.outputResult}</div>
                                                            )}
                                                        </td>
                                                        <td className="border border-black p-1 text-center">{base}</td>
                                                        <td className="border border-black p-1 text-center">{diff}</td>
                                                        <td className="border border-black p-1 text-center font-semibold">{maxS}</td>
                                                        <td className="border border-black p-1 text-center">{prog}%</td>
                                                        <td className="border border-black p-1 text-center">{qual}%</td>
                                                        <td className="border border-black p-1 text-center font-semibold">{exec}</td>
                                                        <td className="border border-black p-1 text-center font-bold text-blue-900">{act}</td>
                                                        <td className="border border-black p-1 text-center font-bold text-red-600">{exc}</td>
                                                        <td className="border border-black p-1 text-center text-amber-700">{bonus}</td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={11} className="border border-black p-4 text-center italic text-gray-500">
                                                    Không có công việc nào trong kỳ đánh giá này.
                                                </td>
                                            </tr>
                                        )}

                                        {/* Dòng tổng kết điểm theo Phụ lục 4 */}
                                        <tr className="bg-amber-50 font-bold">
                                            <td colSpan={4} className="border border-black p-1.5 text-right uppercase">
                                                Tổng cộng:
                                            </td>
                                            <td className="border border-black p-1 text-center text-blue-900">
                                                {currentUserRecord.valueA || 0}
                                            </td>
                                            <td colSpan={3} className="border border-black p-1 text-right">
                                                Tổng quy đổi thực tế (B):
                                            </td>
                                            <td className="border border-black p-1 text-center text-blue-900 text-sm">
                                                {currentUserRecord.valueB || 0}
                                            </td>
                                            <td className="border border-black p-1 text-center text-red-600">
                                                {currentUserRecord.totalExceededTasks > 0 ? `${currentUserRecord.totalExceededTasks} việc` : ''}
                                            </td>
                                            <td className="border border-black p-1 text-center text-amber-700">
                                                {currentUserRecord.totalBonusScore > 0 ? `+${currentUserRecord.totalBonusScore}đ` : ''}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Bảng tổng kết KPI cá nhân theo chuẩn Phụ lục 4 */}
                                <div className="mt-4 p-3 bg-gray-50 border border-black text-sm space-y-1">
                                    <div className="font-bold uppercase text-gray-900 border-b border-gray-300 pb-1">
                                        TỔNG HỢP ĐIỂM KPI CÁ NHÂN:
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 pt-1">
                                        <div>- Tổng điểm quy đổi tối đa (Giá trị A): <b>{currentUserRecord.valueA || 0} điểm</b></div>
                                        <div>- Tổng điểm quy đổi thực tế (Giá trị B): <b>{currentUserRecord.valueB || 0} điểm</b></div>
                                        <div>
                                            - ĐIỂM KPI CÁ NHÂN (Thang 70 điểm = [B / A] × 70): 
                                            <b className="text-blue-700 ml-1 text-base">{currentUserRecord.kpiScore70 || 0} / 70 điểm</b>
                                        </div>
                                        <div>
                                            - ĐIỂM QUY ĐỔI THANG 100: 
                                            <b className="text-emerald-700 ml-1 text-base">{currentUserRecord.kpiScore100 || 0} / 100 ({currentUserRecord.kpiScore100 || 0}%)</b>
                                        </div>
                                        <div className="col-span-2 pt-1">
                                            - KẾT QUẢ XẾP LOẠI: 
                                            <span className="font-bold text-base uppercase text-red-700 ml-1">
                                                {currentUserRecord.rank === 'A' ? 'Hạng A - Hoàn thành xuất sắc nhiệm vụ (≥ 90%)' :
                                                 currentUserRecord.rank === 'B' ? 'Hạng B - Hoàn thành tốt nhiệm vụ (75% - 89%)' :
                                                 currentUserRecord.rank === 'C' ? 'Hạng C - Hoàn thành nhiệm vụ (50% - 74%)' :
                                                 'Hạng D - Chưa hoàn thành nhiệm vụ (< 50%)'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Phần Chữ ký & Ngày tháng */}
                        <div className="mt-8 pt-4 flex justify-between items-start text-xs sm:text-sm print:break-inside-avoid">
                            <div className="text-center w-1/3">
                                <div className="font-bold">NGƯỜI LẬP BIỂU</div>
                                <div className="italic text-xs">(Ký, ghi rõ họ tên)</div>
                                <div className="h-20"></div>
                                <div className="font-bold">{currentUserRecord.user?.name || ''}</div>
                            </div>
                            <div className="text-center w-1/3">
                                <div className="font-bold">TRƯỞNG ĐƠN VỊ</div>
                                <div className="italic text-xs">(Ký, ghi rõ họ tên)</div>
                                <div className="h-20"></div>
                            </div>
                            <div className="text-center w-1/3">
                                <div className="italic text-xs">TP. Hồ Chí Minh, ngày ... tháng ... năm 2026</div>
                                <div className="font-bold uppercase mt-1">BAN GIÁM HIỆU PHÊ DUYỆT</div>
                                <div className="italic text-xs">(Ký, đóng dấu)</div>
                                <div className="h-20"></div>
                            </div>
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
