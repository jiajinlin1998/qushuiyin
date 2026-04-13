/**
 * 图片处理工具函数
 * 核心算法：邻域插值填充水印区域
 */

/**
 * 处理图片水印区域
 * @param {Object} canvas - Canvas 2D 对象
 * @param {Array} selections - 选择区域数组
 * @param {number} dpr - 设备像素比(默认为1)
 * @returns {Promise} - 返回处理后的图片临时文件路径
 */
function processImage(canvas, selections, dpr = 1) {
  return new Promise((resolve, reject) => {
    try {
      // 获取Canvas上下文
      const ctx = canvas.getContext('2d');

      // 获取Canvas尺寸（Canvas 2D API中width/height是物理像素）
      const width = canvas.width;
      const height = canvas.height;

      console.log('开始处理图片，Canvas尺寸(物理像素):', width, 'x', height);
      console.log('选择区域数量:', selections.length);
      console.log('DPR:', dpr);

      // 获取整个Canvas的像素数据
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      console.log('像素数据获取成功，总像素:', data.length / 4);

      // 处理每个选择区域（坐标需要乘以DPR转换为物理像素坐标）
      selections.forEach((selection, index) => {
        console.log(`处理选择区域 ${index + 1}:`, selection.type);
        if (selection.type === 'rect') {
          processRectangularRegion(data, width, height, selection, dpr);
        } else if (selection.type === 'free') {
          processFreeRegion(data, width, height, selection, dpr);
        }
      });

      // 将处理后的像素写回Canvas
      ctx.putImageData(imageData, 0, 0);
      console.log('像素处理完成，准备导出');

      // 导出为临时文件
      wx.canvasToTempFilePath({
        canvas: canvas,
        success: (res) => {
          console.log('图片导出成功', res.tempFilePath);
          resolve(res.tempFilePath);
        },
        fail: (err) => {
          console.error('图片导出失败', err);
          reject(err);
        }
      });

    } catch (error) {
      console.error('图片处理异常', error);
      reject(error);
    }
  });
}

/**
 * 处理矩形水印区域
 * 使用邻域像素平均值填充
 */
function processRectangularRegion(data, canvasWidth, canvasHeight, rect, dpr = 1) {
  // 将逻辑坐标转换为物理像素坐标
  const x = Math.floor(rect.x * dpr);
  const y = Math.floor(rect.y * dpr);
  const width = Math.floor(rect.width * dpr);
  const height = Math.floor(rect.height * dpr);

  // 确保区域在画布范围内
  const startX = Math.max(0, x);
  const startY = Math.max(0, y);
  const endX = Math.min(canvasWidth, x + width);
  const endY = Math.min(canvasHeight, y + height);

  // 邻域半径（也要乘以DPR）
  const radius = Math.max(5, Math.floor(5 * dpr));

  // 计算处理的像素数量
  const pixelsToProcess = (endX - startX) * (endY - startY);
  console.log(`[矩形处理] 原图坐标: (${rect.x}, ${rect.y}, ${rect.width}, ${rect.height})`);
  console.log(`[矩形处理] 物理坐标: (${x}, ${y}, ${width}, ${height})`);
  console.log(`[矩形处理] 实际范围: (${startX}, ${startY}) -> (${endX}, ${endY})`);
  console.log(`[矩形处理] 处理像素数: ${pixelsToProcess}`);

  // 遍历水印区域的每个像素
  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      const index = (py * canvasWidth + px) * 4;

      // 计算邻域平均颜色
      const avgColor = getNeighborhoodAverage(data, canvasWidth, canvasHeight, px, py, radius);

      // 填充平均颜色
      data[index] = avgColor.r;
      data[index + 1] = avgColor.g;
      data[index + 2] = avgColor.b;
    }
  }
  
  console.log(`[矩形处理] 完成，共处理 ${pixelsToProcess} 个像素`);
}

/**
 * 处理自由涂抹水印区域
 */
function processFreeRegion(data, canvasWidth, canvasHeight, selection, dpr = 1) {
  const path = selection.path;
  if (!path || path.length < 3) return;

  // 将路径坐标转换为物理像素坐标
  const scaledPath = path.map(point => ({
    x: point.x * dpr,
    y: point.y * dpr
  }));

  // 计算路径的包围盒
  let minX = canvasWidth, minY = canvasHeight, maxX = 0, maxY = 0;
  scaledPath.forEach(point => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  const radius = Math.max(5, Math.floor(5 * dpr));

  // 遍历包围盒
  for (let py = Math.max(0, Math.floor(minY)); py <= Math.min(canvasHeight - 1, Math.ceil(maxY)); py++) {
    for (let px = Math.max(0, Math.floor(minX)); px <= Math.min(canvasWidth - 1, Math.ceil(maxX)); px++) {
      // 判断点是否在多边形内
      if (isPointInPolygon({ x: px, y: py }, scaledPath)) {
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
