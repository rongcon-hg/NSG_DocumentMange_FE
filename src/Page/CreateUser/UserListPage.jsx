import { useState, useEffect, useMemo } from "react";
import { Select, Form, Button, Table, message, Spin, Modal, Input, Space, Card } from "antd";
import { getAllUsersCanSearchBanUser, updateUserInfo, disableUser, restoreUser, deleteUser } from "../../api/auth";
import { getAllPositions } from "../../api/PositionAPI";
import { getAllDepartments } from "../../api/DepartmentAPI";
import { Link } from "react-router-dom";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { Tooltip } from "antd";
import { EditOutlined, UserDeleteOutlined, UserAddOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import FilterFormWrapper from "../../components/FilterFormWrapper.jsx";
import { removeVietnameseTones } from "../../utils/stringUtils";

// const { Title } = Typography;

const UserListPage = () => {
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]); // Lưu toàn bộ danh sách người dùng
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);  
  const [isRestoreModalVisible, setIsRestoreModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [selectedRole, setSelectedRole] = useState(null);
  const [form] = Form.useForm();
  const [restoreForm] = Form.useForm();
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [positions, setPositions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    pageSizeOptions: ['10', '20', '50', '100'],
  });
  
  // State cho bộ lọc
  const [filters, setFilters] = useState({
    name: "",
    email: "",
    mobile: "",
    position: null,
    department: null,
  });

  // Danh sách vai trò
  const roles = [
    { _id: "manager", name: "Manager" },
    { _id: "staff", name: "Staff" },
  ];

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

  // Lấy danh sách người dùng, positions và departments từ API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersResponse, positionsData, departmentsData] = await Promise.all([
          getAllUsersCanSearchBanUser(),
          getAllPositions(),
          getAllDepartments(),
        ]);

        const usersList = usersResponse.users || [];
        setUsers(usersList);
        setAllUsers(usersList);

        if (positionsData && Array.isArray(positionsData.AllPosition)) {
          const positionNames = positionsData.AllPosition.map((position) => ({
            _id: position._id,
            name: position.positionName,
          }));
          setPositions(positionNames);
        } else {
          message.error("Dữ liệu Chức vụ không hợp lệ");
        }

        if (departmentsData && Array.isArray(departmentsData.AllDepartment)) {
          const departmentNames = departmentsData.AllDepartment.map((department) => ({
            _id: department._id,
            name: department.departmentName,
          }));
          setDepartments(departmentNames);
        } else {
          message.error("Dữ liệu phòng ban không hợp lệ");
        }
      } catch (error) {
        message.error("Lỗi khi tải dữ liệu!");
        console.error("Lỗi lấy dữ liệu:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Xử lý xóa người dùng
  const handleDelete = async (userId) => {
    Modal.confirm({
      title: "Bạn có chắc chắn muốn xóa người dùng này?",
      content: "Hành động này không thể hoàn tác!",
      okText: "Xóa",
      cancelText: "Hủy",
      okType: "danger",
      onOk: async () => {
        try {
          const response = await deleteUser(userId);
          if (response.success) {
            const updatedUsers = allUsers.filter((user) => user._id !== userId);
            setAllUsers(updatedUsers);
            message.success("Xóa người dùng thành công!");
          } else {
            message.error(response.message || "Lỗi khi xóa người dùng!");
          }
        } catch (error) {
          message.error(error.message || "Lỗi khi xóa người dùng!");
          console.error("Lỗi khi xóa:", error);
        }
      },
    });
  };

  // Vô hiệu hóa người dùng
  const handleBan = async (userId) => {
    Modal.confirm({
      title: "Bạn có chắc chắn muốn vô hiệu hóa người dùng này?",
      okText: "Vô hiệu hóa",
      cancelText: "Hủy",
      okType: "danger",
      onOk: async () => {
        try {
          const response = await disableUser(userId);
          if (response.success) {
            const updatedUsers = allUsers.map((user) => (user._id === userId ? { ...user, role: null } : user));
            setAllUsers(updatedUsers);
            message.success("Vô hiệu hóa người dùng thành công!");
          } else {
            message.error(response.message || "Lỗi khi vô hiệu hóa người dùng!");
          }
        } catch (error) {
          message.error(error.message);
          console.error("Lỗi khi vô hiệu hóa:", error);
        }
      },
    });
  };

  // Mở modal khôi phục
  const handleUnban = (user) => {
    setSelectedUser(user);
    setIsRestoreModalVisible(true);
  };

  // Khôi phục người dùng
  const handleRestore = async (values) => {
    if (!selectedUser) return;
    try {
      const response = await restoreUser(selectedUser._id, values.role);
      if (response.success) {
        const updatedUsers = allUsers.map((user) =>
          user._id === selectedUser._id ? { ...user, role: values.role } : user
        );
        setAllUsers(updatedUsers);
        message.success("Khôi phục người dùng thành công!");
        setIsRestoreModalVisible(false);
        restoreForm.resetFields();
      } else {
        message.error(response.message || "Lỗi khi khôi phục người dùng!");
      }
    } catch (error) {
      message.error(error.message);
      console.error("Lỗi khi khôi phục:", error);
    }
  };

  // Mở modal chỉnh sửa
  const handleEdit = (user) => {
    setSelectedUser(user);
    form.setFieldsValue({
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      position: user.position?._id,
      department: user.department?._id,
      description: user.description || "",
      password: "",
    });
    setIsModalVisible(true);
  };

  // Cập nhật thông tin người dùng
  const handleUpdate = async (values) => {
    if (!selectedUser) return;
    try {
      const updatedData = {
        name: values.name,
        email: values.email,
        mobile: values.mobile,
        role: values.role,
        position: values.position,
        department: values.department,
        description: values.description,
        password: values.password || undefined,
      };
      const response = await updateUserInfo(selectedUser._id, updatedData);
      if (response.success) {
        // Tìm position và department objects từ ID
        const positionObj = positions.find(p => p._id === updatedData.position);
        const departmentObj = departments.find(d => d._id === updatedData.department);
        
        const updatedUsers = allUsers.map((user) =>
          user._id === selectedUser._id 
            ? { 
                ...user, 
                ...updatedData,
                position: positionObj ? { _id: positionObj._id, positionName: positionObj.name } : user.position,
                department: departmentObj ? { _id: departmentObj._id, departmentName: departmentObj.name } : user.department,
              } 
            : user
        );
        setAllUsers(updatedUsers);
        message.success("Cập nhật thông tin người dùng thành công!");
        setIsModalVisible(false);
        form.resetFields();
        // Không cần reload trang nữa vì đã cập nhật state
      } else {
        message.error(response.message || "Lỗi khi cập nhật thông tin người dùng!");
      }
    } catch (error) {
      message.error("Lỗi khi cập nhật thông tin người dùng!");
      console.error("Lỗi khi cập nhật:", error);
    }
  };

  // Kiểm tra quyền chỉnh sửa/vô hiệu hóa/khôi phục/xóa
  const hasPermission = () => {
    return currentUserRole === "admin" || currentUserRole === "manager";
  };

  // Xử lý thay đổi bộ lọc
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Áp dụng bộ lọc
  const applyFilters = useMemo(() => {
    let filtered = [...allUsers];

    if (filters.name) {
      const searchName = removeVietnameseTones(filters.name.toLowerCase());
      filtered = filtered.filter((user) =>
        removeVietnameseTones(user.name?.toLowerCase() || "").includes(searchName)
      );
    }

    if (filters.email) {
      const searchEmail = removeVietnameseTones(filters.email.toLowerCase());
      filtered = filtered.filter((user) =>
        removeVietnameseTones(user.email?.toLowerCase() || "").includes(searchEmail)
      );
    }

    if (filters.mobile) {
      const searchMobile = removeVietnameseTones(filters.mobile);
      filtered = filtered.filter((user) =>
        removeVietnameseTones(user.mobile || "").includes(searchMobile)
      );
    }

    if (filters.position) {
      filtered = filtered.filter((user) => {
        const positionId = typeof user.position === 'object' ? user.position?._id : user.position;
        return positionId === filters.position;
      });
    }

    if (filters.department) {
      filtered = filtered.filter((user) => {
        const departmentId = typeof user.department === 'object' ? user.department?._id : user.department;
        return departmentId === filters.department;
      });
    }

    return filtered;
  }, [allUsers, filters]);

  // Cập nhật danh sách người dùng khi filter thay đổi
  useEffect(() => {
    setUsers(applyFilters);
    // Reset pagination về trang 1 khi filter thay đổi
    setPagination(prev => ({
      ...prev,
      current: 1,
    }));
  }, [applyFilters]);

  // Xử lý tìm kiếm
  const handleSearch = () => {
    // Filter đã được áp dụng tự động qua useMemo
  };

  // Đặt lại bộ lọc
  const handleResetFilters = () => {
    setFilters({
      name: "",
      email: "",
      mobile: "",
      position: null,
      department: null,
    });
    setUsers(allUsers);
  };

  // Cấu hình bảng
  const columns = [
    {
      title: "STT",
      key: "stt",
      width: 60,
      align: "center",
      render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
    },
    { title: "Họ tên", dataIndex: "name", key: "name" },
    { title: "Email", dataIndex: "email", key: "email", render: (email) => email || "Chưa có" },
    { title: "Số Điện Thoại", dataIndex: "mobile", key: "mobile" },
    {
      title: "Chức vụ",
      dataIndex: ["position", "positionName"],
      key: "position",
      render: (positionName) => positionName || "Không có",
      width: 180,
    },
    {
      title: "Phòng ban",
      dataIndex: ["department", "departmentName"],
      key: "department",
      render: (departmentName) => departmentName || "Không có",
      width: 200,
    },
    { title: "Vai Trò", dataIndex: "role", key: "role", render: (role) => role || "Bị vô hiệu hóa" },
    {
      title: "Hành Động",
      key: "action",
      width: 120,
      fixed: "right",
      render: (_, record) =>
        hasPermission() && (
          <div className="flex flex-wrap gap-2 justify-center">
            <Tooltip title="Chỉnh sửa thông tin">
              <Button type="primary" icon={<EditOutlined />} onClick={() => handleEdit(record)} className="text-xs rounded-md">
                <span className="hidden sm:inline text-xs">Sửa</span>
              </Button>
            </Tooltip>
            {record.role ? (
              <Tooltip title="Vô hiệu hóa tài khoản">
                <Button type="default" danger icon={<UserDeleteOutlined />} onClick={() => handleBan(record._id)} className="text-xs rounded-md">
                  <span className="hidden sm:inline text-xs">Khóa</span>
                </Button>
              </Tooltip>
            ) : (
              <Tooltip title="Khôi phục tài khoản">
                <Button type="default" icon={<UserAddOutlined />} onClick={() => handleUnban(record)} className="text-xs rounded-md">
                  <span className="hidden sm:inline text-xs">Khôi phục</span>
                </Button>
              </Tooltip>
            )}
            {currentUserRole === "admin" && (
              <Tooltip title="Xóa tài khoản">
                <Button type="default" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record._id)} className="text-xs rounded-md">
                  <span className="hidden sm:inline text-xs">Xóa</span>
                </Button>
              </Tooltip>
            )}
          </div>
        ),
    },
  ];

  return (
    <div className="p-2 sm:p-4 md:p-6 bg-gray-50 min-h-screen">
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mb-3 sm:mb-4 md:mb-6 text-center">
        Danh Sách Người Dùng
      </h2>
      <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:gap-4">
        <Link to="/CreateUser">
          <Button type="primary" className="w-full sm:w-auto rounded-md">
            Tạo tài khoản
          </Button>
        </Link>
      </div>

      {/* Form lọc */}
      <Card className="mb-4 md:mb-6 p-3 md:p-4 shadow-sm rounded-lg border border-gray-200">
        <FilterFormWrapper onSearch={handleSearch}>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 items-end">
            <Input
              placeholder="Tìm theo tên"
              value={filters.name}
              onChange={(e) => handleFilterChange("name", e.target.value)}
              className="w-full rounded-md"
              allowClear
            />
            <Input
              placeholder="Tìm theo email"
              value={filters.email}
              onChange={(e) => handleFilterChange("email", e.target.value)}
              className="w-full rounded-md"
              allowClear
            />
            <Input
              placeholder="Tìm theo số điện thoại"
              value={filters.mobile}
              onChange={(e) => handleFilterChange("mobile", e.target.value)}
              className="w-full rounded-md"
              allowClear
            />
            <Select
              placeholder="Chức vụ"
              value={filters.position}
              onChange={(value) => handleFilterChange("position", value)}
              allowClear
              className="w-full"
              showSearch
              filterOption={(input, option) =>
                (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
              }
            >
              {positions.map((position) => (
                <Select.Option key={position._id} value={position._id}>
                  {position.name}
                </Select.Option>
              ))}
            </Select>
            <Select
              placeholder="Phòng ban"
              value={filters.department}
              onChange={(value) => handleFilterChange("department", value)}
              allowClear
              className="w-full"
              showSearch
              filterOption={(input, option) =>
                (option?.children ?? "").toLowerCase().includes(input.toLowerCase())
              }
            >
              {departments.map((department) => (
                <Select.Option key={department._id} value={department._id}>
                  {department.name}
                </Select.Option>
              ))}
            </Select>
            <div className="flex gap-2 col-span-full sm:col-span-1 justify-end">
              <Tooltip title="Lọc dữ liệu">
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} className="rounded-md">
                  <span className="hidden sm:inline">Lọc</span>
                </Button>
              </Tooltip>
              <Tooltip title="Đặt lại bộ lọc">
                <Button type="default" icon={<ReloadOutlined />} onClick={handleResetFilters} className="rounded-md">
                  <span className="hidden sm:inline">Đặt lại</span>
                </Button>
              </Tooltip>
            </div>
          </div>
        </FilterFormWrapper>
      </Card>
      {loading ? (
        <div className="text-center mt-5">
          <Spin size="large" />
        </div>
      ) : (
        <Table 
          columns={columns} 
          dataSource={users} 
          rowKey="_id" 
          bordered 
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            pageSizeOptions: pagination.pageSizeOptions,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} người dùng`,
            size: "small",
            responsive: true,
            onChange: (page, pageSize) => {
              setPagination(prev => ({
                ...prev,
                current: page,
                pageSize: pageSize,
              }));
            },
            onShowSizeChange: (current, size) => {
              setPagination(prev => ({
                ...prev,
                current: 1,
                pageSize: size,
              }));
            },
          }}
          scroll={{ x: 'max-content' }}
          size="small"
        />
      )}

      {/* Modal chỉnh sửa */}
      <Modal
        title="Chỉnh sửa thông tin"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width="90%"
        style={{ maxWidth: 600 }}
      >
        <Form form={form} onFinish={handleUpdate} layout="vertical">
          <Form.Item name="name" label="Họ tên" rules={[{ required: true, message: "Vui lòng nhập họ tên!" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="mobile" label="Số Điện Thoại">
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="Mật Khẩu"
            rules={[
              {
                min: 6,
                message: "Mật khẩu phải có ít nhất 6 ký tự!",
              },
            ]}
          >
            <Input.Password placeholder="Nhập mật khẩu mới (để trống nếu không thay đổi)" />
          </Form.Item>
          <Form.Item
            name="position"
            label="Chức danh / Chức vụ"
            rules={[{ required: true, message: "Vui lòng chọn Chức danh / Chức vụ!" }]}
          >
            <Select placeholder="Chọn vị trí" loading={positions.length === 0}>
              {positions.map((position) => (
                <Select.Option key={position._id} value={position._id}>
                  {position.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="department"
            label="Phòng Ban"
            rules={[{ required: true, message: "Vui lòng chọn phòng ban!" }]}
          >
            <Select placeholder="Chọn phòng ban" loading={departments.length === 0}>
              {departments.map((department) => (
                <Select.Option key={department._id} value={department._id}>
                  {department.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="role" label="Vai Trò" rules={[{ required: true, message: "Vui lòng chọn vai trò!" }]}>
            <Select placeholder="Chọn vai trò">
              {roles.map((role) => (
                <Select.Option key={role._id} value={role._id}>
                  {role.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Mô Tả">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Cập nhật
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => setIsModalVisible(false)}>
              Hủy
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal khôi phục */}
      <Modal
        title="Khôi phục người dùng"
        open={isRestoreModalVisible}
        onCancel={() => setIsRestoreModalVisible(false)}
        footer={null}
      >
        <Form form={restoreForm} onFinish={handleRestore} layout="vertical">
          <Form.Item
            name="role"
            label="Vai Trò"
            rules={[{ required: true, message: "Vui lòng chọn vai trò!" }]}
          >
            <Select placeholder="Chọn vai trò">
              {roles.map((role) => (
                <Select.Option key={role._id} value={role._id}>
                  {role.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Khôi phục
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => setIsRestoreModalVisible(false)}>
              Hủy
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserListPage;