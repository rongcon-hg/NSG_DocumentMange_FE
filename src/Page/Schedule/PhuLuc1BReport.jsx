import React, { useMemo } from 'react';
import { Button, Input, InputNumber, Radio, Tag, Space, Tooltip, Alert } from 'antd';
import { CheckCircleOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { PL1B_SECTIONS, PL1B_MAX_SCORE_A } from './pl1bConstants';

const API_URL = import.meta.env.VITE_API_URL || '';

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

  return (
    <div className="bg-white p-4 sm:p-6 text-black font-['Times_New_Roman',serif] text-[13px] leading-relaxed">
      {/* Thanh công cụ tương tác nhanh (chỉ hiển thị trên web, ẩn khi in) */}
      {!isPrintView && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 text-sm">Tiện ích Phụ lục 1B:</span>
              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                onClick={onSelectAllMax}
              >
                Tích chọn tất cả Đảm bảo (Tối đa 30đ)
              </Button>
              <Button size="small" icon={<ReloadOutlined />} onClick={onResetScores}>
                Đặt lại điểm về 0
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Tag color="green" className="font-semibold text-xs py-0.5">
                Điểm chung (A): {totalScoreA} / 30đ
              </Tag>
              <Tag color="blue" className="font-semibold text-xs py-0.5">
                Điểm KPI Phụ lục 4 (B): {kpiScore70} / 70đ
              </Tag>
              {bonusScore > 0 && (
                <Tag color="gold" className="font-semibold text-xs py-0.5">
                  Thưởng (C): +{bonusScore}đ
                </Tag>
              )}
              <Tag color="purple" className="font-bold text-sm py-0.5">
                TỔNG ĐIỂM: {finalTotalScore} / 100đ
              </Tag>
            </div>
          </div>

          <Alert
            type="info"
            showIcon
            className="text-xs"
            message={
              <span>
                <strong>Hướng dẫn:</strong> Bấm chọn ô <i>"Đảm bảo"</i> để lấy điểm tối đa, hoặc gõ trực tiếp vào cột <i>Điểm đạt</i> (không vượt quá điểm tối đa). Cột <strong>Điểm đạt được của Nhóm B</strong> được hệ thống tự động rút từ Phụ lục 4.
              </span>
            }
          />
        </div>
      )}

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
        <div className="flex flex-wrap items-center gap-x-4">
          <div>
            Họ và tên: <strong className="uppercase">{userName}</strong>
          </div>
          <div className="flex items-center gap-1">
            <span>Ngày sinh:</span>
            {!isPrintView ? (
              <Input
                size="small"
                className="w-28 text-xs inline-block"
                placeholder="DD/MM/YYYY"
                value={pl1bState?.dob || ''}
                onChange={(e) => onChangeState({ ...pl1bState, dob: e.target.value })}
              />
            ) : (
              <strong>{pl1bState?.dob || '...'}</strong>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6">
          <div className="flex items-center gap-1">
            <span>Chức vụ Đảng:</span>
            {!isPrintView ? (
              <Input
                size="small"
                className="w-32 text-xs inline-block"
                placeholder="Đảng viên / Bí thư..."
                value={pl1bState?.partyRole !== undefined ? pl1bState.partyRole : 'Đảng viên'}
                onChange={(e) => onChangeState({ ...pl1bState, partyRole: e.target.value })}
              />
            ) : (
              <strong>{pl1bState?.partyRole || 'Đảng viên'}</strong>
            )}
          </div>
          <div>
            Chức vụ chính quyền: <strong>{userPosition}</strong>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6">
          <div className="flex items-center gap-1">
            <span>Chức vụ đoàn thể:</span>
            {!isPrintView ? (
              <Input
                size="small"
                className="w-32 text-xs inline-block"
                placeholder="Công đoàn viên..."
                value={pl1bState?.unionRole !== undefined ? pl1bState.unionRole : 'Công đoàn viên'}
                onChange={(e) => onChangeState({ ...pl1bState, unionRole: e.target.value })}
              />
            ) : (
              <strong>{pl1bState?.unionRole || 'Công đoàn viên'}</strong>
            )}
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
        <table className="w-full border-collapse border border-black text-xs">
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
                        <td className="border border-black p-1 text-center">
                          {!isPrintView ? (
                            <InputNumber
                              min={0}
                              max={item.maxScore}
                              step={0.5}
                              size="small"
                              className="w-16 font-bold text-blue-900"
                              value={currentVal}
                              onChange={(v) => handleScoreChange(item.code, item.maxScore, v)}
                            />
                          ) : (
                            <span className="font-bold">{currentVal}</span>
                          )}
                        </td>

                        {/* Ghi chú */}
                        <td className="border border-black p-1">
                          {!isPrintView ? (
                            <Input
                              size="small"
                              className="text-xs"
                              placeholder="Ghi chú..."
                              value={notes[item.code] || ''}
                              onChange={(e) => handleNoteChange(item.code, e.target.value)}
                            />
                          ) : (
                            <span>{notes[item.code] || ''}</span>
                          )}
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

      {/* B. KẾT QUẢ THỰC HIỆN NHIỆM VỤ ĐƯỢC GIAO (70 ĐIỂM) */}
      <div className="mb-4">
        <div className="font-bold text-xs uppercase mb-1">
          B. KẾT QUẢ THỰC HIỆN NHIỆM VỤ ĐƯỢC GIAO (70 ĐIỂM)
        </div>
        <div className="italic text-xs text-gray-700 mb-2">
          (Nhập những nhiệm vụ trọng tâm được giao trong quý đã thực hiện)
        </div>

        <table className="w-full border-collapse border border-black text-xs">
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

      {/* II. Tự đề xuất xếp loại mức chất lượng */}
      <div className="mb-6 space-y-2">
        <div className="font-bold text-xs uppercase">II. Tự đề xuất xếp loại mức chất lượng:</div>
        <div className="italic text-xs text-gray-700">
          (Chọn 01 trong 4 mức: 1. Hoàn thành xuất sắc nhiệm vụ; 2. Hoàn thành tốt nhiệm vụ; 3. Hoàn thành nhiệm vụ; 4. Không hoàn thành nhiệm vụ)
        </div>

        {!isPrintView ? (
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <Radio.Group
              value={activeRank}
              onChange={(e) => onChangeState({ ...pl1bState, selfRank: e.target.value })}
              className="flex flex-wrap gap-4 text-xs font-semibold"
            >
              <Radio value="XS">
                <span className={activeRank === 'XS' ? 'text-green-700 font-bold' : ''}>
                  1. Hoàn thành xuất sắc nhiệm vụ (từ 90đ trở lên)
                </span>
              </Radio>
              <Radio value="T">
                <span className={activeRank === 'T' ? 'text-blue-700 font-bold' : ''}>
                  2. Hoàn thành tốt nhiệm vụ (từ 70đ đến dưới 90đ)
                </span>
              </Radio>
              <Radio value="HTNV">
                <span className={activeRank === 'HTNV' ? 'text-amber-700 font-bold' : ''}>
                  3. Hoàn thành nhiệm vụ (từ 50đ đến dưới 70đ)
                </span>
              </Radio>
              <Radio value="KHT">
                <span className={activeRank === 'KHT' ? 'text-red-600 font-bold' : ''}>
                  4. Không hoàn thành nhiệm vụ (dưới 50đ)
                </span>
              </Radio>
            </Radio.Group>
          </div>
        ) : (
          <div className="font-bold text-sm my-1 pl-4">
            - Mức tự đề xuất:{' '}
            <span className="underline uppercase">
              {activeRank === 'XS'
                ? 'Hoàn thành xuất sắc nhiệm vụ'
                : activeRank === 'T'
                ? 'Hoàn thành tốt nhiệm vụ'
                : activeRank === 'HTNV'
                ? 'Hoàn thành nhiệm vụ'
                : 'Không hoàn thành nhiệm vụ'}
            </span>{' '}
            (Tổng điểm đạt: <strong>{finalTotalScore}/100đ</strong>)
          </div>
        )}

        <div className="text-[11px] italic text-gray-600 leading-normal pl-2 border-l-2 border-gray-300">
          Tiêu chí đánh giá, xếp loại chất lượng thực hiện theo mục 2, 3, khoản 1, điều 57 của Kế hoạch số 13-KH/TU của Ban Thường vụ Thành ủy: trong đó, trường hợp cá nhân "Hoàn thành xuất sắc nhiệm vụ" ngoài kết quả tổng điểm đạt từ 90 điểm trở lên các địa phương, lĩnh vực cơ quan đơn vị, bộ phận đó có tỉ lệ cán bộ, công chức, viên chức hoàn thành 100% nhiệm vụ được giao; trong đó có ít nhất 20% cá nhân đạt hoàn thành xuất sắc nhiệm vụ.
        </div>
      </div>

      {/* Phần Ký tên 3 cột chuẩn biểu mẫu */}
      <div className="mt-8 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-center text-xs sm:text-sm">
          {/* Cột trái: Nhận xét đánh giá của cấp có thẩm quyền & Lãnh đạo đơn vị */}
          <div>
            <div className="font-bold uppercase text-left mb-2">III. Nhận xét, đánh giá của cấp có thẩm quyền:</div>
            <div className="text-left text-xs space-y-1 mb-4">
              <div>- Chấm điểm: ....................................................</div>
              <div>- Đề xuất xếp loại: ...........................................</div>
            </div>

            <div className="font-bold uppercase mt-6">XÁC NHẬN CỦA TẬP THỂ LÃNH ĐẠO CƠ QUAN, ĐƠN VỊ</div>
            <div className="italic text-xs">(Ký, ghi rõ họ tên và đóng dấu)</div>
            <div className="h-28"></div>
          </div>

          {/* Cột phải: Cá nhân tự đánh giá */}
          <div>
            <div className="italic text-xs mb-1">
              Thành phố Hồ Chí Minh, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
            </div>
            <div className="font-bold uppercase">CÁ NHÂN TỰ ĐÁNH GIÁ</div>
            <div className="italic text-xs">(Ký, ghi rõ họ tên)</div>

            {effectiveSignature?.fileId ? (
              <div className="h-24 flex items-center justify-center py-1">
                <img
                  src={`${API_URL}/api/signature/image/${effectiveSignature.fileId}`}
                  alt="Chữ ký"
                  className="max-h-20 max-w-[180px] object-contain mix-blend-multiply pointer-events-none"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="h-24"></div>
            )}

            <div className="font-bold text-sm uppercase">{userName}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
