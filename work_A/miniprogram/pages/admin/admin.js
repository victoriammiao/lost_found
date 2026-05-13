const { request } = require("../../utils/request.js");

Page({
  data: {
    list: [],
    loading: false,
  },

  onShow() {
    const token = wx.getStorageSync("token");
    if (!token) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }
    if ((wx.getStorageSync("username") || "") !== "000") {
      wx.showToast({ title: "无管理员权限", icon: "none" });
      setTimeout(() => wx.navigateBack({ fail: () => wx.reLaunch({ url: "/pages/profile/profile" }) }), 400);
      return;
    }
    this.loadList();
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const res = await request({
        url: "/admin/student-verifications",
        method: "GET",
      });
      if (res.code === 0) {
        this.setData({ list: res.data || [] });
      } else {
        if (res.code === 403) {
          wx.showToast({ title: "无管理员权限", icon: "none" });
        } else {
          wx.showToast({ title: res.message || "加载失败", icon: "none" });
        }
      }
    } catch (e) {
    } finally {
      this.setData({ loading: false });
    }
  },

  async onApprove(e) {
    const u = e.currentTarget.dataset.u;
    if (!u) return;
    try {
      const res = await request({
        url: "/admin/student-verifications/approve",
        method: "POST",
        data: { username: u },
      });
      if (res.code === 0) {
        wx.showToast({ title: "已通过", icon: "success" });
        this.loadList();
      } else {
        wx.showToast({ title: res.message || "操作失败", icon: "none" });
      }
    } catch (e) {}
  },

  async onReject(e) {
    const u = e.currentTarget.dataset.u;
    if (!u) return;
    wx.showModal({
      title: "驳回申请",
      content: "确定驳回该学生的认证申请吗？",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          const res = await request({
            url: "/admin/student-verifications/reject",
            method: "POST",
            data: { username: u },
          });
          if (res.code === 0) {
            wx.showToast({ title: "已驳回", icon: "success" });
            this.loadList();
          } else {
            wx.showToast({ title: res.message || "操作失败", icon: "none" });
          }
        } catch (e) {}
      },
    });
  },
});
