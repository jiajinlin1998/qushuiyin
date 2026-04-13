// components/canvas-selector/canvas-selector.js
Component({
  properties: {
    // 图片路径
    imagePath: {
      type: String,
      value: ''
    }
  },

  data: {
    selectMode: 'rect', // 'rect' 或 'free'
    hasSelection: false,
    selectionHistory: []
  },

  lifetimes: {
    attached() {
      // 组件初始化
    },
    ready() {
      this.initCanvas();
    }
  },

  observers: {
    'imagePath': function(newVal) {
      if (newVal) {
        this.drawImageToCanvas(newVal);
      }
    }
  },

  methods: {
    /**
     * 初始化Canvas
     */
    initCanvas() {
      const query = this.createSelectorQuery();
      query.select('#selectorCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (res[0]) {
            const canvas = res[0].node;
            const ctx = canvas.getContext('2d');
            const dpr = wx.getSystemInfoSync().pixelRatio;
            
            canvas.width = res[0].width * dpr;
            canvas.height = res[0].height * dpr;
            ctx.scale(dpr, dpr);
            
            this.canvas = canvas;
            this.ctx = ctx;
            this.canvasWidth = res[0].width;
            this.canvasHeight = res[0].height;
            
            // 初始化状态
            this.isDrawing = false;
            this.startX = 0;
            this.startY = 0;
            this.rectSelections = []; // 矩形选择区域数组
            this.freeSelections = []; // 自由涂抹路径数组
          }
        });
    },

    /**
     * 绘制图片到Canvas
     */
    drawImageToCanvas(imagePath) {
      if (!this.ctx) return;
      
      const img = this.canvas.createImage();
      img.onload = () => {
        // 计算缩放比例，保持宽高比
        const scale = Math.min(
          this.canvasWidth / img.width,
          this.canvasHeight / img.height
        );
        
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const offsetX = (this.canvasWidth - drawWidth) / 2;
        const offsetY = (this.canvasHeight - drawHeight) / 2;
        
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // 绘制图片
        this.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
        
        // 保存缩放信息
        this.imageScale = scale;
        this.imageOffsetX = offsetX;
        this.imageOffsetY = offsetY;
        this.imageWidth = img.width;
        this.imageHeight = img.height;
      };
      img.src = imagePath;
    },

    /**
     * 切换到矩形模式
     */
    switchToRect() {
      this.setData({ selectMode: 'rect' });
    },

    /**
     * 切换到自由涂抹模式
     */
    switchToFree() {
      this.setData({ selectMode: 'free' });
    },

    /**
     * 触摸开始
     */
    onTouchStart(e) {
      const touch = e.touches[0];
      this.isDrawing = true;
      
      if (this.data.selectMode === 'rect') {
        // 矩形模式：记录起点
        this.startX = touch.x;
        this.startY = touch.y;
        this.currentPath = []; // 当前绘制路径
      } else {
        // 自由模式：开始新路径
        this.currentPath = [{ x: touch.x, y: touch.y }];
      }
    },

    /**
     * 触摸移动
     */
    onTouchMove(e) {
      if (!this.isDrawing) return;
      
      const touch = e.touches[0];
      
      if (this.data.selectMode === 'rect') {
        // 矩形模式：实时绘制预览
        this.redrawCanvas();
        this.ctx.strokeStyle = '#4A90E2';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(
          this.startX,
          this.startY,
          touch.x - this.startX,
          touch.y - this.startY
        );
        this.ctx.setLineDash([]);
      } else {
        // 自由模式：添加路径点
        this.currentPath.push({ x: touch.x, y: touch.y });
        this.redrawCanvas();
        this.drawFreePath(this.currentPath);
      }
    },

    /**
     * 触摸结束
     */
    onTouchEnd(e) {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      
      const touch = e.changedTouches[0];
      
      if (this.data.selectMode === 'rect') {
        // 保存矩形区域
        const rect = {
          x: Math.min(this.startX, touch.x),
          y: Math.min(this.startY, touch.y),
          width: Math.abs(touch.x - this.startX),
          height: Math.abs(touch.y - this.startY)
        };
        
        if (rect.width > 5 && rect.height > 5) {
          this.rectSelections.push(rect);
          this.saveToHistory();
          this.redrawCanvas();
        }
      } else {
        // 自由模式：保存路径
        if (this.currentPath && this.currentPath.length > 2) {
          this.freeSelections.push([...this.currentPath]);
          this.saveToHistory();
          this.redrawCanvas();
          this.drawFreePath(this.currentPath);
        }
        this.currentPath = [];
      }
      
      // 更新选择状态
      const hasSelection = this.rectSelections.length > 0 || this.freeSelections.length > 0;
      this.setData({ hasSelection });
    },

    /**
     * 重绘Canvas（图片+所有选择区域）
     */
    redrawCanvas() {
      if (!this.ctx) return;
      
      // 清空并重绘图片
      this.drawImageToCanvas(this.data.imagePath);
      
      // 绘制所有已保存的矩形
      this.ctx.strokeStyle = '#4A90E2';
      this.ctx.lineWidth = 2;
      this.ctx.fillStyle = 'rgba(74, 144, 226, 0.2)';
      
      this.rectSelections.forEach(rect => {
        this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      });
    },

    /**
     * 绘制自由路径
     */
    drawFreePath(path) {
      if (!path || path.length < 2) return;
      
      this.ctx.strokeStyle = '#4A90E2';
      this.ctx.lineWidth = 3;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.fillStyle = 'rgba(74, 144, 226, 0.3)';
      
      this.ctx.beginPath();
      this.ctx.moveTo(path[0].x, path[0].y);
      
      for (let i = 1; i < path.length; i++) {
        this.ctx.lineTo(path[i].x, path[i].y);
      }
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    },

    /**
     * 清除所有选择
     */
    clearSelection() {
      this.rectSelections = [];
      this.freeSelections = [];
      this.setData({ hasSelection: false });
      this.redrawCanvas();
      this.triggerEvent('selectioncleared');
    },

    /**
     * 撤销上一次选择
     */
    undoSelection() {
      if (this.selectionHistory.length > 0) {
        const lastState = this.selectionHistory.pop();
        this.rectSelections = lastState.rect || [];
        this.freeSelections = lastState.free || [];
        
        const hasSelection = this.rectSelections.length > 0 || this.freeSelections.length > 0;
        this.setData({ hasSelection, selectionHistory: this.selectionHistory });
        this.redrawCanvas();
      }
    },

    /**
     * 保存到历史（用于撤销）
     */
    saveToHistory() {
      this.selectionHistory.push({
        rect: [...this.rectSelections],
        free: [...this.freeSelections]
      });
      this.setData({ selectionHistory: this.selectionHistory });
    },

    /**
     * 确认选择
     */
    confirmSelection() {
      // 计算选择区域在原图上的坐标
      const selections = this.convertSelectionsToImageCoords();
      
      this.triggerEvent('selectionconfirmed', {
        selections: selections,
        mode: this.data.selectMode
      });
    },

    /**
     * 将Canvas坐标转换为图片坐标
     */
    convertSelectionsToImageCoords() {
      const scale = this.imageScale;
      const offsetX = this.imageOffsetX;
      const offsetY = this.imageOffsetY;
      const convertedSelections = [];

      // 转换矩形
      this.rectSelections.forEach(rect => {
        convertedSelections.push({
          type: 'rect',
          x: Math.floor((rect.x - offsetX) / scale),
          y: Math.floor((rect.y - offsetY) / scale),
          width: Math.floor(rect.width / scale),
          height: Math.floor(rect.height / scale)
        });
      });

      // 转换自由路径
      this.freeSelections.forEach(path => {
        const convertedPath = path.map(point => ({
          x: Math.floor((point.x - offsetX) / scale),
          y: Math.floor((point.y - offsetY) / scale)
        }));
        convertedSelections.push({
          type: 'free',
          path: convertedPath
        });
      });

      return convertedSelections;
    }
  }
});
