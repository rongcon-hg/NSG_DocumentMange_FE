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
  Timeline,
  Table,
  notification,
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
  CompassOutlined,
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
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  FileExcelOutlined,
  LoginOutlined,
} from "@ant-design/icons";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import dayjs from "dayjs";
import QRCode from "qrcode";
import ExcelJS from "exceljs";
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
  deleteMeetingDocument,
  logMeetingAccessApi,
  getPublicMeetingApi,
  guestJoinMeetingApi,
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
  const activeDocIdRef = useRef(null);

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
  const [editingAgenda, setEditingAgenda] = useState(null);
  const [agendaForm] = Form.useForm();
  const [isSubmittingAgenda, setIsSubmittingAgenda] = useState(false);

  // Mẫu biểu quyết nhanh (yes_no, multiple, candidate_list)
  const [votePresetType, setVotePresetType] = useState("yes_no");

  // Chế độ xem đáp ứng trên Mobile & Tablet (left = tài liệu/nội dung/đại biểu, center = xem PDF, right = biểu quyết)
  const [mobileActivePanel, setMobileActivePanel] = useState("center");

  // Tab điều hướng cột trái
  const [activeLeftTab, setActiveLeftTab] = useState("documents");

  // Modal xem chi tiết nhật ký vào/ra & vị trí điểm danh của đại biểu
  const [selectedAttendeeForLogs, setSelectedAttendeeForLogs] = useState(null);
  const [isAccessLogModalOpen, setIsAccessLogModalOpen] = useState(false);

  // Modal xem thống kê điểm danh & toàn bộ lịch sử ra vào
  const [isAttendanceStatsModalOpen, setIsAttendanceStatsModalOpen] = useState(false);

  // Auto refresh & previous speak request tracking
  const timerRef = useRef(null);
  const prevSpeakingUsersRef = useRef([]);

  // Khách quét mã QR chưa đăng nhập
  const [guestUser, setGuestUser] = useState(() => {
    try {
      const saved = localStorage.getItem(`meeting_guest_${id}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  // Bước lựa chọn khi quét mã QR: "choice" (chọn Đăng nhập hoặc Khách) | "guest_form" (nhập thông tin khách)
  const [qrAuthStep, setQrAuthStep] = useState("choice"); 
  const [isGuestJoinModalOpen, setIsGuestJoinModalOpen] = useState(false);
  const [guestForm] = Form.useForm();
  const [submittingGuest, setSubmittingGuest] = useState(false);
  const [guestLocation, setGuestLocation] = useState(null); // { coords, text }
  const [fetchingGuestLocation, setFetchingGuestLocation] = useState(false);
  const [checkingInLocation, setCheckingInLocation] = useState(false);

  // Hàm yêu cầu cấp quyền vị trí GPS
  const requestCurrentLocation = async (silent = false) => {
    if (!navigator.geolocation) {
      if (!silent) message.warning("Trình duyệt của bạn không hỗ trợ lấy định vị GPS.");
      return null;
    }
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 0,
          enableHighAccuracy: true,
        });
      });
      if (position && position.coords) {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        const text = `GPS: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
        return { coords, text };
      }
    } catch (err) {
      if (!silent) {
        if (err.code === 1) {
          message.warning("Bạn đã từ chối quyền truy cập vị trí trên trình duyệt. Vui lòng cho phép quyền Vị trí (Location) trong cài đặt trình duyệt.");
        } else if (err.code === 2) {
          message.warning("Không thể xác định vị trí hiện tại của thiết bị.");
        } else if (err.code === 3) {
          message.warning("Hết thời gian chờ phản hồi định vị GPS.");
        } else {
          message.warning("Lỗi định vị GPS: " + err.message);
        }
      }
    }
    return null;
  };

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
    } else {
      // Nếu không có token, kiểm tra xem đã từng tham gia với tư cách khách chưa
      const savedGuest = localStorage.getItem(`meeting_guest_${id}`);
      if (!savedGuest) {
        setIsGuestJoinModalOpen(true);
      }
    }
  }, [id]);

  // Fetch dữ liệu phiên họp (tự động thử route công khai nếu không có token hoặc lỗi xác thực)
  const fetchMeetingData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const token = Cookies.get("accessToken");
      let res;
      if (!token) {
        res = await getPublicMeetingApi(id);
      } else {
        try {
          res = await getMeetingById(id);
        } catch (authErr) {
          if (authErr.response?.status === 401 || authErr.response?.status === 403) {
            res = await getPublicMeetingApi(id);
          } else {
            throw authErr;
          }
        }
      }

      if (res && res.success && res.data) {
        const mData = res.data;
        setMeeting(mData);

        // Giữ tài liệu đang xem hoặc mặc định chọn tài liệu đầu tiên nếu chưa chọn
        if (mData.documents && mData.documents.length > 0) {
          const targetId = activeDocIdRef.current;
          let matched = null;
          if (targetId) {
            matched = mData.documents.find(
              (d) =>
                (d._id && String(d._id) === String(targetId)) ||
                (d.fileId && String(d.fileId) === String(targetId)) ||
                (d.fileUrl && String(d.fileUrl) === String(targetId))
            );
          }
          const chosenDoc = matched || mData.documents[0];
          activeDocIdRef.current = chosenDoc._id || chosenDoc.fileId || chosenDoc.fileUrl;
          setActiveDoc(chosenDoc);
        }

        // Kiểm tra xem có đại biểu mới xin phát biểu hay không để đẩy thông báo cho Chủ tọa / Thư ký
        const currentSpeakingAttendees = mData.attendees?.filter((a) => a.isSpeakingRequested) || [];
        const currentSpeakingIds = currentSpeakingAttendees.map((a) => (a.user?._id || a.user || a.guestId || "").toString());

        const newSpeakers = currentSpeakingAttendees.filter(
          (a) => !prevSpeakingUsersRef.current.includes((a.user?._id || a.user || a.guestId || "").toString())
        );

        // Nếu có đại biểu vừa mới xin phát biểu (chưa từng thấy ở lần poll trước)
        if (newSpeakers.length > 0 && prevSpeakingUsersRef.current.length > 0) {
          const isUserHostOrSecretary =
            (mData.host?._id || mData.host) === currentUserId ||
            (mData.secretary?._id || mData.secretary) === currentUserId ||
            ["admin", "manager"].includes(currentUserRole);

          if (isUserHostOrSecretary) {
            newSpeakers.forEach((spk) => {
              const spkName = spk.name || spk.user?.name || "Một đại biểu";
              notification.info({
                message: "Đại biểu đăng ký phát biểu!",
                description: `${spkName} vừa nhấn Đăng ký phát biểu trong phiên họp. Chủ tọa vui lòng điều phối.`,
                icon: <AudioOutlined style={{ color: "#faad14" }} />,
                placement: "topRight",
                duration: 6,
              });
            });
          }
        }
        prevSpeakingUsersRef.current = currentSpeakingIds;
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

      // Ghi nhận lịch sử vào phòng họp (JOIN)
      const currentGuestId = guestUser?.guestId;
      logMeetingAccessApi(id, {
        action: "JOIN",
        guestId: currentGuestId,
        device: navigator.userAgent || "Web Browser",
      }).catch((e) => console.warn("Log JOIN meeting error:", e.message));

      // Lắng nghe sự kiện rời màn hình cuộc họp hoặc quay lại (visibilitychange)
      const handleVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          logMeetingAccessApi(id, {
            action: "LEAVE",
            guestId: currentGuestId,
            device: navigator.userAgent || "Web Browser",
          }).catch(() => {});
        } else if (document.visibilityState === "visible") {
          logMeetingAccessApi(id, {
            action: "JOIN",
            guestId: currentGuestId,
            device: navigator.userAgent || "Web Browser",
          }).catch(() => {});
          fetchMeetingData(true);
        }
      };

      // Lắng nghe sự kiện đóng tab / refresh (beforeunload/pagehide)
      const handleBeforeUnload = () => {
        logMeetingAccessApi(id, {
          action: "LEAVE",
          guestId: currentGuestId,
          device: navigator.userAgent || "Web Browser",
        }).catch(() => {});
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("pagehide", handleBeforeUnload);

      // Polling nhanh mỗi 4 giây để cập nhật trạng thái vote & xin phát biểu theo thời gian thực
      timerRef.current = setInterval(() => {
        fetchMeetingData(true);
      }, 4000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("pagehide", handleBeforeUnload);
        // Ghi nhận lịch sử rời phòng họp (LEAVE)
        logMeetingAccessApi(id, {
          action: "LEAVE",
          guestId: currentGuestId,
          device: navigator.userAgent || "Web Browser",
        }).catch((e) => console.warn("Log LEAVE meeting error:", e.message));
      };
    }
  }, [id, guestUser]);

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

  const isCreator = useMemo(() => {
    if (!meeting) return false;
    return (meeting.createdBy?._id || meeting.createdBy) === currentUserId;
  }, [meeting, currentUserId]);

  const isMeetingHostOnly = useMemo(() => {
    if (!meeting) return false;
    return (meeting.host?._id || meeting.host) === currentUserId;
  }, [meeting, currentUserId]);

  const isSecretary = useMemo(() => {
    if (!meeting) return false;
    return (meeting.secretary?._id || meeting.secretary) === currentUserId;
  }, [meeting, currentUserId]);

  // Chủ trì & Thư ký (quyền điều hành phiên họp, biểu quyết, bắt đầu/kết thúc, ghi biên bản)
  const canControlMeeting = useMemo(() => {
    return isMeetingHostOnly || isSecretary;
  }, [isMeetingHostOnly, isSecretary]);

  // Người tạo cuộc họp, Chủ trì và Thư ký (quyền thêm, sửa, xóa nội dung cuộc họp)
  const canManageAgenda = useMemo(() => {
    return isMeetingHostOnly || isSecretary || isCreator || ["admin", "manager"].includes(currentUserRole);
  }, [isMeetingHostOnly, isSecretary, isCreator, currentUserRole]);

  // Người tạo cuộc họp, Chủ trì, Thư ký, Manager và Admin (quyền tải lên, gán nhãn mật, xóa tài liệu số)
  const canManageDocuments = useMemo(() => {
    return isMeetingHostOnly || isSecretary || isCreator || ["admin", "manager"].includes(currentUserRole);
  }, [isMeetingHostOnly, isSecretary, isCreator, currentUserRole]);

  const isHost = useMemo(() => {
    if (!meeting) return false;
    return isMeetingHostOnly || isCreator || ["admin", "manager"].includes(currentUserRole);
  }, [meeting, isMeetingHostOnly, isCreator, currentUserRole]);

  const hasCheckedIn = myAttendeeRecord?.attendanceStatus === "ATTENDED";
  const isSpeakingRequested = myAttendeeRecord?.isSpeakingRequested || false;

  // Xử lý Khách vào phòng họp quét mã QR không cần đăng nhập
  const handleGuestJoinSubmit = async (values) => {
    try {
      setSubmittingGuest(true);
      let coords = guestLocation?.coords || null;
      let locationStr = guestLocation?.text || "Quét mã QR";

      // Nếu chưa có vị trí GPS, thử gọi requestCurrentLocation
      if (!coords) {
        const loc = await requestCurrentLocation(true);
        if (loc) {
          coords = loc.coords;
          locationStr = loc.text;
        }
      }

      const res = await guestJoinMeetingApi(id, {
        pinCode: values.pinCode?.trim(),
        name: values.name?.trim(),
        position: values.position?.trim(),
        department: values.department?.trim(),
        location: locationStr,
        coords: coords,
        guestId: guestUser?.guestId,
        device: navigator.userAgent || "QR Guest Scan",
      });

      if (res && res.success) {
        const guestData = {
          guestId: res.data?.guestId,
          name: values.name.trim(),
          position: values.position?.trim(),
          department: values.department?.trim(),
        };
        setGuestUser(guestData);
        localStorage.setItem(`meeting_guest_${id}`, JSON.stringify(guestData));
        setCurrentUserName(values.name.trim());
        setIsGuestJoinModalOpen(false);
        message.success("Chào mừng bạn đã tham gia phiên họp!");
        fetchMeetingData(true);
      }
    } catch (error) {
      message.error(error.response?.data?.message || "Không thể tham gia phiên họp. Vui lòng kiểm tra mã PIN!");
    } finally {
      setSubmittingGuest(false);
    }
  };

  // Xuất file Excel danh sách đại biểu tham gia phiên họp (Dành cho Chủ trì & Thư ký)
  const handleExportExcelAttendees = async () => {
    try {
      if (!meeting || !meeting.attendees || meeting.attendees.length === 0) {
        message.warning("Phiên họp chưa có danh sách đại biểu để xuất Excel!");
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Hệ thống Quản lý Văn bản & Phiên họp e-Cabinet";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Danh Sách Đại Biểu", {
        views: [{ showGridLines: true }],
      });

      // Tiêu đề bảng tính
      worksheet.mergeCells("A1:H1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = `DANH SÁCH ĐẠI BIỂU & ĐIỂM DANH PHIÊN HỌP: ${meeting.title?.toUpperCase() || ""}`;
      titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF1E3A8A" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(1).height = 32;

      // Thông tin phiên họp
      worksheet.mergeCells("A2:H2");
      const subCell = worksheet.getCell("A2");
      subCell.value = `Mã phiên: ${meeting.meetingCode || ""} | Thời gian: ${dayjs(meeting.startTime).format("HH:mm DD/MM/YYYY")} - ${dayjs(meeting.endTime).format("HH:mm DD/MM/YYYY")} | Địa điểm: ${meeting.location || ""}`;
      subCell.font = { name: "Arial", size: 10, italic: true };
      subCell.alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(2).height = 20;

      worksheet.addRow([]); // Dòng trống cách dòng

      // Định nghĩa cột
      worksheet.columns = [
        { key: "stt", width: 8 },
        { key: "name", width: 28 },
        { key: "position", width: 22 },
        { key: "department", width: 26 },
        { key: "role", width: 16 },
        { key: "status", width: 18 },
        { key: "checkInTime", width: 20 },
        { key: "totalMinutes", width: 18 },
        { key: "location", width: 30 },
      ];

      // Header bảng dữ liệu
      const headerRow = worksheet.addRow([
        "STT",
        "Họ và tên",
        "Chức vụ",
        "Đơn vị / Cơ quan",
        "Vai trò cuộc họp",
        "Trạng thái",
        "Thời gian điểm danh",
        "Tổng tgian tham gia",
        "Vị trí điểm danh",
      ]);

      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF2563EB" },
        };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Thêm dữ liệu từng đại biểu
      meeting.attendees.forEach((att, idx) => {
        const attendeeName = att.name || att.user?.name || "Đại biểu";
        const attendeePos = att.positionName || att.user?.position?.positionName || att.user?.positionName || "—";
        const attendeeDept = att.departmentName || att.user?.department?.departmentName || att.user?.departmentName || "—";

        let roleText = "Đại biểu";
        if (att.roleInMeeting === "HOST") roleText = "Chủ tọa";
        else if (att.roleInMeeting === "SECRETARY") roleText = "Thư ký";
        else if (att.roleInMeeting === "GUEST") roleText = "Khách mời";

        const statusText = att.attendanceStatus === "ATTENDED" ? "Đã tham gia" : "Chưa có mặt";
        const checkInTimeText = att.checkInTime ? dayjs(att.checkInTime).format("HH:mm:ss DD/MM/YYYY") : "—";
        const totalMinutesText = att.totalAttendanceMinutes && att.totalAttendanceMinutes > 0 ? `${att.totalAttendanceMinutes} phút` : (att.checkInTime ? "Đang tham gia" : "—");
        const locationText = att.checkInLocation || "—";

        const row = worksheet.addRow([
          idx + 1,
          attendeeName,
          attendeePos,
          attendeeDept,
          roleText,
          statusText,
          checkInTimeText,
          totalMinutesText,
          locationText,
        ]);

        row.height = 22;
        row.eachCell((cell, colNumber) => {
          cell.font = { name: "Arial", size: 10 };
          cell.alignment = {
            vertical: "middle",
            horizontal: [1, 5, 6, 7, 8].includes(colNumber) ? "center" : "left",
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Danh_Sach_Dai_Bieu_${meeting.meetingCode || "PH"}_${dayjs().format("YYYYMMDD_HHmm")}.xlsx`;
      anchor.click();
      window.URL.revokeObjectURL(url);
      message.success("Xuất danh sách đại biểu ra file Excel thành công!");
    } catch (err) {
      console.error("Lỗi xuất Excel:", err);
      message.error("Lỗi xuất file Excel: " + err.message);
    }
  };

  // Xử lý điểm danh (kèm định vị GPS / vị trí điểm danh & thiết bị)
  const handleCheckIn = async () => {
    setCheckingInLocation(true);
    let coords = null;
    let locationStr = "Trực tiếp qua Web";

    // Yêu cầu cấp quyền và lấy định vị GPS từ trình duyệt
    const loc = await requestCurrentLocation(false);
    if (loc) {
      coords = loc.coords;
      locationStr = loc.text;
    }

    try {
      const res = await checkInMeeting(id, {
        method: "AUTO_JOIN",
        location: locationStr,
        coords: coords,
        device: navigator.userAgent || "Web Browser",
      });
      if (res.success) {
        message.success(
          coords
            ? "Điểm danh thành công! Đã ghi nhận tọa độ GPS và thiết bị."
            : "Điểm danh thành công! Đã ghi nhận thời gian tham gia."
        );
        fetchMeetingData(true);
      }
    } catch (error) {
      message.error("Lỗi điểm danh: " + (error.response?.data?.message || error.message));
    } finally {
      setCheckingInLocation(false);
    }
  };

  // Rời khỏi phòng họp (ghi nhận Access Log LEAVE và tính tổng thời gian tham gia)
  const handleLeaveRoom = async () => {
    try {
      const currentGuestId = guestUser?.guestId;
      await logMeetingAccessApi(id, {
        action: "LEAVE",
        guestId: currentGuestId,
        device: navigator.userAgent || "Web Browser",
      });
    } catch (e) {
      console.warn("Log LEAVE on leave button error:", e.message);
    }
    navigate("/meetings");
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

  // Submit thêm tài liệu vào cuộc họp (với cơ chế Fallback tự động)
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
        fileUrl: finalFileUrl || (finalFileId ? `https://drive.google.com/file/d/${finalFileId}/view?usp=sharing` : ""),
        fileName: values.fileName || uploadedDocInfo?.fileName || values.title,
        fileSize: uploadedDocInfo?.fileSize || 0,
        isConfidential: !!values.isConfidential,
        uploadedAt: new Date(),
        uploadedBy: currentUserId,
      };

      let success = false;
      try {
        const res = await addMeetingDocument(id, docPayload);
        if (res && res.success) {
          success = true;
        }
      } catch (err) {
        // Nếu API /documents trả về 404 (do VPS chưa reload route mới), dùng fallback PUT /meetings/:id
        if (err.response?.status === 404) {
          console.warn("API addMeetingDocument 404, fallback to updateMeeting with new documents array...");
          const currentDocs = Array.isArray(meeting?.documents) ? [...meeting.documents] : [];
          const updatedDocs = [...currentDocs, docPayload];
          const fallbackRes = await updateMeeting(id, { documents: updatedDocs });
          if (fallbackRes && fallbackRes.success) {
            success = true;
          }
        } else {
          throw err;
        }
      }

      if (success) {
        message.success("Đã thêm tài liệu vào cuộc họp thành công!");
        setIsAddDocModalOpen(false);
        addDocForm.resetFields();
        setUploadedDocInfo(null);
        setDocUploadPercent(0);
        fetchMeetingData(true);
      } else {
        message.error("Không thể thêm tài liệu vào cuộc họp");
      }
    } catch (error) {
      console.error("Lỗi thêm tài liệu:", error);
      message.error("Lỗi khi thêm tài liệu: " + (error.response?.data?.message || error.message));
    }
  };

  // Xóa tài liệu khỏi cuộc họp
  const handleDeleteDocument = async (doc) => {
    try {
      const docId = doc._id || doc.fileId;
      let success = false;
      try {
        const res = await deleteMeetingDocument(id, docId);
        if (res && res.success) {
          success = true;
        }
      } catch (err) {
        // Fallback updateMeeting nếu route delete bị 404
        if (err.response?.status === 404) {
          const currentDocs = Array.isArray(meeting?.documents) ? [...meeting.documents] : [];
          const updatedDocs = currentDocs.filter((d) => (d._id || d.fileId) !== docId);
          const fallbackRes = await updateMeeting(id, { documents: updatedDocs });
          if (fallbackRes && fallbackRes.success) {
            success = true;
          }
        } else {
          throw err;
        }
      }

      if (success) {
        message.success("Đã xóa tài liệu khỏi cuộc họp!");
        if ((activeDoc?._id || activeDoc?.fileId) === docId) {
          activeDocIdRef.current = null;
          setActiveDoc(null);
        }
        fetchMeetingData(true);
      } else {
        message.error("Không thể xóa tài liệu");
      }
    } catch (error) {
      console.error("Lỗi xóa tài liệu:", error);
      message.error("Lỗi xóa tài liệu: " + (error.response?.data?.message || error.message));
    }
  };

  // Bật / Tắt gán nhãn Mật / Hạn chế cho tài liệu
  const handleToggleConfidentialDocument = async (doc) => {
    try {
      const docId = doc._id || doc.fileId;
      const currentDocs = Array.isArray(meeting?.documents) ? [...meeting.documents] : [];
      const updatedDocs = currentDocs.map((d) => {
        if ((d._id && d._id === docId) || (d.fileId && d.fileId === docId)) {
          return {
            ...d,
            isConfidential: !d.isConfidential,
          };
        }
        return d;
      });

      const res = await updateMeeting(id, { documents: updatedDocs });
      if (res && res.success) {
        message.success(!doc.isConfidential ? 'Đã gán nhãn "Mật / Hạn chế" cho tài liệu!' : 'Đã bỏ gán nhãn Mật tài liệu!');
        if ((activeDoc?._id || activeDoc?.fileId) === docId) {
          setActiveDoc({ ...activeDoc, isConfidential: !doc.isConfidential });
        }
        fetchMeetingData(true);
      } else {
        message.error("Không thể cập nhật nhãn tài liệu");
      }
    } catch (error) {
      console.error("Lỗi cập nhật nhãn mật:", error);
      message.error("Lỗi: " + (error.response?.data?.message || error.message));
    }
  };

  // Thêm hoặc Chỉnh sửa nội dung / chương trình họp (Agenda)
  const handleSaveAgenda = async (values) => {
    try {
      setIsSubmittingAgenda(true);
      const existingAgendas = Array.isArray(meeting.agendas) ? [...meeting.agendas] : [];

      let updatedAgendas = [];
      if (editingAgenda) {
        // Chỉnh sửa nội dung đã có
        updatedAgendas = existingAgendas.map((item, idx) => {
          if ((item._id && item._id === editingAgenda._id) || (!item._id && idx === editingAgenda.index)) {
            return {
              ...item,
              title: values.title.trim(),
              presenter: values.presenter || "",
              durationMinutes: Number(values.durationMinutes) || 15,
              description: values.description || "",
            };
          }
          return item;
        });
      } else {
        // Thêm nội dung mới
        const newAgendaItem = {
          order: existingAgendas.length + 1,
          title: values.title.trim(),
          presenter: values.presenter || "",
          durationMinutes: Number(values.durationMinutes) || 15,
          description: values.description || "",
        };
        updatedAgendas = [...existingAgendas, newAgendaItem];
      }

      const res = await updateMeeting(id, { agendas: updatedAgendas });
      if (res && res.success) {
        message.success(editingAgenda ? "Đã cập nhật nội dung họp thành công!" : "Đã thêm nội dung họp mới thành công!");
        setIsAgendaModalOpen(false);
        setEditingAgenda(null);
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

  // Xóa nội dung họp
  const handleDeleteAgenda = async (agendaItem, index) => {
    try {
      const existingAgendas = Array.isArray(meeting.agendas) ? [...meeting.agendas] : [];
      const updatedAgendas = existingAgendas.filter((item, idx) => {
        if (agendaItem._id) {
          return item._id !== agendaItem._id;
        }
        return idx !== index;
      });

      const res = await updateMeeting(id, { agendas: updatedAgendas });
      if (res && res.success) {
        message.success("Đã xóa nội dung họp thành công!");
        fetchMeetingData(true);
      } else {
        message.error("Không thể xóa nội dung họp");
      }
    } catch (error) {
      console.error("Lỗi xóa nội dung:", error);
      message.error("Lỗi khi xóa nội dung: " + (error.response?.data?.message || error.message));
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
          key={doc._id || doc.fileId || doc.fileUrl}
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
        {doc.fileUrl && !doc.isConfidential && (
          <Button type="primary" icon={<DownloadOutlined />} href={doc.fileUrl} target="_blank">
            Mở hoặc tải về tệp
          </Button>
        )}
        {doc.isConfidential && (
          <Tag color="error" icon={<LockOutlined />} className="px-3 py-1 text-xs">
            Tài liệu Mật / Hạn chế - Không được phép tải xuống
          </Tag>
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
            onClick={handleLeaveRoom}
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
              loading={checkingInLocation}
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
          <Tooltip title="Mã QR & PIN điểm danh">
            <Button size="small" icon={<QrcodeOutlined />} onClick={() => setIsQrModalOpen(true)} className="text-xs">
              Mã QR
            </Button>
          </Tooltip>

          {/* Quyền Chủ trì & Thư ký: Bắt đầu, Bế mạc phiên họp và Ghi biên bản */}
          {canControlMeeting && (
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

          {/* Nút xem Thống kê điểm danh & Lịch sử ra vào */}
          <Tooltip title="Xem thống kê điểm danh & lịch sử ra vào toàn bộ phiên họp">
            <Button
              size="small"
              icon={<TeamOutlined className="text-blue-600" />}
              className="text-xs"
              onClick={() => setIsAttendanceStatsModalOpen(true)}
            >
              Thống kê ({attendedCount}/{attendeesCount})
            </Button>
          </Tooltip>

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
                    {canManageDocuments && (
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
                          const docKey = doc._id || doc.fileId || doc.fileUrl;
                          const activeKey = activeDoc?._id || activeDoc?.fileId || activeDoc?.fileUrl;
                          const isCurrent = docKey && activeKey && String(docKey) === String(activeKey);
                          return (
                            <List.Item
                              key={doc._id || idx}
                              className={`p-3 mb-2 rounded-lg cursor-pointer transition border ${
                                isCurrent
                                  ? "bg-blue-50/80 border-blue-300 shadow-xs"
                                  : "bg-slate-50/70 border-slate-200 hover:bg-slate-100"
                              }`}
                              onClick={() => {
                                activeDocIdRef.current = doc._id || doc.fileId || doc.fileUrl;
                                setActiveDoc(doc);
                              }}
                            >
                              <div className="w-full flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                  <div className="p-2 bg-red-100 text-red-600 rounded-md shrink-0">
                                    <FilePdfOutlined className="text-base" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-slate-800 text-sm truncate">
                                      {doc.title || doc.fileName}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                      <span>Tài liệu {idx + 1}</span>
                                      {doc.isConfidential ? (
                                        <Tag color="red" icon={<LockOutlined />} className="font-semibold px-2 py-0.5 rounded-full border-red-300">
                                          Mật / Hạn chế
                                        </Tag>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>

                                {canManageDocuments && (
                                  <div className="shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <Tooltip title={doc.isConfidential ? "Gỡ nhãn Mật / Hạn chế" : "Gán nhãn Mật / Hạn chế"}>
                                      <Button
                                        size="small"
                                        type="text"
                                        icon={<LockOutlined className={doc.isConfidential ? "text-red-500" : "text-slate-400 hover:text-red-500"} />}
                                        onClick={() => handleToggleConfidentialDocument(doc)}
                                        className="w-7 h-7 p-0 flex items-center justify-center"
                                      />
                                    </Tooltip>
                                    <Popconfirm
                                      title="Xóa tài liệu?"
                                      description="Bạn chắc chắn muốn xóa tài liệu này khỏi phiên họp?"
                                      onConfirm={() => handleDeleteDocument(doc)}
                                      okText="Xóa"
                                      cancelText="Hủy"
                                      okButtonProps={{ danger: true }}
                                    >
                                      <Tooltip title="Xóa tài liệu khỏi cuộc họp">
                                        <Button
                                          size="small"
                                          type="text"
                                          danger
                                          icon={<DeleteOutlined />}
                                          className="text-slate-400 hover:text-red-600 w-7 h-7 p-0 flex items-center justify-center"
                                        />
                                      </Tooltip>
                                    </Popconfirm>
                                  </div>
                                )}
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
                    {canManageAgenda && (
                      <div className="mb-2">
                        <Button
                          type="dashed"
                          block
                          icon={<PlusOutlined />}
                          onClick={() => {
                            setEditingAgenda(null);
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
                            className="p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100/70 transition"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold text-slate-800 text-sm">
                                {idx + 1}. {item.title}
                              </span>
                              <div className="flex items-center gap-1">
                                <Tag color="cyan">{item.durationMinutes || 15} phút</Tag>
                                {canManageAgenda && (
                                  <div className="flex items-center gap-0.5 ml-1">
                                    <Tooltip title="Chỉnh sửa nội dung họp">
                                      <Button
                                        size="small"
                                        type="text"
                                        icon={<EditOutlined className="text-blue-600 text-xs" />}
                                        className="w-6 h-6 p-0 flex items-center justify-center"
                                        onClick={() => {
                                          setEditingAgenda({ ...item, index: idx });
                                          agendaForm.setFieldsValue({
                                            title: item.title,
                                            presenter: item.presenter,
                                            durationMinutes: item.durationMinutes || 15,
                                            description: item.description,
                                          });
                                          setIsAgendaModalOpen(true);
                                        }}
                                      />
                                    </Tooltip>
                                    <Popconfirm
                                      title="Xóa nội dung này?"
                                      description="Bạn có chắc muốn xóa nội dung chương trình này?"
                                      onConfirm={() => handleDeleteAgenda(item, idx)}
                                      okText="Xóa"
                                      cancelText="Hủy"
                                      okButtonProps={{ danger: true }}
                                    >
                                      <Tooltip title="Xóa nội dung họp">
                                        <Button
                                          size="small"
                                          type="text"
                                          danger
                                          icon={<DeleteOutlined className="text-red-500 text-xs" />}
                                          className="w-6 h-6 p-0 flex items-center justify-center"
                                        />
                                      </Tooltip>
                                    </Popconfirm>
                                  </div>
                                )}
                              </div>
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

                    {/* Thanh công cụ Xuất Excel danh sách đại biểu (Dành cho Chủ trì & Thư ký) */}
                    {canControlMeeting && (
                      <div className="mb-2">
                        <Button
                          type="dashed"
                          block
                          icon={<FileExcelOutlined className="text-emerald-600" />}
                          onClick={handleExportExcelAttendees}
                          className="text-emerald-700 border-emerald-300 hover:border-emerald-500 hover:text-emerald-800 text-xs font-medium"
                        >
                          Xuất Excel danh sách đại biểu
                        </Button>
                      </div>
                    )}

                    <List
                      dataSource={meeting.attendees || []}
                      renderItem={(att) => {
                        const attendeePos = att.positionName || att.user?.position?.positionName || att.user?.positionName || "";
                        const attendeeDept = att.departmentName || att.user?.department?.departmentName || att.user?.departmentName || "";

                        return (
                          <List.Item
                            className="py-2.5 px-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                            onClick={() => {
                              setSelectedAttendeeForLogs(att);
                              setIsAccessLogModalOpen(true);
                            }}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-start gap-2.5 min-w-0">
                                <Badge
                                  status={att.attendanceStatus === "ATTENDED" ? "success" : "default"}
                                  className="mt-1"
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-slate-800 leading-tight">
                                    {att.name || att.user?.name || "Đại biểu"}
                                  </div>

                                  {/* Hiển thị Chức vụ và Đơn vị */}
                                  {(attendeePos || attendeeDept) && (
                                    <div className="text-[11px] text-slate-500 truncate max-w-[210px] mt-0.5">
                                      {attendeePos && <span className="font-medium text-slate-600">{attendeePos}</span>}
                                      {attendeePos && attendeeDept && <span> - </span>}
                                      {attendeeDept && <span className="text-slate-500">{attendeeDept}</span>}
                                    </div>
                                  )}

                                  <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                                    <span className="font-medium">
                                      {att.roleInMeeting === "HOST"
                                        ? "Chủ tọa"
                                        : att.roleInMeeting === "SECRETARY"
                                        ? "Thư ký"
                                        : att.roleInMeeting === "GUEST"
                                        ? "Khách"
                                        : "Đại biểu"}
                                    </span>
                                    {att.checkInTime && (
                                      <>
                                        <span>•</span>
                                        <span className="text-emerald-600 font-medium">
                                          <ClockCircleOutlined className="mr-0.5" />
                                          {dayjs(att.checkInTime).format("HH:mm DD/MM")}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  {att.checkInLocation && (
                                    <div className="text-[11px] text-slate-500 truncate max-w-[200px] mt-0.5">
                                      <EnvironmentOutlined className="mr-0.5 text-blue-500" />
                                      {att.checkInLocation}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                {att.isSpeakingRequested && (
                                  <Tooltip title="Đang bấm đăng ký phát biểu">
                                    <Tag color="warning" icon={<AudioOutlined />} className="m-0">
                                      Xin phát biểu
                                    </Tag>
                                  </Tooltip>
                                )}
                                <Tooltip title="Xem lịch sử ra/vào phòng họp">
                                  <Button
                                    size="small"
                                    type="text"
                                    icon={<EyeOutlined className="text-slate-400 hover:text-blue-600" />}
                                    className="w-6 h-6 p-0 flex items-center justify-center"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedAttendeeForLogs(att);
                                      setIsAccessLogModalOpen(true);
                                    }}
                                  />
                                </Tooltip>
                              </div>
                            </div>
                          </List.Item>
                        );
                      }}
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
              {activeDoc?.isConfidential && (
                <Tag color="error" icon={<LockOutlined />} className="font-semibold px-2 py-0.5 ml-1">
                  Mật / Hạn chế
                </Tag>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canManageDocuments && activeDoc && (
                <Tooltip title={activeDoc.isConfidential ? "Bỏ gán nhãn Mật / Hạn chế" : "Gán nhãn Mật / Hạn chế"}>
                  <Button
                    size="small"
                    type={activeDoc.isConfidential ? "primary" : "default"}
                    danger={activeDoc.isConfidential}
                    icon={<LockOutlined />}
                    onClick={() => handleToggleConfidentialDocument(activeDoc)}
                    className="text-xs"
                  >
                    {activeDoc.isConfidential ? "Đang Mật" : "Gán nhãn Mật"}
                  </Button>
                </Tooltip>
              )}
              {activeDoc?.fileUrl && (
                activeDoc.isConfidential ? (
                  <Tooltip title="Tài liệu Mật / Hạn chế: Không cho phép mở rộng ra tab mới hoặc tải xuống">
                    <Tag color="volcano" icon={<LockOutlined />} className="text-xs m-0">
                      Chỉ đọc trong phòng họp
                    </Tag>
                  </Tooltip>
                ) : (
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    href={activeDoc.fileUrl}
                    target="_blank"
                  >
                    Mở tab mới
                  </Button>
                )
              )}
            </div>
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
            {canControlMeeting && (
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
                      canControlMeeting && isOpen ? (
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
            Mã QR Điểm Danh
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
            {editingAgenda ? "Chỉnh Sửa Nội Dung Phiên Họp" : "Thêm Nội Dung / Chương Trình Phiên Họp"}
          </div>
        }
        open={isAgendaModalOpen}
        onCancel={() => {
          setIsAgendaModalOpen(false);
          setEditingAgenda(null);
          agendaForm.resetFields();
        }}
        onOk={() => agendaForm.submit()}
        okText={editingAgenda ? "Cập nhật" : "Lưu nội dung"}
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

      {/* Modal Lịch sử ra vào & Vị trí điểm danh của đại biểu */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-slate-800 text-base">
            <ClockCircleOutlined className="text-blue-600" />
            Nhật ký Ra / Vào & Vị trí Điểm danh
          </div>
        }
        open={isAccessLogModalOpen}
        onCancel={() => {
          setIsAccessLogModalOpen(false);
          setSelectedAttendeeForLogs(null);
        }}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsAccessLogModalOpen(false)}>
            Đóng
          </Button>,
        ]}
        width={680}
      >
        {selectedAttendeeForLogs ? (
          <div className="mt-3">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800 text-base">
                  {selectedAttendeeForLogs.name || selectedAttendeeForLogs.user?.name || "Đại biểu"}
                </div>
                {((selectedAttendeeForLogs.positionName || selectedAttendeeForLogs.user?.position?.positionName || selectedAttendeeForLogs.user?.positionName) || (selectedAttendeeForLogs.departmentName || selectedAttendeeForLogs.user?.department?.departmentName || selectedAttendeeForLogs.user?.departmentName)) && (
                  <div className="text-xs text-slate-600 mt-0.5">
                    {[
                      selectedAttendeeForLogs.positionName || selectedAttendeeForLogs.user?.position?.positionName || selectedAttendeeForLogs.user?.positionName,
                      selectedAttendeeForLogs.departmentName || selectedAttendeeForLogs.user?.department?.departmentName || selectedAttendeeForLogs.user?.departmentName
                    ].filter(Boolean).join(" - ")}
                  </div>
                )}
                <div className="text-xs text-slate-500 mt-0.5">
                  Vai trò:{" "}
                  <span className="font-semibold text-slate-700">
                    {selectedAttendeeForLogs.roleInMeeting === "HOST"
                      ? "Chủ tọa"
                      : selectedAttendeeForLogs.roleInMeeting === "SECRETARY"
                      ? "Thư ký"
                      : selectedAttendeeForLogs.roleInMeeting === "GUEST"
                      ? "Khách"
                      : "Đại biểu"}
                  </span>
                  {" • "}
                  Trạng thái:{" "}
                  <Tag
                    color={selectedAttendeeForLogs.attendanceStatus === "ATTENDED" ? "success" : "default"}
                    className="ml-1"
                  >
                    {selectedAttendeeForLogs.attendanceStatus === "ATTENDED" ? "Đã tham gia" : "Chưa điểm danh"}
                  </Tag>
                </div>
              </div>
              {selectedAttendeeForLogs.checkInTime && (
                <div className="text-right">
                  <div className="text-xs text-slate-400">Thời gian điểm danh</div>
                  <div className="text-xs font-semibold text-emerald-600">
                    {dayjs(selectedAttendeeForLogs.checkInTime).format("HH:mm:ss DD/MM/YYYY")}
                  </div>
                </div>
              )}
            </div>

            {/* Chi tiết vị trí GPS nếu có */}
            {selectedAttendeeForLogs.checkInLocation && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                <div className="text-xs font-bold text-blue-800 flex items-center gap-1.5 mb-1">
                  <EnvironmentOutlined className="text-blue-600" />
                  Vị trí điểm danh ghi nhận:
                </div>
                <div className="text-sm font-medium text-slate-800">
                  {selectedAttendeeForLogs.checkInLocation}
                </div>
                {selectedAttendeeForLogs.checkInCoords && (
                  <div className="text-xs text-slate-500 mt-1 flex gap-3">
                    <span>Vĩ độ (Lat): <b>{selectedAttendeeForLogs.checkInCoords.latitude}</b></span>
                    <span>Kinh độ (Long): <b>{selectedAttendeeForLogs.checkInCoords.longitude}</b></span>
                    {selectedAttendeeForLogs.checkInCoords.accuracy && (
                      <span>Độ chính xác: ~{Math.round(selectedAttendeeForLogs.checkInCoords.accuracy)}m</span>
                    )}
                  </div>
                )}
                {selectedAttendeeForLogs.checkInCoords?.latitude && selectedAttendeeForLogs.checkInCoords?.longitude && (
                  <div className="mt-2">
                    <a
                      href={`https://www.google.com/maps?q=${selectedAttendeeForLogs.checkInCoords.latitude},${selectedAttendeeForLogs.checkInCoords.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <LinkOutlined /> Mở trên Google Maps
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <span>Lịch sử các lượt truy cập vào / rời phòng:</span>
            </div>

            {selectedAttendeeForLogs.accessLogs && selectedAttendeeForLogs.accessLogs.length > 0 ? (
              <div className="max-h-[350px] overflow-y-auto pr-1">
                <Timeline
                  items={selectedAttendeeForLogs.accessLogs
                    .slice()
                    .reverse()
                    .map((log, index) => {
                      const isJoin = log.action === "JOIN";
                      const isLeave = log.action === "LEAVE";
                      const isCheckIn = log.action === "CHECK_IN";

                      const color = isCheckIn ? "green" : isJoin ? "blue" : "gray";
                      const label = isCheckIn
                        ? "Điểm danh vào họp"
                        : isJoin
                        ? "Vào phòng họp"
                        : "Rời khỏi phòng họp";

                      return {
                        color: color,
                        children: (
                          <div key={index} className="pb-1">
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-xs font-bold ${
                                  isCheckIn
                                    ? "text-emerald-700"
                                    : isJoin
                                    ? "text-blue-700"
                                    : "text-slate-600"
                                }`}
                              >
                                {label}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {dayjs(log.time).format("HH:mm:ss DD/MM/YYYY")}
                              </span>
                            </div>
                            {log.location && (
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span className="flex items-center gap-1">
                                  <EnvironmentOutlined className="text-slate-400" />
                                  {log.location}
                                </span>
                                {log.coords?.latitude && log.coords?.longitude && (
                                  <a
                                    href={`https://www.google.com/maps?q=${log.coords.latitude},${log.coords.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline inline-flex items-center gap-0.5 font-medium ml-1"
                                  >
                                    <LinkOutlined /> Bản đồ
                                  </a>
                                )}
                              </div>
                            )}
                            {log.device && (
                              <div className="text-[10px] text-slate-400 truncate max-w-sm mt-0.5">
                                Thiết bị: {log.device}
                              </div>
                            )}
                          </div>
                        ),
                      };
                    })}
                />
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs bg-slate-50 rounded-lg">
                Chưa có dữ liệu lịch sử vào/ra chi tiết cho đại biểu này.
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Modal Thống Kê Điểm Danh & Toàn Bộ Lịch Sử Ra Vào Phiên Họp */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-slate-800 text-base">
            <TeamOutlined className="text-blue-600" />
            Thống Kê Điểm Danh & Lịch Sử Ra Vào Toàn Phiên Họp
          </div>
        }
        open={isAttendanceStatsModalOpen}
        onCancel={() => setIsAttendanceStatsModalOpen(false)}
        footer={[
          canControlMeeting && (
            <Button
              key="export"
              icon={<FileExcelOutlined className="text-emerald-600" />}
              onClick={handleExportExcelAttendees}
              className="text-emerald-700 border-emerald-300 hover:border-emerald-500"
            >
              Xuất Excel danh sách
            </Button>
          ),
          <Button key="close" type="primary" onClick={() => setIsAttendanceStatsModalOpen(false)}>
            Đóng
          </Button>,
        ]}
        width={980}
      >
        <div className="py-2 space-y-4">
          {/* Hàng thẻ thống kê nhanh */}
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                <div className="text-xs text-blue-600 font-medium">Tổng đại biểu mời</div>
                <div className="text-2xl font-bold text-blue-800 mt-0.5">{meeting?.attendees?.length || 0}</div>
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <div className="text-xs text-emerald-600 font-medium">Đã tham gia / Có mặt</div>
                <div className="text-2xl font-bold text-emerald-700 mt-0.5">
                  {meeting?.attendees?.filter((a) => a.attendanceStatus === "ATTENDED").length || 0}
                </div>
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <div className="text-xs text-amber-600 font-medium">Chưa điểm danh / Vắng</div>
                <div className="text-2xl font-bold text-amber-700 mt-0.5">
                  {meeting?.attendees?.filter((a) => a.attendanceStatus !== "ATTENDED").length || 0}
                </div>
              </div>
            </Col>
            <Col xs={12} sm={6}>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
                <div className="text-xs text-purple-600 font-medium">Khách mời ngoài ds</div>
                <div className="text-2xl font-bold text-purple-700 mt-0.5">
                  {meeting?.attendees?.filter((a) => a.roleInMeeting === "GUEST").length || 0}
                </div>
              </div>
            </Col>
          </Row>

          {/* Bảng chi tiết điểm danh và thời lượng */}
          <Table
            dataSource={meeting?.attendees || []}
            rowKey={(r) => r.user?._id || r.user || r._id}
            size="small"
            pagination={{ pageSize: 8, showSizeChanger: false }}
            bordered
            columns={[
              {
                title: "STT",
                width: 50,
                align: "center",
                render: (_, __, i) => i + 1,
              },
              {
                title: "Họ và tên",
                dataIndex: "name",
                render: (n, r) => {
                  const attendeePos = r.positionName || r.user?.position?.positionName || r.user?.positionName || "";
                  const attendeeDept = r.departmentName || r.user?.department?.departmentName || r.user?.departmentName || "";
                  return (
                    <div>
                      <span className="font-semibold text-slate-800">{n || r.user?.name || "Đại biểu"}</span>
                      {(attendeePos || attendeeDept) && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {attendeePos && <span className="font-medium text-slate-600">{attendeePos}</span>}
                          {attendeePos && attendeeDept && <span> - </span>}
                          {attendeeDept && <span>{attendeeDept}</span>}
                        </div>
                      )}
                    </div>
                  );
                },
              },
              {
                title: "Vai trò",
                dataIndex: "roleInMeeting",
                width: 110,
                align: "center",
                render: (role) => {
                  let color = "default";
                  let label = "Đại biểu";
                  if (role === "HOST") {
                    color = "red";
                    label = "Chủ tọa";
                  } else if (role === "SECRETARY") {
                    color = "blue";
                    label = "Thư ký";
                  } else if (role === "GUEST") {
                    color = "purple";
                    label = "Khách";
                  }
                  return <Tag color={color}>{label}</Tag>;
                },
              },
              {
                title: "Trạng thái",
                dataIndex: "attendanceStatus",
                width: 110,
                align: "center",
                render: (st) => (
                  <Tag color={st === "ATTENDED" ? "success" : "default"}>
                    {st === "ATTENDED" ? "Đã tham gia" : "Chưa vào"}
                  </Tag>
                ),
              },
              {
                title: "Thời gian điểm danh",
                dataIndex: "checkInTime",
                width: 140,
                render: (time) => (time ? dayjs(time).format("HH:mm:ss DD/MM") : "—"),
              },
              {
                title: "Tổng tgian họp",
                dataIndex: "totalAttendanceMinutes",
                width: 110,
                align: "center",
                render: (mins, r) => {
                  if (mins && mins > 0) return `${mins} phút`;
                  // Ước lượng nếu đang online
                  if (r.checkInTime) {
                    const diff = Math.max(1, Math.round((new Date() - new Date(r.checkInTime)) / 60000));
                    return `${diff} phút (đang họp)`;
                  }
                  return "—";
                },
              },
              {
                title: "Vị trí & Tọa độ",
                render: (_, r) => {
                  if (r.checkInCoords?.latitude && r.checkInCoords?.longitude) {
                    return (
                      <div className="space-y-1">
                        <div className="text-[11px] text-slate-600 truncate max-w-[150px]">
                          {r.checkInLocation || "Tọa độ GPS"}
                        </div>
                        <a
                          href={`https://www.google.com/maps?q=${r.checkInCoords.latitude},${r.checkInCoords.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
                        >
                          <EnvironmentOutlined /> Xem trên Maps
                        </a>
                      </div>
                    );
                  }
                  if (r.checkInLocation) {
                    return <span className="text-xs text-slate-600">{r.checkInLocation}</span>;
                  }
                  return <span className="text-xs text-slate-400">—</span>;
                },
              },
              {
                title: "Lịch sử vào/ra",
                width: 110,
                align: "center",
                render: (_, r) => (
                  <Button
                    size="small"
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => {
                      setSelectedAttendeeForLogs(r);
                      setIsAccessLogModalOpen(true);
                    }}
                  >
                    Chi tiết ({r.accessLogs?.length || 0})
                  </Button>
                ),
              },
            ]}
          />
        </div>
      </Modal>

      {/* Modal Lựa Chọn Phương Thức Tham Gia Khi Quét Mã QR */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-slate-800 text-base">
            <QrcodeOutlined className="text-blue-600" />
            {qrAuthStep === "choice" ? "Tham Gia Phiên Họp Số" : "Đăng Ký Khách Mời Tham Gia"}
          </div>
        }
        open={isGuestJoinModalOpen}
        closable={false}
        footer={
          qrAuthStep === "choice" ? null : [
            <Button
              key="back"
              onClick={() => setQrAuthStep("choice")}
              className="mr-2"
            >
              Quay lại
            </Button>,
            <Button
              key="submit"
              type="primary"
              loading={submittingGuest}
              onClick={() => guestForm.submit()}
              className="bg-blue-600 hover:bg-blue-500"
            >
              Vào phòng họp ngay
            </Button>,
          ]
        }
        width={qrAuthStep === "choice" ? 440 : 480}
        centered
      >
        {qrAuthStep === "choice" ? (
          <div className="py-3 text-center">
            <p className="text-slate-600 text-sm mb-5">
              Chào mừng bạn đến với phiên họp số <b>{meeting?.title || ""}</b>. Vui lòng lựa chọn hình thức tham dự của bạn:
            </p>

            <div className="space-y-3">
              <Button
                type="primary"
                size="large"
                block
                icon={<LoginOutlined />}
                onClick={() => {
                  navigate(`/login?redirect=${encodeURIComponent(`/meetings/${id}`)}`);
                }}
                className="bg-blue-600 hover:bg-blue-500 font-semibold h-12 flex items-center justify-center gap-2 text-base shadow-sm"
              >
                Đăng nhập tài khoản
              </Button>
              <div className="text-[12px] text-slate-400">
                (Dành cho cán bộ, giảng viên, đại biểu đã có tài khoản hệ thống)
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400 font-medium">Hoặc</span>
                </div>
              </div>

              <Button
                size="large"
                block
                icon={<UserOutlined />}
                onClick={() => setQrAuthStep("guest_form")}
                className="border-slate-300 hover:border-blue-500 hover:text-blue-600 font-semibold h-12 flex items-center justify-center gap-2 text-base"
              >
                Tham gia với tư cách Khách
              </Button>
              <div className="text-[12px] text-slate-400">
                (Nhập mã PIN, Họ tên, Chức vụ và Đơn vị để vào ngay phòng họp)
              </div>
            </div>
          </div>
        ) : (
          <div className="py-2">
            <p className="text-xs text-slate-500 mb-4">
              Vui lòng nhập mã PIN xác nhận phòng họp và thông tin đại diện để ghi danh tham gia:
            </p>
            <Form form={guestForm} layout="vertical" onFinish={handleGuestJoinSubmit}>
              <Form.Item
                name="pinCode"
                label="Mã xác nhận PIN phòng họp"
                rules={[{ required: true, message: "Vui lòng nhập mã PIN trên màn hình hoặc mã QR!" }]}
              >
                <Input
                  placeholder="Nhập mã PIN 4-6 số..."
                  size="large"
                  className="text-center font-bold tracking-widest text-lg"
                  maxLength={10}
                />
              </Form.Item>

              <Form.Item
                name="name"
                label="Họ và tên"
                rules={[{ required: true, message: "Vui lòng nhập Họ và tên của bạn!" }]}
              >
                <Input prefix={<UserOutlined className="text-slate-400" />} placeholder="Ví dụ: Nguyễn Văn An" />
              </Form.Item>

              <Row gutter={12}>
                <Col xs={24} sm={12}>
                  <Form.Item name="position" label="Chức vụ">
                    <Input placeholder="Ví dụ: Chuyên viên, Trưởng đoàn..." />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="department" label="Đơn vị / Cơ quan">
                    <Input placeholder="Ví dụ: Sở GD&ĐT, Trường ĐH..." />
                  </Form.Item>
                </Col>
              </Row>

              {/* Vị trí định vị GPS của Khách */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CompassOutlined className={guestLocation ? "text-emerald-600 text-base" : "text-slate-400 text-base"} />
                    <div>
                      <div className="text-xs font-semibold text-slate-700">Định vị điểm danh (GPS)</div>
                      <div className="text-[11px] text-slate-500">
                        {guestLocation ? guestLocation.text : "Chưa xác định tọa độ GPS"}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="small"
                    loading={fetchingGuestLocation}
                    icon={<CompassOutlined />}
                    onClick={async () => {
                      setFetchingGuestLocation(true);
                      const loc = await requestCurrentLocation(false);
                      if (loc) {
                        setGuestLocation(loc);
                        message.success("Đã lấy được tọa độ định vị GPS hiện tại!");
                      }
                      setFetchingGuestLocation(false);
                    }}
                    className={guestLocation ? "text-emerald-600 border-emerald-300" : ""}
                  >
                    {guestLocation ? "Cập nhật lại GPS" : "Lấy vị trí GPS"}
                  </Button>
                </div>
              </div>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PaperlessMeetingRoomPage;
