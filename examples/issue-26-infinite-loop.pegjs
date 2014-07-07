/*
 * Issue #26
 * =========
 *
 * Sample grammar showcasing infinite loop due to *Kleene operator* around 'empty' (`ALPHA` and `DIGIT`)
 * 
 */

start_1 = .* (!.)*

start_2 = .* (!.)+

start_3 = ALPHA ( ALPHA / DIGIT / "+" / "-" / "." )*

// note the STAR in the ALPHA and DIGIT rules:
ALPHA = [a-zA-Z]*
DIGIT = [0-9]*



/*
 * issue #190:
 */

start_4 = Q
start_5 = R
start_6 = S
start_7 = T


Q = b? Q a

R = b* R a

S = a? S a

T = a* T a



a = "a";
b = "b";
