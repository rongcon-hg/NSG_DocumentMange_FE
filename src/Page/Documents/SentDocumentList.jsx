/* eslint-disable no-unused-vars */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  Spin,
  message,
  Modal,
  Card,
  Tag,
  Button,
  Popconfirm,
  Select,
  DatePicker,
  Input,
  InputNumber,
  Tooltip,
} from "antd";
import { EyeOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, DownloadOutlined } from "@ant-design/icons";
import {
  getAllDocuments as getAllDocumentsApi,
  searchDocuments as searchDocumentsApi,
  deleteDocument as deleteDocumentApi,
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
import { useNotificationContext } from "../../context/NotificationContext.jsx";
import FilterFormWrapper from "../../components/FilterFormWrapper.jsx";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Ho_Chi_Minh");

const { RangePicker } = DatePicker;
const { Option } = Select;
const dateFormat = "DD/MM/YYYY";

const SentDocumentList = () => {
  const { refetchNotificationCounts } = useNotificationContext();
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
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
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    keyword: "",
    recipients: [],
    deadlineRange: [null, null],
    createAtRange: [null, null],
    unit: null,
    urgency: null,
    year: null,
    docVariant: null,
  });

  // Function to populate document data with names from IDs
  const populateDocumentData = useCallback((doc) => {
    // Find docVariant name
    if (typeof doc.docVariant === 'string') {
      const variant = docVariants.find(v => v._id === doc.docVariant);
      doc.docVariant = variant ? { _id: doc.docVariant, docVariantName: variant.docVariantName } : { _id: doc.docVariant, docVariantName: 'Unknown' };
    } else if (doc.docVariant && typeof doc.docVariant === 'object') {
      // If docVariant is already an object, ensure it has docVariantName
      if (!doc.docVariant.docVariantName) {
        const variant = docVariants.find(v => v._id === doc.docVariant._id);
        if (variant) {
          doc.docVariant.docVariantName = variant.docVariantName;
        } else {
          doc.docVariant.docVariantName = 'Unknown';
        }
      }
    }

    // Find unit name
    if (typeof doc.unit === 'string') {
      const unit = units.find(u => u._id === doc.unit);
      doc.unit = unit ? { _id: doc.unit, unitName: unit.unitName } : { _id: doc.unit, unitName: 'Unknown' };
    } else if (doc.unit && typeof doc.unit === 'object') {
      // If unit is already an object, ensure it has unitName
      if (!doc.unit.unitName) {
        const unit = units.find(u => u._id === doc.unit._id);
        if (unit) {
          doc.unit.unitName = unit.unitName;
        } else {
          doc.unit.unitName = 'Unknown';
        }
      }
    }

    // Find sentBy name
    if (typeof doc.sentBy === 'string') {
      const user = users.find(u => u._id === doc.sentBy);
      doc.sentBy = user ? { _id: doc.sentBy, name: user.name } : { _id: doc.sentBy, name: 'Unknown' };
    }

    // Find signer name
    if (typeof doc.signer === 'string') {
      const user = users.find(u => u._id === doc.signer);
      doc.signer = user ? { _id: doc.signer, name: user.name } : { _id: doc.signer, name: 'Unknown' };
    }

    return doc;
  }, [users, docVariants, units]);

  // Load all documents without filtering (for initial load or when no filters applied)
  const fetchAllDocuments = useCallback(async (page = 1, pageSize = pagination.pageSize, currentFilterType = filterType) => {
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

      const apiParams = {};
      if (currentFilterType && currentFilterType !== "all") {
        apiParams.docType = currentFilterType;
      }
      const response = await getAllDocumentsApi(currentUserId, page, pageSize, apiParams);
      if (response && response.success) {
        const allDocs = (response.data || []).map((doc) => {
          const processedDoc = {
            ...doc,
            files: Array.isArray(doc.files) ? doc.files : [],
          };
          return populateDocumentData(processedDoc);
        });
        setDocuments(allDocs);
        setFilteredDocuments(allDocs);
        
        // Use actual total from API but limit display to 50 max
        const actualTotal = response.totalDocuments || 0;
        const maxTotal = Math.min(actualTotal, 50);
        
        setPagination((prev) => ({
          ...prev,
          total: maxTotal,
          current: page,
          pageSize: pageSize,
        }));
        
        // If we're trying to access beyond 50 documents, show warning
        if (actualTotal > 50 && page > Math.ceil(50 / pageSize)) {
          message.warning("Chỉ hiển thị 50 văn bản mới nhất. Dùng bộ lọc để xem tất cả văn bản.");
        }
      } else {
        message.error(response?.message || "Không thể lấy dữ liệu tài liệu");
        setDocuments([]);
        setFilteredDocuments([]);
      }
    } catch (error) {
      message.error("Lỗi khi lấy dữ liệu tài liệu: " + error.message);
      setDocuments([]);
      setFilteredDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [userId, userRole, pagination.pageSize, populateDocumentData, filterType]);

  // Search documents with filtering
  const fetchDocuments = useCallback(async (page = 1, pageSize = pagination.pageSize, searchFilters = filters, currentFilterType = filterType) => {
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

      // Build API parameters for searchDocuments API
      const apiParams = {
        page,
        limit: pageSize,
        sortBy: "createdAt",
        sortDir: "desc"
      };

      // Map frontend filters to searchDocuments API parameters
      if (searchFilters.keyword) {
        apiParams.keyword = searchFilters.keyword;
      }
      if (searchFilters.recipients && searchFilters.recipients.length > 0) {
        apiParams.executors = searchFilters.recipients.join(",");
      }
      if (searchFilters.year) {
        apiParams.year = searchFilters.year;
      }
      if (searchFilters.urgency) {
        apiParams.urgency = searchFilters.urgency;
      }
      if (searchFilters.docVariant) {
        apiParams.docVariant = searchFilters.docVariant;
      }
      if (searchFilters.deadlineRange[0] && searchFilters.deadlineRange[1]) {
        apiParams.deadlineFrom = searchFilters.deadlineRange[0];
        apiParams.deadlineTo = searchFilters.deadlineRange[1];
      }
      if (searchFilters.createAtRange[0] && searchFilters.createAtRange[1]) {
        apiParams.createFrom = searchFilters.createAtRange[0];
        apiParams.createTo = searchFilters.createAtRange[1];
      }
      if (searchFilters.unit) {
        apiParams.unit = searchFilters.unit;
      }
      if (currentFilterType && currentFilterType !== "all") {
        apiParams.docType = currentFilterType;
      }

      const response = await searchDocumentsApi(apiParams);
      if (response && response.ok) {
        const allDocs = (response.items || []).map((doc) => {
          const processedDoc = {
            ...doc,
            files: Array.isArray(doc.files) ? doc.files : [],
          };
          return populateDocumentData(processedDoc);
        });
        setDocuments(allDocs);
        setFilteredDocuments(allDocs);
        setPagination((prev) => ({
          ...prev,
          total: response.total || 0,
          current: page,
          pageSize: pageSize,
        }));
      } else {
        message.error(response?.message || "Không thể lấy dữ liệu tài liệu");
        setDocuments([]);
        setFilteredDocuments([]);
      }
    } catch (error) {
      message.error("Lỗi khi lấy dữ liệu tài liệu: " + error.message);
      setDocuments([]);
      setFilteredDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [userId, userRole, pagination.pageSize, filters, filterType, populateDocumentData]);

  // All filtering is now handled by API

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

  useEffect(() => {
    if (userId) {
      // Load all documents initially (no filters)
      fetchAllDocuments(1, pagination.pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    // Check if we have any active filters
    const hasActiveFilters = Object.values(filters).some(value => 
      value !== null && value !== undefined && value !== "" && 
      !(Array.isArray(value) && value.length === 0) &&
      !(Array.isArray(value) && value.every(v => v === null))
    ) || filterType !== "all";

    if (hasActiveFilters) {
      // Use search API if filters are active
      fetchDocuments(1, pagination.pageSize, filters, filterType);
    } else {
      // Use getAll API if no filters
      fetchAllDocuments(1, pagination.pageSize, filterType);
    }
  };

  const handleTableChange = (paginationConfig, filtersFromTable) => {
    const nextPage = paginationConfig.current || 1;
    const nextPageSize = paginationConfig.pageSize || pagination.pageSize;

    // Update filters for table filters (urgency, docType)
    const newFilters = {
      ...filters,
      urgency: filtersFromTable.urgency ? filtersFromTable.urgency[0] : null,
    };
    const newFilterType = filtersFromTable.docType ? filtersFromTable.docType[0] : "all";

    setFilters(newFilters);
    setFilterType(newFilterType);

    // Check if we have any active filters
    const hasActiveFilters = Object.values(newFilters).some(value => 
      value !== null && value !== undefined && value !== "" && 
      !(Array.isArray(value) && value.length === 0) &&
      !(Array.isArray(value) && value.every(v => v === null))
    ) || newFilterType !== "all";

    if (hasActiveFilters) {
      // Use search API if filters are active
      fetchDocuments(nextPage, nextPageSize, newFilters, newFilterType);
    } else {
      // Use getAll API if no filters
      fetchAllDocuments(nextPage, nextPageSize, newFilterType);
    }
  };

  const handleResetFilters = () => {
    const resetFilters = {
      keyword: "",
      recipients: [],
      deadlineRange: [null, null],
      createAtRange: [null, null],
      unit: null,
      urgency: null,
      year: null,
      docVariant: null,
    };
    setFilters(resetFilters);
    setFilterType("all");
    // Reset using getAllDocuments API (no filters)
    fetchAllDocuments(1, pagination.pageSize, "all");
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

  const handleEdit = (documentId) => {
    navigate(`/documents/edit/${documentId}`);
  };

  const handleDelete = async (documentId) => {
    try {
      const response = await deleteDocumentApi(documentId, userId);
      if (response.success) {
        message.success("Xóa văn bản thành công!");
        // Refresh data - check if we have active filters
        const hasActiveFilters = Object.values(filters).some(value => 
          value !== null && value !== undefined && value !== "" && 
          !(Array.isArray(value) && value.length === 0) &&
          !(Array.isArray(value) && value.every(v => v === null))
        );
        
        if (hasActiveFilters || filterType !== "all") {
          // Use search API if filters are active
          fetchDocuments(pagination.current, pagination.pageSize, filters, filterType);
        } else {
          // Use getAll API if no filters
          fetchAllDocuments(pagination.current, pagination.pageSize, filterType);
        }
        refetchNotificationCounts();
      } else {
        message.error(response.message || "Xóa văn bản thất bại!");
      }
    } catch (error) {
      message.error("Lỗi khi xóa văn bản: " + (error.response?.data?.message || error.message));
      console.error("Error deleting document:", error);
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
    ...(!["staff", "cappho", "chuyenvien"].includes(userRole)
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
          filters: [
            { text: "Văn bản đi", value: "sent" },
            { text: "Văn bản đến", value: "received" },
          ],
          filteredValue: filterType !== "all" ? [filterType] : null,
          filterMultiple: false, // Chỉ chọn một giá trị
          width: 120,
        },
      ]
      : []),
    {
      title: "Cơ quan ban hành",
      dataIndex: "unit",
      key: "unit",
      render: (unit) => {
        const unitName = typeof unit === 'object' ? unit?.unitName : unit;
        return unitName || "Trường";
      },
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
              Ngày hạn xử lý:{" "}
              <span className={`${!record.deadlineDay
                      ? " text-gray-500 font-bold"
                      : dayjs(record.deadlineDay).isBefore(dayjs(), 'day')
                        ? " text-red-500 font-bold"
                        : dayjs(record.deadlineDay).isSame(dayjs(), 'day')
                          ?  "text-blue-500 font-bold "
                          : "text-green-500 font-bold"
                    } `}>
                {record.deadlineDay ? dayjs(record.deadlineDay).format("DD/MM/YYYY") : "Không có"}
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
      dataIndex: "docVariant",
      key: "docVariant",
      render: (docVariant) => {
        const docVariantName = typeof docVariant === 'object' ? docVariant?.docVariantName : docVariant;
        return docVariantName ? <Tag color="cyan">{docVariantName}</Tag> : "N/A";
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
      filterMultiple: false, // Chỉ chọn một giá trị
      width: 120,
    },
    {
      title: "Tệp đính kèm",
      dataIndex: "files",
      key: "files",
      render: (files) =>
        files && files.length > 0 ? (
          <ul className="list-none p-0 m-0 space-y-1">
            {files.map((file, index) => (
              <li key={file.fileId}>
                <a
                  href={`https://drive.google.com/file/d/${file.fileId}/view?usp=sharing`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm break-all"
                >
                  {files.length > 1 ? `${index + 1}. ` : ""}{file.fileName}
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
      className: "action-col", fixed: "right", align: "center",
      render: (text, record) => {
        const currentUserId = userId;
        if (!currentUserId) return null;

        const isSender = (typeof record.sentBy === "object" ? record.sentBy?._id : record.sentBy) === currentUserId;
        const canEditDelete = userRole === "admin" || (isSender && !["staff", "cappho", "chuyenvien"].includes(userRole));

        return (
          <div className="flex flex-row flex-wrap sm:flex-col gap-2 items-center justify-center">
            <Tooltip title="Xem chi tiết">
              <Button
                type="primary"
                size="small"
                icon={<EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRowClick(record);
                }}
                className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center text-xs"
              >
                <span className="hidden sm:inline text-xs">Xem chi tiết</span>
              </Button>
            </Tooltip>
            {canEditDelete && (
              <Tooltip title="Cập nhật văn bản">
                <Button
                  type="default"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(record._id);
                  }}
                  className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center border-blue-500 text-blue-500 hover:bg-blue-50 text-xs"
                >
                  <span className="hidden sm:inline text-xs">Cập nhật</span>
                </Button>
              </Tooltip>
            )}
            {canEditDelete && (
              <Popconfirm
                title="Bạn chắc chắn muốn xóa?"
                onConfirm={(e) => {
                  e.stopPropagation();
                  handleDelete(record._id);
                }}
                onCancel={(e) => e?.stopPropagation?.()}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true, size: "small" }}
                cancelButtonProps={{ size: "small" }}
              >
                <Tooltip title="Xóa văn bản">
                  <Button
                    type="default"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center text-xs"
                  >
                    <span className="hidden sm:inline text-xs">Xóa</span>
                  </Button>
                </Tooltip>
              </Popconfirm>
            )}
          </div>
        );
      },
      width: window.innerWidth < 640 ? 100 : 130,
    },
  ];

  const disabledDate = (current) => {
    return current && (current < dayjs("1900-01-01") || current > dayjs().add(1, "year"));
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6">Danh sách văn bản</h2>

      <Card className="mb-4 md:mb-6 p-3 md:p-4 shadow-sm rounded-lg border border-gray-200">
        <FilterFormWrapper onSearch={handleSearch}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 md:gap-4 items-end">
          <Input
            placeholder="Từ khóa: Số/Ký hiệu, Trích yếu..."
            value={filters.keyword}
            onChange={(e) => handleFilterChange("keyword", e.target.value)}
            className="w-full rounded-md sm:col-span-2 lg:col-span-2"
            allowClear
          />
          <Select
            placeholder="Đơn vị/Người nhận"
            value={filters.recipients}
            onChange={(value) => handleFilterChange("recipients", value)}
            mode="multiple"
            allowClear
            className="w-full"
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
          <RangePicker
            placeholder={["Ngày văn bản từ", "đến"]}
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
            placeholder={["Ngày hạn xử lý từ", "đến"]}
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
          <InputNumber
            placeholder="Năm VB (VD: 2025)"
            value={filters.year}
            onChange={(value) => handleFilterChange("year", value)}
            className="w-full rounded-md"
            min={1900}
            max={dayjs().year() + 100}
            controls={false}
            style={{ width: "100%" }}
          />
          <Select
            placeholder="Loại văn bản"
            value={filters.docVariant}
            onChange={(value) => handleFilterChange("docVariant", value)}
            allowClear
            className="w-full"
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
          <div className="flex gap-2 col-span-full sm:col-span-1 justify-end">
            <Tooltip title="Lọc dữ liệu">
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} className="rounded-md">
                <span className="hidden sm:inline">Lọc</span>
              </Button>
            </Tooltip>
            <Tooltip title="Đặt lại bộ lọc">
              <Button type="default" icon={<ReloadOutlined />} onClick={handleResetFilters} className="rounded-md">
                <span className="hidden sm:inline">Đặt lại</span>
              </Button>
            </Tooltip>
          </div>
        </div>
        </FilterFormWrapper>
      </Card>

      <Spin spinning={loading} size="large" tip="Đang tải dữ liệu...">
        <Table
          columns={columns}
          dataSource={filteredDocuments}
          rowKey="_id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} tài liệu`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          sticky={{ offsetScroll: 0, getContainer: () => document.getElementById('main-scroll-container') }}
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
                  Loại văn bản: <Tag color="cyan">{selectedDocument.docVariant?.docVariantName || "N/A"}</Tag>
                </p>
                <p className="text-gray-700 mb-0">
                  Độ khẩn:
                  <Tag
                    color={
                      selectedDocument.urgency === "high"
                        ? "orange"
                        : selectedDocument.urgency === "immediately"
                          ? "red"
                          : selectedDocument.urgency === "normal"
                            ? "blue"
                            : "default"
                    }
                  >
                    {selectedDocument.urgency === "high"
                      ? "Khẩn"
                      : selectedDocument.urgency === "immediately"
                        ? "Hỏa tốc"
                        : selectedDocument.urgency === "normal"
                          ? "Bình thường"
                          : "Không"}
                  </Tag>
                </p>
              </div>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card size="small" className="border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2 border-b pb-1">Thông tin gửi/nhận</h3>
                <p>
                  <strong>Người gửi:</strong> {selectedDocument.sentBy?.name || "N/A"}
                </p>
                {selectedDocument.docType !== "received" && (
                  <>
                    <p>
                      <strong>Người ký:</strong>{" "}
                      {selectedDocument.signer?.name ||
                        (typeof selectedDocument.signer === "string"
                          ? findExecutorName(selectedDocument.signer)
                          : "N/A")}
                    </p>
                    <p>
                      <strong>Chức vụ:</strong>{" "}
                      {selectedDocument.position?.positionName ||
                        selectedDocument.signer?.position?.positionName ||
                        "N/A"}
                    </p>
                    <p>
                      <strong>Đơn vị:</strong>{" "}
                      {selectedDocument.departments?.length > 0
                        ? selectedDocument.departments
                          .map((dept) => dept.departmentName || "N/A")
                          .join(", ")
                        : "N/A"}
                    </p>
                  </>
                )}
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
                <p className={`${!selectedDocument.deadlineDay
                      ? " text-gray-500 font-bold"
                      : dayjs(selectedDocument.deadlineDay).isBefore(dayjs(), 'day')
                        ? " text-red-500 font-bold"
                        : dayjs(selectedDocument.deadlineDay).isSame(dayjs(), 'day')
                          ?  "text-blue-500 font-bold "
                          : "text-green-500 font-bold"
                    } `}>
                    <strong className="text-gray-700">Hạn xử lý:</strong>{" "}
                   {selectedDocument.deadlineDay
                      ? dayjs(selectedDocument.deadlineDay).format("DD/MM/YYYY")
                      : "Không có"}
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

export default SentDocumentList;
