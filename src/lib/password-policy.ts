export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}

export function validatePasswordPolicy(password: string, policy: PasswordPolicy): string | null {
  if (password.length < policy.minLength)
    return `Kata laluan perlu sekurang-kurangnya ${policy.minLength} aksara.`;
  if (policy.requireUppercase && !/[A-Z]/.test(password))
    return "Kata laluan perlu mengandungi sekurang-kurangnya satu huruf besar.";
  if (policy.requireNumber && !/[0-9]/.test(password))
    return "Kata laluan perlu mengandungi sekurang-kurangnya satu nombor.";
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password))
    return "Kata laluan perlu mengandungi sekurang-kurangnya satu simbol.";
  return null;
}
