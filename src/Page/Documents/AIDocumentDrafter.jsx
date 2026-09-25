/* eslint-disable no-unused-vars */
import React, { useState } from "react";
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
  Space,
  Radio,
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
  EyeOutlined,
  EditOutlined,
} from "@ant-design/icons";
import axiosInstance from "../../api/axiosInstance";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;
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
  const [viewMode, setViewMode] = useState("preview"); // "preview" | "edit"
  const [complianceResult, setComplianceResult] = useState(null);
  const navigate = useNavigate();

  const handleGenerate = async (values) => {
    try {
      setGenerating(true);
      setComplianceResult(null);
      const res = await axiosInstance.post("/ai-draft/generate", values);
      if (res.data?.success) {
        setGeneratedContent(res.data.data.content);
        setViewMode("preview");
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
      const serverMsg = error.response?.data?.message || error.message || "Lỗi khi kiểm tra thể thức văn bản";
      message.error(serverMsg);
    } finally {
      setAuditing(false);
    }
  };

  const handleCopy = () => {
    if (!generatedContent) return;
    // Lấy nội dung text sạch để copy hoặc copy HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = generatedContent;
    const textToCopy = tempDiv.innerText || tempDiv.textContent || generatedContent;
    navigator.clipboard.writeText(textToCopy);
    message.success("Đã sao chép nội dung văn bản vào clipboard!");
  };

  // Xuất trực tiếp file .docx chuẩn Microsoft Word từ nội dung HTML
  const handleExportDocx = () => {
    if (!generatedContent) return;
    try {
      const title = form.getFieldValue("title") || "Van_ban_soan_thao";
      const cleanTitle = title.replace(/[^a-zA-Z0-9_\u00C0-\u1EF9\s-]/g, "").trim().replace(/\s+/g, "_");

      const header = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' 
      xmlns:w='urn:schemas-microsoft-com:office:word' 
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>${title}</title>
<style>
  @page Section1 {
    size: 210mm 297mm;
    margin: 20mm 20mm 20mm 25mm;
    mso-header-margin: 35.4pt;
    mso-footer-margin: 35.4pt;
    mso-paper-source: 0;
  }
  div.Section1 { page: Section1; }
  body {
    font-family: 'Times New Roman', serif;
    font-size: 13pt;
    line-height: 1.4;
    color: #000000;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  td {
    vertical-align: top;
    padding: 3px;
  }
  p {
    margin: 3px 0;
  }
</style>
</head>
<body>
<div class="Section1">
${generatedContent}
</div>
</body>
</html>`;

      const blob = new Blob(["\ufeff", header], {
        type: "application/msword;charset=utf-8",
      });

      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = url;
      downloadLink.download = `${cleanTitle}.doc`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);

      message.success("Đã xuất và tải về tệp Word (.doc) thành công!");
    } catch (err) {
      console.error("Lỗi xuất file Word:", err);
      message.error("Lỗi khi tạo tệp văn bản Word");
    }
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
    <div className="w-full min-h-screen bg-slate-50 p-2 sm:p-4 md:p-6">
      <div className="w-full mx-auto space-y-4">
        {/* Tiêu đề & Giới thiệu */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-xs">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 m-0">
              <RobotOutlined className="text-amber-500 text-xl sm:text-2xl" />
              Trợ Lý AI Soạn Thảo & Thẩm Định Văn Bản
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-0">
              Tự động khởi tạo văn bản hành chính đúng chuẩn <strong>Nghị định 30/2020/NĐ-CP</strong> từ ý tưởng và kiểm tra tính hợp thức.
            </p>
          </div>
          <Tag color="gold" className="text-xs py-1 px-2.5 font-medium flex items-center gap-1 self-start sm:self-center">
            <ThunderboltOutlined /> Powered by Gemini AI
          </Tag>
        </div>

        <Row gutter={[16, 16]}>
          {/* CỘT TRÁI: Form nhập yêu cầu */}
          <Col xs={24} xl={9}>
            <Card
              title={
                <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                  <FileTextOutlined className="text-blue-600" />
                  Thông Tin Yêu Cầu Soạn Thảo
                </div>
              }
              className="rounded-xl shadow-xs border-slate-200"
            >
              <Form form={form} layout="vertical" onFinish={handleGenerate}>
                <Form.Item
                  name="docType"
                  label="Loại văn bản hành chính"
                  initialValue="TO_TRINH"
                  rules={[{ required: true }]}
                >
                  <Select size="middle">
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
                  <Col xs={24} sm={12}>
                    <Form.Item name="departmentName" label="Đơn vị đề xuất / tham mưu">
                      <Input placeholder="Khoa CNTT, Phòng QLĐT..." />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
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
                    rows={5}
                    placeholder="Ví dụ: Để nâng cao chất lượng thực hành cho sinh viên, đề xuất mua sắm bổ sung 30 máy tính mới cấu hình Core i5, RAM 16GB cho phòng máy 3. Dự kiến kinh phí 350 triệu đồng trích từ nguồn ngân sách đào tạo năm 2026..."
                  />
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<ThunderboltOutlined />}
                  loading={generating}
                  className="w-full h-10 bg-amber-500 hover:bg-amber-400 border-none font-semibold rounded-lg shadow-sm text-sm"
                >
                  {generating ? "AI đang soạn thảo văn bản..." : "Tạo Văn Bản Với AI"}
                </Button>
              </Form>
            </Card>
          </Col>

          {/* CỘT PHẢI: Khung Editor xem trước & Thẩm định */}
          <Col xs={24} xl={15}>
            <Card
              title={
                <div className="space-y-3 py-1">
                  {/* Hàng 1: Tiêu đề khung */}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <AuditOutlined className="text-emerald-600" />
                      Văn Bản Đã Soạn Thảo (Chuẩn NĐ 30/2020)
                    </span>
                    <Radio.Group
                      size="small"
                      value={viewMode}
                      onChange={(e) => setViewMode(e.target.value)}
                      disabled={!generatedContent}
                    >
                      <Radio.Button value="preview">
                        <EyeOutlined /> Xem trang in
                      </Radio.Button>
                      <Radio.Button value="edit">
                        <EditOutlined /> Sửa mã
                      </Radio.Button>
                    </Radio.Group>
                  </div>

                  {/* Hàng 2: Thanh nút tác vụ (được đưa xuống dòng riêng theo yêu cầu) */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                    <Button
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={handleCopy}
                      disabled={!generatedContent}
                      className="rounded-md"
                    >
                      Sao chép
                    </Button>
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={handleExportDocx}
                      disabled={!generatedContent}
                      className="rounded-md text-blue-600 border-blue-400 hover:text-blue-500"
                    >
                      Tải file Word (.doc)
                    </Button>
                    <Button
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={handleAudit}
                      loading={auditing}
                      disabled={!generatedContent}
                      className="rounded-md text-emerald-600 border-emerald-500"
                    >
                      Thẩm định thể thức
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={handleForwardToReply}
                      disabled={!generatedContent}
                      className="rounded-md bg-blue-600"
                    >
                      Đưa vào Trình ký
                    </Button>
                  </div>
                </div>
              }
              className="rounded-xl shadow-xs border-slate-200"
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

              {/* Vùng hiển thị văn bản */}
              {generatedContent ? (
                viewMode === "preview" ? (
                  <div className="bg-slate-100 p-2 sm:p-4 rounded-lg overflow-x-auto">
                    {/* Giả lập trang giấy A4 văn bản hành chính theo NĐ 30 */}
                    <div
                      className="bg-white shadow-md mx-auto p-6 sm:p-10 text-black max-w-[800px] min-h-[500px]"
                      style={{
                        fontFamily: "'Times New Roman', Times, serif",
                        fontSize: "13pt",
                        lineHeight: "1.45",
                      }}
                      dangerouslySetInnerHTML={{ __html: generatedContent }}
                    />
                  </div>
                ) : (
                  <TextArea
                    value={generatedContent}
                    onChange={(e) => setGeneratedContent(e.target.value)}
                    rows={20}
                    className="font-mono text-xs leading-relaxed p-4 bg-white border-slate-200 rounded-lg"
                  />
                )
              ) : (
                <div className="text-center py-16 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
                  <RobotOutlined className="text-3xl text-slate-300 mb-2 block" />
                  Nhập thông tin yêu cầu ở cột bên trái và bấm <strong>"Tạo Văn Bản Với AI"</strong> để xem văn bản mẫu chuẩn thể thức tại đây.
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default AIDocumentDrafter;
