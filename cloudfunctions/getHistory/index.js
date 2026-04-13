// 云函数入口文件：getHistory
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  const { page = 1, pageSize = 20 } = event;
  
  try {
    const result = await db.collection('records')
      .where({ openid: openid })
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    
    return {
      success: true,
      data: result.data,
      total: result.data.length
    };
    
  } catch (error) {
    console.error('获取历史记录失败', error);
    return {
      success: false,
      error: error.message
    };
  }
};
