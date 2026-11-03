const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const port = 3000;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function readData() {
	try {
		return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
	} catch {
		return { people: [] };
	}
}

app.get("/api/people", async (req, res) => {
	const data = await readData();
	res.json(data.people);
});

app.put("/api/people", async (req, res) => {
	const { people } = req.body;
	if (!Array.isArray(people) || !people.every((p) => typeof p === "string")) {
		return res
			.status(400)
			.json({ error: "people must be an array of strings" });
	}
	await fs.writeFile(DATA_FILE, JSON.stringify({ people }, null, 2));
	res.json({ ok: true });
});

app.listen(port, () => {
	console.log(`Listening on port ${port}`);
});
