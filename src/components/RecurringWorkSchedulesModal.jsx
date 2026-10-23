import React, { useState, useEffect } from 'react';
import {
  Modal,
  Table,
  Button,
  Tag,
  Space,
  Tooltip,
  Popconfirm,
  message,
  Switch,
  Form,
  Input,
  Select,
  TimePicker,
  InputNumber,
  Row,
  Col,
  Alert,
  Divider,
} from 'antd';
import {
  SyncOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getRecurringWorkSchedules,
  createRecurringWorkSchedule,
  updateRecurringWorkSchedule,
  deleteRecurringWorkSchedule,
  toggleRecurringWorkSchedule,
  runRecurringWorkScheduleNow,
} from '../api/workScheduleApi';

const { TextArea } = Input;
const { Option } = Select;

const DAYS_OF_WEEK_OPTIONS = [
  { label: 'Thứ 2', value: 1 },
  { label: 'Thứ 3', value: 2 },
  { label: 'Thứ 4', value: 3 },
  { label: 'Thứ 5', value: 4 },
  { label: 'Thứ 6', value: 5 },
  { label: 'Thứ 7', value: 6 },
  { label: 'Chủ Nhật', value: 7 },
];

const QUARTER_MONTH_OPTIONS = [
  { label: 'Tháng đầu của quý (Tháng 1, 4, 7, 10)', value: 1 },
  { label: 'Tháng giữa của quý (Tháng 2, 5, 8, 11)', value: 2 },
  { label: 'Tháng cuối của quý (Tháng 3, 6, 9, 12)', value: 3 },
];

const RecurringWorkSchedulesModal = ({ open, onCancel, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [executingId, setExecutingId] = useState(null);

  const [form] = Form.useForm();
  const selectedFrequency = Form.useWatch('frequency', form);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getRecurringWorkSchedules();
      if (res && res.success) {
        setData(res.data || []);
      }
    } catch (err) {
      message.error('Không thể tải danh sách mẫu lịch lặp lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      frequency: 'WEEKLY',
      repeatDaysOfWeek: [1],
      repeatDayOfMonth: 1,
      repeatQuarterMonth: 1,
      repeatQuarters: [1, 2, 3, 4],
      repeatMonthOfYear: 1,
      startTime: dayjs('08:00', 'HH:mm'),
      endTime: dayjs('10:30', 'HH:mm'),
      durationDays: 1,
      host: 'Ban Giám Hiệu',
    });
    setFormModalVisible(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    form.setFieldsValue({
      title: item.title,
      content: item.content,
      participants: item.participants,
      location: item.location,
      notes: item.notes,
      host: item.host,
      frequency: item.frequency,
      repeatDaysOfWeek: item.repeatDaysOfWeek || [1],
      repeatDayOfMonth: item.repeatDayOfMonth || 1,
      repeatQuarterMonth: item.repeatQuarterMonth || 1,
      repeatQuarters: item.repeatQuarters || [1, 2, 3, 4],
      repeatMonthOfYear: item.repeatMonthOfYear || 1,
      startTime: item.startTime ? dayjs(item.startTime, 'HH:mm') : null,
      endTime: item.endTime ? dayjs(item.endTime, 'HH:mm') : null,
      durationDays: item.durationDays || 1,
    });
    setFormModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        title: values.title,
        content: values.content,
        participants: values.participants || '',
        location: values.location || '',
        notes: values.notes || '',
        host: values.host || 'Ban Giám Hiệu',
        frequency: values.frequency,
        repeatDaysOfWeek: values.repeatDaysOfWeek || [1],
        repeatDayOfMonth: values.repeatDayOfMonth || 1,
        repeatQuarterMonth: values.repeatQuarterMonth || 1,
        repeatQuarters: values.repeatQuarters || [1, 2, 3, 4],
        repeatMonthOfYear: values.repeatMonthOfYear || 1,
        startTime: values.startTime ? values.startTime.format('HH:mm') : '08:00',
        endTime: values.endTime ? values.endTime.format('HH:mm') : '10:30',
        durationDays: values.durationDays || 1,
      };

      if (editingItem) {
        await updateRecurringWorkSchedule(editingItem._id, payload);
        message.success('Cập nhật mẫu lịch định kỳ thành công.');
      } else {
        await createRecurringWorkSchedule(payload);
        message.success('Tạo mẫu lịch định kỳ thành công.');
      }

      setFormModalVisible(false);
      loadData();
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      message.error(err.response?.data?.message || 'Có lỗi xảy ra khi lưu mẫu lịch.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRecurringWorkSchedule(id);
      message.success('Đã xóa mẫu lịch thành công.');
      loadData();
    } catch (err) {
      message.error('Không thể xóa mẫu lịch.');
    }
  };

  const handleToggle = async (id) => {
    try {
      const res = await toggleRecurringWorkSchedule(id);
      message.success(res.message || 'Thay đổi trạng thái thành công.');
      loadData();
    } catch (err) {
      message.error('Không thể đổi trạng thái.');
    }
  };

  const handleRunNow = async (id) => {
    try {
      setExecutingId(id);
      const res = await runRecurringWorkScheduleNow(id);
      message.success(res.message || 'Đã ban hành lịch công tác từ mẫu thành công!');
      loadData();
      if (typeof onSuccess === 'function') onSuccess();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể thực thi sinh lịch.');
    } finally {
      setExecutingId(null);
    }
  };

  const renderFrequencyTag = (freq, record) => {
    switch (freq) {
      case 'WEEKLY': {
        const dayNames = (record.repeatDaysOfWeek || [1])
          .map((d) => (d === 7 ? 'Chủ Nhật' : `Thứ ${d + 1}`))
          .join(', ');
        return (
          <div>
            <Tag color="blue" className="font-medium">Hàng tuần</Tag>
            <div className="text-xs text-slate-500 mt-0.5">{dayNames}</div>
          </div>
        );
      }
      case 'MONTHLY':
        return (
          <div>
            <Tag color="cyan" className="font-medium">Hàng tháng</Tag>
            <div className="text-xs text-slate-500 mt-0.5">Ngày {record.repeatDayOfMonth} hàng tháng</div>
          </div>
        );
      case 'QUARTERLY': {
        const qNames = (record.repeatQuarters || [1, 2, 3, 4]).map((q) => `Q${q}`).join(', ');
        return (
          <div>
            <Tag color="purple" className="font-medium">Hàng quý</Tag>
            <div className="text-xs text-slate-500 mt-0.5">{qNames} (Ngày {record.repeatDayOfMonth})</div>
          </div>
        );
      }
      case 'YEARLY':
        return (
          <div>
            <Tag color="gold" className="font-medium">Hàng năm</Tag>
            <div className="text-xs text-slate-500 mt-0.5">Tháng {record.repeatMonthOfYear}, ngày {record.repeatDayOfMonth}</div>
          </div>
        );
      default:
        return <Tag>{freq}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Tên mẫu & Nội dung công tác',
      key: 'titleContent',
      minWidth: 260,
      render: (_, r) => (
        <div className="space-y-1">
          <div className="font-bold text-[#003366] text-sm hover:underline cursor-pointer" onClick={() => handleOpenEdit(r)}>
            {r.title}
          </div>
          <div className="text-xs text-slate-700 font-medium line-clamp-2">{r.content}</div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {r.host && <span>Chủ trì: <b>{r.host}</b></span>}
            {r.location && <span>• Địa điểm: <b>{r.location}</b></span>}
          </div>
        </div>
      ),
    },
    {
      title: 'Chu kỳ lặp',
      key: 'frequency',
      width: 170,
      render: (_, r) => renderFrequencyTag(r.frequency, r),
    },
    {
      title: 'Khung giờ',
      key: 'time',
      width: 130,
      render: (_, r) => (
        <div className="text-xs font-semibold text-slate-700 flex items-center gap-1">
          <ClockCircleOutlined className="text-blue-500" />
          <span>{r.startTime && r.endTime ? `${r.startTime} - ${r.endTime}` : r.startTime || 'Cả ngày'}</span>
        </div>
      ),
    },
    {
      title: 'Lần chạy kế tiếp',
      key: 'nextRunDate',
      width: 140,
      render: (_, r) => (
        <div className="text-xs">
          {r.nextRunDate ? (
            <span className="font-semibold text-emerald-700">
              {dayjs(r.nextRunDate).format('DD/MM/YYYY')}
            </span>
          ) : (
            <span className="text-slate-400 italic">Chưa xác định</span>
          )}
          {r.totalGeneratedCount > 0 && (
            <div className="text-[10px] text-slate-400">Đã sinh: {r.totalGeneratedCount} lần</div>
          )}
        </div>
      ),
    },
    {
      title: 'Kích hoạt',
      key: 'isActive',
      width: 90,
      align: 'center',
      render: (_, r) => (
        <Switch
          size="small"
          checked={r.isActive}
          onChange={() => handleToggle(r._id)}
          className={r.isActive ? 'bg-emerald-600' : 'bg-slate-300'}
        />
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Ban hành lịch ngay lập tức từ mẫu này">
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined className="text-xs" />}
              loading={executingId === r._id}
              onClick={() => handleRunNow(r._id)}
              className="bg-emerald-600 hover:bg-emerald-700 h-7 w-7 p-0 flex items-center justify-center border-none shadow-2xs"
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa mẫu lịch">
            <Button
              size="small"
              icon={<EditOutlined className="text-blue-600 text-xs" />}
              onClick={() => handleOpenEdit(r)}
              className="h-7 w-7 p-0 flex items-center justify-center border-slate-300 hover:border-blue-500"
            />
          </Tooltip>
          <Popconfirm
            title="Xóa mẫu lịch lặp lại này?"
            onConfirm={() => handleDelete(r._id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Xóa mẫu">
              <Button
                danger
                size="small"
                icon={<DeleteOutlined className="text-xs" />}
                className="h-7 w-7 p-0 flex items-center justify-center"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800">
            <SyncOutlined className="text-blue-600 text-lg" />
            <span className="font-bold text-base sm:text-lg">Mẫu Lịch Công Tác Lặp Lại Định Kỳ</span>
          </div>
        }
        open={open}
        onCancel={onCancel}
        width={980}
        footer={[
          <Button key="close" onClick={onCancel}>
            Đóng
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            className="bg-[#003366] hover:bg-blue-900 font-semibold"
          >
            Tạo mẫu lịch mới
          </Button>,
        ]}
      >
        <div className="space-y-3 py-2">
          <Alert
            type="info"
            showIcon
            message="Tự động ban hành lịch công tác"
            description="Hệ thống sẽ tự động quét vào lúc 06:30 sáng hàng ngày để sinh ra các lịch công tác chính thức (được phê duyệt) theo chu kỳ Hàng tuần, Hàng tháng, Hàng quý hoặc Hàng năm do Thầy/Cô cấu hình."
            className="text-xs"
          />

          <Table
            dataSource={data}
            columns={columns}
            rowKey="_id"
            loading={loading}
            size="small"
            pagination={{ pageSize: 6, showTotal: (t) => `Tổng ${t} mẫu lịch` }}
            scroll={{ x: 750 }}
          />
        </div>
      </Modal>

      {/* Modal Tạo / Sửa mẫu lịch định kỳ */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800">
            <CalendarOutlined className="text-blue-600 text-lg" />
            <span className="font-bold text-base">
              {editingItem ? 'Chỉnh Sửa Mẫu Lịch Công Tác Định Kỳ' : 'Tạo Mới Mẫu Lịch Công Tác Định Kỳ'}
            </span>
          </div>
        }
        open={formModalVisible}
        onCancel={() => setFormModalVisible(false)}
        onOk={handleSave}
        confirmLoading={submitting}
        okText={editingItem ? 'Lưu cập nhật' : 'Tạo mẫu lịch'}
        cancelText="Hủy"
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="pt-2">
          <Form.Item
            name="title"
            label={<span className="font-semibold text-slate-800">Tên mẫu lịch / Sự kiện định kỳ <span className="text-red-500">*</span></span>}
            rules={[{ required: true, message: 'Vui lòng nhập tên mẫu lịch' }]}
          >
            <Input placeholder="Ví dụ: Giao ban Ban Giám Hiệu đầu tuần, Họp sơ kết tháng..." />
          </Form.Item>

          <Form.Item
            name="content"
            label={<span className="font-semibold text-slate-800">Nội dung công tác chi tiết <span className="text-red-500">*</span></span>}
            rules={[{ required: true, message: 'Vui lòng nhập nội dung công tác' }]}
          >
            <TextArea rows={3} placeholder="Nhập nội dung công việc, chương trình chi tiết..." />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="host" label={<span className="font-semibold text-slate-700">Chủ trì</span>}>
                <Input placeholder="Ví dụ: Ban Giám Hiệu, Hiệu trưởng..." />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="location" label={<span className="font-semibold text-slate-700">Địa điểm</span>}>
                <Input placeholder="Ví dụ: Phòng họp BGH, Hội trường A..." />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="participants" label={<span className="font-semibold text-slate-700">Thành phần tham dự</span>}>
            <Input placeholder="Ví dụ: Ban Giám Hiệu, Trưởng các Đơn vị..." />
          </Form.Item>

          <Divider orientation="left" className="text-xs text-slate-500 font-normal">
            Cấu hình thời gian & Chu kỳ lặp lại
          </Divider>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item
                name="frequency"
                label={<span className="font-semibold text-slate-800">Chu kỳ lặp lại <span className="text-red-500">*</span></span>}
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="WEEKLY">Hàng tuần</Option>
                  <Option value="MONTHLY">Hàng tháng</Option>
                  <Option value="QUARTERLY">Hàng quý</Option>
                  <Option value="YEARLY">Hàng năm</Option>
                </Select>
              </Form.Item>
            </Col>

            <Col xs={12} sm={8}>
              <Form.Item
                name="startTime"
                label={<span className="font-semibold text-slate-700">Giờ bắt đầu</span>}
              >
                <TimePicker format="HH:mm" className="w-full" minuteStep={5} />
              </Form.Item>
            </Col>

            <Col xs={12} sm={8}>
              <Form.Item
                name="endTime"
                label={<span className="font-semibold text-slate-700">Giờ kết thúc</span>}
              >
                <TimePicker format="HH:mm" className="w-full" minuteStep={5} />
              </Form.Item>
            </Col>
          </Row>

          {/* Chi tiết theo từng chu kỳ */}
          {selectedFrequency === 'WEEKLY' && (
            <Form.Item
              name="repeatDaysOfWeek"
              label={<span className="font-semibold text-slate-800">Lặp vào các ngày trong tuần:</span>}
              rules={[{ required: true, message: 'Vui lòng chọn ít nhất một ngày trong tuần' }]}
            >
              <Select
                mode="multiple"
                placeholder="Chọn thứ trong tuần..."
                options={DAYS_OF_WEEK_OPTIONS}
                className="w-full"
              />
            </Form.Item>
          )}

          {selectedFrequency === 'MONTHLY' && (
            <Form.Item
              name="repeatDayOfMonth"
              label={<span className="font-semibold text-slate-800">Ngày diễn ra trong tháng (1 - 31):</span>}
              rules={[{ required: true, message: 'Vui lòng chọn ngày trong tháng' }]}
            >
              <InputNumber min={1} max={31} className="w-full" placeholder="Chọn ngày diễn ra (1-31)" />
            </Form.Item>
          )}

          {selectedFrequency === 'QUARTERLY' && (
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="repeatQuarterMonth"
                  label={<span className="font-semibold text-slate-800">Tháng trong quý:</span>}
                >
                  <Select options={QUARTER_MONTH_OPTIONS} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="repeatDayOfMonth"
                  label={<span className="font-semibold text-slate-800">Ngày trong tháng (1 - 31):</span>}
                >
                  <InputNumber min={1} max={31} className="w-full" />
                </Form.Item>
              </Col>
            </Row>
          )}

          {selectedFrequency === 'YEARLY' && (
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="repeatMonthOfYear"
                  label={<span className="font-semibold text-slate-800">Tháng trong năm (1 - 12):</span>}
                >
                  <InputNumber min={1} max={12} className="w-full" placeholder="Tháng 1 đến 12" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="repeatDayOfMonth"
                  label={<span className="font-semibold text-slate-800">Ngày trong tháng (1 - 31):</span>}
                >
                  <InputNumber min={1} max={31} className="w-full" placeholder="Ngày 1 đến 31" />
                </Form.Item>
              </Col>
            </Row>
          )}

          <Form.Item name="notes" label={<span className="font-semibold text-slate-700">Ghi chú</span>}>
            <Input placeholder="Ghi chú thêm nếu có..." />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default RecurringWorkSchedulesModal;
