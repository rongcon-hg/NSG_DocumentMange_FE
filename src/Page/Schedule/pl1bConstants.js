// Danh mục tiêu chí Phụ lục 1B (Mẫu 01-B: Bản tự đánh giá, xếp loại của cá nhân theo quý)
export const PL1B_SECTIONS = [
  {
    id: 1,
    title: "1. Về phẩm chất chính trị, đạo đức, lối sống, thực hiện trách nhiệm nêu gương",
    maxScore: 18,
    items: [
      {
        code: "1.1",
        content: "Tuyệt đối trung thành với Đảng, Tổ quốc và Nhân dân; kiên định mục tiêu độc lập dân tộc và chủ nghĩa xã hội; có lập trường quan điểm, bản lĩnh chính trị vững vàng; bảo vệ nền tảng tư tưởng, đường lối, chủ trương của Đảng và pháp luật của Nhà nước.",
        maxScore: 2,
      },
      {
        code: "1.2",
        content: "Có tinh thần yêu nước, tận tụy phục vụ Nhân dân, luôn hành động vì lợi ích chung; đặt lợi ích của tập thể, cơ quan, đơn vị lên trên lợi ích cá nhân.",
        maxScore: 2,
      },
      {
        code: "1.3",
        content: "Chấp hành nghiêm chủ trương, đường lối, quy định và nguyên tắc tổ chức kỷ luật; chấp hành pháp luật của Nhà nước và quy chế nội bộ; chấp hành sự phân công, hoàn thành tốt nhiệm vụ được giao.",
        maxScore: 2,
      },
      {
        code: "1.4",
        content: "Có tinh thần học tập, tự bồi dưỡng, cập nhật kiến thức mới nhằm nâng cao trình độ chuyên môn, nghiệp vụ đáp ứng yêu cầu công tác.",
        maxScore: 2,
      },
      {
        code: "1.5",
        content: "Có phẩm chất đạo đức tốt, lối sống trong sáng, trung thực, khiêm tốn, giản dị, cần kiệm liêm chính; thực hiện chuẩn mực đạo đức nghề nghiệp, trách nhiệm nêu gương, không vi phạm quy định cơ quan.",
        maxScore: 2,
      },
      {
        code: "1.6",
        content: "Không có biểu hiện tiêu cực, lãng phí, tham nhũng, cơ hội, bè phái; kiên quyết đấu tranh chống quan liêu, tiêu cực; thực hiện nói đi đôi với làm.",
        maxScore: 2,
      },
      {
        code: "1.7",
        content: "Có tinh thần đoàn kết nội bộ, phong cách làm việc dân chủ, hòa đồng, hỗ trợ đồng nghiệp hoàn thành tốt nhiệm vụ chung.",
        maxScore: 2,
      },
      {
        code: "1.8",
        content: "Chủ động, tích cực tham gia các phong trào thi đua, đóng góp vào sự phát triển chung của cơ quan, đơn vị.",
        maxScore: 2,
      },
      {
        code: "1.9",
        content: "Thực hiện đầy đủ, trung thực việc kê khai tài sản, thu nhập theo quy định (nếu có); báo cáo trung thực, kịp thời tình hình thực hiện nhiệm vụ với lãnh đạo đơn vị.",
        maxScore: 2,
      },
    ],
  },
  {
    id: 2,
    title: "2. Tư duy đổi mới, năng động, khát vọng cống hiến, dám nghĩ dám làm",
    maxScore: 4,
    items: [
      {
        code: "2.1",
        content: "Có tư duy đổi mới, thích ứng với yêu cầu phát triển và chuyển đổi số; phương pháp làm việc khoa học, hiệu quả.",
        maxScore: 2,
      },
      {
        code: "2.2",
        content: "Chủ động đề xuất sáng kiến, giải pháp cải tiến công việc, nâng cao năng suất và chất lượng công tác.",
        maxScore: 1,
      },
      {
        code: "2.3",
        content: "Dám nghĩ, dám làm, dám chịu trách nhiệm vì lợi ích chung; khắc phục khó khăn hoàn thành tốt các nhiệm vụ mới, nhiệm vụ khó.",
        maxScore: 1,
      },
    ],
  },
  {
    id: 3,
    title: "3. Về tự phê bình và phê bình, tự soi, tự sửa, khắc phục hạn chế, khuyết điểm",
    maxScore: 8,
    items: [
      {
        code: "3.1",
        content: "Nghiêm túc thực hiện tự phê bình và phê bình; lắng nghe, tiếp thu góp ý của đồng nghiệp và lãnh đạo đơn vị.",
        maxScore: 2,
      },
      {
        code: "3.2",
        content: "Có kế hoạch và biện pháp khắc phục cụ thể các hạn chế, thiếu sót đã được chỉ ra trong kỳ trước.",
        maxScore: 2,
      },
      {
        code: "3.3",
        content: "Kết quả khắc phục chuyển biến rõ rệt, không để tái diễn tồn tại, thiếu sót trong quá trình thực hiện nhiệm vụ.",
        maxScore: 2,
      },
      {
        code: "3.4",
        content: "Thường xuyên tự rà soát, tự điều chỉnh tác phong, phương pháp làm việc đúng quy định, đúng thẩm quyền.",
        maxScore: 2,
      },
    ],
  },
];

export const PL1B_MAX_SCORE_A = 30;
export const PL1B_MAX_SCORE_B = 70;

export const getAllPL1BItems = () => {
  const items = [];
  PL1B_SECTIONS.forEach((sec) => {
    sec.items.forEach((it) => {
      items.push({ ...it, sectionId: sec.id });
    });
  });
  return items;
};

// Tạo trạng thái chấm điểm mặc định (đầy đủ điểm tối đa)
export const getDefaultPL1BState = () => {
  const scores = {};
  const notes = {};
  getAllPL1BItems().forEach((it) => {
    scores[it.code] = it.maxScore;
    notes[it.code] = "";
  });
  return {
    scores,
    notes,
    selfRank: "XS",
    dob: "",
    partyRole: "",
    unionRole: "",
  };
};
