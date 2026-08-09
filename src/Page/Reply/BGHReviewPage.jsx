import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table,
  Button,
  message,
  Tag,
  Modal,
  Card,
  Badge,
  Spin,
  Tooltip,
  Input,
  Select,
  DatePicker,
  Space,
  Row,
  Col,
  Upload,
  Typography,
} from "antd";
import { EyeOutlined, CheckOutlined, CloseOutlined, SearchOutlined, UploadOutlined, DeleteOutlined, FileDoneOutlined, InboxOutlined, FormOutlined, DownloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import moment from "moment";
import { getReviewedDocs, reviewerAction, updateRepliedDoc, getRepliedDocById, processRepliedDoc, signFile } from "../../api/repliedDocApi";
import { getUserInfo } from "../../api/auth";
import { getAllUsers } from "../../api/auth";
import { getAllDocVariants } from "../../api/docVariantApi";
import { getAllDocuments, getDocumentById } from "../../api/documentApi";
import { formatFileName } from "../../utils/formatFileName";

const { Title } = Typography;

const BGHReviewPage = () => {
  const [reviewedDocs, setReviewedDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [additionalDataLoading, setAdditionalDataLoading] = useState(false);
  const attemptedMissingIdsRef = useRef(new Set());
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    pageSizeOptions: [10, 20, 50, 100],
  });
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userDepartment, setUserDepartment] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [rejectingDocId, setRejectingDocId] = useState(null);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [users, setUsers] = useState([]);
  const [docVariants, setDocVariants] = useState([]);
  const [documents, setDocuments] = useState([]);
  const navigate = useNavigate();
  
  // Search filters
  const [searchFilters, setSearchFilters] = useState({
    generalSearch: "",
    docVariant: null,
    status: null,
    replyAtFrom: null,
    replyAtTo: dayjs().toDate(),
    reviewDateFrom: null,
    reviewDateTo: null,
  });
  
  // File upload for approval
  const [approvalFiles, setApprovalFiles] = useState([]);
  const [isApproveModalVisible, setIsApproveModalVisible] = useState(false);
  const [approvingDocId, setApprovingDocId] = useState(null);
  const [existingFiles, setExistingFiles] = useState([]);

  // Kiểm tra user có thuộc department BGH hoặc là manager/admin
  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        const currentUserId = decodedToken.userId;
        const role = decodedToken.role;
        setUserId(currentUserId);
        setUserRole(role);
        
        // Lấy thông tin user để kiểm tra department
        getUserInfo(currentUserId)
          .then((response) => {
            if (response.success && response.data) {
              const department = response.data.department;
              if (department && typeof department === "object") {
                const departmentCode = department.departmentCode;
                // Cho phép vào nếu: thuộc BGH (bất kỳ role nào) hoặc là manager/admin
                if (departmentCode === "BGH") {
                  setUserDepartment("BGH");
                } else if (role === "manager" || role === "admin") {
                  // Manager hoặc admin không phải BGH vẫn được vào
                  setUserDepartment("OTHER");
                } else {
                  // Staff không thuộc BGH thì không được vào
                  message.error("Bạn không có quyền truy cập trang này!");
                  navigate("/");
                }
              } else {
                // Nếu không có department
                if (role === "manager" || role === "admin") {
                  setUserDepartment("OTHER");
                } else {
                  message.error("Bạn không có quyền truy cập trang này!");
                  navigate("/");
                }
              }
            } else {
              // Nếu không lấy được thông tin
              if (role === "manager" || role === "admin") {
                setUserDepartment("OTHER");
              } else {
                message.error("Không thể lấy thông tin người dùng!");
                navigate("/");
              }
            }
          })
          .catch((error) => {
            console.error("Error fetching user info:", error);
            // Nếu lỗi nhưng là manager/admin, vẫn cho phép vào
            if (role === "manager" || role === "admin") {
              setUserDepartment("OTHER");
            } else {
              message.error("Không thể kiểm tra quyền truy cập!");
              navigate("/");
            }
          });
      } catch (error) {
        console.error("Invalid token:", error);
        message.error("Token không hợp lệ. Vui lòng đăng nhập lại.");
        navigate("/login");
      }
    } else {
      message.info("Vui lòng đăng nhập.");
      navigate("/login");
    }
  }, [navigate]);

  const fetchReviewedDocs = useCallback(async () => {
    if (!userId || !userDepartment) return;
    setLoading(true);
    try {
      // Nếu là BGH thì truyền userId, nếu không thì truyền null để gọi endpoint không có param reviewerUser
      const reviewerUserId = userDepartment === "BGH" ? userId : null;
      const response = await getReviewedDocs(reviewerUserId);
      if (response.success) {
        const docs = response.data || [];
        setReviewedDocs(docs);
        setPagination((prev) => ({
          ...prev,
          total: docs.length,
        }));
      } else {
        message.error(response.message || "Không thể tải danh sách văn bản!");
        setReviewedDocs([]);
      }
    } catch (error) {
      console.error("Error fetching reviewed docs:", error);
      message.error("Không thể tải danh sách văn bản!");
      setReviewedDocs([]);
    } finally {
      setLoading(false);
    }
  }, [userId, userDepartment]);

  const fetchAdditionalData = useCallback(async () => {
    setAdditionalDataLoading(true);
    try {
      const [usersRes, docVariantsRes, documentsRes] = await Promise.all([
        getAllUsers(),
        getAllDocVariants(),
        getAllDocuments(userId),
      ]);
      setUsers(usersRes.users || []);
      setDocVariants(docVariantsRes || []);
      setDocuments(documentsRes.data || []);
    } catch (error) {
      console.error("Error fetching additional data:", error);
      message.error("Không thể tải dữ liệu bổ sung!");
    } finally {
      setAdditionalDataLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId && userDepartment) {
      // Cho phép cả BGH và OTHER (manager) fetch dữ liệu
      fetchReviewedDocs();
      fetchAdditionalData();
    }
  }, [userId, userDepartment, fetchReviewedDocs, fetchAdditionalData]);

  // Bổ sung: Tải các văn bản gốc bị thiếu theo ID
  useEffect(() => {
    if (!reviewedDocs || reviewedDocs.length === 0) return;
    const currentIds = new Set((documents || []).map((d) => d._id));
    const originalIds = Array.from(
      new Set(
        reviewedDocs
          .map((rd) => {
            if (!rd?.repliedDoc) return null;
            if (typeof rd.repliedDoc === "object") {
              return rd.repliedDoc._id || rd.repliedDoc.id;
            }
            return rd.repliedDoc;
          })
          .filter((id) => !!id)
      )
    );
    const missingIds = originalIds.filter((id) => !currentIds.has(id) && !attemptedMissingIdsRef.current.has(id));
    if (missingIds.length === 0) return;

    missingIds.forEach(id => attemptedMissingIdsRef.current.add(id));

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
  }, [reviewedDocs, documents]);

  const getUserName = useCallback(
    (user) => {
      if (!user) return "N/A";
      if (typeof user === "string") {
        const foundUser = users.find((u) => u._id === user);
        return foundUser ? (foundUser.name || foundUser.email || "Không xác định") : "Không xác định";
      }
      // Nếu là object, ưu tiên name hoặc fullName, nếu không có thì dùng email
      if (typeof user === "object") {
        return user.name || user.fullName || user.email || "Không xác định";
      }
      return "Không xác định";
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
      // Nếu có repliedDoc (có thể là object hoặc string ID)
      if (record?.repliedDoc) {
        const originalDocId = typeof record.repliedDoc === "object" 
          ? record.repliedDoc._id || record.repliedDoc.id
          : record.repliedDoc;
        
        if (originalDocId) {
          const originalDoc = getOriginalDocDetails(originalDocId);
          const code = originalDoc.docCode || "N/A";
          const num = originalDoc.docNum || "";
          if (num && code !== "N/A") return `${num}/${code}`;
          if (code !== "N/A") return code;
          if (num) return String(num);
        }
      }
      return "Không có";
    },
    [getOriginalDocDetails]
  );

  const getDocumentAuthor = useCallback(
    (record) => {
      // Lấy người soạn thảo từ document gốc
      if (record?.repliedDoc) {
        const originalDocId = typeof record.repliedDoc === "object" 
          ? record.repliedDoc._id || record.repliedDoc.id
          : record.repliedDoc;
        
        if (originalDocId) {
          const originalDoc = getOriginalDocDetails(originalDocId);
          if (originalDoc?.sentBy) {
            return getUserName(originalDoc.sentBy);
          }
        }
      }
      if (record?.replyBy) {
        return getUserName(record.replyBy);
      }
      return "N/A";
    },
    [getOriginalDocDetails, getUserName]
  );

  const handleViewDetail = useCallback((record) => {
    setSelectedDoc(record);
    setIsModalVisible(true);
  }, []);

  const handleOpenApproveModal = useCallback(async (repliedDocId) => {
    setApprovingDocId(repliedDocId);
    setApprovalFiles([]);
    setIsApproveModalVisible(true);
    
    // Lấy thông tin document để hiển thị file đã có
    try {
      const docData = await getRepliedDocById(repliedDocId);
      if (docData && docData.files && docData.files.length > 0) {
        setExistingFiles(docData.files);
      } else {
        setExistingFiles([]);
      }
    } catch (error) {
      console.error("Error fetching document info:", error);
      setExistingFiles([]);
    }
  }, []);

  const handleApprove = useCallback(async () => {
    if (!approvingDocId) {
      message.error("Không tìm thấy văn bản!");
      return;
    }
    setLoading(true);
    try {
      // Nếu có file mới, cập nhật file (xóa file cũ, chỉ giữ file mới)
      if (approvalFiles.length > 0) {
        try {
          // Tạo FormData để update file
          const formData = new FormData();
          
          // Backend sẽ cập nhật và giữ lại những file có trong existingFiles
          formData.append('existingFiles', JSON.stringify(existingFiles));
          
          // Thêm file mới
          approvalFiles.forEach(file => {
            if (file.originFileObj) {
              formData.append("files", file.originFileObj, formatFileName(file.originFileObj.name || file.name || "upload"));
            }
          });
          
          // Gọi updateRepliedDoc để xóa file cũ và thêm file mới
          await updateRepliedDoc(approvingDocId, formData);
          message.success("Đã cập nhật file thành công!");
        } catch (error) {
          console.error("Error updating files:", error);
          message.warning("Có lỗi khi cập nhật file, nhưng sẽ tiếp tục duyệt văn bản...");
        }
      }
      
      // Sau đó gọi reviewerAction để duyệt
      const response = await reviewerAction(approvingDocId, "approvedByReviewer");
      if (response?.isSuccess !== false) {
        message.success("Đã duyệt văn bản thành công!");
        setIsApproveModalVisible(false);
        setApprovalFiles([]);
        setApprovingDocId(null);
        setExistingFiles([]);
        // Refresh lại danh sách để hiển thị ngày xét duyệt mới
        await fetchReviewedDocs();
        // Đóng modal nếu đang mở
        if (selectedDoc?._id === approvingDocId) {
          setIsModalVisible(false);
          setSelectedDoc(null);
        }
      } else {
        message.error(response.message || "Lỗi khi duyệt văn bản!");
      }
    } catch (error) {
      message.error(error.message || "Lỗi khi duyệt văn bản!");
    } finally {
      setLoading(false);
    }
  }, [approvingDocId, approvalFiles, fetchReviewedDocs, selectedDoc]);

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

  const handleOpenRejectModal = (id) => {
    setRejectingDocId(id);
    setReviewerNotes("");
    setIsRejectModalVisible(true);
  };

  const handleReject = useCallback(async () => {
    if (!reviewerNotes || reviewerNotes.trim() === "") {
      message.error("Vui lòng nhập lý do từ chối!");
      return;
    }
    if (!rejectingDocId) {
      message.error("Không tìm thấy văn bản!");
      return;
    }
    setLoading(true);
    try {
      const response = await reviewerAction(rejectingDocId, "rejectedByReviewer", reviewerNotes);
      if (response?.isSuccess !== false) {
        message.success("Đã từ chối văn bản thành công!");
        setIsRejectModalVisible(false);
        setReviewerNotes("");
        setRejectingDocId(null);
        // Refresh lại danh sách để hiển thị ngày từ chối mới
        await fetchReviewedDocs();
        // Đóng modal chi tiết nếu đang mở
        if (selectedDoc?._id === rejectingDocId) {
          setIsModalVisible(false);
          setSelectedDoc(null);
        }
      } else {
        message.error(response.message || "Lỗi khi từ chối văn bản!");
      }
    } catch (error) {
      message.error(error.message || "Lỗi khi từ chối văn bản!");
    } finally {
      setLoading(false);
    }
  }, [reviewerNotes, rejectingDocId, fetchReviewedDocs, selectedDoc]);

  const handleTableChange = useCallback((paginationConfig) => {
    setPagination((prev) => ({
      ...prev,
      current: paginationConfig.current || 1,
      pageSize: paginationConfig.pageSize || 10,
    }));
  }, []);

  // Reset pagination khi filter thay đổi
  useEffect(() => {
    setPagination((prev) => ({
      ...prev,
      current: 1,
    }));
  }, [searchFilters]);

  // Filter data based on search filters
  const filteredDocs = useMemo(() => {
    let filtered = [...reviewedDocs];

    if (searchFilters.generalSearch) {
      const searchTerm = searchFilters.generalSearch.toLowerCase();
      filtered = filtered.filter((doc) => {
        const replyByName = getUserName(doc.replyBy).toLowerCase();
        const codeAndNum = getDocCodeAndNum(doc).toLowerCase();
        const shortDesc = (doc.shortDescription || "").toLowerCase();
        return replyByName.includes(searchTerm) || codeAndNum.includes(searchTerm) || shortDesc.includes(searchTerm);
      });
    }

    if (searchFilters.docVariant) {
      filtered = filtered.filter((doc) => {
        const variantId = typeof doc.docVariant === "object" ? doc.docVariant?._id : doc.docVariant;
        return variantId === searchFilters.docVariant;
      });
    }

    if (searchFilters.status) {
      filtered = filtered.filter((doc) => doc.status === searchFilters.status);
    }

    // Filter theo ngày trình ký
    if (searchFilters.replyAtFrom || searchFilters.replyAtTo) {
      filtered = filtered.filter((doc) => {
        if (!doc.replyAt) return false;
        
        try {
          const docDate = dayjs(doc.replyAt).startOf("day");
          let isValid = true;
          
          if (searchFilters.replyAtFrom) {
            const fromDate = dayjs(searchFilters.replyAtFrom).startOf("day");
            isValid = isValid && (docDate.isAfter(fromDate) || docDate.isSame(fromDate));
          }
          
          if (searchFilters.replyAtTo) {
            const toDate = dayjs(searchFilters.replyAtTo).startOf("day");
            isValid = isValid && (docDate.isBefore(toDate) || docDate.isSame(toDate));
          }
          
          return isValid;
        } catch (error) {
          console.error("Error parsing date:", doc.replyAt, error);
          return false;
        }
      });
    }

    // Filter theo ngày xét duyệt
    if (searchFilters.reviewDateFrom || searchFilters.reviewDateTo) {
      filtered = filtered.filter((doc) => {
        const reviewDate = doc.reviewTime || doc.reviewRejectionTime;
        if (!reviewDate) return false;
        
        try {
          const docDate = dayjs(reviewDate).startOf("day");
          let isValid = true;
          
          if (searchFilters.reviewDateFrom) {
            const fromDate = dayjs(searchFilters.reviewDateFrom).startOf("day");
            isValid = isValid && (docDate.isAfter(fromDate) || docDate.isSame(fromDate));
          }
          
          if (searchFilters.reviewDateTo) {
            const toDate = dayjs(searchFilters.reviewDateTo).startOf("day");
            isValid = isValid && (docDate.isBefore(toDate) || docDate.isSame(toDate));
          }
          
          return isValid;
        } catch (error) {
          console.error("Error parsing review date:", reviewDate, error);
          return false;
        }
      });
    }

    // Sắp xếp theo thời gian: văn bản mới nhất hiển thị trước (giảm dần)
    filtered.sort((a, b) => {
      // Ưu tiên sắp xếp theo replyAt (ngày trình ký), nếu không có thì dùng createdAt
      const dateA = a.replyAt ? new Date(a.replyAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const dateB = b.replyAt ? new Date(b.replyAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return dateB - dateA; // Giảm dần (mới nhất trước)
    });

    return filtered;
  }, [reviewedDocs, searchFilters, getUserName, getDocCodeAndNum]);

  const handleResetSearch = useCallback(() => {
    setSearchFilters({
      generalSearch: "",
      docVariant: null,
      status: null,
      replyAtFrom: null,
      replyAtTo: dayjs().toDate(),
      reviewDateFrom: null,
      reviewDateTo: null,
    });
  }, []);

  const handleFileChange = useCallback((info) => {
    setApprovalFiles(info.fileList);
  }, []);

  const handleRemoveFile = useCallback((file) => {
    setApprovalFiles((prev) => prev.filter((item) => item.uid !== file.uid));
  }, []);

  const columns = useMemo(
    () => [
      {
        title: "STT",
        key: "stt",
        render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
        width: 60,
        align: "center",
      },
      {
        title: "Người trình ký",
        dataIndex: "replyBy",
        key: "replyBy",
        render: (replyBy) => getUserName(replyBy),
        width: 150,
      },
      {
        title: "Người soạn thảo",
        key: "documentAuthor",
        render: (text, record) => getDocumentAuthor(record),
        width: 150,
      },
      {
        title: "Loại văn bản",
        dataIndex: "docVariant",
        key: "docVariant",
        render: (docVariant) => (
          <Tag color="cyan">
            {additionalDataLoading ? "Đang tải..." : getDocVariantName(docVariant) || "N/A"}
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
        width: 200,
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
        title: "Ngày xét duyệt",
        key: "reviewDate",
        width: 150,
        align: "center",
        render: (text, record) => {
          // Nếu đã duyệt (approvedByReviewer) → hiển thị reviewTime
          if (record.status === "approvedByReviewer" && record.reviewTime) {
            return moment(record.reviewTime).format("DD/MM/YYYY HH:mm");
          }
          // Nếu đã từ chối (rejectedByReviewer) → hiển thị reviewRejectionTime
          if (record.status === "rejectedByReviewer" && record.reviewRejectionTime) {
            return moment(record.reviewRejectionTime).format("DD/MM/YYYY HH:mm");
          }
          // Nếu đã chấp nhận (approved) → hiển thị approvalTime hoặc reviewTime
          if (record.status === "approved") {
            const time = record.approvalTime || record.reviewTime;
            if (time) return moment(time).format("DD/MM/YYYY HH:mm");
          }
          // Nếu đã từ chối (rejected) → hiển thị rejectionTime hoặc reviewRejectionTime
          if (record.status === "rejected") {
            const time = record.rejectionTime || record.reviewRejectionTime;
            if (time) return moment(time).format("DD/MM/YYYY HH:mm");
          }
          return "N/A";
        },
      },
      {
        title: "Trạng thái",
        dataIndex: "status",
        key: "status",
        width: 150,
        align: "center",
        render: (_, record) => {
          let color = "blue",
            text = "Chờ chấp nhận";
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
          } else if (record.status === "rejected") {
            color = "red";
            text = "Đã từ chối";
          } else if (record.status === "pending") {
            color = "blue";
            text = "Chờ chấp nhận";
          }
          return <Tag color={color}>{text}</Tag>;
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
            <div className="flex flex-col gap-2">
              {record.files.slice(0, 2).map((file, index) => {
                const rawName = file.fileName || file.name || "File";
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
                      <span className="text-[10px] text-gray-500 block truncate" title={`${file.uploadDate ? moment(file.uploadDate).format("DD/MM/YYYY HH:mm") : ""} - ${file.uploadedByName || "Người trình ký"}`}>
                        {file.uploadDate ? moment(file.uploadDate).format("DD/MM/YYYY HH:mm") : ""} - {file.uploadedByName || "Người trình ký"}
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
        width: 200,
        fixed: "right",
        render: (text, record) => (
          <div className="flex flex-wrap gap-2 justify-center">
            <Tooltip title="Xem chi tiết">
              <Button
                size="small"
                type="primary"
                icon={<EyeOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewDetail(record);
                }}
                className="rounded-md text-xs"
              >
                <span className="hidden sm:inline text-xs">Xem chi tiết</span>
              </Button>
            </Tooltip>
            {(record.status === "inReview" || record.status === "pending") && userDepartment === "BGH" && (
              <>
                <Tooltip title="Duyệt">
                  <Button
                    size="small"
                    icon={<CheckOutlined />}
                    className="bg-green-500 hover:bg-green-600 text-white border-green-500 rounded-md text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenApproveModal(record._id);
                    }}
                    loading={loading && selectedDoc?._id === record._id}
                  >
                    <span className="hidden sm:inline text-xs">Duyệt</span>
                  </Button>
                </Tooltip>
                <Tooltip title="Từ chối">
                  <Button
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    className="rounded-md text-xs"
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
            {(record.status === "approvedByReviewer" || record.status === "approved") && (userRole === "manager" || userRole === "admin") && !record.isIssued && (
              <Tooltip title="Ban hành VB">
                <Button
                  size="small"
                  type="default"
                  icon={<FileDoneOutlined />}
                  className="rounded-md text-xs border-blue-500 text-blue-500 hover:bg-blue-50"
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
      pagination,
      getUserName,
      getDocVariantName,
      getDocCodeAndNum,
      getDocumentAuthor,
      handleViewDetail,
      additionalDataLoading,
      loading,
      selectedDoc,
      handleOpenApproveModal,
      handleOpenRejectModal,
      userDepartment,
      userRole,
    ]
  );

  // Cho phép tất cả user có userDepartment (BGH hoặc OTHER) truy cập
  if (!userDepartment) {
    return null;
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-4 md:mb-6">
        Ban Giám Hiệu Xét duyệt
      </h2>

      {/* Search Bar */}
      <Card className="mb-4 shadow-sm">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={16} lg={12}>
            <Input
              placeholder="Tìm chung (Người trình ký, số/ký hiệu, trích yếu...)"
              prefix={<SearchOutlined />}
              value={searchFilters.generalSearch}
              onChange={(e) => setSearchFilters((prev) => ({ ...prev, generalSearch: e.target.value }))}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="Loại văn bản"
              value={searchFilters.docVariant}
              onChange={(value) => setSearchFilters((prev) => ({ ...prev, docVariant: value }))}
              allowClear
              style={{ width: "100%" }}
            >
              {docVariants.map((variant) => (
                <Select.Option key={variant._id} value={variant._id}>
                  {variant.docVariantName}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder="Trạng thái"
              value={searchFilters.status}
              onChange={(value) => setSearchFilters((prev) => ({ ...prev, status: value }))}
              allowClear
              style={{ width: "100%" }}
            >
              <Select.Option value="pending">Chờ chấp nhận</Select.Option>
              <Select.Option value="inReview">Đang xét duyệt</Select.Option>
              <Select.Option value="approvedByReviewer">Đã duyệt (BGH)</Select.Option>
              <Select.Option value="rejectedByReviewer">Đã từ chối (BGH)</Select.Option>
              <Select.Option value="approved">Đã chấp nhận</Select.Option>
              <Select.Option value="rejected">Đã từ chối</Select.Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <DatePicker
              placeholder="Ngày trình ký từ"
              value={searchFilters.replyAtFrom ? dayjs(searchFilters.replyAtFrom) : null}
              onChange={(date) => setSearchFilters((prev) => ({ ...prev, replyAtFrom: date ? date.toDate() : null }))}
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <DatePicker
              placeholder="Ngày trình ký đến"
              value={searchFilters.replyAtTo ? dayjs(searchFilters.replyAtTo) : null}
              onChange={(date) => setSearchFilters((prev) => ({ ...prev, replyAtTo: date ? date.toDate() : null }))}
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <DatePicker
              placeholder="Ngày xét duyệt từ"
              value={searchFilters.reviewDateFrom ? dayjs(searchFilters.reviewDateFrom) : null}
              onChange={(date) => setSearchFilters((prev) => ({ ...prev, reviewDateFrom: date ? date.toDate() : null }))}
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <DatePicker
              placeholder="Ngày xét duyệt đến"
              value={searchFilters.reviewDateTo ? dayjs(searchFilters.reviewDateTo) : null}
              onChange={(date) => setSearchFilters((prev) => ({ ...prev, reviewDateTo: date ? date.toDate() : null }))}
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Space>
              <Button onClick={handleResetSearch}>Xóa bộ lọc</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading || additionalDataLoading} size="large" tip="Đang tải dữ liệu...">
        <Table
          columns={columns}
          dataSource={filteredDocs}
          rowKey="_id"
          pagination={{
            ...pagination,
            total: filteredDocs.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} văn bản`,
          }}
          onChange={handleTableChange}
          scroll={{ x: "max-content" }}
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
        title={<span className="text-xl md:text-2xl font-bold text-gray-800">📄 Chi tiết văn bản xét duyệt</span>}
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
                  {additionalDataLoading ? "Đang tải..." : getDocVariantName(selectedDoc.docVariant) || "N/A"}
                </Tag>
              </p>
              <p>
                <strong>Trích yếu văn bản:</strong>{" "}
                {selectedDoc.shortDescription || "Không có"}
              </p>
              {selectedDoc.repliedDoc && (
                <p>
                  <strong>Số/Ký hiệu:</strong> {getDocCodeAndNum(selectedDoc)}
                </p>
              )}
              {selectedDoc.reviewer && (
                <p>
                  <strong>Người xét duyệt:</strong> {getUserName(selectedDoc.reviewer)}
                </p>
              )}
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card size="small" className="border-gray-200 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2 border-b pb-1">Thông tin trình ký</h3>
                <p>
                  <strong>Người trình ký:</strong> {getUserName(selectedDoc.replyBy)}
                </p>
                <p>
                  <strong>Người soạn thảo:</strong> {getDocumentAuthor(selectedDoc)}
                </p>
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
                {(selectedDoc.status === "approvedByReviewer" || selectedDoc.status === "approved") && selectedDoc.reviewTime && (
                  <p>
                    <strong>Ngày duyệt (BGH):</strong>{" "}
                    {moment(selectedDoc.reviewTime).format("DD/MM/YYYY HH:mm")}
                  </p>
                )}
                {(selectedDoc.status === "rejectedByReviewer" || selectedDoc.status === "rejected") && selectedDoc.reviewRejectionTime && (
                  <p>
                    <strong>Ngày từ chối (BGH):</strong>{" "}
                    {moment(selectedDoc.reviewRejectionTime).format("DD/MM/YYYY HH:mm")}
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
                      : "Chờ chấp nhận"
                  }
                />
              </p>
              {(selectedDoc.status === "rejectedByReviewer" || selectedDoc.status === "rejected") && (selectedDoc.reviewerNotes || selectedDoc.rejectionReason) && (
                <p className="mt-2 text-red-700">
                  <strong>Lý do từ chối:</strong> {selectedDoc.reviewerNotes || selectedDoc.rejectionReason}
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
        onCancel={() => {
          setIsRejectModalVisible(false);
          setReviewerNotes("");
          setRejectingDocId(null);
        }}
        okText="Xác nhận từ chối"
        cancelText="Hủy bỏ"
        confirmLoading={loading}
        okButtonProps={{ danger: true }}
        className="rounded-lg"
        destroyOnClose
      >
        <p className="mb-2">Vui lòng nhập lý do từ chối văn bản:</p>
        <Input.TextArea
          value={reviewerNotes}
          onChange={(e) => setReviewerNotes(e.target.value)}
          placeholder="Lý do từ chối..."
          rows={4}
          required
        />
      </Modal>

      {/* Approve Modal with File Upload */}
      <Modal
        title={<span className="text-lg font-bold text-gray-800">Xác nhận duyệt văn bản</span>}
        open={isApproveModalVisible}
        onOk={handleApprove}
        onCancel={() => {
          setIsApproveModalVisible(false);
          setApprovalFiles([]);
          setApprovingDocId(null);
          setExistingFiles([]);
        }}
        okText="Xác nhận duyệt"
        cancelText="Hủy bỏ"
        confirmLoading={loading}
        okButtonProps={{ style: { backgroundColor: "#52c41a", borderColor: "#52c41a" } }}
        className="rounded-lg"
        destroyOnClose
      >
        <div className="space-y-4">
          {/* Hiển thị file đã có */}
          {existingFiles.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold mb-2">📎 File đính kèm:</p>
              <Table
                dataSource={existingFiles}
                pagination={false}
                rowKey={(record) => record.fileId || record._id}
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
                      const rawName = formatFileName(record.fileName || record.name || "File");
                      return (
                        <a
                          href={`https://drive.google.com/file/d/${record.fileId || record._id}/view`}
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
                      const rawName = formatFileName(record.fileName || record.name || "File");
                      return (
                        <div className="flex gap-2 justify-center">
                          <Button 
                            type="text" 
                            icon={<FormOutlined className="text-green-600 text-lg" />} 
                            title="Ký số" 
                            onClick={async () => {
                              try {
                                message.loading({ content: 'Đang mở phần mềm ký số...', key: 'signFile' });
                                const response = await signFile(record.fileId || record._id, rawName);
                                if (response && response.isSuccess && response.file) {
                                  message.success({ content: 'Ký số thành công! Đã thêm vào danh sách file duyệt.', key: 'signFile', duration: 3 });
                                  // Thêm file vào danh sách approvalFiles
                                  const newFile = {
                                    uid: `signed_${Date.now()}`,
                                    name: response.file.name,
                                    status: 'done',
                                    originFileObj: response.file,
                                  };
                                  setApprovalFiles(prev => [...prev, newFile]);
                                }
                              } catch (error) {
                                message.error({ content: error.message || 'Lỗi khi mở phần mềm ký số', key: 'signFile', duration: 3 });
                              }
                            }}
                          />
                          <Button 
                            type="text" 
                            icon={<DownloadOutlined className="text-blue-500 text-lg" />} 
                            title="Tải xuống"
                            onClick={() => {
                              const fileId = record.fileId || record._id;
                              const link = document.createElement('a');
                              link.href = `https://drive.google.com/uc?export=download&id=${fileId}`;
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
            </div>
          )}
          
          <p className="mb-2">Đính kèm file (Tùy chọn)</p>
          <Upload.Dragger
            fileList={approvalFiles}
            onChange={handleFileChange}
            beforeUpload={() => false}
            multiple
            itemRender={(originNode, file, fileList, actions) => (
              <div className="flex items-center justify-between p-2 mt-2 bg-gray-50 border border-gray-200 rounded-md hover:bg-blue-50 transition-colors">
                <div className="flex items-center space-x-2 overflow-hidden">
                  <span className="text-blue-500 text-lg">📄</span>
                  <span className="text-sm text-gray-700 truncate block" title={file.name || file.fileName}>
                    {file.name || file.fileName}
                  </span>
                </div>
                <span 
                  className="text-red-500 cursor-pointer hover:text-red-700 font-bold px-2 text-lg" 
                  onClick={actions.remove}
                  title="Xóa"
                >
                  ×
                </span>
              </div>
            )}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined className="text-blue-500 text-3xl" />
            </p>
            <p className="ant-upload-text text-gray-700 font-medium mt-2">
              Nhấn để chọn hoặc kéo thả tệp vào đây
            </p>
          </Upload.Dragger>
        </div>
      </Modal>
    </div>
  );
};

export default BGHReviewPage;

