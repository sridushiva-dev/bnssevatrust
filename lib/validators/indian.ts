import { z } from "zod";

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const PIN_CODE_REGEX = /^[1-9][0-9]{5}$/;

export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(PAN_REGEX, "Invalid Indian PAN format (e.g. ABCDE1234F)");

export const pinCodeSchema = z
  .string()
  .trim()
  .regex(PIN_CODE_REGEX, "Invalid Indian PIN code (6 digits, cannot start with 0)");

export const phoneSchema = z
  .string()
  .trim()
  .min(10, "Phone number is required")
  .max(15)
  .transform((v) => v.replace(/\s+/g, ""));
