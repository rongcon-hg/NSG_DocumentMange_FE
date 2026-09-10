/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from "react";
import {
  Form,
  Input,
  Select,
  Button,
  Card,
  Upload,
  Table,
  Tag,
  Space,
  message,
  Alert,
  Typography,
  Divider,
  Spin,
  Tooltip,
} from "antd";
import {
  UploadOutlined,
  TrophyOutlined,
  UserOutlined,
  BankOutlined,
  IdcardOutlined,
  CalendarOutlined,
  PaperClipOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  DeleteOutlined,
  SendOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";
import Cookies from "js-cookie";
import { getUserInfo } from "../../api/auth";
import {
  getEmulationTitles,
  getEmulationDocTypes,
  uploadEmulationFiles,
  createEmulationRegistration,
  updateEmulationRegistration,
  getMyEmulationRegistration,
} from "../../api/emulationApi";
import { useNavigate } from "react-router-dom";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// Helper tính toán năm học tự động
const getDefaultSchoolYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  // Từ tháng 8 trở đi là đầu năm học mới
  if (month >= 8) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
};

const SCHOOL_YEARS = [
  "2026-2027",
  "2025-2026",
  "2024-2025",
  "2023-2024",
];

const EmulationRegisterPage = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [titles, setTitles] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [existingReg, setExistingReg] = useState(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState(null);

  // Danh sách file đính kèm: { [docTypeId]: { fileId, fileName, fileUrl, mimeType, documentType, documentTypeName } }
  const [attachedFilesMap, setAttachedFilesMap] = useState({});

  const userId = Cookies.get("userId");
  const selectedSchoolYear = Form.useWatch("schoolYear", form) || getDefaultSchoolYear();
  const selectedTitles = Form.useWatch("titles", form) || [];

  // Tải dữ liệu ban đầu
  const initData = useCallback(async () => {
    try {
      setLoading(true);
      const [userRes, titlesRes, docsRes] = await Promise.all([
        userId ? getUserInfo(userId) : Promise.resolve({ data: null }),
        getEmulationTitles({ activeOnly: "true" }),
        getEmulationDocTypes({ activeOnly: "true" }),
      ]);

      if (userRes?.data) {
        const u = userRes.data;
        setCurrentUser(u);
        form.setFieldsValue({
          name: u.name || "",
          departmentName: u.department?.departmentName || "Chưa phân bổ",
          positionName: u.position?.positionName || "Chưa phân bổ",
          email: u.email || "",
          schoolYear: getDefaultSchoolYear(),
        });
      }

      if (titlesRes.success) setTitles(titlesRes.data || []);
      if (docsRes.success) setDocTypes(docsRes.data || []);
    } catch (err) {
      console.error(err);
      message.error("Không thể tải thông tin hệ thống");
    } finally {
      setLoading(false);
    }
  }, [userId, form]);

  useEffect(() => {
    initData();
  }, [initData]);

  // Kiểm tra đơn đăng ký của user trong năm học đã chọn
  const checkExistingRegistration = useCallback(async (year) => {
    if (!year || !userId) return;
    try {
      const res = await getMyEmulationRegistration(year);
      if (res.success && res.data) {
        setExistingReg(res.data);
        const reg = res.data;
        form.setFieldsValue({
          titles: reg.titles?.map((t) => (typeof t === "object" ? t._id : t)) || [],
          notes: reg.notes || "",
        });

        // Nạp file đính kèm
        const fileMap = {};
        (reg.attachedFiles || []).forEach((f) => {
          const docTypeId = f.documentType?._id || f.documentType;
          if (docTypeId) {
            fileMap[docTypeId] = f;
          }
        });
        setAttachedFilesMap(fileMap);
      } else {
        setExistingReg(null);
        form.setFieldsValue({ titles: [], notes: "" });
        setAttachedFilesMap({});
      }
    } catch (err) {
      console.error(err);
    }
  }, [userId, form]);

  useEffect(() => {
    if (selectedSchoolYear) {
      checkExistingRegistration(selectedSchoolYear);
    }
  }, [selectedSchoolYear, checkExistingRegistration]);

  // Upload file minh chứng cho từng loại hồ sơ
  const handleFileUpload = async (file, docType) => {
    const formData = new FormData();
    formData.append("files", file);

    try {
      setUploadingDocId(docType._id);
      const res = await uploadEmulationFiles(formData);
      if (res.success && res.data && res.data.length > 0) {
        const uploaded = res.data[0];
        setAttachedFilesMap((prev) => ({
          ...prev,
          [docType._id]: {
            documentType: docType._id,
            documentTypeName: docType.name,
            fileId: uploaded.fileId,
            fileName: uploaded.fileName,
            fileUrl: uploaded.fileUrl,
            mimeType: uploaded.mimeType,
            size: uploaded.size,
          },
        }));
        message.success(`Đã tải lên minh chứng cho: ${docType.name}`);
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi tải file lên Google Drive");
    } finally {
      setUploadingDocId(null);
    }
    return false; // Ngăn antd tự upload mặc định
  };

  const handleRemoveFile = (docTypeId) => {
    setAttachedFilesMap((prev) => {
      const copy = { ...prev };
      delete copy[docTypeId];
      return copy;
    });
  };

  // Submit đơn đăng ký
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Kiểm tra hồ sơ bắt buộc
      const missingRequired = [];
      docTypes.forEach((dt) => {
        if (dt.isRequired) {
          // Kiểm tra xem loại hồ sơ này có áp dụng cho các danh hiệu đã chọn không
          const isApplicable =
            !dt.applicableTitles ||
            dt.applicableTitles.length === 0 ||
            dt.applicableTitles.some((t) =>
              values.titles.includes(typeof t === "object" ? t._id : t)
            );

          if (isApplicable && !attachedFilesMap[dt._id]) {
            missingRequired.push(dt.name);
          }
        }
      });

      if (missingRequired.length > 0) {
        message.error(
          `Vui lòng đính kèm các hồ sơ bắt buộc sau: ${missingRequired.join(", ")}`
        );
        return;
      }

      setSubmitting(true);

      const attachedFiles = Object.values(attachedFilesMap);
      const payload = {
        schoolYear: values.schoolYear,
        titles: values.titles,
        attachedFiles: attachedFiles,
        notes: values.notes,
      };

      if (existingReg) {
        await updateEmulationRegistration(existingReg._id, payload);
        message.success("Cập nhật hồ sơ đăng ký thi đua thành công!");
      } else {
        await createEmulationRegistration(payload);
        message.success("Gửi hồ sơ đăng ký thi đua thành công!");
      }

      // Chuyển sang danh sách đăng ký
      navigate("/emulation/list");
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || "Lỗi khi lưu đơn đăng ký");
    } finally {
      setSubmitting(false);
    }
  };

  // Lọc danh mục hồ sơ liên quan đến các danh hiệu đang chọn
  const relevantDocTypes = docTypes.filter((dt) => {
    if (!dt.applicableTitles || dt.applicableTitles.length === 0) return true;
    return dt.applicableTitles.some((t) =>
      selectedTitles.includes(typeof t === "object" ? t._id : t)
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case "PENDING":
        return <Tag color="gold">Chờ Quản lý đơn vị xem xét</Tag>;
      case "SUBMITTED_TO_BGH":
        return <Tag color="blue">Quản lý đã duyệt & chuyển Ban Giám hiệu</Tag>;
      case "SCHOOL_APPROVED":
        return <Tag color="success">Ban Giám hiệu công nhận đạt</Tag>;
      case "REJECTED":
        return <Tag color="error">Từ chối / Cần chỉnh sửa</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" tip="Đang tải thông tin đăng ký..." />
      </div>
    );
  }

  const isApproved = existingReg?.status === "SCHOOL_APPROVED";

  return (
    <div className="w-full px-2 sm:px-4 py-3">
      <Card className="shadow-sm border-gray-200 w-full">
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100">
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
            <TrophyOutlined className="text-3xl text-yellow-500" />
          </div>
          <div>
            <Title level={3} className="!mb-0 text-blue-700">
              Đăng Ký Danh Hiệu Thi Đua
            </Title>
            <Text type="secondary">
              Đăng ký các danh hiệu thi đua và nộp hồ sơ minh chứng theo quy định
            </Text>
          </div>
        </div>

        {existingReg && (
          <Alert
            message={
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <span>
                  Bạn đã có đơn đăng ký cho năm học <strong>{existingReg.schoolYear}</strong>.
                  Trạng thái hiện tại: {getStatusBadge(existingReg.status)}
                </span>
                {isApproved && (
                  <Text type="success" className="font-semibold">
                    <CheckCircleOutlined /> Đã được Ban Giám hiệu phê duyệt chính thức
                  </Text>
                )}
              </div>
            }
            description={
              existingReg.reviewNote || existingReg.managerReview?.note || existingReg.bghReview?.note
                ? `Nhận xét từ cấp duyệt: ${existingReg.bghReview?.note || existingReg.managerReview?.note || existingReg.reviewNote}`
                : undefined
            }
            type={
              existingReg.status === "SCHOOL_APPROVED"
                ? "success"
                : existingReg.status === "REJECTED"
                ? "error"
                : "info"
            }
            showIcon
            className="mb-6"
          />
        )}

        <Form form={form} layout="vertical" disabled={isApproved}>
          {/* PHẦN 1: THÔNG TIN CÁN BỘ ĐĂNG KÝ (TỰ ĐỘNG TỪ HỆ THỐNG) */}
          <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-200">
            <Title level={5} className="!mb-3 text-slate-700 flex items-center gap-2">
              <UserOutlined /> Thông tin Cán bộ Đăng ký (Hệ thống tự động điền)
            </Title>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Form.Item name="name" label="Họ và tên">
                <Input prefix={<UserOutlined className="text-gray-400" />} disabled />
              </Form.Item>

              <Form.Item name="departmentName" label="Đơn vị / Phòng ban">
                <Input prefix={<BankOutlined className="text-gray-400" />} disabled />
              </Form.Item>

              <Form.Item name="positionName" label="Chức vụ">
                <Input prefix={<IdcardOutlined className="text-gray-400" />} disabled />
              </Form.Item>
            </div>
          </div>

          {/* PHẦN 2: NĂM HỌC & DANH HIỆU THI ĐUA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Form.Item
              name="schoolYear"
              label="Năm học đăng ký"
              rules={[{ required: true, message: "Vui lòng chọn năm học" }]}
            >
              <Select placeholder="Chọn năm học" suffixIcon={<CalendarOutlined />}>
                {SCHOOL_YEARS.map((y) => (
                  <Select.Option key={y} value={y}>
                    Năm học {y}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="titles"
              label="Danh hiệu thi đua đăng ký (Có thể chọn nhiều danh hiệu)"
              rules={[{ required: true, message: "Vui lòng chọn ít nhất một danh hiệu" }]}
              className="col-span-1 md:col-span-2"
            >
              <Select
                mode="multiple"
                placeholder="Chọn một hoặc nhiều danh hiệu thi đua phấn đấu"
                optionFilterProp="children"
                allowClear
              >
                {titles.map((t) => (
                  <Select.Option key={t._id} value={t._id}>
                    {t.name} ({t.code}) - {t.level === "CO_SO" ? "Cấp Trường" : "Cấp Tỉnh/TP/Bộ"}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          {/* PHẦN 3: HỒ SƠ MINH CHỨNG ĐÍNH KÈM */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <Title level={5} className="!mb-0 text-slate-700 flex items-center gap-2">
                <PaperClipOutlined /> Hồ sơ / Tài liệu minh chứng đính kèm (Lấy từ Danh mục Hồ sơ)
              </Title>
              <Text type="secondary" className="text-xs">
                * Tải file lên Google Drive lưu trữ an toàn
              </Text>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100 text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3">Loại hồ sơ / Minh chứng</th>
                    <th className="p-3">Quy cách / Hướng dẫn</th>
                    <th className="p-3 w-72">File minh chứng đính kèm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {relevantDocTypes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-gray-400">
                        Chưa có loại hồ sơ nào được cấu hình
                      </td>
                    </tr>
                  ) : (
                    relevantDocTypes.map((docType, idx) => {
                      const file = attachedFilesMap[docType._id];
                      const isUploading = uploadingDocId === docType._id;

                      return (
                        <tr key={docType._id} className="hover:bg-slate-50">
                          <td className="p-3 text-center">{idx + 1}</td>
                          <td className="p-3">
                            <span className="font-medium text-gray-800">{docType.name}</span>
                            {docType.isRequired && (
                              <Tag color="red" className="ml-2">
                                * Bắt buộc
                              </Tag>
                            )}
                          </td>
                          <td className="p-3 text-gray-500 text-xs">
                            {docType.description || "Tải lên file định dạng PDF hoặc DOCX"}
                          </td>
                          <td className="p-3">
                            {file ? (
                              <div className="flex items-center justify-between bg-blue-50 p-2 rounded border border-blue-200">
                                <div className="flex items-center gap-2 truncate mr-2">
                                  <FilePdfOutlined className="text-red-500" />
                                  <a
                                    href={file.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 truncate text-xs hover:underline"
                                    title={file.fileName}
                                  >
                                    {file.fileName}
                                  </a>
                                </div>
                                {!isApproved && (
                                  <Tooltip title="Xóa file">
                                    <Button
                                      type="text"
                                      danger
                                      size="small"
                                      icon={<DeleteOutlined />}
                                      onClick={() => handleRemoveFile(docType._id)}
                                    />
                                  </Tooltip>
                                )}
                              </div>
                            ) : (
                              <Upload
                                beforeUpload={(f) => handleFileUpload(f, docType)}
                                showUploadList={false}
                                disabled={isApproved}
                              >
                                <Button
                                  size="small"
                                  icon={<UploadOutlined />}
                                  loading={isUploading}
                                  disabled={isApproved}
                                >
                                  {isUploading ? "Đang tải lên Drive..." : "Chọn file đính kèm"}
                                </Button>
                              </Upload>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PHẦN 4: GHI CHÚ / CAM KẾT */}
          <Form.Item name="notes" label="Ghi chú / Cam kết nỗ lực hoàn thành xuất sắc nhiệm vụ">
            <TextArea
              rows={3}
              placeholder="Nhập nội dung cam kết, phương hướng phấn đấu hoặc tóm tắt sáng kiến tiêu biểu..."
            />
          </Form.Item>

          <Divider />

          {/* NÚT THỰC HIỆN */}
          <div className="flex justify-end gap-3">
            <Button onClick={() => navigate("/emulation/list")}>Xem danh sách đã đăng ký</Button>
            {!isApproved && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSubmit}
                loading={submitting}
                className="bg-blue-600"
                size="large"
              >
                {existingReg ? "Cập nhật đơn đăng ký" : "Gửi hồ sơ đăng ký thi đua"}
              </Button>
            )}
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default EmulationRegisterPage;
