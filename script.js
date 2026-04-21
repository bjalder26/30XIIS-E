let display = '0';
let currentInput = '';
let secondMode = false;
let memoryValue = null;
let pendingRootIndex = null;
let formatMode = 'OFF'; // 'OFF' | 'SCI' | 'ENG'
const MAX_DISPLAY_FONT = 40; 
const MIN_DISPLAY_FONT = 22; 
const MAX_EXPR_FONT = 30;
const MIN_EXPR_FONT = 16;

// EE state
let eeMode = false;
let eeExponent = '';

let expression = '';
let justEvaluated = false;

const exprEl = document.getElementById('display-expression');
const mainEl = document.getElementById('display-main');
const btnSecond = document.getElementById('btnSecond');

/* ---------- Number Entry ---------- */
function inputNumber(num) {
  if (justEvaluated) {
    expression = '';
    currentInput = '';
    justEvaluated = false;
  }

  if (eeMode) {
    if (num === '-' && eeExponent === '') {
      eeExponent = '-';
    } else {
      eeExponent += num;
    }
    display = currentInput + 'E' + eeExponent;
    updateDisplay();
    return;
  }

  if (currentInput === '' || currentInput === '0') {
    currentInput = num;
  } else {
    currentInput += num;
  }

  display = currentInput;
  updateDisplay();
}

/* ---------- EE Handling ---------- */
function enterEE() {
  if (justEvaluated) {
    justEvaluated = false;
  }
  if (currentInput === '') currentInput = '1';
  eeMode = true;
  eeExponent = '';
  display = currentInput + 'E';
  updateDisplay();
}

function applyEE() {
  if (!eeMode) {
    commitCurrentInput();
    return;
  }

  const exponent = eeExponent === '' ? '0' : eeExponent;

  // Append scientific notation directly
  expression += currentInput + 'e' + exponent;

  eeMode = false;
  eeExponent = '';
  currentInput = '';
}

/* ---------- Operators ---------- */

function calculate() {
  try {
    applyEE();

    let safeExpr = expression
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/\^/g, '**')
      .replace(/log10\(/g, 'Math.log10(')
      .replace(/ln\(/g, 'Math.log(')
      .replace(/e\*\*\(/g, 'Math.exp(')
      .replace(/sqrt\(/g, 'Math.sqrt(');
    const result = Function('"use strict"; return (' + safeExpr + ')')();

    // top line clears
    // result stays on bottom line
    display = String(result);
    expression = '';
    currentInput = display;

    justEvaluated = true;
    applyFormatMode();

    updateDisplay();
  } catch (e) {
    display = 'Error';
    expression = '';
    currentInput = '';
    updateDisplay();
  }
}

/* ---------- Functions ---------- */
function reciprocal() {
  // First finish EE if active
  applyEE();

  if (expression === '') return;

  // Wrap the last term in 1/(...)
  expression = '1/(' + expression + ')';

  display = '';
  updateDisplay();
}

function toggleSign() {
  justEvaluated = false;

  // If we are entering an EE exponent, toggle exponent sign
  if (eeMode) {
    if (eeExponent.startsWith('-')) {
      eeExponent = eeExponent.slice(1);
    } else {
      eeExponent = '-' + eeExponent;
    }

    display = currentInput + 'E' + eeExponent;
    updateDisplay();
    return;
  }

  // Normal mode: toggle mantissa sign
  if (currentInput === '' || currentInput === '0') return;

  if (currentInput.startsWith('-')) {
    currentInput = currentInput.slice(1);
  } else {
    currentInput = '-' + currentInput;
  }

  display = currentInput;
  updateDisplay();
}

/* ---------- Editing ---------- */
function clearAll() {
  justEvaluated = false;
  display = '0';
  expression = '';
  currentInput = '';
  eeMode = false;
  eeExponent = '';
  updateDisplay();
}

/* ---------- 2nd Key ---------- */
btnSecond.onclick = () => {
  secondMode = !secondMode;
  btnSecond.classList.toggle('second-active', secondMode);
};

function inputPi() {
  // π cancels EE entry if active
  eeMode = false;
  eeExponent = '';

  currentInput = String(Math.PI);
  display = currentInput;
  updateDisplay();
}

function addParen(p) {
  if (justEvaluated) {
    expression = currentInput;
    justEvaluated = false;
  }
  if (p === '(') {
    applyEE(); // finish EE if active
    maybeInsertImplicitMultiply();
  } else {
    applyEE();
  }

  expression += p;
  display = '';
  updateDisplay();
}

function setOperator(op) {
  if (justEvaluated) {
    // Use the result as-is, do NOT re-commit it
    expression = currentInput;
    currentInput = '';
    justEvaluated = false;
  } else {
    applyEE(); // normal path
  }

  expression += op;
  display = '';
  updateDisplay();
}

function deleteChar() {
  // 1️⃣ After equals: DEL does nothing
  if (justEvaluated) return;

  // 2️⃣ Deleting EE exponent
  if (eeMode) {
    if (eeExponent !== '') {
      // Remove exponent digits first
      eeExponent = eeExponent.slice(0, -1);

      if (eeExponent !== '') {
        display = currentInput + 'E' + eeExponent;
      } else {
        // No exponent digits left — still showing E for now
        display = currentInput + 'E';
      }

      updateDisplay();
      return;
    }

    // ✅ No exponent digits left → exit EE mode and remove 'E'
    eeMode = false;
    eeExponent = '';
    display = currentInput === '' ? '0' : currentInput;
    updateDisplay();
    return;
  }

  // 3️⃣ Deleting typed digits
  if (currentInput !== '') {
    currentInput = currentInput.slice(0, -1);

    if (currentInput === '') {
      display = '0';
    } else {
      display = currentInput;
    }

    updateDisplay();
    return;
  }

  // 4️⃣ Cancel pending nth-root
  if (pendingRootIndex !== null) {
    pendingRootIndex = null;
    display = '0';
    updateDisplay();
    return;
  }

  // 5️⃣ Delete from expression
  if (expression !== '') {
    expression = expression.slice(0, -1);

    display = expression === '' ? '0' : expression;
    updateDisplay();
  }
}

function updateDisplay() {
  exprEl.textContent = expression;
  mainEl.textContent = display;
  fitExpressionText();
  fitDisplayText();
}

function maybeInsertImplicitMultiply() {
  if (expression === '') return;

  const lastChar = expression.slice(-1);

  // implicit multiplication rules:
  // number followed by '('  → multiply
  // ')' followed by '('     → multiply
  if (/\d/.test(lastChar) || lastChar === ')') {
    expression += '×';
  }
}

function applyUnary(fnName) {
  // If result is on screen, use it exactly once
  if (justEvaluated) {
    expression = currentInput;
    currentInput = '';
    justEvaluated = false;
  } else {
    // Only commit during normal entry
    commitCurrentInput();
  }

  if (expression === '') return;

  expression = fnName + '(' + expression + ')';
  display = '';
  updateDisplay();
}

function handleLogOrTenPower() {
  if (secondMode) {
    // 2nd + log → 10^x
    applyEE();

    if (expression === '') return;

    expression = '10^(' + expression + ')';

    display = '';
    updateDisplay();
    return;
  }

  // normal log
  applyUnary('log10');
}

function handleLnOrExp() {
  if (secondMode) {
    // 2nd + ln → e^x
    applyEE();

    if (expression === '') return;

    expression = 'e^(' + expression + ')';

    display = '';
    updateDisplay();
    return;
  }

  // normal ln
  applyUnary('ln');
}

function handleSqrtOrSquare() {
  applyEE();

  if (expression === '') return;

  if (secondMode) {
    // 2nd + √ → x²
    expression = '(' + expression + ')^2';

    display = '';
    updateDisplay();
    return;
  }

  // normal √
  expression = 'sqrt(' + expression + ')';
  display = '';
  updateDisplay();
}

function handleEeOrReciprocal() {
  if (secondMode) {
    enterEE();
    return;
  }
  reciprocal();
}

function handleHypOrPi() {
  if (secondMode) {
    // HYP (not implemented yet)
    return;
  }
  inputPi();
}

function storeValue() {
  // Finish any active EE entry
  if (eeMode) {
    applyEE();
  }
  // If we just evaluated, value is already in currentInput
  if (currentInput !== '') {
    memoryValue = Number(currentInput);
  } else {
    return; // nothing reasonable to store
  }
  // STO does NOT change entry state
}

function recallValue() {
  if (memoryValue === null) {
    return;
  }

  // If last action was '=', start fresh
  if (justEvaluated) {
    expression = '';
    currentInput = '';
    justEvaluated = false;
  }

  // Insert recalled value like typing a number
  currentInput = String(memoryValue);
  display = currentInput;
  updateDisplay();
}

function handleRclOrSto() {
  if (secondMode) {
    recallValue();
    return;
  }
  storeValue();
}

function handleNthRoot() {
  if (eeMode) applyEE();

  if (justEvaluated) {
    currentInput = display;
    expression = '';
    justEvaluated = false;
  }

  if (currentInput === '') return;

  // Capture index n
  pendingRootIndex = currentInput;

  // Keep the index visible, but clear input buffer
  currentInput = '';
  display = pendingRootIndex + 'ⁿ√';

  updateDisplay();
}

function commitCurrentInput() {
  if (currentInput === '') return;

  if (pendingRootIndex !== null) {
    // Build: (x)^(1/n)
    expression += '(' + currentInput + ')^(1/' + pendingRootIndex + ')';
    pendingRootIndex = null;
  } else {
    expression += currentInput;
  }

  currentInput = '';
}

function handlePowerOrNthRoot() {
  if (secondMode) {
    handleNthRoot();
    return;
  }

  setOperator('^');
}

function resetCalculator() {
  // Clear memory (STO / RCL)
  memoryValue = null;

  // Clear calculation state
  expression = '';
  currentInput = '';
  display = '0';

  // Clear modes / flags
  eeMode = false;
  eeExponent = '';
  pendingRootIndex = null;
  justEvaluated = false;
  formatMode = 'OFF';
  updateFormatIndicator();
  
  updateDisplay();
}

function handleZeroOrReset() {
  console.log('in1');
  if (secondMode) {
    console.log('in');
    resetCalculator();
    return;
  }

  // Normal 0 digit entry
  inputNumber('0');
}

function fitDisplayText() {
  const el = mainEl;

  // 1️⃣ Always reset to max size first
  el.style.fontSize = MAX_DISPLAY_FONT + 'px';

  // 2️⃣ Shrink until it fits or hits minimum
  while (el.scrollWidth > el.clientWidth) {
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size <= MIN_DISPLAY_FONT) break;
    el.style.fontSize = size - 1 + 'px';
  }
}

function fitExpressionText() {
  const el = exprEl;

  el.style.fontSize = MAX_EXPR_FONT + 'px';

  while (el.scrollWidth > el.clientWidth) {
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size <= MIN_EXPR_FONT) break;
    el.style.fontSize = size - 1 + 'px';
  }
}

function handleSciEng() {
  switch (formatMode) {
    case 'OFF':
      formatMode = 'SCI';
      break;
    case 'SCI':
      formatMode = 'ENG';
      break;
    case 'ENG':
      formatMode = 'OFF';
      break;
  }

  applyFormatMode();
  updateDisplay();
  updateFormatIndicator();
}

function applyFormatMode() {
  if (display === '' || isNaN(display)) return;

  const value = Number(display);
  if (!isFinite(value)) return;

  switch (formatMode) {
    case 'OFF':
      display = String(value);
      break;
    case 'SCI':
      display = value.toExponential();
      break;
    case 'ENG': {
      if (value === 0) {
        display = '0';
        break;
      }
      const exp = Math.floor(Math.log10(Math.abs(value)) / 3) * 3;
      const mantissa = value / Math.pow(10, exp);
      display = mantissa + 'E' + exp;
      break;
    }
  }
}

function updateFormatIndicator() {
  const modeEl = document.getElementById('display-mode');
  modeEl.textContent = formatMode === 'OFF' ? '' : formatMode;
}

document.addEventListener('DOMContentLoaded', () => {
  const keysEl = document.querySelector('.keys');
  if (!keysEl) return;

  keysEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    if (secondMode && btn !== btnSecond) {
      secondMode = false;
      btnSecond.classList.remove('second-active');
    }
  });
});
