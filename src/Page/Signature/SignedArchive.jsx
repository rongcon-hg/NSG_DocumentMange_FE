import React, { useState, useEffect } from "react";
import { Table, Card, Button, message, Tag } from "antd";
import { DownloadOutlined, EyeOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";

const API_URL = import.meta.env.VITE_API_URL;

const SignedArchive = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  useEffect(() => {
    fetchArchive();
  }, []);

  const fetchArchive = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const res = await axios.get(`${API_URL}/api/signature/archive`, {
        headers: { Authorization: token },
      });
      if (res.data.data) {
        setData(res.data.data);
      }
    } catch (error) {
      console.error(error);
      message.error("Lỗi khi tải danh sách văn bản đã ký");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (fileId) => {
    window.open(`https://drive.google.com/uc?export=download&id=${fileId}`, "_blank");
  };

  const columns = [
    {
      title: "STT",
      key: "index",
      render: (text, record, index) => index + 1,
      width: 60,
    },
    {
      title: "Tên văn bản gốc",
      dataIndex: "originalFileName",
      key: "originalFileName",
    },
    {
      title: "Tên văn bản đã ký",
      dataIndex: "signedFileName",
      key: "signedFileName",
    },
    {
      title: "Ngày ký",
      dataIndex: "signDate",
      key: "signDate",
      render: (date) => dayjs(date).format("DD/MM/YYYY HH:mm"),
      width: 150,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        let color = "gray";
        let text = "Lưu nháp";
        if (status === "issued") { color = "green"; text = "Đã ban hành"; }
        if (status === "replied") { color = "blue"; text = "Đã phản hồi"; }
        return <Tag color={color}>{text}</Tag>;
      },
      width: 120,
    },
    {
      title: "Thao tác",
      key: "action",
      render: (_, record) => (
        <div className="space-x-2">
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            size="small"
            onClick={() => handleDownload(record.fileId)}
          >
            Tải xuống
          </Button>
        </div>
      ),
      width: 150,
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <Card title="Kho lưu trữ văn bản đã ký" className="shadow-sm rounded-lg">
        <Table
          columns={columns}
          dataSource={data}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Card>
    </div>
  );
};

export default SignedArchive;
