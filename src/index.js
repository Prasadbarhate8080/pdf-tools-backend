import { app } from "./app.js";
import dotenv from 'dotenv'

dotenv.config({
    path:'../.env'
})

try {
    app.on("error",(error) => {
        console.log("ERROR",error);
        throw error
    })

    app.listen(process.env.PORT,() => {
        console.log(`App is listening on port ${process.env.PORT}`);
        
    })
} catch (error) {
    console.log("ERROR",error);
}