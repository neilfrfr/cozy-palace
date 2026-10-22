/**
 * Guest phone numbers are stored as "+<country code><national digits>".
 * Each country lists the national number length and the pattern it must match
 * (without the leading trunk 0), so obviously wrong numbers are rejected.
 */
export const phoneCountries = [
  {
    iso: "PH",
    name: "Philippines",
    code: "+63",
    digits: 10,
    pattern: /^9\d{9}$/,
    rule: "Philippine mobile numbers have 10 digits and start with 9.",
  },
  {
    iso: "SG",
    name: "Singapore",
    code: "+65",
    digits: 8,
    pattern: /^[689]\d{7}$/,
    rule: "Singapore numbers have 8 digits and start with 6, 8 or 9.",
  },
  {
    iso: "US",
    name: "United States / Canada",
    code: "+1",
    digits: 10,
    pattern: /^[2-9]\d{2}[2-9]\d{6}$/,
    rule: "US and Canadian numbers have 10 digits; the area code and exchange can't start with 0 or 1.",
  },
  {
    iso: "GB",
    name: "United Kingdom",
    code: "+44",
    digits: 10,
    pattern: /^[1237]\d{9}$/,
    rule: "UK numbers have 10 digits after +44 (drop the leading 0) and start with 1, 2, 3 or 7.",
  },
  {
    iso: "AU",
    name: "Australia",
    code: "+61",
    digits: 9,
    pattern: /^[23478]\d{8}$/,
    rule: "Australian numbers have 9 digits after +61 (drop the leading 0) and start with 2, 3, 4, 7 or 8.",
  },
  {
    iso: "IN",
    name: "India",
    code: "+91",
    digits: 10,
    pattern: /^[6-9]\d{9}$/,
    rule: "Indian mobile numbers have 10 digits and start with 6, 7, 8 or 9.",
  },
] as const;

export type PhoneCountry = (typeof phoneCountries)[number];

export function phoneCountry(code: string): PhoneCountry | undefined {
  return phoneCountries.find((c) => c.code === code);
}

/** Splits a stored number into its country code and national digits. */
export function splitPhoneNumber(value: string): {
  countryCode: string;
  digits: string;
} {
  const country = [...phoneCountries]
    .sort((a, b) => b.code.length - a.code.length)
    .find((candidate) => value.startsWith(candidate.code));
  return {
    countryCode: country?.code ?? "+63",
    digits: value.slice(country?.code.length ?? 0).replace(/\D/g, ""),
  };
}

/** Returns the rule the digits break, or "" when the number is valid. */
export function phoneError(code: string, digits: string): string {
  const country = phoneCountry(code);
  if (!country) return "Choose a country code.";
  return country.pattern.test(digits) ? "" : country.rule;
}

/** True for a full "+<code><digits>" number that follows its country's rules. */
export function isValidPhone(value: string): boolean {
  const country = [...phoneCountries]
    .sort((a, b) => b.code.length - a.code.length)
    .find((candidate) => value.startsWith(candidate.code));
  return !!country && country.pattern.test(value.slice(country.code.length));
}
