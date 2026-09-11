import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Upload,
  message,
  Tabs,
  Typography,
  Divider,
  Popconfirm,
  Spin,
  Alert,
  Row,
  Col,
} from 'antd';
import {
  SettingOutlined,
  PictureOutlined,
  FileImageOutlined,
  GlobalOutlined,
  UploadOutlined,
  ReloadOutlined,
  SaveOutlined,
  EyeOutlined,
  CloudUploadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import {
  getUnitSystemConfigApi,
  updateUnitSystemConfigApi,
  uploadSystemImageApi,
  resetSystemImageApi,
} from '../../api/systemConfigApi';
import { useSystemConfig } from '../../context/SystemConfigContext';
import DefaultLogo from '../../assets/Logo.webp';
import DefaultLoginBg from '../../assets/login-bg.png';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const UnitConfigPage = () => {
  const [form] = Form.useForm();
  const { refreshConfig } = useSystemConfig();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingType, setUploadingType] = useState(null); // 'loginBackground' | 'logo' | 'favicon'
  const [config, setConfig] = useState(null);

  // Tải dữ liệu cấu hình
  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await getUnitSystemConfigApi();
      if (res && res.success && res.data) {
        setConfig(res.data);
        form.setFieldsValue({
          siteName: res.data.siteName || '',
          shortName: res.data.shortName || '',
          siteDescription: res.data.siteDescription || '',
          organizationName: res.data.organizationName || '',
          address: res.data.address || '',
          hotline: res.data.hotline || '',
          email: res.data.email || '',
          websiteUrl: res.data.websiteUrl || '',
        });
      }
    } catch (error) {
      message.error(typeof error === 'string' ? error : 'Lỗi khi tải cấu hình hệ thống!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Lưu thông tin chữ / text
  const handleSaveInfo = async (values) => {
    try {
      setSaving(true);
      const res = await updateUnitSystemConfigApi(values);
      if (res && res.success) {
        message.success('Cập nhật thông tin cấu hình thành công!');
        setConfig(res.data);
        refreshConfig();
      }
    } catch (error) {
      message.error(typeof error === 'string' ? error : 'Lỗi khi lưu cấu hình!');
    } finally {
      setSaving(false);
    }
  };

  // Tải lên ảnh (đồng bộ Google Drive)
  const handleUploadImage = async (file, type) => {
    // Kiểm tra định dạng
    const isValidType = file.type.startsWith('image/') || file.name.endsWith('.ico');
    if (!isValidType) {
      message.error('Chỉ chấp nhận tệp tin hình ảnh (.png, .jpg, .jpeg, .webp, .ico, .svg)!');
      return false;
    }

    // Giới hạn 5MB
    const isLt5M = file.size / 1024 / 1024 < 5;
    if (!isLt5M) {
      message.error('Dung lượng hình ảnh phải nhỏ hơn 5MB!');
      return false;
    }

    try {
      setUploadingType(type);
      const formData = new FormData();
      formData.append('type', type);
      formData.append('image', file);

      const res = await uploadSystemImageApi(formData);
      if (res && res.success) {
        message.success(res.message || 'Tải ảnh và đồng bộ Google Drive thành công!');
        setConfig(res.data);
        refreshConfig();
      }
    } catch (error) {
      message.error(typeof error === 'string' ? error : 'Lỗi khi tải lên hình ảnh!');
    } finally {
      setUploadingType(null);
    }

    return false; // Chặn antd auto upload
  };

  // Đặt lại ảnh mặc định
  const handleResetImage = async (type) => {
    try {
      setUploadingType(type);
      const res = await resetSystemImageApi(type);
      if (res && res.success) {
        message.success(res.message || 'Đã khôi phục ảnh về mặc định!');
        setConfig(res.data);
        refreshConfig();
      }
    } catch (error) {
      message.error(typeof error === 'string' ? error : 'Lỗi khi đặt lại hình ảnh!');
    } finally {
      setUploadingType(null);
    }
  };

  // URL hiện tại có fallback
  const currentLoginBg = config?.loginBackground || DefaultLoginBg;
  const currentLogo = config?.logo || DefaultLogo;
  const currentFavicon = config?.favicon || DefaultLogo;

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      {/* Header trang */}
      <div className="mb-6 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                <SettingOutlined className="text-2xl" />
              </div>
              <div>
                <Title level={3} style={{ margin: 0 }}>
                  Cấu hình Đơn vị & Thương hiệu Hệ thống
                </Title>
                <Text type="secondary" className="text-sm">
                  Tùy chỉnh tên trang web, mô tả, ảnh nền đăng nhập, logo và favicon (tự động đồng bộ Google Drive)
                </Text>
              </div>
            </div>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchConfig}
            loading={loading}
          >
            Làm mới
          </Button>
        </div>
      </div>

      <Spin spinning={loading}>
        <Tabs
          defaultActiveKey="general"
          type="card"
          className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200"
          items={[
            {
              key: 'general',
              label: (
                <span className="flex items-center gap-1.5 font-medium">
                  <GlobalOutlined /> Thông tin chung
                </span>
              ),
              children: (
                <div>
                  <Alert
                    message="Thông tin thương hiệu hiển thị"
                    description="Các thông tin dưới đây sẽ hiển thị trên tiêu đề tab trình duyệt, đầu trang văn bản, chân trang và các biểu mẫu báo cáo."
                    type="info"
                    showIcon
                    className="mb-6"
                  />
                  <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSaveInfo}
                  >
                    <Row gutter={[24, 0]}>
                      <Col xs={24} md={14}>
                        <Form.Item
                          name="siteName"
                          label={<span className="font-semibold text-gray-700">Tên trang Website (Title tab trình duyệt)</span>}
                          rules={[{ required: true, message: 'Vui lòng nhập tên trang web!' }]}
                          extra="Hiển thị trên tab trình duyệt và tiêu đề chính của hệ thống."
                        >
                          <Input size="large" placeholder="VD: Hệ thống Quản lý Văn bản và Điều hành" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={10}>
                        <Form.Item
                          name="shortName"
                          label={<span className="font-semibold text-gray-700">Tên viết tắt / Tên ngắn</span>}
                          extra="Dùng trên giao diện thanh tiêu đề di động (VD: QLVB)."
                        >
                          <Input size="large" placeholder="VD: QLVB" />
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Form.Item
                          name="siteDescription"
                          label={<span className="font-semibold text-gray-700">Mô tả trang Website</span>}
                          extra="Mô tả tóm tắt chức năng hoặc khẩu hiệu của hệ thống."
                        >
                          <TextArea rows={3} placeholder="VD: Hệ thống quản lý văn bản đi, đến, điều hành công việc và thi đua khen thưởng..." />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={14}>
                        <Form.Item
                          name="organizationName"
                          label={<span className="font-semibold text-gray-700">Tên cơ quan / Đơn vị chủ quản</span>}
                          rules={[{ required: true, message: 'Vui lòng nhập tên cơ quan!' }]}
                          extra="Hiển thị trên đầu trang đăng nhập và các báo cáo xuất ra."
                        >
                          <Input size="large" placeholder="VD: Trường Cao Đẳng Bách Khoa Nam Sài Gòn" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={10}>
                        <Form.Item
                          name="hotline"
                          label={<span className="font-semibold text-gray-700">Hotline / Số điện thoại</span>}
                        >
                          <Input size="large" placeholder="VD: 028 3850 4440" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={14}>
                        <Form.Item
                          name="address"
                          label={<span className="font-semibold text-gray-700">Địa chỉ cơ quan</span>}
                        >
                          <Input size="large" placeholder="VD: 47 Cao Lỗ, Phường 4, Quận 8, TP. Hồ Chí Minh" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={10}>
                        <Form.Item
                          name="email"
                          label={<span className="font-semibold text-gray-700">Email liên hệ / hỗ trợ</span>}
                          rules={[{ type: 'email', message: 'Email không đúng định dạng!' }]}
                        >
                          <Input size="large" placeholder="VD: vanthu@namsaigon.edu.vn" />
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Form.Item
                          name="websiteUrl"
                          label={<span className="font-semibold text-gray-700">Website đơn vị</span>}
                        >
                          <Input size="large" placeholder="VD: https://namsaigon.edu.vn" />
                        </Form.Item>
                      </Col>
                    </Row>

                    <div className="flex justify-end mt-4">
                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SaveOutlined />}
                        size="large"
                        loading={saving}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Lưu thông tin cấu hình
                      </Button>
                    </div>
                  </Form>
                </div>
              ),
            },
            {
              key: 'loginBg',
              label: (
                <span className="flex items-center gap-1.5 font-medium">
                  <PictureOutlined /> Ảnh nền Đăng nhập
                </span>
              ),
              children: (
                <div>
                  <Alert
                    message="Ảnh nền màn hình đăng nhập"
                    description="Hình ảnh được tải lên sẽ tự động đồng bộ vào thư mục Google Drive của hệ thống qua Service Account và hiển thị tại trang đăng nhập (desktop và laptop). Định dạng khuyến nghị: 1920x1080px (PNG hoặc JPG)."
                    type="info"
                    showIcon
                    className="mb-6"
                  />

                  <Row gutter={[24, 24]}>
                    <Col xs={24} lg={14}>
                      <Card title="Xem trước màn hình đăng nhập (Preview)" className="shadow-sm border">
                        <div
                          className="w-full h-72 sm:h-96 rounded-lg overflow-hidden border border-gray-300 relative flex items-center justify-end p-6 bg-cover bg-center"
                          style={{
                            backgroundImage: `url(${currentLoginBg})`,
                          }}
                        >
                          {/* Khung mô phỏng form login nhỏ */}
                          <div className="w-48 bg-white/90 backdrop-blur p-3 rounded-lg shadow-lg border border-gray-200 hidden sm:block pointer-events-none">
                            <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-blue-100 flex items-center justify-center">
                              <img src={currentLogo} alt="Logo" className="w-6 h-6 object-contain" />
                            </div>
                            <div className="h-2.5 bg-gray-300 rounded mb-2 w-3/4 mx-auto"></div>
                            <div className="h-6 bg-gray-100 border rounded mb-2"></div>
                            <div className="h-6 bg-gray-100 border rounded mb-2"></div>
                            <div className="h-6 bg-blue-600 rounded"></div>
                          </div>

                          <div className="absolute bottom-2 left-3 bg-black/60 text-white text-xs px-2.5 py-1 rounded backdrop-blur">
                            {config?.loginBackground ? 'Đang dùng: Ảnh tải lên (Google Drive)' : 'Đang dùng: Ảnh mặc định hệ thống'}
                          </div>
                        </div>
                      </Card>
                    </Col>

                    <Col xs={24} lg={10}>
                      <Card title="Cập nhật ảnh nền" className="shadow-sm border">
                        <div className="space-y-4">
                          <Paragraph type="secondary">
                            Chọn tệp ảnh từ máy tính để tải lên. Ảnh sẽ được tự động đồng bộ lên Google Drive của hệ thống và áp dụng ngay lập tức cho toàn bộ người dùng.
                          </Paragraph>

                          <div className="flex flex-col gap-3">
                            <Upload
                              showUploadList={false}
                              beforeUpload={(file) => handleUploadImage(file, 'loginBackground')}
                              accept="image/*"
                            >
                              <Button
                                type="primary"
                                icon={<CloudUploadOutlined />}
                                size="large"
                                loading={uploadingType === 'loginBackground'}
                                className="w-full bg-blue-600 hover:bg-blue-700"
                              >
                                Tải lên ảnh nền mới
                              </Button>
                            </Upload>

                            {config?.loginBackground && (
                              <Popconfirm
                                title="Đặt lại ảnh nền mặc định?"
                                description="Hệ thống sẽ xóa ảnh tùy chỉnh trên Google Drive và sử dụng lại ảnh nền ban đầu."
                                onConfirm={() => handleResetImage('loginBackground')}
                                okText="Đặt lại"
                                cancelText="Hủy"
                                okButtonProps={{ danger: true }}
                              >
                                <Button
                                  danger
                                  icon={<ReloadOutlined />}
                                  size="large"
                                  loading={uploadingType === 'loginBackground'}
                                  className="w-full"
                                >
                                  Khôi phục ảnh nền mặc định
                                </Button>
                              </Popconfirm>
                            )}
                          </div>

                          <Divider />

                          <div className="text-xs text-gray-500 space-y-1">
                            <div>• Định dạng: JPG, PNG, WEBP</div>
                            <div>• Dung lượng tối đa: 5MB</div>
                            <div>• Độ phân giải tối ưu: 1920 x 1080 px</div>
                            <div>• Trạng thái đồng bộ: Google Drive Service Account</div>
                          </div>
                        </div>
                      </Card>
                    </Col>
                  </Row>
                </div>
              ),
            },
            {
              key: 'logo',
              label: (
                <span className="flex items-center gap-1.5 font-medium">
                  <FileImageOutlined /> Logo Trang Web
                </span>
              ),
              children: (
                <div>
                  <Alert
                    message="Ảnh đại diện & Logo trang web"
                    description="Logo hiển thị ở góc trái thanh điều hướng Header, màn hình đăng nhập, chân trang và tiêu đề các văn bản in ấn. Định dạng khuyến nghị: PNG trong suốt hoặc WEBP, kích thước vuông (512x512px)."
                    type="info"
                    showIcon
                    className="mb-6"
                  />

                  <Row gutter={[24, 24]}>
                    <Col xs={24} lg={12}>
                      <Card title="Xem trước Logo" className="shadow-sm border">
                        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 min-h-[260px]">
                          <div className="p-4 bg-white rounded-full shadow-md border mb-4">
                            <img
                              src={currentLogo}
                              alt="Logo Preview"
                              className="w-28 h-28 object-contain"
                            />
                          </div>

                          {/* Mô phỏng Header */}
                          <div className="w-full bg-gray-800 text-white p-3 rounded-lg flex items-center gap-3">
                            <img src={currentLogo} alt="Logo mini" className="w-8 h-8 object-contain" />
                            <span className="font-bold text-sm truncate">
                              {config?.siteName || 'HỆ THỐNG QUẢN LÝ VĂN BẢN'}
                            </span>
                          </div>

                          <div className="mt-3 text-xs text-gray-500">
                            {config?.logo ? 'Đang dùng: Logo tải lên (Google Drive)' : 'Đang dùng: Logo mặc định'}
                          </div>
                        </div>
                      </Card>
                    </Col>

                    <Col xs={24} lg={12}>
                      <Card title="Cập nhật Logo" className="shadow-sm border">
                        <div className="space-y-4">
                          <Paragraph type="secondary">
                            Tải logo mới lên hệ thống. Ảnh sẽ tự động đồng bộ Google Drive và thay đổi biểu tượng trên Header cùng form đăng nhập.
                          </Paragraph>

                          <div className="flex flex-col gap-3">
                            <Upload
                              showUploadList={false}
                              beforeUpload={(file) => handleUploadImage(file, 'logo')}
                              accept="image/*"
                            >
                              <Button
                                type="primary"
                                icon={<CloudUploadOutlined />}
                                size="large"
                                loading={uploadingType === 'logo'}
                                className="w-full bg-blue-600 hover:bg-blue-700"
                              >
                                Tải lên Logo mới
                              </Button>
                            </Upload>

                            {config?.logo && (
                              <Popconfirm
                                title="Khôi phục logo mặc định?"
                                description="Hệ thống sẽ xóa logo tùy chỉnh trên Google Drive và sử dụng lại logo ban đầu của nhà trường."
                                onConfirm={() => handleResetImage('logo')}
                                okText="Đặt lại"
                                cancelText="Hủy"
                                okButtonProps={{ danger: true }}
                              >
                                <Button
                                  danger
                                  icon={<ReloadOutlined />}
                                  size="large"
                                  loading={uploadingType === 'logo'}
                                  className="w-full"
                                >
                                  Khôi phục Logo mặc định
                                </Button>
                              </Popconfirm>
                            )}
                          </div>

                          <Divider />

                          <div className="text-xs text-gray-500 space-y-1">
                            <div>• Định dạng: PNG trong suốt, WEBP, SVG</div>
                            <div>• Dung lượng tối đa: 5MB</div>
                            <div>• Kích thước khuyến nghị: 512 x 512 px (tỉ lệ 1:1)</div>
                          </div>
                        </div>
                      </Card>
                    </Col>
                  </Row>
                </div>
              ),
            },
            {
              key: 'favicon',
              label: (
                <span className="flex items-center gap-1.5 font-medium">
                  <GlobalOutlined /> Favicon Tab Trình Duyệt
                </span>
              ),
              children: (
                <div>
                  <Alert
                    message="Biểu tượng Favicon của trang web"
                    description="Favicon là biểu tượng nhỏ hiển thị bên cạnh tiêu đề trang trên tab của trình duyệt (Chrome, Cốc Cốc, Edge, Firefox, Safari...). Tệp khuyến nghị: .ico, .png kích thước 32x32px hoặc 64x64px."
                    type="info"
                    showIcon
                    className="mb-6"
                  />

                  <Row gutter={[24, 24]}>
                    <Col xs={24} lg={12}>
                      <Card title="Mô phỏng Tab trình duyệt" className="shadow-sm border">
                        <div className="bg-gray-100 p-4 rounded-lg border">
                          {/* Giả lập tab Chrome */}
                          <div className="bg-gray-200 pt-2 px-2 rounded-t-lg flex items-center">
                            <div className="bg-white px-3 py-1.5 rounded-t-md flex items-center gap-2 shadow-sm max-w-xs border-t border-l border-r border-gray-300">
                              <img src={currentFavicon} alt="Favicon" className="w-4 h-4 object-contain rounded" />
                              <span className="text-xs font-medium text-gray-700 truncate">
                                {config?.siteName || 'Hệ thống Quản lý Văn bản'}
                              </span>
                              <span className="text-gray-400 text-xs ml-auto">×</span>
                            </div>
                          </div>
                          <div className="bg-white h-24 rounded-b-lg border border-t-0 p-3 text-xs text-gray-400 flex items-center justify-center">
                            Nội dung trang web...
                          </div>
                        </div>

                        <div className="text-center mt-3 text-xs text-gray-500">
                          {config?.favicon ? 'Đang dùng: Favicon tùy chỉnh (Google Drive)' : 'Đang dùng: Favicon mặc định'}
                        </div>
                      </Card>
                    </Col>

                    <Col xs={24} lg={12}>
                      <Card title="Cập nhật Favicon" className="shadow-sm border">
                        <div className="space-y-4">
                          <Paragraph type="secondary">
                            Chọn tệp favicon mới. Trình duyệt của bạn và mọi người dùng sẽ tự động đổi icon trên tab ngay sau khi cập nhật.
                          </Paragraph>

                          <div className="flex flex-col gap-3">
                            <Upload
                              showUploadList={false}
                              beforeUpload={(file) => handleUploadImage(file, 'favicon')}
                              accept="image/*,.ico"
                            >
                              <Button
                                type="primary"
                                icon={<CloudUploadOutlined />}
                                size="large"
                                loading={uploadingType === 'favicon'}
                                className="w-full bg-blue-600 hover:bg-blue-700"
                              >
                                Tải lên Favicon mới
                              </Button>
                            </Upload>

                            {config?.favicon && (
                              <Popconfirm
                                title="Khôi phục favicon mặc định?"
                                description="Hệ thống sẽ xóa favicon tùy chỉnh trên Google Drive và sử dụng lại favicon ban đầu."
                                onConfirm={() => handleResetImage('favicon')}
                                okText="Đặt lại"
                                cancelText="Hủy"
                                okButtonProps={{ danger: true }}
                              >
                                <Button
                                  danger
                                  icon={<ReloadOutlined />}
                                  size="large"
                                  loading={uploadingType === 'favicon'}
                                  className="w-full"
                                >
                                  Khôi phục Favicon mặc định
                                </Button>
                              </Popconfirm>
                            )}
                          </div>

                          <Divider />

                          <div className="text-xs text-gray-500 space-y-1">
                            <div>• Định dạng: ICO, PNG, SVG</div>
                            <div>• Dung lượng tối đa: 2MB</div>
                            <div>• Kích thước chuẩn: 32x32px, 48x48px hoặc 64x64px</div>
                          </div>
                        </div>
                      </Card>
                    </Col>
                  </Row>
                </div>
              ),
            },
          ]}
        />
      </Spin>
    </div>
  );
};

export default UnitConfigPage;
