// pages/history/history.js
Page({
  data: {
    historyList: []
  },

  onShow: function () {
    this.loadHistory();
  },

  /**
   * 加载历史记录
   */
  loadHistory: function () {
    const history = wx.getStorageSync('imageHistory') || [];
    
    // 格式化时间
    const formattedHistory = history.map(item => {
      const date = new Date(item.createTime);
      const formattedTime = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      
      return {
        ...item,
        createTime: formattedTime
      };
    });
    
    this.setData({ historyList: formattedHistory });
  },

  /**
   * 查看详情
   */
  viewDetail: function (e) {
    const id = e.currentTarget.dataset.id;
    const record = this.data.historyList.find(item => item.id === id);
    
    if (record) {
      wx.previewImage({
        urls: [record.processedPath],
        current: record.processedPath
      });
    }
  },

  /**
   * 删除记录
   */
  deleteRecord: function (e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      success: (res) => {
        if (res.confirm) {
          const history = wx.getStorageSync('imageHistory') || [];
          const newHistory = history.filter(item => item.id !== id);
          wx.setStorageSync('imageHistory', newHistory);
          this.loadHistory();
          
          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 清空所有记录
   */
  clearAll: function () {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有历史记录吗？此操作不可恢复。',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.setStorageSync('imageHistory', []);
          this.setData({ historyList: [] });
          
          wx.showToast({
            title: '已清空',
            icon: 'success'
          });
        }
      }
    });
  }
});
