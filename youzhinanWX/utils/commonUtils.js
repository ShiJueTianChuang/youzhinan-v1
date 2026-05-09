// 公共工具函数 - 后端返回什么，前端直接用什么！
const { API_BASE_URL, DEFAULT_SHARE_IMAGE_URL } = require('./constants.js');

// 处理联系方式信息 - 后端返回真实号码，前端脱敏展示
function processContactInfo(bar) {
  if (!bar) return {};
  const barWithContact = {...bar};

  const contactInfo = {
    phones: [],
    landlines: [],
    wechats: []
  };

  if (barWithContact.contact && typeof barWithContact.contact === 'object') {
    if (Array.isArray(barWithContact.contact.phone)) {
      contactInfo.phones.push(...barWithContact.contact.phone);
    }
    if (Array.isArray(barWithContact.contact.landline)) {
      contactInfo.landlines.push(...barWithContact.contact.landline);
    }
    if (Array.isArray(barWithContact.contact.wechat)) {
      contactInfo.wechats.push(...barWithContact.contact.wechat);
    }
  }

  barWithContact.phoneNumbers = [...new Set(contactInfo.phones)];
  barWithContact.maskedPhoneNumbers = [...new Set(contactInfo.phones)].map(phone => maskPhone(phone));

  barWithContact.landlineNumbers = [...new Set(contactInfo.landlines)];
  barWithContact.maskedLandlineNumbers = [...new Set(contactInfo.landlines)].map(landline => maskLandline(landline));

  barWithContact.otherContacts = [...new Set(contactInfo.wechats)];
  barWithContact.maskedOtherContacts = [...new Set(contactInfo.wechats)].map(wechat => maskWechat(wechat));

  // 处理评分
  const rating = barWithContact.rating;
  if (rating === null || rating === undefined) {
    barWithContact.rating = '';
  } else if (typeof rating === 'string') {
    const trimmedRating = rating.trim();
    if (trimmedRating === '' || trimmedRating.includes('暂无评分')) {
      barWithContact.rating = '';
    }
  }
  
  return barWithContact;
}

// 手机号脱敏函数：15812340474 -> 158****0474
function maskPhone(phone) {
  if (!phone) return '';
  const phoneStr = String(phone).trim();
  if (phoneStr.length === 11) {
    // 11 位手机号：保留前 3 位和后 4 位
    return phoneStr.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }
  return phoneStr; // 其他格式不脱敏
}

// 座机号脱敏函数：02312345678 -> 023****5678
function maskLandline(landline) {
  if (!landline) return '';
  const landlineStr = String(landline).trim();
  // 去掉横杠
  const cleanNumber = landlineStr.replace(/[-\s]/g, '');
  if (cleanNumber.length >= 10) {
    // 保留区号和后 4 位
    return cleanNumber.replace(/(\d{3,4})\d{4,5}(\d{4})/, '$1****$2');
  }
  return landlineStr; // 其他格式不脱敏
}

// 微信号脱敏函数：haode123 -> ha****23
function maskWechat(wechat) {
  if (!wechat) return '';
  const wechatStr = String(wechat).trim();
  
  // 如果微信号长度大于 6 位，保留前 2 位和后 2 位
  if (wechatStr.length > 6) {
    return wechatStr.substring(0, 2) + '****' + wechatStr.substring(wechatStr.length - 2);
  }
  
  // 如果长度较短，保留第 1 位和最后 1 位
  if (wechatStr.length > 3) {
    return wechatStr.charAt(0) + '****' + wechatStr.charAt(wechatStr.length - 1);
  }
  
  return wechatStr; // 太短的微信号不脱敏
}

/**
 * 提取场所名称
 */
function extractVenueName(item) {
  if (!item) return '未命名场所';
  
  const name = item.name || 
               item.Name || 
               item.shop_name || 
               item.shopName || 
               item.ShopName ||
               item.Shop_Name ||
               item.shop_Name ||
               item.title || 
               item.Title || 
               item.label || 
               item.Label ||
               item.venue_name ||
               item.store_name ||
               item.place_name ||
               item.nickname ||
               item.name_cn ||
               item.name_zh ||
               item.shop ||
               item.Store ||
               item.Venue ||
               '';
               
  if (!name) {
    for (const key in item) {
      const val = item[key];
      if (typeof val === 'string' && val.length > 4 && val.length < 50) {
        const lowerKey = key.toLowerCase();
        if (!lowerKey.includes('province') && 
            !lowerKey.includes('city') && 
            !lowerKey.includes('address') && 
            !lowerKey.includes('image') && 
            !lowerKey.includes('url') && 
            !lowerKey.includes('tag') && 
            !lowerKey.includes('contact') && 
            !lowerKey.includes('phone') && 
            !lowerKey.includes('desc')) {
          return val.trim();
        }
      }
    }
  }
               
  return String(name).trim() || '未命名场所';
}

/**
 * 提取所有图片URL
 */
function extractVenueImages(item) {
  if (!item) return [];
  
  let imagesRaw = item.images || 
                  item.Images || 
                  item.photos || 
                  item.Photos || 
                  item.pictures || 
                  item.Pictures || 
                  item.image_url || 
                  item.imageUrl || 
                  item.ImageUrl || 
                  item.Image_URL || 
                  item.image || 
                  item.Image || 
                  item.img || 
                  item.Img || 
                  item.photo || 
                  item.picture || 
                  item.photo_url;

  if (!imagesRaw || (Array.isArray(imagesRaw) && imagesRaw.length === 0)) {
    imagesRaw = item.image || item.Image || item.imageUrl || item.image_url || '';
  }

  let result = [];
  
  if (Array.isArray(imagesRaw)) {
    result = imagesRaw.filter(img => img && typeof img === 'string').map(img => img.trim());
  } else if (typeof imagesRaw === 'string' && imagesRaw.trim() !== '') {
    const splitters = [',', ';', '|', '\n'];
    let currentResult = [imagesRaw.trim()];
    
    for (const splitter of splitters) {
      let nextResult = [];
      for (const str of currentResult) {
        if (str.includes(splitter)) {
          nextResult.push(...str.split(splitter).map(s => s.trim()));
        } else {
          nextResult.push(str);
        }
      }
      currentResult = nextResult;
    }
    result = currentResult.filter(img => img !== '');
  }
  
  const finalImages = result.map(url => processImageUrl(url));
  
  return finalImages;
}

/**
 * 标准化场所数据结构
 */
function normalizeVenueData(item, favoritedBars = null) {
  if (!item) return {};
  
  const normalized = {...item};
  
  normalized.name = extractVenueName(item);
  normalized.images = extractVenueImages(item);
  normalized.image = normalized.images.length > 0 ? normalized.images[0] : '';
  normalized.listImage = normalized.image ? toListCoverImageUrl(normalized.image) : ''
  
  const tags = item.tags || item.Tags || item.tag || item.Tag || '';
  normalized.categoryType = getCategoryType(tags, item);
  
  const withContact = processContactInfo(normalized);
  
  withContact.address = withContact.address || 
                        withContact.Address || 
                        withContact.addr || 
                        withContact.location || 
                        item.detail_address ||
                        item.detailAddress ||
                        '暂无地址';
                        
  withContact.id = withContact.id || withContact.ID || withContact.Id || '';
  
  if (favoritedBars && withContact.id) {
    const strId = String(withContact.id);
    const numId = Number(withContact.id);
    withContact.isFavorited = !!(favoritedBars[strId] || favoritedBars[numId] || favoritedBars[withContact.id]);
  } else {
    withContact.isFavorited = false;
  }
  
  withContact.latitude = withContact.latitude || withContact.Latitude || withContact.lat || '';
  withContact.longitude = withContact.longitude || withContact.Longitude || withContact.lng || withContact.lon || '';
  
  withContact.openingHours = item.opening_hours || item.openingHours || item.OpeningHours || 
                             item.open_time || item.openTime || item.OpenTime ||
                             item.business_hours || item.businessHours || item.time || '';
                              
  withContact.price = item.price || item.Price || item.avg_price || item.avgPrice || 
                      item.cost || item.consumption || item.average || '';
  
  if (withContact.latitude) withContact.latitude = parseFloat(withContact.latitude);
  if (withContact.longitude) withContact.longitude = parseFloat(withContact.longitude);

  return withContact;
}

/**
 * 微信转发/朋友圈卡片 imageUrl 仅支持 PNG、JPG（官方文档）；WebP/GIF/SVG 等会导致对方侧退回默认样式（只见小程序名与占位图）。
 */
function isLikelyWebpOrUnsupportedShareFormat(url) {
  if (!url || typeof url !== 'string') return true;
  const s = url.trim();
  if (/[?&]format[=/,]webp/i.test(s) || /image%2Fwebp/i.test(s)) return true;
  const base = s.split('?')[0].split('#')[0].toLowerCase();
  if (base.endsWith('.webp')) return true;
  if (base.endsWith('.svg') || base.endsWith('.gif')) return true;
  return false;
}

/**
 * 从单条场所数据取转发卡片用封面（好友/群、朋友圈 imageUrl）
 * 须为可访问的 https 网络图，或小程序包内/本地路径；域名需在后台配置 downloadFile 合法域名
 */
function pickVenueShareImageUrl(bar) {
  if (!bar) return '';
  const candidates = [];
  // 优先 listImage（列表缩略，体积更小），降低超 200KB / 拉取失败导致对方整条分享失效的概率
  if (bar.listImage) candidates.push(bar.listImage);
  if (bar.image) candidates.push(bar.image);
  if (Array.isArray(bar.images)) {
    for (let i = 0; i < bar.images.length; i++) {
      if (bar.images[i]) candidates.push(bar.images[i]);
    }
  }
  for (let j = 0; j < candidates.length; j++) {
    let raw = candidates[j];
    if (!raw || typeof raw !== 'string') continue;
    raw = raw.trim();
    if (!raw) continue;
    const resolved = raw.startsWith('http://') || raw.startsWith('https://') ? raw : processImageUrl(raw);
    if (!resolved || isLikelyWebpOrUnsupportedShareFormat(resolved)) continue;
    return resolved;
  }
  return '';
}

/**
 * 分享卡片 imageUrl 规范化。
 * 微信会在服务端拉取该地址生成转发/朋友圈预览；分享者本地已缓存时仍能看到图，接收方必须能公网访问。
 * - 须 https（业务域名的 http 会尝试升为 https）
 * - wxfile 等临时路径仅当前用户有效，不可用
 * - 网络图域名须在小程序后台「downloadFile 合法域名」中配置（与 request 列表不同）
 */
function normalizeShareImageUrl(url) {
  if (url == null || url === '') return '';
  let u = String(url).trim();
  if (!u) return '';
  if (u.indexOf('wxfile://') === 0 || u.indexOf('http://tmp/') === 0) return '';
  if (u.indexOf('/') === 0 && u.indexOf('//') !== 0) {
    return u;
  }
  if (u.indexOf('//') === 0 && u.indexOf('///') !== 0) {
    return 'https:' + u;
  }
  if (!/^https?:\/\//i.test(u)) {
    return processImageUrl(u);
  }
  if (u.indexOf('http://') === 0) {
    try {
      const parsed = new URL(u);
      const base = new URL(API_BASE_URL);
      if (parsed.hostname === base.hostname) {
        return 'https://' + u.slice('http://'.length);
      }
    } catch (e) {
      return u;
    }
  }
  return u;
}

/** 转发卡片图：优先网络/场所封面，否则包内默认图；均经 normalize 保证对接收方可拉取 */
function shareCardImageUrl(preferredUrl) {
  const first = normalizeShareImageUrl(preferredUrl);
  if (first) return first;
  return normalizeShareImageUrl(DEFAULT_SHARE_IMAGE_URL) || '';
}

function shareCardImageUrlFromBar(bar) {
  return shareCardImageUrl(pickVenueShareImageUrl(bar));
}

/** 分享卡片图体积过大时，部分机型/版本上对方收不到图；压缩到更稳妥的体积 */
var SHARE_IMAGE_MAX_BYTES = 200 * 1024;

/**
 * 网络图无法落到本地时，勿把原始 https 交给转发卡片（微信服务端拉取失败时对方会看到白底无图）。
 * 回退到包内默认图并解析为本地 path，由客户端上传，接收方才能稳定看到图。
 */
function resolveShareImageWithPackageFallback(resolve) {
  const pkg = normalizeShareImageUrl(DEFAULT_SHARE_IMAGE_URL);
  if (!pkg || pkg.indexOf('/') !== 0 || pkg.indexOf('//') === 0) {
    resolve('');
    return;
  }
  wx.getImageInfo({
    src: pkg,
    success: function (res) {
      if (res && res.path) {
        resolve(res.path);
      } else {
        resolve(pkg);
      }
    },
    fail: function () {
      resolve(pkg);
    }
  });
}

function maybeCompressSharePath(localPath, resolve, fallbackUrl) {
  if (!localPath) {
    resolveShareImageWithPackageFallback(resolve);
    return;
  }
  wx.getFileInfo({
    filePath: localPath,
    success: function (fi) {
      if (fi.size <= SHARE_IMAGE_MAX_BYTES) {
        resolve(localPath);
        return;
      }
      if (typeof wx.compressImage === 'function') {
        wx.compressImage({
          src: localPath,
          quality: 68,
          success: function (c) {
            resolve(c.tempFilePath || localPath);
          },
          fail: function () {
            resolve(localPath);
          }
        });
      } else {
        resolve(localPath);
      }
    },
    fail: function () {
      resolve(localPath);
    }
  });
}

function networkImageToLocalPath(url, resolve) {
  wx.getImageInfo({
    src: url,
    success: function (res) {
      if (res && res.path) {
        maybeCompressSharePath(res.path, resolve, url);
      } else {
        downloadFileForShare(url, resolve);
      }
    },
    fail: function () {
      downloadFileForShare(url, resolve);
    }
  });
}

function downloadFileForShare(url, resolve) {
  wx.downloadFile({
    url: url,
    success: function (res) {
      if (res.statusCode === 200 && res.tempFilePath) {
        maybeCompressSharePath(res.tempFilePath, resolve, url);
      } else {
        resolveShareImageWithPackageFallback(resolve);
      }
    },
    fail: function () {
      resolveShareImageWithPackageFallback(resolve);
    }
  });
}

/**
 * 分享前把网络图变为本地路径，再用于 onShareAppMessage / onShareTimeline。
 * 优先 wx.getImageInfo（官方会拉网图并给本地 path），失败再 downloadFile；过大则 compressImage。
 * 预加载到页面后同步返回 imageUrl，可避免仅依赖 promise 时超时仍用网链导致对方无图。
 */
function resolveShareImageForCard(preferredUrl) {
  const normalized =
    normalizeShareImageUrl(preferredUrl) ||
    normalizeShareImageUrl(DEFAULT_SHARE_IMAGE_URL) ||
    '';
  return new Promise(function (resolve) {
    if (!normalized) {
      resolve('');
      return;
    }
    if (normalized.indexOf('/') === 0 && normalized.indexOf('//') !== 0) {
      resolve(normalized);
      return;
    }
    if (!/^https:\/\//i.test(normalized)) {
      resolve(normalized);
      return;
    }
    networkImageToLocalPath(normalized, resolve);
  });
}

function resolveShareImageForCardFromBar(bar) {
  return resolveShareImageForCard(pickVenueShareImageUrl(bar));
}

function processImageUrl(imageUrl) {
  if (!imageUrl) return '';
  
  const url = String(imageUrl).trim();
  if (!url) return '';
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  let relativeUrl = url;
  if (relativeUrl.startsWith('/')) {
    relativeUrl = relativeUrl.substring(1);
  }
  
  return `${API_BASE_URL}/${relativeUrl}`;
}

/** 列表卡片封面最大边（逻辑像素约 480，适配两列栅格与高分屏） */
const LIST_COVER_MAX_WIDTH = 480

/**
 * 将封面图 URL 转为列表用缩略图地址，减轻流量、加快首屏（已知 CDN 规则；未知则返回原 URL）
 * 若缩略图加载失败，页面可清空 listImage 回退到原图。
 */
function toListCoverImageUrl(imageUrl) {
  if (!imageUrl) return ''
  const raw = String(imageUrl).trim()
  if (!raw || !/^https?:\/\//.test(raw)) return raw

  if (/[?&]x-oss-process=/.test(raw) ||
      /imageView2\//.test(raw) ||
      /[?&]imageMogr2\//.test(raw) ||
      /[?&]imageView2\//.test(raw)) {
    return raw
  }

  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    const sep = parsed.search ? '&' : '?'
    const w = LIST_COVER_MAX_WIDTH

    if (host.includes('aliyuncs.com') || host.includes('aliyun') && host.includes('oss')) {
      return raw + sep + 'x-oss-process=image/resize,w_' + w
    }
    if (host.includes('myqcloud.com') || /\.cos\./.test(host) || host.includes('file.myqcloud.com')) {
      return raw + sep + 'imageMogr2/thumbnail/!' + w + 'x' + w + 'r'
    }
    if (host.includes('qiniucdn.com') || host.includes('clouddn.com') || host.includes('qbox.me') || host.includes('qnssl.com')) {
      return raw + sep + 'imageView2/2/w/' + w
    }
  } catch (e) {
    return raw
  }
  return raw
}

function processApiResponse(data) {
  if (Array.isArray(data)) {
    return data;
  }
  
  if (data && typeof data === 'object') {
    const possibleArrayFields = ['data', 'result', 'list', 'items', 'records', 'rows', 'content', 'array'];
    
    for (const field of possibleArrayFields) {
      if (data[field] && Array.isArray(data[field])) {
        return data[field];
      }
    }
    
    for (const key in data) {
      if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
        for (const nestedKey in data[key]) {
          if (data[key][nestedKey] && Array.isArray(data[key][nestedKey])) {
            return data[key][nestedKey];
          }
        }
      }
    }
    
    const values = Object.values(data);
    for (let i = 0; i < values.length; i++) {
      if (Array.isArray(values[i])) {
        return values[i];
      }
    }
  }
  
  return [];
}

function getCategoryType(tags, item = null) {
  if (item && typeof item === 'object') {
    const categoryFields = [
      'category', 'Category', 'CATEGORY',
      'type', 'Type', 'TYPE',
      'category_name', 'categoryName', 'CategoryName',
      'type_name', 'typeName', 'TypeName',
      'kind', 'Kind', 'CLASS', 'class',
      'category_type', 'categoryType',
      'business_type', 'businessType',
      'industry', 'Industry'
    ];
    
    for (const field of categoryFields) {
      if (item[field] && typeof item[field] === 'string') {
        const category = item[field].trim();
        if (category && category.length > 0 && category.length < 20) {
          return category;
        }
      }
    }
  }

  let searchStr = '';
  if (tags) {
    if (Array.isArray(tags)) {
      searchStr = tags.join('|').toLowerCase();
    } else {
      searchStr = String(tags).toLowerCase();
    }
  }

  if (item && typeof item === 'object') {
    const fieldsToScan = [
      item.type, item.Type, item.TYPE,
      item.category, item.Category, item.CATEGORY,
      item.tags, item.Tags, item.tag, item.Tag,
      item.type_name, item.typeName,
      item.category_name, item.categoryName,
      item.kind, item.class, item.label,
      item.name, item.Name, item.title,
      item.description, item.desc
    ];
    
    const combinedInfo = fieldsToScan.filter(v => v && typeof v === 'string').join('|').toLowerCase();
    
    if (combinedInfo.includes('民宿') || combinedInfo.includes('minsu') || combinedInfo.includes('hotel') || 
        combinedInfo.includes('inn') || combinedInfo.includes('客栈') || combinedInfo.includes('酒店') || 
        combinedInfo.includes('度假村') || combinedInfo.includes('公寓') || combinedInfo.includes('住宿')) {
      return '民宿';
    }
    
    if (combinedInfo.includes('公园') || combinedInfo.includes('park') || combinedInfo.includes('gongyuan') || 
        combinedInfo.includes('景区') || combinedInfo.includes('风景') || combinedInfo.includes('游乐') || 
        combinedInfo.includes('园') && !combinedInfo.includes('酒吧')) {
      return '公园';
    }
    
    if (combinedInfo.includes('休闲') || combinedInfo.includes('xiuxian') || combinedInfo.includes('乐园') || 
        combinedInfo.includes('休闲中心') || combinedInfo.includes('娱乐场所') || combinedInfo.includes('体验馆')) {
      return '休闲';
    }
    
    if (combinedInfo.includes('酒吧') || combinedInfo.includes('bar') || combinedInfo.includes('jiuba') || 
        combinedInfo.includes('酒馆') || combinedInfo.includes('夜店') || combinedInfo.includes('club')) {
      return '酒吧';
    }
  }

  if (searchStr) {
    if (searchStr.includes('民宿') || searchStr.includes('minsu') || searchStr.includes('hotel')) return '民宿';
    if (searchStr.includes('公园') || searchStr.includes('park')) return '公园';
    if (searchStr.includes('休闲') || searchStr.includes('xiuxian')) return '休闲';
    if (searchStr.includes('酒吧') || searchStr.includes('bar')) return '酒吧';
  }

  return '';
}

function formatAddress(bar) {
  if (!bar) return '';
  
  let address = '';
  
  if (bar.fullAddress) {
    address = bar.fullAddress;
  } else if (bar.address) {
    address = (bar.province || '') + (bar.city || '') + (bar.district || '') + bar.address;
  } else {
    address = bar.location || bar.addr || bar.Address || bar.Addr || '';
  }
  
  if (address === '暂无地址') {
    address = '';
  }
  
  return address;
}

/**
 * 检查登录状态
 */
function checkLogin() {
  const token = wx.getStorageSync('token');
  const userInfo = wx.getStorageSync('userInfo');
  return !!(token && userInfo);
}

function getDailyCallCount() {
  const today = new Date().toDateString();
  const callRecords = wx.getStorageSync('callRecords') || {};
  
  for (const date in callRecords) {
    if (date !== today) {
      delete callRecords[date];
    }
  }
  
  wx.setStorageSync('callRecords', callRecords);
  return callRecords[today] || 0;
}

function incrementCallCount() {
  const today = new Date().toDateString();
  const callRecords = wx.getStorageSync('callRecords') || {};
  
  callRecords[today] = (callRecords[today] || 0) + 1;
  wx.setStorageSync('callRecords', callRecords);
  
  return callRecords[today];
}

function canMakeCall() {
  const count = getDailyCallCount();
  return count < 6;
}

/** 将两点 GCJ-02 经纬度的球面直线距离转为米（与腾讯地图直线距离含义一致） */
function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const r1 = Number(lat1);
  const r2 = Number(lat2);
  const g1 = Number(lng1);
  const g2 = Number(lng2);
  if ([r1, r2, g1, g2].some(n => !isFinite(n))) return NaN;
  const radLat1 = r1 * Math.PI / 180.0;
  const radLat2 = r2 * Math.PI / 180.0;
  const a = radLat1 - radLat2;
  const b = (g1 * Math.PI / 180.0) - (g2 * Math.PI / 180.0);
  const s = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin(a / 2), 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(b / 2), 2)
  ));
  return s * 6378137.0;
}

/** 米 → 展示用文案（如 1.2km、800m） */
function formatDistanceMeters(meters) {
  if (meters == null || !isFinite(meters) || meters < 0) return '';
  const m = Math.round(meters);
  if (m >= 1000) {
    return (m / 1000).toFixed(1) + 'km';
  }
  return m + 'm';
}

// 导出所有函数（微信小程序兼容）
module.exports = {
  processContactInfo,
  maskPhone,
  maskLandline,
  maskWechat,
  extractVenueName,
  extractVenueImages,
  normalizeVenueData,
  processImageUrl,
  pickVenueShareImageUrl,
  shareCardImageUrl,
  shareCardImageUrlFromBar,
  resolveShareImageForCard,
  resolveShareImageForCardFromBar,
  toListCoverImageUrl,
  processApiResponse,
  getCategoryType,
  formatAddress,
  checkLogin,
  getDailyCallCount,
  incrementCallCount,
  canMakeCall,
  haversineDistanceMeters,
  formatDistanceMeters
};
