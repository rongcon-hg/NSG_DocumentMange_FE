import React, { useState, useEffect } from "react";
import { Table, Card, Button, message, Input, DatePicker, Space, Popconfirm } from "antd";
import { DownloadOutlined, SearchOutlined, DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import Cookies from "js-cookie";

const { RangePicker } = DatePicker;

const API_URL = import.meta.env.VITE_API_URL;

const SignedArchive = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  
  // Filter States
  const [searchText, setSearchText] = useState("");
  const [dateRange, setDateRange] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    fetchArchive();
  }, []);

  const fetchArchive = async () => {
    setLoading(true);
    try {
      const token = Cookies.get("accessToken");
      const res = await axios.get(`${API_URL}/api/signature/archive`, {
        headers: { Authorization: `Bearer ${token}` },
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

  const handleDelete = async (id) => {
    try {
      const token = Cookies.get("accessToken");
      await axios.delete(`${API_URL}/api/signature/archive/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      message.success("Đã xóa văn bản khỏi kho lưu trữ");
      fetchArchive();
    } catch (error) {
      console.error(error);
      message.error("Lỗi khi xóa văn bản");
    }
  };

  // Lọc dữ liệu
  let filteredData = data.filter((item) => {
    // Lọc theo text (tìm trong tên gốc và tên file đã ký)
    const matchText = (item.originalFileName || "").toLowerCase().includes(searchText.toLowerCase()) || 
                      (item.signedFileName || "").toLowerCase().includes(searchText.toLowerCase());
    
    // Lọc theo khoảng thời gian ký
    let matchDate = true;
    if (dateRange && dateRange[0] && dateRange[1]) {
      const signDate = dayjs(item.signDate);
      matchDate = (signDate.isAfter(dateRange[0].startOf("day")) || signDate.isSame(dateRange[0].startOf("day"))) &&
                  (signDate.isBefore(dateRange[1].endOf("day")) || signDate.isSame(dateRange[1].endOf("day")));
    }

    return matchText && matchDate;
  });

  const isNoFilter = searchText.trim() === "" && (!dateRange || (!dateRange[0] && !dateRange[1]));
  
  // Sắp xếp mới nhất lên đầu
  filteredData = [...filteredData].sort((a, b) => new Date(b.signDate) - new Date(a.signDate));

  if (isNoFilter) {
    filteredData = filteredData.slice(0, 50);
  }

  const columns = [
    {
      title: "STT",
      key: "index",
      render: (text, record, index) => index + 1,
      width: 60,
      align: "center"
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
      width: 160,
      sorter: (a, b) => new Date(a.signDate) - new Date(b.signDate),
    },
    {
      title: "Thao tác",
      key: "action",
      fixed: "right",
      width: isMobile ? 110 : 175,
      align: "center",
      render: (_, record) => (
        <div className="flex gap-1 justify-center items-center">
          <Button
            type="default"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => window.open(`https://drive.google.com/file/d/${record.fileId}/view`, "_blank")}
            title="Xem trước văn bản"
            className="px-1.5"
          >
            <span className="hidden sm:inline ml-1">Xem</span>
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            size="small"
            onClick={() => handleDownload(record.fileId)}
            title="Tải về máy"
            className="px-1.5"
          >
            <span className="hidden sm:inline ml-1">Tải</span>
          </Button>
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa văn bản này khỏi kho?"
            onConfirm={() => handleDelete(record._id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button type="primary" danger icon={<DeleteOutlined />} size="small" title="Xóa" className="px-1.5">
              <span className="hidden sm:inline ml-1">Xóa</span>
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <Card title="Kho lưu trữ văn bản đã ký" className="shadow-sm rounded-lg">
        
        {/* Thanh công cụ tìm kiếm và lọc */}
        <div className="mb-4 flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded border border-gray-200">
          <div className="flex flex-wrap gap-4 w-full">
            <Input
              placeholder="Tìm kiếm tên file gốc / file đã ký..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full md:w-80"
              prefix={<SearchOutlined />}
              allowClear
            />

            <RangePicker 
              placeholder={["Từ ngày ký", "Đến ngày ký"]}
              format="DD/MM/YYYY"
              onChange={(dates) => setDateRange(dates)}
              className="w-full md:w-72"
            />
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, showLessItems: true, responsive: true, pageSizeOptions: ["10", "20", "50"] }}
          bordered
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
};

export default SignedArchive;
