import { useState, useEffect, useRef } from "react";
import { Input, Button, Collapse, message, Form, Card, Switch, Divider, Avatar, Popconfirm } from "antd";
import { MailOutlined, FileTextOutlined, ScheduleOutlined, UploadOutlined, DeleteOutlined, UserOutlined, TrophyOutlined, BookOutlined, AuditOutlined, BgColorsOutlined, CheckCircleFilled, UndoOutlined } from "@ant-design/icons";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getUserInfo, updateUserInfo, uploadAvatarApi, deleteAvatarApi } from "../../api/auth";
import { useNotificationContext } from "../../context/NotificationContext";
import { useTheme, THEME_PRESETS, DEFAULT_THEME } from "../../context/ThemeContext";
import GoogleAuthButton from "../../components/GoogleAuthButton";
import { formatFileName } from "../../utils/formatFileName";
import { useNavigate } from "react-router-dom";
const { Panel } = Collapse;

const Member = () => {
    const navigate = useNavigate();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [userData, setUserData] = useState(null);
    const [userRole, setUserRole] = useState(null); // Store user role
    const { avatarUrl, setAvatarUrl } = useNotificationContext();
    const { theme, applyPreset, applyCustomTheme, resetToDefault, presets } = useTheme();
    const [currentPreset, setCurrentPreset] = useState(theme?.preset || "blue_ocean");
    const [customHeader, setCustomHeader] = useState(theme?.headerBg || DEFAULT_THEME.headerBg);
    const [customSidebar, setCustomSidebar] = useState(theme?.sidebarBg || DEFAULT_THEME.sidebarBg);
    const [themeSaving, setThemeSaving] = useState(false);
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
                    positionName: response.data.role === "admin" ? "Quản trị viên hệ thống" : (response.data.position?.positionName || "Chưa xác định"),
                    departmentName: response.data.role === "admin" ? "Quản trị hệ thống" : (response.data.department?.departmentName || "Chưa xác định"),
                    password: "",
                    confirmPassword: "",
                    docNew: emailNotifs.docNew !== false,
                    replyDocSubmit: emailNotifs.replyDocSubmit !== undefined ? emailNotifs.replyDocSubmit !== false : (emailNotifs.docReview !== false),
                    replyDocStatus: emailNotifs.replyDocStatus !== undefined ? emailNotifs.replyDocStatus !== false : (emailNotifs.docReview !== false),
                    taskAssign: emailNotifs.taskAssign !== false,
                    taskReminder: emailNotifs.taskReminder !== false,
                    emulationRegister: emailNotifs.emulationRegister !== false,
                    trainingRegister: emailNotifs.trainingRegister !== false,
                    onlineRecordSubmit: emailNotifs.onlineRecordSubmit !== false,
                    onlineRecordStatus: emailNotifs.onlineRecordStatus !== false,
                });

                if (response.data.themePreference) {
                    const pref = response.data.themePreference;
                    if (pref.preset) setCurrentPreset(pref.preset);
                    if (pref.headerBg) setCustomHeader(pref.headerBg);
                    if (pref.sidebarBg) setCustomSidebar(pref.sidebarBg);
                }

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
        formData.append("avatar", file, formatFileName(file.name || "avatar.png"));

        try {
            setAvatarLoading(true);
            const res = await uploadAvatarApi(formData);
            const avatarData = res?.data || res?.avatar;
            const fileId = avatarData?.fileId;
            if (res?.success && fileId) {
                const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8081";
                const newAvatarUrl = `${API_URL}/authen/avatar/${fileId}?t=${Date.now()}`;
                setAvatarUrl(newAvatarUrl);
                message.success("Cập nhật ảnh đại diện thành công!");
                const userInfo = getUserInfoFromToken();
                if (userInfo?.userId) fetchUserInfo(userInfo.userId);
            } else if (res?.success) {
                message.success("Cập nhật ảnh đại diện thành công!");
                const userInfo = getUserInfoFromToken();
                if (userInfo?.userId) fetchUserInfo(userInfo.userId);
            } else {
                message.error(res?.message || "Tải ảnh đại diện thất bại!");
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

    // Hàm xử lý chọn Preset màu sắc
    const handleSelectPreset = (presetKey) => {
        setCurrentPreset(presetKey);
        if (presetKey === "custom") {
            applyCustomTheme(customHeader, customSidebar);
        } else {
            applyPreset(presetKey);
            const found = presets.find((p) => p.key === presetKey);
            if (found) {
                setCustomHeader(found.headerBg);
                setCustomSidebar(found.sidebarBg);
            }
        }
    };

    // Hàm đổi màu Header tùy chỉnh
    const handleCustomHeaderChange = (val) => {
        setCustomHeader(val);
        setCurrentPreset("custom");
        applyCustomTheme(val, customSidebar);
    };

    // Hàm đổi màu Sidebar tùy chỉnh
    const handleCustomSidebarChange = (val) => {
        setCustomSidebar(val);
        setCurrentPreset("custom");
        applyCustomTheme(customHeader, val);
    };

    // Chuẩn bị payload theme để lưu
    const getThemePayload = () => {
        if (currentPreset === "custom") {
            return {
                preset: "custom",
                headerBg: customHeader,
                sidebarBg: customSidebar,
            };
        }
        const found = presets.find((p) => p.key === currentPreset);
        return {
            preset: currentPreset,
            headerBg: found ? found.headerBg : DEFAULT_THEME.headerBg,
            sidebarBg: found ? found.sidebarBg : DEFAULT_THEME.sidebarBg,
        };
    };

    // Lưu riêng cấu hình màu giao diện
    const handleSaveThemeOnly = async () => {
        const userInfo = getUserInfoFromToken();
        if (!userInfo || !userInfo.userId) return;
        try {
            setThemeSaving(true);
            const payload = getThemePayload();
            const res = await updateUserInfo(userInfo.userId, { themePreference: payload });
            if (res.success) {
                message.success("Đã lưu màu sắc giao diện cá nhân thành công!");
            } else {
                message.error(res.message || "Lưu giao diện thất bại");
            }
        } catch (e) {
            console.error("Lỗi lưu theme:", e);
            message.error("Lỗi khi lưu màu sắc giao diện");
        } finally {
            setThemeSaving(false);
        }
    };

    // Khôi phục màu giao diện mặc định
    const handleResetTheme = async () => {
        resetToDefault();
        setCurrentPreset("blue_ocean");
        setCustomHeader(DEFAULT_THEME.headerBg);
        setCustomSidebar(DEFAULT_THEME.sidebarBg);
        const userInfo = getUserInfoFromToken();
        if (userInfo?.userId) {
            try {
                setThemeSaving(true);
                await updateUserInfo(userInfo.userId, { themePreference: DEFAULT_THEME });
                message.success("Đã khôi phục màu sắc giao diện mặc định!");
            } catch (e) {
                console.error("Lỗi reset theme:", e);
            } finally {
                setThemeSaving(false);
            }
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
                themePreference: getThemePayload(),
                emailNotifications: {
                    docNew: values.docNew,
                    replyDocSubmit: values.replyDocSubmit,
                    replyDocStatus: values.replyDocStatus,
                    docReview: values.replyDocSubmit || values.replyDocStatus,
                    taskAssign: values.taskAssign,
                    taskReminder: values.taskReminder,
                    emulationRegister: values.emulationRegister,
                    trainingRegister: values.trainingRegister,
                    onlineRecordSubmit: values.onlineRecordSubmit,
                    onlineRecordStatus: values.onlineRecordStatus,
                },
            };

            const response = await updateUserInfo(userId, updatedData);
            if (response.success) {
                message.success("Cập nhật thông tin thành công!");
                if (values.name && values.name !== Cookies.get("currentUser")) {
                    Cookies.set("currentUser", values.name);
                    window.dispatchEvent(new Event("storage"));
                }
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

    // Đóng và chuyển sang trang Dashboard
    const handleClose = () => {
        navigate("/dashboard");
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
                                        {userData?.role === "admin" 
                                            ? "Quản trị viên hệ thống — Quản trị hệ thống" 
                                            : `${userData?.position?.positionName ? `${userData.position.positionName} — ` : ""}${userData?.department?.departmentName || "Thành viên"}`}
                                    </p>
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept="image/*"
                                            style={{ display: "none" }}
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
                                            <Input disabled value={userData?.role === "admin" ? "Quản trị viên hệ thống" : (userData?.position?.positionName || "Chưa xác định")} />
                                        </Form.Item>

                                        <Form.Item
                                            label="Số điện thoại"
                                            name="mobile"
                                            rules={[
                                                { pattern: /^[0-9]{10}$/, message: "Số điện thoại phải có 10 chữ số!" },
                                            ]}
                                        >
                                            <Input placeholder="Nhập số điện thoại" disabled={loading} />
                                        </Form.Item>

                                        <Form.Item
                                            label="Phòng ban"
                                            name="departmentName"
                                        >
                                            <Input disabled value={userData?.role === "admin" ? "Quản trị hệ thống" : (userData?.department?.departmentName || "Chưa xác định")} />
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
                                                <FileTextOutlined className="text-blue-600" /> Thông báo văn bản & trình ký
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors md:col-span-2">
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
                                                            Gửi văn bản trình ký
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            Nhận email khi có văn bản trình ký mới gửi đến bạn / Ban Giám hiệu xét duyệt
                                                        </div>
                                                    </div>
                                                    <Form.Item name="replyDocSubmit" valuePropName="checked" className="mb-0">
                                                        <Switch 
                                                            checkedChildren="Bật" 
                                                            unCheckedChildren="Tắt" 
                                                            onChange={(checked) => handleToggleNotification("replyDocSubmit", checked)}
                                                        />
                                                    </Form.Item>
                                                </div>

                                                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                                                    <div className="pr-3">
                                                        <div className="font-medium text-gray-800 text-sm">
                                                            Trạng thái văn bản trình ký
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            Nhận email khi văn bản trình ký được phê duyệt, từ chối hoặc có phản hồi xét duyệt
                                                        </div>
                                                    </div>
                                                    <Form.Item name="replyDocStatus" valuePropName="checked" className="mb-0">
                                                        <Switch 
                                                            checkedChildren="Bật" 
                                                            unCheckedChildren="Tắt" 
                                                            onChange={(checked) => handleToggleNotification("replyDocStatus", checked)}
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

                                        <Divider className="my-2" />

                                        {/* Nhóm Đề nghị thi đua */}
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <TrophyOutlined className="text-amber-500" /> Thông báo Thi đua - Khen thưởng
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors md:col-span-2">
                                                    <div className="pr-3">
                                                        <div className="font-medium text-gray-800 text-sm">
                                                            Đề nghị thi đua & Xét duyệt danh hiệu
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            Nhận email khi có hồ sơ đề nghị thi đua mới (Quản lý) hoặc khi trạng thái hồ sơ được Quản lý / Hiệu trưởng xét duyệt, cập nhật
                                                        </div>
                                                    </div>
                                                    <Form.Item name="emulationRegister" valuePropName="checked" className="mb-0">
                                                        <Switch 
                                                            checkedChildren="Bật" 
                                                            unCheckedChildren="Tắt" 
                                                            onChange={(checked) => handleToggleNotification("emulationRegister", checked)}
                                                        />
                                                    </Form.Item>
                                                </div>
                                            </div>
                                        </div>

                                        <Divider className="my-2" />

                                        {/* Nhóm Đào tạo - Bồi dưỡng */}
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <BookOutlined className="text-blue-500" /> Thông báo Đào tạo - Bồi dưỡng
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors md:col-span-2">
                                                    <div className="pr-3">
                                                        <div className="font-medium text-gray-800 text-sm">
                                                            Đăng ký học tập bồi dưỡng & Xét duyệt, báo cáo kết quả
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            Nhận email khi có hồ sơ đăng ký bồi dưỡng mới (Quản lý) hoặc khi trạng thái hồ sơ được xét duyệt, cập nhật báo cáo kết quả
                                                        </div>
                                                    </div>
                                                    <Form.Item name="trainingRegister" valuePropName="checked" className="mb-0">
                                                        <Switch 
                                                            checkedChildren="Bật" 
                                                            unCheckedChildren="Tắt" 
                                                            onChange={(checked) => handleToggleNotification("trainingRegister", checked)}
                                                        />
                                                    </Form.Item>
                                                </div>
                                            </div>
                                        </div>

                                        <Divider className="my-2" />

                                        {/* Nhóm Hồ sơ trực tuyến */}
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <AuditOutlined className="text-teal-600" /> Thông báo hồ sơ trực tuyến
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                                                    <div className="pr-3">
                                                        <div className="font-medium text-gray-800 text-sm">
                                                            Gửi hồ sơ trực tuyến
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            Nhận email khi có hồ sơ trực tuyến mới gửi đến bạn hoặc đơn vị tiếp nhận xử lý
                                                        </div>
                                                    </div>
                                                    <Form.Item name="onlineRecordSubmit" valuePropName="checked" className="mb-0">
                                                        <Switch 
                                                            checkedChildren="Bật" 
                                                            unCheckedChildren="Tắt" 
                                                            onChange={(checked) => handleToggleNotification("onlineRecordSubmit", checked)}
                                                        />
                                                    </Form.Item>
                                                </div>

                                                <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                                                    <div className="pr-3">
                                                        <div className="font-medium text-gray-800 text-sm">
                                                            Trạng thái hồ sơ trực tuyến
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-0.5">
                                                            Nhận email khi hồ sơ của bạn được tiếp nhận, phê duyệt hoặc từ chối / yêu cầu bổ sung
                                                        </div>
                                                    </div>
                                                    <Form.Item name="onlineRecordStatus" valuePropName="checked" className="mb-0">
                                                        <Switch 
                                                            checkedChildren="Bật" 
                                                            unCheckedChildren="Tắt" 
                                                            onChange={(checked) => handleToggleNotification("onlineRecordStatus", checked)}
                                                        />
                                                    </Form.Item>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>

                            {/* Cài đặt màu sắc giao diện cá nhân hóa */}
                            <div className="mb-6">
                                <Card 
                                    title={
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-1">
                                            <div className="flex items-center gap-2 text-gray-800">
                                                <BgColorsOutlined className="text-purple-600 text-lg" />
                                                <span className="font-semibold">Cá nhân hóa giao diện (Màu sắc Header & Menu)</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="small"
                                                    icon={<UndoOutlined />}
                                                    onClick={handleResetTheme}
                                                    loading={themeSaving}
                                                >
                                                    Khôi phục mặc định
                                                </Button>
                                                <Button
                                                    size="small"
                                                    type="primary"
                                                    icon={<CheckCircleFilled />}
                                                    loading={themeSaving}
                                                    onClick={handleSaveThemeOnly}
                                                    className="bg-purple-600 hover:bg-purple-500"
                                                >
                                                    Lưu màu giao diện
                                                </Button>
                                            </div>
                                        </div>
                                    }
                                    className="shadow-sm border-gray-200"
                                >
                                    <p className="text-gray-500 mb-4 text-sm">
                                        Tùy biến phong cách màu sắc cho thanh điều hướng trên cùng (Header) và thanh menu bên trái (slidermenu) cho riêng bạn. Khi nhấp chọn, giao diện sẽ đổi màu trực tiếp ngay lập tức.
                                    </p>

                                    {/* Live Mini Preview */}
                                    <div className="mb-6 p-4 rounded-xl bg-slate-100 border border-slate-200">
                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                                            <span>Xem trước màu sắc trực tiếp (Mini Preview)</span>
                                            <span className="text-purple-600 font-medium normal-case">
                                                Bộ màu: {presets.find(p => p.key === currentPreset)?.name || "Tự chọn"}
                                            </span>
                                        </div>
                                        <div className="w-full h-32 rounded-lg overflow-hidden border border-slate-300 shadow-md flex flex-col bg-white">
                                            {/* Header Preview */}
                                            <div 
                                                className="h-10 px-3 flex items-center justify-between transition-all duration-300"
                                                style={{ background: currentPreset === "custom" ? customHeader : (presets.find(p => p.key === currentPreset)?.headerBg || theme.headerBg) }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded bg-white/20 flex items-center justify-center text-[10px] text-white font-bold">
                                                        NSG
                                                    </div>
                                                    <span className="text-white text-xs font-semibold tracking-tight">HỆ THỐNG VĂN PHÒNG SỐ</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full bg-white/30" />
                                                    <div className="w-5 h-5 rounded-full bg-white/40" />
                                                </div>
                                            </div>
                                            {/* Body Preview with Sidebar */}
                                            <div className="flex-1 flex overflow-hidden">
                                                <div 
                                                    className="w-36 p-2 flex flex-col gap-1.5 transition-all duration-300"
                                                    style={{ background: currentPreset === "custom" ? customSidebar : (presets.find(p => p.key === currentPreset)?.sidebarBg || theme.sidebarBg) }}
                                                >
                                                    <div className="h-4 rounded bg-white/25 flex items-center px-2">
                                                        <div className="w-2 h-2 rounded-full bg-white/60 mr-1.5" />
                                                        <div className="w-16 h-1.5 rounded bg-white/80" />
                                                    </div>
                                                    <div className="h-4 rounded bg-white/10 flex items-center px-2">
                                                        <div className="w-2 h-2 rounded-full bg-white/40 mr-1.5" />
                                                        <div className="w-12 h-1.5 rounded bg-white/60" />
                                                    </div>
                                                    <div className="h-4 rounded bg-white/10 flex items-center px-2">
                                                        <div className="w-2 h-2 rounded-full bg-white/40 mr-1.5" />
                                                        <div className="w-14 h-1.5 rounded bg-white/60" />
                                                    </div>
                                                </div>
                                                <div className="flex-1 bg-slate-50 p-3 flex flex-col justify-center items-center text-center">
                                                    <span className="text-xs font-medium text-slate-600">Nội dung trang làm việc</span>
                                                    <span className="text-[11px] text-slate-400">Thanh Header & Menu sẽ áp dụng bảng màu này</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Danh sách các bộ màu Preset */}
                                    <div className="mb-4">
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                            Chọn bộ màu có sẵn (Presets)
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {presets.filter(p => p.key !== "custom").map((p) => {
                                                const isSelected = currentPreset === p.key;
                                                return (
                                                    <div
                                                        key={p.key}
                                                        onClick={() => handleSelectPreset(p.key)}
                                                        className={`relative cursor-pointer rounded-xl p-3 border-2 transition-all duration-200 hover:shadow-md ${
                                                            isSelected 
                                                                ? "border-purple-600 bg-purple-50/40 shadow-sm" 
                                                                : "border-gray-200 hover:border-gray-300 bg-white"
                                                        }`}
                                                    >
                                                        {isSelected && (
                                                            <div className="absolute top-2 right-2 text-purple-600">
                                                                <CheckCircleFilled className="text-base" />
                                                            </div>
                                                        )}
                                                        <div className="font-semibold text-sm text-gray-800 mb-0.5 pr-5">
                                                            {p.name}
                                                        </div>
                                                        <div className="text-[11px] text-gray-500 mb-2.5 line-clamp-1">
                                                            {p.desc}
                                                        </div>
                                                        {/* Color bar preview */}
                                                        <div className="h-8 rounded-lg overflow-hidden border border-gray-200 flex shadow-inner">
                                                            <div 
                                                                className="w-1/3 h-full" 
                                                                style={{ background: p.sidebarBg }}
                                                                title="Màu Menu bên trái" 
                                                            />
                                                            <div 
                                                                className="w-2/3 h-full" 
                                                                style={{ background: p.headerBg }} 
                                                                title="Màu Header trên cùng"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Chế độ Tự chọn màu (Custom) */}
                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                        <div 
                                            onClick={() => handleSelectPreset("custom")}
                                            className={`cursor-pointer rounded-xl p-3.5 border-2 transition-all duration-200 ${
                                                currentPreset === "custom" 
                                                    ? "border-purple-600 bg-purple-50/40" 
                                                    : "border-gray-200 hover:border-gray-300 bg-white"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <span className="font-semibold text-sm text-gray-800">
                                                        🎨 Tự chọn màu sắc riêng (Tùy biến cao cấp)
                                                    </span>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        Chọn màu mã Hex hoặc chọn từ bảng màu riêng cho thanh Header và Sidebar.
                                                    </p>
                                                </div>
                                                {currentPreset === "custom" && (
                                                    <div className="text-purple-600">
                                                        <CheckCircleFilled className="text-base" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                                {/* Header Color Picker */}
                                                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200" onClick={(e) => e.stopPropagation()}>
                                                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                                                        Màu thanh Header (Trên cùng):
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="color"
                                                            value={customHeader?.startsWith("#") ? customHeader : "#0a2540"}
                                                            onChange={(e) => handleCustomHeaderChange(e.target.value)}
                                                            className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                                                        />
                                                        <Input
                                                            value={customHeader}
                                                            onChange={(e) => handleCustomHeaderChange(e.target.value)}
                                                            placeholder="Mã màu Hex hoặc gradient..."
                                                            className="text-xs font-mono"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Sidebar Color Picker */}
                                                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200" onClick={(e) => e.stopPropagation()}>
                                                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                                                        Màu thanh Menu (Bên trái):
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="color"
                                                            value={customSidebar?.startsWith("#") ? customSidebar : "#0f335a"}
                                                            onChange={(e) => handleCustomSidebarChange(e.target.value)}
                                                            className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0.5 bg-white"
                                                        />
                                                        <Input
                                                            value={customSidebar}
                                                            onChange={(e) => handleCustomSidebarChange(e.target.value)}
                                                            placeholder="Mã màu Hex hoặc gradient..."
                                                            className="text-xs font-mono"
                                                        />
                                                    </div>
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
                                        size="large"
                                        onClick={handleClose}
                                        disabled={loading}
                                    >
                                        Đóng
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