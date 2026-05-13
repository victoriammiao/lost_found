// pages/register/register.js
const { request } = require("../../utils/request.js");

Page({
  data: {
    username: "",
    password: "",
    loading: false,
  },

  onInputUsername(e) {
    this.setData({ username: e.detail.value });
  },

  onInputPassword(e) {
    this.setData({ password: e.detail.value });
  },

  async onRegister() {
    const { username, password } = this.data;
    if (!username || !password) {
      wx.showToast({ title: "请输入账号和密码", icon: "none" });
      return;
    }
    if (username.length < 2 || password.length < 4) {
      wx.showToast({ title: "账号≥2位, 密码≥4位", icon: "none" });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await request({
        url: "/register",
        method: "POST",
        data: { username, password },
        auth: false,
      });
      if (res.code === 0) {
        wx.showToast({ title: "注册成功", icon: "success" });
        setTimeout(() => {
          // 注册后跳回登录页
          wx.navigateBack({
            fail: () => wx.reLaunch({ url: "/pages/login/login" }),
          });
        }, 600);
      } else {
        wx.showToast({ title: res.message || "注册失败", icon: "none" });
      }
    } catch (e) {
      // request 已处理
    } finally {
      this.setData({ loading: false });
    }
  },

  goLogin() {
    wx.navigateBack({
      fail: () => wx.reLaunch({ url: "/pages/login/login" }),
    });
  },
});
