import { useState } from 'react';

type Validator = (value: string) => string | null;

/**
 * Bundles a field's value with blur/change-triggered validation: validates
 * on blur, then re-validates on every keystroke once the field has been
 * touched (so the error clears the moment the input becomes valid). Error
 * state persists until the value actually passes.
 */
export function useValidatedInput(initialValue: string, validate: Validator) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  function onChange(newValue: string) {
    setValue(newValue);
    if (touched) setError(validate(newValue));
  }

  function onBlur() {
    setTouched(true);
    setError(validate(value));
  }

  /** Validates immediately (e.g. on submit) and returns whether the field is valid. */
  function validateNow(): boolean {
    const result = validate(value);
    setTouched(true);
    setError(result);
    return !result;
  }

  return { value, setValue, error, onChange, onBlur, validateNow };
}
