import multer from "multer";
import path from 'path'
import fs from 'fs'
const storage = multer.diskStorage({
  destination: function (req, file, cb) {

    if(!req.uniqueUploadDir)
    {
      let uniqueFolder = `./public/uploads/folder-${Date.now()}-${Math.random().toString(36).substring(2)}`;
      fs.mkdirSync(uniqueFolder, { recursive: true });
      req.uniqueUploadDir = uniqueFolder; 
    }
    cb(null, req.uniqueUploadDir);
  },
  filename: function (req, file, cb) {
    let datetimestamp = Date.now();
        cb(null, file.fieldname + '-' + datetimestamp + `${Math.round(Math.random() * 1E9)}` + '.' +
        file.originalname.split('.')[file.originalname.split('.').length -1])

  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, callback) {
    var ext = path.extname(file.originalname);
    if (ext !== ".pdf") {
      return callback(new Error("uploaded file is not pdf"));
    }
    callback(null, true);
  },
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});
const imageUpload = multer({
  storage: storage,
  fileFilter: function (req, file, callback) {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedTypes = [".jpg", ".jpeg", ".png", ".webp"];
    if (!allowedTypes.includes(ext)) {
      return callback(new Error("Only images are allowed (.jpg, .jpeg, .png, .webp)"));
    }
    callback(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});


export { upload,imageUpload };

