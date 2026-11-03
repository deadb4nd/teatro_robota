async function loadPeople() {
	try {
		const r = await fetch("/api/people");
		if (!r.ok) throw new Error();
		return await r.json();
	} catch {
		return null; // server unreachable
	}
}
async function savePeople() {
	try {
		await fetch("/api/people", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ people: st.people }),
		});
	} catch (e) {}
}

const ROLES = [
	["BAR", 6],
	["KEL", 4],
	["BAK", 4],
	["PROMO", 1],
];
const DAYS = [
	["f", "Piątek"],
	["s", "Sobota"],
];
const QUICK = [
	"16:00",
	"16:30",
	"17:00",
	"17:30",
	"18:00",
	"18:30",
	"19:00",
	"19:30",
	"20:00",
	"20:30",
	"21:00",
	"21:30",
	"22:00",
	"22:30",
	"23:00",
];
const KEY = "staff-schedule-v1";
const TIME = /^\d\d:\d\d$/;
const fresh = () => ({
	people: ["Mimi", "Haja", "Pupka", "Pupeczka", "Kupeczka", "Kupulutka"],
	slots: Object.fromEntries(
		ROLES.map(([r, n]) => [
			r,
			Array.from({ length: n }, () => ({
				n: "",
				f: "",
				s: "",
			})),
		]),
	),
});
let st = fresh();
try {
	const o = JSON.parse(localStorage.getItem(KEY) || "null");
	if (o && Array.isArray(o.people) && o.slots) {
		st.people = o.people;
		ROLES.forEach(([r, n]) => {
			for (let i = 0; i < n; i++) {
				const x = (o.slots[r] || [])[i];
				if (x)
					st.slots[r][i] = {
						n: x.n || "",
						f: x.f || "",
						s: x.s || "",
					};
			}
		});
	}
} catch (e) {}
const save = () => {
	try {
		localStorage.setItem(KEY, JSON.stringify(st));
	} catch (e) {}
};

const body = document.getElementById("body");
const cell = (cls, area) => {
	const d = document.createElement("div");
	d.className = "c " + cls;
	d.style.gridArea = area;
	return d;
};

function renderGrid() {
	body.innerHTML = "";
	const count = {};
	ROLES.forEach(([r]) =>
		st.slots[r].forEach((x) => {
			if (x.n) count[x.n] = (count[x.n] || 0) + 1;
		}),
	);
	let row = 3;
	ROLES.forEach(([r, n]) => {
		st.slots[r].forEach((slot, i) => {
			const base = "r-" + r + (i === 0 ? " g" : "");
			if (i === 0) {
				const t = cell(
					"role r-" + r + " g" + (n === 1 ? " one" : ""),
					row + " / 1 / span " + n + " / 2",
				);
				const s = document.createElement("span");
				s.textContent = r;
				t.appendChild(s);
				body.appendChild(t);
			}
			const nm = cell("nm " + base, row + " / 2 / " + (row + 1) + " / 3");
			const sel = document.createElement("select");
			sel.setAttribute("aria-label", r + " " + (i + 1) + " name");
			sel.add(new Option("Wybierz imię", ""));
			st.people.forEach((p) => sel.add(new Option(p, p)));
			sel.value = slot.n;
			sel.className =
				(slot.n ? "" : "empty") + (slot.n && count[slot.n] > 1 ? " dup" : "");
			sel.onchange = () => {
				slot.n = sel.value;
				if (!slot.n) {
					slot.f = "";
					slot.s = "";
				}
				save();
				renderGrid();
			};
			nm.appendChild(sel);
			body.appendChild(nm);
			DAYS.forEach(([k, label], di) => {
				const td = cell(
					"dy " + base,
					row + " / " + (3 + di) + " / " + (row + 1) + " / " + (4 + di),
				);
				const b = document.createElement("button");
				b.type = "button";
				const v = slot[k];
				b.className =
					"day " + (TIME.test(v) ? "set" : v === "-" ? "off" : "unset");
				b.textContent = TIME.test(v) ? v : v === "-" ? "OFF" : "+";
				b.disabled = !slot.n;
				b.setAttribute(
					"aria-label",
					(slot.n || "Empty slot") +
						" " +
						label +
						": " +
						(TIME.test(v) ? v : v === "-" ? "off" : "not set"),
				);
				b.onclick = () => openSheet(slot, k, slot.n + " · " + label);
				td.appendChild(b);
				body.appendChild(td);
			});
			row++;
		});
	});
	DAYS.forEach(([k]) => {
		let w = 0;
		ROLES.forEach(([r]) =>
			st.slots[r].forEach((x) => {
				if (TIME.test(x[k])) w++;
			}),
		);
		document.getElementById(k === "f" ? "cf" : "cs").innerHTML =
			w + '<span class="wd"> osób</span>';
	});
}
function renderChips() {
	const c = document.getElementById("chips");
	c.innerHTML = "";
	st.people.forEach((p) => {
		const d = document.createElement("span");
		d.className = "chip";
		d.append(p);
		const b = document.createElement("button");
		b.type = "button";
		b.textContent = "×";
		b.setAttribute("aria-label", "Remove " + p);
		b.onclick = () => {
			st.people = st.people.filter((x) => x !== p);
			ROLES.forEach(([r]) =>
				st.slots[r].forEach((x) => {
					if (x.n === p) {
						x.n = "";
						x.f = "";
						x.s = "";
					}
				}),
			);
			save();
			renderAll();
		};
		d.appendChild(b);
		c.appendChild(d);
	});
}
function renderAll() {
	renderGrid();
	renderChips();
}

// bottom sheet
const dlg = document.getElementById("dlg"),
	dTimes = document.getElementById("dTimes"),
	dCustom = document.getElementById("dCustom");
let cur = null;
function apply(v) {
	if (!cur) return;
	cur.slot[cur.k] = v;
	save();
	renderGrid();
	dlg.close();
}
QUICK.forEach((t) => {
	const b = document.createElement("button");
	b.type = "button";
	b.textContent = t;
	b.dataset.t = t;
	b.onclick = () => apply(t);
	dTimes.appendChild(b);
});
function openSheet(slot, k, title) {
	cur = { slot, k };
	document.getElementById("dTitle").textContent = title;
	const v = slot[k];
	dCustom.value = TIME.test(v) ? v : "";
	dTimes
		.querySelectorAll("button")
		.forEach((b) => b.classList.toggle("on", b.dataset.t === v));
	dlg.showModal();
}
document.getElementById("dSet").onclick = () => {
	if (TIME.test(dCustom.value)) apply(dCustom.value);
};
document.getElementById("dOff").onclick = () => apply("-");
document.getElementById("dClear").onclick = () => apply("");
document.getElementById("dClose").onclick = () => dlg.close();
dlg.addEventListener("click", (e) => {
	if (e.target === dlg) dlg.close();
});

document.getElementById("addForm").addEventListener("submit", (e) => {
	e.preventDefault();
	const inp = document.getElementById("newName");
	inp.value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean)
		.forEach((n) => {
			if (!st.people.some((p) => p.toLowerCase() === n.toLowerCase()))
				st.people.push(n);
		});
	inp.value = "";
	st.people.sort((a, b) => a.localeCompare(b));
	save();
	savePeople();
	renderAll();
	inp.focus();
});
document.getElementById("clearBtn").onclick = () => {
	if (
		!confirm("Clear all names and times from the grid? The people list stays.")
	)
		return;
	ROLES.forEach(([r]) =>
		st.slots[r].forEach((x) => {
			x.n = "";
			x.f = "";
			x.s = "";
		}),
	);
	save();
	savePeople();
	renderAll();
};

// screenshot view: shrink rows until the whole grid fits the screen
function fitShot() {
	if (!document.body.classList.contains("shot")) return;
	const w = document.querySelector(".wrap");
	let rh = 34;
	do {
		document.body.style.setProperty("--rh", rh + "px");
		rh--;
	} while (
		rh >= 18 &&
		w.getBoundingClientRect().bottom + 8 > window.innerHeight
	);
}
document.getElementById("shotBtn").onclick = () => {
	document.body.classList.add("shot");
	window.scrollTo(0, 0);
	fitShot();
};
document.querySelector(".wrap").addEventListener("click", () => {
	document.body.classList.remove("shot");
});
window.addEventListener("resize", fitShot);
renderAll();
(async () => {
	const people = await loadPeople();
	if (people && people.length) {
		st.people = people;
		save();
		renderAll();
	} else if (people) {
		savePeople();
	}
})();
