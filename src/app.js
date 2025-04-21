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


// app.use((err,req,res,next)=>{
//     console.log(err.message);
//     res.status(404).json({
//       msg:err.message
//     })
//   })

// imports route
import { pdfRouter } from "./routes/pdf.routes.js";

// routes declaration
app.use("/api/v1/pdf",pdfRouter);

export {app}

