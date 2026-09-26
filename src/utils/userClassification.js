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
      label: `4. Nhóm người dùng GV-VC (${chuyenVien.length})`,
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

/**
 * Kiểm tra xem người dùng có phải là Cấp trưởng hay không (Trưởng phòng, Trưởng khoa, Giám đốc, Bí thư Đoàn...)
 */
export const isCapTruongUser = (u) => {
  if (!u || isBghUser(u)) return false;
  if (u.role === 'cappho') return false;
  const posCode = (u.position?.abbreviation || u.position?.code || u.position?.positionCode || '').toUpperCase();
  const posName = (u.position?.positionName || '').toLowerCase();
  
  // Kiểm tra mã chức vụ hoặc tên chức vụ cấp trưởng
  if (['TP', 'TK', 'GD', 'BT'].includes(posCode)) return true;
  if (/^(trưởng\s+(phòng|khoa|ban|trung tâm)|giám đốc|bí thư\s+đoàn)/i.test(posName)) return true;
  if (posName.includes('trưởng') && !posName.includes('phó')) return true;

  // Nếu role là staff và không có chữ phó trong chức danh
  return u.role === 'staff' && !posName.includes('phó');
};

/**
 * Kiểm tra xem người dùng có phải là Cấp phó hay không (Phó Trưởng phòng, Phó Trưởng khoa, Phó Bí thư...)
 */
export const isCapPhoUser = (u) => {
  if (!u || isBghUser(u) || isCapTruongUser(u)) return false;
  if (u.role === 'cappho') return true;
  const posCode = (u.position?.abbreviation || u.position?.code || u.position?.positionCode || '').toUpperCase();
  const posName = (u.position?.positionName || '').toLowerCase();

  if (['PTP', 'PTK', 'PGD', 'PBT'].includes(posCode)) return true;
  if (/^(phó\s+(trưởng|giám đốc|bí thư)|phó\s+trưởng\s+(phòng|khoa|ban|trung tâm))/i.test(posName)) return true;
  if (posName.includes('phó')) return true;

  return false;
};

/**
 * Lấy ID đơn vị của người dùng (hỗ trợ cả ObjectId dạng string lẫn object populated)
 */
export const getUserDepartmentId = (user) => {
  if (!user) return null;
  if (user.department && typeof user.department === 'object') {
    return String(user.department._id || user.department.id || '');
  }
  return user.department ? String(user.department) : null;
};

/**
 * Lọc danh sách người dùng có thể được gán công việc / phối hợp dựa theo vai trò của người đang thao tác:
 * - Manager và Ban Giám hiệu: Thấy hết danh sách người dùng.
 * - Cấp trưởng: Thấy danh sách các cấp trưởng, cấp phó các đơn vị khác và thành viên trong đơn vị mình.
 * - Cấp phó và GV-CV: Thấy các thành viên trong đơn vị mình.
 *
 * @param {Array} allUsers Danh sách người dùng
 * @param {Object} currentUser Người dùng hiện tại
 * @param {String} userRole Role của người dùng hiện tại
 * @returns {Array} Danh sách người dùng được phép gán việc
 */
export const getAssignableUsers = (allUsers = [], currentUser = null, userRole = '') => {
  if (!Array.isArray(allUsers) || allUsers.length === 0) return [];

  const normalizedRole = (currentUser?.role || userRole || '').toLowerCase();
  const isBgh = isBghUser(currentUser) || normalizedRole === 'bgh';
  const isManagerOrAdmin = ['admin', 'manager'].includes(normalizedRole);

  // 1. Manager và Ban Giám hiệu: Thấy hết danh sách người dùng
  if (isManagerOrAdmin || isBgh) {
    return allUsers;
  }

  const currentDeptId = getUserDepartmentId(currentUser);
  const isCapTruong = isCapTruongUser(currentUser) || (normalizedRole === 'staff' && !isCapPhoUser(currentUser));
  const isCapPho = isCapPhoUser(currentUser) || normalizedRole === 'cappho';

  // 2. Cấp trưởng và Cấp phó: Thấy danh sách thành viên đơn vị mình và danh sách cấp trưởng, cấp phó đơn vị khác (kèm BGH)
  if (isCapTruong || isCapPho) {
    return allUsers.filter((u) => {
      // Thành viên trong đơn vị mình
      const uDeptId = getUserDepartmentId(u);
      if (currentDeptId && uDeptId && uDeptId === currentDeptId) {
        return true;
      }
      // Cấp trưởng, cấp phó các đơn vị khác
      if (isCapTruongUser(u) || isCapPhoUser(u) || u.role === 'staff' || u.role === 'cappho') {
        return true;
      }
      // Ban Giám hiệu
      if (isBghUser(u)) {
        return true;
      }
      return false;
    });
  }

  // 3. GV-CV: Thấy danh sách các thành viên trong đơn vị mình
  return allUsers.filter((u) => {
    const uDeptId = getUserDepartmentId(u);
    if (currentDeptId && uDeptId && uDeptId === currentDeptId) {
      return true;
    }
    // Bản thân người dùng nếu chưa được gán phòng ban
    if (currentUser?._id && String(u._id) === String(currentUser._id)) {
      return true;
    }
    return false;
  });
};

