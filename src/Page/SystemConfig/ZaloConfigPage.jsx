/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { Form, Input, Button, Switch, Card, Row, Col, Typography, message, Alert, Select, Tag, Space } from "antd";
import { SendOutlined, SaveOutlined, ReloadOutlined, ApiOutlined, CheckCircleOutlined, TeamOutlined, BellOutlined, UserOutlined, SearchOutlined, LinkOutlined, RobotOutlined } from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance";
import { getAllUsers } from "../../api/auth";

const { Title, Text } = Typography;

const DEFAULT_BOT_TOKEN = "4045703669582412985:XsqkbXxIySfPqICvghIIFSSAPvFhlrTsahrkuxMZIJdTwtAjwSnAizZvWXvZdSns";
const DEFAULT_INVITE_LINK = "https://bot.zaloplatforms.com/groups/invite/bot.jrRZbwgC";

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
  const [detecting, setDetecting] = useState(false);
  const [testingUser, setTestingUser] = useState(false);
  const [testingGroup, setTestingGroup] = useState(false);
  const [config, setConfig] = useState(null);
  const [users, setUsers] = useState([]);
  const [detectedChats, setDetectedChats] = useState([]);

  useEffect(() => {
    fetchConfig();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await getAllUsers();
      const rawList = Array.isArray(res)
        ? res
        : Array.isArray(res?.users)
        ? res.users
        : Array.isArray(res?.data)
        ? res.data
        : [];
      // Chỉ lấy những người dùng có số điện thoại (hoặc đã có zaloId) và sắp xếp theo tên
      const usersWithPhone = rawList
        .filter((u) => u && ((u.mobile && String(u.mobile).trim() !== "") || (u.zaloId && String(u.zaloId).trim() !== "")))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"));
      setUsers(usersWithPhone);
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
        setDetectedChats(data.detectedChats || []);
        const events = data.notificationEvents || {};
        const botTokenVal = data.botToken || DEFAULT_BOT_TOKEN;
        const webhookVal = data.groupWebhookUrl || `https://bot-api.zaloplatforms.com/bot${botTokenVal}/sendMessage`;

        form.setFieldsValue({
          oaId: data.oaId || "785749141891313000",
          appId: data.appId || "",
          isActive: !!data.isActive,
          botToken: botTokenVal,
          botInviteLink: data.botInviteLink || DEFAULT_INVITE_LINK,
          groupNotificationsEnabled: data.groupNotificationsEnabled !== undefined ? !!data.groupNotificationsEnabled : true,
          groupWebhookUrl: webhookVal,
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

  const handleBotTokenChange = (e) => {
    const token = e.target.value.trim();
    if (token) {
      form.setFieldsValue({
        groupWebhookUrl: `https://bot-api.zaloplatforms.com/bot${token}/sendMessage`,
      });
    }
  };

  const handleDetectGroupChat = async () => {
    try {
      setDetecting(true);
      const botToken = form.getFieldValue("botToken");
      const res = await axiosInstance.post("/zalo/detect-group", { botToken });
      if (res.data?.success) {
        const result = res.data.data;
        if (result.detectedChats && result.detectedChats.length > 0) {
          setDetectedChats(result.detectedChats);
          form.setFieldsValue({
            groupChatId: result.groupChatId || result.detectedChats[0].chatId,
            groupWebhookUrl: result.groupWebhookUrl,
          });
        }
        fetchUsers();
        message.success(res.data.message);
      }
    } catch (error) {
      console.error("Lỗi dò tìm Group Chat ID:", error);
      message.error(error.response?.data?.message || "Không thể dò tìm Group Chat ID");
    } finally {
      setDetecting(false);
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
        botToken: values.botToken || "",
        botInviteLink: values.botInviteLink || DEFAULT_INVITE_LINK,
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
      message.error(error.response?.data?.message || "Gửi tin vào Nhóm Zalo thất bại. Vui lòng kiểm tra Group Chat ID!");
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

          <Form form={form} layout="vertical" onFinish={handleSave}>
            {/* PHẦN 1: ZALO GROUP BOT / WEBHOOK (ĐÃ GẮN SẴN BOT NSG-OFFICE) */}
            <div className="bg-white p-4 rounded-xl border border-emerald-200 mb-6 shadow-2xs">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 font-semibold text-slate-800 text-base">
                  <RobotOutlined className="text-emerald-600" /> 1. Kênh Thông báo Nhóm Zalo (Đã tích hợp Bot NSG-Office)
                  <Tag color="success" className="ml-1">Bot: {config?.botName || "Bot NSG-Office"}</Tag>
                </div>
                <Form.Item name="groupNotificationsEnabled" valuePropName="checked" className="m-0">
                  <Switch checkedChildren="ĐANG BẬT" unCheckedChildren="ĐANG TẮT" />
                </Form.Item>
              </div>

              <Alert
                type="success"
                showIcon
                className="mb-4"
                message="Hướng dẫn 2 bước kết nối Bot NSG-Office vào Nhóm Zalo của trường:"
                description={
                  <div className="text-xs space-y-1.5 mt-1">
                    <div>
                      <b>Bước 1:</b> Bấm vào link mời Bot:{" "}
                      <a
                        href={DEFAULT_INVITE_LINK}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 font-semibold underline inline-flex items-center gap-1"
                      >
                        <LinkOutlined /> {DEFAULT_INVITE_LINK}
                      </a>{" "}
                      để thêm <b>Bot NSG-Office</b> vào Nhóm Zalo của trường/phòng ban.
                    </div>
                    <div>
                      <b>Bước 2:</b> Vào nhóm Zalo vừa thêm Bot, gõ một tin nhắn bất kỳ (ví dụ: <code>@Bot NSG-Office xin chào</code>), sau đó bấm nút <b>&quot;Tự động dò tìm Group Chat ID&quot;</b> bên dưới để phần mềm tự động điền mã nhóm!
                    </div>
                  </div>
                }
              />

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="botToken"
                    label="Zalo Bot Token (HTTP API)"
                    extra="Khi thay đổi Bot Token, hệ thống tự động tạo Webhook URL tương ứng."
                  >
                    <Input.Password
                      placeholder="Nhập Bot Token..."
                      onChange={handleBotTokenChange}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="groupWebhookUrl"
                    label="Webhook URL nhận thông báo Nhóm Zalo"
                    extra="Đã được tạo tự động từ Bot Token của Bot NSG-Office."
                  >
                    <Input placeholder="https://bot-api.zaloplatforms.com/bot.../sendMessage" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16} align="middle">
                <Col xs={24} sm={14}>
                  <Form.Item
                    name="groupChatId"
                    label="Group Chat ID (ID Nhóm Zalo nhận thông báo)"
                    extra="Nhập trực tiếp hoặc bấm nút 'Tự động dò tìm Group Chat ID' bên cạnh."
                  >
                    <Input placeholder="Ví dụ: 84192837461928374" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={10}>
                  <Button
                    type="primary"
                    icon={<SearchOutlined />}
                    loading={detecting}
                    onClick={handleDetectGroupChat}
                    className="bg-emerald-600 hover:!bg-emerald-500 w-full mt-1"
                  >
                    Tự động dò tìm Group Chat ID
                  </Button>
                </Col>
              </Row>

              {detectedChats.length > 0 && (
                <div className="mt-2 p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs">
                  <div className="font-semibold text-emerald-800 mb-1.5">
                    Các nhóm/cuộc trò chuyện đã phát hiện (Bấm để chọn):
                  </div>
                  <Space wrap>
                    {detectedChats.map((c) => (
                      <Tag
                        key={c.chatId}
                        color="emerald"
                        className="cursor-pointer py-1 px-2.5 text-xs font-medium"
                        onClick={() => {
                          form.setFieldsValue({ groupChatId: c.chatId });
                          message.success(`Đã chọn nhóm: ${c.title} (${c.chatId})`);
                        }}
                      >
                        {c.title} — ID: {c.chatId}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
            </div>

            {/* PHẦN 2: ZALO OA CÁ NHÂN */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2 font-semibold text-slate-800 text-base">
                  <UserOutlined className="text-blue-600" /> 2. Kênh Tin nhắn Cá nhân (Zalo Official Account)
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
                  <TeamOutlined className="text-emerald-600" /> Kiểm tra gửi tin vào Nhóm Zalo (Bot NSG-Office)
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
                  label={`Chọn cán bộ nhận tin thử nghiệm (${users.length} cán bộ có SĐT)`}
                  rules={[{ required: true, message: "Vui lòng chọn cán bộ" }]}
                >
                  <Select
                    showSearch
                    placeholder="Tìm theo họ tên hoặc số điện thoại..."
                    optionFilterProp="label"
                    options={users.map((u) => {
                      const deptName = u.department?.departmentName ? ` - ${u.department.departmentName}` : "";
                      const isLinkedBot = u.zaloId && !/^(0|84|\+84)[0-9]{8,10}$/.test(String(u.zaloId).trim());
                      const statusStr = isLinkedBot ? `✅ Đã liên kết Bot (ID: ${u.zaloId})` : `📱 SĐT: ${u.mobile || u.zaloId}`;
                      return {
                        value: u._id,
                        label: `${u.name} (${statusStr}${deptName})`,
                      };
                    })}
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
        </Row>
      </div>
    </div>
  );
};

export default ZaloConfigPage;
