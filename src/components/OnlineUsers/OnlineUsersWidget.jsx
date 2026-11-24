import React, { useState, useEffect, useRef } from "react";
import { Popover, Avatar, Badge, Spin, Tooltip, Input } from "antd";
import { TeamOutlined, UserOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance";
import Cookies from "js-cookie";

const OnlineUsersWidget = () => {
  const [data, setData] = useState({ totalOnline: 0, users: [] });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const timerRef = useRef(null);

  // Lấy current user từ cookie nếu có
  const currentUser = (() => {
    try {
      const cookieUser = Cookies.get("currentUser");
      if (cookieUser) {
        return JSON.parse(cookieUser);
      }
    } catch (e) {
      // ignore
    }
    return null;
  })();

  const currentUserId = currentUser?._id || currentUser?.id;

  const sendHeartbeat = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      let res;
      try {
        res = await axiosInstance.post("/authen/heartbeat");
      } catch (postErr) {
        // Fallback get nếu POST gặp lỗi
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
    } catch (error) {
      if (isManual) {
        console.error("Lỗi cập nhật người dùng online:", error);
      }
    } finally {
      if (isManual) setLoading(false);
    }
  };

  useEffect(() => {
    // Khởi tạo ngay trạng thái mặc định ít nhất 1 nếu đang đăng nhập
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

    // Khi người dùng chuyển tab và quay lại, cập nhật ngay
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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
            position: currentUser.position?.positionName || "Cán bộ",
            department: currentUser.department?.departmentName || "Đang kết nối",
            avatar: currentUser.avatar?.url || "",
            lastActive: new Date(),
          },
        ]
      : [];

  const displayCount = Math.max(data.totalOnline || 0, rawUsers.length, currentUser ? 1 : 0);

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

  const popoverContent = (
    <div className="w-80 max-w-[90vw] text-xs">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
        <div className="flex items-center gap-1.5 font-semibold text-gray-800 text-sm">
          <TeamOutlined className="text-emerald-500" />
          <span>Người dùng đang online</span>
          <Badge
            count={displayCount}
            overflowCount={999}
            style={{ backgroundColor: "#10b981", fontSize: "11px", fontWeight: "bold" }}
          />
        </div>
        <Tooltip title="Làm mới danh sách">
          <button
            onClick={() => sendHeartbeat(true)}
            className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
          >
            <ReloadOutlined spin={loading} />
          </button>
        </Tooltip>
      </div>

      <div className="text-gray-500 mb-2.5 text-[11px] leading-tight">
        Danh sách cán bộ, viên chức đang đăng nhập và tương tác trong hệ thống
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

      {loading && filteredUsers.length === 0 ? (
        <div className="py-6 flex flex-col items-center justify-center text-gray-400 gap-2">
          <Spin size="small" />
          <span>Đang tải thông tin...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-6 text-center text-gray-400">
          {search ? "Không tìm thấy người dùng phù hợp" : "Chưa có người dùng nào khác online"}
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 divide-y divide-gray-50">
          {filteredUsers.map((u) => {
            const isMe = currentUserId && String(u._id) === String(currentUserId);
            return (
              <div
                key={u._id}
                className={`pt-1.5 flex items-center gap-2.5 p-1.5 rounded-lg transition-colors ${
                  isMe ? "bg-emerald-50/70" : "hover:bg-gray-50"
                }`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar
                    src={u.avatar}
                    icon={<UserOutlined />}
                    size={32}
                    className="bg-emerald-600"
                  />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-800 truncate text-xs">
                      {u.name}
                    </span>
                    {isMe && (
                      <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-700 rounded font-medium">
                        Bạn
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {u.position || "Cán bộ"}
                    {u.department ? ` • ${u.department}` : ""}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Đang hoạt động"></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
        <span>Tự động cập nhật mỗi 30s</span>
        <span>Hệ thống số hóa NSG</span>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed",
        right: 24,
        bottom: 20,
        zIndex: 9998,
      }}
      className="print:hidden select-none"
    >
      <Popover
        content={popoverContent}
        trigger="click"
        open={open}
        onOpenChange={setOpen}
        placement="topRight"
        arrow={{ pointAtCenter: true }}
      >
        <Tooltip title={open ? "" : "Xem danh sách người đang online và đăng nhập"} placement="left">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 hover:bg-white text-gray-700 shadow-md hover:shadow-lg border border-emerald-100 hover:border-emerald-300 rounded-full cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 group"
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
          </div>
        </Tooltip>
      </Popover>
    </div>
  );
};

export default OnlineUsersWidget;
