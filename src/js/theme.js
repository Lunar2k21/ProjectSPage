let currentIndex =
  localStorage.getItem("currentIndex") ||
  document.currentScript.getAttribute("currentIndex");
currentIndex = parseInt(currentIndex);

const images = ["cover1.jpg", "cover2.jpg", "cover3.jpg"];
const backgrounds = ["background1.svg", "background2.svg", "background3.svg"];
const colorSets = [
  {
    "--text-color": "#f6f6f6",
    "--hover-color": "#fc4c01",
    "--accent-color": "#fc4c01",
    "--accent-color-2": "#fc4c01",
    "--background-color": "#161c31",
  },
  {
    "--text-color": "#f6f6f6",
    "--hover-color": "#fab387",
    "--accent-color": "#fab387",
    "--accent-color-2": "#fab387",
    "--background-color": "#1e1e2e",
  },
  {
    "--text-color": "#f6f6f6",
    "--hover-color": "#f9e2af",
    "--accent-color": "#f9e2af",
    "--accent-color-2": "#f9e2af",
    "--background-color": "#11111b",
  },
];

function preloadImages() {
  for (let i = 0; i < images.length; i++) {
    const img = new Image();
    img.src = "/src/images/" + images[i];
  }
  for (let i = 0; i < backgrounds.length; i++) {
    const bg = new Image();
    bg.src = "../src/bgs/" + backgrounds[i];
  }
}

function nextImage() {
  currentIndex = (currentIndex + 1) % images.length;
  localStorage.setItem("currentIndex", currentIndex); // Update currentIndex in localStorage
  const imageElement = document.getElementById("carouselImage");
  imageElement.style.opacity = 0;
  updateColors(currentIndex);
  updateBackground(currentIndex);

  setTimeout(() => {
    imageElement.src = "../src/images/" + images[currentIndex];
    imageElement.style.opacity = 1;
  }, 200); // Match the transition duration in style.css
}

function updateColors() {
  const colorSet = colorSets[currentIndex];
  // Iterate through the colorSet and set the CSS variables
  for (const [property, value] of Object.entries(colorSet)) {
    document.documentElement.style.setProperty(property, value);
  }
}

function updateBackground() {
  document.documentElement.style.backgroundImage =
    "url('../src/bgs/" + backgrounds[currentIndex] + "')";
}

// Set colors with current index first
updateColors(currentIndex);

// Set the initial image
document.getElementById("carouselImage").src =
  "../src/images/" + images[currentIndex];

// Set the initial background
updateBackground(currentIndex);

// Image is opacity 0 and text is translated off screen by default
// Add the loaded class to the image and text to animate them in
window.onload = function () {
  document.getElementById("image").classList.add("loaded");
  document.getElementById("text").classList.add("loaded");
  document.getElementsByTagName("html")[0].classList.add("loaded");
  // Preload the remaining images and backgrounds
  preloadImages();
};
