// app.js
App({
  onLaunch: function () {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      // 注意：需要在微信开发者工具中配置实际的云开发环境ID
      // 此处使用动态获取方式，首次运行会提示配置
      const cloudEnv = wx.getStorageSync('cloudEnv') || '';
      
      wx.cloud.init({
        // env 参数说明：
        // env 参数决定接下来小程序发起的云开发调用（如云函数、数据库、存储）会默认请求到哪个环境
        // 如需自动创建新环境，可填写 env: ''，系统会自动创建
        env: cloudEnv, // 从本地存储读取，若无则留空后续需手动配置
        traceUser: true // 保留用户访问记录
      });
      
      console.log('云开发环境初始化', cloudEnv || '未配置，请在设置中配置环境ID');
    }

    // 检查本地缓存
    this.checkLocalCache();
  },

  onShow: function () {
    console.log('App Show');
  },

  onHide: function () {
    console.log('App Hide');
  },

  globalData: {
    userInfo: null,
    currentProcessType: null, // 'image' 或 'video'
    currentImagePath: null,
    currentVideoPath: null,
    processedImagePath: null // 处理后图片路径
  },

  /**
   * 检查并清理本地缓存
   */
  checkLocalCache: function () {
    const cacheTime = wx.getStorageSync('cacheTime');
    const now = Date.now();
    // 7天缓存过期清理
    if (cacheTime && now - cacheTime > 7 * 24 * 60 * 60 * 1000) {
      wx.clearStorageSync();
      console.log('本地缓存已过期并清理');
    } else if (!cacheTime) {
      wx.setStorageSync('cacheTime', now);
    }
  }
});
