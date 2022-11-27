const express = require("express");
const dotenv = require("dotenv");
const chats = require("./data/data");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");

dotenv.config();
connectDB();
const app = express();

app.use(express.json());
 
app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.use("/api/user", userRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, console.log(`Server started on PORT ${PORT}`));
