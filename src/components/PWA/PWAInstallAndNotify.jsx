import React, { useState, useEffect } from "react";
import { Button, Tooltip, message, Modal } from "antd";
import { DownloadOutlined, BellOutlined, CheckCircleFilled } from "@ant-design/icons";
import { 
  isPushNotificationSupported, 
  getPushSubscriptionState, 
  subscribeToPushNotifications, 
  unsubscribeFromPushNotifications 
} from "../../utils/pushNotification";

const PWAInstallAndNotify = () => {
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

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      Modal.info({
        title: "Cài đặt ứng dụng QLVB Nam Sài Gòn",
        content: (
          <div className="text-sm space-y-2 text-slate-700 py-2">
            <p>Để cài đặt ứng dụng vào điện thoại hoặc máy tính của bạn:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Trên iPhone / iPad (Safari):</b> Bấm nút <b>Chia sẻ</b> (icon ô vuông có mũi tên lên) ➜ Chọn <b>"Thêm vào Màn hình chính" (Add to Home Screen)</b>.</li>
              <li><b>Trên Android (Chrome):</b> Bấm dấu 3 chấm góc trên bên phải ➜ Chọn <b>"Cài đặt ứng dụng"</b> hoặc <b>"Thêm vào Màn hình chính"</b>.</li>
              <li><b>Trên Máy tính (Chrome/Edge):</b> Bấm biểu tượng <b>Cài đặt (Install)</b> nằm trên thanh địa chỉ URL.</li>
            </ul>
          </div>
        ),
        okText: "Đã hiểu",
      });
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      message.success("Cảm ơn bạn đã cài đặt ứng dụng QLVB Nam Sài Gòn!");
      setDeferredPrompt(null);
      setIsAppInstalled(true);
    }
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
            <span className="hidden md:inline">Cài App</span>
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
