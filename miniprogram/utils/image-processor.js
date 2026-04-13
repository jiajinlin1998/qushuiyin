/**
 * 图片处理工具函数
 * 核心算法：邻域插值填充水印区域
 */

/**
 * 处理图片水印区域
 * @param {Object} canvas - Canvas 2D 对象
 * @param {Array} selections - 选择区域数组（图片像素坐标）
 * @param {number} dpr - 设备像素比(默认为1)
 * @returns {Promise} - 返回处理后的图片临时文件路径
 */
function processImage(canvas, selections, dpr = 1) {
  return new Promise((resolve, reject) => {
    try {
      const ctx = canvas.getContext('2d');
      const width = canvas.width;
      const height = canvas.height;

      console.log('=== 图片处理开始 ===');
      console.log('Canvas物理尺寸:', width, 'x', height);
      console.log('DPR:', dpr);
      console.log('选择区域数量:', selections.length);

      // 获取整个Canvas的像素数据
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      console.log('总像素数:', data.length / 4);

      // 生成水印区域掩码（标记哪些像素在水印区域内）
      const mask = createWatermarkMask(width, height, selections, dpr);
      const maskPixelCount = mask.filter(v => v === true).length;
      console.log('水印区域像素数:', maskPixelCount, '占比:', (maskPixelCount / (width * height) * 100).toFixed(2) + '%');

      // 处理每个选择区域
      selections.forEach((selection, index) => {
        console.log(`--- 处理区域 ${index + 1}: ${selection.type} ---`);
        if (selection.type === 'rect') {
          processRectangularRegion(data, mask, width, height, selection, dpr);
        } else if (selection.type === 'free') {
          processFreeRegion(data, mask, width, height, selection, dpr);
        }
      });

      // 将处理后的像素写回Canvas
      ctx.putImageData(imageData, 0, 0);
      console.log('=== 像素处理完成 ===');

      // 导出为临时文件
      wx.canvasToTempFilePath({
        canvas: canvas,
        success: (res) => {
          console.log('导出成功:', res.tempFilePath);
          resolve(res.tempFilePath);
        },
        fail: (err) => {
          console.error('导出失败', err);
          reject(err);
        }
      });

    } catch (error) {
      console.error('处理异常', error);
      reject(error);
    }
  });
}

/**
 * 创建水印区域掩码
 * @param {number} width - Canvas物理宽度
 * @param {number} height - Canvas物理高度
 * @param {Array} selections - 选择区域数组
 * @param {number} dpr - 设备像素比
 * @returns {Array} 布尔数组，true表示该像素在水印区域内
 */
function createWatermarkMask(width, height, selections, dpr) {
  const mask = new Uint8Array(width * height); // 使用Uint8Array节省内存

  selections.forEach(selection => {
    if (selection.type === 'rect') {
      // 矩形区域
      const x = Math.floor(selection.x * dpr);
      const y = Math.floor(selection.y * dpr);
      const w = Math.floor(selection.width * dpr);
      const h = Math.floor(selection.height * dpr);

      for (let py = Math.max(0, y); py < Math.min(height, y + h); py++) {
        for (let px = Math.max(0, x); px < Math.min(width, x + w); px++) {
          mask[py * width + px] = 1; // 标记为水印区域
        }
      }
    } else if (selection.type === 'free') {
      // 自由涂抹区域
      const scaledPath = selection.path.map(point => ({
        x: Math.floor(point.x * dpr),
        y: Math.floor(point.y * dpr)
      }));

      // 计算包围盒
      let minX = width, minY = height, maxX = 0, maxY = 0;
      scaledPath.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });

      // 填充多边形内部
      for (let py = Math.max(0, Math.floor(minY)); py <= Math.min(height - 1, Math.ceil(maxY)); py++) {
        for (let px = Math.max(0, Math.floor(minX)); px <= Math.min(width - 1, Math.ceil(maxX)); px++) {
          if (isPointInPolygon({ x: px, y: py }, scaledPath)) {
            mask[py * width + px] = 1;
          }
        }
      }
    }
  });

  return mask;
}

/**
 * 处理矩形水印区域
 * 使用邻域像素平均值填充
 */
function processRectangularRegion(data, mask, canvasWidth, canvasHeight, rect, dpr) {
  // 转换为物理像素坐标
  const x = Math.floor(rect.x * dpr);
  const y = Math.floor(rect.y * dpr);
  const width = Math.floor(rect.width * dpr);
  const height = Math.floor(rect.height * dpr);

  // 确保区域在画布范围内
  const startX = Math.max(0, x);
  const startY = Math.max(0, y);
  const endX = Math.min(canvasWidth, x + width);
  const endY = Math.min(canvasHeight, y + height);

  // 自适应邻域半径（根据图片尺寸调整）
  const baseRadius = Math.max(3, Math.floor(canvasWidth * 0.005));
  const radius = Math.max(baseRadius, Math.floor(baseRadius * dpr));

  // 统计信息
  let processedPixels = 0;

  console.log(`[矩形] 原图坐标: (${rect.x}, ${rect.y}, ${rect.width}, ${rect.height})`);
  console.log(`[矩形] 物理坐标: (${x}, ${y}, ${width}, ${height})`);
  console.log(`[矩形] 处理范围: (${startX}, ${startY}) -> (${endX}, ${endY})`);
  console.log(`[矩形] 邻域半径: ${radius}px`);

  // 遍历水印区域的每个像素
  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      const pixelIndex = py * canvasWidth + px;
      
      // 只处理水印区域内的像素
      if (mask[pixelIndex] === 1) {
        const dataIndex = pixelIndex * 4;

        // 计算邻域平均颜色（排除水印区域）
        const avgColor = getNeighborhoodAverage(data, mask, canvasWidth, canvasHeight, px, py, radius);

        // 填充平均颜色
        data[dataIndex] = avgColor.r;
        data[dataIndex + 1] = avgColor.g;
        data[dataIndex + 2] = avgColor.b;
        data[dataIndex + 3] = 255; // Alpha保持不透明

        processedPixels++;
      }
    }
  }

  console.log(`[矩形] 处理完成，共处理 ${processedPixels} 个像素`);
}

/**
 * 处理自由涂抹水印区域
 */
function processFreeRegion(data, mask, canvasWidth, canvasHeight, selection, dpr) {
  const path = selection.path;
  if (!path || path.length < 3) return;

  // 转换为物理像素坐标
  const scaledPath = path.map(point => ({
    x: Math.floor(point.x * dpr),
    y: Math.floor(point.y * dpr)
  }));

  // 计算包围盒
  let minX = canvasWidth, minY = canvasHeight, maxX = 0, maxY = 0;
  scaledPath.forEach(point => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  const baseRadius = Math.max(3, Math.floor(canvasWidth * 0.005));
  const radius = Math.max(baseRadius, Math.floor(baseRadius * dpr));

  let processedPixels = 0;

  // 遍历包围盒
  for (let py = Math.max(0, Math.floor(minY)); py <= Math.min(canvasHeight - 1, Math.ceil(maxY)); py++) {
    for (let px = Math.max(0, Math.floor(minX)); px <= Math.min(canvasWidth - 1, Math.ceil(maxX)); px++) {
      const pixelIndex = py * canvasWidth + px;
      
      // 判断点是否在多边形内且是水印区域
      if (mask[pixelIndex] === 1 && isPointInPolygon({ x: px, y: py }, scaledPath)) {
        const dataIndex = pixelIndex * 4;

        // 计算邻域平均颜色（排除水印区域）
        const avgColor = getNeighborhoodAverage(data, mask, canvasWidth, canvasHeight, px, py, radius);

        // 填充平均颜色
        data[dataIndex] = avgColor.r;
        data[dataIndex + 1] = avgColor.g;
        data[dataIndex + 2] = avgColor.b;
        data[dataIndex + 3] = 255;

        processedPixels++;
      }
    }
  }

  console.log(`[自由涂抹] 处理完成，共处理 ${processedPixels} 个像素`);
}

/**
 * 获取邻域像素的平均颜色
 * 关键修复：排除水印区域内的像素
 */
function getNeighborhoodAverage(data, mask, canvasWidth, canvasHeight, centerX, centerY, radius) {
  let totalR = 0, totalG = 0, totalB = 0, totalA = 0, count = 0;

  // 遍历邻域
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = centerX + dx;
      const ny = centerY + dy;

      // 检查边界
      if (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight) {
        const pixelIndex = ny * canvasWidth + nx;
        
        // 关键修复：跳过水印区域内的像素
        if (mask[pixelIndex] === 1) {
          continue;
        }

        // 计算距离（用于加权平均）
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= radius && distance > 0) {
          const dataIndex = pixelIndex * 4;
          const weight = 1 / (distance + 1);

          totalR += data[dataIndex] * weight;
          totalG += data[dataIndex + 1] * weight;
          totalB += data[dataIndex + 2] * weight;
          totalA += data[dataIndex + 3] * weight;
          count += weight;
        }
      }
    }
  }

  // 如果邻域内没有有效像素，使用当前像素颜色（避免全黑）
  if (count <= 0) {
    const centerIndex = (centerY * canvasWidth + centerX) * 4;
    return {
      r: data[centerIndex],
      g: data[centerIndex + 1],
      b: data[centerIndex + 2],
      a: data[centerIndex + 3]
    };
  }

  return {
    r: Math.round(totalR / count),
    g: Math.round(totalG / count),
    b: Math.round(totalB / count),
    a: Math.round(totalA / count)
  };
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
 */
function batchProcessImages(imagePaths, selections) {
  return new Promise((resolve, reject) => {
    const results = [];
    let processed = 0;

    imagePaths.forEach((imagePath, index) => {
      const canvas = wx.createOffscreenCanvas({ type: '2d' });
      const ctx = canvas.getContext('2d');

      const img = canvas.createImage();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        processImage(canvas, selections, 1)
          .then(result => {
            results[index] = result;
            processed++;
            if (processed === imagePaths.length) {
              resolve(results);
            }
          })
          .catch(err => reject(err));
      };
      img.src = imagePath;
    });
  });
}

module.exports = {
  processImage,
  batchProcessImages
};
