/**
 * 云函数调用封装
 */

/**
 * 上传文件到云存储
 */
function uploadFileToCloud(localPath, cloudPath) {
  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: localPath,
      success: res => {
        resolve(res.fileID);
      },
      fail: err => {
        reject(err);
      }
    });
  });
}

/**
 * 从云存储下载文件
 */
function downloadFileFromCloud(fileID) {
  return new Promise((resolve, reject) => {
    wx.cloud.downloadFile({
      fileID: fileID,
      success: res => {
        resolve(res.tempFilePath);
      },
      fail: err => {
        reject(err);
      }
    });
  });
}

/**
 * 删除云存储文件
 */
function deleteCloudFile(fileID) {
  return new Promise((resolve, reject) => {
    wx.cloud.deleteFile({
      fileList: [fileID],
      success: res => {
        resolve(res);
      },
      fail: err => {
        reject(err);
      }
    });
  });
}

/**
 * 保存处理记录到云数据库
 */
function saveRecordToDB(recordData) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'saveRecord',
      data: recordData,
      success: res => {
        resolve(res.result);
      },
      fail: err => {
        reject(err);
      }
    });
  });
}

/**
 * 获取历史记录
 */
function getHistoryFromDB(page = 1, pageSize = 20) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'getHistory',
      data: {
        page: page,
        pageSize: pageSize
      },
      success: res => {
        resolve(res.result);
      },
      fail: err => {
        reject(err);
      }
    });
  });
}

/**
 * 删除历史记录
 */
function deleteRecordFromDB(recordId) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'deleteRecord',
      data: {
        recordId: recordId
      },
      success: res => {
        resolve(res.result);
      },
      fail: err => {
        reject(err);
      }
    });
  });
}

/**
 * 视频处理云函数
 */
function processVideoInCloud(videoFileID, watermarkRegion) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'processVideo',
      data: {
        videoFileID: videoFileID,
        watermarkRegion: watermarkRegion
      },
      success: res => {
        resolve(res.result);
      },
      fail: err => {
        reject(err);
      }
    });
  });
}

module.exports = {
  uploadFileToCloud,
  downloadFileFromCloud,
  deleteCloudFile,
  saveRecordToDB,
  getHistoryFromDB,
  deleteRecordFromDB,
  processVideoInCloud
};
