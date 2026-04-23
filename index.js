let display = '';
let secondMode = false;
let memoryValue = null;
let pendingRootIndex = null;
let formatMode = 'OFF'; // 'OFF' | 'SCI' | 'ENG'
const MAX_DISPLAY_FONT = 42; 
const MIN_DISPLAY_FONT = 22; 
const MAX_EXPR_FONT = 42;
const MIN_EXPR_FONT = 22;
let tokenStack = [];
let entry = '';
let eeMantissa = '';
let eeExponentStr = '';
let pendingRootIndexToken = null;
let rootRadicandBuffer = '';
let eePrefix = '';
let rootPrefix = '';
const DISPLAY_SIG_DIGITS = 10;
const MAX_MANTISSA_SIG_DIGITS = 8;

// EE state
let eeMode = false;

let expression = '';
let justEvaluated = false;

const exprEl = document.getElementById('display-expression');
const mainEl = document.getElementById('display-main');
const btnSecond = document.getElementById('btnSecond');

/* ---------- Number Entry ---------- */
function inputNumber(num) {
  // 1️⃣ Accumulate radicand digits for x√ (synthetic mode)
  if (pendingRootIndexToken) {
    rootRadicandBuffer += num;

    entry =
      pendingRootIndexToken.entryPart +
      'ˣ√' +
      rootRadicandBuffer;

    updateDisplay();
    return;
  }

  // 2️⃣ EE exponent entry (synthetic mode)
  if (eeMode) {
    eeExponentStr += num;
    entry = eeMantissa + 'E' + eeExponentStr;
    updateDisplay();
    return;
  }

  // 3️⃣ Normal number entry begins here
  if (justEvaluated) clearAll();

  // ✅ IMPLICIT MULTIPLY GOES HERE
  // This fixes: π2, (2)3, (2)(3)
  if (needsImplicitMultiplyBefore(num)) {
    pushToken('', '*');
  }

  pushToken(num, num);
  updateDisplay();
}

/* ---------- EE Handling ---------- */

function enterEE() {
  if (justEvaluated) {
    injectANS();
  }

  // ✅ Save everything before the mantissa
  eePrefix = entry.slice(0, entry.length);

  const mantissa = extractNumericLiteral();
  if (mantissa === null) return;

  // Remove mantissa visually from the prefix
  eePrefix = eePrefix.slice(0, eePrefix.length - mantissa.length);

  // Handle unary minus BEFORE mantissa
  let signedMantissa = mantissa;
  if (
    tokenStack.length > 0 &&
    tokenStack[tokenStack.length - 1].entryPart === '-'
  ) {
    tokenStack.pop();
    expression = expression.slice(0, -1);
    eePrefix = eePrefix.slice(0, -1);
    signedMantissa = '-' + mantissa;
  }

  eeMantissa = signedMantissa;
  eeExponentStr = '';
  eeMode = true;

  updateDisplay();
}

function applyEE() {
  if (!eeMode) return;

  const exp = eeExponentStr === '' ? '0' : eeExponentStr;

  pushToken(
    eeMantissa + 'E' + exp,
    `${eeMantissa}e${exp}`
  );

  eeMode = false;
  eeMantissa = '';
  eeExponentStr = '';
  rebuildEntry();
}

/* ---------- Operators ---------- */
function calculate() {
  // ✅ Case: no pending expression
  if (expression === '' && tokenStack.length === 0 && !pendingRootIndexToken && !eeMode ) {
    return; // do nothing
  }

  try {
    finalizePendingRoot();
    applyEE();

    let evalExpr = expandPrefixFunctions(expression);

    evalExpr = evalExpr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/\^/g, '**')
      .replace(/π/g, 'Math.PI');

    const result = Function('"use strict"; return (' + evalExpr + ')')();

    // ✅ Store ANS numerically
    ansValue = Number(result);

    // ✅ Display formatted result
    display = ansValue;
    justEvaluated = true;
    applyFormatMode();
    
    // entry = display;

    // ✅ Clear internal expression state only
    expression = '';
    tokenStack = [];

    updateDisplay();
  } catch (e) {
    // Only show error if there WAS something to evaluate
    display = 'Error';
    justEvaluated = false;

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
  // Clear entry / tokens
  entry = '';
  tokenStack = [];
  expression = '';

  // Clear displays
  display = '';

  // Clear modes / buffers
  eeMode = false;
  eeMantissa = '';
  eeExponentStr = '';
  pendingRootIndexToken = null;
  rootRadicandBuffer = '';

  // Clear state
  justEvaluated = false;

  updateDisplay();
}

/* ---------- 2nd Key ---------- */
btnSecond.onclick = () => {
  secondMode = !secondMode;
  btnSecond.classList.toggle('second-active', secondMode);
};

function inputPi() {
  if (justEvaluated) clearAll();

  // ✅ Symmetric implicit multiplication
  if (needsImplicitMultiplyBefore('π')) {
    pushToken('', '*');
  }

  pushToken('π', 'Math.PI');
  updateDisplay();
}

function addParen(p) {
  if (justEvaluated) {
    clearAll();        // ✅ start a new expression
  }

  finalizePendingRoot();

  if (p === '(' && needsImplicitMultiplyBefore('(')) {
    pushToken('', '*');
  }

  pushToken(p, p);
  updateDisplay();
}


function setOperator(op) {
  if (justEvaluated) {
    injectANS();  
  }

  pushToken(op, op);
  display = '';
  updateDisplay();
}

function deleteChar() {
  // Block delete on final result with no pending state
  if (
    justEvaluated &&
    !pendingRootIndexToken &&
    rootRadicandBuffer === '' &&
    !eeMode
  ) {
    return;
  }

  justEvaluated = false;

  // 1️⃣ Delete radicand digits
  if (pendingRootIndexToken && rootRadicandBuffer.length > 0) {
    rootRadicandBuffer = rootRadicandBuffer.slice(0, -1);
    rebuildEntry();
    updateDisplay();
    return;
  }

  // 2️⃣ Delete the ˣ√ operator itself
  if (pendingRootIndexToken) {
    tokenStack.push(pendingRootIndexToken);
    pendingRootIndexToken = null;
    rootRadicandBuffer = '';
    rebuildEntry();
    updateDisplay();
    return;
  }

  // 3️⃣ Normal token deletion
  if (popToken()) {
    rebuildEntry();
    updateDisplay();
  }
}

function updateDisplay() {
  if (eeMode) {
    exprEl.textContent =
      eePrefix + eeMantissa + 'E' + eeExponentStr;
  } else if (pendingRootIndexToken) {
    exprEl.textContent =
      rootPrefix +
      pendingRootIndexToken.entryPart +
      'ˣ√' +
      rootRadicandBuffer;
  } else {
    exprEl.textContent = entry;
  }

  mainEl.textContent = formatDisplay(display);
  fitExpressionText();
  fitDisplayText();
}

function applyUnary(fnName) {
  if (needsImplicitMultiplyBefore(fnName + '(')) {
    pushToken('', '*');
  }

  if (fnName === 'log') {
    pushToken('log(', '__LOG__');
  } else if (fnName === 'ln') {
    pushToken('ln(', '__LN__');
  }

  display = '';
  updateDisplay();
}

function handleLogOrTenPower() {
  if (secondMode) {
    if (needsImplicitMultiplyBefore('₁₀^(')) {
      pushToken('', '*');
    }
  
    pushToken('₁₀^(', '__TENPOW__');
    display = '';
    updateDisplay();
    return;
  }

  applyUnary('log');
}

function handleLnOrExp() {
  if (secondMode) {
    if (needsImplicitMultiplyBefore('e^(')) {
      pushToken('', '*');
    }
  
    pushToken('e^(',  '__EPOW__')
    display = '';
    updateDisplay();
    return;
  }

  applyUnary('ln');
}

function handleSqrtOrSquare() {
  if (secondMode) {
    // √ (prefix with implicit multiply)
    if (needsImplicitMultiplyBefore('√(')) {
    pushToken('', '*'); 
    }
    pushToken('√(', '__SQRT__');
    display = '';
    updateDisplay();
    return;
  }
  
  if (justEvaluated) {
    injectANS();
  }
  // x² (postfix)
  pushToken('²', '**2');
  display = '';
  updateDisplay();
}

function handleEeOrReciprocal() {
  if (secondMode) {
    enterEE();
    return;
  }
  if (justEvaluated) {
    injectANS();
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
  // If there is no result yet, do nothing
  if (display === '' || display === 'Error') return;

  memoryValue = Number(display);
}

function recallValue() {
  if (memoryValue === null) return;

  // If last action was '=', start a new expression
  if (justEvaluated) {
    entry = '';
    expression = '';
    tokenStack = [];
    justEvaluated = false;
  }

  // Implicit multiply if needed (e.g., 2 RCL → 2×value)
  if (tokenStack.length > 0) {
    const last = tokenStack[tokenStack.length - 1].entryPart;
    if (needsImplicitMultiplyBefore(valueStr)) {
      pushToken('', '*');
    }
  }

  // Insert recalled value as a token
  const valueStr = String(memoryValue);
  pushToken(valueStr, valueStr);

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
  // Finalize any previous root
  finalizePendingRoot();

  if (tokenStack.length === 0) return;

  // Capture prefix
  rootPrefix = entry;

  // Remove index token
  const indexToken = tokenStack.pop();
  pendingRootIndexToken = indexToken;

  // ✅ REMOVE INDEX FROM EXPRESSION
  expression = expression.slice(
    0,
    -indexToken.evalPart.length
  );

  // Remove index visually from prefix
  rootPrefix = rootPrefix.slice(
    0,
    rootPrefix.length - indexToken.entryPart.length
  );

  // Reset radicand
  rootRadicandBuffer = '';

  updateDisplay();
}

function handlePowerOrNthRoot() {
  if (justEvaluated) {
    injectANS();
  }
  if (secondMode) {
    handleNthRoot();
    return;
  }

  setOperator('^');
}

function resetCalculator() {
  // ✅ reuse correct logic
  clearAll();

  // ✅ then reset the extras
  memoryValue = null;
  formatMode = 'OFF';
  secondMode = false;

  updateFormatIndicator();
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

  // Reset to max
  el.style.fontSize = MAX_DISPLAY_FONT + 'px';

  // Force layout recalculation
  el.getBoundingClientRect();

  // Shrink until the FULL string fits
  while (el.scrollWidth > el.clientWidth) {
    const size = parseFloat(getComputedStyle(el).fontSize);

    if (size <= MIN_DISPLAY_FONT) break;

    el.style.fontSize = (size - 1) + 'px';

    // Force reflow after each shrink
    el.getBoundingClientRect();
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
  if (!justEvaluated || ansValue === null || !isFinite(ansValue)) return;

  switch (formatMode) {

    case 'OFF': {
      if (!needsScientific(ansValue)) {
        // Normal decimal
        display = Number(ansValue).toLocaleString('en-US', {
          useGrouping: false,
          maximumSignificantDigits: 21
        });
      } else {
        // Auto scientific fallback
        const exp = Math.floor(Math.log10(Math.abs(ansValue)));
        const mantissa = ansValue / Math.pow(10, exp);
        display = shrinkScientificString(renderScientific(mantissa, exp));
      }
      break;
    }

    case 'SCI': {
      if (ansValue === 0) {
        display = '0';
      } else {
        const exp = Math.floor(Math.log10(Math.abs(ansValue)));
        const mantissa = ansValue / Math.pow(10, exp);
        display = shrinkScientificString(renderScientific(mantissa, exp));
      }
      break;
    }

    case 'ENG': {
      if (ansValue === 0) {
        display = '0';
      } else {
        const exp = Math.floor(Math.log10(Math.abs(ansValue)) / 3) * 3;
        const mantissa = ansValue / Math.pow(10, exp);
        display = shrinkScientificString(renderScientific(mantissa, exp));
      }
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
  expression += evalPart;
  rebuildEntry()
}

function popToken() {
  const token = tokenStack.pop();
  if (!token) return false;

  entry = entry.slice(0, -token.entryPart.length);
  expression = expression.slice(0, -token.evalPart.length);
  return true;
}

function injectANS() {
  pushToken(display, display);
  justEvaluated = false;
}

/*
function normalizeScientificDisplay(str) {
  const match = str.match(/^(-?\d+(\.\d+)?)(e[+-]?\d+)$/i);
  if (!match) return str;

  let mantissa = match[1];
  const exponent = match[3];

  // Limit mantissa to ~8 significant digits
  if (mantissa.length > 10) {
    mantissa = Number(mantissa).toPrecision(8);
  }

  return mantissa + exponent;
}
*/ 

function expandPrefix(expr, marker, fnName) {
  const idx = expr.indexOf(marker);
  if (idx === -1) return expr;

  const before = expr.slice(0, idx);
  let after = expr.slice(idx + marker.length);

  const { open, close } = countParens(after);

  // We are adding ONE '(' with fnName + '('
  // We must add ONE ')' only if needed to balance
  const needsClosingParen = close < open + 1;

  return (
    before +
    fnName +
    '(' +
    after +
    (needsClosingParen ? ')' : '')
  );
}

function expandPrefixFunctions(expr) {
  expr = expandPrefix(expr, '__LOG__',    'Math.log10');
  expr = expandPrefix(expr, '__LN__',     'Math.log');
  expr = expandPrefix(expr, '__SQRT__',   'Math.sqrt');
  expr = expandPrefix(expr, '__TENPOW__', '10**');
  expr = expandPrefix(expr, '__EPOW__',   'Math.exp');
  return expr;
}

function canInsertUnaryMinus() {
  // Start of expression
  if (tokenStack.length === 0) return true;

  const last = tokenStack[tokenStack.length - 1].entryPart;

  // After operators
  if (['+', '-', '×', '÷', '^'].includes(last)) return true;

  // After open parenthesis
  if (last === '(') return true;

  // ✅ After prefix function openers
  if (isPrefixOpener(last)) return true;

  // Otherwise, unary minus is not valid here
  return false;
}

function inputNegative() {
  // ✅ If we are entering an EE exponent, toggle exponent sign
  if (eeMode) {
    if (eeExponentStr.startsWith('-')) {
      eeExponentStr = eeExponentStr.slice(1);
    } else {
      eeExponentStr = '-' + eeExponentStr;
    }
    updateDisplay();
    return;
  }

  // Normal unary minus behavior
  if (justEvaluated) {
    injectANS();
  }

  if (!canInsertUnaryMinus()) return;

  pushToken('-', '-');
  updateDisplay();
}

function countParens(str) {
  let open = 0;
  let close = 0;
  for (const ch of str) {
    if (ch === '(') open++;
    else if (ch === ')') close++;
  }
  return { open, close };
}

function finalizePendingRoot() {
  if (!pendingRootIndexToken) return;

  const radicand = rootRadicandBuffer || '0';
  const index = pendingRootIndexToken.evalPart;

  pushToken(
    pendingRootIndexToken.entryPart + 'ˣ√' + radicand,
    `${radicand}**(1/${index})`
  );

  // ✅ Clear synthetic state
  pendingRootIndexToken = null;
  rootRadicandBuffer = '';
  rootPrefix = '';

  rebuildEntry();
}

function rebuildEntry() {
  entry = tokenStack.map(t => t.entryPart).join('');

  if (pendingRootIndexToken) {
    entry += pendingRootIndexToken.entryPart + 'ˣ√' + rootRadicandBuffer;
  }
}

function isPrefixOpener(token) {
  return (
    token === 'log(' ||
    token === 'ln(' ||
    token === '√(' ||
    token === '₁₀^(' ||
    token === 'e^('
  );
}

function extractNumericLiteral() {
  let mantissaParts = [];

  while (tokenStack.length > 0) {
    const t = tokenStack[tokenStack.length - 1];

    if (/^[0-9.]$/.test(t.entryPart)) {
      mantissaParts.unshift(t.evalPart);
      tokenStack.pop();
      expression = expression.slice(0, -t.evalPart.length); // ✅ FIX
    } else {
      break;
    }
  }

  return mantissaParts.length > 0
    ? mantissaParts.join('')
    : null;
}

function needsImplicitMultiplyBefore(nextEntryPart) {
  if (tokenStack.length === 0) return false;

  const prev = tokenStack[tokenStack.length - 1].entryPart;

  // ❌ Never break a number literal
  if (isNumberContinuation(prev, nextEntryPart)) {
    return false;
  }

  // ✅ Value ended, new value starting
  if (isValueEnder(prev)) return true;

  return false;
}

function isNumberContinuation(prev, next) {
  // digit → digit
  if (/\d/.test(prev) && /\d/.test(next)) return true;

  // digit → dot
  if (/\d/.test(prev) && next === '.') return true;

  // dot → digit
  if (prev === '.' && /\d/.test(next)) return true;

  return false;
}

function isValueEnder(token) {
  // digit ends a value
  if (/\d/.test(token)) return true;

  return (
    token === ')' ||
    token === 'π' ||
    token === '²'
  );
}

function renderScientific(mantissa, exponent) {
  let m = Number(mantissa).toPrecision(6).replace(/\.?0+$/, '');
  return m + 'E' + exponent;
}

function needsScientific(value) {
  if (value === 0) return false;

  const abs = Math.abs(value);
  return abs >= 1e10 || abs < 1e-9;
}

function shrinkScientificString(sciStr) {
  // Expect format like: "-12.345678E6" or "8E3"
  const match = sciStr.match(/^(-?)(\d+)(?:\.(\d+))?E(-?\d+)$/);
  if (!match) return sciStr; // fallback safety

  const sign = match[1];
  const intPart = match[2];
  const fracPart = match[3] || '';
  const exponent = match[4];

  const digits = intPart + fracPart;

  if (digits.length <= MAX_MANTISSA_SIG_DIGITS) {
    return sciStr; // nothing to shrink
  }

  const kept = digits.slice(0, MAX_MANTISSA_SIG_DIGITS);

  let newMantissa;
  if (kept.length <= intPart.length) {
    newMantissa = kept;
  } else {
    newMantissa =
      kept.slice(0, intPart.length) +
      '.' +
      kept.slice(intPart.length);
  }

  return sign + newMantissa.replace(/\.?0+$/, '') + 'E' + exponent;
}

