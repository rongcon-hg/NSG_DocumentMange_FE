import axios from "axios";
import Cookies from "js-cookie";

const API_URL = import.meta.env.VITE_API_URL;

// Helper chuyển đổi URL-safe Base64 thành Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Kiểm tra xem trình duyệt có hỗ trợ Service Worker và Push API không
 */
export function isPushNotificationSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/**
 * Đăng ký Push Notification
 */
export async function subscribeToPushNotifications() {
  if (!isPushNotificationSupported()) {
    throw new Error("Trình duyệt hiện tại không hỗ trợ Web Push Notification.");
  }

  // 1. Yêu cầu quyền thông báo từ người dùng
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Bạn đã từ chối cấp quyền thông báo.");
  }

  // 2. Chờ Service Worker sẵn sàng
  const registration = await navigator.serviceWorker.ready;

  // 3. Lấy VAPID Public Key từ Backend
  const token = Cookies.get("accessToken");
  const keyRes = await axios.get(`${API_URL}/notifications/push/vapid-public-key`);
  const vapidPublicKey = keyRes.data.publicKey;

  if (!vapidPublicKey) {
    throw new Error("Không thể lấy khóa xác thực Push từ máy chủ.");
  }

  // 4. Subscribe với PushManager
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey,
    });
  }

  // 5. Gửi subscription lên Backend lưu trữ
  const subData = subscription.toJSON();
  await axios.post(
    `${API_URL}/notifications/push/subscribe`,
    {
      subscription: subData,
      userAgent: navigator.userAgent,
      deviceType: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
    },
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return true;
}

/**
 * Hủy đăng ký Push Notification
 */
export async function unsubscribeFromPushNotifications() {
  if (!isPushNotificationSupported()) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    const token = Cookies.get("accessToken");
    const subData = subscription.toJSON();

    // Báo Backend xóa
    try {
      await axios.post(
        `${API_URL}/notifications/push/unsubscribe`,
        { endpoint: subData.endpoint },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      console.warn("Backend unsubscribe error:", e);
    }

    // Unsubscribe trên trình duyệt
    await subscription.unsubscribe();
  }

  return true;
}

/**
 * Kiểm tra trạng thái hiện tại đã đăng ký chưa
 */
export async function getPushSubscriptionState() {
  if (!isPushNotificationSupported()) return { isSupported: false, isSubscribed: false, permission: "denied" };

  const permission = Notification.permission;
  if (permission !== "granted") {
    return { isSupported: true, isSubscribed: false, permission };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  return {
    isSupported: true,
    isSubscribed: !!subscription,
    permission,
  };
}
