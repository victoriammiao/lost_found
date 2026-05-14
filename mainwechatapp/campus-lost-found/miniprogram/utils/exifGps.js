// 从本地 JPEG 读取 EXIF GPS（十进制度）。PNG / 无 GPS 返回 null。

function dmsToDecimal(deg, min, sec, ref) {
  let v = deg + min / 60 + sec / 3600;
  if (ref === "S" || ref === "W") v = -v;
  return v;
}

function parseJpegExifGps(arrayBuffer) {
  const u8 = new Uint8Array(arrayBuffer);
  if (u8.length < 10 || u8[0] !== 0xff || u8[1] !== 0xd8) return null;

  let i = 2;
  let tiff = null;
  while (i + 4 < u8.length) {
    if (u8[i] !== 0xff) break;
    const m = u8[i + 1];
    if (m === 0xd9 || m === 0xda) break;
    const segLen = (u8[i + 2] << 8) | u8[i + 3];
    if (m === 0xe1 && segLen >= 8) {
      const exifStart = i + 4;
      if (
        u8[exifStart] === 0x45 &&
        u8[exifStart + 1] === 0x78 &&
        u8[exifStart + 2] === 0x69 &&
        u8[exifStart + 3] === 0x66 &&
        u8[exifStart + 4] === 0 &&
        u8[exifStart + 5] === 0
      ) {
        tiff = u8.subarray(exifStart + 6, i + 2 + segLen);
        break;
      }
    }
    if (segLen < 2) break;
    i += 2 + segLen;
  }
  if (!tiff || tiff.length < 14) return null;

  const le = tiff[0] === 0x49 && tiff[1] === 0x49;
  const be = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!le && !be) return null;

  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const r16 = (o) => view.getUint16(o, le);
  const r32 = (o) => view.getUint32(o, le);

  const ifd0 = r32(4);
  if (ifd0 < 8 || ifd0 + 2 > tiff.length) return null;

  const n0 = r16(ifd0);
  let gpsIfdPtr = null;
  for (let k = 0; k < n0; k++) {
    const eo = ifd0 + 2 + k * 12;
    if (eo + 12 > tiff.length) break;
    const tag = r16(eo);
    if (tag === 0x8825) {
      const typ = r16(eo + 2);
      const cnt = r32(eo + 4);
      const val = r32(eo + 8);
      if (typ === 4 && cnt === 1) gpsIfdPtr = val;
      break;
    }
  }
  if (gpsIfdPtr == null || gpsIfdPtr + 2 > tiff.length) return null;

  const gn = r16(gpsIfdPtr);
  let latRef = "N";
  let lngRef = "E";
  let latRatOff = null;
  let lngRatOff = null;

  for (let k = 0; k < gn; k++) {
    const eo = gpsIfdPtr + 2 + k * 12;
    if (eo + 12 > tiff.length) break;
    const tag = r16(eo);
    const typ = r16(eo + 2);
    const cnt = r32(eo + 4);
    if (tag === 1 && typ === 2 && cnt >= 2) {
      latRef = String.fromCharCode(view.getUint8(eo + 8)) || "N";
    } else if (tag === 2 && typ === 5 && cnt === 3) {
      latRatOff = r32(eo + 8);
    } else if (tag === 3 && typ === 2 && cnt >= 2) {
      lngRef = String.fromCharCode(view.getUint8(eo + 8)) || "E";
    } else if (tag === 4 && typ === 5 && cnt === 3) {
      lngRatOff = r32(eo + 8);
    }
  }

  if (latRatOff == null || lngRatOff == null) return null;
  if (latRatOff + 24 > tiff.length || lngRatOff + 24 > tiff.length)
    return null;

  function readRat(off) {
    const num = r32(off);
    const den = r32(off + 4);
    return den === 0 ? 0 : num / den;
  }

  const la1 = readRat(latRatOff);
  const la2 = readRat(latRatOff + 8);
  const la3 = readRat(latRatOff + 16);
  const lo1 = readRat(lngRatOff);
  const lo2 = readRat(lngRatOff + 8);
  const lo3 = readRat(lngRatOff + 16);

  const lat = dmsToDecimal(la1, la2, la3, latRef);
  const lng = dmsToDecimal(lo1, lo2, lo3, lngRef);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return { lat, lng };
}

function readGpsFromLocalFile(filePath) {
  return new Promise((resolve) => {
    if (!filePath) {
      resolve(null);
      return;
    }
    wx.getFileSystemManager().readFile({
      filePath,
      success(res) {
        const data = res.data;
        if (!(data instanceof ArrayBuffer)) {
          resolve(null);
          return;
        }
        try {
          resolve(parseJpegExifGps(data));
        } catch (e) {
          resolve(null);
        }
      },
      fail() {
        resolve(null);
      },
    });
  });
}

module.exports = { parseJpegExifGps, readGpsFromLocalFile };
