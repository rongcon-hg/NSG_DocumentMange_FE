import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Modal, Spin } from 'antd';
import { CheckOutlined, SendOutlined, MailOutlined } from '@ant-design/icons';
import { getSmtpConfigApi, saveSmtpConfigApi, testSmtpConfigApi } from '../../api/systemConfigApi';

const SmtpConfig = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  // Tải cấu hình hiện tại
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const res = await getSmtpConfigApi();
        if (res.success && res.data) {
          form.setFieldsValue({
            host: res.data.host || 'smtp.gmail.com',
            port: res.data.port || 465,
            senderName: res.data.senderName || '',
            user: res.data.user || '',
            pass: res.data.pass || '',
          });
          setTestEmail(res.data.user || '');
        }
      } catch (err) {
        message.error(typeof err === 'string' ? err : 'Không thể tải cấu hình SMTP!');
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [form]);

  // Lưu cấu hình
  const onFinish = async (values) => {
    try {
      setSaving(true);
      const res = await saveSmtpConfigApi(values);
      if (res.success) {
        message.success(res.message || 'Lưu cấu hình SMTP thành công!');
      } else {
        message.error(res.message || 'Lưu cấu hình thất bại!');
      }
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Lỗi khi lưu cấu hình SMTP!');
    } finally {
      setSaving(false);
    }
  };

  // Gửi thử nghiệm
  const handleTestMail = async () => {
    try {
      const values = await form.validateFields();
      if (!testEmail) {
        message.error('Vui lòng nhập địa chỉ email nhận thư thử nghiệm!');
        return;
      }

      setTesting(true);
      const res = await testSmtpConfigApi({
        ...values,
        toEmail: testEmail,
      });

      if (res.success) {
        message.success(res.message || 'Gửi email thử nghiệm thành công!');
        setTestModalVisible(false);
      } else {
        message.error(res.message || 'Gửi email thử nghiệm thất bại!');
      }
    } catch (err) {
      if (err.errorFields) {
        message.error('Vui lòng điền đầy đủ các thông số trước khi thử nghiệm!');
      } else {
        message.error(typeof err === 'string' ? err : 'Lỗi khi gửi email thử nghiệm!');
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <Card
          className="shadow-sm rounded-xl border border-gray-200"
          bodyStyle={{ padding: '28px 32px' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-6 text-gray-800 font-semibold text-lg border-b pb-4">
            <span className="text-xl">📧</span>
            <span>Cấu hình SMTP Gmail (Gửi thư thông báo)</span>
          </div>

          <Spin spinning={loading} tip="Đang tải cấu hình...">
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              autoComplete="off"
            >
              {/* Row 1: Host & Port */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                <Form.Item
                  label={<span className="font-medium text-gray-700">SMTP Host</span>}
                  name="host"
                  rules={[{ required: true, message: 'Vui lòng nhập SMTP Host!' }]}
                >
                  <Input
                    placeholder="smtp.gmail.com"
                    size="large"
                    className="rounded-lg"
                  />
                </Form.Item>

                <Form.Item
                  label={<span className="font-medium text-gray-700">SMTP Port</span>}
                  name="port"
                  rules={[{ required: true, message: 'Vui lòng nhập SMTP Port!' }]}
                >
                  <Input
                    placeholder="465"
                    size="large"
                    className="rounded-lg"
                  />
                </Form.Item>
              </div>

              {/* Row 2: Sender Name & User Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                <Form.Item
                  label={<span className="font-medium text-gray-700">Tên người gửi (Sender Name)</span>}
                  name="senderName"
                  rules={[{ required: true, message: 'Vui lòng nhập Tên người gửi!' }]}
                >
                  <Input
                    placeholder="Chuyên trang Tư vấn tuyển sinh Khoa Cơ khí"
                    size="large"
                    className="rounded-lg"
                  />
                </Form.Item>

                <Form.Item
                  label={<span className="font-medium text-gray-700">Email gửi (SMTP User)</span>}
                  name="user"
                  rules={[
                    { required: true, message: 'Vui lòng nhập Email gửi!' },
                    { type: 'email', message: 'Email không đúng định dạng!' },
                  ]}
                >
                  <Input
                    placeholder="chuyendoiso@nsgpc.edu.vn"
                    size="large"
                    className="rounded-lg"
                  />
                </Form.Item>
              </div>

              {/* Row 3: App Password */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                <Form.Item
                  label={<span className="font-medium text-gray-700">Mật khẩu ứng dụng (App Password)</span>}
                  name="pass"
                  rules={[{ required: true, message: 'Vui lòng nhập Mật khẩu ứng dụng!' }]}
                  extra={
                    <span className="text-xs text-gray-500">
                      Mật khẩu ứng dụng 16 ký tự được tạo trong phần Bảo mật tài khoản Google (2-Step Verification).
                    </span>
                  }
                >
                  <Input.Password
                    placeholder="••••••••••••••••"
                    size="large"
                    className="rounded-lg"
                  />
                </Form.Item>
              </div>

              {/* Footer Actions */}
              <div className="flex flex-wrap items-center justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                <Button
                  type="default"
                  icon={<SendOutlined />}
                  size="large"
                  className="rounded-lg text-gray-700 border-gray-300 hover:border-blue-500 hover:text-blue-500"
                  onClick={() => setTestModalVisible(true)}
                >
                  Gửi thử email
                </Button>

                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<CheckOutlined />}
                  loading={saving}
                  size="large"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-6 font-medium flex items-center border-none"
                  style={{ backgroundColor: '#00805a' }}
                >
                  Lưu cấu hình
                </Button>
              </div>
            </Form>
          </Spin>
        </Card>
      </div>

      {/* Modal gửi thử email */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-gray-800">
            <MailOutlined className="text-emerald-600" />
            <span>Gửi email thử nghiệm cấu hình SMTP</span>
          </div>
        }
        open={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        onOk={handleTestMail}
        confirmLoading={testing}
        okText="Gửi kiểm tra"
        cancelText="Hủy"
        okButtonProps={{
          style: { backgroundColor: '#00805a', borderColor: '#00805a' },
        }}
      >
        <div className="py-2">
          <p className="text-gray-600 text-sm mb-3">
            Hệ thống sẽ gửi một bức thư kiểm tra kết nối với các thông số SMTP bạn đã nhập.
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email nhận thư thử nghiệm:
          </label>
          <Input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="nhập-email-của-bạn@domain.com"
            size="large"
            className="rounded-lg"
          />
        </div>
      </Modal>
    </div>
  );
};

export default SmtpConfig;
