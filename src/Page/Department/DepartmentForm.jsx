import { useEffect, useState } from "react";
import { Table, Modal, Form, Input, Button, message, Popconfirm, Tooltip } from "antd";
import { TeamOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { getAllDepartments, createDepartment, deleteDepartment, updateDepartment, getUsersByDepartment } from "../../api/DepartmentAPI";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { removeVietnameseTones } from "../../utils/stringUtils";

const DepartmentPage = () => {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
    const [form] = Form.useForm();
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [users, setUsers] = useState([]);
    const [currentUserRole, setCurrentUserRole] = useState("");
    const [searchText, setSearchText] = useState("");
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 20,
        pageSizeOptions: ['10', '20', '50', '100'],
    });

    const filteredDepartments = departments.filter((dept) => {
        const searchLower = removeVietnameseTones(searchText.toLowerCase());
        return (
            (dept.departmentCode && removeVietnameseTones(dept.departmentCode.toLowerCase()).includes(searchLower)) ||
            (dept.departmentName && removeVietnameseTones(dept.departmentName.toLowerCase()).includes(searchLower))
        );
    });

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

    // Fetch all departments from API
    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        setLoading(true);
        try {
            const result = await getAllDepartments();
            setDepartments(result.AllDepartment);
        } catch {
            message.error("Lỗi khi lấy dữ liệu phòng ban");
            window.location.reload();
        } finally {
            setLoading(false);
        }
    };

    const fetchUsersByDepartment = async (departmentId) => {
        try {
            setLoading(true);
            const result = await getUsersByDepartment(departmentId);
            setUsers(Array.isArray(result) ? result : []);
            setIsUsersModalOpen(true);
        // eslint-disable-next-line no-unused-vars
        } catch (error) {
            message.error("Lỗi khi lấy danh sách user");
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDepartment = async (values) => {
        try {
            await createDepartment(values);
            message.success("Tạo phòng ban thành công!");
            setIsModalOpen(false);
            form.resetFields();
            fetchDepartments();
        } catch {
            message.error("Tạo phòng ban thất bại");
        }
    };

    const handleUpdateDepartment = async (values) => {
        try {
            await updateDepartment({ ...values, departmentID: selectedDepartment._id });
            message.success("Cập nhật phòng ban thành công!");
            setIsEditModalOpen(false);
            setSelectedDepartment(null);
            fetchDepartments();
        } catch {
            message.error("Cập nhật phòng ban thất bại");
        }
    };

    const handleDeleteDepartment = async (departmentID) => {
        try {
            await deleteDepartment(departmentID);
            message.success("Xóa phòng ban thành công!");
            fetchDepartments();
        } catch {
            message.error("Xóa phòng ban thất bại");
        }
    };

    // Kiểm tra quyền xóa (chỉ admin)
    const hasDeletePermission = () => {
        return currentUserRole === "admin";
    };

    // Kiểm tra quyền chung (admin hoặc manager)
    const hasPermission = () => {
        return currentUserRole === "admin" || currentUserRole === "manager";
    };

    const columns = [
        {
            title: "STT",
            key: "stt",
            width: 60,
            align: "center",
            render: (text, record, index) => (pagination.current - 1) * pagination.pageSize + index + 1,
        },
        {
            title: "Mã Phòng Ban",
            dataIndex: "departmentCode",
            key: "departmentCode",
        },
        {
            title: "Tên Phòng Ban",
            dataIndex: "departmentName",
            key: "departmentName",
        },
        {
            title: "Số lượng người dùng",
            dataIndex: "userCount",
            key: "userCount",
            render: (userCount) => userCount || 0,
        },
        {
            title: "Hành Động",
            key: "actions",
            width: 150,
            fixed: "right",
            render: (_, record) =>
                hasPermission() && (
                    <div className="flex flex-wrap gap-2 justify-center">
                        <Tooltip title="Danh sách thành viên">
                            <Button
                                type="primary"
                                icon={<TeamOutlined />}
                                onClick={() => fetchUsersByDepartment(record._id)}
                                className="rounded-md"
                            >
                                <span className="hidden sm:inline">Thành viên</span>
                            </Button>
                        </Tooltip>
                        <Tooltip title="Chỉnh sửa">
                            <Button
                                icon={<EditOutlined />}
                                onClick={() => {
                                    setSelectedDepartment(record);
                                    form.setFieldsValue({ departmentCode: record.departmentCode, departmentName: record.departmentName });
                                    setIsEditModalOpen(true);
                                }}
                                className="rounded-md"
                            >
                                <span className="hidden sm:inline">Sửa</span>
                            </Button>
                        </Tooltip>
                        {hasDeletePermission() && (
                            <Popconfirm
                                title="Bạn có chắc chắn muốn xóa phòng ban này không?"
                                onConfirm={() => handleDeleteDepartment(record._id)}
                                okText="Có"
                                cancelText="Không"
                            >
                                <Tooltip title="Xóa">
                                    <Button danger icon={<DeleteOutlined />} className="rounded-md">
                                        <span className="hidden sm:inline">Xóa</span>
                                    </Button>
                                </Tooltip>
                            </Popconfirm>
                        )}
                    </div>
                ),
        },
    ];

    const userColumns = [
        {
            title: "Họ tên",
            dataIndex: "name",
            key: "name",
        },
        {
            title: "Email",
            dataIndex: "email",
            key: "email",
        },
        {
            title: "Số điện thoại",
            dataIndex: "mobile",
            key: "mobile",
        },
        {
            title: "Vai trò",
            dataIndex: "role",
            key: "role",
        },
    ];

    return (
        <div className="p-2 sm:p-4 md:p-6 bg-gray-50 min-h-screen">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mb-3 sm:mb-4 md:mb-6">
                Quản lý Phòng Ban
            </h2>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                {hasPermission() ? (
                    <Button
                        type="primary"
                        onClick={() => setIsModalOpen(true)}
                        className="w-full sm:w-auto"
                    >
                        Thêm Phòng Ban
                    </Button>
                ) : <div />}
                <Input.Search
                    placeholder="Tìm kiếm mã hoặc tên phòng ban"
                    allowClear
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 250 }}
                />
            </div>

            <Table
                dataSource={filteredDepartments}
                columns={columns}
                rowKey="_id"
                loading={loading}
                pagination={{
                    current: pagination.current,
                    pageSize: pagination.pageSize,
                    pageSizeOptions: pagination.pageSizeOptions,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} phòng ban`,
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
                className="shadow-md rounded-lg overflow-hidden border border-gray-200"
            />

            {/* Modal Thêm Phòng Ban */}
            <Modal
                title="Thêm Phòng Ban Mới"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                footer={null}
                width="90%"
                style={{ maxWidth: 500 }}
            >
                <Form form={form} layout="vertical" onFinish={handleCreateDepartment}>
                    <Form.Item
                        label="Mã Phòng Ban"
                        name="departmentCode"
                        rules={[{ required: true, message: "Vui lòng nhập mã phòng ban!" }]}
                    >
                        <Input placeholder="Nhập mã phòng ban" />
                    </Form.Item>
                    <Form.Item
                        label="Tên Phòng Ban"
                        name="departmentName"
                        rules={[{ required: true, message: "Vui lòng nhập tên phòng ban!" }]}
                    >
                        <Input placeholder="Nhập tên phòng ban" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" style={{ width: "100%" }}>
                            Tạo
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Modal Chỉnh Sửa Phòng Ban */}
            <Modal
                title="Chỉnh Sửa Phòng Ban"
                open={isEditModalOpen}
                onCancel={() => setIsEditModalOpen(false)}
                footer={null}
                width="90%"
                style={{ maxWidth: 500 }}
            >
                <Form form={form} layout="vertical" onFinish={handleUpdateDepartment}>
                    <Form.Item
                        label="Mã Phòng Ban"
                        name="departmentCode"
                        rules={[{ required: true, message: "Vui lòng nhập mã phòng ban!" }]}
                    >
                        <Input placeholder="Nhập mã phòng ban" />
                    </Form.Item>
                    <Form.Item
                        label="Tên Phòng Ban"
                        name="departmentName"
                        rules={[{ required: true, message: "Vui lòng nhập tên phòng ban!" }]}
                    >
                        <Input placeholder="Nhập tên phòng ban" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" style={{ width: "100%" }}>
                            Cập Nhật
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Modal Hiển Thị Users */}
            <Modal
                title="Danh sách thành viên trong phòng Ban"
                open={isUsersModalOpen}
                onCancel={() => setIsUsersModalOpen(false)}
                footer={null}
                width="90%"
                style={{ maxWidth: 800 }}
            >
                <Table
                    dataSource={users}
                    columns={userColumns}
                    rowKey="_id"
                    loading={loading}
                    pagination={{ 
                        pageSize: 10,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} thành viên`,
                        size: "small",
                        responsive: true,
                    }}
                    scroll={{ x: 600 }}
                    size="small"
                />
            </Modal>
        </div>
    );
};

export default DepartmentPage;