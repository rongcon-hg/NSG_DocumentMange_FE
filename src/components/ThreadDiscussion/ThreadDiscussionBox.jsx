/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Avatar,
  Input,
  Button,
  Upload,
  message,
  Spin,
  Tag,
  Popconfirm,
} from "antd";
import {
  SendOutlined,
  PaperClipOutlined,
  UserOutlined,
  DeleteOutlined,
  MessageOutlined,
  AudioOutlined,
  StopOutlined,
  PlayCircleOutlined,
  CloseCircleOutlined,
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

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Dọn dẹp recorder khi unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Bắt đầu ghi âm giọng nói
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        message.error("Trình duyệt của bạn không hỗ trợ ghi âm trực tiếp");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Dừng tracks của mic
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes("mp4") ? "m4a" : "webm";
        const voiceFileName = `Voice_Note_${dayjs().format("YYYYMMDD_HHmmss")}.${ext}`;
        const voiceFile = new File([audioBlob], voiceFileName, { type: mimeType });

        // Tự động thêm file ghi âm vào fileList
        setFileList((prev) => [
          ...prev,
          {
            uid: `voice-${Date.now()}`,
            name: voiceFileName,
            originFileObj: voiceFile,
            isAudio: true,
          },
        ]);
        message.success("Đã hoàn tất đoạn ghi âm và đính kèm vào nội dung!");
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Lỗi khi truy cập Microphone:", err);
      message.error("Không thể truy cập Microphone: " + (err.message || "Vui lòng cho phép quyền truy cập mic!"));
    }
  };

  // Dừng ghi âm
  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // Hủy ghi âm
  const cancelRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  // Gửi bình luận
  const handleSendComment = async () => {
    if (isRecording) {
      message.warning("Vui lòng dừng ghi âm trước khi gửi");
      return;
    }

    if (!content.trim() && fileList.length === 0) {
      message.warning("Vui lòng nhập nội dung trao đổi hoặc đính kèm tệp");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("targetType", targetType);
      formData.append("targetId", targetId);
      formData.append(
        "content",
        content.trim() || (fileList.some((f) => f.isAudio || (f.name && f.name.startsWith("Voice_Note_"))) ? "🎙️ [Ghi chú thoại]" : "📎 [Tệp đính kèm]")
      );

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

                  {/* Tệp đính kèm & Voice Note player */}
                  {item.attachments && item.attachments.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-white/20 space-y-2">
                      {item.attachments.map((att, attIdx) => {
                        const isAudio =
                          att.mimeType?.startsWith("audio/") ||
                          att.fileName?.toLowerCase().endsWith(".webm") ||
                          att.fileName?.toLowerCase().endsWith(".mp3") ||
                          att.fileName?.toLowerCase().endsWith(".m4a") ||
                          att.fileName?.toLowerCase().endsWith(".wav") ||
                          att.fileName?.toLowerCase().endsWith(".ogg") ||
                          att.fileName?.startsWith("Voice_Note_");

                        return (
                          <div key={attIdx} className="space-y-1">
                            {isAudio ? (
                              <div className="flex flex-col gap-1 bg-black/10 p-1.5 rounded-md">
                                <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${isMe ? "text-blue-100" : "text-blue-700"}`}>
                                  <AudioOutlined /> {att.fileName}
                                </span>
                                <audio controls className="w-full h-8 max-w-[260px] outline-none" src={att.fileUrl} preload="metadata">
                                  Trình duyệt không hỗ trợ nghe file âm thanh.
                                </audio>
                              </div>
                            ) : (
                              <a
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
                            )}
                          </div>
                        );
                      })}
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

      {/* Hiển thị thanh đếm thời gian khi đang ghi âm */}
      {isRecording && (
        <div className="px-3 py-2 bg-red-50 border-t border-red-200 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 text-red-600 font-semibold text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block animate-ping" />
            <span>Đang ghi âm ghi chú thoại: {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="small" type="primary" danger icon={<StopOutlined />} onClick={stopRecording} className="text-xs rounded-md">
              Xong & Đính kèm
            </Button>
            <Button size="small" type="text" onClick={cancelRecording} className="text-xs text-gray-500 hover:text-red-600">
              Hủy
            </Button>
          </div>
        </div>
      )}

      {/* Danh sách tệp chờ gửi (kèm chỉ báo ghi chú thoại) */}
      {fileList.length > 0 && (
        <div className="px-3 pt-2 bg-gray-50/70 border-t border-gray-100 flex flex-wrap gap-1.5">
          {fileList.map((file) => (
            <Tag
              key={file.uid}
              closable
              onClose={() => setFileList((prev) => prev.filter((f) => f.uid !== file.uid))}
              color={file.isAudio || file.name?.startsWith("Voice_Note_") ? "magenta" : "blue"}
              className="text-xs flex items-center gap-1 py-0.5 px-2"
            >
              {file.isAudio || file.name?.startsWith("Voice_Note_") ? <AudioOutlined /> : <PaperClipOutlined />}
              <span className="max-w-[150px] truncate">{file.name}</span>
            </Tag>
          ))}
        </div>
      )}

      {/* Ô nhập nội dung */}
      <div className="p-3 bg-white border-t border-gray-100 flex flex-col gap-2">
        <Input.TextArea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nhập ý kiến trao đổi hoặc bấm Ghi âm giọng nói bên dưới..."
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
          <div className="flex items-center gap-1.5">
            <Upload
              beforeUpload={(file) => {
                setFileList((prev) => [...prev, file]);
                return false;
              }}
              fileList={[]}
              showUploadList={false}
              multiple
            >
              <Button size="small" icon={<PaperClipOutlined />} className="text-xs rounded-md">
                Đính kèm file
              </Button>
            </Upload>

            {/* Nút bấm Ghi âm giọng nói */}
            {!isRecording ? (
              <Button
                size="small"
                icon={<AudioOutlined className="text-rose-500" />}
                onClick={startRecording}
                className="text-xs rounded-md border-rose-200 text-rose-600 hover:text-rose-700 bg-rose-50/50"
              >
                Ghi chú thoại
              </Button>
            ) : (
              <Button
                size="small"
                type="primary"
                danger
                icon={<StopOutlined />}
                onClick={stopRecording}
                className="text-xs rounded-md animate-pulse"
              >
                Dừng ghi âm
              </Button>
            )}
          </div>

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
