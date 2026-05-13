// pages/index/index.js
// 【升级】新增搜索 + 分类 + 状态三重筛选，全部走后端 query 参数
// 保留 A 原有功能：postType 标签、学生认证、地点标签、底部导航、goProfile/goHome
const { request } = require("../../utils/request.js");
const config = require("../../utils/config.js");

// 分类列表（与后端 ALLOWED_CATEGORIES 保持一致，value 为空表示"全部"）
const CATEGORIES = [
  { value: "",       label: "全部",   icon: "🌐" },
  { value: "图书馆", label: "图书馆", icon: "📚" },
  { value: "食堂",   label: "食堂",   icon: "🍽️" },
  { value: "教学楼", label: "教学楼", icon: "🏫" },
  { value: "操场",   label: "操场",   icon: "⚽" },
  { value: "宿舍",   label: "宿舍",   icon: "🛏️" },
  { value: "其他",   label: "其他",   icon: "📦" },
];

// 状态选项
const STATUS_OPTIONS = [
  { value: "",       label: "全部" },
  { value: "未认领", label: "未认领" },
  { value: "已认领", label: "已认领" },
];

// 分类 → emoji 查表，给卡片小标签用
const CATEGORY_ICON_MAP = CATEGORIES.reduce((acc, c) => {
  if (c.value) acc[c.value] = c.icon;
  return acc;
}, {});

const SEARCH_DEBOUNCE_MS = 300;

Page({
  data: {
    items: [],
    loading: false,
    username: "",

    // 筛选相关
    categories: CATEGORIES,
    statusOptions: STATUS_OPTIONS,
    keyword: "",
    category: "",
    status: "",
    hasActiveFilter: false,
  },

  _searchTimer: null,

  onShow() {
    const token = wx.getStorageSync("token");
    if (!token) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }
    this.setData({ username: wx.getStorageSync("username") || "" });
    this.loadItems();
  },

  onPullDownRefresh() {
    this.loadItems().then(() => wx.stopPullDownRefresh());
  },

  onUnload() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
  },

  // ====== 筛选事件 ======

  onKeywordInput(e) {
    const v = e.detail.value;
    this.setData({ keyword: v }, () => this._updateActiveFilter());
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this._searchTimer = null;
      this.loadItems();
    }, SEARCH_DEBOUNCE_MS);
  },

  onKeywordConfirm() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
    this.loadItems();
  },

  onClearKeyword() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
    this.setData({ keyword: "" }, () => this._updateActiveFilter());
    this.loadItems();
  },

  onCategoryTap(e) {
    const v = e.currentTarget.dataset.value || "";
    if (v === this.data.category) return;
    this.setData({ category: v }, () => this._updateActiveFilter());
    this.loadItems();
  },

  onStatusTap(e) {
    const v = e.currentTarget.dataset.value || "";
    if (v === this.data.status) return;
    this.setData({ status: v }, () => this._updateActiveFilter());
    this.loadItems();
  },

  onResetFilter() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
    this.setData(
      { keyword: "", category: "", status: "" },
      () => this._updateActiveFilter()
    );
    this.loadItems();
  },

  _updateActiveFilter() {
    const { keyword, category, status } = this.data;
    const has = !!(keyword && keyword.trim()) || !!category || !!status;
    if (has !== this.data.hasActiveFilter) {
      this.setData({ hasActiveFilter: has });
    }
  },

  // ====== 列表加载 ======

  async loadItems() {
    this.setData({ loading: true });
    try {
      const { keyword, category, status } = this.data;
      const res = await request({
        url: "/items",
        method: "GET",
        data: {
          keyword: (keyword || "").trim(),
          category: category || "",
          status: status || "",
        },
      });
      if (res.code === 0) {
        const list = (res.data || []).map((it) => {
          // 拼接完整图片 URL
          let fullUrl = "";
          if (it.imageUrl) {
            fullUrl = /^https?:\/\//.test(it.imageUrl)
              ? it.imageUrl
              : config.baseUrl + it.imageUrl;
          }
          // 兼容旧数据：没有 category 当作"其他"
          const cat = it.category || "其他";
          return Object.assign({}, it, {
            imageUrl: fullUrl,
            postType: it.postType || "招领",
            locationLabel: it.locationLabel || "",
            publisherStudentVerified: !!it.publisherStudentVerified,
            category: cat,
            categoryIcon: CATEGORY_ICON_MAP[cat] || "📦",
          });
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

  // ====== 认领 ======

  async onClaim(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    const postType = e.currentTarget.dataset.postType || "招领";
    if (status === "已认领") return;

    const isXunwu = postType === "寻物";
    wx.showModal({
      title: isXunwu ? "反馈失主" : "确认认领",
      content: isXunwu
        ? "确认你已捡到该物品或要与失主对接吗？确认后将标记为已认领。"
        : "确定认领该物品吗?",
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

  goPublish() {
    wx.navigateTo({ url: "/pages/publish/publish" });
  },

  goHome() {
    this.loadItems();
  },

  goProfile() {
    wx.navigateTo({ url: "/pages/profile/profile" });
  },

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
