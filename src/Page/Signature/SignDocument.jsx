import React, { useState, useEffect, useRef } from "react";
import { Card, Upload, Button, message, Spin, Typography } from "antd";
import { UploadOutlined, HighlightOutlined, LeftOutlined, RightOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { Document, Page, pdfjs } from "react-pdf";
import { Rnd } from "react-rnd";
import axios from "axios";
import Cookies from "js-cookie";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL;

const SignDocument = () => {
  const [file, setFile] = useState(null);
  const [pdfFile, setPdfFile] = useState(null); // The actual PDF blob for preview
  const [signature, setSignature] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // PDF state
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 }); // original PDF size
  
  // Rnd state - Array of signatures
  const [signaturesPos, setSignaturesPos] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    fetchMySignature();
  }, []);

  const fetchMySignature = async () => {
    try {
      const token = Cookies.get("accessToken");
      const res = await axios.get(`${API_URL}/api/signature/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.signature) setSignature(res.data.signature);
    } catch (error) {
      console.error(error);
    }
  };

  const handleUploadFile = async (info) => {
    const selectedFile = info.fileList[0]?.originFileObj || info.fileList[0] || info.file;
    if (!selectedFile) return;

    setFile(selectedFile);
    setSignaturesPos([]); // Reset signatures on new file
    
    // If it is Word, we need to convert it via API to preview
    if (selectedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || selectedFile.type === "application/msword") {
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const token = Cookies.get("accessToken");
        const res = await axios.post(`${API_URL}/api/signature/convert-preview`, formData, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob"
        });
        setPdfFile(URL.createObjectURL(res.data));
      } catch (e) {
        message.error("Lỗi khi chuyển Word sang PDF để xem trước.");
      } finally {
        setLoading(false);
      }
    } else {
      // Direct PDF
      setPdfFile(URL.createObjectURL(selectedFile));
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
    // Tự động thêm 1 khung chữ ký ở trang 1
    setSignaturesPos([{ id: Date.now(), x: 50, y: 50, width: 150, height: 75, pageNum: 1 }]);
  };

  const onPageLoadSuccess = (page) => {
    setPdfDimensions({
      width: page.originalWidth,
      height: page.originalHeight
    });
  };

  const addSignature = () => {
    setSignaturesPos([...signaturesPos, { id: Date.now(), x: 50, y: 50, width: 150, height: 75, pageNum: pageNumber }]);
  };

  const removeSignature = (id) => {
    setSignaturesPos(signaturesPos.filter(s => s.id !== id));
  };

  const updateSignature = (id, newProps) => {
    setSignaturesPos(signaturesPos.map(s => s.id === id ? { ...s, ...newProps } : s));
  };

  const submitSignature = async () => {
    if (!signature) {
      message.error("Bạn chưa thiết lập chữ ký cá nhân!");
      return;
    }
    if (!file) {
      message.error("Vui lòng chọn file văn bản!");
      return;
    }
    if (signaturesPos.length === 0) {
      message.error("Vui lòng đặt ít nhất 1 chữ ký!");
      return;
    }

    // Convert DOM position to PDF Points
    const containerNode = containerRef.current;
    if (!containerNode) return;
    const domWidth = containerNode.getBoundingClientRect().width;
    const scale = pdfDimensions.width / domWidth;

    const mappedSignatures = signaturesPos.map(sig => ({
      pageNum: sig.pageNum,
      x: sig.x * scale,
      y: pdfDimensions.height - ((sig.y + sig.height) * scale),
      width: sig.width * scale,
      height: sig.height * scale
    }));

    const formData = new FormData();
    formData.append("pdfFile", file);
    formData.append("signatures", JSON.stringify(mappedSignatures));

    setLoading(true);
    try {
      const token = Cookies.get("accessToken");
      await axios.post(`${API_URL}/api/signature/sign-pdf`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      message.success("Ký văn bản thành công!");
      window.location.href = "/signature/archive";
    } catch (e) {
      message.error(e.response?.data?.message || "Lỗi khi ký văn bản");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <Title level={3} className="mb-6 text-gray-800">Ký văn bản nhiều vị trí</Title>
      
      {!signature && (
        <div className="mb-4 p-4 bg-yellow-50 text-yellow-700 rounded border border-yellow-200">
          Bạn chưa cấu hình chữ ký điện tử. Vui lòng vào <b>Cấu hình chữ ký</b> để tải ảnh lên trước khi ký.
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        <Card title="1. Chọn tài liệu" className="w-full md:w-1/3 shadow-sm h-fit">
          <Upload 
            beforeUpload={() => false}
            maxCount={1}
            onChange={handleUploadFile}
            accept=".pdf,.doc,.docx"
            showUploadList={true}
          >
            <Button icon={<UploadOutlined />}>Tải file (PDF, DOCX)</Button>
          </Upload>
          <div className="mt-4 text-gray-500 text-sm">
            Hỗ trợ file định dạng PDF và Word.
          </div>
        </Card>

        <Card title="2. Đóng dấu (Kéo thả)" className="w-full md:w-2/3 shadow-sm" bodyStyle={{ padding: 0 }}>
          {loading && <div className="p-8 text-center"><Spin tip="Đang xử lý tài liệu..." /></div>}
          
          {!loading && pdfFile && (
            <div className="flex flex-col items-center bg-gray-200 p-4">
              <div className="flex justify-between items-center w-full max-w-[600px] mb-2 bg-white p-2 rounded shadow">
                <Button 
                  icon={<LeftOutlined />} 
                  disabled={pageNumber <= 1} 
                  onClick={() => setPageNumber(p => p - 1)}
                />
                <Text>Trang {pageNumber} / {numPages}</Text>
                <Button 
                  icon={<RightOutlined />} 
                  disabled={pageNumber >= numPages} 
                  onClick={() => setPageNumber(p => p + 1)}
                />
                <Button type="dashed" icon={<PlusOutlined />} onClick={addSignature} className="ml-4">
                  Thêm chữ ký ở trang này
                </Button>
              </div>

              <div className="relative border border-gray-300 shadow bg-white" style={{ maxWidth: 800 }} ref={containerRef}>
                <Document
                  file={pdfFile}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={<Spin className="m-10" />}
                >
                  <Page 
                    pageNumber={pageNumber} 
                    onLoadSuccess={onPageLoadSuccess}
                    renderTextLayer={false} 
                    renderAnnotationLayer={false} 
                    width={600} 
                  />
                </Document>

                {signature && signaturesPos.map(sig => (
                  sig.pageNum === pageNumber && (
                    <Rnd
                      key={sig.id}
                      bounds="parent"
                      position={{ x: sig.x, y: sig.y }}
                      size={{ width: sig.width, height: sig.height }}
                      onDragStop={(e, d) => updateSignature(sig.id, { x: d.x, y: d.y })}
                      onResizeStop={(e, direction, ref, delta, position) => {
                        updateSignature(sig.id, {
                          width: ref.offsetWidth,
                          height: ref.offsetHeight,
                          ...position,
                        });
                      }}
                      className="border-2 border-blue-500 border-dashed bg-blue-50 bg-opacity-30 cursor-move group"
                    >
                      <Button 
                        type="primary" danger shape="circle" icon={<DeleteOutlined />} 
                        size="small" 
                        className="absolute -top-3 -right-3 hidden group-hover:block z-50"
                        onClick={() => removeSignature(sig.id)}
                      />
                      <img 
                        src={`https://drive.google.com/uc?id=${signature.fileId}`} 
                        className="w-full h-full object-contain pointer-events-none mix-blend-multiply" 
                        alt="Chữ ký"
                      />
                    </Rnd>
                  )
                ))}
              </div>
              
              <div className="mt-6 w-full max-w-[600px] flex justify-between items-center bg-white p-4 rounded shadow">
                <Text strong>Tổng số chữ ký: {signaturesPos.length}</Text>
                <Button type="primary" size="large" icon={<HighlightOutlined />} onClick={submitSignature} disabled={!signature || signaturesPos.length === 0}>
                  Tiến hành Ký & Lưu
                </Button>
              </div>
            </div>
          )}
          
          {!pdfFile && !loading && (
            <div className="p-10 text-center text-gray-400">
              Chưa có tài liệu nào được chọn để xem trước
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SignDocument;
