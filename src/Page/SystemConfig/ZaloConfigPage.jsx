import React, { useEffect, useState } from "react";
import { Form, Input, Button, Switch, Card, Row, Col, Typography, message, Alert, Divider } from "antd";
import { SendOutlined, SaveOutlined, ReloadOutlined, ApiOutlined, CheckCircleOutlined } from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance";

const { Title, Text, Paragraph } = Typography;

const ZaloConfigPage = () => {
  const [form] = Form.useForm();
  const [testForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/zalo/config");
      if (res.data?.success) {
        const data = res.data.data;
        setConfig(data);
        form.setFieldsValue({
          oaId: data.oaId || "785749141891313000",
          appId: data.appId,
          isActive: data.isActive,
          templateMention: data.templateIds?.mention || "",
          templateUrgentTask: data.templateIds?.urgentTask || "",
          templateUrgentDoc: data.templateIds?.urgentDoc || "",
        });
      }
    } catch (error) {
      console.error("Lỗi fetch Zalo config:", error);
      message.error("Không thể tải cấu hình Zalo OA");
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
        isActive: values.isActive,
        templateIds: {
          mention: values.templateMention,
          urgentTask: values.templateUrgentTask,
          urgentDoc: values.templateUrgentDoc,
        },
      };

      const res = await axiosInstance.put("/zalo/config", payload);
      if (res.data?.success) {
        message.success("Lưu cấu hình Zalo OA thành công!");
        fetchConfig();
      }
    } catch (error) {
      console.error("Lỗi lưu cấu hình Zalo:", error);
      message.error(error.response?.data?.message || "Lỗi khi lưu cấu hình Zalo OA");
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async (values) => {
    try {
      setTesting(true);
      const res = await axiosInstance.post("/zalo/test-send", values);
      if (res.data?.success) {
        message.success("Đã gửi tin nhắn Zalo thành công!");
      }
    } catch (error) {
      console.error("Lỗi gửi tin nhắn test Zalo:", error);
      message.error(error.response?.data?.message || "Gửi tin Zalo thất bại");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <Card className="shadow-sm rounded-xl max-w-4xl mx-auto border-slate-200">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
          <div>
            <Title level={3} className="m-0 flex items-center gap-2">
              <ApiOutlined className="text-blue-600" /> Cấu hình Zalo Official Account (Zalo OA)
            </Title>
            <Text type="secondary">
              Tích hợp thông báo đẩy qua Zalo khi được nhắc tên (@mention), giao việc gấp hoặc có văn bản khẩn.
            </Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={fetchConfig} loading={loading}>
            Làm mới
          </Button>
        </div>

        <Alert
          message="Hướng dẫn liên kết Zalo OA"
          description={
            <div className="text-xs space-y-1 mt-1">
              <div>1. Cán bộ quét mã QR theo dõi Zalo OA cơ quan để nhận thông báo.</div>
              <div>2. Đăng ký Zalo App trên trang <a href="https://developers.zalo.me" target="_blank" rel="noreferrer" className="text-blue-600 underline">Zalo for Developers</a> để lấy App ID và Secret Key.</div>
              <div>3. Nhập Zalo User ID của cán bộ vào mục Quản lý người dùng để đồng bộ thông báo cá nhân.</div>
            </div>
          }
          type="info"
          showIcon
          className="mb-6"
        />

        <Form form={form} layout="vertical" onFinish={handleSave}>
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
                <Input.Password placeholder={config?.hasSecretKey ? "••••••••••••••••" : "Nhập Zalo Secret Key"} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="refreshToken"
                label="Refresh Token"
                tooltip={config?.hasRefreshToken ? "Đã lưu Refresh Token (để trống nếu không đổi)" : ""}
              >
                <Input.Password placeholder={config?.hasRefreshToken ? "••••••••••••••••" : "Nhập Zalo Refresh Token"} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16} className="mt-2">
            <Col xs={24} sm={12}>
              <Form.Item name="isActive" label="Kích hoạt gửi thông báo qua Zalo" valuePropName="checked">
                <Switch checkedChildren="BẬT" unCheckedChildren="TẮT" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <div className="text-xs text-slate-500 pt-2">
                Trạng thái Token:{" "}
                {config?.tokenExpiresAt ? (
                  <span className="text-emerald-600 font-medium">
                    Hết hạn vào {new Date(config.tokenExpiresAt).toLocaleString()}
                  </span>
                ) : (
                  <span className="text-amber-500">Chưa tạo Access Token</span>
                )}
              </div>
            </Col>
          </Row>

          <div className="flex justify-end mt-4">
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={saving}
              className="bg-blue-600 px-6"
            >
              Lưu cấu hình Zalo OA
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default ZaloConfigPage;
