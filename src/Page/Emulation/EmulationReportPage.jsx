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
  TeamOutlined,
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

const getDefaultSchoolYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 8) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
};

const SCHOOL_YEARS = [
  "2026-2027",
  "2025-2026",
  "2024-2025",
  "2023-2024",
];

const COLORS = ["#1890ff", "#52c41a", "#faad14", "#f5222d", "#722ed1", "#13c2c2", "#eb2f96"];

const EmulationReportPage = () => {
  const [schoolYear, setSchoolYear] = useState(getDefaultSchoolYear());
  const [stats, setStats] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchReportData = useCallback(async () => {
    try {
      setLoading(true);
      const queryYear = schoolYear === "ALL" ? undefined : schoolYear;
      const [statsRes, listRes] = await Promise.all([
        getEmulationStats(queryYear),
        getEmulationRegistrations({ schoolYear: queryYear, limit: 500 }),
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

    const excelData = registrations.map((r, index) => {
      const memberNames =
        r.members && r.members.length > 0
          ? r.members.map((m) => `${m.name} (${m.positionName || "Cán bộ"})`).join("; ")
          : r.name || r.user?.name || "";

      const allTitles = [];
      const seen = new Set();
      (r.members || []).forEach((m) => {
        (m.titles || []).forEach((t) => {
          const name = typeof t === "object" ? t.name || t.code : t;
          if (name && !seen.has(name)) {
            seen.add(name);
            allTitles.push(name);
          }
        });
      });
      if (allTitles.length === 0) {
        (r.titles || []).forEach((t) => {
          const name = typeof t === "object" ? t.name || t.code : t;
          if (name && !seen.has(name)) {
            seen.add(name);
            allTitles.push(name);
          }
        });
      }

      return {
        STT: index + 1,
        "Cán bộ đại diện": r.name || r.user?.name || "",
        "Chức vụ": r.positionName || r.position?.positionName || "",
        "Đơn vị / Phòng ban": r.departmentName || r.department?.departmentName || "",
        "Năm học": r.schoolYear || "",
        "Số lượng CB đề nghị": r.members?.length || 1,
        "Danh sách cán bộ đề nghị": memberNames,
        "Danh hiệu đăng ký": allTitles.join("; "),
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
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ThiDua_KhenThuong");

    // Auto fit column widths
    worksheet["!cols"] = [
      { wch: 6 },  // STT
      { wch: 25 }, // Cán bộ đại diện
      { wch: 20 }, // Chức vụ
      { wch: 30 }, // Đơn vị
      { wch: 15 }, // Năm học
      { wch: 18 }, // Số lượng CB
      { wch: 45 }, // Danh sách cán bộ
      { wch: 40 }, // Danh hiệu
      { wch: 15 }, // File
      { wch: 28 }, // Trạng thái
      { wch: 35 }, // Ghi chú
      { wch: 35 }, // Nhận xét
      { wch: 20 }, // Ngày đăng ký
    ];

    XLSX.writeFile(workbook, `BaoCao_ThiDua_KhenThuong_${schoolYear || "Tat_Ca"}.xlsx`);
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
      title: "Cán bộ / Thành viên đề nghị",
      key: "name",
      width: 240,
      render: (_, r) => {
        if (r.members && r.members.length > 0) {
          return (
            <div>
              <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                <TeamOutlined className="text-blue-500" />
                <span>{r.members.map((m) => m.name).join(", ")}</span>
              </div>
              <div className="text-xs text-blue-600 mt-0.5">
                ({r.members.length} cán bộ - Đại diện: {r.name || r.user?.name})
              </div>
            </div>
          );
        }
        return (
          <div>
            <div className="font-semibold text-gray-800">{r.name || r.user?.name}</div>
            <div className="text-xs text-gray-500">{r.positionName || r.position?.positionName}</div>
          </div>
        );
      },
    },
    {
      title: "Đơn vị công tác",
      dataIndex: "departmentName",
      key: "departmentName",
      width: 170,
      render: (dName, r) => dName || r.department?.departmentName || "--",
    },
    {
      title: "Danh hiệu đề nghị",
      key: "titles",
      minWidth: 240,
      render: (_, r) => {
        const allTitles = [];
        const seenIds = new Set();
        (r.members || []).forEach((m) => {
          (m.titles || []).forEach((t) => {
            const id = typeof t === "object" ? t._id || t.code || t.name : t;
            const name = typeof t === "object" ? t.name || t.code : t;
            if (id && !seenIds.has(String(id))) {
              seenIds.add(String(id));
              allTitles.push(name);
            }
          });
        });
        if (allTitles.length === 0) {
          (r.titles || []).forEach((t) => {
            const name = typeof t === "object" ? t.name || t.code : t;
            allTitles.push(name);
          });
        }

        return (
          <div className="flex flex-wrap gap-1">
            {allTitles.map((tName, idx) => (
              <Tag color="gold" key={idx}>
                {tName}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: "Minh chứng",
      key: "files",
      width: 105,
      align: "center",
      render: (_, r) => (
        <span>{r.attachedFiles?.length || 0} tài liệu</span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 135,
      align: "center",
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
    <div className="w-full px-2 sm:px-4 py-3 space-y-3">
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
          BÁO CÁO TỔNG HỢP DANH SÁCH ĐỀ NGHỊ THI ĐUA - KHEN THƯỞNG
        </h2>
        <p className="text-sm italic">Năm học: {schoolYear === "ALL" ? "Tất cả các năm" : schoolYear}</p>
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
              Báo cáo tổng hợp số liệu đề nghị danh hiệu theo năm học, đơn vị và phân tích biểu đồ
            </Text>
          </div>

          <Space wrap>
            <Select
              value={schoolYear}
              onChange={setSchoolYear}
              style={{ width: 170 }}
            >
              <Select.Option value="ALL">Tất cả các năm học</Select.Option>
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
              title="Tổng số hồ sơ đề nghị"
              value={totalCount}
              prefix={<TrophyOutlined className="text-blue-500" />}
              suffix="hồ sơ"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="shadow-sm border-l-4 border-l-purple-500">
            <Statistic
              title="Tổng số cán bộ đề nghị"
              value={stats?.totalMembers || totalCount}
              prefix={<TeamOutlined className="text-purple-500" />}
              suffix="người"
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
            Bảng Tổng Hợp Chi Tiết Đề Nghị Thi Đua ({schoolYear})
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
          scroll={{ x: 950 }}
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
