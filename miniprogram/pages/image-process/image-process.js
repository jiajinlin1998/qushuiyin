// pages/image-process/image-process.js
const app = getApp();
const imageProcessor = require('../../utils/image-processor.js');

Page({
  data: {
    currentStep: 1, // 当前步骤：1-框选，2-处理，3-预览
    imagePath: '', // 原图路径
    processedImagePath: '', // 处理后图片路径
    selections: [] // 水印选择区域
  },

  onLoad: function (options) {
    // 获取全局数据中的图片路径
    const imagePath = app.globalData.currentImagePath;
    if (imagePath) {
      this.setData({ imagePath });
    } else {
      wx.showToast({
        title: '未找到图片',
        icon: 'error'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onUnload: function () {
    // 页面卸载时清理临时数据
    this.cleanup();
  },

  /**
   * 选择确认事件
   */
  onSelectionConfirmed: function (e) {
    const selections = e.detail.selections;
    console.log('选择区域确认', selections);
    
    if (selections && selections.length > 0) {
      this.setData({ selections });
      
      // 显示确认提示
      wx.showModal({
        title: '确认选择',
        content: '已选择水印区域，是否开始处理？',
        confirmText: '开始处理',
        cancelText: '继续选择',
        success: (res) => {
          if (res.confirm) {
            this.processImage();
          }
        }
      });
    }
  },

  /**
   * 选择清除事件
   */
  onSelectionCleared: function () {
    this.setData({ selections: [] });
  },

  /**
   * 处理图片
   */
  processImage: async function () {
    const { imagePath, selections } = this.data;
    
    if (!imagePath || !selections || selections.length === 0) {
      wx.showToast({
        title: '请先选择水印区域',
        icon: 'error'
      });
      return;
    }

    // 切换到处理步骤
    this.setData({ currentStep: 2 });

    try {
      // 创建离屏Canvas
      const canvas = wx.createOffscreenCanvas({ type: '2d' });
      const ctx = canvas.getContext('2d');

      // 加载图片
      const img = canvas.createImage();
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imagePath;
      });

      // 设置Canvas尺寸
      canvas.width = img.width;
      canvas.height = img.height;

      // 绘制图片
      ctx.drawImage(img, 0, 0);

      // 处理图片水印
      const processedPath = await imageProcessor.processImage(canvas, selections);
      
      console.log('图片处理完成', processedPath);
      
      // 保存到全局数据
      app.globalData.processedImagePath = processedPath;
      
      // 切换到预览步骤
      this.setData({ 
        currentStep: 3,
        processedImagePath: processedPath
      });

      // 显示成功提示
      wx.showToast({
        title: '处理完成',
        icon: 'success'
      });

    } catch (error) {
      console.error('图片处理失败', error);
      
      wx.showToast({
        title: '处理失败，请重试',
        icon: 'error'
      });

      // 返回框选步骤
      this.setData({ currentStep: 1 });
    }
  },

  /**
   * 重新处理
   */
  reprocessImage: function () {
    this.setData({ 
      currentStep: 1,
      processedImagePath: ''
    });
  },

  /**
   * 保存到相册
   */
  saveToAlbum: function () {
    const { processedImagePath } = this.data;
    
    if (!processedImagePath) {
      wx.showToast({
        title: '暂无可保存的图片',
        icon: 'error'
      });
      return;
    }

    // 请求相册权限
    wx.authorize({
      scope: 'scope.writePhotosAlbum',
      success: () => {
        this.doSaveToAlbum(processedImagePath);
      },
      fail: () => {
        // 用户拒绝授权，引导手动授权
        wx.showModal({
          title: '需要相册权限',
          content: '请在设置中开启相册权限，以便保存图片',
          confirmText: '去设置',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      }
    });
  },

  /**
   * 执行保存到相册
   */
  doSaveToAlbum: function (filePath) {
    wx.showLoading({ title: '保存中...' });
    
    wx.saveImageToPhotosAlbum({
      filePath: filePath,
      success: () => {
        wx.hideLoading();
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        
        // 保存记录到本地缓存
        this.saveToLocalHistory();
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('保存失败', err);
        wx.showToast({
          title: '保存失败',
          icon: 'error'
        });
      }
    });
  },

  /**
   * 保存到本地历史记录
   */
  saveToLocalHistory: function () {
    const { imagePath, processedImagePath } = this.data;
    
    // 获取现有历史记录
    const history = wx.getStorageSync('imageHistory') || [];
    
    // 添加新记录
    history.unshift({
      id: Date.now(),
      originalPath: imagePath,
      processedPath: processedImagePath,
      createTime: new Date().toISOString(),
      type: 'image'
    });
    
    // 最多保留50条记录
    if (history.length > 50) {
      history.splice(50);
    }
    
    // 保存到本地缓存
    wx.setStorageSync('imageHistory', history);
  },

  /**
   * 清理临时数据
   */
  cleanup: function () {
    // 清理临时文件
    const fileManager = require('../../utils/file-manager.js');
    fileManager.cleanupTempFiles();
    console.log('清理临时数据完成');
  }
});
