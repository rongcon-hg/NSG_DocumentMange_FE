import React, { useState, useEffect, useRef } from "react";
import { Card, Upload, Button, message, Spin, Typography, InputNumber } from "antd";
import { UploadOutlined, HighlightOutlined, LeftOutlined, RightOutlined } from "@ant-design/icons";
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
  
  // Rnd state
  const [signPos, setSignPos] = useState({ x: 50, y: 50, width: 150, height: 75 });
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
    // Some versions of Antd or upload configurations pass native files directly, others wrap them
    const selectedFile = info.fileList[0]?.originFileObj || info.fileList[0] || info.file;
    if (!selectedFile) return;

    setFile(selectedFile);
    
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
  };

  const onPageLoadSuccess = (page) => {
    setPdfDimensions({
      width: page.originalWidth,
      height: page.originalHeight
    });
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

    // Convert DOM position to PDF Points
    // Container width might be scaled, we need ratio
    const containerNode = containerRef.current;
    if (!containerNode) return;
    const domWidth = containerNode.getBoundingClientRect().width;
    const scale = pdfDimensions.width / domWidth;

    const pdfX = signPos.x * scale;
    // pdf-lib y=0 is BOTTOM left. Rnd y=0 is TOP left.
    const pdfY = pdfDimensions.height - ((signPos.y + signPos.height) * scale);
    const pdfWidth = signPos.width * scale;
    const pdfHeight = signPos.height * scale;

    const formData = new FormData();
    formData.append("pdfFile", file);
    formData.append("x", pdfX);
    formData.append("y", pdfY);
    formData.append("width", pdfWidth);
    formData.append("height", pdfHeight);
    formData.append("pageNum", pageNumber);

    setLoading(true);
    try {
      const token = Cookies.get("accessToken");
      const res = await axios.post(`${API_URL}/api/signature/sign-pdf`, formData, {
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
      <Title level={3} className="mb-6 text-gray-800">Ký văn bản</Title>
      
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
            Hỗ trợ file định dạng PDF và Word. File Word sẽ tự động chuyển sang PDF để ký.
          </div>
        </Card>

        <Card title="2. Đóng dấu (Kéo thả)" className="w-full md:w-2/3 shadow-sm" bodyStyle={{ padding: 0 }}>
          {loading && <div className="p-8 text-center"><Spin tip="Đang xử lý tài liệu..." /></div>}
          
          {!loading && pdfFile && (
            <div className="flex flex-col items-center bg-gray-200 p-4">
              <div className="flex justify-between w-full max-w-[600px] mb-2 bg-white p-2 rounded shadow">
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

                {signature && (
                  <Rnd
                    bounds="parent"
                    position={{ x: signPos.x, y: signPos.y }}
                    size={{ width: signPos.width, height: signPos.height }}
                    onDragStop={(e, d) => setSignPos({ ...signPos, x: d.x, y: d.y })}
                    onResizeStop={(e, direction, ref, delta, position) => {
                      setSignPos({
                        width: ref.offsetWidth,
                        height: ref.offsetHeight,
                        ...position,
                      });
                    }}
                    className="border-2 border-blue-500 border-dashed bg-blue-50 bg-opacity-30 cursor-move"
                  >
                    <img 
                      src={`https://drive.google.com/uc?id=${signature.fileId}`} 
                      className="w-full h-full object-contain pointer-events-none mix-blend-multiply" 
                      alt="Chữ ký"
                    />
                  </Rnd>
                )}
              </div>
              
              <div className="mt-6">
                <Button type="primary" size="large" icon={<HighlightOutlined />} onClick={submitSignature} disabled={!signature}>
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
