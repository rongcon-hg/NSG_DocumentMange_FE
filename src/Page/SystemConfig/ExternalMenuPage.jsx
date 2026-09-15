import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Space,
  Tag,
  Tooltip,
  Popconfirm,
  message,
  Typography,
  Breadcrumb,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  LinkOutlined,
  GlobalOutlined,
  HomeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  getExternalMenusApi,
  createExternalMenuApi,
  updateExternalMenuApi,
  toggleExternalMenuStatusApi,
  deleteExternalMenuApi,
} from '../../api/externalMenuApi';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ExternalMenuPage = () => {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Tải danh sách menu (truyền all=true để lấy cả các menu đang ẩn)
  const fetchMenus = async () => {
    try {
      setLoading(true);
      const res = await getExternalMenusApi(true);
      if (res && res.success) {
        setMenus(res.data || []);
      }
    } catch (error) {
      message.error(typeof error === 'string' ? error : 'Lỗi khi tải danh sách menu liên kết!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenus();
  }, []);

  // Mở modal thêm mới
  const handleOpenAdd = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      order: 0,
      openInNewTab: true,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  // Mở modal chỉnh sửa
  const handleOpenEdit = (record) => {
    setEditingItem(record);
    form.resetFields();
    form.setFieldsValue({
      title: record.title,
      url: record.url,
      order: record.order ?? 0,
      openInNewTab: record.openInNewTab ?? true,
      isActive: record.isActive ?? true,
      description: record.description || '',
    });
    setIsModalOpen(true);
  };

  // Đóng modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    form.resetFields();
  };

  // Submit form thêm / sửa
  const handleFinish = async (values) => {
    try {
      setSubmitting(true);
      if (editingItem) {
        const res = await updateExternalMenuApi(editingItem._id, values);
        if (res && res.success) {
          message.success('Cập nhật menu liên kết thành công!');
          handleCloseModal();
          fetchMenus();
        }
      } else {
        const res = await createExternalMenuApi(values);
        if (res && res.success) {
          message.success('Thêm menu liên kết thành công!');
          handleCloseModal();
          fetchMenus();
        }
      }
    } catch (error) {
      message.error(typeof error === 'string' ? error : 'Có lỗi xảy ra khi lưu menu!');
    } finally {
      setSubmitting(false);
    }
  };

  // Bật/tắt trạng thái hiển thị
  const handleToggleStatus = async (record) => {
    try {
      const res = await toggleExternalMenuStatusApi(record._id);
      if (res && res.success) {
        message.success(`Đã ${res.data.isActive ? 'hiển thị' : 'ẩn'} menu "${record.title}"`);
        setMenus((prev) =>
          prev.map((item) =>
            item._id === record._id ? { ...item, isActive: res.data.isActive } : item
          )
        );
      }
    } catch (error) {
      message.error(typeof error === 'string' ? error : 'Lỗi khi thay đổi trạng thái menu!');
    }
  };

  // Xóa menu
  const handleDelete = async (id) => {
    try {
      const res = await deleteExternalMenuApi(id);
      if (res && res.success) {
        message.success('Xóa menu liên kết thành công!');
        fetchMenus();
      }
    } catch (error) {
      message.error(typeof error === 'string' ? error : 'Lỗi khi xóa menu liên kết!');
    }
  };

  // Lọc tìm kiếm
  const filteredMenus = menus.filter((item) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.url && item.url.toLowerCase().includes(q)) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  });

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Thứ tự',
      dataIndex: 'order',
      key: 'order',
      width: 80,
      align: 'center',
      sorter: (a, b) => (a.order || 0) - (b.order || 0),
      render: (order) => <Tag color="blue">{order ?? 0}</Tag>,
    },
    {
      title: 'Tên Menu',
      dataIndex: 'title',
      key: 'title',
      render: (text) => (
        <div className="flex items-center gap-2 font-medium text-gray-800">
          <GlobalOutlined className="text-blue-500 text-base" />
          <span>{text}</span>
        </div>
      ),
    },
    {
      title: 'Đường dẫn liên kết (URL)',
      dataIndex: 'url',
      key: 'url',
      render: (url, record) => (
        <a
          href={url}
          target={record.openInNewTab ? '_blank' : '_self'}
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 max-w-md truncate"
        >
          <span className="truncate">{url}</span>
          <LinkOutlined className="text-xs" />
        </a>
      ),
    },
    {
      title: 'Cách mở',
      dataIndex: 'openInNewTab',
      key: 'openInNewTab',
      width: 120,
      align: 'center',
      render: (openInNewTab) =>
        openInNewTab ? (
          <Tag color="cyan">Tab mới</Tag>
        ) : (
          <Tag color="default">Cùng trang</Tag>
        ),
    },
    {
      title: 'Mô tả / Ghi chú',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc) => desc || <span className="text-gray-400 italic">Không có</span>,
    },
    {
      title: 'Hiển thị',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 110,
      align: 'center',
      render: (isActive, record) => (
        <Switch
          checked={isActive}
          checkedChildren="Bật"
          unCheckedChildren="Tắt"
          onChange={() => handleToggleStatus(record)}
        />
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Chỉnh sửa menu">
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa menu">
            <Popconfirm
              title="Xác nhận xóa"
              description={`Bạn có chắc muốn xóa menu "${record.title}"?`}
              onConfirm={() => handleDelete(record._id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button type="primary" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-4">
        <Breadcrumb.Item href="/">
          <HomeOutlined />
        </Breadcrumb.Item>
        <Breadcrumb.Item>Quản lý</Breadcrumb.Item>
        <Breadcrumb.Item>Quản lý Menu</Breadcrumb.Item>
      </Breadcrumb>

      <Card
        bordered={false}
        className="shadow-sm rounded-lg"
        title={
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <GlobalOutlined style={{ fontSize: '24px' }} />
            </div>
            <div>
              <Title level={4} className="!mb-0 text-gray-800">
                Quản lý Menu Website Liên kết
              </Title>
              <Text type="secondary" className="text-xs sm:text-sm">
                Thiết lập danh sách các website, liên kết bên ngoài hiển thị trong mục &quot;Website liên kết&quot; trên thanh menu cho tất cả người dùng
              </Text>
            </div>
          </div>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenAdd}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Thêm menu mới
          </Button>
        }
      >
        {/* Thanh công cụ tìm kiếm và làm mới */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-4">
          <Input
            placeholder="Tìm theo tên menu, đường dẫn URL..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            className="max-w-md"
          />
          <Button icon={<ReloadOutlined />} onClick={fetchMenus} loading={loading}>
            Làm mới
          </Button>
        </div>

        {/* Bảng dữ liệu */}
        <Table
          columns={columns}
          dataSource={filteredMenus}
          rowKey="_id"
          loading={loading}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ['10', '15', '30', '50'],
            showTotal: (total) => `Tổng cộng ${total} menu liên kết`,
          }}
          scroll={{ x: 800 }}
          className="border border-gray-100 rounded-lg overflow-hidden"
        />
      </Card>

      {/* Modal Thêm / Chỉnh sửa */}
      <Modal
        title={editingItem ? 'Chỉnh sửa Menu Liên kết' : 'Thêm Menu Liên kết Mới'}
        open={isModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        destroyOnClose
        centered
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          initialValues={{
            order: 0,
            openInNewTab: true,
            isActive: true,
          }}
          className="mt-4"
        >
          <Form.Item
            name="title"
            label="Tên Menu hiển thị"
            rules={[
              { required: true, message: 'Vui lòng nhập tên menu!' },
              { max: 200, message: 'Tên menu không được vượt quá 200 ký tự!' },
            ]}
          >
            <Input placeholder="Ví dụ: Trang chủ Trường CĐ Nam Sài Gòn" />
          </Form.Item>

          <Form.Item
            name="url"
            label="Đường dẫn liên kết (URL)"
            rules={[
              { required: true, message: 'Vui lòng nhập đường dẫn URL!' },
            ]}
            extra="Có thể nhập dạng https://namsaigon.edu.vn hoặc namsaigon.edu.vn"
          >
            <Input placeholder="Ví dụ: https://namsaigon.edu.vn" />
          </Form.Item>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Form.Item
              name="order"
              label="Thứ tự hiển thị"
              extra="Số nhỏ hơn sẽ hiển thị trước"
            >
              <InputNumber min={0} max={9999} className="w-full" />
            </Form.Item>

            <Form.Item
              name="openInNewTab"
              label="Mở ở tab mới?"
              valuePropName="checked"
            >
              <Switch checkedChildren="Có" unCheckedChildren="Không" />
            </Form.Item>
          </div>

          <Form.Item
            name="isActive"
            label="Trạng thái hiển thị"
            valuePropName="checked"
          >
            <Switch checkedChildren="Hiển thị" unCheckedChildren="Ẩn" />
          </Form.Item>

          <Form.Item name="description" label="Ghi chú / Mô tả (tùy chọn)">
            <TextArea rows={3} placeholder="Nhập ghi chú hoặc mô tả về liên kết này..." />
          </Form.Item>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button onClick={handleCloseModal} disabled={submitting}>
              Hủy
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {editingItem ? 'Lưu thay đổi' : 'Thêm menu'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ExternalMenuPage;
