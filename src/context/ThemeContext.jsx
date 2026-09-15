import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";
import { getUserInfo } from "../api/auth";

export const THEME_PRESETS = [
  {
    key: "blue_ocean",
    name: "Xanh đại dương",
    desc: "Chuẩn mực, trang nhã, hiện đại (Mặc định)",
    headerBg: "linear-gradient(90deg, #0a2540 0%, #0d3868 50%, #154c8a 100%)",
    sidebarBg: "linear-gradient(180deg, #0a2540 0%, #0f335a 50%, #154275 100%)",
    popupBg: "linear-gradient(180deg, #0a2540 0%, #10335e 50%, #154275 100%)",
    previewColors: ["#0a2540", "#0d3868", "#154c8a"],
  },
  {
    key: "emerald_green",
    name: "Xanh lục bảo",
    desc: "Tươi mới, năng động, thư thái",
    headerBg: "linear-gradient(90deg, #064e3b 0%, #065f46 50%, #047857 100%)",
    sidebarBg: "linear-gradient(180deg, #064e3b 0%, #065f46 50%, #0f766e 100%)",
    popupBg: "linear-gradient(180deg, #064e3b 0%, #065f46 50%, #0f766e 100%)",
    previewColors: ["#064e3b", "#065f46", "#047857"],
  },
  {
    key: "royal_purple",
    name: "Tím than quý phái",
    desc: "Sang trọng, uy quyền, tinh tế",
    headerBg: "linear-gradient(90deg, #2e1065 0%, #3b0764 50%, #581c87 100%)",
    sidebarBg: "linear-gradient(180deg, #2e1065 0%, #3b0764 50%, #4c1d95 100%)",
    popupBg: "linear-gradient(180deg, #2e1065 0%, #3b0764 50%, #4c1d95 100%)",
    previewColors: ["#2e1065", "#3b0764", "#581c87"],
  },
  {
    key: "burgundy_wine",
    name: "Đỏ rượu vang",
    desc: "Ấm cúng, lịch lãm, nổi bật",
    headerBg: "linear-gradient(90deg, #4c0519 0%, #701a28 50%, #881337 100%)",
    sidebarBg: "linear-gradient(180deg, #4c0519 0%, #701a28 50%, #9f1239 100%)",
    popupBg: "linear-gradient(180deg, #4c0519 0%, #701a28 50%, #9f1239 100%)",
    previewColors: ["#4c0519", "#701a28", "#881337"],
  },
  {
    key: "midnight_slate",
    name: "Xám than chì",
    desc: "Tối giản, mạnh mẽ, công nghệ",
    headerBg: "linear-gradient(90deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
    sidebarBg: "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
    popupBg: "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
    previewColors: ["#0f172a", "#1e293b", "#334155"],
  },
  {
    key: "sunset_amber",
    name: "Cam hổ phách",
    desc: "Nhiệt huyết, ấm áp, sinh động",
    headerBg: "linear-gradient(90deg, #7c2d12 0%, #9a3412 50%, #c2410c 100%)",
    sidebarBg: "linear-gradient(180deg, #7c2d12 0%, #9a3412 50%, #c2410c 100%)",
    popupBg: "linear-gradient(180deg, #7c2d12 0%, #9a3412 50%, #c2410c 100%)",
    previewColors: ["#7c2d12", "#9a3412", "#c2410c"],
  },
  {
    key: "teal_ocean",
    name: "Xanh mòng két",
    desc: "Cân bằng, thanh thoát, hài hòa",
    headerBg: "linear-gradient(90deg, #134e4a 0%, #115e59 50%, #0f766e 100%)",
    sidebarBg: "linear-gradient(180deg, #134e4a 0%, #115e59 50%, #0d9488 100%)",
    popupBg: "linear-gradient(180deg, #134e4a 0%, #115e59 50%, #0d9488 100%)",
    previewColors: ["#134e4a", "#115e59", "#0f766e"],
  },
  {
    key: "deep_black",
    name: "Đen tuyền huyền bí",
    desc: "Cổ điển, chuyên nghiệp, tập trung",
    headerBg: "linear-gradient(90deg, #18181b 0%, #27272a 50%, #3f3f46 100%)",
    sidebarBg: "linear-gradient(180deg, #18181b 0%, #27272a 50%, #3f3f46 100%)",
    popupBg: "linear-gradient(180deg, #18181b 0%, #27272a 50%, #3f3f46 100%)",
    previewColors: ["#18181b", "#27272a", "#3f3f46"],
  },
  {
    key: "custom",
    name: "Tự chọn màu sắc",
    desc: "Tùy biến tự do màu Header & Sidebar",
    headerBg: "#0f172a",
    sidebarBg: "#1e293b",
    popupBg: "#1e293b",
    previewColors: ["#0f172a", "#1e293b", "#334155"],
  },
];

export const DEFAULT_THEME = {
  preset: "blue_ocean",
  headerBg: "linear-gradient(90deg, #0a2540 0%, #0d3868 50%, #154c8a 100%)",
  sidebarBg: "linear-gradient(180deg, #0a2540 0%, #0f335a 50%, #154275 100%)",
  popupBg: "linear-gradient(180deg, #0a2540 0%, #10335e 50%, #154275 100%)",
};

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setThemeState: () => {},
  applyPreset: () => {},
  applyCustomTheme: () => {},
  resetToDefault: () => {},
  presets: THEME_PRESETS,
});

export const useTheme = () => useContext(ThemeContext);

// Áp dụng CSS Custom Properties trực tiếp lên document.documentElement
const applyCssVariables = (theme) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const headerBg = theme.headerBg || DEFAULT_THEME.headerBg;
  const sidebarBg = theme.sidebarBg || DEFAULT_THEME.sidebarBg;
  const popupBg = theme.popupBg || sidebarBg;

  root.style.setProperty("--app-header-bg", headerBg);
  root.style.setProperty("--app-sidebar-bg", sidebarBg);
  root.style.setProperty("--app-sidebar-popup-bg", popupBg);
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("user_theme_preference");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.headerBg || parsed.preset)) {
          applyCssVariables(parsed);
          return {
            preset: parsed.preset || "blue_ocean",
            headerBg: parsed.headerBg || DEFAULT_THEME.headerBg,
            sidebarBg: parsed.sidebarBg || DEFAULT_THEME.sidebarBg,
            popupBg: parsed.popupBg || parsed.sidebarBg || DEFAULT_THEME.popupBg,
          };
        }
      }
    } catch (e) {
      console.error("Lỗi đọc theme từ localStorage:", e);
    }
    applyCssVariables(DEFAULT_THEME);
    return DEFAULT_THEME;
  });

  // Cập nhật CSS variables khi theme thay đổi
  useEffect(() => {
    applyCssVariables(theme);
    try {
      localStorage.setItem("user_theme_preference", JSON.stringify(theme));
    } catch (e) {
      console.error("Lỗi lưu theme vào localStorage:", e);
    }
  }, [theme]);

  // Đồng bộ theme từ thông tin User API khi đăng nhập / có token
  useEffect(() => {
    const syncThemeFromUser = async () => {
      const token = Cookies.get("accessToken");
      if (!token) return;
      try {
        const decoded = jwtDecode(token);
        const userId = decoded?.userId || decoded?.id || decoded?.sub;
        if (!userId) return;

        const res = await getUserInfo(userId);
        const userObj = res?.user || res?.data;
        const userTheme = userObj?.themePreference;
        if (userTheme && (userTheme.preset || userTheme.headerBg)) {
          let resolvedHeader = userTheme.headerBg;
          let resolvedSidebar = userTheme.sidebarBg;
          let resolvedPopup = userTheme.sidebarBg;

          if (userTheme.preset && userTheme.preset !== "custom") {
            const matched = THEME_PRESETS.find((p) => p.key === userTheme.preset);
            if (matched) {
              resolvedHeader = matched.headerBg;
              resolvedSidebar = matched.sidebarBg;
              resolvedPopup = matched.popupBg;
            }
          }

          setTheme((prev) => {
            if (
              prev.preset === userTheme.preset &&
              prev.headerBg === resolvedHeader &&
              prev.sidebarBg === resolvedSidebar
            ) {
              return prev;
            }
            return {
              preset: userTheme.preset || "blue_ocean",
              headerBg: resolvedHeader || DEFAULT_THEME.headerBg,
              sidebarBg: resolvedSidebar || DEFAULT_THEME.sidebarBg,
              popupBg: resolvedPopup || DEFAULT_THEME.popupBg,
            };
          });
        }
      } catch (err) {
        console.error("Lỗi đồng bộ theme từ API:", err);
      }
    };

    syncThemeFromUser();
  }, []);

  const applyPreset = useCallback((presetKey) => {
    const found = THEME_PRESETS.find((p) => p.key === presetKey);
    if (!found) return;
    setTheme({
      preset: found.key,
      headerBg: found.headerBg,
      sidebarBg: found.sidebarBg,
      popupBg: found.popupBg || found.sidebarBg,
    });
  }, []);

  const applyCustomTheme = useCallback((headerBg, sidebarBg) => {
    setTheme({
      preset: "custom",
      headerBg: headerBg || DEFAULT_THEME.headerBg,
      sidebarBg: sidebarBg || DEFAULT_THEME.sidebarBg,
      popupBg: sidebarBg || DEFAULT_THEME.sidebarBg,
    });
  }, []);

  const resetToDefault = useCallback(() => {
    setTheme(DEFAULT_THEME);
  }, []);

  const setThemeState = useCallback((newTheme) => {
    setTheme((prev) => ({
      ...prev,
      ...newTheme,
    }));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setThemeState,
        applyPreset,
        applyCustomTheme,
        resetToDefault,
        presets: THEME_PRESETS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
