// pages/index/index.js
const app = getApp();

Page({
  data: {
    // 页面数据
  },

  onLoad: function (options) {
    // 页面加载
  },

  onReady: function () {
    // 页面渲染完成
  },

  onShow: function () {
    // 页面显示
  },

  /**
   * 选择图片并上传
   * 支持相册、拍照、微信文件
   */
  chooseImageUpload: function () {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      camera: 'back',
      success(res) {
        console.log('选择图片成功', res);
        const tempFilePath = res.tempFiles[0].tempFilePath;
        
        // 保存到全局数据
        app.globalData.currentImagePath = tempFilePath;
        app.globalData.currentProcessType = 'image';
        
        // 跳转到图片处理页面
        wx.navigateTo({
          url: '/pages/image-process/image-process'
        });
      },
      fail(err) {
        console.error('选择图片失败', err);
        if (err.errMsg !== 'chooseMedia:fail cancel') {
          wx.showToast({
            title: '选择图片失败',
            icon: 'error'
          });
        }
      }
    });
  },

  /**
   * 选择视频并上传
   */
  chooseVideoUpload: function () {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album'],
      success(res) {
        console.log('选择视频成功', res);
        const tempFilePath = res.tempFiles[0].tempFilePath;
        const size = res.tempFiles[0].size;
        
        // 检查视频大小（限制10MB）
        if (size > 10 * 1024 * 1024) {
          wx.showToast({
            title: '视频大小不能超过10MB',
            icon: 'error'
          });
          return;
        }
        
        // 保存到全局数据
        app.globalData.currentVideoPath = tempFilePath;
        app.globalData.currentProcessType = 'video';
        
        // 跳转到视频处理页面
        wx.navigateTo({
          url: '/pages/video-process/video-process'
        });
      },
      fail(err) {
        console.error('选择视频失败', err);
        if (err.errMsg !== 'chooseMedia:fail cancel') {
          wx.showToast({
            title: '选择视频失败',
            icon: 'error'
          });
        }
      }
    });
  }
});
