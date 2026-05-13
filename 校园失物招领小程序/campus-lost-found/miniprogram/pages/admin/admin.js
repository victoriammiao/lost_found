const { request } = require("../../utils/request.js");
const config = require("../../utils/config.js");

function groupClues(flat) {
  const map = new Map();
  for (const c of flat || []) {
    if (!map.has(c.itemId)) {
      map.set(c.itemId, {
        itemId: c.itemId,
        itemTitle: c.itemTitle,
        itemPostType: c.itemPostType,
        itemPublisher: c.itemPublisher,
        posterContact: c.posterContact,
        clues: [],
      });
    }
    const row = Object.assign({}, c);
    if (row.imageUrl && !/^https?:\/\//.test(row.imageUrl)) {
      row.imageFullUrl = config.baseUrl + row.imageUrl;
    } else {
      row.imageFullUrl = row.imageUrl || "";
    }
    map.get(c.itemId).clues.push(row);
  }
  return Array.from(map.values());
}

Page({
  data: {
    adminTab: "verify",
    verifyList: [],
    itemList: [],
    clueSections: [],
    loading: false,
  },

  onLoad() {
    this._pageDestroyed = false;
  },

  onUnload() {
    this._pageDestroyed = true;
    if (this._adminBackTimer) {
      clearTimeout(this._adminBackTimer);
      this._adminBackTimer = null;
    }
  },

  onShow() {
    const token = wx.getStorageSync("token");
    if (!token) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }
    if ((wx.getStorageSync("username") || "") !== "000") {
      wx.showToast({ title: "无管理员权限", icon: "none" });
      if (this._adminBackTimer) clearTimeout(this._adminBackTimer);
      this._adminBackTimer = setTimeout(() => {
        this._adminBackTimer = null;
        if (this._pageDestroyed) return;
        wx.navigateBack({
          fail: () => wx.reLaunch({ url: "/pages/profile/profile" }),
        });
      }, 400);
      return;
    }
    this.reloadCurrentTab();
  },

  reloadCurrentTab() {
    const { adminTab } = this.data;
    if (adminTab === "items") {
      this.loadItemPending();
    } else if (adminTab === "clues") {
      this.loadClues();
    } else {
      this.loadVerify();
    }
  },

  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.adminTab) return;
    this.setData({ adminTab: tab }, () => this.reloadCurrentTab());
  },

  async loadVerify() {
    this.setData({ loading: true });
    try {
      const res = await request({
        url: "/admin/student-verifications",
        method: "GET",
      });
      if (Number(res.code) === 0) {
        this.setData({ verifyList: res.data || [] });
      } else {
        if (res.code === 403) wx.showToast({ title: "无管理员权限", icon: "none" });
        else wx.showToast({ title: res.message || "加载失败", icon: "none" });
      }
    } catch (e) {
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadItemPending() {
    this.setData({ loading: true });
    try {
      const res = await request({
        url: "/admin/items/pending",
        method: "GET",
      });
      if (Number(res.code) === 0) {
        this.setData({ itemList: res.data || [] });
      } else {
        if (res.code === 403) wx.showToast({ title: "无管理员权限", icon: "none" });
        else wx.showToast({ title: res.message || "加载失败", icon: "none" });
      }
    } catch (e) {
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadClues() {
    this.setData({ loading: true });
    try {
      const res = await request({
        url: "/admin/clues",
        method: "GET",
      });
      if (Number(res.code) === 0) {
        const flat = res.data || [];
        this.setData({ clueSections: groupClues(flat) });
      } else {
        if (res.code === 403) wx.showToast({ title: "无管理员权限", icon: "none" });
        else wx.showToast({ title: res.message || "加载失败", icon: "none" });
      }
    } catch (e) {
    } finally {
      this.setData({ loading: false });
    }
  },

  async onApproveVerify(e) {
    const u = e.currentTarget.dataset.u;
    if (!u) return;
    try {
      const res = await request({
        url: "/admin/student-verifications/approve",
        method: "POST",
        data: { username: u },
      });
      if (Number(res.code) === 0) {
        wx.showToast({ title: "已通过", icon: "success" });
        this.loadVerify();
      } else {
        wx.showToast({ title: res.message || "操作失败", icon: "none" });
      }
    } catch (e) {}
  },

  async onRejectVerify(e) {
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
          if (Number(res.code) === 0) {
            wx.showToast({ title: "已驳回", icon: "success" });
            this.loadVerify();
          } else {
            wx.showToast({ title: res.message || "操作失败", icon: "none" });
          }
        } catch (e) {}
      },
    });
  },

  async onApproveItem(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    try {
      const res = await request({
        url: "/admin/items/approve",
        method: "POST",
        data: { id },
      });
      if (Number(res.code) === 0) {
        wx.showToast({ title: "已通过", icon: "success" });
        this.loadItemPending();
      } else {
        wx.showToast({ title: res.message || "操作失败", icon: "none" });
      }
    } catch (e) {}
  },

  async onRejectItem(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: "拒绝该帖",
      content: "拒绝后不会出现在首页，发布者可在「我的」中看到状态。",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          const res = await request({
            url: "/admin/items/reject",
            method: "POST",
            data: { id },
          });
          if (Number(res.code) === 0) {
            wx.showToast({ title: "已拒绝", icon: "success" });
            this.loadItemPending();
          } else {
            wx.showToast({ title: res.message || "操作失败", icon: "none" });
          }
        } catch (e) {}
      },
    });
  },

  async onDeleteItem(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: "删除",
      content: "确定从数据库删除该条吗？不可恢复。",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          const res = await request({
            url: "/admin/items/delete",
            method: "POST",
            data: { id },
          });
          if (Number(res.code) === 0) {
            wx.showToast({ title: "已删除", icon: "success" });
            this.loadItemPending();
          } else {
            wx.showToast({ title: res.message || "操作失败", icon: "none" });
          }
        } catch (e) {}
      },
    });
  },

  async onMatchClue(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: "采纳该线索",
      content: "采纳后本帖将标记为已认领，其余待处理线索将自动拒绝。请确认已与双方核对信息。",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          const res = await request({
            url: "/admin/clues/match",
            method: "POST",
            data: { id },
          });
          if (Number(res.code) === 0) {
            wx.showToast({ title: "已采纳", icon: "success" });
            this.loadClues();
          } else {
            wx.showToast({ title: res.message || "操作失败", icon: "none" });
          }
        } catch (e) {}
      },
    });
  },

  async onRejectClue(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: "拒绝该线索",
      content: "确定拒绝这条线索吗？",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          const res = await request({
            url: "/admin/clues/reject",
            method: "POST",
            data: { id },
          });
          if (Number(res.code) === 0) {
            wx.showToast({ title: "已拒绝", icon: "success" });
            this.loadClues();
          } else {
            wx.showToast({ title: res.message || "操作失败", icon: "none" });
          }
        } catch (e) {}
      },
    });
  },
});
