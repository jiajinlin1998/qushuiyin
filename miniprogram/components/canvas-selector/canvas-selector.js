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

  // 显式声明实例变量
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
  cachedImage: null, // 缓存图片对象，避免重复加载
  canvasDpr: 1,

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
          this.canvasDpr = dpr;
          // 记录逻辑像素尺寸（CSS像素）
          this.canvasWidth = res[0].width;
          this.canvasHeight = res[0].height;

          this.isDrawing = false;
          this.startX = 0;
          this.startY = 0;
          this.currentPath = [];
          this.rectSelections = [];
          this.freeSelections = [];
          this.selectionHistory = [];
          this.imageLoaded = false;
          this.cachedImage = null;

          console.log('Canvas 初始化完成，逻辑尺寸:', this.canvasWidth, 'x', this.canvasHeight, 'DPR:', dpr);

          if (this.data.imagePath) {
            this.drawImageToCanvas(this.data.imagePath);
          }
        });
    },

    /**
     * 绘制图片到Canvas（优化：缓存图片对象）
     */
    drawImageToCanvas(imagePath) {
      if (!this.ctx || !this.canvas) {
        console.warn('Canvas 未初始化');
        return;
      }

      // 如果图片路径相同且已缓存，直接重绘
      if (this.cachedImage && this.cachedImage.src === imagePath) {
        this.redrawAll();
        return;
      }

      const img = this.canvas.createImage();
      
      img.onload = () => {
        // 计算缩放比例（基于逻辑像素）
        const scale = Math.min(
          this.canvasWidth / img.width,
          this.canvasHeight / img.height
        );

        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const offsetX = (this.canvasWidth - drawWidth) / 2;
        const offsetY = (this.canvasHeight - drawHeight) / 2;

        // 缓存图片对象和参数
        this.cachedImage = img;
        this.imageScale = scale;
        this.imageOffsetX = offsetX;
        this.imageOffsetY = offsetY;
        this.imageDrawWidth = drawWidth;
        this.imageDrawHeight = drawHeight;
        this.imageLoaded = true;

        console.log('图片加载完成，缩放:', scale.toFixed(3), '绘制尺寸:', drawWidth.toFixed(0), 'x', drawHeight.toFixed(0));

        // 重绘所有内容
        this.redrawAll();
      };

      img.onerror = (err) => {
        console.error('图片加载失败', err);
        wx.showToast({ title: '图片加载失败', icon: 'error' });
      };

      img.src = imagePath;
    },

    /**
     * 重绘所有内容（底图 + 选择区域）
     */
    redrawAll() {
      if (!this.ctx || !this.cachedImage) return;

      // 清空画布（逻辑像素）
      this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

      // 绘制底图（使用缓存的图片）
      this.ctx.drawImage(
        this.cachedImage,
        this.imageOffsetX, this.imageOffsetY,
        this.imageDrawWidth, this.imageDrawHeight
      );

      // 绘制选择区域
      this.redrawSelections();
    },

    /**
     * 仅重绘选择区域（不重绘底图）
     */
    redrawSelections() {
      if (!this.ctx) return;

      // 清除之前绘制的选择区域（简单做法：重绘全部）
      // 优化：可以只清除选择区域部分，但实现复杂
      this.redrawAll();
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
      if (!this.imageLoaded) return;

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
        // 矩形模式：实时预览
        this.redrawAll();
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
        // 自由模式
        this.currentPath.push({ x: touch.x, y: touch.y });
        this.redrawAll();
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
          this.redrawAll();
        }
      } else {
        if (this.currentPath && this.currentPath.length > 2) {
          this.freeSelections.push([...this.currentPath]);
          this.saveToHistory();
          this.redrawAll();
        }
        this.currentPath = [];
      }

      const hasSelection = this.rectSelections.length > 0 || this.freeSelections.length > 0;
      this.setData({ hasSelection });
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
      this.redrawAll();
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
        this.redrawAll();
      }
    },

    /**
     * 保存到历史
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
      console.log('确认选择，转换后的坐标:', selections);

      this.triggerEvent('selectionconfirmed', {
        selections: selections,
        mode: this.data.selectMode
      });
    },

    /**
     * 将Canvas逻辑坐标转换为图片原始像素坐标
     */
    convertSelectionsToImageCoords() {
      const scale = this.imageScale;
      const offsetX = this.imageOffsetX;
      const offsetY = this.imageOffsetY;
      const convertedSelections = [];

      // 计算图片原始尺寸
      const imgWidth = this.imageDrawWidth / scale;
      const imgHeight = this.imageDrawHeight / scale;

      console.log('坐标转换参数:', { scale, offsetX, offsetY, imgWidth, imgHeight });

      this.rectSelections.forEach(rect => {
        // Canvas逻辑坐标 -> 图片原始像素坐标
        let x = Math.floor((rect.x - offsetX) / scale);
        let y = Math.floor((rect.y - offsetY) / scale);
        let w = Math.floor(rect.width / scale);
        let h = Math.floor(rect.height / scale);

        // 边界保护：确保不超出图片范围
        x = Math.max(0, Math.min(x, imgWidth - 1));
        y = Math.max(0, Math.min(y, imgHeight - 1));
        w = Math.max(1, Math.min(w, imgWidth - x));
        h = Math.max(1, Math.min(h, imgHeight - y));

        console.log(`矩形转换: Canvas(${rect.x}, ${rect.y}, ${rect.width}, ${rect.height}) -> 图片(${x}, ${y}, ${w}, ${h})`);

        convertedSelections.push({
          type: 'rect',
          x, y, width: w, height: h
        });
      });

      this.freeSelections.forEach(path => {
        const convertedPath = path.map(point => ({
          x: Math.max(0, Math.min(Math.floor((point.x - offsetX) / scale), imgWidth - 1)),
          y: Math.max(0, Math.min(Math.floor((point.y - offsetY) / scale), imgHeight - 1))
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
