// pages/login/login.js
const { request } = require("../../utils/request.js");

Page({
  data: {
    username: "",
    password: "",
    loading: false,
  },

  onShow() {
    // 如果已经登录过, 直接跳首页
    const token = wx.getStorageSync("token");
    if (token) {
      wx.reLaunch({ url: "/pages/index/index" });
    }
  },

  onInputUsername(e) {
    this.setData({ username: e.detail.value });
  },

  onInputPassword(e) {
    this.setData({ password: e.detail.value });
  },

  async onLogin() {
    const { username, password } = this.data;
    if (!username || !password) {
      wx.showToast({ title: "请输入账号和密码", icon: "none" });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await request({
        url: "/login",
        method: "POST",
        data: { username, password },
        auth: false,
      });
      if (res.code === 0) {
        wx.setStorageSync("token", res.token);
        wx.setStorageSync("username", res.username);
        wx.showToast({ title: "登录成功", icon: "success" });
        setTimeout(() => {
          wx.reLaunch({ url: "/pages/index/index" });
        }, 500);
      } else {
        wx.showToast({ title: res.message || "登录失败", icon: "none" });
      }
    } catch (e) {
      // request 内部已提示
    } finally {
      this.setData({ loading: false });
    }
  },

  goRegister() {
    wx.navigateTo({ url: "/pages/register/register" });
  },
});
