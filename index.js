let display = '0';
let secondMode = false;
let memoryValue = null;
let pendingRootIndex = null;
let formatMode = 'OFF'; // 'OFF' | 'SCI' | 'ENG'
const MAX_DISPLAY_FONT = 40; 
const MIN_DISPLAY_FONT = 22; 
const MAX_EXPR_FONT = 30;
const MIN_EXPR_FONT = 16;
let tokenStack = [];
let entry = '';
let eeMantissa = '';
let eeExponentStr = '';
let pendingRootIndexToken = null;



// EE state
let eeMode = false;

let expression = '';
let justEvaluated = false;

const exprEl = document.getElementById('display-expression');
const mainEl = document.getElementById('display-main');
const btnSecond = document.getElementById('btnSecond');

/* ---------- Number Entry ---------- */
function inputNumber(num) {
  if (eeMode) {
    eeExponentStr += num;
    display = eeMantissa + 'E' + eeExponentStr;
    updateDisplay();
    return;
  }

  if (justEvaluated) {
    clearAll(); // start new expression, but keep ANS internally
  }

  pushToken(num, num);

  // ❗ DO NOT touch `display` here
  updateDisplay();
}

/* ---------- EE Handling ---------- */

function enterEE() {
  if (justEvaluated) clearAll();

  eeMantissa = display;
  eeExponentStr = '';
  eeMode = true;

  display = eeMantissa + 'E';
  updateDisplay();
}


function applyEE() {
  if (!eeMode) return;

  const exp = eeExponentStr === '' ? '0' : eeExponentStr;

  pushToken(
    eeMantissa + 'E' + exp,
    eeMantissa + 'e' + exp
  );

  eeMantissa = '';
  eeExponentStr = '';
  eeMode = false;
  display = '';
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

    // ✅ Show result in MAIN display only
    display = String(result);

    // ✅ Clear expression (top display)
    entry = '';
    expression = '';
    tokenStack = [];

    justEvaluated = true;

    applyFormatMode();
    updateDisplay();
  } catch (e) {
    display = 'Error';
    entry = '';
    expression = '';
    tokenStack = [];
    updateDisplay();
  }
}

/* ---------- Functions ---------- */
function reciprocal() {
  pushToken('⁻¹', '**(-1)');
  display = '';
  updateDisplay();
}

/* ---------- Editing ---------- */
function clearAll() {
  justEvaluated = false;
  display = '0';
  expression = '';
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
  if (entry !== '' || justEvaluated) {
    pushToken('', '*'); 
  }

  pushToken('π', 'Math.PI');
  display = 'π';
  updateDisplay();
}

function addParen(p) {
  pushToken(p, p);
  display = '';
  updateDisplay();
}

function setOperator(op) {
  if (justEvaluated) {
    justEvaluated = false;
  }

  pushToken(op, op);
  display = '';
  updateDisplay();
}

function deleteChar() {
  if (justEvaluated) return;

  if (popToken()) {
    updateDisplay();
  }
}

function updateDisplay() {
  exprEl.textContent = entry;

  const formatted = formatDisplay(display);
  mainEl.textContent = formatted;

  fitExpressionText();
  fitDisplayText();
}

function maybeInsertImplicitMultiply() {
  // disabled during token migration
  /*
  if (expression === '') return;

  const lastChar = expression.slice(-1);

  // implicit multiplication rules:
  // number followed by '('  → multiply
  // ')' followed by '('     → multiply
  if (/\d/.test(lastChar) || lastChar === ')') {
    pushToken('', '*');
  }
}

function applyUnary(fnName) {
  if (entry !== '' || justEvaluated) {
    pushToken('', '*');
  }

  if (fnName === 'log') {
    pushToken('log(', 'Math.log10(');
  } else if (fnName === 'ln') {
    pushToken('ln(', 'Math.log(');
  }

  display = '';
  updateDisplay();
}

function handleLogOrTenPower() {
  if (secondMode) {
    if (entry !== '' || justEvaluated) {
      pushToken('', '*');
    }
  
    pushToken('10^(', '10**(');
    display = '';
    updateDisplay();
    return;
  }

  applyUnary('log');
  */
}

function handleLnOrExp() {
  if (secondMode) {
    if (entry !== '' || justEvaluated) {
      pushToken('', '*');
    }
  
    pushToken('e^(', 'Math.exp(');
    display = '';
    updateDisplay();
    return;
  }

  applyUnary('ln');
}

function handleSqrtOrSquare() {
  if (secondMode) {
    // x² (postfix)
    pushToken('²', '**2');
    display = '';
    updateDisplay();
    return;
  }

  // √ (prefix with implicit multiply)
  if (entry !== '' || justEvaluated) {
    pushToken('', '*'); 
  }
  
  pushToken('√(', 'Math.sqrt(');
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
  // Cannot start x√ without a number before it
  if (tokenStack.length === 0) return;

  // Pop the index token (e.g. "2")
  const indexToken = tokenStack.pop();
  pendingRootIndexToken = indexToken;

  // Remove index from entry/expression
  entry = entry.slice(0, -indexToken.entryPart.length);
  expression = expression.slice(0, -indexToken.evalPart.length);

  // Show x√ in display (but do NOT add eval yet)
  entry += indexToken.entryPart + 'ˣ√';
  display = indexToken.entryPart + 'ˣ√';

  updateDisplay();
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

function pushToken(entryPart, evalPart) {
  tokenStack.push({ entryPart, evalPart });
  entry += entryPart;
  expression += evalPart;
}

function popToken() {
  const token = tokenStack.pop();
  if (!token) return false;

  entry = entry.slice(0, -token.entryPart.length);
  expression = expression.slice(0, -token.evalPart.length);
  return true;
}

