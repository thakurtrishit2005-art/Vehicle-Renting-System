
"use strict";

// Set window.VELORENT_API_URL in frontend/config.js for deployment.
// Example: "https://your-backend.onrender.com"
// Local development uses the C++ backend on port 18080.
const API_SERVER_URL = (
  window.VELORENT_API_URL || "http://localhost:18080"
).replace(/\/+$/, "");

const API_BASE_URL = `${API_SERVER_URL}/api`;

// Keep the admin key in memory only; never hardcode it in this file.
let adminApiKey = "";

function getAdminApiKey() {
  if (adminApiKey) {
    return adminApiKey;
  }

  const enteredKey = window.prompt(
    "Enter the admin API key to manage vehicle inventory:"
  );

  if (!enteredKey || !enteredKey.trim()) {
    throw new Error("Admin key is required to add a vehicle.");
  }

  adminApiKey = enteredKey.trim();
  return adminApiKey;
}

function clearAdminApiKey() {
  adminApiKey = "";
}

function adminHeaders(extraHeaders = {}) {
  return {
    ...extraHeaders,
    "X-Admin-Key": getAdminApiKey()
  };
}

// Presentation information not yet stored in the database.
// Vehicle prices, names, categories and availability come from the API.
const vehiclePresentation = {
  "DEMO-CAR-001": {
    seats: 5,
    engineCC: null,
    description: "A practical compact car for everyday city travel.",
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=900&q=80",
    icon: "🚗"
  },
  "DEMO-CAR-002": {
    seats: 5,
    engineCC: null,
    description: "A comfortable hatchback for daily journeys.",
    image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80",
    icon: "🚗"
  },
  "DEMO-SUV-001": {
    seats: 5,
    engineCC: null,
    description: "A versatile SUV for family trips and weekend drives.",
    image: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=900&q=80",
    icon: "🚙"
  },
  "DEMO-SUV-002": {
    seats: 7,
    engineCC: null,
    description: "A spacious SUV for group travel and longer routes.",
    image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=900&q=80",
    icon: "🚙"
  },
  "DEMO-BIKE-001": {
    seats: 2,
    engineCC: 110,
    description: "An easy-to-use scooter for local trips.",
    image: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80",
    icon: "🛵"
  },
  "DEMO-BIKE-002": {
    seats: 2,
    engineCC: 350,
    description: "A classic-style motorcycle for leisure rides.",
    image: "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=900&q=80",
    icon: "🏍️"
  },
  "DEMO-CAR-003": {
    seats: 5,
    engineCC: null,
    description: "A compact SUV for daily travel and family outings.",
    image: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=900&q=80",
    icon: "🚙"
  },
  "DEMO-VAN-001": {
    seats: 12,
    engineCC: null,
    description: "A people carrier for group outings and travel.",
    image: "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=900&q=80",
    icon: "🚐"
  }
};

// Populated from the API when the page loads.
let vehicles = [];

const state = {
  category: "All",
  search: "",
  sort: "recommended",
  selectedVehicle: null
};

const vehicleGrid = document.getElementById("vehicleGrid");
const resultsCount = document.getElementById("resultsCount");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const bookingDialog = document.getElementById("bookingDialog");
const bookingForm = document.getElementById("bookingForm");
const bookingResult = document.getElementById("bookingResult");
const selectedVehicleElement = document.getElementById("selectedVehicle");
const bookingVehicleCode = document.getElementById("bookingVehicleCode");
const pickupDateInput = document.getElementById("pickupDate");
const returnDateInput = document.getElementById("returnDate");
const estimatedDays = document.getElementById("estimatedDays");
const estimatedTotal = document.getElementById("estimatedTotal");
const formError = document.getElementById("formError");
const toast = document.getElementById("toast");

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

function formatCurrency(amount) {
  return currencyFormatter.format(amount);
}

// Convert a database API record into the frontend's vehicle format.
function mapApiVehicle(apiVehicle) {
  const code = apiVehicle.vehicle_code;
  const presentation = vehiclePresentation[code] || {};

  const savedImage = apiVehicle.image_url || "";

  const image = savedImage
    ? (/^https?:\/\//i.test(savedImage)
        ? savedImage
        : `${API_SERVER_URL}${savedImage}`)
    : (presentation.image || "");

  return {
    code,
    brand: apiVehicle.brand,
    model: apiVehicle.model,
    category: apiVehicle.category,
    price: Number(apiVehicle.daily_rate),
    isAvailable: apiVehicle.is_available === true,
    seats: apiVehicle.seats ?? presentation.seats ?? 5,
    engineCC: apiVehicle.engine_cc ?? presentation.engineCC ?? null,
    description:
      apiVehicle.description || presentation.description ||
      "Contact us for more information about this vehicle.",
    image,
    icon: presentation.icon || "🚘"
  };
}

// Fetch real inventory from the C++ API.
async function loadVehicles() {
  resultsCount.textContent = "Loading vehicle inventory...";

  try {
    const response = await fetch(`${API_BASE_URL}/vehicles`);

    if (!response.ok) {
      throw new Error(`Vehicle API returned HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.vehicles)) {
      throw new Error("The API response does not contain a vehicle list.");
    }

    vehicles = data.vehicles.map(mapApiVehicle);
    renderVehicles();

    if (vehicles.length === 0) {
      showToast("The database currently contains no vehicles.");
    }
  } catch (error) {
    console.error("Unable to load vehicle inventory:", error);

    vehicles = [];
    renderVehicles();

    resultsCount.textContent = "Vehicle inventory unavailable";
    showToast(
      "Cannot load vehicles. Check that the backend URL is correct and the API is running."
    );
  }
}

// Format a local calendar date without converting it to UTC.
function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getToday() {
  return localDateString(new Date());
}

function getTomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return localDateString(date);
}

function getRentalDays(startValue, endValue) {
  if (!startValue || !endValue) {
    return 0;
  }

  const start = new Date(`${startValue}T00:00:00`);
  const end = new Date(`${endValue}T00:00:00`);
  const difference = end.getTime() - start.getTime();

  return Number.isFinite(difference) && difference > 0
    ? Math.round(difference / 86400000)
    : 0;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");

  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 3500);
}

function getFilteredVehicles() {
  let filtered = vehicles.filter((vehicle) => {
    const matchesCategory =
      state.category === "All" ||
      vehicle.category === state.category;

    const searchableText = [
      vehicle.code,
      vehicle.brand,
      vehicle.model,
      vehicle.category,
      vehicle.description
    ].join(" ").toLowerCase();

    const matchesSearch = searchableText.includes(
      state.search.trim().toLowerCase()
    );

    return matchesCategory && matchesSearch;
  });

  if (state.sort === "price-low") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (state.sort === "price-high") {
    filtered.sort((a, b) => b.price - a.price);
  } else if (state.sort === "name") {
    filtered.sort((a, b) =>
      `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`)
    );
  }

  return filtered;
}

function createVehicleCard(vehicle) {
  const card = document.createElement("article");
  card.className = "vehicle-card";

  const imageWrap = document.createElement("div");
  imageWrap.className = "vehicle-image-wrap";

  if (vehicle.image) {
    const image = document.createElement("img");
    image.className = "vehicle-image";
    image.src = vehicle.image;
    image.alt = `${vehicle.brand} ${vehicle.model}`;
    image.loading = "lazy";
    image.decoding = "async";

    image.addEventListener("error", () => {
      image.removeAttribute("src");
      image.alt = "Vehicle image unavailable";
      image.style.display = "none";
      imageWrap.style.background =
        "linear-gradient(135deg, #dfe7d7, #aab9a0)";
    }, { once: true });

    imageWrap.appendChild(image);
  }

  const categoryTag = document.createElement("span");
  categoryTag.className = "category-tag";
  categoryTag.textContent = vehicle.category;

  const availabilityTag = document.createElement("span");
  availabilityTag.className = "availability-tag";
  availabilityTag.textContent = vehicle.isAvailable
    ? "Available"
    : "Unavailable";

  imageWrap.append(categoryTag, availabilityTag);

  const content = document.createElement("div");
  content.className = "vehicle-card-content";

  const code = document.createElement("div");
  code.className = "vehicle-code";
  code.textContent = vehicle.code;

  const titleRow = document.createElement("div");
  titleRow.className = "vehicle-title-row";

  const title = document.createElement("h3");
  title.className = "vehicle-title";
  title.textContent = `${vehicle.brand} ${vehicle.model}`;

  const typeIcon = document.createElement("span");
  typeIcon.className = "vehicle-type-icon";
  typeIcon.setAttribute("aria-hidden", "true");
  typeIcon.textContent = vehicle.icon;

  titleRow.append(title, typeIcon);

  const description = document.createElement("p");
  description.className = "vehicle-description";
  description.textContent = vehicle.description;

  const specs = document.createElement("div");
  specs.className = "vehicle-specs";

  const seats = document.createElement("span");
  seats.className = "vehicle-spec";
  seats.textContent = `${vehicle.seats} seats`;
  specs.appendChild(seats);

  if (vehicle.engineCC !== null) {
    const engine = document.createElement("span");
    engine.className = "vehicle-spec";
    engine.textContent = `${vehicle.engineCC} cc`;
    specs.appendChild(engine);
  }

  const footer = document.createElement("div");
  footer.className = "vehicle-card-footer";

  const priceBlock = document.createElement("div");

  const priceLabel = document.createElement("span");
  priceLabel.className = "price-label";
  priceLabel.textContent = "Starting from";

  const price = document.createElement("div");
  price.className = "vehicle-price";
  price.textContent = formatCurrency(vehicle.price);

  const perDay = document.createElement("small");
  perDay.textContent = " / day";
  price.appendChild(perDay);

  priceBlock.append(priceLabel, price);

  const bookButton = document.createElement("button");
  bookButton.type = "button";
  bookButton.className = "book-button";
  bookButton.textContent = vehicle.isAvailable
    ? "Plan rental →"
    : "Unavailable";
  bookButton.disabled = !vehicle.isAvailable;

  bookButton.setAttribute(
    "aria-label",
    vehicle.isAvailable
      ? `Plan a demo rental for ${vehicle.brand} ${vehicle.model}`
      : `${vehicle.brand} ${vehicle.model} is unavailable`
  );

  if (vehicle.isAvailable) {
    bookButton.addEventListener("click", () => openBooking(vehicle.code));
  }

  footer.append(priceBlock, bookButton);
  content.append(code, titleRow, description, specs, footer);
  card.append(imageWrap, content);

  return card;
}

function renderVehicles() {
  const filtered = getFilteredVehicles();
  vehicleGrid.replaceChildren();

  filtered.forEach((vehicle) => {
    vehicleGrid.appendChild(createVehicleCard(vehicle));
  });

  resultsCount.textContent =
    `Showing ${filtered.length} ${filtered.length === 1 ? "vehicle" : "vehicles"}`;

  vehicleGrid.classList.toggle("hidden", filtered.length === 0);
  emptyState.classList.toggle("hidden", filtered.length !== 0);
}

function updateFilterButtons() {
  document.querySelectorAll(".filter-button").forEach((button) => {
    const active = button.dataset.category === state.category;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function resetFilters() {
  state.category = "All";
  state.search = "";
  state.sort = "recommended";

  searchInput.value = "";
  sortSelect.value = "recommended";

  updateFilterButtons();
  renderVehicles();
}

function openBooking(vehicleCode) {
  const vehicle = vehicles.find((item) => item.code === vehicleCode);

  if (!vehicle) {
    showToast("That vehicle could not be found.");
    return;
  }

  if (!vehicle.isAvailable) {
    showToast("This vehicle is currently unavailable.");
    return;
  }

  state.selectedVehicle = vehicle;
  bookingForm.reset();
  bookingForm.classList.remove("hidden");
  bookingResult.classList.add("hidden");
  formError.classList.add("hidden");
  formError.textContent = "";

  bookingVehicleCode.value = vehicle.code;
  selectedVehicleElement.replaceChildren();

  if (vehicle.image) {
    const image = document.createElement("img");
    image.src = vehicle.image;
    image.alt = "";
    image.addEventListener("error", () => image.remove(), { once: true });
    selectedVehicleElement.appendChild(image);
  }

  const details = document.createElement("div");

  const title = document.createElement("strong");
  title.textContent = `${vehicle.brand} ${vehicle.model}`;

  const price = document.createElement("span");
  price.textContent =
    `${formatCurrency(vehicle.price)} per day · ${vehicle.code}`;

  details.append(title, price);
  selectedVehicleElement.appendChild(details);

  const today = getToday();
  pickupDateInput.min = today;
  returnDateInput.min = getTomorrow();

  pickupDateInput.value = today;
  returnDateInput.value = getTomorrow();

  updateEstimate();

  if (!bookingDialog.open) {
    bookingDialog.showModal();
  }

  document.body.classList.add("dialog-open");
}

function closeBooking() {
  if (bookingDialog.open) {
    bookingDialog.close();
  }

  document.body.classList.remove("dialog-open");
}

function updateEstimate() {
  const vehicle = state.selectedVehicle;
  const days = getRentalDays(
    pickupDateInput.value,
    returnDateInput.value
  );

  if (!vehicle || days < 1) {
    estimatedDays.textContent = "Choose valid dates";
    estimatedTotal.textContent = "—";
    return;
  }

  estimatedDays.textContent =
    `${days} ${days === 1 ? "day" : "days"}`;

  estimatedTotal.textContent = formatCurrency(days * vehicle.price);
}

function showFormError(message) {
  formError.textContent = message;
  formError.classList.remove("hidden");
}

// Category filters
document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.category = button.dataset.category;
    updateFilterButtons();
    renderVehicles();
  });
});

// Search and sorting
searchInput.addEventListener("input", () => {
  state.search = searchInput.value;
  renderVehicles();
});

sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value;
  renderVehicles();
});

document.getElementById("resetFilters")
  .addEventListener("click", resetFilters);

// Booking dialog controls
document.getElementById("closeDialog")
  .addEventListener("click", closeBooking);

document.getElementById("doneButton")
  .addEventListener("click", closeBooking);

bookingDialog.addEventListener("close", () => {
  document.body.classList.remove("dialog-open");
});

bookingDialog.addEventListener("click", (event) => {
  if (event.target === bookingDialog) {
    closeBooking();
  }
});

// Rental date validation and estimates
pickupDateInput.addEventListener("change", () => {
  if (pickupDateInput.value) {
    const earliestReturn =
      new Date(`${pickupDateInput.value}T00:00:00`);

    earliestReturn.setDate(earliestReturn.getDate() + 1);
    returnDateInput.min = localDateString(earliestReturn);

    if (
      !returnDateInput.value ||
      returnDateInput.value <= pickupDateInput.value
    ) {
      returnDateInput.value = returnDateInput.min;
    }
  }

  updateEstimate();
});

returnDateInput.addEventListener("change", updateEstimate);

// This form calculates a demo estimate only.
// It does not create a database booking.
bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formError.classList.add("hidden");
  formError.textContent = "";

  const vehicle = state.selectedVehicle;
  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();
  const email = document.getElementById("customerEmail").value.trim();
  const pickup = pickupDateInput.value;
  const returned = returnDateInput.value;
  const days = getRentalDays(pickup, returned);

  if (!vehicle) {
    showFormError("Please select a vehicle first.");
    return;
  }

  if (!vehicle.isAvailable) {
    showFormError("This vehicle is currently unavailable.");
    return;
  }

  if (!name || !phone) {
    showFormError("Please enter your name and phone number.");
    return;
  }

  if (pickup < getToday()) {
    showFormError("Pickup date cannot be in the past.");
    return;
  }

  if (days < 1) {
    showFormError(
      "Return date must be at least one day after pickup."
    );
    return;
  }

  if (
    email &&
    !document.getElementById("customerEmail").validity.valid
  ) {
    showFormError("Please enter a valid email address.");
    return;
  }

  const total = days * vehicle.price;

  document.getElementById("bookingResultText").textContent =
    `Demo estimate for ${vehicle.brand} ${vehicle.model}: ` +
    `${days} ${days === 1 ? "day" : "days"}, ` +
    `from ${pickup} to ${returned}, ` +
    `estimated total ${formatCurrency(total)}.`;

  bookingForm.classList.add("hidden");
  bookingResult.classList.remove("hidden");
});

// Responsive navigation
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.querySelector(".main-nav");

menuToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");

  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute(
    "aria-label",
    isOpen ? "Close navigation" : "Toggle navigation"
  );

  menuToggle.textContent = isOpen ? "×" : "☰";
});

mainNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Toggle navigation");
    menuToggle.textContent = "☰";
  });
});

// Add a vehicle: upload its image, save its details, refresh inventory.
const addVehicleForm = document.getElementById("addVehicleForm");
const vehicleImageInput = document.getElementById("vehicleImage");
const vehicleFormStatus = document.getElementById("vehicleFormStatus");
const addVehicleButton = document.getElementById("addVehicleButton");

addVehicleForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  vehicleFormStatus.textContent = "";
  addVehicleButton.disabled = true;
  addVehicleButton.textContent = "Saving vehicle...";

  let uploadedImageURL = "";

  try {
    // Prompt for the admin key when needed.
    getAdminApiKey();

    const formData = new FormData(addVehicleForm);
    const imageFile = vehicleImageInput.files[0];

    if (!imageFile) {
      throw new Error("Please select a vehicle image.");
    }

    if (imageFile.size > 5 * 1024 * 1024) {
      throw new Error("The image must be 5 MB or smaller.");
    }

    const imageFormData = new FormData();
    imageFormData.append("image", imageFile);

    const uploadResponse = await fetch(
      `${API_BASE_URL}/upload-image`,
      {
        method: "POST",
        headers: adminHeaders(),
        body: imageFormData
      }
    );

    const uploadResult = await uploadResponse.json();

    if (uploadResponse.status === 401) {
      clearAdminApiKey();
      throw new Error(
        "Admin key rejected. Submit the form again and enter the correct key."
      );
    }

    if (!uploadResponse.ok) {
      throw new Error(
        uploadResult.error || `Image upload failed (HTTP ${uploadResponse.status}).`
      );
    }

    uploadedImageURL = uploadResult.image_url;

    const vehicleData = {
      brand: formData.get("brand").trim(),
      model: formData.get("model").trim(),
      category: formData.get("category"),
      daily_rate: Number(formData.get("daily_rate")),
      seats: Number(formData.get("seats")),
      engine_cc: Number(formData.get("engine_cc")) || 0,
      description: formData.get("description").trim(),
      image_url: uploadedImageURL
    };

    const response = await fetch(`${API_BASE_URL}/vehicles`, {
      method: "POST",
      headers: adminHeaders({
        "Content-Type": "text/plain"
      }),
      body: JSON.stringify(vehicleData)
    });

    const result = await response.json();

    if (response.status === 401) {
      clearAdminApiKey();
      throw new Error(
        "Admin key rejected. Submit the form again and enter the correct key."
      );
    }

    if (!response.ok) {
      throw new Error(
        result.error || `Could not save vehicle (HTTP ${response.status}).`
      );
    }

    addVehicleForm.reset();
    await loadVehicles();

    vehicleFormStatus.textContent =
      `Vehicle added successfully. Code: ${result.vehicle_code}`;

    showToast("Vehicle added to the inventory.");
    document.getElementById("vehicles").scrollIntoView({
      behavior: "smooth"
    });
  } catch (error) {
    console.error("Vehicle creation failed:", error);

    vehicleFormStatus.textContent = `Error: ${error.message}`;
    showToast(error.message);

    if (uploadedImageURL) {
      vehicleFormStatus.textContent +=
        " The image may have uploaded successfully; check the inventory before retrying.";
    }
  } finally {
    addVehicleButton.disabled = false;
    addVehicleButton.textContent = "Upload image and add vehicle →";
  }
});

// Initial setup
pickupDateInput.min = getToday();
returnDateInput.min = getTomorrow();
updateFilterButtons();
loadVehicles();
