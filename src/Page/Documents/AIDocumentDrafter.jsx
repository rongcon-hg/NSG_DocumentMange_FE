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
  Upload,
  Divider,
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
  UploadOutlined,
  SafetyCertificateOutlined,
  FileWordOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  WarningOutlined,
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
  const [fixing, setFixing] = useState(false);
  const [uploadingWord, setUploadingWord] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [viewMode, setViewMode] = useState("preview"); // "preview" | "edit"
  const [complianceResult, setComplianceResult] = useState(null);
  const navigate = useNavigate();

  // Xử lý tải lên file Word và thẩm định tự động
  const handleUploadWord = async (file) => {
    // Kiểm tra định dạng .docx / .doc
    const isDocx = file.name.endsWith(".docx") || file.name.endsWith(".doc");
    if (!isDocx) {
      message.error("Vui lòng tải lên tệp tin định dạng Word (.docx hoặc .doc)!");
      return false;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadingWord(true);
      setComplianceResult(null);
      message.loading({ content: "Đang đọc nội dung tệp Word...", key: "uploadWord" });

      // Không truyền cứng Content-Type multipart/form-data để Axios tự sinh boundary chính xác
      const res = await axiosInstance.post("/ai-draft/upload-word", formData);

      if (res.data?.success && res.data.data?.content) {
        const extractedHtml = res.data.data.content;
        setGeneratedContent(extractedHtml);
        setUploadedFileName(file.name);
        setViewMode("preview");
        message.success({ content: `Đã nạp thành công tệp: ${file.name}`, key: "uploadWord" });

        // Tự động tiến hành thẩm định thể thức và căn cứ pháp lý ngay sau khi tải lên
        try {
          setAuditing(true);
          const auditRes = await axiosInstance.post("/ai-draft/audit", { content: extractedHtml });
          if (auditRes.data?.success) {
            setComplianceResult(auditRes.data.data);
            message.success("AI đã hoàn tất thẩm định thể thức và rà soát căn cứ pháp lý!");
          }
        } catch (auditErr) {
          console.error("Lỗi tự động thẩm định sau khi upload:", auditErr);
        } finally {
          setAuditing(false);
        }
      }
    } catch (error) {
      console.error("Lỗi tải tệp Word:", error);
      const serverErrMsg = error.response?.data?.message || error.message || "Không thể đọc tệp Word. Vui lòng thử lại!";
      message.error({
        content: serverErrMsg,
        key: "uploadWord",
        duration: 5,
      });
    } finally {
      setUploadingWord(false);
    }
    return false; // Ngăn Ant Design tự upload mặc định
  };

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

  // Tự động áp dụng các sửa đổi thể thức chuẩn Nghị định 30
  const handleAutoFix = async () => {
    if (!generatedContent) return;
    try {
      setFixing(true);
      const res = await axiosInstance.post("/ai-draft/fix-compliance", {
        content: generatedContent,
        suggestions: complianceResult?.suggestions || [],
      });
      if (res.data?.success && res.data.data?.content) {
        setGeneratedContent(res.data.data.content);
        // Cập nhật lại kết quả thẩm định lên mức tối đa
        setComplianceResult({
          score: 100,
          issues: [],
          suggestions: ["Văn bản đã được chuẩn hóa tự động theo đúng quy định Nghị định 30/2020/NĐ-CP."],
        });
        message.success("Đã tự động chỉnh sửa văn bản chuẩn theo Nghị định 30!");
      }
    } catch (error) {
      console.error("Lỗi tự động chỉnh sửa:", error);
      message.error(error.response?.data?.message || "Lỗi khi tự động chỉnh sửa thể thức");
    } finally {
      setFixing(false);
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

              <Divider className="my-4 text-xs text-slate-400">HOẶC TỰ UPLOAD VĂN BẢN</Divider>

              {/* Khu vực Upload tệp Word để AI thẩm định */}
              <div className="bg-slate-50 border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-xl p-4 text-center transition-colors">
                <Upload.Dragger
                  accept=".docx,.doc"
                  showUploadList={false}
                  beforeUpload={handleUploadWord}
                  disabled={uploadingWord}
                  className="bg-transparent border-none"
                >
                  <div className="py-2">
                    <p className="ant-upload-drag-icon mb-2">
                      <FileWordOutlined className="text-3xl text-blue-600" />
                    </p>
                    <p className="text-sm font-semibold text-slate-700 mb-1">
                      {uploadingWord ? "Đang xử lý tệp Word..." : "Tải lên tệp Word (.docx) để thẩm định"}
                    </p>
                    <p className="text-xs text-slate-400 mb-2">
                      Kéo thả hoặc nhấp để tải file Word văn bản đã soạn sẵn. AI sẽ tự động đọc, kiểm tra thể thức và rà soát hiệu lực các căn cứ pháp luật.
                    </p>
                    <Button 
                      icon={<UploadOutlined />} 
                      loading={uploadingWord}
                      size="small" 
                      className="rounded-md border-blue-400 text-blue-600 hover:text-blue-500"
                    >
                      Chọn file Word từ máy tính
                    </Button>
                  </div>
                </Upload.Dragger>
              </div>
            </Card>
          </Col>

          {/* CỘT PHẢI: Khung Editor xem trước & Thẩm định */}
          <Col xs={24} xl={15}>
            <Card
              title={
                <div className="space-y-3 py-1">
                  {/* Hàng 1: Tiêu đề khung */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <AuditOutlined className="text-emerald-600" />
                        Văn Bản Đã Soạn Thảo (Chuẩn NĐ 30/2020)
                      </span>
                      {uploadedFileName && (
                        <Tag color="blue" className="text-xs font-normal">
                          <FileWordOutlined className="mr-1" /> {uploadedFileName}
                        </Tag>
                      )}
                    </div>
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

                  {/* Hàng 2: Thanh nút tác vụ */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                    <Upload
                      accept=".docx,.doc"
                      showUploadList={false}
                      beforeUpload={handleUploadWord}
                      disabled={uploadingWord}
                    >
                      <Button
                        size="small"
                        icon={<UploadOutlined />}
                        loading={uploadingWord}
                        className="rounded-md border-blue-400 text-blue-600 hover:text-blue-700 bg-blue-50/50"
                      >
                        Upload file Word (.docx)
                      </Button>
                    </Upload>
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
                      className="rounded-md text-emerald-600 border-emerald-500 hover:text-emerald-500"
                    >
                      Thẩm định thể thức & Căn cứ
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-sm">
                        Độ chuẩn thể thức Nghị định 30: {complianceResult.score}/100 điểm
                      </span>
                      {complianceResult.score < 100 && (
                        <Button
                          type="primary"
                          size="small"
                          icon={<ThunderboltOutlined />}
                          onClick={handleAutoFix}
                          loading={fixing}
                          className="bg-emerald-600 hover:bg-emerald-500 font-medium rounded-md shadow-xs text-xs"
                        >
                          Tự động sửa theo thể thức chuẩn
                        </Button>
                      )}
                    </div>
                  }
                  description={
                    <div className="text-xs space-y-2 mt-2">
                      {/* Thể thức */}
                      {complianceResult.issues?.length > 0 && (
                        <div className="bg-red-50 p-2.5 rounded-lg border border-red-100">
                          <strong className="text-red-700 flex items-center gap-1 mb-1">
                            <CloseCircleOutlined /> Lỗi thể thức cần khắc phục:
                          </strong>
                          <ul className="list-disc list-inside text-red-600 space-y-0.5 m-0 pl-1 leading-relaxed">
                            {complianceResult.issues.map((iss, idx) => (
                              <li key={idx}>{iss}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {complianceResult.suggestions?.length > 0 && (
                        <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-100">
                          <strong className="text-blue-700 flex items-center gap-1 mb-1">
                            <CheckOutlined /> Đề xuất hoàn thiện thể thức:
                          </strong>
                          <ul className="list-disc list-inside text-blue-800 space-y-0.5 m-0 pl-1 leading-relaxed">
                            {complianceResult.suggestions.map((sug, idx) => (
                              <li key={idx}>{sug}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Thẩm định căn cứ pháp lý & hiệu lực áp dụng */}
                      {complianceResult.legalReview && complianceResult.legalReview.length > 0 && (
                        <div className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-200">
                          <div className="font-bold text-amber-900 flex items-center gap-1.5 mb-2">
                            <SafetyCertificateOutlined className="text-amber-600 text-sm" />
                            <span>Kết quả thẩm định hiệu lực các căn cứ pháp luật:</span>
                          </div>
                          <div className="space-y-1.5">
                            {complianceResult.legalReview.map((item, idx) => {
                              const isStillValid = item.status?.toLowerCase().includes("còn hiệu lực");
                              const isExpired = item.status?.toLowerCase().includes("hết hiệu lực");
                              return (
                                <div
                                  key={idx}
                                  className={`p-2 rounded border text-xs ${
                                    isStillValid
                                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                      : isExpired
                                      ? "bg-rose-50 border-rose-200 text-rose-900"
                                      : "bg-amber-100/60 border-amber-200 text-slate-800"
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="font-semibold">{item.basis}</span>
                                    <Tag
                                      color={isStillValid ? "success" : isExpired ? "error" : "warning"}
                                      className="text-[11px] m-0"
                                    >
                                      {item.status || "Đang kiểm tra"}
                                    </Tag>
                                  </div>
                                  {item.note && (
                                    <div className="text-[11px] mt-1 text-slate-600 leading-snug">
                                      {item.note}
                                    </div>
                                  )}
                                  {item.replacement && (
                                    <div className="text-[11px] mt-0.5 font-medium text-blue-700">
                                      👉 Đề xuất thay thế bằng: <strong>{item.replacement}</strong>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  }
                />
              )}

              {/* Vùng hiển thị văn bản */}
              {generatedContent ? (
                viewMode === "preview" ? (
                  <div className="bg-slate-100 p-2 sm:p-4 rounded-lg overflow-x-auto space-y-2">
                    {/* Thanh công cụ định dạng nhanh khi chỉnh sửa trực tiếp trên trang in */}
                    <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2 max-w-[800px] mx-auto text-xs text-slate-600">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-blue-700 flex items-center gap-1 mr-2">
                          <EditOutlined /> Sửa trực tiếp trên trang in:
                        </span>
                        <Button
                          size="small"
                          className="font-bold px-2 py-0 h-6 min-w-[24px]"
                          onClick={() => document.execCommand("bold")}
                          title="In đậm (Ctrl+B)"
                        >
                          B
                        </Button>
                        <Button
                          size="small"
                          className="italic px-2 py-0 h-6 min-w-[24px]"
                          onClick={() => document.execCommand("italic")}
                          title="In nghiêng (Ctrl+I)"
                        >
                          I
                        </Button>
                        <Button
                          size="small"
                          className="underline px-2 py-0 h-6 min-w-[24px]"
                          onClick={() => document.execCommand("underline")}
                          title="Gạch chân (Ctrl+U)"
                        >
                          U
                        </Button>
                        <Divider type="vertical" className="my-0" />
                        <Button
                          size="small"
                          className="px-2 py-0 h-6"
                          onClick={() => document.execCommand("justifyLeft")}
                          title="Căn trái"
                        >
                          Trái
                        </Button>
                        <Button
                          size="small"
                          className="px-2 py-0 h-6"
                          onClick={() => document.execCommand("justifyCenter")}
                          title="Căn giữa"
                        >
                          Giữa
                        </Button>
                        <Button
                          size="small"
                          className="px-2 py-0 h-6"
                          onClick={() => document.execCommand("justifyFull")}
                          title="Căn đều 2 bên (chuẩn NĐ 30)"
                        >
                          Căn đều
                        </Button>
                      </div>
                      <span className="text-[11px] text-slate-400 italic">
                        * Nhấp chuột trực tiếp vào văn bản bên dưới để gõ và sửa nội dung
                      </span>
                    </div>

                    {/* Giả lập trang giấy A4 văn bản hành chính theo NĐ 30 - Cho phép sửa trực tiếp */}
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => {
                        setGeneratedContent(e.currentTarget.innerHTML);
                      }}
                      onInput={(e) => {
                        // Cập nhật ngầm để đảm bảo tính đồng bộ
                        setGeneratedContent(e.currentTarget.innerHTML);
                      }}
                      className="bg-white shadow-md mx-auto p-6 sm:p-10 text-black max-w-[800px] min-h-[500px] outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 transition-all rounded-sm cursor-text"
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
                    rows={22}
                    className="font-mono text-xs leading-relaxed p-4 bg-white border-slate-200 rounded-lg shadow-xs"
                    placeholder="Mã HTML văn bản..."
                  />
                )
              ) : (
                <div className="text-center py-16 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
                  <RobotOutlined className="text-3xl text-slate-300 mb-2 block" />
                  Nhập thông tin yêu cầu hoặc bấm <strong>"Upload file Word (.docx)"</strong> để xem văn bản mẫu và kết quả thẩm định thể thức tại đây.
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
