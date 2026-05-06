// pages/index/index.js
// 【本次修改】列表项现在包含 imageUrl 字段, 需要把后端返回的相对路径 "/uploads/xxx.jpg"
// 拼接成完整 URL "http://127.0.0.1:5000/uploads/xxx.jpg", 否则 <image> 无法加载
const { request } = require("../../utils/request.js");
const config = require("../../utils/config.js");

Page({
  data: {
    items: [],
    loading: false,
    username: "",
  },

  onShow() {
    // 登录拦截: 没有 token 就踢回登录页
    const token = wx.getStorageSync("token");
    if (!token) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }
    this.setData({ username: wx.getStorageSync("username") || "" });
    this.loadItems();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadItems().then(() => wx.stopPullDownRefresh());
  },

  // 拉取失物列表
  async loadItems() {
    this.setData({ loading: true });
    try {
      const res = await request({ url: "/items", method: "GET" });
      if (res.code === 0) {
        // 【本次新增】把 imageUrl 从相对路径拼成完整 URL, 供 <image src> 直接使用
        const list = (res.data || []).map((it) => {
          let fullUrl = "";
          if (it.imageUrl) {
            // 已经是 http 开头就原样用, 否则拼 baseUrl
            fullUrl = /^https?:\/\//.test(it.imageUrl)
              ? it.imageUrl
              : config.baseUrl + it.imageUrl;
          }
          return Object.assign({}, it, { imageUrl: fullUrl });
        });
        this.setData({ items: list });
      } else {
        wx.showToast({ title: res.message || "加载失败", icon: "none" });
      }
    } catch (e) {
      // request 已处理
    } finally {
      this.setData({ loading: false });
    }
  },

  // 认领物品
  async onClaim(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    if (status === "已认领") return;

    wx.showModal({
      title: "确认认领",
      content: "确定认领该物品吗?",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          const res = await request({
            url: "/items/claim",
            method: "POST",
            data: { id },
          });
          if (res.code === 0) {
            wx.showToast({ title: "认领成功", icon: "success" });
            this.loadItems();
          } else {
            wx.showToast({ title: res.message || "认领失败", icon: "none" });
          }
        } catch (e) {}
      },
    });
  },

  // 跳转发布页
  goPublish() {
    wx.navigateTo({ url: "/pages/publish/publish" });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: "退出登录",
      content: "确定退出当前账号吗?",
      success: (r) => {
        if (!r.confirm) return;
        wx.removeStorageSync("token");
        wx.removeStorageSync("username");
        wx.reLaunch({ url: "/pages/login/login" });
      },
    });
  },
});
