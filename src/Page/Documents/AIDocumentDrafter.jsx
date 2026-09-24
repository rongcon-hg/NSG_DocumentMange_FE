/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Input,
  Select,
  Button,
  message,
  Typography,
  Tag,
  Alert,
  Divider,
  Space,
  Tooltip,
} from "antd";
import {
  RobotOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  SendOutlined,
  DownloadOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  AuditOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance";
import { useNavigate } from "react-router-dom";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const DOC_TYPES = [
  { value: "TO_TRINH", label: "Tờ trình" },
  { value: "THONG_BAO", label: "Thông báo" },
  { value: "QUYET_DINH", label: "Quyết định" },
  { value: "KE_HOACH", label: "Kế hoạch" },
  { value: "CONG_VAN", label: "Công văn" },
  { value: "BAO_CAO", label: "Báo cáo" },
  { value: "BIEN_BAN", label: "Biên bản" },
];

const AIDocumentDrafter = () => {
  const [form] = Form.useForm();
  const [generating, setGenerating] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [complianceResult, setComplianceResult] = useState(null);
  const navigate = useNavigate();

  const handleGenerate = async (values) => {
    try {
      setGenerating(true);
      setComplianceResult(null);
      const res = await axiosInstance.post("/ai-draft/generate", values);
      if (res.data?.success) {
        setGeneratedContent(res.data.data.content);
        message.success("AI đã soạn thảo xong văn bản!");
      }
    } catch (error) {
      console.error("Lỗi AI soạn thảo:", error);
      message.error(error.response?.data?.message || "Lỗi khi soạn thảo văn bản");
    } finally {
      setGenerating(false);
    }
  };

  const handleAudit = async () => {
    if (!generatedContent) {
      message.warning("Chưa có nội dung văn bản để thẩm định!");
      return;
    }
    try {
      setAuditing(true);
      const res = await axiosInstance.post("/ai-draft/audit", { content: generatedContent });
      if (res.data?.success) {
        setComplianceResult(res.data.data);
        message.success("Đã hoàn tất thẩm định thể thức!");
      }
    } catch (error) {
      console.error("Lỗi thẩm định:", error);
      message.error("Lỗi khi kiểm tra thể thức văn bản");
    } finally {
      setAuditing(false);
    }
  };

  const handleCopy = () => {
    if (!generatedContent) return;
    navigator.clipboard.writeText(generatedContent);
    message.success("Đã sao chép nội dung văn bản vào clipboard!");
  };

  const handleForwardToReply = () => {
    if (!generatedContent) return;
    navigate("/replyDoc", {
      state: {
        prefillTitle: form.getFieldValue("title"),
        prefillContent: generatedContent,
      },
    });
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Tiêu đề & Giới thiệu */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2 m-0">
              <RobotOutlined className="text-amber-500 text-2xl" />
              Trợ Lý AI Soạn Thảo & Thẩm Định Văn Bản
            </h1>
            <p className="text-sm text-slate-500 mt-1 mb-0">
              Tự động khởi tạo văn bản hành chính đúng chuẩn <strong>Nghị định 30/2020/NĐ-CP</strong> từ ý tưởng và kiểm tra tính hợp thức.
            </p>
          </div>
          <Tag color="gold" className="text-xs py-1 px-2.5 font-medium flex items-center gap-1">
            <ThunderboltOutlined /> Powered by Gemini AI
          </Tag>
        </div>

        <Row gutter={[16, 16]}>
          {/* CỘT TRÁI: Form nhập yêu cầu */}
          <Col xs={24} lg={10}>
            <Card
              title={
                <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                  <FileTextOutlined className="text-blue-600" />
                  Thông Tin Yêu Cầu Soạn Thảo
                </div>
              }
              className="rounded-xl shadow-xs border-slate-200 h-full"
            >
              <Form form={form} layout="vertical" onFinish={handleGenerate}>
                <Form.Item
                  name="docType"
                  label="Loại văn bản hành chính"
                  initialValue="TO_TRINH"
                  rules={[{ required: true }]}
                >
                  <Select size="large">
                    {DOC_TYPES.map((t) => (
                      <Option key={t.value} value={t.value}>
                        {t.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="title"
                  label="Trích yếu / Tiêu đề văn bản"
                  rules={[{ required: true, message: "Vui lòng nhập trích yếu tiêu đề" }]}
                >
                  <Input placeholder="V/v xin phê duyệt kế hoạch tổ chức Hội thao..." />
                </Form.Item>

                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="departmentName" label="Đơn vị đề xuất / tham mưu">
                      <Input placeholder="Khoa CNTT, Phòng QLĐT..." />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="signerPosition" label="Chức danh ký duyệt" initialValue="HIỆU TRƯỞNG">
                      <Input placeholder="HIỆU TRƯỞNG / TRƯỞNG PHÒNG..." />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="requestSummary"
                  label="Tóm tắt nội dung chính & Căn cứ đề xuất"
                  rules={[{ required: true, message: "Vui lòng nhập tóm tắt nội dung cần soạn" }]}
                  tooltip="Nhập ý tưởng ngắn gọn, số liệu, mục đích, kinh phí hoặc thời gian thực hiện để AI tự sinh văn bản chi tiết."
                >
                  <TextArea
                    rows={6}
                    placeholder="Ví dụ: Để nâng cao chất lượng thực hành cho sinh viên, đề xuất mua sắm bổ sung 30 máy tính mới cấu hình Core i5, RAM 16GB cho phòng máy 3. Dự kiến kinh phí 350 triệu đồng trích từ nguồn ngân sách đào tạo năm 2026..."
                  />
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<ThunderboltOutlined />}
                  loading={generating}
                  className="w-full h-11 bg-amber-500 hover:bg-amber-400 border-none font-semibold rounded-lg shadow-sm text-sm"
                >
                  {generating ? "AI đang soạn thảo văn bản..." : "Tạo Văn Bản Với AI"}
                </Button>
              </Form>
            </Card>
          </Col>

          {/* CỘT PHẢI: Khung Editor xem trước & Thẩm định */}
          <Col xs={24} lg={14}>
            <Card
              title={
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <AuditOutlined className="text-emerald-600" />
                    Văn Bản Đã Soạn Thảo (Chuẩn NĐ 30/2020)
                  </span>
                  <Space size="small">
                    <Button size="small" icon={<CopyOutlined />} onClick={handleCopy} disabled={!generatedContent}>
                      Sao chép
                    </Button>
                    <Button
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={handleAudit}
                      loading={auditing}
                      disabled={!generatedContent}
                      className="text-emerald-600 border-emerald-500"
                    >
                      Thẩm định thể thức
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={handleForwardToReply}
                      disabled={!generatedContent}
                      className="bg-blue-600"
                    >
                      Đưa vào Trình ký
                    </Button>
                  </Space>
                </div>
              }
              className="rounded-xl shadow-xs border-slate-200 h-full flex flex-col"
            >
              {complianceResult && (
                <Alert
                  type={complianceResult.score >= 90 ? "success" : "warning"}
                  showIcon
                  className="mb-3"
                  message={
                    <div className="flex items-center justify-between">
                      <span className="font-bold">
                        Độ chuẩn thể thức Nghị định 30: {complianceResult.score}/100 điểm
                      </span>
                    </div>
                  }
                  description={
                    <div className="text-xs space-y-1 mt-1">
                      {complianceResult.issues?.length > 0 && (
                        <div>
                          <strong className="text-red-600">Lưu ý:</strong> {complianceResult.issues.join("; ")}
                        </div>
                      )}
                      {complianceResult.suggestions?.length > 0 && (
                        <div>
                          <strong className="text-blue-600">Đề xuất:</strong> {complianceResult.suggestions.join("; ")}
                        </div>
                      )}
                    </div>
                  }
                />
              )}

              <TextArea
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                placeholder="Nội dung văn bản được AI soạn thảo sẽ xuất hiện tại đây. Bạn có thể chỉnh sửa trực tiếp sau khi AI tạo..."
                rows={18}
                className="font-mono text-sm leading-relaxed p-4 bg-white border-slate-200 rounded-lg"
              />
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default AIDocumentDrafter;
