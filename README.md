# 30XIIS-E
An emulator for the TI-30XIIS* user interface

The following buttons work:
* 2nd
* DEL
* log / $10^x$
* ln / $e^x$
* CLEAR
* π
* ^ / $n\sqrt{x}$
* $X^{-1}$ / EE
* (
* )
* $\sqrt{}$ / $X^{2}$
* STO► /  RCL (only stores 1 number => no menu)
* reset
* 0-9
* ÷ × - + =
* SCI/ENG will cycle through SCI → ENG → FLO rather than bringing up a menu like you would see with a TI-30XIIS.

* ans works a bit differently (the button does nothing)
* Scientific notation is displayed differently

The rest are not set up to work yet.

Feel free to sumbit requests as issues, or to submit PRs to add functionality.

These things need to be maintained in updates
* Tokinization (not just editing strings) - log( is deleted as a unit, not a character at a time
* Implicit multiplication - 2(2) = 4
* Automatic Parenthesis Closure - log(5+5 = 2

Github pages hosted emulator: https://bjalder26.github.io/30XIIS-E/
