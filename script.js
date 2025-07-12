// Global variables
let currentMode = 1;
let expression = "";
let displayValue = "0";
let justCalculated = false;
let isCalculating = false;

// Base URL for your Flask API
const API_BASE_URL = 'http://127.0.0.1:5000';

// Initialize particles
function createParticles() {
  const particlesContainer = document.getElementById("particles");
  for (let i = 0; i < 50; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.style.left = Math.random() * 100 + "%";
    particle.style.top = Math.random() * 100 + "%";
    particle.style.animationDelay = Math.random() * 6 + "s";
    particle.style.animationDuration = Math.random() * 3 + 3 + "s";
    particlesContainer.appendChild(particle);
  }
}

// Mode selector
function selectMode(mode) {
  currentMode = mode;

  // Update slider position
  const slider = document.getElementById("modeSlider");
  slider.style.transform = `translateX(${(mode - 1) * 120}px)`;

  // Update active button
  document.querySelectorAll(".mode-btn").forEach((btn, index) => {
    btn.classList.toggle("active", index === mode - 1);
  });

  // Show/hide calculators
  document.querySelectorAll(".button-grid").forEach((grid) => {
    grid.classList.add("hidden");
  });

  const calculators = ["simple-calc", "advanced-calc", "scientific-calc"];
  document
    .getElementById(calculators[mode - 1])
    .classList.remove("hidden");

  // Reset display
  clearAll();
}

// Display functions
function updateDisplay() {
  const display = document.getElementById("display");
  // Ensure display does not overflow
  if (displayValue.length > 15) { // Arbitrary limit, can be adjusted
    display.textContent = parseFloat(displayValue).toPrecision(10); // Show in scientific notation if too long
  } else {
    display.textContent = displayValue;
  }
  display.classList.remove("error", "loading");
}

function showError(message = "ERROR") {
  const display = document.getElementById("display");
  display.textContent = message;
  display.classList.add("error");
  displayValue = "0"; // Reset internal display value
  expression = ""; // Clear expression on error

  // Auto-clear error after 2 seconds
  setTimeout(() => {
    if (display.classList.contains("error")) {
      clearAll(); // Fully reset after error display
    }
  }, 2000);
}

function showLoading() {
  const display = document.getElementById("display");
  display.classList.add("loading");
}

// Input functions
function appendValue(value) {
  if (isCalculating) return;

  // Prevent multiple decimal points in a single number
  if (value === '.' && (expression.endsWith('.') || expression.split(/[\+\-\*\/]/).pop().includes('.'))) {
    return;
  }

  // If a calculation was just performed and a new number is appended, start a new expression
  if (justCalculated) {
      // If the appended value is an operator, continue with the result
      if (['+', '-', '*', '/', '**'].includes(value)) {
          expression = displayValue + value;
      } else { // If it's a number or decimal, start a new calculation
          expression = value;
      }
      justCalculated = false;
  } else {
      // Prevent leading zeros unless it's "0."
      if (expression === "0" && value !== ".") {
          expression = value;
      } else {
          expression += value;
      }
  }

  displayValue = expression;
  updateDisplay();
}


function clearAll() {
  expression = "";
  displayValue = "0";
  justCalculated = false;
  isCalculating = false;
  updateDisplay();
}

function clearEntry() {
  if (isCalculating) return;
  if (expression.length > 0) {
    expression = expression.slice(0, -1);
    displayValue = expression || "0";
    updateDisplay();
  } else {
    // If expression is empty, but displayValue is a result, clear it
    if (displayValue !== "0") {
      displayValue = "0";
      justCalculated = false; // Reset justCalculated as we are clearing a result
      updateDisplay();
    }
  }
}

// Calculation functions
async function calculate() {
  if (!expression || isCalculating) return;

  isCalculating = true;
  showLoading();

  try {
    // Replace display symbols for calculation
    let expressionToSend = expression.replace(/÷/g, '/').replace(/×/g, '*');
    const response = await fetch(`${API_BASE_URL}/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expression: expressionToSend,
        calculator_type: currentMode, // Can be sent, but backend doesn't use it for this route
      }),
    });

    const data = await response.json();

    if (!response.ok) { // Check for HTTP errors (e.g., 400, 500)
      showError(data.error || 'An unknown error occurred');
    } else {
      displayValue = data.result.toString();
      expression = displayValue; // Set expression to the result for continued calculation
      justCalculated = true;
      updateDisplay();
    }
  } catch (error) {
    console.error("Network or fetch error:", error);
    showError("NETWORK ERROR");
  } finally {
    isCalculating = false;
  }
}

async function calculateFunction(func) {
  if (isCalculating) return;

  // Use the current display value as the input for functions
  const inputValue = displayValue;

  // Refined check: Prevent functions on '0' that are undefined for 0
  if (inputValue === "0" && ['log', 'ln', 'sqrt', 'factorial'].includes(func)) {
      return;
  }
  isCalculating = true;
  showLoading();

  try {
    const response = await fetch(`${API_BASE_URL}/calculate_function`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        function: func,
        value: inputValue,
        calculator_type: currentMode, // Can be sent, but backend doesn't use it for this route
      }),
    });

    const data = await response.json();

    if (!response.ok) { // Check for HTTP errors (e.g., 400, 500)
      showError(data.error || 'An unknown error occurred');
    } else {
      displayValue = data.result.toString();
      expression = displayValue; // Update expression with the result of the function
      justCalculated = true;
      updateDisplay();
    }
  } catch (error) {
    console.error("Network or fetch error:", error);
    showError("NETWORK ERROR");
  } finally {
    isCalculating = false;
  }
}

// Keyboard support
document.addEventListener("keydown", function (event) {
  if (isCalculating) return;

  const key = event.key;

  // Find button with matching data-key for visual feedback
  const button = document.querySelector(`[data-key="${key}"]`);
  if (button && !button.closest(".hidden")) {
    button.style.transform = "translateY(-1px) scale(0.98)";
    setTimeout(() => {
      button.style.transform = "";
    }, 100);
  }

  if (key >= "0" && key <= "9") {
    appendValue(key);
  } else if (key === ".") {
    appendValue(".");
  } else if (["+", "-"].includes(key)) {
    appendValue(key);
  } else if (key === "*") { // Handle multiplication key
    appendValue('*');
  } else if (key === "/") { // Handle division key
    event.preventDefault(); // Prevent browser's quick find
    appendValue('/');
  } else if (key === "Enter" || key === "=") {
    event.preventDefault();
    calculate();
  } else if (key === "Escape") { // 'Esc' for clear all
    clearAll();
  } else if (key === "Backspace") { // 'Backspace' for clear entry
    clearEntry();
  } else if ((key === "(" || key === ")") && currentMode > 1) { // Parentheses for advanced/scientific
    appendValue(key);
  } else if (key === "^" && currentMode > 1) { // Power key
      // For now, treat '^' as squaring as per backend 'power' function
      // A more complete x^y would require different logic
      calculateFunction('power');
  }
});

// Button press animation
document.addEventListener("click", function (event) {
  if (event.target.classList.contains("calc-btn")) {
    const btn = event.target;
    btn.style.transform = "translateY(-1px) scale(0.98)";
    setTimeout(() => {
      btn.style.transform = "";
    }, 150);
  }
});

// Initialize
createParticles();
updateDisplay();