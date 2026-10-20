import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  Button,
  Tag,
  Typography,
  Spin,
  Space,
  Modal,
  Input,
  message,
  Descriptions,
  Timeline,
  Alert,
  Divider,
  Radio,
  Popconfirm
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FilePdfOutlined,
  DownloadOutlined,
  HighlightOutlined,
  LeftOutlined,
  RightOutlined,
  PlusOutlined,
  DeleteOutlined,
  AuditOutlined,
  UsbOutlined,
  KeyOutlined,
  SafetyCertificateOutlined
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { Rnd } from "react-rnd";
import dayjs from "dayjs";
import axios from "axios";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getApprovalDocumentById, signAndApproveStep, rejectApprovalDocument, deleteApprovalDocument } from "../../api/approvalDocumentApi";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;


const { Title, Text, Paragraph } = Typography;
const API_URL = import.meta.env.VITE_API_URL;

const ApprovalDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [mySignature, setMySignature] = useState(null);

  // PDF Preview & Drag Signature states
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [signaturesPos, setSignaturesPos] = useState([]);
  const containerRef = useRef(null);

  // Modal từ chối
  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [signing, setSigning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [comment, setComment] = useState("");

  // USB Token states
  const [signatureMethod, setSignatureMethod] = useState("INTERNAL_IMAGE"); // INTERNAL_IMAGE | USB_TOKEN
  const [issuedNumberInput, setIssuedNumberInput] = useState("");
  const [issueNoteInput, setIssueNoteInput] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [isTokenModalVisible, setIsTokenModalVisible] = useState(false);
  const [tokenPin, setTokenPin] = useState("");
  const [tokenConnecting, setTokenConnecting] = useState(false);
  const [detectedCert, setDetectedCert] = useState({
    subject: "TRUONG CAO DANG NAM SAI GON",
    issuer: "VNPT-CA GLOBAL",
    serialNumber: "5401020088998877",
    validTo: "31/12/2028"
  });

  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUserId(decoded.userId || decoded.id);
        setCurrentUserRole(decoded.role);
      } catch (e) {
        console.error(e);
      }
    }
    fetchDetail();
    fetchMySignature();
  }, [id]);


  const fetchMySignature = async () => {
    try {
      const token = Cookies.get("accessToken");
      const res = await axios.get(`${API_URL}/api/signature/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.signature) setMySignature(res.data.signature);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await getApprovalDocumentById(id);
      if (res.success) {
        setDoc(res.data);
        // Tải file PDF để xem trước
        loadPdfFile(res.data);
      }
    } catch (err) {
      message.error("Lỗi khi tải chi tiết hồ sơ trình ký");
    } finally {
      setLoading(false);
    }
  };

  const loadPdfFile = async (documentData) => {
    if (!documentData?._id) return;

    setPdfLoading(true);
    try {
      const token = Cookies.get("accessToken");
      // Dùng endpoint chuyên dụng /preview-pdf (tự động chuyển đổi Word -> PDF nếu cần)
      const res = await axios.get(`${API_URL}/api/approval-documents/${documentData._id}/preview-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob"
      });
      const blobUrl = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      setPdfBlobUrl(blobUrl);
    } catch (err) {
      console.error("Lỗi khi tải PDF preview:", err);
      // Fallback 1: Dùng public-stream nếu có fileId
      const targetFile = documentData.currentFile?.fileId ? documentData.currentFile : documentData.originalFile;
      if (targetFile?.fileId) {
        setPdfBlobUrl(`${API_URL}/api/drive/public-stream/${targetFile.fileId}`);
      }
    } finally {
      setPdfLoading(false);
    }
  };


  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setSignaturesPos([
      { id: Date.now(), x: 50, y: 50, width: 140, height: 70, pageNum: 1 }
    ]);
  };

  const onPageLoadSuccess = (page) => {
    setPdfDimensions({
      width: page.originalWidth,
      height: page.originalHeight
    });
  };

  const addSignaturePos = () => {
    setSignaturesPos(prev => [
      ...prev,
      { id: Date.now(), x: 50, y: 50, width: 140, height: 70, pageNum: pageNumber }
    ]);
  };

  const removeSignaturePos = (sigId) => {
    setSignaturesPos(prev => prev.filter(s => s.id !== sigId));
  };

  const updateSignaturePos = (sigId, newProps) => {
    setSignaturesPos(prev => prev.map(s => s.id === sigId ? { ...s, ...newProps } : s));
  };

  // Kiểm tra xem user hiện tại có phải người duyệt của bước hiện tại không
  const currentStep = doc?.signSteps?.find(s => s.stepIndex === doc?.currentStepIndex);
  const isIssueStep = currentStep?.actionType === "ISSUE";
  const canIssue =
    doc?.status === "IN_PROGRESS" &&
    isIssueStep &&
    (String(currentStep?.assignee?._id || currentStep?.assignee) === String(currentUserId) ||
     currentUserRole === "admin" || currentUserRole === "manager");

  const canIApprove =
    doc?.status === "IN_PROGRESS" &&
    currentStep &&
    String(currentStep.assignee?._id || currentStep.assignee) === String(currentUserId);

  const handleSignAndApprove = async (useToken = false) => {
    if (currentStep?.actionType === "SIGN" && !useToken && !mySignature?.fileId) {
      message.error("Bạn chưa cấu hình chữ ký cá nhân! Vui lòng vào mục 'Cấu hình chữ ký' để tải ảnh lên.");
      return;
    }

    // Nếu chọn ký Token mà chưa mở modal nhập PIN
    if (signatureMethod === "USB_TOKEN" && !useToken) {
      setIsTokenModalVisible(true);
      return;
    }

    let mappedPositions = [];
    if (currentStep?.actionType === "SIGN" && signaturesPos.length > 0) {
      const containerNode = containerRef.current;
      if (!containerNode) return;
      const domWidth = containerNode.getBoundingClientRect().width;
      const scale = pdfDimensions.width / domWidth;

      mappedPositions = signaturesPos.map(sig => ({
        pageNum: sig.pageNum,
        x: sig.x * scale,
        y: pdfDimensions.height - ((sig.y + sig.height) * scale),
        width: sig.width * scale,
        height: sig.height * scale
      }));
    }

    setSigning(true);
    try {
      const payload = {
        comment,
        signaturePositions: mappedPositions,
        signatureMethod: useToken ? "USB_TOKEN" : signatureMethod,
        certificateInfo: useToken ? detectedCert : undefined
      };

      const res = await signAndApproveStep(id, payload);
      if (res.success) {
        message.success(res.message || "Đã ký duyệt thành công!");
        setIsTokenModalVisible(false);
        setTokenPin("");
        fetchDetail();
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi khi ký duyệt");
    } finally {
      setSigning(false);
    }
  };

  const handleConfirmTokenSign = async () => {
    if (!tokenPin || tokenPin.length < 4) {
      message.warning("Vui lòng nhập mã PIN bảo mật của USB Token (tối thiểu 4 ký tự)!");
      return;
    }

    setTokenConnecting(true);
    // Giả lập kết nối thiết bị Token PKCS#11 qua Localhost Agent
    setTimeout(async () => {
      setTokenConnecting(false);
      message.success("Xác thực USB Token thành công! Đang đóng dấu chứng thư số...");
      await handleSignAndApprove(true);
    }, 1200);
  };

  const handleIssueSubmit = async () => {
    if (!issuedNumberInput.trim()) {
      message.error("Vui lòng nhập số văn bản ban hành!");
      return;
    }
    setIssuing(true);
    try {
      const res = await issueApprovalDocument(id, {
        issuedNumber: issuedNumberInput.trim(),
        note: issueNoteInput.trim()
      });
      if (res.success) {
        message.success(res.message || "Đã vào số ban hành văn bản thành công!");
        fetchDetail();
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi khi vào số ban hành");
    } finally {
      setIssuing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      message.warning("Vui lòng nhập lý do từ chối");
      return;
    }
    setRejecting(true);
    try {
      const res = await rejectApprovalDocument(id, rejectionReason);
      if (res.success) {
        message.success("Đã từ chối hồ sơ trình ký");
        setIsRejectModalVisible(false);
        fetchDetail();
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi khi từ chối hồ sơ");
    } finally {
      setRejecting(false);
    }
  };

  if (loading || !doc) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spin size="large" tip="Đang tải thông tin hồ sơ trình ký..." />
      </div>
    );
  }

  const activeFile = doc.currentFile?.fileId ? doc.currentFile : doc.originalFile;

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/approval-documents")}
          >
            Quay lại
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-slate-800">{doc.documentCode}</span>
              <Tag color={doc.status === "APPROVED" ? "success" : doc.status === "REJECTED" ? "error" : "processing"}>
                {doc.status === "APPROVED" ? "ĐÃ HOÀN THÀNH" : doc.status === "REJECTED" ? "BỊ TỪ CHỐI" : "ĐANG TRÌNH KÝ"}
              </Tag>
            </div>
            <div className="text-xs text-slate-500">
              Người tạo: <span className="font-medium text-slate-700">{doc.creator?.name}</span> • Ngày gửi: {dayjs(doc.createdAt).format("DD/MM/YYYY HH:mm")}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeFile?.fileId && (
            <Button
              icon={<DownloadOutlined />}
              onClick={() => window.open(`https://drive.google.com/uc?export=download&id=${activeFile.fileId}`, "_blank")}
            >
              Tải file PDF
            </Button>
          )}

          {(currentUserRole === "admin" || currentUserRole === "manager" || (String(doc.creator?._id || doc.creator) === String(currentUserId) && doc.status !== "APPROVED")) && (
            <Popconfirm
              title="Xóa hồ sơ trình ký"
              description={`Bạn có chắc chắn muốn xóa hồ sơ "${doc.documentCode}" không? Dữ liệu và file liên kết sẽ bị xóa vĩnh viễn.`}
              onConfirm={async () => {
                setDeleting(true);
                try {
                  const res = await deleteApprovalDocument(id);
                  if (res.success) {
                    message.success("Đã xóa hồ sơ trình ký thành công");
                    navigate("/approval-documents");
                  }
                } catch (err) {
                  message.error(err.response?.data?.message || "Lỗi khi xóa hồ sơ trình ký");
                } finally {
                  setDeleting(false);
                }
              }}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button
                danger
                loading={deleting}
                icon={<DeleteOutlined />}
              >
                Xóa hồ sơ
              </Button>
            </Popconfirm>
          )}
        </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái (7/12 hoặc 8/12): Xem PDF và Không gian Ký số */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <Card
            className="shadow-sm rounded-xl overflow-hidden border border-slate-200"
            title={
              <div className="flex items-center justify-between">
                <span className="text-slate-800 font-bold flex items-center gap-2">
                  <FilePdfOutlined className="text-red-500" /> Bản xem trước & Ký số
                </span>
                {numPages && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="small"
                      icon={<LeftOutlined />}
                      disabled={pageNumber <= 1}
                      onClick={() => setPageNumber(p => p - 1)}
                    />
                    <span className="text-xs font-medium">Trang {pageNumber} / {numPages}</span>
                    <Button
                      size="small"
                      icon={<RightOutlined />}
                      disabled={pageNumber >= numPages}
                      onClick={() => setPageNumber(p => p + 1)}
                    />
                  </div>
                )}
              </div>
            }
            extra={
              canIApprove && currentStep?.actionType === "SIGN" && (
                <Button
                  size="small"
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={addSignaturePos}
                >
                  Thêm vị trí chữ ký
                </Button>
              )
            }
          >
            {canIApprove && currentStep?.actionType === "SIGN" && (
              <Alert
                type="info"
                showIcon
                className="mb-4 text-xs"
                message="Kéo-thả khung màu xanh vào vị trí bạn muốn đặt chữ ký điện tử trên trang này. Bạn có thể thay đổi kích thước khung bằng cách kéo các góc."
              />
            )}

            <div className="bg-slate-100 p-2 sm:p-4 rounded-lg flex justify-center items-center min-h-[500px] overflow-auto">
              {pdfLoading ? (
                <Spin tip="Đang nạp file PDF..." />
              ) : pdfBlobUrl ? (
                <div ref={containerRef} className="relative shadow-md border border-slate-300 inline-block bg-white">
                  <Document
                    file={pdfBlobUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<Spin className="p-8" />}
                  >
                    <Page
                      pageNumber={pageNumber}
                      onLoadSuccess={onPageLoadSuccess}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      width={Math.min(750, window.innerWidth - 60)}
                    />
                  </Document>

                  {/* Kéo thả chữ ký trực quan */}
                  {canIApprove && currentStep?.actionType === "SIGN" && signaturesPos
                    .filter(s => s.pageNum === pageNumber)
                    .map(sig => (
                      <Rnd
                        key={sig.id}
                        bounds="parent"
                        size={{ width: sig.width, height: sig.height }}
                        position={{ x: sig.x, y: sig.y }}
                        onDragStop={(e, d) => updateSignaturePos(sig.id, { x: d.x, y: d.y })}
                        onResizeStop={(e, direction, ref, delta, position) => {
                          updateSignaturePos(sig.id, {
                            width: ref.offsetWidth,
                            height: ref.offsetHeight,
                            ...position
                          });
                        }}
                        className="border-2 border-indigo-500 bg-indigo-50/70 rounded flex flex-col justify-between p-1 z-30 cursor-move"
                      >
                        <div className="flex justify-between items-center text-[10px] font-bold text-indigo-700 select-none">
                          <span>Chữ ký của bạn</span>
                          <DeleteOutlined
                            className="text-red-500 hover:text-red-700 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSignaturePos(sig.id);
                            }}
                          />
                        </div>
                        <div className="flex-1 flex justify-center items-center overflow-hidden">
                          {mySignature?.fileId ? (
                            <img
                              src={`${API_URL}/api/signature/image/${mySignature.fileId}`}
                              alt="Chữ ký"
                              className="max-h-full max-w-full object-contain mix-blend-multiply pointer-events-none"
                            />
                          ) : (
                            <span className="text-[11px] text-gray-400 italic">Vị trí ký</span>
                          )}
                        </div>
                      </Rnd>
                    ))}
                </div>
              ) : (
                <div className="text-gray-400">Không thể xem trước văn bản</div>
              )}
            </div>
          </Card>
        </div>

        {/* Cột phải (4/12): Chi tiết, Tuyến luân chuyển & Thao tác duyệt */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Thông tin văn bản */}
          <Card title="Thông tin hồ sơ" className="shadow-sm rounded-xl border border-slate-200">
            <Paragraph className="font-semibold text-slate-800 text-sm mb-3">
              {doc.title}
            </Paragraph>
            {doc.description && (
              <Paragraph className="text-xs text-slate-500 italic mb-3">
                "{doc.description}"
              </Paragraph>
            )}

            <Descriptions column={1} size="small" className="text-xs">
              <Descriptions.Item label="Đơn vị trình">
                {doc.department?.departmentName || "NSG"}
              </Descriptions.Item>
              <Descriptions.Item label="Độ khẩn">
                {doc.urgency === "VERY_URGENT" ? <Tag color="error">Hỏa tốc</Tag> : doc.urgency === "URGENT" ? <Tag color="warning">Khẩn</Tag> : <Tag>Thường</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="File đính kèm">
                <span className="truncate max-w-[200px] text-blue-600 block">{doc.originalFile?.fileName}</span>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Quy trình luân chuyển (Timeline) */}
          <Card title="Quy trình luân chuyển" className="shadow-sm rounded-xl border border-slate-200">
            <Timeline
              items={doc.signSteps?.map((step) => {
                const isCurrent = doc.status === "IN_PROGRESS" && step.stepIndex === doc.currentStepIndex;
                const isDone = step.action === "APPROVED";
                const isRejected = step.action === "REJECTED";

                return {
                  color: isDone ? "green" : isRejected ? "red" : isCurrent ? "blue" : "gray",
                  dot: isDone ? <CheckCircleOutlined /> : isRejected ? <CloseCircleOutlined /> : isCurrent ? <ClockCircleOutlined /> : undefined,
                  children: (
                    <div className="text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          Bước {step.stepIndex}: {step.stepName}
                        </span>
                        <Tag color={isDone ? "success" : isRejected ? "error" : isCurrent ? "processing" : "default"}>
                          {isDone ? "Đã duyệt" : isRejected ? "Từ chối" : isCurrent ? "Đang chờ" : "Chưa đến"}
                        </Tag>
                      </div>
                      <div className="text-slate-600 font-medium mt-0.5">
                        {step.assignee?.name} ({step.assignee?.position?.positionName || "Cán bộ"})
                      </div>
                      {step.comment && (
                        <div className="mt-1 p-1.5 bg-slate-100 rounded text-slate-600 italic">
                          Ý kiến: {step.comment}
                        </div>
                      )}
                      {step.actionAt && (
                        <div className="text-[10px] text-gray-400 mt-1">
                          {dayjs(step.actionAt).format("DD/MM/YYYY HH:mm")}
                        </div>
                      )}
                    </div>
                  )
                };
              })}
            />
          </Card>

          {/* Vùng Thao tác Duyệt (Nếu đến lượt người dùng hiện tại) */}
          {(canIApprove || canIssue) && (
            <Card
              className="shadow-sm rounded-xl border-2 border-indigo-200 bg-indigo-50/40"
              title={<span className="text-indigo-800 font-bold">{isIssueStep ? "Vào số & Ban hành hồ sơ" : "Xác nhận xử lý hồ sơ"}</span>}
            >
              {isIssueStep ? (
                <div className="space-y-3">
                  <div className="text-xs text-slate-600">
                    Hồ sơ đã được phê duyệt qua các cấp. Manager vui lòng cấp số văn bản ban hành chính thức:
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-1">Số ký hiệu văn bản ban hành:</div>
                    <Input
                      placeholder="VD: 15/TB-NSG, 102/QĐ-NSG..."
                      value={issuedNumberInput}
                      onChange={(e) => setIssuedNumberInput(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-1">Ghi chú phát hành:</div>
                    <Input.TextArea
                      rows={2}
                      placeholder="Ghi chú nơi nhận hoặc chỉ đạo phát hành..."
                      value={issueNoteInput}
                      onChange={(e) => setIssueNoteInput(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={handleIssueSubmit}
                      loading={issuing}
                      className="flex-1 font-semibold bg-blue-600"
                    >
                      Cấp số & Hoàn tất ban hành
                    </Button>
                    <Button
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => setIsRejectModalVisible(true)}
                    >
                      Từ chối
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentStep?.actionType === "SIGN" && (
                    <div>
                      <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <SafetyCertificateOutlined className="text-indigo-600" /> Phương thức ký duyệt:
                      </div>
                      <Radio.Group
                        value={signatureMethod}
                        onChange={(e) => setSignatureMethod(e.target.value)}
                        className="w-full grid grid-cols-2 gap-2"
                      >
                        <Radio.Button value="INTERNAL_IMAGE" className="text-center text-xs">
                          <HighlightOutlined className="mr-1" /> Chữ ký nội bộ
                        </Radio.Button>
                        <Radio.Button value="USB_TOKEN" className="text-center text-xs text-indigo-700 font-medium">
                          <UsbOutlined className="mr-1 text-indigo-600" /> USB Token PKI
                        </Radio.Button>
                      </Radio.Group>
                    </div>
                  )}

                  <Input.TextArea
                    rows={2}
                    placeholder="Nhập ý kiến phê duyệt hoặc góp ý thẩm định..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      type="primary"
                      icon={signatureMethod === "USB_TOKEN" && currentStep?.actionType === "SIGN" ? <UsbOutlined /> : <HighlightOutlined />}
                      onClick={() => handleSignAndApprove(false)}
                      loading={signing}
                      style={{ backgroundColor: "#10b981", borderColor: "#10b981" }}
                      className="flex-1 font-semibold hover:!bg-emerald-600"
                    >
                      {currentStep?.actionType === "SIGN" 
                        ? (signatureMethod === "USB_TOKEN" ? "Ký số bằng USB Token" : "Ký số & Phê duyệt") 
                        : "Đồng ý thẩm định / Ký nháy"}
                    </Button>
                    <Button
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => setIsRejectModalVisible(true)}
                    >
                      Từ chối
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Modal từ chối */}
      <Modal
        title="Từ chối phê duyệt hồ sơ"
        open={isRejectModalVisible}
        onCancel={() => setIsRejectModalVisible(false)}
        onOk={handleReject}
        confirmLoading={rejecting}
        okText="Xác nhận từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Đóng"
      >
        <p className="text-xs text-gray-500 mb-2">
          Vui lòng nhập rõ lý do từ chối để người soạn thảo nắm thông tin và hoàn thiện lại hồ sơ:
        </p>
        <Input.TextArea
          rows={3}
          placeholder="Lý do từ chối..."
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
        />
      </Modal>

      {/* Modal xác thực USB Token & Nhập mã PIN */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-indigo-700 text-base font-bold">
            <UsbOutlined className="text-lg" /> Xác thực Ký số USB Token (PKCS#11)
          </div>
        }
        open={isTokenModalVisible}
        onCancel={() => {
          setIsTokenModalVisible(false);
          setTokenPin("");
        }}
        onOk={handleConfirmTokenSign}
        confirmLoading={tokenConnecting || signing}
        okText="Ký số ngay"
        cancelText="Đóng"
        width={520}
      >
        <div className="space-y-4 py-2">
          <Alert
            type="info"
            showIcon
            message="Đã phát hiện thiết bị USB Token trên máy tính của bạn."
            description="Vui lòng kiểm tra thông tin chứng thư số và nhập mã PIN của Token để tiến hành ký số văn bản."
            className="text-xs"
          />

          <Card size="small" className="bg-slate-50 border border-slate-200">
            <Descriptions size="small" column={1} className="text-xs">
              <Descriptions.Item label="Chủ thể chứng thư (Subject)">
                <span className="font-semibold text-slate-800">{detectedCert.subject}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Nhà cung cấp (Issuer)">
                <Tag color="blue">{detectedCert.issuer}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Số Serial">
                <span className="font-mono text-xs text-slate-600">{detectedCert.serialNumber}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Hạn sử dụng">
                <span>{detectedCert.validTo}</span>
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <KeyOutlined className="text-indigo-600" /> Nhập mã PIN của USB Token:
            </div>
            <Input.Password
              placeholder="Nhập mã PIN của thiết bị..."
              value={tokenPin}
              onChange={(e) => setTokenPin(e.target.value)}
              onPressEnter={handleConfirmTokenSign}
              autoFocus
              size="large"
              className="rounded-lg"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              * Mã PIN thường có từ 6 đến 8 chữ số do nhà cung cấp Token cấp cho cá nhân/đơn vị.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ApprovalDetailPage;
