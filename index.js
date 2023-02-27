import express, { request } from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import redis from "redis";

const app = express();
// const client = redis.createClient(process.env.REDIS_URL);
// sayhuan99, 123123qweqwe
dotenv.config();

app.use(express.json({ extended: true, limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));
app.use(cors());

app.get("/", (req, res) => {
  res.send("APP IS RUNNING!!!");
});

const codeSnippetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  purpose: { type: String, required: true },
  type: { type: String, required: true },
  language: { type: String, required: true },
  codes: { type: String, required: true },
  output: { type: String, required: true },
  tags: [String],
  isFeatured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const CodeSnippet = mongoose.model("CodeSnippet", codeSnippetSchema);

// Add New Code Snippet
app.post("/code-snippet/add", async (req, res) => {
  const newCodeSnippet = new CodeSnippet(req.body);
  try {
    const result = await newCodeSnippet.save();
    res.json(result);
  } catch (error) {
    res.json({ error: error.errors });
  }
});

// Code Snippet Listing
app.post("/code-snippet/listing-redis", async (req, res) => {
  const r = req.body;
  try {
    const fieldsToSearch = ["name", "purpose", "type"].map((s) => ({ [s]: { $regex: r.search, $options: "i" } }));
    const tags = (r.tags.trim() && r.tags.split(",")) || [];

    let filter = {
      ...(r.type && { type: r.type }),
      ...(r.language && { language: r.language }),
      ...(r.search && { $or: fieldsToSearch }),
      ...(tags.length > 0 && { tags: { $in: tags } }),
    };

    const page = parseInt(r.page) || 1;
    const limit = parseInt(r.limit) || 3;
    const skip = page - 1 > 0 ? (page - 1) * limit : 0;
    const sort = r.sort ? { [r.sort]: r.sortDir === "desc" ? -1 : -1 } : "name";

    const cacheKey = `code-snippet-${JSON.stringify(filter)}-${sort}-${skip}-${limit}`;
    client.get(cacheKey, async (err, cachedData) => {
      if (err) throw err;
      const list = cachedData !== null ? JSON.parse(cachedData) : await CodeSnippet.find(filter).sort(sort).skip(skip).limit(limit);
      const totalPages = Math.ceil((await CodeSnippet.countDocuments(filter)) / limit);
      if (!cachedData) client.setex(cacheKey, 3600, JSON.stringify(list));

      return res.json({ list, totalPages });
    });
  } catch (error) {
    res.json({ error });
  }
});

app.post("/code-snippet/listing", async (req, res) => {
  const r = req.body;
  try {
    const fieldsToSearch = ["name", "purpose", "type"].map((s) => ({ [s]: { $regex: r.search, $options: "i" } }));
    const tags = (r.tags.trim() && r.tags.split(",")) || [];

    let filter = {
      ...(r.type && { type: r.type }),
      ...(r.language && { language: r.language }),
      ...(r.search && { $or: fieldsToSearch }),
      ...(tags.length > 0 && { tags: { $in: tags } }),
    };

    const page = parseInt(r.page) || 1;
    const limit = parseInt(r.limit) || 3;
    const skip = page - 1 > 0 ? (page - 1) * limit : 0;
    const sort = r.sort ? { [r.sort]: r.sortDir === "desc" ? -1 : -1 } : "name";
    const list = await CodeSnippet.find(filter).sort(sort).skip(skip).limit(limit);
    const totalPages = Math.ceil((await CodeSnippet.countDocuments(filter)) / limit);

    res.json({ list, totalPages });
  } catch (error) {
    res.json({ error });
  }
});

// Code Snippet Details
app.get("/code-snippet/details/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const codeSnippet = await CodeSnippet.findById(id);
    res.json({ codeSnippet });
  } catch (error) {
    res.json({ error });
  }
});

// Delete Code Snippet
app.delete("/code-snippet/delete/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const codeSnippet = await CodeSnippet.findByIdAndDelete(id);
    if (!codeSnippet) res.status(404).json({ msg: "Code Snippet Not Found" });
    res.json({ codeSnippet });
  } catch (error) {
    res.json({ error });
  }
});

// Update Code Snippet
app.post("/code-snippet/update/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const r = req.body;
    const updatedValue = {
      name: r.name,
      purpose: r.purpose,
      type: r.type,
      language: r.language,
      codes: r.codes,
      output: r.output,
      tags: r.tags,
      isFeatured: r.isFeatured,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await CodeSnippet.findByIdAndUpdate(id, updatedValue);
    console.log("test")
    res.json({ result });
  } catch (error) {
    res.json({ error });
  }
});

const PORT = process.env.PORT || 3426;

mongoose.set("strictQuery", false);
mongoose
  .connect(process.env.CONNECTION_URL)
  .then(() => app.listen(PORT, () => console.log(`SERVER RUNNING ON PORT ${PORT} 🔥`)))
  .catch((err) => console.error(err.message)); 