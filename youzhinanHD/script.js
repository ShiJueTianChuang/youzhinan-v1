// 信息后端管理系统 - 主脚本

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.createElement('div');
    toast.textContent = '已复制到剪贴板';
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#4CAF50;color:white;padding:8px 20px;border-radius:4px;z-index:10000;font-size:14px;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    alert('已复制到剪贴板');
  });
}

// ========== 全局变量 ==========
let currentPage = 'dashboard';
let currentEditId = null;
let selectedImageIndex = null;
let imageLibraryImages = [];
let uploadedImages = [];
let imageUploadBox;
let imageInput;
let imagePreview;

// ========== 联系方式脱敏工具函数 ==========
function maskContactValue(value, type) {
  if (!value) return '';
  const str = String(value);
  
  if (type === 'phone') {
    // 脱敏手机号：11 位数字，以 1 开头
    return str.replace(/(1\d{10})/g, (match) => {
      return match.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    });
  } else if (type === 'landline') {
    // 脱敏固定电话：区号 - 号码 或 号码
    return str.replace(/(0\d{2,3}-)(\d{3,4})(\d{4})/g, '$1****$3');
  } else if (type === 'wechat') {
    // 脱敏微信号：wxid_开头 或 纯字母数字
    let result = str.replace(/(wxid_)([a-zA-Z0-9]{2,})([a-zA-Z0-9]{3})/g, '$1****$3');
    result = result.replace(/([a-zA-Z]{2,})([a-zA-Z0-9]{4})([a-zA-Z0-9]{3})/g, '$1****$3');
    return result;
  }
  return str;
}

function maskContactDisplay(contactData) {
  if (!contactData) return { phone: [], wechat: [], landline: [] };
  
  let contact;
  try {
    // 尝试解析 JSON
    contact = typeof contactData === 'string' ? JSON.parse(contactData) : contactData;
  } catch (e) {
    // 如果是旧格式，转换为新格式
    contact = {
      phone: contactData ? [contactData] : [],
      wechat: [],
      landline: []
    };
  }
  
  return {
    phone: (contact.phone || []).map(p => maskContactValue(p, 'phone')),
    wechat: (contact.wechat || []).map(w => maskContactValue(w, 'wechat')),
    landline: (contact.landline || []).map(l => maskContactValue(l, 'landline'))
  };
}

// ========== 页面切换 ==========
function switchPage(pageName, skipDataLoad = false) {
  // 未登录时已在全屏登录页，无需弹窗
  const token = localStorage.getItem('token');
  if (!token) return;
  
  // 隐藏所有页面
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  // 显示目标页面
  const targetPage = document.getElementById(pageName);
  if (targetPage) {
    targetPage.classList.add('active');
  }
  
  // 更新侧边栏菜单状态
  document.querySelectorAll('.menu-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === pageName) {
      item.classList.add('active');
    }
  });
  
  currentPage = pageName;
  // 只在需要时重新加载数据
  if (!skipDataLoad) {
    loadPageData(pageName);
  }
}

// 统一加载页面数据（供登录后、切换标签页、刷新时调用）
function loadPageData(pageName) {
  if (!pageName) pageName = typeof currentPage !== 'undefined' ? currentPage : 'dashboard';
  if (pageName === 'dashboard') {
    loadDashboardStats();
    loadCategoryStats();
  } else if (pageName === 'all-info') {
    loadAllInfoCards();
  } else if (pageName === 'info-management') {
    loadInfoList();
  } else if (pageName === 'submission-review') {
    loadSubmissionReview();
  } else if (pageName === 'user-management') {
    loadUserList();
  } else if (pageName === 'category-management') {
    loadCategories();
  } else if (pageName === 'image-library') {
    loadImageLibrary();
  } else if (pageName === 'about-settings') {
    loadAboutSettings();
  } else if (pageName === 'lottery-management') {
    loadLotteryActivities();
  } else if (pageName === 'shipping-management') {
    loadShippingAddresses();
  } else if (pageName === 'messages-management') {
    loadMessagesList();
  } else if (pageName === 'customer-service') {
    loadCustomerService();
  } else if (pageName === 'app-version') {
    loadAppVersionList();
  }
}

// ========== 仪表盘 ==========
async function loadDashboardStats() {
  // 检查登录状态
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('未登录，无法加载仪表盘数据');
    return;
  }
  
  try {
    const response = await fetch('/api/stats');
    if (response.ok) {
      const stats = await response.json();
      
      // 更新统计卡片数字
      const statNumbers = document.querySelectorAll('.stat-card .stat-number');
      if (statNumbers.length >= 3) {
        animateNumber(statNumbers[0], stats.visit_count || 0);
        animateNumber(statNumbers[1], stats.favorite_count || 0);
        animateNumber(statNumbers[2], stats.view_count || 0);
      }
      console.log('仪表盘数据加载成功:', stats);
    } else {
      console.warn('获取统计数据失败');
    }
  } catch (error) {
    console.error('加载仪表盘数据出错:', error);
  }
}

// ========== 分类统计 ==========
async function loadCategoryStats() {
  // 检查登录状态
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('未登录，无法加载分类统计数据');
    renderCategoryStats([]);
    return;
  }
  
  try {
    const response = await fetch('/api/category/stats/count');
    if (response.ok) {
      const stats = await response.json();
      console.log('分类统计数据加载成功:', stats);
      renderCategoryStats(stats);
    } else {
      console.warn('获取分类统计数据失败');
      renderCategoryStats([]);
    }
  } catch (error) {
    console.error('加载分类统计数据出错:', error);
    renderCategoryStats([]);
  }
}

function renderCategoryStats(stats) {
  const statsGrid = document.getElementById('category-stats-grid');
  if (!statsGrid) return;
  
  if (!stats || stats.length === 0) {
    statsGrid.innerHTML = '<p style="text-align: center; color: #666; padding: 40px; grid-column: 1/-1;">暂无分类统计数据</p>';
    return;
  }
  
  statsGrid.innerHTML = '';
  
  stats.forEach(item => {
    const statCard = document.createElement('div');
    statCard.className = 'stat-card';
    
    // 根据分类设置不同的图标
    let icon = '📋';
    if (item.name === 'Bar' || item.name === '酒吧') icon = '🍸';
    else if (item.name === '民宿') icon = '🏠';
    else if (item.name === '公园') icon = '🌳';
    else if (item.name === '休闲') icon = '🎯';
    else if (item.name === '虚拟测试') icon = '💻';
    
    statCard.innerHTML = `
      <div class="stat-icon">${icon}</div>
      <div class="stat-info">
        <div class="stat-number">${item.count}</div>
        <div class="stat-label">${item.name}</div>
      </div>
    `;
    statsGrid.appendChild(statCard);
  });
}

// 数字动画效果
function animateNumber(element, target) {
  const duration = 1000;
  const start = parseInt(element.textContent) || 0;
  const increment = (target - start) / (duration / 16);
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if ((increment > 0 && current >= target) || (increment < 0 && current <= target)) {
      element.textContent = target.toLocaleString();
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current).toLocaleString();
    }
  }, 16);
}

// ========== 图片预览功能 ==========
let currentZoom = 100;
const MIN_ZOOM = 25;
const MAX_ZOOM = 400;
const ZOOM_STEP = 25;

function openImagePreview(src) {
  const modal = document.getElementById('image-preview-modal');
  const img = document.getElementById('image-preview-img');
  if (modal && img) {
    img.src = src;
    currentZoom = 100;
    img.style.transform = 'scale(1)';
    updateZoomLevel();
    modal.classList.add('active');
  }
}

function closeImagePreview() {
  const modal = document.getElementById('image-preview-modal');
  if (modal) {
    modal.classList.remove('active');
    currentZoom = 100;
  }
}

function updateZoomLevel() {
  const zoomDisplay = document.getElementById('zoom-level');
  if (zoomDisplay) {
    zoomDisplay.textContent = `${currentZoom}%`;
  }
  const img = document.getElementById('image-preview-img');
  if (img) {
    img.style.transform = `scale(${currentZoom / 100})`;
  }
}

function zoomIn() {
  if (currentZoom < MAX_ZOOM) {
    currentZoom = Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM);
    updateZoomLevel();
  }
}

function zoomOut() {
  if (currentZoom > MIN_ZOOM) {
    currentZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM);
    updateZoomLevel();
  }
}

function zoomReset() {
  currentZoom = 100;
  updateZoomLevel();
}

function zoomFit() {
  currentZoom = 100;
  updateZoomLevel();
}

function initImagePreviewModal() {
  const modal = document.getElementById('image-preview-modal');
  const closeBtn = document.querySelector('.image-preview-close');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeImagePreview);
  }
  
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('image-preview-container')) {
        closeImagePreview();
      }
    });
  }
  
  // 缩放按钮事件
  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const zoomResetBtn = document.getElementById('zoom-reset-btn');
  const zoomFitBtn = document.getElementById('zoom-fit-btn');
  
  if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
  if (zoomResetBtn) zoomResetBtn.addEventListener('click', zoomReset);
  if (zoomFitBtn) zoomFitBtn.addEventListener('click', zoomFit);
  
  // 鼠标滚轮缩放
  const previewImg = document.getElementById('image-preview-img');
  if (previewImg) {
    previewImg.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
    });
  }
  
  // ESC键关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeImagePreview();
    }
    // +/- 键缩放
    if (modal && modal.classList.contains('active')) {
      if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-') {
        zoomOut();
      } else if (e.key === '0') {
        zoomReset();
      }
    }
  });
}

// ========== 用户管理 ==========
let userManagementPage = 1;
let userManagementTotal = 0;
let userManagementPageSize = 20;

// 判断用户是否有有效头像
function hasValidAvatar(user) {
  const avatar = user.avatar_url || user.avatar;
  return avatar && 
         avatar !== 'null' && 
         avatar !== 'undefined' && 
         avatar.trim() !== '' && 
         !avatar.startsWith('http://tmp/');
}

async function loadUserList(page) {
  if (page !== undefined) userManagementPage = page;
  const token = localStorage.getItem('token');
  if (!token) {
    const tableBody = document.querySelector('#user-management tbody');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #666;">请先登录</td></tr>';
    }
    return;
  }
  const searchInput = document.getElementById('user-management-search');
  const search = searchInput ? searchInput.value.trim() : '';
  const avatarFilter = document.getElementById('avatar-filter');
  const sourceFilter = document.getElementById('source-filter');
  const avatarVal = avatarFilter ? avatarFilter.value : 'all';
  const sourceVal = sourceFilter ? sourceFilter.value : 'all';

  try {
    const params = new URLSearchParams({
      page: userManagementPage,
      pageSize: userManagementPageSize,
      search: search,
      avatar: avatarVal,
      source: sourceVal
    });
    const url = `/api/user?${params.toString()}`;
    const response = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
    const data = await response.json();

    if (!response.ok) {
      const tableBody = document.querySelector('#user-management tbody');
      if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #c00;">加载失败: ' + (data.error || data.message || response.status) + '</td></tr>';
      }
      renderUserPagination();
      return;
    }

    const users = data.list || [];
    userManagementTotal = Number(data.total) || 0;
    userManagementPage = Number(data.page) || 1;

    renderUserList(users);
    renderUserPagination();
  } catch (error) {
    console.error('获取用户列表失败:', error);
    const tableBody = document.querySelector('#user-management tbody');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #666;">加载用户数据失败</td></tr>';
    }
  }
}

function renderUserPagination() {
  const totalPages = Math.max(1, Math.ceil(userManagementTotal / userManagementPageSize));
  const prevBtn = document.getElementById('user-prev-page');
  const nextBtn = document.getElementById('user-next-page');
  const pageSelect = document.getElementById('user-page-select');
  const totalPagesSpan = document.getElementById('user-total-pages');
  const totalCountSpan = document.getElementById('user-total-count');

  if (prevBtn) prevBtn.disabled = userManagementPage <= 1;
  if (nextBtn) nextBtn.disabled = userManagementPage >= totalPages;
  if (totalPagesSpan) totalPagesSpan.textContent = totalPages;
  if (totalCountSpan) totalCountSpan.textContent = userManagementTotal;

  if (pageSelect) {
    pageSelect.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      if (i === userManagementPage) opt.selected = true;
      pageSelect.appendChild(opt);
    }
  }
}

// 渲染用户列表
function renderUserList(users) {
  console.log('=== renderUserList 函数开始执行 ===');
  console.log('用户数据:', users);
  
  const tableBody = document.querySelector('#user-management tbody');
  if(!tableBody) {
    console.error('未找到用户管理表格 tbody 元素');
    return;
  }
  
  if(!users || users.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #666;">暂无用户数据</td></tr>';
    return;
  }
  
  tableBody.innerHTML = '';
  
  users.forEach((user, index) => {
    console.log(`处理用户 ${index}:`, user);
    
    // 计算用户等级
    let level = '普通用户';
    if(user.is_admin) {
      level = '管理员';
    }
    
    // 处理头像显示
    const defaultAvatar = 'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22 viewBox=%220 0 200 200%22%3E%3Ccircle cx=%22100%22 cy=%22100%22 r=%2290%22 fill=%22%23f0f0f0%22 stroke=%22%23ddd%22 stroke-width=%224%22/%3E%3Ccircle cx=%2270%22 cy=%2280%22 r=%2212%22 fill=%22%23666%22/%3E%3Ccircle cx=%22130%22 cy=%2280%22 r=%2212%22 fill=%22%23666%22/%3E%3Cpath d=%22M70 120 Q100 150 130 120%22 stroke=%22%23666%22 stroke-width=%228%22 fill=%22none%22/%3E%3C/svg%3E';
    let avatarUrl = defaultAvatar;
    
    // 只有当用户头像URL存在且有效时，才使用它
    if (hasValidAvatar(user)) {
      const avatar = user.avatar_url || user.avatar;
      // 检查是否为相对路径，如果是，则添加完整的后端域名
      if (avatar.startsWith('/')) {
        avatarUrl = (process.env.PUBLIC_ORIGIN || 'https://your-domain.com') + avatar;
      } else {
        avatarUrl = avatar;
      }
    }
    
    // 处理昵称显示
    const nickname = user.nick_name || user.nickname || user.username || '未知用户';
    
    // 处理用户来源显示
    let sourceBadge = '<span style="background: #07c160; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">微信小程序</span>';
    if (user.app_user) {
      sourceBadge = '<span style="background: #1890ff; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">APP</span>';
    }

    // openid/手机/邮箱：微信显示 openid，APP 显示手机或邮箱
    let identifierCell = '-';
    if (user.app_user) {
      identifierCell = [user.phone, user.email].filter(Boolean).join(' / ') || '-';
    } else {
      identifierCell = (user.wx_openid || user.openid || '-');
    }
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="checkbox" data-id="${user.id}"></td>
      <td><img src="${avatarUrl}" alt="用户头像" title="点击查看大图\n昵称: ${nickname}" class="clickable-avatar" data-src="${avatarUrl}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #e5e7eb;"></td>
      <td>${nickname}</td>
      <td>${user.username || '-'}</td>
      <td>${sourceBadge}</td>
      <td style="font-size:12px;max-width:140px;overflow:hidden;text-overflow:ellipsis" title="${(identifierCell || '').replace(/"/g, '&quot;')}">${identifierCell}</td>
      <td>${user.symbol || '-'}</td>
      <td>${user.points || 0}</td>
      <td>
        <button class="btn action edit-btn" data-id="${user.id}">编辑</button>
        <button class="btn action delete-btn" data-id="${user.id}" data-username="${(user.username || '').replace(/"/g, '&quot;')}">删除</button>
      </td>
      <td>${level}</td>
    `;
    tableBody.appendChild(row);
  });
  
  // 绑定头像点击事件
  document.querySelectorAll('#user-management .clickable-avatar').forEach(img => {
    img.addEventListener('click', (e) => {
      const src = e.currentTarget.getAttribute('data-src');
      openImagePreview(src);
    });
  });
  
  // 绑定编辑按钮事件
  document.querySelectorAll('#user-management .edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = e.currentTarget.getAttribute('data-id');
      console.log('点击编辑用户按钮:', userId);
      alert(`编辑用户 ID: ${userId}`);
    });
  });
  
  // 绑定删除按钮事件
  document.querySelectorAll('#user-management .delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const userId = e.currentTarget.getAttribute('data-id');
      const username = e.currentTarget.getAttribute('data-username') || '';
      console.log('点击删除用户按钮:', userId);
      const who = username ? `账号「${username}」` : '该用户';
      if(confirm(`确定要删除${who}吗？（内部 ID: ${userId}）`)) {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/user/${userId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': 'Bearer ' + token
            }
          });
          
          if(response.ok) {
            alert('用户删除成功');
            loadUserList();
          } else {
            alert('用户删除失败');
          }
        } catch (error) {
          console.error('删除用户时出错:', error);
          alert('删除用户时出错');
        }
      }
    });
  });
  
  console.log('=== renderUserList 函数执行完成 ===');
}

// ========== 投稿审核 ==========
let submissionReviewPage = 1;
let submissionReviewStatus = 'pending';

async function loadSubmissionReview() {
  const token = localStorage.getItem('token');
  if (!token) return;
  const status = document.getElementById('submission-status-filter')?.value || 'pending';
  submissionReviewStatus = status;
  try {
    const [listRes, statsRes] = await Promise.all([
      fetch(`/api/admin/submissions?status=${status}&page=${submissionReviewPage}&pageSize=10`, {
        headers: { 'Authorization': 'Bearer ' + token }
      }),
      fetch('/api/admin/submissions/stats', { headers: { 'Authorization': 'Bearer ' + token } })
    ]);
    if (!listRes.ok || !statsRes.ok) {
      if (listRes.status === 403) alert('需要管理员权限');
      return;
    }
    const listData = await listRes.json();
    const statsData = await statsRes.json();
    const list = listData.data?.list || [];
    const stats = statsData.data || {};
    renderSubmissionStats(stats);
    renderSubmissionList(list);
  } catch (err) {
    console.error('加载投稿列表失败:', err);
    document.getElementById('submission-list').innerHTML = '<div class="empty-msg">加载失败，请刷新重试</div>';
  }
}

function renderSubmissionStats(stats) {
  const el = document.getElementById('submission-stats');
  if (!el) return;
  el.innerHTML = `
    <span class="stat-badge pending">待审核: ${stats.pending || 0}</span>
    <span class="stat-badge approved">已通过: ${stats.approved || 0}</span>
    <span class="stat-badge rejected">已拒绝: ${stats.rejected || 0}</span>
  `;
}

function renderSubmissionList(list) {
  const container = document.getElementById('submission-list');
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = '<div class="empty-msg">暂无投稿数据</div>';
    return;
  }
  container.innerHTML = list.map(s => {
    const imgs = (s.images || []).slice(0, 3);
    const imgHtml = imgs.length ? imgs.map(u => `<img src="${u}" alt="" class="submission-thumb">`).join('') : '<span class="no-img">无图片</span>';
    const statusClass = s.status === 'pending' ? 'pending' : s.status === 'approved' ? 'approved' : 'rejected';
    const statusText = s.status === 'pending' ? '待审核' : s.status === 'approved' ? '已通过' : '已拒绝';
    const deletedBadge = s.deleted_at ? '<span class="stat-badge deleted" style="margin-left:6px;background:#999">用户已删除</span>' : '';
    const submitterText = s.submitter_nickname ? s.submitter_nickname : (s.submitter_type === 'anonymous' ? '匿名用户' : (s.submitter_type === 'wechat' ? '微信用户' : 'APP用户'));
    return `
      <div class="submission-card" data-id="${s.id}">
        <div class="submission-card-images">${imgHtml}</div>
        <div class="submission-card-info">
          <div class="submission-store-name">${s.store_name || '-'}</div>
          <div class="submission-address">${s.province || ''} ${s.city || ''} ${s.district || ''} ${s.address || ''}</div>
          <div class="submission-meta">营业时间: ${s.business_hours || '-'} | 价格: ${s.price != null ? s.price : '-'}</div>
          <div class="submission-meta">投稿者: ${submitterText}</div>
          <div class="submission-status ${statusClass}">${statusText}${deletedBadge}</div>
        </div>
        <div class="submission-card-actions">
          <button class="btn btn-sm btn-primary view-submission-btn" data-id="${s.id}">查看</button>
          ${s.status === 'pending' ? `<button class="btn btn-sm btn-success approve-submission-btn" data-id="${s.id}">通过</button><button class="btn btn-sm btn-danger reject-submission-btn" data-id="${s.id}">拒绝</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
  bindSubmissionButtons();
}

function bindSubmissionButtons() {
  document.querySelectorAll('.view-submission-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      viewSubmissionDetail(e.currentTarget.getAttribute('data-id'));
    });
  });
  document.querySelectorAll('.approve-submission-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      approveSubmission(e.currentTarget.getAttribute('data-id'));
    });
  });
  document.querySelectorAll('.reject-submission-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showRejectForm(e.currentTarget.getAttribute('data-id'));
    });
  });
}

let currentReviewSubmissionId = null;

async function viewSubmissionDetail(id) {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch(`/api/admin/submissions/${id}`, { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return;
    const json = await res.json();
    const s = json.data;
    currentReviewSubmissionId = s.id;
    const imgs = (s.images || []).map(u => `<img src="${u}" alt="" class="submission-detail-img">`).join('');
    const content = document.getElementById('submission-detail-content');
    const submitterText = s.submitter_nickname ? s.submitter_nickname : (s.submitter_type === 'anonymous' ? '匿名用户' : (s.submitter_type === 'wechat' ? '微信用户' : 'APP用户'));
    content.innerHTML = `
      <div class="detail-row"><label>店名:</label> ${s.store_name || '-'}</div>
      <div class="detail-row"><label>投稿者:</label> ${submitterText}</div>
      ${s.category ? `<div class="detail-row"><label>分类:</label> ${s.category}</div>` : ''}
      <div class="detail-row"><label>地区:</label> ${s.province || ''} ${s.city || ''} ${s.district || ''}</div>
      <div class="detail-row"><label>详细地址:</label> ${s.address || '-'}</div>
      <div class="detail-row"><label>营业时间:</label> ${s.business_hours || '-'}</div>
      <div class="detail-row"><label>价格:</label> ${s.price != null ? s.price : '-'}</div>
      <div class="detail-row"><label>描述:</label> ${s.description || '-'}</div>
      <div class="detail-row"><label>联系方式:</label> ${s.contact || '-'}</div>
      <div class="detail-row"><label>状态:</label> ${s.status === 'pending' ? '待审核' : s.status === 'approved' ? '已通过' : '已拒绝'}${s.deleted_at ? ' <span style="color:#999;margin-left:8px">(用户已删除)</span>' : ''}</div>
      ${s.reject_reason ? `<div class="detail-row"><label>拒绝原因:</label> ${s.reject_reason}</div>` : ''}
      <div class="detail-row"><label>投稿时间:</label> ${s.created_at || '-'}</div>
      <div class="detail-row"><label>图片:</label></div>
      <div class="submission-detail-images">${imgs || '无'}</div>
    `;
    const actions = document.getElementById('submission-review-actions');
    const rejectForm = document.getElementById('submission-reject-form');
    if (s.status === 'pending') {
      actions.style.display = 'flex';
      rejectForm.style.display = 'none';
    } else {
      actions.style.display = 'none';
      rejectForm.style.display = 'none';
    }
    document.getElementById('submission-detail-modal').style.display = 'block';
  } catch (err) {
    console.error('获取投稿详情失败:', err);
  }
}

async function approveSubmission(id) {
  const token = localStorage.getItem('token');
  if (!token) return;
  if (!confirm('确定通过并上架此投稿？')) return;
  try {
    const res = await fetch(`/api/admin/submissions/${id}/approve`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    });
    const json = await res.json();
    if (json.code === 200) {
      alert('已通过并上架');
      closeModal('submission-detail-modal');
      loadSubmissionReview();
    } else {
      alert(json.message || '操作失败');
    }
  } catch (err) {
    console.error('审核通过失败:', err);
    alert('操作失败');
  }
}

function showRejectForm(id) {
  currentReviewSubmissionId = id;
  document.getElementById('submission-reject-reason').value = '';
  document.getElementById('submission-review-actions').style.display = 'none';
  document.getElementById('submission-reject-form').style.display = 'block';
}

async function confirmRejectSubmission() {
  const id = currentReviewSubmissionId;
  if (!id) return;
  const token = localStorage.getItem('token');
  const reason = document.getElementById('submission-reject-reason')?.value?.trim() || '';
  try {
    const res = await fetch(`/api/admin/submissions/${id}/reject`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const json = await res.json();
    if (json.code === 200) {
      alert('已拒绝');
      closeModal('submission-detail-modal');
      document.getElementById('submission-reject-form').style.display = 'none';
      document.getElementById('submission-review-actions').style.display = 'flex';
      loadSubmissionReview();
    } else {
      alert(json.message || '操作失败');
    }
  } catch (err) {
    console.error('拒绝失败:', err);
    alert('操作失败');
  }
}

// ========== 信息管理 ==========
async function loadInfoList(searchQuery = '') {
  // 检查登录状态
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('未登录，无法加载信息列表');
    const tableBody = document.querySelector('#info-management tbody');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">请先登录</td></tr>';
    }
    return;
  }
  
  try {
    let url = '/api/info';
    if (searchQuery) {
      url += `?search=${encodeURIComponent(searchQuery)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const infos = data.value || data; // 处理后端返回的不同数据结构
    console.log('信息管理数据加载成功:', infos);
    renderInfoList(infos);
  } catch (error) {
    console.error('获取信息列表失败:', error);
    const tableBody = document.querySelector('#info-management tbody');
    if (tableBody) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">加载信息失败，请刷新页面重试</td></tr>';
    }
  }
}

function renderInfoList(infos) {
  const tableBody = document.querySelector('#info-management tbody');
  if (!tableBody) return;
  
  if (!infos || infos.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">暂无信息数据</td></tr>';
    return;
  }
  
  tableBody.innerHTML = '';
  
  infos.forEach((info, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="checkbox" data-id="${info.id}"></td>
      <td>${index + 1}</td>
      <td>${info.store_name || '-'}</td>
      <td><span class="category-tag">${info.category || '-'}</span></td>
      <td>${info.province || ''}${info.city || ''}${info.district || ''}${info.address || ''}</td>
      <td>
        <button class="btn action view-btn" data-id="${info.id}">查看</button>
        <button class="btn action edit-info-btn" data-id="${info.id}">编辑</button>
        <button class="btn action delete-info-btn" data-id="${info.id}">删除</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
  
  // 绑定操作按钮事件
  bindInfoActionButtons();
}

function bindInfoActionButtons() {
  // 查看按钮
  document.querySelectorAll('#info-management .view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const infoId = e.currentTarget.getAttribute('data-id');
      viewInfoDetail(infoId);
    });
  });
  
  // 编辑按钮
  document.querySelectorAll('#info-management .edit-info-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const infoId = e.currentTarget.getAttribute('data-id');
      editInfo(infoId);
    });
  });
  
  // 删除按钮
  document.querySelectorAll('#info-management .delete-info-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const infoId = e.currentTarget.getAttribute('data-id');
      if (confirm('确定要删除此信息吗？')) {
        await deleteInfo(infoId);
      }
    });
  });
}

async function viewInfoDetail(id) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/info/${id}`, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    const info = await response.json();
    
    currentDetailInfo = info;
    
    document.getElementById('detail-store-name').textContent = info.store_name || '信息详情';
    document.getElementById('detail-store-name-2').textContent = info.store_name || '-';
    document.getElementById('detail-category').textContent = info.category || '-';
    document.getElementById('detail-region').textContent = `${info.province || ''}${info.city || ''}${info.district || ''}`;
    document.getElementById('detail-address').textContent = info.address || '-';
    document.getElementById('detail-created-at').textContent = info.created_at || '-';
    document.getElementById('detail-updated-at').textContent = info.updated_at || '-';
    document.getElementById('detail-view-count').textContent = info.view_count || 0;
    
    // 处理联系方式显示：解析 JSON 并格式化显示
    const contactDisplay = document.getElementById('detail-contact');
    if (info.contact) {
      let contactData;
      try {
        contactData = typeof info.contact === 'string' ? JSON.parse(info.contact) : info.contact;
      } catch (e) {
        // 旧格式，直接显示
        contactDisplay.textContent = info.contact;
        contactData = null;
      }
      
      if (contactData) {
        // 使用脱敏函数处理联系方式
        const maskedContact = maskContactDisplay(contactData);
        const contactTexts = [];
        if (maskedContact.phone && maskedContact.phone.length > 0) {
          contactTexts.push('📞 电话：' + maskedContact.phone.join(', '));
        }
        if (maskedContact.wechat && maskedContact.wechat.length > 0) {
          contactTexts.push('💬 微信：' + maskedContact.wechat.join(', '));
        }
        if (maskedContact.landline && maskedContact.landline.length > 0) {
          contactTexts.push('☎️ 座机：' + maskedContact.landline.join(', '));
        }
        contactDisplay.textContent = contactTexts.join(' | ') || '-';
      }
    } else {
      contactDisplay.textContent = '-';
    }
    
    document.getElementById('detail-description').textContent = info.description || '-';
    document.getElementById('detail-business-hours').textContent = info.business_hours || '-';
    document.getElementById('detail-price').textContent = info.price ? `¥${info.price}` : '-';
    
    // 显示图片
    const imagesContainer = document.getElementById('detail-images');
    imagesContainer.innerHTML = '';
    if (info.images && info.images.length > 0) {
      info.images.forEach(img => {
        const imgEl = document.createElement('img');
        imgEl.src = img;
        imgEl.alt = '信息图片';
        imgEl.className = 'detail-image clickable-avatar';
        imgEl.onclick = () => openImagePreview(img);
        imagesContainer.appendChild(imgEl);
      });
    } else {
      imagesContainer.innerHTML = '<p>暂无图片</p>';
    }
    
    // 添加收藏按钮到详情页
    const detailActions = document.getElementById('detail-actions');
    if (detailActions) {
      detailActions.innerHTML = `<button class="btn btn-secondary favorite-btn" data-id="${info.id}">${info.isFavorited ? '❤️ 已收藏' : '♡ 收藏'}</button>`;
      const favBtn = detailActions.querySelector('.favorite-btn');
      favBtn.addEventListener('click', () => toggleWebFavorite(info.id, favBtn));
    }
    
    switchPage('info-detail');
  } catch (error) {
    console.error('获取信息详情失败:', error);
    alert('获取信息详情失败');
  }
}

async function editInfo(id) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/info/${id}`, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    const info = await response.json();
    
    currentEditId = id;
    document.getElementById('modal-title').textContent = '编辑信息';
    document.getElementById('store-name').value = info.store_name || '';
    
    // 先加载分类选项，再设置分类值
    await loadCategoryOptions();
    document.getElementById('category').value = info.category || '';
    
    document.getElementById('address').value = info.address || '';
    
    // 处理联系方式：填充到新的输入框中
    if (window.fillContactInputs) {
      window.fillContactInputs(info.contact);
    }
    
    document.getElementById('description').value = info.description || '';
    document.getElementById('business_hours').value = info.business_hours || '';
    document.getElementById('price').value = info.price || '';
    document.getElementById('latitude').value = info.latitude || '';
    document.getElementById('longitude').value = info.longitude || '';
    document.getElementById('rating').value = info.rating || '';
    
    // 回填省市区（需要先触发change事件生成选项）
    const provinceSelect = document.getElementById('province');
    const citySelect = document.getElementById('city');
    const districtSelect = document.getElementById('district');
    
    if (info.province && provinceSelect) {
      provinceSelect.value = info.province;
      // 触发省份改变，生成城市选项
      provinceSelect.dispatchEvent(new Event('change'));
      
      // 延迟设置城市值
      setTimeout(() => {
        if (info.city && citySelect) {
          citySelect.value = info.city;
          // 触发城市改变，生成区县选项
          citySelect.dispatchEvent(new Event('change'));
          
          // 延迟设置区县值
          setTimeout(() => {
            if (info.district && districtSelect) {
              districtSelect.value = info.district;
            }
          }, 50);
        }
      }, 50);
    }
    
    // 处理图片信息
    // 无论info.images是否为空，都重置上传图片数组
    if (window.resetUploadedImages) {
      window.resetUploadedImages();
    }
    
    // 添加原有图片
    if (info.images && info.images.length > 0) {
      // 使用 addLibraryImage 函数添加原有图片
      info.images.forEach(imgUrl => {
        if (window.addLibraryImage) {
          window.addLibraryImage(imgUrl);
        }
      });
    }
    
    document.getElementById('info-modal').style.display = 'block';
  } catch (error) {
    console.error('获取信息失败:', error);
    alert('获取信息失败');
  }
}

async function deleteInfo(id) {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`/api/info/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    
    if (response.ok) {
      alert('删除成功');
      loadInfoList();
      loadAllInfoCards();
    } else {
      alert('删除失败');
    }
  } catch (error) {
    console.error('删除信息失败:', error);
    alert('删除失败');
  }
}

// 更新批量删除按钮状态
function updateBatchDeleteBtnState() {
  const btn = document.getElementById('batch-delete-btn');
  const checkedCount = document.querySelectorAll('#info-management tbody input[type="checkbox"]:checked').length;
  if (btn) {
    btn.disabled = checkedCount === 0;
    btn.textContent = checkedCount > 0 ? `批量删除 (${checkedCount})` : '批量删除';
  }
}

// 批量删除信息
async function batchDeleteInfo() {
  const checkedBoxes = document.querySelectorAll('#info-management tbody input[type="checkbox"]:checked');
  if (checkedBoxes.length === 0) {
    alert('请先选择要删除的信息');
    return;
  }
  
  if (!confirm(`确定要删除选中的 ${checkedBoxes.length} 条信息吗？`)) {
    return;
  }
  
  const ids = Array.from(checkedBoxes).map(cb => cb.dataset.id);
  let successCount = 0;
  let failCount = 0;
  
  const token = localStorage.getItem('token');
  
  for (const id of ids) {
    try {
      const response = await fetch(`/api/info/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });
      if (response.ok) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      console.error('删除失败:', error);
      failCount++;
    }
  }
  
  // 重置全选checkbox
  const selectAll = document.getElementById('select-all');
  if (selectAll) selectAll.checked = false;
  
  alert(`删除完成！成功: ${successCount}，失败: ${failCount}`);
  loadInfoList();
  loadAllInfoCards();
  updateBatchDeleteBtnState();
}

// 更新图片批量删除按钮状态
function updateBatchDeleteImagesBtnState() {
  const btn = document.getElementById('batch-delete-images-btn');
  const checkedCount = document.querySelectorAll('#image-list .image-checkbox:checked').length;
  if (btn) {
    btn.disabled = checkedCount === 0;
    btn.textContent = checkedCount > 0 ? `批量删除 (${checkedCount})` : '批量删除';
  }
}

// 批量删除图片
async function batchDeleteImages() {
  const checkedBoxes = document.querySelectorAll('#image-list .image-checkbox:checked');
  if (checkedBoxes.length === 0) {
    alert('请先选择要删除的图片');
    return;
  }
  
  if (!confirm(`确定要删除选中的 ${checkedBoxes.length} 张图片吗？`)) {
    return;
  }
  
  const filenames = Array.from(checkedBoxes).map(cb => cb.dataset.filename);
  let successCount = 0;
  let failCount = 0;
  
  for (const filename of filenames) {
    try {
      const response = await fetch(`/api/images/delete/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      if (response.ok) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      console.error('删除图片失败:', error);
      failCount++;
    }
  }
  
  // 重置全选checkbox
  const selectAll = document.getElementById('select-all-images');
  if (selectAll) selectAll.checked = false;
  
  alert(`删除完成！成功: ${successCount}，失败: ${failCount}`);
  loadImageLibrary();
  updateBatchDeleteImagesBtnState();
}

// ========== 所有信息（卡片视图）==========
async function loadAllInfoCards(searchQuery = '') {
  // 检查登录状态
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('未登录，无法加载信息列表');
    const infoList = document.querySelector('#all-info .info-list');
    if (infoList) {
      infoList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px; grid-column: 1/-1;">请先登录</p>';
    }
    return;
  }
  
  try {
    let url = '/api/info';
    if (searchQuery) {
      url += `?search=${encodeURIComponent(searchQuery)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    const infos = data.value || data; // 处理后端返回的不同数据结构
    console.log('所有信息数据加载成功:', infos);
    renderAllInfoCards(infos);
  } catch (error) {
    console.error('获取信息列表失败:', error);
    const infoList = document.querySelector('#all-info .info-list');
    if (infoList) {
      infoList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px; grid-column: 1/-1;">加载信息失败，请刷新页面重试</p>';
    }
  }
}

function renderAllInfoCards(infos) {
  const infoList = document.querySelector('#all-info .info-list');
  if (!infoList) return;
  
  infoList.innerHTML = '';
  
  if (!infos || infos.length === 0) {
    infoList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px; grid-column: 1/-1;">暂无信息数据</p>';
    return;
  }
  
  infos.forEach(info => {
    const card = document.createElement('div');
    card.className = 'info-card';
    card.style.cursor = 'pointer';
    
    // 处理图片
    let imagesHtml = '';
    if (info.images && info.images.length > 0) {
      const displayImages = info.images.slice(0, 3);
      imagesHtml = `<div class="info-images">${displayImages.map(img => `<img src="${img}" alt="图片" onerror="this.style.display='none'">`).join('')}</div>`;
    }
    
    // 分类标签 class
    let categoryClass = '';
    if (info.category === '酒吧') categoryClass = 'bar';
    else if (info.category === '民宿') categoryClass = 'homestay';
    else if (info.category === '公园') categoryClass = 'park';
    else categoryClass = 'others';
    
    card.innerHTML = `
      <div class="card-header">
        <div>
          <h3>${info.store_name || '未命名'}</h3>
          <div class="info-location">📍 ${info.province || ''}${info.city || ''}${info.district || ''}</div>
        </div>
        <span class="category-tag ${categoryClass}">${info.category || '未分类'}</span>
      </div>
      <div class="card-body">
        <div class="info-address">${info.address || '暂无详细地址'}</div>
        ${imagesHtml}
        <div class="card-actions">
          <button class="btn btn-primary view-detail-btn" data-id="${info.id}">查看详情</button>
          <button class="btn btn-secondary favorite-btn" data-id="${info.id}">${info.isFavorited ? '❤️ 已收藏' : '♡ 收藏'}</button>
        </div>
      </div>
    `;
    
    infoList.appendChild(card);
  });
  
  // 绑定查看详情按钮
  document.querySelectorAll('#all-info .view-detail-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const infoId = e.currentTarget.getAttribute('data-id');
      viewInfoDetail(infoId);
    });
  });

  // bind favorite buttons
  document.querySelectorAll('#all-info .favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      toggleWebFavorite(id, btn);
    });
  });
  
  // 绑定卡片点击事件
  document.querySelectorAll('#all-info .info-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.classList.contains('btn')) {
        const btn = card.querySelector('.view-detail-btn');
        if (btn) {
          const infoId = btn.getAttribute('data-id');
          viewInfoDetail(infoId);
        }
      }
    });
  });
}


// ========== 收藏处理 ==========

// 切换收藏（网页端）
async function toggleWebFavorite(infoId, buttonElement) {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('请先登录');
    return;
  }

  // 先查询当前状态
  const checked = await checkWebFavorite(infoId);
  const method = checked ? 'DELETE' : 'POST';
  const url = checked ? `/api/favorites?info_id=${infoId}` : '/api/favorites';
  const body = checked ? null : JSON.stringify({ info_id: infoId });

  try {
    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body
    });
    const result = await resp.json();
    if (resp.ok && result.code === 200) {
      const newState = !checked;
      if (buttonElement) buttonElement.textContent = newState ? '❤️ 已收藏' : '♡ 收藏';
      // 更新统计
      loadDashboardStats();
    } else {
      alert(result.message || '收藏操作失败');
    }
  } catch (e) {
    console.error('收藏请求失败', e);
    alert('网络错误');
  }
}

// 查询是否已收藏（网页端）
async function checkWebFavorite(infoId) {
  const token = localStorage.getItem('token');
  if (!token) return false;
  try {
    const resp = await fetch(`/api/favorites/check?info_id=${infoId}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await resp.json();
    return resp.ok && data.code === 200 && data.data.favorited;
  } catch (e) {
    console.error('查询收藏状态失败', e);
    return false;
  }
}

// ========== 分类管理 ==========
let currentCategoryId = null;

async function loadCategories() {
  // 检查登录状态
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('未登录，无法加载分类列表');
    const categoryList = document.getElementById('category-list');
    if (categoryList) {
      categoryList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">请先登录</p>';
    }
    return;
  }
  
  try {
    const response = await fetch('/api/category', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    const data = await response.json();
    const categories = data.value || data; // 处理后端返回的不同数据结构
    console.log('获取分类列表成功:', categories);
    renderCategories(categories);
  } catch (error) {
    console.error('获取分类列表失败:', error);
    const categoryList = document.getElementById('category-list');
    if (categoryList) {
      categoryList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">加载分类失败</p>';
    }
  }
}

function renderCategories(categories) {
  const categoryList = document.getElementById('category-list');
  if (!categoryList) return;
  
  categoryList.innerHTML = '';
  
  if (!categories || categories.length === 0) {
    categoryList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">暂无分类数据</p>';
    return;
  }
  
  categories.forEach(category => {
    const item = document.createElement('div');
    item.className = 'category-item';
    item.innerHTML = `
      <span class="category-name">${category.name}</span>
      <div class="category-actions">
        <button class="btn action edit-category-btn" data-id="${category.id}" data-name="${category.name}">编辑</button>
        <button class="btn action delete-category-btn" data-id="${category.id}">删除</button>
      </div>
    `;
    categoryList.appendChild(item);
  });
  
  // 绑定分类操作按钮事件
  bindCategoryButtons();
}

function bindCategoryButtons() {
  document.querySelectorAll('.edit-category-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const categoryId = e.currentTarget.getAttribute('data-id');
      const categoryName = e.currentTarget.getAttribute('data-name');
      currentCategoryId = categoryId;
      document.getElementById('category-modal-title').textContent = '编辑分类';
      document.getElementById('category-name').value = categoryName;
      openModal('category-modal');
    });
  });
  
  document.querySelectorAll('.delete-category-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const categoryId = e.currentTarget.getAttribute('data-id');
      if (confirm('确定要删除此分类吗？')) {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/category/${categoryId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': 'Bearer ' + token
            }
          });
          const result = await response.json();
          if (response.ok) {
            alert('删除成功');
            loadCategories();
          } else {
            alert(result.error || '删除失败');
          }
        } catch (error) {
          console.error('删除分类失败:', error);
        }
      }
    });
  });
}

async function saveCategory(name) {
  // 检查登录状态
  const token = localStorage.getItem('token');
  if (!token) {
    alert('请先登录');
    checkLoginStatus();
    return;
  }
  
  try {
    const url = currentCategoryId ? `/api/category/${currentCategoryId}` : '/api/category';
    const method = currentCategoryId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ name })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      alert(currentCategoryId ? '更新成功' : '添加成功');
      closeModal('category-modal');
      loadCategories();
    } else {
      alert(result.error || '操作失败');
    }
  } catch (error) {
    console.error('保存分类失败:', error);
    alert('保存失败');
  }
}

// 加载分类到信息表单的下拉选择器
async function loadCategoryOptions() {
  const categorySelect = document.getElementById('category');
  if (!categorySelect) return;
  
  try {
    const response = await fetch('/api/category');
    const categories = await response.json();
    
    // 保留默认选项
    categorySelect.innerHTML = '<option value="">请选择分类</option>';
    
    if (categories && categories.length > 0) {
      categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        categorySelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('加载分类选项失败:', error);
  }
}

// ========== 图片库 ==========
async function loadImageLibrary() {
  // 检查登录状态
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('未登录，无法加载图片库');
    const imageList = document.getElementById('image-list');
    if (imageList) {
      imageList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px; grid-column: 1/-1;">请先登录</p>';
    }
    return;
  }
  
  try {
    const response = await fetch('/api/images/list', {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });
    const result = await response.json();
    if (result.success) {
      console.log('获取图片库成功:', result.data);
      renderImageLibrary(result.data);
    } else {
      console.error('获取图片库失败:', result.error);
      const imageList = document.getElementById('image-list');
      if (imageList) {
        imageList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px; grid-column: 1/-1;">加载图片库失败</p>';
      }
    }
  } catch (error) {
    console.error('获取图片库失败:', error);
    const imageList = document.getElementById('image-list');
    if (imageList) {
      imageList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px; grid-column: 1/-1;">加载图片库失败</p>';
    }
  }
}

function renderImageLibrary(images) {
  const imageList = document.getElementById('image-list');
  if (!imageList) return;
  
  imageList.innerHTML = '';
  
  if (!images || images.length === 0) {
    imageList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px; grid-column: 1/-1;">暂无图片</p>';
    return;
  }
  
  images.forEach(image => {
    const item = document.createElement('div');
    item.className = 'image-item';
    
    // 格式化文件大小
    const sizeKB = (image.size / 1024).toFixed(1);
    const sizeText = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
    
    item.innerHTML = `
      <input type="checkbox" class="image-checkbox" data-filename="${image.filename}" style="position: absolute; top: 10px; left: 10px; z-index: 10;">
      <img src="${image.url}" alt="${image.filename}" class="image-preview clickable-avatar" data-src="${image.url}">
      <div class="image-info">
        <div class="image-name" title="${image.filename}">${image.filename}</div>
        <div class="image-size">${sizeText}</div>
        <div class="image-actions">
          <button class="btn btn-danger action-btn delete-image-btn" data-filename="${image.filename}">删除</button>
        </div>
      </div>
    `;
    item.style.position = 'relative';
    imageList.appendChild(item);
  });
  
  // 绑定图片点击预览事件
  document.querySelectorAll('#image-list .clickable-avatar').forEach(img => {
    img.addEventListener('click', (e) => {
      const src = e.currentTarget.getAttribute('data-src');
      openImagePreview(src);
    });
  });
  
  // 绑定删除按钮事件
  document.querySelectorAll('.delete-image-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const filename = e.currentTarget.getAttribute('data-filename');
      if (confirm('确定要删除此图片吗？')) {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/images/delete/${encodeURIComponent(filename)}`, {
            method: 'DELETE',
            headers: {
              'Authorization': 'Bearer ' + token
            }
          });
          if (response.ok) {
            alert('删除成功');
            loadImageLibrary();
          } else {
            alert('删除失败');
          }
        } catch (error) {
          console.error('删除图片失败:', error);
        }
      }
    });
  });
}

// ========== 模态框处理 ==========
function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'block';
  }
}

// ========== 地区选择器初始化 ==========
function initRegionSelectors() {
  console.log('=== 初始化地区选择器 ===');
  
  const provinceSelect = document.getElementById('province');
  const citySelect = document.getElementById('city');
  const districtSelect = document.getElementById('district');
  
  if (!provinceSelect || !citySelect || !districtSelect) {
    console.error('未找到地区选择器元素');
    return;
  }
  
  // 直接使用全局变量
  console.log('CHINESE_REGIONS:', typeof window.CHINESE_REGIONS);
  
  if (!window.CHINESE_REGIONS) {
    console.error('CHINESE_REGIONS 数据未加载，尝试延迟初始化');
    // 延迟100ms后重试
    setTimeout(initRegionSelectors, 100);
    return;
  }
  
  const regionsData = window.CHINESE_REGIONS;
  console.log('地区数据加载成功，省份数量:', Object.keys(regionsData).length);
  
  // 清空并填充省份
  provinceSelect.innerHTML = '<option value="">请选择省份</option>';
  Object.keys(regionsData).forEach(province => {
    const option = document.createElement('option');
    option.value = province;
    option.textContent = province;
    provinceSelect.appendChild(option);
  });
  
  console.log('省份选项已填充，共', provinceSelect.options.length - 1, '个省份');
  
  // 移除旧的事件监听器（防止重复绑定）
  const newProvinceSelect = provinceSelect.cloneNode(true);
  provinceSelect.parentNode.replaceChild(newProvinceSelect, provinceSelect);
  
  const newCitySelect = citySelect.cloneNode(true);
  citySelect.parentNode.replaceChild(newCitySelect, citySelect);
  
  // 重新获取新元素
  const pSelect = document.getElementById('province');
  const cSelect = document.getElementById('city');
  const dSelect = document.getElementById('district');
  
  // 省份改变时更新城市
  pSelect.addEventListener('change', function() {
    const province = this.value;
    console.log('省份改变:', province);
    
    cSelect.innerHTML = '<option value="">请选择城市</option>';
    dSelect.innerHTML = '<option value="">请选择区县</option>';
    
    if (province && window.CHINESE_REGIONS[province]) {
      const cities = window.CHINESE_REGIONS[province].城市 || [];
      console.log('城市列表:', cities);
      cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city;
        option.textContent = city;
        cSelect.appendChild(option);
      });
    }
  });
  
  // 城市改变时更新区县
  cSelect.addEventListener('change', function() {
    const province = pSelect.value;
    const city = this.value;
    console.log('城市改变:', city);
    
    dSelect.innerHTML = '<option value="">请选择区县</option>';
    
    if (province && city && window.CHINESE_REGIONS[province] && window.CHINESE_REGIONS[province].地区 && window.CHINESE_REGIONS[province].地区[city]) {
      const districts = window.CHINESE_REGIONS[province].地区[city];
      console.log('区县列表:', districts);
      districts.forEach(district => {
        const option = document.createElement('option');
        option.value = district;
        option.textContent = district;
        dSelect.appendChild(option);
      });
    }
  });
  
  console.log('地区选择器初始化完成');
}

// ========== 图片库选择功能 ==========
let selectedLibraryImages = [];

function openImageLibraryForSelect() {
  const modal = document.getElementById('image-library-modal');
  const grid = document.getElementById('image-library-grid');
  const selectBtn = document.getElementById('image-library-select');
  const cancelBtn = document.getElementById('image-library-cancel');
  
  if (!modal || !grid) return;
  
  selectedLibraryImages = [];
  if (selectBtn) selectBtn.disabled = true;
  
  // 加载图片库
  fetch('/api/images/list')
    .then(res => res.json())
    .then(data => {
      const images = data.data || [];
      grid.innerHTML = images.map(img => {
        const url = img.url || `/uploads/${img.filename}`;
        return `<div class="image-library-item" data-url="${url}">
          <img src="${url}" alt="图片">
        </div>`;
      }).join('');
      
      if (images.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:#666;padding:20px;">图片库暂无图片</p>';
      }
      
      // 绑定点击选择
      grid.querySelectorAll('.image-library-item').forEach(item => {
        item.addEventListener('click', () => {
          const url = item.dataset.url;
          const index = selectedLibraryImages.indexOf(url);
          
          if (index > -1) {
            selectedLibraryImages.splice(index, 1);
            item.classList.remove('selected');
          } else if (selectedLibraryImages.length < 3 - uploadedImages.length) {
            selectedLibraryImages.push(url);
            item.classList.add('selected');
          }
          
          if (selectBtn) selectBtn.disabled = selectedLibraryImages.length === 0;
        });
      });
    })
    .catch(err => {
      console.error('加载图片库失败:', err);
      grid.innerHTML = '<p>加载失败</p>';
    });
  
  // 确认选择
  if (selectBtn) {
    selectBtn.onclick = () => {
      selectedLibraryImages.forEach(url => {
        uploadedImages.push({ dataUrl: url, isLibrary: true });
      });
      modal.style.display = 'none';
      // 触发预览更新
      const event = new Event('librarySelected');
      document.dispatchEvent(event);
    };
  }
  
  // 取消
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      modal.style.display = 'none';
    };
  }
  
  modal.style.display = 'block';
}

function initInfoImageUpload() {
  imageUploadBox = document.getElementById('image-upload-1');
  imageInput = document.getElementById('image-input-1');
  imagePreview = document.getElementById('image-preview');
  const uploadBtn = document.querySelector('.image-upload-option-btn[data-option="upload"]');
  const libraryBtn = document.querySelector('.image-upload-option-btn[data-option="library"]');
  
  if (!imageUploadBox || !imageInput) return;
  
  // 点击"本地上传"按钮触发文件选择
  if (uploadBtn) {
    uploadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      imageInput.click();
    });
  }
  
  // 点击"从图库上传"按钮打开图片库选择
  if (libraryBtn) {
    libraryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openImageLibraryForSelect();
    });
  }
  
  // 点击上传框触发文件选择
  imageUploadBox.addEventListener('click', (e) => {
    if (e.target.closest('.image-upload-option-btn')) return;
    imageInput.click();
  });
  
  // 文件选择后预览
  imageInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (!files.length) return;
    
    for (let i = 0; i < Math.min(files.length, 3 - uploadedImages.length); i++) {
      const file = files[i];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        uploadedImages.push({
          file: file,
          dataUrl: event.target.result
        });
        renderImagePreview();
      };
      
      reader.readAsDataURL(file);
    }
  });
  
  // 重置图片
  window.resetUploadedImages = function() {
    uploadedImages = [];
    if (imagePreview) imagePreview.innerHTML = '';
    if (imageUploadBox) imageUploadBox.style.display = 'flex';
  };
  
  // 获取已上传图片
  window.getUploadedImages = function() {
    return uploadedImages;
  };
  
  // 添加图库图片
  window.addLibraryImage = function(imgUrl) {
    uploadedImages.push({ dataUrl: imgUrl, isLibrary: true });
    renderImagePreview();
  };
  
  // 监听图库选择事件
  document.addEventListener('librarySelected', renderImagePreview);
}

// ========== 联系方式管理 ==========
// 添加联系方式输入框
function addContactInput(type, value = '') {
  const container = document.getElementById(`${type}-inputs-container`);
  if (!container) return;
  
  const wrapper = document.createElement('div');
  wrapper.className = 'contact-input-wrapper';
  
  const input = document.createElement('input');
  input.type = type === 'phone' || type === 'landline' ? 'tel' : 'text';
  input.className = `contact-input ${type}-input`;
  input.name = `${type}[]`;
  input.placeholder = type === 'phone' ? '请输入电话号码' : 
                      type === 'wechat' ? '请输入微信号' : 
                      '请输入座机号码，如 010-12345678';
  input.autocomplete = type === 'phone' || type === 'landline' ? 'tel' : 'off';
  input.value = value;
  
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-remove-contact';
  removeBtn.textContent = '删除';
  removeBtn.onclick = function() {
    wrapper.remove();
    updateRemoveButtons();
  };
  
  wrapper.appendChild(input);
  wrapper.appendChild(removeBtn);
  container.appendChild(wrapper);
  
  updateRemoveButtons();
  input.focus();
}

// 更新删除按钮显示状态
function updateRemoveButtons() {
  ['phone', 'wechat', 'landline'].forEach(type => {
    const container = document.getElementById(`${type}-inputs-container`);
    if (!container) return;
    
    const wrappers = container.querySelectorAll('.contact-input-wrapper');
    wrappers.forEach((wrapper, index) => {
      const removeBtn = wrapper.querySelector('.btn-remove-contact');
      if (removeBtn) {
        // 只有一个输入框时隐藏删除按钮
        removeBtn.style.display = wrappers.length > 1 ? 'block' : 'none';
      }
    });
  });
}

// 初始化联系方式管理
function initContactManagement() {
  // 添加电话按钮
  const addPhoneBtn = document.getElementById('add-phone-btn');
  if (addPhoneBtn) {
    addPhoneBtn.addEventListener('click', () => {
      addContactInput('phone');
    });
  }
  
  // 添加微信按钮
  const addWechatBtn = document.getElementById('add-wechat-btn');
  if (addWechatBtn) {
    addWechatBtn.addEventListener('click', () => {
      addContactInput('wechat');
    });
  }
  
  // 添加座机按钮
  const addLandlineBtn = document.getElementById('add-landline-btn');
  if (addLandlineBtn) {
    addLandlineBtn.addEventListener('click', () => {
      addContactInput('landline');
    });
  }
  
  // 初始化删除按钮状态
  updateRemoveButtons();
}

// 重置联系方式输入框
function resetContactInputs() {
  ['phone', 'wechat', 'landline'].forEach(type => {
    const container = document.getElementById(`${type}-inputs-container`);
    if (container) {
      container.innerHTML = `
        <div class="contact-input-wrapper">
          <input type="${type === 'phone' || type === 'landline' ? 'tel' : 'text'}" 
                 class="contact-input ${type}-input" 
                 name="${type}[]" 
                 placeholder="${type === 'phone' ? '请输入电话号码' : type === 'wechat' ? '请输入微信号' : '请输入座机号码，如 010-12345678'}" 
                 autocomplete="${type === 'phone' || type === 'landline' ? 'tel' : 'off'}">
          <button type="button" class="btn-remove-contact" style="display: none;">删除</button>
        </div>
      `;
    }
  });
  updateRemoveButtons();
}

// 填充联系方式数据（用于编辑）
function fillContactInputs(contactData) {
  if (!contactData) return;
  
  let contact;
  try {
    // 尝试解析 JSON
    contact = typeof contactData === 'string' ? JSON.parse(contactData) : contactData;
  } catch (e) {
    // 如果是旧格式，转换为新格式
    contact = {
      phone: contactData ? [contactData] : [],
      wechat: [],
      landline: []
    };
  }
  
  // 重置输入框
  resetContactInputs();
  
  // 填充电话
  if (contact.phone && contact.phone.length > 0) {
    const phoneContainer = document.getElementById('phone-inputs-container');
    if (phoneContainer) {
      phoneContainer.innerHTML = '';
      contact.phone.forEach((phone, index) => {
        addContactInput('phone', phone);
      });
    }
  }
  
  // 填充微信
  if (contact.wechat && contact.wechat.length > 0) {
    const wechatContainer = document.getElementById('wechat-inputs-container');
    if (wechatContainer) {
      wechatContainer.innerHTML = '';
      contact.wechat.forEach((wechat, index) => {
        addContactInput('wechat', wechat);
      });
    }
  }
  
  // 填充座机
  if (contact.landline && contact.landline.length > 0) {
    const landlineContainer = document.getElementById('landline-inputs-container');
    if (landlineContainer) {
      landlineContainer.innerHTML = '';
      contact.landline.forEach((landline, index) => {
        addContactInput('landline', landline);
      });
    }
  }
  
  updateRemoveButtons();
}

// 渲染图片预览
function renderImagePreview() {
  if (!imagePreview) return;
  
  imagePreview.innerHTML = uploadedImages.map((img, index) => `
    <div class="preview-item">
      <img src="${img.dataUrl}" alt="预览图片">
      <button type="button" class="remove-image" data-index="${index}">&times;</button>
    </div>
  `).join('');
  
  // 绑定删除按钮
  imagePreview.querySelectorAll('.remove-image').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      uploadedImages.splice(index, 1);
      renderImagePreview();
    });
  });
  
  // 更新上传框状态
  if (imageUploadBox && uploadedImages.length >= 3) {
    imageUploadBox.style.display = 'none';
  } else if (imageUploadBox) {
    imageUploadBox.style.display = 'flex';
  }
}

// 检查登录状态：未登录显示全屏登录页，已登录显示后台
function checkLoginStatus() {
  const token = localStorage.getItem('token');
  const loginScreen = document.getElementById('login-page-screen');
  const backendLayout = document.getElementById('backend-layout');
  if (!token) {
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (backendLayout) backendLayout.classList.add('hidden');
    return false;
  }
  if (loginScreen) loginScreen.classList.add('hidden');
  if (backendLayout) backendLayout.classList.remove('hidden');
  return true;
}

// ========== 关于我们设置 ==========
async function loadAboutSettings() {
  // 检查登录状态
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('未登录，无法加载关于我们设置');
    return;
  }
  
  try {
    const response = await fetch('/api/about');
    if (response.ok) {
      const settings = await response.json();
      console.log('获取关于我们设置成功:', settings);
      
      // 填充表单数据
      settings.forEach(setting => {
        if (setting.type === 'usage') {
          document.getElementById('usage-title').value = setting.title;
          document.getElementById('usage-content').value = setting.content;
        } else if (setting.type === 'agreement') {
          document.getElementById('agreement-title').value = setting.title;
          document.getElementById('agreement-content').value = setting.content;
        } else if (setting.type === 'privacy') {
          document.getElementById('privacy-title').value = setting.title;
          document.getElementById('privacy-content').value = setting.content;
        }
      });
    } else {
      console.warn('获取关于我们设置失败');
    }
  } catch (error) {
    console.error('加载关于我们设置出错:', error);
  }
}

// 保存使用说明
async function saveUsageSetting() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('请先登录');
    return;
  }
  
  const title = document.getElementById('usage-title').value;
  const content = document.getElementById('usage-content').value;
  
  if (!title || !content) {
    alert('请填写完整的使用说明');
    return;
  }
  
  try {
    const response = await fetch('/api/about/usage', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, content })
    });
    
    if (response.ok) {
      alert('使用说明保存成功');
    } else {
      alert('保存失败，请重试');
    }
  } catch (error) {
    console.error('保存使用说明失败:', error);
    alert('保存失败，请重试');
  }
}

// 保存用户协议
async function saveAgreementSetting() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('请先登录');
    return;
  }
  
  const title = document.getElementById('agreement-title').value;
  const content = document.getElementById('agreement-content').value;
  
  if (!title || !content) {
    alert('请填写完整的用户协议');
    return;
  }
  
  try {
    const response = await fetch('/api/about/agreement', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, content })
    });
    
    if (response.ok) {
      alert('用户协议保存成功');
    } else {
      alert('保存失败，请重试');
    }
  } catch (error) {
    console.error('保存用户协议失败:', error);
    alert('保存失败，请重试');
  }
}

// 保存隐私政策
async function savePrivacySetting() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('请先登录');
    return;
  }
  
  const title = document.getElementById('privacy-title').value;
  const content = document.getElementById('privacy-content').value;
  
  if (!title || !content) {
    alert('请填写完整的隐私政策');
    return;
  }
  
  try {
    const response = await fetch('/api/about/privacy', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title, content })
    });
    
    if (response.ok) {
      alert('隐私政策保存成功');
    } else {
      alert('保存失败，请重试');
    }
  } catch (error) {
    console.error('保存隐私政策失败:', error);
    alert('保存失败，请重试');
  }
}

// ========== 抽奖活动管理 ==========
let currentLotteryId = null;
let prizeItemCounter = 0;
let loadedPrizeIds = []; // 编辑加载时记录的已有奖品ID，用于校验提交时是否丢失

// 加载抽奖活动列表
async function loadLotteryActivities() {
  // 检查登录状态
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('未登录，无法加载抽奖活动');
    const activitiesList = document.getElementById('lottery-activities-list');
    if (activitiesList) {
      activitiesList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">请先登录</p>';
    }
    return;
  }
  
  try {
    const response = await fetch('/api/lottery/activities', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (response.ok) {
      const activities = await response.json();
      console.log('获取抽奖活动成功:', activities);
      renderLotteryActivities(activities);
    } else {
      console.warn('获取抽奖活动失败');
      const activitiesList = document.getElementById('lottery-activities-list');
      if (activitiesList) {
        activitiesList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">加载活动失败</p>';
      }
    }
  } catch (error) {
    console.error('加载抽奖活动出错:', error);
    const activitiesList = document.getElementById('lottery-activities-list');
    if (activitiesList) {
      activitiesList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">加载活动出错</p>';
    }
  }
}

// 渲染抽奖活动列表
function renderLotteryActivities(activities) {
  const activitiesList = document.getElementById('lottery-activities-list');
  if (!activitiesList) return;
  
  if (!activities || activities.length === 0) {
    activitiesList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">暂无抽奖活动</p>';
    return;
  }
  
  activitiesList.innerHTML = '';
  
  activities.forEach(activity => {
    const card = document.createElement('div');
    card.className = 'lottery-activity-card';
    
    const statusClass = activity.status === 'active' ? 'active' : 'inactive';
    const statusText = activity.status === 'active' ? '启用' : '禁用';
    
    card.innerHTML = `
      <div class="lottery-activity-header">
        <h3 class="lottery-activity-title">${escapeHtml(activity.name)}</h3>
        <span class="lottery-activity-status ${statusClass}">${statusText}</span>
      </div>
      <div class="lottery-activity-info">
        <div class="lottery-activity-info-item">
          <div class="lottery-activity-info-label">开始时间</div>
          <div class="lottery-activity-info-value">${activity.start_time ? new Date(activity.start_time).toLocaleString() : '未设置'}</div>
        </div>
        <div class="lottery-activity-info-item">
          <div class="lottery-activity-info-label">结束时间</div>
          <div class="lottery-activity-info-value">${activity.end_time ? new Date(activity.end_time).toLocaleString() : '未设置'}</div>
        </div>
        <div class="lottery-activity-info-item">
          <div class="lottery-activity-info-label">每日次数</div>
          <div class="lottery-activity-info-value">${activity.daily_limit}次</div>
        </div>
        <div class="lottery-activity-info-item">
          <div class="lottery-activity-info-label">总次数</div>
          <div class="lottery-activity-info-value">${activity.total_limit}次</div>
        </div>
        <div class="lottery-activity-info-item">
          <div class="lottery-activity-info-label">中奖率</div>
          <div class="lottery-activity-info-value">${activity.win_rate !== null && activity.win_rate !== undefined ? activity.win_rate : 30}%</div>
        </div>
      </div>
      <div class="lottery-activity-actions">
        <button class="btn btn-secondary" onclick="editLotteryActivity(${activity.id})">编辑</button>
        <button class="btn btn-primary" onclick="viewLotteryStats(${activity.id})">查看统计</button>
        <button class="btn btn-danger" onclick="deleteLotteryActivity(${activity.id})">删除</button>
      </div>
    `;
    
    activitiesList.appendChild(card);
  });
}

// 打开创建/编辑抽奖活动模态框
function openLotteryModal(id = null) {
  currentLotteryId = id;
  const modal = document.getElementById('lottery-modal');
  const modalTitle = document.getElementById('lottery-modal-title');
  
  if (id) {
    modalTitle.textContent = '编辑抽奖活动';
    // 加载活动详情
    loadLotteryActivity(id);
  } else {
    modalTitle.textContent = '创建抽奖活动';
    // 重置表单
    document.getElementById('lottery-form').reset();
    document.getElementById('prizes-container').innerHTML = '';
    prizeItemCounter = 0;
    // 添加默认奖品
    addPrizeItem();
  }
  
  modal.style.display = 'block';
}

// 加载抽奖活动详情
async function loadLotteryActivity(id) {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const response = await fetch(`/api/lottery/activities/${id}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (response.ok) {
      const activity = await response.json();
      
      // 填充表单
      document.getElementById('lottery-name').value = activity.name;
      try {
        const st = activity.start_time;
        document.getElementById('lottery-start-time').value = st ? st.slice(0, 16).replace(' ', 'T') : '';
      } catch (e) {
        document.getElementById('lottery-start-time').value = activity.start_time || '';
      }
      try {
        const et = activity.end_time;
        document.getElementById('lottery-end-time').value = et ? et.slice(0, 16).replace(' ', 'T') : '';
      } catch (e) {
        document.getElementById('lottery-end-time').value = activity.end_time || '';
      }
      document.getElementById('lottery-daily-limit').value = activity.daily_limit;
      document.getElementById('lottery-total-limit').value = activity.total_limit;
      document.getElementById('lottery-win-rate').value = activity.win_rate !== null && activity.win_rate !== undefined ? activity.win_rate : 30;
      document.getElementById('lottery-status').value = activity.status;
      document.getElementById('lottery-prize-description').value = activity.prize_description || '';
      
      // 填充奖品
      const prizesContainer = document.getElementById('prizes-container');
      prizesContainer.innerHTML = '';
      loadedPrizeIds = []; // 重置
      
      if (activity.prizes && activity.prizes.length > 0) {
        activity.prizes.forEach(prize => {
          if (prize.id) loadedPrizeIds.push(Number(prize.id));
          try {
            addPrizeItem(prize);
          } catch (e) {
            console.error('[loadLotteryActivity] 添加奖品失败:', prize, e);
          }
        });
      } else {
        addPrizeItem();
      }
    } else {
      alert('加载活动详情失败，请重试');
      closeLotteryModal();
    }
  } catch (error) {
    console.error('加载活动详情失败:', error);
  }
}

// 添加奖品项
function addPrizeItem(prize = null) {
  const prizesContainer = document.getElementById('prizes-container');
  prizeItemCounter++;
  const prizeId = 'prize_' + prizeItemCounter;
  
  const prizeItem = document.createElement('div');
  prizeItem.className = 'prize-item';
  prizeItem.dataset.id = prizeId;
  if (prize?.id) prizeItem.dataset.prizeId = prize.id;
  prizeItem.dataset.thankYou = prize?.is_thank_you ? '1' : '0';
  prizeItem.dataset.needsShipping = prize?.is_thank_you ? '0' : (prize?.needs_shipping !== undefined ? (prize.needs_shipping ? '1' : '0') : '1');
  if (prize?.quantity !== undefined) prizeItem.dataset.remainingQuantity = prize.quantity;
  if (prize?.original_quantity !== undefined) prizeItem.dataset.originalQuantity = prize.original_quantity;
  
  const claimedCount = (prize?.original_quantity !== undefined && prize?.original_quantity !== null && prize?.quantity !== undefined) ? (prize.original_quantity - prize.quantity) : 0;
  const remainingCount = prize?.quantity !== undefined ? prize.quantity : (prize?.original_quantity || 1);
  const originalTotal = prize?.original_quantity || prize?.quantity || 1;
  const quantityHint = prize?.id ? `<span class="prize-quantity-hint" style="font-size:12px;color:#888;margin-top:2px;">已发放 ${Math.max(0, claimedCount)} / 当前剩余 ${remainingCount} / 原始总量 ${originalTotal}</span>` : '';
  
  prizeItem.innerHTML = `
    <div class="prize-header">
      <div class="prize-title">奖品 ${prizesContainer.children.length + 1}</div>
      <button type="button" class="remove-prize-btn" onclick="removePrizeItem('${prizeId}')">×</button>
    </div>
    <div class="prize-form-section">
      <div class="prize-form-row-2col">
        <div class="prize-form-group">
          <label for="prize-name-${prizeId}">奖品名称</label>
          <input type="text" id="prize-name-${prizeId}" name="prize_name" value="${escapeHtml(prize?.name || '')}" required>
        </div>
        <div class="prize-form-group">
          <label>排列顺序</label>
          <input type="text" value="第 ${prizesContainer.children.length + 1} 位（自动顺时针排列）" disabled style="background:#f5f5f5;color:#888;">
          <input type="hidden" id="prize-position-${prizeId}" name="prize_position" value="${prizesContainer.children.length + 1}">
        </div>
      </div>
      <div class="prize-form-row-2col">
        <div class="prize-form-group">
          <label for="prize-quantity-${prizeId}">总数量</label>
          <input type="number" id="prize-quantity-${prizeId}" name="prize_quantity" min="0" value="${prize?.id ? (prize.original_quantity || prize.quantity || 1) : 1}" required oninput="updateProbabilityHint()">
          ${quantityHint}
        </div>
        <div class="prize-form-group">
          <label for="prize-probability-${prizeId}">概率(%)</label>
          <input type="text" id="prize-probability-${prizeId}" name="prize_probability" readonly style="background:#f5f5f5;cursor:default;" value="自动计算">
          <small style="color:#888;font-size:11px;">按数量比例自动分配</small>
        </div>
      </div>
      <div class="prize-form-group">
        <label for="prize-image-${prizeId}">奖品图片</label>
        <div style="display: flex; gap: 10px; align-items: center;">
          <input type="text" id="prize-image-${prizeId}" name="prize_image" value="${escapeHtml(prize?.image || '')}" style="flex: 1;">
          <button type="button" class="btn btn-secondary" onclick="openImageLibraryForPrize('${prizeId}')">选择图片</button>
          <input type="file" id="prize-image-upload-${prizeId}" accept="image/*" style="display: none;">
          <button type="button" class="btn btn-primary" onclick="document.getElementById('prize-image-upload-${prizeId}').click()">上传图片</button>
        </div>
        ${prize?.image ? `<div class="prize-image-preview" style="margin-top: 10px;"><img src="${escapeHtml(prize.image)}" alt="奖品图片" style="max-width: 100px; max-height: 100px; border-radius: 4px;"></div>` : ''}
      </div>
      <div class="prize-form-row-2col" style="padding-top:8px;">
        <div class="prize-form-group" style="flex-direction:row;align-items:center;gap:8px;">
          <input type="checkbox" id="prize-thank-you-${prizeId}" ${prize?.is_thank_you ? 'checked' : ''} onchange="var item=this.closest('.prize-item');var shippingChk=document.getElementById('prize-needs-shipping-${prizeId}');if(this.checked){item.dataset.savedShipping=shippingChk.checked?'1':'0';item.dataset.needsShipping='0';shippingChk.checked=false;document.getElementById('prize-shipping-hint-${prizeId}').style.display='block';}else{item.dataset.needsShipping=item.dataset.savedShipping||'1';shippingChk.checked=item.dataset.savedShipping==='1';document.getElementById('prize-shipping-hint-${prizeId}').style.display='none';}item.dataset.thankYou=this.checked?'1':'0';">
          <label for="prize-thank-you-${prizeId}" style="margin:0;cursor:pointer;font-size:13px;">谢谢参与（非实体奖品）</label>
        </div>
        <div class="prize-form-group" style="flex-direction:row;align-items:center;gap:8px;">
          <input type="checkbox" id="prize-needs-shipping-${prizeId}" ${prize?.needs_shipping !== undefined ? (prize.needs_shipping ? 'checked' : '') : 'checked'} onchange="this.closest('.prize-item').dataset.needsShipping=this.checked?'1':'0'">
          <label for="prize-needs-shipping-${prizeId}" style="margin:0;cursor:pointer;font-size:13px;">需要发货</label>
        </div>
      </div>
      <div id="prize-shipping-hint-${prizeId}" class="prize-shipping-hint" style="display:${prize?.is_thank_you ? 'block' : 'none'};font-size:12px;color:#e65100;background:#fff3e0;padding:6px 10px;border-radius:4px;margin-top:4px;">💡 勾选"谢谢参与"后自动取消发货，因为非实体奖品无需物流</div>
    </div>
  `;
  
  // 绑定文件上传事件
  const fileInput = document.getElementById(`prize-image-upload-${prizeId}`);
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        uploadPrizeImage(file, prizeId);
      }
    });
  }
  
  prizesContainer.appendChild(prizeItem);
  updateProbabilityHint();
}

// 移除奖品项
function removePrizeItem(id) {
  const prizeItem = document.querySelector(`.prize-item[data-id="${id}"]`);
  if (!prizeItem) return;
  
  // 如果是有数据库ID的已有奖品（编辑模式下的删除），询问确认
  const hasDbId = prizeItem.dataset.prizeId && parseInt(prizeItem.dataset.prizeId) > 0;
  if (hasDbId) {
    if (!confirm('确定要删除这个奖品吗？删除后不可恢复！')) return;
  }
  
  prizeItem.remove();
  // 更新奖品序号
  updatePrizeNumbers();
}

// 打开图片库选择奖品图片
function openImageLibraryForPrize(prizeId) {
  const modal = document.getElementById('image-library-modal');
  const grid = document.getElementById('image-library-grid');
  const selectBtn = document.getElementById('image-library-select');
  const cancelBtn = document.getElementById('image-library-cancel');
  
  if (!modal || !grid) return;
  
  selectedLibraryImages = [];
  if (selectBtn) selectBtn.disabled = true;
  
  // 加载图片库
  fetch('/api/images/list')
    .then(res => res.json())
    .then(data => {
      const images = data.data || [];
      grid.innerHTML = images.map(img => {
        const url = img.url || `/uploads/${img.filename}`;
        return `<div class="image-library-item" data-url="${url}">
          <img src="${url}" alt="图片">
        </div>`;
      }).join('');
      
      if (images.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:#666;padding:20px;">图片库暂无图片</p>';
      }
      
      // 绑定点击选择
      grid.querySelectorAll('.image-library-item').forEach(item => {
        item.addEventListener('click', () => {
          const url = item.dataset.url;
          const index = selectedLibraryImages.indexOf(url);
          
          if (index > -1) {
            selectedLibraryImages.splice(index, 1);
            item.classList.remove('selected');
          } else {
            selectedLibraryImages = [url]; // 只允许选择一张图片
            // 移除其他选中状态
            grid.querySelectorAll('.image-library-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
          }
          
          if (selectBtn) selectBtn.disabled = selectedLibraryImages.length === 0;
        });
      });
    })
    .catch(err => {
      console.error('加载图片库失败:', err);
      grid.innerHTML = '<p>加载失败</p>';
    });
  
  // 确认选择
  if (selectBtn) {
    selectBtn.onclick = () => {
      if (selectedLibraryImages.length > 0) {
        const imageUrl = selectedLibraryImages[0];
        document.getElementById(`prize-image-${prizeId}`).value = imageUrl;
        
        // 更新图片预览
        const prizeItem = document.querySelector(`.prize-item[data-id="${prizeId}"]`);
        if (prizeItem) {
          let previewDiv = prizeItem.querySelector('.prize-image-preview');
          if (!previewDiv) {
            previewDiv = document.createElement('div');
            previewDiv.className = 'prize-image-preview';
            previewDiv.style.marginTop = '10px';
            prizeItem.querySelector('.prize-form-group').appendChild(previewDiv);
          }
          previewDiv.innerHTML = `<img src="${imageUrl}" alt="奖品图片" style="max-width: 100px; max-height: 100px; border-radius: 4px;">`;
        }
      }
      modal.style.display = 'none';
    };
  }
  
  // 取消
  if (cancelBtn) {
    cancelBtn.onclick = () => {
      modal.style.display = 'none';
    };
  }
  
  modal.style.display = 'block';
}

// 上传奖品图片
async function uploadPrizeImage(file, prizeId) {
  try {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch('/api/images/upload', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        document.getElementById(`prize-image-${prizeId}`).value = result.data.fullUrl;
        
        // 更新图片预览
        const prizeItem = document.querySelector(`.prize-item[data-id="${prizeId}"]`);
        if (prizeItem) {
          let previewDiv = prizeItem.querySelector('.prize-image-preview');
          if (!previewDiv) {
            previewDiv = document.createElement('div');
            previewDiv.className = 'prize-image-preview';
            previewDiv.style.marginTop = '10px';
            prizeItem.querySelector('.prize-form-group').appendChild(previewDiv);
          }
          previewDiv.innerHTML = `<img src="${result.data.fullUrl}" alt="奖品图片" style="max-width: 100px; max-height: 100px; border-radius: 4px;">`;
        }
      }
    }
  } catch (error) {
    console.error('上传奖品图片失败:', error);
  }
}

// 更新奖品序号
function updatePrizeNumbers() {
  const prizeItems = Array.from(document.querySelectorAll('.prize-item'));
  prizeItems.forEach((item, index) => {
    const title = item.querySelector('.prize-title');
    if (title) {
      title.textContent = `奖品 ${index + 1}`;
    }
    const id = item.dataset.id;
    const posInput = document.getElementById(`prize-position-${id}`);
    if (posInput) {
      posInput.value = `${index + 1}`;
    }
    // 同时更新排列顺序的展示文本
    const posDisplay = item.querySelector('input[disabled][style*="background:#f5f5f5"]');
    if (posDisplay) {
      posDisplay.value = `第 ${index + 1} 位（自动顺时针排列）`;
    }
  });
  updateProbabilityHint();
}

// 更新概率提示
function updateProbabilityHint() {
  const winRateInput = document.getElementById('lottery-win-rate')?.value;
  const winRate = (winRateInput !== undefined && winRateInput !== '' && !isNaN(parseFloat(winRateInput))) ? parseFloat(winRateInput) : 30;
  const prizeItems = Array.from(document.querySelectorAll('.prize-item'));
  let totalNormalQty = 0;
  const qtyMap = {};

  prizeItems.forEach(item => {
    const id = item.dataset.id;
    const isThankYou = item.dataset.thankYou === '1';
    if (!isThankYou) {
      const qtyInput = document.getElementById(`prize-quantity-${id}`);
      const qtyVal = parseInt(qtyInput?.value);
      const qty = (!isNaN(qtyVal) && qtyVal >= 0) ? qtyVal : 1;
      qtyMap[id] = qty;
      totalNormalQty += qty;
    }
  });

  const thankYouCount = prizeItems.filter(item => item.dataset.thankYou === '1').length;
  const normalTotal = Object.values(qtyMap).reduce((s, q) => s + (totalNormalQty > 0 ? (q / totalNormalQty) * winRate : 0), 0);
  const thankYouTotalProb = Math.max(0, 100 - normalTotal);
  const thankYouEachProb = thankYouCount > 0 ? thankYouTotalProb / thankYouCount : 0;

  prizeItems.forEach(item => {
    const id = item.dataset.id;
    const isThankYou = item.dataset.thankYou === '1';
    const probInput = document.getElementById(`prize-probability-${id}`);
    if (!probInput) return;

    if (isThankYou) {
      probInput.value = thankYouEachProb.toFixed(1) + '%';
    } else if (totalNormalQty > 0) {
      const prob = (qtyMap[id] / totalNormalQty) * winRate;
      probInput.value = prob.toFixed(1) + '%';
    } else {
      probInput.value = '0%';
    }
  });

  let hintEl = document.getElementById('probability-hint');
  if (!hintEl) {
    hintEl = document.createElement('div');
    hintEl.id = 'probability-hint';
    hintEl.style.cssText = 'padding: 10px 16px; margin: 8px 0; border-radius: 8px; font-size: 14px; text-align: center;';
    const container = document.getElementById('prizes-container');
    if (container) {
      container.parentNode.insertBefore(hintEl, container.nextSibling);
    }
  }
  const thankYouProb = Math.max(0, 100 - winRate);
  hintEl.style.background = '#f0f9ff';
  hintEl.style.color = '#1976d2';
  const thankYouHint = thankYouCount > 1 ? `各"谢谢参与"均分 ${thankYouTotalProb.toFixed(0)}%` : `"谢谢参与"概率 ${thankYouProb.toFixed(0)}%`;
  hintEl.textContent = `📊 总中奖率 ${winRate}% | ${thankYouHint} | 各奖品概率按初始数量比例分配，创建后固定不变`;
}

// 保存抽奖活动
async function saveLotteryActivity() {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('请先登录');
    return;
  }
  
  const form = document.getElementById('lottery-form');
  const name = document.getElementById('lottery-name').value.trim();
  const start_time_raw = document.getElementById('lottery-start-time').value;
  const end_time_raw = document.getElementById('lottery-end-time').value;
  const start_time = start_time_raw ? start_time_raw.replace('T', ' ') + ':00' : '';
  const end_time = end_time_raw ? end_time_raw.replace('T', ' ') + ':00' : '';
  const daily_limit = parseInt(document.getElementById('lottery-daily-limit').value);
  const total_limit = parseInt(document.getElementById('lottery-total-limit').value);
  const win_rate_input = document.getElementById('lottery-win-rate').value;
  const win_rate = win_rate_input !== '' ? parseFloat(win_rate_input) : 30;
  const status = document.getElementById('lottery-status').value;
  const prize_description = document.getElementById('lottery-prize-description').value;

  if (!name) {
    alert('活动名称不能为空！');
    return;
  }
  if (!start_time || !end_time) {
    alert('请设置活动的开始和结束时间！');
    return;
  }
  if (new Date(start_time) >= new Date(end_time)) {
    alert('结束时间必须晚于开始时间！');
    return;
  }
  if (isNaN(daily_limit) || daily_limit < 1) {
    alert('每日抽奖次数必须为正整数！');
    return;
  }
  if (isNaN(total_limit) || total_limit < 1) {
    alert('总抽奖次数必须为正整数！');
    return;
  }
  if (daily_limit > total_limit) {
    alert('每日抽奖次数不能大于总抽奖次数！');
    return;
  }
  
  // 收集奖品
  const prizes = [];
  const prizeItems = Array.from(document.querySelectorAll('.prize-item'));
  
  if (prizeItems.length === 0) {
    alert('请至少添加一个奖品！');
    return;
  }

  let hasPrizeError = false;
  prizeItems.forEach(item => {
    const id = item.dataset.id;
    const prizeDbId = item.dataset.prizeId ? parseInt(item.dataset.prizeId) : null;
    const prizeName = document.getElementById(`prize-name-${id}`).value.trim();
    const prizeImage = document.getElementById(`prize-image-${id}`).value;
    const prizeQuantity = parseInt(document.getElementById(`prize-quantity-${id}`).value);
    const prizePosition = document.getElementById(`prize-position-${id}`).value;
    const isThankYou = item.dataset.thankYou === '1' ? 1 : 0;
    const needsShipping = isThankYou ? 0 : (item.dataset.needsShipping === '1' ? 1 : 0);

    if (!prizeName) {
      alert('奖品名称不能为空！');
      hasPrizeError = true;
      return;
    }
    if (isNaN(prizeQuantity) || prizeQuantity < 0) {
      alert(`奖品"${prizeName || '未命名'}"的数量必须为非负整数！`);
      hasPrizeError = true;
      return;
    }
    
    const prizeData = {
      name: prizeName,
      image: prizeImage,
      quantity: prizeQuantity,
      position: prizePosition,
      is_thank_you: isThankYou,
      needs_shipping: needsShipping
    };
    if (prizeDbId) prizeData.id = prizeDbId;
    prizes.push(prizeData);
  });

  // 调试：打印收集到的奖品数据
  console.log('[saveLotteryActivity] 收集到的奖品:', prizes.map(p => ({ id: p.id, name: p.name, qty: p.quantity })));
  console.log('[saveLotteryActivity] loadedPrizeIds:', loadedPrizeIds);

  if (hasPrizeError) return;
  
  try {
    if (isNaN(win_rate) || win_rate < 0.01 || win_rate > 100) {
      alert('总中奖率必须在 0.01-100 之间！');
      return;
    }

    if (currentLotteryId) {
      // 校验：对比加载时的奖品ID和提交的奖品ID，防止意外丢失
      const submitPrizeIds = prizes.map(p => p.id).filter(Boolean).map(Number);
      const missingIds = loadedPrizeIds.filter(loadedId => !submitPrizeIds.includes(loadedId));
      if (missingIds.length > 0) {
        if (!confirm(`以下 ${missingIds.length} 个奖品将要从数据库删除（它们在表单中被移除了），确定继续吗？`)) {
          return;
        }
      }
      
      const quantityErrors = [];
      prizeItems.forEach(item => {
        const id = item.dataset.id;
        const prizeDbId = item.dataset.prizeId;
        if (prizeDbId) {
          const newTotal = parseInt(document.getElementById(`prize-quantity-${id}`).value);
          const remaining = parseInt(item.dataset.remainingQuantity || '0');
          const origTotal = parseInt(item.dataset.originalQuantity || '0');
          const claimed = Math.max(0, origTotal - remaining);
          if (newTotal < claimed) {
            const name = document.getElementById(`prize-name-${id}`).value;
            quantityErrors.push(`"${name}": 已发放 ${claimed} 个，总数量不能少于已发放数！`);
          }
        }
      });
      if (quantityErrors.length > 0) {
        alert('以下奖品数量设置有误：\n\n' + quantityErrors.join('\n\n'));
        return;
      }
    }

    const url = currentLotteryId ? `/api/lottery/activities/${currentLotteryId}` : '/api/lottery/activities';
    const method = currentLotteryId ? 'PUT' : 'POST';
    
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        name,
        start_time,
        end_time,
        daily_limit,
        total_limit,
        win_rate,
        status,
        prize_description,
        prizes
      })
    });
    
    if (response.ok) {
      const result = await response.json().catch(() => ({}));
      if (currentLotteryId && result.prizes && result.prizes.length > 0) {
        const prizeInfo = result.prizes.map(p => `${p.name}: 总${p.original_quantity} / 剩余${p.quantity}`).join('\n');
        alert('活动更新成功！\n\n奖品数量更新：\n' + prizeInfo);
      } else {
        alert(currentLotteryId ? '活动更新成功' : '活动创建成功');
      }
      closeLotteryModal();
      loadLotteryActivities();
    } else {
      let errMsg = '请重试';
      try {
        const errData = await response.json();
        errMsg = errData.error || errMsg;
      } catch (e) {
        try {
          errMsg = await response.text();
        } catch (e2) {}
      }
      console.error('[saveLotteryActivity] 保存失败:', response.status, errMsg);
      alert('保存失败：' + errMsg);
    }
  } catch (error) {
    console.error('保存活动失败:', error);
    alert('保存失败：' + error.message);
  }
}

// 关闭抽奖活动模态框
function closeLotteryModal() {
  const modal = document.getElementById('lottery-modal');
  modal.style.display = 'none';
  currentLotteryId = null;
  // 清空奖品容器和重置计数器，防止下次打开时残留旧数据
  const container = document.getElementById('prizes-container');
  if (container) container.innerHTML = '';
  prizeItemCounter = 0;
}

// 编辑抽奖活动
function editLotteryActivity(id) {
  openLotteryModal(id);
}

// 删除抽奖活动
async function deleteLotteryActivity(id) {
  const token = localStorage.getItem('token');
  if (!token) { alert('请先登录'); return; }
  if (!confirm('确定要删除此抽奖活动吗？删除后所有相关数据（抽奖记录、收货地址等）将无法恢复！\n\n注意：进行中的活动无法删除，请先设为禁用状态。')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/lottery/activities/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    if (response.ok) {
      alert('活动删除成功');
      loadLotteryActivities();
    } else {
      const data = await response.json().catch(() => ({}));
      alert(data.error || '删除失败，请重试');
    }
  } catch (error) {
    console.error('删除活动失败:', error);
    alert('删除失败，请重试');
  }
}

// ========== 收货地址管理 ==========
let currentShippingId = null;

async function loadShippingAddresses() {
  const token = localStorage.getItem('token');
  if (!token) return;
  await loadShippingActivityFilter();
  const activityId = document.getElementById('shipping-activity-filter').value;
  const statusFilter = document.getElementById('shipping-status-filter').value;

  try {
    let allAddresses = [];

    if (activityId) {
      const response = await fetch('/api/lottery/shipping-address?activity_id=' + activityId, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!response.ok) throw new Error('获取收货地址失败');
      const result = await response.json();
      allAddresses = result.data || [];
    } else {
      const select = document.getElementById('shipping-activity-filter');
      const options = Array.from(select.options).filter(o => o.value);
      if (options.length === 0) {
        const tbody = document.getElementById('shipping-list-body');
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:40px;color:#999;">暂无活动，无收货地址记录</td></tr>';
        return;
      }
      const results = await Promise.all(options.map(async opt => {
        try {
          const response = await fetch('/api/lottery/shipping-address?activity_id=' + opt.value, {
            headers: { 'Authorization': 'Bearer ' + token }
          });
          if (!response.ok) return [];
          const result = await response.json();
          return result.data || [];
        } catch (e) { return []; }
      }));
      allAddresses = results.flat();
    }

    if (statusFilter) {
      allAddresses = allAddresses.filter(a => a.shipping_status === statusFilter);
    }

    const tbody = document.getElementById('shipping-list-body');
    if (allAddresses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:40px;color:#999;">暂无收货地址记录</td></tr>';
      return;
    }

    tbody.innerHTML = allAddresses.map((a, idx) => {
      const statusMap = { pending: '待发货', shipped: '已发货', delivered: '已签收' };
      const statusClass = { pending: 'warning', shipped: 'info', delivered: 'success' };
      const statusText = statusMap[a.shipping_status] || a.shipping_status;
      const badgeClass = statusClass[a.shipping_status] || '';
      const fullAddress = `${a.province}${a.city}${a.district}${a.detail_address}`;
      const userName = a.nick_name || a.username || `用户${a.user_id}`;
      const prizeName = a.prize_name || '-';
      const trackingNumber = a.tracking_number || '-';
      const copyText = (a.name + ' ' + a.phone + ' ' + fullAddress).replace(/"/g, '&quot;');

      return `<tr>
        <td>${a.id}</td>
        <td>${a.activity_name || a.activity_id || '-'}</td>
        <td>${prizeName}</td>
        <td>${userName}</td>
        <td>${escapeHtml(a.name)}</td>
        <td>${a.phone}</td>
        <td style="max-width:200px;word-break:break-all;">${escapeHtml(fullAddress)} <button class="btn btn-sm" style="padding:1px 6px;font-size:11px;margin-left:4px;" data-copy-text="${copyText}" onclick="copyToClipboard(this.dataset.copyText)">复制</button></td>
        <td><span class="badge badge-${badgeClass}">${statusText}</span></td>
        <td>${a.courier_company ? a.courier_company + '<br>' : ''}${trackingNumber}</td>
        <td>${a.created_at ? new Date(a.created_at).toLocaleString('zh-CN') : '-'}</td>
        <td>
          <button class="btn btn-sm btn-primary" data-ship-id="${a.id}" data-ship-status="${a.shipping_status}" data-ship-tracking="${(a.tracking_number || '').replace(/"/g, '&quot;')}" data-ship-courier="${(a.courier_company || '').replace(/"/g, '&quot;')}" onclick="openShippingModal(Number(this.dataset.shipId), this.dataset.shipStatus, this.dataset.shipTracking, this.dataset.shipCourier)">更新</button>
        </td>
      </tr>`;
    }).join('');
  } catch (error) {
    console.error('加载收货地址失败:', error);
  }
}

async function loadShippingActivityFilter() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const response = await fetch('/api/lottery/activities', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!response.ok) return;
    const activities = await response.json();
    const select = document.getElementById('shipping-activity-filter');
    const currentVal = select.value;
    select.innerHTML = '<option value="">全部活动</option>';
    activities.forEach(a => {
      select.innerHTML += `<option value="${a.id}">${escapeHtml(a.name)}</option>`;
    });
    select.value = currentVal;
  } catch (e) {
    console.error('加载活动列表失败:', e);
  }
}

function openShippingModal(id, status, tracking, courierCompany) {
  currentShippingId = id;
  const statusSelect = document.getElementById('shipping-modal-status');
  statusSelect.innerHTML = '';
  if (status === 'pending') {
    statusSelect.innerHTML = '<option value="shipped">已发货</option>';
  } else if (status === 'shipped') {
    statusSelect.innerHTML = '<option value="shipped">已发货</option><option value="delivered">已签收</option>';
    statusSelect.value = 'delivered';
  } else {
    statusSelect.innerHTML = '<option value="delivered">已签收（已完成）</option>';
  }
  document.getElementById('shipping-modal-tracking').value = tracking || '';
  const courierSelect = document.getElementById('shipping-modal-courier');
  if (courierSelect) {
    courierSelect.value = courierCompany || '';
  }
  document.getElementById('shipping-modal').style.display = 'flex';
}

function closeShippingModal() {
  document.getElementById('shipping-modal').style.display = 'none';
  currentShippingId = null;
}

async function saveShippingStatus() {
  if (!currentShippingId) return;

  const token = localStorage.getItem('token');
  if (!token) { alert('请先登录'); return; }
  const shippingStatus = document.getElementById('shipping-modal-status').value;
  const trackingNumber = document.getElementById('shipping-modal-tracking').value;
  const courierCompany = document.getElementById('shipping-modal-courier')?.value || '';

  try {
    const response = await fetch(`/api/lottery/shipping-address/${currentShippingId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ shipping_status: shippingStatus, tracking_number: trackingNumber, courier_company: courierCompany })
    });

    if (response.ok) {
      alert('更新成功');
      closeShippingModal();
      loadShippingAddresses();
    } else {
      const result = await response.json();
      alert(result.error || '更新失败');
    }
  } catch (error) {
    console.error('更新发货状态失败:', error);
    alert('更新失败，请重试');
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const activityFilter = document.getElementById('shipping-activity-filter');
  const statusFilter = document.getElementById('shipping-status-filter');
  if (activityFilter) activityFilter.addEventListener('change', loadShippingAddresses);
  if (statusFilter) statusFilter.addEventListener('change', loadShippingAddresses);
});

// 查看活动统计
async function viewLotteryStats(id) {
  const token = localStorage.getItem('token');
  if (!token) { alert('请先登录'); return; }
  console.log('查看活动统计，活动ID:', id);
  try {
    const response = await fetch(`/api/lottery/stats/${id}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('API响应状态:', response.status);
    
    if (response.ok) {
      const stats = await response.json();
      console.log('API响应数据:', stats);
      
      // 填充统计数据
      document.getElementById('stats-participants').textContent = stats.participants;
      document.getElementById('stats-total-draws').textContent = stats.total_draws;
      document.getElementById('stats-winning-draws').textContent = stats.winning_draws;
      document.getElementById('stats-ad-watch-count').textContent = stats.ad_watch_count || 0;
      
      const statsWinRate = document.getElementById('stats-win-rate');
      if (statsWinRate) {
        const configured = stats.configured_win_rate || 0;
        const actual = stats.actual_win_rate || 0;
        const diff = Math.abs(actual - configured).toFixed(1);
        const color = diff <= 2 ? '#4caf50' : (diff <= 5 ? '#ff9800' : '#f44336');
        statsWinRate.innerHTML = `<span style="color:${color}">${actual}%</span> <span style="color:#999;font-size:12px">(配置${configured}%)</span>`;
      }

      const statsShipping = document.getElementById('stats-shipping');
      if (statsShipping && stats.shipping_progress) {
        const sp = stats.shipping_progress;
        statsShipping.textContent = sp.total_need_shipping > 0 ? `${sp.shipped}/${sp.total_need_shipping}` : '无需发货';
      }
      
      const prizesStatsBody = document.getElementById('prizes-stats-body');
      prizesStatsBody.innerHTML = '';
      
      if (stats.prizes && stats.prizes.length > 0) {
        stats.prizes.filter(p => !p.is_thank_you).forEach(prize => {
          const row = document.createElement('tr');
          const shippingInfo = prize.needs_shipping ? '' : ' <span style="color:#999;font-size:11px">(虚拟)</span>';
          row.innerHTML = `
            <td>${prize.name}${shippingInfo}</td>
            <td>${prize.original_quantity !== undefined && prize.original_quantity !== null ? prize.original_quantity : '-'}</td>
            <td>${prize.quantity}</td>
            <td>${prize.awarded_count}</td>
          `;
          prizesStatsBody.appendChild(row);
        });
      } else {
        prizesStatsBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #666;">暂无奖品数据</td></tr>';
      }
      
      // 保存活动ID，用于查看广告观看记录
      document.getElementById('view-ad-watch-records-btn').dataset.activityId = id;
      
      // 显示统计模态框
      document.getElementById('lottery-stats-modal').style.display = 'block';
    } else {
      const errorData = await response.json();
      console.error('API错误:', errorData);
      alert('获取统计数据失败: ' + (errorData.error || '未知错误'));
    }
  } catch (error) {
    console.error('获取活动统计失败:', error);
    alert('获取统计数据失败: ' + error.message);
  }
}

// 查看广告观看记录
async function viewAdWatchRecords(activityId) {
  const token = localStorage.getItem('token');
  if (!token) { alert('请先登录'); return; }
  try {
    const response = await fetch(`/api/lottery/ad-watch-records?activity_id=${activityId}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (response.ok) {
      const result = await response.json();
      const records = result.data || result;
      
      // 填充广告观看记录
      const adWatchRecordsBody = document.getElementById('ad-watch-records-body');
      adWatchRecordsBody.innerHTML = '';
      
      if (records && records.length > 0) {
        records.forEach(record => {
          const row = document.createElement('tr');
          const statusText = record.status === 'completed' ? '已完成' : '未完成';
          const statusClass = record.status === 'completed' ? 'status-completed' : 'status-incomplete';
          row.innerHTML = `
            <td>${record.user_id}</td>
            <td>${record.ad_id}</td>
            <td>${record.ad_duration}</td>
            <td>${record.watch_duration}</td>
            <td><span class="${statusClass}">${statusText}</span></td>
            <td>${new Date(record.watch_time).toLocaleString()}</td>
          `;
          adWatchRecordsBody.appendChild(row);
        });
      } else {
        adWatchRecordsBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">暂无广告观看记录</td></tr>';
      }
      
      // 显示广告观看记录模态框
      document.getElementById('ad-watch-records-modal').style.display = 'block';
    }
  } catch (error) {
    console.error('获取广告观看记录失败:', error);
    alert('获取广告观看记录失败');
  }
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', function() {
  console.log('页面加载完成，开始初始化...');
  
  // 检查登录状态
  checkLoginStatus();
  
  try {
    // 初始化图片预览模态框
    initImagePreviewModal();
    console.log('图片预览模态框初始化完成');
    
    // 初始化地区选择器
    initRegionSelectors();
    console.log('地区选择器初始化完成');
    
    // 初始化联系方式管理
    initContactManagement();
    console.log('联系方式管理初始化完成');
    
    // 加载分类统计数据
    loadCategoryStats();
    console.log('分类统计数据加载完成');
    
    // 加载分类选项到表单
  loadCategoryOptions();
  console.log('分类选项加载完成');
  
  // 关于我们设置页面按钮事件绑定
  const saveUsageBtn = document.getElementById('save-usage-btn');
  if (saveUsageBtn) {
    saveUsageBtn.addEventListener('click', saveUsageSetting);
    console.log('使用说明保存按钮事件绑定完成');
  }
  
  const saveAgreementBtn = document.getElementById('save-agreement-btn');
  if (saveAgreementBtn) {
    saveAgreementBtn.addEventListener('click', saveAgreementSetting);
    console.log('用户协议保存按钮事件绑定完成');
  }
  
  const savePrivacyBtn = document.getElementById('save-privacy-btn');
  if (savePrivacyBtn) {
    savePrivacyBtn.addEventListener('click', savePrivacySetting);
    console.log('隐私政策保存按钮事件绑定完成');
  }
  
  // 抽奖活动管理页面按钮事件绑定
  const addLotteryBtn = document.getElementById('add-lottery-btn');
  if (addLotteryBtn) {
    addLotteryBtn.addEventListener('click', () => openLotteryModal());
    console.log('创建抽奖活动按钮事件绑定完成');
  }
  
  const addPrizeBtn = document.getElementById('add-prize-btn');
  if (addPrizeBtn) {
    addPrizeBtn.addEventListener('click', addPrizeItem);
    console.log('添加奖品按钮事件绑定完成');
  }
  
  const lotteryForm = document.getElementById('lottery-form');
  if (lotteryForm) {
    lotteryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveLotteryActivity();
    });
    console.log('抽奖活动表单提交事件绑定完成');
  }
  
  const lotteryCancelBtn = document.getElementById('lottery-cancel-btn');
  if (lotteryCancelBtn) {
    lotteryCancelBtn.addEventListener('click', closeLotteryModal);
    console.log('抽奖活动取消按钮事件绑定完成');
  }
  
  // 查看广告观看记录按钮事件绑定
  const viewAdWatchRecordsBtn = document.getElementById('view-ad-watch-records-btn');
  if (viewAdWatchRecordsBtn) {
    viewAdWatchRecordsBtn.addEventListener('click', (e) => {
      const activityId = e.currentTarget.dataset.activityId;
      if (activityId) {
        viewAdWatchRecords(activityId);
      }
    });
    console.log('查看广告观看记录按钮事件绑定完成');
  }
  
  // 广告观看记录模态框关闭按钮事件绑定
  const adWatchRecordsModal = document.getElementById('ad-watch-records-modal');
  if (adWatchRecordsModal) {
    const closeBtn = adWatchRecordsModal.querySelector('.close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        adWatchRecordsModal.style.display = 'none';
      });
    }
    // 点击模态框外部关闭
    adWatchRecordsModal.addEventListener('click', (e) => {
      if (e.target === adWatchRecordsModal) {
        adWatchRecordsModal.style.display = 'none';
      }
    });
    console.log('广告观看记录模态框事件绑定完成');
  }
  
  // 侧边栏菜单点击事件
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPage = item.dataset.page;
        if (targetPage) {
          console.log('点击菜单:', targetPage);
          switchPage(targetPage);
        }
      });
    });
    console.log('侧边栏菜单事件绑定完成');
    
    // 关闭模态框按钮
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        const modal = e.currentTarget.closest('.modal');
        if (modal) {
          // 检查是否是登录模态框
          if (modal.id === 'login-modal') {
            // 检查用户是否已登录
            const token = localStorage.getItem('token');
            if (!token) {
              // 未登录，不允许关闭登录模态框
              alert('请先登录');
              return;
            }
          }
          modal.style.display = 'none';
        }
      });
    });
    console.log('模态框关闭按钮事件绑定完成');
    
    // 点击模态框外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          // 检查是否是登录模态框
          if (modal.id === 'login-modal') {
            // 检查用户是否已登录
            const token = localStorage.getItem('token');
            if (!token) {
              // 未登录，不允许关闭登录模态框
              alert('请先登录');
              return;
            }
          }
          modal.style.display = 'none';
        }
      });
    });
    console.log('模态框外部点击事件绑定完成');
    
    // 取消按钮
    const cancelBtn = document.getElementById('cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        closeModal('info-modal');
      });
      console.log('取消按钮事件绑定完成');
    } else {
      console.warn('取消按钮未找到');
    }
    
    // 增加信息按钮
    const addInfoBtn = document.getElementById('add-info-btn');
    if (addInfoBtn) {
      addInfoBtn.addEventListener('click', async () => {
        console.log('点击增加信息按钮');
        currentEditId = null;
        document.getElementById('modal-title').textContent = '增加信息';
        document.getElementById('info-form').reset();
        // 重置城市和区县选择器
        const citySelect = document.getElementById('city');
        const districtSelect = document.getElementById('district');
        if (citySelect) citySelect.innerHTML = '<option value="">请选择城市</option>';
        if (districtSelect) districtSelect.innerHTML = '<option value="">请选择区县</option>';
        // 重置图片
        if (window.resetUploadedImages) window.resetUploadedImages();
        // 重置联系方式
        if (window.resetContactInputs) window.resetContactInputs();
        // 加载分类选项
        await loadCategoryOptions();
        // 打开模态框
        openModal('info-modal');
      });
      console.log('增加信息按钮事件绑定完成');
    } else {
      console.warn('增加信息按钮未找到');
    }
    
    // 信息表单提交
    const infoForm = document.getElementById('info-form');
    if (infoForm) {
      infoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('提交信息表单');
        
        const formData = new FormData(infoForm);
        const data = Object.fromEntries(formData.entries());
        
        // 处理联系方式：收集所有电话、微信、座机
        const contactData = {
          phone: [],
          wechat: [],
          landline: []
        };
        
        // 收集电话号码
        const phoneInputs = document.querySelectorAll('.phone-input');
        phoneInputs.forEach(input => {
          const value = input.value.trim();
          if (value) {
            contactData.phone.push(value);
          }
        });
        
        // 收集微信号
        const wechatInputs = document.querySelectorAll('.wechat-input');
        wechatInputs.forEach(input => {
          const value = input.value.trim();
          if (value) {
            contactData.wechat.push(value);
          }
        });
        
        // 收集座机号码
        const landlineInputs = document.querySelectorAll('.landline-input');
        landlineInputs.forEach(input => {
          const value = input.value.trim();
          if (value) {
            contactData.landline.push(value);
          }
        });
        
        // 将联系方式转换为 JSON 字符串
        data.contact = JSON.stringify(contactData);
        
        // 处理图片上传
        const images = window.getUploadedImages ? window.getUploadedImages() : [];
        const imageUrls = [];
        
        for (const img of images) {
          if (img.isLibrary) {
            // 图库图片，直接使用URL
            imageUrls.push(img.dataUrl);
          } else if (img.file) {
            // 本地上传的图片，先上传到服务器
            const uploadData = new FormData();
            uploadData.append('image', img.file);
            try {
              const token = localStorage.getItem('token');
              const uploadRes = await fetch('/api/images/upload', {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer ' + token
                },
                body: uploadData
              });
              if (uploadRes.ok) {
                const result = await uploadRes.json();
                imageUrls.push(result.data.url);
              }
            } catch (err) {
              console.error('上传图片失败:', err);
            }
          }
        }
        
        // 添加图片URL到数据
        if (imageUrls.length > 0) {
          data.library_images = JSON.stringify(imageUrls);
        } else {
          // 确保即使没有图片也传递空数组
          data.library_images = JSON.stringify([]);
        }
        
        try {
          const token = localStorage.getItem('token');
          const url = currentEditId ? `/api/info/${currentEditId}` : '/api/info';
          const method = currentEditId ? 'PUT' : 'POST';
          
          const response = await fetch(url, {
            method: method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(data)
          });
          
          if (response.ok) {
            alert(currentEditId ? '更新成功' : '添加成功');
            closeModal('info-modal');
            if (window.resetUploadedImages) window.resetUploadedImages();
            loadInfoList();
            loadAllInfoCards();
          } else {
            const errorData = await response.json();
            console.error('操作失败:', errorData);
            alert('操作失败：' + (errorData.error || errorData.message || '未知错误'));
          }
        } catch (error) {
          console.error('保存信息失败:', error);
          alert('保存失败：' + error.message);
        }
      });
      console.log('信息表单提交事件绑定完成');
    } else {
      console.warn('信息表单未找到');
    }
    
    // 搜索功能
    const searchInfoBtn = document.getElementById('search-info-btn');
    if (searchInfoBtn) {
      searchInfoBtn.addEventListener('click', () => {
        console.log('点击搜索按钮');
        const searchInput = document.querySelector('#info-management .search-bar input');
        if (searchInput) {
          console.log('搜索关键词:', searchInput.value.trim());
          loadInfoList(searchInput.value.trim());
        }
      });
      console.log('搜索按钮事件绑定完成');
    } else {
      console.warn('搜索按钮未找到');
    }
    
    // 信息管理搜索框 Enter 键搜索
    const infoManagementSearchInput = document.querySelector('#info-management .search-bar input');
    if (infoManagementSearchInput) {
      infoManagementSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          console.log('信息管理搜索:', infoManagementSearchInput.value.trim());
          loadInfoList(infoManagementSearchInput.value.trim());
        }
      });
      console.log('信息管理搜索 Enter 键事件绑定完成');
    } else {
      console.warn('信息管理搜索输入框未找到');
    }
    
    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        console.log('点击清空按钮');
        const searchInput = document.querySelector('#info-management .search-bar input');
        if (searchInput) {
          searchInput.value = '';
        }
        loadInfoList();
      });
      console.log('清空按钮事件绑定完成');
    } else {
      console.warn('清空按钮未找到');
    }
    
    // 用户管理搜索 - Enter键
    const userSearchInput = document.getElementById('user-management-search');
    if (userSearchInput) {
      userSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          loadUserList(1);
        }
      });
      // 用户管理搜索 - 实时搜索（防抖）
      let userSearchTimer;
      userSearchInput.addEventListener('input', () => {
        clearTimeout(userSearchTimer);
        userSearchTimer = setTimeout(() => loadUserList(1), 300);
      });
      console.log('用户搜索事件绑定完成');
    } else {
      console.warn('用户搜索输入框未找到');
    }
    
    // 头像筛选下拉框
    const avatarFilter = document.getElementById('avatar-filter');
    if (avatarFilter) {
      avatarFilter.addEventListener('change', () => loadUserList(1));
      console.log('头像筛选事件绑定完成');
    } else {
      console.warn('头像筛选下拉框未找到');
    }
    
    // 来源筛选下拉框
    const sourceFilter = document.getElementById('source-filter');
    if (sourceFilter) {
      sourceFilter.addEventListener('change', () => loadUserList(1));
    }

    // 用户管理分页
    document.getElementById('user-prev-page')?.addEventListener('click', () => {
      if (userManagementPage > 1) loadUserList(userManagementPage - 1);
    });
    document.getElementById('user-next-page')?.addEventListener('click', () => {
      const totalPages = Math.ceil(userManagementTotal / userManagementPageSize);
      if (userManagementPage < totalPages) loadUserList(userManagementPage + 1);
    });
    document.getElementById('user-page-select')?.addEventListener('change', (e) => {
      const p = parseInt(e.target.value, 10);
      if (p >= 1) loadUserList(p);
    });
    
    // 所有信息搜索
    const allInfoSearchBtn = document.getElementById('all-info-search-btn');
    if (allInfoSearchBtn) {
      allInfoSearchBtn.addEventListener('click', () => {
        console.log('点击所有信息搜索按钮');
        const searchInput = document.querySelector('#all-info .search-bar input');
        if (searchInput) {
          console.log('搜索关键词:', searchInput.value.trim());
          loadAllInfoCards(searchInput.value.trim());
        }
      });
      console.log('所有信息搜索按钮事件绑定完成');
    } else {
      console.warn('所有信息搜索按钮未找到');
    }
    
    // 所有信息搜索框 Enter 键搜索
    const allInfoSearchInput = document.querySelector('#all-info .search-bar input');
    if (allInfoSearchInput) {
      allInfoSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          console.log('所有信息搜索:', allInfoSearchInput.value.trim());
          loadAllInfoCards(allInfoSearchInput.value.trim());
        }
      });
      console.log('所有信息搜索 Enter 键事件绑定完成');
    } else {
      console.warn('所有信息搜索输入框未找到');
    }
    
    const allInfoClearBtn = document.getElementById('all-info-clear-btn');
    if (allInfoClearBtn) {
      allInfoClearBtn.addEventListener('click', () => {
        console.log('点击所有信息清空按钮');
        const searchInput = document.querySelector('#all-info .search-bar input');
        if (searchInput) {
          searchInput.value = '';
        }
        loadAllInfoCards();
      });
      console.log('所有信息清空按钮事件绑定完成');
    } else {
      console.warn('所有信息清空按钮未找到');
    }
    
    // 返回按钮
    const backBtn = document.getElementById('back-to-all-info');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        console.log('点击返回按钮');
        // 返回时不重新加载数据，保持原有状态和滚动位置
        switchPage('all-info', true);
      });
      console.log('返回按钮事件绑定完成');
    } else {
      console.warn('返回按钮未找到');
    }
    
    // 新增分类按钮
    const addCategoryBtn = document.getElementById('add-category-btn');
    if (addCategoryBtn) {
      addCategoryBtn.addEventListener('click', () => {
        console.log('点击新增分类按钮');
        currentCategoryId = null;  // 重置为新增模式
        document.getElementById('category-modal-title').textContent = '新增分类';
        document.getElementById('category-form').reset();
        openModal('category-modal');
      });
      console.log('新增分类按钮事件绑定完成');
    } else {
      console.warn('新增分类按钮未找到');
    }
    
    // 分类模态框取消按钮
    const categoryCancelBtn = document.getElementById('category-cancel-btn');
    if (categoryCancelBtn) {
      categoryCancelBtn.addEventListener('click', () => {
        console.log('点击分类取消按钮');
        closeModal('category-modal');
      });
      console.log('分类取消按钮事件绑定完成');
    } else {
      console.warn('分类取消按钮未找到');
    }
    
    // 分类表单提交
    const categoryForm = document.getElementById('category-form');
    if (categoryForm) {
      categoryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('提交分类表单');
        const name = document.getElementById('category-name').value.trim();
        if (name) {
          console.log('分类名称:', name);
          saveCategory(name);
        } else {
          alert('请输入分类名称');
        }
      });
      console.log('分类表单提交事件绑定完成');
    } else {
      console.warn('分类表单未找到');
    }
    
    // 图片上传按钮
    const uploadImageBtn = document.getElementById('upload-image-btn');
    const imageUploadInput = document.getElementById('image-upload');
    if (uploadImageBtn && imageUploadInput) {
      uploadImageBtn.addEventListener('click', () => {
        console.log('点击上传图片按钮');
        imageUploadInput.click();
      });
      
      imageUploadInput.addEventListener('change', async (e) => {
        console.log('选择图片文件:', e.target.files.length);
        const files = e.target.files;
        if (files.length === 0) return;
        
        for (let i = 0; i < files.length; i++) {
          const formData = new FormData();
          formData.append('image', files[i]);
          
          try {
            const response = await fetch('/api/images/upload', {
              method: 'POST',
              body: formData
            });
            
            if (!response.ok) {
              alert(`上传 ${files[i].name} 失败`);
            }
          } catch (error) {
            console.error('上传图片失败:', error);
          }
        }
        
        alert('上传完成');
        loadImageLibrary();
        e.target.value = '';
      });
      console.log('图片上传按钮事件绑定完成');
    } else {
      console.warn('图片上传按钮或输入框未找到');
    }
    
    // 刷新图片库按钮
    const refreshImagesBtn = document.getElementById('refresh-images-btn');
    if (refreshImagesBtn) {
      refreshImagesBtn.addEventListener('click', loadImageLibrary);
      console.log('刷新图片库按钮事件绑定完成');
    } else {
      console.warn('刷新图片库按钮未找到');
    }
    
    // ========== 投稿审核 ==========
    const submissionStatusFilter = document.getElementById('submission-status-filter');
    if (submissionStatusFilter) {
      submissionStatusFilter.addEventListener('change', () => {
        submissionReviewPage = 1;
        loadSubmissionReview();
      });
    }
    const submissionRefreshBtn = document.getElementById('submission-refresh-btn');
    if (submissionRefreshBtn) {
      submissionRefreshBtn.addEventListener('click', loadSubmissionReview);
    }
    const submissionApproveBtn = document.getElementById('submission-approve-btn');
    if (submissionApproveBtn) {
      submissionApproveBtn.addEventListener('click', () => {
        if (currentReviewSubmissionId) approveSubmission(currentReviewSubmissionId);
      });
    }
    const submissionRejectBtn = document.getElementById('submission-reject-btn');
    if (submissionRejectBtn) {
      submissionRejectBtn.addEventListener('click', () => {
        if (currentReviewSubmissionId) showRejectForm(currentReviewSubmissionId);
      });
    }
    const submissionRejectConfirmBtn = document.getElementById('submission-reject-confirm-btn');
    if (submissionRejectConfirmBtn) {
      submissionRejectConfirmBtn.addEventListener('click', confirmRejectSubmission);
    }
    
    // ========== 信息管理批量删除功能 ==========
    // 全选checkbox
    const selectAllInfo = document.getElementById('select-all');
    if (selectAllInfo) {
      selectAllInfo.addEventListener('change', (e) => {
        console.log('点击全选checkbox:', e.target.checked);
        const checkboxes = document.querySelectorAll('#info-management tbody input[type="checkbox"]');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateBatchDeleteBtnState();
      });
      console.log('全选checkbox事件绑定完成');
    } else {
      console.warn('全选checkbox未找到');
    }
    
    // 监听表格内checkbox变化
    const infoTableBody = document.querySelector('#info-management tbody');
    if (infoTableBody) {
      infoTableBody.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
          console.log('表格checkbox变化:', e.target.checked);
          updateBatchDeleteBtnState();
          // 更新全选状态
          const allCheckboxes = document.querySelectorAll('#info-management tbody input[type="checkbox"]');
          const checkedCount = document.querySelectorAll('#info-management tbody input[type="checkbox"]:checked').length;
          if (selectAllInfo) {
            selectAllInfo.checked = allCheckboxes.length > 0 && checkedCount === allCheckboxes.length;
          }
        }
      });
      console.log('表格checkbox事件绑定完成');
    } else {
      console.warn('信息管理表格tbody未找到');
    }
    
    // 批量删除按钮
    const batchDeleteBtn = document.getElementById('batch-delete-btn');
    if (batchDeleteBtn) {
      batchDeleteBtn.addEventListener('click', batchDeleteInfo);
      console.log('批量删除按钮事件绑定完成');
    } else {
      console.warn('批量删除按钮未找到');
    }
    
    // ========== 图片库批量删除功能 ==========
    // 全选checkbox
    const selectAllImages = document.getElementById('select-all-images');
    if (selectAllImages) {
      selectAllImages.addEventListener('change', (e) => {
        console.log('点击图片库全选checkbox:', e.target.checked);
        const checkboxes = document.querySelectorAll('#image-list .image-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
        updateBatchDeleteImagesBtnState();
      });
      console.log('图片库全选checkbox事件绑定完成');
    } else {
      console.warn('图片库全选checkbox未找到');
    }
    
    // 监听图片列表内checkbox变化
    const imageList = document.getElementById('image-list');
    if (imageList) {
      imageList.addEventListener('change', (e) => {
        if (e.target.classList.contains('image-checkbox')) {
          console.log('图片库checkbox变化:', e.target.checked);
          updateBatchDeleteImagesBtnState();
          // 更新全选状态
          const allCheckboxes = document.querySelectorAll('#image-list .image-checkbox');
          const checkedCount = document.querySelectorAll('#image-list .image-checkbox:checked').length;
          if (selectAllImages) {
            selectAllImages.checked = allCheckboxes.length > 0 && checkedCount === allCheckboxes.length;
          }
        }
      });
      console.log('图片库checkbox事件绑定完成');
    } else {
      console.warn('图片列表未找到');
    }
    
    // 图片批量删除按钮
    const batchDeleteImagesBtn = document.getElementById('batch-delete-images-btn');
    if (batchDeleteImagesBtn) {
      batchDeleteImagesBtn.addEventListener('click', batchDeleteImages);
      console.log('图片批量删除按钮事件绑定完成');
    } else {
      console.warn('图片批量删除按钮未找到');
    }
    
    // 加载初始页面数据（已登录则加载，未登录则跳过）
    loadPageData('dashboard');
    console.log('初始页面数据加载完成');
    
    // 信息表单图片上传功能
    initInfoImageUpload();
    console.log('信息表单图片上传功能初始化完成');
    
    // 登录表单提交事件
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('提交登录表单');
        
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const errorElement = document.getElementById('login-error');
        
        if (!username || !password) {
          if (errorElement) {
            errorElement.textContent = '用户名和密码不能为空';
            errorElement.style.display = 'block';
          }
          return;
        }
        
        try {
          console.log('发送登录请求:', { username });
          const response = await fetch('/api/user/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
          });
          console.log('登录请求响应状态:', response.status);
          console.log('登录请求响应URL:', response.url);
          
          const result = await response.json();
          
          if (response.ok) {
            console.log('登录成功:', result);
            if (errorElement) {
              errorElement.style.display = 'none';
            }
            
            // 保存登录状态
            localStorage.setItem('user', JSON.stringify(result.user));
            localStorage.setItem('token', result.token);
            
            // 更新欢迎信息
            const welcomeText = document.getElementById('welcome-text');
            if (welcomeText && result.user) {
              welcomeText.value = `欢迎，${result.user.username}`;
            }
            
            // 隐藏登录页，显示后台，加载数据
            checkLoginStatus();
            loadPageData(currentPage || 'dashboard');
          } else {
            console.error('登录失败:', result);
            if (errorElement) {
              errorElement.textContent = result.error || '登录失败';
              errorElement.style.display = 'block';
            }
          }
        } catch (error) {
          console.error('登录请求失败:', error);
          if (errorElement) {
            errorElement.textContent = '网络错误，请稍后重试';
            errorElement.style.display = 'block';
          }
        }
      });
      console.log('登录表单提交事件绑定完成');
    } else {
      console.warn('登录表单未找到');
    }
    
    // 刷新当前页按钮
    const refreshBtn = document.getElementById('refresh-page-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        loadPageData();
        refreshBtn.textContent = '✓';
        setTimeout(() => { refreshBtn.textContent = '🔄'; }, 800);
      });
    }
    // 退出登录按钮
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        console.log('点击退出登录按钮');
        try { fetch('/api/user/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } }); } catch (e) {}
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        const welcomeText = document.getElementById('welcome-text');
        if (welcomeText) welcomeText.value = '请登录';
        checkLoginStatus();
      });
      console.log('退出登录按钮事件绑定完成');
    } else {
      console.warn('退出登录按钮未找到');
    }
    
    console.log('初始化完成');
    
    // 检查登录状态
    const user = localStorage.getItem('user');
    if (user) {
      const parsedUser = JSON.parse(user);
      const welcomeText = document.getElementById('welcome-text');
      if (welcomeText) {
        welcomeText.value = `欢迎，${parsedUser.username}`;
      }
    }
    console.log('登录状态检查完成');
    
    // 站内信管理功能初始化
    initMessagesManagement();
    console.log('站内信管理初始化完成');
  } catch (error) {
    console.error('初始化过程中出错:', error);
    alert('页面初始化失败，请刷新页面重试');
  }

});

// ========== 站内信管理功能 ==========
let currentMessageType = 'all';

// 初始化站内信管理
function initMessagesManagement() {
  // 发送消息按钮
  const sendMessageBtn = document.getElementById('send-message-btn');
  if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', openSendMessageModal);
  }

  // 发送消息表单
  const sendMessageForm = document.getElementById('send-message-form');
  if (sendMessageForm) {
    sendMessageForm.addEventListener('submit', handleSendMessage);
  }

  // 发送消息取消按钮
  const sendMessageCancelBtn = document.getElementById('send-message-cancel-btn');
  if (sendMessageCancelBtn) {
    sendMessageCancelBtn.addEventListener('click', closeSendMessageModal);
  }

  // 消息类型选择
  const messageTypeSelect = document.getElementById('message-type');
  if (messageTypeSelect) {
    messageTypeSelect.addEventListener('change', handleMessageTypeChange);
  }

  // 消息标签页
  const messageTabs = document.querySelectorAll('.message-tab');
  messageTabs.forEach(tab => {
    tab.addEventListener('click', handleMessageTabClick);
  });
}

// 处理消息标签页点击
function handleMessageTabClick(e) {
  const type = e.target.dataset.type;
  currentMessageType = type;

  // 更新标签页样式
  document.querySelectorAll('.message-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  e.target.classList.add('active');

  // 加载消息列表
  loadMessagesList();
}

// 处理消息类型变化
function handleMessageTypeChange(e) {
  const type = e.target.value;
  const recipientGroup = document.getElementById('recipient-group');
  if (type === 'personal') {
    recipientGroup.style.display = 'block';
  } else {
    recipientGroup.style.display = 'none';
  }
}

// 打开发送消息模态框
function openSendMessageModal() {
  document.getElementById('send-message-form').reset();
  document.getElementById('recipient-group').style.display = 'none';
  document.getElementById('send-message-modal').style.display = 'block';
}

// 关闭发送消息模态框
function closeSendMessageModal() {
  document.getElementById('send-message-modal').style.display = 'none';
}

// 处理发送消息
async function handleSendMessage(e) {
  e.preventDefault();
  
  const type = document.getElementById('message-type').value;
  const title = document.getElementById('message-title').value.trim();
  const content = document.getElementById('message-content').value.trim();
  
  const data = { type, title, content };
  
  if (type === 'personal') {
    const recipientAccount = document.getElementById('recipient-account').value.trim();
    if (!recipientAccount) {
      alert('请输入接收用户账号');
      return;
    }
    data.recipient_account = recipientAccount;
  }
  
  try {
    const response = await fetch('/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      alert('消息发送成功');
      closeSendMessageModal();
      loadMessagesList();
    } else {
      const errorData = await response.json();
      alert('消息发送失败: ' + (errorData.error || '未知错误'));
    }
  } catch (error) {
    console.error('发送消息失败:', error);
    alert('发送消息失败');
  }
}

// 加载消息列表
async function loadMessagesList() {
  try {
    let url = '/api/messages';
    if (currentMessageType !== 'all') {
      url += `?type=${currentMessageType}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (response.ok) {
      const messages = await response.json();
      renderMessagesList(messages);
    }
  } catch (error) {
    console.error('加载消息列表失败:', error);
  }
}

// 渲染消息列表
function renderMessagesList(messages) {
  const tbody = document.getElementById('messages-list-body');
  tbody.innerHTML = '';
  
  if (messages && messages.length > 0) {
    messages.forEach(msg => {
      const row = document.createElement('tr');
      const typeText = msg.type === 'broadcast' ? '广播' : '个人';
      const typeClass = msg.type === 'broadcast' ? 'type-broadcast' : 'type-personal';
      const recipientText = msg.type === 'broadcast' ? '所有用户' : (msg.receiver_username || '-');
      
      row.innerHTML = `
        <td>${msg.id}</td>
        <td><span class="${typeClass}">${typeText}</span></td>
        <td>${msg.title}</td>
        <td>${recipientText}</td>
        <td>${new Date(msg.created_at).toLocaleString()}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="deleteMessage(${msg.id})">删除</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">暂无消息</td></tr>';
  }
}

// 删除消息
async function deleteMessage(id) {
  if (!confirm('确定要删除这条消息吗？')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/messages/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (response.ok) {
      alert('删除成功');
      loadMessagesList();
    } else {
      alert('删除失败');
    }
  } catch (error) {
    console.error('删除消息失败:', error);
    alert('删除失败');
  }
}

// ========== 客服管理 ==========
let csCurrentChatUserId = null;
let csAutoReplyEditId = null;
let csChatPollingInterval = null;
let csChatsPollingInterval = null;

function loadCustomerService() {
  document.querySelectorAll('.cs-tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.cs-tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.cs-panel').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const tab = t.getAttribute('data-tab');
      if (tab === 'chats') {
        document.getElementById('cs-chats-panel').classList.add('active');
        startCsChatsPolling();
      } else {
        document.getElementById('cs-auto-replies-panel').classList.add('active');
        stopCsChatPolling();
        stopCsChatsPolling();
        loadCsAutoReplies();
      }
    });
  });
  document.getElementById('cs-add-auto-reply-btn')?.addEventListener('click', () => openCsAutoReplyModal());
  document.getElementById('cs-send-reply-btn')?.addEventListener('click', sendCsReply);
  document.getElementById('cs-clear-chat-btn')?.addEventListener('click', clearCsChat);
  document.getElementById('cs-auto-reply-form')?.addEventListener('submit', saveCsAutoReply);
  document.querySelector('.cs-ar-cancel')?.addEventListener('click', () => closeModal('cs-auto-reply-modal'));
  loadCsChats();
  loadCsAutoReplies();
}

async function loadCsChats() {
  const tbody = document.getElementById('cs-chats-body');
  if (!tbody) return;
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch('/api/customer-service/admin/chats', { headers: { 'Authorization': 'Bearer ' + token } });
    const json = await res.json();
    if (json.code !== 200) {
      tbody.innerHTML = '<tr><td colspan="4">加载失败</td></tr>';
      return;
    }
    const chats = json.data?.chats || [];
    if (chats.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#666">暂无客服会话</td></tr>';
      return;
    }
    tbody.innerHTML = chats.map(c => `
      <tr>
        <td>${c.nick_name || c.username || c.phone || c.email || '用户' + c.user_id}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${(c.last_message || '').slice(0, 50)}${(c.last_message || '').length > 50 ? '...' : ''}</td>
        <td>${c.last_at ? new Date(c.last_at).toLocaleString() : '-'}</td>
        <td><button class="btn btn-sm btn-primary cs-view-chat" data-id="${c.user_id}">查看回复</button></td>
      </tr>
    `).join('');
    document.querySelectorAll('.cs-view-chat').forEach(btn => {
      btn.addEventListener('click', () => openCsChatModal(btn.getAttribute('data-id')));
    });
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="4">加载失败</td></tr>';
  }
}

async function openCsChatModal(userId) {
  csCurrentChatUserId = userId;
  const token = localStorage.getItem('token');
  if (!token) return;
  document.getElementById('cs-chat-modal-title').textContent = '与用户 ' + userId + ' 对话';
  document.getElementById('cs-chat-modal').style.display = 'block';
  document.getElementById('cs-reply-content').value = '';
  startCsChatPolling(userId);
}

function startCsChatPolling(userId) {
  stopCsChatPolling();
  const token = localStorage.getItem('token');
  if (!token) return;
  
  csChatPollingInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/customer-service/admin/chats/${userId}/messages`, { headers: { 'Authorization': 'Bearer ' + token } });
      const json = await res.json();
      const messages = json.data?.messages || [];
      const container = document.getElementById('cs-chat-messages');
      
      const newHtml = messages.map(m => {
        const isUser = m.sender_type === 'user';
        return `<div class="${isUser ? 'cs-msg-user' : 'cs-msg-admin'}" style="margin:6px 0;padding:8px;background:${isUser ? '#e3f2fd' : '#f5f5f5'};border-radius:8px;text-align:${isUser ? 'right' : 'left'}">
          <span style="font-size:12px;color:#666">${isUser ? '用户' : (m.is_auto_reply ? '自动回复' : '客服')} · ${new Date(m.created_at).toLocaleString()}</span><br>
          ${m.content}
        </div>`;
      }).join('');
      
      if (container.innerHTML !== newHtml) {
        container.innerHTML = newHtml;
        container.scrollTop = container.scrollHeight;
      }
    } catch (e) {
      console.error('轮询客服消息失败:', e);
    }
  }, 2000);
}

function stopCsChatPolling() {
  if (csChatPollingInterval) {
    clearInterval(csChatPollingInterval);
    csChatPollingInterval = null;
  }
}

function startCsChatsPolling() {
  stopCsChatsPolling();
  loadCsChats();
  csChatsPollingInterval = setInterval(() => {
    loadCsChats();
  }, 5000);
}

function stopCsChatsPolling() {
  if (csChatsPollingInterval) {
    clearInterval(csChatsPollingInterval);
    csChatsPollingInterval = null;
  }
}

async function sendCsReply() {
  if (!csCurrentChatUserId) return;
  const content = document.getElementById('cs-reply-content').value.trim();
  if (!content) {
    alert('请输入回复内容');
    return;
  }
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/customer-service/admin/chats/${csCurrentChatUserId}/reply`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const json = await res.json();
    if (json.code === 200) {
      document.getElementById('cs-reply-content').value = '';
      openCsChatModal(csCurrentChatUserId);
    } else {
      alert(json.message || '发送失败');
    }
  } catch (e) {
    alert('发送失败');
  }
}

async function clearCsChat() {
  if (!csCurrentChatUserId) return;
  if (!confirm('确定清空该用户的聊天记录？此操作不可恢复。')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/customer-service/admin/chats/${csCurrentChatUserId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const json = await res.json();
    if (json.code === 200) {
      document.getElementById('cs-chat-modal').style.display = 'none';
      stopCsChatPolling();
      loadCsChats();
    } else {
      alert(json.message || '清空失败');
    }
  } catch (e) {
    alert('清空失败');
  }
}

async function loadCsAutoReplies() {
  const tbody = document.getElementById('cs-auto-replies-body');
  if (!tbody) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch('/api/customer-service/admin/auto-replies', { headers: { 'Authorization': 'Bearer ' + token } });
    const json = await res.json();
    if (json.code !== 200) {
      tbody.innerHTML = '<tr><td colspan="5">加载失败</td></tr>';
      return;
    }
    const list = json.data?.list || [];
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#666">暂无自动回复规则</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(r => `
      <tr>
        <td>${r.keyword}</td>
        <td>${(r.question_text || r.keyword || '').slice(0, 20)}</td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis" title="${(r.reply_content || '').replace(/"/g,'&quot;')}">${(r.reply_content || '').slice(0, 30)}${(r.reply_content || '').length > 30 ? '...' : ''}</td>
        <td>${r.is_active ? '启用' : '禁用'}</td>
        <td>${(r.show_in_quick_questions !== 0 && r.show_in_quick_questions !== false) ? '是' : '否'}</td>
        <td>${r.sort_order}</td>
        <td>
          <button class="btn btn-sm btn-primary cs-edit-ar" data-id="${r.id}">编辑</button>
          <button class="btn btn-sm btn-danger cs-del-ar" data-id="${r.id}">删除</button>
        </td>
      </tr>
    `).join('');
    document.querySelectorAll('.cs-edit-ar').forEach(btn => {
      btn.addEventListener('click', () => openCsAutoReplyModal(btn.getAttribute('data-id')));
    });
    document.querySelectorAll('.cs-del-ar').forEach(btn => {
      btn.addEventListener('click', () => deleteCsAutoReply(btn.getAttribute('data-id')));
    });
    } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7">加载失败</td></tr>';
  }
}

async function openCsAutoReplyModal(id) {
  csAutoReplyEditId = id || null;
  document.getElementById('cs-auto-reply-modal-title').textContent = id ? '编辑自动回复' : '添加自动回复';
  document.getElementById('cs-ar-id').value = id || '';
  document.getElementById('cs-auto-reply-form').reset();
  document.getElementById('cs-ar-active').checked = true;
  document.getElementById('cs-ar-show-quick').checked = true;
  document.getElementById('cs-ar-sort').value = '0';
  if (id) {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/customer-service/admin/auto-replies', { headers: { 'Authorization': 'Bearer ' + token } });
      const json = await res.json();
      const list = json.data?.list || [];
      const r = list.find(x => x.id == id);
      if (r) {
        document.getElementById('cs-ar-keyword').value = r.keyword || '';
        document.getElementById('cs-ar-question-text').value = r.question_text || '';
        document.getElementById('cs-ar-reply').value = r.reply_content || '';
        document.getElementById('cs-ar-active').checked = !!r.is_active;
        document.getElementById('cs-ar-show-quick').checked = (r.show_in_quick_questions !== 0 && r.show_in_quick_questions !== false);
        document.getElementById('cs-ar-sort').value = r.sort_order || 0;
      }
    } catch (e) {}
  }
  document.getElementById('cs-auto-reply-modal').style.display = 'block';
}

async function saveCsAutoReply(e) {
  e.preventDefault();
  const id = csAutoReplyEditId;
  const keyword = document.getElementById('cs-ar-keyword').value.trim();
  const question_text = document.getElementById('cs-ar-question-text')?.value?.trim() || '';
  const reply_content = document.getElementById('cs-ar-reply').value.trim();
  const is_active = document.getElementById('cs-ar-active').checked ? 1 : 0;
  const show_in_quick_questions = document.getElementById('cs-ar-show-quick')?.checked ? 1 : 0;
  const sort_order = parseInt(document.getElementById('cs-ar-sort').value) || 0;
  const token = localStorage.getItem('token');
  try {
    const url = id ? `/api/customer-service/admin/auto-replies/${id}` : '/api/customer-service/admin/auto-replies';
    const method = id ? 'PUT' : 'POST';
    const body = { keyword, question_text, reply_content, is_active, show_in_quick_questions, sort_order };
    const res = await fetch(url, {
      method,
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (json.code === 200) {
      closeModal('cs-auto-reply-modal');
      loadCsAutoReplies();
    } else {
      alert(json.message || '保存失败');
    }
  } catch (e) {
    alert('保存失败');
  }
}

async function deleteCsAutoReply(id) {
  if (!confirm('确定删除此自动回复？')) return;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`/api/customer-service/admin/auto-replies/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const json = await res.json();
    if (json.code === 200) {
      loadCsAutoReplies();
    } else {
      alert(json.message || '删除失败');
    }
  } catch (e) {
    alert('删除失败');
  }
}

// 客服聊天模态框关闭与发送
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.querySelector('#cs-chat-modal .close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('cs-chat-modal').style.display = 'none';
      stopCsChatPolling();
      csCurrentChatUserId = null;
    });
  }
  window.addEventListener('click', (event) => {
    const modal = document.getElementById('cs-chat-modal');
    if (event.target === modal) {
      modal.style.display = 'none';
      stopCsChatPolling();
      csCurrentChatUserId = null;
    }
  });
});

// 切换回当前标签页时自动刷新数据
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState !== 'visible') return;
  const token = localStorage.getItem('token');
  if (!token) return;
  loadPageData();
});

// ========== APP 版本管理 ==========
async function loadAppVersionList() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const response = await fetch('/api/app-version/list', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const result = await response.json();
    if (result.code === 200 && result.data) {
      renderAppVersionList(result.data);
    }
  } catch (error) {
    console.error('加载版本列表失败:', error);
  }
}

function renderAppVersionList(versions) {
  const tbody = document.getElementById('app-version-list');
  if (!tbody) return;

  if (versions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:#999;">暂无版本记录</td></tr>';
    return;
  }

  tbody.innerHTML = versions.map(v => `
    <tr>
      <td>${v.id}</td>
      <td>${v.version_code}</td>
      <td>${v.version_name}</td>
      <td><a href="${v.download_url}" target="_blank" style="color:#07c160;word-break:break-all;">下载</a></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(v.update_description || '').replace(/"/g, '&quot;')}">${v.update_description || '-'}</td>
      <td>${v.force_update === 1 ? '<span style="color:#fa5151;">是</span>' : '否'}</td>
      <td>${v.is_active === 1 ? '<span style="color:#07c160;font-weight:bold;">是</span>' : '否'}</td>
      <td>${v.file_size ? (v.file_size / 1024 / 1024).toFixed(2) + ' MB' : '-'}</td>
      <td>${new Date(v.created_at).toLocaleString()}</td>
      <td>
        ${v.is_active !== 1 ? `<button class="btn btn-primary btn-sm" onclick="activateAppVersion(${v.id})">激活</button> ` : ''}
        <button class="btn btn-secondary btn-sm" onclick="deleteAppVersion(${v.id})">删除</button>
      </td>
    </tr>
  `).join('');
}

async function activateAppVersion(id) {
  if (!confirm('确定要激活此版本吗？')) return;

  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`/api/app-version/${id}/activate`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const result = await response.json();
    if (result.code === 200) {
      alert('激活成功！');
      loadAppVersionList();
    } else {
      alert(result.message || '激活失败');
    }
  } catch (error) {
    alert('激活失败');
  }
}

async function deleteAppVersion(id) {
  if (!confirm('确定要删除此版本吗？')) return;

  const token = localStorage.getItem('token');
  try {
    const response = await fetch('/api/app-version/' + id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const result = await response.json();
    if (result.code === 200) {
      alert('删除成功');
      loadAppVersionList();
    } else {
      alert(result.message || '删除失败');
    }
  } catch (error) {
    alert('删除失败');
  }
}

// 全局变量存储已上传的 APK 信息
let uploadedApkInfo = null;

// 发布新版本功能（模态框）
function showPublishVersionModal() {
  const modal = document.getElementById('publish-version-modal');
  if (modal) {
    modal.style.display = 'block';
  }
}

// 上传 APK 文件
async function uploadApkNow() {
  const fileInput = document.getElementById('apk-upload-file');
  const file = fileInput.files[0];
  if (!file) {
    alert('请选择文件');
    return;
  }
  
  if (!file.name.toLowerCase().endsWith('.apk')) {
    alert('只支持 APK 格式文件');
    return;
  }
  
  const formData = new FormData();
  formData.append('apk', file);
  
  const token = localStorage.getItem('token');
  const progressBar = document.getElementById('apk-progress-bar');
  const progressText = document.getElementById('apk-progress-text');
  const progressDiv = document.getElementById('apk-upload-progress');
  
  progressDiv.style.display = 'block';
  progressBar.style.width = '0%';
  progressText.textContent = '正在上传，请稍候...';
  
  try {
    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/app-version/upload-apk');
      xhr.setRequestHeader('Authorization', 'Bearer ' + token);
      
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          progressBar.style.width = percent + '%';
          progressText.textContent = '上传中... ' + percent + '%';
        }
      };
      
      xhr.onload = function() {
        if (xhr.status === 200) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error('服务器响应解析失败'));
          }
        } else {
          reject(new Error('上传失败 (HTTP ' + xhr.status + ')'));
        }
      };
      
      xhr.onerror = function() {
        reject(new Error('网络错误，上传失败'));
      };
      
      xhr.ontimeout = function() {
        reject(new Error('上传超时，请重试'));
      };
      
      xhr.timeout = 300000;
      xhr.send(formData);
    });
    
    progressBar.style.width = '100%';
    progressText.textContent = '上传完成！';
    
    if (result.code === 200 && result.data) {
      uploadedApkInfo = {
        downloadUrl: result.data.downloadUrl,
        fileSize: result.data.fileSize,
        fileName: result.data.fileName,
        md5: result.data.md5 || ''
      };
      
      document.getElementById('uploaded-filename').textContent = result.data.fileName;
      document.getElementById('uploaded-filesize').textContent = (result.data.fileSize / 1024 / 1024).toFixed(2) + ' MB';
      document.getElementById('uploaded-apk-info').style.display = 'block';
      
      document.getElementById('apk-download-url').value = result.data.downloadUrl;
      
      setTimeout(() => {
        progressDiv.style.display = 'none';
      }, 1000);
    } else {
      alert(result.message || '上传失败');
      progressDiv.style.display = 'none';
    }
  } catch (error) {
    alert('上传失败：' + error.message);
    progressBar.style.width = '0%';
    progressText.textContent = '上传失败';
    setTimeout(() => {
      progressDiv.style.display = 'none';
    }, 2000);
  }
}

// 处理发布表单提交
async function handlePublishVersionSubmit(e) {
  e.preventDefault();
  
  const versionCode = document.getElementById('version-code').value;
  const versionName = document.getElementById('version-name').value;
  const downloadUrl = document.getElementById('apk-download-url').value;
  const updateDescription = document.getElementById('update-description').value;
  const forceUpdate = document.getElementById('force-update').checked;
  
  if (!versionCode || !versionName || !downloadUrl) {
    alert('请填写完整信息');
    return;
  }
  
  const token = localStorage.getItem('token');
  try {
    const response = await fetch('/api/app-version/publish', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        versionCode: parseInt(versionCode),
        versionName: versionName,
        downloadUrl: downloadUrl,
        updateDescription: updateDescription,
        forceUpdate: forceUpdate,
        fileSize: uploadedApkInfo ? uploadedApkInfo.fileSize : 0,
        md5: uploadedApkInfo ? uploadedApkInfo.md5 : ''
      })
    });
    
    const result = await response.json();
    if (result.code === 200) {
      alert('发布成功！');
      uploadedApkInfo = null;
      document.getElementById('publish-version-modal').style.display = 'none';
      document.getElementById('publish-version-form').reset();
      document.getElementById('uploaded-apk-info').style.display = 'none';
      loadAppVersionList();
    } else {
      alert(result.message || '发布失败');
    }
  } catch (error) {
    alert('发布失败：' + error.message);
  }
}

// 初始化发布新版本模态框
document.addEventListener('DOMContentLoaded', function() {
  // 打开模态框
  const publishBtn = document.getElementById('publish-version-btn');
  if (publishBtn) {
    publishBtn.addEventListener('click', showPublishVersionModal);
  }
  
  // 上传 APK 按钮
  const uploadBtn = document.getElementById('upload-apk-now-btn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', uploadApkNow);
  }
  
  // 表单提交
  const publishForm = document.getElementById('publish-version-form');
  if (publishForm) {
    publishForm.addEventListener('submit', handlePublishVersionSubmit);
  }
  
  // 关闭模态框
  const closeBtns = document.querySelectorAll('.publish-version-cancel, #publish-version-modal .close');
  closeBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const modal = document.getElementById('publish-version-modal');
      if (modal) {
        modal.style.display = 'none';
        document.getElementById('apk-upload-progress').style.display = 'none';
        document.getElementById('uploaded-apk-info').style.display = 'none';
        document.getElementById('apk-upload-file').value = '';
      }
    });
  });
  
  // 点击模态框外部关闭
  window.addEventListener('click', function(event) {
    const modal = document.getElementById('publish-version-modal');
    if (event.target === modal) {
      modal.style.display = 'none';
      document.getElementById('apk-upload-progress').style.display = 'none';
      document.getElementById('uploaded-apk-info').style.display = 'none';
      document.getElementById('apk-upload-file').value = '';
    }
  });
});

// ========== AI 智能工具功能 ==========
let currentReadingUtterance = null;
let isReading = false;
let currentDetailInfo = null;

// 语音朗读文本
function speakText(text) {
  if (!text || !text.trim()) {
    showToast('没有可朗读的内容');
    return;
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentReadingUtterance = new SpeechSynthesisUtterance(text);
    currentReadingUtterance.lang = 'zh-CN';
    currentReadingUtterance.rate = 1.0;
    currentReadingUtterance.pitch = 1.0;
    currentReadingUtterance.volume = 1.0;
    
    currentReadingUtterance.onstart = function() {
      isReading = true;
      const stopBtn = document.getElementById('stop-reading-btn');
      if (stopBtn) stopBtn.style.display = 'inline-block';
    };
    
    currentReadingUtterance.onend = function() {
      isReading = false;
      const stopBtn = document.getElementById('stop-reading-btn');
      if (stopBtn) stopBtn.style.display = 'none';
    };
    
    currentReadingUtterance.onerror = function(event) {
      console.error('语音朗读出错:', event.error);
      isReading = false;
      const stopBtn = document.getElementById('stop-reading-btn');
      if (stopBtn) stopBtn.style.display = 'none';
      showToast('语音朗读失败: ' + event.error);
    };
    
    window.speechSynthesis.speak(currentReadingUtterance);
  } else {
    showToast('您的浏览器不支持语音朗读功能');
  }
}

// 停止朗读
function stopReading() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    isReading = false;
    const stopBtn = document.getElementById('stop-reading-btn');
    if (stopBtn) stopBtn.style.display = 'none';
  }
}

// 朗读全部信息
function readAllInfo() {
  if (!currentDetailInfo) {
    showToast('请先查看信息详情');
    return;
  }
  
  const parts = [];
  if (currentDetailInfo.store_name) parts.push('店名：' + currentDetailInfo.store_name);
  if (currentDetailInfo.category) parts.push('分类：' + currentDetailInfo.category);
  if (currentDetailInfo.province || currentDetailInfo.city || currentDetailInfo.district) {
    parts.push('地区：' + [currentDetailInfo.province, currentDetailInfo.city, currentDetailInfo.district].filter(Boolean).join(' '));
  }
  if (currentDetailInfo.address) parts.push('地址：' + currentDetailInfo.address);
  if (currentDetailInfo.description) parts.push('描述：' + currentDetailInfo.description);
  if (currentDetailInfo.business_hours) parts.push('营业时间：' + currentDetailInfo.business_hours);
  if (currentDetailInfo.price) parts.push('价格：' + currentDetailInfo.price + '元');
  
  if (parts.length === 0) {
    showToast('没有可朗读的内容');
    return;
  }
  
  const fullText = parts.join('，');
  speakText(fullText);
}

// AI 图片识别
async function recognizeImage() {
  const token = localStorage.getItem('token');
  if (!token) {
    showToast('请先登录');
    return;
  }
  
  if (!currentDetailInfo || !currentDetailInfo.images || currentDetailInfo.images.length === 0) {
    showToast('当前信息没有图片，无法识别');
    return;
  }
  
  const imageUrl = currentDetailInfo.images[0];
  const resultContainer = document.getElementById('ai-result-container');
  const resultContent = document.getElementById('ai-result-content');
  
  resultContainer.style.display = 'block';
  resultContent.textContent = '正在识别图片，请稍候...';
  
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error('无法加载图片');
    }
    
    const blob = await response.blob();
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    const mimeType = blob.type || 'image/jpeg';
    
    const aiResponse = await fetch('/api/ai/image-understand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        message: '请详细描述这张图片的内容，包括场景、物品、人物、文字等所有可见元素。',
        imageBase64: base64,
        imageMimeType: mimeType
      })
    });
    
    const result = await aiResponse.json();
    
    if (result.code === 200 && result.data) {
      resultContent.textContent = result.data.reply || '识别完成，但没有返回结果';
    } else {
      resultContent.textContent = '识别失败: ' + (result.message || '未知错误');
    }
  } catch (error) {
    console.error('图片识别出错:', error);
    resultContent.textContent = '图片识别失败: ' + error.message;
  }
}

// 初始化 AI 智能工具功能
document.addEventListener('DOMContentLoaded', function() {
  // 朗读店名按钮
  const readStoreNameBtn = document.getElementById('read-store-name-btn');
  if (readStoreNameBtn) {
    readStoreNameBtn.addEventListener('click', function() {
      const storeName = document.getElementById('detail-store-name-2')?.textContent;
      if (storeName && storeName !== '-') {
        speakText(storeName);
      } else {
        showToast('没有店名可朗读');
      }
    });
  }
  
  // 朗读地址按钮
  const readAddressBtn = document.getElementById('read-address-btn');
  if (readAddressBtn) {
    readAddressBtn.addEventListener('click', function() {
      const address = document.getElementById('detail-address')?.textContent;
      if (address && address !== '-') {
        speakText(address);
      } else {
        showToast('没有地址可朗读');
      }
    });
  }
  
  // 朗读描述按钮
  const readDescriptionBtn = document.getElementById('read-description-btn');
  if (readDescriptionBtn) {
    readDescriptionBtn.addEventListener('click', function() {
      const description = document.getElementById('detail-description')?.textContent;
      if (description && description !== '-') {
        speakText(description);
      } else {
        showToast('没有描述可朗读');
      }
    });
  }
  
  // 朗读全部信息按钮
  const readAllInfoBtn = document.getElementById('read-all-info-btn');
  if (readAllInfoBtn) {
    readAllInfoBtn.addEventListener('click', readAllInfo);
  }
  
  // 停止朗读按钮
  const stopReadingBtn = document.getElementById('stop-reading-btn');
  if (stopReadingBtn) {
    stopReadingBtn.addEventListener('click', stopReading);
  }
  
  // AI 图片识别按钮
  const recognizeImageBtn = document.getElementById('recognize-image-btn');
  if (recognizeImageBtn) {
    recognizeImageBtn.addEventListener('click', recognizeImage);
  }
});
