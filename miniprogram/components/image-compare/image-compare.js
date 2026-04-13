// components/image-compare/image-compare.js
Component({
  properties: {
    // 原图路径
    originalImage: {
      type: String,
      value: ''
    },
    // 处理后图片路径
    processedImage: {
      type: String,
      value: ''
    }
  },

  data: {
    sliderPosition: 50 // 滑动条位置（百分比）
  },

  methods: {
    /**
     * 滑动条移动
     */
    onSliderMove(e) {
      const touch = e.touches[0];
      const query = this.createSelectorQuery();
      
      query.select('.slider-container').boundingClientRect((rect) => {
        if (rect) {
          const x = touch.x - rect.left;
          const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
          this.setData({ sliderPosition: percentage });
        }
      }).exec();
    },

    /**
     * 滑动结束
     */
    onSliderEnd(e) {
      // 可以在这里添加额外逻辑
    }
  }
});
