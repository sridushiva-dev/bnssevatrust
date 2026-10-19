import { z } from "zod";

import { PAN_REGEX, phoneSchema, pinCodeSchema } from "./indian";

export const donorFormSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  phone: phoneSchema,
  email: z.string().email().optional().or(z.literal("")),
  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || PAN_REGEX.test(v), "Invalid PAN format"),
  addressLine1: z.string().trim().min(3, "Address is required"),
  addressLine2: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().min(2),
  state: z.string().trim().min(2),
  pinCode: pinCodeSchema,
});

export type DonorFormInput = z.infer<typeof donorFormSchema>;
