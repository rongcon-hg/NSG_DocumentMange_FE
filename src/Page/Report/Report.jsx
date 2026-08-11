/* eslint-disable no-unused-vars */
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Table,
  Spin,
  message,
  Modal,
  Card,
  Tag,
  Button,
  Select,
  DatePicker,
  InputNumber,
  Tooltip,
} from "antd";
import {
  getAllDocuments as getAllDocumentsApi,
  searchDocuments as searchDocumentsApi,
} from "../../api/documentApi";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { getAllUsers } from "../../api/auth";
import { getAllDocVariants } from "../../api/docVariantApi";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { getAllUnits } from "../../api/unitApi.js";
import axiosInstance from "../../api/axiosInstance";
import FilterFormWrapper from "../../components/FilterFormWrapper.jsx";
import { SearchOutlined, ReloadOutlined, FileExcelOutlined, EyeOutlined, DownloadOutlined } from "@ant-design/icons";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Ho_Chi_Minh");

const { RangePicker } = DatePicker;
const { Option } = Select;
const dateFormat = "DD/MM/YYYY";

const ReportPage = () => {
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [displayedDocuments, setDisplayedDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    pageSizeOptions: [10, 20, 50, 100],
  });
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [units, setUnits] = useState([]);
  const [filterType, setFilterType] = useState("all");
  const [docVariants, setDocVariants] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [isPrincipalIdeaModalVisible, setIsPrincipalIdeaModalVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);

  const [filters, setFilters] = useState({
    year: null,
    docType: null,
    createAtRange: [null, null],
    recipients: [],
    onTimeStatus: null,
    docVariant: null,
    deadlineRange: [null, null],
  });

  const docVariantIdToName = useMemo(() => {
    try {
      return Object.fromEntries((docVariants || []).map((v) => [v._id, v.docVariantName]));
    } catch {
      return {};
    }
  }, [docVariants]);

  const unitIdToName = useMemo(() => {
    try {
      return Object.fromEntries((units || []).map((u) => [u._id, u.unitName]));
    } catch {
      return {};
    }
  }, [units]);

  const normalizeDocument = useCallback((doc) => {
    const normalized = { ...doc };
    // Ensure files is array
    normalized.files = Array.isArray(doc.files) ? doc.files : [];
    // Normalize docVariant to object with docVariantName
    if (!normalized.docVariant || typeof normalized.docVariant !== "object") {
      let variantName = null;
      if (doc.docVariantName) variantName = doc.docVariantName;
      if (!variantName && typeof doc.docVariant === "string") {
        variantName = docVariantIdToName[doc.docVariant] || null;
      }
      if (!variantName && doc.docVariant && typeof doc.docVariant === "object") {
        variantName = doc.docVariant.docVariantName || null;
      }
      if (variantName) normalized.docVariant = { docVariantName: variantName };
    }
    // Normalize unit to object with unitName
    if (!normalized.unit || typeof normalized.unit !== "object") {
      let unitName = null;
      if (doc.unitName) unitName = doc.unitName;
      if (!unitName && typeof doc.unit === "string") {
        unitName = unitIdToName[doc.unit] || null;
      }
      if (!unitName && doc.unit && typeof doc.unit === "object") {
        unitName = doc.unit.unitName || null;
      }
      if (unitName) normalized.unit = { unitName };
    }
    return normalized;
  }, [docVariantIdToName, unitIdToName]);

  // Re-normalize when lookup maps are ready/updated to ensure names appear
  useEffect(() => {
    if (!documents || documents.length === 0) return;
    const renormalized = documents.map(normalizeDocument);
    setDocuments(renormalized);
    setDisplayedDocuments(renormalized);
  }, [docVariantIdToName, unitIdToName]);

  const fetchDocuments = useCallback(async (pageArg = 1, limitArg = 10) => {
    setLoading(true);
    try {
      const accessToken = Cookies.get("accessToken");
      if (!accessToken) {
        message.error("Không tìm thấy accessToken!");
        return;
      }

      let currentUserId = userId;
      let currentUserRole = userRole;
      if (!currentUserId || !currentUserRole) {
        const decodedToken = jwtDecode(accessToken);
        currentUserId = decodedToken?.userId;
        currentUserRole = decodedToken?.role;
        setUserId(currentUserId);
        setUserRole(currentUserRole);
      }

      if (!currentUserId) {
        message.error("Không tìm thấy userId trong token!");
        return;
      }

      // Fetch server-side paginated list (no filters)
      const response = await getAllDocumentsApi(currentUserId, pageArg, limitArg);
      if (response && response.success) {
        const pageDocs = (response.data || []).map(normalizeDocument);
        setDocuments(pageDocs);
        setFilteredDocuments(pageDocs);
        setDisplayedDocuments(pageDocs);
        setPagination((prev) => ({
          ...prev,
          total: Math.min(response.totalDocuments || pageDocs.length, 50),
        }));
      } else {
        message.error(response?.message || "Không thể lấy dữ liệu tài liệu");
        setDocuments([]);
        setFilteredDocuments([]);
        setDisplayedDocuments([]);
      }
    } catch (error) {
      message.error("Lỗi khi lấy dữ liệu tài liệu: " + error.message);
      setDocuments([]);
      setFilteredDocuments([]);
      setDisplayedDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [userId, userRole, normalizeDocument]);

  const applyFilters = useCallback(() => {
    let filtered = [...documents];

    const hasFilters = Object.values(filters).some((filter) => {
      if (Array.isArray(filter)) return filter[0] || filter[1];
      return filter !== null && filter !== undefined;
    });

    if (!hasFilters) {
      return filtered;
    }

    if (filters.year) {
      filtered = filtered.filter((doc) => {
        return (
          doc.year !== null &&
          doc.year !== undefined &&
          Number(doc.year) === Number(filters.year)
        );
      });
    }
    if (filters.docType) {
      filtered = filtered.filter((doc) => doc.docType === filters.docType);
    }
    if (filters.createAtRange[0] && filters.createAtRange[1]) {
      const startCreateAt = dayjs(filters.createAtRange[0]).startOf("day");
      const endCreateAt = dayjs(filters.createAtRange[1]).endOf("day");
      filtered = filtered.filter((doc) => {
        const createAt = doc.createAt ? dayjs(doc.createAt) : null;
        return (
          createAt &&
          createAt.isValid() &&
          !createAt.isBefore(startCreateAt) &&
          !createAt.isAfter(endCreateAt)
        );
      });
    }
    if (filters.deadlineRange[0] && filters.deadlineRange[1]) {
      const startDeadline = dayjs(filters.deadlineRange[0]).startOf("day");
      const endDeadline = dayjs(filters.deadlineRange[1]).endOf("day");
      filtered = filtered.filter((doc) => {
        const deadline = doc.deadlineDay ? dayjs(doc.deadlineDay) : null;
        return (
          deadline &&
          deadline.isValid() &&
          !deadline.isBefore(startDeadline) &&
          !deadline.isAfter(endDeadline)
        );
      });
    }
    if (filters.recipients.length > 0) {
      filtered = filtered.filter((doc) =>
        doc.assignedToUsers?.some((assign) =>
          filters.recipients.includes(assign.userId?._id || assign.userId)
        )
      );
    }
    if (filters.onTimeStatus) {
      filtered = filtered.filter((doc) => {
        const onTimeStatus = doc.assignedToUsers?.[0]?.onTime || doc.executors?.[0]?.onTime;
        return onTimeStatus === filters.onTimeStatus;
      });
    }
    if (filters.docVariant) {
      filtered = filtered.filter((doc) => doc.docVariant?._id === filters.docVariant);
    }

    return filtered;
  }, [documents, filters]);

  // Using server-side pagination; data is already paginated from API

  useEffect(() => {
    const accessToken = Cookies.get("accessToken");
    if (accessToken) {
      try {
        const decodedToken = jwtDecode(accessToken);
        setUserId(decodedToken?.userId);
        setUserRole(decodedToken.role);
      } catch (error) {
        console.error("Error decoding token:", error);
        message.error("Token không hợp lệ!");
      }
    }
    fetchUsers();
    fetchDepartments();
    fetchUnits();
    fetchDocVariants();
  }, []);

  const { current: paginationCurrent, pageSize: paginationPageSize } = pagination;
  useEffect(() => {
    if (userId) {
      fetchDocuments(paginationCurrent, paginationPageSize);
    }
  }, [fetchDocuments, userId, paginationCurrent, paginationPageSize]);

  useEffect(() => {
    const hasFilters = Object.values(filters).some((filter) => {
      if (Array.isArray(filter)) return filter[0] || filter[1];
      return filter !== null && filter !== undefined;
    });

    if (!hasFilters) {
      setDisplayedDocuments(documents);
    }
  }, [documents, filters]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params = {
        page: 1,
        limit: pagination.pageSize,
        docType: filters.docType || undefined,
        docVariant: filters.docVariant || undefined,
        year: filters.year || undefined,
        createFrom: filters.createAtRange?.[0] || undefined,
        createTo: filters.createAtRange?.[1] || undefined,
        deadlineFrom: filters.deadlineRange?.[0] || undefined,
        deadlineTo: filters.deadlineRange?.[1] || undefined,
      };

      // Constrain by current user for non-admin/manager views
      if (userRole !== "admin" && userRole !== "manager" && userId) {
        params.userId = userId;
      }

      const res = await searchDocumentsApi(params);
      if (res && (res.ok || res.success)) {
        const items = res.items || res.data || [];
        const pageDocs = items.map(normalizeDocument);
        setDocuments(pageDocs);
        setDisplayedDocuments(pageDocs);
        setPagination((prev) => ({
          ...prev,
          current: 1,
          total: res.total || res.totalDocuments || pageDocs.length,
        }));
      } else {
        setDocuments([]);
        setDisplayedDocuments([]);
        setPagination((prev) => ({ ...prev, current: 1, total: 0 }));
      }
    } catch (error) {
      message.error("Lỗi khi tìm kiếm: " + (error.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = async (paginationConfig, filtersFromTable) => {
    const newPagination = {
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize,
    };
    setPagination((prev) => ({ ...prev, ...newPagination }));

    // If filters are applied, keep using server-side search; else default list
    const hasFilters = Object.values(filters).some((filter) => {
      if (Array.isArray(filter)) return filter[0] || filter[1];
      return filter !== null && filter !== undefined;
    });

    setLoading(true);
    try {
      if (hasFilters) {
        const params = {
          page: newPagination.current,
          limit: newPagination.pageSize,
          docType: filters.docType || undefined,
          docVariant: filters.docVariant || undefined,
          year: filters.year || undefined,
          createFrom: filters.createAtRange?.[0] || undefined,
          createTo: filters.createAtRange?.[1] || undefined,
          deadlineFrom: filters.deadlineRange?.[0] || undefined,
          deadlineTo: filters.deadlineRange?.[1] || undefined,
        };
        if (userRole !== "admin" && userRole !== "manager" && userId) {
          params.userId = userId;
        }
        const res = await searchDocumentsApi(params);
        const items = res.items || res.data || [];
        const pageDocs = items.map(normalizeDocument);
        setDocuments(pageDocs);
        setDisplayedDocuments(pageDocs);
        setPagination((prev) => ({
          ...prev,
          total: res.total || res.totalDocuments || pageDocs.length,
        }));
      } else {
        const res = await getAllDocumentsApi(userId, newPagination.current, newPagination.pageSize);
        if (res && res.success) {
          const pageDocs = (res.data || []).map(normalizeDocument);
          setDocuments(pageDocs);
          setDisplayedDocuments(pageDocs);
          setPagination((prev) => ({ ...prev, total: Math.min(res.totalDocuments || pageDocs.length, 50) }));
        } else {
          setDocuments([]);
          setDisplayedDocuments([]);
          setPagination((prev) => ({ ...prev, total: 0 }));
        }
      }
    } catch (error) {
      message.error("Lỗi khi tải trang: " + (error.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setFilters({
      year: null,
      docType: null,
      createAtRange: [null, null],
      recipients: [],
      onTimeStatus: null,
      docVariant: null,
      deadlineRange: [null, null],
    });
    setPagination((prev) => ({ ...prev, current: 1 }));
    // Re-fetch default list
    fetchDocuments();
  };

  const fetchUsers = async () => {
    try {
      const response = await getAllUsers();
      setUsers(response.users || []);
    } catch (error) {
      message.error("Lỗi khi tải danh sách người dùng!");
      console.error("Error fetching users:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const result = await getAllDepartments();
      setDepartments(result.AllDepartment || []);
    } catch (error) {
      message.error("Lỗi khi lấy dữ liệu Đơn vị");
      console.error("Error fetching departments:", error);
    }
  };

  const fetchUnits = async () => {
    try {
      const result = await getAllUnits();
      setUnits(result || []);
    } catch (error) {
      message.error("Lỗi khi tải danh sách cơ quan ban hành!");
      console.error("Error fetching units:", error);
    }
  };

  const fetchDocVariants = async () => {
    try {
      const result = await getAllDocVariants();
      setDocVariants(result || []);
    } catch (error) {
      message.error("Lỗi khi tải danh sách loại văn bản!");
      console.error("Error fetching doc variants:", error);
    }
  };

  const handleExportExcel = async () => {
    if (displayedDocuments.length === 0) {
      message.warning("Vui lòng lọc dữ liệu trước khi xuất Excel!");
      return;
    }

    setLoading(true);
    try {
      const query = {
        year: filters.year || undefined,
        docType: filters.docType || undefined,
        fromDate: filters.createAtRange[0] || undefined,
        toDate: filters.createAtRange[1] || undefined,
        fromDeadline: filters.deadlineRange[0] || undefined,
        toDeadline: filters.deadlineRange[1] || undefined,
        executorId: filters.recipients.length > 0 ? filters.recipients[0] : undefined,
        onTimeStatus: filters.onTimeStatus || undefined,
        docVariant: filters.docVariant || undefined,
      };

      Object.keys(query).forEach((key) => query[key] === undefined && delete query[key]);

      if (userRole !== "admin" && userRole !== "manager" && userId) {
        query.userId = userId;
      }

      const response = await axiosInstance.get("/exports", {
        params: query,
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `bao-cao-van-ban-${dayjs().format("YYYY-MM-DD")}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success("Xuất file Excel thành công!");
    } catch (error) {
      message.error("Lỗi khi xuất file Excel: " + (error.response?.data?.message || error.message));
      console.error("Error exporting to Excel:", error);
    } finally {
      setLoading(false);
    }
  };

  const findExecutorName = useCallback(
    (executorId) => {
      if (!executorId) return "Không xác định";
      const user = users.find((user) => user._id === executorId);
      if (user) return user.name;
      const department = departments.find((dept) => dept._id === executorId);
      if (department) return department.departmentName;
      return "Không xác định";
    },
    [users, departments]
  );

  const handleRowClick = (record) => {
    try {
      setSelectedDocument(record);
      setIsModalVisible(true);
    } catch (error) {
      console.error("Error opening document details:", error);
      message.error("Không thể hiển thị chi tiết văn bản.");
    }
  };

  const truncateText = (text, maxLength = 50) => {
    if (!text) return "Không có";
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };

  const columns = [
    {
      title: "STT",
      dataIndex: "index",
      key: "index",
      render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
      width: 60,
    },
    {
      title: "SL phát hành",
      dataIndex: "numOfPages",
      key: "numOfPages",
      render: (numOfPages) => numOfPages || "N/A",
      width: 80,
    },
    ...(userRole !== "staff"
      ? [
          {
            title: "Kiểu văn bản",
            dataIndex: "docType",
            key: "docType",
            render: (docType) => (
              <Tag color={docType === "sent" ? "green" : "purple"}>
                {docType === "sent" ? "Văn bản đi" : "Văn bản đến"}
              </Tag>
            ),
            width: 120,
          },
        ]
      : []),
    {
      title: "Cơ quan ban hành",
      dataIndex: ["unit", "unitName"],
      key: "unit",
      render: (unitName) => unitName || "Trường",
      width: 150,
    },
    {
      title: "Thông tin văn bản",
      dataIndex: "title",
      key: "info",
      render: (title, record) => {
        const filteredAssignedToUsers = record.assignedToUsers?.filter((assignment) => assignment.onTime !== null) || [];
        const filteredExecutors = record.executors?.filter((executor) => executor.onTime !== null) || [];
        return (
          <div className="space-y-1 text-sm">
            {title && <strong className="text-base text-blue-700 block mb-1">{title}</strong>}
            <p className="text-gray-700">
              Số ký hiệu:{" "}
              <span className="font-semibold text-blue-600">
                {record.docNum || "N/A"}/{record.docCode || "N/A"}
              </span>
            </p>
            <p className="text-gray-700">
              Ngày văn bản:{" "}
              <span className="font-semibold">
                {record.createAt ? dayjs(record.createAt).format("DD/MM/YYYY") : "N/A"}
              </span>
            </p>
            <p className="text-gray-700">
              Ngày ban hành:{" "}
              <span className="font-semibold">
                {record.createdAt ? dayjs(record.createdAt).format("DD/MM/YYYY") : "N/A"}
              </span>
            </p>
            <p className="text-gray-700">
              Trích yếu:
              <span
                className="text-blue-500 hover:underline cursor-pointer font-semibold ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDocument(record);
                  Modal.info({
                    title: "Trích yếu",
                    content: <p className="whitespace-pre-wrap">{record.shortDescription || "Không có"}</p>,
                    okText: "Đóng",
                    centered: true,
                  });
                }}
              >
                {truncateText(record.shortDescription)}
              </span>
            </p>
            {record.principalIdea && (
              <p className="text-gray-700">
                Bút phê:
                <span
                  className="text-blue-500 hover:underline cursor-pointer font-semibold ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDocument(record);
                    setIsPrincipalIdeaModalVisible(true);
                  }}
                >
                  {truncateText(record.principalIdea)}
                </span>
              </p>
            )}
            <p className="text-gray-700">
              Người gửi: <span className="font-semibold">{record.sentBy?.name || "Không rõ"}</span>
            </p>
            <p className="text-gray-700">
              Người chủ trì:{" "}
              <span className="font-semibold">
                {filteredAssignedToUsers.length > 0
                  ? filteredAssignedToUsers
                      .map((assign) => findExecutorName(assign.userId?._id || assign.userId))
                      .join(", ") || "N/A"
                  : "N/A"}
              </span>
            </p>
            <p className="text-gray-700">
              Người nhận:{" "}
              <span className="font-semibold">
                {filteredExecutors.length > 0
                  ? filteredExecutors
                      .map((exec) => findExecutorName(exec.executorId))
                      .join(", ") || "N/A"
                  : "N/A"}
              </span>

            </p>
            {record.note && (
              <p className="text-gray-700">
                Ghi chú:
                <span
                  className="text-blue-500 hover:underline cursor-pointer font-semibold ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDocument(record);
                    setIsNoteModalVisible(true);
                  }}
                >
                  {truncateText(record.note)}
                </span>
              </p>
            )}
          </div>
        );
      },
    },
    {
      title: "Loại văn bản",
      dataIndex: ["docVariant", "docVariantName"],
      key: "docVariant",
      render: (docVariantName, record) => {
        const fallbackName =
          record?.docVariant?.docVariantName ||
          (typeof record?.docVariant === "string" ? docVariantIdToName[record.docVariant] : undefined) ||
          (record?.docVariant?._id ? docVariantIdToName[record.docVariant._id] : undefined) ||
          record?.docVariantName ||
          docVariantName;
        return fallbackName ? <Tag color="cyan">{fallbackName}</Tag> : "N/A";
      },
      width: 150,
    },
   
    {
      title: "Độ khẩn",
      dataIndex: "urgency",
      key: "urgency",
      render: (urgency) => {
        const urgencyMap = {
          normal: { color: "blue", label: "Bình thường" },
          high: { color: "orange", label: "Khẩn" },
          immediately: { color: "red", label: "Hỏa tốc" },
        };
        const { color, label } = urgencyMap[urgency] || { color: "default", label: "Không" };
        return <Tag color={color}>{label}</Tag>;
      },
      filters: [
        { text: "Bình thường", value: "normal" },
        { text: "Khẩn", value: "high" },
        { text: "Hỏa tốc", value: "immediately" },
      ],
      filteredValue: filters.urgency ? [filters.urgency] : null,
      filterMultiple: false,
      width: 120,
    },
    {
      title: "Tệp đính kèm",
      dataIndex: "files",
      key: "files",
      render: (files) =>
        files && files.length > 0 ? (
          <ul className="list-none p-0 m-0 space-y-1">
            {files.map((file) => (
              <li key={file.fileId}>
                <a
                  href={`https://drive.google.com/file/d/${file.fileId}/view?usp=sharing`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm break-all"
                >
                  {file.fileName}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          "Không có"
        ),
      width: 200,
    },
    {
      title: "Thao tác",
      key: "action",
      className: "action-col", fixed: "right",
      width: 120,
      render: (text, record) => (
        <div className="flex flex-col gap-2 items-center justify-center">
          <Tooltip title="Xem chi tiết">
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleRowClick(record);
              }}
              className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center"
            >
              <span className="hidden sm:inline text-xs">Xem chi tiết</span>
            </Button>
          </Tooltip>
        </div>
      ),
      
    },
  ];

  const disabledDate = (current) => {
    return current && (current < dayjs("1900-01-01") || current > dayjs().add(1, "year"));
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6">Báo cáo văn bản</h2>

      <Card className="mb-4 md:mb-6 p-3 md:p-4 shadow-sm rounded-lg border border-gray-200">
        <FilterFormWrapper onSearch={handleSearch}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 items-end">
          <InputNumber
            placeholder="Năm văn bản"
            value={filters.year}
            onChange={(value) => handleFilterChange("year", value)}
            className="w-full rounded-md"
            min={1900}
            max={dayjs().year() + 100}
            controls={false}
            style={{ width: "100%" }}
          />
          <RangePicker
            placeholder={["Ngày văn bản từ", "Đến ngày"]}
            value={
              filters.createAtRange[0] && filters.createAtRange[1]
                ? [dayjs(filters.createAtRange[0]), dayjs(filters.createAtRange[1])]
                : null
            }
            onChange={(dates) =>
              handleFilterChange(
                "createAtRange",
                dates ? [dates[0]?.format("YYYY-MM-DD"), dates[1]?.format("YYYY-MM-DD")] : [null, null]
              )
            }
            className="w-full rounded-md"
            format={dateFormat}
            allowClear
            disabledDate={disabledDate}
          />
          <RangePicker
            placeholder={["Hạn xử lý từ", "Đến ngày"]}
            value={
              filters.deadlineRange[0] && filters.deadlineRange[1]
                ? [dayjs(filters.deadlineRange[0]), dayjs(filters.deadlineRange[1])]
                : null
            }
            onChange={(dates) =>
              handleFilterChange(
                "deadlineRange",
                dates ? [dates[0]?.format("YYYY-MM-DD"), dates[1]?.format("YYYY-MM-DD")] : [null, null]
              )
            }
            className="w-full rounded-md"
            format={dateFormat}
            allowClear
            disabledDate={disabledDate}
          />
          <Select
            placeholder="Kiểu văn bản"
            value={filters.docType}
            onChange={(value) => handleFilterChange("docType", value)}
            allowClear
            className="w-full rounded-md"
          >
            <Option value="sent">Văn bản đi</Option>
            <Option value="received">Văn bản đến</Option>
          </Select>
          <Select
            placeholder="Loại văn bản"
            value={filters.docVariant}
            onChange={(value) => handleFilterChange("docVariant", value)}
            allowClear
            className="w-full rounded-md"
            showSearch
            filterOption={(input, option) =>
              (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
            }
          >
            {docVariants.map((variant) => (
              <Option key={variant._id} value={variant._id}>
                {variant.docVariantName}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="Đơn vị / Người nhận"
            value={filters.recipients}
            onChange={(value) => handleFilterChange("recipients", value)}
            mode="multiple"
            allowClear
            className="w-full rounded-md"
            maxTagCount="responsive"
            showSearch
            filterOption={(input, option) =>
              (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
            }
          >
            {users.map((user) => (
              <Option key={user._id} value={user._id}>
                {user.name}
              </Option>
            ))}
            {departments.map((dept) => (
              <Option key={dept._id} value={dept._id}>
                {dept.departmentName}
              </Option>
            ))}
          </Select>
         
          {/* <div className="flex  gap-2  justify-end"> */}
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} className="rounded-md">
              Tìm kiếm
            </Button>
            <Button type="default" icon={<ReloadOutlined />} onClick={handleResetFilters} className="rounded-md">
              Đặt lại
            </Button>
            <Button type="primary" icon={<FileExcelOutlined />} onClick={handleExportExcel} className="rounded-md">
              Xuất Excel
            </Button>
          </div>
        {/* </div> */}
        </FilterFormWrapper>
      </Card>

      <Spin spinning={loading} size="large" tip="Đang tải dữ liệu...">
        <Table
          columns={columns}
          dataSource={documents}
          rowKey="_id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} tài liệu`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          className="shadow-md rounded-lg overflow-hidden border border-gray-200"
          rowClassName="cursor-pointer hover:bg-gray-50 transition-colors duration-150"
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
          })}
        />
      </Spin>

      <Modal
        title={<span className="text-xl md:text-2xl font-bold text-gray-800">📄 Chi tiết văn bản</span>}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={900}
        className="rounded-lg"
        destroyOnClose
      >
        {selectedDocument ? (
          <div className="space-y-4 p-4">
            <Card size="small" className="border-gray-200 rounded-lg">
              <div className="flex justify-between items-center">
                <p className="text-gray-700 mb-0">
                  Kiểu văn bản: <Tag color="cyan">{selectedDocument.docVariant?.docVariantName || "N/A"}</Tag>
                </p>
          
              </div>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card size="small" className="border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2 border-b pb-1">Thông tin gửi/nhận</h3>
                <p>
                  <strong>Người gửi:</strong> {selectedDocument.sentBy?.name || "N/A"}
                </p>
                <p>
                  <strong>Người ký:</strong>{" "}
                  {selectedDocument.signer?.name ||
                    (typeof selectedDocument.signer === "string"
                      ? findExecutorName(selectedDocument.signer)
                      : "N/A")}
                </p>
                <p>
                  <strong>Chức vụ:</strong>{" "}
                  {selectedDocument.signer?.position?.positionName || selectedDocument.position?.positionName || "N/A"}
                </p>
                <p>
                  <strong>Đơn vị:</strong>{" "}
                  {selectedDocument.departments?.length > 0
                    ? selectedDocument.departments.map((dept) => dept.departmentName || "N/A").join(", ")
                    : "N/A"}
                </p>
                <p>
                  <strong>Người chủ trì:</strong>{" "}
                  {selectedDocument.assignedToUsers?.length > 0
                    ? selectedDocument.assignedToUsers
                        .filter((assign) => assign.onTime !== null)
                        .map((assign) => findExecutorName(assign.userId?._id || assign.userId))
                        .join(", ") || "N/A"
                    : "N/A"}
                </p>
                <p>
                  <strong>Người nhận:</strong>{" "}
                  {selectedDocument.executors?.length > 0
                    ? selectedDocument.executors
                        .filter((exec) => exec.onTime !== null)
                        .map((exec) => findExecutorName(exec.executorId))
                        .join(", ") || "N/A"
                    : "N/A"}
                </p>
              </Card>
              <Card size="small" className="border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2 border-b pb-1">Thông tin văn bản</h3>
                <p>
                  <strong>Số/Ký hiệu:</strong> {selectedDocument.docNum || "N/A"}/{selectedDocument.docCode || "N/A"}
                </p>
                <p>
                  <strong>Ngày văn bản:</strong>{" "}
                  {selectedDocument.createAt ? dayjs(selectedDocument.createAt).format("DD/MM/YYYY") : "N/A"}
                </p>
                <p>
                  <strong>Ngày ban hành:</strong>{" "}
                  {selectedDocument.createdAt ? dayjs(selectedDocument.createdAt).format("DD/MM/YYYY") : "N/A"}
                </p>
                {selectedDocument.docType === "received" && (
                  <p>
                    <strong>Ngày nhận văn bản:</strong>{" "}
                    {selectedDocument.receivedAt ? dayjs(selectedDocument.receivedAt).format("DD/MM/YYYY") : "N/A"}
                  </p>
                )}
                <p>
                  <strong>Hạn xử lý:</strong>{" "}
                  {selectedDocument.deadlineDay
                    ? dayjs(selectedDocument.deadlineDay).format("DD/MM/YYYY")
                    : "N/A"}
                </p>
                <p>
                  <strong>Số lượng phát hành:</strong> {selectedDocument.numOfPages || "N/A"}
                </p>
                <p>
                  <strong>Năm:</strong> {selectedDocument.year || "N/A"}
                </p>
              </Card>
            </div>
            <Card size="small" className="border-gray-200 rounded-lg">
              <h3 className="font-semibold text-gray-700 mb-2 border-b pb-1">Nội dung</h3>
              <p>
                <strong>Trích yếu:</strong> {selectedDocument.shortDescription || "Không có"}
              </p>
              <p>
                <strong>Bút phê:</strong> {selectedDocument.principalIdea || "Không có"}
              </p>
              <p>
                <strong>Ghi chú:</strong> {selectedDocument.note || "Không có"}
              </p>
            </Card>
            <Card size="small" className="border-gray-200 rounded-lg">
              <h3 className="font-semibold text-gray-700 mb-2 border-b pb-1">📎 Tệp đính kèm</h3>
              {selectedDocument.files && selectedDocument.files.length > 0 ? (
                <Table
                  dataSource={selectedDocument.files}
                  pagination={false}
                  rowKey="fileId"
                  size="small"
                  bordered
                  columns={[
                    {
                      title: 'STT',
                      key: 'stt',
                      render: (text, record, index) => index + 1,
                      width: 60,
                      align: 'center',
                    },
                    {
                      title: 'Tên tài liệu',
                      key: 'fileName',
                      render: (text, record) => {
                        const rawName = record.fileName || record.name || "File";
                        return (
                          <a
                            href={`https://drive.google.com/file/d/${record.fileId}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {rawName}
                          </a>
                        );
                      }
                    },
                    {
                      title: 'Thao tác',
                      key: 'action',
                      width: 150,
                      align: 'center',
                      render: (text, record) => {
                        return (
                          <div className="flex gap-2 justify-center">
                            <Button 
                              type="text" 
                              icon={<EyeOutlined className="text-green-600 text-lg" />} 
                              title="Xem file" 
                              onClick={() => window.open(`https://drive.google.com/file/d/${record.fileId}/view`)}
                            />
                            <Button 
                              type="text" 
                              icon={<DownloadOutlined className="text-blue-500 text-lg" />} 
                              title="Tải xuống"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = `https://drive.google.com/uc?export=download&id=${record.fileId}`;
                                link.setAttribute('download', '');
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                            />
                          </div>
                        );
                      }
                    }
                  ]}
                />
              ) : (
                <p>Không có tệp đính kèm.</p>
              )}
            </Card>
            <div className="text-right mt-4">
              <Button onClick={() => setIsModalVisible(false)} className="rounded-md">
                Đóng
              </Button>
            </div>
          </div>
        ) : (
          <p>Không có dữ liệu văn bản.</p>
        )}
      </Modal>

      <Modal
        title={<span className="text-lg font-bold text-gray-800">📝 Ghi chú</span>}
        open={isNoteModalVisible}
        onCancel={() => setIsNoteModalVisible(false)}
        footer={<Button onClick={() => setIsNoteModalVisible(false)} className="rounded-md">Đóng</Button>}
        width={600}
        className="rounded-lg"
      >
        {selectedDocument && (
          <p className="text-gray-700 whitespace-pre-wrap">{selectedDocument.note || "Không có ghi chú"}</p>
        )}
      </Modal>

      <Modal
        title={<span className="text-lg font-bold text-gray-800">💡 Ý kiến lãnh đạo</span>}
        open={isPrincipalIdeaModalVisible}
        onCancel={() => setIsPrincipalIdeaModalVisible(false)}
        footer={<Button onClick={() => setIsPrincipalIdeaModalVisible(false)} className="rounded-md">Đóng</Button>}
        width={600}
        className="rounded-lg"
      >
        {selectedDocument && (
          <p className="text-gray-700 whitespace-pre-wrap">{selectedDocument.principalIdea || "Không có bút phê"}</p>
        )}
      </Modal>
    </div>
  );
};

export default ReportPage;
