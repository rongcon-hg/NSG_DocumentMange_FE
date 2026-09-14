import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, message, Input } from 'antd';
import { CloudServerOutlined, SearchOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import Cookies from 'js-cookie';
import dayjs from 'dayjs';

const API_URL = import.meta.env.VITE_API_URL;

const SelectFromSignatureArchive = ({
  onSelectFiles,
  buttonText = "Chọn từ Kho văn bản đã ký",
  buttonProps = {},
  modalTitle = "Kho văn bản đã ký",
  customTrigger,
}) => {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [searchText, setSearchText] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = Cookies.get("accessToken");
      const res = await axios.get(API_URL + '/api/signature/archive', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.data.data) {
        setData(res.data.data);
      }
    } catch (err) {
      message.error("Lỗi tải kho chữ ký");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) fetchData();
  }, [visible]);

  const handleOpen = () => {
    setSelectedRowKeys([]);
    setSelectedRows([]);
    setSearchText("");
    setVisible(true);
  };

  const handleOk = () => {
    if (selectedRows.length > 0) {
      const files = selectedRows.map((row) => ({
        uid: row._id,
        name: row.signedFileName || row.originalFileName,
        status: "done",
        url: 'https://drive.google.com/file/d/' + row.fileId + '/view',
        fileUrl: 'https://drive.google.com/file/d/' + row.fileId + '/view',
        isExisting: true,
        fileId: row.fileId,
        fileName: row.signedFileName || row.originalFileName,
        mimeType: row.mimeType || "application/pdf",
        size: row.size ? `${(row.size / 1024).toFixed(1)} KB` : "",
      }));
      onSelectFiles(files);
      setVisible(false);
      setSelectedRowKeys([]);
      setSelectedRows([]);
    } else {
      message.warning("Vui lòng chọn ít nhất 1 tệp");
    }
  };

  const columns = [
    {
      title: "Tên tệp",
      dataIndex: "signedFileName",
      key: "signedFileName",
      render: (text, record) => text || record.originalFileName,
    },
    {
      title: "Ngày ký",
      dataIndex: "signDate",
      key: "signDate",
      render: (v) => (v ? dayjs(v).format("DD/MM/YYYY HH:mm") : ""),
    },
    {
      title: "Thao tác",
      key: "action",
      render: (_, record) => (
        <div className="flex space-x-2">
          <Button
            type="primary"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => window.open(`https://drive.google.com/file/d/${record.fileId}/view`, "_blank")}
          >
            <span className="hidden sm:inline">Xem file</span>
          </Button>
          <Button
            icon={<DownloadOutlined />}
            size="small"
            onClick={() => window.open(`https://drive.google.com/uc?export=download&id=${record.fileId}`, "_blank")}
          >
            <span className="hidden sm:inline">Tải xuống</span>
          </Button>
        </div>
      ),
    },
  ];

  const filteredData = data.filter((item) => {
    const fileName = (item.signedFileName || item.originalFileName || "").toLowerCase().replace(/-/g, " ");
    const search = searchText.toLowerCase().replace(/-/g, " ");
    return fileName.includes(search);
  });

  return (
    <>
      {customTrigger ? (
        customTrigger(handleOpen)
      ) : (
        <Button
          type={buttonProps.type || "dashed"}
          size={buttonProps.size}
          icon={buttonProps.icon !== undefined ? buttonProps.icon : <CloudServerOutlined />}
          onClick={handleOpen}
          className={buttonProps.className || "mb-2"}
          style={buttonProps.style}
        >
          {buttonText}
        </Button>
      )}
      <Modal
        title={modalTitle}
        open={visible}
        onOk={handleOk}
        onCancel={() => setVisible(false)}
        width={800}
        okText="Sử dụng"
        cancelText="Hủy"
      >
        <div className="mb-4">
          <Input
            placeholder="Tìm kiếm theo tên tệp..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
        </div>
        <Table
          rowSelection={{
            type: "checkbox",
            selectedRowKeys,
            preserveSelectedRowKeys: true,
            onChange: (keys) => {
              setSelectedRowKeys(keys);
              const map = new Map();
              selectedRows.forEach((r) => map.set(r._id, r));
              data.forEach((r) => {
                if (keys.includes(r._id)) map.set(r._id, r);
              });
              const newRows = keys.map((k) => map.get(k)).filter(Boolean);
              setSelectedRows(newRows);
            },
          }}
          columns={columns}
          dataSource={filteredData}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 5, showLessItems: true, responsive: true }}
          size="small"
        />
      </Modal>
    </>
  );
};

export default SelectFromSignatureArchive;
