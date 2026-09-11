import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Tag,
  Space,
  Modal,
  Form,
  Radio,
  InputNumber,
  Upload,
  message,
  Badge,
  Tooltip,
  Row,
  Col,
  Descriptions,
  Timeline,
  Divider,
  Switch,
  Statistic,
} from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileDoneOutlined,
  UploadOutlined,
  EyeOutlined,
  EditOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  UserOutlined,
  BarChartOutlined,
  DollarOutlined,
  BookOutlined,
  CalendarOutlined,
  UnorderedListOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import dayjs from "dayjs";
import {
  getTrainingRegistrations,
  reportTrainingResult,
  confirmTrainingReportResult,
  uploadTrainingProofFiles,
} from "../../api/trainingApi";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { useNotificationContext } from "../../context/NotificationContext";

const { Option } = Select;
const { TextArea } = Input;

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = [
  currentYear - 1,
  currentYear,
  currentYear + 1,
  currentYear + 2,
].map((y) => y.toString());

const TrainingResultReportPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userId, userRole, refetchNotificationCounts } = useNotificationContext();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Bộ lọc
  const [filterYear, setFilterYear] = useState(currentYear.toString());
  const [filterDept, setFilterDept] = useState(null);
  const [filterReportStatus, setFilterReportStatus] = useState("ALL"); // ALL, NOT_REPORTED, REPORTED, NOT_ATTENDED
  const [searchText, setSearchText] = useState("");

  // Modal Báo cáo kết quả
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportingRecord, setReportingRecord] = useState(null);
  const [reportForm] = Form.useForm();
  const [reportAttended, setReportAttended] = useState(true);
  const [reportHasFunding, setReportHasFunding] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  // Modal Chi tiết
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);

  const isAdmin = userRole === "admin" || userRole === "manager";

  // 1. Tải danh mục phòng ban
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await getAllDepartments();
        const deptList = (
          res?.AllDepartment ||
          res?.data ||
          res?.departments ||
          (Array.isArray(res) ? res : [])
        ).filter((d) => !d.departmentName?.toLowerCase().includes("giải thể"));
        setDepartments(deptList);
      } catch (err) {
        console.error("Lỗi lấy danh sách phòng ban:", err);
      }
    };
    fetchDepts();
  }, []);

  // 2. Tải danh sách hồ sơ bồi dưỡng đã được phê duyệt
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        fetchAll: "true",
        status: "APPROVED", // Chỉ các hồ sơ đã duyệt mới báo cáo kết quả
      };

      if (filterYear) params.year = filterYear;
      if (filterDept) params.department = filterDept;
      if (searchText.trim()) params.search = searchText.trim();

      const res = await getTrainingRegistrations(params);
      if (res.success) {
        setData(res.data || []);
      }
    } catch (err) {
      console.error("Lỗi tải danh sách báo cáo bồi dưỡng:", err);
      message.error("Lỗi khi tải danh sách bồi dưỡng.");
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterDept, searchText]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 3. Lọc dữ liệu theo trạng thái báo cáo
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const rep = item.reportResult || {};
      const isReported = rep.status === "REPORTED";

      if (filterReportStatus === "NOT_REPORTED") {
        return !isReported;
      }
      if (filterReportStatus === "REPORTED") {
        return isReported && rep.attended !== false;
      }
      if (filterReportStatus === "NOT_ATTENDED") {
        return isReported && rep.attended === false;
      }
      return true;
    });
  }, [data, filterReportStatus]);

  // 4. Thống kê nhanh
  const stats = useMemo(() => {
    const total = data.length;
    let reportedCount = 0;
    let notAttendedCount = 0;
    let totalFund = 0;

    data.forEach((d) => {
      const rep = d.reportResult;
      if (rep && rep.status === "REPORTED") {
        if (rep.attended === false) {
          notAttendedCount += 1;
        } else {
          reportedCount += 1;
          if (rep.hasFundingSupport && rep.actualFundAmount) {
            totalFund += Number(rep.actualFundAmount) || 0;
          }
        }
      }
    });

    const pendingCount = total - reportedCount - notAttendedCount;

    return {
      total,
      reportedCount,
      notAttendedCount,
      pendingCount: pendingCount > 0 ? pendingCount : 0,
      totalFund,
    };
  }, [data]);

  // 5. Mở modal Báo cáo kết quả
  const handleOpenReportModal = (record) => {
    setReportingRecord(record);
    const existing = record.reportResult || {};
    const attended = existing.attended !== false;
    const hasFund = Boolean(existing.hasFundingSupport);

    setReportAttended(attended);
    setReportHasFunding(hasFund);
    setUploadedFiles(existing.proofFiles || []);

    reportForm.setFieldsValue({
      attended: attended ? "true" : "false",
      resultDetails: existing.resultDetails || "Đạt",
      notAttendedReason: existing.notAttendedReason || "",
      hasFundingSupport: hasFund,
      actualFundAmount: existing.actualFundAmount || 0,
    });

    setIsReportModalOpen(true);
  };

  // 6. Xử lý Upload minh chứng
  const handleCustomUpload = async ({ file, onSuccess, onError }) => {
    setUploadingFiles(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await uploadTrainingProofFiles(formData);
      if (res.success && res.data && res.data.length > 0) {
        setUploadedFiles((prev) => [...prev, ...res.data]);
        message.success(`Đã tải lên minh chứng: ${file.name}`);
        onSuccess(res.data);
      } else {
        throw new Error(res.message || "Tải file thất bại");
      }
    } catch (err) {
      console.error("Lỗi upload minh chứng:", err);
      message.error(err.response?.data?.message || "Lỗi tải file minh chứng lên Drive");
      onError(err);
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleRemoveFile = (fileId) => {
    setUploadedFiles((prev) => prev.filter((f) => f.fileId !== fileId));
    message.info("Đã gỡ bỏ file minh chứng");
  };

  // 7. Gửi Báo cáo kết quả
  const handleSubmitReport = async () => {
    try {
      const values = await reportForm.validateFields();
      setSubmittingReport(true);

      const payload = {
        attended: reportAttended,
        notAttendedReason: !reportAttended ? values.notAttendedReason : "",
        resultDetails: reportAttended ? values.resultDetails : "",
        hasFundingSupport: reportAttended ? reportHasFunding : false,
        actualFundAmount: reportAttended && reportHasFunding ? values.actualFundAmount : 0,
        proofFiles: reportAttended ? uploadedFiles : [],
      };

      const res = await reportTrainingResult(reportingRecord._id, payload);
      if (res.success) {
        message.success("Báo cáo kết quả bồi dưỡng thành công!");
        setIsReportModalOpen(false);
        fetchData();
        if (refetchNotificationCounts) refetchNotificationCounts();
      }
    } catch (err) {
      console.error("Lỗi gửi báo cáo kết quả:", err);
      message.error(err.response?.data?.message || "Lỗi khi báo cáo kết quả");
    } finally {
      setSubmittingReport(false);
    }
  };

  // 8. Manager xác nhận kết quả
  const handleConfirmResult = async (record) => {
    try {
      const res = await confirmTrainingReportResult(record._id);
      if (res.success) {
        message.success("Đã xác nhận kết quả bồi dưỡng!");
        fetchData();
      }
    } catch (err) {
      console.error("Lỗi xác nhận kết quả:", err);
      message.error(err.response?.data?.message || "Lỗi khi xác nhận kết quả");
    }
  };

  // Cột bảng dữ liệu
  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 60,
      align: "center",
      render: (_, __, index) => <span className="font-semibold text-slate-500">{index + 1}</span>,
    },
    {
      title: "Nhân sự",
      key: "userName",
      width: 220,
      render: (_, r) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-800 text-sm">{r.userName}</span>
            {!r.user && (
              <Tag color="orange" className="text-[10px] px-1 py-0 m-0 border-none font-medium">
                Chưa có TK
              </Tag>
            )}
          </div>
          <div className="text-xs text-slate-500">{r.positionName || "Cán bộ"}</div>
          <div className="text-xs text-blue-600 font-medium">{r.departmentName || "Đơn vị"}</div>
        </div>
      ),
    },
    {
      title: "Khóa học & Hình thức",
      key: "trainingContent",
      width: 280,
      render: (_, r) => (
        <div className="space-y-1">
          <div className="font-semibold text-slate-800 text-sm line-clamp-2" title={r.trainingContent}>
            {r.trainingContent}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag color="blue" className="text-xs m-0">
              {r.trainingForm || "Chứng chỉ"}
            </Tag>
            {r.trainingLocation && (
              <span className="text-xs text-slate-500 truncate max-w-[180px]" title={r.trainingLocation}>
                📍 {r.trainingLocation}
              </span>
            )}
          </div>
          {r.trainingDuration && (
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <CalendarOutlined /> {r.trainingDuration}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Tình trạng báo cáo",
      key: "reportStatus",
      width: 170,
      render: (_, r) => {
        const rep = r.reportResult;
        if (!rep || rep.status !== "REPORTED") {
          return (
            <Tag icon={<ClockCircleOutlined />} color="warning" className="px-2.5 py-0.5 font-medium">
              Chưa báo cáo
            </Tag>
          );
        }
        if (rep.attended === false) {
          return (
            <Tag icon={<CloseCircleOutlined />} color="error" className="px-2.5 py-0.5 font-medium">
              Không tham gia
            </Tag>
          );
        }
        return (
          <div className="space-y-1">
            <Tag icon={<CheckCircleOutlined />} color="success" className="px-2.5 py-0.5 font-medium m-0">
              Đã tham gia học
            </Tag>
            {rep.managerConfirmed ? (
              <div>
                <Tag color="cyan" className="text-[10px] m-0">
                  ✓ Quản lý đã xác nhận
                </Tag>
              </div>
            ) : (
              <div>
                <Tag color="default" className="text-[10px] m-0 text-slate-400">
                  Chờ quản lý duyệt KQ
                </Tag>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Kết quả & Minh chứng",
      key: "resultDetails",
      width: 240,
      render: (_, r) => {
        const rep = r.reportResult;
        if (!rep || rep.status !== "REPORTED") {
          return <span className="text-slate-400 text-xs italic">Chưa có kết quả</span>;
        }

        if (rep.attended === false) {
          return (
            <div className="text-xs text-red-600">
              <span className="font-semibold">Lý do: </span>
              <span>{rep.notAttendedReason || "Không nêu rõ"}</span>
            </div>
          );
        }

        return (
          <div className="space-y-1 text-xs">
            <div>
              <span className="font-semibold text-slate-700">Kết quả: </span>
              <span className="text-emerald-700 font-medium">{rep.resultDetails || "Đạt"}</span>
            </div>
            {rep.hasFundingSupport ? (
              <div className="text-blue-700 font-medium">
                💰 Hỗ trợ: {(Number(rep.actualFundAmount) || 0).toLocaleString("vi-VN")} đ
              </div>
            ) : (
              <div className="text-slate-400">Không nhận kinh phí</div>
            )}
            {Array.isArray(rep.proofFiles) && rep.proofFiles.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {rep.proofFiles.map((file, idx) => (
                  <a
                    key={file.fileId || idx}
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200"
                  >
                    <PaperClipOutlined /> {file.fileName || `Minh chứng ${idx + 1}`}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 170,
      align: "center",
      render: (_, r) => {
        const rep = r.reportResult;
        const isReported = rep && rep.status === "REPORTED";

        return (
          <div className="flex flex-col gap-1.5 items-center">
            <Button
              type={isReported ? "default" : "primary"}
              size="small"
              icon={isReported ? <EditOutlined /> : <FileDoneOutlined />}
              onClick={() => handleOpenReportModal(r)}
              className={
                isReported
                  ? "text-xs w-full hover:border-blue-500"
                  : "bg-blue-600 hover:bg-blue-700 text-xs w-full font-semibold shadow-xs"
              }
            >
              {isReported ? "Sửa kết quả" : "Báo cáo kết quả"}
            </Button>

            <div className="flex items-center gap-1 w-full">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setDetailRecord(r);
                  setIsDetailModalOpen(true);
                }}
                className="text-xs text-slate-600 hover:text-blue-600 flex-1"
              >
                Chi tiết
              </Button>

              {isAdmin && isReported && !rep.managerConfirmed && (
                <Button
                  type="text"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleConfirmResult(r)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 flex-1"
                  title="Xác nhận kết quả"
                >
                  Xác nhận
                </Button>
              )}
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="w-full px-3 sm:px-6 lg:px-8 py-4 space-y-4">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white rounded-xl p-4 sm:p-6 shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileDoneOutlined className="text-2xl sm:text-3xl text-emerald-200" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight m-0 text-white">
                Báo Cáo Kết Quả Học Tập Bồi Dưỡng
              </h1>
            </div>
            <p className="text-emerald-100 text-xs sm:text-sm mt-1 mb-0">
              Thực hiện báo cáo kết quả bồi dưỡng (đạt/không đạt, tải minh chứng văn bằng chứng chỉ, kinh phí hỗ trợ hoặc lý do chưa tham gia) sau khi hoàn thành khóa đào tạo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="default"
              icon={<UnorderedListOutlined />}
              onClick={() => navigate("/training/list")}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs sm:text-sm h-9"
            >
              Danh sách đề nghị
            </Button>
            <Button
              type="default"
              icon={<BarChartOutlined />}
              onClick={() => navigate("/training/report")}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 text-xs sm:text-sm h-9"
            >
              Thống kê - Báo cáo
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6} md={6}>
          <Card className="shadow-xs border-slate-200" bodyStyle={{ padding: "12px 16px" }}>
            <Statistic
              title={<span className="text-xs text-slate-500 font-medium">Tổng khóa được duyệt</span>}
              value={stats.total}
              suffix="khóa"
              valueStyle={{ color: "#1e293b", fontWeight: "bold", fontSize: "1.25rem" }}
              prefix={<BookOutlined className="text-blue-500 text-sm" />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6} md={6}>
          <Card className="shadow-xs border-slate-200" bodyStyle={{ padding: "12px 16px" }}>
            <Statistic
              title={<span className="text-xs text-slate-500 font-medium">Chưa báo cáo</span>}
              value={stats.pendingCount}
              suffix="khóa"
              valueStyle={{ color: "#d97706", fontWeight: "bold", fontSize: "1.25rem" }}
              prefix={<ClockCircleOutlined className="text-amber-500 text-sm" />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6} md={6}>
          <Card className="shadow-xs border-slate-200" bodyStyle={{ padding: "12px 16px" }}>
            <Statistic
              title={<span className="text-xs text-slate-500 font-medium">Đã tham gia & có kết quả</span>}
              value={stats.reportedCount}
              suffix="khóa"
              valueStyle={{ color: "#059669", fontWeight: "bold", fontSize: "1.25rem" }}
              prefix={<CheckCircleOutlined className="text-emerald-500 text-sm" />}
            />
          </Card>
        </Col>

        <Col xs={12} sm={6} md={6}>
          <Card className="shadow-xs border-slate-200" bodyStyle={{ padding: "12px 16px" }}>
            <Statistic
              title={<span className="text-xs text-slate-500 font-medium">Tổng kinh phí hỗ trợ</span>}
              value={stats.totalFund}
              formatter={(val) => `${Number(val).toLocaleString("vi-VN")} đ`}
              valueStyle={{ color: "#2563eb", fontWeight: "bold", fontSize: "1.1rem" }}
              prefix={<DollarOutlined className="text-blue-500 text-sm" />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filter Toolbar */}
      <Card className="shadow-xs border-slate-200" bodyStyle={{ padding: "12px 16px" }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={4}>
            <Select
              value={filterYear}
              onChange={setFilterYear}
              className="w-full"
              placeholder="Chọn năm"
            >
              {YEAR_OPTIONS.map((y) => (
                <Option key={y} value={y}>
                  Năm {y}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={12} md={5}>
            <Select
              value={filterDept}
              onChange={setFilterDept}
              placeholder="Tất cả đơn vị"
              className="w-full"
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {departments.map((d) => (
                <Option key={d._id} value={d._id}>
                  {d.departmentName}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} sm={12} md={5}>
            <Select
              value={filterReportStatus}
              onChange={setFilterReportStatus}
              className="w-full"
            >
              <Option value="ALL">Tất cả trạng thái</Option>
              <Option value="NOT_REPORTED">⚠️ Chưa báo cáo</Option>
              <Option value="REPORTED">✓ Đã tham gia học</Option>
              <Option value="NOT_ATTENDED">✗ Không tham gia</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Tìm tên nhân sự, nội dung học, nơi đào tạo..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              className="w-full"
            />
          </Col>

          <Col xs={24} sm={24} md={2} className="flex justify-end">
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchData}
              loading={loading}
              className="w-full md:w-auto"
            >
              Tải lại
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Main Table */}
      <Card className="shadow-xs border-slate-200" bodyStyle={{ padding: "0" }}>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="_id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ["10", "15", "30", "50"],
            showTotal: (total) => `Tổng số ${total} khóa học`,
          }}
          locale={{ emptyText: "Không có khóa học nào đã được phê duyệt cần báo cáo." }}
        />
      </Card>

      {/* Modal Báo cáo kết quả */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800">
            <FileDoneOutlined className="text-blue-600 text-lg" />
            <span className="font-bold">Báo Cáo Kết Quả Bồi Dưỡng</span>
          </div>
        }
        open={isReportModalOpen}
        onCancel={() => setIsReportModalOpen(false)}
        onOk={handleSubmitReport}
        confirmLoading={submittingReport}
        okText="Gửi báo cáo"
        cancelText="Hủy"
        width={650}
        destroyOnClose
      >
        {reportingRecord && (
          <div className="space-y-4 pt-2">
            {/* Tóm tắt thông tin khóa học */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Nhân sự bồi dưỡng:</span>
                <span className="font-bold text-slate-800">
                  {reportingRecord.userName} ({reportingRecord.positionName || "Cán bộ"} - {reportingRecord.departmentName})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Khóa bồi dưỡng:</span>
                <span className="font-semibold text-blue-700">{reportingRecord.trainingContent}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hình thức:</span>
                <span className="text-slate-700">{reportingRecord.trainingForm} | {reportingRecord.trainingLocation || "Chưa rõ"}</span>
              </div>
            </div>

            <Form form={reportForm} layout="vertical">
              {/* Tham gia hay không */}
              <Form.Item label="Tình trạng tham gia đào tạo" required>
                <Radio.Group
                  value={reportAttended ? "true" : "false"}
                  onChange={(e) => setReportAttended(e.target.value === "true")}
                  className="w-full"
                >
                  <Row gutter={[12, 12]}>
                    <Col span={12}>
                      <Radio.Button value="true" className="w-full text-center h-10 flex items-center justify-center font-medium">
                        ✓ Đã tham gia học
                      </Radio.Button>
                    </Col>
                    <Col span={12}>
                      <Radio.Button value="false" className="w-full text-center h-10 flex items-center justify-center font-medium">
                        ✗ Không tham gia học
                      </Radio.Button>
                    </Col>
                  </Row>
                </Radio.Group>
              </Form.Item>

              {/* Nếu tham gia học */}
              {reportAttended ? (
                <>
                  <Form.Item
                    name="resultDetails"
                    label="Kết quả bồi dưỡng"
                    rules={[{ required: true, message: "Vui lòng nhập kết quả bồi dưỡng" }]}
                  >
                    <Input placeholder="Ví dụ: Đạt, Hoàn thành xuất sắc, Điểm 9.0..." />
                  </Form.Item>

                  <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">
                        Xác nhận hỗ trợ kinh phí đào tạo:
                      </span>
                      <Switch
                        checked={reportHasFunding}
                        onChange={setReportHasFunding}
                        checkedChildren="Có hỗ trợ"
                        unCheckedChildren="Không hỗ trợ"
                      />
                    </div>

                    {reportHasFunding && (
                      <Form.Item
                        name="actualFundAmount"
                        label="Số tiền kinh phí thực tế hỗ trợ (VNĐ)"
                        className="mb-0"
                      >
                        <InputNumber
                          className="w-full"
                          min={0}
                          step={500000}
                          formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                          parser={(val) => val.replace(/\$\s?|(,*)/g, "")}
                        />
                      </Form.Item>
                    )}
                  </div>

                  {/* Minh chứng chứng chỉ / văn bằng */}
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Minh chứng đính kèm (Ảnh / File PDF văn bằng, chứng chỉ, chứng nhận):
                    </label>

                    <Upload
                      customRequest={handleCustomUpload}
                      showUploadList={false}
                      multiple
                    >
                      <Button
                        icon={<UploadOutlined />}
                        loading={uploadingFiles}
                        className="text-xs"
                      >
                        Tải lên minh chứng
                      </Button>
                    </Upload>

                    {uploadedFiles.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {uploadedFiles.map((file) => (
                          <div
                            key={file.fileId}
                            className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs"
                          >
                            <a
                              href={file.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline truncate max-w-[380px]"
                            >
                              📄 {file.fileName}
                            </a>
                            <Button
                              type="text"
                              danger
                              size="small"
                              onClick={() => handleRemoveFile(file.fileId)}
                            >
                              Xóa
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Nếu không tham gia học */
                <Form.Item
                  name="notAttendedReason"
                  label="Lý do không tham gia học tập bồi dưỡng"
                  rules={[{ required: true, message: "Vui lòng nêu rõ lý do không tham gia" }]}
                >
                  <TextArea
                    rows={3}
                    placeholder="Nêu rõ lý do (Ví dụ: Trùng lịch công tác đột xuất của trường, lý do sức khỏe, khóa học bị hoãn...)"
                  />
                </Form.Item>
              )}
            </Form>
          </div>
        )}
      </Modal>

      {/* Modal Chi tiết */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-800">
            <FileTextOutlined className="text-blue-600 text-lg" />
            <span className="font-bold">Chi Tiết Hồ Sơ Bồi Dưỡng</span>
          </div>
        }
        open={isDetailModalOpen}
        onCancel={() => setIsDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsDetailModalOpen(false)}>
            Đóng
          </Button>,
        ]}
        width={700}
      >
        {detailRecord && (
          <div className="space-y-4 pt-2">
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Họ và tên">
                <span className="font-bold text-slate-800">{detailRecord.userName}</span>
                {!detailRecord.user && <Tag color="orange" className="ml-1 text-[10px]">Chưa có TK</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Chức vụ">
                {detailRecord.positionName || "Cán bộ"}
              </Descriptions.Item>
              <Descriptions.Item label="Đơn vị">
                {detailRecord.departmentName || "Đơn vị"}
              </Descriptions.Item>
              <Descriptions.Item label="Năm học">
                Năm {detailRecord.year}
              </Descriptions.Item>
              <Descriptions.Item label="Nội dung bồi dưỡng" span={2}>
                <span className="font-semibold text-blue-700">{detailRecord.trainingContent}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Hình thức">
                <Tag color="blue">{detailRecord.trainingForm}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Kinh phí dự kiến">
                {(Number(detailRecord.estimatedCost) || 0).toLocaleString("vi-VN")} đ
              </Descriptions.Item>
              <Descriptions.Item label="Nơi đào tạo" span={2}>
                {detailRecord.trainingLocation || "Chưa rõ"}
              </Descriptions.Item>
              <Descriptions.Item label="Thời gian dự kiến" span={2}>
                {detailRecord.trainingDuration || "Theo kế hoạch"}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái phê duyệt">
                <Tag color="success">Đã phê duyệt</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Người lập hồ sơ">
                {detailRecord.createdByUserName}
              </Descriptions.Item>
            </Descriptions>

            {/* Kết quả đào tạo */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
              <div className="font-semibold text-xs text-slate-700 uppercase tracking-wide">
                Kết quả bồi dưỡng sau khóa học
              </div>
              {detailRecord.reportResult && detailRecord.reportResult.status === "REPORTED" ? (
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-500">Tình trạng tham gia: </span>
                    {detailRecord.reportResult.attended !== false ? (
                      <Tag color="success">Đã tham gia học</Tag>
                    ) : (
                      <Tag color="error">Không tham gia học</Tag>
                    )}
                  </div>
                  {detailRecord.reportResult.attended !== false ? (
                    <>
                      <div>
                        <span className="text-slate-500">Kết quả: </span>
                        <span className="font-semibold text-emerald-700">
                          {detailRecord.reportResult.resultDetails || "Đạt"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Hỗ trợ kinh phí: </span>
                        {detailRecord.reportResult.hasFundingSupport ? (
                          <span className="font-semibold text-blue-700">
                            Có hỗ trợ: {(Number(detailRecord.reportResult.actualFundAmount) || 0).toLocaleString("vi-VN")} đ
                          </span>
                        ) : (
                          <span className="text-slate-500">Không nhận hỗ trợ</span>
                        )}
                      </div>
                      {Array.isArray(detailRecord.reportResult.proofFiles) &&
                        detailRecord.reportResult.proofFiles.length > 0 && (
                          <div className="pt-1">
                            <span className="text-slate-500 block mb-1">Minh chứng đính kèm:</span>
                            <div className="space-y-1">
                              {detailRecord.reportResult.proofFiles.map((file, idx) => (
                                <a
                                  key={file.fileId || idx}
                                  href={file.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-blue-600 hover:underline"
                                >
                                  📄 {file.fileName}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                    </>
                  ) : (
                    <div>
                      <span className="text-slate-500">Lý do không tham gia: </span>
                      <span className="text-red-600 font-medium">
                        {detailRecord.reportResult.notAttendedReason || "Không nêu rõ"}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-amber-600 italic">Chưa thực hiện báo cáo kết quả.</div>
              )}
            </div>

            {/* Lịch sử xử lý */}
            {Array.isArray(detailRecord.history) && detailRecord.history.length > 0 && (
              <div className="pt-2">
                <div className="font-semibold text-xs text-slate-700 mb-2 uppercase tracking-wide">
                  Lịch sử xử lý hồ sơ
                </div>
                <Timeline
                  items={detailRecord.history.map((h) => ({
                    color: h.action?.includes("phê duyệt") || h.action?.includes("hoàn thành") ? "green" : "blue",
                    children: (
                      <div className="text-xs">
                        <span className="font-semibold text-slate-800">{h.action}</span>
                        <span className="text-slate-400 ml-2">
                          ({dayjs(h.timestamp).format("DD/MM/YYYY HH:mm")})
                        </span>
                        <div className="text-slate-600">{h.details}</div>
                        <div className="text-slate-400 text-[11px]">Thực hiện bởi: {h.actorName}</div>
                      </div>
                    ),
                  }))}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TrainingResultReportPage;
