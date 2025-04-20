import { upload,imageUpload } from "../middleware/multer.middleware.js";
import { Router } from "express";
import { merge,split,extract,jpgToPdf,pdfToJpg } from "../controllers/pdf.controllers.js";
const pdfRouter = Router();

pdfRouter.route("/merge").post(upload.array('pdf_files',5), merge);
pdfRouter.route("/split").post(upload.single('pdf_file'), split);
pdfRouter.route("/extract_pdf").post(upload.single('file'), extract);
pdfRouter.route("/jpg_to_pdf").post(imageUpload.array('images', 20), jpgToPdf);
pdfRouter.route("/pdf_to_jpg").post(upload.single('pdf_file'), pdfToJpg);

export {pdfRouter};