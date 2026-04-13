/**
 * 图片处理工具函数
 * 核心算法：邻域插值填充水印区域
 */

/**
 * 处理图片水印区域
 * @param {Object} canvas - Canvas 2D 对象
 * @param {Array} selections - 选择区域数组
 * @returns {Promise} - 返回处理后的图片临时文件路径
 */
function processImage(canvas, selections) {
  return new Promise((resolve, reject) => {
    try {
      // 获取Canvas上下文
      const ctx = canvas.getContext('2d');
      
      // 获取Canvas尺寸
      const width = canvas.width;
      const height = canvas.height;
      
      // 获取整个Canvas的像素数据
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      // 处理每个选择区域
      selections.forEach(selection => {
        if (selection.type === 'rect') {
          // 处理矩形区域
          processRectangularRegion(data, width, height, selection);
        } else if (selection.type === 'free') {
          // 处理自由涂抹区域
          processFreeRegion(data, width, height, selection);
        }
      });
      
      // 将处理后的像素写回Canvas
      ctx.putImageData(imageData, 0, 0);
      
      // 导出为临时文件
      wx.canvasToTempFilePath({
        canvas: canvas,
        success: (res) => {
          resolve(res.tempFilePath);
        },
        fail: (err) => {
          reject(err);
        }
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 处理矩形水印区域
 * 使用邻域像素平均值填充
 */
function processRectangularRegion(data, canvasWidth, canvasHeight, rect) {
  const { x, y, width, height } = rect;
  
  // 确保区域在画布范围内
  const startX = Math.max(0, Math.floor(x));
  const startY = Math.max(0, Math.floor(y));
  const endX = Math.min(canvasWidth, Math.floor(x + width));
  const endY = Math.min(canvasHeight, Math.floor(y + height));
  
  // 邻域半径
  const radius = 5;
  
  // 遍历水印区域的每个像素
  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      const index = (py * canvasWidth + px) * 4;
      
      // 计算邻域平均颜色
      const avgColor = getNeighborhoodAverage(data, canvasWidth, canvasHeight, px, py, radius);
      
      // 填充平均颜色
      data[index] = avgColor.r;     // R
      data[index + 1] = avgColor.g; // G
      data[index + 2] = avgColor.b; // B
      // Alpha通道保持不变
    }
  }
}

/**
 * 处理自由涂抹水印区域
 */
function processFreeRegion(data, canvasWidth, canvasHeight, selection) {
  const path = selection.path;
  if (!path || path.length < 3) return;
  
  // 计算路径的包围盒
  let minX = canvasWidth, minY = canvasHeight, maxX = 0, maxY = 0;
  path.forEach(point => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  
  const radius = 5;
  
  // 遍历包围盒
  for (let py = Math.max(0, Math.floor(minY)); py <= Math.min(canvasHeight - 1, Math.ceil(maxY)); py++) {
    for (let px = Math.max(0, Math.floor(minX)); px <= Math.min(canvasWidth - 1, Math.ceil(maxX)); px++) {
      // 判断点是否在多边形内
      if (isPointInPolygon({ x: px, y: py }, path)) {
        const index = (py * canvasWidth + px) * 4;
        
        // 计算邻域平均颜色
        const avgColor = getNeighborhoodAverage(data, canvasWidth, canvasHeight, px, py, radius);
        
        // 填充平均颜色
        data[index] = avgColor.r;
        data[index + 1] = avgColor.g;
        data[index + 2] = avgColor.b;
      }
    }
  }
}

/**
 * 获取邻域像素的平均颜色
 * 跳过水印区域内的像素
 */
function getNeighborhoodAverage(data, canvasWidth, canvasHeight, centerX, centerY, radius) {
  let totalR = 0, totalG = 0, totalB = 0, count = 0;
  
  // 遍历邻域
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = centerX + dx;
      const ny = centerY + dy;
      
      // 检查边界
      if (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight) {
        // 计算距离（用于加权平均）
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= radius) {
          const index = (ny * canvasWidth + nx) * 4;
          const weight = 1 / (distance + 1); // 距离越近权重越高
          
          totalR += data[index] * weight;
          totalG += data[index + 1] * weight;
          totalB += data[index + 2] * weight;
          count += weight;
        }
      }
    }
  }
  
  // 计算加权平均
  if (count > 0) {
    return {
      r: Math.round(totalR / count),
      g: Math.round(totalG / count),
      b: Math.round(totalB / count)
    };
  }
  
  return { r: 0, g: 0, b: 0 };
}

/**
 * 判断点是否在多边形内（射线法）
 */
function isPointInPolygon(point, polygon) {
  const { x, y } = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * 批量处理图片
 * @param {Array} imagePaths - 图片路径数组
 * @param {Array} selections - 水印区域数组
 * @returns {Promise<Array>} - 处理后的图片路径数组
 */
function batchProcessImages(imagePaths, selections) {
  return new Promise((resolve, reject) => {
    const results = [];
    let processed = 0;
    
    imagePaths.forEach((imagePath, index) => {
      // 创建离屏Canvas
      const canvas = wx.createOffscreenCanvas({ type: '2d' });
      const ctx = canvas.getContext('2d');
      
      // 加载图片
      const img = canvas.createImage();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // 处理图片
        processImage(canvas, selections)
          .then(result => {
            results[index] = result;
            processed++;
            
            if (processed === imagePaths.length) {
              resolve(results);
            }
          })
          .catch(err => {
            reject(err);
          });
      };
      
      img.src = imagePath;
    });
  });
}

module.exports = {
  processImage,
  batchProcessImages
};
