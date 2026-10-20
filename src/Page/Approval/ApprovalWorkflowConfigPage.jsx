import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import {
  Card,
  Table,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Space,
  message,
  Tooltip,
  Popconfirm,
  Badge,
  Alert,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  getApprovalWorkflows,
  createApprovalWorkflow,
  updateApprovalWorkflow,
  deleteApprovalWorkflow,
} from "../../api/approvalWorkflowApi";
import { getAllUsersCanSearchBanUser } from "../../api/auth";

const { Option } = Select;

const TARGET_TYPE_MAP = {
  UNIT_LEADER: { label: "Cấp trưởng/phó đơn vị", color: "blue" },
  MANAGER: { label: "Quản trị / Manager (TCHC)", color: "purple" },
  BGH: { label: "Ban Giám hiệu", color: "gold" },
  SPECIFIC_USER: { label: "Chỉ định cá nhân", color: "cyan" },
};

const ACTION_TYPE_MAP = {
  REVIEW: { label: "Thẩm định / Ký nháy", color: "orange" },
  SIGN: { label: "Ký & Duyệt chính thức", color: "green" },
  ISSUE: { label: "Vào số & Ban hành", color: "blue" },
};

const ApprovalWorkflowConfigPage = () => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [steps, setSteps] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

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
    fetchWorkflows();
    fetchUsers();
  }, []);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const res = await getApprovalWorkflows();
      if (res.success) {
        setWorkflows(res.data || []);
      }
    } catch {
      message.error("Lỗi khi tải danh sách quy trình tuyến ký duyệt");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await getAllUsersCanSearchBanUser();
      const validUsers = (res?.users || []).filter((u) => u && u.name && u.email !== "qlvb@nsgpc.edu.vn");
      setUsers(validUsers);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenCreate = () => {
    setEditingWorkflow(null);
    form.resetFields();
    setSteps([
      {
        stepIndex: 1,
        stepName: "Cấp trưởng/phó đơn vị thẩm định & ký nháy",
        actionType: "REVIEW",
        targetType: "UNIT_LEADER",
        description: "Lãnh đạo đơn vị của người tạo xem xét và ký nháy",
      },
      {
        stepIndex: 2,
        stepName: "Quản trị / Manager thẩm định & ký nháy",
        actionType: "REVIEW",
        targetType: "MANAGER",
        description: "Phòng TCHC / Manager kiểm tra thể thức và ký nháy",
      },
      {
        stepIndex: 3,
        stepName: "Ban Giám hiệu ký duyệt",
        actionType: "SIGN",
        targetType: "BGH",
        description: "Ban Giám hiệu ký duyệt chính thức",
      },
      {
        stepIndex: 4,
        stepName: "Manager vào số & Ban hành hồ sơ",
        actionType: "ISSUE",
        targetType: "MANAGER",
        description: "Cấp số ban hành và gửi các đơn vị liên quan",
      },
    ]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (record) => {
    setEditingWorkflow(record);
    form.setFieldsValue({
      workflowCode: record.workflowCode,
      workflowName: record.workflowName,
      description: record.description,
      isDefault: record.isDefault,
      isActive: record.isActive,
    });
    setSteps(record.steps || []);
    setIsModalOpen(true);
  };

  const handleAddStep = () => {
    setSteps((prev) => [
      ...prev,
      {
        stepIndex: prev.length + 1,
        stepName: `Bước ${prev.length + 1}`,
        actionType: "REVIEW",
        targetType: "UNIT_LEADER",
        description: "",
      },
    ]);
  };

  const handleRemoveStep = (index) => {
    if (steps.length <= 1) {
      message.warning("Tuyến ký duyệt phải có ít nhất một bước");
      return;
    }
    const updated = steps
      .filter((_, idx) => idx !== index)
      .map((s, idx) => ({ ...s, stepIndex: idx + 1 }));
    setSteps(updated);
  };

  const handleStepChange = (index, field, value) => {
    const updated = [...steps];
    updated[index][field] = value;
    setSteps(updated);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (!steps || steps.length === 0) {
        message.error("Vui lòng cấu hình ít nhất một bước duyệt");
        return;
      }

      setSubmitting(true);
      const payload = {
        ...values,
        steps,
      };

      if (editingWorkflow) {
        await updateApprovalWorkflow(editingWorkflow._id, payload);
        message.success("Cập nhật tuyến ký duyệt thành công!");
      } else {
        await createApprovalWorkflow(payload);
        message.success("Thêm mới tuyến ký duyệt thành công!");
      }

      setIsModalOpen(false);
      fetchWorkflows();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || "Lỗi khi lưu cấu hình tuyến ký duyệt");
    } finally {
      setSubmitting(false);
    }
  };

  
  const isManagerOrAdmin = () => {
    if (!currentUser) return false;
    const r = (currentUser.role || currentUser.userRole || "").toLowerCase();
    return ["admin", "manager", "captruong", "cappho", "staff"].includes(r);
  };

  const handleToggleStatus = async (record, checked) => {
    try {
      await updateApprovalWorkflow(record._id, { isActive: checked });
      message.success(`Đã ${checked ? "kích hoạt" : "vô hiệu hóa"} tuyến ký duyệt!`);
      setWorkflows((prev) =>
        prev.map((w) => (w._id === record._id ? { ...w, isActive: checked } : w))
      );
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi khi thay đổi trạng thái tuyến ký");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteApprovalWorkflow(id);
      message.success("Đã xóa tuyến ký duyệt!");
      fetchWorkflows();
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi khi xóa tuyến");
    }
  };

  const columns = [
    {
      title: "Mã tuyến",
      dataIndex: "workflowCode",
      key: "workflowCode",
      width: 140,
      render: (code, r) => (
        <div className="flex flex-col gap-1 items-start">
          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs font-mono">
            {code}
          </span>
          {r.isDefault && (
            <Tag color="success" className="text-[10px] m-0 leading-tight font-semibold">
              Mặc định
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "Tên quy trình tuyến ký duyệt",
      dataIndex: "workflowName",
      key: "workflowName",
      width: 320,
      render: (name, r) => (
        <div className="py-1 space-y-1.5 whitespace-normal break-words">
          <div className="font-bold text-slate-800 text-sm leading-snug">
            {name}
          </div>
          {r.description && (
            <div className="text-xs text-slate-500 leading-relaxed bg-slate-50/80 p-2 rounded-md border border-slate-100 whitespace-pre-line break-words">
              {r.description}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Các bước luân chuyển",
      key: "steps",
      render: (_, r) => (
        <div className="flex flex-col gap-2 py-1.5">
          {r.steps?.map((s, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-xs flex-wrap bg-slate-50/60 p-2 rounded-lg border border-slate-100">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0 shadow-xs">
                {s.stepIndex}
              </span>
              <span className="font-semibold text-slate-700">{s.stepName}</span>
              <Tag color={TARGET_TYPE_MAP[s.targetType]?.color || "default"} className="text-[10px] m-0 font-medium">
                {TARGET_TYPE_MAP[s.targetType]?.label || s.targetType}
              </Tag>
              <Tag color={ACTION_TYPE_MAP[s.actionType]?.color || "default"} className="text-[10px] m-0 font-medium">
                {ACTION_TYPE_MAP[s.actionType]?.label || s.actionType}
              </Tag>
              {s.defaultAssignee && (
                <span className="text-[11px] text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 inline-flex items-center gap-1">
                  <UserOutlined className="text-[10px] text-slate-400" />
                  {s.defaultAssignee?.name || "Đã gán"}
                </span>
              )}
              {idx < (r.steps?.length || 0) - 1 && (
                <ArrowRightOutlined className="text-[10px] text-slate-400 mx-0.5 hidden sm:inline" />
              )}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      width: 140,
      align: "center",
      render: (active, record) => {
        const isActive = active !== false;
        return (
          <div className="flex items-center justify-center gap-1.5">
            <Switch
              size="small"
              checked={isActive}
              disabled={!isManagerOrAdmin()}
              onChange={(checked) => handleToggleStatus(record, checked)}
            />
            <span className={`text-xs font-semibold ${isActive ? "text-emerald-600" : "text-slate-400"}`}>
              {isActive ? "Hoạt động" : "Vô hiệu hóa"}
            </span>
          </div>
        );
      },
    },
    {
      title: "Hành động",
      key: "action",
      width: 110,
      align: "center",
      render: (_, record) => {
        if (!isManagerOrAdmin()) {
          return <span className="text-xs text-slate-400 italic">Chỉ xem</span>;
        }
        return (
          <Space size="small">
            <Tooltip title="Chỉnh sửa tuyến ký">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined className="text-blue-600 hover:text-blue-700" />}
                onClick={() => handleOpenEdit(record)}
              />
            </Tooltip>
            <Popconfirm
              title={
                record.isDefault
                  ? "Đây là tuyến mặc định của hệ thống. Bạn có chắc chắn muốn xóa không?"
                  : "Bạn có chắc muốn xóa tuyến ký duyệt này?"
              }
              onConfirm={() => handleDelete(record._id)}
              okText="Xóa"
              cancelText="Hủy"
            >
              <Tooltip title="Xóa tuyến ký">
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <div className="w-full space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center gap-2">
              <BranchesOutlined className="text-blue-600" />
              Cấu Hình Tuyến Ký Duyệt Hồ Sơ Trình Ký
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Thiết lập quy trình luân chuyển mẫu (GV-CV &rarr; Lãnh đạo đơn vị &rarr; Manager TCHC &rarr; Ban Giám hiệu &rarr; Manager vào số ban hành)
            </p>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            className="rounded-lg shadow-xs"
            disabled={!isManagerOrAdmin()}
          >
            Thêm tuyến ký duyệt
          </Button>
        </div>

        {/* Bảng danh sách tuyến */}
        <Card className="rounded-xl border border-slate-200 shadow-xs overflow-hidden" bodyStyle={{ padding: 0 }}>
          <Table
            columns={columns}
            dataSource={workflows}
            rowKey="_id"
            loading={loading}
            pagination={false}
            scroll={{ x: 800 }}
          />
        </Card>
      </div>

      {/* Modal Thêm / Sửa Tuyến */}
      <Modal
        title={
          <div className="flex items-center gap-2 font-bold text-base text-slate-800">
            <BranchesOutlined className="text-blue-600" />
            {editingWorkflow ? "Chỉnh sửa Tuyến ký duyệt" : "Thiết lập Tuyến ký duyệt mới"}
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleSave}
        confirmLoading={submitting}
        okText="Lưu cấu hình"
        cancelText="Hủy"
        width={850}
        style={{ maxWidth: "96vw" }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ isDefault: false, isActive: true }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <Form.Item
              name="workflowCode"
              label="Mã quy trình tuyến"
              rules={[{ required: true, message: "Vui lòng nhập mã quy trình" }]}
            >
              <Input
                placeholder="VD: WF_STANDARD_NSG, WF_NOI_BO..."
                disabled={!!editingWorkflow}
              />
            </Form.Item>
            <Form.Item
              name="workflowName"
              label="Tên quy trình tuyến ký duyệt"
              rules={[{ required: true, message: "Vui lòng nhập tên quy trình" }]}
            >
              <Input placeholder="VD: Quy trình trình ký chuẩn cấp Trường..." />
            </Form.Item>
          </div>

          <Form.Item name="description" label="Mô tả tóm tắt quy trình">
            <Input.TextArea rows={2} placeholder="Mô tả đối tượng áp dụng và cách thức luân chuyển hồ sơ..." />
          </Form.Item>

          <div className="flex items-center gap-6 mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <Form.Item name="isDefault" valuePropName="checked" className="m-0">
              <Switch />
            </Form.Item>
            <span className="text-xs text-slate-700 font-medium">
              Đặt làm Tuyến ký duyệt chuẩn mặc định cho toàn hệ thống
            </span>
          </div>

          {/* Cấu hình các bước */}
          <div className="border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-slate-800">
                Các bước luân chuyển hồ sơ:
              </span>
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddStep}
              >
                Thêm bước
              </Button>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                        {idx + 1}
                      </span>
                      <Input
                        value={step.stepName}
                        onChange={(e) => handleStepChange(idx, "stepName", e.target.value)}
                        placeholder="Tên bước duyệt"
                        className="font-medium text-xs w-64"
                      />
                    </div>
                    {steps.length > 1 && (
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveStep(idx)}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-[11px] text-slate-500 mb-1">Đối tượng đảm nhiệm:</div>
                      <Select
                        value={step.targetType}
                        onChange={(val) => handleStepChange(idx, "targetType", val)}
                        className="w-full text-xs"
                        size="small"
                      >
                        <Option value="UNIT_LEADER">Cấp trưởng/phó đơn vị</Option>
                        <Option value="MANAGER">Quản trị / Manager (TCHC)</Option>
                        <Option value="BGH">Ban Giám hiệu</Option>
                        <Option value="SPECIFIC_USER">Chỉ định cá nhân</Option>
                      </Select>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-500 mb-1">Hành động:</div>
                      <Select
                        value={step.actionType}
                        onChange={(val) => handleStepChange(idx, "actionType", val)}
                        className="w-full text-xs"
                        size="small"
                      >
                        <Option value="REVIEW">Thẩm định / Ký nháy</Option>
                        <Option value="SIGN">Ký & Duyệt chính thức</Option>
                        <Option value="ISSUE">Vào số & Ban hành</Option>
                      </Select>
                    </div>

                    <div>
                      <div className="text-[11px] text-slate-500 mb-1">Người mặc định (tùy chọn):</div>
                      <Select
                        value={step.defaultAssignee}
                        onChange={(val) => handleStepChange(idx, "defaultAssignee", val)}
                        className="w-full text-xs"
                        size="small"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        filterOption={(input, option) => {
                          const label = option?.label || "";
                          const search = input.toLowerCase();
                          return label.toLowerCase().includes(search);
                        }}
                        placeholder="Tự động chọn theo đối tượng"
                        disabled={step.targetType === "UNIT_LEADER"}
                      >
                        {users.map((u) => {
                          const displayLabel = `${u.name} (${u.position?.positionName || u.role || "Cán bộ"})`;
                          return (
                            <Option key={u._id} value={u._id} label={displayLabel}>
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-800">{u.name}</span>
                                <span className="text-[10px] text-slate-500">
                                  {u.position?.positionName || u.role} {u.department?.departmentName ? `- ${u.department.departmentName}` : ""}
                                </span>
                              </div>
                            </Option>
                          );
                        })}
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ApprovalWorkflowConfigPage;
