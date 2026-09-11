/* eslint-disable react/prop-types */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getUnitSystemConfigApi } from '../api/systemConfigApi';
import DefaultLogo from '../assets/Logo.webp';
import DefaultLoginBg from '../assets/login-bg.png';

const SystemConfigContext = createContext();

export const SystemConfigProvider = ({ children }) => {
  const [config, setConfig] = useState({
    siteName: 'Hệ thống Quản lý Văn bản và Điều hành',
    shortName: 'QLVB',
    siteDescription: 'Hệ thống quản lý văn bản, điều hành công việc và thi đua khen thưởng',
    organizationName: 'Trường Cao Đẳng Bách Khoa Nam Sài Gòn',
    address: '47 Cao Lỗ, Phường 4, Quận 8, TP. Hồ Chí Minh',
    hotline: '',
    email: '',
    websiteUrl: '',
    loginBackground: '',
    logo: '',
    favicon: '',
  });
  const [loading, setLoading] = useState(true);

  // Fetch config từ backend
  const refreshConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getUnitSystemConfigApi();
      if (res && res.success && res.data) {
        setConfig(res.data);
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

  // Tự động cập nhật document.title và favicon trên browser tab
  useEffect(() => {
    if (config?.siteName) {
      document.title = config.siteName;
    }

    const faviconUrl = getFaviconUrl();
    if (faviconUrl) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = faviconUrl;
    }
  }, [config?.siteName, config?.favicon]);

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

  const getLogoUrl = () => extractUrl(config?.logo) || DefaultLogo;
  const getLoginBgUrl = () => extractUrl(config?.loginBackground) || DefaultLoginBg;
  const getFaviconUrl = () => extractUrl(config?.favicon) || DefaultLogo;
  const hasCustomBg = Boolean(extractUrl(config?.loginBackground));
  const hasCustomLogo = Boolean(extractUrl(config?.logo));
  const hasCustomFavicon = Boolean(extractUrl(config?.favicon));

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
        siteName: 'Hệ thống Quản lý Văn bản và Điều hành',
        shortName: 'QLVB',
        siteDescription: 'Hệ thống quản lý văn bản, điều hành công việc và thi đua khen thưởng',
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
