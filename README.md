# 30XIIS-E
An emulator for the TI-30XIIS* user interface

Buttons/functions that are grayed out don't work.
* STO► only stores 1 number => no menu
* STO► number is displayed at the bottom
* CLRVAR clears out the stored number
* SCI/ENG will cycle through SCI → ENG → FLO rather than bringing up a menu like you would see with a TI-30XIIS.
* ans works a bit differently (the ans button does nothing)
* Scientific notation is displayed differently

The emulator is geared towards being useful for teaching rather than strictly adhearing to how the TI-30XIIS functions.

Feel free to sumbit requests as issues, or to submit PRs to add functionality.

These things need to be maintained in updates
* Tokinization (not just editing strings) - log( is deleted as a unit, not a character at a time
* Implicit multiplication - 2(2) = 4
* Automatic Parenthesis Closure - log(5+5 = 2

Github pages hosted emulator: https://bjalder26.github.io/30XIIS-E/

<sub>*TI-30XIIS is a trademark of Texas Instruments. This site is not affiliated with, endorsed by, or sponsored by Texas Instruments</sub>
