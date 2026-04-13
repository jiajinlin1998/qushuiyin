// pages/video-process/video-process.js
const app = getApp();

Page({
  data: {
    videoPath: '',
    hasSelection: false,
    processing: false,
    progress: 0
  },

  onLoad: function (options) {
    const videoPath = app.globalData.currentVideoPath;
    if (videoPath) {
      this.setData({ videoPath });
    } else {
      wx.showToast({
        title: '未找到视频',
        icon: 'error'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  /**
   * 选择水印区域
   */
  selectWatermarkArea: function () {
    wx.showToast({
      title: '视频框选功能开发中',
      icon: 'none'
    });
  },

  /**
   * 处理视频
   */
  processVideo: function () {
    wx.showModal({
      title: '功能提示',
      content: '视频处理功能需要云函数支持，当前为演示版本。完整功能将在后续开发。',
      showCancel: false
    });
  }
});
