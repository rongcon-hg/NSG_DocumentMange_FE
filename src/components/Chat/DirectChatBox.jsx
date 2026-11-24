import React, { useState, useEffect, useRef } from "react";
import { Avatar, Input, Button, Spin, Tooltip, message as antMessage } from "antd";
import {
  CloseOutlined,
  SendOutlined,
  MinusOutlined,
  UserOutlined,
  CheckOutlined,
  CheckCircleFilled,
} from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance";

const DirectChatBox = ({
  partner,
  onClose,
  currentUserId,
  getFullAvatarUrl,
  getInitials,
  getAvatarColor,
  onMessageSent,
}) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const pollTimerRef = useRef(null);

  const partnerId = partner?._id;

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  };

  const fetchConversation = async (silent = false) => {
    if (!partnerId) return;
    if (!silent) setLoading(true);
    try {
      const res = await axiosInstance.get(`/api/messages/conversation/${partnerId}`);
      if (res.data?.success) {
        setMessages(res.data.data || []);
      }
    } catch (error) {
      if (!silent) {
        console.error("Lỗi tải tin nhắn:", error);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (partnerId) {
      fetchConversation(false);

      // Polling tin nhắn mới mỗi 3 giây khi đang mở khung chat
      pollTimerRef.current = setInterval(() => {
        fetchConversation(true);
      }, 3000);
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [partnerId]);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const res = await axiosInstance.post("/api/messages", {
        recipientId: partnerId,
        content: text,
      });

      if (res.data?.success) {
        setInputText("");
        setMessages((prev) => [...prev, res.data.data]);
        scrollToBottom(true);
        if (onMessageSent) onMessageSent();
      }
    } catch (error) {
      antMessage.error(error.response?.data?.message || "Không thể gửi tin nhắn!");
    } finally {
      setSending(false);
    }
  };

  if (!partner) return null;

  const partnerAvatar = getFullAvatarUrl ? getFullAvatarUrl(partner.avatar) : partner.avatar;
  const partnerInitials = getInitials ? getInitials(partner.name) : "U";
  const partnerBgColor = getAvatarColor ? getAvatarColor(partner.name) : "#10b981";

  return (
    <div
      style={{
        position: "fixed",
        right: 140,
        bottom: 20,
        width: 320,
        zIndex: 10000,
      }}
      className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col transition-all duration-200 select-none print:hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3 py-2.5 flex items-center justify-between cursor-pointer shadow-sm">
        <div
          className="flex items-center gap-2 min-w-0 flex-1"
          onClick={() => setMinimized(!minimized)}
        >
          <div className="relative flex-shrink-0">
            <Avatar
              src={partnerAvatar}
              size={30}
              style={{
                backgroundColor: partnerAvatar ? "#ffffff" : partnerBgColor,
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: "bold",
              }}
            >
              {!partnerAvatar && partnerInitials}
            </Avatar>
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-300 border border-white rounded-full"></span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-xs truncate leading-tight">
              {partner.name}
            </div>
            <div className="text-[10px] text-emerald-100 truncate leading-tight">
              {partner.position || "Cán bộ"}
              {partner.department ? ` • ${partner.department}` : ""}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          <Tooltip title={minimized ? "Mở rộng" : "Thu nhỏ"}>
            <button
              onClick={() => setMinimized(!minimized)}
              className="p-1 hover:bg-white/20 rounded transition-colors text-white/90 hover:text-white"
            >
              <MinusOutlined className="text-xs" />
            </button>
          </Tooltip>
          <Tooltip title="Đóng hội thoại">
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded transition-colors text-white/90 hover:text-white"
            >
              <CloseOutlined className="text-xs" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Body: Danh sách tin nhắn */}
      {!minimized && (
        <>
          <div className="h-64 overflow-y-auto p-3 bg-gray-50 flex flex-col gap-2">
            {loading && messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 gap-1.5 text-xs">
                <Spin size="small" />
                <span>Đang tải tin nhắn...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs text-center px-4">
                <span className="text-xl mb-1">💬</span>
                <span>Bắt đầu cuộc trò chuyện với</span>
                <span className="font-semibold text-gray-600">{partner.name}</span>
              </div>
            ) : (
              messages.map((m) => {
                const senderId = m.sender?._id || m.sender;
                const isMine = currentUserId && String(senderId) === String(currentUserId);
                const timeStr = m.createdAt
                  ? new Date(m.createdAt).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";

                return (
                  <div
                    key={m._id}
                    className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-xs shadow-sm break-words ${
                        isMine
                          ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-none"
                          : "bg-white text-gray-800 border border-gray-100 rounded-bl-none"
                      }`}
                    >
                      {m.content}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 px-1 text-[9px] text-gray-400">
                      <span>{timeStr}</span>
                      {isMine && (
                        <span>
                          {m.isRead ? (
                            <span className="text-emerald-600 font-medium">Đã xem</span>
                          ) : (
                            <span>Đã gửi</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer: Ô nhập tin nhắn */}
          <div className="p-2 bg-white border-t border-gray-100 flex items-center gap-1.5">
            <Input.TextArea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Nhập tin nhắn... (Enter để gửi)"
              autoSize={{ minRows: 1, maxRows: 3 }}
              className="text-xs rounded-lg resize-none"
              autoFocus
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={sending}
              disabled={!inputText.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 border-none flex-shrink-0 flex items-center justify-center"
              size="middle"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default DirectChatBox;
