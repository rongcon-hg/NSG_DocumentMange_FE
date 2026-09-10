/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  Card,
  Modal,
  Drawer,
  Form,
  message,
  Popconfirm,
  Typography,
  Tooltip,
  Badge,
  Timeline,
  Divider,
  AutoComplete,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SendOutlined,
  FilePdfOutlined,
  TrophyOutlined,
  BankOutlined,
  UserOutlined,
  HistoryOutlined,
  CalendarOutlined,
  FileExcelOutlined,
  DownloadOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import dayjs from "dayjs";
import {
  getEmulationRegistrations,
  deleteEmulationRegistration,
  deleteBatchEmulationRegistrations,
  reviewEmulationRegistration,
  getEmulationTitles,
} from "../../api/emulationApi";
import { getAllDepartments } from "../../api/DepartmentAPI";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SCHOOL_YEARS = [
  "2026-2027",
  "2025-2026",
  "2024-2025",
  "2023-2024",
];

const EmulationListPage = () => {
  const navigate = useNavigate();

  // Phân quyền người dùng từ Token & Backend
  const token = Cookies.get("accessToken");
  const decodedToken = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode(token);
    } catch (e) {
      return null;
    }
  }, [token]);

  const currentUserId = decodedToken?.userId || decodedToken?._id || decodedToken?.id || Cookies.get("userId");
  const currentUserRole = decodedToken?.role;

  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Filters
  const [schoolYear, setSchoolYear] = useState("2026-2027");
  const [department, setDepartment] = useState("");
  const [titleId, setTitleId] = useState("");
  const [status, setStatus] = useState("");
  const [searchText, setSearchText] = useState("");

  // Master data
  const [departments, setDepartments] = useState([]);
  const [titles, setTitles] = useState([]);
  const [userRoleInfo, setUserRoleInfo] = useState({});

  // Drawer chi tiết & Modal xét duyệt
  const [selectedReg, setSelectedReg] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewAction, setReviewAction] = useState(""); // MANAGER_SUBMIT_BGH, MANAGER_REJECT, BGH_APPROVE, BGH_REJECT
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // Modal xem danh sách thành viên đăng ký (mỗi danh hiệu 1 cột)
  const [memberListModalVisible, setMemberListModalVisible] = useState(false);
  const [selectedRegForMemberList, setSelectedRegForMemberList] = useState(null);

  // Nhận diện màn hình di động để tối ưu độ rộng cột Thao tác
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleOpenMemberListModal = (record) => {
    setSelectedRegForMemberList(record);
    setMemberListModalVisible(true);
  };

  // Dữ liệu ma trận thành viên & danh hiệu phục vụ modal
  const modalMemberData = useMemo(() => {
    if (!selectedRegForMemberList) return { members: [], uniqueTitles: [] };
    const members =
      selectedRegForMemberList.members && selectedRegForMemberList.members.length > 0
        ? selectedRegForMemberList.members
        : [
            {
              name: selectedRegForMemberList.name || selectedRegForMemberList.user?.name || "Cán bộ",
              positionName:
                selectedRegForMemberList.positionName ||
                selectedRegForMemberList.position?.positionName ||
                "Cán bộ",
              departmentName:
                selectedRegForMemberList.departmentName ||
                selectedRegForMemberList.department?.departmentName ||
                "",
              titles: selectedRegForMemberList.titles || [],
            },
          ];

    const titleMap = new Map();
    (selectedRegForMemberList.titles || []).forEach((t) => {
      const id = String(t._id || t);
      const name = t.name || t.code || String(t);
      if (!titleMap.has(name)) {
        titleMap.set(name, { id, name });
      }
    });
    members.forEach((m) => {
      (m.titles || []).forEach((t) => {
        const id = String(t._id || t);
        const name = t.name || t.code || String(t);
        if (!titleMap.has(name)) {
          titleMap.set(name, { id, name });
        }
      });
    });

    return {
      members,
      uniqueTitles: Array.from(titleMap.values()),
    };
  }, [selectedRegForMemberList]);

  // Cột bảng ma trận trong modal
  const modalColumns = useMemo(() => {
    const cols = [
      {
        title: "STT",
        key: "stt",
        width: 50,
        align: "center",
        render: (_, __, idx) => idx + 1,
      },
      {
        title: "Họ và tên",
        dataIndex: "name",
        key: "name",
        width: 190,
        render: (name) => <span className="font-semibold text-gray-800">{name}</span>,
      },
      {
        title: "Chức vụ",
        dataIndex: "positionName",
        key: "positionName",
        width: 140,
        render: (pos) => pos || "Cán bộ",
      },
    ];

    modalMemberData.uniqueTitles.forEach((ut) => {
      cols.push({
        title: ut.name,
        key: ut.id || ut.name,
        align: "center",
        minWidth: 120,
        render: (_, member) => {
          const hasTitle = (member.titles || []).some((t) => {
            const tId = String(t._id || t);
            const tName = t.name || t.code || String(t);
            return (
              tId === ut.id ||
              tName.toLowerCase().trim() === ut.name.toLowerCase().trim()
            );
          });
          return hasTitle ? (
            <span className="font-bold text-base text-blue-600">X</span>
          ) : (
            <span className="text-gray-300">-</span>
          );
        },
      });
    });

    return cols;
  }, [modalMemberData]);

  // Tổng cộng ma trận modal
  const renderModalTableSummary = () => {
    return (
      <Table.Summary fixed>
        <Table.Summary.Row className="bg-slate-50 font-bold">
          <Table.Summary.Cell index={0} colSpan={3} className="text-center font-bold uppercase text-gray-800">
            Tổng cộng ({modalMemberData.members.length} thành viên)
          </Table.Summary.Cell>
          {modalMemberData.uniqueTitles.map((ut, utIdx) => {
            const count = modalMemberData.members.filter((m) =>
              (m.titles || []).some((t) => {
                const tId = String(t._id || t);
                const tName = t.name || t.code || String(t);
                return (
                  tId === ut.id ||
                  tName.toLowerCase().trim() === ut.name.toLowerCase().trim()
                );
              })
            ).length;
            return (
              <Table.Summary.Cell
                key={ut.id || utIdx}
                index={3 + utIdx}
                className="text-center font-bold text-blue-600 text-sm"
              >
                {count}
              </Table.Summary.Cell>
            );
          })}
        </Table.Summary.Row>
      </Table.Summary>
    );
  };

  // Tải danh sách đăng ký
  const fetchRegistrations = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        schoolYear: schoolYear || undefined,
        department: department || undefined,
        title: titleId || undefined,
        status: status || undefined,
        search: searchText || undefined,
      };

      const res = await getEmulationRegistrations(params);
      if (res.success) {
        setRegistrations(res.data || []);
        setTotal(res.pagination?.total || 0);
        if (res.userRoleInfo) {
          setUserRoleInfo(res.userRoleInfo);
        }
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể tải danh sách đăng ký");
    } finally {
      setLoading(false);
    }
  }, [schoolYear, department, titleId, status, searchText]);

  // Tải master data: phòng ban, danh hiệu
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [deptRes, titleRes] = await Promise.all([
          getAllDepartments(),
          getEmulationTitles({ activeOnly: "true" }),
        ]);
        const rawDepts = Array.isArray(deptRes)
          ? deptRes
          : deptRes?.AllDepartment || deptRes?.departments || deptRes?.data || [];
        setDepartments(rawDepts.filter((d) => d && !d.departmentName?.toLowerCase().includes("giải thể")));
        if (titleRes.success) {
          setTitles(titleRes.data || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadMasterData();
  }, []);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const [exportingFilter, setExportingFilter] = useState(false);

  const handleDelete = async (id) => {
    try {
      await deleteEmulationRegistration(id);
      message.success("Xóa hồ sơ đăng ký thành công!");
      fetchRegistrations();
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể xóa hồ sơ đăng ký");
    }
  };

  const handleBatchDelete = async () => {
    if (!selectedRowKeys || selectedRowKeys.length === 0) return;
    try {
      setLoading(true);
      const res = await deleteBatchEmulationRegistrations(selectedRowKeys);
      message.success(res.message || `Đã xóa thành công ${selectedRowKeys.length} hồ sơ`);
      setSelectedRowKeys([]);
      fetchRegistrations();
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi khi xóa danh sách hồ sơ");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = (record, action) => {
    setSelectedReg(record);
    setReviewAction(action);
    reviewForm.resetFields();
    if (action === "MANAGER_APPROVE") {
      reviewForm.setFieldsValue({ note: "Đơn vị quản lý đã tiếp nhận và chấp nhận hồ sơ đề nghị khen thưởng." });
    } else if (action === "MANAGER_SUBMIT_BGH") {
      reviewForm.setFieldsValue({ note: "Đơn vị đã rà soát hồ sơ, kính chuyển Ban Giám hiệu xem xét công nhận." });
    } else if (action === "BGH_APPROVE") {
      reviewForm.setFieldsValue({ note: "Hội đồng TĐ-KT trường thống nhất phê duyệt công nhận danh hiệu." });
    }
    setReviewModalVisible(true);
  };

  // Xuất Excel chi tiết cho 1 hồ sơ đề nghị (mỗi danh hiệu 1 cột, dòng cuối tính tổng số lượng)
  const handleExportDetailExcel = (record) => {
    if (!record) return;
    try {
      // Chuẩn bị danh sách thành viên đề nghị
      const members =
        record.members && record.members.length > 0
          ? record.members
          : [
              {
                name: record.name || record.user?.name || "Cán bộ",
                positionName: record.positionName || record.position?.positionName || "",
                departmentName:
                  record.departmentName || record.department?.departmentName || "",
                titles: record.titles || [],
              },
            ];

      // Thu thập danh sách các danh hiệu thi đua có trong hồ sơ
      const titleMap = new Map();
      (record.titles || []).forEach((t) => {
        const id = String(t._id || t);
        const name = t.name || t.code || String(t);
        if (!titleMap.has(name)) {
          titleMap.set(name, { id, name });
        }
      });
      members.forEach((m) => {
        (m.titles || []).forEach((t) => {
          const id = String(t._id || t);
          const name = t.name || t.code || String(t);
          if (!titleMap.has(name)) {
            titleMap.set(name, { id, name });
          }
        });
      });

      const uniqueTitles = Array.from(titleMap.values());
      const counts = {};
      uniqueTitles.forEach((ut) => {
        counts[ut.name] = 0;
      });

      // Tạo các dòng dữ liệu cho từng thành viên
      const rows = members.map((m, idx) => {
        const row = {
          "STT": idx + 1,
          "Họ và tên": m.name,
          "Chức vụ": m.positionName || "--",
          "Đơn vị công tác":
            m.departmentName ||
            record.departmentName ||
            record.department?.departmentName ||
            "",
        };

        uniqueTitles.forEach((ut) => {
          const hasTitle = (m.titles || []).some((t) => {
            const tId = String(t._id || t);
            const tName = t.name || t.code || String(t);
            return (
              tId === ut.id ||
              tName.toLowerCase().trim() === ut.name.toLowerCase().trim()
            );
          });

          if (hasTitle) {
            row[ut.name] = "X";
            counts[ut.name] = (counts[ut.name] || 0) + 1;
          } else {
            row[ut.name] = "";
          }
        });

        return row;
      });

      // Dòng TỔNG CỘNG ở cuối danh sách: tính tổng số lượng theo từng danh hiệu
      const totalRow = {
        "STT": "",
        "Họ và tên": "TỔNG CỘNG",
        "Chức vụ": "",
        "Đơn vị công tác": "",
      };
      uniqueTitles.forEach((ut) => {
        totalRow[ut.name] = counts[ut.name] || 0;
      });
      rows.push(totalRow);

      const ws = XLSX.utils.json_to_sheet(rows);

      // Căn chỉnh độ rộng các cột
      const colWidths = [
        { wch: 6 },  // STT
        { wch: 26 }, // Họ và tên
        { wch: 22 }, // Chức vụ
        { wch: 32 }, // Đơn vị công tác
      ];
      uniqueTitles.forEach((ut) => {
        colWidths.push({ wch: Math.max(ut.name.length + 4, 18) });
      });
      ws["!cols"] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Danh sách đề nghị");

      const rawDept =
        record.departmentName ||
        record.department?.departmentName ||
        "Don_Vi";
      const cleanDept = rawDept.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]/g, "_");
      const fileName = `Danh_Sach_De_Nghi_Thi_Dua_${cleanDept}_${record.schoolYear || ""}.xlsx`;

      XLSX.writeFile(wb, fileName);
      message.success("Xuất file Excel danh sách đề nghị thành công!");
    } catch (err) {
      console.error("Lỗi xuất Excel chi tiết:", err);
      message.error("Có lỗi xảy ra khi xuất file Excel danh sách");
    }
  };

  // Xuất Excel toàn bộ danh sách theo bộ lọc đang chọn để làm báo cáo
  const handleExportFilterExcel = async () => {
    try {
      setExportingFilter(true);
      const params = {
        schoolYear: schoolYear || undefined,
        department: department || undefined,
        title: titleId || undefined,
        status: status || undefined,
        search: searchText || undefined,
        page: 1,
        limit: 1000,
      };

      const res = await getEmulationRegistrations(params);
      const exportData = res.success ? res.data || [] : registrations;

      if (!exportData || exportData.length === 0) {
        message.warning("Không có hồ sơ nào phù hợp với bộ lọc hiện tại để xuất Excel!");
        return;
      }

      let totalMembersCount = 0;

      const rows = exportData.map((reg, idx) => {
        const memCount = reg.members && reg.members.length > 0 ? reg.members.length : 1;
        totalMembersCount += memCount;

        const memberDetails =
          reg.members && reg.members.length > 0
            ? reg.members.map((m) => `${m.name} (${m.positionName || "CB"})`).join(", ")
            : reg.name || reg.user?.name || "";

        const titleNames = (reg.titles || []).map((t) => t.name || t.code || t).join(", ");

        let statusText = "Chờ Quản lý duyệt";
        if (reg.status === "SUBMITTED_TO_BGH") statusText = "Đã chuyển BGH";
        else if (reg.status === "SCHOOL_APPROVED") statusText = "BGH đã công nhận";
        else if (reg.status === "REJECTED") statusText = "Từ chối / Cần sửa";

        return {
          "STT": idx + 1,
          "Năm học": reg.schoolYear || "",
          "Cán bộ đại diện lập": reg.name || reg.user?.name || "",
          "Chức vụ": reg.positionName || reg.position?.positionName || "",
          "Đơn vị / Phòng ban": reg.departmentName || reg.department?.departmentName || "",
          "Số lượng CB đề nghị": memCount,
          "Danh sách cán bộ đề nghị": memberDetails,
          "Danh hiệu thi đua đề nghị": titleNames,
          "Số tài liệu minh chứng": reg.attachedFiles?.length || 0,
          "Ngày đề nghị": reg.createdAt ? dayjs(reg.createdAt).format("DD/MM/YYYY") : "",
          "Trạng thái duyệt": statusText,
          "Ý kiến Quản lý": reg.managerReview?.note || "",
          "Ý kiến Ban Giám hiệu": reg.bghReview?.note || "",
        };
      });

      // Dòng TỔNG CỘNG cuối bảng báo cáo
      rows.push({
        "STT": "",
        "Năm học": "TỔNG CỘNG",
        "Cán bộ đại diện lập": `${exportData.length} hồ sơ đề nghị`,
        "Chức vụ": "",
        "Đơn vị / Phòng ban": "",
        "Số lượng CB đề nghị": totalMembersCount,
        "Danh sách cán bộ đề nghị": "",
        "Danh hiệu thi đua đề nghị": "",
        "Số tài liệu minh chứng": "",
        "Ngày đề nghị": "",
        "Trạng thái duyệt": "",
        "Ý kiến Quản lý": "",
        "Ý kiến Ban Giám hiệu": "",
      });

      const ws = XLSX.utils.json_to_sheet(rows);

      ws["!cols"] = [
        { wch: 6 },  // STT
        { wch: 12 }, // Năm học
        { wch: 25 }, // Cán bộ đại diện
        { wch: 20 }, // Chức vụ
        { wch: 30 }, // Đơn vị / Phòng ban
        { wch: 20 }, // Số lượng CB
        { wch: 45 }, // Danh sách cán bộ
        { wch: 35 }, // Danh hiệu thi đua
        { wch: 20 }, // Hồ sơ minh chứng
        { wch: 15 }, // Ngày đề nghị
        { wch: 20 }, // Trạng thái
        { wch: 30 }, // Ý kiến Quản lý
        { wch: 30 }, // Ý kiến BGH
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Báo cáo đề nghị thi đua");

      const fileName = `Bao_Cao_De_Nghi_Thi_Dua_${schoolYear || "Tat_Ca"}_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      message.success(`Đã xuất thành công ${exportData.length} hồ sơ ra file Excel báo cáo!`);
    } catch (err) {
      console.error("Lỗi xuất Excel báo cáo:", err);
      message.error("Lỗi khi xuất file Excel báo cáo");
    } finally {
      setExportingFilter(false);
    }
  };

  const handleConfirmReview = async () => {
    try {
      const values = await reviewForm.validateFields();
      setReviewSubmitting(true);
      await reviewEmulationRegistration(selectedReg._id, {
        action: reviewAction,
        note: values.note,
      });
      message.success("Cập nhật trạng thái xét duyệt thành công!");
      setReviewModalVisible(false);
      if (drawerVisible) {
        setDrawerVisible(false);
      }
      fetchRegistrations();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || "Lỗi khi xét duyệt hồ sơ");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const renderStatus = (s) => {
    switch (s) {
      case "PENDING":
        return <Badge status="warning" text={<span className="text-amber-600 font-medium">Chờ QL duyệt</span>} />;
      case "SUBMITTED_TO_BGH":
        return <Badge status="processing" text={<span className="text-blue-600 font-medium">Đã chuyển BGH</span>} />;
      case "SCHOOL_APPROVED":
        return <Badge status="success" text={<span className="text-green-600 font-semibold">BGH đã công nhận</span>} />;
      case "REJECTED":
        return <Badge status="error" text={<span className="text-red-600 font-medium">Từ chối / Sửa lại</span>} />;
      default:
        return <Tag>{s}</Tag>;
    }
  };

  const isAdmin = currentUserRole === "admin";
  const isBGH = userRoleInfo.isBGH || isAdmin;
  const isHieuTruong = useMemo(() => {
    if (isAdmin) return true;
    if (userRoleInfo.isHieuTruong !== undefined) return Boolean(userRoleInfo.isHieuTruong);
    try {
      const userStr = localStorage.getItem("user");
      const u = userStr ? JSON.parse(userStr) : null;
      if (!u) return false;
      const pCode = (u.position?.positionCode || u.position?.code || u.position?.abbreviation || "").toUpperCase();
      const pName = (u.position?.positionName || "").toLowerCase();
      return pCode === "HT" || (pName.includes("hiệu trưởng") && !pName.includes("phó"));
    } catch (e) {
      return false;
    }
  }, [isAdmin, userRoleInfo.isHieuTruong]);

  const isManager = (userRoleInfo.isManager && !userRoleInfo.isCapTruong) || currentUserRole === "manager" || isAdmin;
  const canViewAll = userRoleInfo.canViewAll ?? (isManager || isBGH);
  const isCapTruong = !canViewAll;

  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 50,
      align: "center",
      render: (_, __, index) => index + 1,
    },
    {
      title: "Cán bộ đề nghị",
      key: "name",
      width: 250,
      render: (_, record) => {
        const members = record.members || [];
        const hasMembers = members.length > 0;

        return (
          <div className="space-y-1.5 py-0.5">
            <div>
              <div className="font-semibold text-gray-800 flex items-center gap-1">
                <UserOutlined className="text-blue-500 text-xs" />
                <span>{record.name || record.user?.name}</span>
                <span className="text-[10px] text-blue-600 font-normal bg-blue-50 px-1 py-0.5 rounded border border-blue-200 ml-1">
                  Đại diện lập
                </span>
              </div>
              <div className="text-xs text-gray-500 ml-4">
                {record.positionName || record.position?.positionName || "Chưa có chức vụ"}
              </div>
            </div>

            {/* Nút xem danh sách thành viên đăng ký */}
            {hasMembers && (
              <div className="pt-1">
                <Button
                  type="link"
                  size="small"
                  icon={<TeamOutlined className="text-blue-500" />}
                  className="!px-2 !py-0.5 !h-auto text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 flex items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenMemberListModal(record);
                  }}
                >
                  Xem danh sách ({members.length} thành viên)
                </Button>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Đơn vị / Phòng ban",
      key: "department",
      width: 170,
      render: (_, record) => (
        <div className="text-sm text-gray-700 flex items-center gap-1">
          <BankOutlined className="text-gray-400" />
          {record.departmentName || record.department?.departmentName || "Trường CĐ Nam Sài Gòn"}
        </div>
      ),
    },
    {
      title: "Năm học",
      dataIndex: "schoolYear",
      key: "schoolYear",
      width: 95,
      align: "center",
      render: (year) => <Tag color="blue">{year}</Tag>,
    },
    {
      title: "Danh hiệu thi đua đề nghị",
      key: "titles",
      minWidth: 240,
      render: (_, record) => (
        <div className="flex flex-wrap gap-1">
          {(record.titles || []).map((t) => (
            <Tag color="gold" key={t._id || t}>
              <TrophyOutlined className="mr-1" />
              {t.name || t.code || t}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: "Hồ sơ minh chứng",
      key: "files",
      width: 115,
      align: "center",
      render: (_, record) => {
        const fileCount = record.attachedFiles?.length || 0;
        if (fileCount === 0) {
          return <Text type="secondary" className="text-xs italic">Chưa đính kèm</Text>;
        }
        return (
          <Tooltip title="Xem danh sách file đính kèm">
            <Button
              type="dashed"
              size="small"
              icon={<FilePdfOutlined className="text-red-500" />}
              onClick={() => {
                setSelectedReg(record);
                setDrawerVisible(true);
              }}
            >
              {fileCount} tài liệu
            </Button>
          </Tooltip>
        );
      },
    },
    {
      title: "Ngày đề nghị",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 105,
      align: "center",
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY") : "--"),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (s) => renderStatus(s),
    },
    {
      title: "Thao tác",
      key: "action",
      width: isMobile ? 75 : 110,
      align: "center",
      fixed: "right",
      render: (_, record) => {
        const isOwner =
          String(record.user?._id || record.user) === String(currentUserId) ||
          String(record.createdByUser?._id || record.createdByUser) === String(currentUserId);
        const isRejected = record.status === "REJECTED";
        const isManagerAccepted =
          !isRejected &&
          (record.managerReview?.status === "APPROVED" ||
            record.status === "SUBMITTED_TO_BGH" ||
            record.status === "SCHOOL_APPROVED");

        const canReviewManager = isManager && record.status === "PENDING";
        // CHỈ chức vụ Hiệu trưởng (hoặc Admin) mới có quyền duyệt/từ chối BGH
        const canReviewBGH = isHieuTruong && (record.status === "SUBMITTED_TO_BGH" || record.status === "PENDING");
        // Lãnh đạo cùng đơn vị (Trưởng / Phó) cũng có thể chỉnh sửa hồ sơ đơn vị mình
        const isSameDeptLeader = Boolean(
          userRoleInfo.departmentId &&
          (String(record.department?._id || record.department) === String(userRoleInfo.departmentId)) &&
          !canViewAll
        );
        // Người nộp, Lãnh đạo đơn vị hoặc Manager có thể sửa khi còn PENDING hoặc khi bị REJECTED
        const canEdit = (isOwner || isManager || isSameDeptLeader) && (record.status === "PENDING" || isRejected);
        const canDelete = isAdmin || ((isOwner || isManager || isBGH || isSameDeptLeader) && !isManagerAccepted && record.status === "PENDING");

        // Nút bấm gọn gàng, tự động xuống dòng: sm:!w-[84px] sm:!h-[26px] (desktop) và icon 28px (mobile)
        const btnClass = "rounded sm:!w-[84px] sm:!h-[26px] max-sm:!w-7 max-sm:!h-7 max-sm:!p-0 flex items-center justify-center text-xs font-medium";

        return (
          <div className="flex flex-row flex-wrap gap-1 items-center justify-center max-w-[88px] mx-auto py-0.5">
            <Tooltip title="Xem chi tiết">
              <Button
                type="primary"
                ghost
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedReg(record);
                  setDrawerVisible(true);
                }}
                className={btnClass}
              >
                <span className="hidden sm:inline text-xs ml-1">Xem</span>
              </Button>
            </Tooltip>

            {/* Thao tác của Quản lý: Chấp nhận / Duyệt & Chuyển BGH */}
            {canReviewManager && (
              <>
                <Tooltip title="Chấp nhận hồ sơ đề nghị">
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    style={{ backgroundColor: "#52c41a" }}
                    onClick={() => handleOpenReview(record, "MANAGER_APPROVE")}
                    className={btnClass}
                  >
                    <span className="hidden sm:inline text-xs ml-1">Chấp nhận</span>
                  </Button>
                </Tooltip>
                <Tooltip title="Duyệt sơ bộ & chuyển hồ sơ lên BGH">
                  <Button
                    type="primary"
                    size="small"
                    icon={<SendOutlined />}
                    style={{ backgroundColor: "#1890ff" }}
                    onClick={() => handleOpenReview(record, "MANAGER_SUBMIT_BGH")}
                    className={btnClass}
                  >
                    <span className="hidden sm:inline text-xs ml-1">Gửi BGH</span>
                  </Button>
                </Tooltip>
              </>
            )}

            {/* Thao tác của BGH (CHỈ Hiệu trưởng và Admin): Phê duyệt công nhận / Từ chối */}
            {canReviewBGH && (
              <>
                <Tooltip title="Hiệu trưởng phê duyệt công nhận">
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    style={{ backgroundColor: "#52c41a" }}
                    onClick={() => handleOpenReview(record, "BGH_APPROVE")}
                    className={btnClass}
                  >
                    <span className="hidden sm:inline text-xs ml-1">Công nhận</span>
                  </Button>
                </Tooltip>
                <Tooltip title="Hiệu trưởng từ chối (yêu cầu sửa theo ý kiến Hội đồng)">
                  <Button
                    type="primary"
                    danger
                    size="small"
                    icon={<CloseCircleOutlined />}
                    onClick={() => handleOpenReview(record, "BGH_REJECT")}
                    className={btnClass}
                  >
                    <span className="hidden sm:inline text-xs ml-1">Từ chối</span>
                  </Button>
                </Tooltip>
              </>
            )}

            {/* Nút sửa: cho phép sửa khi PENDING hoặc khi bị REJECTED */}
            {canEdit && (
              <Tooltip title={isRejected ? "Chỉnh sửa lại hồ sơ theo ý kiến Hội đồng" : "Chỉnh sửa đơn"}>
                <Button
                  type="default"
                  size="small"
                  icon={<EditOutlined className={isRejected ? "text-red-500" : "text-amber-500"} />}
                  onClick={() => navigate(`/emulation/register?id=${record._id}`)}
                  className={`${btnClass} ${
                    isRejected
                      ? "text-red-600 hover:text-red-700 border-red-300 bg-red-50"
                      : "text-amber-600 hover:text-amber-700 border-amber-300"
                  }`}
                >
                  <span className="hidden sm:inline text-xs ml-1">Sửa</span>
                </Button>
              </Tooltip>
            )}

            {/* Nút xóa */}
            {canDelete && (
              <Tooltip title="Xóa hồ sơ">
                <Popconfirm
                  title="Xóa hồ sơ đề nghị thi đua này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleDelete(record._id)}
                >
                  <Button
                    type="default"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    className={btnClass}
                  >
                    <span className="hidden sm:inline text-xs ml-1">Xóa</span>
                  </Button>
                </Popconfirm>
              </Tooltip>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="w-full px-2 sm:px-4 py-3">
      <Card className="shadow-sm border-gray-200 w-full">
        {/* TIÊU ĐỀ & NÚT HÀNH ĐỘNG */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-gray-100">
          <div>
            <Title level={4} className="!mb-1 flex items-center gap-2 text-blue-700">
              <TrophyOutlined className="text-yellow-500 text-xl" />
              Danh Sách Đề Nghị Thi Đua - Khen Thưởng
            </Title>
            <Text type="secondary">
              {canViewAll
                ? "Quản trị viên & Ban Giám hiệu: Xem xét, duyệt hồ sơ đề nghị thi đua từ tất cả các đơn vị trong trường"
                : `Lãnh đạo đơn vị: Theo dõi chi tiết hồ sơ đề nghị thi đua của đơn vị ${userRoleInfo.departmentName || ""}`}
            </Text>
          </div>
          <Space wrap>
            {isAdmin && selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`Xóa ${selectedRowKeys.length} hồ sơ đã chọn?`}
                description="Quản trị viên có thể xóa hàng loạt hồ sơ bất kể đang ở trạng thái nào."
                okText="Xóa danh sách"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
                onConfirm={handleBatchDelete}
              >
                <Button danger type="primary" icon={<DeleteOutlined />}>
                  Xóa danh sách ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
            <Button icon={<ReloadOutlined />} onClick={fetchRegistrations} loading={loading}>
              Làm mới
            </Button>
            <Button
              icon={<FileExcelOutlined style={{ color: "#52c41a" }} />}
              onClick={handleExportFilterExcel}
              loading={exportingFilter}
            >
              Xuất Excel
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/emulation/register")}
              style={{ backgroundColor: "#1890ff" }}
            >
              Đề nghị mới
            </Button>
          </Space>
        </div>

        {/* THANH BỘ LỌC TÌM KIẾM */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div>
            <Text className="text-xs text-gray-500 block mb-1">Năm học:</Text>
            <AutoComplete
              className="w-full"
              value={schoolYear}
              onChange={setSchoolYear}
              options={SCHOOL_YEARS.map((y) => ({
                value: y,
                label: `Năm học ${y}`,
              }))}
              filterOption={(inputValue, option) =>
                (option?.value || "").toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
              }
              placeholder="Chọn hoặc nhập năm học"
              allowClear
            >
              <Input prefix={<CalendarOutlined className="text-gray-400" />} />
            </AutoComplete>
          </div>

          <div>
            <Text className="text-xs text-gray-500 block mb-1">
              {canViewAll ? "Đơn vị / Phòng ban:" : "Đơn vị của bạn:"}
            </Text>
            {canViewAll ? (
              <Select
                className="w-full"
                value={department}
                onChange={setDepartment}
                allowClear
                placeholder="Tất cả phòng ban"
                showSearch
                optionFilterProp="children"
              >
                {departments.map((d) => (
                  <Select.Option key={d._id} value={d._id}>
                    {d.departmentName}
                  </Select.Option>
                ))}
              </Select>
            ) : (
              <Input
                prefix={<BankOutlined className="text-gray-400" />}
                value={userRoleInfo.departmentName || "Đơn vị của tôi"}
                disabled
              />
            )}
          </div>

          <div>
            <Text className="text-xs text-gray-500 block mb-1">Danh hiệu:</Text>
            <Select
              className="w-full"
              value={titleId}
              onChange={setTitleId}
              allowClear
              placeholder="Tất cả danh hiệu"
              showSearch
              optionFilterProp="children"
            >
              {titles.map((t) => (
                <Select.Option key={t._id} value={t._id}>
                  {t.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div>
            <Text className="text-xs text-gray-500 block mb-1">Trạng thái duyệt:</Text>
            <Select
              className="w-full"
              value={status}
              onChange={setStatus}
              allowClear
              placeholder="Tất cả trạng thái"
            >
              <Select.Option value="PENDING">Chờ Quản lý duyệt</Select.Option>
              <Select.Option value="SUBMITTED_TO_BGH">Đã chuyển BGH</Select.Option>
              <Select.Option value="SCHOOL_APPROVED">BGH đã công nhận</Select.Option>
              <Select.Option value="REJECTED">Từ chối / Cần sửa</Select.Option>
            </Select>
          </div>

          <div>
            <Text className="text-xs text-gray-500 block mb-1">Tìm theo họ tên:</Text>
            <Input
              placeholder="Nhập tên cán bộ..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </div>
        </div>

        {/* BẢNG DANH SÁCH */}
        <Table
          rowKey="_id"
          rowSelection={
            isAdmin
              ? {
                  selectedRowKeys,
                  onChange: (keys) => setSelectedRowKeys(keys),
                }
              : undefined
          }
          columns={columns}
          dataSource={registrations}
          loading={loading}
          pagination={{
            total: total,
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (totalCount) => `Tổng cộng ${totalCount} hồ sơ đề nghị`,
          }}
          bordered
          size="middle"
          scroll={{ x: 1250 }}
        />
      </Card>

      {/* DRAWER XEM CHI TIẾT HỒ SƠ & LỊCH SỬ DUYỆT */}
      <Drawer
        title={
          <div className="flex items-center gap-2 text-blue-700">
            <TrophyOutlined className="text-yellow-500" />
            <span>Chi tiết Hồ sơ Đề nghị Thi đua</span>
          </div>
        }
        width={720}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        destroyOnClose
      >
        {selectedReg && (
          <div className="space-y-4">
            {/* THÔNG TIN CÁN BỘ */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="font-semibold text-base text-gray-800">
                {selectedReg.name || selectedReg.user?.name}
              </div>
              <div className="text-sm text-gray-600">
                Chức vụ: {selectedReg.positionName || selectedReg.position?.positionName || "Chưa có"} |
                Đơn vị: {selectedReg.departmentName || selectedReg.department?.departmentName || "Chưa phân khoa"}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Email: {selectedReg.user?.email} | Số điện thoại: {selectedReg.user?.mobile || "Không có"}
              </div>
            </div>

            {/* NĂM HỌC VÀ TRẠNG THÁI */}
            <div className="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-100">
              <div>
                <span className="text-sm text-gray-600 mr-2">Năm học:</span>
                <Tag color="blue" className="font-medium text-sm">
                  {selectedReg.schoolYear}
                </Tag>
              </div>
              <div>{renderStatus(selectedReg.status)}</div>
            </div>

            {/* DANH SÁCH THÀNH VIÊN ĐỀ NGHỊ */}
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2">
                <Text strong className="text-gray-700">
                  Danh sách cán bộ được đề nghị khen thưởng ({selectedReg.members?.length || (selectedReg.name ? 1 : 0)} người):
                </Text>
                <Button
                  type="primary"
                  ghost
                  size="small"
                  icon={<FileExcelOutlined style={{ color: "#52c41a" }} />}
                  onClick={() => handleExportDetailExcel(selectedReg)}
                >
                  Xuất danh sách file Excel
                </Button>
              </div>
              {selectedReg.members && selectedReg.members.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 border-b">
                      <tr>
                        <th className="p-2 w-10 text-center">STT</th>
                        <th className="p-2 w-48">Họ và tên</th>
                        <th className="p-2 w-36">Chức vụ</th>
                        <th className="p-2">Danh hiệu đề nghị</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedReg.members.map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 text-center text-gray-500 font-semibold">{idx + 1}</td>
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
              ) : (
                <div className="p-3 text-xs text-gray-600 bg-gray-50 rounded border">
                  Cán bộ đại diện: <strong>{selectedReg.name || selectedReg.user?.name}</strong> (
                  {selectedReg.positionName || selectedReg.position?.positionName || "Cán bộ"})
                </div>
              )}
            </div>

            {/* DANH HIỆU ĐỀ NGHỊ TỔNG HỢP */}
            <div>
              <Text strong className="block mb-2 text-gray-700">
                Tổng hợp danh hiệu thi đua đề nghị:
              </Text>
              <div className="flex flex-col gap-2">
                {(selectedReg.titles || []).map((t) => (
                  <div
                    key={t._id || t}
                    className="p-2 border rounded-lg bg-yellow-50/40 border-yellow-200 flex justify-between items-center"
                  >
                    <div>
                      <span className="font-medium text-gray-800">{t.name || t.code || t}</span>
                      {t.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                      )}
                    </div>
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
                {(!selectedReg.attachedFiles || selectedReg.attachedFiles.length === 0) && (
                  <div className="p-3 text-center text-gray-400 text-sm">
                    Không có tài liệu minh chứng đính kèm
                  </div>
                )}
                {(selectedReg.attachedFiles || []).map((f, idx) => (
                  <div key={idx} className="p-3 flex justify-between items-center hover:bg-gray-50">
                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                      <FilePdfOutlined className="text-red-500 text-lg flex-shrink-0" />
                      <div className="truncate">
                        <div className="text-xs text-gray-500 font-medium">
                          {f.documentTypeName || f.documentType?.name || "Minh chứng"}
                        </div>
                        <a
                          href={f.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 font-medium text-sm hover:underline truncate block"
                        >
                          {f.fileName}
                        </a>
                      </div>
                    </div>
                    <Button
                      type="link"
                      icon={<EyeOutlined />}
                      href={f.fileUrl}
                      target="_blank"
                      size="small"
                    >
                      Xem trên Drive
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* GHI CHÚ / CAM KẾT */}
            {selectedReg.notes && (
              <div>
                <Text strong className="block mb-1 text-gray-700">
                  Ghi chú / Cam kết phấn đấu:
                </Text>
                <div className="p-3 bg-gray-50 rounded border text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedReg.notes}
                </div>
              </div>
            )}

            {/* NHẬN XÉT CỦA QUẢN LÝ ĐƠN VỊ & BAN GIÁM HIỆU */}
            {(selectedReg.managerReview?.note || selectedReg.bghReview?.note) && (
              <div className="space-y-2">
                <Text strong className="block text-gray-700">
                  Ý kiến / Nhận xét của cấp xét duyệt:
                </Text>
                {selectedReg.managerReview?.note && (
                  <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded text-sm">
                    <span className="font-semibold text-amber-800">
                      Quản lý đơn vị ({selectedReg.managerReview.reviewedByName}):
                    </span>{" "}
                    {selectedReg.managerReview.note}
                    <div className="text-xs text-gray-400 mt-1">
                      {dayjs(selectedReg.managerReview.reviewedAt).format("DD/MM/YYYY HH:mm")}
                    </div>
                  </div>
                )}
                {selectedReg.bghReview?.note && (
                  <div className="p-2.5 bg-green-50/60 border border-green-200 rounded text-sm">
                    <span className="font-semibold text-green-800">
                      Ban Giám hiệu ({selectedReg.bghReview.reviewedByName}):
                    </span>{" "}
                    {selectedReg.bghReview.note}
                    <div className="text-xs text-gray-400 mt-1">
                      {dayjs(selectedReg.bghReview.reviewedAt).format("DD/MM/YYYY HH:mm")}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LỊCH SỬ THAO TÁC / VẾT DUYỆT */}
            <div>
              <Text strong className="block mb-2 text-gray-700 flex items-center gap-1">
                <HistoryOutlined /> Lịch sử theo dõi tiến trình:
              </Text>
              <Timeline
                className="mt-3 text-xs"
                items={(selectedReg.history || []).map((h) => ({
                  color:
                    h.action.includes("APPROVED") || h.action.includes("SUBMIT")
                      ? "green"
                      : h.action.includes("REJECT")
                      ? "red"
                      : "blue",
                  children: (
                    <div>
                      <div className="font-medium text-gray-800">
                        {h.actorName} ({h.actorRole || "Cán bộ"}): {h.details}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {dayjs(h.timestamp).format("DD/MM/YYYY HH:mm:ss")}
                      </div>
                    </div>
                  ),
                }))}
              />
            </div>

            <Divider />

            {/* NÚT THAO TÁC XÉT DUYỆT NHANH TRONG DRAWER */}
            <div className="flex justify-end gap-2">
              {(isManager || isBGH) && selectedReg.status === "PENDING" && (
                <>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => handleOpenReview(selectedReg, "MANAGER_REJECT")}
                  >
                    Từ chối
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    style={{ backgroundColor: "#52c41a" }}
                    onClick={() => handleOpenReview(selectedReg, "MANAGER_APPROVE")}
                  >
                    Chấp nhận
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    style={{ backgroundColor: "#1890ff" }}
                    onClick={() => handleOpenReview(selectedReg, "MANAGER_SUBMIT_BGH")}
                  >
                    Duyệt & Gửi BGH
                  </Button>
                </>
              )}

              {isHieuTruong && (selectedReg.status === "SUBMITTED_TO_BGH" || selectedReg.status === "PENDING") && (
                <>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => handleOpenReview(selectedReg, "BGH_REJECT")}
                  >
                    Hiệu trưởng Từ chối
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    style={{ backgroundColor: "#52c41a" }}
                    onClick={() => handleOpenReview(selectedReg, "BGH_APPROVE")}
                  >
                    Hiệu trưởng Phê duyệt công nhận
                  </Button>
                </>
              )}

              {isAdmin && (
                <Popconfirm
                  title="Xóa hồ sơ đề nghị thi đua này?"
                  description="Quản trị viên có thể xóa hồ sơ bất kể đang ở trạng thái nào."
                  okText="Xóa hồ sơ"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={async () => {
                    await handleDelete(selectedReg._id);
                    setDrawerVisible(false);
                  }}
                >
                  <Button danger icon={<DeleteOutlined />}>
                    Xóa hồ sơ
                  </Button>
                </Popconfirm>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* MODAL XÉT DUYỆT / NHẬP Ý KIẾN */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            {reviewAction.includes("REJECT") ? (
              <CloseCircleOutlined className="text-red-500" />
            ) : (
              <CheckCircleOutlined className="text-green-500" />
            )}
            <span>
              {reviewAction === "MANAGER_APPROVE"
                ? "Chấp nhận hồ sơ đề nghị thi đua"
                : reviewAction === "MANAGER_SUBMIT_BGH"
                ? "Duyệt hồ sơ & Chuyển lên Ban Giám hiệu"
                : reviewAction === "MANAGER_REJECT"
                ? "Quản lý đơn vị từ chối hồ sơ"
                : reviewAction === "BGH_APPROVE"
                ? "Hiệu trưởng phê duyệt công nhận danh hiệu"
                : "Hiệu trưởng từ chối công nhận (Ghi rõ lý do theo ý Hội đồng)"}
            </span>
          </div>
        }
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        onOk={handleConfirmReview}
        confirmLoading={reviewSubmitting}
        okText={
          reviewAction.includes("REJECT")
            ? "Xác nhận từ chối"
            : reviewAction === "MANAGER_APPROVE"
            ? "Xác nhận chấp nhận"
            : "Xác nhận phê duyệt"
        }
        okButtonProps={{
          danger: reviewAction.includes("REJECT"),
          style: !reviewAction.includes("REJECT")
            ? { backgroundColor: reviewAction === "MANAGER_APPROVE" ? "#52c41a" : "#1890ff" }
            : {},
        }}
        cancelText="Đóng"
        destroyOnClose
      >
        <Form form={reviewForm} layout="vertical" className="mt-4">
          <Paragraph className="text-gray-600 text-sm">
            Bạn đang thực hiện xét duyệt hồ sơ đăng ký của cán bộ{" "}
            <strong>{selectedReg?.name || selectedReg?.user?.name}</strong> (Năm học{" "}
            <strong>{selectedReg?.schoolYear}</strong>).
          </Paragraph>

          <Form.Item
            name="note"
            label={
              reviewAction.includes("REJECT")
                ? "Lý do từ chối (bắt buộc theo ý kiến Hội đồng thi đua - khen thưởng)"
                : "Ý kiến / Nhận xét của cấp xét duyệt"
            }
            rules={[
              {
                required: reviewAction.includes("REJECT"),
                message: "Vui lòng nhập lý do từ chối để người nộp hồ sơ biết và điều chỉnh",
              },
            ]}
          >
            <TextArea
              rows={4}
              placeholder={
                reviewAction.includes("REJECT")
                  ? "Nhập chi tiết lý do từ chối, yêu cầu điều chỉnh thành viên, danh hiệu hoặc minh chứng theo ý kiến Hội đồng..."
                  : "Nhập nhận xét, đánh giá kết quả đạt được..."
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL XEM DANH SÁCH THÀNH VIÊN ĐĂNG KÝ (MỖI DANH HIỆU 1 CỘT) */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-blue-700">
            <TeamOutlined className="text-amber-500 text-lg" />
            <span>
              Danh Sách Thành Viên Đăng Ký Thi Đua
            </span>
          </div>
        }
        open={memberListModalVisible}
        onCancel={() => {
          setMemberListModalVisible(false);
          setSelectedRegForMemberList(null);
        }}
        width={950}
        footer={[
          <Button
            key="export"
            icon={<FileExcelOutlined />}
            style={{ backgroundColor: "#52c41a", color: "#fff" }}
            onClick={() => handleExportDetailExcel(selectedRegForMemberList)}
          >
            Xuất Excel chi tiết
          </Button>,
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setMemberListModalVisible(false);
              setSelectedRegForMemberList(null);
            }}
          >
            Đóng
          </Button>,
        ]}
      >
        {selectedRegForMemberList && (
          <div className="space-y-3 pt-2">
            {/* Header tóm tắt hồ sơ */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Cán bộ đại diện lập:</span>{" "}
                <strong className="text-gray-800">
                  {selectedRegForMemberList.name || selectedRegForMemberList.user?.name}
                </strong>{" "}
                <span className="text-gray-400">
                  ({selectedRegForMemberList.positionName || selectedRegForMemberList.position?.positionName || "Cán bộ"})
                </span>
              </div>
              <div>
                <span className="text-gray-500">Đơn vị / Phòng ban:</span>{" "}
                <strong className="text-gray-800">
                  {selectedRegForMemberList.departmentName ||
                    selectedRegForMemberList.department?.departmentName ||
                    "Trường CĐ Nam Sài Gòn"}
                </strong>
              </div>
              <div>
                <span className="text-gray-500">Năm học:</span>{" "}
                <Tag color="blue" className="ml-1 font-semibold">
                  {selectedRegForMemberList.schoolYear}
                </Tag>
              </div>
            </div>

            {/* Bảng ma trận danh sách thành viên và các danh hiệu */}
            <Table
              rowKey={(r, idx) => r._id || `${r.name}_${idx}`}
              columns={modalColumns}
              dataSource={modalMemberData.members}
              pagination={false}
              bordered
              size="small"
              scroll={{ x: 600 + modalMemberData.uniqueTitles.length * 100, y: 420 }}
              summary={renderModalTableSummary}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmulationListPage;
