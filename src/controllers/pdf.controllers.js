import fs from "fs";
import { type } from "os";
import path from "path";
import { PDFDocument } from "pdf-lib";


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
    res.send(Buffer.from(mergedPdfBytes));
  } catch (error) {
    console.log("Error in MERGING  the pdfs", error);
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

    // 🧹 Clean up upload folder
    fs.rm(uploadFolder, { recursive: true, force: true }, (err) => {
      if (err) {
        console.error("❌ Error deleting folder:", err);
      } else {
        console.log("✅ Folder deleted successfully:", uploadFolder);
      }
    });

  } catch (error) {
    console.error("❌ Error in jpgToPdf:", error);
    res.status(500).send("Error converting images to PDF");
  }
};


const pdfToJpg = async (req, res) => {
  res.send("prasad");
}

export { merge, split, extract, jpgToPdf, pdfToJpg };
