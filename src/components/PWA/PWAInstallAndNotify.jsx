import React, { useState, useEffect } from "react";
import { Button, Tooltip, message, Modal } from "antd";
import { DownloadOutlined, BellOutlined, CheckCircleFilled } from "@ant-design/icons";
import { 
  isPushNotificationSupported, 
  getPushSubscriptionState, 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications 
} from "../../utils/pushNotification";

const PWAInstallAndNotify = ({ isCollapsed = false, isMobile = false }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [pushState, setPushState] = useState({ isSupported: false, isSubscribed: false, permission: "default" });
  const [loadingPush, setLoadingPush] = useState(false);

  useEffect(() => {
    // 1. Lắng nghe sự kiện beforeinstallprompt để cho phép cài đặt App
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 2. Kiểm tra xem app đã chạy dưới dạng Standalone (đã cài đặt) chưa
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (isStandalone) {
      setIsAppInstalled(true);
    }

    // 3. Kiểm tra trạng thái Push Notification
    checkPushStatus();

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const checkPushStatus = async () => {
    try {
      const state = await getPushSubscriptionState();
      setPushState(state);
    } catch (e) {
      console.warn("Lỗi kiểm tra push status:", e);
    }
  };

  // Hàm nhận diện thiết bị & trình duyệt chính xác
  const getDeviceAndBrowser = () => {
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isAndroid = /Android/.test(ua);
    const isEdge = /Edg\//.test(ua);
    const isChrome = /Chrome\//.test(ua) && !isEdge;
    const isSafari = /Safari\//.test(ua) && !isChrome && !isEdge;
    const isFirefox = /Firefox\//.test(ua);
    const isMac = /Macintosh/.test(ua);
    const isWindows = /Windows/.test(ua);

    return { isIOS, isAndroid, isEdge, isChrome, isSafari, isFirefox, isMac, isWindows };
  };

  const handleInstallApp = async () => {
    // Nếu trình duyệt hỗ trợ Native Prompt (Chrome, Edge trên cả Desktop & Android)
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          message.success("Cảm ơn bạn đã cài đặt ứng dụng QLVB Nam Sài Gòn!");
          setDeferredPrompt(null);
          setIsAppInstalled(true);
          return;
        }
      } catch (err) {
        console.warn("Native prompt error, fallback to guidance:", err);
      }
    }

    // Nếu không có native prompt (Safari trên iOS, Firefox, hoặc Chrome/Edge đã chặn prompt)
    const { isIOS, isAndroid, isEdge, isSafari } = getDeviceAndBrowser();

    let guideTitle = "Cài đặt ứng dụng QLVB Nam Sài Gòn";
    let guideContent = null;

    if (isIOS) {
      guideTitle = "Cài đặt App trên iPhone / iPad (iOS)";
      guideContent = (
        <div className="text-sm space-y-3 text-slate-700 py-2">
          <p className="font-medium text-blue-900">
            Hệ điều hành iOS yêu cầu cài đặt qua Safari theo các bước sau:
          </p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold">1</span>
              <span>Bấm biểu tượng <b>Chia sẻ</b> (icon hình vuông có mũi tên hướng lên ⎋) ở thanh công cụ Safari dưới đáy màn hình.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold">2</span>
              <span>Cuộn xuống danh sách tùy chọn và chọn <b>"Thêm vào Màn hình chính" (Add to Home Screen)</b>.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold">3</span>
              <span>Bấm <b>"Thêm" (Add)</b> ở góc trên bên phải. Biểu tượng ứng dụng QLVB sẽ xuất hiện ngay trên màn hình chính của bạn!</span>
            </div>
          </div>
        </div>
      );
    } else if (isAndroid) {
      guideTitle = "Cài đặt App trên điện thoại Android";
      guideContent = (
        <div className="text-sm space-y-3 text-slate-700 py-2">
          <p className="font-medium text-emerald-900">
            Để cài đặt ứng dụng vào điện thoại Android:
          </p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold">1</span>
              <span>Bấm nút <b>Menu (dấu 3 chấm đứng ⋮)</b> ở góc trên bên phải của trình duyệt Chrome.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold">2</span>
              <span>Chọn mục <b>"Cài đặt ứng dụng" (Install App)</b> hoặc <b>"Thêm vào Màn hình chính"</b>.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold">3</span>
              <span>Xác nhận <b>Cài đặt</b> để hoàn tất.</span>
            </div>
          </div>
        </div>
      );
    } else {
      // Desktop (Windows / Mac)
      guideTitle = "Cài đặt App trên Máy tính (Desktop)";
      guideContent = (
        <div className="text-sm space-y-3 text-slate-700 py-2">
          <p className="font-medium text-indigo-900">
            Ứng dụng hỗ trợ chạy độc lập như phần mềm trên máy tính:
          </p>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold">1</span>
              <span>Nhìn vào thanh nhập địa chỉ URL của trình duyệt (bên cạnh biểu tượng ngôi sao Bookmark).</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold">2</span>
              <span>Bấm vào biểu tượng <b>Cài đặt (hình máy tính có mũi tên xuống hoặc icon dấu cộng)</b>.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 font-bold">3</span>
              <span>Bấm xác nhận <b>"Cài đặt" (Install)</b>. Ứng dụng sẽ mở trong cửa sổ riêng biệt với tốc độ tải nhanh hơn!</span>
            </div>
          </div>
        </div>
      );
    }

    Modal.info({
      title: <span className="font-bold text-base text-slate-800">{guideTitle}</span>,
      content: guideContent,
      okText: "Đã hiểu",
      width: 520,
      centered: true,
    });
  };

  const handleTogglePush = async () => {
    if (!pushState.isSupported) {
      message.warning("Trình duyệt này không hỗ trợ nhận thông báo đẩy Web Push.");
      return;
    }

    setLoadingPush(true);
    try {
      if (pushState.isSubscribed) {
        await unsubscribeFromPushNotifications();
        message.info("Đã tắt thông báo đẩy trên thiết bị này.");
      } else {
        await subscribeToPushNotifications();
        message.success("Đã bật thông báo đẩy! Bạn sẽ nhận thông báo khi có văn bản mới hoặc nhiệm vụ.");
      }
      await checkPushStatus();
    } catch (error) {
      console.error(error);
      message.error(error.message || "Không thể thiết lập thông báo đẩy.");
    } finally {
      setLoadingPush(false);
    }
  };

  if (isCollapsed) {
    // Khi sidebar thu gọn trên desktop
    return (
      <div className="flex flex-col items-center gap-2 py-1">
        {!isAppInstalled && (
          <Tooltip title="Cài đặt App QLVB" placement="right">
            <Button
              type="primary"
              size="small"
              shape="circle"
              icon={<DownloadOutlined />}
              onClick={handleInstallApp}
              className="bg-emerald-600 hover:bg-emerald-500 border-emerald-500 flex items-center justify-center shadow-sm text-xs"
            />
          </Tooltip>
        )}
        {pushState.isSupported && (
          <Tooltip 
            title={pushState.isSubscribed ? "Đã bật thông báo đẩy (Click để tắt)" : "Bật thông báo đẩy"} 
            placement="right"
          >
            <Button
              size="small"
              type="text"
              shape="circle"
              loading={loadingPush}
              icon={
                pushState.isSubscribed ? (
                  <CheckCircleFilled className="text-emerald-400 text-sm" />
                ) : (
                  <BellOutlined className="text-white hover:text-amber-300 text-sm" />
                )
              }
              onClick={handleTogglePush}
              className={`flex items-center justify-center transition-colors ${
                pushState.isSubscribed ? "bg-emerald-950/40 border border-emerald-500/40 text-emerald-300" : "hover:bg-white/10 text-white"
              }`}
            />
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Nút Cài đặt App */}
      {!isAppInstalled && (
        <Tooltip title="Cài ứng dụng QLVB lên điện thoại / máy tính">
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            onClick={handleInstallApp}
            className="bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-xs font-medium rounded-full flex items-center shadow-sm"
          >
            <span>Cài App</span>
          </Button>
        </Tooltip>
      )}

      {/* Nút Bật/Tắt Push Notification */}
      {pushState.isSupported && (
        <Tooltip title={pushState.isSubscribed ? "Đã bật thông báo đẩy trên thiết bị này (Click để tắt)" : "Bật thông báo đẩy về thiết bị khi có văn bản mới"}>
          <Button
            size="small"
            type="text"
            loading={loadingPush}
            icon={
              pushState.isSubscribed ? (
                <CheckCircleFilled className="text-emerald-400 text-base" />
              ) : (
                <BellOutlined className="text-white hover:text-amber-300 text-base" />
              )
            }
            onClick={handleTogglePush}
            className={`flex items-center justify-center rounded-full p-1.5 transition-colors ${
              pushState.isSubscribed ? "bg-emerald-950/40 border border-emerald-500/40 text-emerald-300" : "hover:bg-white/10 text-white"
            }`}
          />
        </Tooltip>
      )}
    </div>
  );
};

export default PWAInstallAndNotify;
