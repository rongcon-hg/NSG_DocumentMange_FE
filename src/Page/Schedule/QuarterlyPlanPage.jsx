import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  message,
  Popconfirm,
  Tooltip,
  Typography,
  Row,
  Col,
  Statistic,
  Badge,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  DownloadOutlined,
  PrinterOutlined,
  FileDoneOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import Cookies from 'js-cookie';
import { jwtDecode } from 'jwt-decode';
import {
  getQuarterlyPlanMetadata,
  getQuarterlyPlans,
  createQuarterlyPlan,
  updateQuarterlyPlan,
  deleteQuarterlyPlan,
  getQuarterlyPlanDetail,
  createPlanItem,
  updatePlanItem,
  deletePlanItem,
} from '../../api/quarterlyPlanApi';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// Định nghĩa màu sắc và nhãn theo quy tắc nhận xét tự động
const REMARK_STATUS_MAP = {
  EARLY: {
    color: 'success',
    bg: '#f6ffed',
    border: '#b7eb8f',
    textColor: '#389e0d',
    label: 'Sớm hạn',
    icon: <CheckCircleOutlined />,
  },
  ON_TIME: {
    color: 'success',
    bg: '#f6ffed',
    border: '#b7eb8f',
    textColor: '#389e0d',
    label: 'Đúng hạn',
    icon: <CheckCircleOutlined />,
  },
  IN_PROGRESS: {
    color: 'processing',
    bg: '#e6f4ff',
    border: '#91caff',
    textColor: '#0958d9',
    label: 'Đang làm',
    icon: <ClockCircleOutlined />,
  },
  LATE: {
    color: 'warning',
    bg: '#fffbe6',
    border: '#ffe58f',
    textColor: '#d46b08',
    label: 'Trễ hạn',
    icon: <ExclamationCircleOutlined />,
  },
  OVERDUE: {
    color: 'error',
    bg: '#fff2f0',
    border: '#ffccc7',
    textColor: '#cf1322',
    label: 'Quá hạn',
    icon: <ExclamationCircleOutlined />,
  },
  NOT_STARTED: {
    color: 'default',
    bg: '#fafafa',
    border: '#d9d9d9',
    textColor: '#595959',
    label: 'Chưa làm',
    icon: <ClockCircleOutlined />,
  },
};

const QuarterlyPlanPage = () => {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [planItems, setPlanItems] = useState([]);

  // Metadata
  const [departments, setDepartments] = useState([]);
  const [bghUsers, setBghUsers] = useState([]);

  // Modals
  const [createPlanModalVisible, setCreatePlanModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [createItemModalVisible, setCreateItemModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [progressItem, setProgressItem] = useState(null);

  // Forms
  const [planForm] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [progressForm] = Form.useForm();

  // Filters
  const [filterDepartment, setFilterDepartment] = useState(null);
  const [filterBgh, setFilterBgh] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);

  // User Role Check
  const token = Cookies.get('accessToken');
  let currentUser = null;
  if (token) {
    try {
      currentUser = jwtDecode(token);
    } catch (e) {
      console.error(e);
    }
  }

  const isManager = currentUser?.role === 'manager' || currentUser?.role === 'admin';

  // Tải danh mục ban đầu
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await getQuarterlyPlanMetadata();
        if (res.success) {
          setDepartments(res.data.departments || []);
          setBghUsers(res.data.bghUsers || []);
        }
      } catch (err) {
        console.error('Lỗi tải metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Tải danh sách các Kế hoạch quý
  const loadPlans = async () => {
    try {
      setLoading(true);
      const res = await getQuarterlyPlans();
      if (res.success) {
        setPlans(res.data || []);
        if (res.data && res.data.length > 0 && !selectedPlanId) {
          setSelectedPlanId(res.data[0]._id);
        }
      }
    } catch (err) {
      message.error('Lỗi tải danh sách kế hoạch quý');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  // Tải chi tiết kế hoạch khi chọn một kế hoạch cụ thể
  const loadPlanDetail = async (planId) => {
    if (!planId) return;
    try {
      setLoading(true);
      const res = await getQuarterlyPlanDetail(planId);
      if (res.success) {
        setCurrentPlan(res.data.plan);
        setPlanItems(res.data.items || []);
      }
    } catch (err) {
      message.error('Lỗi tải chi tiết kế hoạch quý');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPlanId) {
      loadPlanDetail(selectedPlanId);
    }
  }, [selectedPlanId]);

  // Xử lý tạo / sửa Kế hoạch quý
  const handleSavePlan = async (values) => {
    try {
      const payload = {
        title: values.title,
        academicYear: values.academicYear,
        year: values.year,
        quarter: values.quarter,
        startDate: values.dateRange ? values.dateRange[0].toISOString() : null,
        endDate: values.dateRange ? values.dateRange[1].toISOString() : null,
        note: values.note,
      };

      if (editingPlan) {
        const res = await updateQuarterlyPlan(editingPlan._id, payload);
        if (res.success) {
          message.success('Đã cập nhật kế hoạch quý thành công!');
          setCreatePlanModalVisible(false);
          setEditingPlan(null);
          planForm.resetFields();
          await loadPlans();
          loadPlanDetail(editingPlan._id);
        }
      } else {
        const res = await createQuarterlyPlan(payload);
        if (res.success) {
          message.success('Đã tạo kế hoạch quý thành công!');
          setCreatePlanModalVisible(false);
          planForm.resetFields();
          await loadPlans();
          if (res.data?._id) {
            setSelectedPlanId(res.data._id);
          }
        }
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi lưu kế hoạch quý');
    }
  };

  // Xử lý xóa Kế hoạch quý
  const handleDeletePlan = async (planId) => {
    if (!planId) return;
    try {
      const res = await deleteQuarterlyPlan(planId);
      if (res.success) {
        message.success('Đã xóa kế hoạch quý thành công!');
        setSelectedPlanId(null);
        setCurrentPlan(null);
        setPlanItems([]);
        const updatedPlansRes = await getQuarterlyPlans();
        if (updatedPlansRes.success) {
          setPlans(updatedPlansRes.data || []);
          if (updatedPlansRes.data && updatedPlansRes.data.length > 0) {
            setSelectedPlanId(updatedPlansRes.data[0]._id);
          }
        }
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi xóa kế hoạch quý');
    }
  };

  // Xử lý thêm / cập nhật Nhiệm vụ trong kế hoạch
  const handleSaveItem = async (values) => {
    try {
      const payload = {
        planId: selectedPlanId,
        groupName: values.groupName,
        order: values.order || 0,
        taskContent: values.taskContent,
        expectedOutcome: values.expectedOutcome,
        assignedDepartments: values.assignedDepartments || [],
        coordinatingDepartments: values.coordinatingDepartments || [],
        bghInCharge: values.bghInCharge || [],
        startDate: values.startDate ? values.startDate.toISOString() : null,
        expectedDeadline: values.expectedDeadline ? values.expectedDeadline.toISOString() : null,
        actualCompletedDate: values.actualCompletedDate ? values.actualCompletedDate.toISOString() : null,
        manualRemark: values.manualRemark,
      };

      if (editingItem) {
        const res = await updatePlanItem(editingItem._id, payload);
        if (res.success) {
          message.success('Đã cập nhật nhiệm vụ thành công!');
          setCreateItemModalVisible(false);
          setEditingItem(null);
          itemForm.resetFields();
          loadPlanDetail(selectedPlanId);
        }
      } else {
        const res = await createPlanItem(payload);
        if (res.success) {
          message.success('Đã thêm nhiệm vụ vào kế hoạch quý!');
          setCreateItemModalVisible(false);
          itemForm.resetFields();
          loadPlanDetail(selectedPlanId);
        }
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi lưu thông tin nhiệm vụ');
    }
  };

  // Xử lý cập nhật tiến độ & ngày hoàn thành thực tế nhanh
  const handleUpdateProgress = async (values) => {
    if (!progressItem) return;
    try {
      const payload = {
        progressPercent: values.progressPercent,
        actualCompletedDate: values.actualCompletedDate ? values.actualCompletedDate.toISOString() : null,
        status: values.status,
      };
      const res = await updatePlanItem(progressItem._id, payload);
      if (res.success) {
        message.success('Đã cập nhật tiến độ công việc thành công!');
        setProgressModalVisible(false);
        setProgressItem(null);
        progressForm.resetFields();
        loadPlanDetail(selectedPlanId);
      }
    } catch (err) {
      message.error('Lỗi khi cập nhật tiến độ');
    }
  };

  // Xử lý xóa nhiệm vụ
  const handleDeleteItem = async (itemId) => {
    try {
      const res = await deletePlanItem(itemId);
      if (res.success) {
        message.success('Đã xóa nhiệm vụ');
        loadPlanDetail(selectedPlanId);
      }
    } catch (err) {
      message.error('Lỗi khi xóa nhiệm vụ');
    }
  };

  // Lọc dữ liệu nhiệm vụ
  const filteredItems = useMemo(() => {
    return planItems.filter((item) => {
      if (filterDepartment) {
        const matchDept = item.assignedDepartments?.some((d) => d._id === filterDepartment);
        if (!matchDept) return false;
      }
      if (filterBgh) {
        const matchBgh = item.bghInCharge?.some((u) => u._id === filterBgh);
        if (!matchBgh) return false;
      }
      if (filterStatus) {
        if (item.autoRemarkStatus !== filterStatus) return false;
      }
      return true;
    });
  }, [planItems, filterDepartment, filterBgh, filterStatus]);

  // Thống kê nhanh
  const statistics = useMemo(() => {
    const total = planItems.length;
    const completed = planItems.filter((i) => i.actualCompletedDate).length;
    const onTime = planItems.filter((i) => i.autoRemarkStatus === 'ON_TIME' || i.autoRemarkStatus === 'EARLY').length;
    const overdue = planItems.filter((i) => i.autoRemarkStatus === 'OVERDUE').length;
    const inProgress = planItems.filter((i) => i.autoRemarkStatus === 'IN_PROGRESS').length;

    return { total, completed, onTime, overdue, inProgress };
  }, [planItems]);

  // Cấu hình các cột của Bảng Kế Hoạch Quý (chuẩn theo tài liệu mẫu thực tế)
  const columns = [
    {
      title: 'STT',
      dataIndex: 'order',
      key: 'order',
      width: 60,
      align: 'center',
      render: (val, record, index) => <span className="font-semibold text-slate-600">{val || index + 1}</span>,
    },
    {
      title: 'Nội dung công việc & Mục tiêu',
      key: 'taskContent',
      render: (_, record) => (
        <div className="space-y-1">
          <div className="text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded inline-block">
            {record.groupName}
          </div>
          <div className="font-semibold text-slate-800 text-sm leading-snug">
            {record.taskContent}
          </div>
          {record.expectedOutcome && (
            <div className="text-xs text-slate-500 italic">
              <span className="font-medium text-slate-600">Sản phẩm đầu ra:</span> {record.expectedOutcome}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Phân công đơn vị',
      key: 'departments',
      width: 200,
      render: (_, record) => (
        <div className="space-y-1.5 text-xs">
          <div>
            <span className="text-slate-400 font-medium block">Chủ trì thực hiện:</span>
            {record.assignedDepartments && record.assignedDepartments.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {record.assignedDepartments.map((d) => (
                  <Tag color="cyan" key={d._id} className="font-medium">
                    {d.departmentName}
                  </Tag>
                ))}
              </div>
            ) : (
              <span className="text-slate-400 italic">Chưa phân công</span>
            )}
          </div>
          {record.coordinatingDepartments && record.coordinatingDepartments.length > 0 && (
            <div>
              <span className="text-slate-400 font-medium block">Phối hợp:</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {record.coordinatingDepartments.map((d) => (
                  <Tag key={d._id} className="text-slate-500">
                    {d.departmentName}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'BGH Phụ trách',
      dataIndex: 'bghInCharge',
      key: 'bghInCharge',
      width: 170,
      render: (bghList) => (
        <div className="space-y-1">
          {bghList && bghList.length > 0 ? (
            bghList.map((u) => (
              <Tag color="purple" key={u._id} className="font-medium block text-center truncate">
                {u.position?.positionName ? `${u.position.positionName}: ` : ''}{u.name}
              </Tag>
            ))
          ) : (
            <span className="text-slate-400 italic text-xs">Ban Giám hiệu</span>
          )}
        </div>
      ),
    },
    {
      title: 'Thời gian dự kiến',
      dataIndex: 'expectedDeadline',
      key: 'expectedDeadline',
      width: 120,
      align: 'center',
      render: (deadline) => (
        <span className="text-xs font-semibold text-slate-700">
          {deadline ? dayjs(deadline).format('DD/MM/YYYY') : '—'}
        </span>
      ),
    },
    {
      title: 'Thực tế hoàn thành',
      dataIndex: 'actualCompletedDate',
      key: 'actualCompletedDate',
      width: 130,
      align: 'center',
      render: (completed, record) => (
        <div className="space-y-1">
          {completed ? (
            <Tag color="green" className="font-bold">
              {dayjs(completed).format('DD/MM/YYYY')}
            </Tag>
          ) : (
            <Button
              size="small"
              type="dashed"
              icon={<AuditOutlined />}
              onClick={() => {
                setProgressItem(record);
                progressForm.setFieldsValue({
                  progressPercent: record.progressPercent || 0,
                  actualCompletedDate: record.actualCompletedDate ? dayjs(record.actualCompletedDate) : dayjs(),
                  status: record.status || 'IN_PROGRESS',
                });
                setProgressModalVisible(true);
              }}
              className="text-xs text-blue-600 border-blue-300 hover:text-blue-500"
            >
              Cập nhật
            </Button>
          )}
        </div>
      ),
    },
    {
      title: 'Nhận xét tự động',
      key: 'autoRemark',
      width: 180,
      align: 'center',
      render: (_, record) => {
        const meta = REMARK_STATUS_MAP[record.autoRemarkStatus] || REMARK_STATUS_MAP.NOT_STARTED;
        return (
          <div
            className="p-2 rounded-lg text-xs font-semibold text-center border space-y-0.5"
            style={{
              backgroundColor: meta.bg,
              borderColor: meta.border,
              color: meta.textColor,
            }}
          >
            <div className="flex items-center justify-center gap-1">
              {meta.icon}
              <span>{meta.label}</span>
            </div>
            <div className="text-[11px] font-normal leading-tight opacity-90">
              {record.autoRemark}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 90,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          {isManager && (
            <>
              <Tooltip title="Chỉnh sửa nhiệm vụ">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined className="text-blue-600" />}
                  onClick={() => {
                    setEditingItem(record);
                    itemForm.setFieldsValue({
                      groupName: record.groupName,
                      order: record.order,
                      taskContent: record.taskContent,
                      expectedOutcome: record.expectedOutcome,
                      assignedDepartments: record.assignedDepartments?.map((d) => d._id),
                      coordinatingDepartments: record.coordinatingDepartments?.map((d) => d._id),
                      bghInCharge: record.bghInCharge?.map((u) => u._id),
                      startDate: record.startDate ? dayjs(record.startDate) : null,
                      expectedDeadline: record.expectedDeadline ? dayjs(record.expectedDeadline) : null,
                      actualCompletedDate: record.actualCompletedDate ? dayjs(record.actualCompletedDate) : null,
                      manualRemark: record.manualRemark,
                    });
                    setCreateItemModalVisible(true);
                  }}
                />
              </Tooltip>
              <Popconfirm
                title="Xóa nhiệm vụ này khỏi kế hoạch quý?"
                onConfirm={() => handleDeleteItem(record._id)}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button type="text" size="small" icon={<DeleteOutlined className="text-red-500" />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-[1700px] mx-auto">
      {/* Header & Tiêu đề phân hệ */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <CalendarOutlined className="text-xl" />
            </span>
            <div>
              <Title level={4} className="!mb-0 text-slate-800">
                Kế Hoạch Quý & Theo Dõi Tiến Độ
              </Title>
              <Text className="text-xs text-slate-500">
                Theo dõi thực hiện công tác trọng tâm theo Quý, phân công BGH chỉ đạo và tự động nhận xét tiến độ
              </Text>
            </div>
          </div>
        </div>

        {/* Thanh tác vụ chính */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Bộ chọn Kế hoạch quý */}
          <Select
            placeholder="Chọn kế hoạch quý"
            value={selectedPlanId}
            onChange={(val) => setSelectedPlanId(val)}
            className="w-64"
            size="middle"
          >
            {plans.map((p) => (
              <Option key={p._id} value={p._id}>
                {p.title} (Quý {p.quarter})
              </Option>
            ))}
          </Select>

          {isManager && (
            <>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => {
                  planForm.resetFields();
                  setCreatePlanModalVisible(true);
                }}
                className="rounded-lg"
              >
                Tạo Kế hoạch mới
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                disabled={!selectedPlanId}
                onClick={() => {
                  setEditingItem(null);
                  itemForm.resetFields();
                  setCreateItemModalVisible(true);
                }}
                className="bg-blue-600 rounded-lg shadow-xs"
              >
                Thêm Nhiệm vụ
              </Button>
            </>
          )}

          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              if (selectedPlanId) loadPlanDetail(selectedPlanId);
              else loadPlans();
            }}
            className="rounded-lg"
          />
        </div>
      </div>

      {/* Thống kê tiến độ nhanh */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6} lg={4}>
          <Card className="rounded-xl shadow-xs border-slate-200 p-1">
            <Statistic
              title={<span className="text-xs text-slate-500 font-medium">Tổng nhiệm vụ</span>}
              value={statistics.total}
              valueStyle={{ color: '#1e293b', fontWeight: 'bold' }}
              prefix={<FileDoneOutlined className="text-blue-600 text-lg mr-1" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={5}>
          <Card className="rounded-xl shadow-xs border-slate-200 p-1">
            <Statistic
              title={<span className="text-xs text-emerald-600 font-medium">Đúng hạn / Sớm hạn</span>}
              value={statistics.onTime}
              valueStyle={{ color: '#16a34a', fontWeight: 'bold' }}
              prefix={<CheckCircleOutlined className="text-emerald-500 text-lg mr-1" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={5}>
          <Card className="rounded-xl shadow-xs border-slate-200 p-1">
            <Statistic
              title={<span className="text-xs text-blue-600 font-medium">Đang triển khai</span>}
              value={statistics.inProgress}
              valueStyle={{ color: '#2563eb', fontWeight: 'bold' }}
              prefix={<ClockCircleOutlined className="text-blue-500 text-lg mr-1" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={5}>
          <Card className="rounded-xl shadow-xs border-slate-200 p-1">
            <Statistic
              title={<span className="text-xs text-red-600 font-medium">Trễ hạn / Quá hạn</span>}
              value={statistics.overdue}
              valueStyle={{ color: '#dc2626', fontWeight: 'bold' }}
              prefix={<ExclamationCircleOutlined className="text-red-500 text-lg mr-1" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6} lg={5}>
          <Card className="rounded-xl shadow-xs border-slate-200 p-1">
            <Statistic
              title={<span className="text-xs text-slate-500 font-medium">Đã hoàn thành</span>}
              value={statistics.completed}
              suffix={`/ ${statistics.total}`}
              valueStyle={{ color: '#0f766e', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Thanh bộ lọc */}
      <Card className="rounded-xl shadow-xs border-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-slate-600">Lọc theo:</span>

          <Select
            placeholder="Tất cả đơn vị"
            allowClear
            value={filterDepartment}
            onChange={(val) => setFilterDepartment(val)}
            className="w-48"
            size="small"
          >
            {departments.map((d) => (
              <Option key={d._id} value={d._id}>
                {d.departmentName}
              </Option>
            ))}
          </Select>

          <Select
            placeholder="Tất cả Ban Giám hiệu"
            allowClear
            value={filterBgh}
            onChange={(val) => setFilterBgh(val)}
            className="w-52"
            size="small"
          >
            {bghUsers.map((u) => (
              <Option key={u._id} value={u._id}>
                {u.position?.positionName ? `${u.position.positionName}: ` : ''}{u.name}
              </Option>
            ))}
          </Select>

          <Select
            placeholder="Trạng thái nhận xét"
            allowClear
            value={filterStatus}
            onChange={(val) => setFilterStatus(val)}
            className="w-44"
            size="small"
          >
            <Option value="ON_TIME">Đúng hạn</Option>
            <Option value="EARLY">Sớm hạn</Option>
            <Option value="IN_PROGRESS">Đang thực hiện</Option>
            <Option value="LATE">Trễ hạn</Option>
            <Option value="OVERDUE">Quá hạn</Option>
          </Select>

          {(filterDepartment || filterBgh || filterStatus) && (
            <Button
              size="small"
              onClick={() => {
                setFilterDepartment(null);
                setFilterBgh(null);
                setFilterStatus(null);
              }}
              className="text-xs text-slate-500"
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>
      </Card>

      {/* Bảng Kế hoạch Quý */}
      <Card
        title={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-slate-800">
                {currentPlan?.title || 'Bảng Tổng Hợp Kế Hoạch Quý'}
              </span>
              {currentPlan && (
                <Tag color="blue" className="font-bold text-xs">
                  Năm học {currentPlan.academicYear} • Quý {currentPlan.quarter}
                </Tag>
              )}
            </div>

            {/* Nút Chỉnh sửa & Xóa Kế hoạch quý hiện tại cho Manager */}
            {isManager && currentPlan && (
              <Space size="small">
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditingPlan(currentPlan);
                    planForm.setFieldsValue({
                      title: currentPlan.title,
                      academicYear: currentPlan.academicYear,
                      year: currentPlan.year,
                      quarter: currentPlan.quarter,
                      dateRange: currentPlan.startDate && currentPlan.endDate
                        ? [dayjs(currentPlan.startDate), dayjs(currentPlan.endDate)]
                        : null,
                      note: currentPlan.note,
                    });
                    setCreatePlanModalVisible(true);
                  }}
                  className="text-xs text-blue-600 border-blue-300 hover:text-blue-500 rounded-md"
                >
                  Sửa kế hoạch
                </Button>

                <Popconfirm
                  title="Xác nhận xóa Kế hoạch quý này?"
                  description="Toàn bộ các nhiệm vụ thuộc kế hoạch này cũng sẽ bị xóa vĩnh viễn!"
                  onConfirm={() => handleDeletePlan(currentPlan._id)}
                  okText="Xóa luôn"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    className="text-xs rounded-md"
                  >
                    Xóa kế hoạch
                  </Button>
                </Popconfirm>
              </Space>
            )}
          </div>
        }
        className="rounded-2xl shadow-xs border-slate-200 overflow-hidden"
      >
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={filteredItems}
          loading={loading}
          pagination={false}
          bordered
          size="middle"
          scroll={{ x: 1100 }}
          className="rounded-lg overflow-hidden"
        />
      </Card>

      {/* MODAL 1: Tạo / Sửa Kế hoạch quý */}
      <Modal
        title={
          <span className="font-bold text-base text-blue-900">
            {editingPlan ? 'Chỉnh Sửa Kế Hoạch Quý' : 'Tạo Kế Hoạch Quý Mới'}
          </span>
        }
        open={createPlanModalVisible}
        onCancel={() => {
          setCreatePlanModalVisible(false);
          setEditingPlan(null);
        }}
        onOk={() => planForm.submit()}
        okText={editingPlan ? 'Lưu Thay Đổi' : 'Tạo Kế hoạch'}
        cancelText="Hủy"
        width={550}
        centered
      >
        <Form form={planForm} layout="vertical" onFinish={handleSavePlan} className="pt-2">
          <Form.Item
            name="title"
            label="Tiêu đề Kế hoạch quý"
            rules={[{ required: true, message: 'Vui lòng nhập tên kế hoạch' }]}
            initialValue="Kế hoạch công tác Quý I năm học 2026 - 2027"
          >
            <Input placeholder="Ví dụ: Kế hoạch công tác Quý I..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="academicYear"
                label="Năm học"
                rules={[{ required: true }]}
                initialValue="2026-2027"
              >
                <Input placeholder="2026-2027" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="quarter"
                label="Quý thực hiện"
                rules={[{ required: true }]}
                initialValue={1}
              >
                <Select>
                  <Option value={1}>Quý I</Option>
                  <Option value={2}>Quý II</Option>
                  <Option value={3}>Quý III</Option>
                  <Option value={4}>Quý IV</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="dateRange" label="Khoảng thời gian thực hiện">
            <DatePicker.RangePicker className="w-full" format="DD/MM/YYYY" />
          </Form.Item>

          <Form.Item name="note" label="Ghi chú thêm">
            <TextArea rows={2} placeholder="Nội dung căn cứ, chỉ đạo..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 2: Thêm / Sửa nhiệm vụ trong kế hoạch quý */}
      <Modal
        title={
          <span className="font-bold text-base text-blue-900">
            {editingItem ? 'Chỉnh Sửa Nhiệm Vụ Kế Hoạch Quý' : 'Thêm Nhiệm Vụ Mới Vào Kế Hoạch Quý'}
          </span>
        }
        open={createItemModalVisible}
        onCancel={() => setCreateItemModalVisible(false)}
        onOk={() => itemForm.submit()}
        okText="Lưu Nhiệm Vụ"
        cancelText="Hủy"
        width={750}
        centered
      >
        <Form form={itemForm} layout="vertical" onFinish={handleSaveItem} className="pt-2">
          <Row gutter={16}>
            <Col span={18}>
              <Form.Item
                name="groupName"
                label="Nhóm nhiệm vụ / Trục kết quả"
                rules={[{ required: true, message: 'Vui lòng chọn hoặc nhập nhóm nhiệm vụ' }]}
                initialValue="I. CÔNG TÁC ĐÀO TẠO & QUẢN LÝ SINH VIÊN"
              >
                <Input placeholder="Ví dụ: I. CÔNG TÁC ĐÀO TẠO, II. CÔNG TÁC TUYỂN SINH..." />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="order" label="Thứ tự (STT)" initialValue={1}>
                <InputNumber min={1} className="w-full" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="taskContent"
            label="Nội dung công việc / Nhiệm vụ cụ thể"
            rules={[{ required: true, message: 'Vui lòng nhập nội dung công việc' }]}
          >
            <TextArea rows={3} placeholder="Nội dung chi tiết công việc cần triển khai..." />
          </Form.Item>

          <Form.Item name="expectedOutcome" label="Sản phẩm / Kết quả đầu ra dự kiến">
            <Input placeholder="Ví dụ: Quyết định ban hành, Báo cáo nghiệm thu, Kế hoạch chi tiết..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="assignedDepartments"
                label="Đơn vị chủ trì thực hiện"
                rules={[{ required: true, message: 'Chọn ít nhất một đơn vị chủ trì' }]}
              >
                <Select mode="multiple" placeholder="Chọn Khoa/Phòng/Trung tâm" allowClear>
                  {departments.map((d) => (
                    <Option key={d._id} value={d._id}>
                      {d.departmentName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="coordinatingDepartments" label="Đơn vị phối hợp">
                <Select mode="multiple" placeholder="Đơn vị phối hợp (nếu có)" allowClear>
                  {departments.map((d) => (
                    <Option key={d._id} value={d._id}>
                      {d.departmentName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="bghInCharge"
            label="Ban Giám hiệu phụ trách chỉ đạo"
            rules={[{ required: true, message: 'Chọn lãnh đạo Ban Giám hiệu phụ trách' }]}
          >
            <Select mode="multiple" placeholder="Chọn lãnh đạo Ban Giám hiệu" allowClear>
              {bghUsers.map((u) => (
                <Option key={u._id} value={u._id}>
                  {u.position?.positionName ? `${u.position.positionName}: ` : ''}{u.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="expectedDeadline"
                label="Thời gian dự kiến hoàn thành"
                rules={[{ required: true, message: 'Chọn ngày dự kiến hoàn thành' }]}
              >
                <DatePicker format="DD/MM/YYYY" className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="actualCompletedDate" label="Thời gian thực tế hoàn thành (nếu có)">
                <DatePicker format="DD/MM/YYYY" className="w-full" allowClear />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="manualRemark" label="Ghi chú thêm">
            <Input placeholder="Ghi chú thêm của Quản lý / Ban Giám hiệu..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 3: Cập nhật tiến độ & hoàn thành thực tế */}
      <Modal
        title={<span className="font-bold text-base text-blue-900">Cập Nhật Tiến Độ & Ngày Hoàn Thành</span>}
        open={progressModalVisible}
        onCancel={() => setProgressModalVisible(false)}
        onOk={() => progressForm.submit()}
        okText="Lưu Cập Nhật"
        cancelText="Hủy"
        width={500}
        centered
      >
        <Form form={progressForm} layout="vertical" onFinish={handleUpdateProgress} className="pt-2">
          {progressItem && (
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3 text-xs space-y-1">
              <div className="font-bold text-slate-800">{progressItem.taskContent}</div>
              <div className="text-slate-500">
                Hạn dự kiến: <span className="font-semibold text-blue-700">{dayjs(progressItem.expectedDeadline).format('DD/MM/YYYY')}</span>
              </div>
            </div>
          )}

          <Form.Item name="actualCompletedDate" label="Ngày thực tế hoàn thành">
            <DatePicker format="DD/MM/YYYY" className="w-full" allowClear placeholder="Chọn ngày nếu đã hoàn thành" />
          </Form.Item>

          <Form.Item name="progressPercent" label="Tiến độ thực hiện (%)">
            <InputNumber min={0} max={100} className="w-full" />
          </Form.Item>

          <Form.Item name="status" label="Trạng thái">
            <Select>
              <Option value="NOT_STARTED">Chưa thực hiện</Option>
              <Option value="IN_PROGRESS">Đang thực hiện</Option>
              <Option value="COMPLETED">Đã hoàn thành</Option>
              <Option value="PAUSED">Tạm dừng</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QuarterlyPlanPage;
