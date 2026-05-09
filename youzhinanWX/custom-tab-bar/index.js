Component({
  data: {
    selected: 0,
    list: []
  },
  attached() {
    const list = [
      {
        pagePath: 'pages/home/home',
        text: '首页',
        iconPath: '/images/首页未点击.png',
        selectedIconPath: '/images/首页被点击.png'
      },
      {
        pagePath: 'pages/index/index',
        text: '搜索',
        iconPath: '/images/搜索未点击.png',
        selectedIconPath: '/images/搜索被点击.png'
      },
      {
        pagePath: 'pages/mine/mine',
        text: '我',
        iconPath: '/images/我未点击.png',
        selectedIconPath: '/images/我被点击.png'
      }
    ];
    
    this.setData({ list });
    this.updateSelectedTab();
  },
  
  methods: {
    switchTab(e) {
      const dataset = e.currentTarget.dataset;
      if (!dataset.path || dataset.index === undefined) {
        return;
      }
      
      const pagePath = dataset.path;
      const index = dataset.index;
      
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      
      if (currentPage.route === pagePath) {
        return;
      }

      wx.switchTab({
        url: '/' + pagePath,
        success: () => {
          this.setData({ selected: index });
        }
      });
    },
    
    updateSelectedTab: function() {
      const pages = getCurrentPages();
      if (pages.length === 0) return;
      
      const route = pages[pages.length - 1].route;
      let selectedIndex = 0;
      
      if (route === 'pages/index/index') {
        selectedIndex = 1;
      } else if (route === 'pages/mine/mine') {
        selectedIndex = 2;
      }
      
      this.setData({ selected: selectedIndex });
    }
  }
})
