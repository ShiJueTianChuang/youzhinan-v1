/**
 * 腾讯地图地理编码结果全小程序共享缓存（内存）
 * 避免首页 / 搜索 / 详情对同一完整地址重复调用 geocoder，节省配额与 QPS。
 */
const cache = {}

/** status:110 来源域名未授权 — 需在 lbs.qq.com 将 Key 配置为微信小程序并绑定 AppID，勿再批量请求 */
let geocoderKeyUnauthorized = false

function normalizeKey(address) {
  if (!address || typeof address !== 'string') return ''
  return address.trim()
}

function get(address) {
  const key = normalizeKey(address)
  return key ? cache[key] : null
}

function set(address, lat, lng) {
  const key = normalizeKey(address)
  if (!key) return
  cache[key] = { latitude: lat, longitude: lng }
}

function isGeocoderDisabledByKey() {
  return geocoderKeyUnauthorized
}

/**
 * 检测腾讯返回（fail 回调或 success 里 status≠0）
 * @returns {boolean} 是否为 Key 未授权，且本次调用后已全局禁用 geocoder
 */
function tryMarkKeyUnauthorized(payload) {
  if (!payload || geocoderKeyUnauthorized) return geocoderKeyUnauthorized
  const st = payload.status
  const msg = payload.message != null ? String(payload.message) : ''
  if (st === 110 || msg.indexOf('来源域名未被授权') !== -1) {
    geocoderKeyUnauthorized = true
    console.warn(
      '[腾讯地图] Key 未授权小程序来源（servicewechat.com）。请到 https://lbs.qq.com 控制台 → 应用管理 → 选 Key → 勾选「微信小程序」并填写本小程序 AppID（与 project.config.json 一致），保存后等待数分钟再试。文档：https://lbs.qq.com/miniProgram/jsSdk/jsSdkGuide/qqMapwx'
    )
    return true
  }
  return false
}

function isUnauthorizedGeocoderResponse(res) {
  if (!res || typeof res !== 'object') return false
  return tryMarkKeyUnauthorized(res)
}

module.exports = {
  get,
  set,
  normalizeKey,
  isGeocoderDisabledByKey,
  tryMarkKeyUnauthorized,
  isUnauthorizedGeocoderResponse
}
