// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 云函数入口函数
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  
  try {
    // 1. 发送订阅消息
    const result = await cloud.openapi.subscribeMessage.send({
      touser: OPENID,
      templateId: event.templateId, // 从客户端传入的模板ID
      page: 'pages/index/index',    // 点击消息跳转的页面
      data: event.data, 
      miniprogramState: 'formal' // 正式版
    })
    
    console.log('推送发送成功:', result)
    return {
      success: true,
      messageId: result._id,
      errCode: 0
    }
    
  } catch (error) {
    console.error('推送发送失败:', error)
    return {
      success: false,
      errCode: error.errCode,
      errMsg: error.errMsg
    }
  }
}