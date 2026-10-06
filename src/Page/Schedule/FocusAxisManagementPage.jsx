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
  Tabs,
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
  OrderedListOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  getFocusAxes,
  createFocusAxis,
  updateFocusAxis,
  deleteFocusAxis,
  resetDefaultFocusAxes,
} from '../../api/focusAxisApi';
import {
  getQuarterlyTaskGroups,
  createQuarterlyTaskGroup,
  updateQuarterlyTaskGroup,
  deleteQuarterlyTaskGroup,
  resetDefaultQuarterlyTaskGroups,
} from '../../api/quarterlyTaskGroupApi';

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
  const [activeTab, setActiveTab] = useState('focus-axes');

  // ===================== TAB 1: TRỤC KẾT QUẢ TRỌNG TÂM =====================
  const [axes, setAxes] = useState([]);
  const [loadingAxes, setLoadingAxes] = useState(false);
  const [axisModalVisible, setAxisModalVisible] = useState(false);
  const [editingAxis, setEditingAxis] = useState(null);
  const [submittingAxis, setSubmittingAxis] = useState(false);
  const [resettingAxes, setResettingAxes] = useState(false);
  const [axisForm] = Form.useForm();

  const fetchAxes = useCallback(async () => {
    try {
      setLoadingAxes(true);
      const res = await getFocusAxes();
      if (res && res.data) {
        setAxes(res.data);
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi tải danh sách trục kết quả');
    } finally {
      setLoadingAxes(false);
    }
  }, []);

  useEffect(() => {
    fetchAxes();
  }, [fetchAxes]);

  const handleOpenCreateAxis = () => {
    setEditingAxis(null);
    axisForm.resetFields();
    axisForm.setFieldsValue({
      code: `TRUC_${axes.length + 1}`,
      shortName: `Trục ${axes.length + 1}`,
      color: 'blue',
      displayOrder: axes.length + 1,
      isActive: true,
    });
    setAxisModalVisible(true);
  };

  const handleOpenEditAxis = (record) => {
    setEditingAxis(record);
    axisForm.resetFields();
    axisForm.setFieldsValue({
      code: record.code,
      name: record.name,
      shortName: record.shortName || '',
      color: record.color || 'blue',
      displayOrder: record.displayOrder !== undefined ? record.displayOrder : 0,
      description: record.description || '',
      isActive: record.isActive !== undefined ? record.isActive : true,
    });
    setAxisModalVisible(true);
  };

  const handleSubmitAxis = async () => {
    try {
      const values = await axisForm.validateFields();
      setSubmittingAxis(true);

      if (editingAxis) {
        await updateFocusAxis(editingAxis._id, values);
        message.success('Cập nhật trục kết quả thành công!');
      } else {
        await createFocusAxis(values);
        message.success('Thêm trục kết quả mới thành công!');
      }

      setAxisModalVisible(false);
      fetchAxes();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Lỗi khi lưu dữ liệu');
    } finally {
      setSubmittingAxis(false);
    }
  };

  const handleDeleteAxis = async (id) => {
    try {
      await deleteFocusAxis(id);
      message.success('Đã xóa trục kết quả thành công!');
      fetchAxes();
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi xóa trục kết quả');
    }
  };

  const handleResetDefaultsAxis = async () => {
    try {
      setResettingAxes(true);
      await resetDefaultFocusAxes();
      message.success('Đã khôi phục 6 trục kết quả chuẩn mặc định thành công!');
      fetchAxes();
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi khôi phục dữ liệu mặc định');
    } finally {
      setResettingAxes(false);
    }
  };

  const axisColumns = [
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
      width: 130,
      align: 'center',
      render: (shortName, record) => (
        <Tag color={record.color || 'blue'} className="font-semibold">
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
              onClick={() => handleOpenEditAxis(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Popconfirm
              title="Xóa trục kết quả này?"
              description="Các công việc đã hoàn thành trước đó vẫn giữ nguyên tên trục kết quả đã lưu."
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDeleteAxis(record._id)}
            >
              <Button size="small" danger ghost icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ===================== TAB 2: TRỤC CÔNG VIỆC KẾ HOẠCH QUÝ =====================
  const [taskGroups, setTaskGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const [resettingGroups, setResettingGroups] = useState(false);
  const [groupForm] = Form.useForm();

  const fetchTaskGroups = useCallback(async () => {
    try {
      setLoadingGroups(true);
      const res = await getQuarterlyTaskGroups();
      if (res && res.data) {
        setTaskGroups(res.data);
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi tải danh sách trục công việc kế hoạch quý');
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    fetchTaskGroups();
  }, [fetchTaskGroups]);

  const handleOpenCreateGroup = () => {
    setEditingGroup(null);
    groupForm.resetFields();
    groupForm.setFieldsValue({
      code: `NHOM_${taskGroups.length + 1}`,
      shortName: `Nhóm ${taskGroups.length + 1}`,
      color: 'blue',
      displayOrder: taskGroups.length + 1,
      isActive: true,
    });
    setGroupModalVisible(true);
  };

  const handleOpenEditGroup = (record) => {
    setEditingGroup(record);
    groupForm.resetFields();
    groupForm.setFieldsValue({
      code: record.code,
      name: record.name,
      shortName: record.shortName || '',
      color: record.color || 'blue',
      displayOrder: record.displayOrder !== undefined ? record.displayOrder : 0,
      description: record.description || '',
      isActive: record.isActive !== undefined ? record.isActive : true,
    });
    setGroupModalVisible(true);
  };

  const handleSubmitGroup = async () => {
    try {
      const values = await groupForm.validateFields();
      setSubmittingGroup(true);

      if (editingGroup) {
        await updateQuarterlyTaskGroup(editingGroup._id, values);
        message.success('Cập nhật nhóm công việc thành công!');
      } else {
        await createQuarterlyTaskGroup(values);
        message.success('Thêm nhóm công việc mới thành công!');
      }

      setGroupModalVisible(false);
      fetchTaskGroups();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Lỗi khi lưu dữ liệu');
    } finally {
      setSubmittingGroup(false);
    }
  };

  const handleDeleteGroup = async (id) => {
    try {
      await deleteQuarterlyTaskGroup(id);
      message.success('Đã xóa nhóm công việc thành công!');
      fetchTaskGroups();
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi xóa nhóm công việc');
    }
  };

  const handleResetDefaultsGroup = async () => {
    try {
      setResettingGroups(true);
      await resetDefaultQuarterlyTaskGroups();
      message.success('Đã đồng bộ lại 8 nhóm nhiệm vụ chuẩn mặc định thành công!');
      fetchTaskGroups();
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi khôi phục dữ liệu mặc định');
    } finally {
      setResettingGroups(false);
    }
  };

  const groupColumns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_, __, idx) => <span className="font-semibold text-gray-500">{idx + 1}</span>,
    },
    {
      title: 'Mã nhóm',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      align: 'center',
      render: (code) => <Tag color="cyan" className="font-mono font-bold tracking-wider">{code}</Tag>,
    },
    {
      title: 'Tên viết tắt',
      dataIndex: 'shortName',
      key: 'shortName',
      width: 130,
      align: 'center',
      render: (shortName, record) => (
        <Tag color={record.color || 'blue'} className="font-semibold">
          {shortName || record.code}
        </Tag>
      ),
    },
    {
      title: 'Tên Trục công việc / Nhóm nhiệm vụ Kế hoạch quý',
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
              onClick={() => handleOpenEditGroup(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Popconfirm
              title="Xóa nhóm nhiệm vụ này?"
              description="Các nhiệm vụ trong kế hoạch quý đã lập trước đó vẫn giữ nguyên tên nhóm đã lưu."
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => handleDeleteGroup(record._id)}
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
        {/* HEADER CHUNG */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-gray-100">
          <div className="w-full lg:w-auto">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                icon={<RollbackOutlined />}
                onClick={() => navigate('/schedule/quarterly-plan')}
                className="text-gray-500 hover:text-blue-600"
              >
                Về Kế hoạch Quý
              </Button>
              <Title level={4} className="!mb-0 flex items-center gap-2 text-blue-800 text-base sm:text-lg font-bold">
                <AppstoreOutlined className="text-blue-600" />
                Quản lý Danh mục Trục công việc & Trục kết quả
              </Title>
            </div>
            <Text type="secondary" className="text-xs sm:text-sm block mt-1">
              Quản trị viên và Quản lý chủ động quản lý các Trục kết quả KPI và Trục công việc cho Kế hoạch Quý
            </Text>
          </div>
        </div>

        {/* TABS ĐIỀU HƯỚNG */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="card"
          className="mt-4"
          items={[
            {
              key: 'focus-axes',
              label: (
                <span className="font-semibold flex items-center gap-1.5 px-1">
                  <AppstoreOutlined className="text-blue-600" />
                  Trục kết quả trọng tâm (KPI & Hoàn thành)
                </span>
              ),
              children: (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-blue-50/60 p-3 rounded-lg border border-blue-100">
                    <div className="text-xs text-blue-900 font-medium">
                      Danh mục hiển thị khi cán bộ hoàn thành công việc và phục vụ đánh giá chấm điểm KPI.
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={fetchAxes}
                        loading={loadingAxes}
                        size="small"
                      >
                        Làm mới
                      </Button>
                      <Popconfirm
                        title="Khôi phục 6 trục kết quả chuẩn mặc định?"
                        description="Hệ thống sẽ đồng bộ lại 6 trục kết quả chuẩn theo đúng quy định của UBND TP."
                        okText="Đồng bộ"
                        cancelText="Hủy"
                        onConfirm={handleResetDefaultsAxis}
                      >
                        <Button
                          icon={<ReloadOutlined />}
                          loading={resettingAxes}
                          size="small"
                          className="text-amber-600 border-amber-400 hover:bg-amber-50"
                        >
                          Khôi phục 6 trục chuẩn
                        </Button>
                      </Popconfirm>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleOpenCreateAxis}
                        size="small"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Thêm trục kết quả
                      </Button>
                    </div>
                  </div>

                  <Table
                    rowKey="_id"
                    columns={axisColumns}
                    dataSource={axes}
                    loading={loadingAxes}
                    pagination={false}
                    bordered
                    size="middle"
                    scroll={{ x: 900 }}
                    className="shadow-xs rounded-lg overflow-hidden mt-2"
                  />
                </div>
              ),
            },
            {
              key: 'quarterly-task-groups',
              label: (
                <span className="font-semibold flex items-center gap-1.5 px-1">
                  <OrderedListOutlined className="text-emerald-600" />
                  Quản lý Trục công việc cho Kế hoạch Quý
                </span>
              ),
              children: (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50/60 p-3 rounded-lg border border-emerald-100">
                    <div className="text-xs text-emerald-900 font-medium">
                      Danh mục các Nhóm nhiệm vụ / Trục công việc tự động nạp vào hộp chọn (dropdown) khi thêm hoặc lọc nhiệm vụ Kế hoạch Quý.
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={fetchTaskGroups}
                        loading={loadingGroups}
                        size="small"
                      >
                        Làm mới
                      </Button>
                      <Popconfirm
                        title="Khôi phục 8 nhóm nhiệm vụ chuẩn mặc định?"
                        description="Hệ thống sẽ đồng bộ lại 8 nhóm nhiệm vụ chuẩn (Công tác chính trị, Chiến lược, Chuyên môn, Tài lực, Vật lực, HSSV, Nhân lực, Đoàn thể)."
                        okText="Đồng bộ"
                        cancelText="Hủy"
                        onConfirm={handleResetDefaultsGroup}
                      >
                        <Button
                          icon={<ReloadOutlined />}
                          loading={resettingGroups}
                          size="small"
                          className="text-amber-600 border-amber-400 hover:bg-amber-50"
                        >
                          Khôi phục 8 nhóm chuẩn
                        </Button>
                      </Popconfirm>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleOpenCreateGroup}
                        size="small"
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        Thêm trục công việc
                      </Button>
                    </div>
                  </div>

                  <Table
                    rowKey="_id"
                    columns={groupColumns}
                    dataSource={taskGroups}
                    loading={loadingGroups}
                    pagination={false}
                    bordered
                    size="middle"
                    scroll={{ x: 900 }}
                    className="shadow-xs rounded-lg overflow-hidden mt-2"
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* MODAL 1: THÊM / CẬP NHẬT TRỤC KẾT QUẢ TRỌNG TÂM */}
      <Modal
        title={
          <div className="text-blue-700 font-bold flex items-center gap-2">
            <AppstoreOutlined />
            {editingAxis ? 'Cập nhật Trục kết quả trọng tâm' : 'Thêm mới Trục kết quả trọng tâm'}
          </div>
        }
        open={axisModalVisible}
        onCancel={() => setAxisModalVisible(false)}
        onOk={handleSubmitAxis}
        confirmLoading={submittingAxis}
        okText={editingAxis ? 'Lưu thay đổi' : 'Thêm mới'}
        cancelText="Hủy"
        width={650}
        style={{ maxWidth: '95vw' }}
        destroyOnClose
      >
        <Form form={axisForm} layout="vertical" className="mt-4">
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

      {/* MODAL 2: THÊM / CẬP NHẬT TRỤC CÔNG VIỆC KẾ HOẠCH QUÝ */}
      <Modal
        title={
          <div className="text-emerald-700 font-bold flex items-center gap-2">
            <OrderedListOutlined />
            {editingGroup ? 'Cập nhật Trục công việc Kế hoạch quý' : 'Thêm mới Trục công việc Kế hoạch quý'}
          </div>
        }
        open={groupModalVisible}
        onCancel={() => setGroupModalVisible(false)}
        onOk={handleSubmitGroup}
        confirmLoading={submittingGroup}
        okText={editingGroup ? 'Lưu thay đổi' : 'Thêm mới'}
        cancelText="Hủy"
        width={650}
        style={{ maxWidth: '95vw' }}
        destroyOnClose
      >
        <Form form={groupForm} layout="vertical" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Form.Item
              name="code"
              label="Mã nhóm"
              rules={[{ required: true, message: 'Vui lòng nhập mã nhóm!' }]}
              tooltip="Mã định danh duy nhất (ví dụ: NHOM_IV, NHOM_V...)"
            >
              <Input placeholder="NHOM_IV" className="font-mono uppercase font-semibold" />
            </Form.Item>

            <Form.Item
              name="shortName"
              label="Tên viết tắt / Nhãn hiển thị"
              tooltip="Tên ngắn gọn (ví dụ: Nhóm IV)"
            >
              <Input placeholder="Nhóm IV" />
            </Form.Item>

            <Form.Item
              name="color"
              label="Màu sắc đại diện"
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
            label="Tên đầy đủ của Nhóm nhiệm vụ / Trục công việc"
            rules={[{ required: true, message: 'Vui lòng nhập đầy đủ tên nhóm nhiệm vụ!' }]}
            tooltip="Tên nhóm hiển thị trên tiêu đề nhóm và danh sách lựa chọn khi lập kế hoạch quý"
          >
            <TextArea
              rows={2}
              placeholder="Ví dụ: IV. QUẢN LÝ TÀI LỰC"
              className="font-medium"
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Diễn giải / Ghi chú nội dung nhóm"
          >
            <TextArea rows={2} placeholder="Nội dung chi tiết diễn giải cho nhóm nhiệm vụ này (không bắt buộc)" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="displayOrder"
              label="Thứ tự hiển thị"
              tooltip="Số thứ tự sắp xếp trên danh sách Kế hoạch quý"
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
