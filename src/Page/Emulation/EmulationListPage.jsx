/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  Card,
  Modal,
  Drawer,
  Form,
  message,
  Popconfirm,
  Typography,
  Tooltip,
  Badge,
  Timeline,
  Divider,
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SendOutlined,
  FilePdfOutlined,
  TrophyOutlined,
  BankOutlined,
  UserOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import dayjs from "dayjs";
import {
  getEmulationRegistrations,
  deleteEmulationRegistration,
  reviewEmulationRegistration,
  getEmulationTitles,
} from "../../api/emulationApi";
import { getAllDepartments } from "../../api/DepartmentAPI";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SCHOOL_YEARS = [
  "2026-2027",
  "2025-2026",
  "2024-2025",
  "2023-2024",
];

const EmulationListPage = () => {
  const navigate = useNavigate();

  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Filters
  const [schoolYear, setSchoolYear] = useState("2025-2026");
  const [department, setDepartment] = useState("");
  const [titleId, setTitleId] = useState("");
  const [status, setStatus] = useState("");
  const [searchText, setSearchText] = useState("");

  // Master data
  const [departments, setDepartments] = useState([]);
  const [titles, setTitles] = useState([]);
  const [userRoleInfo, setUserRoleInfo] = useState({});

  // Drawer chi tiết & Modal xét duyệt
  const [selectedReg, setSelectedReg] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewAction, setReviewAction] = useState(""); // MANAGER_SUBMIT_BGH, MANAGER_REJECT, BGH_APPROVE, BGH_REJECT
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewForm] = Form.useForm();

  const currentUserId = Cookies.get("userId");

  // Tải danh sách đăng ký
  const fetchRegistrations = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        schoolYear: schoolYear || undefined,
        department: department || undefined,
        title: titleId || undefined,
        status: status || undefined,
        search: searchText || undefined,
      };

      const res = await getEmulationRegistrations(params);
      if (res.success) {
        setRegistrations(res.data || []);
        setTotal(res.pagination?.total || 0);
        if (res.userRoleInfo) {
          setUserRoleInfo(res.userRoleInfo);
        }
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể tải danh sách đăng ký");
    } finally {
      setLoading(false);
    }
  }, [schoolYear, department, titleId, status, searchText]);

  // Tải master data: phòng ban, danh hiệu
  useEffect(() => {
    const loadMasterData = async () => {
      try {
        const [deptRes, titleRes] = await Promise.all([
          getAllDepartments(),
          getEmulationTitles({ activeOnly: "true" }),
        ]);
        if (deptRes && Array.isArray(deptRes)) {
          setDepartments(deptRes);
        } else if (deptRes?.departments) {
          setDepartments(deptRes.departments);
        }
        if (titleRes.success) {
          setTitles(titleRes.data || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadMasterData();
  }, []);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const handleDelete = async (id) => {
    try {
      await deleteEmulationRegistration(id);
      message.success("Xóa hồ sơ đăng ký thành công!");
      fetchRegistrations();
    } catch (err) {
      message.error(err.response?.data?.message || "Không thể xóa hồ sơ đăng ký");
    }
  };

  const handleOpenReview = (record, action) => {
    setSelectedReg(record);
    setReviewAction(action);
    reviewForm.resetFields();
    if (action === "MANAGER_SUBMIT_BGH") {
      reviewForm.setFieldsValue({ note: "Đơn vị đã rà soát hồ sơ, kính chuyển Ban Giám hiệu xem xét công nhận." });
    } else if (action === "BGH_APPROVE") {
      reviewForm.setFieldsValue({ note: "Hội đồng TĐ-KT trường thống nhất phê duyệt công nhận danh hiệu." });
    }
    setReviewModalVisible(true);
  };

  const handleConfirmReview = async () => {
    try {
      const values = await reviewForm.validateFields();
      setReviewSubmitting(true);
      await reviewEmulationRegistration(selectedReg._id, {
        action: reviewAction,
        note: values.note,
      });
      message.success("Cập nhật trạng thái xét duyệt thành công!");
      setReviewModalVisible(false);
      if (drawerVisible) {
        setDrawerVisible(false);
      }
      fetchRegistrations();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || "Lỗi khi xét duyệt hồ sơ");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const renderStatus = (s) => {
    switch (s) {
      case "PENDING":
        return <Badge status="warning" text={<span className="text-amber-600 font-medium">Chờ QL duyệt</span>} />;
      case "SUBMITTED_TO_BGH":
        return <Badge status="processing" text={<span className="text-blue-600 font-medium">Đã chuyển BGH</span>} />;
      case "SCHOOL_APPROVED":
        return <Badge status="success" text={<span className="text-green-600 font-semibold">BGH đã công nhận</span>} />;
      case "REJECTED":
        return <Badge status="error" text={<span className="text-red-600 font-medium">Từ chối / Sửa lại</span>} />;
      default:
        return <Tag>{s}</Tag>;
    }
  };

  const isBGH = userRoleInfo.isBGH;
  const isManager = userRoleInfo.isManager;

  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 50,
      align: "center",
      render: (_, __, index) => index + 1,
    },
    {
      title: "Cán bộ đề nghị",
      key: "name",
      width: 190,
      render: (_, record) => (
        <div>
          <div className="font-semibold text-gray-800 flex items-center gap-1">
            <UserOutlined className="text-blue-500 text-xs" />
            {record.name || record.user?.name}
          </div>
          <div className="text-xs text-gray-500">
            {record.positionName || record.position?.positionName || "Chưa có chức vụ"}
          </div>
        </div>
      ),
    },
    {
      title: "Đơn vị / Phòng ban",
      key: "department",
      width: 170,
      render: (_, record) => (
        <div className="text-sm text-gray-700 flex items-center gap-1">
          <BankOutlined className="text-gray-400" />
          {record.departmentName || record.department?.departmentName || "Trường CĐ Nam Sài Gòn"}
        </div>
      ),
    },
    {
      title: "Năm học",
      dataIndex: "schoolYear",
      key: "schoolYear",
      width: 95,
      align: "center",
      render: (year) => <Tag color="blue">{year}</Tag>,
    },
    {
      title: "Danh hiệu thi đua đề nghị",
      key: "titles",
      minWidth: 240,
      render: (_, record) => (
        <div className="flex flex-wrap gap-1">
          {(record.titles || []).map((t) => (
            <Tag color="gold" key={t._id || t}>
              <TrophyOutlined className="mr-1" />
              {t.name || t.code || t}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: "Hồ sơ minh chứng",
      key: "files",
      width: 115,
      align: "center",
      render: (_, record) => {
        const fileCount = record.attachedFiles?.length || 0;
        if (fileCount === 0) {
          return <Text type="secondary" className="text-xs italic">Chưa đính kèm</Text>;
        }
        return (
          <Tooltip title="Xem danh sách file đính kèm">
            <Button
              type="dashed"
              size="small"
              icon={<FilePdfOutlined className="text-red-500" />}
              onClick={() => {
                setSelectedReg(record);
                setDrawerVisible(true);
              }}
            >
              {fileCount} tài liệu
            </Button>
          </Tooltip>
        );
      },
    },
    {
      title: "Ngày đề nghị",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 105,
      align: "center",
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY") : "--"),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (s) => renderStatus(s),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 145,
      align: "center",
      fixed: "right",
      render: (_, record) => {
        const isOwner = String(record.user?._id || record.user) === String(currentUserId);
        const canReviewManager = (isManager || isBGH) && record.status === "PENDING";
        const canReviewBGH = isBGH && (record.status === "SUBMITTED_TO_BGH" || record.status === "PENDING");
        const canEdit = isOwner && record.status !== "SCHOOL_APPROVED";
        const canDelete = (isOwner || isBGH) && record.status !== "SCHOOL_APPROVED";

        return (
          <Space size="small" wrap>
            <Tooltip title="Xem chi tiết">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined className="text-blue-600" />}
                onClick={() => {
                  setSelectedReg(record);
                  setDrawerVisible(true);
                }}
              />
            </Tooltip>

            {/* Thao tác của Quản lý: Duyệt & Chuyển BGH */}
            {canReviewManager && (
              <Tooltip title="Duyệt sơ bộ & chuyển hồ sơ lên BGH">
                <Button
                  type="primary"
                  size="small"
                  icon={<SendOutlined />}
                  style={{ backgroundColor: "#1890ff" }}
                  onClick={() => handleOpenReview(record, "MANAGER_SUBMIT_BGH")}
                >
                  Gửi BGH
                </Button>
              </Tooltip>
            )}

            {/* Thao tác của BGH: Phê duyệt công nhận */}
            {canReviewBGH && (
              <Tooltip title="Ban Giám hiệu phê duyệt công nhận">
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  style={{ backgroundColor: "#52c41a" }}
                  onClick={() => handleOpenReview(record, "BGH_APPROVE")}
                >
                  Công nhận
                </Button>
              </Tooltip>
            )}

            {/* Nút sửa */}
            {canEdit && (
              <Tooltip title="Chỉnh sửa đơn">
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined className="text-amber-500" />}
                  onClick={() => navigate("/emulation/register")}
                />
              </Tooltip>
            )}

            {/* Nút xóa */}
            {canDelete && (
              <Tooltip title="Xóa hồ sơ">
                <Popconfirm
                  title="Xóa hồ sơ đề nghị thi đua này?"
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleDelete(record._id)}
                >
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="w-full px-2 sm:px-4 py-3">
      <Card className="shadow-sm border-gray-200 w-full">
        {/* TIÊU ĐỀ & NÚT HÀNH ĐỘNG */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-gray-100">
          <div>
            <Title level={4} className="!mb-1 flex items-center gap-2 text-blue-700">
              <TrophyOutlined className="text-yellow-500 text-xl" />
              Danh Sách Đề Nghị Thi Đua - Khen Thưởng
            </Title>
            <Text type="secondary">
              Theo dõi hồ sơ đề nghị danh hiệu thi đua và quy trình xét duyệt đa cấp
            </Text>
          </div>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={fetchRegistrations} loading={loading}>
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/emulation/register")}
              style={{ backgroundColor: "#1890ff" }}
            >
              Đề nghị mới
            </Button>
          </Space>
        </div>

        {/* THANH BỘ LỌC TÌM KIẾM */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div>
            <Text className="text-xs text-gray-500 block mb-1">Năm học:</Text>
            <Select
              className="w-full"
              value={schoolYear}
              onChange={setSchoolYear}
              allowClear
              placeholder="Tất cả năm học"
            >
              {SCHOOL_YEARS.map((y) => (
                <Select.Option key={y} value={y}>
                  Năm học {y}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div>
            <Text className="text-xs text-gray-500 block mb-1">Đơn vị / Phòng ban:</Text>
            <Select
              className="w-full"
              value={department}
              onChange={setDepartment}
              allowClear
              placeholder="Tất cả phòng ban"
              showSearch
              optionFilterProp="children"
            >
              {departments.map((d) => (
                <Select.Option key={d._id} value={d._id}>
                  {d.departmentName}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div>
            <Text className="text-xs text-gray-500 block mb-1">Danh hiệu:</Text>
            <Select
              className="w-full"
              value={titleId}
              onChange={setTitleId}
              allowClear
              placeholder="Tất cả danh hiệu"
              showSearch
              optionFilterProp="children"
            >
              {titles.map((t) => (
                <Select.Option key={t._id} value={t._id}>
                  {t.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          <div>
            <Text className="text-xs text-gray-500 block mb-1">Trạng thái duyệt:</Text>
            <Select
              className="w-full"
              value={status}
              onChange={setStatus}
              allowClear
              placeholder="Tất cả trạng thái"
            >
              <Select.Option value="PENDING">Chờ Quản lý duyệt</Select.Option>
              <Select.Option value="SUBMITTED_TO_BGH">Đã chuyển BGH</Select.Option>
              <Select.Option value="SCHOOL_APPROVED">BGH đã công nhận</Select.Option>
              <Select.Option value="REJECTED">Từ chối / Cần sửa</Select.Option>
            </Select>
          </div>

          <div>
            <Text className="text-xs text-gray-500 block mb-1">Tìm theo họ tên:</Text>
            <Input
              placeholder="Nhập tên cán bộ..."
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </div>
        </div>

        {/* BẢNG DANH SÁCH */}
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={registrations}
          loading={loading}
          pagination={{
            total: total,
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (totalCount) => `Tổng cộng ${totalCount} hồ sơ đề nghị`,
          }}
          bordered
          size="middle"
          scroll={{ x: 1250 }}
        />
      </Card>

      {/* DRAWER XEM CHI TIẾT HỒ SƠ & LỊCH SỬ DUYỆT */}
      <Drawer
        title={
          <div className="flex items-center gap-2 text-blue-700">
            <TrophyOutlined className="text-yellow-500" />
            <span>Chi tiết Hồ sơ Đề nghị Thi đua</span>
          </div>
        }
        width={720}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        destroyOnClose
      >
        {selectedReg && (
          <div className="space-y-4">
            {/* THÔNG TIN CÁN BỘ */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="font-semibold text-base text-gray-800">
                {selectedReg.name || selectedReg.user?.name}
              </div>
              <div className="text-sm text-gray-600">
                Chức vụ: {selectedReg.positionName || selectedReg.position?.positionName || "Chưa có"} |
                Đơn vị: {selectedReg.departmentName || selectedReg.department?.departmentName || "Chưa phân khoa"}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Email: {selectedReg.user?.email} | Số điện thoại: {selectedReg.user?.mobile || "Không có"}
              </div>
            </div>

            {/* NĂM HỌC VÀ TRẠNG THÁI */}
            <div className="flex justify-between items-center p-2 bg-blue-50 rounded border border-blue-100">
              <div>
                <span className="text-sm text-gray-600 mr-2">Năm học:</span>
                <Tag color="blue" className="font-medium text-sm">
                  {selectedReg.schoolYear}
                </Tag>
              </div>
              <div>{renderStatus(selectedReg.status)}</div>
            </div>

            {/* DANH SÁCH THÀNH VIÊN ĐỀ NGHỊ */}
            {selectedReg.members && selectedReg.members.length > 0 && (
              <div>
                <Text strong className="block mb-2 text-gray-700">
                  Danh sách cán bộ được đề nghị khen thưởng ({selectedReg.members.length} người):
                </Text>
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 border-b">
                      <tr>
                        <th className="p-2 w-10 text-center">STT</th>
                        <th className="p-2 w-48">Họ và tên</th>
                        <th className="p-2 w-36">Chức vụ</th>
                        <th className="p-2">Danh hiệu đề nghị</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedReg.members.map((m, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 text-center text-gray-500 font-semibold">{idx + 1}</td>
                          <td className="p-2 font-medium text-gray-800">{m.name}</td>
                          <td className="p-2 text-gray-600">{m.positionName || "--"}</td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              {(m.titles || []).map((t) => (
                                <Tag color="gold" key={t._id || t} className="text-[11px]">
                                  {t.name || t.code || t}
                                </Tag>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DANH HIỆU ĐỀ NGHỊ TỔNG HỢP */}
            <div>
              <Text strong className="block mb-2 text-gray-700">
                Tổng hợp danh hiệu thi đua đề nghị:
              </Text>
              <div className="flex flex-col gap-2">
                {(selectedReg.titles || []).map((t) => (
                  <div
                    key={t._id || t}
                    className="p-2 border rounded-lg bg-yellow-50/40 border-yellow-200 flex justify-between items-center"
                  >
                    <div>
                      <span className="font-medium text-gray-800">{t.name || t.code || t}</span>
                      {t.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                      )}
                    </div>
                    <Tag color="gold">{t.level === "CO_SO" ? "Cấp Trường" : "Cấp Tỉnh/Bộ"}</Tag>
                  </div>
                ))}
              </div>
            </div>

            {/* HỒ SƠ MINH CHỨNG */}
            <div>
              <Text strong className="block mb-2 text-gray-700">
                Hồ sơ minh chứng đính kèm ({selectedReg.attachedFiles?.length || 0}):
              </Text>
              <div className="divide-y border rounded-lg overflow-hidden">
                {(!selectedReg.attachedFiles || selectedReg.attachedFiles.length === 0) && (
                  <div className="p-3 text-center text-gray-400 text-sm">
                    Không có tài liệu minh chứng đính kèm
                  </div>
                )}
                {(selectedReg.attachedFiles || []).map((f, idx) => (
                  <div key={idx} className="p-3 flex justify-between items-center hover:bg-gray-50">
                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                      <FilePdfOutlined className="text-red-500 text-lg flex-shrink-0" />
                      <div className="truncate">
                        <div className="text-xs text-gray-500 font-medium">
                          {f.documentTypeName || f.documentType?.name || "Minh chứng"}
                        </div>
                        <a
                          href={f.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 font-medium text-sm hover:underline truncate block"
                        >
                          {f.fileName}
                        </a>
                      </div>
                    </div>
                    <Button
                      type="link"
                      icon={<EyeOutlined />}
                      href={f.fileUrl}
                      target="_blank"
                      size="small"
                    >
                      Xem trên Drive
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* GHI CHÚ / CAM KẾT */}
            {selectedReg.notes && (
              <div>
                <Text strong className="block mb-1 text-gray-700">
                  Ghi chú / Cam kết phấn đấu:
                </Text>
                <div className="p-3 bg-gray-50 rounded border text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedReg.notes}
                </div>
              </div>
            )}

            {/* NHẬN XÉT CỦA QUẢN LÝ ĐƠN VỊ & BAN GIÁM HIỆU */}
            {(selectedReg.managerReview?.note || selectedReg.bghReview?.note) && (
              <div className="space-y-2">
                <Text strong className="block text-gray-700">
                  Ý kiến / Nhận xét của cấp xét duyệt:
                </Text>
                {selectedReg.managerReview?.note && (
                  <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded text-sm">
                    <span className="font-semibold text-amber-800">
                      Quản lý đơn vị ({selectedReg.managerReview.reviewedByName}):
                    </span>{" "}
                    {selectedReg.managerReview.note}
                    <div className="text-xs text-gray-400 mt-1">
                      {dayjs(selectedReg.managerReview.reviewedAt).format("DD/MM/YYYY HH:mm")}
                    </div>
                  </div>
                )}
                {selectedReg.bghReview?.note && (
                  <div className="p-2.5 bg-green-50/60 border border-green-200 rounded text-sm">
                    <span className="font-semibold text-green-800">
                      Ban Giám hiệu ({selectedReg.bghReview.reviewedByName}):
                    </span>{" "}
                    {selectedReg.bghReview.note}
                    <div className="text-xs text-gray-400 mt-1">
                      {dayjs(selectedReg.bghReview.reviewedAt).format("DD/MM/YYYY HH:mm")}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LỊCH SỬ THAO TÁC / VẾT DUYỆT */}
            <div>
              <Text strong className="block mb-2 text-gray-700 flex items-center gap-1">
                <HistoryOutlined /> Lịch sử theo dõi tiến trình:
              </Text>
              <Timeline
                className="mt-3 text-xs"
                items={(selectedReg.history || []).map((h) => ({
                  color:
                    h.action.includes("APPROVED") || h.action.includes("SUBMIT")
                      ? "green"
                      : h.action.includes("REJECT")
                      ? "red"
                      : "blue",
                  children: (
                    <div>
                      <div className="font-medium text-gray-800">
                        {h.actorName} ({h.actorRole || "Cán bộ"}): {h.details}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {dayjs(h.timestamp).format("DD/MM/YYYY HH:mm:ss")}
                      </div>
                    </div>
                  ),
                }))}
              />
            </div>

            <Divider />

            {/* NÚT THAO TÁC XÉT DUYỆT NHANH TRONG DRAWER */}
            <div className="flex justify-end gap-2">
              {(isManager || isBGH) && selectedReg.status === "PENDING" && (
                <>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => handleOpenReview(selectedReg, "MANAGER_REJECT")}
                  >
                    Từ chối
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    style={{ backgroundColor: "#1890ff" }}
                    onClick={() => handleOpenReview(selectedReg, "MANAGER_SUBMIT_BGH")}
                  >
                    Duyệt & Gửi BGH
                  </Button>
                </>
              )}

              {isBGH && selectedReg.status === "SUBMITTED_TO_BGH" && (
                <>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => handleOpenReview(selectedReg, "BGH_REJECT")}
                  >
                    Không công nhận
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    style={{ backgroundColor: "#52c41a" }}
                    onClick={() => handleOpenReview(selectedReg, "BGH_APPROVE")}
                  >
                    BGH Phê duyệt công nhận
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* MODAL XÉT DUYỆT / NHẬP Ý KIẾN */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            {reviewAction.includes("REJECT") ? (
              <CloseCircleOutlined className="text-red-500" />
            ) : (
              <CheckCircleOutlined className="text-green-500" />
            )}
            <span>
              {reviewAction === "MANAGER_SUBMIT_BGH"
                ? "Duyệt hồ sơ & Chuyển lên Ban Giám hiệu"
                : reviewAction === "MANAGER_REJECT"
                ? "Quản lý đơn vị từ chối hồ sơ"
                : reviewAction === "BGH_APPROVE"
                ? "Ban Giám hiệu phê duyệt công nhận danh hiệu"
                : "Ban Giám hiệu từ chối công nhận"}
            </span>
          </div>
        }
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        onOk={handleConfirmReview}
        confirmLoading={reviewSubmitting}
        okText={reviewAction.includes("REJECT") ? "Xác nhận từ chối" : "Xác nhận phê duyệt"}
        okButtonProps={{
          danger: reviewAction.includes("REJECT"),
          style: !reviewAction.includes("REJECT") ? { backgroundColor: "#1890ff" } : {},
        }}
        cancelText="Đóng"
        destroyOnClose
      >
        <Form form={reviewForm} layout="vertical" className="mt-4">
          <Paragraph className="text-gray-600 text-sm">
            Bạn đang thực hiện xét duyệt hồ sơ đăng ký của cán bộ{" "}
            <strong>{selectedReg?.name || selectedReg?.user?.name}</strong> (Năm học{" "}
            <strong>{selectedReg?.schoolYear}</strong>).
          </Paragraph>

          <Form.Item
            name="note"
            label="Ý kiến / Nhận xét của cấp xét duyệt"
            rules={[
              {
                required: reviewAction.includes("REJECT"),
                message: "Vui lòng nhập lý do từ chối để cán bộ biết và chỉnh sửa",
              },
            ]}
          >
            <TextArea
              rows={4}
              placeholder={
                reviewAction.includes("REJECT")
                  ? "Nhập lý do từ chối, yêu cầu bổ sung hồ sơ..."
                  : "Nhập nhận xét, đánh giá kết quả đạt được..."
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default EmulationListPage;
