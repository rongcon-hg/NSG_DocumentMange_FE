import React, { useMemo } from 'react';
import { Button, Input, Radio, Tag } from 'antd';
import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { PL1B_SECTIONS, PL1B_MAX_SCORE_A } from './pl1bConstants';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Thanh công cụ Tiện ích & Cấu hình Phụ lục 1B (Hiển thị bên ngoài giấy in)
 */
export function PhuLuc1BToolbar({
  pl1bState,
  onChangeState,
  onSelectAllMax,
  onResetScores,
  totalScoreA,
  kpiScore70,
  bonusScore,
  finalTotalScore,
}) {
  const activeRank =
    pl1bState?.selfRank ||
    (finalTotalScore >= 90 ? 'XS' : finalTotalScore >= 70 ? 'T' : finalTotalScore >= 50 ? 'HTNV' : 'KHT');

  return (
    <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-3 text-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-xs sm:text-sm text-blue-900">Tiện ích Phụ lục 1B:</span>
          <Button
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
            onClick={onSelectAllMax}
            className="font-medium text-xs"
          >
            Tích chọn tất cả Đảm bảo (Tối đa 30đ)
          </Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={onResetScores} className="text-xs">
            Đặt lại điểm về 0
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
          <Tag color="green" className="font-semibold text-xs py-0.5">
            Điểm chung (A): {totalScoreA} / 30đ
          </Tag>
          <Tag color="blue" className="font-semibold text-xs py-0.5">
            Điểm KPI (B): {kpiScore70} / 70đ
          </Tag>
          {bonusScore > 0 && (
            <Tag color="gold" className="font-semibold text-xs py-0.5">
              Thưởng (C): +{bonusScore}đ
            </Tag>
          )}
          <Tag color="purple" className="font-bold text-xs sm:text-sm py-0.5">
            TỔNG: {finalTotalScore} / 100đ
          </Tag>
        </div>
      </div>

      {/* Chọn xếp loại & Thông tin cá nhân */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
        <div>
          <div className="font-semibold text-gray-700 mb-1">Mức tự đề xuất xếp loại chất lượng:</div>
          <Radio.Group
            value={activeRank}
            onChange={(e) => onChangeState({ ...pl1bState, selfRank: e.target.value })}
            className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs font-medium"
          >
            <Radio value="XS">
              <span className={activeRank === 'XS' ? 'text-green-700 font-bold' : ''}>1. Xuất sắc (≥ 90đ)</span>
            </Radio>
            <Radio value="T">
              <span className={activeRank === 'T' ? 'text-blue-700 font-bold' : ''}>2. Tốt (70đ - 89đ)</span>
            </Radio>
            <Radio value="HTNV">
              <span className={activeRank === 'HTNV' ? 'text-amber-700 font-bold' : ''}>3. Hoàn thành (50đ - 69đ)</span>
            </Radio>
            <Radio value="KHT">
              <span className={activeRank === 'KHT' ? 'text-red-600 font-bold' : ''}>4. Không hoàn thành (&lt; 50đ)</span>
            </Radio>
          </Radio.Group>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <div className="font-semibold text-gray-700 mb-1">Ngày sinh:</div>
            <Input
              size="small"
              placeholder="DD/MM/YYYY"
              value={pl1bState?.dob || ''}
              onChange={(e) => onChangeState({ ...pl1bState, dob: e.target.value })}
              className="text-xs"
            />
          </div>
          <div>
            <div className="font-semibold text-gray-700 mb-1">Chức vụ Đảng:</div>
            <Input
              size="small"
              placeholder="Đảng viên / Bí thư..."
              value={pl1bState?.partyRole !== undefined ? pl1bState.partyRole : 'Đảng viên'}
              onChange={(e) => onChangeState({ ...pl1bState, partyRole: e.target.value })}
              className="text-xs"
            />
          </div>
          <div>
            <div className="font-semibold text-gray-700 mb-1">Chức vụ đoàn thể:</div>
            <Input
              size="small"
              placeholder="Công đoàn viên..."
              value={pl1bState?.unionRole !== undefined ? pl1bState.unionRole : 'Công đoàn viên'}
              onChange={(e) => onChangeState({ ...pl1bState, unionRole: e.target.value })}
              className="text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PhuLuc1BReport({
  record,
  periodLabel,
  pl1bState,
  onChangeState,
  onSelectAllMax,
  onResetScores,
  effectiveSignature,
  isPrintView = false,
}) {
  const user = record.user || {};
  const userName = user.name || '';
  const userPosition = user.position?.positionName || 'Chuyên viên';
  const deptName = user.department?.departmentName || '';
  const details = record.details || [];

  const scores = pl1bState?.scores || {};
  const notes = pl1bState?.notes || {};

  // Điểm KPI thang 70 tự động lấy từ Phụ lục 4
  const kpiScore70 = useMemo(() => {
    if (record.kpiScore70 !== undefined) return Number(record.kpiScore70);
    const base = record.kpiScore !== undefined ? record.kpiScore : 0;
    return Number(((base * 70) / 100).toFixed(1));
  }, [record.kpiScore70, record.kpiScore]);

  // Điểm thưởng
  const bonusScore = Number(record.totalBonusScore || 0);

  // Tính tổng điểm A
  const totalScoreA = useMemo(() => {
    let sum = 0;
    PL1B_SECTIONS.forEach((sec) => {
      sec.items.forEach((item) => {
        sum += Number(scores[item.code] !== undefined ? scores[item.code] : item.maxScore);
      });
    });
    return Math.min(PL1B_MAX_SCORE_A, Math.round(sum * 10) / 10);
  }, [scores]);

  // Tổng điểm A + B + Điểm thưởng
  const finalTotalScore = useMemo(() => {
    const raw = totalScoreA + kpiScore70 + bonusScore;
    return Number(Math.min(100, Math.round(raw * 10) / 10).toFixed(1));
  }, [totalScoreA, kpiScore70, bonusScore]);

  // Gợi ý mức xếp loại
  const suggestedRank = useMemo(() => {
    if (finalTotalScore >= 90) return 'XS';
    if (finalTotalScore >= 70) return 'T';
    if (finalTotalScore >= 50) return 'HTNV';
    return 'KHT';
  }, [finalTotalScore]);

  const activeRank = pl1bState?.selfRank || suggestedRank;

  // Cập nhật điểm cho 1 tiêu chí
  const handleScoreChange = (code, maxScore, val) => {
    let numeric = Number(val);
    if (isNaN(numeric) || numeric < 0) numeric = 0;
    if (numeric > maxScore) numeric = maxScore;
    numeric = Math.round(numeric * 10) / 10;

    const newScores = { ...scores, [code]: numeric };
    onChangeState({ ...pl1bState, scores: newScores });
  };

  // Cập nhật ghi chú cho 1 tiêu chí
  const handleNoteChange = (code, noteText) => {
    const newNotes = { ...notes, [code]: noteText };
    onChangeState({ ...pl1bState, notes: newNotes });
  };

  const kpiTasks = details.filter((t) => t.isAssignedKpi || t.isInKpi || t.type === 'KPI');

  return (
    <div className="bg-white p-4 sm:p-6 text-black font-['Times_New_Roman',serif] text-[13px] leading-relaxed">
      {/* Góc trên phải: Mẫu 01-B */}
      <div className="text-right font-bold text-xs mb-2">Mẫu 01-B</div>

      {/* Header Quốc hiệu / Đơn vị */}
      <div className="flex justify-between items-start mb-4">
        <div className="text-center w-[45%]">
          <div className="text-xs uppercase">ỦY BAN NHÂN DÂN</div>
          <div className="text-xs uppercase">THÀNH PHỐ HỒ CHÍ MINH</div>
          <div className="text-xs font-bold uppercase">TRƯỜNG CAO ĐẲNG BÁCH KHOA</div>
          <div className="text-xs font-bold uppercase underline">NAM SÀI GÒN</div>
        </div>
        <div className="text-center w-[52%]">
          <div className="text-xs font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div className="text-xs font-bold underline">Độc lập - Tự do - Hạnh phúc</div>
          <div className="italic text-xs mt-1">
            Thành phố Hồ Chí Minh, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
          </div>
        </div>
      </div>

      {/* Tiêu đề BẢN TỰ ĐÁNH GIÁ, XẾP LOẠI CỦA CÁ NHÂN */}
      <div className="text-center my-4">
        <h2 className="text-base sm:text-lg font-bold uppercase tracking-wide !mb-1">
          BẢN TỰ ĐÁNH GIÁ, XẾP LOẠI CỦA CÁ NHÂN
        </h2>
        <div className="font-bold text-sm uppercase">{periodLabel}</div>
      </div>

      {/* Thông tin cá nhân */}
      <div className="space-y-1 mb-4 text-xs sm:text-sm">
        <div className="flex flex-wrap items-center gap-x-6">
          <div>
            Họ và tên: <strong className="uppercase">{userName}</strong>
          </div>
          <div>
            Ngày sinh: <strong>{pl1bState?.dob || '....................'}</strong>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6">
          <div>
            Chức vụ Đảng: <strong>{pl1bState?.partyRole || 'Đảng viên'}</strong>
          </div>
          <div>
            Chức vụ chính quyền: <strong>{userPosition}</strong>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6">
          <div>
            Chức vụ đoàn thể: <strong>{pl1bState?.unionRole || 'Công đoàn viên'}</strong>
          </div>
          <div>
            Đơn vị công tác: <strong>{deptName || 'Trường Cao đẳng Bách khoa Nam Sài Gòn'}</strong>
          </div>
        </div>

        <div className="pt-2">
          <div className="font-bold">I. Tự đánh giá kết quả thực hiện nhiệm vụ</div>
          <div className="italic text-xs text-gray-700">
            (Căn cứ vào nhiệm vụ được giao, cá nhân tự đánh giá kết quả thực hiện nhiệm vụ theo quý, như sau:)
          </div>
        </div>
      </div>

      {/* A. NHÓM TIÊU CHÍ CHUNG (30 ĐIỂM) */}
      <div className="mb-4">
        <div className="font-bold text-xs uppercase mb-1">A. NHÓM TIÊU CHÍ CHUNG (30 ĐIỂM)</div>
        <div className="overflow-x-auto w-full">
          <table className="w-full border-collapse border border-black text-xs min-w-[680px]">
          <thead>
            <tr className="text-center font-bold bg-gray-100">
              <th className="border border-black p-1.5 w-10">TT</th>
              <th className="border border-black p-1.5 min-w-[200px]">Tiêu chí / Nội dung</th>
              <th className="border border-black p-1.5 w-16">
                Đảm bảo<br /><span className="font-normal text-[10px]">(Đánh dấu x)</span>
              </th>
              <th className="border border-black p-1.5 w-20">
                Không đảm bảo<br /><span className="font-normal text-[10px]">(Đánh dấu x)</span>
              </th>
              <th className="border border-black p-1.5 w-14">Điểm<br />tối đa</th>
              <th className="border border-black p-1.5 w-24">
                Điểm đạt<br />
                <span className="font-normal text-[10px]">(Tối đa nếu đảm bảo; 0 nếu không đảm bảo)</span>
              </th>
              <th className="border border-black p-1.5 min-w-[120px]">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {PL1B_SECTIONS.map((section) => {
              let secScore = 0;
              section.items.forEach((it) => {
                secScore += Number(scores[it.code] !== undefined ? scores[it.code] : it.maxScore);
              });
              secScore = Math.min(section.maxScore, Math.round(secScore * 10) / 10);

              return (
                <React.Fragment key={section.id}>
                  {/* Hàng tiêu đề nhóm (1. Về phẩm chất...) */}
                  <tr className="bg-slate-50 font-bold">
                    <td className="border border-black p-1.5 text-center">{section.id}</td>
                    <td className="border border-black p-1.5 text-left">{section.title}</td>
                    <td className="border border-black p-1.5 text-center"></td>
                    <td className="border border-black p-1.5 text-center"></td>
                    <td className="border border-black p-1.5 text-center font-bold">{section.maxScore}</td>
                    <td className="border border-black p-1.5 text-center font-bold text-blue-900">{secScore}</td>
                    <td className="border border-black p-1.5 text-center"></td>
                  </tr>

                  {/* Các tiêu chí con */}
                  {section.items.map((item) => {
                    const currentVal = Number(scores[item.code] !== undefined ? scores[item.code] : item.maxScore);
                    const isPass = currentVal === item.maxScore;
                    const isFail = currentVal === 0;

                    return (
                      <tr key={item.code} className="hover:bg-amber-50/40">
                        <td className="border border-black p-1.5 text-center font-medium">{item.code}</td>
                        <td className="border border-black p-1.5 text-left leading-normal">{item.content}</td>

                        {/* Cột Đảm bảo */}
                        <td
                          className={`border border-black p-1 text-center cursor-pointer select-none ${isPass ? 'bg-green-50 font-bold text-green-700' : ''}`}
                          onClick={() => handleScoreChange(item.code, item.maxScore, item.maxScore)}
                          title="Bấm để đánh dấu Đảm bảo (Chấm điểm tối đa)"
                        >
                          {isPass ? 'x' : ''}
                        </td>

                        {/* Cột Không đảm bảo */}
                        <td
                          className={`border border-black p-1 text-center cursor-pointer select-none ${isFail ? 'bg-red-50 font-bold text-red-600' : ''}`}
                          onClick={() => handleScoreChange(item.code, item.maxScore, 0)}
                          title="Bấm để đánh dấu Không đảm bảo (Chấm 0 điểm)"
                        >
                          {isFail ? 'x' : ''}
                        </td>

                        {/* Điểm tối đa */}
                        <td className="border border-black p-1.5 text-center font-medium">{item.maxScore}</td>

                        {/* Điểm đạt (Cho phép tự nhập nhưng không vượt quá điểm tối đa) */}
                        <td className="border border-black p-1 text-center font-bold">
                          <input
                            type="text"
                            inputMode="decimal"
                            className="w-12 text-center font-bold bg-transparent border-0 outline-none p-0 m-0 text-xs text-black shadow-none ring-0 focus:ring-0"
                            value={currentVal}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                handleScoreChange(item.code, item.maxScore, Math.min(item.maxScore, Math.max(0, val)));
                              } else if (e.target.value === '') {
                                handleScoreChange(item.code, item.maxScore, 0);
                              }
                            }}
                          />
                        </td>

                        {/* Ghi chú */}
                        <td className="border border-black p-1">
                          <input
                            type="text"
                            className="w-full bg-transparent border-0 outline-none p-0 m-0 text-xs text-black shadow-none ring-0 focus:ring-0"
                            value={notes[item.code] || ''}
                            onChange={(e) => handleNoteChange(item.code, e.target.value)}
                            placeholder=""
                          />
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Dòng Tổng (A) */}
            <tr className="bg-emerald-50 font-bold text-xs">
              <td className="border border-black p-1.5 text-center"></td>
              <td className="border border-black p-1.5 text-center uppercase">Tổng (A)</td>
              <td className="border border-black p-1.5 text-center"></td>
              <td className="border border-black p-1.5 text-center"></td>
              <td className="border border-black p-1.5 text-center text-sm">{PL1B_MAX_SCORE_A}</td>
              <td className="border border-black p-1.5 text-center text-sm font-extrabold text-emerald-800">
                {totalScoreA}
              </td>
              <td className="border border-black p-1.5 text-center font-normal italic">
                {totalScoreA === PL1B_MAX_SCORE_A ? 'Đạt tối đa 30/30đ' : ''}
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      {/* B. KẾT QUẢ THỰC HIỆN NHIỆM VỤ ĐƯỢC GIAO (70 ĐIỂM) */}
      <div className="mb-4">
        <div className="font-bold text-xs uppercase mb-1">
          B. KẾT QUẢ THỰC HIỆN NHIỆM VỤ ĐƯỢC GIAO (70 ĐIỂM)
        </div>
        <div className="italic text-xs text-gray-700 mb-2">
          (Nhập những nhiệm vụ trọng tâm được giao trong quý đã thực hiện)
        </div>

        <div className="overflow-x-auto w-full">
        <table className="w-full border-collapse border border-black text-xs min-w-[680px]">
          <thead>
            <tr className="text-center font-bold bg-gray-100">
              <th className="border border-black p-1.5 w-10">TT</th>
              <th className="border border-black p-1.5 min-w-[200px]">Nhiệm vụ trọng tâm trong quý</th>
              <th className="border border-black p-1.5 w-28">Kết quả / Sản phẩm</th>
              <th className="border border-black p-1.5 w-24">Thời hạn</th>
              <th className="border border-black p-1.5 w-24">Điểm tối đa (Tối đa 70 điểm)</th>
              <th className="border border-black p-1.5 w-28">
                Điểm đạt được<br />
                <span className="font-normal text-[10px]">= Điểm KPI đã tính tại bảng tính điểm (Máy rút điểm)</span>
              </th>
              <th className="border border-black p-1.5 min-w-[120px]">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {details.length > 0 ? (
              details.map((t, idx) => (
                <tr key={t._id || idx} className="hover:bg-gray-50">
                  <td className="border border-black p-1 text-center font-medium">{idx + 1}</td>
                  <td className="border border-black p-1 text-left font-medium">{t.title}</td>
                  <td className="border border-black p-1 text-center">{t.outputResult || 'Hoàn thành'}</td>
                  <td className="border border-black p-1 text-center">
                    {t.endDate ? new Date(t.endDate).toLocaleDateString('vi-VN') : ''}
                  </td>
                  <td className="border border-black p-1 text-center text-gray-400">-</td>
                  <td className="border border-black p-1 text-center font-semibold text-blue-900">
                    {t.executionScore !== undefined ? t.executionScore : (t.actualScore || '-')}
                  </td>
                  <td className="border border-black p-1 text-center text-[11px] text-gray-500">
                    {t.isOnTime ? 'Đúng hạn' : t.isLate ? 'Trễ hạn' : 'Đang làm'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="border border-black p-3 text-center italic text-gray-500">
                  Chưa có nhiệm vụ nào được ghi nhận trong kỳ.
                </td>
              </tr>
            )}

            {/* Dòng TỔNG (B) */}
            <tr className="bg-blue-50 font-bold text-xs">
              <td className="border border-black p-1.5 text-center"></td>
              <td colSpan={3} className="border border-black p-1.5 text-left uppercase">
                TỔNG (B) = Điểm KPI đã tính tại bảng tính điểm (Phụ lục 4)
              </td>
              <td className="border border-black p-1.5 text-center text-sm font-bold">70</td>
              <td className="border border-black p-1.5 text-center text-sm font-extrabold text-blue-900">
                {kpiScore70}
              </td>
              <td className="border border-black p-1.5 text-center font-normal italic text-blue-700">
                Tự động từ PL4
              </td>
            </tr>

            {/* C. ĐIỂM THƯỞNG (NẾU CÓ) */}
            <tr className="bg-amber-50 font-bold text-xs">
              <td className="border border-black p-1.5 text-center"></td>
              <td colSpan={3} className="border border-black p-1.5 text-left uppercase">
                C. ĐIỂM THƯỞNG (NẾU CÓ)
              </td>
              <td className="border border-black p-1.5 text-center font-bold"></td>
              <td className="border border-black p-1.5 text-center text-sm font-extrabold text-amber-700">
                {bonusScore > 0 ? `+${bonusScore}` : 0}
              </td>
              <td className="border border-black p-1.5 text-center font-normal italic">
                {bonusScore > 0 ? 'Thưởng vượt chỉ tiêu' : '-'}
              </td>
            </tr>

            {/* TỔNG CỘNG A + B + Điểm thưởng */}
            <tr className="bg-yellow-100/70 font-bold text-xs">
              <td className="border border-black p-1.5 text-center"></td>
              <td colSpan={3} className="border border-black p-1.5 text-left uppercase text-sm">
                TỔNG (A + B + Điểm thưởng (nếu có))
              </td>
              <td className="border border-black p-1.5 text-center text-base font-extrabold">100</td>
              <td className="border border-black p-1.5 text-center text-base font-black text-red-600">
                {finalTotalScore}
              </td>
              <td className="border border-black p-1.5 text-center font-bold text-purple-700">
                Thang 100đ
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      {/* II. Tự đề xuất xếp loại mức chất lượng */}
      <div className="mt-4 mb-2 space-y-1.5">
        <div className="font-bold text-xs sm:text-sm">
          II. Tự đề xuất xếp loại mức chất lượng:
          <span className="font-bold text-black uppercase underline ml-1">
            {activeRank === 'XS'
              ? 'Hoàn thành xuất sắc nhiệm vụ'
              : activeRank === 'T'
              ? 'Hoàn thành tốt nhiệm vụ'
              : activeRank === 'HTNV'
              ? 'Hoàn thành nhiệm vụ'
              : 'Không hoàn thành nhiệm vụ'}
          </span>
          <span className="font-normal font-mono text-gray-500">
            &nbsp;........................................................................................................................................
          </span>
        </div>

        <div className="italic text-[11px] sm:text-xs text-gray-700">
          (Theo 04 mức: - Hoàn thành xuất sắc nhiệm vụ, 2- Hoàn thành tốt nhiệm vụ, 3- Hoàn thành nhiệm vụ và 4- Không hoàn thành nhiệm vụ)
        </div>

        <div className="text-[11px] sm:text-xs italic text-gray-700 leading-relaxed text-justify mt-2">
          Tiêu chí đánh giá, xếp loại chất lượng thực hiện theo mục 2.3, khoản 2, phần IV của Kế hoạch số 13-KH/TU của Ban Thường vụ Thành ủy; trong đó, trường hợp cá nhân “Hoàn thành xuất sắc nhiệm vụ” ngoài kết quả tổng điểm đạt từ 90 điểm trở lên, các địa phương, lĩnh vực, cơ quan, đơn vị, bộ phận do cá nhân trực tiếp lãnh đạo, quản lý hoàn thành 100% nhiệm vụ được giao; trong đó có ít nhất 30% số nhiệm vụ hoàn thành vượt mức yêu cầu.
        </div>
      </div>

      {/* CÁ NHÂN TỰ ĐÁNH GIÁ (Nằm phía bên phải dưới Mục II như hình mẫu) */}
      <div className="grid grid-cols-12 mt-4 mb-4">
        <div className="col-span-5 sm:col-span-6"></div>
        <div className="col-span-7 sm:col-span-6 text-center">
          <div className="font-bold text-xs sm:text-sm uppercase tracking-wide">
            CÁ NHÂN TỰ ĐÁNH GIÁ
          </div>
          <div className="italic text-[11px] sm:text-xs text-gray-600 mb-1">
            (Ký, ghi rõ họ tên)
          </div>

          {effectiveSignature?.fileId ? (
            <div className="h-20 flex items-center justify-center py-1">
              <img
                src={`${API_URL}/api/signature/image/${effectiveSignature.fileId}`}
                alt="Chữ ký"
                className="max-h-16 max-w-[160px] object-contain mix-blend-multiply pointer-events-none"
                crossOrigin="anonymous"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="h-20"></div>
          )}

          <div className="font-bold text-xs sm:text-sm uppercase text-gray-900 mt-1">{userName}</div>
        </div>
      </div>

      {/* III. Nhận xét, đánh giá của cấp có thẩm quyền (Toàn bộ chiều rộng bên dưới chữ ký cá nhân) */}
      <div className="mt-4 pt-3 border-t border-gray-300">
        <div className="font-bold text-xs sm:text-sm uppercase mb-2">
          III. Nhận xét, đánh giá của cấp có thẩm quyền
        </div>
        <div className="text-xs sm:text-sm space-y-2 mb-4 leading-loose text-gray-800">
          <div className="flex items-center">
            <span className="whitespace-nowrap">- Chấm điểm:&nbsp;</span>
            <span className="border-b border-dotted border-gray-400 flex-1 h-4"></span>
          </div>
          <div className="flex items-center">
            <span className="whitespace-nowrap">- Đề xuất xếp loại:&nbsp;</span>
            <span className="border-b border-dotted border-gray-400 flex-1 h-4"></span>
          </div>
        </div>
      </div>

      {/* XÁC NHẬN CỦA TẬP THỂ LÃNH ĐẠO CƠ QUAN, ĐƠN VỊ (Nằm phía bên phải dưới Mục III) */}
      <div className="grid grid-cols-12 mt-2">
        <div className="col-span-5 sm:col-span-6"></div>
        <div className="col-span-7 sm:col-span-6 text-center">
          <div className="font-bold text-xs sm:text-sm uppercase leading-tight">
            XÁC NHẬN CỦA<br />
            TẬP THỂ LÃNH ĐẠO CƠ QUAN, ĐƠN VỊ
          </div>
          <div className="italic text-[11px] sm:text-xs text-gray-600 mt-0.5">
            *(Xác lập thời điểm, ký, ghi rõ họ tên và đóng dấu)*
          </div>
          <div className="h-28"></div>
        </div>
      </div>
    </div>
  );
}
