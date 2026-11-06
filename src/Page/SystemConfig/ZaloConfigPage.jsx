/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { Form, Input, Button, Switch, Card, Row, Col, Typography, message, Alert, Divider, Select, Tag } from "antd";
import { SendOutlined, SaveOutlined, ReloadOutlined, ApiOutlined, CheckCircleOutlined, TeamOutlined, BellOutlined, UserOutlined } from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance";
import { getAllUsers } from "../../api/auth";

const { Title, Text } = Typography;

const EVENT_ITEMS = [
  { key: "docNew", label: "Văn bản đến mới ban hành", desc: "Thông báo khi có văn bản đến mới gửi tới đơn vị/cá nhân" },
  { key: "docReview", label: "Trình ký & Xét duyệt văn bản", desc: "Thông báo khi trình ký lên BGH hoặc khi Quản lý/BGH duyệt, từ chối" },
  { key: "taskAssign", label: "Giao công việc mới", desc: "Thông báo ngay khi cán bộ được phân công chủ trì hoặc phối hợp công việc" },
  { key: "taskDeadline", label: "Cảnh báo hạn công việc", desc: "Nhắc nhở công việc sắp đến hạn hoặc đã quá hạn xử lý" },
  { key: "workSchedule", label: "Lịch công tác tuần", desc: "Thông báo khi Ban Giám hiệu phê duyệt hoặc ban hành lịch công tác tuần mới" },
  { key: "emulation", label: "Thi đua - Khen thưởng", desc: "Thông báo tiến độ xét duyệt hồ sơ đề nghị thi đua khen thưởng" },
  { key: "mention", label: "Nhắc tên (@mention) trong thảo luận", desc: "Thông báo khi được đồng nghiệp nhắc tên trong trao đổi công việc/văn bản" },
];

const ZaloConfigPage = () => {
  const [form] = Form.useForm();
  const [testUserForm] = Form.useForm();
  const [testGroupForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingUser, setTestingUser] = useState(false);
  const [testingGroup, setTestingGroup] = useState(false);
  const [config, setConfig] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchConfig();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const list = await getAllUsers();
      if (Array.isArray(list)) {
        setUsers(list);
      } else if (list?.data && Array.isArray(list.data)) {
        setUsers(list.data);
      }
    } catch (err) {
      console.warn("Không thể tải danh sách người dùng:", err);
    }
  };

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/zalo/config");
      if (res.data?.success) {
        const data = res.data.data;
        setConfig(data);
        const events = data.notificationEvents || {};
        form.setFieldsValue({
          oaId: data.oaId || "785749141891313000",
          appId: data.appId || "",
          isActive: !!data.isActive,
          groupNotificationsEnabled: !!data.groupNotificationsEnabled,
          groupWebhookUrl: data.groupWebhookUrl || "",
          groupChatId: data.groupChatId || "",
          templateMention: data.templateIds?.mention || "",
          templateUrgentTask: data.templateIds?.urgentTask || "",
          templateUrgentDoc: data.templateIds?.urgentDoc || "",
          event_docNew: events.docNew !== false,
          event_docReview: events.docReview !== false,
          event_taskAssign: events.taskAssign !== false,
          event_taskDeadline: events.taskDeadline !== false,
          event_workSchedule: events.workSchedule !== false,
          event_emulation: events.emulation !== false,
          event_mention: events.mention !== false,
        });
      }
    } catch (error) {
      console.error("Lỗi fetch Zalo config:", error);
      message.error("Không thể tải cấu hình Zalo Bot");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values) => {
    try {
      setSaving(true);
      const payload = {
        oaId: values.oaId,
        appId: values.appId,
        secretKey: values.secretKey || undefined,
        refreshToken: values.refreshToken || undefined,
        isActive: !!values.isActive,
        groupNotificationsEnabled: !!values.groupNotificationsEnabled,
        groupWebhookUrl: values.groupWebhookUrl || "",
        groupChatId: values.groupChatId || "",
        notificationEvents: {
          docNew: values.event_docNew !== false,
          docReview: values.event_docReview !== false,
          taskAssign: values.event_taskAssign !== false,
          taskDeadline: values.event_taskDeadline !== false,
          workSchedule: values.event_workSchedule !== false,
          emulation: values.event_emulation !== false,
          mention: values.event_mention !== false,
        },
        templateIds: {
          mention: values.templateMention,
          urgentTask: values.templateUrgentTask,
          urgentDoc: values.templateUrgentDoc,
        },
      };

      const res = await axiosInstance.put("/zalo/config", payload);
      if (res.data?.success) {
        message.success("Đã lưu cấu hình Zalo OA & Nhóm Zalo thành công!");
        fetchConfig();
      }
    } catch (error) {
      console.error("Lỗi lưu cấu hình Zalo:", error);
      message.error(error.response?.data?.message || "Lỗi khi lưu cấu hình Zalo");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSendUser = async (values) => {
    try {
      setTestingUser(true);
      const res = await axiosInstance.post("/zalo/test-send", values);
      if (res.data?.success) {
        message.success("Đã gửi tin nhắn Zalo cá nhân thành công!");
      }
    } catch (error) {
      console.error("Lỗi gửi tin nhắn test Zalo:", error);
      message.error(error.response?.data?.message || "Gửi tin Zalo cá nhân thất bại");
    } finally {
      setTestingUser(false);
    }
  };

  const handleTestSendGroup = async (values) => {
    try {
      setTestingGroup(true);
      const res = await axiosInstance.post("/zalo/test-send-group", values);
      if (res.data?.success) {
        message.success("Đã gửi tin nhắn thử nghiệm vào Nhóm Zalo thành công!");
      }
    } catch (error) {
      console.error("Lỗi gửi tin nhắn nhóm Zalo:", error);
      message.error(error.response?.data?.message || "Gửi tin vào Nhóm Zalo thất bại. Vui lòng lưu cấu hình trước khi thử!");
    } finally {
      setTestingGroup(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen space-y-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card className="shadow-sm rounded-xl border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200">
            <div>
              <Title level={3} className="m-0 flex items-center gap-2">
                <ApiOutlined className="text-blue-600" /> Cấu hình Thông báo Zalo Bot (Zalo OA & Nhóm Zalo)
              </Title>
              <Text type="secondary">
                Hỗ trợ đồng thời gửi tin nhắn riêng qua Zalo Official Account (OA) đến từng cán bộ và gửi tự động vào Nhóm Zalo chung của đơn vị.
              </Text>
            </div>
            <Button icon={<ReloadOutlined />} onClick={fetchConfig} loading={loading}>
              Làm mới
            </Button>
          </div>

          <Alert
            message="Hướng dẫn thiết lập Zalo Bot (Hỗ trợ cả Cá nhân & Nhóm Zalo)"
            description={
              <div className="text-xs space-y-1.5 mt-1">
                <div>
                  <b>1. Kênh Cá nhân (Zalo OA):</b> Đăng ký ứng dụng tại{" "}
                  <a href="https://developers.zalo.me" target="_blank" rel="noreferrer" className="text-blue-600 underline">
                    Zalo for Developers
                  </a>
                  , điền <b>OA ID, App ID, Secret Key, Refresh Token</b> và cập nhật <b>Zalo User ID</b> cho từng cán bộ tại mục Quản lý người dùng.
                </div>
                <div>
                  <b>2. Kênh Nhóm Zalo (Group Bot / Webhook):</b> Dán đường dẫn <b>Webhook URL</b> (từ Zalo Bot Server, n8n, Make/Zapier hoặc Zalo Group Bot trung gian) và <b>Group Chat ID</b> (nếu có) để hệ thống tự động bắn thông báo văn bản mới, lịch công tác, giao việc vào nhóm.
                </div>
              </div>
            }
            type="info"
            showIcon
            className="mb-6"
          />

          <Form form={form} layout="vertical" onFinish={handleSave}>
            {/* PHẦN 1: ZALO OA CÁ NHÂN */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 font-semibold text-slate-800 text-base">
                  <UserOutlined className="text-blue-600" /> 1. Kênh Tin nhắn Cá nhân (Zalo Official Account)
                </div>
                <Form.Item name="isActive" valuePropName="checked" className="m-0">
                  <Switch checkedChildren="ĐANG BẬT" unCheckedChildren="ĐANG TẮT" />
                </Form.Item>
              </div>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="oaId"
                    label="Zalo OA ID"
                    rules={[{ required: true, message: "Vui lòng nhập OA ID" }]}
                  >
                    <Input placeholder="Ví dụ: 785749141891313000" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="appId" label="Zalo App ID">
                    <Input placeholder="Nhập Zalo App ID" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="secretKey"
                    label="Secret Key"
                    tooltip={config?.hasSecretKey ? "Đã lưu Secret Key trên máy chủ (để trống nếu không đổi)" : ""}
                  >
                    <Input.Password placeholder={config?.hasSecretKey ? "•••••••••••••••• (Đã lưu)" : "Nhập Zalo Secret Key"} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="refreshToken"
                    label="Refresh Token"
                    tooltip={config?.hasRefreshToken ? "Đã lưu Refresh Token (để trống nếu không đổi)" : ""}
                  >
                    <Input.Password placeholder={config?.hasRefreshToken ? "•••••••••••••••• (Đã lưu)" : "Nhập Zalo Refresh Token"} />
                  </Form.Item>
                </Col>
              </Row>

              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span>Trạng thái Access Token:</span>
                {config?.tokenExpiresAt ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    Hợp lệ (Hết hạn vào {new Date(config.tokenExpiresAt).toLocaleString("vi-VN")})
                  </Tag>
                ) : (
                  <Tag color="warning">Chưa khởi tạo Access Token</Tag>
                )}
              </div>
            </div>

            {/* PHẦN 2: ZALO GROUP BOT / WEBHOOK */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 font-semibold text-slate-800 text-base">
                  <TeamOutlined className="text-emerald-600" /> 2. Kênh Thông báo Nhóm Zalo (Group Bot / Webhook)
                </div>
                <Form.Item name="groupNotificationsEnabled" valuePropName="checked" className="m-0">
                  <Switch checkedChildren="ĐANG BẬT" unCheckedChildren="ĐANG TẮT" />
                </Form.Item>
              </div>

              <Row gutter={16}>
                <Col xs={24} sm={16}>
                  <Form.Item
                    name="groupWebhookUrl"
                    label="Webhook URL nhận thông báo Nhóm Zalo"
                    extra="Hệ thống sẽ gửi POST JSON { text, content, message, chat_id } tới địa chỉ này khi có sự kiện mới."
                  >
                    <Input placeholder="https://your-bot-webhook-url.com/zalo-group-notify" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item
                    name="groupChatId"
                    label="Group Chat ID (Tùy chọn)"
                    extra="ID nhóm Zalo nếu Bot quản lý nhiều nhóm"
                  >
                    <Input placeholder="Ví dụ: group_nsg_01" />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            {/* PHẦN 3: TUỲ CHỌN SỰ KIỆN THÔNG BÁO */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6">
              <div className="flex items-center gap-2 font-semibold text-slate-800 text-base mb-4 pb-2 border-b border-slate-100">
                <BellOutlined className="text-amber-500" /> 3. Danh mục Sự kiện Tự động Gửi Thông báo Zalo
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {EVENT_ITEMS.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200/80"
                  >
                    <div className="pr-3">
                      <div className="font-medium text-slate-800 text-sm">{item.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{item.desc}</div>
                    </div>
                    <Form.Item name={`event_${item.key}`} valuePropName="checked" className="m-0 shrink-0">
                      <Switch size="small" checkedChildren="Bật" unCheckedChildren="Tắt" />
                    </Form.Item>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
                size="large"
                className="bg-blue-600 px-8 font-medium rounded-lg"
              >
                Lưu toàn bộ cấu hình Zalo Bot
              </Button>
            </div>
          </Form>
        </Card>

        {/* CARD KIỂM TRA GỬI TIN NHẮN THỬ NGHIỆM */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card
              title={
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <UserOutlined className="text-blue-600" /> Kiểm tra gửi tin Zalo Cá nhân (Zalo OA)
                </span>
              }
              className="shadow-sm rounded-xl border-slate-200 h-full"
            >
              <Form form={testUserForm} layout="vertical" onFinish={handleTestSendUser}>
                <Form.Item
                  name="userId"
                  label="Chọn cán bộ nhận tin thử nghiệm"
                  rules={[{ required: true, message: "Vui lòng chọn cán bộ" }]}
                >
                  <Select
                    showSearch
                    placeholder="Tìm tên cán bộ..."
                    optionFilterProp="label"
                    options={users.map((u) => ({
                      value: u._id,
                      label: `${u.name} ${u.zaloId ? `(Zalo ID: ${u.zaloId})` : "(Chưa gắn Zalo ID)"}`,
                    }))}
                  />
                </Form.Item>
                <Form.Item name="testMessage" label="Nội dung tin nhắn thử">
                  <Input.TextArea
                    rows={2}
                    placeholder="Mặc định: [QLVB] Xin chào, đây là tin nhắn kiểm tra kết nối từ hệ thống QLVB Nam Sài Gòn."
                  />
                </Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={testingUser}
                  className="bg-blue-600"
                >
                  Gửi thử cho Cán bộ
                </Button>
              </Form>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card
              title={
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <TeamOutlined className="text-emerald-600" /> Kiểm tra gửi tin vào Nhóm Zalo (Webhook)
                </span>
              }
              className="shadow-sm rounded-xl border-slate-200 h-full"
            >
              <Form form={testGroupForm} layout="vertical" onFinish={handleTestSendGroup}>
                <Form.Item name="testMessage" label="Nội dung tin nhắn gửi vào Nhóm">
                  <Input.TextArea
                    rows={4}
                    placeholder="[HỆ THỐNG VĂN PHÒNG SỐ] Đây là tin nhắn kiểm tra kết nối tự động tới Nhóm Zalo từ hệ thống QLVB Nam Sài Gòn."
                  />
                </Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={testingGroup}
                  className="bg-emerald-600 hover:!bg-emerald-500"
                >
                  Gửi thử vào Nhóm Zalo
                </Button>
              </Form>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default ZaloConfigPage;
