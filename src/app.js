import express from "express"
import cors from 'cors'
const app = express();
import { apiLimiter } from "./middleware/rateLimit.js";
const allowedOrigins  = process.env.CORS_ORIGIN?.split(",") || [];

const corsOptions = {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  };

app.use(cors(corsOptions))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true,limit: "16kb"}))
app.use(express.static('public'))
app.use("/api", apiLimiter);




// app.use((err, req, res, next) => {
//   if (err.code === 'LIMIT_FILE_SIZE') {
//     res.setHeader("Content-Type", "application/json");
//     return res.status(413).json({ error: "File size exceeds limit (Max 50MB allowed)" });
//   }

//   if (err.code === 'LIMIT_UNEXPECTED_FILE') {
//     res.setHeader("Content-Type", "application/json");
//     return res.status(400).json({ error: "Only 5 PDF files allowed at a time." });
//   }

//   if (err.message === "uploaded file is not pdf") {
//     res.setHeader("Content-Type", "application/json");
//     return res.status(400).json({ error: "Only PDF files are allowed" });
//   }

//   console.error("Unhandled Error:", err);
//   res.setHeader("Content-Type", "application/json");
//   res.status(500).json({ error: "Something went wrong on server" });
// });


// imports route
import { pdfRouter } from "./routes/pdf.routes.js";

// routes declaration
app.use("/api/v1/pdf",pdfRouter);

export {app}

