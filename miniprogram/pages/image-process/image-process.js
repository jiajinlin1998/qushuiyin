// pages/image-process/image-process.js
const app = getApp();
const imageProcessor = require('../../utils/image-processor.js');

Page({
  data: {
    currentStep: 1,
    imagePath: '',
    processedImagePath: '',
    selections: []
  },

  // 页面级Canvas引用
  processCanvas: null,
  processCtx: null,

  onLoad: function (options) {
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

  onReady: function () {
    // 初始化处理用Canvas
    this.initProcessCanvas();
  },

  onUnload: function () {
    this.cleanup();
  },

  /**
   * 初始化处理用Canvas（隐藏）
   */
  initProcessCanvas: function () {
    const query = this.createSelectorQuery();
    query.select('#processCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res[0]) {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio;
          
          // 设置初始尺寸（后续会根据图片调整）
          canvas.width = 300 * dpr;
          canvas.height = 300 * dpr;
          ctx.scale(dpr, dpr);
          
          this.processCanvas = canvas;
          this.processCtx = ctx;
          this.processDpr = dpr;
          console.log('处理Canvas初始化完成，DPR:', dpr);
        } else {
          console.warn('处理Canvas未找到，将使用离屏Canvas方案');
        }
      });
  },

  /**
   * 选择确认事件
   */
  onSelectionConfirmed: function (e) {
    const selections = e.detail.selections;
    console.log('选择区域确认', selections);

    if (selections && selections.length > 0) {
      this.setData({ selections });

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
   * 处理图片（使用页面Canvas）
   */
  processImage: function () {
    const { imagePath, selections } = this.data;

    if (!imagePath || !selections || selections.length === 0) {
      wx.showToast({
        title: '请先选择水印区域',
        icon: 'error'
      });
      return;
    }

    this.setData({ currentStep: 2 });

    // 获取图片信息
    wx.getImageInfo({
      src: imagePath,
      success: (imgInfo) => {
        console.log('图片信息获取成功', imgInfo.width, imgInfo.height);
        this.doProcessImage(imagePath, selections, imgInfo.width, imgInfo.height);
      },
      fail: (err) => {
        console.error('获取图片信息失败', err);
        wx.showToast({
          title: '图片加载失败',
          icon: 'error'
        });
        this.setData({ currentStep: 1 });
      }
    });
  },

  /**
   * 执行图片处理
   */
  doProcessImage: function (imagePath, selections, imgWidth, imgHeight) {
    const that = this;

    // 使用页面Canvas或离屏Canvas
    let canvas, ctx, dpr;

    if (this.processCanvas && this.processCtx) {
      canvas = this.processCanvas;
      ctx = this.processCtx;
      dpr = this.processDpr || 1;
      
      // 设置Canvas物理尺寸为图片尺寸 * DPR
      canvas.width = imgWidth * dpr;
      canvas.height = imgHeight * dpr;
      
      // 重置变换并设置缩放
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 绘制图片
      const img = canvas.createImage();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

        // 处理水印（传入canvas对象和DPR，内部使用物理像素尺寸）
        imageProcessor.processImage(canvas, selections, dpr)
          .then(processedPath => {
            console.log('图片处理完成', processedPath);
            app.globalData.processedImagePath = processedPath;
            
            that.setData({
              currentStep: 3,
              processedImagePath: processedPath
            });

            wx.showToast({
              title: '处理完成',
              icon: 'success'
            });
          })
          .catch(err => {
            console.error('图片处理失败', err);
            wx.showToast({
              title: '处理失败，请重试',
              icon: 'error'
            });
            that.setData({ currentStep: 1 });
          });
      };
      img.onerror = (err) => {
        console.error('图片绘制失败', err);
        wx.showToast({
          title: '图片处理失败',
          icon: 'error'
        });
        that.setData({ currentStep: 1 });
      };
      img.src = imagePath;
      
    } else {
      // 降级方案
      console.warn('使用降级方案处理图片');
      this.processImageFallback(imagePath, selections, imgWidth, imgHeight);
    }
  },

  /**
   * 降级处理方案（使用离屏Canvas）
   */
  processImageFallback: function (imagePath, selections, imgWidth, imgHeight) {
    const that = this;
    const dpr = wx.getSystemInfoSync().pixelRatio;
    
    // 创建离屏Canvas
    const canvas = wx.createOffscreenCanvas({ 
      type: '2d', 
      width: Math.floor(imgWidth * dpr), 
      height: Math.floor(imgHeight * dpr) 
    });
    
    if (!canvas) {
      wx.showToast({
        title: '当前版本不支持离屏渲染',
        icon: 'error'
      });
      this.setData({ currentStep: 1 });
      return;
    }

    const ctx = canvas.getContext('2d');
    // 设置DPR缩放
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    const img = canvas.createImage();
    
    img.onload = () => {
      ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

      // 处理水印（传递DPR参数）
      imageProcessor.processImage(canvas, selections, dpr)
        .then(processedPath => {
          console.log('图片处理完成（降级方案）', processedPath);
          app.globalData.processedImagePath = processedPath;
          
          that.setData({
            currentStep: 3,
            processedImagePath: processedPath
          });

          wx.showToast({
            title: '处理完成',
            icon: 'success'
          });
        })
        .catch(err => {
          console.error('图片处理失败', err);
          wx.showToast({
            title: '处理失败，请重试',
            icon: 'error'
          });
          that.setData({ currentStep: 1 });
        });
    };
    
    img.onerror = (err) => {
      console.error('图片加载失败', err);
      wx.showToast({
        title: '图片处理失败',
        icon: 'error'
      });
      that.setData({ currentStep: 1 });
    };
    
    img.src = imagePath;
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

    wx.authorize({
      scope: 'scope.writePhotosAlbum',
      success: () => {
        this.doSaveToAlbum(processedImagePath);
      },
      fail: () => {
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
    const history = wx.getStorageSync('imageHistory') || [];

    history.unshift({
      id: Date.now(),
      originalPath: imagePath,
      processedPath: processedImagePath,
      createTime: new Date().toISOString(),
      type: 'image'
    });

    if (history.length > 50) {
      history.splice(50);
    }

    wx.setStorageSync('imageHistory', history);
  },

  /**
   * 清理临时数据
   */
  cleanup: function () {
    const fileManager = require('../../utils/file-manager.js');
    fileManager.cleanupTempFiles();
    console.log('清理临时数据完成');
  }
});
