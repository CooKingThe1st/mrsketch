export const getSessionId = (): string => {
  try {
    let sid = sessionStorage.getItem('mrsketch_session_id');
    if (!sid) {
      sid = Math.random().toString(36).substring(2, 8);
      sessionStorage.setItem('mrsketch_session_id', sid);
    }
    return sid;
  } catch (e) {
    return 'sess';
  }
};

export const getExportCounter = (): number => {
  try {
    const cnt = sessionStorage.getItem('mrsketch_export_count');
    if (cnt) {
      const parsed = parseInt(cnt, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch (e) {}
  return 1;
};

export const getCurrentExportBaseName = (): string => {
  const sid = getSessionId();
  const cnt = getExportCounter();
  const formattedCnt = String(cnt).padStart(2, '0');
  return `mrsketch_${sid}_${formattedCnt}`;
};

export const getCurrentExportFileName = (ext: 'pdf' | 'png'): string => {
  return `${getCurrentExportBaseName()}.${ext}`;
};

export const consumeExportFileName = (ext: 'pdf' | 'png'): string => {
  const fileName = getCurrentExportFileName(ext);
  try {
    const cnt = getExportCounter();
    sessionStorage.setItem('mrsketch_export_count', String(cnt + 1));
  } catch (e) {}
  return fileName;
};
