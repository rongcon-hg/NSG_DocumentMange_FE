import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Tag,
  Input,
  Select,
  Space,
  Typography,
  Tabs,
  Badge,
  Tooltip,
  Modal,
  Form,
  Upload,
  message,
  Popconfirm
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FilePdfOutlined,
  UploadOutlined,
  DeleteOutlined,
  UserOutlined,
  AuditOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getApprovalDocuments, createApprovalDocument, deleteApprovalDocument } from "../../api/approvalDocumentApi";
import { getApprovalWorkflows, generateApprovalSteps } from "../../api/approvalWorkflowApi";
import { getAllUsersCanSearchBanUser } from "../../api/auth";
import { formatFileName } from "../../utils/formatFileName";

const { Title, Text } = Typography;
const { Option } = Select;

const ApprovalListPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pending_my_action");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Modal tạo hồ sơ trình ký
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [users, setUsers] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [steps, setSteps] = useState([
    { stepIndex: 1, stepName: "Cấp trưởng duyệt", assignee: null, actionType: "SIGN" }
  ]);

  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUser(decoded);
      } catch (e) {
        console.error("Lỗi giải mã token:", e);
      }
    }
  }, []);


  useEffect(() => {
    fetchDocuments();
  }, [activeTab, pagination.page, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await getAllUsersCanSearchBanUser();
      const validUsers = (res?.users || []).filter(u => u && u.name && u.email !== "qlvb@nsgpc.edu.vn");
      setUsers(validUsers);
    } catch (err) {
      console.error("Lỗi khi tải danh sách nhân sự:", err);
    }
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = {
        type: activeTab,
        page: pagination.page,
        limit: pagination.limit,
        status: statusFilter || undefined,
        search: searchText || undefined
      };
      const res = await getApprovalDocuments(params);
      if (res.success) {
        setData(res.data);
        setPagination(prev => ({
          ...prev,
          total: res.pagination?.total || res.data.length
        }));
      }
    } catch (error) {
      message.error("Lỗi khi tải danh sách hồ sơ trình ký");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchDocuments();
  };

  // Tự động tải tuyến ký duyệt chuẩn khi mở modal
  const handleOpenCreate = async () => {
    setIsModalVisible(true);
    setWorkflowLoading(true);
    try {
      const [wfRes, stepsRes] = await Promise.all([
        getApprovalWorkflows(),
        generateApprovalSteps()
      ]);
      if (wfRes.success) {
        setWorkflows(wfRes.data || []);
        const defaultWf = wfRes.data?.find(w => w.isDefault) || wfRes.data?.[0];
        if (defaultWf) setSelectedWorkflowId(defaultWf._id);
      }
      if (stepsRes.success && stepsRes.steps?.length > 0) {
        setSteps(stepsRes.steps);
      }
    } catch (e) {
      console.error("Lỗi tự động sinh tuyến ký duyệt:", e);
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleWorkflowChange = async (wfId) => {
    setSelectedWorkflowId(wfId);
    setWorkflowLoading(true);
    try {
      const res = await generateApprovalSteps(undefined, wfId);
      if (res.success && res.steps?.length > 0) {
        setSteps(res.steps);
      }
    } catch (e) {
      console.error("Lỗi khi chuyển đổi tuyến:", e);
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleAddStep = () => {
    setSteps(prev => [
      ...prev,
      {
        stepIndex: prev.length + 1,
        stepName: prev.length === 1 ? "Ban Giám hiệu ký duyệt" : `Bước ${prev.length + 1}`,
        assignee: null,
        actionType: "SIGN"
      }
    ]);
  };

  const handleRemoveStep = (index) => {
    if (steps.length <= 1) {
      message.warning("Cần có ít nhất một bước duyệt");
      return;
    }
    const updated = steps.filter((_, idx) => idx !== index).map((s, idx) => ({
      ...s,
      stepIndex: idx + 1
    }));
    setSteps(updated);
  };

  const handleStepChange = (index, field, value) => {
    const updated = [...steps];
    updated[index][field] = value;
    setSteps(updated);
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await createForm.validateFields();
      if (fileList.length === 0) {
        message.error("Vui lòng đính kèm file văn bản cần trình ký!");
        return;
      }

      // Kiểm tra người duyệt của từng bước
      for (let i = 0; i < steps.length; i++) {
        if (!steps[i].assignee) {
          message.error(`Vui lòng chọn người duyệt cho Bước ${i + 1} (${steps[i].stepName})`);
          return;
        }
      }

      const formData = new FormData();
      const originFile = fileList[0].originFileObj || fileList[0];
      formData.append("file", originFile, formatFileName(originFile.name));
      formData.append("title", values.title);
      formData.append("description", values.description || "");
      formData.append("urgency", values.urgency || "NORMAL");
      formData.append("signSteps", JSON.stringify(steps));

      setSubmitting(true);
      const res = await createApprovalDocument(formData);
      if (res.success) {
        message.success("Khởi tạo hồ sơ trình ký thành công!");
        setIsModalVisible(false);
        createForm.resetFields();
        setFileList([]);
        setSteps([{ stepIndex: 1, stepName: "Cấp trưởng duyệt", assignee: null, actionType: "SIGN" }]);
        fetchDocuments();
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || "Lỗi khi khởi tạo hồ sơ trình ký");
    } finally {
      setSubmitting(false);
    }
  };

  const getUrgencyTag = (urgency) => {
    switch (urgency) {
      case "VERY_URGENT":
        return <Tag color="error">Hỏa tốc</Tag>;
      case "URGENT":
        return <Tag color="warning">Khẩn</Tag>;
      default:
        return <Tag color="default">Thường</Tag>;
    }
  };

  const getStatusTag = (status) => {
    switch (status) {
      case "APPROVED":
        return <Tag color="success" icon={<CheckCircleOutlined />}>Đã hoàn thành</Tag>;
      case "REJECTED":
        return <Tag color="error" icon={<CloseCircleOutlined />}>Bị từ chối</Tag>;
      case "IN_PROGRESS":
        return <Tag color="processing" icon={<ClockCircleOutlined />}>Đang xử lý</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };

  const columns = [
    {
      title: "Mã hồ sơ",
      dataIndex: "documentCode",
      key: "documentCode",
      width: 140,
      render: (code) => <span className="font-semibold text-blue-600">{code}</span>
    },
    {
      title: "Trích yếu / Nội dung",
      dataIndex: "title",
      key: "title",
      render: (text, record) => (
        <div>
          <div className="font-medium text-slate-800 line-clamp-2">{text}</div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span>{record.creator?.name}</span>
            <span>•</span>
            <span>{dayjs(record.createdAt).format("DD/MM/YYYY HH:mm")}</span>
            <span>•</span>
            {getUrgencyTag(record.urgency)}
          </div>
        </div>
      )
    },
    {
      title: "Tiến độ duyệt",
      key: "progress",
      width: 220,
      render: (_, record) => {
        const totalSteps = record.signSteps?.length || 0;
        const currentIdx = record.currentStepIndex || 1;
        const currentAssignee = record.signSteps?.find(s => s.stepIndex === currentIdx)?.assignee;

        return (
          <div className="text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-gray-700">
                Bước {Math.min(currentIdx, totalSteps)}/{totalSteps}
              </span>
              {getStatusTag(record.status)}
            </div>
            {record.status === "IN_PROGRESS" && currentAssignee && (
              <div className="text-gray-500 truncate">
                Đang chờ: <span className="font-medium text-indigo-600">{currentAssignee.name}</span>
              </div>
            )}
            {record.status === "REJECTED" && record.rejectionReason && (
              <div className="text-red-500 truncate italic">
                Lý do: {record.rejectionReason}
              </div>
            )}
          </div>
        );
      }
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 160,
      align: "center",
      render: (_, record) => {
        const isAdmin = currentUser?.role === "admin" || currentUser?.role === "manager";
        const isOwner = String(record.creator?._id || record.creator) === String(currentUser?.userId || currentUser?.id);
        const canDelete = isAdmin || (isOwner && record.status !== "APPROVED");

        return (
          <Space orientation="horizontal" size="small">
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/approval-documents/${record._id}`)}
            >
              Chi tiết
            </Button>

            {canDelete && (
              <Popconfirm
                title="Xác nhận xóa hồ sơ trình ký"
                description={`Bạn có chắc chắn muốn xóa hồ sơ "${record.documentCode || record.title}" không? Thao tác này không thể hoàn tác.`}
                onConfirm={async () => {
                  try {
                    const res = await deleteApprovalDocument(record._id);
                    if (res.success) {
                      message.success("Đã xóa hồ sơ trình ký thành công");
                      fetchDocuments();
                    }
                  } catch (err) {
                    message.error(err.response?.data?.message || "Lỗi khi xóa hồ sơ trình ký");
                  }
                }}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Tooltip title="Xóa hồ sơ">
                  <Button
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </Popconfirm>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <Title level={3} className="!mb-1 text-slate-800 flex items-center gap-2">
            <AuditOutlined className="text-indigo-600" /> Số hóa Trình ký & Ký số
          </Title>
          <Text type="secondary" className="text-sm">
            Quy trình phê duyệt, thẩm định và ký số điện tử trên môi trường số không giấy tờ
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="middle"
          onClick={handleOpenCreate}
          style={{ backgroundColor: "#4f46e5", borderColor: "#4f46e5" }}
          className="font-medium shadow-sm hover:!bg-indigo-700"
        >
          Khởi tạo hồ sơ trình ký
        </Button>
      </div>

      <Card className="shadow-xs rounded-xl border border-slate-200">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key);
            setPagination(prev => ({ ...prev, page: 1 }));
          }}
          items={[
            {
              key: "pending_my_action",
              label: (
                <span className="font-medium flex items-center gap-1.5">
                  <ClockCircleOutlined className="text-amber-500" /> Cần tôi ký duyệt
                </span>
              )
            },
            {
              key: "my_submitted",
              label: (
                <span className="font-medium flex items-center gap-1.5">
                  <UserOutlined className="text-blue-500" /> Hồ sơ tôi đã gửi
                </span>
              )
            },
            {
              key: "all",
              label: (
                <span className="font-medium flex items-center gap-1.5">
                  <AuditOutlined className="text-indigo-500" /> Tất cả hồ sơ
                </span>
              )
            }
          ]}
        />

        {/* Thanh tìm kiếm & bộ lọc */}
        <div className="flex flex-wrap items-center justify-between gap-3 my-4">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-xl">
            <Input
              placeholder="Tìm theo trích yếu hoặc mã hồ sơ..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              className="flex-1"
            />
            <Select
              placeholder="Lọc trạng thái"
              allowClear
              style={{ width: 160 }}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
            >
              <Option value="IN_PROGRESS">Đang xử lý</Option>
              <Option value="APPROVED">Đã hoàn thành</Option>
              <Option value="REJECTED">Bị từ chối</Option>
            </Select>
            <Button onClick={handleSearch}>Tìm kiếm</Button>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="_id"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showTotal: (total) => `Tổng ${total} hồ sơ`,
            onChange: (p) => setPagination(prev => ({ ...prev, page: p }))
          }}
          className="border-t border-slate-100"
        />
      </Card>

      {/* Modal Khởi tạo hồ sơ trình ký */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-indigo-700 text-lg font-bold">
            <AuditOutlined /> Khởi tạo quy trình Trình ký mới
          </div>
        }
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={handleCreateSubmit}
        confirmLoading={submitting}
        okText="Tạo & Bắt đầu trình ký"
        cancelText="Hủy"
        width={720}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" initialValues={{ urgency: "NORMAL" }}>
          <Form.Item
            label="Trích yếu / Tiêu đề văn bản trình ký"
            name="title"
            rules={[{ required: true, message: "Vui lòng nhập trích yếu văn bản" }]}
          >
            <Input.TextArea
              rows={2}
              placeholder="Ví dụ: Tờ trình về việc phê duyệt kế hoạch tổ chức Hội thảo Khoa học năm 2026..."
            />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item label="Độ khẩn" name="urgency">
              <Select>
                <Option value="NORMAL">Bình thường</Option>
                <Option value="URGENT">Khẩn</Option>
                <Option value="VERY_URGENT">Hỏa tốc</Option>
              </Select>
            </Form.Item>

            <Form.Item label="Ghi chú thêm" name="description">
              <Input placeholder="Ghi chú tóm tắt nội dung gửi người duyệt..." />
            </Form.Item>
          </div>

          <Form.Item
            label="File văn bản trình ký (PDF hoặc Word)"
            required
            tooltip="Hệ thống tự động chuyển đổi file Word sang PDF để xem trước và phục vụ ký duyệt số"
          >
            <Upload
              beforeUpload={(file) => {
                setFileList([file]);
                return false;
              }}
              fileList={fileList}
              onRemove={() => setFileList([])}
              maxCount={1}
              accept=".pdf,.doc,.docx"
            >
              <Button icon={<UploadOutlined />}>Chọn file đính kèm</Button>
            </Upload>
          </Form.Item>

          {/* Cấu hình các bước duyệt */}
          <div className="mt-4 border-t border-slate-200 pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <span className="font-bold text-slate-800 text-sm">
                  Tuyến ký duyệt (Quy trình luân chuyển do Manager/Admin thiết lập):
                </span>
                <p className="text-[11px] text-slate-500 m-0">
                  Hồ sơ sẽ tự động gửi qua các bước thẩm định, ký nháy và ký duyệt theo đúng quy định.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {workflows.length > 1 && (
                  <Select
                    value={selectedWorkflowId}
                    onChange={handleWorkflowChange}
                    size="small"
                    className="w-56 text-xs"
                    placeholder="Chọn tuyến ký duyệt"
                  >
                    {workflows.map((w) => (
                      <Option key={w._id} value={w._id}>
                        {w.workflowName} {w.isDefault ? "(Chuẩn)" : ""}
                      </Option>
                    ))}
                  </Select>
                )}
                {(currentUser?.role === "admin" || currentUser?.role === "manager") && (
                  <Button
                    type="dashed"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={handleAddStep}
                  >
                    Thêm bước
                  </Button>
                )}
              </div>
            </div>

            <Spin spinning={workflowLoading} tip="Đang nạp các bước của tuyến...">
              <div className="space-y-2.5">
                {steps.map((step, idx) => {
                  const candidateUsers = (step.candidateList && step.candidateList.length > 0)
                    ? step.candidateList
                    : users;

                  return (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center gap-2.5"
                    >
                      <div className="w-6 h-6 bg-blue-600 text-white font-bold rounded-full flex items-center justify-center text-xs flex-shrink-0">
                        {idx + 1}
                      </div>

                      <div className="w-52">
                        <div className="font-medium text-xs text-slate-800 truncate" title={step.stepName}>
                          {step.stepName}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {step.actionType === "SIGN" ? "🖋️ Ký & Duyệt chính thức" : step.actionType === "ISSUE" ? "📋 Vào số & Ban hành" : "🔍 Thẩm định & Ký nháy"}
                        </div>
                      </div>

                      <Select
                        placeholder="Chọn nhân sự đảm nhiệm..."
                        showSearch
                        optionFilterProp="children"
                        value={step.assignee}
                        onChange={(val) => handleStepChange(idx, "assignee", val)}
                        style={{ flex: 1, minWidth: 220 }}
                        size="small"
                        className="text-xs"
                      >
                        {candidateUsers.map((u) => (
                          <Option key={u._id} value={u._id}>
                            {u.name} - {u.positionName || u.position?.positionName || "Cán bộ"} {u.department?.departmentName ? `(${u.department.departmentName})` : ""}
                          </Option>
                        ))}
                      </Select>

                      {(currentUser?.role === "admin" || currentUser?.role === "manager") && steps.length > 1 && (
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveStep(idx)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </Spin>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ApprovalListPage;
