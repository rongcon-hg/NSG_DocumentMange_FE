import React, { useState, useEffect, useRef } from "react";
import {
  List,
  Avatar,
  Input,
  Button,
  Upload,
  message,
  Spin,
  Tag,
  Tooltip,
  Popconfirm,
} from "antd";
import {
  SendOutlined,
  PaperClipOutlined,
  UserOutlined,
  DeleteOutlined,
  MessageOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/vi";
import axiosInstance from "../../api/axiosInstance";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

dayjs.extend(relativeTime);
dayjs.locale("vi");

const ThreadDiscussionBox = ({ targetType, targetId, title = "Trao đổi & Thảo luận nội bộ" }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const [fileList, setFileList] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState("");
  const commentsEndRef = useRef(null);

  // Lấy current user ID từ token
  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUserId(decoded.userId || decoded.id || "");
        setCurrentUserRole(decoded.role || "");
      } catch (err) {
        console.error("Lỗi decode token:", err);
      }
    }
  }, []);

  // Tải danh sách bình luận
  const fetchComments = async () => {
    if (!targetId || !targetType) return;
    try {
      setLoading(true);
      const res = await axiosInstance.get("/comments", {
        params: { targetType, targetId },
      });
      if (res.data?.success) {
        setComments(res.data.data || []);
      }
    } catch (error) {
      console.error("Lỗi lấy danh sách bình luận:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [targetType, targetId]);

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  // Gửi bình luận
  const handleSendComment = async () => {
    if (!content.trim() && fileList.length === 0) {
      message.warning("Vui lòng nhập nội dung trao đổi hoặc đính kèm tệp");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("targetType", targetType);
      formData.append("targetId", targetId);
      formData.append("content", content.trim());

      fileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append("files", file.originFileObj);
        }
      });

      const res = await axiosInstance.post("/comments", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data?.success) {
        setContent("");
        setFileList([]);
        message.success("Đã gửi ý kiến trao đổi");
        fetchComments();
      } else {
        message.error(res.data?.message || "Lỗi khi gửi trao đổi");
      }
    } catch (error) {
      console.error("Lỗi khi gửi trao đổi:", error);
      message.error(error.response?.data?.message || "Lỗi khi gửi trao đổi");
    } finally {
      setSubmitting(false);
    }
  };

  // Xóa bình luận
  const handleDeleteComment = async (commentId) => {
    try {
      const res = await axiosInstance.delete(`/comments/${commentId}`);
      if (res.data?.success) {
        message.success("Đã xóa ý kiến");
        setComments((prev) => prev.filter((c) => c._id !== commentId));
      }
    } catch (error) {
      message.error(error.response?.data?.message || "Không thể xóa ý kiến");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col mt-4">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex items-center justify-between">
        <div className="flex items-center gap-2 text-blue-900 font-semibold text-sm">
          <MessageOutlined className="text-blue-600" />
          <span>{title}</span>
          <Tag color="blue" className="rounded-full text-xs font-normal">
            {comments.length}
          </Tag>
        </div>
        <span className="text-xs text-gray-500">Trao đổi nội bộ trực tiếp</span>
      </div>

      {/* Danh sách bình luận */}
      <div className="p-4 overflow-y-auto max-h-80 space-y-3 bg-gray-50/50">
        {loading ? (
          <div className="text-center py-6">
            <Spin size="small" tip="Đang tải thảo luận..." />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-xs italic">
            Chưa có ý kiến trao đổi nào. Hãy là người đầu tiên để lại ý kiến!
          </div>
        ) : (
          comments.map((item) => {
            const isMe =
              item.sender?._id?.toString() === currentUserId?.toString() ||
              item.sender?.id?.toString() === currentUserId?.toString();
            const isAdmin = currentUserRole === "admin";

            return (
              <div
                key={item._id}
                className={`flex gap-2.5 items-start ${isMe ? "flex-row-reverse" : "flex-row"}`}
              >
                <Avatar
                  src={item.sender?.avatar?.url}
                  icon={<UserOutlined />}
                  size="small"
                  className={isMe ? "bg-blue-600" : "bg-indigo-600"}
                />
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 shadow-xs text-xs ${
                    isMe
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-white text-gray-800 border border-gray-100 rounded-tl-none"
                  }`}
                >
                  <div
                    className={`flex items-center justify-between gap-3 mb-1 text-[11px] ${
                      isMe ? "text-blue-100" : "text-gray-500"
                    }`}
                  >
                    <span className="font-semibold">
                      {isMe ? "Bạn" : item.sender?.name || "Cán bộ"}
                      {item.sender?.position?.positionName && (
                        <span className="font-normal opacity-80">
                          {" "}
                          ({item.sender.position.positionName})
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] opacity-75">
                      {dayjs(item.createdAt).fromNow()}
                    </span>
                  </div>

                  {/* Nội dung trao đổi */}
                  <div className="whitespace-pre-wrap leading-relaxed text-xs">
                    {item.content}
                  </div>

                  {/* Tệp đính kèm */}
                  {item.attachments && item.attachments.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-white/20 space-y-1">
                      {item.attachments.map((att, attIdx) => (
                        <a
                          key={attIdx}
                          href={att.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1.5 text-xs hover:underline ${
                            isMe ? "text-blue-100" : "text-blue-600"
                          }`}
                        >
                          <PaperClipOutlined />
                          <span className="truncate max-w-[200px]">{att.fileName}</span>
                          {att.size && <span className="opacity-70 text-[10px]">({att.size})</span>}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Nút xóa bình luận */}
                  {(isMe || isAdmin) && (
                    <div className="flex justify-end mt-1">
                      <Popconfirm
                        title="Xóa ý kiến này?"
                        okText="Xóa"
                        cancelText="Hủy"
                        onConfirm={() => handleDeleteComment(item._id)}
                      >
                        <Button
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          className={`!p-0 !h-auto text-[10px] ${
                            isMe
                              ? "!text-blue-200 hover:!text-white"
                              : "!text-gray-400 hover:!text-red-500"
                          }`}
                        />
                      </Popconfirm>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Ô nhập nội dung */}
      <div className="p-3 bg-white border-t border-gray-100 flex flex-col gap-2">
        <Input.TextArea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nhập ý kiến trao đổi, hướng xử lý (hỗ trợ đính kèm tệp bên dưới)..."
          rows={2}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSendComment();
            }
          }}
          className="text-xs resize-none rounded-lg"
        />

        <div className="flex items-center justify-between">
          <Upload
            beforeUpload={(file) => {
              setFileList((prev) => [...prev, file]);
              return false;
            }}
            fileList={fileList}
            onRemove={(file) => {
              setFileList((prev) => prev.filter((f) => f.uid !== file.uid));
            }}
            multiple
          >
            <Button size="small" icon={<PaperClipOutlined />} className="text-xs rounded-md">
              Đính kèm file
            </Button>
          </Upload>

          <Button
            type="primary"
            size="small"
            icon={<SendOutlined />}
            loading={submitting}
            onClick={handleSendComment}
            className="rounded-md bg-blue-600 hover:bg-blue-700 text-xs px-3"
          >
            Gửi ý kiến
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ThreadDiscussionBox;
