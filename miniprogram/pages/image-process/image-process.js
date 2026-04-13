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
  processDpr: 1,
  processImageObj: null, // 缓存图片对象

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
    console.log('=== 选择区域确认 ===');
    console.log('选择区域:', selections);

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
   * 处理图片
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
        console.log('图片信息:', imgInfo.width, 'x', imgInfo.height);
        this.doProcessImage(imagePath, selections, imgInfo.width, imgInfo.height);
      },
      fail: (err) => {
        console.error('获取图片信息失败', err);
        wx.showToast({ title: '图片加载失败', icon: 'error' });
        this.setData({ currentStep: 1 });
      }
    });
  },

  /**
   * 执行图片处理
   * 修复：不使用 setTransform，直接按物理像素操作
   */
  doProcessImage: function (imagePath, selections, imgWidth, imgHeight) {
    const that = this;
    const dpr = this.processDpr || 1;

    // 检查图片尺寸，过大则缩放
    const maxDimension = 2000; // 最大边长限制
    let processWidth = imgWidth;
    let processHeight = imgHeight;
    let scaleRatio = 1;

    if (imgWidth > maxDimension || imgHeight > maxDimension) {
      scaleRatio = maxDimension / Math.max(imgWidth, imgHeight);
      processWidth = Math.floor(imgWidth * scaleRatio);
      processHeight = Math.floor(imgHeight * scaleRatio);
      console.log(`图片过大，缩放处理: ${imgWidth}x${imgHeight} -> ${processWidth}x${processHeight}`);

      // 同时缩放选择区域
      selections = selections.map(sel => {
        if (sel.type === 'rect') {
          return {
            type: 'rect',
            x: Math.floor(sel.x * scaleRatio),
            y: Math.floor(sel.y * scaleRatio),
            width: Math.floor(sel.width * scaleRatio),
            height: Math.floor(sel.height * scaleRatio)
          };
        } else if (sel.type === 'free') {
          return {
            type: 'free',
            path: sel.path.map(p => ({
              x: Math.floor(p.x * scaleRatio),
              y: Math.floor(p.y * scaleRatio)
            }))
          };
        }
        return sel;
      });
    }

    // 使用页面Canvas
    if (this.processCanvas && this.processCtx) {
      const canvas = this.processCanvas;
      const ctx = this.processCtx;

      // 设置Canvas物理尺寸（不使用setTransform）
      canvas.width = processWidth * dpr;
      canvas.height = processHeight * dpr;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 加载并绘制图片（手动计算缩放，不使用setTransform）
      const img = canvas.createImage();
      img.onload = () => {
        // 直接按物理像素绘制
        ctx.drawImage(img, 0, 0, processWidth * dpr, processHeight * dpr);

        console.log('=== 开始水印处理 ===');

        // 处理水印（DPR=1因为坐标已经是物理像素）
        imageProcessor.processImage(canvas, selections, 1)
          .then(processedPath => {
            console.log('处理完成:', processedPath);
            app.globalData.processedImagePath = processedPath;

            that.setData({
              currentStep: 3,
              processedImagePath: processedPath
            });

            wx.showToast({ title: '处理完成', icon: 'success' });
          })
          .catch(err => {
            console.error('处理失败', err);
            wx.showToast({ title: '处理失败，请重试', icon: 'error' });
            that.setData({ currentStep: 1 });
          });
      };

      img.onerror = (err) => {
        console.error('图片加载失败', err);
        wx.showToast({ title: '图片处理失败', icon: 'error' });
        that.setData({ currentStep: 1 });
      };

      img.src = imagePath;

    } else {
      // 降级方案
      console.warn('使用降级方案');
      this.processImageFallback(imagePath, selections, processWidth, processHeight);
    }
  },

  /**
   * 降级处理方案
   */
  processImageFallback: function (imagePath, selections, processWidth, processHeight) {
    const that = this;
    const dpr = this.processDpr || 1;

    const canvas = wx.createOffscreenCanvas({
      type: '2d',
      width: Math.floor(processWidth * dpr),
      height: Math.floor(processHeight * dpr)
    });

    if (!canvas) {
      wx.showToast({ title: '不支持离屏渲染', icon: 'error' });
      this.setData({ currentStep: 1 });
      return;
    }

    const ctx = canvas.getContext('2d');
    const img = canvas.createImage();

    img.onload = () => {
      // 直接按物理像素绘制，不使用setTransform
      ctx.drawImage(img, 0, 0, processWidth * dpr, processHeight * dpr);

      imageProcessor.processImage(canvas, selections, 1)
        .then(processedPath => {
          app.globalData.processedImagePath = processedPath;
          that.setData({ currentStep: 3, processedImagePath: processedPath });
          wx.showToast({ title: '处理完成', icon: 'success' });
        })
        .catch(err => {
          console.error('处理失败', err);
          wx.showToast({ title: '处理失败', icon: 'error' });
          that.setData({ currentStep: 1 });
        });
    };

    img.onerror = () => {
      wx.showToast({ title: '图片加载失败', icon: 'error' });
      that.setData({ currentStep: 1 });
    };

    img.src = imagePath;
  },

  /**
   * 重新处理
   */
  reprocessImage: function () {
    this.setData({ currentStep: 1, processedImagePath: '' });
  },

  /**
   * 保存到相册
   */
  saveToAlbum: function () {
    const { processedImagePath } = this.data;
    if (!processedImagePath) {
      wx.showToast({ title: '暂无可保存的图片', icon: 'error' });
      return;
    }

    wx.authorize({
      scope: 'scope.writePhotosAlbum',
      success: () => this.doSaveToAlbum(processedImagePath),
      fail: () => {
        wx.showModal({
          title: '需要相册权限',
          content: '请在设置中开启相册权限',
          confirmText: '去设置',
          success: (res) => { if (res.confirm) wx.openSetting(); }
        });
      }
    });
  },

  doSaveToAlbum: function (filePath) {
    wx.showLoading({ title: '保存中...' });
    wx.saveImageToPhotosAlbum({
      filePath: filePath,
      success: () => {
        wx.hideLoading();
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.saveToLocalHistory();
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('保存失败', err);
        wx.showToast({ title: '保存失败', icon: 'error' });
      }
    });
  },

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

    if (history.length > 50) history.splice(50);
    wx.setStorageSync('imageHistory', history);
  },

  cleanup: function () {
    const fileManager = require('../../utils/file-manager.js');
    fileManager.cleanupTempFiles();
  }
});
