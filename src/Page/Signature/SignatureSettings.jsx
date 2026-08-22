import React, { useState, useEffect } from "react";
import { Card, Upload, Button, message, Spin, Space, Typography } from "antd";
import { UploadOutlined, SaveOutlined } from "@ant-design/icons";
import axios from "axios";
import Cookies from "js-cookie";

const { Title, Text } = Typography;
const API_URL = import.meta.env.VITE_API_URL;

const SignatureSettings = () => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signature, setSignature] = useState(null);
  const [fileList, setFileList] = useState([]);

  useEffect(() => {
    fetchMySignature();
  }, []);

  const fetchMySignature = async () => {
    setLoading(true);
    try {
      const token = Cookies.get("accessToken");
      const res = await axios.get(`${API_URL}/api/signature/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.signature) {
        setSignature(res.data.signature);
      }
    } catch (error) {
      console.error(error);
      message.error("Lỗi khi tải thông tin chữ ký");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning("Vui lòng chọn một ảnh chữ ký!");
      return;
    }

    const formData = new FormData();
    // In beforeUpload we set fileList to [file], so fileList[0] is the native File object
    const fileToUpload = fileList[0].originFileObj || fileList[0];
    formData.append("signatureImage", fileToUpload);

    setUploading(true);
    try {
      const token = Cookies.get("accessToken");
      const res = await axios.post(`${API_URL}/api/signature/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      message.success("Tải chữ ký thành công!");
      setSignature(res.data.signature);
      setFileList([]);
    } catch (error) {
      console.error(error);
      message.error(error.response?.data?.message || "Có lỗi xảy ra khi tải chữ ký");
    } finally {
      setUploading(false);
    }
  };

  const uploadProps = {
    onRemove: () => {
      setFileList([]);
    },
    beforeUpload: (file) => {
      const isImage = file.type.startsWith("image/");
      if (!isImage) {
        message.error("Chỉ chấp nhận file định dạng hình ảnh!");
        return Upload.LIST_IGNORE;
      }
      setFileList([file]);
      return false; // Ngăn chặn upload tự động
    },
    fileList,
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <Title level={3} className="mb-6 text-gray-800">Cấu hình chữ ký cá nhân</Title>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Chữ ký hiện tại của bạn" className="shadow-sm rounded-lg">
          {loading ? (
            <div className="flex justify-center p-8"><Spin /></div>
          ) : signature ? (
            <div className="flex flex-col items-center">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50 mb-4 flex justify-center items-center h-48 w-full max-w-sm">
                <img 
                  src={`https://drive.google.com/uc?id=${signature.fileId}`} 
                  alt="Chữ ký cá nhân" 
                  className="max-h-full max-w-full object-contain mix-blend-multiply"
                />
              </div>
              <Text type="secondary">Tên file: {signature.fileName}</Text>
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500">
              Bạn chưa thiết lập chữ ký cá nhân.
            </div>
          )}
        </Card>

        <Card title="Cập nhật chữ ký mới" className="shadow-sm rounded-lg">
          <div className="flex flex-col space-y-4">
            <div className="p-4 bg-blue-50 text-blue-800 rounded-md text-sm">
              <p><strong>Khuyến nghị:</strong></p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Sử dụng ảnh định dạng <strong>PNG có nền trong suốt</strong>.</li>
                <li>Tỷ lệ ảnh phù hợp (khoảng 3:1 hoặc 2:1), không chứa quá nhiều khoảng trống thừa xung quanh chữ ký.</li>
                <li>Dung lượng ảnh không vượt quá 5MB.</li>
              </ul>
            </div>
            
            <Upload {...uploadProps} listType="picture" maxCount={1} accept="image/*">
              <Button icon={<UploadOutlined />}>Chọn file ảnh chữ ký</Button>
            </Upload>
            
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              onClick={handleUpload}
              loading={uploading}
              disabled={fileList.length === 0}
              className="w-32 mt-4"
            >
              Lưu chữ ký
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SignatureSettings;
