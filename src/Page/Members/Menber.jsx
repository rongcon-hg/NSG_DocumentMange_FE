import { useState, useEffect, useRef } from "react";
import { Input, Button, Collapse, message, Form, Card, Switch, Divider, Avatar, Popconfirm } from "antd";
import { MailOutlined, FileTextOutlined, ScheduleOutlined, UploadOutlined, DeleteOutlined, UserOutlined } from "@ant-design/icons";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getUserInfo, updateUserInfo, uploadAvatarApi, deleteAvatarApi } from "../../api/auth";
import { useNotificationContext } from "../../context/NotificationContext";
import GoogleAuthButton from "../../components/GoogleAuthButton";
const { Panel } = Collapse;

const Member = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [userData, setUserData] = useState(null);
    const [userRole, setUserRole] = useState(null); // Store user role
    const { avatarUrl, setAvatarUrl } = useNotificationContext();
    const fileInputRef = useRef(null);

    // Hàm lấy userId và role từ token
    const getUserInfoFromToken = () => {
        const token = Cookies.get("accessToken");
        if (!token) {
            message.error("Không tìm thấy token, vui lòng đăng nhập lại");
            return null;
        }

        try {
            const decodedToken = jwtDecode(token);
            const userId = decodedToken.userId || decodedToken.id || decodedToken.sub;
            const role = decodedToken.role || null; // Assuming role is included in the token
            return { userId, role };
        } catch (error) {
            message.error("Token không hợp lệ");
            console.error("Error decoding token:", error);
            return null;
        }
    };

    // Hàm lấy thông tin người dùng
    const fetchUserInfo = async (userId) => {
        if (!userId) return;

        try {
            setLoading(true);
            const response = await getUserInfo(userId);
            if (response.success) {
                setUserData(response.data);
                // Optionally, set role from API response if not in token
                setUserRole(response.data.role || userRole);
                const emailNotifs = response.data.emailNotifications || {};
                form.setFieldsValue({
                    name: response.data.name,
                    email: response.data.email,
                    mobile: response.data.mobile,
                    positionName: response.data.position?.positionName || "Chưa xác định",
                    departmentName: response.data.department?.departmentName || "Chưa xác định",
                    password: "",
                    confirmPassword: "",
                    docNew: emailNotifs.docNew !== false,
                    docReview: emailNotifs.docReview !== false,
                    taskAssign: emailNotifs.taskAssign !== false,
                    taskReminder: emailNotifs.taskReminder !== false,
                });

                if (response.data.avatar?.fileId) {
                    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8081";
                    setAvatarUrl(`${API_URL}/authen/avatar/${response.data.avatar.fileId}`);
                } else {
                    setAvatarUrl(null);
                }
            } else {
                message.error(response.message || "Không lấy được thông tin người dùng");
            }
        } catch (error) {
            message.error("Lỗi khi lấy thông tin người dùng");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Hàm cập nhật trạng thái bật/tắt email tức thì khi nhấn Switch
    const handleToggleNotification = async (key, checked) => {
        form.setFieldsValue({ [key]: checked });
        const userInfo = getUserInfoFromToken();
        if (!userInfo || !userInfo.userId) return;

        try {
            const res = await updateUserInfo(userInfo.userId, {
                emailNotifications: {
                    [key]: checked,
                },
            });
            if (res.success) {
                message.success(checked ? "Đã bật nhận email này" : "Đã tắt nhận email này");
            }
        } catch (err) {
            console.error("Lỗi lưu cài đặt email:", err);
            message.error("Lỗi khi lưu cài đặt email");
        }
    };

    // Hàm xử lý upload ảnh đại diện
    const handleAvatarFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            message.error("Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WEBP, GIF)!");
            return;
        }

        if (file.size / 1024 / 1024 > 5) {
            message.error("Kích thước hình ảnh phải nhỏ hơn 5MB!");
            return;
        }

        const formData = new FormData();
        formData.append("avatar", file);

        try {
            setAvatarLoading(true);
            const res = await uploadAvatarApi(formData);
            if (res.success && res.data?.fileId) {
                const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8081";
                const newAvatarUrl = `${API_URL}/authen/avatar/${res.data.fileId}?t=${Date.now()}`;
                setAvatarUrl(newAvatarUrl);
                message.success("Cập nhật ảnh đại diện thành công!");
                const userInfo = getUserInfoFromToken();
                if (userInfo?.userId) fetchUserInfo(userInfo.userId);
            } else {
                message.error(res.message || "Tải ảnh đại diện thất bại!");
            }
        } catch (err) {
            console.error("Lỗi upload avatar:", err);
            message.error(typeof err === "string" ? err : "Lỗi khi tải ảnh đại diện lên Google Drive!");
        } finally {
            setAvatarLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // Hàm xóa ảnh đại diện
    const handleDeleteAvatar = async () => {
        try {
            setAvatarLoading(true);
            const res = await deleteAvatarApi();
            if (res.success) {
                setAvatarUrl(null);
                message.success("Đã xóa ảnh đại diện!");
                const userInfo = getUserInfoFromToken();
                if (userInfo?.userId) fetchUserInfo(userInfo.userId);
            } else {
                message.error(res.message || "Xóa ảnh đại diện thất bại!");
            }
        } catch (err) {
            console.error("Lỗi xóa avatar:", err);
            message.error(typeof err === "string" ? err : "Lỗi khi xóa ảnh đại diện!");
        } finally {
            setAvatarLoading(false);
        }
    };

    // Hàm cập nhật thông tin người dùng
    const handleUpdate = async (values) => {
        const { userId } = getUserInfoFromToken();
        if (!userId) return;

        try {
            setLoading(true);
            const updatedData = {
                name: values.name,
                email: values.email,
                mobile: values.mobile,
                password: values.password || undefined,
                emailNotifications: {
                    docNew: values.docNew,
                    docReview: values.docReview,
                    taskAssign: values.taskAssign,
                    taskReminder: values.taskReminder,
                },
            };

            const response = await updateUserInfo(userId, updatedData);
            if (response.success) {
                message.success("Cập nhật thông tin thành công!");
                fetchUserInfo(userId);
            } else {
                message.error(response.message || "Cập nhật thông tin thất bại");
            }
        } catch (error) {
            message.error(error || "Lỗi khi cập nhật thông tin");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Lấy thông tin khi component mount
    useEffect(() => {
        const userInfo = getUserInfoFromToken();
        if (userInfo) {
            setUserRole(userInfo.role); // Set role from token
            fetchUserInfo(userInfo.userId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Reset form khi nhấn Hủy
    const handleCancel = () => {
        form.resetFields();
        const { userId } = getUserInfoFromToken();
        if (userId) {
            fetchUserInfo(userId);
        }
    };

    // Check if user is allowed to edit
    const canEdit = ["admin", "manager"].includes(userRole);

    return (
        <div className="h-screen bg-gray-100 flex justify-center items-center p-6">
            <div className="bg-white rounded-lg shadow-md w-full h-full p-8 overflow-y-auto">
                <h2 className="text-2xl font-semibold text-gray-800 mb-6">
                    Quản lý thông tin cá nhân
                </h2>

                <Form form={form} layout="vertical" onFinish={handleUpdate}>
                    <div className="flex flex-wrap">
                        <div className="flex-1">
                            {/* Khối Ảnh đại diện */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 mb-6 flex flex-col sm:flex-row items-center gap-6 shadow-sm">
                                <div className="relative group flex-shrink-0">
                                    <Avatar
                                        size={96}
                                        src={avatarUrl}
                                        icon={<UserOutlined />}
                                        style={{ backgroundColor: "#87d068" }}
                                        className="shadow-md border-4 border-white ring-2 ring-blue-400"
                                    />
                                </div>
                                <div className="flex-1 text-center sm:text-left">
                                    <h3 className="text-xl font-bold text-gray-800 mb-1">
                                        {userData?.name || "Người dùng"}
                                    </h3>
                                    <p className="text-sm text-gray-500 mb-4">
                                        {userData?.position?.positionName ? `${userData.position.positionName} — ` : ""}
                                        {userData?.department?.departmentName || "Thành viên"}
                                    </p>
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleAvatarFileChange}
                                        />
                                        <Button
                                            type="primary"
                                            icon={<UploadOutlined />}
                                            loading={avatarLoading}
                                            onClick={() => fileInputRef.current?.click()}
                                            className="bg-blue-600 hover:bg-blue-500"
                                        >
                                            Tải ảnh mới
                                        </Button>

                                        {avatarUrl && (
                                            <Popconfirm
                                                title="Xóa ảnh đại diện"
                                                description="Bạn có chắc chắn muốn xóa ảnh đại diện này không?"
                                                onConfirm={handleDeleteAvatar}
                                                okText="Xóa"
                                                cancelText="Hủy"
                                                okButtonProps={{ danger: true }}
                                            >
                                                <Button
                                                    danger
                                                    icon={<DeleteOutlined />}
                                                    loading={avatarLoading}
                                                >
                                                    Xóa ảnh
                                                </Button>
                                            </Popconfirm>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-2">
                                        Định dạng hỗ trợ: JPG, PNG, WEBP, GIF (Tối đa 5MB). Ảnh được lưu an toàn trên Google Drive của hệ thống.
                                    </div>
                                </div>
                            </div>

                            <Collapse defaultActiveKey={["1"]} className="mb-6">
                                <Panel header="Thông tin tài khoản" key="1">
                                    <div className="grid grid-cols-2 gap-4">
                                        <Form.Item
                                            label="Tên hiển thị"
                                            name="name"
                                            rules={[{ required: true, message: "Vui lòng nhập tên!" }]}
                                        >
                                            <Input placeholder="Nhập tên hiển thị" disabled={loading || !canEdit} />
                                        </Form.Item>

                                        <Form.Item
                                            label="Tài khoản (Email)"
                                            name="email"
                                            rules={[
                                                { required: true, message: "Vui lòng nhập email!" },
                                                { type: "email", message: "Email không hợp lệ!" },
                                            ]}
                                        >
                                            <Input placeholder="Nhập email" disabled={loading || !canEdit} />
                                        </Form.Item>

                                        <Form.Item
                                            label="Chức vụ/Vị trí công tác"
                                            name="positionName"
                                        >
                                            <Input disabled value={userData?.position?.positionName || "Chưa xác định"} />
                                        </Form.Item>

                                        <Form.Item
                                            label="Số điện thoại"
                                            name="mobile"
                                            rules={[
                                                { required: true, message: "Vui lòng nhập số điện thoại!" },
                                                { pattern: /^[0-9]{10}$/, message: "Số điện thoại phải có 10 chữ số!" },
                                            ]}
                                        >
                                            <Input placeholder="Nhập số điện thoại" disabled={loading} />
                                        </Form.Item>

                                        <Form.Item
                                            label="Phòng ban"
                                            name="departmentName"
                                        >
                                            <Input disabled value={userData?.department?.departmentName || "Chưa xác định"} />
                                        </Form.Item>

                                        <Form.Item
                                            label="Mật khẩu"
                                            name="password"
                                            rules={[
                                                { min: 6, message: "Mật khẩu phải có ít nhất 6 ký tự!" },
                                            ]}
                                        >
                                            <Input.Password placeholder="Nhập mật khẩu mới" disabled={loading} />
                                        </Form.Item>

                                        <Form.Item
                                            label="Nhập lại mật khẩu"
                                            name="confirmPassword"
                                            dependencies={["password"]}
                                            rules={[
                                                ({ getFieldValue }) => ({
                                                    validator(_, value) {
                                                        if (!value || getFieldValue("password") === value) {
                                                            return Promise.resolve();
                                                        }
                                                        return Promise.reject(new Error("Mật khẩu không khớp!"));
                                                    },
                                                }),
                                            ]}
                                        >
                                            <Input.Password placeholder="Nhập lại mật khẩu" disabled={loading} />
                                        </Form.Item>
                                    </div>
                                </Panel>
                            </Collapse>

                            {/* Google Authentication Section */}
                            <div className="mb-6">
                                <Card title="Kết nối Google Calendar" className="shadow-sm">
                                    <div className="text-center">
                                        <p className="text-gray-600 mb-4">
                                            Kết nối với Google Calendar để đồng bộ lịch làm việc
                                        </p>
                                        <GoogleAuthButton />
                                    </div>
                                </Card>
                            </div>

                            {/* Cài đặt nhận email thông báo */}
                            <div className="mb-6">
                                <Card 
                                    title={
                                        <div className="flex items-center gap-2 text-gray-800">
                                            <MailOutlined className="text-blue-500" />
                                            <span>Cài đặt nhận email thông báo</span>
                                        </div>
                                    } 
                                    className="shadow-sm border-gray-200"
                                >
                                    <p className="text-gray-500 mb-4 text-sm">
                                        Tùy chỉnh các loại email thông báo bạn muốn nhận về hộp thư cá nhân. Mặc định hệ thống sẽ gửi email cho tất cả các sự kiện bên dưới.
                                    </p>

                                    <div className="space-y-4">
                                        {/* Nhóm Văn bản */}
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <FileTextOutlined className="text-blue-600" /> Thông báo văn bản
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                                                    <div className="pr-3">
                                                        <div className="font-medium text-gray-800 text-sm">
                                                            Văn bản mới & Luân chuyển
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            Nhận email khi có văn bản mới được phát hành hoặc giao xử lý cho bạn / phòng ban
                                                        </div>
                                                    </div>
                                                    <Form.Item name="docNew" valuePropName="checked" className="mb-0">
                                                        <Switch 
                                                            checkedChildren="Bật" 
                                                            unCheckedChildren="Tắt" 
                                                            onChange={(checked) => handleToggleNotification("docNew", checked)}
                                                        />
                                                    </Form.Item>
                                                </div>

                                                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                                                    <div className="pr-3">
                                                        <div className="font-medium text-gray-800 text-sm">
                                                            Xét duyệt văn bản
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            Nhận email khi văn bản được trình BGH, hoặc khi có kết quả phê duyệt / từ chối
                                                        </div>
                                                    </div>
                                                    <Form.Item name="docReview" valuePropName="checked" className="mb-0">
                                                        <Switch 
                                                            checkedChildren="Bật" 
                                                            unCheckedChildren="Tắt" 
                                                            onChange={(checked) => handleToggleNotification("docReview", checked)}
                                                        />
                                                    </Form.Item>
                                                </div>
                                            </div>
                                        </div>

                                        <Divider className="my-2" />

                                        {/* Nhóm Công việc */}
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <ScheduleOutlined className="text-green-600" /> Thông báo công việc (Task)
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                                                    <div className="pr-3">
                                                        <div className="font-medium text-gray-800 text-sm">
                                                            Giao việc & Cập nhật tiến độ
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            Nhận email khi bạn được phân công việc mới hoặc trạng thái công việc thay đổi
                                                        </div>
                                                    </div>
                                                    <Form.Item name="taskAssign" valuePropName="checked" className="mb-0">
                                                        <Switch 
                                                            checkedChildren="Bật" 
                                                            unCheckedChildren="Tắt" 
                                                            onChange={(checked) => handleToggleNotification("taskAssign", checked)}
                                                        />
                                                    </Form.Item>
                                                </div>

                                                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                                                    <div className="pr-3">
                                                        <div className="font-medium text-gray-800 text-sm">
                                                            Nhắc nhở hạn công việc
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            Nhận email cảnh báo công việc sắp đến hạn, đến hạn trong ngày hoặc quá hạn
                                                        </div>
                                                    </div>
                                                    <Form.Item name="taskReminder" valuePropName="checked" className="mb-0">
                                                        <Switch 
                                                            checkedChildren="Bật" 
                                                            unCheckedChildren="Tắt" 
                                                            onChange={(checked) => handleToggleNotification("taskReminder", checked)}
                                                        />
                                                    </Form.Item>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>


                                <div className="flex justify-end gap-4">
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        className="bg-blue-500"
                                        size="large"
                                        loading={loading}
                                    >
                                        Lưu
                                    </Button>
                                    <Button
                                        danger
                                        size="large"
                                        onClick={handleCancel}
                                        disabled={loading}
                                    >
                                        Hủy
                                    </Button>
                                </div>
                      
                        </div>
                    </div>
                </Form>

            </div>
        </div>
    );
};

export default Member;