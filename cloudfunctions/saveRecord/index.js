// 云函数入口文件：saveRecord
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  const { originalPath, processedPath, type, watermarkRegion } = event;
  
  try {
    const result = await db.collection('records').add({
      data: {
        openid: openid,
        originalPath: originalPath,
        processedPath: processedPath,
        type: type || 'image',
        watermarkRegion: watermarkRegion || null,
        createTime: db.serverDate()
      }
    });
    
    return {
      success: true,
      recordId: result._id
    };
    
  } catch (error) {
    console.error('保存记录失败', error);
    return {
      success: false,
      error: error.message
    };
  }
};
