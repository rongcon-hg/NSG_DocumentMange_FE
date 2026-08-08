import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Space, Typography } from 'antd';
import { SaveOutlined, ThunderboltOutlined, FolderOpenOutlined } from '@ant-design/icons';
import axiosInstance from '../../api/axiosInstance';

const { Title, Text } = Typography;

const DriveConfig = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/api/drive-config');
      if (res.data && res.data.data) {
        form.setFieldsValue({
          clientEmail: res.data.data.clientEmail,
          privateKey: res.data.data.privateKey,
          folderId: res.data.data.folderId,
        });
      }
    } catch (error) {
      console.error('Lỗi khi tải cấu hình:', error);
      message.error('Không thể tải cấu hình Google Drive.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values) => {
    try {
      setLoading(true);
      
      // Xử lý nếu copy nguyên JSON
      let finalPrivateKey = values.privateKey;
      if (finalPrivateKey.trim().startsWith('{') && finalPrivateKey.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(finalPrivateKey);
          if (parsed.private_key) {
            finalPrivateKey = parsed.private_key;
          }
          if (parsed.client_email && !values.clientEmail) {
            values.clientEmail = parsed.client_email;
            form.setFieldsValue({ clientEmail: parsed.client_email });
          }
        } catch (e) {
          // Bỏ qua nếu parse lỗi
        }
      }
      
      const res = await axiosInstance.put('/api/drive-config', {
        ...values,
        privateKey: finalPrivateKey
      });
      
      if (res.data.success) {
        message.success('Lưu cấu hình thành công!');
        fetchConfig(); 
      }
    } catch (error) {
      console.error('Lỗi khi lưu cấu hình:', error);
      message.error(error.response?.data?.message || 'Có lỗi xảy ra khi lưu cấu hình.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      
      let finalPrivateKey = values.privateKey;
      if (finalPrivateKey.trim().startsWith('{') && finalPrivateKey.trim().endsWith('}')) {
        try {
          const parsed = JSON.parse(finalPrivateKey);
          if (parsed.private_key) {
            finalPrivateKey = parsed.private_key;
          }
        } catch (e) {}
      }

      const res = await axiosInstance.post('/api/drive-config/test', {
        ...values,
        privateKey: finalPrivateKey
      });
      if (res.data.success) {
        message.success(res.data.message);
      }
    } catch (error) {
      if (error.errorFields) {
        message.warning('Vui lòng điền đầy đủ thông tin trước khi test.');
      } else {
        console.error('Lỗi khi test kết nối:', error);
        message.error(error.response?.data?.message || 'Kết nối thất bại.');
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <Card
        title={
          <Space>
            <FolderOpenOutlined className="text-orange-500 text-xl" />
            <Title level={4} style={{ margin: 0 }}>Cấu hình Google Team Drive (Upload file)</Title>
          </Space>
        }
        className="shadow-md rounded-lg max-w-4xl mx-auto"
        loading={loading && !testing}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
        >
          <Form.Item
            name="clientEmail"
            label={<Text strong>Client Email (Email Service Account)</Text>}
            rules={[{ required: true, message: 'Vui lòng nhập Client Email' }, { type: 'email', message: 'Email không hợp lệ' }]}
          >
            <Input placeholder="Ví dụ: cdsupload@chuyendoiso-xxxxxx.iam.gserviceaccount.com" size="large" />
          </Form.Item>

          <Form.Item
            name="privateKey"
            label={<Text strong>Private Key (Có thể copy toàn bộ file JSON vào đây)</Text>}
            rules={[{ required: true, message: 'Vui lòng nhập Private Key' }]}
          >
            <Input.TextArea 
              rows={8} 
              placeholder='Nhập nội dung file JSON của Service Account hoặc chỉ copy phần giá trị của "private_key"' 
            />
          </Form.Item>

          <Form.Item
            name="folderId"
            label={<Text strong>Folder ID (Thư mục lưu ảnh/tài liệu)</Text>}
            rules={[{ required: true, message: 'Vui lòng nhập Folder ID' }]}
          >
            <Input placeholder="Ví dụ: 1dDKXJyt8du7UimS8mRtS-7ymjtjKFMWN" size="large" />
          </Form.Item>

          <div className="flex justify-end mt-6 space-x-4">
            <Button
              type="default"
              icon={<ThunderboltOutlined className="text-orange-500" />}
              onClick={handleTestConnection}
              loading={testing}
              size="large"
            >
              <span className="font-semibold text-gray-700">Test kết nối</span>
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={loading && !testing}
              size="large"
              className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600"
            >
              Lưu cấu hình
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default DriveConfig;
