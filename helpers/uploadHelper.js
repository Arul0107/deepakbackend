// helpers/uploadHelper.js
const { supabase } = require("../config/supabase");
const { v4: uuidv4 } = require("uuid");

const BUCKET = "AINTHINAI";

const uploadImage = async (file) => {
  try {
    const fileName = `booking-${Date.now()}-${uuidv4()}.${file.originalname.split('.').pop()}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600'
      });

    if (error) throw new Error(error.message);

    // Get public URL
    const { data } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
};

const extractPath = (url) => {
  if (!url) return null;
  return url.split(`/${BUCKET}/`)[1];
};

const deleteImage = async (url) => {
  const path = extractPath(url);
  if (path) {
    await supabase.storage.from(BUCKET).remove([path]);
  }
};

module.exports = {
  uploadImage,
  extractPath,
  deleteImage
};