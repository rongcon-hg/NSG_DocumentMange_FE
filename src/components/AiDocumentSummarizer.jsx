import React, { useState, useEffect } from 'react';
import { Button, Spin, Tag, Space, message, Tooltip, Alert } from 'antd';
import {
    ThunderboltOutlined, SyncOutlined, CopyOutlined,
    PlusCircleOutlined, CheckCircleOutlined, ClockCircleOutlined,
    BankOutlined, CheckOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { summarizeDocumentApi } from '../api/aiDocumentApi';

const AiDocumentSummarizer = ({ document, onSummaryUpdated }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState(document?.aiSummary || null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setSummary(document?.aiSummary || null);
    }, [document]);

    const handleSummarize = async (force = false) => {
        if (!document?._id) return;
        setLoading(true);
        try {
            const res = await summarizeDocumentApi(document._id, force);
            if (res.success && res.data) {
                setSummary(res.data);
                message.success(force ? 'Đã phân tích lại văn bản bằng AI!' : 'Tóm tắt văn bản bằng AI thành công!');
                if (onSummaryUpdated) onSummaryUpdated(res.data);
            }
        } catch (err) {
            message.error(err?.response?.data?.message || 'Không thể tóm tắt văn bản bằng AI');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (!summary) return;
        const text = `=== TÓM TẮT VĂN BẢN BẰNG AI ===\n` +
            `• Văn bản: ${document?.docCode || ''} - ${document?.shortDescription || document?.principalIdea || ''}\n` +
            `• Tóm tắt cốt lõi: ${summary.summaryText || ''}\n` +
            `• Điểm trọng tâm:\n${(summary.keyPoints || []).map(p => `  - ${p}`).join('\n')}\n` +
            `• Đơn vị thực hiện gợi ý: ${(summary.suggestedDepartments || []).join(', ')}\n` +
            `• Hạn xử lý: ${summary.deadlineNote || 'Không có'}\n` +
            `• Hành động đề xuất:\n${(summary.recommendedActions || []).map(a => `  - ${a}`).join('\n')}`;

        navigator.clipboard.writeText(text);
        setCopied(true);
        message.success('Đã sao chép nội dung tóm tắt AI vào bộ nhớ tạm!');
        setTimeout(() => setCopied(false), 2500);
    };

    const handleCreateTaskFromSummary = () => {
        if (!summary) return;
        // Chuẩn bị dữ liệu mẫu cho việc mới
        const prefillData = {
            title: `[Xử lý VB ${document?.docCode || ''}] ${summary.summaryText || document?.shortDescription || ''}`.slice(0, 150),
            description: `📌 TÓM TẮT AI:\n${summary.summaryText || ''}\n\n🎯 CÁC ĐIỂM CỐT LÕI CẦN LƯU Ý:\n${(summary.keyPoints || []).map(p => `- ${p}`).join('\n')}\n\n🚀 GỢI Ý HÀNH ĐỘNG:\n${(summary.recommendedActions || []).map(a => `- ${a}`).join('\n')}`,
            notes: `Căn cứ theo văn bản số ${document?.docCode || ''}, hạn xử lý: ${summary.deadlineNote || 'Theo chỉ đạo'}`,
            relatedDocumentId: document?._id,
            deadlineDay: document?.deadlineDay || undefined
        };

        sessionStorage.setItem('prefillTaskFromAi', JSON.stringify(prefillData));
        navigate('/schedule/create');
    };

    if (loading) {
        return (
            <div className="p-6 my-3 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-blue-50/60 text-center">
                <Spin tip="Trợ lý AI (Gemini) đang đọc và phân tích văn bản..." size="large">
                    <div className="py-6 text-sm text-indigo-700 font-medium">
                        Đang trích xuất nội dung cốt lõi, đơn vị chịu trách nhiệm và các mốc thời hạn quan trọng...
                    </div>
                </Spin>
            </div>
        );
    }

    if (!summary || !summary.summaryText) {
        return (
            <div className="my-3 p-4 rounded-xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-blue-50/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-lg shadow-sm">
                        <ThunderboltOutlined />
                    </div>
                    <div>
                        <div className="font-bold text-indigo-950 text-sm">
                            ✨ Trợ lý AI Tóm Tắt Văn Bản Hành Chính
                        </div>
                        <div className="text-xs text-indigo-700/80">
                            Tự động trích xuất ý chính cốt lõi, phòng ban chịu trách nhiệm và hạn chót hành động bằng Gemini AI.
                        </div>
                    </div>
                </div>
                <Button
                    type="primary"
                    onClick={() => handleSummarize(false)}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 border-none shadow-sm font-medium rounded-lg flex items-center gap-1.5"
                >
                    <ThunderboltOutlined /> Tóm tắt văn bản bằng AI
                </Button>
            </div>
        );
    }

    return (
        <div className="my-3 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-purple-50/30 to-blue-50/50 p-4 shadow-xs">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-indigo-100 gap-2 mb-3">
                <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-sm shadow-xs">
                        <ThunderboltOutlined />
                    </span>
                    <span className="font-bold text-indigo-950 text-sm sm:text-base">
                        Trợ Lý AI Tóm Tắt Văn Bản
                    </span>
                    <Tag color="purple" className="text-[10px] font-semibold">Gemini AI</Tag>
                    {summary.usedModel && (
                        <Tag color="blue" className="text-[10px]">{summary.usedModel}</Tag>
                    )}
                    {summary.analyzedFile ? (
                        <Tooltip title={`AI đã đọc và phân tích trực tiếp từ toàn văn tệp: ${summary.analyzedFile}`}>
                            <Tag color="cyan" className="text-[10px] max-w-[220px] truncate cursor-pointer">
                                📄 Đã đọc tệp: {summary.analyzedFile}
                            </Tag>
                        </Tooltip>
                    ) : (
                        <Tag color="default" className="text-[10px]">📋 Phân tích theo trích yếu</Tag>
                    )}
                </div>

                <div className="flex items-center gap-1.5">
                    <Tooltip title="Sao chép nội dung tóm tắt">
                        <Button
                            size="small"
                            icon={copied ? <CheckOutlined className="text-green-600" /> : <CopyOutlined />}
                            onClick={handleCopy}
                            className="text-xs"
                        >
                            {copied ? 'Đã chép' : 'Sao chép'}
                        </Button>
                    </Tooltip>
                    <Tooltip title="Yêu cầu AI phân tích lại">
                        <Button
                            size="small"
                            icon={<SyncOutlined />}
                            onClick={() => handleSummarize(true)}
                            className="text-xs"
                        >
                            Làm mới
                        </Button>
                    </Tooltip>
                </div>
            </div>

            {/* Nội dung tóm tắt cốt lõi */}
            <div className="mb-3 p-3 bg-white/90 rounded-lg border border-indigo-100 shadow-xs">
                <div className="text-xs font-bold text-indigo-900 uppercase tracking-wide mb-1 flex items-center gap-1">
                    💡 Bản chất & Mục đích chính:
                </div>
                <div className="text-sm text-slate-800 leading-relaxed font-medium">
                    {summary.summaryText}
                </div>
            </div>

            {/* 2 Cột chi tiết */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                {/* Điểm cốt lõi */}
                <div className="p-3 bg-white/90 rounded-lg border border-indigo-100 shadow-xs">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                        📌 Các điểm trọng tâm cần lưu ý:
                    </div>
                    {summary.keyPoints && summary.keyPoints.length > 0 ? (
                        <ul className="space-y-1.5 text-xs text-slate-700 pl-1">
                            {summary.keyPoints.map((point, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                    <CheckCircleOutlined className="text-emerald-500 mt-0.5 flex-shrink-0" />
                                    <span>{point}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-xs text-gray-400 italic">Theo nội dung đính kèm trong văn bản</div>
                    )}
                </div>

                {/* Đơn vị & Hạn xử lý & Hành động */}
                <div className="p-3 bg-white/90 rounded-lg border border-indigo-100 shadow-xs flex flex-col justify-between">
                    <div className="space-y-2.5">
                        {/* Đơn vị gợi ý */}
                        <div>
                            <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <BankOutlined className="text-indigo-600" /> Đơn vị phụ trách gợi ý:
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {summary.suggestedDepartments && summary.suggestedDepartments.length > 0 ? (
                                    summary.suggestedDepartments.map((dept, idx) => (
                                        <Tag key={idx} color="geekblue" className="text-xs font-medium">
                                            {dept}
                                        </Tag>
                                    ))
                                ) : (
                                    <span className="text-xs text-gray-400">Các đơn vị liên quan</span>
                                )}
                            </div>
                        </div>

                        {/* Hạn xử lý */}
                        <div>
                            <div className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <ClockCircleOutlined className="text-amber-600" /> Thời hạn / Lưu ý tiến độ:
                            </div>
                            <div className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 inline-block">
                                ⏰ {summary.deadlineNote || 'Không có mốc cố định'}
                            </div>
                        </div>

                        {/* Hành động đề xuất */}
                        {summary.recommendedActions && summary.recommendedActions.length > 0 && (
                            <div>
                                <div className="text-xs font-bold text-slate-700 mb-1">
                                    🚀 Gợi ý hành động thực hiện:
                                </div>
                                <ul className="text-xs text-slate-600 space-y-1 pl-1">
                                    {summary.recommendedActions.map((act, idx) => (
                                        <li key={idx}>• {act}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Chuyển thành công việc */}
            <div className="pt-2 border-t border-indigo-100 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-indigo-900/70 italic">
                    {summary.analyzedFile 
                        ? `* Nội dung được AI đọc và phân tích trực tiếp từ tệp "${summary.analyzedFile}".`
                        : '* Tóm tắt được lưu tự động trong hệ thống để mở nhanh cho các lần xem tiếp theo.'}
                </span>
                <Button
                    type="primary"
                    icon={<PlusCircleOutlined />}
                    onClick={handleCreateTaskFromSummary}
                    className="bg-emerald-600 hover:bg-emerald-700 text-xs font-medium rounded-md"
                >
                    Tạo công việc từ tóm tắt này
                </Button>
            </div>
        </div>
    );
};

export default AiDocumentSummarizer;
