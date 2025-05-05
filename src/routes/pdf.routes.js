import { upload,imageUpload,upload_for_pdfjpg,upload_for_word } from "../middleware/multer.middleware.js";
import { Router } from "express";
import multer from "multer";
import fs from 'fs';

import { merge,split,extract,jpgToPdf,pdfToJpg,
        compress,unlock_pdf, word_to_pdf, protect_pdf,
         pdf_to_pdfa,remove_pdf_pages,add_page_no,add_water_mark } from "../controllers/pdf.controllers.js";

const pdfRouter = Router();

const cleanupFolder = (folderPath) => {
  if (folderPath) {
    fs.rm(folderPath, { recursive: true, force: true }, (err) => {
      if (err) {
        console.error("❌ Error deleting folder:", err);
      } else {
        console.log("✅ Folder deleted successfully:", folderPath);
      }
    });
  }
};


function handleMulterErrors(err, req, res, next) {
    
    if (err instanceof multer.MulterError) {
      // Multer-specific errors
      cleanupFolder(req.uniqueUploadDir)
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File size exceeds 50 MB limit' });
      } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ message: 'Too many files uploaded. Maximum 8 files are allowed' });
      } else {
        return res.status(400).json({ message: err.message });
      }
    } else if (err) {           
      // Any other unknown errors
      return res.status(500).json({ message: 'Something went wrong while uploading' });
    }
    next();
  }


pdfRouter.route("/merge").post(upload.array('pdf_files',8), merge,handleMulterErrors);

pdfRouter.route("/split").post(upload.single('pdf_file'), split,handleMulterErrors);

pdfRouter.route("/extract_pdf").post(upload.single('file'), extract,handleMulterErrors);

pdfRouter.route("/jpg_to_pdf").post(imageUpload.array('images', 20),jpgToPdf,handleMulterErrors);

pdfRouter.route("/pdf_to_jpg").post(upload_for_pdfjpg.single('f1'), pdfToJpg,handleMulterErrors);

pdfRouter.route("/compress_pdf").post(upload.single('pdf_file'),compress,handleMulterErrors);

pdfRouter.route("/word_to_pdf").post(upload_for_word.single('pdf_file'),word_to_pdf,handleMulterErrors);

pdfRouter.route("/pdf_to_pdfa").post(upload.single('pdf_file'),pdf_to_pdfa,handleMulterErrors);

pdfRouter.route("/unlock_pdf").post(upload.single('pdf_file'),unlock_pdf,handleMulterErrors);

pdfRouter.route("/protect_pdf").post(upload.single('pdf_file'),protect_pdf,handleMulterErrors);

pdfRouter.route("/remove_pdf_pages").post(upload.single('pdf_file'),remove_pdf_pages,handleMulterErrors);

pdfRouter.route("/add_page_no").post(upload.single('pdf_file'),add_page_no,handleMulterErrors);

pdfRouter.route("/add_water_mark").post(upload.single('pdf_file'),add_water_mark,handleMulterErrors);

export {pdfRouter};