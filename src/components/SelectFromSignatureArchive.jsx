import React, { useState, useEffect } from 'react';
import { Modal, Button, Table, message } from 'antd';
import { CloudServerOutlined } from '@ant-design/icons';
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
        name: row.fileName,
        status: "done",
        url: 'https://drive.google.com/file/d/' + row.signedFileId + '/view',
        isExisting: true,
        fileId: row.signedFileId,
        fileName: row.fileName,
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
    { title: "Tên tệp", dataIndex: "fileName", key: "fileName" },
    { title: "Ngày ký", dataIndex: "signedAt", key: "signedAt", render: v => dayjs(v).format("DD/MM/YYYY HH:mm") },
  ];

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
        <Table
          rowSelection={{
            type: "checkbox",
            selectedRowKeys,
            onChange: (keys, rows) => { setSelectedRowKeys(keys); setSelectedRows(rows); }
          }}
          columns={columns}
          dataSource={data}
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
