import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Spin, Button, Tag, Empty, message } from 'antd';
import {
  PrinterOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  HomeOutlined,
  DownloadOutlined,
  FilePdfOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';

const PublicWorkSchedulePage = () => {
  const [searchParams] = useSearchParams();
  const dateParam = searchParams.get('date');
  const layoutParam = searchParams.get('layout') || 'vertical';

  const [selectedDate, setSelectedDate] = useState(dateParam ? dayjs(dateParam) : dayjs());
  const [layoutType, setLayoutType] = useState(layoutParam === 'classic' ? 'classic' : 'vertical');
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tính thứ 2 và chủ nhật chuẩn xác của tuần
  const getMondayAndSunday = (date) => {
    const d = dayjs(date || new Date());
    const day = d.day(); // 0: Chủ Nhật, 1: Thứ Hai, ..., 6: Thứ Bảy
    const monday = day === 0 ? d.subtract(6, 'day').startOf('day') : d.subtract(day - 1, 'day').startOf('day');
    const sunday = monday.add(6, 'day').endOf('day');
    return { monday, sunday };
  };

  const { monday, sunday } = useMemo(() => getMondayAndSunday(selectedDate), [selectedDate]);

  useEffect(() => {
    const fetchPublicSchedules = async () => {
      try {
        setLoading(true);
        const start = monday.format('YYYY-MM-DD');
        const end = sunday.format('YYYY-MM-DD');

        let data = [];
        // 1. Thử gọi endpoint /public trước
        try {
          const res = await axios.get(`${API_URL}/api/work-schedules/public?startDate=${start}&endDate=${end}`);
          if (res.data && res.data.success && Array.isArray(res.data.data)) {
            data = res.data.data;
          }
        } catch (pubErr) {
          console.warn('Endpoint /public chưa sẵn sàng, thử fallback sang /api/work-schedules:', pubErr);
        }

        // 2. Nếu endpoint /public trả về 404 (chưa restart BE trên VPS), fallback sang endpoint chung status=APPROVED
        if (data.length === 0) {
          try {
            const fallbackRes = await axios.get(
              `${API_URL}/api/work-schedules?startDate=${start}&endDate=${end}&status=APPROVED`
            );
            if (fallbackRes.data && fallbackRes.data.success && Array.isArray(fallbackRes.data.data)) {
              data = fallbackRes.data.data;
            }
          } catch (fbErr) {
            console.warn('Fallback cũng không khả dụng:', fbErr);
          }
        }

        setSchedules(data);
      } catch (err) {
        console.error('Lỗi lấy dữ liệu lịch công tác:', err);
        message.error('Không thể tải lịch công tác.');
      } finally {
        setLoading(false);
      }
    };

    fetchPublicSchedules();
  }, [monday, sunday]);

  // Phân nhóm lịch theo ngày cho kiểu dọc (Đồng bộ chính xác với kiểu cổ điển)
  const groupedSchedules = useMemo(() => {
    const todayStr = dayjs().format('YYYY-MM-DD');
    const list = [];

    for (let i = 0; i < 7; i++) {
      const d = monday.add(i, 'day');
      const dStr = d.format('YYYY-MM-DD');
      const items = schedules.filter((item) => {
        const itemStart = dayjs(item.startDate).format('YYYY-MM-DD');
        const itemEnd = item.endDate ? dayjs(item.endDate).format('YYYY-MM-DD') : itemStart;
        return dStr >= itemStart && dStr <= itemEnd;
      });

      items.sort((a, b) => {
        const timeA = a.startTime || '';
        const timeB = b.startTime || '';
        return timeA.localeCompare(timeB);
      });

      list.push({
        dateStr: dStr,
        isToday: dStr === todayStr,
        items,
      });
    }

    return list;
  }, [schedules, monday]);

  // Danh sách 7 ngày trong tuần cho kiểu cổ điển
  const classicWeekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = monday.add(i, 'day');
      const dStr = d.format('YYYY-MM-DD');
      const items = schedules.filter((item) => {
        const itemStart = dayjs(item.startDate).format('YYYY-MM-DD');
        const itemEnd = item.endDate ? dayjs(item.endDate).format('YYYY-MM-DD') : itemStart;
        return dStr >= itemStart && dStr <= itemEnd;
      });
      items.sort((a, b) => {
        const timeA = a.startTime || '';
        const timeB = b.startTime || '';
        return timeA.localeCompare(timeB);
      });
      const dayLabel = i === 6 ? 'Chủ Nhật' : `Thứ ${i + 2}`;
      const headerLabel = `${dayLabel}, ngày ${d.format('DD/MM/YYYY')}`;
      days.push({
        date: d,
        dateStr: dStr,
        dayOfWeek: d.day(),
        dayLabel,
        headerLabel,
        items,
      });
    }
    return days;
  }, [monday, schedules]);

  const handlePrint = () => {
    window.print();
  };

  const titleSub = `Tuần từ Thứ Hai (${monday.format('DD/MM/YYYY')}) đến Chủ Nhật (${sunday.format('DD/MM/YYYY')})`;

  return (
    <div className="min-h-screen bg-slate-100 p-2 sm:p-4 md:p-6 print:p-0 print:bg-white text-slate-900 font-sans">
      {/* Header điều khiển (Ẩn khi in) */}
      <div className="max-w-[1000px] mx-auto mb-4 bg-white p-4 rounded-xl shadow-xs border border-gray-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700 text-xl font-bold">
            <CalendarOutlined />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-[#003366] leading-tight m-0">
              Lịch Công Tác Trường Cao Đẳng Bách Khoa Nam Sài Gòn
            </h1>
            <p className="text-xs text-gray-500 m-0">{titleSub}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 p-1 rounded-lg">
            <Button
              size="small"
              type={layoutType === 'vertical' ? 'primary' : 'text'}
              onClick={() => setLayoutType('vertical')}
              className="text-xs"
            >
              Kiểu dọc
            </Button>
            <Button
              size="small"
              type={layoutType === 'classic' ? 'primary' : 'text'}
              onClick={() => setLayoutType('classic')}
              className="text-xs"
            >
              Kiểu cổ điển
            </Button>
          </div>

          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-xs font-semibold"
          >
            In / Lưu PDF
          </Button>

          <Link to="/login">
            <Button icon={<HomeOutlined />} className="text-xs">
              Đăng nhập
            </Button>
          </Link>
        </div>
      </div>

      {/* Nội dung xem & In */}
      <div className="max-w-[1000px] mx-auto bg-white p-4 sm:p-8 rounded-xl shadow-md border border-gray-200 print:shadow-none print:border-none print:p-0">
        {/* Tiêu đề hành chính */}
        <div className="text-center mb-6">
          <div className="font-bold text-xs sm:text-sm uppercase tracking-wider text-gray-700">
            ỦY BAN NHÂN DÂN THÀNH PHỐ HỒ CHÍ MINH
          </div>
          <div className="font-bold text-sm sm:text-base uppercase text-[#003366] mt-0.5">
            TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN
          </div>
          <div className="w-32 h-[1.5px] bg-[#003366] mx-auto my-2"></div>
          <h2 className="text-lg sm:text-xl font-bold uppercase mt-3 text-slate-800 tracking-wide">
            LỊCH CÔNG TÁC NHÀ TRƯỜNG
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 italic mt-0.5">{titleSub}</p>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <Spin tip="Đang tải lịch công tác..." />
          </div>
        ) : layoutType === 'classic' ? (
          /* MẪU CỔ ĐIỂN (Outlook Grid) */
          <div>
            <table className="w-full border-collapse border-2 border-black text-slate-900" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '50%' }} />
                <col style={{ width: '50%' }} />
              </colgroup>
              <tbody>
                {/* Hàng 1: Thứ 2 & Thứ 5 */}
                <tr>
                  <td className="border border-black p-2 align-top h-60">
                    <div className="font-bold text-[14px] text-black pb-1 mb-2 border-b border-black">
                      {classicWeekDays[0]?.headerLabel}
                    </div>
                    <div className="space-y-1.5">
                      {classicWeekDays[0]?.items?.length === 0 ? (
                        <div className="text-xs text-gray-500 italic py-1">Chưa có lịch công tác</div>
                      ) : (
                        classicWeekDays[0]?.items?.map((item, idx) => (
                          <div key={item._id || idx} className="flex items-start gap-1.5 text-xs leading-relaxed">
                            <span className="w-3 h-3 mt-0.5 shrink-0 rounded-xs border bg-[#2b569a] border-[#1d3b68]" />
                            <div>
                              {item.startTime && <span className="font-bold mr-1.5">{item.startTime}</span>}
                              <span className={item.startTime ? '' : 'font-semibold'}>{item.content}</span>
                              {item.host && <span className="text-purple-900 font-bold ml-1.5">[{item.host}]</span>}
                              {item.participants && <span className="text-slate-700 ml-1.5">({item.participants})</span>}
                              {item.location && <span className="text-slate-700 ml-1.5">- {item.location}</span>}
                              {item.notes && <span className="text-gray-500 italic ml-1.5">*{item.notes}</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="border border-black p-2 align-top h-60">
                    <div className="font-bold text-[14px] text-black pb-1 mb-2 border-b border-black">
                      {classicWeekDays[3]?.headerLabel}
                    </div>
                    <div className="space-y-1.5">
                      {classicWeekDays[3]?.items?.length === 0 ? (
                        <div className="text-xs text-gray-500 italic py-1">Chưa có lịch công tác</div>
                      ) : (
                        classicWeekDays[3]?.items?.map((item, idx) => (
                          <div key={item._id || idx} className="flex items-start gap-1.5 text-xs leading-relaxed">
                            <span className="w-3 h-3 mt-0.5 shrink-0 rounded-xs border bg-[#2b569a] border-[#1d3b68]" />
                            <div>
                              {item.startTime && <span className="font-bold mr-1.5">{item.startTime}</span>}
                              <span className={item.startTime ? '' : 'font-semibold'}>{item.content}</span>
                              {item.host && <span className="text-purple-900 font-bold ml-1.5">[{item.host}]</span>}
                              {item.participants && <span className="text-slate-700 ml-1.5">({item.participants})</span>}
                              {item.location && <span className="text-slate-700 ml-1.5">- {item.location}</span>}
                              {item.notes && <span className="text-gray-500 italic ml-1.5">*{item.notes}</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                </tr>

                {/* Hàng 2: Thứ 3 & Thứ 6 */}
                <tr>
                  <td className="border border-black p-2 align-top h-60">
                    <div className="font-bold text-[14px] text-black pb-1 mb-2 border-b border-black">
                      {classicWeekDays[1]?.headerLabel}
                    </div>
                    <div className="space-y-1.5">
                      {classicWeekDays[1]?.items?.length === 0 ? (
                        <div className="text-xs text-gray-500 italic py-1">Chưa có lịch công tác</div>
                      ) : (
                        classicWeekDays[1]?.items?.map((item, idx) => (
                          <div key={item._id || idx} className="flex items-start gap-1.5 text-xs leading-relaxed">
                            <span className="w-3 h-3 mt-0.5 shrink-0 rounded-xs border bg-[#2b569a] border-[#1d3b68]" />
                            <div>
                              {item.startTime && <span className="font-bold mr-1.5">{item.startTime}</span>}
                              <span className={item.startTime ? '' : 'font-semibold'}>{item.content}</span>
                              {item.host && <span className="text-purple-900 font-bold ml-1.5">[{item.host}]</span>}
                              {item.participants && <span className="text-slate-700 ml-1.5">({item.participants})</span>}
                              {item.location && <span className="text-slate-700 ml-1.5">- {item.location}</span>}
                              {item.notes && <span className="text-gray-500 italic ml-1.5">*{item.notes}</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="border border-black p-2 align-top h-60">
                    <div className="font-bold text-[14px] text-black pb-1 mb-2 border-b border-black">
                      {classicWeekDays[4]?.headerLabel}
                    </div>
                    <div className="space-y-1.5">
                      {classicWeekDays[4]?.items?.length === 0 ? (
                        <div className="text-xs text-gray-500 italic py-1">Chưa có lịch công tác</div>
                      ) : (
                        classicWeekDays[4]?.items?.map((item, idx) => (
                          <div key={item._id || idx} className="flex items-start gap-1.5 text-xs leading-relaxed">
                            <span className="w-3 h-3 mt-0.5 shrink-0 rounded-xs border bg-[#2b569a] border-[#1d3b68]" />
                            <div>
                              {item.startTime && <span className="font-bold mr-1.5">{item.startTime}</span>}
                              <span className={item.startTime ? '' : 'font-semibold'}>{item.content}</span>
                              {item.host && <span className="text-purple-900 font-bold ml-1.5">[{item.host}]</span>}
                              {item.participants && <span className="text-slate-700 ml-1.5">({item.participants})</span>}
                              {item.location && <span className="text-slate-700 ml-1.5">- {item.location}</span>}
                              {item.notes && <span className="text-gray-500 italic ml-1.5">*{item.notes}</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                </tr>

                {/* Hàng 3: Thứ 4 & Thứ 7 / CN */}
                <tr>
                  <td className="border border-black p-2 align-top h-60">
                    <div className="font-bold text-[14px] text-black pb-1 mb-2 border-b border-black">
                      {classicWeekDays[2]?.headerLabel}
                    </div>
                    <div className="space-y-1.5">
                      {classicWeekDays[2]?.items?.length === 0 ? (
                        <div className="text-xs text-gray-500 italic py-1">Chưa có lịch công tác</div>
                      ) : (
                        classicWeekDays[2]?.items?.map((item, idx) => (
                          <div key={item._id || idx} className="flex items-start gap-1.5 text-xs leading-relaxed">
                            <span className="w-3 h-3 mt-0.5 shrink-0 rounded-xs border bg-[#2b569a] border-[#1d3b68]" />
                            <div>
                              {item.startTime && <span className="font-bold mr-1.5">{item.startTime}</span>}
                              <span className={item.startTime ? '' : 'font-semibold'}>{item.content}</span>
                              {item.host && <span className="text-purple-900 font-bold ml-1.5">[{item.host}]</span>}
                              {item.participants && <span className="text-slate-700 ml-1.5">({item.participants})</span>}
                              {item.location && <span className="text-slate-700 ml-1.5">- {item.location}</span>}
                              {item.notes && <span className="text-gray-500 italic ml-1.5">*{item.notes}</span>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="border border-black p-0 align-top h-60">
                    {/* Thứ Bảy */}
                    <div className="p-2 border-b border-black min-h-[110px]">
                      <div className="font-bold text-[14px] text-black pb-1 mb-2 border-b border-black">
                        {classicWeekDays[5]?.headerLabel}
                      </div>
                      <div className="space-y-1.5">
                        {classicWeekDays[5]?.items?.length === 0 ? (
                          <div className="text-xs text-gray-500 italic py-1">Chưa có lịch công tác</div>
                        ) : (
                          classicWeekDays[5]?.items?.map((item, idx) => (
                            <div key={item._id || idx} className="flex items-start gap-1.5 text-xs leading-relaxed">
                              <span className="w-3 h-3 mt-0.5 shrink-0 rounded-xs border bg-[#2b569a] border-[#1d3b68]" />
                              <div>
                                {item.startTime && <span className="font-bold mr-1.5">{item.startTime}</span>}
                                <span className={item.startTime ? '' : 'font-semibold'}>{item.content}</span>
                                {item.host && <span className="text-purple-900 font-bold ml-1.5">[{item.host}]</span>}
                                {item.participants && <span className="text-slate-700 ml-1.5">({item.participants})</span>}
                                {item.location && <span className="text-slate-700 ml-1.5">- {item.location}</span>}
                                {item.notes && <span className="text-gray-500 italic ml-1.5">*{item.notes}</span>}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    {/* Chủ Nhật */}
                    <div className="p-2 min-h-[100px]">
                      <div className="font-bold text-[14px] text-black pb-1 mb-2 border-b border-black">
                        {classicWeekDays[6]?.headerLabel}
                      </div>
                      <div className="space-y-1.5">
                        {classicWeekDays[6]?.items?.length === 0 ? (
                          <div className="text-xs text-gray-500 italic py-1">Chưa có lịch công tác</div>
                        ) : (
                          classicWeekDays[6]?.items?.map((item, idx) => (
                            <div key={item._id || idx} className="flex items-start gap-1.5 text-xs leading-relaxed">
                              <span className="w-3 h-3 mt-0.5 shrink-0 rounded-xs border bg-[#2b569a] border-[#1d3b68]" />
                              <div>
                                {item.startTime && <span className="font-bold mr-1.5">{item.startTime}</span>}
                                <span className={item.startTime ? '' : 'font-semibold'}>{item.content}</span>
                                {item.host && <span className="text-purple-900 font-bold ml-1.5">[{item.host}]</span>}
                                {item.participants && <span className="text-slate-700 ml-1.5">({item.participants})</span>}
                                {item.location && <span className="text-slate-700 ml-1.5">- {item.location}</span>}
                                {item.notes && <span className="text-gray-500 italic ml-1.5">*{item.notes}</span>}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          /* MẪU DỌC (Vertical Table) */
          <table className="w-full border-collapse border-2 border-slate-700 text-xs">
            <thead>
              <tr className="bg-slate-100 text-center font-bold text-slate-800">
                <th className="border border-slate-600 p-2.5 w-32">Thứ, Ngày</th>
                <th className="border border-slate-600 p-2.5 w-28">Thời gian</th>
                <th className="border border-slate-600 p-2.5 min-w-[260px]">Nội dung công tác</th>
                <th className="border border-slate-600 p-2.5 w-44">Thành phần</th>
                <th className="border border-slate-600 p-2.5 w-40">Địa điểm</th>
                <th className="border border-slate-600 p-2.5 w-32">Ghi chú</th>
              </tr>
            </thead>
            {groupedSchedules.map((group) => {
              const d = dayjs(group.dateStr);
              const dayOfWeek = d.format('dddd');
              const capDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
              const hasItems = group.items.length > 0;

              return (
                <tbody key={group.dateStr} className="schedule-day-group">
                  {!hasItems ? (
                    <tr className="hover:bg-gray-50">
                      <td className="border border-slate-600 p-2 font-bold text-center align-top bg-gray-50 text-slate-800">
                        <div className="text-[13px]">{capDay}</div>
                        <div className="text-gray-600 font-normal">{d.format('DD/MM/YYYY')}</div>
                      </td>
                      <td className="border border-slate-600 p-2 text-center text-gray-400 italic align-top">--</td>
                      <td colSpan={4} className="border border-slate-600 p-2 align-top italic text-gray-400">
                        Chưa có lịch công tác
                      </td>
                    </tr>
                  ) : (
                    group.items.map((item, idx) => (
                      <tr key={item._id} className="hover:bg-gray-50">
                        {idx === 0 && (
                          <td
                            rowSpan={group.items.length}
                            className="border border-slate-600 p-2 font-bold text-center align-top bg-gray-50 text-slate-800"
                          >
                            <div className="text-[13px]">{capDay}</div>
                            <div className="text-gray-600 font-normal">{d.format('DD/MM/YYYY')}</div>
                          </td>
                        )}
                        <td className="border border-slate-600 p-2 text-center font-semibold align-top text-slate-700">
                          {item.startTime && item.endTime
                            ? `${item.startTime} - ${item.endTime}`
                            : item.startTime || 'Cả ngày'}
                        </td>
                        <td className="border border-slate-600 p-2 align-top font-medium leading-relaxed">
                          <div>{item.content}</div>
                          {item.host && (
                            <div className="text-[11px] text-purple-700 mt-1 font-semibold">
                              <span>Chủ trì: </span>{item.host}
                            </div>
                          )}
                        </td>
                        <td className="border border-slate-600 p-2 align-top">{item.participants || '--'}</td>
                        <td className="border border-slate-600 p-2 align-top">{item.location || '--'}</td>
                        <td className="border border-slate-600 p-2 align-top italic text-gray-500">{item.notes || '--'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              );
            })}
          </table>
        )}

        {/* Chân trang */}
        <div className="mt-8 flex justify-end text-center">
          <div className="w-64 text-xs">
            <div className="italic text-gray-500">
              TP. Hồ Chí Minh, ngày ... tháng ... năm {dayjs().format('YYYY')}
            </div>
            <div className="font-bold uppercase text-slate-800 mt-1">HIỆU TRƯỞNG</div>
            <div className="italic text-gray-400 text-[11px] mt-0.5">(Ký, đóng dấu)</div>
            <div className="h-16"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicWorkSchedulePage;
