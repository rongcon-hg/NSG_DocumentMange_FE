import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Checkbox, message, Spin, Tooltip } from 'antd';
import { CheckOutlined, CopyOutlined } from '@ant-design/icons';
import { getGoogleLoginConfigApi, saveGoogleLoginConfigApi } from '../../api/systemConfigApi';

const GoogleLoginConfig = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [redirectUri, setRedirectUri] = useState('');
  const [copied, setCopied] = useState(false);

  // Tải cấu hình hiện tại
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setLoading(true);
        const res = await getGoogleLoginConfigApi();
        if (res.success && res.data) {
          form.setFieldsValue({
            isEnabled: res.data.isEnabled !== false,
            clientId: res.data.clientId || '',
            clientSecret: res.data.clientSecret || '',
          });

          // Xác định Redirect URI
          const fallbackUri = `${window.location.origin}/google/callback`;
          setRedirectUri(res.data.redirectUri || fallbackUri);
        }
      } catch (err) {
        message.error(typeof err === 'string' ? err : 'Không thể tải cấu hình Google Login!');
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
      const res = await saveGoogleLoginConfigApi(values);
      if (res.success) {
        message.success(res.message || 'Lưu cấu hình Đăng nhập bằng Google thành công!');
      } else {
        message.error(res.message || 'Lưu cấu hình thất bại!');
      }
    } catch (err) {
      message.error(typeof err === 'string' ? err : 'Lỗi khi lưu cấu hình Google Login!');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUri = () => {
    if (!redirectUri) return;
    navigator.clipboard.writeText(redirectUri);
    setCopied(true);
    message.success('Đã sao chép Redirect URI vào bộ nhớ tạm!');
    setTimeout(() => setCopied(false), 3000);
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
            <span className="text-xl">🔑</span>
            <span>Cấu hình Đăng nhập bằng Google</span>
          </div>

          <Spin spinning={loading} tip="Đang tải cấu hình...">
            <Form
              form={form}
              layout="vertical"
              onFinish={onFinish}
              autoComplete="off"
              initialValues={{ isEnabled: true }}
            >
              {/* Checkbox Kích hoạt */}
              <div className="mb-6">
                <Form.Item name="isEnabled" valuePropName="checked" className="mb-0">
                  <Checkbox className="font-semibold text-gray-800 text-base">
                    Kích hoạt tính năng Đăng nhập bằng Google
                  </Checkbox>
                </Form.Item>
              </div>

              {/* Google Client ID */}
              <Form.Item
                label={<span className="font-medium text-gray-700">Google Client ID</span>}
                name="clientId"
                rules={[{ required: true, message: 'Vui lòng nhập Google Client ID!' }]}
              >
                <Input
                  placeholder="788727332950-ghddu60j1kqja9v2k1bp215c5bf97to7.apps.googleusercontent.com"
                  size="large"
                  className="rounded-lg"
                />
              </Form.Item>

              {/* Google Client Secret */}
              <Form.Item
                label={<span className="font-medium text-gray-700">Google Client Secret</span>}
                name="clientSecret"
                rules={[{ required: true, message: 'Vui lòng nhập Google Client Secret!' }]}
              >
                <Input.Password
                  placeholder="••••••••••••••••••••••••"
                  size="large"
                  className="rounded-lg"
                />
              </Form.Item>

              {/* Thông tin cấu hình trên Google Cloud Console */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h4 className="font-semibold text-gray-800 text-base mb-1">
                  Thông tin cấu hình trên Google Cloud Console
                </h4>
                <p className="text-sm text-gray-500 mb-3">
                  Để tính năng này hoạt động, bạn cần cấu hình <strong className="text-gray-700">Authorized redirect URIs</strong> trên Google Cloud Console như sau:
                </p>

                <div className="bg-slate-900 text-gray-100 font-mono text-sm px-4 py-3 rounded-lg flex items-center justify-between border border-slate-800 shadow-inner overflow-x-auto">
                  <span className="select-all tracking-wide text-emerald-400">
                    {redirectUri || 'https://qlvb.namsaigon.edu.vn/google/callback'}
                  </span>
                  <Tooltip title={copied ? 'Đã sao chép' : 'Sao chép'}>
                    <Button
                      type="text"
                      icon={<CopyOutlined className="text-gray-400 hover:text-white" />}
                      onClick={handleCopyUri}
                      className="ml-2"
                    />
                  </Tooltip>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end mt-8 pt-4 border-t border-gray-100">
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
    </div>
  );
};

export default GoogleLoginConfig;
