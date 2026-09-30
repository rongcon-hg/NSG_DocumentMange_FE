/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Button,
  Tag,
  Tabs,
  List,
  Modal,
  Form,
  Input,
  Radio,
  Progress,
  Badge,
  Spin,
  Space,
  Tooltip,
  Divider,
  message,
  Popconfirm,
  Empty,
  Typography,
  Upload,
  Switch,
} from "antd";
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  UserOutlined,
  TeamOutlined,
  FilePdfOutlined,
  CheckCircleOutlined,
  AudioOutlined,
  PlayCircleOutlined,
  StopOutlined,
  PlusOutlined,
  ReloadOutlined,
  QrcodeOutlined,
  SendOutlined,
  EyeOutlined,
  FormOutlined,
  CheckSquareOutlined,
  CloseCircleOutlined,
  VideoCameraOutlined,
  DownloadOutlined,
  InboxOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import dayjs from "dayjs";
import QRCode from "qrcode";
import {
  getMeetingById,
  updateMeeting,
  updateMeetingStatus,
  checkInMeeting,
  toggleSpeakRequest,
  createOrOpenVote,
  submitVote,
  closeVote,
  saveMinutesAndActionItems,
  addMeetingDocument,
} from "../../api/meetingApi";
import { getAllUsers } from "../../api/auth";
import { getDriveToken, uploadFileDirectlyToDrive } from "../../api/driveApi";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const PaperlessMeetingRoomPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [meeting, setMeeting] = useState(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");

  // Tài liệu đang được chọn xem
  const [activeDoc, setActiveDoc] = useState(null);

  // QR Code Data URL
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Biểu quyết modal & form
  const [isCreateVoteModalOpen, setIsCreateVoteModalOpen] = useState(false);
  const [voteForm] = Form.useForm();
  const [selectedVoteAnswers, setSelectedVoteAnswers] = useState({});

  // Biên bản cuộc họp modal
  const [isMinutesModalOpen, setIsMinutesModalOpen] = useState(false);
  const [minutesForm] = Form.useForm();
  const [actionItems, setActionItems] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Modal thêm tài liệu cuộc họp
  const [isAddDocModalOpen, setIsAddDocModalOpen] = useState(false);
  const [addDocForm] = Form.useForm();
  const [docUploadMode, setDocUploadMode] = useState("file"); // "file" | "url"
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploadPercent, setDocUploadPercent] = useState(0);
  const [uploadedDocInfo, setUploadedDocInfo] = useState(null);

  // Modal thêm/sửa nội dung họp (Agenda)
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);
  const [agendaForm] = Form.useForm();
  const [isSubmittingAgenda, setIsSubmittingAgenda] = useState(false);

  // Mẫu biểu quyết nhanh (yes_no, multiple, candidate_list)
  const [votePresetType, setVotePresetType] = useState("yes_no");

  // Chế độ xem đáp ứng trên Mobile & Tablet (left = tài liệu/nội dung/đại biểu, center = xem PDF, right = biểu quyết)
  const [mobileActivePanel, setMobileActivePanel] = useState("center");

  // Tab điều hướng cột trái
  const [activeLeftTab, setActiveLeftTab] = useState("documents");

  // Auto refresh
  const timerRef = useRef(null);

  // Lấy thông tin user hiện tại từ token
  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUserId(decoded.userId || decoded._id || decoded.id || "");
        setCurrentUserRole(decoded.role || "");
        setCurrentUserName(decoded.name || decoded.fullName || "Đại biểu");
      } catch (e) {
        console.error("Decode token error:", e);
      }
    }
  }, []);

  // Fetch dữ liệu phiên họp
  const fetchMeetingData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await getMeetingById(id);
      if (res && res.success && res.data) {
        setMeeting(res.data);
        // Mặc định chọn tài liệu đầu tiên nếu chưa chọn
        if (!activeDoc && res.data.documents && res.data.documents.length > 0) {
          setActiveDoc(res.data.documents[0]);
        }
      } else {
        message.error("Không thể tải thông tin cuộc họp!");
      }
    } catch (error) {
      console.error("Fetch meeting error:", error);
      if (!isSilent) message.error("Lỗi khi tải phiên họp: " + (error.response?.data?.message || error.message));
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchMeetingData();
      // Polling nhanh mỗi 4 giây để cập nhật trạng thái vote & xin phát biểu theo thời gian thực
      timerRef.current = setInterval(() => {
        fetchMeetingData(true);
      }, 4000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  // Tạo mã QR điểm danh
  useEffect(() => {
    if (meeting && meeting._id) {
      const checkInLink = `${window.location.origin}/meetings/${meeting._id}`;
      QRCode.toDataURL(checkInLink, { width: 260, margin: 2 }, (err, url) => {
        if (!err) setQrCodeUrl(url);
      });
    }
  }, [meeting]);

  // Lấy danh sách users cho phần giao việc
  useEffect(() => {
    getAllUsers()
      .then((res) => {
        if (Array.isArray(res)) setUsersList(res);
        else if (res?.data) setUsersList(res.data);
      })
      .catch((e) => console.error("Error fetching users for minutes:", e));
  }, []);

  // Kiểm tra vai trò của user trong cuộc họp này
  const myAttendeeRecord = useMemo(() => {
    if (!meeting || !meeting.attendees) return null;
    return meeting.attendees.find(
      (a) =>
        (a.user?._id || a.user) === currentUserId ||
        (typeof a.user === "string" && a.user === currentUserId)
    );
  }, [meeting, currentUserId]);

  const isHost = useMemo(() => {
    if (!meeting) return false;
    const isMeetingHost = (meeting.host?._id || meeting.host) === currentUserId;
    const isCreatedBy = (meeting.createdBy?._id || meeting.createdBy) === currentUserId;
    return isMeetingHost || isCreatedBy || ["admin", "manager"].includes(currentUserRole);
  }, [meeting, currentUserId, currentUserRole]);

  const isSecretary = useMemo(() => {
    if (!meeting) return false;
    return (meeting.secretary?._id || meeting.secretary) === currentUserId;
  }, [meeting, currentUserId]);

  const hasCheckedIn = myAttendeeRecord?.attendanceStatus === "ATTENDED";
  const isSpeakingRequested = myAttendeeRecord?.isSpeakingRequested || false;

  // Xử lý điểm danh
  const handleCheckIn = async () => {
    try {
      const res = await checkInMeeting(id, { method: "AUTO_JOIN" });
      if (res.success) {
        message.success("Điểm danh thành công! Chào mừng bạn vào phòng họp.");
        fetchMeetingData(true);
      }
    } catch (error) {
      message.error("Lỗi điểm danh: " + (error.response?.data?.message || error.message));
    }
  };

  // Đăng ký / Hủy đăng ký phát biểu
  const handleToggleSpeak = async () => {
    try {
      const nextState = !isSpeakingRequested;
      const res = await toggleSpeakRequest(id, nextState);
      if (res.success) {
        message.success(nextState ? "Đã gửi tín hiệu đăng ký phát biểu tới Chủ tọa" : "Đã hạ tay phát biểu");
        fetchMeetingData(true);
      }
    } catch (error) {
      message.error("Lỗi khi đăng ký phát biểu: " + (error.response?.data?.message || error.message));
    }
  };

  // Cập nhật trạng thái cuộc họp (Chủ tọa)
  const handleChangeStatus = async (newStatus) => {
    try {
      const res = await updateMeetingStatus(id, newStatus);
      if (res.success) {
        message.success("Đã cập nhật trạng thái phiên họp!");
        fetchMeetingData(true);
      }
    } catch (error) {
      message.error("Lỗi cập nhật: " + (error.response?.data?.message || error.message));
    }
  };

  // Xử lý upload tài liệu trực tiếp lên Google Drive
  const handleCustomUploadDoc = async ({ file, onSuccess, onError }) => {
    try {
      setUploadingDoc(true);
      setDocUploadPercent(0);
      const { accessToken, folderId } = await getDriveToken();
      const res = await uploadFileDirectlyToDrive(file, accessToken, folderId, (percent) => {
        setDocUploadPercent(percent);
      });

      const fileUrl = `https://drive.google.com/file/d/${res.fileId}/view`;
      setUploadedDocInfo({
        fileId: res.fileId,
        fileName: res.fileName,
        fileUrl,
        fileSize: file.size,
      });

      addDocForm.setFieldsValue({
        fileUrl,
        fileId: res.fileId,
        fileName: res.fileName,
      });
      if (!addDocForm.getFieldValue("title")) {
        addDocForm.setFieldsValue({ title: file.name.replace(/\.[^/.]+$/, "") });
      }

      onSuccess(res);
      message.success(`Đã tải lên tệp "${file.name}" vào Google Drive!`);
    } catch (err) {
      console.error("Lỗi upload Drive:", err);
      onError(err);
      message.error(err.message || "Tải lên tệp thất bại");
    } finally {
      setUploadingDoc(false);
    }
  };

  // Submit thêm tài liệu vào cuộc họp
  const handleAddDocumentSubmit = async (values) => {
    try {
      let finalFileId = values.fileId || "";
      let finalFileUrl = values.fileUrl || "";

      // Nếu nhập link Drive ở dạng URL, tự động trích xuất fileId
      if (!finalFileId && finalFileUrl) {
        const match = finalFileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
          finalFileId = match[1];
        }
      }

      if (!finalFileId && !finalFileUrl) {
        message.warning("Vui lòng tải tệp lên hoặc nhập đường dẫn tài liệu!");
        return;
      }

      const docPayload = {
        title: values.title,
        fileId: finalFileId,
        fileUrl: finalFileUrl,
        fileName: values.fileName || uploadedDocInfo?.fileName || values.title,
        fileSize: uploadedDocInfo?.fileSize || 0,
        isConfidential: !!values.isConfidential,
      };

      const res = await addMeetingDocument(id, docPayload);
      if (res && res.success) {
        message.success("Đã thêm tài liệu vào cuộc họp thành công!");
        setIsAddDocModalOpen(false);
        addDocForm.resetFields();
        setUploadedDocInfo(null);
        setDocUploadPercent(0);
        fetchMeetingData(true);
      } else {
        message.error(res?.message || "Không thể thêm tài liệu");
      }
    } catch (error) {
      console.error("Lỗi thêm tài liệu:", error);
      message.error("Lỗi khi thêm tài liệu: " + (error.response?.data?.message || error.message));
    }
  };

  // Thêm nội dung / chương trình họp (Agenda)
  const handleSaveAgenda = async (values) => {
    try {
      setIsSubmittingAgenda(true);
      const existingAgendas = Array.isArray(meeting.agendas) ? [...meeting.agendas] : [];
      const newAgendaItem = {
        order: existingAgendas.length + 1,
        title: values.title.trim(),
        presenter: values.presenter || "",
        durationMinutes: Number(values.durationMinutes) || 15,
        description: values.description || "",
      };

      const updatedAgendas = [...existingAgendas, newAgendaItem];
      const res = await updateMeeting(id, { agendas: updatedAgendas });
      if (res && res.success) {
        message.success("Đã thêm nội dung họp mới thành công!");
        setIsAgendaModalOpen(false);
        agendaForm.resetFields();
        fetchMeetingData(true);
      } else {
        message.error(res?.message || "Không thể lưu nội dung họp");
      }
    } catch (error) {
      console.error("Lỗi lưu nội dung họp:", error);
      message.error("Lỗi khi lưu nội dung: " + (error.response?.data?.message || error.message));
    } finally {
      setIsSubmittingAgenda(false);
    }
  };

  // Chọn mẫu biểu quyết nhanh
  const handlePresetVoteChange = (type) => {
    setVotePresetType(type);
    if (type === "yes_no") {
      voteForm.setFieldsValue({
        options: "Tán thành\nKhông tán thành",
      });
    } else if (type === "yes_no_other") {
      voteForm.setFieldsValue({
        options: "Tán thành\nKhông tán thành\nÝ kiến khác",
      });
    } else if (type === "candidate_list") {
      voteForm.setFieldsValue({
        options: "Đồng chí Nguyễn Văn A\nĐồng chí Trần Thị B\nĐồng chí Lê Văn C",
      });
    }
  };

  // Tạo phiên biểu quyết
  const handleCreateVoteSubmit = async (values) => {
    try {
      const optionsArray = values.options
        ? values.options.split("\n").map((o) => o.trim()).filter(Boolean)
        : ["Tán thành", "Không tán thành"];

      const payload = {
        title: values.title,
        description: values.description || "",
        isSecret: values.isSecret === "true",
        options: optionsArray,
      };

      const res = await createOrOpenVote(id, payload);
      if (res.success) {
        message.success("Đã mở phiên biểu quyết điện tử!");
        setIsCreateVoteModalOpen(false);
        voteForm.resetFields();
        fetchMeetingData(true);
      }
    } catch (error) {
      message.error("Lỗi mở biểu quyết: " + (error.response?.data?.message || error.message));
    }
  };

  // Bỏ phiếu biểu quyết
  const handleSubmitVoteOption = async (voteId, optIndex) => {
    try {
      const res = await submitVote(id, voteId, [optIndex]);
      if (res.success) {
        message.success("Biểu quyết của bạn đã được ghi nhận!");
        fetchMeetingData(true);
      }
    } catch (error) {
      message.error("Lỗi bỏ phiếu: " + (error.response?.data?.message || error.message));
    }
  };

  // Đóng phiên biểu quyết
  const handleCloseVote = async (voteId) => {
    try {
      const res = await closeVote(id, voteId);
      if (res.success) {
        message.success("Đã kết thúc phiên biểu quyết!");
        fetchMeetingData(true);
      }
    } catch (error) {
      message.error("Lỗi đóng biểu quyết: " + (error.response?.data?.message || error.message));
    }
  };

  // Lưu biên bản & Giao việc
  const handleSaveMinutes = async (values) => {
    try {
      const payload = {
        summary: values.summary,
        conclusion: values.conclusion,
        actionItems: actionItems,
      };
      const res = await saveMinutesAndActionItems(id, payload);
      if (res.success) {
        message.success("Đã lưu biên bản và tự động tạo công việc giao phó!");
        setIsMinutesModalOpen(false);
        fetchMeetingData(true);
      }
    } catch (error) {
      message.error("Lỗi lưu biên bản: " + (error.response?.data?.message || error.message));
    }
  };

  // Helper render URL xem trước tài liệu
  const renderDocPreview = (doc) => {
    if (!doc) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
          <FilePdfOutlined className="text-6xl text-slate-300 mb-3" />
          <Text className="text-base text-slate-500">Chưa có tài liệu nào được chọn xem</Text>
          <Text className="text-xs text-slate-400 mt-1">Chọn tài liệu từ danh sách bên trái để đọc trực tuyến</Text>
        </div>
      );
    }

    const driveUrl = doc.fileId
      ? `https://drive.google.com/file/d/${doc.fileId}/preview`
      : doc.fileUrl
      ? doc.fileUrl.replace("/view?usp=sharing", "/preview")
      : null;

    if (driveUrl) {
      return (
        <iframe
          src={driveUrl}
          title={doc.title || doc.fileName}
          className="w-full h-full border-0 rounded-lg shadow-inner bg-slate-100"
          allow="autoplay"
        />
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
        <FilePdfOutlined className="text-6xl text-slate-300 mb-3" />
        <Text className="text-base text-slate-600 font-medium">{doc.title || doc.fileName}</Text>
        <Text className="text-xs text-slate-400 mt-1 mb-4">Không tìm thấy mã Google Drive hoặc đường dẫn xem trước</Text>
        {doc.fileUrl && (
          <Button type="primary" icon={<DownloadOutlined />} href={doc.fileUrl} target="_blank">
            Mở hoặc tải về tệp
          </Button>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Spin size="large" tip="Đang kết nối phòng họp số e-Cabinet..." />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="p-8 text-center bg-slate-50 min-h-screen">
        <Empty description="Không tìm thấy phiên họp" />
        <Button className="mt-4" onClick={() => navigate("/meetings")}>
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  const attendeesCount = meeting.attendees?.length || 0;
  const attendedCount = meeting.attendees?.filter((a) => a.attendanceStatus === "ATTENDED").length || 0;
  const activeSpeakingRequests = meeting.attendees?.filter((a) => a.isSpeakingRequested) || [];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-100 overflow-hidden">
      {/* 1. Header Phòng Họp Số - Tối ưu Desktop & Mobile */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shadow-xs shrink-0">
        {/* Khối bên trái: Nút Rời phòng & Thông tin cuộc họp */}
        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
          <Button
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/meetings")}
            className="hover:bg-slate-100 shrink-0 mt-0.5 sm:mt-0 font-medium text-xs sm:text-sm"
          >
            Rời phòng
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-bold text-slate-800 text-sm sm:text-base leading-tight break-words">
                {meeting.title}
              </span>
              <Tag color="blue" className="font-semibold uppercase tracking-wider text-[11px] leading-4 m-0">
                {meeting.meetingCode}
              </Tag>
              {meeting.status === "IN_PROGRESS" ? (
                <Badge status="processing" text={<span className="text-emerald-600 font-semibold text-xs">Đang họp</span>} />
              ) : meeting.status === "CONCLUDED" ? (
                <Badge status="success" text={<span className="text-blue-600 font-semibold text-xs">Đã kết luận</span>} />
              ) : (
                <Badge status="default" text={<span className="text-slate-500 font-semibold text-xs">Chuẩn bị</span>} />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1">
              <span className="flex items-center">
                <EnvironmentOutlined className="mr-1 text-slate-400" />
                {meeting.location || "Phòng họp số"}
              </span>
              <span className="hidden xs:inline">•</span>
              <span className="flex items-center">
                <ClockCircleOutlined className="mr-1 text-slate-400" />
                {dayjs(meeting.startTime).format("HH:mm DD/MM/YYYY")}
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="flex items-center">
                <UserOutlined className="mr-1 text-slate-400" />
                Chủ tọa: <strong className="text-slate-700 ml-1 truncate max-w-[120px] sm:max-w-none">{meeting.host?.name || meeting.hostName}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Khối bên phải: Các nút bấm hành động */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0 justify-start md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
          {/* Nút tham gia họp trực tuyến nếu có URL */}
          {meeting.onlineMeetingUrl && (
            <Tooltip title="Mở phòng họp trực tuyến (Google Meet / Zoom)">
              <Button
                type="primary"
                size="small"
                icon={<VideoCameraOutlined />}
                className="bg-indigo-600 hover:bg-indigo-500 font-medium shadow-xs text-xs"
                href={meeting.onlineMeetingUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Họp online
              </Button>
            </Tooltip>
          )}

          {/* Nút điểm danh */}
          {!hasCheckedIn ? (
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              className="bg-emerald-600 hover:bg-emerald-500 font-medium text-xs"
              onClick={handleCheckIn}
            >
              Điểm danh
            </Button>
          ) : (
            <Tag color="success" className="px-2 py-0.5 flex items-center gap-1 font-medium text-xs m-0">
              <CheckCircleOutlined /> Đã điểm danh
            </Tag>
          )}

          {/* Nút Đăng ký phát biểu */}
          <Button
            type={isSpeakingRequested ? "primary" : "default"}
            size="small"
            danger={isSpeakingRequested}
            icon={<AudioOutlined />}
            onClick={handleToggleSpeak}
            className="text-xs"
          >
            {isSpeakingRequested ? "Hạ tay" : "Phát biểu"}
          </Button>

          {/* Mã QR điểm danh nhanh */}
          <Tooltip title="Mã QR & PIN điểm danh hội trường">
            <Button size="small" icon={<QrcodeOutlined />} onClick={() => setIsQrModalOpen(true)} className="text-xs">
              Mã QR
            </Button>
          </Tooltip>

          {/* Quyền Chủ tọa / Quản trị viên */}
          {isHost && (
            <div className="flex items-center gap-1.5">
              {meeting.status === "PREPARING" && (
                <Button
                  type="primary"
                  size="small"
                  icon={<PlayCircleOutlined />}
                  className="bg-emerald-600 hover:bg-emerald-500 text-xs"
                  onClick={() => handleChangeStatus("IN_PROGRESS")}
                >
                  Bắt đầu
                </Button>
              )}
              {meeting.status === "IN_PROGRESS" && (
                <Button
                  type="primary"
                  size="small"
                  icon={<StopOutlined />}
                  className="bg-blue-600 hover:bg-blue-500 text-xs"
                  onClick={() => handleChangeStatus("CONCLUDED")}
                >
                  Bế mạc
                </Button>
              )}
              <Button
                type="default"
                size="small"
                icon={<FormOutlined />}
                className="text-xs"
                onClick={() => {
                  minutesForm.setFieldsValue({
                    summary: meeting.minutes?.summary || "",
                    conclusion: meeting.minutes?.conclusion || "",
                  });
                  setActionItems(meeting.minutes?.actionItems || []);
                  setIsMinutesModalOpen(true);
                }}
              >
                Biên bản
              </Button>
            </div>
          )}

          {/* Nút thông báo xin phát biểu nổi bật cho Chủ tọa / mọi người */}
          {activeSpeakingRequests.length > 0 && (
            <Tooltip title="Nhấp để xem danh sách đại biểu đang xin phát biểu">
              <Button
                type="primary"
                size="small"
                danger
                icon={<AudioOutlined className="animate-bounce" />}
                className="animate-pulse font-semibold shadow-xs text-xs"
                onClick={() => {
                  setActiveLeftTab("attendees");
                  setMobileActivePanel("left");
                }}
              >
                {activeSpeakingRequests.length} xin nói
              </Button>
            </Tooltip>
          )}

          <Button size="small" icon={<ReloadOutlined />} onClick={() => fetchMeetingData(true)} />
        </div>
      </div>

      {/* Thanh chuyển chế độ xem nhanh trên Mobile & Tablet (màn hình < 1024px) */}
      <div className="lg:hidden bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between shrink-0">
        <Radio.Group
          value={mobileActivePanel}
          onChange={(e) => setMobileActivePanel(e.target.value)}
          buttonStyle="solid"
          size="small"
          className="w-full grid grid-cols-3 text-center text-xs"
        >
          <Radio.Button value="left" className="!px-1">
            <span className="flex items-center justify-center gap-1 truncate text-[11px] sm:text-xs">
              <FilePdfOutlined /> Tài liệu
            </span>
          </Radio.Button>
          <Radio.Button value="center" className="!px-1">
            <span className="flex items-center justify-center gap-1 truncate text-[11px] sm:text-xs">
              <EyeOutlined /> Đọc tài liệu
            </span>
          </Radio.Button>
          <Radio.Button value="right" className="!px-1">
            <span className="flex items-center justify-center gap-1 truncate text-[11px] sm:text-xs">
              <CheckSquareOutlined /> Biểu quyết ({meeting.votes?.length || 0})
            </span>
          </Radio.Button>
        </Radio.Group>
      </div>

      {/* 2. Thân phòng họp (Giao diện 3 cột linh hoạt cho Desktop, Tablet, Mobile) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 sm:p-3 gap-3">
        {/* CỘT TRÁI: Chương trình họp & Danh mục tài liệu */}
        <div
          className={`w-full lg:w-80 xl:w-96 flex flex-col bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden shrink-0 ${
            mobileActivePanel === "left" ? "flex flex-1" : "hidden lg:flex"
          }`}
        >
          <Tabs
            activeKey={activeLeftTab}
            onChange={(key) => setActiveLeftTab(key)}
            className="h-full flex flex-col px-3 pt-2"
            items={[
              {
                key: "documents",
                label: (
                  <span className="font-semibold flex items-center gap-1.5">
                    <FilePdfOutlined className="text-red-500" />
                    Tài liệu số ({meeting.documents?.length || 0})
                  </span>
                ),
                children: (
                  <div className="h-[calc(100vh-210px)] overflow-y-auto pr-1">
                    {(isHost || isSecretary) && (
                      <div className="mb-2">
                        <Button
                          type="dashed"
                          block
                          icon={<PlusOutlined />}
                          onClick={() => {
                            addDocForm.resetFields();
                            setUploadedDocInfo(null);
                            setDocUploadPercent(0);
                            setDocUploadMode("file");
                            setIsAddDocModalOpen(true);
                          }}
                          className="text-blue-600 border-blue-300 hover:border-blue-500 hover:text-blue-700"
                        >
                          Thêm tài liệu vào cuộc họp
                        </Button>
                      </div>
                    )}
                    {meeting.documents && meeting.documents.length > 0 ? (
                      <List
                        dataSource={meeting.documents}
                        renderItem={(doc, idx) => {
                          const isCurrent = (activeDoc?._id || activeDoc?.fileId) === (doc._id || doc.fileId);
                          return (
                            <List.Item
                              key={doc._id || idx}
                              className={`p-3 mb-2 rounded-lg cursor-pointer transition border ${
                                isCurrent
                                  ? "bg-blue-50/80 border-blue-300 shadow-xs"
                                  : "bg-slate-50/70 border-slate-200 hover:bg-slate-100"
                              }`}
                              onClick={() => setActiveDoc(doc)}
                            >
                              <div className="w-full flex items-start gap-2.5">
                                <div className="p-2 bg-red-100 text-red-600 rounded-md shrink-0">
                                  <FilePdfOutlined className="text-base" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-slate-800 text-sm truncate">
                                    {doc.title || doc.fileName}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                    <span>Tài liệu {idx + 1}</span>
                                    {doc.isConfidential && <Tag color="error">Mật</Tag>}
                                  </div>
                                </div>
                              </div>
                            </List.Item>
                          );
                        }}
                      />
                    ) : (
                      <Empty description="Chưa đính kèm tài liệu" className="mt-8" />
                    )}
                  </div>
                ),
              },
              {
                key: "agendas",
                label: (
                  <span className="font-semibold flex items-center gap-1.5">
                    <CalendarOutlined className="text-blue-500" />
                    Nội dung họp ({meeting.agendas?.length || 0})
                  </span>
                ),
                children: (
                  <div className="h-[calc(100vh-210px)] overflow-y-auto pr-1">
                    {(isHost || isSecretary) && (
                      <div className="mb-2">
                        <Button
                          type="dashed"
                          block
                          icon={<PlusOutlined />}
                          onClick={() => {
                            agendaForm.resetFields();
                            setIsAgendaModalOpen(true);
                          }}
                          className="text-indigo-600 border-indigo-300 hover:border-indigo-500 hover:text-indigo-700"
                        >
                          Thêm nội dung / Báo cáo họp
                        </Button>
                      </div>
                    )}
                    {meeting.agendas && meeting.agendas.length > 0 ? (
                      <div className="space-y-3">
                        {meeting.agendas.map((item, idx) => (
                          <div
                            key={item._id || idx}
                            className="p-3 rounded-lg border border-slate-200 bg-slate-50"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-slate-800 text-sm">
                                {idx + 1}. {item.title}
                              </span>
                              <Tag color="cyan">{item.durationMinutes || 15} phút</Tag>
                            </div>
                            {item.presenter && (
                              <div className="text-xs text-slate-500">
                                Báo cáo viên: <strong className="text-slate-700">{item.presenter}</strong>
                              </div>
                            )}
                            {item.description && (
                              <div className="text-xs text-slate-600 mt-1">{item.description}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty description="Chưa có chương trình họp" className="mt-8" />
                    )}
                  </div>
                ),
              },
              {
                key: "attendees",
                label: (
                  <Badge count={activeSpeakingRequests.length} offset={[8, 0]} size="small">
                    <span className="font-semibold flex items-center gap-1.5">
                      <TeamOutlined className="text-emerald-500" />
                      Đại biểu ({attendedCount}/{attendeesCount})
                    </span>
                  </Badge>
                ),
                children: (
                  <div className="h-[calc(100vh-210px)] overflow-y-auto pr-1">
                    {/* Hàng đợi phát biểu nếu có */}
                    {activeSpeakingRequests.length > 0 && (
                      <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
                          <AudioOutlined /> Đang xin phát biểu ({activeSpeakingRequests.length}):
                        </div>
                        {activeSpeakingRequests.map((reqUser) => (
                          <Tag key={reqUser.user?._id || reqUser.user} color="gold" className="m-0.5">
                            {reqUser.name || reqUser.user?.name}
                          </Tag>
                        ))}
                      </div>
                    )}

                    <List
                      dataSource={meeting.attendees || []}
                      renderItem={(att) => (
                        <List.Item className="py-2 px-2 hover:bg-slate-50 rounded">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <Badge
                                status={att.attendanceStatus === "ATTENDED" ? "success" : "default"}
                              />
                              <div>
                                <div className="text-sm font-medium text-slate-800">
                                  {att.name || att.user?.name || "Đại biểu"}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {att.roleInMeeting === "HOST"
                                    ? "Chủ tọa"
                                    : att.roleInMeeting === "SECRETARY"
                                    ? "Thư ký"
                                    : "Đại biểu"}
                                </div>
                              </div>
                            </div>
                            {att.isSpeakingRequested && (
                              <Tooltip title="Đang bấm đăng ký phát biểu">
                                <Tag color="warning" icon={<AudioOutlined />}>
                                  Xin phát biểu
                                </Tag>
                              </Tooltip>
                            )}
                          </div>
                        </List.Item>
                      )}
                    />
                  </div>
                ),
              },
            ]}
          />
        </div>

        {/* KHU VỰC TRUNG TÂM: Màn hình đọc tài liệu PDF không giấy tờ */}
        <div
          className={`flex-1 bg-white rounded-xl shadow-xs border border-slate-200 flex flex-col overflow-hidden min-h-[400px] lg:min-h-0 ${
            mobileActivePanel === "center" ? "flex flex-1" : "hidden lg:flex"
          }`}
        >
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <FilePdfOutlined className="text-red-500 text-base" />
              <span className="font-semibold text-slate-800 text-sm truncate">
                {activeDoc ? activeDoc.title || activeDoc.fileName : "Khu vực đọc tài liệu số"}
              </span>
            </div>
            {activeDoc?.fileUrl && (
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                href={activeDoc.fileUrl}
                target="_blank"
              >
                Mở tab mới
              </Button>
            )}
          </div>
          <div className="flex-1 bg-slate-100 p-2 overflow-hidden">{renderDocPreview(activeDoc)}</div>
        </div>

        {/* CỘT PHẢI: Biểu Quyết / Bỏ Phiếu Điện Tử & Thông Tin Biên Bản */}
        <div
          className={`w-full lg:w-80 xl:w-96 flex flex-col bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden shrink-0 ${
            mobileActivePanel === "right" ? "flex flex-1" : "hidden lg:flex"
          }`}
        >
          <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <CheckSquareOutlined className="text-indigo-600" />
              Biểu quyết điện tử ({meeting.votes?.length || 0})
            </span>
            {isHost && (
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                className="bg-indigo-600 hover:bg-indigo-500 text-xs"
                onClick={() => setIsCreateVoteModalOpen(true)}
              >
                Tạo biểu quyết
              </Button>
            )}
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-4">
            {meeting.votes && meeting.votes.length > 0 ? (
              meeting.votes.map((vote, vIdx) => {
                const isOpen = vote.status === "OPEN";
                const total = vote.totalVotes || 0;

                // Kiểm tra xem user hiện tại đã bỏ phiếu cho vote này chưa
                const hasVoted = vote.options?.some((opt) =>
                  opt.voters?.some(
                    (vId) =>
                      vId === currentUserId ||
                      vId?._id === currentUserId ||
                      (typeof vId === "string" && vId === currentUserId)
                  )
                );

                return (
                  <Card
                    key={vote._id || vIdx}
                    size="small"
                    className={`border ${isOpen ? "border-indigo-300 shadow-xs" : "border-slate-200 bg-slate-50/50"}`}
                    title={
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 text-sm truncate mr-2">
                          {vote.title}
                        </span>
                        <Tag color={isOpen ? "processing" : "default"}>
                          {isOpen ? "Đang mở" : "Đã đóng"}
                        </Tag>
                      </div>
                    }
                    extra={
                      isHost && isOpen ? (
                        <Popconfirm
                          title="Đóng phiên biểu quyết?"
                          onConfirm={() => handleCloseVote(vote._id)}
                          okText="Đóng"
                          cancelText="Hủy"
                        >
                          <Button size="small" danger type="link">
                            Khóa
                          </Button>
                        </Popconfirm>
                      ) : null
                    }
                  >
                    {vote.description && (
                      <p className="text-xs text-slate-500 mb-3">{vote.description}</p>
                    )}

                    <div className="space-y-2 mb-3">
                      {vote.options?.map((opt, oIdx) => {
                        const percent = total > 0 ? Math.round((opt.voteCount / total) * 100) : 0;
                        return (
                          <div key={opt._id || oIdx} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-slate-700">{opt.optionText}</span>
                              <span className="text-slate-500 font-semibold">
                                {opt.voteCount} phiếu ({percent}%)
                              </span>
                            </div>
                            <Progress percent={percent} size="small" strokeColor="#4f46e5" />
                            {/* Hiển thị người bỏ phiếu nếu là biểu quyết công khai */}
                            {!vote.isSecret && opt.voters && opt.voters.length > 0 && (
                              <div className="pt-1 flex flex-wrap gap-1 items-center">
                                <span className="text-[10px] text-slate-400">Người bầu:</span>
                                {opt.voters.map((v, vKey) => {
                                  const voterName = typeof v === "object" ? v?.name || v?.fullName || "Đại biểu" : "Đại biểu";
                                  return (
                                    <Tag key={vKey} color="blue" className="text-[10px] py-0 px-1.5 m-0 leading-4">
                                      {voterName}
                                    </Tag>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <span>Tổng cộng: {total} lượt bầu</span>
                      {vote.isSecret && <Tag color="purple">Bỏ phiếu kín</Tag>}
                    </div>

                    {/* Nút hành động cho đại biểu bỏ phiếu */}
                    {isOpen && (
                      <div className="mt-3 pt-2 border-t border-slate-100">
                        {hasVoted ? (
                          <div className="text-center text-xs text-emerald-600 font-semibold flex items-center justify-center gap-1">
                            <CheckCircleOutlined /> Bạn đã hoàn thành biểu quyết
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="text-xs font-medium text-slate-600">Chọn ý kiến của bạn:</div>
                            <div className="grid grid-cols-1 gap-1.5">
                              {vote.options?.map((opt, oIdx) => (
                                <Button
                                  key={opt._id || oIdx}
                                  size="small"
                                  className="text-left truncate text-xs hover:border-indigo-500"
                                  onClick={() => handleSubmitVoteOption(vote._id, oIdx)}
                                >
                                  {opt.optionText}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })
            ) : (
              <Empty
                description="Chưa có nội dung biểu quyết"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                className="mt-6"
              />
            )}
          </div>
        </div>
      </div>

      {/* Modal Quét Mã QR Điểm Danh & PIN */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800 font-bold">
            <QrcodeOutlined className="text-blue-600" />
            Mã QR Điểm Danh Hội Trường
          </div>
        }
        open={isQrModalOpen}
        onCancel={() => setIsQrModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsQrModalOpen(false)}>
            Hoàn tất
          </Button>,
        ]}
        width={400}
        centered
      >
        <div className="text-center py-4">
          <p className="text-slate-600 text-sm mb-4">
            Đại biểu quét mã QR dưới đây bằng điện thoại / iPad hoặc nhập mã PIN để điểm danh vào phòng họp:
          </p>
          {qrCodeUrl ? (
            <img
              src={qrCodeUrl}
              alt="Mã QR Điểm Danh"
              className="mx-auto border p-2 rounded-xl shadow-xs"
            />
          ) : (
            <Spin />
          )}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg inline-block border border-blue-200">
            <span className="text-xs text-blue-700 font-semibold uppercase tracking-wider block">
              Mã PIN Phòng Họp
            </span>
            <span className="text-2xl font-black text-blue-900 tracking-widest">
              {meeting.pinCode || "1234"}
            </span>
          </div>
        </div>
      </Modal>

      {/* Modal Tạo Phiên Biểu Quyết */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <CheckSquareOutlined className="text-indigo-600" />
            Tạo Phiên Biểu Quyết / Lấy Ý Kiến Điện Tử
          </div>
        }
        open={isCreateVoteModalOpen}
        onCancel={() => setIsCreateVoteModalOpen(false)}
        onOk={() => voteForm.submit()}
        okText="Mở biểu quyết ngay"
        cancelText="Hủy"
        width={560}
      >
        <Form
          form={voteForm}
          layout="vertical"
          onFinish={handleCreateVoteSubmit}
          initialValues={{
            isSecret: "false",
            options: "Tán thành\nKhông tán thành",
          }}
          className="mt-3"
        >
          <Form.Item
            name="title"
            label="Nội dung cần biểu quyết / lấy ý kiến"
            rules={[{ required: true, message: "Vui lòng nhập nội dung biểu quyết" }]}
          >
            <Input placeholder="Ví dụ: Thông qua Kế hoạch tuyển sinh năm học 2026-2027" />
          </Form.Item>

          <div className="mb-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-xs font-semibold text-slate-700 mb-1.5">⚡ Chọn dạng biểu quyết nhanh:</div>
            <Radio.Group
              value={votePresetType}
              onChange={(e) => handlePresetVoteChange(e.target.value)}
              buttonStyle="solid"
              size="small"
              className="flex flex-wrap gap-1"
            >
              <Radio.Button value="yes_no">👍 2 Phương án: Tán thành / Không tán thành</Radio.Button>
              <Radio.Button value="yes_no_other">📊 3 Phương án: Có thêm Ý kiến khác</Radio.Button>
              <Radio.Button value="candidate_list">👤 Bỏ phiếu theo danh sách nhân sự</Radio.Button>
            </Radio.Group>
          </div>

          <Form.Item name="description" label="Diễn giải / Thuyết minh thêm (nếu có)">
            <TextArea rows={2} placeholder="Nội dung tóm tắt để đại biểu nắm rõ thông tin trước khi vote..." />
          </Form.Item>

          <Form.Item
            name="options"
            label="Các phương án biểu quyết / Danh sách bầu chọn (Mỗi dòng một lựa chọn)"
            rules={[{ required: true, message: "Nhập các lựa chọn biểu quyết" }]}
          >
            <TextArea rows={3} placeholder="Tán thành&#10;Không tán thành" />
          </Form.Item>

          <Form.Item name="isSecret" label="Hình thức biểu quyết">
            <Radio.Group>
              <Radio value="false">Biểu quyết công khai (Hiển thị người bầu)</Radio>
              <Radio value="true">Bỏ phiếu kín (Ẩn danh đại biểu)</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Thêm Nội Dung / Báo Cáo Họp (Agenda) */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <CalendarOutlined className="text-indigo-600" />
            Thêm Nội Dung / Chương Trình Phiên Họp
          </div>
        }
        open={isAgendaModalOpen}
        onCancel={() => {
          setIsAgendaModalOpen(false);
          agendaForm.resetFields();
        }}
        onOk={() => agendaForm.submit()}
        okText="Lưu nội dung"
        cancelText="Hủy"
        confirmLoading={isSubmittingAgenda}
        width={560}
      >
        <Form
          form={agendaForm}
          layout="vertical"
          onFinish={handleSaveAgenda}
          initialValues={{ durationMinutes: 15 }}
          className="mt-3"
        >
          <Form.Item
            name="title"
            label="Tên nội dung / Chuyên đề báo cáo"
            rules={[{ required: true, message: "Vui lòng nhập tên nội dung họp!" }]}
          >
            <Input placeholder="Ví dụ: Báo cáo công tác chuyên môn quý III và kế hoạch quý IV..." />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={14}>
              <Form.Item name="presenter" label="Báo cáo viên / Người trình bày">
                <Input placeholder="Ví dụ: Đ/c Trưởng phòng TCHC" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={10}>
              <Form.Item
                name="durationMinutes"
                label="Thời lượng (Phút)"
                rules={[{ required: true, message: "Nhập thời lượng" }]}
              >
                <Input type="number" min={1} placeholder="15" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Tóm tắt nội dung / Ghi chú thảo luận">
            <TextArea rows={3} placeholder="Tóm tắt các vấn đề trọng tâm cần thông qua..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Ghi Biên Bản & Tự Động Giao Việc (Action Items) */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <FormOutlined className="text-blue-600" />
            Ghi Biên Bản & Kết Luận Phiên Họp
          </div>
        }
        open={isMinutesModalOpen}
        onCancel={() => setIsMinutesModalOpen(false)}
        onOk={() => minutesForm.submit()}
        okText="Lưu biên bản & Giao việc"
        cancelText="Hủy"
        width={760}
      >
        <Form
          form={minutesForm}
          layout="vertical"
          onFinish={handleSaveMinutes}
          className="mt-3"
        >
          <Form.Item
            name="summary"
            label="Tóm tắt diễn biến phiên họp"
            rules={[{ required: true, message: "Vui lòng nhập tóm tắt cuộc họp" }]}
          >
            <TextArea rows={4} placeholder="Nội dung các đại biểu thảo luận, đóng góp ý kiến..." />
          </Form.Item>

          <Form.Item
            name="conclusion"
            label="Kết luận của Chủ tọa"
            rules={[{ required: true, message: "Vui lòng nhập kết luận chỉ đạo" }]}
          >
            <TextArea rows={3} placeholder="Chủ tọa kết luận và chỉ đạo thực hiện các nhiệm vụ trọng tâm..." />
          </Form.Item>

          <div className="border-t border-slate-200 pt-3 mt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-slate-800 text-sm">
                Danh mục nhiệm vụ giao phó (Tự động sinh Tasks)
              </span>
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => {
                  setActionItems([
                    ...actionItems,
                    {
                      taskContent: "",
                      assigneeName: "",
                      deadline: dayjs().add(7, "day").format("YYYY-MM-DD"),
                    },
                  ]);
                }}
              >
                Thêm việc
              </Button>
            </div>

            {actionItems.map((item, index) => (
              <div
                key={index}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg mb-2 flex items-center gap-2"
              >
                <div className="flex-1">
                  <Input
                    placeholder="Nội dung công việc cần thực hiện"
                    value={item.taskContent}
                    size="small"
                    onChange={(e) => {
                      const next = [...actionItems];
                      next[index].taskContent = e.target.value;
                      setActionItems(next);
                    }}
                  />
                </div>
                <div className="w-48">
                  <Input
                    placeholder="Người / Phòng ban thực hiện"
                    value={item.assigneeName}
                    size="small"
                    onChange={(e) => {
                      const next = [...actionItems];
                      next[index].assigneeName = e.target.value;
                      setActionItems(next);
                    }}
                  />
                </div>
                <div className="w-36">
                  <Input
                    type="date"
                    size="small"
                    value={item.deadline ? dayjs(item.deadline).format("YYYY-MM-DD") : ""}
                    onChange={(e) => {
                      const next = [...actionItems];
                      next[index].deadline = e.target.value;
                      setActionItems(next);
                    }}
                  />
                </div>
                <Button
                  danger
                  type="text"
                  size="small"
                  icon={<CloseCircleOutlined />}
                  onClick={() => {
                    const next = actionItems.filter((_, i) => i !== index);
                    setActionItems(next);
                  }}
                />
              </div>
            ))}
          </div>
        </Form>
      </Modal>

      {/* Modal Thêm tài liệu cuộc họp */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-slate-800 text-base">
            <FilePdfOutlined className="text-red-500" />
            Thêm Tài Liệu Vào Phiên Họp
          </div>
        }
        open={isAddDocModalOpen}
        onCancel={() => {
          setIsAddDocModalOpen(false);
          addDocForm.resetFields();
          setUploadedDocInfo(null);
          setDocUploadPercent(0);
        }}
        onOk={() => addDocForm.submit()}
        okText="Lưu tài liệu"
        cancelText="Đóng"
        confirmLoading={uploadingDoc}
        width={560}
      >
        <Form
          form={addDocForm}
          layout="vertical"
          onFinish={handleAddDocumentSubmit}
          initialValues={{ isConfidential: false }}
          className="mt-4"
        >
          <Form.Item
            name="title"
            label="Tiêu đề / Tên hiển thị tài liệu"
            rules={[{ required: true, message: "Vui lòng nhập tiêu đề tài liệu!" }]}
          >
            <Input placeholder="Ví dụ: Báo cáo tài chính quý IV, Kế hoạch tuyển sinh..." />
          </Form.Item>

          <div className="mb-4">
            <Radio.Group
              value={docUploadMode}
              onChange={(e) => setDocUploadMode(e.target.value)}
              buttonStyle="solid"
              className="w-full grid grid-cols-2 text-center"
            >
              <Radio.Button value="file">Tải tệp từ máy (Lên Google Drive)</Radio.Button>
              <Radio.Button value="url">Nhập đường dẫn (Link Drive / URL)</Radio.Button>
            </Radio.Group>
          </div>

          {docUploadMode === "file" ? (
            <div className="mb-4">
              <Upload.Dragger
                customRequest={handleCustomUploadDoc}
                showUploadList={false}
                multiple={false}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                disabled={uploadingDoc}
                className="bg-slate-50"
              >
                <p className="ant-upload-drag-icon text-blue-500">
                  <InboxOutlined style={{ fontSize: 36 }} />
                </p>
                <p className="ant-upload-text text-sm font-medium">
                  Nhấp hoặc kéo thả tệp văn bản / PDF vào đây
                </p>
                <p className="ant-upload-hint text-xs text-slate-400">
                  Hỗ trợ định dạng PDF, Word, Excel, PowerPoint. Tệp được tự động lưu lên Google Drive của nhà trường.
                </p>
              </Upload.Dragger>

              {uploadingDoc && (
                <div className="mt-2">
                  <Progress percent={docUploadPercent} status="active" />
                  <span className="text-xs text-slate-500">Đang đồng bộ tệp lên Google Drive...</span>
                </div>
              )}

              {uploadedDocInfo && (
                <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircleOutlined className="text-emerald-600" />
                    <span className="font-semibold truncate">{uploadedDocInfo.fileName}</span>
                  </div>
                  <Tag color="success">Đã tải lên</Tag>
                </div>
              )}
            </div>
          ) : (
            <Form.Item
              name="fileUrl"
              label="Đường dẫn xem trước (Google Drive URL hoặc link tệp trực tiếp)"
              rules={[{ required: true, message: "Vui lòng nhập đường dẫn tài liệu!" }]}
            >
              <Input
                prefix={<LinkOutlined className="text-slate-400" />}
                placeholder="https://drive.google.com/file/d/.../view"
              />
            </Form.Item>
          )}

          {/* Ẩn các trường bổ trợ */}
          <Form.Item name="fileId" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="fileName" hidden>
            <Input />
          </Form.Item>

          <Form.Item name="isConfidential" valuePropName="checked" className="mb-0">
            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <div>
                <span className="text-sm font-medium text-slate-700">Tài liệu Mật / Hạn chế</span>
                <p className="text-xs text-slate-400 mb-0">Chỉ hiển thị gắn cờ Mật cho các thành viên trong phiên họp</p>
              </div>
              <Switch checkedChildren="Mật" unCheckedChildren="Thường" />
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PaperlessMeetingRoomPage;
