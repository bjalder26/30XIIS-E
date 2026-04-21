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
  // If entering radicand of xth root
  if (pendingRootIndex !== null && currentInput === '') {
    currentInput = num;
    display = currentInput; // show radicand, not blank
    updateDisplay();
    return;
  }

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
      .replace(/log\(/g, 'Math.log10(')
      .replace(/ln\(/g, 'Math.log(')
      .replace(/e\*\*\(/g, 'Math.exp(')
      .replace(/sqrt\(/g, 'Math.sqrt(')
      .replace(/π/g, 'Math.PI');
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
  ensureAnsInExpression();
  applyEE();

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
  if (currentInput !== '' || expression !== '' || justEvaluated) {
    commitCurrentInput();
    maybeInsertImplicitMultiply();
  }

  expression += 'π';
  display = 'π';
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

  // 4️⃣ Cancel pending xth-root
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

  const formatted = formatDisplay(display);
  mainEl.textContent = formatted;

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
  // If there is something before, insert implicit multiply
  if (currentInput !== '' || expression !== '' || justEvaluated) {
    commitCurrentInput();
    maybeInsertImplicitMultiply();
  }

  expression += fnName + '(';
  display = '';
  updateDisplay();
}

function handleLogOrTenPower() {
  if (secondMode) {
    // 10^x
    if (currentInput !== '' || expression !== '' || justEvaluated) {
      commitCurrentInput();
      maybeInsertImplicitMultiply();
    }
    expression += '10^(';
    display = '';
    updateDisplay();
    return;
  }

  applyUnary('log');
}

function handleLnOrExp() {
  if (secondMode) {
    // e^x
    if (currentInput !== '' || expression !== '' || justEvaluated) {
      commitCurrentInput();
      maybeInsertImplicitMultiply();
    }
    expression += 'e^(';
    display = '';
    updateDisplay();
    return;
  }

  applyUnary('ln');
}

function handleSqrtOrSquare() {
  if (secondMode) {
    // x² is postfix
    commitCurrentInput();
    expression += '^2';
    display = '';
    updateDisplay();
    return;
  }

  // √ behaves like: × √( … ) if something already exists
  if (currentInput !== '' || expression !== '' || justEvaluated) {
    commitCurrentInput();
    maybeInsertImplicitMultiply();
  }

  expression += 'sqrt(';
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

  if (currentInput === '' && justEvaluated) {
    currentInput = display; // ANS as index
    expression = '';
    justEvaluated = false;
  }

  if (currentInput === '') return;

  pendingRootIndex = currentInput;
  currentInput = '';
  display = pendingRootIndex + 'ˣ√';
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

function ensureAnsInExpression() {
  if (expression === '' && currentInput === '' && justEvaluated) {
    expression = currentInput; // ANS
    justEvaluated = false;
  }
}

function formatDisplay(displayStr) {
  if (!displayStr) return displayStr;

  return displayStr
    // x^2 → x²
    .replace(/\^2/g, '²')

    // x^3 → x³
    .replace(/\^3/g, '³')

    // x^(-1) → x⁻¹
    .replace(/\^\(-1\)/g, '⁻¹')

    // x^(-2) → x⁻² (optional, future-proof)
    .replace(/\^\(-2\)/g, '⁻²')

    // general ^(-n) → ⁻ⁿ (basic version)
    .replace(/\^\(-(\d+)\)/g, (_, n) =>
      '⁻' + n.split('').map(toSuperscript).join('')
    );
}

function toSuperscript(d) {
  const map = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹'
  };
  return map[d] || d;
}
