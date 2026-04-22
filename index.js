let display = '';
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
let rootRadicandBuffer = '';

// EE state
let eeMode = false;

let expression = '';
let justEvaluated = false;

const exprEl = document.getElementById('display-expression');
const mainEl = document.getElementById('display-main');
const btnSecond = document.getElementById('btnSecond');

/* ---------- Number Entry ---------- */
function inputNumber(num) {
  // Accumulate radicand digits for x√
  if (pendingRootIndexToken) {
    rootRadicandBuffer += num;

    // Update expression display only
    entry =
      pendingRootIndexToken.entryPart +
      'ˣ√' +
      rootRadicandBuffer;

    updateDisplay();
    return;
  }

  // EE handling
  if (eeMode) {
    eeExponentStr += num;
    entry = eeMantissa + 'E' + eeExponentStr;
    updateDisplay();
    return;
  }

  if (justEvaluated) clearAll();

  pushToken(num, num);
  updateDisplay();
}

/* ---------- EE Handling ---------- */

function enterEE() {
  if (justEvaluated) clearAll();

  // Use the already-typed number as mantissa
  eeMantissa = entry;        // ✅ NOT display
  eeExponentStr = '';
  eeMode = true;

  // Show EE in the EXPRESSION display only
  entry = eeMantissa + 'E';
  updateDisplay();
}

function applyEE() {
  if (!eeMode) return;

  const exp = eeExponentStr === '' ? '0' : eeExponentStr;

  pushToken(
    eeMantissa + 'E' + exp,   // entry token
    eeMantissa + 'e' + exp    // eval token
  );

  eeMantissa = '';
  eeExponentStr = '';
  eeMode = false;

  // Do NOT write to display here
}


/* ---------- Operators ---------- */

function calculate() {
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

    display = String(result);

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

  // Clear state
  justEvaluated = false;
  secondMode = false;

  updateDisplay();
}

/* ---------- 2nd Key ---------- */
btnSecond.onclick = () => {
  secondMode = !secondMode;
  btnSecond.classList.toggle('second-active', secondMode);
};

function inputPi() {
  if (justEvaluated) clearAll();

  // Implicit multiply BEFORE π (2π)
  if (entry !== '') {
    pushToken('', '*');
  }

  pushToken('π', 'Math.PI');

  // ❗ DO NOT TOUCH `display`
  updateDisplay();
}

function addParen(p) {
  finalizePendingRoot();
  pushToken(p, p);
  display = '';
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
  */
}

function applyUnary(fnName) {
  if ((entry !== '' || justEvaluated) && !lastTokenIsUnaryMinus()) {
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
    if ((entry !== '' || justEvaluated) && !lastTokenIsUnaryMinus()) {
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
    if ((entry !== '' || justEvaluated) && !lastTokenIsUnaryMinus()) {
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
  if (justEvaluated) {
    injectANS();
  }
    // x² (postfix)
    pushToken('²', '**2');
    display = '';
    updateDisplay();
    return;
  }

  // √ (prefix with implicit multiply)
  if ((entry !== '' || justEvaluated) && !lastTokenIsUnaryMinus()) {
    pushToken('', '*'); 
  }
  
  pushToken('√(', '__SQRT__');
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
  // Must have something before x√
  if (tokenStack.length === 0) return;

  // Pop the index token (e.g. "2")
  const indexToken = tokenStack.pop();
  pendingRootIndexToken = indexToken;

  // Remove it from entry and expression
  entry = entry.slice(0, -indexToken.entryPart.length);
  expression = expression.slice(0, -indexToken.evalPart.length);

  // Show x√ in the EXPRESSION display only
  entry += indexToken.entryPart + 'ˣ√';

  // ❗ DO NOT TOUCH `display`
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
  // Clear memory (STO / RCL)
  memoryValue = null;

  // Clear calculation state
  expression = '';
  display = '';

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
      display = normalizeScientificDisplay(display);
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

function injectANS() {
  pushToken(display, display);
  justEvaluated = false;
}

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
  if (tokenStack.length === 0) return true;

  const last = tokenStack[tokenStack.length - 1].entryPart;

  return (
    last === '(' ||
    last === '+' ||
    last === '-' ||
    last === '×' ||
    last === '÷' ||
    last === '^'
  );
}

function inputNegative() {
  // If last action was '=', apply to ANS
  if (justEvaluated) {
    injectANS();
  }

  if (!canInsertUnaryMinus()) {
    return; // do nothing
  }

  // Insert unary minus token
  pushToken('-', '-');
  updateDisplay();
}

function lastTokenIsUnaryMinus() {
  if (tokenStack.length === 0) return false;
  return tokenStack[tokenStack.length - 1].entryPart === '-';
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

  // The radicand is everything typed AFTER x√
  const radicand = entry.split('ˣ√').pop();
  const index = pendingRootIndexToken.evalPart;

  // Remove the temporary display
  entry = entry.replace(pendingRootIndexToken.entryPart + 'ˣ√' + radicand, '');

  // Push ONE atomic root token
  pushToken(
    pendingRootIndexToken.entryPart + 'ˣ√' + radicand,
    `${radicand}**(1/${index})`
  );

  pendingRootIndexToken = null;
}

