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

    if (config?.favicon) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = config.favicon;
    }
  }, [config?.siteName, config?.favicon]);

  // Helpers lấy hình ảnh kèm fallback
  const getLogoUrl = () => config?.logo || DefaultLogo;
  const getLoginBgUrl = () => config?.loginBackground || DefaultLoginBg;
  const getFaviconUrl = () => config?.favicon || DefaultLogo;

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
