// components/canvas-selector/canvas-selector.js
Component({
  properties: {
    imagePath: {
      type: String,
      value: ''
    }
  },

  data: {
    selectMode: 'rect',
    hasSelection: false,
    selectionHistory: []
  },

  // 在 data 之外显式声明所有实例变量（避免 undefined.push 错误）
  isDrawing: false,
  startX: 0,
  startY: 0,
  currentPath: [],
  rectSelections: [],
  freeSelections: [],
  selectionHistory: [],
  canvas: null,
  ctx: null,
  canvasWidth: 0,
  canvasHeight: 0,
  imageScale: 1,
  imageOffsetX: 0,
  imageOffsetY: 0,
  imageLoaded: false,

  lifetimes: {
    ready() {
      this.initCanvas();
    }
  },

  observers: {
    'imagePath': function(newVal) {
      if (newVal && this.imageLoaded) {
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
          if (!res[0]) {
            console.error('Canvas 节点获取失败');
            return;
          }

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

          // 确保所有变量已初始化
          this.isDrawing = false;
          this.startX = 0;
          this.startY = 0;
          this.currentPath = [];
          this.rectSelections = [];
          this.freeSelections = [];
          this.selectionHistory = [];
          this.imageLoaded = false;

          console.log('Canvas 初始化完成', this.canvasWidth, this.canvasHeight);

          // 如果有图片路径，加载图片
          if (this.data.imagePath) {
            this.drawImageToCanvas(this.data.imagePath);
          }
        });
    },

    /**
     * 绘制图片到Canvas
     */
    drawImageToCanvas(imagePath) {
      if (!this.ctx || !this.canvas) {
        console.warn('Canvas 或 ctx 未初始化，跳过绘制');
        return;
      }

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
        this.imageLoaded = true;

        console.log('图片加载完成，缩放:', scale.toFixed(3));

        // 重绘已保存的选择区域
        this.redrawSelections();
      };

      img.onerror = (err) => {
        console.error('图片加载失败', err);
        wx.showToast({
          title: '图片加载失败',
          icon: 'error'
        });
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
      if (!this.imageLoaded) {
        return;
      }

      const touch = e.touches[0];
      this.isDrawing = true;

      if (this.data.selectMode === 'rect') {
        this.startX = touch.x;
        this.startY = touch.y;
        this.currentPath = [];
      } else {
        this.currentPath = [{ x: touch.x, y: touch.y }];
      }
    },

    /**
     * 触摸移动
     */
    onTouchMove(e) {
      if (!this.isDrawing || !this.imageLoaded) return;

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
      if (!this.isDrawing || !this.imageLoaded) return;
      
      this.isDrawing = false;
      const touch = e.changedTouches[0];

      if (this.data.selectMode === 'rect') {
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
        if (this.currentPath && this.currentPath.length > 2) {
          this.freeSelections.push([...this.currentPath]);
          this.saveToHistory();
          this.redrawCanvas();
          this.drawFreePath(this.currentPath);
        }
        this.currentPath = [];
      }

      const hasSelection = this.rectSelections.length > 0 || this.freeSelections.length > 0;
      this.setData({ hasSelection });
    },

    /**
     * 重绘Canvas（图片+所有选择区域）
     */
    redrawCanvas() {
      if (!this.ctx || !this.data.imagePath) return;

      // 清空画布
      this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

      // 绘制底图
      this.drawImageToCanvas(this.data.imagePath);

      // 绘制已保存的选择区域（异步加载图片后执行）
      // 这里使用 redrawSelections 替代
    },

    /**
     * 仅重绘选择区域（不重新加载图片）
     */
    redrawSelections() {
      if (!this.ctx) return;

      this.ctx.strokeStyle = '#4A90E2';
      this.ctx.lineWidth = 2;
      this.ctx.fillStyle = 'rgba(74, 144, 226, 0.2)';

      this.rectSelections.forEach(rect => {
        this.ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        this.ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
      });

      this.freeSelections.forEach(path => {
        this.drawFreePath(path);
      });
    },

    /**
     * 绘制自由路径
     */
    drawFreePath(path) {
      if (!this.ctx || !path || path.length < 2) return;

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

      this.rectSelections.forEach(rect => {
        convertedSelections.push({
          type: 'rect',
          x: Math.floor((rect.x - offsetX) / scale),
          y: Math.floor((rect.y - offsetY) / scale),
          width: Math.floor(rect.width / scale),
          height: Math.floor(rect.height / scale)
        });
      });

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
