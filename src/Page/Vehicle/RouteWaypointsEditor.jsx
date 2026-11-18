import React, { useState, useEffect, useRef } from "react";
import {
  Button,
  Input,
  AutoComplete,
  Switch,
  Tag,
  Tooltip,
  Space,
  Spin,
  message,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ThunderboltOutlined,
  EnvironmentOutlined,
  CompassOutlined,
  AimOutlined,
  SwapOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import { calculateRouteApi, optimizeRouteApi, geocodeAddressApi } from "../../api/vehicleApi";

// Địa điểm mặc định của trường Nam Sài Gòn
export const DEFAULT_SCHOOL_ORIGIN = {
  order: 0,
  name: "Trường Cao đẳng Bách khoa Nam Sài Gòn",
  address: "47 Cao Lỗ, Phường 4, Quận 8, TP. Hồ Chí Minh",
  lat: 10.7423,
  lng: 106.6784,
};

// Danh sách các điểm đến phổ biến của trường để chọn nhanh
export const PRESET_DESTINATIONS = [
  {
    name: "Trụ sở chính Cao Lỗ (Q.8)",
    address: "47 Cao Lỗ, Phường 4, Quận 8, TP. Hồ Chí Minh",
    lat: 10.7423,
    lng: 106.6784,
  },
  {
    name: "Cơ sở 4 CMT8 (Q.10)",
    address: "314 Cách Mạng Tháng 8, Phường 13, Quận 10, TP. Hồ Chí Minh",
    lat: 10.7818,
    lng: 106.6661,
  },
  {
    name: "Sở GD&ĐT TP.HCM (Q.1)",
    address: "66-68 Lê Thánh Tôn, Bến Nghé, Quận 1, TP. Hồ Chí Minh",
    lat: 10.7765,
    lng: 106.7008,
  },
  {
    name: "Sở LĐ-TB&XH TP.HCM (Q.3)",
    address: "159 Pasteur, Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh",
    lat: 10.7865,
    lng: 106.6946,
  },
  {
    name: "UBND Quận 8",
    address: "Số 4 Dương Quang Đông, Phường 5, Quận 8, TP. Hồ Chí Minh",
    lat: 10.7421,
    lng: 106.6749,
  },
  {
    name: "Sân bay Tân Sơn Nhất",
    address: "Đường Trường Sơn, Phường 2, Tân Bình, TP. Hồ Chí Minh",
    lat: 10.8184,
    lng: 106.6588,
  },
  {
    name: "Ga Sài Gòn",
    address: "1 Nguyễn Thông, Phường 9, Quận 3, TP. Hồ Chí Minh",
    lat: 10.7828,
    lng: 106.6775,
  },
  {
    name: "UBND TP. Hồ Chí Minh (Q.1)",
    address: "86 Lê Thánh Tôn, Bến Nghé, Quận 1, TP. Hồ Chí Minh",
    lat: 10.7769,
    lng: 106.7009,
  },
];

/**
 * Tạo link mở chỉ đường Google Maps với nhiều điểm dừng
 */
export const buildGoogleMapsDirectionUrl = (waypoints, isRoundTrip = true) => {
  if (!waypoints || !Array.isArray(waypoints) || waypoints.length === 0 || !waypoints[0]) return "";
  const origin = encodeURIComponent(waypoints[0]?.address || waypoints[0]?.name || "");
  let destPoint = (isRoundTrip ? waypoints[0] : waypoints[waypoints.length - 1]) || waypoints[0];
  const destination = encodeURIComponent(destPoint?.address || destPoint?.name || "");

  let midPoints = [];
  if (isRoundTrip) {
    // Tất cả các điểm từ 1 đến hết
    midPoints = waypoints.slice(1);
  } else {
    // Các điểm từ 1 đến kế cuối
    midPoints = waypoints.slice(1, waypoints.length - 1);
  }

  const waypointsParam = midPoints
    .filter(Boolean)
    .map((p) => encodeURIComponent(p?.address || p?.name || ""))
    .filter(Boolean)
    .join("|");

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  if (waypointsParam) {
    url += `&waypoints=${waypointsParam}`;
  }
  return url;
};

/**
 * Component quản lý lộ trình đa điểm, tự động tính khoảng cách km và tối ưu hóa thứ tự
 */
const RouteWaypointsEditor = ({
  initialWaypoints = null,
  initialIsRoundTrip = true,
  onChange,
}) => {
  // State danh sách các điểm dừng
  const [waypoints, _setWaypointsRaw] = useState(() => {
    if (initialWaypoints && Array.isArray(initialWaypoints) && initialWaypoints.length >= 2) {
      return initialWaypoints.filter((w) => w && !w.isRoundTripReturn).map((w, idx) => ({ ...w, order: idx }));
    }
    return [
      { ...DEFAULT_SCHOOL_ORIGIN, order: 0 },
      { order: 1, name: "", address: "", lat: null, lng: null },
    ];
  });

  // Wrapper an toàn tuyệt đối chống crash: không bao giờ để waypoints bị undefined/null
  const setWaypoints = (valOrFn) => {
    _setWaypointsRaw((prev) => {
      const next = typeof valOrFn === "function" ? valOrFn(prev || []) : valOrFn;
      if (!Array.isArray(next)) return prev || [];
      return next;
    });
  };

  const [isRoundTrip, setIsRoundTrip] = useState(
    initialIsRoundTrip !== undefined ? initialIsRoundTrip : true
  );
  const [totalDistanceKm, setTotalDistanceKm] = useState(0);
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(0);
  const [legs, setLegs] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [searchOptions, setSearchOptions] = useState({}); // { [index]: options[] }
  const debounceTimers = useRef({});

  // Cập nhật khi initialWaypoints thay đổi (như khi mở Edit Modal)
  useEffect(() => {
    if (initialWaypoints && Array.isArray(initialWaypoints) && initialWaypoints.length >= 2) {
      setWaypoints(initialWaypoints.filter((w) => w && !w.isRoundTripReturn).map((w, idx) => ({ ...w, order: idx })));
    }
  }, [initialWaypoints]);

  // Tính toán lộ trình khi waypoints hoặc isRoundTrip thay đổi
  const triggerCalculate = async (currentPoints, roundTrip) => {
    const list = Array.isArray(currentPoints) ? currentPoints : (waypoints || []);
    // Chỉ tính khi có ít nhất 2 điểm và ít nhất 2 điểm có tọa độ hoặc địa chỉ
    const validPoints = list.filter(
      (p) => p && ((p.lat && p.lng) || (p.address && p.address.trim()) || (p.name && p.name.trim()))
    );

    if (validPoints.length < 2) {
      setTotalDistanceKm(0);
      setEstimatedDurationMinutes(0);
      setLegs([]);
      notifyParent(list, 0, 0, roundTrip, []);
      return;
    }

    setIsCalculating(true);
    try {
      const res = await calculateRouteApi({
        waypoints: validPoints,
        isRoundTrip: roundTrip,
      });

      if (res.data?.success && res.data.data) {
        const data = res.data.data;
        const km = Number(data.totalDistanceKm) || 0;
        const mins = Number(data.estimatedDurationMinutes || data.durationMinutes) || 0;
        const routeLegs = Array.isArray(data.legs || data.segments) ? (data.legs || data.segments) : [];
        setTotalDistanceKm(km);
        setEstimatedDurationMinutes(mins);
        setLegs(routeLegs);
        notifyParent(list, km, mins, roundTrip, routeLegs);
      }
    } catch (err) {
      console.warn("Lỗi tính toán khoảng cách:", err);
    } finally {
      setIsCalculating(false);
    }
  };

  // Thông báo dữ liệu mới ra form cha
  const notifyParent = (currentPoints, km, mins, roundTrip, routeLegs) => {
    if (typeof onChange === "function") {
      const safeList = Array.isArray(currentPoints) ? currentPoints : (waypoints || []);
      // Tạo chuỗi mô tả lộ trình hiển thị
      const names = safeList
        .map((p) => p?.name || p?.address)
        .filter(Boolean);

      let routeText = names.join(" ➔ ");
      if (roundTrip && names.length > 0 && names[0]) {
        routeText += ` ➔ Về ${names[0]}`;
      }
      if (km > 0) {
        routeText += ` (~${km} km)`;
      }

      onChange({
        waypoints: safeList,
        totalDistanceKm: km,
        estimatedDurationMinutes: mins,
        isRoundTrip: roundTrip,
        legs: routeLegs || [],
        routeText,
      });
    }
  };

  // Tìm kiếm địa chỉ với debounce
  const handleSearchAddress = (index, searchText) => {
    if (debounceTimers.current[index]) {
      clearTimeout(debounceTimers.current[index]);
    }

    if (!searchText || searchText.trim().length < 2) {
      setSearchOptions((prev) => ({ ...prev, [index]: [] }));
      return;
    }

    debounceTimers.current[index] = setTimeout(async () => {
      try {
        const res = await geocodeAddressApi(searchText.trim());
        if (res.data?.success && Array.isArray(res.data.data)) {
          const options = res.data.data.map((item) => ({
            value: item.displayName || item.name,
            label: (
              <div className="py-1">
                <div className="font-semibold text-slate-800 text-xs flex items-center gap-1">
                  <EnvironmentOutlined className="text-red-500" />
                  <span>{item.name}</span>
                </div>
                <div className="text-[11px] text-gray-500 truncate mt-0.5">
                  {item.displayName}
                </div>
              </div>
            ),
            data: item,
          }));
          setSearchOptions((prev) => ({ ...prev, [index]: options }));
        }
      } catch (e) {
        console.warn("Geocode error:", e);
      }
    }, 350);
  };

  // Chọn một gợi ý địa chỉ từ AutoComplete
  const handleSelectAddress = (index, value, option) => {
    const item = option?.data;
    const updated = [...waypoints];
    updated[index] = {
      ...updated[index],
      name: item?.name || value,
      address: item?.displayName || value,
      lat: item?.lat || null,
      lng: item?.lng || null,
    };
    setWaypoints(updated);
    triggerCalculate(updated, isRoundTrip);
  };

  // Thay đổi input text địa chỉ tự do
  const handleAddressTextChange = (index, text) => {
    const updated = [...waypoints];
    updated[index] = {
      ...updated[index],
      name: text,
      address: text,
    };
    setWaypoints(updated);
    handleSearchAddress(index, text);
    // Vẫn tính toán sơ bộ
    triggerCalculate(updated, isRoundTrip);
  };

  // Thêm một điểm dừng mới
  const handleAddWaypoint = () => {
    const list = Array.isArray(waypoints) ? waypoints : [];
    const newPoint = {
      order: list.length,
      name: "",
      address: "",
      lat: null,
      lng: null,
    };
    const updated = [...list, newPoint];
    setWaypoints(updated);
  };

  // Xóa một điểm dừng
  const handleRemoveWaypoint = (index) => {
    const list = Array.isArray(waypoints) ? waypoints : [];
    if (list.length <= 2) {
      message.warning("Lộ trình cần ít nhất 2 điểm (Điểm đi và Điểm đến)");
      return;
    }
    const updated = list.filter((_, idx) => idx !== index).map((w, idx) => ({ ...w, order: idx }));
    setWaypoints(updated);
    triggerCalculate(updated, isRoundTrip);
  };

  // Đổi thứ tự điểm lên / xuống
  const handleMoveWaypoint = (index, direction) => {
    const list = Array.isArray(waypoints) ? waypoints : [];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const updated = [...list];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    // Cập nhật lại số thứ tự order
    const normalized = updated.map((w, idx) => ({ ...w, order: idx }));
    setWaypoints(normalized);
    triggerCalculate(normalized, isRoundTrip);
  };

  // Chọn nhanh địa điểm preset cho một vị trí
  const handleSelectPreset = (index, preset) => {
    const list = Array.isArray(waypoints) ? waypoints : [];
    const updated = [...list];
    updated[index] = {
      ...updated[index],
      name: preset.name,
      address: preset.address,
      lat: preset.lat,
      lng: preset.lng,
    };
    setWaypoints(updated);
    triggerCalculate(updated, isRoundTrip);
  };

  // Lấy vị trí GPS hiện tại của thiết bị
  const handleGetCurrentLocation = (index) => {
    if (!navigator.geolocation) {
      message.error("Trình duyệt không hỗ trợ định vị GPS");
      return;
    }
    message.loading({ content: "Đang định vị tọa độ GPS hiện tại...", key: "gps_loc" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const updated = [...waypoints];
        updated[index] = {
          ...updated[index],
          name: "Vị trí GPS hiện tại",
          address: `Tọa độ: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          lat: latitude,
          lng: longitude,
        };
        setWaypoints(updated);
        message.success({ content: "Đã lấy tọa độ GPS thành công!", key: "gps_loc" });
        triggerCalculate(updated, isRoundTrip);
      },
      (err) => {
        message.error({
          content: "Không thể lấy vị trí GPS (vui lòng cấp quyền truy cập vị trí)",
          key: "gps_loc",
        });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Đảo ngược chiều đi và về (Swap Điểm đầu & Điểm cuối)
  const handleReverseRoute = () => {
    const list = Array.isArray(waypoints) ? waypoints : [];
    if (list.length < 2) return;
    const reversed = [...list].reverse().map((w, idx) => ({ ...w, order: idx }));
    setWaypoints(reversed);
    triggerCalculate(reversed, isRoundTrip);
    message.info("Đã đảo ngược chiều lộ trình!");
  };

  // Tối ưu hóa thứ tự các điểm dừng ngắn nhất (TSP)
  const handleOptimizeRoute = async () => {
    const list = Array.isArray(waypoints) ? waypoints : [];
    if (list.length < 3) {
      message.warning("Cần ít nhất 3 điểm (1 điểm xuất phát và từ 2 điểm đến) để tối ưu lộ trình");
      return;
    }

    setIsOptimizing(true);
    try {
      const res = await optimizeRouteApi({
        waypoints: list,
        isRoundTrip,
      });

      if (res.data?.success && res.data.data) {
        const data = res.data.data;
        const newWaypoints = data.optimizedWaypoints || data.waypoints;

        if (Array.isArray(newWaypoints) && newWaypoints.length > 0) {
          const normalized = newWaypoints
            .filter((w) => w && !w.isRoundTripReturn)
            .map((w, idx) => ({ ...w, order: idx }));

          setWaypoints(normalized);
          const newKm = Number(data.totalDistanceKm) || 0;
          const newMins = Number(data.estimatedDurationMinutes || data.durationMinutes) || 0;
          const newLegs = Array.isArray(data.legs || data.segments) ? (data.legs || data.segments) : [];

          setTotalDistanceKm(newKm);
          setEstimatedDurationMinutes(newMins);
          setLegs(newLegs);
          notifyParent(normalized, newKm, newMins, isRoundTrip, newLegs);

          const savedKm = Number(data.savedDistanceKm) || 0;
          if (savedKm > 0) {
            message.success(`⚡ Đã sắp xếp lại thứ tự lộ trình tối ưu nhất! Tiết kiệm ${savedKm} km.`);
          } else {
            message.info("Lộ trình hiện tại đã là phương án ngắn nhất tối ưu!");
          }
        } else {
          message.warning("Không tìm thấy phương án sắp xếp lại lộ trình");
        }
      }
    } catch (err) {
      console.error("Lỗi tối ưu hóa lộ trình:", err);
      message.error(err.response?.data?.message || err.message || "Lỗi khi tối ưu hóa lộ trình");
    } finally {
      setIsOptimizing(false);
    }
  };

  // Xử lý đổi chế độ khứ hồi
  const handleToggleRoundTrip = (checked) => {
    setIsRoundTrip(checked);
    triggerCalculate(waypoints, checked);
  };

  const currentWaypointsList = Array.isArray(waypoints) ? waypoints : [];
  const googleMapsUrl = buildGoogleMapsDirectionUrl(currentWaypointsList, isRoundTrip);

  return (
    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/90 shadow-sm space-y-3">
      {/* Header bar: Tiêu đề + Nút thao tác nhanh */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
            <CompassOutlined className="text-base" />
          </div>
          <div>
            <div className="font-semibold text-slate-800 text-sm">
              Định vị & Lộ trình di chuyển đa điểm
            </div>
            <div className="text-xs text-slate-500">
              Thêm các điểm dừng, định vị GPS và tự động tính tổng quãng đường (km)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentWaypointsList.length >= 3 && (
            <Tooltip title="Tự động tính toán thứ tự các điểm dừng sao cho tổng quãng đường ngắn nhất">
              <Button
                size="small"
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={isOptimizing}
                onClick={handleOptimizeRoute}
                className="bg-emerald-600 hover:bg-emerald-700 border-none font-medium shadow-sm text-xs"
              >
                Tối ưu lộ trình ngắn nhất
              </Button>
            </Tooltip>
          )}

          <Tooltip title="Đảo ngược điểm xuất phát và các điểm đến">
            <Button
              size="small"
              icon={<SwapOutlined />}
              onClick={handleReverseRoute}
              className="text-xs text-slate-700"
            >
              Đảo chiều
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Preset Buttons: Chọn nhanh địa điểm thường đi */}
      <div className="bg-white p-2 rounded-lg border border-slate-200/80">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
          <span>⚡ Chọn nhanh địa điểm quen thuộc:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_DESTINATIONS.map((preset, idx) => (
            <Tag
              key={idx}
              className="cursor-pointer hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 text-xs py-0.5 px-2 transition-colors rounded-md"
              onClick={() => {
                // Nếu điểm cuối chưa có thì gán vào điểm cuối, nếu đã có thì thêm điểm mới
                const lastIdx = currentWaypointsList.length - 1;
                if (lastIdx >= 0 && !currentWaypointsList[lastIdx]?.name && !currentWaypointsList[lastIdx]?.address) {
                  handleSelectPreset(lastIdx, preset);
                } else {
                  const newPoint = {
                    order: currentWaypointsList.length,
                    name: preset.name,
                    address: preset.address,
                    lat: preset.lat,
                    lng: preset.lng,
                  };
                  const updated = [...currentWaypointsList, newPoint];
                  setWaypoints(updated);
                  triggerCalculate(updated, isRoundTrip);
                }
              }}
            >
              + {preset.name}
            </Tag>
          ))}
        </div>
      </div>

      {/* Danh sách các điểm dừng (Waypoints list) */}
      <div className="space-y-2">
        {currentWaypointsList.map((point, index) => {
          const isFirst = index === 0;
          const isLast = index === currentWaypointsList.length - 1;

          let badgeColor = "bg-blue-600 text-white";
          let labelText = `Điểm dừng ${index}`;
          if (isFirst) {
            badgeColor = "bg-emerald-600 text-white";
            labelText = "Điểm xuất phát (A)";
          } else if (isLast) {
            badgeColor = "bg-rose-600 text-white";
            labelText = `Điểm đến cuối (${String.fromCharCode(65 + index)})`;
          } else {
            labelText = `Điểm dừng ${index} (${String.fromCharCode(65 + index)})`;
          }

          return (
            <div
              key={index}
              className={`p-2.5 rounded-lg border transition-all ${
                isFirst
                  ? "bg-emerald-50/40 border-emerald-200"
                  : isLast
                  ? "bg-rose-50/40 border-rose-200"
                  : "bg-white border-slate-200 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${badgeColor}`}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">{labelText}</span>
                  {point.lat && point.lng && (
                    <Tag color="cyan" className="text-[10px] py-0 px-1 font-mono m-0">
                      GPS OK
                    </Tag>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Tooltip title="Lấy tọa độ GPS thiết bị hiện tại">
                    <Button
                      size="small"
                      type="text"
                      icon={<AimOutlined className="text-blue-600 text-xs" />}
                      onClick={() => handleGetCurrentLocation(index)}
                      className="h-6 px-1.5 text-xs text-blue-600"
                    >
                      GPS
                    </Button>
                  </Tooltip>

                  {/* Nút di chuyển lên / xuống */}
                  <Button
                    size="small"
                    type="text"
                    disabled={isFirst}
                    icon={<ArrowUpOutlined className="text-xs" />}
                    onClick={() => handleMoveWaypoint(index, -1)}
                    className="h-6 w-6 p-0"
                  />
                  <Button
                    size="small"
                    type="text"
                    disabled={isLast}
                    icon={<ArrowDownOutlined className="text-xs" />}
                    onClick={() => handleMoveWaypoint(index, 1)}
                    className="h-6 w-6 p-0"
                  />

                  {/* Nút xóa điểm */}
                  {currentWaypointsList.length > 2 && (
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined className="text-xs" />}
                      onClick={() => handleRemoveWaypoint(index)}
                      className="h-6 w-6 p-0"
                    />
                  )}
                </div>
              </div>

              {/* Input tìm kiếm địa chỉ với gợi ý AutoComplete */}
              <AutoComplete
                value={point.address || point.name || ""}
                options={searchOptions[index] || []}
                onSelect={(val, opt) => handleSelectAddress(index, val, opt)}
                onChange={(val) => handleAddressTextChange(index, val)}
                className="w-full"
                placeholder={
                  isFirst
                    ? "Nhập điểm đi (ví dụ: Trường CĐ Bách khoa Nam Sài Gòn, 47 Cao Lỗ...)"
                    : "Nhập điểm đến / điểm ghé (Sở GD&ĐT, UBND Quận, đối tác...)"
                }
              >
                <Input
                  prefix={<EnvironmentOutlined className={isFirst ? "text-emerald-500" : "text-rose-500"} />}
                  allowClear
                />
              </AutoComplete>
            </div>
          );
        })}
      </div>

      {/* Nút thêm điểm dừng */}
      <div className="flex items-center justify-between pt-1">
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={handleAddWaypoint}
          className="text-xs text-blue-600 border-blue-300 hover:border-blue-500 hover:text-blue-700 bg-white"
        >
          Thêm điểm đến / điểm dừng giữa chặng
        </Button>

        {/* Chế độ chuyến đi khứ hồi */}
        <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-md border border-slate-200">
          <Switch
            size="small"
            checked={isRoundTrip}
            onChange={handleToggleRoundTrip}
          />
          <span className="text-xs text-slate-700 font-medium">
            Chuyến đi khứ hồi (Quay về trường)
          </span>
        </div>
      </div>

      {/* Thẻ tổng kết: Cự ly km + Thời gian + Link xem Google Maps */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[11px] text-blue-700 font-semibold uppercase tracking-wider">
              Tổng cự ly dự kiến
            </div>
            <div className="text-lg font-bold text-blue-900 flex items-center gap-1.5">
              {isCalculating ? (
                <Spin size="small" />
              ) : (
                <>
                  <span>{totalDistanceKm > 0 ? `${totalDistanceKm} km` : "-- km"}</span>
                  {totalDistanceKm > 0 && (
                    <Tag color="blue" className="text-xs font-normal">
                      Đoạn đường bộ OSRM
                    </Tag>
                  )}
                </>
              )}
            </div>
          </div>

          {estimatedDurationMinutes > 0 && (
            <div className="border-l border-blue-200 pl-4">
              <div className="text-[11px] text-blue-700 font-semibold uppercase tracking-wider">
                Thời gian lái xe
              </div>
              <div className="text-lg font-bold text-indigo-900">
                ~{estimatedDurationMinutes} phút
              </div>
            </div>
          )}
        </div>

        {googleMapsUrl && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-white px-2.5 py-1.5 rounded-md border border-blue-200 shadow-2xs hover:shadow-sm transition-all"
          >
            <GlobalOutlined />
            <span>Mở chỉ đường trên Google Maps</span>
          </a>
        )}
      </div>

      {/* Hiển thị chi tiết từng chặng (Legs breakdown) nếu có */}
      {legs && legs.length > 1 && (
        <div className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/80 space-y-1">
          <div className="font-semibold text-slate-700 mb-1">Chi tiết các chặng di chuyển:</div>
          {legs.map((leg, idx) => (
            <div key={idx} className="flex items-center justify-between py-0.5 border-b border-slate-100 last:border-none">
              <span className="truncate max-w-[70%]">
                • Chặng {idx + 1}: <strong>{leg.fromName || `Điểm ${idx + 1}`}</strong> ➔{" "}
                <strong>{leg.toName || `Điểm ${idx + 2}`}</strong>
              </span>
              <span className="font-mono text-slate-800 font-medium">
                {leg.distanceKm} km {leg.durationMinutes ? `(~${leg.durationMinutes}p)` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RouteWaypointsEditor;
