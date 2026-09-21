/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { Menu, Badge, Button, Popover, Drawer } from "antd";
import { DashboardOutlined, FileTextOutlined, TeamOutlined, AppstoreAddOutlined, MenuFoldOutlined, MenuUnfoldOutlined, EditOutlined, ProjectOutlined, LineChartOutlined, BellOutlined, BarChartOutlined, CloseOutlined, TrophyOutlined, ReadOutlined, AuditOutlined, GlobalOutlined, LinkOutlined, CalendarOutlined } from "@ant-design/icons";
import { Link, useLocation } from "react-router-dom";
import { useNotificationContext } from "../../context/NotificationContext.jsx";
import { getPendingRepliesForRecipient, getInReviewReplyCount } from "../../api/repliedDocApi.js";
import { getDeadlineStatusCounts } from "../../api/documentApi.js";
import { getUserInfo } from "../../api/auth.js";
import { isBghUser } from "../../utils/userClassification.js";
import { getExternalMenusApi } from "../../api/externalMenuApi.js";
import { getPendingWorkScheduleCount } from "../../api/workScheduleApi.js";
import { useTheme } from "../../context/ThemeContext.jsx";
import citySkyline from "../../assets/sidebar-city-skyline.png";
import "./bell.css";
import PWAInstallAndNotify from "../../components/PWA/PWAInstallAndNotify.jsx";
import PropTypes from "prop-types";

const Sidebar = ({ mobileOpen, onMobileClose, onMenuItemClick }) => {
  const location = useLocation();
  const [openKeys, setOpenKeys] = useState([]);
  const { 
    unreadDocCount, 
    myPendingReplyCount, 
    userRole, 
    userId, 
    todoTaskCount, 
    inProgressTaskCount, 
    emulationCounts,
    trainingPendingCount,
    onlineRecordPendingCount,
    workSchedulePendingCount: contextWorkScheduleCount,
  } = useNotificationContext();
  const { theme } = useTheme();
  const [totalPendingReplies, setTotalPendingReplies] = useState(0);
  const [bghInReviewCount, setBghInReviewCount] = useState(0);
  const [deadlineCounts, setDeadlineCounts] = useState({ soonCount: 0, dueTodayCount: 0, overdueCount: 0 });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [userDepartmentCode, setUserDepartmentCode] = useState(null);
  const [externalMenus, setExternalMenus] = useState([]);
  const [workSchedulePendingCount, setWorkSchedulePendingCount] = useState(0);

  // Sync with context count
  useEffect(() => {
    if (contextWorkScheduleCount !== undefined) {
      setWorkSchedulePendingCount(contextWorkScheduleCount);
    }
  }, [contextWorkScheduleCount]);

  const isAdmin = userRole === "admin" || userRole === "manager" || currentUserData?.role === "admin" || currentUserData?.role === "manager";
  const isRealAdmin = userRole === "admin" || currentUserData?.role === "admin";
  const isManager = userRole === "manager" || currentUserData?.role === "manager";
  const isActualBGH = isBghUser(currentUserData) || userDepartmentCode === "BGH";
  const isBGH = isActualBGH || isAdmin;

  // Quyền phân loại người dùng:
  const isCapTruong =
    !isActualBGH &&
    !isAdmin &&
    (userRole === "captruong" ||
      userRole === "staff" ||
      currentUserData?.role === "captruong" ||
      currentUserData?.role === "staff" ||
      (currentUserData?.position?.positionName || "").toLowerCase().includes("trưởng"));

  const isCapPho =
    !isActualBGH &&
    !isAdmin &&
    !isCapTruong &&
    (userRole === "cappho" ||
      currentUserData?.role === "cappho" ||
      (!isActualBGH && (currentUserData?.position?.positionName || "").toLowerCase().includes("phó")));

  // Nhóm quyền GV-CV (Giáo viên - Chuyên viên / GV-VC):
  const isGvCv =
    userRole === "chuyenvien" ||
    currentUserData?.role === "chuyenvien" ||
    (!isActualBGH && !isAdmin && !isCapTruong && !isCapPho);

  const isChuyenVien = isGvCv;
  const isStaff = !isGvCv && ["staff", "cappho", "captruong"].includes(userRole);

  // Mọi vai trò đều có thể truy cập phân hệ Thi đua - Khen thưởng (để Thêm & Tra cứu thành tích)
  const canAccessEmulation = true;

  // Ban Giám hiệu và Chuyên viên không hiển thị menu "Đề nghị"
  const canSeeRegisterMenu = (isAdmin || isCapTruong || isCapPho) && !isActualBGH && !isChuyenVien;

  // Danh sách đề nghị và Thống kê báo cáo dành cho BGH, Manager, Cấp trưởng và Cấp phó (ẩn với Chuyên viên)
  const canSeeListAndReport = !isChuyenVien;

  // Fetch user department info
  useEffect(() => {
    const fetchUserDepartment = async () => {
      if (userId) {
        try {
          const response = await getUserInfo(userId);
          if (response.success && response.data) {
            setCurrentUserData(response.data);
            const department = response.data.department;
            const departmentCode = typeof department === "object" ? department.departmentCode : null;
            // Chỉ set nếu departmentCode là "BGH"
            setUserDepartmentCode(departmentCode === "BGH" ? "BGH" : null);
          } else {
            setCurrentUserData(null);
            setUserDepartmentCode(null);
          }
        } catch (error) {
          console.error("Error fetching user department:", error);
          setCurrentUserData(null);
          setUserDepartmentCode(null);
        }
      }
    };
    fetchUserDepartment();
  }, [userId]);

  // Check if mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch pending replies
  useEffect(() => {
    let interval;
    const fetchPendingReplies = async () => {
      if (isAdmin && userId) {
        try {
          const count = await getPendingRepliesForRecipient(userId);
          setTotalPendingReplies(count);
        } catch (error) {
          setTotalPendingReplies(0);
        }
      }
    };

    fetchPendingReplies();
    interval = setInterval(fetchPendingReplies, 600000);

    return () => clearInterval(interval);
  }, [userId, isAdmin]);

  // Fetch BGH in-review count
  useEffect(() => {
    let interval;
    const fetchBghInReviewCount = async () => {
      // Check if user is BGH (departmentCode === "BGH" or is admin/manager)
      const isBGHUser = userDepartmentCode === "BGH" || isAdmin;
      if (isBGHUser && userId) {
        try {
          const count = await getInReviewReplyCount(userId);
          setBghInReviewCount(count);
        } catch (error) {
          setBghInReviewCount(0);
        }
      } else {
        setBghInReviewCount(0);
      }
    };

    fetchBghInReviewCount();
    interval = setInterval(fetchBghInReviewCount, 600000);

    return () => clearInterval(interval);
  }, [userId, userDepartmentCode, isAdmin]);

  // Show Popover when unread or pending exist
  useEffect(() => {
    if ((unreadDocCount > 0 || myPendingReplyCount > 0 || totalPendingReplies > 0 || bghInReviewCount > 0) && userId) {
      setShowPopover(true);

      const timer = setTimeout(() => {
        setShowPopover(false);
      }, 5000); // Hide after 5s

      return () => clearTimeout(timer);
    }
  }, [unreadDocCount, myPendingReplyCount, totalPendingReplies, bghInReviewCount, userId, isAdmin]);

  useEffect(() => {
    let interval;
    const fetchDeadlineCounts = async () => {
      if (userId) {
        try {
          const counts = await getDeadlineStatusCounts(userId);
          setDeadlineCounts(counts);
        } catch (error) {
          setDeadlineCounts({ soonCount: 0, dueTodayCount: 0, overdueCount: 0 });
        }
      }
    };

    fetchDeadlineCounts();
    interval = setInterval(fetchDeadlineCounts, 600000);

    return () => clearInterval(interval);
  }, [userId]);

  // Fetch danh sách menu liên kết ngoài
  useEffect(() => {
    const fetchExternalMenus = async () => {
      try {
        const res = await getExternalMenusApi(false);
        if (res && res.success) {
          setExternalMenus(res.data || []);
        }
      } catch (error) {
        console.error("Lỗi khi tải menu liên kết ngoài:", error);
      }
    };

    fetchExternalMenus();
  }, []);

  // Fetch pending work schedule count
  useEffect(() => {
    let interval;
    const fetchPendingSchedule = async () => {
      if (userId) {
        try {
          const res = await getPendingWorkScheduleCount();
          if (res && res.success) {
            setWorkSchedulePendingCount(res.data?.count || 0);
          }
        } catch (error) {
          setWorkSchedulePendingCount(0);
        }
      }
    };

    fetchPendingSchedule();
    interval = setInterval(fetchPendingSchedule, 300000);

    return () => clearInterval(interval);
  }, [userId]);

  // Show Popover when there are notifications
  useEffect(() => {
    const hasPendingReply = !isGvCv && (isAdmin ? totalPendingReplies > 0 : myPendingReplyCount > 0);
    if ((deadlineCounts.soonCount > 0 || deadlineCounts.dueTodayCount > 0 || deadlineCounts.overdueCount > 0 || hasPendingReply || bghInReviewCount > 0) && userId) {
      setShowPopover(true);
      const timer = setTimeout(() => setShowPopover(false), 5000 );
      return () => clearTimeout(timer);
    }
  }, [deadlineCounts, myPendingReplyCount, totalPendingReplies, bghInReviewCount, userId, isGvCv, isAdmin]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const emulationPendingCount = isAdmin
    ? (emulationCounts?.pendingForManager || 0) + (emulationCounts?.pendingForBGH || 0)
    : (isActualBGH
        ? (emulationCounts?.pendingForBGH || 0)
        : (isManager
            ? (emulationCounts?.pendingForManager || 0)
            : (emulationCounts?.pendingForUser || emulationCounts?.totalActionableCount || 0)));

  const createLinkItem = (path, label, badgeCount = null) => {
    const count = Number(badgeCount);
    const hasCount = badgeCount !== null && !isNaN(count) && count > 0;
    return {
      key: path,
      label: (
        <Link to={path} className="flex justify-between items-center w-full">
          <span>{label}</span>
          {hasCount && (
            <Badge className="mr-5" count={count} overflowCount={99} size="small" offset={[5, 0]} />
          )}
        </Link>
      ),
    };
  };

  const menuItems = [
    { key: "/", icon: <DashboardOutlined />, label: <Link to="/">Dashboard</Link> },
    {
      key: "/documents",
      icon: <FileTextOutlined />,
      label: "Văn bản",
      children: [
        createLinkItem("/documents/ReceivedDocumentList", "Văn bản đến", unreadDocCount),
        ...(isAdmin
          ? [
            createLinkItem("/documents/SentDocumentList", "Tất cả văn bản"),
            { key: "/documents/create", label: <Link to="/documents/create">Ban hành văn bản</Link> },
          ]
          : []),
      ],
    },
    ...(!isGvCv
      ? [
          {
            key: "/reply",
            icon: <FileTextOutlined />,
            label: "Văn bản trình ký",
            children: [
              // Chỉ BGH (không phải manager/admin) mới chỉ hiển thị "BGH xét duyệt", ẩn "Tất cả văn bản" và "Trình ký"
              // Manager/admin thì hiển thị bình thường
              ...(userDepartmentCode === "BGH" && !isAdmin
                ? [createLinkItem("/bgh-review", "BGH xét duyệt", bghInReviewCount)]
                : [
                    createLinkItem("/getAllRepliedDoc", "Tất cả văn bản", isAdmin ? totalPendingReplies : myPendingReplyCount),
                    ...(!isManager && (isCapTruong || isCapPho || isRealAdmin) ? [{ key: "/replyDoc", label: <Link to="/replyDoc">Trình ký</Link> }] : []),
                    // Manager/admin là BGH vẫn hiển thị thêm "BGH xét duyệt"
                    ...(isBGH && isAdmin ? [createLinkItem("/bgh-review", "BGH xét duyệt", bghInReviewCount)] : []),
                  ]
              ),
            ],
          },
        ]
      : []),
    ...(!isGvCv && (isAdmin || isActualBGH || isCapTruong || isCapPho)
      ? [
        {
          key: "/report/Statistics",
          icon: <LineChartOutlined />,
          label: "Thống kê - Báo cáo",
          children: [
            { key: "/report", label: <Link to="/report">Báo cáo</Link> },
            ...(isAdmin ? [{ key: "/Statistics", label: <Link to="/Statistics">Thống kê</Link> }] : []),
          ],
        },
      ]
      : []),
    {
      key: "/work-schedule",
      icon: <CalendarOutlined style={{ color: "#1890ff" }} />,
      label: (
        <Link to="/work-schedule" className="flex justify-between items-center w-full">
          <span>Lịch công tác</span>
          {workSchedulePendingCount > 0 && (isAdmin || isActualBGH) && (
            <Badge className="mr-5" count={workSchedulePendingCount} overflowCount={99} size="small" offset={[5, 0]} />
          )}
        </Link>
      ),
    },
    {
      key: "/schedule-group",
      icon: <ProjectOutlined />,
      label: "Công việc",
      children: [
        createLinkItem("/schedule/all", "Tất cả công việc"),
        createLinkItem("/schedule/create", "Tạo công việc"),
        createLinkItem("/schedule/todo", "Chưa làm", todoTaskCount),
        createLinkItem("/schedule/inprogress", "Đang làm", inProgressTaskCount),
        createLinkItem("/schedule/done", "Hoàn thành"),
        createLinkItem("/schedule/kpi", "Đánh giá & KPI"),
        createLinkItem("/schedule/report", "In báo cáo"),
        createLinkItem("/schedule/report?type=IPCV", "Xuất DMCV → iPCV"),
        ...((isAdmin || isManager)
          ? [createLinkItem("/schedule/focus-axes", "Quản lý trục kết quả")]
          : []),
      ],
    },
    {
      key: "/emulation",
      icon: <TrophyOutlined style={{ color: "#faad14" }} />,
      label: (
        <div className="flex items-center justify-between w-full pr-3">
          <span>Thi đua - Khen thưởng</span>
          {emulationPendingCount > 0 && (
            <Badge count={emulationPendingCount} size="small" overflowCount={99} />
          )}
        </div>
      ),
      children: [
        ...(canSeeRegisterMenu ? [createLinkItem("/emulation/register", "Đề nghị")] : []),
        ...(canSeeListAndReport
          ? [
              createLinkItem("/emulation/list", "Danh sách đề nghị", emulationPendingCount),
              createLinkItem("/emulation/report", "Thống kê - Báo cáo"),
            ]
          : []),
        createLinkItem("/emulation/achievements/add", "Thêm thành tích"),
        createLinkItem("/emulation/achievements", "Tra cứu thành tích"),
        ...(isAdmin
          ? [
              createLinkItem("/emulation/titles", "Danh mục danh hiệu"),
              createLinkItem("/emulation/documents", "Danh mục Hồ sơ"),
            ]
          : []),
      ],
    },
    {
      key: "/training",
      icon: <ReadOutlined style={{ color: "#38bdf8" }} />,
      label: (
        <div className="flex items-center justify-between w-full pr-3">
          <span>Học tập bồi dưỡng</span>
          {trainingPendingCount > 0 && (
            <Badge count={trainingPendingCount} size="small" overflowCount={99} />
          )}
        </div>
      ),
      children: [
        createLinkItem("/training/register", "Đăng ký"),
        createLinkItem("/training/list", "Danh sách đăng ký", trainingPendingCount),
        createLinkItem("/training/result-report", "Báo cáo kết quả"),
        createLinkItem("/training/report", "Báo cáo - Thống kê"),
      ],
    },
    {
      key: "/online-records",
      icon: <AuditOutlined style={{ color: "#10b981" }} />,
      label: (
        <div className="flex items-center justify-between w-full pr-3">
          <span>Hồ sơ trực tuyến</span>
          {onlineRecordPendingCount > 0 && (
            <Badge count={onlineRecordPendingCount} size="small" overflowCount={99} />
          )}
        </div>
      ),
      children: [
        createLinkItem("/online-records/submit", "Gửi hồ sơ"),
        createLinkItem("/online-records/list", "Quản lý hồ sơ", onlineRecordPendingCount),
        ...(isAdmin
          ? [
              createLinkItem("/online-records/categories", "Danh mục hồ sơ"),
              createLinkItem("/online-records/attachment-types", "Danh mục file đính kèm"),
            ]
          : []),
      ],
    },
    {
      key: "/external-websites",
      icon: <GlobalOutlined style={{ color: "#38bdf8" }} />,
      label: "Website liên kết",
      children: externalMenus && externalMenus.length > 0
        ? externalMenus.map((item) => ({
            key: `/external-link-${item._id}`,
            icon: <LinkOutlined style={{ fontSize: "13px", color: "#38bdf8" }} />,
            label: (
              <a
                href={item.url}
                target={item.openInNewTab ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className="inline-block text-white hover:text-cyan-300 transition-colors"
                style={{ color: "#ffffff", whiteSpace: "nowrap" }}
              >
                <span>{item.title}</span>
              </a>
            ),
          }))
        : [
            {
              key: "/external-websites-empty",
              label: <span className="text-gray-300 italic text-sm">Chưa có liên kết</span>,
              disabled: true,
            },
          ],
    },
    {
      key: "/signature",
      icon: <EditOutlined />,
      label: "Chữ ký điện tử",
      children: [
        { key: "/signature/sign", label: <Link to="/signature/sign">Ký văn bản</Link> },
        { key: "/signature/archive", label: <Link to="/signature/archive">Kho lưu trữ</Link> },
        { key: "/signature/settings", label: <Link to="/signature/settings">Cấu hình chữ ký</Link> },
      ],
    },
    ...(isAdmin
      ? [
        {
          key: "/MenberManager",
          icon: <AppstoreAddOutlined />,
          label: "Quản lý",
          children: [
            { key: "/MenberManager/DepartmentForm", label: <Link to="/DepartmentForm">Quản lý phòng ban</Link> },
            { key: "/MenberManager/Position", label: <Link to="/Position">Quản lý Chức vụ</Link> },
            { key: "/MenberManager/Listusers", label: <Link to="/Listusers">Quản lý người dùng</Link> },
            { key: "/MenberManager/DocVariantPage", label: <Link to="/DocVariantPage">Quản lý loại văn bản</Link> },
            ...(userRole === "admin" ? [{ key: "/MenberManager/DriveConfig", label: <Link to="/DriveConfig">Cấu hình Google Drive</Link> }] : []),
            { key: "/Units", label: <Link to="/Units">Cơ quan ban hành</Link> },
            ...(userRole === "admin" ? [
              { key: "/ChatbotConfig", label: <Link to="/ChatbotConfig">Cấu hình AI Chatbot</Link> },
              { key: "/BackupConfig", label: <Link to="/BackupConfig">Cấu hình sao lưu</Link> },
              { key: "/MenberManager/SmtpConfig", label: <Link to="/SmtpConfig">Cài đặt SMTP Gmail</Link> },
              { key: "/MenberManager/GoogleLoginConfig", label: <Link to="/GoogleLoginConfig">Cấu hình Google Login</Link> },
              { key: "/MenberManager/UnitConfig", label: <Link to="/unit-config">Cấu hình đơn vị</Link> },
              { key: "/MenberManager/ExternalMenus", label: <Link to="/external-menus">Quản lý Menu</Link> },
            ] : []),
          ],
        },
      ]
      : []),
    { key: "/members", icon: <TeamOutlined />, label: <Link to="/members">Thông tin cá nhân</Link> },
  ];

  // Tính tổng số lượng cần báo
  const pendingReplyBadgeCount = isGvCv ? 0 : (isAdmin ? (totalPendingReplies || 0) : (myPendingReplyCount || 0));
  const totalNotifications = (unreadDocCount || 0) + pendingReplyBadgeCount + (isBGH ? (bghInReviewCount || 0) : 0);


  // Lấy danh sách các submenu cha cấp 1 (root submenu)
  const rootSubmenuKeys = menuItems
    .filter((item) => item && item.children && item.children.length > 0)
    .map((item) => item.key);

  // Tự động mở submenu chứa trang hiện tại khi vào trang hoặc chuyển trang
  useEffect(() => {
    const currentPath = location.pathname;
    const currentFull = location.pathname + (location.search || "");
    const parentItem = menuItems.find((item) =>
      item?.children?.some((child) => {
        if (!child?.key || typeof child.key !== "string") return false;
        if (child.key === currentFull || child.key === currentPath) return true;
        const baseKey = child.key.split("?")[0];
        return baseKey && baseKey !== "/" && currentPath.startsWith(baseKey);
      })
    );
    if (parentItem) {
      setOpenKeys([parentItem.key]);
    }
  }, [location.pathname, location.search]);

  // Xử lý đóng menu cũ khi mở menu mới (Accordion mode - chỉ mở 1 menu tại 1 thời điểm)
  const handleOpenChange = (keys) => {
    const latestOpenKey = keys.find((key) => !openKeys.includes(key));
    if (rootSubmenuKeys.includes(latestOpenKey)) {
      setOpenKeys(latestOpenKey ? [latestOpenKey] : []);
    } else {
      setOpenKeys(keys);
    }
  };

  const sidebarContent = (
    <div 
      className="h-full text-white flex flex-col overflow-hidden app-sidebar-gradient relative"
      style={{ background: theme?.sidebarBg || "var(--app-sidebar-bg, linear-gradient(180deg, #0a2540 0%, #0f335a 50%, #154275 100%))" }}
    >
      <div className={`flex items-center ${isCollapsed ? "flex-col gap-2 px-1 py-3" : "justify-between px-4 py-3"} border-b border-white/10 relative flex-shrink-0 z-10`}>
        {/* Bên trái nút Thu gọn/Mở rộng: Cài App & Bật tắt thông báo */}
        <div className="flex items-center min-w-0">
          <PWAInstallAndNotify isCollapsed={isCollapsed} isMobile={isMobile} />
        </div>

        {/* Nút Thu gọn/Mở rộng hoặc nút Đóng trên mobile */}
        <div className="flex items-center">
          {isMobile && (
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={onMobileClose}
              className="text-white hover:text-cyan-300 text-lg"
              size="large"
            />
          )}
          {!isMobile && (
            <Button
              type="text"
              icon={isCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-white hover:text-cyan-300 flex items-center justify-center"
              style={{ fontSize: "16px" }}
              title={isCollapsed ? "Mở rộng thanh menu" : "Thu gọn thanh menu"}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-sidebar-scrollbar relative z-10">
        <Menu
          mode="inline"
          theme="dark"
          inlineCollapsed={isMobile ? false : isCollapsed}
          defaultSelectedKeys={["/"]}
          selectedKeys={[location.pathname + (location.search || ""), location.pathname]}
          openKeys={isCollapsed && !isMobile ? undefined : openKeys}
          onOpenChange={handleOpenChange}
          className="w-full border-none pb-6"
          style={{ fontSize: "16px", fontWeight: "bold", background: "transparent" }}
          items={menuItems}
          onClick={(e) => {
            // Chỉ tự động ẩn menu trên mobile khi click vào menu item
            if (isMobile && onMenuItemClick && e.key !== "/") {
              onMenuItemClick();
            }
          }}
        />
      </div>

      {/* Hình ảnh skyline thành phố ở chân thanh menu */}
      <div 
        className="pointer-events-none select-none absolute bottom-0 left-0 right-0 overflow-hidden z-0"
        style={{
          height: isCollapsed ? "48px" : "80px",
          transition: "height 0.3s cubic-bezier(0.2, 0, 0, 1)",
        }}
      >
        <img
          src={citySkyline}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover object-bottom"
          style={{
            opacity: 0.12,
            filter: "brightness(1.2)",
            maskImage: "linear-gradient(to top, rgba(0, 0, 0, 0.9) 25%, rgba(0, 0, 0, 0) 100%)",
            WebkitMaskImage: "linear-gradient(to top, rgba(0, 0, 0, 0.9) 25%, rgba(0, 0, 0, 0) 100%)",
          }}
        />
      </div>
    </div>
  );

  // Mobile drawer
  if (isMobile) {
     return (
       <Drawer
         title=""
         placement="left"
         onClose={onMobileClose}
         open={mobileOpen}
         width={280}
         styles={{ body: { padding: 0, height: "100%", overflow: "hidden" } }}
         bodyStyle={{ padding: 0, height: "100%", overflow: "hidden" }}
         className="mobile-sidebar-drawer"
         closable={false}
         maskClosable={true}
       >
         {sidebarContent}
       </Drawer>
     );
  }

  // Desktop sidebar
  return (
    <div 
      className="h-full text-white flex flex-col overflow-hidden app-sidebar-gradient" 
      style={{ 
        width: isCollapsed ? "80px" : "260px", 
        transition: "width 0.3s cubic-bezier(0.2, 0, 0, 1)",
        minWidth: isCollapsed ? "80px" : "260px",
        background: theme?.sidebarBg || "var(--app-sidebar-bg, linear-gradient(180deg, #0a2540 0%, #0f335a 50%, #154275 100%))"
      }}
    >
      {sidebarContent}
    </div>
  );
};

Sidebar.propTypes = {
  mobileOpen: PropTypes.bool.isRequired,
  onMobileClose: PropTypes.func.isRequired,
  onMenuItemClick: PropTypes.func,
};

export default Sidebar;
