/**
 * Kiểm tra xem người dùng có phải là cựu lãnh đạo / nguyên lãnh đạo hay không
 * (Ví dụ: Nguyên Hiệu trưởng, Cựu Phó hiệu trưởng, Nguyên Trưởng phòng...)
 */
export const isFormerLeader = (u) => {
  if (!u) return false;
  const posName = (u.position?.positionName || "").toLowerCase();
  const posCode = (u.position?.abbreviation || u.position?.code || u.position?.positionCode || "").toUpperCase();
  return (
    posName.includes("nguyên") ||
    posName.includes("cựu") ||
    ["NHT", "NPHT"].includes(posCode)
  );
};

/**
 * Kiểm tra xem người dùng có thuộc Ban Giám hiệu đương nhiệm hay không
 */
export const isBghUser = (u) => {
  if (!u) return false;
  // Cựu lãnh đạo không thuộc BGH đương nhiệm
  if (isFormerLeader(u)) return false;

  const deptCode = (u.department?.departmentCode || "").toUpperCase();
  const deptName = (u.department?.departmentName || "").toLowerCase();
  const posName = (u.position?.positionName || "").toLowerCase();
  const posCode = (u.position?.abbreviation || u.position?.code || u.position?.positionCode || "").toUpperCase();

  // Đang thuộc đơn vị Ban Giám hiệu
  if (deptCode === "BGH" || deptName.includes("ban giám hiệu")) {
    return true;
  }

  // Hoặc đang giữ chức vụ BGH đương nhiệm
  if (["HT", "QHT", "PHT"].includes(posCode)) {
    return true;
  }

  if (
    posName.includes("quyền hiệu trưởng") ||
    posName.includes("phó hiệu trưởng") ||
    (posName.includes("hiệu trưởng") && !posName.includes("trợ lý") && !posName.includes("thư ký"))
  ) {
    return true;
  }

  return false;
};

/**
 * Kiểm tra xem người dùng có phải là Hiệu trưởng đương nhiệm (hoặc Quyền Hiệu trưởng) hay không
 */
export const isHieuTruongUser = (u) => {
  if (!u) return false;
  if (isFormerLeader(u)) return false;
  if (u.role === "admin") return true;
  const posCode = (u.position?.abbreviation || u.position?.code || u.position?.positionCode || "").toUpperCase();
  const posName = (u.position?.positionName || "").toLowerCase();
  return (
    ["HT", "QHT"].includes(posCode) ||
    posName.includes("quyền hiệu trưởng") ||
    (posName.includes("hiệu trưởng") && !posName.includes("phó"))
  );
};

/**
 * Phân loại danh sách người dùng thành 5 nhóm theo thứ tự hiển thị:
 * 1. Nhóm người dùng thuộc BGH
 * 2. Nhóm người cấp trưởng
 * 3. Nhóm người dùng cấp phó
 * 4. Nhóm người dùng chuyên viên (GV-VC)
 * 5. Nhóm người dùng manager
 * (Kèm nhóm khác nếu có tài khoản mới phát sinh)
 */
/**
 * Kiểm tra xem người dùng có phải thuộc nhóm chức vụ nội bộ/tổ chuyên môn/bộ môn/GV-CV/nhân viên hay không
 * (Ví dụ: Tổ trưởng tổ chuyên môn, Tổ phó chuyên môn, Tổ trưởng bộ môn, Giảng viên, Chuyên viên, Nhân viên...)
 * Các chức danh này KHÔNG PHẢI là Cấp trưởng/Cấp phó đơn vị quản lý (Trưởng phòng, Trưởng khoa, Giám đốc trung tâm).
 */
export const isInternalTeamOrStaff = (u) => {
  if (!u) return false;
  const posCode = (u.position?.abbreviation || u.position?.code || u.position?.positionCode || '').toUpperCase();
  const posName = (u.position?.positionName || '').toLowerCase();
  return (
    posName.includes("tổ trưởng") ||
    posName.includes("tổ phó") ||
    posName.includes("tổ chuyên môn") ||
    posName.includes("bộ môn") ||
    posName.includes("tổ bộ môn") ||
    posName.includes("tổ công đoàn") ||
    posName.includes("tổ văn phòng") ||
    posName.includes("tổ phục vụ") ||
    ['TTCM', 'TPCM', 'TTBM', 'TPBM', 'TCM', 'BM', 'GV', 'CV', 'NV'].includes(posCode) ||
    /^(giảng viên|chuyên viên|nhân viên|viên chức|kế toán|thủ quỹ|văn thư|thư ký|bảo vệ|tạp vụ)/i.test(posName)
  );
};

/**
 * Phân loại danh sách người dùng thành 5 nhóm theo thứ tự hiển thị:
 * 1. Nhóm người dùng thuộc BGH
 * 2. Nhóm người cấp trưởng
 * 3. Nhóm người dùng cấp phó
 * 4. Nhóm người dùng chuyên viên (GV-VC)
 * 5. Nhóm người dùng manager
 * (Kèm nhóm khác nếu có tài khoản mới phát sinh)
 */
export const categorizeUsers = (users = []) => {
  const bgh = [];
  const capTruong = [];
  const capPho = [];
  const chuyenVien = [];
  const manager = [];

  const sortByName = (a, b) => (a.name || "").localeCompare(b.name || "", "vi");

  // Loại bỏ tài khoản hệ thống (ví dụ: QTV QLVB)
  const validUsers = (users || []).filter(
    (u) => u && u.role !== null && u.email?.toLowerCase() !== "qlvb@nsgpc.edu.vn"
  );

  for (const user of validUsers) {
    if (isBghUser(user)) {
      bgh.push(user);
    } else if (user.role === "manager" || user.role === "admin") {
      manager.push(user);
    } else if (user.role === "chuyenvien" || isInternalTeamOrStaff(user)) {
      // Ưu tiên cao nhất: Người dùng đã được phân vai trò GV-VC (chuyenvien) ở trang Quản lý người dùng,
      // hoặc giữ các chức vụ nội bộ (Tổ trưởng/Tổ phó tổ chuyên môn, Tổ bộ môn, Giảng viên, Chuyên viên)
      // -> Phân đúng vào Nhóm GV-VC, tuyệt đối không đưa vào Cấp trưởng / Cấp phó.
      chuyenVien.push(user);
    } else if (isCapTruongUser(user)) {
      capTruong.push(user);
    } else if (isCapPhoUser(user)) {
      capPho.push(user);
    } else {
      // GV-VC / Chuyên viên / Nhân viên khác (bao gồm cựu lãnh đạo chuyển sang đơn vị khác)
      chuyenVien.push(user);
    }
  }

  bgh.sort(sortByName);
  capTruong.sort(sortByName);
  capPho.sort(sortByName);
  chuyenVien.sort(sortByName);
  manager.sort(sortByName);

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

  return groups;
};

/**
 * Kiểm tra xem người dùng có phải là Cấp trưởng hay không (Trưởng phòng, Trưởng khoa, Giám đốc, Bí thư Đoàn...)
 */
export const isCapTruongUser = (u) => {
  if (!u || isBghUser(u)) return false;
  if (isFormerLeader(u)) return false;

  // 1. Nếu người dùng được phân vai trò GV-VC (chuyenvien) hoặc Cấp phó (cappho), TUYỆT ĐỐI không phải là Cấp trưởng
  if (u.role === 'chuyenvien' || u.role === 'cappho') return false;

  // 2. Các chức danh thuộc tổ chuyên môn, tổ bộ môn, giảng viên, chuyên viên, nhân viên -> không phải Cấp trưởng đơn vị
  if (isInternalTeamOrStaff(u)) return false;

  const posCode = (u.position?.abbreviation || u.position?.code || u.position?.positionCode || '').toUpperCase();
  const posName = (u.position?.positionName || '').toLowerCase();

  // 3. Kiểm tra mã chức vụ hoặc tên chức vụ Cấp trưởng đơn vị (Trưởng phòng, Trưởng khoa, Giám đốc, Bí thư Đoàn...)
  if (['TP', 'TK', 'GD', 'BT', 'TB'].includes(posCode)) return true;
  if (/^(trưởng\s+(phòng|khoa|ban|trung tâm|trạm)|giám đốc|bí thư\s+đoàn)/i.test(posName)) return true;
  if (
    (posName.includes('trưởng phòng') ||
     posName.includes('trưởng khoa') ||
     posName.includes('trưởng ban') ||
     posName.includes('trưởng trung tâm') ||
     posName.includes('giám đốc') ||
     posName.includes('bí thư đoàn')) &&
    !posName.includes('phó') &&
    !posName.includes('hiệu trưởng')
  ) {
    return true;
  }

  // 4. Nếu role được phân rõ là 'staff' hoặc 'captruong' (và không có chữ phó/hiệu trưởng/tổ trong chức danh)
  return (u.role === 'captruong' || u.role === 'staff') &&
    !posName.includes('phó') &&
    !posName.includes('hiệu trưởng') &&
    !posName.includes('tổ');
};

/**
 * Kiểm tra xem người dùng có phải là Cấp phó hay không (Phó Trưởng phòng, Phó Trưởng khoa, Phó Bí thư...)
 */
export const isCapPhoUser = (u) => {
  if (!u || isBghUser(u) || isCapTruongUser(u)) return false;
  if (isFormerLeader(u)) return false;

  // 1. Nếu người dùng được phân vai trò GV-VC (chuyenvien), TUYỆT ĐỐI không phải là Cấp phó
  if (u.role === 'chuyenvien') return false;

  // 2. Các chức danh tổ chuyên môn, tổ bộ môn, GV-VC -> không phải Cấp phó đơn vị
  if (isInternalTeamOrStaff(u)) return false;

  // 3. Nếu role được gán rõ là 'cappho'
  if (u.role === 'cappho') return true;

  const posCode = (u.position?.abbreviation || u.position?.code || u.position?.positionCode || '').toUpperCase();
  const posName = (u.position?.positionName || '').toLowerCase();

  // 4. Kiểm tra mã chức vụ hoặc tên chức vụ Cấp phó đơn vị
  if (['PTP', 'PTK', 'PGD', 'PBT', 'PTB'].includes(posCode)) return true;
  if (/^(phó\s+(trưởng|giám đốc|bí thư)|phó\s+trưởng\s+(phòng|khoa|ban|trung tâm))/i.test(posName)) return true;
  if (
    (posName.includes('phó trưởng phòng') ||
     posName.includes('phó trưởng khoa') ||
     posName.includes('phó trưởng ban') ||
     posName.includes('phó trưởng trung tâm') ||
     posName.includes('phó giám đốc') ||
     posName.includes('phó bí thư')) &&
    !posName.includes('phó hiệu trưởng')
  ) {
    return true;
  }

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
  const isCapTruong = isCapTruongUser(currentUser) || (normalizedRole === 'captruong') || (normalizedRole === 'staff' && !isCapPhoUser(currentUser) && !isInternalTeamOrStaff(currentUser));
  const isCapPho = (isCapPhoUser(currentUser) || normalizedRole === 'cappho') && !isInternalTeamOrStaff(currentUser);

  // 2. Cấp trưởng và Cấp phó: Thấy danh sách thành viên đơn vị mình và danh sách cấp trưởng, cấp phó đơn vị khác (kèm BGH)
  if (isCapTruong || isCapPho) {
    return allUsers.filter((u) => {
      // Thành viên trong đơn vị mình
      const uDeptId = getUserDepartmentId(u);
      if (currentDeptId && uDeptId && uDeptId === currentDeptId) {
        return true;
      }
      // Cấp trưởng, cấp phó các đơn vị khác
      if (isCapTruongUser(u) || isCapPhoUser(u)) {
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

/**
 * Lọc danh sách thành viên/người thực hiện hiển thị trong bộ lọc công việc:
 * - Cấp trưởng: Chỉ hiển thị danh sách thành viên của đơn vị mình.
 * - Cấp phó: Thấy bản thân và nhân viên CB-CV thuộc đơn vị.
 * - Nhân viên CB-CV: Chỉ thấy bản thân mình.
 * - BGH / Admin / Manager: Thấy tất cả người dùng hợp lệ.
 *
 * @param {Array} allUsers Danh sách tất cả người dùng
 * @param {Object} currentUser Người dùng hiện tại
 * @param {String} userRole Role của người dùng hiện tại
 * @returns {Array} Danh sách người dùng được phép hiển thị trong bộ lọc
 */
export const getScheduleFilterUsers = (allUsers = [], currentUser = null, userRole = '') => {
  if (!Array.isArray(allUsers) || allUsers.length === 0) return [];

  const validUsers = allUsers.filter(
    (u) => u && u.role !== null && (u.email || '').trim().toLowerCase() !== 'qlvb@nsgpc.edu.vn'
  );

  const normalizedRole = (currentUser?.role || userRole || '').toLowerCase();
  const isBgh = isBghUser(currentUser) || normalizedRole === 'bgh';
  const isManagerOrAdmin = ['admin', 'manager'].includes(normalizedRole);

  // 1. Manager và Ban Giám hiệu: Thấy tất cả người dùng
  if (isManagerOrAdmin || isBgh) {
    return validUsers;
  }

  const currentDeptId = getUserDepartmentId(currentUser);
  const currentUserId = currentUser?._id ? String(currentUser._id) : '';

  const isCapTruong = isCapTruongUser(currentUser) || (normalizedRole === 'captruong') || (normalizedRole === 'staff' && !isCapPhoUser(currentUser) && !isInternalTeamOrStaff(currentUser));
  const isCapPho = (isCapPhoUser(currentUser) || normalizedRole === 'cappho') && !isInternalTeamOrStaff(currentUser);

  // 2. Cấp trưởng: Chỉ hiển thị danh sách thành viên của đơn vị mình
  if (isCapTruong) {
    if (!currentDeptId) {
      return validUsers.filter((u) => String(u._id) === currentUserId);
    }
    return validUsers.filter((u) => {
      const uDeptId = getUserDepartmentId(u);
      return uDeptId && String(uDeptId) === String(currentDeptId);
    });
  }

  // 3. Cấp phó: Thấy bản thân và nhân viên CB-CV thuộc đơn vị
  if (isCapPho) {
    return validUsers.filter((u) => {
      const uId = String(u._id);
      // Luôn thấy bản thân mình
      if (currentUserId && uId === currentUserId) {
        return true;
      }
      // Phải thuộc đơn vị mình
      const uDeptId = getUserDepartmentId(u);
      const isSameDept = currentDeptId && uDeptId && String(uDeptId) === String(currentDeptId);
      if (!isSameDept) {
        return false;
      }
      // Không lấy Cấp trưởng khác trong đơn vị (chỉ lấy nhân viên CB-CV và bản thân)
      const isLeader = isCapTruongUser(u);
      return !isLeader;
    });
  }

  // 4. Nhân viên CB-CV / GV-VC: Chỉ thấy bản thân mình
  return validUsers.filter((u) => {
    return currentUserId && String(u._id) === currentUserId;
  });
};


