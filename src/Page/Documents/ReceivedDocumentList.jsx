/* eslint-disable no-unused-vars */
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Table, Spin, message, Modal, Card, Tag, Button, Select, DatePicker, Input, InputNumber, Tooltip } from "antd";
import { EyeOutlined, CheckOutlined, MessageOutlined, SearchOutlined, ReloadOutlined, CalendarOutlined, DownloadOutlined } from "@ant-design/icons";
import {
  getDocumentsByAssignedTo as getDocumentsByAssignedToApi,
  searchDocuments as searchDocumentsApi,
  markAsRead as markAsReadApi,
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
import googleApi from "../../api/googleApi";
import FilterFormWrapper from "../../components/FilterFormWrapper.jsx";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Ho_Chi_Minh");

const { RangePicker } = DatePicker;
const { Option } = Select;
const dateFormat = "DD/MM/YYYY";

const ReceivedDocumentList = () => {
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
  const [docVariants, setDocVariants] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
  const [isPrincipalIdeaModalVisible, setIsPrincipalIdeaModalVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [addedToCalendar, setAddedToCalendar] = useState(new Set()); // Track which documents have been added to calendar
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    keyword: "",
    issuingUnit: undefined,
    deadlineRange: [null, null],
    createAtRange: [null, null],
    urgency: null,
    year: null,
    docVariant: null,
    isRead: null,
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

  const fetchDocuments = useCallback(async (page = 1, pageSize = pagination.pageSize) => {
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

      // Use pagination but limit total to 50 documents
      const response = await getDocumentsByAssignedToApi(currentUserId, page, pageSize, filters);

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
        setPagination((prev) => ({ ...prev, total: 0, current: 1 }));
      }
    } catch (error) {
      message.error("Lỗi khi lấy dữ liệu tài liệu: " + error.message);
      console.error("Error fetching documents:", error);
      setDocuments([]);
      setFilteredDocuments([]);
      setPagination((prev) => ({ ...prev, total: 0, current: 1 }));
    } finally {
      setLoading(false);
    }
  }, [userId, userRole, pagination.pageSize, filters, populateDocumentData]);

  // Search documents with API search
  const searchDocuments = useCallback(async (page = 1, pageSize = pagination.pageSize, searchFilters = filters) => {
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

      // Build API parameters for searchDocuments API with default status = "received"
      const apiParams = {
        userId: currentUserId,
        status: "received", // Default status for received documents
        page,
        limit: pageSize,
        sortBy: "createdAt",
        sortDir: "desc"
      };

      // Map frontend filters to searchDocuments API parameters
      if (searchFilters.keyword) {
        apiParams.keyword = searchFilters.keyword;
      }
      if (searchFilters.issuingUnit) {
        apiParams.unit = searchFilters.issuingUnit;
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
      if (searchFilters.issuingUnit) {
        apiParams.unit = searchFilters.issuingUnit;
      }
      if (searchFilters.isRead !== null) {
        apiParams.isRead = searchFilters.isRead.toString();
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
        setPagination((prev) => ({ ...prev, total: 0, current: 1 }));
      }
    } catch (error) {
      message.error("Lỗi khi lấy dữ liệu tài liệu: " + error.message);
      console.error("Error fetching documents:", error);
      setDocuments([]);
      setFilteredDocuments([]);
      setPagination((prev) => ({ ...prev, total: 0, current: 1 }));
    } finally {
      setLoading(false);
    }
  }, [userId, userRole, pagination.pageSize, filters, populateDocumentData]);


  // Server-side pagination - không cần client-side filtering
  // const applyFilters = useCallback(() => {
  //   ... (client-side filtering logic removed)
  // }, [documents, filters, userId]);

  // Server-side pagination - không cần client-side filtering
  // const filteredDocs = useMemo(() => {
  //   return applyFilters();
  // }, [applyFilters]);

  // useEffect(() => {
  //   setFilteredDocuments(filteredDocs);
  //   setPagination((prev) => ({ ...prev, total: filteredDocs.length }));
  // }, [filteredDocs]);

  // Server-side pagination - không cần client-side slicing

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
      fetchDocuments(1, pagination.pageSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    // Use API search with filters
    searchDocuments(1, pagination.pageSize, filters);
  };

  const handleResetFilters = () => {
    const resetFilters = {
      keyword: "",
      issuingUnit: undefined,
      deadlineRange: [null, null],
      createAtRange: [null, null],
      urgency: null,
      year: null,
      docVariant: null,
      isRead: null,
    };
    setFilters(resetFilters);
    // Use normal fetchDocuments (no filters)
    fetchDocuments(1, pagination.pageSize);
  };

  const handleTableChange = (paginationConfig, filtersFromTable) => {
    const nextPage = paginationConfig.current || 1;
    const nextPageSize = paginationConfig.pageSize || pagination.pageSize;

    // Update filters for table filters (urgency, isRead)
    const newFilters = {
      ...filters,
      urgency: filtersFromTable.urgency ? filtersFromTable.urgency[0] : null,
      isRead: filtersFromTable.isRead ? filtersFromTable.isRead[0] : null,
    };

    // Check if filters have changed
    const filtersChanged = 
      newFilters.urgency !== filters.urgency || 
      newFilters.isRead !== filters.isRead;

    setFilters(newFilters);

    // Check if we have any active filters
    const hasActiveFilters = Object.values(newFilters).some(value => 
      value !== null && value !== undefined && value !== "" && 
      !(Array.isArray(value) && value.length === 0) &&
      !(Array.isArray(value) && value.every(v => v === null))
    );

    // If filters changed, reset to page 1, otherwise use current page
    const targetPage = filtersChanged ? 1 : nextPage;

    if (hasActiveFilters) {
      // Use search API if filters are active
      searchDocuments(targetPage, nextPageSize, newFilters);
    } else {
      // Use normal fetchDocuments if no filters
      fetchDocuments(targetPage, nextPageSize);
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
    setSelectedDocument(record);
    setIsModalVisible(true);
    if (
      !record.assignedToUsers?.find(
        (assignment) => {
          if (!assignment || !assignment.userId) return false;
          return (typeof assignment.userId === "object" ? assignment.userId._id : assignment.userId) === userId;
        }
      )?.isRead
    ) {
      handleMarkAsRead(record._id);
    }
  };

  const handleMarkAsRead = async (documentId) => {
    try {
      const response = await markAsReadApi(userId, documentId);
      if (response.success) {
        message.success("Đánh dấu đã xem thành công!");
        // Refresh data using current filters
        const hasActiveFilters = Object.values(filters).some(value => 
          value !== null && value !== undefined && value !== "" && 
          !(Array.isArray(value) && value.length === 0) &&
          !(Array.isArray(value) && value.every(v => v === null))
        );
        
        if (hasActiveFilters) {
          // Use search API if filters are active
          searchDocuments(pagination.current, pagination.pageSize, filters);
        } else {
          // Use normal fetchDocuments if no filters
          fetchDocuments(pagination.current, pagination.pageSize);
        }
        refetchNotificationCounts();
      } else {
        message.error(response.message || "Đánh dấu đã xem thất bại!");
      }
    } catch (error) {
      message.error("Lỗi khi đánh dấu đã xem!");
      console.error("Error marking as read:", error);
    }
  };

  const handleReply = (document) => {
    navigate(`/replyDoc`, {
      state: { documentId: document._id, title: document.title, description: document.shortDescription },
    });
  };

  const handleAddToCalendar = async (document) => {
    try {
      if (!document.deadlineDay) {
        message.warning("Văn bản này không có hạn xử lý!");
        return;
      }

      const response = await googleApi.addCalendarEvent(document._id);
      if (response.eventId) {
        message.success("Đã thêm sự kiện vào Google Calendar thành công!");
        // Mark this document as added to calendar
        setAddedToCalendar(prev => new Set(prev).add(document._id));
      } else {
        message.error("Không thể thêm sự kiện vào lịch!");
      }
    } catch (error) {
      console.error("Error adding to calendar:", error);
      if (error.response?.status === 400) {
        message.error("Bạn chưa kết nối Google Calendar. Vui lòng ủy quyền trước!");
      } else {
        message.error("Lỗi khi thêm vào lịch: " + error.message);
      }
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
      render: (numOfPages) => numOfPages || "Không có",
      width: 80,
    },
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
        const filteredAssignedToUsers = record.assignedToUsers?.filter((assignment) => assignment && assignment.onTime !== null && assignment.userId) || [];
        return (
          <div className="space-y-1 text-sm">
            {title && <strong className="text-base text-blue-700 block mb-1">{title}</strong>}
            <p className="text-gray-700">
              Số ký hiệu:{" "}
              <span className="font-semibold text-blue-600">
                {record.docNum || "Không có"}/{record.docCode || "Không có"}
              </span>
            </p>
            <p className="text-gray-700">
              Ngày văn bản:{" "}
              <span className="font-semibold">
                {record.createAt ? dayjs(record.createAt).format("DD/MM/YYYY") : "Không có"}
              </span>
            </p>
            <p className="text-gray-700">
              Ngày ban hành:{" "}
              <span className="font-semibold">
                {record.createdAt ? dayjs(record.createdAt).format("DD/MM/YYYY") : "Không có"}
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
                    .map((assign) => {
                      if (!assign || !assign.userId) return "Không rõ";
                      return findExecutorName(assign.userId?._id || assign.userId);
                    })
                    .join(", ") || "Không có"
                  : "Không có"}
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
        return docVariantName ? <Tag color="cyan">{docVariantName}</Tag> : "Không có";
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
      title: "Trạng thái đọc",
      dataIndex: "isRead",
      key: "isRead",
      width: 150,
      align: "center",
      filterMultiple: false,
      render: (_, record) => {
        const userAssignment = record.assignedToUsers?.find(
          (assignment) => {
            if (!assignment.userId) return false;
            return (typeof assignment.userId === "object" ? assignment.userId._id : assignment.userId) === userId;
          }
        );
        let color = "red";
        let text = "Chưa xem";
        let time = null;

        if (userAssignment?.isRead) {
          color = "green";
          text = "Đã xem";
          time = userAssignment.receivedDate;
        }

        return (
          <div className="text-center">
            <Tag color={color}>{text}</Tag>
            {time && (
              <div className="text-gray-600 text-xs mt-1">
                {dayjs(time).format("DD/MM/YYYY HH:mm")}
              </div>
            )}
          </div>
        );
      },
      filters: [
        { text: "Đã xem", value: true },
        { text: "Chưa xem", value: false },
      ],
      filteredValue: filters.isRead !== null ? [filters.isRead] : null,
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
      width: 150,
    },
    {
      title: "Thao tác",
      key: "action",
      className: "action-col", fixed: "right", align: "center",
      render: (text, record) => {
        const currentUserId = userId;
        if (!currentUserId) return null;

        const userAssignment = record.assignedToUsers?.find(
          (assignment) => {
            if (!assignment || !assignment.userId) return false;
            return (typeof assignment.userId === "object" ? assignment.userId._id : assignment.userId) === currentUserId;
          }
        );
        const isRead = userAssignment?.isRead;
        const canReply = userAssignment?.onTime == "pending" && userAssignment?.onTime !== null ;
        const canAddToCalendar = canReply && record.deadlineDay; // Same condition as reply + has deadline
        // const isRepliedAndAccepted = record.userAssignment?.status === "received";

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
            {!isRead && (
              <Tooltip title="Đánh dấu đã xem">
                <Button
                  type="default"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAsRead(record._id);
                  }}
                  className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center border-green-500 text-green-500 hover:bg-green-50 text-xs"
                >
                  <span className="hidden sm:inline text-xs">Đã xem</span>
                </Button>
              </Tooltip>
            )}
            {canReply && (
              <Tooltip title="Trả lời văn bản">
                <Button
                  type="default"
                  size="small"
                  icon={<MessageOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReply(record);
                  }}
                  className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center border-blue-500 text-blue-500 hover:bg-blue-50 text-xs"
                >
                  <span className="hidden sm:inline text-xs">Trả lời</span>
                </Button>
              </Tooltip>
            )}
            {canAddToCalendar && !addedToCalendar.has(record._id) && !record.addedToCalendarBy?.includes(currentUserId) && (
                <Tooltip title="Thêm vào Google Calendar">
                  <Button
                    type="default"
                    size="small"
                    icon={<CalendarOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCalendar(record);
                    }}
                    className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center border-purple-500 text-purple-500 hover:bg-purple-50 text-xs"
                  >
                    <span className="hidden sm:inline text-xs">Thêm lịch</span>
                  </Button>
                </Tooltip>
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
            placeholder="Cơ quan ban hành"
            value={filters.issuingUnit}
            onChange={(value) => handleFilterChange("issuingUnit", value)}
            allowClear
            className="w-full"
            showSearch
            filterOption={(input, option) =>
              (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
            }
          >
            <Option value="Truong">Trường</Option>
            {units.map((unit) => (
              <Option key={unit._id} value={unit._id}>
                {unit.unitName}
              </Option>
            ))}
          </Select>
          <RangePicker
            placeholder={["Ngày VB từ", "đến"]}
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
            placeholder={["Hạn xử lý từ", "đến"]}
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

      {/* Modal definitions remain unchanged */}
      <Modal
        title={<span className="text-xl md:text-2xl font-bold text-gray-800">📄 Chi tiết văn bản</span>}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={900}
        className="rounded-lg"
        destroyOnClose
      >
        {selectedDocument && (
          <div className="space-y-4 p-4">
            <Card size="small" className="border-gray-200 rounded-lg">
              <div className="flex justify-between items-center">
                <p className="text-gray-700 mb-0">
                  Loại văn bản: <Tag color="cyan">{selectedDocument.docVariant?.docVariantName || "Không có"}</Tag>
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
                  <strong>Người gửi:</strong> {selectedDocument.sentBy?.name || "Không có"}
                </p>
                {selectedDocument.docType !== "received" && (
                  <>
                    <p>
                      <strong>Người ký:</strong>{" "}
                      {selectedDocument.signer?.name ||
                        (typeof selectedDocument.signer === "string"
                          ? findExecutorName(selectedDocument.signer)
                          : "Không có")}
                    </p>
                    <p>
                      <strong>Chức vụ:</strong>{" "}
                      {selectedDocument.position?.positionName ||
                        selectedDocument.signer?.position?.positionName ||
                        "Không có"}
                    </p>
                    <p>
                      <strong>Đơn vị:</strong>{" "}
                      {selectedDocument.departments?.length > 0
                        ? selectedDocument.departments
                          .map((dept) => dept.departmentName || "Không có")
                          .join(", ")
                        : "Không có"}
                    </p>
                  </>
                )}
                <p>
                  <strong>Người chủ trì:</strong>{" "}
                  {selectedDocument.assignedToUsers?.length > 0
                    ? selectedDocument.assignedToUsers
                      .filter((assign) => assign.onTime !== null)
                      .map((assign) => findExecutorName(assign.userId?._id || assign.userId))
                      .join(", ") || "Không có"
                    : "Không có"}
                </p>
                <p>
                  <strong>Người nhận:</strong>{" "}
                  {selectedDocument.executors?.map((exec) => findExecutorName(exec.executorId)).join(", ") || "Không có"}
                </p>
              </Card>
              <Card size="small" className="border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2 border-b pb-1">Thông tin văn bản</h3>
                <p>
                  <strong>Số/Ký hiệu:</strong> {selectedDocument.docNum || "Không có"}/{selectedDocument.docCode || "Không có"}
                </p>
                <p>
                  <strong>Ngày văn bản:</strong>{" "}
                  {selectedDocument.createAt ? dayjs(selectedDocument.createAt).format("DD/MM/YYYY") : "Không có"}
                </p>
                <p>
                  <strong>Ngày ban hành:</strong>{" "}
                  {selectedDocument.createdAt ? dayjs(selectedDocument.createdAt).format("DD/MM/YYYY") : "Không có"}
                </p>
               
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
                  <strong>Số lượng phát hành:</strong> {selectedDocument.numOfPages || "Không có"}
                </p>
                <p>
                  <strong>Năm:</strong> {selectedDocument.year || "Không có"}
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

export default ReceivedDocumentList;
