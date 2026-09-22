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
import { EyeOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, DownloadOutlined, FileExcelOutlined, QrcodeOutlined } from "@ant-design/icons";
import * as XLSX from "xlsx";
import {
  getAllDocuments as getAllDocumentsApi,
  searchDocuments as searchDocumentsApi,
  deleteDocument as deleteDocumentApi,
} from "../../api/documentApi";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { getAllPositions } from "../../api/PositionAPI";
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
import { categorizeUsers } from "../../utils/userClassification";
import AiDocumentSummarizer from "../../components/AiDocumentSummarizer";

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
  const [positions, setPositions] = useState([]);
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
    signer: null,
    deadlineRange: [null, null],
    createAtRange: [null, null],
    unit: null,
    urgency: null,
    year: null,
    docVariant: null,
  });

  // Danh sách người ký gom nhóm theo Ban Giám hiệu, Cấp trưởng và Cấp phó
  const signerGroups = useMemo(() => {
    const groups = categorizeUsers(users);
    const bghGroup = groups.find((g) => g.key === "bgh");
    const capTruongGroup = groups.find((g) => g.key === "capTruong");
    const capPhoGroup = groups.find((g) => g.key === "capPho");

    const result = [];
    if (bghGroup && bghGroup.users.length > 0) {
      result.push({
        key: "bgh",
        label: `Ban Giám hiệu (${bghGroup.users.length})`,
        users: bghGroup.users,
      });
    }
    if (capTruongGroup && capTruongGroup.users.length > 0) {
      result.push({
        key: "capTruong",
        label: `Cấp trưởng (${capTruongGroup.users.length})`,
        users: capTruongGroup.users,
      });
    }
    if (capPhoGroup && capPhoGroup.users.length > 0) {
      result.push({
        key: "capPho",
        label: `Cấp phó (${capPhoGroup.users.length})`,
        users: capPhoGroup.users,
      });
    }
    return result;
  }, [users]);

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

    // Find signer info
    let foundSignerUser = null;
    if (typeof doc.signer === 'string') {
      foundSignerUser = users.find(u => u._id === doc.signer);
      doc.signer = foundSignerUser
        ? {
            _id: doc.signer,
            name: foundSignerUser.name,
            position: foundSignerUser.position,
            department: foundSignerUser.department,
          }
        : { _id: doc.signer, name: 'Unknown' };
    } else if (doc.signer && typeof doc.signer === 'object') {
      const signerId = doc.signer._id || doc.signer.id;
      foundSignerUser = users.find(
        u => (signerId && u._id === signerId) || (doc.signer.name && u.name === doc.signer.name)
      );
      if (foundSignerUser) {
        doc.signer = {
          ...doc.signer,
          name: doc.signer.name || foundSignerUser.name,
          position: doc.signer.position || foundSignerUser.position,
          department: doc.signer.department || foundSignerUser.department,
        };
      }
    }

    // Populate position
    if (doc.position) {
      if (typeof doc.position === 'string') {
        const posObj = positions.find(p => String(p._id) === String(doc.position));
        if (posObj) {
          doc.position = { _id: doc.position, positionName: posObj.positionName || posObj.name };
        } else if (foundSignerUser?.position) {
          doc.position = foundSignerUser.position;
        }
      }
    } else if (foundSignerUser?.position) {
      doc.position = foundSignerUser.position;
    }

    // Populate departments
    if (Array.isArray(doc.departments) && doc.departments.length > 0) {
      doc.departments = doc.departments.map(dept => {
        if (dept && typeof dept === 'object' && dept.departmentName) return dept;
        const dId = typeof dept === 'object' ? dept?._id : dept;
        const foundD = departments.find(d => String(d._id) === String(dId));
        return foundD ? { _id: foundD._id, departmentName: foundD.departmentName } : dept;
      });
    } else if (foundSignerUser?.department) {
      doc.departments = [foundSignerUser.department];
    }

    return doc;
  }, [users, docVariants, units, positions, departments]);

  // Helper lấy Chức vụ của người ký hoặc của văn bản
  const getSignerPositionName = useCallback(
    (doc) => {
      if (!doc) return "N/A";

      // 1. Kiểm tra trực tiếp trên doc.position (nếu đã là object có positionName)
      if (doc.position && typeof doc.position === "object" && doc.position.positionName) {
        return doc.position.positionName;
      }

      // 2. Nếu doc.position là ID dạng string, tra cứu trong danh mục positions
      if (typeof doc.position === "string" && doc.position) {
        const foundPos = positions.find((p) => String(p._id) === String(doc.position));
        if (foundPos?.positionName) return foundPos.positionName;
        if (foundPos?.name) return foundPos.name;
      }

      // 3. Kiểm tra trên doc.signer (nếu doc.signer có position)
      if (doc.signer && typeof doc.signer === "object" && doc.signer.position) {
        if (typeof doc.signer.position === "object" && doc.signer.position.positionName) {
          return doc.signer.position.positionName;
        }
        if (typeof doc.signer.position === "string") {
          const foundPos = positions.find((p) => String(p._id) === String(doc.signer.position));
          if (foundPos?.positionName) return foundPos.positionName;
          if (foundPos?.name) return foundPos.name;
        }
      }

      // 4. Tra cứu thông tin người ký trong danh sách users
      const signerId = typeof doc.signer === "object" ? (doc.signer?._id || doc.signer?.id) : doc.signer;
      if (signerId) {
        const user = users.find((u) => String(u._id) === String(signerId));
        if (user?.position) {
          if (typeof user.position === "object" && user.position.positionName) {
            return user.position.positionName;
          }
          if (typeof user.position === "string") {
            const foundPos = positions.find((p) => String(p._id) === String(user.position));
            if (foundPos?.positionName) return foundPos.positionName;
            if (foundPos?.name) return foundPos.name;
          }
        }
      }

      // 5. Nếu doc.signer là chuỗi họ tên, tìm user theo tên
      const signerName = typeof doc.signer === "object" ? doc.signer?.name : (typeof doc.signer === "string" ? doc.signer : null);
      if (signerName) {
        const userByName = users.find((u) => u.name && u.name.trim().toLowerCase() === signerName.trim().toLowerCase());
        if (userByName?.position?.positionName) {
          return userByName.position.positionName;
        }
      }

      return "N/A";
    },
    [positions, users]
  );

  // Helper lấy Đơn vị của người ký hoặc của văn bản
  const getSignerDepartmentName = useCallback(
    (doc) => {
      if (!doc) return "N/A";

      const deptNames = [];

      // 1. Kiểm tra mảng doc.departments
      if (Array.isArray(doc.departments) && doc.departments.length > 0) {
        doc.departments.forEach((dept) => {
          if (dept && typeof dept === "object" && dept.departmentName) {
            deptNames.push(dept.departmentName);
          } else if (typeof dept === "string" || (dept && dept._id)) {
            const deptId = String(dept._id || dept);
            const foundDept = departments.find((d) => String(d._id) === deptId);
            if (foundDept?.departmentName) {
              deptNames.push(foundDept.departmentName);
            }
          }
        });
      }

      if (deptNames.length > 0) {
        return deptNames.join(", ");
      }

      // 2. Tra cứu đơn vị từ người ký
      const signerId = typeof doc.signer === "object" ? (doc.signer?._id || doc.signer?.id) : doc.signer;
      let signerUser = null;
      if (signerId) {
        signerUser = users.find((u) => String(u._id) === String(signerId));
      }
      if (!signerUser) {
        const signerName = typeof doc.signer === "object" ? doc.signer?.name : (typeof doc.signer === "string" ? doc.signer : null);
        if (signerName) {
          signerUser = users.find((u) => u.name && u.name.trim().toLowerCase() === signerName.trim().toLowerCase());
        }
      }

      if (signerUser?.department) {
        if (typeof signerUser.department === "object" && signerUser.department.departmentName) {
          return signerUser.department.departmentName;
        }
        if (typeof signerUser.department === "string") {
          const foundDept = departments.find((d) => String(d._id) === String(signerUser.department));
          if (foundDept?.departmentName) return foundDept.departmentName;
        }
      }

      if (doc.signer && typeof doc.signer === "object" && doc.signer.department) {
        if (typeof doc.signer.department === "object" && doc.signer.department.departmentName) {
          return doc.signer.department.departmentName;
        }
        if (typeof doc.signer.department === "string") {
          const foundDept = departments.find((d) => String(d._id) === String(doc.signer.department));
          if (foundDept?.departmentName) return foundDept.departmentName;
        }
      }

      return "N/A";
    },
    [departments, users]
  );

  // Helper lấy ID người ký từ document
  const extractSignerId = useCallback((doc) => {
    if (!doc || !doc.signer) return null;
    if (typeof doc.signer === "object") {
      return String(doc.signer._id || doc.signer.id || "");
    }
    return String(doc.signer);
  }, []);

  // Helper kiểm tra xem document có được ký bởi signer đang chọn không
  const isDocSignedBy = useCallback((doc, targetSignerId) => {
    if (!doc || !targetSignerId) return false;
    const docSignerId = extractSignerId(doc);
    if (docSignerId && String(docSignerId) === String(targetSignerId)) {
      return true;
    }
    const targetUser = users.find((u) => String(u._id) === String(targetSignerId));
    if (targetUser && targetUser.name) {
      const docSignerName = typeof doc.signer === "object" ? doc.signer?.name : (typeof doc.signer === "string" ? doc.signer : null);
      if (docSignerName && docSignerName.trim().toLowerCase() === targetUser.name.trim().toLowerCase()) {
        return true;
      }
    }
    return false;
  }, [extractSignerId, users]);

  // Load all documents without filtering (for initial load or when no filters applied)
  const fetchAllDocuments = useCallback(async (page = 1, pageSize = pagination.pageSize, currentFilterType = filterType) => {
    setLoading(true);
    try {
      const currentUserId = userId;
      if (!currentUserId) return;

      const apiParams = {};
      if (currentFilterType && currentFilterType !== "all") {
        apiParams.docType = currentFilterType;
      }
      const response = await getAllDocumentsApi(currentUserId, page, pageSize, apiParams);
      if (response && response.success) {
        let allDocs = (response.data || []).map((doc) => {
          const processedDoc = {
            ...doc,
            files: Array.isArray(doc.files) ? doc.files : [],
          };
          return populateDocumentData(processedDoc);
        });

        // Lọc an toàn phía client nếu có chọn Người ký
        if (filters.signer) {
          allDocs = allDocs.filter((doc) => isDocSignedBy(doc, filters.signer));
        }

        setDocuments(allDocs);
        setFilteredDocuments(allDocs);
        
        // Use actual total from API but limit display to 50 max
        const actualTotal = response.totalDocuments || 0;
        const maxTotal = filters.signer ? allDocs.length : Math.min(actualTotal, 50);
        
        setPagination((prev) => ({
          ...prev,
          total: maxTotal,
          current: page,
          pageSize: pageSize,
        }));
        
        // If we're trying to access beyond 50 documents, show warning
        if (!filters.signer && actualTotal > 50 && page > Math.ceil(50 / pageSize)) {
          message.warning("Chỉ hiển thị 50 văn bản mới nhất. Dùng bộ lọc để xem tất cả văn bản.");
        }
      } else {
        message.error(response.message || "Không thể tải danh sách văn bản!");
      }
    } catch (error) {
      message.error("Lỗi khi kết nối đến máy chủ!");
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, userRole, pagination.pageSize, populateDocumentData, filterType, filters.signer, isDocSignedBy]);

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

      const isSignerFiltered = Boolean(searchFilters.signer);

      // Build API parameters for searchDocuments API
      const apiParams = {
        page: isSignerFiltered ? 1 : page,
        limit: isSignerFiltered ? 500 : pageSize,
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
      if (searchFilters.signer) {
        apiParams.signer = searchFilters.signer;
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
        let allDocs = (response.items || []).map((doc) => {
          const processedDoc = {
            ...doc,
            files: Array.isArray(doc.files) ? doc.files : [],
          };
          return populateDocumentData(processedDoc);
        });

        // Lọc chặt chẽ phía client theo Người ký để triệt để loại bỏ văn bản không khớp
        if (searchFilters.signer) {
          allDocs = allDocs.filter((doc) => isDocSignedBy(doc, searchFilters.signer));
        }

        setDocuments(allDocs);
        setFilteredDocuments(allDocs);
        setPagination((prev) => ({
          ...prev,
          total: isSignerFiltered ? allDocs.length : (response.total || 0),
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
  }, [userId, userRole, pagination.pageSize, filters, filterType, populateDocumentData, isDocSignedBy]);

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
    fetchPositions();
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

  const handleFilterChange = (key, value, autoSearch = false) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    if (autoSearch) {
      const hasActiveFilters = Object.values(updated).some(val => 
        val !== null && val !== undefined && val !== "" && 
        !(Array.isArray(val) && val.length === 0) &&
        !(Array.isArray(val) && val.every(v => v === null))
      ) || filterType !== "all";

      if (hasActiveFilters) {
        fetchDocuments(1, pagination.pageSize, updated, filterType);
      } else {
        fetchAllDocuments(1, pagination.pageSize, filterType);
      }
    }
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
      signer: null,
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

  const [exporting, setExporting] = useState(false);

  // Xuất danh sách văn bản ra file Excel
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      message.loading({ content: "Đang chuẩn bị dữ liệu xuất Excel...", key: "export-excel", duration: 0 });

      let docsToExport = [];

      // Kiểm tra xem có đang dùng bộ lọc tìm kiếm hay không
      const hasActiveFilters = Object.values(filters).some(value => 
        value !== null && value !== undefined && value !== "" && 
        !(Array.isArray(value) && value.length === 0) &&
        !(Array.isArray(value) && value.every(v => v === null))
      ) || filterType !== "all";

      if (hasActiveFilters) {
        const apiParams = {
          page: 1,
          limit: 2000,
          sortBy: "createdAt",
          sortDir: "desc"
        };
        if (filters.keyword) apiParams.keyword = filters.keyword;
        if (filters.recipients && filters.recipients.length > 0) apiParams.executors = filters.recipients.join(",");
        if (filters.signer) apiParams.signer = filters.signer;
        if (filters.year) apiParams.year = filters.year;
        if (filters.urgency) apiParams.urgency = filters.urgency;
        if (filters.docVariant) apiParams.docVariant = filters.docVariant;
        if (filters.deadlineRange[0] && filters.deadlineRange[1]) {
          apiParams.deadlineFrom = filters.deadlineRange[0];
          apiParams.deadlineTo = filters.deadlineRange[1];
        }
        if (filters.createAtRange[0] && filters.createAtRange[1]) {
          apiParams.createFrom = filters.createAtRange[0];
          apiParams.createTo = filters.createAtRange[1];
        }
        if (filters.unit) apiParams.unit = filters.unit;
        if (filterType && filterType !== "all") apiParams.docType = filterType;

        const response = await searchDocumentsApi(apiParams);
        if (response && response.ok && Array.isArray(response.items)) {
          docsToExport = response.items.map(populateDocumentData);
        } else {
          docsToExport = filteredDocuments;
        }
      } else {
        if (pagination.total <= documents.length) {
          docsToExport = documents;
        } else {
          const currentUserId = userId;
          if (currentUserId) {
            const apiParams = {};
            if (filterType && filterType !== "all") apiParams.docType = filterType;
            const response = await getAllDocumentsApi(currentUserId, 1, 2000, apiParams);
            if (response && response.success && Array.isArray(response.data)) {
              docsToExport = response.data.map(populateDocumentData);
            } else {
              docsToExport = documents;
            }
          } else {
            docsToExport = documents;
          }
        }
      }

      if (filters.signer) {
        docsToExport = docsToExport.filter((doc) => isDocSignedBy(doc, filters.signer));
      }

      if (!docsToExport || docsToExport.length === 0) {
        message.warning({ content: "Không có dữ liệu văn bản để xuất Excel!", key: "export-excel" });
        return;
      }

      const urgencyMap = {
        normal: "Bình thường",
        high: "Khẩn",
        immediately: "Hỏa tốc",
      };

      const dataToExport = docsToExport.map((doc, idx) => {
        const unitName = typeof doc.unit === "object" ? doc.unit?.unitName : (doc.unit || "Trường");
        const docVariantName = typeof doc.docVariant === "object" ? doc.docVariant?.docVariantName : (doc.docVariant || "N/A");
        const signerName = doc.signer?.name || (typeof doc.signer === "string" ? findExecutorName(doc.signer) : "Không rõ");
        const signerPos = getSignerPositionName(doc);
        const signerDept = getSignerDepartmentName(doc);
        const senderName = doc.sentBy?.name || (typeof doc.sentBy === "string" ? findExecutorName(doc.sentBy) : "Không rõ");
        
        // Người chủ trì
        const assignedUsers = (doc.assignedToUsers || []).filter(a => a.onTime !== null);
        const mainAssignees = assignedUsers.length > 0 
          ? assignedUsers.map(a => findExecutorName(a.userId?._id || a.userId)).join(", ")
          : "N/A";

        // Đơn vị/Người nhận
        const recipientsList = (doc.executors || [])
          .map(e => findExecutorName(e.executorId?._id || e.executorId))
          .filter(Boolean)
          .join(", ");

        // Tệp đính kèm
        const fileNames = Array.isArray(doc.files) && doc.files.length > 0
          ? doc.files.map(f => f.fileName).join("; ")
          : "Không có";

        const fileLinks = Array.isArray(doc.files) && doc.files.length > 0
          ? doc.files.map(f => f.fileUrl || `https://drive.google.com/file/d/${f.fileId}/view`).join("; ")
          : "";

        return {
          "STT": idx + 1,
          "Số ký hiệu": `${doc.docNum || "N/A"}/${doc.docCode || "N/A"}`,
          "Trích yếu nội dung": doc.shortDescription || "",
          "Cơ quan ban hành": unitName,
          "Loại văn bản": docVariantName,
          "Người ký": signerName,
          "Chức vụ người ký": signerPos !== "N/A" ? signerPos : "",
          "Người gửi": senderName,
          "Người chủ trì": mainAssignees,
          "Đơn vị / Người nhận": recipientsList || "N/A",
          "Ngày văn bản": doc.createAt ? dayjs(doc.createAt).format("DD/MM/YYYY") : "",
          "Ngày ban hành": doc.createdAt ? dayjs(doc.createdAt).format("DD/MM/YYYY") : "",
          "Ngày hạn xử lý": doc.deadlineDay ? dayjs(doc.deadlineDay).format("DD/MM/YYYY") : "Không có",
          "Độ khẩn": urgencyMap[doc.urgency] || "Bình thường",
          "Bút phê": doc.principalIdea || "",
          "Ghi chú": doc.note || "",
          "Số lượng tệp": Array.isArray(doc.files) ? doc.files.length : 0,
          "Tên tệp đính kèm": fileNames,
          "Link tải tệp đính kèm": fileLinks,
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataToExport);

      ws["!cols"] = [
        { wch: 6 },   // STT
        { wch: 18 },  // Số ký hiệu
        { wch: 50 },  // Trích yếu
        { wch: 22 },  // Cơ quan ban hành
        { wch: 20 },  // Loại văn bản
        { wch: 24 },  // Người ký
        { wch: 22 },  // Chức vụ người ký
        { wch: 22 },  // Người gửi
        { wch: 26 },  // Người chủ trì
        { wch: 30 },  // Đơn vị/Người nhận
        { wch: 15 },  // Ngày văn bản
        { wch: 15 },  // Ngày ban hành
        { wch: 16 },  // Ngày hạn xử lý
        { wch: 14 },  // Độ khẩn
        { wch: 30 },  // Bút phê
        { wch: 30 },  // Ghi chú
        { wch: 14 },  // Số lượng tệp
        { wch: 35 },  // Tên tệp
        { wch: 45 },  // Link tệp
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Van_Ban");
      const fileName = `Danh_Sach_Van_Ban_${dayjs().format("DDMMYYYY_HHmm")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      message.success({ content: `Xuất thành công ${dataToExport.length} văn bản ra file Excel!`, key: "export-excel" });
    } catch (err) {
      console.error("Export Excel error:", err);
      message.error({ content: "Có lỗi xảy ra khi xuất file Excel: " + (err.message || err), key: "export-excel" });
    } finally {
      setExporting(false);
    }
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

  const fetchPositions = async () => {
    try {
      const result = await getAllPositions();
      const list = result?.AllPosition || result?.positions || (Array.isArray(result) ? result : []);
      setPositions(list);
    } catch (error) {
      console.warn("Lỗi khi tải danh sách chức vụ:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const result = await getAllDepartments();
      const list = (result.AllDepartment || []).filter(
        (d) => d && !d.departmentName?.toLowerCase().includes("giải thể")
      );
      setDepartments(list);
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
            {record.signer && (
              <p className="text-gray-700">
                Người ký:{" "}
                <span className="font-semibold text-blue-700">
                  {record.signer?.name || (typeof record.signer === "string" ? findExecutorName(record.signer) : "N/A")}
                </span>
                {getSignerPositionName(record) !== "N/A" && (
                  <span className="text-gray-500 text-xs ml-1">
                    ({getSignerPositionName(record)})
                  </span>
                )}
              </p>
            )}
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
                className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center text-xs !bg-blue-600 hover:!bg-blue-700 !border-blue-600 !text-white"
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
                  className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center border-blue-500 text-blue-600 hover:!bg-blue-50 hover:!border-blue-600 text-xs"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 m-0">Danh sách văn bản</h2>
        <Button
          type="primary"
          icon={<FileExcelOutlined />}
          onClick={handleExportExcel}
          loading={exporting}
          className="!bg-blue-600 hover:!bg-blue-700 !border-blue-600 !text-white hover:!text-white rounded-md flex items-center gap-1.5 shadow-sm font-medium self-start sm:self-auto"
        >
          Xuất Excel
        </Button>
      </div>

      <Card className="mb-4 md:mb-6 p-3 md:p-4 shadow-sm rounded-lg border border-gray-200">
        <FilterFormWrapper onSearch={handleSearch}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 md:gap-4 items-end">
          <Input
            placeholder="Từ khóa: Số/Ký hiệu, Trích yếu..."
            value={filters.keyword}
            onChange={(e) => handleFilterChange("keyword", e.target.value)}
            onPressEnter={handleSearch}
            className="w-full rounded-md"
            allowClear
          />
          <Select
            placeholder="Đơn vị/Người nhận"
            value={filters.recipients}
            onChange={(value) => handleFilterChange("recipients", value, true)}
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
          <Select
            placeholder="Người ký"
            value={filters.signer}
            onChange={(value) => handleFilterChange("signer", value, true)}
            allowClear
            className="w-full"
            showSearch
            optionFilterProp="label"
            filterOption={(input, option) =>
              (option?.label ?? option?.children ?? "")
                .toString()
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          >
            {signerGroups.map((group) => (
              <Select.OptGroup key={group.key} label={group.label}>
                {group.users.map((signer) => {
                  const posStr = signer.position?.positionName ? ` - ${signer.position.positionName}` : "";
                  const deptStr = signer.department?.departmentName ? ` (${signer.department.departmentName})` : "";
                  const labelStr = `${signer.name || ""}${posStr}${deptStr}`.trim();
                  return (
                    <Option key={signer._id} value={signer._id} label={labelStr}>
                      {signer.name}
                      {signer.position?.positionName && (
                        <span className="text-gray-400 text-xs ml-1">
                          - {signer.position.positionName}
                        </span>
                      )}
                    </Option>
                  );
                })}
              </Select.OptGroup>
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
                dates ? [dates[0]?.format("YYYY-MM-DD"), dates[1]?.format("YYYY-MM-DD")] : [null, null],
                true
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
                dates ? [dates[0]?.format("YYYY-MM-DD"), dates[1]?.format("YYYY-MM-DD")] : [null, null],
                true
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
            onChange={(value) => handleFilterChange("year", value, true)}
            onPressEnter={handleSearch}
            className="w-full rounded-md"
            min={1900}
            max={dayjs().year() + 100}
            controls={false}
            style={{ width: "100%" }}
          />
          <Select
            placeholder="Loại văn bản"
            value={filters.docVariant}
            onChange={(value) => handleFilterChange("docVariant", value, true)}
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
          <div className="flex gap-2 items-center justify-end w-full flex-wrap">
            <Tooltip title="Lọc dữ liệu">
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                className="!bg-blue-600 hover:!bg-blue-700 !border-blue-600 !text-white hover:!text-white rounded-md shadow-xs flex items-center gap-1 font-medium px-4"
              >
                <span>Lọc</span>
              </Button>
            </Tooltip>
            <Tooltip title="Đặt lại bộ lọc">
              <Button
                type="default"
                icon={<ReloadOutlined />}
                onClick={handleResetFilters}
                className="rounded-md border-gray-300 text-gray-700 hover:!text-blue-600 hover:!border-blue-500 hover:!bg-blue-50/50 flex items-center gap-1 font-medium px-3 transition-colors"
              >
                <span>Đặt lại</span>
              </Button>
            </Tooltip>
            <Tooltip title="Xuất dữ liệu theo bộ lọc ra file Excel">
              <Button
                type="primary"
                icon={<FileExcelOutlined />}
                onClick={handleExportExcel}
                loading={exporting}
                className="!bg-blue-600 hover:!bg-blue-700 !border-blue-600 !text-white hover:!text-white rounded-md shadow-xs flex items-center gap-1.5 font-medium px-3"
              >
                <span>Xuất Excel</span>
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
            showLessItems: true,
            responsive: true,
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
        title={<span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">📄 Chi tiết văn bản</span>}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={900}
        style={{ maxWidth: '95vw', top: 20 }}
        className="rounded-lg"
        destroyOnClose
      >
        {selectedDocument ? (
          <div className="space-y-4 p-1 sm:p-4 max-w-full overflow-hidden">
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
                      {getSignerPositionName(selectedDocument)}
                    </p>
                    <p>
                      <strong>Đơn vị:</strong>{" "}
                      {getSignerDepartmentName(selectedDocument)}
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

            {/* Trợ lý AI Tóm tắt văn bản thông minh */}
            <AiDocumentSummarizer document={selectedDocument} />

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

            {/* Chuỗi văn bản liên quan (Document Threading) */}
            {((selectedDocument.relatedDocuments && selectedDocument.relatedDocuments.length > 0) || selectedDocument.parentDocument) && (
              <Card size="small" className="border-indigo-200 bg-indigo-50/30 rounded-lg">
                <h3 className="font-semibold text-indigo-900 mb-2 border-b border-indigo-100 pb-1 flex items-center gap-1.5">
                  🔗 Chuỗi văn bản liên quan (Document Threading)
                </h3>
                {selectedDocument.parentDocument && (
                  <div className="mb-2 text-xs">
                    <span className="font-bold text-gray-700">Văn bản gốc / khởi nguồn: </span>
                    <a
                      href={`/documents/detail/${selectedDocument.parentDocument._id || selectedDocument.parentDocument}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 font-semibold hover:underline"
                    >
                      {selectedDocument.parentDocument.docCode || selectedDocument.parentDocument.docNum || "Xem văn bản gốc"}
                    </a>
                    {selectedDocument.parentDocument.shortDescription && (
                      <span className="text-gray-500 italic"> - {selectedDocument.parentDocument.shortDescription}</span>
                    )}
                  </div>
                )}
                {selectedDocument.relatedDocuments && selectedDocument.relatedDocuments.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-gray-700">Các văn bản trong cùng hồ sơ:</div>
                    <ul className="list-disc list-inside text-xs space-y-1 text-gray-700">
                      {selectedDocument.relatedDocuments.map((relDoc, idx) => {
                        const docId = relDoc._id || relDoc;
                        const label = relDoc.docCode || relDoc.docNum || `Văn bản liên kết #${idx + 1}`;
                        const desc = relDoc.shortDescription ? ` - ${relDoc.shortDescription}` : "";
                        return (
                          <li key={docId} className="truncate">
                            <a
                              href={`/documents/detail/${docId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 font-medium hover:underline"
                            >
                              📄 {label}
                            </a>
                            <span className="text-gray-500">{desc}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </Card>
            )}

            <Card size="small" className="border-gray-200 rounded-lg">
              <h3 className="font-semibold text-gray-700 mb-2 border-b pb-1">📎 Tệp đính kèm</h3>
              {selectedDocument.files && selectedDocument.files.length > 0 ? (
                <Table
                  dataSource={selectedDocument.files}
                  pagination={false}
                  rowKey="fileId"
                  size="small"
                  bordered
                  scroll={{ x: 'max-content' }}
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
                            style={{ minWidth: 200, wordBreak: 'break-word', display: 'inline-block' }}
                          >
                            {rawName}
                          </a>
                        );
                      }
                    },
                    {
                      title: 'Thao tác',
                      key: 'action',
                      width: 90,
                      fixed: 'right',
                      align: 'center',
                      render: (text, record) => {
                        return (
                          <div className="flex gap-2 justify-center">
                            <Button 
                              type="text" 
                              icon={<EyeOutlined className="text-blue-600 text-lg" />} 
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
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 mt-4 pt-2 border-t border-gray-100">
              {selectedDocument.verificationCode ? (
                <Button 
                  type="primary" 
                  icon={<QrcodeOutlined />} 
                  className="bg-emerald-600 hover:bg-emerald-500 border-emerald-500 rounded-md font-medium text-xs sm:text-sm h-auto py-1.5 px-3 whitespace-normal break-all text-left sm:text-center"
                  onClick={() => window.open(`/verify/${selectedDocument.verificationCode}`, '_blank')}
                >
                  Mã xác thực: {selectedDocument.verificationCode}
                </Button>
              ) : (
                <Button 
                  type="default" 
                  icon={<QrcodeOutlined />} 
                  className="rounded-md font-medium text-slate-600 hover:text-emerald-600 text-xs sm:text-sm h-auto py-1.5 px-3"
                  onClick={() => window.open(`/verify/${selectedDocument._id}`, '_blank')}
                >
                  Tra cứu văn bản gốc
                </Button>
              )}
              <Button onClick={() => setIsModalVisible(false)} className="rounded-md self-end sm:self-auto">
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
