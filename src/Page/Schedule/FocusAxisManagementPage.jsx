import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  message,
  Popconfirm,
  Tooltip,
  Typography,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  getFocusAxes,
  createFocusAxis,
  updateFocusAxis,
  deleteFocusAxis,
  resetDefaultFocusAxes,
} from '../../api/focusAxisApi';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const COLOR_PRESETS = [
  { label: 'Xanh dương (Blue)', value: 'blue' },
  { label: 'Xanh lam ngọc (Cyan)', value: 'cyan' },
  { label: 'Tím (Purple)', value: 'purple' },
  { label: 'Đỏ (Red)', value: 'red' },
  { label: 'Xanh lá (Green)', value: 'green' },
  { label: 'Vàng ánh kim (Gold)', value: 'gold' },
  { label: 'Cam (Orange)', value: 'orange' },
  { label: 'Xanh đậm (Geekblue)', value: 'geekblue' },
  { label: 'Hồng tím (Magenta)', value: 'magenta' },
];

const FocusAxisManagementPage = () => {
  const navigate = useNavigate();
  const [axes, setAxes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [form] = Form.useForm();

  // 1. Tải danh sách
  const fetchAxes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getFocusAxes();
      if (res && res.data) {
        setAxes(res.data);
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi tải danh sách trục kết quả');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAxes();
  }, [fetchAxes]);

  // 2. Mở modal tạo mới
  const handleOpenCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      code: `TRUC_${axes.length + 1}`,
      shortName: `Trục ${axes.length + 1}`,
      color: 'blue',
      displayOrder: axes.length + 1,
      isActive: true,
    });
    setModalVisible(true);
  };

  // 3. Mở modal cập nhật
  const handleOpenEdit = (record) => {
    setEditingItem(record);
    form.resetFields();
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      shortName: record.shortName || '',
      color: record.color || 'blue',
      displayOrder: record.displayOrder !== undefined ? record.displayOrder : 0,
      description: record.description || '',
      isActive: record.isActive !== undefined ? record.isActive : true,
    });
    setModalVisible(true);
  };

  // 4. Lưu (Tạo / Sửa)
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingItem) {
        await updateFocusAxis(editingItem._id, values);
        message.success('Cập nhật trục kết quả thành công!');
      } else {
        await createFocusAxis(values);
        message.success('Thêm trục kết quả mới thành công!');
      }

      setModalVisible(false);
      fetchAxes();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Lỗi khi lưu dữ liệu');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Xóa
  const handleDelete = async (id) => {
    try {
      await deleteFocusAxis(id);
      message.success('Đã xóa trục kết quả thành công!');
      fetchAxes();
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi xóa trục kết quả');
    }
  };

  // 6. Khôi phục 6 trục mặc định
  const handleResetDefaults = async () => {
    try {
      setResetting(true);
      await resetDefaultFocusAxes();
      message.success('Đã khôi phục 6 trục kết quả chuẩn mặc định thành công!');
      fetchAxes();
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi khôi phục dữ liệu mặc định');
    } finally {
      setResetting(false);
    }
  };

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_, __, idx) => <span className="font-semibold text-gray-500">{idx + 1}</span>,
    },
    {
      title: 'Mã trục',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      align: 'center',
      render: (code) => <Tag color="geekblue" className="font-mono font-bold tracking-wider">{code}</Tag>,
    },
    {
      title: 'Tên viết tắt',
      dataIndex: 'shortName',
      key: 'shortName',
      width: 110,
      align: 'center',
      render: (shortName, record) => (
        <Tag color={record.color || 'blue'} className="font-bold text-xs">
          {shortName || record.code}
        </Tag>
      ),
    },
    {
      title: 'Tên trục kết quả trọng tâm',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div className="py-1">
          <div className="font-semibold text-slate-900 text-sm leading-snug">{name}</div>
          {record.description && (
            <div className="text-xs text-gray-500 mt-0.5 italic">{record.description}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Thứ tự',
      dataIndex: 'displayOrder',
      key: 'displayOrder',
      width: 85,
      align: 'center',
      render: (order) => <span className="font-semibold">{order || 0}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 125,
      align: 'center',
      render: (isActive) => (
        <Tag
          icon={isActive ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          color={isActive ? 'success' : 'default'}
          className="font-semibold"
        >
          {isActive ? 'Đang dùng' : 'Tạm ẩn'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 130,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Chỉnh sửa">
            <Button
              size="small"
              type="primary"
              ghost
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Popconfirm
              title="Xóa trục kết quả này?"
              description="Các công việc đã hoàn thành trước đó vẫn giữ nguyên tên trục kết quả đã lưu."
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDelete(record._id)}
            >
              <Button size="small" danger ghost icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="w-full px-2 sm:px-4 md:px-6 py-4 space-y-4">
      <Card className="shadow-sm border-gray-200 rounded-xl">
        {/* HEADER */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-gray-100">
          <div className="w-full lg:w-auto">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                icon={<RollbackOutlined />}
                onClick={() => navigate('/schedule/done')}
                className="text-gray-500 hover:text-blue-600"
              >
                Về Công việc
              </Button>
              <Title level={4} className="!mb-0 flex items-center gap-2 text-blue-800 text-base sm:text-lg font-bold">
                <AppstoreOutlined className="text-blue-600" />
                Quản lý Trục kết quả trọng tâm
              </Title>
            </div>
            <Text type="secondary" className="text-xs sm:text-sm block mt-1">
              Danh mục các trục kết quả phục vụ phân loại nhiệm vụ khi báo cáo hoàn thành công việc và chấm điểm KPI
            </Text>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchAxes}
              loading={loading}
            >
              Làm mới
            </Button>
            <Popconfirm
              title="Khôi phục 6 trục kết quả chuẩn mặc định?"
              description="Hệ thống sẽ đồng bộ lại 6 trục kết quả chuẩn theo đúng quy định của UBND TP."
              okText="Đồng bộ"
              cancelText="Hủy"
              onConfirm={handleResetDefaults}
            >
              <Button
                icon={<ReloadOutlined />}
                loading={resetting}
                className="text-amber-600 border-amber-400 hover:bg-amber-50"
              >
                Khôi phục 6 trục chuẩn
              </Button>
            </Popconfirm>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Thêm trục kết quả
            </Button>
          </div>
        </div>

        {/* THÔNG BÁO HƯỚNG DẪN */}
        <Alert
          message="Hướng dẫn sử dụng"
          description="Danh mục các Trục kết quả trọng tâm tại đây sẽ tự động hiển thị trong ô chọn bắt buộc khi người dùng cập nhật công việc sang trạng thái Hoàn thành (https://qlvb.namsaigon.edu.vn/schedule/done). Quản trị viên và người quản lý có thể linh hoạt thêm, sửa hoặc ẩn/xóa bất kỳ lúc nào."
          type="info"
          showIcon
          className="my-3 text-xs"
        />

        {/* BẢNG DỮ LIỆU */}
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={axes}
          loading={loading}
          pagination={false}
          bordered
          size="middle"
          scroll={{ x: 900 }}
          className="shadow-xs rounded-lg overflow-hidden mt-3"
        />
      </Card>

      {/* MODAL THÊM / CẬP NHẬT */}
      <Modal
        title={
          <div className="text-blue-700 font-bold flex items-center gap-2">
            <AppstoreOutlined />
            {editingItem ? 'Cập nhật Trục kết quả trọng tâm' : 'Thêm mới Trục kết quả trọng tâm'}
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText={editingItem ? 'Lưu thay đổi' : 'Thêm mới'}
        cancelText="Hủy"
        width={650}
        style={{ maxWidth: '95vw' }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Form.Item
              name="code"
              label="Mã trục"
              rules={[{ required: true, message: 'Vui lòng nhập mã trục!' }]}
              tooltip="Mã định danh duy nhất (ví dụ: TRUC_1, TRUC_2...)"
            >
              <Input placeholder="TRUC_1" className="font-mono uppercase font-semibold" />
            </Form.Item>

            <Form.Item
              name="shortName"
              label="Tên viết tắt / Nhãn hiển thị"
              rules={[{ required: true, message: 'Vui lòng nhập tên viết tắt!' }]}
              tooltip="Tên ngắn gọn hiển thị trên thẻ Tag (ví dụ: Trục 1)"
            >
              <Input placeholder="Trục 1" />
            </Form.Item>

            <Form.Item
              name="color"
              label="Màu sắc thẻ tag"
              rules={[{ required: true, message: 'Vui lòng chọn màu sắc!' }]}
            >
              <Select placeholder="Chọn màu">
                {COLOR_PRESETS.map((c) => (
                  <Option key={c.value} value={c.value}>
                    <Tag color={c.value} className="mr-1">
                      {c.value}
                    </Tag>
                    <span className="text-xs">{c.label}</span>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="name"
            label="Tên đầy đủ của Trục kết quả trọng tâm"
            rules={[{ required: true, message: 'Vui lòng nhập đầy đủ tên trục kết quả!' }]}
            tooltip="Nội dung trọn vẹn hiển thị cho người thực hiện lựa chọn khi hoàn thành công việc"
          >
            <TextArea
              rows={3}
              placeholder="Ví dụ: TRỤC 1 - THỰC HIỆN MỤC TIÊU PHÁT TRIỂN KINH TẾ - XÃ HỘI VÀ NHIỆM VỤ CHÍNH TRỊ ĐƯỢC GIAO"
              className="font-medium"
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Diễn giải / Ghi chú chi tiết"
          >
            <TextArea rows={2} placeholder="Nội dung chi tiết diễn giải cho trục này (không bắt buộc)" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="displayOrder"
              label="Thứ tự hiển thị"
              tooltip="Số thứ tự hiển thị ưu tiên trên danh sách dropdown"
            >
              <InputNumber min={0} max={999} className="w-full" />
            </Form.Item>

            <Form.Item
              name="isActive"
              label="Trạng thái kích hoạt"
              valuePropName="checked"
            >
              <Switch checkedChildren="Đang dùng" unCheckedChildren="Tạm ẩn" defaultChecked />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default FocusAxisManagementPage;
