// components/image-compare/image-compare.js
Component({
  properties: {
    originalImage: {
      type: String,
      value: ''
    },
    processedImage: {
      type: String,
      value: ''
    }
  },

  data: {
    sliderPosition: 50
  },

  methods: {
    onSliderMove(e) {
      const touch = e.touches[0];
      const query = this.createSelectorQuery();
      
      query.select('.compare-container').boundingClientRect((rect) => {
        if (rect) {
          const x = touch.x - rect.left;
          const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
          this.setData({ sliderPosition: percentage });
        }
      }).exec();
    },

    onSliderEnd() {
      // 滑动结束
    }
  }
});
