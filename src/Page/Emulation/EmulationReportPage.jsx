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
  Drawer,
  Divider,
  Timeline,
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
  BankOutlined,
  EyeOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  HistoryOutlined,
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
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
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
  const [userRoleInfo, setUserRoleInfo] = useState({});

  const token = Cookies.get("accessToken");
  const decodedToken = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode(token);
    } catch {
      return null;
    }
  }, [token]);

  const currentUserRole = decodedToken?.role;
  const isManagerOrAdmin = currentUserRole === "manager" || currentUserRole === "admin";
  const canViewAll = userRoleInfo.canViewAll ?? isManagerOrAdmin;

  const [searchText, setSearchText] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterTitle, setFilterTitle] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Drawer chi tiết hồ sơ & Nhận diện mobile
  const [selectedReg, setSelectedReg] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleOpenDetail = (record) => {
    setSelectedReg(record.regRecord || record);
    setDrawerVisible(true);
  };

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
        const list =
          res?.AllDepartment ||
          res?.data ||
          res?.departments ||
          (Array.isArray(res) ? res : []);
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
        if (statsRes.userRoleInfo) {
          setUserRoleInfo(statsRes.userRoleInfo);
        }
      }
      if (listRes.success) {
        setRegistrations(listRes.data || []);
        if (listRes.userRoleInfo) {
          setUserRoleInfo((prev) => ({ ...prev, ...listRes.userRoleInfo }));
        }
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

  // Làm phẳng danh sách: hiển thị thông tin mỗi người một dòng thay vì gom chung (chuẩn hóa NFC tiếng Việt)
  const flattenedMemberList = useMemo(() => {
    const list = [];
    (registrations || []).forEach((r) => {
      if (r.members && Array.isArray(r.members) && r.members.length > 0) {
        r.members.forEach((m, mIdx) => {
          list.push({
            key: `${r._id}_${mIdx}`,
            regId: r._id,
            name: (m.name || "").normalize("NFC"),
            positionName: (m.positionName || "Cán bộ").normalize("NFC"),
            departmentName: (
              m.departmentName || r.departmentName || r.department?.departmentName || "Trường"
            ).normalize("NFC"),
            titles: (m.titles && m.titles.length > 0 ? m.titles : r.titles || []).map((t) => {
              if (typeof t === "object") {
                return {
                  ...t,
                  name: (t.name || t.code || "").normalize("NFC"),
                };
              }
              return String(t).normalize("NFC");
            }),
            representativeName: (r.name || r.user?.name || "").normalize("NFC"),
            attachedFiles: r.attachedFiles || [],
            status: r.status,
            notes: (r.notes || "").normalize("NFC"),
            createdAt: r.createdAt,
            schoolYear: r.schoolYear,
          });
        });
      } else {
        list.push({
          key: `${r._id}`,
          regId: r._id,
          name: (r.name || r.user?.name || "Chưa xác định").normalize("NFC"),
          positionName: (r.positionName || r.position?.positionName || "Cán bộ").normalize("NFC"),
          departmentName: (
            r.departmentName || r.department?.departmentName || "Trường"
          ).normalize("NFC"),
          titles: (r.titles || []).map((t) => {
            if (typeof t === "object") {
              return {
                ...t,
                name: (t.name || t.code || "").normalize("NFC"),
              };
            }
            return String(t).normalize("NFC");
          }),
          representativeName: (r.name || r.user?.name || "").normalize("NFC"),
          attachedFiles: r.attachedFiles || [],
          status: r.status,
          notes: (r.notes || "").normalize("NFC"),
          createdAt: r.createdAt,
          schoolYear: r.schoolYear,
        });
      }
    });
    return list;
  }, [registrations]);

  // Danh sách các đơn vị để chọn lọc (kết hợp DB và dữ liệu thực tế)
  const departmentOptions = useMemo(() => {
    const map = new Map();
    (departments || []).forEach((d) => {
      const name = d.departmentName || d.name;
      if (name && !name.toLowerCase().includes("giải thể")) {
        map.set(name, name);
      }
    });
    flattenedMemberList.forEach((m) => {
      if (m.departmentName && !m.departmentName.toLowerCase().includes("giải thể")) {
        if (!map.has(m.departmentName)) {
          map.set(m.departmentName, m.departmentName);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "vi"));
  }, [departments, flattenedMemberList]);

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
      width: isMobile ? 45 : 50,
      align: "center",
      render: (_, __, index) => index + 1,
    },
    {
      title: "Họ và tên cán bộ / Tập thể",
      dataIndex: "name",
      key: "name",
      width: isMobile ? 180 : 220,
      render: (name, record) => (
        <div>
          <div className="font-semibold text-gray-800 flex items-center gap-1.5">
            <UserOutlined className="text-blue-500" />
            <span>{name}</span>
          </div>
          {record.representativeName && record.representativeName !== name && (
            <div className="text-xs text-gray-400 mt-0.5">
              Đại diện: {record.representativeName}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Chức vụ",
      dataIndex: "positionName",
      key: "positionName",
      width: isMobile ? 120 : 150,
      render: (p) => p || "Cán bộ",
    },
    {
      title: "Đơn vị công tác",
      dataIndex: "departmentName",
      key: "departmentName",
      width: isMobile ? 140 : 170,
      render: (d) => d || "--",
    },
    {
      title: "Danh hiệu đề nghị",
      key: "titles",
      minWidth: isMobile ? 170 : 220,
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
      width: isMobile ? 85 : 105,
      align: "center",
      render: (_, r) => (
        <span>{r.attachedFiles?.length || 0} file</span>
      ),
    },
    {
      title: "Ngày gửi",
      dataIndex: "createdAt",
      key: "createdAt",
      width: isMobile ? 95 : 110,
      align: "center",
      render: (dt) => (dt ? dayjs(dt).format("DD/MM/YYYY") : "--"),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: isMobile ? 120 : 135,
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
    {
      title: "Thao tác",
      key: "actions",
      width: isMobile ? 80 : 100,
      align: "center",
      fixed: isMobile ? undefined : "right",
      render: (_, record) => (
        <Button
          type="primary"
          ghost
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleOpenDetail(record)}
          className="text-xs !px-2 !py-0.5 !h-auto flex items-center justify-center mx-auto gap-1"
        >
          {isMobile ? "Xem" : "Chi tiết"}
        </Button>
      ),
    },
  ];

  return (
    <div className="w-full px-2 sm:px-4 py-3 space-y-3">
      {/* CSS In Ấn: Chuẩn hóa font Times New Roman theo Nghị định 30/2020/NĐ-CP */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm 10mm 10mm 10mm;
          }
          * {
            font-family: "Times New Roman", Times, serif !important;
          }
          html, body {
            background: white !important;
            color: black !important;
            font-family: "Times New Roman", Times, serif !important;
            font-size: 11pt;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-times-new-roman,
          .print-times-new-roman * {
            font-family: "Times New Roman", Times, serif !important;
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
              {canViewAll
                ? "Báo cáo tổng hợp số liệu đề nghị danh hiệu theo năm học, khoảng thời gian gửi và đơn vị"
                : `Báo cáo số liệu đề nghị danh hiệu của đơn vị ${userRoleInfo.departmentName || ""}`}
            </Text>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Select
              value={schoolYear}
              onChange={setSchoolYear}
              className="w-full sm:w-[170px]"
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
              className="w-full sm:w-[240px]"
            />

            <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
              <Button icon={<ReloadOutlined />} onClick={fetchReportData} loading={loading} className="flex-1 sm:flex-initial">
                Làm mới
              </Button>
              <Button
                type="primary"
                icon={<FileExcelOutlined />}
                onClick={handleExportExcel}
                style={{ backgroundColor: "#52c41a" }}
                className="flex-1 sm:flex-initial"
              >
                Xuất Excel
              </Button>
              <Button icon={<PrinterOutlined />} onClick={handlePrint} className="flex-1 sm:flex-initial">
                In
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ======================= THỐNG KÊ VÀ BIỂU ĐỒ (ẨN KHI IN) ======================= */}
      <div className="print:hidden">
        {/* STATS CARDS */}
        <Row gutter={[16, 16]} className="mb-4">
          <Col xs={12} sm={6}>
            <Card className="shadow-sm border-l-4 border-l-blue-500">
              <Statistic
                title={canViewAll ? "Tổng số hồ sơ đề nghị" : "Hồ sơ đề nghị của đơn vị"}
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
                {canViewAll ? (
                  <Select
                    value={filterDepartment || undefined}
                    onChange={setFilterDepartment}
                    placeholder="Đơn vị / Phòng ban"
                    allowClear
                    showSearch
                    optionFilterProp="children"
                    className="w-full"
                  >
                    {departmentOptions.map((dName) => (
                      <Select.Option key={dName} value={dName}>
                        {dName}
                      </Select.Option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    prefix={<BankOutlined className="text-gray-400" />}
                    value={userRoleInfo.departmentName || "Đơn vị của tôi"}
                    disabled
                    className="w-full"
                  />
                )}
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
            pagination={{
              pageSize: 20,
              showSizeChanger: !isMobile,
              simple: isMobile,
              showTotal: isMobile ? undefined : (total) => `Tổng cộng: ${total} cá nhân / tập thể`,
            }}
            bordered
            size="small"
            scroll={{ x: isMobile ? 950 : 1150 }}
          />
        </Card>
      </div>

      {/* ======================= MẪU IN BÁO CÁO CHUẨN (CHỈ HIỆN KHI IN) ======================= */}
      <div
        className="hidden print:block text-black leading-normal p-2 print-times-new-roman"
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
      >
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
              <span className="font-bold">{filteredMemberList.length}</span>
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

      {/* DRAWER XEM CHI TIẾT HỒ SƠ ĐỀ NGHỊ THI ĐUA */}
      <Drawer
        title={
          <div className="flex items-center gap-2 text-base font-bold text-blue-700">
            <TrophyOutlined className="text-yellow-500" />
            Chi Tiết Hồ Sơ Đề Nghị Thi Đua
          </div>
        }
        placement="right"
        width={isMobile ? "100%" : 650}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
      >
        {selectedReg && (
          <div className="space-y-4">
            {/* THÔNG TIN CHUNG */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 block text-xs">Cán bộ đại diện lập:</span>
                  <strong className="text-gray-800 text-base">{selectedReg.name || selectedReg.user?.name}</strong>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {selectedReg.positionName || selectedReg.position?.positionName || "Cán bộ"}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs">Đơn vị công tác:</span>
                  <strong className="text-gray-800">
                    {selectedReg.departmentName || selectedReg.department?.departmentName || "Trường CĐ Nam Sài Gòn"}
                  </strong>
                  <div className="text-xs text-blue-600 mt-0.5">
                    Năm học: {selectedReg.schoolYear}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs text-gray-500 mr-2">Trạng thái hồ sơ:</span>
                  {selectedReg.status === "SCHOOL_APPROVED" && <Tag color="success">BGH đã công nhận</Tag>}
                  {selectedReg.status === "SUBMITTED_TO_BGH" && <Tag color="blue">Đã chuyển BGH</Tag>}
                  {selectedReg.status === "REJECTED" && <Tag color="error">Từ chối / Cần sửa</Tag>}
                  {(!selectedReg.status || selectedReg.status === "PENDING") && <Tag color="warning">Chờ QL duyệt</Tag>}
                </div>
                <div className="text-xs text-gray-400">
                  Ngày gửi: {selectedReg.createdAt ? dayjs(selectedReg.createdAt).format("DD/MM/YYYY HH:mm") : "--"}
                </div>
              </div>
            </div>

            {/* DANH SÁCH CÁN BỘ ĐỀ NGHỊ (NẾU CÓ) */}
            {selectedReg.members && selectedReg.members.length > 0 && (
              <div>
                <Text strong className="block mb-2 text-gray-700">
                  Danh sách thành viên đăng ký ({selectedReg.members.length} người):
                </Text>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-gray-700 font-semibold border-b">
                      <tr>
                        <th className="p-2 w-10 text-center">STT</th>
                        <th className="p-2">Họ và tên</th>
                        <th className="p-2">Chức vụ</th>
                        <th className="p-2">Danh hiệu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedReg.members.map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 text-center text-gray-500 font-medium">{idx + 1}</td>
                          <td className="p-2 font-medium text-gray-800">{m.name}</td>
                          <td className="p-2 text-gray-600">{m.positionName || "--"}</td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              {(m.titles || []).map((t) => (
                                <Tag color="gold" key={t._id || t} className="text-[11px]">
                                  {t.name || t.code || t}
                                </Tag>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DANH HIỆU THI ĐUA ĐỀ NGHỊ */}
            <div>
              <Text strong className="block mb-2 text-gray-700">
                Danh hiệu thi đua đề nghị:
              </Text>
              <div className="flex flex-col gap-1.5">
                {(selectedReg.titles || []).map((t) => (
                  <div
                    key={t._id || t}
                    className="p-2 border rounded-lg bg-yellow-50/40 border-yellow-200 flex justify-between items-center text-xs"
                  >
                    <span className="font-semibold text-gray-800">{t.name || t.code || t}</span>
                    <Tag color="gold">{t.level === "CO_SO" ? "Cấp Trường" : "Cấp Tỉnh/Bộ"}</Tag>
                  </div>
                ))}
              </div>
            </div>

            {/* HỒ SƠ MINH CHỨNG */}
            <div>
              <Text strong className="block mb-2 text-gray-700">
                Hồ sơ minh chứng đính kèm ({selectedReg.attachedFiles?.length || 0}):
              </Text>
              <div className="divide-y border rounded-lg overflow-hidden">
                {(!selectedReg.attachedFiles || selectedReg.attachedFiles.length === 0) ? (
                  <div className="p-3 text-center text-gray-400 text-xs">
                    Không có tài liệu minh chứng đính kèm
                  </div>
                ) : (
                  selectedReg.attachedFiles.map((f, idx) => (
                    <div key={idx} className="p-2.5 flex justify-between items-center hover:bg-gray-50 text-xs">
                      <div className="flex items-center gap-2 overflow-hidden mr-2">
                        <FilePdfOutlined className="text-red-500 text-base flex-shrink-0" />
                        <div className="truncate">
                          <div className="text-[11px] text-gray-400 font-medium">
                            {f.documentTypeName || f.documentType?.name || "Minh chứng"}
                          </div>
                          <a
                            href={f.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 font-medium hover:underline truncate block"
                          >
                            {f.fileName}
                          </a>
                        </div>
                      </div>
                      {f.fileUrl && (
                        <Button
                          type="link"
                          icon={<EyeOutlined />}
                          href={f.fileUrl}
                          target="_blank"
                          size="small"
                          className="text-xs"
                        >
                          Xem
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* GHI CHÚ / CAM KẾT */}
            {selectedReg.notes && (
              <div>
                <Text strong className="block mb-1 text-gray-700 text-xs">
                  Ghi chú / Cam kết:
                </Text>
                <div className="p-2.5 bg-gray-50 rounded border text-xs text-gray-700 whitespace-pre-wrap">
                  {selectedReg.notes}
                </div>
              </div>
            )}

            {/* NHẬN XÉT CỦA QUẢN LÝ ĐƠN VỊ & BGH */}
            {(selectedReg.managerReview?.note || selectedReg.bghReview?.note) && (
              <div className="space-y-2">
                <Text strong className="block text-gray-700 text-xs">
                  Ý kiến nhận xét của cấp xét duyệt:
                </Text>
                {selectedReg.managerReview?.note && (
                  <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded text-xs">
                    <span className="font-semibold text-amber-800">
                      Quản lý đơn vị ({selectedReg.managerReview.reviewedByName}):
                    </span>{" "}
                    {selectedReg.managerReview.note}
                    <div className="text-[10px] text-gray-400 mt-1">
                      {dayjs(selectedReg.managerReview.reviewedAt).format("DD/MM/YYYY HH:mm")}
                    </div>
                  </div>
                )}
                {selectedReg.bghReview?.note && (
                  <div className="p-2.5 bg-green-50/60 border border-green-200 rounded text-xs">
                    <span className="font-semibold text-green-800">
                      Ban Giám hiệu ({selectedReg.bghReview.reviewedByName}):
                    </span>{" "}
                    {selectedReg.bghReview.note}
                    <div className="text-[10px] text-gray-400 mt-1">
                      {dayjs(selectedReg.bghReview.reviewedAt).format("DD/MM/YYYY HH:mm")}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LỊCH SỬ TIẾN TRÌNH */}
            {selectedReg.history && selectedReg.history.length > 0 && (
              <div>
                <Text strong className="block mb-2 text-gray-700 text-xs flex items-center gap-1">
                  <HistoryOutlined /> Lịch sử tiến trình:
                </Text>
                <Timeline
                  className="mt-2 text-xs"
                  items={selectedReg.history.map((h) => ({
                    color:
                      h.action?.includes("APPROVED") || h.action?.includes("SUBMIT")
                        ? "green"
                        : h.action?.includes("REJECT")
                        ? "red"
                        : "blue",
                    children: (
                      <div>
                        <div className="font-medium text-gray-800">
                          {h.actorName} ({h.actorRole || "Cán bộ"}): {h.details}
                        </div>
                        <div className="text-gray-400 text-[11px]">
                          {dayjs(h.timestamp).format("DD/MM/YYYY HH:mm:ss")}
                        </div>
                      </div>
                    ),
                  }))}
                />
              </div>
            )}

            <div className="pt-3 border-t text-right">
              <Button onClick={() => setDrawerVisible(false)}>Đóng</Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default EmulationReportPage;
