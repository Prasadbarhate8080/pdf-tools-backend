import fs from "fs";
import { type } from "os";
import path from "path";
import { ParseSpeeds, PDFDocument } from "pdf-lib";
import { upload } from "../middleware/multer.middleware.js";
import multer from "multer";
import ILovePDFApi from '@ilovepdf/ilovepdf-nodejs'
import ILovePDFFile from "@ilovepdf/ilovepdf-nodejs/ILovePDFFile.js"
const PUBLIC_KEY = process.env.ILOVEPDF_PUBLIC_KEY;
const SECRET_KEY = process.env.ILOVEPDF_SECRET_KEY;
import { StandardFonts, rgb } from "pdf-lib";

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  const bigint = parseInt(hex, 16);
  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255
  };
}

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

const merge = async (req, res) => {
  try {

    

    const uploadFolder = req.uniqueUploadDir;

    let mergedPdfBytes;

    const mergePDFsFromFolder = async (uploadsDirPath, outputPath) => {
      const mergedPdf = await PDFDocument.create();

      const files = fs
        .readdirSync(uploadsDirPath)
        .filter((file) => path.extname(file).toLowerCase() === ".pdf");

      for (const file of files) {
        const filePath = path.join(uploadsDirPath, file);
        const fileBytes = fs.readFileSync(filePath);
        const pdf = await PDFDocument.load(fileBytes);

        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));
      }

      mergedPdfBytes = await mergedPdf.save();
    };

    let mergedPdfName = `merged-${Date.now()}.pdf`;

    await mergePDFsFromFolder(
      uploadFolder,
      `./public/downloads/${mergedPdfName}`
    );

    

    // setTimeout(() => {
    //   const mergedFilePath = path.join(
    //     "public",
    //     "downloads",
    //     `${mergedPdfName}`
    //   );
    //   fs.unlink(mergedFilePath, (err) => {
    //     if (err) console.error("Failed to delete merged file", err);
    //     else console.log("Merged file deleted after timeout");
    //   });
    // }, 10 * 1000);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=merged.pdf");
    res.send(Buffer.from(mergedPdfBytes))
  } catch (error) {
    console.log("Error in MERGING  the pdfs", error);
    
  }
  finally {
    const folderToDelete = req?.uniqueUploadDir;
    console.log(folderToDelete);
    
    const f1 = fs.existsSync(folderToDelete);
    console.log(f1);
    if (folderToDelete && fs.existsSync(folderToDelete)) {
      fs.rm(folderToDelete, { recursive: true, force: true }, (err) => {
        if (err) {
          console.error("❌ Error deleting folder:", err);
        } else {
          console.log("✅ Folder deleted successfully:", folderToDelete);
        }
      });
    }
  }
};

const split = async (req, res) => {
  try {
    const pdfFile = req.file;
    const { startPage, endingPage } = req.body;

    if (!pdfFile) {
      cleanupFolder(req.uniqueUploadDir);
      return res.status(400).json({ error: "No PDF uploaded" });
    }

    if (!startPage || !endingPage) {
      cleanupFolder(req.uniqueUploadDir);
      return res
        .status(400)
        .json({ error: "Start and end page numbers are required" });
    }

    const pdfBytes = await fs.promises.readFile(pdfFile.path);
    const pdf = await PDFDocument.load(pdfBytes);

    const totalPages = pdf.getPageCount();
    const start = parseInt(startPage) - 1;
    const end = parseInt(endingPage) - 1;

    // ✅ Additional validation
    if (isNaN(start) || isNaN(end)) {
      cleanupFolder(req.uniqueUploadDir);
      return res.status(400).json({ error: "Start and end pages must be numbers" });
    }

    if (start < 0 || end >= totalPages) {
      cleanupFolder(req.uniqueUploadDir);
      return res.status(400).json({
        error: `Invalid range: PDF has ${totalPages} pages. Start and end must be between 1 and ${totalPages}.`,
      });
    }

    if (start > end) {
      cleanupFolder(req.uniqueUploadDir);
      return res.status(400).json({
        error: "Start page cannot be greater than end page.",
      });
    }

    const splitPdf = await PDFDocument.create();
    const pages = await splitPdf.copyPages(
      pdf,
      Array.from({ length: end - start + 1 }, (_, i) => start + i)
    );
    pages.forEach((page) => splitPdf.addPage(page));

    const splitPdfBytes = await splitPdf.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=split.pdf");
    res.send(Buffer.from(splitPdfBytes));

    // 🧹 Cleanup after success
    cleanupFolder(req.uniqueUploadDir);

  } catch (error) {
    console.error("Error splitting PDF:", error);
    cleanupFolder(req.uniqueUploadDir);
    res.status(500).json({ error: error.message });
  }
  finally
  {
    if(fs.existsSync(req.uniqueUploadDir))
    {
      cleanupFolder(req.uniqueUploadDir);
    }
  }
};

const extract = async (req, res) => {
  try {
    const pdfFile = req.file;
    const pagesJSON = req.body.pages;
    const uploadFolder = req.uniqueUploadDir;
    
    if (!pdfFile) {
      return res.status(400).json({ error: "No PDF uploaded" });
    }

    if (!pagesJSON) {
      return res.status(400).json({ error: "Page numbers are required" });
    }

    // Parse the JSON string to get an array of page numbers
    const pageNumbers = JSON.parse(pagesJSON);
    
    if (!Array.isArray(pageNumbers) || pageNumbers.length === 0) {
      return res.status(400).json({ error: "Invalid page selection" });
    }

    // Read and load the uploaded PDF
    const pdfBytes = await fs.promises.readFile(req.file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const totalPages = pdfDoc.getPageCount();
    
    // Filter out invalid page numbers
    const validPageNumbers = pageNumbers
      .filter(page => page > 0 && page <= totalPages)
      .map(page => page - 1); // Convert to 0-based indexing

    if (validPageNumbers.length === 0) {
      return res.status(400).json({ 
        error: `Invalid page selection. The PDF has ${totalPages} pages.` 
      });
    }

    // Create a new PDF with only the selected pages
    const extractedPdf = await PDFDocument.create();
    const pages = await extractedPdf.copyPages(pdfDoc, validPageNumbers);
    pages.forEach(page => extractedPdf.addPage(page));

    // Save the new PDF
    const extractedPdfBytes = await extractedPdf.save();
    
    // Clean up the uploaded file (optional)

    const deleteFolder = (folderPath) => {
      fs.rm(folderPath, { recursive: true, force: true }, (err) => {
        if (err) {
          console.error(" Error deleting folder:", err);
        } else {
          console.log(" Folder deleted successfully:", folderPath);
        }
      });
    };
    deleteFolder(uploadFolder);

    // Send the new PDF as a response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=extracted.pdf");
    res.send(Buffer.from(extractedPdfBytes));
  } catch (error) {
    console.error("Error extracting PDF pages:", error);
    res.status(500).json({ error: error.message });
  }
  finally
  {
    if(fs.existsSync(uploadFolder))
    {
      deleteFolder(uploadFolder);
    }
  }
};

 const jpgToPdf = async (req, res) => {
  try {

    const uploadFolder = req.uniqueUploadDir;
    const pdfDoc = await PDFDocument.create();

    // A4 page size (in points)
    const PAGE_WIDTH = 595.28;
    const PAGE_HEIGHT = 841.89;

    for (const file of req.files) {
      const filePath = file.path;
      const ext = path.extname(filePath).toLowerCase();

      const fileBytes = fs.readFileSync(filePath);
      let image;

      if (ext === ".jpg" || ext === ".jpeg") {
        image = await pdfDoc.embedJpg(fileBytes);
      } else if (ext === ".png") {
        image = await pdfDoc.embedPng(fileBytes);
      }

      if (!image) {
        console.warn("⚠️ Unsupported file skipped:", filePath);
        continue;
      }

      const { width: imgWidth, height: imgHeight } = image.scale(1);

      // Scale image proportionally to fit in A4 page
      const scale = Math.min(PAGE_WIDTH / imgWidth, PAGE_HEIGHT / imgHeight, 1);
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;

      // Center the image
      const x = (PAGE_WIDTH - drawWidth) / 2;
      const y = (PAGE_HEIGHT - drawHeight) / 2;

      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      page.drawImage(image, {
        x,
        y,
        width: drawWidth,
        height: drawHeight,
      });
    }

    const pdfBytes = await pdfDoc.save();

    // ✅ Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=converted.pdf");

    // ✅ Send PDF buffer in response
    res.send(Buffer.from(pdfBytes));


  } catch (error) {
    console.error("❌ Error in jpgToPdf:", error);
    res.status(500).send("Error converting images to PDF");
  }
  finally {
    const folderToDelete = req?.uniqueUploadDir;
    console.log(folderToDelete);
    
    const f1 = fs.existsSync(folderToDelete);
    console.log(f1);
    if (folderToDelete && fs.existsSync(folderToDelete)) {
      fs.rm(folderToDelete, { recursive: true, force: true }, (err) => {
        if (err) {
          console.error("❌ Error deleting folder:", err);
        } else {
          console.log("✅ Folder deleted successfully:", folderToDelete);
        }
      });
    }
  }
  
};

const pdfToJpg = async (req, res) => {
  try {
        
    const instance = new ILovePDFApi(PUBLIC_KEY, SECRET_KEY);
    const task = instance.newTask('pdfjpg')
  
    console.log(req.file.path);
    // const fileName = req.file.path.split('\\').slice(-2);
    // let filePath = fileName.join("/");
    // let completeFilePath = './' + filePath;
    // // console.log(completeFilePath);
    
    const file = new ILovePDFFile(req.file.path);

    task.start()
    .then(() => {
      return task.addFile(file);
    })
    .then(() => {
      return task.process({ pdfjpg_mode: 'pages' });
    })
    .then(() => {
      return task.download();
    })
    .then((data) => {
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", "attachment; filename=converted_images.zip");
      res.send(data);
    })
    .catch((error) => {
      console.log("there is the error in converting the pdf");
      res.status(500).json({ message: "Something went wrong while converting the PDF." });
    })

  } catch (error) { 
    console.log(error);
  }
  finally{
    fs.unlink(req.file.path,(error) => {
      if(error)
        console.log(error);
      else
      console.log("file deleted successfully");
      
    });
  }
}

const compress = async (req,res) => {
  try {
    
    const instance = new ILovePDFApi(PUBLIC_KEY, SECRET_KEY);
    
    const task = instance.newTask('compress');
    const file = new ILovePDFFile(path.resolve(req.file.path));

    task.start()
    .then((data) => {
      return task.addFile(file);  
    })
    .then(() => {
      return task.process({ compression_level: 'extreme' });
    })
    .then(() => {
      return task.download();
    })
    .then((data) => {
      
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=compressed.pdf");
    res.send(Buffer.from(data))
  }).catch((error) => {
    console.log("there is the error in compressing the pdf");
    res.status(500).json({ message: "Something went wrong while compressing the PDF." });
  })

  } catch (error) {
    console.log(error);
  }
  finally{
    cleanupFolder(req.uniqueUploadDir);
  }
 

}

const word_to_pdf = async (req,res) => {
  try {
    
    const instance = new ILovePDFApi(PUBLIC_KEY, SECRET_KEY);
    const task = instance.newTask('officepdf');
    const file = new ILovePDFFile(path.resolve(req.file.path));

    task.start()
    .then((data) => {
      return task.addFile(file);  
    })
    .then(() => {
      return task.process();
    })
    .then(() => {
      return task.download();
    })
    .then((data) => {
      
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=compressed.pdf");
    res.send(Buffer.from(data))
  })
  .catch((error) => {
    console.log("there is the erorr in converting the pdf");
    res.status(500).json({ message: "Something went wrong while converting the PDF." });
  })

  } catch (error) {
    console.log(error);
  }
  finally{
    cleanupFolder(req.uniqueUploadDir);
  }
 

}

const pdf_to_pdfa = async (req,res) => {
  try {
    
    const instance = new ILovePDFApi(PUBLIC_KEY, SECRET_KEY);
    const task = instance.newTask('pdfa');
    const file = new ILovePDFFile(path.resolve(req.file.path));

    task.start()
    .then((data) => {
      return task.addFile(file);  
    })
    .then(() => {
      return task.process();
    })
    .then(() => {
      return task.download();
    })
    .then((data) => {
      
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=compressed.pdf");
    res.send(Buffer.from(data))
  })
  .catch((error) => {
    console.log("there is the error in converting the pdf");
    res.status(500).json({ message: "Something went wrong while converting the PDF." });
  })

  } catch (error) {
    console.log(error);
  }
  finally{
    cleanupFolder(req.uniqueUploadDir);
  }
 

}

const unlock_pdf = async (req,res) => {
  try {
    
    const instance = new ILovePDFApi(PUBLIC_KEY, SECRET_KEY);
    const task = instance.newTask('unlock');
    const file = new ILovePDFFile(path.resolve(req.file.path));

    task.start()
    .then((data) => {
      return task.addFile(file);  
    })
    .then(() => {
      return task.process();
    })
    .then(() => {
      return task.download();
    })
    .then((data) => {
      
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=compressed.pdf");
    res.send(Buffer.from(data))
  })
  .catch((error) => {
    console.log("there is the error in unlocking the pdf");
    res.status(500).json({ message: "Something went wrong while unlocking the PDF." });
  })

  } catch (error) {
    console.log(error);
  }
  finally{
    cleanupFolder(req.uniqueUploadDir);
  }
 

}

const protect_pdf = async (req,res) => {
  try {
    
    const instance = new ILovePDFApi(PUBLIC_KEY, SECRET_KEY);
    const task = instance.newTask('protect');
    const file = new ILovePDFFile(path.resolve(req.file.path));
    const password = req.body.password;
    
    task.start()
    .then((data) => {
      return task.addFile(file);  
    })
    .then(() => {
      return task.process({ password: password });
    })
    .then(() => {
      return task.download();
    })
    .then((data) => {
      
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=compressed.pdf");
    res.send(Buffer.from(data))
  })
  .catch((error) => {
    console.log("there is the erorr in protectting the pdf");
    res.status(500).json({ message: "Something went wrong while protecting the PDF." });
  })

  } catch (error) {
    console.log(error);
  }
  finally{
    cleanupFolder(req.uniqueUploadDir);
  }
 

}

const remove_pdf_pages = async (req, res) => {
  try {
    const pdfFile = req.file;
    const pagesJSON = req.body.pages;
    const uploadFolder = req.uniqueUploadDir;

    // Step 1: Validate input
    if (!pdfFile) {
      return res.status(400).json({ error: "❌ No PDF file uploaded." });
    }

    if (!pagesJSON) {
      return res.status(400).json({ error: "❌ 'pages' field is required in the request body." });
    }

    let pageNumbersToRemove;
    try {
      pageNumbersToRemove = JSON.parse(pagesJSON);
    } catch (parseErr) {
      return res.status(400).json({ error: "❌ 'pages' must be a valid JSON array." });
    }

    if (!Array.isArray(pageNumbersToRemove) || pageNumbersToRemove.length === 0) {
      return res.status(400).json({ error: "❌ 'pages' must be a non-empty array of page numbers." });
    }

    // Step 2: Load the PDF
    let pdfBytes;
    try {
      pdfBytes = await fs.promises.readFile(pdfFile.path);
    } catch (readErr) {
      console.error("📂 Error reading uploaded PDF:", readErr);
      return res.status(500).json({ error: "❌ Failed to read the uploaded PDF file." });
    }

    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(pdfBytes);
    } catch (loadErr) {
      console.error("📄 Error loading PDF:", loadErr);
      return res.status(400).json({ error: "❌ The uploaded file is not a valid PDF." });
    }

    const totalPages = pdfDoc.getPageCount();

    // Step 3: Prepare remove set
    const removeSet = new Set(
      pageNumbersToRemove
        .filter(p => typeof p === "number" && p > 0 && p <= totalPages)
        .map(p => p - 1) // Convert to 0-based
    );

    if (removeSet.size === 0) {
      return res.status(400).json({
        error: `❌ Invalid page selection. The PDF has ${totalPages} pages.`,
      });
    }

    // Step 4: Determine pages to keep
    const keepPages = [];
    for (let i = 0; i < totalPages; i++) {
      if (!removeSet.has(i)) {
        keepPages.push(i);
      }
    }

    if (keepPages.length === 0) {
      return res.status(400).json({
        error: "❌ All pages selected for removal. Nothing left to keep.",
      });
    }

    // Step 5: Create new PDF with remaining pages
    const newPdfDoc = await PDFDocument.create();
    const copiedPages = await newPdfDoc.copyPages(pdfDoc, keepPages);
    copiedPages.forEach(p => newPdfDoc.addPage(p));

    const newPdfBytes = await newPdfDoc.save();

    // Step 6: Send response
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=without_selected_pages.pdf");
    res.send(Buffer.from(newPdfBytes));
  } catch (error) {
    console.error("🔥 Unexpected error while processing PDF:", error);
    res.status(500).json({ error: "❌ Internal server error. Please try again later." });
  } finally {
    // Step 7: Cleanup
    if (req?.uniqueUploadDir && fs.existsSync(req.uniqueUploadDir)) {
      fs.rm(req.uniqueUploadDir, { recursive: true, force: true }, (err) => {
        if (err) {
          console.error("🧹 Error deleting temp folder:", err);
        } else {
          console.log("🧹 Temp folder deleted:", req.uniqueUploadDir);
        }
      });
    }
  }
};

const add_page_no = async (req, res) => {
  try {
    
    const pdfFile = req.file;
    const position = req.body.page_no_position || "bottom-right";
    const uploadFolder = req.uniqueUploadDir;

    if (!pdfFile) {
      return res.status(400).json({ error: "❌ No PDF file uploaded." });
    }

    let pdfBytes;
    try {
      pdfBytes = await fs.promises.readFile(pdfFile.path);
    } catch (err) {
      console.error("📂 Error reading uploaded PDF:", err);
      return res.status(500).json({ error: "❌ Failed to read the uploaded PDF file." });
    }

    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(pdfBytes);
    } catch (err) {
      console.error("📄 Error loading PDF:", err);
      return res.status(400).json({ error: "❌ Uploaded file is not a valid PDF." });
    }

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12; // Normal default size
    const { r, g, b } = hexToRgb("#000000"); // Black

    pages.forEach((page, index) => {
      const { width, height } = page.getSize();
      const text = `${index + 1}`;
      let x = 0;
      let y = 0;

      switch (position) {
        case "bottom-left":
          x = 30;
          y = 20;
          break;
        case "bottom-center":
          x = width / 2 - (fontSize * text.length) / 4;
          y = 20;
          break;
        case "bottom-right":
          x = width - (fontSize * text.length);
          y = 20;
          break;
        case "top-left":
          x = 30;
          y = height - fontSize - 10;
          break;
        case "top-center":
          x = width / 2 - (fontSize * text.length) / 4;
          y = height - fontSize - 10;
          break;
        case "top-right":
          x = width - (fontSize * text.length);
          y = height - fontSize - 10;
          break;
        default:
          x = width - (fontSize * text.length);
          y = 20;
      }

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(r, g, b),
      });
    });

    const newPdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=with_page_numbers.pdf");
    res.send(Buffer.from(newPdfBytes));
  } catch (error) {
    console.error("🔥 Unexpected error while adding page numbers:", error);
    res.status(500).json({ error: "❌ Internal server error. Please try again later." });
  } finally {
    if (req?.uniqueUploadDir && fs.existsSync(req.uniqueUploadDir)) {
      fs.rm(req.uniqueUploadDir, { recursive: true, force: true }, (err) => {
        if (err) {
          console.error("🧹 Error deleting temp folder:", err);
        } else {
          console.log("🧹 Temp folder deleted:", req.uniqueUploadDir);
        }
      });
    }
  }
};

const add_water_mark = async (req, res) => {
  try {
    const pdfFile = req.file;
    const position = req.body.water_mark_position || "center";
    const watermarkText = req.body.water_mark_text || "Watermark";
    const uploadFolder = req.uniqueUploadDir;

    if (!pdfFile) {
      return res.status(400).json({ error: "❌ No PDF file uploaded." });
    }

    let pdfBytes;
    try {
      pdfBytes = await fs.promises.readFile(pdfFile.path);
    } catch (err) {
      console.error("📂 Error reading uploaded PDF:", err);
      return res.status(500).json({ error: "❌ Failed to read the uploaded PDF file." });
    }

    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(pdfBytes);
    } catch (err) {
      console.error("📄 Error loading PDF:", err);
      return res.status(400).json({ error: "❌ Uploaded file is not a valid PDF." });
    }

    const pages = pdfDoc.getPages();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 36;
    const { r, g, b } = hexToRgb("#cccccc"); // Light gray watermark

    pages.forEach((page) => {
      const { width, height } = page.getSize();
      let x = 0;
      let y = 0;

      switch (position) {
        case "top-left":
          x = 50;
          y = height - 50;
          break;
        case "top-right":
          x = width - (fontSize * watermarkText.length * 0.6);
          y = height - 50;
          break;
        case "bottom-left":
          x = 50;
          y = 50;
          break;
        case "bottom-right":
          x = width - (fontSize * watermarkText.length * 0.6);
          y = 50;
          break;
        case "center":
        default:
          x = width / 2 - (fontSize * watermarkText.length) / 4;
          y = height / 2;
      }

      page.drawText(watermarkText, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(r, g, b),
        rotate: { type: "degrees", angle: 45 }, // Angled watermark
        opacity: 0.4,
      });
    });

    const newPdfBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=with_watermark.pdf");
    res.send(Buffer.from(newPdfBytes));
  } catch (error) {
    console.error("🔥 Unexpected error while adding watermark:", error);
    res.status(500).json({ error: "❌ Internal server error. Please try again later." });
  } finally {
    if (req?.uniqueUploadDir && fs.existsSync(req.uniqueUploadDir)) {
      fs.rm(req.uniqueUploadDir, { recursive: true, force: true }, (err) => {
        if (err) {
          console.error("🧹 Error deleting temp folder:", err);
        } else {
          console.log("🧹 Temp folder deleted:", req.uniqueUploadDir);
        }
      });
    }
  }
};

export { 
      merge,
      split,
      extract,
      jpgToPdf,
      pdfToJpg,
      compress,
      word_to_pdf,
      pdf_to_pdfa,
      unlock_pdf,
      protect_pdf,
      remove_pdf_pages,
      add_page_no,
      add_water_mark
    };
