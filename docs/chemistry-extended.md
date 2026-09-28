# Bounded chemistry indices and electron configurations

These forms are accepted only by the explicit chemistry parser (`mode: "chemistry"` or a recognized `\ce{...}` expression). They do not classify ordinary prose as chemistry. Source text is retained; positions are absolute UTF-16 offsets.

## Explicit oxidation states

Use `Fe\oxidation{+3}` for an upper-right oxidation state and `S\oxidationabove{+4}O\oxidationabove{-2}2` for directly-above values. `\ox` and `\oxabove` are aliases. These are application-defined source commands, not a claim of general mhchem command compatibility. A command must immediately follow a parsed element and contain a signed decimal integer. Roman values, fractions, inferred oxidation states and annotations after an existing count are not supported.

The AST uses `Oxidation`, separately from `Charge`. `Fe^{3+}` remains an ionic charge; `Fe^{+3}` is not silently reinterpreted. For this chemical-formula profile, GB/T 18028–2010 §8.2.2.5 permits omission of the positive sign and number prefix and uses lowered digits. Negative signs remain. Upper-right direction is dots 34; directly-above is 46,34. An end marker 156 is emitted before a following count or other non-element continuation; it may be omitted at the end or before the next element. This preserves the printed sulfur-oxide example and avoids confusing oxidation values with atom counts. Charge still uses its existing upper-annotation direction and ordinary numerals.

## Composite symbolic atom counts

`C_{n+1}H_{2n+2}`, `C_nH_{2n-2}`, `S_{2i}` and a single lowercase variable are supported. The bounded grammar is an optional positive integer coefficient, one lowercase Latin variable, and an optional `+` or `-` followed by a nonnegative integer. Plain integer counts retain lowered digits. Composite indices use direction 16 and end 156, with ordinary prefixed numerals, lowercase marker 56, and the checked plus/minus cells. This does not support arbitrary TeX, multiple variables, multiplication signs, powers, fractions or inferred constraints on the variable.

The printed `C_nH_{2n+2}` example retains continuous-capital marker 456 across its index and resumes H without another capital marker. The encoder now follows that behavior; an older test that assumed a symbolic index always ended the chemical capital run was corrected against the printed example.

## Linear electron configurations

Whole inputs such as `1s^2 2s^2 2p^6` or `1s^{2} 2s^2 2p^6` produce an `ElectronConfiguration` AST with individually source-mapped orbital entries. Entries must be whitespace-separated. Shells 1–7 and orbitals s/p/d/f are accepted where the orbital exists in that shell, with positive populations bounded by 2/6/10/14 and no repeated shell-orbital pair. No missing shells, element identity, ground-state ordering or spin arrangement is inferred. Output preserves the supplied entry order, emits shell number, lowercase orbital letter, upper-index direction 34 and lowered population, and keeps the configuration in one layout group. Source whitespace does not introduce braille blanks between entries, matching the printed linear examples.

Noble-gas shorthand, orbital boxes/spins, Lewis diagrams and graph structures remain unsupported. Invalid or mixed configuration input is retained as one unhandled source span instead of partly interpreted as molecular coefficients and charges. Existing input-size limits apply.

## Evidence and test distinction

The implementation was checked against the official [GB/T 18028–2010 publication](https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=7540BACDF4C6BAB8C9F8618D129D55EB): printed p60 §8.1.2.3–4 distinguishes charge and oxidation; p62 §8.2.2.4 includes `C_nH_{2n+2}` and `C_nH_{2n-2}`, and §8.2.2.5 gives annotated sulfur oxides; p66 §8.3.2.1 gives hydrogen and oxygen linear configurations. Tests label directly read examples/fragments separately from derived compositions such as `C_{n+1}` and neon's population 6. Direction/letter symbols come from the same standard's tables. These bounded additions do not claim complete chemistry-standard coverage.
