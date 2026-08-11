import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  Button,
  message,
  Tag,
  Modal,
  Card,
  Input,
  InputNumber,
  DatePicker,
  Select,
  Badge,
  Spin,
  Tooltip,
} from "antd";
import axiosInstance from "../../api/axiosInstance";
import { EyeOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, SearchOutlined, ReloadOutlined, FileExcelOutlined, SendOutlined, FileDoneOutlined, DownloadOutlined } from "@ant-design/icons";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import moment from "moment";
import {
  fetchRepliedDocsByUserId,
  processRepliedDoc,
  getPendingRepliesListForRecipient,
  deleteRepliedDoc,
  searchRepliedDocs,
  sentToReview,
  fetchAllRepliedDocs,
} from "../../api/repliedDocApi";
import { formatFileName } from "../../utils/formatFileName";
import { getAllUsers, getUsersByDepartmentCode } from "../../api/auth";
import { getAllDocVariants } from "../../api/docVariantApi";
import { getAllDocuments, getDocumentById } from "../../api/documentApi";
import { useNotificationContext } from "../../context/NotificationContext.jsx";
import FilterFormWrapper from "../../components/FilterFormWrapper.jsx";

const RepliedDocList = () => {
  const { refetchNotificationCounts } = useNotificationContext();
  const [allRepliedDocs, setAllRepliedDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [additionalDataLoading, setAdditionalDataLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    pageSizeOptions: [10, 20, 50],
  });
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [users, setUsers] = useState([]);
  const [docVariants, setDocVariants] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [isReviewerModalVisible, setIsReviewerModalVisible] = useState(false);
  const [bghUsers, setBghUsers] = useState([]);
  const [selectedReviewer, setSelectedReviewer] = useState(null);
  const [docToReview, setDocToReview] = useState(null);
  const [loadingReviewer, setLoadingReviewer] = useState(false);
  const [searchParams, setSearchParams] = useState({
    soKyHieu: "",
    shortDescription: "",
    year: null,
    replyAtFrom: null,
    replyAtTo: null,
    deadlineFrom: null,
    deadlineTo: null,
    replyBy: null,
    status: null,
    docVariant: null,
  });
  const [isSearchMode, setIsSearchMode] = useState(false);
  const navigate = useNavigate();

  const isAdmin = useCallback(() => userRole === "admin" || userRole === "manager", [userRole]);
  const isSuperAdmin = useCallback(() => userRole === "admin", [userRole]);

  const fetchRepliedDocs = useCallback(async (page = 1, pageSize = 10) => {
    if (!userRole || !userId) return;
    setLoading(true);
    console.log("fetchRepliedDocs triggered:", { userEmail, userRole, userId, superAdmin: isSuperAdmin() });
    try {
      // Giới hạn tối đa 50 văn bản mới nhất
      const maxPageSize = Math.min(pageSize, 50);
      let response;
      if (isSuperAdmin()) {
        response = await fetchAllRepliedDocs(page, maxPageSize);
      } else if (isAdmin()) {
        response = await getPendingRepliesListForRecipient(userId, page, maxPageSize);
      } else {
        response = await fetchRepliedDocsByUserId(userId, page, maxPageSize);
      }
      const docs = response.data || [];
      // Giới hạn total không vượt quá 50 (hoặc lấy toàn bộ nếu là superAdmin)
      const total = isSuperAdmin() ? (response.total || 0) : Math.min(response.total || 0, 50);
      
      setAllRepliedDocs(docs);
      setPagination((prev) => ({ 
        ...prev, 
        current: page,
        pageSize: maxPageSize,
        total: total 
      }));
    } catch (error) {
      console.error("Error fetching replied docs:", error);
      message.error("Không thể tải danh sách văn bản!");
      setAllRepliedDocs([]);
      setPagination((prev) => ({ ...prev, total: 0 }));
    } finally {
      setLoading(false);
    }
  }, [userRole, userId, isAdmin, isSuperAdmin]);

  const fetchAdditionalData = useCallback(async () => {
    setAdditionalDataLoading(true);
    try {
      const [usersRes, docVariantsRes, documentsRes] = await Promise.all([
        getAllUsers(),
        getAllDocVariants(),
        getAllDocuments(userId),
      ]);
      setUsers(Array.isArray(usersRes) ? usersRes : (usersRes.users || []));
      setDocVariants(Array.isArray(docVariantsRes) ? docVariantsRes : (docVariantsRes.data || []));
      setDocuments(Array.isArray(documentsRes) ? documentsRes : (documentsRes.data || []));
    } catch (error) {
      console.error("Error fetching additional data:", error);
      message.error("Không thể tải dữ liệu bổ sung!");
    } finally {
      setAdditionalDataLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setUserRole(decodedToken.role);
        setUserId(decodedToken.userId);
        // Do not rely on email from token as it may not exist
      } catch (error) {
        console.error("Invalid token:", error);
        message.error("Token không hợp lệ. Vui lòng đăng nhập lại.");
      }
    } else {
      message.info("Vui lòng đăng nhập.");
    }
  }, [navigate]);

  useEffect(() => {
    if (userRole && userId) {
      fetchRepliedDocs(1, pagination.pageSize);
    }
  }, [userRole, userId, fetchRepliedDocs, pagination.pageSize]);

  useEffect(() => {
    if (userId) {
      fetchAdditionalData();
    }
  }, [userId, fetchAdditionalData]);

  // Removed userEmail fetch logic as it's no longer needed

  // Bổ sung: Tải các văn bản gốc bị thiếu theo ID để hiển thị "Số/Ký hiệu"
  useEffect(() => {
    if (!allRepliedDocs || allRepliedDocs.length === 0) return;
    const currentIds = new Set((documents || []).map((d) => d._id));
    const originalIds = Array.from(
      new Set(
        allRepliedDocs
          .map((rd) => (rd?.repliedDoc && typeof rd.repliedDoc === "object" ? rd.repliedDoc._id : rd?.repliedDoc))
          .filter((id) => !!id)
      )
    );
    const missingIds = originalIds.filter((id) => !currentIds.has(id));
    if (missingIds.length === 0) return;

    let isCancelled = false;
    setAdditionalDataLoading(true);
    Promise.all(
      missingIds.map((id) =>
        getDocumentById(id)
          .then((res) => (res && res.success ? res.data : null))
          .catch(() => null)
      )
    )
      .then((foundDocs) => {
        if (isCancelled) return;
        const validDocs = foundDocs.filter(Boolean);
        if (validDocs.length > 0) {
          setDocuments((prev) => {
            const map = new Map((prev || []).map((d) => [d._id, d]));
            validDocs.forEach((doc) => map.set(doc._id, doc));
            return Array.from(map.values());
          });
        }
      })
      .finally(() => {
        if (!isCancelled) setAdditionalDataLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [allRepliedDocs, documents]);

  const getUserName = useCallback(
    (user) => {
      if (!user) return "N/A";
      if (typeof user === "string") {
        const foundUser = users.find((u) => u._id === user);
        return foundUser ? foundUser.name : "Không xác định";
      }
      return user.name || "Không xác định";
    },
    [users]
  );

  const getDocVariantName = useCallback(
    (variant) => {
      if (!variant) return "N/A";
      if (typeof variant === "string") {
        const foundVariant = docVariants.find((v) => v._id === variant);
        return foundVariant ? foundVariant.docVariantName : "Không xác định";
      }
      return variant.docVariantName || "Không xác định";
    },
    [docVariants]
  );

  const getOriginalDocDetails = useMemo(() => {
    const docMap = new Map();
    documents.forEach((doc) => docMap.set(doc._id, doc));
    return (originalDocId) => {
      const foundDoc = docMap.get(originalDocId);
      return foundDoc || {
        docCode: "N/A",
        shortDescription: "Không tìm thấy",
        docNum: "",
        year: null,
        docVariant: null,
      };
    };
  }, [documents]);

  const getDocCodeAndNum = useCallback(
    (record) => {
      if (record?.repliedDoc) {
        const originalDoc = getOriginalDocDetails(record.repliedDoc._id || record.repliedDoc);
        const code = originalDoc.docCode || "N/A";
        const num = originalDoc.docNum || "";
        if (num && code !== "N/A") return `${num}/${code}`;
        if (code !== "N/A") return code;
        if (num) return String(num);
      }
      return "Không có";
    },
    [getOriginalDocDetails]
  );

  const getRepliedDocInfo = useCallback(
    (docId) => {
      const doc = getOriginalDocDetails(docId);
      return doc?.shortDescription || `văn bản ${getDocCodeAndNum({ repliedDoc: docId })}`;
    },
    [getOriginalDocDetails, getDocCodeAndNum]
  );

  const handleIssueDocument = useCallback(async (record) => {
    try {
      if (record.status !== "approved") {
        await processRepliedDoc(record._id, "approve");
        message.success("Đã chuyển trạng thái văn bản thành Đã chấp nhận");
      }
      navigate("/documents/create", {
        state: {
          shortDescription: record.shortDescription,
          files: record.files,
          signer: record.reviewer?._id || record.reviewer,
          repliedDocId: record._id,
        },
      });
    } catch (error) {
      message.error(error.message || "Lỗi khi cập nhật trạng thái văn bản");
    }
  }, [navigate]);

  const handleSearch = useCallback(async () => {
    if (!userRole || !userId) return;
    setLoading(true);
    setIsSearchMode(true);
    try {
      const searchQuery = {
        searchAs: isAdmin() ? "" : "user",
        userId: userId,
        ...searchParams,
        replyAtFrom: searchParams.replyAtFrom ? moment(searchParams.replyAtFrom).format("YYYY-MM-DD") : undefined,
        replyAtTo: searchParams.replyAtTo ? moment(searchParams.replyAtTo).format("YYYY-MM-DD") : undefined,
        deadlineFrom: searchParams.deadlineFrom ? moment(searchParams.deadlineFrom).format("YYYY-MM-DD") : undefined,
        deadlineTo: searchParams.deadlineTo ? moment(searchParams.deadlineTo).format("YYYY-MM-DD") : undefined,
      };
      
      // Loại bỏ các giá trị null/empty
      Object.keys(searchQuery).forEach(key => {
        if (searchQuery[key] === null || searchQuery[key] === "" || searchQuery[key] === undefined) {
          delete searchQuery[key];
        }
      });
      
      const response = await searchRepliedDocs(searchQuery);
      const docs = response.data || [];
      // Giới hạn kết quả tìm kiếm tối đa 50 văn bản
      const limitedDocs = docs.slice(0, 50);
      
      setAllRepliedDocs(limitedDocs);
      setPagination((prev) => ({
        ...prev,
        current: 1,
        total: limitedDocs.length
      }));
    } catch (error) {
      console.error("Error searching replied docs:", error);
      message.error("Không thể tìm kiếm văn bản!");
      setAllRepliedDocs([]);
      setPagination((prev) => ({ ...prev, total: 0 }));
    } finally {
      setLoading(false);
    }
  }, [userRole, userId, isAdmin, searchParams]);

  const handleResetSearch = useCallback(() => {
    setSearchParams({
      soKyHieu: "",
      shortDescription: "",
      year: null,
      replyAtFrom: null,
      replyAtTo: null,
      deadlineFrom: null,
      deadlineTo: null,
      replyBy: null,
      status: null,
      docVariant: null,
    });
    setIsSearchMode(false);
    fetchRepliedDocs(1, pagination.pageSize);
  }, [fetchRepliedDocs, pagination.pageSize]);

  const handleApprove = useCallback(async (repliedDocId) => {
    setLoading(true);
    try {
      await processRepliedDoc(repliedDocId, "approve");
      message.success("Đã phê duyệt văn bản thành công!");
      refetchNotificationCounts();
      if (!isSearchMode) {
        fetchRepliedDocs(pagination.current, pagination.pageSize);
      } else {
        handleSearch(); // Refresh search results
      }
    } catch (error) {
      message.error(error.message || "Lỗi khi phê duyệt văn bản!");
    } finally {
      setLoading(false);
    }
  }, [refetchNotificationCounts, fetchRepliedDocs, pagination, isSearchMode, handleSearch]);

  const handleOpenRejectModal = useCallback((repliedDocId) => {
    setSelectedDoc(allRepliedDocs.find((doc) => doc._id === repliedDocId));
    setIsRejectModalVisible(true);
  }, [allRepliedDocs]);

  const handleOpenDeleteModal = useCallback((e, repliedDocId) => {
    e.stopPropagation(); // Ngăn sự kiện lan tỏa lên phần tử cha (không mở chi tiết)
    setDocToDelete(repliedDocId);
    setIsDeleteModalVisible(true);
  }, []);

  const handleDelete = useCallback(async () => {
    try {
      await deleteRepliedDoc(docToDelete, userId);
      message.success("Đã xóa văn bản thành công!");
      setIsDeleteModalVisible(false);
      if (!isSearchMode) {
        fetchRepliedDocs(pagination.current, pagination.pageSize);
      } else {
        handleSearch(); // Refresh search results
      }
    } catch (error) {
      message.error(error.message || "Lỗi khi xóa văn bản!");
    }
  }, [docToDelete, userId, isSearchMode, fetchRepliedDocs, pagination, handleSearch]);

  const handleReject = useCallback(async () => {
    if (!rejectionReason) {
      message.error("Vui lòng nhập lý do từ chối!");
      return;
    }
    setLoading(true);
    try {
      await processRepliedDoc(selectedDoc._id, "reject", rejectionReason);
      message.success("Đã từ chối văn bản thành công!");
      setRejectionReason("");
      setIsRejectModalVisible(false);
      refetchNotificationCounts();
      if (!isSearchMode) {
        fetchRepliedDocs(pagination.current, pagination.pageSize);
      } else {
        handleSearch(); // Refresh search results
      }
    } catch (error) {
      message.error(error.message || "Lỗi khi từ chối văn bản!");
    } finally {
      setLoading(false);
    }
  }, [rejectionReason, selectedDoc, refetchNotificationCounts, isSearchMode, fetchRepliedDocs, pagination, handleSearch]);

  const handleViewDetail = useCallback((record) => {
    setSelectedDoc(record);
    setIsModalVisible(true);
  }, []);

  const handleOpenReviewerModal = useCallback(async (e, repliedDocId) => {
    e.stopPropagation();
    setDocToReview(repliedDocId);
    setSelectedReviewer(null);
    setIsReviewerModalVisible(true);
    setLoadingReviewer(true);
    try {
      const response = await getUsersByDepartmentCode("BGH");
      setBghUsers(response.users || []);
    } catch (error) {
      console.error("Error fetching BGH users:", error);
      message.error("Không thể tải danh sách người duyệt!");
      setIsReviewerModalVisible(false);
    } finally {
      setLoadingReviewer(false);
    }
  }, []);

  const handleConfirmReviewer = useCallback(async () => {
    if (!selectedReviewer) {
      message.error("Vui lòng chọn người duyệt!");
      return;
    }
    if (!docToReview) {
      message.error("Không tìm thấy văn bản!");
      return;
    }
    setLoadingReviewer(true);
    try {
      await sentToReview(docToReview, selectedReviewer);
      message.success("Đã gửi văn bản đến người duyệt thành công!");
      setIsReviewerModalVisible(false);
      setSelectedReviewer(null);
      setDocToReview(null);
      refetchNotificationCounts();
      if (!isSearchMode) {
        fetchRepliedDocs(pagination.current, pagination.pageSize);
      } else {
        handleSearch();
      }
    } catch (error) {
      message.error(error.message || "Lỗi khi gửi văn bản đến người duyệt!");
    } finally {
      setLoadingReviewer(false);
    }
  }, [selectedReviewer, docToReview, refetchNotificationCounts, isSearchMode, fetchRepliedDocs, pagination, handleSearch]);

  const handleTableChange = useCallback((paginationConfig) => {
    const nextCurrent = paginationConfig.current || 1;
    const nextPageSize = paginationConfig.pageSize || pagination.pageSize;

    setPagination((prev) => ({
      ...prev,
      current: nextCurrent,
      pageSize: nextPageSize,
    }));

    // Chỉ fetch lại dữ liệu nếu không đang ở search mode
    if (!isSearchMode) {
      fetchRepliedDocs(nextCurrent, nextPageSize);
    }
  }, [pagination.pageSize, isSearchMode, fetchRepliedDocs]);

  const columns = useMemo(
    () => [
      {
        title: "STT",
        key: "stt",
        render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
        width: 60,
        align: "center",
      },
      ...(isAdmin()
        ? [
            {
              title: "Người trình ký",
              dataIndex: "replyBy",
              key: "replyBy",
              render: (replyBy) => getUserName(replyBy),
              width: 150,
            },
          ]
        : [
            {
              title: "Đơn vị / Người nhận",
              dataIndex: "intendedRecipient",
              key: "intendedRecipient",
              render: (intendedRecipient) => {
                if (!Array.isArray(intendedRecipient) || intendedRecipient.length === 0) {
                  return "Không có";
                }
                return intendedRecipient
                  .map((recipient) => {
                    const userId =
                      typeof recipient === "object" && recipient !== null ? recipient._id : recipient;
                    return getUserName(userId);
                  })
                  .filter((name) => name && name !== "N/A" && !name.startsWith("ID:"))
                  .join(", ") || "Không có";
              },
              width: 150,
            },
          ]),
      {
        title: "Loại văn bản",
        dataIndex: "docVariant",
        key: "docVariant",
        render: (docVariant) => (
          <Tag color="cyan">
            {additionalDataLoading ? "Đang tải loại văn bản..." : getDocVariantName(docVariant) || "Không có dữ liệu"}
          </Tag>
        ),
        width: 150,
      },
      {
        title: "Số ký hiệu văn bản",
        key: "docCodeAndNum",
        render: (text, record) => getDocCodeAndNum(record),
        width: 150,
      },
      {
        title: "Trích yếu",
        dataIndex: "shortDescription",
        key: "shortDescription",
        ellipsis: true,
        render: (text) => {
          if (!text) return "Không có";
          return text.length > 50 ? `${text.substring(0, 50)}...` : text;
        },
      },
      {
        title: "Ngày trình ký",
        dataIndex: "replyAt",
        key: "replyAt",
        render: (date) => (date ? moment(date).format("DD/MM/YYYY HH:mm") : "N/A"),
        width: 150,
        align: "center",
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 150,
        align: "center",
        render: (_, record) => {
          let color = "blue",
            text = "Chờ gửi duyệt",
            time = null;
          // Kiểm tra theo thứ tự: approvedByReviewer, rejectedByReviewer, inReview, approved, rejected, pending
          if (record.status === "approvedByReviewer") {
            color = "green";
            text = "Đã duyệt (BGH)";
          } else if (record.status === "rejectedByReviewer") {
            color = "red";
            text = "Đã từ chối (BGH)";
          } else if (record.status === "inReview") {
            color = "orange";
            text = "Đang xét duyệt";
          } else if (record.status === "approved") {
            color = "green";
            text = "Đã chấp nhận";
            time = record.approvalTime;
          } else if (record.status === "rejected") {
            color = "red";
            text = "Đã từ chối";
            time = record.rejectionTime;
          } else if (record.status === "pending") {
            color = "blue";
            text = "Chờ gửi duyệt";
          }
          return (
            <div>
              <Tag color={color}>{text}</Tag>
              {time && (
                <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                  {moment(time).format("DD/MM/YYYY HH:mm")}
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: "Tệp đính kèm",
        key: "files",
        width: 200,
        render: (text, record) => {
          if (!record.files || !Array.isArray(record.files) || record.files.length === 0) {
            return <span className="text-gray-400">Không có</span>;
          }
          return (
            <div className="flex flex-col gap-2 mt-2">
              {record.files.slice(0, 2).map((file, index) => {
                const rawName = formatFileName(file.fileName || file.name || "File");
                return (
                  <div key={file.fileId || file._id || index} className="flex items-center p-1.5 bg-gray-50 border border-gray-200 rounded-md hover:bg-blue-50 transition-colors" style={{ maxWidth: "200px" }}>
                    <div className="flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      <a
                        href={`https://drive.google.com/file/d/${file.fileId || file._id}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-blue-600 hover:underline block truncate"
                        title={rawName}
                      >
                        {rawName}
                      </a>
                      <span className="text-[10px] text-gray-500 block truncate" title={`${file.uploadDate || file.uploadedAt ? moment(file.uploadDate || file.uploadedAt).format("DD/MM/YYYY HH:mm") : ""} - ${file.uploadedByName || "Người trình ký"}`}>
                        {file.uploadDate || file.uploadedAt ? moment(file.uploadDate || file.uploadedAt).format("DD/MM/YYYY HH:mm") : ""} - {file.uploadedByName || "Người trình ký"}
                      </span>
                    </div>
                  </div>
                );
              })}
              {record.files.length > 2 && (
                <span className="text-xs text-gray-500 ml-1">
                  +{record.files.length - 2} file khác
                </span>
              )}
            </div>
          );
        },
      },
      {
        title: "Thao tác",
        key: "action",
      className: "action-col", fixed: "right", align: "center",
      width: window.innerWidth < 640 ? 100 : 130,
        render: (text, record) => (
          <div className="flex flex-row flex-wrap sm:flex-col gap-2 items-center justify-center">
            <Tooltip title="Xem chi tiết">
              <Button
                size="small"
                type="primary"
                icon={<EyeOutlined />}
                onClick={() => handleViewDetail(record)}
                className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center text-xs"
              >
                <span className="hidden sm:inline text-xs">Xem chi tiết</span>
              </Button>
            </Tooltip>
            {userRole === "staff" && record.replyBy === userId && record.status !== "approved" && (
              <>
                <Tooltip title="Cập nhật lại">
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500 rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/repliedDocs/edit/${record._id}`);
                    }}
                  >
                    <span className="hidden sm:inline text-xs">Cập nhật lại</span>
                  </Button>
                </Tooltip>
                <Tooltip title="Xóa văn bản">
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center text-xs"
                    onClick={(e) => handleOpenDeleteModal(e, record._id)}
                  >
                    <span className="hidden sm:inline text-xs">Xóa</span>
                  </Button>
                </Tooltip>
              </>
            )}
            {(userRole === "manager" || userRole === "admin") && record.status !== "inReview" && record.status !== "approved" && record.status !== "rejected" && (
              <>
                <Tooltip title="Chấp nhận">
                  <Button
                    size="small"
                    icon={<CheckOutlined />}
                    className="bg-green-500 hover:bg-green-600 text-white border-green-500 rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(record._id);
                    }}
                    loading={loading && selectedDoc?._id === record._id}
                  >
                    <span className="hidden sm:inline text-xs">Chấp nhận</span>
                  </Button>
                </Tooltip>
                <Tooltip title="Từ chối">
                  <Button
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenRejectModal(record._id);
                    }}
                  >
                    <span className="hidden sm:inline text-xs">Từ chối</span>
                  </Button>
                </Tooltip>
              </>
            )}
            {userRole === "manager" && (record.status === "pending" || record.status === "rejectedByReviewer") && (
              <Tooltip title="Gửi duyệt">
                <Button
                  size="small"
                  type="primary"
                  icon={<SendOutlined />}
                  className="bg-amber-400 hover:bg-amber-500 text-white border-amber-400 rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center text-xs"
                  onClick={(e) => handleOpenReviewerModal(e, record._id)}
                >
                  <span className="hidden sm:inline text-xs">Gửi duyệt</span>
                </Button>
              </Tooltip>
            )}
            {(record.status === "approvedByReviewer" || record.status === "approved") && (userRole === "manager" || userRole === "admin") && !record.isIssued && (
              <Tooltip title="Ban hành VB">
                <Button
                  size="small"
                  type="default"
                  icon={<FileDoneOutlined />}
                  className="rounded-md max-sm:!w-8 max-sm:!h-8 max-sm:!p-0 sm:!w-[110px] flex items-center justify-center text-xs border-blue-500 text-blue-500 hover:bg-blue-50 mt-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleIssueDocument(record);
                  }}
                >
                  <span className="hidden sm:inline text-xs">Ban hành VB</span>
                </Button>
              </Tooltip>
            )}
          </div>
        ),
      },
    ],
    [
      userRole,
      userId,
      pagination,
      loading,
      selectedDoc,
      getUserName,
      getDocCodeAndNum,
      navigate,
      handleViewDetail,
      handleApprove,
      handleOpenRejectModal,
      getDocVariantName,
      additionalDataLoading,
      handleOpenDeleteModal,
      isAdmin,
      handleOpenReviewerModal,
      handleIssueDocument,
    ]
  );

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6">
        Danh sách văn bản trình ký
      </h2>

      {/* Search Form */}
      <Card className="mb-4 md:mb-6 p-3 md:p-4 shadow-sm rounded-lg border border-gray-200">
        <FilterFormWrapper onSearch={handleSearch}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 items-end">
          <Input
            placeholder="Số/Ký hiệu (VD: 63/KH-NSG)"
            value={searchParams.soKyHieu}
            onChange={(e) => setSearchParams(prev => ({ ...prev, soKyHieu: e.target.value }))}
            className="w-full rounded-md"
            allowClear
          />
          
          <Input
            placeholder="Trích yếu văn bản"
            value={searchParams.shortDescription}
            onChange={(e) => setSearchParams(prev => ({ ...prev, shortDescription: e.target.value }))}
            className="w-full rounded-md"
            allowClear
          />
          
          <InputNumber
            placeholder="Năm văn bản"
            value={searchParams.year}
            onChange={(value) => setSearchParams(prev => ({ ...prev, year: value }))}
            className="w-full rounded-md"
            min={1900}
            max={moment().year() + 5}
            controls={false}
            style={{ width: "100%" }}
          />
          
          <DatePicker.RangePicker
            placeholder={["Ngày trình từ", "đến"]}
            value={
              searchParams.replyAtFrom && searchParams.replyAtTo
                ? [moment(searchParams.replyAtFrom), moment(searchParams.replyAtTo)]
                : null
            }
            onChange={(dates) =>
              setSearchParams(prev => ({
                ...prev,
                replyAtFrom: dates ? dates[0]?.format("YYYY-MM-DD") : null,
                replyAtTo: dates ? dates[1]?.format("YYYY-MM-DD") : null,
              }))
            }
            className="w-full rounded-md"
            format="DD/MM/YYYY"
            allowClear
          />

      <DatePicker.RangePicker
        placeholder={["Hạn xử lý từ", "đến"]}
        value={
          searchParams.deadlineFrom && searchParams.deadlineTo
            ? [moment(searchParams.deadlineFrom), moment(searchParams.deadlineTo)]
            : null
        }
        onChange={(dates) =>
          setSearchParams(prev => ({
            ...prev,
            deadlineFrom: dates ? dates[0]?.format("YYYY-MM-DD") : null,
            deadlineTo: dates ? dates[1]?.format("YYYY-MM-DD") : null,
          }))
        }
        className="w-full rounded-md"
        format="DD/MM/YYYY"
        allowClear
      />
          
          <Select
            placeholder="Người trình ký"
            value={searchParams.replyBy}
            onChange={(value) => setSearchParams(prev => ({ ...prev, replyBy: value }))}
            className="w-full rounded-md"
            allowClear
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={users.map(user => ({
              value: user._id,
              label: user.name
            }))}
          />
          
          <Select
            placeholder="Trạng thái"
            value={searchParams.status}
            onChange={(value) => setSearchParams(prev => ({ ...prev, status: value }))}
            className="w-full rounded-md"
            allowClear
            options={[
              { value: "pending", label: "Chờ gửi duyệt" },
              { value: "approved", label: "Đã chấp nhận" },
              { value: "rejected", label: "Đã từ chối" },
              { value: "inReview", label: "Đang xét duyệt" },
              { value: "approvedByReviewer", label: "Đã duyệt (BGH)" },
              { value: "rejectedByReviewer", label: "Đã từ chối (BGH)" },
            ]}
          />
          
          <Select
            placeholder="Loại văn bản"
            value={searchParams.docVariant}
            onChange={(value) => setSearchParams(prev => ({ ...prev, docVariant: value }))}
            className="w-full rounded-md"
            allowClear
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={docVariants.map(variant => ({
              value: variant._id,
              label: variant.docVariantName
            }))}
          />
          
          <div className="flex gap-2 col-span-full justify-end">
            <Tooltip title="Tìm kiếm">
              <Button 
                type="primary" 
                icon={<SearchOutlined />} 
                onClick={handleSearch} 
                className="rounded-md"
                loading={loading}
              >
                <span className="hidden sm:inline">Tìm kiếm</span>
              </Button>
            </Tooltip>
            <Tooltip title="Đặt lại">
              <Button 
                type="default" 
                icon={<ReloadOutlined />} 
                onClick={handleResetSearch} 
                className="rounded-md"
              >
                <span className="hidden sm:inline">Đặt lại</span>
              </Button>
            </Tooltip>
          {isAdmin() && (
          <Tooltip title="Xuất Excel">
            <Button
              type="primary"
              icon={<FileExcelOutlined />}
              onClick={async () => {
                try {
                  setLoading(true);
                  const params = {
                    searchAs: isAdmin() ? "" : "user",
                    userId,
                    soKyHieu: searchParams.soKyHieu || undefined,
                    shortDescription: searchParams.shortDescription || undefined,
                    year: searchParams.year || undefined,
                    replyAtFrom: searchParams.replyAtFrom || undefined,
                    replyAtTo: searchParams.replyAtTo || undefined,
                    deadlineFrom: searchParams.deadlineFrom || undefined,
                    deadlineTo: searchParams.deadlineTo || undefined,
                    replyBy: searchParams.replyBy || undefined,
                    status: searchParams.status || undefined,
                    docVariant: searchParams.docVariant || undefined,
                  };
                  Object.keys(params).forEach((k) => params[k] === undefined && delete params[k]);
                  const res = await axiosInstance.get('/exports/repliedDocs', {
                    params,
                    responseType: 'blob',
                  });
                  const url = window.URL.createObjectURL(new Blob([res.data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `bao_cao_phan_hoi_${moment().format('YYYY-MM-DD')}.xlsx`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  window.URL.revokeObjectURL(url);
                  message.success('Xuất file Excel thành công!');
                } catch (err) {
                  message.error('Lỗi khi xuất Excel: ' + (err.message || ''));
                } finally {
                  setLoading(false);
                }
              }}
              className="rounded-md"
            >
              <span className="hidden sm:inline">Xuất Excel</span>
            </Button>
          </Tooltip>
          )}
          </div>
        </div>
        </FilterFormWrapper>
      </Card>

      <Spin spinning={loading || additionalDataLoading} size="large" tip="Đang tải dữ liệu...">
        <Table
          columns={columns}
          dataSource={allRepliedDocs}
          rowKey="_id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} văn bản (tối đa 50 văn bản mới nhất)`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          className="shadow-md rounded-lg overflow-hidden border border-gray-200"
          rowClassName="cursor-pointer hover:bg-gray-50 transition-colors duration-150"
          onRow={(record) => ({
            onClick: (e) => {
              if (e.target.tagName !== 'BUTTON' && 
                  !e.target.closest('button') && 
                  e.target.tagName !== 'A' && 
                  !e.target.closest('a')) {
                handleViewDetail(record);
              }
            },
          })}
        />
      </Spin>

      <Modal
        title={<span className="text-xl md:text-2xl font-bold text-gray-800">📄 Chi tiết văn bản trình ký</span>}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={900}
        className="rounded-lg"
        destroyOnClose
      >
        {selectedDoc ? (
          <div className="space-y-4 p-4">
            <Card size="small" className="border-gray-200 rounded-lg">
              <p>
                <strong>Loại văn bản:</strong>{" "}
                <Tag color="cyan">
                  {additionalDataLoading ? "Đang tải loại văn bản..." : getDocVariantName(selectedDoc.docVariant) || "Không có dữ liệu"}
                </Tag>
              </p>
              <p>
                <strong>Trích yếu văn bản:</strong>{" "}
                {getRepliedDocInfo(selectedDoc.repliedDoc?._id || selectedDoc.repliedDoc)}
              </p>
              <p>
                <strong>Số/Ký hiệu:</strong> {getDocCodeAndNum(selectedDoc)}
              </p>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card size="small" className="border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2 border-b pb-1">Thông tin trình ký</h3>
                <p>
                  <strong>Người trình ký:</strong> {getUserName(selectedDoc.replyBy)}
                </p>
                {selectedDoc.intendedRecipient && selectedDoc.intendedRecipient.length > 0 && (
                  <p>
                    <strong>Đơn vị/Người nhận:</strong>{" "}
                    {selectedDoc.intendedRecipient
                      .map((recipientId) => getUserName(recipientId))
                      .join(", ") || "Không có"}
                  </p>
                )}
              </Card>
              <Card size="small" className="border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2 border-b pb-1">Thời gian</h3>
                <p>
                  <strong>Ngày trình ký:</strong>{" "}
                  {selectedDoc.replyAt ? moment(selectedDoc.replyAt).format("DD/MM/YYYY HH:mm") : "N/A"}
                </p>
                <p>
                  <strong>Ngày tạo phiếu:</strong>{" "}
                  {selectedDoc.createdAt
                    ? moment(selectedDoc.createdAt).format("DD/MM/YYYY HH:mm")
                    : "N/A"}
                </p>
                {selectedDoc.status === "approved" && selectedDoc.approvalTime && (
                  <p>
                    <strong>Ngày chấp nhận:</strong>{" "}
                    {moment(selectedDoc.approvalTime).format("DD/MM/YYYY HH:mm")}
                  </p>
                )}
                {selectedDoc.status === "rejected" && selectedDoc.rejectionTime && (
                  <p>
                    <strong>Ngày từ chối:</strong>{" "}
                    {moment(selectedDoc.rejectionTime).format("DD/MM/YYYY HH:mm")}
                  </p>
                )}
              </Card>
            </div>

            <Card size="small" className="border-gray-200 rounded-lg">
              <h3 className="font-semibold text-gray-700 mb-2 border-b pb-1">
                Trích yếu (tóm tắt nội dung trình ký)
              </h3>
              <p>{selectedDoc.shortDescription || "Không có"}</p>
            </Card>

            <Card size="small" className="border-gray-200 rounded-lg">
              <h3 className="font-semibold text-gray-700 mb-2 border-b pb-1">📎 Tệp đính kèm</h3>
              {selectedDoc.files && selectedDoc.files.length > 0 ? (
                <Table
                  dataSource={selectedDoc.files}
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

            <Card
              size="small"
              className={`border rounded ${
                selectedDoc.status === "approvedByReviewer" || selectedDoc.status === "approved"
                  ? "bg-green-50 border-green-300"
                  : selectedDoc.status === "rejectedByReviewer" || selectedDoc.status === "rejected"
                  ? "bg-red-50 border-red-300"
                  : selectedDoc.status === "inReview"
                  ? "bg-orange-50 border-orange-300"
                  : "bg-blue-50 border-blue-300"
              }`}
            >
              <p>
                <strong>Trạng thái:</strong>{" "}
                <Badge
                  color={
                    selectedDoc.status === "approvedByReviewer" || selectedDoc.status === "approved"
                      ? "green"
                      : selectedDoc.status === "rejectedByReviewer" || selectedDoc.status === "rejected"
                      ? "red"
                      : selectedDoc.status === "inReview"
                      ? "orange"
                      : "blue"
                  }
                  text={
                    selectedDoc.status === "approvedByReviewer"
                      ? "Đã duyệt (BGH)"
                      : selectedDoc.status === "rejectedByReviewer"
                      ? "Đã từ chối (BGH)"
                      : selectedDoc.status === "inReview"
                      ? "Đang xét duyệt"
                      : selectedDoc.status === "approved"
                      ? "Đã chấp nhận"
                      : selectedDoc.status === "rejected"
                      ? "Đã từ chối"
                      : "Chờ gửi duyệt"
                  }
                />
              </p>
              {(selectedDoc.status === "rejected" || selectedDoc.status === "rejectedByReviewer") && (selectedDoc.rejectionReason || selectedDoc.reviewerNotes) && (
                <p className="mt-2 text-red-700">
                  <strong>Lý do từ chối:</strong> {selectedDoc.rejectionReason || selectedDoc.reviewerNotes}
                </p>
              )}
            </Card>
            <div className="text-right mt-4">
              <Button onClick={() => setIsModalVisible(false)} className="rounded-md">
                Đóng
              </Button>
            </div>
          </div>
        ) : (
          <p>Không có dữ liệu để hiển thị.</p>
        )}
      </Modal>

      <Modal
        title={<span className="text-lg font-bold text-gray-800">Xác nhận từ chối văn bản</span>}
        open={isRejectModalVisible}
        onOk={handleReject}
        onCancel={() => setIsRejectModalVisible(false)}
        okText="Xác nhận từ chối"
        cancelText="Hủy bỏ"
        confirmLoading={loading}
        okButtonProps={{ danger: true }}
        className="rounded-lg"
        destroyOnClose
      >
        <p className="mb-2">Vui lòng nhập lý do từ chối văn bản:</p>
        <Input.TextArea
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="Lý do..."
          rows={4}
          required
        />
      </Modal>

      <Modal
        title={<span className="text-lg font-bold text-gray-800">Chọn người duyệt</span>}
        open={isReviewerModalVisible}
        onOk={handleConfirmReviewer}
        onCancel={() => {
          setIsReviewerModalVisible(false);
          setSelectedReviewer(null);
          setDocToReview(null);
        }}
        okText="Xác nhận"
        cancelText="Hủy bỏ"
        confirmLoading={loadingReviewer}
        className="rounded-lg"
        destroyOnClose
        width={600}
      >
        <Spin spinning={loadingReviewer}>
          <div className="mb-4">
            <p className="mb-2 text-gray-700">Vui lòng chọn người duyệt từ Ban Giám Hiệu:</p>
            <Select
              placeholder="Chọn người duyệt"
              value={selectedReviewer}
              onChange={(value) => setSelectedReviewer(value)}
              className="w-full rounded-md"
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={bghUsers.map(user => ({
                value: user._id,
                label: `${user.name}${user.position ? ` - ${user.position.positionName || ''}` : ''}${user.department ? ` (${user.department.departmentName || ''})` : ''}`
              }))}
            />
          </div>
          {bghUsers.length === 0 && !loadingReviewer && (
            <p className="text-gray-500 text-center py-4">Không có người duyệt nào trong Ban Giám Hiệu.</p>
          )}
        </Spin>
      </Modal>

      <Modal
        title={<span className="text-lg font-bold text-gray-800">Xác nhận xóa văn bản</span>}
        open={isDeleteModalVisible}
        onOk={handleDelete}
        onCancel={() => setIsDeleteModalVisible(false)}
        okText="Xác nhận xóa"
        cancelText="Hủy bỏ"
        okButtonProps={{ danger: true }}
        className="rounded-lg"
        destroyOnClose
      >
        <p>Bạn có chắc chắn muốn xóa văn bản này không?</p>
        <p>Thao tác này không thể hoàn tác.</p>
      </Modal>
    </div>
  );
};

export default RepliedDocList;
