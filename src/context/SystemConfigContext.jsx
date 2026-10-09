/* eslint-disable react/prop-types */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getUnitSystemConfigApi } from '../api/systemConfigApi';
import DefaultLogo from '../assets/Logo.webp';
import DefaultLoginBg from '../assets/login-bg.png';

const SystemConfigContext = createContext();

const SYSTEM_CONFIG_STORAGE_KEY = 'unit_system_config_cache';

const getDefaultCachedConfig = () => {
  try {
    const cached = localStorage.getItem(SYSTEM_CONFIG_STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    // Ignore JSON error
  }
  return {
    siteName: 'Hệ thống Văn phòng số - NSG-Office',
    shortName: 'NSG-Office',
    siteDescription: 'Hệ thống Văn phòng số - Quản lý văn bản, điều hành công việc và thi đua khen thưởng',
    organizationName: 'Trường Cao Đẳng Bách Khoa Nam Sài Gòn',
    address: '47 Cao Lỗ, Phường 4, Quận 8, TP. Hồ Chí Minh',
    hotline: '',
    email: '',
    websiteUrl: '',
    loginBackground: '',
    logo: '',
    favicon: '',
  };
};

export const SystemConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(getDefaultCachedConfig);
  const [loading, setLoading] = useState(true);

  // Fetch config từ backend
  const refreshConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getUnitSystemConfigApi();
      if (res && res.success && res.data) {
        setConfig(res.data);
        try {
          localStorage.setItem(SYSTEM_CONFIG_STORAGE_KEY, JSON.stringify(res.data));
        } catch (e) {
          // ignore localStorage error
        }
      }
    } catch (err) {
      console.warn('Cannot load unit system config, using default branding:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  // Tự động cập nhật document.title, favicon và Open Graph meta tags
  useEffect(() => {
    const setMetaTag = (attrName, attrValue, content) => {
      if (!content) return;
      let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    if (config?.siteName) {
      document.title = config.siteName;
      setMetaTag('name', 'title', config.siteName);
      setMetaTag('property', 'og:title', config.siteName);
      setMetaTag('name', 'twitter:title', config.siteName);
    }

    if (config?.siteDescription) {
      setMetaTag('name', 'description', config.siteDescription);
      setMetaTag('property', 'og:description', config.siteDescription);
      setMetaTag('name', 'twitter:description', config.siteDescription);
    }

    const faviconUrl = getFaviconUrl();
    if (faviconUrl) {
      // Xác định MIME type phù hợp dựa trên url/đuôi tệp
      let iconType = 'image/png';
      if (faviconUrl.endsWith('.ico') || faviconUrl.includes('.ico')) {
        iconType = 'image/x-icon';
      } else if (faviconUrl.endsWith('.svg') || faviconUrl.includes('.svg')) {
        iconType = 'image/svg+xml';
      } else if (faviconUrl.endsWith('.webp') || faviconUrl.includes('.webp')) {
        iconType = 'image/webp';
      }

      // Xóa tất cả các thẻ link icon hiện tại để trình duyệt buộc phải cập nhật favicon mới
      const existingIcons = document.querySelectorAll("link[rel*='icon']");
      existingIcons.forEach((el) => el.remove());

      // Tạo thẻ link icon mới với timestamp / URL mới
      const newIcon = document.createElement('link');
      newIcon.rel = 'icon';
      newIcon.type = iconType;
      newIcon.href = faviconUrl;
      document.head.appendChild(newIcon);

      const newShortcutIcon = document.createElement('link');
      newShortcutIcon.rel = 'shortcut icon';
      newShortcutIcon.type = iconType;
      newShortcutIcon.href = faviconUrl;
      document.head.appendChild(newShortcutIcon);

      const appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      appleIcon.href = faviconUrl;
      document.head.appendChild(appleIcon);

      // Cập nhật thẻ apple-mobile-web-app-title
      setMetaTag('name', 'apple-mobile-web-app-title', config.shortName || config.siteName || 'QLVB NSG');

      // Cập nhật Web App Manifest (PWA) dynamically để khi người dùng nhấn 'Cài đặt ứng dụng' (Install App)
      // trình duyệt sẽ sử dụng đúng Favicon/Logo và Tên hệ thống đã cấu hình thay vì logo cũ
      try {
        const dynamicManifest = {
          name: config.siteName || 'Hệ thống Văn phòng số - NSG-Office',
          short_name: config.shortName || 'NSG-Office',
          description: config.siteDescription || 'Hệ thống Văn phòng số - Quản lý văn bản, điều hành công việc và thi đua khen thưởng',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait-primary',
          theme_color: '#0f3a6d',
          background_color: '#f0f2f5',
          icons: [
            {
              src: faviconUrl,
              sizes: '192x192',
              type: iconType,
              purpose: 'any maskable',
            },
            {
              src: faviconUrl,
              sizes: '512x512',
              type: iconType,
              purpose: 'any maskable',
            },
          ],
        };

        const manifestBlob = new Blob([JSON.stringify(dynamicManifest)], { type: 'application/manifest+json' });
        const manifestBlobUrl = URL.createObjectURL(manifestBlob);

        let manifestLink = document.querySelector("link[rel='manifest']");
        if (!manifestLink) {
          manifestLink = document.createElement('link');
          manifestLink.rel = 'manifest';
          document.head.appendChild(manifestLink);
        }
        manifestLink.href = manifestBlobUrl;
      } catch (errManifest) {
        console.warn('Không thể cập nhật dynamic manifest:', errManifest);
      }
    }

    const bgUrl = getLoginBgUrl();
    if (bgUrl) {
      const fullBgUrl = bgUrl.startsWith('http')
        ? bgUrl
        : `${window.location.origin}${bgUrl.startsWith('/') ? '' : '/'}${bgUrl}`;
      setMetaTag('property', 'og:image', fullBgUrl);
      setMetaTag('property', 'og:image:secure_url', fullBgUrl);
      setMetaTag('name', 'twitter:image', fullBgUrl);
    }
  }, [config?.siteName, config?.shortName, config?.siteDescription, config?.favicon, config?.loginBackground]);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://apiqlvb.namsaigon.edu.vn';

  // Helpers lấy hình ảnh kèm fallback (hỗ trợ cả dạng object { url, fileId } hoặc string url)
  const extractUrl = (val) => {
    if (!val) return '';
    let rawUrl = '';
    if (typeof val === 'string') {
      rawUrl = val;
    } else if (val?.url) {
      rawUrl = val.url;
    } else if (val?.fileId) {
      rawUrl = `/api/system-config/image/${val.fileId}`;
    }
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.startsWith('data:')) {
      return rawUrl;
    }
    // Ghép với API_BASE_URL cho các đường dẫn tương đối như /api/system-config/image/...
    return `${API_BASE_URL}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
  };

  const getLogoUrl = () => extractUrl(config?.logo) || extractUrl(config?.favicon) || DefaultLogo;
  const getLoginBgUrl = () => extractUrl(config?.loginBackground) || DefaultLoginBg;
  const getFaviconUrl = () => extractUrl(config?.favicon) || extractUrl(config?.logo) || DefaultLogo;
  const hasCustomBg = Boolean(extractUrl(config?.loginBackground));
  const hasCustomLogo = Boolean(extractUrl(config?.logo) || extractUrl(config?.favicon));
  const hasCustomFavicon = Boolean(extractUrl(config?.favicon) || extractUrl(config?.logo));

  return (
    <SystemConfigContext.Provider
      value={{
        config,
        loading,
        refreshConfig,
        setConfig,
        getLogoUrl,
        getLoginBgUrl,
        getFaviconUrl,
        hasCustomBg,
        hasCustomLogo,
        hasCustomFavicon,
        extractUrl,
      }}
    >
      {children}
    </SystemConfigContext.Provider>
  );
};

export const useSystemConfig = () => {
  const context = useContext(SystemConfigContext);
  if (!context) {
    return {
      config: {
        siteName: 'Hệ thống Văn phòng số - NSG-Office',
        shortName: 'NSG-Office',
        siteDescription: 'Hệ thống Văn phòng số - Quản lý văn bản, điều hành công việc và thi đua khen thưởng',
        organizationName: 'Trường Cao Đẳng Bách Khoa Nam Sài Gòn',
        address: '47 Cao Lỗ, Phường 4, Quận 8, TP. Hồ Chí Minh',
        hotline: '',
        email: '',
        websiteUrl: '',
        loginBackground: '',
        logo: '',
        favicon: '',
      },
      loading: false,
      refreshConfig: () => {},
      setConfig: () => {},
      getLogoUrl: () => DefaultLogo,
      getLoginBgUrl: () => DefaultLoginBg,
      getFaviconUrl: () => DefaultLogo,
    };
  }
  return context;
};

export default SystemConfigContext;
