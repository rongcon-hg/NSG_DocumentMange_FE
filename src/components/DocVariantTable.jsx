import { useState, useEffect } from "react";
import { Table, Button, Popconfirm, Spin } from "antd";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

// eslint-disable-next-line react/prop-types
const DocVariantTable = ({ data, onEdit, onDelete, loading }) => {
  const [currentUserRole, setCurrentUserRole] = useState("");

  // Lấy role của user từ token
  useEffect(() => {
    const token = Cookies.get("accessToken");
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        setCurrentUserRole(decodedToken.role || "");
      } catch (error) {
        console.error("Lỗi khi decode token:", error);
        setCurrentUserRole("");
      }
    }
  }, []);

  // Kiểm tra quyền chỉnh sửa và thêm mới (admin hoặc manager)
  const hasPermission = () => {
    return currentUserRole === "admin" || currentUserRole === "manager";
  };

  const columns = [
    {
      title: "STT",
      dataIndex: "index",
      key: "index",
      render: (text, record) => data.indexOf(record) + 1,
      width: 60,
    },
    {
      title: "Tên loại văn bản",
      dataIndex: "docVariantName",
      key: "docVariantName",
      sorter: (a, b) => a.docVariantName.localeCompare(b.docVariantName),
    },
    {
      title: "Tổng văn bản đi",
      dataIndex: "sent",
      key: "sent",
      render: (sent) => sent || 0,
      sorter: (a, b) => a.sent - b.sent,
    },
    {
      title: "Tổng văn bản đến",
      dataIndex: "received",
      key: "received",
      render: (received) => received || 0,
      sorter: (a, b) => a.received - b.received,
    },
    {
      title: "Thao tác",
      key: "action",
      render: (text, record) => (
        <div className="flex gap-2">
          {hasPermission() && onEdit && (
            <Button
              type="primary"
              size="small"
              onClick={() => onEdit(record)}
              disabled={loading}
            >
              Sửa
            </Button>
          )}
          {onDelete && (
            <Popconfirm
              title="Bạn chắc chắn muốn xóa?"
              onConfirm={() => onDelete(record.docVariantId)}
              okText="Xóa"
              cancelText="Hủy"
              disabled={loading}
            >
              <Button type="primary" danger size="small" disabled={loading}>
                Xóa
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <Spin spinning={loading}>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="docVariantId"
        pagination={{ pageSize: 20, showLessItems: true, responsive: true }}
        scroll={{ x: "max-content" }}
        className="shadow-md rounded-lg border border-gray-200"
      />
    </Spin>
  );
};

export default DocVariantTable;