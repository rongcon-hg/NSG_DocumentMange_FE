/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  Button,
  Table,
  Tag,
  Typography,
  Space,
  message,
  Spin,
} from "antd";
import {
  TrophyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileExcelOutlined,
  PrinterOutlined,
  ReloadOutlined,
  PieChartOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import * as XLSX from "xlsx";
import dayjs from "dayjs";
import { getEmulationStats, getEmulationRegistrations } from "../../api/emulationApi";

const { Title, Text } = Typography;

const SCHOOL_YEARS = [
  "2026-2027",
  "2025-2026",
  "2024-2025",
  "2023-2024",
];

const COLORS = ["#1890ff", "#52c41a", "#faad14", "#f5222d", "#722ed1", "#13c2c2", "#eb2f96"];

const EmulationReportPage = () => {
  const [schoolYear, setSchoolYear] = useState("2025-2026");
  const [stats, setStats] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchReportData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsRes, listRes] = await Promise.all([
        getEmulationStats(schoolYear),
        getEmulationRegistrations({ schoolYear, limit: 500 }),
      ]);

      if (statsRes.success) {
        setStats(statsRes.data);
      }
      if (listRes.success) {
        setRegistrations(listRes.data || []);
      }
    } catch (err) {
      console.error(err);
      message.error("Lỗi khi tải dữ liệu thống kê báo cáo");
    } finally {
      setLoading(false);
    }
  }, [schoolYear]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Xuất file Excel
  const handleExportExcel = () => {
    if (!registrations || registrations.length === 0) {
      message.warning("Không có dữ liệu để xuất Excel");
      return;
    }

    const excelData = registrations.map((r, index) => ({
      STT: index + 1,
      "Họ và tên": r.name || r.user?.name || "",
      "Chức vụ": r.positionName || r.position?.positionName || "",
      "Đơn vị / Phòng ban": r.departmentName || r.department?.departmentName || "",
      "Năm học": r.schoolYear || "",
      "Danh hiệu đăng ký": (r.titles || []).map((t) => t.name || t.code).join("; "),
      "Số file minh chứng": r.attachedFiles?.length || 0,
      "Trạng thái xét duyệt":
        r.status === "SCHOOL_APPROVED"
          ? "Ban Giám hiệu đã công nhận"
          : r.status === "SUBMITTED_TO_BGH"
          ? "Quản lý đã chuyển BGH"
          : r.status === "REJECTED"
          ? "Từ chối / Cần chỉnh sửa"
          : "Chờ Quản lý duyệt",
      "Ghi chú / Cam kết": r.notes || "",
      "Nhận xét cấp duyệt": r.bghReview?.note || r.managerReview?.note || "",
      "Ngày đăng ký": r.createdAt ? dayjs(r.createdAt).format("DD/MM/YYYY HH:mm") : "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ThiDua_KhenThuong");

    // Auto fit column widths
    const max_width = excelData.reduce((w, r) => Math.max(w, 20), 10);
    worksheet["!cols"] = [
      { wch: 6 },  // STT
      { wch: 25 }, // Họ tên
      { wch: 20 }, // Chức vụ
      { wch: 30 }, // Đơn vị
      { wch: 15 }, // Năm học
      { wch: 40 }, // Danh hiệu
      { wch: 15 }, // File
      { wch: 28 }, // Trạng thái
      { wch: 35 }, // Ghi chú
      { wch: 35 }, // Nhận xét
      { wch: 20 }, // Ngày đăng ký
    ];

    XLSX.writeFile(workbook, `BaoCao_ThiDua_KhenThuong_${schoolYear}.xlsx`);
    message.success("Xuất file Excel thành công!");
  };

  const handlePrint = () => {
    window.print();
  };

  const statusCounts = stats?.byStatus || {};
  const pendingCount = (statusCounts.PENDING || 0) + (statusCounts.SUBMITTED_TO_BGH || 0);
  const approvedCount = statusCounts.SCHOOL_APPROVED || 0;
  const rejectedCount = statusCounts.REJECTED || 0;
  const totalCount = stats?.total || 0;

  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 50,
      align: "center",
      render: (_, __, index) => index + 1,
    },
    {
      title: "Họ và tên",
      key: "name",
      width: 180,
      render: (_, r) => (
        <div>
          <div className="font-semibold text-gray-800">{r.name || r.user?.name}</div>
          <div className="text-xs text-gray-500">{r.positionName || r.position?.positionName}</div>
        </div>
      ),
    },
    {
      title: "Đơn vị công tác",
      dataIndex: "departmentName",
      key: "departmentName",
      width: 180,
      render: (dName, r) => dName || r.department?.departmentName || "--",
    },
    {
      title: "Danh hiệu đăng ký",
      key: "titles",
      render: (_, r) => (
        <div className="flex flex-wrap gap-1">
          {(r.titles || []).map((t) => (
            <Tag color="gold" key={t._id || t}>
              {t.name || t.code || t}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: "Minh chứng",
      key: "files",
      width: 110,
      align: "center",
      render: (_, r) => (
        <span>{r.attachedFiles?.length || 0} tài liệu</span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 150,
      render: (s) => {
        switch (s) {
          case "SCHOOL_APPROVED":
            return <Tag color="success">BGH công nhận</Tag>;
          case "SUBMITTED_TO_BGH":
            return <Tag color="blue">Đã chuyển BGH</Tag>;
          case "REJECTED":
            return <Tag color="error">Từ chối / Cần sửa</Tag>;
          default:
            return <Tag color="warning">Chờ QL duyệt</Tag>;
        }
      },
    },
  ];

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* HEADER CHO BẢN IN */}
      <div className="hidden print:block mb-6 text-center">
        <div className="flex justify-between items-start text-xs uppercase font-semibold mb-4">
          <div>
            <p>ỦY BAN NHÂN DÂN THÀNH PHỐ HỒ CHÍ MINH</p>
            <p className="font-bold">TRƯỜNG CAO ĐẲNG NAM SÀI GÒN</p>
          </div>
          <div className="text-right">
            <p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p>Độc lập - Tự do - Hạnh phúc</p>
          </div>
        </div>
        <h2 className="text-lg font-bold uppercase mt-4">
          BÁO CÁO TỔNG HỢP DANH SÁCH ĐĂNG KÝ THI ĐUA - KHEN THƯỞNG
        </h2>
        <p className="text-sm italic">Năm học: {schoolYear}</p>
      </div>

      {/* HEADER GIAO DIỆN WEB */}
      <Card className="shadow-sm border-gray-200 mb-4 print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Title level={4} className="!mb-1 flex items-center gap-2 text-blue-700">
              <TrophyOutlined className="text-yellow-500 text-xl" />
              Thống Kê - Báo Cáo Thi Đua Khen Thưởng
            </Title>
            <Text type="secondary">
              Báo cáo tổng hợp số liệu đăng ký danh hiệu theo năm học, đơn vị và phân tích biểu đồ
            </Text>
          </div>

          <Space wrap>
            <Select
              value={schoolYear}
              onChange={setSchoolYear}
              style={{ width: 150 }}
            >
              {SCHOOL_YEARS.map((y) => (
                <Select.Option key={y} value={y}>
                  Năm học {y}
                </Select.Option>
              ))}
            </Select>

            <Button icon={<ReloadOutlined />} onClick={fetchReportData} loading={loading}>
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<FileExcelOutlined />}
              onClick={handleExportExcel}
              style={{ backgroundColor: "#52c41a" }}
            >
              Xuất Excel
            </Button>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              In báo cáo
            </Button>
          </Space>
        </div>
      </Card>

      {/* STATS CARDS */}
      <Row gutter={[16, 16]} className="mb-4 print:mb-2">
        <Col xs={12} sm={6}>
          <Card className="shadow-sm border-l-4 border-l-blue-500">
            <Statistic
              title="Tổng số đăng ký"
              value={totalCount}
              prefix={<TrophyOutlined className="text-blue-500" />}
              suffix="hồ sơ"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="shadow-sm border-l-4 border-l-yellow-500">
            <Statistic
              title="Đang chờ xét duyệt"
              value={pendingCount}
              prefix={<ClockCircleOutlined className="text-yellow-500" />}
              suffix="hồ sơ"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="shadow-sm border-l-4 border-l-green-500">
            <Statistic
              title="BGH đã công nhận"
              value={approvedCount}
              prefix={<CheckCircleOutlined className="text-green-500" />}
              suffix="đạt"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="shadow-sm border-l-4 border-l-red-500">
            <Statistic
              title="Từ chối / Chưa đạt"
              value={rejectedCount}
              prefix={<CloseCircleOutlined className="text-red-500" />}
              suffix="hồ sơ"
            />
          </Card>
        </Col>
      </Row>

      {/* BIỂU ĐỒ TRỰC QUAN (ẨN KHI IN NẾU CẦN HOẶC GIỮ NGUYÊN) */}
      <Row gutter={[16, 16]} className="mb-4 print:hidden">
        <Col xs={24} lg={14}>
          <Card
            title={
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <BarChartOutlined className="text-blue-600" /> Phân bố theo Danh hiệu Thi đua
              </span>
            }
            className="shadow-sm"
          >
            {stats?.byTitle?.length > 0 ? (
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byTitle} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      angle={-20}
                      textAnchor="end"
                      interval={0}
                      height={50}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip />
                    <Bar dataKey="count" name="Số lượng đăng ký" fill="#1890ff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">
                Chưa có dữ liệu danh hiệu thi đua
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <PieChartOutlined className="text-green-600" /> Tỷ lệ Đăng ký theo Khoa / Phòng ban
              </span>
            }
            className="shadow-sm"
          >
            {stats?.byDepartment?.length > 0 ? (
              <div style={{ width: "100%", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.byDepartment}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="name"
                    >
                      {stats.byDepartment.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">
                Chưa có dữ liệu phòng ban
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* BẢNG TỔNG HỢP DANH SÁCH CHI TIẾT */}
      <Card
        title={
          <span className="font-semibold text-gray-800">
            Bảng Tổng Hợp Chi Tiết Đăng Ký Thi Đua ({schoolYear})
          </span>
        }
        className="shadow-sm"
      >
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={registrations}
          loading={loading}
          pagination={false}
          bordered
          size="small"
        />

        {/* CHỮ KÝ DƯỚI BẢNG IN */}
        <div className="hidden print:grid grid-cols-2 mt-12 text-center text-sm">
          <div>
            <p className="font-bold">NGƯỜI LẬP BIỂU</p>
            <p className="italic text-xs">(Ký và ghi rõ họ tên)</p>
          </div>
          <div>
            <p className="italic text-xs mb-1">
              TP. Hồ Chí Minh, ngày {dayjs().format("DD")} tháng {dayjs().format("MM")} năm{" "}
              {dayjs().format("YYYY")}
            </p>
            <p className="font-bold">HIỆU TRƯỞNG</p>
            <p className="italic text-xs">(Ký, đóng dấu và ghi rõ họ tên)</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default EmulationReportPage;
