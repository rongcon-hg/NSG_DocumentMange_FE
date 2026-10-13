import React, { useState } from 'react';
import { Modal, Button, Upload, Tag, Space, Alert, Progress, Spin, message, Typography, Divider } from 'antd';
import { 
    FileSearchOutlined, 
    CheckCircleOutlined, 
    CloseCircleOutlined, 
    WarningOutlined, 
    ThunderboltOutlined,
    FileWordOutlined,
    SafetyCertificateOutlined,
    AuditOutlined
} from '@ant-design/icons';
import axiosInstance from '../../api/axiosInstance';

const { Title, Text, Paragraph } = Typography;

/**
 * ComplianceCheckerModal: Công cụ kiểm tra quy chuẩn thể thức văn bản theo Nghị định 30/2020/NĐ-CP
 * Dùng chung cho: Trình ký (replyDoc), Soạn thảo văn bản và Danh sách văn bản
 */
const ComplianceCheckerModal = ({ visible, onCancel, content, onApplyFixedContent }) => {
    const [loading, setLoading] = useState(false);
    const [fixing, setFixing] = useState(false);
    const [complianceResult, setComplianceResult] = useState(null);

    // Kiểm tra trực tiếp nội dung truyền vào
    const handleCheckDirectContent = async () => {
        if (!content || !content.trim()) {
            message.warning("Chưa có nội dung văn bản để thẩm định!");
            return;
        }
        try {
            setLoading(true);
            const res = await axiosInstance.post("/ai-draft/audit", { content });
            if (res.data?.success) {
                setComplianceResult(res.data.data);
                message.success("Đã hoàn tất thẩm định thể thức theo Nghị định 30/2020/NĐ-CP!");
            }
        } catch (error) {
            console.error("Lỗi thẩm định:", error);
            message.error(error.response?.data?.message || "Lỗi khi kiểm tra thể thức văn bản");
        } finally {
            setLoading(false);
        }
    };

    // Kiểm tra file Word tải lên (.docx)
    const handleUploadWordFile = async (file) => {
        const isDocx = file.name.endsWith(".docx") || file.name.endsWith(".doc");
        if (!isDocx) {
            message.error("Vui lòng tải lên tệp tin định dạng Word (.docx hoặc .doc)!");
            return false;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            setLoading(true);
            setComplianceResult(null);
            message.loading({ content: "Đang phân tích tệp Word...", key: "auditWord" });

            const res = await axiosInstance.post("/ai-draft/upload-word", formData);
            if (res.data?.success && res.data.data?.content) {
                const extractedHtml = res.data.data.content;
                // Thẩm định ngay lập tức
                const auditRes = await axiosInstance.post("/ai-draft/audit", { content: extractedHtml });
                if (auditRes.data?.success) {
                    setComplianceResult({
                        ...auditRes.data.data,
                        rawContent: extractedHtml,
                        fileName: file.name
                    });
                    message.success({ content: `Đã thẩm định thành công tệp: ${file.name}`, key: "auditWord" });
                }
            }
        } catch (error) {
            console.error("Lỗi tải tệp Word:", error);
            message.error({ content: error.response?.data?.message || "Lỗi khi đọc tệp Word", key: "auditWord" });
        } finally {
            setLoading(false);
        }
        return false;
    };

    // Tự động sửa thể thức chuẩn
    const handleAutoFix = async () => {
        const targetContent = complianceResult?.rawContent || content;
        if (!targetContent) return;
        try {
            setFixing(true);
            const res = await axiosInstance.post("/ai-draft/fix-compliance", {
                content: targetContent,
                suggestions: complianceResult?.suggestions || [],
            });
            if (res.data?.success && res.data.data?.content) {
                setComplianceResult(prev => ({
                    ...prev,
                    score: 100,
                    issues: [],
                    suggestions: ["Văn bản đã được chuẩn hóa tự động hoàn toàn theo Nghị định 30/2020/NĐ-CP."]
                }));
                if (onApplyFixedContent) {
                    onApplyFixedContent(res.data.data.content);
                }
                message.success("Đã tự động chỉnh sửa và chuẩn hóa văn bản thành công!");
            }
        } catch (error) {
            console.error("Lỗi tự động chỉnh sửa:", error);
            message.error(error.response?.data?.message || "Lỗi khi tự động chỉnh sửa");
        } finally {
            setFixing(false);
        }
    };

    // Điểm số và màu sắc
    const score = complianceResult?.score !== undefined ? complianceResult.score : null;
    const scoreColor = score >= 85 ? "#52c41a" : score >= 65 ? "#faad14" : "#ff4d4f";

    return (
        <Modal
            title={
                <div className="flex items-center gap-2 text-slate-800 text-base font-bold">
                    <SafetyCertificateOutlined className="text-blue-600 text-lg" />
                    Kiểm Tra Thể Thức Văn Bản (Nghị định 30/2020/NĐ-CP)
                </div>
            }
            open={visible}
            onCancel={onCancel}
            width={720}
            footer={[
                <Button key="close" onClick={onCancel}>
                    Đóng
                </Button>,
                complianceResult && (
                    <Button 
                        key="fix" 
                        type="primary" 
                        icon={<ThunderboltOutlined />} 
                        loading={fixing}
                        onClick={handleAutoFix}
                        className="bg-emerald-600 hover:bg-emerald-500 font-semibold"
                    >
                        Tự động sửa chuẩn thể thức
                    </Button>
                )
            ]}
        >
            <div className="space-y-4 py-2">
                <Alert
                    type="info"
                    showIcon
                    message="Quy chuẩn thể thức văn bản hành chính theo Nghị định số 30/2020/NĐ-CP"
                    description="Hệ thống tự động rà soát Quốc hiệu, Tiêu ngữ, Cơ quan ban hành, Số ký hiệu, Trích yếu, Thẩm quyền ký, Cỡ chữ và Căn lề chuẩn."
                    className="text-xs"
                />

                {/* Tùy chọn nguồn kiểm tra */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2">
                        <Upload
                            beforeUpload={handleUploadWordFile}
                            showUploadList={false}
                            accept=".docx,.doc"
                        >
                            <Button icon={<FileWordOutlined className="text-blue-600" />} loading={loading}>
                                Tải file Word (.docx) để kiểm tra
                            </Button>
                        </Upload>
                        {content && (
                            <Button 
                                type="primary" 
                                icon={<FileSearchOutlined />} 
                                onClick={handleCheckDirectContent}
                                loading={loading}
                                className="bg-blue-600"
                            >
                                Kiểm tra nội dung hiện tại
                            </Button>
                        )}
                    </div>

                    {complianceResult?.fileName && (
                        <Tag color="blue" className="text-xs font-semibold py-0.5">
                            📄 {complianceResult.fileName}
                        </Tag>
                    )}
                </div>

                {/* Kết quả thẩm định */}
                {loading ? (
                    <div className="py-12 text-center">
                        <Spin tip="AI đang phân tích và rà soát từng thành phần thể thức theo Nghị định 30..." />
                    </div>
                ) : complianceResult ? (
                    <div className="space-y-4">
                        {/* Thanh điểm số */}
                        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between">
                            <div>
                                <div className="text-xs text-slate-500 font-medium">Mức độ chuẩn hóa thể thức</div>
                                <div className="text-xl font-bold mt-0.5" style={{ color: scoreColor }}>
                                    {score >= 85 ? "Rất chuẩn xác (Đạt)" : score >= 65 ? "Cần điều chỉnh (Khá)" : "Chưa đạt chuẩn"}
                                </div>
                            </div>
                            <div className="w-48 text-right">
                                <Progress 
                                    percent={score} 
                                    strokeColor={scoreColor} 
                                    format={percent => `${percent} / 100đ`} 
                                />
                            </div>
                        </div>

                        {/* Danh sách lỗi / sai lệch phát hiện */}
                        {complianceResult.issues && complianceResult.issues.length > 0 ? (
                            <div className="space-y-2">
                                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <WarningOutlined className="text-amber-500" />
                                    Các điểm chưa đúng quy chuẩn ({complianceResult.issues.length}):
                                </div>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                    {complianceResult.issues.map((iss, i) => (
                                        <div key={i} className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
                                            <CloseCircleOutlined className="text-red-500 mt-0.5 flex-shrink-0" />
                                            <span>{iss}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2 font-medium">
                                <CheckCircleOutlined className="text-emerald-600 text-base" />
                                Tuyệt vời! Không phát hiện lỗi sai phạm quy chuẩn thể thức nào.
                            </div>
                        )}

                        {/* Gợi ý hoàn thiện */}
                        {complianceResult.suggestions && complianceResult.suggestions.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <AuditOutlined className="text-blue-500" />
                                    Gợi ý khắc phục & hoàn thiện:
                                </div>
                                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                    {complianceResult.suggestions.map((sug, s) => (
                                        <div key={s} className="p-2 bg-blue-50/70 border border-blue-100 rounded-lg text-xs text-slate-700">
                                            💡 {sug}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-8 text-center text-slate-400 text-xs">
                        Nhấn nút <b>"Kiểm tra nội dung hiện tại"</b> hoặc tải tệp <b>Word (.docx)</b> để hệ thống tự động thẩm định.
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default ComplianceCheckerModal;
