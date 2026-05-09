const { API_BASE_URL } = require('../../utils/constants.js');

Page({
  data: {
    statusBarHeight: 0,
    navBarHeight: 0,
    totalNavBarHeight: 0,
    expandedNavBarHeight: 0,
    currentTab: '',
    tabClicked: false,
    aboutData: {
      protocol: {
        title: '',
        content: ''
      },
      usage: {
        title: '',
        content: ''
      }
    },
    loading: false,
    error: false
  },

  onLoad: function (options) {
    const systemInfo = wx.getSystemInfoSync()
    const statusBarHeight = systemInfo.statusBarHeight
    const navBarHeight = 44
    const totalNavBarHeight = statusBarHeight + navBarHeight
    const expandedNavBarHeight = Math.round(totalNavBarHeight * 1.15)

    this.setData({
      statusBarHeight: statusBarHeight,
      navBarHeight: navBarHeight,
      totalNavBarHeight: totalNavBarHeight,
      expandedNavBarHeight: expandedNavBarHeight
    })
  },

  onShow: function () {
    
  },

  parseMarkdown: function(content) {
    if (!content) return [];
    
    const lines = content.split('\n');
    const parsedContent = [];
    
    lines.forEach(line => {
      line = line.trim();
      
      if (line.startsWith('# ')) {
        parsedContent.push({
          type: 'h1',
          content: line.substring(2).trim()
        });
      } else if (line.startsWith('## ')) {
        parsedContent.push({
          type: 'h2',
          content: line.substring(3).trim()
        });
      } else if (line.startsWith('- ')) {
        parsedContent.push({
          type: 'list',
          content: line.substring(2).trim()
        });
      } else if (line === '') {
        parsedContent.push({
          type: 'br'
        });
      } else {
        parsedContent.push({
          type: 'p',
          content: line
        });
      }
    });
    
    return parsedContent;
  },

  loadAboutContent: function() {
    this.setData({
      loading: true,
      error: false
    });

    wx.getNetworkType({
      success: (res) => {}
    });

    const usageUrl = `${API_BASE_URL}/api/about/usage`;
    const agreementUrl = `${API_BASE_URL}/api/about/agreement`;

    const requestUsage = new Promise((resolve, reject) => {
      wx.request({
        url: usageUrl,
        method: 'GET',
        timeout: 10000,
        success: (res) => {
          resolve(res);
        },
        fail: (err) => {
          reject(err);
        }
      });
    });

    const requestAgreement = new Promise((resolve, reject) => {
      wx.request({
        url: agreementUrl,
        method: 'GET',
        timeout: 10000,
        success: (res) => {
          resolve(res);
        },
        fail: (err) => {
          reject(err);
        }
      });
    });

    Promise.all([requestUsage, requestAgreement])
      .then(([usageRes, agreementRes]) => {
        let usageTitle = '使用说明';
        let usageContent = '使用说明内容加载中...';
        let usageParsed = [];

        if (usageRes.statusCode === 200 && usageRes.data) {
          if (usageRes.data.title) {
            usageTitle = usageRes.data.title;
          }
          if (usageRes.data.content) {
            usageContent = usageRes.data.content;
            usageParsed = this.parseMarkdown(usageContent);
          }
        }

        let agreementTitle = '用户协议';
        let agreementContent = '用户协议内容加载中...';
        let agreementParsed = [];

        if (agreementRes.statusCode === 200 && agreementRes.data) {
          if (agreementRes.data.title) {
            agreementTitle = agreementRes.data.title;
          }
          if (agreementRes.data.content) {
            agreementContent = agreementRes.data.content;
            agreementParsed = this.parseMarkdown(agreementContent);
          }
        }

        const finalAboutData = {
          protocol: {
            title: agreementTitle,
            content: agreementContent
          },
          usage: {
            title: usageTitle,
            content: usageContent
          },
          protocolTitle: agreementTitle,
          protocolContent: agreementParsed,
          usageTitle: usageTitle,
          usageContent: usageParsed
        };

        this.setData({
          aboutData: finalAboutData,
          loading: false,
          error: false
        });
      })
      .catch((err) => {
        this.setData({
          loading: false,
          error: true
        });
      });
  },

  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({
      currentTab: tab,
      tabClicked: true
    })
    
    this.loadAboutContent()
  },

  goBack: function() {
    wx.navigateBack()
  }
})
