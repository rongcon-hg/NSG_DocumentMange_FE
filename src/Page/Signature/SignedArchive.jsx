import React, { useState, useEffect } from "react";
import { Table, Card, Button, message, Tag, Input, Select, DatePicker, Space, Popconfirm } from "antd";
import { DownloadOutlined, SearchOutlined, DeleteOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs from "dayjs";
import Cookies from "js-cookie";

const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

const API_URL = import.meta.env.VITE_API_URL;

const SignedArchive = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  
  // Filter States
  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateRange, setDateRange] = useState(null);

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
  const filteredData = data.filter((item) => {
    // Lọc theo text (tìm trong tên gốc và tên file đã ký)
    const matchText = (item.originalFileName || "").toLowerCase().includes(searchText.toLowerCase()) || 
                      (item.signedFileName || "").toLowerCase().includes(searchText.toLowerCase());
    
    // Lọc theo trạng thái
    const matchStatus = filterStatus === "all" || item.status === filterStatus;
    
    // Lọc theo khoảng thời gian ký
    let matchDate = true;
    if (dateRange && dateRange[0] && dateRange[1]) {
      const signDate = dayjs(item.signDate);
      // isBetween cần plugin, nên dùng isAfter / isBefore hoặc so sánh trực tiếp
      matchDate = (signDate.isAfter(dateRange[0].startOf("day")) || signDate.isSame(dateRange[0].startOf("day"))) &&
                  (signDate.isBefore(dateRange[1].endOf("day")) || signDate.isSame(dateRange[1].endOf("day")));
    }

    return matchText && matchStatus && matchDate;
  });

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
      sorter: (a, b) => new Date(a.signDate) - new Date(b.signDate),
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
      fixed: "right",
      render: (_, record) => (
        <div className="space-x-2 flex">
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            size="small"
            onClick={() => handleDownload(record.fileId)}
          >
            Tải
          </Button>
          <Popconfirm
            title="Bạn có chắc chắn muốn xóa văn bản này?"
            onConfirm={() => handleDelete(record._id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button type="primary" danger icon={<DeleteOutlined />} size="small">
              Xóa
            </Button>
          </Popconfirm>
        </div>
      ),
      width: 150,
    },
  ];

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <Card title="Kho lưu trữ văn bản đã ký" className="shadow-sm rounded-lg">
        
        {/* Thanh công cụ tìm kiếm và lọc */}
        <div className="mb-4 flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded border border-gray-200">
          <div className="flex flex-wrap gap-4 w-full">
            <Input
              placeholder="Tên file gốc / đã ký..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full md:w-64"
              prefix={<SearchOutlined />}
            />
            
            <Select
              defaultValue="all"
              className="w-full md:w-40"
              onChange={(val) => setFilterStatus(val)}
            >
              <Option value="all">Tất cả trạng thái</Option>
              <Option value="draft">Lưu nháp</Option>
              <Option value="issued">Đã ban hành</Option>
              <Option value="replied">Đã phản hồi</Option>
            </Select>

            <RangePicker 
              placeholder={["Từ ngày", "Đến ngày"]}
              format="DD/MM/YYYY"
              onChange={(dates) => setDateRange(dates)}
              className="w-full md:w-64"
            />
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ["10", "20", "50"] }}
          bordered
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
};

export default SignedArchive;
