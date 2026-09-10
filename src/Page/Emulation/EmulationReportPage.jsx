/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  DatePicker,
  Input,
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
  UserOutlined,
  SearchOutlined,
  FilterOutlined,
  UndoOutlined,
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
import {
  getEmulationStats,
  getEmulationRegistrations,
  getEmulationTitles,
} from "../../api/emulationApi";
import { getAllDepartments } from "../../api/DepartmentAPI";

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
  const [dateRange, setDateRange] = useState(null); // [dayjs, dayjs]
  const [stats, setStats] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [allTitlesList, setAllTitlesList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  // Bộ lọc thông minh cho bảng chi tiết
  const [searchText, setSearchText] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterTitle, setFilterTitle] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Tải danh mục danh hiệu thi đua phục vụ lập bảng ma trận bản in
  useEffect(() => {
    const loadTitles = async () => {
      try {
        const res = await getEmulationTitles({ activeOnly: "true" });
        if (res.success) {
          setAllTitlesList(res.data || []);
        }
      } catch (err) {
        console.error("Lỗi nạp danh mục danh hiệu:", err);
      }
    };
    loadTitles();
  }, []);

  // Tải danh mục phòng ban (loại trừ đơn vị giải thể)
  useEffect(() => {
    const loadDepts = async () => {
      try {
        const res = await getAllDepartments();
        const list = res.data || res.departments || [];
        const activeDepts = list.filter(
          (d) => !d.departmentName?.toLowerCase().includes("giải thể")
        );
        setDepartments(activeDepts);
      } catch (err) {
        console.error("Lỗi nạp danh mục đơn vị:", err);
      }
    };
    loadDepts();
  }, []);

  const handleResetFilters = () => {
    setSearchText("");
    setFilterDepartment("");
    setFilterTitle("");
    setFilterStatus("");
  };

  const fetchReportData = useCallback(async () => {
    try {
      setLoading(true);
      const queryYear = schoolYear === "ALL" ? undefined : schoolYear;
      const startDate =
        dateRange && dateRange[0] ? dateRange[0].startOf("day").toISOString() : undefined;
      const endDate =
        dateRange && dateRange[1] ? dateRange[1].endOf("day").toISOString() : undefined;

      const [statsRes, listRes] = await Promise.all([
        getEmulationStats({ schoolYear: queryYear, startDate, endDate }),
        getEmulationRegistrations({
          schoolYear: queryYear,
          startDate,
          endDate,
          limit: 1000,
        }),
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
  }, [schoolYear, dateRange]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Làm phẳng danh sách: hiển thị thông tin mỗi người một dòng thay vì gom chung
  const flattenedMemberList = useMemo(() => {
    const list = [];
    (registrations || []).forEach((r) => {
      if (r.members && Array.isArray(r.members) && r.members.length > 0) {
        r.members.forEach((m, mIdx) => {
          list.push({
            key: `${r._id}_${mIdx}`,
            regId: r._id,
            name: m.name,
            positionName: m.positionName || "Cán bộ",
            departmentName:
              m.departmentName || r.departmentName || r.department?.departmentName || "Trường",
            titles: m.titles && m.titles.length > 0 ? m.titles : r.titles || [],
            representativeName: r.name || r.user?.name || "",
            attachedFiles: r.attachedFiles || [],
            status: r.status,
            notes: r.notes || "",
            createdAt: r.createdAt,
            schoolYear: r.schoolYear,
          });
        });
      } else {
        list.push({
          key: `${r._id}`,
          regId: r._id,
          name: r.name || r.user?.name || "Chưa xác định",
          positionName: r.positionName || r.position?.positionName || "Cán bộ",
          departmentName: r.departmentName || r.department?.departmentName || "Trường",
          titles: r.titles || [],
          representativeName: r.name || r.user?.name || "",
          attachedFiles: r.attachedFiles || [],
          status: r.status,
          notes: r.notes || "",
          createdAt: r.createdAt,
          schoolYear: r.schoolYear,
        });
      }
    });
    return list;
  }, [registrations]);

  // Lọc thông minh theo từ khóa, đơn vị, danh hiệu, trạng thái
  const filteredMemberList = useMemo(() => {
    return flattenedMemberList.filter((m) => {
      if (searchText && searchText.trim()) {
        const q = searchText.trim().toLowerCase();
        const matchName = m.name?.toLowerCase().includes(q);
        const matchRep = m.representativeName?.toLowerCase().includes(q);
        const matchPos = m.positionName?.toLowerCase().includes(q);
        const matchDept = m.departmentName?.toLowerCase().includes(q);
        const matchNotes = m.notes?.toLowerCase().includes(q);
        const matchTitles = (m.titles || []).some((t) => {
          const tName = typeof t === "object" ? t.name || t.code : t;
          return tName?.toLowerCase().includes(q);
        });

        if (!matchName && !matchRep && !matchPos && !matchDept && !matchNotes && !matchTitles) {
          return false;
        }
      }

      if (filterDepartment) {
        const dName = (m.departmentName || "").toLowerCase();
        const fDept = filterDepartment.toLowerCase();
        if (!dName.includes(fDept)) {
          return false;
        }
      }

      if (filterTitle) {
        const has = (m.titles || []).some((t) => {
          if (typeof t === "object") {
            return (
              String(t._id) === filterTitle ||
              t.code === filterTitle ||
              t.name?.toLowerCase().trim() === filterTitle.toLowerCase().trim()
            );
          }
          return (
            String(t) === filterTitle ||
            t.toLowerCase().trim() === filterTitle.toLowerCase().trim()
          );
        });
        if (!has) return false;
      }

      if (filterStatus) {
        if (m.status !== filterStatus) {
          return false;
        }
      }

      return true;
    });
  }, [flattenedMemberList, searchText, filterDepartment, filterTitle, filterStatus]);

  // Xác định các cột danh hiệu hiển thị trên bảng in
  const displayTitleColumns = useMemo(() => {
    const list = [];
    const seen = new Set();
    filteredMemberList.forEach((m) => {
      (m.titles || []).forEach((t) => {
        const name = typeof t === "object" ? t.name || t.code : t;
        const id = typeof t === "object" ? t._id || t.code || t.name : t;
        const code = typeof t === "object" ? t.code : "";
        if (name && !seen.has(name)) {
          seen.add(name);
          list.push({ id, name, code });
        }
      });
    });

    if (allTitlesList && allTitlesList.length > 0) {
      list.sort((a, b) => {
        const idxA = allTitlesList.findIndex(
          (t) =>
            t.name === a.name ||
            (a.code && t.code === a.code) ||
            String(t._id) === String(a.id)
        );
        const idxB = allTitlesList.findIndex(
          (t) =>
            t.name === b.name ||
            (b.code && t.code === b.code) ||
            String(t._id) === String(b.id)
        );
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.name.localeCompare(b.name);
      });
    }

    if (list.length === 0 && allTitlesList.length > 0) {
      allTitlesList.slice(0, 5).forEach((t) => {
        list.push({ id: t._id || t.name, name: t.name, code: t.code });
      });
    }

    return list;
  }, [allTitlesList, filteredMemberList]);

  // Kiểm tra 1 cán bộ có đăng ký danh hiệu cụ thể hay không
  const memberHasTitle = (member, colTitle) => {
    if (!member.titles || member.titles.length === 0) return false;
    return member.titles.some((t) => {
      if (typeof t === "object") {
        if (colTitle.id && t._id && String(t._id) === String(colTitle.id)) return true;
        if (colTitle.code && t.code && t.code === colTitle.code) return true;
        if (t.name && t.name.trim().toLowerCase() === colTitle.name.trim().toLowerCase()) return true;
      } else if (typeof t === "string") {
        if (colTitle.id && t === String(colTitle.id)) return true;
        if (colTitle.code && t === colTitle.code) return true;
        if (t.trim().toLowerCase() === colTitle.name.trim().toLowerCase()) return true;
      }
      return false;
    });
  };

  // Đếm số lượng cán bộ đăng ký theo từng danh hiệu
  const countMembersForTitle = (colTitle) => {
    return filteredMemberList.filter((m) => memberHasTitle(m, colTitle)).length;
  };

  // Xuất file Excel (mỗi người 1 dòng, mỗi danh hiệu 1 cột)
  const handleExportExcel = () => {
    if (!filteredMemberList || filteredMemberList.length === 0) {
      message.warning("Không có dữ liệu để xuất Excel");
      return;
    }

    const excelData = filteredMemberList.map((m, index) => {
      const row = {
        STT: index + 1,
        "Họ và tên cán bộ / Tập thể": m.name,
        "Chức vụ": m.positionName,
        "Đơn vị công tác": m.departmentName,
      };

      // Mỗi danh hiệu một cột
      displayTitleColumns.forEach((col) => {
        const has = memberHasTitle(m, col);
        row[col.name] = has ? "X" : "";
      });

      row["Người đại diện nộp hồ sơ"] = m.representativeName || m.name;
      row["Năm học"] = m.schoolYear || "";
      row["Số file minh chứng"] = m.attachedFiles?.length || 0;
      row["Trạng thái xét duyệt"] =
        m.status === "SCHOOL_APPROVED"
          ? "Ban Giám hiệu đã công nhận"
          : m.status === "SUBMITTED_TO_BGH"
          ? "Quản lý đã chuyển BGH"
          : m.status === "REJECTED"
          ? "Từ chối / Cần chỉnh sửa"
          : "Chờ Quản lý duyệt";
      row["Ghi chú"] = m.notes || "";
      row["Ngày gửi"] = m.createdAt ? dayjs(m.createdAt).format("DD/MM/YYYY HH:mm") : "";

      return row;
    });

    // Dòng TỔNG CỘNG ở cuối bảng Excel
    const totalRow = {
      STT: "",
      "Họ và tên cán bộ / Tập thể": `TỔNG CỘNG (${flattenedMemberList.length} người / tập thể)`,
      "Chức vụ": "",
      "Đơn vị công tác": "",
    };
    displayTitleColumns.forEach((col) => {
      totalRow[col.name] = countMembersForTitle(col);
    });
    totalRow["Người đại diện nộp hồ sơ"] = "";
    totalRow["Năm học"] = "";
    totalRow["Số file minh chứng"] = "";
    totalRow["Trạng thái xét duyệt"] = "";
    totalRow["Ghi chú"] = "";
    totalRow["Ngày gửi"] = "";

    excelData.push(totalRow);

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ThiDua_KhenThuong");

    // Tự căn chỉnh độ rộng cột
    const colWidths = [
      { wch: 6 },  // STT
      { wch: 25 }, // Họ và tên
      { wch: 20 }, // Chức vụ
      { wch: 30 }, // Đơn vị
    ];
    displayTitleColumns.forEach(() => {
      colWidths.push({ wch: 22 }); // Mỗi danh hiệu 1 cột
    });
    colWidths.push(
      { wch: 25 }, // Người đại diện
      { wch: 15 }, // Năm học
      { wch: 16 }, // Số file
      { wch: 28 }, // Trạng thái
      { wch: 30 }, // Ghi chú
      { wch: 20 }  // Ngày gửi
    );

    worksheet["!cols"] = colWidths;

    XLSX.writeFile(workbook, `BaoCao_ThiDua_KhenThuong_${schoolYear || "Tat_Ca"}.xlsx`);
    message.success("Xuất file Excel thành công!");
  };

  const handlePrint = () => {
    window.print();
  };

  const statusCounts = stats?.byStatus || {};
  const pendingCount = (statusCounts.PENDING || 0) + (statusCounts.SUBMITTED_TO_BGH || 0);
  const approvedCount = statusCounts.SCHOOL_APPROVED || 0;
  const totalCount = stats?.total || 0;

  // Cột bảng trên giao diện Web (mỗi dòng 1 người)
  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 50,
      align: "center",
      render: (_, __, index) => index + 1,
    },
    {
      title: "Họ và tên cán bộ / Tập thể",
      dataIndex: "name",
      key: "name",
      width: 220,
      render: (name, record) => (
        <div>
          <div className="font-semibold text-gray-800 flex items-center gap-1.5">
            <UserOutlined className="text-blue-500" />
            <span>{name}</span>
          </div>
          {record.representativeName && record.representativeName !== name && (
            <div className="text-xs text-gray-400 mt-0.5">
              Đại diện nộp: {record.representativeName}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Chức vụ",
      dataIndex: "positionName",
      key: "positionName",
      width: 150,
      render: (p) => p || "Cán bộ",
    },
    {
      title: "Đơn vị công tác",
      dataIndex: "departmentName",
      key: "departmentName",
      width: 170,
      render: (d) => d || "--",
    },
    {
      title: "Danh hiệu đề nghị",
      key: "titles",
      minWidth: 220,
      render: (_, r) => {
        const titleNames = (r.titles || []).map((t) =>
          typeof t === "object" ? t.name || t.code : t
        );
        return (
          <div className="flex flex-wrap gap-1">
            {titleNames.map((tName, idx) => (
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
      title: "Ngày gửi",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 110,
      align: "center",
      render: (dt) => (dt ? dayjs(dt).format("DD/MM/YYYY") : "--"),
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
      {/* CSS In Ấn */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm 10mm 10mm 10mm;
          }
          body {
            background: white !important;
            color: black !important;
            font-size: 11pt;
          }
        }
      `}</style>

      {/* ======================= HEADER GIAO DIỆN WEB ======================= */}
      <Card className="shadow-sm border-gray-200 mb-4 print:hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Title level={4} className="!mb-1 flex items-center gap-2 text-blue-700">
              <TrophyOutlined className="text-yellow-500 text-xl" />
              Thống Kê - Báo Cáo Thi Đua Khen Thưởng
            </Title>
            <Text type="secondary">
              Báo cáo tổng hợp số liệu đề nghị danh hiệu theo năm học, khoảng thời gian gửi và đơn vị
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

            {/* Bộ lọc khoảng thời gian gửi */}
            <DatePicker.RangePicker
              value={dateRange}
              onChange={(dates) => setDateRange(dates)}
              format="DD/MM/YYYY"
              placeholder={["Từ ngày gửi", "Đến ngày gửi"]}
              allowClear
              style={{ width: 240 }}
            />

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

      {/* ======================= THỐNG KÊ VÀ BIỂU ĐỒ (ẨN KHI IN) ======================= */}
      <div className="print:hidden">
        {/* STATS CARDS */}
        <Row gutter={[16, 16]} className="mb-4">
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
                value={flattenedMemberList.length || stats?.totalMembers || totalCount}
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

        {/* BIỂU ĐỒ TRỰC QUAN */}
        <Row gutter={[16, 16]} className="mb-4">
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

        {/* BẢNG TỔNG HỢP DANH SÁCH CHI TIẾT TRÊN GIAO DIỆN WEB */}
        <Card
          title={
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-semibold text-gray-800">
                Bảng Tổng Hợp Chi Tiết Đề Nghị Thi Đua ({schoolYear === "ALL" ? "Tất cả các năm" : schoolYear})
              </span>
              <span className="text-xs font-normal text-gray-500">
                Hiển thị: <strong className="text-blue-600">{filteredMemberList.length}</strong> / {flattenedMemberList.length} cán bộ / tập thể
              </span>
            </div>
          }
          className="shadow-sm"
        >
          {/* CÔNG CỤ TÌM KIẾM THÔNG MINH VÀ CÁC BỘ LỌC */}
          <div className="mb-4 p-3 bg-slate-50/80 rounded-lg border border-slate-200 space-y-2.5">
            <Row gutter={[12, 12]} align="middle">
              {/* Tìm kiếm thông minh */}
              <Col xs={24} md={8} lg={8}>
                <Input
                  prefix={<SearchOutlined className="text-gray-400" />}
                  placeholder="Tìm kiếm theo họ tên, chức vụ, đơn vị, danh hiệu..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                />
              </Col>

              {/* Lọc Đơn vị / Phòng ban */}
              <Col xs={24} sm={12} md={5} lg={5}>
                <Select
                  value={filterDepartment || undefined}
                  onChange={setFilterDepartment}
                  placeholder="Đơn vị / Phòng ban"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  className="w-full"
                >
                  {departments.map((d) => (
                    <Select.Option key={d._id} value={d.departmentName}>
                      {d.departmentName}
                    </Select.Option>
                  ))}
                </Select>
              </Col>

              {/* Lọc Danh hiệu thi đua */}
              <Col xs={24} sm={12} md={5} lg={5}>
                <Select
                  value={filterTitle || undefined}
                  onChange={setFilterTitle}
                  placeholder="Danh hiệu thi đua"
                  allowClear
                  showSearch
                  optionFilterProp="children"
                  className="w-full"
                >
                  {allTitlesList.map((t) => (
                    <Select.Option key={t._id || t.name} value={t.name}>
                      {t.name}
                    </Select.Option>
                  ))}
                </Select>
              </Col>

              {/* Lọc Trạng thái xét duyệt */}
              <Col xs={24} sm={12} md={4} lg={4}>
                <Select
                  value={filterStatus || undefined}
                  onChange={setFilterStatus}
                  placeholder="Trạng thái duyệt"
                  allowClear
                  className="w-full"
                >
                  <Select.Option value="PENDING">Chờ QL duyệt</Select.Option>
                  <Select.Option value="SUBMITTED_TO_BGH">Đã chuyển BGH</Select.Option>
                  <Select.Option value="SCHOOL_APPROVED">BGH công nhận</Select.Option>
                  <Select.Option value="REJECTED">Từ chối / Cần sửa</Select.Option>
                </Select>
              </Col>

              {/* Nút đặt lại */}
              <Col xs={24} sm={12} md={2} lg={2} className="text-right">
                <Button
                  icon={<UndoOutlined />}
                  onClick={handleResetFilters}
                  disabled={!searchText && !filterDepartment && !filterTitle && !filterStatus}
                  className="w-full sm:w-auto"
                >
                  Đặt lại
                </Button>
              </Col>
            </Row>
          </div>

          <Table
            rowKey="key"
            columns={columns}
            dataSource={filteredMemberList}
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            bordered
            size="small"
            scroll={{ x: 950 }}
          />
        </Card>
      </div>

      {/* ======================= MẪU IN BÁO CÁO CHUẨN (CHỈ HIỆN KHI IN) ======================= */}
      <div className="hidden print:block font-serif text-black leading-normal p-2">
        {/* Header hai bên chuẩn hành chính */}
        <div className="grid grid-cols-2 items-start mb-6">
          {/* Bên trái: Đơn vị chủ quản & tên trường */}
          <div className="text-center">
            <p className="font-semibold text-xs uppercase tracking-tight">
              ỦY BAN NHÂN DÂN THÀNH PHỐ HỒ CHÍ MINH
            </p>
            <p className="font-bold text-sm uppercase mt-0.5">
              TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN
            </p>
            {/* Gạch chân 1/3 chiều rộng tên trường */}
            <div className="w-28 border-b-2 border-black mx-auto mt-1"></div>
          </div>

          {/* Bên phải: Quốc hiệu & Tiêu ngữ */}
          <div className="text-center">
            <p className="font-bold text-sm uppercase">
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </p>
            <p className="font-bold text-xs mt-0.5">
              Độc lập - Tự do - Hạnh phúc
            </p>
            {/* Gạch chân dưới Độc lập - Tự do - Hạnh phúc */}
            <div className="w-36 border-b border-black mx-auto mt-1"></div>
          </div>
        </div>

        {/* Tiêu đề báo cáo */}
        <div className="text-center mb-6">
          <h2 className="text-base font-bold uppercase tracking-wide">
            BẢNG TỔNG HỢP DANH SÁCH ĐỀ NGHỊ KHEN THƯỞNG
          </h2>
          <p className="text-xs italic mt-1">
            Năm học: {schoolYear === "ALL" ? "Tất cả các năm" : schoolYear}
            {dateRange && dateRange[0] && dateRange[1]
              ? ` (Từ ngày ${dateRange[0].format("DD/MM/YYYY")} đến ngày ${dateRange[1].format("DD/MM/YYYY")})`
              : ""}
          </p>
        </div>

        {/* Bảng danh sách in: STT, Họ tên, Chức vụ, Đơn vị, Thành tích (mỗi thành tích 1 cột), Ghi chú */}
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100 text-center font-bold">
              <th className="border border-black p-1.5 w-8">STT</th>
              <th className="border border-black p-1.5 w-44">Họ tên</th>
              <th className="border border-black p-1.5 w-24">Chức vụ</th>
              <th className="border border-black p-1.5 w-36">Đơn vị</th>
              {displayTitleColumns.map((col) => (
                <th key={col.id || col.name} className="border border-black p-1.5 text-center min-w-[70px]">
                  {col.name}
                </th>
              ))}
              <th className="border border-black p-1.5 w-24">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {filteredMemberList.length > 0 ? (
              filteredMemberList.map((item, idx) => (
                <tr key={item.key || idx}>
                  <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                  <td className="border border-black p-1.5 font-medium">{item.name}</td>
                  <td className="border border-black p-1.5">{item.positionName}</td>
                  <td className="border border-black p-1.5">{item.departmentName}</td>
                  {displayTitleColumns.map((col) => {
                    const has = memberHasTitle(item, col);
                    return (
                      <td
                        key={col.id || col.name}
                        className="border border-black p-1.5 text-center font-bold text-sm"
                      >
                        {has ? "X" : ""}
                      </td>
                    );
                  })}
                  <td className="border border-black p-1.5 text-xs italic">{item.notes || ""}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5 + displayTitleColumns.length}
                  className="border border-black p-4 text-center italic text-gray-500"
                >
                  Không có dữ liệu đề nghị khen thưởng phù hợp bộ lọc
                </td>
              </tr>
            )}

            {/* Dòng tổng cộng */}
            {filteredMemberList.length > 0 && (
              <tr className="font-bold bg-gray-50">
                <td colSpan={4} className="border border-black p-1.5 text-center uppercase">
                  Tổng cộng ({filteredMemberList.length} lượt cá nhân / tập thể)
                </td>
                {displayTitleColumns.map((col) => (
                  <td key={col.id || col.name} className="border border-black p-1.5 text-center">
                    {countMembersForTitle(col)}
                  </td>
                ))}
                <td className="border border-black p-1.5"></td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Thống kê tổng số và từng loại danh hiệu đăng ký */}
        <div className="mt-4 text-xs">
          <p className="font-bold uppercase mb-1 underline">Thống kê số lượng đăng ký:</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 pl-2">
            <p>
              • Tổng số cá nhân / tập thể đăng ký:{" "}
              <span className="font-bold">{flattenedMemberList.length}</span>
            </p>
            {displayTitleColumns.map((col) => (
              <p key={col.id || col.name}>
                • {col.name}:{" "}
                <span className="font-bold">{countMembersForTitle(col)}</span>
              </p>
            ))}
          </div>
        </div>

        {/* Chữ ký hai bên */}
        <div className="grid grid-cols-2 mt-10 text-center text-xs">
          <div>
            <p className="font-bold uppercase">NGƯỜI LẬP BIỂU</p>
            <p className="italic mt-0.5">(Ký và ghi rõ họ tên)</p>
            <div className="h-20"></div>
          </div>
          <div>
            <p className="italic mb-0.5">
              TP. Hồ Chí Minh, ngày {dayjs().format("DD")} tháng {dayjs().format("MM")} năm{" "}
              {dayjs().format("YYYY")}
            </p>
            <p className="font-bold uppercase">HIỆU TRƯỞNG</p>
            <p className="italic mt-0.5">(Ký, đóng dấu và ghi rõ họ tên)</p>
            <div className="h-20"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmulationReportPage;
