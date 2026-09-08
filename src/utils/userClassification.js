/**
 * Kiểm tra xem người dùng có thuộc Ban Giám hiệu hay không
 */
export const isBghUser = (u) => {
  if (!u) return false;
  const deptCode = (u.department?.departmentCode || "").toUpperCase();
  const deptName = (u.department?.departmentName || "").toLowerCase();
  const posName = (u.position?.positionName || "").toLowerCase();
  const posCode = (u.position?.abbreviation || u.position?.code || "").toUpperCase();

  return (
    deptCode === "BGH" ||
    deptName.includes("ban giám hiệu") ||
    ["HT", "PHT", "NHT"].includes(posCode) ||
    posName.includes("hiệu trưởng") ||
    posName.includes("phó hiệu trưởng")
  );
};

/**
 * Phân loại danh sách người dùng thành 5 nhóm theo thứ tự hiển thị:
 * 1. Nhóm người dùng thuộc BGH
 * 2. Nhóm người cấp trưởng
 * 3. Nhóm người dùng cấp phó
 * 4. Nhóm người dùng chuyên viên
 * 5. Nhóm người dùng manager
 * (Kèm nhóm khác nếu có tài khoản mới phát sinh)
 */
export const categorizeUsers = (users = []) => {
  const bgh = [];
  const capTruong = [];
  const capPho = [];
  const chuyenVien = [];
  const manager = [];
  const others = [];

  const sortByName = (a, b) => (a.name || "").localeCompare(b.name || "", "vi");

  // Loại bỏ tài khoản hệ thống (ví dụ: QTV QLVB)
  const validUsers = (users || []).filter(
    (u) => u && u.role !== null && u.email?.toLowerCase() !== "qlvb@nsgpc.edu.vn"
  );

  for (const user of validUsers) {
    if (isBghUser(user)) {
      bgh.push(user);
    } else if (user.role === "staff") {
      capTruong.push(user);
    } else if (user.role === "cappho") {
      capPho.push(user);
    } else if (user.role === "chuyenvien") {
      chuyenVien.push(user);
    } else if (user.role === "manager" || user.role === "admin") {
      manager.push(user);
    } else {
      others.push(user);
    }
  }

  bgh.sort(sortByName);
  capTruong.sort(sortByName);
  capPho.sort(sortByName);
  chuyenVien.sort(sortByName);
  manager.sort(sortByName);
  others.sort(sortByName);

  const groups = [
    {
      key: "bgh",
      label: `1. Nhóm người dùng thuộc BGH (${bgh.length})`,
      users: bgh,
    },
    {
      key: "capTruong",
      label: `2. Nhóm người cấp trưởng (${capTruong.length})`,
      users: capTruong,
    },
    {
      key: "capPho",
      label: `3. Nhóm người dùng cấp phó (${capPho.length})`,
      users: capPho,
    },
    {
      key: "chuyenVien",
      label: `4. Nhóm người dùng chuyên viên (${chuyenVien.length})`,
      users: chuyenVien,
    },
    {
      key: "manager",
      label: `5. Nhóm người dùng manager (${manager.length})`,
      users: manager,
    },
  ];

  if (others.length > 0) {
    groups.push({
      key: "others",
      label: `Nhóm người dùng khác (${others.length})`,
      users: others,
    });
  }

  return groups;
};
