"use client";
import { useId, useState } from "react";
import * as Flags from "country-flag-icons/react/3x2";
import {
  phoneCountries,
  phoneCountry as findPhoneCountry,
  phoneError,
  splitPhoneNumber,
} from "@/lib/phone";
/**
 * Country code plus national digits, submitted as one `guestPhone` value ("+639171234567").
 * A number that breaks the country's rule blocks the form from submitting.
 */
export function PhoneField({
  label,
  required,
  defaultValue = "",
}: {
  label: string;
  required: boolean;
  defaultValue?: string;
}) {
  const id = useId();
  const [phoneCountry, setPhoneCountry] = useState(
      () => splitPhoneNumber(defaultValue).countryCode,
    ),
    [phoneDigits, setPhoneDigits] = useState(
      () => splitPhoneNumber(defaultValue).digits,
    );
  const selectedCountry = findPhoneCountry(phoneCountry);
  const maxPhoneDigits = selectedCountry?.digits ?? 15;
  const Flag = selectedCountry ? Flags[selectedCountry.iso] : undefined;
  const phoneProblem = phoneDigits ? phoneError(phoneCountry, phoneDigits) : "";
  const showProblem = !!phoneProblem && phoneDigits.length >= maxPhoneDigits;
  return (
    <div className="phone-field">
      <label htmlFor={id}>{label}</label>
      <div className="phone-input-row">
        <div className="phone-country">
          <span className="phone-country-code" aria-hidden="true">
            {Flag && <Flag className="phone-flag" />}
            {phoneCountry}
          </span>
          <select
            aria-label="Phone country code"
            value={phoneCountry}
            onChange={(event) => {
              setPhoneCountry(event.target.value);
              setPhoneDigits((digits) =>
                digits
                  .replace(/\D/g, "")
                  .slice(0, findPhoneCountry(event.target.value)?.digits ?? 15),
              );
            }}
          >
            {phoneCountries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name} ({country.code})
              </option>
            ))}
          </select>
        </div>
        <input
          id={id}
          ref={(el) => el?.setCustomValidity(phoneProblem)}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={maxPhoneDigits}
          value={phoneDigits}
          onChange={(event) =>
            setPhoneDigits(
              event.target.value.replace(/\D/g, "").slice(0, maxPhoneDigits),
            )
          }
          placeholder="Digits only"
          required={required}
          autoComplete="tel-national"
          aria-invalid={showProblem || undefined}
          aria-describedby={id + "-rule"}
        />
      </div>
      <p
        id={id + "-rule"}
        className={showProblem ? "field-hint error" : "field-hint"}
      >
        {selectedCountry?.rule}
      </p>
      <input
        type="hidden"
        name="guestPhone"
        value={phoneDigits ? phoneCountry + phoneDigits : ""}
      />
    </div>
  );
}
