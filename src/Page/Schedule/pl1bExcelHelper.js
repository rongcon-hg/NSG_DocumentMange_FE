import { PL1B_SECTIONS, PL1B_MAX_SCORE_A } from './pl1bConstants';

/**
 * Xuất trang tính Excel cho Mẫu 01-B / Phụ lục 1B (Bản tự đánh giá, xếp loại cá nhân)
 */
export const addPhuLuc1BSheet = (workbook, record, pl1bState, sheetName = 'Phu_Luc_1B', periodInfo = {}) => {
  const user = record.user || {};
  const userName = user.name || '';
  const userPosition = user.position?.positionName || '';
  const deptName = user.department?.departmentName || '';
  const details = record.details || [];

  const ws = workbook.addWorksheet(sheetName, {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 },
  });

  ws.columns = [
    { key: 'c1', width: 8 },   // TT
    { key: 'c2', width: 44 },  // Tiêu chí / Nội dung
    { key: 'c3', width: 12 },  // Đảm bảo (x)
    { key: 'c4', width: 14 },  // Không đảm bảo (x)
    { key: 'c5', width: 13 },  // Điểm tối đa
    { key: 'c6', width: 15 },  // Điểm đạt
    { key: 'c7', width: 18 },  // Ghi chú
  ];

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const headerFont = { name: 'Times New Roman', size: 11 };
  const boldHeaderFont = { name: 'Times New Roman', size: 11, bold: true };

  // Dòng 1: Mẫu 01-B
  const r1 = ws.addRow(['', '', '', '', '', '', 'Mẫu 01-B']);
  r1.getCell(7).font = { name: 'Times New Roman', size: 11, bold: true };
  r1.getCell(7).alignment = { horizontal: 'right' };

  // Dòng 2: Quốc hiệu / Cơ quan
  ws.mergeCells('A2:B2');
  ws.mergeCells('C2:G2');
  const r2 = ws.getRow(2);
  r2.getCell(1).value = 'ỦY BAN NHÂN DÂN THÀNH PHỐ HỒ CHÍ MINH';
  r2.getCell(1).font = headerFont;
  r2.getCell(1).alignment = { horizontal: 'center' };
  r2.getCell(3).value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
  r2.getCell(3).font = boldHeaderFont;
  r2.getCell(3).alignment = { horizontal: 'center' };

  // Dòng 3
  ws.mergeCells('A3:B3');
  ws.mergeCells('C3:G3');
  const r3 = ws.getRow(3);
  r3.getCell(1).value = 'TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN';
  r3.getCell(1).font = boldHeaderFont;
  r3.getCell(1).alignment = { horizontal: 'center' };
  r3.getCell(3).value = 'Độc lập - Tự do - Hạnh phúc';
  r3.getCell(3).font = { ...boldHeaderFont, underline: true };
  r3.getCell(3).alignment = { horizontal: 'center' };

  // Dòng 4: Ngày tháng
  ws.mergeCells('C4:G4');
  const r4 = ws.getRow(4);
  const now = new Date();
  r4.getCell(3).value = `Thành phố Hồ Chí Minh, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
  r4.getCell(3).font = { name: 'Times New Roman', size: 11, italic: true };
  r4.getCell(3).alignment = { horizontal: 'center' };

  // Dòng 6: Tiêu đề BẢN TỰ ĐÁNH GIÁ, XẾP LOẠI CỦA CÁ NHÂN
  ws.mergeCells('A6:G6');
  const r6 = ws.getRow(6);
  r6.getCell(1).value = 'BẢN TỰ ĐÁNH GIÁ, XẾP LOẠI CỦA CÁ NHÂN';
  r6.getCell(1).font = { name: 'Times New Roman', size: 14, bold: true };
  r6.getCell(1).alignment = { horizontal: 'center' };

  // Dòng 7: Kỳ đánh giá
  ws.mergeCells('A7:G7');
  const r7 = ws.getRow(7);
  r7.getCell(1).value = periodInfo.periodLabel || 'Quý ... Năm 2026';
  r7.getCell(1).font = { name: 'Times New Roman', size: 12, bold: true };
  r7.getCell(1).alignment = { horizontal: 'center' };

  // Thông tin cá nhân
  const addInfoRow = (label1, val1, label2, val2) => {
    const row = ws.addRow([label1, val1, '', '', label2, val2, '']);
    row.font = { name: 'Times New Roman', size: 11 };
    return row;
  };

  addInfoRow('Họ và tên:', userName, 'Ngày sinh:', pl1bState?.dob || '...');
  addInfoRow('Chức vụ Đảng:', pl1bState?.partyRole || 'Đảng viên', 'Chức vụ chính quyền:', userPosition);
  addInfoRow('Chức vụ đoàn thể:', pl1bState?.unionRole || 'Công đoàn viên', 'Đơn vị công tác:', deptName);

  const introRow = ws.addRow(['I. Tự đánh giá kết quả thực hiện nhiệm vụ:']);
  introRow.font = { name: 'Times New Roman', size: 11, bold: true };
  const subIntroRow = ws.addRow(['(Căn cứ vào nhiệm vụ được giao, cá nhân tự đánh giá kết quả thực hiện nhiệm vụ theo quý, như sau:)']);
  subIntroRow.font = { name: 'Times New Roman', size: 11, italic: true };

  // Bảng A: Nhóm tiêu chí chung
  const headerA = ws.addRow(['A. NHÓM TIÊU CHÍ CHUNG (30 ĐIỂM)']);
  headerA.font = { name: 'Times New Roman', size: 11, bold: true };

  // Tiêu đề bảng
  const tableHeaderRow = ws.addRow([
    'TT',
    'Tiêu chí / Nội dung',
    'Đảm bảo\n(Đánh dấu x)',
    'Không đảm bảo\n(Đánh dấu x)',
    'Điểm\ntối đa',
    'Điểm đạt\n(Tối đa nếu đảm bảo;\n0 nếu không đảm bảo)',
    'Ghi chú',
  ]);
  tableHeaderRow.height = 36;
  tableHeaderRow.font = { name: 'Times New Roman', size: 10, bold: true };
  tableHeaderRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  for (let c = 1; c <= 7; c++) {
    tableHeaderRow.getCell(c).border = thinBorder;
    tableHeaderRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  }

  let totalScoreA = 0;
  const scores = pl1bState?.scores || {};
  const notes = pl1bState?.notes || {};

  PL1B_SECTIONS.forEach((section) => {
    // Dòng nhóm (ví dụ: 1. Về phẩm chất chính trị...)
    let sectionScore = 0;
    section.items.forEach((item) => {
      sectionScore += Number(scores[item.code] || 0);
    });

    const secRow = ws.addRow([section.id, section.title, '', '', section.maxScore, sectionScore, '']);
    secRow.font = { name: 'Times New Roman', size: 10, bold: true };
    secRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    secRow.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    secRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    for (let c = 1; c <= 7; c++) {
      secRow.getCell(c).border = thinBorder;
      secRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    }

    section.items.forEach((item) => {
      const itemScore = Number(scores[item.code] !== undefined ? scores[item.code] : item.maxScore);
      totalScoreA += itemScore;
      const isPass = itemScore === item.maxScore;
      const isFail = itemScore === 0;

      const itemRow = ws.addRow([
        item.code,
        item.content,
        isPass ? 'x' : '',
        isFail ? 'x' : '',
        item.maxScore,
        itemScore,
        notes[item.code] || '',
      ]);
      itemRow.font = { name: 'Times New Roman', size: 10 };
      itemRow.getCell(1).alignment = { horizontal: 'center', vertical: 'top' };
      itemRow.getCell(2).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      itemRow.getCell(3).alignment = { horizontal: 'center', vertical: 'top' };
      itemRow.getCell(4).alignment = { horizontal: 'center', vertical: 'top' };
      itemRow.getCell(5).alignment = { horizontal: 'center', vertical: 'top' };
      itemRow.getCell(6).alignment = { horizontal: 'center', vertical: 'top' };
      itemRow.getCell(7).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };

      for (let c = 1; c <= 7; c++) {
        itemRow.getCell(c).border = thinBorder;
      }
    });
  });

  // Dòng Tổng A
  const rowTotalA = ws.addRow(['', 'Tổng (A)', '', '', PL1B_MAX_SCORE_A, totalScoreA, '']);
  rowTotalA.font = { name: 'Times New Roman', size: 10, bold: true };
  rowTotalA.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
  rowTotalA.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
  rowTotalA.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
  for (let c = 1; c <= 7; c++) {
    rowTotalA.getCell(c).border = thinBorder;
    rowTotalA.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
  }

  // B. Kết quả thực hiện nhiệm vụ được giao (70 điểm)
  ws.addRow([]);
  const headerB = ws.addRow(['B. KẾT QUẢ THỰC HIỆN NHIỆM VỤ ĐƯỢC GIAO (70 ĐIỂM)']);
  headerB.font = { name: 'Times New Roman', size: 11, bold: true };
  const subB = ws.addRow(['(Nhập những nhiệm vụ trọng tâm được giao trong quý đã thực hiện)']);
  subB.font = { name: 'Times New Roman', size: 10, italic: true };

  // Liệt kê chi tiết các công việc trong kỳ
  details.forEach((t, idx) => {
    const taskRow = ws.addRow([
      idx + 1,
      t.title || 'Công việc',
      '',
      '',
      '',
      t.executionScore || t.actualScore || '',
      t.outputResult || '',
    ]);
    taskRow.font = { name: 'Times New Roman', size: 9 };
    taskRow.getCell(1).alignment = { horizontal: 'center', vertical: 'top' };
    taskRow.getCell(2).alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
    taskRow.getCell(6).alignment = { horizontal: 'center', vertical: 'top' };
    taskRow.getCell(7).alignment = { horizontal: 'left', vertical: 'top' };
    for (let c = 1; c <= 7; c++) taskRow.getCell(c).border = thinBorder;
  });

  // Điểm KPI thang 70 từ Phụ lục 4
  const kpiScore70 = record.kpiScore70 !== undefined
    ? Number(record.kpiScore70)
    : Number((((record.kpiScore || 0) * 70) / 100).toFixed(1));

  const rowTotalB = ws.addRow([
    '',
    'TỔNG (B) = Điểm KPI đã tính tại bảng tính điểm (Phụ lục 4)',
    '',
    '',
    70,
    kpiScore70,
    'Máy rút điểm',
  ]);
  rowTotalB.font = { name: 'Times New Roman', size: 10, bold: true };
  rowTotalB.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
  rowTotalB.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
  rowTotalB.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
  for (let c = 1; c <= 7; c++) {
    rowTotalB.getCell(c).border = thinBorder;
    rowTotalB.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } };
  }

  // C. Điểm thưởng
  const bonusScore = Number(record.totalBonusScore || 0);
  const rowC = ws.addRow(['', 'C. ĐIỂM THƯỞNG (NẾU CÓ)', '', '', '', bonusScore > 0 ? `+${bonusScore}` : 0, '']);
  rowC.font = { name: 'Times New Roman', size: 10, bold: true };
  for (let c = 1; c <= 7; c++) {
    rowC.getCell(c).border = thinBorder;
  }

  // Tổng A + B + Điểm thưởng
  const finalTotalScore = Number(Math.min(100, Math.round((totalScoreA + kpiScore70 + bonusScore) * 10) / 10).toFixed(1));
  const rowFinal = ws.addRow(['', 'TỔNG (A + B + Điểm thưởng (nếu có))', '', '', 100, finalTotalScore, '']);
  rowFinal.font = { name: 'Times New Roman', size: 11, bold: true };
  rowFinal.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
  rowFinal.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
  for (let c = 1; c <= 7; c++) {
    rowFinal.getCell(c).border = thinBorder;
    rowFinal.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
  }

  // Mục II: Xếp loại
  ws.addRow([]);
  const rankText =
    pl1bState?.selfRank === 'XS'
      ? 'Hoàn thành xuất sắc nhiệm vụ'
      : pl1bState?.selfRank === 'T'
      ? 'Hoàn thành tốt nhiệm vụ'
      : pl1bState?.selfRank === 'HTNV'
      ? 'Hoàn thành nhiệm vụ'
      : 'Không hoàn thành nhiệm vụ';

  const sec2Title = ws.addRow([`II. Tự đề xuất xếp loại mức chất lượng: ${rankText} ............................................................................`]);
  sec2Title.font = { name: 'Times New Roman', size: 11, bold: true };

  const sec2Sub = ws.addRow(['(Theo 04 mức: - Hoàn thành xuất sắc nhiệm vụ, 2- Hoàn thành tốt nhiệm vụ, 3- Hoàn thành nhiệm vụ và 4- Không hoàn thành nhiệm vụ)']);
  sec2Sub.font = { name: 'Times New Roman', size: 10, italic: true };

  const sec2Note = ws.addRow(['Tiêu chí đánh giá, xếp loại chất lượng thực hiện theo mục 2.3, khoản 2, phần IV của Kế hoạch số 13-KH/TU của Ban Thường vụ Thành ủy; trong đó, trường hợp cá nhân “Hoàn thành xuất sắc nhiệm vụ” ngoài kết quả tổng điểm đạt từ 90 điểm trở lên, các địa phương, lĩnh vực, cơ quan, đơn vị, bộ phận do cá nhân trực tiếp lãnh đạo, quản lý hoàn thành 100% nhiệm vụ được giao; trong đó có ít nhất 30% số nhiệm vụ hoàn thành vượt mức yêu cầu.']);
  sec2Note.font = { name: 'Times New Roman', size: 9.5, italic: true };
  ws.mergeCells(`A${sec2Note.number}:G${sec2Note.number}`);
  sec2Note.getCell(1).alignment = { wrapText: true };
  sec2Note.height = 36;

  // Cá nhân tự đánh giá (nằm phía bên phải dưới Mục II)
  ws.addRow([]);
  const rSelfSignTitle = ws.addRow(['', '', '', '', 'CÁ NHÂN TỰ ĐÁNH GIÁ', '', '']);
  rSelfSignTitle.font = { name: 'Times New Roman', size: 11, bold: true };
  ws.mergeCells(`E${rSelfSignTitle.number}:G${rSelfSignTitle.number}`);
  rSelfSignTitle.getCell(5).alignment = { horizontal: 'center' };

  const rSelfSignSub = ws.addRow(['', '', '', '', '(Ký, ghi rõ họ tên)', '', '']);
  rSelfSignSub.font = { name: 'Times New Roman', size: 10, italic: true };
  ws.mergeCells(`E${rSelfSignSub.number}:G${rSelfSignSub.number}`);
  rSelfSignSub.getCell(5).alignment = { horizontal: 'center' };

  ws.addRow([]);
  ws.addRow([]);
  ws.addRow([]);

  const rSelfName = ws.addRow(['', '', '', '', userName, '', '']);
  rSelfName.font = { name: 'Times New Roman', size: 11, bold: true };
  ws.mergeCells(`E${rSelfName.number}:G${rSelfName.number}`);
  rSelfName.getCell(5).alignment = { horizontal: 'center' };

  // Mục III: Nhận xét, đánh giá của cấp có thẩm quyền
  ws.addRow([]);
  const sec3Title = ws.addRow(['III. Nhận xét, đánh giá của cấp có thẩm quyền']);
  sec3Title.font = { name: 'Times New Roman', size: 11, bold: true };

  const sec3Score = ws.addRow(['- Chấm điểm: ....................................................................................................................................................']);
  sec3Score.font = { name: 'Times New Roman', size: 10 };

  const sec3Rank = ws.addRow(['- Đề xuất xếp loại: ............................................................................................................................................']);
  sec3Rank.font = { name: 'Times New Roman', size: 10 };

  // Xác nhận của tập thể lãnh đạo cơ quan, đơn vị (phía bên phải dưới Mục III)
  ws.addRow([]);
  const rLeader1 = ws.addRow(['', '', '', 'XÁC NHẬN CỦA', '', '', '']);
  rLeader1.font = { name: 'Times New Roman', size: 11, bold: true };
  ws.mergeCells(`D${rLeader1.number}:G${rLeader1.number}`);
  rLeader1.getCell(4).alignment = { horizontal: 'center' };

  const rLeader2 = ws.addRow(['', '', '', 'TẬP THỂ LÃNH ĐẠO CƠ QUAN, ĐƠN VỊ', '', '', '']);
  rLeader2.font = { name: 'Times New Roman', size: 11, bold: true };
  ws.mergeCells(`D${rLeader2.number}:G${rLeader2.number}`);
  rLeader2.getCell(4).alignment = { horizontal: 'center' };

  const rLeader3 = ws.addRow(['', '', '', '*(Xác lập thời điểm, ký, ghi rõ họ tên và đóng dấu)*', '', '', '']);
  rLeader3.font = { name: 'Times New Roman', size: 9.5, italic: true };
  ws.mergeCells(`D${rLeader3.number}:G${rLeader3.number}`);
  rLeader3.getCell(4).alignment = { horizontal: 'center' };

  ws.addRow([]);
  ws.addRow([]);
  ws.addRow([]);
};
