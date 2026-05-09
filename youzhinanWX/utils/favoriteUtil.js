let favoriteState = {
  favoriteIds: new Set(),
  listeners: []
};

const STORAGE_KEY = 'favorite_ids';

function loadFromStorage() {
  try {
    const storedData = wx.getStorageSync(STORAGE_KEY);
    if (storedData && Array.isArray(storedData)) {
      favoriteState.favoriteIds = new Set(storedData);
    }
  } catch (e) {
    console.error('从本地存储加载收藏数据失败:', e);
    favoriteState.favoriteIds = new Set();
  }
}

function saveToStorage() {
  try {
    const dataToStore = Array.from(favoriteState.favoriteIds);
    wx.setStorageSync(STORAGE_KEY, dataToStore);
  } catch (e) {
    console.error('保存收藏数据到本地存储失败:', e);
  }
}

function notifyListeners() {
  favoriteState.listeners.forEach(listener => {
    try {
      listener();
    } catch (e) {
      console.error('收藏状态监听器错误:', e);
    }
  });
}

function subscribe(callback) {
  if (typeof callback === 'function') {
    favoriteState.listeners.push(callback);
  }
}

function unsubscribe(callback) {
  favoriteState.listeners = favoriteState.listeners.filter(l => l !== callback);
}

function initFavorites(callback) {
  loadFromStorage();
  if (callback) callback();
}

function refreshFavorites(callback) {
  loadFromStorage();
  notifyListeners();
  if (callback) callback();
}

function isFavorited(id) {
  const normalizedId = String(id);
  return favoriteState.favoriteIds.has(normalizedId);
}

function addFavorite(id, successCallback, failCallback) {
  const normalizedId = String(id);
  favoriteState.favoriteIds.add(normalizedId);
  saveToStorage();
  notifyListeners();
  wx.showToast({ title: '已收藏', icon: 'success' });
  if (successCallback) successCallback();
}

function removeFavorite(id, successCallback, failCallback) {
  const normalizedId = String(id);
  favoriteState.favoriteIds.delete(normalizedId);
  saveToStorage();
  notifyListeners();
  wx.showToast({ title: '已取消收藏', icon: 'none' });
  if (successCallback) successCallback();
}

function toggleFavorite(id, successCallback, failCallback) {
  if (isFavorited(id)) {
    removeFavorite(id, successCallback, failCallback);
  } else {
    addFavorite(id, successCallback, failCallback);
  }
}

function clearCache() {
  favoriteState.favoriteIds.clear();
  saveToStorage();
  notifyListeners();
}

module.exports = {
  initFavorites,
  refreshFavorites,
  isFavorited,
  addFavorite,
  removeFavorite,
  toggleFavorite,
  subscribe,
  unsubscribe,
  clearCache
};
