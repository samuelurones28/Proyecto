// utils/validation.ts
// Módulo centralizado de validación de inputs

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string | number;
}

// Validación de peso (kg)
export const validateWeight = (value: string): ValidationResult => {
  const num = parseFloat(value.replace(',', '.'));
  if (isNaN(num)) return { valid: false, error: 'Introduce un número válido' };
  if (num < 20 || num > 300) return { valid: false, error: 'El peso debe estar entre 20 y 300 kg' };
  return { valid: true, sanitized: num };
};

// Validación de porcentaje de grasa corporal
export const validateBodyFat = (value: string): ValidationResult => {
  const num = parseFloat(value.replace(',', '.'));
  if (isNaN(num)) return { valid: false, error: 'Introduce un número válido' };
  if (num < 3 || num > 60) return { valid: false, error: 'El porcentaje debe estar entre 3% y 60%' };
  return { valid: true, sanitized: num };
};

// Validación de músculo (kg)
export const validateMuscle = (value: string): ValidationResult => {
  const num = parseFloat(value.replace(',', '.'));
  if (isNaN(num)) return { valid: false, error: 'Introduce un número válido' };
  if (num < 10 || num > 100) return { valid: false, error: 'La masa muscular debe estar entre 10 y 100 kg' };
  return { valid: true, sanitized: num };
};

// Validación de edad
export const validateAge = (value: string): ValidationResult => {
  const num = parseInt(value, 10);
  if (isNaN(num)) return { valid: false, error: 'Introduce un número válido' };
  if (num < 13 || num > 120) return { valid: false, error: 'La edad debe estar entre 13 y 120 años' };
  return { valid: true, sanitized: num };
};

// Validación de altura (cm)
export const validateHeight = (value: string): ValidationResult => {
  const num = parseInt(value, 10);
  if (isNaN(num)) return { valid: false, error: 'Introduce un número válido' };
  if (num < 100 || num > 250) return { valid: false, error: 'La altura debe estar entre 100 y 250 cm' };
  return { valid: true, sanitized: num };
};

// Validación de calorías
export const validateCalories = (value: string): ValidationResult => {
  const num = parseInt(value, 10);
  if (isNaN(num)) return { valid: false, error: 'Introduce un número válido' };
  if (num < 500 || num > 10000) return { valid: false, error: 'Las calorías deben estar entre 500 y 10000' };
  return { valid: true, sanitized: num };
};

// Validación de macros (g)
export const validateMacro = (value: string, name: string): ValidationResult => {
  const num = parseFloat(value.replace(',', '.'));
  if (isNaN(num)) return { valid: false, error: 'Introduce un número válido' };
  if (num < 0 || num > 1000) return { valid: false, error: `${name} debe estar entre 0 y 1000g` };
  return { valid: true, sanitized: num };
};

// Validación de repeticiones
export const validateReps = (value: string): ValidationResult => {
  const num = parseInt(value, 10);
  if (isNaN(num)) return { valid: false, error: 'Introduce un número válido' };
  if (num < 1 || num > 500) return { valid: false, error: 'Las repeticiones deben estar entre 1 y 500' };
  return { valid: true, sanitized: num };
};

// Validación de peso levantado (kg)
export const validateLiftWeight = (value: string): ValidationResult => {
  const num = parseFloat(value.replace(',', '.'));
  if (isNaN(num)) return { valid: false, error: 'Introduce un número válido' };
  if (num < 0 || num > 500) return { valid: false, error: 'El peso debe estar entre 0 y 500 kg' };
  return { valid: true, sanitized: num };
};

// Validación de nombre/texto (longitud máxima)
export const validateText = (value: string, maxLength: number = 100): ValidationResult => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return { valid: false, error: 'Este campo no puede estar vacío' };
  if (trimmed.length > maxLength) return { valid: false, error: `Máximo ${maxLength} caracteres` };
  return { valid: true, sanitized: trimmed };
};

// Validación de email
export const validateEmail = (value: string): ValidationResult => {
  const trimmed = value.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return { valid: false, error: 'Email no válido' };
  return { valid: true, sanitized: trimmed };
};

// Sanitizar número decimal (para formularios)
export const sanitizeDecimal = (value: string): string => {
  // Permite solo números, coma y punto
  return value.replace(/[^0-9.,]/g, '').replace(',', '.');
};

// Sanitizar número entero (para formularios)
export const sanitizeInteger = (value: string): string => {
  // Permite solo números
  return value.replace(/[^0-9]/g, '');
};
