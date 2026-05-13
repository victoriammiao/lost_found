// pages/publish/publish.js
const { request, uploadFile, hintFromRequestFail } = require("../../utils/request.js");
const { buildFlatPlaces } = require("../../utils/campusLocations.js");
const { findNearestPlace } = require("../../utils/geo.js");
const { readGpsFromLocalFile } = require("../../utils/exifGps.js");
const config = require("../../utils/config.js");

const MAX_EXIF_SNAP_M = 520;

// 失物分类配置（与后端 ALLOWED_CATEGORIES 保持一致，不含"全部"）
const CATEGORIES = [
  { value: "图书馆", label: "图书馆", icon: "📚" },
  { value: "食堂",   label: "食堂",   icon: "🍽️" },
  { value: "教学楼", label: "教学楼", icon: "🏫" },
  { value: "操场",   label: "操场",   icon: "⚽" },
  { value: "宿舍",   label: "宿舍",   icon: "🛏️" },
  { value: "其他",   label: "其他",   icon: "📦" },
];

Page({
  data: {
    postType: "招领",
    campusName: "",
    locationQuery: "",
    locationId: "",
    locationLabel: "",
    locationPickerOpen: false,
    locationCandidates: [],
    title: "",
    description: "",
    imagePath: "",
    /** 用户新选的本地临时文件，需上传 */
    pickedLocalPath: "",
    /** 编辑草稿时服务端已有相对路径 /uploads/... */
    draftRemoteImage: "",
    draftEditId: null,
    loading: false,
    /** 发布时随帖保存的 GCJ-02 / EXIF 定位（可选） */
    publishLat: null,
    publishLng: null,
    // 【新增】分类
    categories: CATEGORIES,
    category: "其他",
  },

  onLoad(options) {
    const raw = options && options.draftId;
    if (raw) {
      const id = parseInt(raw, 10);
      if (!isNaN(id)) {
        this.setData({ draftEditId: id });
        this.loadDraft(id);
      }
    }
  },

  onShow() {
    const token = wx.getStorageSync("token");
    if (!token) {
      wx.reLaunch({ url: "/pages/login/login" });
      return;
    }
    wx.getLocation({
      type: "gcj02",
      success: (res) => {
        this.setData({
          publishLat: res.latitude,
          publishLng: res.longitude,
        });
      },
    });
    const lp = wx.getStorageSync("lastMapPick");
    if (
      lp &&
      lp.id &&
      lp.label &&
      lp.ts &&
      Date.now() - lp.ts < 120000
    ) {
      this.setData({
        locationId: lp.id,
        locationLabel: lp.label,
        locationQuery: lp.label,
        locationPickerOpen: false,
        locationCandidates: [],
      });
      wx.removeStorageSync("lastMapPick");
    }
    this.ensureLocations();
  },

  noop() {},

  goHome() {
    wx.reLaunch({ url: "/pages/index/index" });
  },

  goProfile() {
    wx.navigateTo({ url: "/pages/profile/profile" });
  },

  goMapPick() {
    wx.navigateTo({
      url: "/pages/map-picker/map-picker",
      events: {
        locationPicked: (data) => {
          if (!data || !data.id || !data.label) return;
          this.setData({
            locationId: data.id,
            locationLabel: data.label,
            locationQuery: data.label,
            locationPickerOpen: false,
            locationCandidates: [],
          });
        },
      },
    });
  },

  async loadDraft(id) {
    await this.ensureLocations();
    try {
      const res = await request({ url: "/items/" + id, method: "GET" });
      if (res.code !== 0 || !res.data) {
        wx.showToast({ title: (res && res.message) || "加载草稿失败", icon: "none" });
        return;
      }
      const it = res.data;
      if (!it.isDraft) {
        wx.showToast({ title: "该条已是正式发布", icon: "none" });
        this.setData({ draftEditId: null });
        return;
      }
      let rel = it.imageUrl || "";
      let preview = "";
      if (rel) {
        preview = /^https?:\/\//.test(rel) ? rel : config.baseUrl + rel;
      }
      const plat =
        it.publishLatitude != null && it.publishLatitude !== ""
          ? Number(it.publishLatitude)
          : null;
      const plng =
        it.publishLongitude != null && it.publishLongitude !== ""
          ? Number(it.publishLongitude)
          : null;
      this.setData({
        title: it.title || "",
        description: it.description || "",
        postType: it.postType || "招领",
        locationId: it.locationId || "",
        locationLabel: it.locationLabel || "",
        locationQuery: it.locationLabel || "",
        draftRemoteImage: rel && !/^https?:\/\//.test(rel) ? rel : "",
        imagePath: preview,
        pickedLocalPath: "",
        publishLat:
          plat != null && !isNaN(plat) ? plat : this.data.publishLat,
        publishLng:
          plng != null && !isNaN(plng) ? plng : this.data.publishLng,
        category: it.category || "其他",  // 【修复】恢复草稿原来的分类
      });
    } catch (e) {
      wx.showToast({ title: "加载草稿失败", icon: "none" });
    }
  },

  async ensureLocations() {
    if (this._placesFlat && this._placesFlat.length) return;
    try {
      const res = await request({
        url: "/locations",
        method: "GET",
        failToast: false,
      });
      if (res.code === 0 && res.data) {
        this._placesFlat = buildFlatPlaces(res.data);
        this.setData({
          campusName: res.data.campusName || "",
        });
      } else {
        wx.showToast({
          title: (res && res.message) || "地点库接口返回异常",
          icon: "none",
          duration: 2800,
        });
      }
    } catch (e) {
      if (
        e &&
        (e.message === "未登录" || e.message === "登录已失效")
      ) {
        return;
      }
      wx.showToast({
        title: hintFromRequestFail(e),
        icon: "none",
        duration: 3200,
      });
    }
  },

  _clearBlurTimer() {
    if (this._locBlurTimer) {
      clearTimeout(this._locBlurTimer);
      this._locBlurTimer = null;
    }
  },

  filterLocation(query) {
    const flat = this._placesFlat || [];
    const q = (query || "").trim().toLowerCase();
    if (!q) {
      return flat.slice(0, 28);
    }
    return flat.filter((p) => p.searchText.indexOf(q) !== -1).slice(0, 40);
  },

  onLocationFocus() {
    this._clearBlurTimer();
    const candidates = this.filterLocation(this.data.locationQuery);
    this.setData({
      locationPickerOpen: true,
      locationCandidates: candidates,
    });
  },

  onLocationBlur() {
    this._clearBlurTimer();
    this._locBlurTimer = setTimeout(() => {
      this.setData({ locationPickerOpen: false });
      this._locBlurTimer = null;
    }, 180);
  },

  onLocationInput(e) {
    const v = e.detail.value || "";
    const candidates = this.filterLocation(v);
    this.setData({
      locationQuery: v,
      locationPickerOpen: true,
      locationCandidates: candidates,
      locationId: "",
      locationLabel: "",
    });
  },

  onPickLocation(e) {
    this._clearBlurTimer();
    const id = e.currentTarget.dataset.id;
    const label = e.currentTarget.dataset.label;
    if (!id || !label) return;
    this.setData({
      locationId: id,
      locationLabel: label,
      locationQuery: label,
      locationPickerOpen: false,
      locationCandidates: [],
    });
  },

  onClearLocation() {
    this._clearBlurTimer();
    this.setData({
      locationQuery: "",
      locationId: "",
      locationLabel: "",
      locationPickerOpen: false,
      locationCandidates: [],
    });
  },

  onPickPostType(e) {
    const t = e.currentTarget.dataset.type;
    if (t === "寻物" || t === "招领") {
      this.setData({ postType: t });
    }
  },

  // 【新增】选择分类
  onSelectCategory(e) {
    const v = e.currentTarget.dataset.value;
    if (v && v !== this.data.category) {
      this.setData({ category: v });
    }
  },

  onInputTitle(e) {
    this.setData({ title: e.detail.value });
  },

  onInputDescription(e) {
    this.setData({ description: e.detail.value });
  },

  onChooseImage() {
    const self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success(res) {
        const file = res.tempFiles && res.tempFiles[0];
        if (file && file.tempFilePath) {
          self.setData({
            imagePath: file.tempFilePath,
            pickedLocalPath: file.tempFilePath,
            draftRemoteImage: "",
          });
        }
      },
      fail(err) {
        if (err && err.errMsg && err.errMsg.indexOf("cancel") === -1) {
          wx.showToast({ title: "选择图片失败", icon: "none" });
        }
      },
    });
  },

  onPreviewImage() {
    const { imagePath } = this.data;
    if (!imagePath) return;
    wx.previewImage({ urls: [imagePath], current: imagePath });
  },

  publishGeoPayload() {
    const { publishLat, publishLng } = this.data;
    if (
      publishLat == null ||
      publishLng == null ||
      isNaN(publishLat) ||
      isNaN(publishLng)
    ) {
      return {};
    }
    return {
      publishLatitude: publishLat,
      publishLongitude: publishLng,
    };
  },

  async onImageTapForGeo() {
    const { pickedLocalPath } = this.data;
    if (!pickedLocalPath) {
      wx.showToast({
        title: "请重新选择本地照片（草稿远程图无 EXIF）",
        icon: "none",
      });
      return;
    }
    wx.showLoading({ title: "读取照片位置…", mask: true });
    await this.ensureLocations();
    const gps = await readGpsFromLocalFile(pickedLocalPath);
    wx.hideLoading();
    if (!gps) {
      wx.showToast({
        title: "未从照片中解析到 GPS（JPEG EXIF）",
        icon: "none",
      });
      return;
    }
    const flat = (this._placesFlat || []).filter(
      (p) =>
        p.lat != null &&
        p.lng != null &&
        !isNaN(p.lat) &&
        !isNaN(p.lng)
    );
    if (!flat.length) {
      wx.showToast({ title: "地点库无坐标", icon: "none" });
      return;
    }
    const nearest = findNearestPlace(gps.lat, gps.lng, flat);
    if (!nearest || nearest.distanceM > MAX_EXIF_SNAP_M) {
      wx.showToast({
        title:
          "照片坐标附近无匹配标注（约 " + MAX_EXIF_SNAP_M + " 米内）",
        icon: "none",
      });
      return;
    }
    const p = nearest.place;
    this.setData({
      locationId: p.id,
      locationLabel: p.label,
      locationQuery: p.label,
      locationPickerOpen: false,
      locationCandidates: [],
      publishLat: gps.lat,
      publishLng: gps.lng,
    });
    wx.showToast({
      title: "已按照片 GPS 匹配：" + (p.placeName || p.label),
      icon: "none",
    });
  },

  onDeleteImage() {
    this.setData({
      imagePath: "",
      pickedLocalPath: "",
      draftRemoteImage: "",
    });
  },

  async resolveImageUrlForSubmit() {
    const { pickedLocalPath, draftRemoteImage } = this.data;
    if (pickedLocalPath) {
      const uploadRes = await uploadFile({
        url: "/upload",
        filePath: pickedLocalPath,
        name: "file",
      });
      if (
        uploadRes &&
        uploadRes.code === 0 &&
        uploadRes.data &&
        uploadRes.data.imageUrl
      ) {
        return uploadRes.data.imageUrl;
      }
      wx.showToast({
        title: (uploadRes && uploadRes.message) || "图片上传失败",
        icon: "none",
      });
      return null;
    }
    return draftRemoteImage || "";
  },

  async onSaveDraft() {
    const { title, description, postType, locationId, draftEditId } = this.data;
    if (!title.trim() && !description.trim()) {
      wx.showToast({ title: "请至少填写标题或描述", icon: "none" });
      return;
    }

    this.setData({ loading: true });
    try {
      let imageUrl = await this.resolveImageUrlForSubmit();
      if (imageUrl === null) {
        this.setData({ loading: false });
        return;
      }

      const payload = Object.assign(
        {
          title: title.trim(),
          description: description.trim(),
          imageUrl: imageUrl || "",
          postType: postType,
          locationId: locationId || "",
          saveAsDraft: true,
          category: this.data.category || "其他",
        },
        this.publishGeoPayload()
      );

      let res;
      if (draftEditId) {
        res = await request({
          url: "/items/" + draftEditId,
          method: "PUT",
          data: Object.assign(
            {
              title: payload.title,
              description: payload.description,
              imageUrl: payload.imageUrl,
              postType: payload.postType,
              locationId: payload.locationId,
              category: this.data.category || "其他",  // 【修复】保存草稿时带上分类
            },
            this.publishGeoPayload()
          ),
        });
      } else {
        res = await request({
          url: "/items",
          method: "POST",
          data: payload,
        });
      }

      if (res.code === 0) {
        const wasEdit = !!draftEditId;
        wx.showToast({ title: wasEdit ? "草稿已更新" : "草稿已保存", icon: "success" });
        const d = res.data || {};
        const nid = d.id || draftEditId;
        let img = d.imageUrl || "";
        let preview = "";
        let remoteRel = "";
        if (img) {
          if (/^https?:\/\//.test(img)) {
            preview = img;
          } else {
            remoteRel = img;
            preview = config.baseUrl + img;
          }
        }
        this.setData({
          draftEditId: nid,
          pickedLocalPath: "",
          draftRemoteImage: remoteRel,
          imagePath: preview || this.data.imagePath,
        });
      } else {
        wx.showToast({ title: res.message || "保存失败", icon: "none" });
      }
    } catch (e) {
    } finally {
      this.setData({ loading: false });
    }
  },

  async onSubmit() {
    const {
      title,
      description,
      postType,
      locationId,
      draftEditId,
    } = this.data;
    await this.ensureLocations();

    if (!locationId) {
      wx.showToast({ title: "请从联想列表中选择校区地点", icon: "none" });
      return;
    }
    if (!title.trim()) {
      wx.showToast({ title: "请输入标题", icon: "none" });
      return;
    }
    if (!description.trim()) {
      wx.showToast({ title: "请输入描述", icon: "none" });
      return;
    }

    this.setData({ loading: true });

    try {
      let imageUrl = await this.resolveImageUrlForSubmit();
      if (imageUrl === null) {
        this.setData({ loading: false });
        return;
      }

      let res;
      if (draftEditId) {
        res = await request({
          url: "/items/" + draftEditId + "/publish",
          method: "POST",
          data: Object.assign(
            {
              title: title.trim(),
              description: description.trim(),
              imageUrl: imageUrl || "",
              postType: postType,
              locationId: locationId,
              category: this.data.category || "其他",
            },
            this.publishGeoPayload()
          ),
        });
      } else {
        res = await request({
          url: "/items",
          method: "POST",
          data: Object.assign(
            {
              title: title.trim(),
              description: description.trim(),
              imageUrl: imageUrl || "",
              postType: postType,
              locationId: locationId,
              category: this.data.category || "其他",
            },
            this.publishGeoPayload()
          ),
        });
      }

      if (res.code === 0) {
        wx.showToast({ title: "发布成功", icon: "success" });
        this.setData({
          title: "",
          description: "",
          postType: "招领",
          imagePath: "",
          pickedLocalPath: "",
          draftRemoteImage: "",
          draftEditId: null,
          locationQuery: "",
          locationId: "",
          locationLabel: "",
          locationCandidates: [],
          locationPickerOpen: false,
          publishLat: null,
          publishLng: null,
          category: "其他",
        });
        setTimeout(() => {
          wx.navigateBack({
            fail: () => wx.reLaunch({ url: "/pages/index/index" }),
          });
        }, 600);
      } else {
        wx.showToast({ title: res.message || "发布失败", icon: "none" });
      }
    } catch (e) {
    } finally {
      this.setData({ loading: false });
    }
  },
});
