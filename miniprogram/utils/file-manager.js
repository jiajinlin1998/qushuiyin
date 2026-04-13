/**
 * 文件管理工具
 * 处理临时文件清理、缓存管理等功能
 */

/**
 * 清理临时文件
 */
function cleanupTempFiles() {
  const tempFiles = wx.getStorageSync('tempFiles') || [];
  
  tempFiles.forEach(filePath => {
    // 删除本地临时文件
    wx.removeSavedFile({
      filePath: filePath,
      complete: function (res) {
        console.log('清理临时文件', filePath, res);
      }
    });
  });
  
  // 清空临时文件记录
  wx.setStorageSync('tempFiles', []);
}

/**
 * 添加临时文件记录
 */
function addTempFile(filePath) {
  const tempFiles = wx.getStorageSync('tempFiles') || [];
  tempFiles.push(filePath);
  wx.setStorageSync('tempFiles', tempFiles);
}

/**
 * 检查缓存大小
 */
function checkCacheSize() {
  return new Promise((resolve, reject) => {
    wx.getStorageInfo({
      success: function (res) {
        const size = res.currentSize; // KB
        resolve(size);
      },
      fail: function (err) {
        reject(err);
      }
    });
  });
}

/**
 * 清理缓存
 */
function clearCache() {
  return new Promise((resolve, reject) => {
    wx.clearStorage({
      success: function () {
        resolve();
      },
      fail: function (err) {
        reject(err);
      }
    });
  });
}

/**
 * 格式化文件大小
 */
function formatFileSize(sizeInKB) {
  if (sizeInKB < 1024) {
    return sizeInKB + ' KB';
  } else if (sizeInKB < 1024 * 1024) {
    return (sizeInKB / 1024).toFixed(2) + ' MB';
  } else {
    return (sizeInKB / (1024 * 1024)).toFixed(2) + ' GB';
  }
}

module.exports = {
  cleanupTempFiles,
  addTempFile,
  checkCacheSize,
  clearCache,
  formatFileSize
};
