// 全局 API 地址（所有页面应使用此统一后端地址）
const API_BASE_URL = 'https://your-domain.com';

const WECHAT_APPID = 'your-wechat-appid';

const TENCENT_LOCATION_KEY = 'your-tencent-location-key';

function getAppid() {
  return WECHAT_APPID;
}

/**
 * 无场所封面时转发卡片用（包内路径；建议 5:4、≤200KB，PNG/JPG）
 * 勿用 Tab 图标凑合：比例/体积不合时，对方会话卡片可能整段失败（连标题都不显示）
 */
const DEFAULT_SHARE_IMAGE_URL = '/images/share-default.png';

/**
 * 好友分享是否使用场所封面网络图。true 时 imageUrl 为 https 原图/缩略图，若体积或比例不合微信规则，
 * 对方会话可能整段失败（连标题都不显示）。同域 /uploads/ 非 OSS 时 toListCoverImageUrl 往往无法缩小体积。
 * 默认 false：仅用包内 share-default.png，优先保证对方能看到标题与图；场所图稳定后再改为 true。
 */
const SHARE_FRIEND_USE_VENUE_COVER = false;

module.exports = {
  API_BASE_URL,
  WECHAT_APPID,
  getAppid,
  TENCENT_LOCATION_KEY,
  DEFAULT_SHARE_IMAGE_URL,
  SHARE_FRIEND_USE_VENUE_COVER
};
