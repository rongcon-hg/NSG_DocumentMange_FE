import React, { useState, useEffect, useRef } from "react";
import { Popover, Avatar, Badge, Spin, Tooltip, Input } from "antd";
import {
  TeamOutlined,
  UserOutlined,
  ReloadOutlined,
  SearchOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance";
import Cookies from "js-cookie";
import DirectChatBox from "../Chat/DirectChatBox";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8081";

// Chuẩn hóa đường dẫn Avatar từ cơ sở dữ liệu
const getFullAvatarUrl = (avatar) => {
  if (!avatar) return null;
  if (typeof avatar === "string") {
    if (avatar.startsWith("http://") || avatar.startsWith("https://") || avatar.startsWith("data:")) {
      return avatar;
    }
    if (avatar.startsWith("/")) {
      return `${API_URL}${avatar}`;
    }
    return `${API_URL}/authen/avatar/${avatar}`;
  }
  if (typeof avatar === "object") {
    if (avatar.fileId) return `${API_URL}/authen/avatar/${avatar.fileId}`;
    if (avatar.url) {
      if (avatar.url.startsWith("http://") || avatar.url.startsWith("https://") || avatar.url.startsWith("data:")) {
        return avatar.url;
      }
      return `${API_URL}${avatar.url.startsWith("/") ? "" : "/"}${avatar.url}`;
    }
  }
  return null;
};

// Tạo chữ viết tắt từ tên người dùng (ví dụ: "Nguyễn Văn Luyện" -> "NL")
const getInitials = (name) => {
  if (!name) return "U";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

// Màu sắc tươi sáng ngẫu nhiên theo tên để phân biệt khi chưa có ảnh đại diện
const getAvatarColor = (name) => {
  if (!name) return "#10b981";
  const colors = [
    "#2563eb", // blue
    "#7c3aed", // violet
    "#059669", // emerald
    "#d97706", // amber
    "#e11d48", // rose
    "#0891b2", // cyan
    "#4f46e5", // indigo
    "#0d9488", // teal
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const OnlineUsersWidget = () => {
  const [data, setData] = useState({ totalOnline: 0, users: [] });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [chatSessions, setChatSessions] = useState([]); // Danh sách các phiên chat đang mở
  const [unreadSummary, setUnreadSummary] = useState({
    totalUnread: 0,
    unreadByPartner: {},
    recentChatMap: {},
  });
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const timerRef = useRef(null);
  const unreadTimerRef = useRef(null);

  // Lấy current user từ cookie & token nếu có
  const currentUser = (() => {
    try {
      const cookieUser = Cookies.get("currentUser");
      const token = Cookies.get("accessToken");
      let uid = null;
      let uname = null;
      let urole = null;

      if (token) {
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            uid = payload.userId || payload.id;
            urole = payload.role;
          }
        } catch (e) {}
      }

      if (cookieUser) {
        try {
          const parsed = JSON.parse(cookieUser);
          if (parsed && typeof parsed === "object") {
            uid = uid || parsed._id || parsed.id;
            uname = parsed.name;
          } else {
            uname = decodeURIComponent(cookieUser);
          }
        } catch (e) {
          uname = decodeURIComponent(cookieUser);
        }
      }

      return {
        _id: uid,
        id: uid,
        name: uname,
        role: urole,
      };
    } catch (e) {
      return null;
    }
  })();

  const currentUserId = currentUser?._id || currentUser?.id;
  const localAvatar = typeof localStorage !== "undefined" ? localStorage.getItem("user_avatar_url") : null;

  const fetchUnreadMessages = async () => {
    try {
      const res = await axiosInstance.get("/api/messages/unread-summary");
      if (res.data?.success) {
        setUnreadSummary({
          totalUnread: res.data.totalUnread || 0,
          unreadByPartner: res.data.unreadByPartner || {},
          recentChatMap: res.data.recentChatMap || {},
        });
      }
    } catch (e) {
      // ignore
    }
  };

  const sendHeartbeat = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      let res;
      try {
        res = await axiosInstance.post("/authen/heartbeat");
      } catch (postErr) {
        res = await axiosInstance.get("/authen/online-users");
      }

      if (res && res.data?.success) {
        const serverUsers = res.data.users || [];
        const serverTotal = res.data.totalOnline || serverUsers.length;
        setData({
          totalOnline: Math.max(serverTotal, currentUser ? 1 : 0),
          users: serverUsers,
        });
      }

      // Kèm lấy thống kê tin nhắn chưa đọc & gần nhất
      fetchUnreadMessages();
    } catch (error) {
      if (isManual) {
        console.error("Lỗi cập nhật người dùng online:", error);
      }
    } finally {
      if (isManual) setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      setData((prev) => ({
        ...prev,
        totalOnline: Math.max(prev.totalOnline, 1),
      }));
    }

    sendHeartbeat();

    // Heartbeat định kỳ mỗi 30 giây
    timerRef.current = setInterval(() => {
      sendHeartbeat();
    }, 30000);

    // Quét tin nhắn mới thường xuyên mỗi 6 giây để cập nhật người nhắn lên đầu
    unreadTimerRef.current = setInterval(() => {
      fetchUnreadMessages();
    }, 6000);

    const handleResize = () => {
      if (typeof window !== "undefined") {
        setIsMobile(window.innerWidth < 640);
        setWindowWidth(window.innerWidth);
      }
    };
    window.addEventListener("resize", handleResize);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (unreadTimerRef.current) clearInterval(unreadTimerRef.current);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Danh sách hiển thị: nếu server chưa kịp trả về nhưng user đang đăng nhập thì hiển thị user hiện tại
  const rawUsers =
    data.users && data.users.length > 0
      ? data.users
      : currentUser
      ? [
          {
            _id: currentUserId,
            name: currentUser.name || "Bạn",
            position: currentUser.role === "admin" ? "Quản trị viên" : "Cán bộ",
            department: currentUser.role === "admin" ? "Ban Quản trị" : "Đang kết nối",
            avatar: localAvatar || "",
            lastActive: new Date(),
          },
        ]
      : [];

  const displayCount = Math.max(data.totalOnline || 0, rawUsers.length, currentUser ? 1 : 0);

  // Lọc theo từ khóa tìm kiếm
  const filteredUsers = rawUsers.filter((u) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(term) ||
      u.department?.toLowerCase().includes(term) ||
      u.position?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term)
    );
  });

  // SẮP XẾP DANH SÁCH:
  // 1. "Bạn" (chính mình) luôn ở đầu
  // 2. Người có tin nhắn chưa đọc (unreadCount > 0) -> ĐƯA LÊN TRÊN ĐẦU
  // 3. Người có nhắn tin gần nhất (recentChatMap) -> ĐƯA LÊN TIẾP THEO
  // 4. Các người dùng còn lại sắp xếp theo thứ tự bảng chữ cái tiếng Việt
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const isMeA =
      (currentUserId && String(a._id) === String(currentUserId)) ||
      (currentUser?.name && a.name === currentUser.name);
    const isMeB =
      (currentUserId && String(b._id) === String(currentUserId)) ||
      (currentUser?.name && b.name === currentUser.name);

    if (isMeA) return -1;
    if (isMeB) return 1;

    const unreadA = unreadSummary.unreadByPartner?.[a._id] || 0;
    const unreadB = unreadSummary.unreadByPartner?.[b._id] || 0;

    // Ưu tiên người có tin nhắn chưa đọc
    if (unreadA > 0 || unreadB > 0) {
      if (unreadA > 0 && unreadB === 0) return -1;
      if (unreadB > 0 && unreadA === 0) return 1;
      if (unreadA !== unreadB) return unreadB - unreadA;
    }

    // Ưu tiên người có tin nhắn gần nhất (gửi hoặc nhận)
    const recentA = unreadSummary.recentChatMap?.[a._id]?.lastMessageAt;
    const recentB = unreadSummary.recentChatMap?.[b._id]?.lastMessageAt;

    if (recentA && recentB) {
      return new Date(recentB) - new Date(recentA);
    }
    if (recentA && !recentB) return -1;
    if (!recentA && recentB) return 1;

    // Mặc định xếp theo tên tiếng Việt
    return (a.name || "").localeCompare(b.name || "", "vi");
  });

  const handleOpenChat = (u) => {
    const isMe =
      (currentUserId && String(u._id) === String(currentUserId)) ||
      (currentUser?.name && u.name === currentUser.name);

    if (isMe) return;

    setChatSessions((prev) => {
      const idx = prev.findIndex((s) => String(s.partner._id) === String(u._id));
      if (idx >= 0) {
        // Đã có trong danh sách: mở rộng (un-minimize) và đưa lên vị trí ưu tiên
        const updated = [...prev];
        const existing = { ...updated[idx], isMinimized: false };
        updated.splice(idx, 1);
        return [existing, ...updated];
      }

      // Tối đa cửa sổ mở rộng cùng lúc tùy kích thước màn hình
      const maxExpanded = isMobile
        ? 1
        : Math.max(1, Math.min(3, Math.floor((windowWidth - 160) / 322)));
      const expandedCount = prev.filter((s) => !s.isMinimized).length;

      let next = [...prev];
      if (expandedCount >= maxExpanded) {
        // Tự động thu nhỏ cửa sổ cũ để nhường chỗ
        let count = 0;
        next = next.map((s) => {
          if (!s.isMinimized && count < expandedCount - maxExpanded + 1) {
            count++;
            return { ...s, isMinimized: true };
          }
          return s;
        });
      }

      // Giới hạn tối đa 4 phiên cùng lúc
      if (next.length >= 4) {
        next = next.slice(0, 3);
      }

      return [{ partner: u, isMinimized: false }, ...next];
    });

    setOpen(false);
  };

  const handleCloseChat = (partnerId) => {
    setChatSessions((prev) => prev.filter((s) => String(s.partner._id) !== String(partnerId)));
  };

  const handleToggleMinimize = (partnerId) => {
    setChatSessions((prev) =>
      prev.map((s) => {
        if (String(s.partner._id) === String(partnerId)) {
          const willExpand = s.isMinimized;
          if (willExpand) {
            setOpen(false); // Ẩn danh sách online xuống khi mở rộng khung chat
          }
          return { ...s, isMinimized: !s.isMinimized };
        }
        return s;
      })
    );
  };

  const popoverContent = (
    <div className="w-[calc(100vw-32px)] sm:w-[310px] max-w-[310px] text-xs">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
        <div className="flex items-center gap-1.5 font-semibold text-gray-800 text-sm truncate min-w-0">
          <TeamOutlined className="text-emerald-500 flex-shrink-0" />
          <span className="truncate">Người dùng online</span>
          <Badge
            count={displayCount}
            overflowCount={999}
            style={{ backgroundColor: "#10b981", fontSize: "11px", fontWeight: "bold" }}
          />
        </div>
        <Tooltip title="Làm mới danh sách">
          <button
            onClick={() => sendHeartbeat(true)}
            className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors flex-shrink-0"
          >
            <ReloadOutlined spin={loading} />
          </button>
        </Tooltip>
      </div>

      <div className="text-gray-500 mb-2.5 text-[11px] leading-tight">
        Ưu tiên hiển thị người có tin nhắn mới hoặc nhắn tin gần nhất lên đầu
      </div>

      {rawUsers.length > 5 && (
        <div className="mb-2">
          <Input
            size="small"
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="Tìm theo tên, chức vụ, đơn vị..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            className="text-xs rounded-md"
          />
        </div>
      )}

      {loading && sortedUsers.length === 0 ? (
        <div className="py-6 flex flex-col items-center justify-center text-gray-400 gap-2">
          <Spin size="small" />
          <span>Đang tải thông tin...</span>
        </div>
      ) : sortedUsers.length === 0 ? (
        <div className="py-6 text-center text-gray-400">
          {search ? "Không tìm thấy người dùng phù hợp" : "Chưa có người dùng nào khác online"}
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-gray-50">
          {sortedUsers.map((u) => {
            const isMe =
              (currentUserId && String(u._id) === String(currentUserId)) ||
              (currentUser?.name && u.name === currentUser.name);

            const posDisplay =
              u.position && u.position !== "Chưa thiết lập"
                ? u.position
                : u.role === "admin"
                ? "Quản trị viên"
                : "Cán bộ";

            const deptDisplay =
              u.department && u.department !== "Chưa phân bổ"
                ? u.department
                : u.role === "admin"
                ? "Ban Quản trị"
                : "";

            const fullAvatar = getFullAvatarUrl(u.avatar) || (isMe ? localAvatar : null);
            const initials = getInitials(u.name);
            const avatarColor = getAvatarColor(u.name);
            const unreadCount = unreadSummary.unreadByPartner?.[u._id] || 0;
            const recentChat = unreadSummary.recentChatMap?.[u._id];

            const recentTimeStr = recentChat?.lastMessageAt
              ? new Date(recentChat.lastMessageAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";

            return (
              <div
                key={u._id}
                onClick={() => !isMe && handleOpenChat(u)}
                className={`pt-1.5 flex items-center gap-2.5 p-1.5 rounded-lg transition-all ${
                  isMe
                    ? "bg-emerald-50/70 cursor-default"
                    : unreadCount > 0
                    ? "bg-emerald-50/90 border border-emerald-300 hover:bg-emerald-100/90 cursor-pointer shadow-sm group"
                    : recentChat
                    ? "bg-gray-50/70 hover:bg-emerald-50/60 cursor-pointer group"
                    : "hover:bg-emerald-50/60 cursor-pointer group"
                }`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar
                    src={fullAvatar}
                    size={34}
                    style={{
                      backgroundColor: fullAvatar ? "#f3f4f6" : avatarColor,
                      color: "#ffffff",
                      fontWeight: 600,
                      fontSize: "12px",
                      border: "1.5px solid #ffffff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    }}
                  >
                    {!fullAvatar && initials}
                  </Avatar>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span
                        className={`truncate text-xs transition-colors ${
                          unreadCount > 0
                            ? "font-bold text-emerald-900"
                            : "font-semibold text-gray-800 group-hover:text-emerald-700"
                        }`}
                      >
                        {u.name}
                      </span>
                      {isMe && (
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-700 rounded font-medium">
                          Bạn
                        </span>
                      )}
                    </div>
                    {recentTimeStr && (
                      <span className="text-[10px] text-gray-400 flex-shrink-0 font-normal">
                        {recentTimeStr}
                      </span>
                    )}
                  </div>

                  {/* Hiển thị tin nhắn gần nhất hoặc chức vụ/phòng ban */}
                  {unreadCount > 0 && recentChat?.lastMessageContent ? (
                    <div className="text-[11px] text-emerald-700 font-medium truncate flex items-center gap-1 mt-0.5">
                      <span>💬 {recentChat.lastMessageContent}</span>
                    </div>
                  ) : recentChat?.lastMessageContent ? (
                    <div className="text-[11px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
                      <span className="text-gray-400">💬 {recentChat.lastMessageContent}</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500 truncate mt-0.5">
                      {posDisplay}
                      {deptDisplay ? ` • ${deptDisplay}` : ""}
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 flex items-center gap-1.5 pl-1">
                  {unreadCount > 0 ? (
                    <Badge
                      count={unreadCount}
                      style={{
                        backgroundColor: "#ef4444",
                        fontSize: "10px",
                        fontWeight: "bold",
                        boxShadow: "0 0 0 1px #fff",
                      }}
                    />
                  ) : (
                    !isMe && (
                      <Tooltip title="Nhắn tin riêng">
                        <span className="text-gray-400 group-hover:text-emerald-600 text-sm p-1 rounded-full hover:bg-emerald-100/50 transition-colors">
                          <MessageOutlined />
                        </span>
                      </Tooltip>
                    )
                  )}
                  <span
                    className="inline-block w-2 h-2 rounded-full bg-emerald-500"
                    title="Đang hoạt động"
                  ></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
        <span>Bấm vào người dùng để nhắn tin</span>
        <span>Hệ thống số hóa NSG</span>
      </div>
    </div>
  );

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: isMobile ? 12 : 20,
          bottom: isMobile ? 16 : 20,
          zIndex: 9998,
        }}
        className="print:hidden select-none"
      >
        <Popover
          content={popoverContent}
          trigger="click"
          open={open}
          onOpenChange={(newOpen) => {
            // Khi người dùng bấm mở danh sách online, thu nhỏ các cửa sổ chat đang mở xuống
            // để người dùng dễ dàng xem danh sách và chọn người cần nhắn tin
            if (newOpen) {
              setChatSessions((prev) =>
                prev.map((s) => (!s.isMinimized ? { ...s, isMinimized: true } : s))
              );
            }
            setOpen(newOpen);
          }}
          placement="topRight"
          arrow={false}
          overlayStyle={{
            maxWidth: "calc(100vw - 16px)",
          }}
          overlayInnerStyle={{
            padding: "12px",
            borderRadius: "14px",
          }}
        >
          <Tooltip title={open ? "" : "Xem danh sách và nhắn tin nội bộ"} placement="left">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 text-gray-700 shadow-md hover:shadow-lg border rounded-full cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 group relative ${
                unreadSummary.totalUnread > 0
                  ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300/60"
                  : "bg-white/95 hover:bg-white border-emerald-100 hover:border-emerald-300"
              }`}
              style={{
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.08)",
              }}
            >
              {/* Glowing pulsing green dot */}
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>

              <TeamOutlined className="text-emerald-600 text-xs group-hover:scale-110 transition-transform" />

              <div className="flex items-baseline gap-1">
                <span className="font-bold text-xs text-gray-800">
                  {displayCount}
                </span>
                <span className="text-[11px] font-medium text-gray-500 group-hover:text-emerald-700">
                  online
                </span>
              </div>

              {/* Thông báo tin nhắn chưa đọc nổi bật */}
              {unreadSummary.totalUnread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold shadow animate-bounce">
                  {unreadSummary.totalUnread}
                </span>
              )}
            </div>
          </Tooltip>
        </Popover>
      </div>

      {/* Danh sách các cửa sổ chat đang mở (hỗ trợ nhiều người chat cùng lúc) */}
      {(() => {
        let currentRight = isMobile ? 12 : 20; // Cửa sổ đầu tiên xuất hiện ở PHÍA TRÊN nút Online sát phải

        return chatSessions.map((session, index) => {
          const sessionRight = currentRight;
          const boxWidth = session.isMinimized ? 190 : 320;
          const spacing = 12;

          // Cửa sổ đầu tiên (index 0) nằm ngay trên nút Online
          const sessionBottom = index === 0 ? (isMobile ? 62 : 66) : 20;

          // Trên mobile chỉ hiển thị 1 cuộc trò chuyện đang active nhất
          if (isMobile && index > 0) return null;

          // Trên desktop kiểm tra nếu vượt quá mép trái màn hình thì không vẽ thêm
          if (!isMobile && sessionRight + boxWidth > windowWidth - 16) {
            if (index > 0) return null;
          }

          currentRight += boxWidth + spacing;

          return (
            <DirectChatBox
              key={session.partner._id}
              partner={session.partner}
              isMinimized={session.isMinimized}
              onToggleMinimize={() => handleToggleMinimize(session.partner._id)}
              onClose={() => handleCloseChat(session.partner._id)}
              currentUserId={currentUserId}
              rightOffset={sessionRight}
              bottomOffset={sessionBottom}
              unreadCount={unreadSummary.unreadByPartner?.[session.partner._id] || 0}
              getFullAvatarUrl={getFullAvatarUrl}
              getInitials={getInitials}
              getAvatarColor={getAvatarColor}
              onMessageSent={fetchUnreadMessages}
              isMobile={isMobile}
            />
          );
        });
      })()}
    </>
  );
};

export default OnlineUsersWidget;
