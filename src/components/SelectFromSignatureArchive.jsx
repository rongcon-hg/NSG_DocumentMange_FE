import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, message, Input } from 'antd';
import { CloudServerOutlined, SearchOutlined } from '@ant-design/icons';
import axios from 'axios';
import Cookies from 'js-cookie';
import dayjs from 'dayjs';

const API_URL = import.meta.env.VITE_API_URL;

const SelectFromSignatureArchive = ({ onSelectFiles }) => {
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

  const handleOk = () => {
    if (selectedRows.length > 0) {
      const files = selectedRows.map(row => ({
        uid: row._id,
        name: row.signedFileName || row.originalFileName,
        status: "done",
        url: 'https://drive.google.com/file/d/' + row.fileId + '/view',
        isExisting: true,
        fileId: row.fileId,
        fileName: row.signedFileName || row.originalFileName,
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
    { title: "Tên tệp", dataIndex: "signedFileName", key: "signedFileName", render: (text, record) => text || record.originalFileName },
    { title: "Ngày ký", dataIndex: "signDate", key: "signDate", render: v => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "" },
  ];

  const filteredData = data.filter(item => {
    const fileName = (item.signedFileName || item.originalFileName || "").toLowerCase().replace(/-/g, " ");
    const search = searchText.toLowerCase().replace(/-/g, " ");
    return fileName.includes(search);
  });

  return (
    <>
      <Button 
        type="dashed" 
        icon={<CloudServerOutlined />} 
        onClick={() => setVisible(true)}
        className="mb-2"
      >
        Chọn từ Kho văn bản đã ký
      </Button>
      <Modal
        title="Kho văn bản đã ký"
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
            onChange={e => setSearchText(e.target.value)}
            allowClear
          />
        </div>
        <Table
          rowSelection={{
            type: "checkbox",
            selectedRowKeys,
            onChange: (keys, rows) => { setSelectedRowKeys(keys); setSelectedRows(rows); }
          }}
          columns={columns}
          dataSource={filteredData}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </Modal>
    </>
  );
};

export default SelectFromSignatureArchive;
